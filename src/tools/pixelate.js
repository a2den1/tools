import { $, range, paintRanges, seg, segHTML, sw, canvasToBlob, download, baseName, frameThrottle } from '../ui.js';
import { imageFlow, fileInfo } from './img-common.js';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const PALETTES = {
  pico: ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'].map(hex),
  gb: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'].map(hex),
  mono: ['#000000', '#ffffff'].map(hex),
};

function nearest(pal, r, g, b) {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < pal.length; i++) {
    const p = pal[i];
    const d = (p[0] - r) ** 2 * 0.3 + (p[1] - g) ** 2 * 0.59 + (p[2] - b) ** 2 * 0.11;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return pal[best];
}

// 작은 이미지에서 k-means 로 대표색 뽑기
function kmeans(data, k) {
  const px = [];
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 10) px.push([data[i], data[i + 1], data[i + 2]]);
  if (!px.length) return [[0, 0, 0]];
  const step = Math.max(1, Math.floor(px.length / 4000));
  const sample = px.filter((_, i) => i % step === 0);
  let cents = Array.from({ length: k }, (_, i) => [...sample[Math.floor(((i + 0.5) * sample.length) / k)]]);
  for (let it = 0; it < 10; it++) {
    const sum = cents.map(() => [0, 0, 0, 0]);
    for (const p of sample) {
      let bi = 0;
      let bd = Infinity;
      for (let c = 0; c < cents.length; c++) {
        const d = (cents[c][0] - p[0]) ** 2 + (cents[c][1] - p[1]) ** 2 + (cents[c][2] - p[2]) ** 2;
        if (d < bd) {
          bd = d;
          bi = c;
        }
      }
      const s = sum[bi];
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
      s[3]++;
    }
    cents = sum.map((s, i) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : cents[i]));
  }
  return cents.map((c) => c.map(Math.round));
}

function pixelate(img, o) {
  const w = Math.max(1, Math.round(img.naturalWidth / o.size));
  const h = Math.max(1, Math.round(img.naturalHeight / o.size));
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const g = small.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, w, h);
  if (o.palette !== 'none') {
    const d = g.getImageData(0, 0, w, h);
    const a = d.data;
    const pal = o.palette === 'auto' ? kmeans(a, o.colors) : PALETTES[o.palette];
    if (o.dither) {
      const buf = new Float32Array(w * h * 3);
      for (let i = 0, j = 0; i < a.length; i += 4, j += 3) {
        buf[j] = a[i];
        buf[j + 1] = a[i + 1];
        buf[j + 2] = a[i + 2];
      }
      const push = (x, y, er, eg, eb, f) => {
        if (x < 0 || x >= w || y >= h) return;
        const j = (y * w + x) * 3;
        buf[j] += er * f;
        buf[j + 1] += eg * f;
        buf[j + 2] += eb * f;
      };
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const j = (y * w + x) * 3;
          const [r, gg, b] = [buf[j], buf[j + 1], buf[j + 2]];
          const c = nearest(pal, r, gg, b);
          const i = (y * w + x) * 4;
          a[i] = c[0];
          a[i + 1] = c[1];
          a[i + 2] = c[2];
          const er = r - c[0];
          const eg = gg - c[1];
          const eb = b - c[2];
          push(x + 1, y, er, eg, eb, 7 / 16);
          push(x - 1, y + 1, er, eg, eb, 3 / 16);
          push(x, y + 1, er, eg, eb, 5 / 16);
          push(x + 1, y + 1, er, eg, eb, 1 / 16);
        }
    } else {
      for (let i = 0; i < a.length; i += 4) {
        const c = nearest(pal, a[i], a[i + 1], a[i + 2]);
        a[i] = c[0];
        a[i + 1] = c[1];
        a[i + 2] = c[2];
      }
    }
    g.putImageData(d, 0, 0);
  }
  return small;
}

function upscale(small, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(small, 0, 0, w, h);
  return c;
}

export default function (root) {
  const flow = imageFlow(root, show);

  function show({ file, img }) {
    root.innerHTML = `
      <div class="split">
        <div class="stack" style="position:sticky;top:92px">
          <div class="preview checker"><canvas id="cv" class="pixel"></canvas></div>
          <div class="row between">${fileInfo(file, img)}<button class="icon-btn" id="again" aria-label="다른 이미지"><i class="fa-solid fa-rotate"></i></button></div>
        </div>
        <div class="stack">
          <div class="panel stack" style="gap:18px">
            ${range('size', '픽셀 크기', 2, 64, 10, 1, 'px')}
            <div>
              <span class="label">팔레트</span>
              ${segHTML([['none', '원본'], ['auto', '자동'], ['pico', 'PICO-8'], ['gb', '게임보이'], ['mono', '흑백']], 'none', 'fill')}
            </div>
            <div id="colors-wrap" hidden>${range('colors', '색 수', 2, 32, 8)}</div>
            <div id="dither-wrap" hidden>${sw('dither', '디더링')}</div>
          </div>
          <div class="panel row between">
            <span class="label" style="margin:0">저장 크기</span>
            ${segHTML([['full', '원본 크기'], ['dot', '1픽셀 = 1칸']], 'full')}
          </div>
          <div class="row end"><b class="mono muted grow" id="dim"></b><button class="btn good" id="save"><i class="fa-solid fa-download"></i>PNG 저장</button></div>
        </div>
      </div>`;
    paintRanges(root);
    const cv = $('#cv', root);
    const segs = root.querySelectorAll('.seg');
    const pal = seg(segs[0], () => {
      $('#colors-wrap', root).hidden = pal.value !== 'auto';
      $('#dither-wrap', root).hidden = pal.value === 'none';
      draw();
    });
    const out = seg(segs[1]);
    const opts = () => ({ size: +$('#size', root).value, palette: pal.value, colors: +$('#colors', root).value, dither: $('#dither', root).checked });
    const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    const draw = frameThrottle(() => {
        const o = opts();
        const small = pixelate(img, o);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        cv.width = w;
        cv.height = h;
        const g = cv.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.drawImage(small, 0, 0, w, h);
        $('#dim', root).textContent = `${small.width}×${small.height}칸`;
    });
    draw();
    $('.split', root).addEventListener('input', draw);
    $('.split', root).addEventListener('change', (e) => e.target.id === 'dither' && draw());
    $('#again', root).addEventListener('click', () => flow.open());
    $('#save', root).addEventListener('click', async () => {
      const small = pixelate(img, opts());
      const c = out.value === 'dot' ? small : upscale(small, img.naturalWidth, img.naturalHeight);
      download(await canvasToBlob(c, 'image/png'), `${baseName(file.name)}_pixel.png`);
    });
  }

  return () => flow.destroy();
}
