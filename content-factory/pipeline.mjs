// 오즈백 콘텐츠 자동화 파이프라인 (실시간 발행 + 품질 게이트)
//
//   수집 → AI 작성 → [AI 심사관] ─┬─ 통과(80점↑·위험낮음) → 즉시 발행 → 인스타/페북 게시
//                                 ├─ 보통(62~79점)        → 자동 개선 1회 → 재심사 → 통과 시 발행
//                                 └─ 미달·가짜뉴스 위험    → 검수함(노션 '검수필요')
//
// 원칙: 속도보다 신뢰. 가짜뉴스 위험이 조금이라도 있으면 절대 자동 발행하지 않는다.

import { collectAllIssues } from "./aggregate.mjs";
import { pickEvergreenIssues, remainingEvergreen } from "./evergreen.mjs";
import { generateDraft } from "./ai.mjs";
import { reviewDraft, reviseDraft } from "./quality.mjs";
import { getLessons, recordReview } from "./learn.mjs";
import {
  saveDraft,
  queuePost,
  queueSize,
  getPublishedRaw,
  getQueued,
} from "./posts.mjs";
import { categoryOf } from "./categories.mjs";
import { sadd, smembers, srem } from "./store.mjs";
import { notionEnabled, addCollectedPage } from "./notion.mjs";
import { findCoverImage } from "./images.mjs";
import { makeIllustration, illustrateEnabled } from "./illustrate.mjs";
import { resolveSourceText } from "./article.mjs";
import { kvGet, kvSet } from "./store.mjs";

export const K_SEEN = "issues:seen";

const today = () => new Date().toISOString().slice(0, 10);
const issueKey = (t) => t.replace(/\s+/g, "").slice(0, 30);

function makeSlug(categorySlug) {
  const t = Date.now().toString(36);
  const r = Math.abs((Date.now() * 7919) % 1_000_000).toString(36);
  return `${categorySlug}-${t}${r}`;
}

// 예약 발행 간격 — 이 간격으로 하나씩 올라간다 (홈페이지가 하루 종일 살아있게)
const GAP_MIN = Number(process.env.PUBLISH_GAP_MIN || 720);
const QUEUE_MAX = Number(process.env.QUEUE_MAX || 3); // 대기열이 이만큼 차면 새로 쓰지 않는다 (묵은 뉴스 방지 + 비용 절약)
const K_NEXT_AT = "queue:nextAt";

// ---- 하루 생산량: 2편 ----
// 예전엔 매시간 3편씩 최대 48편을 썼다. 그 결과 글 하나에 쓸 수 있는 AI 예산이 바닥나
// 짧고 밋밋한 글이 쏟아졌다. 편수를 2편으로 줄이고, 그만큼 한 편에 더 공들인다.
const WRITE_DAILY_CAP = Number(process.env.WRITE_DAILY_CAP || 2);

// 2편을 아침·저녁에 한 편씩 나눠 쓴다.
// (새벽에 몰아 쓰면 그날 저녁 뉴스는 아예 다룰 기회가 없다)
const WRITE_SLOTS_KST = (process.env.WRITE_SLOTS_KST || "8,20")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n))
  .sort((a, b) => a - b);

const kstNow = () => new Date(Date.now() + 9 * 3600e3);
const kstDay = () => kstNow().toISOString().slice(0, 10);
const kstOf = (iso) =>
  iso ? new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10) : "";

// 지금(한국 시간)까지 열린 슬롯 수 = 오늘 지금 시점에 써도 되는 누적 최대 편수
function allowedByNow() {
  const h = kstNow().getUTCHours();
  return Math.min(WRITE_DAILY_CAP, WRITE_SLOTS_KST.filter((s) => h >= s).length);
}

