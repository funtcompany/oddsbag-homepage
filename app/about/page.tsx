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

      <Section heading="누가 쓰나요">
        <p>
          <strong>오즈백의 글은 AI가 씁니다.</strong> 사람이 쓴 것처럼 꾸미지 않고
          먼저 적어둡니다. 대신 어디까지 기계에 맡기고 어디서 사람이 보는지를
          아래에 그대로 공개합니다.
        </p>
        <p>
          <strong>왜 AI를 쓰나요.</strong> 인감증명서를 인터넷으로 뗄 수 있는지,
          재산세를 언제까지 내야 하는지 같은 것은 찾으면 어딘가엔 있습니다. 그런데
          정작 급한 날 한 화면에 정리된 곳이 없습니다. 사람 손으로는 이걸 매일
          챙길 수 없어서 기계에 맡겼습니다. 유행이라서가 아니라, 이것 말고는 매일
          챙길 방법이 없어서입니다.
        </p>
        <List
          items={[
            <>
              <strong>원문을 못 읽으면 아예 안 씁니다.</strong> 출처 기사나 공식
              문서의 <em>본문</em>을 실제로 받아오지 못한 사안은 다루지 않습니다.
              검색 결과의 제목만 보고 쓰는 일은 없습니다.
            </>,
            <>
              <strong>발행 전에 원문과 한 번 대조합니다.</strong> 사실 정확성·읽기
              쉬움·유용함을 100점 기준으로 채점하고, 점수와 &ldquo;지어낸 정황
              없음&rdquo;을 둘 다 넘겨야 나갑니다. 못 넘기면 고쳐 쓰거나 보류합니다.
            </>,
            <>
              <strong>나간 글도 하루 세 번 다시 검사합니다.</strong> 이미 공개된
              글을 원문과 다시 맞춰보고, 틀린 것이 나오면 고치거나 내립니다. 찾으시던
              글이 안 보인다면 대개 이 과정에서 내려간 것입니다.
            </>,
            <>
              <strong>안전이 걸린 글은 사람이 직접 봅니다.</strong> 사고·분실·재난
              대처처럼 잘못 알아들으면 사람이 다치는 내용은 내보내기 전에 사람이
              눈으로 확인합니다.
            </>,
          ]}
        />
        <p>
          <strong>반대로, 사실이 아닌 것은 적지 않겠습니다.</strong> 지금 오즈백은
          모든 글을 발행 전에 사람이 한 편씩 미리 읽지는 않습니다. 사람이 하는 일은
          기준을 정하는 것, 내려간 글과 지적사항을 모아 다음 글에 반영하는 것,
          그리고 위의 안전 항목을 확인하는 것입니다.
        </p>
        <p>
          그래도 틀릴 수 있습니다. 잘못된 내용을 발견하시면{" "}
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
