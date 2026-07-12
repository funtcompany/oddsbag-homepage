import { NextRequest, NextResponse } from "next/server";
import { sendEmail, newsletterHtml } from "@/lib/email";
import { getLatestPosts } from "@/lib/posts";
import { smembers } from "@/lib/store";

export const maxDuration = 60;
const ADMIN = process.env.ADMIN_PASSWORD;

export async function POST(req: NextRequest) {
  try {
    const { password, to, all } = await req.json();
    if (!ADMIN || password !== ADMIN) {
      return NextResponse.json({ error: "인증 실패" }, { status: 401 });
    }
    const posts = await getLatestPosts(5);
    const subject = "오즈백 매거진 · 오늘의 이슈 📮";
    const html = newsletterHtml(posts);

    // all=true 면 전체 구독자, 아니면 지정 이메일(샘플)
    let recipients: string[];
    if (all) {
      recipients = await smembers("subscribers");
    } else {
      if (typeof to !== "string" || !to.includes("@")) {
        return NextResponse.json({ error: "받는 이메일 필요" }, { status: 400 });
      }
      recipients = [to.trim().toLowerCase()];
    }
    if (recipients.length === 0) {
      return NextResponse.json({ error: "받는 사람 없음" }, { status: 400 });
    }

    let sent = 0;
    const errors: string[] = [];
    for (const r of recipients) {
      try {
        await sendEmail(r, subject, html);
        sent++;
      } catch (e) {
        errors.push(`${r}: ${(e as Error).message}`);
      }
    }
    return NextResponse.json({ ok: true, sent, total: recipients.length, errors });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "서버 오류" },
      { status: 500 },
    );
  }
}
