import { $, esc, fmtTime } from '../ui.js';
import { getFFmpeg } from '../ffmpeg.js';
import { urlBar, bindUrlBar, card, errBox, api, pickAudio, fetchStream, withInputs } from './yt-common.js';

const q = (s) => encodeURIComponent(s);
const links = (text) => `
  <div class="row" style="gap:6px">
    <a class="icon-btn" target="_blank" rel="noopener" href="https://music.youtube.com/search?q=${q(text)}" aria-label="YouTube Music"><i class="fa-brands fa-youtube"></i></a>
    <a class="icon-btn" target="_blank" rel="noopener" href="https://open.spotify.com/search/${q(text)}" aria-label="Spotify"><i class="fa-brands fa-spotify"></i></a>
    <a class="icon-btn" target="_blank" rel="noopener" href="https://www.melon.com/search/total/index.htm?q=${q(text)}" aria-label="멜론"><i class="fa-solid fa-magnifying-glass"></i></a>
  </div>`;

const MUSIC_RE = /(music|bgm|song|track|soundtrack|ost|음악|노래|브금|배경음|곡|♪|♫|🎵|🎶)/i;

// "가수 - 제목 (Official Video)" 형태의 제목이나 "… - Topic" 채널에서 곡 정보를 추측
function guessFromTitle(info) {
  const clean = info.title
    .replace(/[([【][^)\]】]*(official|video|audio|lyric|lyrics|visualizer|m\/?v|remaster|4k|hd|가사|뮤직비디오|공식)[^)\]】]*[)\]】]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const m = clean.match(/^(.+?)\s+[-–—|]\s+(.+)$/);
  if (m) return { artist: m[1].trim(), title: m[2].replace(/^["'“]|["'”]$/g, '').trim() };
  if (info.topic) return { artist: info.uploader, title: clean };
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

function chapters(desc = '') {
  const out = [];
  for (const line of desc.split('\n')) {
    const m = line.match(/^\s*(?:(\d+):)?(\d{1,2}):(\d{2})\s*[-–—]?\s*(.+)$/);
    if (m) out.push({ start: (+m[1] || 0) * 3600 + +m[2] * 60 + +m[3], title: m[4].trim() });
  }
  return out.length >= 2 ? out : [];
}

export default function (root) {
  let alive = true;
  let ctl = null;
  root.innerHTML = `${urlBar()}<div id="fm-out" class="stack"></div>`;
  const out = $('#fm-out', root);
  let seq = 0;

  bindUrlBar(root, async (url) => {
    const my = ++seq;
    ctl?.abort();
    ctl = new AbortController();
    out.innerHTML = `<div class="panel fm-wait"><div class="vinyl"><i></i></div><b id="fm-step">영상 정보 읽는 중</b></div>`;
    try {
      const [info, rec] = await Promise.all([api('/api/info?url=' + encodeURIComponent(url)), api('/api/recognize').catch(() => ({ enabled: false }))]);
      if (!alive || my !== seq) return;
      let recognized = [];
      let recError = '';
      if (rec.enabled) {
        try {
          recognized = await recognize(info, ctl.signal, (t) => my === seq && $('#fm-step', root) && ($('#fm-step', root).textContent = t));
        } catch (e) {
          if (e.name === 'AbortError') return;
          recError = e.message;
        }
      }
      if (!alive || my !== seq) return;
      render(info, recognized, rec.enabled, recError);
    } catch (e) {
      if (my === seq && e.name !== 'AbortError') out.innerHTML = errBox(e.message);
    }
  });

  // 영상 곳곳에서 12초씩 잘라 서버(AudD)에 물어본다
  async function recognize(info, signal, step) {
    const a = pickAudio(info, { smallest: true });
    let got = 0;
    const blob = await fetchStream(info, a, { signal, onBytes: (n) => step(`소리 받는 중 ${Math.floor(((got += n) / a.size) * 100)}%`) });
    step('소리 자르는 중');
    const ff = await getFFmpeg();
    const dur = info.duration || 60;
    const n = Math.max(1, Math.min(3, Math.floor(dur / 60))); // 무료 인식 횟수를 아끼려고 최대 3곳
    const points = Array.from({ length: n }, (_, i) => Math.max(0, Math.floor(((i + 0.5) * dur) / n) - 6));
    const clips = await withInputs(ff, [new File([blob], `a.${a.ext}`)], async (dir) => {
      const res = [];
      for (const [i, t] of points.entries()) {
        const name = `clip${i}.mp3`;
        const code = await ff.exec(['-ss', String(t), '-t', '12', '-i', `${dir}/a.${a.ext}`, '-vn', '-ac', '1', '-b:a', '96k', name]);
        if (code === 0) res.push([t, await ff.readFile(name)]);
        await ff.deleteFile(name).catch(() => {});
      }
      return res;
    });
    const found = new Map();
    let done = 0;
    for (const [t, data] of clips) {
      step(`곡 찾는 중 ${++done}/${clips.length}`);
      const r = await fetch('/api/recognize', { method: 'POST', body: data, headers: { 'Content-Type': 'audio/mpeg' }, signal });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || '음악 인식에 실패했어요');
      const s = j.result;
      if (!s) continue;
      const key = `${s.artist} — ${s.title}`.toLowerCase();
      if (!found.has(key)) found.set(key, { ...s, time: t });
    }
    return [...found.values()];
  }

  function render(d, recognized, enabled, recError) {
    const at = (t) => `https://www.youtube.com/watch?v=${d.id}&t=${Math.floor(t)}s`;
    const parts = [card(d)];
    let found = 0;
    const guess = guessFromTitle(d);

    if (recognized.length) {
      found += recognized.length;
      parts.push(`<span class="label" style="margin-top:6px">소리로 찾은 음악</span>`);
      for (const s of recognized) {
        const name = `${s.artist} - ${s.title}`;
        parts.push(`
          <div class="panel row fm-song">
            ${s.cover ? `<img class="fm-cover" src="${esc(s.cover)}" alt="">` : `<span class="fm-cover"><i class="fa-solid fa-music"></i></span>`}
            <div class="grow" style="min-width:160px">
              <b>${esc(s.title)}</b>
              <span class="muted">${esc([s.artist, s.album].filter(Boolean).join(' · '))}</span>
            </div>
            <a class="chip" href="${at(s.time)}" target="_blank" rel="noopener"><i class="fa-solid fa-play" style="margin-right:6px"></i>${fmtTime(s.time)}</a>
            ${links(name)}
          </div>`);
      }
    }

    if (guess) {
      found++;
      const name = `${guess.artist} - ${guess.title}`;
      parts.push(`<span class="label" style="margin-top:6px">제목으로 찾은 곡</span>`);
      parts.push(`
        <div class="panel row fm-song">
          <span class="fm-cover"><i class="fa-solid fa-music"></i></span>
          <div class="grow" style="min-width:160px"><b>${esc(guess.title)}</b><span class="muted">${esc(guess.artist)}</span></div>
          ${links(name)}
        </div>`);
    }

    const lines = descriptionSongs(d.description);
    if (lines.length) {
      found += lines.length;
      parts.push(`<span class="label" style="margin-top:6px">설명에 적힌 음악</span>`);
      parts.push(`<div class="outs">${lines.map((line) => `<div class="out"><span class="v">${esc(line)}</span>${links(line.replace(/^[^:：]*[:：]\s*/, ''))}</div>`).join('')}</div>`);
    }

    const ch = chapters(d.description);
    if (ch.length) {
      parts.push(`<span class="label" style="margin-top:6px">챕터</span>`);
      parts.push(`<div class="outs">${ch.map((c) => `<div class="out"><a class="chip" href="${at(c.start)}" target="_blank" rel="noopener">${fmtTime(c.start)}</a><span class="v">${esc(c.title)}</span>${links(c.title)}</div>`).join('')}</div>`);
    }

    if (!found && !ch.length) parts.push(`<div class="panel fm-none"><i class="fa-regular fa-face-meh"></i><b>찾은 음악이 없어요</b></div>`);
    if (enabled && recError) parts.push(errBox(recError));
    out.innerHTML = parts.join('');
  }

  return () => {
    alive = false;
    ctl?.abort();
  };
}
