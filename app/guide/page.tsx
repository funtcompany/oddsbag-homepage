import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SearchBox from "@/components/SearchBox";
import Link from "next/link";
import { getAllPosts } from "@/lib/posts";
import { hubs, postsInHub } from "@/lib/hubs";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "주제별 가이드",
  description:
    "맥·윈도우·폰·살림·절약까지, 오즈백의 생활 정보를 주제별로 모았습니다. 필요할 때 찾아보세요.",
  alternates: { canonical: "/guide" },
};

export default async function GuideIndexPage() {
  const posts = await getAllPosts();
  const rows = hubs
    .map((hub) => ({ hub, items: postsInHub(posts, hub) }))
    // 글이 하나도 없는 주제는 보여주지 않는다 (빈 페이지는 독자도 검색엔진도 싫어한다)
    .filter((r) => r.items.length > 0)
    .sort((a, b) => b.items.length - a.items.length);

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="bg-gradient-to-br from-oddsbag-purple-dark via-oddsbag-purple to-oddsbag-purple-light">
          <div className="mx-auto max-w-4xl px-4 py-14 text-center">
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              주제별 가이드
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/80">
              매일 쓰진 않지만 갑자기 필요해지는 것들.
              <br />
              필요할 때 찾아볼 수 있게 주제별로 모았습니다.
            </p>
            <div className="mx-auto mt-7 max-w-md">
              <SearchBox placeholder="찾으시는 걸 검색해 보세요" />
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 py-12">
          {rows.length === 0 ? (
            <p className="text-center text-sm text-oddsbag-gray">
              가이드를 준비하고 있습니다.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {rows.map(({ hub, items }) => (
                <Link
                  key={hub.slug}
                  href={`/guide/${hub.slug}`}
                  className="group rounded-2xl border border-oddsbag-light-gray bg-white p-6 transition hover:border-oddsbag-purple hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{hub.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-lg font-black text-oddsbag-dark transition group-hover:text-oddsbag-purple">
                        {hub.title}
                      </p>
                      <p
                        className="mt-1.5 text-sm leading-relaxed text-oddsbag-gray"
                        style={{ wordBreak: "keep-all" }}
                      >
                        {hub.lead}
                      </p>
                      <p className="mt-3 text-xs font-bold text-oddsbag-purple">
                        글 {items.length}개 보기 →
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
