import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";

// 관리자 API는 여기서 한 번에 막는다. (Next 16의 proxy 규약 — 예전 이름은 middleware)
// 라우트 파일마다 인증 코드를 흩어놓으면 새 라우트를 추가할 때 빠뜨리기 쉽다.
export default async function proxy(req: NextRequest) {
  // 로그인 라우트 자체는 통과시켜야 로그인을 할 수 있다
  if (req.nextUrl.pathname === "/api/admin/login") return NextResponse.next();

  if (await isAdminRequest(req)) return NextResponse.next();

  return NextResponse.json(
    { error: "로그인이 필요합니다." },
    { status: 401 },
  );
}

export const config = {
  matcher: ["/api/admin/:path*"],
};
