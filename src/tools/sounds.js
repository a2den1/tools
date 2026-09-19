import { $, $$, esc, seg, segHTML, download, toast } from '../ui.js';

// ---------- 합성 도구 ----------
const noiseCache = new WeakMap();
function noiseBuffer(c) {
  let b = noiseCache.get(c);
  if (!b) {
    b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(c, b);
  }
  return b;
}

function env(g, T, a, peak, d) {
  g.gain.setValueAtTime(0.0001, T);
  g.gain.exponentialRampToValueAtTime(peak, T + a);
  g.gain.exponentialRampToValueAtTime(0.0001, T + a + d);
}

function osc(c, out, { type = 'sine', f, f1, t = 0, dur = 0.3, vol = 0.3, a = 0.005, lin = false, detune = 0, lp = 0, vib = 0, vibRate = 5 }) {
  const T = c.currentTime + t;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, T);
  if (f1) lin ? o.frequency.linearRampToValueAtTime(f1, T + dur) : o.frequency.exponentialRampToValueAtTime(f1, T + dur);
  o.detune.value = detune;
  if (vib) {
    const l = c.createOscillator();
    const lg = c.createGain();
    l.frequency.value = vibRate;
    lg.gain.value = vib;
    l.connect(lg).connect(o.frequency);
    l.start(T);
    l.stop(T + a + dur + 0.05);
  }
  const g = c.createGain();
  env(g, T, a, vol, dur);
  let node = o;
  if (lp) {
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = lp;
    node = o.connect(fl);
  }
  node.connect(g).connect(out);
  o.start(T);
  o.stop(T + a + dur + 0.05);
}

function noise(c, out, { t = 0, dur = 0.3, vol = 0.3, a = 0.002, type = 'bandpass', f = 1000, f1, q = 1 }) {
  const T = c.currentTime + t;
  const s = c.createBufferSource();
  s.buffer = noiseBuffer(c);
  s.loop = true;
  const fl = c.createBiquadFilter();
  fl.type = type;
  fl.frequency.setValueAtTime(f, T);
  if (f1) fl.frequency.exponentialRampToValueAtTime(f1, T + dur);
  fl.Q.value = q;
  const g = c.createGain();
  env(g, T, a, vol, dur);
  s.connect(fl).connect(g).connect(out);
  s.start(T, Math.random());
  s.stop(T + a + dur + 0.05);
}

const kick = (c, o, t = 0, vol = 0.8) => osc(c, o, { f: 150, f1: 40, t, dur: 0.18, vol });
const snare = (c, o, t = 0, vol = 0.35) => {
  noise(c, o, { t, dur: 0.12, vol, f: 1800, q: 0.7 });
  osc(c, o, { type: 'triangle', f: 190, f1: 150, t, dur: 0.07, vol: vol * 0.6 });
};
const notes = (c, o, list, { type = 'square', vol = 0.18, gap = 0 } = {}) => {
  let t = 0;
  for (const [f, d] of list) {
    if (f) osc(c, o, { type, f, t, dur: d, vol });
    t += d + gap;
  }
};

