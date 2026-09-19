export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const debounce = (fn, ms = 150) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function fmtBytes(n) {
  if (!Number.isFinite(n)) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i && n < 10 ? 1 : 0)} ${u[i]}`;
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

// ---------- toast ----------
let toastWrap;
export function toast(msg, icon = 'fa-check') {
  if (!toastWrap) {
    toastWrap = document.createElement('div');
    toastWrap.className = 'toasts';
    document.body.append(toastWrap);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<i class="fa-solid ${icon}"></i><span>${esc(msg)}</span>`;
  toastWrap.append(t);
  while (toastWrap.children.length > 3) toastWrap.firstChild.remove();
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 400);
  }, 2000);
}

// ---------- clipboard ----------
export async function copyText(text) {
  if (!text) {
    toast('복사할 내용이 없어요', 'fa-circle-info');
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('복사됨');
  return true;
}

export function flashDone(btn) {
  const i = btn.querySelector('i');
  if (!i) return;
  btn.dataset.icon ??= i.className;
  i.className = 'fa-solid fa-check';
  btn.classList.add('done');
  clearTimeout(btn._t);
  btn._t = setTimeout(() => {
    i.className = btn.dataset.icon;
    btn.classList.remove('done');
  }, 1300);
}

export const copyBtn = (target) =>
  `<button type="button" class="icon-btn" data-copy="${esc(target)}" aria-label="복사"><i class="fa-regular fa-copy"></i></button>`;

// data-copy="#selector" → 그 요소의 value / textContent 를 복사
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copy]');
  if (!b) return;
  const sel = b.dataset.copy;
  const el = sel ? (b.closest('.tool') || document).querySelector(sel) : null;
  const text = b._text ?? (el ? (el.matches('input, textarea, select') ? el.value : el.textContent) : '');
  if (await copyText(text)) flashDone(b);
});

// ---------- segmented control ----------
export function seg(el, onChange) {
  const ind = document.createElement('span');
  ind.className = 'seg-ind';
  el.prepend(ind);
  const btns = $$('button', el);
  let value = (btns.find((b) => b.classList.contains('on')) || btns[0]).dataset.v;
  const place = (animate) => {
    const b = btns.find((x) => x.dataset.v === value);
    btns.forEach((x) => x.classList.toggle('on', x === b));
    if (!b || !b.offsetWidth) return;
    if (!animate) ind.style.transition = 'none';
    ind.style.width = b.offsetWidth + 'px';
    ind.style.transform = `translateX(${b.offsetLeft}px)`;
    if (!animate) {
      ind.offsetWidth;
      ind.style.transition = '';
    }
  };
  const set = (v, fire = true) => {
    if (v === value) return;
    value = v;
    place(true);
    const b = btns.find((x) => x.dataset.v === v);
    b?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    if (fire) onChange?.(v);
  };
  btns.forEach((b) => (b.type = 'button'));
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && btns.includes(b)) set(b.dataset.v);
  });
  new ResizeObserver(() => place(false)).observe(el);
  requestAnimationFrame(() => place(false));
  place(false);
  return {
    get value() {
      return value;
    },
    set,
  };
}

export const segHTML = (items, on, cls = '') =>
  `<div class="seg ${cls}">${items
    .map(([v, label]) => `<button type="button" data-v="${esc(v)}" class="${v === on ? 'on' : ''}">${label}</button>`)
    .join('')}</div>`;

// ---------- switch / range ----------
export const sw = (id, label, checked = false) =>
  `<label class="sw"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}><span class="track"></span><span>${label}</span></label>`;

export const range = (id, label, min, max, value, step = 1, suffix = '') =>
  `<div class="range"><div class="range-top"><span>${label}</span><output data-for="${id}" data-suffix="${esc(suffix)}">${value}${suffix}</output></div><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;

export function paintRange(r) {
  const min = +r.min || 0;
  const max = +r.max || 100;
  r.style.setProperty('--p', ((r.value - min) / (max - min)) * 100 + '%');
  const o = r.closest('.range')?.querySelector(`output[data-for="${r.id}"]`);
  if (o) o.textContent = r.value + (o.dataset.suffix || '');
}

export function paintRanges(root) {
  $$('input[type=range]', root).forEach(paintRange);
}

document.addEventListener('input', (e) => {
  if (e.target.matches?.('input[type=range]')) paintRange(e.target);
});

// 한 프레임에 한 번만 실행 (rAF 가 멈춘 탭에서도 setTimeout 으로 실행)
export function frameThrottle(fn) {
  let pending = false;
  const run = () => {
    if (!pending) return;
    pending = false;
    fn();
  };
  return () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(run);
    setTimeout(run, 50);
  };
}

// ---------- small motion helpers ----------
export function pop(el) {
  if (!el) return;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

export function countTo(el, to, fmt = (n) => Math.round(n).toLocaleString('ko-KR')) {
  const from = el._v ?? 0;
  el._v = to;
  const tok = (el._tok = (el._tok || 0) + 1);
  if (from === to) {
    el.textContent = fmt(to);
    return;
  }
  const t0 = performance.now();
  const dur = 420;
  const step = (now) => {
    if (tok !== el._tok) return;
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  // 탭이 가려져 rAF 가 멈춰도 최종값은 반드시 보이게
  setTimeout(() => tok === el._tok && (el.textContent = fmt(to)), dur + 60);
}

// ---------- files ----------
export function download(data, name) {
  const url = typeof data === 'string' ? data : URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  if (typeof data !== 'string') setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export const baseName = (name) => name.replace(/\.[^.]+$/, '');

// 드롭존: 클릭·드래그·붙여넣기로 파일 받기
export function dropzone(el, onFiles, { accept = '', multiple = false } = {}) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = multiple;
  input.hidden = true;
  el.append(input);
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  const take = (list) => {
    const files = [...list].filter((f) => !accept || accept.split(',').some((a) => matchAccept(f, a.trim())));
    if (files.length) onFiles(multiple ? files : [files[0]]);
    else if (list.length) toast('지원하지 않는 파일이에요', 'fa-circle-exclamation');
  };
  el.addEventListener('click', (e) => e.target !== input && input.click());
  el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.click()));
  input.addEventListener('change', () => {
    take(input.files);
    input.value = '';
  });
  let depth = 0;
  el.addEventListener('dragenter', (e) => {
    e.preventDefault();
    depth++;
    el.classList.add('over');
  });
  el.addEventListener('dragover', (e) => e.preventDefault());
  el.addEventListener('dragleave', () => --depth <= 0 && ((depth = 0), el.classList.remove('over')));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    el.classList.remove('over');
    take(e.dataTransfer.files);
  });
  const onPaste = (e) => {
    if (!el.isConnected) return;
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) {
      e.preventDefault();
      take(files);
    }
  };
  document.addEventListener('paste', onPaste);
  return {
    open: () => input.click(),
    destroy: () => document.removeEventListener('paste', onPaste),
  };
}

function matchAccept(file, a) {
  if (!a) return true;
  if (a.endsWith('/*')) return file.type.startsWith(a.slice(0, -1));
  if (a.startsWith('.')) return file.name.toLowerCase().endsWith(a.toLowerCase());
  return file.type === a;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 열 수 없어요'));
    img.src = src;
  });
}

export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('변환 실패'))), type, quality),
  );
}
