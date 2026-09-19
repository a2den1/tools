import { videoId, getInfo, summarize, query, send } from './_lib/yt.js';

// PO 토큰 모듈(jsdom)이 실패해도 정보는 내줄 수 있게 따로 불러온다
let poError = null;
async function token(id) {
  try {
    const { poToken, lastError } = await import('./_lib/po.js');
    const t = await poToken(id);
    poError = t ? null : lastError();
    return t;
  } catch (e) {
    poError = String(e?.stack || e).slice(0, 600);
    return null;
  }
}

export default async function handler(req, res) {
  const id = videoId(query(req).get('url'));
  if (!id) return send(res, 400, { error: '유튜브 주소가 아니에요' });
  try {
    const pot = await token(id);
    const { client, info } = await getInfo(id, pot);
    send(res, 200, { ...summarize(id, client, info, pot), poError }, { 'Cache-Control': 'no-store' });
  } catch (e) {
    send(res, 502, { error: e.message, poError });
  }
}
