// 잘못 내려간 글 되살리기 — 하루 몇 편씩 나눠서. (2026-08-11 신설, 사장님 지시)
//
// 【왜 필요한가】
//   발행글 87편인데 내려간 글이 218편이었다. 원인은 심사관(AI)이 답을 형식대로 안 줬을 때
//   그 글을 0점으로 세던 버그다(quality.mjs, 같은 날 고침). 글이 나빠서가 아니라
//   심사가 삐끗해서 내려간 것이다. 내려간 주소는 안내 없이 404 라, 구글이 색인해 둔 주소가
//   그대로 죽었다 — 검색에서 클릭을 받은 유일한 글도 그중 하나였다.
//
// 【무엇을 되살리나 — 기준을 넓히지 않는다】
//   ① 저장돼 있는 심사 점수가 78점 이상  ② 가짜뉴스 위험이 low
//   ③ **사람이 정해서 내린 글이 아닐 것** ← 이게 제일 중요하다
//   위험 high 는 절대 건드리지 않는다. 점수가 없는 글도 건드리지 않는다.
//
// 【③ 을 넣은 이유 — 2026-08-11 실측】
//   점수·위험만 보고 고르면 13편이 나왔는데, 보관 사유를 열어보니 전부 **의도된 결정**이었다.
//     · 4편 "시의성 지난 글 — 사장님 지시로 보관"      ← 사장님이 직접 내리신 것
//     · 6편 "뉴스 정리 (유튜브 0회, 기준 200회)"        ← 조회수 기준 정리 정책을 돌린 것
//     · 2편 보관 당시 가짜뉴스 위험 high 판정
//   기계가 이걸 모르고 되살리면 **사람의 결정을 자동으로 되돌리는** 도구가 된다. 그건 사고다.
//   그래서 사유에 사람 손이 닿은 흔적이 있으면 건너뛰고, 왜 건너뛰었는지 화면에 적는다.
//
// 【왜 한 번에 다 하지 않나】
//   되살린 글은 36시간 뒤 재감사를 받는다. 한꺼번에 84편을 올렸다가 무언가 잘못돼 다시 쓸리면
//   같은 일을 두 번 하게 된다. 하루 10편씩 올리며 감사가 다시 내리는지 지켜본다.
//
// 【발행일을 바꾸지 않는다】
//   publishPost 는 publishedAt 을 건드리지 않는다. 원래 날짜 그대로 제자리에 돌아간다.
//   오늘 날짜로 올리면 홈·RSS·메일이 옛날 글로 도배되고, 독자에게는 거짓말이 된다.
//
// 쓰는 법
//   node content-factory/restore-archived.mjs                 목록만 보여줌 (아무것도 안 바꿈)
//   node content-factory/restore-archived.mjs --실행           10편 되살림
//   node content-factory/restore-archived.mjs --실행 --개수 5   5편만
//   node content-factory/restore-archived.mjs --전체목록        되살릴 수 있는 것 전부 보기

import { smembers, kvGet } from "./store.mjs";
import { restoreArchived, publishPost } from "./posts.mjs";

const 인자 = process.argv.slice(2);
const 실행 = 인자.includes("--실행");
const 전체목록 = 인자.includes("--전체목록");
const 개수 = (() => {
  const i = 인자.indexOf("--개수");
  const n = i >= 0 ? Number(인자[i + 1]) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
})();

const 최소점수 = 78;

// 사람이 정해서 내린 흔적. 하나라도 걸리면 기계가 되살리지 않는다.
const 사람결정 = [
  { 무늬: /사장님\s*지시/, 이름: "사장님 지시로 보관" },
  { 무늬: /뉴스\s*정리/, 이름: "뉴스 정리 정책(조회수 기준)" },
  { 무늬: /새로\s*쓰기로\s*결정/, 이름: "새로 쓰기로 결정" },
  { 무늬: /가짜뉴스\s*위험\s*high/, 이름: "보관 당시 가짜뉴스 위험 high 판정" },
];

