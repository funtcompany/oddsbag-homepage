// 【인스타 정리】 GitHub Actions 진입점 — 저노출 게시물 정리
import { runPrune } from "./prune-social.mjs";

const r = await runPrune();

console.log(`\n모드: ${r.mode === "delete" ? "실제 삭제" : "목록만 보기(안전모드)"}`);
console.log(`검사한 글: ${r.checked}건 / 노출수 못 읽어 건너뜀: ${r.unreadable}건`);

if (r.targets.length) {
  console.log(`\n정리 대상 ${r.targets.length}건 (노출 ${process.env.PRUNE_MIN_VIEWS || 20} 미만):`);
  for (const t of r.targets) {
    console.log(`  · ${t.at.slice(0, 10)} ${String(t.views).padStart(4)}회  ${t.permalink}`);
    console.log(`      ${t.caption}`);
  }
} else {
  console.log("\n정리 대상 없음");
}

if (r.deleted.length) {
  console.log(`\n삭제 완료 ${r.deleted.length}건:`);
  for (const t of r.deleted) console.log(`  · ${t.at.slice(0, 10)} ${t.views}회 ${t.permalink}`);
}

if (r.errors.length) {
  console.log("\n오류:");
  for (const e of r.errors) console.log(`  · ${e}`);
}
