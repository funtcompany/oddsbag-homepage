import Link from "next/link";
import GenerativeCover from "@/components/GenerativeCover";
import type { Post } from "@/lib/posts";

export default function PostCard({ post }: { post: Post }) {
  return (
    <Link
      href={`/magazine/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-oddsbag-light-gray bg-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-oddsbag-purple/10"
    >
      <GenerativeCover post={post} variant="card" className="aspect-[4/5]" />
      <div className="flex flex-1 flex-col p-4">
        <span className="text-[12px] font-bold text-oddsbag-gray">
          {post.category}
          {post.readMinutes ? ` · ${post.readMinutes}분` : ""}
        </span>
        <h3
          className="mt-1 line-clamp-2 text-[15.5px] font-bold leading-snug text-oddsbag-dark group-hover:text-oddsbag-purple"
          style={{ wordBreak: "keep-all" }}
        >
          {post.title}
        </h3>
      </div>
    </Link>
  );
}
