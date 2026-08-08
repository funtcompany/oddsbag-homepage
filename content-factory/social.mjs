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

// 【인스타 카드뉴스 하루 상한】 인스타는 가이드 전용 채널이 됐다(사장님 지시 2026-08-05).
// → 인스타 하루 3개 = 카드뉴스 1 + 릴스 2. 전부 가이드다. 릴스는 factory/make-reels.mjs 가 따로 센다.
//   2026-08-08 에 카드뉴스 2 + 릴스 1 에서 뒤집었다 — 카드뉴스 29개가 전부 도달 0이었고
//   인스타 도달은 100% 릴스에서 나왔다. 도달 0인 쪽에 일의 3분의 2를 넣고 있었다.
//
// ★ 이 값은 워크플로 4곳(collect·publish·guide·audit)에 각각 박혀 있고, 세는 곳은 한 곳이다
//   (social:shared:날짜 하나를 넷이 같이 본다). 그래서 한 곳만 2로 남겨두면
//   그 회차가 2개째를 올려버려 결정이 조용히 뒤집힌다. 고칠 땐 반드시 4곳을 같이 고친다.
// 빈도를 더 늘릴 때는 이 값과 SOCIAL_GAP_MIN 을 같이 봐야 한다. 간격이 길면 상한만 올려도 안 올라간다.
const DAILY_CAP = Number(process.env.SOCIAL_DAILY_CAP || 1);

// 페이스북은 링크 게시라 인스타처럼 피드를 잡아먹지 않는다 → 뉴스·가이드 전부 올린다.
const FB_DAILY_CAP = Number(process.env.FB_DAILY_CAP || 3);

// 하루의 기준은 '한국 시간'이다. UTC로 세면 오전 9시에 날짜가 바뀌어
// "하루 3개"가 실제로는 아침에 리셋되며 어긋난다.
const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const dayKey = () => `social:shared:${kstDay()}`; // 인스타 카드뉴스
const fbDayKey = () => `social:fb:${kstDay()}`; // 페이스북 링크 게시

// 한도만으론 부족하다 — 홈페이지 발행이 몰리면 SNS도 한꺼번에 올라간다.
// 게시 사이 최소 간격을 둬서 하루에 고르게 퍼지게 한다. (몰아 올리면 스팸으로 보이고 도달도 떨어진다)
const MIN_GAP_MIN = Number(process.env.SOCIAL_GAP_MIN || 600);
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

// ---- 실제로 나간 주소 만들기 (작업일지 '링크' 칸에 쓴다) ----
//  게시 결과로 돌아오는 건 '번호'뿐이라, 사람이 눌러볼 수 있는 주소로 바꿔준다.
//  주소를 못 구해도 게시·기록은 그대로 진행한다 (링크 칸만 빈다).

/** 인스타 게시물 주소 — 번호로는 열 수 없어서 메타에 한 번 물어본다 */
export async function igPermalink(mediaId) {
  if (!mediaId || !socialEnabled) return null;
  try {
    const r = await graph(`/${mediaId}`, { fields: "permalink" }, "GET");
    return r.permalink ?? null;
  } catch {
    return null;
  }
}

/** 페북 게시물 주소 — 번호가 "페이지번호_글번호" 형태라 물어보지 않고 바로 만든다 */
export function fbPermalink(postId) {
  if (!postId) return null;
  const [page, post] = String(postId).split("_");
  return post ? `https://www.facebook.com/${page}/posts/${post}` : `https://www.facebook.com/${page}`;
}

// ---- 발행 시 한 번에 (실패해도 홈페이지 발행은 유지) ----
export async function shareEverywhere(
  post,
) {
  const out = { errors: [] };
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
    // 직전 게시로부터 최소 간격이 안 지났으면 이번엔 올리지 않는다 (다음 회차가 다시 시도)
    const wait = await tooSoon();
    if (wait > 0) {
      out.tooSoon = wait;
    } else {
      try {
        out.ig = await postToInstagram(post);
      } catch (e) {
        out.errors.push(`IG: ${e.message}`);
      }
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
    out.errors.push(`FB: ${e.message}`);
  }

  if (out.ig) {
    try {
      await sadd(dayKey(), post.slug);
      await kvSet(K_LAST_SHARED, new Date().toISOString()); // 다음 게시 간격 계산 기준
    } catch {
      /* 카운트 실패가 게시를 막지는 않는다 */
    }
  }
  return out;
}
