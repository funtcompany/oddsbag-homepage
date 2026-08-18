// 매거진 게시물 데이터 계층
//
// 두 소스를 병합한다:
//  1) 파일 시드 (content/posts/*.json) — 빌드 타임 기본 콘텐츠
//  2) Redis (Upstash) — 자동화 파이프라인이 발행한 콘텐츠
//     · post:<slug>       게시물 JSON
//     · posts:published    발행된 slug 집합
//     · posts:drafts       검수 대기(초안) slug 집합
//
// 파이프라인: 이슈 수집(네이버) → AI 초안(Claude) → 검수함(draft) → 발행(published)

import fs from "fs";
import path from "path";
import { unstable_cache } from "next/cache";
import { kvGet, kvSet, kvDel, smembers, sadd, srem } from "@/lib/store";
import { DEFAULT_CHANNEL, type ChannelKey } from "@/lib/channels";

export type PostStatus = "draft" | "queued" | "published" | "archived";

export interface Post {
  slug: string;
  title: string;
  summary: string;
  category: string;
  date: string; // YYYY-MM-DD
  status: PostStatus;
  body: string;
  /**
   * 어느 코너의 글인가 — magazine(기본) / oddsbag / music
   * 값이 없으면 매거진 글로 본다 (기존 글 전부 해당).
   */
  channel?: ChannelKey;
  emoji?: string;
  mood?: string; // AI가 판별한 분위기 (디자인 색에 반영)
  cover?: string; // 커버 이미지 URL (Pexels 등)
  imageCredit?: string; // 사진 출처 표기
  featured?: boolean;
  readMinutes?: number;
  tags?: string[];
  sources?: { title: string; url: string }[];
  createdAt?: string; // 초안 생성 시각 (정렬용)

  // ---- 자동화 파이프라인 메타 ----
  hook?: string; // 인스타 썸네일용 훅 한 줄
  notionId?: string; // 노션 페이지 ID (상태 되돌리기용)
  publishedAt?: string; // 발행 시각
  quality?: {
    score: number;
    fakeRisk: string;
    verdict: string;
    reviewedAt: string;
    rounds: number; // 자동 개선 시도 횟수
    note?: string;
  };
  publishAt?: string; // 예약 발행 시각 (대기열에 있을 때)

  /**
   * 목록에서 숨김 (2026-08-03 이전 게시물 정리용)
   * 글은 그대로 살아 있고 주소로 들어오면 정상으로 보인다.
   * 홈·목록·카테고리·검색·관련글에서만 빠진다.
   * → 검색 유입과 색인은 지키면서, 방문자가 보는 첫인상만 새 글로 채우기 위함.
   *   되돌리려면 이 값만 지우면 된다.
   */
  hidden?: boolean;
  hiddenAt?: string;
  auditedAt?: string; // 마지막 재점검 시각 (1일 3회 크론)
  social?: { ig?: string; fb?: string; at?: string }; // SNS 게시 결과

  /** 보관함으로 옮긴 시각·사유 (지운 게 아니라 자리만 옮긴 것 — 되돌릴 수 있다) */
  archivedAt?: string;
  archivedReason?: string;

  /** 짧은 꿀팁을 자동 보강한 시각 (한 번만 보강한다) */
  expandedAt?: string;

