import { wave } from '/js/visualizer/waves.js';
import { gridIndex, gridTime, getGridVersion, getBeatGrid } from '/js/visualizer/beats.js';

// Эффекты на весь кадр. Рисуются после волн и частиц, но до текста и стикеров.
// Всё зависит только от времени t и спектра bars, поэтому предпросмотр
// и экспорт в MP4 дают одинаковую картинку.

export const EFFECT_DEFAULTS = {
  zoom: 0,
  flash: 0,
  glitch: 0,
  shake: 0,
  vignette: 0,
  grain: 0,
  bloom: 0,
  warp: 0,
  radial: 0,
  pixel: 0,
  tint: 0,
  scan: 0,
  mirror: 0,
  tilt: 0,
  ghost: 0,
  invert: 0,
  tile: 0,
  punch: 0,
  vhs: 0,
  bpm: 0,
  progress: 0,
  fadeIn: 0,
  fadeOut: 0,
    introMode: 'fade',
  outroMode: 'fade',
    introRev: false,
  outroRev: false,
  sens: 1,
  filter: 'none',
  filterAmt: 1
};
export const effects = { ...EFFECT_DEFAULTS };

export function setEffects(patch) {
  Object.assign(effects, patch);
}

export function resetEffectSettings() {
  Object.assign(effects, EFFECT_DEFAULTS);
}

// ---------- бит ----------

const BASS_BARS = 8;
const st = { last: null, slow: 0, bass: 0, lastBeat: -10, power: 0, beatIdx: 0, gridIdx: null, gridVer: -1 };

export function resetEffects() {
  st.last = null;
  st.slow = 0;
  st.bass = 0;
  st.lastBeat = -10;
  st.power = 0;
  st.beatIdx = 0;
  st.gridIdx = null;
}

function followAudio(bars, t) {
  const n = Math.min(BASS_BARS, bars.length);
  let raw = 0;
  for (let i = 0; i < n; i++) raw += bars[i];
  raw = n ? raw / n : 0;

  // первый кадр или перемотка назад: начинаем заново
  if (st.last === null || t < st.last - 1e-6) {
    resetEffects();
    st.slow = raw;
    st.bass = raw;
    st.last = t;
    return;
  }

  let dt = t - st.last;
  st.last = t;
  if (dt <= 0) return;
  if (dt > 0.05) dt = 0.05;

  st.bass += (raw - st.bass) * (1 - Math.exp(-dt * (raw > st.bass ? 18 : 5)));
  st.slow += (raw - st.slow) * (1 - Math.exp(-dt * 1.6));

  // есть сетка ударов (известен BPM): бьём строго по ней
  const gi = gridIndex(t);
  if (gi !== null) {
    if (st.gridVer !== getGridVersion()) {
      st.gridVer = getGridVersion();
      st.gridIdx = null;
    }
    if (st.gridIdx !== null && gi > st.gridIdx && gi >= 0) {
      st.power = Math.min(1, (0.45 + Math.max(0, raw - st.slow) * 2.5 + raw * 0.25) * effects.sens);
      st.lastBeat = gridTime(gi);
      st.beatIdx++;
    }
    st.gridIdx = gi;
    return;
  }
  st.gridIdx = null;

  // сетки нет: ловим бит по басу, как раньше
  const k = 1.22 - (effects.sens - 1) * 0.15;
  if (raw > 0.2 && raw > st.slow * k + 0.05 && t - st.lastBeat > 0.2) {
    st.power = Math.min(1, 0.35 + (raw - st.slow) * 2.5);
    st.lastBeat = t;
    st.beatIdx++;
  }
}

// Сила удара, которая затухает со временем (tau — секунды).
function env(t, tau) {
  const d = t - st.lastBeat;
  if (d < 0) return 0;
  return Math.exp(-d / tau) * st.power;
}

// ---------- случайность без Math.random ----------

