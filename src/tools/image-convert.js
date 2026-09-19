import { $, $$, seg, segHTML, range, paintRanges, dropzone, loadImage, canvasToBlob, download, baseName, fmtBytes, esc, toast } from '../ui.js';
import { dropHTML } from './img-common.js';

const FORMATS = [
  ['image/png', 'PNG', 'png'],
  ['image/jpeg', 'JPG', 'jpg'],
  ['image/webp', 'WEBP', 'webp'],
  ['image/avif', 'AVIF', 'avif'],
];

function supported(type) {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  return c.toDataURL(type).startsWith(`data:${type}`);
}

export default function (root) {
  const formats = FORMATS.filter(([t]) => supported(t));
  let items = [];
  let seq = 0;

  root.innerHTML = `
    <div class="panel stack">
      <div class="row">
        ${segHTML(formats.map(([t, n]) => [t, n]), 'image/webp')}
        <span class="grow"></span>
        <div class="row" style="flex-wrap:nowrap;gap:8px">
          <span class="muted" style="font-size:13px;white-space:nowrap">최대 너비</span>
          <input class="field mono" id="maxw" type="number" min="1" placeholder="원본" style="width:110px;height:42px">
        </div>
      </div>
      ${range('q', '품질', 10, 100, 85, 1, '%')}
    </div>
    ${dropHTML('이미지를 끌어오거나 클릭 (여러 장 가능)')}
    <div class="outs" id="list"></div>
    <div class="row end" id="actions" hidden>
      <button class="btn soft" id="clear"><i class="fa-solid fa-trash-can"></i>비우기</button>
      <button class="btn good" id="all"><i class="fa-solid fa-download"></i>모두 저장</button>
    </div>`;
  paintRanges(root);

  const fmt = seg($('.seg', root), () => {
    syncQuality();
    convertAll();
  });
  const q = $('#q', root);
  const maxw = $('#maxw', root);
  const list = $('#list', root);
  const syncQuality = () => {
    q.disabled = fmt.value === 'image/png';
  };
  syncQuality();

  const dz = dropzone($('#drop', root), add, { accept: 'image/*', multiple: true });

  async function add(files) {
    for (const file of files) {
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImage(url);
        const it = { id: ++seq, file, url, img, blob: null };
        items.push(it);
        list.insertAdjacentHTML(
          'beforeend',
          `<div class="out conv" data-id="${it.id}">
            <img class="thumb checker" src="${url}" alt="">
            <div class="grow" style="min-width:0">
              <b class="ellipsis">${esc(file.name)}</b>
              <span class="muted mono" data-s>${img.naturalWidth}×${img.naturalHeight} · ${fmtBytes(file.size)}</span>
            </div>
            <button class="icon-btn" data-save aria-label="저장" disabled><i class="fa-solid fa-circle-notch fa-spin"></i></button>
          </div>`,
        );
        convert(it);
      } catch {
        URL.revokeObjectURL(url);
        toast(`${file.name} 을 열 수 없어요`, 'fa-circle-exclamation');
      }
    }
    $('#actions', root).hidden = !items.length;
  }

  async function convert(it) {
    const row = $(`[data-id="${it.id}"]`, list);
    if (!row) return;
    const btn = $('[data-save]', row);
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    const tok = (it.tok = (it.tok || 0) + 1);
    const w0 = it.img.naturalWidth;
    const h0 = it.img.naturalHeight;
    const mw = parseInt(maxw.value, 10);
    const s = mw > 0 && mw < w0 ? mw / w0 : 1;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w0 * s));
    c.height = Math.max(1, Math.round(h0 * s));
    const g = c.getContext('2d');
    if (fmt.value === 'image/jpeg') {
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
    }
    g.imageSmoothingQuality = 'high';
    g.drawImage(it.img, 0, 0, c.width, c.height);
    try {
      const blob = await canvasToBlob(c, fmt.value, q.value / 100);
      if (tok !== it.tok || !row.isConnected) return;
      it.blob = blob;
      it.ext = FORMATS.find(([t]) => t === fmt.value)[2];
      const diff = Math.round((1 - blob.size / it.file.size) * 100);
      $('[data-s]', row).innerHTML = `${c.width}×${c.height} · ${fmtBytes(it.file.size)} → <b class="${diff >= 0 ? 'good' : 'bad'}">${fmtBytes(blob.size)} (${diff >= 0 ? '−' : '+'}${Math.abs(diff)}%)</b>`;
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-download"></i>';
      row.classList.remove('pop');
      void row.offsetWidth;
      row.classList.add('pop');
    } catch (e) {
      btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
    }
  }

  const convertAll = () => items.forEach(convert);
  let t;
  const later = () => {
    clearTimeout(t);
    t = setTimeout(convertAll, 250);
  };
  q.addEventListener('input', later);
  maxw.addEventListener('input', later);

  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-save]');
    if (!b) return;
    const it = items.find((x) => x.id === +b.closest('.conv').dataset.id);
    if (it?.blob) download(it.blob, `${baseName(it.file.name)}.${it.ext}`);
  });

  $('#all', root).addEventListener('click', async () => {
    for (const it of items) {
      if (!it.blob) continue;
      download(it.blob, `${baseName(it.file.name)}.${it.ext}`);
      await new Promise((r) => setTimeout(r, 250));
    }
  });

  $('#clear', root).addEventListener('click', () => {
    items.forEach((it) => URL.revokeObjectURL(it.url));
    items = [];
    const rows = $$('.conv', list);
    rows.forEach((r, i) =>
      r.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(24px)' }], { duration: 260, delay: i * 30, fill: 'forwards' }),
    );
    setTimeout(() => rows.forEach((r) => r.remove()), 300 + rows.length * 30);
    $('#actions', root).hidden = true;
  });

  return () => {
    dz.destroy();
    items.forEach((it) => URL.revokeObjectURL(it.url));
  };
}
