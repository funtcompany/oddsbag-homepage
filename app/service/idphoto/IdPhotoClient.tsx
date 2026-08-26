"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  photoSpecs,
  specPixels,
  planSheet,
  mmToPx,
  humanBytes,
  기본DPI,
  type PhotoSpec,
} from "@/lib/imagetool";

// 증명사진 만들기 — 가진 사진을 «규격 크기»로 잘라 준다.
//
//  ★이 도구가 하지 «않는» 것을 먼저 못 박는다 (「챙길 것」과 같은 원칙).
//    · 얼굴을 고치지 않는다. 배경을 지우거나 합성하지 않는다.
//      외교부가 「필터·보정·AI 수정」을 반려 사유로 적어 두었다. 우리가 그걸 해 주면 안 된다.
//    · 「규격에 맞습니다」라고 판정하지 않는다. 맞는지는 접수 창구와
//      외교부 사진규격 확인 서비스가 답한다. 우리는 «자르고 크기를 맞출» 뿐이다.
//
//  규격 값과 배치 계산은 lib/imagetool.ts 에 있다 (서버 없이 시험할 수 있다).

const 사진규격확인 = "https://www.passport.go.kr/home/kor/onlinePhotoVerify/index.do?menuPos=33";

interface 만든것 {
  blob: Blob;
  url: string;
  w: number;
  h: number;
}

