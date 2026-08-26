"use client";

import { useCallback, useRef, useState } from "react";
import { makeZip } from "@/lib/zip";
import {
  fitLongest,
  scaleBy,
  humanBytes,
  savedPercent,
  outName,
  type Size,
} from "@/lib/imagetool";

// 사진 줄이기 — 무거운 사진을 «올릴 수 있는 크기»로 바꾼다.
//  ★사진은 서버로 가지 않는다. 캔버스로 브라우저 안에서만 다시 그린다.
//  ★계산(몇 점으로 줄일지·이름을 어떻게 지을지)은 lib/imagetool.ts 에 갈라 뒀다.
//    거기는 서버 없이 시험할 수 있다 — scripts/시험/사진도구-시험.mjs

type 형식 = "jpeg" | "webp" | "png";
type 방식 = "longest" | "percent" | "none";

const 형식이름: Record<형식, { label: string; ext: string; hint: string }> = {
  jpeg: { label: "JPG", ext: "jpg", hint: "어디서나 열립니다. 사진에 가장 무난합니다" },
  webp: { label: "WebP", ext: "webp", hint: "같은 화질에 더 가볍습니다. 요즘 브라우저는 다 열립니다" },
  png: { label: "PNG", ext: "png", hint: "글자·도형이 또렷합니다. 대신 사진은 무거워집니다" },
};

const 긴변후보 = [640, 1080, 1280, 1600, 1920, 2560];

interface 결과 {
  key: string;
  이름: string;
  원본이름: string;
  전: number;
  후: number;
  크기: Size;
  원본크기: Size;
  blob: Blob;
  미리보기: string;
}

const 이미지인가 = (f: File) =>
  /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(f.name);

