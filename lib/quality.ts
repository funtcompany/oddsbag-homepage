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
import { machineVerify, verifyGuideTerms, type MachineCheck, type GuideTermCheck } from "@/lib/verify";

// skip — 심사관 답을 읽지 못해 '판정을 못 한' 상태. 발행글을 건드리지 않고 다음 회차로 넘긴다.
//        (0점과 구분하려고 2026-08-11 에 추가. 이 구분이 없어서 멀쩡한 글 218편이 내려갔다)
export type Verdict = "publish" | "revise" | "hold" | "skip";
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
  /** 심사관 답에서 점수 칸을 하나라도 읽었는가. false 면 이 심사는 쓸 수 없는 답이다 */
  parsed: boolean;
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
  formatOnly?: boolean; // 사실은 멀쩡하고 가이드 형식만 어긋났다 → 내리지 않는다
  formatIssues?: string[]; // 그때 무엇이 어긋났는지
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

// ================= 2단계-가이드: 가이드 전용 팩트체커 =================
//
// 【2026-08-12 신설 — 꿀팁 통과율이 10%(71편 써서 7편 생존)였던 진짜 이유】
//   가이드의 근거(facts)는 밖에서 긁어온 남의 기사가 아니다. 우리가 공식 안내문에서
//   직접 확인해 적어둔 사실 메모다. 그런데 위의 FACT_SYSTEM(뉴스용)은 그걸
//   「원문 기사」라고 부르며 "원문에 없는 사실·수치를 만들어냈는가"를 묻는다.
//   근거 263자로 본문 1,500자를 쓰라고 시켜놓고, 늘어난 1,200자를 전부 환각으로 세는 구조였다.
//   그래서 100점·91점을 받고도 검수함에 갇힌 글이 생겼다.
//
//   가이드는 근거를 「풀어 쓰는」 것이 일이다. 설명·예시·주의사항을 붙이는 것은 환각이 아니다.
//   대신 가이드에서 지어내면 안 되는 것은 따로 있다 — 단축키·메뉴 이름·수수료·기한 같은
//   「독자가 그대로 따라 하는 값」이다. 그것만 뉴스의 날조 인용문과 같은 무게로 본다.
const GUIDE_FACT_SYSTEM = `너는 '오즈백(ODDSBAG)' 매거진의 가이드 심사관이다.
심사 대상은 뉴스 기사가 아니라 독자가 따라 하는 안내글(가이드·꿀팁)이다. 뉴스와 다른 잣대로 본다.

[먼저 알아둘 것 — 이걸 착각하면 멀쩡한 글을 떨어뜨린다]
- 아래 [검증된 근거]는 남의 기사가 아니라, 우리가 공식 안내에서 직접 확인해 적어둔 사실 메모다.
  짧을 수 있다. 근거가 짧다는 것은 글의 결함이 아니다.
- 가이드는 그 근거를 독자가 따라 할 수 있게 풀어 쓴 글이다.
  설명을 덧붙이고, 예를 들고, 주의할 점을 적고, 순서를 나누는 것은 이 글이 해야 할 일이다.
  그것을 '원문에 없는 내용'이라고 감점하지 마라.

[진짜로 잡아야 할 것 — accuracy는 오직 이것으로만 깎는다]
1. 근거와 어긋남: 근거가 A라고 적었는데 글은 B라고 썼다
2. 없는 절차 지어내기: 근거에 없는 단축키·버튼 이름·메뉴 경로·화면 이름을 만들어냈다
3. 따라 하면 손해 보는 값의 날조: 수수료·기한·법정 기간·연락처·기관명·요금처럼
   틀리면 독자가 실제로 손해를 보는 값을 근거 없이 적었다
4. 되는 것과 안 되는 것을 뒤집음 (인터넷으로 되는데 안 된다고 썼거나 그 반대)
5. 지난 것을 지금 것처럼: 없어진 메뉴·폐지된 제도를 현재형으로 썼다

[환각이 아닌 것 — 절대 감점하지 마라]
- 근거를 풀어 쓴 설명, 배경 한 줄, 비유
- "10분이면 됩니다" "3~5개" 같은 대략의 분량 표현
- 덧붙인 주의사항, 하지 말아야 할 것
- 상식 수준의 부연 (예: 설정 앱은 톱니바퀴 모양이다 / 다시 켜면 대부분 해결된다)

[fakeRisk 판정]
- high: 위 1~5 중 하나가 실제로 있다. 그대로 따라 하면 안 되는 절차가 적혀 있다
- medium: 확인이 필요한 구체적 값이 하나 있다 / 근거보다 눈에 띄게 단정적으로 썼다
- low: 구체적 절차와 값이 전부 근거 안에 있고, 근거 밖의 것은 설명·부연뿐이다
※ 근거가 짧다는 이유만으로 medium 이상을 주지 마라. 지적할 것이 없으면 low 다.

[점수]
- accuracy(40): 위 기준으로만 매긴다. 위 1~5에 걸리는 게 없으면 40점을 줘라.
- readability(20): 검색해서 온 사람이 스크롤 없이 답을 얻는가. 순서가 끊겨 있는가.
- tone(15): 오즈백 톤 (군말 없이 할 일부터. 겁주지 않고 정확하게)
- useful(15): 읽고 나면 실제로 해결되는가. 안 될 때 어떻게 하는지까지 있는가.
- title(10): 사람이 검색창에 실제로 치는 말로 시작하는가. 낚시가 아닌가.

[issues]
- 무엇을 어떻게 고쳐야 하는지 구체적으로. (예: "근거에 없는 단축키 ⌘⇧5 를 삭제할 것")
- 문제가 없으면 비워둬라. 억지로 흠집 내지 마라.

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
//
// 【2026-08-11 — content-factory/quality.mjs 와 같은 자리다. 둘을 반드시 같이 고친다】
//   심사관(AI) 답에서 점수를 못 찾으면 `|| 0` 때문에 글이 0점이 되고, 위험도는 medium 으로 가정됐다.
//   재감사에서 그 둘이면 '고쳐쓰기 → 또 실패 → 내림'이라, 심사관이 삐끗한 것만으로 멀쩡한 글이 내려갔다.
//   그래서 「0점」과 「점수를 못 읽었다」를 구분한다. 못 읽은 답은 그 글이 나쁘다는 증거가 아니다.
const SCORE_KEYS: [string, number][] = [
  ["accuracy", 40],
  ["readability", 20],
  ["tone", 15],
  ["useful", 15],
  ["titleScore", 10],
];

/** 파서 결과 — Review 에 「위험도 태그를 실제로 읽었는가」를 더한 것 */
interface ParsedReview extends Review {
  /** <fakeRisk> 태그를 실제로 읽었는가. false 면 fakeRisk 는 defaultRisk 로 '가정'한 값이다 */
  riskRead: boolean;
}

function parseReview(text: string, defaultRisk: FakeRisk): ParsedReview {
  const raw = (k: string) => String(pick(text, k) ?? "").trim();
  const n = (k: string, max: number) =>
    Math.max(0, Math.min(max, parseInt(raw(k) || "0", 10) || 0));
  const scores = {
    accuracy: n("accuracy", 40),
    readability: n("readability", 20),
    tone: n("tone", 15),
    useful: n("useful", 15),
    title: n("titleScore", 10),
  };
  const score = scores.accuracy + scores.readability + scores.tone + scores.useful + scores.title;
  const r = pick(text, "fakeRisk").toLowerCase();
  const riskRead = r === "low" || r === "medium" || r === "high";
  const fakeRisk: FakeRisk = riskRead ? (r as FakeRisk) : defaultRisk;
  const issues = pick(text, "issues")
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
  // 점수 칸을 하나도 못 읽었으면 이 심사는 쓸 수 없는 답이다. (위험도만 읽힌 경우도 점수는 0이라 마찬가지)
  const 읽은점수칸 = SCORE_KEYS.filter(([k]) => raw(k) !== "").length;
  const parsed = 읽은점수칸 > 0;
  return {
    score, fakeRisk, verdict: "hold", issues, note: pick(text, "note"), scores,
    parsed, riskRead,
  };
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

// ================= 가이드(꿀팁) 형식 게이트 (기계, AI 없이) =================
// 왜: 가이드는 검색으로 들어온 사람이 첫 화면에서 답을 얻고 나가야 한다.
//     · [즉답]이 없으면 글자 벽이 되고, 구글이 '추천 스니펫'으로 뽑아 갈 것이 없다.
//     · [버전]이 없으면 "이거 옛날 얘기 아냐?"가 남는다.
//     · [Q]/[A] 짝이 깨지면 구글 FAQ 접힘 표시(FAQPage)가 아예 안 붙는다.
//     · 짧으면 검색 순위도 광고 심사도 통과 못 한다.
// ※ content-factory/quality.mjs 와 항상 같은 규칙이어야 한다 (쌍둥이 파일).
const GUIDE_MIN_BODY = 1500; // 공백 포함

/** 이 글이 가이드(꿀팁)인가 — 분야가 꿀팁이거나, 본문이 가이드 표시로 시작하면 */
export function isGuideDraft(draft: { category?: string; body?: string }): boolean {
  if (draft?.category === "꿀팁") return true;
  return /^\s*\[(즉답|버전|단계)\]/m.test(String(draft?.body ?? ""));
}

/** 가이드 형식 검사 — 고쳐야 할 것들을 사람 말로 돌려준다 (빈 배열이면 통과) */
export function guideFormatIssues(draft: { body?: string }): string[] {
  const body = String(draft?.body ?? "");
  const lines = body.split("\n").map((l) => l.trim());
  const issues: string[] = [];

  const count = (mark: string) => lines.filter((l) => new RegExp(`^\\[${mark}\\]\\s*\\S`).test(l)).length;

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
    issues.push(
      `[Q]와 [A]의 짝이 맞지 않는다(${broken + Math.max(0, lonelyA)}건) — [Q] 바로 다음 줄에 반드시 [A]를 둘 것`,
    );
  else if (pairs < 3)
    issues.push(
      `자주 묻는 질문을 [Q]/[A] 짝으로 3~5쌍 넣을 것 (지금 ${pairs}쌍) — 사람들이 실제로 검색창에 치는 문장으로`,
    );

  // 4) 따라하기 순서 — 있다면 3줄 이상이어야 순서로 읽힌다
  const steps = count("단계");
  if (steps > 0 && steps < 3) issues.push(`[단계] 줄이 ${steps}개뿐 — 따라할 순서는 3~7줄로 나눌 것`);

  // 5) 분량
  if (body.length < GUIDE_MIN_BODY)
    issues.push(
      `본문이 ${body.length}자 — 가이드는 ${GUIDE_MIN_BODY}자 이상이어야 한다. 없는 사실을 지어내지 말고, 있는 내용을 더 자세히 풀어 쓸 것`,
    );

  return issues;
}

// ================= 제목 게이트 (기계, 2026-08-12 신설) =================
//
// 【왜 만드나 — 우리 채널 실측】
//   조회 100회 이하 7편 중 4편이 「~일 수도 있다」 「~하는 법을 배우다」 류 추측·에세이형이었다.
//   조회 상위 7편에는 0편이다. 최저 기록(3회)이 「내 전기요금이 오른 이유, AI일 수도 있다」였다.
//   반대로 500회를 넘긴 7편은 7/7 이 「대상 이름 + 무엇을」로 시작했다.
//   유형별 중앙값도 갈린다 — 순위·수치형 710회 vs 에세이형 75회.
//
//   그래서 사람이 검색창에 안 치는 문형을 기계가 먼저 막는다.
//   ※ 막는다 = 폐기가 아니라 「고쳐 쓰기(revise)」다. 제목은 본문을 버리지 않고 고칠 수 있다.
const TITLE_BANNED: { re: RegExp; why: string }[] = [
  { re: /일\s?수(도|있|를)/, why: "「~일 수도 있다」는 추측형 — 검증 가능한 사실로 바꿀 것" },
  { re: /(라는|이라는)\s?(이야기|얘기)/, why: "「~라는 이야기」는 전언형 — 무엇이 어떻게 됐는지로 바꿀 것" },
  { re: /배우(다|는|자)\b|에게\s?배(우다|운다)/, why: "「~에게 배우다」는 교훈형 — 독자가 할 일로 바꿀 것" },
  { re: /된\s?시대|의\s?시대/, why: "「~된 시대」는 총평형 — 구체적인 대상으로 바꿀 것" },
  { re: /이유(는)?\s*[?？]?$/, why: "「~의 이유」로 끝내지 말 것 — 그 이유가 무엇인지를 제목에 적을 것" },
  { re: /알고\s?계셨나요|아시나요|아세요\?/, why: "질문으로 낚지 말 것 — 답을 제목에 적을 것" },
  { re: /충격|경악|발칵|소름|난리/, why: "자극어는 낚시로 읽힌다 — 사실만 적을 것" },
];

// 제목 첫머리에 오면 검색어가 뒤로 밀리는 말들. 앞 3단어 안에 검색어를 두라는 규칙의 기계판.
const TITLE_LEAD_BAN = [
  "그", "이", "저", "요즘", "사실", "의외로", "놀랍게도", "알고", "결국",
  "드디어", "과연", "왜", "만약", "혹시", "이제", "바로",
];

/** 제목 게이트 — 고쳐야 할 것을 사람 말로 돌려준다 (빈 배열이면 통과) */
export function titleIssues(draft: { title?: string }): string[] {
  const title = String(draft?.title ?? "").trim();
  const issues: string[] = [];
  if (!title) return issues;

  for (const b of TITLE_BANNED) {
    if (b.re.test(title)) {
      issues.push(`제목: ${b.why}`);
      break; // 한 번만 지적한다 — 지적이 겹쳐 쌓이면 개선 프롬프트가 흐려진다
    }
  }

  const 첫어절 = title.split(/\s+/)[0]?.replace(/[,·.…!?]/g, "") ?? "";
  if (TITLE_LEAD_BAN.includes(첫어절))
    issues.push(
      `제목이 「${첫어절}」로 시작한다 — 사람이 검색창에 치는 말(대상 이름·기관·제품명)을 앞 3단어 안에 둘 것`,
    );

  return issues;
}

// ================= 발행 전 심사 (3중 게이트) =================
export async function reviewDraft(
  draft: Pick<DraftDraft, "title" | "summary" | "body"> & { category?: string },
  source: { title: string; context: string; from: string; url?: string },
): Promise<Review> {
  // 가이드(꿀팁)는 검사 항목이 다르다 — 단축키·메뉴 경로 대조 + 형식 게이트
  const guide = isGuideDraft(draft);

  // --- 1단계: 기계 대조 (AI 없이, 문자 그대로) ---
  //
  // 【2026-08-12 — 가이드에서 숫자 대조를 뺀다】
  //   machineVerify 는 본문의 두 자리 이상 숫자가 근거에 없으면 전부 '날조'로 센다.
  //   뉴스에서는 맞는 검사다. 가이드에서는 「[버전] macOS 15」 「3~5쌍」 「10분」 같은 말이
  //   그대로 걸려서 score 가 55로 깎이고 medium 이 붙는다. 60점 문턱 아래라 verdict 는 hold.
  //   즉 가이드는 아무리 잘 써도 발행이 수학적으로 불가능했다.
  //   대신 가이드에는 verifyGuideTerms(단축키·메뉴 경로 대조)가 이미 있고, 그게 진짜 검사다.
  //   ※ 인용문 날조는 가이드에도 그대로 적용한다 — 남의 말을 지어내는 건 종류를 안 가린다.
  const machineRaw = machineVerify(draft, source.context, source.title);
  const machine: MachineCheck = guide
    ? {
        ...machineRaw,
        fabricatedNumbers: [],
        ok: machineRaw.fabricatedQuotes.length === 0,
        note: machineRaw.fabricatedQuotes.length ? "근거에 없는 인용문" : "인용문 일치",
      }
    : machineRaw;

  const terms: GuideTermCheck | null = guide ? verifyGuideTerms(draft.body, source.context) : null;
  const formatIssues = guide ? guideFormatIssues(draft) : [];

  const newsFactUser = `[원문 기사 — 오직 이것만이 사실의 근거다]
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

  const guideFactUser = `[검증된 근거 — 공식 안내에서 우리가 직접 확인해 적어둔 사실 메모]
출처: ${source.from}
주제: ${source.title}
근거:
${source.context}

[심사할 가이드 초안]
제목: ${draft.title}
요약: ${draft.summary}
본문:
${draft.body}
${
  machine.ok
    ? ""
    : `\n[기계 대조 결과 — 이미 확인된 문제]\n${machine.note}`
}${
  terms && !terms.ok
    ? `\n[용어 대조 결과 — 이미 확인된 문제]\n${terms.note}`
    : ""
}

위 초안을 근거와 대조해 심사하라.
근거를 풀어 쓴 설명·예시·주의사항은 환각이 아니다. 지정된 태그 형식으로만 출력.`;

  const riskUser = `[검토할 글]
제목: ${draft.title}
요약: ${draft.summary}
본문:
${draft.body}

[원문 출처] ${source.from} ${source.url ?? ""}
${
  guide
    ? `
