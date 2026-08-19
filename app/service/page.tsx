import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import type { Metadata } from "next";
import {
  TOOLS_HUB_NAME,
  TOOLS_HUB_TAGLINE,
  TOOLS_HUB_EMOJI,
  hubTools,
} from "@/lib/tools-hub";

export const metadata: Metadata = {
  title: TOOLS_HUB_NAME,
  description: TOOLS_HUB_TAGLINE,
  alternates: { canonical: "/service" },
};

// 오즈백 툴즈 — 웹 도구 모음 랜딩. 도구가 늘어나면 lib/tools-hub.ts 배열만 채우면 된다.
export default function ToolsHubPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="bg-gradient-to-br from-oddsbag-purple-dark via-oddsbag-purple to-oddsbag-purple-light">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="text-4xl" aria-hidden>
              {TOOLS_HUB_EMOJI}
            </div>
            <h1
              className="mt-3 text-[30px] font-black leading-tight text-white sm:text-[40px]"
              style={{ letterSpacing: "-0.03em", wordBreak: "keep-all" }}
            >
              {TOOLS_HUB_NAME}
            </h1>
            <p
              className="mt-4 max-w-[46ch] text-[16px] leading-relaxed text-white/80 sm:text-[18px]"
              style={{ wordBreak: "keep-all" }}
            >
              {TOOLS_HUB_TAGLINE}
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hubTools.map((t, i) => (
              <Link
                key={t.slug}
                href={t.href}
                data-reveal-index={i}
                className="ob-reveal ob-lift group flex flex-col rounded-2xl border border-oddsbag-light-gray bg-white p-6 hover:border-oddsbag-purple hover:shadow-lg hover:shadow-oddsbag-purple/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-4xl" aria-hidden>
                    {t.emoji}
                  </span>
                  <span className="rounded-full bg-oddsbag-light-gray px-2 py-0.5 text-[11px] font-bold text-oddsbag-gray">
                    {t.status}
                  </span>
                </div>
                <h2 className="mt-4 text-lg font-black text-oddsbag-dark group-hover:text-oddsbag-purple">
                  {t.name}
                </h2>
                <p
                  className="mt-2 flex-1 text-sm leading-relaxed text-oddsbag-gray"
                  style={{ wordBreak: "keep-all" }}
                >
                  {t.desc}
                </p>
                <span className="mt-5 text-[13.5px] font-black text-oddsbag-purple">
                  열어보기 →
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
