// 유튜브 쇼츠 자동 업로드 (YouTube Data API v3, OAuth 리프레시 토큰 방식)
// 필요한 환경변수: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
// 세로 영상 + 제목/설명에 #Shorts 가 있으면 유튜브가 자동으로 쇼츠로 인식한다.
import fs from "node:fs";

const CID = process.env.YOUTUBE_CLIENT_ID;
const CSECRET = process.env.YOUTUBE_CLIENT_SECRET;
const RTOKEN = process.env.YOUTUBE_REFRESH_TOKEN;

async function accessToken() {
  const body = new URLSearchParams({ client_id: CID, client_secret: CSECRET, refresh_token: RTOKEN, grant_type: "refresh_token" });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
  const j = await r.json();
  if (!j.access_token) throw new Error("토큰 갱신 실패: " + JSON.stringify(j).slice(0, 160));
  return j.access_token;
}

// categoryId 는 채널 성격에 맞춰 넘긴다. 안 넘기면 지금까지처럼 25(뉴스·정치) — 오즈백 기본값.
//   25 뉴스·정치 (오즈백)   26 노하우·스타일 (메모냅 인테리어 촬영)   22 인물·블로그
//
// publishAt 을 넘기면 **유튜브 예약 게시**가 된다 (Date 또는 ISO 문자열).
//   지금 비공개로 올려두고, 그 시각에 유튜브가 스스로 공개로 바꾼다.
//   → 맥이 꺼져 있어도 예정대로 나간다. 예약할 때 privacyStatus 는 반드시 private 여야 한다
//     (public 인 채로 publishAt 을 넣으면 구글이 무시하고 즉시 공개해버린다).
export async function uploadShort(mp4Path, { title, description, tags, privacy = "public", categoryId = "25", publishAt = null }) {
  if (!CID || !CSECRET || !RTOKEN) throw new Error("유튜브 미설정 (토큰 없음)");
  const token = await accessToken();

  const 예약시각 = publishAt ? new Date(publishAt) : null;
  if (예약시각 && isNaN(예약시각)) throw new Error("publishAt 시각을 못 읽었습니다: " + publishAt);
  if (예약시각 && 예약시각 <= new Date()) throw new Error(`예약 시각이 이미 지났습니다 (${예약시각.toISOString()})`);

  const status = 예약시각
    ? { privacyStatus: "private", publishAt: 예약시각.toISOString(), selfDeclaredMadeForKids: false }
    : { privacyStatus: privacy, selfDeclaredMadeForKids: false };

  const meta = {
    snippet: { title: title.slice(0, 100), description, tags, categoryId },
    status,
  };
  const boundary = "oddsbag_boundary_" + title.length;
  const pre = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`;
  const post = `\r\n--${boundary}--\r\n`;
  const bodyBuf = Buffer.concat([Buffer.from(pre, "utf8"), fs.readFileSync(mp4Path), Buffer.from(post, "utf8")]);

  const r = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body: bodyBuf,
  });
  const j = await r.json();
  if (!j.id) throw new Error("업로드 실패: " + JSON.stringify(j).slice(0, 200));
  if (예약시각) {
    // 요청만 보내고 믿지 않는다 — 유튜브가 실제로 예약으로 받았는지 되물어 확인한다.
    const v = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${j.id}`,
      { headers: { Authorization: `Bearer ${token}` } })).json();
    const st = v.items?.[0]?.status || {};
    if (!st.publishAt) throw new Error(`예약이 안 걸렸습니다 (지금 상태: ${st.privacyStatus}). 즉시 공개됐을 수 있으니 확인하세요 — https://youtu.be/${j.id}`);
    console.log(`  · 유튜브 쇼츠 예약됨: ${st.publishAt} → https://youtu.be/${j.id}`);
  } else {
    console.log(`  · 유튜브 쇼츠 게시: https://youtu.be/${j.id}`);
  }
  return j.id;
}

// ※ 썸네일 추출 함수를 여기에 두지 않는다.
//    make-reels.mjs 가 이미 뽑고 있고, 그쪽은 '첫 프레임'이 아니라 2.5초 지점을 쓴다.
//    첫 프레임은 카드가 아직 밀려 들어오는 중(ENTER_FRAMES)이라 표지가 어정쩡하게 잡힌다.
//    2.5초 지점이라야 목록에 뜨는 그림과 지정 썸네일이 일치한다 (사장님 지시 2026-07-29).

// 카테고리 재생목록("오즈백 · 경제" 등)에 영상 자동 분류. 없으면 만들고, 있으면 담는다.
export async function addToCategoryPlaylist(videoId, category) {
  if (!videoId || !category) return;
  if (!CID || !CSECRET || !RTOKEN) throw new Error("유튜브 미설정 (토큰 없음)");
  const token = await accessToken();
  const G = "https://www.googleapis.com/youtube/v3";
  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const title = `오즈백 · ${category}`;
  const pl = await (await fetch(`${G}/playlists?part=snippet&mine=true&maxResults=50`, { headers: H })).json();
  let pid = (pl.items || []).find((x) => x.snippet.title === title)?.id;
  if (!pid) {
    const np = await (await fetch(`${G}/playlists?part=snippet,status`, { method: "POST", headers: H, body: JSON.stringify({ snippet: { title, description: `오즈백 ${category} 이슈 모음` }, status: { privacyStatus: "public" } }) })).json();
    if (!np.id) throw new Error("재생목록 생성 실패: " + JSON.stringify(np).slice(0, 120));
    pid = np.id;
  }
  const r = await (await fetch(`${G}/playlistItems?part=snippet`, { method: "POST", headers: H, body: JSON.stringify({ snippet: { playlistId: pid, resourceId: { kind: "youtube#video", videoId } } }) })).json();
  if (!r.id) throw new Error("재생목록 담기 실패: " + JSON.stringify(r).slice(0, 120));
  console.log(`  · 재생목록 분류: ${title}`);
}

// 커스텀 썸네일(첫 장) 지정. 채널이 썸네일 인증(전화 인증)돼 있어야 적용된다.
// 미인증이면 에러가 나며, 호출부에서 잡아 건너뛴다(영상은 정상 게시됨).
export async function setThumbnail(videoId, imgPath) {
  if (!CID || !CSECRET || !RTOKEN) throw new Error("유튜브 미설정 (토큰 없음)");
  const token = await accessToken();
  const type = imgPath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const r = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": type },
    body: fs.readFileSync(imgPath),
  });
  const j = await r.json();
  if (j.error) throw new Error("썸네일 지정 실패: " + JSON.stringify(j.error).slice(0, 160));
  // 지정만 하고 넘어가지 않는다 — 실제로 올라갔는지 유튜브에 되물어 확인한다(사장님 지시 2026-07-29)
  const v = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`,
    { headers: { Authorization: `Bearer ${token}` } })).json();
  const t = v.items?.[0]?.snippet?.thumbnails || {};
  const url = (t.maxres || t.standard || t.high || t.default || {}).url || "";
  const ok = /ytimg\.com/.test(url);
  console.log(ok ? `  · 유튜브 썸네일 확인됨 = 첫 카드 장면 (${url})` : "  ⚠ 유튜브 썸네일 확인 실패 — 수동 확인 필요");
  return { ok, url };
}
