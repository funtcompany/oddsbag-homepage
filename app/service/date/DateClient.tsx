"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addBusinessDays,
  addUnit,
  countBusinessDays,
  krAge,
  krLong,
  span,
  올바른날짜,
  기준설명,
  쉬는이유,
  holidayName,
  요일이름,
  dowOf,
  공휴일_범위,
  type 단위,
  type 쉬는기준,
} from "@/lib/dates";
import { 공휴일_확인일 } from "@/lib/holidays";

// 날짜 계산기 — 만 나이 · D-day · 며칠 뒤 · 영업일.
//
//  ★셈은 전부 lib/dates.ts 에 갈라 뒀다(서버 없이 시험 가능 · scripts/시험/날짜도구-시험.mjs).
//    화면은 넣고 빼고 보여 주기만 한다.
//  ★한국에서 「10일 이내」는 곳마다 뜻이 다르다 — «그날 포함»과 «다음 날부터»를 나란히 놓는다.
//    하나만 보여 주면 누군가는 반드시 마감을 놓친다.

type 칸 = "age" | "between" | "shift" | "biz";

const 탭: { id: 칸; label: string; emoji: string }[] = [
  { id: "age", label: "만 나이", emoji: "🎂" },
  { id: "between", label: "날짜 사이 · D-day", emoji: "📆" },
  { id: "shift", label: "며칠 뒤는 언제", emoji: "➡️" },
  { id: "biz", label: "영업일", emoji: "🏢" },
];

/** 오늘 (한국 시각). 브라우저가 어느 시간대에 있든 같은 값이 나오게 UTC+9 로 민다 */
const 오늘KST = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);

export default function DateClient() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<칸>("age");
  const [today, setToday] = useState("");

  useEffect(() => {
    const t = 오늘KST();
    setToday(t);
    setBirth("1990-01-01");
    setFrom(t);
    setTo(t);
    setBase(t);
    setBizFrom(t);
    setBizTo(t);
    setMounted(true);
  }, []);

  // ① 만 나이
  const [birth, setBirth] = useState("");
  // ② 날짜 사이
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // ③ 며칠 뒤
  const [base, setBase] = useState("");
  const [amount, setAmount] = useState(30);
  const [unit, setUnit] = useState<단위>("일");
  // ④ 영업일
  const [기준, set기준] = useState<쉬는기준>("관공서");
  const [bizMode, setBizMode] = useState<"뒤" | "사이">("뒤");
  const [bizFrom, setBizFrom] = useState("");
  const [bizTo, setBizTo] = useState("");
  const [bizN, setBizN] = useState(10);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="h-40 animate-pulse rounded-2xl bg-oddsbag-light-gray" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-7">
        <div className="text-4xl" aria-hidden>
          📅
        </div>
        <h1
          className="mt-3 text-[26px] font-black text-oddsbag-dark sm:text-[32px]"
          style={{ letterSpacing: "-0.03em", wordBreak: "keep-all" }}
        >
          날짜 계산기
        </h1>
        <p
          className="mt-3 text-[15px] leading-relaxed text-oddsbag-gray"
          style={{ wordBreak: "keep-all" }}
        >
          만 나이 · 디데이 · 며칠 뒤는 언제 ·{" "}
          <b className="text-oddsbag-dark">토·일·공휴일을 뺀 영업일</b>까지 한 곳에서 셉니다.
        </p>
        <p className="mt-2 text-[13px] text-oddsbag-gray">
          🔒 넣으신 날짜는 <b>서버로 가지 않습니다.</b> 이 브라우저 안에서만 셉니다.
        </p>
      </header>

      {/* 탭 */}
      <nav className="flex flex-wrap gap-2" aria-label="무엇을 계산할까요">
        {탭.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`rounded-full px-3.5 py-2 text-[13px] font-bold transition ${
              tab === t.id
                ? "bg-oddsbag-purple text-white"
                : "bg-oddsbag-light-gray text-oddsbag-gray hover:text-oddsbag-dark"
            }`}
          >
            <span aria-hidden>{t.emoji}</span> {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-4">
        {tab === "age" && <나이칸 birth={birth} setBirth={setBirth} today={today} />}
        {tab === "between" && (
          <사이칸 from={from} to={to} setFrom={setFrom} setTo={setTo} today={today} />
        )}
        {tab === "shift" && (
          <이동칸
            base={base}
            setBase={setBase}
            amount={amount}
            setAmount={setAmount}
            unit={unit}
            setUnit={setUnit}
            today={today}
          />
        )}
        {tab === "biz" && (
          <영업칸
            기준={기준}
            set기준={set기준}
            mode={bizMode}
            setMode={setBizMode}
            from={bizFrom}
            setFrom={setBizFrom}
            to={bizTo}
            setTo={setBizTo}
            n={bizN}
            setN={setBizN}
          />
        )}
      </div>

      <p className="mt-6 text-[12.5px] leading-relaxed text-oddsbag-gray">
        ※ 공휴일 표는 <b className="text-oddsbag-dark">{공휴일_범위.시작}년~{공휴일_범위.끝}년</b>
        치를 갖고 있습니다 (확인일 {공휴일_확인일}). <b>임시공휴일은 그때 가서 정해집니다</b> —
        이 표에 없는 날이 나중에 생길 수 있으니, 마감이 걸린 일이라면 해당 기관에 한 번 더
        확인하십시오.
      </p>
    </div>
  );
}

