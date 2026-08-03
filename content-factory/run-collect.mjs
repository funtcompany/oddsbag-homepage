// 【수집】 GitHub Actions 진입점 — 수집→작성→심사→예약 (Vercel cron/collect 대체)
import { runCollection } from "./pipeline.mjs";
import { logWork } from "./worklog.mjs";

const SOURCES = ["naver", "google-trends", "google-news", "google-news-world", "youtube"];

const r = await runCollection({ sources: SOURCES, limit: Number(process.env.COLLECT_LIMIT || 5) });
console.log("수집 결과:", JSON.stringify({
  예약: r.queued?.length ?? 0,
  발행: r.published?.length ?? 0,
  검수함: r.held?.length ?? 0,
  스캔: r.scanned ?? 0,
  오류: r.errors ?? [],
}, null, 2));

// 이 경로로 '바로 발행'된 글이 있으면 작업일지에 남긴다.
// (지금 파이프라인은 전부 예약 대기열로 보내므로 대개 0건이다. 예약된 글은 run-publish.mjs 가 기록한다.
//  나중에 즉시발행이 다시 켜져도 기록이 빠지지 않도록 여기에 미리 연결해 둔다)
const site = (process.env.SITE_URL || "https://oddsbag.co.kr").replace(/\/$/, "");
const rows = (r.published ?? []).map((p) => ({
  채널: "오즈백 홈페이지", // 노션 작업일지 DB의 선택지와 글자까지 같아야 한다
  제목: p.title,
  링크: `${site}/magazine/${p.slug}`,
}));
const logged = await logWork(rows);
if (logged) console.log(`작업일지: ${logged}건 기록`);
