// 인스타그램 캐러셀 카드 이미지 생성 (4:5 = 1080x1350)
//   /api/card/[slug]?i=0  → 1장(훅/썸네일)
//   /api/card/[slug]?i=1..N
//
// 사진이 없어도 밀리지 않게 — 대형 타이포 + 절제된 레이아웃으로 승부.
// 인스타 API가 이 URL을 직접 가져가므로 반드시 공개 접근 가능해야 한다.

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getPostFresh } from "@/lib/posts";
import { buildCards, type Card } from "@/lib/cards";

export const runtime = "nodejs";
// 쿼리(?i=)로 장수가 달라지므로 라우트 캐시는 쓰지 않고, CDN 캐시는 응답 헤더로 건다.
export const dynamic = "force-dynamic";

// 레이아웃은 1080×1350 기준으로 짜고, 마지막에 확대해서 내보낸다.
const W = 1080;
const H = 1350;
// 인스타는 4:5에서 가로 1440까지 원본 화질로 받는다. 1080으로 올리면 폰에서 글자가 뭉갠다.
// 벡터로 그린 뒤 확대하므로 글자가 계단지지 않고 그대로 선명해진다.
const OUT_W = 1440;
const OUT_H = 1800;
const OG_W = 1200; // 링크 공유용 (카톡/페북/트위터)
const OG_H = 630;

// ---- 무드별 팔레트 ----
// 【디자인 방향】 요즘 한국 카드뉴스 문법을 따른다.
//  · 바탕은 밝다 (오프화이트/크림). 어두운 배경 + 반투명 유리 패널은 예전 스타일이다.
//  · 글자는 거의 검정에 가까운 잉크색으로 아주 크고 굵게 — 대비가 최대라 폰에서 제일 잘 읽힌다.
//  · 색은 '한 가지 진한 포인트색'만 쓴다. 표지는 그 색으로 꽉 채우고, 본문 장은 흰 바탕에 포인트만.
//  · 형광펜 하이라이트로 핵심 단어를 짚는다 (한국 카드뉴스의 대표 문법).
// 브랜드는 색 도배가 아니라 O 마크와 레이아웃으로 지킨다.
type Pal = {
  bg: string; // 본문 장 바탕 (밝음)
  ink: string; // 큰 제목
  sub: string; // 설명글
  accent: string; // 포인트색 (표지 바탕 · 번호칩 · 하이라이트)
  onAccent: string; // 포인트색 위 글자
  hi: string; // 형광펜 색 (포인트색의 옅은 버전)
};
const PALETTES: Record<string, Pal[]> = {
  // 시사·진중 — 코발트블루
  serious: [
    { bg: "#F5F4F0", ink: "#14131A", sub: "#5B5865", accent: "#1F4FD8", onAccent: "#FFFFFF", hi: "#C9D8FF" },
    { bg: "#F3F4F6", ink: "#15171C", sub: "#585C68", accent: "#123B8F", onAccent: "#FFFFFF", hi: "#C2D4F5" },
  ],
  // 신뢰·정보 — 딥그린
  trust: [
    { bg: "#F3F6F3", ink: "#131815", sub: "#525E57", accent: "#0E7A5F", onAccent: "#FFFFFF", hi: "#B6E7D6" },
    { bg: "#F5F5F1", ink: "#16181A", sub: "#565B5E", accent: "#1B6B8C", onAccent: "#FFFFFF", hi: "#BEE2EE" },
  ],
  // 활기·역동 — 토마토 레드
  energetic: [
    { bg: "#FBF6F2", ink: "#1A1512", sub: "#665C55", accent: "#F0472A", onAccent: "#FFFFFF", hi: "#FFD0C4" },
    { bg: "#FAF6F0", ink: "#1B1610", sub: "#665D50", accent: "#E2701A", onAccent: "#FFFFFF", hi: "#FFDCB8" },
  ],
  // 감성·부드러움 — 로즈
  soft: [
    { bg: "#FAF5F5", ink: "#1B1417", sub: "#6A5C61", accent: "#C2437A", onAccent: "#FFFFFF", hi: "#FBCEE0" },
    { bg: "#F8F5F2", ink: "#1A1614", sub: "#655C56", accent: "#A75B45", onAccent: "#FFFFFF", hi: "#F6D2C6" },
  ],
  // 트렌디·힙 — 오즈백 딥퍼플
  trendy: [
    { bg: "#F7F4FB", ink: "#171326", sub: "#5E5670", accent: "#5B2D8E", onAccent: "#FFFFFF", hi: "#DCC9F5" },
    { bg: "#F6F5FA", ink: "#161425", sub: "#5C586C", accent: "#3B2C9E", onAccent: "#FFFFFF", hi: "#CFCCF7" },
  ],
};

