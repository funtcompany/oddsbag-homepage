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
import { getBoardPosts, getVisiblePosts } from "@/lib/posts";
import type { Post } from "@/lib/posts";

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
 *
 * ★아래 «게시판» 칸은 두 가지를 합쳐 보여준다 (2026-08-18)
 *   ① boardOnly === 이 서비스 slug 인 글 — 여기서만 보이는 전용 글 (WPMS 원고 50편)
 *   ② 그 밖의 글 중 태그·제목이 이 서비스와 맞는 글 (matchesService)
 *   50편이 한 화면에 다 깔리면 무거우니 첫 12편만 펼치고 나머지는 «더 보기»에 접어 둔다.
 *   접어 두기는 <details> 라 자바스크립트 없이 열리고, 주소(<a>)는 처음부터 전부 들어 있어
 *   구글이 50편을 모두 따라갈 수 있다.
 */

// 처음에 펼쳐 두는 칸 수 — 나머지는 «더 보기» 안으로 접는다
const 첫칸 = 12;

// 구조화 데이터에 쓰는 절대 주소 앞자리 (lib/articleMeta.ts 와 같은 값)
const SITE = "https://oddsbag.co.kr";

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
  // ★openGraph 를 title·description 둘만 적어 두면 루트 layout 의 openGraph 객체가
  //  통째로 덮여서 type·locale·url·siteName·images 가 전부 사라진다 (2026-08-18 실측).
  //  그래서 이 화면에서 쓸 값을 여기서 다시 다 적는다.
  return {
    title: svc.name,
    description: svc.metaDesc,
    keywords: svc.metaKeywords,
    alternates: { canonical: `/oddsbag/service/${svc.slug}` },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName: "오즈백 ODDSBAG",
      url: `https://oddsbag.co.kr/oddsbag/service/${svc.slug}`,
      title: `${svc.name} | 오즈백`,
      description: svc.metaDesc,
      images: svc.ogImage
        ? [
            {
              url: svc.ogImage,
              width: svc.ogImageSize?.width,
              height: svc.ogImageSize?.height,
              alt: svc.name,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${svc.name} | 오즈백`,
      description: svc.metaDesc,
      images: svc.ogImage ? [svc.ogImage] : undefined,
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

  // ① 이 게시판 전용 글 (홈·매거진·RSS·구글뉴스에는 안 나오고 여기서만 보인다)
  // ② 그 밖에 이 서비스와 맞는 일반 글
  const [board, visible] = await Promise.all([
    getBoardPosts(svc.slug),
    getVisiblePosts(),
  ]);
  const 전용 = new Set(board.map((p) => p.slug));
  const 그밖에 = visible.filter(
    (p) => !전용.has(p.slug) && matchesService(p, svc),
  );
  const related = [...board, ...그밖에];
  const 먼저 = related.slice(0, 첫칸);
  const 나머지 = related.slice(첫칸);

  return (
    <>
      <Header />

      {/*
        검색엔진용 요약표(구조화 데이터).
        ★값은 전부 «화면에 실제로 보이는 것»과 같은 것을 쓴다.
          화면에 없는 걸 여기에만 적으면 구글 규정 위반이라 화면 전체가 무시된다.
          - featureList → 아래 «뭐가 좋은가» 8칸의 제목을 그대로 뽑아 쓴다
          - FAQPage     → 아래 «자주 묻는 질문» 칸과 같은 배열(svc.faqs)을 쓴다. 칸이 없으면 안 넣는다
          - 사양 문구   → 아래 사양표(svc.spec)에 보이는 값과 같다
        ★가격(offers)은 넣지 않는다 — 회사 규칙(가격을 적지 않는다).
        ★별점(AggregateRating)도 넣지 않는다 — 실제 후기 데이터가 없다.
        ※ BreadcrumbList 는 글 상세(lib/articleMeta.ts)에만 있고 이 화면엔 없었다 — 중복 아님.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              ...(svc.spec
                ? [
                    {
                      "@type": "SoftwareApplication",
                      name: svc.name,
                      alternateName: svc.brandTerms[0],
                      applicationCategory: "BusinessApplication",
                      operatingSystem: "Windows 10, Windows 11 (64-bit)",
                      softwareVersion: "ver.26",
                      inLanguage: "ko-KR",
                      url: `${SITE}/oddsbag/service/${svc.slug}`,
                      description: svc.metaDesc,
                      image: svc.ogImage ? `${SITE}${svc.ogImage}` : undefined,
                      featureList: svc.highlights.map((h) => h.title),
                      softwareRequirements:
                        svc.spec.find((r) => r.label === "필요한 것")?.value,
                      author: { "@type": "Organization", name: "펀트컴퍼니" },
                      publisher: {
                        "@type": "Organization",
                        name: "오즈백 ODDSBAG",
                        url: SITE,
                      },
                    },
                  ]
                : []),
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "홈", item: SITE },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "만드는 것들",
                    item: `${SITE}/oddsbag`,
                  },
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: svc.name,
                    item: `${SITE}/oddsbag/service/${svc.slug}`,
                  },
                ],
              },
              ...(svc.faqs?.length
                ? [
                    {
                      "@type": "FAQPage",
                      inLanguage: "ko-KR",
                      mainEntity: svc.faqs.map((f) => ({
                        "@type": "Question",
                        name: f.q,
                        acceptedAnswer: { "@type": "Answer", text: f.a },
                      })),
                    },
                  ]
                : []),
            ],
          }),
        }}
      />

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

        {/* ── 사양표 — 여기 보이는 값이 위 구조화 데이터와 «같은 값»이다 ── */}
        {svc.spec && svc.spec.length > 0 && (
          <section className="border-t border-oddsbag-light-gray bg-oddsbag-light-gray/30">
            <div className="mx-auto max-w-6xl px-4 py-12">
              <h2 className="mb-4 text-xl font-black text-oddsbag-dark">
                한눈에 보는 사양
              </h2>
              {/* 폰에서는 표가 옆으로 잘리지 않게 «제목/값» 두 줄로 쌓고, 넓어지면 2열로 붙인다 */}
              <dl className="overflow-hidden rounded-2xl border border-oddsbag-light-gray bg-white">
                {svc.spec.map((row, i) => (
                  <div
                    key={row.label}
                    className={`flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:gap-4 ${
                      i > 0 ? "border-t border-oddsbag-light-gray" : ""
                    }`}
                  >
                    <dt className="shrink-0 text-[13.5px] font-black text-oddsbag-dark sm:w-28">
                      {row.label}
                    </dt>
                    <dd
                      className="text-[13.5px] leading-relaxed text-oddsbag-gray"
                      style={{ wordBreak: "keep-all" }}
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        )}

        {/* ── 자주 묻는 질문 — FAQPage 스키마가 이 칸과 «같은 배열»을 쓴다 ── */}
        {svc.faqs && svc.faqs.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-12">
            <h2 className="mb-4 text-xl font-black text-oddsbag-dark">
              자주 묻는 질문
            </h2>
            <div className="overflow-hidden rounded-2xl border border-oddsbag-light-gray bg-white">
              {svc.faqs.map((f, i) => (
                <details
                  key={f.q}
                  className={`group ${
                    i > 0 ? "border-t border-oddsbag-light-gray" : ""
                  }`}
                >
                  <summary
                    className="flex cursor-pointer list-none items-start justify-between gap-3 px-5 py-4 text-[14.5px] font-black text-oddsbag-dark hover:text-oddsbag-purple"
                    style={{ wordBreak: "keep-all" }}
                  >
                    <span>{f.q}</span>
                    <span
                      aria-hidden
                      className="mt-0.5 shrink-0 text-oddsbag-gray transition group-open:rotate-180"
                    >
                      ▾
                    </span>
                  </summary>
                  <p
                    className="px-5 pb-4 text-[13.5px] leading-relaxed text-oddsbag-gray"
                    style={{ wordBreak: "keep-all" }}
                  >
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* ── 관련 글 갤러리 ── */}
        <section
          id="관련글"
          className="scroll-mt-40 border-t border-oddsbag-light-gray bg-oddsbag-light-gray/30"
        >
          <div className="mx-auto max-w-6xl px-4 py-12">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-oddsbag-dark">
                  {board.length > 0 ? `${svc.tab} 게시판` : `${svc.tab} 관련 글`}
                </h2>
                <p className="mt-0.5 text-sm text-oddsbag-gray">
                  {related.length > 0
                    ? `${related.length}편`
                    : "쓰는 대로 여기에 쌓입니다"}
                </p>
              </div>
              <Link
                href={board.length > 0 ? "/oddsbag" : "/magazine"}
                className="shrink-0 text-sm font-bold text-oddsbag-purple hover:underline"
              >
                {board.length > 0 ? "만드는 것들 전체 →" : "매거진 전체 →"}
              </Link>
            </div>

            {related.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {먼저.map((p, i) => (
                    <div
                      key={p.slug}
                      className="ob-reveal"
                      data-reveal-index={i}
                    >
                      <PostCard post={p} />
                    </div>
                  ))}
                </div>

                {나머지.length > 0 && (
                  <details className="group mt-4">
                    <summary className="mx-auto w-fit cursor-pointer list-none rounded-full border border-oddsbag-light-gray bg-white px-6 py-2.5 text-sm font-bold text-oddsbag-dark transition hover:border-oddsbag-purple hover:text-oddsbag-purple">
                      <span className="group-open:hidden">
                        나머지 {나머지.length}편 더 보기 ▾
                      </span>
                      <span className="hidden group-open:inline">접기 ▴</span>
                    </summary>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {나머지.map((p: Post) => (
                        <PostCard key={p.slug} post={p} />
                      ))}
                    </div>
                  </details>
                )}
              </>
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
