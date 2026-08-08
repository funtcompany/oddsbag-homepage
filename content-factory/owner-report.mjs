// 【대표 보고】 주 2회(월·목) 사장님께 현황·상태를 메일로 보낸다.
//
// 왜 만들었나 (2026-08-08)
//   2일 1회 '점검 리포트'는 품질(발행·검수) 이야기만 한다. 사장님이 알고 싶은 건
//   "지금 어디까지 왔고, 뭐가 늘었고, 내가 결정해줄 게 뭐냐" 인데 그걸 말해주는 게 없었다.
//
// 이 보고서의 규칙 — 지어내지 않는다
//   · 숫자는 전부 실제로 잰 것만 쓴다. 못 잰 항목은 "못 쟀음"이라고 쓴다.
//     (0으로 적으면 "해봤는데 0" 처럼 읽혀서 판단을 망친다. 이건 다른 뜻이다)
//   · "무엇을 했나"는 AI가 요약하지 않고 git 기록에서 그대로 가져온다.
//     사람이 쓴 커밋 제목이 실제로 한 일이다. 요약하면 없는 성과가 섞인다.
//   · "결정이 필요한 것"은 보고/결정대기.md 에 적힌 것만 싣는다. 없으면 없다고 쓴다.
//
// 쓰는 법
//   node owner-report.mjs              보고서 만들고 메일 발송
//   node owner-report.mjs --출력만      메일 안 보내고 화면에만

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kvGet, smembers } from "./store.mjs";
import { getPublishedRaw } from "./posts.mjs";
import { sendEmail, emailEnabled } from "./email.mjs";

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const OWNER = process.env.OWNER_EMAIL || "tjdrhks2826@gmail.com";
const 메일안보냄 = process.argv.includes("--출력만");

const KST = () => new Date(Date.now() + 9 * 3600e3);
const 날짜 = (d) => d.toISOString().slice(0, 10);

// 성적표는 크론이 돌 때만 쌓인다. 오늘 것이 아직 없을 수 있으니 뒤로 며칠 훑는다.
async function 최근성적표(건너뛸날 = 0, 최대 = 8) {
  for (let i = 건너뛸날; i < 건너뛸날 + 최대; i++) {
    const key = `channel:report:${날짜(new Date(KST().getTime() - i * 864e5))}`;
    try {
      const raw = await kvGet(key);
      if (raw) return { ...(typeof raw === "string" ? JSON.parse(raw) : raw), _몇일전: i };
    } catch { /* 다음 날짜로 */ }
  }
  return null;
}

// 증감 표시 — 비교 대상이 없으면 "―" 로 둔다. 0 이라고 쓰지 않는다(뜻이 다르다).
function 증감(지금, 전) {
  if (지금 == null || 전 == null) return "―";
  const d = 지금 - 전;
  if (d === 0) return "그대로";
  return `${d > 0 ? "▲" : "▼"} ${Math.abs(d).toLocaleString()}`;
}

