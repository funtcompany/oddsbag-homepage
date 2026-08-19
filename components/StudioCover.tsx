import type { CSSProperties } from "react";
import type { CardPost } from "@/lib/cardPost";
import { coverSpecOf, type Motif } from "@/lib/coverSpecs";

/**
 * «만드는 것들» 글 전용 커버 — 카드뉴스 첫 장 서식을 썸네일 비율(4:3)에 맞춰 다시 짠 것.
 *
 *   ┌───────────────────────────┐
 *   │ [O] ODDSBAG      ◦ 꼬리표 │
 *   │                  ┌──────┐ │  ← 그림(모티프). 글마다 다르다
 *   │                  │      │ │
 *   │   윗줄              └──────┘ │
 *   │   ▮아랫줄▮  ← 형광펜        │
 *   └───────────────────────────┘
 *
 * 지키는 것
 *  · 글자 크기는 cqw(칸 너비 비례) — 모바일 2단·데스크톱 4단 어디서도 같은 비율로 보인다
 *  · 아래쪽엔 항상 어두운 그라디언트를 깐다 — 그림 위에서도 글자가 반드시 읽힌다
 *  · 리스트(compact)에서는 글자를 빼고 그림만 크게 — 옆에 제목이 크게 따로 있다
 */

const ACCENT = "#ffe600";
const GROUNDS: Record<string, string> = {
  tools: "linear-gradient(142deg,#241a3a 0%,#3b1b60 52%,#5b2d8e 100%)",
  night: "linear-gradient(142deg,#140f2e 0%,#2a1b4d 55%,#4c2a7a 100%)",
};

// ── 그림(모티프) ──────────────────────────────────────────────
// 전부 viewBox 0 0 120 120. 썸네일에서 뭉개지지 않게 선을 굵게, 요소는 적게.
const W = "rgba(255,255,255,.92)";
const G = "rgba(255,255,255,.13)"; // 유리판
const L = "rgba(255,255,255,.5)"; // 테두리

