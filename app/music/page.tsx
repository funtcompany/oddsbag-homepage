import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostCard from "@/components/PostCard";
import Link from "next/link";
import type { Metadata } from "next";
import { getPostsByChannel } from "@/lib/posts";
import {
  albums,
  collections,
  getLatestVideos,
  isUpcoming,
  liveEmbedUrl,
  MUSIC_CHANNEL_URL,
  playlistWatchUrl,
  type Album,
} from "@/lib/music";

export const revalidate = 1800; // 30분마다 최신 영상 다시 읽기

export const metadata: Metadata = {
  title: "오즈백 뮤직",
  description:
    "오즈백이 직접 만드는 음악. 앨범 4장과 24시간 라이브를 홈페이지에서 바로 들으실 수 있습니다.",
  alternates: { canonical: "/music" },
};

export default async function MusicPage() {
  const [posts, latest] = await Promise.all([
    getPostsByChannel("music"),
    getLatestVideos(8),
  ]);

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* ── 맨 위: 지금 나오는 라이브 ── */}
        <section className="ob-grain relative overflow-hidden bg-oddsbag-dark">
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background:
                "linear-gradient(125deg, #1f1147 0%, #4c1d95 55%, #7b4fb5 100%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                  <span className="text-[11px] font-black tracking-[0.22em] text-white/70">
                    ODDSBAG MUSIC · LIVE
                  </span>
                </div>

                <h1
                  className="ob-rise mt-4 text-[32px] font-black leading-[1.14] text-white sm:text-[46px]"
                  style={{ letterSpacing: "-0.035em", wordBreak: "keep-all" }}
                >
                  틀어 두면 하루가 흘러갑니다
                </h1>
                <p
                  className="mt-4 max-w-[46ch] text-[15.5px] leading-relaxed text-white/85 sm:text-[17px]"
                  style={{ wordBreak: "keep-all" }}
                >
                  가사 없는 연주 BGM과 노래를 직접 만들어 앨범으로 냅니다.
                  24시간 라이브는 언제 오셔도 켜져 있습니다.
                </p>

                <div className="mt-7 flex flex-wrap gap-2.5">
                  <a
                    href={MUSIC_CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-oddsbag-yellow px-6 py-3 text-[15px] font-black text-oddsbag-dark transition hover:brightness-95"
                  >
                    유튜브 채널 ↗
                  </a>
                  <a
                    href="#앨범"
                    className="rounded-full border border-white/45 px-6 py-3 text-[15px] font-bold text-white transition hover:border-white hover:bg-white/10"
                  >
                    앨범 보기
                  </a>
                </div>
              </div>

              {/* 라이브 붙박이 — 채널이 켠 방송을 유튜브가 알아서 물어다 준다 */}
              <div className="overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl">
                <div className="relative aspect-video">
                  <iframe
                    src={liveEmbedUrl()}
                    title="오즈백 뮤직 24시간 라이브"
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
                <p className="px-4 py-2.5 text-[12.5px] text-white/60">
                  방송이 꺼져 있으면 이 자리에 예고 화면이 나옵니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 앨범 ── */}
        <section id="앨범" className="scroll-mt-24">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-oddsbag-dark sm:text-[22px]">
                  🎼 앨범
                </h2>
                <p className="mt-0.5 text-sm text-oddsbag-gray">
                  한 장씩 눌러 들어가시면 전곡을 들으실 수 있습니다
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {albums.map((a, i) => (
                <AlbumCard key={a.slug} album={a} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ── 모아 듣기 ── */}
        <section className="border-y border-oddsbag-light-gray bg-oddsbag-light-gray/40">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <h2 className="text-xl font-black text-oddsbag-dark">🎧 모아 듣기</h2>
            <p className="mt-0.5 text-sm text-oddsbag-gray">
              앨범 구분 없이 성격으로 묶은 재생목록
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {collections.map((c, i) => (
                <a
                  key={c.playlistId}
                  href={playlistWatchUrl(c.playlistId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-reveal-index={i}
                  className="ob-reveal ob-lift ob-zoom group flex items-center gap-4 overflow-hidden rounded-2xl border border-oddsbag-light-gray bg-white p-4 hover:border-oddsbag-purple"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-oddsbag-light-gray">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.cover}
                      alt=""
                      aria-hidden
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-oddsbag-dark group-hover:text-oddsbag-purple">
                      {c.emoji} {c.label}
                    </h3>
                    <p
                      className="mt-0.5 text-sm text-oddsbag-gray"
                      style={{ wordBreak: "keep-all" }}
                    >
                      {c.desc}
                    </p>
                    <p className="mt-1 text-[12.5px] font-bold text-oddsbag-purple">
                      유튜브에서 재생 ↗
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── 최신 영상 (유튜브 공개 RSS) ── */}
        {latest.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-12">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-oddsbag-dark">
                  🆕 새로 올라온 영상
                </h2>
                <p className="mt-0.5 text-sm text-oddsbag-gray">
                  유튜브 채널에서 바로 가져옵니다
                </p>
              </div>
              <a
                href={MUSIC_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm font-bold text-oddsbag-purple hover:underline"
              >
                채널 전체 →
              </a>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {latest.map((v, i) => (
                <a
                  key={v.videoId}
                  href={`https://www.youtube.com/watch?v=${v.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-reveal-index={i}
                  className="ob-reveal ob-lift ob-zoom group flex flex-col overflow-hidden rounded-2xl border border-oddsbag-light-gray bg-white"
                >
                  <div className="relative aspect-video overflow-hidden bg-oddsbag-light-gray">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={v.thumb}
                      alt=""
                      aria-hidden
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-oddsbag-purple">
                        ▶
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-3.5">
                    <span className="text-[12px] font-bold text-oddsbag-gray">
                      {v.publishedAt}
                    </span>
                    <h3
                      className="mt-1 line-clamp-3 text-[14.5px] font-bold leading-snug text-oddsbag-dark group-hover:text-oddsbag-purple"
                      style={{ wordBreak: "keep-all" }}
                    >
                      {v.title}
                    </h3>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── 뮤직 코너 글 (있을 때만) ── */}
        {posts.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 pb-12">
            <h2 className="mb-4 text-xl font-black text-oddsbag-dark">
              ✍️ 만드는 이야기
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {posts.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </section>
        )}

        {/* AI 생성 고지 — 유튜브 설명에 붙이는 문구와 같은 내용을 홈페이지에도 둔다 */}
        <div className="mx-auto max-w-6xl px-4 pb-12">
          <p className="rounded-xl bg-oddsbag-light-gray/60 px-4 py-3 text-[12.5px] text-oddsbag-gray">
            ⓘ 오즈백 뮤직의 음원은 AI로 만들었습니다 (AI-generated / Synthetic).
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}

function AlbumCard({ album, index }: { album: Album; index: number }) {
  const upcoming = isUpcoming(album);
  return (
    <Link
      href={`/music/album/${album.slug}`}
      data-reveal-index={index}
      className="ob-reveal ob-lift ob-zoom group flex flex-col overflow-hidden rounded-2xl border border-oddsbag-light-gray bg-white hover:border-oddsbag-purple hover:shadow-lg hover:shadow-oddsbag-purple/10"
    >
      <div className="relative aspect-square overflow-hidden bg-oddsbag-light-gray">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={album.cover}
          alt=""
          aria-hidden
          className="h-full w-full object-cover"
          loading={index < 4 ? "eager" : "lazy"}
        />
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-black ${
            upcoming
              ? "bg-oddsbag-yellow text-oddsbag-dark"
              : "bg-black/60 text-white backdrop-blur"
          }`}
        >
          {upcoming ? "발매 예정" : album.releaseDate.replace(/-/g, ".")}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[15.5px] font-black text-oddsbag-dark group-hover:text-oddsbag-purple">
          {album.emoji} {album.title}
        </h3>
        <p className="text-[12px] font-bold uppercase tracking-wide text-oddsbag-gray">
          {album.titleEn}
        </p>
        <p
          className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-oddsbag-gray"
          style={{ wordBreak: "keep-all" }}
        >
          {album.scene}
        </p>
        <p className="mt-2 text-[12.5px] font-bold text-oddsbag-purple">
          {album.editions.map((e) => e.label).join(" · ")}
        </p>
      </div>
    </Link>
  );
}
