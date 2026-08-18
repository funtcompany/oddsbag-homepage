// 인스타그램 릴스 자동 게시 (여러 계정 지원)
//
// ⚠️ 이 파일은 두 곳에 똑같이 있습니다 — 고칠 때 반드시 둘 다 고치세요.
//    01_오피셜/factory/instagram.mjs
//    01_오피셜/homepage/factory/instagram.mjs
//
// ※ 인스타 릴스는 '공개 접근 가능한 영상 URL'을 요구한다 (파일 업로드 불가).
//   그래서 host.mjs 가 완성 mp4를 공개 URL로 올린 뒤, 그 URL을 여기로 넘긴다.
//
// 접속 방식이 두 가지다. 게시 절차는 똑같고 주소만 다르므로 한 곳에서 처리한다.
//   facebook  — 페이스북 페이지를 거치는 방식 (graph.facebook.com)
//   instagram — 인스타에 직접 붙는 방식 (graph.instagram.com)
//
// ⚠️ 2026-08-04 — 전 계정을 facebook 방식으로 통일했다. 이유:
//    **게시물 삭제(DELETE)는 페이스북 로그인 방식에서만 된다** (메타 공식: "Facebook login only").
//    인스타 직접 방식은 올리기만 되고 내리기가 안 돼서, 2일마다 도는 재검수가 문제를 찾아도
//    사람이 손으로 지워야 했다. 페이지를 만드시고 토큰을 다시 받아 전부 갈아끼웠다.
//    덤: 이 방식 토큰은 만료가 없다 → 주 1회 자동 갱신이 더는 필요 없다.
//    (토큰 재발급 도구: company/도구/인스타-토큰재발급.mjs)

const 계정표 = {
  official: {
    이름: "@oddsbag_official",
    방식: "facebook",
    id: () => process.env.INSTAGRAM_ACCOUNT_ID,
    token: () => process.env.INSTAGRAM_ACCESS_TOKEN,
  },
  music: {
    이름: "@oddsbag_music",
    방식: "facebook",
    id: () => process.env.IG_MUSIC_ID,
    token: () => process.env.IG_MUSIC_TOKEN,
  },
  tales: {
    이름: "@oddsbag_tales",
    방식: "facebook",
    id: () => process.env.IG_TALES_ID,
    token: () => process.env.IG_TALES_TOKEN,
  },
  kids: {
    이름: "@oddsbag_kids",
    방식: "facebook",
    id: () => process.env.IG_KIDS_ID,
    token: () => process.env.IG_KIDS_TOKEN,
  },
  starflow: {
    이름: "@starflow.today",
    방식: "facebook",
    id: () => process.env.IG_STARFLOW_ID,
    token: () => process.env.IG_STARFLOW_TOKEN,
  },
  // 메모냅 — 2026-08-03 추가. 토큰은 원래 아이엠펀트 폴더(funt-site/.env)에 있던 것이고
  // 실제 계정은 @memonap_official 이다. 페이스북 페이지('메모냅')가 연결돼 있어 facebook 방식.
  memonap: {
    이름: "@memonap_official",
    방식: "facebook",
    id: () => process.env.IG_MEMONAP_ID,
    token: () => process.env.IG_MEMONAP_TOKEN,
  },
};

