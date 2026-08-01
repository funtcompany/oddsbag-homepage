// 품질·가짜뉴스 심사 — 3중 게이트
//
//   1단계 [기계 대조]   코드가 원문과 문자 그대로 대조 (수치·인용문 날조 탐지)
//   2단계 [팩트체커]    AI가 주장 하나하나에 원문 근거가 있는지 확인
//   3단계 [리스크 심사] 다른 AI가 명예훼손·선동·위험조언·편향만 따로 본다
//
// 세 관문을 전부 통과해야 자동 발행된다.
// 하나라도 걸리면 → 자동 개선 후 재심사, 또는 검수함 보류.
// 원칙: 의심스러우면 내보내지 않는다.

import { pick, hasBrokenChars, type DraftDraft } from "@/lib/ai";
import { ask } from "@/lib/llm";
import { machineVerify, type MachineCheck } from "@/lib/verify";

export type Verdict = "publish" | "revise" | "hold";
export type FakeRisk = "low" | "medium" | "high";

export interface RiskReview {
  level: FakeRisk;
  flags: string[];
  note: string;
}

export interface Review {
  score: number; // 0~100
  fakeRisk: FakeRisk;
  verdict: Verdict;
  issues: string[];
  note: string;
  scores: {
    accuracy: number;
    readability: number;
    tone: number;
    useful: number;
    title: number;
  };
  machine?: MachineCheck; // 기계 대조 결과
  risk?: RiskReview; // 리스크 심사 결과
}

const PASS_SCORE = 78; // 이 이상 + 위험 없음 → 자동 발행
const HOLD_SCORE = 60; // 이 미만 → 바로 검수함

// ================= 2단계: 팩트체커 =================
const FACT_SYSTEM = `너는 '오즈백(ODDSBAG)' 매거진의 팩트체커다.
AI 에디터가 쓴 초안을 '원문 기사'와 한 문장씩 대조해 검증한다.
독자에게 잘못된 정보가 나가는 것이 이 매체가 죽는 길이다. 절대 관대하게 매기지 마라.

[핵심 검사 — 하나라도 걸리면 accuracy를 크게 깎아라]
1. 환각: 원문에 없는 사실·수치·인용·날짜·인명·기관명을 초안이 만들어냈는가?
2. 단정: 원문이 "~할 전망", "~로 보인다"라고 한 걸 초안이 "~했다"로 확정했는가?
3. 왜곡: 원문의 맥락·인과관계를 초안이 바꿔놨는가? (상관관계를 인과관계로 등)
4. 누락: 원문의 핵심 단서(반론·조건·예외)를 빼서 한쪽으로 기울었는가?
5. 과장: 원문의 규모·심각성을 초안이 부풀렸는가?
6. 시점: 이미 지난 일을 진행 중인 것처럼, 또는 그 반대로 썼는가?

[fakeRisk 판정 — 엄격하게]
- high: 원문에 없는 사실을 단정 서술 / 인용문 날조 / 수치 조작 / 특정인 명예훼손 소지
        / 원문이 불확실하다고 한 걸 확정으로 씀 / 의료·금융·법률 근거 없는 조언
- medium: 원문 범위를 살짝 벗어난 해석 / 표현이 다소 과장 / 확인이 필요한 서술 존재
- low: 모든 사실 서술이 원문 안에 있고, 불확실한 건 불확실하다고 밝혔다

[점수]
- accuracy(40): 원문 사실과의 일치도. 환각이 하나라도 있으면 15점 이하.
- readability(20): 문장이 짧고 명확한가, 소제목 구조가 살아있는가. 섹션이 서론만 있고 본론·결론 없이 빈약하면 감점.
- tone(15): 오즈백 톤 (위트 있되 쓸모 있게, 중립적, 따뜻함)
- useful(15): 독자가 얻어가는 게 있는가. 훅·제목이 약속한 걸 본문이 실제로 다루는가 — 어그로만 세고 알맹이가 없거나, 서론에서 끝나 카드뉴스·영상으로 펼칠 내용이 부족하면(빈약함) 크게 감점.
- title(10): 낚시가 아니면서 클릭하고 싶은가

[issues]
- 무엇을 어떻게 고쳐야 하는지 구체적으로. (예: "원문에 없는 '3배 증가'를 삭제할 것")
- 빈약한 섹션이 있으면 어느 소제목을 서론-본론-결론으로 채워야 하는지 지적하라 (단, 없는 사실을 지어내라는 뜻은 아니다).
- 문제가 없으면 비워둬라.

출력은 반드시 아래 형식 그대로. 다른 말 금지.
<accuracy>숫자</accuracy>
<readability>숫자</readability>
<tone>숫자</tone>
<useful>숫자</useful>
<titleScore>숫자</titleScore>
<fakeRisk>low 또는 medium 또는 high</fakeRisk>
<issues>
- 지적사항
</issues>
<note>한 줄 심사평</note>`;

