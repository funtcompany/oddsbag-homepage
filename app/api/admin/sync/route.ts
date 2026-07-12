import { NextRequest, NextResponse } from "next/server";
import { syncFromNotion } from "@/lib/sync";

export const maxDuration = 60;

const ADMIN = process.env.ADMIN_PASSWORD;

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (!ADMIN || password !== ADMIN) {
      return NextResponse.json({ error: "인증 실패" }, { status: 401 });
    }
    const result = await syncFromNotion();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "서버 오류" },
      { status: 500 },
    );
  }
}
