// 지금 살아 있는 글 주소를 네이버·빙에 한 번에 알린다.
//
// 언제 쓰나:
//   · 배포 직후 한 번 (열쇠 파일이 사이트에 올라간 뒤여야 한다)
//   · 글을 대량으로 정리한 뒤 한 번
//
// 쓰는 법:
//   cd homepage/content-factory
//   node --env-file=../.env.local run-indexnow.mjs          ← 보낼 목록만 보여줌
//   node --env-file=../.env.local run-indexnow.mjs --실행    ← 실제로 보냄
//
// 주의: 열쇠 파일(public/<키>.txt)이 https://oddsbag.co.kr/<키>.txt 로 열려야 한다.
//       배포 전에 보내면 "열쇠를 못 찾겠다"고 거절당한다.

import { smembers, kvGet } from "./store.mjs";
import { pingIndexNow } from "./indexnow.mjs";

const 실행 = process.argv.includes("--실행") || process.argv.includes("--run");

const slugs = (await smembers("posts:published")) || [];
const urls = ["/", "/magazine", "/sitemap.xml"];
for (const s of slugs) {
  const raw = await kvGet(`post:${s}`);
  if (!raw) continue;
  const p = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (p.hidden) continue; // 목록에서 숨긴 글은 알리지 않는다
  const ch = p.channel || "magazine";
  urls.push(ch === "magazine" ? `/magazine/${s}` : `/${ch}/${s}`);
}

console.log(`알릴 주소 ${urls.length}개 (발행글 ${slugs.length}편 기준)`);
console.log(urls.slice(0, 8).join("\n") + (urls.length > 8 ? `\n… 외 ${urls.length - 8}개` : ""));

if (!실행) {
  console.log("\n※ 실제로 보내려면 뒤에 --실행 을 붙이세요.");
  process.exit(0);
}

// 열쇠 파일이 진짜 열리는지 먼저 확인한다. 안 열리면 보내봐야 거절당한다.
const KEY = process.env.INDEXNOW_KEY || "aa43fafb90216063e8529373ed9345cc";
const keyUrl = `https://oddsbag.co.kr/${KEY}.txt`;
try {
  const r = await fetch(keyUrl, { signal: AbortSignal.timeout(10000) });
  const t = (await r.text()).trim();
  if (!r.ok || t !== KEY) {
    console.log(`\n❌ 열쇠 파일이 아직 안 열립니다 (${keyUrl} → ${r.status}).`);
    console.log("   배포가 끝난 뒤에 다시 실행하세요.");
    process.exit(1);
  }
  console.log("\n열쇠 파일 확인됨 ✓");
} catch (e) {
  console.log(`\n❌ 열쇠 파일 확인 실패: ${e?.message || e}`);
  console.log("   배포가 끝난 뒤에 다시 실행하세요.");
  process.exit(1);
}

const res = await pingIndexNow(urls);
console.log("\n결과:", res.ok ? "접수됨 ✓" : "실패 ✗");
for (const r of res.results) console.log(` · ${r.endpoint} → ${r.status}`);
console.log(`보낸 주소: ${res.sent}개`);
console.log("\n※ 접수됐다고 바로 검색에 뜨지는 않습니다. 며칠 걸립니다.");
