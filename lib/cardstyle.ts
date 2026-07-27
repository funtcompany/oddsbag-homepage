// 카드뉴스 카테고리별 스타일 (2026-07-27 개편 — 사장님 승인안)
//
// 【원칙】 다양성은 주되, 한 브랜드로 읽히게 한다.
//   변하지 않는 것 — 좌상단 카테고리 뱃지 / 우상단 페이지번호 / 하단 좌측 로고·우측 주소 / 맨 아래 진행막대
//   변하는 것     — 배경·글자색 / 포인트색 / 표지 연출 / 본문 짜는 방식
//
// 표지(커버) 연출 4가지
//   photo  : 사진 전체에 깔고 아래로 어둡게 (가장 강함. 사진이 좋을 때)
//   frame  : 배경은 색면, 사진은 둥근 카드로 얹기 (사진이 평범할 때 안전)
//   block  : 사진 위 + 아래 컬러 블록 (제품·화면 소개에 잘 맞음)
//   type   : 사진 없이 타이포 + 거대 배경 글자 (사진을 못 구했을 때)

export type CoverKind = "photo" | "frame" | "block" | "type";

export interface CardStyle {
  key: string;
  bg: string; // 바탕
  card: string; // 본문 카드
  ink: string; // 제목
  sub: string; // 설명
  faint: string; // 라벨·페이지
  line: string; // 구분선
  accent: string; // 포인트
  onAccent: string;
  ghost: string; // 배경 거대 숫자
  cover: CoverKind;
  dark: boolean; // 어두운 바탕인가 (글자색 반전 판단용)
  texture: "paper" | "grid" | "check" | "none";
}

const PAPER = {
  key: "paper",
  bg: "#F4F0E6", card: "#FFFFFF",
  ink: "#1B3A6B", sub: "#1B3A6Bb8", faint: "#1B3A6B80", line: "#1B3A6B24",
  accent: "#D9603B", onAccent: "#FFFFFF", ghost: "#D9603B",
  cover: "photo" as CoverKind, dark: false, texture: "paper" as const,
};

const NIGHT = {
  key: "night",
  bg: "#0E1116", card: "#171C24",
  ink: "#FFFFFF", sub: "#FFFFFFb8", faint: "#FFFFFF70", line: "#FFFFFF1f",
  accent: "#C6F24E", onAccent: "#0E1116", ghost: "#C6F24E",
  cover: "type" as CoverKind, dark: true, texture: "grid" as const,
};

const INK = {
  key: "ink",
  bg: "#EFEAE3", card: "#FFFFFF",
  ink: "#20242B", sub: "#20242Bb0", faint: "#20242B78", line: "#20242B1f",
  accent: "#C2352F", onAccent: "#FFFFFF", ghost: "#C2352F",
  cover: "frame" as CoverKind, dark: false, texture: "check" as const,
};

const FOREST = {
  key: "forest",
  bg: "#EDF3F0", card: "#FFFFFF",
  ink: "#123A32", sub: "#123A32b0", faint: "#123A3278", line: "#123A3220",
  accent: "#0E8F6E", onAccent: "#FFFFFF", ghost: "#0E8F6E",
  cover: "block" as CoverKind, dark: false, texture: "paper" as const,
};

const WARM = {
  key: "warm",
  bg: "#F6F1E8", card: "#FFFFFF",
  ink: "#3A2A1E", sub: "#3A2A1Eb0", faint: "#3A2A1E78", line: "#3A2A1E22",
  accent: "#B4762E", onAccent: "#FFFFFF", ghost: "#B4762E",
  cover: "photo" as CoverKind, dark: false, texture: "paper" as const,
};

// 문화·연예 — 따뜻한 페이퍼에 자주(플럼) 포인트
const PLUM = {
  ...PAPER,
  key: "plum",
  bg: "#F5EFF1", ink: "#2E1B26", sub: "#2E1B26b0", faint: "#2E1B2678", line: "#2E1B2620",
  accent: "#9B3A62", ghost: "#9B3A62",
  cover: "frame" as CoverKind,
};

// 스포츠 — 어두운 바탕에 주황 (경기장 조명 느낌)
const ARENA = {
  ...NIGHT,
  key: "arena",
  bg: "#12100E", card: "#1D1A16",
  accent: "#FF7A1A", ghost: "#FF7A1A",
  cover: "photo" as CoverKind,
};

// 경제 — 페이퍼 + 딥틸 (숫자가 많아 차분해야 한다)
const TEAL = {
  ...PAPER,
  key: "teal",
  bg: "#EEF2F2", ink: "#132A2C", sub: "#132A2Cb0", faint: "#132A2C78", line: "#132A2C20",
  accent: "#0F6E72", ghost: "#0F6E72",
  cover: "frame" as CoverKind,
};

// 카테고리 → 스타일
const BY_CATEGORY: Record<string, CardStyle> = {
  "꿀팁": PAPER,
  "IT·테크": NIGHT,
  "트렌드": NIGHT,
  "사회": INK,
  "경제": TEAL,
  "문화·연예": PLUM,
  "스포츠": ARENA,
  // 앞으로 생길 분야 (재료함에서 들어오는 것들)
  "만든 것": FOREST,
  "다녀왔습니다": WARM,
};

export function styleFor(category: string, hasPhoto: boolean): CardStyle {
  const s = BY_CATEGORY[category] ?? PAPER;
  // 사진이 없으면 사진을 전제로 한 연출은 쓸 수 없다 → 타이포 표지로 내린다
  if (!hasPhoto && s.cover !== "type") return { ...s, cover: "type" };
  // 사진이 있는데 타이포 표지면, 그 사진을 살릴 수 있게 카드형으로 올린다
  if (hasPhoto && s.cover === "type") return { ...s, cover: "frame" };
  return s;
}

// 카테고리 뱃지에 붙는 이모지 (본문 이모지와 별개로 고정)
const BADGE_EMOJI: Record<string, string> = {
  "꿀팁": "💡", "IT·테크": "🤖", "트렌드": "🔥", "사회": "🏛️",
  "경제": "💰", "문화·연예": "🎬", "스포츠": "⚽",
  "만든 것": "🛠", "다녀왔습니다": "📍",
};
export const badgeEmoji = (c: string) => BADGE_EMOJI[c] ?? "📌";
