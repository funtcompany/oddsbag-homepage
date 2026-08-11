// 카드뉴스를 그대로 얹는 세로영상 (사장님 승인: A안 수정본, 2026-07-29)
//
// 왜: 카드뉴스와 영상 디자인을 두 벌 유지하면 한쪽만 좋아진다. 카드뉴스(1080×1350)를 그대로 쓰고
//     9:16에서 남는 위아래만 활용하면, 카드뉴스의 질감·거대숫자·불릿·도식이 영상에도 그대로 들어온다.
//
// 배치 (숫자로 고정 — 겹침이 생길 수 없게)
//   0    ~ 280 : 좌 카테고리+제목(최대 3줄, 절대 안 자름) / 우상단 ODDSBAG + @oddsbag_official
//   280  ~1630 : 카드뉴스 원본 1080×1350 그대로
//   1656 ~1712 : 글 특화 키워드 5개
//   1782 ~1824 : 중앙 하단 오즈백 · @oddsbag_official
//
// 【2026-08-11 계정명 표시】 릴스에서 계정을 누르게 하려면 계정 이름이 화면에 보여야 한다.
//   전에는 그 자리에 `oddsbag.co.kr`이 있었는데, 인스타에서는 **누를 수 없는 글자**다.
//   ※ 아래쪽(1782~)은 인스타 UI(캡션·음원·버튼)가 덮는 자리다. 그래서 계정명을 **위쪽 칸에도** 넣는다.
//     위쪽 칸은 영상 내내 안 가려지는 유일한 자리다.
//   ※ 계획서의 "화면 아래 420px 위로 올린다"는 이 배치에서 불가능하다 — 아래에서 420px 지점은
//     y=1458 이고 카드(280~1630) 한가운데다. 카드를 줄이지 않는 한 그 자리는 안 난다.
//
// ※ 제목이 길면 3줄까지 늘리고 그래도 안 되면 글자를 줄인다. 잘라내는 일은 없다.
//   (사장님 지적 2026-07-29 — 제목이 "…모으"처럼 잘려 나갔던 사고)

import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { videoStyleFor } from "./cardstyle.mjs";
import { keywords } from "./hashtags.mjs";

export const W = 1080, H = 1920;
export const CARD_W = 1080, CARD_H = 1350;
export const CARD_TOP = 280;
const TITLE_TOP = 48, CHIP_H = 46, GAP = 26;
export const TITLE_MAX_H = CARD_TOP - TITLE_TOP - CHIP_H - GAP; // 제목이 쓸 수 있는 세로
// 제목이 쓸 수 있는 가로. 오른쪽에는 로고+계정명이 서 있다 — 여기를 넓히면 제목이 로고를 파고든다.
export const TITLE_W = 690;
const KW_TOP = CARD_TOP + CARD_H + 26;
const LINK_BOTTOM = 96;
// 화면 아래 고정 표식. 인스타에서 누를 수 있는 건 @계정뿐이라 웹주소 대신 계정을 적는다.
const MARK_TEXT = "오즈백 · @oddsbag_official";

const el = (type, style, children) => ({ type, props: { style, children } });
const wideCh = (ch) => /[가-힣ㄱ-ㅎㅏ-ㅣ　-〿一-鿿]/.test(ch);
const textW = (s, fs) => [...s].reduce((a, c) => a + (wideCh(c) ? fs * 0.99 : fs * 0.54), 0);

// 제목을 정해진 칸 안에 '전부' 넣는다. 안 들어가면 글자를 줄인다. 절대 잘라내지 않는다.
export function fitTitle(title, avail = TITLE_W, maxH = TITLE_MAX_H) {
  for (let fs = 54; fs >= 30; fs -= 2) {
    const words = String(title).split(" ").filter(Boolean);
    const lines = []; let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (cur && textW(t, fs) > avail) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    if (lines.length * fs * 1.24 <= maxH && lines.every((l) => textW(l, fs) <= avail)) return { fs, lines };
  }
  return { fs: 30, lines: String(title).split(" ") };
}

