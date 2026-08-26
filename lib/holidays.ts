// 대한민국 공휴일 — 「영업일 계산」이 토·일과 함께 빼는 날들.
//
// ★DOM 도 next 도 안 부른다. 순수 함수라 서버 없이 그대로 시험한다.
//
// ★표를 통째로 적어 두지 않는다. 적어 두는 것은 «계산으로 못 내는 것»뿐이고
//   (음력 3개 · 선거일 · 임시공휴일 — data/holidays.json)
//   나머지 고정 공휴일과 대체공휴일은 여기서 규칙으로 만들어 낸다.
//   손으로 적은 표는 반드시 한 해 뒤에 낡는다. 규칙은 안 낡는다.
//
// ★날짜 셈은 전부 UTC 로 한다. 현지 시간으로 하면 서머타임이 있는 나라에서
//   «하루가 23시간»인 날에 하루씩 어긋난다. 우리는 날짜만 다루므로 UTC 가 맞다.

import raw from "@/data/holidays.json";

export type 대체규칙 = "없음" | "주말" | "주말이나 다른 공휴일";

export interface Holiday {
  /** YYYY-MM-DD */
  date: string;
  name: string;
  /** 대체공휴일로 «만들어진» 날인가 */
  substitute?: boolean;
}

export const 공휴일_확인일: string = raw.확인일;
export const 공휴일_범위 = raw.범위 as { 시작: number; 끝: number };

// ── 날짜 셈 (UTC) ──────────────────────────────────────────────

const DAY = 86_400_000;

/** "YYYY-MM-DD" → UTC 밀리초. 형식이 아니면 NaN */
export function isoToUtc(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return NaN;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  // 2026-02-30 처럼 «없는 날»이 조용히 3월 2일로 굴러가는 것을 막는다
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    return NaN;
  }
  return t;
}

export const utcToIso = (t: number): string => new Date(t).toISOString().slice(0, 10);

export const shiftIso = (iso: string, days: number): string => utcToIso(isoToUtc(iso) + days * DAY);

/** 0=일 … 6=토 */
export const dowOf = (iso: string): number => new Date(isoToUtc(iso)).getUTCDay();

export const 요일이름 = ["일", "월", "화", "수", "목", "금", "토"] as const;

export const isSunday = (iso: string) => dowOf(iso) === 0;
export const isSaturday = (iso: string) => dowOf(iso) === 6;

// ── 한 해 공휴일 만들기 ────────────────────────────────────────

interface 고정 {
  md: string;
  name: string;
  대체: 대체규칙;
}

const 고정공휴일 = raw.고정공휴일 as 고정[];
const 음력기준 = raw.음력기준 as Record<string, Record<string, string>>;
const 임시 = raw.임시공휴일과_선거일 as { date: string; name: string; 근거: string }[];

const cache = new Map<number, Holiday[]>();

/**
 * 그 해 공휴일 전부 (대체공휴일 포함), 날짜순.
 *
 * 표에 없는 해면 **빈 배열**을 돌려준다. 없는 해를 «공휴일 0일»로 계산하면
 * 값이 조용히 틀리므로, 부르는 쪽은 반드시 `공휴일표있나()` 를 먼저 본다.
 */
export function holidaysOf(year: number): Holiday[] {
  const hit = cache.get(year);
  if (hit) return hit;
  const made = 만들기(year);
  cache.set(year, made);
  return made;
}

export const 공휴일표있나 = (year: number): boolean =>
  year >= 공휴일_범위.시작 && year <= 공휴일_범위.끝;

