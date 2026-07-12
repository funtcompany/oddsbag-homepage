// 전수 검수 — 이미 올라간 글에서 깨진 글자를 찾아 AI가 복원한다.
//  · 깨진 문자(�) · 짝 없는 서로게이트 · 보이지 않는 제어문자
// 발행글 / 예약 대기열 / 검수함 전부 검사한다.

import { NextRequest, NextResponse } from "next/server";
import { getPublishedRaw, getQueued, getDrafts, upsertPublished, saveDraft, queuePost, type Post } from "@/lib/posts";
import { hasBrokenChars, sanitize } from "@/lib/ai";
import { revalidateTag } from "next/cache";

export const maxDuration = 800;

const API_KEY = process.env.ANTHROPIC_API_KEY;
const ADMIN = process.env.ADMIN_PASSWORD;

// 깨진 글자를 문맥으로 복원한다 (글 전체를 다시 쓰지 않고 그 자리만 고친다)
async function repairText(text: string): Promise<string> {
  if (!API_KEY) return text;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2500,
      system: `아래 한국어 글에 글자가 깨진 부분이 있다 (� 같은 이상한 문자).
문맥을 보고 원래 있었어야 할 글자를 정확히 복원하라.

규칙:
- 깨진 부분만 고친다. 나머지 문장은 한 글자도 바꾸지 마라.
- 문단 구분, 줄바꿈, 마크다운(## 등)을 그대로 유지하라.
- 설명하지 말고 복원된 글 전체만 그대로 출력하라.`,
      messages: [{ role: "user", content: text }],
    }),
    cache: "no-store",
  });
  if (!res.ok) return text;
  const d = (await res.json()) as { content?: { text?: string }[] };
  const out = (d.content?.map((c) => c.text ?? "").join("") ?? "").trim();
  return out && !hasBrokenChars(out) ? out : text;
}

async function fixPost(p: Post): Promise<{ changed: boolean; fields: string[] }> {
  const fields: string[] = [];

  for (const key of ["title", "summary", "body", "hook"] as const) {
    const v = p[key];
    if (typeof v !== "string" || !v) continue;
    if (hasBrokenChars(v)) {
      const fixed = await repairText(v);
      if (fixed !== v) {
        (p[key] as string) = sanitize(fixed);
        fields.push(key);
      }
    } else {
      const clean = sanitize(v);
      if (clean !== v) {
        (p[key] as string) = clean;
        fields.push(key + "(정리)");
      }
    }
  }
  return { changed: fields.length > 0, fields };
}

export async function POST(req: NextRequest) {
  const { password } = (await req.json()) as { password?: string };
  if (ADMIN && password !== ADMIN) {
    return NextResponse.json({ error: "비밀번호가 틀렸습니다" }, { status: 401 });
  }

  const report: { slug: string; title: string; where: string; fields: string[] }[] = [];
  const errors: string[] = [];
  let scanned = 0;

  const groups: { name: string; posts: Post[]; save: (p: Post) => Promise<void> }[] = [
    { name: "발행", posts: await getPublishedRaw(), save: upsertPublished },
    {
      name: "예약",
      posts: await getQueued(),
      save: (p) => queuePost(p, new Date(p.publishAt ?? Date.now())),
    },
    { name: "검수함", posts: await getDrafts(), save: saveDraft },
  ];

  for (const g of groups) {
    for (const post of g.posts) {
      scanned++;
      try {
        const r = await fixPost(post);
        if (r.changed) {
          await g.save(post);
          report.push({ slug: post.slug, title: post.title, where: g.name, fields: r.fields });
        }
      } catch (e) {
        errors.push(`${post.slug}: ${(e as Error).message}`);
      }
    }
  }

  if (report.length) {
    try {
      revalidateTag("posts", "max");
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({ ok: true, 검사: scanned, 복구: report.length, report, errors });
}
