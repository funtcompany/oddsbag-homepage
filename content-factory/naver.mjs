// 네이버 검색 API — 뉴스 이슈 수집
// 하루 25,000회 무료. Client ID/Secret 은 환경변수.

const CLIENT_ID = process.env.NAVER_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

// 카테고리 라벨 → 네이버 검색어
const CATEGORY_QUERY = {
  사회: "사회 이슈",
  경제: "경제",
  스포츠: "스포츠",
  "IT·테크": "IT 기술",
  "문화·연예": "문화 연예",
  트렌드: "트렌드",
};

// HTML 태그/엔티티 정리
function clean(text) {
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

// 헤드라인으로 원문 기사 링크를 되찾는다.
// (구글 뉴스는 중계 링크만 줘서 본문을 읽을 수 없다 → 네이버로 같은 기사를 찾아 원문 주소를 얻는다)
export async function resolveArticleLink(headline) {
  if (!CLIENT_ID || !CLIENT_SECRET) return null;
  // 언론사명/괄호 등을 걷어내고 핵심 문구만 검색
  const q = headline
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[|·\-–—]/g, " ")
    .split(/\s+/)
    .slice(0, 8)
    .join(" ")
    .trim();
  if (q.length < 4) return null;
  try {
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(q)}&display=3&sort=sim`;
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": CLIENT_ID, "X-Naver-Client-Secret": CLIENT_SECRET },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const first = data.items?.[0];
    // 네이버 뉴스 페이지(n.news.naver.com)가 본문 추출이 가장 안정적이다
    return first?.link || first?.originallink || null;
  } catch {
    return null;
  }
}

export async function searchNews(categoryLabel, display = 5) {
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
  const data = await res.json();
  return (data.items ?? []).map((it) => ({
    title: clean(it.title),
    description: clean(it.description),
    link: it.link,
    pubDate: it.pubDate,
  }));
}