// ================= 3단계: 리스크 심사관 (독립) =================
const RISK_SYSTEM = `너는 언론사의 법무·윤리 심사관이다.
사실관계 정확도는 다른 사람이 본다. 너는 오직 '내보내면 문제가 될 위험'만 본다.

[반드시 잡아낼 것]
- 명예훼손: 실명 인물·기업을 부정적으로 단정하거나 확인되지 않은 의혹을 사실처럼 서술
- 선동·편향: 특정 정당·집단·국가를 일방적으로 비난하거나 옹호
- 혐오: 성별·지역·인종·종교·장애·연령 비하 뉘앙스
- 위험한 조언: 의료·금융·투자·법률에 대해 근거 없이 "이렇게 하라"는 서술
- 낚시: 본문이 뒷받침하지 않는 자극적 제목
- 사생활: 일반인의 신상·사생활 노출
- 미확인 단정: "~로 밝혀졌다", "~가 확실하다"인데 출처가 없음
- 저작권: 원문 문장을 거의 그대로 베낀 흔적

[판정]
- high: 위 항목 중 하나라도 실제로 발생 → 절대 발행 불가
- medium: 애매하거나 표현을 다듬으면 해결되는 수준
- low: 문제 없음

문제가 없으면 억지로 흠집 내지 마라. low 로 통과시켜라.

출력은 반드시 아래 형식 그대로. 다른 말 금지.
<level>low 또는 medium 또는 high</level>
<flags>
- 위험 항목 (없으면 비워둠)
</flags>
<note>한 줄 심사평</note>`;

// ---- 파서 ----
function parseReview(text: string, defaultRisk: FakeRisk): Review {
  const n = (k: string, max: number) =>
    Math.max(0, Math.min(max, parseInt(pick(text, k) || "0", 10) || 0));
  const scores = {
    accuracy: n("accuracy", 40),
    readability: n("readability", 20),
    tone: n("tone", 15),
    useful: n("useful", 15),
    title: n("titleScore", 10),
  };
  const score = scores.accuracy + scores.readability + scores.tone + scores.useful + scores.title;
  const r = pick(text, "fakeRisk").toLowerCase();
  const fakeRisk: FakeRisk = r === "low" || r === "medium" || r === "high" ? r : defaultRisk;
  const issues = pick(text, "issues")
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
  return { score, fakeRisk, verdict: "hold", issues, note: pick(text, "note"), scores };
}

function parseRisk(text: string): RiskReview {
  const l = pick(text, "level").toLowerCase();
  return {
    level: l === "low" || l === "medium" || l === "high" ? l : "high",
    flags: pick(text, "flags")
      .split("\n")
      .map((x) => x.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 6),
    note: pick(text, "note"),
  };
}

// 두 등급 중 더 위험한 쪽
function worst(a: FakeRisk, b: FakeRisk): FakeRisk {
  const rank = { low: 0, medium: 1, high: 2 };
  return rank[a] >= rank[b] ? a : b;
}

