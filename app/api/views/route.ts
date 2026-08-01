import { NextRequest, NextResponse } from "next/server";
import { recordView, getTotals } from "@/lib/views";

export async function POST(req: NextRequest) {
  try {
    const { slug } = await req.json();
    if (typeof slug !== "string" || !slug || slug.length > 200) {
      return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
    }
    // 검색엔진 크롤러는 세지 않는다 (사람 조회수만 봐야 판단이 된다)
    const ua = req.headers.get("user-agent") ?? "";
    if (/bot|crawler|spider|slurp|bingpreview|facebookexternalhit|yeti/i.test(ua)) {
      return NextResponse.json({ ok: true, skipped: "bot" });
    }
    await recordView(slug);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const totals = await getTotals();
  if (slug) {
    return NextResponse.json(
      { views: totals[slug] ?? 0 },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  }
  return NextResponse.json({ totals });
}
