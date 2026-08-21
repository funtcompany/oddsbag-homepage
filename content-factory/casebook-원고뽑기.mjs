// 오즈백 — 케이스북 → 파일 원고(초안) 뽑기
//
// 왜 : data/casebook/*.json 은 «사실»이고, content/posts/*.json 은 «글»이다.
//      같은 사실을 두 곳에 손으로 적으면 반드시 어긋난다. 사실은 한 곳에만 두고 글은 뽑아 쓴다.
//
// ★AI 를 한 번도 부르지 않는다. 지어낼 여지를 없앤 것이 이 스크립트의 요점이다.
//   문장은 케이스북에 사람이 적어 둔 what/why/where 를 그대로 이어 붙인 것뿐이다.
//
// ★status 가 "live" 인 것만 뽑는다. unverified 는 아무도 안 읽은 것이라 글이 되지 않는다.
//   (검사기와 같은 규칙을 «두 번» 건다 — 한쪽만 고치는 실수를 막는다)
//
// ★--실행 없이는 아무것도 쓰지 않는다.
//
// 쓰는 법 (반드시 homepage/ 에서)
//   node content-factory/casebook-원고뽑기.mjs --시작일=2026-09-01
//   node content-factory/casebook-원고뽑기.mjs --시작일=2026-09-01 --실행

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { 검사하나 } from "./casebook-검사.mjs";
import { 존댓말, 평서체남았나 } from "./높임말.mjs";

const 값 = (이름, 기본 = "") => {
  const 앞 = `--${이름}=`;
  const 찾음 = process.argv.find((a) => a.startsWith(앞));
  return 찾음 === undefined ? 기본 : 찾음.slice(앞.length);
};
const 실행 = process.argv.includes("--실행");
const 덮어쓰기 = process.argv.includes("--덮어쓰기");

const CB_DIR = 값("케이스북", path.join(process.cwd(), "data", "casebook"));
const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const 간격일 = Number(값("간격", "1")) || 1;

const 한국날짜 = (d = new Date()) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const 날짜더하기 = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const 시작일 = 값("시작일") || 날짜더하기(한국날짜(), 1);

// 사건 이름에서 이모지를 고른다. 못 고르면 기본값 — 지어내지 않는다.
const 이모지표 = [
  [/면허|운전/, "🚗"], [/검진|건강|병원/, "🏥"], [/휴대폰|명의|통신/, "📱"],
  [/여권|출국|해외/, "🛂"], [/지갑|분실|잃/, "👛"], [/피싱|사기|보이스/, "🚨"],
  [/정전|전기|단수/, "💡"], [/계좌|카드|보험/, "🏦"],
];
const 이모지of = (s) => (이모지표.find(([re]) => re.test(s)) || [null, "📋"])[1];

const 시점순 = { "3분": 0, 오늘: 1, 이번주: 2, 한달: 3 };
const 시점말 = { "3분": "지금 당장 (3분)", 오늘: "오늘 안에", 이번주: "이번 주 안에", 한달: "한 달 안에" };

