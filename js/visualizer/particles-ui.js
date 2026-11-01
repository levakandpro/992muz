import {
  PARTICLE_TYPES,
  PARTICLE_COLORS,
  PARTICLE_DEFAULTS,
  particles,
  setParticles,
  typeColor,
  resetParticleSettings,
  applyTypePreset,
  typeDefault
} from '/js/visualizer/particles.js';
import { wave } from '/js/visualizer/waves.js';

// Панель вкладки «Частицы». Использует CSS-классы вкладок «Текст» и «Стикеры»
// (.viz-ovl, .viz-seg, .viz-chip, .viz-sl) и свои классы из блока
// «вкладка «Частицы»» в конце visualizer.css (.viz-chip-ico, .viz-chip-sw и др.).

const STORE_KEY = 'viz-particles-v1';

function saveSettings() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(particles));
  } catch (e) {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    const patch = {};
    Object.keys(PARTICLE_DEFAULTS).forEach((k) => {
      if (k in data && typeof data[k] === typeof PARTICLE_DEFAULTS[k]) patch[k] = data[k];
    });
    setParticles(patch);
    return true;
  } catch (e) {
    return false;
  }
}

// Если настройки уже сохранены, первый вид не включаем сам: человек мог выбрать «Выкл».
let firstOpen = false;

