"use client";

import { useEffect, useState, useCallback } from "react";
import HomeEditor from "@/components/admin/HomeEditor";
import PostManager from "@/components/admin/PostManager";
import Inbox from "@/components/admin/Inbox";

const NOTION_DB_URL = "https://www.notion.so/39ba021454af81fda095e59a00525be0";

// ---------- 서버에서 받아오는 모양 ----------
interface Row {
  slug: string;
  title: string;
  category: string;
  date: string;
  hidden: boolean;
  cover: boolean;
  quality: number | null;
  fakeRisk: string | null;
  views: number;
  clicks: number;
  impressions: number;
  position: number | null;
}

interface Stats {
  generatedAt: string;
  days: number;
  googleReady: boolean;
  ga4Ready: boolean;
  summary: {
    published: number;
    hidden: number;
    drafts: number;
    totalViews: number;
    noCover: number;
    avgQuality: number | null;
  };
  categoryCounts: Record<string, number>;
  viewDaily: { date: string; views: number }[];
  traffic: {
    daily: { date: string; users: number; pageViews: number }[] | null;
    sources: { label: string; sessions: number }[] | null;
    error: string | null;
  };
  search: {
    totals: { clicks: number; impressions: number; ctr: number; position: number } | null;
    keywords: {
      query: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }[] | null;
    indexedCount: number;
    error: string | null;
  };
  rows: Row[];
  seo: { slug: string; title: string; problems: string[] }[];
}

type Tab = "dash" | "home" | "write" | "posts" | "inbox" | "seo" | "ops";
type SortKey = "views" | "clicks" | "impressions" | "date" | "quality";

