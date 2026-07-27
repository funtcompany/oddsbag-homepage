// 저장해 둔 삽화를 그림 파일로 내보낸다. (content-factory/illustrate.mjs 가 만들어 넣는다)
import { NextRequest, NextResponse } from "next/server";
import { kvGet } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let raw: string | null = null;
  try {
    raw = await kvGet(`illus:${slug}`);
  } catch {
    raw = null;
  }
  if (!raw) return new NextResponse("not found", { status: 404 });

  let parsed: { mime?: string; data?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new NextResponse("broken", { status: 404 });
  }
  if (!parsed.data) return new NextResponse("not found", { status: 404 });

  const buf = Buffer.from(parsed.data, "base64");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": parsed.mime ?? "image/png",
      // 한 번 만든 삽화는 바뀌지 않는다 → 오래 캐시해 서버 부담을 없앤다
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
