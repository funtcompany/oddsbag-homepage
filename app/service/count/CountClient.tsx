"use client";

import { useMemo, useState } from "react";
import { countText, limitState, 세는법, type 세는법Id } from "@/lib/textcount";

// 글자수 세기 — 자기소개서·지원서처럼 «몇 자 이내»가 정해진 글을 쓸 때.
//
//  ★한국에서 「글자수」는 세는 곳마다 뜻이 다르다(공백 포함 / 공백 제외 / 바이트).
//    하나만 보여 주면 누군가는 반드시 틀린 값을 믿고 낸다 → 한 화면에 다 놓는다.
//  ★글은 서버로 가지 않는다. 세는 규칙은 lib/textcount.ts 에 갈라 뒀다(서버 없이 시험 가능).

const 자주쓰는한도 = [500, 700, 1000, 1500, 2000];

export default function CountClient() {
  const [text, setText] = useState("");
  const [한도, set한도] = useState(0);
  const [기준, set기준] = useState<세는법Id>("withSpace");

  const c = useMemo(() => countText(text), [text]);
  const 지금값 = c[기준];
  const st = limitState(지금값, 한도);

  const 칸 = (label: string, value: number | string, hint?: string) => (
    <div className="rounded-xl border border-oddsbag-light-gray bg-white p-3.5">
      <p className="text-[12px] font-bold text-oddsbag-gray">{label}</p>
      <p className="mt-0.5 text-[22px] font-black leading-none text-oddsbag-dark">
        {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
      </p>
      {hint && <p className="mt-1 text-[11.5px] text-oddsbag-gray">{hint}</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <div className="text-4xl" aria-hidden>
          🔢
        </div>
        <h1
          className="mt-3 text-[26px] font-black text-oddsbag-dark sm:text-[32px]"
          style={{ letterSpacing: "-0.03em", wordBreak: "keep-all" }}
        >
          글자수 세기
        </h1>
        <p
          className="mt-3 text-[15px] leading-relaxed text-oddsbag-gray"
          style={{ wordBreak: "keep-all" }}
        >
          자기소개서·지원서처럼 <b className="text-oddsbag-dark">「몇 자 이내」</b>가 정해진 글을
          쓸 때. 세는 곳마다 기준이 달라서{" "}
          <b className="text-oddsbag-dark">공백 포함·공백 제외·바이트를 한 번에</b> 보여 드립니다.
        </p>
        <p className="mt-2 text-[13px] text-oddsbag-gray">
          🔒 쓰신 글은 <b>서버로 가지 않습니다.</b> 이 브라우저 안에서만 셉니다.
        </p>
      </div>

      {/* 한도 */}
      <section className="rounded-2xl border border-oddsbag-light-gray bg-white p-5">
        <h2 className="text-[15px] font-black text-oddsbag-dark">
          「몇 자 이내」가 정해져 있나요?
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {자주쓰는한도.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => set한도(한도 === v ? 0 : v)}
              className={`rounded-lg border px-2.5 py-1 text-[12.5px] font-bold transition ${
                한도 === v
                  ? "border-oddsbag-purple bg-oddsbag-purple/10 text-oddsbag-purple"
                  : "border-oddsbag-light-gray text-oddsbag-gray hover:border-oddsbag-purple"
              }`}
            >
              {v.toLocaleString("ko-KR")}자
            </button>
          ))}
          <input
            type="number"
            min={0}
            value={한도 || ""}
            onChange={(e) => set한도(Number(e.target.value) || 0)}
            placeholder="직접 입력"
            className="w-28 rounded-lg border border-oddsbag-light-gray px-2.5 py-1 text-[12.5px] outline-none focus:border-oddsbag-purple"
          />
        </div>

        <p className="mt-4 text-[13px] font-bold text-oddsbag-dark">무엇을 기준으로 셀까요</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {세는법.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => set기준(m.id)}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold transition ${
                기준 === m.id
                  ? "bg-oddsbag-purple text-white"
                  : "bg-oddsbag-light-gray text-oddsbag-gray hover:text-oddsbag-dark"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[12px] text-oddsbag-gray">
          {세는법.find((m) => m.id === 기준)?.hint}
          {" · "}
          <b className="text-oddsbag-dark">
            내시는 곳이 어느 기준인지 안내를 꼭 확인하십시오.
          </b>{" "}
          기준이 다르면 같은 글도 글자수가 달라집니다.
        </p>

        {한도 > 0 && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <p
                className={`text-[14px] font-black ${st.over ? "text-red-600" : "text-oddsbag-dark"}`}
              >
                {지금값.toLocaleString("ko-KR")} / {한도.toLocaleString("ko-KR")}
                {" · "}
                {st.over
                  ? `${Math.abs(st.left).toLocaleString("ko-KR")}자 넘었습니다`
                  : `${st.left.toLocaleString("ko-KR")}자 남았습니다`}
              </p>
              <p className="text-[12px] text-oddsbag-gray">{st.percent}%</p>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-oddsbag-light-gray">
              <div
                className={`h-full rounded-full transition-all ${
                  st.over ? "bg-red-500" : st.percent > 90 ? "bg-amber-500" : "bg-oddsbag-purple"
                }`}
                style={{ width: `${Math.min(100, st.percent)}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* 글 */}
      <section className="mt-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="여기에 글을 붙여 넣거나 바로 쓰세요."
          rows={14}
          className="w-full resize-y rounded-2xl border border-oddsbag-light-gray bg-white p-4 text-[15px] leading-[1.85] outline-none focus:border-oddsbag-purple"
          style={{ wordBreak: "keep-all" }}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setText("")}
            disabled={!text}
            className="rounded-lg border border-oddsbag-light-gray px-2.5 py-1.5 text-[12.5px] font-bold text-oddsbag-gray transition hover:border-oddsbag-purple hover:text-oddsbag-purple disabled:opacity-40"
          >
            지우기
          </button>
          <button
            type="button"
            onClick={() => {
              // 줄 끝 공백과 세 번 이상 연달아 나온 빈 줄을 정리한다
              setText(
                text
                  .split(/\r\n|\r|\n/)
                  .map((l) => l.replace(/[ \t]+$/g, ""))
                  .join("\n")
                  .replace(/\n{3,}/g, "\n\n")
                  .trim(),
              );
            }}
            disabled={!text}
            className="rounded-lg border border-oddsbag-light-gray px-2.5 py-1.5 text-[12.5px] font-bold text-oddsbag-gray transition hover:border-oddsbag-purple hover:text-oddsbag-purple disabled:opacity-40"
          >
            군더더기 공백 정리
          </button>
        </div>
      </section>

      {/* 숫자들 */}
      <section className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {칸("공백 포함", c.withSpace, "자기소개서가 대개 이것")}
        {칸("공백 제외", c.withoutSpace, "띄어쓰기·줄바꿈 뺀 것")}
        {칸("줄바꿈만 뺀 것", c.withSpaceNoNewline)}
        {칸("낱말", c.words)}
        {칸("줄", c.lines)}
        {칸("문단", c.paragraphs)}
        {칸("문장", c.sentences)}
        {칸("원고지", `${c.wonngoji200}장`, "200자 기준·올림")}
        {칸("바이트 (UTF-8)", c.bytesUtf8, "요즘 시스템")}
        {칸("바이트 (EUC-KR)", c.bytesEucKr, "옛 게시판·공공 서식")}
      </section>

      <p className="mt-4 text-[12.5px] leading-relaxed text-oddsbag-gray">
        ※ 이모지처럼 글자 하나가 여러 조각으로 이루어진 것도 <b>사람이 세는 대로 한 글자</b>로
        셉니다. 다만 <b>내시는 곳의 시스템은 다르게 셀 수 있습니다</b> — 한도에 아슬아슬하면
        여유를 두십시오.
      </p>
    </div>
  );
}
