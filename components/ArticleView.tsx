import PostCard from "@/components/PostCard";
import AdSlot from "@/components/AdSlot";
import ReactionBar from "@/components/ReactionBar";
import CommentSection from "@/components/CommentSection";
import SubscribeBox from "@/components/SubscribeBox";
import ViewTracker from "@/components/ViewTracker";
import {
  KeycapFigure,
  PathFigure,
  KeyPointFigure,
  WarnFigure,
  AnswerFigure,
  VersionFigure,
  StepsFigure,
  ChecklistFigure,
  FaqFigure,
  AltFigure,
} from "@/components/Figures";
import { markOf, imageOf } from "@/lib/guide";
import { getDesign, fxStyle } from "@/lib/design";
import type { Post } from "@/lib/posts";
import Link from "next/link";
import type { ReactNode } from "react";

// 인라인 강조 (**굵게** → 형광펜)
function inline(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((p, i) =>
    i % 2 === 1 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>,
  );
}

// ---- 도식 줄 인식 ----
// 새로 쓰는 글은 [키]/[경로]/[핵심]/[주의] + 가이드용 [즉답]/[버전]/[단계]/[확인]/[Q]/[A]/[대안]
// 표시를 붙여서 온다. (표시 목록의 기준은 lib/guide.ts 한 곳)
// 예전 글에는 표시가 없으므로, '그 줄 전체가 단축키뿐'인 경우만 조심스럽게 자동 인식한다.
// (본문 중간에 섞인 단축키까지 건드리면 문장이 깨진다)
const MODIFIERS =
  /^(⌘|⌃|⌥|⇧|command|cmd|control|ctrl|option|opt|alt|shift|fn|win|윈도우 ?키|커맨드|컨트롤|옵션|시프트)$/i;

function asKeycap(line: string): string[] | null {
  const t = line.trim().replace(/\.$/, "");
  if (t.length > 60 || !t.includes("+")) return null;
  const parts = t.split("+").map((p) => p.trim());
  if (parts.length < 2 || parts.some((p) => !p || p.length > 12)) return null;
  // 적어도 하나는 조합키여야 한다 ("1 + 1 = 2" 같은 문장을 걸러낸다)
  if (!parts.some((p) => MODIFIERS.test(p))) return null;
  return parts;
}

function asPath(line: string): string[] | null {
  const t = line.trim().replace(/\.$/, "");
  if (t.length > 90) return null;
  const sep = t.includes("→") ? "→" : t.includes(" > ") ? " > " : null;
  if (!sep) return null;
  const parts = t.split(sep).map((p) => p.trim());
  if (parts.length < 2 || parts.length > 6) return null;
  if (parts.some((p) => !p || p.length > 24)) return null;
  return parts;
}

// 본문에서 소제목만 뽑아 목차를 만든다 ('오즈백 한 줄 정리'는 뺀다)
function tableOfContents(body: string) {
  const out: { id: string; text: string }[] = [];
  let n = 0;
  for (const line of body.split("\n")) {
    if (!line.startsWith("## ")) continue;
    const text = line.slice(3).trim().replace(/\*\*/g, "");
    n++;
    if (text.includes("오즈백 한 줄") || text.includes("한 줄 정리")) continue;
    out.push({ id: `sec-${n}`, text });
  }
  return out;
}

