// 세로 릴스 화면(1080×1920) 자체 렌더링 — satori(글자→벡터) + resvg(PNG).
// 홈페이지 /api/reel 라우트와 동일한 디자인을 공장 안에서 직접 그린다 (Vercel 불필요).
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

export const W = 1080, H = 1920, FPS = 30;
export const ENTER_SEC = 0.62;
export const ENTER_FRAMES = Math.round(ENTER_SEC * FPS);

// ---- 무드 팔레트 (게시물마다 고정) ----
const PALETTES = {
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
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); }
export function paletteFor(slug, mood) { const list = PALETTES[mood] ?? PALETTES.trendy; return list[hash(slug) % list.length]; }

export const bgmStyleFor = (cat) => ({ "IT·테크": "synthwave", "트렌드": "synthwave", "스포츠": "energetic", "경제": "newsy", "사회": "newsy", "문화·연예": "lofi" }[cat] || "lofi");

// ---- 카드 시퀀스 (홈페이지 buildCards 와 동일) ----
function clip(s, n = 150) {
  const t = s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n); const dot = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("다"), cut.lastIndexOf("요"));
  return dot > n * 0.55 ? cut.slice(0, dot + 1) : cut + "…";
}
function parseSections(body) {
  const out = []; let cur = null;
  for (const raw of (body || "").split("\n")) {
    const line = raw.trim(); if (!line) continue;
    if (line.startsWith("## ")) { if (cur) out.push(cur); cur = { heading: line.slice(3).trim(), text: "" }; }
    else if (cur) cur.text += (cur.text ? " " : "") + line.replace(/^-\s*/, "");
  }
  if (cur) out.push(cur);
  return out.filter((s) => s.heading);
}
export function buildCards(post) {
  const cards = [];
  cards.push({ kind: "hook", label: post.category, title: (post.hook || post.title).trim() });
  if (post.summary) cards.push({ kind: "intro", label: "무슨 일이냐면", title: clip(post.summary, 110) });
  const secs = parseSections(post.body);
  const closing = secs.find((s) => s.heading.includes("한 줄 정리"));
  secs.filter((s) => !s.heading.includes("한 줄 정리")).slice(0, 6).forEach((s, i) => cards.push({ kind: "point", label: String(i + 1).padStart(2, "0"), title: s.heading, body: clip(s.text) }));
  if (closing?.text) cards.push({ kind: "quote", label: "오즈백 한 줄 정리", title: clip(closing.text, 120) });
  cards.push({ kind: "cta", label: "@oddsbag_official", title: "전체 글은\n오즈백 매거진에서", body: "프로필 링크 → oddsbag.co.kr" });
  return cards.slice(0, 8);
}
export function reelSay(card) {
  switch (card.kind) {
    case "hook": case "intro": return card.title.replace(/\n/g, " ");
    case "point": return card.body ? `${card.title}. ${card.body}` : card.title;
    case "quote": return `오즈백 한 줄 정리. ${card.title}`;
    case "cta": return "전체 글은 오즈백 매거진에서 확인하세요.";
    default: return card.title.replace(/\n/g, " ");
  }
}

// ---- 줄바꿈 (어절 단위, 한글/영문 폭 반영) ----
function wrapLines(text, fontSize, ls = 0, avail = 880) {
  const wide = (ch) => /[가-힣　-〿一-鿿＀-￯]/.test(ch);
  const measure = (s) => { let w = 0; for (const ch of s) w += (wide(ch) ? fontSize * 0.98 : fontSize * 0.52) + ls; return w; };
  const out = [];
  for (const seg of text.split("\n")) {
    const words = seg.split(" "); let cur = "";
    for (const wd of words) { const t = cur ? cur + " " + wd : wd; if (!cur || measure(t) <= avail) cur = t; else { out.push(cur); cur = wd; } }
    if (cur) out.push(cur);
  }
  return out;
}
const easeOut = (p) => 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 3);

// ---- 폰트 (구글폰트 서브셋) + 이모지 ----
async function loadFont(text, weight) {
  const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/533.20.25 (KHTML, like Gecko) Version/5.0.4 Safari/533.20.27" } })).text();
  const m = css.match(/src:\s*url\((https:\/\/[^)]+)\)/);
  return await (await fetch(m[1])).arrayBuffer();
}
export async function loadFontsForPost(cards) {
  const text = cards.map((c) => (c.label || "") + c.title + (c.body || "")).join("") + "ODDSBAG@oddsbag_official오즈백매거진전체글프로필링크0123456789/·무슨 일이냐면 한 줄 정리";
  const [bold, mid] = await Promise.all([loadFont(text, 900), loadFont(text, 500)]);
  return [{ name: "Noto", data: bold, weight: 900, style: "normal" }, { name: "Noto", data: mid, weight: 500, style: "normal" }];
}
function toCodePoint(str) { const cps = []; for (const ch of str) { const cp = ch.codePointAt(0); if (cp !== 0xfe0f) cps.push(cp.toString(16)); } return cps.join("-"); }
async function emojiSvg(seg) { try { const r = await fetch(`https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${toCodePoint(seg)}.svg`); if (!r.ok) return ""; return `data:image/svg+xml;base64,${Buffer.from(await r.text()).toString("base64")}`; } catch { return ""; } }

