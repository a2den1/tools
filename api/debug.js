// 임시 진단용: 어떤 클라이언트·조합이 이 서버 IP 에서 통하는지 확인 (확인 후 삭제)
import { Innertube, Platform } from 'youtubei.js';
import { query, send } from './_lib/yt.js';

Platform.shim.eval = async (data) => new Function(data.output)();

export default async function handler(req, res) {
  const id = query(req).get('id') || 'jNQXAC9IVRw';
  const clients = (query(req).get('clients') || 'MWEB,WEB,WEB_EMBEDDED,TV,TV_SIMPLY,TV_EMBEDDED,IOS,ANDROID_VR,VISIONOS,YTMUSIC,ANDROID').split(',');
  const out = { id, rows: [] };
  let pot = null;
  try {
    const { poToken, lastError } = await import('./_lib/po.js');
    pot = await poToken(id);
    out.potError = pot ? null : lastError();
  } catch (e) {
    out.potError = e.message;
  }
  for (const local of [true, false]) {
    let yt;
    try {
      yt = await Innertube.create({ retrieve_player: true, generate_session_locally: local });
    } catch (e) {
      out.rows.push({ local, error: 'create ' + e.message });
      continue;
    }
    for (const client of clients)
      for (const withPot of pot ? [true, false] : [false]) {
        const row = { local, client, pot: withPot };
        try {
          const info = await yt.getBasicInfo(id, { client, ...(withPot ? { po_token: pot } : {}) });
          row.status = info.playability_status?.status;
          const af = info.streaming_data?.adaptive_formats || [];
          row.formats = af.length;
          const f = af.filter((x) => x.content_length > 5e5).sort((a, b) => a.content_length - b.content_length)[0];
          if (f) {
            const url = (await f.decipher(yt.session.player)) + (withPot ? `&pot=${pot}` : '');
            const mid = Math.floor(+f.content_length / 2);
            row.range = [(await fetch(`${url}&range=0-9999`)).status, (await fetch(`${url}&range=${mid}-${mid + 9999}`)).status].join('/');
          }
        } catch (e) {
          row.error = e.message.slice(0, 60);
        }
        out.rows.push(row);
      }
  }
  send(res, 200, out, { 'Cache-Control': 'no-store' });
}
