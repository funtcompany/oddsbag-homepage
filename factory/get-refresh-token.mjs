// 유튜브 업로드용 리프레시 토큰 발급 도구 (1회용).
//  · homepage/.env.local 에서 YOUTUBE_CLIENT_ID/SECRET 을 읽는다.
//  · 로컬 서버(localhost)를 띄우고, 사용자가 구글 로그인 → 권한 허용하면 토큰을 받아 저장한다.
import http from "node:http";
import fs from "node:fs";

const ENV = "/Volumes/FUNT WORK/410_VSCODE_claude/ODDSBAG-HOME/homepage/.env.local";
const OUT = "/private/tmp/claude-501/-Volumes-FUNT-WORK-410-VSCODE-claude-ODDSBAG-HOME/9216d081-c7e7-4790-8616-78b3537b1384/scratchpad/refresh-token.txt";
const env = fs.readFileSync(ENV, "utf8");
const CID = env.match(/^YOUTUBE_CLIENT_ID=(.+)$/m)?.[1].trim();
const CSECRET = env.match(/^YOUTUBE_CLIENT_SECRET=(.+)$/m)?.[1].trim();
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
