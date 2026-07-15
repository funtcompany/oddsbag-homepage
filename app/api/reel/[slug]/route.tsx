// 릴스/쇼츠 세로화면 생성 (9:16 = 1080×1920)
//
//  /api/reel/[slug]                  → JSON 매니페스트 (영상 공장이 읽는다: 카드 수·나레이션 문구·BGM 스타일)
//  /api/reel/[slug]?c=2&f=5          → 카드 2의 애니메이션 5번째 프레임 PNG
//
// 글자를 벡터로 그린 뒤 이미지로 내보내므로 텍스트/화질이 깨지지 않는다.
// 영상 공장은 각 카드의 enter 프레임(0..ENTER_FRAMES-1)을 받아 이어붙이고,
// 마지막 프레임을 나레이션 길이만큼 고정(hold)해 카드 한 장을 만든다.

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getPostFresh } from "@/lib/posts";
import { buildCards, type Card } from "@/lib/cards";
import {
  REEL_W, REEL_H, REEL_FPS, ENTER_FRAMES,
  reelSay, wrapLines, easeOut, paletteFor, bgmStyleFor, type Pal,
} from "@/lib/reel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadFont(text: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (
      await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/533.20.25 (KHTML, like Gecko) Version/5.0.4 Safari/533.20.27",
        },
        next: { revalidate: 604800 },
      })
    ).text();
    const m = css.match(/src:\s*url\((https:\/\/[^)]+)\)/);
    if (!m) return null;
    return await (await fetch(m[1], { next: { revalidate: 604800 } })).arrayBuffer();
  } catch {
    return null;
  }
}

