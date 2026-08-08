// 품질·가짜뉴스 심사 — 3중 게이트
//
//   1단계 [기계 대조]   코드가 원문과 문자 그대로 대조 (수치·인용문 날조 탐지)
//   2단계 [팩트체커]    AI가 주장 하나하나에 원문 근거가 있는지 확인
//   3단계 [리스크 심사] 다른 AI가 명예훼손·선동·위험조언·편향만 따로 본다
//
// 세 관문을 전부 통과해야 자동 발행된다.
// 하나라도 걸리면 → 자동 개선 후 재심사, 또는 검수함 보류.
// 원칙: 의심스러우면 내보내지 않는다.

import { pick, hasBrokenChars } from "./ai.mjs";
import { ask } from "./llm.mjs";
import { machineVerify, verifyGuideTerms } from "./verify.mjs";

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
- title(10): 낚시가 아니면서 클릭하고 싶은가.
  훅(hook)도 여기서 같이 본다 — 훅은 릴스 첫 3초에 박히는 한 줄이라 '결론이 먼저' 나와야 한다.
  훅이 제목을 줄여 쓴 것이거나 주제만 소개하는 말(예: "맥 단축키 정리")이면 감점하고 issues에 적어라.

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
function parseReview(text, defaultRisk) {
  const n = (k, max) =>
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
  const fakeRisk = r === "low" || r === "medium" || r === "high" ? r : defaultRisk;
  const issues = pick(text, "issues")
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
  return { score, fakeRisk, verdict: "hold", issues, note: pick(text, "note"), scores };
}

