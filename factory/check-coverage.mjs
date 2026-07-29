// 지금 살아있는 영상이 '전부 처리 경로에 들어와 있는지' 확인한다. (읽기 전용)
//
// 왜: 재제작 큐에 넣어두면 교체되지만, 글이 이미 내려간 영상은 새로 만들 일이 없어 영원히 남는다.
//     사장님 지시(2026-07-29) — 부실 쇼츠·릴스가 남아있는지 확인하고 지울 수 있게 체크할 것.
//
// 분류
//   ① 교체 예정  : reels:priority 에 있음 → 새 영상 올라가면 자동으로 지워짐
//   ② 고아 영상  : 글이 발행 목록에 없음 → 새로 만들 일이 없다. 손으로 지워야 함
//   ③ 빈약 표시  : 감사에서 문제로 잡혔는데 큐에도 없음 → 큐에 넣어야 함
//   ④ 정상       : 감사 통과 + 글 살아있음
//
// 사용법: node check-coverage.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", "homepage", ".env.local");
if (fs.existsSync(envPath)) {
  for (const l of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}
const AUDIT = path.join(__dirname, "..", "..", "..", "..", "company", "results", "O-1785260948267_감사.json");
const G = "https://graph.facebook.com/v21.0";
const Y = "https://www.googleapis.com/youtube/v3";
const norm = (s) => String(s || "").replace(/[^0-9a-z가-힣]/gi, "").toLowerCase();

async function ytToken() {
  const b = new URLSearchParams({ client_id: process.env.YOUTUBE_CLIENT_ID, client_secret: process.env.YOUTUBE_CLIENT_SECRET, refresh_token: process.env.YOUTUBE_REFRESH_TOKEN, grant_type: "refresh_token" });
  return (await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: b })).json()).access_token;
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
    const j = await (await fetch(`${Y}/videos?part=snippet,statistics&id=${ids.slice(i, i + 50).join(",")}`, { headers: { Authorization: `Bearer ${tok}` } })).json();
    (j.items || []).forEach((v) => out.push({ ch: "유튜브", id: v.id, text: v.snippet.title, at: v.snippet.publishedAt, views: Number(v.statistics?.viewCount || 0), link: `https://youtu.be/${v.id}` }));
  }
  return out;
}
async function igReels() {
  const out = []; let url = `${G}/${process.env.INSTAGRAM_ACCOUNT_ID}/media?fields=id,caption,media_product_type,permalink,timestamp&limit=100&access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`;
  while (url) { const j = await (await fetch(url)).json(); (j.data || []).forEach((m) => out.push(m)); url = j.paging?.next || ""; }
  return out.filter((m) => m.media_product_type === "REELS")
    .map((m) => ({ ch: "인스타", id: m.id, text: (m.caption || "").split("📌")[0], at: m.timestamp, views: null, link: m.permalink }));
}

const { smembers, getJSON } = await import("./redis.mjs");
const [tok, pub, prio, done] = await Promise.all([ytToken(), smembers("posts:published"), smembers("reels:priority"), smembers("reels:done")]);
const [yt, ig] = await Promise.all([ytVideos(tok), igReels()]);
const audit = fs.existsSync(AUDIT) ? Object.fromEntries(JSON.parse(fs.readFileSync(AUDIT, "utf8")).rows.map((r) => [r.slug, r])) : {};

// 발행글의 제목·훅·요약으로 색인 (영상 제목/캡션은 제목이 아니라 훅으로 시작할 수 있다)
const index = [];
for (const slug of pub) {
  const p = await getJSON(`post:${slug}`);
  if (!p) continue;
  for (const k of [p.title, p.hook, p.summary]) if (k) index.push({ slug, key: norm(k).slice(0, 12) });
}
const matchSlug = (text) => { const t = norm(text); return index.find((x) => x.key && t.includes(x.key))?.slug || null; };

const buckets = { "① 교체 예정": [], "② 고아 영상(글 없음)": [], "③ 빈약인데 큐에 없음": [], "④ 정상": [] };
for (const v of [...yt, ...ig]) {
  const slug = matchSlug(v.text);
  if (!slug) buckets["② 고아 영상(글 없음)"].push(v);
  else if (prio.includes(slug)) buckets["① 교체 예정"].push({ ...v, slug });
  else if (audit[slug] && audit[slug].signals.some((s) => s.startsWith("S2") || s.startsWith("S3") || s.startsWith("S4"))) buckets["③ 빈약인데 큐에 없음"].push({ ...v, slug });
  else buckets["④ 정상"].push({ ...v, slug });
}

console.log(`살아있는 영상 — 유튜브 ${yt.length} · 인스타 릴스 ${ig.length} · 합계 ${yt.length + ig.length}`);
console.log(`재제작 큐 ${prio.length}편 · 제작완료 ${done.length}편 · 발행글 ${pub.length}편\n`);
for (const [k, list] of Object.entries(buckets)) {
  console.log(`${k}: ${list.length}건`);
  if (k.startsWith("②") || k.startsWith("③")) {
    for (const v of list.sort((a, b) => (b.views || 0) - (a.views || 0))) {
      console.log(`   ${v.ch} ${v.at.slice(0, 10)} ${v.views !== null ? "조회" + v.views : ""} ${String(v.text).slice(0, 30).replace(/\n/g, " ")} → ${v.link}`);
    }
  }
}
const need = buckets["② 고아 영상(글 없음)"].length + buckets["③ 빈약인데 큐에 없음"].length;
console.log(`\n손이 필요한 영상: ${need}건 ${need ? "(② 는 손으로 삭제, ③ 은 큐에 추가하면 자동 교체)" : "— 전부 처리 경로에 들어와 있습니다"}`);
