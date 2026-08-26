// 「남이 시키는 주소로 우리 서버가 접속하는」 통로를 지키는 규칙. 순수 함수만.
//
// ★next 를 하나도 안 부른다. 그래서 서버 없이 그대로 시험할 수 있다
//   (외장하드에서는 next dev 가 캐시가 깨져 못 뜬다 — 그 사정 때문에 여기를 갈라 뒀다).
//   실제로 쓰는 곳은 app/api/scrap/peek/route.ts 다.
//
// 두 겹이다.
//   ① blocked()      — 주소 «글자»만 보고 거른다 (물어보지 않아 빠르다)
//   ② privateIPv4/6  — 이름을 물어본 «답» 이 안쪽인지 본다 (route 쪽에서 dns 로 묻는다)

/** 이 IPv4 가 «우리 안쪽»인가 */
export function privateIPv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) || // 클라우드 메타데이터(169.254.169.254)가 여기 있다
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/** 이 IPv6 이 «우리 안쪽»인가 — 되돌이(::1)·링크로컬(fe80::/10)·사설(fc00::/7)·IPv4 감싼 것 */
export function privateIPv6(ip: string): boolean {
  const s = ip.toLowerCase().replace(/%.*$/, ""); // fe80::1%eth0 의 꼬리표를 뗀다
  if (s === "::1" || s === "::") return true;
  if (/^fe[89ab]/.test(s)) return true; // fe80::/10
  if (/^f[cd]/.test(s)) return true; // fc00::/7
  const v4 = s.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/); // ::ffff:10.0.0.1
  return v4 ? privateIPv4(v4[1]) : false;
}

/** 물어본 답 한 줄이 안쪽인가 */
export function privateAddress(address: string, family: number): boolean {
  return family === 6 ? privateIPv6(address) : privateIPv4(address);
}

/** 우리 서버가 «가면 안 되는» 곳인가 — 글자만 보고 하는 1차 검사. 막을 이유가 없으면 null */
export function blocked(u: URL): string | null {
  if (u.protocol !== "http:" && u.protocol !== "https:") return "http(s) 주소만 됩니다.";
  const h = u.hostname.toLowerCase();

  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  ) {
    return "내부 주소는 읽을 수 없습니다.";
  }
  // URL 에 IPv6 을 «직접 적은» 것은 통째로 막는다 — 스크랩 대상에 쓸 일이 없다.
  //   (이름이 AAAA 를 갖고 있는 것과는 다른 얘기다. 그건 위 privateIPv6 으로 가린다)
  if (h.includes(":") || h.startsWith("[")) return "내부 주소는 읽을 수 없습니다.";

  // IPv4 리터럴이면 사설·특수 대역을 막는다
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    if (m.slice(1).some((x) => Number(x) > 255)) return "주소가 올바르지 않습니다.";
    if (privateIPv4(h)) return "내부 주소는 읽을 수 없습니다.";
  }
  return null;
}

/** 이름을 물어볼 필요가 있는 주소인가 (리터럴이면 1차에서 이미 봤다) */
export function needsDnsCheck(u: URL): boolean {
  return !/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname);
}