  // ---- 가이드(꿀팁) 전용 ----
  /**
   * 위험 주제 — 잘못 따라 하면 자료가 날아가거나 돈이 걸리는 종류.
   * 점수와 무관하게 자동 발행하지 않고 검수함으로 보낸다. 자동 구조 대상에서도 뺀다.
   */
  risky?: boolean;
  /** 근거(facts)를 마지막으로 확인한 시각 — 시효 판단 기준 (lib/guideAge.ts) */
  factsCheckedAt?: string;
  /** 확인일이 지나 "갱신 필요"로 표시된 것. 내용은 건드리지 않고 리포트에만 올린다 */
  staleGuide?: { flaggedAt: string; days: number };
  // 사실은 멀쩡한데 가이드 형식([즉답]·[버전]·[Q]/[A]·분량)만 모자란 글.
  // 내리지 않고 발행을 유지한 채 표시만 해 둔다 — 2일 점검 리포트에서 사람이 본다.
  needsFormat?: { issues: string[]; flaggedAt: string };
}

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const K_PUBLISHED = "posts:published";
const K_DRAFTS = "posts:drafts";
const K_QUEUE = "posts:queued"; // 예약 발행 대기열
const K_ARCHIVED = "posts:archived"; // 보관함 — 검수함에서 치운 글 (삭제 아님)
const postKey = (slug: string) => `post:${slug}`;

// 검수함이 아무리 불어나도 한 번에 이만큼만 읽는다 (점검이 시간 안에 끝나게)
const MAX_DRAFT_LOAD = 200;

// ---- 파일 시드 ----
function readSeedPosts(): Post[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("._"))
    .map(
      (f) =>
        JSON.parse(fs.readFileSync(path.join(POSTS_DIR, f), "utf-8")) as Post,
    );
}

// ---- Redis ----
async function readRedisPosts(setKey: string, max?: number): Promise<Post[]> {
  let slugs = await smembers(setKey);
  if (slugs.length === 0) return [];
  if (max && slugs.length > max) slugs = slugs.slice(0, max);
  const raws = await Promise.all(slugs.map((s) => kvGet(postKey(s))));
  return raws
    .filter((r): r is string => Boolean(r))
    .map((r) => JSON.parse(r) as Post);
}

function sortByDateDesc(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt ?? "") < (a.createdAt ?? "") ? -1 : 1;
  });
}

/** 파일로 준비해 둔 글 한 건 찾기 (검수함에 미리 넣어 둔 원고) */
function findSeedPost(slug: string): Post | undefined {
  return readSeedPosts().find((p) => p.slug === slug);
}

// ---- 공개(발행) 조회 ----
// 파일 시드 + Redis 발행글 병합
async function loadAllPublished(): Promise<Post[]> {
  const seeds = readSeedPosts().filter((p) => p.status === "published");
  // Redis가 일시적으로 안 돼도 시드 콘텐츠로 안전하게 렌더 (ISR이 곧 복구)
  let redis: Post[] = [];
  try {
    redis = await readRedisPosts(K_PUBLISHED);
  } catch (e) {
    console.warn("Redis 읽기 실패, 시드만 사용:", (e as Error).message);
  }
  const bySlug = new Map<string, Post>();
  for (const p of seeds) bySlug.set(p.slug, p);
  for (const p of redis) bySlug.set(p.slug, p); // Redis가 시드보다 우선
  return sortByDateDesc([...bySlug.values()]);
}

// 트래픽 최적화: 방문마다 DB를 읽지 않고 60초에 한 번만 읽어 캐시.
// 발행/동기화/삭제 시 revalidateTag("posts")로 즉시 갱신 (아래 API 라우트).
// 이 캐싱 덕분에 방문자는 CDN에서 받고, DB 부하는 트래픽과 무관하게 일정.
export const getAllPosts = unstable_cache(loadAllPublished, ["oddsbag-posts"], {
  revalidate: 60,
  tags: ["posts"],
});

/**
 * 독자에게 '보여줄' 글 목록.
 * 홈·목록·카테고리·검색·관련글은 전부 이걸 쓴다.
 * (getAllPosts 는 숨긴 글까지 포함한 전체 — 주소로 직접 들어오는 경우와 사이트맵에 쓴다)
 */
export async function getVisiblePosts(): Promise<Post[]> {
  return (await getAllPosts()).filter((p) => !p.hidden);
}

/** 이 글이 어느 코너 글인가 (값이 없으면 매거진) */
export const channelKeyOf = (p: Post): ChannelKey => p.channel ?? DEFAULT_CHANNEL;

