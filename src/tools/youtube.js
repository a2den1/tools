import { $, $$, segHTML, seg } from '../ui.js';
import { urlBar, bindUrlBar, skeleton, card, errBox, api, runJob } from './yt-common.js';

// 영상에 없는 화질을 고르면 변환 서비스가 있는 것 중 가장 좋은 화질로 준다
const QUALITIES = [
  ['4k', '2160p', '4K'],
  ['1440', '1440p', 'QHD'],
  ['1080', '1080p', 'FHD'],
  ['720', '720p', 'HD'],
  ['480', '480p', ''],
  ['360', '360p', ''],
];
const AUDIO = [
  ['mp3', 'MP3'],
  ['m4a', 'M4A'],
  ['wav', 'WAV'],
  ['flac', 'FLAC'],
];

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
      const info = { ...(await api('/api/meta?url=' + encodeURIComponent(url))), url };
      if (!alive || my !== seq) return;
      infoBox.innerHTML = card(info);
      mode === 'audio' ? audioOpts(info) : videoOpts(info);
    } catch (e) {
      if (my === seq) infoBox.innerHTML = errBox(e.message);
    }
  });

  function videoOpts(info) {
    opts.innerHTML = `
      <div class="q-grid">${QUALITIES.map(
        ([v, name, tag], i) => `<button class="q${v === '1080' ? ' on' : ''}" data-v="${v}" style="--i:${i}">
          <b>${name}</b>
          <span>${tag ? `<em>${tag}</em>` : ''}MP4</span>
        </button>`,
      ).join('')}</div>
      <button class="btn wide" id="yt-dl" style="height:56px;font-size:16px"><i class="fa-solid fa-download"></i>MP4 다운로드</button>`;
    $$('.q', opts).forEach((b) => b.addEventListener('click', () => $$('.q', opts).forEach((x) => x.classList.toggle('on', x === b))));
    $('#yt-dl', opts).addEventListener('click', () => {
      const q = $('.q.on', opts);
      stopJob?.();
      stopJob = runJob(job, info, q.dataset.v, `${q.querySelector('b').textContent} MP4`);
    });
  }

  function audioOpts(info) {
    opts.innerHTML = `
      <div class="panel row between">
        <span class="label" style="margin:0">형식</span>
        ${segHTML(AUDIO, 'mp3')}
      </div>
      <button class="btn wide" id="yt-dl" style="height:56px;font-size:16px"><i class="fa-solid fa-download"></i>다운로드</button>`;
    const s = seg($('.seg', opts));
    $('#yt-dl', opts).addEventListener('click', () => {
      stopJob?.();
      stopJob = runJob(job, info, s.value, s.value.toUpperCase());
    });
  }

  return () => {
    alive = false;
    stopJob?.();
  };
}

export default (root) => ytDownloader(root, 'video');
