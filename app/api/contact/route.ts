import { NextRequest, NextResponse } from "next/server";
import { addInquiry, inquiryMailHtml } from "@/lib/inbox";
import { incrWithTtl } from "@/lib/store";
import { emailEnabled, sendEmail } from "@/lib/email";
import { getSiteConfig } from "@/lib/sitecfg";

export const maxDuration = 30;

// 한 사람이 한 시간에 보낼 수 있는 문의 수 (장난·스팸 차단)
const HOURLY_LIMIT = 5;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { kind, name, email, message, website } = body ?? {};

    // 사람 눈에는 안 보이는 칸. 자동 프로그램만 여기를 채운다.
    if (typeof website === "string" && website.trim()) {
      return NextResponse.json({ ok: true });
    }

    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "답장받으실 이메일 주소를 정확히 적어주세요." },
        { status: 400 },
      );
    }
    if (typeof message !== "string" || message.trim().length < 10) {
      return NextResponse.json(
        { error: "문의 내용을 10자 이상 적어주세요." },
        { status: 400 },
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const tries = await incrWithTtl(`contact:rate:${ip}`, 3600);
    if (tries > HOURLY_LIMIT) {
      return NextResponse.json(
        { error: "문의가 너무 많습니다. 한 시간 뒤에 다시 시도해 주세요." },
        { status: 429 },
      );
    }

    const item = await addInquiry({
      kind: String(kind ?? "기타"),
      name: String(name ?? ""),
      email: email.trim(),
      message: message.trim(),
    });

    // 알림 메일 (실패해도 접수는 성공 처리 — 문의함에 이미 남아 있다)
    const cfg = await getSiteConfig();
    if (emailEnabled && cfg.contact.email) {
      try {
        await sendEmail(
          cfg.contact.email,
          `[오즈백 문의] ${item.kind} · ${item.name || item.email}`,
          inquiryMailHtml(item),
        );
      } catch (e) {
        console.warn("문의 알림 메일 실패:", (e as Error).message);
      }
    }

    return NextResponse.json({ ok: true, id: item.id });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
