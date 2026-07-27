import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/posts";
import { categories } from "@/lib/categories";
import { hubs } from "@/lib/hubs";

const BASE = "https://oddsbag.co.kr";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes = ["", "/magazine", "/link", "/apps"].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "hourly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  // 소개·정책 문서 — 자주 바뀌진 않지만 색인은 돼야 한다 (광고 심사에서 확인한다)
  const infoRoutes = ["/about", "/contact", "/privacy", "/terms"].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "yearly" as const,
    priority: 0.5,
  }));

  // 주제 허브 — 여러 글을 묶는 페이지라 검색엔진이 좋아한다
  const hubRoutes = [
    {
      url: `${BASE}/guide`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    },
    ...hubs.map((h) => ({
      url: `${BASE}/guide/${h.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];

  const categoryRoutes = categories.map((c) => ({
    url: `${BASE}/category/${c.slug}`,
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  const posts = await getAllPosts();
  const postRoutes = posts.map((p, i) => ({
    url: `${BASE}/magazine/${p.slug}`,
    lastModified: new Date(p.publishedAt ?? p.date),
    changeFrequency: "daily" as const,
    // 최신 글일수록 크롤러가 먼저 보게 한다
    priority: i < 10 ? 0.9 : 0.7,
  }));

  return [
    ...staticRoutes,
    ...hubRoutes,
    ...infoRoutes,
    ...categoryRoutes,
    ...postRoutes,
  ];
}
