import { videoId, getInfo, summarize, query, send } from './_lib/yt.js';
import { poToken } from './_lib/po.js';

export default async function handler(req, res) {
  const id = videoId(query(req).get('url'));
  if (!id) return send(res, 400, { error: '유튜브 주소가 아니에요' });
  try {
    const pot = await poToken(id);
    const { client, info } = await getInfo(id, pot);
    send(res, 200, summarize(id, client, info, pot), { 'Cache-Control': 'no-store' });
  } catch (e) {
    send(res, 502, { error: e.message });
  }
}
