// BotGuard 로 PO(Proof of Origin) 토큰을 만든다.
// 유튜브는 이 토큰이 없으면 서버(특히 데이터센터 IP)의 요청을 봇으로 보고 막거나 스트림을 앞부분만 준다.
import { BotGuardClient } from 'bgutils-js/botguard';
import { buildURL, parseLooseJSON, getHeaders, USER_AGENT } from 'bgutils-js/utils';
import { WebPoMinter } from 'bgutils-js/webpo';
import { JSDOM } from 'jsdom';

const REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';
let minterP = null;
let expiresAt = 0;

async function createMinter() {
  const page = await fetch('https://www.youtube.com', { headers: { accept: '*/*', 'accept-language': 'en-US,en;q=0.7', 'user-agent': USER_AGENT } });
  const html = await page.text();
  const cfg = html.match(/ytcfg\.set\(({.+?})\);/s)?.[1];
  const att = html.match(/window\.ytAtN\(\s*({[\s\S]*?})\s*\)/);
  if (!cfg || !att) throw new Error('유튜브 보안 확인 정보를 찾지 못했어요');

  const dom = new JSDOM('<!DOCTYPE html><html lang="en"><head><title></title></head><body></body></html>', {
    url: 'https://www.youtube.com',
    referrer: 'https://www.youtube.com/',
    userAgent: USER_AGENT,
  });
  dom.window.yt = { config_: JSON.parse(cfg) };
  Object.assign(globalThis, { yt: dom.window.yt, window: dom.window, document: dom.window.document, location: dom.window.location, origin: dom.window.origin });
  if (!('navigator' in globalThis)) Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

  const challenge = parseLooseJSON(att[1]).R?.bgChallenge;
  if (!challenge) throw new Error('보안 확인 문제를 받지 못했어요');
  const vmUrl = challenge.interpreterUrl.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue;
  const vm = await (await fetch(`https:${vmUrl}`)).text();
  new Function(vm)();

  const bg = await BotGuardClient.create({ program: challenge.program, globalName: challenge.globalName, globalObject: globalThis });
  const webPoSignalOutput = [];
  const snapshot = await bg.snapshot({ webPoSignalOutput });
  const it = await (await fetch(buildURL('GenerateIT', true), { method: 'POST', headers: getHeaders(), body: JSON.stringify([REQUEST_KEY, snapshot]) })).json();
  const [integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken] = it;
  if (!integrityToken) throw new Error('보안 토큰을 받지 못했어요');
  expiresAt = Date.now() + Math.max(300, (estimatedTtlSecs || 3600) - (mintRefreshThreshold || 300)) * 1000;
  return WebPoMinter.create({ integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken }, webPoSignalOutput);
}

async function minter() {
  if (!minterP || Date.now() > expiresAt) {
    minterP = createMinter().catch((e) => {
      minterP = null;
      throw e;
    });
  }
  return minterP;
}

const tokens = new Map();

// 영상 ID 에 묶인 토큰 (실패하면 null — 토큰 없이도 되는 경우가 있어서)
export async function poToken(videoId) {
  const hit = tokens.get(videoId);
  if (hit && hit.exp > Date.now()) return hit.token;
  try {
    const token = await (await minter()).mintAsWebsafeString(videoId);
    tokens.set(videoId, { token, exp: expiresAt });
    if (tokens.size > 300) tokens.delete(tokens.keys().next().value);
    return token;
  } catch (e) {
    console.error('[po]', e.message);
    return null;
  }
}
