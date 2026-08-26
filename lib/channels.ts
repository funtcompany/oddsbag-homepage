// 오즈백 홈페이지 상단 메뉴(채널) 정의
//
//   홈 / 만드는 것들 / 뮤직 / 이야기 / 매거진
//
// - 매거진: 자동화 파이프라인이 올리는 뉴스·이슈 (기존 그대로)
// - 오즈백: 브랜드 소식 + 서비스별 안내 (하위 탭으로 WPMS·별의 결)
// - 뮤직: AI 음악 작업 이야기·발매 소식 + 유튜브 앨범/라이브
// - 이야기: 오즈백 테일즈에서 다루는 이야기들 (2026-08-18 신설)
//
// 게시물(Post)의 channel 값이 비어 있으면 전부 '매거진'으로 본다.
// → 지금 올라가 있는 글들의 주소(/magazine/…)와 노출은 하나도 바뀌지 않는다.

export type ChannelKey = "magazine" | "oddsbag" | "music" | "tales";

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
  {
    key: "tales",
    label: "이야기",
    emoji: "📖",
    href: "/story",
    base: "/story",
    desc: "오즈백 테일즈가 들려주는 이야기",
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

// 2026-08-18 리뉴얼 — '오즈백'과 '서비스'가 사실상 같은 것을 두 탭으로 갈라놓고 있었다.
//  («오즈백이 만드는 것들» 하나로 합치고, 서비스는 그 안에서 하위 탭으로 고른다)
//  탭 개수를 줄여야 상단 줄이 가로로 넘치지 않는다 — 문의 옆 스크롤바가 생기던 원인.
export const mainNav: NavItem[] = [
  { label: "홈", href: "/", emoji: "🏠", match: [] },
  {
    label: "만드는 것들",
    href: "/oddsbag",
    emoji: "🎒",
    match: ["/oddsbag", "/services", "/apps", "/tools", "/check"],
  },
  { label: "뮤직", href: "/music", emoji: "🎵", match: ["/music"] },
  { label: "이야기", href: "/story", emoji: "📖", match: ["/story"] },
  {
    label: "매거진",
    href: "/magazine",
    emoji: "📰",
    match: ["/magazine", "/category", "/guide"],
  },
];
