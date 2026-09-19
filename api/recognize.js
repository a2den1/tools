// 음악 인식: 브라우저가 잘라 보낸 짧은 MP3 를 AudD 로 넘긴다 (토큰은 서버에만 둔다)
import { rawBody, send } from './_lib/yt.js';

export default async function handler(req, res) {
  const token = process.env.AUDD_API_TOKEN;
  if (req.method === 'GET') return send(res, 200, { enabled: !!token });
  if (req.method !== 'POST') return send(res, 405, { error: 'POST 만 돼요' });
  if (!token) return send(res, 501, { error: '음악 인식이 꺼져 있어요' });
  try {
    const clip = await rawBody(req, 1.5e6);
    const fd = new FormData();
    fd.append('api_token', token);
    fd.append('return', 'apple_music,spotify');
    fd.append('file', new Blob([clip], { type: 'audio/mpeg' }), 'clip.mp3');
    const j = await (await fetch('https://api.audd.io/', { method: 'POST', body: fd })).json();
    if (j.status !== 'success') return send(res, 502, { error: j.error?.error_message || 'AudD 오류' });
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
