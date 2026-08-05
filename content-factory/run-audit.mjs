// 【점검】 GitHub Actions 진입점 — 노션 동기화 + 발행글 재감사 + 검수함 구조 (Vercel cron/audit 대체)
import { runAudit } from "./audit.mjs";
import { logWork } from "./worklog.mjs";

const r = await runAudit();
console.log("점검 결과:", JSON.stringify({
  동기화: r.synced ?? 0,
  재감사: r.audited ?? 0,
  수정: r.fixed ?? [],
  내림: r.pulled ?? [],
  구조: r.rescued ?? [],
  보관: r.archived ?? [],
  확인일지남: (r.stale ?? []).length, // 가이드 시효 — 표시만 하고 고치지 않는다 (2일 리포트로 감)
  오류: r.errors ?? [],
}, null, 2));

// 검수함에서 구조돼 이번에 처음 세상에 나간 글만 작업일지에 남긴다.
// (수정·내림·보관은 발행이 아니라 작업 과정이므로 일지에 올리지 않는다)
// 채널 이름은 노션 작업일지 DB의 선택지와 글자까지 같아야 한다.
const 채널_홈 = "오즈백 홈페이지";
const 채널_인스타 = "인스타 공식";
const 채널_페북 = "페이스북";

const site = (process.env.SITE_URL || "https://oddsbag.co.kr").replace(/\/$/, "");
const rows = [];
for (const p of r.rescued ?? []) {
  rows.push({ 채널: 채널_홈, 제목: p.title, 링크: `${site}/magazine/${p.slug}` });
  if (p.ig) rows.push({ 채널: 채널_인스타, 제목: p.title, 링크: p.igUrl });
  if (p.fb) rows.push({ 채널: 채널_페북, 제목: p.title, 링크: p.fbUrl });
}
const logged = await logWork(rows);
if (logged) console.log(`작업일지: ${logged}건 기록 (전체 ${rows.length}건 시도)`);
