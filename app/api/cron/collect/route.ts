// 【30분마다】 수집 → AI 작성 → 품질 심사 → 통과하면 '예약 발행 대기열'에 넣는다
// (실제 발행은 /api/cron/publish 가 시간 간격을 두고 하나씩)
import { NextRequest, NextResponse } from "next/server";
import { runCollection } from "@/lib/pipeline";
import type { IssueSource } from "@/lib/sources";

export const maxDuration = 300; // 수집+작성+심사+개선+SNS

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
    const r = await runCollection({ sources: SOURCES, limit: 5 });
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
