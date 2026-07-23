// 여러 소스를 모아 통일된 RawIssue 목록으로 반환
import { searchNews } from "./naver.mjs";
import {
  collectGoogleTrends,
  collectGoogleNewsKR,
  collectGoogleNewsWorld,
} from "./sources.mjs";
import { collectYouTube } from "./youtube.mjs";
import { categories } from "./categories.mjs";

// 네이버 → RawIssue (카테고리별)
async function collectNaver() {
  const out = [];
  for (const cat of categories) {
    // 꿀팁은 실시간 뉴스가 아니라 에버그린 주제로 따로 만든다 (네이버 검색 대상 아님)
    if (cat.slug === "tips") continue;
    try {
      // 분야당 3건 — 원문을 못 읽어 버려지는 비율이 높아, 여유 있게 뽑아야
      // 스포츠·문화 같은 분야가 매 회차 0건으로 말라붙지 않는다
      const news = await searchNews(cat.label, 3);
      for (const n of news) {
        out.push({
          source: "naver",
          title: n.title,
          summary: n.description,
          link: n.link,
          category: cat.label,
        });
      }
    } catch {
      /* 개별 카테고리 실패 무시 */
    }
  }
  return out;
}

export async function collectAllIssues(
  sources,
) {
  const tasks = [];
  if (sources.includes("naver")) tasks.push(collectNaver());
  if (sources.includes("google-trends")) tasks.push(collectGoogleTrends("KR"));
  if (sources.includes("google-news")) tasks.push(collectGoogleNewsKR(2));
  if (sources.includes("google-news-world"))
    tasks.push(collectGoogleNewsWorld(1));
  if (sources.includes("youtube")) tasks.push(collectYouTube("KR", 6));

  const results = await Promise.allSettled(tasks);
  const issues = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);

  // 제목 기준 중복 제거
  const seen = new Set();
  return issues.filter((i) => {
    const key = i.title.replace(/\s+/g, "").slice(0, 30);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
