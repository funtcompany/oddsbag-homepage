import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  checkPassword,
  createSessionToken,
  isAuthConfigured,
  sessionCookieOptions,
  isAdminRequest,
} from "@/lib/auth";
import { incrWithTtl, counterGet, counterReset } from "@/lib/store";

// 무차별 대입(비밀번호를 계속 바꿔가며 찔러보는 것) 차단
const MAX_TRIES = 8;
const WINDOW_SEC = 600; // 10분

function clientKey(req: NextRequest): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return `login:fail:${ip}`;
}

// 로그인 상태 확인 (화면 진입 시)
export async function GET(req: NextRequest) {
  return NextResponse.json({ authed: await isAdminRequest(req) });
}

export async function POST(req: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "서버에 관리자 비밀번호가 설정돼 있지 않습니다." },
      { status: 500 },
    );
  }

  const key = clientKey(req);
  if ((await counterGet(key)) >= MAX_TRIES) {
    return NextResponse.json(
      { error: "로그인 시도가 너무 많습니다. 10분 뒤에 다시 해주세요." },
      { status: 429 },
    );
  }

  const { password } = await req.json().catch(() => ({ password: null }));

  if (!checkPassword(password)) {
    const tries = await incrWithTtl(key, WINDOW_SEC);
    return NextResponse.json(
      {
        error: `비밀번호가 틀렸습니다. (${tries}/${MAX_TRIES}회)`,
      },
      { status: 401 },
    );
  }

  await counterReset(key);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions);
  return res;
}

// 로그아웃
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return res;
}
