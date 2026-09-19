import { $, sw, range, paintRanges, copyText, flashDone } from '../ui.js';

const SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digit: '0123456789',
  symbol: '!@#$%^&*()-_=+[]{};:,.?/~',
};
const AMBIG = /[Il1O0o|`'"]/g;

function rand(n) {
  const max = Math.floor(0x100000000 / n) * n;
  const a = new Uint32Array(1);
  do crypto.getRandomValues(a);
  while (a[0] >= max);
  return a[0] % n;
}

function generate(len, sets, noAmbig) {
  const pools = sets.map((k) => (noAmbig ? SETS[k].replace(AMBIG, '') : SETS[k]));
  const all = pools.join('');
  const chars = pools.map((p) => p[rand(p.length)]); // 고른 종류가 하나씩은 꼭 들어가게
  while (chars.length < len) chars.push(all[rand(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return { pw: chars.slice(0, len).join(''), pool: all.length };
}

export default function (root) {
  root.innerHTML = `
    <div class="pw-box">
      <div class="pw" id="pw"></div>
      <div class="row" style="flex-wrap:nowrap;gap:6px">
        <button class="icon-btn" id="regen" aria-label="다시 만들기"><i class="fa-solid fa-arrows-rotate"></i></button>
        <button class="icon-btn" id="copy" aria-label="복사"><i class="fa-regular fa-copy"></i></button>
      </div>
    </div>
    <div class="stack" style="gap:8px">
      <div class="bar pw-bar" id="bar"><i></i></div>
      <div class="row between"><b id="strength"></b><span class="muted mono" id="bits"></span></div>
    </div>
    <div class="panel stack" style="gap:18px">
      ${range('len', '길이', 4, 64, 16)}
      <div class="row" style="gap:18px">
        ${sw('upper', '대문자', true)}
        ${sw('lower', '소문자', true)}
        ${sw('digit', '숫자', true)}
        ${sw('symbol', '기호', true)}
        ${sw('ambig', '헷갈리는 글자 빼기')}
      </div>
    </div>`;
  paintRanges(root);
  const pwEl = $('#pw', root);
  let current = '';
  let scr = 0;

  function make() {
    const sets = Object.keys(SETS).filter((k) => $('#' + k, root).checked);
    if (!sets.length) {
      $('#lower', root).checked = true;
      sets.push('lower');
    }
    const { pw, pool } = generate(+$('#len', root).value, sets, $('#ambig', root).checked);
    current = pw;
    const bits = Math.round(pw.length * Math.log2(pool));
    const [label, color, pct] =
      bits < 40 ? ['약함', 'var(--bad)', 25] : bits < 60 ? ['보통', '#f79009', 50] : bits < 90 ? ['강함', 'var(--good)', 75] : ['매우 강함', 'var(--accent)', 100];
    $('#strength', root).textContent = label;
    $('#strength', root).style.color = color;
    $('#bits', root).textContent = `${bits}비트`;
    const bar = $('#bar', root);
    bar.style.setProperty('--c', color);
    bar.firstElementChild.style.width = pct + '%';
    scramble(pw);
  }

  // 글자가 잠깐 뒤섞였다가 자리를 잡는다
  function scramble(target) {
    const tok = ++scr;
    const pool = SETS.upper + SETS.lower + SETS.digit;
    const t0 = performance.now();
    const tick = () => {
      if (tok !== scr) return;
      const k = Math.min(1, (performance.now() - t0) / 380);
      const fixed = Math.floor(k * target.length);
      pwEl.textContent = target.slice(0, fixed) + [...target.slice(fixed)].map(() => pool[(Math.random() * pool.length) | 0]).join('');
      if (k < 1) setTimeout(tick, 28);
      else pwEl.textContent = target;
    };
    tick();
  }

  root.addEventListener('input', make);
  root.addEventListener('change', (e) => e.target.type === 'checkbox' && make());
  $('#regen', root).addEventListener('click', (e) => {
    e.currentTarget.firstElementChild.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 500, easing: 'cubic-bezier(.22,1,.36,1)' });
    make();
  });
  $('#copy', root).addEventListener('click', async (e) => {
    const b = e.currentTarget;
    if (await copyText(current)) flashDone(b);
  });
  pwEl.addEventListener('click', () => copyText(current).then((ok) => ok && flashDone($('#copy', root))));
  make();
  return () => scr++;
}
