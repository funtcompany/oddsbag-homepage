import Link from "next/link";
import { categories } from "@/lib/categories";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-oddsbag-light-gray bg-white/90 backdrop-blur">
      {/* 브랜드 스트립 (아주 심플) */}
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-xl font-black tracking-tight text-oddsbag-purple">
            ODDSBAG
          </span>
          <span className="hidden text-sm font-bold text-oddsbag-gray sm:inline">
            오즈백 매거진
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/#subscribe"
            className="rounded-full bg-oddsbag-purple px-4 py-1.5 text-sm font-bold text-white transition hover:bg-oddsbag-purple-dark"
          >
            구독
          </Link>
        </div>
      </div>

      {/* 카테고리 네비 (게시판 느낌) */}
      <nav className="border-t border-oddsbag-light-gray/70">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-3 py-2 text-sm">
          <Link
            href="/"
            className="whitespace-nowrap rounded-full px-3 py-1 font-bold text-oddsbag-dark transition hover:bg-oddsbag-light-gray"
          >
            홈
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className="whitespace-nowrap rounded-full px-3 py-1 font-medium text-oddsbag-gray transition hover:bg-oddsbag-light-gray hover:text-oddsbag-dark"
            >
              {c.emoji} {c.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