function MotifArt({ motif }: { motif: Motif }) {
  switch (motif) {
    case "browser":
      return (
        <>
          <rect x="4" y="16" width="112" height="80" rx="10" fill={G} stroke={L} strokeWidth="2.5" />
          <circle cx="16" cy="28" r="3.2" fill={L} />
          <circle cx="26" cy="28" r="3.2" fill={L} />
          <circle cx="36" cy="28" r="3.2" fill={L} />
          <rect x="46" y="22" width="60" height="12" rx="6" fill={ACCENT} />
          <path d="M60 28h32" stroke="#241a3a" strokeWidth="3" strokeLinecap="round" />
          <rect x="16" y="46" width="88" height="7" rx="3.5" fill={W} opacity=".85" />
          <rect x="16" y="60" width="62" height="7" rx="3.5" fill={W} opacity=".5" />
          <rect x="16" y="74" width="34" height="12" rx="6" fill={ACCENT} />
        </>
      );
    case "steps":
      return (
        <>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={6 + i * 16} y={10 + i * 34} width="82" height="26" rx="13" fill={i === 2 ? ACCENT : G} stroke={i === 2 ? "none" : L} strokeWidth="2.5" />
              <circle cx={20 + i * 16} cy={23 + i * 34} r="7" fill={i === 2 ? "#241a3a" : ACCENT} />
              <rect x={32 + i * 16} y={19 + i * 34} width={i === 2 ? 40 : 44} height="8" rx="4" fill={i === 2 ? "#241a3a" : W} opacity={i === 2 ? 1 : 0.75} />
            </g>
          ))}
          <path d="M96 40l6 6-6 6" stroke={L} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "chat":
      return (
        <>
          <path d="M6 18h74a9 9 0 019 9v30a9 9 0 01-9 9H30l-14 12V66h-10a9 9 0 01-9-9V27a9 9 0 019-9z" fill={G} stroke={L} strokeWidth="2.5" />
          <rect x="24" y="30" width="34" height="26" rx="4" fill={W} opacity=".85" />
          <path d="M30 36h22M30 43h16" stroke="#241a3a" strokeWidth="3" strokeLinecap="round" />
          <circle cx="66" cy="50" r="13" fill="#ff5470" />
          <path d="M61 45l10 10M71 45l-10 10" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
          <rect x="46" y="88" width="70" height="24" rx="12" fill={ACCENT} />
          <path d="M60 100h30" stroke="#241a3a" strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="104" cy="100" r="4" fill="#241a3a" />
        </>
      );
    case "grid":
      return (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const x = 6 + (i % 3) * 38;
            const y = 18 + Math.floor(i / 3) * 44;
            const broken = i === 4;
            return (
              <g key={i}>
                <rect x={x} y={y} width="32" height="36" rx="7" fill={broken ? "rgba(255,84,112,.22)" : G} stroke={broken ? "#ff5470" : L} strokeWidth="2.5" />
                {broken ? (
                  <path d={`M${x + 8} ${y + 8}l7 10-6 4 8 8`} stroke="#ff5470" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <>
                    <rect x={x + 7} y={y + 10} width="18" height="5" rx="2.5" fill={W} opacity=".75" />
                    <rect x={x + 7} y={y + 21} width="11" height="5" rx="2.5" fill={ACCENT} opacity=".9" />
                  </>
                )}
              </g>
            );
          })}
        </>
      );
    case "qa":
      return (
        <>
          <path d="M8 14h62a10 10 0 0110 10v26a10 10 0 01-10 10H34L20 72V60h-12a10 10 0 01-10-10V24a10 10 0 0110-10z" transform="translate(6,0)" fill={G} stroke={L} strokeWidth="2.5" />
          <text x="42" y="52" textAnchor="middle" fontSize="34" fontWeight="900" fill={W}>Q</text>
          <path d="M46 74h62a10 10 0 0110 10v22a10 10 0 01-10 10H46a10 10 0 01-10-10V84a10 10 0 0110-10z" fill={ACCENT} />
          <text x="77" y="106" textAnchor="middle" fontSize="30" fontWeight="900" fill="#241a3a">A</text>
        </>
      );
    case "tiles":
      return (
        <>
          {[
            [4, 14], [44, 8], [84, 18],
            [6, 54], [46, 48], [86, 58],
            [46, 88],
          ].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="30" height="30" rx="8" fill={i === 4 ? ACCENT : G} stroke={i === 4 ? "none" : L} strokeWidth="2.5" />
          ))}
          <path d="M53 62l6 7 12-13" stroke="#241a3a" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "compare":
      return (
        <>
          {[
            [8, 62], [36, 44], [64, 74], [92, 26],
          ].map(([x, h], i) => (
            <rect key={i} x={x} y={104 - h} width="20" height={h} rx="6" fill={i === 3 ? ACCENT : G} stroke={i === 3 ? "none" : L} strokeWidth="2.5" />
          ))}
          <path d="M6 108h108" stroke={L} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="102" cy="16" r="11" fill={ACCENT} />
          <path d="M97 16l4 4 7-8" stroke="#241a3a" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "shield":
      return (
        <>
          <path d="M60 8l42 16v30c0 26-17 45-42 58-25-13-42-32-42-58V24z" fill={G} stroke={L} strokeWidth="3" />
          <path d="M40 58l13 14 28-30" stroke={ACCENT} strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "phone":
      return (
        <>
          <rect x="26" y="6" width="68" height="108" rx="14" fill={G} stroke={L} strokeWidth="3" />
          <rect x="50" y="12" width="20" height="4" rx="2" fill={L} />
          <rect x="36" y="24" width="48" height="52" rx="8" fill={W} opacity=".9" />
          <path d="M60 44c-4-7-14-4-14 4 0 7 9 12 14 17 5-5 14-10 14-17 0-8-10-11-14-4z" fill="#ff5470" />
          <rect x="36" y="84" width="48" height="16" rx="8" fill={ACCENT} />
          <path d="M46 92h20" stroke="#241a3a" strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="76" cy="92" r="3.6" fill="#241a3a" />
        </>
      );
    case "bot":
      return (
        <>
          <path d="M60 8v12" stroke={L} strokeWidth="3" strokeLinecap="round" />
          <circle cx="60" cy="8" r="5" fill={ACCENT} />
          <rect x="22" y="20" width="76" height="56" rx="16" fill={G} stroke={L} strokeWidth="2.5" />
          <circle cx="45" cy="44" r="7" fill={ACCENT} />
          <circle cx="75" cy="44" r="7" fill={ACCENT} />
          <path d="M46 60h28" stroke={W} strokeWidth="4" strokeLinecap="round" />
          <path d="M60 82v14" stroke={L} strokeWidth="3" strokeLinecap="round" />
          <path d="M52 90l8 8 8-8" stroke={ACCENT} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="30" y="100" width="60" height="14" rx="7" fill={ACCENT} />
          <path d="M42 107h24" stroke="#241a3a" strokeWidth="3.4" strokeLinecap="round" />
        </>
      );
    case "stars":
      return (
        <>
          <path d="M78 14a38 38 0 100 68 44 44 0 010-68z" fill={ACCENT} opacity=".95" />
          <path d="M28 22l3.5 8 8 3.5-8 3.5L28 45l-3.5-8-8-3.5 8-3.5z" fill={W} />
          <path d="M100 62l2.6 6 6 2.6-6 2.6-2.6 6-2.6-6-6-2.6 6-2.6z" fill={W} opacity=".85" />
          <rect x="30" y="86" width="60" height="28" rx="9" fill={G} stroke={L} strokeWidth="2.5" />
          <path d="M40 96h30M40 105h20" stroke={W} strokeWidth="3.4" strokeLinecap="round" opacity=".8" />
        </>
      );
  }
}

