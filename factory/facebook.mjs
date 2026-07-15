// 페이스북 페이지에 영상 게시 (페이지 피드에서 바로 재생됨).
//  · 인스타와 달리 파일을 직접 업로드할 수 있다 (공개 URL 불필요).
//  · POST /{page-id}/videos  (multipart: source=파일, description=문구)
// 환경변수: FACEBOOK_PAGE_ID(선택, 없으면 자동탐색), INSTAGRAM_ACCESS_TOKEN(페이지 토큰)
//           FB_PUBLISHED=0 이면 비공개 초안으로 올림(테스트용)
import fs from "node:fs";

const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN; // 메타 페이지 토큰 (IG/FB 공용)
const G = "https://graph.facebook.com/v21.0";

async function pageId() {
  if (process.env.FACEBOOK_PAGE_ID) return process.env.FACEBOOK_PAGE_ID;
  const me = await (await fetch(`${G}/me?fields=id&access_token=${TOKEN}`)).json();
  if (!me.id) throw new Error("페이지 ID 탐색 실패: " + JSON.stringify(me).slice(0, 120));
  return me.id;
}

// 페이지 액세스 토큰 확보 (동영상 업로드는 페이지 토큰 필요)
async function pageToken(pid) {
  const r = await (await fetch(`${G}/${pid}?fields=access_token&access_token=${TOKEN}`)).json();
  return r.access_token || TOKEN; // 못 얻으면 기존 토큰 시도
}

export async function postVideo(mp4Path, description) {
  if (!TOKEN) throw new Error("페이스북 미설정 (토큰 없음)");
  const pid = await pageId();
  const ptoken = await pageToken(pid);
  const published = process.env.FB_PUBLISHED !== "0";

  const boundary = "oddsbagfb" + mp4Path.length;
  const fields = { access_token: ptoken, description, published: String(published) };
  let pre = "";
  for (const [k, v] of Object.entries(fields)) {
    pre += `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
  }
  pre += `--${boundary}\r\nContent-Disposition: form-data; name="source"; filename="reel.mp4"\r\nContent-Type: video/mp4\r\n\r\n`;
  const body = Buffer.concat([Buffer.from(pre, "utf8"), fs.readFileSync(mp4Path), Buffer.from(`\r\n--${boundary}--\r\n`, "utf8")]);

  const r = await fetch(`${G}/${pid}/videos`, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
  const j = await r.json();
  if (!j.id) throw new Error("페북 업로드 실패: " + JSON.stringify(j).slice(0, 200));
  console.log(`  · 페이스북 영상 게시: ${j.id}${published ? "" : " (비공개 초안)"}`);
  return j.id;
}
