// 【2일 1회】 홈페이지/인스타 개선 점검 — 자동 보수 + 진단 리포트 메일
import { NextRequest, NextResponse } from "next/server";
import { runImprove } from "@/lib/improve";

export const maxDuration = 800;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  try {
    const r = await runImprove();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
