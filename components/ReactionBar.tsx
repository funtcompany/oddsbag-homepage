"use client";

import { useEffect, useState } from "react";

// 개설 이래 반응 0건이었다. 이유가 두 개였다.
//  ① 이름(좋아요/놀라워요/슬퍼요/화나요)이 속보 뉴스용이라 「서류 발급 절차」 같은 글에 누를 게 없었다.
//  ② 화면에 label 을 아예 안 그리고 이모지+숫자만 띄웠다 — 뭘 누르는 버튼인지 알 수 없었다.
// 그래서 이름을 「갑자기 필요해지는 것」 매거진에 맞게 바꾸고, 글자를 실제로 보여준다.
// ※ 옛 키(like/wow/sad/angry)는 서버 쪽에서 계속 받아준다 — 이미 저장된 값이 있으면 살아 있게.
const REACTIONS = [
  { key: "helped", emoji: "👍", label: "도움됐다" },
  { key: "didnt_know", emoji: "😮", label: "나만 몰랐다" },
  { key: "save_later", emoji: "🔖", label: "나중에 필요할 듯" },
  { key: "need_more", emoji: "🤔", label: "이걸론 부족해요" },
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
      <p className="mb-1 text-sm font-bold text-oddsbag-dark">
        이 글, 어떠셨어요?
      </p>
      <p className="mb-3 text-xs text-oddsbag-gray">
        한 번만 누르시면 됩니다. 어떤 걸 더 만들지 이걸 보고 정합니다.
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
              <span>{r.label}</span>
              <span className="tabular-nums opacity-70">
                {counts[r.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
