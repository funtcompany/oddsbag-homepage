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
  const items = await listByOwner(user.userId);
  return NextResponse.json({ items });
}
