// Claude API — 수집 이슈를 오즈백 톤의 매거진 초안으로 변환
// 저작권 안전: 원문을 복사하지 않고, 사실을 바탕으로 새로 요약·해설한다.
// AI가 카테고리·무드·이미지 검색어까지 직접 판별한다.

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-5";

export const CATEGORIES = [
  "사회",
  "경제",
  "스포츠",
  "IT·테크",
  "문화·연예",
  "트렌드",
] as const;
export const MOODS = ["serious", "trust", "energetic", "soft", "trendy"] as const;

export interface DraftDraft {
  title: string;
  summary: string;
  body: string;
  emoji: string;
  tags: string[];
  category: string; // AI가 판별한 카테고리
  mood: string; // AI가 판별한 분위기 → 디자인 색에 반영
  imageQuery: string; // 정확한 영어 스톡사진 검색어
  imageQueryAlt: string; // 폴백용 넓은 검색어
}

const SYSTEM = `너는 '오즈백(ODDSBAG)' 매거진의 에디터야.
오즈백 톤: 진지하지 않고 살짝 위트 있게, 그러면서도 쓸모 있게. MZ 감성이지만 2030 폭넓게 공감되도록.
독자가 '한번쯤 알아두면 좋은' 이슈를 부담 없이 읽도록 다시 쓴다.
SNS에서 화제가 된 유행·밈·현상도 좋은 소재다 — 단, 원본 짤/사진/인물을 묘사·재현하지 말고 '왜 유행인지' 현상을 해설한다.

반드시 지킬 것:
- 원문 기사를 그대로 베끼지 말 것. 사실(누가/무엇/왜)만 참고해 완전히 새 문장으로 재작성.
- 과장·허위 금지. 확실하지 않은 건 단정하지 말 것. 특정 인물 비방·초상권 침해 금지.
- 본문은 마크다운. '## 소제목' 2~3개로 구성하고, 마지막은 반드시 '## 오즈백 한 줄 정리' 로 끝낸다.
- 정치적 편향/자극적 표현 자제, 따뜻하고 중립적으로.

판별할 것:
- category: 반드시 이 중 하나 — 사회 / 경제 / 스포츠 / IT·테크 / 문화·연예 / 트렌드
  (내용 기준으로 정확히. 예: 축구 경기 결과 → 스포츠, 금리 → 경제, 밈·유행 → 트렌드)
- mood: 반드시 이 중 하나 — serious(시사·진중) / trust(신뢰·정보) / energetic(활기·역동) / soft(감성·부드러움) / trendy(트렌디·힙)
- imageQuery: 이 기사에 어울리는 스톡 사진을 찾을 '영어' 검색어. 구체적으로! (나쁜 예: "news" / 좋은 예: "hospital bill medical cost", "soccer stadium celebration")
- imageQueryAlt: 위보다 넓은 백업 검색어 (2단어 내외)

출력은 반드시 아래 JSON만. 다른 말 붙이지 말 것.
{"title":"...","summary":"한 줄 요약","body":"## ...","emoji":"이모지 1개","tags":["태그1","태그2"],"category":"...","mood":"...","imageQuery":"english keywords","imageQueryAlt":"english"}`;

export async function generateDraft(
  sourceTitle: string,
  sourceContext: string,
  hintCategory: string,
): Promise<DraftDraft> {
  if (!API_KEY) throw new Error("ANTHROPIC_API_KEY 미설정");

  const userPrompt = `참고 이슈 제목: ${sourceTitle}
참고 내용/맥락: ${sourceContext}
(수집처가 추정한 분류: ${hintCategory} — 참고만 하고, 내용 기준으로 네가 정확히 다시 판단해)

위 이슈를 오즈백 톤의 매거진 글로 새로 써줘. JSON만 출력.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1600,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Claude API 오류 ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content?.map((c) => c.text ?? "").join("").trim() ?? "";
  const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const parsed = JSON.parse(jsonStr) as DraftDraft;

  const category = (CATEGORIES as readonly string[]).includes(parsed.category)
    ? parsed.category
    : hintCategory;
  const mood = (MOODS as readonly string[]).includes(parsed.mood)
    ? parsed.mood
    : "trendy";

  return {
    title: parsed.title?.trim() || sourceTitle,
    summary: parsed.summary?.trim() || "",
    body: parsed.body?.trim() || "",
    emoji: parsed.emoji?.trim() || "📰",
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
    category,
    mood,
    imageQuery: parsed.imageQuery?.trim() || "",
    imageQueryAlt: parsed.imageQueryAlt?.trim() || "",
  };
}

// ---- 사진 후보 중 기사에 맞는 것을 AI가 눈으로 보고 고른다 ----
export async function pickBestPhoto(
  title: string,
  summary: string,
  candidates: { url: string }[],
): Promise<number | null> {
  if (!API_KEY || candidates.length === 0) return null;

  const content: unknown[] = [
    {
      type: "text",
      text: `기사 제목: ${title}\n요약: ${summary}\n\n아래 ${candidates.length}장의 사진 중 이 기사의 커버로 가장 적절한 것을 고르세요.
기준: 기사 주제와 명백히 어울릴 것. 어색하거나 무관한 사진이면 고르지 마세요.
적절한 게 하나도 없으면 반드시 "none" 이라고 답하세요.
답은 숫자 하나(1~${candidates.length}) 또는 "none" 만 출력. 다른 말 금지.`,
    },
  ];
  candidates.forEach((c, i) => {
    content.push({ type: "text", text: `[${i + 1}번]` });
    content.push({ type: "image", source: { type: "url", url: c.url } });
  });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 10,
        messages: [{ role: "user", content }],
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { content?: { text?: string }[] };
    const ans = (d.content?.[0]?.text ?? "").trim().toLowerCase();
    if (ans.startsWith("none")) return null;
    const n = parseInt(ans, 10);
    if (Number.isNaN(n) || n < 1 || n > candidates.length) return null;
    return n - 1;
  } catch {
    return null;
  }
}
