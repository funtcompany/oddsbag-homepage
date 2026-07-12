// 오즈백 콘텐츠 자동화 파이프라인 (실시간 발행 + 품질 게이트)
//
//   수집 → AI 작성 → [AI 심사관] ─┬─ 통과(80점↑·위험낮음) → 즉시 발행 → 인스타/페북 게시
//                                 ├─ 보통(62~79점)        → 자동 개선 1회 → 재심사 → 통과 시 발행
//                                 └─ 미달·가짜뉴스 위험    → 검수함(노션 '검수필요')
//
// 원칙: 속도보다 신뢰. 가짜뉴스 위험이 조금이라도 있으면 절대 자동 발행하지 않는다.

import { collectAllIssues } from "@/lib/aggregate";
import { generateDraft, type DraftDraft } from "@/lib/ai";
import { reviewDraft, reviseDraft, type Review } from "@/lib/quality";
import { getLessons, recordReview } from "@/lib/learn";
import { saveDraft, queuePost, queueSize, type Post } from "@/lib/posts";
import { categoryOf } from "@/lib/categories";
import { sadd, smembers } from "@/lib/store";
import { notionEnabled, addCollectedPage } from "@/lib/notion";
import { findCoverImage } from "@/lib/images";
import { resolveSourceText } from "@/lib/article";
import { kvGet, kvSet } from "@/lib/store";
import type { IssueSource } from "@/lib/sources";

const K_SEEN = "issues:seen";

const today = () => new Date().toISOString().slice(0, 10);
const issueKey = (t: string) => t.replace(/\s+/g, "").slice(0, 30);

function makeSlug(categorySlug: string): string {
  const t = Date.now().toString(36);
  const r = Math.abs((Date.now() * 7919) % 1_000_000).toString(36);
  return `${categorySlug}-${t}${r}`;
}

// 예약 발행 간격 — 이 간격으로 하나씩 올라간다 (홈페이지가 하루 종일 살아있게)
const GAP_MIN = Number(process.env.PUBLISH_GAP_MIN || 45);
const QUEUE_MAX = Number(process.env.QUEUE_MAX || 12); // 대기열이 이만큼 차면 새로 쓰지 않는다 (묵은 뉴스 방지 + 비용 절약)
const K_NEXT_AT = "queue:nextAt";

// 다음 글이 올라갈 시각을 잡는다 (약간의 랜덤을 섞어 기계적이지 않게)
async function nextSlot(): Promise<Date> {
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

export interface CollectResult {
  queued: { slug: string; title: string; score: number; at: string }[];
  published: { slug: string; title: string; score: number }[];
  held: { title: string; score: number; reason: string }[];
  scanned: number;
  unreadable: number; // 원문을 읽지 못해 건너뛴 이슈 (지어내지 않기 위해)
  social: { ig: number; fb: number };
  errors: string[];
}

export async function runCollection(opts: {
  sources: IssueSource[];
  limit?: number;
  autoPublish?: boolean; // 기본 true (심사 통과 시 예약 대기열로)
  budgetMs?: number; // 작성에 쓸 시간 예산 (넘으면 다음 회차로 넘김)
}): Promise<CollectResult> {
  const limit = Math.min(Math.max(opts.limit ?? 5, 1), 12);
  const autoPublish = opts.autoPublish !== false;
  // 크론이 시간 초과로 죽지 않게 — 남은 건 다음 회차(30분 뒤)가 이어받는다
  const deadline = Date.now() + (opts.budgetMs ?? 540_000);

  const issues = await collectAllIssues(opts.sources);
  const seen = new Set(await smembers(K_SEEN));
  const fresh = issues.filter((i) => !seen.has(issueKey(i.title)));

  // 학습 루프: 과거 지적사항 체크리스트를 작성 프롬프트에 주입
  const lessons = await getLessons();

  const out: CollectResult = {
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

  for (const issue of fresh) {
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
      let draft: DraftDraft;
      try {
        draft = await generateDraft(issue.title, context, issue.category, lessons);
      } catch {
        draft = await generateDraft(issue.title, context, issue.category, lessons);
      }

      // 2) 심사 (원문과 대조 — 환각·가짜뉴스 검사)
      let review: Review = await reviewDraft(draft, {
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

      const post: Post = {
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
            out.errors.push(`노션 기록: ${(e as Error).message}`);
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
            out.errors.push(`노션 기록: ${(e as Error).message}`);
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
      out.errors.push(`${issue.title.slice(0, 22)}: ${(e as Error).message}`);
    }
  }

  return out;
}
