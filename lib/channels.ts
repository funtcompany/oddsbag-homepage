// 오즈백 홈페이지 상단 메뉴(채널) 정의
//
//   홈 / 오즈백 / 뮤직 / 서비스 / 매거진
//
// - 매거진: 자동화 파이프라인이 올리는 뉴스·이슈 (기존 그대로)
// - 오즈백: 내부 서비스 소개, 개발 이야기, 공지
// - 뮤직: AI 음악 작업 이야기·발매 소식
// - 서비스: 앱/툴 소개 (게시물이 아니라 카드 목록)
//
// 게시물(Post)의 channel 값이 비어 있으면 전부 '매거진'으로 본다.
// → 지금 올라가 있는 글들의 주소(/magazine/…)와 노출은 하나도 바뀌지 않는다.

export type ChannelKey = "magazine" | "oddsbag" | "music";

export interface Channel {
  key: ChannelKey;
  label: string;
  emoji: string;
  href: string; // 목록 주소
  base: string; // 글 상세 주소 앞부분
  desc: string;
}

export const channels: Channel[] = [
  {
    key: "magazine",
    label: "매거진",
    emoji: "📰",
    href: "/magazine",
    base: "/magazine",
    desc: "오늘의 이슈를 오즈백 시선으로",
  },
  {
    key: "oddsbag",
    label: "오즈백",
    emoji: "🎒",
    href: "/oddsbag",
    base: "/oddsbag",
    desc: "우리가 만드는 것들과 만드는 과정",
  },
  {
    key: "music",
    label: "뮤직",
    emoji: "🎵",
    href: "/music",
    base: "/music",
    desc: "오즈백이 만드는 음악",
  },
];

export const DEFAULT_CHANNEL: ChannelKey = "magazine";

export const isChannelKey = (v: unknown): v is ChannelKey =>
  typeof v === "string" && channels.some((c) => c.key === v);

export const channelOf = (key?: string): Channel =>
  channels.find((c) => c.key === key) ?? channels[0];

/** 글 주소 — 채널에 따라 /magazine/… /oddsbag/… /music/… */
export const postUrl = (post: { slug: string; channel?: string }): string =>
  `${channelOf(post.channel).base}/${post.slug}`;

// 상단 메인 메뉴 (채널 + 홈·서비스)
export interface NavItem {
  label: string;
  href: string;
  emoji: string;
  /** 이 주소들로 시작하면 현재 탭으로 표시 */
  match: string[];
}

export const mainNav: NavItem[] = [
  { label: "홈", href: "/", emoji: "🏠", match: [] },
  { label: "오즈백", href: "/oddsbag", emoji: "🎒", match: ["/oddsbag"] },
  { label: "뮤직", href: "/music", emoji: "🎵", match: ["/music"] },
  { label: "서비스", href: "/services", emoji: "🧰", match: ["/services", "/apps", "/tools"] },
  {
    label: "매거진",
    href: "/magazine",
    emoji: "📰",
    match: ["/magazine", "/category", "/guide"],
  },
];
