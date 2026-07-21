// 깨진 릴스 정리 도구 — 지정한 slug들의 유튜브/인스타/페북 영상을 찾아 삭제하고,
// reels:done 에서 빼서 재제작 대상으로 돌린다. 홈페이지 글은 건드리지 않는다.
// 실행: node cleanup-broken-reels.mjs          → 모의실행(무엇을 지울지 목록만)
//       APPLY=1 node cleanup-broken-reels.mjs  → 실제 삭제 + reels:done 제거
import fs from "node:fs";
import { getJSON, srem, sadd } from "./redis.mjs";

const APPLY = process.env.APPLY === "1";
const SLUGS = JSON.parse(fs.readFileSync("/tmp/broken-slugs.json", "utf8"));
const IG = process.env.INSTAGRAM_ACCOUNT_ID, TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const G = "https://graph.facebook.com/v21.0";
const norm = (s) => String(s || "").replace(/\s+/g, "").replace(/#shorts$/i, "").toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 유튜브 ----
async function ytToken() {
  const r = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: process.env.YOUTUBE_CLIENT_ID, client_secret: process.env.YOUTUBE_CLIENT_SECRET, refresh_token: process.env.YOUTUBE_REFRESH_TOKEN, grant_type: "refresh_token" }) })).json();
  return r.access_token;
}
async function ytUploads(tok) {
  const Y = "https://www.googleapis.com/youtube/v3";
  const ch = await (await fetch(`${Y}/channels?part=contentDetails&mine=true`, { headers: { Authorization: `Bearer ${tok}` } })).json();
  const up = ch.items[0].contentDetails.relatedPlaylists.uploads;
  const ids = []; let page = "";
  do { const j = await (await fetch(`${Y}/playlistItems?part=contentDetails&maxResults=50&playlistId=${up}${page ? "&pageToken=" + page : ""}`, { headers: { Authorization: `Bearer ${tok}` } })).json(); j.items.forEach((it) => ids.push(it.contentDetails.videoId)); page = j.nextPageToken || ""; } while (page);
  const map = new Map();
  for (let i = 0; i < ids.length; i += 50) { const j = await (await fetch(`${Y}/videos?part=snippet&id=${ids.slice(i, i + 50).join(",")}`, { headers: { Authorization: `Bearer ${tok}` } })).json(); j.items.forEach((v) => map.set(norm(v.snippet.title), { id: v.id, title: v.snippet.title })); }
  return map;
}

// ---- 인스타/페북 목록 ----
async function igMedia() {
  const map = [];
  let url = `${G}/${IG}/media?fields=id,caption&limit=100&access_token=${TOKEN}`;
  while (url) { const j = await (await fetch(url)).json(); (j.data || []).forEach((m) => map.push({ id: m.id, first: norm((m.caption || "").split("\n")[0]) })); url = j.paging?.next || ""; }
  return map;
}
async function fbVideos() {
  const pid = process.env.FACEBOOK_PAGE_ID || (await (await fetch(`${G}/me?fields=id&access_token=${TOKEN}`)).json()).id;
  const ptoken = (await (await fetch(`${G}/${pid}?fields=access_token&access_token=${TOKEN}`)).json()).access_token || TOKEN;
  const map = []; let url = `${G}/${pid}/videos?fields=id,description&limit=100&access_token=${ptoken}`;
  while (url) { const j = await (await fetch(url)).json(); (j.data || []).forEach((v) => map.push({ id: v.id, first: norm((v.description || "").split("\n")[0]) })); url = j.paging?.next || ""; }
  return { map, ptoken };
}

async function main() {
  const posts = (await Promise.all(SLUGS.map((s) => getJSON(`post:${s}`)))).filter(Boolean);
  const tok = await ytToken();
  const [yt, ig, fb] = await Promise.all([ytUploads(tok), igMedia(), fbVideos()]);
  console.log(`대상 ${posts.length}개 · ${APPLY ? "실제 삭제" : "모의실행(APPLY=1 로 실제 삭제)"}\n`);

  const plan = [];
  for (const p of posts) {
    const lead = norm(p.hook || p.title);
    const y = yt.get(norm(p.title));
    const i = ig.find((m) => m.first && (m.first === lead || m.first.startsWith(lead.slice(0, 12))));
    const f = fb.map.find((m) => m.first && (m.first === lead || m.first.startsWith(lead.slice(0, 12))));
    plan.push({ p, y, i, f });
    console.log(`▶ ${p.title}`);
    console.log(`   유튜브: ${y ? y.id : "못찾음"} · 인스타: ${i ? i.id : "못찾음"} · 페북: ${f ? f.id : "못찾음"}`);
  }
  if (!APPLY) { console.log("\n(모의실행 — 실제 삭제 안 함)"); return; }

  console.log("\n=== 삭제 실행 ===");
  const Y = "https://www.googleapis.com/youtube/v3";
  for (const { p, y, i, f } of plan) {
    if (y) { const r = await fetch(`${Y}/videos?id=${y.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${tok}` } }); console.log(`  유튜브 삭제 ${y.id}: ${r.status === 204 ? "OK" : await r.text()}`); await sleep(150); }
    if (i) { const r = await (await fetch(`${G}/${i.id}?access_token=${TOKEN}`, { method: "DELETE" })).json(); console.log(`  인스타 삭제 ${i.id}: ${JSON.stringify(r).slice(0, 80)}`); await sleep(150); }
    if (f) { const r = await (await fetch(`${G}/${f.id}?access_token=${fb.ptoken}`, { method: "DELETE" })).json(); console.log(`  페북 삭제 ${f.id}: ${JSON.stringify(r).slice(0, 80)}`); await sleep(150); }
    await srem("reels:done", p.slug);       // 재제작 대상으로 되돌림
    await sadd("reels:priority", p.slug);    // 우선순위 큐에 올려 먼저 다시 만들게
    console.log(`  재제작 우선순위 등록: ${p.slug}`);
  }
  console.log("\n완료 — 지운 글들은 다음 자동 실행부터 B-roll로 다시 만들어집니다.");
}
main().catch((e) => { console.error(e); process.exit(1); });
