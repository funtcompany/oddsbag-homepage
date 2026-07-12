// 노션 → 홈페이지 동기화
// 노션 '오즈백 수집함'에서 상태=발행 인 글을 읽어 홈페이지(Redis)에 반영.
// 멱등(idempotent): 여러 번 돌려도 안전하게 최신 내용으로 덮어씀.

import { getPublishedFromNotion, notionEnabled } from "@/lib/notion";
import { upsertPublished } from "@/lib/posts";

export async function syncFromNotion(): Promise<{
  synced: { slug: string; title: string }[];
  skipped: number;
}> {
  if (!notionEnabled) return { synced: [], skipped: 0 };

  const posts = await getPublishedFromNotion();
  const synced: { slug: string; title: string }[] = [];
  let skipped = 0;

  for (const post of posts) {
    if (!post.title || !post.body) {
      skipped++;
      continue;
    }
    await upsertPublished(post);
    synced.push({ slug: post.slug, title: post.title });
  }
  return { synced, skipped };
}
