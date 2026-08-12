// 정기 품질 점검 (1일 3회) — 발행된 글과 검수함을 빠짐없이 훑는다.
//
//  A. 노션 동기화     — 사장님이 노션에서 손본 글을 홈페이지에 반영
//  B. 발행글 재감사   — 문제 있으면 즉시 내려서 검수함으로
//                       (가벼운 문제면 자동으로 고쳐서 계속 발행 유지)
//  B-2. 가이드 시효   — 확인한 지 오래된 꿀팁에 '갱신 필요' 표시만 단다 (내용은 안 건드림)
//  C. 검수함 구조     — 보류된 글을 개선해 기준 넘으면 발행 + SNS
//  D. 교훈 갱신       — 반복 지적을 체크리스트로 정제 → 다음 글부터 반영
//
// 매 회차 처리량을 제한해 크론 시간 안에 안전하게 끝낸다 (놓친 건 다음 회차가 이어받음).

import { auditPost, polishPost, isGuideDraft } from "@/lib/quality";
import { refreshLessons, recordReview } from "@/lib/learn";
import {
  getPublishedRaw,
  getDrafts,
  upsertPublished,
  unpublishPost,
  publishPost,
  archiveDraft,
  type Post,
} from "@/lib/posts";
import { staleGuides } from "@/lib/guideAge";
import { notionEnabled, setNotionStatus, listNotionByStatus } from "@/lib/notion";
import { syncFromNotion } from "@/lib/sync";
import { shareEverywhere, socialEnabled } from "@/lib/social";
import { revalidateTag } from "next/cache";

const AUDIT_PER_RUN = 8; // 회차당 재감사할 발행글 수
const RESCUE_PER_RUN = 4; // 회차당 구조 시도할 검수함 글 수
const RECHECK_HOURS = 36; // 이 시간이 지난 발행글은 다시 감사
const ARCHIVE_AFTER_DAYS = 7; // 이만큼 지난 '위험 high' 초안은 보관함으로
const ARCHIVE_PER_RUN = 25; // 회차당 보관 처리 상한
const STALE_MARK_PER_RUN = 20; // 회차당 '확인일 지남' 표시 상한 (한꺼번에 쓰지 않는다)
const RECONCILE_PER_RUN = 40; // 회차당 노션 표시 바로잡기 상한 (노션은 초당 3건 제한)

const nowIso = () => new Date().toISOString();
const hoursSince = (iso?: string) =>
  iso ? (Date.now() - new Date(iso).getTime()) / 36e5 : Infinity;
const daysSince = (iso?: string) => hoursSince(iso) / 24;

export interface AuditResult {
  synced: number;
  audited: number;
  fixed: { slug: string; title: string; score: number }[]; // 자동 개선 후 발행 유지
  pulled: { slug: string; title: string; reason: string }[]; // 내려서 검수함으로
  rescued: { slug: string; title: string; score: number }[]; // 검수함 → 발행
  archived: { slug: string; title: string }[]; // 검수함 → 보관함 (되돌릴 수 있음)
  stale: { slug: string; title: string; days: number }[]; // 확인일 지난 가이드 (표시만, 안 고침)
  formatFlagged: { slug: string; title: string; issues: string[] }[]; // 형식만 모자람 (발행 유지, 표시만)
  reconciled: { slug: string; title: string; to: string }[]; // 노션 표시를 홈페이지 실제와 맞춘 것
  recheckedHigh?: number; // 옛 심사가 찍은 '위험 high' 가이드를 다시 심사만 한 건수 (발행 안 함)
  notionFailed: number; // 노션에 반영하지 못한 횟수 (쌓이면 검수함이 유령으로 부푼다)
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
    archived: [],
    stale: [],
    formatFlagged: [],
    reconciled: [],
    notionFailed: 0,
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