function parseRisk(text) {
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
function worst(a, b) {
  const rank = { low: 0, medium: 1, high: 2 };
  return rank[a] >= rank[b] ? a : b;
}

// ================= 발행 전 심사 (3중 게이트) =================
// ================= 개수 약속 ↔ 본문 일치 검사 (기계, AI 없이) =================
// 왜: 제목/요약이 "5가지"라 해놓고 본문 ## 섹션이 3개뿐이면 카드뉴스·쇼츠도 반토막이 난다.
//     (buildCards가 본문 ## 소제목을 그대로 카드로 옮기기 때문)
//     ※ lib/quality.ts 와 항상 같은 규칙이어야 한다 (쌍둥이 파일).
const KNUM = { 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 둘: 2, 셋: 3, 넷: 4 };
const PROMISE_UNIT = "(?:가지방법|가지|단계|선)";
export function promisedCount(text) {
  if (!text) return 0;
  const t = String(text).replace(/,/g, "");
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
export function deliveredSections(body) {
  if (!body) return 0;
  return String(body).split("\n").filter((l) => l.trim().startsWith("## ") && !l.includes("한 줄 정리")).length;
}
function promiseIssue(title, summary, body) {
  const promised = promisedCount(`${title}  ${summary}`);
  if (promised < 2) return "";
  const delivered = deliveredSections(body);
  if (delivered >= promised) return "";
  return `제목/요약이 ${promised}개를 약속했는데 본문 소제목(## )은 ${delivered}개뿐 — 본문 소제목을 ${promised}개로 맞추거나, 제목·요약의 개수를 실제 담긴 ${delivered}개로 낮출 것 (카드뉴스·쇼츠가 소제목 단위로 잘려 뒤 항목이 사라진다)`;
}

// ================= 가이드(꿀팁) 형식 게이트 (기계, AI 없이) =================
// 왜: 가이드는 검색으로 들어온 사람이 첫 화면에서 답을 얻고 나가야 한다.
//     · [즉답]이 없으면 글자 벽이 되고, 구글이 '추천 스니펫'으로 뽑아 갈 것이 없다.
//     · [버전]이 없으면 "이거 옛날 얘기 아냐?"가 남는다.
//     · [Q]/[A] 짝이 깨지면 구글 FAQ 접힘 표시(FAQPage)가 아예 안 붙는다.
//     · 짧으면 검색 순위도 광고 심사도 통과 못 한다.
// ※ lib/quality.ts 와 항상 같은 규칙이어야 한다 (쌍둥이 파일).
const GUIDE_MIN_BODY = 1500; // 공백 포함

/** 이 글이 가이드(꿀팁)인가 — 분야가 꿀팁이거나, 본문이 가이드 표시로 시작하면 */
export function isGuideDraft(draft) {
  if (draft?.category === "꿀팁") return true;
  return /^\s*\[(즉답|버전|단계)\]/m.test(String(draft?.body ?? ""));
}

/** 가이드 형식 검사 — 고쳐야 할 것들을 사람 말로 돌려준다 (빈 배열이면 통과) */
export function guideFormatIssues(draft) {
  const body = String(draft?.body ?? "");
  const lines = body.split("\n").map((l) => l.trim());
  const issues = [];

  const count = (mark) => lines.filter((l) => new RegExp(`^\\[${mark}\\]\\s*\\S`).test(l)).length;

  // 1) 즉답 — 글 맨 위에 1개
  const answers = count("즉답");
  if (answers === 0) {
    issues.push(
      "글 맨 첫 줄에 '[즉답] …' 한 줄을 넣을 것 — 검색해서 온 사람이 스크롤 없이 답을 얻어야 한다 (60자 이내)",
    );
  } else {
    const firstReal = lines.filter(Boolean)[0] ?? "";
    if (!firstReal.startsWith("[즉답]"))
      issues.push("[즉답] 줄을 글 맨 위로 올릴 것 — 첫 화면에 답이 보여야 한다");
    if (answers > 1) issues.push("[즉답]은 글 전체에 1개만 둘 것");
  }

  // 2) 버전 — 언제·무엇 기준인지
  if (count("버전") === 0) {
    issues.push(
      "[즉답] 바로 아래에 '[버전] macOS 15 기준' 처럼 기준 버전을 한 줄 넣을 것 (날짜는 넣지 않는다)",
    );
  }

  // 3) Q/A — [Q] 바로 다음 줄이 [A]여야 짝이 된다
  let pairs = 0;
  let broken = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!/^\[Q\]\s*\S/.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && lines[j] === "") j++;
    if (j < lines.length && /^\[A\]\s*\S/.test(lines[j])) pairs++;
    else broken++;
  }
  const lonelyA = lines.filter((l) => /^\[A\]\s*\S/.test(l)).length - pairs;
  if (broken > 0 || lonelyA > 0)
    issues.push(`[Q]와 [A]의 짝이 맞지 않는다(${broken + Math.max(0, lonelyA)}건) — [Q] 바로 다음 줄에 반드시 [A]를 둘 것`);
  else if (pairs < 3)
    issues.push(`자주 묻는 질문을 [Q]/[A] 짝으로 3~5쌍 넣을 것 (지금 ${pairs}쌍) — 사람들이 실제로 검색창에 치는 문장으로`);

  // 4) 따라하기 순서 — 있다면 3줄 이상이어야 순서로 읽힌다
  const steps = count("단계");
  if (steps > 0 && steps < 3) issues.push(`[단계] 줄이 ${steps}개뿐 — 따라할 순서는 3~7줄로 나눌 것`);

  // 5) 분량
  if (body.length < GUIDE_MIN_BODY)
    issues.push(`본문이 ${body.length}자 — 가이드는 ${GUIDE_MIN_BODY}자 이상이어야 한다. 없는 사실을 지어내지 말고, 있는 내용을 더 자세히 풀어 쓸 것`);

  return issues;
}

