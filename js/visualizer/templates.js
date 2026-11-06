import { FONTS, addText, loadFont, select, touch, renderPreview } from '/js/visualizer/overlay.js';

// Шаблоны текста для вкладки «Шаблоны».
// Шаблон — это несколько текстовых слоёв, собранных в одну композицию:
// главное слово, подписи, тонкие линии, свечение, тень и т.д.
// Карточки рисуются настоящим движком из overlay.js, поэтому на превью всё выглядит так же, как в ролике.
//
// Поля слоя:
//   font — шрифт, text — текст ('\n' = перенос), y — высота центра (0..1), size — размер (доля ширины кадра)
//   main — главное слово: туда подставляется SAMPLE_TEXT
//   set  — любые свойства слоя из overlay.js (цвет, неон, плашка, 3D и т.д.)
// Слои идут снизу вверх: первый рисуется самым нижним.
// Анимацию появления (inAnim, fadeIn) не используем: на 0:00 такой текст был бы невидим.

// Слово, которое подставляется в главный слой каждого шаблона.
// Пустая строка '' — оставить собственные тексты шаблонов.
const SAMPLE_TEXT = '992';

export const TEMPLATE_CATS = [
  { id: 'all', name: 'Все' },
  { id: 'lux', name: 'Люкс' },
  { id: 'light', name: 'Свет' },
  { id: 'vol', name: 'Объём' },
  { id: 'plate', name: 'Плашки' },
  { id: 'music', name: 'Музыка' }
];

// ---------- мелкие заготовки для композиций ----------

// Подпись: мелкий текст с большим разрядом между буквами.
function cap(text, y, size, color, track, extra) {
  return {
    font: 'Oswald', text: text, y: y, size: size,
    set: Object.assign({ caps: true, letterSp: track == null ? 0.5 : track, color: color || '#ffffff', shadow: false }, extra || {})
  };
}

// Тонкая линия: плашка с пробелом внутри. w — ширина линии (доля ширины кадра).
function rule(y, w, color, alpha) {
  return {
    font: 'Oswald', text: ' ', y: y, size: 0.02,
    set: {
      shadow: false, lineH: 0.1,
      plate: true, plateColor: color || '#ffffff', plateAlpha: alpha == null ? 0.85 : alpha,
      plateShape: 'rect', plateRadius: 0, platePadX: w / 0.04, platePadY: 0.03
    }
  };
}

