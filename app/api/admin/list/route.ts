import { NextRequest, NextResponse } from "next/server";
import { getDrafts, getAllPosts } from "@/lib/posts";

const ADMIN = process.env.ADMIN_PASSWORD;

export async function GET(req: NextRequest) {
  const password = req.nextUrl.searchParams.get("password");
  if (!ADMIN || password !== ADMIN) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }
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
