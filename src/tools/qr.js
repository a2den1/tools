import QRCode from 'qrcode';
import { $, seg, segHTML, range, paintRanges, download, debounce, pop } from '../ui.js';

export default function (root) {
  root.innerHTML = `
    <div class="split">
      <div class="stack">
        <textarea class="field" id="text" rows="4" placeholder="링크나 글자" style="min-height:120px">https://</textarea>
        <div class="panel stack" style="gap:18px">
          <div><span class="label">오류 복원</span>${segHTML([['L', '낮음'], ['M', '보통'], ['Q', '높음'], ['H', '최고']], 'M', 'fill')}</div>
          <div class="row">
            <label class="color-pick"><span class="mc-dot" style="--dot:#101828"><input type="color" id="fg" value="#101828"></span>전경</label>
            <label class="color-pick"><span class="mc-dot" style="--dot:#ffffff"><input type="color" id="bg" value="#ffffff"></span>배경</label>
          </div>
          ${range('size', '저장 크기', 128, 2048, 1024, 64, 'px')}
          ${range('margin', '여백', 0, 8, 2)}
        </div>
      </div>
      <div class="stack" style="position:sticky;top:92px">
        <div class="qr-box" id="box"><canvas id="cv"></canvas><div class="qr-empty" id="empty" hidden><i class="fa-solid fa-qrcode"></i></div></div>
        <div class="row">
          <button class="btn good grow" id="png"><i class="fa-solid fa-download"></i>PNG</button>
          <button class="btn soft grow" id="svg"><i class="fa-solid fa-bezier-curve"></i>SVG</button>
        </div>
      </div>
    </div>`;
  paintRanges(root);
  const text = $('#text', root);
  const cv = $('#cv', root);
  const ecc = seg($('.seg', root), draw);
  const opts = (width) => ({
    errorCorrectionLevel: ecc.value,
    margin: +$('#margin', root).value,
    width,
    color: { dark: $('#fg', root).value, light: $('#bg', root).value },
  });

  let last = '';
  async function draw() {
    const v = text.value;
    const empty = !v.trim();
    $('#empty', root).hidden = !empty;
    cv.hidden = empty;
    if (empty) return;
    try {
      await QRCode.toCanvas(cv, v, opts(560));
      cv.style.width = '';
      if (v !== last) pop(cv);
      last = v;
    } catch (e) {
      $('#empty', root).hidden = false;
      cv.hidden = true;
    }
  }
  const later = debounce(draw, 120);
  root.addEventListener('input', (e) => {
    if (e.target.type === 'color') e.target.parentElement.style.setProperty('--dot', e.target.value);
    later();
  });
  $('#png', root).addEventListener('click', async () => {
    if (!text.value.trim()) return;
    const url = await QRCode.toDataURL(text.value, opts(+$('#size', root).value));
    download(url, 'qrcode.png');
  });
  $('#svg', root).addEventListener('click', async () => {
    if (!text.value.trim()) return;
    const svg = await QRCode.toString(text.value, { ...opts(+$('#size', root).value), type: 'svg' });
    download(new Blob([svg], { type: 'image/svg+xml' }), 'qrcode.svg');
  });
  draw();
  setTimeout(() => {
    text.focus();
    text.setSelectionRange(text.value.length, text.value.length);
  }, 300);
}
