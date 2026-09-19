// Tools API — YouTube 다운로드 / MP3 / 음악 찾기
// yt-dlp + ffmpeg 가 필요해서 Vercel 이 아니라 PC·VPS 에서 따로 돌린다.
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';

const PORT = Number(process.env.PORT || 8787);
const ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean);
const AUDD_TOKEN = process.env.AUDD_API_TOKEN || '';
const MAX_RUNNING = Number(process.env.MAX_JOBS || 2);
const FFMPEG = process.env.FFMPEG_PATH || ffmpegStatic;
const WORK = path.join(os.tmpdir(), 'tools-api');
fs.mkdirSync(WORK, { recursive: true });

// yt-dlp 실행 방법 찾기: YTDLP_PATH → PATH 의 yt-dlp → python -m yt_dlp
const YTDLP = (() => {
  if (process.env.YTDLP_PATH) return [process.env.YTDLP_PATH];
  const tries = [['yt-dlp'], ['python3', '-m', 'yt_dlp'], ['python', '-m', 'yt_dlp']];
  for (const t of tries) {
    const r = spawnSync(t[0], [...t.slice(1), '--version'], { encoding: 'utf8' });
    if (r.status === 0) return t;
  }
  return null;
})();
const YTDLP_VERSION = YTDLP ? spawnSync(YTDLP[0], [...YTDLP.slice(1), '--version'], { encoding: 'utf8' }).stdout.trim() : null;
const BASE_ARGS = ['--no-warnings', '--no-playlist', '--js-runtimes', 'node', '--ffmpeg-location', FFMPEG];
if (process.env.YTDLP_COOKIES) BASE_ARGS.push('--cookies', process.env.YTDLP_COOKIES);

function ytdlp(args) {
  return spawn(YTDLP[0], [...YTDLP.slice(1), ...BASE_ARGS, ...args], { windowsHide: true });
}

function run(args) {
  return new Promise((resolve, reject) => {
    const p = ytdlp(args);
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(cleanErr(err) || `yt-dlp exited ${code}`))));
  });
}

function cleanErr(s) {
  const line = s.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('ERROR')).pop() || s.trim().split('\n').pop() || '';
  return line.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?([\w-]+:\s*)?/, '');
}

