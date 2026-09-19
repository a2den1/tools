import { $, seg, segHTML, download, baseName, toast, fmtBytes } from '../ui.js';
import { imageFlow, fileInfo, compare, toCanvas } from './img-common.js';

const MODELS = {
  'slim-2': () => import('@upscalerjs/esrgan-slim/2x'),
  'slim-4': () => import('@upscalerjs/esrgan-slim/4x'),
  'medium-2': () => import('@upscalerjs/esrgan-medium/2x'),
  'medium-4': () => import('@upscalerjs/esrgan-medium/4x'),
};
const MAX_OUT = 4096;

export default function (root) {
  let upscaler = null;
  let upKey = '';
  let busy = false;
  let alive = true;

  const flow = imageFlow(root, show);

  function show({ file, img, url }) {
    if (busy) upscaler?.abort();
    root.innerHTML = `
      <div class="panel stack">
        <div class="row between">${fileInfo(file, img)}<button class="icon-btn" id="again" aria-label="다른 이미지"><i class="fa-solid fa-rotate"></i></button></div>
        <div class="row">
          ${segHTML([['2', '2배'], ['4', '4배']], '2')}
          ${segHTML([['medium', '선명하게'], ['slim', '빠르게']], 'medium')}
          <span class="grow"></span>
          <b class="mono" id="size"></b>
        </div>
        <div id="prog" hidden class="stack" style="gap:8px">
          <div class="row between"><span class="muted" id="prog-t">모델 불러오는 중</span><b class="mono" id="prog-p"></b></div>
          <div class="bar"><i></i></div>
        </div>
        <button class="btn wide" id="go" style="height:54px"><i class="fa-solid fa-wand-magic-sparkles"></i>업스케일</button>
      </div>
      <div id="res"><div class="preview checker"><img src="${url}" alt=""></div></div>`;
    $('#again', root).addEventListener('click', () => flow.open());

    const [scaleSeg, modelSeg] = [...root.querySelectorAll('.seg')].map((s) => seg(s, sizeText));
    const sizeEl = $('#size', root);
    function plan() {
      const k = +scaleSeg.value;
      const shrink = Math.min(1, MAX_OUT / (Math.max(img.naturalWidth, img.naturalHeight) * k));
      return { k, shrink, w: Math.round(img.naturalWidth * shrink) * k, h: Math.round(img.naturalHeight * shrink) * k };
    }
    function sizeText() {
      const p = plan();
      sizeEl.textContent = `${p.w}×${p.h}`;
    }
    sizeText();

    $('#go', root).addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      const go = $('#go', root);
      const prog = $('#prog', root);
      const bar = prog.querySelector('.bar');
      go.disabled = true;
      go.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>처리 중`;
      prog.hidden = false;
      bar.classList.add('indeterminate');
      $('#prog-t', root).textContent = '모델 불러오는 중';
      $('#prog-p', root).textContent = '';
      try {
        const p = plan();
        if (p.shrink < 1) toast(`결과가 ${MAX_OUT}px 을 넘지 않게 줄여서 처리해요`, 'fa-circle-info');
        const key = `${modelSeg.value}-${p.k}`;
        if (key !== upKey) {
          await upscaler?.dispose();
          const [{ default: Upscaler }, m] = await Promise.all([import('upscaler'), MODELS[key]()]);
          upscaler = new Upscaler({ model: m.default });
          upKey = key;
        }
        await upscaler.getModel();
        if (!alive) return;
        $('#prog-t', root).textContent = '업스케일 중';
        bar.classList.remove('indeterminate');
        const src = toCanvas(img, Math.max(img.naturalWidth, img.naturalHeight) * p.shrink);
        const t0 = performance.now();
        const out = await upscaler.upscale(src, {
          patchSize: 64,
          padding: 6,
          awaitNextFrame: true,
          progress: (r) => {
            if (!alive) return;
            bar.firstElementChild.style.width = r * 100 + '%';
            $('#prog-p', root).textContent = Math.round(r * 100) + '%';
          },
        });
        if (!alive) return;
        const blob = await (await fetch(out)).blob();
        const resUrl = URL.createObjectURL(blob);
        compare($('#res', root), url, resUrl);
        $('#res', root).insertAdjacentHTML(
          'beforeend',
          `<div class="row" style="margin-top:14px">
            <span class="muted grow">${p.w}×${p.h} · ${fmtBytes(blob.size)} · ${((performance.now() - t0) / 1000).toFixed(1)}초</span>
            <button class="btn good" id="save"><i class="fa-solid fa-download"></i>PNG 저장</button>
          </div>`,
        );
        $('#save', root).addEventListener('click', () => download(blob, `${baseName(file.name)}_x${p.k}.png`));
        prog.hidden = true;
      } catch (e) {
        if (alive && e?.name !== 'AbortError') toast(e.message || '업스케일에 실패했어요', 'fa-circle-exclamation');
        prog.hidden = true;
      } finally {
        busy = false;
        if (alive) {
          go.disabled = false;
          go.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i>다시 업스케일`;
        }
      }
    });
  }

  return () => {
    alive = false;
    flow.destroy();
    try {
      upscaler?.abort();
    } catch {}
    upscaler?.dispose();
  };
}
