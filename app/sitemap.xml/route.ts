import { getAllPosts } from "@/lib/posts";
import { categories } from "@/lib/categories";
import { hubs } from "@/lib/hubs";
import { postUrl } from "@/lib/channels";

const BASE = "https://oddsbag.co.kr";

// 왜 app/sitemap.ts 가 아니라 이 파일인가 (2026-08-08)
//  Next 의 sitemap.ts 규약은 빌드할 때 파일 하나로 구워진다.
//  revalidate 를 적어놔도 다시 만들어지지 않아서, 8/6 배포 시점 목록에 그대로 멈춰 있었다.
//  (그 뒤에 낸 글 6편이 구글에 제출되지 않았다)
//  feed.xml · sitemap-news.xml 처럼 라우트로 만들면 정상적으로 다시 만들어진다 — 같은 방식으로 맞춘다.
export const revalidate = 600;

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

interface Entry {
  url: string;
  lastModified?: Date;
  changeFrequency: string;
  priority: number;
}

const toXml = (e: Entry) => {
  const 날짜 =
    e.lastModified && !Number.isNaN(e.lastModified.getTime())
      ? `\n    <lastmod>${e.lastModified.toISOString()}</lastmod>`
      : "";
  return `  <url>
    <loc>${esc(e.url)}</loc>${날짜}
    <changefreq>${e.changeFrequency}</changefreq>
    <priority>${e.priority.toFixed(1)}</priority>
  </url>`;
};

export async function GET() {
  const now = new Date();

  const staticRoutes: Entry[] = ["", "/magazine", "/oddsbag", "/music", "/services", "/link"].map(
    (path) => ({
      url: `${BASE}${path}`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: path === "" ? 1 : 0.8,
    }),
  );

  // 소개·정책 문서 — 자주 바뀌진 않지만 색인은 돼야 한다 (광고 심사에서 확인한다)
  const infoRoutes: Entry[] = ["/about", "/contact", "/privacy", "/terms"].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  // 주제 허브 — 여러 글을 묶는 페이지라 검색엔진이 좋아한다
  const hubRoutes: Entry[] = [
    { url: `${BASE}/guide`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    ...hubs.map((h) => ({
      url: `${BASE}/guide/${h.slug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    })),
  ];

  const categoryRoutes: Entry[] = categories.map((c) => ({
    url: `${BASE}/category/${c.slug}`,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  // 숨긴 글도 사이트맵에는 남긴다 — 검색 유입과 색인을 지키기 위함.
  // 목록에서만 빠지고, 우선순위만 낮춘다.
  const posts = await getAllPosts();
  const postRoutes: Entry[] = posts.map((p, i) => ({
    url: `${BASE}${postUrl(p)}`,
    lastModified: new Date(p.publishedAt ?? p.date),
    changeFrequency: p.hidden ? "monthly" : "daily",
    // 최신 글일수록 크롤러가 먼저 보게 한다
    priority: p.hidden ? 0.4 : i < 10 ? 0.9 : 0.7,
  }));

  const urls = [
    ...staticRoutes,
    ...hubRoutes,
    ...infoRoutes,
    ...categoryRoutes,
    ...postRoutes,
  ]
    .map(toXml)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
