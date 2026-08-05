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
//   [즉답] [버전] [단계] [확인] [Q]/[A] [대안]  ← 가이드(꿀팁) 전용 6종
//
// ※ 표시 목록의 기준은 lib/guide.ts 한 곳이다. 늘릴 땐 그 파일 머리말을 먼저 읽을 것.

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

// ════════════════════════════════════════════════════════════════
//  가이드(꿀팁) 전용 도식 6종
//  검색으로 들어온 사람은 글을 안 읽고 '답만' 찾아 나간다.
//  그래서 답·순서·확인목록을 눈에 먼저 걸리게 세운다.
// ════════════════════════════════════════════════════════════════

// ---- ① 즉답 [즉답] : 스크롤 없이 첫 화면에서 답을 끝낸다 ----
export function AnswerFigure({ children }: { children: ReactNode }) {
  return (
    <figure className="my-7 rounded-2xl border-2 border-oddsbag-purple/30 bg-white px-5 py-5">
      <span className="inline-block rounded-full bg-oddsbag-yellow px-3 py-1 text-[12px] font-black tracking-[0.1em] text-oddsbag-dark">
        바로 답
      </span>
      <p
        className="mt-3 text-[19px] font-extrabold leading-relaxed text-oddsbag-dark"
        style={{ wordBreak: "keep-all" }}
      >
        {children}
      </p>
    </figure>
  );
}

// ---- ② 기준 버전·확인일 [버전] : "이거 옛날 얘기 아냐?"를 없앤다 ----
export function VersionFigure({ children }: { children: ReactNode }) {
  return (
    <figure className="-mt-3 mb-7">
      <span className="inline-flex flex-wrap items-center gap-1.5 rounded-full bg-oddsbag-light-gray px-3.5 py-1.5 text-[13px] font-bold leading-relaxed text-oddsbag-gray">
        <span aria-hidden="true">🗓</span>
        <span style={{ wordBreak: "keep-all" }}>{children}</span>
      </span>
    </figure>
  );
}

// ---- ③ 따라하기 번호 스텝 [단계] : 폰에서 어디까지 했는지 안 놓치게 ----
export function StepsFigure({ steps }: { steps: ReactNode[] }) {
  return (
    <figure className="my-8">
      <ol className="flex flex-col">
        {steps.map((s, i) => (
          <li key={i} className="relative flex gap-3.5 pb-5 last:pb-0">
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-[17px] top-9 w-0.5 bg-oddsbag-purple/20"
              />
            )}
            <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-oddsbag-purple text-[16px] font-black text-white">
              {i + 1}
            </span>
            <p
              className="pt-1 text-[17.5px] font-semibold leading-relaxed text-oddsbag-dark"
              style={{ wordBreak: "keep-all" }}
            >
              {s}
            </p>
          </li>
        ))}
      </ol>
    </figure>
  );
}

// ---- ④ 체크리스트 [확인] : "안 될 때 뭐부터 보나"를 순서로 ----
//  자바스크립트 없이 브라우저 기본 체크박스만 쓴다 (서버에서 그린 그대로 눌린다)
export function ChecklistFigure({ items }: { items: ReactNode[] }) {
  return (
    <figure className="my-8 rounded-2xl border border-oddsbag-light-gray bg-white px-4 py-4">
      <p className="mb-2 px-1 text-[12px] font-black tracking-[0.12em] text-oddsbag-purple">
        하나씩 확인해 보세요
      </p>
      <ul className="flex flex-col gap-0.5">
        {items.map((it, i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-2 transition hover:bg-oddsbag-light-gray/60">
              <input
                type="checkbox"
                className="mt-1 h-[18px] w-[18px] shrink-0 accent-[#5b2d8e]"
              />
              <span
                className="text-[17px] leading-relaxed text-oddsbag-dark/90"
                style={{ wordBreak: "keep-all" }}
              >
                {it}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </figure>
  );
}

// ---- ⑤ 접었다 펴는 FAQ [Q]/[A] ----
//  <details> 태그라 자바스크립트가 0줄이고, 구글 FAQ 표시(FAQPage)와 짝이 맞는다.
export function FaqFigure({
  items,
}: {
  items: { q: ReactNode; a: ReactNode }[];
}) {
  return (
    <figure className="my-8 flex flex-col gap-2.5">
      {items.map((it, i) => (
        <details
          key={i}
          className="group rounded-2xl border border-oddsbag-light-gray bg-oddsbag-light-gray/30 px-4 py-3.5 open:border-oddsbag-purple/25 open:bg-white"
        >
          <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-oddsbag-purple text-[13px] font-black text-white"
            >
              Q
            </span>
            <span
              className="flex-1 text-[17px] font-extrabold leading-relaxed text-oddsbag-dark"
              style={{ wordBreak: "keep-all" }}
            >
              {it.q}
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="mt-1.5 h-4 w-4 shrink-0 text-oddsbag-purple/60 transition-transform group-open:rotate-180"
            >
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </summary>
          <div className="mt-3 flex gap-3 border-t border-oddsbag-light-gray pt-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-oddsbag-yellow text-[13px] font-black text-oddsbag-dark"
            >
              A
            </span>
            <p
              className="flex-1 text-[16.5px] leading-relaxed text-oddsbag-dark/85"
              style={{ wordBreak: "keep-all" }}
            >
              {it.a}
            </p>
          </div>
        </details>
      ))}
    </figure>
  );
}

// ---- ⑥ 대안 [대안] : "안 되면 이걸로"가 있어야 신뢰가 생긴다 ----
export function AltFigure({ children }: { children: ReactNode }) {
  return (
    <figure className="my-8 flex gap-4 rounded-2xl bg-oddsbag-purple/[0.07] px-5 py-5">
      <span aria-hidden="true" className="text-2xl leading-none">
        🔁
      </span>
      <div>
        <p className="text-[12px] font-black tracking-[0.1em] text-oddsbag-purple">
          이 방법이 안 될 때
        </p>
        <p
          className="mt-1.5 text-[16.5px] font-bold leading-relaxed text-oddsbag-dark/90"
          style={{ wordBreak: "keep-all" }}
        >
          {children}
        </p>
      </div>
    </figure>
  );
}
