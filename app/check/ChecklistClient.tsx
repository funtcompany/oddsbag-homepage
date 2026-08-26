"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  matchCards,
  notesFor,
  usableHaveIds,
  isValidBirthYear,
  yearAge,
  한글날짜,
  daysSince,
  지난말,
  ymdKST,
  daysLeftInYear,
  thisYearKST,
  yearEndCards,
  type CheckCard,
  type HaveOption,
} from "@/lib/checklist";

// 「챙길 것」 — 올해 챙겨야 할 것을 한 화면에.
//
// ★서버로 아무것도 안 보낸다. 태어난 해도 「가진 것」도 이 브라우저 밖으로 안 나간다.
//   (그래서 fetch 가 한 줄도 없다. 그게 이 도구의 광고 문구이기도 하다)
// ★판정하지 않는다. 「대상입니다」가 아니라 「확인하십시오 + 공식 조회 링크」다.

// ★이 일을 하다가 «실제로 막히는 지점»에 우리 도구가 있으면 이어 준다.
//   광고가 아니라 «다음 걸음»이다 — 여권·면허는 사진에서 반려돼 하루를 버리는 일이 흔하다.
//   근거 없는 연결은 하지 않는다. 여기 없는 항목에는 아무것도 안 붙는다.
const 이어줄도구: Record<string, { href: string; label: string; why: string }> = {
  "passport-reissue": {
    href: "/service/idphoto",
    label: "증명사진 만들기",
    why: "여권사진은 반려가 잦습니다. 갖고 계신 사진을 3.5×4.5cm 규격으로 잘라 보실 수 있습니다",
  },
  "driver-license-renewal": {
    href: "/service/idphoto",
    label: "증명사진 만들기",
    why: "6개월 이내 촬영한 컬러사진이 필요합니다. 규격 크기로 잘라 인화용까지 만들어 드립니다",
  },
};

const 확인기록_키 = "oddsbag.check.done.v1";
const 답변_키 = "oddsbag.check.answers.v1";

type 확인기록 = Record<string, string>; // 케이스북 id → 확인한 날(YYYY-MM-DD)

function 안전하게읽기<T>(key: string, 기본: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : 기본;
  } catch {
    return 기본; // 사생활 보호 창·저장 차단 브라우저에서는 그냥 기억을 안 한다
  }
}

function 안전하게쓰기(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* 못 저장해도 도구는 그대로 돌아간다 */
  }
}

