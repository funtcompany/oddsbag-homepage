// 본문 '도식 표시' 한 곳 관리 — 여기가 유일한 기준이다.
//
// 본문에 아래처럼 한 줄로 적혀 있으면 홈페이지가 글자 대신 그림으로 그린다.
//   [즉답] 시스템 설정 > 키보드에서 바꿉니다. 2분이면 끝납니다.
//   [버전] macOS 15 세쿼이아 기준   (날짜는 넣지 않는다 — 근거에 없는 시점이라 환각으로 걸러진다)
//   [단계] 시스템 설정을 연다            (연속 줄 → 번호 스텝 하나로 묶임)
//   [확인] 케이블을 다른 포트에 꽂아봤다   (연속 줄 → 체크리스트 하나로 묶임)
//   [Q] 단축키를 바꾸면 원래 기능이 사라지나요?
//   [A] 아니요. 겹치면 경고가 뜹니다.     (Q 바로 다음 줄에 A → 접이식 FAQ)
//   [대안] 이 메뉴가 없다면 Command + Shift + 5 로도 됩니다
//   [키] Command + Control + Q / [경로] 시스템 설정 > 잠금 화면
//   [핵심] 꼭 기억할 한 줄 / [주의] 조심할 점
//
// ★ 표시를 새로 늘릴 때는 반드시 아래를 같이 고친다.
//   안 그러면 인스타 카드뉴스·릴스 자막에 "[Q]" 같은 대괄호가 그대로 찍혀 나간다.
//     · components/ArticleView.tsx  — 화면에 그림으로 그리기
//     · components/Figures.tsx      — 그림 부품
//     · lib/cards.ts                — 카드뉴스에서 빼기
//     · content-factory/cards.mjs   — 카드뉴스(자동화 쪽 쌍둥이)에서 빼기
//     · factory/render.mjs          — 릴스 자막·나레이션에서 빼기
//     · content-factory/ai.mjs      — AI에게 이 표시를 쓰라고 알려주기
//     · content-factory/quality.mjs + lib/quality.ts — 형식 게이트(guideFormatIssues)
//     · content-factory/verify.mjs  + lib/verify.ts  — [키]·[경로] 근거 대조(verifyGuideTerms)

export type MarkName =
  | "키"
  | "경로"
  | "핵심"
  | "주의"
  | "즉답"
  | "버전"
  | "단계"
  | "확인"
  | "대안"
  | "Q"
  | "A";

/** 도식 줄 인식 정규식 — 줄 맨 앞에 [표시]가 오고 뒤에 내용이 있어야 한다 */
export const MARK_LINE =
  /^\[(키|경로|핵심|주의|즉답|버전|단계|확인|대안|[QA])\]\s*(.+)$/i;

/** 그 줄이 도식 줄이면 {표시, 내용}, 아니면 null */
export function markOf(line: string): { name: MarkName; rest: string } | null {
  const m = String(line ?? "").trim().match(MARK_LINE);
  if (!m) return null;
  const raw = m[1];
  const name = (/^[qa]$/i.test(raw) ? raw.toUpperCase() : raw) as MarkName;
  return { name, rest: m[2].trim() };
}

/** 도식 줄인가 (카드뉴스·릴스에서 걷어낼 때 쓴다) */
export function isMarkLine(line: string): boolean {
  return markOf(line) !== null;
}

/** 도식 줄을 통째로 걷어낸 본문 (SNS 자막·요약용) */
export function stripMarkLines(text: string): string {
  return String(text ?? "")
    .split("\n")
    .filter((l) => !isMarkLine(l))
    .join("\n");
}

// ─────────────────────────────────────────────────────────────
//  본문 사진 줄 (2026-08-18 신설)
//
//  `![캡션](/wpms/01/02.jpg)` 한 줄 = 사진 한 장.
//  홈페이지(ArticleView.tsx)만 사진으로 그리고, 나머지는 전부 걷어낸다.
//  ★안 걷어내면 인스타 카드·릴스 자막에 "![캡션](/wpms/01/02.jpg)" 가 글자로 찍혀 나간다.
//    도식 표시와 같은 이유로 여기에 둔다 — 파일 머리말의 「같이 고칠 곳」 목록이 그대로 적용된다.
// ─────────────────────────────────────────────────────────────

/** 본문 사진 줄 인식 정규식 — 줄 전체가 마크다운 이미지 하나여야 한다 */
export const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;

/** 그 줄이 사진 줄이면 {캡션, 주소}, 아니면 null */
export function imageOf(line: string): { caption: string; src: string } | null {
  const m = String(line ?? "").trim().match(IMAGE_LINE);
  return m ? { caption: m[1].trim(), src: m[2] } : null;
}

/** 사진 줄인가 (카드뉴스·릴스에서 걷어낼 때 쓴다) */
export function isImageLine(line: string): boolean {
  return imageOf(line) !== null;
}

// ─────────────────────────────────────────────────────────────
//  구조화 데이터(HowTo·FAQPage)를 만들기 위한 추출기
// ─────────────────────────────────────────────────────────────
export interface GuideParts {
  /** [즉답] — 글 전체에 1개 */
  answer: string;
  /** [버전] — 글 전체에 1개 */
  version: string;
  /** [단계] 연속 줄 묶음. 가장 긴 묶음 하나가 HowTo가 된다 */
  stepGroups: string[][];
  /** [Q]/[A] 짝 */
  faqs: { q: string; a: string }[];
}

export function extractGuide(body: string): GuideParts {
  const lines = String(body ?? "").split("\n");
  const out: GuideParts = { answer: "", version: "", stepGroups: [], faqs: [] };
  let steps: string[] = [];

  const flush = () => {
    if (steps.length >= 2) out.stepGroups.push(steps);
    steps = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // 빈 줄은 묶음을 끊지 않는다 (AI가 사이에 넣는 경우가 많다)
    const mk = markOf(line);
    if (!mk) {
      flush();
      continue;
    }
    if (mk.name === "단계") {
      steps.push(clean(mk.rest));
      continue;
    }
    flush();
    if (mk.name === "즉답" && !out.answer) out.answer = clean(mk.rest);
    else if (mk.name === "버전" && !out.version) out.version = clean(mk.rest);
    else if (mk.name === "Q") {
      // 바로 다음의 (빈 줄을 건너뛴) 줄이 [A]일 때만 짝으로 인정한다
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      const nx = j < lines.length ? markOf(lines[j]) : null;
      if (nx?.name === "A") {
        out.faqs.push({ q: clean(mk.rest), a: clean(nx.rest) });
        i = j;
      }
    }
  }
  flush();
  return out;
}

function clean(s: string): string {
  return s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}
