// 스크랩 정리기가 «우리 서버로 대신 열어 주는» 주소를 어디까지 허용하나.
//
//   cd homepage
//   OB_ROOT="$PWD" node --experimental-strip-types --import ./scripts/시험/별칭.mjs ./scripts/시험/주소지킴이-시험.mjs
//
// 여기서 틀리면 남이 우리 서버를 발판 삼아 안쪽을 훑는다(SSRF).

import {
  blocked,
  privateIPv4,
  privateIPv6,
  privateAddress,
  needsDnsCheck,
} from "@/lib/ssrf-guard";

let 통과 = 0;
const 실패 = [];

function 같나(무엇, 실제, 기대) {
  if (실제 === 기대) 통과 += 1;
  else 실패.push(`${무엇} — 기대 ${JSON.stringify(기대)} · 실제 ${JSON.stringify(실제)}`);
}

const 막힘 = (u) => blocked(new URL(u)) !== null;

// ── ① 밖으로 나가는 멀쩡한 주소는 통과해야 한다 ────────────────
for (const u of [
  "https://oddsbag.co.kr/",
  "https://www.naver.com/news?q=1",
  "http://example.com",
  "https://youtu.be/abc123",
  "https://8.8.8.8/",
  "https://223.130.195.200/", // 네이버 대역 — 공인 IP 리터럴은 막지 않는다
]) {
  같나(`통과해야: ${u}`, 막힘(u), false);
}

// ── ② 안쪽·특수 주소는 막아야 한다 ─────────────────────────────
for (const u of [
  "http://localhost/",
  "http://127.0.0.1/",
  "http://0.0.0.0/",
  "http://10.0.0.5/",
  "http://172.16.0.1/",
  "http://172.31.255.254/",
  "http://192.168.0.1/",
  "http://169.254.169.254/latest/meta-data/", // 클라우드 열쇠가 여기 있다
  "http://100.64.0.1/",
  "http://239.0.0.1/",
  "http://[::1]/",
  "http://api.internal/",
  "http://db.local/",
  "http://foo.localhost/",
  "file:///etc/passwd",
  "ftp://example.com/",
]) {
  같나(`막아야: ${u}`, 막힘(u), true);
}

// 172.15 / 172.32 는 사설이 «아니다» — 경계를 한 칸씩 틀리는 실수를 잡는다
같나("172.15.0.1 은 공인", 막힘("http://172.15.0.1/"), false);
같나("172.32.0.1 은 공인", 막힘("http://172.32.0.1/"), false);
같나("100.63.0.1 은 공인", 막힘("http://100.63.0.1/"), false);
같나("100.128.0.1 은 공인", 막힘("http://100.128.0.1/"), false);

// 자릿수가 넘는 것(256.1.1.1)은 여기까지 오지도 않는다 — new URL 이 먼저 던진다.
//   route 의 peekOne 이 그걸 잡아 「주소 모양이 아닙니다」로 답한다. 그래서 시험하지 않는다.

// ── ③ 이름을 물어본 «답» 판정 ──────────────────────────────────
같나("10.0.0.5 는 안쪽", privateIPv4("10.0.0.5"), true);
같나("169.254.169.254 는 안쪽", privateIPv4("169.254.169.254"), true);
같나("142.250.196.100 은 바깥", privateIPv4("142.250.196.100"), false);

같나("::1 은 안쪽", privateIPv6("::1"), true);
같나("fe80::1 은 안쪽", privateIPv6("fe80::1"), true);
같나("fe80::1%eth0 도 안쪽", privateIPv6("fe80::1%eth0"), true);
같나("fd00::1 은 안쪽", privateIPv6("fd00::1"), true);
같나("::ffff:10.0.0.1 은 안쪽", privateIPv6("::ffff:10.0.0.1"), true);
같나("::ffff:8.8.8.8 은 바깥", privateIPv6("::ffff:8.8.8.8"), false);
// ★큰 사이트는 대부분 AAAA 를 갖고 있다. 이걸 막으면 도구가 통째로 못 쓴다.
같나("2404:6800:… (구글) 은 바깥", privateIPv6("2404:6800:4004:80c::2004"), false);
같나("2001:4860:4860::8888 은 바깥", privateIPv6("2001:4860:4860::8888"), false);

같나("privateAddress 가 갈래를 가른다(4)", privateAddress("192.168.1.1", 4), true);
같나("privateAddress 가 갈래를 가른다(6)", privateAddress("2404:6800::1", 6), false);

// ── ④ 리터럴은 두 번 묻지 않는다 ───────────────────────────────
같나("리터럴은 DNS 안 묻는다", needsDnsCheck(new URL("http://8.8.8.8/")), false);
같나("이름은 DNS 묻는다", needsDnsCheck(new URL("https://oddsbag.co.kr/")), true);

// ── 결과 ───────────────────────────────────────────────────────
console.log(`\n[주소 지킴이 시험] 통과 ${통과} · 실패 ${실패.length}`);
if (실패.length) {
  for (const f of 실패) console.log("  ✗ " + f);
  process.exit(1);
}
console.log("✓ 전부 통과.\n");
