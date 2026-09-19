import { $, esc, copyText, toast, loadImage } from '../ui.js';
import { formats, hexToRgb, readableOn } from './color-util.js';

const KEY = 'tools.eyedropper.history';
const loadHist = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
};
const saveHist = (h) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(h));
  } catch {}
};

// 캔버스를 전체 화면에 띄우고 돋보기로 한 픽셀을 고르게 한다
function pickFromCanvas(src) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'ed-overlay';
    ov.innerHTML = `
      <canvas class="ed-shot"></canvas>
      <div class="ed-loupe" hidden><canvas width="154" height="154"></canvas><span></span></div>
      <button class="icon-btn ed-close" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button>`;
    document.body.append(ov);
    const shot = $('.ed-shot', ov);
    shot.width = src.width;
    shot.height = src.height;
    const sg = shot.getContext('2d', { willReadFrequently: true });
    sg.drawImage(src, 0, 0);
    const loupe = $('.ed-loupe', ov);
    const lc = $('canvas', loupe);
    const lg = lc.getContext('2d');
    lg.imageSmoothingEnabled = false;
    const label = $('span', loupe);
    const N = 11;
    const at = (e) => {
      const r = shot.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * shot.width);
      const y = Math.floor(((e.clientY - r.top) / r.height) * shot.height);
      return x >= 0 && y >= 0 && x < shot.width && y < shot.height ? [x, y] : null;
    };
    const hexAt = ([x, y]) => '#' + [...sg.getImageData(x, y, 1, 1).data.slice(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join('');
    const done = (v) => {
      removeEventListener('keydown', onKey);
      ov.classList.add('out');
      setTimeout(() => ov.remove(), 250);
      resolve(v);
    };
    const onKey = (e) => e.key === 'Escape' && done(null);
    addEventListener('keydown', onKey);
    ov.addEventListener('pointermove', (e) => {
      const p = at(e);
      loupe.hidden = !p;
      if (!p) return;
      lg.clearRect(0, 0, 154, 154);
      lg.drawImage(shot, p[0] - (N >> 1), p[1] - (N >> 1), N, N, 0, 0, 154, 154);
      const hex = hexAt(p);
      label.textContent = hex.toUpperCase();
      label.style.background = hex;
      label.style.color = readableOn(hexToRgb(hex));
      const flip = e.clientX > innerWidth - 200;
      loupe.style.transform = `translate(${e.clientX + (flip ? -184 : 24)}px, ${Math.min(e.clientY + 24, innerHeight - 200)}px)`;
    });
    ov.addEventListener('click', (e) => {
      if (e.target.closest('.ed-close')) return done(null);
      const p = at(e);
      if (p) done(hexAt(p));
    });
  });
}

