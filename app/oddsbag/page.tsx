import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChannelPage from "@/components/ChannelPage";
import Link from "next/link";
import { getPostsByChannel } from "@/lib/posts";
import { getSiteConfig } from "@/lib/sitecfg";
import { services } from "@/lib/services-catalog";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "오즈백이 만드는 것들",
  description:
    "오즈백이 만드는 서비스와 브랜드 소식. WPMS 무선 발표 관리 시스템, 별의 결, 오즈백 뮤직, 오즈백 테일즈.",
  alternates: { canonical: "/oddsbag" },
};

export default async function OddsbagPage() {
  const [posts, cfg] = await Promise.all([
    getPostsByChannel("oddsbag"),
    getSiteConfig(),
  ]);

  return (
    <>
      <Header />
      <ChannelPage
        emoji="🎒"
        title="오즈백이 만드는 것들"
        // 푸터의 회사 소개(footer.intro)를 돌려쓰지 않는다.
        //  여기는 매거진 소개가 아니라 브랜드 소식 게시판이다 (지시 2026-08-12).
        lead={cfg.oddsbag.lead}
        bgFrom="#4c1d95"
        bgTo="#7b4fb5"
        posts={posts}
        links={[
          { label: "매거진 보기", href: "/magazine" },
          { label: "문의하기", href: "/contact" },
        ]}
        emptyText="아직 올라온 소식이 없습니다."
      >
        {/*
          ★소식 글이 아직 0편이다. 그것만 두면 이 화면에 들어온 사람이 빈손으로 나간다.
            그래서 «무엇을 만들고 있는가»를 먼저 보여주고, 소식 글은 그 아래에 쌓는다.
            글이 생기면 아래 목록이 저절로 채워지고 이 부분은 그대로 위에 남는다.
        */}
        <section className="mb-12">
          <h2 className="text-xl font-black text-oddsbag-dark">
            지금 만들고 있는 것
          </h2>
          <p className="mt-0.5 text-sm text-oddsbag-gray">
            눌러 들어가시면 안내와 관련 글을 보실 수 있습니다
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {services.map((s, i) => (
              <Link
                key={s.slug}
                href={`/oddsbag/service/${s.slug}`}
                data-reveal-index={i}
                className="ob-reveal ob-lift group relative flex flex-col overflow-hidden rounded-2xl p-6 text-white"
                style={{
                  background: `linear-gradient(125deg, ${s.bgFrom}, ${s.bgTo})`,
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-3 -top-3 select-none text-[110px] leading-none opacity-15"
                >
                  {s.emoji}
                </span>
                <span
                  className={`relative w-fit rounded-full px-2.5 py-1 text-[11px] font-black ${s.statusTone}`}
                >
                  {s.status}
                </span>
                <h3 className="relative mt-4 text-[19px] font-black">
                  {s.name}
                </h3>
                <p
                  className="relative mt-2 max-w-[42ch] text-[14px] leading-relaxed text-white/85"
                  style={{ wordBreak: "keep-all" }}
                >
                  {s.lead}
                </p>
                <span className="relative mt-5 text-[13.5px] font-black text-oddsbag-yellow">
                  자세히 보기 →
                </span>
              </Link>
            ))}

            <Link
              href="/music"
              className="ob-lift group flex items-center gap-4 rounded-2xl border border-oddsbag-light-gray bg-white p-5 hover:border-oddsbag-purple"
            >
              <span className="text-3xl" aria-hidden>
                🎵
              </span>
              <div className="min-w-0">
                <h3 className="font-black text-oddsbag-dark group-hover:text-oddsbag-purple">
                  오즈백 뮤직
                </h3>
                <p
                  className="mt-0.5 text-sm text-oddsbag-gray"
                  style={{ wordBreak: "keep-all" }}
                >
                  직접 만드는 음악. 앨범과 24시간 라이브를 홈페이지에서 바로
                  들으실 수 있습니다.
                </p>
              </div>
            </Link>

            <Link
              href="/story"
              className="ob-lift group flex items-center gap-4 rounded-2xl border border-oddsbag-light-gray bg-white p-5 hover:border-oddsbag-purple"
            >
              <span className="text-3xl" aria-hidden>
                📖
              </span>
              <div className="min-w-0">
                <h3 className="font-black text-oddsbag-dark group-hover:text-oddsbag-purple">
                  오즈백 테일즈
                </h3>
                <p
                  className="mt-0.5 text-sm text-oddsbag-gray"
                  style={{ wordBreak: "keep-all" }}
                >
                  매일 지나치던 것에 물음표를 붙이는 짧은 이야기.
                </p>
              </div>
            </Link>
          </div>
        </section>
      </ChannelPage>
      <Footer />
    </>
  );
}
