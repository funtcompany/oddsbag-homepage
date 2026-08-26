import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SubscribeBox from "@/components/SubscribeBox";
import Link from "next/link";
import { tools, categoryStyles } from "@/lib/tools";
import { getSiteConfig } from "@/lib/sitecfg";
import { services as catalog } from "@/lib/services-catalog";
import { TOOLS_HUB_NAME, TOOLS_HUB_TAGLINE, TOOLS_HUB_HREF } from "@/lib/tools-hub";
import {
  CHECKLIST_NAME,
  CHECKLIST_TAGLINE,
  CHECKLIST_EMOJI,
  CHECKLIST_HREF,
} from "@/lib/checklist";
import type { Metadata } from "next";

export const revalidate = 60;

// 아직 만들지 않은 앱 도구 13종을 화면에 깔아두면
//  사람이 눌러보고 빈손으로 나간다 → 내려둔다 (지시 2026-08-12).
//  실제로 앱이 나오면 이 값만 true 로 바꾸면 그대로 다시 나온다.
const 앱라인업_공개 = false;

export const metadata: Metadata = {
  title: "서비스",
  description:
    "오즈백이 운영하는 서비스 모음 — WPMS 무선 발표 관리 시스템, 별의 결, 오즈백 매거진, 오즈백 뮤직, 오즈백 테일즈.",
  alternates: { canonical: "/services" },
};

