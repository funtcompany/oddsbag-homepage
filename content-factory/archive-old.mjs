// 이전 게시물 정리 — 홈페이지 글을 '목록에서만' 숨긴다. (2026-08-03 실행 예정)
//
// 【왜 삭제가 아니라 숨김인가】
//  홈페이지 수익은 검색 유입 + 애드센스다. 160편은 구글에 색인된 자산이고,
//  애드센스 심사에서 "콘텐츠가 충분한가"를 보는 근거이기도 하다.
//  색인된 페이지를 대량 삭제하면 사이트 신뢰도가 내려간다.
//  → 글은 살려두고 목록에서만 빼면, 검색 유입은 지키면서 첫인상만 새 글로 채울 수 있다.
//
// 【쓰는 법】
//   미리보기 (아무것도 안 바꿈)
//     node archive-old.mjs --before 2026-07-28
//   실제 적용
//     node archive-old.mjs --before 2026-07-28 --apply
//   되돌리기
//     node archive-old.mjs --restore --apply
//
// 되돌리기는 언제든 된다 — hidden 표시만 지우면 즉시 목록에 복귀한다.

import fs from "node:fs";
import { getPublishedRaw, upsertPublished } from "./posts.mjs";
import { revalidateTag } from "./cache.mjs";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const APPLY = has("--apply");
const RESTORE = has("--restore");
const BEFORE = val("--before"); // 이 날짜 '이전'에 발행된 글을 숨긴다 (YYYY-MM-DD)
const BACKUP = val("--backup") ?? "archive-backup.json";

const dayOf = (p) => (p.publishedAt ?? p.date ?? "").slice(0, 10);

async function main() {
  const all = await getPublishedRaw();
  console.log(`발행글 ${all.length}편 확인`);

  if (RESTORE) {
    const hidden = all.filter((p) => p.hidden);
    console.log(`숨겨진 글 ${hidden.length}편`);
    if (!APPLY) {
      console.log("(미리보기 — 실제로 되돌리려면 --apply 를 붙이세요)");
      return;
    }
    let n = 0;
    for (const p of hidden) {
      delete p.hidden;
      delete p.hiddenAt;
      await upsertPublished(p);
      n++;
    }
    try { revalidateTag("posts", "max"); } catch { /* ignore */ }
    console.log(`복구 완료 — ${n}편이 목록에 다시 나옵니다`);
    return;
  }

  if (!BEFORE || !/^\d{4}-\d{2}-\d{2}$/.test(BEFORE)) {
    console.error("--before YYYY-MM-DD 가 필요합니다 (예: --before 2026-07-28)");
    process.exit(1);
  }

  const targets = all.filter((p) => !p.hidden && dayOf(p) && dayOf(p) < BEFORE);
  const keep = all.filter((p) => !targets.includes(p));

  console.log(`\n숨길 글: ${targets.length}편  ·  남길 글: ${keep.length}편`);
  const byCat = {};
  for (const p of targets) byCat[p.category] = (byCat[p.category] ?? 0) + 1;
  console.log("분야별:", Object.entries(byCat).map(([k, v]) => `${k} ${v}`).join(" / "));
  console.log("\n남는 글 (목록에 계속 보일 것):");
  for (const p of keep.slice(0, 20)) console.log(`  ${dayOf(p)}  ${p.title.slice(0, 46)}`);

  if (!APPLY) {
    console.log("\n(미리보기입니다 — 실제로 적용하려면 --apply 를 붙이세요)");
    return;
  }

  // 되돌릴 수 있도록 먼저 통째로 백업한다
  fs.writeFileSync(BACKUP, JSON.stringify(all, null, 1), "utf8");
  console.log(`\n백업 저장: ${BACKUP} (${all.length}편)`);

  const at = new Date().toISOString();
  let n = 0;
  for (const p of targets) {
    p.hidden = true;
    p.hiddenAt = at;
    await upsertPublished(p);
    n++;
    if (n % 20 === 0) console.log(`  ${n}/${targets.length}`);
  }
  try { revalidateTag("posts", "max"); } catch { /* ignore */ }
  console.log(`\n완료 — ${n}편을 목록에서 숨겼습니다.`);
  console.log("글 주소로 들어오면 그대로 보이고, 검색 색인도 유지됩니다.");
  console.log("되돌리려면: node archive-old.mjs --restore --apply");
}

main().catch((e) => { console.error(e); process.exit(1); });
