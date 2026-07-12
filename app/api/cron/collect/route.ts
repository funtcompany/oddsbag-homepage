import { NextRequest, NextResponse } from "next/server";
import { runCollection } from "@/lib/pipeline";
import type { IssueSource } from "@/lib/sources";

export const maxDuration = 60;

// Vercel Cron 이 1시간마다 호출 (vercel.json)
// 보안: CRON_SECRET 설정 시 Authorization 헤더 검증

const CRON_SECRET = process.env.CRON_SECRET;
const SOURCES: IssueSource[] = [
  "naver",
  "google-trends",
  "google-news",
  "google-news-world",
];

export async function GET(req: NextRequest) {
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  try {
    const result = await runCollection({ sources: SOURCES, limit: 5 });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "cron 오류" },
      { status: 500 },
    );
  }
}