// ── 같이 쓰는 조각 ─────────────────────────────────────────────

function 날짜입력({
  label,
  value,
  onChange,
  today,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  today?: string;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-bold text-oddsbag-dark">{label}</span>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-oddsbag-light-gray bg-white px-3 py-2 text-[15px] outline-none focus:border-oddsbag-purple"
        />
        {today && (
          <button
            type="button"
            onClick={() => onChange(today)}
            className="shrink-0 rounded-lg border border-oddsbag-light-gray px-2.5 py-2 text-[12.5px] font-bold text-oddsbag-gray transition hover:border-oddsbag-purple hover:text-oddsbag-purple"
          >
            오늘
          </button>
        )}
      </div>
      {올바른날짜(value) && (
        <span className="mt-1 block text-[12px] text-oddsbag-gray">
          {krLong(value)}
          {holidayName(value) && (
            <b className="text-oddsbag-purple"> · {holidayName(value)}</b>
          )}
        </span>
      )}
    </label>
  );
}

const 상자 = "rounded-2xl border border-oddsbag-light-gray bg-white p-5";

function 큰답({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl bg-oddsbag-purple p-5 text-white">
      <p className="text-[24px] font-black leading-tight sm:text-[28px]" style={{ wordBreak: "keep-all" }}>
        {children}
      </p>
      {sub && <p className="mt-1.5 text-[13px] text-white/80">{sub}</p>}
    </div>
  );
}

function 작은칸({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-oddsbag-light-gray bg-white p-3.5">
      <p className="text-[12px] font-bold text-oddsbag-gray">{label}</p>
      <p className="mt-0.5 text-[20px] font-black leading-none text-oddsbag-dark">{value}</p>
      {hint && <p className="mt-1 text-[11.5px] text-oddsbag-gray">{hint}</p>}
    </div>
  );
}

const 안내 = (t: string) => (
  <p className="mt-4 rounded-xl bg-oddsbag-light-gray p-3.5 text-[13px] leading-relaxed text-oddsbag-dark">
    {t}
  </p>
);

const n = (v: number) => v.toLocaleString("ko-KR");

// ── ① 만 나이 ──────────────────────────────────────────────────

