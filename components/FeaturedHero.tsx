import Link from "next/link";
import { categoryOf } from "@/lib/categories";
import type { Post } from "@/lib/posts";

export default function FeaturedHero({ post }: { post: Post }) {
  const cat = categoryOf(post.category);
  return (
    <Link
      href={`/magazine/${post.slug}`}
      className="group relative flex min-h-[280px] flex-col justify-end overflow-hidden rounded-3xl sm:min-h-[380px]"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${cat.gradient}`} />
      {post.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.cover}
          alt={post.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span
          className="absolute right-6 top-6 text-7xl opacity-30 transition group-hover:scale-110 sm:text-9xl"
          aria-hidden
        >
          {post.emoji ?? cat.emoji}
        </span>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/5" />

      <div className="relative z-10 p-6 sm:p-8">
        <span className="inline-block rounded-full bg-oddsbag-yellow px-2.5 py-0.5 text-xs font-black text-oddsbag-dark">
          오늘의 픽 · {cat.label}
        </span>
        <h2 className="mt-3 max-w-2xl text-2xl font-black leading-tight text-white sm:text-4xl">
          {post.title}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">
          {post.summary}
        </p>
      </div>
    </Link>
  );
}
