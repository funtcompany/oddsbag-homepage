import { NextRequest, NextResponse } from "next/server";
import { hincr, hgetall } from "@/lib/store";

const VALID = new Set(["like", "wow", "sad", "angry"]);
const key = (slug: string) => `reactions:${slug}`;

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug 필요" }, { status: 400 });
  const counts = await hgetall(key(slug));
  // 짧은 엣지 캐싱 — 반복 조회로 DB 부담을 주지 않도록 (내 반응은 즉시 반영됨)
  return NextResponse.json(
    { counts },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
}

export async function POST(req: NextRequest) {
  try {
    const { slug, reaction } = await req.json();
    if (typeof slug !== "string" || !VALID.has(reaction)) {
      return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
    }
    await hincr(key(slug), reaction, 1);
    const counts = await hgetall(key(slug));
    return NextResponse.json({ ok: true, counts });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
