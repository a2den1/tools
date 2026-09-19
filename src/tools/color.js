import { $, esc, copyText, debounce } from '../ui.js';
import { parseColor, formats, hexToRgb, rgbToHex, rgbToHsl, hslToRgb, contrast, readableOn } from './color-util.js';

export default function (root) {
  root.innerHTML = `
    <div class="split">
      <div class="stack">
        <label class="color-big" id="big"><input type="color" id="pick" value="#0a6cff"><span id="big-t"></span></label>
        <input class="field mono" id="txt" value="#0A6CFF" spellcheck="false" autocomplete="off" aria-label="색 입력" style="height:54px;font-size:17px">
      </div>
      <div class="outs" id="fmts"></div>
    </div>
    <div class="stack" style="gap:10px">
      <span class="label" style="margin:0">명도 단계</span>
      <div class="scale" id="scale"></div>
    </div>
    <div class="two" id="contrast"></div>`;

  const big = $('#big', root);
  const pick = $('#pick', root);
  const txt = $('#txt', root);

  function set(hex, { fromText = false } = {}) {
    const rgb = hexToRgb(hex);
    big.style.background = hex;
    big.style.color = readableOn(rgb);
    $('#big-t', root).textContent = hex.toUpperCase();
    pick.value = hex;
    if (!fromText) txt.value = hex.toUpperCase();
    $('#fmts', root).innerHTML = formats(hex)
      .map(([k, v]) => `<div class="out click" data-v="${esc(v)}"><span class="k">${k}</span><span class="v mono">${esc(v)}</span><i class="fa-regular fa-copy muted" style="padding:0 12px"></i></div>`)
      .join('');
    const [h, s] = rgbToHsl(rgb);
    const steps = [95, 88, 78, 66, 55, 45, 36, 28, 20, 12];
    $('#scale', root).innerHTML = steps
      .map((l, i) => {
        const c = rgbToHex(hslToRgb([h, s, l]));
        return `<button class="scale-c" data-h="${c}" style="background:${c};color:${readableOn(hexToRgb(c))};--i:${i}"><span>${[50, 100, 200, 300, 400, 500, 600, 700, 800, 900][i]}</span></button>`;
      })
      .join('');
    $('#contrast', root).innerHTML = [
      ['#ffffff', '흰 배경'],
      ['#000000', '검정 배경'],
    ]
      .map(([bg, name]) => {
        const r = contrast(rgb, hexToRgb(bg));
        const grade = r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA 큰 글자' : '부족';
        return `<div class="ct" style="background:${bg};color:${hex}">
          <b>가나다 Aa</b>
          <span style="color:${bg === '#ffffff' ? '#475467' : '#aab2c0'}">${name} · ${r.toFixed(2)} : 1 · ${grade}</span>
        </div>`;
      })
      .join('');
  }

  pick.addEventListener('input', () => set(pick.value));
  txt.addEventListener(
    'input',
    debounce(() => {
      const hex = parseColor(txt.value);
      if (hex) set(hex, { fromText: true });
    }, 120),
  );
  root.addEventListener('click', (e) => {
    const row = e.target.closest('[data-v]');
    if (row) {
      copyText(row.dataset.v);
      row.animate([{ transform: 'scale(.97)' }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    }
    const c = e.target.closest('[data-h]');
    if (c) set(c.dataset.h);
  });
  set('#0a6cff');
}
