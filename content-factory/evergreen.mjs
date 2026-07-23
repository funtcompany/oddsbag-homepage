// 에버그린 주제 엔진 — 주제를 골라 파이프라인에 넘긴다.
//
// 【왜 필요한가】
//  · 뉴스는 하루 지나면 죽지만, 꿀팁·생활정보는 검색 유입이 계속 쌓인다.
//  · 실시간 수집이 필요 없어 AI 한도 부담이 적고, 미리 만들어둘 수 있다.
//  · 공식 문서·일반 상식 기반이라 가짜뉴스 위험이 거의 없다.
//
// 【가장 중요한 규칙】
//  주제마다 '검증된 사실(facts)'이 붙어 있고, AI는 오직 그것만 근거로 쓴다.
//  facts 에 없는 내용은 쓰면 안 된다. 주제 추가는 evergreen-data.mjs 에서.

import { ALL_EVERGREEN } from "./evergreen-data.mjs";

export const EVERGREEN = ALL_EVERGREEN;

// ─────────────────────────────────────────────────────────────
// 시즌 주제 — 정해진 시기 '전에' 미리 알려주는 것
//   month/day = 기준일, leadDays = 며칠 전부터 낼지
//   ※ 해마다 날짜·금액이 바뀌므로 facts 에 '연도별 확정 수치'는 쓰지 않는다.
// ─────────────────────────────────────────────────────────────
export const SEASONAL = [
  {
    id: "yearend-tax",
    category: "꿀팁",
    month: 1,
    day: 15,
    leadDays: 20,
    title: "연말정산, 미리 알아두면 덜 토해내는 것들",
    ref: { title: "국세청 홈택스", url: "https://www.hometax.go.kr" },
    facts: `연말정산 준비에 관한 일반적인 사실. 구체적 금액·비율은 해마다 바뀌므로 단정하지 않는다.

1) 간소화 서비스는 매년 1월 중순에 열린다
   국세청 홈택스에서 대부분의 공제 자료를 한 번에 내려받을 수 있다.

2) 간소화 자료에 안 잡히는 항목이 있다
   기부금, 안경 구입비, 일부 의료비, 월세 등은 직접 증빙을 챙겨야 하는 경우가 있다.

3) 부양가족 공제는 조건 확인이 먼저다
   소득·나이 요건이 있고, 형제자매가 중복으로 올리면 나중에 문제가 된다.

4) 월세액 공제는 조건이 맞아야 한다
   임대차계약서와 이체 내역 등 증빙이 필요하다.

5) 놓쳤어도 나중에 바로잡을 수 있다
   빠뜨린 공제는 이후 경정청구 절차로 다시 신청할 수 있다.`,
  },
  {
    id: "car-tax-prepay",
    category: "꿀팁",
    month: 1,
    day: 16,
    leadDays: 14,
    title: "자동차세 연납, 1월에 한 번에 내면 깎아준다",
    ref: { title: "위택스", url: "https://www.wetax.go.kr" },
    facts: `자동차세 연납(1년치 미리 납부) 제도에 관한 사실. 공제율은 해마다 조정될 수 있어 수치는 단정하지 않는다.

1) 1년치를 미리 내면 일정 비율을 깎아준다
   원래는 6월과 12월에 나눠 내는데, 1월에 한 번에 내면 할인이 적용된다.

2) 신청은 위택스나 관할 지자체에서 한다
   온라인으로도 신청·납부가 가능하다.

3) 1월을 놓쳐도 기회가 남아 있다
   3월, 6월, 9월에도 남은 기간에 대해 연납을 신청할 수 있고, 늦어질수록 할인 폭은 줄어든다.

4) 차를 중간에 팔면 정산된다
   연납 후 차량을 처분하면 남은 기간만큼 환급받는다.`,
  },
  {
    id: "income-tax-may",
    category: "꿀팁",
    month: 5,
    day: 1,
    leadDays: 20,
    title: "5월 종합소득세, 대상인지부터 확인하세요",
    ref: { title: "국세청 홈택스", url: "https://www.hometax.go.kr" },
    facts: `종합소득세 신고에 관한 일반적인 사실. 세율·공제 금액은 해마다 바뀌므로 단정하지 않는다.

1) 신고 기간은 매년 5월이다
   전년도에 발생한 소득을 신고·납부한다.

2) 근로소득만 있으면 보통 대상이 아니다
   연말정산으로 끝나는 경우가 많다. 다만 다른 소득이 함께 있으면 대상이 된다.

3) 프리랜서·사업소득·부업 소득이 있으면 확인이 필요하다
   여러 곳에서 받은 소득이 합산된다.

4) 홈택스에서 미리 채워주는 자료가 있다
   신고 도움 서비스에서 내 소득 자료를 불러올 수 있다.

5) 안 하면 가산세가 붙는다
   기한을 넘기면 불이익이 있으므로 대상 여부만이라도 미리 확인한다.`,
  },
  {
    id: "health-checkup",
    category: "꿀팁",
    month: 12,
    day: 1,
    leadDays: 45,
    title: "건강검진, 연말 몰리기 전에 받아두세요",
    ref: { title: "국민건강보험공단", url: "https://www.nhis.or.kr" },
    facts: `국가 건강검진에 관한 일반적인 사실. 대상과 항목은 개인별로 다르므로 본인 확인이 필요하다.

1) 대상 여부는 미리 확인할 수 있다
   건강보험공단 홈페이지나 앱에서 올해 검진 대상인지 조회된다.

2) 연말에 몰린다
   11~12월은 예약이 어렵고 대기가 길다. 미리 받으면 원하는 날짜를 잡기 쉽다.

3) 대상 연도를 넘기면 다음 기회까지 기다려야 한다
   검진 주기가 정해져 있어 해를 넘기면 그 해 기회는 사라진다.

4) 검진 기관은 선택할 수 있다
   집이나 직장 근처의 지정 기관을 고를 수 있다.

5) 사전 준비 사항이 있다
   금식 등 안내 사항은 기관에서 미리 알려주므로 예약할 때 확인한다.`,
  },
  {
    id: "new-semester",
    category: "꿀팁",
    month: 3,
    day: 2,
    leadDays: 14,
    title: "새 학기 시작 전 챙기면 편한 것들",
    ref: { title: "오즈백 정리", url: "https://oddsbag.co.kr" },
    facts: `새 학기 준비에 관한 일반적인 내용.

1) 생활 리듬 먼저 되돌리기
   개학 직전에 갑자기 바꾸면 힘들다. 며칠 전부터 기상 시간을 당긴다.

2) 준비물은 목록으로
   학교에서 안내가 오기 전에 산 물건이 겹치는 경우가 많다.

3) 이름표 붙이기
   잃어버리는 물건이 가장 많은 시기다.

4) 등하굣길 미리 걸어보기
   길과 걸리는 시간을 함께 확인한다.

5) 서류 미리 챙기기
   각종 동의서와 제출 서류가 한꺼번에 몰린다.`,
  },
];

