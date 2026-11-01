import { Muxer, ArrayBufferTarget } from '/js/vendor/mp4-muxer.mjs';
import { VIZ_W, VIZ_H, BAR_COUNT, drawWaves, spectrumToBars } from '/js/visualizer/waves.js';
import { drawOverlay } from '/js/visualizer/overlay.js';
import { drawParticles, resetParticles } from '/js/visualizer/particles.js';
import { effects, drawEffects, drawFrameExtras, resetEffects } from '/js/visualizer/effects.js';
import { drawLayers } from '/js/visualizer/layers.js';
import { audioFx, createReverb, createLimiter, createEq, createEcho, createSpatial, createFilter, createLofi, createMod, createWide } from '/js/visualizer/audio-fx.js';
const FPS = 30;
const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const VIDEO_BITRATE = 4000000;
const AUDIO_BITRATE = 128000;
const KEYFRAME_EVERY = FPS * 2;

const FFT_SIZE = 2048;
// Предпросмотр считает сглаживание 60 раз в секунду, экспорт — 30 раз,
// поэтому коэффициент ниже, чтобы картинка двигалась так же.
const SMOOTHING = 0.6;
const MIN_DB = -100;
const MAX_DB = -30;

const VIDEO_CODECS = ['avc1.640028', 'avc1.4d0028', 'avc1.42001f', 'avc1.42E01F'];
const AUDIO_CODEC = 'mp4a.40.2';

// ---------- проверка возможностей браузера ----------

export async function checkExportSupport() {
  if (!('VideoEncoder' in window) || !('VideoFrame' in window)) {
    return {
      ok: false,
      reason: 'Ваш браузер не умеет создавать видео. Обновите браузер (на iPhone — iOS) или откройте страницу в свежем Chrome.'
    };
  }
  if (!('AudioEncoder' in window) || !('AudioData' in window)) {
    return {
      ok: false,
      reason: 'Ваш браузер не умеет кодировать звук для MP4. Обновите браузер (на iPhone — iOS) или откройте страницу в свежем Chrome.'
    };
  }
  if (!(window.OfflineAudioContext || window.webkitOfflineAudioContext)) {
    return { ok: false, reason: 'Браузер не поддерживает обработку звука.' };
  }

  let videoCodec = null;
  for (const codec of VIDEO_CODECS) {
    try {
      const res = await VideoEncoder.isConfigSupported({
        codec,
        width: VIZ_W,
        height: VIZ_H,
        bitrate: VIDEO_BITRATE,
        framerate: FPS
      });
      if (res && res.supported) {
        videoCodec = codec;
        break;
      }
    } catch (e) {}
  }
  if (!videoCodec) {
    return {
      ok: false,
           reason: `Это устройство не поддерживает H.264 в нужном разрешении (${VIZ_W}×${VIZ_H}). Файл не создан, чтобы не получить повреждённое видео.`
    };
  }

  let audioOk = false;
  try {
    const res = await AudioEncoder.isConfigSupported({
      codec: AUDIO_CODEC,
      sampleRate: SAMPLE_RATE,
      numberOfChannels: CHANNELS,
      bitrate: AUDIO_BITRATE
    });
    audioOk = !!(res && res.supported);
  } catch (e) {}
  if (!audioOk) {
    return {
      ok: false,
      reason: 'Это устройство не умеет кодировать звук в AAC. Файл не создан, чтобы не получить видео без звука.'
    };
  }

  return { ok: true, videoCodec };
}

// ---------- БПФ (FFT), чтобы получать спектр без воспроизведения ----------

function createFft(n) {
  const levels = Math.log2(n);
  const cos = new Float32Array(n / 2);
  const sin = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let x = i;
    let r = 0;
    for (let j = 0; j < levels; j++) {
      r = (r << 1) | (x & 1);
      x >>>= 1;
    }
    rev[i] = r;
  }

  return function transform(re, im) {
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= n; size *= 2) {
      const half = size / 2;
      const step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const l = j + half;
          const tr = re[l] * cos[k] + im[l] * sin[k];
          const ti = -re[l] * sin[k] + im[l] * cos[k];
          re[l] = re[j] - tr;
          im[l] = im[j] - ti;
          re[j] += tr;
          im[j] += ti;
        }
      }
    }
  };
}

