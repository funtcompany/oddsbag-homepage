import Link from "next/link";
import { categories } from "@/lib/categories";
import { getSiteConfig } from "@/lib/sitecfg";

export default async function Footer() {
  const cfg = await getSiteConfig();
  const f = cfg.footer;

  const sns = [
    f.instagram && { label: "인스타그램", href: f.instagram },
    f.facebook && { label: "페이스북", href: f.facebook },
    f.youtube && { label: "유튜브", href: f.youtube },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <footer className="mt-auto border-t border-oddsbag-light-gray bg-oddsbag-dark text-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-4">
          {/* 회사 소개 */}
          <div className="lg:col-span-1">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-white">ODDSBAG</span>
              <span className="text-sm font-bold text-oddsbag-yellow">오즈백</span>
            </div>
            <p className="mt-2 text-sm text-white/70">{f.tagline}</p>
            {f.intro && (
              <p
                className="mt-3 text-[13px] leading-relaxed text-white/50"
                style={{ wordBreak: "keep-all" }}
              >
                {f.intro}
              </p>
            )}
            {sns.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {sns.map((s) => (
                  <a
                    key={s.href}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-white/15 px-3 py-1 text-[12px] text-white/70 transition hover:border-oddsbag-yellow hover:text-oddsbag-yellow"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* 메뉴 */}
          <div>
            <p className="text-xs font-bold text-white/50">둘러보기</p>
            <ul className="mt-2 space-y-1.5 text-sm text-white/80">
              <li>
                <Link href="/oddsbag" className="transition hover:text-oddsbag-yellow">
                  오즈백
                </Link>
              </li>
              <li>
                <Link href="/music" className="transition hover:text-oddsbag-yellow">
                  뮤직
                </Link>
              </li>
              <li>
                <Link href="/services" className="transition hover:text-oddsbag-yellow">
                  서비스
                </Link>
              </li>
              <li>
                <Link href="/magazine" className="transition hover:text-oddsbag-yellow">
                  매거진
                </Link>
              </li>
              <li>
                <Link href="/guide" className="transition hover:text-oddsbag-yellow">
                  주제별 가이드
                </Link>
              </li>
            </ul>
          </div>

          {/* 매거진 카테고리 */}
          <div>
            <p className="text-xs font-bold text-white/50">매거진 분야</p>
            <ul className="mt-2 grid grid-cols-2 gap-1.5 text-sm text-white/80">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="transition hover:text-oddsbag-yellow"
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 회사 정보 */}
          <div>
            <p className="text-xs font-bold text-white/50">회사 정보</p>
            <ul className="mt-2 space-y-1.5 text-[13px] text-white/60">
              <li className="font-bold text-white/80">{f.company}</li>
              {f.ceo && <li>대표 {f.ceo}</li>}
              {f.bizNo && <li>사업자등록번호 {f.bizNo}</li>}
              {f.address && <li>{f.address}</li>}
              {f.phone && (
                <li>
                  고객센터{" "}
                  <a
                    href={`tel:${f.phone.replace(/[^0-9+]/g, "")}`}
                    className="transition hover:text-oddsbag-yellow"
                  >
                    {f.phone}
                  </a>
                </li>
              )}
              {f.kakao && <li>카카오채널 {f.kakao}</li>}
              {f.email && (
                <li>
                  <a
                    href={`mailto:${f.email}`}
                    className="transition hover:text-oddsbag-yellow"
                  >
                    {f.email}
                  </a>
                </li>
              )}
            </ul>
            <Link
              href="/contact"
              className="mt-4 inline-block rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-oddsbag-yellow hover:text-oddsbag-dark"
            >
              문의하기
            </Link>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} ODDSBAG. All rights reserved.</span>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/about" className="transition hover:text-oddsbag-yellow">
              소개
            </Link>
            <Link
              href="/privacy"
              className="font-bold text-white/70 transition hover:text-oddsbag-yellow"
            >
              개인정보처리방침
            </Link>
            <Link href="/terms" className="transition hover:text-oddsbag-yellow">
              이용약관
            </Link>
            <Link href="/contact" className="transition hover:text-oddsbag-yellow">
              문의하기
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
