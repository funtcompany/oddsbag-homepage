// 정기 개선 점검 (2일 1회) — 홈페이지 / 인스타 / SEO 를 스스로 점검하고 보수한다.
//
//  1. 자동 보수 (사람 손 없이 바로 고침)
//     · 커버 사진이 없는 글 → 사진 재탐색
//     · 태그/요약이 빠진 글 → 채워 넣기 (SEO)
//     · 인스타에 안 올라간 발행글 → 재게시
//  2. 진단 리포트
//     · 품질 점수 추이 (좋아지고 있는가)
//     · 카테고리 편중, 사진 없는 비율, 발행/보류 비율
//     · AI 편집장이 뽑은 다음 2일간 개선 액션
//  3. 사장님께 메일로 요약 발송

import { getPublishedRaw, getDrafts, upsertPublished } from "./posts.mjs";
import { getQualityTrend, getLessons } from "./learn.mjs";
import { findCoverImage } from "./images.mjs";
import { shareEverywhere, socialEnabled } from "./social.mjs";
import { sendEmail, emailEnabled } from "./email.mjs";
import { ask } from "./llm.mjs";
import { smembers } from "./store.mjs";
import { revalidateTag } from "./cache.mjs";

const OWNER = process.env.OWNER_EMAIL || "tjdrhks2826@gmail.com";

const FIX_COVERS_PER_RUN = 6;
const RESHARE_PER_RUN = 3;

export async function runImprove() {
  const out = {
    posts: 0,
    drafts: 0,
    noCover: 0,
    coversFixed: 0,
    reshared: 0,
    byCategory: {},
    trend: { avg7: 0, avgPrev: 0, autoPublishRate: 0, count: 0 },
    actions: [],
    errors: [],
  };

  let published = [];
  try {
    published = await getPublishedRaw();
    out.posts = published.length;
    out.drafts = (await getDrafts()).length;
  } catch (e) {
    out.errors.push(`로드: ${e.message}`);
  }

  for (const p of published) {
    out.byCategory[p.category] = (out.byCategory[p.category] ?? 0) + 1;
  }
  const noCover = published.filter((p) => !p.cover);
  out.noCover = noCover.length;

  // ---- 1) 커버 사진 재탐색 ----
  for (const post of noCover.slice(0, FIX_COVERS_PER_RUN)) {
    try {
      const cover = await findCoverImage(
        post.tags?.join(" ") ?? "",
        post.category,
        post.category,
        post.title,
        post.summary,
      );
      if (cover) {
        post.cover = cover.url;
        post.imageCredit = cover.credit;
        await upsertPublished(post);
        out.coversFixed++;
      }
    } catch (e) {
      out.errors.push(`커버 ${post.slug}: ${e.message}`);
    }
  }

  // ---- 2) 인스타에 못 올라간 발행글 재게시 ----
  if (socialEnabled) {
    // 이틀 안에 발행된 글만 재게시 (지난 뉴스를 뒤늦게 도배하지 않는다)
    const twoDaysAgo = Date.now() - 2 * 864e5;
    // 'SNS를 한 번도 시도하지 않은 글'만 재게시한다.
    // 예전엔 !p.social?.ig 로 걸렀는데, 인스타는 올라갔지만 ID 기록에 실패한 글이
    // 영원히 "안 올라감"으로 남아 같은 글을 반복해서 다시 올렸다.
    const missing = published
      .filter((p) => !p.social)
      .filter((p) => new Date(p.publishedAt ?? p.date).getTime() > twoDaysAgo)
      .slice(0, RESHARE_PER_RUN);
    for (const post of missing) {
      try {
        const r = await shareEverywhere(post);
        if (r.ig || r.fb) {
          post.social = { ig: r.ig, fb: r.fb, at: new Date().toISOString() };
          await upsertPublished(post);
          out.reshared++;
        }
        if (r.errors.length) out.errors.push(...r.errors);
      } catch (e) {
        out.errors.push(`재게시 ${post.slug}: ${e.message}`);
      }
    }
  }

  if (out.coversFixed || out.reshared) {
    try {
      revalidateTag("posts", "max");
    } catch {
      /* ignore */
    }
  }

  // ---- 3) 진단 ----
  out.trend = await getQualityTrend();
  const lessons = await getLessons();
  let subs = 0;
  try {
    subs = (await smembers("newsletter:subscribers")).length;
  } catch {
    /* ignore */
  }

  out.actions = await suggestActions({
    posts: out.posts,
    drafts: out.drafts,
    noCover: out.noCover,
    byCategory: out.byCategory,
    trend: out.trend,
    lessons,
    subs,
    recentTitles: published.slice(0, 12).map((p) => p.title),
  });

  // ---- 4) 리포트 메일 ----
  if (emailEnabled) {
    try {
      await sendEmail(OWNER, `[오즈백] 2일 점검 리포트 — 발행 ${out.posts}건`, reportHtml(out, subs));
    } catch (e) {
      out.errors.push(`리포트 메일: ${e.message}`);
    }
  }

  return out;
}