// 오늘(한국 시간) 이미 쓴 뉴스 편수 — 발행분 + 대기열 둘 다 센다.
//
// 【꿀팁을 빼고 세는 이유】 이 숫자는 '뉴스 슬롯(아침·저녁) 예산'을 계산하는 데만 쓴다.
// 가이드(꿀팁)는 새벽 전용 회차가 따로 만들고, 그건 뉴스 슬롯과 무관하다.
// 같이 세면 새벽에 가이드 한 편이 나간 것만으로 아침 슬롯이 통째로 막혀버린다.
// 가이드 편수는 TIPS_PER_DAY 가 따로 막고 있다.
async function writtenToday() {
  const day = kstDay();
  try {
    const [published, queued] = await Promise.all([getPublishedRaw(), getQueued()]);
    return [...published, ...queued].filter(
      (p) => kstOf(p.createdAt ?? p.publishedAt ?? p.date) === day && p.category !== "꿀팁",
    ).length;
  } catch {
    return 0; // 못 세면 막지 않는다
  }
}

// 다음 글이 올라갈 시각을 잡는다 (약간의 랜덤을 섞어 기계적이지 않게)
async function nextSlot() {
  const now = Date.now();
  let base = now;
  try {
    const raw = await kvGet(K_NEXT_AT);
    if (raw) base = Math.max(now, new Date(raw).getTime());
  } catch {
    /* 없으면 지금부터 */
  }
  const jitter = (Math.random() - 0.5) * 12 * 60_000; // ±6분
  const at = new Date(base);
  await kvSet(K_NEXT_AT, new Date(base + GAP_MIN * 60_000 + jitter).toISOString());
  return at;
}

// ---- 분야(카테고리) 균형 ----
// 목표 비중. 최근 발행분에서 이 비중을 넘긴 분야는 이번 회차에 새로 쓰지 않는다.
// (꿀팁은 근거가 항상 확보돼 성공률이 높아 그냥 두면 혼자 다 차지한다 —
//  실제로 최근 25건 중 18건(72%)이 꿀팁이었다. 그래서 상한을 둔다.)
//
// 【꿀팁 55%인 이유】 하루 2편 중 1편을 꿀팁으로 고정하면 비중이 정확히 50%다.
// 목표를 50%로 두면 '50% 이상'에 걸려 다음 날 꿀팁이 막힌다. 그래서 조금 높게 잡았다.
// 꿀팁은 뉴스와 달리 시간이 지나도 검색 유입이 죽지 않는 자산이다.
const TARGET_SHARE = {
  "꿀팁": 0.55,
  "사회": 0.2,
  "경제": 0.2,
  "IT·테크": 0.2,
  "문화·연예": 0.2,
  "스포츠": 0.2,
  "트렌드": 0.2,
};
const SHARE_WINDOW = 20; // 최근 20건 기준으로 판단

// 최근 분포에서 이미 목표 비중을 넘긴 분야인가
function isOverShare(category, counts, total) {
  if (total < 8) return false; // 표본이 적으면 제한하지 않는다
  const share = (counts[category] ?? 0) / total;
  return share >= (TARGET_SHARE[category] ?? 0.2);
}

// 매 회차 앞쪽에 몰린 사회·경제만 뽑히는 쏠림을 막는다.
// 최근에 적게 나간 분야를 먼저, 6개 분야를 번갈아(라운드로빈) 뽑아
// 시간이 지날수록 분야 비중이 비슷하게 유지되도록 이슈 순서를 재배치한다.
function balanceByCategory(issues, recent) {
  // 분야별로 묶는다 (수집된 순서 = 신선도 순서를 그대로 유지)
  const groups = new Map();
  for (const it of issues) {
    const arr = groups.get(it.category) ?? [];
    arr.push(it);
    groups.set(it.category, arr);
  }
  // 분야 순서: 최근에 적게 나간 분야 먼저 (동률이면 이번에 많이 수집된 분야 먼저)
  const order = [...groups.keys()].sort((a, b) => {
    const ra = recent[a] ?? 0;
    const rb = recent[b] ?? 0;
    if (ra !== rb) return ra - rb;
    return groups.get(b).length - groups.get(a).length;
  });
  // 라운드로빈: 각 분야에서 하나씩 번갈아 뽑는다
  const out = [];
  for (let more = true; more; ) {
    more = false;
    for (const cat of order) {
      const arr = groups.get(cat);
      if (arr.length) {
        out.push(arr.shift());
        more = true;
      }
    }
  }
  return out;
}

