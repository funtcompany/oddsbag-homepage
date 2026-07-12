// 【1일 3회 · 09시/15시/21시 KST】 정기 품질 점검
//  · 노션 동기화 (사장님이 고친 글 반영)
//  · 발행글 재감사 → 문제 있으면 내림 / 가벼우면 자동 수정
//  · 검수함 글 품질 끌어올려 기준 넘으면 발행 + SNS
//  · 반복 지적을 체크리스트로 정제 → 다음 글부터 반영
import { NextRequest, NextResponse } from "next/server";
import { runAudit } from "@/lib/audit";

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
    const r = await runAudit();
    return NextResponse.json({
      ok: true,
      노션동기화: r.synced,
      재감사: r.audited,
      자동수정: r.fixed.length,
      내림: r.pulled.length,
      구조발행: r.rescued.length,
      인스타: r.social.ig,
      페북: r.social.fb,
      ...r,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
