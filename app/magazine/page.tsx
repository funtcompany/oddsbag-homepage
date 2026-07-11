import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getAllPosts } from "@/lib/posts";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "매거진",
  description:
    "오늘의 사회·경제·스포츠 이슈를 오즈백 시선으로 정리한 매거진.",
};

export default function MagazinePage() {
  const posts = getAllPosts();

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="border-b border-oddsbag-light-gray bg-oddsbag-light-gray/40">
          <div className="mx-auto max-w-5xl px-4 py-12">
            <h1 className="text-3xl font-black text-oddsbag-dark">오즈백 매거진</h1>
            <p className="mt-2 text-sm text-oddsbag-gray">
              오늘의 사회·경제·스포츠 이슈, 오즈백 시선으로
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-12">
          {posts.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/magazine/${post.slug}`}
                  className="group flex flex-col rounded-2xl border border-oddsbag-light-gray bg-white p-5 transition hover:border-oddsbag-purple hover:shadow-lg hover:shadow-oddsbag-purple/10"
                >
                  <span className="text-xs font-bold text-oddsbag-purple">
                    {post.category}
                  </span>
                  <h2 className="mt-1.5 line-clamp-2 text-lg font-bold text-oddsbag-dark">
                    {post.title}
                  </h2>
                  <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-oddsbag-gray">
                    {post.summary}
                  </p>
                  <span className="mt-3 text-xs text-oddsbag-gray/70">
                    {post.date}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-oddsbag-purple/30 bg-white p-12 text-center">
              <p className="font-bold text-oddsbag-dark">
                아직 발행된 게시물이 없어요
              </p>
              <p className="mt-1 text-sm text-oddsbag-gray">
                곧 첫 이슈를 정리해 올릴게요.
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