// 꿀팁 하루 생산 상한. 하루 2편 체제에서 1편을 꿀팁으로 고정한다.
// (나머지 1편은 뉴스 — 정보성:뉴스 = 1:1)
const TIPS_PER_DAY = Number(process.env.TIPS_PER_DAY || 1);

// 오늘 만든 꿀팁 수 (발행분 + 대기열 둘 다 센다 — 대기열에 쌓여도 결국 나가므로)
async function countTipsToday() {
  const day = kstDay(); // 하루 기준은 한국시간 (UTC로 세면 오전 9시에 리셋된다)
  try {
    const published = await getPublishedRaw();
    const queued = await getQueued();
    return [...published, ...queued].filter(
      (p) =>
        p.category === "꿀팁" &&
        kstOf(p.createdAt ?? p.publishedAt ?? p.date) === day,
    ).length;
  } catch {
    return 0; // 못 세면 막지 않는다 (발행이 멈추는 게 더 나쁘다)
  }
}

// 최근 발행 + 예약 대기 글의 분야별 개수 (균형 기준)
async function recentCategoryCounts(window = SHARE_WINDOW) {
  const counts = {};
  let total = 0;
  try {
    const published = await getPublishedRaw();
    const recent = [...published]
      .sort((a, b) =>
        (b.publishedAt ?? b.date ?? "").localeCompare(a.publishedAt ?? a.date ?? ""),
      )
      .slice(0, window);
    const queued = await getQueued();
    for (const p of [...recent, ...queued]) {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
      total++;
    }
  } catch {
    /* 분포를 못 읽으면 균형 없이 수집된 순서대로 진행 */
  }
  return { counts, total };
}