/**
 * 코너별 글 목록.
 * 매거진 목록·카테고리·검색은 매거진 글만 본다 (오즈백/뮤직 글이 섞이지 않게).
 */
export async function getPostsByChannel(
  channel: ChannelKey,
  count?: number,
): Promise<Post[]> {
  const list = (await getVisiblePosts()).filter(
    (p) => channelKeyOf(p) === channel,
  );
  return count ? list.slice(0, count) : list;
}

/** 매거진(뉴스·이슈) 글만 */
export async function getMagazinePosts(count?: number): Promise<Post[]> {
  return getPostsByChannel("magazine", count);
}

export async function getLatestPosts(count?: number): Promise<Post[]> {
  const all = await getMagazinePosts();
  return count ? all.slice(0, count) : all;
}

/**
 * 진짜 인기글 — 우리가 직접 센 조회수(views:total) 순서.
 *
 * 예전엔 «인기글»이라고 써 붙이고 실제로는 최신글을 그대로 보여줬다.
 * 이제 실제로 많이 본 순서로 세운다. 다만:
 *   · 조회수가 아직 한 자리인 글이 많다 → 같은 수면 최신 글을 앞에 둔다
 *   · 조회수를 못 읽으면(레디스 장애) 최신 순으로 물러선다 → 화면이 비지 않는다
 */
export async function getPopularPosts(count = 8): Promise<Post[]> {
  const posts = await getMagazinePosts();
  let totals: Record<string, number> = {};
  try {
    const { getCachedTotals } = await import("@/lib/views");
    totals = await getCachedTotals();
  } catch (e) {
    console.warn("조회수 읽기 실패, 최신순으로 대체:", (e as Error).message);
    return posts.slice(0, count);
  }

  const viewsOf = (p: Post) => Number(totals[p.slug] ?? 0);
  // 이미 날짜 내림차순으로 정렬돼 있으니, 조회수가 같으면 그 순서가 유지된다
  return [...posts]
    .sort((a, b) => viewsOf(b) - viewsOf(a))
    .slice(0, count);
}

export async function getFeaturedPost(): Promise<Post | undefined> {
  const all = await getMagazinePosts();
  return all.find((p) => p.featured) ?? all[0];
}

export async function getPostsByCategory(
  label: string,
  count?: number,
): Promise<Post[]> {
  const list = (await getMagazinePosts()).filter((p) => p.category === label);
  return count ? list.slice(0, count) : list;
}

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
  // 캐시된 발행 목록에서 조회 (방문마다 DB 조회 안 함)
  return (await getAllPosts()).find((p) => p.slug === slug);
}

export async function getRelatedPosts(post: Post, count = 4): Promise<Post[]> {
  // 같은 코너 안에서만 추천한다 (매거진 글 밑에 뮤직 글이 뜨지 않게)
  const all = (await getVisiblePosts()).filter(
    (p) => p.slug !== post.slug && channelKeyOf(p) === channelKeyOf(post),
  );
  const same = all.filter((p) => p.category === post.category);
  const others = all.filter((p) => p.category !== post.category);
  return [...same, ...others].slice(0, count);
}

// ---- 관리자(검수/발행) ----
export async function getDrafts(): Promise<Post[]> {
  const drafts = await readRedisPosts(K_DRAFTS, MAX_DRAFT_LOAD);
  // 파일로 미리 써 둔 원고(content/posts/*.json 중 status:"draft")도 검수함에 함께 보여준다.
  // 사장님이 관리자 화면에서 읽어보고 발행 버튼만 누르면 올라간다.
  const have = new Set(drafts.map((p) => p.slug));
  // ★이미 발행했거나 보관한 파일 원고는 검수함에서 뺀다.
  //   publishPost 는 Redis 에만 published 로 적고 파일은 draft 로 남겨둔다.
  //   그래서 이 줄이 없으면 「올린 글」이 검수함에 영원히 그대로 남아
  //   50편을 하루 1편씩 올릴 때 어디까지 올렸는지 화면에서 구분할 수 없다. (2026-08-18)
  const done = new Set([
    ...(await smembers(K_PUBLISHED)),
    ...(await smembers(K_ARCHIVED)),
  ]);
  const seedDrafts = readSeedPosts().filter(
    (p) => p.status === "draft" && !have.has(p.slug) && !done.has(p.slug),
  );
  return [...drafts, ...seedDrafts].sort((a, b) =>
    (b.createdAt ?? "") > (a.createdAt ?? "") ? 1 : -1,
  );
}