// 브랜드 고정값 — O 마크는 어떤 무드에서도 그대로
const BRAND_PURPLE = "#5B2D8E";
const BRAND_YELLOW = "#FFE600";

// ---- 배경 질감 ----
// 완전한 단색은 밋밋하고 값싸 보인다. 배경에 재질감을 깔아 인쇄물 같은 밀도를 만든다.
// 외부 이미지 없이 SVG 데이터 URI로 처리한다.
// ⚠️ 고운 노이즈는 PNG 압축이 안 먹어 파일이 10배 가까이 커진다(2.8MB) → 결이 굵은 쪽을 쓴다.
const svgUrl = (inner: string, w: number, h = w) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${inner}</svg>`,
  )}")`;

// 종이 결 — feTurbulence 로 만든 구름 무늬.
// 【용량 핵심】 노이즈를 그대로 쓰면 PNG 압축이 안 먹어 2MB까지 커진다.
// feComponentTransfer 의 discrete 로 명암을 몇 단계로 뭉쳐주면(양자화)
// 같은 값이 넓게 반복돼 압축이 다시 먹는다. 눈에는 종이 결 그대로 보인다.
// · 타일을 카드 전체 크기(1080)로 잡아 반복 이음새가 안 보이게 한다
// · 결은 곱게(주파수 높게). 굵게 하면 종이가 아니라 위장무늬처럼 보인다
// · 명암은 3단계로만 뭉쳐 압축이 먹게 하고, 불투명도를 아주 낮춰 은은하게 깐다
const paperTex = (freq: number, seed: number) =>
  svgUrl(
    `<filter id="g">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="1" seed="${seed}" stitchTiles="stitch"/>` +
      `<feColorMatrix type="saturate" values="0"/>` +
      `<feComponentTransfer>` +
      `<feFuncR type="discrete" tableValues="0 .5 1"/>` +
      `<feFuncG type="discrete" tableValues="0 .5 1"/>` +
      `<feFuncB type="discrete" tableValues="0 .5 1"/>` +
      `<feFuncA type="discrete" tableValues="1"/>` +
      `</feComponentTransfer></filter>` +
      `<rect width="1080" height="1350" filter="url(#g)"/>`,
    1080,
    1350,
  );

// 글마다 조금씩 다른 결을 쓴다 (seed·굵기가 달라 무늬가 겹치지 않는다)
const PAPER_VARIANTS = [
  { url: paperTex(0.42, 3), onLight: 0.1, onCover: 0.1 },
  { url: paperTex(0.55, 11), onLight: 0.095, onCover: 0.095 },
  { url: paperTex(0.34, 29), onLight: 0.105, onCover: 0.1 },
  { url: paperTex(0.68, 47), onLight: 0.09, onCover: 0.09 },
  { url: paperTex(0.48, 61), onLight: 0.1, onCover: 0.095 },
];
// 비교·미리보기용으로 남겨두는 다른 재질
const TEX_GRID = svgUrl(`<g fill="none" stroke="#000" stroke-width="1.4"><path d="M0 0H72M0 0V72"/></g>`, 72);
const TEX_DOT = svgUrl(`<circle cx="9" cy="9" r="2.6" fill="#000"/>`, 26);
const TEXTURES: Record<string, { url: string; onLight: number; onCover: number }> = {
  grid: { url: TEX_GRID, onLight: 0.075, onCover: 0.14 },
  dot: { url: TEX_DOT, onLight: 0.07, onCover: 0.13 },
};

