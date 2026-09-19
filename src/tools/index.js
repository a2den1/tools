export const CATS = [
  { id: 'all', name: '전체' },
  { id: 'yt', name: '유튜브', color: '#ff3b30' },
  { id: 'img', name: '이미지', color: '#8b5cf6' },
  { id: 'file', name: '파일', color: '#0a84ff' },
  { id: 'mc', name: '마인크래프트', color: '#2fb457' },
  { id: 'sound', name: '사운드', color: '#ff9500' },
  { id: 'etc', name: '기타', color: '#5e6ad2' },
];

export const TOOLS = [
  { id: 'youtube', name: '유튜브 영상 다운로드', icon: 'fa-brands fa-youtube', cat: 'yt', kw: 'youtube video download 4k 동영상 저장', load: () => import('./youtube.js') },
  { id: 'youtube-mp3', name: '유튜브 MP3 추출', icon: 'fa-solid fa-music', cat: 'yt', kw: 'youtube mp3 audio 음원 소리', load: () => import('./youtube-mp3.js') },
  { id: 'find-music', name: '영상 속 음악 찾기', icon: 'fa-solid fa-compact-disc', cat: 'yt', kw: 'music recognition shazam 노래 찾기 bgm', load: () => import('./find-music.js') },
  { id: 'upscale', name: '이미지 업스케일', icon: 'fa-solid fa-up-right-and-down-left-from-center', cat: 'img', kw: 'upscale ai esrgan 화질 해상도 확대', load: () => import('./upscale.js') },
  { id: 'remove-bg', name: '배경 제거', icon: 'fa-solid fa-wand-magic-sparkles', cat: 'img', kw: 'remove background 누끼 투명', load: () => import('./remove-bg.js') },
  { id: 'image-convert', name: '이미지 형식 변환', icon: 'fa-solid fa-image', cat: 'img', kw: 'convert png jpg webp avif 압축 리사이즈', load: () => import('./image-convert.js') },
  { id: 'image-adjust', name: '이미지 보정', icon: 'fa-solid fa-sliders', cat: 'img', kw: 'brightness contrast saturation hue 밝기 대비 채도 색조 필터', load: () => import('./image-adjust.js') },
  { id: 'pixelate', name: '픽셀화', icon: 'fa-solid fa-chess-board', cat: 'img', kw: 'pixel art mosaic 모자이크 도트', load: () => import('./pixelate.js') },
  { id: 'eyedropper', name: '스포이드', icon: 'fa-solid fa-eye-dropper', cat: 'img', kw: 'eyedropper color picker 색 추출 스포이트 화면', load: () => import('./eyedropper.js') },
  { id: 'file-convert', name: '파일 형식 변환', icon: 'fa-solid fa-arrows-rotate', cat: 'file', kw: 'convert video audio mp4 mp3 wav gif webm ffmpeg 동영상 오디오', load: () => import('./file-convert.js') },
  { id: 'motd', name: '서버 MOTD 생성', icon: 'fa-solid fa-server', cat: 'mc', kw: 'minecraft motd server.properties 색 코드 §', load: () => import('./motd.js') },
  { id: 'display', name: '디스플레이 명령어', icon: 'fa-solid fa-cube', cat: 'mc', kw: 'minecraft text_display block_display item_display summon 명령어', load: () => import('./display.js') },
  { id: 'sounds', name: '효과음', icon: 'fa-solid fa-volume-high', cat: 'sound', kw: 'soundboard sfx myinstants 효과음 밈', load: () => import('./sounds.js') },
  { id: 'qr', name: 'QR 코드', icon: 'fa-solid fa-qrcode', cat: 'etc', kw: 'qr code 큐알', load: () => import('./qr.js') },
  { id: 'password', name: '비밀번호 생성', icon: 'fa-solid fa-key', cat: 'etc', kw: 'password generator 암호', load: () => import('./password.js') },
  { id: 'counter', name: '글자 수 세기', icon: 'fa-solid fa-font', cat: 'etc', kw: 'character count 글자수 단어 바이트', load: () => import('./counter.js') },
  { id: 'json', name: 'JSON 정리', icon: 'fa-solid fa-code', cat: 'etc', kw: 'json format beautify minify', load: () => import('./json.js') },
  { id: 'color', name: '색상 변환', icon: 'fa-solid fa-palette', cat: 'etc', kw: 'color hex rgb hsl 컬러', load: () => import('./color.js') },
  { id: 'unit', name: '단위 변환', icon: 'fa-solid fa-ruler-combined', cat: 'etc', kw: 'unit converter 길이 무게 온도 평', load: () => import('./unit.js') },
  { id: 'date', name: '날짜 계산', icon: 'fa-solid fa-calendar-days', cat: 'etc', kw: 'date d-day 디데이 만나이', load: () => import('./date.js') },
  { id: 'timer', name: '타이머', icon: 'fa-solid fa-stopwatch', cat: 'etc', kw: 'timer stopwatch 스톱워치', load: () => import('./timer.js') },
  { id: 'random', name: '랜덤 뽑기', icon: 'fa-solid fa-dice', cat: 'etc', kw: 'random pick 추첨 제비뽑기 룰렛', load: () => import('./random.js') },
];

export const catOf = (t) => CATS.find((c) => c.id === t.cat) || CATS[1];