export function 원고만들기(c, 날짜) {
  const 단계 = [...c.steps].sort((a, b) => (시점순[a.when] ?? 9) - (시점순[b.when] ?? 9));
  const 첫걸음 = 단계[0];
  const 기관 = [...new Set(c.basis.map((b) => b.publisher).filter((p) => p && p !== "확인 필요"))];

  // ★케이스북은 «자료»라 평서체(…한다)로 적혀 있다. 글은 존댓말이다.
  //   이어 붙이기 «전에» 바꾼다. 안 바꾸면 「…조회한다입니다」가 나온다.
  const 높 = (t) => 존댓말(String(t || "")).글;
  // who 처럼 이름씨로 끝나는 칸은 종결어미가 없다. 그대로 두면 「…받은 사람」으로 끝난다.
  const 맺음 = (t) => {
    const v = 높(t).replace(/\s*[.]\s*$/, "");
    return /(니다)$/.test(v) ? v + "." : v + "입니다.";
  };
  // 문장 끝이 아니라 문장 «가운데» 들어갈 조각은 종결어미를 떼고 쓴다
  const 조각 = (t) => String(t || "").replace(/\s*[.]\s*$/, "");

  const 줄 = [];
  줄.push(`[즉답] ${높(첫걸음.what)} — ${조각(첫걸음.where)}`);
  줄.push(`[버전] ${기관.join(" · ") || "공공기관"} 안내 기준 · ${c.verifiedAt} 확인`);
  줄.push("");

  // ── 이럴 때 필요합니다
  줄.push("## 이럴 때 필요합니다");
  줄.push("");
  줄.push(`${맺음(c.situation)} 이 글은 그때 무엇부터 해야 하는지만 답합니다.`);
  줄.push("");
  줄.push(`해당되는 분 — ${맺음(c.who)}`);
  줄.push("");
  줄.push(
    "이런 일은 «무엇을 해야 하는지»보다 «무엇부터 해야 하는지»에서 막힙니다. " +
      "순서가 틀리면 한 번에 끝날 일을 두 번 세 번 하게 됩니다. " +
      `그래서 아래는 할 일을 늘어놓은 것이 아니라 ${단계.length}단계를 «시간 순»으로 세운 것입니다.`,
  );
  줄.push("");
  if (c.deadline?.kind === "법정") {
    줄.push(`★기한이 법으로 정해져 있는 항목입니다. ${높(c.deadline.text)}`);
    줄.push("");
  } else if (c.deadline?.kind === "안내") {
    줄.push(높(c.deadline.text));
    줄.push("");
  }

  // ── 이렇게 하면 됩니다
  줄.push("## 이렇게 하면 됩니다");
  줄.push("");
  let 앞시점 = null;
  for (const s of 단계) {
    if (s.when !== 앞시점) {
      if (앞시점 !== null) 줄.push("");
      줄.push(`### ${시점말[s.when] || s.when}`);
      앞시점 = s.when;
    }
    const 서류 = (s.docs || []).length ? ` (챙길 것: ${s.docs.join(" · ")})` : "";
    // ★[단계] 는 «한 줄에 한 걸음»으로 그려진다. 까닭을 [단계] 로 또 찍으면
    //   걸음이 두 배로 세어져 「6단계」라고 써 놓고 12개가 그려진다. 한 줄에 담는다.
    줄.push(`[단계] ${높(s.what)}${서류} — ${조각(s.where)}`);
    if (s.why) {
      줄.push("");
      줄.push(`왜 그런가 — ${높(s.why)}`);
      줄.push("");
    }
  }
  줄.push("");

  // ── 이건 조심하세요
  if ((c.volatile || []).length) {
    줄.push("## 이건 조심하세요");
    줄.push("");
    줄.push(
      "[주의] 아래 항목은 이 글에 «숫자를 적지 않았습니다» — 자주 바뀌기 때문입니다. " +
        "오래된 글에 적힌 금액이나 기간을 믿고 갔다가 헛걸음하는 일이 흔합니다. " +
        "아래 링크에서 오늘 값을 직접 확인하십시오.",
    );
    // ★이름표도 존댓말을 태운다. 안 태우면 「(수시로 넓어진다)」가 그대로 나간다
    for (const v of c.volatile) 줄.push(`[주의] ${높(조각(v.label))} → ${v.checkUrl}`);
    줄.push("");
  }

  // ── 이 방법이 안 될 때
  //   ★steps 를 다시 쓰지 않는다. 앞에서 이미 시킨 것을 「안 될 때」로 또 내놓으면
  //     읽는 사람은 대안을 못 받는다. 케이스북에 alts 를 적어 둔 것만 낸다.
  if ((c.alts || []).length) {
    줄.push("## 이 방법이 안 될 때");
    줄.push("");
    for (const a of c.alts) 줄.push(`[대안] ${높(a.what)} — ${조각(a.where)}`);
    줄.push("");
  }

  // ── 자주 묻는 질문
  줄.push("## 자주 묻는 질문");
  줄.push("");
  줄.push("[Q] 무엇부터 해야 하나요?");
  줄.push(`[A] ${맺음(첫걸음.what)} ${조각(첫걸음.where)} 에서 합니다.`);
  줄.push("");
  줄.push("[Q] 누가 해당되나요?");
  줄.push(`[A] ${맺음(c.who)}`);
  줄.push("");
  // ★deadline.text 에 「다만 …」이 이미 들어 있는 항목이 있다. 덧붙이면 같은 말이 두 번 나온다.
  줄.push(c.deadline?.kind === "없음" ? "[Q] 언제까지 해야 하나요?" : "[Q] 기한이 있나요?");
  줄.push(`[A] ${맺음(c.deadline.text)}`);
  줄.push("");
  줄.push("[Q] 이 글에 적힌 내용은 언제 확인한 것인가요?");
  줄.push(
    `[A] ${c.verifiedAt} 에 ${기관.join(" · ") || "해당 기관"} 안내 화면을 직접 열어 확인했습니다. ` +
      "제도는 바뀌므로 위 링크에서 오늘 값을 함께 보십시오.",
  );
  줄.push("");

  // ── 한 줄 정리
  줄.push("## 오즈백 한 줄 정리");
  줄.push("");
  줄.push(`${맺음(c.oneLine || 첫걸음.what)} 이것부터 하면 나머지는 순서대로 풀립니다.`);

  const body = 줄.join("\n");

  // ★뽑고 나서 «평서체가 남았는지» 스스로 본다. 남으면 조용히 내보내지 않는다.
  const 남은 = 평서체남았나(body);
  if (남은.length) {
    console.warn(`  ⚠ ${c.id} — 평서체로 끝나는 줄 ${남은.length}개:`);
    for (const l of 남은.slice(0, 5)) console.warn(`      ${l.slice(0, 70)}`);
  }

  const 제목 = c.title || `${c.situation} — 무엇부터 해야 하나`;
  return {
    slug: c.id,
    channel: "magazine",
    title: 제목,
    summary:
      c.summary ||
      `${c.situation} 상황에서 3분 안에 할 일부터 한 달 안에 할 일까지, ${기관.join("·") || "공공기관"} 안내를 확인해 시간 순으로 정리했습니다.`,
    category: "꿀팁",
    date: 날짜,
    status: "draft",
    emoji: 이모지of(c.situation + c.id),
    readMinutes: Math.max(3, Math.min(9, Math.ceil(body.length / 700))),
    tags: [...new Set([...(c.tags || []), ...기관])].slice(0, 5),
    createdAt: new Date().toISOString(),
    body,
    // ★케이스북 글은 뉴스가 아니다 — sitemap-news.xml 에서 뺀다 (기획안 8/18 §8)
    casebook: c.id,
    factsCheckedAt: c.verifiedAt,
    sources: c.basis.map((b) => ({ title: b.title, url: b.url })),
  };
}

