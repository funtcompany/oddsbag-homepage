// 사진 줄이기 · 증명사진 만들기 · 글자수 세기 가 쓰는 «계산» 시험.
//
//   cd homepage
//   OB_ROOT="$PWD" node --experimental-strip-types --import ./scripts/시험/별칭.mjs ./scripts/시험/사진도구-시험.mjs

import {
  fitLongest,
  scaleBy,
  humanBytes,
  savedPercent,
  outName,
  mmToPx,
  specPixels,
  planSheet,
  photoSpecs,
} from "@/lib/imagetool";
import { countText, eucKrBytes, 보이는글자수, limitState } from "@/lib/textcount";

let 통과 = 0;
const 실패 = [];
const 같나 = (무엇, 실제, 기대) => {
  const a = JSON.stringify(실제);
  const b = JSON.stringify(기대);
  if (a === b) 통과 += 1;
  else 실패.push(`${무엇} — 기대 ${b} · 실제 ${a}`);
};

// ── 사진 크기 줄이기 ────────────────────────────────────────────
같나("가로가 긴 사진의 긴 변을 1000 으로", fitLongest({ w: 4000, h: 3000 }, 1000), { w: 1000, h: 750 });
같나("세로가 긴 사진도 긴 변 기준", fitLongest({ w: 3000, h: 4000 }, 1000), { w: 750, h: 1000 });
// ★이미 작은 사진을 키우면 뿌예지기만 한다 — 그대로 둔다
같나("이미 작으면 안 키운다", fitLongest({ w: 300, h: 200 }, 1000), { w: 300, h: 200 });
같나("딱 맞으면 그대로", fitLongest({ w: 1000, h: 500 }, 1000), { w: 1000, h: 500 });
같나("0 이 들어와도 안 죽는다", fitLongest({ w: 0, h: 0 }, 1000), { w: 0, h: 0 });

같나("절반으로", scaleBy({ w: 1000, h: 800 }, 50), { w: 500, h: 400 });
같나("1픽셀 밑으로는 안 내려간다", scaleBy({ w: 3, h: 3 }, 1), { w: 1, h: 1 });
같나("100 을 넘겨 적어도 안 키운다", scaleBy({ w: 100, h: 100 }, 500), { w: 100, h: 100 });

같나("용량 표기 B", humanBytes(900), "900B");
같나("용량 표기 KB", humanBytes(2048), "2.0KB");
같나("용량 표기 MB", humanBytes(3 * 1024 * 1024), "3.0MB");
같나("용량 표기 이상값", humanBytes(-1), "-");

같나("줄어든 비율", savedPercent(1000, 250), 75);
같나("안 줄었으면 0", savedPercent(1000, 1200), 0);
같나("0 으로 나누지 않는다", savedPercent(0, 0), 0);

같나("이름 바꾸기", outName("바다사진.HEIC", "jpg"), "바다사진.jpg");
같나("점 없는 이름", outName("사진", "webp"), "사진.webp");
같나("윈도우가 싫어하는 글자를 뺀다", outName('a/b:c*d?.png', "jpg"), "a_b_c_d_.jpg");
같나("이름이 비면 순번으로", outName("", "jpg", 4), "사진_005.jpg");

// ── 증명사진 규격 ───────────────────────────────────────────────
// 35mm 를 300dpi 로 → 35/25.4*300 = 413.38 → 413
같나("35mm 는 300dpi 에서 413점", mmToPx(35, 300), 413);
같나("45mm 는 300dpi 에서 531점", mmToPx(45, 300), 531);
같나("여권 규격 픽셀", specPixels(photoSpecs.find((s) => s.id === "passport")), { w: 413, h: 531 });

