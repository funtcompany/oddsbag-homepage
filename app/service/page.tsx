import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostListView from "@/components/PostListView";
import Link from "next/link";
import type { Metadata } from "next";
import { getPostsByChannel } from "@/lib/posts";
import { toCardPosts } from "@/lib/cardPost";
import { boardKeyOf } from "@/lib/boards";
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

export const revalidate = 60;

// 오즈백 툴즈 — 웹 도구 모음 랜딩. 도구가 늘어나면 lib/tools-hub.ts 배열만 채우면 된다.
export default async function ToolsHubPage() {
  // ★도구가 아직 하나뿐이라 카드 한 장만 놓으면 화면 아래 三분의 二가 텅 빈다.
  //   들어온 사람이 빈손으로 나간다. 사용법·문제해결 글이 10편이나 있는데
  //   여기서 이어지는 길이 없었다 → 아래에 붙인다. (안쪽 링크라 검색에도 도움이 된다)
  const 사용법 = (await getPostsByChannel("oddsbag")).filter(
    (p) => boardKeyOf(p) === "htmllink",
  );

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

        {사용법.length > 0 && (
          <section className="border-t border-oddsbag-light-gray bg-oddsbag-light-gray/30">
            <div className="mx-auto max-w-6xl px-4 py-12">
              <h2 className="text-xl font-black text-oddsbag-dark">
                도구 쓰는 법 · 막힐 때
              </h2>
              <p className="mt-1 text-sm text-oddsbag-gray">
                처음 쓰실 때 한 번 훑어보시면 헤맬 일이 줄어듭니다
              </p>
              <div className="mt-6">
                <PostListView posts={toCardPosts(사용법)} />
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
