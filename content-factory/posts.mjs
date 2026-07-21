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

import fs from "node:fs";
import path from "node:path";
import { unstable_cache } from "./cache.mjs";
import { kvGet, kvSet, kvDel, smembers, sadd, srem } from "./store.mjs";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const K_PUBLISHED = "posts:published";
const K_DRAFTS = "posts:drafts";
const K_QUEUE = "posts:queued"; // 예약 발행 대기열
const postKey = (slug) => `post:${slug}`;

// ---- 파일 시드 ----
function readSeedPosts() {
  // 시드 폴더 없으면 무시
  try {
    if (!fs.existsSync(POSTS_DIR)) return [];
    return fs
      .readdirSync(POSTS_DIR)
      .filter((f) => f.endsWith(".json") && !f.startsWith("._"))
      .map((f) =>
        JSON.parse(fs.readFileSync(path.join(POSTS_DIR, f), "utf-8")),
      );
  } catch {
    return [];
  }
}

// ---- Redis ----
async function readRedisPosts(setKey) {
  const slugs = await smembers(setKey);
  if (slugs.length === 0) return [];
  const raws = await Promise.all(slugs.map((s) => kvGet(postKey(s))));
  return raws
    .filter((r) => Boolean(r))
    .map((r) => JSON.parse(r));
}

function sortByDateDesc(posts) {
  return [...posts].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt ?? "") < (a.createdAt ?? "") ? -1 : 1;
  });
}

// ---- 공개(발행) 조회 ----
// 파일 시드 + Redis 발행글 병합
async function loadAllPublished() {
  const seeds = readSeedPosts().filter((p) => p.status === "published");
  // Redis가 일시적으로 안 돼도 시드 콘텐츠로 안전하게 렌더 (ISR이 곧 복구)
  let redis = [];
  try {
    redis = await readRedisPosts(K_PUBLISHED);
  } catch (e) {
    console.warn("Redis 읽기 실패, 시드만 사용:", e.message);
  }
  const bySlug = new Map();
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

export async function getLatestPosts(count) {
  const all = await getAllPosts();
  return count ? all.slice(0, count) : all;
}

export async function getFeaturedPost() {
  const all = await getAllPosts();
  return all.find((p) => p.featured) ?? all[0];
}

export async function getPostsByCategory(label, count) {
  const list = (await getAllPosts()).filter((p) => p.category === label);
  return count ? list.slice(0, count) : list;
}

export async function getPostBySlug(slug) {
  // 캐시된 발행 목록에서 조회 (방문마다 DB 조회 안 함)
  return (await getAllPosts()).find((p) => p.slug === slug);
}

export async function getRelatedPosts(post, count = 4) {
  const all = (await getAllPosts()).filter((p) => p.slug !== post.slug);
  const same = all.filter((p) => p.category === post.category);
  const others = all.filter((p) => p.category !== post.category);
  return [...same, ...others].slice(0, count);
}

// ---- 관리자(검수/발행) ----
export async function getDrafts() {
  const drafts = await readRedisPosts(K_DRAFTS);
  return drafts.sort((a, b) =>
    (b.createdAt ?? "") > (a.createdAt ?? "") ? 1 : -1,
  );
}

// 초안 저장 (검수함으로)
export async function saveDraft(post) {
  post.status = "draft";
  await kvSet(postKey(post.slug), JSON.stringify(post));
  await sadd(K_DRAFTS, post.slug);
}

// 발행
export async function publishPost(slug) {
  const raw = await kvGet(postKey(slug));
  if (!raw) return false;
  const post = JSON.parse(raw);
  post.status = "published";
  await kvSet(postKey(slug), JSON.stringify(post));
  await sadd(K_PUBLISHED, slug);
  await srem(K_DRAFTS, slug);
  return true;
}

// ---- 예약 발행 대기열 ----
// 한 번에 여러 건을 몰아서 올리지 않고, 시간 간격을 두고 하나씩 올린다.
// 홈페이지가 하루 종일 살아 움직이는 느낌을 준다.

export async function queuePost(post, publishAt) {
  post.status = "queued";
  post.publishAt = publishAt.toISOString();
  await kvSet(postKey(post.slug), JSON.stringify(post));
  await sadd(K_QUEUE, post.slug);
}

export async function getQueued() {
  const list = await readRedisPosts(K_QUEUE);
  return list.sort((a, b) => (a.publishAt ?? "") < (b.publishAt ?? "") ? -1 : 1);
}

export async function queueSize() {
  try {
    return (await smembers(K_QUEUE)).length;
  } catch {
    return 0;
  }
}

// 대기열 → 발행
export async function releaseFromQueue(post) {
  post.status = "published";
  post.publishedAt = new Date().toISOString();
  post.date = post.publishedAt.slice(0, 10); // 실제 올라간 날짜로 맞춘다
  delete post.publishAt;
  await kvSet(postKey(post.slug), JSON.stringify(post));
  await sadd(K_PUBLISHED, post.slug);
  await srem(K_QUEUE, post.slug);
}

// 발행 게시물 업서트 (노션 동기화용)
export async function upsertPublished(post) {
  post.status = "published";
  await kvSet(postKey(post.slug), JSON.stringify(post));
  await sadd(K_PUBLISHED, post.slug);
}

// 발행 취소 → 검수함으로 되돌림 (품질 점검에서 문제 발견 시)
export async function unpublishPost(slug, reason) {
  const raw = await kvGet(postKey(slug));
  if (!raw) return false;
  const post = JSON.parse(raw);
  post.status = "draft";
  if (post.quality) post.quality.note = reason;
  await kvSet(postKey(slug), JSON.stringify(post));
  await srem(K_PUBLISHED, slug);
  await sadd(K_DRAFTS, slug);
  return true;
}

// 발행글 원본(캐시 거치지 않음) — 점검 크론용
export async function getPublishedRaw() {
  return readRedisPosts(K_PUBLISHED);
}

// 글 하나를 캐시 없이 바로 조회 (인스타가 발행 직후 카드 이미지를 가져갈 때 필요)
export async function getPostFresh(slug) {
  try {
    const raw = await kvGet(postKey(slug));
    if (raw) return JSON.parse(raw);
  } catch {
    /* Redis 실패 시 캐시로 폴백 */
  }
  return getPostBySlug(slug);
}

// 게시물 완전 삭제
export async function deletePost(slug) {
  await kvDel(postKey(slug));
  await srem(K_DRAFTS, slug);
  await srem(K_QUEUE, slug);
  await srem(K_PUBLISHED, slug);
}
