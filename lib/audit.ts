// 정기 품질 점검 (1일 3회) — 발행된 글과 검수함을 빠짐없이 훑는다.
//
//  A. 노션 동기화     — 사장님이 노션에서 손본 글을 홈페이지에 반영
//  B. 발행글 재감사   — 문제 있으면 즉시 내려서 검수함으로
//                       (가벼운 문제면 자동으로 고쳐서 계속 발행 유지)
//  C. 검수함 구조     — 보류된 글을 개선해 기준 넘으면 발행 + SNS
//  D. 교훈 갱신       — 반복 지적을 체크리스트로 정제 → 다음 글부터 반영
//
// 매 회차 처리량을 제한해 크론 시간 안에 안전하게 끝낸다 (놓친 건 다음 회차가 이어받음).

import { auditPost, polishPost, reviewDraft } from "@/lib/quality";
import { refreshLessons, recordReview } from "@/lib/learn";
import {
  getPublishedRaw,
  getDrafts,
  upsertPublished,
  unpublishPost,
  publishPost,
  type Post,
} from "@/lib/posts";
import { notionEnabled, setNotionStatus } from "@/lib/notion";
import { syncFromNotion } from "@/lib/sync";
import { shareEverywhere, socialEnabled } from "@/lib/social";
import { revalidateTag } from "next/cache";

const AUDIT_PER_RUN = 8; // 회차당 재감사할 발행글 수
const RESCUE_PER_RUN = 4; // 회차당 구조 시도할 검수함 글 수
const RECHECK_HOURS = 36; // 이 시간이 지난 발행글은 다시 감사

const nowIso = () => new Date().toISOString();
const hoursSince = (iso?: string) =>
  iso ? (Date.now() - new Date(iso).getTime()) / 36e5 : Infinity;

export interface AuditResult {
  synced: number;
  audited: number;
  fixed: { slug: string; title: string; score: number }[]; // 자동 개선 후 발행 유지
  pulled: { slug: string; title: string; reason: string }[]; // 내려서 검수함으로
  rescued: { slug: string; title: string; score: number }[]; // 검수함 → 발행
  social: { ig: number; fb: number };
  lessons: string;
  errors: string[];
}