// ---------- 효과음 목록 ----------
const SOUNDS = [
  { id: 'airhorn', name: '에어혼', cat: 'meme', dur: 2.1, play: (c, o) => {
    [[0, 0.3], [0.42, 0.3], [0.84, 1.1]].forEach(([t, d]) =>
      [466, 470, 932, 699].forEach((f, i) => osc(c, o, { type: 'sawtooth', f, f1: f * 0.97, t, dur: d, vol: i < 2 ? 0.16 : 0.07, a: 0.01, lp: 3200 })));
  } },
  { id: 'rimshot', name: '바둠츠', cat: 'meme', dur: 1.5, play: (c, o) => {
    osc(c, o, { f: 220, f1: 130, dur: 0.16, vol: 0.6 });
    osc(c, o, { f: 160, f1: 95, t: 0.2, dur: 0.18, vol: 0.6 });
    kick(c, o, 0.42, 0.5);
    noise(c, o, { t: 0.42, dur: 1.0, vol: 0.28, type: 'highpass', f: 6500 });
    noise(c, o, { t: 0.42, dur: 0.5, vol: 0.12, f: 9000, q: 2 });
  } },
  { id: 'sadtrombone', name: '슬픈 트롬본', cat: 'meme', dur: 3.0, play: (c, o) => {
    [[392, 0, 0.4], [370, 0.5, 0.4], [349, 1.0, 0.4], [330, 1.5, 1.3]].forEach(([f, t, d], i) => {
      osc(c, o, { type: 'sawtooth', f: f / 2, t, dur: d, vol: 0.22, a: 0.04, lp: 900, vib: i === 3 ? 6 : 0, vibRate: 5.5 });
      osc(c, o, { type: 'sine', f: f / 2, t, dur: d, vol: 0.15, a: 0.04 });
    });
  } },
  { id: 'dundun', name: '두둥', cat: 'meme', dur: 2.6, play: (c, o) => {
    [[131, 0, 0.25], [131, 0.35, 0.25], [123.5, 0.7, 1.7]].forEach(([f, t, d]) => {
      [f, f / 2, f * 1.5].forEach((x, i) => osc(c, o, { type: 'sawtooth', f: x, t, dur: d, vol: i ? 0.1 : 0.16, a: 0.02, lp: 1400, vib: d > 1 ? 3 : 0 }));
      kick(c, o, t, 0.5);
    });
  } },
  { id: 'crickets', name: '귀뚜라미 (정적)', cat: 'meme', dur: 3.0, play: (c, o) => {
    for (let r = 0; r < 5; r++) for (let p = 0; p < 3; p++) {
      osc(c, o, { f: 4400, t: r * 0.55 + p * 0.045, dur: 0.025, vol: 0.08, a: 0.004 });
      osc(c, o, { f: 4050, t: r * 0.55 + 0.26 + p * 0.05, dur: 0.025, vol: 0.05, a: 0.004 });
    }
  } },
  { id: 'fart', name: '방귀', cat: 'meme', dur: 0.9, play: (c, o) => {
    osc(c, o, { type: 'sawtooth', f: 95, f1: 60, dur: 0.7, vol: 0.4, a: 0.02, lp: 500, vib: 22, vibRate: 28 });
    noise(c, o, { dur: 0.6, vol: 0.12, type: 'lowpass', f: 400 });
  } },
  { id: 'wolfwhistle', name: '휘파람', cat: 'meme', dur: 1.2, play: (c, o) => {
    osc(c, o, { f: 900, f1: 2400, dur: 0.28, vol: 0.18, a: 0.03 });
    osc(c, o, { f: 1100, f1: 2700, t: 0.45, dur: 0.14, vol: 0.18, a: 0.02 });
    osc(c, o, { f: 2700, f1: 800, t: 0.6, dur: 0.45, vol: 0.18, a: 0.01 });
  } },
  { id: 'boing', name: '뾰로롱', cat: 'meme', dur: 0.8, play: (c, o) => osc(c, o, { f: 160, f1: 480, dur: 0.65, vol: 0.35, vib: 70, vibRate: 16 }) },
  { id: 'applause', name: '박수', cat: 'fx', dur: 3.0, play: (c, o) => {
    for (let i = 0; i < 360; i++) {
      const t = Math.random() * 2.6;
      const k = t < 0.3 ? t / 0.3 : t > 1.8 ? Math.max(0, (2.6 - t) / 0.8) : 1;
      noise(c, o, { t, dur: 0.02 + Math.random() * 0.02, vol: 0.02 + 0.1 * k * Math.random(), f: 900 + Math.random() * 1800, q: 1.2 });
    }
  } },
  { id: 'drumroll', name: '드럼롤', cat: 'fx', dur: 3.6, play: (c, o) => {
    for (let t = 0, i = 0; t < 1.9; t += 0.045, i++) snare(c, o, t, 0.05 + (t / 1.9) * 0.22);
    kick(c, o, 1.95, 0.9);
    snare(c, o, 1.95, 0.4);
    noise(c, o, { t: 1.95, dur: 1.5, vol: 0.3, type: 'highpass', f: 5000 });
  } },
  { id: 'explosion', name: '폭발', cat: 'fx', dur: 2.2, play: (c, o) => {
    noise(c, o, { dur: 2.0, vol: 0.9, type: 'lowpass', f: 1400, f1: 70, a: 0.005 });
    osc(c, o, { f: 90, f1: 28, dur: 0.8, vol: 0.9 });
  } },
  { id: 'glass', name: '쨍그랑', cat: 'fx', dur: 1.4, play: (c, o) => {
    noise(c, o, { dur: 0.25, vol: 0.4, type: 'highpass', f: 3000 });
    for (let i = 0; i < 16; i++) osc(c, o, { f: 2500 + Math.random() * 5500, t: Math.random() * 0.5, dur: 0.2 + Math.random() * 0.6, vol: 0.05 });
  } },
  { id: 'whoosh', name: '슈욱', cat: 'fx', dur: 0.8, play: (c, o) => noise(c, o, { dur: 0.6, vol: 0.5, f: 300, f1: 3500, q: 1.4, a: 0.25 }) },
  { id: 'heartbeat', name: '심장박동', cat: 'fx', dur: 2.6, play: (c, o) => {
    [0, 0.85, 1.7].forEach((t) => {
      osc(c, o, { f: 70, f1: 40, t, dur: 0.16, vol: 0.9 });
      osc(c, o, { f: 60, f1: 35, t: t + 0.22, dur: 0.18, vol: 0.7 });
    });
  } },
  { id: 'shutter', name: '카메라 셔터', cat: 'fx', dur: 0.4, play: (c, o) => {
    noise(c, o, { dur: 0.035, vol: 0.5, type: 'highpass', f: 1800 });
    noise(c, o, { t: 0.09, dur: 0.05, vol: 0.4, type: 'bandpass', f: 2500 });
    osc(c, o, { f: 180, t: 0.09, dur: 0.04, vol: 0.2 });
  } },
  { id: 'tick', name: '시계 똑딱', cat: 'fx', dur: 3.0, play: (c, o) => {
    for (let i = 0; i < 6; i++) noise(c, o, { t: i * 0.5, dur: 0.02, vol: 0.5, f: i % 2 ? 1600 : 2200, q: 8 });
  } },
  { id: 'siren', name: '사이렌', cat: 'fx', dur: 2.6, play: (c, o) => {
    const T = c.currentTime;
    const x = c.createOscillator();
    x.type = 'sawtooth';
    const curve = new Float32Array(64).map((_, i) => 800 + 450 * Math.sin((i / 63) * Math.PI * 4 - Math.PI / 2));
    x.frequency.setValueCurveAtTime(curve, T, 2.4);
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = 2200;
    const g = c.createGain();
    env(g, T, 0.08, 0.12, 2.35);
    x.connect(fl).connect(g).connect(o);
    x.start(T);
    x.stop(T + 2.5);
  } },
  { id: 'carhorn', name: '빵빵', cat: 'fx', dur: 0.9, play: (c, o) => {
    [0, 0.35].forEach((t) => [392, 494].forEach((f) => osc(c, o, { type: 'square', f, t, dur: 0.25, vol: 0.12, a: 0.01, lp: 1800 })));
  } },
  { id: 'coin', name: '코인', cat: 'game', dur: 0.6, play: (c, o) => notes(c, o, [[988, 0.08], [1319, 0.4]], { vol: 0.15 }) },
  { id: 'jump', name: '점프', cat: 'game', dur: 0.35, play: (c, o) => osc(c, o, { type: 'square', f: 180, f1: 640, dur: 0.22, vol: 0.14, lin: true }) },
  { id: 'powerup', name: '파워업', cat: 'game', dur: 0.8, play: (c, o) => notes(c, o, [523, 659, 784, 1047, 1319, 1568, 2093].map((f) => [f, 0.07]), { vol: 0.12 }) },
  { id: 'laser', name: '레이저', cat: 'game', dur: 0.7, play: (c, o) => {
    [0, 0.3].forEach((t) => osc(c, o, { type: 'square', f: 1600, f1: 110, t, dur: 0.25, vol: 0.12 }));
  } },
  { id: 'hit', name: '타격', cat: 'game', dur: 0.3, play: (c, o) => {
    noise(c, o, { dur: 0.12, vol: 0.5, type: 'lowpass', f: 3000, f1: 300 });
    osc(c, o, { type: 'square', f: 220, f1: 60, dur: 0.12, vol: 0.2 });
  } },
  { id: 'levelup', name: '레벨 업', cat: 'game', dur: 1.2, play: (c, o) => {
    notes(c, o, [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.1]], { type: 'triangle', vol: 0.25 });
    [1047, 1319, 1568].forEach((f) => osc(c, o, { type: 'triangle', f, t: 0.42, dur: 0.7, vol: 0.14 }));
  } },
  { id: 'gameover', name: '게임 오버', cat: 'game', dur: 2.0, play: (c, o) => notes(c, o, [[784, 0.22], [740, 0.22], [698, 0.22], [659, 0.9]], { vol: 0.14, gap: 0.05 }) },
  { id: 'correct', name: '딩동댕', cat: 'alert', dur: 1.2, play: (c, o) => {
    [[523, 0], [659, 0.18], [784, 0.36]].forEach(([f, t], i) => {
      osc(c, o, { f, t, dur: i === 2 ? 0.8 : 0.3, vol: 0.3 });
      osc(c, o, { type: 'triangle', f: f * 2, t, dur: 0.2, vol: 0.05 });
    });
  } },
  { id: 'wrong', name: '땡 (오답)', cat: 'alert', dur: 1.0, play: (c, o) => {
    osc(c, o, { type: 'square', f: 150, dur: 0.85, vol: 0.14, lp: 1500 });
    osc(c, o, { type: 'square', f: 157, dur: 0.85, vol: 0.14, lp: 1500 });
  } },
  { id: 'doorbell', name: '딩동', cat: 'alert', dur: 2.2, play: (c, o) => {
    [[659, 0, 1.1], [523, 0.55, 1.6]].forEach(([f, t, d]) => {
      osc(c, o, { f, t, dur: d, vol: 0.3 });
      osc(c, o, { f: f * 2.76, t, dur: d * 0.4, vol: 0.04 });
    });
  } },
  { id: 'notify', name: '알림', cat: 'alert', dur: 0.7, play: (c, o) => {
    osc(c, o, { f: 880, dur: 0.14, vol: 0.25 });
    osc(c, o, { f: 1320, t: 0.13, dur: 0.45, vol: 0.25 });
  } },
  { id: 'pop', name: '뽁', cat: 'alert', dur: 0.2, play: (c, o) => osc(c, o, { f: 400, f1: 1300, dur: 0.07, vol: 0.4 }) },
  { id: 'countdown', name: '카운트다운', cat: 'alert', dur: 3.8, play: (c, o) => {
    [0, 1, 2].forEach((t) => osc(c, o, { f: 880, t, dur: 0.12, vol: 0.25 }));
    osc(c, o, { f: 1760, t: 3, dur: 0.6, vol: 0.25 });
  } },
];

