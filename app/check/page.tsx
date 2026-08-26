import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChecklistClient from "./ChecklistClient";
import type { Metadata } from "next";
import { getCheckCards, haveOptions } from "@/lib/casebook";
import {
  ymdKST,
  CHECKLIST_NAME,
  CHECKLIST_TAGLINE,
  CHECKLIST_HREF,
} from "@/lib/checklist";

// 「챙길 것」 — 오즈백 툴즈(파일을 넣으면 결과물이 나오는 도구들)와 «성격이 다르다».
//   여기는 넣을 파일도 받아갈 파일도 없다. 오즈백이 확인해 둔 것을 골라 보여 주는 서비스라
//   툴즈 허브에 섞지 않고 「만드는 것들」 아래 자기 자리를 준다. (사장님 결정 2026-08-26)

export const metadata: Metadata = {
  title: CHECKLIST_NAME,
  description: CHECKLIST_TAGLINE,
  alternates: { canonical: CHECKLIST_HREF },
};

// 케이스북은 파일이라 자주 안 바뀐다. 하루 한 번이면 충분하다.
// (다시 그려질 때 「다시 볼 때가 지났습니다」 배지도 같이 갱신된다)
export const revalidate = 86400;

export default async function ChecklistPage() {
  const cards = await getCheckCards();

  return (
    <>
      <Header />
      <main className="flex-1">
        <ChecklistClient cards={cards} haveOptions={haveOptions} today={ymdKST()} />
      </main>
      <Footer />
    </>
  );
}