// Иконки видов частиц. Рисуются линией цвета текста (currentColor),
// поэтому сами меняют цвет у активной кнопки.
const ICON_ATTR = 'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const TYPE_ICONS = {
  none: `<svg ${ICON_ATTR}><circle cx="12" cy="12" r="8"/><path d="M6.5 17.5L17.5 6.5"/></svg>`,
  sparks: `<svg ${ICON_ATTR}><path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z"/><path d="M19 15v5M16.5 17.5h5"/></svg>`,
  fireflies: `<svg ${ICON_ATTR}><circle cx="12" cy="12" r="2.4" fill="currentColor"/><circle cx="12" cy="12" r="6.5" opacity="0.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2"/></svg>`,
  snow: `<svg ${ICON_ATTR}><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.6L12 6.8l2.5-2.2M9.5 19.4L12 17.2l2.5 2.2"/></svg>`,
  stars: `<svg ${ICON_ATTR}><path d="M12 3c.8 5 3 7.2 8 9-5 1.8-7.2 4-8 9-.8-5-3-7.2-8-9 5-1.8 7.2-4 8-9z"/></svg>`,
  confetti: `<svg ${ICON_ATTR}><rect x="4" y="4.5" width="5.5" height="5.5" rx="1" transform="rotate(20 6.75 7.25)"/><circle cx="17" cy="7" r="2.6"/><path d="M4.5 17.5c2-3 3 3 5 0s3 3 5 0 3 2 5 0"/></svg>`,
  rain: `<svg ${ICON_ATTR}><path d="M8 4l-2 6M14 7l-2 6M20 4l-2 6M10 15l-2 5M17 15l-2 5"/></svg>`,
  petals: `<svg ${ICON_ATTR}><path d="M12 3c5 3 7 8 5 12-1.2 2.4-3 4-5 6-2-2-3.8-3.6-5-6-2-4 0-9 5-12z"/><path d="M12 8v10"/></svg>`,
  ash: `<svg ${ICON_ATTR}><circle cx="7" cy="8" r="1.6" fill="currentColor"/><circle cx="16" cy="6" r="1.2" fill="currentColor"/><circle cx="12" cy="13" r="2" fill="currentColor"/><circle cx="18" cy="16" r="1.4" fill="currentColor"/><circle cx="6" cy="18" r="1.1" fill="currentColor"/></svg>`
};
// Кружки в ряду «Цвет»: у каждого вида цвета свой оттенок.
const COLOR_SWATCH = {
  auto: 'linear-gradient(135deg, #7c3aed, #00e5ff)',
  white: '#ffffff',
  warm: 'linear-gradient(135deg, #ff4d3a, #ffb43c)',
  ice: '#7fd8ff',
  pink: '#f4a0cc',
  ash: '#8c8780',
  rainbow: 'conic-gradient(#ff3b30, #ffcc00, #34c759, #00c7ff, #af52de, #ff3b30)'
};
// Иконки для выбора внутри вида. Ключ: имя настройки + ':' + значение.
const ci = (inner) => `<svg ${ICON_ATTR}>${inner}</svg>`;
// Одна и та же картинка у разных настроек.
const ICON_BURST = ci('<circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>');
const ICON_FALL = ci('<path d="M5 3h14"/><path d="M12 7v13M7 15l5 5 5-5"/>');
const CHOICE_ICONS = {
  'sparkFrom:bottom': ci('<path d="M12 18V6M7 11l5-5 5 5"/><path d="M5 21h14"/>'),
  'sparkFrom:center': ICON_BURST,
  'sparkFrom:sides': ci('<path d="M3 12h7M7 8l4 4-4 4"/><path d="M21 12h-7M17 8l-4 4 4 4"/>'),
  'sparkFrom:fountain': ci('<path d="M12 21v-9"/><path d="M12 12C12 8 9 5 5.5 4.5M12 12c0-4 3-7 6.5-7.5"/><circle cx="5" cy="4.5" r="0.9" fill="currentColor"/><circle cx="19" cy="4.5" r="0.9" fill="currentColor"/>'),
  'sparkFrom:top': ICON_FALL,
  'rays:4': TYPE_ICONS.stars,
  'rays:5': ci('<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>'),
    'rays:6': ci('<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>'),
  'rays:8': ci('<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/>'),
  'starArea:all': ci('<circle cx="6" cy="6" r="1.6" fill="currentColor"/><circle cx="18" cy="6" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="6" cy="18" r="1.6" fill="currentColor"/><circle cx="18" cy="18" r="1.6" fill="currentColor"/>'),
  'starArea:top': ci('<path d="M3 4h18"/><circle cx="7" cy="9" r="1.6" fill="currentColor"/><circle cx="13" cy="12.5" r="1.6" fill="currentColor"/><circle cx="17.5" cy="8.5" r="1.6" fill="currentColor"/>'),
  'starArea:center': ci('<circle cx="12" cy="12" r="8" opacity="0.4"/><circle cx="10" cy="10.5" r="1.4" fill="currentColor"/><circle cx="14" cy="11.5" r="1.4" fill="currentColor"/><circle cx="12" cy="14.5" r="1.4" fill="currentColor"/>'),
  'confettiShape:square': ci('<rect x="5" y="5" width="14" height="14" rx="1.5"/>'),
  'confettiShape:circle': ci('<circle cx="12" cy="12" r="7.5"/>'),
  'confettiShape:strip': ci('<rect x="9" y="3" width="6" height="18" rx="1.5" transform="rotate(35 12 12)"/>'),
  'confettiShape:heart': ci('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'),
  'confettiFrom:corners': ci('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  'confettiFrom:center': ICON_BURST,
  'confettiFrom:top': ICON_FALL,
  'confettiFrom:bottom': ci('<path d="M12 20v-8"/><path d="M12 12C12 8 9 5 5.5 4.5M12 12c0-4 3-7 6.5-7.5"/><circle cx="12" cy="4" r="0.9" fill="currentColor"/><circle cx="5" cy="4.5" r="0.9" fill="currentColor"/><circle cx="19" cy="4.5" r="0.9" fill="currentColor"/>'),
  'confettiFrom:sides': ci('<path d="M3 12h7M7 8l4 4-4 4"/><path d="M21 12h-7M17 8l-4 4 4 4"/>'),
  'confettiShape:star': ci('<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>'),
  'confettiShape:mix': ci('<rect x="3.5" y="4" width="6" height="6" rx="1"/><circle cx="17" cy="7" r="3"/><path d="M12 21l1.6-3.4 3.4-.4-2.6-2.4.8-3.4L12 13.2l-3.2 1.8.8 3.4-2.6 2.4 3.4.4z"/>'),
  'splash:true': ci('<path d="M12 3c3 4 5 6.5 5 9a5 5 0 0 1-10 0c0-2.5 2-5 5-9z"/>'),
  'splash:false': ci('<path d="M12 3c3 4 5 6.5 5 9a5 5 0 0 1-10 0c0-2.5 2-5 5-9z"/><path d="M4 4l16 16"/>'),
  'fireArea:all': ci('<circle cx="6" cy="6" r="1.6" fill="currentColor"/><circle cx="18" cy="6" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="6" cy="18" r="1.6" fill="currentColor"/><circle cx="18" cy="18" r="1.6" fill="currentColor"/>'),
  'fireArea:bottom': ci('<path d="M3 20h18"/><circle cx="7" cy="15" r="1.6" fill="currentColor"/><circle cx="13" cy="11.5" r="1.6" fill="currentColor"/><circle cx="17.5" cy="15.5" r="1.6" fill="currentColor"/>'),
  'fireArea:top': ci('<path d="M3 4h18"/><circle cx="7" cy="9" r="1.6" fill="currentColor"/><circle cx="13" cy="12.5" r="1.6" fill="currentColor"/><circle cx="17.5" cy="8.5" r="1.6" fill="currentColor"/>'),
  'fireArea:center': ci('<circle cx="12" cy="12" r="8" opacity="0.4"/><circle cx="10" cy="10.5" r="1.4" fill="currentColor"/><circle cx="14" cy="11.5" r="1.4" fill="currentColor"/><circle cx="12" cy="14.5" r="1.4" fill="currentColor"/>'),
  'snowShape:dot': ci('<circle cx="12" cy="12" r="5" fill="currentColor"/>'),
  'snowShape:flake': TYPE_ICONS.snow,
  'snowShape:mix': ci('<circle cx="6.5" cy="7" r="2" fill="currentColor"/><path d="M15 10v10M10.7 12.5l8.6 5M10.7 17.5l8.6-5"/>')
};
// Цвет, которым подсвечивается иконка выбранного вида.
const TINT = {
  white: '#ffffff',
  warm: '#ffa94d',
  ice: '#7fd8ff',
  pink: '#f4a0cc',
  ash: '#b5b0a8',
  rainbow: '#c58cff'
};

function particleTint() {
  const m = particles.color;
  if (m === 'custom') return particles.customColor;
  if (m === 'auto') return wave.colorMode === 'rainbow' ? TINT.rainbow : wave.color1;
  return TINT[m] || '#ffffff';
}

function hsvToHex(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return '#' + [f(5), f(3), f(1)]
    .map((x) => Math.round(x * 255).toString(16).padStart(2, '0'))
    .join('');
}

function hexToHsv(hex) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { h: hue, s: max ? d / max : 0, v: max };
}

