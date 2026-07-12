// Claude API — 수집 이슈를 오즈백 톤의 매거진 초안으로 변환
// 저작권 안전: 원문을 복사하지 않고, 사실을 바탕으로 새로 요약·해설한다.

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-5";

export interface DraftDraft {
  title: string;
  summary: string;
  body: string;
  emoji: string;
  tags: string[];
}

const SYSTEM = `너는 '오즈백(ODDSBAG)' 매거진의 에디터야.
오즈백 톤: 진지하지 않고 살짝 위트 있게, 그러면서도 쓸모 있게. MZ 감성이지만 2030 폭넓게 공감되도록.
독자가 '한번쯤 알아두면 좋은' 이슈를 부담 없이 읽도록 다시 쓴다.

반드시 지킬 것:
- 원문 기사를 그대로 베끼지 말 것. 사실(누가/무엇/왜)만 참고해 완전히 새 문장으로 재작성.
- 과장·허위 금지. 확실하지 않은 건 단정하지 말 것.
- 본문은 마크다운. '## 소제목' 2~3개로 구성하고, 마지막은 반드시 '## 오즈백 한 줄 정리' 로 끝낸다.
- 정치적 편향/자극적 표현 자제, 따뜻하고 중립적으로.
- 출력은 반드시 아래 JSON 형식만. 다른 말 붙이지 말 것.

{"title":"...","summary":"한 줄 요약","body":"## ...\\n...","emoji":"관련 이모지 1개","tags":["태그1","태그2"]}`;

export async function generateDraft(
  sourceTitle: string,
  sourceContext: string,
  categoryLabel: string,
): Promise<DraftDraft> {
  if (!API_KEY) throw new Error("ANTHROPIC_API_KEY 미설정");

  const userPrompt = `카테고리: ${categoryLabel}
참고 이슈 제목: ${sourceTitle}
참고 내용/맥락: ${sourceContext}

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
      max_tokens: 1500,
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
  const text =
    data.content?.map((c) => c.text ?? "").join("").trim() ?? "";

  // JSON 파싱 (혹시 앞뒤 텍스트가 붙어도 중괄호 구간만 추출)
  const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const parsed = JSON.parse(jsonStr) as DraftDraft;

  return {
    title: parsed.title?.trim() || sourceTitle,
    summary: parsed.summary?.trim() || "",
    body: parsed.body?.trim() || "",
    emoji: parsed.emoji?.trim() || "📰",
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
  };
}
