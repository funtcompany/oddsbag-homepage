"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import PostCard from "@/components/PostCard";
import PostRow from "@/components/PostRow";
import type { CardPost } from "@/lib/cardPost";
import { boardKeyOf, boardsWithPosts } from "@/lib/boards";

/**
 * 글 목록 — 갤러리 / 리스트 두 가지로 볼 수 있다.
 *  지시 2026-08-19 «글이 있는 모든 게시판·탭에서 갤러리·리스트를 골라 볼 수 있게 (매거진도)»
 *
 * · 고른 보기는 브라우저에 기억해 둔다 → 매거진에서 리스트로 봤으면 만드는 것들도 리스트로 열린다
 * · 게시판 탭(showBoards)은 «만드는 것들»에서만 켠다
 * · 서버가 아니라 여기서 거른다 → 탭을 눌러도 페이지를 다시 받지 않는다 (즉시 바뀐다)
 */

export type ViewMode = "gallery" | "list";
const STORE_KEY = "ob:view";

// ── 고른 보기를 브라우저에 기억해 두는 작은 저장소 ──
//  useEffect + setState 로 읽으면 그린 뒤에 한 번 더 그리게 된다(깜빡임).
//  useSyncExternalStore 는 리액트가 시키는 방식이라 hydration 도 어긋나지 않고,
//  한 화면에 목록이 둘이어도(서비스 게시판) 같이 움직인다. 다른 탭에서 바꿔도 따라온다.
const viewStore = {
  listeners: new Set<() => void>(),
  subscribe(cb: () => void) {
    viewStore.listeners.add(cb);
    window.addEventListener("storage", cb);
    return () => {
      viewStore.listeners.delete(cb);
      window.removeEventListener("storage", cb);
    };
  },
  get(): ViewMode {
    try {
      return window.localStorage.getItem(STORE_KEY) === "list" ? "list" : "gallery";
    } catch {
      return "gallery"; // 저장을 막아 둔 브라우저
    }
  },
  set(v: ViewMode) {
    try {
      window.localStorage.setItem(STORE_KEY, v);
    } catch {
      /* 무시 — 아래 알림만으로도 이번 방문 동안은 유지된다 */
    }
    viewStore.listeners.forEach((cb) => cb());
  },
  // 서버에서 그릴 때는 늘 갤러리 — 첫 그림이 서버·브라우저에서 같아야 한다
  server: (): ViewMode => "gallery",
};

export interface BoardLink {
  key: string;
  label: string;
  emoji: string;
  href: string;
  count: number;
}

function GalleryIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="0" y="0" width="7" height="7" rx="1.6" />
      <rect x="9" y="0" width="7" height="7" rx="1.6" />
      <rect x="0" y="9" width="7" height="7" rx="1.6" />
      <rect x="9" y="9" width="7" height="7" rx="1.6" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="0" y="1" width="5" height="5" rx="1.4" />
      <rect x="7" y="1.6" width="9" height="1.8" rx="0.9" />
      <rect x="7" y="4.6" width="6" height="1.4" rx="0.7" opacity=".55" />
      <rect x="0" y="10" width="5" height="5" rx="1.4" />
      <rect x="7" y="10.6" width="9" height="1.8" rx="0.9" />
      <rect x="7" y="13.6" width="6" height="1.4" rx="0.7" opacity=".55" />
    </svg>
  );
}

