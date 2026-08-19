// 목록 화면(카드·리스트)이 쓰는 «가벼운 글» 형태
//
// ★왜 따로 두나 — 목록은 클라이언트 컴포넌트(보기 전환·게시판 탭)로 그린다.
//   Post 를 통째로 넘기면 본문(body)까지 HTML 안에 직렬화돼 실려 나간다.
//   매거진처럼 글이 수십 편인 화면에서는 그것만으로 페이지가 수백 KB 불어난다.
//   → 목록이 실제로 쓰는 칸만 골라 넘긴다.
//
// 이 파일은 fs·redis 를 부르지 않는다 (lib/posts.ts 와 달리 클라이언트에서도 안전).

import type { ChannelKey } from "@/lib/channels";

export interface CardPost {
  slug: string;
  title: string;
  summary: string;
  category: string;
  date: string;
  channel?: ChannelKey;
  emoji?: string;
  mood?: string;
  cover?: string;
  readMinutes?: number;
  tags?: string[];
  /** 서비스 게시판 전용 글이면 그 게시판 slug */
  boardOnly?: string;
}

/** 목록에 넘기기 전에 본문을 떼어낸다 */
export function toCardPost(p: CardPost & { body?: string }): CardPost {
  return {
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    category: p.category,
    date: p.date,
    channel: p.channel,
    emoji: p.emoji,
    mood: p.mood,
    cover: p.cover,
    readMinutes: p.readMinutes,
    tags: p.tags,
    boardOnly: p.boardOnly,
  };
}

export const toCardPosts = (list: (CardPost & { body?: string })[]): CardPost[] =>
  list.map(toCardPost);
