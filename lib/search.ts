import type { Post } from "@/lib/posts";

// 검색은 서버에서 한다.
//  · 결과 페이지가 그대로 HTML로 나오니 느리지도, 자바스크립트가 필요하지도 않다.
//  · 글이 수백 편 수준이라 굳이 검색엔진 라이브러리를 붙일 이유가 없다.

// 한글 검색의 함정: "맥북"과 "맥 북", "MacBook"과 "macbook"이 다르게 잡힌다.
// 공백·기호를 없애고 소문자로 눕혀서 비교하면 대부분 해결된다.
function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[\s​]+/g, "")
    .replace(/[.,!?·・…"'"'「」『』()[\]{}<>~\-–—/\\|:;]/g, "");
}

// 본문에서 태그를 걷어낸다 (본문에 HTML이 섞여 있어도 글자만 검색되게)
function plain(s: string): string {
  return (s ?? "").replace(/<[^>]*>/g, " ");
}

export interface SearchHit {
  post: Post;
  score: number;
  /** 본문에서 검색어 주변을 잘라낸 미리보기 */
  snippet?: string;
}

// 검색어 주변 문장을 잘라 보여준다 (어디에 걸렸는지 바로 보이게)
function makeSnippet(body: string, words: string[]): string | undefined {
  const text = plain(body).replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  const flat = norm(text);
  // 원문 인덱스 ↔ 정규화 인덱스 대응표
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (norm(text[i]).length) map.push(i);
  }
  for (const w of words) {
    const at = flat.indexOf(w);
    if (at < 0) continue;
    const origin = map[at] ?? 0;
    const start = Math.max(0, origin - 40);
    const end = Math.min(text.length, origin + 90);
    return (start > 0 ? "… " : "") + text.slice(start, end).trim() + (end < text.length ? " …" : "");
  }
  return text.slice(0, 120) + (text.length > 120 ? " …" : "");
}

/**
 * 글 목록에서 검색어에 맞는 것을 골라 점수 순으로 돌려준다.
 * 여러 단어를 넣으면 전부 포함된 글만 나온다(AND).
 */
export function searchPosts(posts: Post[], query: string): SearchHit[] {
  const words = query
    .split(/\s+/)
    .map(norm)
    .filter((w) => w.length > 0);
  if (!words.length) return [];

  const hits: SearchHit[] = [];

  for (const post of posts) {
    const title = norm(post.title);
    const summary = norm(post.summary);
    const body = norm(plain(post.body));
    const tags = norm((post.tags ?? []).join(" "));
    const category = norm(post.category);

    // 모든 단어가 어딘가에는 들어 있어야 한다
    const allFound = words.every(
      (w) =>
        title.includes(w) ||
        summary.includes(w) ||
        body.includes(w) ||
        tags.includes(w) ||
        category.includes(w),
    );
    if (!allFound) continue;

    // 제목에 걸린 글을 위로 (사람이 찾는 건 대개 제목에 있다)
    let score = 0;
    for (const w of words) {
      if (title.includes(w)) score += 100;
      if (tags.includes(w)) score += 30;
      if (summary.includes(w)) score += 20;
      if (category.includes(w)) score += 15;
      if (body.includes(w)) score += 5;
    }
    // 제목이 검색어로 시작하면 더 위로
    if (title.startsWith(words[0])) score += 50;

    hits.push({ post, score, snippet: makeSnippet(post.body, words) });
  }

  return hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // 점수가 같으면 최신 글 먼저
    return (b.post.publishedAt ?? b.post.date).localeCompare(
      a.post.publishedAt ?? a.post.date,
    );
  });
}

/**
 * 결과가 없을 때 대신 보여줄 만한 글.
 * 검색어 중 한 단어라도 걸리는 글을 찾아본다(OR).
 */
export function looseSearch(posts: Post[], query: string, limit = 6): Post[] {
  const words = query
    .split(/\s+/)
    .map(norm)
    .filter(Boolean);
  if (!words.length) return [];
  const out: { post: Post; n: number }[] = [];
  for (const post of posts) {
    const hay = norm(
      `${post.title} ${post.summary} ${(post.tags ?? []).join(" ")} ${post.category}`,
    );
    const n = words.filter((w) => hay.includes(w)).length;
    if (n > 0) out.push({ post, n });
  }
  return out
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((o) => o.post);
}
