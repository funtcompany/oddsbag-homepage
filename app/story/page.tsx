import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostCard from "@/components/PostCard";
import Link from "next/link";
import type { Metadata } from "next";
import { getPostsByChannel } from "@/lib/posts";

export const revalidate = 60;

/**
 * 이야기 — 오즈백 테일즈에서 다루는 이야기들을 게시물로 올리는 자리.
 * (사장님 지시 2026-08-18 — 탭을 먼저 열어 두고 추후 업로드)
 *
 * ★지금 글이 0편인 것은 고장이 아니다. 테일즈는 2026-08-13 사장님 지시로
 *   발행을 전면 멈춘 상태이고, 자동 발행 두 개도 일부러 꺼져 있다.
 *   여기서 무엇을 자동으로 올리지 않는다 — 올릴 때가 되면 사람이 올린다.
 *   글이 들어오는 방법: 게시물의 channel 값을 "tales" 로 두면 이 목록에 뜬다.
 */

export const metadata: Metadata = {
  title: "이야기",
  description:
    "매일 지나치던 것에 물음표를 붙이는 짧은 이야기. 오즈백 테일즈가 다루는 이야기들을 여기에 모읍니다.",
  alternates: { canonical: "/story" },
};

const TALES_YOUTUBE = "https://www.youtube.com/@oddsbag_tales";

export default async function StoryPage() {
  const posts = await getPostsByChannel("tales");

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* ── 머리 ── */}
        <section className="ob-grain relative overflow-hidden bg-oddsbag-dark">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(125deg, #14532d 0%, #1f1147 55%, #4c1d95 100%)",
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 select-none text-[190px] leading-none opacity-10 sm:text-[280px]"
          >
            📖
          </span>

          <div className="relative mx-auto max-w-6xl px-4 py-14 sm:py-20">
            <span className="text-[11px] font-black tracking-[0.22em] text-white/60">
              ODDSBAG TALES
            </span>
            <h1
              className="ob-rise mt-4 max-w-[20ch] text-[32px] font-black leading-[1.14] text-white sm:text-[48px]"
              style={{ letterSpacing: "-0.035em", wordBreak: "keep-all" }}
            >
              매일 지나치던 것에 물음표를
            </h1>
            <p
              className="mt-5 max-w-[48ch] text-[15.5px] leading-relaxed text-white/85 sm:text-[17px]"
              style={{ wordBreak: "keep-all" }}
            >
              신호등은 왜 초록인데 «파란불»이라 부를까. 익숙해서 한 번도 묻지
              않았던 것들을 짧게 풀어 놓습니다.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <a
                href={TALES_YOUTUBE}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-oddsbag-yellow px-6 py-3 text-[15px] font-black text-oddsbag-dark transition hover:brightness-95"
              >
                유튜브에서 보기 ↗
              </a>
              <Link
                href="/#subscribe"
                className="rounded-full border border-white/45 px-6 py-3 text-[15px] font-bold text-white transition hover:border-white hover:bg-white/10"
              >
                올라오면 알림 받기
              </Link>
            </div>
          </div>
        </section>

        {/* ── 이야기 목록 ── */}
        <div className="mx-auto max-w-6xl px-4 py-12">
          {posts.length > 0 ? (
            <>
              <h2 className="mb-4 text-xl font-black text-oddsbag-dark">
                이야기 {posts.length}편
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {posts.map((p, i) => (
                  <div key={p.slug} className="ob-reveal" data-reveal-index={i}>
                    <PostCard post={p} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-oddsbag-light-gray bg-oddsbag-light-gray/30 px-6 py-14 text-center">
              <span className="text-4xl" aria-hidden>
                ✍️
              </span>
              <p className="mt-4 text-[16px] font-black text-oddsbag-dark">
                첫 이야기를 준비하고 있습니다
              </p>
              <p
                className="mx-auto mt-2 max-w-[44ch] text-sm leading-relaxed text-oddsbag-gray"
                style={{ wordBreak: "keep-all" }}
              >
                지금은 영상으로 먼저 만들고 있습니다. 글로 옮긴 이야기가
                준비되는 대로 이 자리에 하나씩 올라옵니다.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                <a
                  href={TALES_YOUTUBE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-oddsbag-purple px-5 py-2.5 text-sm font-bold text-white transition hover:bg-oddsbag-purple-dark"
                >
                  유튜브에서 먼저 보기 ↗
                </a>
                <Link
                  href="/magazine"
                  className="rounded-full border border-oddsbag-light-gray bg-white px-5 py-2.5 text-sm font-bold text-oddsbag-dark transition hover:border-oddsbag-purple"
                >
                  매거진 읽으러 가기
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
