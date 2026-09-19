import { $, esc, fmtBytes, fmtTime, toast } from '../ui.js';

const KEY = 'tools.api';
const envBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function apiBase() {
  let saved = '';
  try {
    saved = localStorage.getItem(KEY) || '';
  } catch {}
  return (saved || envBase).replace(/\/+$/, '');
}

function setApiBase(v) {
  try {
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {}
}

export async function api(path, opts = {}) {
  const r = await fetch(apiBase() + path, {
    ...opts,
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  let j = null;
  try {
    j = await r.json();
  } catch {}
  if (!r.ok) throw new Error(j?.error || `서버 오류 (${r.status})`);
  return j;
}

export async function health() {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await fetch(apiBase() + '/api/health', { signal: ctl.signal });
    const j = await r.json();
    return j.ok ? j : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export const isYouTube = (s) => {
  try {
    const u = new URL(s.trim());
    return /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname);
  } catch {
    return false;
  }
};

// 서버가 안 잡히면 주소 입력 패널을 보여주고, 잡히면 onReady 호출
export async function gate(root, onReady) {
  root.innerHTML = `<div class="panel row"><i class="fa-solid fa-circle-notch fa-spin muted"></i><span class="muted">서버 연결 중</span></div>`;
  const h = await health();
  if (!root.isConnected) return;
  if (h) return onReady(h);
  root.innerHTML = `
    <div class="panel stack">
      <div class="row" style="gap:14px">
        <span class="ic" style="width:44px;height:44px;font-size:18px;border-radius:14px"><i class="fa-solid fa-plug-circle-xmark"></i></span>
        <b style="font-size:17px">다운로드 서버에 연결할 수 없어요</b>
      </div>
      <div class="row">
        <input class="field grow mono" id="api-url" placeholder="https://서버-주소" value="${esc(apiBase())}" style="flex-basis:260px">
        <button class="btn" id="api-save"><i class="fa-solid fa-plug"></i>연결</button>
      </div>
    </div>`;
  const inp = $('#api-url', root);
  const retry = async () => {
    const v = inp.value.trim().replace(/\/+$/, '');
    if (v && !/^https?:\/\//.test(v)) return toast('http:// 또는 https:// 로 시작해야 해요', 'fa-circle-exclamation');
    setApiBase(v);
    gate(root, onReady);
  };
  $('#api-save', root).addEventListener('click', retry);
  inp.addEventListener('keydown', (e) => e.key === 'Enter' && retry());
}

export function urlBar(placeholder = '유튜브 링크 붙여넣기') {
  return `
    <div class="row" style="flex-wrap:nowrap">
      <div class="grow" style="position:relative">
        <input class="field" id="yt-url" placeholder="${placeholder}" autocomplete="off" spellcheck="false" style="height:56px;padding-right:52px;font-size:16px">
        <button class="icon-btn" id="yt-paste" aria-label="붙여넣기" style="position:absolute;right:8px;top:8px"><i class="fa-regular fa-clipboard"></i></button>
      </div>
      <button class="btn" id="yt-go" style="height:56px;padding:0 22px" aria-label="불러오기"><i class="fa-solid fa-arrow-right"></i></button>
    </div>`;
}

export function bindUrlBar(root, onUrl) {
  const inp = $('#yt-url', root);
  const go = () => {
    const v = inp.value.trim();
    if (!v) return inp.focus();
    if (!isYouTube(v)) {
      inp.classList.remove('pop');
      inp.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }], { duration: 380 });
      return toast('유튜브 링크가 아니에요', 'fa-circle-exclamation');
    }
    onUrl(v);
  };
  $('#yt-go', root).addEventListener('click', go);
  inp.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  inp.addEventListener('paste', () => setTimeout(() => isYouTube(inp.value) && go(), 0));
  $('#yt-paste', root).addEventListener('click', async () => {
    try {
      inp.value = (await navigator.clipboard.readText()).trim();
      go();
    } catch {
      inp.focus();
      toast('Ctrl+V 로 붙여넣어 주세요', 'fa-circle-info');
    }
  });
  setTimeout(() => inp.focus({ preventScroll: true }), 300);
  return inp;
}

export const skeleton = () => `
  <div class="panel yt-card" style="animation:fade .3s both">
    <div class="yt-thumb sk"></div>
    <div class="stack" style="align-content:center;gap:10px">
      <div class="sk" style="height:20px;width:80%;border-radius:8px"></div>
      <div class="sk" style="height:14px;width:40%;border-radius:8px"></div>
    </div>
  </div>`;

export const card = (info) => `
  <div class="panel yt-card">
    <div class="yt-thumb"><img src="${esc(info.thumbnail)}" alt="" referrerpolicy="no-referrer"><span>${fmtTime(info.duration)}</span></div>
    <div class="stack" style="align-content:center;gap:6px">
      <b class="yt-title">${esc(info.title)}</b>
      <span class="muted">${esc(info.uploader)}</span>
    </div>
  </div>`;

export const errBox = (msg) => `<div class="err"><i class="fa-solid fa-triangle-exclamation"></i><span>${esc(msg)}</span></div>`;

// 작업 진행을 SSE 로 받아 막대에 그리고, 끝나면 파일을 내려받는다
export function runJob(payload, box) {
  box.innerHTML = `
    <div class="panel stack job">
      <div class="row between">
        <b id="job-state">준비 중</b>
        <span class="muted mono" id="job-meta"></span>
      </div>
      <div class="bar" id="job-bar"><i></i></div>
    </div>`;
  const state = $('#job-state', box);
  const meta = $('#job-meta', box);
  const bar = $('#job-bar', box);
  let es = null;
  let closed = false;

  const show = (j) => {
    if (closed) return;
    bar.classList.toggle('indeterminate', j.state === 'queued' || (j.state === 'downloading' && !j.percent));
    bar.firstElementChild.style.width = j.percent + '%';
    if (j.state === 'queued') state.textContent = '대기 중';
    else if (j.state === 'downloading') {
      state.textContent = `받는 중 ${Math.floor(j.percent)}%`;
      meta.textContent = [j.speed ? fmtBytes(j.speed) + '/s' : '', j.eta != null ? fmtTime(j.eta) + ' 남음' : ''].filter(Boolean).join(' · ');
    } else if (j.state === 'processing') {
      state.textContent = '변환 중';
      meta.textContent = '';
      bar.classList.add('indeterminate');
    } else if (j.state === 'done') {
      closed = true;
      es?.close();
      bar.classList.remove('indeterminate');
      bar.firstElementChild.style.width = '100%';
      const url = `${apiBase()}/api/jobs/${j.id}/file`;
      box.innerHTML = `
        <div class="panel row job-done">
          <span class="ic" style="--c:var(--good);width:44px;height:44px;font-size:18px;border-radius:14px"><i class="fa-solid fa-check"></i></span>
          <div class="grow" style="min-width:160px">
            <b style="display:block;overflow-wrap:anywhere">${esc(j.filename)}</b>
            <span class="muted">${fmtBytes(j.size)}</span>
          </div>
          <a class="btn good" href="${esc(url)}" download><i class="fa-solid fa-download"></i>저장</a>
        </div>`;
      const a = $('a', box);
      a.click();
      toast('다운로드를 시작했어요', 'fa-download');
    } else if (j.state === 'error') {
      closed = true;
      es?.close();
      box.innerHTML = errBox(j.error || '다운로드에 실패했어요');
    }
  };

  api('/api/jobs', { method: 'POST', body: JSON.stringify(payload) })
    .then((j) => {
      show(j);
      es = new EventSource(`${apiBase()}/api/jobs/${j.id}/events`);
      es.onmessage = (e) => show(JSON.parse(e.data));
      es.onerror = () => {
        if (closed) return;
        // 연결이 끊기면 상태를 한 번 직접 물어본다
        es.close();
        const poll = async () => {
          if (closed || !box.isConnected) return;
          try {
            const s = await api(`/api/jobs/${j.id}`);
            show(s);
            if (!closed) setTimeout(poll, 1000);
          } catch (err) {
            show({ state: 'error', error: err.message });
          }
        };
        poll();
      };
    })
    .catch((e) => show({ state: 'error', error: e.message }));

  return () => {
    closed = true;
    es?.close();
  };
}