      // 심사관 답을 못 읽었다 → 판정이 없는 것이다. 아무것도 건드리지 않고 넘긴다. (2026-08-11)
      //  감사 시각도 갱신하지 않는다 — 그래야 다음 회차에 이 글이 다시 후보로 올라온다.
      if (review.verdict === "skip") continue;

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
        // 못 고쳤는데 걸린 게 '형식'뿐이면 내리지 않는다.
        //
        // 왜: 형식 지적은 "본문을 1500자 이상으로 늘려라"인데, 개선 프롬프트는
        //     "없는 사실을 새로 만들지 마라"고 못 박는다. 두 지시가 정면으로 부딪혀서
        //     AI가 몇 번을 돌려도 절대 통과하지 못하는 자리다.
        //     내려봐야 고쳐지지 않고 검수함만 쌓인다 — 2026-08-08 실측 21건.
        //     사실관계는 멀쩡하므로 발행은 유지하고, 무엇이 모자란지 표시만 남겨
        //     2일 점검 리포트에서 사람이 보게 한다.
        if (recheck.formatOnly) {
          post.auditedAt = nowIso();
          post.needsFormat = { issues: recheck.formatIssues ?? [], flaggedAt: nowIso() };
          post.quality = {
            score: recheck.score,
            fakeRisk: recheck.fakeRisk,
            verdict: "publish",
            reviewedAt: nowIso(),
            rounds: (post.quality?.rounds ?? 0) + 1,
            note: recheck.note,
          };
          await upsertPublished(post);
          out.formatFlagged.push({
            slug: post.slug,
            title: post.title,
            issues: recheck.formatIssues ?? [],
          });
          continue;
        }
        // 고쳐 쓴 뒤 재심사에서 답을 못 읽었으면, 그것도 판정이 아니다. 내리지 않는다. (2026-08-11)
        if (recheck.verdict === "skip") continue;
        review.note = recheck.note || review.note;
        review.score = recheck.score;
        // 【2026-08-12 — 위험도도 함께 갱신한다】
        //   여기서 fakeRisk 를 안 넘겨서, 1차 감사가 medium 이면 재심사가 low·100점을 줘도
        //   아래 사유 만들기에서 여전히 「가짜뉴스 위험 medium」으로 내려갔다.
        //   1차 medium 의 상당수는 진짜 위험이 아니라 <fakeRisk> 태그를 못 읽어 medium 으로
        //   '가정'한 경우였다. 고쳐 쓴 뒤의 판정이 최신 판정이다.
        review.fakeRisk = recheck.fakeRisk;
      }

      // 개선해도 기준 미달, 또는 가짜뉴스 위험 → 내린다
      const reason =
        review.fakeRisk !== "low"
          ? `가짜뉴스 위험 ${review.fakeRisk}: ${review.note}`
          : `품질 미달 (${review.score}점): ${review.note}`;
      await unpublishPost(post.slug, reason);
      if (notionEnabled && post.notionId) {
        if (!(await setNotionStatus(post.notionId, "검수필요", reason))) out.notionFailed++;
      }
      out.pulled.push({ slug: post.slug, title: post.title, reason });
    } catch (e) {
      out.errors.push(`재감사 ${post.slug}: ${(e as Error).message}`);
    }
  }

  // ---- B-2. 가이드 시효 점검 (내용은 절대 건드리지 않는다) ----
  // OS·앱은 해마다 바뀐다. 오래된 가이드는 '틀렸다'가 아니라 '확인이 필요하다'.
  // 사실이 정말 바뀌었는지는 공식 문서를 사람이 봐야 알 수 있으므로
  // 표시만 달아 두고 2일 점검 리포트로 넘긴다. 자동으로 고치거나 내리지 않는다.
  try {
    let marked = 0;
    for (const { post, days } of staleGuides(published)) {
      out.stale.push({ slug: post.slug, title: post.title, days });
      if (post.staleGuide) continue; // 이미 표시된 글은 다시 저장하지 않는다
      if (marked >= STALE_MARK_PER_RUN) continue; // 남은 것은 다음 회차가 이어받는다
      post.staleGuide = { flaggedAt: nowIso(), days };
      await upsertPublished(post);
      marked++;
    }
  } catch (e) {
    out.errors.push(`가이드 시효 점검: ${(e as Error).message}`);
  }

  // ---- C. 검수함 구조 (품질을 확실히 올린 것만 발행) ----
  let drafts: Post[] = [];
  try {
    drafts = await getDrafts();
  } catch (e) {
    out.errors.push(`검수함 로드: ${(e as Error).message}`);
  }

  // ---- C-1. 검수함 청소 (오래 묵은 '위험 high' → 보관함) ----
  // 가짜뉴스 위험 high 는 자동 구조 대상이 아니라서, 치우는 규칙이 없으면 영원히 쌓인다.
  // 만든 지 오래된 것부터 보관함으로 옮긴다. 지우는 게 아니라 자리만 옮기는 것이라
  // 언제든 되돌릴 수 있고, 검수함은 사람이 실제로 볼 수 있는 크기로 유지된다.
  const stale = drafts
    .filter((p) => p.quality?.fakeRisk === "high")
    .filter((p) => daysSince(p.createdAt ?? p.date) >= ARCHIVE_AFTER_DAYS)
    .sort((a, b) => ((a.createdAt ?? "") < (b.createdAt ?? "") ? -1 : 1)) // 오래된 것부터
    .slice(0, ARCHIVE_PER_RUN);

  const archivedSlugs = new Set<string>();
  for (const post of stale) {
    try {
      const reason = `가짜뉴스 위험 high · ${ARCHIVE_AFTER_DAYS}일 경과 → 보관 (되돌릴 수 있음)`;
      await archiveDraft(post.slug, reason);
      archivedSlugs.add(post.slug);
      if (notionEnabled && post.notionId) {
        if (!(await setNotionStatus(post.notionId, "보관", reason))) out.notionFailed++;
      }
      out.archived.push({ slug: post.slug, title: post.title });
    } catch (e) {
      out.errors.push(`보관 ${post.slug}: ${(e as Error).message}`);
    }
  }

  const 후보 = drafts
    .filter((p) => !archivedSlugs.has(p.slug))
    // 위험 주제(초기화·삭제·비밀번호·결제·세금)는 자동 구조 금지.
    // 이걸 빼먹으면 파이프라인이 검수함으로 보낸 글을 감사가 다시 발행해버려
    // '자동 발행 금지'가 통째로 무력화된다.
    .filter((p) => !p.risky)
    .filter((p) => (p.quality?.rounds ?? 0) < 3); // 3번 실패하면 그만 시도

  // 【위험 high 를 어떻게 다루나 — 2026-08-12】
  //   원칙은 그대로다: high 는 자동으로 발행하지 않는다. 사람이 봐야 한다.
  //   다만 검수함에 갇힌 가이드 30편의 high 는 '뉴스용 원문대조로 가이드를 심사한' 옛 심사가
  //   찍은 값이다. 그 심사를 오늘 고쳤으므로, 낡은 판정을 그대로 둔 채 영원히 가둬둘 이유가 없다.
  //   → 가이드는 다시 심사만 해서 판정을 새로 적는다. 발행은 하지 않는다.
  //     새 심사에서 위험이 실제로 내려가면 다음 회차에 평소 규칙대로 구조된다.
  //   뉴스의 high 는 진짜 환각일 수 있으므로 손대지 않는다.
  const 재심사만 = 후보
    .filter((p) => p.quality?.fakeRisk === "high" && isGuideDraft(p))
    .slice(0, RESCUE_PER_RUN);

  for (const post of 재심사만) {
    try {
      const 다시 = await auditPost(post);
      if (다시.verdict === "skip") continue; // 판정을 못 받았으면 아무것도 바꾸지 않는다
      post.quality = {
        ...(post.quality ?? {}),
        score: 다시.score,
        fakeRisk: 다시.fakeRisk,
        verdict: 다시.verdict,
        reviewedAt: nowIso(),
        rounds: post.quality?.rounds ?? 0, // 재심사는 '구조 시도'가 아니므로 횟수를 올리지 않는다
        note: 다시.note,
      };
      const { saveDraft } = await import("@/lib/posts");
      await saveDraft(post);
      out.recheckedHigh = (out.recheckedHigh ?? 0) + 1;
    } catch (e) {
      out.errors.push(`재심사 ${post.slug}: ${(e as Error).message}`);
    }
  }

  const rescuable = 후보
    .filter((p) => p.quality?.fakeRisk !== "high")
    .slice(0, RESCUE_PER_RUN);

  const rescuedPosts: Post[] = [];
  for (const post of rescuable) {
    try {
      const before = await auditPost(post);
      const fixed = await polishPost(post, before);

      // 【2026-08-12 — 구조가 수학적으로 불가능했던 자리】
      //   여기서 reviewDraft 를 부르며 '원문' 자리에 post.summary(한 줄 요약)를 넣고 있었다.
      //   reviewDraft 는 그걸 원문 기사로 알고 본문의 두 자리 이상 숫자를 전부
      //   「원문에 없는 수치」로 판정한다 → 점수 55 상한 + 위험 medium → 60점 문턱 아래 → hold.
      //   어떤 글도 통과할 수 없었고, 실패할 때마다 rounds 가 1씩 올라 3회 뒤 영구 제외됐다.
      //   원문(facts)은 글에 저장돼 있지 않다. 없는 근거를 지어내 넘기는 대신,
      //   원문 없이 심사하는 경로를 쓴다 — 발행글 재감사가 매일 쓰는 바로 그 심사다.
      const after = await auditPost({ ...post, ...fixed });

      // 판정을 못 받은 회차는 실패로 세지 않는다 (rounds 를 올리면 3회 만에 영구 제외된다)
      if (after.verdict === "skip") continue;

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
          if (!(await setNotionStatus(post.notionId, "발행", `자동 개선 ${rounds}회 → ${after.score}점`)))
            out.notionFailed++;
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

  // ---- C-2. 노션 ↔ 홈페이지 대조 (표시가 실제와 다른 것 맞추기) ----
  //
  // 왜 필요한가 (2026-08-08):
  //   노션에 상태를 쓰다 실패하면 홈페이지와 노션이 갈라진다. 홈페이지에서는 지워지거나
  //   보관됐는데 노션에는 '검수필요'로 남는다. 이 유령이 152건까지 쌓여서
  //   사장님이 검수함을 열어봐도 뭘 봐야 하는지 알 수 없는 상태가 됐다.
  //   그래서 회차마다 노션 검수함을 홈페이지 실제와 대조해 표시를 바로잡는다.
  //   ※ 여기서는 홈페이지를 고치지 않는다. 노션 '표시'만 실제에 맞춘다.
  // ※ 홈페이지를 한 글자도 못 읽은 회차에는 대조하지 않는다.
  //    Redis가 잠깐 죽었을 때 '홈페이지에 없음'으로 오해해서
  //    멀쩡한 검수 대기 글을 통째로 보관으로 밀어버리는 사고를 막는다.
  const 홈페이지읽힘 = published.length > 0 || drafts.length > 0;
  if (notionEnabled && 홈페이지읽힘) {
    try {
      const { getPostBySlug } = await import("@/lib/posts");
      const 노션검수함 = await listNotionByStatus("검수필요", 300);
      let 고친수 = 0;
      for (const page of 노션검수함) {
        if (고친수 >= RECONCILE_PER_RUN) break; // 남은 건 다음 회차가 이어받는다
        if (!page.slug) continue; // slug 없으면 짝을 확신할 수 없다 — 건드리지 않는다
        const post = await getPostBySlug(page.slug);
        const 실제 = post?.status ?? "없음";
        if (실제 === "draft") continue; // 노션과 홈페이지가 일치 — 진짜 검수 대기
        const 맞출상태 =
          실제 === "published" ? "발행" : 실제 === "queued" ? "예약" : "보관";
        const 사유 =
          실제 === "없음"
            ? "홈페이지에 없는 글 — 노션 표시만 남아 있어 정리"
            : `홈페이지 실제 상태(${실제})에 맞춤`;
        if (await setNotionStatus(page.id, 맞출상태, 사유)) {
          out.reconciled.push({ slug: page.slug, title: page.title, to: 맞출상태 });
          고친수++;
        } else {
          out.notionFailed++;
        }
      }
    } catch (e) {
      out.errors.push(`노션 대조: ${(e as Error).message}`);
    }
  }

  // ---- 캐시 갱신 ----
  if (out.fixed.length || out.pulled.length || out.rescued.length || out.archived.length || out.synced) {
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
