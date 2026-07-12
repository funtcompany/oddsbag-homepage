// 링크 공유용 OG 이미지 (1200x630) — 글마다 자동 생성, 고정
import { NextRequest } from "next/server";
import { GET as card } from "../../card/[slug]/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const url = new URL(req.url);
  url.searchParams.set("i", "0");
  url.searchParams.set("og", "1");
  return card(new NextRequest(url, req), ctx);
}
