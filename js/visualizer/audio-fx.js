// Звуковые настройки, общие для предпросмотра и экспорта.
// Реверб строится одной и той же функцией и там и там, а импульс комнаты
// всегда одинаковый (фиксированное зерно), поэтому в MP4 звучит ровно то, что вы слышали.

import { getBeatGrid } from '/js/visualizer/beats.js';

export const AUDIO_FX_DEFAULTS = {
  reverb: 0, bass: 0, mid: 0, treble: 0,
  d8: 0, d8Speed: 0.2,
  echo: 0, echoDiv: 0.5, echoFb: 0.4,
  filterMode: 0, filter: 0,
  wide: 0, lofi: 0,
  modMode: 0, modDepth: 0.5, modRate: 0.8
};
export const audioFx = { ...AUDIO_FX_DEFAULTS };

const AUDIO_FX_RANGE = {
  reverb: [0, 1], bass: [-1, 1], mid: [-1, 1], treble: [-1, 1],
  d8: [0, 1], d8Speed: [0.05, 1],
  echo: [0, 1], echoDiv: [0.25, 1], echoFb: [0, 0.85],
  filterMode: [0, 3], filter: [0, 1],
  wide: [0, 1], lofi: [0, 1],
  modMode: [0, 3], modDepth: [0, 1], modRate: [0.1, 8]
};

export function setAudioFx(patch) {
  if (!patch) return;
  Object.keys(AUDIO_FX_RANGE).forEach((k) => {
    if (typeof patch[k] === 'number' && isFinite(patch[k])) {
      audioFx[k] = Math.min(AUDIO_FX_RANGE[k][1], Math.max(AUDIO_FX_RANGE[k][0], patch[k]));
    }
  });
}
// 8D: звук плавно ездит слева направо. audioFx.d8 = ширина, audioFx.d8Speed = скорость (Гц).
export function createSpatial(ctx) {
  const pan = ctx.createStereoPanner();
  const osc = ctx.createOscillator();
  const depth = ctx.createGain();
  osc.type = 'sine';
  osc.connect(depth);
  depth.connect(pan.pan);
  osc.start(0);

  function update() {
    osc.frequency.value = audioFx.d8Speed;
    depth.gain.value = audioFx.d8;
  }

  update();
  return { input: pan, output: pan, update };
}

// Эхо по BPM: время задержки = длина удара × доля (1, 1/2, 1/4). Если BPM не найден, берётся 120.
// Возвращает { input, output, update(), flush() }. flush() обрывает «хвост» повторов.
export function createEcho(ctx) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const fb = ctx.createGain();
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 4500;

  input.connect(dry);
  dry.connect(output);
  tone.connect(fb);
  tone.connect(wet);
  wet.connect(output);

  let delay = null;

  function link() {
    delay = ctx.createDelay(2);
    input.connect(delay);
    delay.connect(tone);
    fb.connect(delay);
    update();
  }

  function unlink() {
    if (!delay) return;
    try { input.disconnect(delay); } catch (e) {}
    try { fb.disconnect(delay); } catch (e) {}
    try { delay.disconnect(); } catch (e) {}
    delay = null;
  }

  function update() {
    if (delay) {
      const grid = getBeatGrid();
      let t = (grid ? grid.period : 0.5) * audioFx.echoDiv;
      while (t > 1.9) t /= 2;
      delay.delayTime.value = Math.max(0.01, t);
    }
    fb.gain.value = audioFx.echoFb;
    wet.gain.value = audioFx.echo * 0.8;
  }

  function flush() {
    unlink();
    link();
  }

  link();
  return { input, output, update, flush };
}
// Фильтры: 1 = «Под водой», 2 = «Из-за стены», 3 = «Радио». audioFx.filter = сила 0..1.
export function createFilter(ctx) {
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  const mid = ctx.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = 1800;
  mid.Q.value = 1;
  hp.connect(lp);
  lp.connect(mid);

  function update() {
    const a = audioFx.filter;
    const m = Math.round(audioFx.filterMode);
    let hpF = 10;
    let lpF = 20000;
    let lpQ = 0.7;
    let midG = 0;
    if (m > 0 && a > 0) {
      if (m === 1) {
        lpF = 20000 * Math.pow(500 / 20000, a);
        lpQ = 0.7 + a * 4;
      } else if (m === 2) {
        lpF = 20000 * Math.pow(180 / 20000, a);
      } else {
        hpF = 10 * Math.pow(450 / 10, a);
        lpF = 20000 * Math.pow(3200 / 20000, a);
        midG = a * 7;
      }
    }
    hp.frequency.value = hpF;
    lp.frequency.value = lpF;
    lp.Q.value = lpQ;
    mid.gain.value = midG;
  }

  update();
  return { input: hp, output: mid, update };
}
// Стерео-расширение: усиливает разницу между левым и правым каналом (mid/side).
export function createWide(ctx) {
  const input = ctx.createGain();
  input.channelCount = 2;
  input.channelCountMode = 'explicit';
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);
  const gLL = ctx.createGain();
  const gRL = ctx.createGain();
  const gLR = ctx.createGain();
  const gRR = ctx.createGain();
  input.connect(splitter);
  splitter.connect(gLL, 0);
  splitter.connect(gLR, 0);
  splitter.connect(gRL, 1);
  splitter.connect(gRR, 1);
  gLL.connect(merger, 0, 0);
  gRL.connect(merger, 0, 0);
  gLR.connect(merger, 0, 1);
  gRR.connect(merger, 0, 1);

  function update() {
    const k = 1 + audioFx.wide * 1.5;
    gLL.gain.value = 0.5 + 0.5 * k;
    gRL.gain.value = 0.5 - 0.5 * k;
    gLR.gain.value = 0.5 - 0.5 * k;
    gRR.gain.value = 0.5 + 0.5 * k;
  }

  update();
  return { input, output: merger, update };
}

