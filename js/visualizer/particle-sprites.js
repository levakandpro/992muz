import { wave } from '/js/visualizer/waves.js';

// Спрайты рисуются один раз и потом только масштабируются через drawImage.
// Это в разы быстрее, чем shadowBlur или градиент на каждую частицу,
// и одинаково работает в предпросмотре и при экспорте в MP4.

export const KIND = { glow: 0, bokeh: 1, dot: 2 };

const SIZE = 64;
const MAX_SPRITES = 400;
const cache = new Map();

let hex1 = '';
let rgb1 = [255, 255, 255];
let hex2 = '';
let rgb2 = [255, 255, 255];

let customRgb = [255, 255, 255];
let customHex = '';
let softLevel = 3;

// Движок вызывает это в начале каждого кадра.
export function setCustomColor(hex) {
  if (hex !== customHex) {
    customHex = hex;
    customRgb = parseHex(hex);
  }
}

// Мягкость 0..1 округляется до 7 ступеней, чтобы спрайтов было немного.
export function setSoftness(v) {
  softLevel = Math.round(Math.min(1, Math.max(0, v)) * 6);
}
function parseHex(hex) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) h = 'ffffff';
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function waveColor1() {
  if (wave.color1 !== hex1) {
    hex1 = wave.color1;
    rgb1 = parseHex(hex1);
  }
  return rgb1;
}

function waveColor2() {
  if (wave.color2 !== hex2) {
    hex2 = wave.color2;
    rgb2 = parseHex(hex2);
  }
  return rgb2;
}

function hslInto(out, h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  out[0] = (r + m) * 255;
  out[1] = (g + m) * 255;
  out[2] = (b + m) * 255;
  return out;
}

// Цвет одной частицы. hue и mix — случайные числа 0..1, заданные при рождении.
// Результат пишется в out (массив из трёх чисел 0..255), чтобы не плодить мусор.
export function particleColor(mode, hue, mix, time, out) {
  if (mode === 'white') {
    out[0] = 255 - mix * 12;
    out[1] = 255 - mix * 6;
    out[2] = 255;
    return out;
  }
  if (mode === 'warm') return hslInto(out, 6 + hue * 46, 1, 0.6);
  if (mode === 'ice') return hslInto(out, 184 + hue * 44, 0.9, 0.72);
  if (mode === 'pink') return hslInto(out, 326 + hue * 26, 0.78, 0.8);
  if (mode === 'ash') {
    const v = 120 + mix * 100;
    out[0] = v + 8;
    out[1] = v + 3;
    out[2] = v - 2;
    return out;
  }
  if (mode === 'custom') {
    out[0] = customRgb[0];
    out[1] = customRgb[1];
    out[2] = customRgb[2];
    return out;
  }
  if (mode === 'rainbow') return hslInto(out, hue * 360 + time * 24, 0.9, 0.64);

  // 'auto': берём цвета из настроек волн
  if (wave.colorMode === 'rainbow') {
    return hslInto(out, 270 + hue * 90 + time * 18 + wave.hue, 0.9, 0.66);
  }
  const a = waveColor1();
  if (wave.colorMode === 'gradient') {
    const b = waveColor2();
    out[0] = a[0] + (b[0] - a[0]) * mix;
    out[1] = a[1] + (b[1] - a[1]) * mix;
    out[2] = a[2] + (b[2] - a[2]) * mix;
    return out;
  }
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}

function build(kind, r, g, b, level) {
  const soft = level / 6;
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const x = c.getContext('2d');
  const h = SIZE / 2;
  const grad = x.createRadialGradient(h, h, 0, h, h, h);
  const col = (a) => `rgba(${r}, ${g}, ${b}, ${a})`;
  const hr = Math.round(r + (255 - r) * 0.75);
  const hg = Math.round(g + (255 - g) * 0.75);
  const hb = Math.round(b + (255 - b) * 0.75);
  const hot = (a) => `rgba(${hr}, ${hg}, ${hb}, ${a})`;

  if (kind === KIND.glow) {
    // яркое горячее ядро и мягкое цветное гало
    // мягкость сдвигает ступени: 0 — плотное ядро, 1 — широкое гало
    const gam = 1 + (0.5 - soft) * 1.2;
    grad.addColorStop(0, hot(1));
    grad.addColorStop(Math.pow(0.14, gam), hot(0.95));
    grad.addColorStop(Math.pow(0.32, gam), col(0.55));
    grad.addColorStop(Math.pow(0.62, gam), col(0.14));
    grad.addColorStop(1, col(0));
  } else if (kind === KIND.bokeh) {
    // «линза»: прозрачная середина и чуть более яркий край
    grad.addColorStop(0, col(0.3));
    grad.addColorStop(0.72, col(0.38));
    grad.addColorStop(0.9, col(0.7));
    grad.addColorStop(1, col(0));
  } else {
    // мягкость: 0 — резкий кружок, 1 — размытое пятно
    grad.addColorStop(0, col(1));
    grad.addColorStop(1 - soft * 0.9, col(0.9));
    grad.addColorStop(1, col(0));
  }
  x.fillStyle = grad;
  x.fillRect(0, 0, SIZE, SIZE);
  return c;
}

// Цвет округляется до 16 градаций на канал, поэтому спрайтов нужно немного.
export function getSprite(kind, r, g, b) {
  const qr = Math.min(15, Math.max(0, Math.round(r / 17)));
  const qg = Math.min(15, Math.max(0, Math.round(g / 17)));
  const qb = Math.min(15, Math.max(0, Math.round(b / 17)));
  const key = kind * 4096 + qr * 256 + qg * 16 + qb + softLevel * 16384;
  let s = cache.get(key);
  if (!s) {
    if (cache.size >= MAX_SPRITES) cache.clear();
       s = build(kind, qr * 17, qg * 17, qb * 17, softLevel);
    cache.set(key, s);
  }
  return s;
}
