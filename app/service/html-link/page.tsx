import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HtmlLinkClient from "./HtmlLinkClient";
import type { Metadata } from "next";
import { hubTools } from "@/lib/tools-hub";

// 이 페이지의 소개 문구는 도구 명부(lib/tools-hub.ts)에서 가져온다 — 두 곳이 어긋나지 않게.
const tool = hubTools.find((t) => t.slug === "html-link");

export const metadata: Metadata = {
  title: tool?.name ?? "HTML 링크 생성기",
  description: tool?.desc,
  alternates: { canonical: "/service/html-link" },
};

// 서버 컴포넌트 — Header/Footer(async 서버 컴포넌트)는 여기서만 렌더하고,
//  자료함의 인터랙티브 로직은 HtmlLinkClient("use client")가 맡는다.
export default function HtmlLinkPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <HtmlLinkClient />
      </main>
      <Footer />
    </>
  );
}
