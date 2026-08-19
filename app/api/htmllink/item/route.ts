import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/htmllink-user";
import {
  getMeta,
  renameItem,
  deleteItem,
  type HtmlLinkMeta,
} from "@/lib/htmllink-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OwnedResult =
  | { ok: false; kind: "unauth" | "noid" | "notfound" }
  | {
      ok: true;
      id: string;
      meta: HtmlLinkMeta;
      body: Record<string, unknown>;
    };

// 이 자료가 지금 로그인한 사람 것인지 확인한다.
async function ownedMeta(req: NextRequest): Promise<OwnedResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, kind: "unauth" };
  const { searchParams } = new URL(req.url);
  const isJson = req.headers.get("content-type")?.includes("application/json");
  let id = searchParams.get("id") || "";
  let body: Record<string, unknown> = {};
  if (isJson) {
    body = await req.json().catch(() => ({}));
    id = (body.id as string) || id;
  }
  if (!id) return { ok: false, kind: "noid" };
  const meta = await getMeta(id);
  // 없는 자료도, 남의 자료도 똑같이 «없음»으로 취급 (소유 여부를 흘리지 않는다)
  if (!meta || meta.ownerId !== user.userId) return { ok: false, kind: "notfound" };
  return { ok: true, id, meta, body };
}

function fail(kind: "unauth" | "noid" | "notfound") {
  if (kind === "unauth")
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (kind === "noid")
    return NextResponse.json({ error: "id가 없습니다." }, { status: 400 });
  return NextResponse.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });
}

// 이름 변경 — { id, title }
export async function PATCH(req: NextRequest) {
  const r = await ownedMeta(req);
  if (!r.ok) return fail(r.kind);
  const title = String((r.body.title as string) || "").trim();
  if (!title)
    return NextResponse.json({ error: "새 이름을 입력해 주세요." }, { status: 400 });
  const meta = await renameItem(r.id, title);
  return NextResponse.json({ ok: true, meta });
}

// 삭제 — { id } (또는 ?id=)
export async function DELETE(req: NextRequest) {
  const r = await ownedMeta(req);
  if (!r.ok) return fail(r.kind);
  await deleteItem(r.id);
  return NextResponse.json({ ok: true });
}
