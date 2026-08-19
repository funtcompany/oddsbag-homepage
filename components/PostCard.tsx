import Link from "next/link";
import GenerativeCover from "@/components/GenerativeCover";
import StudioCover from "@/components/StudioCover";
import { postUrl } from "@/lib/channels";
import { coverSpecOf } from "@/lib/coverSpecs";
import type { CardPost } from "@/lib/cardPost";

export default function PostCard({ post }: { post: CardPost }) {
  // 카드뉴스 서식을 따로 짜 둔 글(«만드는 것들» 서비스 글)은 그걸 쓴다.
  //  나머지는 지금까지 쓰던 생성형 커버 그대로.
  const studio = Boolean(coverSpecOf(post.slug));

  return (
    <Link
      href={postUrl(post)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-oddsbag-light-gray bg-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-oddsbag-purple/10"
    >
      {/* 커버엔 제목을 넣지 않는다.
          예전엔 커버 위에 한 번, 아래 글자칸에 또 한 번 — 같은 제목이 두 번 나오고
          둘 다 "…"으로 잘렸다. 제목은 아래 글자칸 한 곳으로 모은다.
          (카드뉴스 서식은 제목이 아니라 «두 줄 후킹 문구»라 겹치지 않는다) */}
      {studio ? (
        <StudioCover post={post} className="aspect-[4/3]" />
      ) : (
        <GenerativeCover post={post} variant="card" showTitle={false} className="aspect-[4/3]" />
      )}
      <div className="flex flex-1 flex-col p-4">
        <span className="text-[12px] font-bold text-oddsbag-gray">
          {post.category}
          {post.readMinutes ? ` · ${post.readMinutes}분` : ""}
        </span>
        <h3
          className="mt-1 line-clamp-3 text-[15.5px] font-bold leading-snug text-oddsbag-dark group-hover:text-oddsbag-purple"
          style={{ wordBreak: "keep-all" }}
        >
          {post.title}
        </h3>
        {/* 요약 한 줄 — 눌러야 할 이유를 만들어준다 */}
        {post.summary && (
          <p
            className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-oddsbag-gray"
            style={{ wordBreak: "keep-all" }}
          >
            {post.summary}
          </p>
        )}
      </div>
    </Link>
  );
}
