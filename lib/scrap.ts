// ─────────────────────────────────────────────────────────────
//  스크랩 정리기 — 판정 규칙 (순수 함수만 · 브라우저/서버 양쪽)
// ─────────────────────────────────────────────────────────────
//
//  «모아 두기만 한 것»을 쓸 수 있게 바꾼다.
//    주소 → 제목을 붙여 표로            (엑셀·텍스트·마크다운)
//    사진 → 이름을 고쳐 묶어서 압축파일  (그룹 폴더로 나눔)
//
//  ★여기에는 화면도 통신도 없다. 규칙만 있다 — 그래야 시험할 수 있다.

// ── 주소 뽑기 ────────────────────────────────────────────────

// 주소 뒤에 붙어 오는 «문장 부호»들. 한글 문서에서 특히 많다.
const TRAIL = /[)\]}>,.;:!?'"«»""''…]+$/;

/**
 * 아무 글에서나 http(s) 주소를 뽑는다.
 *  · 마크다운 [이름](주소) · <주소> · 따옴표 안 · 한글 바로 뒤 — 전부 잡는다
 *  · 뒤에 붙은 문장부호는 떼되, 주소의 «짝 맞는» 괄호는 남긴다
 *    (위키백과 주소에 괄호가 들어간다 — 그걸 떼면 링크가 깨진다)
 *  · 같은 주소는 한 번만
 */
export function extractUrls(text: string): string[] {
  if (!text) return [];
  const found = text.match(/https?:\/\/[^\s<>"'`\\]+/gi) || [];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of found) {
    let u = raw;
    // 뒤쪽 문장부호 떼기 — 단, 여는 괄호가 그만큼 있으면 주소의 일부다
    for (;;) {
      const m = u.match(TRAIL);
      if (!m) break;
      const cut = u.slice(0, u.length - m[0].length);
      const opens = (cut.match(/\(/g) || []).length;
      const closes = (cut.match(/\)/g) || []).length;
      if (m[0] === ")" && opens > closes) break; // 짝이 맞는 괄호 → 남긴다
      u = cut;
      if (!u) break;
    }
    if (!u || u.length < 11) continue; // "http://a.b" 보다 짧으면 주소가 아니다
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      const key = parsed.href;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(u);
    } catch {
      /* 주소 모양이 아니면 버린다 */
    }
  }
  return out;
}

// ── 주소 갈래 나누기 ─────────────────────────────────────────

export interface UrlKind {
  /** 사람이 읽는 갈래 이름 — 그룹 이름으로 그대로 쓴다 */
  group: string;
  /** 사이트 이름 (호스트에서 뽑은 읽기 쉬운 형태) */
  site: string;
}

const KNOWN: [RegExp, string][] = [
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "영상 · 유튜브"],
  [/(^|\.)instagram\.com$/, "SNS · 인스타그램"],
  [/(^|\.)(twitter|x)\.com$/, "SNS · 엑스"],
  [/(^|\.)(facebook|fb)\.com$/, "SNS · 페이스북"],
  [/(^|\.)tiktok\.com$/, "영상 · 틱톡"],
  [/(^|\.)(threads)\.(net|com)$/, "SNS · 스레드"],
  [/(^|\.)blog\.naver\.com$|(^|\.)tistory\.com$|(^|\.)brunch\.co\.kr$|(^|\.)velog\.io$|(^|\.)medium\.com$/, "블로그"],
  [/(^|\.)news\.naver\.com$|(^|\.)n\.news\.naver\.com$|(^|\.)news\.daum\.net$|news\./, "뉴스"],
  [/(^|\.)(smartstore|shopping)\.naver\.com$|(^|\.)coupang\.com$|(^|\.)11st\.co\.kr$|(^|\.)gmarket\.co\.kr$|(^|\.)aliexpress\.|(^|\.)amazon\./, "쇼핑"],
  [/(^|\.)github\.com$|(^|\.)gitlab\.com$|(^|\.)stackoverflow\.com$|(^|\.)npmjs\.com$/, "개발"],
  [/(^|\.)notion\.(so|site)$|(^|\.)docs\.google\.com$|(^|\.)sheets\.google\.com$|(^|\.)figma\.com$/, "문서 · 작업"],
  // 정부·공공 — .go.kr(부처·지자체) · gov.kr(정부24) · .or.kr(공공기관·협회)
  [/\.go\.kr$|(^|\.)gov\.kr$|\.or\.kr$/, "공공 · 기관"],
  [/(^|\.)namu\.wiki$|(^|\.)wikipedia\.org$/, "사전 · 위키"],
];

