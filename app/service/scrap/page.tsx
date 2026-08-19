import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrapClient from "./ScrapClient";
import type { Metadata } from "next";
import { hubTools } from "@/lib/tools-hub";

// 소개 문구는 도구 명부(lib/tools-hub.ts)에서 가져온다 — 두 곳이 어긋나지 않게.
const tool = hubTools.find((t) => t.slug === "scrap");

export const metadata: Metadata = {
  title: tool?.name ?? "스크랩 정리기",
  description: tool?.desc,
  alternates: { canonical: "/service/scrap" },
};

export default function ScrapPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <ScrapClient />
      </main>
      <Footer />
    </>
  );
}
