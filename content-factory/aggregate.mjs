// 여러 소스를 모아 통일된 RawIssue 목록으로 반환
import { searchNews, 오늘의고정검색어 } from "./naver.mjs";
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

// 요일 고정 코너(월=브랜드평판 순위 · 화=정기 발표 숫자)의 재료를 따로 받아온다.
//  분야 순환에 섞어 넣으면 그날 안 뽑힐 수 있어서, 별도로 받아 맨 앞에 세운다.
async function collect요일코너() {
  const 오늘 = 오늘의고정검색어();
  if (!오늘) return [];
  try {
    const news = await searchNews(오늘.검색어, 4);
    return news.map((n) => ({
      source: "naver",
      title: n.title,
      summary: n.description,
      link: n.link,
      category: 오늘.분야,
      코너: 오늘.코너, // 어느 코너로 나가는 글인지 표시만 남긴다
    }));
  } catch {
    return []; // 이 요일 재료를 못 받아도 나머지 수집은 그대로 돈다
  }
}

export async function collectAllIssues(
  sources,
) {
  const tasks = [];
  // 요일 코너 재료를 첫 번째로 — Promise.allSettled 결과 순서가 곧 이슈 순서다
  if (sources.includes("naver")) tasks.push(collect요일코너());
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
