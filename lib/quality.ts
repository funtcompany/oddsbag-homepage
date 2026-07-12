// AI 품질 심사관 — 발행 전 '게이트'
//
// 오즈백은 실시간 발행을 하지만, 아무 글이나 나가면 안 된다.
// 그래서 AI가 쓴 초안을 '다른 AI 심사관'이 원문과 대조해 검증한다.
//
//  · 팩트체크  — 원문에 없는 사실/수치를 지어내지 않았는가 (환각 검사)
//  · 가짜뉴스  — 출처 신뢰도, 미확인 주장, 자극적 프레이밍
//  · 품질점수  — 정확성 40 / 가독성 20 / 오즈백 톤 15 / 유용성 15 / 제목 10
//
// 결과에 따라: 즉시 발행 / 자동 개선 후 재심사 / 검수함 보류

import { pick, hasBrokenChars, type DraftDraft } from "@/lib/ai";

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-5";

export type Verdict = "publish" | "revise" | "hold";
export type FakeRisk = "low" | "medium" | "high";

export interface Review {
  score: number; // 0~100
  fakeRisk: FakeRisk;
  verdict: Verdict;
  issues: string[]; // 지적사항 (학습 루프에 축적)
  note: string; // 사람이 읽을 한 줄 심사평
  scores: {
    accuracy: number;
    readability: number;
    tone: number;
    useful: number;
    title: number;
  };
}

const PASS_SCORE = 78; // 이 이상 + 위험 낮음 → 즉시 발행
const HOLD_SCORE = 60; // 이 미만 → 바로 검수함 (개선 시도 안 함)

const REVIEW_SYSTEM = `너는 '오즈백(ODDSBAG)' 매거진의 편집장이자 팩트체커다.
AI 에디터가 쓴 초안을, 그 초안이 참고한 '원문 정보'와 대조해 엄격하게 심사한다.
독자에게 잘못된 정보가 나가는 것이 이 매체의 가장 큰 리스크다. 관대하게 매기지 마라.

[1] 팩트체크 (가장 중요)
- 원문에 없는 사실·수치·인용·날짜를 초안이 지어냈는가? (환각) → 발견 시 accuracy 20점 이하
- 원문이 '추측/전망'이라고 한 것을 초안이 '확정 사실'처럼 단정했는가? → 감점
- 통계·금액·인명·기관명이 원문과 다른가? → 큰 감점

[2] 가짜뉴스 위험 (fakeRisk)
- high: 검증되지 않은 주장을 사실로 서술 / 자극적·선동적 프레이밍 / 원문 출처가 불분명한데 단정적 / 특정인 명예훼손 소지 / 의료·금융 관련 근거 없는 조언
- medium: 확인 필요한 부분이 있으나 큰 왜곡은 없음 / 표현이 다소 과장됨
- low: 원문 사실 범위 안에서만 서술, 불확실한 건 불확실하다고 표기

[3] 품질 (각 항목 만점 기준)
- accuracy(40): 원문 사실과의 일치도, 환각 없음
- readability(20): 문장이 짧고 명확한가, 소제목 구조가 살아있는가
- tone(15): 오즈백 톤(위트 있되 쓸모 있게, 중립적, 따뜻함)
- useful(15): 독자가 얻어가는 게 있는가. 뻔한 소리만 늘어놓지 않았는가
- title(10): 제목이 낚시가 아니면서 클릭하고 싶은가

[4] issues
- 구체적으로 뭘 고쳐야 하는지 짧은 문장으로. (예: "원문에 없는 '3배 증가' 수치를 삭제할 것")
- 문제가 없으면 빈 배열.

score = accuracy + readability + tone + useful + title (0~100)

출력은 반드시 아래 형식 그대로. 다른 말 금지.
<accuracy>숫자</accuracy>
<readability>숫자</readability>
<tone>숫자</tone>
<useful>숫자</useful>
<titleScore>숫자</titleScore>
<fakeRisk>low 또는 medium 또는 high</fakeRisk>
<issues>
- 지적사항 1
- 지적사항 2
</issues>
<note>한 줄 심사평</note>`;

async function claude(system: string, user: string, maxTokens = 1200): Promise<string> {
  if (!API_KEY) throw new Error("ANTHROPIC_API_KEY 미설정");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = (await res.json()) as { content?: { text?: string }[] };
  return data.content?.map((c) => c.text ?? "").join("").trim() ?? "";
}

// 심사 결과 태그 파싱 (JSON은 본문 줄바꿈에 쉽게 깨진다)
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
    .slice(0, 6);
  return { score, fakeRisk, verdict: "hold", issues, note: pick(text, "note"), scores };
}

