// 네이버 검색 API — 뉴스 이슈 수집
// 하루 25,000회 무료. Client ID/Secret 은 환경변수.

const CLIENT_ID = process.env.NAVER_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

// 카테고리 라벨 → 네이버 검색어 (여러 개를 회차마다 번갈아 쓴다)
// 카테고리 이름 그대로("스포츠") 검색하면 소재가 얇고 매번 비슷한 기사만 나와서
// 사회·경제만 살아남고 나머지 분야가 말라붙는다. 분야마다 실제 검색어를 여러 개 둔다.
const CATEGORY_QUERIES = {
  사회: ["사회 이슈", "생활 물가", "복지 정책", "교육 현장", "안전 사고"],
  경제: ["경제", "금리 환율", "부동산 시장", "소비 트렌드", "기업 실적"],
  스포츠: ["프로야구", "축구 국가대표", "프로축구 K리그", "농구 배구", "스포츠 기록"],
  "IT·테크": ["AI 인공지능", "스마트폰 신제품", "IT 서비스", "반도체 기술", "앱 업데이트"],
  "문화·연예": ["영화 개봉", "드라마 화제", "K팝 컴백", "공연 전시", "예능 프로그램"],
  트렌드: ["요즘 유행", "SNS 화제", "인기 검색어", "밈 유행어", "신조어"],
};

// 회차마다 다른 검색어를 쓰도록 시간 기준으로 돌린다 (같은 기사만 반복 수집되는 것 방지)
function queryFor(categoryLabel) {
  const list = CATEGORY_QUERIES[categoryLabel];
  if (!list) return categoryLabel;
  const slot = Math.floor(Date.now() / (60 * 60 * 1000)); // 1시간마다 이동
  return list[slot % list.length];
}

// ─────────────────────────────────────────────────────────────
// 요일 고정 코너용 검색어 (사장님 승인 2026-08-12)
//
//   월 「이 달의 순위」        — 업종별 브랜드평판 TOP 10
//   화 「숫자로 보는 이번 주」  — 그 주 발표된 공식 숫자 1개
//
// 이 두 요일은 새로 만들 것이 없다. 검색어만 고정해 넣으면 기존
// 수집 → 작성 → 심사 → 영상 라인이 그대로 돈다.
//
// ⚠ 기관 원본 사이트는 우리 프로그램이 못 읽는다 (실측: 한국부동산원 120자,
//   국가데이터처 207자 — 본문이 첨부파일, 오피넷 0자 — 자바스크립트).
//   그래서 「기관 이름 + 발표 항목」으로 검색해 **언론이 텍스트로 받아쓴 기사**를 받는다.
//   (실측 통과: 파이낸스투데이 2,301자 · 일간투데이 2,602자 · 정책브리핑 4,000자)
//
// ⚠ 「브랜드평판」 단독 검색은 바깥 중앙값 5,166회로 약하다. 반드시 업종명을 붙인다.
//   업종은 주마다 돌린다 — 같은 업종이 매달 나오면 코너가 아니라 반복이 된다.
const 월_업종순환 = [
  "아파트 브랜드평판 순위",
  "편의점 브랜드평판 순위",
  "자동차 브랜드평판 순위",
  "은행 브랜드평판 순위",
  "치킨 브랜드평판 순위",
  "가전 브랜드평판 순위",
  "화장품 브랜드평판 순위",
  "커피전문점 브랜드평판 순위",
  "이커머스 브랜드평판 순위",
  "통신사 브랜드평판 순위",
  "라면 브랜드평판 순위",
  "항공사 브랜드평판 순위",
];

// 화요일 — 매주 반드시 나오는 정기 발표만 쓴다. 「있을 수도 없을 수도 있는 사건」은 넣지 않는다.
//  ⚠ 「기름값 전망」(중앙값 5,047회)은 약해서 뺐다. 넷플릭스 톱10(12,595회)은 가장 약한 칸이라 뒤에 둔다.
const 화_정기발표 = [
  "소비자물가동향 통계",
  "주간 아파트가격동향 부동산원",
  "고용동향 취업자 수",
  "넷플릭스 한국 톱10 순위",
];

/** 한국 시간 기준 요일 (0=일) — 서버는 UTC 로 돈다 */
function kstDay(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600000).getUTCDay();
}

/** 올해 몇 번째 주인가 — 업종·발표 항목을 주 단위로 돌리는 데 쓴다 */
function 주차(now = new Date()) {
  const 시작 = Date.UTC(now.getUTCFullYear(), 0, 1);
  return Math.floor((now.getTime() - 시작) / (7 * 86400000));
}

/**
 * 오늘 요일의 고정 코너 검색어. 해당 요일이 아니면 null.
 * WEEKDAY_PLAN=0 이면 통째로 꺼진다 (한 줄로 옛 동작으로 돌아가기).
 */
export function 오늘의고정검색어(now = new Date()) {
  if (process.env.WEEKDAY_PLAN === "0") return null;
  const d = kstDay(now);
  const w = 주차(now);
  if (d === 1) return { 코너: "이 달의 순위", 검색어: 월_업종순환[w % 월_업종순환.length], 분야: "경제" };
  if (d === 2) return { 코너: "숫자로 보는 이번 주", 검색어: 화_정기발표[w % 화_정기발표.length], 분야: "경제" };
  return null;
}

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
  const query = queryFor(categoryLabel);
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