/** 호스트에서 «www.» 같은 껍데기를 벗겨 사람이 읽는 이름으로 */
export function siteName(host: string): string {
  return host.replace(/^www\d?\./, "").replace(/^m\./, "");
}

export function classifyUrl(url: string): UrlKind {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return { group: "기타", site: "" };
  }
  const site = siteName(host);
  for (const [re, group] of KNOWN) if (re.test(host)) return { group, site };
  return { group: "웹사이트", site };
}

// ── 사진 갈래·이름 ───────────────────────────────────────────

export type ImageShape = "가로형" | "세로형" | "정사각" | "긴가로" | "긴세로";

export function imageShape(w: number, h: number): ImageShape {
  if (!w || !h) return "정사각";
  const r = w / h;
  if (r >= 2) return "긴가로";
  if (r <= 0.5) return "긴세로";
  if (r > 1.15) return "가로형";
  if (r < 0.87) return "세로형";
  return "정사각";
}

/** 스크린샷인가 — 파일 이름이 가장 확실한 단서다 (기기마다 규칙이 정해져 있다) */
export function looksLikeScreenshot(name: string): boolean {
  return /screen ?shot|스크린 ?샷|화면 ?캡[처쳐]|^img_\d{4}\.png$|^스크린샷/i.test(name);
}

const pad = (n: number, w = 3) => String(n).padStart(w, "0");

