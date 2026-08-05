import Link from "next/link";
import { categoryOf } from "@/lib/categories";
import { postUrl } from "@/lib/channels";
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
                href={postUrl(post)}
                className="group flex items-start gap-3"
              >
                {/* 1~3위는 퍼플 원형 배지, 4~5위도 읽히는 회색으로.
                    예전엔 4·5위가 연회색(/40)이라 번호가 거의 안 보였다. */}
                <span
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] font-black ${
                    i < 3
                      ? "bg-oddsbag-purple text-white"
                      : "bg-oddsbag-light-gray text-oddsbag-gray"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p
                    className="line-clamp-2 text-[15.5px] font-semibold leading-snug text-oddsbag-dark group-hover:text-oddsbag-purple"
                    style={{ wordBreak: "keep-all" }}
                  >
                    {post.title}
                  </p>
                  <span className="flex items-center gap-1 text-[12.5px] text-oddsbag-gray">
                    <span aria-hidden>{cat.emoji}</span>
                    {cat.label}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
