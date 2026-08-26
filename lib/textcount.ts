// 글자수 세기 — 세는 «규칙». 순수 함수만.
//
// ★DOM 도 next 도 안 부른다. 서버 없이 그대로 시험할 수 있다.
//
// ★왜 직접 세나 — 한국에서 「글자수」는 세는 곳마다 뜻이 다르다.
//   자기소개서는 «공백 포함», 어떤 곳은 «공백 제외», 옛 게시판은 «바이트».
//   하나만 보여 주면 반드시 누군가는 틀린 값을 믿고 낸다. 그래서 한 화면에 다 놓는다.

export interface TextCount {
  /** 공백 포함 글자수 — 사람이 세는 것과 같게 «보이는 글자» 기준 */
  withSpace: number;
  /** 공백 제외 (띄어쓰기·줄바꿈·탭을 뺀다) */
  withoutSpace: number;
  /** 줄바꿈만 뺀 것 — 「공백 포함」을 이렇게 세는 곳도 있다 */
  withSpaceNoNewline: number;
  /** 낱말 수 */
  words: number;
  /** 줄 수 (빈 줄도 한 줄) */
  lines: number;
  /** 문단 수 (빈 줄로 나뉜 덩이) */
  paragraphs: number;
  /** 문장 수 (. ! ? … 로 끊는다) */
  sentences: number;
  /** UTF-8 바이트 */
  bytesUtf8: number;
  /** EUC-KR 바이트 — 한글 2, 그 밖 1 (옛 게시판·공공 서식이 이걸로 센다) */
  bytesEucKr: number;
  /** 원고지 매수 (200자 기준) */
  wonngoji200: number;
}

/**
 * 「보이는 글자」로 센다.
 *
 * ★그냥 `s.length` 로 세면 안 된다 — 자바스크립트는 글자를 UTF-16 조각으로 세서
 *   이모지 한 개가 2로, 국기 이모지는 4로 잡힌다. 사람이 세는 값과 어긋난다.
 *   Intl.Segmenter 가 있으면 그걸 쓰고, 없으면 [...s] 로 물러선다.
 */
export function 보이는글자수(s: string): number {
  if (!s) return 0;
  try {
    const seg = new Intl.Segmenter("ko", { granularity: "grapheme" });
    let n = 0;
    for (const _ of seg.segment(s)) n += 1;
    return n;
  } catch {
    return [...s].length;
  }
}

/** EUC-KR 로 보냈을 때 몇 바이트인가 — 한글·한자·전각은 2, 나머지는 1 */
export function eucKrBytes(s: string): number {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    // 한글(완성형·자모)·한자·일본어·전각기호 대역은 2바이트로 잡힌다
    const 두바이트 =
      (c >= 0x1100 && c <= 0x11ff) || // 한글 자모
      (c >= 0x3000 && c <= 0x303f) || // CJK 문장부호
      (c >= 0x3130 && c <= 0x318f) || // 호환 자모
      (c >= 0x4e00 && c <= 0x9fff) || // 한자
      (c >= 0xac00 && c <= 0xd7a3) || // 한글 음절
      (c >= 0xff00 && c <= 0xffef); // 전각
    n += 두바이트 ? 2 : c > 0xffff ? 4 : 1; // 이모지는 EUC-KR 에 없다 — 넉넉히 잡는다
  }
  return n;
}

export function countText(sRaw: string): TextCount {
  const s = sRaw ?? "";
  const 공백뺀것 = s.replace(/\s/gu, "");
  const 줄바꿈뺀것 = s.replace(/[\r\n]/g, "");

  const withSpace = 보이는글자수(s);
  const 낱말 = s.trim() ? s.trim().split(/\s+/u).length : 0;
  const 줄 = s === "" ? 0 : s.split(/\r\n|\r|\n/).length;
  const 문단 = s.trim()
    ? s
        .split(/(?:\r\n|\r|\n)\s*(?:\r\n|\r|\n)/)
        .filter((p) => p.trim() !== "").length
    : 0;
  const 문장 = (s.match(/[^.!?…]+[.!?…]+/gu) ?? []).length + (/[^.!?…\s][^.!?…]*$/u.test(s) ? 1 : 0);

  return {
    withSpace,
    withoutSpace: 보이는글자수(공백뺀것),
    withSpaceNoNewline: 보이는글자수(줄바꿈뺀것),
    words: 낱말,
    lines: 줄,
    paragraphs: 문단,
    sentences: s.trim() ? 문장 : 0,
    bytesUtf8: new TextEncoder().encode(s).length,
    bytesEucKr: eucKrBytes(s),
    // 원고지는 «칸을 채우는» 것이라 올림한다. 반 장이라도 한 장을 쓴다.
    wonngoji200: Math.ceil(withSpace / 200),
  };
}

/** 자기소개서처럼 「몇 자 이내」가 정해진 글 — 얼마나 남았나 */
export interface LimitState {
  limit: number;
  used: number;
  left: number;
  /** 0~100. 100 을 넘으면 초과 */
  percent: number;
  over: boolean;
}

export function limitState(count: number, limit: number): LimitState {
  const l = Math.max(0, Math.floor(limit) || 0);
  return {
    limit: l,
    used: count,
    left: l - count,
    percent: l > 0 ? Math.round((count / l) * 100) : 0,
    over: l > 0 && count > l,
  };
}

/** 「몇 자 이내」를 어느 기준으로 세는지 — 화면에서 고르게 한다 */
export const 세는법 = [
  { id: "withSpace", label: "공백 포함", hint: "자기소개서·지원서가 대개 이것" },
  { id: "withoutSpace", label: "공백 제외", hint: "띄어쓰기와 줄바꿈을 뺀 것" },
  { id: "bytesUtf8", label: "바이트(UTF-8)", hint: "요즘 시스템" },
  { id: "bytesEucKr", label: "바이트(EUC-KR)", hint: "옛 게시판·공공 서식" },
] as const;

export type 세는법Id = (typeof 세는법)[number]["id"];