function createSpectrum(mono, sampleRate) {
  const n = FFT_SIZE;
  const bins = n / 2;
  const fft = createFft(n);
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  const prev = new Float32Array(bins);
  const out = new Uint8Array(bins);

  const win = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    win[i] = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / n) + 0.08 * Math.cos((4 * Math.PI * i) / n);
  }

  return function spectrumAt(timeSec) {
    const end = Math.floor(timeSec * sampleRate);
    const start = end - n;
    for (let i = 0; i < n; i++) {
      const idx = start + i;
      const v = idx >= 0 && idx < mono.length ? mono[idx] : 0;
      re[i] = v * win[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < bins; k++) {
      const mag = Math.hypot(re[k], im[k]) / n;
      prev[k] = SMOOTHING * prev[k] + (1 - SMOOTHING) * mag;
      const db = 20 * Math.log10(prev[k] + 1e-12);
      let b = Math.round(((db - MIN_DB) / (MAX_DB - MIN_DB)) * 255);
      if (b < 0) b = 0;
      if (b > 255) b = 255;
      out[k] = b;
    }
    return out;
  };
}

// ---------- вспомогательное ----------

function throwIfAborted(signal) {
  if (signal && signal.aborted) {
    const err = new Error('Отменено');
    err.name = 'AbortError';
    throw err;
  }
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function seekVideo(el, time) {
  return new Promise((resolve) => {
    if (el.readyState >= 2 && Math.abs(el.currentTime - time) < 0.001) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener('seeked', finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, 2000);
    el.addEventListener('seeked', finish);
    el.currentTime = time;
  });
}

async function renderAudio(buffer, duration, offset, musicVol, extra) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const length = Math.max(1, Math.ceil(duration * SAMPLE_RATE));
  const offline = new OAC(CHANNELS, length, SAMPLE_RATE);
  const limiter = createLimiter(offline);
  limiter.connect(offline.destination);

   const addTrack = (buf, off, vol, withFx) => {
    const src = offline.createBufferSource();
    src.buffer = buf;
    const gain = offline.createGain();
      const fi = Math.min(effects.fadeIn || 0, duration / 2);
    const fo = Math.min(effects.fadeOut || 0, duration / 2);
    gain.gain.setValueAtTime(fi > 0 ? 0 : vol, 0);
    if (fi > 0) gain.gain.linearRampToValueAtTime(vol, fi);
    if (fo > 0) {
      gain.gain.setValueAtTime(vol, duration - fo);
      gain.gain.linearRampToValueAtTime(0, duration);
    }
    let head = src;
    if (withFx) {
      const eq = createEq(offline);
      head.connect(eq.input);
      head = eq.output;
      if (audioFx.echo > 0) {
        const echo = createEcho(offline);
        head.connect(echo.input);
        head = echo.output;
      }
            if (audioFx.lofi > 0) {
        const lofi = createLofi(offline);
        lofi.start();
        head.connect(lofi.input);
        head = lofi.output;
      }
      if (audioFx.modMode > 0) {
        const mod = createMod(offline);
        head.connect(mod.input);
        head = mod.output;
      }
            if (audioFx.filterMode > 0 && audioFx.filter > 0) {
        const filt = createFilter(offline);
        head.connect(filt.input);
        head = filt.output;
      }
            if (audioFx.wide > 0) {
        const wide = createWide(offline);
        head.connect(wide.input);
        head = wide.output;
      }
      if (audioFx.d8 > 0) {
        const spatial = createSpatial(offline);
        head.connect(spatial.input);
        head = spatial.output;
      }
    }
    if (withFx && audioFx.reverb > 0) {
      const room = createReverb(offline, audioFx.reverb);
      head.connect(room.input);
      room.output.connect(gain);
    } else {
      head.connect(gain);
    }
    gain.connect(limiter);
    src.start(0, off, duration);
  };

  addTrack(buffer, offset, musicVol, true);
  if (extra) addTrack(extra.buffer, extra.start, extra.vol);

  const out = await offline.startRendering();
  if (extra) {
    // две дорожки вместе могут «зашкалить», поэтому ограничиваем уровень
    for (let c = 0; c < out.numberOfChannels; c++) {
      const d = out.getChannelData(c);
      for (let i = 0; i < d.length; i++) {
        if (d[i] > 1) d[i] = 1;
        else if (d[i] < -1) d[i] = -1;
      }
    }
  }
  return out;
}
// ---------- экспорт только звука (MP3 / WAV) ----------

