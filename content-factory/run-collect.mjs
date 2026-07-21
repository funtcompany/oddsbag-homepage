// 【수집】 GitHub Actions 진입점 — 수집→작성→심사→예약 (Vercel cron/collect 대체)
import { runCollection } from "./pipeline.mjs";

const SOURCES = ["naver", "google-trends", "google-news", "google-news-world", "youtube"];

const r = await runCollection({ sources: SOURCES, limit: Number(process.env.COLLECT_LIMIT || 5) });
console.log("수집 결과:", JSON.stringify({
  예약: r.queued?.length ?? 0,
  발행: r.published?.length ?? 0,
  검수함: r.held?.length ?? 0,
  스캔: r.scanned ?? 0,
  오류: r.errors ?? [],
}, null, 2));
