// 유튜브 SEO — 설명란과 태그를 검색에 걸리게 만든다.
//
// 【무엇이 문제였나】 설명이 '훅 한 줄 + 구독 문구 + 해시태그'뿐이었다.
//   유튜브는 제목과 설명 앞부분의 글자로 그 영상이 무엇인지 판단한다.
//   본문이 없으면 걸릴 말 자체가 없다. 조회수가 안 나오는 가장 큰 이유다.
//
// 【유튜브에서 실제로 통하는 순서】
//   1) 제목 — 사람이 검색창에 칠 말이 들어가야 한다
//   2) 설명 앞 150자 — 검색 결과에 미리보기로 잘려 나온다. 여기에 핵심 키워드를 넣는다
//   3) 본문 — 영상에서 다루는 항목을 글로 적어둔다. 검색에 걸릴 면적이 넓어진다
//   4) 해시태그 — 제목 위에 3개만 보인다. 15개를 넘기면 '전부' 무시된다
//   5) tags 필드 — 순위 영향은 작지만 오타·다른 말(동의어)을 덮는 데 쓴다. 전체 500자
import { youtubeHashtagText, youtubeKeywords } from "./tags.mjs";

// 설명란 해시태그는 5개. 15개까지 허용되지만 제목 위에 보이는 건 3개뿐이고,
// 많이 달수록 관련성이 옅어져 오히려 손해다. 가장 정확한 것만 앞에 둔다.
export const YT_DESC_TAG_COUNT = 5;

// tags 필드는 20개. 500자 안에서 오타·동의어까지 덮는 용도라 무한정 늘릴 이유가 없다.
export const YT_TAGS_COUNT = 20;

const SITE = process.env.SITE_URL || "https://oddsbag.co.kr";

/** 본문에서 '## 소제목'만 뽑는다 — 영상에서 실제로 다루는 항목이다 */
function sections(post) {
  const body = String(post.body ?? post.content ?? "");
  const out = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      const t = m[1].replace(/[#*`]/g, "").trim();
      // '오즈백 한 줄 정리'처럼 마무리하는 칸은 영상에서 다루는 항목이 아니다.
      // 목록에 넣으면 검색어와 상관없는 줄이 섞여 설명만 지저분해진다.
      const 마무리 = /한 ?줄 ?정리|정리하면|마치며|맺음|요약하면/.test(t);
      if (t && t.length <= 40 && !마무리) out.push(t);
    }
  }
  return out.slice(0, 8);
}

/**
 * 홈페이지로 보내는 링크 한 줄. (2026-08-11 신설 — 2주계획 8/12)
 *
 * 【왜 함수로 뺐나】 설명을 만드는 곳이 두 군데다 — 새 영상은 이 파일이,
 *   이미 올라간 영상은 `factory/boost-youtube.mjs`가 만든다. 문구를 각자 적어두면
 *   소급 도구가 새 템플릿을 덮어써서 되돌린다. 한 곳에서만 만든다.
 *
 * 【왜 뒤에 물음표가 붙나】 유튜브가 보낸 사람이 몇 명인지 지금은 셀 방법이 없다.
 *   이 표식(UTM)이 붙어 있으면 애널리틱스가 "유튜브에서 온 사람"으로 자동 분류한다.
 *   글 주소의 대표주소(canonical)는 물음표와 무관하게 고정이라 검색 손해는 없다.
 */
export function articleLink(slug) {
  if (!slug) return "";
  return `${SITE}/magazine/${slug}?utm_source=youtube&utm_medium=shorts`;
}

/** 설명란·소급도구가 함께 쓰는 링크 줄 */
export function articleLinkLine(slug) {
  const url = articleLink(slug);
  return url ? `👉 전체 내용 정리본: ${url}` : "";
}

/**
 * 유튜브 설명란.
 *
 * 앞 150자 안에 제목의 핵심 말이 들어가게 짠다 — 검색 결과 미리보기가 거기서 잘린다.
 *
 * 【2026-08-11 순서 변경】 링크를 훅 바로 다음으로 올렸다. 전에는 요약과 목록 8줄을
 *   다 지나야 링크가 나왔는데, 쇼츠는 설명이 기본으로 접혀 있어서 펼친 사람조차
 *   거기까지 안 내려간다. 유튜브가 유일하게 사람이 오는 채널이고 홈페이지로 보내는
 *   길이 이 한 줄뿐이라, 미리보기 글자 몇 자를 내주더라도 위로 올린다.
 */
export function youtubeDescription(post) {
  const lead = String(post.hook || post.title || "").trim();
  const summary = String(post.summary || "").trim();
  const secs = sections(post);
  const tags = youtubeHashtagText(post, YT_DESC_TAG_COUNT);

  const 조각 = [];

  // 1) 첫 줄 — 검색 미리보기에 그대로 나온다
  조각.push(lead);

  // 2) 글로 더 보기 — 접히기 전에 보이라고 여기에 둔다
  const 링크 = articleLinkLine(post.slug);
  if (링크) 조각.push("", 링크);

  // 3) 요약 — 제목의 말이 한 번 더 나오게 한다 (키워드 반복은 과하지 않게 한 번)
  if (summary && summary !== lead) 조각.push("", summary);

  // 4) 이 영상에서 다루는 것 — 검색에 걸릴 면적을 넓히는 부분
  if (secs.length) {
    조각.push("", "📌 이 영상에서 다루는 것");
    for (const s of secs) 조각.push(`· ${s}`);
  }

  조각.push("", "🔔 구독하면 이런 정보를 놓치지 않습니다 — @ODDSBAG");
  조각.push("", tags);

  // 유튜브 설명 상한은 5,000자다. 넘길 일은 없지만 잘라둔다.
  return 조각.join("\n").slice(0, 4900);
}

/** 유튜브 tags 필드 (# 없이) — 500자 안에서 20개 */
export function youtubeTags(post) {
  return youtubeKeywords(post, YT_TAGS_COUNT);
}

/**
 * 유튜브 제목 — 검색어가 앞에 오게 다듬는다.
 * 쇼츠는 #Shorts 를 붙여야 쇼츠 선반에 들어간다. 유튜브 제목 상한은 100자.
 */
export function youtubeTitle(post, { shorts = true } = {}) {
  const base = String(post.title || "").trim();
  const suffix = shorts ? " #Shorts" : "";
  return base.slice(0, 100 - suffix.length) + suffix;
}
