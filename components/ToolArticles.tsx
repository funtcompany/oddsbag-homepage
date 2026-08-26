import Link from "next/link";
import PostListView from "@/components/PostListView";
import { getPostsByChannel } from "@/lib/posts";
import { toCardPosts } from "@/lib/cardPost";
import { boardKeyOf, boardOf } from "@/lib/boards";

// 도구 화면 아래에 붙는 «이 도구에 관한 글» 묶음.
//
// ★왜 필요한가 — 도구만 덜렁 놓으면 들어온 사람이 한 번 쓰고 나간다. 검색으로 들어올 길도 없다.
//   글을 아래에 붙이면 ①안쪽 링크가 생겨 검색에 도움이 되고 ②막힌 사람이 답을 찾아 남는다.
//   («HTML 링크 생성기» 에서 이미 확인한 방식이다 — 사용법 글 10편이 그렇게 붙어 있다)
//
// 글이 0편이면 아무것도 안 그린다. 빈 상자가 뜨면 도구가 버려진 것처럼 보인다.

export default async function ToolArticles({
  boardKey,
  heading,
  lead,
  /** 이 글은 빼고 보여준다 (글 화면 아래에 붙일 때 자기 자신 제외) */
  exceptSlug,
}: {
  boardKey: string;
  heading?: string;
  lead?: string;
  exceptSlug?: string;
}) {
  let posts;
  try {
    posts = (await getPostsByChannel("oddsbag")).filter(
      (p) => boardKeyOf(p) === boardKey && p.slug !== exceptSlug,
    );
  } catch {
    // 글 목록을 못 읽어도 도구 자체는 멀쩡히 돌아야 한다
    return null;
  }
  if (!posts.length) return null;

  const board = boardOf(boardKey);

  return (
    <section className="border-t border-oddsbag-light-gray bg-oddsbag-light-gray/30">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h2 className="text-xl font-black text-oddsbag-dark">
          {heading ?? `${board?.emoji ?? "📄"} 이 도구 쓰는 법 · 막힐 때`}
        </h2>
        <p className="mt-1 text-sm text-oddsbag-gray">
          {lead ?? "처음 쓰실 때 한 번 훑어보시면 헤맬 일이 줄어듭니다"}
        </p>
        <div className="mt-6">
          <PostListView posts={toCardPosts(posts)} />
        </div>
        <Link
          href="/service"
          className="mt-6 inline-block text-[13.5px] font-black text-oddsbag-purple hover:underline"
        >
          오즈백 툴즈 전체 보기 →
        </Link>
      </div>
    </section>
  );
}