export const TEMPLATES = [
  // ===== ЛЮКС =====
  {
    id: 'gold', name: 'Золото', cat: 'lux',
    layers: [
      cap('PREMIUM EDITION', 0.27, 0.032, '#e8c873', 0.6),
      rule(0.303, 0.2, '#d4a437', 0.9),
      {
        font: 'Unbounded', text: '992', y: 0.385, size: 0.25, main: true,
        set: {
          bold: true, color: '#fff6c2', gradient: true, gradColor2: '#b06a00', gradAngle: 90,
          outline: true, outlineColor: '#3b2300', outlineWidth: 0.035,
          shadow: true, shadowColor: '#000000', shadowAlpha: 0.75, shadowBlur: 0.18, shadowDist: 0.06,
          bevel: true, bevelSize: 0.55, bevelAlpha: 0.7,
          gloss: true, glossSize: 0.5, glossAlpha: 0.55
        }
      },
      rule(0.466, 0.2, '#d4a437', 0.9),
      cap('OFFICIAL AUDIO', 0.495, 0.032, '#e8c873', 0.6)
    ]
  },
  {
    id: 'chrome', name: 'Хром Y2K', cat: 'lux',
    layers: [
      {
        font: 'Unbounded', text: '992', y: 0.4, size: 0.26, main: true,
        set: {
          bold: true, italic: true, color: '#ffffff', gradient: true, gradColor2: '#56657d', gradAngle: 90,
          outline: true, outlineColor: '#0b0e14', outlineWidth: 0.045,
          shadow: false, shadow2: true, shadow2Color: '#7fb8ff', shadow2Alpha: 0.75, shadow2Blur: 0.45,
          bevel: true, bevelSize: 0.6, bevelAlpha: 0.75,
          gloss: true, glossSize: 0.55, glossAlpha: 0.75
        }
      },
      {
        font: 'JetBrains Mono', text: 'Y2K  CHROME  EDITION', y: 0.5, size: 0.028,
        set: { caps: true, letterSp: 0.35, color: '#a9bad6', shadow: false }
      }
    ]
  },
  {
    id: 'glass', name: 'Жидкое стекло', cat: 'lux',
    layers: [
      {
        font: 'Unbounded', text: '992', y: 0.4, size: 0.13, main: true,
        set: {
          bold: true, color: '#ffffff', letterSp: 0.06,
          shadow: true, shadowColor: '#000000', shadowAlpha: 0.35, shadowBlur: 0.2, shadowDist: 0.04,
          plate: true, plateColor: '#ffffff', plateAlpha: 0.14, plateShape: 'pill',
          platePadX: 0.8, platePadY: 0.4, plateGlass: true, plateGlassBlur: 0.85,
          plateBorder: true, plateBorderColor: '#e3ecff', plateBorderW: 0.012,
          plateShadow: true, plateShadowColor: '#000000', plateShadowAlpha: 0.35, plateShadowBlur: 0.5, plateShadowDist: 0.15
        }
      },
      cap('NOW PLAYING', 0.505, 0.03, '#ffffff', 0.55, { opacity: 0.85 })
    ]
  },
  {
    id: 'ghost', name: 'Призрак', cat: 'lux',
    layers: [
      {
        font: 'Bebas Neue', text: '992', y: 0.4, size: 0.6, main: true,
        set: { color: '#ffffff', opacity: 0.12, shadow: false }
      },
      cap('TRACK NAME', 0.395, 0.07, '#ffffff', 0.4, { bold: true, shadow: true, shadowAlpha: 0.7, shadowBlur: 0.2 }),
      rule(0.44, 0.1, '#ffffff', 0.9),
      cap('ARTIST', 0.465, 0.03, '#d8d8e0', 0.6)
    ]
  },

  // ===== СВЕТ =====
  {
    id: 'neon-sign', name: 'Неоновая вывеска', cat: 'light',
    layers: [
      cap('LIVE TONIGHT', 0.29, 0.03, '#ff7ee0', 0.6, { shadow2: true, shadow2Color: '#ff2fd0', shadow2Alpha: 1, shadow2Blur: 0.7 }),
      {
        font: 'Unbounded', text: '992', y: 0.4, size: 0.19, main: true,
        set: {
          bold: true, shadow: false, letterSp: 0.05,
          neon: true, neonColor: '#ff2fd0', neonSize: 0.6, neonLayers: 3, neonTube: 0.022,
          plate: true, plateColor: '#0a0a12', plateAlpha: 0.5, plateShape: 'rect', plateRadius: 0.25,
          platePadX: 0.4, platePadY: 0.28,
          plateBorder: true, plateBorderColor: '#ff5fdc', plateBorderW: 0.018,
          plateShadow: true, plateShadowColor: '#ff2fd0', plateShadowAlpha: 1, plateShadowBlur: 0.55, plateShadowDist: 0,
          anim: 'pulse', animPower: 0.25
        }
      }
    ]
  },
  {
    id: 'aurora', name: 'Аврора', cat: 'light',
    layers: [
      {
        font: 'Unbounded', text: '992', y: 0.4, size: 0.27, main: true,
        set: {
          bold: true, color: '#ff5fd2', gradient: true, gradColor2: '#46e6ff', gradAngle: 60,
          shadow: true, shadowColor: '#46e6ff', shadowAlpha: 0.55, shadowBlur: 0.8, shadowDist: 0,
          shadow2: true, shadow2Color: '#ff2fd0', shadow2Alpha: 0.7, shadow2Blur: 0.3,
          gloss: true, glossSize: 0.4, glossAlpha: 0.35,
          anim: 'glow', animPower: 0.4
        }
      },
      cap('AURORA', 0.505, 0.03, '#d9f6ff', 0.7, { shadow2: true, shadow2Color: '#46e6ff', shadow2Alpha: 0.9, shadow2Blur: 0.6 })
    ]
  },
  {
    id: 'glitch', name: 'Глитч RGB', cat: 'light',
    layers: [
      cap('[ SYSTEM ERROR ]', 0.315, 0.028, '#00e5ff', 0.3, { shadow2: true, shadow2Color: '#00e5ff', shadow2Alpha: 0.9, shadow2Blur: 0.6 }),
      {
        font: 'Unbounded', text: '992', y: 0.39, size: 0.23, main: true,
        set: {
          bold: true, color: '#ffffff',
          shadow: true, shadowColor: '#ff2fd0', shadowAlpha: 1, shadowBlur: 0, shadowX: 0.04, shadowDist: 0,
          shadow2: true, shadow2Color: '#00e5ff', shadow2Alpha: 1, shadow2Blur: 0, shadow2X: -0.04, shadow2Y: 0,
          anim: 'shake', animPower: 0.5
        }
      }
    ]
  },
  {
    id: 'fire', name: 'Огонь', cat: 'light',
    layers: [
      {
        font: 'Bebas Neue', text: '992', y: 0.4, size: 0.46, main: true,
        set: {
          color: '#fff7a0', gradient: true, gradColor2: '#ff2a00', gradAngle: 90,
          outline: true, outlineColor: '#4a0800', outlineWidth: 0.05,
          shadow: true, shadowColor: '#ff7a00', shadowAlpha: 0.85, shadowBlur: 0.7, shadowDist: 0,
          shadow2: true, shadow2Color: '#ff2a00', shadow2Alpha: 0.8, shadow2Blur: 0.3,
          anim: 'shake', animPower: 0.2
        }
      }
    ]
  },
  {
    id: 'ice', name: 'Лёд', cat: 'light',
    layers: [
      {
        font: 'Unbounded', text: '992', y: 0.4, size: 0.26, main: true,
        set: {
          bold: true, color: '#ffffff', gradient: true, gradColor2: '#4fc3ff', gradAngle: 90,
          outline: true, outlineColor: '#0a3a66', outlineWidth: 0.03,
          shadow: false, shadow2: true, shadow2Color: '#00a2ff', shadow2Alpha: 0.9, shadow2Blur: 0.55,
          bevel: true, bevelSize: 0.5, bevelAlpha: 0.6,
          gloss: true, glossSize: 0.55, glossAlpha: 0.7
        }
      },
      cap('SUB ZERO', 0.505, 0.03, '#bfe8ff', 0.7)
    ]
  },
  {
    id: 'retro', name: 'Ретро-волна', cat: 'light',
    layers: [
      cap('RETRO WAVE', 0.285, 0.034, '#ffd1f4', 0.6, { shadow2: true, shadow2Color: '#ff2fd0', shadow2Alpha: 1, shadow2Blur: 0.6 }),
      {
        font: 'Unbounded', text: '992', y: 0.375, size: 0.25, main: true,
        set: {
          bold: true, italic: true, color: '#ff2fd0', gradient: true, gradColor2: '#00e5ff', gradAngle: 90,
          outline: true, outlineColor: '#24093f', outlineWidth: 0.05,
          shadow: false, shadow2: true, shadow2Color: '#ff2fd0', shadow2Alpha: 0.8, shadow2Blur: 0.4
        }
      },
      rule(0.46, 0.34, '#00e5ff', 0.9),
      rule(0.472, 0.24, '#ff2fd0', 0.9),
      rule(0.484, 0.14, '#ffd84d', 0.9)
    ]
  },

  // ===== ОБЪЁМ =====
  {
    id: '3d', name: '3D фиолет', cat: 'vol',
    layers: [
      {
        font: 'Unbounded', text: '992', y: 0.38, size: 0.25, main: true,
        set: {
          bold: true, color: '#ffffff', shadow: false,
          ext: true, extColor: '#7c3aed', extDepth: 0.35, extAngle: 62,
          bevel: true, bevelSize: 0.4, bevelAlpha: 0.5,
          gloss: true, glossSize: 0.4, glossAlpha: 0.5,
          loop: 'float', loopSpeed: 1
        }
      }
    ]
  },
  {
    id: 'sunset', name: 'Длинная тень', cat: 'vol',
    layers: [
      {
        font: 'Unbounded', text: '992', y: 0.38, size: 0.21, main: true,
        set: {
          bold: true, color: '#fff3c4', shadow: false,
          long: true, longColor: '#ff4d6d', longLen: 0.9, longAngle: 50
        }
      }
    ]
  },

  // ===== ПЛАШКИ =====
  {
    id: 'sticker', name: 'Стикер', cat: 'plate',
    layers: [
      {
        font: 'Unbounded', text: '992', y: 0.4, size: 0.15, main: true,
        set: {
          bold: true, color: '#111111', shadow: false, rot: -6,
          plate: true, plateColor: '#ffe14d', plateAlpha: 1, plateShape: 'rect', plateRadius: 0.16,
          platePadX: 0.4, platePadY: 0.25,
          plateBorder: true, plateBorderColor: '#111111', plateBorderW: 0.035,
          plateShadow: true, plateShadowColor: '#000000', plateShadowAlpha: 1, plateShadowBlur: 0, plateShadowDist: 0.1
        }
      },
      {
        font: 'Oswald', text: 'NEW', x: 0.5, y: 0.34, size: 0.045,
        set: {
          bold: true, caps: true, letterSp: 0.2, color: '#ffffff', shadow: false, rot: 8,
          plate: true, plateColor: '#e11d48', plateAlpha: 1, plateShape: 'pill', platePadX: 0.5, platePadY: 0.22,
          plateBorder: true, plateBorderColor: '#111111', plateBorderW: 0.05
        }
      }
    ]
  },
  {
    id: 'karaoke', name: 'Караоке', cat: 'plate',
    layers: [
      {
        font: 'Oswald', text: '992', y: 0.8, size: 0.14, main: true,
        set: {
          bold: true, color: '#ffe14d', shadow: false, letterSp: 0.04,
          outline: true, outlineColor: '#000000', outlineWidth: 0.16,
          anim: 'pulse', animPower: 0.3
        }
      }
    ]
  },
  {
    id: 'tag', name: 'Тег', cat: 'plate',
    layers: [
      {
        font: 'JetBrains Mono', text: '992', y: 0.92, size: 0.06, main: true,
        set: {
          bold: true, color: '#ffffff', shadow: false, letterSp: 0.1,
          plate: true, plateColor: '#000000', plateAlpha: 0.6, plateShape: 'pill',
          platePadX: 0.7, platePadY: 0.3,
          plateBorder: true, plateBorderColor: '#ffffff', plateBorderW: 0.02
        }
      }
    ]
  },

  // ===== МУЗЫКА =====
  {
    id: 'release', name: 'Новый релиз', cat: 'music',
    layers: [
      {
        font: 'Oswald', text: 'NEW RELEASE', y: 0.2, size: 0.04,
        set: {
          bold: true, caps: true, letterSp: 0.3, color: '#ffffff', shadow: false,
          plate: true, plateColor: '#ff2d6f', plateAlpha: 1, plateGrad: true, plateColor2: '#ff8a3d', plateGradAngle: 0,
          plateShape: 'pill', platePadX: 0.7, platePadY: 0.28,
          plateShadow: true, plateShadowColor: '#ff2d6f', plateShadowAlpha: 0.6, plateShadowBlur: 0.6, plateShadowDist: 0.1
        }
      },
      {
        font: 'Bebas Neue', text: '992', y: 0.315, size: 0.34, main: true,
        set: {
          color: '#ffffff', shadow: true, shadowColor: '#000000', shadowAlpha: 0.7, shadowBlur: 0.25, shadowDist: 0.05,
          anim: 'pulse', animPower: 0.25
        }
      },
      rule(0.415, 0.14, '#ffffff', 0.9),
      cap('OFFICIAL AUDIO', 0.44, 0.03, '#e8e8ee', 0.6)
    ]
  },
  {
    id: 'cinema', name: 'Кино', cat: 'music',
    layers: [
      cap('992MUZ PRESENTS', 0.7, 0.03, '#cfcfd8', 0.7, { shadow: true, shadowAlpha: 0.8, shadowBlur: 0.2 }),
      {
        font: 'Oswald', text: '992', y: 0.77, size: 0.14, main: true,
        set: {
          bold: true, caps: true, letterSp: 0.22, color: '#ffffff',
          shadow: true, shadowColor: '#000000', shadowAlpha: 0.9, shadowBlur: 0.25, shadowDist: 0.04
        }
      },
      rule(0.835, 0.5, '#ffffff', 0.6),
      cap('FROM THE NEW ALBUM', 0.86, 0.026, '#cfcfd8', 0.6, { shadow: true, shadowAlpha: 0.8, shadowBlur: 0.2 })
    ]
  }
];

