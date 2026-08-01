// 깨진 카드뉴스 교체 — 인스타 게시물을 '지우고 곧바로 다시 올린다' (한 편씩)
//  · 카드 이미지는 홈페이지가 그때그때 그리므로, 다시 올리면 고쳐진 카드가 나간다
//  · 지우기와 올리기를 한 편 단위로 붙여, 비어 있는 시간을 몇 초로 줄인다
//  실행: node repost-cards.mjs           → 모의실행(무엇을 바꿀지 목록만)
//        APPLY=1 node repost-cards.mjs   → 실제 교체
import fs from "node:fs";
import { getJSON } from "./redis.mjs";
import { buildCards, buildCaption, buildHashtags, firstCommentEmoji } from "../content-factory/cards.mjs";

const APPLY = process.env.APPLY === "1";
const SLUGS = JSON.parse(fs.readFileSync("/tmp/broken-slugs.json", "utf8"));
const IG = process.env.INSTAGRAM_ACCOUNT_ID, TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const SITE = process.env.SITE_URL || "https://oddsbag.co.kr";
const G = "https://graph.facebook.com/v21.0";
const norm = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 메타 앱 호출 한도(code 4)·일시 오류(code 1,2)는 기다렸다 다시 시도한다.
//  ★ 2026-08-01: 한 편 올리는 데 12번 넘게 호출해 곧바로 한도에 걸렸다. 간격과 재시도가 필수.
async function graph(path, params, method = "POST", tries = 4) {
  let last;
  for (let t = 0; t < tries; t++) {
    const url = new URL(G + path);
    const body = new URLSearchParams({ ...params, access_token: TOKEN });
    const r = method === "GET" ? await fetch(`${url}?${body}`) : await fetch(url, { method: "POST", body });
    const j = await r.json();
    if (!j.error) return j;
    last = `${j.error.message} (code ${j.error.code})`;
    if (![1, 2, 4, 17, 32, 613].includes(j.error.code)) break;   // 한도·일시오류만 재시도
    const wait = 60000 * (t + 1);
    console.log(`     …한도에 걸려 ${wait / 1000}초 쉬었다 다시 시도 (${t + 1}/${tries})`);
    await sleep(wait);
  }
  throw new Error(last);
}
async function igMedia() {
  const out = []; let url = `${G}/${IG}/media?fields=id,caption,timestamp&limit=100&access_token=${TOKEN}`;
  while (url) { const j = await (await fetch(url)).json(); (j.data || []).forEach((m) => out.push({ id: m.id, first: norm((m.caption || "").split("\n")[0]), ts: m.timestamp })); url = j.paging?.next || ""; }
  return out;
}
// 남은 게시 한도 (인스타는 24시간 25건)
async function quotaLeft() {
  try {
    const j = await graph(`/${IG}/content_publishing_limit`, { fields: "config,quota_usage" }, "GET");
    const used = j.data?.[0]?.quota_usage ?? 0, cap = j.data?.[0]?.config?.quota_total ?? 25;
    return { used, cap, left: cap - used };
  } catch { return { used: 0, cap: 25, left: 25 }; }
}
async function postCarousel(post) {
  const cards = buildCards(post);
  const n = Math.min(Math.max(cards.length, 5), 10);
  const children = [];
  for (let i = 0; i < n; i++) {
    const r = await graph(`/${IG}/media`, { image_url: `${SITE}/api/card/${post.slug}?i=${i}`, is_carousel_item: "true" });
    children.push(r.id);
  }
  const c = await graph(`/${IG}/media`, { media_type: "CAROUSEL", children: children.join(","), caption: buildCaption(post) });
  for (let t = 0; t < 30; t++) {
    const s = await graph(`/${c.id}`, { fields: "status_code" }, "GET");
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`컨테이너 ${s.status_code}`);
    await sleep(3000);
  }
  const pub = await graph(`/${IG}/media_publish`, { creation_id: c.id });
  if (!pub.id) throw new Error("발행 실패");
  return pub.id;
}

// 방금 올라간 게시물 찾기 — 캡션 첫 줄(훅)이 같고 10분 안에 올라온 것
async function findJustPosted(post) {
  const lead = norm(post.hook || post.title);
  const j = await (await fetch(`${G}/${IG}/media?fields=id,caption,timestamp&limit=10&access_token=${TOKEN}`)).json();
  const cut = Date.now() - 10 * 60 * 1000;
  const m = (j.data || []).find(
    (x) => norm((x.caption || "").split("\n")[0]) === lead && new Date(x.timestamp).getTime() > cut,
  );
  return m ? m.id : null;
}

const posts = (await Promise.all(SLUGS.map((s) => getJSON(`post:${s}`)))).filter(Boolean);
const media = await igMedia();
const q = await quotaLeft();
const targets = [];
for (const p of posts) {
  const lead = norm(p.hook || p.title);
  const m = media.find((x) => x.first && (x.first === lead || x.first.startsWith(lead.slice(0, 12))));
  if (m) targets.push({ p, m });
}
console.log(`인스타 카드뉴스 교체 대상: ${targets.length}편`);
console.log(`오늘 남은 게시 한도: ${q.left}건 (${q.used}/${q.cap} 사용)\n`);
targets.forEach(({ p, m }, i) => console.log(`${String(i + 1).padStart(2)}. ${p.title}\n     게시물 ${m.id} · ${String(m.ts).slice(0, 10)}`));
if (!APPLY) { console.log("\n(모의실행 — 아무것도 바꾸지 않았습니다. APPLY=1 로 실제 교체)"); process.exit(0); }
if (targets.length > q.left) { console.log(`\n⚠️ 한도 부족 — ${q.left}편만 교체하고 멈춥니다.`); }

console.log("\n=== 교체 실행 (한 편씩: 지우고 → 바로 올리기) ===");
let ok = 0, fail = 0;
for (const { p, m } of targets.slice(0, q.left)) {
  try {
    const del = await (await fetch(`${G}/${m.id}?access_token=${TOKEN}`, { method: "DELETE" })).json();
    if (del.error) throw new Error("삭제 실패: " + del.error.message);
    // ★ 메타는 실제로 올라갔는데도 오류(code -1, code 4)를 돌려주는 일이 잦다.
    //   그 말을 믿고 실패로 처리하면 해시태그가 빠지고, 다시 시도하면 같은 글이 두 번 올라간다.
    //   그래서 오류가 나면 '진짜 올라갔는지' 인스타에 되물어 확인한다.
    let id;
    try {
      id = await postCarousel(p);
    } catch (e) {
      await sleep(15000);
      id = await findJustPosted(p);
      if (!id) throw e;                       // 정말 안 올라갔다
      console.log(`     (오류 응답이었지만 실제로는 올라감 — 확인함)`);
    }
    let tag = "해시태그 OK";
    try {
      const cm = await graph(`/${id}/comments`, { message: firstCommentEmoji(p) });
      await graph(`/${cm.id}/replies`, { message: buildHashtags(p) });
    } catch (e) { tag = "해시태그 실패(" + e.message.slice(0, 40) + ")"; }
    console.log(`  ✅ ${p.title}\n       옛 ${m.id} 삭제 → 새 ${id} 게시 · ${tag}`);
    ok++;
  } catch (e) {
    console.log(`  ❌ ${p.title}\n       ${e.message}`);
    fail++;
  }
  await sleep(90000);   // 다음 편까지 90초 — 앱 호출 한도에 걸리지 않게
}
console.log(`\n완료 — 교체 ${ok}편 · 실패 ${fail}편`);
