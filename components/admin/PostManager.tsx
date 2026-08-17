"use client";

import { useCallback, useEffect, useState } from "react";

// 코너 목록 (서버 lib/channels.ts 와 같은 값)
const CHANNELS = [
  { key: "magazine", label: "📰 매거진", base: "/magazine" },
  { key: "oddsbag", label: "🎒 오즈백", base: "/oddsbag" },
  { key: "music", label: "🎵 뮤직", base: "/music" },
  { key: "tales", label: "📖 이야기", base: "/story" },
] as const;

type ChannelKey = (typeof CHANNELS)[number]["key"];
type Bucket = "published" | "drafts" | "queued" | "archived";

const BUCKETS: [Bucket, string][] = [
  ["published", "발행됨"],
  ["drafts", "검수함"],
  ["queued", "예약"],
  ["archived", "보관함"],
];

interface Row {
  slug: string;
  title: string;
  summary: string;
  category: string;
  channel: ChannelKey;
  date: string;
  status: string;
  hidden: boolean;
  featured: boolean;
  cover: string;
  quality: number | null;
}

interface Draft {
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  channel: ChannelKey;
  status: "draft" | "published";
  date: string;
  emoji: string;
  cover: string;
  tags: string;
}

const emptyDraft = (channel: ChannelKey): Draft => ({
  slug: "",
  title: "",
  summary: "",
  body: "",
  category:
    channel === "magazine"
      ? "기타"
      : channel === "music"
        ? "뮤직"
        : channel === "tales"
          ? "이야기"
          : "오즈백",
  channel,
  status: "draft",
  date: new Date().toISOString().slice(0, 10),
  emoji: "",
  cover: "",
  tags: "",
});

const input =
  "w-full rounded-lg border border-oddsbag-light-gray px-3 py-2 text-sm outline-none focus:border-oddsbag-purple";

