import { TYPES, makeParticle, fitSize } from '/js/visualizer/particle-types.js';
import { gridIndex, getGridVersion } from '/js/visualizer/beats.js';
import { setCustomColor, setSoftness } from '/js/visualizer/particle-sprites.js';

// Движок частиц. Хранит настройки (particles), пул частиц и рисует кадр.
// Виды частиц лежат в particle-types.js, спрайты и цвета — в particle-sprites.js.
//
// Всё случайное идёт через один генератор со стартовым зерном, а resetParticles()
// возвращает его в начало, поэтому экспорт в MP4 даёт одну и ту же картинку
// при каждом запуске.

export const PARTICLE_TYPES = [
  { id: 'sparks', name: 'Искры', color: 'warm' },
  { id: 'fireflies', name: 'Светлячки', color: 'warm' },
  { id: 'snow', name: 'Снег', color: 'white' },
  { id: 'stars', name: 'Звёзды', color: 'white' },
  { id: 'confetti', name: 'Конфетти', color: 'rainbow' },
  { id: 'rain', name: 'Дождь', color: 'ice' },
  { id: 'petals', name: 'Лепестки', color: 'pink' },
  { id: 'ash', name: 'Пепел', color: 'ash' }
];

export const PARTICLE_COLORS = [
  { id: 'auto', name: 'Как волны' },
  { id: 'white', name: 'Белый' },
  { id: 'warm', name: 'Тёплый' },
  { id: 'ice', name: 'Ледяной' },
  { id: 'pink', name: 'Розовый' },
  { id: 'ash', name: 'Пепельный' },
   { id: 'rainbow', name: 'Радуга' },
  { id: 'custom', name: 'Свой' }
];

export const PARTICLE_DEFAULTS = {
  type: 'none',
  color: 'auto',
  amount: 1,
  size: 1,
  speed: 1,
  react: 1,
  glow: 1,
  depth: 0.6,
  opacity: 1,
  spread: 1,
  soft: 0.5,
  wind: 0,
  customColor: '#ff7ad9',
  confettiShape: 'square',
  confettiFrom: 'corners',
  rays: 4,
  twinkle: 1,
  sparkFrom: 'bottom',
  tail: 1,
  rainTilt: 0,
  rainLen: 1,
  splash: true,
  chaos: 1,
  lift: 1,
  swirl: 1,
  lifetime: 1,
  flicker: 1,
  flare: 1,
  blinkRate: 1,
  blinkDepth: 0.75,
  sync: 0,
  burst: 0,
  swarm: 0,
  trail: 0,
  fireArea: 'all',
  snowShape: 'dot',
  snowSpin: 1,
  snowSway: 1,
  snowGust: 1,
  snowFall: 1,
  snowBokeh: 0,
  snowSparkle: 0,
  starThick: 1,
  starSpin: 1,
  starBlink: 1,
  starRise: 1,
  starFlash: 1,
  starMeteor: 0,
  starArea: 'all',
  confettiGravity: 1,
  confettiFlutter: 1,
  confettiSpin: 1,
  confettiBurst: 1,
  confettiRange: 1,
  confettiRain: 1,
  confettiShine: 0
};
export const particles = { ...PARTICLE_DEFAULTS };

