// 오즈백 — WPMS 원고 일괄 발행 / 되돌리기
//
// 사장님 지시 2026-08-18: 「홈페이지는 그러면 1-50편 일괄 업로드하자」
//
// ★이 파일이 하는 일은 둘뿐이다 —
//   ① content/posts/wpms-*.json 을 한꺼번에 발행 상태로 바꾼다
//   ② 그것을 한꺼번에 검수함으로 되돌린다
//
// ★하지 않는 일 — 수집 · AI 글쓰기 · 품질심사 · 인스타/페북 · 노션 · 릴스.
//   불러오는 것은 store.mjs(레디스)와 indexnow.mjs(검색엔진 알림)뿐이다.
//   run-daily.mjs 와 같은 방식으로 발행하므로 결과가 서로 어긋나지 않는다.
//
// ★되돌릴 수 있게 만들었다 —
//   발행 직전에 「그 글들이 지금 어떤 상태였는지」를 파일로 떠 둔다(되돌림표).
//   되돌리기는 그 파일을 보고 «있던 그대로» 돌려놓는다. 짐작으로 지우지 않는다.
//
// 쓰는 법 (반드시 레포 뿌리 homepage/ 에서)
//   node content-factory/wpms-일괄.mjs 상태
//   node content-factory/wpms-일괄.mjs 발행            ← 계획만 보여줌 (아무것도 안 바꿈)
//   node content-factory/wpms-일괄.mjs 발행 --실행      ← 실제로 발행
//   node content-factory/wpms-일괄.mjs 되돌리기         ← 계획만
//   node content-factory/wpms-일괄.mjs 되돌리기 --실행  ← 실제로 되돌림
//   옵션  --only=wpms-50   한 편만 (시험용)
//        --건너뛰기알림     검색엔진 알림 생략

import fs from "node:fs";
import path from "node:path";

// 로컬에서 돌릴 때만 .env.local 에서 레디스 열쇠를 읽는다.
// (깃허브 러너에서는 워크플로 env 로 이미 들어와 있어 이 과정이 그냥 넘어간다)
if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.KV_REST_API_URL) {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const v = m[2].replace(/^["']|["']$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  }
}

const { kvGet, kvSet, smembers, sadd, srem, isPersistent } = await import("./store.mjs");

const 명령 = process.argv[2] || "상태";
const 실행 = process.argv.includes("--실행");
const 알림생략 = process.argv.includes("--건너뛰기알림");
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").split("=")[1] || null;

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const K_PUBLISHED = "posts:published";
const K_DRAFTS = "posts:drafts";
const K_ARCHIVED = "posts:archived";

// 되돌림표를 두는 곳. 깃에 올리지 않는다(.gitignore 확인할 것).
const 되돌림표 = path.join(process.cwd(), "content-factory", "_wpms-되돌림표.json");

const 한국날짜 = (d = new Date()) =>
  new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const 채널of = (p) => p.channel || "magazine";

/** WPMS 원고만 고른다 — 파일 이름이 wpms- 로 시작하는 것. */
function 대상원고() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("._") && f.startsWith("wpms-"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(POSTS_DIR, f), "utf-8")))
    .filter((p) => (only ? p.slug === only : true))
    .sort((a, b) => (a.slug < b.slug ? -1 : 1));
}

function 레디스확인() {
  if (!isPersistent) {
    // 이 확인이 없으면 레디스 없이도 「성공」으로 끝난다. 메모리에 쓰고 사라진다.
    console.error("✗ 레디스(UPSTASH) 설정이 없다. 아무것도 하지 않고 멈춘다.");
    process.exit(1);
  }
}

async function 상태() {
  레디스확인();
  const 원고 = 대상원고();
  const 발행됨 = new Set(await smembers(K_PUBLISHED));
  const 보관됨 = new Set(await smembers(K_ARCHIVED));
  const 나간것 = 원고.filter((p) => 발행됨.has(p.slug));
  const 보관 = 원고.filter((p) => 보관됨.has(p.slug));
  const 대기 = 원고.filter((p) => !발행됨.has(p.slug) && !보관됨.has(p.slug));

  console.log(`[WPMS 일괄] 원고 ${원고.length}편`);
  console.log(`  발행됨 ${나간것.length} · 대기(검수함) ${대기.length} · 보관 ${보관.length}`);
  const 채널들 = [...new Set(원고.map((p) => `${채널of(p)}/${p.category}`))];
  console.log(`  코너: ${채널들.join(" · ")}`);
  console.log(`  되돌림표: ${fs.existsSync(되돌림표) ? "있음 — 되돌리기 가능" : "없음"}`);
  return { 원고, 발행됨, 보관됨, 대기, 나간것 };
}

