// 유튜브 업로드용 리프레시 토큰 발급 도구 (1회용).
//  · homepage/.env.local 에서 YOUTUBE_CLIENT_ID/SECRET 을 읽는다.
//  · 로컬 서버(localhost)를 띄우고, 사용자가 구글 로그인 → 권한 허용하면 토큰을 받아 저장한다.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ★ 경로를 박아 쓰지 않는다. 전에 절대경로가 박혀 있었는데 폴더 이름이 바뀌자
//   (ODDSBAG-HOME → 01_ODDSBAG/01_오피셜) 이 도구가 통째로 죽어 있었다.
//   자기 위치에서 상대경로로 찾으면 폴더를 옮겨도 따라온다.
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ENV = path.join(여기, "..", ".env.local");
const OUT = path.join(여기, "refresh-token.txt");

// 다른 채널 키를 받을 때는 환경변수로 덮어쓴다.
//   예) YT_CLIENT_ID=... YT_CLIENT_SECRET=... node get-refresh-token.mjs
// 안 넘기면 .env.local 의 기본(오피셜) 값을 쓴다.
const env = fs.existsSync(ENV) ? fs.readFileSync(ENV, "utf8") : "";
const CID = process.env.YT_CLIENT_ID || env.match(/^YOUTUBE_CLIENT_ID=(.+)$/m)?.[1].trim();
const CSECRET = process.env.YT_CLIENT_SECRET || env.match(/^YOUTUBE_CLIENT_SECRET=(.+)$/m)?.[1].trim();
if (!CID || !CSECRET) {
  console.error("CLIENT_ID/SECRET 을 못 찾았습니다. .env.local 을 확인하거나 YT_CLIENT_ID/YT_CLIENT_SECRET 로 넘겨주세요.");
  process.exit(1);
}
const PORT = 4785;
const REDIRECT = `http://localhost:${PORT}`;

const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: CID,
  redirect_uri: REDIRECT,
  response_type: "code",
  scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl",
  access_type: "offline",
  prompt: "consent",
});

console.log("AUTH_URL=" + authUrl);

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, REDIRECT);
  const code = u.searchParams.get("code");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!code) { res.end("<h3>코드 없음 — 다시 시도해주세요</h3>"); return; }
  try {
    const tr = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({ client_id: CID, client_secret: CSECRET, code, redirect_uri: REDIRECT, grant_type: "authorization_code" }),
    });
    const tk = await tr.json();
    if (tk.refresh_token) {
      fs.writeFileSync(OUT, tk.refresh_token);
      res.end("<h2 style='font-family:sans-serif'>✅ 유튜브 연결 완료! 이 창을 닫으셔도 됩니다.</h2>");
      console.log("SUCCESS: refresh token saved");
      setTimeout(() => process.exit(0), 800);
    } else {
      res.end("<h3>실패: " + JSON.stringify(tk) + "</h3>");
      console.log("ERROR=" + JSON.stringify(tk));
    }
  } catch (e) {
    res.end("<h3>오류: " + e.message + "</h3>");
    console.log("ERROR=" + e.message);
  }
});
server.listen(PORT, () => console.log("LISTENING on " + PORT));
