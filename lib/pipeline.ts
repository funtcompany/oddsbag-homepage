// 수집 → AI 초안 → 검수함(draft) 저장 파이프라인
// 관리자 수동 수집과 1시간 크론이 공용으로 사용.

import { collectAllIssues } from "@/lib/aggregate";
import { generateDraft } from "@/lib/ai";
import { saveDraft, type Post } from "@/lib/posts";
import { categoryOf } from "@/lib/categories";
import { sadd } from "@/lib/store";
import { smembers } from "@/lib/store";
import { notionEnabled, addCollectedPage } from "@/lib/notion";
import type { IssueSource } from "@/lib/sources";

const K_SEEN = "issues:seen"; // 이미 처리한 이슈 (중복 방지)

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function issueKey(title: string): string {
  return title.replace(/\s+/g, "").slice(0, 30);
}

function makeSlug(categorySlug: string): string {
  const t = Date.now().toString(36);
  const r = Math.abs((Date.now() * 7919) % 1_000_000).toString(36);
  return `${categorySlug}-${t}${r}`;
}

export interface CollectResult {
  created: { slug: string; title: string; category: string; source: string }[];
  scanned: number;
  errors: string[];
}

export async function runCollection(opts: {
  sources: IssueSource[];
  limit?: number;
}): Promise<CollectResult> {
  const limit = Math.min(Math.max(opts.limit ?? 5, 1), 12);
  const issues = await collectAllIssues(opts.sources);

  const seen = new Set(await smembers(K_SEEN));
  const fresh = issues.filter((i) => !seen.has(issueKey(i.title)));

  const created: CollectResult["created"] = [];
  const errors: string[] = [];
  let made = 0;

  for (const issue of fresh) {
    if (made >= limit) break;
    try {
      const draft = await generateDraft(
        issue.title,
        `${issue.summary}${issue.extra ? " / " + issue.extra : ""}`,
        issue.category,
      );
      const cat = categoryOf(issue.category);
      const slug = makeSlug(cat.slug);
      const post: Post = {
        slug,
        title: draft.title,
        summary: draft.summary,
        category: issue.category,
        date: today(),
        status: "draft",
        body: draft.body,
        emoji: draft.emoji,
        readMinutes: Math.max(2, Math.round(draft.body.length / 400)),
        tags: draft.tags,
        sources: [
          {
            title: `원문 보기 (${issue.source})`,
            url: issue.link,
          },
        ],
        createdAt: new Date().toISOString(),
      };
      // 노션 허브가 설정돼 있으면 노션 수집함으로, 아니면 Redis 검수함으로
      if (notionEnabled) await addCollectedPage(post);
      else await saveDraft(post);
      await sadd(K_SEEN, issueKey(issue.title));
      created.push({
        slug,
        title: post.title,
        category: issue.category,
        source: issue.source,
      });
      made++;
    } catch (e) {
      errors.push(`${issue.title.slice(0, 20)}: ${(e as Error).message}`);
    }
  }

  return { created, scanned: issues.length, errors };
}
