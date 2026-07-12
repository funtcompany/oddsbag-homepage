import Link from "next/link";
import GenerativeCover from "@/components/GenerativeCover";
import type { Post } from "@/lib/posts";

export default function FeaturedHero({ post }: { post: Post }) {
  return (
    <Link
      href={`/magazine/${post.slug}`}
      className="group block overflow-hidden rounded-3xl transition hover:shadow-xl hover:shadow-oddsbag-purple/15"
    >
      <GenerativeCover
        post={post}
        variant="hero"
        className="min-h-[300px] sm:min-h-[380px]"
      />
    </Link>
  );
}
