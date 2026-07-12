import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/posts";
import { categories } from "@/lib/categories";

const BASE = "https://oddsbag.co.kr";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = ["", "/magazine", "/apps"].map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: "daily" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  const categoryRoutes = categories.map((c) => ({
    url: `${BASE}/category/${c.slug}`,
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  const postRoutes = (await getAllPosts()).map((p) => ({
    url: `${BASE}/magazine/${p.slug}`,
    lastModified: p.date,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...postRoutes];
}