// Лоу-фай: приглушённый верх, лёгкое насыщение и шум пластинки.
// Шум включается через start() и выключается через stop().
export function createLofi(ctx) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i * 2) / (curve.length - 1) - 1;
    curve[i] = Math.tanh(x * 3) / Math.tanh(3);
  }
  shaper.curve = curve;
  const noiseGain = ctx.createGain();

  input.connect(dry);
  dry.connect(output);
  input.connect(hp);
  hp.connect(lp);
  lp.connect(shaper);
  shaper.connect(wet);
  wet.connect(output);
  noiseGain.connect(output);

  const len = Math.floor(ctx.sampleRate * 2);
  const noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  let seed = 0x1badf00d;
  for (let i = 0; i < len; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    const r = (seed >>> 8) / 8388608 - 1;
    nd[i] = r * 0.4;
    if (((seed >>> 3) & 4095) === 0) nd[i] = r > 0 ? 1 : -1;
  }

  let noise = null;

  function update() {
    const a = audioFx.lofi;
    lp.frequency.value = 16000 * Math.pow(3200 / 16000, a);
    hp.frequency.value = 30 + a * 120;
    dry.gain.value = 1 - a;
    wet.gain.value = a;
    noiseGain.gain.value = a * 0.025;
  }

  function stop() {
    if (!noise) return;
    try { noise.stop(); } catch (e) {}
    try { noise.disconnect(); } catch (e) {}
    noise = null;
  }

  function start() {
    stop();
    noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    noise.connect(noiseGain);
    noise.start(0);
  }

  update();
  return { input, output, update, start, stop };
}

