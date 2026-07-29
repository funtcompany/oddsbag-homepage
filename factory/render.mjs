// 세로 릴스 화면(1080×1920) 자체 렌더링 — satori(글자→벡터) + resvg(PNG).
// 홈페이지 /api/reel 라우트와 동일한 디자인을 공장 안에서 직접 그린다 (Vercel 불필요).
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { videoStyleFor, badgeEmoji, SAFE_TOP, SAFE_BOTTOM, FOOTER_BOTTOM } from "./cardstyle.mjs";

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
// 색은 이제 '무드 랜덤'이 아니라 '카테고리 고정'이다 (카드뉴스 개편안과 같은 색).
//  · category 를 주면 개편안 색을 쓴다. 없으면 옛 무드 팔레트로 폴백(구버전 호출 호환).
export function paletteFor(slug, mood, category) {
  if (category) return videoStyleFor(category);
  const list = PALETTES[mood] ?? PALETTES.trendy;
  return list[hash(slug) % list.length];
}

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
// 카드 본문은 반드시 '완결'되어야 한다 — 서론-본론-결론까지 담고 끝낸다.
//  · 예전엔 글자 예산(110자)에 걸려 결론 문장이 잘리고 "~인데요"에서 끝났다(사장님 지적 2026-07-29).
//  · 규칙 ① 예산 안에서 완결된 문장까지 담는다
//         ② 마지막 문장이 '연결어미'(~인데요·~지만·~라서…)면, 말이 안 끝난 것이므로 다음 문장까지 데려온다
//         ③ 데려올 문장이 없으면, 그 연결 문장은 아예 뺀다 (끝맺지 못한 채로 두지 않는다)
const CONNECTIVE = /(인데요|는데요|은데요|데요|인데|는데|지만|라서|어서|아서|고요|하며|하면서|이며|되며|되고)[.!?…]?$/;
function clipWhole(s, n = 200) {
  const t = humanizeNum(s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim());
  const sentences = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (!sentences.length) return "";
  const out = [];
  for (const sen of sentences) {
    if (out.length && out.join(" ").length + sen.length + 1 > n) break;
    out.push(sen);
  }
  if (!out.length) out.push(sentences[0]);
  // ② 말이 안 끝났으면 다음 문장을 더 데려온다 (예산을 조금 넘겨도 완결이 먼저)
  let i = out.length;
  while (CONNECTIVE.test(out[out.length - 1]) && i < sentences.length && out.join(" ").length < n * 1.6) {
    out.push(sentences[i]); i++;
  }
  // ③ 그래도 연결어미로 끝나면 그 문장은 뺀다 (단, 한 문장뿐이면 그냥 둔다)
  while (out.length > 1 && CONNECTIVE.test(out[out.length - 1])) out.pop();
  return out.join(" ").trim();
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
// 장수 상한 — 2:59(179초) 안에서 소제목이 잘리지 않도록 넉넉히. 실제 길이는 make-reels 가 지킨다.
const MAX_POINTS = 8;   // 본문 소제목 카드
const MAX_CARDS = 12;   // 훅 + 무슨일이냐면 + 소제목 8 + 한줄정리 + CTA
export function buildCards(post) {
  const cards = [];
  cards.push({ kind: "hook", label: post.category, title: (post.hook || post.title).trim() });
  if (post.summary) cards.push({ kind: "intro", label: "무슨 일이냐면", title: clipWhole(post.summary, 130) });
  const secs = parseSections(post.body);
  const closing = secs.find((s) => s.heading.includes("한 줄 정리"));
  // ★ 예전엔 여기서 소제목을 앞 3개만 남겼다(slice(0,3)) — "5가지"라고 해놓고 3개만 나오던 진짜 원인.
  //   2:59(179초) 규격에서는 소제목을 전부 담아도 시간이 남는다. 본문 글이 스스로 개수를 정한다.
  //   장면당 글자는 오히려 줄인다(110자) — 영상은 멈춰서 읽는 게 아니라 흘러가기 때문(가독성).
  const points = secs.filter((s) => !s.heading.includes("한 줄 정리")).slice(0, MAX_POINTS);
  // 3분(179초)을 넘길 것 같으면 카드를 '버리지' 않고 각 카드의 설명을 줄인다.
  //  왜: "7가지"라고 해놓고 5개만 나오는 게 가장 나쁜 실패다(사장님 지적). 개수 약속 > 카드별 상세.
  //  예산을 200→150→110자로 낮춰보고, 그래도 길면 각 항목의 첫 문장만 남긴다(문장은 절대 안 자름).
  const estimate = (budget) => {
    const t = points.reduce((a, s) => a + s.heading.length + clipWhole(s.text, budget).length, 0);
    const fixed = (post.hook || post.title).length + (post.summary ? clipWhole(post.summary, 130).length : 0) + (closing?.text ? clipWhole(closing.text, 140).length : 0) + 30;
    // 초당 6.5자 — 실측 보정값(구글 Chirp3-HD 한국어). 예전 5.3은 과대추정이라 설명이 불필요하게 잘렸다.
    return (t + fixed) / 6.5 + (points.length + 4) * 1.1;
  };
  let budget = 200;
  for (const b of [200, 150, 110, 0]) { budget = b; if (estimate(b || 1) <= 170) break; }
  points.forEach((s, i) => cards.push({
    kind: "point", label: String(i + 1).padStart(2, "0"),
    title: s.heading.replace(/^\s*\d+[.)]\s*/, ""),
    body: budget ? clipWhole(s.text, budget) : clipWhole(s.text, 1), // 0이면 첫 문장만
  }));
  if (closing?.text) cards.push({ kind: "quote", label: "오즈백 한 줄 정리", title: clipWhole(closing.text, 140) });
  cards.push({ kind: "cta", label: "@oddsbag_official", title: "전체 글은\n오즈백 매거진에서", body: "프로필 링크 → oddsbag.co.kr" });
  return cards.slice(0, MAX_CARDS);
}
// 카드에 담긴 텍스트를 '있는 그대로 온전히' 읽는다.
//  · body는 clip()이 완결된 문장까지만 담아둔 것이므로 통째로 읽어도 중간에 안 잘린다.
//  · 소제목(title) 뒤에 마침표를 넣어 끊어읽되, 이미 종결부호가 있으면 겹치지 않게 한다.
//  · 본문이 여러 문장이면 ssmlFor가 문장부호마다 쉼을 넣어 자연스럽게 이어읽는다.
function sayClean(s) {
  return String(s || "").replace(/\*\*/g, "").replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}
