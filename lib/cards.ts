// 인스타그램 캐러셀 카드 구성 (5~10장)
//
// 사진이 없어도 밀리지 않게 — 타이포그래피와 레이아웃 자체를 강점으로.
// 본문의 '## 소제목' 구조를 그대로 카드로 쪼갠다.
//
//  1장  HOOK   — 스크롤 멈추게 하는 한 줄 (썸네일)
//  2장  INTRO  — 무슨 일인지 한 문단
//  3~n  POINT  — 소제목 + 핵심 문장
//  끝장 CTA    — 전체 글 보기

import type { Post } from "@/lib/posts";

export type CardKind = "hook" | "intro" | "point" | "quote" | "cta";

export interface Card {
  kind: CardKind;
  label?: string; // 상단 작은 라벨 (카테고리 / 01 / 02 …)
  title: string;
  body?: string;
}

const MAX_BODY = 150;

function clip(s: string, n = MAX_BODY): string {
  const t = s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const dot = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("다"), cut.lastIndexOf("요"));
  return (dot > n * 0.55 ? cut.slice(0, dot + 1) : cut) + (dot > n * 0.55 ? "" : "…");
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

  points.slice(0, 6).forEach((s, i) => {
    cards.push({
      kind: "point",
      label: String(i + 1).padStart(2, "0"),
      title: s.heading,
      body: clip(s.text),
    });
  });

  // 4) 오즈백 한 줄 정리 → 인용 카드
  if (closing?.text) {
    cards.push({ kind: "quote", label: "오즈백 한 줄 정리", title: clip(closing.text, 120) });
  }

  // 5) CTA
  cards.push({
    kind: "cta",
    label: "@oddsbag_official",
    title: "전체 글은\n오즈백 매거진에서",
    body: "프로필 링크 → oddsbag.co.kr",
  });

  // 인스타 캐러셀 최대 10장
  return cards.slice(0, 10);
}

// 인스타 캡션 (해시태그 = SNS 유입 SEO)
export function buildCaption(post: Post): string {
  const base = [post.hook || post.title, "", post.summary, "", "전체 글 → 프로필 링크 (oddsbag.co.kr)"]
    .filter((l) => l !== undefined)
    .join("\n");

  const catTags: Record<string, string[]> = {
    사회: ["#사회이슈", "#뉴스", "#시사"],
    경제: ["#경제", "#재테크", "#경제뉴스"],
    스포츠: ["#스포츠", "#스포츠뉴스"],
    "IT·테크": ["#IT", "#테크", "#인공지능"],
    "문화·연예": ["#연예", "#문화", "#엔터"],
    트렌드: ["#트렌드", "#요즘", "#밈"],
  };
  const tags = [
    "#오즈백",
    "#ODDSBAG",
    ...(catTags[post.category] ?? ["#이슈"]),
    ...(post.tags ?? []).slice(0, 4).map((t) => "#" + t.replace(/[\s#]/g, "")),
    "#오늘의이슈",
    "#issue",
    "#카드뉴스",
  ];
  return `${base}\n\n${[...new Set(tags)].join(" ")}`.slice(0, 2100);
}
