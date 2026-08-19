"use client";

import { useCallback, useRef, useState } from "react";
import { buildEbookHtml } from "@/lib/ebook";
import {
  QUALITY_PRESETS,
  collectImages,
  renderImages,
  renderPdf,
  fmtBytes,
  type Progress,
  type RenderedPage,
} from "@/lib/ebook-render";

// 이북 제작기 — PDF·이미지·ZIP 을 «넘겨 보는 HTML 한 장»으로.
//  ★파일은 서버로 올라가지 않는다. 전부 이 브라우저 안에서 만든다.
//    링크로 만들 때만 «완성된 이북» 한 장이 올라간다.

// HTML 링크 생성기의 한 건 상한과 같은 값 (app/api/htmllink/upload/route.ts)
const LINK_MAX = 5 * 1024 * 1024;

type Phase = "idle" | "working" | "done";

export default function EbookClient() {
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [preset, setPreset] = useState<keyof typeof QUALITY_PRESETS>("normal");
  const [rtl, setRtl] = useState(false);
  const [spread, setSpread] = useState(true);

  const [phase, setPhase] = useState<Phase>("idle");
  const [prog, setProg] = useState<Progress>({ done: 0, total: 0, note: "" });
  const [err, setErr] = useState("");
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [html, setHtml] = useState("");
  const [link, setLink] = useState("");
  const [linking, setLinking] = useState(false);
  const [drag, setDrag] = useState(false);

  const abort = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const bookTitle = title.trim() || files[0]?.name.replace(/\.[a-z0-9]+$/i, "") || "이북";

  const reset = () => {
    setPhase("idle");
    setPages([]);
    setHtml("");
    setLink("");
    setErr("");
  };

  const addFiles = useCallback((list: FileList | null) => {
    if (!list?.length) return;
    setFiles(Array.from(list));
    reset();
  }, []);

  async function build() {
    setErr("");
    setLink("");
    setPhase("working");
    setProg({ done: 0, total: 0, note: "준비하는 중…" });
    const ac = new AbortController();
    abort.current = ac;

    try {
      const q = QUALITY_PRESETS[preset];
      const pdf = files.find((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");

      let made: RenderedPage[];
      if (pdf) {
        if (files.length > 1) {
          throw new Error("PDF 는 한 번에 한 개만 만들 수 있습니다. PDF 하나만 남겨 주세요.");
        }
        made = await renderPdf(pdf, q, setProg, ac.signal);
      } else {
        setProg({ done: 0, total: 0, note: "그림을 모으는 중…" });
        const imgs = await collectImages(files);
        if (!imgs.length) {
          throw new Error("PDF·이미지·ZIP 중 하나를 올려 주세요.");
        }
        made = await renderImages(imgs, q, setProg, ac.signal);
      }

      const out = buildEbookHtml({
        title: bookTitle,
        pages: made,
        direction: rtl ? "rtl" : "ltr",
        spread,
      });
      setPages(made);
      setHtml(out);
      setPhase("done");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
      setPhase("idle");
    } finally {
      abort.current = null;
    }
  }

  function download() {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${bookTitle.replace(/[\\/:*?"<>|]/g, "_")}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function makeLink() {
    setLinking(true);
    setErr("");
    try {
      // 자료함 쿠키가 없으면 먼저 받는다 (HTML 링크 생성기와 같은 방식)
      await fetch("/api/htmllink/login");
      const fd = new FormData();
      fd.set("title", bookTitle);
      fd.set("html", html);
      const res = await fetch("/api/htmllink/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "링크 만들기에 실패했습니다.");
        return;
      }
      const code = String(data.id);
      const pretty = code.length === 16 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
      setLink(`${location.origin}/service/html-link/${pretty}`);
    } catch {
      setErr("링크 만들기에 실패했습니다. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setLinking(false);
    }
  }

  function preview() {
    const w = window.open("", "_blank");
    if (!w) {
      setErr("팝업이 막혔습니다. 주소창 오른쪽에서 팝업을 허용해 주세요.");
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  const bytes = new Blob([html]).size;
  const overLimit = bytes > LINK_MAX;
  const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <div className="text-4xl" aria-hidden>
          📚
        </div>
        <h1 className="mt-3 text-[26px] font-black text-oddsbag-dark sm:text-[32px]" style={{ letterSpacing: "-0.03em", wordBreak: "keep-all" }}>
          이북 제작기
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-oddsbag-gray" style={{ wordBreak: "keep-all" }}>
          PDF나 이미지(압축파일도 됩니다)를 올리면 <b className="text-oddsbag-dark">넘겨 보는 전자책</b>으로 만들어
          드립니다. 만들어진 건 HTML 한 장이라 어디서든 열리고, 링크로 만들어 보낼 수도 있습니다.
        </p>
        <p className="mt-2 text-[13px] text-oddsbag-gray">
          🔒 올린 파일은 <b>서버로 가지 않습니다.</b> 이 브라우저 안에서만 만듭니다.
        </p>
      </div>

      {/* ① 파일 고르기 */}
      <section className="rounded-2xl border border-oddsbag-light-gray bg-white p-5">
        <h2 className="text-[15px] font-black text-oddsbag-dark">① 무엇으로 만들까요</h2>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`mt-3 cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
            drag ? "border-oddsbag-purple bg-oddsbag-purple/5" : "border-oddsbag-light-gray hover:border-oddsbag-purple"
          }`}
        >
          <div className="text-3xl" aria-hidden>
            {files.length ? "📄" : "⬆️"}
          </div>
          {files.length ? (
            <>
              <p className="mt-2 text-sm font-bold text-oddsbag-dark">
                {files.length === 1 ? files[0].name : `${files.length}개 골랐습니다`}
              </p>
              <p className="mt-1 text-xs text-oddsbag-gray">
                모두 {fmtBytes(files.reduce((a, f) => a + f.size, 0))} · 눌러서 다시 고르기
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm font-bold text-oddsbag-dark">
                여기로 끌어다 놓거나 눌러서 고르세요
              </p>
              <p className="mt-1 text-xs text-oddsbag-gray">
                PDF · 사진(JPG·PNG·WEBP) · 사진이 든 ZIP
              </p>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf,image/*,.zip,application/zip"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </section>

      {/* ② 설정 */}
      <section className="mt-4 rounded-2xl border border-oddsbag-light-gray bg-white p-5">
        <h2 className="text-[15px] font-black text-oddsbag-dark">② 어떻게 만들까요</h2>

        <label className="mt-4 block text-[13px] font-bold text-oddsbag-dark">제목</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={files[0]?.name.replace(/\.[a-z0-9]+$/i, "") || "예) 2026 상품 안내서"}
          className="mt-1.5 w-full rounded-lg border border-oddsbag-light-gray px-3 py-2.5 text-sm outline-none focus:border-oddsbag-purple"
        />

        <p className="mt-5 text-[13px] font-bold text-oddsbag-dark">화질</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(Object.keys(QUALITY_PRESETS) as (keyof typeof QUALITY_PRESETS)[]).map((k) => {
            const p = QUALITY_PRESETS[k];
            const on = preset === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setPreset(k);
                  reset();
                }}
                className={`rounded-xl border p-3 text-left transition ${
                  on ? "border-oddsbag-purple bg-oddsbag-purple/5" : "border-oddsbag-light-gray hover:border-oddsbag-purple/50"
                }`}
              >
                <span className={`block text-sm font-black ${on ? "text-oddsbag-purple" : "text-oddsbag-dark"}`}>
                  {p.label}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-oddsbag-gray" style={{ wordBreak: "keep-all" }}>
                  {p.hint}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
          <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-oddsbag-dark">
            <input type="checkbox" checked={spread} onChange={(e) => setSpread(e.target.checked)} className="h-4 w-4 accent-oddsbag-purple" />
            넓은 화면에서 두 쪽씩 펼쳐 보기
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-oddsbag-dark">
            <input type="checkbox" checked={rtl} onChange={(e) => setRtl(e.target.checked)} className="h-4 w-4 accent-oddsbag-purple" />
            오른쪽에서 왼쪽으로 넘김 <span className="text-oddsbag-gray">(만화·세로쓰기)</span>
          </label>
        </div>
      </section>

      {/* ③ 만들기 */}
      <div className="mt-5">
        <button
          type="button"
          onClick={build}
          disabled={!files.length || phase === "working"}
          className="w-full rounded-xl bg-oddsbag-purple px-5 py-3.5 text-[15px] font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {phase === "working" ? "만드는 중…" : "이북 만들기"}
        </button>

        {phase === "working" && (
          <div className="mt-3 rounded-xl border border-oddsbag-light-gray bg-white p-4">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-bold text-oddsbag-dark">{prog.note}</span>
              <span className="text-oddsbag-gray">
                {prog.total ? `${prog.done} / ${prog.total}` : ""}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-oddsbag-light-gray">
              <div className="h-full rounded-full bg-oddsbag-purple transition-all" style={{ width: `${pct}%` }} />
            </div>
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              className="mt-3 text-[12.5px] font-bold text-oddsbag-gray hover:text-oddsbag-dark"
            >
              그만두기
            </button>
          </div>
        )}

        {err && (
          <p className="mt-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-700" style={{ wordBreak: "keep-all" }}>
            {err}
          </p>
        )}
      </div>

      {/* ④ 결과 */}
      {phase === "done" && (
        <section className="mt-5 rounded-2xl border-2 border-oddsbag-purple bg-white p-5">
          <h2 className="text-[15px] font-black text-oddsbag-dark">
            ✅ {pages.length}쪽짜리 이북이 만들어졌습니다
          </h2>
          <p className="mt-1 text-[13px] text-oddsbag-gray">
            파일 크기 <b className="text-oddsbag-dark">{fmtBytes(bytes)}</b>
            {overLimit && <span className="text-red-600"> · 링크로 만들기에는 큽니다(5MB 넘음)</span>}
          </p>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {pages.slice(0, 12).map((p, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={i}
                src={p.src}
                alt={`${i + 1}쪽 미리보기`}
                className="h-24 w-auto flex-none rounded border border-oddsbag-light-gray bg-white"
              />
            ))}
            {pages.length > 12 && (
              <div className="flex h-24 flex-none items-center px-3 text-[12px] font-bold text-oddsbag-gray">
                +{pages.length - 12}쪽
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button type="button" onClick={preview} className="rounded-xl border border-oddsbag-light-gray px-4 py-3 text-sm font-black text-oddsbag-dark hover:border-oddsbag-purple">
              👀 열어보기
            </button>
            <button type="button" onClick={download} className="rounded-xl border border-oddsbag-light-gray px-4 py-3 text-sm font-black text-oddsbag-dark hover:border-oddsbag-purple">
              ⬇️ 파일로 받기
            </button>
            <button
              type="button"
              onClick={makeLink}
              disabled={overLimit || linking || !!link}
              className="rounded-xl bg-oddsbag-purple px-4 py-3 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {linking ? "만드는 중…" : link ? "링크 만들었습니다" : "🔗 링크로 만들기"}
            </button>
          </div>

          {overLimit && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-900" style={{ wordBreak: "keep-all" }}>
              링크로 보내려면 5MB 이하여야 합니다. <b>화질을 「가볍게」로 바꿔서 다시 만들거나</b>,
              쪽수를 나눠 두 권으로 만들어 보세요. 파일로 받는 것은 지금도 됩니다.
            </p>
          )}

          {link && (
            <div className="mt-3 rounded-xl bg-oddsbag-light-gray/60 p-3.5">
              <p className="text-[12px] font-bold text-oddsbag-gray">이 주소를 보내시면 됩니다</p>
              <div className="mt-1.5 flex items-center gap-2">
                <input readOnly value={link} className="min-w-0 flex-1 rounded-lg border border-oddsbag-light-gray bg-white px-3 py-2 text-[13px]" />
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(link)}
                  className="flex-none rounded-lg bg-oddsbag-dark px-3.5 py-2 text-[13px] font-black text-white"
                >
                  복사
                </button>
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-oddsbag-gray" style={{ wordBreak: "keep-all" }}>
                이 자료는 <b>내 자료함</b>(HTML 링크 생성기)에도 들어갑니다. 지우고 싶으면 거기서 지우시면 됩니다.
                주소를 모르는 사람은 열 수 없고, 검색에도 걸리지 않습니다.
              </p>
            </div>
          )}
        </section>
      )}

      {/* 도움말 */}
      <section className="mt-8 rounded-2xl bg-oddsbag-light-gray/40 p-5">
        <h2 className="text-[14px] font-black text-oddsbag-dark">이럴 때 씁니다</h2>
        <ul className="mt-2.5 space-y-1.5 text-[13.5px] leading-relaxed text-oddsbag-gray" style={{ wordBreak: "keep-all" }}>
          <li>· 카탈로그·제안서 PDF를 <b className="text-oddsbag-dark">링크 하나로</b> 보낼 때 (상대가 PDF를 안 받아도 됨)</li>
          <li>· 스캔한 사진 묶음을 <b className="text-oddsbag-dark">책처럼 넘겨 보게</b> 만들 때</li>
          <li>· 만화·그림책처럼 <b className="text-oddsbag-dark">쪽 순서가 있는</b> 이미지 묶음</li>
        </ul>
        <p className="mt-3 text-[12.5px] leading-relaxed text-oddsbag-gray" style={{ wordBreak: "keep-all" }}>
          한 번에 300쪽까지 만들 수 있습니다. 그보다 많으면 나눠서 만들어 주세요.
          쪽이 많을수록 파일이 커지니, 링크로 보내실 거면 「가볍게」를 고르시는 편이 좋습니다.
        </p>
      </section>
    </div>
  );
}
