"use client";

import { useCallback, useEffect, useState } from "react";

// 내 자료함 — 인터랙티브 로직만. Header/Footer 는 page.tsx(서버)가 감싼다.
//  ★사장님 결정(2026-08-19): 로그인 없음(첫 방문 자동 등록) · 링크 자체가 공유용(A) · 방문자 5개 제한(c)

const VISITOR_LIMIT = 5;

interface Item {
  id: string;
  ownerId: string;
  title: string;
  createdAt: string;
  size: number;
  shareToken: string | null;
}

export default function HtmlLinkClient() {
  const [user, setUser] = useState<{ userId: string; isAdmin: boolean } | null>(null);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [tab, setTab] = useState<"file" | "paste">("file");
  const [title, setTitle] = useState("");
  const [pasted, setPasted] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/htmllink/items");
    if (res.ok) setItems((await res.json()).items ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      // 첫 방문이면 이 GET 이 익명 방문자 쿠키를 자동 발급한다(로그인 화면 없음)
      const res = await fetch("/api/htmllink/login");
      const data = await res.json();
      setUser(data.user ?? null);
      if (data.user) await loadItems();
      setReady(true);
    })();
  }, [loadItems]);

  const isAdmin = user?.isAdmin === true;
  const atLimit = !isAdmin && items.length >= VISITOR_LIMIT;

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      const fd = new FormData();
      if (title.trim()) fd.set("title", title.trim());
      if (tab === "file") {
        if (!file) {
          setMsg("올릴 HTML 파일을 골라 주세요.");
          return;
        }
        fd.set("file", file);
      } else {
        if (!pasted.trim()) {
          setMsg("HTML 내용을 붙여넣어 주세요.");
          return;
        }
        fd.set("html", pasted);
      }
      const res = await fetch("/api/htmllink/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "업로드에 실패했습니다.");
        return;
      }
      setTitle("");
      setPasted("");
      setFile(null);
      setMsg("올렸습니다. 아래 목록에서 '링크 복사'로 공유하세요.");
      await loadItems();
    } finally {
      setBusy(false);
    }
  }

  async function rename(it: Item) {
    const next = window.prompt("새 이름", it.title);
    if (next == null || !next.trim()) return;
    const res = await fetch("/api/htmllink/item", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: it.id, title: next.trim() }),
    });
    if (res.ok) await loadItems();
  }

  async function remove(it: Item) {
    if (!window.confirm(`"${it.title}" 을(를) 삭제할까요?`)) return;
    const res = await fetch("/api/htmllink/item", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: it.id }),
    });
    if (res.ok) await loadItems();
  }

  function copyLink(it: Item) {
    const url = `${origin}/service/html-link/v/${it.id}`;
    navigator.clipboard?.writeText(url);
    setMsg("공유 링크를 복사했습니다. 거래처에 바로 붙여넣어 보내세요.");
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-oddsbag-gray">
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div>
        <h1 className="text-2xl font-black text-oddsbag-dark">🔗 HTML 링크 생성기</h1>
        <p className="mt-1 text-sm leading-relaxed text-oddsbag-gray">
          내가 만든 HTML을 올리면 링크가 나옵니다. 그 링크로 열면 효과까지 원본 그대로
          재생되고, <b>링크를 아는 사람은 누구나 열람</b>할 수 있어 거래처에 바로 보낼 수
          있습니다.
        </p>
      </div>

      {/* 이 브라우저에 묶임 안내 */}
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
        {isAdmin ? (
          <>👑 관리자로 열려 있습니다. 자료 개수 제한 없이 올릴 수 있어요.</>
        ) : (
          <>
            📌 <b>내 자료 목록은 이 브라우저에만 저장</b>됩니다(로그인 없음). 브라우저
            기록·쿠키를 지우면 목록에 다시 들어올 수 없으니, 공유 링크는 따로
            보관해 두세요. 방문자는 <b>{VISITOR_LIMIT}개</b>까지 올릴 수 있습니다.
          </>
        )}
      </div>

      {/* 업로드 */}
      <form
        onSubmit={upload}
        className="mt-6 rounded-2xl border border-oddsbag-light-gray bg-white p-5"
      >
        <div className="mb-3 flex gap-1 rounded-lg bg-oddsbag-light-gray/60 p-1 text-sm font-bold">
          <button
            type="button"
            onClick={() => setTab("file")}
            className={`flex-1 rounded-md px-3 py-1.5 transition ${
              tab === "file"
                ? "bg-white text-oddsbag-purple shadow-sm"
                : "text-oddsbag-gray"
            }`}
          >
            파일 올리기
          </button>
          <button
            type="button"
            onClick={() => setTab("paste")}
            className={`flex-1 rounded-md px-3 py-1.5 transition ${
              tab === "paste"
                ? "bg-white text-oddsbag-purple shadow-sm"
                : "text-oddsbag-gray"
            }`}
          >
            붙여넣기
          </button>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목 (비우면 파일 이름으로)"
          className="mb-3 w-full rounded-xl border border-oddsbag-light-gray px-4 py-2.5 text-[15px] outline-none focus:border-oddsbag-purple"
        />

        {tab === "file" ? (
          <input
            type="file"
            accept=".html,.htm,text/html"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-oddsbag-gray file:mr-3 file:rounded-lg file:border-0 file:bg-oddsbag-purple file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
          />
        ) : (
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="<!doctype html> …  HTML 전체를 붙여넣으세요"
            rows={8}
            className="w-full rounded-xl border border-oddsbag-light-gray px-4 py-3 font-mono text-[13px] outline-none focus:border-oddsbag-purple"
          />
        )}

        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || atLimit}
            className="rounded-xl bg-oddsbag-purple px-5 py-2.5 text-sm font-black text-white transition hover:bg-oddsbag-purple-dark disabled:opacity-50"
          >
            {busy ? "올리는 중…" : "올리고 링크 만들기"}
          </button>
          {atLimit && (
            <span className="text-sm font-bold text-amber-700">
              {VISITOR_LIMIT}개를 다 채웠습니다. 지우고 올려 주세요.
            </span>
          )}
          {msg && <span className="text-sm text-oddsbag-gray">{msg}</span>}
        </div>
      </form>

      {/* 목록 */}
      <h2 className="mt-8 text-lg font-black text-oddsbag-dark">
        올린 자료 ({items.length}
        {isAdmin ? "" : ` / ${VISITOR_LIMIT}`})
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-oddsbag-gray">
          아직 올린 자료가 없습니다.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-2xl border border-oddsbag-light-gray bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-oddsbag-dark">
                    {it.title}
                  </p>
                  <p className="mt-0.5 text-[12px] text-oddsbag-gray">
                    {new Date(it.createdAt).toLocaleString("ko-KR")} ·{" "}
                    {(it.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <a
                  href={`/service/html-link/v/${it.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-lg bg-oddsbag-purple px-3 py-1.5 text-sm font-bold text-white hover:bg-oddsbag-purple-dark"
                >
                  열기 ↗
                </a>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <button
                  onClick={() => copyLink(it)}
                  className="rounded-lg bg-emerald-100 px-3 py-1.5 font-bold text-emerald-800 transition hover:bg-emerald-200"
                >
                  링크 복사
                </button>
                <button
                  onClick={() => rename(it)}
                  className="rounded-lg border border-oddsbag-light-gray px-3 py-1.5 font-bold text-oddsbag-gray hover:bg-oddsbag-light-gray"
                >
                  이름변경
                </button>
                <button
                  onClick={() => remove(it)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 font-bold text-red-600 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>

              <p className="mt-2 truncate rounded-lg bg-oddsbag-light-gray/50 px-3 py-1.5 text-[12px] text-oddsbag-gray">
                {origin}/service/html-link/v/{it.id}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