async function captureScreen() {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' }, audio: false });
  try {
    const v = document.createElement('video');
    v.srcObject = stream;
    v.muted = true;
    await v.play();
    await new Promise((r) => (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(() => r()) : setTimeout(r, 300)));
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    return c;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

export default function (root) {
  const native = 'EyeDropper' in window;
  const canCapture = !!navigator.mediaDevices?.getDisplayMedia;
  let hist = loadHist();
  let current = hist[0] || '#0a6cff';

  root.innerHTML = `
    <div class="ed-hero" id="sw">
      <div class="ed-hex" id="hex"></div>
      <div class="row ed-actions">
        ${native || canCapture ? `<button class="btn dark ed-pick" id="pick"><i class="fa-solid fa-eye-dropper"></i>화면에서 색 고르기</button>` : ''}
        <button class="btn soft ed-img" id="img"><i class="fa-regular fa-image"></i>이미지에서</button>
      </div>
    </div>
    <div class="outs" id="fmts"></div>
    <div class="stack" id="hist-wrap" style="gap:10px">
      <div class="row between"><span class="label" style="margin:0">최근</span><button class="btn soft sm" id="clear"><i class="fa-solid fa-trash-can"></i>비우기</button></div>
      <div class="swatches" id="hist"></div>
    </div>
    <input type="file" id="file" accept="image/*" hidden>`;

  const sw = $('#sw', root);
  const fileInput = $('#file', root);

  function show(hex, from) {
    current = hex;
    const rgb = hexToRgb(hex);
    const fg = readableOn(rgb);
    // 새 색이 원으로 번지며 덮인다
    const r = sw.getBoundingClientRect();
    const fr = from?.getBoundingClientRect?.();
    const cx = fr ? fr.left + fr.width / 2 - r.left : r.width / 2;
    const cy = fr ? fr.top + fr.height / 2 - r.top : r.height / 2;
    const ink = document.createElement('i');
    ink.className = 'ed-ink';
    ink.style.cssText = `left:${cx}px;top:${cy}px;background:${hex}`;
    sw.prepend(ink);
    const size = Math.hypot(Math.max(cx, r.width - cx), Math.max(cy, r.height - cy)) * 2;
    ink.animate([{ width: '0px', height: '0px' }, { width: size + 'px', height: size + 'px' }], { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
    setTimeout(() => {
      sw.style.background = hex;
      ink.remove();
    }, 660);
    sw.style.setProperty('--fg', fg);
    const hx = $('#hex', root);
    hx.textContent = hex.toUpperCase();
    hx.animate([{ opacity: 0, transform: 'translateY(10px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.22,1,.36,1)' });
    $('#fmts', root).innerHTML = formats(hex)
      .map(([k, v]) => `<div class="out click" data-v="${esc(v)}"><span class="k">${k}</span><span class="v mono">${esc(v)}</span><button class="icon-btn" aria-label="복사"><i class="fa-regular fa-copy"></i></button></div>`)
      .join('');
  }

  function add(hex, from) {
    hist = [hex, ...hist.filter((h) => h !== hex)].slice(0, 30);
    saveHist(hist);
    show(hex, from);
    renderHist();
    copyText(hex.toUpperCase());
  }

  function renderHist() {
    $('#hist-wrap', root).hidden = !hist.length;
    $('#hist', root).innerHTML = hist.map((h, i) => `<button class="sw-dot" data-h="${h}" style="--dot:${h};--i:${i}" title="${h.toUpperCase()}"></button>`).join('');
  }

  $('#pick', root)?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    try {
      if (native) {
        const r = await new window.EyeDropper().open();
        if (r?.sRGBHex) add(parseHexish(r.sRGBHex), btn);
      } else {
        const shot = await captureScreen();
        const hex = await pickFromCanvas(shot);
        if (hex) add(hex, btn);
      }
    } catch (err) {
      if (err?.name !== 'AbortError' && err?.name !== 'NotAllowedError') toast('색을 고르지 못했어요', 'fa-circle-exclamation');
    }
  });

  $('#img', root).addEventListener('click', () => fileInput.click());
  const pickImage = async (file) => {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const hex = await pickFromCanvas(c);
      if (hex) add(hex, $('#img', root));
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (f) pickImage(f);
  });
  const onPaste = (e) => {
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f && root.isConnected) pickImage(f);
  };
  document.addEventListener('paste', onPaste);

  $('#fmts', root).addEventListener('click', async (e) => {
    const row = e.target.closest('[data-v]');
    if (!row) return;
    await copyText(row.dataset.v);
    const b = $('button', row);
    b.classList.add('done');
    b.innerHTML = '<i class="fa-solid fa-check"></i>';
    setTimeout(() => {
      b.classList.remove('done');
      b.innerHTML = '<i class="fa-regular fa-copy"></i>';
    }, 1200);
  });
  $('#hist', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-h]');
    if (b) show(b.dataset.h, b);
  });
  $('#clear', root).addEventListener('click', () => {
    hist = [];
    saveHist(hist);
    renderHist();
  });

  sw.style.background = current;
  show(current);
  renderHist();

  const onKey = (e) => {
    if (e.target.closest?.('input, textarea')) return;
    if (e.key.toLowerCase() === 'i') $('#pick', root)?.click();
  };
  addEventListener('keydown', onKey);
  return () => {
    document.removeEventListener('paste', onPaste);
    removeEventListener('keydown', onKey);
  };
}

function parseHexish(s) {
  if (s.startsWith('#')) return s.toLowerCase();
  const m = s.match(/\d+/g);
  return '#' + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('');
}
