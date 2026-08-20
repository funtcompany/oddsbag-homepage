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

import { unstable_cache } from "next/cache";
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

// 오늘 날짜 키에 만료시간을 이미 걸었나 (이 서버 인스턴스 기준).
// ★한 번 걸면 그만인 EXPIRE 를 방문마다 부르면 조회 1건이 레디스 명령 3개가 된다.
//   같은 날 처음 한 번만 걸고 넘어가면 2개다 — 트래픽이 곧 명령 수인 자리라 33%가 그대로 여유가 된다.
let ttlSetFor = "";

export async function recordView(slug: string): Promise<void> {
  const day = kstDate();
  const key = dayKey(day);
  await Promise.all([hincr(TOTAL_KEY, slug, 1), hincr(key, slug, 1)]);
  if (ttlSetFor !== day) {
    ttlSetFor = day; // 실패해도 다시 걸지 않는다 — 다음 인스턴스가 건다
    await expire(key, DAY_TTL); // 날짜별 집계는 무한정 쌓아둘 필요가 없다
  }
}

export async function getTotals(): Promise<Record<string, number>> {
  return hgetall(TOTAL_KEY);
}

/**
 * 화면(홈 인기글)에서 쓰는 조회수 — 5분 캐시.
 *
 * ★왜 그냥 getTotals 를 안 쓰나
 *   Redis 호출은 cache:"no-store" 라서, 미리 구워두는(정적) 화면 안에서 부르면
 *   Next 가 «이 페이지는 정적으로 못 만든다»며 던진다. 실제로 빌드 때 그 오류가 났고
 *   홈 인기글이 조용히 최신순으로 물러서 있었다 (2026-08-18).
 *   getAllPosts 가 쓰는 방식 그대로 unstable_cache 로 감싸면 정적 화면 안에서도 읽힌다.
 *   덤으로 방문자가 몰려도 Redis 는 5분에 한 번만 읽는다.
 */
export const getCachedTotals = unstable_cache(
  async () => {
    try {
      return await hgetall(TOTAL_KEY);
    } catch {
      return {} as Record<string, number>;
    }
  },
  ["oddsbag-view-totals"],
  { revalidate: 300, tags: ["views"] },
);

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
