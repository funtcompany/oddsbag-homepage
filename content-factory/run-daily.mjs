// 오즈백 — 하루치 발행 (발행만 한다)
//
// 사장님 지시 2026-08-18: 「한 번에 업로드가 아니라, 각 카테고리별 1일 1게시물」
//
// ★이 파일이 하는 일은 딱 하나다 —
//   content/posts/*.json 에 status:"draft" 로 준비된 원고 중
//   「오늘 날짜가 된 것」을 코너별로 한 편씩 발행 상태로 바꾼다.
//
// ★이 파일이 하지 않는 일 (일부러 안 부른다)
//   · 뉴스 수집(collect·sources·naver)      · AI 글쓰기(ai·llm·pipeline)
//   · 품질 심사(quality)                    · 인스타/페북 게시(social)
//   · 노션 동기화(notion)                   · 릴스 제작(factory)
//   불러오는 것은 store.mjs(레디스) 하나뿐이다. 위 어느 것도 import 사슬에 없다.
//   → 2026-08-12 에 사장님이 끄신 워크플로 8개와 무관하게 돈다. 그것들은 계속 꺼져 있다.
//
// ★레디스에 들어 있는 검수함 원고(자동 수집기가 만든 38건)는 건드리지 않는다.
//   파일(content/posts/)로 준비한 원고만 본다. 그래야 예상 못 한 글이 안 나간다.
//
// 쓰는 법
//   node content-factory/run-daily.mjs --미리보기   무엇이 나갈지 보기만 (아무것도 안 바꿈)
//   node content-factory/run-daily.mjs              실제로 발행
//   ※ 반드시 레포 뿌리(homepage/)에서 실행할 것 — content/posts 를 cwd 기준으로 찾는다

import fs from "node:fs";
import path from "node:path";
import { kvGet, kvSet, smembers, sadd, srem, isPersistent } from "./store.mjs";

const 미리보기 = process.argv.includes("--미리보기") || process.argv.includes("--dry");
// 한 회차 안전 상한 — 코너가 아무리 많아도 이보다 많이 나가지 않는다
const 회차상한 = Number(process.env.DAILY_MAX_PER_RUN || 5);

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const K_PUBLISHED = "posts:published";
const K_DRAFTS = "posts:drafts";
const K_ARCHIVED = "posts:archived";

// 한국 날짜 (YYYY-MM-DD). 서버는 UTC 라 이걸 안 하면 자정이 아니라 오전 9시에 바뀐다.
const 한국날짜 = (d = new Date()) =>
  new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

function 파일원고() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("._"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(POSTS_DIR, f), "utf-8")));
}

// 그 글이 「어느 코너」인가 — 채널과 카테고리 둘 다 본다.
// 채널만 보면 매거진 안에서 하루 여러 편이 나가고,
// 카테고리만 보면 뮤직 글 2편이 분류가 달라 같은 날 둘 다 나간다. 둘 다 막는다.
const 채널of = (p) => p.channel || "magazine";

async function main() {
  const 오늘 = 한국날짜();

  if (!isPersistent) {
    // ★이 확인이 없으면 레디스 없이도 「성공」으로 끝난다. 메모리에 쓰고 사라진다.
    console.error("✗ 레디스(UPSTASH) 설정이 없다. 발행하지 않고 멈춘다.");
    process.exit(1);
  }

  const 발행됨 = new Set(await smembers(K_PUBLISHED));
  const 보관됨 = new Set(await smembers(K_ARCHIVED));

  // 오늘 이미 나간 코너를 센다 (사람이 관리자에서 직접 올린 것도 포함된다)
  const 오늘쓴채널 = new Set();
  const 오늘쓴분류 = new Set();
  for (const slug of 발행됨) {
    const raw = await kvGet(`post:${slug}`);
    if (!raw) continue;
    const p = JSON.parse(raw);
    const 나간날 = p.publishedAt ? 한국날짜(new Date(p.publishedAt)) : p.date;
    if (나간날 === 오늘) {
      오늘쓴채널.add(채널of(p));
      오늘쓴분류.add(p.category);
    }
  }

  // 나갈 수 있는 것 — 파일 원고 중 초안이고, 예정일이 됐고, 아직 안 나간 것
  const 후보 = 파일원고()
    .filter((p) => p.status === "draft")
    .filter((p) => !발행됨.has(p.slug) && !보관됨.has(p.slug))
    .filter((p) => p.date <= 오늘)
    .sort((a, b) => (a.date === b.date ? (a.slug < b.slug ? -1 : 1) : a.date < b.date ? -1 : 1));

  console.log(`[하루치 발행] ${오늘} (한국시각 기준)`);
  console.log(`  후보 ${후보.length}편 · 오늘 이미 나간 코너: ${[...오늘쓴채널].join(",") || "없음"} / 분류: ${[...오늘쓴분류].join(",") || "없음"}`);

  const 나갈것 = [];
  for (const p of 후보) {
    if (나갈것.length >= 회차상한) break;
    const ch = 채널of(p);
    if (오늘쓴채널.has(ch)) continue;      // 그 코너는 오늘 이미 한 편 나갔다
    if (오늘쓴분류.has(p.category)) continue; // 그 분류도 오늘 이미 한 편 나갔다
    오늘쓴채널.add(ch);
    오늘쓴분류.add(p.category);
    나갈것.push(p);
  }

  if (나갈것.length === 0) {
    console.log("  → 오늘 나갈 글 없음 (코너별 하루 1편을 이미 채웠거나, 예정일이 아직 안 됨)");
    const 남은 = 파일원고().filter((p) => p.status === "draft" && !발행됨.has(p.slug) && !보관됨.has(p.slug));
    console.log(`  남은 대기 원고: ${남은.length}편`);
    return;
  }

  for (const p of 나갈것) {
    if (미리보기) {
      console.log(`  [미리보기] ${p.slug} · ${채널of(p)}/${p.category} · ${p.date} · ${p.title}`);
      continue;
    }
    // 예정일보다 늦게 도는 날이 있다 → 실제로 나간 날로 날짜를 맞춘다.
    // (안 맞추면 목록에서 옛날 글처럼 아래로 밀려 아무도 못 본다)
    if (p.date < 오늘) p.date = 오늘;
    p.status = "published";
    p.publishedAt = new Date().toISOString();
    await kvSet(`post:${p.slug}`, JSON.stringify(p));
    await sadd(K_PUBLISHED, p.slug);
    await srem(K_DRAFTS, p.slug);
    console.log(`  ✓ 발행 ${p.slug} · ${채널of(p)}/${p.category} · ${p.title}`);

    // 네이버·빙에 새 글을 알린다. 실패해도 발행은 이미 끝난 것이라 막지 않는다.
    try {
      const { pingPost } = await import("./indexnow.mjs");
      const r = await pingPost(p.slug, 채널of(p));
      console.log(`    [IndexNow] ${r.ok ? "접수됨" : "실패"}`);
    } catch (e) {
      console.log(`    [IndexNow] 건너뜀: ${e?.message || e}`);
    }
  }

  // ※ 파일원고() 는 매번 새 객체를 만든다 → 객체가 아니라 slug 로 빼야 한다
  const 나간slug = new Set(나갈것.map((p) => p.slug));
  const 남은 = 파일원고().filter(
    (p) => p.status === "draft" && !발행됨.has(p.slug) && !보관됨.has(p.slug) && !나간slug.has(p.slug),
  );
  console.log(`  남은 대기 원고: ${남은.length}편`);
}

main().catch((e) => {
  console.error("✗ 하루치 발행 실패:", e);
  process.exit(1);
});
