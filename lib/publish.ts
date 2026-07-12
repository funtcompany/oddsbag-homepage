// 예약 발행 — 대기열에서 시간이 된 글만 하나씩 꺼내 올린다.
//
// 수집 크론이 한 번에 4~5건을 써도 그게 동시에 쏟아지지 않는다.
// 45분 간격으로 배정된 시각이 되면 이 크론이 하나씩 올린다.
// → 홈페이지가 하루 종일 살아 움직이는 느낌.

import { getQueued, releaseFromQueue, upsertPublished, type Post } from "@/lib/posts";
import { notionEnabled, setNotionStatus } from "@/lib/notion";
import { shareEverywhere, socialEnabled } from "@/lib/social";
import { revalidateTag } from "next/cache";

const MAX_PER_RUN = 3; // 밀린 게 있어도 한 번에 이만큼만 (몰아치기 방지)

export interface PublishResult {
  published: { slug: string; title: string; score: number }[];
  waiting: number; // 아직 시각이 안 된 대기열
  nextAt?: string; // 다음 글이 올라갈 시각
  social: { ig: number; fb: number };
  errors: string[];
}

export async function runPublish(): Promise<PublishResult> {
  const out: PublishResult = {
    published: [],
    waiting: 0,
    social: { ig: 0, fb: 0 },
    errors: [],
  };

  let queue: Post[] = [];
  try {
    queue = await getQueued();
  } catch (e) {
    out.errors.push(`대기열 로드: ${(e as Error).message}`);
    return out;
  }

  const now = Date.now();
  const due = queue.filter((p) => new Date(p.publishAt ?? 0).getTime() <= now).slice(0, MAX_PER_RUN);
  const rest = queue.filter((p) => !due.includes(p));
  out.waiting = rest.length;
  out.nextAt = rest[0]?.publishAt;

  if (due.length === 0) return out;

  const released: Post[] = [];
  for (const post of due) {
    try {
      await releaseFromQueue(post);
      if (notionEnabled && post.notionId) {
        await setNotionStatus(post.notionId, "발행");
      }
      released.push(post);
      out.published.push({
        slug: post.slug,
        title: post.title,
        score: post.quality?.score ?? 0,
      });
    } catch (e) {
      out.errors.push(`발행 ${post.slug}: ${(e as Error).message}`);
    }
  }

  // 홈페이지 즉시 반영
  if (released.length) {
    try {
      revalidateTag("posts", "max");
    } catch {
      /* ignore */
    }
  }

  // SNS 게시 (캐시 갱신 후에 해야 인스타가 카드 이미지를 가져갈 수 있다)
  if (socialEnabled) {
    for (const post of released) {
      try {
        const r = await shareEverywhere(post);
        if (r.capped) {
          out.errors.push("SNS 하루 한도 도달 — 홈페이지에만 발행");
          break;
        }
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
