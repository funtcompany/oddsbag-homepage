import type { Post } from "@/lib/posts";

// 주제 허브 — 흩어져 있는 꿀팁을 주제별로 모아 보여주는 묶음 페이지.
//
// 【왜 태그로 안 묶었나】
//  실측해보니 태그가 614종으로 흩어져 있고 3편 이상 묶이는 태그가 7개뿐이었다.
//  태그 허브는 만들어도 대부분 1~2편짜리 빈 페이지가 된다.
//  그래서 '사람이 실제로 찾는 주제' 기준으로 키워드를 직접 묶었다.
//
// 【매칭 방식】 제목·태그·요약에 키워드가 있으면 그 허브에 들어간다.
//  본문까지 보면 스치듯 언급된 글까지 딸려 들어와 허브가 지저분해진다.

export interface Hub {
  slug: string;
  title: string;
  emoji: string;
  lead: string;
  /** 이 주제에 속하는지 판단할 키워드 */
  keywords: string[];
}

export const hubs: Hub[] = [
  {
    slug: "mac",
    title: "맥 · 맥북 완전정복",
    emoji: "💻",
    lead: "맥북을 더 빠르고 편하게 쓰는 법. 단축키부터 저장공간 정리까지.",
    keywords: [
      "맥북", "맥 ", "macOS", "맥os", "파인더", "애플", "아이클라우드",
      "에어드롭", "타임머신", "스팟라이트",
    ],
  },
  {
    slug: "windows",
    title: "윈도우 · PC 정리",
    emoji: "🖥️",
    lead: "윈도우 PC가 느려졌을 때, 그리고 알아두면 시간이 줄어드는 것들.",
    keywords: [
      "윈도우", "windows", "PC", "탐색기", "작업관리자", "제어판",
      "엑셀", "워드", "파워포인트", "오피스", "단축키",
    ],
  },
  {
    slug: "phone",
    title: "아이폰 · 안드로이드",
    emoji: "📱",
    lead: "배터리, 저장공간, 사진 정리. 폰 때문에 답답할 때 보는 것들.",
    keywords: [
      "아이폰", "iphone", "안드로이드", "갤럭시", "스마트폰", "배터리",
      "저장공간", "폰카", "카메라", "사진 정리",
    ],
  },
  {
    slug: "web",
    title: "인터넷 · 앱 사용법",
    emoji: "🌐",
    lead: "크롬, 유튜브, 검색, AI. 매일 쓰는데 의외로 모르는 기능들.",
    keywords: [
      "크롬", "브라우저", "유튜브", "검색", "구글", "카카오톡", "네이버",
      "AI", "챗gpt", "chatgpt", "번역", "지도", "와이파이", "인터넷",
    ],
  },
  {
    slug: "home",
    title: "살림 · 생활 정리",
    emoji: "🏠",
    lead: "냉장고, 청소, 수납, 식재료. 집안일이 조금 쉬워지는 요령.",
    keywords: [
      "냉장고", "청소", "수납", "정리", "빨래", "세탁", "곰팡이", "주방",
      "식재료", "보관", "요리", "미세먼지", "환기", "잠", "수면",
    ],
  },
  {
    slug: "money",
    title: "돈 · 절약",
    emoji: "💰",
    lead: "전기요금, 가계부, 쇼핑, 연말정산. 새는 돈을 막는 쪽으로.",
    keywords: [
      "절약", "전기 요금", "전기요금", "가계부", "가스", "요금", "할인",
      "쇼핑", "환불", "연말정산", "세금", "지원금", "청약", "적금", "카드",
    ],
  },
];

export function hubBySlug(slug: string): Hub | undefined {
  return hubs.find((h) => h.slug === slug);
}

function norm(s: string): string {
  return (s ?? "").toLowerCase();
}

/** 이 글이 허브에 속하는가 */
export function matchesHub(post: Post, hub: Hub): boolean {
  const hay = norm(
    `${post.title} ${post.summary} ${(post.tags ?? []).join(" ")}`,
  );
  return hub.keywords.some((k) => hay.includes(norm(k)));
}

/** 허브에 속한 글을 최신순으로 */
export function postsInHub(posts: Post[], hub: Hub): Post[] {
  return posts
    .filter((p) => matchesHub(p, hub))
    .sort((a, b) =>
      (b.publishedAt ?? b.date).localeCompare(a.publishedAt ?? a.date),
    );
}
