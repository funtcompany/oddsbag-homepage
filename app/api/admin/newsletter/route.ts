import { NextRequest, NextResponse } from "next/server";
import { sendEmail, newsletterHtml } from "@/lib/email";
import { getLatestPosts } from "@/lib/posts";
import { smembers } from "@/lib/store";

export const maxDuration = 60;
// 인증은 middleware.ts에서 /api/admin/* 전체를 한 번에 막는다

export async function POST(req: NextRequest) {
  try {
    const { to, all } = await req.json();
    const posts = await getLatestPosts(5);
    const subject = "오즈백 매거진 · 오늘의 이슈 📮";
    // ★html 을 여기서 한 번 만들지 않는다.
    //   해지 링크에 «받는 사람마다 다른 서명 토큰»이 들어가야 해서,
    //   한 벌을 모두에게 보내면 남의 링크로 남이 해지되는 사고가 난다.
    //   그래서 아래 수신자 루프 안에서 사람마다 새로 만든다.

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
        await sendEmail(r, subject, newsletterHtml(posts, r));
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
