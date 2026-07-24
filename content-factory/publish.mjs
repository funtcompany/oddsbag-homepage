// 예약 발행 — 대기열에서 시간이 된 글만 하나씩 꺼내 올린다.
//
// 수집 크론이 한 번에 4~5건을 써도 그게 동시에 쏟아지지 않는다.
// 45분 간격으로 배정된 시각이 되면 이 크론이 하나씩 올린다.
// → 홈페이지가 하루 종일 살아 움직이는 느낌.

import { getQueued, getPublishedRaw, releaseFromQueue, upsertPublished } from "./posts.mjs";
import { notionEnabled, setNotionStatus } from "./notion.mjs";
import { shareEverywhere, socialEnabled } from "./social.mjs";
import { revalidateTag } from "./cache.mjs";

const MAX_PER_RUN = Number(process.env.PUBLISH_MAX_PER_RUN || 1); // 한 회차에 올리는 글 수

// 【하루 3편 정책】 홈페이지도 하루 3편까지만 올린다.
// 많이 쓰는 대신 잘 쓰는 쪽으로 바꿨다 — 글 한 편에 들어가는 품질 투자를 늘리기 위함.
const DAILY_CAP = Number(process.env.PUBLISH_DAILY_CAP || 3);

// 하루 기준은 한국 시간 (UTC로 세면 오전 9시에 날짜가 바뀐다)
const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const kstOf = (iso) =>
  iso ? new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10) : "";

// 오늘(한국 시간) 이미 올라간 글 수
async function publishedToday() {
  try {
    const all = await getPublishedRaw();
    const day = kstDay();
    return all.filter((p) => kstOf(p.publishedAt ?? p.date) === day).length;
  } catch {
    return 0; // 못 세면 막지 않는다 (발행이 멈추는 게 더 나쁘다)
  }
}

export async function runPublish() {
  const out = {
    published: [],
    waiting: 0,
    social: { ig: 0, fb: 0 },
    errors: [],
  };

  let queue = [];
  try {
    queue = await getQueued();
  } catch (e) {
    out.errors.push(`대기열 로드: ${e.message}`);
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

  const released = [];
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
      out.errors.push(`발행 ${post.slug}: ${e.message}`);
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
        out.errors.push(`SNS ${post.slug}: ${e.message}`);
      }
    }
  }

  return out;
}
