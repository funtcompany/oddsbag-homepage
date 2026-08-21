// 오즈백 — 곳간 꺼내기 (레디스 검수함 → 파일 초안)
//
// 왜 : 검수함(posts:drafts)에 원고가 잠겨 있는데 「하루치 발행」(run-daily.mjs)은
//      파일 원고(content/posts/*.json)만 본다. 일부러 그렇게 만든 안전장치다 —
//      자동 수집기가 만든 예상 못 한 글이 저절로 나가지 않게. (run-daily.mjs 머리말 참조)
//      그래서 사람이 한 번 훑어 「안전한 것만」 파일로 옮겨 주는 통로가 필요하다. 그게 이 파일이다.
//
// ★부르는 것은 store.mjs 하나뿐이다.
//   pipeline·ai·llm·quality·notion·social·factory 어느 것도 import 사슬에 없다.
//   → AI를 한 번도 부르지 않으므로 유료 폴백(llm.mjs:310)이 탈 자리가 아예 없다.
//   → 2026-08-12 에 끄신 워크플로 8개와 무관하다. 이 파일은 손으로만 돈다.
//
// ★--실행 없이는 아무것도 바꾸지 않는다 (wpms-일괄.mjs 와 같은 규칙).
// ★꺼내기는 「옮기기」가 아니라 「베끼기」다 — 레디스 쪽 원본은 그대로 둔다.
//   그래서 잘못 꺼내도 파일만 지우면 원상복구다.
//
// 쓰는 법 (반드시 homepage/ 에서 — content/posts 를 cwd 기준으로 찾는다)
//   node content-factory/곳간-꺼내기.mjs 검침
//   node content-factory/곳간-꺼내기.mjs 꺼내기 --안전만
//   node content-factory/곳간-꺼내기.mjs 꺼내기 --안전만 --실행
//   node content-factory/곳간-꺼내기.mjs 검수표 --위험만      → _검수표.html
//   node content-factory/곳간-꺼내기.mjs 꺼내기 --허용=slug1,slug2 --실행
//
// 미끼 시험 (레디스를 안 건드린다 — 한도가 소진돼 있어도 된다)
//   node content-factory/곳간-꺼내기.mjs 검침 --미끼=content-factory/_미끼-검수함.json

import fs from "node:fs";
import path from "node:path";

const 인자 = process.argv.slice(2);
const 명령 = 인자.find((a) => !a.startsWith("--")) || "검침";
const 실행 = 인자.includes("--실행");
const 안전만 = 인자.includes("--안전만");
const 위험만 = 인자.includes("--위험만");
// ★한글 이름표는 «글자 수»가 아니라 이름 뒤부터 잘라야 한다.
//   `--허용=`.slice(4) 로 짰다가 값이 "=없는놈" 으로 잘리는 것을 미끼 시험에서 잡았다.
const 값 = (이름, 기본 = "") => {
  const 앞 = `--${이름}=`;
  const 찾음 = 인자.find((a) => a.startsWith(앞));
  return 찾음 === undefined ? 기본 : 찾음.slice(앞.length);
};

const 미끼파일 = 값("미끼");
const 허용 = 값("허용")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// 꺼낸 글의 예정일을 언제부터 매길지. 안 주면 「내일」부터.
const 시작일인자 = 값("시작일");
const 간격일 = Number(값("간격", "1")) || 1;

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const 검수표파일 = path.join(process.cwd(), "content-factory", "_검수표.html");
const 꺼냄기록 = path.join(process.cwd(), "content-factory", "_곳간-꺼냄기록.json");

const K_DRAFTS = "posts:drafts";
const K_PUBLISHED = "posts:published";
const K_ARCHIVED = "posts:archived";

const 한국날짜 = (d = new Date()) =>
  new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const 날짜더하기 = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// ───────────────────────────────────────────── 자료 가져오기
