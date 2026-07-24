// SNS 자동 게시 — 홈페이지에 발행되는 순간 인스타/페이스북에도 올라간다.
//
//  인스타그램: 캐러셀 5~10장 (훅 썸네일 + 본문 카드 + CTA)
//  페이스북 페이지: 링크 게시물 (OG 이미지 = 훅 카드)
//
// 이미지는 /api/card/[slug]?i=N 이 서버에서 즉시 생성한다.
// 메타 API가 그 URL을 직접 가져가므로 별도 업로드/스토리지가 필요 없다.

import { buildCards, buildCaption, buildHashtags, firstCommentEmoji } from "./cards.mjs";
import { kvGet, kvSet, sadd, scard } from "./store.mjs";

const IG_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const SITE = "https://oddsbag.co.kr";
const G = "https://graph.facebook.com/v21.0";

export const socialEnabled = Boolean(IG_ID && TOKEN);

// 【하루 3개 정책】 인스타에는 하루 3개만 올린다 — 카드뉴스 2 + 릴스 1.
// 여기(카드뉴스)는 2개, 릴스 1개는 factory/make-reels.mjs 가 따로 센다.
// 페이스북도 같은 방식으로 링크 2 + 영상 1 = 3개가 된다.
// 많이 올린다고 도달이 늘지 않는다. 피드가 빽빽하면 오히려 언팔당한다.
const DAILY_CAP = Number(process.env.SOCIAL_DAILY_CAP || 2);

// 하루의 기준은 '한국 시간'이다. UTC로 세면 오전 9시에 날짜가 바뀌어
// "하루 3개"가 실제로는 아침에 리셋되며 어긋난다.
const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const dayKey = () => `social:shared:${kstDay()}`;

// 한도만으론 부족하다 — 홈페이지 발행이 몰리면 SNS도 한꺼번에 올라간다.
// 게시 사이 최소 간격을 둬서 하루에 고르게 퍼지게 한다. (몰아 올리면 스팸으로 보이고 도달도 떨어진다)
const MIN_GAP_MIN = Number(process.env.SOCIAL_GAP_MIN || 360);
const K_LAST_SHARED = "social:lastSharedAt";

async function tooSoon() {
  try {
    const last = await kvGet(K_LAST_SHARED);
    if (!last) return 0;
    const passed = (Date.now() - new Date(last).getTime()) / 60000;
    return passed < MIN_GAP_MIN ? Math.ceil(MIN_GAP_MIN - passed) : 0;
  } catch {
    return 0; // 시각을 못 읽으면 막지 않는다
  }
}

export async function sharedToday() {
  try {
    return await scard(dayKey());
  } catch {
    return 0;
  }
}

async function graph(
  path,
  params,
  method = "POST",
) {
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const url = method === "GET" ? `${G}${path}?${body}` : `${G}${path}`;
  const res = await fetch(url, {
    method,
    body: method === "POST" ? body : undefined,
    cache: "no-store",
  });
  const data = await res.json();
  if (data.error) throw new Error(`Meta: ${data.error.message}`);
  return data;
}

// 캐러셀 컨테이너는 메타 서버에서 준비되기까지 몇 초 걸린다.
// 준비 전에 발행을 찌르면 실패하므로, 준비될 때까지 상태를 물어보고 기다린다.
async function waitContainerReady(id, tries = 15) {
  for (let i = 0; i < tries; i++) {
    const s = await graph(`/${id}`, { fields: "status_code" }, "GET");
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") {
      throw new Error(`인스타 컨테이너 ${s.status_code}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("인스타 컨테이너 준비 시간 초과");
}

// ---- 인스타그램 캐러셀 ----
export async function postToInstagram(post) {
  if (!socialEnabled) throw new Error("인스타 미설정");

  const cards = buildCards(post);
  const n = Math.min(Math.max(cards.length, 5), 10); // 인스타 캐러셀 규격: 2~10

  // 1) 각 장을 캐러셀 아이템으로 등록
  const children = [];
  for (let i = 0; i < n; i++) {
    const r = await graph(`/${IG_ID}/media`, {
      image_url: `${SITE}/api/card/${post.slug}?i=${i}`,
      is_carousel_item: "true",
    });
    children.push(r.id);
  }

  // 2) 캐러셀 컨테이너
  const container = await graph(`/${IG_ID}/media`, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption: buildCaption(post),
  });

  // 3) 컨테이너가 '준비 완료'가 될 때까지 기다렸다가 딱 한 번만 발행한다.
  //    예전에는 준비 여부를 안 보고 5번 재시도했는데, 그 사이 실제로는 인스타에 올라갔는데
  //    응답만 실패로 잡혀 "안 올라갔다"고 기록됐다. 그러면 개선 크론이 같은 글을 또 올린다.
  await waitContainerReady(container.id);
  const pub = await graph(`/${IG_ID}/media_publish`, { creation_id: container.id });
  const mediaId = pub.id;
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
async function attachHashtagsInComment(post, mediaId) {
  const c = await graph(`/${mediaId}/comments`, { message: firstCommentEmoji(post) });
  await graph(`/${c.id}/replies`, { message: buildHashtags(post) });
}

// ---- 페이스북 페이지 ID 자동 탐색 (한 번 찾으면 캐시) ----
async function pageId() {
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
    const id = me.id;
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
export async function postToFacebook(post) {
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
  return r.id;
}

// ---- 발행 시 한 번에 (실패해도 홈페이지 발행은 유지) ----
export async function shareEverywhere(
  post,
) {
  const out = { errors: [] };
  if (!socialEnabled) return out;

  // 【인스타 피드 정책】 꿀팁은 당분간 인스타에 올리지 않는다.
  // 꿀팁이 피드를 도배해 매거진(뉴스)이 묻혔다. 홈페이지 발행과 검색 유입은 그대로 두고,
  // 인스타 피드는 매거진 위주로 되돌린다. 꿀팁은 릴스로 내보낸다.
  // (SOCIAL_TIPS=on 으로 환경변수를 주면 다시 올라간다)
  if (post.category === "꿀팁" && process.env.SOCIAL_TIPS !== "on") {
    out.skipped = "꿀팁은 인스타 게시 보류 (피드는 매거진 위주)";
    return out;
  }

  // 하루 한도를 넘으면 SNS만 건너뛴다 (홈페이지 발행은 그대로 유지)
  if ((await sharedToday()) >= DAILY_CAP) {
    out.capped = true;
    return out;
  }

  // 직전 게시로부터 최소 간격이 안 지났으면 이번엔 올리지 않는다 (다음 회차가 다시 시도)
  const wait = await tooSoon();
  if (wait > 0) {
    out.tooSoon = wait;
    return out;
  }

  try {
    out.ig = await postToInstagram(post);
  } catch (e) {
    out.errors.push(`IG: ${e.message}`);
  }
  try {
    out.fb = await postToFacebook(post);
  } catch (e) {
    out.errors.push(`FB: ${e.message}`);
  }

  if (out.ig || out.fb) {
    try {
      await sadd(dayKey(), post.slug);
      await kvSet(K_LAST_SHARED, new Date().toISOString()); // 다음 게시 간격 계산 기준
    } catch {
      /* 카운트 실패가 게시를 막지는 않는다 */
    }
  }
  return out;
}
