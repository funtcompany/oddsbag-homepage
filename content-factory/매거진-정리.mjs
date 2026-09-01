// 오즈백 — 매거진 정리 (알맹이 기획 2026-08-25 · 사장님 승인)
//
// 하는 일 — 이미 «발행된» 매거진 글의 노출 자리만 바꾼다. 지우지 않는다.
//
//   ① 게시판으로 (boardOnly:"news")
//        홈·매거진 목록·검색·카테고리·RSS·구글뉴스에서 빠진다.
//        주소는 그대로 열리고 게시판에는 남는다. 일반 sitemap 에도 남는다.
//   ② 숨김 (hidden:true)
//        게시판에서도 안 보인다. 근거 자리에 «특정 문서가 아닌 것»(우리 홈·지원센터 첫 화면)이
//        들어간 글에만 쓴다. 이것도 지우는 게 아니다.
//
// ★안전장치 (하나라도 어긋나면 멈춘다)
//   1. `_매거진정리-대상.json` 에 적힌 slug «만» 건드린다. 목록에 없으면 손대지 않는다
//   2. --실행 없이는 계획만 보여주고 아무것도 바꾸지 않는다
//   3. 바꾸기 «전에» 되돌림표를 먼저 뜬다. 없으면 되돌릴 수 없으므로 뜨기 실패하면 멈춘다
//   4. 레디스가 없으면 멈춘다 (메모리에 쓰고 사라지는 «가짜 성공»을 막는다)
//   5. 대상 목록은 기준일(2026-08-24)까지 나간 글로 이미 고정돼 있다 —
//      ★9/1부터 나가는 케이스북 글은 목록에 없으므로 이 도구가 절대 못 건드린다
//
// 쓰는 법
//   node content-factory/매거진-정리.mjs 상태
//   node content-factory/매거진-정리.mjs 내리기            ← 계획만
//   node content-factory/매거진-정리.mjs 내리기 --실행      ← 실제로
//   node content-factory/매거진-정리.mjs 되돌리기 --실행
//   ※ 반드시 레포 뿌리(homepage/)에서 실행할 것

import fs from "node:fs";
import path from "node:path";
import { kvGet, kvSet, isPersistent } from "./store.mjs";

const 명령 = process.argv[2] || "상태";
const 실행 = process.argv.includes("--실행");
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").split("=").slice(1).join("=") || null;

const 대상표 = path.join(process.cwd(), "content-factory", "_매거진정리-대상.json");
const 되돌림표 = path.join(process.cwd(), "content-factory", "_매거진정리-되돌림표.json");

const 한국날짜 = (d = new Date()) =>
  new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

function 대상읽기() {
  if (!fs.existsSync(대상표)) {
    console.error(`✗ 대상 목록이 없다: ${대상표}`);
    console.error("  무엇을 내릴지 알 수 없어 멈춘다.");
    process.exit(1);
  }
  const t = JSON.parse(fs.readFileSync(대상표, "utf-8"));
  let 게시판 = t["게시판으로"] || [];
  let 숨김 = t["숨김"] || [];
  if (only) {
    게시판 = 게시판.filter((x) => x.slug === only);
    숨김 = 숨김.filter((x) => x.slug === only);
  }
  return { 기준일: t["기준일"], 게시판, 숨김 };
}

function 레디스확인() {
  if (!isPersistent) {
    console.error("✗ 레디스(UPSTASH) 설정이 없다. 메모리에 써 봐야 사라지므로 멈춘다.");
    console.error("  (레디스 한도가 풀린 뒤에 돌릴 것 — 2026-09-01)");
    process.exit(1);
  }
}

async function 상태() {
  const { 기준일, 게시판, 숨김 } = 대상읽기();
  console.log(`[매거진 정리] 대상 목록 기준일 ${기준일}`);
  console.log(`  게시판으로 내릴 것 ${게시판.length}편 · 숨길 것 ${숨김.length}편`);
  console.log(`  되돌림표: ${fs.existsSync(되돌림표) ? "있음 — 되돌리기 가능" : "없음"}`);
  if (!isPersistent) {
    console.log("  레디스: 없음 (지금은 계획만 볼 수 있다)");
    return { 게시판, 숨김, 확인됨: null };
  }
  // 레디스에 실제로 있는지, 이미 내려가 있지는 않은지 대조
  const 확인됨 = { 있음: 0, 없음: [], 이미내려감: [] };
  for (const x of [...게시판, ...숨김]) {
    const raw = await kvGet(`post:${x.slug}`);
    if (!raw) { 확인됨.없음.push(x.slug); continue; }
    const p = JSON.parse(raw);
    if (p.boardOnly || p.hidden) 확인됨.이미내려감.push(x.slug);
    else 확인됨.있음++;
  }
  console.log(`  레디스 대조 — 손댈 것 ${확인됨.있음}편 · 이미 내려간 것 ${확인됨.이미내려감.length}편 · 못 찾은 것 ${확인됨.없음.length}편`);
  if (확인됨.없음.length) console.log(`    못 찾음: ${확인됨.없음.slice(0, 5).join(", ")}${확인됨.없음.length > 5 ? " …" : ""}`);
  return { 게시판, 숨김, 확인됨 };
}

