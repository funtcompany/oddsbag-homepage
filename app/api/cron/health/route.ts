// 【발행 멈춤 감지】 최근 발행이 끊겼는지 확인하고, 끊겼으면 사장님께 메일로 알린다.
// NAS가 1시간마다 호출한다. 무료 플랜에서 "조용히 멈추는" 사고를 다시는 뒤늦게 발견하지 않기 위한 감시자.
import { NextRequest, NextResponse } from "next/server";
import { getPublishedRaw, getQueued } from "@/lib/posts";
import { sendEmail, emailEnabled } from "@/lib/email";
import { kvGet, kvSet } from "@/lib/store";

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const OWNER = process.env.OWNER_EMAIL || "tjdrhks2826@gmail.com";
const SITE = process.env.SITE_URL || "https://oddsbag.co.kr";

const STALE_HOURS = 4; // 이 시간 넘게 새 글이 없으면 '멈춤 의심'
const ALERT_COOLDOWN_H = 6; // 알림은 최대 6시간에 한 번만 (메일 도배 방지)

export async function GET(req: NextRequest) {
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  try {
    const published = await getPublishedRaw();
    const latest =
      published
        .map((p) => new Date(p.publishedAt ?? p.date ?? 0).getTime())
        .filter((t) => t > 0)
        .sort((a, b) => b - a)[0] ?? 0;
    const hoursSince = latest ? (Date.now() - latest) / 36e5 : Infinity;

    // 대기열에 '발행 시각이 이미 지났는데도 안 올라간 글'이 있으면 발행이 막힌 것
    let dueStuck = 0;
    try {
      const queue = await getQueued();
      const now = Date.now();
      dueStuck = queue.filter((p) => new Date(p.publishAt ?? 0).getTime() <= now).length;
    } catch {
      /* ignore */
    }

    const stalled = hoursSince >= STALE_HOURS;

    let alerted = false;
    if (stalled && emailEnabled) {
      const last = Number((await kvGet("health:lastAlert")) ?? 0);
      const cooled = Date.now() - last >= ALERT_COOLDOWN_H * 36e5;
      if (cooled) {
        const h = Number.isFinite(hoursSince) ? Math.floor(hoursSince) : "24+";
        await sendEmail(
          OWNER,
          `🚨 오즈백 발행 멈춤 의심 (${h}시간째 새 글 없음)`,
          `<div style="font-family:-apple-system,sans-serif;line-height:1.6;color:#241a3a">
            <h2 style="color:#5b2d8e;margin:0 0 12px">발행이 멈춘 것 같습니다</h2>
            <p>마지막 발행 이후 <b>${h}시간</b>이 지났습니다. (기준: ${STALE_HOURS}시간)</p>
            <p>발행 대기 중인데 안 올라간 글: <b>${dueStuck}건</b></p>
            <p>홈페이지 확인: <a href="${SITE}" style="color:#7a4bc0">${SITE}</a></p>
            <hr style="border:none;border-top:1px solid #e8e4f0;margin:16px 0" />
            <p style="color:#8a84a0;font-size:13px">
              나스 자동 감시가 보낸 메일입니다.<br />
              발행 크론(수집·발행)이 도는지, 나스 예약 작업이 켜져 있는지 확인해 주세요.
            </p>
          </div>`,
        );
        await kvSet("health:lastAlert", String(Date.now()));
        alerted = true;
      }
    }

    return NextResponse.json({
      ok: true,
      stalled,
      alerted,
      hoursSinceLastPublish: Number.isFinite(hoursSince) ? Math.round(hoursSince * 10) / 10 : null,
      dueStuck,
      totalPublished: published.length,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
