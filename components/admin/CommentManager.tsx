"use client";

import { useCallback, useEffect, useState } from "react";

// 독자 댓글 관리 — 사칭·욕설·광고 댓글을 내리는 화면.
// 목록은 /api/admin/comments 가 «최신 글부터» 훑어서 모아 준다.

interface Item {
  slug: string;
  title: string;
  index: number;
  name: string;
  text: string;
  date: string;
  /** 저장된 원본 문자열 — 지울 때 서버가 «정말 이 댓글인지» 대조하는 데 쓴다 */
  raw: string;
}

interface Payload {
  items: Item[];
  scanned: number;
  total: number;
  canDelete: boolean;
}

export default function CommentManager() {
  const [data, setData] = useState<Payload | null>(null);
  const [deep, setDeep] = useState(false); // 전체 글까지 훑기
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/comments${deep ? "?scan=all" : ""}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setMsg(`불러오기 실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [deep]);

  // 이펙트 안에서 곧바로 상태를 바꾸면 렌더가 연쇄로 돈다 → 한 박자 뒤로 미룬다
  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  async function remove(it: Item) {
    // 지우면 되돌릴 수 없다 — 무엇을 지우는지 보여주고 한 번 물어본다
    const ok = confirm(
      `이 댓글을 지웁니다. 되돌릴 수 없습니다.\n\n` +
        `글: ${it.title}\n작성자: ${it.name}\n내용: ${it.text.slice(0, 120)}\n\n진행할까요?`,
    );
    if (!ok) return;

    setBusy(true);
    setMsg("지우는 중…");
    try {
      const res = await fetch("/api/admin/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: it.slug, index: it.index, raw: it.raw }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg("✅ 지웠습니다.");
      await load();
    } catch (e) {
      setMsg(`오류: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const items = (data?.items ?? []).filter((it) => {
    if (!q.trim()) return true;
    const k = q.trim().toLowerCase();
    return (
      it.text.toLowerCase().includes(k) ||
      it.name.toLowerCase().includes(k) ||
      it.title.toLowerCase().includes(k)
    );
  });

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="내용·작성자·글 제목으로 찾기"
          className="min-w-[220px] flex-1 rounded-lg border border-oddsbag-light-gray px-3 py-2 text-sm outline-none focus:border-oddsbag-purple"
        />
        <button
          onClick={() => setDeep((v) => !v)}
          className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
            deep
              ? "bg-oddsbag-purple text-white"
              : "border border-oddsbag-light-gray text-oddsbag-gray hover:text-oddsbag-dark"
          }`}
        >
          {deep ? "전체 글 훑는 중" : "옛날 글까지 훑기"}
        </button>
        <button
          onClick={load}
          disabled={busy}
          className="rounded-full border border-oddsbag-light-gray px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {busy ? "불러오는 중…" : "새로고침"}
        </button>
      </div>

      {msg && (
        <p className="rounded-lg bg-oddsbag-light-gray/60 p-3 text-sm">{msg}</p>
      )}

      {data && !data.canDelete && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs leading-relaxed text-amber-900">
          저장소(Upstash)가 연결되지 않은 상태입니다. 목록은 보이지만
          <b> 삭제는 되지 않습니다.</b> 실제 서비스에서는 정상 동작합니다.
        </p>
      )}

      {!data && <p className="text-oddsbag-gray">불러오는 중…</p>}

      {data && (
        <p className="text-xs text-oddsbag-gray">
          최신 글 {data.scanned}편(전체 {data.total}편)을 훑어 댓글{" "}
          <b>{data.items.length}개</b>를 찾았습니다.
          {!deep && " 더 옛날 글의 댓글은 «옛날 글까지 훑기»를 누르세요."}
        </p>
      )}

      {data && items.length === 0 && (
        <p className="rounded-xl border border-dashed border-oddsbag-light-gray py-10 text-center text-sm text-oddsbag-gray">
          {data.items.length === 0
            ? "달린 댓글이 없습니다."
            : "찾는 조건에 맞는 댓글이 없습니다."}
        </p>
      )}

      <div className="space-y-2">
        {items.map((it) => (
          <div
            key={`${it.slug}-${it.index}`}
            className="flex flex-wrap items-start gap-2 rounded-xl border border-oddsbag-light-gray bg-white px-4 py-3"
          >
            <div className="min-w-[220px] flex-1">
              <p className="whitespace-pre-wrap break-words text-sm text-oddsbag-dark">
                {it.text}
              </p>
              <span className="mt-1 block text-xs text-oddsbag-gray">
                <b className="text-oddsbag-dark">{it.name}</b> · {it.date || "날짜 없음"}
                {" · "}
                <a
                  href={`/magazine/${it.slug}`}
                  target="_blank"
                  className="hover:text-oddsbag-purple"
                  title={it.title}
                >
                  {it.title} ↗
                </a>
              </span>
            </div>

            <button
              onClick={() => remove(it)}
              disabled={busy || !data?.canDelete}
              className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-400 transition hover:border-red-400 hover:text-red-600 disabled:opacity-40"
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-oddsbag-gray">
        💬 삭제하면 그 글의 댓글창에서 바로 사라집니다. 되돌릴 수 없으니 지우기 전에
        내용을 확인하세요.
      </p>
    </div>
  );
}