// ---------- URL 검사: 유튜브 주소만 받는다 ----------
const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be']);
function ytUrl(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    if (!/^https?:$/.test(u.protocol) || !YT_HOSTS.has(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

// ---------- 영상 정보 ----------
const infoCache = new Map();
async function getInfo(url) {
  const hit = infoCache.get(url);
  if (hit && Date.now() - hit.at < 10 * 60e3) return hit.data;
  const data = JSON.parse(await run(['-J', url]));
  infoCache.set(url, { at: Date.now(), data });
  if (infoCache.size > 200) infoCache.delete(infoCache.keys().next().value);
  return data;
}

function summarize(j) {
  const byHeight = new Map();
  for (const f of j.formats || []) {
    if (!f.height || f.vcodec === 'none' || f.protocol === 'mhtml') continue;
    const fps = Math.round(f.fps || 30);
    const cur = byHeight.get(f.height);
    if (!cur || fps > cur.fps) byHeight.set(f.height, { height: f.height, fps });
  }
  const qualities = [...byHeight.values()].sort((a, b) => b.height - a.height || b.fps - a.fps);
  const thumb = j.thumbnail || (j.thumbnails || []).slice(-1)[0]?.url || '';
  return {
    id: j.id,
    title: j.title,
    uploader: j.uploader || j.channel || '',
    duration: j.duration || 0,
    thumbnail: thumb,
    qualities,
  };
}

// ---------- 다운로드 작업 ----------
const jobs = new Map();
const queue = [];
let running = 0;

function newJob(url, opts) {
  const id = crypto.randomBytes(9).toString('base64url');
  const job = { id, url, opts, state: 'queued', percent: 0, speed: 0, eta: null, file: null, size: 0, error: null, listeners: new Set(), dir: path.join(WORK, id) };
  jobs.set(id, job);
  queue.push(job);
  pump();
  return job;
}

function emit(job) {
  const msg = `data: ${JSON.stringify(publicJob(job))}\n\n`;
  for (const res of job.listeners) res.write(msg);
}

function publicJob(j) {
  return { id: j.id, state: j.state, percent: Math.round(j.percent * 10) / 10, speed: j.speed, eta: j.eta, filename: j.file ? path.basename(j.file) : null, size: j.size, error: j.error };
}

function pump() {
  while (running < MAX_RUNNING && queue.length) start(queue.shift());
}

function start(job) {
  running++;
  fs.mkdirSync(job.dir, { recursive: true });
  const { type, height = 1080, fps = 60, bitrate = 320 } = job.opts;
  const args = ['--newline', '--no-part','-P', job.dir, '-o', '%(title).120B [%(id)s].%(ext)s',
    '--progress-template', 'download:@@%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s'];
  let stages;
  if (type === 'audio') {
    args.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', `${bitrate}K`, '--embed-metadata', '--embed-thumbnail', '--convert-thumbnails', 'jpg');
    stages = [0.9];
  } else {
    const h = Math.max(144, Math.min(4320, Number(height) || 1080));
    const r = Math.max(1, Math.min(240, Number(fps) || 60));
    args.push('-f', `bv*[height<=${h}][fps<=${r}]+ba[ext=m4a]/bv*[height<=${h}][fps<=${r}]+ba/b[height<=${h}]/b`, '--merge-output-format', 'mp4', '--embed-metadata');
    stages = [0.82, 0.12];
  }
  args.push(job.url);

  // yt-dlp 는 영상·음성을 따로 받으므로 진행률이 두 번 0% 부터 다시 오른다
  let stage = 0, last = 0;
  const base = () => stages.slice(0, stage).reduce((a, b) => a + b, 0);
  job.state = 'downloading';
  emit(job);
  const p = ytdlp(args);
  let err = '';
  let buf = '';
  p.stdout.on('data', (d) => {
    buf += d;
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    for (const line of lines) {
      if (line.startsWith('@@')) {
        const [done, total, est, speed, eta] = line.slice(2).split('|').map(Number);
        const t = total || est;
        if (!t) continue;
        const frac = Math.min(1, done / t);
        if (frac + 0.05 < last && stage < stages.length - 1) stage++;
        last = frac;
        job.percent = Math.min(99, (base() + frac * (stages[stage] || 0)) * 100);
        job.speed = Number.isFinite(speed) ? speed : 0;
        job.eta = Number.isFinite(eta) ? eta : null;
        emit(job);
      } else if (/^\[(Merger|ExtractAudio|EmbedThumbnail|Metadata|VideoConvertor|FixupM3u8|ThumbnailsConvertor)\]/.test(line)) {
        if (job.state !== 'processing') {
          job.state = 'processing';
          job.percent = Math.max(job.percent, (1 - (type === 'audio' ? 0.1 : 0.06)) * 100);
          emit(job);
        }
      }
    }
  });
  p.stderr.on('data', (d) => (err += d));
  p.on('close', async (code) => {
    running--;
    pump();
    try {
      if (code !== 0) throw new Error(cleanErr(err) || '다운로드 실패');
      const files = (await fsp.readdir(job.dir)).filter((f) => !/\.(jpg|webp|png|part|ytdl)$/i.test(f));
      if (!files.length) throw new Error('파일을 만들지 못했어요');
      job.file = path.join(job.dir, files[0]);
      job.size = (await fsp.stat(job.file)).size;
      job.state = 'done';
      job.percent = 100;
    } catch (e) {
      job.state = 'error';
      job.error = e.message;
    }
    emit(job);
    for (const res of job.listeners) res.end();
    job.listeners.clear();
    setTimeout(() => dropJob(job), 30 * 60e3);
  });
  p.on('error', (e) => {
    err += e.message;
  });
}

function dropJob(job) {
  jobs.delete(job.id);
  fs.rm(job.dir, { recursive: true, force: true }, () => {});
}

// ---------- 음악 찾기 ----------
const MUSIC_RE = /(music|bgm|song|track|soundtrack|ost|음악|노래|브금|배경음|곡|♪|♫|🎵|🎶)/i;

// "가수 - 제목 (Official Video)" 형태의 제목이나 "… - Topic" 채널에서 곡 정보를 추측
function guessFromTitle(title = '', uploader = '') {
  const clean = title
    .replace(/[([【][^)\]】]*(official|video|audio|lyric|lyrics|visualizer|m\/?v|remaster|4k|hd|가사|뮤직비디오|공식)[^)\]】]*[)\]】]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const m = clean.match(/^(.+?)\s+[-–—|]\s+(.+)$/);
  if (m) return { artist: m[1].trim(), title: m[2].replace(/^["'“]|["'”]$/g, '').trim(), album: '', year: null, source: 'title' };
  if (/ - Topic$/.test(uploader)) return { artist: uploader.replace(/ - Topic$/, ''), title: clean, album: '', year: null, source: 'title' };
  return null;
}

function descriptionSongs(desc = '') {
  const out = [];
  for (const raw of desc.split('\n')) {
    const line = raw.trim();
    if (!line || line.length > 160 || /https?:\/\/|www\.|\.(com|net|to|ly|kr)\b/i.test(line)) continue;
    if (MUSIC_RE.test(line) && /[-–—:|]/.test(line)) out.push(line);
  }
  return [...new Set(out)].slice(0, 20);
}

async function sampleClip(audioUrl, headers, start, secs, file) {
  const h = Object.entries(headers || {}).map(([k, v]) => `${k}: ${v}`).join('\r\n');
  const args = ['-hide_banner', '-loglevel', 'error', '-ss', String(start), '-t', String(secs)];
  if (h) args.push('-headers', h + '\r\n');
  args.push('-i', audioUrl, '-vn', '-ac', '1', '-ar', '44100', '-b:a', '128k', '-y', file);
  await new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { windowsHide: true });
    let e = '';
    p.stderr.on('data', (d) => (e += d));
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(e.trim() || 'ffmpeg 실패'))));
  });
}

