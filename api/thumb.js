// MP3 앨범아트용 썸네일 (i.ytimg.com 은 CORS 를 주지 않아 대신 받아 준다)
import { query, send } from './_lib/yt.js';

export default async function handler(req, res) {
  const id = query(req).get('id');
  if (!/^[\w-]{11}$/.test(id || '')) return send(res, 400, { error: '잘못된 요청' });
  for (const name of ['maxresdefault', 'sddefault', 'hqdefault']) {
    const r = await fetch(`https://i.ytimg.com/vi/${id}/${name}.jpg`).catch(() => null);
    if (r?.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      return send(res, 200, buf, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
    }
  }
  send(res, 404, { error: '썸네일이 없어요' });
}
