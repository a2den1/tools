import { $, esc, fmtTime } from '../ui.js';
import { urlBar, bindUrlBar, card, errBox, api, convert } from './yt-common.js';

const q = (s) => encodeURIComponent(s);
const links = (text) => `
  <div class="row" style="gap:6px">
    <a class="icon-btn" target="_blank" rel="noopener" href="https://music.youtube.com/search?q=${q(text)}" aria-label="YouTube Music"><i class="fa-brands fa-youtube"></i></a>
    <a class="icon-btn" target="_blank" rel="noopener" href="https://open.spotify.com/search/${q(text)}" aria-label="Spotify"><i class="fa-brands fa-spotify"></i></a>
    <a class="icon-btn" target="_blank" rel="noopener" href="https://www.melon.com/search/total/index.htm?q=${q(text)}" aria-label="멜론"><i class="fa-solid fa-magnifying-glass"></i></a>
  </div>`;

// "가수 - 제목 (Official Video)" 형태의 제목이나 "… - Topic" 채널에서 곡 정보를 추측
function guessFromTitle(info) {
  const clean = info.title
    .replace(/[([【][^)\]】]*(official|video|audio|lyric|lyrics|visualizer|m\/?v|remaster|4k|hd|가사|뮤직비디오|공식)[^)\]】]*[)\]】]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const m = clean.match(/^(.+?)\s+[-–—|]\s+(.+)$/);
  if (m) return { artist: m[1].trim(), title: m[2].replace(/^["'“]|["'”]$/g, '').trim() };
  if (info.topic) return { artist: info.uploader.replace(/ - Topic$/, ''), title: clean };
  return null;
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
    const signal = ctl.signal;
    out.innerHTML = `<div class="panel fm-wait"><div class="vinyl"><i></i></div><b id="fm-step">영상 정보 읽는 중</b></div>`;
    const step = (t) => my === seq && $('#fm-step', root) && ($('#fm-step', root).textContent = t);
    try {
      const info = await api('/api/meta?url=' + encodeURIComponent(url), { signal });
      if (!alive || my !== seq) return;
      let recognized = [];
      let recError = '';
      try {
        step('소리 준비 중');
        const mp3 = await convert(url, 'mp3', { signal, onProgress: (p) => step(p.progress > 0 ? `소리 준비 중 ${Math.floor(p.progress)}%` : '소리 준비 중') });
        step('곡 찾는 중');
        const r = await api('/api/recognize?src=' + encodeURIComponent(mp3), { signal });
        recognized = r.results || [];
        recError = r.error || '';
      } catch (e) {
        if (e.name === 'AbortError') return;
        recError = e.message;
      }
      if (!alive || my !== seq) return;
      render(info, recognized, recError);
    } catch (e) {
      if (my === seq && e.name !== 'AbortError') out.innerHTML = errBox(e.message);
    }
  });

  function render(d, recognized, recError) {
    const at = (t) => `https://www.youtube.com/watch?v=${d.id}&t=${Math.floor(t)}s`;
    const parts = [card(d)];
    const guess = guessFromTitle(d);

    // 영상 제목에 들어 있는 곡(원곡일 가능성이 큼)을 맨 앞에
    const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const title = norm(d.title);
    recognized = [...recognized].sort((a, b) => title.includes(norm(b.title)) - title.includes(norm(a.title)));
    if (recognized.length) {
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
      const name = `${guess.artist} - ${guess.title}`;
      parts.push(`<span class="label" style="margin-top:6px">제목으로 찾은 곡</span>`);
      parts.push(`
        <div class="panel row fm-song">
          <span class="fm-cover"><i class="fa-solid fa-music"></i></span>
          <div class="grow" style="min-width:160px"><b>${esc(guess.title)}</b><span class="muted">${esc(guess.artist)}</span></div>
          ${links(name)}
        </div>`);
    }

    if (!recognized.length && !guess) parts.push(`<div class="panel fm-none"><i class="fa-regular fa-face-meh"></i><b>찾은 음악이 없어요</b></div>`);
    if (!recognized.length && recError) parts.push(errBox(recError));
    out.innerHTML = parts.join('');
  }

  return () => {
    alive = false;
    ctl?.abort();
  };
}
