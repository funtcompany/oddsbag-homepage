// 노션 허브 연동
//  · 수집기 → 노션 '오즈백 수집함' DB 에 페이지 생성 (상태=수집)
//  · 사장님이 노션에서 편집 후 상태=발행
//  · 동기화 → 상태=발행 페이지를 홈페이지(Redis)로 반영
//
// 본문은 노션 페이지 블록에 저장(마크다운 ↔ 블록 변환)해 노션에서 편집 가능.

import type { Post } from "@/lib/posts";

const TOKEN = process.env.NOTION_TOKEN;
const DB = process.env.NOTION_DATABASE_ID;
const VERSION = "2022-06-28";

export const notionEnabled = Boolean(TOKEN && DB);

async function notion(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Notion-Version": VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json();
  if (data.object === "error") {
    throw new Error(`Notion ${data.status}: ${data.message}`);
  }
  return data;
}

const rt = (s: string) => [{ type: "text", text: { content: s.slice(0, 1900) } }];

// 마크다운 → 노션 블록
function mdToBlocks(body: string) {
  return body
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((line) => {
      if (line.startsWith("## "))
        return {
          object: "block",
          type: "heading_2",
          heading_2: { rich_text: rt(line.slice(3)) },
        };
      if (line.startsWith("- "))
        return {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: rt(line.slice(2).replace(/\*\*/g, "")) },
        };
      return {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: rt(line.replace(/\*\*/g, "")) },
      };
    });
}

// 노션 블록 → 마크다운
function blocksToMd(blocks: { type: string; [k: string]: unknown }[]): string {
  const text = (rich: { plain_text?: string }[] = []) =>
    rich.map((r) => r.plain_text ?? "").join("");
  return blocks
    .map((b) => {
      const t = b.type;
      const data = b[t] as { rich_text?: { plain_text?: string }[] };
      const content = text(data?.rich_text);
      if (t === "heading_1" || t === "heading_2" || t === "heading_3")
        return `## ${content}`;
      if (t === "bulleted_list_item" || t === "numbered_list_item")
        return `- ${content}`;
      return content;
    })
    .filter((l) => l !== undefined)
    .join("\n\n");
}

// 수집 페이지 생성 (상태=수집)
export async function addCollectedPage(post: Post): Promise<string> {
  const data = await notion("/pages", "POST", {
    parent: { database_id: DB },
    properties: {
      제목: { title: rt(post.title) },
      상태: { select: { name: "수집" } },
      카테고리: { select: { name: post.category } },
      요약: { rich_text: rt(post.summary) },
      이모지: { rich_text: rt(post.emoji ?? "📰") },
      소스: { rich_text: rt(post.sources?.[0]?.title ?? "") },
      원본링크: { url: post.sources?.[0]?.url ?? null },
      커버이미지: { url: post.cover ?? null },
      사진출처: { rich_text: rt(post.imageCredit ?? "") },
      slug: { rich_text: rt(post.slug) },
      태그: { multi_select: (post.tags ?? []).map((t) => ({ name: t.slice(0, 90) })) },
      수집일: { date: { start: post.date } },
    },
    children: mdToBlocks(post.body).slice(0, 90),
  });
  return data.id as string;
}

interface NotionProp {
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  select?: { name: string } | null;
  multi_select?: { name: string }[];
  url?: string | null;
  date?: { start: string } | null;
}

// 상태=발행 페이지들을 Post 로 변환해 반환
export async function getPublishedFromNotion(): Promise<Post[]> {
  const query = await notion(`/databases/${DB}/query`, "POST", {
    filter: { property: "상태", select: { equals: "발행" } },
    page_size: 100,
  });

  const results = (query.results ?? []) as {
    id: string;
    properties: Record<string, NotionProp>;
  }[];

  const posts: Post[] = [];
  for (const page of results) {
    const p = page.properties;
    const prop = (name: string) => p[name];
    const rich = (name: string) =>
      (prop(name)?.rich_text ?? []).map((r) => r.plain_text).join("");
    const title = (prop("제목")?.title ?? []).map((r) => r.plain_text).join("");
    const slug = rich("slug") || page.id.replace(/-/g, "");

    // 본문 블록 로드
    const blocksRes = await notion(`/blocks/${page.id}/children?page_size=100`);
    const body = blocksToMd(blocksRes.results ?? []);

    posts.push({
      slug,
      title,
      summary: rich("요약"),
      category: prop("카테고리")?.select?.name ?? "트렌드",
      date: prop("수집일")?.date?.start ?? new Date().toISOString().slice(0, 10),
      status: "published",
      body,
      emoji: rich("이모지") || "📰",
      cover: prop("커버이미지")?.url ?? undefined,
      imageCredit: rich("사진출처") || undefined,
      tags: (prop("태그")?.multi_select ?? []).map((t) => t.name),
      sources: prop("원본링크")?.url
        ? [{ title: "원문 보기", url: prop("원본링크")!.url as string }]
        : [],
      readMinutes: Math.max(2, Math.round(body.length / 400)),
    });
  }
  return posts;
}
