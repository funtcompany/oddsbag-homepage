import { NextRequest, NextResponse } from "next/server";
import { runCollection } from "@/lib/pipeline";
import type { IssueSource } from "@/lib/sources";

export const maxDuration = 300; // 수집 + AI 다건 여유

// 인증은 middleware.ts에서 /api/admin/* 전체를 한 번에 막는다
const ALL_SOURCES: IssueSource[] = [
  "naver",
  "google-trends",
  "google-news",
  "google-news-world",
  "youtube",
];

export async function POST(req: NextRequest) {
  try {
    const { sources, limit } = await req.json();
    const chosen: IssueSource[] =
      Array.isArray(sources) && sources.length > 0 ? sources : ALL_SOURCES;
    const result = await runCollection({ sources: chosen, limit });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "서버 오류" },
      { status: 500 },
    );
  }
}