export default function PostListView({
  posts,
  heading,
  showBoards = false,
  boardLinks = [],
  emptyText = "아직 올라온 글이 없습니다.",
  reveal = false,
  showToggle = true,
}: {
  posts: CardPost[];
  /** 목록 위 제목. 없으면 전환 단추만 오른쪽에 놓는다 */
  heading?: string;
  /** 게시판 탭을 보여줄지 (만드는 것들) */
  showBoards?: boolean;
  /** 자기 게시판 페이지에 사는 글묶음 — 눌러서 그리로 간다 */
  boardLinks?: BoardLink[];
  emptyText?: string;
  /** 스크롤 등장 효과 */
  reveal?: boolean;
  /**
   * 전환 단추를 이 목록에도 달지.
   *  한 화면에 목록이 둘일 때(«나머지 N편 더 보기») 단추가 두 개 뜨면 어느 것을 눌러야 하나 싶다.
   *  끄면 위 목록에서 고른 방식을 그대로 따라간다 (저장소를 같이 쓰므로 저절로 맞춰진다).
   */
  showToggle?: boolean;
}) {
  const view = useSyncExternalStore(viewStore.subscribe, viewStore.get, viewStore.server);
  const [board, setBoard] = useState<string>("all");
  const choose = (v: ViewMode) => viewStore.set(v);

  const tabs = useMemo(
    () => (showBoards ? boardsWithPosts(posts) : []),
    [showBoards, posts],
  );
  const shown = useMemo(
    () => (board === "all" ? posts : posts.filter((p) => boardKeyOf(p) === board)),
    [posts, board],
  );

  const pill =
    "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition whitespace-nowrap";

  return (
    <div>
      {/* ── 게시판 고르기 ── */}
      {showBoards && (tabs.length > 0 || boardLinks.length > 0) && (
        <div className="mb-5">
          <p className="mb-2 text-[12.5px] font-bold text-oddsbag-gray">게시판</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => setBoard("all")}
              aria-pressed={board === "all"}
              className={`${pill} ${
                board === "all"
                  ? "bg-oddsbag-purple text-white"
                  : "border border-oddsbag-light-gray bg-white text-oddsbag-dark hover:border-oddsbag-purple hover:text-oddsbag-purple"
              }`}
            >
              전체 {posts.length}
            </button>

            {tabs.map(({ board: b, count }) => (
              <button
                key={b.key}
                type="button"
                onClick={() => setBoard(b.key)}
                aria-pressed={board === b.key}
                className={`${pill} ${
                  board === b.key
                    ? "bg-oddsbag-purple text-white"
                    : "border border-oddsbag-light-gray bg-white text-oddsbag-dark hover:border-oddsbag-purple hover:text-oddsbag-purple"
                }`}
              >
                {b.emoji} {b.label} {count}
              </button>
            ))}

            {/* 자기 게시판에 따로 사는 글묶음 (WPMS 원고 등) — 그 게시판으로 보낸다 */}
            {boardLinks.map((b) => (
              <Link
                key={b.key}
                href={b.href}
                className={`${pill} border border-oddsbag-light-gray bg-white text-oddsbag-dark hover:border-oddsbag-purple hover:text-oddsbag-purple`}
              >
                {b.emoji} {b.label} {b.count} →
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 제목 + 보기 전환 ── */}
      {(heading || showToggle) && (
      <div className="mb-4 flex items-end justify-between gap-3">
        {heading ? (
          <h2 className="text-xl font-black text-oddsbag-dark">{heading}</h2>
        ) : (
          <span />
        )}

        {showToggle && (
        <div
          className="flex shrink-0 items-center gap-0.5 rounded-full border border-oddsbag-light-gray bg-white p-0.5"
          role="group"
          aria-label="목록 보기 방식"
        >
          <button
            type="button"
            onClick={() => choose("gallery")}
            aria-pressed={view === "gallery"}
            title="갤러리로 보기"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold transition ${
              view === "gallery"
                ? "bg-oddsbag-purple text-white"
                : "text-oddsbag-gray hover:text-oddsbag-purple"
            }`}
          >
            <GalleryIcon />
            갤러리
          </button>
          <button
            type="button"
            onClick={() => choose("list")}
            aria-pressed={view === "list"}
            title="리스트로 보기"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold transition ${
              view === "list"
                ? "bg-oddsbag-purple text-white"
                : "text-oddsbag-gray hover:text-oddsbag-purple"
            }`}
          >
            <ListIcon />
            리스트
          </button>
        </div>
        )}
      </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-oddsbag-light-gray bg-oddsbag-light-gray/30 px-6 py-12 text-center">
          <p className="text-[15px] font-bold text-oddsbag-dark">{emptyText}</p>
        </div>
      ) : view === "list" ? (
        <div className="flex flex-col gap-2.5">
          {shown.map((p, i) => (
            <div key={p.slug} className={reveal ? "ob-reveal" : undefined} data-reveal-index={reveal ? i : undefined}>
              <PostRow post={p} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((p, i) => (
            <div key={p.slug} className={reveal ? "ob-reveal" : undefined} data-reveal-index={reveal ? i : undefined}>
              <PostCard post={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
