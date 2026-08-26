import { getAllPosts } from "@/lib/posts";
import { hubTools, TOOLS_HUB_HREF } from "@/lib/tools-hub";
import { CHECKLIST_HREF } from "@/lib/checklist";
import { categories } from "@/lib/categories";
import { hubs } from "@/lib/hubs";
import { postUrl } from "@/lib/channels";
import { services } from "@/lib/services-catalog";
import { albums } from "@/lib/music";

const BASE = "https://oddsbag.co.kr";

// 왜 app/sitemap.ts 가 아니라 이 파일인가 (2026-08-08)
//  Next 의 sitemap.ts 규약은 빌드할 때 파일 하나로 구워진다.
//  revalidate 를 적어놔도 다시 만들어지지 않아서, 8/6 배포 시점 목록에 그대로 멈춰 있었다.
//  (그 뒤에 낸 글 6편이 구글에 제출되지 않았다)
//  라우트로 옮겨도 마찬가지였다. Next 는 'sitemap.xml' 이라는 이름 자체를 특별 취급해서
//  빌드 때 구워버린다 (이름이 다른 feed.xml · sitemap-news.xml 은 정상적으로 다시 만들어진다).
//  그래서 "매 요청마다 새로 만들라"고 못 박는다.
//  DB 부하는 걱정 없다 — getAllPosts 가 60초짜리 캐시라 크롤러가 몰려와도 DB는 분당 1회만 읽는다.
export const dynamic = "force-dynamic";

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

  const staticRoutes: Entry[] = [
    "",
    "/magazine",
    "/oddsbag",
    "/music",
    "/story", // 이야기 (2026-08-18 신설)
    "/services",
    "/link",
  ].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "hourly",
    priority: path === "" ? 1 : 0.8,
  }));

  // 오즈백 툴즈 — 허브와 도구 화면들 (2026-08-20 신설).
  //  ★도구 명부(lib/tools-hub.ts) 하나만 보므로 도구를 더 만들어도 여기는 손댈 일이 없다.
  //  ※도구로 «만들어진 자료»(/service/html-link/<시리얼>)는 절대 여기 넣지 않는다 —
  //    그건 받은 사람만 여는 것이고, 그쪽은 X-Robots-Tag: noindex 로 따로 막아 뒀다.
  const toolRoutes: Entry[] = [
    { path: TOOLS_HUB_HREF, priority: 0.8 },
    { path: CHECKLIST_HREF, priority: 0.8 },
    ...hubTools.map((t) => ({ path: t.href, priority: 0.7 })),
  ].map(({ path, priority }) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority,
  }));

  // 서비스 안내·앨범 화면 (2026-08-18 신설) — 목록이 늘면 여기도 저절로 따라온다
  const serviceRoutes: Entry[] = services.map((s) => ({
    url: `${BASE}/oddsbag/service/${s.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const albumRoutes: Entry[] = albums.map((a) => ({
    url: `${BASE}/music/album/${a.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

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
    ...toolRoutes,
    ...serviceRoutes,
    ...albumRoutes,
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