async function audd(file) {
  const fd = new FormData();
  fd.append('api_token', AUDD_TOKEN);
  fd.append('return', 'apple_music,spotify');
  fd.append('file', new Blob([await fsp.readFile(file)]), 'clip.mp3');
  const r = await fetch('https://api.audd.io/', { method: 'POST', body: fd });
  const j = await r.json();
  if (j.status !== 'success') throw new Error(j.error?.error_message || 'AudD 오류');
  return j.result;
}

async function findMusic(url) {
  const j = await getInfo(url);
  const artist = j.artist || j.artists?.join(', ') || j.creator || '';
  const meta = j.track || artist ? { title: j.track || '', artist, album: j.album || '', year: j.release_year || null, source: 'youtube' } : guessFromTitle(j.title, j.uploader || j.channel);
  const result = {
    ...summarize(j),
    meta,
    description: descriptionSongs(j.description),
    chapters: (j.chapters || []).map((c) => ({ start: c.start_time, title: c.title })),
    recognized: [],
    recognition: AUDD_TOKEN ? 'on' : 'off',
  };
  if (!AUDD_TOKEN) return result;

  // 영상 곳곳에서 12초씩 떼어 AudD 로 인식한다
  const fmt = (j.formats || []).filter((f) => f.acodec !== 'none' && f.vcodec === 'none' && f.url && !/m3u8|dash/.test(f.protocol || '')).sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];
  if (!fmt) return result;
  const dur = j.duration || 60;
  const n = Math.max(1, Math.min(8, Math.floor(dur / 40)));
  const points = Array.from({ length: n }, (_, i) => Math.max(0, Math.floor(((i + 0.5) * dur) / n) - 6));
  const dir = path.join(WORK, 'm-' + crypto.randomBytes(6).toString('hex'));
  await fsp.mkdir(dir, { recursive: true });
  const found = new Map();
  try {
    await Promise.all(points.map(async (t, i) => {
      const file = path.join(dir, `${i}.mp3`);
      try {
        await sampleClip(fmt.url, fmt.http_headers, t, 12, file);
        const r = await audd(file);
        if (!r) return;
        const key = `${r.artist} — ${r.title}`.toLowerCase();
        if (found.has(key)) return;
        found.set(key, {
          time: t,
          title: r.title,
          artist: r.artist,
          album: r.album || '',
          cover: r.apple_music?.artwork?.url?.replace('{w}', '300').replace('{h}', '300') || r.spotify?.album?.images?.[1]?.url || '',
          links: { spotify: r.spotify?.external_urls?.spotify || '', apple: r.apple_music?.url || '', song: r.song_link || '' },
        });
      } catch (e) {
        result.recognitionError = e.message;
      }
    }));
  } finally {
    fs.rm(dir, { recursive: true, force: true }, () => {});
  }
  result.recognized = [...found.values()].sort((a, b) => a.time - b.time);
  return result;
}