// ---- 보관함 ----
// 검수함에 영원히 남는 글(주로 가짜뉴스 위험 high)을 치우는 자리.
// 지우는 게 아니라 자리만 옮기므로 언제든 되돌릴 수 있다.
export async function archiveDraft(
  slug: string,
  reason?: string,
): Promise<boolean> {
  const raw = await kvGet(postKey(slug));
  if (!raw) return false;
  const post = JSON.parse(raw) as Post;
  post.status = "archived";
  post.archivedAt = new Date().toISOString();
  post.archivedReason = reason ?? "";
  await kvSet(postKey(slug), JSON.stringify(post));
  await srem(K_DRAFTS, slug);
  await sadd(K_ARCHIVED, slug);
  return true;
}

export async function getArchived(): Promise<Post[]> {
  const list = await readRedisPosts(K_ARCHIVED);
  return list.sort((a, b) =>
    (b.archivedAt ?? "") > (a.archivedAt ?? "") ? 1 : -1,
  );
}

// 보관함 → 검수함 (되돌리기)
export async function restoreArchived(slug: string): Promise<boolean> {
  const raw = await kvGet(postKey(slug));
  if (!raw) return false;
  const post = JSON.parse(raw) as Post;
  post.status = "draft";
  delete post.archivedAt;
  delete post.archivedReason;
  await kvSet(postKey(slug), JSON.stringify(post));
  await srem(K_ARCHIVED, slug);
  await sadd(K_DRAFTS, slug);
  return true;
}

// 초안 저장 (검수함으로)
export async function saveDraft(post: Post): Promise<void> {
  post.status = "draft";
  await kvSet(postKey(post.slug), JSON.stringify(post));
  await sadd(K_DRAFTS, post.slug);
}

// 발행
export async function publishPost(slug: string): Promise<boolean> {
  const raw = await kvGet(postKey(slug));
  // 파일로 준비해 둔 원고는 아직 DB에 없다 → 그때만 파일에서 가져온다
  const post = raw ? (JSON.parse(raw) as Post) : findSeedPost(slug);
  if (!post) return false;
  post.status = "published";
  await kvSet(postKey(slug), JSON.stringify(post));
  await sadd(K_PUBLISHED, slug);
  await srem(K_DRAFTS, slug);
  return true;
}

// ---- 예약 발행 대기열 ----
// 한 번에 여러 건을 몰아서 올리지 않고, 시간 간격을 두고 하나씩 올린다.
// 홈페이지가 하루 종일 살아 움직이는 느낌을 준다.

export async function queuePost(post: Post, publishAt: Date): Promise<void> {
  post.status = "queued";
  post.publishAt = publishAt.toISOString();
  await kvSet(postKey(post.slug), JSON.stringify(post));
  await sadd(K_QUEUE, post.slug);
}

export async function getQueued(): Promise<Post[]> {
  const list = await readRedisPosts(K_QUEUE);
  return list.sort((a, b) => (a.publishAt ?? "") < (b.publishAt ?? "") ? -1 : 1);
}

export async function queueSize(): Promise<number> {
  try {
    return (await smembers(K_QUEUE)).length;
  } catch {
    return 0;
  }
}

