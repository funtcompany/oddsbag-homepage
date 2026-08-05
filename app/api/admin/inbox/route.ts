import { NextRequest, NextResponse } from "next/server";
import { listInquiries, updateInquiry } from "@/lib/inbox";

// 문의함 (인증은 proxy.ts에서 막는다)
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await listInquiries();
  return NextResponse.json({
    items,
    newCount: items.filter((i) => i.status === "new").length,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { id, status, note } = await req.json();
    if (typeof id !== "string") {
      return NextResponse.json({ error: "id 필요" }, { status: 400 });
    }
    const ok = await updateInquiry(id, {
      status: status === "done" || status === "new" ? status : undefined,
      note: typeof note === "string" ? note : undefined,
    });
    return NextResponse.json({ ok });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "서버 오류" },
      { status: 500 },
    );
  }
}
