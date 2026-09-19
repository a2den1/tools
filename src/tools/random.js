import { $, seg, segHTML, sw, range, paintRanges, esc, toast, copyText } from '../ui.js';

const rand = (n) => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
};

export default function (root) {
  let timers = [];
  root.innerHTML = `
    ${segHTML([['num', '숫자'], ['list', '목록'], ['coin', '동전'], ['dice', '주사위']], 'num')}
    <div class="panel stack" id="o-num">
      <div class="two">
        <div><span class="label">최소</span><input class="field mono" id="min" type="number" value="1"></div>
        <div><span class="label">최대</span><input class="field mono" id="max" type="number" value="100"></div>
      </div>
      ${range('count', '개수', 1, 20, 1)}
      ${sw('dup', '중복 허용')}
    </div>
    <div class="panel stack" id="o-list" hidden>
      <textarea class="field" id="items" rows="6" placeholder="한 줄에 하나씩">짜장면
짬뽕
볶음밥
탕수육</textarea>
      ${range('pick', '뽑을 개수', 1, 20, 1)}
    </div>
    <div class="panel stack" id="o-dice" hidden>
      ${range('dice', '주사위 개수', 1, 6, 2)}
    </div>
    <button class="btn wide" id="go" style="height:58px;font-size:17px"><i class="fa-solid fa-dice"></i>뽑기</button>
    <div class="results" id="res"></div>`;
  paintRanges(root);

  const mode = seg($('.seg', root), () => {
    $('#o-num', root).hidden = mode.value !== 'num';
    $('#o-list', root).hidden = mode.value !== 'list';
    $('#o-dice', root).hidden = mode.value !== 'dice';
    $('#res', root).innerHTML = '';
  });

  function pickValues() {
    const m = mode.value;
    if (m === 'coin') return { vals: [rand(2) ? '앞' : '뒤'], pool: ['앞', '뒤'] };
    if (m === 'dice') {
      const n = +$('#dice', root).value;
      const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      return { vals: Array.from({ length: n }, () => faces[rand(6)]), pool: faces, dice: true };
    }
    if (m === 'list') {
      const items = $('#items', root)
        .value.split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      if (!items.length) throw new Error('항목을 입력해 주세요');
      const k = Math.min(+$('#pick', root).value, items.length);
      const bag = [...items];
      const vals = Array.from({ length: k }, () => bag.splice(rand(bag.length), 1)[0]);
      return { vals, pool: items };
    }
    let a = Math.ceil(+$('#min', root).value);
    let b = Math.floor(+$('#max', root).value);
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('숫자를 확인해 주세요');
    if (a > b) [a, b] = [b, a];
    const span = b - a + 1;
    const k = +$('#count', root).value;
    const dup = $('#dup', root).checked;
    if (!dup && k > span) throw new Error(`${a}~${b} 에서는 ${span}개까지만 뽑을 수 있어요`);
    const set = new Set();
    const vals = [];
    while (vals.length < k) {
      const v = a + rand(span);
      if (!dup && set.has(v)) continue;
      set.add(v);
      vals.push(v);
    }
    return { vals: vals.map(String), pool: Array.from({ length: Math.min(span, 50) }, (_, i) => String(a + rand(span))) };
  }

  $('#go', root).addEventListener('click', (e) => {
    let r;
    try {
      r = pickValues();
    } catch (err) {
      return toast(err.message, 'fa-circle-exclamation');
    }
    const icon = e.currentTarget.querySelector('i');
    icon.animate([{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-25deg) scale(1.2)' }, { transform: 'rotate(20deg) scale(1.2)' }, { transform: 'none' }], { duration: 600 });
    timers.forEach(clearTimeout);
    timers = [];
    const res = $('#res', root);
    res.className = 'results' + (r.dice ? ' dice' : '');
    res.innerHTML = r.vals.map((_, i) => `<div class="ball" style="--i:${i}"><span></span></div>`).join('');
    // 슬롯처럼 돌다가 하나씩 멈춘다
    [...res.children].forEach((ball, i) => {
      const span = ball.firstElementChild;
      const stopAt = 550 + i * 180;
      const t0 = performance.now();
      const spin = () => {
        const el = performance.now() - t0;
        if (el >= stopAt) {
          span.textContent = r.vals[i];
          ball.classList.add('landed');
          return;
        }
        span.textContent = r.pool[rand(r.pool.length)];
        timers.push(setTimeout(spin, 40 + (el / stopAt) * 90));
      };
      spin();
    });
    if (mode.value === 'dice' && r.vals.length > 1) {
      const sum = r.vals.reduce((a, f) => a + ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'].indexOf(f) + 1, 0);
      timers.push(setTimeout(() => res.insertAdjacentHTML('beforeend', `<div class="sum">합계 <b>${sum}</b></div>`), 600 + r.vals.length * 180));
    }
  });
  $('#res', root).addEventListener('click', (e) => {
    const b = e.target.closest('.ball.landed');
    if (b) copyText(b.textContent);
  });
  return () => timers.forEach(clearTimeout);
}
