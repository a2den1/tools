// 유튜브 정보·스트림 주소 (Vercel 함수와 로컬 개발 서버가 같이 쓴다)
import { Innertube, Platform } from 'youtubei.js';
import { cookieHeader } from './cookie.js';

// 스트림 주소 서명 해독용 플레이어 스크립트 실행기
Platform.shim.eval = async (data) => new Function(data.output)();

// 2026-09 확인: MWEB + PO 토큰이면 봇 의심을 받는 가정용 IP 에서도 스트림 끝까지 받힌다.
// Vercel(데이터센터) IP 는 로그인 쿠키 없이는 모든 클라이언트가 봇 확인에 걸린다 → cookie.js.
// 쿠키가 있으면 TV 클라이언트가 PO 토큰 없이도 되는 경우가 많아 앞에 둔다.
const COOKIE = cookieHeader();
const CLIENTS = COOKIE ? ['TV', 'MWEB', 'WEB', 'VISIONOS', 'IOS'] : ['MWEB', 'VISIONOS', 'IOS'];
export const hasCookie = !!COOKIE;
export const validPot = (s) => (typeof s === 'string' && /^[\w=-]{20,600}$/.test(s) ? s : null);
export const CHUNK = 4 * 1024 * 1024; // Vercel 응답 한도(4.5MB) 아래

let ytP = null;
export function innertube() {
  ytP ??= Innertube.create({ retrieve_player: true, generate_session_locally: !COOKIE, ...(COOKIE ? { cookie: COOKIE } : {}) }).catch((e) => {
    ytP = null;
    throw e;
  });
  return ytP;
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

const infoCache = new Map();

async function basicInfo(id, client, pot) {
  const key = `${id}:${client}`;
  const hit = infoCache.get(key);
  if (hit && Date.now() - hit.at < 20 * 60e3) return hit.info;
  const yt = await innertube();
  const info = await yt.getBasicInfo(id, { client, ...(pot ? { po_token: pot } : {}) });
  const status = info.playability_status?.status;
  if (status !== 'OK' || !info.streaming_data?.adaptive_formats?.some((f) => f.has_video)) {
    const reason = info.playability_status?.reason || status || '재생할 수 없는 영상';
    throw Object.assign(new Error(reason), { status });
  }
  infoCache.set(key, { at: Date.now(), info });
  if (infoCache.size > 100) infoCache.delete(infoCache.keys().next().value);
  return info;
}

// 정보만 되고 스트림 중간이 403 인 클라이언트가 있어서, 영상 한가운데를 조금 받아 보고 고른다
async function streamWorks(id, client, info, pot) {
  const f = info.streaming_data.adaptive_formats.filter((x) => x.has_video && +x.content_length > 5e6).sort((a, b) => a.content_length - b.content_length)[0];
  if (!f) return true; // 작은 영상은 앞부분만으로 충분
  try {
    const url = await streamUrl(id, f.itag, client, false, pot);
    const mid = Math.floor(+f.content_length / 2);
    return (await fetch(`${url}&range=${mid}-${mid + 9999}`)).ok;
  } catch {
    return false;
  }
}

export async function getInfo(id, pot) {
  let last;
  let fallback = null;
  for (const client of CLIENTS) {
    try {
      const info = await basicInfo(id, client, pot);
      if (await streamWorks(id, client, info, pot)) return { client, pot, info };
      fallback ??= { client, pot, info };
      last = new Error('stream blocked');
    } catch (e) {
      last = e;
      if (/private|removed|unavailable|존재하지/i.test(e.message) && e.status === 'ERROR') break;
    }
  }
  if (fallback) return fallback; // 끝까지는 못 받아도 정보와 작은 파일은 된다
  throw new Error(korean(last?.message));
}

function korean(msg = '') {
  if (/sign in to confirm/i.test(msg))
    return hasCookie ? '유튜브가 막았어요. 넣어 둔 쿠키가 만료됐을 수 있어요.' : '유튜브가 서버 접속을 봇으로 의심해 막았어요. 유튜브 쿠키를 넣으면 풀려요.';
  if (/age|confirm your age/i.test(msg)) return '연령 제한 영상은 받을 수 없어요.';
  if (/private/i.test(msg)) return '비공개 영상이에요.';
  if (/members/i.test(msg)) return '멤버십 전용 영상이에요.';
  if (/unavailable|not available/i.test(msg)) return '볼 수 없는 영상이에요.';
  if (/live/i.test(msg)) return '진행 중인 라이브는 받을 수 없어요.';
  return msg || '영상 정보를 가져오지 못했어요.';
}

const codecOf = (mime = '') => (mime.match(/codecs="([^".]+)/) || [])[1] || '';
const extOf = (mime = '') => (mime.includes('webm') ? 'webm' : 'mp4');
const CODEC_RANK = { avc1: 3, vp9: 2, vp09: 2, av01: 1 };

