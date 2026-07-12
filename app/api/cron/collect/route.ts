import { NextRequest, NextResponse } from "next/server";
import { runCollection } from "@/lib/pipeline";
import { syncFromNotion } from "@/lib/sync";
import type { IssueSource } from "@/lib/sources";

export const maxDuration = 300; // 수집 + AI 다건 + 동기화 여유

// Vercel Cron 이 1시간마다 호출 (vercel.json)
// 보안: CRON_SECRET 설정 시 Authorization 헤더 검증

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
    // 1) 수집 → 노션 수집함 적재  2) 노션 발행글 → 홈페이지 동기화
    const result = await runCollection({ sources: SOURCES, limit: 5 });
    const sync = await syncFromNotion();
    return NextResponse.json({ ok: true, ...result, synced: sync.synced.length });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "cron 오류" },
      { status: 500 },
    );
  }
}
