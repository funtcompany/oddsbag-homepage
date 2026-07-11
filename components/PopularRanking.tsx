import Link from "next/link";
import { categoryOf } from "@/lib/categories";
import type { Post } from "@/lib/posts";

// 인기글 랭킹 — 현재는 최신/피처드 기반.
// Upstash 연동 후 실제 조회수 기준으로 정렬됩니다. (lib/store 조회수)
export default function PopularRanking({ posts }: { posts: Post[] }) {
  return (
    <div className="rounded-2xl border border-oddsbag-light-gray bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">🔥</span>
        <h3 className="font-black text-oddsbag-dark">지금 인기글</h3>
      </div>
      <ol className="mt-4 space-y-3">
        {posts.map((post, i) => {
          const cat = categoryOf(post.category);
          return (
            <li key={post.slug}>
              <Link
                href={`/magazine/${post.slug}`}
                className="group flex items-start gap-3"
              >
                <span
                  className={`mt-0.5 w-5 shrink-0 text-center text-lg font-black ${
                    i < 3 ? "text-oddsbag-purple" : "text-oddsbag-gray/40"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-oddsbag-dark group-hover:text-oddsbag-purple">
                    {post.title}
                  </p>
                  <span className="text-xs text-oddsbag-gray/60">{cat.label}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
