import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "링크 모음",
  description: "오즈백과 함께 운영하는 브랜드 채널을 한곳에.",
};

interface LinkItem {
  emoji: string;
  label: string;
  sub?: string;
  href: string;
  primary?: boolean;
}

const oddsbag: LinkItem[] = [
  { emoji: "🗞️", label: "오즈백 매거진", sub: "오늘의 이슈 보러가기", href: "https://oddsbag.co.kr", primary: true },
  { emoji: "📸", label: "인스타그램", sub: "@oddsbag_official", href: "https://instagram.com/oddsbag_official" },
];

const brands: LinkItem[] = [
  { emoji: "✏️", label: "메모냅 스튜디오", sub: "memonap.com", href: "https://memonap.com" },
  { emoji: "🗂️", label: "메모냅 아카이브", sub: "memonaparchive.kr", href: "https://www.memonaparchive.kr" },
  { emoji: "🏢", label: "펀트컴퍼니", sub: "funtcompany.co.kr", href: "https://www.funtcompany.co.kr" },
];

function LinkButton({ item }: { item: LinkItem }) {
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition ${
        item.primary
          ? "border-oddsbag-yellow bg-oddsbag-yellow text-oddsbag-dark hover:brightness-95"
          : "border-white/15 bg-white/10 text-white hover:bg-white/15"
      }`}
    >
      <span className="text-2xl" aria-hidden>
        {item.emoji}
      </span>
      <span className="flex-1 text-left">
        <span className="block text-[15px] font-black leading-tight">
          {item.label}
        </span>
        {item.sub && (
          <span
            className={`block text-xs ${item.primary ? "text-oddsbag-dark/70" : "text-white/60"}`}
          >
            {item.sub}
          </span>
        )}
      </span>
      <span
        className={`text-lg ${item.primary ? "text-oddsbag-dark/50" : "text-white/40"}`}
      >
        →
      </span>
    </a>
  );
}

export default function LinkHub() {
  return (
    <main className="flex flex-1 justify-center bg-gradient-to-b from-oddsbag-purple-dark via-oddsbag-purple to-[#2a1250] px-5 py-12">
      <div className="w-full max-w-md">
        {/* 브랜드 헤더 */}
        <div className="flex flex-col items-center text-center">
          <div className="relative h-20 w-20">
            <div className="absolute bottom-0 left-[8%] h-[78%] w-[84%] rounded-[23%] bg-gradient-to-br from-[#b58cf0] via-[#8457c0] to-[#6a3ab0] shadow-lg" />
            <div className="absolute left-[31.5%] top-[4%] h-[28%] w-[37%] rounded-t-full border-[3px] border-b-0 border-white" />
            <div
              className="absolute right-[2%] top-[-3%] h-[32%] w-[32%] bg-oddsbag-yellow"
              style={{
                clipPath:
                  "polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%)",
              }}
            />
          </div>
          <h1 className="mt-4 text-2xl font-black text-white">
            ODDSBAG <span className="text-oddsbag-yellow">오즈백</span>
          </h1>
          <p className="mt-1.5 text-sm text-white/70">
            이상하게 필요한 것들, 오즈백에
          </p>
        </div>

        {/* 오즈백 채널 */}
        <div className="mt-8 flex flex-col gap-3">
          {oddsbag.map((item) => (
            <LinkButton key={item.href} item={item} />
          ))}
        </div>

        {/* 함께 운영하는 브랜드 */}
        <div className="mt-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/15" />
          <span className="text-xs font-bold tracking-wide text-white/50">
            함께 운영하는 브랜드
          </span>
          <div className="h-px flex-1 bg-white/15" />
        </div>
        <div className="mt-5 flex flex-col gap-3">
          {brands.map((item) => (
            <LinkButton key={item.href} item={item} />
          ))}
        </div>

        {/* 문의 */}
        <div className="mt-8 flex flex-col items-center gap-2 text-xs text-white/50">
          <div className="flex gap-4">
            <a
              href="http://pf.kakao.com/_EDgsn"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-oddsbag-yellow"
            >
              카카오톡 문의
            </a>
            <span>·</span>
            <a
              href="mailto:oddsbag.official@gmail.com"
              className="hover:text-oddsbag-yellow"
            >
              이메일
            </a>
          </div>
          <span className="mt-2 text-white/30">© ODDSBAG</span>
        </div>
      </div>
    </main>
  );
}