// ================= 개수 약속 ↔ 본문 일치 검사 (기계, AI 없이) =================
// 왜: 제목/요약이 "5가지"라 해놓고 본문 ## 섹션이 3개뿐이면 카드뉴스·쇼츠도 반토막이 난다.
//     (buildCards가 본문 ## 소제목을 그대로 카드로 옮기기 때문)
//     factory/find-truncated.mjs 와 같은 보수적 파서로, '가지/단계/선/TOP N'만 신뢰한다.
//     '개·대·위·명·개월' 등 뉴스 본문 숫자는 오탐이 심해 세지 않는다.
const KNUM: Record<string, number> = {
  두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 둘: 2, 셋: 3, 넷: 4,
};
const PROMISE_UNIT = "(?:가지방법|가지|단계|선)";
export function promisedCount(text: string): number {
  if (!text) return 0;
  const t = text.replace(/,/g, "");
  let max = 0;
  for (const m of t.matchAll(new RegExp(`(?<!\\d)(\\d{1,2})\\s*${PROMISE_UNIT}`, "g"))) {
    const n = parseInt(m[1], 10);
    if (n >= 2 && n <= 20) max = Math.max(max, n);
  }
  for (const m of t.matchAll(/(?:TOP|top|베스트|BEST|best)\s*(\d{1,2})/g)) {
    const n = parseInt(m[1], 10);
    if (n >= 2 && n <= 20) max = Math.max(max, n);
  }
  for (const m of t.matchAll(new RegExp(`(두|세|네|다섯|여섯|일곱|여덟|아홉|열|둘|셋|넷)\\s*${PROMISE_UNIT}`, "g"))) {
    const n = KNUM[m[1]] || 0;
    if (n >= 2) max = Math.max(max, n);
  }
  return max;
}

// 본문 ## 소제목 개수 (한 줄 정리 제외)
export function deliveredSections(body: string): number {
  if (!body) return 0;
  return body
    .split("\n")
    .filter((l) => l.trim().startsWith("## ") && !l.includes("한 줄 정리")).length;
}

// 약속 개수 > 본문 소제목이면 지적 문구를 돌려준다 (없으면 빈 문자열)
function promiseIssue(title: string, summary: string, body: string): string {
  const promised = promisedCount(`${title}  ${summary}`);
  if (promised < 2) return "";
  const delivered = deliveredSections(body);
  if (delivered >= promised) return "";
  return `제목/요약이 ${promised}개를 약속했는데 본문 소제목(## )은 ${delivered}개뿐 — 본문 소제목을 ${promised}개로 맞추거나, 제목·요약의 개수를 실제 담긴 ${delivered}개로 낮출 것 (카드뉴스·쇼츠가 소제목 단위로 잘려 뒤 항목이 사라진다)`;
}

// ================= 발행 전 심사 (3중 게이트) =================
export async function reviewDraft(
  draft: Pick<DraftDraft, "title" | "summary" | "body">,
  source: { title: string; context: string; from: string; url?: string },
): Promise<Review> {
  // --- 1단계: 기계 대조 (AI 없이, 문자 그대로) ---
  const machine = machineVerify(draft, source.context, source.title);

  const factUser = `[원문 기사 — 오직 이것만이 사실의 근거다]
수집처: ${source.from}
제목: ${source.title}
본문:
${source.context}

[심사할 초안]
제목: ${draft.title}
요약: ${draft.summary}
본문:
${draft.body}
${
  machine.ok
    ? ""
    : `\n[기계 대조 결과 — 이미 확인된 문제]\n${machine.note}\n(위 항목은 원문에 존재하지 않는다. 반드시 accuracy에 반영하라.)`
}

위 초안을 원문과 한 문장씩 대조해 심사하라. 지정된 태그 형식으로만 출력.`;

  const riskUser = `[검토할 글]
제목: ${draft.title}
요약: ${draft.summary}
본문:
${draft.body}

[원문 출처] ${source.from} ${source.url ?? ""}

이 글을 내보냈을 때 생길 위험만 심사하라. 지정된 태그 형식으로만 출력.`;

  // --- 2·3단계: 팩트체커와 리스크 심사관이 서로 모른 채 독립적으로 심사 ---
  const [factRaw, riskRaw] = await Promise.all([
    ask(FACT_SYSTEM, factUser, { maxTokens: 1200, careful: true }),
    ask(RISK_SYSTEM, riskUser, { maxTokens: 700, careful: true }),
  ]);

  const rv = parseReview(factRaw, "high");
  const risk = parseRisk(riskRaw);

  // --- 종합 판정: 셋 중 가장 나쁜 결과를 따른다 ---
  let fakeRisk = worst(rv.fakeRisk, risk.level);
  let score = rv.score;
  const issues = [...rv.issues];

  // 기계 대조에서 날조가 잡히면 AI 판정과 무관하게 무조건 막는다
  if (!machine.ok) {
    fakeRisk = machine.fabricatedQuotes.length ? "high" : worst(fakeRisk, "medium");
    score = Math.min(score, 55);
    if (machine.fabricatedNumbers.length)
      issues.unshift(
        `원문에 없는 수치를 삭제할 것: ${machine.fabricatedNumbers.slice(0, 3).join(", ")}`,
      );
    if (machine.fabricatedQuotes.length)
      issues.unshift(`원문에 없는 인용문을 삭제할 것: "${machine.fabricatedQuotes[0].slice(0, 30)}…"`);
  }
  if (risk.flags.length) issues.push(...risk.flags.map((f) => `[위험] ${f}`));

  // 개수 약속 ↔ 본문 소제목 일치 (기계 대조) — 어긋나면 지적에 얹어 개선을 유도한다
  const pIssue = promiseIssue(draft.title, draft.summary, draft.body);
  if (pIssue) issues.unshift(pIssue);

  let verdict: Verdict;
  if (fakeRisk === "high") verdict = "hold";
  else if (fakeRisk === "medium") verdict = score >= HOLD_SCORE ? "revise" : "hold";
  else if (score >= PASS_SCORE) verdict = "publish";
  else if (score >= HOLD_SCORE) verdict = "revise";
  else verdict = "hold";

  // 약속한 개수만큼 본문이 없으면 그대로 발행하지 않는다 — 개선(revise) 후 재심사로 돌린다
  if (pIssue && verdict === "publish") verdict = "revise";

  return {
    score,
    fakeRisk,
    verdict,
    issues: issues.slice(0, 8),
    note: [rv.note, risk.level !== "low" ? `위험: ${risk.note}` : ""].filter(Boolean).join(" / "),
    scores: rv.scores,
    machine,
    risk,
  };
}