function dragArea(node, onMove) {
  let on = false;
  const move = (e) => {
    const r = node.getBoundingClientRect();
    onMove(
      Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width))),
      Math.min(1, Math.max(0, (e.clientY - r.top) / Math.max(1, r.height)))
    );
  };
  node.addEventListener('pointerdown', (e) => {
    on = true;
    try { node.setPointerCapture(e.pointerId); } catch (err) {}
    move(e);
    e.preventDefault();
  });
  node.addEventListener('pointermove', (e) => {
    if (on) move(e);
  });
  const stop = () => { on = false; };
  node.addEventListener('pointerup', stop);
  node.addEventListener('pointercancel', stop);
}

// Палитра своего цвета. Возвращает кнопку-кружок (swatch) и раскрывающуюся панель (pane).
function customColorPane(key, label, onPick) {
  const pane = el('div', 'viz-pane');

  const swatch = el('button', 'viz-cbtn');
  swatch.type = 'button';
  swatch.setAttribute('aria-label', label);

  const pick = el('div', 'viz-cpick');
  pick.hidden = true;
  const sv = el('div', 'viz-cpick-sv');
  const svDot = document.createElement('i');
  sv.append(svDot);
  const hueBar = el('div', 'viz-cpick-hue');
  const hueDot = document.createElement('i');
  hueBar.append(hueDot);
  const prow = el('div', 'viz-cpick-row');
  const prev = el('span', 'viz-cpick-prev');
  const hexIn = document.createElement('input');
  hexIn.type = 'text';
  hexIn.maxLength = 7;
  hexIn.spellcheck = false;
  hexIn.autocomplete = 'off';
  hexIn.setAttribute('aria-label', 'Код цвета');
  const ok = el('button', 'viz-btn viz-btn-primary', 'Готово');
  ok.type = 'button';
  prow.append(prev, hexIn, ok);
  pick.append(sv, hueBar, prow);
  pane.append(pick);

  const start = hexToHsv(particles[key]) || { h: 0, s: 0, v: 1 };
  let h = start.h;
  let s = start.s;
  let v = start.v;

  function render(keepText) {
    const hex = hsvToHex(h, s, v);
    sv.style.background = `linear-gradient(to top, #000, rgba(0, 0, 0, 0)), linear-gradient(to right, #fff, hsl(${h} 100% 50%))`;
    svDot.style.left = (s * 100) + '%';
    svDot.style.top = ((1 - v) * 100) + '%';
    hueDot.style.left = (h / 360 * 100) + '%';
    prev.style.background = hex;
    if (!keepText) hexIn.value = hex;
    return hex;
  }

  function apply(keepText) {
    const hex = render(keepText);
    setParticles({ [key]: hex, color: 'custom' });
    onPick();
  }

  dragArea(sv, (x, y) => {
    s = x;
    v = 1 - y;
    apply(false);
  });

  dragArea(hueBar, (x) => {
    h = x * 360;
    apply(false);
  });

  hexIn.addEventListener('input', () => {
    let t = hexIn.value.trim();
    if (t && t[0] !== '#') t = '#' + t;
    const hsv = hexToHsv(t);
    if (!hsv) return;
    h = hsv.h;
    s = hsv.s;
    v = hsv.v;
    apply(true);
  });

  swatch.addEventListener('click', () => {
    pick.hidden = !pick.hidden;
    if (!pick.hidden && pick.scrollIntoView) pick.scrollIntoView({ block: 'nearest' });
  });

  ok.addEventListener('click', () => {
    pick.hidden = true;
  });

  render(false);
  return { pane, swatch };
}
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function fillRange(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const p = max > min ? ((Number(input.value) - min) / (max - min)) * 100 : 0;
  input.style.setProperty('--p', p + '%');
}

