import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SubscribeBox from "@/components/SubscribeBox";
import Link from "next/link";
import { tools, categoryStyles } from "@/lib/tools";
import { getSiteConfig } from "@/lib/sitecfg";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "서비스",
  description:
    "오즈백이 운영하는 서비스 모음 — 오즈백 앱(이색 도구 10종), 매거진, 뮤직, 뉴스레터.",
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

        {/* 앱 라인업 */}
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

        <div className="mx-auto max-w-6xl px-4 py-12">
          <SubscribeBox />
        </div>
      </main>
      <Footer />
    </>
  );
}
