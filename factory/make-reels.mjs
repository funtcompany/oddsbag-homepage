// 오즈백 영상 공장 (자립형) — GitHub Actions에서 실행. Vercel/홈페이지에 의존하지 않는다.
//  1) DB(Upstash Redis)에서 발행글을 직접 읽어 오늘 만들 글을 고른다
//  2) 카드 구성 + 나레이션(구글 Chirp3-HD)
//  3) 세로화면(1080×1920)을 공장 안에서 직접 렌더 (satori+resvg)
//  4) ffmpeg로 이어붙이고 트렌디 BGM(은은한 고정 볼륨) 믹스 → mp4
//  5) (선택) 유튜브 쇼츠 + 인스타 릴스 게시
//  6) 완료를 DB에 기록(reels:done) → 중복 제작 방지
//
// 환경변수(GitHub Secrets): UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, GOOGLE_TTS_API_KEY
//   (선택) ODDS_VOICE, YT_PRIVACY, REEL_LIMIT, 유튜브/인스타 게시 자격증명

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { smembers, sadd, srem, getJSON, redisReady, bumpDaily, readDaily } from "./redis.mjs";
import { makeMusic, writeWav, pickBgm, pickTrack } from "./music.mjs";
import { uploadShort, setThumbnail, addToCategoryPlaylist } from "./youtube.mjs";
import { postReel } from "./instagram.mjs";
import { postVideo } from "./facebook.mjs";
import { uploadPublic } from "./host.mjs";
import { hashtags, keywords } from "./hashtags.mjs";
import { youtubeDescription, youtubeTags, youtubeTitle } from "../content-factory/youtube-seo.mjs";
import { writeUploadSheet } from "./upload-sheet.mjs";
import { findBrollForCategory, downloadBroll, brollCredit } from "./pexels.mjs";
import { buildCards, reelSay, paletteFor, loadFontsForPost, renderFrame, ENTER_FRAMES, FPS } from "./render.mjs";
import { usesBroll } from "./cardstyle.mjs";
import { buildCards as buildNewsCards } from "../content-factory/cards.mjs";
import { fetchCard, renderCardFrame, pickKeywords, checkLayout } from "./cardreel.mjs";
import { logWork } from "../content-factory/worklog.mjs";

const TTS_KEY = process.env.GOOGLE_TTS_API_KEY;
const VOICE = process.env.ODDS_VOICE || "ko-KR-Chirp3-HD-Aoede";
const RATE = Number(process.env.ODDS_RATE || 1.0); // 배속 (1.0=기본, 낮을수록 차분)
const COMMA_MS = Number(process.env.ODDS_COMMA_MS || 300);  // 쉼표 쉼
const PERIOD_MS = Number(process.env.ODDS_PERIOD_MS || 500); // 문장 끝 쉼
const LIMIT = Number(process.env.REEL_LIMIT || 1);
const YT_PRIVACY = process.env.YT_PRIVACY || "public";
// 【하루 3개 정책】 채널마다 하루 3개까지만.
//  · 유튜브 쇼츠 3개 — 구독자 피드를 도배하지 않고, 무료 한도(10,000 units)에도 넉넉히 들어간다
//  · 인스타 릴스 1개 — 인스타는 카드뉴스 2개와 합쳐 하루 3개가 된다
//  · 페이스북 영상 1개 — 링크 게시 2개와 합쳐 하루 3개가 된다
const YT_DAILY_CAP = Number(process.env.YT_DAILY_CAP || 2);
// 유튜브 자동 업로드 끄기 — 뮤직 앨범 올리는 날처럼 한도를 양보해야 할 때 YT_UPLOAD=0.
// 꺼도 영상과 업로드 양식(html)은 그대로 나오므로, 손으로 올리면 된다 (손 업로드는 한도 0점).
const YT_UPLOAD = process.env.YT_UPLOAD !== "0";
const IG_REEL_CAP = Number(process.env.IG_REEL_DAILY_CAP || 1);
const FB_VIDEO_CAP = Number(process.env.FB_VIDEO_DAILY_CAP || 1);
const OUT = path.resolve("out");
fs.mkdirSync(OUT, { recursive: true });
const K_PUB = "posts:published", DONE = "reels:done";
const sh = (c) => execSync(c, { stdio: "inherit" });

