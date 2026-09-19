// 음악 인식: 브라우저가 잘라 보낸 짧은 MP3 를 AudD 로 넘긴다.
// 토큰 없이도 하루 몇 번은 되고, 더 쓰려면 https://audd.io 에서 받은 토큰을 아래에 넣는다.
import { rawBody, send } from './_lib/yt.js';

const AUDD_TOKEN = '';

export default async function handler(req, res) {
  if (req.method === 'GET') return send(res, 200, { enabled: true });
  if (req.method !== 'POST') return send(res, 405, { error: 'POST 만 돼요' });
  try {
    const clip = await rawBody(req, 1.5e6);
    const fd = new FormData();
    if (AUDD_TOKEN) fd.append('api_token', AUDD_TOKEN);
    fd.append('return', 'apple_music,spotify');
    fd.append('file', new Blob([clip], { type: 'audio/mpeg' }), 'clip.mp3');
    const j = await (await fetch('https://api.audd.io/', { method: 'POST', body: fd })).json();
    if (j.status !== 'success') {
      const msg = j.error?.error_message || '';
      return send(res, 502, { error: /limit|daily|token/i.test(msg) ? '오늘 무료 음악 인식 횟수를 다 썼어요' : msg || 'AudD 오류' });
    }
    const r = j.result;
    send(res, 200, {
      result: r && {
        title: r.title,
        artist: r.artist,
        album: r.album || '',
        cover: r.apple_music?.artwork?.url?.replace('{w}', '300').replace('{h}', '300') || r.spotify?.album?.images?.[1]?.url || '',
      },
    });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}
