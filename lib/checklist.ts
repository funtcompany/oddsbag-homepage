// 「챙길 것」 — 고르는 규칙 (순수 함수만. fs·react·서버 없음)
//
// ★이 도구의 급소 — «판정하지 않는다».
//   「대상입니다」라고 말하는 순간 틀렸을 때 독자가 실제로 손해를 본다.
//   여기서 하는 일은 «확인할 것을 골라 주는 것» 까지다. 대상 여부는 공식 조회 링크가 답한다.
//   그래서 나이 조건도 «가려내는 쪽으로는 느슨하게» 건다 (아래 여유 1년).
//
// 케이스북 데이터는 서버에서 읽어(lib/casebook.ts) 이 모양으로 넘어온다.
// 생년·가진 것은 브라우저 밖으로 나가지 않는다.
//
// ★이름을 바꾸려면 아래 CHECKLIST_NAME 한 줄만 고치면 화면 전체가 따라온다
//   (홈 카드 · 상단 하위 탭 · 「전체 보기」 · 사이트맵 · 페이지 제목 모두 이 값을 쓴다)

export const CHECKLIST_NAME = "챙길 것";
export const CHECKLIST_TAGLINE =
  "가진 것 몇 개만 고르면 올해 챙길 것을 한 화면에 모아 드립니다. 기관마다 흩어진 조회 링크를 한 번에, 오즈백이 그 안내를 언제 확인했는지까지 적어서.";
export const CHECKLIST_EMOJI = "📋";
export const CHECKLIST_HREF = "/check";

export interface AgeNote {
  /** 만 나이 이상 */
  from: number | null;
  /** 만 나이 이하 */
  to: number | null;
  text: string;
  /** 이 문장이 어느 근거에서 나왔나 — 검사기가 강제한다 */
  basisRef: string;
}

export interface Applies {
  /** 누구에게나 해당 */
  everyone: boolean;
  /** 「가진 것」 어휘표(data/casebook-vocab.json)의 id 만 */
  have: string[];
  ageFrom: number | null;
  ageTo: number | null;
  ageBasisRef: string | null;
  ageNotes: AgeNote[];
}

/**
 * 「올해 안에」 표시 — 해가 바뀌면 «다시 시작»하는 일에만 붙인다.
 *
 * ★개인별 만료일(면허 갱신일·차 검사 만료일)은 여기 들어가지 않는다. 그건 사람마다 달라서
 *   «올해 안에» 라고 말하면 거짓말이 된다. 건강검진처럼 «제도가 해마다 새로 시작하는» 것만이다.
 * ★근거 없이는 못 붙는다 (casebook-검사.mjs ⑫).
 */
export interface YearBound {
  /** 연말 = 올해 12월 31일까지 · 연초 = 새해 들어 해야 하는 것 */
  kind: "연말" | "연초";
  text: string;
  basisRef: string;
}

export interface CheckSource {
  title: string;
  url: string;
  publisher: string;
  article: string | null;
  checkedAt: string | null;
}

export interface CheckCard {
  id: string;
  emoji: string;
  /** 무슨 상황인가 */
  situation: string;
  /** 한 줄 요령 (있으면) */
  oneLine: string | null;
  deadlineKind: "법정" | "안내" | "없음";
  deadlineText: string;
  /** 지금 3분 안에 할 수 있는 첫 걸음 */
  firstMove: { what: string; where: string } | null;
  /** 바뀌는 값 — 이름과 «공식 조회 링크» 만. 값은 담지 않는다 */
  checks: { label: string; url: string | null }[];
  sources: CheckSource[];
  verifiedAt: string;
  /** verifiedAt + recheckDays */
  nextCheckAt: string;
  /** 다음 확인 예정일이 지났다 = 오즈백이 아직 다시 안 봤다 */
  stale: boolean;
  applies: Applies;
  /** 자세히 읽을 글이 있으면 */
  articleHref: string | null;
  /** 해마다 다시 시작하는 일이면 (아니면 null) */
  yearBound: YearBound | null;
}

/** 화면이 묻는 「가진 것」 한 칸 (원본은 data/casebook-vocab.json) */
export interface HaveOption {
  id: string;
  label: string;
  emoji: string;
}

export interface Answers {
  /** 태어난 해 (4자리). 안 넣어도 된다 */
  birthYear: number | null;
  have: string[];
}

/** 태어난 «해» 만 물으므로 만 나이는 ±1 이 뜬다. 그래서 가려낼 때 여유를 준다. */
export const AGE_GRACE = 1;

/** 태어난 해 기준 «올해 나이» (만 나이가 아니라 연 나이) */
export function yearAge(birthYear: number, thisYear: number): number {
  return thisYear - birthYear;
}