export async function reviewDraft(
  draft,
  source,
) {
  // --- 1단계: 기계 대조 (AI 없이, 문자 그대로) ---
  const machine = machineVerify(draft, source.context, source.title);

  // 가이드(꿀팁)는 검사 항목이 다르다 — 단축키·메뉴 경로 대조 + 형식 게이트
  const guide = isGuideDraft(draft);
  const terms = guide ? verifyGuideTerms(draft.body, source.context) : null;
  const formatIssues = guide ? guideFormatIssues(draft) : [];

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

  // 가이드 전용 대조 — 근거에 없는 단축키·메뉴 경로는 뉴스의 '날조 인용문'과 같은 무게로 본다.
  // 독자가 그대로 따라 했는데 그 메뉴가 없으면 그 자리에서 신뢰가 끝난다.
  if (terms && !terms.ok) {
    fakeRisk = worst(fakeRisk, "medium");
    score = Math.min(score, 58);
    if (terms.unknownKeys.length)
      issues.unshift(`근거에 없는 단축키를 삭제할 것(다른 키로 바꾸지 말 것): ${terms.unknownKeys.slice(0, 3).join(" / ")}`);
    if (terms.unknownPaths.length)
      issues.unshift(`근거에 없는 메뉴 경로를 삭제할 것: ${terms.unknownPaths[0]}`);
  }

  // 개수 약속 ↔ 본문 소제목 일치 (기계 대조) — 어긋나면 지적에 얹어 개선을 유도한다
  const pIssue = promiseIssue(draft.title, draft.summary, draft.body);
  if (pIssue) issues.unshift(pIssue);

  // 가이드 형식 게이트 — 지적으로 얹는다 (발행 여부는 아래에서 판단)
  if (formatIssues.length) issues.push(...formatIssues);

  let verdict;
  if (fakeRisk === "high") verdict = "hold";
  else if (fakeRisk === "medium") verdict = score >= HOLD_SCORE ? "revise" : "hold";
  else if (score >= PASS_SCORE) verdict = "publish";
  else if (score >= HOLD_SCORE) verdict = "revise";
  else verdict = "hold";

  // 약속한 개수만큼 본문이 없으면 그대로 발행하지 않는다 — 개선(revise) 후 재심사로 돌린다
  if (pIssue && verdict === "publish") verdict = "revise";

  // 가이드 형식이 어긋나면 그대로 발행하지 않는다 — 한 번 고쳐 쓰고 다시 본다.
  // (여기서 막지 않으면 즉답도 FAQ도 없는 글자 벽이 그대로 나가고, 그러면 붙일 구조화 데이터가 없다)
  if (formatIssues.length && verdict === "publish") verdict = "revise";

  return {
    score,
    fakeRisk,
    verdict,
    issues: issues.slice(0, 8),
    note: [rv.note, risk.level !== "low" ? `위험: ${risk.note}` : ""].filter(Boolean).join(" / "),
    scores: rv.scores,
    machine,
    risk,
    guide: guide ? { terms, formatIssues } : undefined,
  };
}

// ================= 자동 개선 =================
const REVISE_SYSTEM = `너는 '오즈백' 매거진 에디터다. 편집장의 지적사항을 100% 반영해 글을 고쳐 쓴다.
- 지적된 부분만 정확히 고친다. 멀쩡한 부분은 건드리지 않는다.
- 원문에 없는 사실을 절대 새로 만들지 않는다. 확실하지 않으면 그 문장을 통째로 뺀다.
- '원문에 없는 수치/인용문' 지적은 반드시 '삭제'로 처리한다. 다른 숫자로 바꾸지 마라.
- 본문은 마크다운. 마지막은 반드시 '## 오즈백 한 줄 정리'.
- 원래 글의 소제목 개수와 분량을 그대로 유지한다. 지적된 곳만 고치고, 멀쩡한 절을 삭제해 글을 줄이지 마라.
  (꿀팁 같은 긴 정보성 글을 짧게 줄이면 검색 유입과 광고 심사에서 손해다)
- 표(| 항목 | 설명 |)가 있으면 형식을 깨지 말고 그대로 둔다.
- 훅(hook)이 지적됐으면 '결론 먼저'로 고친다 — 첫 줄에서 독자가 얻는 결과가 끝나야 한다(예: "이거 끄면 배터리 2시간 더 갑니다").
  제목을 줄여 쓴 것은 훅이 아니다. 원문에 없는 효과·수치를 새로 만들어 넣지는 마라.

【가이드(꿀팁) 글이면 도식 표시를 지켜라 — 한 줄에 하나씩, 그 줄에 다른 문장을 붙이지 않는다】
  [즉답] 답 한두 문장 (글 맨 첫 줄, 1개, 60자 이내)
  [버전] macOS 15 세쿼이아 기준 (즉답 바로 밑, 1개. 날짜 없음)
  [단계] 시스템 설정을 연다 (연속 3~7줄. 번호는 쓰지 마라 — 홈페이지가 매긴다)
  [확인] 케이블을 다른 포트에 꽂아봤다 (연속 2~6줄)
  [Q] 질문 한 줄 ← 바로 다음 줄에 반드시 [A] 답. 글 끝에 3~5쌍을 모은다
  [대안] 이 방법이 안 될 때의 차선책 / [핵심] 기억할 한 줄 / [주의] 조심할 점
  [키] Command + Control + Q / [경로] 시스템 설정 > 키보드 > 단축키
  ※ [키]와 [경로]에 쓰는 글자는 원문(근거)에 그대로 있는 것만 쓴다. 없으면 그 줄을 통째로 뺀다.
  ※ '지적사항'이 [즉답]·[버전]·[Q]/[A]를 넣으라고 하면, 원문에 있는 내용만으로 만들어 넣어라.

출력은 반드시 아래 형식 그대로. 다른 말 금지.
<title>제목</title>
<summary>한 줄 요약</summary>
<hook>인스타 훅 한 줄</hook>
<body>
## 소제목
...
</body>`;