// ================= 자동 개선 =================
const REVISE_SYSTEM = `너는 '오즈백' 매거진 에디터다. 편집장의 지적사항을 100% 반영해 글을 고쳐 쓴다.
- 지적된 부분만 정확히 고친다. 멀쩡한 부분은 건드리지 않는다.
- 원문에 없는 사실을 절대 새로 만들지 않는다. 확실하지 않으면 그 문장을 통째로 뺀다.
- '원문에 없는 수치/인용문' 지적은 반드시 '삭제'로 처리한다. 다른 숫자로 바꾸지 마라.
- 본문은 마크다운. 마지막은 반드시 '## 오즈백 한 줄 정리'.
  · 제목·요약이 "N가지"·"N개"처럼 개수를 약속하거나 항목을 N개 나열했으면, '## 소제목'을 정확히 그 N개 만든다 (한 줄 정리 제외). 개수를 못 채우면 제목·요약의 개수를 실제 담긴 수로 낮춘다 — 약속과 본문 개수는 반드시 일치시킨다.
  · 소제목 하나 = 독립된 정보 하나. 한 소제목 안에 여러 항목을 뭉치지 않는다 (카드뉴스·쇼츠가 소제목 단위로 쪼개지므로 뭉치면 뒤 항목이 잘려나간다).
  · 개수를 약속하지 않은 일반 이슈는 소제목 3~5개 (다룰 사실이 적으면 최소 2개).
- [빈약한 섹션 보강] 지적에 '빈약함·서론만·내용부족·어그로'가 있으면, 원문 사실 범위 안에서 각 섹션을 서론-본론-결론(무슨 일 → 왜/어떻게 → 그래서 뭐가 달라지나)으로 채운다. 서론에서 끝내지 말고, 훅·제목이 약속한 내용을 본문에서 실제로 다룬다. 단 채울 사실이 없으면 지어내지 말고 소제목 개수를 실제에 맞춰 줄인다.

출력은 반드시 아래 형식 그대로. 다른 말 금지.
<title>제목</title>
<summary>한 줄 요약</summary>
<hook>인스타 훅 한 줄</hook>
<body>
## 소제목
...
</body>`;

export async function reviseDraft(
  draft: Pick<DraftDraft, "title" | "summary" | "body">,
  review: Review,
  source: { title: string; context: string },
): Promise<{ title: string; summary: string; body: string; hook?: string }> {
  const user = `[원문 — 사실의 근거]
${source.title}
${source.context}

[편집장 지적사항]
${review.issues.map((i, n) => `${n + 1}. ${i}`).join("\n") || "- 전반적 품질 개선 필요"}
심사평: ${review.note}

[고칠 초안]
제목: ${draft.title}
요약: ${draft.summary}
본문:
${draft.body}

지적사항을 반영해 다시 써라. 지정된 태그 형식으로만 출력.`;

  const raw = await ask(REVISE_SYSTEM, user, { maxTokens: 3200, careful: true });
  const fixed = {
    title: pick(raw, "title") || draft.title,
    summary: pick(raw, "summary") || draft.summary,
    body: pick(raw, "body") || draft.body,
    hook: pick(raw, "hook") || undefined,
  };
  if (hasBrokenChars(fixed.title + fixed.body)) return { ...draft, hook: undefined };
  return fixed;
}

