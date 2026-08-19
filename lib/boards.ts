// «만드는 것들» 안의 게시판 구분
//
// 지시 2026-08-19 «소식에 들어가서 아래에 뜨는 글 목록을 게시판을 정해서 볼 수 있으면 좋겠다»
//
// ★글에 새 칸을 만들지 않는다. 지금 올라가 있는 글은 대부분 Redis 안에 있어서
//   content/posts/*.json 을 고쳐도 화면은 안 바뀐다(Redis 가 시드보다 우선).
//   → 글을 건드리지 않고 «어느 게시판 글인가»를 여기서 판정한다.
//
// 판정 순서
//   1) boardOnly (이미 있는 칸 — WPMS·별의 결 원고가 쓰는 값)
//   2) slug / 태그로 알아보기
//   3) 그 외 전부 «소식»
//
// 게시판이 늘어나면 아래 배열에 한 칸 넣으면 탭이 저절로 생긴다.
// (글이 0편인 게시판은 탭에 나오지 않는다 — 빈 탭을 눌러 빈손으로 나가는 일을 막는다)

import type { CardPost } from "@/lib/cardPost";

export interface Board {
  key: string;
  label: string;
  emoji: string;
  /** 이 게시판의 서비스 안내 페이지 (있으면 탭 옆에 «안내 보기»가 붙는다) */
  href?: string;
  /** slug 가 이걸로 시작하거나 포함하면 이 게시판 글 */
  slugHints?: string[];
  /** 태그가 하나라도 겹치면 이 게시판 글 */
  tagHints?: string[];
}

export const NEWS_BOARD = "news";

export const oddsbagBoards: Board[] = [
  {
    key: "htmllink",
    label: "HTML 링크 생성기",
    emoji: "🔗",
    href: "/service/html-link",
    slugHints: ["html-link", "html-upload", "html-preview", "html-file", "html-that"],
    tagHints: ["오즈백툴즈", "HTML링크", "HTML링크만들기", "HTML공유", "HTML사용법"],
  },
  {
    key: "starflow",
    label: "별의 결",
    emoji: "🌙",
    href: "/oddsbag/service/starflow",
    slugHints: ["starflow", "byeorui"],
    tagHints: ["별의결", "운세"],
  },
  {
    key: "wpms",
    label: "WPMS",
    emoji: "🎤",
    href: "/oddsbag/service/wpms",
    slugHints: ["wpms"],
    tagHints: ["WPMS", "무선발표"],
  },
  {
    key: NEWS_BOARD,
    label: "소식",
    emoji: "📣",
    // 아무 데도 안 걸린 글이 모이는 자리 — hint 를 두지 않는다
  },
];

const norm = (s: string) => s.toLowerCase().replace(/\s/g, "");

/** 이 글이 어느 게시판 글인가 */
export function boardKeyOf(post: CardPost): string {
  // 1) 이미 게시판이 정해진 글 (WPMS 원고 등)
  if (post.boardOnly) {
    const hit = oddsbagBoards.find((b) => b.key === post.boardOnly);
    if (hit) return hit.key;
    return post.boardOnly; // 명부에 없는 게시판이라도 값 그대로 존중
  }

  const slug = norm(post.slug);
  const tags = (post.tags ?? []).map(norm);

  for (const b of oddsbagBoards) {
    if (b.key === NEWS_BOARD) continue;
    if (b.slugHints?.some((h) => slug.includes(norm(h)))) return b.key;
    if (b.tagHints?.some((h) => tags.includes(norm(h)))) return b.key;
  }
  return NEWS_BOARD;
}

export const boardOf = (key: string): Board | undefined =>
  oddsbagBoards.find((b) => b.key === key);

/** 실제로 글이 있는 게시판만, 명부 순서대로 (탭 만들 때 쓴다) */
export function boardsWithPosts(posts: CardPost[]): { board: Board; count: number }[] {
  const count = new Map<string, number>();
  for (const p of posts) {
    const k = boardKeyOf(p);
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  return oddsbagBoards
    .filter((b) => (count.get(b.key) ?? 0) > 0)
    .map((b) => ({ board: b, count: count.get(b.key) as number }));
}
