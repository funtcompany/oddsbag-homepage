// 기계 검증 — AI를 믿지 않고, 코드가 직접 원문과 대조한다.
//
// AI 심사관도 결국 AI다. 놓칠 수 있다.
// 그래서 '지어내면 반드시 걸리는' 것들은 기계가 문자 그대로 대조한다:
//
//   1. 숫자   — 초안에 나온 수치가 원문에 실제로 있는가 (없으면 환각)
//   2. 인용문 — "..." 안의 발언이 원문에 실제로 있는가 (없으면 날조)
//   3. 날짜   — 연도·날짜가 원문에 있는가
//
// 이건 확률이 아니라 사실 대조라서, AI가 아무리 그럴듯하게 써도 못 빠져나간다.

export interface MachineCheck {
  ok: boolean;
  fabricatedNumbers: string[]; // 원문에 없는 수치
  fabricatedQuotes: string[]; // 원문에 없는 인용문
  note: string;
}

// 비교용 정규화: 공백·쉼표·따옴표 제거 (표기 차이로 오탐하지 않게)
function norm(s: string): string {
  return s
    .replace(/[,\s·"'“”‘’]/g, "")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase();
}

// 숫자 추출 — 두 자리 이상만 본다 (1,2,3 같은 건 흔해서 대조 의미가 없다)
function numbers(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d[\d,.]*/g)) {
    const raw = m[0].replace(/[.,]$/, "");
    const digits = raw.replace(/[,.]/g, "");
    if (digits.length >= 2) out.add(raw);
  }
  return [...out];
}

// 큰따옴표 안의 직접 인용 추출
function quotes(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/["“]([^"”]{8,120})["”]/g)) {
    out.push(m[1].trim());
  }
  return out;
}

// 인용문이 원문에 실제로 있는가 (표현이 조금 달라도 핵심 어절이 겹치면 인정)
function quoteFound(quote: string, source: string): boolean {
  const q = norm(quote);
  const s = norm(source);
  if (s.includes(q)) return true;

  // 부분 일치: 6글자 단위로 잘라 절반 이상이 원문에 있으면 인용으로 인정
  const chunks: string[] = [];
  for (let i = 0; i + 6 <= q.length; i += 6) chunks.push(q.slice(i, i + 6));
  if (chunks.length === 0) return s.includes(q);
  const hit = chunks.filter((c) => s.includes(c)).length;
  return hit / chunks.length >= 0.5;
}

// ===== 가이드(꿀팁) 전용 대조 — 단축키와 메뉴 경로 =====
//
// 뉴스는 '수치·인용문'을 지어내면 가짜뉴스가 된다.
// 가이드는 다르다. '없는 단축키'와 '없는 메뉴 이름'을 지어내는 것이 치명상이다.
// 독자가 그대로 따라 했는데 그 메뉴가 없으면 그 자리에서 신뢰가 끝난다.
//
// 그래서 [키] · [경로] 줄에 적힌 글자는 근거 자료(facts) 안에 그대로 있어야만 통과시킨다.
// ※ content-factory/verify.mjs 와 항상 같은 규칙이어야 한다 (쌍둥이 파일).

export interface GuideTermCheck {
  ok: boolean;
  unknownKeys: string[]; // 근거에 없는 단축키
  unknownPaths: string[]; // 근거에 없는 메뉴 경로
  note: string;
}

// 맥 기호를 이름으로 펴서 비교한다 (⌘ 과 Command 가 같은 것으로 보이게)
const KEYSYM: Record<string, string> = {
  "⌘": "command",
  "⌥": "option",
  "⌃": "control",
  "⇧": "shift",
  "⏎": "return",
  "⌫": "delete",
};
function normKey(s: string): string {
  let t = String(s);
  for (const [sym, name] of Object.entries(KEYSYM)) t = t.split(sym).join(name);
  return norm(t.replace(/키$/, ""));
}

/** 본문에서 [표시] 줄의 내용만 뽑는다 */
function markLines(body: string, mark: string): string[] {
  const out: string[] = [];
  for (const line of String(body ?? "").split("\n")) {
    const m = line.trim().match(new RegExp(`^\\[${mark}\\]\\s*(.+)$`));
    if (m) out.push(m[1].trim());
  }
  return out;
}

/**
 * 가이드 글의 단축키·메뉴 경로가 근거 자료 안에 실제로 있는지 대조한다.
 * 근거 자료가 너무 짧으면(대조할 게 없으면) 검사하지 않는다 — 오탐이 더 해롭다.
 */
export function verifyGuideTerms(body: string, factsText: string): GuideTermCheck {
  const facts = String(factsText ?? "");
  if (facts.length < 120) {
    return { ok: true, unknownKeys: [], unknownPaths: [], note: "근거 자료가 짧아 용어 대조 생략" };
  }
  const factsKey = normKey(facts);
  const factsPlain = norm(facts);

  // 1) [키] — 조합 전체가 근거에 그대로 있어야 한다 (부분 토큰만 맞는 건 인정하지 않는다)
  const unknownKeys = markLines(body, "키").filter((k) => {
    const combo = normKey(k);
    return combo.length >= 2 && !factsKey.includes(combo);
  });

  // 2) [경로] — 단계마다 그 메뉴 이름이 근거에 있어야 한다
  const unknownPaths: string[] = [];
  for (const p of markLines(body, "경로")) {
    const missing = p
      .split(/[>›»]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
      .filter((s) => !factsPlain.includes(norm(s)));
    if (missing.length) unknownPaths.push(`${p} (근거에 없음: ${missing.join(", ")})`);
  }

  const parts: string[] = [];
  if (unknownKeys.length)
    parts.push(`근거에 없는 단축키 ${unknownKeys.length}건: ${unknownKeys.slice(0, 3).join(" / ")}`);
  if (unknownPaths.length) parts.push(`근거에 없는 메뉴 경로 ${unknownPaths.length}건: ${unknownPaths[0]}`);

  return {
    ok: unknownKeys.length === 0 && unknownPaths.length === 0,
    unknownKeys,
    unknownPaths,
    note: parts.join(" / ") || "단축키·메뉴 경로 모두 근거와 일치",
  };
}

export function machineVerify(
  draft: { title: string; summary: string; body: string },
  sourceText: string,
  sourceTitle: string,
): MachineCheck {
  const source = norm(sourceTitle + " " + sourceText);
  const text = `${draft.title}\n${draft.summary}\n${draft.body}`;

  // 1) 수치 대조
  const fabricatedNumbers = numbers(text).filter((n) => {
    const d = norm(n);
    if (source.includes(d)) return false;
    // 원문이 "3만2000" 처럼 붙여 쓴 경우까지 감안해 숫자만 비교
    const digitsOnly = d.replace(/\D/g, "");
    return digitsOnly.length >= 2 && !source.includes(digitsOnly);
  });

  // 2) 인용문 대조
  const fabricatedQuotes = quotes(text).filter((q) => !quoteFound(q, sourceText + sourceTitle));

  const parts: string[] = [];
  if (fabricatedNumbers.length)
    parts.push(`원문에 없는 수치 ${fabricatedNumbers.length}건: ${fabricatedNumbers.slice(0, 4).join(", ")}`);
  if (fabricatedQuotes.length)
    parts.push(`원문에 없는 인용문 ${fabricatedQuotes.length}건`);

  return {
    ok: fabricatedNumbers.length === 0 && fabricatedQuotes.length === 0,
    fabricatedNumbers,
    fabricatedQuotes,
    note: parts.join(" / ") || "수치·인용문 모두 원문과 일치",
  };
}
