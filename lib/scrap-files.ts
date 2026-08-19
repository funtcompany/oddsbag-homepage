// ─────────────────────────────────────────────────────────────
//  스크랩 정리기 — 들어온 파일에서 «글»과 «사진»을 꺼낸다 (브라우저 전용)
// ─────────────────────────────────────────────────────────────

import { readZip, naturalCompare } from "@/lib/zip";
import { readExifDate, type ImageInfo } from "@/lib/scrap";

export interface Picked {
  /** 글 — 여기서 주소를 뽑는다 */
  texts: { name: string; text: string }[];
  /** 사진 — 이름을 바꿔 다시 묶는다 */
  images: { name: string; blob: Blob }[];
  /** 읽지 못한 것 (사장님께 그대로 알린다 — 조용히 빠뜨리지 않는다) */
  skipped: { name: string; why: string }[];
}

const isImage = (n: string) => /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif)$/i.test(n);
const isText = (n: string) => /\.(txt|md|markdown|csv|tsv|html?|json|xml|rtf|log)$/i.test(n);
const isDocx = (n: string) => /\.docx$/i.test(n);
const isZip = (n: string) => /\.zip$/i.test(n);

/** 맥·윈도우가 zip 에 끼워 넣는 찌꺼기 */
const junk = (n: string) => {
  const base = n.split("/").pop() || "";
  return n.startsWith("__MACOSX/") || base.startsWith("._") || base === ".DS_Store" || base === "Thumbs.db";
};

export async function pickFromFiles(files: File[]): Promise<Picked> {
  const out: Picked = { texts: [], images: [], skipped: [] };

  for (const f of files) {
    try {
      if (isZip(f.name)) {
        await fromZip(f, out);
      } else if (isImage(f.name) || f.type.startsWith("image/")) {
        out.images.push({ name: f.name, blob: f });
      } else if (isDocx(f.name)) {
        out.texts.push({ name: f.name, text: await docxText(await f.arrayBuffer()) });
      } else if (isText(f.name) || f.type.startsWith("text/")) {
        out.texts.push({ name: f.name, text: await f.text() });
      } else if (/\.pdf$/i.test(f.name)) {
        out.skipped.push({ name: f.name, why: "PDF 안의 글자는 아직 못 읽습니다 (이북 제작기를 써 보세요)" });
      } else {
        out.skipped.push({ name: f.name, why: "다룰 줄 모르는 형식입니다" });
      }
    } catch (e) {
      out.skipped.push({ name: f.name, why: String(e instanceof Error ? e.message : e) });
    }
  }

  out.images.sort((a, b) => naturalCompare(a.name, b.name));
  return out;
}

async function fromZip(f: File, out: Picked) {
  const entries = await readZip(await f.arrayBuffer());
  for (const e of entries) {
    if (e.dir || junk(e.name)) continue;
    try {
      if (isImage(e.name)) {
        out.images.push({ name: e.name, blob: new Blob([(await e.bytes()) as BlobPart]) });
      } else if (isDocx(e.name)) {
        const b = await e.bytes();
        out.texts.push({ name: e.name, text: await docxText(b.buffer as ArrayBuffer) });
      } else if (isText(e.name)) {
        out.texts.push({ name: e.name, text: new TextDecoder("utf-8").decode(await e.bytes()) });
      }
      // 그 밖의 것은 조용히 넘긴다 — zip 안에는 잡다한 게 많고, 그걸 다 보고하면 시끄럽다
    } catch (err) {
      out.skipped.push({ name: `${f.name} 안의 ${e.name}`, why: String(err instanceof Error ? err.message : err) });
    }
  }
}

/** .docx 는 사실 zip 이다 — 안의 word/document.xml 에서 글자만 훑는다 */
async function docxText(buf: ArrayBuffer): Promise<string> {
  const entries = await readZip(buf);
  const doc = entries.find((e) => e.name === "word/document.xml");
  if (!doc) throw new Error("워드 문서 안을 읽지 못했습니다.");
  const xml = new TextDecoder("utf-8").decode(await doc.bytes());
  return xml
    .replace(/<w:p\b[^>]*>/g, "\n") // 문단마다 줄바꿈
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 사진 한 장을 «재어 본다» — 크기·모양·찍은 날 */
export async function measureImage(name: string, blob: Blob): Promise<ImageInfo> {
  const ext = (name.split(".").pop() || "jpg").toLowerCase();
  let width = 0;
  let height = 0;
  try {
    const bmp = await createImageBitmap(blob);
    width = bmp.width;
    height = bmp.height;
    bmp.close();
  } catch {
    /* 못 열어도 이름 바꾸기는 된다 */
  }

  // 찍은 날 — EXIF 가 있으면 그것을, 없으면 파일 수정일을 쓴다.
  //  ★어느 쪽인지 반드시 표시한다(takenFromExif). 파일 수정일은 복사만 해도 바뀌어서
  //    «찍은 날»이라고 말하면 거짓이 된다. 화면에서도 다르게 보여준다.
  let taken: Date | null = null;
  let takenFromExif = false;
  if (/^(jpe?g)$/.test(ext)) {
    try {
      taken = readExifDate(await blob.slice(0, 128 * 1024).arrayBuffer());
      takenFromExif = !!taken;
    } catch {
      /* EXIF 가 깨져 있어도 넘어간다 */
    }
  }
  if (!taken && blob instanceof File && blob.lastModified) {
    taken = new Date(blob.lastModified);
  }

  return { original: name.split("/").pop() || name, width, height, bytes: blob.size, taken, takenFromExif, ext };
}

/** 같은 사진이 두 번 들어왔는가 — 내용을 그대로 견줘 본다 */
export async function contentHash(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h).slice(0, 12))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
