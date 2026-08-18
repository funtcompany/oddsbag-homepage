import { getAllPosts } from "@/lib/posts";
import { postUrl } from "@/lib/channels";

const BASE = "https://oddsbag.co.kr";
const 매체이름 = "오즈백 ODDSBAG";

// 구글 뉴스 사이트맵은 "최근 48시간 안에 낸 글"만 담는 게 규격이다.
//  오즈백은 매시간 글이 나오므로 이 규격에 딱 맞는다.
//  30분마다 다시 만든다 — 사이트맵(1시간)보다 짧게 잡아야 새 글이 빨리 걸린다.
export const revalidate = 1800;

const 이틀 = 48 * 60 * 60 * 1000;

// XML 안에서 깨지는 글자를 막는다 (제목에 & 나 따옴표가 자주 들어온다)
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export async function GET() {
  const now = Date.now();
  const posts = await getAllPosts();

  const 최근글 = posts
    // 게시판 전용 글(boardOnly — WPMS 제품 안내 등)은 뉴스가 아니다.
    //  구글 뉴스에 제출하지 않는다. 일반 sitemap.xml 에는 그대로 남아 검색에는 잡힌다.
    //  (지시 2026-08-18) hidden 글도 예전부터 여기서 뺀다.
    .filter((p) => !p.hidden && !p.boardOnly)
    .map((p) => ({ post: p, 발행: new Date(p.publishedAt ?? p.date) }))
    .filter(({ 발행 }) => !Number.isNaN(발행.getTime()) && now - 발행.getTime() <= 이틀)
    .sort((a, b) => b.발행.getTime() - a.발행.getTime())
    // 구글 뉴스 사이트맵 상한은 1,000건
    .slice(0, 1000);

  const urls = 최근글
    .map(
      ({ post, 발행 }) => `  <url>
    <loc>${esc(`${BASE}${postUrl(post)}`)}</loc>
    <news:news>
      <news:publication>
        <news:name>${esc(매체이름)}</news:name>
        <news:language>ko</news:language>
      </news:publication>
      <news:publication_date>${발행.toISOString()}</news:publication_date>
      <news:title>${esc(post.title)}</news:title>
    </news:news>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // 최근 48시간짜리라 오래 캐시하면 안 된다
      "Cache-Control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=600",
    },
  });
}
