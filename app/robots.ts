import type { MetadataRoute } from "next";

// 크롤러에게 열지 않는 곳 — 한 곳에 모아 둔다.
//  ★아래 모든 그룹이 이 «같은» 목록을 써야 한다. 그룹마다 따로 적으면 반드시 어긋난다.
//  ※HTML 링크 생성기의 시리얼 주소(/service/html-link/<코드>)는 여기 넣지 않는다.
//    크롤을 막으면 그 응답의 noindex 헤더를 크롤러가 못 읽어서, 이미 발견된 주소가
//    «제목 없는 URL» 로 검색 결과에 그냥 남는다. 그쪽은 X-Robots-Tag 로 뺀다
//    (app/service/html-link/[code]/route.ts).
const BLOCKED = ["/admin", "/api/admin"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: BLOCKED },
      // 네이버·구글·빙 크롤러는 명시적으로 환영.
      // ★이름을 적은 크롤러에게도 disallow 를 «반드시» 같이 준다 (2026-08-20 고침).
      //   robots.txt 규격상 크롤러는 «자기 이름이 적힌 그룹 하나»만 읽고 `*` 그룹은 무시한다.
      //   그래서 여기에 allow 만 적어 두면 구글·네이버·빙에게는 /admin 차단이 통째로
      //   사라진다. 환영한다는 뜻으로 적은 줄이 오히려 문을 열어 두고 있었다.
      { userAgent: "Yeti", allow: "/", disallow: BLOCKED }, // 네이버
      { userAgent: "Googlebot", allow: "/", disallow: BLOCKED },
      { userAgent: "Googlebot-News", allow: "/", disallow: BLOCKED },
      { userAgent: "bingbot", allow: "/", disallow: BLOCKED },
      { userAgent: "Twitterbot", allow: "/", disallow: BLOCKED },
      { userAgent: "facebookexternalhit", allow: "/", disallow: BLOCKED },
    ],
    // 뉴스 사이트맵은 최근 48시간 글만 담는 별도 규격 — 구글 뉴스·디스커버 노출용
    sitemap: [
      "https://oddsbag.co.kr/sitemap.xml",
      "https://oddsbag.co.kr/sitemap-news.xml",
    ],
    host: "https://oddsbag.co.kr",
  };
}