// ---------- добавление шаблона в ролик ----------

function pickFont(label) {
  for (let i = 0; i < FONTS.length; i++) if (FONTS[i].label === label) return FONTS[i];
  return FONTS[0];
}

function specText(spec) {
  return spec.main && SAMPLE_TEXT ? SAMPLE_TEXT : spec.text;
}

// Латинские буквы и цифры у Google-шрифтов грузятся отдельным куском.
// Подгружаем его заранее и просим движок перерисовать текст, когда он готов.
function ensureLatin(font) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const probe = '800 40px ' + font.family;
  return document.fonts.load(probe, '0123456789ABCDEFNEWOPRSTUY').catch(function () {});
}

let groupSeq = 0;

export function applyTemplate(tpl) {
  let first = null;
  // У шаблона из нескольких частей общий номер группы. gOpen: false = части склеены.
  const gid = tpl.layers.length > 1 ? ++groupSeq : 0;
  tpl.layers.forEach(function (spec) {
    const font = pickFont(spec.font);
    const l = addText(font);
    Object.assign(l, spec.set || {}, { text: specText(spec), x: spec.x == null ? 0.5 : spec.x, y: spec.y, size: spec.size, group: gid, gOpen: false });
    if (spec.main && !first) first = l;
    ensureLatin(font).then(function () { loadFont(font); });
  });
  if (first) select(first.id);
  touch();
  return first;
}
// ---------- превью настоящим движком ----------