// Стартовый «красивый» вид для каждого типа частиц.
// Что здесь не указано, берётся из PARTICLE_DEFAULTS.
export const TYPE_PRESETS = {
  fireflies: {
    amount: 1.3,
    size: 1.2,
    speed: 0.8,
    react: 1,
    glow: 1.2,
    depth: 0.7,
    opacity: 0.95,
    wind: 0,
    blinkRate: 0.7,
    blinkDepth: 0.85,
    sync: 0.15,
    burst: 0.5,
    swarm: 0.2,
    trail: 1,
    chaos: 1,
    fireArea: 'all'
  },
  snow: {
    amount: 1.4,
    size: 1.3,
    speed: 0.85,
    react: 0.8,
    glow: 0.9,
    depth: 0.8,
    opacity: 0.95,
    spread: 1.3,
    soft: 0.6,
    wind: 0.1,
    snowShape: 'mix',
    snowSpin: 0.8,
    snowSway: 1.1,
    snowGust: 0.7,
    snowFall: 1,
    snowBokeh: 0.5,
    snowSparkle: 0.5
  },
  stars: {
    amount: 1.4,
    size: 1,
    speed: 0.7,
    react: 1,
    glow: 1.1,
    depth: 0.8,
    opacity: 0.95,
    spread: 1.4,
    wind: 0,
    rays: 4,
    twinkle: 1.2,
    starThick: 0.9,
    starSpin: 0.5,
    starBlink: 0.8,
    starRise: 0.35,
    starFlash: 1,
    starMeteor: 0.5,
    starArea: 'all'
  },
  confetti: {
    amount: 1.3,
    size: 1.1,
    speed: 1,
    react: 1.1,
    depth: 0.7,
    opacity: 1,
    spread: 1.2,
    wind: 0,
    confettiShape: 'mix',
    confettiFrom: 'corners',
    confettiGravity: 0.8,
    confettiFlutter: 1.3,
    confettiSpin: 1,
    confettiBurst: 1.2,
    confettiRange: 1.1,
    confettiRain: 0.6,
    confettiShine: 0.7
  }
};
// Включает вид частиц сразу с его пресетом. Свой цвет пользователя не стирается.
export function applyTypePreset(type) {
  const keep = particles.customColor;
  Object.assign(particles, PARTICLE_DEFAULTS, TYPE_PRESETS[type] || {}, { type, customColor: keep });
  particles.color = typeColor(type);
}

// Значение ползунка по умолчанию для выбранного вида (нужно для двойного клика).
export function typeDefault(key) {
  const p = TYPE_PRESETS[particles.type];
  return p && key in p ? p[key] : PARTICLE_DEFAULTS[key];
}
export function typeColor(id) {
  const t = PARTICLE_TYPES.find((x) => x.id === id);
  return t ? t.color : 'auto';
}

export function setParticles(patch) {
  Object.assign(particles, patch);
}

// keepType = true: сбросить только ползунки и цвет, а выбранный вид оставить.
export function resetParticleSettings(keepType) {
  if (keepType && particles.type !== 'none') {
    applyTypePreset(particles.type);
    return;
  }
  Object.assign(particles, PARTICLE_DEFAULTS, { type: 'none' });
}

// ---------- внутреннее состояние ----------

const MAX_DT = 0.05;
const BASS_BARS = 8;

let seed = 0x9e3779b9;

function rnd() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const au = { energy: 0, bass: 0, beat: 0 };

const state = {
  type: null,

  pool: [],
  active: 0,
  cursor: 0,
  st: { acc: 0 },
  last: null,
  slow: 0,
  lastBeat: -10,
  lastSize: 1,
  lastSpread: 1,
  gridIdx: null,
  gridVer: -1
};

const env = {
  ctx: null,
  rnd,
  W: 720,
  H: 1280,
  S: 1,
  dt: 0,
  t: 0,
  set: particles,
  au,
  st: state.st
};

export function resetParticles() {
  seed = 0x9e3779b9;
  state.type = null;
  state.def = null;
  state.pool = [];
  state.active = 0;
  state.cursor = 0;
  state.st.acc = 0;
  state.last = null;
  state.slow = 0;
  state.lastBeat = -10;
  state.gridIdx = null;
  au.energy = 0;
  au.bass = 0;
  au.beat = 0;
}

function avg(bars, from, to) {
  const end = Math.min(to, bars.length);
  if (end <= from) return 0;
  let s = 0;
  for (let i = from; i < end; i++) s += bars[i];
  return s / (end - from);
}

