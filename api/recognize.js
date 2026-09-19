// 음악 인식: 변환된 MP3 를 받아 세 군데서 12초씩 잘라 AudD 에 물어본다.
// MP3 는 중간을 잘라도 디코더가 다음 프레임부터 읽어서 재인코딩이 필요 없다.
// 토큰 없이도 하루 몇 번은 되고, 더 쓰려면 https://audd.io 에서 받은 토큰을 아래에 넣는다.
import { query, send, trustedUrl } from './_lib/http.js';

const AUDD_TOKEN = '';
const MAX = 25 * 1024 * 1024;
const KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];

// 첫 MP3 프레임 헤더에서 비트레이트(kbps)를 읽는다
function bitrate(buf) {
  let i = 0;
  if (buf.toString('latin1', 0, 3) === 'ID3') i = 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]);
  for (; i < Math.min(buf.length - 4, i + 64 * 1024); i++) {
    if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) {
      const k = KBPS[buf[i + 2] >> 4];
      if (k) return { kbps: k, start: i };
    }
  }
  return { kbps: 128, start: 0 };
}

async function audd(clip) {
  const fd = new FormData();
  if (AUDD_TOKEN) fd.append('api_token', AUDD_TOKEN);
  fd.append('return', 'apple_music,spotify');
  fd.append('file', new Blob([clip], { type: 'audio/mpeg' }), 'clip.mp3');
  const j = await (await fetch('https://api.audd.io/', { method: 'POST', body: fd })).json();
  if (j.status !== 'success') {
    const msg = j.error?.error_message || '';
    throw new Error(/limit|daily|token/i.test(msg) ? '오늘 무료 음악 인식 횟수를 다 썼어요' : msg || '음악 인식 오류');
  }
  return j.result;
}

export default async function handler(req, res) {
  const src = trustedUrl(query(req).get('src'));
  if (!src) return send(res, 400, { error: '잘못된 요청' });
  try {
    const r = await fetch(src);
    if (!r.ok) throw new Error(`소리를 받지 못했어요 (${r.status})`);
    const chunks = [];
    let n = 0;
    for await (const c of r.body) {
      chunks.push(c);
      n += c.length;
      if (n > MAX) break;
    }
    const buf = Buffer.concat(chunks);
    const { kbps, start } = bitrate(buf);
    const bps = (kbps * 1000) / 8;
    const len = Math.round(bps * 12);
    const body = buf.length - start;
    const points = body > len * 3 ? [0.2, 0.5, 0.8] : [0];
    const found = new Map();
    let error = null;
    for (const p of points) {
      const off = start + Math.max(0, Math.floor(body * p - len / 2));
      try {
        const s = await audd(buf.subarray(off, off + len));
        if (!s) continue;
        const key = `${s.artist} — ${s.title}`.toLowerCase();
        if (!found.has(key))
          found.set(key, {
            time: Math.round((off - start) / bps),
            title: s.title,
            artist: s.artist,
            album: s.album || '',
            cover: s.apple_music?.artwork?.url?.replace('{w}', '300').replace('{h}', '300') || s.spotify?.album?.images?.[1]?.url || '',
          });
      } catch (e) {
        error = e.message;
        if (/횟수/.test(e.message)) break;
      }
    }
    send(res, 200, { results: [...found.values()], error: found.size ? null : error });
  } catch (e) {
    send(res, 502, { error: e.message });
  }
}