// 기본은 종이 결. 글(slug)마다 다른 변형이 걸린다.
function textureFor(key: string, slug: string) {
  if (key === "none") return null;
  if (TEXTURES[key]) return TEXTURES[key];
  return PAPER_VARIANTS[hash(slug + "tex") % PAPER_VARIANTS.length];
}
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function paletteFor(slug: string, mood?: string): Pal {
  const list = PALETTES[mood ?? "trendy"] ?? PALETTES.trendy;
  return list[hash(slug) % list.length];
}

// ---- 한글 폰트 (구글폰트에서 필요한 글자만 서브셋으로 받아옴 → 가볍고 빠름) ----
async function loadFont(text: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (
      await fetch(url, {
        headers: {
          // 구형 UA로 요청해야 woff2 대신 truetype을 준다 (satori는 woff2 미지원)
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/533.20.25 (KHTML, like Gecko) Version/5.0.4 Safari/533.20.27",
        },
        next: { revalidate: 604800 },
      })
    ).text();
    const m = css.match(/src:\s*url\((https:\/\/[^)]+)\)/);
    if (!m) return null;
    const res = await fetch(m[1], { next: { revalidate: 604800 } });
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

// ---- 카드 렌더 ----
function render(
  card: Card,
  p: Pal,
  hasPhoto: string | undefined,
  idx: number,
  total: number,
  og = false,
  emoji = "",
  category = "",
  texKey = "paper",
  slug = "",
) {
  const tex = textureFor(texKey, slug);
  const W = og ? OG_W : 1080;
  const H = og ? OG_H : 1350;
  const big = card.kind === "hook"; // 표지
  const last = idx === total - 1;
  const photoBg = big && Boolean(hasPhoto);
  // 표지는 포인트색으로 꽉 채운다 (사진이 있으면 사진 + 어두운 오버레이)
  const cover = big;
  const stepNo = card.kind === "point" && card.label ? card.label.replace(/[^0-9]/g, "") : "";

  const ink = cover ? "#FFFFFF" : p.ink;
  const sub = cover ? "rgba(255,255,255,.86)" : p.sub;
  const PAD = og ? 56 : 92;

  const titleSize =
    (big
      ? card.title.length > 30
        ? 88
        : card.title.length > 18
          ? 104
          : 124
      : card.kind === "quote"
        ? 76
        : card.kind === "cta"
          ? 72
          : 66) * (og ? 0.6 : 1);

  const cardEl = (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        background: cover ? p.accent : p.bg,
        position: "relative",
        fontFamily: "Noto",
      }}
    >
      {/* ── 배경 질감 ── 단색으로 두지 않고 종이 결 + 은은한 얼룩을 깐다 */}
      {!photoBg ? (
        <>
          {/* 빛이 스민 듯한 얼룩 (인쇄 종이의 불균일함) */}
          <div
            style={{
              position: "absolute",
              top: -H * 0.15,
              left: -W * 0.2,
              width: W * 1.05,
              height: W * 1.05,
              borderRadius: W,
              background: cover
                ? "radial-gradient(circle, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 68%)"
                : "radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 68%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -H * 0.16,
              right: -W * 0.22,
              width: W * 0.95,
              height: W * 0.95,
              borderRadius: W,
              background: cover
                ? "radial-gradient(circle, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0) 68%)"
                : "radial-gradient(circle, rgba(120,105,80,0.10) 0%, rgba(120,105,80,0) 68%)",
            }}
          />
          {/* 재질감 — 전면에 아주 옅게 깔아 밀도를 만든다 */}
          {tex ? (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: W,
                height: H,
                backgroundImage: tex.url,
                backgroundRepeat: "repeat",
                opacity: cover ? tex.onCover : tex.onLight,
              }}
            />
          ) : null}
        </>
      ) : null}

      {/* 표지에 사진이 있으면 사진 + 어두운 그라디언트 (글자 대비 확보) */}
      {photoBg ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hasPhoto}
            width={W}
            height={H}
            style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: W,
              height: H,
              background:
                "linear-gradient(180deg, rgba(12,10,16,0.35) 0%, rgba(12,10,16,0.72) 55%, rgba(12,10,16,0.94) 100%)",
            }}
          />
        </>
      ) : null}

      {/* ── 상단 ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: og ? `34px ${PAD}px 0 ${PAD}px` : `62px ${PAD}px 0 ${PAD}px`,
          position: "relative",
        }}
      >
        {/* O 마크 — 무드가 바뀌어도 항상 같은 자리, 같은 색 */}
        <div
          style={{
            display: "flex",
            width: 44,
            height: 44,
            borderRadius: 12,
            background: cover ? "#FFFFFF" : BRAND_PURPLE,
            color: cover ? p.accent : BRAND_YELLOW,
            fontSize: 29,
            fontWeight: 900,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 13,
          }}
        >
          O
        </div>
        <div style={{ fontSize: 29, fontWeight: 900, color: ink, letterSpacing: -1 }}>ODDSBAG</div>
        <div style={{ flex: 1 }} />
        {og ? null : (
          <div
            style={{
              display: "flex",
              fontSize: 25,
              fontWeight: 800,
              color: cover ? "rgba(255,255,255,.8)" : p.sub,
              letterSpacing: 0.5,
            }}
          >
            {`${String(idx + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`}
          </div>
        )}
      </div>

      {/* ── 본문 ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: big ? "flex-end" : "center",
          // 아래 여백이 크면 글이 위로 붕 뜬다 → 하단 바 자리만 남기고 줄인다
          padding: og ? `0 ${PAD}px 44px ${PAD}px` : `0 ${PAD}px 108px ${PAD}px`,
          position: "relative",
        }}
      >
        {/* 표지: 사진이 없으면 큰 이모지. 위를 비우고 아래로 몰아 쌓는 구성(요즘 카드뉴스 문법) */}
        {big && !photoBg && emoji ? (
          <div
            style={{
              display: "flex",
              fontSize: og ? 150 : 250,
              marginBottom: 26,
              lineHeight: 1,
            }}
          >
            {emoji}
          </div>
        ) : null}

        {/* 번호 — 큰 사각 칩. 본문 장의 첫인상을 만든다 */}
        {stepNo && !og ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 98,
              height: 98,
              borderRadius: 26,
              background: p.accent,
              color: p.onAccent,
              fontSize: 52,
              fontWeight: 900,
              letterSpacing: -2,
              marginBottom: 34,
            }}
          >
            {stepNo}
          </div>
        ) : null}

        {/* 라벨 — 번호가 없는 장에만 (무슨 일이냐면 · 한 줄 정리 · CTA) */}
        {card.label && !stepNo ? (
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              background: cover ? "rgba(255,255,255,.18)" : p.accent,
              color: cover ? "#FFFFFF" : p.onAccent,
              fontSize: 27,
              fontWeight: 900,
              padding: "11px 26px",
              borderRadius: 999,
              letterSpacing: 0.5,
              marginBottom: 28,
            }}
          >
            {card.label}
          </div>
        ) : null}

        {/* 제목 — 줄바꿈은 직접 나눠 그린다 (satori 의 pre-wrap 이 공백으로 뭉갠다) */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {card.title.split("\n").map((line, li) => (
            <div
              key={li}
              style={{
                display: "flex",
                fontSize: titleSize,
                fontWeight: 900,
                color: ink,
                lineHeight: 1.2,
                letterSpacing: -3,
                wordBreak: "keep-all", // ★ 한글이 단어 중간에서 잘리지 않게
              }}
            >
              {line}
            </div>
          ))}
        </div>

        {/* 형광펜 — 제목 아래 짧게 그어 시선을 잡는다 (한국 카드뉴스 대표 문법) */}
        {!cover ? (
          <div
            style={{
              display: "flex",
              width: 132,
              height: 18,
              borderRadius: 3,
              background: p.hi,
              marginTop: 22,
              marginBottom: card.body ? 30 : 0,
            }}
          />
        ) : null}

        {card.body ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {card.body
              .split(/(?<=[.!?])\s+/)
              .filter(Boolean)
              .map((sen, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    fontSize: 40,
                    fontWeight: 500,
                    color: sub,
                    lineHeight: 1.6,
                    marginBottom: 18,
                    wordBreak: "keep-all",
                  }}
                >
                  {sen}
                </div>
              ))}
          </div>
        ) : null}

        {/* 표지 하단 안내 */}
        {big && !og ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              alignSelf: "flex-start",
              marginTop: 44,
              fontSize: 29,
              fontWeight: 900,
              color: p.accent,
              background: "#FFFFFF",
              borderRadius: 999,
              padding: "16px 34px",
            }}
          >
            {`${total}장 전부 보기 →`}
          </div>
        ) : null}
      </div>

      {/* ── 하단 ── */}
      {og ? null : (
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 54,
            left: PAD,
            width: W - PAD * 2,
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 27,
              fontWeight: 800,
              color: cover ? "rgba(255,255,255,.82)" : p.sub,
              letterSpacing: 0.3,
            }}
          >
            {card.kind === "cta" ? "" : "@oddsbag_official"}
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: "flex",
              fontSize: 27,
              fontWeight: 900,
              color: cover ? "#FFFFFF" : p.accent,
            }}
          >
            {last ? "팔로우하고 미리 받기" : "저장해두기"}
          </div>
        </div>
      )}

    </div>
  );

  // OG(링크 공유용)는 원래 크기 그대로, 인스타 카드만 1440×1800 으로 확대해 내보낸다
  if (og) return cardEl;
  return (
    <div
      style={{
        width: OUT_W,
        height: OUT_H,
        display: "flex",
        overflow: "hidden",
        background: cover ? p.accent : p.bg,
      }}
    >
      <div style={{ display: "flex", transform: `scale(${OUT_W / W})`, transformOrigin: "left top" }}>
        {cardEl}
      </div>
    </div>
  );
}
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const i = Math.max(0, parseInt(req.nextUrl.searchParams.get("i") ?? "0", 10) || 0);
  const og = req.nextUrl.searchParams.get("og") === "1";

  const post = await getPostFresh(slug);
  if (!post) return new Response("not found", { status: 404 });

  const cards = buildCards(post);
  const card = cards[Math.min(i, cards.length - 1)];
  const pal = paletteFor(post.slug, post.mood);

  // 이 카드에 실제로 쓰이는 글자만 폰트로 받아온다 (수십 KB)
  const text =
    card.title +
    (card.body ?? "") +
    (card.label ?? "") +
    (post.category ?? "") +
    "ODDSBAG@oddsbag_official장 전부 보기저장해두기팔로우하고미리받는0123456789/→·";
  const [bold, normal] = await Promise.all([loadFont(text, 900), loadFont(text, 500)]);

  const fonts = [
    bold && { name: "Noto", data: bold, weight: 900 as const, style: "normal" as const },
    normal && { name: "Noto", data: normal, weight: 500 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 900 | 500; style: "normal" }[];

  return new ImageResponse(
    render(
      card,
      pal,
      post.cover,
      i,
      cards.length,
      og,
      post.emoji ?? "",
      post.category ?? "",
      req.nextUrl.searchParams.get("tex") ?? "paper", // 질감 미리보기용 (기본 종이 결)
      post.slug, // 글마다 다른 종이 결이 걸리도록
    ),
    {
      width: og ? OG_W : OUT_W,
      height: og ? OG_H : OUT_H,
      emoji: "noto", // 이모지를 이미지로 렌더 (폰트에 없어도 깨지지 않음)
      fonts,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    },
  );
}