const TEXT_BASE = {
  type: 'text', italic: false, underline: false, strike: false, caps: false,
  color: '#ffffff', size: 0.09, letterSp: 0, lineH: 1.2, align: 'center',
  gradient: false, gradColor2: '#ff2fd0', gradAngle: 90,
  anim: 'none', animPower: 0.6, x: 0.5, y: 0.25, opacity: 1, bold: false,
  outline: false, outlineColor: '#000000', outlineWidth: 0.12,
  shadow: true, shadowColor: '#000000', shadowAlpha: 0.8, shadowBlur: 0.15, shadowX: 0, shadowDist: 0.04,
  shadow2: false, shadow2Color: '#00e5ff', shadow2Alpha: 1, shadow2Blur: 0.4, shadow2X: 0, shadow2Y: 0,
  neon: false, neonColor: '#ff2fd0', neonSize: 0.5, neonLayers: 3, neonTube: 0.06,
  long: false, longColor: '#000000', longLen: 0.6, longAngle: 45,
  inner: false, innerColor: '#000000', innerAlpha: 0.9, innerBlur: 0.12, innerX: 0, innerY: 0.05
};

const PV_REAL_W = 720;
const PV_REAL_H = 1280;
let pvSeq = 0;
const pvIds = {};

function paintBackdrop(g, W, H) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#0c0d13';
  g.fillRect(0, 0, W, H);
  const blob = function (x, y, r, c) {
    const gr = g.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * W);
    gr.addColorStop(0, c);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  };
  blob(0.15, 0.2, 0.7, 'rgba(120,60,110,0.55)');
  blob(0.9, 0.85, 0.75, 'rgba(30,110,130,0.5)');
  blob(0.55, 0.5, 0.45, 'rgba(255,255,255,0.05)');
  const v = g.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, 'rgba(0,0,0,0.25)');
  v.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
}

