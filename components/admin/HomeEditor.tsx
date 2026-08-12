"use client";

import { useEffect, useState } from "react";
import type { SiteConfig, HomeSection, ServiceCard } from "@/lib/sitecfg";

// 섹션 종류를 사람 말로 (타입 이름을 사장님께 보여주지 않는다)
const SECTION_LABEL: Record<string, string> = {
  featured: "대표글 + 인기글 랭킹",
  latest: "최신 이슈",
  categories: "분야별 묶음",
  "channel-oddsbag": "오즈백 소식",
  "channel-music": "뮤직 소식",
  services: "서비스 카드",
  ad: "광고 자리",
  subscribe: "뉴스레터 구독함",
};

const NEW_SECTIONS: { type: HomeSection["type"]; title: string }[] = [
  { type: "latest", title: "최신 이슈" },
  { type: "categories", title: "분야별로 보기" },
  { type: "channel-oddsbag", title: "오즈백 소식" },
  { type: "channel-music", title: "오즈백 뮤직" },
  { type: "services", title: "오즈백 서비스" },
  { type: "ad", title: "" },
  { type: "subscribe", title: "뉴스레터" },
];

const input =
  "w-full rounded-lg border border-oddsbag-light-gray px-3 py-2 text-sm outline-none focus:border-oddsbag-purple";
const box = "rounded-2xl border border-oddsbag-light-gray bg-white p-5";

