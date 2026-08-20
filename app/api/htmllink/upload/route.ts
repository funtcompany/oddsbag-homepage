import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/htmllink-user";
import { createItem, countByOwner, VISITOR_UPLOAD_LIMIT, storeReady } from "@/lib/htmllink-store";
import { inspectHtml } from "@/lib/htmllink-render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 한 건 5MB 상한

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "자료함을 먼저 열어 주세요." },
      { status: 401 },
    );
  }

  // 일반 방문자는 5개까지 (관리자는 무제한) — 사장님 결정 c
  if (!user.isAdmin) {
    // ★목록을 «못 읽는» 것과 «상한을 넘은» 것은 다르다.
    //   읽기 실패를 상한으로 취급하면 멀쩡한 사람이 못 올린다 → 못 읽으면 통과시킨다.
    let count = 0;
    try {
      count = await countByOwner(user.userId);
    } catch (e) {
      console.error("[htmllink] 상한 확인 실패 — 통과시킨다", e);
      count = 0;
    }
    if (count >= VISITOR_UPLOAD_LIMIT) {
      return NextResponse.json(
        {
          error: `자료는 ${VISITOR_UPLOAD_LIMIT}개까지 올릴 수 있습니다. 기존 자료를 지운 뒤 다시 시도해 주세요.`,
        },
        { status: 403 },
      );
    }
  }

  if (!storeReady()) {
    return NextResponse.json(
      { error: "지금 자료를 저장할 수 없습니다(저장소 미연결). 잠시 뒤 다시 시도해 주세요." },
      { status: 503 },
    );
  }

  let html = "";
  let title = "";
  try {
    const form = await req.formData();
    const file = form.get("file");
    const pasted = form.get("html");
    title = String(form.get("title") || "").trim();

    if (file && typeof (file as File).text === "function") {
      html = await (file as File).text();
      if (!title) title = (file as File).name.replace(/\.[a-z0-9]+$/i, "");
    } else if (typeof pasted === "string") {
      html = pasted;
    }
  } catch {
    return NextResponse.json(
      { error: "업로드 데이터를 읽지 못했습니다." },
      { status: 400 },
    );
  }

  if (!html.trim()) {
    return NextResponse.json({ error: "HTML 내용이 비어 있습니다." }, { status: 400 });
  }
  if (Buffer.byteLength(html, "utf8") > MAX_BYTES) {
    return NextResponse.json(
      { error: "파일이 너무 큽니다. 5MB 이하로 올려 주세요." },
      { status: 413 },
    );
  }

  try {
    const meta = await createItem(user.userId, title, html);
    // ★링크로 옮기면 «달라지는 것»을 올리는 그 자리에서 알려 준다.
    //   (옆 파일 참조는 고칠 수 없는 성질이라, 나중에 발견하면 원인을 못 찾는다)
    const { notes } = inspectHtml(html);
    return NextResponse.json({ ok: true, id: meta.id, notes });
  } catch (e) {
    return NextResponse.json(
      {
        error: "저장 중 오류가 발생했습니다.",
        detail: String(e instanceof Error ? e.message : e),
      },
      { status: 500 },
    );
  }
}