// 지난 보고 이후 실제로 바뀐 것 = 커밋 제목. 요약하지 않고 그대로 가져온다.
function 바뀐것(일수) {
  try {
    const out = execSync(`git log --since="${일수} days ago" --no-merges --pretty=format:%s`, {
      cwd: path.join(여기, ".."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out ? out.split("\n") : [];
  } catch {
    return null; // git 을 못 읽는 환경 — 없는 것과 구별한다
  }
}

function 결정대기() {
  const p = path.join(여기, "..", "..", "보고", "결정대기.md");
  try {
    const t = fs.readFileSync(p, "utf8").trim();
    return t || null;
  } catch {
    return null;
  }
}

async function 모으기() {
  const 이번 = await 최근성적표(0);
  // 주 2회 보고라 3~4일 전 성적표와 비교한다
  const 지난 = 이번 ? await 최근성적표(이번._몇일전 + 3) : null;

  let 구독자 = null;
  try {
    구독자 = (await smembers("subscribers")).length;
  } catch { /* 못 쟀음 */ }

  let 발행글 = null;
  try {
    발행글 = (await getPublishedRaw()).length;
  } catch { /* 못 쟀음 */ }

  return { 이번, 지난, 구독자, 발행글, 바뀐것: 바뀐것(4), 결정: 결정대기() };
}

function 줄글(d) {
  const L = [];
  const y = d.이번?.유튜브, y0 = d.지난?.유튜브;
  const 릴 = d.이번?.형식별?.["릴스"], 릴0 = d.지난?.형식별?.["릴스"];

  L.push(`■ 오즈백 현황 — ${날짜(KST())}`);
  L.push("");

  if (!d.이번) {
    L.push("성적표가 아직 없습니다. 릴스 워크플로가 한 번 돌면 채워집니다.");
  } else if (d.이번._몇일전 > 0) {
    L.push(`※ 오늘 성적표가 아직 없어 ${d.이번._몇일전}일 전 숫자로 씁니다.`);
    L.push("");
  }

  L.push("[채널]");
  if (y) {
    L.push(`  유튜브   구독 ${y.구독자}명 · 총조회 ${y.총조회수.toLocaleString()}회 (${증감(y.총조회수, y0?.총조회수)})`);
    L.push(`           공개영상 ${y.공개영상수}개 · 편당 평균 ${y.평균조회수}회`);
  } else {
    L.push("  유튜브   못 쟀음 (자격증명 또는 하루 한도 확인 필요)");
  }
  if (릴) {
    L.push(`  인스타   팔로워 ${d.이번.팔로워}명 · 릴스 평균도달 ${릴.평균도달} · 참여율 ${릴.참여율}%`);
    L.push(`           평균시청 ${릴.평균시청초}초 (${증감(릴.평균시청초, 릴0?.평균시청초)})`);
  } else {
    L.push("  인스타   못 쟀음");
  }
  L.push(`  홈페이지 발행글 ${d.발행글 ?? "못 쟀음"}편`);
  L.push(`  명단     구독자 ${d.구독자 ?? "못 쟀음"}명   ← 인스타가 정지돼도 남는 유일한 자산`);
  L.push("");

  L.push("[지난 보고 이후 한 일]");
  if (d.바뀐것 === null) L.push("  기록을 못 읽었습니다.");
  else if (!d.바뀐것.length) L.push("  코드 변경 없음.");
  else {
    // 메일이 길면 안 읽힌다. 12건까지만 싣고 나머지는 숫자로 알린다.
    // 자르되 '몇 건을 잘랐는지'는 반드시 밝힌다 — 안 밝히면 이게 전부인 줄 안다.
    const 보일것 = d.바뀐것.slice(0, 12);
    보일것.forEach((c) => L.push(`  · ${c}`));
    if (d.바뀐것.length > 보일것.length)
      L.push(`  … 외 ${d.바뀐것.length - 보일것.length}건 (전체는 git 기록에)`);
  }
  L.push("");

  L.push("[대표님 결정이 필요한 것]");
  L.push(d.결정 ? d.결정.split("\n").map((x) => "  " + x).join("\n") : "  없습니다.");
  return L.join("\n");
}

// 지메일 다크모드가 background-color 를 지우고 글자를 뒤집는다.
// 그래서 배경은 반드시 그라디언트로도 함께 지정한다 (CLAUDE.md 뉴스레터 규칙).
const 배경 = (c) => `background-color:${c};background-image:linear-gradient(${c},${c});`;

function html(d) {
  const 본문 = 줄글(d)
    .split("\n")
    .map((l) => {
      if (l.startsWith("■")) return `<div style="font-size:19px;font-weight:700;color:#FFE600;padding:0 0 14px">${l.slice(1).trim()}</div>`;
      if (l.startsWith("[")) return `<div style="font-size:14px;font-weight:700;color:#FFE600;padding:18px 0 6px">${l}</div>`;
      if (!l.trim()) return `<div style="height:6px"></div>`;
      return `<div style="font-size:14px;line-height:1.75;color:#f3eefc;white-space:pre">${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>`;
    })
    .join("");
  return `<div style="${배경("#1c1530")}padding:26px;font-family:-apple-system,'Apple SD Gothic Neo',sans-serif">
<div style="${배경("#241a3d")}max-width:600px;margin:0 auto;padding:26px;border-radius:14px">
${본문}
<div style="padding:22px 0 0"><a href="https://oddsbag.co.kr" style="${배경("#5B2D8E")}color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:700;display:inline-block">오즈백 열기</a></div>
</div></div>`;
}

async function main() {
  const d = await 모으기();
  const 글 = 줄글(d);
  console.log("\n" + 글 + "\n");

  // 사람이 나중에 찾아볼 수 있게 파일로도 남긴다
  try {
    const 폴더 = path.join(여기, "..", "..", "보고");
    fs.mkdirSync(폴더, { recursive: true });
    fs.writeFileSync(path.join(폴더, `현황_${날짜(KST())}.md`), 글 + "\n");
  } catch (e) {
    console.log("파일 저장 건너뜀:", e.message);
  }

  if (메일안보냄) return console.log("(--출력만 이라 메일은 보내지 않았습니다)");
  if (!emailEnabled) return console.log("RESEND_API_KEY 가 없어 메일을 못 보냅니다.");
  await sendEmail(OWNER, `[오즈백] 현황 보고 — ${날짜(KST())}`, html(d));
  console.log(`메일 보냄 → ${OWNER}`);
}

main().catch((e) => {
  console.error("대표 보고 실패:", e.message);
  process.exitCode = 1;
});
