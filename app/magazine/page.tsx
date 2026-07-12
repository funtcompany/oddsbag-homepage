import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostCard from "@/components/PostCard";
import { getAllPosts } from "@/lib/posts";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "전체 이슈",
  description: "오즈백 매거진의 모든 이슈를 한눈에.",
};

export const revalidate = 60;

export default async function MagazinePage() {
  const posts = await getAllPosts();

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="border-b border-oddsbag-light-gray bg-oddsbag-light-gray/40">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <h1 className="text-3xl font-black text-oddsbag-dark">전체 이슈</h1>
            <p className="mt-2 text-sm text-oddsbag-gray">
              오즈백 매거진의 모든 글 · 총 {posts.length}개
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
