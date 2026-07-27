import Header from "@/components/Header";
import Footer from "@/components/Footer";
import type { ReactNode } from "react";

// 소개·개인정보처리방침·이용약관·문의 처럼 '읽는 문서' 페이지의 공통 껍데기.
// 매거진 글과 달리 광고를 넣지 않는다 (정책 문서에 광고를 붙이면 심사에 불리하다).
export default function LegalPage({
  title,
  lead,
  updated,
  children,
}: {
  title: string;
  lead?: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="bg-gradient-to-br from-oddsbag-purple-dark via-oddsbag-purple to-oddsbag-purple-light">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              {title}
            </h1>
            {lead && (
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80">
                {lead}
              </p>
            )}
          </div>
        </section>

        <article className="mx-auto max-w-3xl px-4 py-12">
          {updated && (
            <p className="mb-8 text-xs text-oddsbag-gray">시행일 {updated}</p>
          )}
          <div className="space-y-9">{children}</div>
        </article>
      </main>
      <Footer />
    </>
  );
}

// 문서 안의 한 절(節)
export function Section({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-black text-oddsbag-dark">{heading}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-[1.85] text-oddsbag-dark/85">
        {children}
      </div>
    </section>
  );
}

// 문서 안의 목록
export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-oddsbag-purple" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