const CAT_NAMES = [['all', '전체'], ['fav', '<i class="fa-solid fa-heart"></i> 즐겨찾기'], ['meme', '밈'], ['fx', '효과'], ['game', '게임'], ['alert', '알림'], ['mine', '내 효과음']];
const PALETTE = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#0a84ff', '#5e5ce6', '#af52de', '#ff2d55'];

// ---------- 저장소 ----------
const FAV_KEY = 'tools.sounds.fav';
const loadFav = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'));
  } catch {
    return new Set();
  }
};
const saveFav = (s) => {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify([...s]));
  } catch {}
};

function db() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('tools-sounds', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('mine', { keyPath: 'id' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function store(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('mine', mode);
    const req = fn(tx.objectStore('mine'));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}
const listMine = () => store('readonly', (s) => s.getAll()).catch(() => []);
const putMine = (x) => store('readwrite', (s) => s.put(x));
const delMine = (id) => store('readwrite', (s) => s.delete(id));

// ---------- WAV ----------
function wav(buf) {
  const ch = buf.getChannelData(0);
  const dv = new DataView(new ArrayBuffer(44 + ch.length * 2));
  const w = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  dv.setUint32(4, 36 + ch.length * 2, true);
  w(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, buf.sampleRate, true);
  dv.setUint32(28, buf.sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  w(36, 'data');
  dv.setUint32(40, ch.length * 2, true);
  for (let i = 0; i < ch.length; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, ch[i])) * 0x7fff, true);
  return new Blob([dv], { type: 'audio/wav' });
}

export default function (root) {
  let ctx = null;
  let master = null;
  let volume = 0.8;
  const fav = loadFav();
  let mine = [];
  const buffers = new Map();

  root.innerHTML = `
    <div class="row" style="flex-wrap:nowrap">
      <div class="grow" style="position:relative">
        <i class="fa-solid fa-magnifying-glass muted" style="position:absolute;left:16px;top:17px;font-size:14px"></i>
        <input class="field" id="q" placeholder="효과음 검색" style="padding-left:42px" autocomplete="off">
      </div>
      <div class="sb-vol">
        <i class="fa-solid fa-volume-high"></i>
        <input type="range" id="vol" min="0" max="100" value="80" aria-label="볼륨">
      </div>
      <button class="btn soft" id="stop" aria-label="모두 멈추기"><i class="fa-solid fa-stop"></i></button>
    </div>
    ${segHTML(CAT_NAMES, 'all')}
    <div class="sb-grid" id="grid"></div>
    <input type="file" id="file" accept="audio/*" multiple hidden>`;

  const grid = $('#grid', root);
  const q = $('#q', root);
  const cat = seg($('.seg', root), render);
  $('#vol', root).style.setProperty('--p', '80%');

  function audio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function all() {
    return [
      ...SOUNDS.map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] })),
      ...mine.map((m, i) => ({ id: m.id, name: m.name, cat: 'mine', mine: true, color: PALETTE[(i * 4 + 2) % PALETTE.length], dur: m.dur || 1 })),
    ];
  }

  function render() {
    const term = q.value.trim().toLowerCase();
    const list = all().filter((s) => {
      if (cat.value === 'fav' ? !fav.has(s.id) : cat.value !== 'all' && s.cat !== cat.value) return false;
      return !term || s.name.toLowerCase().includes(term);
    });
    const addTile = cat.value === 'mine' || cat.value === 'all';
    grid.innerHTML =
      list
        .map(
          (s, i) => `
      <div class="sb" data-id="${esc(s.id)}" style="--c:${s.color};--i:${i}">
        <button class="sb-btn" aria-label="${esc(s.name)} 재생"><span></span></button>
        <b>${esc(s.name)}</b>
        <div class="sb-act">
          <button class="icon-btn sm${fav.has(s.id) ? ' faved' : ''}" data-fav aria-label="즐겨찾기"><i class="fa-${fav.has(s.id) ? 'solid' : 'regular'} fa-heart"></i></button>
          ${s.mine ? '' : '<button class="icon-btn sm" data-dl aria-label="WAV 저장"><i class="fa-solid fa-download"></i></button>'}
          ${s.mine ? '<button class="icon-btn sm" data-del aria-label="삭제"><i class="fa-solid fa-trash-can"></i></button>' : ''}
        </div>
      </div>`,
        )
        .join('') +
      (addTile
        ? `<div class="sb sb-add" style="--i:${list.length}"><button class="sb-btn" id="add" aria-label="효과음 추가"><i class="fa-solid fa-plus"></i></button><b>내 효과음 추가</b></div>`
        : '') +
      (!list.length && !addTile ? `<div class="empty show" style="grid-column:1/-1"><i class="fa-regular fa-heart"></i><span>하트를 눌러 즐겨찾기에 담아 보세요</span></div>` : '');
  }

  async function play(id, el) {
    const s = all().find((x) => x.id === id);
    if (!s) return;
    const c = audio();
    let dur = s.dur;
    if (s.mine) {
      let buf = buffers.get(id);
      if (!buf) {
        const rec = mine.find((m) => m.id === id);
        buf = await c.decodeAudioData(await rec.blob.arrayBuffer());
        buffers.set(id, buf);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(master);
      src.start();
      dur = buf.duration;
    } else {
      s.play(c, master);
    }
    const btn = $('.sb-btn', el);
    btn.classList.remove('playing');
    void btn.offsetWidth;
    btn.style.setProperty('--dur', dur + 's');
    btn.classList.add('playing');
    clearTimeout(btn._t);
    btn._t = setTimeout(() => btn.classList.remove('playing'), dur * 1000);
  }

  grid.addEventListener('click', async (e) => {
    const card = e.target.closest('.sb');
    if (!card) return;
    if (e.target.closest('#add')) return $('#file', root).click();
    const id = card.dataset.id;
    if (e.target.closest('[data-fav]')) {
      const b = e.target.closest('[data-fav]');
      fav.has(id) ? fav.delete(id) : fav.add(id);
      saveFav(fav);
      b.classList.toggle('faved', fav.has(id));
      b.innerHTML = `<i class="fa-${fav.has(id) ? 'solid' : 'regular'} fa-heart"></i>`;
      b.firstChild.animate([{ transform: 'scale(.4)' }, { transform: 'scale(1.35)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      if (cat.value === 'fav') setTimeout(render, 300);
      return;
    }
    if (e.target.closest('[data-dl]')) {
      const s = SOUNDS.find((x) => x.id === id);
      const off = new OfflineAudioContext(1, Math.ceil(44100 * (s.dur + 0.3)), 44100);
      const g = off.createGain();
      g.connect(off.destination);
      s.play(off, g);
      download(wav(await off.startRendering()), `${s.name}.wav`);
      return;
    }
    if (e.target.closest('[data-del]')) {
      await delMine(id);
      mine = mine.filter((m) => m.id !== id);
      buffers.delete(id);
      card.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.7)' }], { duration: 250, fill: 'forwards' });
      setTimeout(render, 260);
      return;
    }
    if (e.target.closest('.sb-btn')) play(id, card);
  });

  $('#file', root).addEventListener('change', async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    for (const file of files) {
      if (file.size > 8 * 1024 * 1024) {
        toast(`${file.name}: 8MB 이하만 넣을 수 있어요`, 'fa-circle-exclamation');
        continue;
      }
      try {
        const buf = await audio().decodeAudioData(await file.arrayBuffer());
        const rec = { id: 'mine-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: file.name.replace(/\.[^.]+$/, '').slice(0, 30), blob: file, dur: buf.duration, at: Date.now() };
        await putMine(rec);
        mine.push(rec);
        buffers.set(rec.id, buf);
      } catch {
        toast(`${file.name} 을 읽을 수 없어요`, 'fa-circle-exclamation');
      }
    }
    render();
  });

  q.addEventListener('input', render);
  $('#vol', root).addEventListener('input', (e) => {
    volume = e.target.value / 100;
    if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
  });
  $('#stop', root).addEventListener('click', () => {
    if (!ctx) return;
    master.disconnect();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    $$('.sb-btn.playing', grid).forEach((b) => b.classList.remove('playing'));
  });

  render();
  listMine().then((m) => {
    mine = (m || []).sort((a, b) => a.at - b.at);
    if (mine.length) render();
  });

  return () => {
    ctx?.close();
  };
}
