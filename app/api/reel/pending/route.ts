// 오늘 릴스로 만들 발행글을 골라준다 (영상 공장이 호출).
//  · 아직 릴스가 없는 발행글 중 최신 우선으로 N개 (기본 1개).
//  · 이미 만든 글은 reels:done 집합으로 관리해 중복 제작을 막는다.
import { NextRequest, NextResponse } from "next/server";
import { getPublishedRaw } from "@/lib/posts";
import { smembers } from "@/lib/store";

export const dynamic = "force-dynamic";
const CRON_SECRET = process.env.CRON_SECRET;
const DONE = "reels:done";

export async function GET(req: NextRequest) {
  if (CRON_SECRET) {
    if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const limit = Math.min(5, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 1)));

  let done: Set<string>;
  try {
    done = new Set(await smembers(DONE));
  } catch {
    done = new Set();
  }

  const posts = await getPublishedRaw();
  const pending = posts
    .filter((p) => p.status === "published" && !done.has(p.slug))
    .sort((a, b) => (b.publishedAt ?? b.date).localeCompare(a.publishedAt ?? a.date))
    .slice(0, limit)
    .map((p) => ({ slug: p.slug, title: p.title, category: p.category, score: p.quality?.score ?? null }));

  return NextResponse.json({ count: pending.length, pending });
}
