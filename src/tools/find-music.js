import { $, esc, fmtTime } from '../ui.js';
import { gate, urlBar, bindUrlBar, card, errBox, api } from './yt-common.js';

const q = (s) => encodeURIComponent(s);
const links = (text) => `
  <div class="row" style="gap:6px">
    <a class="icon-btn" target="_blank" rel="noopener" href="https://music.youtube.com/search?q=${q(text)}" aria-label="YouTube Music"><i class="fa-brands fa-youtube"></i></a>
    <a class="icon-btn" target="_blank" rel="noopener" href="https://open.spotify.com/search/${q(text)}" aria-label="Spotify"><i class="fa-brands fa-spotify"></i></a>
    <a class="icon-btn" target="_blank" rel="noopener" href="https://www.melon.com/search/total/index.htm?q=${q(text)}" aria-label="멜론"><i class="fa-solid fa-magnifying-glass"></i></a>
  </div>`;

export default function (root) {
  let alive = true;
  gate(root, () => {
    root.innerHTML = `${urlBar()}<div id="fm-out" class="stack"></div>`;
    const out = $('#fm-out', root);
    let seq = 0;
    bindUrlBar(root, async (url) => {
      const my = ++seq;
      out.innerHTML = `
        <div class="panel fm-wait">
          <div class="vinyl"><i></i></div>
          <b>음악 찾는 중</b>
        </div>`;
      try {
        const d = await api('/api/music?url=' + encodeURIComponent(url));
        if (!alive || my !== seq) return;
        render(d);
      } catch (e) {
        if (my === seq) out.innerHTML = errBox(e.message);
      }
    });

    function render(d) {
      const at = (t) => `https://www.youtube.com/watch?v=${d.id}&t=${Math.floor(t)}s`;
      const parts = [card(d)];
      let found = 0;

      if (d.meta) {
        found++;
        const name = [d.meta.artist, d.meta.title].filter(Boolean).join(' - ');
        parts.push(`<span class="label" style="margin-top:6px">${d.meta.source === 'title' ? '제목으로 찾은 곡' : '유튜브에 등록된 곡'}</span>`);
        parts.push(`
          <div class="panel row fm-song">
            <span class="fm-cover"><i class="fa-solid fa-music"></i></span>
            <div class="grow" style="min-width:160px">
              <b>${esc(d.meta.title || name)}</b>
              <span class="muted">${esc([d.meta.artist, d.meta.album, d.meta.year].filter(Boolean).join(' · '))}</span>
            </div>
            ${links(name)}
          </div>`);
      }

      if (d.recognized?.length) {
        found += d.recognized.length;
        parts.push(`<span class="label" style="margin-top:6px">소리로 찾은 음악</span>`);
        for (const s of d.recognized) {
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

      if (d.description?.length) {
        found += d.description.length;
        parts.push(`<span class="label" style="margin-top:6px">설명에 적힌 음악</span>`);
        parts.push(`<div class="outs">${d.description
          .map((line) => `<div class="out"><span class="v">${esc(line)}</span>${links(line.replace(/^[^:：]*[:：]\s*/, ''))}</div>`)
          .join('')}</div>`);
      }

      if (d.chapters?.length) {
        parts.push(`<span class="label" style="margin-top:6px">챕터</span>`);
        parts.push(`<div class="outs">${d.chapters
          .map((c) => `<div class="out"><a class="chip" href="${at(c.start)}" target="_blank" rel="noopener">${fmtTime(c.start)}</a><span class="v">${esc(c.title)}</span>${links(c.title)}</div>`)
          .join('')}</div>`);
      }

      if (!found) {
        parts.push(`<div class="panel fm-none"><i class="fa-regular fa-face-meh"></i><b>찾은 음악이 없어요</b></div>`);
      }
      if (d.recognition === 'off') {
        parts.push(`<div class="note"><i class="fa-solid fa-circle-info"></i><span>소리로 찾기는 서버에 <b class="mono">AUDD_API_TOKEN</b> 을 넣으면 켜져요.</span></div>`);
      } else if (d.recognitionError && !d.recognized?.length) {
        parts.push(errBox(d.recognitionError));
      }
      out.innerHTML = parts.join('');
    }
  });
  return () => (alive = false);
}
