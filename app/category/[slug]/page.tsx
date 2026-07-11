import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostCard from "@/components/PostCard";
import AdSlot from "@/components/AdSlot";
import { categories, getCategoryBySlug } from "@/lib/categories";
import { getPostsByCategory } from "@/lib/posts";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cat = getCategoryBySlug(slug);
  if (!cat) return { title: "카테고리를 찾을 수 없어요" };
  return {
    title: `${cat.label} 이슈`,
    description: `${cat.label} 분야의 이슈를 오즈백 시선으로 정리했어요.`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cat = getCategoryBySlug(slug);
  if (!cat) notFound();

  const posts = getPostsByCategory(cat.label);

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className={`bg-gradient-to-br ${cat.gradient}`}>
          <div className="mx-auto max-w-6xl px-4 py-12 text-white">
            <span className="text-5xl">{cat.emoji}</span>
            <h1 className="mt-2 text-3xl font-black">{cat.label}</h1>
            <p className="mt-1 text-sm text-white/80">
              {cat.label} 분야의 이슈, 오즈백 시선으로
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-10">
          {posts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {posts.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-oddsbag-purple/30 bg-white p-12 text-center">
              <p className="font-bold text-oddsbag-dark">
                아직 이 카테고리에 글이 없어요
              </p>
              <p className="mt-1 text-sm text-oddsbag-gray">곧 채워집니다!</p>
            </div>
          )}

          <div className="mt-10">
            <AdSlot />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
