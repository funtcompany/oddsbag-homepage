import { NextRequest, NextResponse } from "next/server";
import { sadd, scard } from "@/lib/store";
import { emailEnabled, sendEmail, welcomeHtml } from "@/lib/email";
import { getLatestPosts } from "@/lib/posts";

export const maxDuration = 30;
const KEY = "subscribers";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "이메일 형식 오류" }, { status: 400 });
    }
    const clean = email.trim().toLowerCase();
    const added = await sadd(KEY, clean);
    const count = await scard(KEY);

    // 새 구독자면 환영 메일 발송 (실패해도 구독은 성공 처리)
    if (added === 1 && emailEnabled) {
      try {
        const latest = await getLatestPosts(3);
        await sendEmail(clean, "오즈백 매거진 구독을 환영해요 🎒", welcomeHtml(latest));
      } catch (e) {
        console.warn("환영메일 발송 실패:", (e as Error).message);
      }
    }
    return NextResponse.json({ ok: true, already: added === 0, count });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function GET() {
  const count = await scard(KEY);
  return NextResponse.json({ count });
}
