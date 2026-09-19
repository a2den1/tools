import { $, $$, esc } from '../ui.js';

// 마인크래프트 기본 16색
export const COLORS = {
  0: ['#000000', 'black', '검정'],
  1: ['#0000AA', 'dark_blue', '진한 파랑'],
  2: ['#00AA00', 'dark_green', '진한 초록'],
  3: ['#00AAAA', 'dark_aqua', '청록'],
  4: ['#AA0000', 'dark_red', '진한 빨강'],
  5: ['#AA00AA', 'dark_purple', '보라'],
  6: ['#FFAA00', 'gold', '금색'],
  7: ['#AAAAAA', 'gray', '회색'],
  8: ['#555555', 'dark_gray', '진한 회색'],
  9: ['#5555FF', 'blue', '파랑'],
  a: ['#55FF55', 'green', '초록'],
  b: ['#55FFFF', 'aqua', '하늘'],
  c: ['#FF5555', 'red', '빨강'],
  d: ['#FF55FF', 'light_purple', '분홍'],
  e: ['#FFFF55', 'yellow', '노랑'],
  f: ['#FFFFFF', 'white', '흰색'],
};
export const FORMATS = [
  ['l', 'b', 'bold', 'fa-bold', '굵게'],
  ['o', 'i', 'italic', 'fa-italic', '기울임'],
  ['n', 'u', 'underlined', 'fa-underline', '밑줄'],
  ['m', 's', 'strikethrough', 'fa-strikethrough', '취소선'],
  ['k', 'k', 'obfuscated', 'fa-shuffle', '난독화'],
];
const EMPTY = { color: null, b: 0, i: 0, u: 0, s: 0, k: 0 };

export const hexOf = (c) => (c == null ? null : c.startsWith('#') ? c : COLORS[c][0]);

// "&a안녕 &l서버" → [{ text, color, b, i, u, s, k }]
export function parse(src) {
  const out = [];
  let st = { ...EMPTY };
  let buf = '';
  const flush = () => {
    if (buf) out.push({ text: buf, ...st });
    buf = '';
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if ((ch === '&' || ch === '§') && i + 1 < src.length) {
      const n = src[i + 1];
      const hex = src.substr(i + 2, 6);
      if (n === '#' && /^[0-9a-fA-F]{6}$/.test(hex)) {
        flush();
        st = { ...EMPTY, color: '#' + hex.toUpperCase() };
        i += 7;
        continue;
      }
      const k = n.toLowerCase();
      if (COLORS[k]) {
        flush();
        st = { ...EMPTY, color: k };
        i++;
        continue;
      }
      const f = FORMATS.find((x) => x[0] === k);
      if (f) {
        flush();
        st = { ...st, [f[1]]: 1 };
        i++;
        continue;
      }
      if (k === 'r') {
        flush();
        st = { ...EMPTY };
        i++;
        continue;
      }
    }
    buf += ch;
  }
  flush();
  return out;
}

