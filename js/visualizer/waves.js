import { getBeatGrid } from '/js/visualizer/beats.js';

export let VIZ_W = 720;
export let VIZ_H = 1280;
export const BAR_COUNT = 48;

export const FORMATS = {
  '9:16': { w: 720, h: 1280 },
  '1:1': { w: 720, h: 720 },
  '16:9': { w: 1280, h: 720 }
};

export function setFormat(id) {
  const f = FORMATS[id] || FORMATS['9:16'];
  VIZ_W = f.w;
  VIZ_H = f.h;
}
export const WAVE_DEFAULTS = {
  size: 1,
  stretch: 1,
  amp: 1,
  thick: 1,
  rotate: 0,
  x: 0,
  y: 0,
  speed: 1,
  spin: 0,
  pulse: 0,
  opacity: 1,
  glow: 0,
  tiltX: 0,
  tiltY: 0,
  persp: 1,
  hue: 0,
  colorMode: 'rainbow',
  color1: '#b45cff',
  color2: '#ff5aa8',
  bgColor: ''
};

export const wave = { ...WAVE_DEFAULTS };

let transparentBg = false;

export function setTransparent(v) {
  transparentBg = !!v;
}
export function setWave(patch) {
  Object.assign(wave, patch);
}

export function resetWave() {
  Object.assign(wave, WAVE_DEFAULTS);
}

const ampBars = new Float32Array(BAR_COUNT);
export const STYLES = [
  { id: 'bars', name: 'Столбики' },
  { id: 'circle', name: 'Круг' },
  { id: 'line', name: 'Линия' },
  { id: 'sphere', name: 'Сфера' },
  { id: 'mountains', name: 'Горы' },
  { id: 'rings', name: 'Кольца' },
  { id: 'dna', name: 'ДНК' },
  { id: 'petals', name: 'Лепестки' },
  { id: 'pixels', name: 'Пиксели' },
  { id: 'scope', name: 'Осциллограф' },
  { id: 'rain', name: 'Дождь' },
  { id: 'plasma', name: 'Плазма' },
  { id: 'ribbon', name: 'Лента' },
  { id: 'blob', name: 'Капля' }
];

function fillBar(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }
}

// Превращает спектр (значения 0..255) в BAR_COUNT столбиков 0..1.
// Один и тот же код используется и в предпросмотре, и в экспорте.
export function spectrumToBars(freqData, out) {
  const n = freqData.length;
  const start = 2;
  const end = Math.floor(n * 0.75);
  const ratio = end / start;

  for (let i = 0; i < BAR_COUNT; i++) {
    const lo = Math.floor(start * Math.pow(ratio, i / BAR_COUNT));
    const hi = Math.max(lo + 1, Math.floor(start * Math.pow(ratio, (i + 1) / BAR_COUNT)));
    let sum = 0;
    let cnt = 0;
    for (let j = lo; j < hi && j < n; j++) {
      sum += freqData[j];
      cnt++;
    }
    const v = cnt ? sum / cnt / 255 : 0;
    out[i] = Math.pow(v, 1.4);
  }
  return out;
}

let bgImage = null;
let bgVideo = null;

export function setBackgroundImage(img) {
  bgImage = img || null;
}

export function setBackgroundVideo(el) {
  bgVideo = el || null;
}

export function getBackground() {
  return bgVideo && bgVideo.videoWidth ? bgVideo : bgImage;
}

// ---------- слайд-шоу под бит ----------

export const slideshow = { on: false, list: [], every: 2, mode: 'fade' };
let slideT = 0;

export function setSlideTime(t) {
  slideT = t;
}

export function setSlides(list) {
  slideshow.list = list.slice();
}

export function setSlideOpts(patch) {
  Object.assign(slideshow, patch);
}

function drawCover(ctx, src, w, h, alpha, scale) {
  const iw = src.naturalWidth || src.width;
  const ih = src.naturalHeight || src.height;
  const k = Math.max(w / iw, h / ih) * scale;
  ctx.globalAlpha = alpha;
  ctx.drawImage(src, (w - iw * k) / 2, (h - ih * k) / 2, iw * k, ih * k);
  ctx.globalAlpha = 1;
}

// Номер слайда считается от удара (если BPM не найден, один «удар» = 0,5 с).
function drawSlides(ctx, w, h) {
  const n = slideshow.list.length;
  const grid = getBeatGrid();
  const pos = Math.max(0, grid ? (slideT - grid.first) / grid.period : slideT / 0.5);
  const sf = pos / Math.max(1, slideshow.every);
  const i = Math.floor(sf);
  const f = sf - i;
  const cur = slideshow.list[i % n];
  if (slideshow.mode === 'fade' && i > 0) {
    drawCover(ctx, slideshow.list[(i - 1) % n], w, h, 1, 1);
    drawCover(ctx, cur, w, h, Math.min(1, f / 0.3), 1);
  } else if (slideshow.mode === 'zoom') {
    drawCover(ctx, cur, w, h, 1, 1 + 0.12 * Math.pow(1 - f, 3));
  } else {
    drawCover(ctx, cur, w, h, 1, 1);
  }
}
function hueAt(i, count, time) {
  return (270 + (i / count) * 90 + time * 18) % 360;
}
function parseHex(hex) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) h = 'ffffff';
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgbaStr(c, a) {
  return `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a})`;
}

function paletteAt(t) {
  const c1 = parseHex(wave.color1);
  if (wave.colorMode !== 'gradient') return c1;
  return mixRgb(c1, parseHex(wave.color2), Math.min(1, Math.max(0, t)));
}

function colorAt(i, count, time) {
  if (wave.colorMode === 'rainbow') return `hsl(${hueAt(i, count, time) + wave.hue} 90% 62%)`;
  return rgbaStr(paletteAt(i / Math.max(1, count - 1)), 1);
}

function lineTint(hue, a, light, t) {
  if (wave.colorMode === 'rainbow') return `hsla(${hue + wave.hue}, 90%, ${light}%, ${a})`;
  return rgbaStr(paletteAt(t), a);
}

