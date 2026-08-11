// 인스타그램 캐러셀 카드 구성 (최대 10장)
//
// 【원칙】 정보는 이 게시물 안에서 끝난다.
//   홈페이지로 넘어가야 알 수 있는 '티저'로 만들지 않는다. (링크 전환율은 낮다)
//   제목이 "숨은 기능 7가지"면 7가지가 카드 안에 전부 들어있어야 한다.
//   그래서 요점(POINT) 카드를 최우선으로 채우고, 마지막은 저장·팔로우 유도로 닫는다.
//
//  1장  HOOK   — 스크롤 멈추게 하는 한 줄 (썸네일)
//  2장  INTRO  — 무슨 일인지 한 문단
//  3~n  POINT  — 소제목 + 핵심 문장 (자리 되는 만큼 전부)
//  끝장 CTA    — 저장 + 팔로우 (홈페이지 유입에 기대지 않는다)
//
// ※ 인스타 API 캐러셀 상한이 10장이라 10장에 맞춰 구성한다.
import { hashtagText } from "./tags.mjs";
import { ctaTitle, ctaSay, CTA_BODY } from "./ig-profile.mjs";

// 카드 한 장에 담는 설명 글자수 — 여기서는 '나레이션이 읽는 분량'이 된다.
// ★ 2026-08-08: 180 → 100. 릴스 평균시청 20초인데 74~83초짜리를 만들고 있었다.
//   상한(MAX_REEL_SEC)을 60초로 내리는 쪽은 요점 카드가 평균 3장 잘려 "5가지" 약속이 깨진다(실측).
//   그래서 카드를 버리는 대신 한 장의 설명을 줄인다 → 한 장도 안 버리고 평균 59초.
// ※ lib/cards.ts 의 같은 값과 반드시 똑같이 맞춘다 (저쪽은 그림, 이쪽은 나레이션).
const MAX_BODY = 100;
const MAX_CARDS = 10; // 인스타 그래프 API 캐러셀 상한

// 본문 도식 표시 — lib/guide.ts 와 반드시 같은 목록이어야 한다.
//  (여기서 안 빼면 인스타 카드에 "[Q] …" 처럼 대괄호가 그대로 찍혀 나간다)
const MARK_LINE = /^\[(키|경로|핵심|주의|즉답|버전|단계|확인|대안|[QA])\]\s*(.+)$/i;
const isMarkLine = (line) => MARK_LINE.test(String(line ?? "").trim());

// 큰 정밀 숫자를 읽기 좋게 반올림: "1463만2347점" → "약 1,463만 점" (눈으로도, TTS로도 편하게)
export function humanizeNum(s) {
  return String(s)
    .replace(/(\d+)만\s?(\d{3,4})\s*([점원명건개표배호]?)/g, (_m, a, _b, unit) => `약 ${Number(a).toLocaleString()}만${unit ? " " + unit : ""}`)
    .replace(/(\d+)억\s?(\d{3,5})(?!\s*원)/g, (_m, a) => `약 ${Number(a).toLocaleString()}억`);
}

// 카드 본문 발췌: 예산(n자) 안에서 '완결된 문장'까지만. 단어/문장 중간은 절대 안 자른다.
// 말이 이어지는 채로 끝나는 어미 — 여기서 끊으면 카드가 "~인데요."로 끝나 결론이 사라진다.
const CONNECTIVE = /(인데요|는데요|은데요|데요|인데|는데|지만|라서|어서|아서|고요)[.!?…]?$/;
// ★ 예산에 걸려 결론 문장이 잘리던 문제(사장님 지적 2026-07-29) 보완 — lib/cards.ts 와 동일 규칙.
function clip(s, n = MAX_BODY) {
  const t = humanizeNum(s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim());
  const sentences = t.split(/(?<=[.!?])\s+/).filter(Boolean); // 종결부호+공백에서만 → 소수점 안 쪼갬
  if (!sentences.length) return "";
  if (t.length <= n && !CONNECTIVE.test(sentences[sentences.length - 1])) return t;
  const out = [];
  for (const sen of sentences) {
    if (out.length && out.join(" ").length + sen.length + 1 > n) break;
    out.push(sen);
  }
  if (!out.length) out.push(sentences[0]);
  let i = out.length;
  while (CONNECTIVE.test(out[out.length - 1]) && i < sentences.length && out.join(" ").length < n * 1.5) out.push(sentences[i++]);
  while (out.length > 1 && CONNECTIVE.test(out[out.length - 1])) out.pop();
  return out.join(" ").trim();
}

function parseSections(body) {
  const out = [];
  let cur = null;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) {
      if (cur) out.push(cur);
      cur = { heading: line.slice(3).trim(), text: "" };
    } else if (cur) {
      // 도식 표시([키]/[경로]/[핵심]/[주의] + 가이드 6종)와 표 줄은 카드 본문에서 뺀다.
      // 홈페이지는 이걸 그림으로 세우고, 여기서는 글자로 새어나오면 안 된다.
      if (!isMarkLine(line) && !line.startsWith("|")) {
        cur.text += (cur.text ? " " : "") + line.replace(/^-\s*/, "");
      }
    }
  }
  if (cur) out.push(cur);
  return out.filter((s) => s.heading);
}

/**
 * @param opts.profileCount 인스타 프로필에 쌓인 게시물 수 (ig-profile.mjs 가 센다).
 *   모르면 넘기지 않는다 — 숫자 없는 옛 문구로 나간다. **추정치를 넣지 않는다.**
 */
