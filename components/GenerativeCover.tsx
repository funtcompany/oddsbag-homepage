import { getDesign, fxStyle, titleFontPx } from "@/lib/design";
import type { Post } from "@/lib/posts";
import type { CSSProperties } from "react";

type Variant = "card" | "hero" | "article";

// 텍스트 크기 상향 (모바일 가독성)
const V: Record<Variant, { pad: string; brand: number; base: number; cat: number; clamp: number }> = {
  card: { pad: "15px 16px 32px", brand: 13, base: 26, cat: 11.5, clamp: 4 },
  hero: { pad: "30px 32px 44px", brand: 17, base: 46, cat: 14.5, clamp: 3 },
  article: { pad: "44px 24px 48px", brand: 15, base: 50, cat: 14.5, clamp: 3 },
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
  const hasPhoto = Boolean(post.cover);

  // 사진이 있으면: 사진 + 어두운 그라디언트 + 흰 타이포 (가독성 보장)
  const titleColor = hasPhoto ? "#fff" : d.title;
  const catColor = hasPhoto ? d.accent : d.catColor;
  const wmColor = hasPhoto ? "#fff" : d.wm;
  const isLight = hasPhoto ? true : d.light;

  const size = titleFontPx(post.title.length, v.base * (variant === "card" ? d.scale : 1));
  const shadow: CSSProperties = isLight
    ? { textShadow: "0 2px 18px rgba(0,0,0,.45)" }
    : {};

  const layers = [];
  if (hasPhoto) {
    layers.push(
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key="photo"
        src={post.cover}
        alt=""
        loading="lazy"
        className="absolute inset-0 z-0 h-full w-full object-cover"
      />,
      <div
        key="scrim"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(to top, rgba(10,6,20,.92) 0%, rgba(10,6,20,.55) 42%, rgba(10,6,20,.12) 100%)",
        }}
      />,
    );
  } else {
    if (d.fx === "blobs") {
      layers.push(
        <div key="fx" className="pointer-events-none absolute inset-0 z-0">
          <span style={{ position: "absolute", width: "48%", height: "48%", borderRadius: "50%", background: `${d.accent}2e`, top: "-10%", left: "-8%", filter: "blur(2px)" }} />
          <span style={{ position: "absolute", width: "34%", height: "34%", borderRadius: "50%", background: `${d.accent}22`, bottom: "-8%", right: "4%", filter: "blur(2px)" }} />
        </div>,
      );
    } else if (d.fx !== "plain") {
      layers.push(<div key="fx" className="pointer-events-none absolute inset-0 z-0" style={fxStyle(d.fx, d.accent)} />);
    }
    // 하단 배치 레이아웃엔 스크림
    if (["bottom", "sidebar", "bignum"].includes(d.layout)) {
      layers.push(
        <div key="scrim" className="pointer-events-none absolute inset-x-0 bottom-0 z-[1]" style={{ height: "72%", background: `linear-gradient(transparent,${d.scrim}b3)` }} />,
      );
    }
  }

  // 모티프 (사진 있을 땐 생략 — 사진이 이미 시각요소)
  let motif = null;
  if (!hasPhoto) {
    if (d.motif === "shape")
      motif = <span className="absolute z-[1]" style={{ right: 16, top: 54, width: 46, height: 46, borderRadius: d.scale > 1 ? "50%" : 12, background: d.accent, opacity: 0.9 }} />;
    else if (d.motif === "corner")
      motif = <span className="absolute z-[1]" style={{ right: -26, top: -26, width: 82, height: 82, background: d.accent, transform: "rotate(45deg)", opacity: 0.9 }} />;
  }

  const underline: CSSProperties =
    !hasPhoto && d.motif === "underline"
      ? { display: "inline", boxShadow: `inset 0 -0.32em 0 ${d.accent}77` }
      : {};

  const titleStyle: CSSProperties = {
    color: titleColor,
    fontSize: size,
    fontWeight: 900,
    letterSpacing: "-0.025em",
    lineHeight: 1.16,
    margin: 0,
    wordBreak: "keep-all",
    overflowWrap: "anywhere",
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: v.clamp,
    ...shadow,
    ...underline,
  };

  const cat = (
    <span style={{ color: catColor, fontSize: v.cat, fontWeight: 900, letterSpacing: "0.1em", display: "block", marginBottom: 7, ...shadow }}>
      {post.category}
    </span>
  );
  const titleEl = <h3 style={titleStyle}>{post.title}</h3>;

  // 히어로는 항상 하단 배치 + 요약까지 (여백을 정보로 채움)
  if (variant === "hero") {
    return (
      <div className={`relative overflow-hidden ${className}`} style={{ background: d.bg, isolation: "isolate" }}>
        {layers}
        {!hasPhoto && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1]" style={{ height: "78%", background: `linear-gradient(transparent,${d.scrim}c4)` }} />
        )}
        <div className="absolute inset-0 z-[3] flex flex-col" style={{ padding: v.pad }}>
          <div className="inline-flex items-center gap-1.5 self-start font-black" style={{ color: titleColor, fontSize: v.brand, letterSpacing: "-0.02em", ...shadow }}>
            <span className="grid place-items-center rounded-[6px] font-black" style={{ width: v.brand + 5, height: v.brand + 5, background: d.accent, color: "#20122e", fontSize: v.brand - 2 }}>O</span>
            ODDSBAG
          </div>
          <div style={{ marginTop: "auto", maxWidth: "42ch" }}>
            {cat}
            {titleEl}
            {post.summary && (
              <p
                className="mt-3 line-clamp-2 text-[15px] font-medium leading-relaxed sm:text-[17px]"
                style={{ color: isLight ? "rgba(255,255,255,.82)" : "rgba(0,0,0,.6)", wordBreak: "keep-all", ...shadow }}
              >
                {post.summary}
              </p>
            )}
          </div>
        </div>
        <span className="absolute z-[4] font-extrabold" style={{ right: 12, bottom: 11, fontSize: 13, color: wmColor, opacity: 0.75, letterSpacing: "0.03em", textShadow: isLight ? "0 1px 6px rgba(0,0,0,.5)" : undefined }}>
          @oddsbag.official
        </span>
      </div>
    );
  }

  // 사진이 있으면 항상 하단 배치 (스크림 위 → 가독성 최고)
  const layout = hasPhoto ? "bottom" : d.layout;

  let body;
  if (layout === "center")
    body = <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">{cat}{titleEl}</div>;
  else if (layout === "topband")
    body = <div style={{ marginTop: 14 }}>{cat}{titleEl}</div>;
  else if (layout === "bignum")
    body = (<><div className="flex flex-1 items-center"><span style={{ fontSize: variant === "card" ? 68 : 128, filter: "drop-shadow(0 4px 14px rgba(0,0,0,.3))" }}>{d.emoji}</span></div><div>{cat}{titleEl}</div></>);
  else if (layout === "sidebar")
    body = <div style={{ marginTop: "auto", paddingLeft: 12, borderLeft: `4px solid ${d.accent}` }}>{cat}{titleEl}</div>;
  else if (layout === "block")
    body = <div style={{ marginTop: "auto", background: d.light ? "#00000040" : "#ffffff2e", padding: 13, borderRadius: 13 }}>{cat}{titleEl}</div>;
  else
    body = <div style={{ marginTop: "auto" }}>{cat}{titleEl}</div>;

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: d.bg, isolation: "isolate" }}>
      {layers}
      {motif}
      <div className="absolute inset-0 z-[3] flex flex-col" style={{ padding: v.pad }}>
        <div className="inline-flex items-center gap-1.5 self-start font-black" style={{ color: titleColor, fontSize: v.brand, letterSpacing: "-0.02em", ...shadow }}>
          <span className="grid place-items-center rounded-[6px] font-black" style={{ width: v.brand + 5, height: v.brand + 5, background: d.accent, color: "#20122e", fontSize: v.brand - 2 }}>O</span>
          ODDSBAG
        </div>
        {body}
      </div>
      <span className="absolute z-[4] font-extrabold" style={{ right: 12, bottom: 11, fontSize: variant === "card" ? 10 : 13, color: wmColor, opacity: 0.75, letterSpacing: "0.03em", textShadow: isLight ? "0 1px 6px rgba(0,0,0,.5)" : undefined }}>
        @oddsbag.official
      </span>
    </div>
  );
}