const key = (t) => t.replace(/\s+/g, "").slice(0, 30);

// 오늘 낼 만한 시즌 주제 (기준일 leadDays 전 ~ 기준일 직후)
function seasonalDue(now) {
  const y = now.getFullYear();
  return SEASONAL.filter((t) => {
    const target = new Date(y, t.month - 1, t.day);
    const diff = (target - now) / 86400000; // 남은 일수
    return diff <= t.leadDays && diff >= -1;
  });
}

/**
 * 에버그린/시즌 주제를 이슈 형태로 돌려준다.
 * 시즌 주제를 먼저 내보내고(미리 알림), 그 다음 상시 주제를 순서대로 쓴다.
 *
 * @param {Set<string>} seen  이미 다룬 주제 키
 * @param {number} want       필요한 개수
 * @param {Date}   now
 */
export function pickEvergreenIssues(seen, want = 2, now = new Date()) {
  const pool = [...seasonalDue(now), ...EVERGREEN];
  const out = [];
  for (const t of pool) {
    if (out.length >= want) break;
    if (seen.has(key(t.title))) continue;
    out.push({
      source: "오즈백 정리",
      title: t.title,
      link: t.ref?.url ?? null,
      category: t.category,
      facts: t.facts, // ★ 이게 있으면 파이프라인이 원문 수집 대신 이걸 근거로 쓴다
      ref: t.ref,
    });
  }
  return out;
}

/** 남은 주제 수 (소진 경고용) */
export function remainingEvergreen(seen) {
  return EVERGREEN.filter((t) => !seen.has(key(t.title))).length;
}