async function 발행() {
  const { 원고, 대기 } = await 상태();
  if (대기.length === 0) {
    console.log("\n→ 새로 나갈 원고가 없다. 아무것도 하지 않는다.");
    return;
  }

  console.log(`\n나갈 글 ${대기.length}편:`);
  for (const p of 대기)
    console.log(`  · ${p.slug} · ${채널of(p)}/${p.category} · ${p.title}`);

  if (!실행) {
    console.log(`\n[계획만 보여줬다. 아무것도 바꾸지 않았다]`);
    console.log(`실제로 올리려면 뒤에 --실행 을 붙인다.`);
    return;
  }

  // ★되돌림표를 «먼저» 뜬다. 이게 없으면 되돌릴 수 없다.
  const 표 = { 만든때: new Date().toISOString(), 항목: [] };
  for (const p of 대기) {
    const 이전 = await kvGet(`post:${p.slug}`);
    표.항목.push({ slug: p.slug, 레디스에있었나: 이전 !== null, 이전값: 이전 });
  }
  fs.writeFileSync(되돌림표, JSON.stringify(표, null, 2));
  console.log(`\n되돌림표 저장: ${되돌림표} (${표.항목.length}건)`);

  const 오늘 = 한국날짜();
  const 나간것 = [];
  for (const p of 대기) {
    // 예정일이 지났으면 실제로 나간 날로 맞춘다 (안 맞추면 목록 아래로 밀려 아무도 못 본다)
    if (p.date < 오늘) p.date = 오늘;
    p.status = "published";
    p.publishedAt = new Date().toISOString();
    await kvSet(`post:${p.slug}`, JSON.stringify(p));
    await sadd(K_PUBLISHED, p.slug);
    await srem(K_DRAFTS, p.slug);
    나간것.push(p);
    console.log(`  ✓ 발행 ${p.slug} · ${p.title}`);
  }

  // 검색엔진 알림은 한 번에 묶어 보낸다 (50번 따로 찌르지 않는다)
  if (!알림생략) {
    try {
      const { pingIndexNow } = await import("./indexnow.mjs");
      const base = process.env.SITE_URL || "https://oddsbag.co.kr";
      const urls = 나간것.map((p) => `${base}/${채널of(p) === "magazine" ? "magazine" : 채널of(p)}/${p.slug}`);
      const r = await pingIndexNow(urls);
      console.log(`\n[IndexNow] ${r?.ok ? "접수됨" : "실패"} — ${urls.length}개 주소`);
    } catch (e) {
      console.log(`\n[IndexNow] 건너뜀: ${e?.message || e}`);
    }
  }

  console.log(`\n끝. ${나간것.length}편 발행.`);
  console.log(`되돌리려면: node content-factory/wpms-일괄.mjs 되돌리기 --실행`);
}

async function 되돌리기() {
  레디스확인();
  if (!fs.existsSync(되돌림표)) {
    console.error("✗ 되돌림표가 없다. 무엇을 어디로 되돌릴지 알 수 없어 멈춘다.");
    console.error("  (이 도구로 발행한 적이 없거나, 표가 지워졌다)");
    process.exit(1);
  }
  const 표 = JSON.parse(fs.readFileSync(되돌림표, "utf-8"));
  const 항목 = only ? 표.항목.filter((x) => x.slug === only) : 표.항목;

  console.log(`[되돌리기] 표에 적힌 ${항목.length}편을 발행 전 상태로 돌린다`);
  console.log(`  표를 만든 때: ${표.만든때}`);
  for (const x of 항목)
    console.log(`  · ${x.slug} — ${x.레디스에있었나 ? "예전 값으로 되돌림" : "검수함으로"}`);

  if (!실행) {
    console.log(`\n[계획만 보여줬다. 아무것도 바꾸지 않았다]`);
    console.log(`실제로 되돌리려면 뒤에 --실행 을 붙인다.`);
    return;
  }

  for (const x of 항목) {
    // 발행 목록에서 뺀다 → 홈페이지에서 사라진다
    await srem(K_PUBLISHED, x.slug);
    if (x.레디스에있었나) {
      // 있던 그대로 돌려놓는다 (짐작으로 만들지 않는다)
      await kvSet(`post:${x.slug}`, x.이전값);
    } else {
      // 발행 전에는 레디스에 없던 글이다 → 검수함 쪽으로 돌려둔다.
      // ★글 내용은 지우지 않는다. 파일(content/posts/)에 그대로 있고, 레디스 값도 status 만 되돌린다.
      const 지금 = await kvGet(`post:${x.slug}`);
      if (지금) {
        const p = JSON.parse(지금);
        p.status = "draft";
        delete p.publishedAt;
        await kvSet(`post:${x.slug}`, JSON.stringify(p));
      }
      await sadd(K_DRAFTS, x.slug);
    }
    console.log(`  ✓ 되돌림 ${x.slug}`);
  }

  if (!only) {
    const 보관 = 되돌림표 + ".썼음-" + 한국날짜();
    fs.renameSync(되돌림표, 보관);
    console.log(`\n되돌림표는 지우지 않고 옮겨 뒀다: ${path.basename(보관)}`);
  }
  console.log(`\n끝. ${항목.length}편을 검수함으로 되돌렸다.`);
}

const 표시 = { 상태, 발행, 되돌리기 };
if (!표시[명령]) {
  console.error(`✗ 모르는 명령: ${명령}`);
  console.error(`  쓸 수 있는 것: 상태 · 발행 · 되돌리기`);
  process.exit(1);
}
await 표시[명령]().catch((e) => {
  console.error("✗ 실패:", e);
  process.exit(1);
});