function sphereTint(kind, a) {
  if (wave.colorMode === 'rainbow') {
    if (kind === 'halo') return `hsla(${264 + wave.hue}, 100%, 66%, ${a})`;
    if (kind === 'heart') return `hsla(${300 + wave.hue}, 100%, 83%, ${a})`;
    return `hsla(${268 + wave.hue}, 100%, 79%, ${a})`;
  }
  const c = paletteAt(kind === 'ring' ? 1 : 0);
  if (kind === 'heart') return rgbaStr(mixRgb(c, [255, 255, 255], 0.55), a);
  if (kind === 'ring') return rgbaStr(mixRgb(c, [255, 255, 255], 0.3), a);
  return rgbaStr(c, a);
}

function sphereDot(d, alpha) {
  if (wave.colorMode === 'rainbow') {
    return `hsla(${262 + d * 70 + wave.hue}, 95%, ${55 + d * 25}%, ${alpha})`;
  }
  return rgbaStr(mixRgb(paletteAt(d), [255, 255, 255], d * 0.35), alpha);
}

function glowColor() {
  if (wave.colorMode === 'rainbow') return 'rgba(200, 140, 255, 0.9)';
  return rgbaStr(paletteAt(0.5), 0.9);
}
// ---------- фильтры для фото и видео ----------
// Каждый фильтр — набор CSS-фильтров. Сила 0..1 плавно смешивает «без фильтра» и полный вид.
// g — группа в панели, c — цвет точки-образца, f — CSS-фильтры, t — цветная тонировка поверх.
export const BG_FILTERS = [
  { id: 'none', g: 'Базовые', name: 'Нет', c: '#6b6b76' },
  { id: 'vivid', g: 'Базовые', name: 'Яркий', c: '#ff5fa2', f: { saturate: 1.55, contrast: 1.1 } },
  { id: 'warm', g: 'Базовые', name: 'Тёплый', c: '#ffb347', f: { sepia: 0.28, saturate: 1.25, brightness: 1.05, hue: -8 } },
  { id: 'cold', g: 'Базовые', name: 'Холодный', c: '#5ec8ff', f: { hue: 18, saturate: 1.15, contrast: 1.05, brightness: 1.02 } },
  { id: 'bw', g: 'Базовые', name: 'Ч/Б', c: '#d0d0d0', f: { gray: 1, contrast: 1.15 } },
  { id: 'noir', g: 'Базовые', name: 'Нуар', c: '#3c3c44', f: { gray: 1, contrast: 1.5, brightness: 0.85 } },
  { id: 'sepia', g: 'Базовые', name: 'Сепия', c: '#b08a5a', f: { sepia: 1, contrast: 1.05, brightness: 1.02 } },
  { id: 'fade', g: 'Базовые', name: 'Матовый', c: '#a9a9b6', f: { contrast: 0.8, brightness: 1.1, saturate: 0.85 } },
  { id: 'hdr', g: 'Базовые', name: 'HDR', c: '#ffd166', f: { contrast: 1.35, saturate: 1.35, brightness: 1.02 } },
  { id: 'dark', g: 'Базовые', name: 'Тёмный', c: '#4a4a54', f: { brightness: 0.7, contrast: 1.2, saturate: 0.9 } },

  { id: 'cine', g: 'Кино', name: 'Кино', c: '#c98f5a', f: { contrast: 1.2, saturate: 1.1, sepia: 0.15, brightness: 0.95 } },
  { id: 'teal', g: 'Кино', name: 'Тил-оранж', c: '#18a6b8', f: { contrast: 1.12, saturate: 1.15 }, t: { mode: 'soft-light', a: 0.75, c1: '#0a8fa8', c2: '#ff8a2b' } },
  { id: 'bleach', g: 'Кино', name: 'Обесцвеч.', c: '#8c8f98', f: { saturate: 0.45, contrast: 1.35, brightness: 0.96 } },
  { id: 'film', g: 'Кино', name: 'Плёнка', c: '#e8b04a', f: { sepia: 0.18, contrast: 1.08, saturate: 1.2, brightness: 1.03, hue: -6 }, t: { mode: 'soft-light', a: 0.35, c1: '#ffd9a0' } },
  { id: 'fuji', g: 'Кино', name: 'Фуджи', c: '#46d6b0', f: { contrast: 1.06, saturate: 1.1, hue: 6, brightness: 1.03 }, t: { mode: 'soft-light', a: 0.28, c1: '#46d6b0' } },
  { id: 'moody', g: 'Кино', name: 'Мрачный', c: '#2c5a86', f: { contrast: 1.2, saturate: 0.75, brightness: 0.85 }, t: { mode: 'soft-light', a: 0.5, c1: '#1d3b5c' } },
  { id: 'drama', g: 'Кино', name: 'Драма', c: '#7a2a3a', f: { contrast: 1.45, saturate: 0.8, brightness: 0.92 } },
  { id: 'vintage', g: 'Кино', name: 'Винтаж', c: '#c4a272', f: { sepia: 0.5, contrast: 0.92, saturate: 0.85, brightness: 1.05 } },
  { id: 'polaroid', g: 'Кино', name: 'Полароид', c: '#f0d9a0', f: { sepia: 0.2, contrast: 0.9, saturate: 1.2, brightness: 1.1, hue: -4 }, t: { mode: 'soft-light', a: 0.35, c1: '#ffe9b0' } },

  { id: 'golden', g: 'Цвет', name: 'Золотой час', c: '#ffb03a', f: { sepia: 0.25, saturate: 1.3, brightness: 1.06, contrast: 1.05 }, t: { mode: 'soft-light', a: 0.6, c1: '#ffb03a', c2: '#ff6a3a' } },
  { id: 'sunset', g: 'Цвет', name: 'Закат', c: '#ff6a3a', f: { saturate: 1.3, contrast: 1.08 }, t: { mode: 'soft-light', a: 0.7, c1: '#7a3cff', c2: '#ff6a3a' } },
  { id: 'pastel', g: 'Цвет', name: 'Пастель', c: '#ffc4e6', f: { contrast: 0.82, brightness: 1.12, saturate: 0.9 }, t: { mode: 'soft-light', a: 0.35, c1: '#ffc4e6', c2: '#c4e4ff' } },
  { id: 'dream', g: 'Цвет', name: 'Мечта', c: '#d9a8ff', f: { brightness: 1.1, saturate: 1.3, contrast: 0.9, hue: -12 } },
  { id: 'ice', g: 'Цвет', name: 'Лёд', c: '#9fdcff', f: { saturate: 0.8, brightness: 1.08, contrast: 1.1, hue: 10 }, t: { mode: 'soft-light', a: 0.5, c1: '#9fdcff' } },
  { id: 'neon', g: 'Цвет', name: 'Неон', c: '#2bffb4', f: { saturate: 2, contrast: 1.2, hue: -20 } },
  { id: 'cyber', g: 'Цвет', name: 'Киберпанк', c: '#ff2bd6', f: { contrast: 1.25, saturate: 1.6 }, t: { mode: 'soft-light', a: 0.8, c1: '#00e5ff', c2: '#ff2bd6' } },
  { id: 'matrix', g: 'Цвет', name: 'Матрица', c: '#16ff6a', f: { gray: 1, contrast: 1.3, brightness: 0.9 }, t: { mode: 'color', a: 0.85, c1: '#16ff6a' } },
  { id: 'duo', g: 'Цвет', name: 'Дуотон', c: '#7a3cff', f: { gray: 1, contrast: 1.2 }, t: { mode: 'color', a: 0.9, c1: '#7a3cff', c2: '#ff3c8e' } }
];
let bgFilterId = 'none';
let bgFilterAmt = 1;

