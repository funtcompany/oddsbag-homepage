import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ArticleView from "@/components/ArticleView";
import {
  getAllPosts,
  getPostBySlug,
  getRelatedPosts,
  channelKeyOf,
} from "@/lib/posts";
import { categoryOf } from "@/lib/categories";
import { articleJsonLd, articleMetadata } from "@/lib/articleMeta";
import { postUrl } from "@/lib/channels";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getAllPosts())
    .filter((p) => channelKeyOf(p) === "magazine")
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

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  // 다른 코너 글이면 그 코너 주소로 보내준다 (같은 글이 주소 두 개로 갈리지 않게)
  if (channelKeyOf(post) !== "magazine") redirect(postUrl(post));

  const related = await getRelatedPosts(post, 4);
  const cat = categoryOf(post.category);

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
        backHref={`/category/${cat.slug}`}
        backLabel={cat.label}
      />
      <Footer />
    </>
  );
}