// ---- 심사 ----
export async function reviewDraft(
  draft: Pick<DraftDraft, "title" | "summary" | "body">,
  source: { title: string; context: string; from: string; url?: string },
): Promise<Review> {
  const user = `[원문 정보 — 이것만이 사실의 근거다]
수집처: ${source.from}
원문 제목: ${source.title}
원문 내용: ${source.context}
${source.url ? `원문 링크: ${source.url}` : ""}

[심사할 초안]
제목: ${draft.title}
요약: ${draft.summary}
본문:
${draft.body}

위 초안을 원문과 대조해 심사하라. 지정된 태그 형식으로만 출력.`;

  const rv = parseReview(await claude(REVIEW_SYSTEM, user), "high");

  // 판정: 가짜뉴스 위험이 남아 있으면 절대 자동 발행하지 않는다
  let verdict: Verdict;
  if (rv.fakeRisk === "high") verdict = "hold";
  else if (rv.fakeRisk === "medium") verdict = rv.score >= HOLD_SCORE ? "revise" : "hold";
  else if (rv.score >= PASS_SCORE) verdict = "publish";
  else if (rv.score >= HOLD_SCORE) verdict = "revise";
  else verdict = "hold";

  return { ...rv, verdict };
}

// ---- 지적사항을 반영해 자동 개선 ----
const REVISE_SYSTEM = `너는 '오즈백' 매거진 에디터다. 편집장의 지적사항을 100% 반영해 글을 고쳐 쓴다.
- 지적된 부분만 정확히 고친다. 멀쩡한 부분은 건드리지 않는다.
- 원문에 없는 사실을 절대 새로 만들지 않는다. 확실하지 않으면 그 문장을 빼라.
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

  const raw = await claude(REVISE_SYSTEM, user, 2400);
  const fixed = {
    title: pick(raw, "title") || draft.title,
    summary: pick(raw, "summary") || draft.summary,
    body: pick(raw, "body") || draft.body,
    hook: pick(raw, "hook") || undefined,
  };
  // 고치다가 글자가 깨졌으면 원래 글을 유지한다 (깨진 글을 내보내지 않는다)
  if (hasBrokenChars(fixed.title + fixed.body)) return { ...draft, hook: undefined };
  return fixed;
}

// ---- 발행 후 재감사 (1일 3회 점검 크론) ----
// 원문 대조 대신 '글 자체'를 검증한다: 확인 불가한 단정, 과장, 논리 오류, 낡은 정보.
const AUDIT_SYSTEM = `너는 '오즈백' 매거진 편집장이다. 이미 발행된 글을 다시 읽고 문제를 찾아낸다.
독자가 이 글을 믿고 읽는다. 조금이라도 위험한 서술이 있으면 내려야 한다.

찾아낼 것:
- 근거 없이 단정한 문장 (출처 없이 "~로 밝혀졌다", "~가 확실하다")
- 과장·선동적 표현, 낚시성 제목
- 사실관계가 앞뒤로 안 맞는 부분
- 특정 인물·집단 비방 소지
- 의료/금융/법률 관련 위험한 조언
- 시간이 지나 이미 틀린 정보가 된 부분
- 문장이 어색하거나 읽기 힘든 부분

문제가 없으면 issues는 비워두고, fakeRisk는 low, 점수는 높게 준다. 억지로 흠집 내지 마라.

score = accuracy + readability + tone + useful + title (각각 40/20/15/15/10 만점)

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

  const rv = parseReview(await claude(AUDIT_SYSTEM, user), "medium");
  const { score, fakeRisk } = rv;

  // 재감사는 이미 발행된 글이므로 기준이 다르다:
  //  · 위험 high → 즉시 내림
  //  · 위험 medium 또는 70점 미만 → 개선 시도, 실패 시 내림
  let verdict: Verdict;
  if (fakeRisk === "high") verdict = "hold";
  else if (fakeRisk === "medium" || score < 70) verdict = "revise";
  else verdict = "publish";

  return { ...rv, verdict };
}

// ---- 발행글 개선 (재감사 지적 반영, 원문 없이) ----
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

  const raw = await claude(REVISE_SYSTEM, user, 2400);
  const fixed = {
    title: pick(raw, "title") || post.title,
    summary: pick(raw, "summary") || post.summary,
    body: pick(raw, "body") || post.body,
    hook: pick(raw, "hook") || undefined,
  };
  if (hasBrokenChars(fixed.title + fixed.body)) return { ...post, hook: undefined };
  return fixed;
}
