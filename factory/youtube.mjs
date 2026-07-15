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
