// ffmpeg.wasm 을 한 번만 불러와 여러 도구가 같이 쓴다
const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

let ffmpeg = null;
let loading = null;
const listeners = new Set();

// @ffmpeg/util 의 toBlobURL 은 gzip 된 Content-Length 를 실제 크기로 믿어서 CDN 에서 멈춘다.
// 받은 양이 헤더보다 커지면 전체 크기를 모르는 것으로 보고 끝까지 받는다.
async function blobURL(url, type, onProgress) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`변환기를 받지 못했어요 (${r.status})`);
  const encoded = !!r.headers.get('content-encoding');
  let total = encoded ? 0 : +r.headers.get('content-length') || 0;
  if (!total && /\.wasm$/.test(url)) total = 32_232_419; // ffmpeg-core 0.12.10 wasm 크기
  const reader = r.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.({ received, total: Math.max(total, received) });
  }
  return URL.createObjectURL(new Blob(chunks, { type }));
}

export const ffmpegReady = () => !!ffmpeg;

export function getFFmpeg(onProgress) {
  if (ffmpeg) return Promise.resolve(ffmpeg);
  if (onProgress) listeners.add(onProgress);
  if (!loading) {
    loading = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const ff = new FFmpeg();
      const coreURL = await blobURL(`${CORE}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await blobURL(`${CORE}/ffmpeg-core.wasm`, 'application/wasm', (e) => listeners.forEach((fn) => fn(e)));
      await ff.load({ coreURL, wasmURL });
      ffmpeg = ff;
      return ff;
    })()
      .catch((e) => {
        loading = null;
        throw e;
      })
      .finally(() => listeners.clear());
  }
  return loading;
}

// 작업을 중간에 멈출 때: 워커를 없애고 다음에 새로 불러온다
export function resetFFmpeg() {
  try {
    ffmpeg?.terminate();
  } catch {}
  ffmpeg = null;
  loading = null;
}