// 미끼 파일이 주어지면 레디스를 «아예 안 부른다». store.mjs 를 import 조차 하지 않는다.
async function 검수함읽기() {
  if (미끼파일) {
    const j = JSON.parse(fs.readFileSync(미끼파일, "utf-8"));
    return {
      출처: `미끼 ${미끼파일}`,
      검수함: j.검수함 || [],
      발행됨: new Set(j.발행됨 || []),
      보관됨: new Set(j.보관됨 || []),
    };
  }
  const { smembers, kvGet, isPersistent } = await import("./store.mjs");
  if (!isPersistent) {
    console.error("✗ 레디스(UPSTASH) 설정이 없다. 아무것도 하지 않고 멈춘다.");
    console.error("  시험만 해보시려면 --미끼=content-factory/_미끼-검수함.json 을 붙이십시오.");
    process.exit(1);
  }
  const slugs = await smembers(K_DRAFTS);
  const 검수함 = [];
  for (const slug of slugs) {
    const raw = await kvGet(`post:${slug}`);
    if (!raw) continue; // 집합에는 있는데 본문이 없는 것 — 셈에서 뺀다
    try {
      검수함.push(JSON.parse(raw));
    } catch {
      console.warn(`  ⚠ ${slug} — JSON 이 깨져 있어 건너뛴다`);
    }
  }
  return {
    출처: "레디스",
    검수함,
    발행됨: new Set(await smembers(K_PUBLISHED)),
    보관됨: new Set(await smembers(K_ARCHIVED)),
  };
}

// ───────────────────────────────────────────── 판정
// ★기획안(8/18)은 「위험 low + risky 아님 + 좌초분」을 안전으로 봤다.
//   여기서는 한 겹 더 건다 — 출처가 실제로 있는가. 2026-08-20 에 「출처가 우리 홈을
//   가리키던 글 43편」이 나왔다. 그 글들이 검수함에도 28편 있었다.
const 우리홈 = /(^|\/\/)(www\.)?oddsbag\.co\.kr/i;

function 판정(p) {
  const 이유 = [];
  const 위험도 = String(p.fakeRisk || p.risk || "").toLowerCase();

  if (p.risky === true) 이유.push("risky 표시가 붙어 있다");
  if (위험도 === "high") 이유.push("가짜뉴스 위험도 high");
  if (위험도 === "medium") 이유.push("가짜뉴스 위험도 medium");

  const 점수 = Number(p.qualityScore ?? p.score ?? NaN);
  if (Number.isFinite(점수) && 점수 < 60) 이유.push(`품질 ${점수}점 (60 미만)`);

  const 출처 = Array.isArray(p.sources) ? p.sources : [];
  const 바깥출처 = 출처.filter((s) => s?.url && !우리홈.test(s.url));
  if (출처.length > 0 && 바깥출처.length === 0)
    이유.push("출처가 전부 oddsbag.co.kr — 8/20 「거짓 출처」 건과 같은 모양");

  if (!p.title || !p.body) 이유.push("제목이나 본문이 비었다");
  if (!p.slug) 이유.push("slug 가 없다");

  // 묵은 뉴스 — 가이드(꿀팁)는 안 늙으므로 제외한다 (CLAUDE.md NEWS_MAX_AGE_DAYS 와 같은 취지)
  const 뉴스인가 = p.category !== "꿀팁" && p.channel !== "oddsbag";
  if (뉴스인가 && p.date) {
    const 지난날 = Math.floor((Date.now() - new Date(`${p.date}T00:00:00+09:00`)) / 86400000);
    if (지난날 > 14) 이유.push(`${지난날}일 지난 뉴스 (다시 확인해야 한다)`);
  }

  return { 안전: 이유.length === 0, 이유, 점수, 위험도 };
}

const 표시 = (p, j) =>
  `${j.안전 ? "🟢" : "🟠"} ${p.slug} · ${p.channel || "magazine"}/${p.category || "-"}` +
  `${Number.isFinite(j.점수) ? ` · ${j.점수}점` : ""}${j.위험도 ? ` · 위험 ${j.위험도}` : ""}` +
  `\n     ${p.title || "(제목 없음)"}` +
  (j.안전 ? "" : `\n     └ ${j.이유.join(" · ")}`);