export default function ImageClient() {
  const [files, setFiles] = useState<File[]>([]);
  const [형, set형] = useState<형식>("jpeg");
  const [화질, set화질] = useState(80);
  const [방식, set방식] = useState<방식>("longest");
  const [긴변, set긴변] = useState(1600);
  const [비율, set비율] = useState(50);
  const [결과들, set결과들] = useState<결과[]>([]);
  const [건너뛴것, set건너뛴것] = useState<{ name: string; why: string }[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const 담기 = useCallback((list: FileList | File[] | null) => {
    const 고른것 = list ? Array.from(list) : [];
    if (!고른것.length) return;
    setErr("");
    const 쓸것 = 고른것.filter(이미지인가);
    const 뺀것 = 고른것
      .filter((f) => !이미지인가(f))
      .map((f) => ({ name: f.name, why: "사진 파일이 아닙니다" }));
    set건너뛴것(뺀것);
    if (!쓸것.length) {
      setErr("사진 파일을 못 찾았습니다. JPG·PNG·WebP·HEIC 을 골라 주세요.");
      return;
    }
    // 결과를 지울 때 미리보기 주소도 반납한다 — 안 그러면 메모리가 샌다
    set결과들((옛) => {
      for (const r of 옛) URL.revokeObjectURL(r.미리보기);
      return [];
    });
    setFiles(쓸것);
  }, []);

  async function 줄이기() {
    if (!files.length) return;
    setBusy("여는 중…");
    setErr("");
    const 나온것: 결과[] = [];
    const 못한것: { name: string; why: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setBusy(`${i + 1}/${files.length} — ${f.name}`);
      try {
        // createImageBitmap 은 HEIC 을 못 여는 브라우저가 있다. 못 열면 그 장만 건너뛴다.
        const bmp = await createImageBitmap(f);
        const 원본크기 = { w: bmp.width, h: bmp.height };
        const 목표 =
          방식 === "longest"
            ? fitLongest(원본크기, 긴변)
            : 방식 === "percent"
              ? scaleBy(원본크기, 비율)
              : 원본크기;

        const cv = document.createElement("canvas");
        cv.width = 목표.w;
        cv.height = 목표.h;
        const ctx = cv.getContext("2d");
        if (!ctx) throw new Error("no ctx");
        // JPG 는 투명을 모른다 — 흰 바탕을 깔지 않으면 투명한 곳이 검게 나온다
        if (형 === "jpeg") {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, 목표.w, 목표.h);
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bmp, 0, 0, 목표.w, 목표.h);
        bmp.close?.();

        const blob = await new Promise<Blob | null>((res) =>
          cv.toBlob(res, `image/${형}`, 형 === "png" ? undefined : 화질 / 100),
        );
        if (!blob) throw new Error("no blob");

        나온것.push({
          key: `${f.name}-${i}`,
          이름: outName(f.name, 형식이름[형].ext, i),
          원본이름: f.name,
          전: f.size,
          후: blob.size,
          크기: 목표,
          원본크기,
          blob,
          미리보기: URL.createObjectURL(blob),
        });
      } catch {
        못한것.push({ name: f.name, why: "이 브라우저가 못 여는 형식입니다" });
      }
    }

    set결과들(나온것);
    set건너뛴것((옛) => [...옛, ...못한것]);
    setBusy("");
    if (!나온것.length) setErr("한 장도 못 바꿨습니다. 다른 형식으로 저장한 사진을 올려 보세요.");
  }

  function 한장받기(r: 결과) {
    const a = document.createElement("a");
    a.href = r.미리보기;
    a.download = r.이름;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function 묶어받기() {
    if (!결과들.length) return;
    setBusy("묶는 중…");
    try {
      const 이름쓴것 = new Map<string, number>();
      const files2 = await Promise.all(
        결과들.map(async (r) => {
          // 원본 이름이 겹치면 뒤엣것이 앞엣것을 덮어쓴다 — 번호를 붙여 피한다
          const n = (이름쓴것.get(r.이름) ?? 0) + 1;
          이름쓴것.set(r.이름, n);
          const 이름 = n === 1 ? r.이름 : r.이름.replace(/(\.[^.]+)$/, `_${n}$1`);
          return { name: 이름, data: new Uint8Array(await r.blob.arrayBuffer()) };
        }),
      );
      const zip = makeZip(files2);
      const url = URL.createObjectURL(zip);
      const a = document.createElement("a");
      a.href = url;
      a.download = `사진_줄인것_${결과들.length}장.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally {
      setBusy("");
    }
  }

  const 전체전 = 결과들.reduce((a, r) => a + r.전, 0);
  const 전체후 = 결과들.reduce((a, r) => a + r.후, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <div className="text-4xl" aria-hidden>
          🖼
        </div>
        <h1
          className="mt-3 text-[26px] font-black text-oddsbag-dark sm:text-[32px]"
          style={{ letterSpacing: "-0.03em", wordBreak: "keep-all" }}
        >
          사진 줄이기
        </h1>
        <p
          className="mt-3 text-[15px] leading-relaxed text-oddsbag-gray"
          style={{ wordBreak: "keep-all" }}
        >
          「파일이 너무 큽니다」로 막혔을 때 씁니다. 사진을{" "}
          <b className="text-oddsbag-dark">한꺼번에 가볍게</b> 만들고, 형식도 바꿔
          드립니다. 여러 장이면 압축파일 하나로 받으실 수 있습니다.
        </p>
        <p className="mt-2 text-[13px] text-oddsbag-gray">
          🔒 사진은 <b>서버로 가지 않습니다.</b> 이 브라우저 안에서만 다시 그립니다.
        </p>
      </div>

      {/* ① 사진 고르기 */}
      <section className="rounded-2xl border border-oddsbag-light-gray bg-white p-5">
        <h2 className="text-[15px] font-black text-oddsbag-dark">① 사진을 고르세요</h2>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            담기(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`mt-3 cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
            drag
              ? "border-oddsbag-purple bg-oddsbag-purple/5"
              : "border-oddsbag-light-gray hover:border-oddsbag-purple"
          }`}
        >
          <div className="text-3xl" aria-hidden>
            {files.length ? "🖼" : "⬆️"}
          </div>
          {files.length ? (
            <>
              <p className="mt-2 text-sm font-bold text-oddsbag-dark">
                {files.length === 1 ? files[0].name : `${files.length}장 골랐습니다`}
              </p>
              <p className="mt-1 text-xs text-oddsbag-gray">
                모두 {humanBytes(files.reduce((a, f) => a + f.size, 0))} · 눌러서 다시 고르기
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm font-bold text-oddsbag-dark">
                여기로 끌어다 놓거나 눌러서 고르세요
              </p>
              <p className="mt-1 text-xs text-oddsbag-gray">
                JPG · PNG · WebP · HEIC · 여러 장 한꺼번에
              </p>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => 담기(e.target.files)}
        />
      </section>

      {/* ② 어떻게 줄일까 */}
      <section className="mt-4 rounded-2xl border border-oddsbag-light-gray bg-white p-5">
        <h2 className="text-[15px] font-black text-oddsbag-dark">② 어떻게 줄일까요</h2>

        <p className="mt-4 text-[13px] font-bold text-oddsbag-dark">크기</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["longest", "긴 변을 맞춤"],
              ["percent", "비율로 줄임"],
              ["none", "크기는 그대로"],
            ] as [방식, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => set방식(v)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-bold transition ${
                방식 === v
                  ? "bg-oddsbag-purple text-white"
                  : "bg-oddsbag-light-gray text-oddsbag-gray hover:text-oddsbag-dark"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {방식 === "longest" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {긴변후보.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => set긴변(v)}
                className={`rounded-lg border px-2.5 py-1 text-[12.5px] font-bold transition ${
                  긴변 === v
                    ? "border-oddsbag-purple bg-oddsbag-purple/10 text-oddsbag-purple"
                    : "border-oddsbag-light-gray text-oddsbag-gray hover:border-oddsbag-purple"
                }`}
              >
                {v}px
              </button>
            ))}
            <span className="text-[12px] text-oddsbag-gray">
              원본이 이보다 작으면 <b>키우지 않습니다</b>
            </span>
          </div>
        )}

        {방식 === "percent" && (
          <div className="mt-3 flex items-center gap-3">
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={비율}
              onChange={(e) => set비율(Number(e.target.value))}
              className="w-56 accent-oddsbag-purple"
            />
            <span className="text-[13px] font-bold text-oddsbag-dark">{비율}%</span>
          </div>
        )}

        <p className="mt-5 text-[13px] font-bold text-oddsbag-dark">형식</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(형식이름) as 형식[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => set형(v)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-bold transition ${
                형 === v
                  ? "bg-oddsbag-purple text-white"
                  : "bg-oddsbag-light-gray text-oddsbag-gray hover:text-oddsbag-dark"
              }`}
            >
              {형식이름[v].label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[12px] text-oddsbag-gray">{형식이름[형].hint}</p>

        {형 !== "png" && (
          <>
            <p className="mt-5 text-[13px] font-bold text-oddsbag-dark">화질</p>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={30}
                max={100}
                step={5}
                value={화질}
                onChange={(e) => set화질(Number(e.target.value))}
                className="w-56 accent-oddsbag-purple"
              />
              <span className="text-[13px] font-bold text-oddsbag-dark">{화질}</span>
              <span className="text-[12px] text-oddsbag-gray">
                80 언저리면 눈으로는 거의 차이가 없습니다
              </span>
            </div>
          </>
        )}

        <button
          type="button"
          disabled={!files.length || !!busy}
          onClick={줄이기}
          className="mt-6 w-full rounded-xl bg-oddsbag-purple px-4 py-3 text-[15px] font-black text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy || `사진 ${files.length || ""}장 줄이기`}
        </button>
        {err && <p className="mt-3 text-[13px] font-bold text-red-600">{err}</p>}
      </section>

      {/* ③ 결과 */}
      {결과들.length > 0 && (
        <section className="mt-4 rounded-2xl border border-oddsbag-light-gray bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-black text-oddsbag-dark">③ 다 됐습니다</h2>
            <p className="text-[13px] text-oddsbag-gray">
              모두 {humanBytes(전체전)} → <b className="text-oddsbag-dark">{humanBytes(전체후)}</b>{" "}
              <span className="font-black text-emerald-600">
                {savedPercent(전체전, 전체후)}% 줄었습니다
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={묶어받기}
            disabled={!!busy}
            className="mt-4 w-full rounded-xl bg-oddsbag-dark px-4 py-3 text-[15px] font-black text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {결과들.length === 1 ? "내려받기" : `${결과들.length}장 압축파일로 한 번에 받기`}
          </button>

          <ul className="mt-4 space-y-2">
            {결과들.map((r) => (
              <li
                key={r.key}
                className="flex items-center gap-3 rounded-xl border border-oddsbag-light-gray p-2.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.미리보기}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-oddsbag-dark">{r.이름}</p>
                  <p className="text-[12px] text-oddsbag-gray">
                    {r.원본크기.w}×{r.원본크기.h} → {r.크기.w}×{r.크기.h} · {humanBytes(r.전)} →{" "}
                    {humanBytes(r.후)}{" "}
                    <b className="text-emerald-600">({savedPercent(r.전, r.후)}%↓)</b>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => 한장받기(r)}
                  className="shrink-0 rounded-lg border border-oddsbag-light-gray px-2.5 py-1.5 text-[12.5px] font-bold text-oddsbag-gray transition hover:border-oddsbag-purple hover:text-oddsbag-purple"
                >
                  받기
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {건너뛴것.length > 0 && (
        <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
          <h2 className="text-[14px] font-black text-oddsbag-dark">
            건너뛴 파일 {건너뛴것.length}개
          </h2>
          <ul className="mt-2 space-y-1">
            {건너뛴것.map((s, i) => (
              <li key={i} className="text-[12.5px] text-oddsbag-gray">
                <b className="text-oddsbag-dark">{s.name}</b> — {s.why}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
