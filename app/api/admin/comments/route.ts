import { NextRequest, NextResponse } from "next/server";
import { lrange, rpush, kvDel, isPersistent } from "@/lib/store";
import { getAllPosts } from "@/lib/posts";

// 댓글 관리 — 사칭·욕설·광고 댓글을 내리는 수단.
// 인증은 proxy.ts 가 /api/admin/* 을 통째로 막고 있으므로 여기서 또 검사하지 않는다.
// (라우트마다 인증 코드를 흩어놓으면 새 라우트에서 빠뜨린다 — proxy.ts 주석 참고)
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const key = (slug: string) => `comments:${slug}`;

// 댓글은 글마다 별도 리스트(comments:<slug>)로 흩어져 있고,
// lib/store.ts 에는 키를 훑는 수단(KEYS/SCAN)이 없다.
// 그래서 «최신 글부터» 정해진 개수만 훑는다. 전부 훑으면 글 수(300편+)만큼
// 왕복이 생겨 관리자 화면이 한참 멈춘다. 더 뒤까지 봐야 하면 ?scan=all.
const DEFAULT_SCAN = 150;
// 한 번에 몰아치면 Upstash 쪽에서 막힌다 — 10개씩 끊어서 부른다
const BATCH = 10;

interface CommentItem {
  slug: string;
  title: string;
  /** 그 글 댓글 리스트에서의 자리 (삭제할 때 위치 확인용) */
  index: number;
  name: string;
  text: string;
  date: string;
  /** 저장된 원본 문자열 그대로 — 삭제할 때 «정말 이 댓글인지» 대조하는 데 쓴다 */
  raw: string;
}

function parseComment(raw: string): { name?: string; text?: string; date?: string } | null {
  try {
    const c = JSON.parse(raw);
    return c && typeof c === "object" ? c : null;
  } catch {
    return null; // 깨진 줄은 목록에서 조용히 건너뛴다 (지우려면 slug 지정해서 다시 본다)
  }
}

/**
 * GET /api/admin/comments            → 최신 글 150편에 달린 댓글 전부
 * GET /api/admin/comments?scan=all   → 전체 글을 훑는다 (느리다)
 * GET /api/admin/comments?slug=xxx   → 그 글의 댓글만
 */
export async function GET(req: NextRequest) {
  const one = req.nextUrl.searchParams.get("slug");
  const scan = req.nextUrl.searchParams.get("scan");

  // getAllPosts 는 60초 캐시 + 날짜 내림차순 정렬이라 최신 글부터 훑기에 알맞다
  const posts = await getAllPosts();
  const targets = one
    ? posts.filter((p) => p.slug === one)
    : posts.slice(
        0,
        scan === "all"
          ? posts.length
          : Math.max(1, Number(scan) || DEFAULT_SCAN),
      );

  const items: CommentItem[] = [];
  for (let i = 0; i < targets.length; i += BATCH) {
    const chunk = targets.slice(i, i + BATCH);
    const lists = await Promise.all(
      chunk.map((p) => lrange(key(p.slug)).catch(() => [] as string[])),
    );
    chunk.forEach((p, j) => {
      lists[j].forEach((raw, index) => {
        const c = parseComment(raw);
        if (!c) return;
        items.push({
          slug: p.slug,
          title: p.title,
          index,
          name: typeof c.name === "string" ? c.name : "익명",
          text: typeof c.text === "string" ? c.text : "",
          date: typeof c.date === "string" ? c.date : "",
          raw,
        });
      });
    });
  }

  // 최근 것부터 — 날짜가 같으면 나중에 달린 쪽(뒤 인덱스)이 위로
  items.sort((a, b) =>
    a.date === b.date ? b.index - a.index : a.date < b.date ? 1 : -1,
  );

  return NextResponse.json({
    items,
    scanned: targets.length,
    total: posts.length,
    // 메모리 폴백에서는 삭제를 막는다 (아래 DELETE 주석 참고) — 화면에 미리 알린다
    canDelete: isPersistent,
  });
}

/**
 * DELETE /api/admin/comments   body: { slug, index, raw }
 *
 * ★왜 이렇게 지우나 — 댓글은 Redis «리스트»다. 자리(index)만 믿고 지우면
 *   지우는 사이에 새 댓글이 달렸을 때 엉뚱한 댓글이 날아간다.
 *   그래서 (1) 저장된 원본 문자열(raw)이 그 자리에 실제로 있는지 대조하고,
 *          (2) 지우기 직전에 리스트를 한 번 더 읽어 그새 바뀌지 않았는지 확인한 뒤,
 *          (3) 남길 것만 다시 채워 넣는다.
 *   그새 바뀌었으면 아무것도 건드리지 않고 409 로 돌려보낸다 (새로고침 후 다시).
 *
 *   진짜 안전한 방법은 Redis LREM 한 방인데 lib/store.ts 에 그 함수가 없다.
 *   (lib/store.ts 는 다른 갈래도 쓰는 파일이라 손대지 않았다 — lrem 추가 요청함)
 */
export async function DELETE(req: NextRequest) {
  try {
    // 메모리 폴백(로컬)에서는 리스트를 비울 수단이 없다.
    // kvDel 은 문자열 저장소만 지우므로, 여기서 그냥 진행하면 댓글이 두 배로 늘어난다.
    // 망가뜨리느니 막는다 — 운영(Upstash 연결)에서는 정상 동작한다.
    if (!isPersistent) {
      return NextResponse.json(
        {
          error:
            "저장소(Upstash)가 연결되지 않은 상태입니다. 로컬 메모리 모드에서는 댓글을 지울 수 없습니다.",
        },
        { status: 501 },
      );
    }

    const { slug, index, raw } = await req.json();
    if (typeof slug !== "string" || !slug || typeof raw !== "string") {
      return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
    }

    const k = key(slug);
    const before = await lrange(k);

    // 1) 보낸 자리에 그 댓글이 그대로 있나? 아니면 같은 내용을 리스트에서 찾는다
    let at = typeof index === "number" && before[index] === raw ? index : -1;
    if (at < 0) at = before.indexOf(raw);
    if (at < 0) {
      return NextResponse.json(
        { error: "이미 지워졌거나 내용이 바뀐 댓글입니다. 새로고침해 주세요." },
        { status: 404 },
      );
    }

    // 2) 지우기 직전 재확인 — 그새 새 댓글이 달렸으면 손대지 않는다
    const now = await lrange(k);
    if (now.length !== before.length || now.some((v, i) => v !== before[i])) {
      return NextResponse.json(
        { error: "그 사이 새 댓글이 달렸습니다. 새로고침한 뒤 다시 지워 주세요." },
        { status: 409 },
      );
    }

    // 3) 남길 것만 순서대로 다시 채워 넣는다
    const survivors = before.filter((_, i) => i !== at);
    await kvDel(k); // 리스트 키 통째로 삭제 (DEL 은 리스트에도 그대로 먹는다)
    for (const s of survivors) await rpush(k, s);

    return NextResponse.json({ ok: true, remaining: survivors.length });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "서버 오류" },
      { status: 500 },
    );
  }
}
