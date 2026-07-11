"use client";

import { useEffect, useState } from "react";

const REACTIONS = [
  { key: "like", emoji: "👍", label: "좋아요" },
  { key: "wow", emoji: "😮", label: "놀라워요" },
  { key: "sad", emoji: "😢", label: "슬퍼요" },
  { key: "angry", emoji: "😡", label: "화나요" },
];

export default function ReactionBar({ slug }: { slug: string }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/reactions?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => setCounts(d.counts ?? {}))
      .catch(() => {});
    try {
      setPicked(localStorage.getItem(`reaction:${slug}`));
    } catch {
      /* noop */
    }
  }, [slug]);

  async function react(key: string) {
    if (picked) return; // 1인 1회
    setCounts((c) => ({ ...c, [key]: (c[key] ?? 0) + 1 }));
    setPicked(key);
    try {
      localStorage.setItem(`reaction:${slug}`, key);
    } catch {
      /* noop */
    }
    try {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, reaction: key }),
      });
      const d = await res.json();
      if (d.counts) setCounts(d.counts);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="rounded-2xl border border-oddsbag-light-gray bg-white p-4">
      <p className="mb-3 text-sm font-bold text-oddsbag-dark">
        이 글, 어떠셨어요?
      </p>
      <div className="flex flex-wrap gap-2">
        {REACTIONS.map((r) => {
          const active = picked === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => react(r.key)}
              disabled={Boolean(picked)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                active
                  ? "border-oddsbag-purple bg-oddsbag-purple/10 font-bold text-oddsbag-purple"
                  : "border-oddsbag-light-gray text-oddsbag-gray hover:border-oddsbag-purple/40"
              } ${picked && !active ? "opacity-50" : ""}`}
            >
              <span className="text-base">{r.emoji}</span>
              <span>{counts[r.key] ?? 0}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