export async function reviseDraft(
  draft,
  review,
  source,
) {
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

  // 원문이 길면 고쳐 쓸 여유도 그만큼 줘야 한다 (안 그러면 뒤가 잘려 글이 짧아진다)
  const reviseTokens = draft.body.length > 1400 ? 4200 : 2400;
  const raw = await ask(REVISE_SYSTEM, user, { maxTokens: reviseTokens, careful: true });
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

export async function auditPost(post) {
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

  // 이미 발행된 가이드도 형식 게이트를 통과해야 한다.
  // 여기서 걸리면 내리는 게 아니라 '고쳐서 발행 유지'(revise)다 — 옛 가이드를 시간이 지나며 끌어올린다.
  const gIssues = isGuideDraft(post) ? guideFormatIssues(post) : [];
  if (gIssues.length) rv.issues = [...(rv.issues ?? []), ...gIssues].slice(0, 8);

  let verdict;
  if (fakeRisk === "high") verdict = "hold";
  else if (fakeRisk === "medium" || score < 70 || gIssues.length) verdict = "revise";
  else verdict = "publish";

  // 걸린 게 '형식'뿐인가 — 사실관계는 멀쩡한데 [즉답]·[버전]·[Q]/[A]·분량 같은 모양새만 어긋난 경우.
  // 이건 독자를 속이지 않는다. 그런데도 내리면 검색 순위와 인스타 공급만 잃는다.
  // (2026-08-08 실측: 검수함에 밀린 8월 글 23건 중 21건이 여기였다. AI 심사는 100점을 준 글까지 있었다)
  const formatOnly = verdict === "revise" && fakeRisk === "low" && score >= 70 && gIssues.length > 0;

  return { ...rv, verdict, formatOnly, formatIssues: gIssues };
}

// ================= 발행글 개선 (원문 없이) =================
export async function polishPost(
  post,
  review,
) {
  const user = `[편집장 지적사항]
${review.issues.map((i, n) => `${n + 1}. ${i}`).join("\n") || "- 전반적 품질 개선"}
심사평: ${review.note}

[고칠 글]
제목: ${post.title}
요약: ${post.summary}
본문:
${post.body}

지적사항만 정확히 반영해 다시 써라. 없는 사실을 새로 만들지 마라 — 위험한 문장은 추가하지 말고 삭제하라. 지정된 태그 형식으로만 출력.`;

  const raw = await ask(REVISE_SYSTEM, user, { maxTokens: 2400, careful: true });
  const fixed = {
    title: pick(raw, "title") || post.title,
    summary: pick(raw, "summary") || post.summary,
    body: pick(raw, "body") || post.body,
    hook: pick(raw, "hook") || undefined,
  };
  if (hasBrokenChars(fixed.title + fixed.body)) return { ...post, hook: undefined };
  return fixed;
}
