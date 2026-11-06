import { effects, setEffects, EFFECT_DEFAULTS, resetEffectSettings } from '/js/visualizer/effects.js';
import { BG_FILTERS, getBackground, slideshow, drawFilterSample } from '/js/visualizer/waves.js';

// Панель вкладки «Эффекты». Строится один раз, дальше только обновляет значения.

const pct = (v) => Math.round(v * 100) + '%';
const sec = (v) => (v > 0 ? v.toFixed(1) + ' с' : 'выкл');
export const ITEMS = [
  { k: 'zoom', label: 'Зум-пульс', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'flash', label: 'Вспышка', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'glitch', label: 'Глитч', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'shake', label: 'Тряска', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'vignette', label: 'Виньетка', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'grain', label: 'Зерно', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'bloom', label: 'Свечение', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'warp', label: 'Рябь', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'radial', label: 'Радиальный блюр', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'pixel', label: 'Пиксели', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'tint', label: 'Цветовой пульс', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'scan', label: 'Сканлайны', min: 0, max: 1.5, step: 0.01, fmt: pct },
    { k: 'mirror', label: 'Зеркало / калейдоскоп', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'tilt', label: 'Наклон', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'ghost', label: 'Призраки', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'invert', label: 'Инверсия', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'tile', label: 'Мозаика', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'punch', label: 'Контраст-удар', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'vhs', label: 'VHS', min: 0, max: 1.5, step: 0.01, fmt: pct },
  { k: 'bpm', label: 'BPM в кадре', min: 0, max: 1, step: 0.01, fmt: pct },
  { k: 'progress', label: 'Полоска прогресса', min: 0, max: 1, step: 0.01, fmt: pct },

  { k: 'sens', label: 'Чувствит. к биту', min: 0.5, max: 2, step: 0.01, fmt: pct }
];

