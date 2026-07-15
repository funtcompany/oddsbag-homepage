# 오즈백 릴스/쇼츠 영상 공장

Vercel(홈페이지)에서는 영상 인코딩이 안 되므로, **GitHub Actions**(무료)에서 영상을 만든다.

## 흐름 (자립형 — Vercel/홈페이지에 의존하지 않음)
1. DB(Upstash Redis)에서 발행글을 직접 읽어 오늘 만들 글 선정 (`posts:published`, `reels:done`)
2. 카드 구성 + 구글 Chirp3-HD 나레이션
3. 세로 프레임(1080×1920)을 공장 안에서 직접 렌더 (satori+resvg)
4. ffmpeg로 이어붙이고 트렌디 BGM(은은한 고정 볼륨) 믹스 → mp4
5. (자격증명 있으면) 유튜브 쇼츠 + 인스타 릴스 게시
6. 완료를 DB에 기록(`reels:done`) → 중복 제작 방지

## GitHub Secrets (설정 → Secrets and variables → Actions)

### 필수 (영상 제작)
| 이름 | 값 |
|---|---|
| `UPSTASH_REDIS_REST_URL` | 홈페이지 .env.local 과 동일 |
| `UPSTASH_REDIS_REST_TOKEN` | 홈페이지 .env.local 과 동일 |
| `GOOGLE_TTS_API_KEY` | 구글 클라우드 TTS 키 |
| `ODDS_VOICE` | (선택) 목소리. 기본 `ko-KR-Chirp3-HD-Aoede` |

### 유튜브 쇼츠 게시
| 이름 | 값 |
|---|---|
| `YOUTUBE_CLIENT_ID` | OAuth 클라이언트 ID |
| `YOUTUBE_CLIENT_SECRET` | OAuth 클라이언트 시크릿 |
| `YOUTUBE_REFRESH_TOKEN` | 채널 업로드 권한 리프레시 토큰 |

### 인스타 릴스 게시
| 이름 | 값 |
|---|---|
| `INSTAGRAM_ACCOUNT_ID` | 인스타 비즈니스 계정 ID |
| `INSTAGRAM_ACCESS_TOKEN` | 페이지/인스타 액세스 토큰 |
| `MEDIA_PUBLIC_BASE` | 완성 mp4가 공개로 열리는 주소의 베이스 (인스타는 공개 영상 URL 필요) |

> 게시용 Secret이 없으면 **영상만 만들고 게시는 조용히 건너뛴다.** 영상은 Actions 아티팩트로 내려받을 수 있다.

## 유튜브 리프레시 토큰 얻는 법 (1회)
1. Google Cloud Console → **YouTube Data API v3** 사용 설정
2. OAuth 동의 화면 구성(외부/테스트 사용자에 채널 계정 추가)
3. 사용자 인증 정보 → **OAuth 클라이언트 ID**(데스크톱 앱) 생성 → client_id / client_secret 확보
4. scope `https://www.googleapis.com/auth/youtube.upload` 로 인증 → refresh_token 발급
   (OAuth Playground 또는 간단한 스크립트 사용)

## 로컬 테스트
```bash
cd factory
SITE_URL=https://oddsbag.co.kr CRON_SECRET=... GOOGLE_TTS_API_KEY=... REEL_LIMIT=1 node make-reels.mjs
# → out/[slug].mp4 생성 (게시 Secret 없으면 게시는 건너뜀)
```
