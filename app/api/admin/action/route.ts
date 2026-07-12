import { NextRequest, NextResponse } from "next/server";
import { publishPost, deletePost, getPostBySlug } from "@/lib/posts";
import { kvGet, kvSet } from "@/lib/store";

const ADMIN = process.env.ADMIN_PASSWORD;

export async function POST(req: NextRequest) {
  try {
    const { password, action, slug, patch } = await req.json();
    if (!ADMIN || password !== ADMIN) {
      return NextResponse.json({ error: "인증 실패" }, { status: 401 });
    }
    if (typeof slug !== "string") {
      return NextResponse.json({ error: "slug 필요" }, { status: 400 });
    }

    switch (action) {
      case "publish": {
        const ok = await publishPost(slug);
        return NextResponse.json({ ok });
      }
      case "delete": {
        await deletePost(slug);
        return NextResponse.json({ ok: true });
      }
      case "edit": {
        // 초안 제목/요약/본문 간단 수정
        const raw = await kvGet(`post:${slug}`);
        if (!raw) return NextResponse.json({ error: "없음" }, { status: 404 });
        const post = JSON.parse(raw);
        if (patch?.title) post.title = String(patch.title);
        if (patch?.summary) post.summary = String(patch.summary);
        if (patch?.body) post.body = String(patch.body);
        await kvSet(`post:${slug}`, JSON.stringify(post));
        return NextResponse.json({ ok: true });
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
