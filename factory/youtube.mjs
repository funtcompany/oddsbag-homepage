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

export async function uploadShort(mp4Path, { title, description, tags, privacy = "public" }) {
  if (!CID || !CSECRET || !RTOKEN) throw new Error("유튜브 미설정 (토큰 없음)");
  const token = await accessToken();

  const meta = {
    snippet: { title: title.slice(0, 100), description, tags, categoryId: "25" }, // 25 = News & Politics
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
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
  console.log(`  · 유튜브 쇼츠 게시: https://youtu.be/${j.id}`);
  return j.id;
}

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
  console.log("  · 유튜브 썸네일 = 첫 장 지정됨");
}
