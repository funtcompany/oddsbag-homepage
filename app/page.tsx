import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostCard from "@/components/PostCard";
import FeaturedHero from "@/components/FeaturedHero";
import PopularRanking from "@/components/PopularRanking";
import SubscribeBox from "@/components/SubscribeBox";
import AdSlot from "@/components/AdSlot";
import Link from "next/link";
import { categories } from "@/lib/categories";
import {
  getFeaturedPost,
  getMagazinePosts,
  getPostsByChannel,
  type Post,
} from "@/lib/posts";
import {
  getSiteConfig,
  gridClass,
  maxWidthClass,
  type HomeSection,
  type SiteConfig,
} from "@/lib/sitecfg";

export const revalidate = 60; // 1분마다 새 발행글 반영 (ISR)

export default async function Home() {
  const cfg = await getSiteConfig();

  const [featured, magazine, oddsbagPosts, musicPosts] = await Promise.all([
    getFeaturedPost(),
    getMagazinePosts(),
    getPostsByChannel("oddsbag", 12),
    getPostsByChannel("music", 12),
  ]);

  const wrap = maxWidthClass(cfg.layout.width);
  const grid = gridClass(cfg.layout.columns);

  const byCategory = new Map<string, Post[]>();
  for (const cat of categories) {
    byCategory.set(cat.label, magazine.filter((p) => p.category === cat.label));
  }

  // 홈에서 같은 글이 두세 번 나오지 않게, 이미 보여준 글을 적어둔다.
  //  예전엔 카드 38장 중 고유한 글이 29개뿐이라 한참 내려도 볼 게 없어 보였다.
  //  (인기글 랭킹은 '순위'라는 성격이 달라서 여기서 빼지 않는다)
  const used = new Set<string>();
  if (featured) used.add(featured.slug);
  const takeFresh = (list: Post[], n: number) => {
    const picked = list.filter((p) => !used.has(p.slug)).slice(0, n);
    for (const p of picked) used.add(p.slug);
    return picked;
  };

  function renderSection(sec: HomeSection) {
    if (!sec.enabled) return null;

    switch (sec.type) {
      case "featured": {
        const popular = magazine.slice(0, Math.max(1, sec.limit || 5));
        if (!featured && popular.length === 0) return null;
        return (
          <div key={sec.id} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {featured && <FeaturedHero post={featured} />}
            </div>
            <div className="lg:col-span-1">
              <PopularRanking posts={popular} />
            </div>
          </div>
        );
      }

      case "latest": {
        const list = takeFresh(magazine, sec.limit || 8);
        return (
          <PostRow
            key={sec.id}
            sec={sec}
            posts={list}
            grid={grid}
            fallbackMore="/magazine"
          />
        );
      }

      case "channel-oddsbag":
        return (
          <PostRow
            key={sec.id}
            sec={sec}
            posts={oddsbagPosts.slice(0, sec.limit || 4)}
            grid={grid}
            fallbackMore="/oddsbag"
          />
        );

      case "channel-music":
        return (
          <PostRow
            key={sec.id}
            sec={sec}
            posts={musicPosts.slice(0, sec.limit || 4)}
            grid={grid}
            fallbackMore="/music"
          />
        );

      case "services": {
        const cards = cfg.services
          .filter((c) => c.enabled)
          .slice(0, sec.limit || 8);
        if (cards.length === 0) return null;
        return (
          <section key={sec.id}>
            <SectionHead sec={sec} fallbackMore="/services" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((c) => (
                <Link
                  key={c.id}
                  href={c.href || "/services"}
                  className="flex flex-col rounded-2xl border border-oddsbag-light-gray bg-white p-5 transition hover:-translate-y-0.5 hover:border-oddsbag-purple hover:shadow-lg hover:shadow-oddsbag-purple/10"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-3xl" aria-hidden>
                      {c.emoji}
                    </span>
                    {c.badge && (
                      <span className="rounded-full bg-oddsbag-yellow/25 px-2 py-0.5 text-[11px] font-bold text-oddsbag-dark">
                        {c.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 text-base font-black text-oddsbag-dark">
                    {c.title}
                  </h3>
                  <p
                    className="mt-1 text-sm leading-relaxed text-oddsbag-gray"
                    style={{ wordBreak: "keep-all" }}
                  >
                    {c.desc}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        );
      }

      case "categories": {
        const per = sec.limit || 4;
        const blocks = categories
          .map((cat) => ({ cat, posts: takeFresh(byCategory.get(cat.label) ?? [], per) }))
          .filter((b) => b.posts.length > 0);
        if (blocks.length === 0) return null;
        return (
          <div key={sec.id} className="space-y-10">
            {sec.title && (
              <h2 className="text-xl font-black text-oddsbag-dark">{sec.title}</h2>
            )}
            {blocks.map(({ cat, posts }) => (
              <section key={cat.slug}>
                <div className="mb-4 flex items-end justify-between">
                  <h3 className="flex items-center gap-2 text-lg font-black text-oddsbag-dark">
                    <span>{cat.emoji}</span> {cat.label}
                  </h3>
                  <Link
                    href={`/category/${cat.slug}`}
                    className="text-sm font-bold text-oddsbag-purple hover:underline"
                  >
                    더보기 →
                  </Link>
                </div>
                <div className={grid}>
                  {posts.map((post) => (
                    <PostCard key={post.slug} post={post} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        );
      }

      case "ad":
        return <AdSlot key={sec.id} />;

      case "subscribe":
        return <SubscribeBox key={sec.id} />;

      default:
        return null;
    }
  }

  return (
    <>
      <Header />

      <main className="flex-1">
        <Hero cfg={cfg} />

        <div className={`mx-auto ${wrap} space-y-10 px-4 py-8`}>
          {cfg.sections.map(renderSection)}
        </div>
      </main>

      <Footer />
    </>
  );
}

// ---- 첫 화면 인사말 ----
function Hero({ cfg }: { cfg: SiteConfig }) {
  const h = cfg.hero;
  if (!h.enabled) return null;

  if (h.style === "slim") {
    return (
      <div className="border-b border-oddsbag-light-gray bg-oddsbag-light-gray/50">
        <div className={`mx-auto ${maxWidthClass(cfg.layout.width)} px-4 py-5`}>
          {/* 얇은 스타일에서도 제목은 h1이어야 한다.
              p로 두면 홈에 h1이 하나도 없어져서 검색엔진이 '이 페이지 주제'를 못 잡는다. */}
          <h1 className="text-[15px] font-black text-oddsbag-dark" style={{ wordBreak: "keep-all" }}>
            {h.title}
          </h1>
          {h.subtitle && (
            <p className="mt-1 text-sm text-oddsbag-gray" style={{ wordBreak: "keep-all" }}>
              {h.subtitle}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <section
      style={{ background: `linear-gradient(135deg, ${h.bgFrom}, ${h.bgTo})` }}
    >
      <div className={`mx-auto ${maxWidthClass(cfg.layout.width)} px-4 py-12 sm:py-16`}>
        {h.kicker && (
          <p className="text-xs font-black tracking-[0.2em] text-oddsbag-yellow">
            {h.kicker}
          </p>
        )}
        <h1
          className="mt-3 max-w-[24ch] text-[30px] font-black leading-[1.18] text-white sm:text-[42px]"
          style={{ letterSpacing: "-0.03em", wordBreak: "keep-all" }}
        >
          {h.title}
        </h1>
        {h.subtitle && (
          <p
            className="mt-4 max-w-[46ch] text-[16px] leading-relaxed text-white/80 sm:text-[18px]"
            style={{ wordBreak: "keep-all" }}
          >
            {h.subtitle}
          </p>
        )}
        {h.ctaLabel && (
          <Link
            href={h.ctaHref || "/magazine"}
            className="mt-7 inline-block rounded-full bg-oddsbag-yellow px-6 py-3 text-[15px] font-black text-oddsbag-dark transition hover:brightness-95"
          >
            {h.ctaLabel}
          </Link>
        )}
      </div>
    </section>
  );
}

// ---- 글 묶음 한 줄 ----
function SectionHead({
  sec,
  fallbackMore,
}: {
  sec: HomeSection;
  fallbackMore?: string;
}) {
  const more = sec.moreHref || fallbackMore;
  if (!sec.title && !sec.subtitle) return null;
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-black text-oddsbag-dark">{sec.title}</h2>
        {sec.subtitle && (
          <p className="mt-0.5 text-sm text-oddsbag-gray">{sec.subtitle}</p>
        )}
      </div>
      {more && (
        <Link
          href={more}
          className="shrink-0 text-sm font-bold text-oddsbag-purple hover:underline"
        >
          전체 보기 →
        </Link>
      )}
    </div>
  );
}

function PostRow({
  sec,
  posts,
  grid,
  fallbackMore,
}: {
  sec: HomeSection;
  posts: Post[];
  grid: string;
  fallbackMore?: string;
}) {
  if (posts.length === 0) return null;
  return (
    <section>
      <SectionHead sec={sec} fallbackMore={fallbackMore} />
      <div className={grid}>
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </section>
  );
}
