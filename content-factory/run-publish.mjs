// 【발행】 GitHub Actions 진입점 — 예약 대기열에서 하나씩 발행 (Vercel cron/publish 대체)
import { runPublish } from "./publish.mjs";

const r = await runPublish();
console.log("발행 결과:", JSON.stringify({
  발행: r.published ?? [],
  대기: r.waiting ?? 0,
  다음: r.nextAt ?? null,
  오류: r.errors ?? [],
}, null, 2));
