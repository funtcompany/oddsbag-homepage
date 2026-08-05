import { permanentRedirect } from "next/navigation";

// 앱 소개는 '서비스' 탭으로 합쳤다.
// 예전 주소(/apps)로 들어오는 링크·검색 결과는 새 주소로 그대로 넘겨준다.
export default function AppsPage() {
  permanentRedirect("/services");
}
