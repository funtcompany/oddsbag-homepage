// 오즈백 — 케이스북 검사기
//
// 왜 : 케이스북 원고는 파일 원고(content/posts)로 나가는데, 파일 원고는
//      AI 품질 심사(quality)를 «통째로 건너뛴다» — run-daily.mjs 는 store 와 indexnow 만 부른다.
//      즉 케이스북에는 자동 관문이 하나도 없다. 이 검사기가 그 자리를 대신한다.
//      사람 눈 + 이 검사기, 둘뿐이다.
//
// 무엇을 막나 (기획안 8/18 §5 장치 5)
//   ① status:"unverified" 는 발행 후보가 아니다 — 아무도 안 읽은 것이 나가지 않게
//   ② verifiedAt 이 null 이면 발행 후보가 아니다 (①과 따로 건다 — 한쪽만 고쳐 놓는 실수를 잡는다)
//   ③ deadline.kind 가 "법정" 인데 basisRef 가 비면 탈락 — 법정 기한은 조문 옆에서만 산다
//   ④ basisRef 가 없는 basis id 를 가리키면 탈락
//   ⑤ 금액·비율·수수료 칸이 있으면 탈락 — 값은 담지 않는다. 담을 칸이 없어야 틀릴 수가 없다
//   ⑥ volatile[] 에 값이 붙어 있으면 탈락 (label + checkUrl 만 허용)
//   ⑦ verifiedAt 이 «미래»면 탈락 — 원안이 실제로 저지른 짓이다(확인일을 이틀 뒤로 적었다)
//   ⑧ applies.have 에 어휘표(data/casebook-vocab.json)에 없는 이름이 있으면 탈락
//      — 오타 하나면 「챙길 것」 화면에서 «조용히 사라진다». 아무도 못 알아챈다
//   ⑨ applies 에 나이 조건(ageFrom/ageTo)이 있는데 ageBasisRef 가 없거나 없는 basis 를
//      가리키면 탈락 — 나이 조건도 법정 기한과 같다. 근거 옆에서만 산다
//   ⑩ applies 가 없거나 everyone 도 false 이고 have 도 비면 경고 — 도구에 안 뜬다
//   ⑪ applies.ageNotes[] (나이대별 주의문) 도 각자 basisRef 를 달아야 한다 —
//      나이대에서만 뜨는 문장이라 틀려도 아무도 못 본다. 근거 없이는 못 뜬다
//   ⑫ yearBound(「올해 안에」 묶음에 들어가는 표시) 는 kind·text·basisRef 가 다 있어야 한다 —
//      «올해 지나면 없어진다» 는 강한 말이다. 근거 없이 붙이면 사람을 헛되이 서두르게 한다.
//      해가 바뀌면 다시 시작하는 것(건강검진처럼)만 여기 들어간다. 개인별 만료일은 아니다
//
// 쓰는 법
//   node content-factory/casebook-검사.mjs                  data/casebook 전부
//   node content-factory/casebook-검사.mjs --폴더=미끼경로   미끼 시험용

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const 값 = (이름, 기본 = "") => {
  const 앞 = `--${이름}=`;
  const 찾음 = process.argv.find((a) => a.startsWith(앞));
  return 찾음 === undefined ? 기본 : 찾음.slice(앞.length);
};

const 폴더 = 값("폴더", path.join(process.cwd(), "data", "casebook"));
const 조용히 = process.argv.includes("--조용히");

const 한국날짜 = (d = new Date()) =>
  new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const 금지칸 = ["amount", "rate", "fee", "price", "cost", "금액", "수수료", "과태료"];

// 「가진 것」 어휘표는 화면과 «같은 파일» 을 읽는다. 두 곳에 적으면 반드시 어긋난다.
const 어휘파일 = path.join(process.cwd(), "data", "casebook-vocab.json");
const 허용가진것 = new Set(
  fs.existsSync(어휘파일)
    ? JSON.parse(fs.readFileSync(어휘파일, "utf-8")).have.map((h) => h.id)
    : [],
);
const 허용상태 = ["unverified", "live", "watch", "linkonly"];
const 허용시점 = ["3분", "오늘", "이번주", "한달"];

// 어느 칸에든 금지 이름이 박혀 있으면 잡는다 (중첩까지 훑는다)
function 금지칸찾기(o, 길 = "") {
  const 나온것 = [];
  if (Array.isArray(o)) {
    o.forEach((v, i) => 나온것.push(...금지칸찾기(v, `${길}[${i}]`)));
  } else if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) {
      if (금지칸.includes(k)) 나온것.push(`${길}.${k}`);
      나온것.push(...금지칸찾기(v, `${길}.${k}`));
    }
  }
  return 나온것;
}