// 규격표가 «출처 없이» 늘어나지 않게 지킨다
for (const s of photoSpecs) {
  같나(`${s.label} 가로가 있다`, s.wMm > 0, true);
  같나(`${s.label} 세로가 있다`, s.hMm > 0, true);
  같나(`${s.label} 확인일이 있다`, /^\d{4}-\d{2}-\d{2}$/.test(s.checkedAt), true);
  // 머리 길이 안내선은 «둘 다 있거나 둘 다 없거나» 여야 한다
  같나(`${s.label} 머리 길이 짝이 맞는다`, (s.headMinMm == null) === (s.headMaxMm == null), true);
  if (s.headMinMm != null) {
    같나(`${s.label} 머리 길이 순서`, s.headMinMm < s.headMaxMm, true);
    같나(`${s.label} 머리가 사진보다 크지 않다`, s.headMaxMm < s.hMm, true);
  }
}
// ★공식 규격이 «있는» 것만 출처 링크를 갖는다. 없는 것을 있는 척하면 안 된다.
같나(
  "여권은 출처 링크가 있다",
  photoSpecs.find((s) => s.id === "passport").source.url.startsWith("https://"),
  true,
);
같나("이력서는 공식 규격이 없다고 말한다", photoSpecs.find((s) => s.id === "resume").source.url, "");

// 4×6인치 인화지 배치 — 여권(35×45mm)은 두 줄 넉넉히 들어간다
{
  const p = planSheet(photoSpecs.find((s) => s.id === "passport"));
  같나("인화지 픽셀(6×4인치·300dpi)", p.sheet, { w: 1800, h: 1200 });
  같나("한 줄에 4장", p.cols, 4);
  같나("두 줄", p.rows, 2);
  같나("모두 8장", p.total, 8);
  같나("여백이 음수가 아니다", p.padX >= 0 && p.padY >= 0, true);
  같나(
    "사진이 인화지를 안 넘는다",
    p.padX * 2 + p.cols * p.cell.w + (p.cols - 1) * p.gap <= p.sheet.w + 1,
    true,
  );
}
// 사진이 인화지보다 크면 0장이라고 «말해야» 한다 (음수가 나오면 화면이 깨진다)
{
  const 큰것 = { ...photoSpecs[0], wMm: 300, hMm: 400 };
  const p = planSheet(큰것);
  같나("안 들어가면 0장", p.total, 0);
  같나("0장이어도 여백이 음수가 아니다", p.padX >= 0 && p.padY >= 0, true);
}

// ── 글자수 ──────────────────────────────────────────────────────
같나("빈 글", countText("").withSpace, 0);
같나("빈 글은 줄도 0", countText("").lines, 0);

{
  const c = countText("안녕하세요 오즈백입니다");
  같나("공백 포함", c.withSpace, 12);
  같나("공백 제외", c.withoutSpace, 11);
  같나("낱말", c.words, 2);
  같나("한글은 UTF-8 에서 3바이트", c.bytesUtf8, 11 * 3 + 1);
  같나("한글은 EUC-KR 에서 2바이트", c.bytesEucKr, 11 * 2 + 1);
}

// ★이모지 — s.length 로 세면 2가 나온다. 사람은 1로 센다.
같나("이모지 한 개는 한 글자", 보이는글자수("🎒"), 1);
같나("살색 붙은 이모지도 한 글자", 보이는글자수("👍🏽"), 1);
같나("한글 한 글자", 보이는글자수("각"), 1);

{
  const c = countText("첫째 줄\n둘째 줄\n\n셋째 문단");
  같나("줄 수", c.lines, 4);
  같나("문단 수", c.paragraphs, 2);
  같나("줄바꿈만 뺀 글자수", c.withSpaceNoNewline, c.withSpace - 3);
}

{
  const c = countText("하나입니다. 둘입니다! 셋인가요? 넷은 끝이 없다");
  같나("문장 수", c.sentences, 4);
}

같나("영문은 EUC-KR 에서도 1바이트", eucKrBytes("abc"), 3);
같나("한자는 2바이트", eucKrBytes("漢"), 2);

같나("원고지 200자 한 장", countText("가".repeat(200)).wonngoji200, 1);
같나("201자면 두 장", countText("가".repeat(201)).wonngoji200, 2);
같나("한 자도 한 장", countText("가").wonngoji200, 1);

{
  const st = limitState(1200, 1000);
  같나("넘었다", st.over, true);
  같나("남은 것이 음수", st.left, -200);
  같나("비율", st.percent, 120);
}
같나("한도를 안 정했으면 넘은 게 아니다", limitState(5000, 0).over, false);

// ── 결과 ────────────────────────────────────────────────────────
console.log(`\n[사진·글자 도구 시험] 통과 ${통과} · 실패 ${실패.length}`);
if (실패.length) {
  for (const f of 실패) console.log("  ✗ " + f);
  process.exit(1);
}
console.log("✓ 전부 통과.\n");
