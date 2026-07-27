import LegalPage, { Section, List } from "@/components/LegalPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "오즈백 소개",
  description:
    "오즈백(ODDSBAG)은 매일 쓰진 않지만 갑자기 필요해지는 정보를 모아 전하는 온라인 매거진입니다. 편집 기준과 만드는 사람을 소개합니다.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <LegalPage
      title="오즈백 소개"
      lead="이상하게 필요한 것들, 오즈백에 다 있어."
    >
      <Section heading="어떤 곳인가요">
        <p>
          오즈백(ODDSBAG)은 <strong>매일 쓰진 않지만 어느 순간 갑자기 필요해지는
          것들</strong>을 모아 전하는 온라인 매거진입니다. 이름 그대로, 잡다하지만
          쓸모 있는 것들을 한 가방(bag)에 담는다는 뜻입니다.
        </p>
        <p>
          거창한 특종을 좇지 않습니다. 대신 &ldquo;이거 언젠가 찾게 되는데 막상
          찾으면 안 나오더라&rdquo; 싶은 것들을 챙깁니다. 맥북 저장공간 비우는 법,
          연말정산 전에 챙길 것, 알아두면 편한 단축키 같은 것들이요.
        </p>
      </Section>

      <Section heading="무엇을 다루나요">
        <List
          items={[
            <>
              <strong>꿀팁</strong> — 기기 사용법, 살림, 절약, 여행처럼 알아두면
              두고두고 쓰는 생활 정보
            </>,
            <>
              <strong>IT·테크</strong> — 새로 나온 기능, 바뀐 정책, 알아두면 좋은
              서비스 변화
            </>,
            <>
              <strong>사회·경제</strong> — 생활에 실제로 영향을 주는 제도와 숫자
            </>,
            <>
              <strong>문화·연예 · 스포츠 · 트렌드</strong> — 지금 사람들이
              이야기하고 있는 것들
            </>,
          ]}
        />
      </Section>

      <Section heading="어떻게 만드나요">
        <p>
          오즈백의 글은 <strong>AI 편집 도구의 도움을 받아 작성하고, 발행 전후에
          사람이 확인</strong>합니다. 다만 도구를 쓰든 안 쓰든 지키는 원칙이
          있습니다.
        </p>
        <List
          items={[
            <>
              <strong>원문을 읽지 못하면 쓰지 않습니다.</strong> 출처 기사나 공식
              문서의 본문을 실제로 확인하지 못한 사안은 아예 다루지 않습니다.
            </>,
            <>
              <strong>없는 사실을 지어내지 않습니다.</strong> 원문에 없는 수치나
              인용이 들어가면 발행하지 않고 보류합니다.
            </>,
            <>
              <strong>발행 전 검수를 거칩니다.</strong> 사실 확인, 읽기 쉬움,
              유용함을 기준으로 점검하고, 기준에 못 미치면 고쳐 쓰거나 내보내지
              않습니다.
            </>,
            <>
              <strong>발행 후에도 다시 봅니다.</strong> 이미 나간 글도 주기적으로
              다시 검토해, 문제가 발견되면 수정하거나 내립니다.
            </>,
          ]}
        />
        <p>
          그래도 사람이 하는 일이라 틀릴 수 있습니다. 잘못된 내용을 발견하시면{" "}
          <a href="/contact" className="font-bold text-oddsbag-purple underline">
            문의
          </a>
          로 알려주세요. 확인하고 바로잡겠습니다.
        </p>
      </Section>

      <Section heading="정정과 수정">
        <p>
          사실관계에 오류가 있었다면 해당 글을 수정하고, 무엇이 어떻게 바뀌었는지
          글 안에 남깁니다. 중대한 오류로 판단되면 글을 내리고 다시 검토합니다.
        </p>
      </Section>

      <Section heading="어디서 볼 수 있나요">
        <List
          items={[
            <>
              홈페이지 —{" "}
              <a
                href="https://oddsbag.co.kr"
                className="font-bold text-oddsbag-purple underline"
              >
                oddsbag.co.kr
              </a>
            </>,
            <>
              인스타그램 —{" "}
              <a
                href="https://instagram.com/oddsbag_official"
                rel="noopener noreferrer"
                target="_blank"
                className="font-bold text-oddsbag-purple underline"
              >
                @oddsbag_official
              </a>
            </>,
            <>
              페이스북 —{" "}
              <a
                href="https://www.facebook.com/profile.php?id=61586029697990"
                rel="noopener noreferrer"
                target="_blank"
                className="font-bold text-oddsbag-purple underline"
              >
                오즈백 페이지
              </a>
            </>,
            <>뉴스레터 — 홈페이지 하단에서 이메일로 구독하실 수 있습니다</>,
          ]}
        />
      </Section>

      <Section heading="연락처">
        <p>
          제휴, 제보, 정정 요청 모두 아래 메일로 받습니다.
          <br />
          <a
            href="mailto:oddsbag.official@gmail.com"
            className="font-bold text-oddsbag-purple underline"
          >
            oddsbag.official@gmail.com
          </a>
        </p>
      </Section>
    </LegalPage>
  );
}
