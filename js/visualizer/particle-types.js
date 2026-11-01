import { KIND, getSprite, particleColor } from '/js/visualizer/particle-sprites.js';

// Каждый вид частиц — объект с одним и тем же набором методов:
//   base      сколько частиц в пуле при «Количество ×1»
//   ambient   true: частицы живут всегда и сами возвращаются на экран;
//             false: частицы рождаются через emit() и умирают
//   additive  true: рисуем режимом 'lighter' (свет складывается)
//   spawn()   задать частице начальные значения
//   emit()    (только ambient: false) решает, сколько частиц родить за кадр
//   beat()    (необязательно) реакция каждой живой частицы на удар
//   step()    двигаем частицу на env.dt секунд
//   draw()    рисуем частицу в env.ctx
//
// env — общий «контекст кадра»: { ctx, rnd, W, H, S, dt, t, set, au, st }.
// Ничего случайного, кроме env.rnd(), здесь не используется, поэтому
// экспорт в MP4 даёт ту же картинку при каждом запуске.

const TAU = Math.PI * 2;
const rgb = [0, 0, 0];

export function makeParticle() {
  return {
    alive: false,
    x: 0, y: 0, vx: 0, vy: 0,
    age: 0, life: 1,
    size: 1, z: 0,
    hue: 0, mix: 0,
    ph: 0, rate: 1, sp: 1, amp: 0, freq: 1,
    rot: 0, vr: 0,
    flash: 0, mode: 0,
    sa: 1, sb: 0, sv: 0.5
  };
}

// z: 0 — далеко, 1 — близко. При «Глубина» 0 все частицы одинаковые.
function depthK(set, z) {
  return 1 - set.depth * (1 - z) * 0.65;
}
// Размер частицы лежит в диапазоне a..a+b. «Разброс размеров» сжимает его
// к середине (0) или растягивает (2); при 1 всё как раньше.
export function fitSize(a, b, r, spread) {
  const v = a + b * (0.5 + (r - 0.5) * spread);
  return Math.max(a * 0.25, v);
}

function spawnSize(p, env, a, b) {
  const r = env.rnd();
  p.sa = a;
  p.sb = b;
  p.sv = r;
  return fitSize(a, b, r, env.set.spread) * env.set.size * env.S;
}

// Горизонтальный ветер, пикселей в секунду. Ближние частицы летят сильнее.
function windX(set, S, k) {
  return set.wind * 170 * S * (0.4 + 0.6 * k);
}

// Форма конфетти. Холст уже повёрнут и сдвинут в центр частицы.
function confettiShape(ctx, shape, w, h) {
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.35, Math.max(0.4, h * 0.5), 0, 0, TAU);
    ctx.fill();
  } else if (shape === 'star') {
    const rx = w * 0.7;
    const ry = Math.max(0.5, h * 1.4);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? 0.45 : 1;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      if (i === 0) ctx.moveTo(Math.cos(a) * rx * rr, Math.sin(a) * ry * rr);
      else ctx.lineTo(Math.cos(a) * rx * rr, Math.sin(a) * ry * rr);
    }
    ctx.closePath();
    ctx.fill();
  } else if (shape === 'strip') {
    ctx.fillRect(-w * 0.8, -h * 0.2, w * 1.6, Math.max(0.5, h * 0.4));
  } else if (shape === 'heart') {
    const hw = w * 0.9;
    const hh = Math.max(1, h * 1.5);
    ctx.beginPath();
    ctx.moveTo(0, hh * 0.5);
    ctx.bezierCurveTo(-hw * 0.75, hh * 0.05, -hw * 0.45, -hh * 0.62, 0, -hh * 0.2);
    ctx.bezierCurveTo(hw * 0.45, -hh * 0.62, hw * 0.75, hh * 0.05, 0, hh * 0.5);
    ctx.fill();
  } else {
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }
}
function rgbStr(c, lift) {
  const l = lift || 0;
  return 'rgb(' +
    Math.round(c[0] + (255 - c[0]) * l) + ',' +
    Math.round(c[1] + (255 - c[1]) * l) + ',' +
    Math.round(c[2] + (255 - c[2]) * l) + ')';
}

function blob(env, kind, x, y, r, alpha, c) {
  if (alpha <= 0.004 || r <= 0.3) return;
  if (x < -r || y < -r || x > env.W + r || y > env.H + r) return;
  const ctx = env.ctx;
  ctx.globalAlpha = alpha > 1 ? 1 : alpha;
  ctx.drawImage(getSprite(kind, c[0], c[1], c[2]), x - r, y - r, r * 2, r * 2);
}

// Блик-крестик: четыре лучика, два длинных и два короче. Только строит путь,
// заливает вызывающий код.
function flareCross(ctx, x, y, L, rot) {
  const q = L * 0.1;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(rot) * L, y + Math.sin(rot) * L);
  for (let i = 0; i < 4; i++) {
    const mid = rot + (i + 0.5) * (Math.PI / 2);
    const next = rot + (i + 1) * (Math.PI / 2);
    const len = (i + 1) % 2 === 0 ? L : L * 0.6;
    ctx.quadraticCurveTo(
      x + Math.cos(mid) * q,
      y + Math.sin(mid) * q,
      x + Math.cos(next) * len,
      y + Math.sin(next) * len
    );
  }
}

// ---------- 1. искры ----------
// Источник, подъём, завихрение, мерцание и блики настраиваются в панели;
// на каждый удар вылетает залп.