async function 내리기() {
  const { 기준일, 게시판, 숨김 } = 대상읽기();

  console.log(`[매거진 정리] 기준일 ${기준일} 까지 나간 매거진 글만 대상\n`);
  console.log(`① 게시판으로 (주소 살아있음 · 게시판에 남음) — ${게시판.length}편`);
  for (const x of 게시판.slice(0, 5)) console.log(`   · ${x.category} | ${x.title}`);
  if (게시판.length > 5) console.log(`   … 그리고 ${게시판.length - 5}편`);
  console.log(`\n② 숨김 (게시판에서도 안 보임 · 근거 부실) — ${숨김.length}편`);
  for (const x of 숨김) console.log(`   · [${x["이유"]}] ${x.category} | ${x.title}`);

  if (!실행) {
    console.log(`\n[계획만 보여줬다. 아무것도 바꾸지 않았다]`);
    console.log(`실제로 내리려면 뒤에 --실행 을 붙인다.`);
    return;
  }
  레디스확인();

  // ★되돌림표를 «먼저» 뜬다.
  const 표 = { 만든때: new Date().toISOString(), 기준일, 항목: [] };
  for (const x of [...게시판, ...숨김]) {
    const 이전 = await kvGet(`post:${x.slug}`);
    표.항목.push({ slug: x.slug, 있었나: 이전 !== null, 이전값: 이전 });
  }
  fs.writeFileSync(되돌림표, JSON.stringify(표, null, 2));
  const 떠진것 = JSON.parse(fs.readFileSync(되돌림표, "utf-8"));
  if (떠진것.항목.length !== 게시판.length + 숨김.length) {
    console.error("✗ 되돌림표가 온전히 안 떠졌다. 되돌릴 수 없으므로 멈춘다.");
    process.exit(1);
  }
  console.log(`\n되돌림표 저장: ${path.basename(되돌림표)} (${표.항목.length}건)`);

  let 바뀜 = 0, 건너뜀 = 0;
  for (const [목록, 어떻게] of [[게시판, "board"], [숨김, "hidden"]]) {
    for (const x of 목록) {
      const raw = await kvGet(`post:${x.slug}`);
      if (!raw) { console.log(`  · 건너뜀 ${x.slug} — 레디스에 없다`); 건너뜀++; continue; }
      const p = JSON.parse(raw);
      if (어떻게 === "board") p.boardOnly = "news";
      else p.hidden = true;
      p.정리한때 = 한국날짜();
      await kvSet(`post:${x.slug}`, JSON.stringify(p));
      바뀜++;
    }
  }
  console.log(`\n끝. ${바뀜}편 바꿈 · ${건너뜀}편 건너뜀.`);
  console.log(`되돌리려면: node content-factory/매거진-정리.mjs 되돌리기 --실행`);
  console.log(`★스냅샷을 다시 떠야 화면에 반영된다: node scripts/snapshot.mjs`);
}

async function 되돌리기() {
  if (!fs.existsSync(되돌림표)) {
    console.error("✗ 되돌림표가 없다. 무엇을 어디로 되돌릴지 알 수 없어 멈춘다.");
    process.exit(1);
  }
  const 표 = JSON.parse(fs.readFileSync(되돌림표, "utf-8"));
  console.log(`[되돌리기] ${표.항목.length}건 — ${표.만든때} 에 뜬 표`);
  if (!실행) {
    console.log(`\n[계획만 보여줬다]`);
    console.log(`실제로 되돌리려면 뒤에 --실행 을 붙인다.`);
    return;
  }
  레디스확인();
  let n = 0;
  for (const x of 표.항목) {
    if (!x.있었나) continue;              // 원래 없던 것은 되돌릴 게 없다
    await kvSet(`post:${x.slug}`, x.이전값);
    n++;
  }
  const 보관 = 되돌림표 + ".썼음-" + 한국날짜();
  fs.renameSync(되돌림표, 보관);
  console.log(`\n끝. ${n}편을 있던 그대로 되돌렸다.`);
  console.log(`되돌림표는 지우지 않고 옮겨 뒀다: ${path.basename(보관)}`);
  console.log(`★스냅샷을 다시 떠야 화면에 반영된다: node scripts/snapshot.mjs`);
}

const 표작업 = { 상태, 내리기, 되돌리기 };
const fn = 표작업[명령];
if (!fn) {
  console.error(`모르는 명령: ${명령}`);
  console.error(`쓸 수 있는 것: ${Object.keys(표작업).join(" · ")}`);
  process.exit(1);
}
fn().catch((e) => { console.error(`✗ 실패: ${e?.stack || e}`); process.exit(1); });
