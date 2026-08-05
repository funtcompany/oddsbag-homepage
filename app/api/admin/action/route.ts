import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  publishPost,
  deletePost,
  unpublishPost,
  archiveDraft,
  restoreArchived,
  setHidden,
  setFeatured,
} from "@/lib/posts";
import { kvGet, kvSet } from "@/lib/store";

// 인증은 proxy.ts에서 /api/admin/* 전체를 한 번에 막는다
export async function POST(req: NextRequest) {
  try {
    const { action, slug, patch, reason } = await req.json();
    if (typeof slug !== "string") {
      return NextResponse.json({ error: "slug 필요" }, { status: 400 });
    }

    // 목록 캐시를 바로 갱신 (사장님이 누른 결과가 곧장 홈페이지에 보이게)
    const done = (data: Record<string, unknown>) => {
      revalidateTag("posts", "max");
      return NextResponse.json(data);
    };

    switch (action) {
      case "publish":
        return done({ ok: await publishPost(slug) });

      case "unpublish": // 발행 취소 → 검수함으로
        return done({
          ok: await unpublishPost(slug, String(reason ?? "관리자 내림")),
        });

      case "hide": // 목록에서 숨김 (주소로는 열림)
        return done({ ok: await setHidden(slug, true) });

      case "show":
        return done({ ok: await setHidden(slug, false) });

      case "feature": // 대표글로 지정
        return done({ ok: await setFeatured(slug) });

      case "archive": // 검수함 → 보관함
        return done({
          ok: await archiveDraft(slug, String(reason ?? "관리자 정리")),
        });

      case "restore": // 보관함 → 검수함
        return done({ ok: await restoreArchived(slug) });

      case "delete":
        await deletePost(slug);
        return done({ ok: true });

      case "edit": {
        // 제목/요약/본문 간단 수정
        const raw = await kvGet(`post:${slug}`);
        if (!raw) return NextResponse.json({ error: "없음" }, { status: 404 });
        const post = JSON.parse(raw);
        if (patch?.title) post.title = String(patch.title);
        if (patch?.summary) post.summary = String(patch.summary);
        if (patch?.body) post.body = String(patch.body);
        await kvSet(`post:${slug}`, JSON.stringify(post));
        return done({ ok: true });
      }

      default:
        return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "서버 오류" },
      { status: 500 },
    );
  }
}
