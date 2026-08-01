// 【작업일지】 발행·업데이트된 것만 노션 작업일지에 한 줄 남긴다.
// 오류·수정 내역은 기록하지 않는다 (그건 작업 과정이지 기록물이 아니다).
// 여기서 무슨 일이 나도 발행은 절대 멈추지 않는다 — 기록은 부수 작업이다.
//
// ※ 같은 파일이 oddsbag-homepage / funt-blog 두 저장소에 있다. 고칠 땐 반드시 둘 다.

const TOKEN = process.env.NOTION_TOKEN;
const DB = process.env.NOTION_WORKLOG_DB_ID;

// 한국 날짜. GitHub Actions는 UTC로 돌아서, 이걸 안 하면 밤 9시 이후 글이 전날로 기록된다.
const todayKST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * rows: [{ 채널, 제목, 링크?, 종류?, 날짜? }]
 * 종류 기본값은 "발행". 반환값은 실제로 기록된 건수.
 */
export async function logWork(rows) {
  if (!TOKEN || !DB || !rows?.length) return 0;

  let done = 0;
  for (const row of rows) {
    if (!row?.제목 || !row?.채널) continue;
    try {
      const res = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Notion-Version": "2022-06-28",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          parent: { database_id: DB },
          properties: {
            // 캘린더에는 제목만 보이므로 채널을 앞에 붙인다
            "이름": { title: [{ text: { content: `[${row.채널}] ${row.제목}` } }] },
            "날짜": { date: { start: row.날짜 ?? todayKST() } },
            "채널": { select: { name: row.채널 } },
            "종류": { select: { name: row.종류 ?? "발행" } },
            ...(row.링크 ? { "링크": { url: row.링크 } } : {}),
          },
        }),
      });
      if (res.ok) done++;
      else console.warn(`작업일지 기록 실패(${row.제목}):`, (await res.json()).message ?? res.status);
    } catch (e) {
      console.warn(`작업일지 기록 실패(${row.제목}):`, e.message);
    }
  }
  return done;
}