function 만들기(year: number): Holiday[] {
  if (!공휴일표있나(year)) return [];

  const lunar = 음력기준[String(year)];
  if (!lunar) return [];

  // ① 바탕 — 같은 날에 이름이 둘 붙을 수 있다 (2025년 어린이날 = 부처님오신날)
  const base = new Map<string, string[]>();
  const put = (date: string, name: string) => {
    const cur = base.get(date);
    if (cur) cur.push(name);
    else base.set(date, [name]);
  };

  for (const f of 고정공휴일) put(`${year}-${f.md}`, f.name);
  put(lunar.부처님오신날, "부처님오신날");

  // 설날·추석은 «앞뒤 하루»까지 사흘 연휴
  const 연휴: { name: string; days: string[] }[] = [
    { name: "설날", days: [-1, 0, 1].map((n) => shiftIso(lunar.설날, n)) },
    { name: "추석", days: [-1, 0, 1].map((n) => shiftIso(lunar.추석, n)) },
  ];
  for (const y of 연휴) {
    put(y.days[0], `${y.name} 전날`);
    put(y.days[1], y.name);
    put(y.days[2], `${y.name} 다음날`);
  }

  for (const t of 임시) if (t.date.startsWith(`${year}-`)) put(t.date, t.name);

  // ② 대체공휴일
  //
  //   설날·추석 연휴 — «일요일이나 다른 공휴일»과 겹친 날 수만큼 (토요일은 아니다)
  //   어린이날      — 토·일이나 다른 공휴일과 겹치면 하루
  //   그 밖         — 토·일과 겹치면 하루
  //   (신정·현충일은 대체가 없다)
  //
  //   ★근거 — 관공서의 공휴일에 관한 규정(대통령령) 제2조·제3조.
  //     설날(제4호)·추석(제9호)은 «일요일이나 다른 공휴일»과 겹칠 때만이라 토요일은 해당이 없다.
  //     어린이날(제7호)만 토요일도 들어간다. 신정(제3호)·현충일(제8호)은 아예 대상이 아니다.
  //
  //   ★확인 못 한 자리 하나 — 공휴일 «둘»이 한 날에 겹칠 때 대체가 하루냐 이틀이냐.
  //     2025년 5월 5일이 어린이날이자 부처님오신날이었는데 대체공휴일은 **5월 6일 하루**였다.
  //     그 선례대로 여기서도 하루만 준다. 2028년 10월 3일(개천절 = 추석)이 같은 모양인데
  //     그 해 공휴일은 아직 발표 전이다 — 발표되면 이 줄을 보고 맞춰 본다.
  const 대체할날: string[] = [];

  for (const y of 연휴) {
    const 겹친수 = y.days.filter(
      (d) => isSunday(d) || (base.get(d)?.length ?? 0) > 1,
    ).length;
    for (let i = 0; i < 겹친수; i++) 대체할날.push(y.days[2]);
  }

  for (const f of 고정공휴일) {
    if (f.대체 === "없음") continue;
    const date = `${year}-${f.md}`;
    const 주말 = isSaturday(date) || isSunday(date);
    const 다른공휴일 = (base.get(date)?.length ?? 0) > 1;
    if (주말 || (f.대체 === "주말이나 다른 공휴일" && 다른공휴일)) 대체할날.push(date);
  }

  const 부날 = lunar.부처님오신날;
  if (isSaturday(부날) || isSunday(부날)) 대체할날.push(부날);

  // 다음 날부터 «공휴일도 일요일도 아닌» 첫 날로 민다.
  //   ★토요일은 법으로 공휴일이 아니라서 대체공휴일이 될 수 있다(2024~2028 범위에는 그런 해가 없다).
  //     막아 버리면 실제와 달라질 수 있어 조문 그대로 둔다 — 시험이 표를 눈으로 보게 뽑아 준다.
  const 잡힘 = new Set(base.keys());
  for (const from of 대체할날.sort()) {
    let d = shiftIso(from, 1);
    while (잡힘.has(d) || isSunday(d)) d = shiftIso(d, 1);
    잡힘.add(d);
    put(d, "대체공휴일");
  }

  const out: Holiday[] = [];
  for (const [date, names] of base) {
    if (!date.startsWith(`${year}-`)) continue; // 연휴가 해를 넘어간 조각은 그 해 것이 아니다
    out.push({ date, name: names.join(" · "), substitute: names.includes("대체공휴일") });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ── 물어보는 쪽이 쓰는 것 ──────────────────────────────────────

const mapOf = (year: number): Map<string, Holiday> =>
  new Map(holidaysOf(year).map((h) => [h.date, h]));

const yearCache = new Map<number, Map<string, Holiday>>();

function yearMap(year: number): Map<string, Holiday> {
  const hit = yearCache.get(year);
  if (hit) return hit;
  const m = mapOf(year);
  yearCache.set(year, m);
  return m;
}

/** 그날이 공휴일이면 이름, 아니면 null. 표에 없는 해면 null (모르는 것이지 «아니다»가 아니다) */
export function holidayName(iso: string): string | null {
  const t = isoToUtc(iso);
  if (Number.isNaN(t)) return null;
  const year = new Date(t).getUTCFullYear();
  if (!공휴일표있나(year)) return null;
  return yearMap(year).get(iso)?.name ?? null;
}

/** 근로자의 날 — 관공서 공휴일이 «아니다». 은행·회사는 대개 쉰다 */
export const isLaborDay = (iso: string): boolean => iso.slice(5) === "05-01";