/** 두 줄 중 긴 쪽에 맞춰 글자 크기를 정한다 (칸 너비 비례) */
function headlineSize(lines: [string, string]): number {
  const len = Math.max(lines[0].length, lines[1].length);
  if (len <= 6) return 13;
  if (len <= 8) return 11.6;
  if (len <= 10) return 10.2;
  if (len <= 13) return 8.8;
  return 7.7;
}

export default function StudioCover({
  post,
  className = "",
  compact = false,
}: {
  post: CardPost;
  className?: string;
  /** 리스트 보기용 — 글자를 빼고 그림만 크게 (옆에 제목이 따로 크게 있다) */
  compact?: boolean;
}) {
  const spec = coverSpecOf(post.slug);
  if (!spec) return null;

  const ground = GROUNDS[spec.tone ?? "tools"];
  const fs = headlineSize(spec.lines);

  const shell: CSSProperties = {
    background: ground,
    containerType: "inline-size",
    isolation: "isolate",
  };

  const art = (
    <svg viewBox="0 0 120 120" fill="none" style={{ width: "100%", height: "100%", display: "block" }}>
      <MotifArt motif={spec.motif} />
    </svg>
  );

  if (compact) {
    return (
      <div className={`relative overflow-hidden ${className}`} style={shell}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(75% 70% at 50% 34%,rgba(255,230,0,.18),transparent 66%)" }}
        />
        <div className="absolute inset-0 grid place-items-center" style={{ padding: "16cqw" }}>
          {art}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={shell}>
      {/* 포인트색 은은한 빛 — 바탕이 단색으로 죽지 않게 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(70% 62% at 80% 16%,rgba(255,230,0,.17),transparent 64%)" }}
      />

      {/* 그림 — 오른쪽 위. 아래쪽은 글자 자리라 비워 둔다 */}
      <div
        className="pointer-events-none absolute"
        style={{ right: "1cqw", top: "8cqw", width: "43cqw", height: "43cqw", opacity: 0.95 }}
      >
        {art}
      </div>

      {/* 아래 어둠 — 그림 위에 글자가 겹쳐도 반드시 읽히게 (가독성이 먼저다) */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{ height: "72%", background: "linear-gradient(transparent,rgba(12,7,24,.55) 42%,rgba(12,7,24,.9))" }}
      />

      <div className="absolute inset-0 flex flex-col" style={{ padding: "6cqw 6.5cqw 6.5cqw" }}>
        {/* 위 줄 — 브랜드 + 꼬리표 */}
        <div className="flex items-start justify-between gap-2">
          <span
            className="inline-flex items-center font-black text-white"
            style={{ fontSize: "5cqw", letterSpacing: "-0.02em", gap: "1.2cqw" }}
          >
            <span
              className="grid place-items-center font-black"
              style={{ width: "6.4cqw", height: "6.4cqw", borderRadius: "1.8cqw", background: ACCENT, color: "#20122e", fontSize: "4.6cqw" }}
            >
              O
            </span>
            ODDSBAG
          </span>
          <span
            className="shrink-0 font-black"
            style={{
              fontSize: "4.4cqw",
              padding: "1.1cqw 2.6cqw",
              borderRadius: "999px",
              background: "rgba(255,255,255,.16)",
              color: "#fff",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
          >
            {spec.badge}
          </span>
        </div>

        {/* 후킹 문구 — 아랫줄에 형광펜 */}
        <div style={{ marginTop: "auto" }}>
          <p
            className="font-black text-white"
            style={{ fontSize: `${fs}cqw`, lineHeight: 1.18, letterSpacing: "-0.035em", margin: 0, wordBreak: "keep-all", textShadow: "0 2px 12px rgba(0,0,0,.5)" }}
          >
            {spec.lines[0]}
          </p>
          <p className="font-black" style={{ margin: 0, marginTop: "1cqw", lineHeight: 1.18 }}>
            <span
              style={{
                fontSize: `${fs}cqw`,
                letterSpacing: "-0.035em",
                color: "#fff",
                wordBreak: "keep-all",
                boxDecorationBreak: "clone",
                WebkitBoxDecorationBreak: "clone",
                background: `linear-gradient(transparent 56%, rgba(255,230,0,.85) 56%)`,
                padding: "0 0.6cqw",
              }}
            >
              {spec.lines[1]}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
