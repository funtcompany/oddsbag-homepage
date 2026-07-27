"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// 검색창. 폼 그대로 /magazine?q=... 로 보낸다.
// (자바스크립트가 막혀 있어도 그냥 동작하게 form action 을 함께 둔다)
export default function SearchBox({
  defaultValue = "",
  size = "md",
  placeholder = "찾으시는 걸 검색해 보세요",
}: {
  defaultValue?: string;
  size?: "sm" | "md";
  placeholder?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);

  const big = size === "md";

  return (
    <form
      action="/magazine"
      method="get"
      role="search"
      onSubmit={(e) => {
        const v = q.trim();
        if (!v) return; // 빈 검색은 무시
        e.preventDefault();
        router.push(`/magazine?q=${encodeURIComponent(v)}`);
      }}
      className="w-full"
    >
      <div
        className={`flex items-center gap-2 rounded-full border border-oddsbag-light-gray bg-white shadow-sm transition focus-within:border-oddsbag-purple focus-within:ring-2 focus-within:ring-oddsbag-purple/20 ${
          big ? "px-4 py-2.5" : "px-3 py-1.5"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 text-oddsbag-gray ${big ? "h-5 w-5" : "h-4 w-4"}`}
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path
            d="M20 20l-3.5-3.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label="글 검색"
          className={`w-full bg-transparent text-oddsbag-dark outline-none placeholder:text-oddsbag-gray/70 ${
            big ? "text-[15px]" : "text-sm"
          }`}
        />
        <button
          type="submit"
          className={`shrink-0 rounded-full bg-oddsbag-purple font-bold text-white transition hover:bg-oddsbag-purple-dark ${
            big ? "px-4 py-1.5 text-sm" : "px-3 py-1 text-xs"
          }`}
        >
          검색
        </button>
      </div>
    </form>
  );
}
