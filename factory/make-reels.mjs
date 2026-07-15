// 오즈백 영상 공장 — GitHub Actions에서 돌아간다.
//  1) 홈페이지에서 오늘 릴스로 만들 글을 받아온다 (/api/reel/pending)
//  2) 매니페스트를 읽고 카드별 나레이션(구글 Chirp3-HD)을 만든다
//  3) 세로화면 프레임(1080×1920)을 홈페이지에서 내려받는다 (/api/reel/[slug]?c&f)
//  4) ffmpeg로 이어붙이고 트렌디 BGM을 은은하게 깔아 mp4를 만든다
//  5) (선택) 유튜브 쇼츠 + 인스타 릴스에 자동 게시
//  6) 완료를 홈페이지에 알린다 (/api/reel/done) → 중복 제작 방지
//
// 필요한 환경변수(=GitHub Secrets):
//   SITE_URL, CRON_SECRET, GOOGLE_TTS_API_KEY
//   (게시용) YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
//   (게시용) INSTAGRAM_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN, MEDIA_PUBLIC_BASE

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { makeMusic, writeWav } from "./music.mjs";
import { uploadShort } from "./youtube.mjs";
import { postReel } from "./instagram.mjs";

const SITE = (process.env.SITE_URL || "https://oddsbag.co.kr").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET || "";
const TTS_KEY = process.env.GOOGLE_TTS_API_KEY;
const VOICE = process.env.ODDS_VOICE || "ko-KR-Chirp3-HD-Aoede";
const LIMIT = Number(process.env.REEL_LIMIT || 1);
const OUT = path.resolve("out");
fs.mkdirSync(OUT, { recursive: true });

