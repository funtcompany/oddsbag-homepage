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
// 【디자인 방향】 국내 상위 카드뉴스의 문법을 따른다.
//  · 바탕은 따뜻한 크림색. 차가운 흰색보다 인쇄물 같고 눈이 편하다.
//  · 얇은 라운드 프레임을 안쪽에 둘러 '한 장의 인쇄물'처럼 보이게 한다.
//  · 제목은 아주 크고 굵은 잉크색, 그중 핵심 단어 하나만 포인트색으로 물들인다.
//  · 본문은 흰 카드에 담아 띄우고, 오른쪽에 큰 번호를 세운다.
//  · 라벨은 자간을 넓게 벌린 작은 글씨로 (정보의 격이 올라간다).
// 브랜드는 색 도배가 아니라 O 마크와 레이아웃으로 지킨다.
type Pal = {
  bg: string; // 바탕 (크림)
  card: string; // 본문 카드 (거의 흰색)
  ink: string; // 큰 제목
  sub: string; // 설명글
  faint: string; // 라벨·페이지 표시
  line: string; // 프레임·구분선
  accent: string; // 포인트색
  onAccent: string;
  ghost: string; // 큰 번호 (연한 포인트색)
};
const PALETTES: Record<string, Pal[]> = {
  // 시사·진중 — 잉크 블루
  serious: [
    { bg: "#F4F2EC", card: "#FDFCFA", ink: "#191713", sub: "#5F5A52", faint: "#A79F93", line: "#DCD5C8", accent: "#2B4C8C", onAccent: "#FFFFFF", ghost: "#C6D2E6" },
    { bg: "#F2F2EF", card: "#FDFDFC", ink: "#17181A", sub: "#5C5E60", faint: "#A3A5A6", line: "#D8D9D5", accent: "#1F4FD8", onAccent: "#FFFFFF", ghost: "#C8D6F2" },
  ],
  // 신뢰·정보 — 세이지 그린
  trust: [
    { bg: "#F2F4EE", card: "#FCFDFB", ink: "#171A15", sub: "#565C51", faint: "#9FA695", line: "#D7DCCE", accent: "#4A7A56", onAccent: "#FFFFFF", ghost: "#CBDCCE" },
    { bg: "#F1F4F3", card: "#FCFDFD", ink: "#151A19", sub: "#535C5A", faint: "#9AA5A2", line: "#D3DBD9", accent: "#1E7A6B", onAccent: "#FFFFFF", ghost: "#C2DCD6" },
  ],
  // 활기·역동 — 테라코타
  energetic: [
    { bg: "#F8F2EA", card: "#FFFDFA", ink: "#1C1611", sub: "#645A4F", faint: "#AC9E8C", line: "#E4D7C6", accent: "#C4643C", onAccent: "#FFFFFF", ghost: "#EED7C6" },
    { bg: "#F9F1EC", card: "#FFFCFA", ink: "#1D1512", sub: "#665750", faint: "#B09B92", line: "#E7D6CE", accent: "#D2553A", onAccent: "#FFFFFF", ghost: "#F3D2C7" },
  ],
  // 감성·부드러움 — 더스티 로즈
  soft: [
    { bg: "#F7F1F1", card: "#FFFCFC", ink: "#1B1416", sub: "#645257", faint: "#AE979C", line: "#E5D3D5", accent: "#A8506A", onAccent: "#FFFFFF", ghost: "#EDCFD8" },
    { bg: "#F6F2EE", card: "#FFFDFB", ink: "#1A1512", sub: "#615751", faint: "#A99C92", line: "#E1D6CC", accent: "#96613F", onAccent: "#FFFFFF", ghost: "#E8D5C4" },
  ],
  // 트렌디·힙 — 오즈백 퍼플
  trendy: [
    { bg: "#F5F2F7", card: "#FDFCFE", ink: "#191524", sub: "#5C5468", faint: "#A79EB4", line: "#DED6E6", accent: "#5B2D8E", onAccent: "#FFFFFF", ghost: "#D9CBEC" },
    { bg: "#F4F3F8", card: "#FDFDFE", ink: "#17162A", sub: "#585670", faint: "#A29FB8", line: "#DAD8E6", accent: "#3B2C9E", onAccent: "#FFFFFF", ghost: "#CFCCF0" },
  ],
};

// 브랜드 고정값 — O 마크는 어떤 무드에서도 그대로
const BRAND_PURPLE = "#5B2D8E";
const BRAND_YELLOW = "#FFE600";

