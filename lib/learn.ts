// 학습 루프 — 콘텐츠 품질이 시간이 지날수록 좋아지게 만드는 장치
//
// 심사관이 지적한 사항을 Redis에 축적하고,
// 자주 반복되는 지적 Top N을 '교훈(lessons)'으로 뽑아
// 다음 글을 쓸 때 작성 프롬프트에 미리 주입한다.
// → 같은 실수를 두 번 하지 않는다. 쓸수록 잘 쓴다.

import { rpush, lrange, kvGet, kvSet } from "@/lib/store";

const K_ISSUES = "quality:issues"; // 지적사항 원본 로그
const K_LESSONS = "quality:lessons"; // 정제된 교훈 (작성 프롬프트에 주입)
const K_STATS = "quality:stats"; // 점수 추이

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-5";

export interface QualityStat {
  date: string;
  score: number;
  verdict: string;
  fakeRisk: string;
}

// ---- 기록 ----
export async function recordReview(stat: QualityStat, issues: string[]): Promise<void> {
  try {
    await rpush(K_STATS, JSON.stringify(stat));
    for (const i of issues.slice(0, 4)) {
      await rpush(K_ISSUES, JSON.stringify({ d: stat.date, i }));
    }
  } catch {
    /* 로그 실패가 발행을 막지 않는다 */
  }
}

// ---- 교훈 읽기 (작성 프롬프트에 주입) ----
export async function getLessons(): Promise<string> {
  try {
    const raw = await kvGet(K_LESSONS);
    return raw ?? "";
  } catch {
    return "";
  }
}

// ---- 교훈 갱신 (점검 크론이 호출) ----
// 최근 지적사항을 AI가 묶어서 '재발 방지 체크리스트'로 정제한다.
export async function refreshLessons(): Promise<string> {
  if (!API_KEY) return "";
  let logs: string[] = [];
  try {
    logs = await lrange(K_ISSUES);
  } catch {
    return "";
  }
  const recent = logs
    .slice(-120)
    .map((l) => {
      try {
        return (JSON.parse(l) as { i: string }).i;
      } catch {
        return "";
      }
    })
    .filter(Boolean);

  if (recent.length < 5) return await getLessons();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      system: `너는 매거진 편집장이다. 아래는 AI 에디터가 최근 반복적으로 지적받은 사항들이다.
이걸 분석해 '다시는 같은 실수를 하지 않도록' 하는 재발 방지 체크리스트를 만들어라.
- 가장 자주 반복된 문제 위주로 최대 6개.
- 각 줄은 '- ' 로 시작하는 명령형 한 문장. (예: "- 원문에 없는 수치는 절대 쓰지 말 것")
- 일회성 지적은 빼고, 패턴이 보이는 것만.
체크리스트만 출력. 다른 말 금지.`,
      messages: [{ role: "user", content: recent.join("\n") }],
    }),
    cache: "no-store",
  });
  if (!res.ok) return await getLessons();
  const d = (await res.json()) as { content?: { text?: string }[] };
  const lessons = (d.content?.map((c) => c.text ?? "").join("") ?? "").trim();
  if (lessons) await kvSet(K_LESSONS, lessons);
  return lessons;
}

// ---- 품질 추이 (개선 리포트용) ----
export async function getQualityTrend(): Promise<{
  count: number;
  avg7: number;
  avgPrev: number;
  autoPublishRate: number;
}> {
  let logs: string[] = [];
  try {
    logs = await lrange(K_STATS);
  } catch {
    return { count: 0, avg7: 0, avgPrev: 0, autoPublishRate: 0 };
  }
  const stats = logs
    .map((l) => {
      try {
        return JSON.parse(l) as QualityStat;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as QualityStat[];

  const recent = stats.slice(-40);
  const prev = stats.slice(-80, -40);
  const avg = (a: QualityStat[]) =>
    a.length ? Math.round(a.reduce((s, x) => s + x.score, 0) / a.length) : 0;
  const pub = recent.filter((s) => s.verdict === "publish").length;

  return {
    count: stats.length,
    avg7: avg(recent),
    avgPrev: avg(prev),
    autoPublishRate: recent.length ? Math.round((pub / recent.length) * 100) : 0,
  };
}
