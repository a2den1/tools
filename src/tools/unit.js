import { $, seg, segHTML, esc, copyText } from '../ui.js';

const U = {
  length: {
    name: '길이',
    units: [['mm', '밀리미터', 0.001], ['cm', '센티미터', 0.01], ['m', '미터', 1], ['km', '킬로미터', 1000], ['in', '인치', 0.0254], ['ft', '피트', 0.3048], ['yd', '야드', 0.9144], ['mi', '마일', 1609.344], ['nmi', '해리', 1852], ['자', '자', 10 / 33]],
    def: 'cm',
  },
  weight: {
    name: '무게',
    units: [['mg', '밀리그램', 1e-6], ['g', '그램', 0.001], ['kg', '킬로그램', 1], ['t', '톤', 1000], ['oz', '온스', 0.028349523125], ['lb', '파운드', 0.45359237], ['근', '근', 0.6], ['돈', '돈', 0.00375]],
    def: 'kg',
  },
  temp: { name: '온도', units: [['°C', '섭씨'], ['°F', '화씨'], ['K', '켈빈']], def: '°C' },
  area: {
    name: '넓이',
    units: [['cm²', '제곱센티미터', 1e-4], ['m²', '제곱미터', 1], ['평', '평', 400 / 121], ['a', '아르', 100], ['ha', '헥타르', 1e4], ['km²', '제곱킬로미터', 1e6], ['ft²', '제곱피트', 0.09290304], ['ac', '에이커', 4046.8564224]],
    def: '평',
  },
  volume: {
    name: '부피',
    units: [['mL', '밀리리터', 0.001], ['L', '리터', 1], ['m³', '세제곱미터', 1000], ['cup', '컵(US)', 0.2365882365], ['fl oz', '액량 온스', 0.0295735295625], ['gal', '갤런(US)', 3.785411784], ['되', '되', 1.8039]],
    def: 'L',
  },
  speed: {
    name: '속도',
    units: [['m/s', '초속', 1], ['km/h', '시속', 1 / 3.6], ['mph', '마일/시', 0.44704], ['kn', '노트', 1852 / 3600], ['Mach', '마하', 340.29]],
    def: 'km/h',
  },
  data: {
    name: '데이터',
    units: [['bit', '비트', 0.125], ['B', '바이트', 1], ['KB', '킬로바이트', 1e3], ['MB', '메가바이트', 1e6], ['GB', '기가바이트', 1e9], ['TB', '테라바이트', 1e12], ['KiB', '키비바이트', 1024], ['MiB', '메비바이트', 1024 ** 2], ['GiB', '기비바이트', 1024 ** 3], ['TiB', '테비바이트', 1024 ** 4]],
    def: 'GB',
  },
  time: {
    name: '시간',
    units: [['ms', '밀리초', 0.001], ['s', '초', 1], ['min', '분', 60], ['h', '시간', 3600], ['d', '일', 86400], ['wk', '주', 604800], ['yr', '년', 31536000]],
    def: 'h',
  },
};

const toK = { '°C': (v) => v + 273.15, '°F': (v) => ((v - 32) * 5) / 9 + 273.15, K: (v) => v };
const fromK = { '°C': (k) => k - 273.15, '°F': (k) => ((k - 273.15) * 9) / 5 + 32, K: (k) => k };

function fmt(v) {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-6 || a >= 1e15)) return v.toExponential(4);
  return (+v.toPrecision(10)).toLocaleString('ko-KR', { maximumFractionDigits: 8 });
}

export default function (root) {
  root.innerHTML = `
    ${segHTML(Object.entries(U).map(([k, x]) => [k, x.name]), 'length')}
    <div class="row" style="flex-wrap:nowrap">
      <input class="field mono grow" id="val" type="number" value="1" step="any" style="height:60px;font-size:22px">
      <select class="field" id="from" style="width:auto;height:60px;min-width:120px"></select>
    </div>
    <div class="outs" id="list"></div>`;
  const val = $('#val', root);
  const from = $('#from', root);
  const list = $('#list', root);
  const cat = seg($('.seg', root), () => fill(true));

  function fill(anim) {
    const c = U[cat.value];
    from.innerHTML = c.units.map(([k, n]) => `<option value="${esc(k)}">${esc(n)} (${esc(k)})</option>`).join('');
    from.value = c.def;
    calc(anim);
  }

  function calc(anim) {
    const c = U[cat.value];
    const v = parseFloat(val.value);
    const src = from.value;
    list.innerHTML = c.units
      .filter(([k]) => k !== src)
      .map(([k, n, f], i) => {
        let out;
        if (cat.value === 'temp') out = fromK[k](toK[src](v));
        else out = (v * c.units.find((u) => u[0] === src)[2]) / f;
        return `<div class="out click" data-u="${esc(k)}" data-v="${Number.isFinite(out) ? out : ''}" style="${anim ? `animation:rise .5s var(--ease) both;animation-delay:${i * 30}ms` : ''}">
          <span class="k">${esc(n)}</span><b class="v mono" style="font-size:17px">${fmt(out)}</b><span class="muted mono" style="padding-right:12px">${esc(k)}</span>
        </div>`;
      })
      .join('');
  }

  val.addEventListener('input', () => calc(false));
  from.addEventListener('change', () => calc(true));
  list.addEventListener('click', (e) => {
    const row = e.target.closest('[data-u]');
    if (!row || !row.dataset.v) return;
    copyText(`${+(+row.dataset.v).toPrecision(10)}`);
  });
  fill(false);
}
