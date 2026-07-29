// 영상(세로 릴스·쇼츠) 카테고리별 스타일 — 카드뉴스 개편안(lib/cardstyle.ts, 사장님 승인)을 영상에 이식.
//
// 【원칙】 카드뉴스와 같은 색·같은 뼈대. 넘겨봐도 오즈백인 건 알아보되, 무슨 종류의 글인지 한눈에 구분된다.
//   변하지 않는 것 — 최상단 진행막대 / 좌상단 카테고리 뱃지 / 우상단 페이지 / 하단 로고·주소
//   변하는 것     — 배경·글자색, 포인트색, 배경영상 사용 여부
//
// 【영상이라서 다른 점】(문서/‥/_디자인개편/02_영상_비율과_레이아웃.md)
//   · 진행막대를 맨 위로 (하단은 SNS UI가 덮음)
//   · 글자를 키움 (카드뉴스 제목 80px → 영상 104px)
//   · 안전영역: 위 230px·아래 500px 비움
//   · 글자 많은 카테고리(꿀팁·다녀왔습니다)는 배경영상을 끔 — 배경이 글을 방해한다

// 카드뉴스와 동일한 색값 (lib/cardstyle.ts 와 1:1)
const PAPER = { key: "paper", bg: "#F4F0E6", ink: "#1B3A6B", sub: "#1B3A6Bc0", accent: "#D9603B", onAccent: "#FFFFFF", dark: false, broll: false };
const NIGHT = { key: "night", bg: "#0E1116", ink: "#FFFFFF", sub: "#FFFFFFc0", accent: "#C6F24E", onAccent: "#0E1116", dark: true, broll: true };
const INK___ = { key: "ink", bg: "#20242B", ink: "#FFFFFF", sub: "#FFFFFFc0", accent: "#E0574F", onAccent: "#FFFFFF", dark: true, broll: true };
const TEAL = { key: "teal", bg: "#EEF2F2", ink: "#132A2C", sub: "#132A2Cc0", accent: "#0F6E72", onAccent: "#FFFFFF", dark: false, broll: false };
const PLUM = { key: "plum", bg: "#F5EFF1", ink: "#2E1B26", sub: "#2E1B26c0", accent: "#9B3A62", onAccent: "#FFFFFF", dark: false, broll: false };
const ARENA = { key: "arena", bg: "#12100E", ink: "#FFFFFF", sub: "#FFFFFFc0", accent: "#FF7A1A", onAccent: "#12100E", dark: true, broll: true };
const FOREST = { key: "forest", bg: "#0F241F", ink: "#FFFFFF", sub: "#FFFFFFc0", accent: "#2BD9A6", onAccent: "#0F241F", dark: true, broll: false };
const WARM = { key: "warm", bg: "#F6F1E8", ink: "#3A2A1E", sub: "#3A2A1Ec0", accent: "#B4762E", onAccent: "#FFFFFF", dark: false, broll: false };

// ※ 카드뉴스에서 '사회(INK)'는 밝은 먹색 배경이지만, 영상은 배경영상을 얹으므로 어두운 먹색으로 뒤집었다.
//    (밝은 배경 + 배경영상 = 글자가 절대 안 읽힌다)

const BY_CATEGORY = {
  "꿀팁": PAPER,
  "IT·테크": NIGHT,
  "트렌드": NIGHT,
  "사회": INK___,
  "경제": TEAL,
  "문화·연예": PLUM,
  "스포츠": ARENA,
  "만든 것": FOREST,
  "다녀왔습니다": WARM,
};

const BADGE_EMOJI = {
  "꿀팁": "💡", "IT·테크": "🤖", "트렌드": "🔥", "사회": "🏛️",
  "경제": "💰", "문화·연예": "🎬", "스포츠": "⚽",
  "만든 것": "🛠", "다녀왔습니다": "📍",
};

export function videoStyleFor(category) {
  return BY_CATEGORY[category] ?? PAPER;
}
export const badgeEmoji = (c) => BADGE_EMOJI[c] ?? "📌";
// 이 카테고리에 배경영상(Pexels)을 쓰는가 — 글자가 많은 카테고리는 끈다
export const usesBroll = (category) => videoStyleFor(category).broll;

// 9:16 안전영역 (인스타·쇼츠 UI가 덮는 영역)
export const SAFE_TOP = 200;    // 계정명·시간
export const SAFE_BOTTOM = 430; // 캡션·좋아요·공유 (참고값)
// 로고 줄이 놓이는 위치(화면 아래에서 이만큼 띄움). 사장님 지시(2026-07-29)로 아래로 내려
// 본문이 쓸 수 있는 세로 공간을 넓혔다. 로고·주소는 짧아서 SNS UI와 겹쳐도 읽는 데 지장이 없다.
export const FOOTER_BOTTOM = 190;