function 자격(post) {
  const q = post?.quality;
  if (!q || typeof q.score !== "number") return "심사 점수가 없음";
  if (q.fakeRisk === "high") return "가짜뉴스 위험 high";
  if (q.fakeRisk !== "low") return `위험도 ${q.fakeRisk ?? "모름"}`;
  if (q.score < 최소점수) return `${q.score}점 (기준 ${최소점수})`;
  const 사유 = String(post.archivedReason ?? post.archiveReason ?? "");
  const 손 = 사람결정.find((x) => x.무늬.test(사유));
  if (손) return 손.이름;
  return null; // 자격 있음
}

const archived = (await smembers("posts:archived")) ?? [];
const published = new Set((await smembers("posts:published")) ?? []);

const 후보 = [];
const 제외이유 = {};
for (const slug of archived) {
  if (published.has(slug)) continue; // 이미 살아 있음
  const raw = await kvGet(`post:${slug}`);
  if (!raw) {
    제외이유["본문이 없음"] = (제외이유["본문이 없음"] ?? 0) + 1;
    continue;
  }
  const post = typeof raw === "string" ? JSON.parse(raw) : raw;
  const 막힘 = 자격(post);
  if (막힘) {
    제외이유[막힘.replace(/\d+점 \(기준 \d+\)/, `${최소점수}점 미만`)] =
      (제외이유[막힘.replace(/\d+점 \(기준 \d+\)/, `${최소점수}점 미만`)] ?? 0) + 1;
    continue;
  }
  후보.push({
    slug,
    score: post.quality.score,
    category: post.category,
    title: post.title,
    publishedAt: post.publishedAt ?? post.date ?? "",
    reason: post.archivedReason ?? post.archiveReason ?? "",
  });
}

// 점수 높은 것부터, 같으면 최근 글부터 (오래된 뉴스보다 최근 것이 검색에서 더 산다)
후보.sort((a, b) => b.score - a.score || (b.publishedAt > a.publishedAt ? 1 : -1));

console.log(`보관함 ${archived.length}편 · 되살릴 수 있는 글 ${후보.length}편\n`);
if (Object.keys(제외이유).length) {
  console.log("건드리지 않는 것:");
  for (const [k, v] of Object.entries(제외이유).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(4)}편  ${k}`);
  }
  console.log();
}

const 대상 = 전체목록 ? 후보 : 후보.slice(0, 개수);
console.log(전체목록 ? "되살릴 수 있는 글 전부:" : `이번에 되살릴 ${대상.length}편:`);
for (const p of 대상) {
  console.log(`  ${String(p.score).padStart(3)}점  ${(p.publishedAt || "").slice(0, 10)}  [${p.category}]  ${p.title}`);
  console.log(`         보관사유: ${p.reason || "(없음)"}`);
  console.log(`         https://oddsbag.co.kr/magazine/${p.slug}`);
}

if (전체목록) process.exit(0);

if (!실행) {
  console.log(`\n※ 아무것도 바꾸지 않았습니다. 실제로 올리려면 --실행 을 붙이세요.`);
  console.log(`   남은 글은 ${Math.max(0, 후보.length - 대상.length)}편입니다.`);
  process.exit(0);
}

console.log("\n=== 실제 반영 ===");
let 성공 = 0;
const 실패 = [];
for (const p of 대상) {
  try {
    // 보관함 → 검수함 → 발행. 검수함에 두면 다음 점검이 다시 보관함으로 보낸다.
    if (!(await restoreArchived(p.slug))) throw new Error("보관함에서 못 꺼냄");
    if (!(await publishPost(p.slug))) throw new Error("발행 실패");
    성공++;
    console.log(`  ✅ ${성공}/${대상.length}  ${p.title}`);
  } catch (e) {
    실패.push({ slug: p.slug, 이유: e.message });
    console.log(`  ✗ ${p.slug}: ${e.message}`);
  }
}

console.log(`\n되살림 ${성공}편 · 실패 ${실패.length}편 · 남은 글 ${Math.max(0, 후보.length - 성공)}편`);
console.log("다음 할 일: 하루 뒤 이 글들이 다시 내려갔는지 확인한다.");
console.log("  node content-factory/restore-archived.mjs   ← 되살릴 수 있는 글 수가 늘어나 있으면 또 내려간 것이다");