const sparks = {
  base: 240,
  ambient: false,
  additive: true,

  spawn(p, env, power) {
    const { rnd, W, H, S, set } = env;
    p.alive = true;
    p.age = 0;
        p.life = (1.5 + rnd() * 2.1) * set.lifetime;
    p.z = rnd();
    p.hue = rnd();
    p.mix = rnd();
    p.ph = rnd() * TAU;
        p.size = spawnSize(p, env, 1.3, 2.4);
    if (set.sparkFrom === 'fountain') {
      // узкая струя из низа по центру, высоко вверх
      p.x = W * 0.5 + (rnd() - 0.5) * 30 * S;
      p.y = H + 6 * S;
      p.vx = (rnd() - 0.5) * 170 * S * (1 + power * 0.6);
      p.vy = -(300 + rnd() * 420) * S * (1 + power * 0.9);
    } else if (set.sparkFrom === 'top') {
      // сыплются сверху вниз
      p.x = rnd() * W;
      p.y = -6 * S;
      p.vx = (rnd() - 0.5) * 90 * S;
      p.vy = (90 + rnd() * 200) * S * (1 + power * 0.8);
    } else if (set.sparkFrom === 'center') {
      // из центра кадра во все стороны
      const ang = rnd() * TAU;
      const v = (90 + rnd() * 260) * S * (1 + power * 1.1);
      p.x = W * 0.5 + (rnd() - 0.5) * 24 * S;
      p.y = H * 0.5 + (rnd() - 0.5) * 24 * S;
      p.vx = Math.cos(ang) * v;
      p.vy = Math.sin(ang) * v;
    } else if (set.sparkFrom === 'sides') {
      // с левого и правого края внутрь кадра
      const dir = rnd() < 0.5 ? 1 : -1;
      p.x = dir > 0 ? -6 * S : W + 6 * S;
      p.y = H * (0.15 + rnd() * 0.85);
      p.vx = dir * (120 + rnd() * 230) * S * (1 + power * 1.1);
      p.vy = -rnd() * 120 * S;
    } else {
      p.x = power > 0 ? W * (0.5 + (rnd() - 0.5) * 0.92) : rnd() * W;
      p.y = H + 6 * S;
      p.vx = (rnd() - 0.5) * 110 * S;
      p.vy = -(120 + rnd() * 230) * S * (1 + power * 1.1);
    }
  },

  emit(env, acquire) {
    const { dt, set, au, st } = env;
    st.acc += (12 + au.energy * 80 * set.react) * set.amount * dt;
    while (st.acc >= 1) {
      st.acc -= 1;
      const p = acquire();
      if (!p) { st.acc = 0; break; }
      this.spawn(p, env, 0);
    }
    if (au.beat > 0 && set.react > 0) {
      const n = Math.round((16 + 26 * au.beat) * set.amount * set.react);
      for (let i = 0; i < n; i++) {
        const p = acquire();
        if (!p) break;
        this.spawn(p, env, 0.5 + au.beat * 0.8);
      }
    }
  },

  step(p, env) {
    const { dt, t, set, S } = env;
    p.age += dt;
    if (p.age >= p.life) {
      p.alive = false;
      return;
    }
       p.vx += Math.sin(t * 2.2 + p.ph + p.y * 0.008) * 70 * set.swirl * S * dt;
          p.vy -= 28 * S * set.lift * dt;
    p.x += windX(set, S, depthK(set, p.z)) * set.speed * dt;
    const drag = Math.exp(-0.55 * dt);
    p.vx *= drag;
    p.vy *= drag;
    p.x += p.vx * set.speed * dt;
    p.y += p.vy * set.speed * dt;
  },

  draw(p, env) {
    const { ctx, set, au, t } = env;
    const life = p.age / p.life;
    const k = depthK(set, p.z);
    const fl = 0.28 * set.flicker;
    const flick = Math.max(0, 1 - fl + fl * Math.sin(t * 31 + p.ph * 9));
    const a = Math.pow(1 - life, 1.35) * Math.min(1, p.age * 7) * flick * set.opacity;
    if (a < 0.01) return;
    const sz = p.size * k * (1 - life * 0.45) * (1 + au.bass * 0.35 * set.react);
    particleColor(set.color, p.hue, p.mix, t, rgb);

    // короткий хвост по направлению движения
    ctx.globalAlpha = Math.min(1, a * 0.75);
    ctx.strokeStyle = rgbStr(rgb, 0.2);
    ctx.lineWidth = Math.max(0.6, sz * 0.9);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
       ctx.lineTo(p.x - p.vx * 0.05 * set.tail * set.speed, p.y - p.vy * 0.05 * set.tail * set.speed);
    ctx.stroke();

    blob(env, KIND.glow, p.x, p.y, sz * 4.6, a * set.glow, rgb);

    // блики: примерно у каждой третьей искры вспыхивает крестик
    if (set.flare > 0.02 && p.ph / TAU > 0.7) {
      const pulse = Math.max(0, Math.sin(t * 7 + p.ph * 5));
      const fa = a * Math.min(1, set.flare) * (0.25 + 0.75 * pulse);
      if (fa > 0.02) {
        const L = sz * 6 * (0.6 + 0.5 * set.flare) * (0.7 + 0.6 * pulse) * (1 + au.bass * 0.6 * set.react);
        const rot = p.ph + t * 0.4;
        ctx.globalAlpha = Math.min(1, fa);
        ctx.fillStyle = rgbStr(rgb, 0.55);
        flareCross(ctx, p.x, p.y, L, rot);
        ctx.fill();
        ctx.globalAlpha = Math.min(1, fa * 0.9);
        ctx.fillStyle = '#ffffff';
        flareCross(ctx, p.x, p.y, L * 0.45, rot + Math.PI / 4);
        ctx.fill();
      }
    }
  }
};
// Зона, где живут светлячки: «Везде / Внизу / Вверху / В центре».
function fireZone(set, W, H) {
  if (set.fireArea === 'bottom') return { x0: 0, x1: W, y0: H * 0.6, y1: H };
  if (set.fireArea === 'top') return { x0: 0, x1: W, y0: 0, y1: H * 0.4 };
  if (set.fireArea === 'center') return { x0: W * 0.2, x1: W * 0.8, y0: H * 0.3, y1: H * 0.7 };
  return { x0: 0, x1: W, y0: 0, y1: H };
}
// ---------- 2. светлячки ----------
// Плывут по плавному «полю ветра», мигают, на удар часть вспыхивает.

