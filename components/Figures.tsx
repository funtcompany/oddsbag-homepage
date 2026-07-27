import type { ReactNode } from "react";

// 본문 안에 들어가는 '도식' 블록들.
//
// 【왜 이미지가 아니라 HTML인가】
//  · 글자가 진짜 글자로 남는다 → 검색엔진이 읽고, 복사도 되고, 확대해도 안 깨진다
//    (이미지 안의 글자는 구글이 못 읽는다. 광고 심사에서도 손해다)
//  · 만드는 비용이 0이고, 본문 텍스트를 그대로 그리므로 없는 내용이 들어갈 수 없다
//  · 화면 폭에 맞춰 알아서 접힌다
//
// 본문에는 이렇게 적혀 있으면 도식이 된다:
//   [키] Command + Control + Q
//   [경로] Apple 메뉴 > 시스템 설정 > 잠금 화면
//   [핵심] 자리 비울 땐 화면부터 잠그자

// ---- 단축키 키캡 ----
export function KeycapFigure({ keys }: { keys: string[] }) {
  return (
    <figure className="my-7">
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-oddsbag-light-gray bg-gradient-to-b from-white to-oddsbag-light-gray/60 px-4 py-7">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && (
              <span className="text-lg font-black text-oddsbag-gray">+</span>
            )}
            <kbd className="inline-flex min-w-[54px] items-center justify-center rounded-xl border border-b-[3px] border-oddsbag-dark/15 bg-white px-3.5 py-2.5 text-[17px] font-black text-oddsbag-dark shadow-sm">
              {k}
            </kbd>
          </span>
        ))}
      </div>
    </figure>
  );
}

// ---- 메뉴 경로 ----
export function PathFigure({ steps }: { steps: string[] }) {
  return (
    <figure className="my-7">
      <div className="rounded-2xl border border-oddsbag-light-gray bg-oddsbag-light-gray/40 px-4 py-5">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2.5">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 text-oddsbag-purple/50"
                  fill="none"
                >
                  <path
                    d="M9 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              <span
                className={`rounded-lg px-3 py-1.5 text-[15px] font-bold ${
                  i === steps.length - 1
                    ? "bg-oddsbag-purple text-white"
                    : "bg-white text-oddsbag-dark"
                }`}
                style={{ wordBreak: "keep-all" }}
              >
                {s}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
}

// ---- 핵심 한 줄 (본문 중간에서 시선을 잡아주는 블록) ----
export function KeyPointFigure({ children }: { children: ReactNode }) {
  return (
    <figure className="my-8 flex gap-4 border-l-4 border-oddsbag-yellow bg-oddsbag-light-gray/40 px-5 py-5">
      <span aria-hidden="true" className="text-2xl leading-none">
        💡
      </span>
      <p
        className="text-[17px] font-extrabold leading-relaxed text-oddsbag-dark"
        style={{ wordBreak: "keep-all" }}
      >
        {children}
      </p>
    </figure>
  );
}

// ---- 주의 ----
export function WarnFigure({ children }: { children: ReactNode }) {
  return (
    <figure className="my-8 flex gap-4 rounded-2xl border border-[#f0d9a8] bg-[#fff9ec] px-5 py-5">
      <span aria-hidden="true" className="text-2xl leading-none">
        ⚠️
      </span>
      <p
        className="text-[16px] font-bold leading-relaxed text-[#7a5a12]"
        style={{ wordBreak: "keep-all" }}
      >
        {children}
      </p>
    </figure>
  );
}
