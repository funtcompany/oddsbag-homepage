// 해시태그 엔진 — 대분류·중분류·소분류를 골고루 섞어 20~30개를 만든다.
//
// 【왜 골고루인가】 (사장님 지시 2026-08-05 — 노출이 안 나온다)
//   대분류만 30개 넣으면 큰 태그에 묻혀 아무 데도 안 걸린다.
//   소분류만 넣으면 검색하는 사람 자체가 없다.
//   셋을 섞어야 바닥(대)·본류(중)·상위노출(소)이 동시에 잡힌다.
//
// 【태그 목록은 여기 없다】 content-factory/tagpool.json 하나뿐이다.
//   factory/hashtags.mjs · lib/tags.ts 도 같은 파일을 읽는다. 목록은 거기서만 고친다.
//
// 【유튜브 주의】 설명란 해시태그가 15개를 넘으면 유튜브가 '전부' 무시한다.
//   그래서 유튜브 설명은 15개로 자르고, 대신 tags 필드(500자)에 키워드를 많이 넣는다.
import POOL from "./tagpool.json" with { type: "json" };

export const YT_DESC_TAG_LIMIT = 15; // 넘기면 유튜브가 해시태그를 전부 무시한다
export const YT_TAGS_CHAR_LIMIT = 500; // 유튜브 tags 필드 전체 길이 상한

// ---- 글마다 고정된 순서 섞기 (같은 글은 항상 같은 결과) ----
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
const shuffle = (arr, seed) =>
  arr
    .map((t, i) => [t, hash(`${seed}|${i}|${t}`)])
    .sort((a, b) => a[1] - b[1])
    .map(([t]) => t);

