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

// hook/intro/point/quote/cta : 단일 글 카드뉴스 (buildCards)
// lead/body/conclusion       : "이슈 모아보기" 카드뉴스 (buildRoundupCards) — 이슈 1건을 서론·본론·결론 3장으로
export type CardKind =
  | "hook"
  | "intro"
  | "point"
  | "quote"
  | "cta"
  | "lead" // 서론 — 무슨 일인지 (훅 + 한 줄 배경)
  | "body" // 본론 — 핵심 사실 (도식으로 정보 밀도 ↑)
  | "conclusion"; // 결론 — 그래서 뭐가 달라지나 (오즈백 한 줄)

export interface Card {
  kind: CardKind;
  label?: string; // 상단 작은 라벨 (카테고리 / 01 / 02 …)
  title: string;
  body?: string;
  /** 카드에 함께 그릴 시각 요소 (없으면 글만) */
  figure?: Figure;
}

// ---- 카드에 넣는 시각 요소 ----
// 【왜 필요한가】 글자만 이어지는 카드는 넘기다 만다.
//   본문에 이미 들어 있는 것(단축키·경로·숫자·목록·표)을 찾아 그림으로 세운다.
//   ※ 없는 걸 지어내지 않는다. 본문에 있는 것만 옮긴다.
export type Figure =
  | { kind: "keys"; keys: string[] } // 단축키 키캡
  | { kind: "path"; steps: string[] } // 메뉴 경로
  | { kind: "stats"; items: { value: string; label: string }[] } // 숫자 강조 2개
  | { kind: "list"; items: string[] } // 체크리스트
  | { kind: "table"; head: string[]; rows: string[][] }; // 표

const MOD =
  /^(⌘|⌃|⌥|⇧|command|cmd|control|ctrl|option|opt|alt|shift|fn|win|윈도우 ?키|커맨드|컨트롤|옵션|시프트)$/i;

// 본문 한 절에서 그림으로 세울 만한 것을 하나 찾는다 (앞선 것 우선)
function findFigure(text: string): Figure | undefined {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const m = line.match(/^\[(키|경로)\]\s*(.+)$/);
    if (!m) continue;
    if (m[1] === "키") {
      const keys = m[2].split("+").map((k) => k.trim()).filter(Boolean);
      if (keys.length >= 2 && keys.length <= 4) return { kind: "keys", keys };
    } else {
      const steps = m[2].split(/[>→]/).map((k) => k.trim()).filter(Boolean);
      if (steps.length >= 2 && steps.length <= 4) return { kind: "path", steps };
    }
  }

  // 표시가 없는 예전 글 — 줄 전체가 단축키뿐일 때만 (문장 중간은 건드리지 않는다)
  for (const line of lines) {
    if (line.length > 60 || !line.includes("+")) continue;
    const parts = line.replace(/[.。]$/, "").split("+").map((k) => k.trim());
    if (parts.length < 2 || parts.length > 4) continue;
    if (parts.some((k) => !k || k.length > 12)) continue;
    if (parts.some((k) => MOD.test(k))) return { kind: "keys", keys: parts };
  }

  // 마크다운 표
  const ti = lines.findIndex((l, i) => l.startsWith("|") && /^\|[\s:|-]+\|$/.test(lines[i + 1] ?? ""));
  if (ti >= 0) {
    const cells = (r: string) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    const head = cells(lines[ti]);
    const rows: string[][] = [];
    for (let i = ti + 2; i < lines.length && lines[i].startsWith("|"); i++) rows.push(cells(lines[i]));
    if (head.length >= 2 && head.length <= 3 && rows.length) {
      return { kind: "table", head, rows: rows.slice(0, 4) };
    }
  }

  return undefined;
}

