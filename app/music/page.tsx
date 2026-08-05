import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChannelPage from "@/components/ChannelPage";
import { getPostsByChannel } from "@/lib/posts";
import { getSiteConfig } from "@/lib/sitecfg";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "오즈백 뮤직",
  description:
    "오즈백이 직접 만드는 음악. 발매 소식과 만드는 과정을 여기에 올립니다.",
  alternates: { canonical: "/music" },
};

export default async function MusicPage() {
  const [posts, cfg] = await Promise.all([
    getPostsByChannel("music"),
    getSiteConfig(),
  ]);

  const links = [
    { label: "인스타그램", href: "https://instagram.com/oddsbag_music" },
    ...(cfg.footer.youtube ? [{ label: "유튜브", href: cfg.footer.youtube }] : []),
  ];

  return (
    <>
      <Header />
      <ChannelPage
        emoji="🎵"
        title="오즈백 뮤직"
        lead="필요할 때 틀어 두기 좋은 음악을 직접 만들어 내놓습니다. 만드는 과정과 발매 소식을 여기에 남깁니다."
        bgFrom="#1f1147"
        bgTo="#5b2d8e"
        posts={posts}
        links={links}
        emptyText="아직 올라온 음악 소식이 없습니다."
      />
      <Footer />
    </>
  );
}