export function 검사하나(c, 파일명 = "") {
  const 탈락 = [];
  const 경고 = [];
  const 오늘 = 한국날짜();

  // ─ 기본 칸
  if (!c.id) 탈락.push("id 가 없다");
  else if (파일명 && 파일명 !== `${c.id}.json`) 탈락.push(`id(${c.id}) 와 파일명(${파일명}) 이 다르다`);
  if (!c.situation) 탈락.push("situation(사건) 이 비었다");
  if (!c.who) 경고.push("who(누가 해당되나) 가 비었다");

  // ─ ⑤ 금액 칸 금지
  const 금지 = 금지칸찾기(c);
  if (금지.length) 탈락.push(`값을 담는 칸이 있다 — ${금지.join(", ")} (케이스북은 값을 담지 않는다)`);

  // ─ steps
  if (!Array.isArray(c.steps) || c.steps.length === 0) 탈락.push("steps 가 비었다");
  else
    c.steps.forEach((s, i) => {
      if (!s.what) 탈락.push(`steps[${i}].what 이 비었다`);
      if (!s.when) 탈락.push(`steps[${i}].when 이 비었다`);
      else if (!허용시점.includes(s.when))
        탈락.push(`steps[${i}].when 이 "${s.when}" — ${허용시점.join("/")} 중 하나여야 한다`);
      if (!s.where) 경고.push(`steps[${i}].where 가 비었다 (어디로 가는지 없으면 못 따라 한다)`);
      if (!s.why) 경고.push(`steps[${i}].why 가 비었다`);
    });

  // ─ basis
  const basis = Array.isArray(c.basis) ? c.basis : [];
  const basisId = new Set();
  if (basis.length === 0) 탈락.push("basis(근거) 가 하나도 없다");
  basis.forEach((b, i) => {
    if (!b.id) 탈락.push(`basis[${i}].id 가 없다 — basisRef 가 가리킬 대상이다`);
    else if (basisId.has(b.id)) 탈락.push(`basis id 가 겹친다: ${b.id}`);
    else basisId.add(b.id);
    if (!b.url) 탈락.push(`basis[${i}] 에 url 이 없다`);
    if (!b.publisher) 경고.push(`basis[${i}] 에 publisher(펴낸 곳) 가 없다`);
    if (b.checkedAt && b.checkedAt > 오늘) 탈락.push(`basis[${i}].checkedAt 이 미래다 (${b.checkedAt})`);
  });

  // ─ ③④ deadline
  const d = c.deadline;
  if (!d || !d.kind) 탈락.push("deadline.kind 가 없다 (법정 / 안내 / 없음)");
  else if (d.kind === "법정") {
    if (!d.basisRef) 탈락.push("deadline.kind 가 «법정» 인데 basisRef 가 비었다 — 법정 기한은 조문 옆에서만 산다");
    else if (!basisId.has(d.basisRef)) 탈락.push(`deadline.basisRef(${d.basisRef}) 가 없는 basis id 를 가리킨다`);
  }

  // ─ ⑫ yearBound — 「올해 안에」 묶음
  const yb = c.yearBound;
  if (yb !== undefined && yb !== null) {
    const 허용 = ["연말", "연초"];
    if (!허용.includes(yb.kind)) {
      탈락.push(`yearBound.kind 는 ${허용.join(" / ")} 중 하나여야 한다 (지금: ${yb.kind})`);
    }
    if (!yb.text) 탈락.push("yearBound.text 가 비었다 — 무엇이 해마다 다시 시작하는지 적어야 한다");
    if (!yb.basisRef) {
      탈락.push("yearBound 에 basisRef 가 없다 — «올해 지나면 없어진다» 는 근거 옆에서만 산다");
    } else if (!basisId.has(yb.basisRef)) {
      탈락.push(`yearBound.basisRef(${yb.basisRef}) 가 없는 basis id 를 가리킨다`);
    }
    const 남는칸 = Object.keys(yb).filter((k) => !["kind", "text", "basisRef"].includes(k));
    if (남는칸.length) 탈락.push(`yearBound 에 다른 칸이 있다: ${남는칸.join(",")}`);
  }

  // ─ ⑥ volatile 은 이름과 링크만
  (Array.isArray(c.volatile) ? c.volatile : []).forEach((v, i) => {
    if (!v.label) 탈락.push(`volatile[${i}].label 이 비었다`);
    const 남는칸 = Object.keys(v).filter((k) => !["label", "checkUrl"].includes(k));
    if (남는칸.length) 탈락.push(`volatile[${i}] 에 label·checkUrl 말고 다른 칸이 있다: ${남는칸.join(",")}`);
  });

  // ─ ⑧⑨⑩ applies — 「챙길 것」 이 이 칸으로 고른다
  const a = c.applies;
  if (!a || typeof a !== "object") {
    경고.push("applies 가 없다 — 「챙길 것」 화면에 아예 안 뜬다");
  } else {
    const have = Array.isArray(a.have) ? a.have : [];
    const 모름 = have.filter((h) => !허용가진것.has(h));
    if (모름.length)
      탈락.push(
        `applies.have 에 어휘표에 없는 이름이 있다: ${모름.join(", ")} ` +
          `(쓸 수 있는 것 — ${[...허용가진것].join(" / ")})`,
      );
    if (!a.everyone && have.length === 0)
      경고.push("applies 에 everyone 도 have 도 없다 — 아무에게도 안 뜬다");
    const 나이있음 = a.ageFrom != null || a.ageTo != null;
    if (나이있음) {
      if (!a.ageBasisRef)
        탈락.push("applies 에 나이 조건이 있는데 ageBasisRef 가 없다 — 나이 조건은 근거 옆에서만 산다");
      else if (!basisId.has(a.ageBasisRef))
        탈락.push(`applies.ageBasisRef(${a.ageBasisRef}) 가 없는 basis id 를 가리킨다`);
      if (a.ageFrom != null && a.ageTo != null && Number(a.ageFrom) > Number(a.ageTo))
        탈락.push(`applies 의 나이 범위가 뒤집혔다 (${a.ageFrom} ~ ${a.ageTo})`);
    }
    // ⑪ 나이대별 주의문
    (Array.isArray(a.ageNotes) ? a.ageNotes : []).forEach((n, i) => {
      if (!n.text) 탈락.push(`applies.ageNotes[${i}].text 이 비었다`);
      if (n.from == null && n.to == null)
        탈락.push(`applies.ageNotes[${i}] 에 나이대(from/to)가 없다 — 그러면 주의문이 아니다`);
      if (!n.basisRef) 탈락.push(`applies.ageNotes[${i}] 에 basisRef 가 없다 — 근거 없이 뜨는 문장은 못 둔다`);
      else if (!basisId.has(n.basisRef))
        탈락.push(`applies.ageNotes[${i}].basisRef(${n.basisRef}) 가 없는 basis id 를 가리킨다`);
    });
  }

  // ─ status / verifiedAt
  if (!허용상태.includes(c.status)) 탈락.push(`status 가 "${c.status}" — ${허용상태.join("/")} 중 하나여야 한다`);
  if (c.verifiedAt && c.verifiedAt > 오늘) 탈락.push(`verifiedAt 이 미래다 (${c.verifiedAt}) — 확인일을 지어내면 이 설계가 통째로 무의미해진다`);
  if (c.status !== "unverified" && !c.verifiedAt)
    탈락.push(`status 가 "${c.status}" 인데 verifiedAt 이 비었다 — 안 읽고 확인 상태로 올릴 수 없다`);
  if (!Number.isFinite(Number(c.recheckDays))) 경고.push("recheckDays 가 없다");

  // ─ ①② 발행 자격
  const 발행가능 = 탈락.length === 0 && c.status !== "unverified" && Boolean(c.verifiedAt);
  const 발행막힘 =
    탈락.length > 0 ? "검사 탈락" :
    c.status === "unverified" ? "status 가 unverified — 아직 아무도 안 읽었다" :
    !c.verifiedAt ? "verifiedAt 이 비었다" : null;

  return { id: c.id || 파일명, 탈락, 경고, 발행가능, 발행막힘 };
}

