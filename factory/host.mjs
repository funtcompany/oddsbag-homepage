// 완성 mp4(또는 썸네일 이미지)를 공개 URL로 올린다.
//  · 인스타 릴스는 '공개 영상 주소'를, 커버 지정은 '공개 이미지 주소'를 요구하므로.
//  · 무료·무가입 호스트를 여러 곳 순서대로 시도한다 — 한 곳이 막혀도(특히 CI 서버 IP 차단)
//    다음 호스트로 넘어가 인스타가 계속 올라가게 한다.
import fs from "node:fs";

const MIME = { mp4: "video/mp4", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
const VALID = /^https:\/\/.+\.(mp4|jpe?g|png)(\?.*)?$/i;
const UA = "Mozilla/5.0 (oddsbag reel factory)";

// 공통 멀티파트 본문 만들기
function multipart(boundary, fieldName, buf, ext, type, extraFields = {}) {
  let pre = "";
  for (const [k, v] of Object.entries(extraFields)) {
    pre += `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
  }
  pre += `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="upload.${ext}"\r\nContent-Type: ${type}\r\n\r\n`;
  return Buffer.concat([Buffer.from(pre, "utf8"), buf, Buffer.from(`\r\n--${boundary}--\r\n`, "utf8")]);
}

// tmpfiles.org — 60분 보관(즉시 게시엔 충분), JSON 반환. CI에서 잘 통과함
async function toTmpfiles(buf, ext, type) {
  const boundary = "oddsbagtf" + buf.length;
  const body = multipart(boundary, "file", buf, ext, type);
  const r = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "User-Agent": UA },
    body,
    signal: AbortSignal.timeout(120000),
  });
  const j = await r.json();
  const page = j?.data?.url?.trim() || "";
  // 페이지 URL(https://tmpfiles.org/12345/upload.mp4) → 직접 다운로드 URL(/dl/)로 변환
  return page ? page.replace(/^http:/, "https:").replace("tmpfiles.org/", "tmpfiles.org/dl/") : "";
}

// uguu.se — 3시간 보관, JSON 반환
async function toUguu(buf, ext, type) {
  const boundary = "oddsbaguu" + buf.length;
  const body = multipart(boundary, "files[]", buf, ext, type);
  const r = await fetch("https://uguu.se/upload.php", {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "User-Agent": UA },
    body,
    signal: AbortSignal.timeout(120000),
  });
  const j = await r.json();
  return j?.files?.[0]?.url?.trim() || "";
}

// catbox.moe — 영구 보관, 평문 URL 반환
async function toCatbox(buf, ext, type) {
  const boundary = "oddsbagcb" + buf.length;
  const body = multipart(boundary, "fileToUpload", buf, ext, type, { reqtype: "fileupload" });
  const r = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "User-Agent": UA },
    body,
    signal: AbortSignal.timeout(120000),
  });
  return (await r.text()).trim();
}

// 0x0.st — 최대 30일 보관, 평문 URL 반환. 확장자 보존
async function to0x0(buf, ext, type) {
  const boundary = "oddsbag0x" + buf.length;
  const body = multipart(boundary, "file", buf, ext, type);
  const r = await fetch("https://0x0.st", {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "User-Agent": UA },
    body,
    signal: AbortSignal.timeout(120000),
  });
  return (await r.text()).trim();
}

// 순서: 실제 검증 결과 기준.
//  · uguu = 업로드도 되고 메타(인스타)가 주소를 정상 인코딩 → 1순위(검증됨 2026-07-20)
//  · 0x0/catbox = 메타 호환은 좋으나 CI(깃허브) IP를 자주 차단 → 예비
//  · tmpfiles = 업로드는 잘 되나 다운로드 주소를 메타가 거부(ERROR) → 최후 예비
const HOSTS = [["uguu", toUguu], ["0x0", to0x0], ["catbox", toCatbox], ["tmpfiles", toTmpfiles]];

export async function uploadPublic(filePath) {
  const ext = (filePath.split(".").pop() || "mp4").toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const buf = fs.readFileSync(filePath);
  const errs = [];
  for (const [name, fn] of HOSTS) {
    try {
      const url = await fn(buf, ext, type);
      if (VALID.test(url)) { console.log(`  · 공개 호스팅 성공(${name}): ${url}`); return url; }
      errs.push(`${name}: ${url.slice(0, 80) || "빈 응답"}`);
    } catch (e) {
      errs.push(`${name}: ${e.message}`);
    }
  }
  throw new Error("공개 호스팅 전부 실패 — " + errs.join(" | "));
}
