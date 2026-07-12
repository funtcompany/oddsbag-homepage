// 이슈 수집 소스 (키 불필요: 구글 트렌드 + 구글 뉴스 국내/해외)
// 네이버 뉴스는 lib/naver.ts 에서 별도.
//
// 반환 타입 RawIssue 로 통일해 AI 초안 파이프라인에 넘긴다.

export type IssueSource =
  | "naver"
  | "google-trends"
  | "google-news"
  | "google-news-world"
  | "youtube"; // youtube 는 lib/youtube.ts (키 필요)

export interface RawIssue {
  source: IssueSource;
  title: string;
  summary: string;
  link: string;
  category: string; // 오즈백 카테고리 라벨
  extra?: string; // 급상승 트래픽 등 부가정보
}

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : "";
}

async function fetchRss(url: string): Promise<string[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (ODDSBAG Magazine Bot)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  const xml = await res.text();
  return xml.split(/<item>/).slice(1).map((s) => s.split("</item>")[0]);
}

// ---- 구글 트렌드 (실시간 급상승 검색어) ----
export async function collectGoogleTrends(geo = "KR"): Promise<RawIssue[]> {
  const items = await fetchRss(
    `https://trends.google.com/trending/rss?geo=${geo}`,
  );
  return items.slice(0, 8).map((block) => {
    const title = tag(block, "title");
    const traffic = tag(block, "ht:approx_traffic");
    const newsTitle = tag(block, "ht:news_item_title");
    const newsUrl = tag(block, "ht:news_item_url");
    return {
      source: "google-trends" as const,
      title,
      summary: newsTitle || `지금 ${geo}에서 급상승 중인 키워드`,
      link: newsUrl || `https://www.google.com/search?q=${encodeURIComponent(title)}`,
      category: "트렌드",
      extra: traffic ? `급상승 ${traffic}` : undefined,
    };
  });
}

// ---- 구글 뉴스 (토픽별, 국내/해외) ----
const NEWS_TOPICS: { topic: string; category: string }[] = [
  { topic: "BUSINESS", category: "경제" },
  { topic: "SPORTS", category: "스포츠" },
  { topic: "TECHNOLOGY", category: "IT·테크" },
  { topic: "ENTERTAINMENT", category: "문화·연예" },
  { topic: "NATION", category: "사회" },
];

async function collectNewsByLocale(
  hl: string,
  gl: string,
  ceid: string,
  source: IssueSource,
  perTopic = 2,
): Promise<RawIssue[]> {
  const out: RawIssue[] = [];
  for (const { topic, category } of NEWS_TOPICS) {
    try {
      const items = await fetchRss(
        `https://news.google.com/rss/headlines/section/topic/${topic}?hl=${hl}&gl=${gl}&ceid=${ceid}`,
      );
      for (const block of items.slice(0, perTopic)) {
        const rawTitle = tag(block, "title"); // "헤드라인 - 출처"
        const link = tag(block, "link");
        const idx = rawTitle.lastIndexOf(" - ");
        const title = idx > 0 ? rawTitle.slice(0, idx) : rawTitle;
        const src = idx > 0 ? rawTitle.slice(idx + 3) : "";
        if (!title) continue;
        out.push({
          source,
          title,
          summary: src ? `출처: ${src}` : "",
          link,
          category,
        });
      }
    } catch {
      /* 특정 토픽 실패는 무시 */
    }
  }
  return out;
}

export function collectGoogleNewsKR(perTopic = 2): Promise<RawIssue[]> {
  return collectNewsByLocale("ko", "KR", "KR:ko", "google-news", perTopic);
}

export function collectGoogleNewsWorld(perTopic = 1): Promise<RawIssue[]> {
  return collectNewsByLocale(
    "en-US",
    "US",
    "US:en",
    "google-news-world",
    perTopic,
  );
}
