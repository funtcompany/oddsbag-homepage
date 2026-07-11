import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SubscribeBox from "@/components/SubscribeBox";
import { tools } from "@/lib/tools";
import { categoryStyles } from "@/lib/tools";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "오즈백 앱",
  description:
    "이상하게 필요한 것들을 담은 오즈백 앱. 사과문 생성기, 수면 사이클 역산기, 카페인 계산기 등 이색 도구 모음.",
};

export default function AppsPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* 히어로 */}
        <section className="bg-gradient-to-br from-oddsbag-purple-dark via-oddsbag-purple to-oddsbag-purple-light">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center">
            <div className="mb-3 flex items-center justify-center gap-2">
              <span className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                ODDSBAG
              </span>
              <span className="text-lg font-bold text-oddsbag-yellow">앱</span>
            </div>
            <p className="mx-auto max-w-lg text-lg font-bold text-white">
              이상하게 필요한 것들, 앱으로 챙기세요
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm text-white/75">
              데일리로 쓰진 않지만, 어느 순간 갑자기 필요해지는
              <br />
              잡다하고 이색적인 도구들을 한 가방에.
            </p>
            <div className="mt-7 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/80">
              📱 안드로이드 앱 출시 준비 중 · 출시되면 가장 먼저 알려드릴게요
            </div>
          </div>
        </section>

        {/* 앱 라인업 (기존 툴) */}
        <section className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-black text-oddsbag-dark">앱 라인업</h2>
          <p className="mt-1 text-sm text-oddsbag-gray">
            V1 · 일단 열어봐 — 필요할 때 딱 쓰는 도구들
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
                <p className="mt-1 flex-1 text-sm leading-relaxed text-oddsbag-gray">
                  {tool.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 구독 유도 */}
        <div className="mx-auto max-w-5xl px-4 pb-16">
          <SubscribeBox />
        </div>
      </main>
      <Footer />
    </>
  );
}
