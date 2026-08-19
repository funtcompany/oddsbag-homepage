import Link from "next/link";
import GenerativeCover from "@/components/GenerativeCover";
import StudioCover from "@/components/StudioCover";
import { postUrl } from "@/lib/channels";
import { coverSpecOf } from "@/lib/coverSpecs";
import type { CardPost } from "@/lib/cardPost";
import { krShort } from "@/lib/day";

/**
 * 리스트 보기 한 줄.
 *  지시 2026-08-19 «왼쪽에 사진 작게, 그 옆에 제목 눈에 잘 띄게, 내용은 첫 줄 정도만»
 *
 *  ┌──────┬────────────────────────────┐
 *  │ 사진 │ 꿀팁 · 8월 19일 · 4분       │
 *  │      │ 제목이 크게 두 줄까지        │
 *  │      │ 요약 한 줄만                │
 *  └──────┴────────────────────────────┘
 */
export default function PostRow({ post }: { post: CardPost }) {
  const studio = Boolean(coverSpecOf(post.slug));
  const day = krShort(post.date);

  return (
    <Link
      href={postUrl(post)}
      className="group flex items-center gap-4 rounded-2xl border border-oddsbag-light-gray bg-white p-3 transition hover:border-oddsbag-purple/40 hover:shadow-md hover:shadow-oddsbag-purple/10 sm:gap-5 sm:p-4"
    >
      <div className="w-[96px] shrink-0 overflow-hidden rounded-xl sm:w-[136px]">
        {studio ? (
          <StudioCover post={post} compact className="aspect-[4/3]" />
        ) : (
          <GenerativeCover post={post} variant="card" showTitle={false} compact className="aspect-[4/3]" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <span className="text-[11.5px] font-bold text-oddsbag-gray sm:text-[12px]">
          {post.category}
          {day ? ` · ${day}` : ""}
          {post.readMinutes ? ` · ${post.readMinutes}분` : ""}
        </span>
        <h3
          className="mt-1 line-clamp-2 text-[16px] font-black leading-snug text-oddsbag-dark group-hover:text-oddsbag-purple sm:text-[19px]"
          style={{ wordBreak: "keep-all", letterSpacing: "-0.02em" }}
        >
          {post.title}
        </h3>
        {post.summary && (
          <p
            className="mt-1.5 line-clamp-1 text-[13px] leading-relaxed text-oddsbag-gray sm:text-[14px]"
            style={{ wordBreak: "keep-all" }}
          >
            {post.summary}
          </p>
        )}
      </div>
    </Link>
  );
}
