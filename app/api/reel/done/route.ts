// 릴스 제작(또는 게시) 완료를 기록해 다음부터 중복 제작을 막는다. 영상 공장이 호출.
import { NextRequest, NextResponse } from "next/server";
import { sadd } from "@/lib/store";

export const dynamic = "force-dynamic";
const CRON_SECRET = process.env.CRON_SECRET;
const DONE = "reels:done";

export async function POST(req: NextRequest) {
  if (CRON_SECRET) {
    if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  let slug = "";
  try {
    slug = (await req.json())?.slug ?? "";
  } catch {
    /* ignore */
  }
  if (!slug) return NextResponse.json({ error: "slug 필요" }, { status: 400 });

  try {
    await sadd(DONE, slug);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, slug });
}