function 나이칸({
  birth,
  setBirth,
  today,
}: {
  birth: string;
  setBirth: (v: string) => void;
  today: string;
}) {
  const a = useMemo(() => krAge(birth, today), [birth, today]);

  return (
    <>
      <section className={상자}>
        <날짜입력 label="태어난 날" value={birth} onChange={setBirth} />
        <p className="mt-2 text-[12.5px] text-oddsbag-gray">오늘({krLong(today)}) 기준으로 셉니다.</p>
      </section>

      {!a ? (
        안내(
          올바른날짜(birth)
            ? "태어난 날이 오늘보다 뒤입니다. 다시 확인해 주십시오."
            : "태어난 날을 넣어 주십시오.",
        )
      ) : (
        <>
          <div className="mt-4">
            <큰답 sub={`다음 생일은 ${krLong(a.다음생일)} · ${a.다음생일까지 === 0 ? "오늘입니다 🎉" : `${n(a.다음생일까지)}일 남았습니다`}`}>
              만 {n(a.만)}세
            </큰답>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <작은칸 label="연 나이" value={`${n(a.연)}세`} hint="올해−태어난 해. 병역·청소년보호법" />
            <작은칸 label="세는 나이" value={`${n(a.세는)}세`} hint="옛 한국식. 공문서엔 안 씁니다" />
            <작은칸 label="개월 수" value={`${n(a.개월)}개월`} hint="영유아 검진이 이렇게 묻습니다" />
            <작은칸 label="살아온 날" value={`${n(a.살아온일수)}일`} hint="태어난 날이 1일째" />
          </div>

          {안내(
            "2023년 6월 28일 「만 나이 통일법」부터 법령·계약·공문서의 나이는 모두 만 나이입니다. 나이를 따로 적지 않은 곳이라면 만 나이로 보시면 됩니다.",
          )}

          {a.윤달생일주의 &&
            안내(
              "2월 29일에 태어나셨습니다. 평년에는 생일이 없어서, 법제처 해석대로 2월 28일이 지나면 한 살 더 먹는 것으로 셌습니다. 다만 곳에 따라 3월 1일로 보기도 하니, 하루가 중요한 일이라면 그곳에 확인하십시오.",
            )}
        </>
      )}
    </>
  );
}

// ── ② 날짜 사이 · D-day ────────────────────────────────────────

function 사이칸({
  from,
  to,
  setFrom,
  setTo,
  today,
}: {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  today: string;
}) {
  const s = useMemo(() => span(from, to), [from, to]);
  const 빠른 = [
    { label: "100일째", days: 99 },
    { label: "200일째", days: 199 },
    { label: "1000일째", days: 999 },
  ];

  return (
    <>
      <section className={상자}>
        <div className="grid gap-3 sm:grid-cols-2">
          <날짜입력 label="시작한 날 (기준)" value={from} onChange={setFrom} today={today} />
          <날짜입력 label="세어 볼 날" value={to} onChange={setTo} today={today} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] font-bold text-oddsbag-gray">시작한 날부터</span>
          {빠른.map((q) => (
            <button
              key={q.label}
              type="button"
              disabled={!올바른날짜(from)}
              onClick={() => setTo(addUnit(from, q.days, "일") ?? to)}
              className="rounded-lg border border-oddsbag-light-gray px-2.5 py-1 text-[12.5px] font-bold text-oddsbag-gray transition hover:border-oddsbag-purple hover:text-oddsbag-purple disabled:opacity-40"
            >
              {q.label}
            </button>
          ))}
        </div>
      </section>

      {!s
        ? 안내("두 날짜를 모두 넣어 주십시오.")
        : (
          <>
            <div className="mt-4">
              <큰답 sub={`${krLong(from)} → ${krLong(to)}`}>
                {s.일수 === 0
                  ? "오늘이 그날입니다 (D-day)"
                  : s.일수 > 0
                    ? `${s.dday} · ${n(s.일수)}일 남았습니다`
                    : `${s.dday} · ${n(Math.abs(s.일수))}일 지났습니다`}
              </큰답>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <작은칸 label="며칠째" value={`${n(s.포함일수)}일째`} hint="시작한 날이 1일째" />
              <작은칸 label="며칠 차이" value={`${n(Math.abs(s.일수))}일`} hint="시작한 날은 안 셉니다" />
              <작은칸 label="주로 보면" value={`${n(s.주)}주 ${s.나머지일}일`} />
              <작은칸 label="사람 말로" value={`${s.년}년 ${s.월}개월 ${s.일}일`} />
            </div>

            {안내(
              "「100일」처럼 날을 세는 말은 대개 «시작한 날을 1일째»로 셉니다. 반대로 「○일 이내」 같은 기한은 대개 «시작한 날은 빼고» 셉니다. 두 값을 나란히 놓았으니 어느 쪽이 필요한지 보고 쓰십시오.",
            )}
          </>
        )}
    </>
  );
}

