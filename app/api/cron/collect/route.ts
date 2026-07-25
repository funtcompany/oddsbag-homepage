// 【30분마다】 수집 → AI 작성 → 품질 심사 → 통과하면 '예약 발행 대기열'에 넣는다
// (실제 발행은 /api/cron/publish 가 시간 간격을 두고 하나씩)
import { NextRequest, NextResponse } from "next/server";
import { runCollection } from "@/lib/pipeline";
import type { IssueSource } from "@/lib/sources";

export const maxDuration = 60; // 무료(Hobby) 플랜 상한 60초. NAS가 10분마다 호출해 이어받는다.

const CRON_SECRET = process.env.CRON_SECRET;
const SOURCES: IssueSource[] = [
  "naver",
  "google-trends",
  "google-news",
  "google-news-world",
  "youtube",
];

export async function GET(req: NextRequest) {
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  try {
    // 무료 플랜: 한 번에 1건만, 45초 안에 끝낸다 (60초 상한 안전). 남은 건 다음 회차가 이어받음.
    const r = await runCollection({ sources: SOURCES, limit: 1, budgetMs: 45_000 });
    return NextResponse.json({
      ok: true,
      예약: r.queued.length,
      검수함: r.held.length,
      스캔: r.scanned,
      ...r,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
