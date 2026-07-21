// 【개선】 GitHub Actions 진입점 — 2일 1회 개선 점검 + 사장님 리포트 메일 (Vercel cron/improve 대체)
import { runImprove } from "./improve.mjs";

const r = await runImprove();
console.log("개선 결과:", JSON.stringify({
  글수: r.posts ?? 0,
  대기: r.drafts ?? 0,
  커버복구: r.coversFixed ?? 0,
  재게시: r.reshared ?? 0,
  액션: r.actions ?? [],
  오류: r.errors ?? [],
}, null, 2));