// 그 글에만 해당하는 키워드 5개 (#뉴스·#쇼츠 같은 일반 태그는 뺀다)
export function pickKeywords(post, n = 5) {
  const GENERIC = new Set(["오즈백", "ODDSBAG", "뉴스", "시사", "이슈", "오늘의뉴스", "데일리뉴스",
    "뉴스피드", "쇼츠", "카드뉴스", "issue", "정보", post.category]);
  return [...new Set([...(post.tags || []), ...keywords(post, 16)].map((k) => String(k).replace(/^#/, "")))]
    .filter((k) => k && !GENERIC.has(k)).slice(0, n);
}

function frameEl({ post, cardDataUri, kws }) {
  const p = videoStyleFor(post.category);
  const { fs, lines } = fitTitle(post.title);
  const kids = [];
  // 우상단 로고 + 계정명 (인스타 UI가 안 덮는 유일한 자리라 계정명을 여기 둔다)
  kids.push(el("div", { display: "flex", flexDirection: "column", alignItems: "flex-end", position: "absolute", top: 54, right: 60 }, [
    el("div", { display: "flex", alignItems: "center" }, [
      el("div", { display: "flex", width: 46, height: 46, borderRadius: 13, background: p.accent, color: p.onAccent, fontSize: 30, fontWeight: 900, alignItems: "center", justifyContent: "center", marginRight: 12 }, "O"),
      el("div", { display: "flex", fontSize: 32, fontWeight: 900, color: p.ink, letterSpacing: -1 }, "ODDSBAG"),
    ]),
    el("div", { display: "flex", fontSize: 22, fontWeight: 500, color: p.sub, letterSpacing: -0.3, marginTop: 8 }, "@oddsbag_official"),
  ]));
  // 좌측 카테고리 + 제목(영상 내내 고정)
  //  ※ 폭 760 → 690. 계정명 줄이 로고보다 넓어서 그만큼 자리를 내줬다. 겹치면 제목이 로고를 파고든다.
  kids.push(el("div", { display: "flex", flexDirection: "column", position: "absolute", top: TITLE_TOP, left: 60, width: TITLE_W }, [
    el("div", { display: "flex", marginBottom: 10 }, [
      el("div", { display: "flex", background: p.accent, color: p.onAccent, fontSize: 24, fontWeight: 900, padding: "6px 16px", borderRadius: 999 }, post.category || "오즈백"),
    ]),
    el("div", { display: "flex", flexDirection: "column" },
      lines.map((ln) => el("div", { display: "flex", fontSize: fs, fontWeight: 900, color: p.ink, letterSpacing: -1.6, lineHeight: 1.24 }, ln))),
  ]));
  // 카드뉴스 원본 (건드리지 않는다 — 안쪽 여백도 그대로)
  const img = el("img", { position: "absolute", top: CARD_TOP, left: 0, width: CARD_W, height: CARD_H }, "");
  img.props.src = cardDataUri;
  kids.push(img);
  // 키워드
  kids.push(el("div", { display: "flex", flexWrap: "wrap", position: "absolute", top: KW_TOP, left: 60, width: W - 120 },
    kws.map((k) => el("div", {
      display: "flex", background: p.dark ? "rgba(255,255,255,.13)" : "rgba(0,0,0,.06)", color: p.ink,
      fontSize: 28, fontWeight: 800, padding: "9px 20px", borderRadius: 999, marginRight: 10, marginBottom: 10,
    }, `#${k}`))));
  // 중앙 하단 고정 표식 (계정명)
  kids.push(el("div", { display: "flex", justifyContent: "center", position: "absolute", bottom: LINK_BOTTOM, left: 0, width: W }, [
    el("div", { display: "flex", fontSize: 34, fontWeight: 800, color: p.sub, letterSpacing: 0.5 }, MARK_TEXT),
  ]));
  return el("div", { width: W, height: H, display: "flex", background: p.bg, position: "relative", fontFamily: "Noto" }, kids);
}

export async function renderCardFrame({ post, cardPngBuffer, kws, fonts }) {
  const uri = "data:image/png;base64," + Buffer.from(cardPngBuffer).toString("base64");
  const svg = await satori(frameEl({ post, cardDataUri: uri, kws }), { width: W, height: H, fonts, loadAdditionalAsset: async () => "" });
  return new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
}

// 홈페이지가 만들어 주는 카드 이미지를 그대로 받아온다 (인스타에 나가는 그림과 100% 동일)
// profileCount: 마지막 카드가 약속하는 '프로필에 쌓인 게시물 수'. 부르는 쪽이 센 값을 그대로 실어 보낸다.
//  안 보내면 홈페이지가 제가 적어둔 값을 쓰는데, 그러면 화면 숫자와 나레이션 숫자가 어긋날 수 있다. (2026-08-11)
export async function fetchCard(siteUrl, slug, i, tries = 3, profileCount = null) {
  const url = `${siteUrl.replace(/\/$/, "")}/api/card/${slug}?i=${i}${profileCount ? `&pc=${profileCount}` : ""}`;
  let last;
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "oddsbag-factory" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const b = Buffer.from(await r.arrayBuffer());
      if (b.length < 5000) throw new Error("이미지가 너무 작음");
      return b;
    } catch (e) { last = e; await new Promise((s) => setTimeout(s, 1500 * (t + 1))); }
  }
  throw new Error(`카드 이미지 실패 ${slug}#${i}: ${last?.message}`);
}

// 배치가 서로 겹치지 않는지 기계 검사 (렌더 전에 부른다)
export function checkLayout(post) {
  const { fs, lines } = fitTitle(post.title);
  const titleBottom = TITLE_TOP + CHIP_H + GAP + lines.length * fs * 1.24;
  const joined = lines.join(" ").replace(/\s+/g, " ").trim();
  const problems = [];
  if (joined !== String(post.title).replace(/\s+/g, " ").trim()) problems.push("제목이 잘림");
  if (titleBottom > CARD_TOP) problems.push(`제목이 카드와 겹침(${Math.round(titleBottom)} > ${CARD_TOP})`);
  if (KW_TOP + 56 > H - LINK_BOTTOM - 42) problems.push("키워드가 하단 표식과 겹침");
  if (CARD_TOP + CARD_H > KW_TOP) problems.push("카드가 키워드와 겹침");
  // 제목이 우상단 로고·계정명을 파고드는지 (2026-08-11 계정명 추가로 오른쪽이 넓어졌다)
  const 로고폭 = Math.max(46 + 12 + textW("ODDSBAG", 32), textW("@oddsbag_official", 22));
  if (60 + TITLE_W + 20 > W - 60 - 로고폭) problems.push(`제목이 우상단 계정명과 겹침(제목끝 ${60 + TITLE_W} > 로고시작 ${Math.round(W - 60 - 로고폭)})`);
  if (textW(MARK_TEXT, 34) > W - 120) problems.push("하단 표식이 화면 밖으로 나감");
  return { ok: problems.length === 0, problems, titleSize: fs, titleLines: lines.length, titleBottom: Math.round(titleBottom) };
}
