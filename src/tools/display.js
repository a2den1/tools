import { $, $$, seg, segHTML, sw, range, paintRanges, copyBtn, esc } from '../ui.js';
import { parse, toComponent, toSNBT, previewHTML, startObfuscation, toolbarHTML, bindToolbar } from './mc-common.js';

const BLOCKS = ['stone', 'grass_block', 'dirt', 'oak_planks', 'oak_log', 'cobblestone', 'glass', 'white_wool', 'diamond_block', 'gold_block', 'iron_block', 'emerald_block', 'redstone_block', 'redstone_lamp', 'glowstone', 'sea_lantern', 'tnt', 'chest', 'barrel', 'crafting_table', 'furnace', 'bookshelf', 'lantern', 'campfire', 'oak_stairs', 'oak_slab', 'oak_fence', 'torch', 'beacon', 'obsidian', 'netherite_block', 'amethyst_block', 'honey_block', 'slime_block'];
const ITEMS = ['diamond', 'diamond_sword', 'netherite_sword', 'iron_sword', 'bow', 'crossbow', 'trident', 'apple', 'golden_apple', 'enchanted_golden_apple', 'totem_of_undying', 'emerald', 'nether_star', 'ender_pearl', 'compass', 'clock', 'map', 'book', 'writable_book', 'player_head', 'elytra', 'shield', 'fishing_rod', 'cake', 'bread', 'cookie', 'blaze_rod', 'heart_of_the_sea', 'music_disc_cat', 'spyglass'];
const BLOCK_TINT = { stone: '#8a8a8a', grass_block: '#6aa84f', dirt: '#8b5a2b', oak_planks: '#b8945f', oak_log: '#6b5132', cobblestone: '#7a7a7a', glass: '#cfe8f3', white_wool: '#f2f2f2', diamond_block: '#62e6d8', gold_block: '#f5d33b', iron_block: '#dcdcdc', emerald_block: '#2ecc71', redstone_block: '#b0120a', redstone_lamp: '#c9793a', glowstone: '#f0c35a', sea_lantern: '#bfe3dc', tnt: '#d23b2b', obsidian: '#1b1428', netherite_block: '#443f42', amethyst_block: '#9a6ad6', honey_block: '#f3a526', slime_block: '#7ccf5b' };
const DISPLAY_MODES = [['none', '기본'], ['gui', 'GUI'], ['ground', '바닥'], ['fixed', '액자'], ['head', '머리'], ['thirdperson_righthand', '손']];

const f = (n) => `${+Number(n).toFixed(4)}f`;
const vec = (a) => `[${a.map(f).join(',')}]`;
const nsId = (s, fallback) => {
  s = (s || '').trim().toLowerCase() || fallback;
  return s.includes(':') ? s : 'minecraft:' + s;
};

// 도(degree) → 쿼터니언 (Y·X·Z 순서)
function quat(xd, yd, zd) {
  const [x, y, z] = [xd, yd, zd].map((d) => ((d * Math.PI) / 180) / 2);
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(x), Math.sin(x), Math.cos(y), Math.sin(y), Math.cos(z), Math.sin(z)];
  return [sx * cy * cz + cx * sy * sz, cx * sy * cz - sx * cy * sz, cx * cy * sz - sx * sy * cz, cx * cy * cz + sx * sy * sz];
}

function rotate([x, y, z, w], [vx, vy, vz]) {
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}

const argb = (hex, a) => {
  const n = ((a & 255) << 24) | parseInt(hex.slice(1), 16);
  return n | 0;
};

