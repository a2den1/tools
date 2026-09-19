import { $, seg, segHTML, sw, countTo, pop } from '../ui.js';

const DAY = 86400000;
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const utc = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
const diffDays = (a, b) => Math.round((utc(b) - utc(a)) / DAY);
const pretty = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;
const today = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};

function monthsBetween(a, b) {
  let m = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  if (b.getDate() < a.getDate()) m--;
  const anchor = new Date(a.getFullYear(), a.getMonth() + m, a.getDate());
  return [m, diffDays(anchor, b)];
}

export default function (root) {
  const t = today();
  root.innerHTML = `
    ${segHTML([['between', '날짜 사이'], ['add', '날짜 더하기'], ['age', '만 나이']], 'between')}
    <div id="m-between" class="stack">
      <div class="two">
        <div><span class="label">시작</span><input class="field" type="date" id="b0" value="${iso(t)}"></div>
        <div><span class="label">끝</span><input class="field" type="date" id="b1" value="${iso(new Date(t.getTime() + 100 * DAY))}"></div>
      </div>
      ${sw('incl', '시작일을 1일로 세기')}
      <div class="dday" id="dday"></div>
      <div class="stats">
        <div class="stat"><b data-k="days">0</b><span>일</span></div>
        <div class="stat"><b data-k="weeks">0</b><span>주</span></div>
        <div class="stat"><b data-k="months">0</b><span>개월</span></div>
        <div class="stat"><b data-k="hours">0</b><span>시간</span></div>
      </div>
    </div>
    <div id="m-add" class="stack" hidden>
      <div class="two">
        <div><span class="label">기준일</span><input class="field" type="date" id="a0" value="${iso(t)}"></div>
        <div><span class="label">더할 날 수</span><input class="field mono" type="number" id="an" value="100"></div>
      </div>
      <div class="chips">${[7, 30, 50, 100, 200, 365, 1000, -30, -100].map((n) => `<button class="chip" data-n="${n}">${n > 0 ? '+' : ''}${n}일</button>`).join('')}</div>
      <div class="dday" id="added"></div>
    </div>
    <div id="m-age" class="stack" hidden>
      <div class="two">
        <div><span class="label">생년월일</span><input class="field" type="date" id="g0" value="2000-01-01"></div>
        <div><span class="label">기준일</span><input class="field" type="date" id="g1" value="${iso(t)}"></div>
      </div>
      <div class="dday" id="age"></div>
      <div class="stats">
        <div class="stat"><b data-a="year">0</b><span>연 나이</span></div>
        <div class="stat"><b data-a="korean">0</b><span>세는 나이</span></div>
        <div class="stat"><b data-a="lived">0</b><span>살아온 날</span></div>
        <div class="stat"><b data-a="next">0</b><span>다음 생일까지</span></div>
      </div>
    </div>`;

  const mode = seg($('.seg', root), () => {
    ['between', 'add', 'age'].forEach((m) => ($('#m-' + m, root).hidden = mode.value !== m));
    update();
  });
  const v = (id) => $('#' + id, root).value;

  function update() {
    if (mode.value === 'between') {
      const a = parse(v('b0'));
      const b = parse(v('b1'));
      if (!a || !b) return;
      let d = diffDays(a, b);
      if ($('#incl', root).checked) d += d >= 0 ? 1 : -1;
      const [m, rest] = d >= 0 ? monthsBetween(a, b) : monthsBetween(b, a).map((x) => -x);
      const dd = $('#dday', root);
      dd.innerHTML = `<b>${d === 0 ? 'D-DAY' : d > 0 ? `D-${d.toLocaleString()}` : `D+${(-d).toLocaleString()}`}</b><span>${pretty(b)}</span>`;
      pop(dd.firstElementChild);
      const set = (k, n) => countTo($(`[data-k="${k}"]`, root), n);
      set('days', Math.abs(d));
      set('weeks', Math.floor(Math.abs(d) / 7));
      set('months', Math.abs(m));
      set('hours', Math.abs(d) * 24);
      $('[data-k="weeks"]', root).nextElementSibling.textContent = Math.abs(d) % 7 ? `주 ${Math.abs(d) % 7}일` : '주';
      $('[data-k="months"]', root).nextElementSibling.textContent = Math.abs(rest) ? `개월 ${Math.abs(rest)}일` : '개월';
    } else if (mode.value === 'add') {
      const a = parse(v('a0'));
      const n = parseInt(v('an'), 10) || 0;
      if (!a) return;
      const r = new Date(a.getFullYear(), a.getMonth(), a.getDate() + n);
      const el = $('#added', root);
      el.innerHTML = `<b>${pretty(r)}</b><span>${n >= 0 ? `${n.toLocaleString()}일 뒤` : `${(-n).toLocaleString()}일 전`} · 오늘부터 ${diffDays(today(), r) >= 0 ? 'D-' + diffDays(today(), r) : 'D+' + -diffDays(today(), r)}</span>`;
      pop(el.firstElementChild);
    } else {
      const b = parse(v('g0'));
      const ref = parse(v('g1'));
      if (!b || !ref) return;
      let age = ref.getFullYear() - b.getFullYear();
      if (ref.getMonth() < b.getMonth() || (ref.getMonth() === b.getMonth() && ref.getDate() < b.getDate())) age--;
      let next = new Date(ref.getFullYear(), b.getMonth(), b.getDate());
      if (next < ref) next = new Date(ref.getFullYear() + 1, b.getMonth(), b.getDate());
      const el = $('#age', root);
      el.innerHTML = `<b>만 ${Math.max(0, age)}세</b><span>${pretty(b)} 출생</span>`;
      pop(el.firstElementChild);
      const set = (k, n) => countTo($(`[data-a="${k}"]`, root), n);
      set('year', Math.max(0, ref.getFullYear() - b.getFullYear()));
      set('korean', Math.max(1, ref.getFullYear() - b.getFullYear() + 1));
      set('lived', Math.max(0, diffDays(b, ref)));
      set('next', diffDays(ref, next));
    }
  }

  root.addEventListener('input', update);
  root.addEventListener('change', update);
  $('.chips', root).addEventListener('click', (e) => {
    const c = e.target.closest('[data-n]');
    if (!c) return;
    $('#an', root).value = c.dataset.n;
    update();
  });
  update();
}
