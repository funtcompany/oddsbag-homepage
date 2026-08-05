// 가이드 시효(확인일) 관리 — content-factory/guide-age.mjs 의 쌍둥이.
// 둘 중 하나만 고치면 어긋난다. 반드시 같이 고칠 것.
//
// OS와 앱은 해마다 바뀐다. 작년에 맞았던 메뉴 이름이 올해는 없을 수 있다.
// 그런데 사실이 정말 바뀌었는지는 공식 문서를 사람이 봐야 안다.
// → 자동으로 내용을 고치지 않는다. 오래된 것을 골라내 리포트에 올릴 뿐이다.

import type { Post } from "@/lib/posts";

/** 이 일수가 지난 가이드는 "확인 필요"로 본다 */
export const GUIDE_STALE_DAYS = Number(process.env.GUIDE_STALE_DAYS || 180);

/** 근거를 마지막으로 확인한 시각 (없으면 발행일 → 그것도 없으면 작성일) */
export function guideCheckedAt(post: Partial<Post>): string | null {
  return post?.factsCheckedAt ?? post?.publishedAt ?? post?.date ?? null;
}

/** 확인한 지 며칠 지났나 (알 수 없으면 Infinity) */
export function guideAgeDays(post: Partial<Post>): number {
  const at = guideCheckedAt(post);
  if (!at) return Infinity;
  const t = new Date(at).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return Math.floor((Date.now() - t) / 864e5);
}

/** 확인일이 지난 가이드 — 오래된 것부터 */
export function staleGuides(
  published: Post[],
  days: number = GUIDE_STALE_DAYS,
): { post: Post; days: number }[] {
  return (published ?? [])
    .filter((p) => p?.category === "꿀팁")
    .map((p) => ({ post: p, days: guideAgeDays(p) }))
    .filter((x) => Number.isFinite(x.days) && x.days >= days)
    .sort((a, b) => b.days - a.days);
}
