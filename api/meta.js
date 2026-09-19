// 영상 제목·채널·썸네일 (유튜브 공식 oEmbed)
import { query, send, videoId } from './_lib/http.js';

export default async function handler(req, res) {
  const id = videoId(query(req).get('url'));
  if (!id) return send(res, 400, { error: '유튜브 주소가 아니에요' });
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`);
    if (r.status === 401 || r.status === 403) return send(res, 403, { error: '비공개이거나 퍼가기가 막힌 영상이에요' });
    if (!r.ok) return send(res, 404, { error: '영상을 찾을 수 없어요' });
    const j = await r.json();
    send(
      res,
      200,
      { id, title: j.title || '', uploader: j.author_name || '', topic: / - Topic$/.test(j.author_name || ''), thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` },
      { 'Cache-Control': 'public, max-age=3600' },
    );
  } catch (e) {
    send(res, 502, { error: e.message });
  }
}
