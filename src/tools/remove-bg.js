import { $, $$, seg, segHTML, download, baseName, toast, loadImage, canvasToBlob } from '../ui.js';
import { imageFlow, fileInfo, compare } from './img-common.js';

const BGS = [
  ['none', '투명'],
  ['#ffffff', '흰색'],
  ['#000000', '검정'],
  ['#0a6cff', '파랑'],
  ['#2fb457', '초록'],
];

export default function (root) {
  let alive = true;
  let run = 0;
  const flow = imageFlow(root, show);

  function show({ file, img, url }) {
    const my = ++run;
    root.innerHTML = `
      <div class="panel stack">
        <div class="row between">${fileInfo(file, img)}<button class="icon-btn" id="again" aria-label="다른 이미지"><i class="fa-solid fa-rotate"></i></button></div>
        <div class="row">${segHTML([['isnet_fp16', '정밀하게'], ['isnet_quint8', '빠르게']], 'isnet_fp16')}</div>
        <div id="prog" hidden class="stack" style="gap:8px">
          <div class="row between"><span class="muted" id="prog-t"></span><b class="mono" id="prog-p"></b></div>
          <div class="bar"><i></i></div>
        </div>
        <button class="btn wide" id="go" style="height:54px"><i class="fa-solid fa-wand-magic-sparkles"></i>배경 제거</button>
      </div>
      <div id="res"><div class="preview checker"><img src="${url}" alt=""></div></div>`;
    $('#again', root).addEventListener('click', () => flow.open());
    const quality = seg($('.seg', root));

    $('#go', root).addEventListener('click', async () => {
      const go = $('#go', root);
      const prog = $('#prog', root);
      const bar = $('.bar', prog);
      const t = $('#prog-t', root);
      const p = $('#prog-p', root);
      go.disabled = true;
      go.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>처리 중`;
      prog.hidden = false;
      bar.classList.add('indeterminate');
      t.textContent = '준비 중';
      p.textContent = '';
      try {
        const { removeBackground } = await import('@imgly/background-removal');
        const blob = await removeBackground(file, {
          model: quality.value,
          output: { format: 'image/png' },
          progress: (key, cur, total) => {
            if (!alive || my !== run) return;
            if (key.startsWith('fetch')) {
              t.textContent = '모델 받는 중';
              if (total) {
                bar.classList.remove('indeterminate');
                bar.firstElementChild.style.width = (cur / total) * 100 + '%';
                p.textContent = Math.round((cur / total) * 100) + '%';
              }
            } else {
              t.textContent = '배경 지우는 중';
              p.textContent = '';
              bar.classList.add('indeterminate');
            }
          },
        });
        if (!alive || my !== run) return;
        result(file, url, blob);
      } catch (e) {
        if (alive && my === run) toast(e.message || '배경 제거에 실패했어요', 'fa-circle-exclamation');
      } finally {
        if (alive && my === run) {
          prog.hidden = true;
          go.disabled = false;
          go.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i>다시 하기`;
        }
      }
    });
  }

  function result(file, url, blob) {
    const cut = URL.createObjectURL(blob);
    const res = $('#res', root);
    compare(res, url, cut, { checker: true });
    res.insertAdjacentHTML(
      'beforeend',
      `<div class="row" style="margin-top:14px">
        <div class="swatches grow">${BGS.map(
          ([c, n], i) =>
            `<button class="sw-dot${i === 0 ? ' on' : ''}" data-c="${c}" aria-label="${n}" style="--dot:${c === 'none' ? 'transparent' : c}">${c === 'none' ? '<i class="fa-solid fa-chess-board"></i>' : ''}</button>`,
        ).join('')}
          <label class="sw-dot pick" aria-label="직접 고르기"><input type="color" value="#ff6b6b"><i class="fa-solid fa-eye-dropper"></i></label>
        </div>
        <button class="btn good" id="save"><i class="fa-solid fa-download"></i>PNG 저장</button>
      </div>`,
    );
    const cmp = $('.cmp', res);
    let bg = 'none';
    const setBg = (c, el) => {
      bg = c;
      $$('.sw-dot', res).forEach((d) => d.classList.toggle('on', d === el));
      cmp.classList.toggle('checker', c === 'none');
      cmp.style.backgroundColor = c === 'none' ? '' : c;
      // '전' 쪽은 원본이 그대로 보이게 배경색을 결과 쪽에만 적용
      $('.cmp-a', cmp).style.backgroundColor = c === 'none' ? '' : c;
    };
    $$('button.sw-dot', res).forEach((b) => b.addEventListener('click', () => setBg(b.dataset.c, b)));
    const pick = $('.pick input', res);
    pick.addEventListener('input', () => {
      pick.parentElement.style.setProperty('--dot', pick.value);
      setBg(pick.value, pick.parentElement);
    });
    $('#save', root).addEventListener('click', async () => {
      let out = blob;
      if (bg !== 'none') {
        const im = await loadImage(cut);
        const c = document.createElement('canvas');
        c.width = im.naturalWidth;
        c.height = im.naturalHeight;
        const g = c.getContext('2d');
        g.fillStyle = bg;
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(im, 0, 0);
        out = await canvasToBlob(c, 'image/png');
      }
      download(out, `${baseName(file.name)}_누끼.png`);
    });
  }

  return () => {
    alive = false;
    flow.destroy();
  };
}