export async function runCollection(opts) {
  const limit = Math.min(Math.max(opts.limit ?? 5, 1), 12);
  const autoPublish = opts.autoPublish !== false;
  // 【가이드 전용 회차】 뉴스와 다른 시간대에 따로 돈다.
  //   뉴스는 오늘 안 나가면 죽지만 가이드는 다음 주에 나가도 값이 같다.
  //   그래서 뉴스 슬롯(아침·저녁)을 건드리지 않고 새벽에 가이드만 만든다.
  //   · 뉴스 수집(외부 API)을 아예 하지 않는다 — 한도도 시간도 아낀다
  //   · 뉴스용 하루 상한·시간대 슬롯의 적용을 받지 않는다 (새벽엔 뉴스 슬롯이 0이라 그냥 막힌다)
  //   · 분야 비중 제한도 적용하지 않는다 (어차피 꿀팁만 만드는 회차다)
  const guideOnly = opts.guideOnly ?? process.env.GUIDE_ONLY === "1";
  // 크론이 시간 초과로 죽지 않게 — 남은 건 다음 회차(30분 뒤)가 이어받는다
  const deadline = Date.now() + (opts.budgetMs ?? 540_000);

  const out = {
    queued: [],
    published: [],
    held: [],
    scanned: 0,
    unreadable: 0,
    social: { ig: 0, fb: 0 },
    errors: [],
  };

  // ---- 하루 3편 한도 먼저 확인 ----
  // 수집(외부 API 호출)보다 앞에서 막아야 한도 소진 없이 그냥 끝난다.
  // (가이드 전용 회차는 뉴스 슬롯과 무관하게 돌므로 이 한도를 쓰지 않는다)
  const wroteToday = await writtenToday();
  const allowedNow = guideOnly ? Infinity : allowedByNow();
  const dailyRoom = guideOnly ? limit : allowedNow - wroteToday;
  if (dailyRoom <= 0) {
    console.log(
      `오늘 ${wroteToday}편 작성 — 현재 시간대 상한(${allowedNow}편, 하루 ${WRITE_DAILY_CAP}편) 도달. 다음 시간대에 이어씀`,
    );
    out.dailyCapped = `오늘 ${wroteToday}/${WRITE_DAILY_CAP}편`;
    return out;
  }

  // 가이드 전용 회차는 뉴스를 수집하지 않는다 (외부 API를 아예 안 부른다)
  const issues = guideOnly ? [] : await collectAllIssues(opts.sources);
  out.scanned = issues.length;
  const seen = new Set(await smembers(K_SEEN));
  const fresh = issues.filter((i) => !seen.has(issueKey(i.title)));

  // 학습 루프: 과거 지적사항 체크리스트를 작성 프롬프트에 주입
  const lessons = await getLessons();

  // 대기열이 이미 가득 차 있으면 새 글을 쓰지 않는다 (묵은 뉴스가 쌓이는 걸 막고 API 비용도 아낀다)
  const pending = await queueSize();
  if (pending >= QUEUE_MAX) {
    out.errors.push(`대기열 ${pending}건 — 이번 회차는 수집만 (다 소진되면 다시 씀)`);
    return out;
  }
  // 이번 회차에 쓸 수 있는 편수 = 대기열 여유 ∩ 오늘 남은 하루 한도
  const room = Math.max(1, Math.min(QUEUE_MAX - pending, dailyRoom));
  let made = 0;

  // 분야 쏠림 방지: 최근 분포를 반영해 적게 나간 분야부터 번갈아 뽑도록 재배치
  const { counts: recentCounts, total: recentTotal } = await recentCategoryCounts();
  const ordered = balanceByCategory(fresh, recentCounts);
  console.log(
    `최근 ${recentTotal}건 분야 분포: ` +
      Object.entries(recentCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([c, n]) => `${c} ${n}`)
        .join(" / "),
  );

  // 에버그린/시즌 주제(꿀팁)는 검색 유입이 쌓이는 자산이라 꾸준히 내보낸다.
  // 다만 근거(facts)가 항상 확보돼 성공률이 높은 탓에 그냥 두면 혼자 다 차지한다.
  // → 최근 비중이 목표치를 넘었으면 이번 회차엔 넣지 않는다.
  const cap = Math.min(limit, room);
  // 꿀팁은 하루 1건까지만 만든다. (매시간 돌면서 계속 만들어 피드를 도배했다)
  const tipsToday = await countTipsToday();
  const tipsCapped = tipsToday >= TIPS_PER_DAY;
  // 가이드 전용 회차는 분야 비중 제한을 받지 않는다 — 이 회차의 목적이 꿀팁을 만드는 것이다.
  // (하루 상한 TIPS_PER_DAY 는 그대로 지킨다. 그게 도배를 막는 진짜 장치다)
  const tipsOver = tipsCapped || (!guideOnly && isOverShare("꿀팁", recentCounts, recentTotal));
  const everWant = tipsOver ? 0 : Math.max(1, cap - ordered.length);
  const ever = everWant > 0 ? pickEvergreenIssues(seen, everWant) : [];
  if (ever.length) {
    // 맨 앞에 넣는다 — 아침 슬롯이 정보성 글, 저녁 슬롯이 뉴스가 된다.
    ordered.unshift(...ever);
    console.log(`에버그린 주제 ${ever.length}건 투입`);
  } else if (tipsCapped) {
    console.log(`꿀팁 오늘 ${tipsToday}건 — 하루 상한(${TIPS_PER_DAY})에 도달, 뉴스만 진행`);
  } else if (tipsOver) {
    console.log("꿀팁 비중이 목표(55%)를 넘어 이번 회차는 뉴스 위주로 진행");
  }

  // 【요일 고정 코너를 맨 앞으로 — 2026-08-12】
  //   월 「이 달의 순위」와 화 「숫자로 보는 이번 주」는 뉴스 수집에서 온다(aggregate.mjs).
  //   그런데 이 회차는 한 편만 쓰고(limit 1), 바로 위에서 에버그린을 맨 앞에 꽂는다.
  //   그대로 두면 그 한 자리를 에버그린이 가져가고 월·화 코너는 영영 안 나간다 —
  //   요일 편성에서 「그날 코너가 빈다」는 건 코너가 없는 것과 같다.
  //   그래서 코너 표시가 붙은 것을 가장 앞에 세운다.
  const 코너것 = ordered.filter((i) => i.코너);
  if (코너것.length) {
    const 나머지 = ordered.filter((i) => !i.코너);
    ordered.length = 0;
    ordered.push(...코너것, ...나머지);
    console.log(`요일 코너 「${코너것[0].코너}」 재료 ${코너것.length}건 — 맨 앞에 세움`);
  }

  // 가이드 전용 회차인데 만들 주제가 없으면 여기서 끝낸다 (뉴스로 대체하지 않는다)
  if (guideOnly && !ordered.length) {
    const why = tipsCapped
      ? `꿀팁 오늘 ${tipsToday}건 — 하루 상한(${TIPS_PER_DAY}) 도달`
      : `남은 가이드 주제 ${remainingEvergreen(seen)}개 — 주제 보충이 필요합니다`;
    console.log(`가이드 전용 회차: ${why}`);
    out.errors.push(why);
    return out;
  }

  // 이번 회차에 쓴 분야를 세어, 한 회차가 한 분야로 채워지는 것도 막는다
  const madeByCategory = {};
  const liveCounts = () => {
    const m = { ...recentCounts };
    for (const [c, n] of Object.entries(madeByCategory)) m[c] = (m[c] ?? 0) + n;
    return m;
  };

  // 안전장치: 모든 분야가 이미 목표치 이상이면 균형 제한을 끈다.
  // (안 그러면 전부 건너뛰어 이번 회차에 한 건도 못 쓰는 상황이 생긴다)
  const balanceOn = ordered.some(
    (it) => !isOverShare(it.category, recentCounts, recentTotal),
  );
  if (!balanceOn && ordered.length) {
    console.log("모든 분야가 목표 비중 이상 — 이번 회차는 균형 제한 없이 진행");
  }

  for (const issue of ordered) {
    if (made >= Math.min(limit, room) || Date.now() > deadline) break;
    // 이미 목표 비중을 넘긴 분야는 건너뛴다 (seen 처리하지 않아 다음 회차에 다시 기회를 준다)
    // ※ 요일 코너 재료는 분야 비중과 무관하게 통과시킨다 — 그날 나가야 하는 글이라
    //   「경제 비중 초과」로 밀리면 그 요일이 통째로 빈다.
    if (!issue.코너 && balanceOn && isOverShare(issue.category, liveCounts(), recentTotal + made)) {
      console.log(`  · ${issue.category} 비중 초과 — 건너뜀: ${issue.title.slice(0, 24)}`);
      continue;
    }
    try {
      // 0) 근거 확보.
      //    · 뉴스 이슈  → 원문 기사를 실제로 읽는다. 못 읽으면 상상해서 쓰게 되므로 건너뛴다.
      //    · 에버그린   → 주제에 붙어있는 '검증된 사실(facts)'을 근거로 쓴다. (지어내기 차단은 동일)
      let context, sourceUrl;
      if (issue.facts) {
        context = issue.facts;
        sourceUrl = issue.ref?.url ?? issue.link ?? undefined;
      } else {
        const src = await resolveSourceText(issue);
        if (!src) {
          out.unreadable++;
          await sadd(K_SEEN, issueKey(issue.title)); // 다음 회차에 또 시도하지 않게
          continue;
        }
        context = `${src.text}${issue.extra ? "\n(참고: " + issue.extra + ")" : ""}`;
        sourceUrl = src.url;
      }

      // 1) 작성 (원문 사실만 사용) — 형식이 깨지면 한 번 더 시도
      let draft;
      try {
        draft = await generateDraft(issue.title, context, issue.category, lessons);
      } catch (e) {
        // AI 한도(무료 quota)·크레딧 소진이면 남은 이슈를 계속 시도해봐야 낭비 → 이번 회차 중단
        if (/quota|RESOURCE_EXHAUSTED|429|credit|too low|rate limit/i.test(String(e?.message))) {
          out.errors.push("AI 한도 소진 — 이번 회차 중단");
          break;
        }
        draft = await generateDraft(issue.title, context, issue.category, lessons); // 형식 문제면 1회 재시도
      }

      // 2) 심사 (원문과 대조 — 환각·가짜뉴스 검사)
      let review = await reviewDraft(draft, {
        title: issue.title,
        context,
        from: issue.source,
        url: sourceUrl,
      });
      let rounds = 0;

      // 3) 보통 등급이면 지적사항 반영해 1회 자동 개선 후 재심사
      if (review.verdict === "revise") {
        const fixed = await reviseDraft(draft, review, { title: issue.title, context });
        draft = { ...draft, ...fixed, hook: fixed.hook || draft.hook };
        rounds = 1;
        review = await reviewDraft(draft, {
          title: issue.title,
          context,
          from: issue.source,
          url: sourceUrl,
        });
      }

      await recordReview(
        { date: today(), score: review.score, verdict: review.verdict, fakeRisk: review.fakeRisk },
        review.issues,
      );
      await sadd(K_SEEN, issueKey(issue.title));
      made++;
      // 최종 분야는 AI가 내용 기준으로 다시 정한다(수집 때 붙인 분야와 다를 수 있다).
      // 균형 계산은 '실제로 나가는 분야' 기준이어야 하므로 draft.category 로 센다.
      madeByCategory[draft.category] = (madeByCategory[draft.category] ?? 0) + 1;

      // 가짜뉴스 위험 high 는 검수함에도 쌓지 않고 즉시 폐기한다.
      // (원문 대비 창작이 심한 환각 글 — 사람이 봐도 살릴 수 없어 적체만 됨. 발행은 절대 안 하고 버린다.)
      //
      // 【가이드는 예외 — 폐기하지 않고 검수함으로 보낸다】
      //   가이드의 근거(facts)는 밖에서 긁어온 기사가 아니라 우리가 직접 검증해 넣은 문장이다.
      //   원문이 흔들릴 일이 없으니 high 판정은 대개 심사 흔들림이다.
      //   그런데 폐기하면 주제 하나가 영영 소진되고(seen 처리는 이미 끝났다) 남는 게 없다.
      //   인스타가 가이드 전용이 된 지금은 그만큼 올릴 것이 빈다.
      //   발행은 여전히 막고(검수함), 사람이 보고 살릴 수 있게만 남긴다.
      if (review.fakeRisk === "high" && !issue.facts) {
        out.discarded = (out.discarded ?? 0) + 1;
        continue;
      }

      // 【위험 주제는 점수와 무관하게 자동 발행하지 않는다】
      //   초기화·삭제·비밀번호·결제·세금처럼 잘못 따라 하면 자료가 날아가거나 돈이 걸리는 것.
      //   심사 점수는 '원문과 맞느냐'만 본다. 따라 했을 때의 피해까지는 못 본다.
      //   → 검수함으로 보내 사람이 읽고 내보낸다. (표시는 evergreen-data.mjs 의 TR)
      const passed = autoPublish && review.verdict === "publish" && !issue.risky;

      // 4) 커버 사진 (없으면 타이포 디자인으로 감)
      const finalCategory = draft.category;
      const cat = categoryOf(finalCategory);
      const cover = await findCoverImage(
        draft.imageQuery,
        draft.imageQueryAlt,
        finalCategory,
        draft.title,
        draft.summary,
      );

      // 정보성 글은 스톡 사진이 잘 안 맞는다 → 사진을 못 찾았을 때만 삽화를 그린다.
      // (꺼져 있거나 한도에 걸리면 null 이고, 그러면 기존 타이포 디자인이 나온다)
      const slug = makeSlug(cat.slug);
      let illus = null;
      if (!cover && illustrateEnabled && finalCategory === "꿀팁") {
        illus = await makeIllustration({ slug, title: draft.title, summary: draft.summary });
      }

      const post = {
        slug,
        title: draft.title,
        summary: draft.summary,
        category: finalCategory,
        date: today(),
        status: passed ? "published" : "draft",
        body: draft.body,
        hook: draft.hook,
        emoji: draft.emoji,
        mood: draft.mood,
        cover: cover?.url ?? illus ?? undefined,
        imageCredit: cover?.credit ?? (illus ? "AI 생성 이미지" : undefined),
        readMinutes: Math.max(2, Math.round(draft.body.length / 400)),
        tags: draft.tags,
        sources: [
          {
            title: issue.ref?.title ? `참고 — ${issue.ref.title}` : `원문 보기 (${issue.source})`,
            url: sourceUrl,
          },
        ],
        createdAt: new Date().toISOString(),
        // 위험 주제 표시 — 감사(audit)가 이 글을 자동으로 구조·발행하지 않게 막는 표시이기도 하다
        risky: issue.risky === true ? true : undefined,
        // 가이드는 근거(facts)를 확인한 날을 남긴다 → 오래되면 감사가 "갱신 필요"로 골라낸다
        factsCheckedAt: issue.facts ? new Date().toISOString() : undefined,
        quality: {
          score: review.score,
          fakeRisk: review.fakeRisk,
          verdict: review.verdict,
          reviewedAt: new Date().toISOString(),
          rounds,
          // 위험 주제는 노션 검수함에서 '왜 여기 있는지'가 한눈에 보여야 한다.
          // (심사메모가 그대로 노션에 올라간다 — notion.mjs 의 심사메모 칸)
          note: issue.risky
            ? `⚠️ 위험 주제 — 사람이 확인한 뒤 발행하세요. ${review.note ?? ""}`.trim()
            : review.note,
        },
      };

      if (passed) {
        // ---- 예약 발행 대기열에 넣는다 (한꺼번에 쏟아내지 않는다) ----
        const at = await nextSlot();
        await queuePost(post, at);
        if (notionEnabled) {
          try {
            post.notionId = await addCollectedPage(post, "예약");
            await queuePost(post, at); // notionId 반영
          } catch (e) {
            out.errors.push(`노션 기록: ${e.message}`);
          }
        }
        out.queued.push({
          slug: post.slug,
          title: post.title,
          score: review.score,
          at: at.toISOString(),
        });
      } else {
        // ---- 검수함 ----
        await saveDraft(post);
        if (notionEnabled) {
          try {
            post.notionId = await addCollectedPage(post, "검수필요");
            await saveDraft(post);
          } catch (e) {
            out.errors.push(`노션 기록: ${e.message}`);
          }
        }
        out.held.push({
          title: post.title,
          score: review.score,
          reason: issue.risky
            ? `위험 주제 — 사람이 확인해야 발행 (${review.score}점)`
            : review.fakeRisk !== "low"
              ? `가짜뉴스 위험 ${review.fakeRisk}`
              : `품질 미달 (${review.score}점)`,
        });
      }
    } catch (e) {
      out.errors.push(`${issue.title.slice(0, 22)}: ${e.message}`);
      // 【가이드 주제는 되돌린다】 뉴스는 오늘 안 나가면 어차피 죽으니 소진돼도 그만이지만,
      // 가이드 주제는 재고다. 쓰다가 도중에 엎어졌는데 '이미 쓴 것'으로 남으면 영영 안 나온다.
      // 주제 목록에 되돌려 다음 회차가 다시 집을 수 있게 한다.
      if (issue.facts) {
        await srem(K_SEEN, issueKey(issue.title)).catch(() => {});
        console.log(`  · 가이드 주제 되돌림(다음 회차에 다시 시도): ${issue.title.slice(0, 30)}`);
      }
    }
  }

  return out;
}
