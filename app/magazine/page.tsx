import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostCard from "@/components/PostCard";
import PostListView from "@/components/PostListView";
import { toCardPosts } from "@/lib/cardPost";
import SearchBox from "@/components/SearchBox";
import { getVisiblePosts, getMagazinePosts } from "@/lib/posts";
import { searchPosts, looseSearch } from "@/lib/search";
import { categories } from "@/lib/categories";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 60;

type SP = { q?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SP>;
}): Promise<Metadata> {
  const q = (await searchParams).q?.trim();
  if (q) {
    return {
      title: `"${q}" 검색 결과`,
      description: `오즈백 매거진에서 "${q}"를 검색한 결과입니다.`,
      // 검색 결과 페이지는 색인시키지 않는다 (검색어마다 중복 페이지가 무한히 생긴다)
      robots: { index: false, follow: true },
    };
  }
  return {
    title: "전체 이슈",
    description: "오즈백 매거진의 모든 이슈를 한눈에. 키워드로 검색해 보세요.",
    alternates: { canonical: "/magazine" },
  };
}

export default async function MagazinePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const q = ((await searchParams).q ?? "").trim();
  // 이 화면은 둘을 겸한다 — 검색창(사이트 전체)과 「전체 이슈」 목록(매거진 코너).
  // 검색은 뮤직·이야기·오즈백 글까지 찾아줘야 하고,
  // 목록과 「총 N개」는 매거진 글만 세야 한다. 안 그러면 코너가 서로 섞인다. (2026-08-18)
  const all = await getVisiblePosts();
  const posts = q ? all : await getMagazinePosts();

  const hits = q ? searchPosts(all, q) : [];
  const suggestions = q && hits.length === 0 ? looseSearch(all, q) : [];

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="border-b border-oddsbag-light-gray bg-oddsbag-light-gray/40">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <h1 className="text-3xl font-black text-oddsbag-dark">
              {q ? "검색 결과" : "전체 이슈"}
            </h1>
            <p className="mt-2 text-sm text-oddsbag-gray">
              {q ? (
                <>
                  <strong className="text-oddsbag-dark">
                    &ldquo;{q}&rdquo;
                  </strong>{" "}
                  검색 결과 {hits.length}개
                </>
              ) : (
                <>오즈백 매거진의 모든 글 · 총 {posts.length}개</>
              )}
            </p>

            <div className="mt-5 max-w-xl">
              <SearchBox defaultValue={q} />
            </div>

            {q && (
              <Link
                href="/magazine"
                className="mt-3 inline-block text-sm font-bold text-oddsbag-purple hover:underline"
              >
                ← 전체 글 보기
              </Link>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-10">
          {q && hits.length === 0 ? (
            <div className="py-6">
              <p className="text-lg font-bold text-oddsbag-dark">
                &ldquo;{q}&rdquo;에 맞는 글을 찾지 못했습니다.
              </p>
              <p className="mt-2 text-sm text-oddsbag-gray">
                띄어쓰기를 바꾸거나, 더 짧은 단어로 검색해 보세요.
              </p>

              {suggestions.length > 0 && (
                <div className="mt-8">
                  <p className="text-sm font-bold text-oddsbag-dark">
                    혹시 이런 글을 찾으셨나요?
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {suggestions.map((p) => (
                      <PostCard key={p.slug} post={p} />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-10">
                <p className="text-sm font-bold text-oddsbag-dark">
                  분야별로 둘러보기
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/category/${c.slug}`}
                      className="rounded-full border border-oddsbag-light-gray px-3 py-1.5 text-sm font-medium text-oddsbag-dark transition hover:border-oddsbag-purple hover:text-oddsbag-purple"
                    >
                      {c.emoji} {c.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <PostListView
              posts={toCardPosts(q ? hits.map((h) => h.post) : posts)}
              emptyText={q ? "검색 결과가 없습니다." : "아직 올라온 글이 없습니다."}
            />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