export function setBgFilter(id, amt) {
  bgFilterId = id || 'none';
  bgFilterAmt = typeof amt === 'number' ? Math.min(1, Math.max(0, amt)) : 1;
}

function bgFilterCss(ctx) {
  if (bgFilterId === 'none' || bgFilterAmt <= 0 || !('filter' in ctx)) return '';
  const def = BG_FILTERS.find((x) => x.id === bgFilterId);
  if (!def || !def.f) return '';
  const k = bgFilterAmt;
  const f = def.f;
  const mix = (v, base) => base + ((v === undefined ? base : v) - base) * k;
  return 'brightness(' + mix(f.brightness, 1).toFixed(3) + ') contrast(' + mix(f.contrast, 1).toFixed(3) + ') saturate(' + mix(f.saturate, 1).toFixed(3) + ') sepia(' + mix(f.sepia, 0).toFixed(3) + ') grayscale(' + mix(f.gray, 0).toFixed(3) + ') hue-rotate(' + mix(f.hue, 0).toFixed(1) + 'deg)';
}
// Цветная тонировка (например, бирюза сверху и оранжевый снизу): заливка поверх картинки в режиме смешивания.
function drawBgTone(ctx, w, h) {
  if (bgFilterId === 'none' || bgFilterAmt <= 0) return;
  const def = BG_FILTERS.find((x) => x.id === bgFilterId);
  if (!def || !def.t) return;
  const t = def.t;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, t.c1);
  g.addColorStop(1, t.c2 || t.c1);
  ctx.save();
  ctx.globalCompositeOperation = t.mode;
  ctx.globalAlpha = Math.min(1, t.a * bgFilterAmt);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
// Рисует миниатюру кадра с фильтром id на полную силу (для карточек в панели «Эффекты»).
export function drawFilterSample(g, src, id, w, h) {
  const iw = src.videoWidth || src.naturalWidth || src.width;
  const ih = src.videoHeight || src.naturalHeight || src.height;
  if (!iw || !ih) return false;
  const def = BG_FILTERS.find((x) => x.id === id);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, h);
  if (def && def.f && 'filter' in g) {
    const f = def.f;
    g.filter = 'brightness(' + (f.brightness === undefined ? 1 : f.brightness) + ') contrast(' + (f.contrast === undefined ? 1 : f.contrast) + ') saturate(' + (f.saturate === undefined ? 1 : f.saturate) + ') sepia(' + (f.sepia || 0) + ') grayscale(' + (f.gray || 0) + ') hue-rotate(' + (f.hue || 0) + 'deg)';
  }
  const k = Math.max(w / iw, h / ih);
  try {
    g.drawImage(src, (w - iw * k) / 2, (h - ih * k) / 2, iw * k, ih * k);
  } catch (e) {
    g.restore();
    return false;
  }
  g.filter = 'none';
  if (def && def.t) {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, def.t.c1);
    gr.addColorStop(1, def.t.c2 || def.t.c1);
    g.globalCompositeOperation = def.t.mode;
    g.globalAlpha = Math.min(1, def.t.a);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }
  g.restore();
  return true;
}
function drawBackground(ctx, bars, dim) {
    if (transparentBg) {
    ctx.clearRect(0, 0, VIZ_W, VIZ_H);
    return 0;
  }
  const w = VIZ_W;
  const h = VIZ_H;

  if (wave.bgColor) {
    ctx.fillStyle = wave.bgColor;
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0c0c0e');
    bg.addColorStop(1, '#1b1b20');
    ctx.fillStyle = bg;
  }
  ctx.fillRect(0, 0, w, h);

  const useSlides = slideshow.on && slideshow.list.length > 1 && !(bgVideo && bgVideo.videoWidth);
  const src = useSlides ? slideshow.list[0] : (bgVideo && bgVideo.videoWidth ? bgVideo : bgImage);
  if (src) {
    const filterCss = bgFilterCss(ctx);
    if (filterCss) ctx.filter = filterCss;
    if (useSlides) {
      drawSlides(ctx, w, h);
    } else {
      const iw = src.videoWidth || src.naturalWidth || src.width;
      const ih = src.videoHeight || src.naturalHeight || src.height;
      const k = Math.max(w / iw, h / ih);
      const dw = iw * k;
      const dh = ih * k;
      ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }
    if (filterCss) ctx.filter = 'none';
    drawBgTone(ctx, w, h);
    if (dim) {
      ctx.fillStyle = 'rgba(8, 6, 16, 0.3)';
      ctx.fillRect(0, 0, w, h);
    }
  }

  let sum = 0;
  for (let i = 0; i < bars.length; i++) sum += bars[i];
  const energy = sum / bars.length;

  const glow = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, 420 + energy * 260);
  glow.addColorStop(0, `rgba(255, 255, 255, ${0.04 + energy * 0.16})`);
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  if (dim || !src) {
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  return energy;
}

function drawFooter(ctx) {
  const w = VIZ_W;
  const h = VIZ_H;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '700 38px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('992MUZ', w / 2, h - 90);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '500 24px system-ui, -apple-system, sans-serif';
  ctx.fillText('992muz.ru', w / 2, h - 52);
}

// ---------- стиль 1: столбики ----------

