"use client";

import { useEffect, useState } from "react";

interface Comment {
  name: string;
  text: string;
  date: string;
}

export default function CommentSection({ slug }: { slug: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetch(`/api/comments?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => setComments(d.comments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    const optimistic: Comment = {
      name: name.trim() || "익명",
      text: text.trim(),
      date: "방금",
    };
    setComments((c) => [...c, optimistic]);
    setText("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name: optimistic.name, text: optimistic.text }),
      });
      const d = await res.json();
      if (d.comments) setComments(d.comments);
    } catch {
      /* 유지 (낙관적 업데이트) */
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-oddsbag-light-gray bg-white p-5">
      <h3 className="font-black text-oddsbag-dark">
        댓글 {comments.length > 0 && `(${comments.length})`}
      </h3>

      <form onSubmit={submit} className="mt-4 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="닉네임 (선택)"
          maxLength={20}
          className="w-full rounded-lg border border-oddsbag-light-gray px-3 py-2 text-sm outline-none focus:border-oddsbag-purple"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="따뜻한 댓글을 남겨주세요"
          maxLength={500}
          rows={3}
          className="w-full resize-none rounded-lg border border-oddsbag-light-gray px-3 py-2 text-sm outline-none focus:border-oddsbag-purple"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={posting || !text.trim()}
            className="rounded-lg bg-oddsbag-purple px-4 py-2 text-sm font-bold text-white transition hover:bg-oddsbag-purple-dark disabled:opacity-50"
          >
            {posting ? "등록중…" : "댓글 등록"}
          </button>
        </div>
      </form>

      <div className="mt-5 space-y-3">
        {loading ? (
          <p className="text-sm text-oddsbag-gray/60">댓글을 불러오는 중…</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-oddsbag-gray/60">
            첫 댓글의 주인공이 되어보세요 ✍️
          </p>
        ) : (
          comments.map((c, i) => (
            <div
              key={i}
              className="rounded-xl bg-oddsbag-light-gray/50 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-oddsbag-dark">
                  {c.name}
                </span>
                <span className="text-xs text-oddsbag-gray/60">{c.date}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-oddsbag-dark/90">
                {c.text}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
