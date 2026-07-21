// 기존 유튜브 영상 품질 보강 (1회성 관리 도구)
//  ① 태그가 빈약한 과거 영상에 태그(20) + 설명 해시태그(15) 보강
//  ② 카테고리별 재생목록("오즈백 · 경제" 등) 생성 후 영상 자동 분류
// 실행: node boost-youtube.mjs         → 현황만 리포트(읽기전용)
//       APPLY=1 node boost-youtube.mjs → 실제 반영
import { smembers, getJSON, redisReady } from "./redis.mjs";
import { hashtags, keywords } from "./hashtags.mjs";

const CID = process.env.YOUTUBE_CLIENT_ID, CSECRET = process.env.YOUTUBE_CLIENT_SECRET, RTOKEN = process.env.YOUTUBE_REFRESH_TOKEN;
const APPLY = process.env.APPLY === "1";
const Y = "https://www.googleapis.com/youtube/v3";
const norm = (s) => String(s || "").replace(/\s+/g, "").replace(/#shorts$/i, "").toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let TOKEN;
async function auth() {
  const r = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: CID, client_secret: CSECRET, refresh_token: RTOKEN, grant_type: "refresh_token" }) })).json();
  if (!r.access_token) throw new Error("토큰 실패: " + JSON.stringify(r).slice(0, 160));
  TOKEN = r.access_token;
}
const api = async (path, opts = {}) => {
  const r = await fetch(`${Y}/${path}`, { ...opts, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
  const j = await r.json();
  if (j.error) throw new Error(`${path} → ${JSON.stringify(j.error).slice(0, 160)}`);
  return j;
};

// 내 채널 업로드 재생목록의 모든 영상(id,title,tags,categoryId,description)
async function allUploads() {
  const ch = await api("channels?part=contentDetails&mine=true");
  const up = ch.items[0].contentDetails.relatedPlaylists.uploads;
  const ids = [];
  let page = "";
  do {
    const j = await api(`playlistItems?part=contentDetails&maxResults=50&playlistId=${up}${page ? "&pageToken=" + page : ""}`);
    for (const it of j.items) ids.push(it.contentDetails.videoId);
    page = j.nextPageToken || "";
  } while (page);
  const vids = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await api(`videos?part=snippet&id=${ids.slice(i, i + 50).join(",")}`);
    for (const v of j.items) vids.push({ id: v.id, title: v.snippet.title, tags: v.snippet.tags || [], desc: v.snippet.description || "", categoryId: v.snippet.categoryId });
  }
  return vids;
}

async function main() {
  if (!redisReady) throw new Error("Redis 필요");
  if (!CID || !RTOKEN) throw new Error("유튜브 토큰 필요");
  await auth();

  // 발행글 로드 → 제목으로 매칭할 지도
  const slugs = await smembers("posts:published");
  const posts = (await Promise.all((slugs || []).map((s) => getJSON(`post:${s}`)))).filter(Boolean);
  const byTitle = new Map();
  for (const p of posts) if (p.title) byTitle.set(norm(p.title), p);
  console.log(`발행글 ${posts.length}개, `);

  const vids = await allUploads();
  console.log(`유튜브 업로드 영상 ${vids.length}개\n`);

  // ① 태그 보강 대상: 태그 15개 미만 & 매칭되는 글이 있는 것
  const toBoost = [];
  const byCat = {};
  let matched = 0;
  for (const v of vids) {
    const p = byTitle.get(norm(v.title));
    if (p) { matched++; (byCat[p.category] ||= []).push(v); }
    if (p && v.tags.length < 15) toBoost.push({ v, p });
  }
  console.log(`제목 매칭됨: ${matched}/${vids.length}`);
  console.log(`태그 보강 대상(15개 미만): ${toBoost.length}개`);
  console.log("카테고리 분포:", Object.fromEntries(Object.entries(byCat).map(([k, a]) => [k, a.length])));
  console.log(`\n=== ${APPLY ? "실제 반영 시작" : "리포트 전용(APPLY=1 로 실행하면 반영)"} ===\n`);
  if (!APPLY) { for (const { v } of toBoost.slice(0, 8)) console.log(`  · 보강예정: ${v.title}  (현재 태그 ${v.tags.length}개)`); return; }

  // ① 태그+설명 보강
  let done = 0;
  for (const { v, p } of toBoost) {
    const lead = (p.hook || p.title).trim();
    const desc = `${lead}\n\n👉 oddsbag.co.kr 에서 전체 글 보기\n📌 @oddsbag_official 구독\n\n${hashtags(p, 15)}`;
    try {
      await api("videos?part=snippet", { method: "PUT", body: JSON.stringify({ id: v.id, snippet: { title: v.title, description: desc, tags: keywords(p, 20), categoryId: v.categoryId || "25" } }) });
      done++; console.log(`  ✅ 태그보강 ${done}/${toBoost.length}: ${v.title}`);
    } catch (e) { console.log(`  ✗ ${v.title}: ${e.message}`); }
    await sleep(200);
  }

  // ② 카테고리별 재생목록 생성 + 분류
  const pl = await api("playlists?part=snippet&mine=true&maxResults=50");
  const plMap = new Map(pl.items.map((x) => [x.snippet.title, x.id]));
  for (const [cat, list] of Object.entries(byCat)) {
    const title = `오즈백 · ${cat}`;
    let pid = plMap.get(title), fresh = false;
    if (!pid) {
      const np = await api("playlists?part=snippet,status", { method: "POST", body: JSON.stringify({ snippet: { title, description: `오즈백 ${cat} 이슈 모음` }, status: { privacyStatus: "public" } }) });
      pid = np.id; fresh = true; console.log(`  📁 재생목록 생성: ${title}`);
      await sleep(2000); // 새 재생목록 반영 대기
    }
    // 이미 담긴 영상 파악(중복 방지). 새 목록/조회지연은 빈 것으로 간주.
    const have = new Set();
    if (!fresh) {
      try {
        let pg = "";
        do { const j = await api(`playlistItems?part=contentDetails&maxResults=50&playlistId=${pid}${pg ? "&pageToken=" + pg : ""}`); j.items.forEach((it) => have.add(it.contentDetails.videoId)); pg = j.nextPageToken || ""; } while (pg);
      } catch (e) { console.log(`     (기존 항목 조회 지연, 빈 것으로 진행)`); }
    }
    for (const v of list) {
      if (have.has(v.id)) continue;
      try { await api("playlistItems?part=snippet", { method: "POST", body: JSON.stringify({ snippet: { playlistId: pid, resourceId: { kind: "youtube#video", videoId: v.id } } }) }); console.log(`     + [${cat}] ${v.title}`); } catch (e) { console.log(`     ✗ ${v.title}: ${e.message}`); }
      await sleep(150);
    }
  }
  console.log("\n완료");
}
main().catch((e) => { console.error(e); process.exit(1); });