const el = (type, style, children) => ({ type, props: { style, children } });

function frame(post, card, idx, total, t, pal) {
  const p = pal;
  const big = card.kind === "hook";
  const photoBg = big && post.cover;
  const titleSize = big ? (card.title.length > 24 ? 92 : card.title.length > 14 ? 108 : 122) : card.kind === "quote" || card.kind === "cta" ? 76 : 68;
  const eLabel = easeOut(t / 0.4), eTitle = easeOut((t - 0.08) / 0.42), eBody = easeOut((t - 0.18) / 0.42), eEmoji = easeOut((t - 0.02) / 0.5);
  const ink = photoBg ? "#ffffff" : p.ink, sub = photoBg ? "rgba(255,255,255,.85)" : p.sub;
  const kids = [];

  if (photoBg) {
    kids.push(el("img", { position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover" }, ""));
    kids[kids.length - 1].props.src = post.cover;
    kids.push(el("div", { position: "absolute", top: 0, left: 0, width: W, height: H, background: "linear-gradient(180deg, rgba(10,6,20,0.45) 0%, rgba(10,6,20,0.92) 100%)" }, ""));
  }
  // 진행바
  const seg = [];
  for (let i = 0; i < total; i++) seg.push(el("div", { display: "flex", flex: 1, height: 8, borderRadius: 999, marginRight: i < total - 1 ? 10 : 0, background: i <= idx ? p.accent : "rgba(255,255,255,0.22)" }, ""));
  kids.push(el("div", { display: "flex", position: "absolute", top: 40, left: 56, width: W - 112 }, seg));
  kids.push(el("div", { position: "absolute", top: 0, left: 0, width: 16, height: H, background: p.accent }, ""));
  // 브랜드
  kids.push(el("div", { display: "flex", alignItems: "center", padding: "84px 84px 0 84px" }, [
    el("div", { display: "flex", width: 58, height: 58, borderRadius: 16, background: p.accent, color: p.onAccent, fontSize: 38, fontWeight: 900, alignItems: "center", justifyContent: "center", marginRight: 18 }, "O"),
    el("div", { display: "flex", fontSize: 40, fontWeight: 900, color: photoBg ? "#fff" : p.ink, letterSpacing: -1 }, "ODDSBAG"),
    el("div", { display: "flex", flex: 1 }, ""),
    el("div", { display: "flex", fontSize: 30, fontWeight: 700, color: sub }, `${idx + 1} / ${total}`),
  ]));
  // 본문
  const body = [];
  if (big && !photoBg) body.push(el("div", { display: "flex", flex: 1, alignItems: "center", opacity: eEmoji, transform: `translateY(${(1 - eEmoji) * 40}px)`, fontSize: 300 }, post.emoji || "📰"));
  if (card.label) body.push(el("div", { display: "flex", alignSelf: "flex-start", opacity: eLabel, transform: `translateY(${(1 - eLabel) * 30}px)`, background: card.kind === "point" ? "transparent" : p.accent, color: card.kind === "point" ? p.accent : p.onAccent, fontSize: card.kind === "point" ? 52 : 32, fontWeight: 900, padding: card.kind === "point" ? "0" : "14px 30px", borderRadius: 999, marginBottom: 30 }, card.label));
  const titleLines = wrapLines(card.title, titleSize, -2.5);
  body.push(el("div", { display: "flex", flexDirection: "column", opacity: eTitle, transform: `translateY(${(1 - eTitle) * 44}px)` }, titleLines.map((ln) => el("div", { display: "flex", fontSize: titleSize, fontWeight: 900, color: ink, lineHeight: 1.18, letterSpacing: -2.5 }, ln))));
  body.push(el("div", { display: "flex", marginTop: 26, width: 60 + eTitle * 140, height: 10, borderRadius: 999, background: p.accent }, ""));
  if (card.body) { const bl = wrapLines(card.body, 46, 0); body.push(el("div", { display: "flex", flexDirection: "column", marginTop: 34, opacity: eBody, transform: `translateY(${(1 - eBody) * 36}px)` }, bl.map((ln) => el("div", { display: "flex", fontSize: 46, fontWeight: 500, color: sub, lineHeight: 1.5 }, ln)))); }
  kids.push(el("div", { display: "flex", flexDirection: "column", flex: 1, justifyContent: big ? "flex-end" : "center", padding: "0 84px 220px 84px" }, body));
  kids.push(el("div", { display: "flex", position: "absolute", bottom: 90, left: 84, fontSize: 32, fontWeight: 800, color: sub }, "@oddsbag_official"));

  return el("div", { width: W, height: H, display: "flex", flexDirection: "column", background: p.bg, position: "relative", fontFamily: "Noto" }, kids);
}

export async function renderFrame(post, cards, idx, total, t, fonts, pal) {
  const svg = await satori(frame(post, cards[idx], idx, total, t, pal), { width: W, height: H, fonts, loadAdditionalAsset: async (code, s) => (code === "emoji" ? emojiSvg(s) : "") });
  return new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
}