export default function IdPhotoClient() {
  const [spec, setSpec] = useState<PhotoSpec>(photoSpecs[0]);
  const [file, setFile] = useState<File | null>(null);
  const [bmp, setBmp] = useState<ImageBitmap | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [안내선, set안내선] = useState(true);
  const [한장, set한장] = useState<만든것 | null>(null);
  const [인화지, set인화지] = useState<만든것 | null>(null);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const 미리보기Ref = useRef<HTMLCanvasElement>(null);
  const 끄는중 = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);

  const 결과지우기 = useCallback(() => {
    set한장((옛) => {
      if (옛) URL.revokeObjectURL(옛.url);
      return null;
    });
    set인화지((옛) => {
      if (옛) URL.revokeObjectURL(옛.url);
      return null;
    });
  }, []);

  const 담기 = useCallback(
    async (list: FileList | File[] | null) => {
      const f = list ? Array.from(list)[0] : null;
      if (!f) return;
      setErr("");
      결과지우기();
      try {
        const b = await createImageBitmap(f);
        setBmp((옛) => {
          옛?.close?.();
          return b;
        });
        setFile(f);
        setZoom(1);
        setDx(0);
        setDy(0);
      } catch {
        setErr("이 사진을 못 엽니다. JPG 나 PNG 로 저장한 사진을 올려 보세요.");
      }
    },
    [결과지우기],
  );

  // ── 미리보기 그리기 ───────────────────────────────────────────
  // 화면용이라 작게 그린다. 실제로 받는 파일은 아래 만들기() 가 300dpi 로 다시 그린다.
  const 미리높이 = 420;
  const 미리너비 = Math.round((미리높이 * spec.wMm) / spec.hMm);

  useEffect(() => {
    const cv = 미리보기Ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    cv.width = 미리너비;
    cv.height = 미리높이;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (bmp) 그리기(ctx, bmp, cv.width, cv.height, zoom, dx, dy);

    if (안내선 && spec.headMinMm != null && spec.headMaxMm != null) {
      // 정수리~턱이 들어와야 하는 띠. 사진 위쪽 여백을 규격이 정한 만큼 남겨 그린다.
      const 세로비 = 미리높이 / spec.hMm;
      // 머리 꼭대기는 위에서 약 10% 지점에 두는 것이 일반적인 안내다
      const 머리위 = 미리높이 * 0.1;
      for (const [mm, color] of [
        [spec.headMinMm, "rgba(109,40,217,0.55)"],
        [spec.headMaxMm, "rgba(109,40,217,0.9)"],
      ] as [number, string][]) {
        const y = 머리위 + mm * 세로비;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cv.width, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(109,40,217,0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 머리위);
      ctx.lineTo(cv.width, 머리위);
      ctx.stroke();
    }
  }, [bmp, zoom, dx, dy, spec, 안내선, 미리너비]);

  /** 사진을 칸 가운데에 «덮이도록» 그린다 (cover) */
  function 그리기(
    ctx: CanvasRenderingContext2D,
    img: ImageBitmap,
    w: number,
    h: number,
    z: number,
    ox: number,
    oy: number,
  ) {
    const 기본 = Math.max(w / img.width, h / img.height);
    const s = 기본 * z;
    const dw = img.width * s;
    const dh = img.height * s;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (w - dw) / 2 + ox * w, (h - dh) / 2 + oy * h, dw, dh);
  }

  async function 만들기() {
    if (!bmp) return;
    결과지우기();
    const px = specPixels(spec, 기본DPI);

    // ① 한 장
    const cv = document.createElement("canvas");
    cv.width = px.w;
    cv.height = px.h;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, px.w, px.h);
    그리기(ctx, bmp, px.w, px.h, zoom, dx, dy);
    const b1 = await new Promise<Blob | null>((r) => cv.toBlob(r, "image/jpeg", 0.95));
    if (b1) set한장({ blob: b1, url: URL.createObjectURL(b1), w: px.w, h: px.h });

    // ② 4×6인치 인화지에 여러 장
    const plan = planSheet(spec, 기본DPI);
    if (plan.total > 0) {
      const sh = document.createElement("canvas");
      sh.width = plan.sheet.w;
      sh.height = plan.sheet.h;
      const sctx = sh.getContext("2d");
      if (sctx) {
        sctx.fillStyle = "#fff";
        sctx.fillRect(0, 0, sh.width, sh.height);
        for (let r = 0; r < plan.rows; r++) {
          for (let c = 0; c < plan.cols; c++) {
            const x = plan.padX + c * (plan.cell.w + plan.gap);
            const y = plan.padY + r * (plan.cell.h + plan.gap);
            sctx.drawImage(cv, x, y, plan.cell.w, plan.cell.h);
            // 자르는 선 — 사진관에서 잘라 쓸 수 있게 얇은 회색 테두리
            sctx.strokeStyle = "rgba(0,0,0,0.18)";
            sctx.lineWidth = 1;
            sctx.strokeRect(x + 0.5, y + 0.5, plan.cell.w - 1, plan.cell.h - 1);
          }
        }
        const b2 = await new Promise<Blob | null>((r2) => sh.toBlob(r2, "image/jpeg", 0.95));
        if (b2)
          set인화지({ blob: b2, url: URL.createObjectURL(b2), w: sh.width, h: sh.height });
      }
    }
  }

  function 받기(m: 만든것, 이름: string) {
    const a = document.createElement("a");
    a.href = m.url;
    a.download = 이름;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const plan = planSheet(spec, 기본DPI);
  const px = specPixels(spec, 기본DPI);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <div className="text-4xl" aria-hidden>
          🪪
        </div>
        <h1
          className="mt-3 text-[26px] font-black text-oddsbag-dark sm:text-[32px]"
          style={{ letterSpacing: "-0.03em", wordBreak: "keep-all" }}
        >
          증명사진 만들기
        </h1>
        <p
          className="mt-3 text-[15px] leading-relaxed text-oddsbag-gray"
          style={{ wordBreak: "keep-all" }}
        >
          갖고 계신 사진을 <b className="text-oddsbag-dark">규격 크기로 잘라</b> 드립니다.
          인화지 한 장에 여러 장 앉힌 것도 함께 만들어 드려서, 사진관에{" "}
          <b className="text-oddsbag-dark">4×6으로 뽑아 달라</b>고 하시면 그대로 잘라 쓰실 수
          있습니다.
        </p>
        <p className="mt-2 text-[13px] text-oddsbag-gray">
          🔒 사진은 <b>서버로 가지 않습니다.</b> 이 브라우저 안에서만 자릅니다.
        </p>
      </div>

      {/* ★도구가 «하지 않는 것» 을 맨 앞에 둔다. 뒤에 숨기면 읽지 않는다. */}
      <section className="mb-4 rounded-2xl border border-amber-300 bg-amber-50/60 p-5">
        <h2 className="text-[14.5px] font-black text-oddsbag-dark">
          이 도구가 하지 않는 것 — 먼저 읽어 주세요
        </h2>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-oddsbag-dark/85">
          <li>
            · <b>얼굴을 고치거나 배경을 지우지 않습니다.</b> 자르고 크기만 맞춥니다. 외교부는
            보정·합성·AI 수정을 한 사진을 <b>반려 사유</b>로 적어 두었습니다.
          </li>
          <li>
            · <b>「규격에 맞습니다」라고 판정하지 않습니다.</b> 맞는지는 접수 창구가 봅니다.
            여권이라면 내시기 전에{" "}
            <a
              href={사진규격확인}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-oddsbag-purple underline"
            >
              외교부 사진규격 확인 서비스
            </a>
            에서 직접 확인하십시오.
          </li>
          <li>
            · 배경이 <b>흰색이 아니거나</b> 그림자가 지면 규격에 맞지 않습니다. 그건 잘라서
            해결되지 않으니 흰 벽 앞에서 다시 찍으시는 편이 빠릅니다.
          </li>
        </ul>
      </section>

      {/* ① 어디에 쓸 사진인가 */}
      <section className="rounded-2xl border border-oddsbag-light-gray bg-white p-5">
        <h2 className="text-[15px] font-black text-oddsbag-dark">① 어디에 내실 사진인가요</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {photoSpecs.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSpec(s);
                결과지우기();
              }}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition ${
                spec.id === s.id
                  ? "bg-oddsbag-purple text-white"
                  : "bg-oddsbag-light-gray text-oddsbag-gray hover:text-oddsbag-dark"
              }`}
            >
              {s.label} · {s.wMm}×{s.hMm}mm
            </button>
          ))}
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-oddsbag-gray">
          {spec.note}
        </p>
        <p className="mt-1 text-[12px] text-oddsbag-gray">
          만들어지는 파일 — {px.w}×{px.h}점 (300dpi) ·{" "}
          {spec.source.url ? (
            <>
              규격 출처{" "}
              <a
                href={spec.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-oddsbag-purple underline"
              >
                {spec.source.label}
              </a>{" "}
              (오즈백 확인일 {spec.checkedAt})
            </>
          ) : (
            <b className="text-oddsbag-dark">{spec.source.label}</b>
          )}
        </p>
      </section>

      {/* ② 사진 올리기 */}
      <section className="mt-4 rounded-2xl border border-oddsbag-light-gray bg-white p-5">
        <h2 className="text-[15px] font-black text-oddsbag-dark">② 사진을 올리세요</h2>
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
          className={`mt-3 cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition ${
            drag
              ? "border-oddsbag-purple bg-oddsbag-purple/5"
              : "border-oddsbag-light-gray hover:border-oddsbag-purple"
          }`}
        >
          <div className="text-3xl" aria-hidden>
            {file ? "🖼" : "⬆️"}
          </div>
          <p className="mt-2 text-sm font-bold text-oddsbag-dark">
            {file ? file.name : "여기로 끌어다 놓거나 눌러서 고르세요"}
          </p>
          <p className="mt-1 text-xs text-oddsbag-gray">
            {file ? `${humanBytes(file.size)} · 눌러서 다시 고르기` : "정면을 보고 찍은 사진"}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => 담기(e.target.files)}
        />
        {err && <p className="mt-3 text-[13px] font-bold text-red-600">{err}</p>}
      </section>

      {/* ③ 맞추기 */}
      {bmp && (
        <section className="mt-4 rounded-2xl border border-oddsbag-light-gray bg-white p-5">
          <h2 className="text-[15px] font-black text-oddsbag-dark">③ 얼굴을 칸에 맞추세요</h2>
          <p className="mt-1 text-[12.5px] text-oddsbag-gray">
            사진을 <b>끌어서 옮기고</b>, 아래 막대로 <b>키우거나 줄이십시오.</b>
            {spec.headMinMm != null && (
              <>
                {" "}
                보라색 선은 <b>정수리~턱이 들어와야 하는 자리</b>입니다(
                {spec.headMinMm}~{spec.headMaxMm}mm).
              </>
            )}
          </p>

          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <canvas
              ref={미리보기Ref}
              className="shrink-0 cursor-move touch-none rounded-lg border border-oddsbag-light-gray shadow-sm"
              style={{ width: 미리너비, height: 미리높이 }}
              onPointerDown={(e) => {
                (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
                끄는중.current = { x: e.clientX, y: e.clientY, dx, dy };
              }}
              onPointerMove={(e) => {
                const d = 끄는중.current;
                if (!d) return;
                setDx(d.dx + (e.clientX - d.x) / 미리너비);
                setDy(d.dy + (e.clientY - d.y) / 미리높이);
              }}
              onPointerUp={() => {
                끄는중.current = null;
              }}
              onPointerCancel={() => {
                끄는중.current = null;
              }}
            />

            <div className="w-full flex-1">
              <label className="text-[13px] font-bold text-oddsbag-dark">크기</label>
              <input
                type="range"
                min={100}
                max={300}
                value={Math.round(zoom * 100)}
                onChange={(e) => setZoom(Number(e.target.value) / 100)}
                className="mt-1 w-full accent-oddsbag-purple"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setDx(0);
                    setDy(0);
                  }}
                  className="rounded-lg border border-oddsbag-light-gray px-2.5 py-1.5 text-[12.5px] font-bold text-oddsbag-gray transition hover:border-oddsbag-purple hover:text-oddsbag-purple"
                >
                  가운데로 되돌리기
                </button>
                {spec.headMinMm != null && (
                  <button
                    type="button"
                    onClick={() => set안내선((v) => !v)}
                    className="rounded-lg border border-oddsbag-light-gray px-2.5 py-1.5 text-[12.5px] font-bold text-oddsbag-gray transition hover:border-oddsbag-purple hover:text-oddsbag-purple"
                  >
                    안내선 {안내선 ? "끄기" : "켜기"}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={만들기}
                className="mt-5 w-full rounded-xl bg-oddsbag-purple px-4 py-3 text-[15px] font-black text-white transition hover:opacity-90"
              >
                이대로 만들기
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ④ 결과 */}
      {한장 && (
        <section className="mt-4 rounded-2xl border border-oddsbag-light-gray bg-white p-5">
          <h2 className="text-[15px] font-black text-oddsbag-dark">④ 다 됐습니다</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-oddsbag-light-gray p-4">
              <p className="text-[13.5px] font-black text-oddsbag-dark">낱장 (한 장)</p>
              <p className="mt-0.5 text-[12px] text-oddsbag-gray">
                {한장.w}×{한장.h}점 · {humanBytes(한장.blob.size)} · 온라인 신청에 올릴 때
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={한장.url}
                alt="만들어진 증명사진"
                className="mx-auto mt-3 h-40 rounded border border-oddsbag-light-gray"
              />
              <button
                type="button"
                onClick={() => 받기(한장, `증명사진_${spec.label}_${spec.wMm}x${spec.hMm}.jpg`)}
                className="mt-3 w-full rounded-lg bg-oddsbag-dark px-3 py-2 text-[13.5px] font-black text-white transition hover:opacity-90"
              >
                낱장 내려받기
              </button>
            </div>

            {인화지 && (
              <div className="rounded-xl border border-oddsbag-light-gray p-4">
                <p className="text-[13.5px] font-black text-oddsbag-dark">
                  인화용 ({plan.total}장 · 4×6인치)
                </p>
                <p className="mt-0.5 text-[12px] text-oddsbag-gray">
                  {인화지.w}×{인화지.h}점 · {humanBytes(인화지.blob.size)} · 사진관에 「4×6」으로
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={인화지.url}
                  alt="인화용 배치"
                  className="mx-auto mt-3 h-40 rounded border border-oddsbag-light-gray"
                />
                <button
                  type="button"
                  onClick={() => 받기(인화지, `증명사진_인화용_${plan.total}장.jpg`)}
                  className="mt-3 w-full rounded-lg bg-oddsbag-dark px-3 py-2 text-[13.5px] font-black text-white transition hover:opacity-90"
                >
                  인화용 내려받기
                </button>
              </div>
            )}
          </div>

          <div className="mt-5 rounded-xl bg-oddsbag-light-gray/50 p-4">
            <p className="text-[13px] font-black text-oddsbag-dark">내시기 전에</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-oddsbag-gray">
              여권·운전면허는 <b>언제까지 무엇을 챙겨야 하는지</b>가 따로 정해져 있습니다.
              사진만 준비하고 기한을 놓치면 헛일입니다 —{" "}
              <Link href="/check" className="font-bold text-oddsbag-purple underline">
                「챙길 것」에서 내 기한을 확인
              </Link>
              해 보세요.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
