// 새 영상이 올라간 글의 '옛 영상'을 지워 교체한다. (릴스 제작 직후 실행)
//
// 왜: 같은 글의 영상이 두 개 올라가 있으면 중복으로 보인다. 사장님 지시(2026-07-29) —
//     "새 영상 올라가면 그때마다 교체".
//
// 안전장치 (하나라도 걸리면 아무것도 안 지운다)
//   · 같은 글에 영상이 2개 이상일 때만 동작한다 — 하나뿐이면 절대 안 건드린다
//   · 가장 최근 것 1개는 무조건 남긴다
//   · 기본은 미리보기. 실제 삭제는 --confirm (워크플로에서는 자동으로 붙인다)
//
// 사용법:  node replace-old.mjs             (미리보기)
//         node replace-old.mjs --confirm    (실제 교체)
//         SLUGS=a,b node replace-old.mjs --confirm   (특정 글만)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIRM = process.argv.includes("--confirm");
const G = "https://graph.facebook.com/v21.0";
const Y = "https://www.googleapis.com/youtube/v3";

// 로컬 실행 편의: .env.local 이 있으면 읽어 채운다 (GitHub Actions 에서는 이미 env 에 있다)
const envPath = path.join(__dirname, "..", "homepage", ".env.local");
if (fs.existsSync(envPath)) {
  for (const l of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

const norm = (s) => String(s || "").replace(/[^0-9a-z가-힣]/gi, "").toLowerCase();
const keyOf = (post) => [post.title, post.hook, post.summary].filter(Boolean).map((k) => norm(k).slice(0, 12)).filter(Boolean);

async function ytToken() {
  const b = new URLSearchParams({ client_id: process.env.YOUTUBE_CLIENT_ID, client_secret: process.env.YOUTUBE_CLIENT_SECRET, refresh_token: process.env.YOUTUBE_REFRESH_TOKEN, grant_type: "refresh_token" });
  const j = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: b })).json();
  return j.access_token;
}
async function ytVideos(tok) {
  const ch = await (await fetch(`${Y}/channels?part=contentDetails&mine=true`, { headers: { Authorization: `Bearer ${tok}` } })).json();
  const up = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  const ids = []; let page = "";
  do {
    const j = await (await fetch(`${Y}/playlistItems?part=contentDetails&maxResults=50&playlistId=${up}${page ? "&pageToken=" + page : ""}`, { headers: { Authorization: `Bearer ${tok}` } })).json();
    (j.items || []).forEach((i) => ids.push(i.contentDetails.videoId));
    page = j.nextPageToken || "";
  } while (page);
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await (await fetch(`${Y}/videos?part=snippet&id=${ids.slice(i, i + 50).join(",")}`, { headers: { Authorization: `Bearer ${tok}` } })).json();
    (j.items || []).forEach((v) => out.push({ id: v.id, title: v.snippet.title, at: v.snippet.publishedAt }));
  }
  return out;
}
async function igMedia() {
  const out = []; let url = `${G}/${process.env.INSTAGRAM_ACCOUNT_ID}/media?fields=id,caption,media_product_type,permalink,timestamp&limit=100&access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`;
  while (url) { const j = await (await fetch(url)).json(); (j.data || []).forEach((m) => out.push(m)); url = j.paging?.next || ""; }
  return out.filter((m) => m.media_product_type === "REELS");
}

async function main() {
  // redis.mjs 는 불러오는 순간 환경변수를 읽는다 → .env.local 을 채운 '뒤'에 불러온다
  const { smembers, getJSON } = await import("./redis.mjs");
  const tok = await ytToken();
  const [yt, ig] = await Promise.all([ytVideos(tok), igMedia()]);
  const slugs = process.env.SLUGS ? process.env.SLUGS.split(",").map((s) => s.trim()).filter(Boolean) : await smembers("reels:done");
  console.log(`대상 ${slugs.length}편 · 유튜브 ${yt.length} · 인스타 릴스 ${ig.length} · 모드: ${CONFIRM ? "🔴 실제 교체" : "🟢 미리보기"}\n`);

  let removed = 0;
  for (const slug of slugs) {
    const post = await getJSON(`post:${slug}`);
    if (!post) continue;
    const keys = keyOf(post);
    if (!keys.length) continue;

    // 유튜브 — 같은 글의 영상이 2개 이상일 때만, 최신 1개 남기고 나머지 삭제
    const mine = yt.filter((v) => keys.some((k) => norm(v.title).includes(k))).sort((a, b) => (a.at < b.at ? 1 : -1));
    for (const old of mine.slice(1)) {
      console.log(`  ${slug} · 유튜브 옛 영상 ${old.id} (${old.at.slice(0, 10)}) ← 최신 ${mine[0].id}`);
      if (CONFIRM) {
        const r = await fetch(`${Y}/videos?id=${old.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${tok}` } });
        console.log(r.ok ? "    ✓ 삭제" : `    ✗ 실패 ${r.status}`);
        if (r.ok) removed++;
      }
    }
    // 인스타 릴스 — 캡션 첫 줄이 훅이므로 title·hook·summary 로 대조한다
    const mineIg = ig.filter((m) => keys.some((k) => norm((m.caption || "").split("📌")[0]).includes(k)))
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    for (const old of mineIg.slice(1)) {
      console.log(`  ${slug} · 인스타 옛 릴스 ${old.permalink} (${old.timestamp.slice(0, 10)})`);
      if (CONFIRM) {
        const j = await (await fetch(`${G}/${old.id}?access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`, { method: "DELETE" })).json();
        console.log(j.error ? `    ⚠ 삭제 불가(수동): ${old.permalink}` : "    ✓ 삭제");
        if (!j.error) removed++;
      }
    }
  }
  console.log(`\n${CONFIRM ? `교체 완료 — 옛 게시물 ${removed}개 삭제` : "미리보기 끝. 실제 교체는 --confirm"}`);
}
main().catch((e) => { console.error("실패:", e.message); process.exit(0); }); // 교체 실패가 제작을 막지 않도록 0으로 종료
