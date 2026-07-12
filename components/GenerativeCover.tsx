import { getDesign, fxStyle, titleFontPx } from "@/lib/design";
import type { Post } from "@/lib/posts";
import type { CSSProperties } from "react";

type Variant = "card" | "hero" | "article";

const V: Record<Variant, { pad: string; brand: number; base: number; cat: number; clampCard: number }> = {
  card: { pad: "14px 15px 30px", brand: 12, base: 22, cat: 10, clampCard: 4 },
  hero: { pad: "28px 30px 40px", brand: 15, base: 40, cat: 13, clampCard: 3 },
  article: { pad: "42px 22px 46px", brand: 14, base: 44, cat: 13, clampCard: 3 },
};

export default function GenerativeCover({
  post,
  variant = "card",
  className = "",
}: {
  post: Post;
  variant?: Variant;
  className?: string;
}) {
  const d = getDesign(post);
  const v = V[variant];
  const size = titleFontPx(post.title.length, v.base * (variant === "card" ? d.scale : 1));
  const shadow: CSSProperties = d.light
    ? { textShadow: "0 1px 14px rgba(0,0,0,.35)" }
    : {};
  const isBusy = !["plain", "mesh", "spotlight"].includes(d.fx);

  // 배경 레이어
  const layers = [];
  if (d.fx === "blobs") {
    layers.push(
      <div key="fx" className="pointer-events-none absolute inset-0 z-0">
        <span style={{ position: "absolute", width: "44%", height: "44%", borderRadius: "50%", background: `${d.accent}33`, top: "-8%", left: "-6%" }} />
        <span style={{ position: "absolute", width: "32%", height: "32%", borderRadius: "50%", background: `${d.accent}26`, bottom: "-6%", right: "6%" }} />
      </div>,
    );
  } else if (d.fx === "confetti") {
    const spots = [[10, 8], [70, 14], [40, 6], [85, 26], [22, 20], [58, 10]];
    layers.push(
      <div key="fx" className="pointer-events-none absolute inset-0 z-0">
        {spots.map(([x, y], i) => (
          <span key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: 9, height: 9, background: d.accent, opacity: 0.55, transform: `rotate(${(i * 37) % 90}deg)`, borderRadius: i % 3 ? 2 : 50 }} />
        ))}
      </div>,
    );
  } else if (d.fx !== "plain") {
    layers.push(<div key="fx" className="pointer-events-none absolute inset-0 z-0" style={fxStyle(d.fx, d.accent)} />);
  }

  // 스크림 (하단 배치 레이아웃)
  const needScrim = ["bottom", "sidebar", "bignum"].includes(d.layout);
  if (needScrim) {
    layers.push(
      <div key="scrim" className="pointer-events-none absolute inset-x-0 bottom-0 z-[1]" style={{ height: "70%", background: `linear-gradient(transparent,${d.scrim}b0)` }} />,
    );
  }

  // 모티프
  let motif = null;
  if (d.motif === "shape")
    motif = <span className="absolute z-[1]" style={{ right: 15, top: 50, width: 44, height: 44, borderRadius: d.scale > 1 ? "50%" : 12, background: d.accent, opacity: 0.9 }} />;
  else if (d.motif === "corner")
    motif = <span className="absolute z-[1]" style={{ right: -24, top: -24, width: 78, height: 78, background: d.accent, transform: "rotate(45deg)", opacity: 0.92 }} />;
  else if (d.motif === "dots")
    motif = <span className="absolute z-[1]" style={{ right: 14, top: 48, width: 68, height: 42, backgroundImage: `radial-gradient(${d.accent} 2px,transparent 2.4px)`, backgroundSize: "12px 12px", opacity: 0.85 }} />;

  const underline: CSSProperties =
    d.motif === "underline"
      ? { display: "inline", boxShadow: `inset 0 -0.34em 0 ${d.accent}77` }
      : {};

  const titleStyle: CSSProperties = {
    color: d.title,
    fontSize: size,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    lineHeight: 1.14,
    margin: 0,
    wordBreak: "keep-all",
    overflowWrap: "anywhere",
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: v.clampCard,
    ...shadow,
    ...underline,
  };

  const cat = (
    <span style={{ color: d.catColor, fontSize: v.cat, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 6, ...shadow }}>
      {post.category}
    </span>
  );
  const titleEl = <h3 style={titleStyle}>{post.title}</h3>;

  let body;
  if (d.layout === "center")
    body = <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center">{cat}{titleEl}</div>;
  else if (d.layout === "topband")
    body = <div style={{ marginTop: 12 }}>{cat}{titleEl}</div>;
  else if (d.layout === "bignum")
    body = (<><div className="flex flex-1 items-center"><span style={{ fontSize: variant === "card" ? 64 : 120, filter: "drop-shadow(0 4px 12px rgba(0,0,0,.3))" }}>{d.emoji}</span></div><div>{cat}{titleEl}</div></>);
  else if (d.layout === "sidebar")
    body = <div style={{ marginTop: "auto", paddingLeft: 11, borderLeft: `4px solid ${d.accent}` }}>{cat}{titleEl}</div>;
  else if (d.layout === "block")
    body = <div style={{ marginTop: "auto", background: d.light ? "#00000038" : "#ffffff26", padding: 12, borderRadius: 12 }}>{cat}{titleEl}</div>;
  else
    body = <div style={{ marginTop: "auto" }}>{cat}{titleEl}</div>;

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: d.bg, isolation: "isolate" }}>
      {layers}
      {motif}
      <div className="absolute inset-0 z-[3] flex flex-col" style={{ padding: v.pad }}>
        <div className="inline-flex items-center gap-1.5 self-start font-black" style={{ color: d.title, fontSize: v.brand, letterSpacing: "-0.02em", ...shadow }}>
          <span className="grid place-items-center rounded-[5px] font-black" style={{ width: v.brand + 4, height: v.brand + 4, background: d.accent, color: "#20122e", fontSize: v.brand - 2 }}>O</span>
          ODDSBAG
        </div>
        {body}
      </div>
      <span className="absolute z-[4] font-extrabold" style={{ right: 11, bottom: 10, fontSize: variant === "card" ? 9 : 12, color: d.wm, opacity: 0.72, letterSpacing: "0.04em" }}>
        @oddsbag.official
      </span>
    </div>
  );
}
