// 오즈백 매거진 카테고리 체계
// 게시판/카테고리 네비게이션, 카드 색상, 게시물 분류에 공통 사용

export interface Category {
  slug: string;
  label: string; // 화면 표기 (게시물의 category 값과 일치)
  emoji: string;
  gradient: string; // 커버 배경 (실제 이미지 없을 때 사용)
  accent: string; // 텍스트/뱃지 색
}

export const categories: Category[] = [
  {
    slug: "society",
    label: "사회",
    emoji: "🏛️",
    gradient: "from-slate-600 to-slate-800",
    accent: "text-slate-700 bg-slate-100",
  },
  {
    slug: "economy",
    label: "경제",
    emoji: "💰",
    gradient: "from-emerald-500 to-teal-700",
    accent: "text-emerald-700 bg-emerald-100",
  },
  {
    slug: "sports",
    label: "스포츠",
    emoji: "⚽",
    gradient: "from-blue-500 to-indigo-700",
    accent: "text-blue-700 bg-blue-100",
  },
  {
    slug: "tech",
    label: "IT·테크",
    emoji: "💻",
    gradient: "from-oddsbag-purple to-oddsbag-purple-dark",
    accent: "text-oddsbag-purple bg-oddsbag-purple/10",
  },
  {
    slug: "culture",
    label: "문화·연예",
    emoji: "🎬",
    gradient: "from-pink-500 to-rose-700",
    accent: "text-pink-700 bg-pink-100",
  },
  {
    slug: "trend",
    label: "트렌드",
    emoji: "🔥",
    gradient: "from-amber-500 to-orange-700",
    accent: "text-orange-700 bg-orange-100",
  },
  {
    // 실시간 이슈가 아닌 '계속 찾아보는 정보' — PC 꿀팁, 생활정보, 시즌 일정
    slug: "tips",
    label: "꿀팁",
    emoji: "💡",
    gradient: "from-oddsbag-purple to-oddsbag-purple-dark",
    accent: "text-oddsbag-purple bg-oddsbag-purple/10",
  },
];

export const getCategoryByLabel = (label: string): Category | undefined =>
  categories.find((c) => c.label === label);

export const getCategoryBySlug = (slug: string): Category | undefined =>
  categories.find((c) => c.slug === slug);

// fallback (라벨이 목록에 없을 때)
export const fallbackCategory: Category = {
  slug: "etc",
  label: "기타",
  emoji: "📰",
  gradient: "from-gray-500 to-gray-700",
  accent: "text-gray-700 bg-gray-100",
};

export const categoryOf = (label: string): Category =>
  getCategoryByLabel(label) ?? fallbackCategory;
