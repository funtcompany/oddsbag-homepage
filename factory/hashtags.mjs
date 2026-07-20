// 카테고리별 해시태그 (검색 유입용) — 최소 10, 최대 30개.
// 풀을 넓게 두고 글(slug)마다 섞어, 매번 다른 조합이 나오게 한다(브랜드 태그는 항상 앞).
const CATEGORY_TAGS = {
  사회: ["#사회이슈", "#뉴스", "#시사", "#오늘의뉴스", "#속보", "#뉴스요약", "#사회", "#이슈정리", "#뉴스브리핑", "#세상소식", "#핫뉴스", "#시사이슈"],
  경제: ["#경제", "#재테크", "#경제뉴스", "#주식", "#부동산", "#투자", "#경제이슈", "#투자정보", "#머니", "#부자되기", "#금융", "#economy"],
  스포츠: ["#스포츠", "#스포츠뉴스", "#축구", "#야구", "#경기결과", "#스포츠이슈", "#농구", "#운동", "#스포츠하이라이트", "#스포츠소식", "#sports", "#경기"],
  "IT·테크": ["#IT", "#테크", "#인공지능", "#AI", "#IT뉴스", "#신기술", "#테크뉴스", "#가젯", "#스마트폰", "#technology", "#IT트렌드", "#미래기술"],
  "문화·연예": ["#연예", "#문화", "#엔터", "#연예뉴스", "#드라마", "#영화", "#kpop", "#연예인", "#문화생활", "#entertainment", "#연예소식", "#핫이슈"],
  트렌드: ["#트렌드", "#요즘", "#밈", "#핫이슈", "#급상승", "#트렌드뉴스", "#요즘뜨는", "#화제", "#인기", "#trend", "#실시간", "#지금뜨는"],
};
const COMMON = ["#오늘의이슈", "#이슈", "#카드뉴스", "#쇼츠", "#릴스", "#뉴스스타그램", "#정보", "#뉴스룸", "#데일리뉴스", "#이슈요약", "#세줄뉴스", "#뉴스피드", "#요즘이슈", "#오늘뉴스", "#지식", "#정보공유"];
const BRAND = ["#오즈백", "#ODDSBAG"]; // 항상 먼저

const norm = (s) => "#" + String(s).replace(/[^0-9a-zA-Z가-힣]/g, "");
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); }

// 글마다 다른 순서로 섞은 해시태그 배열 (브랜드 먼저, 중복 제거)
function pickTags(post, n) {
  const count = Math.max(10, Math.min(30, n));
  const cat = CATEGORY_TAGS[post.category] || ["#이슈", "#뉴스", "#시사", "#오늘의뉴스"];
  const fromPost = (post.tags || []).map(norm).filter((t) => t.length > 2); // 글 키워드 → 태그
  const seed = post.slug || post.title || "";
  const shuffled = [...cat, ...fromPost, ...COMMON]
    .map((t, i) => [t, hash(seed + "|" + i + "|" + t)])
    .sort((a, b) => a[1] - b[1])
    .map(([t]) => t);
  const out = [];
  for (const t of [...BRAND, ...shuffled]) {
    const k = t.toLowerCase();
    if (t.length > 1 && !out.some((x) => x.toLowerCase() === k)) out.push(t);
    if (out.length >= count) break;
  }
  return out;
}

// 해시태그 문자열 (인스타 30 / 유튜브·페북 15 등, 최소 10)
export function hashtags(post, n = 15) {
  return pickTags(post, n).join(" ");
}

// 유튜브 tags 필드용 키워드 배열 (# 없이, 최대 n개)
export function keywords(post, n = 20) {
  const words = pickTags(post, n).map((t) => t.replace(/^#/, ""));
  return [...new Set(["오즈백", "ODDSBAG", post.category, ...words])].filter(Boolean).slice(0, n);
}
