import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getLatestPosts } from "@/lib/posts";
import { categories } from "@/lib/categories";
import { channelOf } from "@/lib/channels";
import type { Metadata } from "next";

// 내려간 글·없는 주소로 들어온 사람을 붙잡는 자리.
//  여기로 떨어지는 유입이 유튜브 21편(채널 조회의 63%) · 인스타 릴스 16편 · 페북 81건이다.
//  기본 404는 영어 한 줄에 누를 수 있는 링크가 0개라 전부 그 자리에서 나간다.
//  그래서 ①왜 없는지 ②대신 볼 것(최신글) ③분야 ④홈 을 한 화면에 둔다.
// ※ 상태코드는 그대로 404다 (색인에서 빠지는 건 정상). 사람만 구제한다.

export const metadata: Metadata = {
  title: "이 글은 지금 볼 수 없습니다",
  robots: { index: false, follow: true },
};

export default async function NotFound() {
  // 글 목록을 못 읽어도 페이지는 반드시 떠야 한다 — 실패하면 링크만 있는 화면으로.
  let latest: Awaited<ReturnType<typeof getLatestPosts>> = [];
  try {
    latest = await getLatestPosts(6);
  } catch {
    latest = [];
  }

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="bg-gradient-to-br from-oddsbag-purple-dark via-oddsbag-purple to-oddsbag-purple-light">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:py-20">
            <p className="text-sm font-bold text-oddsbag-yellow">
              찾으시는 글이 없습니다
            </p>
            <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
              이 글은 지금 볼 수 없습니다
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80">
              주소가 바뀌었거나, 다시 확인하는 과정에서 내려간 글입니다. 오즈백은
              이미 나간 글도 하루 세 번 다시 검사해서, 사실이 틀렸거나 기준에 못
              미치면 그대로 두지 않고 내립니다.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <Link
                href="/magazine"
                className="rounded-full bg-oddsbag-yellow px-5 py-2.5 text-sm font-bold text-oddsbag-purple-dark transition hover:brightness-95"
              >
                최신 글 보러 가기
              </Link>
              <Link
                href="/"
                className="rounded-full border border-white/40 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
              >
                오즈백 홈
              </Link>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-4 py-12 space-y-10">
          {latest.length > 0 && (
            <section>
              <h2 className="text-lg font-black text-oddsbag-dark">
                대신 이건 어떠세요
              </h2>
              <ul className="mt-4 divide-y divide-oddsbag-light-gray rounded-2xl border border-oddsbag-light-gray bg-white">
                {latest.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`${channelOf(p.channel).base}/${p.slug}`}
                      className="flex items-start gap-3 px-4 py-3.5 transition hover:bg-oddsbag-purple/5"
                    >
                      <span className="text-lg leading-6">{p.emoji ?? "📌"}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold leading-snug text-oddsbag-dark">
                          {p.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-oddsbag-gray">
                          {p.category}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-lg font-black text-oddsbag-dark">분야로 찾기</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/category/${c.slug}`}
                  className="rounded-full border border-oddsbag-light-gray px-4 py-2 text-sm text-oddsbag-gray transition hover:border-oddsbag-purple/40 hover:text-oddsbag-purple"
                >
                  {c.emoji} {c.label}
                </Link>
              ))}
              <Link
                href="/guide"
                className="rounded-full border border-oddsbag-light-gray px-4 py-2 text-sm text-oddsbag-gray transition hover:border-oddsbag-purple/40 hover:text-oddsbag-purple"
              >
                💡 꿀팁
              </Link>
            </div>
          </section>

          <p className="rounded-2xl bg-oddsbag-purple/5 px-5 py-4 text-xs leading-relaxed text-oddsbag-gray">
            글이 왜 내려가는지 궁금하시면{" "}
            <Link
              href="/about"
              className="font-bold text-oddsbag-purple underline underline-offset-2"
            >
              오즈백이 글을 만드는 방식
            </Link>
            에 적어두었습니다.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