export function nearestLegacy(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let best = 'f';
  let bd = Infinity;
  for (const [k, [h]] of Object.entries(COLORS)) {
    const [R, G, B] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const d = (R - r) ** 2 * 0.3 + (G - g) ** 2 * 0.59 + (B - b) ** 2 * 0.11;
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return best;
}

// 레거시 코드 문자열. hex: 'bukkit'(§x§R..) | 'amp'(&#RRGGBB) | 'nearest'(16색 근사)
export function toLegacy(segs, p = '§', hex = 'bukkit') {
  let out = '';
  let prev = { ...EMPTY };
  for (const s of segs) {
    let color = s.color;
    if (color?.startsWith('#') && hex === 'nearest') color = nearestLegacy(color);
    const lost = FORMATS.some(([, f]) => prev[f] && !s[f]);
    let code = '';
    if (color !== prev.color || lost) {
      if (color == null) code += p + 'r';
      else if (color.startsWith('#')) code += hex === 'amp' ? `${p}#${color.slice(1)}` : p + 'x' + [...color.slice(1)].map((c) => p + c.toLowerCase()).join('');
      else code += p + color;
      for (const [c, f] of FORMATS) if (s[f]) code += p + c;
    } else {
      for (const [c, f] of FORMATS) if (s[f] && !prev[f]) code += p + c;
    }
    out += code + s.text;
    prev = { ...s, color };
  }
  return out;
}

export function toMiniMessage(segs) {
  return segs
    .map((s) => {
      const tags = [];
      if (s.color) tags.push(s.color.startsWith('#') ? s.color : COLORS[s.color][1]);
      for (const [, f, name] of FORMATS) if (s[f]) tags.push(name);
      const text = s.text.replace(/[<\\]/g, (c) => '\\' + c).replace(/\n/g, '<newline>');
      if (!tags.length) return text;
      return tags.map((t) => `<${t}>`).join('') + text + [...tags].reverse().map((t) => `</${t}>`).join('');
    })
    .join('');
}

// 텍스트 컴포넌트 객체
export function toComponent(segs) {
  const parts = segs.map((s) => {
    const o = { text: s.text };
    if (s.color) o.color = s.color.startsWith('#') ? s.color : COLORS[s.color][1];
    for (const [, f, name] of FORMATS) if (s[f]) o[name] = true;
    return o;
  });
  if (!parts.length) return { text: '' };
  if (parts.length === 1) return parts[0];
  return { text: '', extra: parts };
}

export function toSNBT(v) {
  if (Array.isArray(v)) return `[${v.map(toSNBT).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.entries(v)
      .map(([k, x]) => `${/^[A-Za-z0-9_.+-]+$/.test(k) ? k : JSON.stringify(k)}:${toSNBT(x)}`)
      .join(',')}}`;
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

// 미리보기 HTML (그림자는 마인크래프트처럼 색의 1/4 밝기)
export function previewHTML(segs) {
  return segs
    .map((s) => {
      const hex = hexOf(s.color) || '#FFFFFF';
      const sh = '#' + [1, 3, 5].map((i) => Math.floor(parseInt(hex.slice(i, i + 2), 16) / 4).toString(16).padStart(2, '0')).join('');
      const deco = [s.u ? 'underline' : '', s.s ? 'line-through' : ''].filter(Boolean).join(' ');
      const style = `color:${hex};--sh:${sh};${s.b ? 'font-weight:700;' : ''}${s.i ? 'font-style:italic;' : ''}${deco ? `text-decoration:${deco};` : ''}`;
      return `<span class="${s.k ? 'mc-obf' : ''}" style="${style}">${esc(s.text).replace(/\n/g, '<br>')}</span>`;
    })
    .join('');
}

// 난독화 글자 흔들기
const OBF = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&?@';
export function startObfuscation(root) {
  const id = setInterval(() => {
    for (const el of $$('.mc-obf', root)) {
      el.dataset.src ??= el.textContent;
      el.textContent = [...el.dataset.src].map((c) => (c === ' ' ? ' ' : OBF[(Math.random() * OBF.length) | 0])).join('');
    }
  }, 60);
  return () => clearInterval(id);
}

// 마인크래프트 글꼴 기준 대략적인 글자 폭 (px, 1배)
const NARROW = { '!': 2, "'": 2, ',': 2, '.': 2, ':': 2, ';': 2, i: 2, '|': 2, '`': 3, l: 3, '[': 4, ']': 4, t: 4, I: 4, ' ': 4, '(': 4, ')': 4, '{': 4, '}': 4, '<': 5, '>': 5, f: 5, k: 5, '"': 4, '*': 4 };
export function pixelWidth(segs) {
  let w = 0;
  for (const s of segs)
    for (const c of s.text) {
      const base = NARROW[c] ?? (c.charCodeAt(0) > 0x2e80 ? 9 : 6);
      w += base + (s.b ? 1 : 0);
    }
  return w;
}

// 툴바: 색 16개 + 서식 + 초기화, 버튼을 누르면 커서 위치에 &코드를 넣는다
export function toolbarHTML() {
  return `
    <div class="mc-bar">
      <div class="mc-colors">${Object.entries(COLORS)
        .map(([k, [h, , n]]) => `<button type="button" class="mc-dot" data-code="&${k}" style="--dot:${h}" aria-label="${n}" title="${n} (&${k})"></button>`)
        .join('')}
        <label class="mc-dot mc-hex" title="HEX 색" style="--dot:#7c5cff"><input type="color" value="#7c5cff"><i class="fa-solid fa-plus"></i></label>
      </div>
      <div class="mc-fmts">
        ${FORMATS.map(([c, , , icon, n]) => `<button type="button" class="icon-btn" data-code="&${c}" aria-label="${n}" title="${n} (&${c})"><i class="fa-solid ${icon}"></i></button>`).join('')}
        <button type="button" class="icon-btn" data-code="&r" aria-label="초기화" title="초기화 (&r)"><i class="fa-solid fa-eraser"></i></button>
        <button type="button" class="icon-btn" data-grad aria-label="그라데이션" title="선택한 글자에 그라데이션"><i class="fa-solid fa-droplet"></i></button>
      </div>
    </div>`;
}

export function bindToolbar(bar, getTarget, onChange) {
  let last = null;
  const insert = (code) => {
    const el = getTarget();
    if (!el) return;
    const a = el.selectionStart ?? el.value.length;
    const b = el.selectionEnd ?? a;
    el.value = el.value.slice(0, a) + code + el.value.slice(b);
    el.focus();
    el.setSelectionRange(a + code.length, a + code.length);
    onChange();
  };
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('[data-code],[data-grad]')) e.preventDefault(); // 입력칸 포커스·선택 유지
  });
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-code]');
    if (b) {
      b.animate([{ transform: 'scale(.8)' }, { transform: 'scale(1.1)' }, { transform: 'none' }], { duration: 320, easing: 'ease-out' });
      insert(b.dataset.code);
    }
    if (e.target.closest('[data-grad]')) gradient();
  });
  const hex = $('.mc-hex input', bar);
  hex.addEventListener('change', () => {
    hex.parentElement.style.setProperty('--dot', hex.value);
    insert('&#' + hex.value.slice(1).toUpperCase());
  });
  hex.addEventListener('pointerdown', (e) => e.stopPropagation());

  // 선택 영역의 글자마다 두 색 사이 HEX 코드를 넣는다
  let gradFrom = '#ff5555';
  let gradTo = '#5555ff';
  function gradient() {
    const el = getTarget();
    if (!el) return;
    const a = el.selectionStart;
    const b = el.selectionEnd;
    const sel = el.value.slice(a, b).replace(/[&§](#[0-9a-fA-F]{6}|[0-9a-fk-orA-FK-OR])/g, '');
    if (!sel) {
      import('../ui.js').then(({ toast }) => toast('그라데이션을 넣을 글자를 먼저 선택하세요', 'fa-circle-info'));
      return;
    }
    const pop = bar.querySelector('.mc-grad') || document.createElement('div');
    pop.className = 'mc-grad';
    pop.innerHTML = `
      <label class="mc-dot" style="--dot:${gradFrom}"><input type="color" value="${gradFrom}"></label>
      <i class="fa-solid fa-arrow-right muted"></i>
      <label class="mc-dot" style="--dot:${gradTo}"><input type="color" value="${gradTo}"></label>
      <button type="button" class="btn sm">적용</button>`;
    bar.append(pop);
    const [c1, c2] = pop.querySelectorAll('input');
    [c1, c2].forEach((c) => c.addEventListener('input', () => c.parentElement.style.setProperty('--dot', c.value)));
    pop.querySelector('.btn').onclick = () => {
      gradFrom = c1.value;
      gradTo = c2.value;
      const chars = [...sel];
      const A = [1, 3, 5].map((i) => parseInt(gradFrom.slice(i, i + 2), 16));
      const B = [1, 3, 5].map((i) => parseInt(gradTo.slice(i, i + 2), 16));
      const res = chars
        .map((ch, i) => {
          if (ch === ' ' || ch === '\n') return ch;
          const t = chars.length === 1 ? 0 : i / (chars.length - 1);
          const h = A.map((v, j) => Math.round(v + (B[j] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
          return `&#${h}${ch}`;
        })
        .join('');
      el.value = el.value.slice(0, a) + res + el.value.slice(b);
      pop.remove();
      el.focus();
      onChange();
    };
    last = pop;
  }
  return { insert, close: () => last?.remove() };
}
