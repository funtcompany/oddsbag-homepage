import { NextRequest, NextResponse } from "next/server";
import { getPublishedRaw, getDrafts, type Post } from "@/lib/posts";
import { getTotals, getDailyTotals } from "@/lib/views";
import {
  ga4Configured,
  googleConfigured,
  gaDaily,
  gaSources,
  gscTotals,
  gscKeywords,
  gscPages,
} from "@/lib/google";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 구글 쪽 조회는 실패해도 대시보드 전체가 죽으면 안 된다.
// 하나가 넘어져도 나머지는 보여주고, 실패한 칸에는 이유를 적어 보낸다.
async function safe<T>(label: string, fn: () => Promise<T>) {
  try {
    return { ok: true as const, data: await fn() };
  } catch (e) {
    return { ok: false as const, error: `${label}: ${(e as Error).message}` };
  }
}

// 검색에 안 걸리거나 부실한 글 찾아내기
function seoIssues(posts: Post[], indexedPaths: Set<string>) {
  const titleSeen = new Map<string, string[]>();
  for (const p of posts) {
    const t = p.title.trim();
    titleSeen.set(t, [...(titleSeen.get(t) ?? []), p.slug]);
  }

  const issues: { slug: string; title: string; problems: string[] }[] = [];
  for (const p of posts) {
    const problems: string[] = [];
    if (!p.cover) problems.push("커버 사진 없음");
    if (!p.summary || p.summary.trim().length < 60)
      problems.push("요약문이 너무 짧음 (검색 결과에 나오는 문구)");
    if (!p.tags || p.tags.length < 3) problems.push("태그 3개 미만");
    if (p.title.length > 60) problems.push("제목이 너무 김 (검색 결과에서 잘림)");
    if (p.title.length < 12) problems.push("제목이 너무 짧음");
    if ((p.body?.length ?? 0) < 800) problems.push("본문이 짧음 (검색 순위에 불리)");
    if (!p.sources?.length) problems.push("출처 링크 없음");
    if ((titleSeen.get(p.title.trim())?.length ?? 0) > 1)
      problems.push("제목이 다른 글과 겹침");
    if (indexedPaths.size && !indexedPaths.has(`/magazine/${p.slug}`))
      problems.push("아직 구글 검색에 안 잡힘");
    if (problems.length) issues.push({ slug: p.slug, title: p.title, problems });
  }
  return issues.sort((a, b) => b.problems.length - a.problems.length);
}

export async function GET(req: NextRequest) {
  const days = Math.min(Number(req.nextUrl.searchParams.get("days")) || 28, 90);

  const [published, drafts, viewTotals, viewDaily] = await Promise.all([
    getPublishedRaw(),
    getDrafts().catch(() => [] as Post[]),
    getTotals(),
    getDailyTotals(14),
  ]);

  const [daily, sources, search, keywords, pages] = await Promise.all([
    ga4Configured() ? safe("애널리틱스 방문자", () => gaDaily(days)) : null,
    ga4Configured() ? safe("애널리틱스 유입경로", () => gaSources(days)) : null,
    googleConfigured() ? safe("서치콘솔 요약", () => gscTotals(days)) : null,
    googleConfigured() ? safe("서치콘솔 키워드", () => gscKeywords(days)) : null,
    googleConfigured() ? safe("서치콘솔 페이지", () => gscPages(days)) : null,
  ]);

  // 검색에 실제로 노출된 글 주소 모음 — "색인 안 됨" 판단에 쓴다
  const indexedPaths = new Set<string>();
  if (pages?.ok) {
    for (const row of pages.data) {
      try {
        indexedPaths.add(new URL(row.page).pathname);
      } catch {
        /* 주소 형식이 이상하면 무시 */
      }
    }
  }

  // 글별 표 데이터 (조회수 + 검색 성적 합치기)
  const searchByPath = new Map(
    (pages?.ok ? pages.data : []).map((r) => {
      let path = r.page;
      try {
        path = new URL(r.page).pathname;
      } catch {}
      return [path, r];
    }),
  );

  const rows = published.map((p) => {
    const s = searchByPath.get(`/magazine/${p.slug}`);
    return {
      slug: p.slug,
      title: p.title,
      category: p.category,
      date: p.date,
      hidden: Boolean(p.hidden),
      cover: Boolean(p.cover),
      quality: p.quality?.score ?? null,
      fakeRisk: p.quality?.fakeRisk ?? null,
      views: viewTotals[p.slug] ?? 0,
      clicks: s?.clicks ?? 0,
      impressions: s?.impressions ?? 0,
      position: s?.position ?? null,
    };
  });

  const categoryCounts: Record<string, number> = {};
  for (const p of published) {
    categoryCounts[p.category] = (categoryCounts[p.category] ?? 0) + 1;
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    days,
    googleReady: googleConfigured(),
    ga4Ready: ga4Configured(),
    summary: {
      published: published.length,
      hidden: published.filter((p) => p.hidden).length,
      drafts: drafts.length,
      totalViews: Object.values(viewTotals).reduce((a, b) => a + b, 0),
      noCover: published.filter((p) => !p.cover).length,
      avgQuality: (() => {
        const s = published.map((p) => p.quality?.score).filter(Boolean) as number[];
        return s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10 : null;
      })(),
    },
    categoryCounts,
    viewDaily,
    traffic: {
      daily: daily?.ok ? daily.data : null,
      sources: sources?.ok ? sources.data : null,
      error: [daily, sources].find((x) => x && !x.ok)?.error ?? null,
    },
    search: {
      totals: search?.ok ? search.data : null,
      keywords: keywords?.ok ? keywords.data : null,
      indexedCount: indexedPaths.size,
      error: [search, keywords, pages].find((x) => x && !x.ok)?.error ?? null,
    },
    rows,
    seo: seoIssues(published, indexedPaths),
  });
}