// 마크다운 본문 → 에디토리얼 요소
// '오즈백 한 줄 정리'는 본문에서 빼내어 따로 돌려준다 (글 맨 위에 먼저 보여주기 위해).
function renderBody(body: string): { nodes: ReactNode[]; oneLine: string } {
  const lines = body.split("\n");
  const out: ReactNode[] = [];
  let oneLine = "";
  let firstPara = true;
  let i = 0;
  let key = 0;
  let headingNo = 0; // 목차 링크와 맞추기 위한 소제목 번호
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      const heading = line.slice(3).trim();
      headingNo++;
      if (heading.includes("오즈백 한 줄") || heading.includes("한 줄 정리")) {
        i++;
        const content: string[] = [];
        while (i < lines.length && !lines[i].startsWith("## ")) {
          if (lines[i].trim()) content.push(lines[i].trim());
          i++;
        }
        // 본문 자리에는 넣지 않는다 — 글 맨 위 '결론부터' 칸으로 올라간다
        oneLine = content.join(" ").replace(/\*\*/g, "");
        continue;
      }
      out.push(
        <h2
          key={key++}
          id={`sec-${headingNo}`}
          className="mt-12 flex scroll-mt-28 items-center gap-3 text-[26px] font-black leading-snug text-oddsbag-dark"
          style={{ wordBreak: "keep-all" }}
        >
          <span className="mt-0.5 h-7 w-3 shrink-0 rounded bg-oddsbag-purple" />
          {heading.replace(/\*\*/g, "")}
        </h2>,
      );
      i++;
      continue;
    }
    // ### 작은 소제목 — 본문 소제목(##)보다 한 단 낮다. 글 끝 안내처럼 곁들이는 자리에 쓴다.
    // 목차는 `## ` 만 세므로(61~70줄) 여기서 번호가 어긋날 일은 없다. (2026-08-18 신설)
    if (line.startsWith("### ")) {
      out.push(
        <h3
          key={key++}
          className="mt-9 text-[19px] font-black text-oddsbag-dark"
          style={{ wordBreak: "keep-all" }}
        >
          {line.slice(4).trim().replace(/\*\*/g, "")}
        </h3>,
      );
      i++;
      continue;
    }
    // 구분선 --- (2026-08-18 신설. 그전까지 화면에 `---` 가 글자로 그대로 찍혔다)
    // ※ 표의 구분줄(|---|---|)은 `|` 로 시작하므로 여기 안 걸린다.
    if (/^-{3,}$/.test(line.trim())) {
      out.push(
        <hr
          key={key++}
          className="my-10 border-0 border-t border-oddsbag-light-gray"
        />,
      );
      i++;
      continue;
    }
    // 마크다운 표 — | 항목 | 설명 | / |---|---| / | 내용 | 내용 |
    // 긴 정보성 글에서 조건·비교를 한눈에 보여주는 데 쓴다.
    if (
      line.trim().startsWith("|") &&
      lines[i + 1] &&
      /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])
    ) {
      const cells = (row: string) =>
        row
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const head = cells(line);
      i += 2; // 제목 줄 + 구분선
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(cells(lines[i]));
        i++;
      }
      out.push(
        // 폰에서 표가 넘치면 페이지 전체가 옆으로 밀린다 → 표만 따로 스크롤시킨다
        <div key={key++} className="my-7 -mx-1 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-[16px]">
            <thead>
              <tr>
                {head.map((h, j) => (
                  <th
                    key={j}
                    className="border-b-2 border-oddsbag-purple bg-oddsbag-light-gray/60 px-3 py-2.5 text-left font-black text-oddsbag-dark"
                    style={{ wordBreak: "keep-all" }}
                  >
                    {inline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, j) => (
                <tr key={j} className="border-b border-oddsbag-light-gray">
                  {r.map((c, k) => (
                    <td
                      key={k}
                      className="px-3 py-2.5 align-top leading-relaxed text-oddsbag-dark/90"
                      style={{ wordBreak: "keep-all" }}
                    >
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2).trim());
        i++;
      }
      out.push(
        <ul key={key++} className="my-5 flex flex-col gap-3">
          {items.map((it, j) => (
            <li key={j} className="flex items-start gap-3.5 text-[18.5px] leading-relaxed text-oddsbag-dark/90" style={{ wordBreak: "keep-all" }}>
              <span className="mt-2.5 h-2 w-2 shrink-0 rounded bg-oddsbag-yellow ring-4 ring-oddsbag-yellow/20" />
              <span>{inline(it)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }

    // ---- 본문 사진 ----
    // `![캡션](/경로.jpg)` 한 줄 = 사진 한 장. 캡션은 사진 아래 작은 글씨.
    // 2026-08-18 신설 — 그전까지 본문 사진은 아예 못 그렸다(커버 한 장이 전부).
    // WPMS 원고처럼 글 하나에 사진이 4~7장 들어가는 글을 올리려고 넣었다.
    // ★도식(195줄~)보다 먼저 걸러야 한다. 아래로 흘리면 문단 폴백에서 `![…](…)`가 글자로 찍힌다.
    const img = imageOf(line);
    if (img) {
      const { caption, src } = img;
      out.push(
        <figure key={key++} className="my-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={caption}
            loading="lazy"
            className="w-full rounded-2xl border border-oddsbag-light-gray"
          />
          {caption ? (
            <figcaption
              className="mt-2.5 text-center text-[15px] leading-relaxed text-oddsbag-dark/55"
              style={{ wordBreak: "keep-all" }}
            >
              {caption}
            </figcaption>
          ) : null}
        </figure>,
      );
      i++;
      continue;
    }

    // ---- 도식 ----
    const marked = markOf(line);
    const name = marked?.name;
    const rest = marked ? marked.rest : line.trim();

    // 연속된 같은 표시를 하나의 그림으로 묶는다 (사이에 낀 빈 줄은 무시)
    const collect = (want: string): string[] => {
      const got: string[] = [];
      let j = i;
      while (j < lines.length) {
        if (!lines[j].trim()) {
          j++;
          continue;
        }
        const mk = markOf(lines[j]);
        if (mk?.name !== want) break;
        got.push(mk.rest);
        j++;
      }
      i = j;
      return got;
    };

    if (name === "핵심") {
      out.push(<KeyPointFigure key={key++}>{inline(rest)}</KeyPointFigure>);
      i++;
      continue;
    }
    if (name === "주의") {
      out.push(<WarnFigure key={key++}>{inline(rest)}</WarnFigure>);
      i++;
      continue;
    }
    if (name === "즉답") {
      out.push(<AnswerFigure key={key++}>{inline(rest)}</AnswerFigure>);
      i++;
      continue;
    }
    if (name === "버전") {
      out.push(<VersionFigure key={key++}>{inline(rest)}</VersionFigure>);
      i++;
      continue;
    }
    if (name === "대안") {
      out.push(<AltFigure key={key++}>{inline(rest)}</AltFigure>);
      i++;
      continue;
    }
    if (name === "단계") {
      const items = collect("단계");
      out.push(
        <StepsFigure key={key++} steps={items.map((t) => <>{inline(t)}</>)} />,
      );
      continue;
    }
    if (name === "확인") {
      const items = collect("확인");
      out.push(
        <ChecklistFigure key={key++} items={items.map((t) => <>{inline(t)}</>)} />,
      );
      continue;
    }
    if (name === "Q") {
      // [Q] 바로 다음 줄이 [A]일 때만 FAQ로 세운다. 연속된 짝은 하나의 아코디언으로 묶는다.
      // 짝이 깨진 글(예전 글·형식 오류)은 그냥 문단으로 흘려보낸다 → 화면이 안 깨진다.
      const pairs: { q: ReactNode; a: ReactNode }[] = [];
      let j = i;
      while (j < lines.length) {
        while (j < lines.length && !lines[j].trim()) j++;
        const q = j < lines.length ? markOf(lines[j]) : null;
        if (q?.name !== "Q") break;
        let k = j + 1;
        while (k < lines.length && !lines[k].trim()) k++;
        const a = k < lines.length ? markOf(lines[k]) : null;
        if (a?.name !== "A") break;
        pairs.push({ q: <>{inline(q.rest)}</>, a: <>{inline(a.rest)}</> });
        j = k + 1;
      }
      if (pairs.length) {
        out.push(<FaqFigure key={key++} items={pairs} />);
        i = j;
        continue;
      }
    }

    // [키]/[경로] 표시가 있으면 우선 그걸로, 표시가 아예 없는 예전 글은 줄 모양을 보고 판단
    const keys =
      name === "키"
        ? rest.split("+").map((p) => p.trim())
        : marked
          ? null
          : asKeycap(rest);
    if (keys && keys.length >= 2) {
      out.push(<KeycapFigure key={key++} keys={keys} />);
      i++;
      continue;
    }
    const path =
      name === "경로"
        ? rest.split(/→|>/).map((p) => p.trim()).filter(Boolean)
        : marked
          ? null
          : asPath(rest);
    if (path && path.length >= 2) {
      out.push(<PathFigure key={key++} steps={path} />);
      i++;
      continue;
    }

    out.push(
      <p key={key++} className={firstPara ? "lead" : undefined}>
        {inline(rest)}
      </p>,
    );
    firstPara = false;
    i++;
  }
  return { nodes: out, oneLine };
}

// ---- 결론부터 (글 맨 위) ----
// 검색으로 들어온 사람은 답부터 원한다. 스크롤 없이 결론을 먼저 보여준다.
function OneLineTop({ text }: { text: string }) {
  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl border border-oddsbag-purple/15 bg-oddsbag-purple/[0.06] py-5 pl-6 pr-6">
      <span className="absolute inset-y-0 left-0 w-1.5 bg-oddsbag-yellow" />
      <div className="flex items-center gap-2">
        <span
          className="h-3.5 w-3.5 shrink-0 bg-oddsbag-purple"
          style={{
            clipPath:
              "polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%)",
          }}
        />
        <span className="text-[11.5px] font-black tracking-[0.16em] text-oddsbag-purple">
          결론부터 · 오즈백 한 줄 정리
        </span>
      </div>
      <p
        className="mt-2 text-[19px] font-bold leading-relaxed text-oddsbag-dark"
        style={{ wordBreak: "keep-all" }}
      >
        {text}
      </p>
    </div>
  );
}

/**
 * 글 상세 화면 (매거진·오즈백·뮤직 공통)
 * 코너마다 주소만 다르고 보이는 모양은 같다.
 */
export default function ArticleView({
  post,
  related,
  backHref,
  backLabel,
}: {
  post: Post;
  related: Post[];
  backHref: string;
  backLabel: string;
}) {
  const d = getDesign(post);
  const hasPhoto = Boolean(post.cover);
  const toc = tableOfContents(post.body);
  const { nodes: bodyNodes, oneLine } = renderBody(post.body);
  // 사진 위엔 흰 글자 + 그림자, 아니면 디자인 엔진 색
  const headTitle = hasPhoto ? "#fff" : d.title;
  const headCat = hasPhoto ? d.accent : d.catColor;
  const headSub = hasPhoto ? "rgba(255,255,255,.8)" : d.sub;
  const headShadow =
    hasPhoto || d.light ? { textShadow: "0 3px 24px rgba(0,0,0,.45)" } : {};

  return (
    <>
      <ViewTracker slug={post.slug} />
      <main className="flex-1">
        {/* 헤더 — 사진 있으면 사진+스크림, 없으면 생성형 배경 */}
        <header className="relative overflow-hidden" style={{ background: d.bg }}>
          {hasPhoto ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(10,6,20,.93) 0%, rgba(10,6,20,.65) 45%, rgba(10,6,20,.3) 100%)" }}
              />
            </>
          ) : (
            <div className="absolute inset-0" style={fxStyle(d.fx, d.accent)} />
          )}
          <div className="relative mx-auto max-w-2xl px-4 py-14 sm:py-20">
            <Link
              href={backHref}
              className="text-[15px] font-bold hover:underline"
              style={{ color: headTitle, opacity: 0.85 }}
            >
              ← {backLabel}
            </Link>
            <div
              className="mt-4 text-[14px] font-black tracking-[0.1em]"
              style={{ color: headCat, ...headShadow }}
            >
              {d.emoji} {post.category}
            </div>
            <h1
              className="mt-3 text-[32px] font-black leading-[1.15] sm:text-[48px]"
              style={{ color: headTitle, letterSpacing: "-0.03em", wordBreak: "keep-all", ...headShadow }}
            >
              {post.title}
            </h1>
            <p
              className="mt-5 max-w-[60ch] text-[17px] font-medium leading-relaxed sm:text-[19px]"
              style={{ color: headSub }}
            >
              {post.summary}
            </p>
            <div className="mt-6 flex items-center gap-2.5 text-[14px] font-semibold" style={{ color: headSub }}>
              <span>{post.date}</span>
              {post.readMinutes && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{post.readMinutes}분 읽기</span>
                </>
              )}
            </div>
            {post.imageCredit && (
              <div className="mt-4 text-[11px]" style={{ color: headSub, opacity: 0.6 }}>
                {post.imageCredit}
              </div>
            )}
          </div>
        </header>

        <article className="mx-auto max-w-2xl px-4 py-9">
          {/* 결론부터 — 검색으로 들어온 사람이 스크롤 없이 답을 보게 한다 */}
          {oneLine && <OneLineTop text={oneLine} />}

          {/* 목차 — 소제목이 4개 이상인 긴 글에만. 짧은 글엔 오히려 방해가 된다. */}
          {toc.length >= 4 && (
            <nav
              aria-label="목차"
              className="mb-9 rounded-2xl border border-oddsbag-light-gray bg-oddsbag-light-gray/40 px-5 py-4"
            >
              <p className="text-xs font-black tracking-[0.14em] text-oddsbag-purple">
                이 글에서 다루는 것
              </p>
              <ol className="mt-3 space-y-2">
                {toc.map((t, i) => (
                  <li key={t.id} className="flex gap-2.5 text-[15px] leading-snug">
                    <span className="shrink-0 font-black text-oddsbag-purple/60">
                      {i + 1}
                    </span>
                    <a
                      href={`#${t.id}`}
                      className="text-oddsbag-dark/85 transition hover:text-oddsbag-purple hover:underline"
                      style={{ wordBreak: "keep-all" }}
                    >
                      {t.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <div className="article-body mt-1">{bodyNodes}</div>

          <div className="my-9">
            <AdSlot />
          </div>

          <ReactionBar slug={post.slug} />

          {post.sources && post.sources.length > 0 && (
            <div className="mt-6 rounded-xl bg-oddsbag-light-gray/70 p-4">
              <p className="text-xs font-bold text-oddsbag-gray">출처</p>
              <ul className="mt-2 space-y-1">
                {post.sources.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-oddsbag-purple hover:underline"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 구독 칸 — 검색·유튜브로 들어온 사람이 도착하는 자리는 홈이 아니라 여기다. (2026-08-11)
              ★ 기사 페이지에는 이 한 곳에만 둔다. 두 개 넣으면 둘 다 무시당한다. */}
          <div className="mt-10">
            <SubscribeBox />
          </div>

          <div className="mt-8">
            <CommentSection slug={post.slug} />
          </div>
        </article>

        {related.length > 0 && (
          <div className="border-t border-oddsbag-light-gray bg-oddsbag-light-gray/40">
            <div className="mx-auto max-w-6xl px-4 py-10">
              <h2 className="mb-4 text-xl font-black text-oddsbag-dark">
                이런 글도 있어요
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {related.map((p) => (
                  <PostCard key={p.slug} post={p} />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