/** 날짜를 2026-08-20 로 */
export function ymd(d: Date | null): string | null {
  if (!d || isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
}

/** 파일 이름에 못 쓰는 글자를 걷어낸다 (윈도우 기준이 가장 좁다) */
export function safeName(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export interface ImageInfo {
  /** 원래 파일 이름 */
  original: string;
  width: number;
  height: number;
  bytes: number;
  /** 찍은 날 (EXIF) 또는 파일 수정일 */
  taken: Date | null;
  /** EXIF 에서 «실제로» 읽었는가 — 아니면 파일 수정일이라 덜 믿을 만하다 */
  takenFromExif: boolean;
  ext: string;
}

/**
 * 새 이름을 짓는다.
 *   <묶음이름>_<날짜>_<번호>_<모양>.<확장자>
 *   예) 답사사진_2026-08-20_001_가로형.jpg
 *  날짜를 모르면 날짜 칸을 빼고, 묶음이름이 없으면 그것도 뺀다 — «빈 칸이 이어진 이름»을 만들지 않는다.
 */
export function makeImageName(
  info: ImageInfo,
  index: number,
  prefix: string,
  opts: { useShape?: boolean } = {},
): string {
  const parts: string[] = [];
  const p = safeName(prefix);
  if (p) parts.push(p);
  // ★날짜는 «진짜 촬영일(EXIF)»일 때만 이름에 넣는다 (2026-08-20).
  //   파일 수정일을 넣으면 한 묶음 안에서 어떤 것만 날짜가 붙어 이름이 들쭉날쭉해지고,
  //   무엇보다 «찍은 날»이 아닌 값이 파일 이름으로 굳어 버린다. 폴더 나누기와 같은 잣대다.
  const day = info.takenFromExif ? ymd(info.taken) : null;
  if (day) parts.push(day);
  parts.push(pad(index));
  if (opts.useShape !== false) {
    parts.push(looksLikeScreenshot(info.original) ? "화면캡처" : imageShape(info.width, info.height));
  }
  return `${parts.join("_")}.${info.ext.toLowerCase()}`;
}

// ── 폴더 나누기 ──────────────────────────────────────────────
//
//  ★2026-08-20 시험에서 잡은 것 — «한 묶음인데 폴더 기준이 둘로 갈렸다».
//     같은 zip 에서 나온 사진들은 모양별 폴더로, 따로 고른 사진 한 장은 날짜 폴더로 갔다.
//     사진마다 «날짜가 있나»를 따로 물어서 그렇다. 결과는 뒤죽박죽이고 사장님은 이유를 모른다.
//   → 기준은 «묶음 전체에 하나»만 정한다. 그리고 무엇으로 나눴는지 화면에 적는다.
//
//  ★함께 고친 것 — 파일 수정일로는 «달별»로 나누지 않는다.
//     복사·전송만 해도 오늘로 바뀌는 값이라, 그걸로 폴더를 만들면 「2026-08」 안에
//     10년 전 사진이 들어앉는다. 달별로 나누는 것은 EXIF 촬영일이 있을 때뿐이다.

export type GroupMode = "auto" | "month" | "shape" | "folder" | "none";

/** 이 묶음을 무엇으로 나눌지 스스로 정한다 (auto 일 때) */
export function decideGroupMode(list: ImageInfo[]): Exclude<GroupMode, "auto"> {
  if (!list.length) return "none";
  const withExif = list.filter((i) => i.takenFromExif).length;
  // 절반 넘게 «진짜 촬영일»을 갖고 있으면 달별이 가장 쓸모 있다
  if (withExif / list.length >= 0.5) return "month";
  return "shape";
}

/** 어느 폴더에 넣을까. mode 는 묶음 전체가 «같은 값»을 쓴다. */
export function imageGroup(info: ImageInfo, mode: Exclude<GroupMode, "auto"> = "shape"): string {
  if (mode === "none") return "";
  if (mode === "folder") {
    // 압축파일 안에서 이미 나뉘어 있던 폴더를 그대로 살린다
    const dir = info.original.includes("/") ? info.original.split("/").slice(0, -1).join("/") : "";
    return dir || "폴더없음";
  }
  if (looksLikeScreenshot(info.original)) return "화면캡처";
  if (mode === "month") {
    const d = info.takenFromExif ? info.taken : null; // ★EXIF 일 때만
    return d && !isNaN(d.getTime()) ? `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}` : "날짜모름";
  }
  return imageShape(info.width, info.height);
}

export const GROUP_LABEL: Record<Exclude<GroupMode, "auto">, string> = {
  month: "찍은 달별",
  shape: "사진 모양별",
  folder: "원래 폴더 그대로",
  none: "나누지 않음",
};

// ── 내보내기 (엑셀·텍스트) ───────────────────────────────────

export interface UrlRow {
  url: string;
  title: string;
  desc: string;
  site: string;
  group: string;
}

const csvCell = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;

/**
 * 엑셀에서 바로 열리는 CSV.
 *  ★맨 앞에 BOM(﻿)을 «반드시» 붙인다 — 없으면 엑셀이 한글을 깨서 연다.
 *    (이걸 빠뜨리면 사장님 화면에서 «????» 로 뜬다)
 */
export function toCsv(rows: UrlRow[]): string {
  const head = ["묶음", "제목", "주소", "사이트", "설명"];
  const body = rows.map((r) => [r.group, r.title, r.url, r.site, r.desc].map(csvCell).join(","));
  return "﻿" + [head.map(csvCell).join(","), ...body].join("\r\n");
}

/** 탭으로 나눈 것 — 구글 시트·엑셀에 «붙여넣기»가 바로 된다 */
export function toTsv(rows: UrlRow[]): string {
  const clean = (s: string) => String(s ?? "").replace(/[\t\r\n]+/g, " ").trim();
  const head = ["묶음", "제목", "주소", "사이트", "설명"].join("\t");
  return [head, ...rows.map((r) => [r.group, r.title, r.url, r.site, r.desc].map(clean).join("\t"))].join("\n");
}

/** 마크다운 목록 — 노션·깃허브에 그대로 붙는다 */
export function toMarkdown(rows: UrlRow[]): string {
  const byGroup = new Map<string, UrlRow[]>();
  for (const r of rows) {
    const g = r.group || "기타";
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(r);
  }
  const out: string[] = [];
  for (const [g, list] of byGroup) {
    out.push(`## ${g} (${list.length})`, "");
    for (const r of list) {
      const t = (r.title || r.url).replace(/[[\]]/g, "");
      out.push(r.desc ? `- [${t}](${r.url})  \n  ${r.desc}` : `- [${t}](${r.url})`);
    }
    out.push("");
  }
  return out.join("\n");
}

// ── EXIF 촬영일 (JPEG) ───────────────────────────────────────

/**
 * JPEG 의 EXIF 에서 «찍은 날»을 읽는다. 없으면 null.
 *  ★파일 수정일은 믿을 게 못 된다 — 복사·전송만 해도 오늘 날짜로 바뀐다.
 *    사진을 «찍은 날짜»로 묶으려면 이걸 봐야 한다.
 *  DateTimeOriginal(0x9003) → DateTimeDigitized(0x9004) → DateTime(0x0132) 순으로 찾는다.
 */
export function readExifDate(buf: ArrayBuffer): Date | null {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null; // JPEG 아님

  let off = 2;
  while (off + 4 <= v.byteLength) {
    if (v.getUint8(off) !== 0xff) break;
    const marker = v.getUint8(off + 1);
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      off += 2;
      continue;
    }
    if (marker === 0xda) break; // 그림 데이터 시작 — 여기부턴 없다
    const len = v.getUint16(off + 2);
    if (len < 2) break;

    if (marker === 0xe1 && off + 4 + 6 <= v.byteLength) {
      // "Exif\0\0" 인지
      let tag = "";
      for (let i = 0; i < 4; i++) tag += String.fromCharCode(v.getUint8(off + 4 + i));
      if (tag === "Exif") {
        const d = parseTiff(v, off + 10, Math.min(off + 2 + len, v.byteLength));
        if (d) return d;
      }
    }
    off += 2 + len;
  }
  return null;
}

function parseTiff(v: DataView, base: number, end: number): Date | null {
  if (base + 8 > end) return null;
  const le = v.getUint16(base) === 0x4949; // "II" = little endian
  if (!le && v.getUint16(base) !== 0x4d4d) return null;
  if (v.getUint16(base + 2, le) !== 42) return null;

  const want = [0x9003, 0x9004, 0x0132]; // 촬영 · 디지털화 · 수정
  const found: Record<number, string> = {};

  const walk = (ifd: number, depth: number) => {
    if (depth > 2 || ifd + 2 > end) return;
    const n = v.getUint16(ifd, le);
    if (n > 512) return; // 망가진 파일 방어
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (e + 12 > end) return;
      const tag = v.getUint16(e, le);
      const type = v.getUint16(e + 2, le);
      const count = v.getUint32(e + 4, le);

      if (tag === 0x8769 && depth === 0) {
        // Exif SubIFD — 촬영일은 대개 여기 있다
        walk(base + v.getUint32(e + 8, le), depth + 1);
        continue;
      }
      if (want.includes(tag) && type === 2 && count >= 19) {
        const p = base + v.getUint32(e + 8, le);
        if (p + 19 <= end) {
          let s = "";
          for (let j = 0; j < 19; j++) s += String.fromCharCode(v.getUint8(p + j));
          found[tag] = s;
        }
      }
    }
  };

  walk(base + v.getUint32(base + 4, le), 0);

  for (const t of want) {
    const s = found[t];
    if (!s) continue;
    // "2026:08:20 14:03:11"
    const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!m) continue;
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1990) return d;
  }
  return null;
}