// 문장에서 눈에 띄는 숫자 두 개를 뽑아 '숫자 타일'로 (이슈·경제 글에 잘 맞는다)
function findStats(text: string): Figure | undefined {
  const re = /(-?\d[\d,.]*\s?(%|퍼센트|만|억|조|원|명|건|개|배|년|위|점|시간|분))/g;
  const seen = new Set<string>();
  const items: { value: string; label: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && items.length < 2) {
    const value = m[1].replace(/\s+/g, "");
    if (seen.has(value)) continue;
    seen.add(value);
    // 숫자 앞뒤 말을 라벨로 (문장 그대로 자르지 않고 짧은 구절만)
    const before = text.slice(Math.max(0, m.index - 22), m.index).split(/[,.·]/).pop() ?? "";
    const after = text.slice(m.index + m[1].length, m.index + m[1].length + 20).split(/[,.·]/)[0] ?? "";
    const label = (before.trim() + " " + after.trim()).replace(/\s+/g, " ").trim().slice(0, 18);
    if (label.length >= 2) items.push({ value, label });
  }
  return items.length === 2 ? { kind: "stats", items } : undefined;
}

// 본문 안의 목록을 체크리스트로
function findList(text: string): Figure | undefined {
  const items = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => /^[-•]\s+/.test(l))
    .map((l) => l.replace(/^[-•]\s+/, "").replace(/\*\*/g, "").trim())
    .filter((l) => l.length >= 4 && l.length <= 42)
    .slice(0, 3);
  return items.length >= 2 ? { kind: "list", items } : undefined;
}

const MAX_BODY = 180; // 정보를 담아야 하므로 조금 넉넉히 (가독성 한계 안에서)
const MAX_CARDS = 10; // 인스타 그래프 API 캐러셀 상한

// 큰 정밀 숫자를 읽기 좋게 반올림: "1463만2347점" → "약 1,463만 점" (눈으로도, TTS로도 편하게)
export function humanizeNum(s: string): string {
  return String(s)
    .replace(/(\d+)만\s?(\d{3,4})\s*([점원명건개표배호]?)/g, (_m, a: string, _b: string, unit: string) => `약 ${Number(a).toLocaleString()}만${unit ? " " + unit : ""}`)
    .replace(/(\d+)억\s?(\d{3,5})(?!\s*원)/g, (_m, a: string) => `약 ${Number(a).toLocaleString()}억`);
}

// 말이 이어지는 채로 끝나는 어미 — 여기서 끊으면 카드가 "~인데요."로 끝나 결론이 사라진다.
const CONNECTIVE = /(인데요|는데요|은데요|데요|인데|는데|지만|라서|어서|아서|고요)[.!?…]?$/;

// 카드 본문 발췌: 예산(n자) 안에서 '완결된 문장'까지만. 단어/문장 중간은 절대 안 자른다.
//  ★ 예산에 걸려 결론 문장이 잘리고 "~인데요"로 끝나던 문제(사장님 지적 2026-07-29) 보완:
//    말이 안 끝났으면 다음 문장까지 데려오고, 데려올 게 없으면 그 문장은 아예 뺀다.
function clip(s: string, n = MAX_BODY): string {
  const t = humanizeNum(s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim());
  const sentences = t.split(/(?<=[.!?])\s+/).filter(Boolean); // 종결부호+공백에서만 → 소수점 안 쪼갬
  if (!sentences.length) return "";
  if (t.length <= n && !CONNECTIVE.test(sentences[sentences.length - 1])) return t;
  const out: string[] = [];
  for (const sen of sentences) {
    if (out.length && out.join(" ").length + sen.length + 1 > n) break;
    out.push(sen);
  }
  if (!out.length) out.push(sentences[0]);
  let i = out.length;
  while (CONNECTIVE.test(out[out.length - 1]) && i < sentences.length && out.join(" ").length < n * 1.5) out.push(sentences[i++]);
  while (out.length > 1 && CONNECTIVE.test(out[out.length - 1])) out.pop();
  return out.join(" ").trim();
}

interface Section {
  heading: string;
  text: string;
  raw: string; // 줄바꿈을 살린 원본 (도식을 찾으려면 필요하다)
}

