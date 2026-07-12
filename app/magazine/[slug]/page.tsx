import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostCard from "@/components/PostCard";
import AdSlot from "@/components/AdSlot";
import ReactionBar from "@/components/ReactionBar";
import CommentSection from "@/components/CommentSection";
import { getAllPosts, getPostBySlug, getRelatedPosts } from "@/lib/posts";
import { categoryOf } from "@/lib/categories";
import { getDesign, fxStyle } from "@/lib/design";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getAllPosts()).map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "게시물을 찾을 수 없어요" };
  return {
    title: post.title,
    description: post.summary,
    openGraph: { title: post.title, description: post.summary },
  };
}

// 인라인 강조 (**굵게** → 형광펜)
function inline(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((p, i) =>
    i % 2 === 1 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>,
  );
}

// 마크다운 본문 → 에디토리얼 요소
function renderBody(body: string) {
  const lines = body.split("\n");
  const out: ReactNode[] = [];
  let firstPara = true;
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      const heading = line.slice(3).trim();
      if (heading.includes("오즈백 한 줄") || heading.includes("한 줄 정리")) {
        i++;
        const content: string[] = [];
        while (i < lines.length && !lines[i].startsWith("## ")) {
          if (lines[i].trim()) content.push(lines[i].trim());
          i++;
        }
        out.push(
          <div
            key={key++}
            className="relative my-9 overflow-hidden rounded-2xl bg-gradient-to-br from-[#2a1250] to-oddsbag-purple-dark p-7 text-white"
          >
            <span
              className="absolute right-5 top-5 h-8 w-8 bg-oddsbag-yellow"
              style={{
                clipPath:
                  "polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%)",
              }}
            />
            <div className="text-xs font-black tracking-[0.16em] text-oddsbag-yellow">
              오즈백 한 줄 정리
            </div>
            <p className="mt-2.5 text-lg font-extrabold leading-snug">
              {content.join(" ").replace(/\*\*/g, "")}
            </p>
          </div>,
        );
        continue;
      }
      out.push(
        <h2
          key={key++}
          className="mt-11 flex items-center gap-3 text-2xl font-black text-oddsbag-dark"
          style={{ wordBreak: "keep-all" }}
        >
          <span className="h-6 w-3 shrink-0 rounded bg-oddsbag-purple" />
          {heading.replace(/\*\*/g, "")}
        </h2>,
      );
      i++;
      continue;
    }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2).trim());
        i++;
      }
      out.push(
        <ul key={key++} className="my-5 flex flex-col gap-3">
          {items.map((it, j) => (
            <li key={j} className="flex items-start gap-3.5 text-[17px] leading-relaxed text-oddsbag-dark/90" style={{ wordBreak: "keep-all" }}>
              <span className="mt-2.5 h-2 w-2 shrink-0 rounded bg-oddsbag-yellow ring-4 ring-oddsbag-yellow/20" />
              <span>{inline(it)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    out.push(
      <p key={key++} className={firstPara ? "dropcap" : undefined}>
        {inline(line.trim())}
      </p>,
    );
    firstPara = false;
    i++;
  }
  return out;
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const cat = categoryOf(post.category);
  const related = await getRelatedPosts(post, 4);
  const d = getDesign(post);
  const headShadow = d.light ? { textShadow: "0 3px 24px rgba(0,0,0,.35)" } : {};

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* 생성형 헤더 */}
        <header className="relative overflow-hidden" style={{ background: d.bg }}>
          <div className="absolute inset-0" style={fxStyle(d.fx, d.accent)} />
          <div className="relative mx-auto max-w-2xl px-4 py-12 sm:py-16">
            <Link
              href={`/category/${cat.slug}`}
              className="text-sm font-bold hover:underline"
              style={{ color: d.title, opacity: 0.85 }}
            >
              ← {cat.label}
            </Link>
            <div
              className="mt-4 text-[13px] font-black tracking-[0.12em]"
              style={{ color: d.accent, ...headShadow }}
            >
              {d.emoji} {post.category.toUpperCase()}
            </div>
            <h1
              className="mt-3 text-3xl font-black leading-tight sm:text-[42px]"
              style={{ color: d.title, letterSpacing: "-0.03em", wordBreak: "keep-all", ...headShadow }}
            >
              {post.title}
            </h1>
            <p
              className="mt-4 max-w-[60ch] text-[16px] font-medium leading-relaxed sm:text-lg"
              style={{ color: d.sub }}
            >
              {post.summary}
            </p>
            <div className="mt-5 flex items-center gap-2.5 text-[13px] font-semibold" style={{ color: d.sub }}>
              <span>{post.date}</span>
              {post.readMinutes && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{post.readMinutes}분 읽기</span>
                </>
              )}
            </div>
          </div>
        </header>

        <article className="oddsbag-article mx-auto max-w-2xl px-4 py-9">
          <div className="mt-1">{renderBody(post.body)}</div>

          <div className="my-9">
            <AdSlot />
          </div>

          <ReactionBar slug={post.slug} />

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

          <div className="mt-8">
            <CommentSection slug={post.slug} />
          </div>
        </article>

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
