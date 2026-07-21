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
// 큰 정밀 숫자를 읽기 좋게 반올림: "1463만2347점" → "약 1,463만 점" (눈으로도, TTS로도 편하게)
export function humanizeNum(s) {
  return String(s)
    .replace(/(\d+)만\s?(\d{3,4})\s*([점원명건개표배호]?)/g, (_, a, _b, unit) => `약 ${Number(a).toLocaleString()}만${unit ? " " + unit : ""}`)
    .replace(/(\d+)억\s?(\d{3,5})(?!\s*원)/g, (_, a) => `약 ${Number(a).toLocaleString()}억`);
}
// 릴스 카드용 본문 발췌: 예산(n자) 안에서 '완결된 문장'까지만 담는다. 단어/문장 중간은 절대 안 자른다.
function clip(s, n = 150) {
  const t = humanizeNum(s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim());
  if (t.length <= n) return t;
  // 문장 끝(. ! ? 뒤 공백)으로 분리 — '다'가 단어 중간에 있어도 안 자르도록 진짜 종결부호만 사용
  const sentences = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  let out = "";
  for (const sen of sentences) {
    if (out && (out + " " + sen).length > n) break; // 다음 문장 넣으면 예산 초과 → 여기까지(완결)
    out = out ? out + " " + sen : sen;
  }
  // 첫 문장 하나도 예산을 넘으면, 그 문장만은 통째로 보여준다(중간에 안 자름)
  return (out || sentences[0]).trim();
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
  if (post.summary) cards.push({ kind: "intro", label: "무슨 일이냐면", title: clip(post.summary, 90) });
  const secs = parseSections(post.body);
  const closing = secs.find((s) => s.heading.includes("한 줄 정리"));
  // 숏폼(20~40초) 최적화: 핵심 포인트 3개 + 본문 짧게(낭독·가독성 둘 다 개선)
  secs.filter((s) => !s.heading.includes("한 줄 정리")).slice(0, 3).forEach((s, i) => cards.push({ kind: "point", label: String(i + 1).padStart(2, "0"), title: s.heading, body: clip(s.text, 120) }));
  if (closing?.text) cards.push({ kind: "quote", label: "오즈백 한 줄 정리", title: clip(closing.text, 100) });
  cards.push({ kind: "cta", label: "@oddsbag_official", title: "전체 글은\n오즈백 매거진에서", body: "프로필 링크 → oddsbag.co.kr" });
  return cards.slice(0, 6);
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
// 자연스러운 한글 줄바꿈:
//  ① 숫자+단위(1억 개 / 13일 / 30 %)는 한 덩어리로 붙여 절대 안 쪼갬
//  ② 줄 길이를 고르게 맞춤(왼쪽부터 꽉 채우지 않음) — 균형 줄바꿈
//  ③ 마지막에 한 단어만 남는 '외톨이 줄' 방지
function wrapLines(text, fontSize, ls = 0, avail = 880) {
  const wide = (ch) => /[가-힣　-〿一-鿿＀-￯]/.test(ch);
  const measure = (s) => { let w = 0; for (const ch of s) w += (wide(ch) ? fontSize * 0.98 : fontSize * 0.52) + ls; return w; };
  const spaceW = measure(" ");
  const uw = (u) => u.reduce((s, x, i) => s + measure(x) + (i ? spaceW : 0), 0); // 유닛배열 → 줄 폭
  // 앞 어절이 숫자로 끝나고, 뒤 어절이 단위/조사로 시작하면 붙인다(1억 개 / 13일 / 30 %)
  const COUNTER = /^[개명년월일원번위곳건장권대병잔캔알포매척벌줄평배호층종차정톤톨%퍼％]|^(개월|시간|퍼센트|만에|원어치)/;
  const glue = (a, b) => /[0-9조억만천백십]$/.test(a) && COUNTER.test(b);
  const quoteOpen = (s) => ((s.match(/['"'"「『]/g) || []).length % 2) === 1; // 따옴표가 열린 채면 true
  const out = [];
  for (const seg of text.split("\n")) {
    // 1) 어절 → 붙임 유닛으로 병합 (유닛은 절대 쪼개지 않음)
    //    · 숫자+단위(1억 개)   · 열린 따옴표 안의 구절('잘 팔린 약'을) — 폭주 방지로 최대 4어절
    const raw = seg.split(" ").filter(Boolean);
    if (!raw.length) continue;
    const units = [];
    for (const wd of raw) {
      const prev = units[units.length - 1];
      const inQuote = prev && quoteOpen(prev) && prev.split(" ").length < 4;
      if (prev && (glue(prev, wd) || inQuote)) units[units.length - 1] += " " + wd;
      else units.push(wd);
    }
    const total = uw(units);
    const L = Math.max(1, Math.ceil(total / avail)); // 필요한 최소 줄 수
    const target = total / L;                        // 줄마다 목표 폭(고르게)
    // 2) 목표 폭에 맞춰 균형 있게 채움 (avail은 절대 넘지 않음). 줄은 유닛배열로 유지
    const lines = []; let cur = [];
    for (const u of units) {
      const trial = uw([...cur, u]);
      const overflow = cur.length && trial > avail;
      const balanced = cur.length && uw(cur) >= target * 0.86 && lines.length < L - 1;
      if (overflow || balanced) { lines.push(cur); cur = []; }
      cur.push(u);
    }
    if (cur.length) lines.push(cur);
    // 3) 외톨이 줄 방지: 마지막 줄이 한 유닛뿐이면
    if (lines.length >= 2 && lines[lines.length - 1].length === 1) {
      const last = lines[lines.length - 1], prev = lines[lines.length - 2];
      if (uw([...prev, ...last]) <= avail) {
        lines.splice(lines.length - 2, 2, [...prev, ...last]);   // 윗줄에 합치기
      } else if (prev.length >= 2) {
        last.unshift(prev.pop());  // 윗줄 끝 단어를 아래로 내려 마지막 줄을 2단어로
      }
    }
    for (const l of lines) out.push(l.join(" "));
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
export async function loadFontsForPost(cards, extra = "") {
  const latin = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,-·:/&'()% "; // 출처·영문 이름 대비
  const text = cards.map((c) => (c.label || "") + c.title + (c.body || "")).join("") + "ODDSBAG@oddsbag_official오즈백매거진전체글프로필링크0123456789/·무슨 일이냐면 한 줄 정리영상출처" + latin + extra;
  const [bold, mid] = await Promise.all([loadFont(text, 900), loadFont(text, 500)]);
  return [{ name: "Noto", data: bold, weight: 900, style: "normal" }, { name: "Noto", data: mid, weight: 500, style: "normal" }];
}
function toCodePoint(str) { const cps = []; for (const ch of str) { const cp = ch.codePointAt(0); if (cp !== 0xfe0f) cps.push(cp.toString(16)); } return cps.join("-"); }
async function emojiSvg(seg) { try { const r = await fetch(`https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${toCodePoint(seg)}.svg`); if (!r.ok) return ""; return `data:image/svg+xml;base64,${Buffer.from(await r.text()).toString("base64")}`; } catch { return ""; } }

const el = (type, style, children) => ({ type, props: { style, children } });

function frame(post, card, idx, total, t, pal, opts = {}) {
  const p = pal;
  const broll = !!opts.transparent;            // B-roll 배경(영상이 뒤에서 비침) 모드
  const big = card.kind === "hook";
  const photoBg = big && post.cover && !broll;
  const overlayDark = photoBg || broll;         // 어두운 그라디언트 + 흰 글자
  const titleSize = big ? (card.title.length > 24 ? 92 : card.title.length > 14 ? 108 : 122) : card.kind === "quote" || card.kind === "cta" ? 76 : 68;
  const eLabel = easeOut(t / 0.4), eTitle = easeOut((t - 0.08) / 0.42), eBody = easeOut((t - 0.18) / 0.42), eEmoji = easeOut((t - 0.02) / 0.5);
  const ink = overlayDark ? "#ffffff" : p.ink, sub = overlayDark ? "rgba(255,255,255,.88)" : p.sub;
  const kids = [];

  if (photoBg) {
    kids.push(el("img", { position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover" }, ""));
    kids[kids.length - 1].props.src = post.cover;
    kids.push(el("div", { position: "absolute", top: 0, left: 0, width: W, height: H, background: "linear-gradient(180deg, rgba(10,6,20,0.45) 0%, rgba(10,6,20,0.92) 100%)" }, ""));
  } else if (broll) {
    // 배경 영상은 ffmpeg가 뒤에 깔고, 여기서는 가독성용 어두운 그라디언트만 얹는다(투명 PNG로 출력).
    kids.push(el("div", { position: "absolute", top: 0, left: 0, width: W, height: H, background: "linear-gradient(180deg, rgba(8,5,16,0.62) 0%, rgba(8,5,16,0.45) 42%, rgba(8,5,16,0.86) 100%)" }, ""));
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
  if (big && !photoBg) body.push(el("div", { display: "flex", alignSelf: "flex-start", opacity: eEmoji, transform: `translateY(${(1 - eEmoji) * 40}px)`, fontSize: 230, marginBottom: 50 }, post.emoji || "📰"));
  if (card.label) body.push(el("div", { display: "flex", alignSelf: "flex-start", opacity: eLabel, transform: `translateY(${(1 - eLabel) * 30}px)`, background: card.kind === "point" ? "transparent" : p.accent, color: card.kind === "point" ? p.accent : p.onAccent, fontSize: card.kind === "point" ? 52 : 32, fontWeight: 900, padding: card.kind === "point" ? "0" : "14px 30px", borderRadius: 999, marginBottom: 30 }, card.label));
  const titleLines = wrapLines(card.title, titleSize, -2.5);
  body.push(el("div", { display: "flex", flexDirection: "column", opacity: eTitle, transform: `translateY(${(1 - eTitle) * 44}px)` }, titleLines.map((ln) => el("div", { display: "flex", fontSize: titleSize, fontWeight: 900, color: ink, lineHeight: 1.18, letterSpacing: -2.5 }, ln))));
  body.push(el("div", { display: "flex", marginTop: 26, width: 60 + eTitle * 140, height: 10, borderRadius: 999, background: p.accent }, ""));
  if (card.body) {
    // 문장 단위로 나눠 문장 사이에 여백을 준다 → 어디서 한 생각이 끝나는지 눈에 보이게(가독성)
    // 종결부호+공백에서만 나눔 → "4.79%" 같은 소수점은 안 쪼개짐
    const sentences = card.body.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
    const groups = sentences.map((sen) =>
      el("div", { display: "flex", flexDirection: "column", marginBottom: 20 },
        wrapLines(sen, 46, 0).map((ln) => el("div", { display: "flex", fontSize: 46, fontWeight: 500, color: sub, lineHeight: 1.48 }, ln))));
    body.push(el("div", { display: "flex", flexDirection: "column", marginTop: 34, opacity: eBody, transform: `translateY(${(1 - eBody) * 36}px)` }, groups));
  }
  // 제목 블록을 화면 상단~중앙에 배치(썸네일·가독성). 훅/본문 모두 위쪽으로.
  kids.push(el("div", { display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", paddingTop: big ? 40 : 20, paddingLeft: 84, paddingRight: 84, paddingBottom: 360 }, body));
  kids.push(el("div", { display: "flex", position: "absolute", bottom: 90, left: 84, fontSize: 32, fontWeight: 800, color: sub }, "@oddsbag_official"));
  // 배경영상 출처 표기(화면). 저작권 안전: 소스 크레딧을 항상 화면에 남긴다.
  if (broll && opts.credit) kids.push(el("div", { display: "flex", position: "absolute", bottom: 94, right: 84, fontSize: 23, fontWeight: 600, color: "rgba(255,255,255,.62)" }, opts.credit));

  return el("div", { width: W, height: H, display: "flex", flexDirection: "column", background: broll ? "transparent" : p.bg, position: "relative", fontFamily: "Noto" }, kids);
}

export async function renderFrame(post, cards, idx, total, t, fonts, pal, opts = {}) {
  const svg = await satori(frame(post, cards[idx], idx, total, t, pal, opts), { width: W, height: H, fonts, loadAdditionalAsset: async (code, s) => (code === "emoji" ? emojiSvg(s) : "") });
  return new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
}