export function isValidBirthYear(v: number, thisYear: number): boolean {
  return Number.isInteger(v) && v >= thisYear - 120 && v <= thisYear;
}

/**
 * 이 카드가 이 사람에게 «해당될 수 있나».
 * 해당 «된다» 가 아니다 — 확인할 목록에 넣을지만 정한다.
 */
export function cardMatches(card: CheckCard, ans: Answers, thisYear: number): boolean {
  const a = card.applies;

  // ① 「가진 것」 — everyone 이면 무조건 통과, 아니면 하나라도 겹쳐야 한다
  const 겹침 = a.everyone || a.have.some((h) => ans.have.includes(h));
  if (!겹침) return false;

  // ② 나이 — 안 적어 냈으면 가리지 않는다 (가리는 쪽으로 틀리면 손해가 크다)
  if (ans.birthYear == null) return true;
  const 나이 = yearAge(ans.birthYear, thisYear);
  if (a.ageFrom != null && 나이 < a.ageFrom - AGE_GRACE) return false;
  if (a.ageTo != null && 나이 > a.ageTo + AGE_GRACE) return false;
  return true;
}

/** 이 나이대에서만 뜨는 주의문 */
export function notesFor(card: CheckCard, birthYear: number | null, thisYear: number): AgeNote[] {
  if (birthYear == null) return [];
  const 나이 = yearAge(birthYear, thisYear);
  return card.applies.ageNotes.filter(
    (n) =>
      (n.from == null || 나이 >= n.from - AGE_GRACE) &&
      (n.to == null || 나이 <= n.to + AGE_GRACE),
  );
}

const 급한순: Record<CheckCard["deadlineKind"], number> = { 법정: 0, 안내: 1, 없음: 2 };

/** 기한이 법으로 정해진 것 → 안내가 있는 것 → 기한 개념이 없는 것 */
export function sortCards(cards: CheckCard[]): CheckCard[] {
  return [...cards].sort(
    (a, b) => 급한순[a.deadlineKind] - 급한순[b.deadlineKind] || a.situation.localeCompare(b.situation, "ko"),
  );
}

export function matchCards(cards: CheckCard[], ans: Answers, thisYear: number): CheckCard[] {
  return sortCards(cards.filter((c) => cardMatches(c, ans, thisYear)));
}

/**
 * 화면에 실제로 내놓을 「가진 것」 선택지.
 * ★어느 카드도 안 쓰는 항목은 «내놓지 않는다» — 눌러도 아무것도 안 나오는 칸이
 *   생기면 도구를 못 믿게 된다. 케이스북이 늘면 선택지가 저절로 늘어난다.
 */
export function usableHaveIds(cards: CheckCard[]): Set<string> {
  const 쓰이는것 = new Set<string>();
  for (const c of cards) for (const h of c.applies.have) 쓰이는것.add(h);
  return 쓰이는것;
}

// ── 날짜 (한국 기준) ─────────────────────────────────────────
export function ymdKST(d: Date = new Date()): string {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  const t = Date.parse(`${ymd}T00:00:00Z`);
  if (Number.isNaN(t)) return ymd;
  return new Date(t + days * 86400 * 1000).toISOString().slice(0, 10);
}

/** 「2026-08-21」 → 「2026년 8월 21일」 */
export function 한글날짜(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : ymd;
}

/** 오늘이 몇 년인가 (한국 기준) */
export function thisYearKST(today: string): number {
  return Number(today.slice(0, 4)) || new Date().getUTCFullYear();
}

/**
 * 올해 12월 31일까지 며칠 남았나. 오늘이 12월 31일이면 0.
 * ★「남은 날」은 «저장하지 않는다» — 어제 만든 숫자를 오늘 보여 주면 그게 틀린 값이다.
 *   화면을 그릴 때마다 오늘 날짜로 다시 센다.
 */
export function daysLeftInYear(today: string): number {
  const y = thisYearKST(today);
  return Math.max(0, daysSince(today, `${y}-12-31`));
}

/** 「올해 안에」 묶음에 들어갈 카드만 (급한 순은 이미 sortCards 가 매겨 둔다) */
export function yearEndCards(cards: CheckCard[]): CheckCard[] {
  return sortCards(cards.filter((c) => c.yearBound?.kind === "연말"));
}

/** 며칠 지났나 (음수면 아직 안 됐다) */
export function daysSince(ymd: string, today: string): number {
  const a = Date.parse(`${ymd}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400 / 1000);
}

/** 「3개월 전」 처럼 사람 말로 */
export function 지난말(days: number): string {
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 31) return `${days}일 전`;
  const 달 = Math.floor(days / 30);
  if (달 < 12) return `${달}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}