// ── 노션 작업일지에 쓸 채널 이름 ──
// 오즈백 작업일지 DB의 선택지와 글자까지 같아야 한다. 다르면 조용히 새 선택지가 생겨 캘린더가 어긋난다.
const 채널_유튜브 = "유튜브 오즈백";
const 채널_인스타 = "인스타 공식";
const 채널_페북 = "페이스북";

/** 인스타 게시물 주소 — 번호로는 못 여니 메타에 한 번 물어본다. 실패하면 링크 없이 기록한다. */
async function igPermalink(mediaId) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!mediaId || !token) return null;
  try {
    const r = await (await fetch(
      `https://graph.facebook.com/v21.0/${mediaId}?fields=permalink&access_token=${token}`,
    )).json();
    return r.permalink ?? null;
  } catch {
    return null;
  }
}
const probe = (f) => parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`).toString().trim());

// 자연스러운 '끊어읽기': 문장부호에서 쉼(break)을 준다. 붙여읽으면 뭉개져 들리므로 쉼이 핵심.
function ssmlFor(text) {
  let t = text.replace(/\s+/g, " ").trim();
  t = t.replace(/([·ㆍ/])/g, ", ");                 // 가운뎃점·슬래시 → 쉼
  t = t.replace(/["'"'「」『』]/g, "");                // 따옴표 제거(어색한 끊김 방지)
  if (!/[.!?…]$/.test(t)) t += ".";                  // 문장 끝 마침표 → 마무리 억양
  const esc = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const b = esc.replace(/([,])\s*/g, `$1<break time="${COMMA_MS}ms"/>`).replace(/([.!?…])\s+/g, `$1<break time="${PERIOD_MS}ms"/>`);
  return `<speak>${b}</speak>`;
}
async function tts(text, outPath) {
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: { ssml: ssmlFor(text) }, voice: { languageCode: "ko-KR", name: VOICE }, audioConfig: { audioEncoding: "MP3", speakingRate: RATE } }),
  });
  const j = await res.json();
  if (!j.audioContent) throw new Error("TTS 실패: " + JSON.stringify(j).slice(0, 200));
  fs.writeFileSync(outPath, Buffer.from(j.audioContent, "base64"));
}

// 오늘 만들 글 선정: (0) REEL_SLUGS 지정 시 그것만 (1) 재제작 우선순위(reels:priority) 먼저 (2) 최신 발행글
async function pickPending(limit) {
  if (process.env.REEL_SLUGS) { // 특정 글만 강제 제작(수동)
    const want = process.env.REEL_SLUGS.split(",").map((s) => s.trim()).filter(Boolean);
    return (await Promise.all(want.map((s) => getJSON(`post:${s}`)))).filter(Boolean);
  }
  const [pubSlugs, doneArr, prioArr] = await Promise.all([smembers(K_PUB), smembers(DONE), smembers("reels:priority")]);
  const done = new Set(doneArr || []);
  const prio = new Set((prioArr || []).filter((s) => !done.has(s)));
  const fresh = (pubSlugs || []).filter((s) => !done.has(s));
  const posts = (await Promise.all(fresh.map((s) => getJSON(`post:${s}`)))).filter(Boolean).filter((p) => p.status === "published");
  posts.sort((a, b) => (b.publishedAt ?? b.date ?? "").localeCompare(a.publishedAt ?? a.date ?? ""));
  // 꿀팁(가이드)을 앞으로 — 인스타는 가이드만 올리는 채널이 됐다(사장님 지시 2026-08-05).
  // 뉴스가 먼저 잡히면 그날 인스타 릴스 자리가 그냥 비어버린다.
  // 유튜브는 어차피 전부 올리므로, 순서만 바뀌고 빠지는 글은 없다.
  const guideFirst = (arr) => [
    ...arr.filter((p) => p.category === "꿀팁"),
    ...arr.filter((p) => p.category !== "꿀팁"),
  ];
  // 재제작 대상(우선순위) 먼저, 그다음 최신 발행글
  return [
    ...guideFirst(posts.filter((p) => prio.has(p.slug))),
    ...guideFirst(posts.filter((p) => !prio.has(p.slug))),
  ].slice(0, limit);
}

async function buildReel(post) {
  const slug = post.slug;
  const work = path.join(OUT, slug);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  console.log(`\n▶ ${slug} — ${post.title}`);

  // 【카드뉴스 방식】(기본) — 인스타에 나가는 카드뉴스 그림을 그대로 영상에 얹는다.
  //   디자인을 두 벌 유지하지 않아도 되고, 카드뉴스의 질감·도식이 영상에도 그대로 들어온다.
  //   CARD_REEL=0 으로 두면 예전 방식(공장이 직접 그리는 타이포 화면)으로 돌아간다.
  const CARD_MODE = process.env.CARD_REEL !== "0";
  const SITE = process.env.SITE_URL || "https://oddsbag.co.kr";
  const cards = CARD_MODE ? buildNewsCards(post) : buildCards(post);
  const pal = paletteFor(post.slug, post.mood, post.category); // 색 = 카드뉴스 개편안의 카테고리 색
  const kws = CARD_MODE ? pickKeywords(post) : [];
  if (CARD_MODE) {
    const chk = checkLayout(post);            // 겹침·제목잘림을 만들기 전에 검사한다
    if (!chk.ok) throw new Error(`배치 문제: ${chk.problems.join(", ")}`);
    console.log(`  · 카드뉴스 방식 · 제목 ${chk.titleSize}px ${chk.titleLines}줄 · 키워드 ${kws.join(" ")}`);
  }

  // B-roll 배경(선택): 저작권 안전한 Pexels 무료 영상. 못 찾으면 조용히 타이포로 폴백.
  let brollFile = null, brollDur = 0, renderOpts = {};
  // 카테고리별 on/off — 꿀팁·경제처럼 글자가 많은 카테고리는 배경영상이 글을 방해한다(개편안).
  if (!CARD_MODE && process.env.USE_BROLL === "1" && process.env.PEXELS_API_KEY && usesBroll(post.category)) {
    try {
      const b = await findBrollForCategory(post.category, (post.tags || [])[0]);
      if (b) {
        brollFile = path.join(work, "broll.mp4");
        await downloadBroll(b.link, brollFile);
        brollDur = b.duration;
        renderOpts = { transparent: true, credit: brollCredit(b).caption };
        console.log(`  · 배경영상: "${b.query}" (${b.author} / Pexels, ${b.duration}s)`);
      }
    } catch (e) { console.log("  · 배경영상 건너뜀(타이포로 진행):", e.message); }
  }

  const fonts = await loadFontsForPost(cards, `${renderOpts.credit || ""} ${post.title} ${post.category} ${kws.join(" ")} oddsbag.co.kr ODDSBAG #`);

  // 나레이션 + 카드 길이
  let acc = 0;
  for (let i = 0; i < cards.length; i++) {
    const mp3 = path.join(work, `n${i}.mp3`);
    await tts(reelSay(cards[i]), mp3);
    cards[i].narr = mp3;
    // ★ 카드 길이는 프레임 격자(1/FPS초)에 스냅한다.
    //   영상 클립은 프레임 단위로만 만들어지므로(tpad·concat) 카드 컷 시각은 항상 프레임 단위인데,
    //   나레이션은 offsets(=dur 누적합, 소수 그대로)에 놓인다. 스냅하지 않으면 그 소수 오차가
    //   뒤 카드로 갈수록 쌓여, 나레이션이 영상 컷에서 밀린다(실측 14장에 최대 5.5프레임 어긋남).
    //   스냅하면 dur×FPS가 정수가 되어 컷·나레이션·BGM 길이가 프레임 단위로 정확히 맞는다.
    cards[i].dur = Math.round(Math.max(2.6, probe(mp3) + 0.75) * FPS) / FPS;
    acc += cards[i].dur;
  }
  // 세로영상 상한(기본 2:59=179초): 쇼츠·릴스·틱톡·네이버클립 모두 3분 이내면 안전.
  // 정상 글은 이 상한에 한참 못 미치므로 전부 살아남는다. 아주 긴 글(드묾)만 상한을 넘겨,
  // 그 경우에도 '문장 중간'이 아니라 '완결된 소제목(=카드)' 단위로만 뒤에서부터 덜어낸다.
  const MAX_SEC = Number(process.env.MAX_REEL_SEC || 179);
  let dropped = 0;
  while (acc > MAX_SEC && cards.length > 3) {
    let idx = -1;
    for (let i = cards.length - 2; i >= 2; i--) { if (["point", "quote"].includes(cards[i].kind)) { idx = i; break; } }
    if (idx < 0) break;
    acc -= cards[idx].dur; cards.splice(idx, 1); dropped++;
  }
  if (dropped) console.log(`  · 상한 ${MAX_SEC}초 초과 → 뒤 카드 ${dropped}장 덜어냄 (문장 중간 안 자름, 소제목 단위)`);
  const total = cards.length;
  const offsets = []; let a2 = 0;
  for (const c of cards) { offsets.push(a2); a2 += c.dur; }
  const totalDur = a2;
  console.log(`  · 길이 ${totalDur.toFixed(1)}초 · 카드 ${total}장`);

  // 프레임 자체 렌더 + 카드별 클립
  const clips = [];
  for (let c = 0; c < total; c++) {
    const cdir = path.join(work, `c${c}`); fs.mkdirSync(cdir, { recursive: true });
    if (CARD_MODE) {
      // 카드뉴스 그림을 받아 9:16 화면에 얹는다 (장면 전환 애니메이션 없음 — 카드가 곧 화면)
      const cardPng = await fetchCard(SITE, slug, c);
      const png = await renderCardFrame({ post, cardPngBuffer: cardPng, kws, fonts });
      for (let f = 0; f < ENTER_FRAMES; f++) fs.writeFileSync(path.join(cdir, `${String(f).padStart(3, "0")}.png`), png);
    } else {
      for (let f = 0; f < ENTER_FRAMES; f++) {
        const png = await renderFrame(post, cards, c, total, f / FPS, fonts, pal, renderOpts);
        fs.writeFileSync(path.join(cdir, `${String(f).padStart(3, "0")}.png`), png);
      }
    }
    const hold = (cards[c].dur - ENTER_FRAMES / FPS).toFixed(3);
    const clip = path.join(work, `clip${c}.mp4`);
    if (brollFile) {
      // 배경 영상 위에 투명 카드 프레임을 얹는다. 카드마다 배경 시작점을 옮겨 장면 변화를 준다.
      const off = brollDur > cards[c].dur ? (offsets[c] % (brollDur - cards[c].dur)).toFixed(2) : 0;
      sh(`ffmpeg -y -ss ${off} -stream_loop -1 -i "${brollFile}" -framerate ${FPS} -i "${cdir}/%03d.png" -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=${FPS}[bg];[1:v]tpad=stop_mode=clone:stop_duration=${hold},format=rgba[ov];[bg][ov]overlay=0:0,format=yuv420p[v]" -map "[v]" -t ${cards[c].dur.toFixed(3)} -c:v libx264 -preset medium -crf 20 "${clip}"`);
    } else {
      sh(`ffmpeg -y -framerate ${FPS} -i "${cdir}/%03d.png" -vf "tpad=stop_mode=clone:stop_duration=${hold},format=yuv420p,fps=${FPS}" -c:v libx264 -preset medium -crf 18 "${clip}"`);
    }
    clips.push(clip);
  }
  fs.writeFileSync(path.join(work, "list.txt"), clips.map((c) => `file '${c}'`).join("\n"));
  const silent = path.join(work, "video.mp4");
  sh(`ffmpeg -y -f concat -safe 0 -i "${work}/list.txt" -c copy "${silent}"`);

  // BGM + 나레이션 믹스 (은은한 고정 볼륨)
  // 오즈백 뮤직에서 만든 연주곡을 쓴다 — 저작권이 우리 것이라 어디에 올려도 안전하다.
  // 글마다 곡을 하나 고정 배정하고, 곡이 영상보다 짧으면 이어 붙여 길이를 맞춘다.
  const music = path.join(work, "music.wav");
  const track = pickTrack(post.category, post.slug);
  if (track) {
    console.log(`  · BGM: ${track.name} (오즈백 뮤직)`);
    sh(`ffmpeg -y -loglevel error -stream_loop -1 -i "${track.file}" -t ${(totalDur + 1).toFixed(2)} -ac 2 -ar 44100 "${music}"`);
  } else {
    // 음원을 못 찾으면 합성 엔진으로 — 영상 제작이 멈추지 않게
    const bgm = pickBgm(post.category, post.slug);
    console.log(`  · BGM: ${bgm.style} (합성 · 음원 없음)`);
    writeWav(music, makeMusic(bgm.style, totalDur, 44100, bgm.shift));
  }
  const inputs = [`-i "${silent}"`, `-i "${music}"`, ...cards.map((c) => `-i "${c.narr}"`)];
  let fc = ""; const v = [];
  cards.forEach((c, i) => { const d = Math.round((offsets[i] + 0.35) * 1000); fc += `[${i + 2}:a]adelay=${d}|${d},volume=2.1[v${i}];`; v.push(`[v${i}]`); });
  fc += `${v.join("")}amix=inputs=${v.length}:normalize=0[voice];`;
  // 페이드아웃은 BGM에만 건다 — 나레이션(voice)은 어떤 페이드로도 절대 깎이지 않게 한다.
  // (카드 표시시간 dur = 오디오+0.75, 시작 지연 0.35초라 나레이션 끝뒤에 최소 0.4초 여유가 남아 잘림이 없다)
  fc += `[1:a]highpass=f=60,volume=0.22,afade=t=in:st=0:d=0.8,afade=t=out:st=${(totalDur - 0.8).toFixed(2)}:d=0.8[bg];`;
  fc += `[bg][voice]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]`;
  const final = path.join(OUT, `${slug}.mp4`);
  // 용량 최소화(≈5MB): 배경영상형도 무료 호스팅에 빠르게 올라가 인스타가 확실히 받아가게. 모바일 화질엔 충분.
  sh(`ffmpeg -y ${inputs.join(" ")} -filter_complex "${fc}" -map 0:v -map "[a]" -c:v libx264 -preset medium -crf 26 -maxrate 2200k -bufsize 4400k -pix_fmt yuv420p -c:a aac -b:a 128k -shortest "${final}"`);
  console.log(`  ✅ 완성: ${final} (${totalDur.toFixed(1)}초)`);

  // 썸네일 = 첫 장(훅 카드) 고정 — 세 플랫폼 표지를 동일한 첫 장면으로 통일
  let thumb = null;
  try {
    thumb = path.join(work, "thumb.jpg");
    if (CARD_MODE) {
      // 【유튜브 쇼츠 썸네일】 쇼츠는 커스텀 썸네일을 목록에 반영하지 않고 '영상 안 프레임'을 골라 쓴다.
      //   그래서 지정 이미지도 영상에서 뽑은 실제 프레임(2.5초 지점)으로 맞춘다 — 사장님 지시 2026-07-29.
      //   이 시점은 아직 첫 카드(메인 제목이 적힌 표지)라, 목록에 뜨는 그림과 지정 썸네일이 일치한다.
      const at = Math.max(1.2, Math.min(2.5, cards[0].dur - 0.3)).toFixed(2);
      sh(`ffmpeg -y -ss ${at} -i "${final}" -vframes 1 -q:v 2 "${thumb}"`);
      console.log(`  · 썸네일 = 영상 ${at}초 지점(첫 카드 · 메인 제목)`);
    } else if (brollFile) {
      // 배경영상형은 완성 영상의 훅 구간(첫 카드 후반)에서 한 장 추출 → 배경까지 담긴 표지
      const at = Math.min(cards[0].dur - 0.3, ENTER_FRAMES / FPS + 0.6).toFixed(2);
      sh(`ffmpeg -y -ss ${at} -i "${final}" -vframes 1 -q:v 2 "${thumb}"`);
    } else {
      const png = await renderFrame(post, cards, 0, total, 5, fonts, pal, renderOpts); // t=5 → 완전히 안착한 첫 장
      const thumbPng = path.join(work, "thumb.png");
      fs.writeFileSync(thumbPng, png);
      sh(`ffmpeg -y -i "${thumbPng}" -q:v 2 "${thumb}"`);
    }
  } catch (e) { console.log("  · 썸네일 렌더 건너뜀:", e.message); thumb = null; }

  // 게시 (자격증명 있을 때만) — 유입 최적화: 훅 첫줄 + 명확한 CTA + 태그(10~30개)
  const lead = (post.hook || post.title).trim();
  // 【채널마다 태그 개수가 다르다】
  //   인스타 — 한 게시물 30개가 상한. 첫 댓글에 30개를 꽉 채운다.
  //   페북   — 개수 제한이 없다. 인스타와 같이 30개.
  //   유튜브 — 설명란 해시태그가 15개를 넘으면 '전부' 무시한다. 그래서 여기만 15개다.
  //            대신 tags 필드(500자)에 키워드를 30개까지 넣어 검색을 노린다.
  const igTags = hashtags(post, 30);
  // 【원칙】 링크로 넘기지 않는다 — 내용은 영상 안에서 끝내고, CTA는 저장·구독(미리 알림)이다.
  const igCaption = `${lead}\n\n📌 저장해두면 필요할 때 바로 꺼내 봅니다\n🔔 팔로우하면 이런 알짜 정보가 매일 피드에 떠요 → @oddsbag_official`;
  // 유튜브 설명은 검색에 걸릴 본문이 있어야 한다 — content-factory/youtube-seo.mjs 참고
  const ytDesc = youtubeDescription(post);
  const fbCaption = `${lead}\n\n📌 저장해두면 필요할 때 바로 꺼내 봅니다\n🔔 오즈백 페이지 팔로우하고 매일 새 소식 받기\n\n${hashtags(post, 30)}`;
  // 유튜브는 무료 한도(하루 10,000 units)가 병목이다. 릴스 1개당 약 1,700 units 를 쓰므로
  // 하루 5개가 상한이다. 그 이상은 유튜브만 건너뛰고 인스타·페북에는 그대로 올린다.
  // 손으로 올릴 때 쓰는 양식을 영상 옆에 항상 놓아둔다 (한도를 안 쓰는 길을 늘 열어둔다)
  try {
    const sheet = writeUploadSheet(OUT, {
      slug, title: post.title, category: post.category, seconds: totalDur,
      videoFile: path.basename(final),
      ytTitle: youtubeTitle(post), ytDesc, ytTags: youtubeTags(post),
      igCaption, igTags, fbCaption,
    });
    console.log(`  · 업로드 양식: ${sheet}`);
  } catch (e) { console.log("  · 업로드 양식 건너뜀:", e.message); }

  // 실제로 나간 것만 모았다가 마지막에 노션 작업일지에 남긴다 (게시가 끝난 뒤라 기록이 실패해도 손해가 없다)
  const 일지 = [];

  const ytToday = await readDaily("yt:uploads").catch(() => 0);
  const ytRoom = YT_UPLOAD && ytToday < YT_DAILY_CAP;
  if (!YT_UPLOAD) console.log("  · 유튜브 자동 업로드 꺼짐(YT_UPLOAD=0) — 업로드 양식으로 손수 올리세요");
  if (!ytRoom) console.log(`  · 유튜브 오늘 ${ytToday}개 — 무료 한도라 이번 건은 인스타·페북만`);
  try {
    if (!ytRoom) throw new Error(YT_UPLOAD ? `유튜브 하루 상한(${YT_DAILY_CAP}) 도달` : "자동 업로드 꺼짐");
    const vid = await uploadShort(final, { title: youtubeTitle(post), description: ytDesc, tags: youtubeTags(post), privacy: YT_PRIVACY });
    await bumpDaily("yt:uploads").catch(() => {});
    if (vid) 일지.push({ 채널: 채널_유튜브, 제목: post.title, 링크: `https://www.youtube.com/shorts/${vid}` });
    // 썸네일은 '올렸다'가 아니라 '적용됐다'까지 확인한다. 한 번 실패하면 5초 뒤 한 번 더 시도.
    if (thumb && vid) {
      let done = false;
      for (let t = 0; t < 2 && !done; t++) {
        try { const r = await setThumbnail(vid, thumb); done = r?.ok !== false; }
        catch (e) { console.log(`  · 유튜브 썸네일 시도 ${t + 1} 실패: ${e.message}`); await new Promise((s2) => setTimeout(s2, 5000)); }
      }
      if (!done) console.log("  ⚠ 유튜브 썸네일이 적용되지 않았습니다 — 사장님 확인 필요");
    }
    if (vid) { try { await addToCategoryPlaylist(vid, post.category); } catch (e) { console.log("  · 재생목록 건너뜀:", e.message); } }
  }
  catch (e) { console.log("  · 유튜브 건너뜀:", e.message); }
  try {
    // 【인스타는 가이드 전용】 사장님 지시 2026-08-05 — 유튜브는 기사·가이드 전부 올리지만
    // 인스타는 꿀팁·가이드만 올린다. 퀄리티를 계속 올리면서 빈도를 늘려가는 채널로 쓴다.
    // (뉴스도 올리려면 IG_NEWS=on)
    if (post.category !== "꿀팁" && process.env.IG_NEWS !== "on")
      throw new Error("뉴스는 인스타에 올리지 않는다 (인스타는 가이드 전용)");
    const igToday = await readDaily("ig:reels").catch(() => 0);
    if (igToday >= IG_REEL_CAP) throw new Error(`인스타 릴스 하루 상한(${IG_REEL_CAP}개) 도달`);
    // 인스타는 메타 호환 호스트(uguu 등, tmpfiles 제외)에만 올린다. 영상 실패면 인스타 자체를 건너뛴다.
    const url = await uploadPublic(final, { metaSafe: true });
    let coverUrl;
    if (thumb) {
      await new Promise((r) => setTimeout(r, 4000)); // uguu 연속 업로드 제한 회피
      try { coverUrl = await uploadPublic(thumb, { metaSafe: true }); }
      catch (e) { console.log("  · 인스타 커버 생략(첫 프레임 사용):", e.message); } // 커버 실패해도 릴스는 올린다
    }
    const mid = await postReel(url, igCaption, coverUrl, igTags);
    await bumpDaily("ig:reels").catch(() => {});
    if (mid) 일지.push({ 채널: 채널_인스타, 제목: post.title, 링크: (await igPermalink(mid)) ?? undefined });
  }
  catch (e) { console.log("  · 인스타 건너뜀:", e.message); }
  try {
    const fbToday = await readDaily("fb:videos").catch(() => 0);
    if (fbToday >= FB_VIDEO_CAP) throw new Error(`페이스북 영상 하루 상한(${FB_VIDEO_CAP}개) 도달`);
    const fid = await postVideo(final, fbCaption, thumb);
    await bumpDaily("fb:videos").catch(() => {});
    if (fid) 일지.push({ 채널: 채널_페북, 제목: post.title, 링크: `https://www.facebook.com/watch/?v=${fid}` });
  }
  catch (e) { console.log("  · 페이스북 건너뜀:", e.message); }

  // 노션 작업일지 기록 — 여기서 무슨 일이 나도 영상·게시는 이미 끝났으므로 절대 멈추지 않는다
  try {
    const n = await logWork(일지);
    if (n) console.log(`  · 작업일지 ${n}건 기록 (전체 ${일지.length}건 시도)`);
  } catch (e) { console.log("  · 작업일지 건너뜀:", e.message); }

  fs.rmSync(work, { recursive: true, force: true });

  // 어디든 한 곳이라도 실제로 올라갔는가.
  //  한 곳도 못 올렸다면(=하루 상한에 다 막혔다면) '완료' 도장을 찍으면 안 된다.
  //  찍어버리면 그 글은 다시 뽑히지 않아, 만들어 둔 영상이 영영 안 올라간다.
  return { 게시됨: 일지.length > 0 };
}

