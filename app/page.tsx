import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostCard from "@/components/PostCard";
import SubscribeBox from "@/components/SubscribeBox";
import AdSlot from "@/components/AdSlot";
import HeroShowcase from "@/components/HeroShowcase";
import Link from "next/link";
import { showcase } from "@/lib/showcase";
import { services } from "@/lib/services-catalog";
import { TOOLS_HUB_NAME, TOOLS_HUB_HREF } from "@/lib/tools-hub";
import {
  getMagazinePosts,
  getPostsByChannel,
  type Post,
} from "@/lib/posts";
import { getSiteConfig, maxWidthClass } from "@/lib/sitecfg";

export const revalidate = 60; // 1분마다 새 발행글 반영 (ISR)

/**
 * 홈 — 2026-08-18 리뉴얼 (사장님 지시)
 *
 *   ① 맨 위    브랜드·프로젝트를 좌우로 넘기는 큰 띠 (HeroShowcase)
 *   ② 그 아래  오즈백 소식 · 최근 이슈  — 두 묶음, 각각 «두 줄»
 *
 * 두 줄 = 큰 화면에서 4칸 × 2줄 = 8개. 폰에서는 2칸씩 4줄로 접힌다.
 *
 * ★«인기 게시물»은 2026-08-20 사장님 지시로 뺐다. 우리가 직접 세던 조회수가
 *   그 정렬에만 쓰였는데, 글 하나 열릴 때마다 레디스 명령 2개를 쓰는 유일한
 *   변동비였다. 성과는 애널리틱스로 본다.
 *
 * ★예전 홈은 관리자 설정(sitecfg.sections)대로 섹션을 그렸다. 그 화면은
 *   섹션이 8개까지 늘어나 한참 내려야 했고, 무엇이 중요한지 알 수 없었다.
 *   지시대로 세 묶음으로 고정하고, 관리자 설정은 «켜고 끄기»와 제목에만 쓴다.
 */