let lameLoad = null;

// MP3-кодер lamejs: сначала свой файл, потом CDN.
function loadLame() {
  if (window.lamejs) return Promise.resolve(window.lamejs);
  if (lameLoad) return lameLoad;
  const urls = ['/js/vendor/lame.min.js', 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js'];
  lameLoad = (async () => {
    for (const url of urls) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = url;
          s.onload = resolve;
          s.onerror = () => {
            s.remove();
            reject(new Error('load'));
          };
          document.head.appendChild(s);
        });
        if (window.lamejs) return window.lamejs;
      } catch (e) {}
    }
    lameLoad = null;
    throw new Error('Не удалось загрузить MP3-кодер. Проверьте интернет или положите lame.min.js в /js/vendor/');
  })();
  return lameLoad;
}

function encodeWav(left, right, rate) {
  const n = left.length;
  const buf = new ArrayBuffer(44 + n * 4);
  const v = new DataView(buf);
  const str = (o, s) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 4, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 4, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    v.setInt16(o, l < 0 ? l * 32768 : l * 32767, true);
    v.setInt16(o + 2, r < 0 ? r * 32768 : r * 32767, true);
    o += 4;
  }
  return new Blob([buf], { type: 'audio/wav' });
}

async function encodeMp3(left, right, rate, signal, onProgress) {
  const lame = await loadLame();
  const enc = new lame.Mp3Encoder(2, rate, 192);
  const n = left.length;
  const BLOCK = 1152;
  const toI16 = (src, from, len) => {
    const out = new Int16Array(len);
    for (let i = 0; i < len; i++) {
      const x = Math.max(-1, Math.min(1, src[from + i]));
      out[i] = x < 0 ? x * 32768 : x * 32767;
    }
    return out;
  };
  const parts = [];
  for (let i = 0, k = 0; i < n; i += BLOCK, k++) {
    throwIfAborted(signal);
    const len = Math.min(BLOCK, n - i);
    const out = enc.encodeBuffer(toI16(left, i, len), toI16(right, i, len));
    if (out.length) parts.push(out.slice());
    if (k % 300 === 0) {
      onProgress(i / n);
      await pause(0);
    }
  }
  const tail = enc.flush();
  if (tail.length) parts.push(tail.slice());
  return new Blob(parts, { type: 'audio/mpeg' });
}

// Рисует звук фрагмента [from, from + duration] со всеми эффектами и отдаёт файл.
export async function exportAudio({ buffer, from, duration, musicVol = 1, format, signal, onProgress }) {
  const report = (f, label) => {
    if (onProgress) onProgress(Math.min(1, Math.max(0, f)), label);
  };
  report(0.02, 'Применяю эффекты…');
  const rendered = await renderAudio(buffer, duration, from, musicVol, null);
  throwIfAborted(signal);
  const left = rendered.getChannelData(0);
  const right = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : left;
  if (format === 'wav') {
    report(0.6, 'Пишу WAV…');
    return encodeWav(left, right, SAMPLE_RATE);
  }
  return encodeMp3(left, right, SAMPLE_RATE, signal, (f) => report(0.1 + 0.9 * f, 'Кодирую MP3…'));
}
// ---------- главный экспорт ----------

