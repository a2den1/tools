# Tools

여러 도구를 한 곳에 모은 사이트.

- 사이트(`/`) — Vite + 바닐라 JS. Vercel 에 그대로 배포.
- 다운로드 서버(`server/`) — 유튜브 영상·MP3·음악 찾기용. yt-dlp + ffmpeg 가 필요해서 Vercel 이 아니라 PC 나 VPS 에서 따로 돌린다.

## 개발

```bash
npm install
npm run dev          # http://localhost:5173
npm run server       # http://localhost:8787 (따로 터미널에서)
```

개발 서버는 `/api` 를 `localhost:8787` 로 넘겨준다.

## 배포

### 사이트 → Vercel

GitHub 저장소를 Vercel 에 연결하면 끝. 설정은 `vercel.json` 에 있다.
다운로드 서버 주소를 기본값으로 넣으려면 Vercel 환경 변수에 `VITE_API_URL` 을 추가한다.

```
VITE_API_URL=https://내-서버-주소
```

비워 두면 유튜브 도구 화면에서 서버 주소를 직접 입력할 수 있다(브라우저에 저장됨).

### 다운로드 서버

```bash
cd server
npm install
npm start
```

필요한 것:

- Node 20 이상
- yt-dlp — `pip install -U "yt-dlp[default]"` (자주 업데이트할 것)
- ffmpeg 는 `ffmpeg-static` 으로 자동 설치

Docker:

```bash
docker build -t tools-api server
docker run -p 8787:8787 -e ALLOWED_ORIGINS=https://내-사이트.vercel.app tools-api
```

환경 변수:

| 이름 | 설명 |
| --- | --- |
| `PORT` | 기본 8787 |
| `ALLOWED_ORIGINS` | 허용할 사이트 주소(쉼표 구분). 기본 `*` |
| `AUDD_API_TOKEN` | [AudD](https://audd.io) 토큰. 넣으면 "영상 속 음악 찾기"가 소리로도 곡을 찾는다 |
| `MAX_JOBS` | 동시에 받을 작업 수. 기본 2 |
| `YTDLP_PATH` | yt-dlp 실행 파일 경로(자동으로 못 찾을 때) |
| `YTDLP_COOKIES` | 유튜브가 봇 확인을 요구할 때 쓸 cookies.txt 경로 |

유튜브는 데이터센터 IP 를 자주 막으므로 집 PC 에서 돌리고
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) 등으로 여는 편이 가장 잘 된다.
자기 PC 에서만 쓸 거라면 사이트에서 서버 주소를 `http://localhost:8787` 로 넣어도 된다.

## 라이선스 메모

- 배경 제거에 쓰는 `@imgly/background-removal` 은 AGPL-3.0 이다. 저장소를 공개해 두면 문제없다.
- 폰트: 펴진고딕(눈누, OFL), Monocraft(OFL), Font Awesome Free.
- 효과음은 전부 브라우저에서 합성한 소리라 저작권 문제가 없다.