export default function HomeEditor() {
  const [cfg, setCfg] = useState<SiteConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/site")
      .then((r) => r.json())
      .then((d) => setCfg(d.config))
      .catch((e) => setMsg(`불러오기 실패: ${(e as Error).message}`));
  }, []);

  async function save(next?: SiteConfig) {
    const body = next ?? cfg;
    if (!body) return;
    setBusy(true);
    setMsg("저장 중…");
    try {
      const res = await fetch("/api/admin/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: body }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setCfg(d.config);
      setMsg("✅ 저장했습니다. 홈페이지에 바로 반영됩니다.");
    } catch (e) {
      setMsg(`오류: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!confirm("메인화면 설정을 처음 상태로 되돌릴까요?")) return;
    setBusy(true);
    const res = await fetch("/api/admin/site", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset: true }),
    });
    const d = await res.json();
    setCfg(d.config);
    setBusy(false);
    setMsg("처음 상태로 되돌렸습니다.");
  }

  if (!cfg) return <p className="mt-8 text-oddsbag-gray">{msg || "불러오는 중…"}</p>;

  const set = (patch: Partial<SiteConfig>) => setCfg({ ...cfg, ...patch });

  // ---- 섹션 조작 ----
  const move = (i: number, dir: -1 | 1) => {
    const list = [...cfg.sections];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set({ sections: list });
  };
  const patchSection = (i: number, patch: Partial<HomeSection>) => {
    const list = [...cfg.sections];
    list[i] = { ...list[i], ...patch };
    set({ sections: list });
  };
  const removeSection = (i: number) =>
    set({ sections: cfg.sections.filter((_, k) => k !== i) });
  const addSection = (type: HomeSection["type"], title: string) =>
    set({
      sections: [
        ...cfg.sections,
        {
          id: `${type}-${cfg.sections.length + 1}`,
          type,
          title,
          enabled: true,
          limit: 4,
        },
      ],
    });

  // ---- 서비스 카드 조작 ----
  const patchService = (i: number, patch: Partial<ServiceCard>) => {
    const list = [...cfg.services];
    list[i] = { ...list[i], ...patch };
    set({ services: list });
  };
  const addService = () =>
    set({
      services: [
        ...cfg.services,
        {
          id: `svc-${Date.now()}`,
          emoji: "✨",
          title: "새 서비스",
          desc: "설명을 적어주세요",
          href: "",
          enabled: true,
        },
      ],
    });

  return (
    <div className="mt-6 space-y-6 pb-24">
      {msg && (
        <p className="rounded-lg bg-oddsbag-light-gray/60 p-3 text-sm text-oddsbag-dark">
          {msg}
        </p>
      )}

      {/* 첫 화면 */}
      <section className={box}>
        <div className="flex items-center justify-between">
          <h2 className="font-black text-oddsbag-dark">1 · 첫 화면 인사말</h2>
          <Toggle
            on={cfg.hero.enabled}
            onChange={(v) => set({ hero: { ...cfg.hero, enabled: v } })}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="작은 윗줄">
            <input
              className={input}
              value={cfg.hero.kicker}
              onChange={(e) => set({ hero: { ...cfg.hero, kicker: e.target.value } })}
            />
          </Field>
          <Field label="모양">
            <select
              className={input}
              value={cfg.hero.style}
              onChange={(e) =>
                set({
                  hero: { ...cfg.hero, style: e.target.value as "brand" | "slim" },
                })
              }
            >
              <option value="brand">큰 배너 (색 배경)</option>
              <option value="slim">얇은 한 줄</option>
            </select>
          </Field>
          <Field label="큰 제목" wide>
            <input
              className={input}
              value={cfg.hero.title}
              onChange={(e) => set({ hero: { ...cfg.hero, title: e.target.value } })}
            />
          </Field>
          <Field label="설명 한두 줄" wide>
            <textarea
              className={`${input} min-h-[70px]`}
              value={cfg.hero.subtitle}
              onChange={(e) => set({ hero: { ...cfg.hero, subtitle: e.target.value } })}
            />
          </Field>
          <Field label="버튼 문구">
            <input
              className={input}
              value={cfg.hero.ctaLabel}
              onChange={(e) => set({ hero: { ...cfg.hero, ctaLabel: e.target.value } })}
            />
          </Field>
          <Field label="버튼 주소">
            <input
              className={input}
              value={cfg.hero.ctaHref}
              onChange={(e) => set({ hero: { ...cfg.hero, ctaHref: e.target.value } })}
            />
          </Field>
          <Field label="배경색 왼쪽">
            <div className="flex gap-2">
              <input
                type="color"
                className="h-9 w-12 rounded border border-oddsbag-light-gray"
                value={cfg.hero.bgFrom}
                onChange={(e) => set({ hero: { ...cfg.hero, bgFrom: e.target.value } })}
              />
              <input
                className={input}
                value={cfg.hero.bgFrom}
                onChange={(e) => set({ hero: { ...cfg.hero, bgFrom: e.target.value } })}
              />
            </div>
          </Field>
          <Field label="배경색 오른쪽">
            <div className="flex gap-2">
              <input
                type="color"
                className="h-9 w-12 rounded border border-oddsbag-light-gray"
                value={cfg.hero.bgTo}
                onChange={(e) => set({ hero: { ...cfg.hero, bgTo: e.target.value } })}
              />
              <input
                className={input}
                value={cfg.hero.bgTo}
                onChange={(e) => set({ hero: { ...cfg.hero, bgTo: e.target.value } })}
              />
            </div>
          </Field>
        </div>
        {/* 미리보기 */}
        <div
          className="mt-4 rounded-xl px-5 py-7"
          style={{
            background: `linear-gradient(135deg, ${cfg.hero.bgFrom}, ${cfg.hero.bgTo})`,
          }}
        >
          <p className="text-[10px] font-black tracking-[0.2em] text-oddsbag-yellow">
            {cfg.hero.kicker}
          </p>
          <p className="mt-2 text-xl font-black text-white" style={{ wordBreak: "keep-all" }}>
            {cfg.hero.title}
          </p>
          <p className="mt-1.5 text-sm text-white/75" style={{ wordBreak: "keep-all" }}>
            {cfg.hero.subtitle}
          </p>
        </div>
      </section>

      {/* 오즈백 소식 게시판 안내 문구 */}
      <section className={box}>
        <h2 className="font-black text-oddsbag-dark">1-2 · 오즈백 소식 페이지 안내 문구</h2>
        <p className="mt-1 text-[13px] text-slate-500">
          &apos;오즈백이 만드는 것들&apos; 제목 아래에 나오는 설명입니다. (/oddsbag)
        </p>
        <div className="mt-4">
          <Field label="안내 문구 (1~2줄)" wide>
            <textarea
              className={`${input} min-h-[70px]`}
              placeholder="예) 오즈백 브랜드의 새 소식을 전하는 곳입니다."
              value={cfg.oddsbag.lead}
              onChange={(e) => set({ oddsbag: { ...cfg.oddsbag, lead: e.target.value } })}
            />
          </Field>
        </div>
      </section>

      {/* 공지 띠 */}
      <section className={box}>
        <div className="flex items-center justify-between">
          <h2 className="font-black text-oddsbag-dark">2 · 맨 위 공지 띠</h2>
          <Toggle
            on={cfg.notice.enabled}
            onChange={(v) => set({ notice: { ...cfg.notice, enabled: v } })}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="문구" wide>
            <input
              className={input}
              placeholder="예) 오즈백 앱 사전예약이 열렸습니다"
              value={cfg.notice.text}
              onChange={(e) => set({ notice: { ...cfg.notice, text: e.target.value } })}
            />
          </Field>
          <Field label="눌렀을 때 갈 주소 (비워도 됨)" wide>
            <input
              className={input}
              placeholder="/services"
              value={cfg.notice.href}
              onChange={(e) => set({ notice: { ...cfg.notice, href: e.target.value } })}
            />
          </Field>
        </div>
      </section>

      {/* 레이아웃 */}
      <section className={box}>
        <h2 className="font-black text-oddsbag-dark">3 · 전체 레이아웃</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="화면 폭">
            <select
              className={input}
              value={cfg.layout.width}
              onChange={(e) =>
                set({
                  layout: {
                    ...cfg.layout,
                    width: e.target.value as "wide" | "narrow",
                  },
                })
              }
            >
              <option value="wide">넓게 (기본)</option>
              <option value="narrow">좁게 (읽기 편하게)</option>
            </select>
          </Field>
          <Field label="카드 한 줄에 몇 개 (큰 화면)">
            <select
              className={input}
              value={cfg.layout.columns}
              onChange={(e) =>
                set({
                  layout: {
                    ...cfg.layout,
                    columns: Number(e.target.value) === 3 ? 3 : 4,
                  },
                })
              }
            >
              <option value={4}>4개</option>
              <option value={3}>3개</option>
            </select>
          </Field>
        </div>
      </section>

      {/* 섹션 순서 */}
      <section className={box}>
        <h2 className="font-black text-oddsbag-dark">4 · 메인에 뭘 어떤 순서로 보여줄까</h2>
        <p className="mt-1 text-xs text-oddsbag-gray">
          ↑↓ 로 순서를 바꾸고, 스위치로 켜고 끕니다.
        </p>
        <div className="mt-4 space-y-2">
          {cfg.sections.map((sec, i) => (
            <div
              key={sec.id + i}
              className={`rounded-xl border p-3 ${
                sec.enabled
                  ? "border-oddsbag-light-gray bg-white"
                  : "border-dashed border-oddsbag-light-gray bg-oddsbag-light-gray/30 opacity-70"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-col">
                  <button
                    onClick={() => move(i, -1)}
                    className="px-1 text-xs text-oddsbag-gray hover:text-oddsbag-purple"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    className="px-1 text-xs text-oddsbag-gray hover:text-oddsbag-purple"
                  >
                    ▼
                  </button>
                </div>
                <span className="rounded-full bg-oddsbag-purple/10 px-2.5 py-1 text-[12px] font-bold text-oddsbag-purple">
                  {SECTION_LABEL[sec.type] ?? sec.type}
                </span>
                <input
                  className="min-w-[140px] flex-1 rounded-lg border border-oddsbag-light-gray px-2.5 py-1.5 text-sm"
                  placeholder="섹션 제목"
                  value={sec.title}
                  onChange={(e) => patchSection(i, { title: e.target.value })}
                />
                {sec.type !== "ad" && sec.type !== "subscribe" && (
                  <label className="flex items-center gap-1 text-xs text-oddsbag-gray">
                    개수
                    <input
                      type="number"
                      min={1}
                      max={24}
                      className="w-16 rounded-lg border border-oddsbag-light-gray px-2 py-1.5 text-sm"
                      value={sec.limit}
                      onChange={(e) =>
                        patchSection(i, { limit: Number(e.target.value) || 4 })
                      }
                    />
                  </label>
                )}
                <Toggle
                  on={sec.enabled}
                  onChange={(v) => patchSection(i, { enabled: v })}
                />
                <button
                  onClick={() => removeSection(i)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  삭제
                </button>
              </div>
              {sec.type !== "ad" && sec.type !== "subscribe" && (
                <input
                  className="mt-2 w-full rounded-lg border border-oddsbag-light-gray px-2.5 py-1.5 text-xs"
                  placeholder="작은 설명 (선택)"
                  value={sec.subtitle ?? ""}
                  onChange={(e) => patchSection(i, { subtitle: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {NEW_SECTIONS.map((n) => (
            <button
              key={n.type}
              onClick={() => addSection(n.type, n.title)}
              className="rounded-full border border-oddsbag-light-gray px-3 py-1.5 text-xs text-oddsbag-gray hover:border-oddsbag-purple hover:text-oddsbag-purple"
            >
              + {SECTION_LABEL[n.type]}
            </button>
          ))}
        </div>
      </section>

      {/* 서비스 카드 */}
      <section className={box}>
        <h2 className="font-black text-oddsbag-dark">5 · 서비스 카드</h2>
        <p className="mt-1 text-xs text-oddsbag-gray">
          메인과 ‘서비스’ 탭에 함께 나옵니다.
        </p>
        <div className="mt-4 space-y-2">
          {cfg.services.map((c, i) => (
            <div
              key={c.id}
              className="grid gap-2 rounded-xl border border-oddsbag-light-gray p-3 sm:grid-cols-[60px_1fr_1fr]"
            >
              <input
                className={input}
                value={c.emoji}
                onChange={(e) => patchService(i, { emoji: e.target.value })}
              />
              <input
                className={input}
                placeholder="이름"
                value={c.title}
                onChange={(e) => patchService(i, { title: e.target.value })}
              />
              <input
                className={input}
                placeholder="주소 (/services 처럼)"
                value={c.href ?? ""}
                onChange={(e) => patchService(i, { href: e.target.value })}
              />
              <input
                className={`${input} sm:col-span-2`}
                placeholder="한 줄 설명"
                value={c.desc}
                onChange={(e) => patchService(i, { desc: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <input
                  className={input}
                  placeholder="뱃지 (예: 출시 준비 중)"
                  value={c.badge ?? ""}
                  onChange={(e) => patchService(i, { badge: e.target.value })}
                />
                <Toggle on={c.enabled} onChange={(v) => patchService(i, { enabled: v })} />
                <button
                  onClick={() =>
                    set({ services: cfg.services.filter((_, k) => k !== i) })
                  }
                  className="shrink-0 text-xs text-red-400 hover:text-red-600"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addService}
          className="mt-3 rounded-full border border-oddsbag-light-gray px-4 py-1.5 text-xs text-oddsbag-gray hover:border-oddsbag-purple hover:text-oddsbag-purple"
        >
          + 서비스 추가
        </button>
      </section>

      {/* 회사 정보 */}
      <section className={box}>
        <h2 className="font-black text-oddsbag-dark">6 · 아래쪽 회사 정보 (푸터)</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="한 줄 슬로건" wide>
            <input
              className={input}
              value={cfg.footer.tagline}
              onChange={(e) => set({ footer: { ...cfg.footer, tagline: e.target.value } })}
            />
          </Field>
          <Field label="회사 소개 (2~3줄)" wide>
            <textarea
              className={`${input} min-h-[80px]`}
              value={cfg.footer.intro}
              onChange={(e) => set({ footer: { ...cfg.footer, intro: e.target.value } })}
            />
          </Field>
          <Field label="상호">
            <input
              className={input}
              value={cfg.footer.company}
              onChange={(e) => set({ footer: { ...cfg.footer, company: e.target.value } })}
            />
          </Field>
          <Field label="대표자">
            <input
              className={input}
              value={cfg.footer.ceo}
              onChange={(e) => set({ footer: { ...cfg.footer, ceo: e.target.value } })}
            />
          </Field>
          <Field label="사업자등록번호">
            <input
              className={input}
              value={cfg.footer.bizNo}
              onChange={(e) => set({ footer: { ...cfg.footer, bizNo: e.target.value } })}
            />
          </Field>
          <Field label="고객센터 번호">
            <input
              className={input}
              value={cfg.footer.phone}
              onChange={(e) => set({ footer: { ...cfg.footer, phone: e.target.value } })}
            />
          </Field>
          <Field label="카카오채널 이름">
            <input
              className={input}
              value={cfg.footer.kakao}
              onChange={(e) => set({ footer: { ...cfg.footer, kakao: e.target.value } })}
            />
          </Field>
          <Field label="주소">
            <input
              className={input}
              value={cfg.footer.address}
              onChange={(e) => set({ footer: { ...cfg.footer, address: e.target.value } })}
            />
          </Field>
          <Field label="대표 메일">
            <input
              className={input}
              value={cfg.footer.email}
              onChange={(e) => set({ footer: { ...cfg.footer, email: e.target.value } })}
            />
          </Field>
          <Field label="인스타그램 주소">
            <input
              className={input}
              value={cfg.footer.instagram}
              onChange={(e) =>
                set({ footer: { ...cfg.footer, instagram: e.target.value } })
              }
            />
          </Field>
          <Field label="페이스북 주소">
            <input
              className={input}
              value={cfg.footer.facebook}
              onChange={(e) =>
                set({ footer: { ...cfg.footer, facebook: e.target.value } })
              }
            />
          </Field>
          <Field label="유튜브 주소">
            <input
              className={input}
              value={cfg.footer.youtube}
              onChange={(e) => set({ footer: { ...cfg.footer, youtube: e.target.value } })}
            />
          </Field>
        </div>
      </section>

      {/* 문의 */}
      <section className={box}>
        <div className="flex items-center justify-between">
          <h2 className="font-black text-oddsbag-dark">7 · 문의 페이지</h2>
          <label className="flex items-center gap-2 text-xs text-oddsbag-gray">
            문의 폼 사용
            <Toggle
              on={cfg.contact.formEnabled}
              onChange={(v) => set({ contact: { ...cfg.contact, formEnabled: v } })}
            />
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="문의 받을 메일">
            <input
              className={input}
              value={cfg.contact.email}
              onChange={(e) => set({ contact: { ...cfg.contact, email: e.target.value } })}
            />
          </Field>
          <Field label="안내 한 줄">
            <input
              className={input}
              value={cfg.contact.lead}
              onChange={(e) => set({ contact: { ...cfg.contact, lead: e.target.value } })}
            />
          </Field>
          <Field label="보내고 나서 보여줄 문구" wide>
            <input
              className={input}
              value={cfg.contact.thanks}
              onChange={(e) => set({ contact: { ...cfg.contact, thanks: e.target.value } })}
            />
          </Field>
        </div>
      </section>

      {/* 저장 바 */}
      <div className="sticky bottom-4 flex items-center gap-2 rounded-2xl border border-oddsbag-light-gray bg-white/95 p-3 shadow-lg backdrop-blur">
        <button
          onClick={() => save()}
          disabled={busy}
          className="rounded-full bg-oddsbag-purple px-6 py-2.5 font-black text-white disabled:opacity-50"
        >
          {busy ? "저장 중…" : "저장하고 홈페이지에 반영"}
        </button>
        <a
          href="/"
          target="_blank"
          className="rounded-full border border-oddsbag-light-gray px-4 py-2.5 text-sm text-oddsbag-dark"
        >
          홈페이지 열어보기
        </a>
        <button
          onClick={reset}
          disabled={busy}
          className="ml-auto text-xs text-oddsbag-gray hover:text-red-500"
        >
          처음 상태로 되돌리기
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : undefined}>
      <span className="mb-1 block text-xs font-bold text-oddsbag-gray">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${
        on ? "bg-oddsbag-purple" : "bg-oddsbag-light-gray"
      }`}
      aria-pressed={on}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white transition ${
          on ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}