function drawBars(ctx, bars, time) {
  const w = VIZ_W;
  const h = VIZ_H;
  const cy = h / 2;
  const margin = 56;
  const gap = 6;
  const bw = (w - margin * 2 - gap * (BAR_COUNT - 1)) / BAR_COUNT;

  for (let i = 0; i < BAR_COUNT; i++) {
    const bh = Math.max(8, bars[i] * h * 0.4);
    const tw = bw * wave.thick;
    const x = margin + i * (bw + gap) + (bw - tw) / 2;
    ctx.fillStyle = colorAt(i, BAR_COUNT, time);
    fillBar(ctx, x, cy - bh, tw, bh * 2, tw / 2);
  }
}

// ---------- стиль 2: круг ----------

function drawCircle(ctx, bars, time, energy) {
  const cx = VIZ_W / 2;
  const cy = VIZ_H / 2 - 30;
  const baseR = 130 + energy * 40;
  const total = BAR_COUNT * 2;
  const rot = -Math.PI / 2 + time * 0.12;

  ctx.lineCap = 'round';
  ctx.lineWidth = 8 * wave.thick;
  for (let j = 0; j < total; j++) {
    const idx = j < BAR_COUNT ? j : total - 1 - j;
    const len = 10 + bars[idx] * 170;
    const a = rot + (j / total) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    ctx.strokeStyle = colorAt(idx, BAR_COUNT, time);
    ctx.beginPath();
    ctx.moveTo(cx + cos * baseR, cy + sin * baseR);
    ctx.lineTo(cx + cos * (baseR + len), cy + sin * (baseR + len));
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, baseR - 22, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.05 + energy * 0.12})`;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.stroke();
}

// ---------- стиль 3: плавная линия ----------

function smoothPath(ctx, pts, connect) {
  if (connect) ctx.lineTo(pts[0].x, pts[0].y);
  else ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}

function drawLine(ctx, bars, time) {
  const w = VIZ_W;
  const h = VIZ_H;
  const cy = h / 2;
  const margin = 40;
  const step = (w - margin * 2) / (BAR_COUNT - 1);

  const layers = [
    { amp: 0.34, alpha: 0.9, shift: 0, width: 6 },
    { amp: 0.2, alpha: 0.5, shift: 50, width: 4 }
  ];

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const L of layers) {
    const top = [];
    const bottom = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const taper = Math.pow(Math.max(0, Math.sin((Math.PI * i) / (BAR_COUNT - 1))), 0.7);
      const v = 6 + bars[i] * h * L.amp * taper;
      const x = margin + i * step;
      top.push({ x, y: cy - v });
      bottom.push({ x, y: cy + v });
    }

    const hue = (280 + L.shift + time * 18) % 360;
    const lt = L.shift ? 1 : 0;
    const fill = ctx.createLinearGradient(0, cy - h * 0.3, 0, cy + h * 0.3);
    fill.addColorStop(0, lineTint(hue, 0.05 + 0.3 * L.alpha, 62, lt));
    fill.addColorStop(0.5, lineTint(hue, 0.02, 62, lt));
    fill.addColorStop(1, lineTint(hue, 0.05 + 0.3 * L.alpha, 62, lt));

    ctx.beginPath();
    smoothPath(ctx, top, false);
    smoothPath(ctx, bottom.slice().reverse(), true);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.lineWidth = L.width * wave.thick;
    ctx.strokeStyle = lineTint(hue, L.alpha, 70, lt);
    ctx.beginPath();
    smoothPath(ctx, top, false);
    ctx.stroke();
    ctx.beginPath();
    smoothPath(ctx, bottom, false);
    ctx.stroke();
  }

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.moveTo(margin, cy);
  ctx.lineTo(w - margin, cy);
  ctx.stroke();
}
// ---------- стиль 4: живая сфера ----------

const SPHERE_POINTS = 1100;
const SPHERE_BUCKETS = 10;
const SPHERE_FOV = 1100;
const TAU = Math.PI * 2;

const sphereBase = (() => {
  const pts = new Float32Array(SPHERE_POINTS * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < SPHERE_POINTS; i++) {
    const y = 1 - (i / (SPHERE_POINTS - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = golden * i;
    pts[i * 3] = Math.cos(a) * r;
    pts[i * 3 + 1] = y;
    pts[i * 3 + 2] = Math.sin(a) * r;
  }
  return pts;
})();

const sphereBuckets = Array.from({ length: SPHERE_BUCKETS }, () => []);
const sphereState = { last: -1, bass: 0, fast: 0, slow: 0, lastRing: -10, rings: [] };

function avgRange(bars, from, to) {
  let sum = 0;
  for (let i = from; i < to; i++) sum += bars[i];
  return sum / (to - from);
}

// Хранит «память» между кадрами: сглаженный бас и волны от ударов.
// Если время пошло назад или прыгнуло (перемотка, новый экспорт) — начинает заново.
function updateSphereState(bars, time) {
  const s = sphereState;
  const bassNow = avgRange(bars, 0, 8);

  if (time < s.last || time - s.last > 0.5) {
    s.bass = bassNow;
    s.fast = bassNow;
    s.slow = bassNow;
    s.rings.length = 0;
    s.lastRing = time - 10;
    s.last = time;
    return;
  }

  const dt = time - s.last;
  s.last = time;
  if (dt <= 0) return;

  const k = (tau) => 1 - Math.exp(-dt / tau);
  s.bass += (bassNow - s.bass) * k(0.07);
  s.fast += (bassNow - s.fast) * k(0.05);
  s.slow += (bassNow - s.slow) * k(0.6);

  if (s.fast > s.slow * 1.3 + 0.06 && time - s.lastRing > 0.28) {
    s.rings.push({ born: time, power: Math.min(1, s.fast + 0.2) });
    s.lastRing = time;
  }
  while (s.rings.length && time - s.rings[0].born > 1.6) s.rings.shift();
}

function drawSphere(ctx, bars, time, energy) {
  updateSphereState(bars, time);
  const st = sphereState;

  const mid = Math.min(1, avgRange(bars, 8, 28) * 1.3);
  const high = Math.min(1, avgRange(bars, 28, BAR_COUNT) * 2);
  const bass = Math.min(1, st.bass);

  const cx = VIZ_W / 2;
  const cy = VIZ_H / 2 - 40;
  const R = 165;

  ctx.globalCompositeOperation = 'lighter';

  // мягкое свечение и «сердце» сферы
  const halo = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * (1.7 + bass * 0.5));
  halo.addColorStop(0, sphereTint('halo', 0.22 + bass * 0.3));
  halo.addColorStop(1, sphereTint('halo', 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, VIZ_W, VIZ_H);

  const heartR = R * (0.5 + bass * 0.25);
  const heart = ctx.createRadialGradient(cx, cy, 0, cx, cy, heartR);
  heart.addColorStop(0, sphereTint('heart', 0.16 + bass * 0.3));
  heart.addColorStop(1, sphereTint('heart', 0));
  ctx.fillStyle = heart;
  ctx.fillRect(0, 0, VIZ_W, VIZ_H);

  // волны от ударов баса
  for (const ring of st.rings) {
    const p = (time - ring.born) / 1.6;
    if (p < 0 || p > 1) continue;
    const r = R * 1.1 + p * R * 1.3;
    const a = Math.pow(1 - p, 2) * 0.55 * ring.power;
    ctx.lineWidth = 1 + 4 * (1 - p);
    ctx.strokeStyle = sphereTint('ring', a);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
  }

  // точки сферы
  const rotY = time * 0.32;
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const tilt = 0.38;
  const cosX = Math.cos(tilt);
  const sinX = Math.sin(tilt);

  for (let b = 0; b < SPHERE_BUCKETS; b++) sphereBuckets[b].length = 0;

  for (let i = 0; i < SPHERE_POINTS; i++) {
    const x0 = sphereBase[i * 3];
    const y0 = sphereBase[i * 3 + 1];
    const z0 = sphereBase[i * 3 + 2];

    // у экватора — бас, к полюсам — верха
    const band = bars[Math.min(BAR_COUNT - 1, Math.floor(Math.abs(y0) * (BAR_COUNT - 1)))];
    const noise = Math.sin(x0 * 4.3 + time * 2.2) * Math.sin(y0 * 3.7 - time * 1.8) * Math.sin(z0 * 5.1 + time * 1.4);
    const disp = 1 + bass * 0.2 + band * 0.24 + noise * high * 0.12;

    const xr = x0 * cosY + z0 * sinY;
    const zr = -x0 * sinY + z0 * cosY;
    const y2 = y0 * cosX - zr * sinX;
    const z2 = y0 * sinX + zr * cosX;

    const rr = R * disp;
    const scale = SPHERE_FOV / (SPHERE_FOV - z2 * rr);
    const px = cx + xr * rr * scale;
    const py = cy + y2 * rr * scale;
    const depth = (z2 + 1) / 2;
    const size = (0.9 + 2.4 * depth) * scale * (1 + band * 0.6 + mid * 0.3) * wave.thick;

    const bucket = sphereBuckets[Math.min(SPHERE_BUCKETS - 1, Math.floor(depth * SPHERE_BUCKETS))];
    bucket.push(px, py, size);
  }

  for (let b = 0; b < SPHERE_BUCKETS; b++) {
    const list = sphereBuckets[b];
    if (!list.length) continue;
    const d = (b + 0.5) / SPHERE_BUCKETS;
    const alpha = 0.1 + 0.8 * d * d;
    ctx.fillStyle = sphereDot(d, alpha);
    ctx.beginPath();
    for (let k = 0; k < list.length; k += 3) {
      ctx.moveTo(list[k] + list[k + 2], list[k + 1]);
      ctx.arc(list[k], list[k + 1], list[k + 2], 0, TAU);
    }
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
}
// ---------- новые стили ----------

// Цвет с прозрачностью для любого режима цвета (радуга / один цвет / градиент).
function tint(t, time, a, light = 62) {
  if (wave.colorMode === 'rainbow') {
    return `hsla(${(270 + t * 90 + time * 18 + wave.hue) % 360}, 90%, ${light}%, ${a})`;
  }
  return rgbaStr(paletteAt(t), a);
}

// ---------- горы: зазубренные пики вверх и их отражение вниз ----------

function drawMountains(ctx, bars, time) {
  const w = VIZ_W;
  const h = VIZ_H;
  const cy = h / 2;
  const margin = 30;
  const step = (w - margin * 2) / (BAR_COUNT - 1);
  const cfg = [
    { amp: 0.44, a: 0.3, t: 0 },
    { amp: 0.3, a: 0.5, t: 0.5 },
    { amp: 0.17, a: 0.8, t: 1 }
  ];

  ctx.lineJoin = 'round';
  for (const L of cfg) {
    const top = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const taper = Math.pow(Math.max(0, Math.sin((Math.PI * i) / (BAR_COUNT - 1))), 0.5);
      top.push({ x: margin + i * step, v: 4 + bars[i] * h * L.amp * taper });
    }

    for (let side = -1; side <= 1; side += 2) {
      const k = side < 0 ? 1 : 0.55;
      const g = ctx.createLinearGradient(0, cy, 0, cy + side * h * L.amp);
      g.addColorStop(0, tint(L.t, time, 0.02, 62));
      g.addColorStop(1, tint(L.t, time, L.a * k, 62));
      ctx.beginPath();
      ctx.moveTo(margin, cy);
      for (let i = 0; i < BAR_COUNT; i++) ctx.lineTo(top[i].x, cy + side * top[i].v);
      ctx.lineTo(margin + (BAR_COUNT - 1) * step, cy);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();

      ctx.lineWidth = 3 * wave.thick;
      ctx.strokeStyle = tint(L.t, time, 0.9 * k, 72);
      ctx.beginPath();
      for (let i = 0; i < BAR_COUNT; i++) {
        if (i === 0) ctx.moveTo(top[i].x, cy + side * top[i].v);
        else ctx.lineTo(top[i].x, cy + side * top[i].v);
      }
      ctx.stroke();
    }
  }

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.moveTo(margin, cy);
  ctx.lineTo(w - margin, cy);
  ctx.stroke();
}

// ---------- кольца-пульсары ----------

function drawRings(ctx, bars, time, energy) {
  const cx = VIZ_W / 2;
  const cy = VIZ_H / 2 - 30;
  const n = 14;

  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const b = bars[Math.min(BAR_COUNT - 1, Math.floor((i * BAR_COUNT) / n))];
    const r = 36 + i * 24 + b * 38;
    const rot = time * (0.4 + i * 0.07) * (i % 2 ? 1 : -1);
    const gapA = 0.5 + (1 - Math.min(1, b * 1.6)) * 1.2;
    ctx.lineWidth = (3 + b * 9) * wave.thick;
    ctx.strokeStyle = tint(i / (n - 1), time, 0.35 + Math.min(0.6, b), 64);
    ctx.beginPath();
    ctx.arc(cx, cy, r, rot, rot + TAU - gapA);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, 18 + energy * 22, 0, TAU);
  ctx.fillStyle = tint(0, time, 0.5 + energy * 0.4, 80);
  ctx.fill();
}

// ---------- ДНК: две спирали с перекладинами ----------

function drawDna(ctx, bars, time) {
  const w = VIZ_W;
  const h = VIZ_H;
  const cy = h / 2;
  const margin = 40;
  const step = (w - margin * 2) / (BAR_COUNT - 1);
  const p1 = [];
  const p2 = [];
  const dp = [];

  for (let i = 0; i < BAR_COUNT; i++) {
    const taper = Math.pow(Math.max(0, Math.sin((Math.PI * i) / (BAR_COUNT - 1))), 0.6);
    const ph = i * 0.38 + time * 2.2;
    const amp = (30 + bars[i] * h * 0.26) * taper;
    const x = margin + i * step;
    p1.push({ x, y: cy + Math.sin(ph) * amp });
    p2.push({ x, y: cy - Math.sin(ph) * amp });
    dp.push(Math.cos(ph));
  }

  ctx.lineCap = 'round';
  ctx.lineWidth = 2 * wave.thick;
  for (let i = 0; i < BAR_COUNT; i++) {
    ctx.strokeStyle = tint(i / (BAR_COUNT - 1), time, 0.28, 66);
    ctx.beginPath();
    ctx.moveTo(p1[i].x, p1[i].y);
    ctx.lineTo(p2[i].x, p2[i].y);
    ctx.stroke();
  }

  ctx.lineWidth = 2.5 * wave.thick;
  for (let s = 0; s < 2; s++) {
    const pts = s ? p2 : p1;
    ctx.strokeStyle = tint(s, time, 0.45, 66);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < BAR_COUNT; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  for (let pass = 0; pass < 2; pass++) {
    for (let s = 0; s < 2; s++) {
      const pts = s ? p2 : p1;
      for (let i = 0; i < BAR_COUNT; i++) {
        const d = s ? -dp[i] : dp[i];
        if ((d >= 0) !== (pass === 1)) continue;
        const k = (d + 1) / 2;
        const r = (3 + 4 * k + bars[i] * 6) * wave.thick;
        ctx.fillStyle = tint(i / (BAR_COUNT - 1), time, 0.5 + 0.5 * k, 55 + k * 20);
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, r, 0, TAU);
        ctx.fill();
      }
    }
  }
}

// ---------- лепестки ----------

function drawPetals(ctx, bars, time, energy) {
  const cx = VIZ_W / 2;
  const cy = VIZ_H / 2 - 30;
  const half = 32;
  const total = half * 2;
  const rot = -Math.PI / 2 + time * 0.15;
  const r0 = 60 + energy * 30;

  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  for (let j = 0; j < total; j++) {
    const k = j < half ? j : total - 1 - j;
    const idx = Math.floor((k * (BAR_COUNT - 1)) / (half - 1));
    const b = bars[idx];
    const len = 24 + b * 210;
    const wid = (9 + b * 10) * wave.thick;
    const t = idx / (BAR_COUNT - 1);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot + (j / total) * TAU);
    ctx.beginPath();
    ctx.moveTo(r0, 0);
    ctx.quadraticCurveTo(r0 + len * 0.5, -wid, r0 + len, 0);
    ctx.quadraticCurveTo(r0 + len * 0.5, wid, r0, 0);
    ctx.fillStyle = tint(t, time, 0.28, 62);
    ctx.fill();
    ctx.lineWidth = 1.5 * wave.thick;
    ctx.strokeStyle = tint(t, time, 0.7, 72);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- пиксельные бары ----------

function drawPixels(ctx, bars, time) {
  const w = VIZ_W;
  const h = VIZ_H;
  const cy = h / 2;
  const cols = 24;
  const rows = 14;
  const margin = 56;
  const gap = 5;
  const cw = (w - margin * 2 - gap * (cols - 1)) / cols;
  const ch = Math.min(cw * 0.6, (h / 2 - 20) / rows - gap);

  for (let c = 0; c < cols; c++) {
    const b = (bars[c * 2] + bars[c * 2 + 1]) / 2;
    const n = Math.max(1, Math.min(rows, Math.round(b * rows * 1.1)));
    const tw = cw * wave.thick;
    const x = margin + c * (cw + gap) + (cw - tw) / 2;
    for (let r = 0; r < n; r++) {
      const f = r / rows;
      ctx.fillStyle = tint(c / (cols - 1), time, 0.45 + 0.55 * f, 50 + f * 25);
      const up = cy - gap / 2 - (r + 1) * (ch + gap) + gap;
      const down = cy + gap / 2 + r * (ch + gap);
      fillBar(ctx, x, up, tw, ch, 3);
      fillBar(ctx, x, down, tw, ch, 3);
    }
  }
}

// ---------- неоновый осциллограф ----------

function drawScope(ctx, bars, time) {
  const w = VIZ_W;
  const h = VIZ_H;
  const cy = h / 2;
  const margin = 30;
  const N = 240;
  const H = 16;
  const pts = [];

  for (let i = 0; i <= N; i++) {
    const u = i / N;
    let y = 0.06 * Math.sin(u * TAU * 2 + time);
    for (let k = 0; k < H; k++) {
      y += (bars[k * 3] * Math.sin(u * TAU * (k + 1) * 0.5 + time * (1.5 + k * 0.35) + k * 1.7)) / (1 + k * 0.35);
    }
    const taper = Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.6);
    const v = Math.max(-1, Math.min(1, y * 0.5));
    pts.push({ x: margin + u * (w - margin * 2), y: cy + v * h * 0.34 * taper });
  }

  const grad = (a, l) => {
    const g = ctx.createLinearGradient(margin, 0, w - margin, 0);
    g.addColorStop(0, tint(0, time, a, l));
    g.addColorStop(0.5, tint(0.5, time, a, l));
    g.addColorStop(1, tint(1, time, a, l));
    return g;
  };

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.beginPath();
  ctx.moveTo(margin, cy);
  ctx.lineTo(w - margin, cy);
  ctx.stroke();

  ctx.globalCompositeOperation = 'lighter';
  const passes = [
    { lw: 14, a: 0.12, l: 60 },
    { lw: 7, a: 0.3, l: 66 },
    { lw: 2.5, a: 0.95, l: 82 }
  ];
  for (const p of passes) {
    ctx.lineWidth = p.lw * wave.thick;
    ctx.strokeStyle = grad(p.a, p.l);
    ctx.beginPath();
    smoothPath(ctx, pts, false);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- дождь из столбиков ----------

function drawRain(ctx, bars, time) {
  const w = VIZ_W;
  const h = VIZ_H;
  const margin = 30;
  const step = (w - margin * 2) / (BAR_COUNT - 1);

  ctx.lineCap = 'round';
  for (let i = 0; i < BAR_COUNT; i++) {
    const b = bars[i];
    const len = 30 + b * h * 0.3;
    const sp = 0.22 + (i % 7) * 0.045;
    const ph = (time * sp + ((i * 0.6180339) % 1)) % 1;
    const head = ph * (h + len);
    const x = margin + i * step;
    const t = i / (BAR_COUNT - 1);
    const lw = (3 + b * 5) * wave.thick;

    const g = ctx.createLinearGradient(0, head - len, 0, head);
    g.addColorStop(0, tint(t, time, 0, 64));
    g.addColorStop(1, tint(t, time, 0.95, 70));
    ctx.lineWidth = lw;
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, head - len);
    ctx.lineTo(x, head);
    ctx.stroke();

    ctx.fillStyle = tint(t, time, 1, 85);
    ctx.beginPath();
    ctx.arc(x, head, lw * 0.8, 0, TAU);
    ctx.fill();
  }
}

// ---------- плазменный шар ----------

function drawPlasma(ctx, bars, time, energy) {
  const cx = VIZ_W / 2;
  const cy = VIZ_H / 2 - 30;
  const rays = 22;
  const R0 = 40 + energy * 30;
  const seg = 10;

  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R0 * 2.2);
  core.addColorStop(0, tint(0, time, 0.7, 80));
  core.addColorStop(1, tint(0, time, 0, 80));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, R0 * 2.2, 0, TAU);
  ctx.fill();

  for (let r = 0; r < rays; r++) {
    const b = bars[Math.floor((r * BAR_COUNT) / rays)];
    const baseA = (r / rays) * TAU + time * 0.25;
    const len = R0 + 30 + b * 200 + energy * 40;
    const pts = [];
    for (let s = 1; s <= seg; s++) {
      const f = s / seg;
      const rad = R0 + (len - R0) * f;
      const jit = Math.sin(time * 9 + r * 3.1 + s * 1.9) * 14 * (1 - f * 0.3) * (0.3 + b);
      const a = baseA + jit / rad;
      pts.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    for (let pass = 0; pass < 2; pass++) {
      ctx.lineWidth = (pass ? 1.5 : 5) * wave.thick;
      ctx.strokeStyle = tint(r / (rays - 1), time, pass ? 0.95 : 0.25, pass ? 82 : 60);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(baseA) * R0, cy + Math.sin(baseA) * R0);
      for (let k = 0; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
      ctx.stroke();
    }
  }

  ctx.lineWidth = 2;
  ctx.strokeStyle = tint(0.5, time, 0.4, 75);
  ctx.beginPath();
  ctx.arc(cx, cy, R0, 0, TAU);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- лента-змейка ----------

function drawRibbon(ctx, bars, time) {
  const w = VIZ_W;
  const h = VIZ_H;
  const cx = w / 2;
  const cy = h / 2 - 20;
  const N = 90;
  let px = 0;
  let py = 0;

  ctx.lineCap = 'round';
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const a = u * TAU;
    const x = cx + Math.sin(a * 2 + time * 0.8) * w * 0.33;
    const y = cy + Math.sin(a * 3 + time * 0.6) * h * 0.22;
    if (i > 0) {
      const idx = Math.min(BAR_COUNT - 1, Math.floor(u * BAR_COUNT));
      ctx.lineWidth = (5 + bars[idx] * 34) * wave.thick;
      ctx.strokeStyle = tint(u, time, 0.85, 62);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    px = x;
    py = y;
  }
}

// ---------- капля: мягкий пульсирующий контур ----------

function drawBlob(ctx, bars, time, energy) {
  const cx = VIZ_W / 2;
  const cy = VIZ_H / 2 - 30;
  const total = BAR_COUNT * 2;
  const cfg = [
    { k: 1, a: 0.28, t: 0, dir: 1 },
    { k: 0.72, a: 0.5, t: 0.5, dir: -1 },
    { k: 0.46, a: 0.8, t: 1, dir: 1 }
  ];

  ctx.lineJoin = 'round';
  for (const L of cfg) {
    const pts = [];
    for (let j = 0; j < total; j++) {
      const idx = j < BAR_COUNT ? j : total - 1 - j;
      const a = -Math.PI / 2 + (j / total) * TAU + time * 0.1 * L.dir;
      const r = (70 + bars[idx] * 180 + Math.sin(a * 3 + time * 1.5) * 8 + energy * 30) * (0.45 + 0.55 * L.k);
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    ctx.beginPath();
    ctx.moveTo((pts[total - 1].x + pts[0].x) / 2, (pts[total - 1].y + pts[0].y) / 2);
    for (let j = 0; j < total; j++) {
      const nx = pts[(j + 1) % total];
      ctx.quadraticCurveTo(pts[j].x, pts[j].y, (pts[j].x + nx.x) / 2, (pts[j].y + nx.y) / 2);
    }
    ctx.closePath();
    ctx.fillStyle = tint(L.t, time, L.a * 0.5, 60);
    ctx.fill();
    ctx.lineWidth = 3 * wave.thick;
    ctx.strokeStyle = tint(L.t, time, 0.9, 70);
    ctx.stroke();
  }
}
let layer = null;
let layerCtx = null;
let tmp = null;
let tmpCtx = null;
const STRIP = 2;

function ensureLayers() {
  if (!layer) {
    layer = document.createElement('canvas');
    layerCtx = layer.getContext('2d');
    tmp = document.createElement('canvas');
    tmpCtx = tmp.getContext('2d');
  }
  if (layer.width !== VIZ_W || layer.height !== VIZ_H) {
    layer.width = VIZ_W;
    layer.height = VIZ_H;
    tmp.width = VIZ_W;
    tmp.height = VIZ_H;
  }
}

function getLayerCtx() {
  ensureLayers();
  layerCtx.setTransform(1, 0, 0, 1, 0, 0);
  layerCtx.globalAlpha = 1;
  layerCtx.globalCompositeOperation = 'source-over';
  layerCtx.shadowBlur = 0;
  layerCtx.clearRect(0, 0, VIZ_W, VIZ_H);
  return layerCtx;
}

function warpRows(dst, src, a, F) {
  const W = VIZ_W;
  const H = VIZ_H;
  const cx = W / 2;
  const cy = H / 2;
  const cosA = Math.cos(a);
  const sinA = Math.sin(a);
  for (let y = 0; y < H; y += STRIP) {
    const y2 = Math.min(H, y + STRIP);
    const v0 = y - cy;
    const v1 = y2 - cy;
    const d0 = Math.round(cy + (v0 * cosA * F) / (F - v0 * sinA));
    const d1 = Math.round(cy + (v1 * cosA * F) / (F - v1 * sinA));
    if (d1 <= d0) continue;
    const sm = F / (F - ((v0 + v1) / 2) * sinA);
    dst.drawImage(src, 0, y, W, y2 - y, cx - cx * sm, d0, W * sm, d1 - d0);
  }
}

function warpCols(dst, src, a, F) {
  const W = VIZ_W;
  const H = VIZ_H;
  const cx = W / 2;
  const cy = H / 2;
  const cosA = Math.cos(a);
  const sinA = Math.sin(a);
  for (let x = 0; x < W; x += STRIP) {
    const x2 = Math.min(W, x + STRIP);
    const u0 = x - cx;
    const u1 = x2 - cx;
    const d0 = Math.round(cx + (u0 * cosA * F) / (F - u0 * sinA));
    const d1 = Math.round(cx + (u1 * cosA * F) / (F - u1 * sinA));
    if (d1 <= d0) continue;
    const sm = F / (F - ((u0 + u1) / 2) * sinA);
    dst.drawImage(src, x, 0, x2 - x, H, d0, cy - cy * sm, d1 - d0, H * sm);
  }
}

function projectLayer(dst) {
  const rad = Math.PI / 180;
  const F = (Math.max(VIZ_W, VIZ_H) * 1.5) / Math.max(0.3, wave.persp);
  const ax = wave.tiltX * rad;
  const ay = wave.tiltY * rad;
  dst.save();
  dst.globalAlpha = 1;
  dst.globalCompositeOperation = 'source-over';
  dst.shadowBlur = 0;
  if (ax !== 0 && ay !== 0) {
    tmpCtx.setTransform(1, 0, 0, 1, 0, 0);
    tmpCtx.clearRect(0, 0, VIZ_W, VIZ_H);
    warpRows(tmpCtx, layer, ax, F);
    warpCols(dst, tmp, ay, F);
  } else if (ax !== 0) {
    warpRows(dst, layer, ax, F);
  } else {
    warpCols(dst, layer, ay, F);
  }
  dst.restore();
}
function beginWave(ctx, style, time, energy) {
  ctx.save();
  const k = wave.size * (1 + wave.pulse * energy * 0.8);
  ctx.translate(VIZ_W / 2 + wave.x, VIZ_H / 2 + wave.y);
  ctx.rotate(((wave.rotate + wave.spin * time) * Math.PI) / 180);
  ctx.scale(k * wave.stretch, k);
  ctx.translate(-VIZ_W / 2, -VIZ_H / 2);
  ctx.globalAlpha = wave.opacity;
  if (wave.glow > 0 && style !== 'sphere') {
    ctx.shadowColor = glowColor();
    ctx.shadowBlur = wave.glow;
  }
}

function endWave(ctx) {
  ctx.restore();
}
// Рисует один кадр. bars — массив BAR_COUNT значений 0..1, time — секунды,
// style — id из STYLES.
let frameEnergy = 0;

// Рисует только фон (цвет, фото, видео) и запоминает громкость кадра для волн.
export function drawBackdrop(ctx, srcBars, style = 'bars') {
  frameEnergy = drawBackground(ctx, srcBars, style !== 'none');
}

export function drawWaves(ctx, srcBars, time, style = 'bars', withBackground = true) {
  const mainCtx = ctx;
  time = time * wave.speed;
  const energy = withBackground ? drawBackground(ctx, srcBars, style !== 'none') : frameEnergy;
  const bars = ampBars;
  for (let i = 0; i < BAR_COUNT; i++) bars[i] = Math.min(2.5, srcBars[i] * wave.amp);

  const tilted = style !== 'none' && (wave.tiltX !== 0 || wave.tiltY !== 0);
  if (tilted) ctx = getLayerCtx();
  beginWave(ctx, style, time, energy);

  if (style === 'none') {
    // трека ещё нет: рисуем только фон и фото
  } else if (style === 'sphere') drawSphere(ctx, bars, time, energy);
  else if (style === 'circle') drawCircle(ctx, bars, time, energy);
  else if (style === 'line') drawLine(ctx, bars, time);
  else if (style === 'mountains') drawMountains(ctx, bars, time);
  else if (style === 'rings') drawRings(ctx, bars, time, energy);
  else if (style === 'dna') drawDna(ctx, bars, time);
  else if (style === 'petals') drawPetals(ctx, bars, time, energy);
  else if (style === 'pixels') drawPixels(ctx, bars, time);
  else if (style === 'scope') drawScope(ctx, bars, time);
  else if (style === 'rain') drawRain(ctx, bars, time);
  else if (style === 'plasma') drawPlasma(ctx, bars, time, energy);
  else if (style === 'ribbon') drawRibbon(ctx, bars, time);
  else if (style === 'blob') drawBlob(ctx, bars, time, energy);
  else drawBars(ctx, bars, time);

  endWave(ctx);
  if (tilted) projectLayer(mainCtx);
}