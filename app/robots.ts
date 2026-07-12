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
    sitemap: "https://oddsbag.co.kr/sitemap.xml",
    host: "https://oddsbag.co.kr",
  };
}
