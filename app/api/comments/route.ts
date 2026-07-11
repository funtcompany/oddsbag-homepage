import { NextRequest, NextResponse } from "next/server";
import { rpush, lrange } from "@/lib/store";

const key = (slug: string) => `comments:${slug}`;

function fmtDate(): string {
  // Date.now 사용 (런타임). YYYY-MM-DD
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug 필요" }, { status: 400 });
  const raw = await lrange(key(slug));
  const comments = raw.map((s) => JSON.parse(s));
  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest) {
  try {
    const { slug, name, text } = await req.json();
    if (typeof slug !== "string" || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
    }
    const comment = {
      name: (typeof name === "string" && name.trim()) || "익명",
      text: text.trim().slice(0, 500),
      date: fmtDate(),
    };
    await rpush(key(slug), JSON.stringify(comment));
    const raw = await lrange(key(slug));
    const comments = raw.map((s) => JSON.parse(s));
    return NextResponse.json({ ok: true, comments });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
