import { NextResponse } from "next/server";
import { syncFromNotion } from "@/lib/sync";

export const maxDuration = 300;

// 인증은 middleware.ts에서 /api/admin/* 전체를 한 번에 막는다
export async function POST() {
  try {
    const result = await syncFromNotion();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "서버 오류" },
      { status: 500 },
    );
  }
}
