import Link from "next/link";
import SearchBox from "@/components/SearchBox";
import MainNav from "@/components/MainNav";
import { getSiteConfig } from "@/lib/sitecfg";

export default async function Header() {
  const cfg = await getSiteConfig();

  return (
    <header className="sticky top-0 z-50 border-b border-oddsbag-light-gray bg-white/90 backdrop-blur">
      {/* 공지 띠 — 관리자 화면에서 켜고 끈다 */}
      {cfg.notice.enabled && cfg.notice.text && (
        <div className="bg-oddsbag-purple text-center text-[13px] font-bold text-white">
          {cfg.notice.href ? (
            <Link href={cfg.notice.href} className="block px-4 py-1.5 hover:underline">
              {cfg.notice.text}
            </Link>
          ) : (
            <p className="px-4 py-1.5">{cfg.notice.text}</p>
          )}
        </div>
      )}

      {/* 브랜드 스트립 */}
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-xl font-black tracking-tight text-oddsbag-purple">
            ODDSBAG
          </span>
          <span className="hidden text-sm font-bold text-oddsbag-gray sm:inline">
            오즈백
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden w-64 md:block lg:w-72">
            <SearchBox size="sm" placeholder="검색" />
          </div>
          <Link
            href="/#subscribe"
            className="rounded-full bg-oddsbag-purple px-4 py-1.5 text-sm font-bold text-white transition hover:bg-oddsbag-purple-dark"
          >
            구독
          </Link>
        </div>
      </div>

      {/* 좁은 화면(폰)에서는 한 줄 아래에 */}
      <div className="border-t border-oddsbag-light-gray/70 px-3 py-2 md:hidden">
        <SearchBox size="sm" placeholder="찾으시는 걸 검색해 보세요" />
      </div>

      <MainNav />
    </header>
  );
}