function hash(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// ---------- вспомогательные холсты ----------

let snap = null;
let snapCtx = null;
let chan = null;
let chanCtx = null;

function ensure(W, H) {
  if (!snap) {
    snap = document.createElement('canvas');
    snapCtx = snap.getContext('2d');
    chan = document.createElement('canvas');
    chanCtx = chan.getContext('2d');
  }
  if (snap.width !== W || snap.height !== H) {
    snap.width = W;
    snap.height = H;
    chan.width = W;
    chan.height = H;
  }
}

function copyFrame(ctx, W, H) {
  snapCtx.setTransform(1, 0, 0, 1, 0, 0);
  snapCtx.globalCompositeOperation = 'source-over';
  snapCtx.globalAlpha = 1;
  snapCtx.clearRect(0, 0, W, H);
  snapCtx.drawImage(ctx.canvas, 0, 0);
}
// ---------- маленькие холсты для свечения и пикселей ----------

let tiny = null;
let tinyCtx = null;
let glow = null;
let glowCtx = null;

function ensureSmall(W, H) {
  if (!tiny) {
    tiny = document.createElement('canvas');
    tinyCtx = tiny.getContext('2d');
    glow = document.createElement('canvas');
    glowCtx = glow.getContext('2d');
  }
  const tw = Math.max(1, Math.ceil(W / 4));
  const th = Math.max(1, Math.ceil(H / 4));
  if (tiny.width !== tw || tiny.height !== th) {
    tiny.width = tw;
    tiny.height = th;
    glow.width = Math.max(1, Math.ceil(W / 16));
    glow.height = Math.max(1, Math.ceil(H / 16));
  }
}

// ---------- сканлайны ----------

let scanTile = null;
let scanP = 0;

function scanPattern(ctx, P) {
  if (!scanTile || scanP !== P) {
    scanTile = document.createElement('canvas');
    scanTile.width = 1;
    scanTile.height = P;
    const sg = scanTile.getContext('2d');
    sg.fillStyle = '#000';
    sg.fillRect(0, Math.floor(P / 2), 1, Math.ceil(P / 2));
    scanP = P;
  }
  return ctx.createPattern(scanTile, 'repeat');
}
// ---------- зерно ----------

const GRAIN = 160;
const TILES = 3;
let tiles = null;

function makeTiles() {
  tiles = [];
  for (let n = 0; n < TILES; n++) {
    const c = document.createElement('canvas');
    c.width = GRAIN;
    c.height = GRAIN;
    const g = c.getContext('2d');
    const img = g.createImageData(GRAIN, GRAIN);
    for (let i = 0; i < GRAIN * GRAIN; i++) {
      let v = 128 + (hash(i + n * 99991) - 0.5) * 220;
      if (v < 0) v = 0;
      if (v > 255) v = 255;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    tiles.push(c);
  }
}
// ---------- BPM в кадре, полоска прогресса, плавное вступление и концовка ----------
// Вызывается последней, после текста и стикеров, поэтому затемнение накрывает весь кадр.
// withFade = false на паузе, чтобы на стоп-кадре не было чёрного экрана.

function pill(ctx, x, y, w, h) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
}
function trSmooth(x) {
  const v = Math.min(1, Math.max(0, x));
  return v * v * (3 - 2 * v);
}

// Рывок: сдвиг кадра со смазом движения. Наоборот: вертикальный рывок.
function drawWhipTr(ctx, W, H, k, d, rev) {
  ensure(W, H);
  copyFrame(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const ext = rev ? H : W;
  const offset = d * k * k * ext * 1.15;
  const blur = Math.min(1, k * 2.5) * ext * 0.38;
  const n = 12;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1 / n;
  for (let j = 0; j < n; j++) {
    const o = offset + (j / (n - 1) - 0.5) * blur;
    if (rev) ctx.drawImage(snap, 0, o);
    else ctx.drawImage(snap, o, 0);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// Зум-блюр: радиальный смаз и вспышка. Наоборот: отдаление и уход в чёрное.
function drawZoomBlurTr(ctx, W, H, k, d, rev) {
  ensure(W, H);
  copyFrame(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const n = 14;
  const amt = Math.min(1, k * 1.4) * (rev ? -0.28 : 0.7);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1 / n;
  for (let j = 0; j < n; j++) {
    const f = j / (n - 1);
    const s = 1 + amt * f;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(d * k * 0.05 * f);
    ctx.scale(s, s);
    ctx.drawImage(snap, -W / 2, -H / 2);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = trSmooth((k - 0.55) / 0.45);
  ctx.fillStyle = rev ? '#000000' : '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

// Засвет: цветные пятна света и вспышка. Наоборот: холодная палитра.
function drawLeakTr(ctx, W, H, k, d, rev) {
  const R = Math.max(W, H);
  const a = Math.min(1, k * 1.5);
  const pal = rev
    ? [[60, 170, 255], [120, 80, 255], [0, 230, 220]]
    : [[255, 170, 50], [255, 70, 90], [255, 220, 120]];
  const spots = [
    [0.5 + d * (k - 0.5) * 1.3, 0.3, 0.9, 0],
    [0.5 - d * (k - 0.5) * 1.1, 0.75, 0.75, 1],
    [0.5 + d * (0.5 - k) * 0.6, 0.5, 0.55, 2]
  ];
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    const c = pal[s[3]];
    const r = R * s[2] * (0.45 + k * 0.9);
    const g = ctx.createRadialGradient(s[0] * W, s[1] * H, 0, s[0] * W, s[1] * H, r);
    g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + 0.85 * a + ')');
    g.addColorStop(0.5, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + 0.35 * a + ')');
    g.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'source-over';
  const f = trSmooth((k - 0.55) / 0.45);
  if (f > 0) {
    ctx.globalAlpha = f;
    ctx.fillStyle = rev ? '#e6f4ff' : '#fff1d6';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalAlpha = 1;
}

// Волна: водная рябь по строкам и столбцам, затем уход в чёрное.
function drawRippleTr(ctx, W, H, k, d, rev) {
  const S = Math.min(W, H) / 720;
  ensure(W, H);
  copyFrame(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const amp = Math.min(1, k * 1.6) * 38 * S;
  const phase = d * k * 18;
  const step = Math.max(2, Math.round(3 * S));
  for (let y = 0; y < H; y += step) {
    const hh = Math.min(step, H - y);
    const dx = Math.sin(y / (34 * S) + phase) * amp;
    ctx.drawImage(snap, 0, y, W, hh, dx, y, W, hh);
  }
  copyFrame(ctx, W, H);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += step) {
    const ww = Math.min(step, W - x);
    const dy = Math.sin(x / (46 * S) + phase * 0.8 + 1.3) * amp * 0.6;
    ctx.drawImage(snap, x, 0, ww, H, x, dy, ww, H);
  }
  ctx.globalAlpha = trSmooth((k - 0.5) / 0.5);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

// Переворот: кадр поворачивается в 3D. Наоборот: переворот по горизонтальной оси.
function drawFlipTr(ctx, W, H, k, d, rev) {
  ensure(W, H);
  copyFrame(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const a = d * k * Math.PI / 2;
  const cosA = Math.cos(a);
  const sinA = Math.sin(a);
  const cx = W / 2;
  const cy = H / 2;
  const F = Math.max(W, H) * 1.6;
  if (rev) {
    for (let y = 0; y < H; y += 2) {
      const ye = Math.min(H, y + 2);
      const v0 = y - cy;
      const v1 = ye - cy;
      const den0 = F - v0 * sinA;
      const den1 = F - v1 * sinA;
      if (den0 < F * 0.2 || den1 < F * 0.2) continue;
      const d0 = Math.round(cy + (v0 * cosA * F) / den0);
      const d1 = Math.round(cy + (v1 * cosA * F) / den1);
      if (d1 <= d0) continue;
      const sm = F / (F - ((v0 + v1) / 2) * sinA);
      ctx.drawImage(snap, 0, y, W, ye - y, cx - cx * sm, d0, W * sm, d1 - d0);
    }
  } else {
    for (let x = 0; x < W; x += 2) {
      const xe = Math.min(W, x + 2);
      const u0 = x - cx;
      const u1 = xe - cx;
      const den0 = F - u0 * sinA;
      const den1 = F - u1 * sinA;
      if (den0 < F * 0.2 || den1 < F * 0.2) continue;
      const d0 = Math.round(cx + (u0 * cosA * F) / den0);
      const d1 = Math.round(cx + (u1 * cosA * F) / den1);
      if (d1 <= d0) continue;
      const sm = F / (F - ((u0 + u1) / 2) * sinA);
      ctx.drawImage(snap, x, 0, xe - x, H, d0, cy - cy * sm, d1 - d0, H * sm);
    }
  }
  ctx.globalAlpha = k * 0.55;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

// Часы: чёрный сектор, как стрелка. Наоборот: две стрелки сразу.
function drawClockTr(ctx, W, H, k, d, rev) {
  const S = Math.min(W, H) / 720;
  const R = Math.hypot(W, H);
  const a0 = -Math.PI / 2;
  const hands = rev ? 2 : 1;
  const sweep = rev ? k * Math.PI : k * Math.PI * 2;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  for (let h = 0; h < hands; h++) {
    const st = a0 + h * Math.PI;
    const en = d > 0 ? st + sweep : st - sweep;
    ctx.beginPath();
    ctx.moveTo(W / 2, H / 2);
    ctx.arc(W / 2, H / 2, R, st, en, d < 0);
    ctx.closePath();
    ctx.fill();
  }
  const glow = Math.sin(Math.PI * Math.min(1, k));
  if (glow > 0.02) {
    ctx.save();
    ctx.globalAlpha = 0.6 * glow;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, 2 * S);
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 14 * S;
    for (let h = 0; h < hands; h++) {
      const ang = d > 0 ? a0 + h * Math.PI + sweep : a0 + h * Math.PI - sweep;
      ctx.beginPath();
      ctx.moveTo(W / 2, H / 2);
      ctx.lineTo(W / 2 + Math.cos(ang) * R, H / 2 + Math.sin(ang) * R);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// Осколки: кадр рассыпается на плитки. Наоборот: плитки падают вниз.
function drawShatterTr(ctx, W, H, k, d, rev) {
  ensure(W, H);
  copyFrame(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const cols = 9;
  const size = W / cols;
  const rows = Math.ceil(H / size);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor(c * size);
      const x1 = c === cols - 1 ? W : Math.floor((c + 1) * size);
      const y0 = Math.floor(r * size);
      const y1 = r === rows - 1 ? H : Math.floor((r + 1) * size);
      const tw = x1 - x0;
      const th = y1 - y0;
      if (tw <= 0 || th <= 0) continue;
      const h1 = hash(r * 131 + c * 7 + 3);
      const h2 = hash(r * 977 + c * 31 + 9);
      const dl = rev ? (1 - r / rows) * 0.5 : h1 * 0.5;
      const p = Math.min(1, Math.max(0, (k * 1.5 - dl) / 0.7));
      if (p >= 1) continue;
      if (p <= 0) {
        ctx.drawImage(snap, x0, y0, tw, th, x0, y0, tw, th);
        continue;
      }
      const cxT = x0 + tw / 2;
      const cyT = y0 + th / 2;
      let dx;
      let dy;
      let rot;
      let sc;
      if (rev) {
        dx = (h2 - 0.5) * size * 0.8 * p;
        dy = p * p * H * 0.9;
        rot = (h1 - 0.5) * p * 1.4;
        sc = 1 - p * 0.2;
      } else {
        const vx = (cxT - W / 2) / (W / 2);
        const vy = (cyT - H / 2) / (H / 2);
        dx = vx * p * W * 0.35 + (h2 - 0.5) * size * p;
        dy = vy * p * H * 0.25 + p * p * H * 0.25;
        rot = (h1 - 0.5) * p * 3 * d;
        sc = 1 - p * 0.5;
      }
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.translate(cxT + dx, cyT + dy);
      ctx.rotate(rot);
      ctx.scale(sc, sc);
      ctx.drawImage(snap, x0, y0, tw, th, -tw / 2, -th / 2, tw, th);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

// Прожиг: кадр выгорает рваными дырами с раскалённой кромкой. Наоборот: выгорание идёт сверху вниз.
let brnCv = null;
let brnImg = null;
let brnNoise = null;
let brnW = 0;
let brnH = 0;

function drawBurnTr(ctx, W, H, k, d, rev) {
  const w = Math.max(2, Math.round(W / 3));
  const h = Math.max(2, Math.round(H / 3));
  if (!brnCv) brnCv = document.createElement('canvas');
  if (brnW !== w || brnH !== h) {
    brnW = w;
    brnH = h;
    brnCv.width = w;
    brnCv.height = h;
    brnImg = brnCv.getContext('2d').createImageData(w, h);
    brnNoise = new Float32Array(w * h);
    const vn = (x, y) => {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = x - ix;
      const fy = y - iy;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const a = hash(Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663));
      const b = hash(Math.imul(ix + 1, 73856093) ^ Math.imul(iy, 19349663));
      const c = hash(Math.imul(ix, 73856093) ^ Math.imul(iy + 1, 19349663));
      const e = hash(Math.imul(ix + 1, 73856093) ^ Math.imul(iy + 1, 19349663));
      return (a + (b - a) * sx) * (1 - sy) + (c + (e - c) * sx) * sy;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n1 = vn(x / (w / 5), y / (w / 5));
        const n2 = vn(x / (w / 12) + 17.3, y / (w / 12) + 9.1);
        const n3 = vn(x / (w / 28) + 3.7, y / (w / 28) + 21.9);
        const v = n1 * 0.55 + n2 * 0.3 + n3 * 0.15;
        brnNoise[y * w + x] = Math.min(0.999, Math.max(0, (v - 0.25) / 0.5));
      }
    }
  }
  const edge = 0.09;
  const thr = k * (1 + edge);
  const data = brnImg.data;
  for (let i = 0; i < w * h; i++) {
    let n = brnNoise[i];
    if (rev) {
      const yy = (i / w) | 0;
      n = Math.min(0.999, n * 0.65 + 0.35 * (d > 0 ? yy / h : 1 - yy / h));
    }
    const o = i * 4;
    if (n < thr - edge) {
      data[o] = 0;
      data[o + 1] = 0;
      data[o + 2] = 0;
      data[o + 3] = 255;
    } else if (n < thr) {
      const t = (n - (thr - edge)) / edge;
      data[o] = Math.round(255 * Math.min(1, t * 1.6 + 0.25));
      data[o + 1] = Math.round(255 * Math.max(0, t * t * 1.1 - 0.05));
      data[o + 2] = Math.round(255 * Math.max(0, (t - 0.7) / 0.3) * 0.6);
      data[o + 3] = Math.round(255 * (1 - Math.max(0, (t - 0.85) / 0.15)));
    } else {
      data[o + 3] = 0;
    }
  }
  brnCv.getContext('2d').putImageData(brnImg, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(brnCv, 0, 0, w, h, 0, 0, W, H);
}
// RGB-сдвиг: хроматическая аберрация, диагональный разъезд каналов, шлейф, поочерёдное угасание, рваные полосы.
function drawRgbTr(ctx, W, H, k, d, rev) {
  const S = Math.min(W, H) / 720;
  const fr = Math.floor(k * 120);
  ensure(W, H);
  copyFrame(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  const amt = Math.pow(k, 1.3) * W * 0.14;
  const bump = Math.sin(Math.PI * Math.min(1, k));
  const smooth = (x) => {
    const v = Math.min(1, Math.max(0, x));
    return v * v * (3 - 2 * v);
  };
  // красный уходит первым, зелёный вторым, синий последним
  const chs = [
    { col: '#ff0000', ox: -amt, oy: -amt * 0.08, sc: 1 + k * 0.1 * d, end: 0.85 },
    { col: '#00ff00', ox: amt * 0.1, oy: 0, sc: 1, end: 0.93 },
    { col: '#0000ff', ox: amt, oy: amt * 0.08, sc: 1 - k * 0.06 * d, end: 1 }
  ];
  const n = 9;

  for (let c = 0; c < chs.length; c++) {
    const ch = chs[c];
    const a = 1 - smooth(k / ch.end);
    if (a <= 0.003) continue;
    chanCtx.globalCompositeOperation = 'source-over';
    chanCtx.globalAlpha = 1;
    chanCtx.drawImage(snap, 0, 0);
    chanCtx.globalCompositeOperation = 'multiply';
    chanCtx.fillStyle = ch.col;
    chanCtx.fillRect(0, 0, W, H);
    for (let j = 0; j < n; j++) {
      const f = j / (n - 1);
      const trail = 1 - f * 0.75;
      const gx = d * ch.ox * trail;
      const gy = d * ch.oy * trail;
      const gs = 1 + (ch.sc - 1) * trail;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, (a * (1 - f * 0.8)) / (n * 0.6));
      ctx.translate(W / 2 + gx, H / 2 + gy);
      ctx.scale(gs, gs);
      ctx.drawImage(chan, -W / 2, -H / 2);
      ctx.restore();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // плавный эффект: полос и случайных сбоев нет

  // лёгкая вспышка: когда каналы складываются, кадр на миг ярче
  if (bump > 0.3) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.08 * bump * (1 - k);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}
// Телевизор: шипение, дрожание строк, цветная кайма, сканлайны, виньетка, схлопывание в светящуюся полосу и точку.
// Наоборот: потеря синхронизации и «снег» без схлопывания.
function drawTvTr(ctx, W, H, k, d, rev) {
  const S = Math.min(W, H) / 720;
  const fr = Math.floor(k * 240);
  ensure(W, H);
  if (!tiles) makeTiles();

  const nz = rev ? Math.min(1, k * 1.5) : Math.min(1, k / 0.45);
  const sq = rev ? 0 : Math.min(1, Math.max(0, (k - 0.4) / 0.4));
  const dt = rev ? 0 : Math.min(1, Math.max(0, (k - 0.8) / 0.2));
  const endB = rev ? Math.min(1, Math.max(0, (k - 0.78) / 0.22)) : 0;

  // 1. дрожание строк, разрывы и вертикальная прокрутка
  copyFrame(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const step = Math.max(2, Math.round(4 * S));
  const roll = rev ? Math.pow(nz, 3) * ((k * 2.6) % 1) * H : 0;
  const wob = nz * 5 * S;
  const tearA = nz * nz * 40 * S;
  for (let y = 0; y < H; y += step) {
    const row = (y / step) | 0;
    const s0 = (y + roll) % H;
    const hh = Math.min(step, H - y, H - s0);
    if (hh <= 0) continue;
    let dx = Math.sin(y / (50 * S) + k * 40) * wob + (hash(fr * 131 + row) - 0.5) * nz * 4 * S;
    if (hash(fr * 53 + (row >> 3)) < 0.06 * nz) dx += (hash(fr * 71 + row) - 0.5) * tearA * 2;
    ctx.drawImage(snap, 0, s0, W, hh, dx, y, W, hh);
  }

  // 2. цветная кайма: красный и синий каналы разъезжаются
  if (nz > 0.05) {
    copyFrame(ctx, W, H);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    const off = (1.5 + 7 * nz) * S;
    const chs = [
      ['#ff0000', -off],
      ['#00ff00', 0],
      ['#0000ff', off]
    ];
    for (let c = 0; c < chs.length; c++) {
      chanCtx.globalCompositeOperation = 'source-over';
      chanCtx.drawImage(snap, 0, 0);
      chanCtx.globalCompositeOperation = 'multiply';
      chanCtx.fillStyle = chs[c][0];
      chanCtx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(chan, chs[c][1], 0);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // 3. шипение: серый «снег» и яркие искры поверх
  const nsc = Math.max(1, 2 * S);
  const pat = ctx.createPattern(tiles[fr % TILES], 'repeat');
  if (pat && nz > 0) {
    for (let p = 0; p < 2; p++) {
      const tx = -hash(fr * 3 + 1 + p * 17) * GRAIN * nsc;
      const ty = -hash(fr * 3 + 2 + p * 29) * GRAIN * nsc;
      ctx.save();
      ctx.globalCompositeOperation = p ? 'lighter' : 'source-over';
      ctx.globalAlpha = p ? 0.3 * nz : Math.min(0.9, rev ? 0.1 + 0.8 * nz * nz : 0.55 * nz * nz);
      ctx.translate(tx, ty);
      ctx.scale(nsc, nsc);
      ctx.fillStyle = pat;
      ctx.fillRect(-tx / nsc, -ty / nsc, W / nsc, H / nsc);
      ctx.restore();
    }
  }

  // 4. белые чёрточки-помехи
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffffff';
  const dashes = Math.round(nz * 14);
  for (let i = 0; i < dashes; i++) {
    const nx = hash(fr * 23 + i * 3 + 1) * W;
    const nw = (0.05 + hash(fr * 23 + i * 3 + 2) * 0.35) * W;
    const ny = hash(fr * 23 + i * 3 + 3) * H;
    ctx.globalAlpha = 0.2 + 0.4 * hash(fr * 19 + i);
    ctx.fillRect(nx, ny, nw, Math.max(1, Math.round(1.5 * S)));
  }

  // 5. ползущая светлая полоса
  const by = (((k * 3) % 1.3) - 0.15) * H;
  const bh = H * 0.14;
  const bg = ctx.createLinearGradient(0, by, 0, by + bh);
  bg.addColorStop(0, 'rgba(255, 255, 255, 0)');
  bg.addColorStop(0.5, 'rgba(255, 255, 255, ' + Math.min(0.22, 0.2 * nz) + ')');
  bg.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = bg;
  ctx.fillRect(0, by, W, bh);

  // 6. сканлайны
  const sp = scanPattern(ctx, Math.max(2, Math.round(4 * S)));
  if (sp) {
    ctx.globalAlpha = 0.35 * (0.4 + 0.6 * nz);
    ctx.fillStyle = sp;
    ctx.fillRect(0, 0, W, H);
  }

  // 7. затемнённые углы, как у выпуклого экрана
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.55);
  vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vg.addColorStop(1, 'rgba(0, 0, 0, ' + (0.35 + 0.4 * nz) + ')');
  ctx.globalAlpha = 1;
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // 8. мерцание яркости
  if (hash(fr * 41 + 5) < 0.3 * nz) {
    ctx.globalAlpha = 0.05 + 0.1 * nz * hash(fr * 43 + 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalAlpha = 1;

  // 9. выключение: схлопывание в светящуюся линию, потом в точку
  if (sq > 0) {
    copyFrame(ctx, W, H);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    const lineH = 3 * S;
    const hh = Math.max(lineH, H * Math.pow(1 - sq, 2));
    const ww = Math.max(6 * S, W * Math.pow(1 - dt, 2.2));
    const gl = 1 - Math.max(0, (dt - 0.55) / 0.45);
    const px = (W - ww) / 2;
    const py = (H - hh) / 2;
    ctx.globalAlpha = gl;
    ctx.drawImage(snap, 0, 0, W, H, px, py, ww, hh);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = gl * sq * 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px, py, ww, hh);
    ctx.globalCompositeOperation = 'source-over';
    if (sq > 0.75) {
      ctx.save();
      ctx.globalAlpha = gl * Math.min(1, (sq - 0.75) / 0.2);
      ctx.shadowColor = '#bfe6ff';
      ctx.shadowBlur = 24 * S;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px, H / 2 - lineH / 2, ww, lineH);
      ctx.restore();
    }
  }

  // 10. в режиме «Наоборот» кадр под конец уходит в чёрное
  if (endB > 0) {
    ctx.globalAlpha = endB * endB * (3 - 2 * endB);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
// Глитч: сдвинутые полосы, RGB-расслоение, битые блоки, сканлайны, мерцание и уход в чёрное.
function drawGlitchTr(ctx, W, H, k, d, rev) {
  const S = Math.min(W, H) / 720;
  const g = Math.min(1, k * 1.5);
  const idx = Math.floor(k * 28) * 7 + (rev ? 3 : 0);
  ensure(W, H);

  // 1. полосы разной высоты: сдвигаются и по очереди пропадают
  copyFrame(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const bands = 22;
  let y = 0;
  for (let i = 0; i < bands && y < H; i++) {
    const hh = Math.max(2, Math.ceil((0.015 + hash(idx * 13 + i * 5 + 1) * 0.09) * H));
    const gone = hash(idx * 29 + i * 3 + 2) < Math.pow(k, 1.6);
    if (!gone) {
      const moved = hash(idx * 17 + i * 11 + 3) < 0.35 + 0.65 * g;
      const dx = moved ? (hash(idx * 19 + i * 7 + 4) - 0.35 * (d > 0 ? 1 : 0.3) - 0.15) * 2 * g * W * 0.35 : 0;
      ctx.drawImage(snap, 0, y, W, Math.min(hh, H - y), dx, y, W, Math.min(hh, H - y));
    }
    y += hh;
  }

  // 2. битые блоки: куски кадра копируются в другое место
  copyFrame(ctx, W, H);
  const blocks = Math.round(2 + g * 9);
  for (let i = 0; i < blocks; i++) {
    const sw = (0.08 + hash(idx * 31 + i * 5 + 11) * 0.3) * W;
    const sh = (0.02 + hash(idx * 31 + i * 5 + 12) * 0.1) * H;
    const sx = hash(idx * 31 + i * 5 + 13) * (W - sw);
    const sy = hash(idx * 31 + i * 5 + 14) * (H - sh);
    let dx = sx + (hash(idx * 31 + i * 5 + 15) - 0.5) * 0.5 * W * g;
    dx = Math.max(0, Math.min(W - sw, dx));
    ctx.drawImage(snap, sx, sy, sw, sh, dx, sy, sw, sh);
    if (i % 2 === 0) {
      const cols = ['#ff0044', '#00ffe1', '#7a00ff'];
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.28 * g;
      ctx.fillStyle = cols[(i / 2 + idx) % 3 | 0];
      ctx.fillRect(dx, sy, sw, sh);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
  }

  // 3. RGB-расслоение: красный и синий каналы разъезжаются
  copyFrame(ctx, W, H);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const off = d * (6 + 46 * g) * S * (0.5 + hash(idx * 3 + 77));
  const chs = [
    ['#ff0000', -off],
    ['#00ff00', 0],
    ['#0000ff', off]
  ];
  for (let c = 0; c < chs.length; c++) {
    chanCtx.globalCompositeOperation = 'source-over';
    chanCtx.drawImage(snap, 0, 0);
    chanCtx.globalCompositeOperation = 'multiply';
    chanCtx.fillStyle = chs[c][0];
    chanCtx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(chan, chs[c][1], 0);
  }
  ctx.globalCompositeOperation = 'source-over';

  // 4. сканлайны
  const P = Math.max(2, Math.round(4 * S));
  const sp = scanPattern(ctx, P);
  if (sp) {
    ctx.globalAlpha = 0.3 * g;
    ctx.fillStyle = sp;
    ctx.fillRect(0, 0, W, H);
  }

  // 5. мерцание: белые и чёрные кадры-вспышки
  const fl = hash(idx * 41 + 5);
  if (fl < 0.14 * g) {
    ctx.globalAlpha = 0.18 + 0.2 * g;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
  } else if (fl > 1 - 0.12 * g * g) {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
  }

  // 6. под конец кадр уходит в чёрное
  const endB = Math.min(1, Math.max(0, (k - 0.72) / 0.28));
  if (endB > 0) {
    ctx.globalAlpha = endB * endB * (3 - 2 * endB);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalAlpha = 1;
}
// Вихрь: настоящая закрутка каждого пикселя (воронка), хроматика, вращательное размытие и падение в темноту.
let vxSrc = null;
let vxSrcCtx = null;
let vxOut = null;
let vxOutCtx = null;
let vxImg = null;

function drawVortex(ctx, W, H, k, d, rev) {
  const w = Math.max(2, Math.round(W / 2));
  const h = Math.max(2, Math.round(H / 2));
  if (!vxSrc) {
    vxSrc = document.createElement('canvas');
    vxSrcCtx = vxSrc.getContext('2d', { willReadFrequently: true });
    vxOut = document.createElement('canvas');
    vxOutCtx = vxOut.getContext('2d');
  }
  if (vxSrc.width !== w || vxSrc.height !== h) {
    vxSrc.width = w;
    vxSrc.height = h;
    vxOut.width = w;
    vxOut.height = h;
    vxImg = null;
  }
  vxSrcCtx.setTransform(1, 0, 0, 1, 0, 0);
  vxSrcCtx.globalAlpha = 1;
  vxSrcCtx.globalCompositeOperation = 'source-over';
  vxSrcCtx.imageSmoothingEnabled = true;
  vxSrcCtx.drawImage(ctx.canvas, 0, 0, W, H, 0, 0, w, h);
  const src = vxSrcCtx.getImageData(0, 0, w, h).data;
  if (!vxImg) vxImg = vxOutCtx.createImageData(w, h);
  const out = vxImg.data;

  const cx = w / 2;
  const cy = h / 2;
  const Rn = Math.hypot(w, h) / 2;
  const twist = d * 9 * k;
  const s = 1 / (rev ? 1 - k * 0.25 : 1 + k * 0.45);
  const t0 = Math.min(1, Math.max(0, (k - 0.2) / 0.8));
  const endBlack = Math.min(1, Math.max(0, (k - 0.85) / 0.15));
  const chroma = [1.12, 1, 0.88];

  for (let y = 0; y < h; y++) {
    const dy0 = y - cy;
    for (let x = 0; x < w; x++) {
      const dx0 = x - cx;
      const r = Math.min(1, Math.sqrt(dx0 * dx0 + dy0 * dy0) / Rn);
      const f = (1 - r) * (1 - r);
      const base = twist * f;
      let dark = t0 * t0 * (0.25 + 0.75 * f);
      if (endBlack > dark) dark = endBlack;
      const keep = 1 - dark;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const a = base * chroma[c];
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        let sx = Math.round(cx + (dx0 * ca - dy0 * sa) * s);
        let sy = Math.round(cy + (dx0 * sa + dy0 * ca) * s);
        if (sx < 0) sx = 0;
        else if (sx > w - 1) sx = w - 1;
        if (sy < 0) sy = 0;
        else if (sy > h - 1) sy = h - 1;
        out[o + c] = src[(sy * w + sx) * 4 + c] * keep;
      }
      out[o + 3] = 255;
    }
  }
  vxOutCtx.putImageData(vxImg, 0, 0);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(vxOut, 0, 0, w, h, 0, 0, W, H);

  // вращательное размытие: два призрака с небольшим поворотом
  for (let g = -1; g <= 1; g += 2) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(d * g * 0.035 * k);
    ctx.translate(-W / 2, -H / 2);
    ctx.globalAlpha = 0.22 * k * (1 - endBlack);
    ctx.drawImage(vxOut, 0, 0, w, h, 0, 0, W, H);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
// Растворение: кадр рассыпается на блоки, которые гаснут в случайном порядке с мягким краем.
// Наоборот: блоки гаснут волной по диагонали.
function drawDissolveTr(ctx, W, H, k, d, rev) {
  const S = Math.min(W, H) / 720;
  const size = Math.max(8, Math.round(26 * S));
  const cols = Math.ceil(W / size);
  const rows = Math.ceil(H / size);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000000';
  for (let r = 0; r < rows; r++) {
    const y0 = Math.floor(r * size);
    const y1 = Math.min(H, Math.floor((r + 1) * size));
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor(c * size);
      const x1 = Math.min(W, Math.floor((c + 1) * size));
      let th = hash(r * 7919 + c * 104729 + 13);
      if (rev) {
        const pos = (c / cols + r / rows) / 2;
        th = th * 0.3 + (d > 0 ? pos : 1 - pos) * 0.7;
      }
      const a = trSmooth((k - th * 0.75) / 0.25);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  ctx.globalAlpha = 1;
}

// Блик: по кадру проходит яркая диагональная полоса, за ней кадр проявляется.
// Наоборот: полоса идёт с другой стороны, свет холодный.
function drawShineTr(ctx, W, H, k, d, rev) {
  const L = Math.hypot(W, H);
  const edge = -L / 2 + L * (1 - k);
  const bw = L * 0.16;
  const rgb = rev ? '170, 220, 255' : '255, 240, 210';
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(rev ? -0.45 : 0.45);
  ctx.scale(d > 0 ? 1 : -1, 1);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(edge, -L, L, L * 2);
  const vis = trSmooth(Math.min(k, 1 - k) * 6);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(edge - bw * 2.2, 0, edge + bw * 0.6, 0);
  g.addColorStop(0, 'rgba(' + rgb + ', 0)');
  g.addColorStop(0.75, 'rgba(' + rgb + ', ' + 0.55 * vis + ')');
  g.addColorStop(0.9, 'rgba(255, 255, 255, ' + 0.95 * vis + ')');
  g.addColorStop(1, 'rgba(' + rgb + ', 0)');
  ctx.fillStyle = g;
  ctx.fillRect(edge - bw * 2.2, -L, bw * 2.8, L * 2);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// Удар: кадр влетает с увеличением, с тряской, смазом и короткой вспышкой.
// Наоборот: кадр вылетает из глубины (из уменьшенного).
function drawSlamTr(ctx, W, H, k, d, rev) {
  const S = Math.min(W, H) / 720;
  ensure(W, H);
  copyFrame(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const amt = rev ? -0.35 : 0.45;
  const shake = k * (1 - k) * 4 * 26 * S;
  const step = Math.floor(k * 36);
  const dx = (hash(step * 31 + 7) - 0.5) * shake;
  const dy = (hash(step * 17 + 3) - 0.5) * shake;
  for (let j = 0; j < 4; j++) {
    const s = 1 + amt * k * (1 + j * 0.12);
    ctx.save();
    ctx.translate(W / 2 + dx, H / 2 + dy);
    ctx.scale(s, s);
    ctx.globalCompositeOperation = j === 0 ? 'source-over' : 'lighter';
    ctx.globalAlpha = j === 0 ? 1 - k : 0.22 * (1 - k) * k * 4;
    ctx.drawImage(snap, -W / 2, -H / 2);
    ctx.restore();
  }
  const f = Math.max(0, 1 - Math.abs(k - 0.14) / 0.12);
  if (f > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55 * f;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// Фокус: кадр «наводится на резкость» из размытого и пересвеченного.
// Наоборот: уходит в размытие и белый свет.
function drawFocusTr(ctx, W, H, k, d, rev) {
  ensure(W, H);
  ensureSmall(W, H);
  copyFrame(ctx, W, H);
  tinyCtx.imageSmoothingEnabled = true;
  tinyCtx.clearRect(0, 0, tiny.width, tiny.height);
  tinyCtx.drawImage(snap, 0, 0, W, H, 0, 0, tiny.width, tiny.height);
  glowCtx.imageSmoothingEnabled = true;
  glowCtx.clearRect(0, 0, glow.width, glow.height);
  glowCtx.drawImage(tiny, 0, 0, glow.width, glow.height);
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const z = rev ? 1 - k * 0.1 : 1 + k * 0.12;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(snap, 0, 0);
  ctx.globalAlpha = Math.min(1, k * 2.2);
  ctx.drawImage(tiny, 0, 0, W, H);
  ctx.globalAlpha = trSmooth((k - 0.3) / 0.6);
  ctx.drawImage(glow, 0, 0, W, H);
  ctx.restore();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = k * 0.3;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = trSmooth((k - 0.6) / 0.4);
  ctx.fillStyle = rev ? '#ffffff' : '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

// Ирис: диафрагма из шести лепестков. Наоборот: восемь лепестков и поворот в другую сторону.
function drawIrisTr(ctx, W, H, k, d, rev) {
  const S = Math.min(W, H) / 720;
  const R = Math.hypot(W, H) / 2;
  const n = rev ? 8 : 6;
  const r = R * (1 - k) * 1.05;
  const rot = d * k * 1.1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const x = W / 2 + Math.cos(a) * r;
    const y = H / 2 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill('evenodd');
  if (r > 2) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      const x = W / 2 + Math.cos(a) * r;
      const y = H / 2 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.55 * Math.min(1, k * 5);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, 3 * S);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Разрез: кадр делится по горизонтали, половинки разъезжаются, между ними свет.
// Наоборот: делится по вертикали.
function drawSplitTr(ctx, W, H, k, d, rev) {
  ensure(W, H);
  copyFrame(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const ext = rev ? W : H;
  const off = k * (ext / 2);
  if (rev) {
    ctx.drawImage(snap, 0, 0, W / 2, H, -off, 0, W / 2, H);
    ctx.drawImage(snap, W / 2, 0, W / 2, H, W / 2 + off, 0, W / 2, H);
  } else {
    ctx.drawImage(snap, 0, 0, W, H / 2, 0, -off, W, H / 2);
    ctx.drawImage(snap, 0, H / 2, W, H / 2, 0, H / 2 + off, W, H / 2);
  }
  const fade = 1 - trSmooth((k - 0.7) / 0.3);
  const gap = Math.max(2, off);
  const g = rev
    ? ctx.createLinearGradient(W / 2 - gap, 0, W / 2 + gap, 0)
    : ctx.createLinearGradient(0, H / 2 - gap, 0, H / 2 + gap);
  g.addColorStop(0, 'rgba(255, 255, 255, 0)');
  g.addColorStop(0.5, 'rgba(255, 255, 255, ' + 0.95 * fade + ')');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  if (rev) ctx.fillRect(W / 2 - gap, 0, gap * 2, H);
  else ctx.fillRect(0, H / 2 - gap, W, gap * 2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// Кино: чёрные полосы сверху и снизу, медленный наезд камеры.
// Наоборот: полосы по бокам и отъезд.
function drawCineTr(ctx, W, H, k, d, rev) {
  const S = Math.min(W, H) / 720;
  ensure(W, H);
  copyFrame(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const z = rev ? 1 - k * 0.1 : 1 + k * 0.15;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.globalAlpha = 1 - k * 0.5;
  ctx.drawImage(snap, -W / 2, -H / 2);
  ctx.restore();
  ctx.globalAlpha = 1;
  const ext = rev ? W : H;
  const bar = (ext / 2) * Math.pow(k, 1.5);
  const soft = 40 * S;
  ctx.fillStyle = '#000000';
  if (rev) {
    ctx.fillRect(0, 0, bar, H);
    ctx.fillRect(W - bar, 0, bar + 1, H);
  } else {
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar + 1);
  }
  if (bar > 1 && bar < ext / 2) {
    const a = rev ? ctx.createLinearGradient(bar, 0, bar + soft, 0) : ctx.createLinearGradient(0, bar, 0, bar + soft);
    a.addColorStop(0, 'rgba(0, 0, 0, 1)');
    a.addColorStop(1, 'rgba(0, 0, 0, 0)');
    const b = rev ? ctx.createLinearGradient(W - bar, 0, W - bar - soft, 0) : ctx.createLinearGradient(0, H - bar, 0, H - bar - soft);
    b.addColorStop(0, 'rgba(0, 0, 0, 1)');
    b.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = a;
    if (rev) ctx.fillRect(bar, 0, soft, H);
    else ctx.fillRect(0, bar, W, soft);
    ctx.fillStyle = b;
    if (rev) ctx.fillRect(W - bar - soft, 0, soft, H);
    else ctx.fillRect(0, H - bar - soft, W, soft);
  }
  ctx.globalAlpha = 1;
}

// Строб: серия коротких вспышек, затем кадр гаснет. Наоборот: вспышки-инверсия.
function drawStrobeTr(ctx, W, H, k, d, rev) {
  const p = k * 7;
  const cell = Math.floor(p);
  const frac = p - cell;
  const amp = Math.min(1, k * 1.4);
  ctx.globalAlpha = 1;
  if (rev) {
    if (cell % 2 === 0) {
      ctx.globalCompositeOperation = 'difference';
      ctx.globalAlpha = amp * (1 - frac * 0.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
    }
  } else if (cell % 2 === 0) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = amp * 0.9 * (1 - frac);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = amp * 0.8 * (1 - frac);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = trSmooth((k - 0.8) / 0.2);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}
// Молния: кадр тонет во тьме, по нему бьют ветвистые молнии со вспышками. Наоборот: холодная гроза.
function drawLightningTr(ctx, W, H, k, d, rev) {
  const S = Math.min(W, H) / 720;
  const step = Math.floor(k * 16);
  const amp = Math.sin(Math.PI * Math.min(1, k));
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.94 * trSmooth((k - 0.1) / 0.55);
  ctx.fillStyle = rev ? '#040a1c' : '#000000';
  ctx.fillRect(0, 0, W, H);
  const on = hash(step * 13 + 5) < 0.2 + 0.5 * amp;
  if (on && k > 0.04 && k < 0.96) {
    const seed = step * 97 + (rev ? 5 : 0) + 11;
    const zig = (sx, sy, ex, ey, n, jag, salt) => {
      const p = [];
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const j = i > 0 && i < n ? (hash(seed + salt + i * 3) - 0.5) * jag : 0;
        p.push([sx + (ex - sx) * f + j, sy + (ey - sy) * f]);
      }
      return p;
    };
    const trace = (p) => {
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
      ctx.stroke();
    };
    const x0 = (0.15 + hash(seed) * 0.7) * W;
    const main = zig(x0, -10 * S, x0 + (hash(seed + 1) - 0.5) * W * 0.3, H * (0.7 + hash(seed + 2) * 0.3), 16, W * 0.12, 100);
    const b1 = zig(main[5][0], main[5][1], main[5][0] + (hash(seed + 3) - 0.5) * W * 0.5, main[5][1] + H * 0.3, 8, W * 0.08, 300);
    const b2 = zig(main[10][0], main[10][1], main[10][0] + (hash(seed + 4) - 0.5) * W * 0.5, main[10][1] + H * 0.22, 7, W * 0.07, 500);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = rev ? '#6fb0ff' : '#c9d8ff';
    ctx.shadowBlur = 36 * S;
    ctx.strokeStyle = rev ? 'rgba(120, 170, 255, 0.55)' : 'rgba(190, 205, 255, 0.55)';
    ctx.lineWidth = 9 * S;
    trace(main);
    ctx.lineWidth = 5 * S;
    trace(b1);
    trace(b2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.2 * S;
    trace(main);
    ctx.lineWidth = 1.8 * S;
    trace(b1);
    trace(b2);
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3 * amp * (0.5 + 0.5 * hash(seed + 9));
    ctx.fillStyle = rev ? '#9cc4ff' : '#ffffff';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = trSmooth((k - 0.88) / 0.12);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

// Гиперпрыжок: кадр растягивается, из центра летят светящиеся лучи, затем белая вспышка.
// Наоборот: лучи летят к центру, кадр отдаляется, вспышка холодная.
function drawHyperTr(ctx, W, H, k, d, rev) {
  const S = Math.min(W, H) / 720;
  ensure(W, H);
  copyFrame(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const n = 10;
  const amt = Math.min(1, k * 1.5) * (rev ? -0.3 : 1.1);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = (1 - k) / n;
  for (let j = 0; j < n; j++) {
    const f = j / (n - 1);
    const s = 1 + amt * f;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(d * k * 0.03 * f);
    ctx.scale(s, s);
    ctx.drawImage(snap, -W / 2, -H / 2);
    ctx.restore();
  }
  const R = Math.hypot(W, H) / 2;
  const sp0 = Math.min(1, k * 2.2);
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 120; i++) {
    const ang = hash(i * 7 + 1) * Math.PI * 2;
    const sp = 0.6 + hash(i * 7 + 2) * 1.2;
    let ph = hash(i * 7 + 3) + (rev ? -1 : 1) * k * sp * 1.6;
    ph -= Math.floor(ph);
    const r0 = R * ph * ph;
    const r1 = r0 + R * 0.28 * sp0 * (0.2 + ph);
    ctx.globalAlpha = sp0 * (0.25 + 0.75 * ph);
    ctx.strokeStyle = hash(i * 7 + 4) < 0.3 ? '#9fd0ff' : '#ffffff';
    ctx.lineWidth = (0.8 + hash(i * 7 + 5) * 2.2 * ph) * S;
    ctx.beginPath();
    ctx.moveTo(W / 2 + Math.cos(ang) * r0, H / 2 + Math.sin(ang) * r0);
    ctx.lineTo(W / 2 + Math.cos(ang) * r1, H / 2 + Math.sin(ang) * r1);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = trSmooth((k - 0.72) / 0.28);
  ctx.fillStyle = rev ? '#cfe6ff' : '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

// Лазер: яркая линия идёт по кадру, за ней кадр открывается (или закрывается).
// Наоборот: линия идёт по горизонтали, цвет холодный.
function drawLaserTr(ctx, W, H, k, d, rev) {
  const S = Math.min(W, H) / 720;
  const ext = rev ? W : H;
  const p = (d > 0 ? 1 - k : k) * ext;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  if (d > 0) {
    if (rev) ctx.fillRect(p, 0, W - p + 1, H);
    else ctx.fillRect(0, p, W, H - p + 1);
  } else if (rev) {
    ctx.fillRect(0, 0, p + 1, H);
  } else {
    ctx.fillRect(0, 0, W, p + 1);
  }
  const vis = trSmooth(Math.min(k, 1 - k) * 8);
  if (vis > 0.01) {
    const col = rev ? '42, 240, 255' : '255, 42, 85';
    const sgn = d > 0 ? -1 : 1;
    const gw = 70 * S;
    const g = rev ? ctx.createLinearGradient(p, 0, p + sgn * gw, 0) : ctx.createLinearGradient(0, p, 0, p + sgn * gw);
    g.addColorStop(0, 'rgba(' + col + ', ' + 0.45 * vis + ')');
    g.addColorStop(1, 'rgba(' + col + ', 0)');
    const a0 = sgn < 0 ? p - gw : p;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    if (rev) ctx.fillRect(a0, 0, gw, H);
    else ctx.fillRect(0, a0, W, gw);
    const t = Math.max(2, 3 * S);
    ctx.save();
    ctx.shadowColor = 'rgb(' + col + ')';
    ctx.shadowBlur = 22 * S;
    ctx.fillStyle = 'rgba(255, 255, 255, ' + vis + ')';
    if (rev) ctx.fillRect(p - t / 2, 0, t, H);
    else ctx.fillRect(0, p - t / 2, W, t);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

function starPath(ctx, cx, cy, ro, ri, n, rot) {
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const r = i % 2 ? ri : ro;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Звезда: кадр открывается через растущую вращающуюся звезду. Наоборот: чёрная звезда растёт и закрывает кадр.
function drawStarTr(ctx, W, H, k, d, rev) {
  const S = Math.min(W, H) / 720;
  const R = Math.hypot(W, H) / 2;
  const ro = R * 3 * (rev ? k : 1 - k);
  const ri = ro * 0.42;
  const rot = -Math.PI / 2 + d * k * 1.3;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  if (!rev) ctx.rect(0, 0, W, H);
  starPath(ctx, W / 2, H / 2, ro, ri, 5, rot);
  ctx.fill(rev ? 'nonzero' : 'evenodd');
  if (ro > 3 && ro < R * 2.6) {
    ctx.save();
    ctx.beginPath();
    starPath(ctx, W / 2, H / 2, ro, ri, 5, rot);
    ctx.globalAlpha = 0.75 * Math.min(1, k * 6, (1 - k) * 6);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, 3 * S);
    ctx.shadowColor = '#ffe9a8';
    ctx.shadowBlur = 20 * S;
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function heartPath(ctx, cx, cy, sc) {
  const n = 72;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(a), 3);
    const y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
    const px = cx + x * sc;
    const py = cy + (y - 2.5) * sc;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// Сердце: кадр открывается через бьющееся сердце. Наоборот: чёрное сердце растёт и закрывает кадр.
function drawHeartTr(ctx, W, H, k, d, rev) {
  const S = Math.min(W, H) / 720;
  const R = Math.hypot(W, H) / 2;
  const sc = (R / 6.5) * (rev ? k : 1 - k) * (1 + 0.05 * Math.sin(k * 38));
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  if (!rev) ctx.rect(0, 0, W, H);
  heartPath(ctx, W / 2, H / 2, sc);
  ctx.fill(rev ? 'nonzero' : 'evenodd');
  if (sc * 16 > 3 && sc * 7 < R * 1.1) {
    ctx.save();
    ctx.beginPath();
    heartPath(ctx, W / 2, H / 2, sc);
    ctx.globalAlpha = 0.8 * Math.min(1, k * 6, (1 - k) * 6);
    ctx.strokeStyle = '#ff9fbd';
    ctx.lineWidth = Math.max(1, 3 * S);
    ctx.shadowColor = '#ff3d77';
    ctx.shadowBlur = 24 * S;
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// Эхо-зум: за кадром разлетаются полупрозрачные копии разного размера. Наоборот: копии сжимаются внутрь.
function drawEchoTr(ctx, W, H, k, d, rev) {
  ensure(W, H);
  copyFrame(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const spread = Math.min(1, k * 2.2);
  const fade = 1 - trSmooth((k - 0.8) / 0.2);
  for (let j = 4; j >= 0; j--) {
    const s = 1 + (rev ? -0.16 : 0.2) * j * spread;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(d * j * 0.05 * k);
    ctx.scale(s, s);
    if (j === 0) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1 - k * 0.85;
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.28 * (1 - j * 0.15) * Math.min(1, k * 3) * fade;
    }
    ctx.drawImage(snap, -W / 2, -H / 2);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = trSmooth((k - 0.75) / 0.25);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}
// Нарезка: кадр режется на полосы, они по очереди улетают со смазом. Наоборот: полосы идут по горизонтали.
function drawSliceTr(ctx, W, H, k, d, rev) {
  ensure(W, H);
  copyFrame(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const n = 11;
  const ext = rev ? W : H;
  for (let i = 0; i < n; i++) {
    const order = d > 0 ? i : n - 1 - i;
    const p = trSmooth((k * 1.4 - (order / (n - 1)) * 0.5) / 0.6);
    const off = p * p * ext * 1.15 * (i % 2 ? 1 : -1);
    const a0 = rev ? Math.floor((i * H) / n) : Math.floor((i * W) / n);
    const a1 = rev ? Math.floor(((i + 1) * H) / n) : Math.floor(((i + 1) * W) / n);
    for (let g = 2; g >= 0; g--) {
      const o = off * (1 - g * 0.12);
      ctx.globalAlpha = g === 0 ? 1 : 0.22;
      if (rev) ctx.drawImage(snap, 0, a0, W, a1 - a0, o, a0, W, a1 - a0);
      else ctx.drawImage(snap, a0, 0, a1 - a0, H, a0, o, a1 - a0, H);
    }
  }
  ctx.globalAlpha = 1;
}

// Эквалайзер: чёрные столбики растут по кадру, как на эквалайзере. Наоборот: растут от центра.
function drawBarsTr(ctx, W, H, k, d, rev) {
  const S = Math.min(W, H) / 720;
  const n = 30;
  const w = W / n;
  const cap = Math.max(2, Math.round(3 * S));
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < n; i++) {
    const r = hash(i * 31 + 7);
    const h = Math.min(1, Math.max(0, k * 1.6 - r * 0.6));
    if (h <= 0) continue;
    const x0 = Math.floor(i * w);
    const x1 = Math.floor((i + 1) * w);
    const bh = h * H;
    const y = rev ? (H - bh) / 2 : d > 0 ? H - bh : 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x0, y, x1 - x0 + 1, bh + 1);
    if (h < 1) {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#ffffff';
      if (rev) {
        ctx.fillRect(x0, y, x1 - x0 - 1, cap);
        ctx.fillRect(x0, y + bh - cap, x1 - x0 - 1, cap);
      } else if (d > 0) {
        ctx.fillRect(x0, y, x1 - x0 - 1, cap);
      } else {
        ctx.fillRect(x0, y + bh - cap, x1 - x0 - 1, cap);
      }
    }
  }
  ctx.globalAlpha = 1;
}

// Хромо-зум: красный, зелёный и синий каналы разлетаются с разным зумом. Наоборот: схлопываются внутрь.
function drawChromaTr(ctx, W, H, k, d, rev) {
  ensure(W, H);
  copyFrame(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const z = k * (rev ? -0.35 : 0.9);
  const chs = [
    ['#ff0000', 1 + z * 1.0, -1],
    ['#00ff00', 1 + z * 0.55, 0],
    ['#0000ff', 1 + z * 0.1, 1]
  ];
  for (let c = 0; c < chs.length; c++) {
    chanCtx.globalCompositeOperation = 'source-over';
    chanCtx.globalAlpha = 1;
    chanCtx.drawImage(snap, 0, 0);
    chanCtx.globalCompositeOperation = 'multiply';
    chanCtx.fillStyle = chs[c][0];
    chanCtx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 - trSmooth((k - 0.55) / 0.45);
    ctx.translate(W / 2, H / 2);
    ctx.rotate(d * k * 0.05 * chs[c][2]);
    ctx.scale(chs[c][1], chs[c][1]);
    ctx.drawImage(chan, -W / 2, -H / 2);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// Ролл: быстрое вращение с зумом и шлейфом. Наоборот: вращение в другую сторону с отъездом.
function drawRollTr(ctx, W, H, k, d, rev) {
  ensure(W, H);
  copyFrame(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const n = 8;
  for (let j = 0; j < n; j++) {
    const f = j / (n - 1);
    const a = d * k * k * Math.PI * 0.8 * (1 - f * 0.35);
    const s = 1 + k * (rev ? -0.25 : 0.9) * (1 - f * 0.2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - k * k) / n;
    ctx.translate(W / 2, H / 2);
    ctx.rotate(a);
    ctx.scale(s, s);
    ctx.drawImage(snap, -W / 2, -H / 2);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// Анаморф: кадр гаснет, по центру вспыхивает длинная светящаяся полоса, как блик анаморфной оптики.
// Наоборот: полоса вертикальная и тёплая.
function drawAnamorphTr(ctx, W, H, k, d, rev) {
  const S = Math.min(W, H) / 720;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = Math.min(1, trSmooth(k * 1.15));
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const vis = Math.sin(Math.PI * Math.min(1, k));
  if (vis > 0.01) {
    const ext = rev ? H : W;
    const len = ext * (0.25 + 0.9 * vis);
    const th = Math.max(2, 5 * S * (1 + vis * 2));
    const c1 = rev ? '255, 150, 60' : '80, 160, 255';
    const c2 = rev ? '255, 220, 170' : '190, 225, 255';
    ctx.save();
    ctx.translate(W / 2, H / 2);
    if (rev) ctx.rotate(Math.PI / 2);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
    g.addColorStop(0, 'rgba(' + c1 + ', 0)');
    g.addColorStop(0.5, 'rgba(' + c2 + ', ' + 0.95 * vis + ')');
    g.addColorStop(1, 'rgba(' + c1 + ', 0)');
    ctx.globalAlpha = 0.18 * vis;
    ctx.fillStyle = g;
    ctx.fillRect(-len / 2, -th * 5, len, th * 10);
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(-len / 2, -th / 2, len, th);
    ctx.fillStyle = 'rgba(255, 255, 255, ' + vis + ')';
    ctx.fillRect(-len * 0.22, -th * 0.2, len * 0.44, th * 0.4);
    ctx.restore();
    const fl = Math.max(0, 1 - Math.abs(k - 0.5) / 0.14);
    if (fl > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45 * fl;
      ctx.fillStyle = 'rgb(' + c2 + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// Линза: кадр раздувается, как через широкоугольный объектив, затем уходит в чёрное.
// Наоборот: кадр сжимается в «бочку».
function drawLensTr(ctx, W, H, k, d, rev) {
  const S = Math.min(W, H) / 720;
  ensure(W, H);
  copyFrame(ctx, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const b = rev ? -k * 0.35 : k * 1.1;
  const step = Math.max(2, Math.round(3 * S));
  const cx = W / 2;
  const cy = H / 2;
  for (let y = 0; y < H; y += step) {
    const hh = Math.min(step, H - y);
    const v = (y + hh / 2 - cy) / cy;
    const sm = 1 + b * (1 - v * v);
    ctx.drawImage(snap, 0, y, W, hh, cx - cx * sm, y, W * sm, hh);
  }
  copyFrame(ctx, W, H);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += step) {
    const ww = Math.min(step, W - x);
    const u = (x + ww / 2 - cx) / cx;
    const sm = 1 + b * 0.8 * (1 - u * u);
    ctx.drawImage(snap, x, 0, ww, H, x, cy - cy * sm, ww, H * sm);
  }
  ctx.globalAlpha = trSmooth((k - 0.6) / 0.4);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}
// Появление и конец ролика. k = 1: кадр спрятан, k = 0: кадр виден полностью.
// dir = 1 в начале ролика, dir = -1 в конце. rev = true: эффект идёт в обратную сторону.
function drawTransition(ctx, W, H, k, mode, dir, rev) {
  const S = Math.min(W, H) / 720;
  const d = rev ? -dir : dir;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  if (mode === 'white') {
    ctx.globalAlpha = k;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
  } else if (mode === 'zoom') {
    ensure(W, H);
    copyFrame(ctx, W, H);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.translate(W / 2, H / 2);
    const z = rev ? 1 - k * 0.6 : 1 + k * 0.6;
    ctx.scale(z, z);
    ctx.drawImage(snap, -W / 2, -H / 2);
    ctx.restore();
  } else if (mode === 'slide') {
    ensure(W, H);
    copyFrame(ctx, W, H);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(snap, 0, d * k * H);
  } else if (mode === 'wipe') {
    ctx.fillStyle = '#000000';
    if (d > 0) ctx.fillRect(W * (1 - k), 0, W * k + 1, H);
    else ctx.fillRect(0, 0, W * k + 1, H);
  } else if (mode === 'circle') {
    const R = Math.hypot(W, H) / 2;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    if (rev) {
      ctx.arc(W / 2, H / 2, R * k, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.rect(0, 0, W, H);
      ctx.arc(W / 2, H / 2, R * (1 - k), 0, Math.PI * 2, true);
      ctx.fill('evenodd');
    }
  } else if (mode === 'door') {
    ctx.fillStyle = '#000000';
    if (rev) {
      ctx.fillRect(W / 2 - (W * k) / 2, 0, W * k + 1, H);
    } else {
      ctx.fillRect(0, 0, (W / 2) * k + 1, H);
      ctx.fillRect(W - (W / 2) * k, 0, (W / 2) * k + 1, H);
    }
  } else if (mode === 'blinds') {
    const n = 8;
    const h = H / n;
    ctx.fillStyle = '#000000';
    for (let i = 0; i < n; i++) {
      const y = i * h + (rev ? h * (1 - k) : 0);
      ctx.fillRect(0, y, W, h * k + 1);
    }
  } else if (mode === 'spin') {
    drawVortex(ctx, W, H, k, d, rev);
  } else if (mode === 'glitch') {
    drawGlitchTr(ctx, W, H, k, d, rev);
  } else if (mode === 'tv') {
    drawTvTr(ctx, W, H, k, d, rev);
  } else if (mode === 'checker') {
    const cols = 8;
    const size = W / cols;
    const rows = Math.ceil(H / size);
    ctx.fillStyle = '#000000';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = rev ? (c + r) / (cols + rows) : hash(r * 977 + c * 31 + 5);
        if (t < k) ctx.fillRect(c * size, r * size, size + 1, size + 1);
      }
    }
  } else if (mode === 'rgb') {
    drawRgbTr(ctx, W, H, k, d, rev);
  } else if (mode === 'diag') {
    const L = Math.hypot(W, H);
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.translate(W / 2, H / 2);
    ctx.rotate(d > 0 ? Math.PI / 4 : Math.PI / 4 + Math.PI);
    ctx.fillRect(L / 2 - L * k, -L, L * k + 1, L * 2);
    ctx.restore();
      } else if (mode === 'whip') {
    drawWhipTr(ctx, W, H, k, d, rev);
  } else if (mode === 'zblur') {
    drawZoomBlurTr(ctx, W, H, k, d, rev);
  } else if (mode === 'leak') {
    drawLeakTr(ctx, W, H, k, d, rev);
  } else if (mode === 'ripple') {
    drawRippleTr(ctx, W, H, k, d, rev);
  } else if (mode === 'flip') {
    drawFlipTr(ctx, W, H, k, d, rev);
  } else if (mode === 'clock') {
    drawClockTr(ctx, W, H, k, d, rev);
  } else if (mode === 'shatter') {
    drawShatterTr(ctx, W, H, k, d, rev);
  } else if (mode === 'burn') {
    drawBurnTr(ctx, W, H, k, d, rev);
  } else if (mode === 'dissolve') {
    drawDissolveTr(ctx, W, H, k, d, rev);
  } else if (mode === 'shine') {
    drawShineTr(ctx, W, H, k, d, rev);
  } else if (mode === 'slam') {
    drawSlamTr(ctx, W, H, k, d, rev);
  } else if (mode === 'focus') {
    drawFocusTr(ctx, W, H, k, d, rev);
  } else if (mode === 'iris') {
    drawIrisTr(ctx, W, H, k, d, rev);
  } else if (mode === 'split') {
    drawSplitTr(ctx, W, H, k, d, rev);
  } else if (mode === 'cine') {
    drawCineTr(ctx, W, H, k, d, rev);
  } else if (mode === 'slice') {
    drawSliceTr(ctx, W, H, k, d, rev);
  } else if (mode === 'bars') {
    drawBarsTr(ctx, W, H, k, d, rev);
  } else if (mode === 'chroma') {
    drawChromaTr(ctx, W, H, k, d, rev);
  } else if (mode === 'roll') {
    drawRollTr(ctx, W, H, k, d, rev);
  } else if (mode === 'anamorph') {
    drawAnamorphTr(ctx, W, H, k, d, rev);
  } else if (mode === 'lens') {
    drawLensTr(ctx, W, H, k, d, rev);
  } else if (mode === 'strobe') {
    drawStrobeTr(ctx, W, H, k, d, rev);
  } else if (mode === 'lightning') {
    drawLightningTr(ctx, W, H, k, d, rev);
  } else if (mode === 'hyper') {
    drawHyperTr(ctx, W, H, k, d, rev);
  } else if (mode === 'laser') {
    drawLaserTr(ctx, W, H, k, d, rev);
  } else if (mode === 'star') {
    drawStarTr(ctx, W, H, k, d, rev);
  } else if (mode === 'heart') {
    drawHeartTr(ctx, W, H, k, d, rev);
  } else if (mode === 'echo') {
    drawEchoTr(ctx, W, H, k, d, rev);
  } else if (mode === 'pixel') {
    const size = Math.max(4, Math.round((4 + k * 60) * S));
    const pw = Math.max(1, Math.round(W / size));
    const ph = Math.max(1, Math.round(H / size));
    ensureSmall(W, H);
    tinyCtx.imageSmoothingEnabled = true;
    tinyCtx.clearRect(0, 0, tiny.width, tiny.height);
    tinyCtx.drawImage(ctx.canvas, 0, 0, W, H, 0, 0, pw, ph);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tiny, 0, 0, pw, ph, 0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = k * k;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
  } else if (mode === 'blur') {
    ensureSmall(W, H);
    tinyCtx.imageSmoothingEnabled = true;
    tinyCtx.clearRect(0, 0, tiny.width, tiny.height);
    tinyCtx.drawImage(ctx.canvas, 0, 0, W, H, 0, 0, tiny.width, tiny.height);
    glowCtx.imageSmoothingEnabled = true;
    glowCtx.clearRect(0, 0, glow.width, glow.height);
    glowCtx.drawImage(tiny, 0, 0, glow.width, glow.height);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = Math.min(1, k * 1.6);
    ctx.drawImage(glow, 0, 0, W, H);
    ctx.globalAlpha = k * 0.6;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.globalAlpha = k;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalAlpha = 1;
}
export function drawFrameExtras(ctx, t, duration, withFade) {
  const e = effects;
  if (!(e.bpm > 0 || e.progress > 0 || e.fadeIn > 0 || e.fadeOut > 0)) return;

  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const S = Math.min(W, H) / 720;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';

  // плашка с темпом, точка пульсирует на каждый удар
  const grid = getBeatGrid();
  if (e.bpm > 0 && grid) {
    const beat = env(t, 0.18);
    const fs = Math.round(30 * S);
    ctx.font = `700 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    const label = `${Math.round(grid.bpm)} BPM`;
    const tw = ctx.measureText(label).width;
    const h = fs * 1.9;
    const w = tw + fs * 2.4;
    const x = 36 * S;
    const y = 72 * S;
    ctx.globalAlpha = Math.min(1, e.bpm);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    pill(ctx, x, y, w, h);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + fs * 0.95, y + h / 2, fs * (0.2 + 0.2 * beat), 0, Math.PI * 2);
    ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + fs * 1.7, y + h / 2 + fs * 0.04);
  }

  // тонкая полоска прогресса внизу кадра
  if (e.progress > 0 && duration > 0) {
    const bh = Math.max(3, Math.round(6 * S));
    ctx.globalAlpha = Math.min(1, e.progress);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(0, H - bh, W, bh);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, H - bh, W * Math.min(1, Math.max(0, t / duration)), bh);
  }

  // появление и конец ролика: вид выбирается в панели «Эффекты»
  if (withFade && duration > 0) {
    const fi = Math.min(e.fadeIn, duration / 2);
    const fo = Math.min(e.fadeOut, duration / 2);
    let kIn = 0;
    let kOut = 0;
    if (fi > 0 && t < fi) kIn = 1 - t / fi;
    if (fo > 0 && t > duration - fo) kOut = 1 - (duration - t) / fo;
    const isOut = kOut > kIn;
    let k = Math.min(1, Math.max(kIn, kOut));
    if (k > 0.001) {
      k = k * k * (3 - 2 * k);
      drawTransition(ctx, W, H, k, isOut ? e.outroMode : e.introMode, isOut ? -1 : 1, isOut ? e.outroRev : e.introRev);
    }
  }

  ctx.restore();
}
// ---------- главная функция ----------

export function drawEffects(ctx, bars, t) {
  const e = effects;
    if (!(e.zoom > 0 || e.flash > 0 || e.glitch > 0 || e.shake > 0 || e.vignette > 0 || e.grain > 0 || e.bloom > 0 || e.warp > 0 || e.radial > 0 || e.pixel > 0 || e.tint > 0 || e.scan > 0 || e.mirror > 0 || e.tilt > 0 || e.ghost > 0 || e.invert > 0 || e.tile > 0 || e.punch > 0 || e.vhs > 0 || e.bpm > 0)) return;

  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const S = Math.min(W, H) / 720;
  ensure(W, H);
  followAudio(bars, t);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // 0а. зеркало: калейдоскоп из кадра, виден всегда, на ударе сильнее и меняет число секторов
  if (e.mirror > 0) {
    copyFrame(ctx, W, H);
    const sectors = st.beatIdx % 2 ? 6 : 8;
    const half = Math.PI / sectors;
    const R = Math.hypot(W, H);
    ctx.globalAlpha = Math.min(1, e.mirror * (0.6 + 0.9 * env(t, 0.25)));
    for (let i = 0; i < sectors; i++) {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(t * 0.3 + i * 2 * half);
      if (i % 2) ctx.scale(1, -1);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, -half, half);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(snap, -W / 2, -H / 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // 0б. мозаика: на ударе кадр на миг превращается в сетку одинаковых копий
  {
    const tl = e.tile * env(t, 0.16);
    if (tl > 0.12) {
      const n = 2 + (st.beatIdx % 2);
      copyFrame(ctx, W, H);
      ctx.globalAlpha = Math.min(1, tl * 2);
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          ctx.drawImage(snap, 0, 0, W, H, (c * W) / n, (r * H) / n, W / n, H / n);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  // 0в. призраки: за кадром остаются полупрозрачные копии, на ударе они разъезжаются
  if (e.ghost > 0) {
    copyFrame(ctx, W, H);
    const spread = (4 + 42 * env(t, 0.25)) * e.ghost * S;
    const ang = st.beatIdx * 2.4;
    const gx = Math.cos(ang) * spread;
    const gy = Math.sin(ang) * spread;
    for (let k = 1; k <= 3; k++) {
      ctx.globalAlpha = Math.min(1, e.ghost) * (0.34 / k);
      ctx.drawImage(snap, gx * k, gy * k);
      ctx.drawImage(snap, -gx * k, -gy * k);
    }
    ctx.globalAlpha = 1;
  }

  // 0г. наклон: на ударе кадр качнётся в сторону и вернётся
  {
    const tr = e.tilt * 0.06 * env(t, 0.3) * (st.beatIdx % 2 ? 1 : -1);
    if (Math.abs(tr) > 0.0006) {
      const fit = Math.cos(tr) + Math.abs(Math.sin(tr)) * Math.max(W, H) / Math.min(W, H);
      copyFrame(ctx, W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(tr);
      ctx.scale(fit, fit);
      ctx.drawImage(snap, -W / 2, -H / 2);
      ctx.restore();
    }
  }
  // 1. зум и тряска: двигаем и увеличиваем весь кадр
  if (e.zoom > 0 || e.shake > 0) {
    let z = 1 + e.zoom * (0.07 * env(t, 0.22) + 0.02 * Math.min(1, st.bass));
    let dx = 0;
    let dy = 0;
    if (e.shake > 0) {
      const a = e.shake * 16 * S * env(t, 0.12);
      dx = ((Math.sin(t * 61.3) + Math.sin(t * 37.1 + 1.7)) * 0.5) * a;
      dy = ((Math.sin(t * 53.9 + 0.6) + Math.sin(t * 29.7 + 2.4)) * 0.5) * a;
      // небольшое увеличение, чтобы при тряске не показывались края
      z *= 1 + (2 * e.shake * 16 * S) / Math.min(W, H);
    }
    copyFrame(ctx, W, H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2 + dx, H / 2 + dy);
    ctx.scale(z, z);
    ctx.drawImage(snap, -W / 2, -H / 2);
    ctx.restore();
  }
  // 1б. рябь: строки кадра колышутся волной, сила растёт с басом
  if (e.warp > 0) {
    const amp = e.warp * (3 + 20 * Math.min(1, st.bass) + 26 * env(t, 0.25)) * S;
    copyFrame(ctx, W, H);
    const stepY = Math.max(2, Math.round(6 * S));
    const phase = t * 6;
    for (let y = 0; y < H; y += stepY) {
      const hh = Math.min(stepY, H - y);
      const dx = Math.sin(y / (40 * S) + phase) * amp;
      ctx.drawImage(snap, 0, y, W, hh, dx - amp, y, W + amp * 2, hh);
    }
  }

  // 1в. радиальный блюр: на ударе кадр «улетает» из центра
  {
    const rb = e.radial * env(t, 0.2);
    if (rb > 0.03) {
      copyFrame(ctx, W, H);
      for (let k = 1; k <= 6; k++) {
        const z = 1 + rb * 0.05 * k;
        ctx.globalAlpha = 1 / (k + 1);
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(z, z);
        ctx.drawImage(snap, -W / 2, -H / 2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  // 1г. пиксели: на ударе кадр распадается на крупные квадраты
  {
    const pv = e.pixel * env(t, 0.18);
    if (pv > 0.04) {
      const size = Math.max(4, Math.round((4 + pv * 40) * S));
      const pw = Math.max(1, Math.round(W / size));
      const ph = Math.max(1, Math.round(H / size));
      ensureSmall(W, H);
      tinyCtx.imageSmoothingEnabled = true;
      tinyCtx.clearRect(0, 0, tiny.width, tiny.height);
      tinyCtx.drawImage(ctx.canvas, 0, 0, W, H, 0, 0, pw, ph);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tiny, 0, 0, pw, ph, 0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
    }
  }
  // 2. глитч: смещённые полосы и расслоение цветов
  const g = e.glitch * env(t, 0.2);
  if (g > 0.05) {
    copyFrame(ctx, W, H);
      const idx = st.beatIdx * 977 + Math.floor(t * 30 + 1e-6);
    const count = 3 + Math.floor(g * 9);
    for (let k = 0; k < count; k++) {
      const y = Math.floor(hash(idx * 31 + k * 7 + 1) * H);
      const h = Math.max(2, Math.floor((0.01 + hash(idx * 31 + k * 7 + 2) * 0.07) * H));
      const dx = (hash(idx * 31 + k * 7 + 3) - 0.5) * 2 * g * 90 * S;
      ctx.drawImage(snap, 0, y, W, h, dx, y, W, h);
    }

    if (g > 0.12) {
      const d = g * 14 * S;
      copyFrame(ctx, W, H);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      const chans = [
        ['#ff0000', -d],
        ['#00ff00', 0],
        ['#0000ff', d]
      ];
      for (let c = 0; c < chans.length; c++) {
        chanCtx.globalCompositeOperation = 'source-over';
        chanCtx.drawImage(snap, 0, 0);
        chanCtx.globalCompositeOperation = 'multiply';
        chanCtx.fillStyle = chans[c][0];
        chanCtx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(chan, chans[c][1], 0);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // 2б. свечение: размытая копия кадра накладывается поверх
  if (e.bloom > 0) {
    ensureSmall(W, H);
    tinyCtx.imageSmoothingEnabled = true;
    tinyCtx.clearRect(0, 0, tiny.width, tiny.height);
    tinyCtx.drawImage(ctx.canvas, 0, 0, W, H, 0, 0, tiny.width, tiny.height);
    glowCtx.imageSmoothingEnabled = true;
    glowCtx.clearRect(0, 0, glow.width, glow.height);
    glowCtx.drawImage(tiny, 0, 0, glow.width, glow.height);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(1, e.bloom * (0.2 + 0.35 * Math.min(1, st.bass) + 0.45 * env(t, 0.2)));
    ctx.drawImage(glow, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // 2в. цветовой пульс: кадр заливается цветом волн, на бит вспыхивает сильнее
  if (e.tint > 0) {
    const ta = Math.min(0.9, e.tint * (0.1 + 0.55 * env(t, 0.3) + 0.2 * Math.min(1, st.bass)));
    if (ta > 0.01) {
      let c1 = wave.color1;
      let c2 = wave.colorMode === 'gradient' ? wave.color2 : wave.color1;
      if (wave.colorMode === 'rainbow') {
        c1 = `hsl(${Math.round((t * 40 + st.beatIdx * 53) % 360)}, 90%, 55%)`;
        c2 = `hsl(${Math.round((t * 40 + st.beatIdx * 53 + 90) % 360)}, 90%, 55%)`;
      }
      const tg = ctx.createLinearGradient(0, 0, 0, H);
      tg.addColorStop(0, c1);
      tg.addColorStop(1, c2);
      ctx.fillStyle = tg;
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = ta;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = ta * 0.2;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
    // 2г. контраст-удар: кадр накладывается сам на себя, цвета становятся плотнее на басе
  if (e.punch > 0) {
    const pa = Math.min(1, e.punch * (0.15 + 0.45 * Math.min(1, st.bass) + 0.6 * env(t, 0.2)));
    if (pa > 0.02) {
      copyFrame(ctx, W, H);
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = pa;
      ctx.drawImage(snap, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // 2д. инверсия: на сильном ударе цвета на миг превращаются в негатив
  {
    const iv = e.invert * env(t, 0.1);
    if (iv > 0.08) {
      ctx.globalCompositeOperation = 'difference';
      ctx.globalAlpha = Math.min(1, iv * 2.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // 3. вспышка
  const fa = e.flash * 0.55 * env(t, 0.14);
  if (fa > 0.01) {
    ctx.globalAlpha = Math.min(1, fa);
    ctx.fillStyle = wave.colorMode === 'rainbow' ? '#ffffff' : wave.color1;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = Math.min(1, fa * 0.45);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // 4. виньетка: края темнеют и «дышат» от баса
  if (e.vignette > 0) {
    const a = Math.min(0.95, e.vignette * (0.5 + 0.35 * Math.min(1, st.bass)));
    const r0 = Math.min(W, H) * 0.3;
    const r1 = Math.hypot(W, H) * 0.5;
    const grad = ctx.createRadialGradient(W / 2, H / 2, r0, W / 2, H / 2, r1);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, `rgba(0, 0, 0, ${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  // 4б. сканлайны: строки как у старого ЭЛТ-экрана и ползущая светлая полоса
  if (e.scan > 0) {
    const P = Math.max(2, Math.round(4 * S));
    const sp = scanPattern(ctx, P);
    if (sp) {
      ctx.globalAlpha = Math.min(0.9, e.scan * (0.35 + 0.1 * Math.min(1, st.bass)));
      ctx.fillStyle = sp;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    const by = (((t * 0.12) % 1.3) - 0.15) * H;
    const bh = H * 0.12;
    const bg = ctx.createLinearGradient(0, by, 0, by + bh);
    bg.addColorStop(0, 'rgba(255, 255, 255, 0)');
    bg.addColorStop(0.5, `rgba(255, 255, 255, ${Math.min(0.2, e.scan * 0.08)})`);
    bg.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, by, W, bh);
  }
  // 4в. VHS: плёнка на весь кадр. Цветовой разъезд, мягкость, дрожь строк,
  // ползущая полоса трекинга, сбой головки снизу, выцветшие чёрные, строки, шум
  if (e.vhs > 0) {
    const v = Math.min(1.5, e.vhs);
    const fr = Math.floor(t * 30 + 1e-6);
    const bass = Math.min(1, st.bass);
    const hit = env(t, 0.2);

    // 1. цветовой разъезд: красный уходит влево, синий вправо, по всему кадру
    copyFrame(ctx, W, H);
    const dc = (1.5 + 3.5 * v + 5 * hit) * S;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const tapeChans = [
      ['#ff0000', -dc],
      ['#00ff00', 0],
      ['#0000ff', dc]
    ];
    for (let c = 0; c < tapeChans.length; c++) {
      chanCtx.globalCompositeOperation = 'source-over';
      chanCtx.drawImage(snap, 0, 0);
      chanCtx.globalCompositeOperation = 'multiply';
      chanCtx.fillStyle = tapeChans[c][0];
      chanCtx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(chan, tapeChans[c][1], 0);
    }
    ctx.globalCompositeOperation = 'source-over';

    // 2. мягкость плёнки: слегка размытая копия поверх кадра
    ensureSmall(W, H);
    tinyCtx.imageSmoothingEnabled = true;
    tinyCtx.clearRect(0, 0, tiny.width, tiny.height);
    tinyCtx.drawImage(ctx.canvas, 0, 0, W, H, 0, 0, tiny.width, tiny.height);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = Math.min(0.55, 0.1 + 0.22 * v);
    ctx.drawImage(tiny, 0, 0, W, H);
    ctx.globalAlpha = 1;

    // 3. дрожь строк по всему кадру: плавное «плавание» и мелкие случайные сдвиги
    copyFrame(ctx, W, H);
    const rowStep = Math.max(2, Math.round(4 * S));
    const wob = v * (0.8 + 1.6 * bass) * S;
    for (let y = 0; y < H; y += rowStep) {
      const hh = Math.min(rowStep, H - y);
      const dx = Math.sin(y / (55 * S) + t * 2.3) * wob + (hash(fr * 131 + ((y / rowStep) | 0)) - 0.5) * v * 1.6 * S;
      ctx.drawImage(snap, 0, y, W, hh, dx, y, W, hh);
    }

    // 4. полоса трекинга ползёт по кадру снизу вверх, плюс сбой головки внизу кадра
    copyFrame(ctx, W, H);
    const tear = (y0, y1, amp, step, salt) => {
      for (let y = Math.max(0, Math.floor(y0)); y < y1 && y < H; y += step) {
        const hh = Math.min(step, H - y);
        const dx = (Math.sin(y * 0.35 + t * 40) * 0.5 + (hash(fr * 71 + salt + ((y / step) | 0)) - 0.5)) * amp;
        ctx.drawImage(snap, 0, y, W, hh, dx, y, W, hh);
      }
    };
    const tearStep = Math.max(2, Math.round(2 * S));
    const bandH = H * (0.07 + 0.05 * bass);
    const bandY = (1.1 - ((t * 0.11) % 1.25)) * H;
    tear(bandY, bandY + bandH, v * (10 + 26 * hit) * S, tearStep, 5000);
    tear(H * 0.94, H, v * 22 * S, tearStep, 9000);

    // светлая полоса на месте трекинга
    const bg = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
    bg.addColorStop(0, 'rgba(255, 255, 255, 0)');
    bg.addColorStop(0.5, `rgba(255, 255, 255, ${Math.min(0.25, 0.1 * v)})`);
    bg.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, bandY, W, bandH);

    // 5. белые чёрточки-помехи по всему кадру, в полосе трекинга их больше
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = Math.min(0.55, v * 0.25);
    const dashes = 8 + Math.round(6 * v);
    for (let k = 0; k < dashes; k++) {
      const nx = hash(fr * 23 + k * 3 + 1) * W;
      const nw = (0.03 + hash(fr * 23 + k * 3 + 2) * 0.25) * W;
      const ny = hash(fr * 23 + k * 3 + 3) * H;
      ctx.fillRect(nx, ny, nw, Math.max(1, Math.round(1.5 * S)));
    }
    for (let k = 0; k < 6; k++) {
      const nx = hash(fr * 29 + k * 3 + 1) * W;
      const nw = (0.05 + hash(fr * 29 + k * 3 + 2) * 0.3) * W;
      const ny = bandY + hash(fr * 29 + k * 3 + 3) * bandH;
      ctx.fillRect(nx, ny, nw, Math.max(1, Math.round(2 * S)));
    }
    ctx.globalAlpha = 1;

    // 6. выцветшие чёрные: плёнка не бывает глубокого чёрного
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgb(30, 24, 48)';
    ctx.globalAlpha = Math.min(0.8, 0.5 * v);
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // 7. тонкие строки развёртки
    const vp = scanPattern(ctx, Math.max(2, Math.round(4 * S)));
    if (vp) {
      ctx.globalAlpha = Math.min(0.35, 0.08 + 0.1 * v);
      ctx.fillStyle = vp;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // 8. шум плёнки
    if (!tiles) makeTiles();
    const nsc = Math.max(1, 2 * S);
    const nox = -hash(fr * 3 + 11) * GRAIN * nsc;
    const noy = -hash(fr * 3 + 12) * GRAIN * nsc;
    const npat = ctx.createPattern(tiles[fr % TILES], 'repeat');
    if (npat) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.5, 0.22 * v);
      ctx.globalCompositeOperation = 'overlay';
      ctx.translate(nox, noy);
      ctx.scale(nsc, nsc);
      ctx.fillStyle = npat;
      ctx.fillRect(-nox / nsc, -noy / nsc, W / nsc, H / nsc);
      ctx.restore();
    }
  }
  // 5. зерно
  if (e.grain > 0) {
    if (!tiles) makeTiles();
    const f = Math.floor(t * 24 + 1e-6);
    const sc = Math.max(1, 2 * S);
    const ox = -hash(f * 3 + 1) * GRAIN * sc;
    const oy = -hash(f * 3 + 2) * GRAIN * sc;
    const pat = ctx.createPattern(tiles[f % TILES], 'repeat');
    if (pat) {
      ctx.globalAlpha = Math.min(1, e.grain * 0.45);
      ctx.globalCompositeOperation = 'overlay';
      ctx.translate(ox, oy);
      ctx.scale(sc, sc);
      ctx.fillStyle = pat;
      ctx.fillRect(-ox / sc, -oy / sc, W / sc, H / sc);
    }
  }

  ctx.restore();
}
