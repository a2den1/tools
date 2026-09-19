import { $, $$, seg, segHTML, range, paintRanges, dropzone, download, baseName, fmtBytes, fmtTime, esc, toast } from '../ui.js';

const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

const TARGETS = {
  video: [
    ['mp4', 'MP4'],
    ['webm', 'WEBM'],
    ['mov', 'MOV'],
    ['mkv', 'MKV'],
    ['gif', 'GIF'],
  ],
  audio: [
    ['mp3', 'MP3'],
    ['wav', 'WAV'],
    ['m4a', 'M4A'],
    ['ogg', 'OGG'],
    ['flac', 'FLAC'],
    ['opus', 'OPUS'],
  ],
};
const MIME = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', gif: 'image/gif', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', flac: 'audio/flac', opus: 'audio/ogg' };

let ffmpeg = null;
let loading = null;

// @ffmpeg/util 의 toBlobURL 은 gzip 된 Content-Length 를 실제 크기로 믿어서 CDN 에서 멈춘다.
// 받은 양이 헤더보다 커지면 전체 크기를 모르는 것으로 보고 끝까지 받는다.
async function blobURL(url, type, onProgress) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`변환기를 받지 못했어요 (${r.status})`);
  const encoded = !!r.headers.get('content-encoding');
  let total = encoded ? 0 : +r.headers.get('content-length') || 0;
  if (!total && /\.wasm$/.test(url)) total = 32_232_419; // ffmpeg-core 0.12.10 wasm 크기
  const reader = r.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.({ received, total: Math.max(total, received) });
  }
  return URL.createObjectURL(new Blob(chunks, { type }));
}

