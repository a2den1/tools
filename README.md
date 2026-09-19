# Tools

여러 도구를 한 곳에 모은 사이트. Vite + 바닐라 JS, Vercel 에 그대로 배포한다.

## 개발

```bash
npm install
npm run dev
```

개발 서버가 `api/*.js` 를 Vercel 함수와 똑같이 실행해 준다.

## 배포

GitHub 저장소를 Vercel 에 연결하면 끝. 설정은 `vercel.json` 에 있다. 환경 변수는 필요 없다.

## 구조

- `src/` — 사이트. 도구는 `src/tools/*.js`, 목록은 `src/tools/index.js`.
- `api/` — Vercel 함수 (유튜브 도구용)
  - `meta` — 영상 제목·채널·썸네일 (유튜브 oEmbed)
  - `dl` — 외부 변환 서비스(loader.to, y2mate 같은 사이트)에 변환을 맡기고 진행 상황을 중계한다.
    유튜브는 Vercel 같은 데이터센터 IP 를 봇으로 보고 막아서 직접 받을 수 없고,
    loader.to 는 CORS 가 없어 브라우저가 직접 부를 수 없다. 완성된 파일은 브라우저가 변환 서버에서 바로 받는다.
  - `recognize` — 변환된 MP3 를 세 군데 잘라 [AudD](https://audd.io) 로 곡을 찾는다.
    토큰 없이 하루 몇 번 되고, 더 쓰려면 `api/recognize.js` 의 `AUDD_TOKEN` 에 넣는다.

외부 서비스라 그 사이트가 바뀌거나 막히면 유튜브 도구도 멈춘다. 그때는 `api/_lib/http.js` 의 `startJob`·`jobProgress` 만 다른 서비스에 맞게 고치면 된다.

## 라이선스 메모

- 배경 제거에 쓰는 `@imgly/background-removal` 은 AGPL-3.0 이라 저장소를 공개로 둔다.
- 폰트: 펴진고딕(눈누, OFL), Monocraft(OFL), Font Awesome Free.
- 효과음은 전부 브라우저에서 합성한 소리라 저작권 문제가 없다.