// 대기열 → 발행
export async function releaseFromQueue(post: Post): Promise<void> {
  post.status = "published";
  post.publishedAt = new Date().toISOString();
  post.date = post.publishedAt.slice(0, 10); // 실제 올라간 날짜로 맞춘다
  delete post.publishAt;
  await kvSet(postKey(post.slug), JSON.stringify(post));
  await sadd(K_PUBLISHED, post.slug);
  await srem(K_QUEUE, post.slug);
}

// 발행 게시물 업서트 (노션 동기화용)
export async function upsertPublished(post: Post): Promise<void> {
  post.status = "published";
  await kvSet(postKey(post.slug), JSON.stringify(post));
  await sadd(K_PUBLISHED, post.slug);
}

// 발행 취소 → 검수함으로 되돌림 (품질 점검에서 문제 발견 시)
export async function unpublishPost(slug: string, reason: string): Promise<boolean> {
  const raw = await kvGet(postKey(slug));
  if (!raw) return false;
  const post = JSON.parse(raw) as Post;
  post.status = "draft";
  if (post.quality) post.quality.note = reason;
  await kvSet(postKey(slug), JSON.stringify(post));
  await srem(K_PUBLISHED, slug);
  await sadd(K_DRAFTS, slug);
  return true;
}

// 발행글 원본(캐시 거치지 않음) — 점검 크론용
export async function getPublishedRaw(): Promise<Post[]> {
  return readRedisPosts(K_PUBLISHED);
}

// 글 하나를 캐시 없이 바로 조회 (인스타가 발행 직후 카드 이미지를 가져갈 때 필요)
export async function getPostFresh(slug: string): Promise<Post | undefined> {
  try {
    const raw = await kvGet(postKey(slug));
    if (raw) return JSON.parse(raw) as Post;
  } catch {
    /* Redis 실패 시 캐시로 폴백 */
  }
  return (await getPostBySlug(slug)) ?? findSeedPost(slug);
}

/**
 * 관리자가 직접 쓴 글 저장 (새 글 / 수정 공통).
 * status 값에 맞춰 소속 목록(발행함·검수함·보관함)까지 정리해 준다.
 */
export async function writePost(post: Post): Promise<void> {
  const slug = post.slug;
  await kvSet(postKey(slug), JSON.stringify(post));
  const sets: Record<PostStatus, string> = {
    published: K_PUBLISHED,
    draft: K_DRAFTS,
    queued: K_QUEUE,
    archived: K_ARCHIVED,
  };
  const target = sets[post.status] ?? K_DRAFTS;
  for (const [status, key] of Object.entries(sets)) {
    if (key === target) continue;
    void status;
    await srem(key, slug);
  }
  await sadd(target, slug);
}

/** 목록에서 숨기기 / 다시 보이기 (글은 그대로 살아 있다) */
export async function setHidden(slug: string, hidden: boolean): Promise<boolean> {
  const raw = await kvGet(postKey(slug));
  if (!raw) return false;
  const post = JSON.parse(raw) as Post;
  if (hidden) {
    post.hidden = true;
    post.hiddenAt = new Date().toISOString();
  } else {
    delete post.hidden;
    delete post.hiddenAt;
  }
  await kvSet(postKey(slug), JSON.stringify(post));
  return true;
}

/** 대표글(피처드) 지정 — 한 번에 하나만 */
export async function setFeatured(slug: string): Promise<boolean> {
  const all = await getPublishedRaw();
  let found = false;
  for (const p of all) {
    const want = p.slug === slug;
    if (want) found = true;
    if (Boolean(p.featured) === want) continue;
    if (want) p.featured = true;
    else delete p.featured;
    await kvSet(postKey(p.slug), JSON.stringify(p));
  }
  return found;
}

// 게시물 완전 삭제
export async function deletePost(slug: string): Promise<void> {
  await kvDel(postKey(slug));
  await srem(K_DRAFTS, slug);
  await srem(K_QUEUE, slug);
  await srem(K_PUBLISHED, slug);
  await srem(K_ARCHIVED, slug);
}
