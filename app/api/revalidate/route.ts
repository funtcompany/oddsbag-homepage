// 콘텐츠 공장(GitHub Actions)이 발행/수정 후 홈페이지 목록 캐시를 즉시 갱신하도록 하는 엔드포인트.
// 공장은 Vercel 밖에서 돌아 revalidateTag를 직접 못 부르므로, 이 작은 라우트를 호출한다.
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  revalidateTag("posts", "max");
  return NextResponse.json({ ok: true, revalidated: "posts" });
}