// ── ③ 며칠 뒤는 언제 ──────────────────────────────────────────

function 이동칸({
  base,
  setBase,
  amount,
  setAmount,
  unit,
  setUnit,
  today,
}: {
  base: string;
  setBase: (v: string) => void;
  amount: number;
  setAmount: (v: number) => void;
  unit: 단위;
  setUnit: (v: 단위) => void;
  today: string;
}) {
  const 뒤 = useMemo(() => addUnit(base, amount, unit), [base, amount, unit]);
  const 전 = useMemo(() => addUnit(base, -amount, unit), [base, amount, unit]);
  const 단위들: 단위[] = ["일", "주", "개월", "년"];

  return (
    <>
      <section className={상자}>
        <날짜입력 label="기준 날짜" value={base} onChange={setBase} today={today} />
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="text-[13px] font-bold text-oddsbag-dark">얼마나</span>
            <input
              type="number"
              value={amount}
              min={0}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
              className="mt-1.5 block w-28 rounded-lg border border-oddsbag-light-gray px-3 py-2 text-[15px] outline-none focus:border-oddsbag-purple"
            />
          </label>
          <div className="flex gap-1.5 pb-1">
            {단위들.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={`rounded-lg px-3 py-2 text-[13px] font-bold transition ${
                  unit === u
                    ? "bg-oddsbag-purple text-white"
                    : "bg-oddsbag-light-gray text-oddsbag-gray hover:text-oddsbag-dark"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </section>

      {!뒤 || !전
        ? 안내("기준 날짜를 넣어 주십시오.")
        : (
          <>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <큰답 sub={`${n(amount)}${unit} 뒤`}>{krLong(뒤)}</큰답>
              <div className="rounded-2xl border border-oddsbag-light-gray bg-white p-5">
                <p className="text-[20px] font-black leading-tight text-oddsbag-dark" style={{ wordBreak: "keep-all" }}>
                  {krLong(전)}
                </p>
                <p className="mt-1.5 text-[13px] text-oddsbag-gray">{n(amount)}{unit} 전</p>
              </div>
            </div>

            {(unit === "개월" || unit === "년") &&
              안내(
                "달을 더할 때 그 달에 없는 날이 되면 «그 달의 마지막 날»로 당깁니다. 1월 31일에서 한 달 뒤는 3월 3일이 아니라 2월 28일입니다.",
              )}
          </>
        )}
    </>
  );
}

// ── ④ 영업일 ──────────────────────────────────────────────────

function 영업칸({
  기준,
  set기준,
  mode,
  setMode,
  from,
  setFrom,
  to,
  setTo,
  n: cnt,
  setN,
}: {
  기준: 쉬는기준;
  set기준: (v: 쉬는기준) => void;
  mode: "뒤" | "사이";
  setMode: (v: "뒤" | "사이") => void;
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
  n: number;
  setN: (v: number) => void;
}) {
  const 뒤 = useMemo(
    () => (mode === "뒤" ? addBusinessDays(from, cnt, 기준) : null),
    [mode, from, cnt, 기준],
  );
  const 사이 = useMemo(
    () => (mode === "사이" ? countBusinessDays(from, to, 기준) : null),
    [mode, from, to, 기준],
  );
  const r = 뒤 ?? 사이;

  return (
    <>
      <section className={상자}>
        <p className="text-[13px] font-bold text-oddsbag-dark">어디 기준으로 쉬나요</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(기준설명) as 쉬는기준[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => set기준(k)}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold transition ${
                기준 === k
                  ? "bg-oddsbag-purple text-white"
                  : "bg-oddsbag-light-gray text-oddsbag-gray hover:text-oddsbag-dark"
              }`}
            >
              {기준설명[k].label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[12px] text-oddsbag-gray">{기준설명[기준].hint}</p>

        <div className="mt-4 flex gap-1.5">
          {(["뒤", "사이"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-2 text-[13px] font-bold transition ${
                mode === m
                  ? "bg-oddsbag-dark text-white"
                  : "bg-oddsbag-light-gray text-oddsbag-gray hover:text-oddsbag-dark"
              }`}
            >
              {m === "뒤" ? "○영업일 뒤는 언제" : "두 날짜 사이 영업일"}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <날짜입력 label={mode === "뒤" ? "기준 날짜" : "시작한 날"} value={from} onChange={setFrom} />
          {mode === "뒤" ? (
            <label className="block">
              <span className="text-[13px] font-bold text-oddsbag-dark">몇 영업일</span>
              <input
                type="number"
                value={cnt}
                min={0}
                max={2000}
                onChange={(e) => setN(Math.min(2000, Math.max(0, Number(e.target.value) || 0)))}
                className="mt-1.5 block w-full rounded-lg border border-oddsbag-light-gray px-3 py-2 text-[15px] outline-none focus:border-oddsbag-purple"
              />
            </label>
          ) : (
            <날짜입력 label="끝나는 날" value={to} onChange={setTo} />
          )}
        </div>
      </section>

      {!r
        ? 안내("날짜를 넣어 주십시오.")
        : (
          <>
            <div className="mt-4">
              {뒤 && (
                <큰답 sub={`${krLong(from)} 부터 ${n(cnt)}영업일 뒤 · 기준일 다음 날부터 셌습니다`}>
                  {krLong(뒤.값)}
                </큰답>
              )}
              {사이 && (
                <큰답 sub={`${krLong(from)} → ${krLong(to)} · 달력으로는 ${n(사이.값.달력일수)}일`}>
                  일하는 날 {n(사이.값.그날포함)}일
                </큰답>
              )}
            </div>

            {사이 && (
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <작은칸 label="시작일 포함" value={`${n(사이.값.그날포함)}일`} hint="「그날부터 ○일」" />
                <작은칸 label="다음 날부터" value={`${n(사이.값.다음날부터)}일`} hint="관공서 처리기간 셈법" />
                <작은칸 label="쉬는 날" value={`${n(사이.값.쉰날수)}일`} />
                <작은칸 label="달력 일수" value={`${n(사이.값.달력일수)}일`} />
              </div>
            )}

            {r.표밖 &&
              안내(
                `${공휴일_범위.시작}년~${공휴일_범위.끝}년 밖으로 나갔습니다. 그 밖의 해는 공휴일 표가 없어서 «공휴일이 없는 것처럼» 셈했습니다 — 이 값은 믿지 마십시오.`,
              )}

            {r.쉰날.length > 0 && (
              <section className="mt-3 rounded-2xl border border-oddsbag-light-gray bg-white p-5">
                <h2 className="text-[14px] font-black text-oddsbag-dark">
                  빼고 센 날 {n(r.쉰날.length)}일
                </h2>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {r.쉰날.slice(0, 60).map((d) => (
                    <li key={d.date} className="text-[12.5px] text-oddsbag-gray">
                      {d.date.slice(5).replace("-", "/")}({요일이름[dowOf(d.date)]}){" "}
                      <b className={d.이유 === "토요일" || d.이유 === "일요일" ? "" : "text-oddsbag-purple"}>
                        {d.이유}
                      </b>
                    </li>
                  ))}
                </ul>
                {r.쉰날.length > 60 && (
                  <p className="mt-2 text-[12px] text-oddsbag-gray">
                    …그 밖 {n(r.쉰날.length - 60)}일은 줄였습니다.
                  </p>
                )}
              </section>
            )}

            {안내(
              "「10일 이내」가 달력으로 열흘인지, 토·일·공휴일을 뺀 열흘인지는 안내문에 적혀 있습니다. 자동차 재검사(부적합 판정 뒤 10일)처럼 «빼고 세는» 곳이 있으니 꼭 확인하십시오.",
            )}
          </>
        )}
    </>
  );
}
