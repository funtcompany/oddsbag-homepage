// Claude API — 수집 이슈를 오즈백 톤의 매거진 초안으로 변환
// 저작권 안전: 원문을 복사하지 않고, 사실을 바탕으로 새로 요약·해설한다.
// AI가 카테고리·무드·이미지 검색어까지 직접 판별한다.

import { ask } from "@/lib/llm";

export const CATEGORIES = [
  "사회",
  "경제",
  "스포츠",
  "IT·테크",
  "문화·연예",
  "트렌드",
  // 뉴스로 들어온 소재라도 '사용법·노하우'면 꿀팁으로 분류되게 한다.
  "꿀팁",
] as const;
export const MOODS = ["serious", "trust", "energetic", "soft", "trendy"] as const;

export interface DraftDraft {
  title: string;
  summary: string;
  body: string;
  hook: string; // 인스타 첫 장(썸네일)에 쓸 시선 붙잡는 한 줄
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
- 본문은 마크다운. '## 소제목' 으로 구성하고, 마지막은 반드시 '## 오즈백 한 줄 정리' 로 끝낸다.
  · 제목이 "N가지"·"N개" 형태면 소제목을 정확히 N개 만든다 (예: "7가지" → 소제목 7개).
  · 그 외 일반 이슈는 소제목 3~5개 (원문 사실이 충분하면 넉넉히 나눈다. 다룰 사실이 적으면 최소 2개까지 줄여도 된다).
  · 소제목 하나 = 독립된 정보 하나. 소제목만 읽어도 무슨 내용인지 알게 쓴다.
- [본문 깊이 — 서론에서 끝내지 말 것] 이 글은 세로영상(최대 179초)·카드뉴스(15~20컷)로 확장된다. 각 섹션이 얕으면 채울 내용이 없다.
  · 각 소제목 섹션은 '서론-본론-결론' 흐름을 갖춘다: ① 무슨 일인지 → ② 왜/어떻게 그런지 → ③ 그래서 뭐가 달라지나(독자에게 무슨 의미인지).
  · 각 섹션은 최소 2~4문장(대략 90자 이상)의 실질 내용을 담고, 반드시 '끝맺는 문장'으로 마무리한다.\n    "~인데요", "~지만" 처럼 말이 이어지는 채로 섹션을 끝내지 마라 (영상·카드뉴스에서 그대로 잘려 나간다).
  · 이슈성 글은 본문 전체 500자 이상을 목표로, 각 섹션이 카드뉴스 1~3장·영상 나레이션으로 나가도 알찬 분량이 되게 쓴다.
  · [가짜뉴스 절대 금지 — 길이보다 사실이 먼저] 분량을 채우려고 원문에 없는 사실·수치·인용·배경을 지어내지 마라. 원문 사실이 부족하면 억지로 늘리지 말고, 다룰 수 있는 만큼만 정직하게 쓰고 소제목 개수를 실제 담긴 만큼으로 줄인다.
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

- hook: 릴스·카드뉴스 첫 화면(첫 3초)에 크게 박을 한 줄. 12~22자. 낚시는 금지.
  【결론을 먼저 준다】 사람은 제목을 읽으러 오지 않는다. 첫 줄에서 "이게 나한테 뭘 해주는지"가
  끝나야 손가락이 멈춘다. 제목을 줄여 쓴 것·주제만 소개하는 말은 훅이 아니다.
  머릿속으로 3개를 만들어보고 그중 가장 센 하나만 내놓는다.
  잘 먹히는 형태(위에서부터 먼저 시도한다):
   · 결론 선공개 — 얻는 결과를 먼저 말한다. "이거 끄면 배터리 2시간 더 갑니다"
   · 손해 회피 — 실제 손해가 있을 때만. "모르면 매달 그냥 빠져나갑니다"
   · 구체적 숫자 — "숨은 기능 7가지"처럼 몇 개인지 밝힌다
   · 궁금증 갭 — "왜 갑자기 두 배가 됐을까" (위 세 개가 안 될 때만 쓴다)
  (나쁜 예: "충격! 모두가 놀랐다", "맥 단축키 정리" / 좋은 예: "자리 뜰 때 이 두 키면 3초면 끝납니다")
  ※ 결론을 먼저 줘도 '어떻게'가 본문에 남아 끝까지 본다. 원문에 없는 효과·수치를 지어내는 낚시는 여전히 금지.

- title: 검색으로 찾아올 수 있게 쓴다. 사람들이 실제로 검색창에 칠 법한 단어를 제목에 넣는다.
  (나쁜 예: "그 기능, 알고 계셨나요?" / 좋은 예: "맥 화면 잠금 단축키, 자리 비울 때 한 번에")
  낚시 제목 금지. 제목만 보고도 무슨 내용인지 알 수 있어야 한다.

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
export function pick(text: string, name: string): string {
  const m = text.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  return m ? sanitize(m[1].trim()) : "";
}

// 글자 깨짐 검사 — 드물게 AI 응답에 깨진 문자가 섞여 들어온다.
// 이런 글이 그대로 발행되면 독자에게 '전�g이' 처럼 보인다.
const BROKEN = /[\uFFFD\uD800-\uDFFF]/; // 깨진 문자 · 짝 없는 서로게이트

export function hasBrokenChars(text: string): boolean {
  return BROKEN.test(text);
}

// 보이지 않는 제어문자·특수 공백 정리 (한글/이모지/문장부호는 그대로 둔다)
export function sanitize(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") // 제어문자
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, "") // 폭 없는 공백 (복사할 때 깨짐 유발)
    .replace(/\u00A0/g, " ") // 안 보이는 특수 공백 → 일반 공백
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export async function generateDraft(
  sourceTitle: string,
  sourceContext: string,
  hintCategory: string,
  lessons = "", // 학습 루프: 과거 지적사항에서 뽑은 재발 방지 체크리스트
): Promise<DraftDraft> {
  const userPrompt = `${lessons ? `[지난 글들에서 반복된 지적 — 이번엔 반드시 지킬 것]\n${lessons}\n\n` : ""}[원문 기사 — 오직 여기 있는 사실만 쓸 수 있다]
제목: ${sourceTitle}
본문:
${sourceContext}

(수집처가 추정한 분류: ${hintCategory} — 참고만 하고, 내용 기준으로 네가 정확히 다시 판단해)

위 원문을 바탕으로 오즈백 톤의 매거진 글로 새로 써줘.
원문에 없는 수치·인용·사실을 절대 만들어내지 마라. 모르는 건 쓰지 마라.
지정된 태그 형식으로만 출력.`;

  const text = await ask(SYSTEM, userPrompt, { maxTokens: 3200 });

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
    category: (CATEGORIES as readonly string[]).includes(rawCategory) ? rawCategory : hintCategory,
    mood: (MOODS as readonly string[]).includes(rawMood) ? rawMood : "trendy",
    imageQuery: pick(text, "imageQuery"),
    imageQueryAlt: pick(text, "imageQueryAlt"),
  };
}

// ---- 사진 후보 중 기사에 맞는 것을 AI가 눈으로 보고 고른다 ----
export async function pickBestPhoto(
  title: string,
  summary: string,
  candidates: { url: string }[],
): Promise<number | null> {
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
