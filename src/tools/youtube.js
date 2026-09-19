import { $, $$, segHTML, seg, fmtBytes } from '../ui.js';
import { urlBar, bindUrlBar, skeleton, card, errBox, api, runJob, pickAudio } from './yt-common.js';

const resName = (h) => (h >= 4320 ? '8K' : h >= 2160 ? '4K' : h >= 1440 ? 'QHD' : h >= 1080 ? 'FHD' : h >= 720 ? 'HD' : '');

export function ytDownloader(root, mode) {
  let stopJob = null;
  let alive = true;

  root.innerHTML = `
    ${urlBar()}
    <div id="yt-info" class="stack"></div>
    <div id="yt-opts" class="stack"></div>
    <div id="yt-job"></div>`;
  const infoBox = $('#yt-info', root);
  const opts = $('#yt-opts', root);
  const job = $('#yt-job', root);
  let seq = 0;

  bindUrlBar(root, async (url) => {
    const my = ++seq;
    stopJob?.();
    job.innerHTML = '';
    opts.innerHTML = '';
    infoBox.innerHTML = skeleton();
    try {
      const info = await api('/api/info?url=' + encodeURIComponent(url));
      if (!alive || my !== seq) return;
      infoBox.innerHTML = card(info);
      mode === 'audio' ? audioOpts(info) : videoOpts(info);
    } catch (e) {
      if (my === seq) infoBox.innerHTML = errBox(e.message);
    }
  });

  function videoOpts(info) {
    if (!info.qualities.length) {
      opts.innerHTML = errBox('받을 수 있는 화질이 없어요');
      return;
    }
    const audio = pickAudio(info, { preferAac: true });
    opts.innerHTML = `
      <div class="q-grid">${info.qualities
        .map(
          (q, i) => `<button class="q${i === 0 ? ' on' : ''}" data-i="${i}" style="--i:${i}">
            <b>${q.height}p</b>
            <span>${resName(q.height) ? `<em>${resName(q.height)}</em>` : ''}${q.fps}fps${q.hdr ? ' HDR' : ''}</span>
            <small>${fmtBytes(q.size + (audio?.size || 0))}</small>
          </button>`,
        )
        .join('')}</div>
      <button class="btn wide" id="yt-dl" style="height:56px;font-size:16px"><i class="fa-solid fa-download"></i>MP4 다운로드</button>`;
    $$('.q', opts).forEach((b) => b.addEventListener('click', () => $$('.q', opts).forEach((x) => x.classList.toggle('on', x === b))));
    $('#yt-dl', opts).addEventListener('click', () => {
      const q = info.qualities[+$('.q.on', opts).dataset.i];
      stopJob?.();
      stopJob = runJob(job, info, { type: 'video', quality: q });
    });
  }

  function audioOpts(info) {
    opts.innerHTML = `
      <div class="panel row between">
        <span class="label" style="margin:0">음질</span>
        ${segHTML([['128', '128k'], ['192', '192k'], ['256', '256k'], ['320', '320k']], '320')}
      </div>
      <button class="btn wide" id="yt-dl" style="height:56px;font-size:16px"><i class="fa-solid fa-download"></i>MP3 다운로드</button>`;
    const s = seg($('.seg', opts));
    $('#yt-dl', opts).addEventListener('click', () => {
      stopJob?.();
      stopJob = runJob(job, info, { type: 'audio', bitrate: +s.value });
    });
  }

  return () => {
    alive = false;
    stopJob?.();
  };
}

export default (root) => ytDownloader(root, 'video');
