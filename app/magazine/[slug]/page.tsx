import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getAllPosts, getPostBySlug } from "@/lib/posts";
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

// 아주 가벼운 마크다운 → HTML 변환 (제목/리스트/문단만)
function renderBody(body: string) {
  return body.split("\n").map((line, i) => {
    if (line.startsWith("## "))
      return (
        <h2 key={i} className="mt-6 text-xl font-black text-oddsbag-dark">
          {line.slice(3)}
        </h2>
      );
    if (line.startsWith("- "))
      return (
        <li key={i} className="ml-5 list-disc text-oddsbag-dark/90">
          {line.slice(2)}
        </li>
      );
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return (
      <p key={i} className="leading-relaxed text-oddsbag-dark/90">
        {line}
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

  return (
    <>
      <Header />
      <main className="flex-1">
        <article className="mx-auto max-w-2xl px-4 py-12">
          <Link
            href="/magazine"
            className="text-sm font-medium text-oddsbag-purple hover:underline"
          >
            ← 매거진으로
          </Link>

          <div className="mt-4">
            <span className="rounded-full bg-oddsbag-purple/10 px-2.5 py-0.5 text-xs font-bold text-oddsbag-purple">
              {post.category}
            </span>
            <h1 className="mt-3 text-3xl font-black leading-tight text-oddsbag-dark">
              {post.title}
            </h1>
            <p className="mt-2 text-sm text-oddsbag-gray">{post.date}</p>
          </div>

          <div className="mt-8 space-y-1 text-[15px]">{renderBody(post.body)}</div>

          {post.sources && post.sources.length > 0 && (
            <div className="mt-10 rounded-xl bg-oddsbag-light-gray/70 p-4">
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
        </article>
      </main>
      <Footer />
    </>
  );
}