const times = (v) => '×' + v.toFixed(2).replace(/0$/, '');
const pct = (v) => Math.round(v * 100) + '%';
const sec = (v) => (v > 0 ? v.toFixed(1) + ' с' : 'выкл');
const signed = (v) => (v < -0.004 ? '← ' : v > 0.004 ? '→ ' : '') + Math.round(Math.abs(v) * 100) + '%';
const liftFmt = (v) => (v < -0.04 ? '↓ ' : v > 0.04 ? '↑ ' : '') + Math.round(Math.abs(v) * 100) + '%';

// Какие общие ползунки показывать у вида. Виды, которых здесь нет, показывают все.
const SLIDER_SETS = {
  sparks: ['amount', 'size', 'speed', 'react', 'glow', 'opacity', 'wind'],
  fireflies: ['amount', 'size', 'speed', 'react', 'glow', 'depth', 'opacity', 'wind'],
  stars: ['amount', 'size', 'speed', 'react', 'glow', 'depth', 'opacity', 'spread', 'wind'],
  confetti: ['amount', 'size', 'speed', 'react', 'depth', 'opacity', 'spread', 'wind']
};
const SLIDERS = [
  { key: 'amount', label: 'Количество', min: 0.2, max: 2, step: 0.05, fmt: times },
  { key: 'size', label: 'Размер', min: 0.4, max: 2.5, step: 0.05, fmt: times },
  { key: 'speed', label: 'Скорость', min: 0, max: 3, step: 0.05, fmt: times },
  { key: 'react', label: 'Реакция на бит', min: 0, max: 2, step: 0.05, fmt: pct },
  { key: 'glow', label: 'Свечение', min: 0, max: 2, step: 0.05, fmt: pct },
  { key: 'depth', label: 'Глубина', min: 0, max: 1, step: 0.01, fmt: pct },
  { key: 'opacity', label: 'Яркость', min: 0.1, max: 1, step: 0.01, fmt: pct },
  { key: 'spread', label: 'Разброс размеров', min: 0, max: 2, step: 0.05, fmt: pct },
  { key: 'soft', label: 'Мягкость', min: 0, max: 1, step: 0.01, fmt: pct },
  { key: 'wind', label: 'Ветер', min: -1, max: 1, step: 0.05, fmt: signed }
];

