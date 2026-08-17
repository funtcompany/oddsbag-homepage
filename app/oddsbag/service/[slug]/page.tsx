import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostCard from "@/components/PostCard";
import SubscribeBox from "@/components/SubscribeBox";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  services,
  serviceOf,
  matchesService,
  type ServiceDef,
  type ServiceCTA,
} from "@/lib/services-catalog";
import { getVisiblePosts } from "@/lib/posts";

export const revalidate = 60;

/**
 * 서비스별 안내 화면 — «오즈백이 만드는 것들» 아래 탭 하나.
 *
 *   위   : 무엇인지 + 바로 쓰러 가거나 살 수 있는 버튼   ← 지시 «최상단에 이용·구매 링크»
 *   가운데: 뭐가 좋은지 몇 칸
 *   아래 : 관련 글 갤러리 (매거진과 같은 카드 모양)      ← 지시 «갤러리 형태로»
 *
 * 서비스를 늘리려면 lib/services-catalog.ts 에 한 칸 넣으면 된다.
 * 이 파일은 안 고쳐도 주소·탭·목록이 전부 따라온다.
 */

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const svc = serviceOf(slug);
  if (!svc) return {};
  return {
    title: svc.name,
    description: svc.metaDesc,
    alternates: { canonical: `/oddsbag/service/${svc.slug}` },
    openGraph: {
      title: `${svc.name} | 오즈백`,
      description: svc.metaDesc,
    },
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const svc = serviceOf(slug);
  if (!svc) notFound();

  const all = await getVisiblePosts();
  const related = all.filter((p) => matchesService(p, svc)).slice(0, 12);

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* ── 맨 위: 무엇인지 + 이용·구매 버튼 ── */}
        <section
          className="ob-grain relative overflow-hidden"
          style={{
            background: `linear-gradient(125deg, ${svc.bgFrom}, ${svc.bgTo})`,
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 select-none text-[200px] leading-none opacity-10 sm:text-[300px]"
          >
            {svc.emoji}
          </span>

          <div className="relative mx-auto max-w-6xl px-4 py-14 sm:py-20">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-black ${svc.statusTone}`}
              >
                {svc.status}
              </span>
              <span className="text-[11px] font-black tracking-[0.22em] text-white/60">
                {svc.kicker}
              </span>
            </div>

            <h1
              className="ob-rise mt-4 max-w-[22ch] text-[32px] font-black leading-[1.15] text-white sm:text-[46px]"
              style={{ letterSpacing: "-0.035em", wordBreak: "keep-all" }}
            >
              {svc.headline}
            </h1>
            <p className="mt-2 text-[15px] font-bold text-white/60">
              {svc.name}
            </p>
            <p
              className="mt-5 max-w-[52ch] text-[16px] leading-relaxed text-white/85 sm:text-[17.5px]"
              style={{ wordBreak: "keep-all" }}
            >
              {svc.lead}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-2.5">
              {svc.ctas.map((c) => (
                <CtaButton key={c.label} cta={c} />
              ))}
            </div>
          </div>
        </section>

        {/* ── 뭐가 좋은가 ── */}
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {svc.highlights.map((h, i) => (
              <div
                key={h.title}
                data-reveal-index={i}
                className="ob-reveal ob-lift rounded-2xl border border-oddsbag-light-gray bg-white p-5"
              >
                <span className="text-2xl" aria-hidden>
                  {h.icon}
                </span>
                <h3 className="mt-3 text-[15.5px] font-black text-oddsbag-dark">
                  {h.title}
                </h3>
                <p
                  className="mt-1.5 text-[13.5px] leading-relaxed text-oddsbag-gray"
                  style={{ wordBreak: "keep-all" }}
                >
                  {h.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 관련 글 갤러리 ── */}
        <section
          id="관련글"
          className="scroll-mt-40 border-t border-oddsbag-light-gray bg-oddsbag-light-gray/30"
        >
          <div className="mx-auto max-w-6xl px-4 py-12">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-oddsbag-dark">
                  {svc.tab} 관련 글
                </h2>
                <p className="mt-0.5 text-sm text-oddsbag-gray">
                  {related.length > 0
                    ? `${related.length}편`
                    : "쓰는 대로 여기에 쌓입니다"}
                </p>
              </div>
              <Link
                href="/magazine"
                className="shrink-0 text-sm font-bold text-oddsbag-purple hover:underline"
              >
                매거진 전체 →
              </Link>
            </div>

            {related.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {related.map((p, i) => (
                  <div
                    key={p.slug}
                    className="ob-reveal"
                    data-reveal-index={i}
                  >
                    <PostCard post={p} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-oddsbag-light-gray bg-white px-6 py-12 text-center">
                <p className="text-[15px] font-bold text-oddsbag-dark">
                  아직 올라온 글이 없습니다.
                </p>
                <p
                  className="mx-auto mt-2 max-w-[46ch] text-sm text-oddsbag-gray"
                  style={{ wordBreak: "keep-all" }}
                >
                  {svc.tab}에 대해 쓴 글이 올라오면 이 자리에 갤러리로 쌓입니다.
                  뉴스레터를 구독하시면 올라올 때 알려드릴게요.
                </p>
                <Link
                  href="/#subscribe"
                  className="mt-5 inline-block rounded-full bg-oddsbag-purple px-5 py-2.5 text-sm font-bold text-white transition hover:bg-oddsbag-purple-dark"
                >
                  구독하기
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ── 다른 서비스로 ── */}
        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="mb-4 text-lg font-black text-oddsbag-dark">
            오즈백이 만드는 다른 것들
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {services
              .filter((s) => s.slug !== svc.slug)
              .map((s) => (
                <OtherCard key={s.slug} svc={s} />
              ))}
            <Link
              href="/music"
              className="ob-lift flex items-center gap-4 rounded-2xl border border-oddsbag-light-gray bg-white p-5 hover:border-oddsbag-purple"
            >
              <span className="text-3xl" aria-hidden>
                🎵
              </span>
              <div>
                <h3 className="font-black text-oddsbag-dark">오즈백 뮤직</h3>
                <p className="mt-0.5 text-sm text-oddsbag-gray">
                  앨범과 24시간 라이브를 바로 듣기
                </p>
              </div>
            </Link>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 pb-12">
          <SubscribeBox />
        </div>
      </main>
      <Footer />
    </>
  );
}

function OtherCard({ svc }: { svc: ServiceDef }) {
  return (
    <Link
      href={`/oddsbag/service/${svc.slug}`}
      className="ob-lift flex items-center gap-4 rounded-2xl border border-oddsbag-light-gray bg-white p-5 hover:border-oddsbag-purple"
    >
      <span className="text-3xl" aria-hidden>
        {svc.emoji}
      </span>
      <div className="min-w-0">
        <h3 className="font-black text-oddsbag-dark">{svc.name}</h3>
        <p
          className="mt-0.5 line-clamp-2 text-sm text-oddsbag-gray"
          style={{ wordBreak: "keep-all" }}
        >
          {svc.lead}
        </p>
      </div>
    </Link>
  );
}

function CtaButton({ cta }: { cta: ServiceCTA }) {
  const cls =
    cta.kind === "primary"
      ? "rounded-full bg-oddsbag-yellow px-6 py-3 text-[15px] font-black text-oddsbag-dark transition hover:brightness-95"
      : "rounded-full border border-white/45 px-6 py-3 text-[15px] font-bold text-white transition hover:border-white hover:bg-white/10";

  if (cta.external) {
    return (
      <a
        href={cta.href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
      >
        {cta.label} ↗
      </a>
    );
  }
  // 같은 화면 안 앵커(#관련글)는 Link 대신 a 로 둔다
  if (cta.href.startsWith("#")) {
    return (
      <a href={cta.href} className={cls}>
        {cta.label}
      </a>
    );
  }
  return (
    <Link href={cta.href} className={cls}>
      {cta.label}
    </Link>
  );
}
