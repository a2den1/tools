// 스트림 한 조각(최대 4MB)을 대신 받아 준다.
// 유튜브 주소는 받은 서버 IP 에 묶여 있고 CORS 도 없어서 브라우저가 직접 받을 수 없다.
import { streamUrl, query, send, validPot, CHUNK } from './_lib/yt.js';

export default async function handler(req, res) {
  const q = query(req);
  const id = q.get('id');
  const itag = Number(q.get('itag'));
  const client = q.get('c') || 'IOS';
  const start = Number(q.get('start'));
  const end = Number(q.get('end'));
  const pot = validPot(q.get('pot'));
  if (!/^[\w-]{11}$/.test(id || '') || !itag || !(start >= 0) || !(end >= start) || end - start + 1 > CHUNK || !/^[A-Z_]+$/.test(client))
    return send(res, 400, { error: '잘못된 요청' });

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const url = await streamUrl(id, itag, client, attempt > 0, pot);
      const r = await fetch(`${url}&range=${start}-${end}`);
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        return send(res, 200, buf, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
      }
      if (r.status !== 403 && r.status !== 410) throw new Error(`유튜브 응답 ${r.status}`);
    }
    throw new Error('유튜브가 다운로드를 막았어요');
  } catch (e) {
    send(res, 502, { error: e.message });
  }
}