// ───────────────────────────────────────────── ① 검침
async function 검침() {
  const { 출처, 검수함, 발행됨, 보관됨 } = await 검수함읽기();
  console.log(`\n[곳간 검침] 출처: ${출처} · 검수함 ${검수함.length}편\n`);

  const 이미파일 = new Set(
    fs.existsSync(POSTS_DIR)
      ? fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("._")).map((f) => f.slice(0, -5))
      : [],
  );

  const 안전 = [], 주의 = [], 건너뜀 = [];
  for (const p of 검수함) {
    if (발행됨.has(p.slug)) { 건너뜀.push([p, "이미 발행됨"]); continue; }
    if (보관됨.has(p.slug)) { 건너뜀.push([p, "보관함에 있음"]); continue; }
    if (이미파일.has(p.slug)) { 건너뜀.push([p, "파일 원고가 이미 있음"]); continue; }
    const j = 판정(p);
    (j.안전 ? 안전 : 주의).push([p, j]);
  }

  console.log(`■ 바로 꺼내도 되는 것 — ${안전.length}편`);
  for (const [p, j] of 안전) console.log("  " + 표시(p, j));
  console.log(`\n■ 사람이 봐야 하는 것 — ${주의.length}편`);
  for (const [p, j] of 주의) console.log("  " + 표시(p, j));
  if (건너뜀.length) {
    console.log(`\n■ 셈에서 뺀 것 — ${건너뜀.length}편`);
    for (const [p, why] of 건너뜀) console.log(`  · ${p.slug} — ${why}`);
  }
  console.log(`\n합계 검수함 ${검수함.length} = 안전 ${안전.length} + 주의 ${주의.length} + 제외 ${건너뜀.length}`);
  console.log(`\n[아무것도 바꾸지 않았다]`);
  return { 안전, 주의 };
}

// ───────────────────────────────────────────── ② 꺼내기
async function 꺼내기() {
  const { 안전, 주의 } = await 검침();

  let 대상 = [];
  if (허용.length) {
    const 전체 = [...안전, ...주의];
    대상 = 전체.filter(([p]) => 허용.includes(p.slug)).map(([p]) => p);
    const 못찾음 = 허용.filter((s) => !전체.some(([p]) => p.slug === s));
    if (못찾음.length) {
      console.error(`\n✗ --허용 에 적었는데 검수함에 없는 slug: ${못찾음.join(", ")}`);
      console.error("  오타이거나 이미 나간 글이다. 아무것도 하지 않고 멈춘다.");
      process.exit(1);
    }
  } else if (안전만) {
    대상 = 안전.map(([p]) => p);
  } else {
    console.error("\n✗ --안전만 또는 --허용=slug1,slug2 중 하나를 반드시 붙일 것.");
    console.error("  둘 다 없으면 무엇을 꺼낼지 정해지지 않는다.");
    process.exit(1);
  }

  if (대상.length === 0) { console.log("\n→ 꺼낼 것이 없다."); return; }

  // 예정일 매기기 — 코너(채널)별로 하루 1편이므로 같은 코너끼리만 날짜를 벌린다
  const 시작 = 시작일인자 || 날짜더하기(한국날짜(), 1);
  const 코너칸 = {};
  const 계획 = 대상.map((p) => {
    const ch = p.channel || "magazine";
    const n = 코너칸[ch] ?? 0;
    코너칸[ch] = n + 1;
    return { p, 예정일: 날짜더하기(시작, n * 간격일) };
  });

  console.log(`\n■ 꺼낼 것 — ${계획.length}편 (예정일 ${시작}부터 ${간격일}일 간격, 코너별로 따로)`);
  for (const { p, 예정일 } of 계획)
    console.log(`  · ${예정일}  ${p.slug} · ${p.channel || "magazine"}/${p.category} · ${p.title}`);

  if (!실행) {
    console.log(`\n[계획만 보여줬다. 아무것도 바꾸지 않았다]`);
    console.log(`실제로 꺼내려면 뒤에 --실행 을 붙인다.`);
    return;
  }

  fs.mkdirSync(POSTS_DIR, { recursive: true });
  const 기록 = { 꺼낸때: new Date().toISOString(), 항목: [] };
  for (const { p, 예정일 } of 계획) {
    const 파일 = path.join(POSTS_DIR, `${p.slug}.json`);
    if (fs.existsSync(파일)) { console.log(`  ⏭  ${p.slug} — 파일이 이미 있어 건너뛴다 (덮어쓰지 않는다)`); continue; }
    const 초안 = { ...p, status: "draft", date: 예정일 };
    delete 초안.publishedAt;
    fs.writeFileSync(파일, JSON.stringify(초안, null, 2) + "\n");
    기록.항목.push({ slug: p.slug, 파일: path.relative(process.cwd(), 파일), 예정일 });
    console.log(`  ✓ ${예정일}  ${p.slug} → content/posts/${p.slug}.json`);
  }
  fs.writeFileSync(꺼냄기록, JSON.stringify(기록, null, 2) + "\n");
  console.log(`\n꺼냄기록: ${path.relative(process.cwd(), 꺼냄기록)} (${기록.항목.length}건)`);
  console.log(`★레디스 쪽 원본은 그대로다. 되돌리려면 위 파일들을 지우면 끝이다.`);
}

