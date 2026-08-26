// 「만드는 것들」 글이 «어느 게시판»으로 가는지 실물 원고로 확인한다.
//
//   cd homepage
//   OB_ROOT="$PWD" node --experimental-strip-types --import ./scripts/시험/별칭.mjs ./scripts/시험/게시판-시험.mjs
//
// ★이 시험이 있는 이유 (2026-08-26)
//   게시판 힌트가 겹쳐도 «조용히» 틀린다 — 화면은 멀쩡히 뜨고, 글도 다 보인다.
//   다만 «엉뚱한 도구 밑»에 붙는다. 실제로 새 글 8편이 통째로 HTML 링크 생성기로 갔다.
//   원인은 힌트에 «오즈백툴즈» 라는 허브 태그가 들어 있던 것. 눈으로는 못 잡는다.

import fs from "node:fs";
import { boardKeyOf, oddsbagBoards, TOOL_BOARD_KEYS } from "@/lib/boards";

let 통과 = 0;
const 실패 = [];
const 같나 = (무엇, 실제, 기대) => {
  if (실제 === 기대) 통과 += 1;
  else 실패.push(`${무엇} — 기대 ${JSON.stringify(기대)} · 실제 ${JSON.stringify(실제)}`);
};

// ── 실물 원고를 읽어 게시판을 매긴다 ────────────────────────────
const 판정 = new Map();
for (const f of fs.readdirSync("content/posts")) {
  if (!f.endsWith(".json") || f.startsWith("._") || f.startsWith("_")) continue;
  let d;
  try {
    d = JSON.parse(fs.readFileSync("content/posts/" + f, "utf-8"));
  } catch {
    continue;
  }
  if (d.channel !== "oddsbag") continue;
  판정.set(d.slug, boardKeyOf(d));
}

// ★어느 도구 글이 어느 게시판에 «가야 하는가». 글이 늘면 여기 한 줄 늘린다.
const 가야할곳 = {
  // HTML 링크 생성기
  "how-to-make-html-link": "htmllink",
  "html-link-generator-faq": "htmllink",
  "html-link-troubleshooting": "htmllink",
  "html-link-use-cases": "htmllink",
  "html-preview-methods-compared": "htmllink",
  "html-upload-safety-check": "htmllink",
  "mobile-invitation-html-link": "htmllink",
  "oddsbag-tools-html-link-launch": "htmllink",
  "share-ai-generated-html": "htmllink",
  "why-html-file-does-not-open": "htmllink",
  // 새 도구들
  "photo-size-reduce-guide": "image",
  "heic-to-jpg-convert": "image",
  "passport-photo-spec": "idphoto",
  "id-photo-print-4x6": "idphoto",
  "char-count-standard": "count",
  "wonngoji-count-guide": "count",
  "pdf-to-ebook-guide": "ebook",
  "bookmark-cleanup-guide": "scrap",
  // 도구가 아닌 것
  "starflow-byeorui-gyeol": "starflow",
  "wpms-01": "wpms",
};

for (const [slug, 기대] of Object.entries(가야할곳)) {
  if (!판정.has(slug)) {
    실패.push(`${slug} — 원고가 없다(파일이 사라졌거나 channel 이 바뀌었다)`);
    continue;
  }
  같나(`${slug} 게시판`, 판정.get(slug), 기대);
}

// ── 도구 게시판마다 글이 «한 편 이상» 있어야 한다 ────────────────
// ★빈 게시판은 화면에 탭만 뜨고 눌러도 빈손이다. 도구를 냈으면 글이 있어야 한다.
for (const key of TOOL_BOARD_KEYS) {
  const n = [...판정.values()].filter((v) => v === key).length;
  같나(`${key} 게시판에 글이 있다`, n > 0, true);
}

// ── 명부 자체의 짜임 ────────────────────────────────────────────
const 키들 = oddsbagBoards.map((b) => b.key);
같나("게시판 키가 겹치지 않는다", 키들.length, new Set(키들).size);
for (const key of TOOL_BOARD_KEYS) {
  const b = oddsbagBoards.find((x) => x.key === key);
  같나(`${key} 가 명부에 있다`, !!b, true);
  같나(`${key} 에 도구 주소가 있다`, !!b?.href, true);
}
// ★허브 태그는 게시판 힌트가 될 수 없다 — 모든 도구 글에 붙어 있어서 다 빨아들인다
for (const b of oddsbagBoards) {
  같나(`${b.key} 힌트에 허브 태그 «오즈백툴즈» 가 없다`, !(b.tagHints ?? []).includes("오즈백툴즈"), true);
}

// ── 결과 ────────────────────────────────────────────────────────
console.log(`\n[게시판 시험] 원고 ${판정.size}편 · 통과 ${통과} · 실패 ${실패.length}`);
if (실패.length) {
  for (const f of 실패) console.log("  ✗ " + f);
  process.exit(1);
}
console.log("✓ 전부 통과.\n");
