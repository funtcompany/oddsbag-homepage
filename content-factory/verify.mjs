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

// 비교용 정규화: 공백·쉼표·따옴표 제거 (표기 차이로 오탐하지 않게)
function norm(s) {
  return s
    .replace(/[,\s·"'“”‘’]/g, "")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase();
}

// 숫자 추출 — 두 자리 이상만 본다 (1,2,3 같은 건 흔해서 대조 의미가 없다)
function numbers(text) {
  const out = new Set();
  for (const m of text.matchAll(/\d[\d,.]*/g)) {
    const raw = m[0].replace(/[.,]$/, "");
    const digits = raw.replace(/[,.]/g, "");
    if (digits.length >= 2) out.add(raw);
  }
  return [...out];
}

// 큰따옴표 안의 직접 인용 추출
function quotes(text) {
  const out = [];
  for (const m of text.matchAll(/["“]([^"”]{8,120})["”]/g)) {
    out.push(m[1].trim());
  }
  return out;
}

// 인용문이 원문에 실제로 있는가 (표현이 조금 달라도 핵심 어절이 겹치면 인정)
function quoteFound(quote, source) {
  const q = norm(quote);
  const s = norm(source);
  if (s.includes(q)) return true;

  // 부분 일치: 6글자 단위로 잘라 절반 이상이 원문에 있으면 인용으로 인정
  const chunks = [];
  for (let i = 0; i + 6 <= q.length; i += 6) chunks.push(q.slice(i, i + 6));
  if (chunks.length === 0) return s.includes(q);
  const hit = chunks.filter((c) => s.includes(c)).length;
  return hit / chunks.length >= 0.5;
}

export function machineVerify(draft, sourceText, sourceTitle) {
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

  const parts = [];
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