// ───────────────────────────────────────────── ③ 검수표
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function 검수표() {
  const { 검수함 } = await 검수함읽기();
  const 목록 = 검수함
    .map((p) => ({ p, j: 판정(p) }))
    .filter(({ j }) => (위험만 ? !j.안전 : true));

  const 칸 = 목록.map(({ p, j }, i) => {
    const 출처 = (Array.isArray(p.sources) ? p.sources : [])
      .map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a>${우리홈.test(s.url || "") ? ' <b class="bad">← 우리 홈이다</b>' : ""}</li>`)
      .join("") || "<li class=\"bad\">출처가 하나도 없다</li>";
    return `<article>
  <h2>${i + 1}. ${esc(p.title || "(제목 없음)")}</h2>
  <p class="meta"><code>${esc(p.slug)}</code> · ${esc(p.channel || "magazine")}/${esc(p.category || "-")} · ${esc(p.date || "날짜 없음")}${Number.isFinite(j.점수) ? ` · ${j.점수}점` : ""}${j.위험도 ? ` · 위험 ${esc(j.위험도)}` : ""}</p>
  ${j.안전 ? "" : `<p class="why"><b>걸린 이유</b> — ${j.이유.map(esc).join(" · ")}</p>`}
  <p class="summary">${esc(p.summary || "")}</p>
  <details><summary>본문 보기</summary><pre>${esc(p.body || "")}</pre></details>
  <h3>원문 대조</h3><ul>${출처}</ul>
  <p class="verdict">통과시키려면 → <code>--허용=${esc(p.slug)}</code></p>
</article>`;
  }).join("\n");

  const html = `<!doctype html><meta charset="utf-8"><title>곳간 검수표 — ${목록.length}편</title>
<style>
:root{color-scheme:light dark}
body{font:16px/1.7 -apple-system,"Apple SD Gothic Neo",sans-serif;max-width:860px;margin:0 auto;padding:24px}
article{border:1px solid #8884;border-radius:10px;padding:16px 20px;margin:0 0 20px}
h1{font-size:22px} h2{font-size:18px;margin:0 0 6px} h3{font-size:14px;margin:14px 0 4px;opacity:.75}
.meta{font-size:13px;opacity:.7;margin:0 0 8px}
.why{background:#f9731622;border-left:3px solid #f97316;padding:8px 12px;border-radius:4px;font-size:14px}
.summary{font-size:15px} .bad{color:#dc2626}
pre{white-space:pre-wrap;font:13px/1.6 ui-monospace,monospace;background:#8881;padding:12px;border-radius:6px;max-height:50vh;overflow:auto}
ul{margin:4px 0;padding-left:20px;font-size:14px}
.verdict{font-size:13px;opacity:.8;margin:12px 0 0}
code{background:#8882;padding:1px 5px;border-radius:4px}
</style>
<h1>곳간 검수표 — ${목록.length}편</h1>
<p>원문 링크를 열어 <b>글에 적힌 사실이 원문에 실제로 있는지</b>만 봅니다. 통과시킬 것의 <code>--허용=</code> 를 모아 한 번에 꺼냅니다.</p>
${칸}`;

  fs.writeFileSync(검수표파일, html);
  console.log(`\n검수표 ${목록.length}편 → ${path.relative(process.cwd(), 검수표파일)}`);
  console.log(`  open content-factory/_검수표.html`);
  console.log(`\n[아무것도 바꾸지 않았다]`);
}

// ─────────────────────────────────────────────
const 표명령 = { 검침, 꺼내기, 검수표 };
if (!표명령[명령]) {
  console.error(`✗ 모르는 명령: ${명령}\n  쓸 수 있는 것: 검침 · 꺼내기 · 검수표`);
  process.exit(1);
}
표명령[명령]().catch((e) => {
  console.error(`✗ ${명령} 실패:`, e?.message || e);
  process.exit(1);
});
