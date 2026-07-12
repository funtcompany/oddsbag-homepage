import { NextRequest, NextResponse } from "next/server";
import { runCollection } from "@/lib/pipeline";
import type { IssueSource } from "@/lib/sources";

export const maxDuration = 60;

const ADMIN = process.env.ADMIN_PASSWORD;
const ALL_SOURCES: IssueSource[] = [
  "naver",
  "google-trends",
  "google-news",
  "google-news-world",
];

export async function POST(req: NextRequest) {
  try {
    const { password, sources, limit } = await req.json();
    if (!ADMIN || password !== ADMIN) {
      return NextResponse.json({ error: "인증 실패" }, { status: 401 });
    }
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
