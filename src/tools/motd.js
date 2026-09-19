import { $, seg, segHTML, sw, esc, copyBtn } from '../ui.js';
import { parse, toLegacy, toMiniMessage, toComponent, previewHTML, startObfuscation, pixelWidth, toolbarHTML, bindToolbar } from './mc-common.js';

const PRESETS = [
  ['기본', '&aA Minecraft Server', ''],
  ['이벤트', '&6&l★ &e&l여름 이벤트 진행 중 &6&l★', '&7지금 접속하고 &b한정 보상&7을 받으세요'],
  ['그라데이션', '&#FF5F6D&lT&#F76A74&lO&#EF757B&lO&#E78082&lL&#DF8B89&lS &#C7A69E&lS&#BFB1A5&lE&#B7BCAC&lR&#AFC7B3&lV&#A7D2BA&lE&#9FDDC1&lR', '&f서바이벌 &8| &f미니게임 &8| &f건축'],
  ['점검', '&c&l⚠ 서버 점검 중', '&7잠시 후 다시 접속해 주세요 &k!!'],
];
const LINE_W = 264;

function propEscape(s) {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
}

export default function (root) {
  root.innerHTML = `
    <div class="mc-screen">
      <div class="mc-entry">
        <div class="mc-icon"><i class="fa-solid fa-cube"></i></div>
        <div class="mc-text">
          <div class="mc-top"><span>Minecraft Server</span><span class="mc-ping"><span>0/20</span><i></i><i></i><i></i><i></i><i></i></span></div>
          <div class="mc-motd" id="pv"></div>
        </div>
      </div>
    </div>
    <div class="panel stack">
      ${toolbarHTML()}
      <input class="field mono" id="l1" spellcheck="false" autocomplete="off" aria-label="첫 줄">
      <input class="field mono" id="l2" spellcheck="false" autocomplete="off" aria-label="둘째 줄">
      <div class="row between">
        ${sw('center', '가운데 정렬')}
        <div class="chips">${PRESETS.map(([n], i) => `<button class="chip" data-p="${i}">${n}</button>`).join('')}</div>
      </div>
    </div>
    <div class="stack">
      ${segHTML([['props', 'server.properties'], ['sect', '§ 코드'], ['amp', '& 코드'], ['mini', 'MiniMessage'], ['json', 'JSON']], 'props')}
      <div class="out" style="align-items:flex-start;padding-top:14px;padding-bottom:14px">
        <pre class="v mono" id="code" style="margin:0;white-space:pre-wrap"></pre>
        ${copyBtn('#code')}
      </div>
      <div class="note" id="hexnote" hidden><i class="fa-solid fa-circle-info"></i><span>바닐라 server.properties 는 HEX 색을 지원하지 않아 가장 가까운 기본 색으로 바꿨어요.</span></div>
    </div>`;

  const l1 = $('#l1', root);
  const l2 = $('#l2', root);
  const pv = $('#pv', root);
  const code = $('#code', root);
  const center = $('#center', root);
  let focused = l1;
  [l1, l2].forEach((el) => el.addEventListener('focus', () => (focused = el)));
  [l1.value, l2.value] = [PRESETS[0][1], PRESETS[0][2]];

  const tab = seg($('.seg', root), update);
  bindToolbar($('.mc-bar', root), () => focused, update);

  function lines() {
    let segs = [parse(l1.value), parse(l2.value)];
    if (center.checked) {
      segs = segs.map((s) => {
        const pad = Math.max(0, Math.round((LINE_W - pixelWidth(s)) / 2 / 4));
        return pad ? [{ text: ' '.repeat(pad), color: null, b: 0, i: 0, u: 0, s: 0, k: 0 }, ...s] : s;
      });
    }
    return segs;
  }

  function update() {
    const [a, b] = lines();
    pv.innerHTML = `<div>${previewHTML(a) || '&nbsp;'}</div><div>${previewHTML(b) || '&nbsp;'}</div>`;
    const nl = { text: '\n', color: null, b: 0, i: 0, u: 0, s: 0, k: 0 };
    const all = b.length ? [...a, nl, ...b] : a;
    const hasHex = all.some((s) => s.color?.startsWith('#'));
    let out = '';
    switch (tab.value) {
      case 'props': {
        let first = toLegacy(a, '§', 'nearest');
        if (/^\s/.test(first)) first = '§r' + first;
        const second = b.length ? toLegacy(b, '§', 'nearest') : '';
        out = 'motd=' + propEscape(first + (second ? '\n' + second : ''));
        break;
      }
      case 'sect':
        out = toLegacy(a, '§') + (b.length ? '\n' + toLegacy(b, '§') : '');
        break;
      case 'amp':
        out = toLegacy(a, '&', 'amp') + (b.length ? '\n' + toLegacy(b, '&', 'amp') : '');
        break;
      case 'mini':
        out = toMiniMessage(all);
        break;
      case 'json':
        out = JSON.stringify(toComponent(all));
        break;
    }
    code.textContent = out;
    $('#hexnote', root).hidden = !(tab.value === 'props' && hasHex);
  }

  root.addEventListener('input', (e) => e.target.matches('#l1, #l2') && update());
  center.addEventListener('change', update);
  $('.chips', root).addEventListener('click', (e) => {
    const c = e.target.closest('[data-p]');
    if (!c) return;
    const p = PRESETS[+c.dataset.p];
    l1.value = p[1];
    l2.value = p[2];
    update();
    pv.animate([{ opacity: 0.2, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' });
  });
  update();
  const stop = startObfuscation(pv);
  return stop;
}