// ---------- HTTP ----------
function cors(req, res) {
  const origin = req.headers.origin;
  if (ORIGINS.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origin && ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');
  // https 사이트(Vercel)에서 내 PC 의 localhost 서버를 부를 때 크롬이 확인하는 헤더
  if (req.headers['access-control-request-private-network']) res.setHeader('Access-Control-Allow-Private-Network', 'true');
}

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function body(req) {
  let s = '';
  for await (const c of req) {
    s += c;
    if (s.length > 1e5) throw new Error('too large');
  }
  return s ? JSON.parse(s) : {};
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  try {
    if (p === '/api/health') return json(res, 200, { ok: !!YTDLP, ytdlp: YTDLP_VERSION, recognition: !!AUDD_TOKEN });
    if (!YTDLP) return json(res, 500, { error: 'yt-dlp 를 찾을 수 없어요' });

    if (p === '/api/info' && req.method === 'GET') {
      const url = ytUrl(u.searchParams.get('url'));
      if (!url) return json(res, 400, { error: '유튜브 주소가 아니에요' });
      return json(res, 200, summarize(await getInfo(url)));
    }

    if (p === '/api/music' && req.method === 'GET') {
      const url = ytUrl(u.searchParams.get('url'));
      if (!url) return json(res, 400, { error: '유튜브 주소가 아니에요' });
      return json(res, 200, await findMusic(url));
    }

    if (p === '/api/jobs' && req.method === 'POST') {
      const b = await body(req);
      const url = ytUrl(b.url);
      if (!url) return json(res, 400, { error: '유튜브 주소가 아니에요' });
      const type = b.type === 'audio' ? 'audio' : 'video';
      const bitrate = [128, 192, 256, 320].includes(Number(b.bitrate)) ? Number(b.bitrate) : 320;
      const job = newJob(url, { type, height: b.height, fps: b.fps, bitrate });
      return json(res, 200, publicJob(job));
    }

    const m = p.match(/^\/api\/jobs\/([\w-]+)(\/events|\/file)?$/);
    if (m) {
      const job = jobs.get(m[1]);
      if (!job) return json(res, 404, { error: '작업이 없어요' });
      if (!m[2]) return json(res, 200, publicJob(job));
      if (m[2] === '/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write(`data: ${JSON.stringify(publicJob(job))}\n\n`);
        if (job.state === 'done' || job.state === 'error') return res.end();
        job.listeners.add(res);
        const ping = setInterval(() => res.write(': ping\n\n'), 15000);
        req.on('close', () => {
          clearInterval(ping);
          job.listeners.delete(res);
        });
        return;
      }
      if (job.state !== 'done') return json(res, 409, { error: '아직 준비 중이에요' });
      const name = path.basename(job.file);
      res.writeHead(200, {
        'Content-Type': name.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4',
        'Content-Length': job.size,
        'Content-Disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      });
      return fs.createReadStream(job.file).pipe(res);
    }

    json(res, 404, { error: 'not found' });
  } catch (e) {
    json(res, 500, { error: e.message || '서버 오류' });
  }
});

server.listen(PORT, () => {
  console.log(`Tools API → http://localhost:${PORT}`);
  console.log(`yt-dlp: ${YTDLP ? YTDLP.join(' ') + ' ' + YTDLP_VERSION : '없음'}`);
  console.log(`ffmpeg: ${FFMPEG}`);
  console.log(`음악 인식(AudD): ${AUDD_TOKEN ? '켜짐' : '꺼짐 — AUDD_API_TOKEN 설정 시 사용'}`);
});
