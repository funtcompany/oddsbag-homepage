"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Showcase } from "@/lib/showcase";

/**
 * 홈 맨 위 — 브랜드·프로젝트를 한 칸에 하나씩 담아 좌우로 넘기는 큰 띠.
 *
 * · 6초마다 저절로 다음 칸으로 넘어간다 (마우스를 올리거나 손을 대면 멈춘다)
 * · 손가락으로 좌우로 밀 수 있다 · 키보드 ←/→ 도 된다
 * · 배경 사진이 없는 칸은 브랜드 색 그라디언트 + 큰 이모지로 대신한다
 *   (헌법: 사진이 없으면 타이포와 레이아웃으로 승부한다. 밋밋하게 두지 않는다)
 *
 * ★읽기가 먼저다 — 사진 위에는 반드시 어두운 그라디언트를 깔고 흰 글자를 얹는다.
 *   사진이 밝든 어둡든 글자가 항상 읽힌다.
 */
export default function HeroShowcase({ items }: { items: Showcase[] }) {
  const [idx, setIdx] = useState(0);
  const [hovering, setHovering] = useState(false);
  /** 사람이 «멈춤»을 직접 누른 상태 — 마우스를 치워도 계속 멈춰 있다 */
  const [stopped, setStopped] = useState(false);
  const n = items.length;
  const rootRef = useRef<HTMLElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback((next: number) => setIdx(((next % n) + n) % n), [n]);

  // 저절로 넘어가기
  useEffect(() => {
    if (hovering || stopped || n <= 1) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return; // 움직임을 줄여달라고 한 사람에겐 안 넘긴다
    const t = setTimeout(() => go(idx + 1), 6000);
    return () => clearTimeout(t);
  }, [idx, hovering, stopped, n, go]);

  // 키보드 — 띠 안 어디에 초점이 있든 ←/→ 로 넘긴다.
  //  (예전엔 겉 상자에만 걸어서, 실제로 초점이 잡히는 안쪽 버튼에서는 안 먹었다)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(idx + 1);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(idx - 1);
    }
  };

  // 초점이 띠 안으로 들어오면(탭으로 들어온 사람) 자동 넘김을 멈춘다.
  //  읽는 중에 화면이 바뀌어 버리는 것을 막는다.
  const onFocusIn = () => setHovering(true);
  const onBlurOut = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setHovering(false);
  };

  if (n === 0) return null;

  return (
    <section
      ref={rootRef}
      className="relative overflow-hidden bg-oddsbag-dark"
      aria-roledescription="carousel"
      aria-label="오즈백 주요 소식"
      onKeyDown={onKeyDown}
      onFocus={onFocusIn}
      onBlur={onBlurOut}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onTouchStart={(e) => {
        touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        // ★가로로 «분명히 더 많이» 움직였을 때만 넘긴다.
        //   안 그러면 세로로 스크롤하다가 손가락이 조금 비뚤어져도 배너가 넘어가 버린다.
        if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          go(idx + (dx < 0 ? 1 : -1));
        }
      }}
    >
      {/* 넘어가는 칸들 */}
      <div
        className="flex transition-transform duration-[720ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {items.map((it, i) => (
          <Panel key={it.key} item={it} active={i === idx} index={i} total={n} />
        ))}
      </div>

      {/* 아래쪽 조작 줄 — 진행 막대 + 화살표 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-4 px-4 pb-4 sm:pb-5">
          {/* 진행 막대 — 누르면 그 칸으로 간다.
              막대 자체는 얇지만 버튼은 위아래로 넉넉히 잡아(py-2) 손가락으로 눌린다.
              (얇은 막대 그대로 두면 폰에서 유일한 조작 수단이 6px 이라 눌리지 않는다) */}
          <div className="pointer-events-auto flex flex-1 items-center gap-1.5">
            {items.map((it, i) => (
              <button
                key={it.key}
                onClick={() => go(i)}
                aria-label={`${i + 1}번째 소식 — ${it.name}`}
                aria-current={i === idx}
                className="group/bar flex-1 py-2.5"
              >
                <span className="relative block h-1.5 overflow-hidden rounded-full bg-white/25 transition group-hover/bar:bg-white/45">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-oddsbag-yellow transition-all duration-500"
                    style={{ width: i === idx ? "100%" : "0%" }}
                  />
                </span>
              </button>
            ))}
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {/* 저절로 넘어가는 것을 멈추는 단추.
                마우스를 올려야만 멈출 수 있으면 폰·키보드 사용자는 멈출 방법이 없다. */}
            <button
              onClick={() => setStopped((v) => !v)}
              aria-label={stopped ? "자동 넘김 다시 켜기" : "자동 넘김 멈추기"}
              aria-pressed={stopped}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white backdrop-blur transition hover:border-white hover:bg-white hover:text-oddsbag-dark"
            >
              {stopped ? (
                <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
                  <path d="M7 4l13 8-13 8V4z" fill="currentColor" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
                  <rect x="6" y="4" width="4" height="16" fill="currentColor" />
                  <rect x="14" y="4" width="4" height="16" fill="currentColor" />
                </svg>
              )}
            </button>
            <div className="hidden items-center gap-2 sm:flex">
              <Arrow onClick={() => go(idx - 1)} label="이전 소식" dir="left" />
              <Arrow onClick={() => go(idx + 1)} label="다음 소식" dir="right" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Arrow({
  onClick,
  label,
  dir,
}: {
  onClick: () => void;
  label: string;
  dir: "left" | "right";
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white backdrop-blur transition hover:border-white hover:bg-white hover:text-oddsbag-dark"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function Panel({
  item,
  active,
  index,
  total,
}: {
  item: Showcase;
  active: boolean;
  index: number;
  total: number;
}) {
  return (
    <div
      className="relative w-full shrink-0"
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} / ${total}`}
      aria-hidden={!active}
      /*
        ★inert — 지금 안 보이는 칸을 «없는 것»으로 만든다.
          이게 없으면 탭을 누를 때 화면 밖 칸의 버튼에 초점이 잡힌다.
          그러면 브라우저가 그 버튼을 보여주려고 띠를 옆으로 밀어버려서
          배너가 어긋난 채로 멈춘다 (aria-hidden 만으로는 초점이 막히지 않는다).
      */
      inert={!active}
    >
      {/* ── 배경 ── */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(120deg, ${item.bgFrom}, ${item.bgTo})`,
        }}
      />
      {item.image && (
        <div className="absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image}
            alt=""
            aria-hidden
            className={`h-full w-full object-cover ${active ? "ob-kenburns" : ""}`}
            loading={index === 0 ? "eager" : "lazy"}
            decoding="async"
          />
        </div>
      )}
      {/* 글자가 항상 읽히게 — 왼쪽에서 오른쪽으로 어두워지는 막 */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <div className="ob-grain absolute inset-0" />

      {/* 사진이 없는 칸 — 큰 이모지를 배경 장식으로 */}
      {!item.image && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 select-none text-[190px] leading-none opacity-15 sm:text-[280px]"
        >
          {item.emoji}
        </span>
      )}

      {/* ── 내용 ── */}
      <div className="relative mx-auto flex min-h-[420px] max-w-6xl flex-col justify-center px-4 py-14 sm:min-h-[480px] sm:py-20">
        <div className="max-w-[38ch]">
          <div
            className={`flex flex-wrap items-center gap-2 ${active ? "ob-rise" : "opacity-0"}`}
            style={{ animationDelay: "60ms" }}
          >
            <span className="rounded-full bg-oddsbag-yellow px-2.5 py-1 text-[11px] font-black tracking-wide text-oddsbag-dark">
              {item.badge}
            </span>
            <span className="text-[11px] font-black tracking-[0.22em] text-white/70">
              {item.kicker}
            </span>
          </div>

          <h2
            className={`mt-4 text-[32px] font-black leading-[1.14] text-white sm:text-[52px] ${active ? "ob-rise" : "opacity-0"}`}
            style={{
              letterSpacing: "-0.035em",
              wordBreak: "keep-all",
              animationDelay: "140ms",
            }}
          >
            {item.headline}
          </h2>

          <p
            className={`mt-4 max-w-[44ch] text-[15px] leading-relaxed text-white/85 sm:text-[17px] ${active ? "ob-rise" : "opacity-0"}`}
            style={{ wordBreak: "keep-all", animationDelay: "220ms" }}
          >
            {item.blurb}
          </p>

          <div
            className={`mt-7 flex flex-wrap items-center gap-2.5 ${active ? "ob-rise" : "opacity-0"}`}
            style={{ animationDelay: "300ms" }}
          >
            <Cta cta={item.cta} primary />
            {item.cta2 && <Cta cta={item.cta2} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Cta({
  cta,
  primary,
}: {
  cta: { label: string; href: string; external?: boolean };
  primary?: boolean;
}) {
  const cls = primary
    ? "rounded-full bg-oddsbag-yellow px-6 py-3 text-[15px] font-black text-oddsbag-dark transition hover:brightness-95"
    : "rounded-full border border-white/45 px-6 py-3 text-[15px] font-bold text-white transition hover:border-white hover:bg-white/10";

  if (cta.external) {
    return (
      <a
        href={cta.href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
      >
        {cta.label}
      </a>
    );
  }
  return (
    <Link href={cta.href} className={cls}>
      {cta.label}
    </Link>
  );
}
