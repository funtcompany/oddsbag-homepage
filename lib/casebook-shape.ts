// 케이스북 원본(JSON) → 도구 카드로 바꾸는 규칙. 순수 함수만.
//
// ★fs·next·react 를 하나도 안 부른다. 그래서 서버 없이 그대로 시험할 수 있다
//   (외장하드에서는 next dev 가 캐시가 깨져 못 뜬다 — 그 사정 때문에 여기를 갈라 뒀다).
//   fs 로 읽어 오는 쪽은 lib/casebook.ts 다.

import { addDays, type Applies, type CheckCard, type YearBound } from "@/lib/checklist";

/** 도구가 내보내는 상태 — 원문을 «읽은» 것만. unverified 는 절대 안 나간다 */
export const 내보낼상태 = new Set(["live", "watch"]);

// 화면에 붙이는 그림글자. 데이터가 아니라 «보이는 것» 이라 여기 둔다.
// 없으면 📌 로 떨어지므로 케이스북이 늘어도 아무것도 안 깨진다.
export const 그림글자: Record<string, string> = {
  "driver-license-renewal": "🪪",
  "passport-reissue": "🛂",
  "health-checkup-eligibility": "🏥",
  "phone-identity-theft": "📱",
  "voice-phishing-first-hour": "🚨",
  "account-info-sweep": "🏦",
  "lost-wallet": "👛",
  "power-outage": "🔌",
  "car-inspection": "🚗",
  "move-in-report": "📦",
  "child-vaccination": "💉",
  "pension-record": "🧓",
  "resident-card": "🆔",
};

export interface RawStep {
  when?: string;
  what?: string;
  where?: string;
  why?: string;
}

export interface RawCase {
  id?: string;
  situation?: string;
  oneLine?: string;
  steps?: RawStep[];
  deadline?: { kind?: string; text?: string; basisRef?: string | null };
  volatile?: { label?: string; checkUrl?: string }[];
  basis?: {
    id?: string;
    title?: string;
    url?: string;
    publisher?: string;
    article?: string | null;
    checkedAt?: string | null;
  }[];
  applies?: Partial<Applies>;
  yearBound?: { kind?: string; text?: string; basisRef?: string } | null;
  verifiedAt?: string | null;
  recheckDays?: number;
  status?: string;
}

const 기본조건: Applies = {
  everyone: false,
  have: [],
  ageFrom: null,
  ageTo: null,
  ageBasisRef: null,
  ageNotes: [],
};

/** 확인 주기를 안 적어 놨으면 반년으로 본다 */
export const 기본재확인일수 = 180;

/**
 * 케이스북 한 건 → 카드. 내보낼 수 없는 것은 null.
 * @param 아는것 어휘표에 있는 「가진 것」 id 들
 * @param 글주소 케이스북 id → 발행글 주소
 */
export function toCard(
  c: RawCase,
  아는것: Set<string>,
  글주소: Map<string, string>,
  오늘: string,
): CheckCard | null {
  if (!c.id || !c.verifiedAt || !내보낼상태.has(c.status ?? "")) return null;

  const 조건: Applies = { ...기본조건, ...(c.applies ?? {}) };
  // 어휘표에 없는 이름은 화면에서도 버린다 (검사기가 이미 탈락시키지만, 화면이 혼자 안 믿는다)
  조건.have = (조건.have ?? []).filter((h) => 아는것.has(h));
  조건.ageNotes = 조건.ageNotes ?? [];

  const 첫걸음 = (c.steps ?? []).find((s) => s.when === "3분") ?? (c.steps ?? [])[0];
  const 주기 = Number.isFinite(Number(c.recheckDays)) ? Number(c.recheckDays) : 기본재확인일수;
  const 다음확인 = addDays(c.verifiedAt, 주기);

  const yb = c.yearBound;
  const 해마다: YearBound | null =
    yb && (yb.kind === "연말" || yb.kind === "연초") && yb.text && yb.basisRef
      ? { kind: yb.kind, text: yb.text, basisRef: yb.basisRef }
      : null;

  const kind = c.deadline?.kind;
  const deadlineKind: CheckCard["deadlineKind"] =
    kind === "법정" || kind === "안내" ? kind : "없음";

  return {
    id: c.id,
    emoji: 그림글자[c.id] ?? "📌",
    situation: c.situation ?? c.id,
    oneLine: c.oneLine ?? null,
    deadlineKind,
    deadlineText: c.deadline?.text ?? "",
    firstMove: 첫걸음?.what ? { what: 첫걸음.what, where: 첫걸음.where ?? "" } : null,
    checks: (c.volatile ?? [])
      .filter((v) => v.label)
      .map((v) => ({ label: v.label as string, url: v.checkUrl ?? null })),
    sources: (c.basis ?? [])
      .filter((b) => b.url)
      .map((b) => ({
        title: b.title ?? (b.url as string),
        url: b.url as string,
        publisher: b.publisher ?? "",
        article: b.article ?? null,
        checkedAt: b.checkedAt ?? null,
      })),
    verifiedAt: c.verifiedAt,
    nextCheckAt: 다음확인,
    stale: 다음확인 < 오늘,
    applies: 조건,
    articleHref: 글주소.get(c.id) ?? null,
    // ★근거(basisRef)가 없으면 «올해 안에» 표시를 떼어 버린다. 검사기가 이미 탈락시키지만
    //   화면이 혼자 안 믿는다 — 「올해 지나면 없어진다」는 근거 없이 못 하는 말이다.
    yearBound: 해마다,
  };
}