function previewLayers(tpl, W, H) {
  let lo = 1;
  let hi = 0;
  tpl.layers.forEach(function (s) {
    lo = Math.min(lo, s.y);
    hi = Math.max(hi, s.y);
  });
  const mid = (lo + hi) / 2;
  const k = (PV_REAL_H * (W / PV_REAL_W)) / H;
  return tpl.layers.map(function (spec, i) {
    const key = tpl.id + ':' + i;
    if (!pvIds[key]) pvIds[key] = -(++pvSeq);
    const font = pickFont(spec.font);
    return Object.assign({}, TEXT_BASE, spec.set || {}, {
      id: pvIds[key],
      font: font.family,
      fontLabel: font.label,
      text: specText(spec),
      x: spec.x == null ? 0.5 : spec.x,
      y: 0.5 + (spec.y - mid) * k,
      size: spec.size
    });
  });
}

export function drawTemplatePreview(canvas, tpl) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  paintBackdrop(g, W, H);
  renderPreview(g, previewLayers(tpl, W, H), 0);
}

// ---------- панель вкладки «Шаблоны» ----------

let cat = 'all';
let styled = false;

function injectStyle() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent = [
    '.tpl-cats{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}',
    '.tpl-cats::-webkit-scrollbar{display:none}',
    '.tpl-cats .viz-chip{flex:0 0 auto;padding:5px 11px}',
      '@media (min-width:1024px){.tpl-cats{display:none}}',
    '.tpl-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}',
    '.tpl-card{display:flex;flex-direction:column;padding:0;overflow:hidden;cursor:pointer;color:#c4c4cc;font:inherit;',
    'border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.04);',
    'transition:border-color .15s ease,transform .1s ease}',
    '.tpl-card:hover{border-color:rgba(255,255,255,.5)}',
    '.tpl-card:active{transform:scale(.97)}',
    '.tpl-cv{display:block;width:100%;height:auto;pointer-events:none}',
    '.tpl-name{padding:6px 8px;font-size:12px;font-weight:600;text-align:left}'
  ].join('');
  document.head.append(st);
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

