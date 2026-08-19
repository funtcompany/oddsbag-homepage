import { NextResponse } from "next/server";
import {
  USER_COOKIE,
  createUserToken,
  userCookieOptions,
  getCurrentUser,
  newVisitorId,
} from "@/lib/htmllink-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 방문자 세션 — 로그인 화면은 없다(사장님 결정 b, 2026-08-19).
//  클라이언트가 처음 뜰 때 이 GET 을 부른다.
//    · 이미 관리자/방문자면 그대로 알려준다.
//    · 아무 쿠키도 없으면 «익명 방문자 쿠키»를 즉석 발급해 심는다(첫 방문 자동 등록).
export async function GET() {
  const existing = await getCurrentUser();
  if (existing) {
    return NextResponse.json({ user: existing });
  }
  const userId = newVisitorId();
  const res = NextResponse.json({ user: { userId, isAdmin: false } });
  res.cookies.set(USER_COOKIE, await createUserToken(userId), userCookieOptions);
  return res;
}