const fireflies = {
  base: 80,
  ambient: true,
  additive: true,

  spawn(p, env) {
    const { rnd, W, H } = env;
    p.alive = true;
    const z = fireZone(env.set, W, H);
    p.x = z.x0 + rnd() * (z.x1 - z.x0);
    p.y = z.y0 + rnd() * (z.y1 - z.y0);
    p.vx = 0;
    p.vy = 0;
    p.z = rnd();
    p.hue = rnd();
    p.mix = rnd();
    p.ph = rnd() * TAU;
    p.rate = 0.5 + rnd() * 1.4;
    p.sp = 14 + rnd() * 28;
        p.size = spawnSize(p, env, 1.8, 2.6);
    p.flash = 0;
  },

  beat(p, env) {
    if (env.rnd() < 0.2 + 0.35 * env.set.react * env.au.beat) p.flash = 1;
    // Разлёт: импульс от центра зоны, потом рой сам успокаивается
    if (env.set.burst > 0) {
      const z = fireZone(env.set, env.W, env.H);
      const dx = p.x - (z.x0 + z.x1) / 2;
      const dy = p.y - (z.y0 + z.y1) / 2;
      const d = Math.hypot(dx, dy) || 1;
      const v = 260 * env.S * env.set.burst * env.au.beat * (0.5 + 0.5 * env.rnd());
      p.vx += (dx / d) * v;
      p.vy += (dy / d) * v;
    }
  },

  step(p, env) {
    const { dt, t, set, S, au, W, H } = env;
       const field = Math.sin(p.x * 0.0045 + t * 0.35 + p.ph) * 1.6 +
      Math.cos(p.y * 0.004 - t * 0.27 + p.ph * 1.7) * 1.6;
    // «Хаотичность»: 0 — ровный полёт, каждый в своём направлении; 2 — рывки и петли
    const ch = set.chaos;
    const ang = field * ch + p.ph * (1 - Math.min(1, ch)) +
      Math.sin(t * (1.5 + p.rate * 2) + p.ph * 3) * Math.max(0, ch - 1) * 1.2;
    const v = p.sp * S * set.speed * (0.6 + 0.6 * depthK(set, p.z)) * (1 + au.energy * set.react * 1.4);
    const z = fireZone(set, W, H);
    const k = 1 - Math.exp(-dt * 1.5);
    let tx = Math.cos(ang) * v;
    let ty = Math.sin(ang) * v - 6 * S;
    // Рой: плюс стягивает к центру зоны, минус разгоняет к краям
    if (set.swarm !== 0) {
      const dx = (z.x0 + z.x1) / 2 - p.x;
      const dy = (z.y0 + z.y1) / 2 - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = set.swarm > 0 ? Math.min(1, d / (180 * S)) : 1;
      const pull = set.swarm * 90 * S * set.speed * f;
      tx += (dx / d) * pull;
      ty += (dy / d) * pull;
    }
    p.vx += (tx - p.vx) * k;
    p.vy += (ty - p.vy) * k;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x += windX(set, S, depthK(set, p.z)) * set.speed * dt;
    p.flash *= Math.exp(-dt * 3.2);

    if (set.fireArea === 'all') {
      const m = 40 * S;
      if (p.x < -m) p.x += W + 2 * m;
      else if (p.x > W + m) p.x -= W + 2 * m;
      if (p.y < -m) p.y += H + 2 * m;
      else if (p.y > H + m) p.y -= H + 2 * m;
    } else {
      // Не выпускаем из зоны: мягко возвращаем обратно
      const push = 1 - Math.exp(-dt * 2);
      if (p.x < z.x0) p.x += (z.x0 - p.x) * push;
      else if (p.x > z.x1) p.x += (z.x1 - p.x) * push;
      if (p.y < z.y0) p.y += (z.y0 - p.y) * push;
      else if (p.y > z.y1) p.y += (z.y1 - p.y) * push;
    }
  },
  draw(p, env) {
    const { ctx, set, au, t } = env;
    const k = depthK(set, p.z);
    const sy = set.sync;
    // Синхронность 100%: у всех одна частота и одна фаза
    const rate = (1.2 + p.rate + (1.2 - p.rate) * sy) * set.blinkRate;
    const pulse = 0.5 + 0.5 * Math.sin(t * rate + p.ph * (1 - sy));
    const lo = 1 - set.blinkDepth;
    const a = Math.min(1, ((lo + (1 - lo) * pulse * pulse) * (0.55 + 0.45 * k) + p.flash * 0.9) * set.opacity);
    if (a < 0.01) return;
    const sz = p.size * k * (1 + 0.35 * pulse + p.flash * 1.1 + au.bass * 0.4 * set.react);
    particleColor(set.color, p.hue, p.mix, t, rgb);

    // Шлейф: тонкая линия против направления полёта
    if (set.trail > 0.02) {
      ctx.globalAlpha = Math.min(1, a * 0.5);
      ctx.strokeStyle = rgbStr(rgb, 0.3);
      ctx.lineWidth = Math.max(0.6, sz * 0.5);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.6 * set.trail, p.y - p.vy * 0.6 * set.trail);
      ctx.stroke();
    }

    blob(env, KIND.glow, p.x, p.y, sz * 4.2, a * set.glow, rgb);
    // ближние светлячки получают крупное размытое боке
    if (set.depth > 0.15 && p.z > 0.8) {
      blob(env, KIND.bokeh, p.x, p.y, sz * 8, a * 0.35 * set.glow, rgb);
    }
  }
};

