// SNS 자동 게시 — 홈페이지에 발행되는 순간 인스타/페이스북에도 올라간다.
//
//  인스타그램: 캐러셀 5~10장 (훅 썸네일 + 본문 카드 + CTA)
//  페이스북 페이지: 링크 게시물 (OG 이미지 = 훅 카드)
//
// 이미지는 /api/card/[slug]?i=N 이 서버에서 즉시 생성한다.
// 메타 API가 그 URL을 직접 가져가므로 별도 업로드/스토리지가 필요 없다.

import type { Post } from "@/lib/posts";
import { postUrl } from "@/lib/channels";
import { buildCards, buildCaption, buildHashtags, firstCommentEmoji } from "@/lib/cards";
import { kvGet, kvSet, sadd, scard } from "@/lib/store";

const IG_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const SITE = "https://oddsbag.co.kr";
const G = "https://graph.facebook.com/v21.0";

export const socialEnabled = Boolean(IG_ID && TOKEN);

// 홈페이지는 자주 발행해도 되지만, SNS는 하루에 너무 많이 올리면
//  · 메타 API 한도(인스타 24시간 50건)에 걸리고
//  · 팔로워가 스팸으로 느껴 언팔한다
// 그래서 SNS만 따로 하루 한도를 둔다.
// 【하루 3개 정책】 인스타 카드뉴스 2개 (+릴스 1개 = 인스타 하루 3개)
// ※ content-factory/social.mjs 와 항상 같은 규칙이어야 한다 (쌍둥이 파일).
const DAILY_CAP = Number(process.env.SOCIAL_DAILY_CAP || 2);
// 페이스북은 링크 게시라 피드를 잡아먹지 않는다 → 뉴스·가이드 전부 올린다.
const FB_DAILY_CAP = Number(process.env.FB_DAILY_CAP || 3);
// 하루 기준은 한국 시간 (UTC로 세면 오전 9시에 날짜가 바뀐다)
const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const dayKey = () => `social:shared:${kstDay()}`; // 인스타 카드뉴스
const fbDayKey = () => `social:fb:${kstDay()}`; // 페이스북 링크 게시

export async function sharedToday(): Promise<number> {
  try {
    return await scard(dayKey());
  } catch {
    return 0;
  }
}

async function graph(
  path: string,
  params: Record<string, string>,
  method: "GET" | "POST" = "POST",
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({ ...params, access_token: TOKEN! });
  const url = method === "GET" ? `${G}${path}?${body}` : `${G}${path}`;
  const res = await fetch(url, {
    method,
    body: method === "POST" ? body : undefined,
    cache: "no-store",
  });
  const data = (await res.json()) as Record<string, unknown> & {
    error?: { message: string };
  };
  if (data.error) throw new Error(`Meta: ${data.error.message}`);
  return data;
}

