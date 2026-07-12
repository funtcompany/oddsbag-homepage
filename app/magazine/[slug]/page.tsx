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
            <p className="mt-2.5 text-lg font-extrabold leading-snug" style={{ color: "#fff" }}>
              {content.join(" ").replace(/\*\*/g, "")}
            </p>
          </div>,
        );
        continue;
      }
      out.push(
        <h2
          key={key++}
          className="mt-12 flex items-center gap-3 text-[26px] font-black leading-snug text-oddsbag-dark"
          style={{ wordBreak: "keep-all" }}
        >
          <span className="mt-0.5 h-7 w-3 shrink-0 rounded bg-oddsbag-purple" />
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
            <li key={j} className="flex items-start gap-3.5 text-[18.5px] leading-relaxed text-oddsbag-dark/90" style={{ wordBreak: "keep-all" }}>
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
  const hasPhoto = Boolean(post.cover);
  // 사진 위엔 흰 글자 + 그림자, 아니면 디자인 엔진 색
  const headTitle = hasPhoto ? "#fff" : d.title;
  const headCat = hasPhoto ? d.accent : d.catColor;
  const headSub = hasPhoto ? "rgba(255,255,255,.8)" : d.sub;
  const headShadow =
    hasPhoto || d.light ? { textShadow: "0 3px 24px rgba(0,0,0,.45)" } : {};

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* 헤더 — 사진 있으면 사진+스크림, 없으면 생성형 배경 */}
        <header className="relative overflow-hidden" style={{ background: d.bg }}>
          {hasPhoto ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(10,6,20,.93) 0%, rgba(10,6,20,.65) 45%, rgba(10,6,20,.3) 100%)" }}
              />
            </>
          ) : (
            <div className="absolute inset-0" style={fxStyle(d.fx, d.accent)} />
          )}
          <div className="relative mx-auto max-w-2xl px-4 py-14 sm:py-20">
            <Link
              href={`/category/${cat.slug}`}
              className="text-[15px] font-bold hover:underline"
              style={{ color: headTitle, opacity: 0.85 }}
            >
              ← {cat.label}
            </Link>
            <div
              className="mt-4 text-[14px] font-black tracking-[0.1em]"
              style={{ color: headCat, ...headShadow }}
            >
              {d.emoji} {post.category}
            </div>
            <h1
              className="mt-3 text-[32px] font-black leading-[1.15] sm:text-[48px]"
              style={{ color: headTitle, letterSpacing: "-0.03em", wordBreak: "keep-all", ...headShadow }}
            >
              {post.title}
            </h1>
            <p
              className="mt-5 max-w-[60ch] text-[17px] font-medium leading-relaxed sm:text-[19px]"
              style={{ color: headSub }}
            >
              {post.summary}
            </p>
            <div className="mt-6 flex items-center gap-2.5 text-[14px] font-semibold" style={{ color: headSub }}>
              <span>{post.date}</span>
              {post.readMinutes && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{post.readMinutes}분 읽기</span>
                </>
              )}
            </div>
            {post.imageCredit && (
              <div className="mt-4 text-[11px]" style={{ color: headSub, opacity: 0.6 }}>
                {post.imageCredit}
              </div>
            )}
          </div>
        </header>

        <article className="mx-auto max-w-2xl px-4 py-9">
          <div className="article-body mt-1">{renderBody(post.body)}</div>

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
