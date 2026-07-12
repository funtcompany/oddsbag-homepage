// 오즈백 콘텐츠 자동화 파이프라인 (실시간 발행 + 품질 게이트)
//
//   수집 → AI 작성 → [AI 심사관] ─┬─ 통과(80점↑·위험낮음) → 즉시 발행 → 인스타/페북 게시
//                                 ├─ 보통(62~79점)        → 자동 개선 1회 → 재심사 → 통과 시 발행
//                                 └─ 미달·가짜뉴스 위험    → 검수함(노션 '검수필요')
//
// 원칙: 속도보다 신뢰. 가짜뉴스 위험이 조금이라도 있으면 절대 자동 발행하지 않는다.

import { collectAllIssues } from "@/lib/aggregate";
import { generateDraft } from "@/lib/ai";
import { reviewDraft, reviseDraft, type Review } from "@/lib/quality";
import { getLessons, recordReview } from "@/lib/learn";
import { saveDraft, upsertPublished, type Post } from "@/lib/posts";
import { categoryOf } from "@/lib/categories";
import { sadd, smembers } from "@/lib/store";
import { notionEnabled, addCollectedPage } from "@/lib/notion";
import { findCoverImage } from "@/lib/images";
import { shareEverywhere, socialEnabled } from "@/lib/social";
import { revalidateTag } from "next/cache";
import type { IssueSource } from "@/lib/sources";

const K_SEEN = "issues:seen";

const today = () => new Date().toISOString().slice(0, 10);
const issueKey = (t: string) => t.replace(/\s+/g, "").slice(0, 30);

function makeSlug(categorySlug: string): string {
  const t = Date.now().toString(36);
  const r = Math.abs((Date.now() * 7919) % 1_000_000).toString(36);
  return `${categorySlug}-${t}${r}`;
}

export interface CollectResult {
  published: { slug: string; title: string; score: number }[];
  held: { title: string; score: number; reason: string }[];
  scanned: number;
  social: { ig: number; fb: number };
  errors: string[];
}

export async function runCollection(opts: {
  sources: IssueSource[];
  limit?: number;
  autoPublish?: boolean; // 기본 true (실시간 발행)
  share?: boolean; // 기본 true (SNS 동시 게시)
}): Promise<CollectResult> {
  const limit = Math.min(Math.max(opts.limit ?? 5, 1), 12);
  const autoPublish = opts.autoPublish !== false;
  const share = opts.share !== false;

  const issues = await collectAllIssues(opts.sources);
  const seen = new Set(await smembers(K_SEEN));
  const fresh = issues.filter((i) => !seen.has(issueKey(i.title)));

  // 학습 루프: 과거 지적사항 체크리스트를 작성 프롬프트에 주입
  const lessons = await getLessons();

  const out: CollectResult = {
    published: [],
    held: [],
    scanned: issues.length,
    social: { ig: 0, fb: 0 },
    errors: [],
  };
  let made = 0;
  const freshPosts: Post[] = []; // 방금 발행한 Post 원본 (SNS 게시용)

  for (const issue of fresh) {
    if (made >= limit) break;
    try {
      const context = `${issue.summary}${issue.extra ? " / " + issue.extra : ""}`;

      // 1) 작성
      let draft = await generateDraft(issue.title, context, issue.category, lessons);

      // 2) 심사 (원문과 대조 — 환각·가짜뉴스 검사)
      let review: Review = await reviewDraft(draft, {
        title: issue.title,
        context,
        from: issue.source,
        url: issue.link,
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
          url: issue.link,
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
        sources: [{ title: `원문 보기 (${issue.source})`, url: issue.link }],
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
        // ---- 즉시 발행 ----
        post.publishedAt = new Date().toISOString();
        await upsertPublished(post);
        if (notionEnabled) {
          try {
            post.notionId = await addCollectedPage(post, "발행");
            await upsertPublished(post); // notionId 반영
          } catch (e) {
            out.errors.push(`노션 기록: ${(e as Error).message}`);
          }
        }
        freshPosts.push(post);
        out.published.push({ slug: post.slug, title: post.title, score: review.score });
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

  // 5) 캐시 갱신 → 홈페이지 즉시 반영
  if (out.published.length) {
    try {
      revalidateTag("posts", "max");
    } catch {
      /* ignore */
    }
  }

  // 6) SNS 동시 게시 (발행된 것만, 실패해도 홈페이지는 유지)
  //    캐시 갱신 후에 해야 /api/card 가 새 글을 찾을 수 있다.
  if (share && socialEnabled && freshPosts.length) {
    for (const post of freshPosts) {
      try {
        const r = await shareEverywhere(post);
        if (r.ig) out.social.ig++;
        if (r.fb) out.social.fb++;
        if (r.errors.length) out.errors.push(...r.errors);
        post.social = { ig: r.ig, fb: r.fb, at: new Date().toISOString() };
        await upsertPublished(post);
      } catch (e) {
        out.errors.push(`SNS ${post.slug}: ${(e as Error).message}`);
      }
    }
  }

  return out;
}
