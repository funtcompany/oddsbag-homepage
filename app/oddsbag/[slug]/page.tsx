import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ArticleView from "@/components/ArticleView";
import {
  getAllPosts,
  getPostBySlug,
  getRelatedPosts,
  channelKeyOf,
} from "@/lib/posts";
import { articleJsonLd, articleMetadata } from "@/lib/articleMeta";
import { postUrl } from "@/lib/channels";
import { serviceOf } from "@/lib/services-catalog";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getAllPosts())
    .filter((p) => channelKeyOf(p) === "oddsbag")
    .map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "게시물을 찾을 수 없어요" };
  return articleMetadata(post);
}

export default async function OddsbagPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  if (channelKeyOf(post) !== "oddsbag") redirect(postUrl(post));

  const related = await getRelatedPosts(post, 4);

  // 게시판 전용 글(boardOnly)이면 «뒤로»가 그 게시판으로 간다.
  //  브랜드 소식 목록(/oddsbag)에는 이 글이 없으므로 그리로 보내면 독자가 길을 잃는다.
  const 게시판 = post.boardOnly ? serviceOf(post.boardOnly) : undefined;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(post)) }}
      />
      <Header />
      <ArticleView
        post={post}
        related={related}
        backHref={
          게시판 ? `/oddsbag/service/${게시판.slug}#관련글` : "/oddsbag"
        }
        backLabel={게시판 ? 게시판.tab : "오즈백"}
      />
      <Footer />
    </>
  );
}
