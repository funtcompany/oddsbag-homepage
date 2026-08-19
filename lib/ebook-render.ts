// ─────────────────────────────────────────────────────────────
//  이북 재료 만들기 — PDF·ZIP·이미지를 «쪽 그림»으로 (브라우저 전용)
// ─────────────────────────────────────────────────────────────
//
//  ★전부 브라우저 안에서 돈다. 파일이 서버로 올라가지 않는다.
//     (링크를 만들 때만 «완성된 이북 HTML» 한 장이 올라간다)
//
//  ★PDF 는 pdf.js 를 «그때 가서» 불러온다(동적 import).
//     1MB 가 넘는 짐이라 미리 불러오면 이 화면에 들어오기만 해도 느려진다.
//     PDF 를 고른 사람만 값을 치른다.

import { readZip, pickImages, naturalCompare } from "@/lib/zip";

export interface Quality {
  /** 긴 변 최대 픽셀 */
  maxEdge: number;
  /** 0~1 */
  quality: number;
}

export const QUALITY_PRESETS: Record<string, Quality & { label: string; hint: string }> = {
  light: { label: "가볍게", hint: "글자 위주 · 링크로 보내기 좋음", maxEdge: 1100, quality: 0.62 },
  normal: { label: "보통", hint: "대부분 이걸로 충분합니다", maxEdge: 1500, quality: 0.72 },
  sharp: { label: "선명하게", hint: "그림·사진이 많을 때", maxEdge: 2100, quality: 0.82 },
};

export interface RenderedPage {
  src: string; // data: URI
  label: string;
  bytes: number;
}

export interface Progress {
  done: number;
  total: number;
  note: string;
}

/** 페이지가 지나치게 많으면 브라우저가 죽는다 — 먼저 알려주고 멈춘다 */
export const MAX_PAGES = 300;

// ── 어떤 형식으로 내보낼까 (webp 가 같은 화질에 30% 가볍다) ──
let webpOk: boolean | null = null;
function canWebp(): boolean {
  if (webpOk !== null) return webpOk;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    webpOk = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    webpOk = false;
  }
  return webpOk;
}

function canvasToDataUrl(c: HTMLCanvasElement, q: Quality): string {
  const type = canWebp() ? "image/webp" : "image/jpeg";
  return c.toDataURL(type, q.quality);
}

const dataUrlBytes = (u: string) => {
  const i = u.indexOf(",");
  const b64 = i < 0 ? u : u.slice(i + 1);
  // base64 는 4글자가 3바이트 — 끝의 '=' 는 빼고 센다
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
};

/** 긴 변을 maxEdge 에 맞춘 배율 (원본보다 «키우지는» 않는다 — 키워봐야 흐릿해지고 무겁기만 하다) */
function fitScale(w: number, h: number, maxEdge: number): number {
  return Math.min(1, maxEdge / Math.max(w, h));
}

// ── ① PDF ────────────────────────────────────────────────────