async function main() {
  if (!redisReady) throw new Error("UPSTASH_REDIS_REST_URL/TOKEN 필요");
  if (!TTS_KEY) throw new Error("GOOGLE_TTS_API_KEY 필요");
  const pending = await pickPending(LIMIT);
  if (!pending.length) { console.log("만들 릴스 없음 (모두 제작됨)"); return; }
  console.log(`릴스 ${pending.length}개 제작 시작`);
  for (const post of pending) {
    try {
      const r = await buildReel(post);
      // 【한 곳도 못 올렸으면 완료 처리하지 않는다】
      //  채널 하루 상한에 다 막히는 일이 실제로 있었다(유튜브 2/2·인스타 1/1·페북 1/1).
      //  그때도 '완료' 도장을 찍고 있어서, 만들어 둔 영상이 그대로 묻혔다.
      //  완료를 미루면 다음 회차가 같은 글을 다시 집어 올려준다.
      //  다만 자동 업로드를 꺼둔 날(YT_UPLOAD=0)은 손으로 올리는 게 정상이라 그대로 완료 처리한다.
      //  안 그러면 같은 영상을 매 회차 다시 만들며 시간만 태운다.
      const 보류 = !r?.게시됨 && YT_UPLOAD;
      if (process.env.MARK_DONE !== "0" && !보류) {
        await sadd(DONE, post.slug);
        await srem("reels:priority", post.slug);
      }
      if (보류) {
        console.log("  · 어느 채널에도 못 올림(하루 상한) — 완료 처리 보류, 다음 회차가 다시 올린다");
      }
    } catch (e) {
      console.error(`  ✗ ${post.slug} 실패:`, e.message);
    }
  }
  console.log("\n영상 공장 종료");
}
main().catch((e) => { console.error(e); process.exit(1); });
