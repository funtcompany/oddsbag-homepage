// 매거진 게시물 데이터 계층
// 콘텐츠 자동화 파이프라인(이슈 수집 → AI 초안 → 검수 → 발행)의 최종 산출물이
// content/posts/*.json 으로 저장되고, 이 모듈이 읽어서 페이지에 렌더링한다.

import fs from "fs";
import path from "path";

export type PostCategory = "사회" | "경제" | "스포츠" | "IT" | "문화";
export type PostStatus = "draft" | "published";

export interface Post {
  slug: string;
  title: string;
  summary: string; // 한 줄 요약
  category: PostCategory;
  date: string; // YYYY-MM-DD
  status: PostStatus;
  body: string; // 마크다운 본문
  sources?: { title: string; url: string }[]; // 출처 (저작권/신뢰성)
}

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

function readAllPosts(): Post[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("._"));
  const posts = files.map((file) => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf-8");
    return JSON.parse(raw) as Post;
  });
  // 발행된 것만, 최신순
  return posts
    .filter((p) => p.status === "published")
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getAllPosts(): Post[] {
  return readAllPosts();
}

export function getLatestPosts(count = 3): Post[] {
  return readAllPosts().slice(0, count);
}

export function getPostBySlug(slug: string): Post | undefined {
  return readAllPosts().find((p) => p.slug === slug);
}
