// 네이버 검색 API — 뉴스 이슈 수집
// 하루 25,000회 무료. Client ID/Secret 은 환경변수.

const CLIENT_ID = process.env.NAVER_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

export interface NewsItem {
  title: string;
  description: string;
  link: string; // 원문 링크 (출처)
  pubDate: string;
}

// 카테고리 라벨 → 네이버 검색어
const CATEGORY_QUERY: Record<string, string> = {
  사회: "사회 이슈",
  경제: "경제",
  스포츠: "스포츠",
  "IT·테크": "IT 기술",
  "문화·연예": "문화 연예",
  트렌드: "트렌드",
};

// HTML 태그/엔티티 정리
function clean(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

export async function searchNews(
  categoryLabel: string,
  display = 5,
): Promise<NewsItem[]> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("네이버 API 키가 설정되지 않았습니다 (NAVER_CLIENT_ID/SECRET)");
  }
  const query = CATEGORY_QUERY[categoryLabel] ?? categoryLabel;
  const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(
    query,
  )}&display=${display}&sort=date`;

  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": CLIENT_ID,
      "X-Naver-Client-Secret": CLIENT_SECRET,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`네이버 API 오류: ${res.status}`);
  }
  const data = (await res.json()) as {
    items?: { title: string; description: string; link: string; pubDate: string }[];
  };
  return (data.items ?? []).map((it) => ({
    title: clean(it.title),
    description: clean(it.description),
    link: it.link,
    pubDate: it.pubDate,
  }));
}