export default async function Home() {
  const cfg = await getSiteConfig();

  const [magazine, oddsbagPosts] = await Promise.all([
    getMagazinePosts(),
    getPostsByChannel("oddsbag", 8),
  ]);

  const wrap = maxWidthClass(cfg.layout.width);

  const latest = magazine.slice(0, 8);

  // 관리자 화면에서 섹션을 꺼 두었으면 그대로 존중한다
  const on = (id: string) =>
    cfg.sections.find((s) => s.id === id)?.enabled ?? true;

  return (
    <>
      <Header />

      <main className="flex-1">
        {/*
          ★홈에는 h1 이 반드시 하나 있어야 한다.
            큰 띠의 각 칸 제목은 «이 페이지의 주제»가 아니라 소식 하나하나라서 h2 다.
            그래서 h1 이 하나도 없어졌고, 그러면 검색엔진이 이 페이지가 무엇에 대한
            페이지인지 못 잡는다 (예전 얇은 인사말에도 같은 이유로 h1 을 박아 뒀었다).
            눈에는 안 보이지만 검색엔진과 화면낭독기에는 읽히는 자리로 둔다.
        */}
        <h1 className="sr-only">
          오즈백 ODDSBAG — 이상하게 필요한 것들, 여기 다 있어
        </h1>

        {/* ① 주요 소식 — 좌우로 넘어가는 큰 띠 */}
        <HeroShowcase items={showcase} />

        <div className={`mx-auto ${wrap} space-y-14 px-4 py-10 sm:py-12`}>
          {/* ②-1 오즈백 소식
              오즈백 코너에 올라온 글이 아직 없으면 «우리가 만드는 것들» 카드로 채운다.
              빈 띠를 남겨 두면 사장님이 보실 때 화면이 고장 난 것처럼 보인다. */}
          {on("oddsbag") &&
            (oddsbagPosts.length > 0 ? (
              <PostSection
                title="오즈백 소식"
                subtitle="새로 나온 것과 달라진 것"
                emoji="🎒"
                posts={oddsbagPosts}
                more="/oddsbag"
              />
            ) : (
              <MakesSection />
            ))}

          {on("ad") && <AdSlot />}

          {/* ②-2 최근 이슈 */}
          {on("latest") && latest.length > 0 && (
            <PostSection
              title="최근 이슈"
              subtitle="오늘의 이슈를 오즈백 시선으로"
              emoji="📰"
              posts={latest}
              more="/magazine"
            />
          )}

          {on("subscribe") && <SubscribeBox />}
        </div>
      </main>

      <Footer />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
/** 글 묶음 한 덩이 — 큰 화면 4칸 × 2줄 */
function PostSection({
  title,
  subtitle,
  emoji,
  posts,
  more,
}: {
  title: string;
  subtitle?: string;
  emoji: string;
  posts: Post[];
  more?: string;
}) {
  return (
    <section>
      <SectionHead title={title} subtitle={subtitle} emoji={emoji} more={more} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {posts.map((post, i) => (
          <div
            key={post.slug}
            className="ob-reveal relative"
            data-reveal-index={i}
          >
            <PostCard post={post} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** 오즈백 코너 글이 아직 없을 때 — 우리가 만드는 것들을 대신 보여준다
 *  ★지시가 «세 묶음 모두 두 줄»이라 여기도 8칸을 채운다 (4칸 × 2줄).
 *    앞의 넷은 우리가 만드는 것, 뒤의 넷은 실제로 들어갈 수 있는 자리로 채운다. */
function MakesSection() {
  const cards = [
    ...services.map((s) => ({
      key: s.slug,
      emoji: s.emoji,
      title: s.name,
      desc: s.lead,
      href: `/oddsbag/service/${s.slug}`,
      badge: s.status,
    })),
    {
      key: "tools",
      emoji: "🧰",
      title: TOOLS_HUB_NAME,
      desc: "필요할 때 바로 꺼내 쓰는 웹 도구 모음. 지금은 내 HTML을 올려 링크로 만드는 «HTML 링크 생성기»가 있습니다.",
      href: TOOLS_HUB_HREF,
      badge: "새로 나옴",
    },
    {
      key: "music",
      emoji: "🎵",
      title: "오즈백 뮤직",
      desc: "직접 만드는 음악. 앨범과 24시간 라이브를 홈페이지에서 바로 들으실 수 있습니다.",
      href: "/music",
      badge: "앨범 4장",
    },
    {
      key: "tales",
      emoji: "📖",
      title: "오즈백 테일즈",
      desc: "매일 지나치던 것에 물음표를 붙이는 짧은 이야기. 곧 이곳에 올라옵니다.",
      href: "/story",
      badge: "준비 중",
    },
    {
      key: "magazine",
      emoji: "📰",
      title: "오즈백 매거진",
      desc: "매일의 사회·경제·테크 이슈를 오즈백 시선으로 정리합니다.",
      href: "/magazine",
      badge: "매일",
    },
    {
      key: "guide",
      emoji: "💡",
      title: "가이드·꿀팁",
      desc: "안 될 때 꺼내 보는 해결법. 주제별로 묶어 두었습니다.",
      href: "/guide",
      badge: "주제별",
    },
    {
      key: "newsletter",
      emoji: "✉️",
      title: "뉴스레터",
      desc: "그날의 이슈를 한 통으로 정리해 메일로 보내드립니다.",
      href: "/#subscribe",
      badge: "무료",
    },
    {
      key: "contact",
      emoji: "✉",
      title: "제보·제휴 문의",
      desc: "제보, 정정 요청, 제휴 무엇이든 편하게 보내주세요.",
      href: "/contact",
      badge: "언제든",
    },
  ];

  return (
    <section>
      <SectionHead
        title="오즈백 소식"
        subtitle="우리가 만드는 것들"
        emoji="🎒"
        more="/oddsbag"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <Link
            key={c.key}
            href={c.href}
            data-reveal-index={i}
            className="ob-reveal ob-lift group flex flex-col rounded-2xl border border-oddsbag-light-gray bg-white p-5 hover:border-oddsbag-purple hover:shadow-lg hover:shadow-oddsbag-purple/10"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-3xl" aria-hidden>
                {c.emoji}
              </span>
              <span className="rounded-full bg-oddsbag-light-gray px-2 py-0.5 text-[11px] font-bold text-oddsbag-gray">
                {c.badge}
              </span>
            </div>
            <h3 className="mt-3 text-base font-black text-oddsbag-dark group-hover:text-oddsbag-purple">
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

function SectionHead({
  title,
  subtitle,
  emoji,
  more,
}: {
  title: string;
  subtitle?: string;
  emoji: string;
  more?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black text-oddsbag-dark sm:text-[22px]">
          <span aria-hidden>{emoji}</span>
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-sm text-oddsbag-gray">{subtitle}</p>
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
