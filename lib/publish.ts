// 예약 발행 — 대기열에서 시간이 된 글만 하나씩 꺼내 올린다.
//
// 수집 크론이 한 번에 여러 건을 써도 그게 동시에 쏟아지지 않는다.
// 배정된 시각이 되면 이 크론이 하나씩 올리고, 하루 총량은 아래 상한이 지킨다.
// → 편수를 줄인 만큼 글 한 편의 품질에 예산을 몰아준다.

import { getQueued, getPublishedRaw, releaseFromQueue, upsertPublished, type Post } from "@/lib/posts";
import { notionEnabled, setNotionStatus } from "@/lib/notion";
import { shareEverywhere, socialEnabled } from "@/lib/social";
import { revalidateTag } from "next/cache";

const MAX_PER_RUN = Number(process.env.PUBLISH_MAX_PER_RUN || 1); // 한 회차에 올리는 글 수

// 【하루 2편 정책】 홈페이지도 하루 2편까지만 올린다.
// 많이 쓰는 대신 잘 쓰는 쪽으로 — 글 한 편에 들어가는 품질 투자를 늘리기 위함.
const DAILY_CAP = Number(process.env.PUBLISH_DAILY_CAP || 2);

// 하루 기준은 한국 시간 (UTC로 세면 오전 9시에 날짜가 바뀐다)
const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const kstOf = (iso?: string) =>
  iso ? new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10) : "";

// 오늘(한국 시간) 이미 올라간 글 수
async function publishedToday(): Promise<number> {
  try {
    const all = await getPublishedRaw();
    const day = kstDay();
    return all.filter((p) => kstOf(p.publishedAt ?? p.date) === day).length;
  } catch {
    return 0; // 못 세면 막지 않는다 (발행이 멈추는 게 더 나쁘다)
  }
}

export interface PublishResult {
  published: { slug: string; title: string; score: number }[];
  waiting: number; // 아직 시각이 안 된 대기열
  nextAt?: string; // 다음 글이 올라갈 시각
  social: { ig: number; fb: number };
  dailyCapped?: string;
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

  // 오늘치를 다 올렸으면 대기열은 그대로 두고 내일 올린다
  const doneToday = await publishedToday();
  const room = Math.max(0, DAILY_CAP - doneToday);
  if (room === 0) {
    out.waiting = queue.length;
    out.nextAt = queue[0]?.publishAt;
    out.dailyCapped = `오늘 ${doneToday}편 — 하루 상한(${DAILY_CAP}편) 도달`;
    return out;
  }

  const now = Date.now();
  const due = queue
    .filter((p) => new Date(p.publishAt ?? 0).getTime() <= now)
    .slice(0, Math.min(MAX_PER_RUN, room));
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
  // 어느 채널에 올릴지는 lib/social.ts 가 정한다 (인스타=가이드만 / 페북=전부)
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
