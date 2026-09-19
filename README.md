# Tools

여러 도구를 한 곳에 모은 사이트. Vite + 바닐라 JS, Vercel 에 그대로 배포한다.

## 개발

```bash
npm install
npm run dev
```

개발 서버가 `api/*.js` 를 Vercel 함수와 똑같이 실행해 준다.

## 배포

GitHub 저장소를 Vercel 에 연결하면 끝. 설정은 `vercel.json` 에 있다.

## 구조

- `src/` — 사이트. 도구는 `src/tools/*.js`, 목록은 `src/tools/index.js`.
- `api/` — Vercel 함수 (유튜브 도구용)
  - `info` — 영상 정보·화질 목록 ([youtubei.js](https://github.com/LuanRT/YouTube.js))
  - `chunk` — 스트림을 4MB 씩 대신 받아 준다. 유튜브 주소는 받은 서버 IP 에 묶여 있고 CORS 가 없어서 브라우저가 직접 못 받는다.
  - `thumb` — MP3 앨범아트용 썸네일
  - `recognize` — 음악 인식(AudD) 중계
  - `_lib/po.js` — BotGuard 로 PO 토큰을 만든다. 없으면 유튜브가 서버 요청을 봇으로 보고 막는다.

유튜브 영상은 조각으로 받아 브라우저 안의 ffmpeg.wasm 으로 영상·소리를 합치거나 MP3 로 바꾼다.
1.5GB 가 넘으면 브라우저 메모리로 합칠 수 없어 영상과 소리를 따로 저장한다.

## 환경 변수 (선택)

| 이름 | 설명 |
| --- | --- |
| `AUDD_API_TOKEN` | [AudD](https://audd.io) 토큰. 넣으면 "영상 속 음악 찾기"가 소리로도 곡을 찾는다 |

## 라이선스 메모

- 배경 제거에 쓰는 `@imgly/background-removal` 은 AGPL-3.0 이라 저장소를 공개로 둔다.
- 폰트: 펴진고딕(눈누, OFL), Monocraft(OFL), Font Awesome Free.
- 효과음은 전부 브라우저에서 합성한 소리라 저작권 문제가 없다.
