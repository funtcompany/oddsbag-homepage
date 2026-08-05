import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChannelPage from "@/components/ChannelPage";
import { getPostsByChannel } from "@/lib/posts";
import { getSiteConfig } from "@/lib/sitecfg";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "오즈백",
  description:
    "오즈백이 만드는 서비스와 만드는 과정. 새 기능, 개발 이야기, 공지를 여기에 올립니다.",
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
        lead={cfg.footer.intro}
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
