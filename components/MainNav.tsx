"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mainNav } from "@/lib/channels";
import { categories } from "@/lib/categories";
import { services } from "@/lib/services-catalog";
import {
  CHECKLIST_NAME,
  CHECKLIST_EMOJI,
  CHECKLIST_HREF,
} from "@/lib/checklist";

/**
 * 상단 메인 메뉴 — 홈 / 만드는 것들 / 뮤직 / 이야기 / 매거진   ···   문의
 *
 * 아래 한 줄(하위 탭)은 지금 있는 자리에 따라 달라진다.
 *   · 매거진 쪽    → 이슈 카테고리
 *   · 만드는 것들 쪽 → 서비스별 탭 (소식 · WPMS · 별의 결)
 *
 * ★가로 스크롤바
 *   폰에서는 탭 줄을 손가락으로 밀어야 해서 overflow-x 를 살려야 한다.
 *   그런데 그것 때문에 데스크톱에서 «문의» 옆에 회색 막대가 그려졌다.
 *   no-scrollbar(globals.css)로 막대만 지운다 — 미는 동작은 그대로 산다.
 *   탭 개수도 6개에서 5개+문의로 줄여서, 1152px 안에서 애초에 넘치지 않게 했다.
 */
export default function MainNav() {
  const path = usePathname() ?? "/";

  const isActive = (href: string, match: string[]) =>
    href === "/" ? path === "/" : match.some((m) => path.startsWith(m));

  const inMagazine = ["/magazine", "/category", "/guide"].some((m) =>
    path.startsWith(m),
  );
  const inMade = [
    "/oddsbag",
    "/services",
    "/service",
    "/apps",
    "/tools",
    CHECKLIST_HREF,
  ].some(
    (m) => path.startsWith(m),
  );
  const activeCat = path.startsWith("/category/") ? path.split("/")[2] : null;
  const activeService = path.startsWith("/oddsbag/service/")
    ? path.split("/")[3]
    : null;

  const subTab = (on: boolean) =>
    `whitespace-nowrap rounded-full px-3 py-1 font-medium transition ${
      on
        ? "bg-oddsbag-purple text-white"
        : "text-oddsbag-gray hover:bg-white hover:text-oddsbag-dark"
    }`;

  return (
    <>
      {/* 폰에서는 글자·여백을 한 단계 줄여 6칸이 한 화면에 들어오게 한다.
          (안 줄이면 437px 라 390px 폰에서 손으로 밀어야 «문의»가 보인다) */}
      <nav className="border-t border-oddsbag-light-gray/70">
        <div className="no-scrollbar mx-auto flex max-w-6xl items-center gap-0.5 overflow-x-auto px-1.5 text-[13.5px] sm:gap-1 sm:px-3 sm:text-[15px]">
          {mainNav.map((item) => {
            const on = isActive(item.href, item.match);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`-mb-px whitespace-nowrap border-b-[3px] px-2 py-2.5 font-bold transition sm:px-3.5 ${
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
            className={`-mb-px ml-auto whitespace-nowrap border-b-[3px] px-2 py-2.5 font-bold transition sm:px-3.5 ${
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
          <div className="no-scrollbar mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-3 py-2 text-sm">
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
                className={subTab(activeCat === c.slug)}
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

      {/* 만드는 것들 하위 탭 — 서비스별 */}
      {inMade && (
        <div className="border-t border-oddsbag-light-gray/70 bg-oddsbag-light-gray/40">
          <div className="no-scrollbar mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-3 py-2 text-sm">
            <Link
              href="/oddsbag"
              className={`whitespace-nowrap rounded-full px-3 py-1 font-bold transition ${
                path === "/oddsbag"
                  ? "bg-oddsbag-purple text-white"
                  : "text-oddsbag-dark hover:bg-white"
              }`}
            >
              소식
            </Link>
            {services.map((s) => (
              <Link
                key={s.slug}
                href={`/oddsbag/service/${s.slug}`}
                className={subTab(activeService === s.slug)}
              >
                {s.emoji} {s.tab}
              </Link>
            ))}
            <Link
              href={CHECKLIST_HREF}
              className={subTab(path.startsWith(CHECKLIST_HREF))}
            >
              {CHECKLIST_EMOJI} {CHECKLIST_NAME}
            </Link>
            <Link
              href="/service"
              className={subTab(
                path === "/service" || path.startsWith("/service/"),
              )}
            >
              🧰 오즈백 툴즈
            </Link>
            <Link
              href="/services"
              className={subTab(path.startsWith("/services"))}
            >
              전체 보기
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
