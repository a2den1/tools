// 유튜브 로그인 쿠키. 로그인한 요청은 유튜브가 서버 IP 라도 잘 막지 않는다.
//
// 넣는 곳 (둘 중 하나):
//   1) Vercel → Settings → Environment Variables 에 YT_COOKIE  ← 권장 (코드에 안 남음)
//   2) 아래 RAW 에 직접 붙여넣기  ← 저장소가 공개라면 누구나 이 계정에 로그인할 수 있게 되니 버리는 계정만
//
// cookies.txt(넷스케이프 형식) 파일 내용을 통째로 붙여도 되고, "이름=값; 이름=값" 한 줄이어도 된다.
const RAW = ``;

export function cookieHeader() {
  const raw = (RAW.trim() || process.env.YT_COOKIE || '').trim();
  if (!raw) return '';
  if (!raw.includes('\t')) return raw.replace(/\s*\n\s*/g, ' ');
  const pairs = [];
  for (let line of raw.split(/\r?\n/)) {
    if (line.startsWith('#HttpOnly_')) line = line.slice(10);
    else if (line.startsWith('#') || !line.trim()) continue;
    const f = line.split('\t');
    if (f.length < 7 || !/youtube\.com$/.test(f[0].replace(/^\./, ''))) continue;
    pairs.push(`${f[5]}=${f[6].trim()}`);
  }
  return pairs.join('; ');
}
