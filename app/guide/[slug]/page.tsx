import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostListView from "@/components/PostListView";
import { toCardPosts } from "@/lib/cardPost";
import SearchBox from "@/components/SearchBox";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVisiblePosts } from "@/lib/posts";
import { hubs, hubBySlug, postsInHub } from "@/lib/hubs";
import type { Metadata } from "next";

export const revalidate = 300;

export function generateStaticParams() {
  return hubs.map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const hub = hubBySlug((await params).slug);
  if (!hub) return {};
  return {
    title: hub.title,
    description: hub.lead,
    alternates: { canonical: `/guide/${hub.slug}` },
  };
}

export default async function HubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hub = hubBySlug(slug);
  if (!hub) notFound();

  const posts = await getVisiblePosts();
  const items = postsInHub(posts, hub);
  const others = hubs.filter((h) => h.slug !== hub.slug);

  // 검색엔진에 '이건 목록 페이지'라고 알려준다
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: hub.title,
    description: hub.lead,
    url: `https://oddsbag.co.kr/guide/${hub.slug}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.slice(0, 30).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://oddsbag.co.kr/magazine/${p.slug}`,
        name: p.title,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main className="flex-1">
        <section className="bg-gradient-to-br from-oddsbag-purple-dark via-oddsbag-purple to-oddsbag-purple-light">
          <div className="mx-auto max-w-4xl px-4 py-12">
            <Link
              href="/guide"
              className="text-xs font-bold text-white/70 transition hover:text-oddsbag-yellow"
            >
              ← 주제별 가이드
            </Link>
            <h1 className="mt-3 flex items-center gap-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              <span>{hub.emoji}</span>
              <span style={{ wordBreak: "keep-all" }}>{hub.title}</span>
            </h1>
            <p
              className="mt-3 max-w-lg text-sm leading-relaxed text-white/80"
              style={{ wordBreak: "keep-all" }}
            >
              {hub.lead}
            </p>
            <p className="mt-4 text-xs font-bold text-oddsbag-yellow">
              글 {items.length}개
            </p>
            <div className="mt-6 max-w-md">
              <SearchBox size="sm" placeholder="이 주제에서 찾기" />
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-10">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-oddsbag-gray">
              이 주제의 글을 준비하고 있습니다.
            </p>
          ) : (
            <PostListView posts={toCardPosts(items)} />
          )}

          {/* 다른 주제로 넘어갈 길을 열어둔다 (내부 링크 + 체류시간) */}
          <div className="mt-14 border-t border-oddsbag-light-gray pt-8">
            <p className="text-sm font-black text-oddsbag-dark">다른 주제</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {others.map((h) => (
                <Link
                  key={h.slug}
                  href={`/guide/${h.slug}`}
                  className="rounded-full border border-oddsbag-light-gray px-3.5 py-1.5 text-sm font-medium text-oddsbag-dark transition hover:border-oddsbag-purple hover:text-oddsbag-purple"
                >
                  {h.emoji} {h.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
