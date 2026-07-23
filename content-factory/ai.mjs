// Claude API — 수집 이슈를 오즈백 톤의 매거진 초안으로 변환
// 저작권 안전: 원문을 복사하지 않고, 사실을 바탕으로 새로 요약·해설한다.
// AI가 카테고리·무드·이미지 검색어까지 직접 판별한다.

import { ask } from "./llm.mjs";

export const CATEGORIES = [
  "사회",
  "경제",
  "스포츠",
  "IT·테크",
  "문화·연예",
  "트렌드",
];
export const MOODS = ["serious", "trust", "energetic", "soft", "trendy"];

const SYSTEM = `너는 '오즈백(ODDSBAG)' 매거진의 에디터야.
오즈백 톤: 진지하지 않고 살짝 위트 있게, 그러면서도 쓸모 있게. MZ 감성이지만 2030 폭넓게 공감되도록.
독자가 '한번쯤 알아두면 좋은' 이슈를 부담 없이 읽도록 다시 쓴다.
SNS에서 화제가 된 유행·밈·현상도 좋은 소재다 — 단, 원본 짤/사진/인물을 묘사·재현하지 말고 '왜 유행인지' 현상을 해설한다.

반드시 지킬 것:
- 원문 기사를 그대로 베끼지 말 것. 사실(누가/무엇/왜)만 참고해 완전히 새 문장으로 재작성.
- 과장·허위 금지. 확실하지 않은 건 단정하지 말 것. 특정 인물 비방·초상권 침해 금지.
- 본문은 마크다운. '## 소제목' 으로 구성하고, 마지막은 반드시 '## 오즈백 한 줄 정리' 로 끝낸다.
  · 제목이 "N가지"·"N개" 형태면 소제목을 정확히 N개 만든다 (예: "7가지" → 소제목 7개).
  · 그 외 일반 이슈는 소제목 2~4개.
  · 소제목 하나 = 독립된 정보 하나. 소제목만 읽어도 무슨 내용인지 알게 쓴다.
- 이 글은 카드뉴스·숏폼으로도 그대로 나간다. 정보가 본문 안에서 완결되게 쓴다.
  "자세한 건 링크에서", "아래에서 확인" 같이 다른 데로 넘기는 표현은 쓰지 않는다.
- 정치적 편향/자극적 표현 자제, 따뜻하고 중립적으로.

판별할 것:
- category: 반드시 이 중 하나 — 사회 / 경제 / 스포츠 / IT·테크 / 문화·연예 / 트렌드 / 꿀팁
  (내용 기준으로 정확히. 예: 축구 경기 결과 → 스포츠, 금리 → 경제, 밈·유행 → 트렌드,
   실시간 이슈가 아닌 사용법·생활정보·시즌 일정 안내 → 꿀팁)
- mood: 반드시 이 중 하나 — serious(시사·진중) / trust(신뢰·정보) / energetic(활기·역동) / soft(감성·부드러움) / trendy(트렌디·힙)
- imageQuery: 이 기사에 어울리는 스톡 사진을 찾을 '영어' 검색어. 구체적으로! (나쁜 예: "news" / 좋은 예: "hospital bill medical cost", "soccer stadium celebration")
- imageQueryAlt: 위보다 넓은 백업 검색어 (2단어 내외)

- hook: 인스타그램 첫 장에 크게 박을 '시선 붙잡는 한 줄'. 12~22자. 궁금하게 만들되 낚시는 금지.
  (나쁜 예: "충격! 모두가 놀랐다" / 좋은 예: "병원비, 왜 갑자기 두 배가 됐을까")

출력은 반드시 아래 형식 그대로. 다른 말 붙이지 말 것.
<title>제목</title>
<summary>한 줄 요약</summary>
<hook>인스타 훅 한 줄</hook>
<emoji>이모지 1개</emoji>
<tags>태그1, 태그2, 태그3</tags>
<category>카테고리</category>
<mood>무드</mood>
<imageQuery>english keywords</imageQuery>
<imageQueryAlt>english</imageQueryAlt>
<body>
## 소제목
본문...

## 오즈백 한 줄 정리
...
</body>`;

// 태그 형식 파서 — 본문에 줄바꿈/따옴표가 있어도 안전하다
export function pick(text, name) {
  const m = text.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  return m ? sanitize(m[1].trim()) : "";
}