export function reelSay(card) {
  switch (card.kind) {
    case "hook": case "intro": case "lead": return sayClean(card.title);
    case "point": case "body": {
      const title = sayClean(card.title);
      const body = sayClean(card.body);
      if (!body) return title;
      const head = /[.!?…]$/.test(title) ? title : `${title}.`;
      return `${head} ${body}`;
    }
    case "quote": case "conclusion": return `오즈백 한 줄 정리. ${sayClean(card.title)}`;
    case "cta": return "전체 글은 오즈백 매거진에서 확인하세요.";
    default: return sayClean(card.title);
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

// ── 카드가 '칸' 안에 들어가도록 글자 크기·문장 수를 정하는 계산 ──
//   frame() 과 검사도구(check-layout)가 같은 함수를 쓴다 → 검사 결과와 실제 화면이 어긋날 수 없다.
export function fitCard(post, card, opts = {}) {
  const big = card.kind === "hook";
  const photoBg = big && post.cover && !opts.transparent;
  const baseTitle = big ? (card.title.length > 24 ? 96 : card.title.length > 14 ? 112 : 124) : card.kind === "quote" || card.kind === "cta" ? 88 : 84;
  const BOX_TOP = SAFE_TOP + 96;
  const BOX_BOTTOM = H - (FOOTER_BOTTOM + 54 + 40);      // 로고줄(54) 위까지 본문이 쓴다
  const BOX_H = BOX_BOTTOM - BOX_TOP;
  const AVAIL = 880;
  let sentences = card.body ? card.body.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean) : [];
  const labelH = card.label && !big ? 92 : 0;
  let useEmoji = big && !photoBg;
  const measure = (ts, bs, sens, emoji) => {
    let h = (emoji ? 276 + 50 : 0) + labelH;
    h += wrapLines(card.title, ts, -2.5, AVAIL).length * ts * 1.18 + 36;
    if (sens.length) { h += 34; for (const s of sens) h += wrapLines(s, bs, 0, AVAIL).length * bs * 1.48 + 20; }
    return h;
  };
  let ts = baseTitle, bs = 46;
  while (measure(ts, bs, sentences, useEmoji) > BOX_H && (ts > 60 || bs > 34)) {
    if (bs > 34 && (46 - bs) * 2 <= baseTitle - ts) bs -= 2; else if (ts > 60) ts -= 4; else bs -= 2;
  }
  if (measure(ts, bs, sentences, useEmoji) > BOX_H && useEmoji) useEmoji = false;
  const before = sentences.length;
  while (measure(ts, bs, sentences, useEmoji) > BOX_H && sentences.length > 1) sentences = sentences.slice(0, -1);
  const height = measure(ts, bs, sentences, useEmoji);
  return { ts, bs, sentences, useEmoji, BOX_TOP, BOX_H, AVAIL, height,
           fits: height <= BOX_H, shrunkTitle: baseTitle - ts, shrunkBody: 46 - bs, droppedSentences: before - sentences.length };
}

function frame(post, card, idx, total, t, pal, opts = {}) {
  const p = pal;
  const broll = !!opts.transparent;            // B-roll 배경(영상이 뒤에서 비침) 모드
  const big = card.kind === "hook";
  const photoBg = big && post.cover && !broll;
  const overlayDark = photoBg || broll;         // 어두운 그라디언트 + 흰 글자
  // 영상은 흘러간다 → 카드뉴스보다 글자를 키운다 (개편안: 제목 104px 기준)
  const titleSize = big ? (card.title.length > 24 ? 96 : card.title.length > 14 ? 112 : 124) : card.kind === "quote" || card.kind === "cta" ? 88 : 84;
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
  // 머리말 — 좌: 카테고리 뱃지(개편안 고정요소) / 우: 페이지. SNS UI가 덮는 위 230px 아래로 내린다.
  kids.push(el("div", { display: "flex", alignItems: "center", padding: `${SAFE_TOP}px 84px 0 84px` }, [
    el("div", {
      display: "flex", alignItems: "center", background: overlayDark ? "rgba(255,255,255,.14)" : p.accent,
      color: overlayDark ? "#fff" : p.onAccent, fontSize: 34, fontWeight: 900,
      padding: "12px 26px", borderRadius: 999,
    }, `${badgeEmoji(post.category)} ${post.category || "오즈백"}`),
    el("div", { display: "flex", flex: 1 }, ""),
    el("div", { display: "flex", fontSize: 32, fontWeight: 800, color: sub }, `${idx + 1} / ${total}`),
  ]));
  const fit = fitCard(post, card, opts);
  const { ts, bs, sentences, useEmoji, BOX_TOP, BOX_H, AVAIL } = fit;

  // 본문
  const body = [];
  if (useEmoji) body.push(el("div", { display: "flex", alignSelf: "flex-start", opacity: eEmoji, transform: `translateY(${(1 - eEmoji) * 40}px)`, fontSize: 230, marginBottom: 50 }, post.emoji || "📰"));
  if (card.label && !big) body.push(el("div", { display: "flex", alignSelf: "flex-start", opacity: eLabel, transform: `translateY(${(1 - eLabel) * 30}px)`, background: card.kind === "point" ? "transparent" : p.accent, color: card.kind === "point" ? p.accent : p.onAccent, fontSize: card.kind === "point" ? 52 : 32, fontWeight: 900, padding: card.kind === "point" ? "0" : "14px 30px", borderRadius: 999, marginBottom: 30 }, card.label));
  const titleLines = wrapLines(card.title, ts, -2.5, AVAIL);
  body.push(el("div", { display: "flex", flexDirection: "column", opacity: eTitle, transform: `translateY(${(1 - eTitle) * 44}px)` }, titleLines.map((ln) => el("div", { display: "flex", fontSize: ts, fontWeight: 900, color: ink, lineHeight: 1.18, letterSpacing: -2.5 }, ln))));
  body.push(el("div", { display: "flex", marginTop: 26, width: 60 + eTitle * 140, height: 10, borderRadius: 999, background: p.accent }, ""));
  if (sentences.length) {
    // 문장마다 여백을 줘서 한 생각이 어디서 끝나는지 눈에 보이게 (가독성)
    const groups = sentences.map((sen) =>
      el("div", { display: "flex", flexDirection: "column", marginBottom: 20 },
        wrapLines(sen, bs, 0, AVAIL).map((ln) => el("div", { display: "flex", fontSize: bs, fontWeight: 500, color: sub, lineHeight: 1.48 }, ln))));
    body.push(el("div", { display: "flex", flexDirection: "column", marginTop: 34, opacity: eBody, transform: `translateY(${(1 - eBody) * 36}px)` }, groups));
  }
  // ④ 정해진 칸 안에 세로 가운데 정렬 — 칸을 넘지 않으므로 위아래 어느 쪽도 침범하지 않는다
  kids.push(el("div", { display: "flex", flexDirection: "column", justifyContent: "center", position: "absolute", top: BOX_TOP, left: 84, width: AVAIL, height: BOX_H, overflow: "hidden" }, body));
  // 꼬리말(개편안 고정요소) — 좌: 로고 / 우: 주소. 안전영역 위에 놓아 좋아요·공유 버튼에 안 가린다.
  const foot = [
    el("div", { display: "flex", width: 54, height: 54, borderRadius: 15, background: p.accent, color: p.onAccent, fontSize: 34, fontWeight: 900, alignItems: "center", justifyContent: "center", marginRight: 16 }, "O"),
    el("div", { display: "flex", fontSize: 36, fontWeight: 900, color: ink, letterSpacing: -1 }, "ODDSBAG"),
    el("div", { display: "flex", flex: 1 }, ""),
    el("div", { display: "flex", fontSize: 28, fontWeight: 700, color: sub }, "oddsbag.co.kr"),
  ];
  kids.push(el("div", { display: "flex", alignItems: "center", position: "absolute", bottom: FOOTER_BOTTOM, left: 84, width: W - 168 }, foot));
  if (broll && opts.credit) kids.push(el("div", { display: "flex", position: "absolute", bottom: FOOTER_BOTTOM + 74, left: 84, fontSize: 22, fontWeight: 600, color: overlayDark ? "rgba(255,255,255,.55)" : sub }, opts.credit));

  return el("div", { width: W, height: H, display: "flex", flexDirection: "column", background: broll ? "transparent" : p.bg, position: "relative", fontFamily: "Noto" }, kids);
}

export async function renderFrame(post, cards, idx, total, t, fonts, pal, opts = {}) {
  const svg = await satori(frame(post, cards[idx], idx, total, t, pal, opts), { width: W, height: H, fonts, loadAdditionalAsset: async (code, s) => (code === "emoji" ? emojiSvg(s) : "") });
  return new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
}