async function getFFmpeg(onProgress) {
  if (ffmpeg) return ffmpeg;
  if (!loading) {
    loading = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const ff = new FFmpeg();
      const coreURL = await blobURL(`${CORE}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await blobURL(`${CORE}/ffmpeg-core.wasm`, 'application/wasm', onProgress);
      await ff.load({ coreURL, wasmURL });
      ffmpeg = ff;
      return ff;
    })().catch((e) => {
      loading = null;
      throw e;
    });
  }
  return loading;
}

function parseTime(s) {
  s = String(s || '').trim();
  if (!s) return null;
  const parts = s.split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return NaN;
  return parts.reduce((a, n) => a * 60 + n, 0);
}

function buildArgs(inName, outName, fmt, o) {
  const a = [];
  if (o.start != null) a.push('-ss', String(o.start));
  a.push('-i', inName);
  if (o.end != null) a.push('-t', String(Math.max(0.1, o.end - (o.start || 0))));
  const scale = o.height ? `scale=-2:${o.height}` : null;
  switch (fmt) {
    case 'mp4':
    case 'mov':
    case 'mkv':
      a.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(o.crf), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k');
      if (scale) a.push('-vf', scale);
      if (fmt === 'mp4') a.push('-movflags', '+faststart');
      break;
    case 'webm':
      a.push('-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '5', '-crf', String(Math.min(63, o.crf - 8)), '-b:v', '2M', '-c:a', 'libvorbis');
      if (scale) a.push('-vf', scale);
      break;
    case 'gif':
      a.push('-vf', `fps=${o.fps},scale=${o.gifWidth}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4`, '-loop', '0');
      break;
    case 'mp3':
      a.push('-vn', '-c:a', 'libmp3lame', '-b:a', `${o.bitrate}k`);
      break;
    case 'wav':
      a.push('-vn', '-c:a', 'pcm_s16le');
      break;
    case 'm4a':
      a.push('-vn', '-c:a', 'aac', '-b:a', `${o.bitrate}k`);
      break;
    case 'ogg':
      a.push('-vn', '-c:a', 'libvorbis', '-q:a', '6');
      break;
    case 'flac':
      a.push('-vn', '-c:a', 'flac');
      break;
    case 'opus':
      a.push('-vn', '-c:a', 'libopus', '-b:a', `${Math.min(256, o.bitrate)}k`);
      break;
  }
  a.push(outName);
  return a;
}

export default function (root) {
  let alive = true;
  let busy = false;
  let file = null;
  let isVideo = false;
  let duration = 0;
  let resultUrl = null;

  root.innerHTML = `
    <div class="drop" id="drop">
      <i class="fa-solid fa-file-video"></i>
      <b>영상·음악 파일을 끌어오거나 클릭</b>
      <span>MP4 · MOV · WEBM · MKV · AVI · MP3 · WAV · FLAC · M4A …</span>
    </div>
    <div id="work" hidden class="stack"></div>`;
  const dz = dropzone($('#drop', root), ([f]) => pick(f), { accept: 'video/*,audio/*,.mkv,.avi,.flv,.wmv,.flac,.opus,.m4a,.ogg' });

  function pick(f) {
    if (busy) return toast('변환이 끝난 뒤에 바꿀 수 있어요', 'fa-circle-info');
    file = f;
    isVideo = f.type.startsWith('video/') || /\.(mkv|avi|flv|wmv|mov|mp4|webm)$/i.test(f.name);
    $('#drop', root).hidden = true;
    const work = $('#work', root);
    work.hidden = false;
    const fmts = [...(isVideo ? TARGETS.video : []), ...TARGETS.audio];
    const first = isVideo ? 'mp4' : 'mp3';
    work.innerHTML = `
      <div class="panel row">
        <span class="ic" style="width:48px;height:48px;font-size:19px;border-radius:15px"><i class="fa-solid ${isVideo ? 'fa-film' : 'fa-music'}"></i></span>
        <div class="grow" style="min-width:0">
          <b class="ellipsis">${esc(f.name)}</b>
          <span class="muted mono" id="meta">${fmtBytes(f.size)}</span>
        </div>
        <button class="icon-btn" id="again" aria-label="다른 파일"><i class="fa-solid fa-rotate"></i></button>
      </div>
      <div class="panel stack" style="gap:18px">
        <div><span class="label">변환할 형식</span>${segHTML(fmts, first, 'fill')}</div>
        <div id="opt-video" class="stack" style="gap:18px">
          <div><span class="label">해상도</span>${segHTML([['0', '원본'], ['1080', '1080p'], ['720', '720p'], ['480', '480p']], '0', 'fill')}</div>
          ${range('crf', '화질 (낮을수록 좋음)', 18, 35, 23)}
        </div>
        <div id="opt-gif" class="stack" style="gap:18px">
          ${range('fps', '초당 프레임', 5, 30, 12)}
          ${range('gw', '너비', 160, 960, 480, 20, 'px')}
        </div>
        <div id="opt-audio">${range('br', '비트레이트', 64, 320, 192, 32, 'k')}</div>
        <div class="two">
          <div><span class="label">시작</span><input class="field mono" id="t0" placeholder="0:00"></div>
          <div><span class="label">끝</span><input class="field mono" id="t1" placeholder="끝까지"></div>
        </div>
      </div>
      <div id="prog" hidden class="panel stack" style="gap:10px">
        <div class="row between"><b id="prog-t">준비 중</b><span class="mono muted" id="prog-p"></span></div>
        <div class="bar"><i></i></div>
      </div>
      <div class="row">
        <button class="btn wide grow" id="go" style="height:54px"><i class="fa-solid fa-arrows-rotate"></i>변환</button>
        <button class="btn soft" id="stop" hidden style="height:54px"><i class="fa-solid fa-xmark"></i>취소</button>
      </div>
      <div id="result"></div>`;
    paintRanges(work);
    const segs = $$('.seg', work);
    const fmt = seg(segs[0], sync);
    const res = seg(segs[1]);
    function sync() {
      const v = fmt.value;
      $('#opt-video', work).hidden = !['mp4', 'webm', 'mov', 'mkv'].includes(v);
      $('#opt-gif', work).hidden = v !== 'gif';
      $('#opt-audio', work).hidden = !['mp3', 'm4a', 'opus'].includes(v);
    }
    sync();
    $('#again', work).addEventListener('click', () => {
      if (busy) return;
      $('#drop', root).hidden = false;
      work.hidden = true;
      dz.open();
    });

    // 길이 읽기
    const probe = document.createElement(isVideo ? 'video' : 'audio');
    const probeUrl = URL.createObjectURL(f);
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      duration = probe.duration;
      const dims = isVideo && probe.videoWidth ? ` · ${probe.videoWidth}×${probe.videoHeight}` : '';
      if (Number.isFinite(duration)) $('#meta', work).textContent = `${fmtBytes(f.size)} · ${fmtTime(duration)}${dims}`;
      URL.revokeObjectURL(probeUrl);
    };
    probe.onerror = () => URL.revokeObjectURL(probeUrl);
    probe.src = probeUrl;

    $('#stop', work).addEventListener('click', () => {
      ffmpeg?.terminate();
      ffmpeg = null;
      loading = null;
    });

    $('#go', work).addEventListener('click', async () => {
      const start = parseTime($('#t0', work).value);
      const end = parseTime($('#t1', work).value);
      if (Number.isNaN(start) || Number.isNaN(end) || (start != null && end != null && end <= start)) return toast('시간을 확인해 주세요 (예: 1:30)', 'fa-circle-exclamation');
      const o = { start, end, crf: +$('#crf', work).value, height: +res.value || 0, fps: +$('#fps', work).value, gifWidth: +$('#gw', work).value, bitrate: +$('#br', work).value };
      const out = fmt.value;
      await convert(out, o);
    });

    async function convert(out, o) {
      busy = true;
      const go = $('#go', work);
      const stop = $('#stop', work);
      const prog = $('#prog', work);
      const bar = $('.bar', prog);
      const t = $('#prog-t', work);
      const p = $('#prog-p', work);
      go.disabled = true;
      stop.hidden = false;
      prog.hidden = false;
      $('#result', work).innerHTML = '';
      bar.classList.add('indeterminate');
      t.textContent = '변환기 불러오는 중';
      p.textContent = '';
      const t0 = performance.now();
      try {
        const ff = await getFFmpeg((e) => {
          if (!e.total) return;
          bar.classList.remove('indeterminate');
          bar.firstElementChild.style.width = (e.received / e.total) * 100 + '%';
          p.textContent = `${fmtBytes(e.received)} / ${fmtBytes(e.total)}`;
        });
        if (!alive) return;
        t.textContent = '변환 중';
        p.textContent = '';
        bar.classList.remove('indeterminate');
        bar.firstElementChild.style.width = '0%';
        const span = (o.end ?? duration) - (o.start || 0);
        const onLog = ({ message }) => {
          const m = message.match(/time=(\d+):(\d+):(\d+\.\d+)/);
          if (!m || !span || !Number.isFinite(span)) return;
          const s = +m[1] * 3600 + +m[2] * 60 + +m[3];
          const r = Math.min(1, s / span);
          bar.firstElementChild.style.width = r * 100 + '%';
          p.textContent = `${Math.round(r * 100)}%`;
        };
        ff.on('log', onLog);
        const ext = (file.name.match(/\.([^.]+)$/) || [, 'bin'])[1].toLowerCase();
        const inName = `input.${ext}`;
        const outName = `output.${out}`;
        const { fetchFile } = await import('@ffmpeg/util');
        await ff.writeFile(inName, await fetchFile(file));
        const code = await ff.exec(buildArgs(inName, outName, out, o));
        ff.off('log', onLog);
        if (code !== 0) throw new Error('변환에 실패했어요. 다른 형식으로 시도해 주세요.');
        const data = await ff.readFile(outName);
        await ff.deleteFile(inName).catch(() => {});
        await ff.deleteFile(outName).catch(() => {});
        if (!alive) return;
        const blob = new Blob([data.buffer], { type: MIME[out] });
        if (resultUrl) URL.revokeObjectURL(resultUrl);
        resultUrl = URL.createObjectURL(blob);
        const name = `${baseName(file.name)}.${out}`;
        const secs = ((performance.now() - t0) / 1000).toFixed(1);
        const media = out === 'gif' ? `<img src="${resultUrl}" alt="" style="border-radius:16px;margin:auto">` : TARGETS.video.some(([v]) => v === out) ? `<video src="${resultUrl}" controls playsinline style="width:100%;border-radius:16px;background:#000"></video>` : `<audio src="${resultUrl}" controls style="width:100%"></audio>`;
        $('#result', work).innerHTML = `
          <div class="panel stack" style="animation:rise .6s var(--ease) both">
            ${media}
            <div class="row">
              <div class="grow" style="min-width:0"><b class="ellipsis">${esc(name)}</b><span class="muted mono">${fmtBytes(blob.size)} · ${secs}초</span></div>
              <button class="btn good" id="save"><i class="fa-solid fa-download"></i>저장</button>
            </div>
          </div>`;
        $('#save', work).addEventListener('click', () => download(blob, name));
      } catch (e) {
        if (alive) {
          const msg = /terminate/i.test(e?.message || '') ? '취소했어요' : e.message || '변환에 실패했어요';
          toast(msg, 'fa-circle-exclamation');
        }
      } finally {
        busy = false;
        if (alive) {
          go.disabled = false;
          stop.hidden = true;
          prog.hidden = true;
        }
      }
    }
  }

  return () => {
    alive = false;
    dz.destroy();
    if (busy) {
      ffmpeg?.terminate();
      ffmpeg = null;
      loading = null;
    }
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  };
}
