import { $, $$, seg, segHTML, toast } from '../ui.js';

const R = 132;
const CIRC = 2 * Math.PI * R;
const two = (n) => String(n).padStart(2, '0');
const digits = (s) => [...s].map((c) => (/\d/.test(c) ? `<span class="d">${c}</span>` : `<span class="p">${c}</span>`)).join('');

function beep(ctx) {
  const t = ctx.currentTime;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      const s = t + i * 0.9 + j * 0.22;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.3, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(s);
      o.stop(s + 0.2);
    }
}

export default function (root) {
  const baseTitle = document.title;
  let ctx = null;

  root.innerHTML = `
    ${segHTML([['timer', '타이머'], ['watch', '스톱워치']], 'timer')}
    <div id="m-timer" class="stack" style="justify-items:center;gap:22px">
      <div class="ring" id="ring">
        <svg viewBox="0 0 300 300"><circle class="ring-bg" cx="150" cy="150" r="${R}"/><circle class="ring-fg" id="arc" cx="150" cy="150" r="${R}" stroke-dasharray="${CIRC}" stroke-dashoffset="0"/></svg>
        <div class="ring-t" id="tdisp"></div>
        <div class="ring-set" id="tset">
          <input class="field" id="tm" type="number" min="0" max="999" value="5" aria-label="분"><span>:</span><input class="field" id="ts" type="number" min="0" max="59" value="00" aria-label="초">
        </div>
      </div>
      <div class="chips" id="presets" style="justify-content:center">${[1, 3, 5, 10, 15, 25, 30, 60].map((m) => `<button class="chip" data-m="${m}">${m}분</button>`).join('')}</div>
      <div class="row" style="justify-content:center">
        <button class="btn soft" id="treset" style="height:56px;width:120px"><i class="fa-solid fa-rotate-left"></i>초기화</button>
        <button class="btn" id="tgo" style="height:56px;width:160px"><i class="fa-solid fa-play"></i>시작</button>
      </div>
    </div>
    <div id="m-watch" class="stack" style="justify-items:center;gap:22px" hidden>
      <div class="watch" id="wdisp"></div>
      <div class="row" style="justify-content:center">
        <button class="btn soft" id="wlap" style="height:56px;width:120px" disabled><i class="fa-solid fa-flag"></i>랩</button>
        <button class="btn" id="wgo" style="height:56px;width:160px"><i class="fa-solid fa-play"></i>시작</button>
      </div>
      <div class="outs" id="laps" style="width:min(520px,100%)"></div>
    </div>`;

  const mode = seg($('.seg', root), () => {
    $('#m-timer', root).hidden = mode.value !== 'timer';
    $('#m-watch', root).hidden = mode.value !== 'watch';
  });

  // ---------- 타이머 ----------
  const T = { total: 300000, left: 300000, end: 0, running: false, started: false };
  const arc = $('#arc', root);
  const tdisp = $('#tdisp', root);
  const tset = $('#tset', root);
  const ring = $('#ring', root);
  const tgo = $('#tgo', root);

  const readInputs = () => (Math.max(0, +$('#tm', root).value || 0) * 60 + Math.min(59, Math.max(0, +$('#ts', root).value || 0))) * 1000;
  function drawTimer() {
    const s = Math.ceil(T.left / 1000);
    const h = Math.floor(s / 3600);
    const txt = h ? `${h}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}` : `${two(Math.floor(s / 60))}:${two(s % 60)}`;
    tdisp.innerHTML = digits(txt);
    arc.style.strokeDashoffset = String(CIRC * (1 - (T.total ? T.left / T.total : 0)));
    if (T.running) document.title = `${txt} · 타이머`;
  }
  function setTimerUI() {
    tset.hidden = T.started;
    tdisp.hidden = !T.started;
    tgo.innerHTML = T.running ? '<i class="fa-solid fa-pause"></i>일시정지' : T.started ? '<i class="fa-solid fa-play"></i>계속' : '<i class="fa-solid fa-play"></i>시작';
    tgo.classList.toggle('dark', T.running);
    ring.classList.toggle('running', T.running);
  }
  tgo.addEventListener('click', () => {
    ctx ??= new AudioContext();
    ctx.resume();
    if (!T.started) {
      T.total = T.left = readInputs();
      if (!T.total) return toast('시간을 정해 주세요', 'fa-circle-info');
      T.started = true;
    }
    T.running = !T.running;
    if (T.running) T.end = performance.now() + T.left;
    else document.title = baseTitle;
    ring.classList.remove('done');
    setTimerUI();
    drawTimer();
  });
  $('#treset', root).addEventListener('click', () => {
    Object.assign(T, { running: false, started: false, total: readInputs(), left: readInputs() });
    ring.classList.remove('done');
    document.title = baseTitle;
    setTimerUI();
    drawTimer();
  });
  $('#presets', root).addEventListener('click', (e) => {
    const c = e.target.closest('[data-m]');
    if (!c) return;
    $('#tm', root).value = c.dataset.m;
    $('#ts', root).value = '00';
    Object.assign(T, { running: false, started: false, total: readInputs(), left: readInputs() });
    document.title = baseTitle;
    ring.classList.remove('done');
    setTimerUI();
    drawTimer();
    ring.animate([{ transform: 'scale(.96)' }, { transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  });
  tset.addEventListener('input', () => {
    T.total = T.left = readInputs();
    drawTimer();
  });

  // ---------- 스톱워치 ----------
  const W = { acc: 0, start: 0, running: false, laps: [] };
  const wdisp = $('#wdisp', root);
  const wgo = $('#wgo', root);
  const wlap = $('#wlap', root);
  const wElapsed = () => W.acc + (W.running ? performance.now() - W.start : 0);
  const fmtW = (ms) => {
    const cs = Math.floor(ms / 10);
    const h = Math.floor(cs / 360000);
    const m = Math.floor((cs % 360000) / 6000);
    const s = Math.floor((cs % 6000) / 100);
    return (h ? `${h}:${two(m)}` : two(m)) + `:${two(s)}.${two(cs % 100)}`;
  };
  const drawWatch = () => (wdisp.innerHTML = digits(fmtW(wElapsed())));
  function setWatchUI() {
    wgo.innerHTML = W.running ? '<i class="fa-solid fa-pause"></i>정지' : '<i class="fa-solid fa-play"></i>' + (W.acc ? '계속' : '시작');
    wgo.classList.toggle('dark', W.running);
    wlap.disabled = !W.running && !W.acc;
    wlap.innerHTML = W.running || !W.acc ? '<i class="fa-solid fa-flag"></i>랩' : '<i class="fa-solid fa-rotate-left"></i>초기화';
  }
  function drawLaps() {
    const splits = W.laps.map((t, i) => t - (W.laps[i - 1] || 0));
    const min = Math.min(...splits);
    const max = Math.max(...splits);
    $('#laps', root).innerHTML = splits
      .map((s, i) => [s, i])
      .reverse()
      .map(([s, i], k) => {
        const cls = splits.length > 2 && s === min ? 'good' : splits.length > 2 && s === max ? 'bad' : '';
        return `<div class="out" style="${k === 0 ? 'animation:rise .45s var(--ease) both' : ''}"><span class="k">랩 ${i + 1}</span><b class="v mono ${cls}">${fmtW(s)}</b><span class="muted mono" style="padding-right:12px">${fmtW(W.laps[i])}</span></div>`;
      })
      .join('');
  }
  wgo.addEventListener('click', () => {
    if (W.running) {
      W.acc += performance.now() - W.start;
      W.running = false;
    } else {
      W.start = performance.now();
      W.running = true;
    }
    setWatchUI();
  });
  wlap.addEventListener('click', () => {
    if (W.running) {
      W.laps.push(wElapsed());
      drawLaps();
    } else {
      Object.assign(W, { acc: 0, laps: [] });
      drawLaps();
      drawWatch();
      setWatchUI();
    }
  });

  // ---------- 공통 루프 ----------
  const loop = setInterval(() => {
    if (T.running) {
      T.left = Math.max(0, T.end - performance.now());
      drawTimer();
      if (T.left <= 0) {
        T.running = false;
        T.started = false;
        T.left = T.total;
        ring.classList.add('done');
        document.title = baseTitle;
        if (ctx) beep(ctx);
        toast('시간이 다 됐어요', 'fa-bell');
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('타이머 종료');
        setTimerUI();
        drawTimer();
      }
    }
    if (W.running) drawWatch();
  }, 33);

  const onKey = (e) => {
    if (e.code !== 'Space' || e.target.closest('input, textarea, button, select')) return;
    e.preventDefault();
    (mode.value === 'timer' ? tgo : wgo).click();
  };
  addEventListener('keydown', onKey);

  setTimerUI();
  drawTimer();
  drawWatch();
  setWatchUI();

  return () => {
    clearInterval(loop);
    removeEventListener('keydown', onKey);
    document.title = baseTitle;
    ctx?.close();
  };
}
