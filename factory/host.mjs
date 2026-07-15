// 완성 mp4를 공개 URL로 올린다 (인스타 릴스는 '공개 영상 주소'를 요구하므로).
// 무료·무가입 호스트(catbox.moe) 사용. 실패하면 인스타만 건너뛰고 유튜브·페북은 정상 게시.
import fs from "node:fs";

export async function uploadPublic(mp4Path) {
  const boundary = "oddsbaghost" + mp4Path.length;
  const pre = `--${boundary}\r\nContent-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="fileToUpload"; filename="reel.mp4"\r\nContent-Type: video/mp4\r\n\r\n`;
  const body = Buffer.concat([Buffer.from(pre, "utf8"), fs.readFileSync(mp4Path), Buffer.from(`\r\n--${boundary}--\r\n`, "utf8")]);
  const r = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "User-Agent": "Mozilla/5.0 (oddsbag reel factory)" },
    body,
  });
  const url = (await r.text()).trim();
  if (!/^https?:\/\/.+\.(mp4)$/i.test(url)) throw new Error("호스팅 실패: " + url.slice(0, 120));
  return url;
}