export async function exportVideo({ buffer, duration, offset = 0, canvas, ctx, support, signal, onProgress, style, musicVol = 1, video = null }) {
  const report = (fraction, label) => {
    if (onProgress) onProgress(Math.min(1, Math.max(0, fraction)), label);
  };

  let fatal = null;
  let videoEncoder = null;
  let audioEncoder = null;

  try {
    // 1. Звук в 48 кГц стерео
    report(0.01, 'Готовлю звук…');
    const rendered = await renderAudio(
      buffer,
      duration,
      offset,
      musicVol,
      video && video.audioBuffer ? { buffer: video.audioBuffer, start: video.start, vol: video.vol } : null
    );
    throwIfAborted(signal);

    const left = rendered.getChannelData(0);
    const right = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : left;
    const totalSamples = rendered.length;

    const mono = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) mono[i] = (left[i] + right[i]) * 0.5;
    const spectrumAt = createSpectrum(mono, SAMPLE_RATE);

    // 2. Контейнер MP4
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: { codec: 'avc', width: VIZ_W, height: VIZ_H, frameRate: FPS },
      audio: { codec: 'aac', numberOfChannels: CHANNELS, sampleRate: SAMPLE_RATE },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset'
    });

    // 3. Кодируем звук
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (e) => { fatal = e; }
    });
    audioEncoder.configure({
      codec: AUDIO_CODEC,
      sampleRate: SAMPLE_RATE,
      numberOfChannels: CHANNELS,
      bitrate: AUDIO_BITRATE
    });

    const AUDIO_CHUNK = 4096;
    for (let off = 0; off < totalSamples; off += AUDIO_CHUNK) {
      throwIfAborted(signal);
      if (fatal) throw fatal;

      const len = Math.min(AUDIO_CHUNK, totalSamples - off);
      const planar = new Float32Array(len * CHANNELS);
      planar.set(left.subarray(off, off + len), 0);
      planar.set(right.subarray(off, off + len), len);

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: SAMPLE_RATE,
        numberOfFrames: len,
        numberOfChannels: CHANNELS,
        timestamp: Math.round((off / SAMPLE_RATE) * 1e6),
        data: planar
      });
      audioEncoder.encode(audioData);
      audioData.close();

      while (audioEncoder.encodeQueueSize > 16) await pause(4);

      if ((off / AUDIO_CHUNK) % 20 === 0) {
        report(0.05 + 0.1 * (off / totalSamples), 'Кодирую звук…');
        await pause(0);
      }
    }
    await audioEncoder.flush();
    if (fatal) throw fatal;

    // 4. Кодируем видео
    videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { fatal = e; }
    });
    videoEncoder.configure({
      codec: support.videoCodec,
      width: VIZ_W,
      height: VIZ_H,
      bitrate: VIDEO_BITRATE,
      framerate: FPS
    });
    if (video && video.el) video.el.pause();
    const bars = new Float32Array(BAR_COUNT);
        resetParticles();
            resetEffects();
    const totalFrames = Math.max(1, Math.floor(duration * FPS));
    const frameDuration = Math.round(1e6 / FPS);

    for (let i = 0; i < totalFrames; i++) {
      throwIfAborted(signal);
      if (fatal) throw fatal;

      const t = i / FPS;
            if (video && video.el) {
        await seekVideo(video.el, Math.min(video.start + t, Math.max(0, video.el.duration - 0.05)));
      }
      spectrumToBars(spectrumAt(t), bars);
      drawLayers(ctx, bars, t, style);
      drawOverlay(ctx, bars, t);
      drawFrameExtras(ctx, t, duration, true);

      const frame = new VideoFrame(canvas, {
        timestamp: Math.round((i * 1e6) / FPS),
        duration: frameDuration
      });
      videoEncoder.encode(frame, { keyFrame: i % KEYFRAME_EVERY === 0 });
      frame.close();

      while (videoEncoder.encodeQueueSize > 6) await pause(4);

      if (i % 4 === 0) {
        report(0.15 + 0.8 * (i / totalFrames), `Рисую кадры: ${i} из ${totalFrames}`);
        await pause(0);
      }
    }
    await videoEncoder.flush();
    if (fatal) throw fatal;

    // 5. Упаковка
    report(0.97, 'Упаковываю MP4…');
    muxer.finalize();
    const blob = new Blob([target.buffer], { type: 'video/mp4' });
    report(1, 'Готово');
    return blob;
  } finally {
    try { if (videoEncoder && videoEncoder.state !== 'closed') videoEncoder.close(); } catch (e) {}
    try { if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close(); } catch (e) {}
  }
}