let probe;
// 어떤 CSS 색이든 '#rrggbb' 로. 못 읽으면 null
export function parseColor(str) {
  str = String(str || '').trim();
  if (!str) return null;
  if (/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(str)) str = '#' + str;
  probe ??= document.createElement('canvas').getContext('2d');
  probe.fillStyle = '#010203';
  probe.fillStyle = str;
  const a = probe.fillStyle;
  probe.fillStyle = '#030201';
  probe.fillStyle = str;
  if (a !== probe.fillStyle) return null;
  if (a.startsWith('#')) return a.toLowerCase();
  const m = a.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b] = m[1].split(',').map((x) => Math.round(parseFloat(x)));
  return rgbToHex([r, g, b]);
}

export const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

export function rgbToHsl([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

export function hslToRgb([h, s, l]) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}

export function rgbToHsv([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round(h * 60), Math.round(max ? (d / max) * 100 : 0), Math.round(max * 100)];
}

export function rgbToCmyk([r, g, b]) {
  const k = 1 - Math.max(r, g, b) / 255;
  if (k === 1) return [0, 0, 0, 100];
  return [r, g, b].map((v) => Math.round(((1 - v / 255 - k) / (1 - k)) * 100)).concat(Math.round(k * 100));
}

export function rgbToOklch([r, g, b]) {
  const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, Bb);
  let H = (Math.atan2(Bb, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [+(L * 100).toFixed(1), +C.toFixed(3), C < 0.0001 ? 0 : +H.toFixed(1)];
}

export function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export const readableOn = (rgb) => (luminance(rgb) > 0.45 ? '#101828' : '#ffffff');

export function formats(hex) {
  const rgb = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(rgb);
  const [hv, sv, vv] = rgbToHsv(rgb);
  const [c, m, y, k] = rgbToCmyk(rgb);
  const [L, C, H] = rgbToOklch(rgb);
  return [
    ['HEX', hex.toUpperCase()],
    ['RGB', `rgb(${rgb.join(', ')})`],
    ['HSL', `hsl(${h}, ${s}%, ${l}%)`],
    ['HSV', `hsv(${hv}, ${sv}%, ${vv}%)`],
    ['CMYK', `cmyk(${c}%, ${m}%, ${y}%, ${k}%)`],
    ['OKLCH', `oklch(${L}% ${C} ${H})`],
  ];
}
