import LegalPage, { Section, List } from "@/components/LegalPage";
import ContactForm from "@/components/ContactForm";
import { getSiteConfig } from "@/lib/sitecfg";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "문의하기",
  description:
    "오즈백(ODDSBAG)에 제보, 정정 요청, 제휴 문의를 보내는 방법입니다. 메일로 연락 주시면 확인 후 답변드립니다.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const cfg = await getSiteConfig();
  const MAIL = cfg.contact.email;

  return (
    <LegalPage title="문의하기" lead={cfg.contact.lead}>
      {cfg.contact.formEnabled && (
        <Section heading="여기에 바로 적어 보내주세요">
          <ContactForm thanks={cfg.contact.thanks} />
        </Section>
      )}

      <Section heading="메일로 보내셔도 됩니다">
        <p>
          위 폼 대신 메일로 보내셔도 똑같이 접수됩니다. 보통{" "}
          <strong>영업일 기준 2~3일 안에</strong> 답변드립니다.
        </p>
        <p className="rounded-2xl bg-oddsbag-light-gray px-5 py-6 text-center">
          <a
            href={`mailto:${MAIL}`}
            className="text-lg font-black text-oddsbag-purple underline underline-offset-4 sm:text-xl"
          >
            {MAIL}
          </a>
          <span className="mt-2 block text-xs text-oddsbag-gray">
            눌러서 바로 메일 쓰기
          </span>
        </p>
      </Section>

      <Section heading="이런 문의를 받습니다">
        <List
          items={[
            <>
              <strong>정정 요청</strong> — 글에 틀린 내용이 있을 때. 어느 글의 어느
              부분인지 알려주시면 확인하고 바로잡습니다.
            </>,
            <>
              <strong>제보</strong> — 다뤄줬으면 하는 소재나 정보가 있을 때.
            </>,
            <>
              <strong>저작권</strong> — 사진이나 인용에 권리 문제가 있을 때. 확인
              후 즉시 조치합니다.
            </>,
            <>
              <strong>제휴·광고</strong> — 협업이나 광고 문의.
            </>,
            <>
              <strong>개인정보</strong> — 내 정보 열람·삭제 요청, 뉴스레터 해지가
              안 될 때.
            </>,
          ]}
        />
      </Section>

      <Section heading="정정 요청은 이렇게 보내주시면 빠릅니다">
        <List
          items={[
            <>글 제목 또는 주소(URL)</>,
            <>어느 문장이 잘못됐는지</>,
            <>맞는 내용과 근거 (있으시면)</>,
          ]}
        />
        <p className="text-sm text-oddsbag-gray">
          근거가 없어도 괜찮습니다. 알려주시면 저희가 확인하겠습니다.
        </p>
      </Section>

      <Section heading="뉴스레터 해지">
        <p>
          받으신 메일 맨 아래의 <strong>구독 해지</strong> 링크를 누르시면 바로
          해지됩니다. 링크가 보이지 않거나 해지가 안 되면 위 메일로 알려주세요.
          직접 처리해 드립니다.
        </p>
      </Section>

      <Section heading="SNS로도 연락하실 수 있습니다">
        <List
          items={[
            <>
              인스타그램{" "}
              <a
                href="https://instagram.com/oddsbag_official"
                rel="noopener noreferrer"
                target="_blank"
                className="font-bold text-oddsbag-purple underline"
              >
                @oddsbag_official
              </a>{" "}
              — DM
            </>,
            <>
              페이스북{" "}
              <a
                href="https://www.facebook.com/profile.php?id=61586029697990"
                rel="noopener noreferrer"
                target="_blank"
                className="font-bold text-oddsbag-purple underline"
              >
                오즈백 페이지
              </a>{" "}
              — 메시지
            </>,
          ]}
        />
        <p className="text-sm text-oddsbag-gray">
          답변은 메일이 가장 빠릅니다.
        </p>
      </Section>

      <Section heading="운영 정보">
        <p>
          <strong>오즈백 ODDSBAG</strong>
          <br />
          온라인 매거진 · oddsbag.co.kr
          <br />
          연락처{" "}
          <a
            href={`mailto:${MAIL}`}
            className="font-bold text-oddsbag-purple underline"
          >
            {MAIL}
          </a>
        </p>
      </Section>
    </LegalPage>
  );
}
