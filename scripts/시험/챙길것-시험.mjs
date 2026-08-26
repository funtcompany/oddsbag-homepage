// 「챙길 것」 고르는 규칙 시험 — 서버 없이 순수 함수만 돌린다
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const 뿌리 = process.env.OB_ROOT;
const SV = await import("@/lib/checklist");
const SH = await import("@/lib/casebook-shape");

let 통과 = 0, 실패 = 0;
function 시험(이름, fn) {
  try { fn(); 통과++; console.log(`  ✓ ${이름}`); }
  catch (e) { 실패++; console.log(`  ✗ ${이름}\n      ${e.message}`); }
}

const 올해 = 2026;
const 오늘 = "2026-08-26";
const 어휘 = JSON.parse(fs.readFileSync(path.join(뿌리, "data/casebook-vocab.json"), "utf-8"));
const 아는것 = new Set(어휘.have.map((h) => h.id));

const 만들기 = (o) => SH.toCard({
  id: "t", situation: "시험", status: "live", verifiedAt: "2026-08-21", recheckDays: 90,
  steps: [{ when: "오늘", what: "둘째" }, { when: "3분", what: "첫째", where: "여기" }],
  deadline: { kind: "없음", text: "" }, volatile: [], basis: [{ id: "b", url: "https://x", publisher: "p" }],
  applies: { everyone: true, have: [], ageFrom: null, ageTo: null, ageBasisRef: null, ageNotes: [] },
  ...o,
}, 아는것, new Map(), 오늘);

console.log("\n[1] 카드로 바꾸기");
시험("unverified 는 도구에 안 나온다", () => assert.equal(만들기({ status: "unverified" }), null));
시험("verifiedAt 이 비면 안 나온다", () => assert.equal(만들기({ verifiedAt: null }), null));
시험("live 는 나온다", () => assert.ok(만들기({})));
시험("watch 도 나온다", () => assert.ok(만들기({ status: "watch" })));
시험("첫 걸음은 «3분» 짜리를 집는다", () => assert.equal(만들기({}).firstMove.what, "첫째"));
시험("3분짜리가 없으면 첫 단계를 집는다", () =>
  assert.equal(만들기({ steps: [{ when: "한달", what: "유일" }] }).firstMove.what, "유일"));
시험("다음 재확인일 = 확인일 + 주기", () => assert.equal(만들기({}).nextCheckAt, "2026-11-19"));
시험("재확인일이 지났으면 stale", () =>
  assert.equal(만들기({ verifiedAt: "2025-01-01", recheckDays: 90 }).stale, true));
시험("아직 안 지났으면 stale 아님", () => assert.equal(만들기({}).stale, false));
시험("주기가 없으면 기본값으로", () =>
  assert.equal(만들기({ recheckDays: undefined }).nextCheckAt, SV.addDays("2026-08-21", 180)));
시험("어휘표에 없는 태그는 화면에서도 버린다", () =>
  assert.deepEqual(만들기({ applies: { everyone: false, have: ["운전면허", "없는것"] } }).applies.have, ["운전면허"]));
시험("deadline.kind 가 이상하면 «없음» 으로", () =>
  assert.equal(만들기({ deadline: { kind: "뭔가", text: "" } }).deadlineKind, "없음"));
시험("volatile 은 label·url 만 넘어간다", () => {
  const c = 만들기({ volatile: [{ label: "내 것", checkUrl: "https://a" }, { label: "링크없음" }] });
  assert.deepEqual(c.checks, [{ label: "내 것", url: "https://a" }, { label: "링크없음", url: null }]);
});

console.log("\n[2] 누구에게 보여줄까");
const 카드 = (ap, extra = {}) => ({ ...만들기({ applies: { everyone: false, have: [], ageFrom: null, ageTo: null, ageBasisRef: null, ageNotes: [], ...ap }, ...extra }) });
const 맞나 = (ap, ans) => SV.cardMatches(카드(ap), { birthYear: null, have: [], ...ans }, 올해);

