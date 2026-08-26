// 날짜 계산 — 셈하는 «규칙»만. 순수 함수라 서버 없이 그대로 시험한다.
//
// ★한국에서 날짜를 세는 말은 곳마다 뜻이 다르다. 하나만 보여 주면
//   누군가는 반드시 틀린 값을 믿고 낸다. 글자수 세기와 같은 판단이다.
//     · 「10일 이내」  — 그날을 넣고 세나, 다음 날부터 세나
//     · 「100일」     — 만난 날이 1일째다 (0일째가 아니다)
//     · 「10일」      — 그냥 열흘이 아니라 «토·일·공휴일 빼고» 인 곳이 있다
//   → 한 화면에 «그날 포함»과 «다음 날부터»를 나란히 놓는다.
//
// ★셈은 전부 UTC. 현지 시간으로 하면 서머타임 있는 곳에서 하루가 어긋난다.

import {
  dowOf,
  holidayName,
  isLaborDay,
  isoToUtc,
  isSaturday,
  isSunday,
  shiftIso,
  utcToIso,
  공휴일_범위,
  공휴일표있나,
  요일이름,
} from "@/lib/holidays";

export { 요일이름, shiftIso, dowOf, holidayName, 공휴일_범위 };

const DAY = 86_400_000;

export const 올바른날짜 = (iso: string): boolean => !Number.isNaN(isoToUtc(iso));

/** 며칠 차이 (b - a). 부호가 있다 */
export function diffDays(a: string, b: string): number {
  return Math.round((isoToUtc(b) - isoToUtc(a)) / DAY);
}