export async function renderPdf(
  file: File,
  q: Quality,
  onProgress: (p: Progress) => void,
  signal?: AbortSignal,
): Promise<RenderedPage[]> {
  onProgress({ done: 0, total: 0, note: "PDF 읽는 도구를 불러오는 중…" });

  const pdfjs = await import("pdfjs-dist");
  // 워커 파일은 public/ 에 두고 주소로 준다 — 번들러 설정에 기대지 않는 가장 튼튼한 방법
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buf = await file.arrayBuffer();
  let doc;
  try {
    // pdfjs 5 부터는 isEvalSupported 옵션이 없다(eval 사용 자체가 걷혔다) — 넘기면 타입 오류가 난다
    doc = await pdfjs.getDocument({ data: buf }).promise;
  } catch (e) {
    const m = String(e instanceof Error ? e.message : e);
    if (/password/i.test(m)) throw new Error("암호가 걸린 PDF 입니다. 암호를 푼 뒤 올려 주세요.");
    throw new Error("PDF 를 읽지 못했습니다. 파일이 손상됐을 수 있습니다.");
  }

  const total = doc.numPages;
  if (total > MAX_PAGES) {
    throw new Error(
      `${total}쪽입니다. 한 번에 ${MAX_PAGES}쪽까지만 만들 수 있습니다 — 나눠서 만들어 주세요.`,
    );
  }

  const pages: RenderedPage[] = [];
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("이 브라우저에서는 그림을 그릴 수 없습니다.");

  for (let i = 1; i <= total; i++) {
    if (signal?.aborted) throw new Error("취소했습니다.");
    onProgress({ done: i - 1, total, note: `${i}쪽 그리는 중…` });

    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = fitScale(base.width, base.height, q.maxEdge);
    const vp = page.getViewport({ scale });

    canvas.width = Math.max(1, Math.round(vp.width));
    canvas.height = Math.max(1, Math.round(vp.height));
    // PDF 는 배경이 «투명»이다. 흰 칠을 안 하면 JPEG 에서 검게 나온다.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
    page.cleanup();

    const src = canvasToDataUrl(canvas, q);
    pages.push({ src, label: `${i}쪽`, bytes: dataUrlBytes(src) });

    // 화면이 얼어붙지 않게 한 숨 돌린다
    await new Promise((r) => setTimeout(r, 0));
  }

  canvas.width = canvas.height = 0;
  await doc.destroy();
  onProgress({ done: total, total, note: "다 됐습니다" });
  return pages;
}

// ── ② 이미지들 (직접 고른 것 · ZIP 안의 것) ───────────────────

interface NamedBlob {
  name: string;
  blob: Blob;
}

export async function collectImages(files: File[]): Promise<NamedBlob[]> {
  const out: NamedBlob[] = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name) || f.type === "application/zip") {
      const entries = await readZip(await f.arrayBuffer());
      const imgs = pickImages(entries);
      if (!imgs.length) throw new Error(`${f.name} 안에 이미지가 없습니다.`);
      for (const e of imgs) {
        const bytes = await e.bytes();
        out.push({ name: e.name, blob: new Blob([bytes as BlobPart]) });
      }
    } else if (f.type.startsWith("image/")) {
      out.push({ name: f.name, blob: f });
    }
  }
  out.sort((a, b) => naturalCompare(a.name, b.name));
  return out;
}

export async function renderImages(
  items: NamedBlob[],
  q: Quality,
  onProgress: (p: Progress) => void,
  signal?: AbortSignal,
): Promise<RenderedPage[]> {
  const total = items.length;
  if (total > MAX_PAGES) {
    throw new Error(
      `그림이 ${total}장입니다. 한 번에 ${MAX_PAGES}장까지만 만들 수 있습니다 — 나눠서 만들어 주세요.`,
    );
  }

  const pages: RenderedPage[] = [];
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("이 브라우저에서는 그림을 그릴 수 없습니다.");

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) throw new Error("취소했습니다.");
    const it = items[i];
    onProgress({ done: i, total, note: `${i + 1}장째 손질 중…` });

    let bmp: ImageBitmap;
    try {
      bmp = await createImageBitmap(it.blob);
    } catch {
      continue; // 그림이 아니거나 깨진 것은 조용히 건너뛴다 (아래에서 «몇 장 됐는지» 알려준다)
    }

    const scale = fitScale(bmp.width, bmp.height, q.maxEdge);
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();

    let src = canvasToDataUrl(canvas, q);
    let bytes = dataUrlBytes(src);

    // 원본이 이미 더 작으면 원본을 그대로 쓴다 (다시 압축해 봐야 손해다)
    if (it.blob.size < bytes && scale === 1) {
      src = await blobToDataUrl(it.blob);
      bytes = it.blob.size;
    }

    const label = it.name.split("/").pop()!.replace(/\.[a-z0-9]+$/i, "").slice(0, 24);
    pages.push({ src, label: label || `${i + 1}쪽`, bytes });
    await new Promise((r) => setTimeout(r, 0));
  }

  canvas.width = canvas.height = 0;
  if (!pages.length) throw new Error("읽을 수 있는 그림이 하나도 없었습니다.");
  onProgress({ done: total, total, note: "다 됐습니다" });
  return pages;
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("파일을 읽지 못했습니다."));
    r.readAsDataURL(b);
  });
}

export const fmtBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`;