// ---- 배경 질감 ----
// 단색 배경은 밋밋하고 값싸 보인다. 실제 종이를 찍은 사진을 바탕에 깔고
// 그 위에 바탕색을 덮어 '색이 입혀진 종이'로 만든다.
// (SVG 노이즈로도 해봤지만, 눈에 보일 만큼 올리면 용량이 3~14배로 뛰고
//  용량을 맞추려 낮추면 질감이 안 느껴졌다. 사진이 확실하고 오히려 가볍다.)
// 출처: Pexels (상업적 이용 무료, 출처 표기 불필요)
const PAPERS = [
  "/textures/p5506216.jpg", // 수채화지 — 곱고 균일한 결
  "/textures/p20818860.jpg", // 구겨진 종이 — 접힌 자국과 굴곡
  "/textures/p6485437.jpg", // 리넨 — 직조 결
];
const WASH_LIGHT = 0.88; // 크림 바탕을 덮는 정도 (낮출수록 질감이 세게 드러난다)
const WASH_COVER = 0.9; // 포인트색으로 꽉 채운 표지
const paperFor = (slug: string) => PAPERS[hash(slug + "tex") % PAPERS.length];

// ---- 제목 줄바꿈 ----
// 자동 줄바꿈에 맡기면 컬러 단어를 span 으로 나누는 순간 그 경계에서 줄이 끊긴다
// (예: "…윈도우 기능" / "5" 처럼 숫자만 뚝 떨어짐).
// 그래서 줄을 직접 나눈 뒤 각 줄은 줄바꿈 없이 그린다.
function wrapTitle(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let cur = "";
    for (const word of para.split(" ")) {
      const next = cur ? `${cur} ${word}` : word;
      if (next.length <= maxChars || !cur) {
        cur = next;
      } else {
        out.push(cur);
        cur = word;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

// 포인트색으로 물들일 한 덩어리를 고른다.
// "N가지"·"N개" 같은 숫자 표현이 있으면 그것을, 없으면 마지막 줄의 마지막 낱말.
function findHighlight(lines: string[]): { line: number; hit: string } | null {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/\d+\s*(가지|개|종|위|년|월|일|시간|분|%|만원|원)?/);
    if (m && m[0].trim()) return { line: i, hit: m[0] };
  }
  const li = lines.length - 1;
  const words = (lines[li] ?? "").trim().split(" ");
  if (words.length > 1) return { line: li, hit: words[words.length - 1] };
  if (lines.length > 1 && words[0]) return { line: li, hit: words[0] };
  return null;
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
  slug = "",
  origin = "",
) {
  const W = og ? OG_W : 1080;
  const H = og ? OG_H : 1350;
  const cover = card.kind === "hook"; // 표지
  const last = idx === total - 1;
  const photoBg = cover && Boolean(hasPhoto);
  const stepNo = card.kind === "point" && card.label ? card.label.replace(/[^0-9]/g, "") : "";

  // 표지는 포인트색으로 꽉 채우고, 나머지는 크림 바탕
  const ground = cover ? p.accent : p.bg;
  const ink = cover ? "#FFFFFF" : p.ink;
  const sub = cover ? "rgba(255,255,255,.88)" : p.sub;
  const faint = cover ? "rgba(255,255,255,.7)" : p.faint;
  const line = cover ? "rgba(255,255,255,.34)" : p.line;
  const hitColor = cover ? "rgba(255,255,255,.62)" : p.accent;

  const PAD = og ? 54 : 96; // 프레임 안쪽 여백
  const FRAME = og ? 26 : 44; // 프레임이 카드 가장자리에서 떨어진 거리

  const titleSize =
    (cover
      ? card.title.length > 30
        ? 82
        : card.title.length > 18
          ? 96
          : 112
      : card.kind === "quote"
        ? 70
        : card.kind === "cta"
          ? 68
          : 62) * (og ? 0.6 : 1);

  const sentences = card.body ? card.body.split(/(?<=[.!?])\s+/).filter(Boolean) : [];

  // 한 줄에 들어가는 글자 수를 폭에서 역산해 줄을 직접 나눈다 (한글 한 글자 ≈ 글자크기).
  // 글자를 조금씩 줄여가며 '마지막 줄에 한두 글자만 남는' 어색한 배치를 피한다.
  const maxLines = cover ? 3 : 3;
  let fitSize = titleSize;
  let titleLines = wrapTitle(card.title, Math.max(6, Math.floor((W - PAD * 2) / (titleSize * 0.97))));
  for (let sz = titleSize; sz >= titleSize * 0.66; sz -= 4) {
    const L = wrapTitle(card.title, Math.max(6, Math.floor((W - PAD * 2) / (sz * 0.97))));
    const orphan = L.length > 1 && L[L.length - 1].length <= 2;
    if (L.length <= maxLines && !orphan) {
      fitSize = sz;
      titleLines = L;
      break;
    }
  }
  const hl = findHighlight(titleLines);

  const cardEl = (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        background: og ? ground : "transparent", // 확대 모드에선 바깥 레이어가 바탕을 칠한다
        position: "relative",
        fontFamily: "Noto",
      }}
    >
      {/* 바탕 질감은 확대 바깥 레이어에서 그린다 (아래 return 참고).
          OG 이미지는 확대를 쓰지 않으므로 여기서 직접 깐다. */}
      {!photoBg && origin && og ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${origin}${paperFor(slug)}`}
            width={W}
            height={H}
            style={{ position: "absolute", top: 0, left: 0, width: W, height: H }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: W,
              height: H,
              background: ground,
              opacity: WASH_LIGHT,
            }}
          />
        </>
      ) : null}

      {/* 표지에 사진이 있으면 사진 + 어두운 그라디언트 */}
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
                "linear-gradient(180deg, rgba(12,10,16,0.32) 0%, rgba(12,10,16,0.7) 52%, rgba(12,10,16,0.93) 100%)",
            }}
          />
        </>
      ) : null}

      {/* ── 얇은 라운드 프레임 — 한 장의 인쇄물처럼 보이게 하는 장치 ── */}
      {og ? null : (
        <div
          style={{
            position: "absolute",
            top: FRAME,
            left: FRAME,
            width: W - FRAME * 2,
            height: H - FRAME * 2,
            border: `2px solid ${line}`,
            borderRadius: 30,
          }}
        />
      )}

      {/* ── 상단 라벨 줄 — 자간을 넓게 벌린 작은 글씨 ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: og ? `${FRAME + 26}px ${PAD}px 0 ${PAD}px` : `${FRAME + 48}px ${PAD}px 0 ${PAD}px`,
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 34,
            height: 34,
            borderRadius: 10,
            background: cover ? "#FFFFFF" : BRAND_PURPLE,
            color: cover ? p.accent : BRAND_YELLOW,
            fontSize: 22,
            fontWeight: 900,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          O
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 23,
            fontWeight: 800,
            color: faint,
            letterSpacing: 3.4,
          }}
        >
          {`ODDSBAG${category ? "  ·  " + category : ""}`}
        </div>
        <div style={{ flex: 1 }} />
        {og ? null : (
          <div style={{ display: "flex", fontSize: 23, fontWeight: 800, color: faint, letterSpacing: 3.4 }}>
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
          // 표지는 가운데로 모아 쌓는다 (아래로만 붙이면 위쪽이 크게 빈다)
          justifyContent: cover ? "center" : "flex-start",
          padding: og ? `24px ${PAD}px 40px ${PAD}px` : `56px ${PAD}px ${FRAME + 96}px ${PAD}px`,
          position: "relative",
        }}
      >
        {/* 표지: 사진이 없으면 큰 이모지 */}
        {cover && !photoBg && emoji ? (
          <div style={{ display: "flex", fontSize: og ? 140 : 300, marginBottom: 40, lineHeight: 1 }}>
            {emoji}
          </div>
        ) : null}

        {/* 제목 — 줄을 직접 나누고, 핵심 한 덩어리만 포인트색으로 물들인다 */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {titleLines.map((raw, li) => {
            const isHit = hl && hl.line === li;
            const at = isHit ? raw.indexOf(hl.hit) : -1;
            const pre = at > 0 ? raw.slice(0, at) : at === 0 ? "" : raw;
            const hit = at >= 0 ? hl!.hit : "";
            const post = at >= 0 ? raw.slice(at + hl!.hit.length) : "";
            return (
              <div
                key={li}
                style={{
                  display: "flex",
                  fontSize: fitSize,
                  fontWeight: 900,
                  lineHeight: 1.24,
                  letterSpacing: -2.6,
                  color: ink,
                }}
              >
                {pre ? (
                  <span style={{ color: ink, marginRight: pre.endsWith(" ") ? fitSize * 0.26 : 0 }}>
                    {pre.trimEnd()}
                  </span>
                ) : null}
                {hit ? <span style={{ color: hitColor }}>{hit}</span> : null}
                {post ? (
                  <span style={{ color: ink, marginLeft: post.startsWith(" ") ? fitSize * 0.26 : 0 }}>
                    {post.trimStart()}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* 제목 아래 얇은 구분선 */}
        {!cover ? (
          <div style={{ display: "flex", width: "100%", height: 2, background: line, marginTop: 34, marginBottom: 34 }} />
        ) : null}

        {/* 본문 — 흰 카드에 담고 오른쪽에 큰 번호를 세운다 */}
        {sentences.length ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              background: cover ? "rgba(255,255,255,.14)" : p.card,
              border: `2px solid ${cover ? "rgba(255,255,255,.22)" : p.line}`,
              borderRadius: 26,
              padding: "40px 40px 42px 40px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              {sentences.map((sen, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", marginBottom: i === sentences.length - 1 ? 0 : 24 }}>
                  <div
                    style={{
                      display: "flex",
                      width: 13,
                      height: 13,
                      borderRadius: 13,
                      background: cover ? "#FFFFFF" : p.accent,
                      marginTop: 17,
                      marginRight: 20,
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flex: 1,
                      fontSize: 37,
                      fontWeight: 500,
                      color: sub,
                      lineHeight: 1.56,
                      wordBreak: "keep-all",
                    }}
                  >
                    {sen}
                  </div>
                </div>
              ))}
            </div>
            {/* 큰 번호 — 오른쪽에 세워 카드에 리듬을 준다 */}
            {stepNo ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 108,
                  fontWeight: 900,
                  color: p.ghost,
                  letterSpacing: -4,
                  marginLeft: 26,
                  lineHeight: 1,
                }}
              >
                {stepNo}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* 표지 하단 안내 */}
        {cover && !og ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              alignSelf: "flex-start",
              marginTop: 40,
              padding: "16px 32px",
              borderRadius: 999,
              background: "#FFFFFF",
              color: p.accent,
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            {`${total}장 전부 보기  →`}
          </div>
        ) : null}
      </div>

      {/* ── 하단: 페이지 표시 + 점 인디케이터 ── */}
      {og ? null : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "absolute",
            bottom: FRAME + 34,
            left: 0,
            width: W,
          }}
        >
          <div style={{ display: "flex", fontSize: 24, fontWeight: 800, color: faint, letterSpacing: 3, marginBottom: 16 }}>
            {last ? "@oddsbag_official  ·  팔로우하고 미리 받기" : `${String(idx + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`}
          </div>
          <div style={{ display: "flex" }}>
            {Array.from({ length: total }).map((_, s) => (
              <div
                key={s}
                style={{
                  display: "flex",
                  width: s === idx ? 26 : 10,
                  height: 10,
                  borderRadius: 10,
                  marginRight: s === total - 1 ? 0 : 9,
                  background: s === idx ? (cover ? "#FFFFFF" : p.accent) : line,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // OG(링크 공유용)는 원래 크기, 인스타 카드는 1440×1800 으로 확대해 내보낸다
  if (og) return cardEl;
  return (
    <div
      style={{
        width: OUT_W,
        height: OUT_H,
        display: "flex",
        overflow: "hidden",
        background: ground,
        position: "relative",
      }}
    >
      {/* 종이 질감 — 확대 바깥에서 출력 크기 그대로 깔아야 카드 전체를 덮는다 */}
      {!photoBg && origin ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${origin}${paperFor(slug)}`}
            width={OUT_W}
            height={OUT_H}
            style={{ position: "absolute", top: 0, left: 0, width: OUT_W, height: OUT_H }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: OUT_W,
              height: OUT_H,
              background: ground,
              opacity: cover ? WASH_COVER : WASH_LIGHT,
            }}
          />
        </>
      ) : null}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          transform: `scale(${OUT_W / W})`,
          transformOrigin: "left top",
        }}
      >
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
    "ODDSBAG@oddsbag_official장 전부 보기팔로우하고미리받기0123456789/→·";
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
      post.slug, // 글마다 다른 종이 결이 걸리도록
      req.nextUrl.origin, // 종이 질감 이미지를 satori 가 받아올 절대 주소
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
