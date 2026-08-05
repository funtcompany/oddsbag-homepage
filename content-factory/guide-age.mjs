// 가이드 시효(확인일) 관리 — "이 글, 아직도 맞는 말인가?"를 기계가 대신 물어본다.
//
// OS와 앱은 해마다 바뀐다. 작년에 맞았던 메뉴 이름이 올해는 없을 수 있다.
// 그런데 사실이 정말 바뀌었는지는 공식 문서를 사람이 봐야 안다.
// → 그래서 여기서는 **자동으로 내용을 고치지 않는다.** 오래된 것을 골라내 리포트에 올릴 뿐이다.
//
// 【확인일이 어디서 오나】
//   본문의 [버전] 줄에는 날짜를 쓰지 않기로 했다 (근거에 없는 시점을 적으면 환각으로 걸린다).
//   그래서 글에 붙은 factsCheckedAt 을 기준으로 센다. 없으면 발행일로 본다.
//   노션에서 본문을 손보면 sync.mjs 가 이 날짜를 오늘로 갱신한다 (= 사람이 확인했다는 뜻).

/** 이 일수가 지난 가이드는 "확인 필요"로 본다 */
export const GUIDE_STALE_DAYS = Number(process.env.GUIDE_STALE_DAYS || 180);

/** 근거를 마지막으로 확인한 시각 (없으면 발행일 → 그것도 없으면 작성일) */
export function guideCheckedAt(post) {
  return post?.factsCheckedAt ?? post?.publishedAt ?? post?.date ?? null;
}

/** 확인한 지 며칠 지났나 (알 수 없으면 Infinity) */
export function guideAgeDays(post) {
  const at = guideCheckedAt(post);
  if (!at) return Infinity;
  const t = new Date(at).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return Math.floor((Date.now() - t) / 864e5);
}

/**
 * 확인일이 지난 가이드 — 오래된 것부터
 * @param {any[]} published 발행글 전체
 * @param {number} days     기준 일수
 * @returns {{post: any, days: number}[]}
 */
export function staleGuides(published, days = GUIDE_STALE_DAYS) {
  return (published ?? [])
    .filter((p) => p?.category === "꿀팁")
    .map((p) => ({ post: p, days: guideAgeDays(p) }))
    .filter((x) => Number.isFinite(x.days) && x.days >= days)
    .sort((a, b) => b.days - a.days);
}
