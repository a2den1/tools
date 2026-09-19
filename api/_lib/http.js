// Vercel 함수 · Vite 개발 서버 공용 작은 도우미
export const query = (req) => new URL(req.url, 'http://x').searchParams;

export function send(res, code, body, headers = {}) {
  res.statusCode = code;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) return res.end(body);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function videoId(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1, 12);
    if (host !== 'youtube.com') return null;
    const v = u.searchParams.get('v');
    if (v) return v.slice(0, 11);
    const m = u.pathname.match(/^\/(shorts|live|embed|v)\/([\w-]{11})/);
    return m ? m[2] : null;
  } catch {
    return null;
  }
}

// 외부 변환 서비스(loader.to) — y2mate 같은 사이트. 브라우저에서는 CORS 때문에 직접 못 부른다
const FORMATS = new Set(['mp3', 'm4a', 'wav', 'flac', 'opus', 'ogg', '360', '480', '720', '1080', '1440', '4k', '8k']);
export const validFormat = (f) => FORMATS.has(f);
const HOSTS = /(^|\.)(loader\.to|affadaffa\.com|savenow\.to|oceansaver\.in)$/;
export const trustedUrl = (u) => {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && HOSTS.test(x.hostname) ? x.toString() : null;
  } catch {
    return null;
  }
};

export async function startJob(id, format) {
  const r = await fetch(`https://loader.to/ajax/download.php?format=${format}&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`, {
    headers: { 'user-agent': 'Mozilla/5.0' },
  });
  const j = await r.json().catch(() => null);
  if (!j?.success || !j.progress_url) throw new Error(j?.text || j?.message || `변환 서비스 오류 (${r.status})`);
  return { progress: j.progress_url, title: j.info?.title || j.title || '', image: j.info?.image || '' };
}

export async function jobProgress(progressUrl) {
  const r = await fetch(progressUrl, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const j = await r.json().catch(() => null);
  if (!j) throw new Error(`변환 서비스 오류 (${r.status})`);
  const done = j.success === 1 && !!j.download_url;
  const failed = j.success === 1 && !j.download_url;
  return { done, failed, progress: Math.max(0, Math.min(1000, +j.progress || 0)) / 10, text: j.text || '', url: j.download_url || null };
}