export async function runAudit(opts: { share?: boolean } = {}): Promise<AuditResult> {
  const share = opts.share !== false;
  const out: AuditResult = {
    synced: 0,
    audited: 0,
    fixed: [],
    pulled: [],
    rescued: [],
    social: { ig: 0, fb: 0 },
    lessons: "",
    errors: [],
  };

  // ---- A. 노션 → 홈페이지 동기화 ----
  try {
    const s = await syncFromNotion();
    out.synced = s.synced.length;
  } catch (e) {
    out.errors.push(`노션 동기화: ${(e as Error).message}`);
  }

  // ---- B. 발행글 재감사 ----
  let published: Post[] = [];
  try {
    published = await getPublishedRaw();
  } catch (e) {
    out.errors.push(`발행글 로드: ${(e as Error).message}`);
  }

  // 아직 감사 안 한 글 → 감사한 지 오래된 글 순으로
  const queue = published
    .filter((p) => hoursSince(p.auditedAt) >= RECHECK_HOURS)
    .sort((a, b) => hoursSince(b.auditedAt) - hoursSince(a.auditedAt))
    .slice(0, AUDIT_PER_RUN);

  for (const post of queue) {
    try {
      const review = await auditPost(post);
      out.audited++;
      await recordReview(
        {
          date: new Date().toISOString().slice(0, 10),
          score: review.score,
          verdict: review.verdict,
          fakeRisk: review.fakeRisk,
        },
        review.issues,
      );

      if (review.verdict === "publish") {
        // 이상 없음 — 감사 시각만 갱신
        post.auditedAt = nowIso();
        post.quality = {
          score: review.score,
          fakeRisk: review.fakeRisk,
          verdict: review.verdict,
          reviewedAt: nowIso(),
          rounds: post.quality?.rounds ?? 0,
          note: review.note,
        };
        await upsertPublished(post);
        continue;
      }

      if (review.verdict === "revise") {
        // 가벼운 문제 → 자동으로 고쳐서 발행 유지
        const fixed = await polishPost(post, review);
        const recheck = await auditPost({ ...post, ...fixed });
        if (recheck.verdict === "publish") {
          Object.assign(post, fixed);
          post.hook = fixed.hook || post.hook;
          post.auditedAt = nowIso();
          post.quality = {
            score: recheck.score,
            fakeRisk: recheck.fakeRisk,
            verdict: "publish",
            reviewedAt: nowIso(),
            rounds: (post.quality?.rounds ?? 0) + 1,
            note: recheck.note,
          };
          await upsertPublished(post);
          out.fixed.push({ slug: post.slug, title: post.title, score: recheck.score });
          continue;
        }
        review.note = recheck.note || review.note;
        review.score = recheck.score;
      }

      // 개선해도 기준 미달, 또는 가짜뉴스 위험 → 내린다
      const reason =
        review.fakeRisk !== "low"
          ? `가짜뉴스 위험 ${review.fakeRisk}: ${review.note}`
          : `품질 미달 (${review.score}점): ${review.note}`;
      await unpublishPost(post.slug, reason);
      if (notionEnabled && post.notionId) {
        await setNotionStatus(post.notionId, "검수필요", reason);
      }
      out.pulled.push({ slug: post.slug, title: post.title, reason });
    } catch (e) {
      out.errors.push(`재감사 ${post.slug}: ${(e as Error).message}`);
    }
  }

  // ---- C. 검수함 구조 (품질을 확실히 올린 것만 발행) ----
  let drafts: Post[] = [];
  try {
    drafts = await getDrafts();
  } catch (e) {
    out.errors.push(`검수함 로드: ${(e as Error).message}`);
  }

  // 가짜뉴스 위험 high 는 자동 구조하지 않는다 (사람이 봐야 함)
  const rescuable = drafts
    .filter((p) => p.quality?.fakeRisk !== "high")
    .filter((p) => (p.quality?.rounds ?? 0) < 3) // 3번 실패하면 그만 시도
    .slice(0, RESCUE_PER_RUN);

  const rescuedPosts: Post[] = [];
  for (const post of rescuable) {
    try {
      const before = await auditPost(post);
      const fixed = await polishPost(post, before);
      const after = await reviewDraft(
        { title: fixed.title, summary: fixed.summary, body: fixed.body },
        {
          title: post.title,
          context: post.summary,
          from: post.sources?.[0]?.title ?? "원문",
          url: post.sources?.[0]?.url,
        },
      );

      const rounds = (post.quality?.rounds ?? 0) + 1;
      Object.assign(post, fixed);
      post.hook = fixed.hook || post.hook;
      post.quality = {
        score: after.score,
        fakeRisk: after.fakeRisk,
        verdict: after.verdict,
        reviewedAt: nowIso(),
        rounds,
        note: after.note,
      };

      if (after.verdict === "publish") {
        post.status = "published";
        post.publishedAt = nowIso();
        post.auditedAt = nowIso();
        await upsertPublished(post);
        await publishPost(post.slug);
        if (notionEnabled && post.notionId) {
          await setNotionStatus(post.notionId, "발행", `자동 개선 ${rounds}회 → ${after.score}점`);
        }
        rescuedPosts.push(post);
        out.rescued.push({ slug: post.slug, title: post.title, score: after.score });
      } else {
        // 아직 부족 — 개선된 상태로 검수함에 남겨둔다 (다음 회차에 다시 시도)
        const { saveDraft } = await import("@/lib/posts");
        await saveDraft(post);
      }
    } catch (e) {
      out.errors.push(`구조 ${post.slug}: ${(e as Error).message}`);
    }
  }

  // ---- 캐시 갱신 ----
  if (out.fixed.length || out.pulled.length || out.rescued.length || out.synced) {
    try {
      revalidateTag("posts", "max");
    } catch {
      /* ignore */
    }
  }

  // ---- 구조된 글 SNS 게시 ----
  if (share && socialEnabled && rescuedPosts.length) {
    for (const post of rescuedPosts) {
      try {
        if (post.social?.ig) continue; // 이미 올라간 건 중복 게시 금지
        const r = await shareEverywhere(post);
        if (r.ig) out.social.ig++;
        if (r.fb) out.social.fb++;
        if (r.errors.length) out.errors.push(...r.errors);
        post.social = { ig: r.ig, fb: r.fb, at: nowIso() };
        await upsertPublished(post);
      } catch (e) {
        out.errors.push(`SNS ${post.slug}: ${(e as Error).message}`);
      }
    }
  }

  // ---- D. 교훈 갱신 (다음 글부터 같은 실수 반복 안 함) ----
  try {
    out.lessons = await refreshLessons();
  } catch (e) {
    out.errors.push(`교훈 갱신: ${(e as Error).message}`);
  }

  return out;
}
