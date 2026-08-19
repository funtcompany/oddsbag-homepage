"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { makeZip } from "@/lib/zip";
import {
  extractUrls,
  classifyUrl,
  makeImageName,
  imageGroup,
  toCsv,
  toTsv,
  toMarkdown,
  ymd,
  decideGroupMode,
  GROUP_LABEL,
  type GroupMode,
  type UrlRow,
  type ImageInfo,
} from "@/lib/scrap";
import { pickFromFiles, measureImage, contentHash } from "@/lib/scrap-files";
import { fmtBytes } from "@/lib/ebook-render";

// 스크랩 정리기 — 모아 두기만 한 주소·사진을 «쓸 수 있게» 바꾼다.
//  ★사진과 문서는 서버로 가지 않는다. 주소의 «제목»을 읽을 때만 서버가 대신 다녀온다.

interface Shot extends ImageInfo {
  blob: Blob;
  path: string;
  hash: string;
  dupOf: string | null;
  newName: string;
  group: string;
}

const PEEK_BATCH = 25;

export default function ScrapClient() {
  const [text, setText] = useState("");
  const [prefix, setPrefix] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode>("auto");
  const [rows, setRows] = useState<UrlRow[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [skipped, setSkipped] = useState<{ name: string; why: string }[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const [peeked, setPeeked] = useState(false);
  const [copied, setCopied] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const urlsInText = useMemo(() => extractUrls(text), [text]);

  // ── 파일 받기 ──────────────────────────────────────────────
  const takeFiles = useCallback(
    async (list: FileList | File[] | null) => {
      const files = list ? Array.from(list) : [];
      if (!files.length) return;
      setErr("");
      setBusy(`파일 ${files.length}개를 여는 중…`);
      try {
        const picked = await pickFromFiles(files);
        setSkipped((s) => [...s, ...picked.skipped]);

        // 글은 입력칸 뒤에 이어 붙인다 — 사장님이 무엇이 들어왔는지 눈으로 본다
        if (picked.texts.length) {
          const add = picked.texts
            .map((t) => `\n\n===== ${t.name} =====\n${t.text}`)
            .join("");
          setText((prev) => prev + add);
        }

        if (picked.images.length) {
          setBusy(`사진 ${picked.images.length}장을 재는 중…`);
          const made: Shot[] = [];
          const byHash = new Map<string, string>();
          for (const im of picked.images) {
            const info = await measureImage(im.name, im.blob);
            const hash = await contentHash(im.blob);
            const dupOf = byHash.get(hash) ?? null;
            if (!dupOf) byHash.set(hash, info.original);
            made.push({
              ...info,
              blob: im.blob,
              path: im.name,
              hash,
              dupOf,
              newName: "",
              group: imageGroup(info),
            });
          }
          setShots((prev) => renumber([...prev, ...made], prefix, groupMode));
        }
      } catch (e) {
        setErr(String(e instanceof Error ? e.message : e));
      } finally {
        setBusy("");
      }
    },
    [prefix, groupMode],
  );

  // 붙여넣기로 그림이 들어오는 경우 (캡처 → 바로 붙여넣기)
  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
      if (imgs.length) {
        e.preventDefault();
        void takeFiles(imgs);
      }
    },
    [takeFiles],
  );

  // ── 정리하기 ──────────────────────────────────────────────
  function organizeUrls() {
    const urls = extractUrls(text);
    if (!urls.length) {
      setErr("글에서 주소를 찾지 못했습니다. http 로 시작하는 주소를 붙여넣어 주세요.");
      return;
    }
    setErr("");
    setPeeked(false);
    setRows(
      urls.map((u) => {
        const k = classifyUrl(u);
        return { url: u, title: "", desc: "", site: k.site, group: k.group };
      }),
    );
  }

  async function peekTitles() {
    setErr("");
    setBusy("제목을 읽어오는 중…");
    try {
      const next = [...rows];
      for (let i = 0; i < next.length; i += PEEK_BATCH) {
        const slice = next.slice(i, i + PEEK_BATCH);
        setBusy(`제목을 읽어오는 중… (${Math.min(i + PEEK_BATCH, next.length)}/${next.length})`);
        const res = await fetch("/api/scrap/peek", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ urls: slice.map((r) => r.url) }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErr(data.error || "제목을 읽지 못했습니다.");
          break;
        }
        for (const it of data.items ?? []) {
          const at = next.findIndex((r) => r.url === it.url);
          if (at < 0) continue;
          next[at] = {
            ...next[at],
            title: it.title || next[at].title,
            desc: it.desc || "",
            site: it.site || next[at].site,
            // 못 읽은 것은 «못 읽었다»고 그대로 적는다 — 조용히 빈칸으로 두지 않는다
            ...(it.error ? { title: next[at].title || `(못 읽음 — ${it.error})` } : {}),
          };
        }
        setRows([...next]);
      }
      setPeeked(true);
    } catch {
      setErr("제목을 읽지 못했습니다.");
    } finally {
      setBusy("");
    }
  }

  function applyPrefix(p: string) {
    setPrefix(p);
    setShots((prev) => renumber(prev, p, groupMode));
  }

  function applyGroupMode(m: GroupMode) {
    setGroupMode(m);
    setShots((prev) => renumber(prev, prefix, m));
  }

  // ── 내려받기 ──────────────────────────────────────────────
  function save(name: string, data: BlobPart, type: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  const today = ymd(new Date()) ?? "";

  async function downloadImages() {
    setBusy("압축파일을 만드는 중…");
    try {
      const keep = shots.filter((s) => !s.dupOf);
      const files = await Promise.all(
        keep.map(async (s) => ({
          name: s.group ? `${s.group}/${s.newName}` : s.newName,
          data: new Uint8Array(await s.blob.arrayBuffer()),
        })),
      );
      // 무엇이 무엇으로 바뀌었는지 표를 같이 넣는다 — 나중에 되짚을 수 있게
      const map = [
        "﻿원래 이름,새 이름,폴더,가로,세로,용량(byte),찍은날,날짜출처",
        ...shots.map((s) =>
          [
            s.original,
            s.dupOf ? "(같은 사진이라 제외)" : s.newName,
            s.dupOf ? "" : s.group,
            s.width,
            s.height,
            s.bytes,
            ymd(s.taken) ?? "",
            s.taken ? (s.takenFromExif ? "찍은날(EXIF)" : "파일수정일") : "",
          ]
            .map((c) => `"${String(c).replace(/"/g, '""')}"`)
            .join(","),
        ),
      ].join("\r\n");
      files.push({ name: "_이름바꾼표.csv", data: new TextEncoder().encode(map) });

      const blob = makeZip(files);
      save(`정리된사진_${today}.zip`, blob, "application/zip");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy("");
    }
  }

  function copy(kind: "tsv" | "md") {
    const s = kind === "tsv" ? toTsv(rows) : toMarkdown(rows);
    navigator.clipboard?.writeText(s);
    setCopied(kind);
    setTimeout(() => setCopied(""), 1800);
  }

  const dupCount = shots.filter((s) => s.dupOf).length;
  const exifCount = shots.filter((s) => s.takenFromExif).length;
  const autoMode = useMemo(() => decideGroupMode(shots.filter((s) => !s.dupOf)), [shots]);
  const byGroup = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.group, (m.get(r.group) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <div className="text-4xl" aria-hidden>
          🗂
        </div>
        <h1 className="mt-3 text-[26px] font-black text-oddsbag-dark sm:text-[32px]" style={{ letterSpacing: "-0.03em", wordBreak: "keep-all" }}>
          스크랩 정리기
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-oddsbag-gray" style={{ wordBreak: "keep-all" }}>
          모아두기만 한 <b className="text-oddsbag-dark">주소와 사진</b>을 한꺼번에 정리합니다.
          주소는 제목을 붙여 엑셀로, 사진은 이름을 바꾸고 묶어서 압축파일로 내려받습니다.
        </p>
        <p className="mt-2 text-[13px] text-oddsbag-gray">
          🔒 사진과 문서는 <b>서버로 가지 않습니다.</b> 주소의 제목을 읽을 때만 서버가 대신 다녀옵니다.
        </p>
      </div>

      {/* ① 넣기 */}
      <section className="rounded-2xl border border-oddsbag-light-gray bg-white p-5">
        <h2 className="text-[15px] font-black text-oddsbag-dark">① 여기에 다 넣으세요</h2>
        <p className="mt-1 text-[12.5px] text-oddsbag-gray">
          긴 글을 그대로 붙여넣으셔도 되고, 파일을 끌어다 놓으셔도 됩니다. 캡처한 그림도 바로 붙여넣기 됩니다.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void takeFiles(e.dataTransfer.files);
          }}
          placeholder={"메모, 카톡 대화, 문서 내용… 아무거나 그대로 붙여넣으세요.\n주소(http…)를 알아서 골라냅니다.\n\n파일을 이 칸으로 끌어다 놓아도 됩니다."}
          rows={10}
          className={`mt-3 w-full resize-y rounded-xl border-2 p-3.5 font-mono text-[13px] leading-relaxed outline-none transition ${
            drag ? "border-oddsbag-purple bg-oddsbag-purple/5" : "border-oddsbag-light-gray focus:border-oddsbag-purple"
          }`}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-oddsbag-light-gray px-3.5 py-2 text-[13px] font-black text-oddsbag-dark hover:border-oddsbag-purple"
          >
            📎 파일 고르기
          </button>
          <span className="text-[12.5px] text-oddsbag-gray">
            사진 · 워드(docx) · 텍스트 · 압축파일(zip)
          </span>
          <span className="ml-auto text-[12.5px] font-bold text-oddsbag-purple">
            {urlsInText.length > 0 && `주소 ${urlsInText.length}개 보임`}
            {shots.length > 0 && ` · 사진 ${shots.length}장`}
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void takeFiles(e.target.files)}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={organizeUrls}
            disabled={!urlsInText.length || !!busy}
            className="rounded-xl bg-oddsbag-purple px-5 py-3 text-[14px] font-black text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            주소 정리하기
          </button>
          {(text || shots.length > 0 || rows.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setText("");
                setRows([]);
                setShots([]);
                setSkipped([]);
                setErr("");
                setPeeked(false);
              }}
              className="rounded-xl border border-oddsbag-light-gray px-4 py-3 text-[13px] font-bold text-oddsbag-gray hover:text-oddsbag-dark"
            >
              전부 비우기
            </button>
          )}
        </div>

        {busy && <p className="mt-3 text-[13px] font-bold text-oddsbag-purple">{busy}</p>}
        {err && (
          <p className="mt-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-700" style={{ wordBreak: "keep-all" }}>
            {err}
          </p>
        )}
        {skipped.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-900">
            <b>못 읽은 것 {skipped.length}개</b>
            <ul className="mt-1 space-y-0.5">
              {skipped.slice(0, 5).map((s, i) => (
                <li key={i}>· {s.name} — {s.why}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ② 주소 */}
      {rows.length > 0 && (
        <section className="mt-5 rounded-2xl border border-oddsbag-light-gray bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-black text-oddsbag-dark">
              ② 주소 {rows.length}개
            </h2>
            <button
              type="button"
              onClick={peekTitles}
              disabled={!!busy || peeked}
              className="rounded-lg bg-oddsbag-dark px-3.5 py-2 text-[12.5px] font-black text-white disabled:opacity-40"
            >
              {peeked ? "제목 읽었습니다" : "🔎 제목 읽어오기"}
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {byGroup.map(([g, n]) => (
              <span key={g} className="rounded-full bg-oddsbag-light-gray px-2.5 py-1 text-[11.5px] font-bold text-oddsbag-gray">
                {g} {n}
              </span>
            ))}
          </div>

          <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-oddsbag-light-gray">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-oddsbag-light-gray/80 text-left">
                <tr>
                  <th className="px-2.5 py-2 font-black text-oddsbag-dark">묶음</th>
                  <th className="px-2.5 py-2 font-black text-oddsbag-dark">제목 · 주소</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.url} className={i % 2 ? "bg-oddsbag-light-gray/20" : ""}>
                    <td className="whitespace-nowrap px-2.5 py-2 align-top text-oddsbag-gray">{r.group}</td>
                    <td className="px-2.5 py-2">
                      <span className="font-bold text-oddsbag-dark">{r.title || "(제목 아직 안 읽음)"}</span>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block break-all text-[11.5px] text-oddsbag-purple hover:underline">
                        {r.url}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" onClick={() => save(`주소목록_${today}.csv`, toCsv(rows), "text/csv;charset=utf-8")} className="rounded-lg border border-oddsbag-light-gray px-3 py-2.5 text-[12.5px] font-black text-oddsbag-dark hover:border-oddsbag-purple">
              📊 엑셀(CSV)
            </button>
            <button type="button" onClick={() => copy("tsv")} className="rounded-lg border border-oddsbag-light-gray px-3 py-2.5 text-[12.5px] font-black text-oddsbag-dark hover:border-oddsbag-purple">
              {copied === "tsv" ? "복사했습니다" : "📋 시트에 붙여넣기"}
            </button>
            <button type="button" onClick={() => copy("md")} className="rounded-lg border border-oddsbag-light-gray px-3 py-2.5 text-[12.5px] font-black text-oddsbag-dark hover:border-oddsbag-purple">
              {copied === "md" ? "복사했습니다" : "📝 노션용"}
            </button>
            <button type="button" onClick={() => save(`주소목록_${today}.txt`, rows.map((r) => r.url).join("\n"), "text/plain;charset=utf-8")} className="rounded-lg border border-oddsbag-light-gray px-3 py-2.5 text-[12.5px] font-black text-oddsbag-dark hover:border-oddsbag-purple">
              📄 주소만
            </button>
          </div>
          <p className="mt-2 text-[11.5px] text-oddsbag-gray">
            엑셀(CSV)은 한글이 안 깨지게 만들어 두었습니다. 구글 시트에는 「시트에 붙여넣기」가 더 깔끔합니다.
          </p>
        </section>
      )}

      {/* ③ 사진 */}
      {shots.length > 0 && (
        <section className="mt-5 rounded-2xl border border-oddsbag-light-gray bg-white p-5">
          <h2 className="text-[15px] font-black text-oddsbag-dark">③ 사진 {shots.length}장</h2>

          <label className="mt-3 block text-[13px] font-bold text-oddsbag-dark">묶음 이름</label>
          <input
            value={prefix}
            onChange={(e) => applyPrefix(e.target.value)}
            placeholder="예) 답사사진 · 상품컷 (비워두셔도 됩니다)"
            className="mt-1.5 w-full rounded-lg border border-oddsbag-light-gray px-3 py-2.5 text-sm outline-none focus:border-oddsbag-purple"
          />
          <p className="mt-1.5 text-[12px] text-oddsbag-gray">
            이름은 <b>묶음_날짜_번호_모양</b> 으로 바뀝니다.
            {dupCount > 0 && <span className="text-oddsbag-purple"> · 똑같은 사진 {dupCount}장은 빼고 담습니다.</span>}
          </p>

          <label className="mt-4 block text-[13px] font-bold text-oddsbag-dark">폴더 나누는 기준</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(["auto", "month", "shape", "folder", "none"] as GroupMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => applyGroupMode(m)}
                className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-bold transition ${
                  groupMode === m
                    ? "border-oddsbag-purple bg-oddsbag-purple/5 text-oddsbag-purple"
                    : "border-oddsbag-light-gray text-oddsbag-gray hover:border-oddsbag-purple/50"
                }`}
              >
                {m === "auto" ? `알아서 (${GROUP_LABEL[autoMode]})` : GROUP_LABEL[m]}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-oddsbag-gray" style={{ wordBreak: "keep-all" }}>
            {groupMode === "auto" && exifCount === 0 && (
              <>사진에 <b>찍은 날</b>이 적혀 있지 않아 «모양별»로 나눕니다. (카톡·캡처로 받은 사진은 촬영일이 지워집니다)</>
            )}
            {groupMode === "auto" && exifCount > 0 && (
              <>{shots.length}장 중 {exifCount}장에 찍은 날이 있어 «{GROUP_LABEL[autoMode]}»로 나눕니다.</>
            )}
            {groupMode === "month" && exifCount < shots.length && (
              <>찍은 날이 없는 {shots.length - exifCount}장은 <b>날짜모름</b> 폴더로 갑니다. 파일 수정일은 쓰지 않습니다 — 복사만 해도 바뀌어서 사실이 아닌 날짜가 됩니다.</>
            )}
            {groupMode === "folder" && <>압축파일 안에 원래 있던 폴더 구조를 그대로 씁니다.</>}
            {groupMode === "none" && <>폴더를 만들지 않고 한자리에 모두 담습니다.</>}
            {groupMode === "shape" && <>가로형·세로형·정사각처럼 사진 «모양»으로 나눕니다.</>}
          </p>

          <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-oddsbag-light-gray">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-oddsbag-light-gray/80 text-left">
                <tr>
                  <th className="px-2.5 py-2 font-black text-oddsbag-dark">지금 이름</th>
                  <th className="px-2.5 py-2 font-black text-oddsbag-dark">바뀔 이름</th>
                  <th className="px-2.5 py-2 font-black text-oddsbag-dark">정보</th>
                </tr>
              </thead>
              <tbody>
                {shots.map((s) => (
                  <tr key={s.hash + s.path} className={s.dupOf ? "bg-amber-50/60" : ""}>
                    <td className="max-w-[180px] truncate px-2.5 py-1.5 text-oddsbag-gray" title={s.original}>{s.original}</td>
                    <td className="px-2.5 py-1.5 font-bold text-oddsbag-dark">
                      {s.dupOf ? (
                        <span className="font-normal text-amber-700">「{s.dupOf}」와 같은 사진 — 제외</span>
                      ) : (
                        s.group ? `${s.group}/${s.newName}` : s.newName
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-oddsbag-gray">
                      {s.width}×{s.height} · {fmtBytes(s.bytes)}
                      {s.taken && (
                        <span title={s.takenFromExif ? "사진에 적힌 촬영일" : "파일 수정일 — 복사만 해도 바뀝니다"}>
                          {" · "}{ymd(s.taken)}{s.takenFromExif ? "" : "*"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-[11.5px] text-oddsbag-gray">
            날짜 뒤 <b>*</b> 는 «찍은 날»이 아니라 «파일 수정일»입니다 — 복사·전송만 해도 바뀌므로 덜 믿을 만합니다.
          </p>

          <button
            type="button"
            onClick={downloadImages}
            disabled={!!busy}
            className="mt-3 w-full rounded-xl bg-oddsbag-purple px-5 py-3 text-[14px] font-black text-white hover:brightness-110 disabled:opacity-40"
          >
            📦 이름 바꿔서 압축파일로 받기 ({shots.length - dupCount}장)
          </button>
        </section>
      )}

      {/* 도움말 */}
      <section className="mt-8 rounded-2xl bg-oddsbag-light-gray/40 p-5">
        <h2 className="text-[14px] font-black text-oddsbag-dark">이럴 때 씁니다</h2>
        <ul className="mt-2.5 space-y-1.5 text-[13.5px] leading-relaxed text-oddsbag-gray" style={{ wordBreak: "keep-all" }}>
          <li>· 카톡·메모에 쌓아둔 링크 뭉치를 <b className="text-oddsbag-dark">제목 붙은 표</b>로 만들 때</li>
          <li>· <b className="text-oddsbag-dark">IMG_0421.JPG</b> 같은 사진 수백 장을 알아볼 수 있는 이름으로 바꿀 때</li>
          <li>· 여기저기서 받은 사진에서 <b className="text-oddsbag-dark">겹치는 것</b>을 걸러낼 때</li>
        </ul>
      </section>
    </div>
  );
}

/**
 * 번호를 처음부터 다시 매긴다 — 묶음 이름·나누는 기준이 바뀌거나 사진이 늘면 다시 부른다.
 *  ★폴더 기준(mode)은 «묶음 전체가 하나»를 쓴다. 사진마다 따로 정하면 폴더가 뒤죽박죽 된다.
 */
function renumber(list: Shot[], prefix: string, mode: GroupMode): Shot[] {
  const live = list.filter((s) => !s.dupOf);
  const real = mode === "auto" ? decideGroupMode(live) : mode;
  const counter = new Map<string, number>();
  return list.map((s) => {
    if (s.dupOf) return { ...s, newName: "", group: "" };
    // «원래 폴더 그대로»는 압축파일 안의 경로가 필요하다 (original 은 파일 이름만 갖고 있다)
    const g = imageGroup(real === "folder" ? { ...s, original: s.path } : s, real);
    const n = (counter.get(g) ?? 0) + 1;
    counter.set(g, n);
    return { ...s, group: g, newName: makeImageName(s, n, prefix) };
  });
}
