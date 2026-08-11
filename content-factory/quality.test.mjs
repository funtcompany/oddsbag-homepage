// 심사 결과 읽기 — 회귀 시험. (2026-08-11 신설)
//
// 【왜 이 시험이 있나】
//   여기서 「점수를 못 읽었다」와 「0점을 받았다」를 구분하지 못해 발행글 218편이 내려갔다.
//   심사관(AI) 답이 형식을 안 지키면 모든 점수가 0이 되고 위험도는 medium 으로 가정됐는데,
//   재감사에서 그 둘이면 '고쳐쓰기 → 또 실패 → 내림'이라 멀쩡한 글이 사라졌다.
//   글을 내리는 판단이므로, 눈으로 읽고 넘기지 않고 시험으로 붙잡아 둔다.
//
// 돌리는 법:  node --test content-factory/quality.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReview } from "./quality.mjs";

/** auditPost 가 쓰는 판정 규칙과 같은 규칙 (형식 지적은 없다고 보고 단순화) */
function verdictOf(rv) {
  if (!rv.parsed) return "skip";
  if (rv.fakeRisk === "high") return "hold";
  if (rv.fakeRisk === "medium" || rv.score < 70) return "revise";
  return "publish";
}

const 정상답 = `<accuracy>36</accuracy>
<readability>18</readability>
<tone>14</tone>
<useful>13</useful>
<titleScore>9</titleScore>
<fakeRisk>low</fakeRisk>
<issues>
- 없음
</issues>
<note>문제 없음</note>`;

test("정상 답 — 점수를 읽고 발행을 유지한다", () => {
  const rv = parseReview(정상답, "medium");
  assert.equal(rv.parsed, true);
  assert.equal(rv.score, 90);
  assert.equal(rv.fakeRisk, "low");
  assert.equal(verdictOf(rv), "publish");
});

test("★ 답을 통째로 못 읽었을 때 — 0점이 아니라 '판정 못 함'이다 (글을 내리지 않는다)", () => {
  for (const 답 of [
    "죄송합니다. 이 요청은 처리할 수 없습니다.",
    "",
    "```json\n{\"accuracy\": 36}\n```", // 태그가 아니라 JSON 으로 답한 경우
    "<level>low</level><note>형식이 다른 답</note>", // 다른 심사의 형식
  ]) {
    const rv = parseReview(답, "medium");
    assert.equal(rv.parsed, false, `이 답은 '판정 못 함'이어야 한다: ${JSON.stringify(답.slice(0, 30))}`);
    assert.equal(verdictOf(rv), "skip", "판정을 못 했으면 건드리지 않는다");
  }
});

test("위험도만 읽히고 점수는 못 읽은 답도 '판정 못 함'이다", () => {
  // 점수가 없으면 score 는 0 이다. 이걸 '0점짜리 글'로 보면 안 된다.
  const rv = parseReview("<fakeRisk>low</fakeRisk><note>ok</note>", "medium");
  assert.equal(rv.score, 0);
  assert.equal(rv.parsed, false);
  assert.equal(verdictOf(rv), "skip");
});

test("진짜 0점을 받은 글은 그대로 걸린다 (지혈이 심사를 무디게 만들지 않는다)", () => {
  const 빵점 = `<accuracy>0</accuracy>
<readability>0</readability>
<tone>0</tone>
<useful>0</useful>
<titleScore>0</titleScore>
<fakeRisk>low</fakeRisk>
<note>내용이 비었다</note>`;
  const rv = parseReview(빵점, "medium");
  assert.equal(rv.parsed, true, "0점이라고 답한 것은 '읽은' 것이다");
  assert.equal(rv.score, 0);
  assert.equal(verdictOf(rv), "revise");
});

test("가짜뉴스 위험 high 는 지금과 똑같이 걸러진다", () => {
  const 위험 = `<accuracy>30</accuracy>
<readability>18</readability>
<tone>14</tone>
<useful>13</useful>
<titleScore>9</titleScore>
<fakeRisk>high</fakeRisk>
<note>원문에 없는 수치</note>`;
  const rv = parseReview(위험, "medium");
  assert.equal(rv.parsed, true);
  assert.equal(verdictOf(rv), "hold");
});

test("점수 칸이 하나라도 있으면 읽은 것으로 본다 (부분 응답)", () => {
  const 부분 = `<accuracy>35</accuracy>\n<fakeRisk>low</fakeRisk>`;
  const rv = parseReview(부분, "medium");
  assert.equal(rv.parsed, true);
  assert.equal(rv.score, 35); // 나머지 칸은 0
  assert.equal(verdictOf(rv), "revise"); // 70점 미만이라 고쳐쓰기 — 내리지는 않는다
});

test("점수 상한을 넘겨 답해도 상한으로 자른다", () => {
  const 과대 = `<accuracy>999</accuracy><readability>99</readability><tone>99</tone><useful>99</useful><titleScore>99</titleScore><fakeRisk>low</fakeRisk>`;
  const rv = parseReview(과대, "medium");
  assert.equal(rv.score, 100);
});