function main() {
  if (!fs.existsSync(폴더)) {
    console.error(`✗ 폴더가 없다: ${폴더}`);
    process.exit(1);
  }
  const 파일들 = fs.readdirSync(폴더).filter((f) => f.endsWith(".json") && !f.startsWith("._") && !f.startsWith("_"));
  if (파일들.length === 0) {
    console.log(`[케이스북 검사] ${폴더} — 항목이 없다`);
    return;
  }

  let 탈락수 = 0, 발행가능수 = 0;
  console.log(`\n[케이스북 검사] ${파일들.length}건 · ${path.relative(process.cwd(), 폴더)}\n`);
  for (const f of 파일들) {
    let c;
    try {
      c = JSON.parse(fs.readFileSync(path.join(폴더, f), "utf-8"));
    } catch (e) {
      console.log(`  ✗ ${f} — JSON 이 깨졌다: ${e.message}`);
      탈락수++;
      continue;
    }
    const r = 검사하나(c, f);
    if (r.탈락.length) 탈락수++;
    if (r.발행가능) 발행가능수++;

    const 표 = r.탈락.length ? "✗" : r.발행가능 ? "✓" : "⏸";
    console.log(`  ${표} ${r.id}${r.발행가능 ? " — 발행 가능" : r.발행막힘 ? ` — 발행 안 됨: ${r.발행막힘}` : ""}`);
    for (const t of r.탈락) console.log(`      탈락 · ${t}`);
    if (!조용히) for (const w of r.경고) console.log(`      경고 · ${w}`);
  }

  console.log(`\n  전체 ${파일들.length} · 탈락 ${탈락수} · 발행 가능 ${발행가능수} · 확인 대기 ${파일들.length - 탈락수 - 발행가능수}`);
  if (탈락수) {
    console.error(`\n✗ 탈락 ${탈락수}건. 고치기 전에는 원고를 뽑지 않는다.`);
    process.exit(1);
  }
  console.log(`\n✓ 탈락 없음.`);
}

// ★`file://${process.argv[1]}` 로 비교하면 안 된다 — 경로에 공백(«FUNT WORK»)이 있으면
//   import.meta.url 은 %20 으로 인코딩돼 있어 «항상 거짓»이 되고, 아무 말 없이 조용히 끝난다.
//   실제로 미끼 시험에서 출력이 통째로 안 나와 잡았다. pathToFileURL 로 같은 규칙을 태운다.
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