// ---------- 3. снег ----------
// Падает, покачивается; бас раскачивает ветер, ближние хлопья — боке.

const snow = {
  base: 170,
  ambient: true,
  additive: false,

  spawn(p, env, fresh) {
    const { rnd, W, H, S } = env;
    p.alive = true;
    p.x = rnd() * W;
    p.y = fresh ? rnd() * H : (env.set.snowFall < 0 ? H + (8 + rnd() * 40) * S : -(8 + rnd() * 40) * S);
    p.z = rnd();
    p.hue = rnd();
    p.mix = rnd();
    p.ph = rnd() * TAU;
        p.size = spawnSize(p, env, 1.1, 2.6);
    p.sp = 26 + rnd() * 52;
    p.amp = 8 + rnd() * 20;
    p.freq = 0.5 + rnd() * 1.1;
        p.rot = rnd() * TAU;
    p.vr = (rnd() - 0.5) * 1.6;
    p.rate = 1 + rnd() * 2;
  },

  step(p, env) {
    const { dt, t, set, S, au, W, H } = env;
    const k = depthK(set, p.z);
    const wind = (au.bass * set.react * set.snowGust * 60 + Math.sin(t * 0.35 + p.ph * 0.2) * 12) * S;
    const sway = Math.sin(t * p.freq + p.ph) * p.amp * S * set.snowSway;
    p.rot += p.vr * set.snowSpin * set.speed * dt;
    p.x += windX(set, S, k) * set.speed * dt;
        p.x += (sway * 0.5 + wind * (0.35 + 0.65 * k)) * set.speed * dt;
    p.y += p.sp * S * (0.45 + 0.75 * k) * (1 + au.energy * set.react * 1.3) * set.snowFall * set.speed * dt;
    if (set.snowFall >= 0 ? p.y > H + 16 * S : p.y < -16 * S) this.spawn(p, env, false);
    const m = 20 * S;
    if (p.x < -m) p.x += W + 2 * m;
    else if (p.x > W + m) p.x -= W + 2 * m;
  },

  draw(p, env) {
    const { ctx, set, t } = env;
    const k = depthK(set, p.z);
    const r = p.size * k;
    particleColor(set.color, p.hue, p.mix, t, rgb);

    // Боке: крупные размытые круги у ближних хлопьев
    if (set.snowBokeh > 0.02 && p.z > 0.7) {
      blob(env, KIND.bokeh, p.x, p.y, r * 7, 0.3 * set.snowBokeh * set.opacity, rgb);
    }

    // В режиме «Микс» снежинками становятся только ближние хлопья
    const flake = set.snowShape === 'flake' || (set.snowShape === 'mix' && p.z > 0.55);
    if (flake) {
      const L = r * 3.2;
      const c0 = Math.cos(p.rot);
      const s0 = Math.sin(p.rot);
      ctx.globalAlpha = Math.min(1, (0.45 + 0.5 * k) * set.opacity);
      ctx.strokeStyle = rgbStr(rgb, 0.15);
      ctx.lineWidth = Math.max(0.6, r * 0.28);
      ctx.lineCap = 'round';
      ctx.setTransform(c0, s0, -s0, c0, p.x, p.y);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const bx = Math.cos(a) * L * 0.55;
        const by = Math.sin(a) * L * 0.55;
        const bl = L * 0.28;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a + 0.8) * bl, by + Math.sin(a + 0.8) * bl);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a - 0.8) * bl, by + Math.sin(a - 0.8) * bl);
      }
      ctx.stroke();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      blob(env, KIND.dot, p.x, p.y, r * 1.5, (0.35 + 0.55 * k) * set.opacity, rgb);
    }
    if (set.glow > 0.05) {
      blob(env, KIND.glow, p.x, p.y, r * 3.4, 0.14 * set.glow * set.opacity, rgb);
    }

    // Блеск: примерно у каждого третьего хлопья вспыхивает крестик
    if (set.snowSparkle > 0.02 && p.ph / TAU > 0.6) {
      const pulse = Math.max(0, Math.sin(t * (2 + p.rate * 2) + p.ph * 5));
      const fa = Math.min(1, set.snowSparkle) * pulse * (0.4 + 0.6 * k) * set.opacity;
      if (fa > 0.03) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = fa;
        ctx.fillStyle = '#ffffff';
        flareCross(ctx, p.x, p.y, r * 5 * (0.6 + 0.6 * pulse), p.rot);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }
};
// Зона, где живут звёзды: «Везде / Вверху / В центре».
function starZone(set, W, H) {
  if (set.starArea === 'top') return { x0: 0, x1: W, y0: 0, y1: H * 0.45 };
  if (set.starArea === 'center') return { x0: W * 0.15, x1: W * 0.85, y0: H * 0.25, y1: H * 0.75 };
  return { x0: 0, x1: W, y0: 0, y1: H };
}

// Падающая звезда: обычная звезда на время превращается в метеор.
function starMeteor(p, env) {
  const { rnd, W, S, set } = env;
  const z = starZone(set, W, env.H);
  const ang = (20 + rnd() * 25) * Math.PI / 180;
  const dir = rnd() < 0.5 ? 1 : -1;
  const v = (900 + rnd() * 500) * S;
  p.mode = 1;
  p.age = 0;
  p.life = 1.1;
  p.flash = 0;
  p.vx = Math.cos(ang) * v * dir;
  p.vy = Math.sin(ang) * v;
  p.x = dir > 0 ? rnd() * W * 0.5 : W * (0.5 + rnd() * 0.5);
  p.y = z.y0 + rnd() * (z.y1 - z.y0) * 0.5 - 20 * S;
}
// ---------- 4. звёзды ----------
// Четырёхлучевые звёздочки медленно поднимаются, мерцают, на удар вспыхивают.