function makeSlider(def, onChange) {
  const row = el('label', 'viz-sl');
    row.title = 'Двойной клик по ползунку — сброс';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(def.min);
  input.max = String(def.max);
  input.step = String(def.step);
  input.value = String(particles[def.key]);
  fillRange(input);
  const out = el('output', null, def.fmt(particles[def.key]));

  function apply(v) {
    input.value = String(v);
    fillRange(input);
    out.textContent = def.fmt(v);
    setParticles({ [def.key]: v });
    onChange();
  }

  input.addEventListener('input', () => apply(Number(input.value)));
  input.addEventListener('dblclick', () => apply(typeDefault(def.key)));
  row.append(el('span', null, def.label), input, out);
  return row;
}

function chipRow(items, isActive, onPick, tint) {
  const seg = el('div', 'viz-seg');
  const buttons = items.map((item) => {
    const b = el('button', 'viz-chip');
    if (item.icon) {
      b.classList.add('viz-chip-ico');
      b.innerHTML = item.icon; // иконки статичные, из TYPE_ICONS и CHOICE_ICONS
      b.append(el('span', null, item.name));
    } else if (item.swatch) {
      b.classList.add('viz-chip-sw');
      b.title = item.name;
      b.setAttribute('aria-label', item.name);
      b.style.background = item.swatch;
    } else {
      b.textContent = item.name;
    }
    b.type = 'button';
    b.addEventListener('click', () => onPick(item.id));
    seg.append(b);
    return { id: item.id, b };
  });
  function paint() {
    buttons.forEach(({ id, b }) => {
      const on = isActive(id);
      b.classList.toggle('active', on);
      if (!tint) return;
      const c = on ? tint(id) : '';
      if (c) b.style.setProperty('--tint', c);
      else b.style.removeProperty('--tint');
    });
  }
  paint();
  return { seg, paint };
}

