// V2 Coming Soon 티저 배너 (브랜드 기획서의 앱/웹 버전 소개 UX 구조 반영)

const teasers = [
  { emoji: "💌", label: "전 애인에게 보내는 편지" },
  { emoji: "🥗", label: "냉장고 재료 → 오늘 메뉴" },
  { emoji: "🎲", label: "랜덤 국내 여행지 룰렛" },
  { emoji: "🔥", label: "번아웃 지수 측정기" },
];

export default function VersionBanner() {
  return (
    <section className="rounded-3xl bg-gradient-to-br from-oddsbag-purple to-oddsbag-purple-dark p-6 text-white sm:p-8">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-oddsbag-yellow px-2.5 py-0.5 text-xs font-black text-oddsbag-dark">
          V2 COMING SOON
        </span>
        <span className="text-sm font-medium text-white/70">이것도 있어?</span>
      </div>
      <h2 className="mt-3 text-xl font-black sm:text-2xl">
        곧, 더 이상한 것들이 도착합니다
      </h2>
      <p className="mt-1.5 text-sm text-white/70">
        미리 보는 다음 버전 기능들 — 출시되면 가장 먼저 알려드릴게요
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {teasers.map((t) => (
          <div
            key={t.label}
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-center"
          >
            <div className="text-2xl">{t.emoji}</div>
            <div className="mt-1 text-xs font-medium leading-tight text-white/90">
              {t.label}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="mt-5 w-full rounded-xl bg-oddsbag-yellow px-4 py-3 text-sm font-black text-oddsbag-dark transition hover:brightness-95 sm:w-auto sm:px-6"
      >
        🔔 출시 알림 받기
      </button>
    </section>
  );
}
