import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api/admin"] },
      // 네이버·구글·빙 크롤러는 명시적으로 환영
      { userAgent: "Yeti", allow: "/" }, // 네이버
      { userAgent: "Googlebot", allow: "/" },
      { userAgent: "Googlebot-News", allow: "/" },
      { userAgent: "bingbot", allow: "/" },
      { userAgent: "Twitterbot", allow: "/" },
      { userAgent: "facebookexternalhit", allow: "/" },
    ],
    // 뉴스 사이트맵은 최근 48시간 글만 담는 별도 규격 — 구글 뉴스·디스커버 노출용
    sitemap: [
      "https://oddsbag.co.kr/sitemap.xml",
      "https://oddsbag.co.kr/sitemap-news.xml",
    ],
    host: "https://oddsbag.co.kr",
  };
}