// Рисует панель внутри box. opts.onChange вызывается после каждой правки.
export function mountParticlesPanel(box, opts) {
  const userChange = (opts && opts.onChange) || function () {};
  const onChange = () => {
    saveSettings();
    userChange();
  };

  // При самом первом открытии сразу включаем первый вид, как это делают «Волны».
  if (firstOpen) {
    firstOpen = false;
    if (particles.type === 'none') {
         applyTypePreset(PARTICLE_TYPES[0].id);
    }
  }

  box.textContent = '';


  const typeItems = [{ id: 'none', name: 'Выкл' }]
    .concat(PARTICLE_TYPES)
    .map((t) => ({ id: t.id, name: t.name, icon: TYPE_ICONS[t.id] }));
  const typeRows = [];
  const colorRow = chipRow(
      PARTICLE_COLORS.filter((c) => c.id !== 'custom').map((c) => ({ id: c.id, name: c.name, swatch: COLOR_SWATCH[c.id] })),
    (id) => particles.color === id,
    (id) => {
      setParticles({ color: id });
      syncColorUi();
      onChange();
    }
  );

  function pickType(id) {
    if (id === 'none') setParticles({ type: 'none' });
    else applyTypePreset(id);
    syncColorUi();
    renderGeneral();
    renderExtras();
    onChange();
  }

  for (let i = 0; i < typeItems.length; i += 3) {
    const row = chipRow(typeItems.slice(i, i + 3), (id) => particles.type === id, pickType, (id) => (id === 'none' ? '' : particleTint()));
    typeRows.push(row);
    box.append(row.seg);
  }

  colorRow.seg.classList.add('viz-seg-colors');
  box.append(colorRow.seg);

  // Свой цвет: кнопка «+» стоит в одном ряду с пресетами, палитра раскрывается под ней.
   const { pane: customPane, swatch: swatchBtn } = customColorPane('customColor', 'Свой цвет', () => {
    syncColorUi();
    onChange();
  });
  swatchBtn.classList.add('viz-cbtn-dot');
  swatchBtn.title = 'Свой цвет';
  colorRow.seg.append(swatchBtn);

  // Перекрашивает всё, что зависит от выбранного цвета: ряд кружков,
  // кнопку «+» и подсветку иконок видов.
  function syncColorUi() {
    const on = particles.color === 'custom';
    colorRow.paint();
    typeRows.forEach((r) => r.paint());
    swatchBtn.classList.toggle('active', on);
    swatchBtn.style.background = on ? particles.customColor : '';
    swatchBtn.textContent = on ? '' : '+';
  }
  swatchBtn.addEventListener('click', () => {
    setParticles({ color: 'custom' });
    syncColorUi();
    onChange();
  });
  syncColorUi();
  box.append(customPane);
  // Выбор вида («Где летают») стоит над ползунками.
  const pre = el('div');
  box.append(pre);
  // Общие ползунки: у каждого вида свой набор (см. SLIDER_SETS).
  const general = el('div', 'viz-contents');
  box.append(general);

  function renderGeneral() {
    general.textContent = '';
    const only = SLIDER_SETS[particles.type];
    SLIDERS.forEach((def) => {
      if (!only || only.includes(def.key)) general.append(makeSlider(def, onChange));
    });
  }
  renderGeneral();

  // Настройки, которые есть только у выбранного вида частиц.
  const extra = el('div');
  box.append(extra);

  function renderExtras() {
    extra.textContent = '';
    pre.textContent = '';
    const type = particles.type;
    const parts = [];
    const topParts = [];

    const choice = (title, items, key, top) => {
      const row = chipRow(items.map((it) => ({ id: it.id, name: it.name, icon: CHOICE_ICONS[key + ':' + it.id] })), (id) => particles[key] === id, (id) => {
        setParticles({ [key]: id });
        row.paint();
        onChange();
      });
      row.seg.classList.add('viz-seg-wrap');
         (top ? topParts : parts).push(el('p', 'viz-ovl-title', title), row.seg);
    };
    const slider = (key, label, min, max, step, fmt) => {
      parts.push(makeSlider({ key, label, min, max, step, fmt }, onChange));
    };

    if (type === 'sparks') {
      choice('Откуда летят', [
        { id: 'bottom', name: 'Снизу' },
        { id: 'fountain', name: 'Фонтан' },
        { id: 'center', name: 'Из центра' },
        { id: 'sides', name: 'С боков' },
        { id: 'top', name: 'Сверху' }
      ], 'sparkFrom');
      slider('lift', 'Подъём', -3, 3, 0.05, liftFmt);
      slider('swirl', 'Завихрение', 0, 3, 0.05, pct);
      slider('lifetime', 'Жизнь искр', 0.3, 2.5, 0.05, times);
      slider('flicker', 'Мерцание', 0, 1.8, 0.05, pct);
      slider('flare', 'Блики-лучи', 0, 2, 0.05, pct);
      slider('tail', 'Длина хвоста', 0, 3, 0.05, times);
    } else if (type === 'stars') {
      choice('Где светят', [
        { id: 'all', name: 'Везде' },
        { id: 'top', name: 'Вверху' },
        { id: 'center', name: 'В центре' }
      ], 'starArea', true);
      choice('Число лучей', [
        { id: 4, name: '4 луча' },
        { id: 5, name: '5 лучей' },
        { id: 6, name: '6 лучей' },
        { id: 8, name: '8 лучей' }
      ], 'rays', true);
      slider('twinkle', 'Сила мерцания', 0, 2, 0.05, pct);
      slider('starBlink', 'Частота мерцания', 0.2, 3, 0.05, times);
      slider('starThick', 'Толщина лучей', 0.3, 3, 0.05, pct);
      slider('starSpin', 'Вращение', -4, 4, 0.05, (v) => Math.round(v * 100) + '%');
      slider('starRise', 'Подъём', -2, 2, 0.05, liftFmt);
      slider('starFlash', 'Вспышка на бит', 0, 2, 0.05, pct);
      slider('starMeteor', 'Падающие звёзды', 0, 2, 0.05, pct);
    } else if (type === 'confetti') {
      choice('Откуда бьют', [
        { id: 'corners', name: 'Из углов' },
        { id: 'center', name: 'Из центра' },
        { id: 'bottom', name: 'Снизу' },
        { id: 'sides', name: 'С боков' },
        { id: 'top', name: 'Сверху' }
      ], 'confettiFrom', true);
      choice('Форма', [
        { id: 'square', name: 'Квадрат' },
        { id: 'circle', name: 'Круг' },
        { id: 'strip', name: 'Полоска' },
        { id: 'heart', name: 'Сердце' },
        { id: 'star', name: 'Звезда' },
        { id: 'mix', name: 'Микс' }
      ], 'confettiShape', true);
      slider('confettiGravity', 'Тяжесть', -1.5, 2, 0.05, (v) => (v < -0.04 ? '↑' : v > 0.04 ? '↓' : '') + Math.round(Math.abs(v) * 100) + '%');
      slider('confettiFlutter', 'Порхание', 0, 3, 0.05, pct);
      slider('confettiSpin', 'Вращение', 0, 3, 0.05, pct);
      slider('confettiBurst', 'Мощность залпа', 0, 2.5, 0.05, pct);
      slider('confettiRange', 'Дальность залпа', 0.3, 1.8, 0.05, pct);
      slider('confettiRain', 'Дождик', 0, 2, 0.05, pct);
      slider('confettiShine', 'Блеск фольги', 0, 1.5, 0.05, pct);
    } else if (type === 'rain') {
      slider('rainTilt', 'Наклон', -1, 1, 0.05, signed);
      slider('rainLen', 'Длина капли', 0.3, 3, 0.05, times);
      choice('Брызги', [
        { id: true, name: 'Вкл' },
        { id: false, name: 'Выкл' }
      ], 'splash');
    } else if (type === 'fireflies') {
      choice('Где летают', [
        { id: 'all', name: 'Везде' },
        { id: 'bottom', name: 'Внизу' },
        { id: 'top', name: 'Вверху' },
        { id: 'center', name: 'В центре' }
          ], 'fireArea', true);
      slider('blinkRate', 'Частота мигания', 0.2, 3, 0.05, times);
      slider('blinkDepth', 'Глубина мигания', 0, 1, 0.01, pct);
      slider('sync', 'Синхронность', 0, 1, 0.01, pct);
      slider('burst', 'Разлёт на бит', 0, 2, 0.05, pct);
      slider('swarm', 'Рой (стянуть)', -1, 1, 0.05, (v) => Math.round(v * 100) + '%');
      slider('trail', 'Шлейф', 0, 3, 0.05, pct);
      slider('chaos', 'Хаотичность', 0, 2, 0.05, pct);
    } else if (type === 'snow') {
      choice('Форма хлопьев', [
        { id: 'dot', name: 'Круг' },
        { id: 'flake', name: 'Снежинка' },
        { id: 'mix', name: 'Микс' }
      ], 'snowShape', true);
      slider('snowFall', 'Падение', -1.5, 1.5, 0.05, (v) => (v < -0.04 ? '↑' : v > 0.04 ? '↓' : '') + Math.round(Math.abs(v) * 100) + '%');
      slider('snowSway', 'Качание', 0, 2, 0.05, pct);
      slider('snowSpin', 'Вращение', 0, 3, 0.05, pct);
      slider('snowGust', 'Порывы на бит', 0, 2, 0.05, pct);
      slider('snowBokeh', 'Боке', 0, 1, 0.01, pct);
      slider('snowSparkle', 'Блеск', 0, 1.5, 0.05, pct);
    } else if (type === 'petals') {
      slider('chaos', 'Хаотичность полёта', 0, 2, 0.05, pct);
    }

    if (topParts.length) pre.append(...topParts);
    if (parts.length) extra.append(el('p', 'viz-ovl-title', 'Настройки вида'), ...parts);
  }
  renderExtras();

  // Сброс: маленькая стрелка в конце ряда цветов.
  const reset = el('button', 'viz-reset');
  reset.type = 'button';
  reset.title = 'Сбросить настройки';
  reset.setAttribute('aria-label', 'Сбросить настройки');
  reset.innerHTML = ci('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4.5h4.5"/>');
  reset.addEventListener('click', () => {
    resetParticleSettings(false);
    mountParticlesPanel(box, opts);
    onChange();
  });
  colorRow.seg.append(reset);
}