import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-oddsbag-light-gray bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-xl font-black tracking-tight text-oddsbag-purple">
            ODDSBAG
          </span>
          <span className="text-sm font-bold text-oddsbag-gray">오즈백</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-oddsbag-gray">
          <Link href="/#tools" className="transition hover:text-oddsbag-purple">
            도구
          </Link>
          <Link href="/magazine" className="transition hover:text-oddsbag-purple">
            매거진
          </Link>
        </nav>
      </div>
    </header>
  );
}