const nf = (n: number) => n.toLocaleString("ko-KR");
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [loginMsg, setLoginMsg] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<Tab>("dash");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [sort, setSort] = useState<SortKey>("views");
  const [days, setDays] = useState(28);

  const loadStats = useCallback(async (d: number) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/stats?days=${d}`);
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      setStats(await res.json());
    } catch (e) {
      setMsg(`불러오기 실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, []);

  // 새로고침해도 로그인이 유지되는지 먼저 확인
  useEffect(() => {
    fetch("/api/admin/login")
      .then((r) => r.json())
      .then((d) => setAuthed(Boolean(d.authed)))
      .catch(() => setAuthed(false));
  }, []);

  // 로그인 상태가 되거나 기간을 바꾸면 통계를 다시 부른다.
  // 이펙트 안에서 곧바로 상태를 바꾸면 렌더가 연쇄로 도니 한 박자 뒤로 미룬다.
  useEffect(() => {
    if (!authed) return;
    const t = setTimeout(() => loadStats(days), 0);
    return () => clearTimeout(t);
  }, [authed, days, loadStats]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginMsg("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    const d = await res.json();
    if (!res.ok) {
      setLoginMsg(d.error ?? "로그인 실패");
      return;
    }
    setPw("");
    setAuthed(true);
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
    setStats(null);
  }

  async function post(path: string, body: unknown, working: string) {
    setBusy(true);
    setMsg(working);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      return d;
    } catch (e) {
      setMsg(`오류: ${(e as Error).message}`);
      return null;
    } finally {
      setBusy(false);
    }
  }

  // ---------------- 로그인 화면 ----------------
  if (authed === null) {
    return (
      <main className="flex min-h-screen items-center justify-center text-oddsbag-gray">
        확인 중…
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-oddsbag-light-gray/40 p-4">
        <form
          onSubmit={login}
          className="w-full max-w-sm rounded-2xl border border-oddsbag-light-gray bg-white p-6"
        >
          <h1 className="text-xl font-black text-oddsbag-dark">오즈백 관리자</h1>
          <p className="mt-1 text-sm text-oddsbag-gray">
            관리자 비밀번호를 입력하세요.
          </p>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="비밀번호"
            autoComplete="current-password"
            className="mt-4 w-full rounded-lg border border-oddsbag-light-gray px-3 py-2 outline-none focus:border-oddsbag-purple"
          />
          <button className="mt-3 w-full rounded-lg bg-oddsbag-purple py-2.5 font-bold text-white">
            들어가기
          </button>
          {loginMsg && <p className="mt-3 text-sm text-red-500">{loginMsg}</p>}
          <p className="mt-4 text-xs text-oddsbag-gray">
            로그인은 14일간 유지됩니다.
          </p>
        </form>
      </main>
    );
  }

  // ---------------- 관리자 본화면 ----------------
  const s = stats;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-oddsbag-dark">오즈백 관리자</h1>
        <div className="flex items-center gap-2 text-sm">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-oddsbag-light-gray px-2 py-1.5"
          >
            <option value={7}>최근 7일</option>
            <option value={28}>최근 28일</option>
            <option value={90}>최근 90일</option>
          </select>
          <button
            onClick={() => loadStats(days)}
            disabled={busy}
            className="rounded-lg border border-oddsbag-light-gray px-3 py-1.5 disabled:opacity-50"
          >
            {busy ? "불러오는 중…" : "새로고침"}
          </button>
          <button onClick={logout} className="rounded-lg px-3 py-1.5 text-oddsbag-gray">
            로그아웃
          </button>
        </div>
      </div>

      {/* 탭 */}
      <nav className="mt-5 flex gap-1 border-b border-oddsbag-light-gray text-sm font-bold">
        {(
          [
            ["dash", "📊 유입 현황"],
            ["home", "🏠 메인화면"],
            ["write", "✍️ 글 관리"],
            ["posts", "📄 게시물 성과"],
            ["inbox", "📬 문의함"],
            ["seo", "🔍 SEO 점검"],
            ["ops", "⚙️ 운영"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2.5 transition ${
              tab === k
                ? "border-oddsbag-purple text-oddsbag-purple"
                : "border-transparent text-oddsbag-gray hover:text-oddsbag-dark"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {msg && (
        <p className="mt-4 rounded-lg bg-oddsbag-light-gray/60 p-3 text-sm text-oddsbag-dark">
          {msg}
        </p>
      )}

      {/* 메인화면 편집·글 관리·문의함은 통계와 상관없이 바로 열린다 */}
      {tab === "home" && <HomeEditor />}
      {tab === "write" && <PostManager />}
      {tab === "inbox" && <Inbox />}

      {!s && tab !== "home" && tab !== "write" && tab !== "inbox" && (
        <p className="mt-8 text-oddsbag-gray">불러오는 중…</p>
      )}

      {s && tab === "dash" && <Dashboard s={s} />}
      {s && tab === "posts" && (
        <Posts s={s} sort={sort} setSort={setSort} />
      )}
      {s && tab === "seo" && <Seo s={s} />}
      {s && tab === "ops" && (
        <Ops
          busy={busy}
          onCollect={async () => {
            const d = await post(
              "/api/admin/collect",
              { limit: 5 },
              "수집 중… 이슈를 모아 AI가 초안을 써서 노션 수집함에 넣습니다. (1~2분)",
            );
            if (d) setMsg(`✅ 노션 수집함에 ${d.created?.length ?? 0}건 추가 (스캔 ${d.scanned}건).`);
          }}
          onSync={async () => {
            const d = await post("/api/admin/sync", {}, "노션 → 홈페이지 동기화 중…");
            if (d) {
              setMsg(`✅ ${d.synced?.length ?? 0}건 홈페이지에 반영됨.`);
              loadStats(days);
            }
          }}
        />
      )}
    </main>
  );
}

// ---------------- 유입 현황 ----------------
function Dashboard({ s }: { s: Stats }) {
  const maxSess = Math.max(1, ...(s.traffic.sources ?? []).map((x) => x.sessions));
  const maxDaily = Math.max(1, ...s.viewDaily.map((d) => d.views));

  return (
    <div className="mt-6 space-y-8">
      {/* 요약 카드 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="발행글" value={nf(s.summary.published)} sub={`검수함 ${s.summary.drafts}건 대기`} />
        <Card
          label="누적 조회수 (우리 집계)"
          value={nf(s.summary.totalViews)}
          sub="오즈백이 직접 세는 숫자"
        />
        <Card
          label={`검색 유입 (${s.days}일)`}
          value={s.search.totals ? nf(s.search.totals.clicks) : "—"}
          sub={
            s.search.totals
              ? `노출 ${nf(s.search.totals.impressions)}회 · 평균 ${s.search.totals.position.toFixed(1)}위`
              : "서치콘솔 연결 대기"
          }
        />
        <Card
          label="구글 색인된 글"
          value={s.search.indexedCount ? nf(s.search.indexedCount) : "—"}
          sub={
            s.search.indexedCount
              ? `전체 ${s.summary.published}개 중`
              : "아직 검색 데이터 없음"
          }
        />
      </div>

      {/* 구글 연결 안내 */}
      {(!s.googleReady || s.traffic.error || s.search.error) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-bold text-amber-900">
            {!s.googleReady
              ? "구글 서비스 계정이 아직 연결되지 않았습니다."
              : "구글 데이터를 가져오다 문제가 생겼습니다."}
          </p>
          <p className="mt-1 text-amber-800">
            {!s.googleReady
              ? "연결 전까지 방문자 수·유입 경로·검색 키워드는 비어 있습니다. 조회수는 우리가 직접 세므로 정상 표시됩니다."
              : (s.traffic.error ?? s.search.error)}
          </p>
        </div>
      )}

      {/* 유입 경로 */}
      <section>
        <h2 className="text-lg font-black text-oddsbag-dark">
          어디로 들어왔나 <span className="text-sm font-normal text-oddsbag-gray">최근 {s.days}일</span>
        </h2>
        {s.traffic.sources?.length ? (
          <div className="mt-3 space-y-2">
            {s.traffic.sources.map((x) => (
              <div key={x.label} className="flex items-center gap-3">
                <span className="w-44 shrink-0 truncate text-sm text-oddsbag-dark">
                  {x.label}
                </span>
                <div className="h-6 flex-1 overflow-hidden rounded bg-oddsbag-light-gray/50">
                  <div
                    className="h-full rounded bg-oddsbag-purple"
                    style={{ width: `${(x.sessions / maxSess) * 100}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-sm font-bold text-oddsbag-dark">
                  {nf(x.sessions)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-oddsbag-gray">
            아직 데이터가 없습니다. 애널리틱스는 설치 시점부터 쌓이고, 첫 데이터가 보이기까지
            하루 정도 걸립니다.
          </p>
        )}
      </section>

      {/* 조회수 추이 */}
      <section>
        <h2 className="text-lg font-black text-oddsbag-dark">
          하루 조회수 <span className="text-sm font-normal text-oddsbag-gray">최근 14일 · 우리 집계</span>
        </h2>
        <div className="mt-3 flex h-32 items-end gap-1">
          {s.viewDaily.map((d) => (
            <div key={d.date} className="group relative flex-1">
              <div
                className="w-full rounded-t bg-oddsbag-purple/80"
                style={{ height: `${Math.max(2, (d.views / maxDaily) * 120)}px` }}
              />
              <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-oddsbag-dark px-1.5 py-0.5 text-[11px] text-white group-hover:block">
                {d.date.slice(5)} · {nf(d.views)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-oddsbag-gray">
          <span>{s.viewDaily[0]?.date.slice(5)}</span>
          <span>{s.viewDaily.at(-1)?.date.slice(5)}</span>
        </div>
      </section>

      {/* 검색 키워드 */}
      <section>
        <h2 className="text-lg font-black text-oddsbag-dark">
          어떤 검색어로 들어왔나{" "}
          <span className="text-sm font-normal text-oddsbag-gray">구글 · 최근 {s.days}일</span>
        </h2>
        {s.search.keywords?.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs text-oddsbag-gray">
                <tr className="border-b border-oddsbag-light-gray">
                  <th className="py-2">검색어</th>
                  <th className="py-2 text-right">클릭</th>
                  <th className="py-2 text-right">노출</th>
                  <th className="py-2 text-right">클릭률</th>
                  <th className="py-2 text-right">평균 순위</th>
                </tr>
              </thead>
              <tbody>
                {s.search.keywords.map((k) => (
                  <tr key={k.query} className="border-b border-oddsbag-light-gray/60">
                    <td className="py-2 font-medium text-oddsbag-dark">{k.query}</td>
                    <td className="py-2 text-right font-bold">{nf(k.clicks)}</td>
                    <td className="py-2 text-right text-oddsbag-gray">{nf(k.impressions)}</td>
                    <td className="py-2 text-right text-oddsbag-gray">{pct(k.ctr)}</td>
                    <td className="py-2 text-right text-oddsbag-gray">
                      {k.position.toFixed(1)}위
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-oddsbag-gray">
            아직 검색 데이터가 없습니다. 서치콘솔은 등록 후 2~3일이 지나야 숫자가 나옵니다.
          </p>
        )}
      </section>

      {/* 카테고리 분포 */}
      <section>
        <h2 className="text-lg font-black text-oddsbag-dark">카테고리 분포</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(s.categoryCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([c, n]) => (
              <span
                key={c}
                className="rounded-full bg-oddsbag-light-gray/70 px-3 py-1 text-sm text-oddsbag-dark"
              >
                {c} <b>{n}</b>
              </span>
            ))}
        </div>
      </section>
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-oddsbag-light-gray bg-white p-4">
      <div className="text-xs text-oddsbag-gray">{label}</div>
      <div className="mt-1 text-2xl font-black text-oddsbag-dark">{value}</div>
      {sub && <div className="mt-1 text-xs text-oddsbag-gray">{sub}</div>}
    </div>
  );
}

// ---------------- 게시물 표 ----------------
function Posts({
  s,
  sort,
  setSort,
}: {
  s: Stats;
  sort: SortKey;
  setSort: (k: SortKey) => void;
}) {
  const rows = [...s.rows].sort((a, b) => {
    if (sort === "date") return b.date.localeCompare(a.date);
    if (sort === "quality") return (b.quality ?? 0) - (a.quality ?? 0);
    return (b[sort] as number) - (a[sort] as number);
  });

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-oddsbag-gray">정렬:</span>
        {(
          [
            ["views", "조회수"],
            ["clicks", "검색 클릭"],
            ["impressions", "검색 노출"],
            ["date", "최신순"],
            ["quality", "품질점수"],
          ] as [SortKey, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className={`rounded-full px-3 py-1 ${
              sort === k
                ? "bg-oddsbag-purple text-white"
                : "border border-oddsbag-light-gray text-oddsbag-gray"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-oddsbag-gray">전체 {rows.length}개</span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs text-oddsbag-gray">
            <tr className="border-b border-oddsbag-light-gray">
              <th className="py-2">제목</th>
              <th className="py-2">분류</th>
              <th className="py-2">발행일</th>
              <th className="py-2 text-right">조회수</th>
              <th className="py-2 text-right">검색 클릭</th>
              <th className="py-2 text-right">검색 노출</th>
              <th className="py-2 text-right">순위</th>
              <th className="py-2 text-right">품질</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} className="border-b border-oddsbag-light-gray/60">
                <td className="max-w-[280px] py-2">
                  <a
                    href={`/magazine/${r.slug}`}
                    target="_blank"
                    className="block truncate font-medium text-oddsbag-dark hover:text-oddsbag-purple"
                    title={r.title}
                  >
                    {!r.cover && "🚫 "}
                    {r.hidden && "🙈 "}
                    {r.title}
                  </a>
                </td>
                <td className="py-2 text-oddsbag-gray">{r.category}</td>
                <td className="py-2 text-oddsbag-gray">{r.date}</td>
                <td className="py-2 text-right font-bold text-oddsbag-dark">{nf(r.views)}</td>
                <td className="py-2 text-right">{nf(r.clicks)}</td>
                <td className="py-2 text-right text-oddsbag-gray">{nf(r.impressions)}</td>
                <td className="py-2 text-right text-oddsbag-gray">
                  {r.position ? `${r.position.toFixed(0)}위` : "—"}
                </td>
                <td className="py-2 text-right">
                  {r.quality != null ? (
                    <span
                      className={
                        r.quality >= 78
                          ? "text-emerald-600"
                          : r.quality >= 60
                            ? "text-amber-600"
                            : "text-red-500"
                      }
                    >
                      {r.quality}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-oddsbag-gray">
        🚫 = 커버 사진 없음 · 🙈 = 목록에서 숨김 (주소로는 열림)
      </p>
    </div>
  );
}

// ---------------- SEO 점검 ----------------
function Seo({ s }: { s: Stats }) {
  const counts: Record<string, number> = {};
  for (const it of s.seo) for (const p of it.problems) counts[p] = (counts[p] ?? 0) + 1;

  return (
    <div className="mt-6 space-y-6">
      <div>
        <h2 className="text-lg font-black text-oddsbag-dark">
          문제가 있는 글 {s.seo.length}개 / 전체 {s.summary.published}개
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([p, n]) => (
              <span
                key={p}
                className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-900"
              >
                {p} <b>{n}</b>
              </span>
            ))}
        </div>
      </div>

      <div className="space-y-2">
        {s.seo.slice(0, 100).map((it) => (
          <div
            key={it.slug}
            className="rounded-xl border border-oddsbag-light-gray bg-white px-4 py-3"
          >
            <a
              href={`/magazine/${it.slug}`}
              target="_blank"
              className="text-sm font-medium text-oddsbag-dark hover:text-oddsbag-purple"
            >
              {it.title}
            </a>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {it.problems.map((p) => (
                <span
                  key={p}
                  className="rounded bg-oddsbag-light-gray/70 px-2 py-0.5 text-[11px] text-oddsbag-gray"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        ))}
        {s.seo.length > 100 && (
          <p className="text-sm text-oddsbag-gray">…외 {s.seo.length - 100}개</p>
        )}
      </div>
    </div>
  );
}

// ---------------- 운영 ----------------
function Ops({
  busy,
  onCollect,
  onSync,
}: {
  busy: boolean;
  onCollect: () => void;
  onSync: () => void;
}) {
  return (
    <div className="mt-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          onClick={onCollect}
          disabled={busy}
          className="rounded-2xl bg-oddsbag-purple p-4 text-left text-white transition hover:bg-oddsbag-purple-dark disabled:opacity-50"
        >
          <div className="text-lg font-black">1 · 이슈 수집</div>
          <div className="mt-1 text-xs text-white/80">여러 소스 → AI 초안 → 노션 수집함</div>
        </button>
        <a
          href={NOTION_DB_URL}
          target="_blank"
          className="rounded-2xl border border-oddsbag-light-gray bg-white p-4 transition hover:border-oddsbag-purple"
        >
          <div className="text-lg font-black text-oddsbag-dark">2 · 노션에서 작성</div>
          <div className="mt-1 text-xs text-oddsbag-gray">검토·편집 후 상태를 ‘발행’으로 →</div>
        </a>
        <button
          onClick={onSync}
          disabled={busy}
          className="rounded-2xl border border-oddsbag-light-gray bg-white p-4 text-left transition hover:border-oddsbag-purple disabled:opacity-50"
        >
          <div className="text-lg font-black text-oddsbag-dark">3 · 홈 동기화</div>
          <div className="mt-1 text-xs text-oddsbag-gray">노션 발행글 → 홈페이지 반영</div>
        </button>
      </div>

      <p className="mt-4 text-xs text-oddsbag-gray">
        💡 수집·발행·점검은 자동으로 돌아갑니다. 위 버튼은 수동으로 즉시 실행할 때만 쓰세요.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a
          href="https://analytics.google.com"
          target="_blank"
          className="rounded-xl border border-oddsbag-light-gray bg-white px-4 py-3 text-sm text-oddsbag-dark hover:border-oddsbag-purple"
        >
          📈 구글 애널리틱스 열기
        </a>
        <a
          href="https://search.google.com/search-console"
          target="_blank"
          className="rounded-xl border border-oddsbag-light-gray bg-white px-4 py-3 text-sm text-oddsbag-dark hover:border-oddsbag-purple"
        >
          🔍 구글 서치콘솔 열기
        </a>
      </div>
    </div>
  );
}
