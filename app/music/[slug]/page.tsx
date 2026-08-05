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
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getAllPosts())
    .filter((p) => channelKeyOf(p) === "music")
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

export default async function MusicPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  if (channelKeyOf(post) !== "music") redirect(postUrl(post));

  const related = await getRelatedPosts(post, 4);

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
        backHref="/music"
        backLabel="뮤직"
      />
      <Footer />
    </>
  );
}
