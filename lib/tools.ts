// 오즈백 툴 정의 — 메인 홈 그리드 및 각 툴 페이지에서 공통으로 사용
// 버전별 로드맵: V1(일단 열어봐) → V2(이것도 있어?) → V3(여기 없는 게 없네)

export type ToolVersion = "V1" | "V2" | "V3";

export type ToolCategory = "계산" | "AI작성" | "감정" | "정보";

export interface Tool {
  slug: string; // URL 경로 (/tools/[slug])
  emoji: string;
  title: string;
  description: string; // 한 줄 설명
  category: ToolCategory;
  version: ToolVersion;
  needsApiKey?: boolean; // AI 연동 등 외부 키 필요 여부
  isNew?: boolean;
  ready?: boolean; // 실제 페이지 구현 완료 여부 (false면 Coming Soon)
}

// V1 — 우선 개발 (10종)
export const tools: Tool[] = [
  {
    slug: "sleep",
    emoji: "😴",
    title: "수면 사이클 역산기",
    description: "기상 시간만 넣으면 최적의 취침 시간을 계산해 드려요",
    category: "계산",
    version: "V1",
    ready: false,
  },
  {
    slug: "caffeine",
    emoji: "☕",
    title: "카페인 잔류량 계산기",
    description: "오늘 마신 커피, 지금 몸에 얼마나 남아있을까?",
    category: "계산",
    version: "V1",
    ready: false,
  },
  {
    slug: "hangover",
    emoji: "🍺",
    title: "숙취 회복 타임라인",
    description: "마신 술 종류와 양으로 회복 예상 시간을 알려드려요",
    category: "계산",
    version: "V1",
    ready: false,
  },
  {
    slug: "dutch",
    emoji: "🧮",
    title: "더치페이 감정 계산기",
    description: "누가 더 먹었는지까지 반영한 진짜 공평한 분배",
    category: "계산",
    version: "V1",
    ready: false,
  },
  {
    slug: "lottery",
    emoji: "🎰",
    title: "복권 당첨 시뮬레이터",
    description: "당첨금 넣으면 세금·실수령·지출 플래닝까지",
    category: "계산",
    version: "V1",
    ready: false,
  },
  {
    slug: "apology",
    emoji: "🙏",
    title: "사과문 생성기",
    description: "상황만 입력하면 진정성 있는 사과문을 자동으로",
    category: "AI작성",
    version: "V1",
    needsApiKey: true,
    ready: false,
  },
  {
    slug: "reject",
    emoji: "🙅",
    title: "거절 멘트 메이커",
    description: "모임·부탁·소개팅, 상황별 부드러운 거절 문구",
    category: "AI작성",
    version: "V1",
    needsApiKey: true,
    ready: false,
  },
  {
    slug: "movie-title",
    emoji: "🎬",
    title: "내 인생 영화 제목 짓기",
    description: "키워드만 넣으면 나만의 영화 제목 + 장르 생성",
    category: "AI작성",
    version: "V1",
    needsApiKey: true,
    ready: false,
  },
  {
    slug: "sns-emotion",
    emoji: "🌡️",
    title: "SNS 감정 온도계",
    description: "올리려는 글의 감정을 수치화하고 발행 여부 판단",
    category: "감정",
    version: "V1",
    needsApiKey: true,
    ready: false,
  },
  {
    slug: "history-today",
    emoji: "📅",
    title: "오늘 역사 속 이날",
    description: "날짜만 넣으면 그날 세계에서 일어난 일을 알려드려요",
    category: "정보",
    version: "V1",
    ready: false,
  },
];

// 편의 함수
export const getToolBySlug = (slug: string): Tool | undefined =>
  tools.find((t) => t.slug === slug);

export const getRelatedTools = (slug: string, count = 3): Tool[] =>
  tools.filter((t) => t.slug !== slug).slice(0, count);

// 카테고리별 색상 힌트 (카드 태그 등에 활용)
export const categoryStyles: Record<ToolCategory, string> = {
  계산: "bg-oddsbag-purple/10 text-oddsbag-purple",
  AI작성: "bg-oddsbag-yellow/20 text-oddsbag-purple-dark",
  감정: "bg-pink-100 text-pink-700",
  정보: "bg-blue-100 text-blue-700",
};
