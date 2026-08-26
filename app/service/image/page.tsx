import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ToolArticles from "@/components/ToolArticles";
import ImageClient from "./ImageClient";
import type { Metadata } from "next";
import { hubTools } from "@/lib/tools-hub";

// 소개 문구는 도구 명부(lib/tools-hub.ts)에서 가져온다 — 두 곳이 어긋나지 않게.
const tool = hubTools.find((t) => t.slug === "image");

export const revalidate = 300;

export const metadata: Metadata = {
  title: tool?.name ?? "사진 줄이기",
  description: tool?.desc,
  alternates: { canonical: "/service/image" },
};

export default function ImagePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <ImageClient />
        <ToolArticles boardKey="image" />
      </main>
      <Footer />
    </>
  );
}
