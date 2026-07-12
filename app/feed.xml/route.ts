// RSS 피드 — 구글/네이버 색인과 뉴스 리더 유입 경로
import { getAllPosts } from "@/lib/posts";

export const revalidate = 600;

const SITE = "https://oddsbag.co.kr";
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const posts = (await getAllPosts()).slice(0, 50);
  const items = posts
    .map(
      (p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${SITE}/magazine/${p.slug}</link>
    <guid isPermaLink="true">${SITE}/magazine/${p.slug}</guid>
    <description>${esc(p.summary)}</description>
    <category>${esc(p.category)}</category>
    <pubDate>${new Date(p.publishedAt ?? p.date).toUTCString()}</pubDate>
  </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>오즈백 ODDSBAG 매거진</title>
  <link>${SITE}</link>
  <description>매일의 사회·경제·스포츠·테크 이슈를 오즈백 시선으로.</description>
  <language>ko</language>
  <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