const authHeader = SECRET ? { authorization: `Bearer ${SECRET}` } : {};
const sh = (c) => execSync(c, { stdio: "inherit" });
const probe = (f) => parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`).toString().trim());

// 쉼표(280ms)·문장끝(450ms)에서 자연스럽게 쉬도록 SSML로
function ssmlFor(text) {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const b = esc.replace(/([,、])\s*/g, '$1<break time="280ms"/>').replace(/([.!?。])\s+/g, '$1<break time="450ms"/>');
  return `<speak>${b}</speak>`;
}

async function tts(text, outPath) {
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: { ssml: ssmlFor(text) }, voice: { languageCode: "ko-KR", name: VOICE }, audioConfig: { audioEncoding: "MP3", speakingRate: 1.06 } }),
  });
  const j = await res.json();
  if (!j.audioContent) throw new Error("TTS 실패: " + JSON.stringify(j).slice(0, 200));
  fs.writeFileSync(outPath, Buffer.from(j.audioContent, "base64"));
}

async function download(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`다운로드 실패 ${res.status}: ${url}`);
  fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
}

async function buildReel(item) {
  const slug = item.slug;
  const work = path.join(OUT, slug);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  console.log(`\n▶ ${slug} — ${item.title}`);

  // 1) 매니페스트
  const man = await (await fetch(`${SITE}/api/reel/${slug}`, { headers: authHeader })).json();
  const { fps, enterFrames, total, bgmStyle, cards } = man;

  // 2) 나레이션 + 카드 길이
  const offsets = []; let acc = 0;
  for (let i = 0; i < cards.length; i++) {
    const mp3 = path.join(work, `n${i}.mp3`);
    await tts(cards[i].say, mp3);
    cards[i].narr = mp3;
    const d = Math.max(2.6, probe(mp3) + 0.75);
    offsets.push(acc); acc += d; cards[i].dur = d;
  }
  const totalDur = acc;

  // 3) 프레임 다운로드 + 4) 카드별 클립
  const clips = [];
  for (let c = 0; c < total; c++) {
    const cdir = path.join(work, `c${c}`); fs.mkdirSync(cdir, { recursive: true });
    for (let f = 0; f < enterFrames; f++) {
      await download(`${SITE}/api/reel/${slug}?c=${c}&f=${f}`, path.join(cdir, `${String(f).padStart(3, "0")}.png`));
    }
    const hold = (cards[c].dur - enterFrames / fps).toFixed(3);
    const clip = path.join(work, `clip${c}.mp4`);
    sh(`ffmpeg -y -framerate ${fps} -i "${cdir}/%03d.png" -vf "tpad=stop_mode=clone:stop_duration=${hold},format=yuv420p,fps=${fps}" -c:v libx264 -preset medium -crf 18 "${clip}"`);
    clips.push(clip);
  }
  const listFile = path.join(work, "list.txt");
  fs.writeFileSync(listFile, clips.map((c) => `file '${c}'`).join("\n"));
  const silent = path.join(work, "video.mp4");
  sh(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${silent}"`);

  // 5) 트렌디 BGM (은은한 고정 볼륨) + 나레이션 믹스
  const music = path.join(work, "music.wav");
  writeWav(music, makeMusic(bgmStyle, totalDur));
  const inputs = [`-i "${silent}"`, `-i "${music}"`, ...cards.map((c) => `-i "${c.narr}"`)];
  let fc = "";
  const v = [];
  cards.forEach((c, i) => { const d = Math.round((offsets[i] + 0.35) * 1000); fc += `[${i + 2}:a]adelay=${d}|${d},volume=2.1[v${i}];`; v.push(`[v${i}]`); });
  fc += `${v.join("")}amix=inputs=${v.length}:normalize=0[voice];`;
  fc += `[1:a]highpass=f=60,volume=0.22,afade=t=in:st=0:d=0.8[bg];`;
  fc += `[bg][voice]amix=inputs=2:normalize=0,alimiter=limit=0.95,afade=t=out:st=${(totalDur - 0.6).toFixed(2)}:d=0.6[a]`;
  const final = path.join(OUT, `${slug}.mp4`);
  sh(`ffmpeg -y ${inputs.join(" ")} -filter_complex "${fc}" -map 0:v -map "[a]" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest "${final}"`);
  console.log(`  ✅ 완성: ${final} (${totalDur.toFixed(1)}초, BGM:${bgmStyle})`);

  // 6) (선택) 게시 — 자격증명이 있을 때만
  const caption = `${man.title}\n\n전체 글 → 프로필 링크 (oddsbag.co.kr)`;
  const posted = { yt: null, ig: null };
  const ytPrivacy = process.env.YT_PRIVACY || "public"; // 초기엔 unlisted 로 두고 검토 후 public
  try { posted.yt = await uploadShort(final, { title: `${man.title} #Shorts`, description: caption, tags: [man.category, "오즈백", "이슈", "쇼츠"], privacy: ytPrivacy }); }
  catch (e) { console.log("  · 유튜브 건너뜀:", e.message); }
  try { posted.ig = await postReel(final, slug, caption); }
  catch (e) { console.log("  · 인스타 건너뜀:", e.message); }

  fs.rmSync(work, { recursive: true, force: true }); // 프레임/중간물 정리 (최종 mp4는 out/에 유지)
  return posted;
}

async function main() {
  if (!TTS_KEY) throw new Error("GOOGLE_TTS_API_KEY 필요");
  const res = await fetch(`${SITE}/api/reel/pending?limit=${LIMIT}`, { headers: authHeader });
  const { pending } = await res.json();
  if (!pending?.length) { console.log("만들 릴스 없음 (모두 제작됨)"); return; }
  console.log(`릴스 ${pending.length}개 제작 시작`);

  for (const item of pending) {
    try {
      await buildReel(item);
      await fetch(`${SITE}/api/reel/done`, { method: "POST", headers: { ...authHeader, "Content-Type": "application/json" }, body: JSON.stringify({ slug: item.slug }) });
    } catch (e) {
      console.error(`  ✗ ${item.slug} 실패:`, e.message);
    }
  }
  console.log("\n영상 공장 종료");
}

main().catch((e) => { console.error(e); process.exit(1); });
