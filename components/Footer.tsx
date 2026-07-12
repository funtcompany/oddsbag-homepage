import Link from "next/link";
import { categories } from "@/lib/categories";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-oddsbag-light-gray bg-oddsbag-dark text-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-white">ODDSBAG</span>
              <span className="text-sm font-bold text-oddsbag-yellow">오즈백</span>
            </div>
            <p className="mt-2 text-sm text-white/70">
              이상하게 필요한 것들, 오즈백에 다 있어
            </p>
          </div>

          <div>
            <p className="text-xs font-bold text-white/50">카테고리</p>
            <ul className="mt-2 grid grid-cols-2 gap-1 text-sm text-white/80">
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

          <div>
            <p className="text-xs font-bold text-white/50">오즈백</p>
            <ul className="mt-2 space-y-1 text-sm text-white/80">
              <li>
                <Link
                  href="/#subscribe"
                  className="transition hover:text-oddsbag-yellow"
                >
                  뉴스레터 구독
                </Link>
              </li>
              <li className="text-white/50">oddsbag.official@gmail.com</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-5 text-xs text-white/40">
          © {new Date().getFullYear()} ODDSBAG. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
