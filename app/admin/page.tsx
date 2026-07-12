"use client";

import { useEffect, useState, useCallback } from "react";

interface Published {
  slug: string;
  title: string;
  category: string;
  date: string;
}

const NOTION_DB_URL = "https://www.notion.so/39ba021454af81fda095e59a00525be0";

export default function AdminPage() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [published, setPublished] = useState<Published[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async (password: string) => {
    const res = await fetch(`/api/admin/list?password=${encodeURIComponent(password)}`);
    if (!res.ok) {
      setAuthed(false);
      setMsg("비밀번호가 틀렸어요.");
      return false;
    }
    const d = await res.json();
    setPublished(d.published ?? []);
    setAuthed(true);
    setMsg("");
    return true;
  }, []);

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
    setMsg("수집 중… 네이버·구글트렌드·구글뉴스·유튜브에서 이슈를 모아 AI가 초안을 써서 노션 수집함에 넣습니다. (1~2분)");
    try {
      const res = await fetch("/api/admin/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, limit: 5 }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg(`✅ 노션 수집함에 ${d.created?.length ?? 0}건 추가 (스캔 ${d.scanned}건). 노션에서 검토·편집 후 '상태=발행'으로 바꾸세요.`);
    } catch (e) {
      setMsg(`오류: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    setMsg("노션 → 홈페이지 동기화 중…");
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg(`✅ ${d.synced?.length ?? 0}건 홈페이지에 반영됨.`);
      await load(pw);
    } catch (e) {
      setMsg(`오류: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function del(slug: string) {
    if (!confirm("홈페이지에서 삭제할까요?")) return;
    setBusy(true);
    try {
      await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, action: "delete", slug }),
      });
      await load(pw);
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-oddsbag-light-gray/40 p-4">
        <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-oddsbag-light-gray bg-white p-6">
          <h1 className="text-xl font-black text-oddsbag-dark">오즈백 관리자</h1>
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
      <h1 className="text-2xl font-black text-oddsbag-dark">오즈백 관리자</h1>

      {/* 작업 흐름 */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <button
          onClick={collect}
          disabled={busy}
          className="rounded-2xl bg-oddsbag-purple p-4 text-left text-white transition hover:bg-oddsbag-purple-dark disabled:opacity-50"
        >
          <div className="text-lg font-black">1 · 이슈 수집</div>
          <div className="mt-1 text-xs text-white/80">
            여러 소스 → AI 초안 → 노션 수집함
          </div>
        </button>
        <a
          href={NOTION_DB_URL}
          target="_blank"
          className="rounded-2xl border border-oddsbag-light-gray bg-white p-4 transition hover:border-oddsbag-purple"
        >
          <div className="text-lg font-black text-oddsbag-dark">2 · 노션에서 작성</div>
          <div className="mt-1 text-xs text-oddsbag-gray">
            검토·편집 후 상태를 ‘발행’으로 →
          </div>
        </a>
        <button
          onClick={sync}
          disabled={busy}
          className="rounded-2xl border border-oddsbag-light-gray bg-white p-4 text-left transition hover:border-oddsbag-purple disabled:opacity-50"
        >
          <div className="text-lg font-black text-oddsbag-dark">3 · 홈 동기화</div>
          <div className="mt-1 text-xs text-oddsbag-gray">
            노션 발행글 → 홈페이지 반영
          </div>
        </button>
      </div>

      {msg && (
        <p className="mt-4 rounded-lg bg-oddsbag-light-gray/60 p-3 text-sm text-oddsbag-dark">
          {msg}
        </p>
      )}

      <p className="mt-4 text-xs text-oddsbag-gray">
        💡 매시 정각 자동 수집·동기화가 돌아갑니다. 위 버튼은 수동으로 즉시 실행할 때 쓰세요.
      </p>

      {/* 발행됨 */}
      <section className="mt-8">
        <h2 className="text-lg font-black text-oddsbag-dark">
          홈페이지 발행글 ({published.length})
        </h2>
        <div className="mt-3 space-y-2">
          {published.map((p) => (
            <div
              key={p.slug}
              className="flex items-center justify-between rounded-xl border border-oddsbag-light-gray bg-white px-4 py-2.5"
            >
              <div className="min-w-0">
                <span className="text-xs text-oddsbag-gray">
                  {p.category} · {p.date}
                </span>
                <p className="truncate text-sm font-medium text-oddsbag-dark">
                  {p.title}
                </p>
              </div>
              <div className="flex shrink-0 gap-3">
                <a href={`/magazine/${p.slug}`} target="_blank" className="text-sm text-oddsbag-purple">
                  보기
                </a>
                <button onClick={() => del(p.slug)} disabled={busy} className="text-sm text-red-400">
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
