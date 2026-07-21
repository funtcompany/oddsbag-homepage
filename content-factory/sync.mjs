// 노션 → 홈페이지 동기화
//
// 노션 '오즈백 수집함'에서 상태=발행 인 글을 읽어 홈페이지(Redis)에 반영한다.
// 사장님이 노션에서 직접 고친 내용(제목/본문/카테고리)이 그대로 홈페이지에 반영된다.
//
// 주의: 자동화가 만든 메타데이터(품질점수·감사시각·SNS 게시ID)는 노션에 없다.
// 그냥 덮어쓰면 같은 글을 인스타에 두 번 올리거나 무한 재감사하게 되므로 반드시 보존한다.

import { getPublishedFromNotion, notionEnabled } from "./notion.mjs";
import { upsertPublished } from "./posts.mjs";
import { kvGet } from "./store.mjs";

export async function syncFromNotion() {
  if (!notionEnabled) return { synced: [], skipped: 0 };

  const posts = await getPublishedFromNotion();
  const synced = [];
  let skipped = 0;

  for (const incoming of posts) {
    if (!incoming.title || !incoming.body) {
      skipped++;
      continue;
    }

    // 기존 Redis 메타데이터 보존 (노션이 모르는 정보)
    let existing = null;
    try {
      const raw = await kvGet(`post:${incoming.slug}`);
      if (raw) existing = JSON.parse(raw);
    } catch {
      /* 없으면 신규 */
    }

    const bodyChanged = existing ? existing.body.trim() !== incoming.body.trim() : true;

    const merged = {
      ...incoming,
      quality: existing?.quality,
      social: existing?.social,
      publishedAt: existing?.publishedAt ?? new Date().toISOString(),
      createdAt: existing?.createdAt ?? incoming.createdAt,
      featured: existing?.featured ?? incoming.featured,
      hook: incoming.hook ?? existing?.hook,
      // 노션에서 본문이 바뀌었으면 다시 감사해야 하므로 감사 이력을 비운다
      auditedAt: bodyChanged ? undefined : existing?.auditedAt,
    };

    await upsertPublished(merged);
    synced.push({ slug: merged.slug, title: merged.title });
  }
  return { synced, skipped };
}
