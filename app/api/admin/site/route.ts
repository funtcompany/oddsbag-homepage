import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  getSiteConfigFresh,
  saveSiteConfig,
  defaultConfig,
  SITE_CONFIG_TAG,
  type SiteConfig,
} from "@/lib/sitecfg";

// 메인화면 설정 읽기/저장 (인증은 proxy.ts에서 /api/admin/* 전체를 막는다)
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    config: await getSiteConfigFresh(),
    defaults: defaultConfig,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { config?: Partial<SiteConfig>; reset?: boolean };
    const next = body.reset ? defaultConfig : body.config;
    if (!next) {
      return NextResponse.json({ error: "설정 값이 없습니다." }, { status: 400 });
    }
    const saved = await saveSiteConfig(next);
    // 화면 캐시를 즉시 갱신 — 저장하자마자 홈페이지에 반영된다
    revalidateTag(SITE_CONFIG_TAG, "max");
    return NextResponse.json({ ok: true, config: saved });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "서버 오류" },
      { status: 500 },
    );
  }
}
