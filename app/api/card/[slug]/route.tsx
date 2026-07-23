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

const W = 1080;
const H = 1350;
const OG_W = 1200; // 링크 공유용 (카톡/페북/트위터)
const OG_H = 630;

// ---- 무드별 팔레트 (게시물마다 고정) ----
type Pal = { bg: string; ink: string; sub: string; accent: string; onAccent: string };
// 【브랜드 규칙】 오즈백 = 딥퍼플(#5B2D8E) 바탕 + 네온옐로(#FFE600) 포인트.
// 예전엔 무드마다 틸·민트·핑크·오렌지·그린이 섞여 브랜드가 보이지 않았다.
// → 배경은 전부 퍼플/잉크 계열로, 포인트는 옐로로 통일. 변화는 명도로만 준다.
const PALETTES: Record<string, Pal[]> = {
  serious: [
    { bg: "#1e1730", ink: "#ffffff", sub: "#b0a5c6", accent: "#ffe600", onAccent: "#1e1730" },
    { bg: "#241a3a", ink: "#ffffff", sub: "#b3a6cf", accent: "#ffe600", onAccent: "#241a3a" },
  ],
  trust: [
    { bg: "#2a1b4d", ink: "#ffffff", sub: "#bcaee0", accent: "#ffe600", onAccent: "#2a1b4d" },
    { bg: "#33215e", ink: "#ffffff", sub: "#c3b6e6", accent: "#ffe600", onAccent: "#33215e" },
  ],
  energetic: [
    { bg: "#5b2d8e", ink: "#ffffff", sub: "#ded0f5", accent: "#ffe600", onAccent: "#3b1b60" },
    { bg: "#4a2585", ink: "#ffffff", sub: "#d8c8f2", accent: "#ffe600", onAccent: "#2b1350" },
  ],
  soft: [
    { bg: "#f3ecff", ink: "#2c1a52", sub: "#6b5a90", accent: "#5b2d8e", onAccent: "#ffffff" },
    { bg: "#faf7f2", ink: "#241a3a", sub: "#6f6684", accent: "#5b2d8e", onAccent: "#ffffff" },
  ],
  trendy: [
    { bg: "#1c1530", ink: "#ffffff", sub: "#b3a6cf", accent: "#ffe600", onAccent: "#1c1530" },
    { bg: "#241a3d", ink: "#ffffff", sub: "#bcaee0", accent: "#ffe600", onAccent: "#241a3d" },
  ],
};

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
) {
  const W = og ? OG_W : 1080;
  const H = og ? OG_H : 1350;
  const big = card.kind === "hook";
  const titleSize =
    (big
      ? card.title.length > 26
        ? 78
        : card.title.length > 16
          ? 96
          : 112
      : card.kind === "quote" || card.kind === "cta"
        ? 62
        : 58) * (og ? 0.62 : 1);

  const photoBg = big && hasPhoto;
  // 본문 카드에 붙는 순번 (01, 02 …) — 큰 고스트 숫자의 소재
  const stepNo = card.kind === "point" && card.label ? card.label.replace(/[^0-9]/g, "") : "";

  // 밝은 배경(soft 팔레트)에서는 반투명 흰색 패널이 안 보이므로 어두운 톤으로 뒤집는다
  const light = card.kind !== "hook" && p.ink !== "#ffffff";
  const veil = light ? "rgba(43,26,82,0.06)" : "rgba(255,255,255,0.055)";
  const veilLine = light ? "rgba(43,26,82,0.12)" : "rgba(255,255,255,0.10)";
  const ghost = light ? "rgba(91,45,142,0.09)" : "rgba(255,255,255,0.055)";
  const bodyInk = photoBg ? "rgba(255,255,255,.9)" : p.sub;
  const titleInk = photoBg ? "#fff" : p.ink;
  const PAD = og ? 56 : 84;

  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        background: p.bg,
        position: "relative",
        fontFamily: "Noto",
      }}
    >
      {/* 배경 1 — 사진 (훅 카드) */}
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
              background: "linear-gradient(180deg, rgba(10,6,20,0.45) 0%, rgba(10,6,20,0.78) 52%, rgba(10,6,20,0.96) 100%)",
            }}
          />
        </>
      ) : (
        // 배경 2 — 사진이 없을 때: 단색이 아니라 빛을 넣어 깊이를 만든다
        <>
          <div
            style={{
              position: "absolute",
              top: -H * 0.22,
              right: -W * 0.3,
              width: W * 1.1,
              height: W * 1.1,
              borderRadius: W,
              background: light
                ? "radial-gradient(circle, rgba(91,45,142,0.12) 0%, rgba(91,45,142,0) 70%)"
                : "radial-gradient(circle, rgba(255,230,0,0.13) 0%, rgba(255,230,0,0) 70%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -H * 0.18,
              left: -W * 0.25,
              width: W,
              height: W,
              borderRadius: W,
              background: light
                ? "radial-gradient(circle, rgba(91,45,142,0.10) 0%, rgba(91,45,142,0) 70%)"
                : "radial-gradient(circle, rgba(140,90,220,0.30) 0%, rgba(140,90,220,0) 70%)",
            }}
          />
        </>
      )}

      {/* 왼쪽 액센트 바 */}
      <div style={{ position: "absolute", top: 0, left: 0, width: 12, height: H, background: p.accent }} />

      {/* ── 상단: 진행 세그먼트 + 로고 + 분야 ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: og ? `34px ${PAD}px 0 ${PAD}px` : `56px ${PAD}px 0 ${PAD}px`,
          position: "relative",
        }}
      >
        {/* 몇 장짜리인지 한눈에 — 끝까지 넘겨보게 만드는 장치 */}
        {og ? null : (
          <div style={{ display: "flex", marginBottom: 34 }}>
            {Array.from({ length: total }).map((_, s) => (
              <div
                key={s}
                style={{
                  display: "flex",
                  flex: 1,
                  height: 6,
                  borderRadius: 6,
                  marginRight: s === total - 1 ? 0 : 8,
                  background: s <= idx ? p.accent : light ? "rgba(43,26,82,0.15)" : "rgba(255,255,255,0.18)",
                }}
              />
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              width: 46,
              height: 46,
              borderRadius: 13,
              background: p.accent,
              color: p.onAccent,
              fontSize: 30,
              fontWeight: 900,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 14,
            }}
          >
            O
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: titleInk, letterSpacing: -1 }}>
            ODDSBAG
          </div>
          <div style={{ flex: 1 }} />
          {category && !og ? (
            <div
              style={{
                display: "flex",
                fontSize: 24,
                fontWeight: 800,
                color: p.accent,
                border: `2px solid ${p.accent}`,
                borderRadius: 999,
                padding: "6px 20px",
              }}
            >
              {category}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── 본문 ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: big ? "flex-end" : "center",
          padding: og ? `0 ${PAD}px 46px ${PAD}px` : `28px ${PAD}px 118px ${PAD}px`,
          position: "relative",
        }}
      >
        {/* 사진 없는 훅 카드 — 큰 이모지를 가운데 원 안에 넣어 빈 공간을 채운다 */}
        {big && !photoBg && emoji ? (
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: og ? 220 : 460,
                height: og ? 220 : 460,
                borderRadius: 999,
                background: "rgba(255,255,255,0.05)",
                border: `3px solid ${veilLine}`,
                fontSize: og ? 130 : 250,
              }}
            >
              {emoji}
            </div>
          </div>
        ) : null}

        {/* 훅이 아닌 카드는 '패널' 안에 담는다 — 텅 빈 배경에 글자만 떠 있던 문제를 없앤다 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden", // 고스트 숫자가 패널 밖으로 삐져나오지 않게
            // 내용이 짧은 카드도 아래가 휑해 보이지 않게 최소 높이를 준다
            minHeight: big || og ? 0 : 640,
            justifyContent: "center",
            padding: big || og ? "0" : "56px 52px 58px 52px",
            borderRadius: big || og ? 0 : 36,
            background: big || og ? "transparent" : veil,
            border: big || og ? "none" : `2px solid ${veilLine}`,
          }}
        >
          {/* 큰 고스트 숫자 — 패널 안 오른쪽 위에 깔아 빈 면을 디자인으로 채운다 */}
          {stepNo && !og ? (
            <div
              style={{
                display: "flex",
                position: "absolute",
                top: -70,
                right: -20,
                fontSize: 360,
                fontWeight: 900,
                color: ghost,
                letterSpacing: -18,
              }}
            >
              {stepNo}
            </div>
          ) : null}

          {card.label ? (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                background: card.kind === "point" ? p.accent : "transparent",
                color: card.kind === "point" ? p.onAccent : p.accent,
                fontSize: card.kind === "point" ? 28 : 26,
                fontWeight: 900,
                padding: card.kind === "point" ? "8px 22px" : "8px 22px",
                border: card.kind === "point" ? "none" : `2px solid ${p.accent}`,
                borderRadius: 999,
                letterSpacing: 1,
                marginBottom: 24,
              }}
            >
              {card.label}
            </div>
          ) : null}

          {/* 줄바꿈(\n)은 satori 의 pre-wrap 이 공백으로 뭉개므로 직접 줄로 나눠 그린다 */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {card.title.split("\n").map((line, li) => (
              <div
                key={li}
                style={{
                  display: "flex",
                  fontSize: titleSize,
                  fontWeight: 900,
                  color: titleInk,
                  lineHeight: 1.22,
                  letterSpacing: -2.5,
                  wordBreak: "keep-all", // ★ 한글이 단어 중간에서 잘리지 않게 (가독성 최우선)
                }}
              >
                {line}
              </div>
            ))}
          </div>

          {/* 제목과 설명을 갈라주는 짧은 액센트 선 */}
          {card.body ? (
            <div
              style={{
                display: "flex",
                width: 84,
                height: 7,
                borderRadius: 7,
                background: p.accent,
                marginTop: 30,
                marginBottom: 30,
              }}
            />
          ) : null}

          {card.body ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {card.body.split(/(?<=[.!?])\s+/).filter(Boolean).map((sen, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    fontSize: 38,
                    fontWeight: 500,
                    color: bodyInk,
                    lineHeight: 1.55,
                    marginBottom: 16,
                    wordBreak: "keep-all", // ★ 한글 단어 중간 잘림 방지
                  }}
                >
                  {sen}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* 훅 카드 하단 안내 */}
        {big && !og ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              alignSelf: "flex-start",
              marginTop: 40,
              fontSize: 28,
              fontWeight: 900,
              color: p.onAccent,
              background: p.accent,
              borderRadius: 999,
              padding: "14px 30px",
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
            bottom: 48,
            left: PAD,
            width: W - PAD * 2,
            alignItems: "center",
          }}
        >
          {/* 마지막 CTA 카드는 본문에 이미 계정명이 크게 들어가므로 아래에 또 쓰지 않는다 */}
          <div style={{ display: "flex", fontSize: 26, fontWeight: 800, color: bodyInk, letterSpacing: 0.5 }}>
            {card.kind === "cta" ? "" : "@oddsbag_official"}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", fontSize: 26, fontWeight: 800, color: p.accent }}>
            {idx === total - 1 ? "팔로우하고 미리 받기" : "저장해두기 📌"}
          </div>
        </div>
      )}
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
    render(card, pal, post.cover, i, cards.length, og, post.emoji ?? "", post.category ?? ""),
    {
      width: og ? OG_W : W,
      height: og ? OG_H : H,
      emoji: "noto", // 이모지를 이미지로 렌더 (폰트에 없어도 깨지지 않음)
      fonts,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    },
  );
}
