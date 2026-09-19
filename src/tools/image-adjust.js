import { $, $$, range, paintRange, seg, segHTML, canvasToBlob, download, baseName, frameThrottle } from '../ui.js';
import { imageFlow, fileInfo } from './img-common.js';

const SLIDERS = [
  ['brightness', '밝기', 0, 200, 100, '%'],
  ['contrast', '대비', 0, 200, 100, '%'],
  ['saturate', '채도', 0, 200, 100, '%'],
  ['hue', '색조', -180, 180, 0, '°'],
  ['temp', '색온도', -100, 100, 0, ''],
  ['grayscale', '흑백', 0, 100, 0, '%'],
  ['sepia', '세피아', 0, 100, 0, '%'],
  ['blur', '흐림', 0, 20, 0, 'px'],
  ['vignette', '비네트', 0, 100, 0, '%'],
];
const DEFAULTS = Object.fromEntries(SLIDERS.map((s) => [s[0], s[4]]));
const PRESETS = [
  ['원본', {}],
  ['선명', { contrast: 125, saturate: 125, brightness: 104 }],
  ['따뜻하게', { temp: 45, saturate: 112, brightness: 104 }],
  ['차갑게', { temp: -45, contrast: 108 }],
  ['흑백', { grayscale: 100, contrast: 118 }],
  ['빈티지', { sepia: 45, contrast: 90, brightness: 108, saturate: 80, vignette: 45 }],
  ['드라마틱', { contrast: 145, saturate: 70, brightness: 92, vignette: 60 }],
  ['팝', { saturate: 170, contrast: 115, hue: 8 }],
];

function paint(canvas, img, scale, p) {
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, w, h);
  g.filter = [
    `brightness(${p.brightness}%)`,
    `contrast(${p.contrast}%)`,
    `saturate(${p.saturate}%)`,
    `hue-rotate(${p.hue}deg)`,
    `grayscale(${p.grayscale}%)`,
    `sepia(${p.sepia}%)`,
    p.blur ? `blur(${p.blur * scale}px)` : '',
  ].join(' ');
  g.drawImage(img, 0, 0, w, h);
  g.filter = 'none';
  if (p.temp) {
    const d = g.getImageData(0, 0, w, h);
    const a = d.data;
    const f = p.temp * 0.35;
    for (let i = 0; i < a.length; i += 4) {
      a[i] += f;
      a[i + 1] += f * 0.1;
      a[i + 2] -= f;
    }
    g.putImageData(d, 0, 0);
  }
  if (p.vignette) {
    const r = Math.hypot(w, h) / 2;
    const grad = g.createRadialGradient(w / 2, h / 2, r * 0.35, w / 2, h / 2, r);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${(p.vignette / 100) * 0.85})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }
}

export default function (root) {
  let tween = 0;
  const flow = imageFlow(root, show);

  function show({ file, img, url }) {
    const p = { ...DEFAULTS };
    root.innerHTML = `
      <div class="split">
        <div class="stack" style="position:sticky;top:92px">
          <div class="preview checker adj-view">
            <canvas id="cv"></canvas>
            <img id="orig" src="${url}" alt="" hidden>
            <button class="hold" id="hold"><i class="fa-regular fa-eye"></i>원본</button>
          </div>
          <div class="row between">${fileInfo(file, img)}<button class="icon-btn" id="again" aria-label="다른 이미지"><i class="fa-solid fa-rotate"></i></button></div>
        </div>
        <div class="stack">
          <div class="chips" id="presets">${PRESETS.map(([n], i) => `<button class="chip${i === 0 ? ' on' : ''}" data-i="${i}">${n}</button>`).join('')}</div>
          <div class="panel stack" style="gap:18px">${SLIDERS.map(([k, l, a, b, v, s]) => range(k, l, a, b, v, 1, s)).join('')}</div>
          <div class="row">
            ${segHTML([['image/png', 'PNG'], ['image/jpeg', 'JPG']], 'image/png')}
            <span class="grow"></span>
            <button class="btn good" id="save"><i class="fa-solid fa-download"></i>저장</button>
          </div>
        </div>
      </div>`;
    const cv = $('#cv', root);
    const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    const out = seg($('.seg', root));
    const draw = frameThrottle(() => paint(cv, img, scale, p));
    paint(cv, img, scale, p);
    $$('input[type=range]', root).forEach(paintRange);

    $('.split', root).addEventListener('input', (e) => {
      if (!e.target.matches('input[type=range]')) return;
      tween++;
      p[e.target.id] = +e.target.value;
      $$('#presets .chip', root).forEach((c) => c.classList.remove('on'));
      draw();
    });

    // 프리셋을 누르면 슬라이더가 목표값까지 부드럽게 움직인다
    $('#presets', root).addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      $$('#presets .chip', root).forEach((c) => c.classList.toggle('on', c === chip));
      const target = { ...DEFAULTS, ...PRESETS[+chip.dataset.i][1] };
      const from = { ...p };
      const tok = ++tween;
      const t0 = performance.now();
      const step = (now) => {
        if (tok !== tween) return;
        const k = Math.min(1, (now - t0) / 450);
        const e2 = 1 - Math.pow(1 - k, 3);
        for (const key in target) {
          p[key] = Math.round(from[key] + (target[key] - from[key]) * e2);
          const r = $('#' + key, root);
          r.value = p[key];
          paintRange(r);
        }
        paint(cv, img, scale, p);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      setTimeout(() => {
        if (tok !== tween) return;
        Object.assign(p, target);
        for (const key in target) {
          const r = $('#' + key, root);
          r.value = p[key];
          paintRange(r);
        }
        paint(cv, img, scale, p);
      }, 520);
    });

    const hold = $('#hold', root);
    const orig = $('#orig', root);
    const on = (v) => {
      orig.hidden = !v;
      cv.hidden = v;
      hold.classList.toggle('on', v);
    };
    hold.addEventListener('pointerdown', () => on(true));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => hold.addEventListener(ev, () => on(false)));

    $('#again', root).addEventListener('click', () => flow.open());
    $('#save', root).addEventListener('click', async () => {
      const c = document.createElement('canvas');
      paint(c, img, 1, p);
      let src = c;
      if (out.value === 'image/jpeg') {
        src = document.createElement('canvas');
        src.width = c.width;
        src.height = c.height;
        const g = src.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(c, 0, 0);
      }
      const blob = await canvasToBlob(src, out.value, 0.92);
      download(blob, `${baseName(file.name)}_보정.${out.value === 'image/png' ? 'png' : 'jpg'}`);
    });
  }

  return () => {
    tween++;
    flow.destroy();
  };
}