const stars = {
  base: 70,
  ambient: true,
  additive: true,

  spawn(p, env, fresh) {
    const { rnd, W, H, S } = env;
    p.alive = true;
    const z = starZone(env.set, W, H);
    p.mode = 0;
    p.x = z.x0 + rnd() * (z.x1 - z.x0);
    p.y = fresh ? z.y0 + rnd() * (z.y1 - z.y0) : (env.set.starRise < 0 ? z.y0 - 24 * S : z.y1 + 24 * S);
    p.z = rnd();
    p.hue = rnd();
    p.mix = rnd();
    p.ph = rnd() * TAU;
    p.freq = 0.8 + rnd() * 2.2;
    p.sp = 8 + rnd() * 20;
        p.size = spawnSize(p, env, 3.2, 6.5);
    p.rot = rnd() * TAU;
    p.vr = (rnd() - 0.5) * 0.7;
    p.flash = 0;
  },

  beat(p, env) {
    if (p.mode === 1) return;
    const set = env.set;
    // Падающая звезда: не чаще раза в 0.8 с
    if (set.starMeteor > 0 && env.rnd() < 0.03 * set.starMeteor) {
      if (env.t < (env.st.met || -10)) env.st.met = -10;
      if (env.t - (env.st.met || -10) > 0.8) {
        env.st.met = env.t;
        starMeteor(p, env);
        return;
      }
    }
    if (env.rnd() < Math.min(1, (0.18 + 0.4 * set.react * env.au.beat) * set.starFlash)) {
      p.flash = Math.min(1.6, 0.5 + 0.5 * set.starFlash);
    }
  },

  step(p, env) {
    const { dt, t, set, S, au, W, H } = env;
    if (p.mode === 1) {
      p.age += dt;
      p.x += p.vx * set.speed * dt;
      p.y += p.vy * set.speed * dt;
      if (p.age >= p.life || p.x < -80 * S || p.x > W + 80 * S || p.y > H + 80 * S) this.spawn(p, env, false);
      return;
    }
    const z = starZone(set, W, H);
    p.y -= p.sp * S * (0.5 + 0.7 * depthK(set, p.z)) * (1 + au.energy * set.react * 2.2) * set.starRise * set.speed * dt;
    p.x += (Math.sin(t * 0.3 + p.ph) * 7 * S + windX(set, S, depthK(set, p.z))) * set.speed * dt;
    p.rot += p.vr * set.starSpin * set.speed * dt;
    p.flash *= Math.exp(-dt * 2.6);
    if (set.starRise >= 0 ? p.y < z.y0 - 30 * S : p.y > z.y1 + 30 * S) {
      this.spawn(p, env, false);
    } else if (set.starArea !== 'all' && (p.y > z.y1 + 60 * S || p.y < z.y0 - 60 * S || p.x < z.x0 - 60 * S || p.x > z.x1 + 60 * S)) {
      // сменили зону: звезда вне неё возвращается внутрь
      this.spawn(p, env, true);
    }
  },

  draw(p, env) {
    const { ctx, set, au, t } = env;
    const k = depthK(set, p.z);
    // Падающая звезда рисуется хвостом, а не лучами
    if (p.mode === 1) {
      const f = p.age / p.life;
      const ma = Math.min(1, p.age * 10) * Math.pow(Math.max(0, 1 - f), 0.6) * set.opacity;
      if (ma < 0.01) return;
      particleColor(set.color, p.hue, p.mix, t, rgb);
      const tx = p.x - p.vx * 0.18;
      const ty = p.y - p.vy * 0.18;
      const c = Math.round(rgb[0]) + ',' + Math.round(rgb[1]) + ',' + Math.round(rgb[2]);
      const gr = ctx.createLinearGradient(p.x, p.y, tx, ty);
      gr.addColorStop(0, 'rgba(255,255,255,' + ma + ')');
      gr.addColorStop(0.25, 'rgba(' + c + ',' + ma * 0.6 + ')');
      gr.addColorStop(1, 'rgba(' + c + ',0)');
      ctx.globalAlpha = 1;
      ctx.strokeStyle = gr;
      ctx.lineWidth = Math.max(1, p.size * 0.45);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      blob(env, KIND.glow, p.x, p.y, p.size * 3.2, ma * set.glow, rgb);
      return;
    }
    const tw = Math.min(1, Math.max(0, 0.5 + 0.5 * Math.sin(t * p.freq * set.starBlink + p.ph) * set.twinkle));
    // У границы зоны звёзды плавно гаснут
    let edge = 1;
    if (set.starArea !== 'all') {
      const z = starZone(set, env.W, env.H);
      const m = 80 * env.S;
      edge = Math.max(0, Math.min(1, (p.y - z.y0 + 20 * env.S) / m, (z.y1 + 20 * env.S - p.y) / m));
    }
    const a = Math.min(1, ((0.28 + 0.72 * tw) * (0.45 + 0.55 * k) + p.flash * 0.8) * set.opacity * edge);
    if (a < 0.01) return;
    const r = p.size * k * (0.65 + 0.5 * tw + p.flash * 1.3 + au.bass * 0.45 * set.react);
    particleColor(set.color, p.hue, p.mix, t, rgb);
    blob(env, KIND.glow, p.x, p.y, r * 2.4, a * 0.55 * set.glow, rgb);

    const c = Math.cos(p.rot);
    const s = Math.sin(p.rot);
        const n = set.rays === 5 || set.rays === 6 || set.rays === 8 ? set.rays : 4;
    const q = r * 0.113 * set.starThick * (n > 5 ? 1.3 : 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = rgbStr(rgb, 0.55);
    ctx.setTransform(c, s, -s, c, p.x, p.y);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    for (let i = 0; i < n; i++) {
      const a1 = -Math.PI / 2 + ((i + 0.5) * TAU) / n;
      const a2 = -Math.PI / 2 + ((i + 1) * TAU) / n;
      ctx.quadraticCurveTo(Math.cos(a1) * q, Math.sin(a1) * q, Math.cos(a2) * r, Math.sin(a2) * r);
    }
    ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
};

// ---------- 5. конфетти ----------
// Тихий дождик сверху; на каждый удар из нижних углов бьют «хлопушки».

const confetti = {
  base: 220,
  ambient: false,
  additive: false,

  spawn(p, env, mode, side) {
    const { rnd, W, H, S, set, au } = env;
    p.alive = true;
      p.mode = mode;
    p.age = 0;
    p.rate = rnd();
    p.z = rnd();
    p.hue = rnd();
    p.mix = rnd();
    p.ph = rnd() * TAU;
        p.size = spawnSize(p, env, 4.5, 5.5);
    p.rot = rnd() * TAU;
    p.vr = (rnd() - 0.5) * 9;
    p.freq = 4 + rnd() * 7;
    if (mode === 0) {
      p.x = rnd() * W;
          p.y = set.confettiGravity < 0 ? H + (10 + rnd() * 30) * S : -(10 + rnd() * 30) * S;
      p.vx = (rnd() - 0.5) * 120 * S;
          p.vy = (50 + rnd() * 120) * S * (set.confettiGravity < 0 ? -1 : 1);
    } else if (set.confettiFrom === 'center') {
      // взрыв из центра кадра во все стороны
      const ang = rnd() * TAU;
         const v = (350 + rnd() * 750) * S * (0.7 + au.beat * 0.5) * set.confettiRange;
      p.x = W * 0.5;
      p.y = H * 0.5;
      p.vx = Math.cos(ang) * v;
      p.vy = Math.sin(ang) * v - 250 * S;
    } else if (set.confettiFrom === 'bottom') {
      // фонтан из низа по центру
      const v = (1100 + rnd() * 700) * S * (0.7 + au.beat * 0.5) * set.confettiRange;
      p.x = W * 0.5 + (rnd() - 0.5) * 40 * S;
      p.y = H + 6 * S;
      p.vx = (rnd() - 0.5) * 520 * S * set.confettiRange;
      p.vy = -v;
    } else if (set.confettiFrom === 'sides') {
      // с левого и правого края внутрь кадра
      const th = (30 + rnd() * 30) * Math.PI / 180;
      const v = (900 + rnd() * 700) * S * (0.7 + au.beat * 0.5) * set.confettiRange;
      p.x = side < 0 ? W * 0.02 : W * 0.98;
      p.y = H * (0.5 + rnd() * 0.4);
      p.vx = Math.cos(th) * v * (side < 0 ? 1 : -1);
      p.vy = -Math.sin(th) * v;
    } else if (set.confettiFrom === 'top') {
      // залп сверху по всей ширине кадра
      p.x = rnd() * W;
      p.y = -(10 + rnd() * 40) * S;
      p.vx = (rnd() - 0.5) * 260 * S;
          p.vy = (350 + rnd() * 650) * S * (0.7 + au.beat * 0.5) * set.confettiRange;
    } else {
      const theta = (55 + rnd() * 25) * Math.PI / 180;
           const v = (900 + rnd() * 700) * S * (0.7 + au.beat * 0.5) * set.confettiRange;
      p.x = side < 0 ? W * 0.03 : W * 0.97;
      p.y = H * 0.99;
      p.vx = Math.cos(theta) * v * (side < 0 ? 1 : -1);
      p.vy = -Math.sin(theta) * v;
    }
  },

  emit(env, acquire) {
    const { dt, set, au, st } = env;
      st.acc += (3 + au.energy * 22 * set.react) * set.confettiRain * set.amount * dt;
    while (st.acc >= 1) {
      st.acc -= 1;
      const p = acquire();
      if (!p) { st.acc = 0; break; }
      this.spawn(p, env, 0, 0);
    }
    if (au.beat > 0 && set.react > 0) {
           const n = Math.round((10 + 22 * au.beat) * set.amount * set.react * set.confettiBurst);
      for (let i = 0; i < n; i++) {
        const p = acquire();
        if (!p) break;
        this.spawn(p, env, 1, i % 2 ? 1 : -1);
      }
    }
  },

  step(p, env) {
    const { dt, t, set, S, W, H } = env;
    const drag = Math.exp(-2 * dt);
    p.vx *= drag;
    p.vy *= drag;
      p.vy += 620 * S * set.confettiGravity * dt;
    p.age += dt;
      p.vx += Math.sin(t * 3.1 + p.ph) * 140 * S * set.confettiFlutter * dt;
    p.x += windX(set, S, depthK(set, p.z)) * set.speed * dt;
    p.x += p.vx * set.speed * dt;
    p.y += p.vy * set.speed * dt;
     p.rot += p.vr * set.confettiSpin * set.speed * dt;
    // age > 14: страховка, чтобы при тяжести около 0 бумажки не копились вечно
    if (p.y > H + 40 * S || p.x < -90 * S || p.x > W + 90 * S || p.age > 14 || (set.confettiGravity < 0 && p.y < -40 * S)) p.alive = false;
  },

  draw(p, env) {
    const { ctx, set, t } = env;
    const k = depthK(set, p.z);
    const flip = Math.cos(t * p.freq + p.ph);
    const w = p.size * 1.7 * k;
    const h = Math.max(0.5, p.size * 0.9 * k * Math.abs(flip));
    particleColor(set.color, p.hue, p.mix, t, rgb);
    // одна сторона бумажки светлее другой
    const shade = 0.68 + 0.32 * (flip > 0 ? flip : -flip * 0.6);
    ctx.globalAlpha = Math.min(1, set.opacity);
    ctx.fillStyle = 'rgb(' + Math.round(rgb[0] * shade) + ',' + Math.round(rgb[1] * shade) + ',' + Math.round(rgb[2] * shade) + ')';
    const c = Math.cos(p.rot);
    const s = Math.sin(p.rot);
    ctx.setTransform(c, s, -s, c, p.x, p.y);
    const shape = set.confettiShape === 'mix'
      ? ['square', 'circle', 'strip', 'heart', 'star'][Math.floor(p.rate * 5) % 5]
      : set.confettiShape;
    confettiShape(ctx, shape, w, h);

    // Блеск фольги: когда бумажка повёрнута лицом к свету, она вспыхивает
    const gl = set.confettiShine * Math.max(0, (Math.abs(flip) - 0.85) / 0.15);
    if (gl > 0.02) {
      ctx.globalAlpha = Math.min(1, gl * 0.85 * set.opacity);
      ctx.fillStyle = '#ffffff';
      confettiShape(ctx, shape, w, h);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
};

// ---------- 6. дождь ----------
// Косые капли с ветром; бас усиливает порывы, у земли капля даёт кольцо брызг.

const rain = {
  base: 260,
  ambient: true,
  additive: false,

  spawn(p, env, fresh) {
    const { rnd, W, H, S } = env;
    p.alive = true;
    p.mode = 0;
    p.age = 0;
    p.x = rnd() * (W + 200 * S) - 100 * S;
    p.y = fresh ? rnd() * H * 0.95 : -rnd() * 120 * S;
    p.z = rnd();
    p.hue = rnd();
    p.mix = rnd();
    p.sp = 900 + rnd() * 600;
        p.size = spawnSize(p, env, 1, 1.3);
    // дальние капли «приземляются» выше, ближние ниже: так виден объём
    p.amp = H * (0.8 + 0.19 * p.z);
  },

  step(p, env) {
    const { dt, set, S, au, W } = env;
    if (p.mode === 1) {
      p.age += dt;
      if (p.age > 0.28) this.spawn(p, env, false);
      return;
    }
    const k = depthK(set, p.z);
    const wind = (70 + au.bass * set.react * 170) * S;
       p.vx = wind * (0.5 + 0.5 * k) + set.rainTilt * 900 * S + windX(set, S, k);
    p.vy = p.sp * S * (0.55 + 0.6 * k) * (1 + au.energy * set.react * 0.35);
    p.x += p.vx * set.speed * dt;
    p.y += p.vy * set.speed * dt;
    if (p.y >= p.amp) {
      if (set.splash) {
        p.mode = 1;
        p.age = 0;
        p.y = p.amp;
      } else {
        this.spawn(p, env, false);
        return;
      }
    }
    const m = 80 * S;
    if (p.x > W + m) p.x -= W + 2 * m;
    else if (p.x < -m) p.x += W + 2 * m;
  },

  draw(p, env) {
    const { ctx, set, t, S } = env;
    const k = depthK(set, p.z);
    particleColor(set.color, p.hue, p.mix, t, rgb);

    if (p.mode === 1) {
      const f = p.age / 0.28;
      const r = (2 + f * 10) * S * k;
      ctx.globalAlpha = (1 - f) * 0.4 * set.opacity;
      ctx.strokeStyle = rgbStr(rgb, 0.3);
      ctx.lineWidth = Math.max(0.6, p.size * 0.5);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.35, 0, 0, TAU);
      ctx.stroke();
      return;
    }

    ctx.globalAlpha = Math.min(1, (0.16 + 0.42 * k) * set.opacity);
    ctx.strokeStyle = rgbStr(rgb, 0.3);
    ctx.lineWidth = Math.max(0.6, p.size * (0.5 + 0.5 * k));
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x - p.vx * 0.022 * set.rainLen * set.speed, p.y - p.vy * 0.022 * set.rainLen * set.speed);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (p.z > 0.7) blob(env, KIND.glow, p.x, p.y, p.size * 3, 0.12 * set.glow * set.opacity, rgb);
  }
};

// ---------- 7. лепестки ----------
// Медленно кружатся вниз, переворачиваются в воздухе; бас даёт порыв ветра.

const petals = {
  base: 90,
  ambient: true,
  additive: false,

  spawn(p, env, fresh) {
    const { rnd, W, H, S } = env;
    p.alive = true;
    p.x = rnd() * W;
    p.y = fresh ? rnd() * H : -(14 + rnd() * 60) * S;
    p.z = rnd();
    p.hue = rnd();
    p.mix = rnd();
    p.ph = rnd() * TAU;
       p.size = spawnSize(p, env, 6, 7);
    p.sp = 34 + rnd() * 40;
    p.amp = 24 + rnd() * 40;
    p.freq = 0.5 + rnd() * 0.9;
    p.rot = rnd() * TAU;
    p.vr = (rnd() - 0.5) * 2.4;
    p.rate = 1.5 + rnd() * 2.5;
  },

  step(p, env) {
    const { dt, t, set, S, au, W, H } = env;
    const k = depthK(set, p.z);
    const gust = au.bass * set.react * 90 * S + Math.sin(t * 0.3 + p.ph) * 16 * S;
      // «Хаотичность»: размах качания и резкие рывки в стороны
    const ch = set.chaos;
    const swing = Math.sin(t * p.freq + p.ph) * p.amp * S * 0.7 * ch +
      Math.sin(t * (1.6 + p.rate) + p.ph * 5) * Math.max(0, ch - 1) * p.amp * S * 0.9;
    p.x += (swing + gust * (0.4 + 0.6 * k) + windX(set, S, k)) * set.speed * dt;
    p.y += p.sp * S * (0.5 + 0.7 * k) * (1 + au.energy * set.react * 0.9) * set.speed * dt;
    p.rot += p.vr * (1 + au.energy * set.react * 1.5) * set.speed * dt;
    if (p.y > H + 30 * S) this.spawn(p, env, false);
    const m = 40 * S;
    if (p.x < -m) p.x += W + 2 * m;
    else if (p.x > W + m) p.x -= W + 2 * m;
  },

  draw(p, env) {
    const { ctx, set, t } = env;
    const k = depthK(set, p.z);
    const flip = Math.cos(t * p.rate + p.ph);
    const w = p.size * k;
    const h = w * 0.62 * Math.max(0.18, Math.abs(flip));
    particleColor(set.color, p.hue, p.mix, t, rgb);
    if (set.glow > 0.05) blob(env, KIND.glow, p.x, p.y, w * 1.8, 0.1 * set.glow * set.opacity, rgb);

    const shade = 0.78 + 0.22 * (flip > 0 ? flip : -flip * 0.5);
    ctx.globalAlpha = Math.min(1, (0.55 + 0.4 * k) * set.opacity);
    ctx.fillStyle = 'rgb(' + Math.round(rgb[0] * shade) + ',' + Math.round(rgb[1] * shade) + ',' + Math.round(rgb[2] * shade) + ')';
    const c = Math.cos(p.rot);
    const s = Math.sin(p.rot);
    ctx.setTransform(c, s, -s, c, p.x, p.y);
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.quadraticCurveTo(-w * 0.2, -h * 1.5, w, 0);
    ctx.quadraticCurveTo(-w * 0.2, h * 1.5, -w, 0);
    ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
};

// ---------- 8. пепел ----------
// Серые хлопья медленно падают, а редкие тлеющие угольки поднимаются вверх.

const ash = {
  base: 150,
  ambient: true,
  additive: false,

  spawn(p, env, fresh) {
    const { rnd, W, H, S } = env;
    p.alive = true;
    p.mode = rnd() < 0.14 ? 1 : 0;
    p.x = rnd() * W;
    p.y = fresh ? rnd() * H : (p.mode ? H + 20 * S : -(10 + rnd() * 40) * S);
    p.z = rnd();
    p.hue = rnd();
    p.mix = rnd();
    p.ph = rnd() * TAU;
       p.size = p.mode ? spawnSize(p, env, 1.2, 1.8) : spawnSize(p, env, 1.6, 3.2);
    p.sp = p.mode ? 24 + rnd() * 40 : 14 + rnd() * 26;
    p.amp = 14 + rnd() * 26;
    p.freq = 0.4 + rnd() * 1.1;
    p.rot = rnd() * TAU;
    p.vr = (rnd() - 0.5) * 1.6;
    p.rate = 1 + rnd() * 2;
    p.flash = 0;
  },

  beat(p, env) {
    if (p.mode && env.rnd() < 0.3 + 0.4 * env.set.react * env.au.beat) p.flash = 1;
  },

  step(p, env) {
    const { dt, t, set, S, au, W, H } = env;
    const k = depthK(set, p.z);
    const turb = Math.sin(t * p.freq + p.ph) * p.amp * S + Math.sin(t * 0.9 + p.y * 0.01 + p.ph * 2) * 10 * S;
      p.x += (turb * 0.55 + au.bass * set.react * 40 * S + windX(set, S, k)) * set.speed * dt;
    p.y += (p.mode ? -1 : 1) * p.sp * S * (0.5 + 0.7 * k) * (1 + au.energy * set.react * 1.2) * set.speed * dt;
    p.rot += p.vr * set.speed * dt;
    p.flash *= Math.exp(-dt * 3);
    if ((!p.mode && p.y > H + 20 * S) || (p.mode && p.y < -20 * S)) this.spawn(p, env, false);
    const m = 30 * S;
    if (p.x < -m) p.x += W + 2 * m;
    else if (p.x > W + m) p.x -= W + 2 * m;
  },

  draw(p, env) {
    const { ctx, set, au, t } = env;
    const k = depthK(set, p.z);
    const sz = p.size * k;

    if (p.mode) {
      // уголёк: тёплое пульсирующее свечение, цвет по умолчанию «тёплый»
      const pulse = 0.5 + 0.5 * Math.sin(t * (2 + p.rate * 2) + p.ph);
      const a = Math.min(1, ((0.35 + 0.65 * pulse) * (0.6 + 0.4 * k) + p.flash * 0.8) * set.opacity);
      particleColor(set.color === 'ash' ? 'warm' : set.color, p.hue, p.mix, t, rgb);
      ctx.globalCompositeOperation = 'lighter';
      blob(env, KIND.glow, p.x, p.y, sz * 4.4 * (1 + au.bass * 0.3 * set.react), a * set.glow, rgb);
      blob(env, KIND.dot, p.x, p.y, sz * 1.2, a, rgb);
      ctx.globalCompositeOperation = 'source-over';
      return;
    }

    // хлопья: неровный тёмный осколок
    particleColor(set.color, p.hue, p.mix, t, rgb);
    const c = Math.cos(p.rot);
    const s = Math.sin(p.rot);
    ctx.globalAlpha = Math.min(1, (0.35 + 0.5 * k) * set.opacity);
    ctx.fillStyle = rgbStr(rgb, 0);
    ctx.setTransform(c, s, -s, c, p.x, p.y);
    ctx.beginPath();
    ctx.moveTo(-sz, -sz * 0.4);
    ctx.lineTo(sz * 0.9, -sz * 0.1);
    ctx.lineTo(-sz * 0.2, sz * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
};

export const TYPES = { sparks, fireflies, snow, stars, confetti, rain, petals, ash };