const 주소 = {
  facebook: "https://graph.facebook.com/v21.0",
  instagram: "https://graph.instagram.com",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 쓸 수 있는 계정 목록 (토큰이 들어 있는 것만) */
export function 계정목록() {
  return Object.entries(계정표)
    .filter(([, a]) => a.id() && a.token())
    .map(([key, a]) => ({ key, 이름: a.이름, 방식: a.방식 }));
}

function 계정찾기(키) {
  const a = 계정표[키];
  if (!a) throw new Error(`모르는 인스타 계정: ${키} (쓸 수 있는 것: ${Object.keys(계정표).join(", ")})`);
  const id = a.id(), token = a.token();
  if (!id || !token) throw new Error(`인스타 미설정: ${a.이름} — .env 에 토큰/ID 가 없습니다`);
  return { ...a, id, token, G: 주소[a.방식] };
}

// 발행 직후 댓글을 단다 (캡션을 깔끔하게 유지하면서 검색 유입 확보)
//  · 씨앗이 없으면 — 지금까지처럼 첫 댓글에 해시태그를 그대로 단다
//  · 씨앗이 있으면 — 첫 댓글엔 씨앗(이모지 하나)만 두고, 해시태그는 그 댓글의 대댓글로 내린다.
//    보이는 자리는 이모지 하나뿐이고 태그 뭉치는 한 번 접힌 안쪽에 들어간다.
async function commentOn(acc, mediaId, text, 씨앗) {
  if (!text && !씨앗) return;
  const 달기 = async (경로, message) =>
    (await (await fetch(`${acc.G}/${경로}`, {
      method: "POST",
      body: new URLSearchParams({ message, access_token: acc.token }),
    })).json());

  if (!씨앗) {
    const r = await 달기(`${mediaId}/comments`, text);
    if (r.id) console.log(`  · 인스타 첫 댓글(태그) 등록: ${r.id}`);
    else console.log("  · 인스타 댓글 건너뜀:", JSON.stringify(r).slice(0, 120));
    return;
  }

  const 첫댓글 = await 달기(`${mediaId}/comments`, 씨앗);
  if (!첫댓글.id) {
    console.log("  · 인스타 댓글 건너뜀:", JSON.stringify(첫댓글).slice(0, 120));
    return;
  }
  console.log(`  · 인스타 첫 댓글(${씨앗}) 등록: ${첫댓글.id}`);
  if (!text) return;

  const 대댓글 = await 달기(`${첫댓글.id}/replies`, text);
  if (대댓글.id) { console.log(`  · 인스타 대댓글(태그) 등록: ${대댓글.id}`); return; }

  // 대댓글이 막히면 태그를 통째로 잃는다 — 검색 유입이 목적이니 예전 방식으로 되돌려 건진다
  console.log("  · 대댓글 실패 → 태그를 일반 댓글로 답니다:", JSON.stringify(대댓글).slice(0, 120));
  const 보완 = await 달기(`${mediaId}/comments`, text);
  if (보완.id) console.log(`  · 인스타 태그 댓글 등록: ${보완.id}`);
  else console.log("  · 인스타 태그 댓글도 실패:", JSON.stringify(보완).slice(0, 120));
}

/**
 * 릴스를 특정 계정에 올린다.
 * @param {string} 계정키 official | music | tales | kids | starflow
 */
export async function postReelTo(계정키, videoUrl, caption, coverUrl, commentTags, opts = {}) {
  const acc = 계정찾기(계정키);
  if (!videoUrl) throw new Error("인스타 미설정 (영상 URL 없음)");
  console.log(`  · 인스타 대상 계정: ${acc.이름}`);

  // 1) 릴스 컨테이너 생성 (커버 이미지 = 첫 장. 없으면 첫 프레임을 커버로)
  const params = { media_type: "REELS", video_url: videoUrl, caption, access_token: acc.token };
  if (coverUrl) params.cover_url = coverUrl;
  else params.thumb_offset = "0"; // 커버 이미지가 없을 때 최소한 첫 프레임을 표지로
  const create = await (await fetch(`${acc.G}/${acc.id}/media`, {
    method: "POST",
    body: new URLSearchParams(params),
  })).json();
  if (!create.id) throw new Error(`컨테이너 실패(${acc.이름}): ` + JSON.stringify(create).slice(0, 600));

  // 2) 인코딩 완료까지 대기 (최대 ~3분) — 넘으면 조용히 넘어가지 말고 사유를 남긴다
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const st = await (await fetch(`${acc.G}/${create.id}?fields=status_code&access_token=${acc.token}`)).json();
    if (st.status_code === "FINISHED") { ready = true; break; }
    if (st.status_code === "ERROR") throw new Error(`인스타 인코딩 실패(${acc.이름}): ` + JSON.stringify(st).slice(0, 120));
  }
  if (!ready) throw new Error(`인스타 인코딩 지연 3분 초과(${acc.이름}) — 다음 회차에 재게시 시도`);

  // 3) 발행
  //    ★기준시각은 여기서 잡는다 — 위 인코딩 대기가 최대 3분이라 함수 시작 시각을 쓰면 안 된다
  const 시작 = Date.now();
  const pub = await (await fetch(`${acc.G}/${acc.id}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: create.id, access_token: acc.token }),
  })).json();
  /* 오류가 와도 실제로 올라갔을 수 있다 — 확인하고 나서 실패로 친다 (위 방금올라갔나 주석 참고) */
  let 게시id = pub.id;
  if (!게시id) {
    await sleep(5000);
    게시id = await 방금올라갔나(acc, 시작);
    if (게시id) console.log(`  · ⚠ 오류 응답이 왔지만 실제로는 올라갔습니다(${게시id}) — 다시 올리지 않습니다`);
  }
  if (!게시id) throw new Error(`발행 실패(${acc.이름}): ` + JSON.stringify(pub).slice(0, 600));
  console.log(`  · 인스타 릴스 게시: ${게시id} (${acc.이름})`);

  // 첫 댓글에 해시태그 (실패해도 게시 자체는 성공으로 둔다)
  try { await commentOn(acc, 게시id, commentTags, opts.댓글씨앗); } catch (e) { console.log("  · 인스타 댓글 건너뜀:", e.message); }
  return 게시id;
}

// 컨테이너가 게시 가능한 상태가 될 때까지 기다린다.
// 사진은 보통 즉시 끝나지만, 메타가 이미지를 거부하면 여기서 ERROR 로 잡힌다.
async function 컨테이너대기(acc, id, 라벨) {
  for (let i = 0; i < 20; i++) {
    const st = await (await fetch(`${acc.G}/${id}?fields=status_code&access_token=${acc.token}`)).json();
    if (!st.status_code) return;                    // 상태를 안 주는 계정 = 바로 준비된 것으로 본다
    if (st.status_code === "FINISHED") return;
    if (st.status_code === "ERROR")
      throw new Error(`${라벨} 준비 실패(${acc.이름}): ` + JSON.stringify(st).slice(0, 600));
    await sleep(2000);
  }
  throw new Error(`${라벨} 준비 지연 40초 초과(${acc.이름})`);
}

/* ★2026-08-18 — 발행 오류를 곧이곧대로 믿지 않는다.
   그날 별의 결에서 media_publish 가 「Application request limit reached」 오류를 돌려줬는데
   **실제로는 게시가 됐다.** 발행큐는 오류만 보고 실패로 치고 5분 뒤 다시 올렸고,
   같은 캐러셀이 **14번** 올라갔다(도달은 전부 0 — 인스타가 도배로 보고 막았다).
   그래서 오류가 오면 계정을 실제로 들여다보고, 방금 올라간 게 없을 때만 실패로 친다. */
async function 방금올라갔나(acc, 기준시각) {
  try {
    const r = await (await fetch(
      `${acc.G}/${acc.id}/media?fields=id,timestamp&limit=5&access_token=${acc.token}`)).json();
    for (const m of (r.data || [])) {
      // 기준시각 15초 전까지 허용 — 메타 시계와 우리 시계가 조금 어긋난다
      if (m.timestamp && new Date(m.timestamp).getTime() >= 기준시각 - 15000) return m.id;
    }
  } catch { /* 확인 자체가 실패하면 판단하지 않는다 — 아래에서 원래 오류로 넘어간다 */ }
  return null;
}

async function 게시(acc, containerId, 라벨, commentTags, 댓글씨앗) {
  const 시작 = Date.now();
  const pub = await (await fetch(`${acc.G}/${acc.id}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: containerId, access_token: acc.token }),
  })).json();
  let 게시id = pub.id;
  if (!게시id) {
    await sleep(5000);                     // 반영될 틈을 준다
    게시id = await 방금올라갔나(acc, 시작);
    if (게시id) console.log(`  · ⚠ 오류 응답이 왔지만 실제로는 올라갔습니다(${게시id}) — 다시 올리지 않습니다`);
  }
  if (!게시id) throw new Error(`발행 실패(${acc.이름}): ` + JSON.stringify(pub).slice(0, 600));
  console.log(`  · 인스타 ${라벨} 게시: ${게시id} (${acc.이름})`);
  try { await commentOn(acc, 게시id, commentTags, 댓글씨앗); } catch (e) { console.log("  · 인스타 댓글 건너뜀:", e.message); }
  return 게시id;
}

