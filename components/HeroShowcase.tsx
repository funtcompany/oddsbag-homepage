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
  const [paused, setPaused] = useState(false);
  const n = items.length;
  const trackRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (next: number) => setIdx(((next % n) + n) % n),
    [n],
  );

  // 저절로 넘어가기
  useEffect(() => {
    if (paused || n <= 1) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return; // 움직임을 줄여달라고 한 사람에겐 안 넘긴다
    const t = setTimeout(() => go(idx + 1), 6000);
    return () => clearTimeout(t);
  }, [idx, paused, n, go]);

  // 키보드
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(idx + 1);
      if (e.key === "ArrowLeft") go(idx - 1);
    };
    const el = trackRef.current?.parentElement;
    el?.addEventListener("keydown", onKey as EventListener);
    return () => el?.removeEventListener("keydown", onKey as EventListener);
  }, [idx, go]);

  if (n === 0) return null;

  return (
    <section
      className="relative overflow-hidden bg-oddsbag-dark"
      aria-roledescription="carousel"
      aria-label="오즈백 주요 소식"
      tabIndex={-1}
      data-cursor="big"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        setPaused(true);
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        setPaused(false);
        if (start == null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 44) go(idx + (dx < 0 ? 1 : -1));
      }}
    >
      {/* 넘어가는 칸들 */}
      <div
        ref={trackRef}
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
          <div className="pointer-events-auto flex flex-1 items-center gap-1.5">
            {items.map((it, i) => (
              <button
                key={it.key}
                onClick={() => go(i)}
                aria-label={`${i + 1}번째 소식 — ${it.name}`}
                aria-current={i === idx}
                className="group/bar relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/25 transition hover:bg-white/40"
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-oddsbag-yellow transition-all duration-500"
                  style={{ width: i === idx ? "100%" : "0%" }}
                />
              </button>
            ))}
          </div>

          <div className="pointer-events-auto hidden items-center gap-2 sm:flex">
            <Arrow onClick={() => go(idx - 1)} label="이전 소식" dir="left" />
            <Arrow onClick={() => go(idx + 1)} label="다음 소식" dir="right" />
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
