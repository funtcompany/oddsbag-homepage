// 【발행】 GitHub Actions 진입점 — 예약 대기열에서 하나씩 발행 (Vercel cron/publish 대체)
import { runPublish } from "./publish.mjs";
import { logWork } from "./worklog.mjs";

const r = await runPublish();
console.log("발행 결과:", JSON.stringify({
  발행: r.published ?? [],
  대기: r.waiting ?? 0,
  다음: r.nextAt ?? null,
  오류: r.errors ?? [],
}, null, 2));

// 실제로 나간 글만 노션 작업일지에 남긴다 (오류는 위 로그에만 남고 일지에는 안 올라간다)
const site = (process.env.SITE_URL || "https://oddsbag.co.kr").replace(/\/$/, "");
const logged = await logWork(
  (r.published ?? []).map((p) => ({
    채널: "오즈백 홈페이지",
    제목: p.title,
    링크: `${site}/magazine/${p.slug}`,
  })),
);
if (logged) console.log(`작업일지: ${logged}건 기록`);
