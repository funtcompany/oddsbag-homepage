import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/htmllink-user";
import { listByOwner } from "@/lib/htmllink-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 본인이 올린 자료만 돌려준다 (소유자 격리의 핵심)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  try {
    const items = await listByOwner(user.userId);
    return NextResponse.json({ items });
  } catch (e) {
    // ★목록이 안 나온다고 500 을 내면 화면이 통째로 죽는다. 자료는 그대로 있다.
    console.error("[htmllink] 목록 실패", e);
    return NextResponse.json(
      {
        error: "지금 자료함을 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
        detail: String(e instanceof Error ? e.message : e).slice(0, 200),
      },
      { status: 503 },
    );
  }
}
