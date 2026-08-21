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
import {
  kvGet,
  kvSet,
  kvDel,
  kvMget,
  smembers,
  sadd,
  srem,
  isPersistent,
} from "@/lib/store";
import { readPublishedSnapshot } from "@/lib/snapshot";
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

  /**
   * 게시판 전용 글 — 여기에 서비스 slug(예: "wpms")를 적으면
   * «만드는 것들» 그 서비스 게시판(/oddsbag/service/<slug>)에서만 보인다.
   *
   * 지시 2026-08-18 «WPMS 원고는 뉴스가 아니다. WPMS 게시판에서만 보이면 된다»
   *
   *  · 빠지는 곳 : 홈 · 매거진 목록/검색 · 카테고리 · 코너 목록(/oddsbag /music /story)
   *                · 가이드 허브 · RSS · 구글 뉴스 사이트맵 · 관련글
   *  · 남는 곳   : 그 서비스 게시판 · 글 주소(직접 열기) · 일반 sitemap.xml(구글 검색)
   *
   * ★hidden 과 다르다 — hidden 은 게시판에서도 같이 사라진다(getVisiblePosts 가 먼저 거른다).
   *   게시판에 남겨야 하므로 hidden 을 쓰면 안 된다. 되돌리려면 이 값만 지우면 된다.
   */
  boardOnly?: string;
  /** 케이스북(data/casebook)에서 뽑은 글. 뉴스가 아니므로 sitemap-news.xml 에서 뺀다. */
  casebook?: string;
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
  const out: Post[] = [];
  for (const f of fs.readdirSync(POSTS_DIR)) {
    if (!f.endsWith(".json") || f.startsWith("._")) continue;
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(POSTS_DIR, f), "utf-8")) as Post);
    } catch {
      // 시드 한 장이 깨져도 사이트 전체가 죽지 않게 한다 (여기는 비상 경로다)
    }
  }
  return out;
}