// ================= 발행 후 재감사 (1일 3회) =================
const AUDIT_SYSTEM = `너는 '오즈백' 매거진 편집장이다. 이미 발행된 글을 다시 읽고 문제를 찾아낸다.
독자가 이 글을 믿고 읽는다. 조금이라도 위험한 서술이 있으면 내려야 한다.

찾아낼 것:
- 근거 없이 단정한 문장 ("~로 밝혀졌다", "~가 확실하다"인데 출처 없음)
- 과장·선동적 표현, 본문이 뒷받침하지 않는 낚시 제목
- 앞뒤가 안 맞는 사실관계
- 특정 인물·집단 비방 소지, 혐오 뉘앙스
- 의료·금융·법률 관련 위험한 조언
- 시간이 지나 이미 틀린 정보가 된 부분
- 서론만 있고 알맹이가 없는 빈약한 섹션 — 훅·제목만 세고 본문이 부실하거나 서론에서 끝나 카드뉴스·영상으로 펼칠 내용이 부족한 글
- 읽기 힘든 문장, 깨진 글자나 이상한 기호

문제가 없으면 issues는 비우고 fakeRisk는 low, 점수는 높게 준다. 억지로 흠집 내지 마라.

출력은 반드시 아래 형식 그대로. 다른 말 금지.
<accuracy>숫자</accuracy>
<readability>숫자</readability>
<tone>숫자</tone>
<useful>숫자</useful>
<titleScore>숫자</titleScore>
<fakeRisk>low 또는 medium 또는 high</fakeRisk>
<issues>
- 지적사항
</issues>
<note>한 줄 심사평</note>`;

export async function auditPost(post: {
  title: string;
  summary: string;
  body: string;
  date: string;
  sources?: { url: string }[];
}): Promise<Review> {
  const user = `[발행일] ${post.date} (오늘: ${new Date().toISOString().slice(0, 10)})
[출처] ${post.sources?.[0]?.url ?? "없음"}

[제목] ${post.title}
[요약] ${post.summary}
[본문]
${post.body}

이 발행글을 재감사하라. 지정된 태그 형식으로만 출력.`;

  const rv = parseReview(
    await ask(AUDIT_SYSTEM, user, { maxTokens: 1200, careful: true }),
    "medium",
  );
  const { score, fakeRisk } = rv;

  // 이미 발행된 글도 '약속 개수 ≠ 본문 소제목'이면 개선 대상으로 돌린다 (기존 반토막 글 자동 교정)
  const pIssue = promiseIssue(post.title, post.summary, post.body);
  const issues = pIssue ? [pIssue, ...rv.issues].slice(0, 8) : rv.issues;

  let verdict: Verdict;
  if (fakeRisk === "high") verdict = "hold";
  else if (fakeRisk === "medium" || score < 70 || pIssue) verdict = "revise";
  else verdict = "publish";

  return { ...rv, issues, verdict };
}

// ================= 발행글 개선 (원문 없이) =================
export async function polishPost(
  post: { title: string; summary: string; body: string },
  review: Review,
): Promise<{ title: string; summary: string; body: string; hook?: string }> {
  const user = `[편집장 지적사항]
${review.issues.map((i, n) => `${n + 1}. ${i}`).join("\n") || "- 전반적 품질 개선"}
심사평: ${review.note}

[고칠 글]
제목: ${post.title}
요약: ${post.summary}
본문:
${post.body}

지적사항만 정확히 반영해 다시 써라. 없는 사실을 새로 만들지 마라 — 위험한 문장은 추가하지 말고 삭제하라. 지정된 태그 형식으로만 출력.`;

  const raw = await ask(REVISE_SYSTEM, user, { maxTokens: 3200, careful: true });
  const fixed = {
    title: pick(raw, "title") || post.title,
    summary: pick(raw, "summary") || post.summary,
    body: pick(raw, "body") || post.body,
    hook: pick(raw, "hook") || undefined,
  };
  if (hasBrokenChars(fixed.title + fixed.body)) return { ...post, hook: undefined };
  return fixed;
}
