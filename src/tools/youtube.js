import { $, $$, esc, segHTML, seg } from '../ui.js';
import { gate, urlBar, bindUrlBar, skeleton, card, errBox, api, runJob } from './yt-common.js';

const resName = (h) => ({ 4320: '8K', 2160: '4K', 1440: 'QHD', 1080: 'FHD', 720: 'HD' })[h] || '';

export function ytDownloader(root, mode) {
  let stopJob = null;
  let alive = true;

  gate(root, () => {
    root.innerHTML = `
      ${urlBar()}
      <div id="yt-info" class="stack"></div>
      <div id="yt-opts" class="stack"></div>
      <div id="yt-job"></div>`;
    const info = $('#yt-info', root);
    const opts = $('#yt-opts', root);
    const job = $('#yt-job', root);
    let seq = 0;

    bindUrlBar(root, async (url) => {
      const my = ++seq;
      stopJob?.();
      job.innerHTML = '';
      opts.innerHTML = '';
      info.innerHTML = skeleton();
      try {
        const data = await api('/api/info?url=' + encodeURIComponent(url));
        if (!alive || my !== seq) return;
        info.innerHTML = card(data);
        mode === 'audio' ? audioOpts(url) : videoOpts(url, data);
      } catch (e) {
        if (my === seq) info.innerHTML = errBox(e.message);
      }
    });

    function videoOpts(url, data) {
      const qs = data.qualities.length ? data.qualities : [{ height: 1080, fps: 30 }];
      opts.innerHTML = `
        <div class="q-grid">${qs
          .map(
            (q, i) => `<button class="q${i === 0 ? ' on' : ''}" data-h="${q.height}" data-f="${q.fps}" style="--i:${i}">
              <b>${q.height}p</b>
              <span>${resName(q.height) ? `<em>${resName(q.height)}</em>` : ''}${q.fps}fps</span>
            </button>`,
          )
          .join('')}</div>
        <button class="btn wide" id="yt-dl" style="height:56px;font-size:16px"><i class="fa-solid fa-download"></i>MP4 다운로드</button>`;
      $$('.q', opts).forEach((b) =>
        b.addEventListener('click', () => {
          $$('.q', opts).forEach((x) => x.classList.toggle('on', x === b));
        }),
      );
      $('#yt-dl', opts).addEventListener('click', () => {
        const q = $('.q.on', opts);
        stopJob?.();
        stopJob = runJob({ url, type: 'video', height: +q.dataset.h, fps: +q.dataset.f }, job);
      });
    }

    function audioOpts(url) {
      opts.innerHTML = `
        <div class="panel row between">
          <span class="label" style="margin:0">음질</span>
          ${segHTML([['128', '128k'], ['192', '192k'], ['256', '256k'], ['320', '320k']], '320')}
        </div>
        <button class="btn wide" id="yt-dl" style="height:56px;font-size:16px"><i class="fa-solid fa-download"></i>MP3 다운로드</button>`;
      const s = seg($('.seg', opts));
      $('#yt-dl', opts).addEventListener('click', () => {
        stopJob?.();
        stopJob = runJob({ url, type: 'audio', bitrate: +s.value }, job);
      });
    }
  });

  return () => {
    alive = false;
    stopJob?.();
  };
}

export default (root) => ytDownloader(root, 'video');