function renderFrame(
  card: Card, idx: number, total: number, t: number, p: Pal, emoji: string, cover?: string,
) {
  const big = card.kind === "hook";
  const photoBg = big && cover;
  const titleSize = big
    ? card.title.length > 24 ? 92 : card.title.length > 14 ? 108 : 122
    : card.kind === "quote" || card.kind === "cta" ? 76 : 68;

  const eLabel = easeOut(t / 0.4);
  const eTitle = easeOut((t - 0.08) / 0.42);
  const eBody = easeOut((t - 0.18) / 0.42);
  const eEmoji = easeOut((t - 0.02) / 0.5);

  const titleLines = wrapLines(card.title, titleSize, -2.5);
  const bodyLines = card.body ? wrapLines(card.body, 46, 0) : [];
  const inkOnPhoto = photoBg ? "#ffffff" : p.ink;
  const subOnPhoto = photoBg ? "rgba(255,255,255,.85)" : p.sub;

  return (
    <div style={{ width: REEL_W, height: REEL_H, display: "flex", flexDirection: "column", background: p.bg, position: "relative", fontFamily: "Noto" }}>
      {photoBg ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} width={REEL_W} height={REEL_H} style={{ position: "absolute", top: 0, left: 0, width: REEL_W, height: REEL_H, objectFit: "cover" }} />
          <div style={{ position: "absolute", top: 0, left: 0, width: REEL_W, height: REEL_H, background: "linear-gradient(180deg, rgba(10,6,20,0.45) 0%, rgba(10,6,20,0.92) 100%)" }} />
        </>
      ) : null}

      {/* 진행바 */}
      <div style={{ display: "flex", position: "absolute", top: 40, left: 56, width: REEL_W - 112 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ display: "flex", flex: 1, height: 8, borderRadius: 999, marginRight: i < total - 1 ? 10 : 0, background: i <= idx ? p.accent : "rgba(255,255,255,0.22)" }} />
        ))}
      </div>
      {/* 액센트 바 */}
      <div style={{ position: "absolute", top: 0, left: 0, width: 16, height: REEL_H, background: p.accent }} />

      {/* 상단 브랜드 */}
      <div style={{ display: "flex", alignItems: "center", padding: "84px 84px 0 84px" }}>
        <div style={{ display: "flex", width: 58, height: 58, borderRadius: 16, background: p.accent, color: p.onAccent, fontSize: 38, fontWeight: 900, alignItems: "center", justifyContent: "center", marginRight: 18 }}>O</div>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 900, color: photoBg ? "#fff" : p.ink, letterSpacing: -1 }}>ODDSBAG</div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: subOnPhoto }}>{`${idx + 1} / ${total}`}</div>
      </div>

      {/* 본문 */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: big ? "flex-end" : "center", padding: "0 84px 220px 84px" }}>
        {big && !photoBg && emoji ? (
          <div style={{ display: "flex", flex: 1, alignItems: "center", opacity: eEmoji, transform: `translateY(${(1 - eEmoji) * 40}px)`, fontSize: 300 }}>{emoji}</div>
        ) : null}

        {card.label ? (
          <div style={{ display: "flex", alignSelf: "flex-start", opacity: eLabel, transform: `translateY(${(1 - eLabel) * 30}px)`, background: card.kind === "point" ? "transparent" : p.accent, color: card.kind === "point" ? p.accent : p.onAccent, fontSize: card.kind === "point" ? 52 : 32, fontWeight: 900, padding: card.kind === "point" ? "0" : "14px 30px", borderRadius: 999, marginBottom: 30 }}>{card.label}</div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", opacity: eTitle, transform: `translateY(${(1 - eTitle) * 44}px)` }}>
          {titleLines.map((ln, i) => (
            <div key={i} style={{ display: "flex", fontSize: titleSize, fontWeight: 900, color: inkOnPhoto, lineHeight: 1.18, letterSpacing: -2.5 }}>{ln}</div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: 26, width: 60 + eTitle * 140, height: 10, borderRadius: 999, background: p.accent }} />

        {bodyLines.length ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 34, opacity: eBody, transform: `translateY(${(1 - eBody) * 36}px)` }}>
            {bodyLines.map((ln, i) => (
              <div key={i} style={{ display: "flex", fontSize: 46, fontWeight: 500, color: subOnPhoto, lineHeight: 1.5 }}>{ln}</div>
            ))}
          </div>
        ) : null}
      </div>

      {/* 워터마크 */}
      <div style={{ display: "flex", position: "absolute", bottom: 90, left: 84, fontSize: 32, fontWeight: 800, color: subOnPhoto }}>@oddsbag_official</div>
    </div>
  );
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const post = await getPostFresh(slug);
  if (!post) return new Response("not found", { status: 404 });

  const cards = buildCards(post);
  const total = cards.length;
  const sp = req.nextUrl.searchParams;

  // ---- 매니페스트 (프레임 파라미터 c 가 없으면) ----
  if (sp.get("c") === null) {
    return Response.json({
      slug,
      title: post.title,
      w: REEL_W, h: REEL_H, fps: REEL_FPS, enterFrames: ENTER_FRAMES, total,
      category: post.category,
      bgmStyle: bgmStyleFor(post.category),
      hasCover: Boolean(post.cover),
      cards: cards.map((c, i) => ({ index: i, kind: c.kind, say: reelSay(c) })),
    });
  }

  // ---- 프레임 PNG ----
  const c = Math.max(0, Math.min(total - 1, parseInt(sp.get("c") ?? "0", 10) || 0));
  const f = Math.max(0, Math.min(ENTER_FRAMES - 1, parseInt(sp.get("f") ?? "0", 10) || 0));
  const card = cards[c];
  const t = f / REEL_FPS;
  const pal = paletteFor(post.slug, post.mood);

  const text =
    card.title + (card.body ?? "") + (card.label ?? "") +
    "ODDSBAG@oddsbag_official오즈백매거진전체글프로필링크0123456789/·";
  const [bold, normal] = await Promise.all([loadFont(text, 900), loadFont(text, 500)]);
  const fonts = [
    bold && { name: "Noto", data: bold, weight: 900 as const, style: "normal" as const },
    normal && { name: "Noto", data: normal, weight: 500 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 900 | 500; style: "normal" }[];

  return new ImageResponse(
    renderFrame(card, c, total, t, pal, post.emoji ?? "📰", post.cover),
    {
      width: REEL_W, height: REEL_H, emoji: "noto", fonts,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable" },
    },
  );
}
