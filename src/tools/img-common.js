import { $, dropzone, loadImage, fmtBytes, esc, toast } from '../ui.js';

export const dropHTML = (text = '이미지를 끌어오거나 클릭', icon = 'fa-solid fa-cloud-arrow-up') => `
  <div class="drop" id="drop">
    <i class="${icon}"></i>
    <b>${text}</b>
    <span>붙여넣기(Ctrl+V)도 돼요</span>
  </div>`;

// 드롭존 → 이미지 한 장을 { file, img, url } 로 show 에 넘긴다.
// show 가 화면을 새로 그려도 숨은 드롭존을 다시 붙여서 붙여넣기·다시 고르기가 계속 된다.
export function imageFlow(root, show, { accept = 'image/*', text } = {}) {
  let dz = null;
  let url = null;
  const bind = () => {
    dz?.destroy();
    let drop = $('#drop', root);
    if (!drop) {
      root.insertAdjacentHTML('beforeend', dropHTML(text));
      drop = $('#drop', root);
      drop.hidden = true;
    }
    dz = dropzone(
      drop,
      async ([file]) => {
        try {
          const next = URL.createObjectURL(file);
          const img = await loadImage(next);
          if (url) URL.revokeObjectURL(url);
          url = next;
          show({ file, img, url });
          bind();
        } catch (e) {
          toast(e.message, 'fa-circle-exclamation');
        }
      },
      { accept },
    );
  };
  root.innerHTML = dropHTML(text);
  bind();
  return {
    open: () => dz?.open(),
    destroy() {
      dz?.destroy();
      if (url) URL.revokeObjectURL(url);
    },
  };
}

export const fileInfo = (file, img) =>
  `<span class="muted">${esc(file.name)} · ${img.naturalWidth}×${img.naturalHeight} · ${fmtBytes(file.size)}</span>`;

// 전/후 비교 슬라이더
export function compare(el, beforeSrc, afterSrc, { checker = false } = {}) {
  el.innerHTML = `
    <div class="cmp ${checker ? 'checker' : ''}">
      <img class="cmp-a" src="${afterSrc}" alt="" draggable="false">
      <div class="cmp-b"><img src="${beforeSrc}" alt="" draggable="false"></div>
      <div class="cmp-h"><span><i class="fa-solid fa-left-right"></i></span></div>
      <em class="cmp-l">전</em><em class="cmp-r">후</em>
    </div>`;
  const box = $('.cmp', el);
  const set = (x) => box.style.setProperty('--x', Math.min(100, Math.max(0, x)) + '%');
  set(50);
  const move = (e) => {
    const r = box.getBoundingClientRect();
    set(((e.clientX - r.left) / r.width) * 100);
  };
  let wig = null;
  box.addEventListener('pointerdown', (e) => {
    wig?.cancel();
    box.setPointerCapture(e.pointerId);
    box.classList.add('drag');
    move(e);
  });
  box.addEventListener('pointermove', (e) => box.hasPointerCapture(e.pointerId) && move(e));
  box.addEventListener('pointerup', () => box.classList.remove('drag'));
  // 처음 한 번 좌우로 흔들어 슬라이더임을 알려준다
  wig = box.animate([{ '--x': '50%' }, { '--x': '35%' }, { '--x': '62%' }, { '--x': '50%' }], { duration: 1200, easing: 'cubic-bezier(.22,1,.36,1)', delay: 250 });
}

// 이미지 그리기용 캔버스 (최대 변 길이 제한)
export function toCanvas(img, maxSide = Infinity) {
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * s));
  c.height = Math.max(1, Math.round(img.naturalHeight * s));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}
