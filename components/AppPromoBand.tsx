import Link from "next/link";

// 오즈백 앱/서비스 은근한 노출 배너 (콘텐츠 사이·글 하단에 삽입)
export default function AppPromoBand({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <Link
        href="/apps"
        className="group flex items-center gap-3 rounded-2xl border border-oddsbag-purple/20 bg-oddsbag-purple/5 p-4 transition hover:bg-oddsbag-purple/10"
      >
        <span className="text-2xl">🎒</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-oddsbag-dark">
            이런 것도 필요할 때 — 오즈백 앱
          </p>
          <p className="truncate text-xs text-oddsbag-gray">
            사과문·수면·카페인 계산기까지, 이상하게 필요한 도구 모음
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold text-oddsbag-purple">
          보기 →
        </span>
      </Link>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-oddsbag-purple to-oddsbag-purple-dark p-6 text-white sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="rounded-full bg-oddsbag-yellow px-2.5 py-0.5 text-xs font-black text-oddsbag-dark">
            ODDSBAG APP
          </span>
          <h2 className="mt-3 text-xl font-black sm:text-2xl">
            이상하게 필요한 것들, 앱으로도 챙기세요
          </h2>
          <p className="mt-1.5 text-sm text-white/75">
            사과문 생성기, 수면 사이클 역산기, 카페인 계산기… 한번쯤 딱 필요한 도구들.
          </p>
          <Link
            href="/apps"
            className="mt-4 inline-block rounded-xl bg-oddsbag-yellow px-5 py-2.5 text-sm font-black text-oddsbag-dark transition hover:brightness-95"
          >
            오즈백 앱 구경하기
          </Link>
        </div>
        <span className="hidden text-7xl opacity-80 sm:block" aria-hidden>
          🎒
        </span>
      </div>
    </section>
  );
}