// 글자 깨짐 검사 — 드물게 AI 응답에 깨진 문자가 섞여 들어온다.
// 이런 글이 그대로 발행되면 독자에게 '전�g이' 처럼 보인다.
const BROKEN = /[\uFFFD\uD800-\uDFFF]/; // 깨진 문자 · 짝 없는 서로게이트

export function hasBrokenChars(text) {
  return BROKEN.test(text);
}

// 보이지 않는 제어문자·특수 공백 정리 (한글/이모지/문장부호는 그대로 둔다)
export function sanitize(text) {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") // 제어문자
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, "") // 폭 없는 공백 (복사할 때 깨짐 유발)
    .replace(/\u00A0/g, " ") // 안 보이는 특수 공백 → 일반 공백
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export async function generateDraft(
  sourceTitle,
  sourceContext,
  hintCategory,
  lessons = "", // 학습 루프: 과거 지적사항에서 뽑은 재발 방지 체크리스트
) {
  const userPrompt = `${lessons ? `[지난 글들에서 반복된 지적 — 이번엔 반드시 지킬 것]\n${lessons}\n\n` : ""}[원문 기사 — 오직 여기 있는 사실만 쓸 수 있다]
제목: ${sourceTitle}
본문:
${sourceContext}

(수집처가 추정한 분류: ${hintCategory} — 참고만 하고, 내용 기준으로 네가 정확히 다시 판단해)

위 원문을 바탕으로 오즈백 톤의 매거진 글로 새로 써줘.
원문에 없는 수치·인용·사실을 절대 만들어내지 마라. 모르는 건 쓰지 마라.
지정된 태그 형식으로만 출력.`;

  const text = await ask(SYSTEM, userPrompt, { maxTokens: 2400 });

  const rawCategory = pick(text, "category");
  const rawMood = pick(text, "mood");
  const body = pick(text, "body");
  const title = pick(text, "title");

  if (!title || !body) throw new Error("초안 형식 오류 (제목/본문 없음)");
  // 글자가 깨진 채로 저장되면 독자에게 그대로 보인다 → 아예 버리고 다시 쓰게 한다
  if (hasBrokenChars(title + body + pick(text, "summary") + pick(text, "hook"))) {
    throw new Error("글자 깨짐 감지 — 재작성 필요");
  }

  return {
    title,
    summary: pick(text, "summary"),
    body,
    hook: pick(text, "hook") || title,
    emoji: pick(text, "emoji") || "📰",
    tags: pick(text, "tags")
      .split(/[,·]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 5),
    category: CATEGORIES.includes(rawCategory) ? rawCategory : hintCategory,
    mood: MOODS.includes(rawMood) ? rawMood : "trendy",
    imageQuery: pick(text, "imageQuery"),
    imageQueryAlt: pick(text, "imageQueryAlt"),
  };
}

// ---- 사진 후보 중 기사에 맞는 것을 AI가 눈으로 보고 고른다 ----
export async function pickBestPhoto(
  title,
  summary,
  candidates,
) {
  if (candidates.length === 0) return null;
  try {
    const prompt = `기사 제목: ${title}
요약: ${summary}

방금 보낸 ${candidates.length}장의 사진(순서대로 1번~${candidates.length}번) 중, 이 기사의 커버로 가장 적절한 것을 고르세요.
기준: 기사 주제와 명백히 어울릴 것. 어색하거나 무관한 사진이면 고르지 마세요.
적절한 게 하나도 없으면 반드시 "none" 이라고 답하세요.
답은 숫자 하나(1~${candidates.length}) 또는 "none" 만 출력. 다른 말 금지.`;

    const ans = (
      await ask("너는 매거진 사진 에디터다. 사진과 기사가 어울리는지만 판단한다.", prompt, {
        maxTokens: 12,
        images: candidates.map((c) => c.url),
      })
    )
      .trim()
      .toLowerCase();

    if (ans.startsWith("none")) return null;
    const n = parseInt(ans, 10);
    if (Number.isNaN(n) || n < 1 || n > candidates.length) return null;
    return n - 1;
  } catch {
    return null; // 사진을 못 고르면 생성형 타이포 디자인으로 간다
  }
}
