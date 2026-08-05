// 잃어버린 가이드 주제 되찾기 (관리 도구)
//
// 【왜 필요한가】 가이드 주제는 '이미 쓴 것'으로 표시(issues:seen)한 뒤에 글을 만든다.
// 그 사이에 글이 엎어지면(환각 위험 폐기·AI 오류) 표시만 남고 결과물은 없다.
// 그러면 그 주제는 영영 안 나온다 — 재고가 조용히 줄어든다.
//
// 앞으로는 pipeline 이 실패할 때 되돌리지만, 이미 잃은 주제는 이 도구로 찾아 되살린다.
//
// 실행: node run-restore-topics.mjs          → 목록만 보여준다(아무것도 안 바꾼다)
//       node run-restore-topics.mjs --실행    → 실제로 되살린다
import { ALL_EVERGREEN } from "./evergreen-data.mjs";
import { smembers, srem, kvGet } from "./store.mjs";

const APPLY = process.argv.includes("--실행");
// 특정 주제만 되살리기: --아이디 mac-desktop-5,mac-app-remove-5
//  전부 되살리면, 예전에 글이 지워졌을 뿐 이미 영상까지 나간 주제까지 다시 쓰게 된다.
//  유튜브에 같은 내용이 두 번 올라가는 게 재고 몇 개보다 나쁘다.
const ONLY = (() => {
  const i = process.argv.indexOf("--아이디");
  if (i < 0 || !process.argv[i + 1]) return null;
  return new Set(process.argv[i + 1].split(",").map((s) => s.trim()).filter(Boolean));
})();
const issueKey = (t) => t.replace(/\s+/g, "").slice(0, 30);

// 제목에서 뜻이 있는 낱말만 (겹치는지 보려는 용도)
const STOP = new Set(["가지", "방법", "때", "것", "수", "이것만", "확인할", "하는", "쓰는", "법", "정리", "기본"]);
const words = (s) =>
  new Set(
    String(s || "")
      .replace(/\d+\s*(가지|단계|선|개)/g, " ")
      .replace(/[^0-9a-zA-Z가-힣\s]/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/(을|를|이|가|은|는|에|의|로|과|와|도|만)$/, ""))
      .filter((w) => w.length >= 2 && !STOP.has(w)),
  );

const overlap = (a, b) => {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
};

async function loadPosts() {
  // 보관함(posts:archived)까지 반드시 본다.
  //  검수함에서 치운 글·내린 글이 여기 있다. 이걸 빼고 세면 "결과물이 없다"고 잘못 판단해
  //  이미 다뤘던 주제를 다시 쓰게 된다 — 같은 내용이 두 번 나가는 게 더 나쁘다.
  const keys = ["posts:published", "posts:queued", "posts:drafts", "posts:archived"];
  const out = [];
  for (const k of keys) {
    const slugs = await smembers(k).catch(() => []);
    for (const s of slugs || []) {
      const raw = await kvGet(`post:${s}`).catch(() => null);
      if (!raw) continue;
      try {
        out.push(typeof raw === "string" ? JSON.parse(raw) : raw);
      } catch {
        /* 깨진 값은 건너뛴다 */
      }
    }
  }
  return out;
}

const seen = new Set(await smembers("issues:seen"));
const posts = await loadPosts();
const postWords = posts.map((p) => ({ title: p.title, w: words(`${p.title} ${(p.tags || []).join(" ")}`) }));

const 소진 = ALL_EVERGREEN.filter((t) => seen.has(issueKey(t.title)));
const 고아 = [];
for (const t of 소진) {
  const tw = words(t.title);
  // 결과물 중에 이 주제로 쓴 것으로 보이는 글이 있는가
  //  제목이 AI 손을 거쳐 바뀌므로 정확히 같지 않다 → 낱말이 2개 이상 겹치면 '있다'로 본다.
  //  애매하면 '있다' 쪽으로 판단한다 — 멀쩡한 글을 다시 쓰게 만드는 게 더 나쁘다.
  const best = postWords.reduce((m, p) => Math.max(m, overlap(tw, p.w)), 0);
  if (best < 2 && (!ONLY || ONLY.has(t.id))) 고아.push({ t, best });
}

console.log(`가이드 주제 ${ALL_EVERGREEN.length}개 · 소진 표시 ${소진.length}개 · 남은 재고 ${ALL_EVERGREEN.length - 소진.length}개`);
console.log(`결과물이 없는 주제(되살릴 대상): ${고아.length}개\n`);
for (const { t } of 고아) console.log(`  · ${t.id}  ${t.title}`);

if (!고아.length) {
  console.log("\n되살릴 것이 없다.");
} else if (!APPLY) {
  console.log(`\n(목록만 보여줬다. 실제로 되살리려면 --실행 을 붙인다)`);
} else {
  let n = 0;
  for (const { t } of 고아) {
    await srem("issues:seen", issueKey(t.title)).catch(() => {});
    n++;
  }
  console.log(`\n✅ ${n}개 되살렸다. 남은 재고 ${ALL_EVERGREEN.length - 소진.length + n}개`);
}