function main() {
  const 파일들 = fs.readdirSync(CB_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("._") && !f.startsWith("_"));
  const 뽑을것 = [];
  const 건너뜀 = [];

  for (const f of 파일들) {
    const c = JSON.parse(fs.readFileSync(path.join(CB_DIR, f), "utf-8"));
    const r = 검사하나(c, f);
    if (!r.발행가능) { 건너뜀.push([c.id || f, r.발행막힘 || "발행 불가"]); continue; }
    뽑을것.push(c);
  }
  뽑을것.sort((a, b) => (a.id < b.id ? -1 : 1));

  console.log(`\n[케이스북 원고뽑기] 케이스북 ${파일들.length}건 · 뽑을 것 ${뽑을것.length}건\n`);
  for (const [id, why] of 건너뜀) console.log(`  ⏸ ${id} — ${why}`);
  if (건너뜀.length) console.log("");

  // 매거진은 코너별 하루 1편이므로 날짜를 하루씩 벌린다
  const 계획 = 뽑을것.map((c, i) => ({ c, 날짜: 날짜더하기(시작일, i * 간격일) }));
  for (const { c, 날짜 } of 계획) {
    const p = 원고만들기(c, 날짜);
    console.log(`  · ${날짜}  ${p.slug} · ${p.emoji} ${p.title}`);
    console.log(`      ${p.body.split("\n").length}줄 · 약 ${p.readMinutes}분 · 출처 ${p.sources.length}개`);
  }

  if (!실행) {
    console.log(`\n[계획만 보여줬다. 아무것도 쓰지 않았다]`);
    console.log(`실제로 뽑으려면 뒤에 --실행 을 붙인다.`);
    return;
  }

  fs.mkdirSync(POSTS_DIR, { recursive: true });
  let 쓴것 = 0;
  for (const { c, 날짜 } of 계획) {
    const 파일 = path.join(POSTS_DIR, `${c.id}.json`);
    if (fs.existsSync(파일) && !덮어쓰기) {
      console.log(`  ⏭  ${c.id} — 파일이 이미 있다. 덮어쓰려면 --덮어쓰기`);
      continue;
    }
    fs.writeFileSync(파일, JSON.stringify(원고만들기(c, 날짜), null, 2) + "\n");
    쓴것++;
  }
  console.log(`\n✓ ${쓴것}편 → content/posts/`);
  console.log(`  ★이 원고들은 AI 품질 심사를 «거치지 않는다». 사람이 한 번 눈으로 볼 것.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
