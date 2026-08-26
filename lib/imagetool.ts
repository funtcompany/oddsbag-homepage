// 사진 도구들이 함께 쓰는 «계산». 순수 함수만.
//
// ★캔버스·File·DOM 을 하나도 안 부른다. 그래서 서버 없이 그대로 시험할 수 있다
//   (외장하드에서는 next dev 가 캐시가 깨져 못 뜬다 — 그 사정 때문에 여기를 갈라 뒀다).
//   실제로 그림을 그리는 쪽은 각 도구의 Client 컴포넌트다.
//
// 쓰는 곳 — /service/image (사진 줄이기) · /service/idphoto (증명사진 만들기)

// ── 크기 계산 ──────────────────────────────────────────────────

export interface Size {
  w: number;
  h: number;
}

/**
 * 비율을 지키며 «긴 변»을 목표에 맞춘다.
 * 원본이 이미 작으면 키우지 않는다 — 없는 화질을 만들어 낼 수는 없고, 키우면 뿌예지기만 한다.
 */
export function fitLongest(src: Size, longest: number): Size {
  const 긴변 = Math.max(src.w, src.h);
  if (긴변 <= longest || 긴변 === 0) return { w: src.w, h: src.h };
  const 배율 = longest / 긴변;
  return {
    w: Math.max(1, Math.round(src.w * 배율)),
    h: Math.max(1, Math.round(src.h * 배율)),
  };
}

/** 비율만큼 줄인다 (50% 처럼) */
export function scaleBy(src: Size, percent: number): Size {
  const p = Math.min(100, Math.max(1, percent)) / 100;
  return {
    w: Math.max(1, Math.round(src.w * p)),
    h: Math.max(1, Math.round(src.h * p)),
  };
}

