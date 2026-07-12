"use client";

import { useEffect, useState, useCallback } from "react";

interface Draft {
  slug: string;
  title: string;
  summary: string;
  category: string;
  body: string;
  emoji?: string;
  createdAt?: string;
  sources?: { title: string; url: string }[];
}
interface Published {
  slug: string;
  title: string;
  category: string;
  date: string;
}

export default function AdminPage() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [published, setPublished] = useState<Published[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(
    async (password: string) => {
      const res = await fetch(`/api/admin/list?password=${encodeURIComponent(password)}`);
      if (!res.ok) {
        setAuthed(false);
        setMsg("비밀번호가 틀렸어요.");
        return false;
      }
      const d = await res.json();
      setDrafts(d.drafts ?? []);
      setPublished(d.published ?? []);
      setAuthed(true);
      setMsg("");
      return true;
    },
    [],
  );

  useEffect(() => {
    const saved = localStorage.getItem("oddsbag-admin-pw");
    if (saved) {
      setPw(saved);
      load(saved);
    }
  }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (await load(pw)) localStorage.setItem("oddsbag-admin-pw", pw);
  }

  async function collect() {
    setBusy(true);
    setMsg("수집 중… (네이버·구글트렌드·구글뉴스에서 이슈를 모아 AI가 초안을 씁니다. 1~2분 걸려요)");
    try {
      const res = await fetch("/api/admin/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, limit: 5 }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg(`✅ ${d.created?.length ?? 0}건 초안 생성 (스캔 ${d.scanned}건)`);
      await load(pw);
    } catch (e) {
      setMsg(`오류: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function act(action: string, slug: string) {
    if (action === "delete" && !confirm("삭제할까요?")) return;
    setBusy(true);
    try {
      await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, action, slug }),
      });
      await load(pw);
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-oddsbag-light-gray/40 p-4">
        <form
          onSubmit={login}
          className="w-full max-w-sm rounded-2xl border border-oddsbag-light-gray bg-white p-6"
        >
          <h1 className="text-xl font-black text-oddsbag-dark">오즈백 검수함</h1>
          <p className="mt-1 text-sm text-oddsbag-gray">관리자 비밀번호를 입력하세요.</p>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="비밀번호"
            className="mt-4 w-full rounded-lg border border-oddsbag-light-gray px-3 py-2 outline-none focus:border-oddsbag-purple"
          />
          <button className="mt-3 w-full rounded-lg bg-oddsbag-purple py-2.5 font-bold text-white">
            들어가기
          </button>
          {msg && <p className="mt-3 text-sm text-red-500">{msg}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-oddsbag-dark">오즈백 검수함</h1>
        <button
          onClick={collect}
          disabled={busy}
          className="rounded-xl bg-oddsbag-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "처리중…" : "🔄 지금 이슈 수집"}
        </button>
      </div>
      {msg && (
        <p className="mt-3 rounded-lg bg-oddsbag-light-gray/60 p-3 text-sm text-oddsbag-dark">
          {msg}
        </p>
      )}

      {/* 초안 (검수 대기) */}
      <section className="mt-8">
        <h2 className="text-lg font-black text-oddsbag-dark">
          검수 대기 초안 ({drafts.length})
        </h2>
        <div className="mt-3 space-y-3">
          {drafts.length === 0 && (
            <p className="text-sm text-oddsbag-gray">
              대기 중인 초안이 없어요. “지금 이슈 수집”을 눌러보세요.
            </p>
          )}
          {drafts.map((d) => (
            <div
              key={d.slug}
              className="rounded-2xl border border-oddsbag-light-gray bg-white p-4"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{d.emoji}</span>
                <span className="rounded-full bg-oddsbag-purple/10 px-2 py-0.5 text-xs font-bold text-oddsbag-purple">
                  {d.category}
                </span>
              </div>
              <h3 className="mt-2 font-bold text-oddsbag-dark">{d.title}</h3>
              <p className="mt-1 text-sm text-oddsbag-gray">{d.summary}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-oddsbag-purple">
                  본문 미리보기
                </summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-oddsbag-light-gray/50 p-3 text-xs text-oddsbag-dark/80">
                  {d.body}
                </pre>
              </details>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => act("publish", d.slug)}
                  disabled={busy}
                  className="rounded-lg bg-oddsbag-purple px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  발행
                </button>
                <a
                  href={`/magazine/${d.slug}`}
                  target="_blank"
                  className="rounded-lg border border-oddsbag-light-gray px-3 py-1.5 text-sm text-oddsbag-gray"
                >
                  미리보기
                </a>
                <button
                  onClick={() => act("delete", d.slug)}
                  disabled={busy}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-500 disabled:opacity-50"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 발행됨 */}
      <section className="mt-10">
        <h2 className="text-lg font-black text-oddsbag-dark">
          발행됨 ({published.length})
        </h2>
        <div className="mt-3 space-y-2">
          {published.map((p) => (
            <div
              key={p.slug}
              className="flex items-center justify-between rounded-xl border border-oddsbag-light-gray bg-white px-4 py-2.5"
            >
              <div className="min-w-0">
                <span className="text-xs text-oddsbag-gray">{p.category}</span>
                <p className="truncate text-sm font-medium text-oddsbag-dark">
                  {p.title}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href={`/magazine/${p.slug}`}
                  target="_blank"
                  className="text-sm text-oddsbag-purple"
                >
                  보기
                </a>
                <button
                  onClick={() => act("delete", p.slug)}
                  disabled={busy}
                  className="text-sm text-red-400"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
