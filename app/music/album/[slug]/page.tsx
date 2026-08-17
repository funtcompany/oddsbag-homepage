import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  albums,
  albumOf,
  isUpcoming,
  MUSIC_CHANNEL_URL,
  playableEditions,
  playlistEmbedUrl,
  playlistWatchUrl,
} from "@/lib/music";

export const revalidate = 3600;

/**
 * 앨범 한 장 — 눌러 들어오면 전곡을 바로 들을 수 있는 화면.
 *
 * ★지금은 «레이아웃과 유튜브 끌어오기»까지다 (사장님 지시 2026-08-18).
 *   앨범마다 붙일 소개 글은 오즈백 뮤직 프로젝트에서 넘어오면
 *   lib/music.ts 의 해당 앨범 intro 칸에 넣는다. 그러면 아래 «앨범 이야기»
 *   자리에 자동으로 나온다 — 이 파일은 다시 안 고쳐도 된다.
 */

export function generateStaticParams() {
  return albums.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = albumOf(slug);
  if (!a) return {};
  return {
    title: `${a.title} (${a.titleEn})`,
    description: a.blurb,
    alternates: { canonical: `/music/album/${a.slug}` },
    openGraph: {
      title: `${a.title} (${a.titleEn}) | 오즈백 뮤직`,
      description: a.blurb,
      images: [{ url: a.cover }],
    },
  };
}

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const album = albumOf(slug);
  if (!album) notFound();

  // ★«발매일이 지났나»만 보면 안 된다.
  //   업로드가 매일 조금씩 풀리는 중이라, 발매일이 지났어도 방문자에게는
  //   아직 아무것도 안 보이는 앨범이 있다 (볕 드는 날 — 21개 중 공개 1개).
  //   그래서 실제로 «대표 영상이 공개인가»를 물어보고 재생기를 건다.
  const playable = await playableEditions(album);
  const editions = album.editions.filter((e) => playable.has(e.playlistId));
  const upcoming = isUpcoming(album) || editions.length === 0;
  const others = albums.filter((a) => a.slug !== album.slug);

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* ── 앨범 머리 ── */}
        <section
          className="ob-grain relative overflow-hidden"
          style={{
            background: `linear-gradient(125deg, ${album.bgFrom}, ${album.bgTo})`,
          }}
        >
          <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16">
            <Link
              href="/music"
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-white/70 transition hover:text-white"
            >
              ← 오즈백 뮤직
            </Link>

            <div className="mt-6 flex flex-col gap-7 sm:flex-row sm:items-end">
              <div className="w-40 shrink-0 overflow-hidden rounded-2xl shadow-2xl sm:w-56">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={album.cover}
                  alt={`${album.title} 앨범 표지`}
                  className="aspect-square w-full object-cover"
                />
              </div>

              <div className="min-w-0">
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-black ${
                    upcoming
                      ? "bg-oddsbag-yellow text-oddsbag-dark"
                      : "bg-white/20 text-white backdrop-blur"
                  }`}
                >
                  {upcoming
                    ? `${album.releaseDate.replace(/-/g, ".")} 발매 예정`
                    : `${album.releaseDate.replace(/-/g, ".")} 발매`}
                </span>

                <h1
                  className="ob-rise mt-3 text-[34px] font-black leading-[1.1] text-white sm:text-[48px]"
                  style={{ letterSpacing: "-0.035em", wordBreak: "keep-all" }}
                >
                  {album.emoji} {album.title}
                </h1>
                <p className="mt-1 text-[15px] font-bold uppercase tracking-[0.18em] text-white/60">
                  {album.titleEn}
                </p>
                <p
                  className="mt-4 max-w-[50ch] text-[15.5px] leading-relaxed text-white/85 sm:text-[17px]"
                  style={{ wordBreak: "keep-all" }}
                >
                  {album.blurb}
                </p>
                <p className="mt-4 text-[13.5px] font-bold text-white/70">
                  🎧 {album.scene}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 앨범 이야기 (내일 오즈백 뮤직에서 넘어올 자리) ── */}
        {album.intro && (
          <section className="mx-auto max-w-3xl px-4 py-12">
            <h2 className="text-xl font-black text-oddsbag-dark">앨범 이야기</h2>
            <div
              className="article-body mt-4"
              style={{ wordBreak: "keep-all" }}
            >
              {album.intro.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        )}

        {/* ── 듣기 — 판(연주/노래)마다 하나씩 ──
            ★아직 발매 전인 앨범은 영상이 비공개라 재생기를 붙이면 방문자에게
              «동영상을 재생할 수 없음»만 뜬다. 그래서 발매 전에는 재생기를 걸지 않고
              언제 나오는지만 알린다. 발매일이 지나면 저절로 재생기로 바뀐다. */}
        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-xl font-black text-oddsbag-dark">
            {upcoming ? "🗓 곧 나옵니다" : "▶ 전곡 듣기"}
          </h2>
          <p className="mt-0.5 text-sm text-oddsbag-gray">
            {upcoming
              ? `${album.releaseDate.replace(/-/g, ".")}에 공개됩니다.`
              : editions.length > 1
                ? "같은 앨범을 노래 판과 연주 판으로 각각 냈습니다."
                : "가사 없는 연주 판입니다."}
          </p>

          {upcoming ? (
            <div className="mt-5 rounded-2xl border border-dashed border-oddsbag-light-gray bg-oddsbag-light-gray/30 px-6 py-12 text-center">
              <span className="text-4xl" aria-hidden>
                {album.emoji}
              </span>
              <p className="mt-4 text-[16px] font-black text-oddsbag-dark">
                「{album.title}」은 아직 공개 전입니다
              </p>
              <p
                className="mx-auto mt-2 max-w-[44ch] text-sm leading-relaxed text-oddsbag-gray"
                style={{ wordBreak: "keep-all" }}
              >
                {album.editions.map((e) => e.label).join(" 판과 ")} 판으로
                준비하고 있습니다. 한 곡씩 올라가는 중이라, 전부 공개되면 이
                자리에서 바로 들으실 수 있습니다.
              </p>
              <Link
                href="/#subscribe"
                className="mt-6 inline-block rounded-full bg-oddsbag-purple px-5 py-2.5 text-sm font-bold text-white transition hover:bg-oddsbag-purple-dark"
              >
                나오면 알림 받기
              </Link>
            </div>
          ) : (
            <div
              className={`mt-5 grid grid-cols-1 gap-6 ${
                editions.length > 1 ? "lg:grid-cols-2" : ""
              }`}
            >
              {editions.map((ed) => (
                <div
                  key={ed.playlistId}
                  className="overflow-hidden rounded-2xl border border-oddsbag-light-gray bg-white"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-oddsbag-light-gray px-4 py-3">
                    <div>
                      <h3 className="font-black text-oddsbag-dark">
                        {ed.kind === "vocal" ? "🎤" : "🎧"} {ed.label}
                      </h3>
                      <p className="text-[12.5px] text-oddsbag-gray">
                        재생목록
                      </p>
                    </div>
                    <a
                      href={playlistWatchUrl(ed.playlistId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-[13px] font-bold text-oddsbag-purple hover:underline"
                    >
                      유튜브에서 ↗
                    </a>
                  </div>
                  <div className="relative aspect-video bg-black">
                    <iframe
                      src={playlistEmbedUrl(ed.playlistId)}
                      title={`${album.title} ${ed.label}`}
                      className="absolute inset-0 h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-5 rounded-xl bg-oddsbag-light-gray/60 px-4 py-3 text-[12.5px] text-oddsbag-gray">
            ⓘ 이 음원은 AI로 만들었습니다 (AI-generated / Synthetic).
          </p>
        </section>

        {/* ── 다른 앨범 ── */}
        <section className="border-t border-oddsbag-light-gray bg-oddsbag-light-gray/30">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <div className="mb-5 flex items-end justify-between gap-3">
              <h2 className="text-xl font-black text-oddsbag-dark">
                다른 앨범
              </h2>
              <a
                href={MUSIC_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm font-bold text-oddsbag-purple hover:underline"
              >
                유튜브 채널 →
              </a>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {others.map((a) => (
                <Link
                  key={a.slug}
                  href={`/music/album/${a.slug}`}
                  className="ob-lift ob-zoom group overflow-hidden rounded-2xl border border-oddsbag-light-gray bg-white hover:border-oddsbag-purple"
                >
                  <div className="aspect-square overflow-hidden bg-oddsbag-light-gray">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.cover}
                      alt=""
                      aria-hidden
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="line-clamp-1 text-[14px] font-black text-oddsbag-dark group-hover:text-oddsbag-purple">
                      {a.title}
                    </h3>
                    <p className="text-[11.5px] text-oddsbag-gray">
                      {a.titleEn}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
