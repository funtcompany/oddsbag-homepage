// 【점검】 GitHub Actions 진입점 — 노션 동기화 + 발행글 재감사 + 검수함 구조 (Vercel cron/audit 대체)
import { runAudit } from "./audit.mjs";

const r = await runAudit();
console.log("점검 결과:", JSON.stringify({
  동기화: r.synced ?? 0,
  재감사: r.audited ?? 0,
  수정: r.fixed ?? [],
  내림: r.pulled ?? [],
  구조: r.rescued ?? [],
  오류: r.errors ?? [],
}, null, 2));
