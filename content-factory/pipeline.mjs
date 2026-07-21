// 오즈백 콘텐츠 자동화 파이프라인 (실시간 발행 + 품질 게이트)
//
//   수집 → AI 작성 → [AI 심사관] ─┬─ 통과(80점↑·위험낮음) → 즉시 발행 → 인스타/페북 게시
//                                 ├─ 보통(62~79점)        → 자동 개선 1회 → 재심사 → 통과 시 발행
//                                 └─ 미달·가짜뉴스 위험    → 검수함(노션 '검수필요')
//
// 원칙: 속도보다 신뢰. 가짜뉴스 위험이 조금이라도 있으면 절대 자동 발행하지 않는다.

import { collectAllIssues } from "./aggregate.mjs";
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
import { sadd, smembers } from "./store.mjs";
import { notionEnabled, addCollectedPage } from "./notion.mjs";
import { findCoverImage } from "./images.mjs";
import { resolveSourceText } from "./article.mjs";
import { kvGet, kvSet } from "./store.mjs";

const K_SEEN = "issues:seen";

const today = () => new Date().toISOString().slice(0, 10);
const issueKey = (t) => t.replace(/\s+/g, "").slice(0, 30);

function makeSlug(categorySlug) {
  const t = Date.now().toString(36);
  const r = Math.abs((Date.now() * 7919) % 1_000_000).toString(36);
  return `${categorySlug}-${t}${r}`;
}

// 예약 발행 간격 — 이 간격으로 하나씩 올라간다 (홈페이지가 하루 종일 살아있게)
const GAP_MIN = Number(process.env.PUBLISH_GAP_MIN || 45);
const QUEUE_MAX = Number(process.env.QUEUE_MAX || 12); // 대기열이 이만큼 차면 새로 쓰지 않는다 (묵은 뉴스 방지 + 비용 절약)
const K_NEXT_AT = "queue:nextAt";

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

// 최근 발행 + 예약 대기 글의 분야별 개수 (균형 기준)
async function recentCategoryCounts(window = 40) {
  const counts = {};
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
    }
  } catch {
    /* 분포를 못 읽으면 균형 없이 수집된 순서대로 진행 */
  }
  return counts;
}

export async function runCollection(opts) {
  const limit = Math.min(Math.max(opts.limit ?? 5, 1), 12);
  const autoPublish = opts.autoPublish !== false;
  // 크론이 시간 초과로 죽지 않게 — 남은 건 다음 회차(30분 뒤)가 이어받는다
  const deadline = Date.now() + (opts.budgetMs ?? 540_000);

  const issues = await collectAllIssues(opts.sources);
  const seen = new Set(await smembers(K_SEEN));
  const fresh = issues.filter((i) => !seen.has(issueKey(i.title)));

  // 학습 루프: 과거 지적사항 체크리스트를 작성 프롬프트에 주입
  const lessons = await getLessons();

  const out = {
    queued: [],
    published: [],
    held: [],
    scanned: issues.length,
    unreadable: 0,
    social: { ig: 0, fb: 0 },
    errors: [],
  };

  // 대기열이 이미 가득 차 있으면 새 글을 쓰지 않는다 (묵은 뉴스가 쌓이는 걸 막고 API 비용도 아낀다)
  const pending = await queueSize();
  if (pending >= QUEUE_MAX) {
    out.errors.push(`대기열 ${pending}건 — 이번 회차는 수집만 (다 소진되면 다시 씀)`);
    return out;
  }
  const room = Math.max(1, QUEUE_MAX - pending);
  let made = 0;

  // 분야 쏠림 방지: 최근 분포를 반영해 적게 나간 분야부터 번갈아 뽑도록 재배치
  const ordered = balanceByCategory(fresh, await recentCategoryCounts());

  for (const issue of ordered) {
    if (made >= Math.min(limit, room) || Date.now() > deadline) break;
    try {
      // 0) 원문 기사를 실제로 읽는다.
      //    못 읽으면 AI가 나머지를 상상해서 채우게 되므로 — 그 이슈는 아예 쓰지 않는다.
      const src = await resolveSourceText(issue);
      if (!src) {
        out.unreadable++;
        await sadd(K_SEEN, issueKey(issue.title)); // 다음 회차에 또 시도하지 않게
        continue;
      }
      const context = `${src.text}${issue.extra ? "\n(참고: " + issue.extra + ")" : ""}`;
      const sourceUrl = src.url;

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

      const passed = autoPublish && review.verdict === "publish";

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

      const post = {
        slug: makeSlug(cat.slug),
        title: draft.title,
        summary: draft.summary,
        category: finalCategory,
        date: today(),
        status: passed ? "published" : "draft",
        body: draft.body,
        hook: draft.hook,
        emoji: draft.emoji,
        mood: draft.mood,
        cover: cover?.url,
        imageCredit: cover?.credit,
        readMinutes: Math.max(2, Math.round(draft.body.length / 400)),
        tags: draft.tags,
        sources: [{ title: `원문 보기 (${issue.source})`, url: sourceUrl }],
        createdAt: new Date().toISOString(),
        quality: {
          score: review.score,
          fakeRisk: review.fakeRisk,
          verdict: review.verdict,
          reviewedAt: new Date().toISOString(),
          rounds,
          note: review.note,
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
          reason:
            review.fakeRisk !== "low"
              ? `가짜뉴스 위험 ${review.fakeRisk}`
              : `품질 미달 (${review.score}점)`,
        });
      }
    } catch (e) {
      out.errors.push(`${issue.title.slice(0, 22)}: ${e.message}`);
    }
  }

  return out;
}