export function summarize(id, client, info, pot = null) {
  const bi = info.basic_info;
  const af = info.streaming_data.adaptive_formats.filter((f) => f.content_length);
  const video = af
    .filter((f) => f.has_video && !f.has_audio)
    .map((f) => ({ itag: f.itag, height: f.height, width: f.width, fps: f.fps || 30, codec: codecOf(f.mime_type), ext: extOf(f.mime_type), size: +f.content_length, bitrate: f.bitrate, hdr: /hdr/i.test(f.quality_label || '') }));
  const audio = af
    .filter((f) => f.has_audio && !f.has_video)
    .sort((a, b) => !!a.is_drc - !!b.is_drc) // 음량 보정(DRC) 트랙보다 원본 먼저
    .filter((f, i, arr) => arr.findIndex((x) => x.itag === f.itag && (x.audio_track?.id || '') === (f.audio_track?.id || '')) === i)
    .map((f) => ({ itag: f.itag, codec: codecOf(f.mime_type), ext: extOf(f.mime_type), size: +f.content_length, bitrate: f.bitrate, lang: f.language || null, original: !!f.audio_track?.audio_is_default || !!f.is_original }))
    .sort((a, b) => b.bitrate - a.bitrate);

  // 화질마다 하나: SDR → fps 높은 것 → 호환성 좋은 코덱
  const best = new Map();
  for (const v of video) {
    const cur = best.get(v.height);
    const score = (x) => (x.hdr ? 0 : 1e5) + x.fps * 100 + (CODEC_RANK[x.codec] || 0);
    if (!cur || score(v) > score(cur)) best.set(v.height, v);
  }
  const qualities = [...best.values()].sort((a, b) => b.height - a.height);
  const thumb = [...(bi.thumbnail || [])].sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

  return {
    id,
    client,
    pot,
    title: bi.title || '',
    uploader: (bi.author || bi.channel?.name || '').replace(/ - Topic$/, ''),
    topic: / - Topic$/.test(bi.author || ''),
    duration: bi.duration || 0,
    thumbnail: thumb,
    description: bi.short_description || '',
    qualities,
    audio,
  };
}

const urlCache = new Map();

export async function streamUrl(id, itag, client, fresh = false, pot = null) {
  const key = `${id}:${itag}:${client}`;
  const hit = urlCache.get(key);
  if (!fresh && hit && hit.expire > Date.now() + 60e3) return hit.url;
  if (fresh) infoCache.delete(`${id}:${client}`);
  const info = await basicInfo(id, client, pot);
  const f = info.streaming_data.adaptive_formats.find((x) => x.itag === itag);
  if (!f) throw new Error('그 화질을 찾을 수 없어요');
  const yt = await innertube();
  const url = (await f.decipher(yt.session.player)) + (pot ? `&pot=${pot}` : '');
  const expire = +new URL(url).searchParams.get('expire') * 1000 || Date.now() + 3600e3;
  urlCache.set(key, { url, expire });
  if (urlCache.size > 300) urlCache.delete(urlCache.keys().next().value);
  return url;
}

// ---------- 작은 HTTP 도우미 (Vercel · Vite 미들웨어 공용) ----------
export const query = (req) => new URL(req.url, 'http://x').searchParams;

export function send(res, code, body, headers = {}) {
  res.statusCode = code;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) return res.end(body);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export async function rawBody(req, limit = 2e6) {
  const chunks = [];
  let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > limit) throw new Error('파일이 너무 커요');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
