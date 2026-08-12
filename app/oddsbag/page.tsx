import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChannelPage from "@/components/ChannelPage";
import { getPostsByChannel } from "@/lib/posts";
import { getSiteConfig } from "@/lib/sitecfg";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "오즈백 소식",
  description:
    "오즈백 브랜드의 새 소식. 새로 나온 서비스, 달라진 점, 공지를 전하는 게시판입니다.",
  alternates: { canonical: "/oddsbag" },
};

export default async function OddsbagPage() {
  const [posts, cfg] = await Promise.all([
    getPostsByChannel("oddsbag"),
    getSiteConfig(),
  ]);

  return (
    <>
      <Header />
      <ChannelPage
        emoji="🎒"
        title="오즈백이 만드는 것들"
        // 푸터의 회사 소개(footer.intro)를 돌려쓰지 않는다.
        //  여기는 매거진 소개가 아니라 브랜드 소식 게시판이다 (지시 2026-08-12).
        lead={cfg.oddsbag.lead}
        bgFrom="#4c1d95"
        bgTo="#7b4fb5"
        posts={posts}
        links={[
          { label: "서비스 보기", href: "/services" },
          { label: "매거진 보기", href: "/magazine" },
          { label: "문의하기", href: "/contact" },
        ]}
        emptyText="아직 올라온 소식이 없습니다."
      />
      <Footer />
    </>
  );
}
