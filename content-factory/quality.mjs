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
import { machineVerify } from "./verify.mjs";

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
- readability(20): 문장이 짧고 명확한가, 소제목 구조가 살아있는가
- tone(15): 오즈백 톤 (위트 있되 쓸모 있게, 중립적, 따뜻함)
- useful(15): 독자가 얻어가는 게 있는가
- title(10): 낚시가 아니면서 클릭하고 싶은가

[issues]
- 무엇을 어떻게 고쳐야 하는지 구체적으로. (예: "원문에 없는 '3배 증가'를 삭제할 것")
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
export async function reviewDraft(
  draft,
  source,
) {
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

  let verdict;
  if (fakeRisk === "high") verdict = "hold";
  else if (fakeRisk === "medium") verdict = score >= HOLD_SCORE ? "revise" : "hold";
  else if (score >= PASS_SCORE) verdict = "publish";
  else if (score >= HOLD_SCORE) verdict = "revise";
  else verdict = "hold";

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
- 본문은 마크다운. '## 소제목' 2~3개, 마지막은 반드시 '## 오즈백 한 줄 정리'.

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

  const raw = await ask(REVISE_SYSTEM, user, { maxTokens: 2400, careful: true });
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

  let verdict;
  if (fakeRisk === "high") verdict = "hold";
  else if (fakeRisk === "medium" || score < 70) verdict = "revise";
  else verdict = "publish";

  return { ...rv, verdict };
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
