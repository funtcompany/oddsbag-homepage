// ─────────────────────────────────────────────────────────────
//  ZIP 읽기·쓰기 — 브라우저 안에서만 돈다 (서버로 안 보낸다)
// ─────────────────────────────────────────────────────────────
//
//  ★왜 직접 만들었나
//     jszip 을 넣으면 의존성이 하나 늘고 번들이 ~100KB 커진다.
//     우리가 필요한 건 «압축 안 한 것(stored) + 일반 압축(deflate)» 두 가지뿐이고,
//     푸는 쪽은 브라우저에 이미 있는 DecompressionStream('deflate-raw') 가 해 준다.
//     쓰는 쪽은 stored 만 쓴다 — 담는 것이 대부분 이미 압축된 사진(jpg/png)이라
//     한 번 더 압축해도 거의 안 줄고 시간만 먹는다.
//
//  한계 (숨기지 않고 적는다)
//     · ZIP64(4GB 넘거나 파일 65,535개 넘는 것)는 «못 읽는다». 만나면 알려주고 멈춘다.
//     · 암호 걸린 zip 은 못 읽는다. 역시 알려준다.
//     · 파일명은 UTF-8 로 읽는다. 옛 윈도우 zip 의 CP949 이름은 깨질 수 있어
//       그때는 파일 순서(번호)로 정렬한다 — 이북 순서가 어긋나지 않게.

export interface ZipEntry {
  name: string;
  size: number;
  /** 디렉터리면 true */
  dir: boolean;
  /** 실제 내용을 꺼낸다 (필요할 때만 푼다) */
  bytes: () => Promise<Uint8Array>;
}

const SIG_EOCD = 0x06054b50;
const SIG_CEN = 0x02014b50;
const SIG_LOC = 0x04034b50;

// ── 읽기 ──────────────────────────────────────────────────────

export async function readZip(buf: ArrayBuffer): Promise<ZipEntry[]> {
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  // EOCD 를 뒤에서부터 찾는다 (주석이 최대 65,535 바이트 붙을 수 있다)
  let eocd = -1;
  const from = Math.max(0, buf.byteLength - 65_557);
  for (let i = buf.byteLength - 22; i >= from; i--) {
    if (view.getUint32(i, true) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP 파일이 아니거나 손상됐습니다.");

  const total = view.getUint16(eocd + 10, true);
  const cenSize = view.getUint32(eocd + 12, true);
  const cenOff = view.getUint32(eocd + 16, true);

  if (total === 0xffff || cenOff === 0xffffffff || cenSize === 0xffffffff) {
    throw new Error(
      "ZIP64 형식입니다(파일이 아주 크거나 65,535개가 넘습니다). 나눠서 올려 주세요.",
    );
  }

  const dec = new TextDecoder("utf-8");
  const entries: ZipEntry[] = [];
  let p = cenOff;

  for (let i = 0; i < total; i++) {
    if (p + 46 > buf.byteLength || view.getUint32(p, true) !== SIG_CEN) break;

    const flag = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const rawSize = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOff = view.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));

    p += 46 + nameLen + extraLen + commentLen;

    const dir = name.endsWith("/") || rawSize === 0;
    const encrypted = (flag & 0x1) !== 0;

    entries.push({
      name,
      size: rawSize,
      dir: name.endsWith("/"),
      bytes: async () => {
        if (encrypted) throw new Error(`암호가 걸린 파일입니다: ${name}`);
        if (dir && name.endsWith("/")) return new Uint8Array(0);

        // 지역 헤더에서 «실제» 이름·extra 길이를 다시 읽는다.
        //  (중앙목록과 다를 수 있다 — 다르면 내용 시작점이 어긋난다)
        if (view.getUint32(localOff, true) !== SIG_LOC) {
          throw new Error(`ZIP 내부 위치가 어긋납니다: ${name}`);
        }
        const lNameLen = view.getUint16(localOff + 26, true);
        const lExtraLen = view.getUint16(localOff + 28, true);
        const start = localOff + 30 + lNameLen + lExtraLen;
        const raw = u8.subarray(start, start + compSize);

        if (method === 0) return raw.slice();
        if (method === 8) return await inflateRaw(raw);
        throw new Error(`지원하지 않는 압축 방식입니다(${method}): ${name}`);
      },
    });
  }

  return entries;
}

async function inflateRaw(raw: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("이 브라우저는 ZIP 풀기를 지원하지 않습니다. 크롬·사파리 최신판을 써 주세요.");
  }
  const ds = new DecompressionStream("deflate-raw");
  // Uint8Array 를 그대로 넘기면 일부 브라우저가 SharedArrayBuffer 여부로 까다롭게 군다 → Blob 경유
  const out = new Blob([raw as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

// ── 쓰기 (stored — 압축 안 함) ────────────────────────────────

export interface ZipInput {
  /** 폴더를 만들려면 이름에 "/" 를 넣는다: "사진_2026-08/001.jpg" */
  name: string;
  data: Uint8Array | string;
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** 파일 여러 개를 zip 한 덩이(Blob)로 묶는다. 압축은 하지 않는다(사진은 이미 압축돼 있다). */
export function makeZip(files: ZipInput[]): Blob {
  const enc = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  // 날짜는 고정값을 쓴다 — 같은 자료를 두 번 묶으면 «같은 파일»이 나오게(재현 가능)
  const dosTime = 0;
  const dosDate = (2026 - 1980) * 512 + 1 * 32 + 1; // 2026-01-01

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, SIG_LOC, true);
    lv.setUint16(4, 20, true); // 필요한 판 버전
    lv.setUint16(6, 0x0800, true); // 이름이 UTF-8 임을 표시
    lv.setUint16(8, 0, true); // 압축 안 함
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    parts.push(local, data as BlobPart);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, SIG_CEN, true);
    cv.setUint16(4, 20, true); // 만든 판
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    central.push(cen);

    offset += local.length + data.length;
  }

  const cenStart = offset;
  let cenLen = 0;
  for (const c of central) {
    parts.push(c as BlobPart);
    cenLen += c.length;
  }

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, SIG_EOCD, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cenLen, true);
  ev.setUint32(16, cenStart, true);
  parts.push(eocd as BlobPart);

  return new Blob(parts, { type: "application/zip" });
}

// ── 편의 ──────────────────────────────────────────────────────

/** zip 안에서 이미지만 골라 «사람이 보는 순서»로 정렬해 돌려준다 */
export function pickImages(entries: ZipEntry[]): ZipEntry[] {
  return entries
    .filter(
      (e) =>
        !e.dir &&
        !e.name.split("/").pop()!.startsWith(".") && // __MACOSX/._foo 같은 맥 찌꺼기
        !e.name.startsWith("__MACOSX/") &&
        /\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(e.name),
    )
    .sort((a, b) => naturalCompare(a.name, b.name));
}

/** "2, 10" 이 "10, 2" 로 뒤집히지 않게 — 이북 페이지 순서에 꼭 필요하다 */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, "ko", { numeric: true, sensitivity: "base" });
}