function followAudio(bars, t, dt, first) {
  const rawBass = avg(bars, 0, BASS_BARS);
  const rawEnergy = avg(bars, 0, bars.length);

  if (first) {
    au.bass = rawBass;
    au.energy = rawEnergy;
    au.beat = 0;
    state.slow = rawBass;
    return;
  }

  const follow = (cur, target) => cur + (target - cur) * (1 - Math.exp(-dt * (target > cur ? 18 : 5)));
  au.bass = follow(au.bass, rawBass);
  au.energy = follow(au.energy, rawEnergy);

  state.slow += (rawBass - state.slow) * (1 - Math.exp(-dt * 1.6));
  au.beat = 0;
  const gi = gridIndex(t);
  if (gi !== null) {
    // есть сетка ударов (известен BPM): бьём строго по ней
    if (state.gridVer !== getGridVersion()) {
      state.gridVer = getGridVersion();
      state.gridIdx = null;
    }
    if (state.gridIdx !== null && gi > state.gridIdx && gi >= 0) {
      au.beat = Math.min(1, 0.45 + Math.max(0, rawBass - state.slow) * 2.5 + rawBass * 0.25);
      state.lastBeat = t;
    }
    state.gridIdx = gi;
  } else {
    state.gridIdx = null;
    if (rawBass > 0.2 && rawBass > state.slow * 1.22 + 0.05 && t - state.lastBeat > 0.2) {
      au.beat = Math.min(1, 0.35 + (rawBass - state.slow) * 2.5);
      state.lastBeat = t;
    }
  }
}

function prepare(def) {
  const type = particles.type;
  const limit = Math.max(1, Math.round(def.base * particles.amount));

  if (state.type !== type) {
    state.type = type;

    state.pool = [];
    const capacity = Math.ceil(def.base * 2) + 8;
    for (let i = 0; i < capacity; i++) state.pool.push(makeParticle());
    state.active = 0;
    state.cursor = 0;
    state.st.acc = 0;
    state.lastSize = particles.size;
    state.lastSpread = particles.spread;
  }
  // «Размер» и «Разброс размеров» меняют уже живые частицы сразу, а не только новорождённых.
  if (particles.size !== state.lastSize || particles.spread !== state.lastSpread) {
    for (let i = 0; i < state.pool.length; i++) {
      const p = state.pool[i];
      if (p.alive) p.size = fitSize(p.sa, p.sb, p.sv, particles.spread) * particles.size * env.S;
    }
    state.lastSize = particles.size;
    state.lastSpread = particles.spread;
  }

  const pool = state.pool;
  if (limit < state.active || !def.ambient) {
    for (let i = limit; i < pool.length; i++) pool[i].alive = false;
  }
  if (def.ambient && limit > state.active) {
    for (let i = state.active; i < limit; i++) def.spawn(pool[i], env, true);
  }
  state.active = limit;
  return limit;
}

// ---------- главная функция кадра ----------

export function drawParticles(ctx, bars, t) {
  if (particles.type === 'none' || !TYPES[particles.type]) {
    state.type = null;
    state.last = null;
    return;
  }

  const def = TYPES[particles.type];
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  env.ctx = ctx;
  env.W = W;
  env.H = H;
  env.S = Math.min(W, H) / 720;
  env.t = t;
  setCustomColor(particles.customColor);
  setSoftness(particles.soft);
  // Перемотка назад — начинаем заново, чтобы картинка не зависела от истории.
  if (state.last !== null && t < state.last - 1e-6) resetParticles();

  const first = state.last === null;
  let dt = first ? 0 : t - state.last;
  if (dt > MAX_DT) dt = MAX_DT;
  state.last = t;
  env.dt = dt;

  const limit = prepare(def);
  const pool = state.pool;

  if (dt > 0 || first) followAudio(bars, t, dt, first);

  if (dt > 0) {
    if (au.beat > 0 && particles.react > 0 && def.beat) {
      for (let i = 0; i < limit; i++) {
        if (pool[i].alive) def.beat(pool[i], env);
      }
    }

    if (!def.ambient && def.emit) {
      const acquire = () => {
        for (let n = 0; n < limit; n++) {
          const i = (state.cursor + n) % limit;
          if (!pool[i].alive) {
            state.cursor = (i + 1) % limit;
            return pool[i];
          }
        }
        return null;
      };
      def.emit(env, acquire);
    }

    for (let i = 0; i < limit; i++) {
      if (pool[i].alive) def.step(pool[i], env);
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = def.additive ? 'lighter' : 'source-over';
  for (let i = 0; i < limit; i++) {
    if (pool[i].alive) def.draw(pool[i], env);
  }
  ctx.restore();
}