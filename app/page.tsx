import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostCard from "@/components/PostCard";
import FeaturedHero from "@/components/FeaturedHero";
import PopularRanking from "@/components/PopularRanking";
import SubscribeBox from "@/components/SubscribeBox";
import AppPromoBand from "@/components/AppPromoBand";
import AdSlot from "@/components/AdSlot";
import Link from "next/link";
import { categories } from "@/lib/categories";
import {
  getFeaturedPost,
  getLatestPosts,
  getPostsByCategory,
} from "@/lib/posts";

export default function Home() {
  const featured = getFeaturedPost();
  const latest = getLatestPosts();
  const popular = latest.slice(0, 5);
  const restLatest = latest.filter((p) => p.slug !== featured?.slug).slice(0, 4);

  return (
    <>
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6">
          {/* 상단: 피처드 + 인기글 랭킹 */}
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {featured && <FeaturedHero post={featured} />}
            </div>
            <div className="lg:col-span-1">
              <PopularRanking posts={popular} />
            </div>
          </div>

          {/* 최신 이슈 */}
          <section className="mt-10">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-xl font-black text-oddsbag-dark">최신 이슈</h2>
              <Link
                href="/magazine"
                className="text-sm font-bold text-oddsbag-purple hover:underline"
              >
                전체 보기 →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {restLatest.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          </section>

          {/* 광고 */}
          <div className="mt-10">
            <AdSlot />
          </div>

          {/* 카테고리별 섹션 */}
          {categories.map((cat, idx) => {
            const posts = getPostsByCategory(cat.label, 4);
            if (posts.length === 0) return null;
            return (
              <div key={cat.slug}>
                <section className="mt-10">
                  <div className="mb-4 flex items-end justify-between">
                    <h2 className="flex items-center gap-2 text-xl font-black text-oddsbag-dark">
                      <span>{cat.emoji}</span> {cat.label}
                    </h2>
                    <Link
                      href={`/category/${cat.slug}`}
                      className="text-sm font-bold text-oddsbag-purple hover:underline"
                    >
                      더보기 →
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {posts.map((post) => (
                      <PostCard key={post.slug} post={post} />
                    ))}
                  </div>
                </section>

                {/* 두 번째 카테고리 뒤에 오즈백 앱 은근한 노출 */}
                {idx === 1 && (
                  <div className="mt-10">
                    <AppPromoBand />
                  </div>
                )}
              </div>
            );
          })}

          {/* 구독 */}
          <div className="mt-12">
            <SubscribeBox />
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
