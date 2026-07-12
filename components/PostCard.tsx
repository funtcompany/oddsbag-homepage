import Link from "next/link";
import { categoryOf } from "@/lib/categories";
import type { Post } from "@/lib/posts";

export default function PostCard({ post }: { post: Post }) {
  const cat = categoryOf(post.category);
  return (
    <Link
      href={`/magazine/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-oddsbag-light-gray bg-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-oddsbag-purple/10"
    >
      {/* 커버 (이미지 없을 때 그라디언트 + 이모지) */}
      <div
        className={`relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-gradient-to-br ${cat.gradient}`}
      >
        {post.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.cover}
            alt={post.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="text-5xl drop-shadow-sm" aria-hidden>
            {post.emoji ?? cat.emoji}
          </span>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-oddsbag-dark">
          {cat.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-bold leading-snug text-oddsbag-dark group-hover:text-oddsbag-purple">
          {post.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-oddsbag-gray">
          {post.summary}
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-oddsbag-gray/70">
          <span>{post.date}</span>
          {post.readMinutes && (
            <>
              <span>·</span>
              <span>{post.readMinutes}분</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
