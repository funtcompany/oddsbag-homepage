import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ToolCard from "@/components/ToolCard";
import VersionBanner from "@/components/VersionBanner";
import { tools } from "@/lib/tools";
import { getLatestPosts } from "@/lib/posts";
import Link from "next/link";

export default function Home() {
  const latestPosts = getLatestPosts(3);

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* ===== 히어로 ===== */}
        <section className="relative overflow-hidden bg-gradient-to-br from-oddsbag-purple-dark via-oddsbag-purple to-oddsbag-purple-light">
          <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:py-24">
            <div className="mb-4 flex items-center justify-center gap-2">
              <span className="text-4xl font-black tracking-tight text-white sm:text-6xl">
                ODDSBAG
              </span>
              <span className="text-lg font-bold text-oddsbag-yellow sm:text-2xl">
                오즈백
              </span>
            </div>
            <p className="mx-auto max-w-xl text-lg font-bold text-white sm:text-2xl">
              이상하게 필요한 것들,
              <br className="sm:hidden" /> 오즈백에 다 있어
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm text-white/70 sm:text-base">
              데일리로 쓰진 않지만, 어느 순간 갑자기 필요해지는
              <br />
              잡다하고 이색적인 기능들을 한 가방에.
            </p>
            <a
              href="#tools"
              className="mt-8 inline-block rounded-full bg-oddsbag-yellow px-7 py-3 text-sm font-black text-oddsbag-dark transition hover:brightness-95"
            >
              도구 구경하기 ↓
            </a>
          </div>
        </section>

        {/* ===== 툴 그리드 ===== */}
        <section id="tools" className="mx-auto max-w-5xl scroll-mt-16 px-4 py-14">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-oddsbag-dark">
              한번쯤 써볼 도구들
            </h2>
            <p className="mt-1 text-sm text-oddsbag-gray">
              V1 · 일단 열어봐 — 필요할 때 딱 쓰는 10가지
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {tools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        </section>

        {/* ===== V2 티저 배너 ===== */}
        <section className="mx-auto max-w-5xl px-4 pb-14">
          <VersionBanner />
        </section>

        {/* ===== 매거진 ===== */}
        <section className="bg-oddsbag-light-gray/60">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-black text-oddsbag-dark">
                  오즈백 매거진
                </h2>
                <p className="mt-1 text-sm text-oddsbag-gray">
                  오늘의 사회·경제·스포츠 이슈, 오즈백 시선으로
                </p>
              </div>
              <Link
                href="/magazine"
                className="shrink-0 text-sm font-bold text-oddsbag-purple hover:underline"
              >
                전체 보기 →
              </Link>
            </div>

            {latestPosts.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {latestPosts.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/magazine/${post.slug}`}
                    className="group flex flex-col rounded-2xl border border-oddsbag-light-gray bg-white p-5 transition hover:border-oddsbag-purple hover:shadow-lg hover:shadow-oddsbag-purple/10"
                  >
                    <span className="text-xs font-bold text-oddsbag-purple">
                      {post.category}
                    </span>
                    <h3 className="mt-1.5 line-clamp-2 font-bold text-oddsbag-dark">
                      {post.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-oddsbag-gray">
                      {post.summary}
                    </p>
                    <span className="mt-3 text-xs text-oddsbag-gray/70">
                      {post.date}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-oddsbag-purple/30 bg-white p-10 text-center">
                <p className="font-bold text-oddsbag-dark">
                  첫 게시물을 준비하고 있어요 ✍️
                </p>
                <p className="mt-1 text-sm text-oddsbag-gray">
                  이슈를 자동으로 수집해 오즈백 톤으로 정리해 발행합니다.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
