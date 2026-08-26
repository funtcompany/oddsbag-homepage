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
      updated="2026년 8월 26일"
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
            <>
              <strong>오즈백 툴즈에 올리신 자료</strong> — HTML 링크 생성기의
              「올리고 링크 만들기」, 이북 제작기의 「링크로 만들기」를{" "}
              <strong>직접 누르셨을 때만</strong> 그 결과물이 오즈백 저장소에
              보관됩니다. 누르지 않으시면 파일은 브라우저 밖으로 나가지 않습니다.
              자세한 내용은 아래 <strong>4번</strong>에 따로 적었습니다.
            </>,
            <>
              <strong>도구용 방문자 표시(쿠키)</strong> — 올리신 자료를 «올린
              분에게만» 보여 드리려고, 도구를 처음 여실 때 뜻 없는 임의의 번호를
              하나 만들어 브라우저에 저장합니다. 이름·연락처와 연결되지 않고,
              누구인지 알아내는 데 쓰지 않습니다.
            </>,
          ]}
        />
        <p>
          <strong>회원가입은 받지 않습니다.</strong> 이름, 전화번호, 주소,
          주민등록번호 같은 정보는 수집하지 않습니다. 도구를 쓰실 때도 로그인이나
          본인인증을 요구하지 않습니다.
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
            <>
              올리신 자료 — <strong>링크를 만들어 드리는 데만</strong> 씁니다.
              오즈백 콘텐츠로 쓰거나, 광고에 넣거나, AI 학습에 쓰지 않습니다.
            </>,
            <>
              도구용 방문자 표시 — 올리신 자료를{" "}
              <strong>올린 분에게만 보여 드리는 데만</strong> 씁니다. 광고를
              맞추거나 다른 사이트에서 따라다니는 데 쓰지 않습니다.
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
            <>
              올리신 자료 — <strong>지우실 때까지 보관합니다.</strong> 오즈백이
              기간을 정해 임의로 지우지는 않습니다. 도구 화면의 「내 자료함」에서
              언제든 직접 지우실 수 있습니다.
            </>,
            <>
              도구용 방문자 표시(쿠키) — 브라우저에 1년간 저장됩니다. 브라우저
              쿠키를 지우시면 함께 사라집니다.{" "}
              <strong>
                다만 쿠키가 사라지면 그전에 올리신 자료의 목록도 못 보시게 됩니다
              </strong>
              (자료 자체는 남아 있습니다). 그럴 때는 아래 메일로 알려 주시면
              찾아서 지워 드립니다.
            </>,
          ]}
        />
      </Section>

      {/* ★2026-08-26 신설 — 도구가 셋 생겼는데 방침에 한 줄도 없었다.
          «무엇이 서버로 가고 무엇이 안 가는지» 를 도구별로 못 박아 둔다.
          이게 없으면 「전부 서버로 보내는 것 아니냐」는 의심을 반박할 근거가 없다. */}
      <Section heading="4. 오즈백 툴즈를 쓰실 때">
        <p>
          도구마다 <strong>서버로 가는 것과 안 가는 것이 다릅니다.</strong> 하나씩
          적었습니다.
        </p>
        <List
          items={[
            <>
              <strong>HTML 링크 생성기</strong> — 올리신 HTML 파일은 링크를 만들기
              위해 오즈백 저장소에 보관됩니다. 만들어진 링크는{" "}
              <strong>주소를 아는 사람이면 누구나 열 수 있으니</strong> 남에게
              보이면 안 되는 내용은 올리지 마십시오. 검색엔진에는 잡히지 않도록
              막아 두었습니다.
            </>,
            <>
              <strong>이북 제작기</strong> — PDF·사진을 고르시면{" "}
              <strong>브라우저 안에서</strong> 이북으로 만듭니다. 이때는 파일이
              서버로 가지 않습니다. 「링크로 만들기」를 누르셨을 때만 완성된
              이북 한 장이 위와 같은 방식으로 보관됩니다.
            </>,
            <>
              <strong>스크랩 정리기</strong> — 사진과 파일은{" "}
              <strong>브라우저 안에서만</strong> 처리하고 서버로 보내지 않습니다.
              다만 <strong>붙여 넣으신 «주소»는 서버로 갑니다</strong> — 브라우저가
              남의 사이트를 직접 열 수 없어서, 제목을 읽어 오는 일만 서버가 대신
              합니다. 그 주소는 제목을 읽는 데만 쓰고 저장하지 않습니다.
            </>,
            <>
              <strong>챙길 것</strong> — 고르신 「가진 것」과 태어나신 해는{" "}
              <strong>브라우저 밖으로 나가지 않습니다.</strong> 서버로 보내지 않고,
              저장하지도 않습니다. 무엇을 보여 드릴지는 브라우저 안에서 계산합니다.
            </>,
          ]}
        />
        <p>
          어느 도구에서도 <strong>올리신 내용을 사람이 들여다보지 않습니다.</strong>{" "}
          다만 신고가 들어오거나 법이 요구하는 경우에는 해당 자료를 확인하고 삭제할
          수 있습니다(이용약관 4번).
        </p>
      </Section>

      <Section heading="5. 쿠키와 광고">
        <p>
          오즈백은 사이트를 운영하고 광고를 보여주기 위해 쿠키(브라우저에 저장되는
          작은 기록)를 사용할 수 있습니다.
        </p>
        <p>
          <strong>오즈백이 직접 심는 쿠키는 하나뿐입니다</strong> — 위 1번의 도구용
          방문자 표시입니다. 광고와 아무 상관이 없고, 이 쿠키를 지우셔도 매거진을
          읽으시는 데는 지장이 없습니다(올리신 자료 목록만 안 보이게 됩니다).
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

      <Section heading="6. 정보를 맡기는 곳 (처리 위탁)">
        <p>
          서비스를 운영하기 위해 아래 업체의 시스템을 사용합니다. 각 업체는 자체
          개인정보 정책에 따라 정보를 다룹니다.
        </p>
        <List
          items={[
            <>
              <strong>Vercel</strong> — 홈페이지 운영(호스팅), 그리고{" "}
              <strong>오즈백 툴즈에 올리신 자료의 보관</strong>(Vercel Blob)
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

      <Section heading="7. 이용자의 권리">
        <p>
          본인의 정보에 대해 <strong>열람 · 정정 · 삭제 · 처리 정지</strong>를
          요청하실 수 있습니다. 아래 메일로 알려주시면 지체 없이 처리하고
          결과를 알려드립니다.
        </p>
      </Section>

      <Section heading="8. 어린이 보호">
        <p>
          오즈백은 만 14세 미만 아동을 대상으로 하지 않으며, 아동의 개인정보를
          의도적으로 수집하지 않습니다.
        </p>
      </Section>

      <Section heading="9. 안전조치">
        <p>
          받은 정보는 접근 권한이 있는 담당자만 다루며, 전송 구간은 암호화(HTTPS)로
          보호합니다.
        </p>
      </Section>

      <Section heading="10. 문의 및 책임자">
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

      <Section heading="11. 방침 변경">
        <p>
          이 방침이 바뀌면 이 페이지에 변경 내용과 시행일을 올립니다. 중요한
          변경은 시행 7일 전에 안내합니다.
        </p>
      </Section>
    </LegalPage>
  );
}
