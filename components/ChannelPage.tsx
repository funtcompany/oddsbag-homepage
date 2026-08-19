import Link from "next/link";
import PostListView, { type BoardLink } from "@/components/PostListView";
import { toCardPosts } from "@/lib/cardPost";
import type { Post } from "@/lib/posts";

/**
 * 코너(오즈백·뮤직) 목록 화면의 공통 틀.
 * 위에 소개 배너, 아래에 글 카드 목록. 글이 아직 없으면 안내 문구를 보여준다.
 */
export default function ChannelPage({
  emoji,
  title,
  lead,
  bgFrom,
  bgTo,
  posts,
  links,
  emptyText,
  showBoards = false,
  boardLinks = [],
  children,
}: {
  emoji: string;
  title: string;
  lead: string;
  bgFrom: string;
  bgTo: string;
  posts: Post[];
  links?: { label: string; href: string }[];
  emptyText: string;
  /** 게시판 탭을 보여줄지 («만드는 것들») */
  showBoards?: boolean;
  /** 자기 게시판 페이지에 사는 글묶음 */
  boardLinks?: BoardLink[];
  children?: React.ReactNode;
}) {
  return (
    <main className="flex-1">
      <section style={{ background: `linear-gradient(135deg, ${bgFrom}, ${bgTo})` }}>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="text-4xl" aria-hidden>
            {emoji}
          </div>
          <h1
            className="mt-3 text-[30px] font-black leading-tight text-white sm:text-[40px]"
            style={{ letterSpacing: "-0.03em", wordBreak: "keep-all" }}
          >
            {title}
          </h1>
          <p
            className="mt-4 max-w-[46ch] text-[16px] leading-relaxed text-white/80 sm:text-[18px]"
            style={{ wordBreak: "keep-all" }}
          >
            {lead}
          </p>
          {links && links.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/25"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {children}

        {posts.length > 0 ? (
          <PostListView
            posts={toCardPosts(posts)}
            heading="글 목록"
            showBoards={showBoards}
            boardLinks={boardLinks}
            emptyText="이 게시판엔 아직 글이 없습니다."
            reveal
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-oddsbag-light-gray bg-oddsbag-light-gray/30 px-6 py-12 text-center">
            <p className="text-[15px] font-bold text-oddsbag-dark">{emptyText}</p>
            <p className="mt-2 text-sm text-oddsbag-gray">
              곧 첫 글이 올라옵니다. 뉴스레터를 구독하시면 올라올 때 알려드릴게요.
            </p>
            <Link
              href="/#subscribe"
              className="mt-5 inline-block rounded-full bg-oddsbag-purple px-5 py-2.5 text-sm font-bold text-white"
            >
              구독하기
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
