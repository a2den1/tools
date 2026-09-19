import { $, seg, segHTML, sw, esc, copyBtn, debounce, download } from '../ui.js';

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

function highlight(s) {
  return s.replace(/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[&<>]/g, (m, str, colon, kw) => {
    if (str) return `<span class="${colon ? 'j-key' : 'j-str'}">${esc(str)}</span>${colon || ''}`;
    if (kw) return `<span class="${kw === 'null' ? 'j-null' : 'j-bool'}">${m}</span>`;
    if (m === '&' || m === '<' || m === '>') return esc(m);
    return `<span class="j-num">${m}</span>`;
  });
}

function where(text, err) {
  const m = err.message.match(/position (\d+)/);
  const lc = err.message.match(/line (\d+) column (\d+)/);
  if (lc) return `${lc[1]}번째 줄 ${lc[2]}번째 글자`;
  if (!m) return '';
  const before = text.slice(0, +m[1]).split('\n');
  return `${before.length}번째 줄 ${before.at(-1).length + 1}번째 글자`;
}

export default function (root) {
  root.innerHTML = `
    <div class="row">
      ${segHTML([['2', '2칸'], ['4', '4칸'], ['tab', '탭'], ['min', '한 줄']], '2')}
      ${sw('sort', '키 정렬')}
      <span class="grow"></span>
      <button class="btn soft sm" id="dl"><i class="fa-solid fa-download"></i>저장</button>
    </div>
    <div class="two">
      <textarea class="field mono" id="in" spellcheck="false" style="min-height:420px" placeholder='{"hello": "world"}'></textarea>
      <div class="stack" style="gap:10px;min-width:0">
        <div style="position:relative;min-width:0">
          <pre class="code" id="out" style="min-height:420px"></pre>
          <div style="position:absolute;top:8px;right:8px">${copyBtn('#out')}</div>
        </div>
        <div id="msg"></div>
      </div>
    </div>`;
  const inp = $('#in', root);
  const out = $('#out', root);
  const msg = $('#msg', root);
  const ind = seg($('.seg', root), run);
  let text = '';

  function run() {
    const src = inp.value.trim();
    if (!src) {
      out.innerHTML = '';
      msg.innerHTML = '';
      text = '';
      return;
    }
    try {
      let v = JSON.parse(src);
      if ($('#sort', root).checked) v = sortKeys(v);
      const space = ind.value === 'min' ? 0 : ind.value === 'tab' ? '\t' : +ind.value;
      text = JSON.stringify(v, null, space);
      out.innerHTML = highlight(text);
      msg.innerHTML = '';
    } catch (e) {
      const at = where(src, e);
      msg.innerHTML = `<div class="err"><i class="fa-solid fa-triangle-exclamation"></i><span>올바른 JSON 이 아니에요${at ? ` — ${at}` : ''}</span></div>`;
    }
  }
  inp.addEventListener('input', debounce(run, 150));
  $('#sort', root).addEventListener('change', run);
  $('#dl', root).addEventListener('click', () => text && download(new Blob([text], { type: 'application/json' }), 'data.json'));
  setTimeout(() => inp.focus(), 300);
}
