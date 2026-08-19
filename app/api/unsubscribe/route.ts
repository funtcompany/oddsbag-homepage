// 뉴스레터 구독 해지
//
// 개인정보처리방침·이용약관·문의 페이지가 「메일 맨 아래 해지 링크로 언제든 해지」라고
// 약속하고 있는데 정작 그 라우트가 없었다. 그 약속을 실제로 지키는 곳이 여기다.
//
// 주소를 주소창에 그대로 싣지 않는다 — 서명된 토큰만 받는다.
//   토큰 만들기·검증은 lib/email.ts 에 한 벌로 두고 여기서 가져다 쓴다
//   (메일 본문을 만드는 쪽과 검증하는 쪽이 갈라지면 링크가 조용히 안 먹는다).
//
// GET  = 토큰이 맞는지만 확인. 아무것도 지우지 않는다.
// POST = 실제 해지.
//   ★GET 으로는 절대 지우지 않는다. 회사 메일 보안 프로그램이 링크를 미리 눌러보기 때문에
//     GET 이 해지를 하면 본인 의사와 무관하게 구독이 끊긴다.

import { NextRequest, NextResponse } from "next/server";
import { smembers, srem } from "@/lib/store";
import { readUnsubscribeToken } from "@/lib/email";

export const dynamic = "force-dynamic";
const KEY = "subscribers"; // app/api/subscribe/route.ts 와 같은 키

// 화면에 보여줄 때만 쓰는 가림 처리 (a***@example.com)
function mask(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const head = local.slice(0, 1);
  return `${head}${"*".repeat(Math.max(2, local.length - 1))}@${domain}`;
}

async function isSubscribed(email: string): Promise<boolean> {
  // store.ts 에 sismember 가 없어 전체를 받아 확인한다. 구독자 규모가 작아 지금은 괜찮다.
  const all = await smembers(KEY);
  return all.includes(email);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const email = readUnsubscribeToken(token);
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "해지 링크가 올바르지 않습니다." },
      { status: 400 },
    );
  }
  return NextResponse.json({
    ok: true,
    email: mask(email),
    subscribed: await isSubscribed(email),
  });
}

export async function POST(req: NextRequest) {
  // 확인 화면의 버튼은 자바스크립트 없이도 눌리게 일반 <form> 으로 보낸다.
  // 그래서 폼 전송(form-urlencoded)과 JSON 둘 다 받는다.
  const type = req.headers.get("content-type") ?? "";
  let token = "";
  const isForm =
    type.includes("application/x-www-form-urlencoded") ||
    type.includes("multipart/form-data");

  try {
    if (isForm) {
      const form = await req.formData();
      token = String(form.get("t") ?? "");
    } else {
      const body = (await req.json()) as { token?: string; t?: string };
      token = String(body.token ?? body.t ?? "");
    }
  } catch {
    token = "";
  }

  const email = readUnsubscribeToken(token);
  if (!email) {
    if (isForm) {
      return NextResponse.redirect(new URL("/unsubscribe?bad=1", req.url), 303);
    }
    return NextResponse.json(
      { ok: false, error: "해지 링크가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const wasSubscribed = await isSubscribed(email);
  await srem(KEY, email); // 이미 없어도 그냥 통과한다 (여러 번 눌러도 안전)

  if (isForm) {
    // 폼 전송은 화면으로 되돌려 보낸다. 303 이어야 새로고침에 다시 POST 되지 않는다.
    return NextResponse.redirect(new URL("/unsubscribe?done=1", req.url), 303);
  }
  return NextResponse.json({ ok: true, already: !wasSubscribed });
}
