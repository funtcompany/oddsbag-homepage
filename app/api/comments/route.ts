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
  // ★레디스가 안 되면 500 대신 «댓글 없음»으로 답한다 (본문 화면을 지킨다)
  let comments: unknown[] = [];
  try {
    comments = (await lrange(key(slug))).map((s) => JSON.parse(s));
  } catch (e) {
    console.warn("댓글 읽기 실패, 빈 목록으로 표시:", (e as Error).message);
  }
  return NextResponse.json(
    { comments },
    {
      headers: {
        // ★20초 → 2분. 20초 캐시는 글이 많아지는 만큼 명령 수가 그대로 늘어난다.
        //   내가 쓴 댓글은 POST 응답으로 즉시 보이므로 화면에서 느려지는 것이 없다.
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    },
  );
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
