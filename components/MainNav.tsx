"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mainNav } from "@/lib/channels";
import { categories } from "@/lib/categories";

/**
 * 상단 메인 메뉴 — 홈 / 오즈백 / 뮤직 / 서비스 / 매거진
 * 매거진 쪽 화면에 있을 때만 그 아래에 카테고리(하위 탭) 줄이 나온다.
 */
export default function MainNav() {
  const path = usePathname() ?? "/";

  const isActive = (href: string, match: string[]) =>
    href === "/" ? path === "/" : match.some((m) => path.startsWith(m));

  const inMagazine = ["/magazine", "/category", "/guide"].some((m) =>
    path.startsWith(m),
  );
  const activeCat = path.startsWith("/category/") ? path.split("/")[2] : null;

  return (
    <>
      <nav className="border-t border-oddsbag-light-gray/70">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-3 text-[15px]">
          {mainNav.map((item) => {
            const on = isActive(item.href, item.match);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`-mb-px whitespace-nowrap border-b-[3px] px-3.5 py-2.5 font-bold transition ${
                  on
                    ? "border-oddsbag-purple text-oddsbag-purple"
                    : "border-transparent text-oddsbag-dark/70 hover:text-oddsbag-dark"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/contact"
            className={`-mb-px ml-auto whitespace-nowrap border-b-[3px] px-3.5 py-2.5 font-bold transition ${
              path.startsWith("/contact")
                ? "border-oddsbag-purple text-oddsbag-purple"
                : "border-transparent text-oddsbag-gray hover:text-oddsbag-dark"
            }`}
          >
            문의
          </Link>
        </div>
      </nav>

      {/* 매거진 하위 탭 — 이슈 카테고리 */}
      {inMagazine && (
        <div className="border-t border-oddsbag-light-gray/70 bg-oddsbag-light-gray/40">
          <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-3 py-2 text-sm">
            <Link
              href="/magazine"
              className={`whitespace-nowrap rounded-full px-3 py-1 font-bold transition ${
                path === "/magazine"
                  ? "bg-oddsbag-purple text-white"
                  : "text-oddsbag-dark hover:bg-white"
              }`}
            >
              전체
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className={`whitespace-nowrap rounded-full px-3 py-1 font-medium transition ${
                  activeCat === c.slug
                    ? "bg-oddsbag-purple text-white"
                    : "text-oddsbag-gray hover:bg-white hover:text-oddsbag-dark"
                }`}
              >
                {c.emoji} {c.label}
              </Link>
            ))}
            <Link
              href="/guide"
              className={`whitespace-nowrap rounded-full px-3 py-1 font-medium transition ${
                path.startsWith("/guide")
                  ? "bg-oddsbag-purple text-white"
                  : "text-oddsbag-purple hover:bg-white"
              }`}
            >
              📚 가이드
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
