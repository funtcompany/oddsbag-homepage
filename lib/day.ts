// 날짜를 사람이 읽는 글자로 — 한 곳에서만 만든다
//
// ★같은 일을 화면마다 따로 하고 있었다.
//    기사 머리   2026-08-19  (기계가 읽는 형식이 그대로 나왔다)
//    목록 한 줄  08월 19일   (앞의 0 이 붙어 어색했다)
//    댓글        2026-08-19
//  → 여기 두 함수만 쓴다. 형식을 바꿀 일이 생기면 이 파일만 고친다.

/** 2026-08-19 → «2026년 8월 19일» (기사 머리·댓글처럼 한 건을 자세히 보일 때) */
export function krDate(iso?: string): string {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso ?? "";
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일`;
}

/** 2026-08-19 → «8월 19일» (목록처럼 여러 건을 짧게 보일 때) */
export function krShort(iso?: string): string {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso ?? "";
  return `${Number(m[2])}월 ${Number(m[3])}일`;
}
