// SNS 자동 게시 — 홈페이지에 발행되는 순간 인스타/페이스북에도 올라간다.
//
//  인스타그램: 캐러셀 5~10장 (훅 썸네일 + 본문 카드 + CTA)
//  페이스북 페이지: 링크 게시물 (OG 이미지 = 훅 카드)
//
// 이미지는 /api/card/[slug]?i=N 이 서버에서 즉시 생성한다.
// 메타 API가 그 URL을 직접 가져가므로 별도 업로드/스토리지가 필요 없다.

import type { Post } from "@/lib/posts";
import { buildCards, buildCaption } from "@/lib/cards";
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
const DAILY_CAP = Number(process.env.SOCIAL_DAILY_CAP || 14);
const dayKey = () => `social:shared:${new Date().toISOString().slice(0, 10)}`;

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

  // 3) 발행 (컨테이너 준비까지 잠깐 대기 필요할 수 있음)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const pub = await graph(`/${IG_ID}/media_publish`, {
        creation_id: container.id as string,
      });
      return pub.id as string;
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("인스타 발행 실패");
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
    `자세히 보기 → ${SITE}/magazine/${post.slug}`,
  ].join("\n");

  const r = await graph(`/${id}/feed`, {
    message,
    link: `${SITE}/magazine/${post.slug}`,
  });
  return r.id as string;
}

// ---- 발행 시 한 번에 (실패해도 홈페이지 발행은 유지) ----
export async function shareEverywhere(
  post: Post,
): Promise<{ ig?: string; fb?: string; errors: string[]; capped?: boolean }> {
  const out: { ig?: string; fb?: string; errors: string[]; capped?: boolean } = { errors: [] };
  if (!socialEnabled) return out;

  // 하루 한도를 넘으면 SNS만 건너뛴다 (홈페이지 발행은 그대로 유지)
  if ((await sharedToday()) >= DAILY_CAP) {
    out.capped = true;
    return out;
  }

  try {
    out.ig = await postToInstagram(post);
  } catch (e) {
    out.errors.push(`IG: ${(e as Error).message}`);
  }
  try {
    out.fb = await postToFacebook(post);
  } catch (e) {
    out.errors.push(`FB: ${(e as Error).message}`);
  }

  if (out.ig || out.fb) {
    try {
      await sadd(dayKey(), post.slug);
    } catch {
      /* 카운트 실패가 게시를 막지는 않는다 */
    }
  }
  return out;
}