const refs = [];
const filterChips = [];
const modeChips = [];
let fxShow = null;
let fxBox = null;
let fxOpenFn = null;
let fxCloseFn = null;
export function openEffectsSettings() {
  if (fxOpenFn) fxOpenFn();
}
export function closeEffectsSettings() {
  if (fxCloseFn) fxCloseFn();
}
export function effectsSettingsOpen() {
  return !!fxBox && fxBox.classList.contains('fx-open');
}
function fill(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const p = max > min ? ((Number(input.value) - min) / (max - min)) * 100 : 0;
  input.style.setProperty('--p', p + '%');
}
// Перерисовывает миниатюры фильтров по текущему фото, видео или слайд-шоу (только на компьютере).
function refreshThumbs() {
  if (!window.matchMedia('(min-width: 1024px)').matches) return;
  const src = slideshow.on && slideshow.list.length > 1 ? slideshow.list[0] : getBackground();
  filterChips.forEach((c) => {
    if (!c.cv) return;
    let ok = false;
    if (src) {
      try { ok = drawFilterSample(c.cv.getContext('2d'), src, c.id, c.cv.width, c.cv.height); } catch (e) { ok = false; }
    }
    c.cv.classList.toggle('on', ok);
  });
}
function syncAll() {
  refs.forEach((r) => {
    r.input.value = String(effects[r.def.k]);
    fill(r.input);
    r.out.textContent = r.def.fmt(effects[r.def.k]);
  });
  filterChips.forEach((c) => c.btn.classList.toggle('active', effects.filter === c.id));
    modeChips.forEach((c) => c.btn.classList.toggle('active', effects[c.key] === c.id));
  const cur = filterChips.find((c) => effects.filter === c.id);
  if (cur && fxShow) fxShow(cur.g, cur.btn);
}
// Виды появления и конца ролика: [id, подпись для начала, подпись для конца]
const TRANS_MODES = [
  ['fade', 'Из чёрного', 'В чёрное'],
  ['white', 'Из белого', 'В белое'],
  ['zoom', 'Зум', 'Зум'],
  ['slide', 'Сдвиг', 'Сдвиг'],
  ['wipe', 'Шторка', 'Шторка'],
  ['circle', 'Круг', 'Круг'],
  ['pixel', 'Пиксели', 'Пиксели'],
  ['blur', 'Размытие', 'Размытие'],
  ['door', 'Двери', 'Двери'],
  ['blinds', 'Жалюзи', 'Жалюзи'],
  ['spin', 'Вихрь', 'Вихрь'],
  ['glitch', 'Глитч', 'Глитч'],
  ['tv', 'Телевизор', 'Телевизор'],
  ['checker', 'Шахматка', 'Шахматка'],
  ['rgb', 'RGB-сдвиг', 'RGB-сдвиг'],
    ['diag', 'Диагональ', 'Диагональ'],
  ['whip', 'Рывок', 'Рывок'],
  ['zblur', 'Зум-блюр', 'Зум-блюр'],
  ['leak', 'Засвет', 'Засвет'],
  ['ripple', 'Волна', 'Волна'],
  ['flip', 'Переворот', 'Переворот'],
  ['clock', 'Часы', 'Часы'],
  ['shatter', 'Осколки', 'Осколки'],
  ['burn', 'Прожиг', 'Прожиг'],
  ['dissolve', 'Растворение', 'Растворение'],
  ['shine', 'Блик', 'Блик'],
  ['slam', 'Удар', 'Удар'],
  ['focus', 'Фокус', 'Фокус'],
  ['iris', 'Ирис', 'Ирис'],
  ['split', 'Разрез', 'Разрез'],
  ['cine', 'Кино', 'Кино'],
  ['slice', 'Нарезка', 'Нарезка'],
  ['bars', 'Эквалайзер', 'Эквалайзер'],
  ['chroma', 'Хромо-зум', 'Хромо-зум'],
  ['roll', 'Ролл', 'Ролл'],
  ['anamorph', 'Анаморф', 'Анаморф'],
  ['lens', 'Линза', 'Линза'],
  ['strobe', 'Строб', 'Строб'],
  ['lightning', 'Молния', 'Молния'],
  ['hyper', 'Гиперпрыжок', 'Гиперпрыжок'],
  ['laser', 'Лазер', 'Лазер'],
  ['star', 'Звезда', 'Звезда'],
  ['heart', 'Сердце', 'Сердце'],
  ['echo', 'Эхо-зум', 'Эхо-зум']
];
const TRANS_ICONS = {
  fade: '◐', white: '✸', zoom: '⤢', slide: '➜', wipe: '▌', circle: '◯',
  pixel: '▦', blur: '≋', door: '◧', blinds: '☰', spin: '@', glitch: '⌇',
  tv: '▭', checker: '▚', rgb: '◑', diag: '◢', whip: '↯', zblur: '⊙',
  leak: '✺', ripple: '∿', flip: '⇅', clock: '◔', shatter: '❖', burn: '✦',
  dissolve: '∴', shine: '✧', slam: '▼', focus: '⌖', iris: '◉', split: '⫽',
  cine: '▬', slice: '≡', bars: '▮', chroma: '◈', roll: '↻', anamorph: '⟷',
  lens: '◍', strobe: '✳', lightning: 'ϟ', hyper: '≫', laser: '╱', star: '★',
  heart: '♥', echo: '◎'
};
function makeReset(change) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'viz-mini';
    b.textContent = '↺';
  b.title = 'Сбросить эффекты';
  b.addEventListener('click', () => {
    resetEffectSettings();
    syncAll();
    change();
  });
  return b;
}
function transBlock(title, modeKey, durKey, change, outro, preview) {
  const head = document.createElement('p');
  head.className = 'viz-ovl-title';
  head.textContent = title;

  const seg = document.createElement('div');
   seg.className = 'fx-tiles';
  seg.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    if (seg.scrollWidth <= seg.clientWidth + 1) return;
    seg.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });
  TRANS_MODES.forEach((m) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'viz-chip fx-tile';
    const ic = document.createElement('i');
    ic.textContent = (TRANS_ICONS[m[0]] || '•') + '\uFE0E';
    const tx = document.createElement('span');
    tx.textContent = outro ? m[2] : m[1];
    b.append(ic, tx);
    b.addEventListener('click', () => {
      setEffects({ [modeKey]: m[0] });
      if (!(effects[durKey] > 0)) setEffects({ [durKey]: 1 });
      syncAll();
      change();
      preview(outro);
    });
    seg.append(b);
    modeChips.push({ key: modeKey, id: m[0], btn: b });
  });

  const row = document.createElement('label');
  row.className = 'viz-sl';
  const name = document.createElement('span');
  name.textContent = 'Длит.';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = '3';
  input.step = '0.1';
  const out = document.createElement('output');
  row.append(name, input, out);
  input.addEventListener('input', () => {
    setEffects({ [durKey]: Number(input.value) });
    fill(input);
    out.textContent = sec(effects[durKey]);
    change();
  });
  const editNum = () => {
    if (!window.matchMedia('(min-width: 1024px)').matches) return false;
    if (row.querySelector('.fx-num')) return true;
    const num = document.createElement('input');
    num.type = 'text';
    num.inputMode = 'decimal';
    num.className = 'fx-num';
    num.value = effects[durKey] > 0 ? effects[durKey].toFixed(1) : '0';
    let done = false;
    const finish = (apply) => {
      if (done) return;
      done = true;
      const v = parseFloat(num.value.replace(',', '.'));
      num.replaceWith(out);
      if (apply && isFinite(v)) {
        setEffects({ [durKey]: Math.min(3, Math.max(0, Math.round(v * 10) / 10)) });
        syncAll();
        change();
        if (effects[durKey] > 0) preview(outro);
      }
    };
    num.addEventListener('input', () => {
      num.value = num.value.replace(/[^0-9.,]/g, '');
    });
    num.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
    num.addEventListener('keyup', (e) => e.stopPropagation());
    num.addEventListener('blur', () => finish(true));
    out.replaceWith(num);
    num.focus();
    num.select();
    return true;
  };
  out.addEventListener('dblclick', editNum);
  input.addEventListener('dblclick', () => {
    if (editNum()) return;
    setEffects({ [durKey]: 0 });
    syncAll();
    change();
  });
  refs.push({ def: { k: durKey, fmt: sec }, input, out });
  input.addEventListener('change', () => {
    if (effects[durKey] > 0) preview(outro);
  });
  const revKey = modeKey === 'introMode' ? 'introRev' : 'outroRev';
  const rev = document.createElement('button');
  rev.type = 'button';
  rev.className = 'viz-chip fx-rev';
    rev.textContent = '⇄';
  rev.title = 'Проиграть эффект в обратную сторону';
  rev.addEventListener('click', () => {
    setEffects({ [revKey]: !effects[revKey] });
    if (!(effects[durKey] > 0)) setEffects({ [durKey]: 1 });
    syncAll();
    change();
    preview(outro);
  });
  modeChips.push({ key: revKey, id: true, btn: rev });

  const box = document.createElement('div');
  const line = document.createElement('div');
  line.className = 'fx-line';
  line.append(rev, makeReset(change), row);
  box.append(seg, line);
  return [box];
}
export function mountEffectsPanel(box, handlers = {}) {
  if (box.dataset.mounted) {
    syncAll();
    refreshThumbs();
    return;
  }
  box.dataset.mounted = '1';

  const change = () => {
    if (handlers.onChange) handlers.onChange();
  };
  const preview = (outro) => {
    if (handlers.onPreview) handlers.onPreview(outro ? 'out' : 'in');
  };
  const pane = document.createElement('div');
  pane.className = 'viz-pane';

  const hint = document.createElement('p');
  hint.className = 'viz-wave-hint';
  hint.textContent = 'Эффекты действуют на весь кадр и реагируют на бас музыки. Двойной клик по ползунку возвращает значение по умолчанию.';


  const fTitle = document.createElement('p');
  fTitle.className = 'viz-ovl-title';
  fTitle.textContent = 'Фильтр фото и видео';
  const fRow = document.createElement('div');
  fRow.className = 'fx-groups';
  const fTabs = document.createElement('div');
  fTabs.className = 'fx-tabs';
  const fTrack = document.createElement('div');
  fTrack.className = 'fx-track';
  const fRail = document.createElement('div');
  fRail.className = 'fx-rail';
  const fPrev = document.createElement('button');
  fPrev.type = 'button';
  fPrev.className = 'fx-arrow fx-arrow-l';
  fPrev.textContent = '‹';
  fPrev.setAttribute('aria-label', 'Назад');
  const fNext = document.createElement('button');
  fNext.type = 'button';
  fNext.className = 'fx-arrow fx-arrow-r';
  fNext.textContent = '›';
  fNext.setAttribute('aria-label', 'Вперёд');
  fRail.append(fTrack, fPrev, fNext);
  fRow.append(fTabs, fRail);
  const fTabBtns = [];
  let fGroup = '';
  BG_FILTERS.forEach((f) => {
    if (f.g && f.g !== fGroup) {
      fGroup = f.g;
      const g = fGroup;
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'fx-tab';
      tab.textContent = g;
      tab.addEventListener('click', () => fxShow(g, null));
      fTabs.append(tab);
      fTabBtns.push({ g, tab });
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fx-card';
    btn.style.setProperty('--c', f.c || '#6b6b76');
    const sw = document.createElement('i');
    sw.className = 'fx-sw';
    const nm = document.createElement('b');
    nm.className = 'fx-name';
    nm.textContent = f.name;
    const cv = document.createElement('canvas');
    cv.className = 'fx-pic';
    cv.width = 156;
    cv.height = 198;
    btn.append(sw, cv, nm);
    btn.addEventListener('click', () => {
      setEffects({ filter: f.id });
      syncAll();
      change();
    });
    fTrack.append(btn);
    filterChips.push({ id: f.id, btn, g: fGroup, cv });
  });

  // Показывает одну группу. card — карточка, которую нужно поставить в центр ленты.
  fxShow = (g, card) => {
    fTabBtns.forEach((x) => x.tab.classList.toggle('active', x.g === g));
    filterChips.forEach((c) => {
      c.btn.hidden = c.g !== g;
    });
    if (card && fTrack.clientWidth) {
      fTrack.scrollTo({ left: card.offsetLeft - (fTrack.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' });
    } else {
      fTrack.scrollLeft = 0;
    }
  };
  fxShow(BG_FILTERS[0].g, null);

  // Колёсико мыши листает ленту вбок, пока есть куда листать.
  fTrack.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const max = fTrack.scrollWidth - fTrack.clientWidth;
    const next = fTrack.scrollLeft + e.deltaY;
    if (max <= 0 || next < 0 || next > max) return;
    fTrack.scrollLeft = next;
    e.preventDefault();
  }, { passive: false });
    // Стрелки: серые у края, где листать уже некуда
  const railSync = () => {
    const max = fTrack.scrollWidth - fTrack.clientWidth;
    fPrev.disabled = fTrack.scrollLeft <= 2;
    fNext.disabled = fTrack.scrollLeft >= max - 2;
  };
  const baseShow = fxShow;
  fxShow = (g, card) => {
    baseShow(g, card);
    requestAnimationFrame(railSync);
  };
  fTrack.addEventListener('scroll', railSync);
  window.addEventListener('resize', railSync);
  requestAnimationFrame(railSync);
  fPrev.addEventListener('click', () => {
    fTrack.scrollBy({ left: -fTrack.clientWidth * 0.8, behavior: 'smooth' });
  });
  fNext.addEventListener('click', () => {
    fTrack.scrollBy({ left: fTrack.clientWidth * 0.8, behavior: 'smooth' });
  });

  // Перетаскивание мышью (на телефоне работает обычный свайп)
  let dragX = 0;
  let dragLeft = 0;
  let dragOn = false;
  let dragMoved = false;
  fTrack.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if (fTrack.scrollWidth <= fTrack.clientWidth + 1) return;
    dragOn = true;
    dragMoved = false;
    dragX = e.clientX;
    dragLeft = fTrack.scrollLeft;
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragOn) return;
    const dx = e.clientX - dragX;
    if (!dragMoved && Math.abs(dx) > 5) {
      dragMoved = true;
      fTrack.classList.add('drag');
    }
    if (dragMoved) fTrack.scrollLeft = dragLeft - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!dragOn) return;
    dragOn = false;
    fTrack.classList.remove('drag');
  });
  // после перетаскивания клик не должен выбирать фильтр под курсором
  fTrack.addEventListener('click', (e) => {
    if (!dragMoved) return;
    e.stopPropagation();
    e.preventDefault();
    dragMoved = false;
  }, true);
  const fRowAmt = document.createElement('label');
  fRowAmt.className = 'viz-sl';
  const fName = document.createElement('span');
  fName.textContent = 'Сила фильтра';
  const fInput = document.createElement('input');
  fInput.type = 'range';
  fInput.min = '0';
  fInput.max = '1';
  fInput.step = '0.01';
  const fOut = document.createElement('output');
  fRowAmt.append(fName, fInput, fOut);
  fInput.addEventListener('input', () => {
    setEffects({ filterAmt: Number(fInput.value) });
    fill(fInput);
    fOut.textContent = pct(effects.filterAmt);
    change();
  });
  fInput.addEventListener('dblclick', () => {
    setEffects({ filterAmt: EFFECT_DEFAULTS.filterAmt });
    syncAll();
    change();
  });
  refs.push({ def: { k: 'filterAmt', fmt: pct }, input: fInput, out: fOut });

  const fHint = document.createElement('p');
  fHint.className = 'viz-wave-hint';
  fHint.textContent = 'Фильтр красит только фото, видео и слайд-шоу на фоне. Волны, текст и стикеры не меняются.';

  const eTitle = document.createElement('p');
  eTitle.className = 'viz-ovl-title';
  eTitle.textContent = 'Эффекты кадра';

  const sep = document.createElement('div');
  sep.className = 'viz-hr';

  [fTitle, fRow, fRowAmt, fHint].forEach((el) => el.classList.add('fx-f'));
  sep.classList.add('fx-d-hide');
  [eTitle, hint].forEach((el) => el.classList.add('fx-s', 'fx-s-fx'));
  pane.append(fTitle, fRow, fRowAmt, fHint, sep, eTitle, hint);
  ITEMS.forEach((def) => {
    const row = document.createElement('label');
    row.className = 'viz-sl fx-s fx-s-fx';
    const name = document.createElement('span');
    name.textContent = def.label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(def.min);
    input.max = String(def.max);
    input.step = String(def.step);
    const out = document.createElement('output');
    row.append(name, input, out);
    pane.append(row);

    input.addEventListener('input', () => {
      setEffects({ [def.k]: Number(input.value) });
      fill(input);
      out.textContent = def.fmt(effects[def.k]);
      change();
    });

    input.addEventListener('dblclick', () => {
      setEffects({ [def.k]: EFFECT_DEFAULTS[def.k] });
      syncAll();
      change();
    });

    refs.push({ def, input, out });
  });
  const transSep = document.createElement('div');
  transSep.className = 'viz-hr';
  const inBlock = transBlock('Появление ролика', 'introMode', 'fadeIn', change, false, preview)[0];
  const outBlock = transBlock('Конец ролика', 'outroMode', 'fadeOut', change, true, preview)[0];
  const transTitle = document.createElement('p');
  transTitle.className = 'viz-ovl-title';
  transTitle.textContent = 'Начало и конец ролика';
  const sideSeg = document.createElement('div');
  sideSeg.className = 'viz-seg';
  const sideBtns = [];
  const showSide = (side) => {
    inBlock.hidden = side !== 'in';
    outBlock.hidden = side !== 'out';
    sideBtns.forEach((x) => x.btn.classList.toggle('active', x.side === side));
  };
  [['in', 'Начало'], ['out', 'Конец']].forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'viz-chip';
    b.textContent = s[1];
    b.addEventListener('click', () => showSide(s[0]));
    sideSeg.append(b);
    sideBtns.push({ side: s[0], btn: b });
  });
  showSide('in');
  transSep.classList.add('fx-d-hide');
  [transTitle, sideSeg, inBlock, outBlock].forEach((el) => el.classList.add('fx-s', 'fx-s-tr'));
  pane.append(transSep, transTitle, sideSeg, inBlock, outBlock);

  // ----- только компьютер: окно настроек эффектов (как у волн) -----
  const desk = () => window.matchMedia('(min-width: 1024px)').matches;
  box.dataset.set = 'fx';

  const setTabs = document.createElement('div');
  setTabs.className = 'viz-ptabs fx-s fx-desk';
  const setTabBtns = [];
  const setSide = (k) => {
    box.dataset.set = k;
    setTabBtns.forEach((x) => x.btn.classList.toggle('active', x.k === k));
    pane.scrollTop = 0;
  };
  [['fx', 'Эффекты'], ['tr', 'Начало и конец']].forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'viz-ptab';
    b.textContent = s[1];
    b.addEventListener('click', () => setSide(s[0]));
    setTabs.append(b);
    setTabBtns.push({ k: s[0], btn: b });
  });
  setSide('fx');

  const foot = document.createElement('div');
  foot.className = 'viz-panel-foot fx-s fx-desk';
  const footReset = document.createElement('button');
  footReset.type = 'button';
  footReset.className = 'viz-btn';
  footReset.textContent = 'Сбросить';
  footReset.addEventListener('click', () => {
    resetEffectSettings();
    syncAll();
    change();
  });
  const footDone = document.createElement('button');
  footDone.type = 'button';
  footDone.className = 'viz-btn viz-btn-primary';
  footDone.textContent = 'Готово';
  foot.append(footReset, footDone);

  fxBox = box;
  fxOpenFn = () => {
    if (!desk()) return;
    box.classList.add('fx-open');
    setSide('fx');
    syncAll();
  };
  fxCloseFn = () => {
    box.classList.remove('fx-open');
  };
  footDone.addEventListener('click', () => fxCloseFn());

  box.append(setTabs, pane, foot);
  syncAll();
  refreshThumbs();
}