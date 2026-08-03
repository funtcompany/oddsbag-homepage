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

// 실제로 나간 것만 노션 작업일지에 남긴다 (오류는 위 로그에만 남고 일지에는 안 올라간다)
// 홈페이지 글 1줄 + 인스타 카드뉴스 1줄 + 페이스북 1줄 — 나간 곳마다 한 줄씩.
// 채널 이름은 노션 작업일지 DB의 선택지와 글자까지 같아야 한다 (다르면 조용히 새 선택지가 생긴다).
const 채널_홈 = "오즈백 홈페이지";
const 채널_인스타 = "인스타 공식";
const 채널_페북 = "페이스북";

const site = (process.env.SITE_URL || "https://oddsbag.co.kr").replace(/\/$/, "");
const rows = [];
for (const p of r.published ?? []) {
  rows.push({ 채널: 채널_홈, 제목: p.title, 링크: `${site}/magazine/${p.slug}` });
  if (p.ig) rows.push({ 채널: 채널_인스타, 제목: p.title, 링크: p.igUrl });
  if (p.fb) rows.push({ 채널: 채널_페북, 제목: p.title, 링크: p.fbUrl });
}
const logged = await logWork(rows);
if (logged) console.log(`작업일지: ${logged}건 기록 (전체 ${rows.length}건 시도)`);
