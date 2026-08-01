import { NextResponse } from "next/server";
import { getDrafts, getAllPosts } from "@/lib/posts";

// 인증은 middleware.ts에서 /api/admin/* 전체를 한 번에 막는다
export async function GET() {
  const [drafts, published] = await Promise.all([getDrafts(), getAllPosts()]);
  return NextResponse.json({
    drafts,
    published: published.map((p) => ({
      slug: p.slug,
      title: p.title,
      category: p.category,
      date: p.date,
    })),
  });
}
