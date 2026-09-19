import { $, $$, countTo } from '../ui.js';

const seg = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ko', { granularity: 'grapheme' }) : null;
const graphemes = (s) => (seg ? [...seg.segment(s)].map((x) => x.segment) : [...s]);

export default function (root) {
  root.innerHTML = `
    <textarea class="field" id="t" rows="10" placeholder="여기에 입력" style="min-height:240px;font-size:16px"></textarea>
    <div class="stats">
      <div class="stat"><b data-k="all">0</b><span>공백 포함</span></div>
      <div class="stat"><b data-k="nospace">0</b><span>공백 제외</span></div>
      <div class="stat"><b data-k="words">0</b><span>단어</span></div>
      <div class="stat"><b data-k="lines">0</b><span>줄</span></div>
      <div class="stat"><b data-k="bytes">0</b><span>바이트</span></div>
      <div class="stat"><b data-k="manu">0</b><span>원고지 (장)</span></div>
    </div>`;
  const t = $('#t', root);
  const upd = () => {
    const v = t.value;
    const g = graphemes(v);
    const vals = {
      all: g.length,
      nospace: g.filter((c) => !/\s/.test(c)).length,
      words: v.trim() ? v.trim().split(/\s+/).length : 0,
      lines: v ? v.split('\n').length : 0,
      bytes: new TextEncoder().encode(v).length,
      manu: g.length ? Math.ceil(g.length / 200) : 0,
    };
    $$('[data-k]', root).forEach((el) => countTo(el, vals[el.dataset.k]));
  };
  t.addEventListener('input', upd);
  setTimeout(() => t.focus(), 300);
}