function parseSections(body: string): Section[] {
  const out: Section[] = [];
  let cur: Section | null = null;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) {
      if (cur) out.push(cur);
      cur = { heading: line.slice(3).trim(), text: "", raw: "" };
    } else if (cur) {
      cur.raw += (cur.raw ? "\n" : "") + line;
      // 도식 표시 줄은 본문 문장에서 빼둔다 (그림으로 따로 세우므로 중복 방지)
      if (!/^\[(키|경로|핵심|주의)\]/.test(line) && !line.startsWith("|")) {
        cur.text += (cur.text ? " " : "") + line.replace(/^-\s*/, "");
      }
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

  // 3) 본문 섹션 (인트로에서 목차로 쓰므로 먼저 읽는다)
  const sections = parseSections(post.body);
  const closing = sections.find((s) => s.heading.includes("한 줄 정리"));
  const points = sections.filter((s) => !s.heading.includes("한 줄 정리"));

  // 2) 인트로 — 요약만 넣으면 카드 아래가 텅 빈다.
  //    '이 글에서 다루는 것'을 목차로 함께 실어 정보량과 넘길 이유를 같이 준다.
  if (post.summary) {
    // 소제목이 길면 걸러내지 말고 줄여서 싣는다 (걸러버리면 목차가 통째로 사라진다)
    const toc = points
      .map((s) => {
        const h = s.heading.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
        return h.length > 30 ? h.slice(0, 29).trimEnd() + "…" : h;
      })
      .filter((h) => h.length >= 3)
      .slice(0, 3);
    cards.push({
      kind: "intro",
      label: "무슨 일이냐면",
      title: clip(post.summary, 110),
      figure: toc.length >= 2 ? { kind: "list", items: toc } : findStats(post.summary),
    });
  }

  // 정보가 잘리면 안 되므로 요점 카드를 최우선으로 채운다.
  // (마지막 CTA 1장은 항상 확보 — 그 나머지를 전부 요점에 쓴다)
  const roomForPoints = MAX_CARDS - cards.length - 1;
  points.slice(0, roomForPoints).forEach((s, i) => {
    // 그림거리를 순서대로 찾는다: 도식 → 표 → 목록 → 숫자
    const figure =
      findFigure(s.raw) ?? findList(s.raw) ?? findStats(s.text);
    cards.push({
      kind: "point",
      label: String(i + 1).padStart(2, "0"),
      title: s.heading,
      // 그림이 붙는 카드는 글을 조금 줄여 숨통을 틔운다
      body: clip(s.text, figure ? 120 : MAX_BODY),
      figure,
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
    body: "팔로우하면 이런 정보를 매일 받아볼 수 있어요",
  });

  return cards.slice(0, MAX_CARDS);
}

// ════════════════════════════════════════════════════════════════════
//  "이슈 모아보기" 카드뉴스 — 여러 이슈를 한 게시물에 (정보 밀도 ↑)
//
//  【형태】 어그로만 끌고 빈약한 단일 카드에서 벗어나, 이슈마다 3장(서론·본론·결론)으로
//          어느 정도 요약해 담는다. 인스타 사진 상한(20장)을 넉넉히 쓴다.
//
//   1장       COVER(hook) — "오늘의 이슈 모아보기 N선" (표지)
//   이슈마다 3장
//     · LEAD       서론 — 무슨 일인지 (훅 + 한 줄 배경)
//     · BODY       본론 — 핵심 사실 (도식으로 밀도 ↑)
//     · CONCLUSION 결론 — 그래서 뭐가 달라지나 (오즈백 한 줄)
//   끝장      CTA — 저장 + 팔로우
//
//   장수 = 1(표지) + 이슈수 × 3 + 1(CTA)
//     · 이슈 5개 → 17장 · 이슈 6개 → 20장 (권장 5~6개)
//
//  ※ 없는 사실을 지어내지 않는다 — 전부 원문(post.body / summary)에서만 요약한다.
//  ※ content-factory/cards.mjs · factory/render.mjs 의 buildRoundupCards 와 항상 같은 구성.
// ════════════════════════════════════════════════════════════════════

export const MAX_ROUNDUP_CARDS = 20; // 인스타 캐러셀(사진 첨부) 상한
export const ROUNDUP_MAX_ISSUES = 6; // 20장 안에 담기는 이슈 최대치 (1 + 6×3 + 1 = 20)

// 이슈 1건 → 서론·본론·결론 3장. (표지·CTA 없이 가운데 토막만)
export function buildIssueCards(post: Post, issueNo: number): Card[] {
  const sections = parseSections(post.body);
  const closing = sections.find((s) => s.heading.includes("한 줄 정리"));
  const points = sections.filter((s) => !s.heading.includes("한 줄 정리"));
  const cat = post.category;

  // ① 서론 — 무슨 일인지
  const lead: Card = {
    kind: "lead",
    label: `이슈 ${String(issueNo).padStart(2, "0")} · ${cat}`,
    title: (post.hook || post.title).trim(),
    body: clip(post.summary || (points[0]?.text ?? ""), 130),
    figure: findStats(post.summary || points[0]?.text || ""),
  };

  // ② 본론 — 핵심 사실 (도식 우선: 표/경로/키 → 목록 → 숫자)
  const src = points[0] ?? { heading: "무슨 일이 있었나", text: post.summary, raw: post.summary };
  const extra = points[1]?.text ? " " + points[1].text : "";
  const figure = findFigure(src.raw) ?? findList(src.raw) ?? findStats(src.text + extra);
  const body: Card = {
    kind: "body",
    label: `이슈 ${String(issueNo).padStart(2, "0")} · 자세히`,
    title: src.heading.replace(/\*\*/g, "").trim(),
    body: clip(src.text + extra, figure ? 150 : 200),
    figure,
  };

  // ③ 결론 — 그래서 뭐가 달라지나 (오즈백 한 줄 정리, 없으면 마지막 섹션 요지)
  const conclText = closing?.text || points[points.length - 1]?.text || post.summary;
  const conclusion: Card = {
    kind: "conclusion",
    label: `이슈 ${String(issueNo).padStart(2, "0")} · 오즈백 한 줄`,
    title: clip(conclText, 90),
  };

  return [lead, body, conclusion];
}

// 여러 이슈 → "모아보기" 캐러셀 (표지 + 이슈들 + CTA)
export function buildRoundupCards(posts: Post[]): Card[] {
  const issues = posts.filter((p) => p && p.body).slice(0, ROUNDUP_MAX_ISSUES);
  const n = issues.length;
  const cards: Card[] = [];

  // 표지 — 오늘의 이슈 모아보기 N선
  cards.push({
    kind: "hook",
    label: "이슈 모아보기",
    title: `오늘의 이슈\n모아보기 ${n}선`,
    body: issues
      .map((p, i) => `${String(i + 1).padStart(2, "0")}. ${(p.hook || p.title).trim()}`)
      .slice(0, n)
      .join("\n"),
  });

  // 이슈마다 3장 (서론·본론·결론)
  issues.forEach((p, i) => {
    for (const c of buildIssueCards(p, i + 1)) cards.push(c);
  });

  // 마무리 — 저장 + 팔로우
  cards.push({
    kind: "cta",
    label: "@oddsbag_official",
    title: "이슈 모아보기\n매일 올라옵니다",
    body: "저장해두고 팔로우하면 놓치지 않아요",
  });

  return cards.slice(0, MAX_ROUNDUP_CARDS);
}

// 모아보기 캡션 — 담긴 이슈 목록을 그대로 보여 준다 (훑어보기 좋게)
export function buildRoundupCaption(posts: Post[]): string {
  const issues = posts.filter((p) => p && p.body).slice(0, ROUNDUP_MAX_ISSUES);
  return [
    `오늘의 이슈 모아보기 ${issues.length}선`,
    "",
    ...issues.map((p, i) => `${["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"][i] ?? "▪️"} ${(p.hook || p.title).trim()}`),
    "",
    "📌 저장해두면 필요할 때 바로 꺼내 볼 수 있어요",
    "🔔 팔로우하면 이런 이슈 정리가 매일 떠요 → @oddsbag_official",
  ]
    .join("\n")
    .slice(0, 2100);
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
    "🔔 팔로우하면 이런 알짜 정보가 매일 피드에 떠요 → @oddsbag_official",
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
