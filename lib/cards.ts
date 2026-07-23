// 인스타그램 캐러셀 카드 구성 (최대 10장)
//
// 【원칙】 정보는 이 게시물 안에서 끝난다.
//   홈페이지로 넘어가야 알 수 있는 '티저'로 만들지 않는다. (링크 전환율은 낮다)
//   제목이 "숨은 기능 7가지"면 7가지가 카드 안에 전부 들어있어야 한다.
//
//  1장  HOOK   — 스크롤 멈추게 하는 한 줄 (썸네일)
//  2장  INTRO  — 무슨 일인지 한 문단
//  3~n  POINT  — 소제목 + 핵심 문장 (자리 되는 만큼 전부)
//  끝장 CTA    — 저장 + 팔로우(미리 알림)
//
// ※ content-factory/cards.mjs 와 항상 같은 구성이어야 한다 (게시 장수 ↔ 렌더 장수 일치).

import type { Post } from "@/lib/posts";

export type CardKind = "hook" | "intro" | "point" | "quote" | "cta";

export interface Card {
  kind: CardKind;
  label?: string; // 상단 작은 라벨 (카테고리 / 01 / 02 …)
  title: string;
  body?: string;
}

const MAX_BODY = 180; // 정보를 담아야 하므로 조금 넉넉히 (가독성 한계 안에서)
const MAX_CARDS = 10; // 인스타 그래프 API 캐러셀 상한

// 큰 정밀 숫자를 읽기 좋게 반올림: "1463만2347점" → "약 1,463만 점" (눈으로도, TTS로도 편하게)
export function humanizeNum(s: string): string {
  return String(s)
    .replace(/(\d+)만\s?(\d{3,4})\s*([점원명건개표배호]?)/g, (_m, a: string, _b: string, unit: string) => `약 ${Number(a).toLocaleString()}만${unit ? " " + unit : ""}`)
    .replace(/(\d+)억\s?(\d{3,5})(?!\s*원)/g, (_m, a: string) => `약 ${Number(a).toLocaleString()}억`);
}

// 카드 본문 발췌: 예산(n자) 안에서 '완결된 문장'까지만. 단어/문장 중간은 절대 안 자른다.
function clip(s: string, n = MAX_BODY): string {
  const t = humanizeNum(s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim());
  if (t.length <= n) return t;
  const sentences = t.split(/(?<=[.!?])\s+/).filter(Boolean); // 종결부호+공백에서만 → 소수점 안 쪼갬
  let out = "";
  for (const sen of sentences) {
    if (out && (out + " " + sen).length > n) break;
    out = out ? out + " " + sen : sen;
  }
  return (out || sentences[0]).trim();
}

interface Section {
  heading: string;
  text: string;
}

function parseSections(body: string): Section[] {
  const out: Section[] = [];
  let cur: Section | null = null;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) {
      if (cur) out.push(cur);
      cur = { heading: line.slice(3).trim(), text: "" };
    } else if (cur) {
      cur.text += (cur.text ? " " : "") + line.replace(/^-\s*/, "");
    }
  }
  if (cur) out.push(cur);
  return out.filter((s) => s.heading);
}

export function buildCards(post: Post): Card[] {
  const cards: Card[] = [];

  // 1) 훅
  cards.push({
    kind: "hook",
    label: post.category,
    title: (post.hook || post.title).trim(),
  });

  // 2) 인트로
  if (post.summary) {
    cards.push({ kind: "intro", label: "무슨 일이냐면", title: clip(post.summary, 110) });
  }

  // 3) 본문 섹션
  const sections = parseSections(post.body);
  const closing = sections.find((s) => s.heading.includes("한 줄 정리"));
  const points = sections.filter((s) => !s.heading.includes("한 줄 정리"));

  // 정보가 잘리면 안 되므로 요점 카드를 최우선으로 채운다.
  // (마지막 CTA 1장은 항상 확보 — 그 나머지를 전부 요점에 쓴다)
  const roomForPoints = MAX_CARDS - cards.length - 1;
  points.slice(0, roomForPoints).forEach((s, i) => {
    cards.push({
      kind: "point",
      label: String(i + 1).padStart(2, "0"),
      title: s.heading,
      body: clip(s.text),
    });
  });

  // 4) 오즈백 한 줄 정리 — 요점을 다 넣고도 자리가 남을 때만
  if (closing?.text && cards.length < MAX_CARDS - 1) {
    cards.push({ kind: "quote", label: "오즈백 한 줄 정리", title: clip(closing.text, 120) });
  }

  // 5) 마무리 — 저장 + 팔로우(미리 알림). 홈페이지 유입에 기대지 않는다.
  cards.push({
    kind: "cta",
    label: "@oddsbag_official",
    title: "저장해두면\n필요할 때 바로 꺼내 봅니다",
    body: "팔로우하면 다음 정보·일정을 미리 알려드려요",
  });

  return cards.slice(0, MAX_CARDS);
}

