import LegalPage, { Section, List } from "@/components/LegalPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description:
    "오즈백(ODDSBAG)이 수집하는 개인정보 항목과 이용 목적, 보관 기간, 쿠키와 광고 관련 안내입니다.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="개인정보처리방침"
      lead="오즈백이 어떤 정보를 받고, 어떻게 쓰고, 언제 지우는지 정리했습니다."
      updated="2026년 7월 27일"
    >
      <Section heading="1. 수집하는 정보">
        <p>오즈백은 아래 정보만 받습니다.</p>
        <List
          items={[
            <>
              <strong>이메일 주소</strong> — 뉴스레터를 신청하실 때만 받습니다.
              신청하지 않으시면 받지 않습니다.
            </>,
            <>
              <strong>문의 내용</strong> — 메일로 문의를 보내주시면 그 내용과
              보내신 주소가 메일함에 남습니다.
            </>,
            <>
              <strong>접속 기록</strong> — 어떤 글을 몇 명이 봤는지 같은 통계가
              자동으로 쌓입니다. 개인을 특정하는 용도로 쓰지 않습니다.
            </>,
          ]}
        />
        <p>
          회원가입은 받지 않습니다. 이름, 전화번호, 주소, 주민등록번호 같은 정보는
          수집하지 않습니다.
        </p>
      </Section>

      <Section heading="2. 왜 쓰나요">
        <List
          items={[
            <>이메일 주소 — 뉴스레터를 보내드리기 위해서만 씁니다.</>,
            <>문의 내용 — 답변을 드리기 위해 씁니다.</>,
            <>
              접속 기록 — 어떤 글이 도움이 됐는지 확인해 다음 글을 더 낫게 만드는
              데 씁니다.
            </>,
          ]}
        />
        <p>
          <strong>광고나 마케팅 목적으로 제3자에게 판매하거나 넘기지
          않습니다.</strong>
        </p>
      </Section>

      <Section heading="3. 얼마나 보관하나요">
        <List
          items={[
            <>
              이메일 주소 — 구독을 해지하시면 <strong>즉시 삭제</strong>합니다.
              메일 맨 아래 해지 링크로 언제든 해지하실 수 있습니다.
            </>,
            <>문의 내용 — 답변 후 1년까지 보관하고 지웁니다.</>,
            <>접속 기록 — 통계 형태로만 남고 개별 기록은 보관하지 않습니다.</>,
          ]}
        />
      </Section>

      <Section heading="4. 쿠키와 광고">
        <p>
          오즈백은 사이트를 운영하고 광고를 보여주기 위해 쿠키(브라우저에 저장되는
          작은 기록)를 사용할 수 있습니다.
        </p>
        <List
          items={[
            <>
              <strong>구글 애드센스</strong> — 오즈백은 구글이 제공하는 광고를
              게재할 수 있습니다. 구글을 포함한 제3자 광고 사업자는 쿠키를 사용해
              이용자가 이전에 방문한 사이트를 바탕으로 광고를 게재합니다.
            </>,
            <>
              구글이 광고 쿠키를 사용하면, 이용자는{" "}
              <a
                href="https://www.google.com/settings/ads"
                rel="noopener noreferrer"
                target="_blank"
                className="font-bold text-oddsbag-purple underline"
              >
                광고 설정
              </a>
              에서 맞춤 광고를 끌 수 있습니다.
            </>,
            <>
              제3자 광고 사업자의 쿠키 사용은{" "}
              <a
                href="https://www.aboutads.info/choices/"
                rel="noopener noreferrer"
                target="_blank"
                className="font-bold text-oddsbag-purple underline"
              >
                aboutads.info
              </a>
              에서 함께 거부하실 수 있습니다.
            </>,
            <>
              브라우저 설정에서 쿠키를 차단하셔도 됩니다. 다만 일부 기능이 불편해질
              수 있습니다.
            </>,
          ]}
        />
      </Section>

      <Section heading="5. 정보를 맡기는 곳 (처리 위탁)">
        <p>
          서비스를 운영하기 위해 아래 업체의 시스템을 사용합니다. 각 업체는 자체
          개인정보 정책에 따라 정보를 다룹니다.
        </p>
        <List
          items={[
            <>
              <strong>Vercel</strong> — 홈페이지 운영(호스팅)
            </>,
            <>
              <strong>Resend</strong> — 뉴스레터 발송
            </>,
            <>
              <strong>Upstash</strong> — 글 데이터 보관
            </>,
            <>
              <strong>Google</strong> — 광고 게재 및 방문 통계
            </>,
          ]}
        />
      </Section>

      <Section heading="6. 이용자의 권리">
        <p>
          본인의 정보에 대해 <strong>열람 · 정정 · 삭제 · 처리 정지</strong>를
          요청하실 수 있습니다. 아래 메일로 알려주시면 지체 없이 처리하고
          결과를 알려드립니다.
        </p>
      </Section>

      <Section heading="7. 어린이 보호">
        <p>
          오즈백은 만 14세 미만 아동을 대상으로 하지 않으며, 아동의 개인정보를
          의도적으로 수집하지 않습니다.
        </p>
      </Section>

      <Section heading="8. 안전조치">
        <p>
          받은 정보는 접근 권한이 있는 담당자만 다루며, 전송 구간은 암호화(HTTPS)로
          보호합니다.
        </p>
      </Section>

      <Section heading="9. 문의 및 책임자">
        <p>
          개인정보와 관련한 문의, 불만, 피해 구제는 아래로 연락 주세요.
          <br />
          <strong>오즈백(ODDSBAG) 개인정보 담당</strong>
          <br />
          <a
            href="mailto:oddsbag.official@gmail.com"
            className="font-bold text-oddsbag-purple underline"
          >
            oddsbag.official@gmail.com
          </a>
        </p>
        <p className="text-sm text-oddsbag-gray">
          그 밖의 도움이 필요하시면 개인정보침해신고센터(privacy.kisa.or.kr,
          국번없이 118)에 문의하실 수 있습니다.
        </p>
      </Section>

      <Section heading="10. 방침 변경">
        <p>
          이 방침이 바뀌면 이 페이지에 변경 내용과 시행일을 올립니다. 중요한
          변경은 시행 7일 전에 안내합니다.
        </p>
      </Section>
    </LegalPage>
  );
}