// ---- AI 편집장의 개선 액션 ----
async function suggestActions(ctx) {
  const system = `너는 오즈백(ODDSBAG) 매거진의 그로스 담당자다.
홈페이지(oddsbag.co.kr)와 인스타그램(@oddsbag_official)의 데이터를 보고,
앞으로 2일간 실행할 개선 액션을 뽑는다.

기준:
- 유입(SEO·SNS)을 늘리는 것이 최우선. 광고비 없이 자체 유입을 만들어야 한다.
- 콘텐츠 품질이 시간이 지날수록 좋아져야 한다.
- 카테고리가 한쪽으로 쏠리면 독자층이 좁아진다.
- 실행 가능한 구체적 액션만. 추상적인 조언 금지.

출력: '- ' 로 시작하는 액션 최대 5개. 각 한 문장. 다른 말 금지.`;

  const user = `발행글: ${ctx.posts}건 / 검수함 대기: ${ctx.drafts}건
사진 없는 글: ${ctx.noCover}건
카테고리 분포: ${JSON.stringify(ctx.byCategory)}
품질 점수 평균: 최근 ${ctx.trend.avg7}점 (직전 ${ctx.trend.avgPrev}점)
자동 발행 통과율: ${ctx.trend.autoPublishRate}%
뉴스레터 구독자: ${ctx.subs}명
최근 제목들: ${ctx.recentTitles.join(" / ")}
현재 재발 방지 체크리스트:
${ctx.lessons || "(아직 없음)"}`;

  try {
    const text = await ask(system, user, { maxTokens: 700, careful: true });
    return text
      .split("\n")
      .map((l) => l.replace(/^[-•]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 5);
  } catch {
    return [];
  }
}

// ---- 리포트 메일 (다크 안전) ----
const bg = (c) => `background-color:${c};background-image:linear-gradient(${c},${c});`;

function reportHtml(r, subs) {
  const up = r.trend.avg7 - r.trend.avgPrev;
  const arrow = up > 0 ? `▲ ${up}점 상승` : up < 0 ? `▼ ${-up}점 하락` : "변동 없음";
  const cats = Object.entries(r.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join(" · ");

  const stat = (label, value) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #2c2445;color:#b3a6cf;font-size:14px">${label}</td>
     <td style="padding:10px 0;border-bottom:1px solid #2c2445;color:#f3eefc;font-size:15px;font-weight:800;text-align:right">${value}</td></tr>`;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="dark light"></head>
<body style="margin:0;${bg("#1c1530")}">
<table width="100%" cellpadding="0" cellspacing="0" style="${bg("#1c1530")}padding:0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;font-family:-apple-system,'Apple SD Gothic Neo',sans-serif">
  <tr><td style="background:#3a1a63;background-image:linear-gradient(135deg,#6b3aa8,#33165c);padding:34px 30px">
    <div style="font-size:12px;font-weight:900;letter-spacing:2px;color:#ffe600">2일 점검 리포트</div>
    <div style="margin-top:8px;font-size:26px;font-weight:900;color:#fff;letter-spacing:-1px">오즈백 자동화 현황</div>
  </td></tr>
  <tr><td style="${bg("#1c1530")}padding:26px 30px">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${stat("발행된 글", `${r.posts}건`)}
      ${stat("검수함 대기", `${r.drafts}건`)}
      ${stat("품질 점수 (최근 평균)", `${r.trend.avg7}점 &nbsp;<span style="color:${up >= 0 ? "#4ade80" : "#ff7676"};font-size:13px">${arrow}</span>`)}
      ${stat("자동 발행 통과율", `${r.trend.autoPublishRate}%`)}
      ${stat("사진 없는 글", `${r.noCover}건 (이번에 ${r.coversFixed}건 보완)`)}
      ${stat("인스타 재게시", `${r.reshared}건`)}
      ${stat("뉴스레터 구독자", `${subs}명`)}
    </table>
    <div style="margin-top:22px;font-size:13px;color:#8577a8">카테고리 분포</div>
    <div style="margin-top:6px;font-size:14px;color:#f3eefc;font-weight:700">${cats || "-"}</div>
  </td></tr>
  ${
    r.actions.length
      ? `<tr><td style="${bg("#241a3d")}padding:24px 30px">
    <div style="font-size:12px;font-weight:900;letter-spacing:2px;color:#ffe600">다음 2일 개선 액션</div>
    ${r.actions.map((a) => `<div style="margin-top:12px;font-size:15px;color:#f3eefc;line-height:1.6">· ${a}</div>`).join("")}
  </td></tr>`
      : ""
  }
  ${
    r.errors.length
      ? `<tr><td style="${bg("#1c1530")}padding:20px 30px;border-top:1px solid #2c2445">
    <div style="font-size:12px;font-weight:900;color:#ff9c9c">확인 필요</div>
    ${r.errors.slice(0, 5).map((e) => `<div style="margin-top:6px;font-size:13px;color:#b3a6cf">· ${e}</div>`).join("")}
  </td></tr>`
      : ""
  }
  <tr><td style="padding:24px 30px;text-align:center;font-size:12px;color:#8577a8">
    ODDSBAG 오즈백 · 자동 생성 리포트
  </td></tr>
</table>
</td></tr></table></body></html>`;
}
