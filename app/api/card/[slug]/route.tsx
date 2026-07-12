// 인스타그램 캐러셀 카드 이미지 생성 (4:5 = 1080x1350)
//   /api/card/[slug]?i=0  → 1장(훅/썸네일)
//   /api/card/[slug]?i=1..N
//
// 사진이 없어도 밀리지 않게 — 대형 타이포 + 절제된 레이아웃으로 승부.
// 인스타 API가 이 URL을 직접 가져가므로 반드시 공개 접근 가능해야 한다.

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getPostBySlug } from "@/lib/posts";
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
      {/* 사진(훅 카드에만) + 어둡게 덮기 → 글자 가독성 보장 */}
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
              background: "linear-gradient(180deg, rgba(10,6,20,0.55) 0%, rgba(10,6,20,0.92) 100%)",
            }}
          />
        </>
      ) : null}

      {/* 액센트 바 */}
      <div style={{ position: "absolute", top: 0, left: 0, width: 14, height: H, background: p.accent }} />

      {/* 상단 브랜드 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: og ? "38px 48px 0 56px" : "62px 70px 0 84px",
          position: "relative",
        }}
      >
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
        <div style={{ fontSize: 30, fontWeight: 900, color: photoBg ? "#fff" : p.ink, letterSpacing: -1 }}>
          ODDSBAG
        </div>
        <div style={{ flex: 1 }} />
        {og ? null : (
          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 700,
              color: photoBg ? "rgba(255,255,255,.7)" : p.sub,
            }}
          >
            {`${idx + 1} / ${total}`}
          </div>
        )}
      </div>

      {/* 본문 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: big ? "flex-end" : "center",
          padding: og ? "0 56px 58px 56px" : "0 84px 120px 84px",
          position: "relative",
        }}
      >
        {/* 사진이 없는 훅 카드 — 큰 이모지로 위쪽 여백을 채운다 */}
        {big && !photoBg && emoji ? (
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              fontSize: og ? 150 : 240,
            }}
          >
            {emoji}
          </div>
        ) : null}

        {card.label ? (
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              background: card.kind === "point" ? "transparent" : p.accent,
              color: card.kind === "point" ? p.accent : p.onAccent,
              fontSize: card.kind === "point" ? 40 : 26,
              fontWeight: 900,
              padding: card.kind === "point" ? "0" : "10px 22px",
              borderRadius: 999,
              letterSpacing: card.kind === "point" ? 0 : 1,
              marginBottom: 26,
            }}
          >
            {card.label}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            fontSize: titleSize,
            fontWeight: 900,
            color: photoBg ? "#fff" : p.ink,
            lineHeight: 1.22,
            letterSpacing: -2.5,
            whiteSpace: "pre-wrap",
          }}
        >
          {card.title}
        </div>

        {card.body ? (
          <div
            style={{
              display: "flex",
              marginTop: 30,
              fontSize: 38,
              fontWeight: 500,
              color: photoBg ? "rgba(255,255,255,.85)" : p.sub,
              lineHeight: 1.6,
            }}
          >
            {card.body}
          </div>
        ) : null}

        {/* 훅 카드 하단 안내 */}
        {big && !og ? (
          <div
            style={{
              display: "flex",
              marginTop: 40,
              fontSize: 28,
              fontWeight: 800,
              color: p.accent,
            }}
          >
            밀어서 보기 →
          </div>
        ) : null}
      </div>

      {/* 하단 워터마크 */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          bottom: og ? 30 : 52,
          left: og ? 56 : 84,
          fontSize: 26,
          fontWeight: 800,
          color: photoBg ? "rgba(255,255,255,.6)" : p.sub,
          letterSpacing: 0.5,
        }}
      >
        @oddsbag_official
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

  const post = await getPostBySlug(slug);
  if (!post) return new Response("not found", { status: 404 });

  const cards = buildCards(post);
  const card = cards[Math.min(i, cards.length - 1)];
  const pal = paletteFor(post.slug, post.mood);

  // 이 카드에 실제로 쓰이는 글자만 폰트로 받아온다 (수십 KB)
  const text =
    card.title + (card.body ?? "") + (card.label ?? "") + "ODDSBAG@oddsbag_official밀어서 보기0123456789/";
  const [bold, normal] = await Promise.all([loadFont(text, 900), loadFont(text, 500)]);

  const fonts = [
    bold && { name: "Noto", data: bold, weight: 900 as const, style: "normal" as const },
    normal && { name: "Noto", data: normal, weight: 500 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 900 | 500; style: "normal" }[];

  return new ImageResponse(render(card, pal, post.cover, i, cards.length, og, post.emoji ?? ""), {
    width: og ? OG_W : W,
    height: og ? OG_H : H,
    emoji: "noto", // 이모지를 이미지로 렌더 (폰트에 없어도 깨지지 않음)
    fonts,
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
    },
  });
}