// 인스타 캡션 — 본문은 깔끔하게 (해시태그는 첫 댓글+대댓글로 분리)
//  캡션에 태그를 몰아넣으면 지저분해 보인다. 그래서 캡션은 훅+요약+행동유도만,
//  해시태그 30개는 buildHashtags 로 뽑아 대댓글에 붙인다 (social.ts).
//  【원칙】 링크로 넘기지 않는다 — 정보는 게시물 안에서 끝나고, CTA는 저장·팔로우다.
export function buildCaption(post: Post): string {
  return [
    post.hook || post.title,
    "",
    post.summary,
    "",
    "📌 저장해두면 필요할 때 바로 꺼내 볼 수 있어요",
    "🔔 팔로우하면 다음 정보·일정을 미리 알려드려요 → @oddsbag_official",
  ]
    .filter((l) => l !== undefined)
    .join("\n")
    .slice(0, 2100);
}

// 첫 댓글에 붙일 이모지 하나 (글마다 고정) — 게시물 성격을 한눈에
const CATEGORY_EMOJI: Record<string, string> = {
  사회: "📰",
  경제: "💸",
  스포츠: "🏟️",
  "IT·테크": "🤖",
  "문화·연예": "🎬",
  트렌드: "🔥",
};
export function firstCommentEmoji(post: Post): string {
  return post.emoji || CATEGORY_EMOJI[post.category] || "🔎";
}

// 대댓글용 해시태그 (기본 30개) — 검색 유입용
//  가장 관련 있는 태그(브랜드 → 카테고리 → 글 태그)를 앞에 두고 30개로 자른다.
const CATEGORY_TAGS: Record<string, string[]> = {
  사회: ["#사회이슈", "#뉴스", "#시사", "#오늘의뉴스", "#속보", "#뉴스요약", "#사회", "#세상소식"],
  경제: ["#경제", "#재테크", "#경제뉴스", "#주식", "#부동산", "#투자", "#돈버는법", "#경제상식"],
  스포츠: ["#스포츠", "#스포츠뉴스", "#축구", "#야구", "#스포츠이슈", "#경기결과", "#스포츠하이라이트", "#운동"],
  "IT·테크": ["#IT", "#테크", "#인공지능", "#AI", "#IT뉴스", "#챗지피티", "#신기술", "#가젯"],
  "문화·연예": ["#연예", "#문화", "#엔터", "#연예뉴스", "#드라마", "#영화", "#kpop", "#셀럽"],
  트렌드: ["#트렌드", "#요즘", "#밈", "#요즘트렌드", "#핫이슈", "#급상승", "#챌린지", "#요즘것들"],
};
const COMMON_TAGS = [
  "#오늘의이슈", "#이슈", "#핫이슈", "#뉴스레터", "#카드뉴스", "#이슈정리", "#요약",
  "#정보", "#꿀팁", "#instadaily", "#issue", "#news", "#trending", "#dailynews",
];
export function buildHashtags(post: Post, max = 30): string {
  const pool = [
    "#오즈백",
    "#ODDSBAG",
    ...(CATEGORY_TAGS[post.category] ?? ["#이슈", "#뉴스"]),
    ...(post.tags ?? []).map((t) => "#" + t.replace(/[\s#]/g, "")),
    ...COMMON_TAGS,
  ];
  const uniq = [...new Set(pool.filter((t) => t.length > 1))];
  return uniq.slice(0, max).join(" ");
}