/**
 * 사진 1장을 특정 계정에 올린다.
 * 옵션 { 컨테이너까지: true } 면 메타에 그림만 넘겨 받아주는지 확인하고 게시는 하지 않는다
 * (실제로 올리기 전에 안전하게 점검하는 용도. 만든 컨테이너는 24시간 뒤 저절로 사라진다)
 */
export async function postImageTo(계정키, imageUrl, caption, commentTags, opts = {}) {
  const acc = 계정찾기(계정키);
  if (!imageUrl) throw new Error("인스타 미설정 (사진 URL 없음)");
  console.log(`  · 인스타 대상 계정: ${acc.이름}`);

  const create = await (await fetch(`${acc.G}/${acc.id}/media`, {
    method: "POST",
    body: new URLSearchParams({ image_url: imageUrl, caption, access_token: acc.token }),
  })).json();
  if (!create.id) throw new Error(`컨테이너 실패(${acc.이름}): ` + JSON.stringify(create).slice(0, 600));
  await 컨테이너대기(acc, create.id, "사진");

  if (opts.컨테이너까지) { console.log(`  · (점검) 사진 컨테이너까지만 확인: ${create.id} — 게시 안 함`); return create.id; }
  return 게시(acc, create.id, "사진", commentTags, opts.댓글씨앗);
}

