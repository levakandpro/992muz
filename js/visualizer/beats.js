// Темп (BPM) и сетка ударов. Считается один раз по выбранному фрагменту трека,
// поэтому эффекты и частицы бьют ровно в такт, а не «на слух».
// Время в сетке считается от начала фрагмента (так же, как t в предпросмотре и экспорте).

const HOP = 256;
const MIN_BPM = 78;
const MAX_BPM = 178;
const MIN_CONFIDENCE = 1.45;

let grid = null;
let version = 0;

export function setBeatGrid(g) {
  grid = g || null;
  version++;
}

export function getBeatGrid() {
  return grid;
}

export function getGridVersion() {
  return version;
}

// Номер удара на момент t (до первого удара — отрицательный). Если сетки нет — null.
export function gridIndex(t) {
  if (!grid) return null;
  return Math.floor((t - grid.first) / grid.period + 1e-6);
}

export function gridTime(idx) {
  return grid.first + idx * grid.period;
}

export function analyzeBeats(buffer, from, dur) {
  const sr = buffer.sampleRate;
  const s0 = Math.max(0, Math.floor(from * sr));
  const s1 = Math.min(buffer.length, Math.floor((from + dur) * sr));
  const n = s1 - s0;
  if (n < sr * 4) return null;

  const chans = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
  const cn = chans.length;

  const frames = Math.floor(n / HOP);
  const low = new Float32Array(frames);
  const high = new Float32Array(frames);
  const aLow = 1 - Math.exp((-2 * Math.PI * 200) / sr);
  const aMid = 1 - Math.exp((-2 * Math.PI * 1500) / sr);
  let l1 = 0;
  let l2 = 0;
  let m1 = 0;

  for (let f = 0; f < frames; f++) {
    let eLow = 0;
    let eHigh = 0;
    const base = s0 + f * HOP;
    for (let j = 0; j < HOP; j++) {
      let x = 0;
      for (let c = 0; c < cn; c++) x += chans[c][base + j];
      x /= cn;
      l1 += aLow * (x - l1);
      l2 += aLow * (l1 - l2);
      m1 += aMid * (x - m1);
      const h = x - m1;
      eLow += l2 * l2;
      eHigh += h * h;
    }
    low[f] = eLow / HOP;
    high[f] = eHigh / HOP;
  }

  // сила «удара» в каждый момент: рост громкости в басу и в верхах
  const onset = new Float32Array(frames);
  const bands = [[low, 1], [high, 0.5]];
  for (let b = 0; b < bands.length; b++) {
    const e = bands[b][0];
    const w = bands[b][1];
    let mean = 0;
    for (let i = 0; i < frames; i++) mean += e[i];
    mean = mean / frames + 1e-12;
    let prev = Math.log(1 + (20 * e[0]) / mean);
    for (let i = 1; i < frames; i++) {
      const v = Math.log(1 + (20 * e[i]) / mean);
      const d = v - prev;
      if (d > 0) onset[i] += d * w;
      prev = v;
    }
  }

  // вычитаем медленный фон, чтобы остались только пики
  const win = Math.round((0.4 * sr) / HOP);
  const clean = new Float32Array(frames);
  let run = 0;
  for (let i = 0; i < frames; i++) {
    run += onset[i];
    if (i >= win) run -= onset[i - win];
    const cnt = Math.min(i + 1, win);
    const v = onset[i] - run / cnt;
    clean[i] = v > 0 ? v : 0;
  }

  const rate = sr / HOP;

  // грубый темп: автокорреляция
  const lagMin = Math.floor((rate * 60) / MAX_BPM);
  const lagMax = Math.ceil((rate * 60) / MIN_BPM);
  let bestLag = 0;
  let bestAc = -1;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let s = 0;
    for (let i = 0; i + lag < frames; i++) s += clean[i] * clean[i + lag];
    s /= frames - lag;
    const bpm = (rate * 60) / lag;
    const pref = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 124) / 0.8, 2));
    s *= pref;
    if (s > bestAc) {
      bestAc = s;
      bestLag = lag;
    }
  }
  if (!bestLag || bestAc <= 0) return null;
  const bpm0 = (rate * 60) / bestLag;

  // точный темп и сдвиг: перебираем темпы вокруг грубого, для каждого ищем лучший сдвиг
  const smooth = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const a = clean[i > 0 ? i - 1 : 0];
    const b = clean[i];
    const c = clean[i < frames - 1 ? i + 1 : frames - 1];
    smooth[i] = 0.25 * a + 0.5 * b + 0.25 * c;
  }
  const at = (x) => {
    if (x < 0 || x >= frames - 1) return 0;
    const i = Math.floor(x);
    const k = x - i;
    return smooth[i] * (1 - k) + smooth[i + 1] * k;
  };

  let best = { score: -1, bpm: bpm0, phase: 0, mean: 0 };
  const lo = Math.max(MIN_BPM - 2, bpm0 * 0.96);
  const hi = Math.min(MAX_BPM + 2, bpm0 * 1.04);
  for (let bpm = lo; bpm <= hi; bpm += 0.05) {
    const p = (rate * 60) / bpm;
    let sum = 0;
    let top = -1;
    let topPhase = 0;
    let count = 0;
    for (let ph = 0; ph < p; ph += 1) {
      let s = 0;
      for (let x = ph; x < frames - 1; x += p) s += at(x);
      sum += s;
      count++;
      if (s > top) {
        top = s;
        topPhase = ph;
      }
    }
    if (top > best.score) best = { score: top, bpm, phase: topPhase, mean: sum / count };
  }

  const confidence = best.mean > 0 ? best.score / best.mean : 0;
  if (confidence < MIN_CONFIDENCE) return null;

  // если в середине между ударами тоже стабильные удары, то настоящий темп вдвое быстрее
  const dbl = best.bpm * 2;
  if (dbl <= MAX_BPM + 2) {
    const p1 = (rate * 60) / best.bpm;
    const p2 = p1 / 2;
    let s1 = 0;
    let c1 = 0;
    for (let x = best.phase; x < frames - 1; x += p1) {
      s1 += at(x);
      c1++;
    }
    let s2 = 0;
    let c2 = 0;
    for (let x = best.phase; x < frames - 1; x += p2) {
      s2 += at(x);
      c2++;
    }
    if (c1 && c2 && s2 / c2 >= 0.75 * (s1 / c1)) {
      best.bpm = dbl;
      best.phase = best.phase % p2;
    }
  }

  // шаг по сдвигу один кадр, берём середину кадра как момент удара
  const period = 60 / best.bpm;
  let first = ((best.phase + 0.5) * HOP) / sr;
  first -= Math.floor(first / period) * period;

  return { bpm: best.bpm, period, first, confidence };
}