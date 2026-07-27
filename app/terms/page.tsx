import LegalPage, { Section, List } from "@/components/LegalPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관",
  description:
    "오즈백(ODDSBAG) 홈페이지 이용에 관한 약관입니다. 저작권, 면책, 뉴스레터 이용 조건을 안내합니다.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="이용약관"
      lead="오즈백을 이용하실 때 알아두셔야 할 내용입니다."
      updated="2026년 7월 27일"
    >
      <Section heading="1. 이 약관에 대하여">
        <p>
          이 약관은 오즈백(ODDSBAG, 이하 &lsquo;오즈백&rsquo;)이 운영하는 웹사이트
          oddsbag.co.kr과 뉴스레터를 이용하실 때 적용됩니다. 사이트를 이용하시면 이
          약관에 동의하신 것으로 봅니다.
        </p>
      </Section>

      <Section heading="2. 서비스 내용">
        <p>
          오즈백은 생활 정보와 시사 콘텐츠를 무료로 제공합니다. 별도의 회원가입은
          없으며, 뉴스레터만 원하시면 이메일로 신청하실 수 있습니다.
        </p>
        <p>
          서비스 내용은 사정에 따라 바뀌거나 중단될 수 있습니다. 중요한 변경은
          미리 알려드립니다.
        </p>
      </Section>

      <Section heading="3. 저작권">
        <p>
          오즈백이 직접 작성한 글, 사진, 그래픽, 로고의 저작권은 오즈백에
          있습니다. 아래는 <strong>사전 동의 없이 하실 수 없습니다.</strong>
        </p>
        <List
          items={[
            <>글 전문 또는 상당 부분을 그대로 옮겨 싣는 행위</>,
            <>내용을 상업적으로 이용하는 행위</>,
            <>출처를 밝히지 않고 자기 것처럼 쓰는 행위</>,
          ]}
        />
        <p>
          다만 <strong>출처(오즈백)와 원문 링크를 밝힌 짧은 인용</strong>은
          자유롭게 하셔도 됩니다. SNS 공유도 환영합니다.
        </p>
        <p>
          기사에 인용된 외부 자료의 저작권은 각 저작권자에게 있습니다. 권리 침해가
          있다고 판단되시면 알려주시기 바랍니다. 확인 후 즉시 조치하겠습니다.
        </p>
      </Section>

      <Section heading="4. 이용자가 하지 말아야 할 것">
        <List
          items={[
            <>자동화 프로그램으로 사이트에 과도한 부하를 주는 행위</>,
            <>다른 사람의 이메일 주소로 뉴스레터를 신청하는 행위</>,
            <>사이트를 정상적으로 운영하지 못하게 방해하는 행위</>,
          ]}
        />
      </Section>

      <Section heading="5. 정보의 정확성과 면책">
        <p>
          오즈백은 사실 확인을 거쳐 글을 내보내지만,{" "}
          <strong>모든 내용이 항상 정확하다고 보증하지는 않습니다.</strong> 제도와
          정책, 가격, 기능은 수시로 바뀝니다.
        </p>
        <List
          items={[
            <>
              세금, 법률, 의료, 투자와 관련된 내용은 <strong>참고용</strong>입니다.
              실제 결정은 반드시 해당 기관이나 전문가에게 확인하신 뒤 하시기
              바랍니다.
            </>,
            <>
              오즈백의 정보를 근거로 한 판단과 그 결과에 대해서는 책임지지
              않습니다.
            </>,
            <>
              사이트에 걸린 외부 링크와 광고의 내용은 각 운영자의 책임이며,
              오즈백이 보증하지 않습니다.
            </>,
          ]}
        />
        <p>
          잘못된 내용을 발견하시면{" "}
          <a href="/contact" className="font-bold text-oddsbag-purple underline">
            문의
          </a>
          로 알려주세요. 확인 후 바로잡겠습니다.
        </p>
      </Section>

      <Section heading="6. 광고">
        <p>
          오즈백은 운영을 위해 광고를 게재할 수 있습니다. 광고와 기사는 구분되게
          표시하며, 대가를 받고 작성한 글이 있다면 그 사실을 글 안에 밝힙니다.
        </p>
      </Section>

      <Section heading="7. 뉴스레터">
        <p>
          뉴스레터는 신청하신 분께만 보냅니다. 메일 맨 아래 해지 링크로 언제든
          해지하실 수 있고, 해지하시면 등록된 주소는 바로 삭제됩니다.
        </p>
      </Section>

      <Section heading="8. 약관 변경">
        <p>
          약관이 바뀌면 이 페이지에 변경 내용과 시행일을 올립니다. 변경 후에도
          사이트를 계속 이용하시면 바뀐 약관에 동의하신 것으로 봅니다.
        </p>
      </Section>

      <Section heading="9. 문의">
        <p>
          약관과 관련한 문의는{" "}
          <a
            href="mailto:oddsbag.official@gmail.com"
            className="font-bold text-oddsbag-purple underline"
          >
            oddsbag.official@gmail.com
          </a>{" "}
          으로 보내주세요.
        </p>
      </Section>
    </LegalPage>
  );
}
