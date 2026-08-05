"use client";

import { useCallback, useEffect, useState } from "react";

interface Inquiry {
  id: string;
  kind: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
  status: "new" | "done";
  note?: string;
}

export default function Inbox() {
  const [items, setItems] = useState<Inquiry[] | null>(null);
  const [filter, setFilter] = useState<"new" | "all">("new");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/inbox");
      const d = await res.json();
      setItems(d.items ?? []);
    } finally {
      setBusy(false);
    }
  }, []);

  // 이펙트 안에서 곧바로 상태를 바꾸면 렌더가 연쇄로 돈다 → 한 박자 뒤로 미룬다
  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  async function mark(id: string, status: "new" | "done") {
    setBusy(true);
    await fetch("/api/admin/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }

  const list = (items ?? []).filter((i) => filter === "all" || i.status === "new");

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-2 text-sm">
        {(
          [
            ["new", "안 읽은 문의"],
            ["all", "전체"],
          ] as ["new" | "all", string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-4 py-1.5 font-bold transition ${
              filter === k
                ? "bg-oddsbag-purple text-white"
                : "border border-oddsbag-light-gray text-oddsbag-gray"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={load}
          disabled={busy}
          className="ml-auto rounded-full border border-oddsbag-light-gray px-3 py-1.5 disabled:opacity-50"
        >
          새로고침
        </button>
      </div>

      {!items && <p className="text-oddsbag-gray">불러오는 중…</p>}

      {items && list.length === 0 && (
        <p className="rounded-xl border border-dashed border-oddsbag-light-gray py-12 text-center text-sm text-oddsbag-gray">
          {filter === "new" ? "안 읽은 문의가 없습니다." : "아직 문의가 없습니다."}
        </p>
      )}

      <div className="space-y-3">
        {list.map((it) => (
          <div
            key={it.id}
            className={`rounded-2xl border bg-white p-5 ${
              it.status === "new"
                ? "border-oddsbag-purple/40"
                : "border-oddsbag-light-gray opacity-80"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-oddsbag-purple/10 px-2.5 py-1 text-[12px] font-bold text-oddsbag-purple">
                {it.kind}
              </span>
              <span className="font-bold text-oddsbag-dark">
                {it.name || "이름 없음"}
              </span>
              <a
                href={`mailto:${it.email}?subject=${encodeURIComponent("[오즈백] 문의 답변드립니다")}`}
                className="text-sm text-oddsbag-purple hover:underline"
              >
                {it.email}
              </a>
              <span className="text-xs text-oddsbag-gray">
                {it.createdAt.slice(0, 16).replace("T", " ")}
              </span>
              <div className="ml-auto flex gap-1.5 text-xs">
                {it.status === "new" ? (
                  <button
                    onClick={() => mark(it.id, "done")}
                    className="rounded-full border border-oddsbag-light-gray px-3 py-1 text-oddsbag-gray hover:border-oddsbag-purple hover:text-oddsbag-purple"
                  >
                    처리 완료
                  </button>
                ) : (
                  <button
                    onClick={() => mark(it.id, "new")}
                    className="rounded-full border border-oddsbag-light-gray px-3 py-1 text-oddsbag-gray"
                  >
                    다시 열기
                  </button>
                )}
              </div>
            </div>
            <p
              className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-oddsbag-dark/90"
              style={{ wordBreak: "keep-all" }}
            >
              {it.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
