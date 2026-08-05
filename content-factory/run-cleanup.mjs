// 뉴스 글 정리 — 꿀팁·가이드와 '반응 있었던 글'만 남기고 나머지는 보관함으로 옮긴다.
//
// ★ 지우는 게 아니다. 보관함으로 자리만 옮긴다.
//   · 홈·목록·검색·사이트맵에서 사라진다 (검색엔진이 보는 글 수가 줄어든다)
//   · 글 데이터는 그대로 남아 있어 언제든 되돌릴 수 있다
//   · 되돌리기: restoreArchived(slug) — posts.mjs 에 이미 있다
//   · 전체 백업: 05_기록/백업/발행글_전체백업_20260805.json
//
// 남기는 기준 (--기준 으로 조절):
//   1) 카테고리가 꿀팁·가이드 → 무조건 남긴다
//   2) 유튜브 쇼츠 조회수가 기준치 이상 → 남긴다 (기본 200회)
//
// 쓰는 법:
//   cd homepage/content-factory
//   node --env-file=../.env.local run-cleanup.mjs                    ← 목록만 보여줌 (안 건드림)
//   node --env-file=../.env.local run-cleanup.mjs --기준 300         ← 기준 바꿔서 미리보기
//   node --env-file=../.env.local run-cleanup.mjs --실행 --개수 30    ← 실제로 30편만 옮김
//
// 한 번에 다 옮기지 말고 --개수 로 나눠서 하는 것을 권한다.

import { smembers, kvGet, kvSet, sadd, srem } from "./store.mjs";

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const 실행 = process.argv.includes("--실행") || process.argv.includes("--run");
const 기준 = Number(arg("--기준", 200));
const 개수 = Number(arg("--개수", 0)); // 0이면 전부
const J = (v) => (typeof v === "string" ? JSON.parse(v) : v);
const TIP = /꿀팁|가이드/;

// ---- 유튜브 조회수 가져오기 ----
async function youtubeViews() {
  const { YOUTUBE_CLIENT_ID: CID, YOUTUBE_CLIENT_SECRET: CS, YOUTUBE_REFRESH_TOKEN: RT } = process.env;
  if (!CID || !CS || !RT) {
    console.log("⚠️  유튜브 키가 없어 조회수를 못 가져옵니다. 꿀팁·가이드만 남기게 됩니다.");
    return new Map();
  }
  const tj = await (await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CID, client_secret: CS, refresh_token: RT, grant_type: "refresh_token" }),
  })).json();
  if (!tj.access_token) {
    console.log("⚠️  유튜브 토큰 갱신 실패 — 꿀팁·가이드만 남기게 됩니다.");
    return new Map();
  }
  const H = { Authorization: `Bearer ${tj.access_token}` };
  const sj = await (await fetch("https://www.googleapis.com/youtube/v3/search?part=snippet&forMine=true&type=video&order=date&maxResults=50", { headers: H })).json();
  const ids = (sj.items || []).map((i) => i.id?.videoId).filter(Boolean);
  if (!ids.length) return new Map();
  const vj = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids.join(",")}`, { headers: H })).json();
  const norm = (s) => (s || "").replace(/\s*#Shorts\s*$/i, "").replace(/[^가-힣a-zA-Z0-9]/g, "").slice(0, 18);
  const m = new Map();
  for (const v of vj.items || []) m.set(norm(v.snippet.title), Number(v.statistics.viewCount || 0));
  return m;
}

const norm = (s) => (s || "").replace(/[^가-힣a-zA-Z0-9]/g, "").slice(0, 18);
const ytv = await youtubeViews();

const slugs = (await smembers("posts:published")) || [];
const keep = [], drop = [];
for (const s of slugs) {
  const p = J(await kvGet(`post:${s}`));
  if (!p) continue;
  const v = ytv.get(norm(p.title)) ?? 0;
  const row = { slug: s, cat: p.category || "?", date: p.date || "", title: p.title || "", ytv: v, post: p };
  (TIP.test(row.cat) || v >= 기준 ? keep : drop).push(row);
}
drop.sort((a, b) => (a.date < b.date ? -1 : 1)); // 오래된 것부터 정리

console.log(`발행글 ${slugs.length}편 → 남김 ${keep.length}편 / 보관 ${drop.length}편  (기준: 꿀팁·가이드 + 유튜브 ${기준}회 이상)`);
const 대상 = 개수 > 0 ? drop.slice(0, 개수) : drop;
console.log(`\n이번에 보관함으로 옮길 글: ${대상.length}편`);
for (const r of 대상.slice(0, 40)) console.log(` · ${r.date} | ${r.cat.padEnd(7)} | 유튜브${String(r.ytv).padStart(5)}회 | ${r.title.slice(0, 40)}`);
if (대상.length > 40) console.log(` … 외 ${대상.length - 40}편`);

console.log(`\n남는 글 ${keep.length}편:`);
for (const r of keep.sort((a, b) => b.ytv - a.ytv)) console.log(` · ${r.cat.padEnd(7)} | 유튜브${String(r.ytv).padStart(5)}회 | ${r.title.slice(0, 40)}`);

if (!실행) {
  console.log("\n※ 실제로 옮기려면 --실행 을 붙이세요. 지금은 아무것도 안 바꿨습니다.");
  process.exit(0);
}

let done = 0;
for (const r of 대상) {
  const p = r.post;
  p.status = "archived";
  p.archivedAt = new Date().toISOString();
  p.archiveReason = `뉴스 정리 (유튜브 ${r.ytv}회, 기준 ${기준}회)`;
  await kvSet(`post:${r.slug}`, JSON.stringify(p));
  await sadd("posts:archived", r.slug);
  await srem("posts:published", r.slug);
  done++;
  if (done % 10 === 0) console.log(`  …${done}/${대상.length}편 옮김`);
}
console.log(`\n완료: ${done}편을 보관함으로 옮겼습니다.`);
console.log("되돌리려면 posts.mjs 의 restoreArchived(slug) 를 쓰거나 관리자 화면 보관함에서 복원하세요.");
console.log("\n다음: node --env-file=../.env.local run-indexnow.mjs --실행  ← 줄어든 목록을 검색엔진에 다시 알립니다.");