export function buildCards(post, opts = {}) {
  const cards = [];

  // 1) 훅
  cards.push({
    kind: "hook",
    label: post.category,
    title: (post.hook || post.title).trim(),
  });

  // 2) 인트로
  if (post.summary) {
    cards.push({ kind: "intro", label: "무슨 일이냐면", title: clip(post.summary, 110) });
  }

  // 3) 본문 섹션
  const sections = parseSections(post.body);
  const closing = sections.find((s) => s.heading.includes("한 줄 정리"));
  const points = sections.filter((s) => !s.heading.includes("한 줄 정리"));

  // 정보가 잘리면 안 되므로 요점 카드를 최우선으로 채운다.
  // (마지막 CTA 1장은 항상 확보 — 그 나머지를 전부 요점에 쓴다)
  const roomForPoints = MAX_CARDS - cards.length - 1;
  points.slice(0, roomForPoints).forEach((s, i) => {
    cards.push({
      kind: "point",
      label: String(i + 1).padStart(2, "0"),
      title: s.heading,
      body: clip(s.text),
    });
  });

  // 4) 오즈백 한 줄 정리 — 요점을 다 넣고도 자리가 남을 때만
  if (closing?.text && cards.length < MAX_CARDS - 1) {
    cards.push({ kind: "quote", label: "오즈백 한 줄 정리", title: clip(closing.text, 120) });
  }

  // 5) 마무리 — 저장 + 팔로우. 홈페이지 유입에 기대지 않는다.
  //    ★ 2026-08-08: "팔로우하세요"만으로는 안 누른다. 한 편이 좋아도 다음 편을 기대할 이유가 없기 때문.
  //      그래서 슬로건으로 시리즈를 약속했다 — '매일 하나씩'.
  //    ★ 2026-08-11 「변경 4」: '매일 하나씩'은 미래 약속이라 지금 누를 이유가 못 된다.
  //      "지금 프로필에 N개가 쌓여 있다"로 바꾼다. 숫자는 인스타가 알려준 게시물 수만 쓴다(ig-profile.mjs).
  //    ※ lib/cards.ts 의 같은 카드와 글자까지 똑같이 맞춘다 — 그림은 lib 쪽이 그리고 나레이션은 이 파일이 읽는다.
  //    ※ say 를 같이 담는다: 목소리가 화면과 다른 숫자를 말하면 그게 제일 나쁜 실패다.
  cards.push({
    kind: "cta",
    label: "@oddsbag_official",
    title: ctaTitle(opts.profileCount),
    body: CTA_BODY,
    say: ctaSay(opts.profileCount),
  });

  return cards.slice(0, MAX_CARDS);
}

// 인스타 캡션 — 본문은 깔끔하게 (해시태그는 첫 댓글+대댓글로 분리)
//  캡션에 태그를 몰아넣으면 지저분해 보인다. 그래서 캡션은 훅+요약+행동유도만,
//  해시태그 30개는 buildHashtags 로 뽑아 대댓글에 붙인다 (social.ts).
//  【원칙】 링크로 넘기지 않는다 — 정보는 게시물 안에서 끝나고, CTA는 저장·팔로우다.
//  【변경 1 · 2026-08-11】 훅 바로 다음 줄에 계정 태그를 올린다 (빈 줄 없이 붙인다).
//   캡션은 첫 줄만 보이고 나머지는 접힌다. 맨 아래 @멘션은 접힌 안쪽이라 사실상 없는 것과 같았다.
//   @멘션은 캡션에서 누를 수 있는 유일한 요소다. 아래쪽 CTA 줄에서는 @를 뺐다 — 한 캡션에 두 번 적을 이유가 없다.
export function buildCaption(post) {
  return [
    post.hook || post.title,
    "@oddsbag_official 이 매일 하나씩",
    "",
    post.summary,
    "",
    "📌 저장해두면 필요할 때 바로 꺼내 볼 수 있어요",
    "🔔 이상하게 필요한 것들, 오즈백이 매일 하나씩 찾아드립니다",
  ]
    .filter((l) => l !== undefined)
    .join("\n")
    .slice(0, 2100);
}

// 첫 댓글에 붙일 이모지 하나 (글마다 고정) — 게시물 성격을 한눈에
const CATEGORY_EMOJI = {
  사회: "📰",
  경제: "💸",
  스포츠: "🏟️",
  "IT·테크": "🤖",
  "문화·연예": "🎬",
  트렌드: "🔥",
  꿀팁: "💡",
};
export function firstCommentEmoji(post) {
  return post.emoji || CATEGORY_EMOJI[post.category] || "🔎";
}

// 첫 댓글 전문 — 이모지 + 계정으로 가는 한 줄
//  【변경 3 · 2026-08-11】 첫 댓글은 접히지 않고 그대로 보이는 자리다. 그 자리에 계정 링크를 둔다.
//  해시태그 30개는 지금처럼 대댓글로 나가므로 검색 유입 손해는 없다.
export function firstComment(post) {
  return `${firstCommentEmoji(post)} 이 시리즈 다른 편 → @oddsbag_official`;
}

// 대댓글용 해시태그 (기본 30개) — 검색 유입용
//
// 태그 목록과 계산은 content-factory/tags.mjs 한 곳에 있다 (원본: tagpool.json).
// 대분류·중분류·소분류를 골고루 섞어 30개를 만든다 — 대분류만 채우면 큰 태그에
// 묻혀 아무 데도 안 걸린다. (사장님 지시 2026-08-05 — 노출 개선)
export function buildHashtags(post, max = 30) {
  return hashtagText(post, max);
}