[이 글의 성격] 공식 안내에 있는 절차를 순서대로 알려주는 '따라 하는 안내글'이다.
절차를 알려주는 것 자체는 '위험한 조언'이 아니다.
의료·투자·법률에서 판단을 대신 내려주는 서술(예: "이 약을 드세요", "지금 사세요")만 잡아라.`
    : ""
}
이 글을 내보냈을 때 생길 위험만 심사하라. 지정된 태그 형식으로만 출력.`;

  // --- 2·3단계: 팩트체커와 리스크 심사관이 서로 모른 채 독립적으로 심사 ---
  const [factRaw, riskRaw] = await Promise.all([
    ask(guide ? GUIDE_FACT_SYSTEM : FACT_SYSTEM, guide ? guideFactUser : newsFactUser, {
      maxTokens: 1200,
      careful: true,
    }),
    ask(RISK_SYSTEM, riskUser, { maxTokens: 700, careful: true }),
  ]);

  const rv = parseReview(factRaw, "high");
  const risk = parseRisk(riskRaw);

  // 【위험도 태그를 못 읽었을 때】 점수는 읽혔는데 <fakeRisk> 태그만 빠진 답이 자주 나온다
  //   (무료 AI 한도가 밀려 약한 예비 엔진으로 넘어가면 형식이 깨진다).
  //   그때 '가장 위험함'으로 가정하면 멀쩡한 글이 검수함으로 직행한다 —
  //   2026-08-11 에 점수 축에서 고친 것과 똑같은 사고가 위험도 축에 그대로 남아 있었다.
  //   점수를 읽었다면 그 답은 쓸 수 있는 답이다. 판정 불능은 medium(고쳐쓰기)으로 본다.
  if (!rv.riskRead && rv.parsed) rv.fakeRisk = "medium";

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
      issues.unshift(
        `근거에 없는 단축키를 삭제할 것(다른 키로 바꾸지 말 것): ${terms.unknownKeys.slice(0, 3).join(" / ")}`,
      );
    if (terms.unknownPaths.length)
      issues.unshift(`근거에 없는 메뉴 경로를 삭제할 것: ${terms.unknownPaths[0]}`);
  }

  // 개수 약속 ↔ 본문 소제목 일치 (기계 대조) — 어긋나면 지적에 얹어 개선을 유도한다
  const pIssue = promiseIssue(draft.title, draft.summary, draft.body);
  if (pIssue) issues.unshift(pIssue);

  // 가이드 형식 게이트 — 지적으로 얹는다 (발행 여부는 아래에서 판단)
  if (formatIssues.length) issues.push(...formatIssues);

  // 제목 게이트 — 추측·에세이형 제목과 검색어가 뒤로 밀린 제목을 막는다
  const tIssues = titleIssues(draft);
  if (tIssues.length) issues.unshift(...tIssues);

  let verdict: Verdict;
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

  // 제목이 걸리면 그대로 내보내지 않는다 — 본문은 멀쩡하므로 폐기가 아니라 고쳐 쓰기다
  if (tIssues.length && verdict === "publish") verdict = "revise";

  return {
    score,
    fakeRisk,
    verdict,
    // 새 원고 쪽은 판정을 바꾸지 않는다 — 심사를 못 읽었으면 지금처럼 hold(검수함)가 맞다.
    //  못 읽은 답으로 '발행'을 내주면 안 되기 때문이다. 발행글 재감사와 방향이 반대인 게 맞다.
    parsed: rv.parsed,
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
- 훅(hook)이 지적됐으면 '결론 먼저'로 고친다 — 첫 줄에서 독자가 얻는 결과가 끝나야 한다(예: "이거 끄면 배터리 2시간 더 갑니다").
  제목을 줄여 쓴 것은 훅이 아니다. 원문에 없는 효과·수치를 새로 만들어 넣지는 마라.
- 본문은 마크다운. 마지막은 반드시 '## 오즈백 한 줄 정리'.
  · 제목·요약이 "N가지"·"N개"처럼 개수를 약속하거나 항목을 N개 나열했으면, '## 소제목'을 정확히 그 N개 만든다 (한 줄 정리 제외). 개수를 못 채우면 제목·요약의 개수를 실제 담긴 수로 낮춘다 — 약속과 본문 개수는 반드시 일치시킨다.
  · 소제목 하나 = 독립된 정보 하나. 한 소제목 안에 여러 항목을 뭉치지 않는다 (카드뉴스·쇼츠가 소제목 단위로 쪼개지므로 뭉치면 뒤 항목이 잘려나간다).
  · 개수를 약속하지 않은 일반 이슈는 소제목 3~5개 (다룰 사실이 적으면 최소 2개).
- [빈약한 섹션 보강] 지적에 '빈약함·서론만·내용부족·어그로'가 있으면, 원문 사실 범위 안에서 각 섹션을 서론-본론-결론(무슨 일 → 왜/어떻게 → 그래서 뭐가 달라지나)으로 채운다. 서론에서 끝내지 말고, 훅·제목이 약속한 내용을 본문에서 실제로 다룬다. 단 채울 사실이 없으면 지어내지 말고 소제목 개수를 실제에 맞춰 줄인다.

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

[점수 — 항목별 만점이 다르다. 반드시 이 만점 기준으로 매겨라]
- accuracy: 40점 만점 (사실 정확성)
- readability: 20점 만점 (읽기 쉬움)
- tone: 15점 만점 (오즈백 톤)
- useful: 15점 만점 (독자가 얻어가는 것)
- titleScore: 10점 만점 (제목이 본문을 정직하게 대표하는가)
- 다섯 개를 더하면 100점이 된다. 10점 만점으로 매기지 마라.
- 지적할 것이 없으면 각 항목에 그 만점을 그대로 줘라.
  (문제가 없는 글은 100점이 정상이다. 애매하게 절반을 주지 마라)

출력은 반드시 아래 형식 그대로. 다른 말 금지.
<accuracy>0~40 사이 숫자</accuracy>
<readability>0~20 사이 숫자</readability>
<tone>0~15 사이 숫자</tone>
<useful>0~15 사이 숫자</useful>
<titleScore>0~10 사이 숫자</titleScore>
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
  category?: string;
  sources?: { url: string }[];
}): Promise<Review> {
  const guide = isGuideDraft(post);
  const user = `[발행일] ${post.date} (오늘: ${new Date().toISOString().slice(0, 10)})
[출처] ${post.sources?.[0]?.url ?? "없음"}
${
  guide
    ? `[이 글의 성격] 따라 하는 안내글(가이드)이다. 공식 안내에 있는 절차를 순서대로
알려주는 것은 '위험한 조언'이 아니다. 의료·투자·법률에서 판단을 대신 내려주는
서술만 위험으로 잡아라.\n`
    : ""
}
[제목] ${post.title}
[요약] ${post.summary}
[본문]
${post.body}

이 발행글을 재감사하라. 지정된 태그 형식으로만 출력.`;

  const rv = parseReview(
    await ask(AUDIT_SYSTEM, user, { maxTokens: 1200, careful: true }),
    "medium",
  );

  // 【안전장치 — 칭찬만 하고 낮은 점수를 주는 답은 채점 실수다】
  //   실측(2026-08-12): 내려간 21~22편 중 20~21편의 사유가 칭찬 문구였다.
  //   예) "품질 미달 (41점): 전반적으로 사실 기반이며 위험 요소가 없으므로 높은 점수를 부여합니다"
  //   지적사항이 하나도 없는데 70점 미만이 나오는 건 글이 나쁜 게 아니라
  //   심사관이 만점 기준을 다르게 잡은 것이다. 그런 답으로 발행글을 내리지 않는다.
  //   (아래 verdict 에서 skip → 이번 회차는 건드리지 않고 36시간 뒤 다시 본다)
  const 칭찬만 = rv.parsed && rv.issues.length === 0 && rv.score < 70 && rv.fakeRisk !== "high";

  const { score, fakeRisk } = rv;

  // 이미 발행된 글도 '약속 개수 ≠ 본문 소제목'이면 개선 대상으로 돌린다 (기존 반토막 글 자동 교정)
  const pIssue = promiseIssue(post.title, post.summary, post.body);

  // 이미 발행된 가이드도 형식 게이트를 통과해야 한다.
  // 여기서 걸리면 내리는 게 아니라 '고쳐서 발행 유지'(revise)다 — 옛 가이드를 시간이 지나며 끌어올린다.
  const gIssues = isGuideDraft(post) ? guideFormatIssues(post) : [];
  const issues = [...(pIssue ? [pIssue] : []), ...rv.issues, ...gIssues].slice(0, 8);

  let verdict: Verdict;
  // 심사관 답을 못 읽었으면 판정 자체가 없는 것이다. 발행글을 건드리지 않고 다음 회차로 넘긴다. (2026-08-11)
  if (!rv.parsed) verdict = "skip";
  else if (칭찬만) verdict = "skip";
  else if (fakeRisk === "high") verdict = "hold";
  else if (fakeRisk === "medium" || score < 70 || pIssue || gIssues.length) verdict = "revise";
  else verdict = "publish";

  // 걸린 게 '형식'뿐인가 — 사실관계는 멀쩡한데 [즉답]·[버전]·[Q]/[A]·분량 같은 모양새만 어긋난 경우.
  // 이건 독자를 속이지 않는다. 그런데도 내리면 검색 순위와 인스타 공급만 잃는다.
  // (2026-08-08 실측: 검수함에 밀린 8월 글 23건 중 21건이 여기였다. AI 심사는 100점을 준 글까지 있었다)
  // ※ 약속 개수 불일치(pIssue)는 '5가지라 해놓고 3개'라서 독자를 속인다 — 형식으로 봐주지 않는다.
  const formatOnly =
    verdict === "revise" && fakeRisk === "low" && score >= 70 && !pIssue && gIssues.length > 0;

  return { ...rv, issues, verdict, formatOnly, formatIssues: gIssues };
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
