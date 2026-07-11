import { NextRequest, NextResponse } from "next/server";
import { sadd, scard } from "@/lib/store";

const KEY = "subscribers";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "이메일 형식 오류" }, { status: 400 });
    }
    const added = await sadd(KEY, email.trim().toLowerCase());
    const count = await scard(KEY);
    return NextResponse.json({ ok: true, already: added === 0, count });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function GET() {
  const count = await scard(KEY);
  return NextResponse.json({ count });
}
