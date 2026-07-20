// 인스타그램 릴스 자동 게시 (Instagram Graph API)
// 필요한 환경변수: INSTAGRAM_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN
//
// ※ 인스타 릴스는 '공개 접근 가능한 영상 URL'을 요구한다 (파일 업로드 불가).
//   그래서 host.mjs 가 완성 mp4를 공개 URL로 올린 뒤, 그 URL을 여기로 넘긴다.

const IG = process.env.INSTAGRAM_ACCOUNT_ID;
const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const G = "https://graph.facebook.com/v21.0";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 발행된 릴스에 첫 댓글로 해시태그를 단다 (캡션을 깔끔하게 유지하면서 검색 유입 확보)
async function commentOn(mediaId, text) {
  if (!text) return;
  const r = await (await fetch(`${G}/${mediaId}/comments`, {
    method: "POST",
    body: new URLSearchParams({ message: text, access_token: TOKEN }),
  })).json();
  if (r.id) console.log(`  · 인스타 첫 댓글(태그) 등록: ${r.id}`);
  else console.log("  · 인스타 댓글 건너뜀:", JSON.stringify(r).slice(0, 120));
}

export async function postReel(videoUrl, caption, coverUrl, commentTags) {
  if (!IG || !TOKEN) throw new Error("인스타 미설정 (토큰 없음)");
  if (!videoUrl) throw new Error("인스타 미설정 (영상 URL 없음)");

  // 1) 릴스 컨테이너 생성 (커버 이미지 = 첫 장. 없으면 첫 프레임을 커버로)
  const params = { media_type: "REELS", video_url: videoUrl, caption, access_token: TOKEN };
  if (coverUrl) params.cover_url = coverUrl;
  else params.thumb_offset = "0"; // 커버 이미지가 없을 때 최소한 첫 프레임을 표지로
  const create = await (await fetch(`${G}/${IG}/media`, {
    method: "POST",
    body: new URLSearchParams(params),
  })).json();
  if (!create.id) throw new Error("컨테이너 실패: " + JSON.stringify(create).slice(0, 160));

  // 2) 인코딩 완료까지 대기 (최대 ~3분) — 넘으면 조용히 넘어가지 말고 사유를 남긴다
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const st = await (await fetch(`${G}/${create.id}?fields=status_code&access_token=${TOKEN}`)).json();
    if (st.status_code === "FINISHED") { ready = true; break; }
    if (st.status_code === "ERROR") throw new Error("인스타 인코딩 실패: " + JSON.stringify(st).slice(0, 120));
  }
  if (!ready) throw new Error("인스타 인코딩 지연 (3분 초과) — 다음 회차에 재게시 시도");

  // 3) 발행
  const pub = await (await fetch(`${G}/${IG}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: create.id, access_token: TOKEN }),
  })).json();
  if (!pub.id) throw new Error("발행 실패: " + JSON.stringify(pub).slice(0, 160));
  console.log(`  · 인스타 릴스 게시: ${pub.id}`);

  // 첫 댓글에 해시태그 (실패해도 게시 자체는 성공으로 둔다)
  try { await commentOn(pub.id, commentTags); } catch (e) { console.log("  · 인스타 댓글 건너뜀:", e.message); }
  return pub.id;
}
