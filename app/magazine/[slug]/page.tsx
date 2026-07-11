import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostCard from "@/components/PostCard";
import AdSlot from "@/components/AdSlot";
import ReactionBar from "@/components/ReactionBar";
import CommentSection from "@/components/CommentSection";
import AppPromoBand from "@/components/AppPromoBand";
import { getAllPosts, getPostBySlug, getRelatedPosts } from "@/lib/posts";
import { categoryOf } from "@/lib/categories";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "게시물을 찾을 수 없어요" };
  return {
    title: post.title,
    description: post.summary,
    openGraph: { title: post.title, description: post.summary },
  };
}

function renderBody(body: string) {
  return body.split("\n").map((line, i) => {
    if (line.startsWith("## "))
      return (
        <h2 key={i} className="mt-7 text-xl font-black text-oddsbag-dark">
          {line.slice(3)}
        </h2>
      );
    if (line.startsWith("- "))
      return (
        <li key={i} className="ml-5 list-disc text-oddsbag-dark/90">
          {line.slice(2).replace(/\*\*/g, "")}
        </li>
      );
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return (
      <p key={i} className="leading-relaxed text-oddsbag-dark/90">
        {line.replace(/\*\*/g, "")}
      </p>
    );
  });
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const cat = categoryOf(post.category);
  const related = getRelatedPosts(post, 4);

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* 커버 */}
        <div
          className={`relative flex min-h-[220px] items-center justify-center bg-gradient-to-br ${cat.gradient}`}
        >
          <span className="text-7xl opacity-90" aria-hidden>
            {post.emoji ?? cat.emoji}
          </span>
        </div>

        <article className="mx-auto max-w-2xl px-4 py-8">
          <Link
            href={`/category/${cat.slug}`}
            className="text-sm font-bold text-oddsbag-purple hover:underline"
          >
            ← {cat.label}
          </Link>

          <h1 className="mt-3 text-3xl font-black leading-tight text-oddsbag-dark">
            {post.title}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-oddsbag-gray">
            <span>{post.date}</span>
            {post.readMinutes && (
              <>
                <span>·</span>
                <span>{post.readMinutes}분 읽기</span>
              </>
            )}
          </div>

          <p className="mt-4 rounded-xl bg-oddsbag-light-gray/60 p-4 text-[15px] font-medium text-oddsbag-dark/80">
            {post.summary}
          </p>

          <div className="mt-6 space-y-1 text-[15px]">
            {renderBody(post.body)}
          </div>

          {/* 광고 */}
          <div className="my-8">
            <AdSlot />
          </div>

          {/* 반응 */}
          <ReactionBar slug={post.slug} />

          {/* 오즈백 앱 은근한 노출 */}
          <div className="mt-6">
            <AppPromoBand compact />
          </div>

          {/* 출처 */}
          {post.sources && post.sources.length > 0 && (
            <div className="mt-6 rounded-xl bg-oddsbag-light-gray/70 p-4">
              <p className="text-xs font-bold text-oddsbag-gray">출처</p>
              <ul className="mt-2 space-y-1">
                {post.sources.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-oddsbag-purple hover:underline"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 댓글 */}
          <div className="mt-8">
            <CommentSection slug={post.slug} />
          </div>
        </article>

        {/* 관련글 */}
        {related.length > 0 && (
          <div className="border-t border-oddsbag-light-gray bg-oddsbag-light-gray/40">
            <div className="mx-auto max-w-6xl px-4 py-10">
              <h2 className="mb-4 text-xl font-black text-oddsbag-dark">
                이런 글도 있어요
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {related.map((p) => (
                  <PostCard key={p.slug} post={p} />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