// Хорус, фленджер, тремоло: audioFx.modMode 1/2/3, modDepth = глубина, modRate = скорость (Гц).
export function createMod(ctx) {
  const input = ctx.createGain();
  const trem = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const delay = ctx.createDelay(0.1);
  const fb = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoTrem = ctx.createGain();
  const lfoDelay = ctx.createGain();
  lfo.type = 'sine';
  lfo.connect(lfoTrem);
  lfoTrem.connect(trem.gain);
  lfo.connect(lfoDelay);
  lfoDelay.connect(delay.delayTime);
  lfo.start(0);

  input.connect(trem);
  trem.connect(dry);
  dry.connect(output);
  trem.connect(delay);
  delay.connect(wet);
  wet.connect(output);
  delay.connect(fb);
  fb.connect(delay);

  function update() {
    const m = Math.round(audioFx.modMode);
    const d = audioFx.modDepth;
    let tremBase = 1;
    let tremDepth = 0;
    let delBase = 0.02;
    let delDepth = 0;
    let wetG = 0;
    let fbG = 0;
    if (m === 1) {
      delBase = 0.022;
      delDepth = 0.004 * d;
      wetG = 0.35 + 0.4 * d;
    } else if (m === 2) {
      delBase = 0.007;
      delDepth = 0.0035 * d;
      wetG = 0.6;
      fbG = 0.3 + 0.4 * d;
    } else if (m === 3) {
      tremBase = 1 - d / 2;
      tremDepth = d / 2;
    }
    lfo.frequency.value = audioFx.modRate;
    trem.gain.value = tremBase;
    lfoTrem.gain.value = tremDepth;
    delay.delayTime.value = delBase;
    lfoDelay.gain.value = delDepth;
    wet.gain.value = wetG;
    fb.gain.value = fbG;
  }

  update();
  return { input, output, update };
}
// Эквалайзер: бас, середина, верх. Значения audioFx.bass/mid/treble от -1 до 1 (±12 дБ).
// Возвращает { input, output, update() }. update() перечитывает audioFx.
export function createEq(ctx) {
  const low = ctx.createBiquadFilter();
  low.type = 'lowshelf';
  low.frequency.value = 110;
  const mid = ctx.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = 1100;
  mid.Q.value = 0.8;
  const high = ctx.createBiquadFilter();
  high.type = 'highshelf';
  high.frequency.value = 6000;
  low.connect(mid);
  mid.connect(high);

  function update() {
    low.gain.value = audioFx.bass * 12;
    mid.gain.value = audioFx.mid * 12;
    high.gain.value = audioFx.treble * 12;
  }

  update();
  return { input: low, output: high, update };
}
// Лимитер: не даёт звуку зашкаливать при реверб, басе и эхе.
// Один и тот же узел стоит в предпросмотре и в экспорте.
export function createLimiter(ctx) {
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -2;
  lim.knee.value = 0;
  lim.ratio.value = 20;
  lim.attack.value = 0.003;
  lim.release.value = 0.12;
  return lim;
}
const IR_SECONDS = 1.9;
const IR_DECAY = 3.2;
const PRE_DELAY = 0.018;

// Импульс комнаты: затухающий шум с короткой паузой в начале.
function makeImpulse(ctx) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * IR_SECONDS));
  const pre = Math.floor(rate * PRE_DELAY);
  const attack = Math.max(1, Math.floor(rate * 0.012));
  const ir = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let seed = c === 0 ? 0x2f6e2b1 : 0x5bd1e995;
    for (let i = 0; i < len; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      const noise = (seed >>> 8) / 8388608 - 1;
      if (i < pre) {
        d[i] = 0;
        continue;
      }
      const k = i / len;
      const soft = Math.min(1, (i - pre) / attack);
      d[i] = noise * soft * Math.pow(1 - k, IR_DECAY);
    }
  }
  return ir;
}

// Возвращает { input, output, setAmount(0..1), flush() }.
// Звук подаётся в input, результат берётся из output.
// flush() обрывает «хвост» реверба (нужно при паузе и перемотке).
export function createReverb(ctx, amount) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 5200;
  const ir = makeImpulse(ctx);

  let conv = null;

  function link() {
    conv = ctx.createConvolver();
    conv.buffer = ir;
    input.connect(conv);
    conv.connect(tone);
  }

  function unlink() {
    if (!conv) return;
    try { input.disconnect(conv); } catch (e) {}
    try { conv.disconnect(); } catch (e) {}
    conv = null;
  }

  input.connect(dry);
  dry.connect(output);
  tone.connect(wet);
  wet.connect(output);

  function setAmount(v) {
    const a = Math.min(1, Math.max(0, Number(v) || 0));
    dry.gain.value = 1 - a * 0.45;
    wet.gain.value = a * 0.7;
    if (a > 0 && !conv) link();
    else if (a === 0 && conv) unlink();
  }

  function flush() {
    if (!conv) return;
    unlink();
    link();
  }

  setAmount(amount);
  return { input, output, setAmount, flush };
}