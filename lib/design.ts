// 생성형 디자인 엔진 (서버/클라 공용, 결정적)
// 기사 slug로 시드를 고정 → 각 기사는 자기만의 고유 디자인.
// 배경 = 기사 무드, 포인트 = 현재 계절/트렌드 컬러. 가독성은 규칙으로 보장.

import type { Post } from "@/lib/posts";
import type { CSSProperties } from "react";

// ---- 시드 RNG ----
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length)];

// ---- 무드 → 배경 톤 ----
interface Ground {
  bg: string;
  t: string;
  light: boolean;
}
const MOOD_GROUNDS: Record<string, Ground[]> = {
  serious: [
    { bg: "#1f2430", t: "#fff", light: true },
    { bg: "#242a3d", t: "#fff", light: true },
    { bg: "#2b2733", t: "#fff", light: true },
  ],
  trust: [
    { bg: "#0f3d5c", t: "#fff", light: true },
    { bg: "#123f3a", t: "#fff", light: true },
    { bg: "#17325c", t: "#fff", light: true },
  ],
  energetic: [
    { bg: "linear-gradient(140deg,#ff5e6c,#c2185b)", t: "#fff", light: true },
    { bg: "#1a1340", t: "#fff", light: true },
    { bg: "linear-gradient(150deg,#ff8a3d,#e0473c)", t: "#fff", light: true },
  ],
  soft: [
    { bg: "#efe6ff", t: "#3a1e6e", light: false },
    { bg: "#ffe9dd", t: "#7a3b2e", light: false },
    { bg: "#e5f3ee", t: "#1f5c47", light: false },
  ],
  trendy: [
    { bg: "linear-gradient(140deg,#6a2cff,#b06bff)", t: "#fff", light: true },
    { bg: "#12121c", t: "#fff", light: true },
    { bg: "linear-gradient(150deg,#0f2b5c,#7b2df5)", t: "#fff", light: true },
  ],
  culture: [
    { bg: "#2a1240", t: "#fff", light: true },
    { bg: "#3a1030", t: "#fff", light: true },
    { bg: "#141a3a", t: "#fff", light: true },
  ],
};
const MOOD_LABEL: Record<string, string> = {
  serious: "시사·진중",
  trust: "신뢰·정보",
  energetic: "활기·역동",
  soft: "감성",
  trendy: "트렌디",
  culture: "문화",
};
const CATEGORY_MOOD: Record<string, string> = {
  사회: "serious",
  경제: "trust",
  스포츠: "energetic",
  "IT·테크": "trendy",
  "문화·연예": "soft",
  트렌드: "soft",
};

// ---- 계절/트렌드 → 포인트 컬러 ----
const SEASON_ACCENTS: Record<string, string[]> = {
  spring: ["#ffbe98", "#8fd98a", "#c9b8ff", "#ff9ec7"],
  summer: ["#ffd23f", "#2ec5ff", "#ff6b5c", "#a3e635"],
  autumn: ["#e0912f", "#c05621", "#d4a017", "#b5651d"],
  winter: ["#7cc4ff", "#c9a3ff", "#e2ebf7", "#ffe600"],
};
function currentSeason(): keyof typeof SEASON_ACCENTS {
  const m = new Date().getMonth() + 1; // 런타임 월
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

// 차분한 배경만 유지 (하프톤/컨페티/리소/스트라이프 등 노이즈 패턴 제거)
const FX = [
  "plain", "mesh", "spotlight", "glow", "grid", "waves", "blobs",
] as const;
const LAYOUTS = ["bottom", "center", "topband", "bignum", "sidebar", "block"] as const;
const MOTIFS = ["none", "shape", "corner", "underline", "dots"] as const;
const SCALES = [0.94, 1, 1.06];

export interface Design {
  bg: string;
  title: string;
  accent: string;
  catColor: string; // 카테고리/아이브로 글자색 (배경 대비 확보)
  sub: string;
  wm: string;
  light: boolean;
  scrim: string; // '#000' | '#fff'
  fx: (typeof FX)[number];
  layout: (typeof LAYOUTS)[number];
  motif: (typeof MOTIFS)[number];
  scale: number;
  moodLabel: string;
  emoji: string;
}

export function getDesign(post: Post): Design {
  // AI가 판별한 무드 우선, 없으면 카테고리 기본값
  const mood =
    (post.mood && MOOD_GROUNDS[post.mood] ? post.mood : undefined) ||
    CATEGORY_MOOD[post.category] ||
    "trendy";
  const r = mulberry32(hashStr(post.slug + "::" + currentSeason()));
  const g = pick(r, MOOD_GROUNDS[mood] ?? MOOD_GROUNDS.trendy);
  const accent = pick(r, SEASON_ACCENTS[currentSeason()]);
  const light = g.light;
  return {
    bg: g.bg,
    title: g.t,
    accent,
    // 밝은 배경에선 밝은 포인트색이 안 보이므로 진한 제목색을 글자에 사용
    catColor: light ? accent : g.t,
    sub: light ? "rgba(255,255,255,.72)" : "rgba(0,0,0,.5)",
    wm: g.t,
    light,
    scrim: light ? "#000" : "#fff",
    fx: pick(r, FX as unknown as (typeof FX)[number][]),
    layout: pick(r, LAYOUTS as unknown as (typeof LAYOUTS)[number][]),
    motif: pick(r, MOTIFS as unknown as (typeof MOTIFS)[number][]),
    scale: pick(r, SCALES),
    moodLabel: MOOD_LABEL[mood] ?? "",
    emoji: post.emoji ?? "📰",
  };
}

// 배경 패턴 CSS (accent 색으로 은은하게)
export function fxStyle(fx: string, a: string): CSSProperties {
  switch (fx) {
    case "mesh":
      return { background: `radial-gradient(65% 70% at 20% 15%,${a}3a,transparent 60%),radial-gradient(55% 60% at 92% 35%,${a}24,transparent 55%)` };
    case "spotlight":
      return { background: `radial-gradient(55% 55% at 72% 20%,${a}33,transparent 65%)` };
    case "glow":
      return { background: `radial-gradient(80% 60% at 50% 105%,${a}3a,transparent 60%)` };
    case "grid":
      return { backgroundImage: `linear-gradient(${a}14 1px,transparent 1px),linear-gradient(90deg,${a}14 1px,transparent 1px)`, backgroundSize: "38px 38px" };
    case "waves":
      return { backgroundImage: `repeating-linear-gradient(0deg,${a}0d 0 2px,transparent 2px 22px)` };
    default:
      return {};
  }
}

export function titleFontPx(len: number, base: number): number {
  if (len > 28) return base - 4;
  if (len > 22) return base - 2.5;
  if (len > 16) return base - 1;
  return base;
}