시험("everyone 은 아무것도 안 골라도 나온다", () => assert.equal(맞나({ everyone: true }, {}), true));
시험("가진 것이 겹치면 나온다", () => assert.equal(맞나({ have: ["운전면허"] }, { have: ["운전면허"] }), true));
시험("안 겹치면 안 나온다", () => assert.equal(맞나({ have: ["운전면허"] }, { have: ["여권"] }), false));
시험("하나라도 겹치면 나온다", () => assert.equal(맞나({ have: ["운전면허", "여권"] }, { have: ["여권"] }), true));
시험("★태어난 해를 안 넣으면 나이로 가리지 않는다", () =>
  assert.equal(맞나({ everyone: true, ageFrom: 70, ageBasisRef: "b" }, { birthYear: null }), true));
시험("나이 아래면 안 나온다", () =>
  assert.equal(맞나({ everyone: true, ageFrom: 70, ageBasisRef: "b" }, { birthYear: 2000 }), false));
시험("나이 위면 나온다", () =>
  assert.equal(맞나({ everyone: true, ageFrom: 70, ageBasisRef: "b" }, { birthYear: 1950 }), true));
시험("★경계에서는 여유 1년을 준다 (가리는 쪽으로 틀리지 않는다)", () =>
  assert.equal(맞나({ everyone: true, ageFrom: 70, ageBasisRef: "b" }, { birthYear: 1957 }), true)); // 69세
시험("여유를 넘어서면 가린다", () =>
  assert.equal(맞나({ everyone: true, ageFrom: 70, ageBasisRef: "b" }, { birthYear: 1958 }), false)); // 68세
시험("ageTo 위쪽도 여유 1년", () =>
  assert.equal(맞나({ everyone: true, ageTo: 20, ageBasisRef: "b" }, { birthYear: 2005 }), true)); // 21세

console.log("\n[3] 나이대 주의문");
const 주의카드 = 카드({ everyone: true, ageNotes: [{ from: 70, to: null, text: "칠십", basisRef: "b" }] });
시험("해당 나이면 뜬다", () => assert.equal(SV.notesFor(주의카드, 1950, 올해).length, 1));
시험("아니면 안 뜬다", () => assert.equal(SV.notesFor(주의카드, 2000, 올해).length, 0));
시험("★태어난 해가 없으면 아예 안 뜬다 (모르면 말하지 않는다)", () =>
  assert.equal(SV.notesFor(주의카드, null, 올해).length, 0));

console.log("\n[4] 차례 · 선택지");
시험("법정 → 안내 → 없음 순", () => {
  const mk = (k, s) => ({ deadlineKind: k, situation: s });
  const 결과 = SV.sortCards([mk("없음", "가"), mk("법정", "나"), mk("안내", "다")]);
  assert.deepEqual(결과.map((c) => c.deadlineKind), ["법정", "안내", "없음"]);
});
시험("★아무 카드도 안 쓰는 선택지는 화면에 안 내놓는다", () => {
  const 쓰임 = SV.usableHaveIds([카드({ have: ["운전면허"] })]);
  assert.equal(쓰임.has("운전면허"), true);
  assert.equal(쓰임.has("사업자"), false);
});

console.log("\n[5] 날짜 · 입력값");
시험("한글 날짜", () => assert.equal(SV.한글날짜("2026-08-21"), "2026년 8월 21일"));
시험("깨진 날짜는 그대로 돌려준다", () => assert.equal(SV.한글날짜("몰라"), "몰라"));
시험("날짜 더하기 (달 넘김)", () => assert.equal(SV.addDays("2026-08-21", 90), "2026-11-19"));
시험("연도 검사 — 미래는 안 된다", () => assert.equal(SV.isValidBirthYear(2030, 올해), false));
시험("연도 검사 — 121년 전은 안 된다", () => assert.equal(SV.isValidBirthYear(1905, 올해), false));
시험("연도 검사 — 보통 값은 된다", () => assert.equal(SV.isValidBirthYear(1985, 올해), true));
시험("지난 말", () => {
  assert.equal(SV.지난말(0), "오늘"); assert.equal(SV.지난말(1), "어제");
  assert.equal(SV.지난말(10), "10일 전"); assert.equal(SV.지난말(95), "3개월 전");
  assert.equal(SV.지난말(800), "2년 전");
});