export default async function ServicesPage() {
  const cfg = await getSiteConfig();
  const cards = cfg.services.filter((c) => c.enabled);

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="bg-gradient-to-br from-oddsbag-purple-dark via-oddsbag-purple to-oddsbag-purple-light">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="text-4xl" aria-hidden>
              🧰
            </div>
            <h1
              className="mt-3 text-[30px] font-black leading-tight text-white sm:text-[40px]"
              style={{ letterSpacing: "-0.03em", wordBreak: "keep-all" }}
            >
              오즈백 서비스
            </h1>
            <p
              className="mt-4 max-w-[46ch] text-[16px] leading-relaxed text-white/80 sm:text-[18px]"
              style={{ wordBreak: "keep-all" }}
            >
              데일리로 쓰진 않지만 어느 순간 갑자기 필요해지는 것들. 한 가방에
              담아 두고 필요할 때 꺼내 씁니다.
            </p>
          </div>
        </section>

        {/* 안내 화면이 따로 있는 서비스 — 눌러 들어가면 이용·구매 버튼과 관련 글이 있다
            (2026-08-18 리뉴얼. 목록은 lib/services-catalog.ts 한 곳에서 온다) */}
        <section className="mx-auto max-w-6xl px-4 pt-12">
          <h2 className="text-xl font-black text-oddsbag-dark">
            자세히 보실 수 있는 서비스
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {catalog.map((s, i) => (
              <Link
                key={s.slug}
                href={`/oddsbag/service/${s.slug}`}
                data-reveal-index={i}
                className="ob-reveal ob-lift group relative flex flex-col overflow-hidden rounded-2xl p-6 text-white"
                style={{
                  background: `linear-gradient(125deg, ${s.bgFrom}, ${s.bgTo})`,
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-3 -top-3 select-none text-[110px] leading-none opacity-15"
                >
                  {s.emoji}
                </span>
                <span
                  className={`relative w-fit rounded-full px-2.5 py-1 text-[11px] font-black ${s.statusTone}`}
                >
                  {s.status}
                </span>
                <h3 className="relative mt-4 text-[20px] font-black">
                  {s.name}
                </h3>
                <p
                  className="relative mt-2 max-w-[42ch] text-[14px] leading-relaxed text-white/85"
                  style={{ wordBreak: "keep-all" }}
                >
                  {s.lead}
                </p>
                <span className="relative mt-5 text-[13.5px] font-black text-oddsbag-yellow">
                  자세히 보기 →
                </span>
              </Link>
            ))}

            {/* 챙길 것 — 오즈백이 확인해 둔 것 모음 (2026-08-26 신설) */}
            <Link
              href={CHECKLIST_HREF}
              className="ob-reveal ob-lift group relative flex flex-col overflow-hidden rounded-2xl p-6 text-white"
              style={{ background: "linear-gradient(125deg, #134e4a, #0f766e)" }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-3 -top-3 select-none text-[110px] leading-none opacity-15"
              >
                {CHECKLIST_EMOJI}
              </span>
              <span className="relative w-fit rounded-full bg-oddsbag-yellow/25 px-2.5 py-1 text-[11px] font-black text-oddsbag-yellow">
                새로 나옴
              </span>
              <h3 className="relative mt-4 text-[20px] font-black">
                {CHECKLIST_NAME}
              </h3>
              <p
                className="relative mt-2 max-w-[42ch] text-[14px] leading-relaxed text-white/85"
                style={{ wordBreak: "keep-all" }}
              >
                {CHECKLIST_TAGLINE}
              </p>
              <span className="relative mt-5 text-[13.5px] font-black text-oddsbag-yellow">
                자세히 보기 →
              </span>
            </Link>

            {/* 오즈백 툴즈 — 웹 도구 모음 (2026-08-19 신설) */}
            <Link
              href={TOOLS_HUB_HREF}
              className="ob-reveal ob-lift group relative flex flex-col overflow-hidden rounded-2xl p-6 text-white"
              style={{ background: "linear-gradient(125deg, #0f172a, #6d28d9)" }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-3 -top-3 select-none text-[110px] leading-none opacity-15"
              >
                🧰
              </span>
              <span className="relative w-fit rounded-full bg-oddsbag-yellow/25 px-2.5 py-1 text-[11px] font-black text-oddsbag-yellow">
                새로 나옴
              </span>
              <h3 className="relative mt-4 text-[20px] font-black">
                {TOOLS_HUB_NAME}
              </h3>
              <p
                className="relative mt-2 max-w-[42ch] text-[14px] leading-relaxed text-white/85"
                style={{ wordBreak: "keep-all" }}
              >
                {TOOLS_HUB_TAGLINE}
              </p>
              <span className="relative mt-5 text-[13.5px] font-black text-oddsbag-yellow">
                자세히 보기 →
              </span>
            </Link>
          </div>
        </section>

        {/* 서비스 카드 — 관리자 화면에서 추가·수정할 수 있다 */}
        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-xl font-black text-oddsbag-dark">운영 중인 서비스</h2>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <Link
                key={c.id}
                href={c.href || "/services"}
                className="flex flex-col rounded-2xl border border-oddsbag-light-gray bg-white p-5 transition hover:-translate-y-0.5 hover:border-oddsbag-purple hover:shadow-lg hover:shadow-oddsbag-purple/10"
              >
                <div className="flex items-start justify-between">
                  <span className="text-3xl" aria-hidden>
                    {c.emoji}
                  </span>
                  {c.badge && (
                    <span className="rounded-full bg-oddsbag-yellow/25 px-2 py-0.5 text-[11px] font-bold text-oddsbag-dark">
                      {c.badge}
                    </span>
                  )}
                </div>
                <h3 className="mt-3 text-base font-black text-oddsbag-dark">
                  {c.title}
                </h3>
                <p
                  className="mt-1 text-sm leading-relaxed text-oddsbag-gray"
                  style={{ wordBreak: "keep-all" }}
                >
                  {c.desc}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* 앱 라인업 — 앱이 실제로 나오기 전까지는 내려둔다 */}
        {앱라인업_공개 && (
        <section className="border-t border-oddsbag-light-gray bg-oddsbag-light-gray/30">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <h2 className="text-xl font-black text-oddsbag-dark">
              오즈백 앱 라인업
            </h2>
            <p className="mt-1 text-sm text-oddsbag-gray">
              V1 · 일단 열어봐 — 필요할 때 딱 쓰는 도구들 · 안드로이드 출시 준비 중
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {tools.map((tool) => (
                <div
                  key={tool.slug}
                  className="flex flex-col rounded-2xl border border-oddsbag-light-gray bg-white p-4"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <span className="text-3xl" aria-hidden>
                      {tool.emoji}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${categoryStyles[tool.category]}`}
                    >
                      {tool.category}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-oddsbag-dark">
                    {tool.title}
                  </h3>
                  <p
                    className="mt-1 flex-1 text-sm leading-relaxed text-oddsbag-gray"
                    style={{ wordBreak: "keep-all" }}
                  >
                    {tool.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
        )}

        <div className="mx-auto max-w-6xl px-4 py-12">
          <SubscribeBox />
        </div>
      </main>
      <Footer />
    </>
  );
}