export default function (root) {
  root.innerHTML = `
    <div class="row">
      ${segHTML([['text', '<i class="fa-solid fa-font"></i> 텍스트'], ['block', '<i class="fa-solid fa-cube"></i> 블록'], ['item', '<i class="fa-solid fa-gem"></i> 아이템']], 'text', 'accent')}
      <span class="grow"></span>
      <select class="field" id="ver" style="width:auto;height:44px">
        <option value="new">1.21.5 이상</option>
        <option value="mid">1.20.5 – 1.21.4</option>
        <option value="old">1.19.4 – 1.20.4</option>
      </select>
    </div>
    <div class="dp-stage" id="stage">
      <div class="dp-text" id="pv-text"></div>
      <div class="dp-cube" id="pv-cube"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="dp-item" id="pv-item"><i class="fa-solid fa-gem"></i></div>
    </div>
    <div class="panel stack" id="p-text">
      ${toolbarHTML()}
      <textarea class="field mono" id="txt" rows="3" spellcheck="false" style="min-height:96px">&e&l환영합니다!
&f스폰 지역</textarea>
      <div class="row">
        ${segHTML([['left', '<i class="fa-solid fa-align-left"></i>'], ['center', '<i class="fa-solid fa-align-center"></i>'], ['right', '<i class="fa-solid fa-align-right"></i>']], 'center')}
        ${sw('shadow', '글자 그림자')}
        ${sw('see', '벽 너머로 보기')}
        ${sw('defbg', '기본 배경')}
      </div>
      <div class="two">
        ${range('lw', '줄 너비', 10, 400, 200)}
        ${range('op', '글자 불투명도', 26, 255, 255)}
      </div>
      <div class="two">
        <div class="row" style="flex-wrap:nowrap">
          <label class="mc-dot" style="--dot:#000000;flex-shrink:0" title="배경 색"><input type="color" id="bgc" value="#000000"></label>
          <div class="grow">${range('bga', '배경 불투명도', 0, 255, 64)}</div>
        </div>
      </div>
    </div>
    <div class="panel stack" id="p-block" hidden>
      <div class="two">
        <div><span class="label">블록</span><input class="field mono" id="block" list="dl-blocks" value="grass_block" spellcheck="false"></div>
        <div><span class="label">블록 상태</span><input class="field mono" id="props" placeholder="facing=north,lit=true" spellcheck="false"></div>
      </div>
      ${sw('centerb', '블록 중심을 위치에 맞추기', true)}
      <datalist id="dl-blocks">${BLOCKS.map((b) => `<option value="${b}">`).join('')}</datalist>
    </div>
    <div class="panel stack" id="p-item" hidden>
      <div><span class="label">아이템</span><input class="field mono" id="item" list="dl-items" value="diamond_sword" spellcheck="false"></div>
      <div><span class="label">표시 방식</span>${segHTML(DISPLAY_MODES, 'none', 'fill')}</div>
      <datalist id="dl-items">${ITEMS.map((b) => `<option value="${b}">`).join('')}</datalist>
    </div>
    <div class="panel stack">
      <div><span class="label">위치</span><div class="xyz"><input class="field mono" id="px" value="~"><input class="field mono" id="py" value="~"><input class="field mono" id="pz" value="~"></div></div>
      <div><span class="label">방향</span>${segHTML([['fixed', '고정'], ['vertical', '세로축 회전'], ['horizontal', '가로축 회전'], ['center', '항상 정면']], 'center', 'fill')}</div>
      <div class="two">
        <div><span class="label">크기</span><div class="xyz"><input class="field mono" type="number" step="0.1" id="sx" value="1"><input class="field mono" type="number" step="0.1" id="sy" value="1"><input class="field mono" type="number" step="0.1" id="sz" value="1"></div></div>
        <div><span class="label">이동</span><div class="xyz"><input class="field mono" type="number" step="0.1" id="tx" value="0"><input class="field mono" type="number" step="0.1" id="ty" value="0"><input class="field mono" type="number" step="0.1" id="tz" value="0"></div></div>
      </div>
      <div class="three">
        ${range('rx', 'X 회전', -180, 180, 0, 1, '°')}
        ${range('ry', 'Y 회전', -180, 180, 0, 1, '°')}
        ${range('rz', 'Z 회전', -180, 180, 0, 1, '°')}
      </div>
    </div>
    <div class="panel stack">
      <div class="row">${sw('bright', '밝기 고정')}${sw('glow', '발광')}<label class="mc-dot" id="glowc-wrap" style="--dot:#ffffff" hidden title="발광 색"><input type="color" id="glowc" value="#ffffff"></label></div>
      <div class="two" id="bright-wrap" hidden>
        ${range('bsky', '하늘 빛', 0, 15, 15)}
        ${range('bblock', '블록 빛', 0, 15, 15)}
      </div>
      <div class="three">
        ${range('vr', '보이는 거리', 0.1, 5, 1, 0.1, '×')}
        ${range('shr', '그림자 크기', 0, 5, 0, 0.1)}
        ${range('shs', '그림자 진하기', 0, 1, 1, 0.05)}
      </div>
      <div><span class="label">태그</span><input class="field mono" id="tags" placeholder="태그1, 태그2" spellcheck="false"></div>
    </div>
    <div class="stack">
      <div class="out" style="align-items:flex-start;padding-top:14px;padding-bottom:14px">
        <pre class="v mono" id="cmd" style="margin:0;white-space:pre-wrap;word-break:break-all"></pre>
        ${copyBtn('#cmd')}
      </div>
      <div class="row between"><span class="muted mono" id="len"></span><span class="muted" id="lenwarn"></span></div>
    </div>`;
  paintRanges(root);

  const v = (id) => $('#' + id, root).value;
  const n = (id) => Number($('#' + id, root).value) || 0;
  const on = (id) => $('#' + id, root).checked;
  const segs = $$('.seg', root);
  const type = seg(segs[0], () => {
    $('#p-text', root).hidden = type.value !== 'text';
    $('#p-block', root).hidden = type.value !== 'block';
    $('#p-item', root).hidden = type.value !== 'item';
    const st = $('#stage', root);
    st.dataset.type = type.value;
    st.animate([{ opacity: 0.4, transform: 'scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.22,1,.36,1)' });
    update();
  });
  const align = seg(segs[1], update);
  const mode = seg(segs[2], update);
  const billboard = seg(segs[3], update);
  $('#stage', root).dataset.type = 'text';
  bindToolbar($('.mc-bar', root), () => $('#txt', root), update);

  function build() {
    const ver = v('ver');
    const t = type.value;
    const e = [];
    const sc = [n('sx') || 1, n('sy') || 1, n('sz') || 1];
    let tr = [n('tx'), n('ty'), n('tz')];
    const rot = quat(n('rx'), n('ry'), n('rz'));
    // 블록 모델은 모서리가 원점이라, 회전·크기를 적용한 중심점만큼 되돌려 가운데를 맞춘다
    if (t === 'block' && on('centerb')) tr = rotate(rot, sc.map((s) => s / 2)).map((c, i) => tr[i] - c);

    if (t === 'text') {
      const comp = toComponent(parse(v('txt')));
      if (ver === 'new') e.push(['text', toSNBT(comp)]);
      else e.push(['text', `'${JSON.stringify(comp).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`]);
      if (align.value !== 'center') e.push(['alignment', `"${align.value}"`]);
      if (n('lw') !== 200) e.push(['line_width', n('lw')]);
      if (on('defbg')) e.push(['default_background', '1b']);
      else if (v('bgc') !== '#000000' || n('bga') !== 64) e.push(['background', argb(v('bgc'), n('bga'))]);
      if (n('op') !== 255) e.push(['text_opacity', `${n('op') > 127 ? n('op') - 256 : n('op')}b`]);
      if (on('shadow')) e.push(['shadow', '1b']);
      if (on('see')) e.push(['see_through', '1b']);
    } else if (t === 'block') {
      const props = v('props')
        .split(',')
        .map((s) => s.split('=').map((x) => x.trim()))
        .filter(([k, x]) => k && x);
      const p = props.length ? `,Properties:{${props.map(([k, x]) => `${k}:"${x}"`).join(',')}}` : '';
      e.push(['block_state', `{Name:"${nsId(v('block'), 'stone')}"${p}}`]);
    } else {
      const id = nsId(v('item'), 'diamond');
      e.push(['item', ver === 'old' ? `{id:"${id}",Count:1b}` : `{id:"${id}",count:1}`]);
      if (mode.value !== 'none') e.push(['item_display', `"${mode.value}"`]);
    }

    if (billboard.value !== 'fixed') e.push(['billboard', `"${billboard.value}"`]);
    const idRot = Math.abs(rot[3] - 1) < 1e-9;
    if (!idRot || tr.some((x) => x) || sc.some((x) => x !== 1))
      e.push(['transformation', `{left_rotation:${vec(rot)},right_rotation:[0f,0f,0f,1f],translation:${vec(tr)},scale:${vec(sc)}}`]);
    if (on('bright')) e.push(['brightness', `{sky:${n('bsky')},block:${n('bblock')}}`]);
    if (on('glow')) {
      e.push(['Glowing', '1b']);
      if (v('glowc') !== '#ffffff') e.push(['glow_color_override', parseInt(v('glowc').slice(1), 16)]);
    }
    if (n('vr') !== 1) e.push(['view_range', f(n('vr'))]);
    if (n('shr')) e.push(['shadow_radius', f(n('shr'))]);
    if (n('shr') && n('shs') !== 1) e.push(['shadow_strength', f(n('shs'))]);
    const tags = v('tags')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (tags.length) e.push(['Tags', `[${tags.map((x) => JSON.stringify(x)).join(',')}]`]);

    const pos = [v('px') || '~', v('py') || '~', v('pz') || '~'].join(' ');
    const nbt = e.length ? ` {${e.map(([k, x]) => `${k}:${x}`).join(',')}}` : '';
    return `/summon minecraft:${t}_display ${pos}${nbt}`;
  }

  function preview() {
    const t = type.value;
    const rot = `rotateX(${-n('rx')}deg) rotateY(${n('ry')}deg) rotateZ(${-n('rz')}deg)`;
    const sc = `scale3d(${n('sx') || 1}, ${n('sy') || 1}, ${n('sz') || 1})`;
    const glow = on('glow') ? v('glowc') : null;
    if (t === 'text') {
      const el = $('#pv-text', root);
      const bg = on('defbg') ? 'rgba(0,0,0,.25)' : `color-mix(in srgb, ${v('bgc')} ${(n('bga') / 255) * 100}%, transparent)`;
      el.style.cssText = `background:${bg};text-align:${align.value};max-width:${Math.max(40, n('lw') * 1.6)}px;opacity:${n('op') / 255};transform:${rot} ${sc}`;
      el.classList.toggle('shadow', on('shadow'));
      el.innerHTML = previewHTML(parse(v('txt'))) || '&nbsp;';
    } else if (t === 'block') {
      const el = $('#pv-cube', root);
      const id = (v('block') || '').replace('minecraft:', '').trim();
      el.style.setProperty('--tint', BLOCK_TINT[id] || '#9aa4b2');
      el.style.setProperty('--tf', `${rot} ${sc}`);
      el.style.setProperty('--glow', glow || 'transparent');
      el.classList.toggle('glow', !!glow);
    } else {
      const el = $('#pv-item', root);
      el.style.transform = `${rot} ${sc}`;
      el.classList.toggle('glow', !!glow);
      el.style.setProperty('--glow', glow || 'transparent');
    }
  }

  function update() {
    $('#bright-wrap', root).hidden = !on('bright');
    $('#glowc-wrap', root).hidden = !on('glow');
    const cmd = build();
    $('#cmd', root).textContent = cmd;
    $('#len', root).textContent = `${cmd.length}자`;
    $('#lenwarn', root).textContent = cmd.length > 256 ? '채팅창 한도(256자)를 넘어 명령 블록에서 써야 해요' : '';
    preview();
  }

  root.addEventListener('input', (e) => {
    if (e.target.id === 'glowc' || e.target.id === 'bgc') e.target.parentElement.style.setProperty('--dot', e.target.value);
    update();
  });
  root.addEventListener('change', update);
  update();
  return startObfuscation($('#pv-text', root));
}
