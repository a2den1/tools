import '@fortawesome/fontawesome-free/css/all.min.css';
import './style.css';
import './tools.css';
import { TOOLS, CATS, catOf } from './tools/index.js';
import { $, $$, seg, paintRanges } from './ui.js';

const view = $('#view');
const search = $('#search');
const top = $('#top');
let cleanup = null;
let cat = 'all';
let homeScroll = 0;
let lastTool = null;
let renderTok = 0;
let firstHome = true;

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const idFromPath = () => {
  const id = decodeURIComponent(location.pathname).replace(/^\/+|\/+$/g, '');
  return TOOLS.some((t) => t.id === id) ? id : '';
};

function teardown() {
  if (typeof cleanup === 'function') {
    try {
      cleanup();
    } catch (e) {
      console.error(e);
    }
  }
  cleanup = null;
}

// ---------- home ----------
function mountHome() {
  document.title = 'Tools';
  view.innerHTML = `<section class="home">
    <div class="seg cats" id="cats">${CATS.map((c) => `<button data-v="${c.id}" class="${c.id === cat ? 'on' : ''}">${c.name}</button>`).join('')}</div>
    <div class="grid${firstHome ? '' : ' quiet'}" id="grid">${TOOLS.map(
      (t, i) =>
        `<a class="tile" href="/${t.id}" data-id="${t.id}" style="--i:${i};--c:${catOf(t).color}"><span class="ic"><i class="${t.icon}"></i></span><span class="nm">${t.name}</span></a>`,
    ).join('')}</div>
    <div class="empty" id="empty"><i class="fa-solid fa-magnifying-glass"></i><span>찾는 도구가 없어요</span></div>
  </section>`;
  firstHome = false;
  seg($('#cats'), (v) => {
    cat = v;
    applyFilter(true);
  });
  applyFilter(false);
}

const norm = (s) => s.toLowerCase().replace(/\s+/g, '');
function matches(t, q) {
  if (cat !== 'all' && t.cat !== cat) return false;
  if (!q) return true;
  return norm(`${t.name} ${t.id} ${t.kw} ${catOf(t).name}`).includes(norm(q));
}

function applyFilter(animate) {
  const grid = $('#grid');
  if (!grid) return;
  const q = search.value.trim();
  const tiles = $$('.tile', grid);
  const before = new Map(tiles.map((t) => [t, t.hidden ? null : t.getBoundingClientRect()]));
  let n = 0;
  for (const el of tiles) {
    const ok = matches(TOOLS.find((x) => x.id === el.dataset.id), q);
    el.hidden = !ok;
    if (ok) n++;
  }
  $('#empty').classList.toggle('show', n === 0);
  if (!animate || reduce.matches) return;
  // FLIP: 남은 타일은 제자리로 미끄러지고, 새로 나타난 타일은 튀어 오른다
  let k = 0;
  for (const el of tiles) {
    if (el.hidden) continue;
    el.style.animation = 'none';
    const a = before.get(el);
    const b = el.getBoundingClientRect();
    if (a) {
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' });
    } else {
      el.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], {
        duration: 480,
        delay: k++ * 22,
        easing: 'cubic-bezier(.34,1.56,.64,1)',
        fill: 'backwards',
      });
    }
  }
}

// ---------- tool ----------
function mountTool(tool, mod) {
  document.title = `${tool.name} · Tools`;
  view.innerHTML = `<section class="tool" style="--c:${catOf(tool).color}">
    <div class="tool-head">
      <a class="back" href="/" aria-label="홈으로"><i class="fa-solid fa-arrow-left"></i></a>
      <span class="ic" style="view-transition-name:hero-ic"><i class="${tool.icon}"></i></span>
      <h1 style="view-transition-name:hero-nm">${tool.name}</h1>
    </div>
    <div class="tool-body" id="body"></div>
  </section>`;
  const body = $('#body');
  if (!mod) {
    body.innerHTML = `<div class="err"><i class="fa-solid fa-triangle-exclamation"></i><span>도구를 불러오지 못했어요. 새로고침해 주세요.</span></div>`;
    return;
  }
  try {
    cleanup = mod.default(body, tool) || null;
  } catch (e) {
    console.error(e);
    body.innerHTML = `<div class="err"><i class="fa-solid fa-triangle-exclamation"></i><span>${e.message}</span></div>`;
  }
  paintRanges(body);
}

// ---------- router ----------
async function render({ tile = null, animate = true } = {}) {
  const tok = ++renderTok;
  const id = idFromPath();
  const tool = TOOLS.find((t) => t.id === id);
  let mod = null;
  if (tool) {
    try {
      mod = await tool.load();
    } catch (e) {
      console.error(e);
    }
  }
  if (tok !== renderTok) return;

  const swap = () => {
    teardown();
    if (tool) {
      mountTool(tool, mod);
      lastTool = tool.id;
      window.scrollTo(0, 0);
    } else {
      mountHome();
      const back = lastTool && $(`.tile[data-id="${lastTool}"]`);
      if (back && useVT) nameHero(back);
      window.scrollTo(0, homeScroll);
    }
  };

  const useVT = animate && !!document.startViewTransition && !reduce.matches;
  if (!useVT) return swap();
  if (tile) nameHero(tile);
  // 화면이 그려지지 않는 상태(가려진 탭 등)에선 전환 콜백이 멈출 수 있어 직접 바꾼다
  let swapped = false;
  const once = () => {
    if (swapped) return;
    swapped = true;
    swap();
  };
  const vt = document.startViewTransition(once);
  vt.ready.catch(() => {});
  vt.updateCallbackDone.catch(() => {});
  setTimeout(() => {
    if (swapped) return;
    vt.skipTransition();
    once();
  }, 400);
  vt.finished.catch(() => {}).finally(() => $$('.tile .ic, .tile .nm').forEach((el) => (el.style.viewTransitionName = '')));
}

function nameHero(tile) {
  $('.ic', tile).style.viewTransitionName = 'hero-ic';
  $('.nm', tile).style.viewTransitionName = 'hero-nm';
}

function go(path, opts = {}) {
  if (path === location.pathname) return;
  if (!idFromPath()) homeScroll = scrollY;
  history.pushState({}, '', path);
  render(opts);
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="/"]');
  if (!a || a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
  e.preventDefault();
  go(a.getAttribute('href'), { tile: a.classList.contains('tile') ? a : null });
});

addEventListener('popstate', () => render());

// ---------- search ----------
search.addEventListener('input', () => {
  if (idFromPath()) go('/');
  else applyFilter(true);
});

search.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    search.value = '';
    applyFilter(true);
    search.blur();
  } else if (e.key === 'Enter') {
    const first = $$('#grid .tile').find((t) => !t.hidden);
    if (first) {
      search.blur();
      first.click();
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey) return;
  const t = e.target;
  if (t.closest?.('input, textarea, select, [contenteditable]')) return;
  e.preventDefault();
  search.focus();
  search.select();
});

addEventListener('scroll', () => top.classList.toggle('scrolled', scrollY > 4), { passive: true });

render({ animate: false });