// 캐러셀 컨테이너는 메타 서버에서 준비되기까지 몇 초 걸린다.
async function waitContainerReady(id: string, tries = 15): Promise<void> {
  for (let i = 0; i < tries; i++) {
    const s = await graph(`/${id}`, { fields: "status_code" }, "GET");
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") {
      throw new Error(`인스타 컨테이너 ${s.status_code as string}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("인스타 컨테이너 준비 시간 초과");
}

// ---- 인스타그램 캐러셀 ----
export async function postToInstagram(post: Post): Promise<string> {
  if (!socialEnabled) throw new Error("인스타 미설정");

  const cards = buildCards(post);
  const n = Math.min(Math.max(cards.length, 5), 10); // 인스타 캐러셀 규격: 2~10

  // 1) 각 장을 캐러셀 아이템으로 등록
  const children: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = await graph(`/${IG_ID}/media`, {
      image_url: `${SITE}/api/card/${post.slug}?i=${i}`,
      is_carousel_item: "true",
    });
    children.push(r.id as string);
  }

  // 2) 캐러셀 컨테이너
  const container = await graph(`/${IG_ID}/media`, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption: buildCaption(post),
  });

  // 3) 컨테이너가 '준비 완료'가 될 때까지 기다렸다가 딱 한 번만 발행한다.
  //    준비 여부를 안 보고 재시도하면, 실제로는 올라갔는데 실패로 기록돼 같은 글을 또 올리게 된다.
  await waitContainerReady(container.id as string);
  const pub = await graph(`/${IG_ID}/media_publish`, {
    creation_id: container.id as string,
  });
  const mediaId = pub.id as string;
  if (!mediaId) throw new Error("인스타 발행 실패");

  // 4) 캡션은 깔끔하게 두고, 해시태그는 첫 댓글(이모지) → 대댓글(30개)로.
  //    '댓글 관리' 권한이 없거나 실패해도 게시 자체는 유지한다.
  try {
    await attachHashtagsInComment(post, mediaId);
  } catch {
    /* 댓글/대댓글 실패는 무시 — 홈페이지·인스타 게시는 그대로 살아있다 */
  }

  return mediaId;
}

// ---- 첫 댓글(이모지) + 대댓글(해시태그 30개) ----
//  캡션을 지저분하게 만들지 않으려고 태그를 댓글로 뺀다.
//  · 댓글 달기:   POST /{ig-media-id}/comments
//  · 대댓글 달기: POST /{ig-comment-id}/replies
//  (인스타 토큰에 instagram_manage_comments 권한이 있어야 동작)
async function attachHashtagsInComment(post: Post, mediaId: string): Promise<void> {
  const c = await graph(`/${mediaId}/comments`, { message: firstCommentEmoji(post) });
  await graph(`/${c.id as string}/replies`, { message: buildHashtags(post) });
}

// ---- 페이스북 페이지 ID 자동 탐색 (한 번 찾으면 캐시) ----
async function pageId(): Promise<string | null> {
  if (FB_PAGE_ID) return FB_PAGE_ID;
  try {
    const cached = await kvGet("meta:page_id");
    if (cached) return cached;
  } catch {
    /* ignore */
  }
  try {
    // 페이지 토큰이면 /me 가 그 페이지를 반환한다
    const me = await graph("/me", { fields: "id,name" }, "GET");
    const id = me.id as string | undefined;
    if (id) {
      await kvSet("meta:page_id", id);
      return id;
    }
  } catch {
    /* ignore */
  }
  return null;
}

// ---- 페이스북 페이지 링크 게시 ----
export async function postToFacebook(post: Post): Promise<string> {
  const id = await pageId();
  if (!id) throw new Error("페이스북 페이지 ID 없음");

  const message = [
    post.hook || post.title,
    "",
    post.summary,
    "",
    `자세히 보기 → ${SITE}${postUrl(post)}`,
  ].join("\n");

  const r = await graph(`/${id}/feed`, {
    message,
    link: `${SITE}${postUrl(post)}`,
  });
  return r.id as string;
}

// ---- 발행 시 한 번에 (실패해도 홈페이지 발행은 유지) ----
export async function shareEverywhere(
  post: Post,
): Promise<{
  ig?: string;
  fb?: string;
  errors: string[];
  capped?: boolean;
  fbCapped?: boolean;
  skipped?: string;
}> {
  const out: {
    ig?: string;
    fb?: string;
    errors: string[];
    capped?: boolean;
    fbCapped?: boolean;
    skipped?: string;
  } = { errors: [] };
  if (!socialEnabled) return out;

  // ═══ 채널 배분 (사장님 지시 2026-08-05) ═══
  //   홈페이지 — 기사 이슈를 전반적으로 다 다룬다
  //   유튜브   — 기사·가이드·꿀팁 전부 올린다
  //   인스타   — **가이드(꿀팁)만.** 퀄리티를 계속 올리면서 빈도를 늘려간다
  //   페이스북 — 전부 (링크 게시라 피드 자리를 다투지 않는다)
  //
  // 인스타와 페북의 하루 한도를 따로 센다. 같이 세면 뉴스 한 편이 그날 인스타 자리까지
  // 먹어버려서, 정작 올려야 할 가이드가 밀려난다.
  const igAllowed = post.category === "꿀팁" || process.env.IG_NEWS === "on";

  // ── 인스타 ──
  if (!igAllowed) {
    out.skipped = "뉴스는 인스타에 올리지 않는다 (인스타는 가이드 전용)";
  } else if ((await sharedToday()) >= DAILY_CAP) {
    out.capped = true;
  } else {
    try {
      out.ig = await postToInstagram(post);
    } catch (e) {
      out.errors.push(`IG: ${(e as Error).message}`);
    }
  }

  // ── 페이스북 ── 인스타에 올라갔든 아니든 따로 판단한다
  try {
    const fbDone = await scard(fbDayKey());
    if (fbDone >= FB_DAILY_CAP) {
      out.fbCapped = true;
    } else {
      out.fb = await postToFacebook(post);
      if (out.fb) await sadd(fbDayKey(), post.slug).catch(() => {});
    }
  } catch (e) {
    out.errors.push(`FB: ${(e as Error).message}`);
  }

  if (out.ig) {
    try {
      await sadd(dayKey(), post.slug);
    } catch {
      /* 카운트 실패가 게시를 막지는 않는다 */
    }
  }
  return out;
}
