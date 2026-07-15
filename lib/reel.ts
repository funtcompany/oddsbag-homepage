// 릴스/쇼츠 공용 로직 — 세로 1080×1920 영상용.
//  · 카드 시퀀스는 인스타 캐러셀과 동일(buildCards)하게 재사용한다.
//  · 여기서는 (1) 카드별 나레이션 문구 (2) 자연스러운 줄바꿈 (3) 무드 팔레트
//    (4) 카테고리별 BGM 스타일 을 담당한다.
//
// 실제 프레임 이미지는 /api/reel/[slug] 라우트가 이 로직으로 렌더한다.
// 영상 합성(프레임 이어붙이기 + 나레이션 + BGM)은 별도 '영상 공장'이 담당한다.

import type { Card } from "@/lib/cards";

// 애니메이션 규격 (영상 공장과 반드시 동일해야 함)
export const REEL_W = 1080;
export const REEL_H = 1920;
export const REEL_FPS = 30;
export const ENTER_SEC = 0.62; // 글자가 떠오르는 시간
export const ENTER_FRAMES = Math.round(ENTER_SEC * REEL_FPS); // = 19

// 카드별 나레이션 문구 (TTS로 읽을 텍스트)
export function reelSay(card: Card): string {
  switch (card.kind) {
    case "hook":
    case "intro":
      return card.title.replace(/\n/g, " ");
    case "point":
      return card.body ? `${card.title}. ${card.body}` : card.title;
    case "quote":
      return `오즈백 한 줄 정리. ${card.title}`;
    case "cta":
      return "전체 글은 오즈백 매거진에서 확인하세요.";
    default:
      return card.title.replace(/\n/g, " ");
  }
}

// 띄어쓰기(어절) 단위로만 줄바꿈 → 단어 중간이 안 잘린다.
// 한글은 넓게, 영문/기호/공백은 좁게 폭을 계산해 실제 너비에 맞춘다.
export function wrapLines(text: string, fontSize: number, ls = 0, avail = 880): string[] {
  const wide = (ch: string) => /[가-힣　-〿一-鿿＀-￯]/.test(ch);
  const measure = (s: string) => {
    let w = 0;
    for (const ch of s) w += (wide(ch) ? fontSize * 0.98 : fontSize * 0.52) + ls;
    return w;
  };
  const out: string[] = [];
  for (const seg of text.split("\n")) {
    const words = seg.split(" ");
    let cur = "";
    for (const wd of words) {
      const trial = cur ? cur + " " + wd : wd;
      if (!cur || measure(trial) <= avail) cur = trial;
      else { out.push(cur); cur = wd; }
    }
    if (cur) out.push(cur);
  }
  return out;
}

export const easeOut = (p: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 3);

// ---- 무드 팔레트 (게시물마다 고정, 인스타 카드와 동일 계열) ----
export type Pal = { bg: string; ink: string; sub: string; accent: string; onAccent: string };
const PALETTES: Record<string, Pal[]> = {
  serious: [
    { bg: "#14181f", ink: "#ffffff", sub: "#9aa7b8", accent: "#ffd23f", onAccent: "#14181f" },
    { bg: "#1b2029", ink: "#ffffff", sub: "#a2adbd", accent: "#7dd3fc", onAccent: "#14181f" },
  ],
  trust: [
    { bg: "#0f2f4a", ink: "#ffffff", sub: "#9fc3dd", accent: "#ffe066", onAccent: "#0f2f4a" },
    { bg: "#10394d", ink: "#ffffff", sub: "#a6cbd8", accent: "#5eead4", onAccent: "#08303f" },
  ],
  energetic: [
    { bg: "#c2185b", ink: "#ffffff", sub: "#ffd0e2", accent: "#ffe600", onAccent: "#8c1043" },
    { bg: "#d94f2b", ink: "#ffffff", sub: "#ffd8cb", accent: "#ffe600", onAccent: "#8a2f16" },
  ],
  soft: [
    { bg: "#f3ecff", ink: "#2c1a52", sub: "#6b5a90", accent: "#7b4fb5", onAccent: "#ffffff" },
    { bg: "#fff1e8", ink: "#4a2618", sub: "#8a6553", accent: "#e0603a", onAccent: "#ffffff" },
  ],
  trendy: [
    { bg: "#1c1530", ink: "#ffffff", sub: "#b3a6cf", accent: "#ffe600", onAccent: "#1c1530" },
    { bg: "#241a3d", ink: "#ffffff", sub: "#bcaee0", accent: "#4ade80", onAccent: "#123021" },
  ],
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
export function paletteFor(slug: string, mood?: string): Pal {
  const list = PALETTES[mood ?? "trendy"] ?? PALETTES.trendy;
  return list[hash(slug) % list.length];
}

// ---- 카테고리별 BGM 스타일 (영상 공장이 참고) ----
export function bgmStyleFor(category: string): string {
  return ({
    "IT·테크": "synthwave",
    트렌드: "synthwave",
    스포츠: "energetic",
    경제: "newsy",
    사회: "newsy",
    "문화·연예": "lofi",
  } as Record<string, string>)[category] || "lofi";
}