export default function PostManager() {
  const [data, setData] = useState<Record<Bucket, Row[]> | null>(null);
  const [channel, setChannel] = useState<ChannelKey>("oddsbag");
  const [bucket, setBucket] = useState<Bucket>("published");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/posts");
      setData(await res.json());
    } catch (e) {
      setMsg(`불러오기 실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, []);

  // 이펙트 안에서 곧바로 상태를 바꾸면 렌더가 연쇄로 돈다 → 한 박자 뒤로 미룬다
  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  async function act(action: string, slug: string, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setMsg("처리 중…");
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, slug }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg("✅ 반영했습니다.");
      await load();
    } catch (e) {
      setMsg(`오류: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function openEditor(slug: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/posts?slug=${encodeURIComponent(slug)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const p = d.post;
      setEditing({
        slug: p.slug,
        title: p.title ?? "",
        summary: p.summary ?? "",
        body: p.body ?? "",
        category: p.category ?? "기타",
        channel: (p.channel ?? "magazine") as ChannelKey,
        status: p.status === "published" ? "published" : "draft",
        date: p.date ?? "",
        emoji: p.emoji ?? "",
        cover: p.cover ?? "",
        tags: (p.tags ?? []).join(", "),
      });
    } catch (e) {
      setMsg(`오류: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft(status: "draft" | "published") {
    if (!editing) return;
    setBusy(true);
    setMsg("저장 중…");
    try {
      const res = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editing,
          status,
          tags: editing.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg(
        status === "published"
          ? "✅ 발행했습니다. 홈페이지에 바로 보입니다."
          : "✅ 검수함에 저장했습니다.",
      );
      setEditing(null);
      await load();
    } catch (e) {
      setMsg(`오류: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  // ---------- 글 쓰기 화면 ----------
  if (editing) {
    const base = CHANNELS.find((c) => c.key === editing.channel)?.base ?? "/magazine";
    return (
      <div className="mt-6 space-y-4 pb-24">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-oddsbag-dark">
            {editing.slug ? "글 수정" : "새 글 쓰기"}
          </h2>
          <button
            onClick={() => setEditing(null)}
            className="text-sm text-oddsbag-gray hover:text-oddsbag-dark"
          >
            ← 목록으로
          </button>
        </div>

        {msg && (
          <p className="rounded-lg bg-oddsbag-light-gray/60 p-3 text-sm">{msg}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-4">
          <label className="sm:col-span-1">
            <span className="mb-1 block text-xs font-bold text-oddsbag-gray">코너</span>
            <select
              className={input}
              value={editing.channel}
              onChange={(e) =>
                setEditing({ ...editing, channel: e.target.value as ChannelKey })
              }
            >
              {CHANNELS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold text-oddsbag-gray">분류</span>
            <input
              className={input}
              value={editing.category}
              onChange={(e) => setEditing({ ...editing, category: e.target.value })}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold text-oddsbag-gray">날짜</span>
            <input
              className={input}
              value={editing.date}
              onChange={(e) => setEditing({ ...editing, date: e.target.value })}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold text-oddsbag-gray">이모지</span>
            <input
              className={input}
              value={editing.emoji}
              onChange={(e) => setEditing({ ...editing, emoji: e.target.value })}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-oddsbag-gray">제목</span>
          <input
            className={`${input} text-lg font-bold`}
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-oddsbag-gray">
            요약 (검색 결과에 나오는 문구 — 60자 이상 권장)
          </span>
          <textarea
            className={`${input} min-h-[70px]`}
            value={editing.summary}
            onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-oddsbag-gray">
            본문 — 소제목은 ## 로 시작, 목록은 - 로 시작
          </span>
          <textarea
            className={`${input} min-h-[420px] font-mono leading-relaxed`}
            value={editing.body}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-xs font-bold text-oddsbag-gray">
              커버 사진 주소 (비우면 자동 디자인 커버)
            </span>
            <input
              className={input}
              value={editing.cover}
              onChange={(e) => setEditing({ ...editing, cover: e.target.value })}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold text-oddsbag-gray">
              태그 (쉼표로 구분)
            </span>
            <input
              className={input}
              value={editing.tags}
              onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
            />
          </label>
        </div>

        <div className="sticky bottom-4 flex flex-wrap items-center gap-2 rounded-2xl border border-oddsbag-light-gray bg-white/95 p-3 shadow-lg backdrop-blur">
          <button
            onClick={() => saveDraft("published")}
            disabled={busy}
            className="rounded-full bg-oddsbag-purple px-6 py-2.5 font-black text-white disabled:opacity-50"
          >
            {busy ? "저장 중…" : "발행하기"}
          </button>
          <button
            onClick={() => saveDraft("draft")}
            disabled={busy}
            className="rounded-full border border-oddsbag-light-gray px-5 py-2.5 text-sm font-bold text-oddsbag-dark disabled:opacity-50"
          >
            검수함에 저장
          </button>
          {editing.slug && (
            <a
              href={`${base}/${editing.slug}`}
              target="_blank"
              className="ml-auto text-sm text-oddsbag-gray hover:text-oddsbag-purple"
            >
              올라간 글 보기 ↗
            </a>
          )}
        </div>
      </div>
    );
  }

  // ---------- 목록 화면 ----------
  const rows = (data?.[bucket] ?? []).filter((r) => r.channel === channel);
  const count = (b: Bucket) =>
    (data?.[b] ?? []).filter((r) => r.channel === channel).length;
  const base = CHANNELS.find((c) => c.key === channel)?.base ?? "/magazine";

  return (
    <div className="mt-6 space-y-4">
      {/* 코너 고르기 */}
      <div className="flex flex-wrap items-center gap-2">
        {CHANNELS.map((c) => (
          <button
            key={c.key}
            onClick={() => setChannel(c.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
              channel === c.key
                ? "bg-oddsbag-purple text-white"
                : "border border-oddsbag-light-gray text-oddsbag-gray hover:text-oddsbag-dark"
            }`}
          >
            {c.label}
          </button>
        ))}
        <button
          onClick={() => setEditing(emptyDraft(channel))}
          className="ml-auto rounded-full bg-oddsbag-dark px-5 py-1.5 text-sm font-bold text-white"
        >
          ✍️ 새 글 쓰기
        </button>
        <button
          onClick={load}
          disabled={busy}
          className="rounded-full border border-oddsbag-light-gray px-3 py-1.5 text-sm disabled:opacity-50"
        >
          새로고침
        </button>
      </div>

      {/* 상태별 */}
      <div className="flex flex-wrap gap-1 border-b border-oddsbag-light-gray text-sm font-bold">
        {BUCKETS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setBucket(k)}
            className={`-mb-px border-b-2 px-4 py-2 transition ${
              bucket === k
                ? "border-oddsbag-purple text-oddsbag-purple"
                : "border-transparent text-oddsbag-gray hover:text-oddsbag-dark"
            }`}
          >
            {label} {count(k)}
          </button>
        ))}
      </div>

      {msg && (
        <p className="rounded-lg bg-oddsbag-light-gray/60 p-3 text-sm">{msg}</p>
      )}

      {!data && <p className="text-oddsbag-gray">불러오는 중…</p>}

      {data && rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-oddsbag-light-gray py-10 text-center text-sm text-oddsbag-gray">
          이 칸에는 글이 없습니다.
        </p>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.slug}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-oddsbag-light-gray bg-white px-4 py-3"
          >
            <div className="min-w-[220px] flex-1">
              <a
                href={`${base}/${r.slug}`}
                target="_blank"
                className="block truncate font-bold text-oddsbag-dark hover:text-oddsbag-purple"
                title={r.title}
              >
                {r.featured && "⭐ "}
                {r.hidden && "🙈 "}
                {!r.cover && "🚫 "}
                {r.title}
              </a>
              <span className="text-xs text-oddsbag-gray">
                {r.date} · {r.category}
                {r.quality != null && ` · 품질 ${r.quality}`}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs">
              <Btn onClick={() => openEditor(r.slug)}>수정</Btn>
              {bucket === "published" && (
                <>
                  <Btn onClick={() => act("feature", r.slug)}>대표글</Btn>
                  {r.hidden ? (
                    <Btn onClick={() => act("show", r.slug)}>다시 보이기</Btn>
                  ) : (
                    <Btn onClick={() => act("hide", r.slug)}>숨기기</Btn>
                  )}
                  <Btn
                    onClick={() =>
                      act("unpublish", r.slug, "이 글을 내려서 검수함으로 옮길까요?")
                    }
                  >
                    내리기
                  </Btn>
                </>
              )}
              {bucket === "drafts" && (
                <>
                  <Btn onClick={() => act("publish", r.slug)}>발행</Btn>
                  <Btn onClick={() => act("archive", r.slug)}>보관함으로</Btn>
                </>
              )}
              {bucket === "archived" && (
                <Btn onClick={() => act("restore", r.slug)}>검수함으로</Btn>
              )}
              <Btn
                danger
                onClick={() =>
                  act(
                    "delete",
                    r.slug,
                    `"${r.title}" 을(를) 완전히 지웁니다. 되돌릴 수 없습니다. 진행할까요?`,
                  )
                }
              >
                삭제
              </Btn>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-oddsbag-gray">
        ⭐ 대표글 · 🙈 목록에서 숨김(주소로는 열림) · 🚫 커버 사진 없음
      </p>
    </div>
  );
}

function Btn({
  onClick,
  children,
  danger,
}: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 transition ${
        danger
          ? "border-red-200 text-red-400 hover:border-red-400 hover:text-red-600"
          : "border-oddsbag-light-gray text-oddsbag-gray hover:border-oddsbag-purple hover:text-oddsbag-purple"
      }`}
    >
      {children}
    </button>
  );
}