// ---- 태그 모양 정리 ----
//  인스타·유튜브는 태그에 공백·특수문자를 못 쓴다. 붙여쓰기로 바꾼다.
function norm(raw) {
  const body = String(raw)
    .replace(/^#/, "")
    .replace(/[^0-9a-zA-Z가-힣]/g, "");
  if (!body) return null;
  if (/^\d+$/.test(body)) return null; // 숫자만 남은 것은 태그 구실을 못 한다
  return "#" + body;
}

// ---- 주제 사전 ----
//  제목에서 아무 말이나 뽑으면 #몰랐지 #쓰면서 같은 쓰레기 태그가 나온다.
//  그래서 제목에서는 '사전에 있는 말'만 뽑는다. 사전은 주제팩의 판별어를 그대로 쓴다.
const TERMS = POOL.mid.flatMap((p) => p.when.map((w) => String(w).toLowerCase()));

/** 낱말 경계까지 보는 포함 검사 — "물어볼"의 '물'이 걸리는 사고를 막는다 */
function mentions(haystack, word) {
  const w = String(word).toLowerCase();
  if (w.length >= 2) return haystack.includes(w); // 두 글자 이상은 그대로 봐도 안전하다
  // 한 글자(맥·책)는 앞뒤가 공백이거나 문장 끝일 때만 인정한다
  const i = haystack.indexOf(w);
  if (i < 0) return false;
  const before = i === 0 ? " " : haystack[i - 1];
  const after = i + 1 >= haystack.length ? " " : haystack[i + 1];
  return /\s/.test(before) && /\s/.test(after);
}

// ---- 소분류: 이 글에만 해당하는 구체적인 말 ----
//  경쟁이 거의 없어 상위에 걸린다. 여기가 실제 유입이 나오는 칸이다.
function smallTags(post) {
  const stop = new Set(POOL.stop);
  const out = [];

  // 1) 글에 붙은 키워드 — AI 에디터가 그 글을 보고 뽑은 말이라 가장 정확하다
  for (const t of post.tags ?? []) {
    const n = norm(t);
    if (n && n.length > 2) out.push(n);
  }

  // 2) 제목에서 뽑되, 사전에 있는 말만 — "맥 쓰면서 이건 몰랐지? 숨은 단축키" → 맥
  //    (조사가 붙어 있어도 잡히게 앞부분 일치로 본다: "아이폰은" → 아이폰)
  //    뉴스는 건너뛴다. 사전이 생활 주제어라서 "영업이익 발표"의 '발표'가 걸린다.
  //    뉴스는 AI가 기사별로 뽑아 둔 키워드(post.tags)가 이미 정확하다.
  if (post.category !== "꿀팁") return dedupe(out);

  const title = String(post.title ?? "")
    .replace(/\d+\s*(가지|단계|선|개)/g, " ")
    .replace(/[^0-9a-zA-Z가-힣\s]/g, " ")
    .toLowerCase();
  for (const w of title.split(/\s+/)) {
    if (w.length < 2 || w.length > 12 || stop.has(w)) continue;
    const hit = TERMS.find((t) => w === t || (t.length >= 2 && w.startsWith(t)));
    if (hit) {
      const n = norm(hit);
      if (n) out.push(n);
    }
  }

  return dedupe(out);
}

// ---- 중분류: 주제가 맞는 사람에게 닿는 칸 ----
//  주제팩은 '가이드(꿀팁)' 글에만 적용한다.
//  뉴스 기사에 적용했더니 "영업이익 발표"가 문서·엑셀 팩에 걸려 #엑셀 #pdf 가 붙었다.
//  뉴스는 무슨 주제든 뉴스 태그를 다는 게 맞다.
function midTags(post) {
  if (post.category !== "꿀팁") return dedupe(POOL.midNews);

  const haystack = [post.title ?? "", ...(post.tags ?? [])].join(" ").toLowerCase();
  const hit = [];
  for (const pack of POOL.mid) {
    if (pack.when.some((w) => mentions(haystack, w))) hit.push(...pack.tags);
  }
  return dedupe(hit.length ? hit : POOL.midFallback);
}

// ---- 대분류: 노출의 바닥을 깔아주는 칸 ----
function bigTags(post) {
  const cat = POOL.big[post.category] ?? POOL.big["꿀팁"];
  return dedupe([...cat, ...POOL.commonBig]);
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const t = norm(raw);
    if (!t || t.length < 3) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/**
 * 태그 배열을 만든다 — 브랜드 → 소분류 → 중분류 → 대분류 순으로 섞어 담는다.
 *
 * 앞쪽이 더 중요하다(유튜브는 앞 3개만 제목 위에 뜬다). 그래서 구체적인 소분류를 앞에 둔다.
 * 목표 개수를 못 채우면 남은 칸에서 끌어와 채운다 — 20개는 반드시 넘긴다.
 */
export function buildTagList(post, max = 30) {
  const target = Math.max(10, Math.min(30, max));
  const seed = post.slug || post.title || "오즈백";

  const small = shuffle(smallTags(post), seed + ":s");
  const mid = shuffle(midTags(post), seed + ":m");
  const big = shuffle(bigTags(post), seed + ":b");
  const engage = shuffle(dedupe(POOL.engagement ?? []), seed + ":e");
  const brand = dedupe(POOL.brand);

  const out = [...brand];
  const push = (list, n) => {
    let added = 0;
    for (const t of list) {
      if (added >= n || out.length >= target) break;
      if (out.some((x) => x.toLowerCase() === t.toLowerCase())) continue;
      out.push(t);
      added++;
    }
  };

  // 비율 — 소 1/3, 중 1/3, 대 1/3. 품앗이 태그(#소통 등)는 3개까지만 곁들인다.
  const room = Math.max(0, target - brand.length);
  const engageWant = Math.min(3, Math.max(0, Math.round(room * 0.1)));
  const core = room - engageWant;
  const smallWant = Math.round(core * 0.36);
  const midWant = Math.round(core * 0.37);

  push(small, smallWant);
  push(mid, midWant);
  push(big, core - smallWant - midWant);
  push(engage, engageWant);

  // 한 칸이 모자랐으면 다른 칸에서 끌어와 목표 개수를 채운다 (20개는 반드시 넘긴다)
  if (out.length < target) push(mid, target);
  if (out.length < target) push(big, target);
  if (out.length < target) push(small, target);
  if (out.length < target) push(engage, target);

  return out.slice(0, target);
}

/** 해시태그 문자열 (인스타·페북·틱톡용, 기본 30개) */
export function hashtagText(post, max = 30) {
  return buildTagList(post, max).join(" ");
}

/**
 * 유튜브 설명란용 — 15개를 절대 넘기지 않는다.
 * 넘기면 유튜브가 해시태그를 전부 무시해서 하나도 안 붙은 것과 같아진다.
 */
export function youtubeHashtagText(post) {
  return buildTagList(post, YT_DESC_TAG_LIMIT).join(" ");
}

/**
 * 유튜브 tags 필드용 키워드 배열 (# 없이).
 * 여기는 개수 제한이 없고 '전체 500자' 제한만 있다 — 그래서 태그를 넉넉히 담는다.
 */
export function youtubeKeywords(post, max = 30) {
  const words = buildTagList(post, max).map((t) => t.replace(/^#/, ""));
  const list = [...new Set(["오즈백", "ODDSBAG", post.category, ...words].filter(Boolean))];

  // 500자를 넘기면 유튜브가 요청 자체를 거부한다. 넘치기 전에 자른다.
  const out = [];
  let len = 0;
  for (const w of list) {
    const add = w.length + 1; // 구분자 몫
    if (len + add > YT_TAGS_CHAR_LIMIT) break;
    out.push(w);
    len += add;
  }
  return out;
}