export default function ChecklistClient({
  cards,
  haveOptions,
  today,
}: {
  cards: CheckCard[];
  haveOptions: HaveOption[];
  today: string;
}) {
  const 올해 = Number(today.slice(0, 4));

  const [birthYear, setBirthYear] = useState("");
  const [have, setHave] = useState<string[]>([]);
  const [보여줄까, set보여줄까] = useState(false);
  const [기록, set기록] = useState<확인기록>({});
  const [펼친것, set펼친것] = useState<string | null>(null);

  // 지난번에 고른 것 되살리기 — 내년에 또 와야 하는 도구라 이게 있어야 한다
  useEffect(() => {
    setHave(안전하게읽기<string[]>(답변_키 + ".have", []));
    const y = 안전하게읽기<string>(답변_키 + ".year", "");
    if (y) setBirthYear(y);
    set기록(안전하게읽기<확인기록>(확인기록_키, {}));
  }, []);

  // 어느 카드도 안 쓰는 선택지는 아예 안 보여준다 (눌러도 아무것도 안 나오는 칸 방지)
  const 쓰이는것 = useMemo(() => usableHaveIds(cards), [cards]);
  const 고를것 = useMemo(
    () => haveOptions.filter((h) => 쓰이는것.has(h.id)),
    [haveOptions, 쓰이는것],
  );

  const 해 = Number(birthYear);
  const 해가유효 = birthYear !== "" && isValidBirthYear(해, 올해);
  const 해입력오류 = birthYear !== "" && !해가유효;

  const 결과 = useMemo(
    () => matchCards(cards, { birthYear: 해가유효 ? 해 : null, have }, 올해),
    [cards, 해, 해가유효, have, 올해],
  );

  // ★「올해 안에」 — 해가 바뀌면 다시 시작하는 것만. 개인별 만료일은 여기 안 들어간다.
  //   남은 날은 «저장하지 않고» 화면을 그릴 때마다 오늘 날짜로 다시 센다.
  const 올해안에 = yearEndCards(결과);
  const 올해안에_id = new Set(올해안에.map((c) => c.id));
  const 남은날 = daysLeftInYear(today);
  const 올해숫자 = thisYearKST(today);

  const 나머지결과 = 결과.filter((c) => !올해안에_id.has(c.id));
  const 기한있는것 = 나머지결과.filter((c) => c.deadlineKind !== "없음");
  const 나머지 = 나머지결과.filter((c) => c.deadlineKind === "없음");

  function 토글(id: string) {
    setHave((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      안전하게쓰기(답변_키 + ".have", next);
      return next;
    });
  }

  function 해바꾸기(v: string) {
    const 숫자만 = v.replace(/[^0-9]/g, "").slice(0, 4);
    setBirthYear(숫자만);
    안전하게쓰기(답변_키 + ".year", 숫자만);
  }

  function 확인함(id: string) {
    set기록((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = ymdKST();
      안전하게쓰기(확인기록_키, next);
      return next;
    });
  }

  function 다지우기() {
    setBirthYear("");
    setHave([]);
    set기록({});
    set보여줄까(false);
    try {
      localStorage.removeItem(확인기록_키);
      localStorage.removeItem(답변_키 + ".have");
      localStorage.removeItem(답변_키 + ".year");
    } catch {
      /* 지울 게 없으면 그만이다 */
    }
  }

  const 목록텍스트 = useMemo(
    () =>
      [
        `오즈백 「챙길 것」 — ${한글날짜(today)} 기준`,
        "",
        ...결과.flatMap((c) => [
          `[ ] ${c.situation}`,
          c.firstMove ? `      먼저 할 것 — ${c.firstMove.what}` : "",
          ...c.checks.filter((v) => v.url).map((v) => `      ${v.label} → ${v.url}`),
          `      오즈백 확인일 ${c.verifiedAt}`,
          "",
        ]),
        "※ 오즈백은 대상 여부를 판정하지 않습니다. 위 링크에서 본인 것을 확인하십시오.",
      ]
        .filter((l) => l !== "")
        .join("\n"),
    [결과, today],
  );

  const [복사됨, set복사됨] = useState(false);
  async function 복사() {
    try {
      await navigator.clipboard.writeText(목록텍스트);
      set복사됨(true);
      setTimeout(() => set복사됨(false), 1800);
    } catch {
      /* 클립보드를 막아 둔 브라우저면 조용히 넘어간다 */
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* ── 머리말 ─────────────────────────────────── */}
      <div className="mb-8">
        <div className="text-4xl" aria-hidden>
          📋
        </div>
        <h1
          className="mt-3 text-[26px] font-black text-oddsbag-dark sm:text-[32px]"
          style={{ letterSpacing: "-0.03em", wordBreak: "keep-all" }}
        >
          챙길 것
        </h1>
        <p
          className="mt-3 text-[15px] leading-relaxed text-oddsbag-gray"
          style={{ wordBreak: "keep-all" }}
        >
          가진 것 몇 개만 고르면 <b className="text-oddsbag-dark">올해 챙길 것</b>을 한
          화면에 모아 드립니다. 기관마다 흩어져 있는 것을 한 번에 봅니다.
        </p>
        <p className="mt-2 text-[13px] text-oddsbag-gray" style={{ wordBreak: "keep-all" }}>
          🔒 <b>아무것도 서버로 보내지 않습니다.</b> 태어난 해도 고른 것도 이 브라우저 안에만
          있습니다. 로그인·본인인증도 없습니다.
        </p>
        <p
          className="mt-3 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-900"
          style={{ wordBreak: "keep-all" }}
        >
          ⚠ <b>오즈백은 「대상입니다」라고 말하지 않습니다.</b> 대상 여부·금액·수수료는 기관만
          정확히 압니다. 오즈백은 <b>무엇을 어디서 확인하는지</b>와 <b>그 안내를 언제 확인했는지</b>
          만 알려 드립니다.
        </p>
      </div>

      {/* ── ① 고르기 ────────────────────────────────── */}
      <section className="rounded-2xl border border-oddsbag-light-gray bg-white p-5">
        <h2 className="text-[15px] font-black text-oddsbag-dark">① 해당되는 것을 고르세요</h2>
        <p className="mt-1 text-[12.5px] text-oddsbag-gray">
          아무것도 안 골라도 됩니다. 누구에게나 해당되는 것은 그냥 나옵니다.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {고를것.map((h) => {
            const 켜짐 = have.includes(h.id);
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => 토글(h.id)}
                aria-pressed={켜짐}
                className={`rounded-xl border-2 px-3.5 py-2.5 text-[13.5px] font-bold transition ${
                  켜짐
                    ? "border-oddsbag-purple bg-oddsbag-purple text-white"
                    : "border-oddsbag-light-gray bg-white text-oddsbag-dark hover:border-oddsbag-purple"
                }`}
                style={{ wordBreak: "keep-all" }}
              >
                <span aria-hidden>{h.emoji}</span> {h.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 border-t border-oddsbag-light-gray pt-4">
          <label
            htmlFor="birthYear"
            className="text-[13.5px] font-black text-oddsbag-dark"
          >
            태어난 해 <span className="font-medium text-oddsbag-gray">(안 넣어도 됩니다)</span>
          </label>
          <p className="mt-1 text-[12.5px] text-oddsbag-gray" style={{ wordBreak: "keep-all" }}>
            나이에 따라 안내가 달라지는 것이 있어 <b>주의문을 더 정확히</b> 보여 드리는 데만
            씁니다.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              id="birthYear"
              inputMode="numeric"
              placeholder="예: 1985"
              value={birthYear}
              onChange={(e) => 해바꾸기(e.target.value)}
              className={`w-32 rounded-xl border-2 px-3.5 py-2.5 text-[14px] font-bold outline-none transition ${
                해입력오류
                  ? "border-red-300 text-red-700"
                  : "border-oddsbag-light-gray text-oddsbag-dark focus:border-oddsbag-purple"
              }`}
            />
            {해가유효 && (
              <span className="text-[12.5px] text-oddsbag-gray">
                올해 {yearAge(해, 올해)}세 (태어난 해 기준)
              </span>
            )}
            {해입력오류 && (
              <span className="text-[12.5px] font-bold text-red-600">
                네 자리 연도로 넣어 주세요
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => set보여줄까(true)}
            className="rounded-xl bg-oddsbag-purple px-5 py-3 text-[14px] font-black text-white hover:brightness-110"
          >
            챙길 것 보기 ({결과.length})
          </button>
          {(have.length > 0 || birthYear !== "" || Object.keys(기록).length > 0) && (
            <button
              type="button"
              onClick={다지우기}
              className="rounded-xl border border-oddsbag-light-gray px-4 py-3 text-[13px] font-bold text-oddsbag-gray hover:text-oddsbag-dark"
            >
              고른 것·기록 모두 지우기
            </button>
          )}
        </div>
      </section>

      {/* ── ② 결과 ─────────────────────────────────── */}
      {보여줄까 && (
        <section className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-[18px] font-black text-oddsbag-dark">
              챙길 것 {결과.length}가지
            </h2>
            <button
              type="button"
              onClick={복사}
              className="rounded-lg bg-oddsbag-dark px-3.5 py-2 text-[12.5px] font-black text-white"
            >
              {복사됨 ? "복사했습니다" : "목록 복사"}
            </button>
          </div>

          {결과.length === 0 && (
            <p className="mt-4 rounded-xl border border-oddsbag-light-gray bg-white p-5 text-[14px] text-oddsbag-gray">
              고르신 조건에 해당하는 것이 아직 없습니다. 위에서 다른 것을 골라 보세요.
            </p>
          )}

          {올해안에.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-2xl border-2 border-oddsbag-purple/30">
              <div className="bg-gradient-to-r from-oddsbag-purple-dark to-oddsbag-purple px-4 py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-[15px] font-black text-white">
                    🗓 {올해숫자}년 안에 끝내야 하는 것
                  </h3>
                  <span className="rounded-full bg-oddsbag-yellow/25 px-2.5 py-1 text-[12px] font-black text-oddsbag-yellow">
                    {남은날 === 0 ? "오늘이 마지막 날" : `${올해숫자 + 1}년까지 ${남은날}일`}
                  </span>
                </div>
                <p
                  className="mt-1 text-[12.5px] leading-relaxed text-white/80"
                  style={{ wordBreak: "keep-all" }}
                >
                  해가 바뀌면 <b className="text-white">다시 처음부터</b> 시작하는 것들입니다. 올해
                  안 하시면 올해 몫은 그대로 넘어갑니다.
                </p>
              </div>
              <div className="space-y-3 bg-oddsbag-purple/5 p-3">
                {올해안에.map((c) => (
                  <div key={c.id}>
                    {c.yearBound && (
                      <p
                        className="mb-1.5 px-1 text-[12px] font-bold leading-relaxed text-oddsbag-purple"
                        style={{ wordBreak: "keep-all" }}
                      >
                        ⏳ {c.yearBound.text}
                      </p>
                    )}
                    <CheckCardView
                      card={c}
                      birthYear={해가유효 ? 해 : null}
                      thisYear={올해}
                      today={today}
                      checkedOn={기록[c.id] ?? null}
                      onCheck={() => 확인함(c.id)}
                      open={펼친것 === c.id}
                      onToggle={() => set펼친것(펼친것 === c.id ? null : c.id)}
                    />
                  </div>
                ))}
              </div>
              <p
                className="bg-white px-4 py-3 text-[12px] leading-relaxed text-oddsbag-gray"
                style={{ wordBreak: "keep-all" }}
              >
                ※ 여기 있는 것은 <b>제도가 해마다 새로 시작하는 일</b>뿐입니다. 면허 갱신일이나 차
                검사 만료일처럼 <b>사람마다 다른 날짜</b>는 「올해 안에」라고 말할 수 없어 아래에
                따로 두었습니다. 오즈백이 근거를 확인한 것만 올립니다.
              </p>
            </div>
          )}

          {기한있는것.length > 0 && (
            <>
              <h3 className="mt-6 text-[13px] font-black text-oddsbag-purple">
                기한이 있는 것 — 먼저 보세요
              </h3>
              <div className="mt-2 space-y-3">
                {기한있는것.map((c) => (
                  <CheckCardView
                    key={c.id}
                    card={c}
                    birthYear={해가유효 ? 해 : null}
                    thisYear={올해}
                    today={today}
                    checkedOn={기록[c.id] ?? null}
                    onCheck={() => 확인함(c.id)}
                    open={펼친것 === c.id}
                    onToggle={() => set펼친것(펼친것 === c.id ? null : c.id)}
                  />
                ))}
              </div>
            </>
          )}

          {나머지.length > 0 && (
            <>
              <h3 className="mt-7 text-[13px] font-black text-oddsbag-gray">
                기한은 없지만 알아 두면 되는 것
              </h3>
              <div className="mt-2 space-y-3">
                {나머지.map((c) => (
                  <CheckCardView
                    key={c.id}
                    card={c}
                    birthYear={해가유효 ? 해 : null}
                    thisYear={올해}
                    today={today}
                    checkedOn={기록[c.id] ?? null}
                    onCheck={() => 확인함(c.id)}
                    open={펼친것 === c.id}
                    onToggle={() => set펼친것(펼친것 === c.id ? null : c.id)}
                  />
                ))}
              </div>
            </>
          )}

          <p
            className="mt-8 rounded-xl bg-oddsbag-light-gray/50 px-4 py-3.5 text-[12.5px] leading-relaxed text-oddsbag-gray"
            style={{ wordBreak: "keep-all" }}
          >
            오즈백은 <b>안내 문서를 직접 읽고 확인한 날짜를 적어 둡니다.</b> 그리고 정해진 주기가
            되면 다시 읽습니다. 그래도 <b>기관의 최신 안내가 언제나 우선</b>입니다 — 위의 조회
            링크에서 본인 것을 확인하십시오.
          </p>
        </section>
      )}
    </div>
  );
}

// ── 카드 하나 ───────────────────────────────────────
// ★이름을 한글로 두지 않는다 — 이 레포에 한글 «JSX 컴포넌트» 전례가 없고,
//   외장하드라 next build 로 확인할 길이 없어 굳이 걸지 않는다.
//   (한글 «변수·함수» 이름은 이미 여러 파일에서 돌고 있어 그대로 쓴다)
function CheckCardView({
  card: c,
  birthYear,
  thisYear: 올해,
  today,
  checkedOn: 확인한날,
  onCheck: 확인함,
  open: 펼침,
  onToggle: 펼치기,
}: {
  card: CheckCard;
  birthYear: number | null;
  thisYear: number;
  today: string;
  checkedOn: string | null;
  onCheck: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  const 주의문 = notesFor(c, birthYear, 올해);
  const 지난날 = 확인한날 ? daysSince(확인한날, today) : null;

  return (
    <article
      className={`rounded-2xl border bg-white p-5 ${
        확인한날 ? "border-emerald-200 bg-emerald-50/30" : "border-oddsbag-light-gray"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none" aria-hidden>
          {c.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h4
            className="text-[16px] font-black leading-snug text-oddsbag-dark"
            style={{ wordBreak: "keep-all" }}
          >
            {c.situation}
          </h4>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {c.deadlineKind === "법정" && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-black text-red-700">
                법으로 정해진 기한
              </span>
            )}
            {c.deadlineKind === "안내" && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-800">
                기간 안내가 있음
              </span>
            )}
            <span className="rounded-full bg-oddsbag-light-gray px-2 py-0.5 text-[11px] font-bold text-oddsbag-gray">
              오즈백 확인일 {한글날짜(c.verifiedAt)}
            </span>
            {c.stale && (
              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-black text-orange-700">
                다시 볼 때가 지났습니다
              </span>
            )}
          </div>
        </div>
      </div>

      {c.oneLine && (
        <p
          className="mt-3 text-[13.5px] font-bold leading-relaxed text-oddsbag-dark"
          style={{ wordBreak: "keep-all" }}
        >
          {c.oneLine}
        </p>
      )}

      {c.deadlineText && (
        <p
          className="mt-2 text-[13px] leading-relaxed text-oddsbag-gray"
          style={{ wordBreak: "keep-all" }}
        >
          {c.deadlineText}
        </p>
      )}

      {주의문.map((n, i) => (
        <p
          key={i}
          className="mt-2.5 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-amber-900"
          style={{ wordBreak: "keep-all" }}
        >
          ⚠ {n.text}
        </p>
      ))}

      {c.firstMove && (
        <div className="mt-3 rounded-xl bg-oddsbag-light-gray/40 px-3.5 py-3">
          <p className="text-[11.5px] font-black text-oddsbag-purple">3분이면 되는 첫 걸음</p>
          <p
            className="mt-1 text-[13.5px] font-bold leading-snug text-oddsbag-dark"
            style={{ wordBreak: "keep-all" }}
          >
            {c.firstMove.what}
          </p>
          {c.firstMove.where && (
            <p className="mt-0.5 text-[12px] text-oddsbag-gray" style={{ wordBreak: "keep-all" }}>
              {c.firstMove.where}
            </p>
          )}
        </div>
      )}

      {이어줄도구[c.id] && (
        <a
          href={이어줄도구[c.id].href}
          className="mt-3 flex items-start gap-2.5 rounded-xl border border-oddsbag-purple/25 bg-oddsbag-purple/5 px-3.5 py-3 transition hover:border-oddsbag-purple hover:bg-oddsbag-purple/10"
        >
          <span className="text-lg leading-none" aria-hidden>
            🪪
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-black text-oddsbag-purple">
              {이어줄도구[c.id].label} →
            </span>
            <span
              className="mt-0.5 block text-[12px] leading-relaxed text-oddsbag-gray"
              style={{ wordBreak: "keep-all" }}
            >
              {이어줄도구[c.id].why}
            </span>
          </span>
        </a>
      )}

      {c.checks.length > 0 && (
        <div className="mt-3">
          <p className="text-[11.5px] font-black text-oddsbag-gray">
            내 것은 여기서 확인하세요 — 오즈백은 값을 갖고 있지 않습니다
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.checks.map((v, i) =>
              v.url ? (
                <a
                  key={i}
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="rounded-lg border border-oddsbag-purple/30 bg-oddsbag-purple/5 px-3 py-1.5 text-[12.5px] font-bold text-oddsbag-purple hover:bg-oddsbag-purple hover:text-white"
                  style={{ wordBreak: "keep-all" }}
                >
                  {v.label} →
                </a>
              ) : (
                <span
                  key={i}
                  className="rounded-lg bg-oddsbag-light-gray px-3 py-1.5 text-[12.5px] font-bold text-oddsbag-gray"
                >
                  {v.label}
                </span>
              ),
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-oddsbag-light-gray pt-3">
        <button
          type="button"
          onClick={확인함}
          className={`rounded-lg px-3 py-1.5 text-[12.5px] font-black ${
            확인한날
              ? "bg-emerald-600 text-white"
              : "border border-oddsbag-light-gray text-oddsbag-gray hover:text-oddsbag-dark"
          }`}
        >
          {확인한날 ? "✓ 확인했습니다" : "확인했으면 눌러 두세요"}
        </button>
        {확인한날 && 지난날 !== null && (
          <span className="text-[12px] text-oddsbag-gray">
            {지난말(지난날)}에 확인 · 이 기록도 이 브라우저에만 남습니다
          </span>
        )}
        {c.articleHref && (
          <Link
            href={c.articleHref}
            className="ml-auto text-[12.5px] font-black text-oddsbag-purple hover:underline"
          >
            자세히 읽기 →
          </Link>
        )}
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={펼치기}
          className="text-[12px] font-bold text-oddsbag-gray hover:text-oddsbag-dark"
        >
          {펼침 ? "근거 접기 ▲" : `오즈백이 읽은 근거 ${c.sources.length}건 보기 ▼`}
        </button>
        {펼침 && (
          <ul className="mt-2 space-y-2">
            {c.sources.map((s, i) => (
              <li key={i} className="text-[12px] leading-relaxed text-oddsbag-gray">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="font-bold text-oddsbag-dark hover:text-oddsbag-purple hover:underline"
                  style={{ wordBreak: "keep-all" }}
                >
                  {s.title}
                </a>
                <br />
                {s.publisher}
                {s.article ? ` · ${s.article}` : ""}
                {s.checkedAt ? ` · 읽은 날 ${s.checkedAt}` : ""}
              </li>
            ))}
            <li className="text-[12px] text-oddsbag-gray">
              다음 재확인 예정 — {한글날짜(c.nextCheckAt)}
            </li>
          </ul>
        )}
      </div>
    </article>
  );
}
