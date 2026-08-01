// 게시물 조회수
//
// 구글 애널리틱스와 별개로 우리가 직접 센다. 이유:
//   · 애널리틱스 숫자는 사이트 안에서 바로 못 쓴다 (인기글 정렬 등)
//   · 광고차단 프로그램이 애널리틱스를 막아도 이건 집계된다
//   · 관리자 표에서 글별 조회수를 즉시 보여줄 수 있다
//
// 저장 구조 (Redis 해시)
//   views:total          → { 글주소: 누적조회수 }
//   views:d:2026-08-02   → { 글주소: 그날 조회수 }   (90일 뒤 자동 삭제)

import { hincr, hgetall, expire } from "@/lib/store";

export const TOTAL_KEY = "views:total";
export const dayKey = (d: string) => `views:d:${d}`;

const DAY_TTL = 90 * 86400;

// 한국 날짜 (서버는 UTC로 도는데, 사장님이 보는 건 한국 날짜여야 한다)
export function kstDate(offsetDays = 0): string {
  const t = Date.now() + 9 * 3600_000 - offsetDays * 86400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function lastDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => kstDate(n - 1 - i));
}

export async function recordView(slug: string): Promise<void> {
  const key = dayKey(kstDate());
  await Promise.all([hincr(TOTAL_KEY, slug, 1), hincr(key, slug, 1)]);
  // 날짜별 집계는 무한정 쌓아둘 필요가 없다
  await expire(key, DAY_TTL);
}

export async function getTotals(): Promise<Record<string, number>> {
  return hgetall(TOTAL_KEY);
}

export async function getViewsForDay(d: string): Promise<Record<string, number>> {
  return hgetall(dayKey(d));
}

// 최근 n일치 일자별 합계 — 대시보드 추이 그래프용
export async function getDailyTotals(
  n = 14,
): Promise<{ date: string; views: number }[]> {
  const days = lastDays(n);
  const rows = await Promise.all(days.map((d) => getViewsForDay(d)));
  return days.map((date, i) => ({
    date,
    views: Object.values(rows[i]).reduce((a, b) => a + b, 0),
  }));
}