// ---- Redis ----
async function readRedisPosts(setKey: string, max?: number): Promise<Post[]> {
  let slugs = await smembers(setKey);
  if (slugs.length === 0) return [];
  if (max && slugs.length > max) slugs = slugs.slice(0, max);
  // ★GET 을 slug 수만큼 부르지 않는다 — MGET 한 번(50개씩)으로 묶는다.
  //   148편이면 148 명령 → 3 명령. 하루 한도(50만)를 목록 새로고침만으로 태우던 원인이었다.
  const raws = await kvMget(slugs.map(postKey));
  const out: Post[] = [];
  for (const r of raws) {
    if (!r) continue;
    try {
      out.push(JSON.parse(r) as Post);
    } catch {
      // 깨진 글 한 편 때문에 목록 전체가 죽지 않게 한다
    }
  }
  return out;
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
//
// ★2026-08-20 «읽기를 파일로 전환» — 기본 자료는 배포에 함께 실린 파일이다.
//
//   예전 : 300초마다 레디스에서 slug 목록(SMEMBERS 1) + 본문 전체(MGET 3) = 명령 4개.
//          방문자가 0명이어도 한 달 3.5만 명령이 그냥 나갔다.
//   지금 : 본문은 스냅샷 파일(content/published-snapshot.json)에서 읽는다 — 명령 0개.
//          레디스에는 «무엇이 바뀌었나»만 물어본다.
//
//     · 300초마다 → 발행 slug 목록만 (명령 1개). 새 글·내린 글이 여기서 바로 잡힌다.
//     · 본문 전체 다시 읽기 → 글이 바뀌었다는 신호(revalidateTag("posts"))가 올 때.
//       발행·수정·삭제·감사·노션동기화는 전부 그 신호를 부른다. 신호가 없어도 6시간에 한 번은 읽는다(보험).
//     · 파일에 아직 없는 새 글 → 그 slug 만 골라 MGET (하루 1편이면 명령 1개).
//     · 레디스가 안 되면 전부 파일로 그린다 — 목록이 비지 않는다.
//
//   한 달 3.5만 → 9천 명령. 값도 값이지만, ★읽기가 레디스에 매달려 있지 않게 되는 것이 본론이다.
//
//   ※ 스냅샷 파일이 낡으면 «본문 수정»이 최대 6시간 늦게 보일 수 있다(신호가 빠졌을 때만).
//     파일은 배포마다(prebuild) · 매일 14:10(snapshot-daily.yml) 새로 뜬다.

// 마지막으로 성공한 발행글 본문 (이 서버 인스턴스 메모리).
// 레디스가 한도·장애로 안 될 때 파일보다 먼저 여기로 물러선다 — 방금 전까지 보이던 화면이 유지된다.
let lastGood: Post[] | null = null;

// 「바뀌었나」를 확인하는 주기 (명령 1개)
// ★300초 폴링은 보험이다. 발행·수정·삭제는 revalidateTag("posts") 로 «즉시» 반영된다.
const POSTS_TTL_SEC = Math.max(30, Number(process.env.POSTS_CACHE_TTL_SEC || 300));

// 아무 신호가 없어도 본문 전체를 다시 읽는 주기 (명령 4개)
const POSTS_FULL_TTL_SEC = Math.max(
  POSTS_TTL_SEC,
  Number(process.env.POSTS_FULL_TTL_SEC || 6 * 60 * 60),
);

/** 지금 발행 중인 slug 목록만 (명령 1개). 못 읽으면 null — 이때는 아무것도 걸러내지 않는다 */
const getPublishedSlugs = unstable_cache(
  async (): Promise<string[] | null> => {
    if (!isPersistent) return null;
    try {
      const slugs = await smembers(K_PUBLISHED);
      // ★빈 목록은 «글이 없다»가 아니라 «못 읽었다»로 본다. 빈 화면 사고를 막는 자리다.
      return slugs.length > 0 ? slugs : null;
    } catch (e) {
      console.warn("발행 slug 목록 읽기 실패:", (e as Error).message);
      return null;
    }
  },
  ["oddsbag-posts-slugs"],
  { revalidate: POSTS_TTL_SEC, tags: ["posts"] },
);

/** 본문까지 전부 (명령 4개). 글이 바뀌었을 때와 6시간마다만 실제로 부른다 */
const getFullPosts = unstable_cache(
  async (): Promise<Post[] | null> => {
    if (!isPersistent) return null;
    try {
      const live = await readRedisPosts(K_PUBLISHED);
      return live.length > 0 ? live : null;
    } catch (e) {
      console.warn("발행글 본문 읽기 실패:", (e as Error).message);
      return null;
    }
  },
  ["oddsbag-posts-full"],
  { revalidate: POSTS_FULL_TTL_SEC, tags: ["posts"] },
);

/**
 * 파일에 아직 없는 새 글만 따로 읽는다.
 * ★slug 목록이 캐시 열쇠에 들어간다 — 같은 새 글을 300초마다 다시 읽지 않는다.
 */
const getExtraPosts = unstable_cache(
  async (slugs: string[]): Promise<Post[]> => {
    if (!isPersistent || slugs.length === 0) return [];
    try {
      const raws = await kvMget(slugs.map(postKey));
      const out: Post[] = [];
      for (const r of raws) {
        if (!r) continue;
        try {
          out.push(JSON.parse(r) as Post);
        } catch {
          // 깨진 글 한 편 때문에 목록 전체가 죽지 않게 한다
        }
      }
      return out;
    } catch (e) {
      console.warn("새 글 읽기 실패:", (e as Error).message);
      return [];
    }
  },
  ["oddsbag-posts-extra"],
  { revalidate: POSTS_FULL_TTL_SEC, tags: ["posts"] },
);

async function loadAllPublished(): Promise<Post[]> {
  const bySlug = new Map<string, Post>();

  // ① 파일 시드 (content/posts/*.json) — 레디스에 없는 글도 있다. 걸러내지 않는다.
  for (const p of readSeedPosts().filter((p) => p.status === "published")) {
    bySlug.set(p.slug, p);
  }

  // ② 스냅샷 파일 — 여기가 본진이다. 명령 0개.
  const fromRedis = new Set<string>();
  for (const p of readPublishedSnapshot()) {
    bySlug.set(p.slug, p);
    fromRedis.add(p.slug);
  }

  // ③ 본문 전체 (신호가 왔거나 6시간이 지났을 때만 레디스를 부른다)
  const full = await getFullPosts();
  if (full) lastGood = full;
  const live = full ?? lastGood;
  if (live) {
    for (const p of live) {
      bySlug.set(p.slug, p); // 최신 자료가 파일보다 우선
      fromRedis.add(p.slug);
    }
  }

  // ④ 지금 발행 중인 목록과 대조 (명령 1개)
  const slugs = await getPublishedSlugs();
  if (slugs) {
    const now = new Set(slugs);
    // 내려간 글은 즉시 뺀다 — 파일은 어제 것일 수 있다.
    // ★파일 시드는 건드리지 않는다(레디스에 없는 채로 보여주는 글이라 지우면 사라진다).
    for (const slug of fromRedis) {
      if (!now.has(slug)) bySlug.delete(slug);
    }
    // 파일에 아직 없는 새 글만 골라 읽는다
    const missing = slugs.filter((s) => !bySlug.has(s)).sort();
    if (missing.length > 0) {
      for (const p of await getExtraPosts(missing)) bySlug.set(p.slug, p);
    }
  }

  if (bySlug.size === 0 && isPersistent) {
    console.warn("발행글을 파일·레디스 어디서도 못 읽었다 — 빈 목록으로 렌더된다");
  }
  return sortByDateDesc([...bySlug.values()]);
}

export const getAllPosts = unstable_cache(loadAllPublished, ["oddsbag-posts"], {
  revalidate: POSTS_TTL_SEC,
  tags: ["posts"],
});

/**
 * 독자에게 '보여줄' 글 목록.
 * 홈·목록·카테고리·검색·관련글은 전부 이걸 쓴다.
 * (getAllPosts 는 숨긴 글까지 포함한 전체 — 주소로 직접 들어오는 경우와 사이트맵에 쓴다)
 */
export async function getVisiblePosts(): Promise<Post[]> {
  return (await getAllPosts()).filter((p) => !p.hidden && !p.boardOnly);
}

/**
 * 서비스 게시판 전용 글 (boardOnly === board).
 * 여기서만 보여준다 — /oddsbag/service/<board>
 * 숨김(hidden) 처리한 글은 게시판에서도 뺀다 (사람이 일부러 내린 것이므로).
 */
export async function getBoardPosts(board: string): Promise<Post[]> {
  return (await getAllPosts()).filter((p) => !p.hidden && p.boardOnly === board);
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

// ★«인기글»(조회수 순)은 2026-08-20 사장님 지시로 없앴다. 조회수 집계 자체를 끄면서
//   같이 뺀 것이다 — 자세한 사정은 lib/store.ts 위쪽 주석과 board.md 를 볼 것.

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
  // 게시판 전용 글은 같은 게시판 글끼리만 이어 준다.
  //  (WPMS 글 밑에 브랜드 소식이 뜨거나, 그 반대가 되면 게시판이 섞인다)
  const pool = post.boardOnly
    ? await getBoardPosts(post.boardOnly)
    : await getVisiblePosts();
  // 같은 코너 안에서만 추천한다 (매거진 글 밑에 뮤직 글이 뜨지 않게)
  const all = pool.filter(
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