/**
 * 사진 여러 장을 한 게시물(캐러셀)로 올린다. 2~10장.
 * 순서는 넘겨준 배열 순서 그대로 나간다.
 */
export async function postCarouselTo(계정키, imageUrls, caption, commentTags, opts = {}) {
  const acc = 계정찾기(계정키);
  const urls = (imageUrls || []).filter(Boolean);
  if (urls.length < 2) throw new Error(`캐러셀은 2장 이상이어야 합니다 (지금 ${urls.length}장)`);
  if (urls.length > 10) throw new Error(`캐러셀은 10장까지입니다 (지금 ${urls.length}장)`);
  console.log(`  · 인스타 대상 계정: ${acc.이름} · 캐러셀 ${urls.length}장`);

  // 1) 장마다 자식 컨테이너
  const children = [];
  for (const [i, url] of urls.entries()) {
    const c = await (await fetch(`${acc.G}/${acc.id}/media`, {
      method: "POST",
      body: new URLSearchParams({ image_url: url, is_carousel_item: "true", access_token: acc.token }),
    })).json();
    if (!c.id) throw new Error(`캐러셀 ${i + 1}장째 실패(${acc.이름}): ` + JSON.stringify(c).slice(0, 600));
    await 컨테이너대기(acc, c.id, `캐러셀 ${i + 1}장째`);
    children.push(c.id);
  }

  // 2) 자식들을 묶는 부모 컨테이너 (캡션은 여기에 붙는다)
  const parent = await (await fetch(`${acc.G}/${acc.id}/media`, {
    method: "POST",
    body: new URLSearchParams({
      media_type: "CAROUSEL", children: children.join(","), caption, access_token: acc.token,
    }),
  })).json();
  if (!parent.id) throw new Error(`캐러셀 묶기 실패(${acc.이름}): ` + JSON.stringify(parent).slice(0, 600));
  await 컨테이너대기(acc, parent.id, "캐러셀");

  if (opts.컨테이너까지) { console.log(`  · (점검) 캐러셀 컨테이너까지만 확인: ${parent.id} — 게시 안 함`); return parent.id; }
  return 게시(acc, parent.id, "캐러셀", commentTags, opts.댓글씨앗);
}

/** 예전부터 쓰던 입구 — 계정을 안 적으면 지금까지처럼 @oddsbag_official 로 올린다 */
export async function postReel(videoUrl, caption, coverUrl, commentTags) {
  return postReelTo("official", videoUrl, caption, coverUrl, commentTags);
}
