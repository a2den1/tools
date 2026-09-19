// 유튜브 변환: ?url=&format= 으로 시작, ?progress= 로 진행 확인 (실제 변환은 loader.to 가 한다)
import { query, send, videoId, validFormat, trustedUrl, startJob, jobProgress } from './_lib/http.js';

export default async function handler(req, res) {
  const q = query(req);
  try {
    if (q.has('progress')) {
      const url = trustedUrl(q.get('progress'));
      if (!url) return send(res, 400, { error: '잘못된 요청' });
      return send(res, 200, await jobProgress(url), { 'Cache-Control': 'no-store' });
    }
    const id = videoId(q.get('url'));
    const format = q.get('format');
    if (!id) return send(res, 400, { error: '유튜브 주소가 아니에요' });
    if (!validFormat(format)) return send(res, 400, { error: '지원하지 않는 형식' });
    send(res, 200, await startJob(id, format), { 'Cache-Control': 'no-store' });
  } catch (e) {
    send(res, 502, { error: e.message });
  }
}