/** 사람이 읽는 용량 */
export function humanBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)}KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)}MB`;
}

/** 얼마나 줄었나 — 「73% 줄었습니다」 */
export function savedPercent(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.max(0, Math.round(((before - after) / before) * 100));
}

/** 확장자를 바꾼 새 이름. 원본 이름이 없으면 순번으로 짓는다 */
export function outName(original: string, ext: string, index = 0): string {
  const 몸통 = (original || "").replace(/\.[a-z0-9]+$/i, "").trim();
  const 안전 = 몸통.replace(/[\\/:*?"<>|]/g, "_"); // 윈도우가 싫어하는 글자
  return `${안전 || `사진_${String(index + 1).padStart(3, "0")}`}.${ext}`;
}

// ── 증명사진 규격 ──────────────────────────────────────────────
//
// ★여기 적힌 mm 는 «기관이 밝힌 규격» 이다. 바뀌면 아래 확인 링크가 먼저 바뀐다.
//   오즈백은 이 값을 갖고 있을 뿐 «규격에 맞다고 판정하지 않는다» —
//   맞는지는 접수 창구와 각 기관의 확인 서비스가 답한다. (「챙길 것」과 같은 원칙)

export interface PhotoSpec {
  id: string;
  /** 화면에 보이는 이름 */
  label: string;
  /** 사진 가로 mm */
  wMm: number;
  /** 사진 세로 mm */
  hMm: number;
  /** 정수리~턱 길이 mm (아래 한계) — 없으면 안내선을 안 그린다 */
  headMinMm: number | null;
  /** 정수리~턱 길이 mm (위 한계) */
  headMaxMm: number | null;
  /** 한 줄 주의 */
  note: string;
  /** 이 규격을 어디서 확인했나 */
  source: { label: string; url: string };
  /** 오즈백이 그 안내를 읽은 날 */
  checkedAt: string;
}

export const photoSpecs: PhotoSpec[] = [
  {
    id: "passport",
    label: "여권",
    wMm: 35,
    hMm: 45,
    headMinMm: 32,
    headMaxMm: 36,
    note: "흰 배경 · 발급 신청일 전 6개월 이내 촬영 · 정면 · 입을 다물고 자연스러운 표정",
    source: {
      label: "외교부 여권안내 — 여권사진 규격",
      url: "https://www.passport.go.kr/home/kor/onlinePhotoVerify/index.do?menuPos=33",
    },
    checkedAt: "2026-08-26",
  },
  {
    id: "driver",
    label: "운전면허(적성검사·갱신)",
    wMm: 35,
    hMm: 45,
    headMinMm: null,
    headMaxMm: null,
    note: "6개월 이내 촬영 컬러사진 · 1종 적성검사는 2매, 2종 갱신은 1매",
    source: {
      label: "한국도로교통공단 안전운전 통합민원",
      url: "https://www.safedriving.or.kr/diGuide/selectDiGuide01.do?menuCd=MN-PO-1211",
    },
    checkedAt: "2026-08-26",
  },
  {
    id: "resume",
    label: "이력서(3×4)",
    wMm: 30,
    hMm: 40,
    headMinMm: null,
    headMaxMm: null,
    note: "기관 규격이 아니라 관행으로 쓰이는 크기입니다. 내는 곳에서 크기를 정해 뒀으면 그쪽을 따르십시오",
    source: {
      label: "정해진 공식 규격이 없습니다 — 제출처 안내를 확인하십시오",
      url: "",
    },
    checkedAt: "2026-08-26",
  },
  {
    id: "half",
    label: "반명함(3×4 큰 것)",
    wMm: 35,
    hMm: 45,
    headMinMm: null,
    headMaxMm: null,
    note: "여권과 같은 크기입니다. 내는 곳에서 다른 크기를 요구하면 그쪽을 따르십시오",
    source: { label: "제출처 안내를 확인하십시오", url: "" },
    checkedAt: "2026-08-26",
  },
];

export const 기본DPI = 300;

/** 밀리미터 → 점(픽셀). 인화용은 300dpi 가 기본이다 */
export function mmToPx(mm: number, dpi: number = 기본DPI): number {
  return Math.round((mm / 25.4) * dpi);
}

/** 이 규격의 사진 한 장이 몇 점짜리인가 */
export function specPixels(spec: PhotoSpec, dpi: number = 기본DPI): Size {
  return { w: mmToPx(spec.wMm, dpi), h: mmToPx(spec.hMm, dpi) };
}

// ── 인화지 배치 (4×6인치 한 장에 여러 장) ──────────────────────

export interface SheetPlan {
  /** 인화지 픽셀 크기 */
  sheet: Size;
  /** 가로로 몇 장 · 세로로 몇 줄 */
  cols: number;
  rows: number;
  /** 사진 한 장 픽셀 크기 */
  cell: Size;
  /** 사진 사이 여백(px) */
  gap: number;
  /** 왼쪽·위 시작 여백(px) — 가운데로 몰아 준다 */
  padX: number;
  padY: number;
  /** 모두 몇 장 들어가나 */
  total: number;
}

/**
 * 4×6인치(10×15cm) 인화지 한 장에 이 규격을 몇 장 앉힐 수 있나.
 * 사진관에 「4×6으로 뽑아 주세요」 하면 그대로 잘라 쓸 수 있게 배치한다.
 */
export function planSheet(
  spec: PhotoSpec,
  dpi: number = 기본DPI,
  sheetInch: Size = { w: 6, h: 4 },
  gapMm = 2,
): SheetPlan {
  const sheet = { w: Math.round(sheetInch.w * dpi), h: Math.round(sheetInch.h * dpi) };
  const cell = specPixels(spec, dpi);
  const gap = mmToPx(gapMm, dpi);
  const 여백 = mmToPx(3, dpi); // 인화기가 가장자리를 조금 먹는다

  const cols = Math.max(0, Math.floor((sheet.w - 여백 * 2 + gap) / (cell.w + gap)));
  const rows = Math.max(0, Math.floor((sheet.h - 여백 * 2 + gap) / (cell.h + gap)));

  const 쓰는너비 = cols > 0 ? cols * cell.w + (cols - 1) * gap : 0;
  const 쓰는높이 = rows > 0 ? rows * cell.h + (rows - 1) * gap : 0;

  return {
    sheet,
    cols,
    rows,
    cell,
    gap,
    padX: Math.round((sheet.w - 쓰는너비) / 2),
    padY: Math.round((sheet.h - 쓰는높이) / 2),
    total: cols * rows,
  };
}