export const krLong = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일 (${요일이름[dowOf(iso)]})`;
};

// ── ① 만 나이 ──────────────────────────────────────────────────

export interface AgeResult {
  /** 만 나이 — 2023-06-28 「만 나이 통일법」 이후 법·공문서는 전부 이것 */
  만: number;
  /** 연 나이 — 올해 − 태어난 해. 병역·청소년보호법이 이걸 쓴다 */
  연: number;
  /** 세는 나이 — 옛 한국식. 이제 공식 문서에는 안 쓴다 */
  세는: number;
  /** 만 나이를 개월로 (영유아 검진·어린이집이 이렇게 묻는다) */
  개월: number;
  /** 태어난 날부터 오늘까지 며칠 살았나 (태어난 날을 1일째로) */
  살아온일수: number;
  다음생일: string;
  다음생일까지: number;
  /** 2월 29일에 태어났고, 평년이라 «언제 한 살 더 먹나»가 갈리는 해인가 */
  윤달생일주의: boolean;
}

const 윤년 = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * 그 해에 «생일로 치는 날».
 *
 * ★2월 29일에 태어난 분은 평년에 생일이 없다. 법제처는 「2월 28일이 지나면 한 살 더」로 본다.
 *   다만 곳에 따라 3월 1일로 보기도 해서, 화면에서 그렇다고 알려 준다.
 */
function 생일날(year: number, bMonth: number, bDay: number): string {
  const mm = String(bMonth).padStart(2, "0");
  if (bMonth === 2 && bDay === 29 && !윤년(year)) return `${year}-02-28`;
  return `${year}-${mm}-${String(bDay).padStart(2, "0")}`;
}

export function krAge(birth: string, today: string): AgeResult | null {
  const tb = isoToUtc(birth);
  const tt = isoToUtc(today);
  if (Number.isNaN(tb) || Number.isNaN(tt) || tb > tt) return null;

  const b = new Date(tb);
  const [by, bm, bd] = [b.getUTCFullYear(), b.getUTCMonth() + 1, b.getUTCDate()];
  const ty = new Date(tt).getUTCFullYear();

  const 올해생일 = 생일날(ty, bm, bd);
  const 지났나 = today >= 올해생일;

  const 만 = ty - by - (지났나 ? 0 : 1);
  const 다음생일 = 지났나 ? 생일날(ty + 1, bm, bd) : 올해생일;

  // 개월 — 만 나이를 달로 편 것
  let 개월 = (ty - by) * 12 + (new Date(tt).getUTCMonth() + 1 - bm);
  if (new Date(tt).getUTCDate() < bd) 개월 -= 1;

  return {
    만,
    연: ty - by,
    세는: ty - by + 1,
    개월: Math.max(0, 개월),
    살아온일수: diffDays(birth, today) + 1,
    다음생일,
    다음생일까지: diffDays(today, 다음생일),
    윤달생일주의: bm === 2 && bd === 29,
  };
}

// ── ② 날짜 사이 · D-day ────────────────────────────────────────

export interface SpanResult {
  /** 끝 − 시작. 지난 날이면 음수 */
  일수: number;
  /** 시작일을 1일째로 세면 며칠째 (「오늘이 100일」이 이 셈이다) */
  포함일수: number;
  주: number;
  나머지일: number;
  /** 사람 말로 — 「1년 2개월 3일」 */
  년: number;
  월: number;
  일: number;
  /** D-day 표기. 오늘이 그날이면 D-day */
  dday: string;
}

export function span(from: string, to: string): SpanResult | null {
  if (!올바른날짜(from) || !올바른날짜(to)) return null;
  const 일수 = diffDays(from, to);
  const abs = Math.abs(일수);

  // 년·월·일로 쪼개기 — 늘 «이른 날 → 늦은 날» 방향으로 센다.
  //
  // ★뺄셈으로 하면 안 된다. 1월 31일 → 3월 1일을 자릿수 빌림으로 풀면 «일»이 음수로 남는다
  //   (2월이 28일뿐이라 한 번 빌려도 모자란다). 그래서 addUnit 과 «같은 말일 규칙»으로
  //   년 → 월 → 남은 일 순서로 실제로 밀어 본다. 두 곳이 다른 답을 내지 않게.
  const [a, b] = 일수 >= 0 ? [from, to] : [to, from];
  let 년 = 0;
  while (년 < 500 && (addUnit(a, 년 + 1, "년") as string) <= b) 년 += 1;
  const 해까지 = addUnit(a, 년, "년") as string;
  let 월 = 0;
  while (월 < 12 && (addUnit(해까지, 월 + 1, "개월") as string) <= b) 월 += 1;
  const 달까지 = addUnit(해까지, 월, "개월") as string;
  const 일 = diffDays(달까지, b);

  return {
    일수,
    포함일수: abs + 1,
    주: Math.floor(abs / 7),
    나머지일: abs % 7,
    년,
    월,
    일,
    dday: 일수 === 0 ? "D-day" : 일수 > 0 ? `D-${일수}` : `D+${abs}`,
  };
}

// ── ③ 며칠 뒤는 언제 ──────────────────────────────────────────

export type 단위 = "일" | "주" | "개월" | "년";

/**
 * 날짜 더하기·빼기.
 *
 * ★개월·년을 더할 때 «없는 날»이 생긴다 — 1월 31일 + 1개월.
 *   그 달의 마지막 날로 당긴다(2월 28일). 3월 3일로 굴러가지 않게.
 */
export function addUnit(iso: string, n: number, unit: 단위): string | null {
  if (!올바른날짜(iso)) return null;
  if (unit === "일") return utcToIso(isoToUtc(iso) + n * DAY);
  if (unit === "주") return utcToIso(isoToUtc(iso) + n * 7 * DAY);

  const d = new Date(isoToUtc(iso));
  const [y, m, day] = [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()];
  const 더할달 = unit === "개월" ? n : n * 12;
  const 끝날 = new Date(Date.UTC(y, m + 더할달 + 1, 0)).getUTCDate();
  return utcToIso(Date.UTC(y, m + 더할달, Math.min(day, 끝날)));
}

// ── ④ 영업일 ──────────────────────────────────────────────────

/**
 * 어디 기준으로 쉬는 날을 세나. **곳마다 다르다** — 골라야 값이 맞는다.
 *
 *  · 관공서   토·일 + 공휴일. 근로자의 날(5/1)에도 «연다»
 *  · 은행·회사 토·일 + 공휴일 + 근로자의 날
 *  · 토요일도 근무  일요일 + 공휴일만 쉰다
 */
export type 쉬는기준 = "관공서" | "은행회사" | "토요일도근무";

export const 기준설명: Record<쉬는기준, { label: string; hint: string }> = {
  관공서: {
    label: "관공서·학교",
    hint: "토·일과 공휴일을 뺍니다. 근로자의 날(5월 1일)에는 관공서가 문을 엽니다",
  },
  은행회사: {
    label: "은행·회사",
    hint: "토·일과 공휴일에 근로자의 날(5월 1일)까지 뺍니다",
  },
  토요일도근무: {
    label: "토요일도 일하는 곳",
    hint: "일요일과 공휴일만 뺍니다",
  },
};

/** 그날 일하나 */
export function isBusinessDay(iso: string, 기준: 쉬는기준): boolean {
  if (isSunday(iso)) return false;
  if (기준 !== "토요일도근무" && isSaturday(iso)) return false;
  if (holidayName(iso)) return false;
  if (기준 === "은행회사" && isLaborDay(iso)) return false;
  return true;
}

/** 그날 왜 쉬나 — 화면에 이유를 그대로 보여 주려고 */
export function 쉬는이유(iso: string, 기준: 쉬는기준): string | null {
  if (isSunday(iso)) return "일요일";
  if (기준 !== "토요일도근무" && isSaturday(iso)) return "토요일";
  const h = holidayName(iso);
  if (h) return h;
  if (기준 === "은행회사" && isLaborDay(iso)) return "근로자의 날";
  return null;
}

export interface BizResult<T> {
  값: T;
  /** 공휴일 표가 없는 해에 닿았나 — 닿았으면 값을 믿으면 안 된다 */
  표밖: boolean;
  /** 지나온 쉬는 날 (화면에 그대로 보여 준다) */
  쉰날: { date: string; 이유: string }[];
}

const 해가밖인가 = (iso: string) => !공휴일표있나(Number(iso.slice(0, 4)));

/**
 * 「n 영업일 뒤」 — **기준일 다음 날부터** 세어 n 번째 일하는 날.
 * 관공서 처리기간이 이 셈법이다(신청한 날은 안 센다).
 * n 이 음수면 거꾸로 센다.
 */
export function addBusinessDays(iso: string, n: number, 기준: 쉬는기준): BizResult<string> | null {
  if (!올바른날짜(iso) || !Number.isInteger(n)) return null;
  const step = n >= 0 ? 1 : -1;
  let 남은 = Math.abs(n);
  let cur = iso;
  let 표밖 = 해가밖인가(iso);
  const 쉰날: { date: string; 이유: string }[] = [];

  let 안전장치 = 0;
  while (남은 > 0) {
    if (++안전장치 > 20_000) return null; // 끝없이 도는 일이 없게
    cur = shiftIso(cur, step);
    if (해가밖인가(cur)) 표밖 = true;
    const why = 쉬는이유(cur, 기준);
    if (why) 쉰날.push({ date: cur, 이유: why });
    else 남은 -= 1;
  }
  return { 값: cur, 표밖, 쉰날 };
}

export interface BizCount {
  /** 시작일 «다음 날»부터 끝일까지 (관공서 처리기간 셈법) */
  다음날부터: number;
  /** 시작일도 넣고 센 것 (「그날부터 10일 이내」가 이 셈일 때가 있다) */
  그날포함: number;
  /** 그 사이 쉬는 날 수 */
  쉰날수: number;
  /** 전체 달력 일수 (시작일 포함) */
  달력일수: number;
}

/** 두 날짜 사이 영업일 수. from ≤ to 로 맞춰 센다 */
export function countBusinessDays(
  from: string,
  to: string,
  기준: 쉬는기준,
): BizResult<BizCount> | null {
  if (!올바른날짜(from) || !올바른날짜(to)) return null;
  const [a, b] = from <= to ? [from, to] : [to, from];
  if (diffDays(a, b) > 4000) return null; // 11년 넘게는 표 밖이라 셀 뜻이 없다

  let 표밖 = false;
  let 그날포함 = 0;
  const 쉰날: { date: string; 이유: string }[] = [];

  for (let cur = a; cur <= b; cur = shiftIso(cur, 1)) {
    if (해가밖인가(cur)) 표밖 = true;
    const why = 쉬는이유(cur, 기준);
    if (why) 쉰날.push({ date: cur, 이유: why });
    else 그날포함 += 1;
  }

  const 시작일도일하나 = !쉬는이유(a, 기준);
  return {
    값: {
      그날포함,
      다음날부터: 그날포함 - (시작일도일하나 ? 1 : 0),
      쉰날수: 쉰날.length,
      달력일수: diffDays(a, b) + 1,
    },
    표밖,
    쉰날,
  };
}