// root — контейнер панели. opts: { ready(), canApply(), onApply(tpl) }
export function mountTemplatesPanel(root, opts) {
  opts = opts || {};
  injectStyle();
  root.textContent = '';

  if (opts.ready && !opts.ready()) {
    root.append(el('p', 'viz-ovl-title', 'Сначала добавьте фото или трек, потом можно выбирать шаблоны.'));
    return;
  }

  const bar = el('div', 'tpl-cats');
  TEMPLATE_CATS.forEach(function (c) {
    const b = el('button', 'viz-chip' + (cat === c.id ? ' active' : ''), c.name);
    b.type = 'button';
    b.addEventListener('click', function () {
      cat = c.id;
      mountTemplatesPanel(root, opts);
    });
    bar.append(b);
  });
  root.append(bar);

  const grid = el('div', 'tpl-grid');
  const shown = [];
  const fonts = {};
  TEMPLATES.forEach(function (tpl) {
    if (!window.matchMedia('(min-width: 1024px)').matches && cat !== 'all' && tpl.cat !== cat) return;
    tpl.layers.forEach(function (s) { fonts[s.font] = true; });
    const cv = el('canvas', 'tpl-cv');
    cv.width = 480;
    cv.height = 290;
    const card = el('button', 'tpl-card');
    card.type = 'button';
    card.title = tpl.name;
    card.append(cv, el('div', 'tpl-name', tpl.name));
    card.addEventListener('click', function () {
      if (opts.canApply && !opts.canApply()) return;
      applyTemplate(tpl);
      if (opts.onApply) opts.onApply(tpl);
    });
    grid.append(card);
    shown.push({ cv: cv, tpl: tpl });
  });
  root.append(grid);

  const paint = function () {
    shown.forEach(function (s) {
      if (s.cv.isConnected) drawTemplatePreview(s.cv, s.tpl);
    });
  };
  paint();
  // Когда шрифты догрузятся, рисуем карточки заново.
  Promise.all(Object.keys(fonts).map(function (label) {
    const f = pickFont(label);
    return Promise.all([ensureLatin(f), loadFont(f)]);
  })).then(paint);
}