console.log("\n[6] 실물 케이스북으로");
const 실물 = fs.readdirSync(path.join(뿌리, "data/casebook"))
  .filter((f) => f.endsWith(".json") && !f.startsWith("_") && !f.startsWith("._"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(뿌리, "data/casebook", f), "utf-8")));
const 실물카드 = 실물.map((c) => SH.toCard(c, 아는것, new Map(), 오늘)).filter(Boolean);
시험("확인 안 된 것은 하나도 안 나온다", () =>
  assert.equal(실물카드.every((c) => c.verifiedAt), true));
시험("아무것도 안 고른 사람도 빈손으로 안 나간다", () => {
  const r = SV.matchCards(실물카드, { birthYear: null, have: [] }, 올해);
  assert.ok(r.length > 0, "everyone 카드가 하나도 없다");
});
시험("면허·여권 가진 사람은 더 많이 본다", () => {
  const 기본 = SV.matchCards(실물카드, { birthYear: null, have: [] }, 올해).length;
  const 더 = SV.matchCards(실물카드, { birthYear: null, have: ["운전면허", "여권"] }, 올해).length;
  assert.ok(더 > 기본, `${더} > ${기본} 이어야 한다`);
});
시험("모든 카드가 조회 링크나 근거를 갖고 있다", () =>
  assert.equal(실물카드.every((c) => c.sources.length > 0), true));

console.log("\n[7] 「올해 안에」 묶음");
// ★«올해 지나면 없어진다» 는 강한 말이다. 근거가 없으면 화면이 스스로 떼어 낸다.
시험("근거 없는 yearBound 는 떼어 낸다", () =>
  assert.equal(만들기({ yearBound: { kind: "연말", text: "그렇다" } }).yearBound, null));
시험("모르는 kind 는 떼어 낸다", () =>
  assert.equal(만들기({ yearBound: { kind: "분기", text: "그렇다", basisRef: "b" } }).yearBound, null));
시험("근거가 있으면 붙는다", () =>
  assert.equal(만들기({ yearBound: { kind: "연말", text: "해마다 다시", basisRef: "b" } }).yearBound.kind, "연말"));
시험("yearBound 가 없으면 null", () => assert.equal(만들기({}).yearBound, null));

시험("올해 안에 묶음은 «연말» 만 담는다", () => {
  const a = { ...만들기({ yearBound: { kind: "연말", text: "가", basisRef: "b" } }), id: "a" };
  const b = { ...만들기({ yearBound: { kind: "연초", text: "나", basisRef: "b" } }), id: "b" };
  const c = { ...만들기({}), id: "c" };
  assert.deepEqual(SV.yearEndCards([a, b, c]).map((x) => x.id), ["a"]);
});

시험("연말까지 남은 날", () => {
  assert.equal(SV.daysLeftInYear("2026-12-31"), 0);
  assert.equal(SV.daysLeftInYear("2026-12-01"), 30);
  assert.equal(SV.daysLeftInYear("2026-01-01"), 364); // 2026 은 평년
});
시험("해가 지나도 음수가 안 나온다", () => assert.ok(SV.daysLeftInYear("2026-12-31") >= 0));
시험("올해가 몇 년인지", () => assert.equal(SV.thisYearKST("2026-08-26"), 2026));

// 실물에 붙은 것은 «근거 옆에» 있어야 한다
시험("실물에서 올해 안에 표시된 것은 전부 근거가 있다", () => {
  for (const c of SV.yearEndCards(실물카드)) {
    assert.ok(c.yearBound.basisRef, `${c.id} 에 basisRef 가 없다`);
    assert.ok(
      c.sources.length > 0,
      `${c.id} 에 근거가 하나도 없다`,
    );
  }
});
시험("실물에 「올해 안에」가 한 건 이상 있다", () =>
  assert.ok(SV.yearEndCards(실물카드).length > 0, "묶음이 비면 화면에 띠가 안 뜬다"));

console.log(`\n실물 케이스북 ${실물.length}건 중 도구에 나오는 것 ${실물카드.length}건 · 올해 안에 ${SV.yearEndCards(실물카드).length}건`);
console.log(`\n───── 통과 ${통과} · 실패 ${실패} ─────\n`);
process.exit(실패 ? 1 : 0);
