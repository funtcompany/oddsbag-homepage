// 영상 카드 전수 검사 — 만들기 전에 '겹침·잘림·나레이션 불일치'를 잡아낸다. (읽기 전용)
//
// 왜: 눈으로 몇 장 보고 넘기면 반드시 놓친다. 사장님 지적(2026-07-29) — 글자 겹침·상하 여백·나레이션까지
//     철저히 검사하고 만들 것. 그래서 발행글 전체를 카드 단위로 기계 검사한다.
//
// 검사 항목
//   L1 칸 넘침   : 글이 정해진 칸(BOX_H)을 넘는가 → 넘치면 뱃지/로고와 겹친다  ※ 0건이어야 함
//   L2 문장 손실 : 칸에 맞추느라 문장을 덜어냈는가 (정보가 사라짐)
//   L3 글자 과축소: 제목이 60px 이하·본문 36px 이하로 줄었는가 (모바일에서 읽기 힘듦)
//   N1 미완결    : 카드가 "~인데요/~지만"처럼 말이 이어지는 채로 끝나는가
//   N2 나레이션  : 화면에 없는 문장을 읽거나, 화면 문장을 안 읽는가
//   T1 길이      : 예상 낭독 길이가 179초(2:59)를 넘는가
//
// 사용법:  node factory/check-layout.mjs           (전체 발행글)
//         node factory/check-layout.mjs slug1 …   (특정 글만)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCards, fitCard, reelSay } from "./render.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 열쇠 파일 위치 — 이 파일이 homepage/factory/ 로 옮겨오면서 경로가 어긋나 있었다(homepage/homepage/ 를 보고 있었다).
//  그래서 이 검사는 그동안 첫 줄에서 죽었다. 후보를 순서대로 보고, 없으면 이미 들어온 환경변수를 쓴다(깃허브 액션). (2026-08-11)
const ENV = {};
const 후보 = [
  path.join(__dirname, "..", ".env.local"),          // homepage/factory → homepage/.env.local  ★지금 위치
  path.join(__dirname, "..", "homepage", ".env.local"), // 01_오피셜/factory → homepage/.env.local (옛 사본)
];
const envPath = 후보.find((p) => fs.existsSync(p));
if (envPath) {
  for (const l of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) ENV[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}
for (const k of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) ENV[k] ||= process.env[k];
// 읽어온 열쇠를 process.env 로 올린다 — ig-profile.mjs 가 여기서 인스타·Redis 를 찾는다.
//  이걸 안 하면 검사기가 '숫자 없는 옛 문구'만 검사하게 되어, 실제로 나가는 화면을 검사하지 못한다. (2026-08-11)
for (const [k, v] of Object.entries(ENV)) if (v && !process.env[k]) process.env[k] = v;
if (!ENV.UPSTASH_REDIS_REST_URL) throw new Error("Redis 열쇠를 못 찾았다 — .env.local 위치를 확인할 것");
const redis = async (cmd) => (await (await fetch(ENV.UPSTASH_REDIS_REST_URL, {
  method: "POST", headers: { Authorization: `Bearer ${ENV.UPSTASH_REDIS_REST_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(cmd),
})).json()).result;

const CONNECTIVE = /(인데요|는데요|은데요|데요|인데|는데|지만|라서|어서|아서|고요)[.!?…]?$/;
const norm = (s) => String(s || "").replace(/\s+/g, "").replace(/[.,'"·]/g, "");
const CPS = 6.5; // 초당 낭독 글자수(실측)

const args = process.argv.slice(2);
const slugs = args.length ? args : await redis(["SMEMBERS", "posts:published"]);
// 마지막 카드가 약속할 숫자 — 실제로 나가는 화면 그대로 검사하려면 이 값이 있어야 한다.
const { profileCount } = await import("../content-factory/ig-profile.mjs");
const PC = await profileCount().catch(() => null);
console.log(`검사 대상 ${slugs.length}편 · 마지막 카드 숫자 ${PC ?? "(못 셈 — 옛 문구로 검사)"}\n`);

const issues = [];
let cardCount = 0;
for (const slug of slugs) {
  const raw = await redis(["GET", `post:${slug}`]);
  if (!raw) continue;
  const post = JSON.parse(raw);
  const cards = buildCards(post, { profileCount: PC });
  let sec = 0;
  for (const [i, card] of cards.entries()) {
    cardCount++;
    const f = fitCard(post, card);
    const say = reelSay(card);
    sec += Math.max(2.6, say.length / CPS + 0.75);
    const at = `${slug} #${i + 1}(${card.kind})`;
    if (!f.fits) issues.push(["L1 칸넘침", at, `${Math.round(f.height)} > ${f.BOX_H}px`]);
    if (f.droppedSentences) issues.push(["L2 문장손실", at, `${f.droppedSentences}문장 덜어냄`]);
    if (f.ts <= 60 || f.bs <= 36) issues.push(["L3 글자과축소", at, `제목 ${f.ts}px · 본문 ${f.bs}px`]);
    const shown = [card.title, ...f.sentences].join(" ");
    const tail = (card.body || card.title).trim();
    if (card.kind !== "cta" && CONNECTIVE.test(tail)) issues.push(["N1 미완결", at, `…${tail.slice(-18)}`]);
    // 나레이션이 화면에 없는 말을 하는가 (CTA는 고정 멘트라 제외)
    if (card.kind !== "cta") {
      const miss = f.sentences.filter((s) => !norm(say).includes(norm(s).slice(0, 12)));
      if (miss.length) issues.push(["N2 나레이션불일치", at, `화면 문장 ${miss.length}개를 안 읽음`]);
    }
  }
  if (sec > 179) issues.push(["T1 길이초과", slug, `${Math.round(sec)}초`]);
}

console.log(`카드 ${cardCount}장 검사 완료 — 문제 ${issues.length}건\n`);
const byKind = {};
for (const [k] of issues) byKind[k] = (byKind[k] || 0) + 1;
for (const [k, n] of Object.entries(byKind)) console.log(`  ${k}: ${n}건`);
if (issues.length) {
  console.log("\n상세(최대 40건):");
  for (const [k, at, d] of issues.slice(0, 40)) console.log(`  [${k}] ${at} — ${d}`);
}
process.exit(issues.some((i) => i[0].startsWith("L1")) ? 1 : 0);
