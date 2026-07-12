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

export type PostStatus = "draft" | "published";

export interface Post {
  slug: string;
  title: string;
  summary: string;
  category: string;
  date: string; // YYYY-MM-DD
  status: PostStatus;
  body: string;
  emoji?: string;
  mood?: string; // AI가 판별한 분위기 (디자인 색에 반영)
  cover?: string; // 커버 이미지 URL (Pexels 등)
  imageCredit?: string; // 사진 출처 표기
  featured?: boolean;
  readMinutes?: number;
  tags?: string[];
  sources?: { title: string; url: string }[];
  createdAt?: string; // 초안 생성 시각 (정렬용)
}

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const K_PUBLISHED = "posts:published";
const K_DRAFTS = "posts:drafts";
const postKey = (slug: string) => `post:${slug}`;

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
async function readRedisPosts(setKey: string): Promise<Post[]> {
  const slugs = await smembers(setKey);
  if (slugs.length === 0) return [];
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

export async function getLatestPosts(count?: number): Promise<Post[]> {
  const all = await getAllPosts();
  return count ? all.slice(0, count) : all;
}

export async function getFeaturedPost(): Promise<Post | undefined> {
  const all = await getAllPosts();
  return all.find((p) => p.featured) ?? all[0];
}

export async function getPostsByCategory(
  label: string,
  count?: number,
): Promise<Post[]> {
  const list = (await getAllPosts()).filter((p) => p.category === label);
  return count ? list.slice(0, count) : list;
}

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
  // 캐시된 발행 목록에서 조회 (방문마다 DB 조회 안 함)
  return (await getAllPosts()).find((p) => p.slug === slug);
}

export async function getRelatedPosts(post: Post, count = 4): Promise<Post[]> {
  const all = (await getAllPosts()).filter((p) => p.slug !== post.slug);
  const same = all.filter((p) => p.category === post.category);
  const others = all.filter((p) => p.category !== post.category);
  return [...same, ...others].slice(0, count);
}

// ---- 관리자(검수/발행) ----
export async function getDrafts(): Promise<Post[]> {
  const drafts = await readRedisPosts(K_DRAFTS);
  return drafts.sort((a, b) =>
    (b.createdAt ?? "") > (a.createdAt ?? "") ? 1 : -1,
  );
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
  if (!raw) return false;
  const post = JSON.parse(raw) as Post;
  post.status = "published";
  await kvSet(postKey(slug), JSON.stringify(post));
  await sadd(K_PUBLISHED, slug);
  await srem(K_DRAFTS, slug);
  return true;
}

// 발행 게시물 업서트 (노션 동기화용)
export async function upsertPublished(post: Post): Promise<void> {
  post.status = "published";
  await kvSet(postKey(post.slug), JSON.stringify(post));
  await sadd(K_PUBLISHED, post.slug);
}

// 게시물 완전 삭제
export async function deletePost(slug: string): Promise<void> {
  await kvDel(postKey(slug));
  await srem(K_DRAFTS, slug);
  await srem(K_PUBLISHED, slug);
}
