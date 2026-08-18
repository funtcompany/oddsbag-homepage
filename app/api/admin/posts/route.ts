import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  getPublishedRaw,
  getDrafts,
  getQueued,
  getArchived,
  getPostFresh,
  writePost,
  channelKeyOf,
  type Post,
} from "@/lib/posts";
import { isChannelKey, DEFAULT_CHANNEL } from "@/lib/channels";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 목록에 필요한 것만 추려 보낸다 (본문까지 다 보내면 화면이 무거워진다)
const brief = (p: Post) => ({
  slug: p.slug,
  title: p.title,
  summary: p.summary,
  category: p.category,
  channel: channelKeyOf(p),
  date: p.date,
  status: p.status,
  hidden: Boolean(p.hidden),
  // 게시판 전용 글이면 그 게시판 slug ("wpms") — 화면에 «어디에만 보이는 글인지» 표시한다
  boardOnly: p.boardOnly ?? "",
  featured: Boolean(p.featured),
  cover: p.cover ?? "",
  quality: p.quality?.score ?? null,
});

/**
 * GET /api/admin/posts             → 코너별 글 목록 (발행·검수·예약·보관 전부)
 * GET /api/admin/posts?slug=xxx    → 글 한 건 전체 (수정 화면용)
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (slug) {
    const post = await getPostFresh(slug);
    if (!post) return NextResponse.json({ error: "없는 글" }, { status: 404 });
    return NextResponse.json({ post });
  }

  const [published, drafts, queued, archived] = await Promise.all([
    getPublishedRaw(),
    getDrafts().catch(() => [] as Post[]),
    getQueued().catch(() => [] as Post[]),
    getArchived().catch(() => [] as Post[]),
  ]);

  return NextResponse.json({
    published: published.map(brief),
    drafts: drafts.map(brief),
    queued: queued.map(brief),
    archived: archived.map(brief),
  });
}

// 주소에 쓸 수 있는 형태로 다듬기 (한글은 그대로 두되 공백·특수문자만 정리)
function toSlug(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^\w가-힣\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || `post-${Date.now()}`
  );
}

/**
 * POST /api/admin/posts  — 새 글 저장 / 기존 글 수정
 * body: { slug?, title, summary, body, category, channel, status, date, emoji, cover, tags[] }
 */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();

    const title = String(b.title ?? "").trim();
    const bodyText = String(b.body ?? "").trim();
    if (!title || !bodyText) {
      return NextResponse.json(
        { error: "제목과 본문은 반드시 있어야 합니다." },
        { status: 400 },
      );
    }

    const channel = isChannelKey(b.channel) ? b.channel : DEFAULT_CHANNEL;
    const status =
      b.status === "published" || b.status === "draft" ? b.status : "draft";

    const existingSlug = typeof b.slug === "string" && b.slug ? b.slug : null;
    const existing = existingSlug ? await getPostFresh(existingSlug) : undefined;

    const now = new Date();
    const post: Post = {
      ...(existing ?? {}),
      slug: existingSlug ?? toSlug(title),
      title,
      summary: String(b.summary ?? "").trim(),
      body: bodyText,
      category: String(b.category ?? (channel === "magazine" ? "기타" : "오즈백")),
      channel,
      status,
      date: String(b.date ?? existing?.date ?? now.toISOString().slice(0, 10)),
      emoji: b.emoji ? String(b.emoji) : existing?.emoji,
      cover: b.cover !== undefined ? String(b.cover) : existing?.cover,
      tags: Array.isArray(b.tags)
        ? b.tags.map(String).filter(Boolean)
        : (existing?.tags ?? []),
      readMinutes:
        existing?.readMinutes ?? Math.max(1, Math.round(bodyText.length / 500)),
      createdAt: existing?.createdAt ?? now.toISOString(),
    };
    if (status === "published" && !post.publishedAt) {
      post.publishedAt = now.toISOString();
    }

    await writePost(post);
    revalidateTag("posts", "max");
    return NextResponse.json({ ok: true, slug: post.slug });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "서버 오류" },
      { status: 500 },
    );
  }
}
