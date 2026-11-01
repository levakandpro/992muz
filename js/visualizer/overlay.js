const FONT_DIR = '/assets/fonts/zmedia/';

const ZM = [
  ['Angry', 'Angry.otf'],
  ['AsiaAS Normal', 'AsiaAS-Normal.ttf'],
  ['AttackType', 'AttackType-Regular.otf'],
  ['Atziluth Script', 'Atziluth-Script_1.ttf'],
    ['Bardi OTF', 'Bardi-Regular.otf'],
  ['Bardi TTF', 'Bardi-Regular.ttf'],
  ['Betmo Regular Cyr', 'Betmo Regular Cyr.otf'],
  ['Bowler', 'Bowler.ttf'],
  ['BrillianCyrillicCnd Light', 'BrillianCyrillicCnd-Light.ttf'],
  ['BrillianCyrillicExpnd Medium', 'BrillianCyrillicExpnd-Medium.ttf'],
  ['CocoBiker Bold', 'CocoBiker Bold-trial.ttf'],
  ['CocoBiker Heavy', 'CocoBiker Heavy-trial.ttf'],
  ['CocoBiker Light', 'CocoBiker Light-trial.ttf'],
  ['CocoBiker Regular', 'CocoBiker Regular-trial.ttf'],
  ['CocoBiker Ultralight', 'CocoBiker Ultralight-trial.ttf'],
  ['Compacta LT Light Compress', 'Compacta LT Light Compress.otf'],
  ['Corvetta', 'Corvetta.otf'],
  ['DaMiOne', 'DaMiOne-Regular.ttf'],
  ['EternaBreaks', 'EternaBreaks-Regular_0.ttf'],
  ['Exterior Light', 'Exterior Light.otf'],
  ['Exterior Rough Light', 'Exterior Rough Light.otf'],
  ['Fluffyfont', 'fluffyfont.ttf'],
  ['Gothic60', 'Gothic60-Regular.otf'],
  ['Gropled Hollow', 'Gropled Hollow.otf'],
  ['Gropled Bold', 'Gropled-Bold.ttf'],
  ['Hummus', 'hummus.ttf'],
  ['Jaipur', 'jaipur.ttf'],
  ['Kosmos', 'Kosmos.otf'],
  ['Leporid Italic', 'Leporid-Italic.otf'],
  ['Leporid Regular', 'Leporid-Regular.otf'],
  ['LincolnElectric Over', 'LincolnElectric-Over.ttf'],
  ['LincolnElectric Regular', 'LincolnElectric-Regular.ttf'],
  ['LincolnElectric Under', 'LincolnElectric-Under.ttf'],
  ['Lucida CalligraphyC', 'Lucida Calligraphy\u0421.ttf'],
  ['Manasco', 'Manasco (sherbackoffalex).otf'],
  ['Mr Lonely', 'Mr_Lonely.otf'],
  ['Onmark TRIAL', 'Onmark TRIAL Regular.otf'],
  ['Roadkill Heavy', 'Roadkill Heavy Regular.otf'],
  ['Robofan', 'Robofan.ttf'],
  ['Schist Black', 'Schist Black.ttf'],
  ['Schist Bold', 'Schist Bold.ttf'],
  ['Schist Light', 'Schist Light.ttf'],
  ['Schist Regular', 'Schist Regular.ttf'],
  ['Serati Italic', 'Serati-Italic.otf'],
  ['Serati Regular', 'Serati-Regular.otf'],
  ['Sjz', 'Sjz.otf'],
  ['SKNigarRUS', 'SKNigarRUS.otf'],
    ['ST Warmovie OTF', 'ST-Warmovie-noncommercial.otf'],
  ['ST Warmovie TTF', 'ST-Warmovie-noncommercial.ttf'],
  ['TTDaysSans Black', 'TTDaysSans-Black.ttf'],
  ['TTDaysSans BlackItalic', 'TTDaysSans-BlackItalic.ttf'],
  ['TTDaysSans Bold', 'TTDaysSans-Bold.ttf'],
  ['TTDaysSans BoldItalic', 'TTDaysSans-BoldItalic.ttf'],
  ['UnifixSPDemo', 'UnifixSPDemo.otf'],
  ['Universal Antiqua Bold', 'Universal Antiqua Bold.ttf'],
  ['Universal Antiqua Italic', 'Universal Antiqua Italic.ttf'],
  ['Universal Antiqua Upright Italic', 'Universal Antiqua Upright Italic.ttf'],
    ['Universal Antiqua', 'Universal Antiqua.ttf'],
  ['Vyaz Pixel', 'Vyaz Pixel.ttf'],
  ['XPLOR Bold', 'XPLOR_Bold-Regular.otf']
];

export const FONTS = []
  .concat(['Unbounded', 'Bebas Neue', 'Oswald', 'JetBrains Mono'].map(function (n) {
    return { label: n, family: "'" + n + "', sans-serif", group: 'Google Fonts' };
  }))
  .concat(ZM.map(function (z) {
    return { label: z[0], family: "'ZM " + z[0] + "', sans-serif", group: 'Свои шрифты', file: z[1] };
  }));

const ADVISORY_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18];

export const STICKERS = {
  advisory: ADVISORY_NUMS.map(function (n) {
    return '/assets/images/advisory/' + encodeURIComponent('1 (' + n + ').png');
  }),
  rapiconz: Array.from({ length: 62 }, function (_, i) {
    return '/assets/images/rapiconz/' + encodeURIComponent('1 (' + (i + 1) + ').png');
  })
};

const layers = [];
let selectedId = null;
let seq = 0;
let onChange = function () {};
let notifyPending = false;

let fontVer = 0;

let forceShow = false;

export function setForceShow(v) { forceShow = !!v; }

// Рисует переданные слои один раз на чужом холсте (для превью шаблонов),
// не трогая настоящие слои и историю изменений.
export function renderPreview(ctx, list, time) {
  const keep = layers.slice();
  const keepSel = selectedId;
  const keepForce = forceShow;
  layers.length = 0;
  for (let i = 0; i < list.length; i++) layers.push(list[i]);
  forceShow = true;
  try {
    drawOverlay(ctx, null, time || 0);
  } finally {
    layers.length = 0;
    for (let i = 0; i < keep.length; i++) layers.push(keep[i]);
    selectedId = keepSel;
    forceShow = keepForce;
  }
}
function timeAlpha(l, time) {
  const a = l.tStart || 0;
  const b = l.tEnd || 0;
  if (time < a) return 0;
  if (b > 0 && time > b) return 0;
  let k = 1;
  const fi = l.fadeIn || 0;
  const fo = l.fadeOut || 0;
  if (fi > 0 && time - a < fi) k = Math.min(k, (time - a) / fi);
  if (fo > 0 && b > 0 && b - time < fo) k = Math.min(k, (b - time) / fo);
  return Math.max(0.001, k);
}
function notify() {
  fontVer++;
  if (notifyPending) return;
  notifyPending = true;
  requestAnimationFrame(function () {
    notifyPending = false;
    onChange();
  });
}

export function setOverlayChange(fn) { onChange = fn; }
let onFontFail = function () {};
export function setFontFail(fn) { onFontFail = fn; }
export function touch() { onChange(); }
export function getLayers() { return layers; }
export function getLayer(id) {
  for (let i = 0; i < layers.length; i++) if (layers[i].id === id) return layers[i];
  return null;
}
export function getSelected() { return getLayer(selectedId); }
export function select(id) { selectedId = id; }

// Группа = слои одного шаблона (у них одинаковый group).
// Пока gOpen не true, слои группы двигаются как одно целое.
export function groupMembers(l) {
  if (!l || !l.group || l.gOpen) return [l];
  const out = [];
  for (let i = 0; i < layers.length; i++) {
    if (layers[i].group === l.group) out.push(layers[i]);
  }
  return out;
}

export function isGlued(l) {
  return groupMembers(l).length > 1;
}

export function setGroupOpen(group, open) {
  for (let i = 0; i < layers.length; i++) {
    if (layers[i].group === group) layers[i].gOpen = !!open;
  }
  onChange();
}

// Общая рамка всех частей склеенной группы (для одного слоя совпадает с layerBounds).
export function groupBounds(ctx, l) {
  const list = groupMembers(l);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  list.forEach(function (m) {
    const b = layerBounds(ctx, m);
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  });
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
const TEST_RU = 'АЯабя';
const TEST_TJ = 'ғӣқӯҳҷ';

function hasGlyphs(name, chars) {
  const c = document.createElement('canvas').getContext('2d');
  const list = Array.from(chars);
  const widths = function (fam) {
    c.font = '48px ' + fam;
    return list.map(function (ch) { return c.measureText(ch).width; });
  };
  const mono = widths('monospace');
  const serif = widths('serif');
  const m2 = widths(name + ', monospace');
  const s2 = widths(name + ', serif');
  return list.every(function (_, i) { return m2[i] !== mono[i] || s2[i] !== serif[i]; });
}

export function checkFont(font) {
  if (font.cov) return Promise.resolve(font.cov);
  return Promise.resolve(loadFont(font)).then(function () {
    const name = font.file ? "'ZM " + font.label + "'" : "'" + font.label + "'";
    font.cov = { ru: hasGlyphs(name, TEST_RU), tj: hasGlyphs(name, TEST_TJ) };
    return font.cov;
  });
}

export function moveLayer(id, dir) {
  const i = layers.findIndex(function (x) { return x.id === id; });
  const j = i + dir;
  if (i < 0 || j < 0 || j >= layers.length) return;
  const t = layers[i];
  layers[i] = layers[j];
  layers[j] = t;
  onChange();
}

const hist = [{ key: '[]', layers: [], sel: null }];
let histPos = 0;
let histTimer = 0;
let onHist = function () {};

export function setHistChange(fn) { onHist = fn; }

function histKey() {
  return JSON.stringify(layers.map(function (l) {
    const c = Object.assign({}, l);
    if (c.img) c.img = c.img.src;
    return c;
  }));
}

function histCommit() {
  histTimer = 0;
  const key = histKey();
  if (hist[histPos].key === key) return;
  hist.length = histPos + 1;
  hist.push({
    key: key,
    layers: layers.map(function (l) { return Object.assign({}, l); }),
    sel: selectedId
  });
  if (hist.length > 80) hist.shift();
  histPos = hist.length - 1;
  onHist();
}

export function histSchedule() {
  clearTimeout(histTimer);
  histTimer = setTimeout(histCommit, 350);
}

function histRestore(entry) {
  layers.length = 0;
  entry.layers.forEach(function (l) { layers.push(Object.assign({}, l)); });
  selectedId = getLayer(entry.sel) ? entry.sel : null;
  onChange();
  onHist();
}

export function canUndo() { return histPos > 0 || !!histTimer; }
export function canRedo() { return histPos < hist.length - 1; }

export function undo() {
  if (histTimer) {
    clearTimeout(histTimer);
    histCommit();
  }
  if (histPos <= 0) return false;
  histPos--;
  histRestore(hist[histPos]);
  return true;
}

export function redo() {
  if (histPos >= hist.length - 1) return false;
  histPos++;
  histRestore(hist[histPos]);
  return true;
}
const loadedFonts = {};

export function loadFont(font) {
  if (!font.file) {
    if (document.fonts && document.fonts.load) {
           return document.fonts.load('40px ' + font.family, 'АаӢӣҒғ').then(notify, function () {});
    }
    return Promise.resolve();
  }
  if (loadedFonts[font.family]) return loadedFonts[font.family];
  const url = FONT_DIR + encodeURIComponent(font.file);
  const face = new FontFace('ZM ' + font.label, 'url("' + url + '")');
  const p = face.load().then(function (f) {
    document.fonts.add(f);
    notify();
  }).catch(function (err) {
    delete loadedFonts[font.family];
    console.warn('Шрифт не загрузился:', font.label, url, err);
    onFontFail(font.label, url);
  });
  loadedFonts[font.family] = p;
  return p;
}
export function addText(font) {
  loadFont(font);
  const l = {
    id: ++seq,
    type: 'text',
    text: 'Текст',
    font: font.family,
      fontLabel: font.label,
    italic: false,
    underline: false,
    strike: false,
    caps: false,
    color: '#ffffff',
        size: 0.09,
    letterSp: 0,
    lineH: 1.2,
    align: 'center',
    gradient: false,
    gradColor2: '#ff2fd0',
    gradAngle: 90,
    anim: 'none',
    animPower: 0.6,
    x: 0.5,
    y: 0.25,
    opacity: 1,
    bold: false,
    outline: false,
    outlineColor: '#000000',
    outlineWidth: 0.12,
    shadow: true,
    shadowColor: '#000000',
    shadowAlpha: 0.8,
    shadowBlur: 0.15,
    shadowX: 0,
    shadowDist: 0.04,
    shadow2: false,
    shadow2Color: '#00e5ff',
    shadow2Alpha: 1,
    shadow2Blur: 0.4,
    shadow2X: 0,
    shadow2Y: 0,
    neon: false,
    neonColor: '#ff2fd0',
    neonSize: 0.5,
       neonLayers: 3,
    neonTube: 0.06,
    long: false,
    longColor: '#000000',
    longLen: 0.6,
       longAngle: 45,
    inner: false,
    innerColor: '#000000',
    innerAlpha: 0.9,
    innerBlur: 0.12,
    innerX: 0,
    innerY: 0.05
  };
  layers.push(l);
  selectedId = l.id;
  onChange();
  return l;
}

export function addSticker(url) {
  return new Promise(function (resolve) {
    const img = new Image();
    img.onload = function () {
          const l = { id: ++seq, type: 'image', img: img, size: 0.3, x: 0.5, y: 0.28, opacity: 1 };
      layers.push(l);
      selectedId = l.id;
      onChange();
      resolve(l);
    };
    img.onerror = function () { resolve(null); };
    img.src = url;
  });
}

export function removeLayer(id) {
  for (let i = 0; i < layers.length; i++) {
    if (layers[i].id === id) { layers.splice(i, 1); break; }
  }
  fxCache.delete(id);
  if (selectedId === id) selectedId = null;
  onChange();
}
// Слои для сохранения проекта. Свои картинки (blob:) сохранить нельзя, они считаются в skipped.
export function exportLayers() {
  const out = [];
  let skipped = 0;
  layers.forEach(function (l) {
    const c = Object.assign({}, l);
    if (l.type === 'image') {
      const src = l.img ? l.img.src : '';
      if (!src || src.indexOf('blob:') === 0 || src.indexOf('data:') === 0) {
        skipped++;
        return;
      }
      c.img = src.indexOf(location.origin) === 0 ? src.slice(location.origin.length) : src;
    }
    out.push(c);
  });
  return { list: out, skipped: skipped };
}

// Заменяет все слои слоями из проекта. Новые id, группы шаблонов не пересекаются с новыми.
export function importLayers(list) {
  const jobs = list.map(function (src) {
    if (!src || typeof src !== 'object') return Promise.resolve(null);
    const l = Object.assign({}, src);
    if (l.type === 'text') return Promise.resolve(l);
    if (l.type === 'image' && typeof l.img === 'string') {
      return new Promise(function (resolve) {
        const img = new Image();
        img.onload = function () { l.img = img; resolve(l); };
        img.onerror = function () { resolve(null); };
        img.src = l.img;
      });
    }
    return Promise.resolve(null);
  });
  return Promise.all(jobs).then(function (done) {
    const ok = done.filter(Boolean);
    layers.length = 0;
    fxCache.clear();
    ok.forEach(function (l) {
      l.id = ++seq;
      if (l.group) l.group = 1000000 + (l.group % 1000000);
      layers.push(l);
      if (l.type === 'text') {
        const f = FONTS.find(function (x) { return x.family === l.font; });
        if (f) loadFont(f);
      }
    });
    selectedId = null;
    onChange();
    return { loaded: ok.length, failed: list.length - ok.length };
  });
}
export function duplicateLayer(id) {
  const src = getLayer(id);
  if (!src) return null;
  const copy = Object.assign({}, src, {
    id: ++seq,
    group: 0,
    gOpen: false,
    x: Math.min(0.95, src.x + 0.05),
    y: Math.min(0.95, src.y + 0.04)
  });
  layers.push(copy);
  selectedId = copy.id;
  onChange();
  return copy;
}
export function resetTextStyle(id) {
  const l = getLayer(id);
  if (!l || l.type !== 'text') return;
  Object.assign(l, {
    italic: false,
    underline: false,
    strike: false,
    caps: false,
    color: '#ffffff',
    opacity: 1,
    bold: false,
    outline: false,
    outlineColor: '#000000',
    outlineWidth: 0.12,
    shadow: true,
    shadowColor: '#000000',
    shadowAlpha: 0.8,
    shadowBlur: 0.15,
    shadowX: 0,
    shadowDist: 0.04,
    shadow2: false,
    shadow2Color: '#00e5ff',
    shadow2Alpha: 1,
    shadow2Blur: 0.4,
    shadow2X: 0,
    shadow2Y: 0,
      neon: false,
    letterSp: 0,
    lineH: 1.2,
    align: 'center',
    gradient: false,
    gradColor2: '#ff2fd0',
    gradAngle: 90,
    anim: 'none',
    animPower: 0.6,
    plate: false,
    plateColor: '#000000',
    plateAlpha: 0.7,
    plateShape: 'rect',
    plateRadius: 0.3,
    platePadX: 0.25,
    platePadY: 0.25,
    plateX: 0,
    plateY: 0,
    plateSkew: 0,
    plateEach: false,
    plateGrad: false,
    plateColor2: '#7c3aed',
    plateGradAngle: 90,
    plateBorder: false,
    plateBorderColor: '#ffffff',
    plateBorderW: 0.05,
    plateShadow: false,
    plateShadowColor: '#000000',
    plateShadowAlpha: 0.6,
    plateShadowBlur: 0.3,
    plateShadowDist: 0.12,
    plateGlass: false,
    plateGlassBlur: 0.5,
    curve: 0,
    ext: false,
    extColor: '#7c3aed',
    extDepth: 0.25,
    extAngle: 45,
    bevel: false,
    bevelSize: 0.5,
    bevelAlpha: 0.7,
    gloss: false,
    glossSize: 0.5,
    glossAlpha: 0.6,
    long: false,
    longColor: '#000000',
    longLen: 0.6,
    longAngle: 45,
    inner: false,
    innerColor: '#000000',
    innerAlpha: 0.9,
    innerBlur: 0.12,
    innerX: 0,
    innerY: 0.05
  });
  onChange();
}
export function resetShadow(id, which) {
  const l = getLayer(id);
  if (!l || l.type !== 'text') return;
  if (which === 2) {
    Object.assign(l, {
      shadow2: false,
      shadow2Color: '#00e5ff',
      shadow2Alpha: 1,
      shadow2Blur: 0.4,
      shadow2X: 0,
      shadow2Y: 0
    });
  } else if (which === 3) {
    Object.assign(l, {
      inner: false,
      innerColor: '#000000',
      innerAlpha: 0.9,
      innerBlur: 0.12,
      innerX: 0,
      innerY: 0.05
    });
  } else {
    Object.assign(l, {
      shadow: true,
      shadowColor: '#000000',
      shadowAlpha: 0.8,
      shadowBlur: 0.15,
      shadowX: 0,
      shadowDist: 0.04
    });
  }
  onChange();
}
export function resetEffect(id, which) {
  const l = getLayer(id);
  if (!l || l.type !== 'text') return;
  if (which === 'outline') {
    Object.assign(l, { outline: false, outlineColor: '#000000', outlineWidth: 0.12 });
  } else if (which === 'long') {
    Object.assign(l, { long: false, longColor: '#000000', longLen: 0.6, longAngle: 45 });
  } else if (which === 'plate') {
    Object.assign(l, {
      plate: false,
      plateColor: '#000000',
      plateAlpha: 0.7,
      plateShape: 'rect',
      plateRadius: 0.3,
      platePadX: 0.25,
      platePadY: 0.25,
      plateX: 0,
      plateY: 0,
      plateSkew: 0,
      plateEach: false,
      plateGrad: false,
      plateColor2: '#7c3aed',
      plateGradAngle: 90,
      plateBorder: false,
      plateBorderColor: '#ffffff',
      plateBorderW: 0.05,
      plateShadow: false,
      plateShadowColor: '#000000',
      plateShadowAlpha: 0.6,
      plateShadowBlur: 0.3,
      plateShadowDist: 0.12,
      plateGlass: false,
      plateGlassBlur: 0.5
    });
  } else if (which === 'curve') {
    Object.assign(l, { curve: 0 });
  } else if (which === 'ext') {
    Object.assign(l, { ext: false, extColor: '#7c3aed', extDepth: 0.25, extAngle: 45 });
  } else if (which === 'bevel') {
    Object.assign(l, { bevel: false, bevelSize: 0.5, bevelAlpha: 0.7 });
  } else if (which === 'gloss') {
    Object.assign(l, { gloss: false, glossSize: 0.5, glossAlpha: 0.6 });
  }
  onChange();
}
function hexRgba(hex, a) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) h = '000000';
  return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
}
function fontStr(l, px) {
   return (l.italic ? 'italic ' : '') + (l.bold ? '800 ' : '400 ') + px + 'px ' + l.font;
}
function setSpacing(g, l, px) {
  if ('letterSpacing' in g) g.letterSpacing = ((l.letterSp || 0) * px) + 'px';
}
function textMetrics(ctx, l) {
  const px = l.size * ctx.canvas.width;
  ctx.save();
   ctx.font = fontStr(l, px);
  setSpacing(ctx, l, px);
   const src = String(l.text || ' ');
  const lines = (l.caps ? src.toUpperCase() : src).split('\n');
  let w = 0;
    const ws = [];
  lines.forEach(function (t) {
    const lw = ctx.measureText(t).width;
    ws.push(lw);
    w = Math.max(w, lw);
  });
  ctx.restore();
  const lh = px * (l.lineH == null ? 1.2 : l.lineH);
  return { px: px, lines: lines, ws: ws, w: w, lh: lh, h: lh * lines.length };
}

export function layerBounds(ctx, l) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  let w;
  let h;
  if (l.type === 'image') {
    w = l.size * W;
    h = w * l.img.height / l.img.width;
    w *= Math.max(0.05, 1 - (l.cropL || 0) - (l.cropR || 0));
    h *= Math.max(0.05, 1 - (l.cropT || 0) - (l.cropB || 0));
  } else {
    const m = textMetrics(ctx, l);
    w = m.w;
    h = m.h;
  }
  return { x: l.x * W - w / 2, y: l.y * H - h / 2, w: w, h: h };
}

export function hitTest(ctx, px, py) {
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    if (l.hidden) continue;
    const b = layerBounds(ctx, l);
    let x = px;
    let y = py;
    if (l.rot) {
      const a = (-l.rot * Math.PI) / 180;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const dx = px - cx;
      const dy = py - cy;
      x = cx + dx * Math.cos(a) - dy * Math.sin(a);
      y = cy + dx * Math.sin(a) + dy * Math.cos(a);
    }
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return l;
  }
  return null;
}
function clearShadow(g) {
  g.shadowColor = 'rgba(0,0,0,0)';
  g.shadowBlur = 0;
  g.shadowOffsetX = 0;
  g.shadowOffsetY = 0;
}

function setShadow(g, color, alpha, blur, ox, oy) {
  g.shadowColor = hexRgba(color, alpha);
  g.shadowBlur = blur;
  g.shadowOffsetX = ox;
  g.shadowOffsetY = oy;
}

function paintShape(g, l, px, t, cx, y, fill) {
  if (l.outline) {
    g.lineWidth = Math.max(2, px * l.outlineWidth);
    g.strokeStyle = l.outlineColor;
    g.strokeText(t, cx, y);
  }
   g.fillStyle = curFill || fill;
  g.fillText(t, cx, y);
}

function drawTextLine(g, l, px, t, cx, y) {
  clearShadow(g);

  if (l.long) {
    const len = px * (l.longLen == null ? 0.6 : l.longLen);
    const steps = Math.max(2, Math.min(120, Math.ceil(len / 2)));
    const a = ((l.longAngle == null ? 45 : l.longAngle) * Math.PI) / 180;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    g.fillStyle = l.longColor || '#000000';
    for (let k = steps; k >= 1; k--) {
      const d = (len * k) / steps;
      g.fillText(t, cx + dx * d, y + dy * d);
    }
  }

  if (l.neon) {
    const sets = { 1: [1], 2: [0.4, 1], 3: [0.2, 0.55, 1] }[l.neonLayers || 3];
    const base = px * (l.neonSize == null ? 0.5 : l.neonSize);
    const tube = Math.max(2, px * (l.neonTube == null ? 0.06 : l.neonTube));
    g.lineWidth = tube * 2;
    g.strokeStyle = l.neonColor;
    g.fillStyle = l.neonColor;
    sets.forEach(function (f) {
      setShadow(g, l.neonColor, 1, base * f, 0, 0);
      g.strokeText(t, cx, y);
      g.fillText(t, cx, y);
    });
    clearShadow(g);
    g.strokeText(t, cx, y);
    g.fillStyle = '#ffffff';
    g.fillText(t, cx, y);
    return;
  }

  if (l.shadow) {
    setShadow(g, l.shadowColor, l.shadowAlpha == null ? 0.8 : l.shadowAlpha, px * l.shadowBlur, px * (l.shadowX || 0), px * l.shadowDist);
    paintShape(g, l, px, t, cx, y, l.color);
  }

  if (l.shadow2) {
    setShadow(g, l.shadow2Color, l.shadow2Alpha == null ? 1 : l.shadow2Alpha, px * l.shadow2Blur, px * (l.shadow2X || 0), px * (l.shadow2Y || 0));
    paintShape(g, l, px, t, cx, y, l.color);
  }

  clearShadow(g);
  paintShape(g, l, px, t, cx, y, l.color);
}
let fxCanvas = null;
const fxCache = new Map();

function fxKey(l, W, H) {
  return W + 'x' + H + '|' + fontVer + '|' + JSON.stringify(l);
}
let fxCtx = null;
let hoCanvas = null;
let hoCtx = null;
let inCanvas = null;
let inCtx = null;

function drawInnerShadow(g, l, px, t, cx, y) {
  if (!l.inner) return;
  if (!hoCanvas) {
    hoCanvas = document.createElement('canvas');
    hoCtx = hoCanvas.getContext('2d');
    inCanvas = document.createElement('canvas');
    inCtx = inCanvas.getContext('2d');
  }

  const blur = px * (l.innerBlur == null ? 0.12 : l.innerBlur);
  const ox = px * (l.innerX || 0);
  const oy = px * (l.innerY == null ? 0.05 : l.innerY);
  const pad = Math.ceil(blur * 2 + Math.abs(ox) + Math.abs(oy) + px * 0.2 + 4);
  const bw = Math.max(2, Math.ceil(g.measureText(t).width + pad * 2));
  const bh = Math.max(2, Math.ceil(px * 1.2 + pad * 2));
  const font = g.font;
  const OFF = bw + 200;

  if (hoCanvas.width !== bw || hoCanvas.height !== bh) {
    hoCanvas.width = bw;
    hoCanvas.height = bh;
    inCanvas.width = bw;
    inCanvas.height = bh;
  }

  const H = hoCtx;
  H.setTransform(1, 0, 0, 1, 0, 0);
  H.globalAlpha = 1;
  H.globalCompositeOperation = 'source-over';
  clearShadow(H);
  H.clearRect(0, 0, bw, bh);
  H.fillStyle = '#000000';
  H.fillRect(0, 0, bw, bh);
  H.globalCompositeOperation = 'destination-out';
    H.font = font;
  if ('letterSpacing' in H) H.letterSpacing = g.letterSpacing;
  H.textAlign = 'center';
  H.textBaseline = 'middle';
  H.lineJoin = 'round';
  H.fillText(t, bw / 2, bh / 2);
  H.globalCompositeOperation = 'source-over';

  const I = inCtx;
  I.setTransform(1, 0, 0, 1, 0, 0);
  I.globalAlpha = 1;
  I.globalCompositeOperation = 'source-over';
  I.clearRect(0, 0, bw, bh);
  setShadow(I, l.innerColor, l.innerAlpha == null ? 0.9 : l.innerAlpha, blur, OFF + ox, oy);
  I.drawImage(hoCanvas, -OFF, 0);
  clearShadow(I);
  I.globalCompositeOperation = 'destination-in';
    I.font = font;
  if ('letterSpacing' in I) I.letterSpacing = g.letterSpacing;
  I.textAlign = 'center';
  I.textBaseline = 'middle';
  I.lineJoin = 'round';
  I.fillStyle = '#000000';
  I.fillText(t, bw / 2, bh / 2);
  I.globalCompositeOperation = 'source-over';

  g.drawImage(inCanvas, cx - bw / 2, y - bh / 2);
}
function drawDecor(g, l, px, t, cx, y) {
  if (!l.underline && !l.strike) return;
  if (l.curve) return;
  const w = g.measureText(t).width;
  const th = Math.max(2, px * 0.06);
   g.fillStyle = curFill || l.color;
  if (l.underline) g.fillRect(cx - w / 2, y + px * 0.36, w, th);
  if (l.strike) g.fillRect(cx - w / 2, y + px * 0.04 - th / 2, w, th);
}
let curFill = null;

function makeFill(g, l, m, cx, top) {
  if (!l.gradient) return null;
  const a = ((l.gradAngle == null ? 90 : l.gradAngle) * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const my = top + m.h / 2;
  const r = (Math.abs(dx) * m.w + Math.abs(dy) * m.h) / 2;
  const gr = g.createLinearGradient(cx - dx * r, my - dy * r, cx + dx * r, my + dy * r);
  gr.addColorStop(0, l.color);
  gr.addColorStop(1, l.gradColor2 || '#ff2fd0');
  return gr;
}
function mixHex(a, b, t) {
  const p = function (h) {
    let s = String(h || '').replace('#', '');
    if (s.length === 3) s = s.split('').map(function (c) { return c + c; }).join('');
    if (!/^[0-9a-f]{6}$/i.test(s)) s = '000000';
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  };
  const x = p(a);
  const y = p(b);
  return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' + Math.round(x[1] + (y[1] - x[1]) * t) + ',' + Math.round(x[2] + (y[2] - x[2]) * t) + ')';
}

function drawCurvedLine(g, l, m, t, cx, y) {
  const chars = Array.from(t);
  if (!chars.length) return;
  const widths = chars.map(function (ch) { return g.measureText(ch).width; });
  const total = widths.reduce(function (a, b) { return a + b; }, 0);
  const k = l.curve > 0 ? 1 : -1;
  const r = Math.max(m.px * 0.5, total / (Math.abs(l.curve) * Math.PI * 1.5));
  let acc = 0;
  chars.forEach(function (ch, i) {
    const s = acc + widths[i] / 2 - total / 2;
    acc += widths[i];
    const phi = s / r;
    const px = cx + r * Math.sin(phi);
    const py = y + k * r * (1 - Math.cos(phi));
    const saved = curFill;
    if (l.gradient) curFill = mixHex(l.color, l.gradColor2 || '#ff2fd0', total ? (acc - widths[i] / 2) / total : 0);
    g.save();
    g.translate(px, py);
    g.rotate(k * phi);
    drawTextLine(g, l, m.px, ch, 0, 0);
    g.restore();
    curFill = saved;
  });
}
function drawExtrude(g, l, px, t, cx, y) {
  if (!l.ext) return;
  const len = px * (l.extDepth == null ? 0.25 : l.extDepth);
  const steps = Math.max(2, Math.min(80, Math.ceil(len / 1.5)));
  const a = ((l.extAngle == null ? 45 : l.extAngle) * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const base = l.extColor || '#7c3aed';
  const light = mixHex(base, '#ffffff', 0.45);
  const dark = mixHex(base, '#000000', 0.75);
  clearShadow(g);
  g.lineJoin = 'round';
  g.lineWidth = Math.max(2, px * 0.03);
  for (let k = steps; k >= 1; k--) {
    const f = k / steps;
    const c = f < 0.2 ? mixHex(light, base, f / 0.2) : mixHex(base, dark, (f - 0.2) / 0.8);
    g.fillStyle = c;
    g.strokeStyle = c;
    g.strokeText(t, cx + dx * len * f, y + dy * len * f);
    g.fillText(t, cx + dx * len * f, y + dy * len * f);
  }
  g.strokeStyle = dark;
  g.lineWidth = Math.max(2, px * 0.07);
  g.strokeText(t, cx, y);
}
function drawBevel(g, l, px, t, cx, y) {
  if (!l.bevel) return;
  const s = l.bevelSize == null ? 0.5 : l.bevelSize;
  const a = Math.min(1, (l.bevelAlpha == null ? 0.7 : l.bevelAlpha) * 1.4);
  const d = 0.06 + 0.12 * s;
  const b = 0.02 + 0.06 * s;
  drawInnerShadow(g, { inner: true, innerColor: '#ffffff', innerAlpha: a, innerBlur: b, innerX: d, innerY: d }, px, t, cx, y);
  drawInnerShadow(g, { inner: true, innerColor: '#000000', innerAlpha: a, innerBlur: b, innerX: -d, innerY: -d }, px, t, cx, y);
}

let glCanvas = null;
let glCtx = null;

function drawGloss(g, l, px, t, cx, y) {
  if (!l.gloss) return;
  if (!glCanvas) {
    glCanvas = document.createElement('canvas');
    glCtx = glCanvas.getContext('2d');
  }
  const bw = Math.max(2, Math.ceil(g.measureText(t).width + px * 0.4));
  const bh = Math.max(2, Math.ceil(px * 1.4));
  if (glCanvas.width !== bw || glCanvas.height !== bh) {
    glCanvas.width = bw;
    glCanvas.height = bh;
  }
  const G = glCtx;
  G.setTransform(1, 0, 0, 1, 0, 0);
  G.globalAlpha = 1;
  G.globalCompositeOperation = 'source-over';
  clearShadow(G);
  G.clearRect(0, 0, bw, bh);
  G.font = g.font;
  if ('letterSpacing' in G) G.letterSpacing = g.letterSpacing;
  G.textAlign = 'center';
  G.textBaseline = 'middle';
  G.fillStyle = '#000000';
  G.fillText(t, bw / 2, bh / 2);
  G.globalCompositeOperation = 'source-in';
  const h = l.glossSize == null ? 0.5 : l.glossSize;
  const al = l.glossAlpha == null ? 0.6 : l.glossAlpha;
  const gTop = bh / 2 - px * 0.5;
  const gr = G.createLinearGradient(0, gTop, 0, gTop + px * h);
  gr.addColorStop(0, 'rgba(255,255,255,' + al + ')');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  G.fillStyle = gr;
  G.fillRect(0, 0, bw, bh);
  G.globalCompositeOperation = 'source-over';
  g.drawImage(glCanvas, cx - bw / 2, y - bh / 2);
}
function plateGeom(l, m, cxBase, top) {
  const padX = m.px * (l.platePadX == null ? 0.25 : l.platePadX);
  const padY = m.px * (l.platePadY == null ? 0.25 : l.platePadY);
  const ox = m.px * (l.plateX || 0);
  const oy = m.px * (l.plateY || 0);
  const rects = [];
  if (l.plateEach) {
    const ids = [];
    m.lines.forEach(function (t, i) {
      if (String(t).trim()) ids.push(i);
    });
    ids.forEach(function (i, n) {
      const cx = l.align === 'left' ? cxBase - m.w / 2 + m.ws[i] / 2 : l.align === 'right' ? cxBase + m.w / 2 - m.ws[i] / 2 : cxBase;
      const ya = top + m.lh * i - (n === 0 ? padY : 0);
      const yb = top + m.lh * (i + 1) + (n === ids.length - 1 ? padY : 0);
      rects.push({ x: cx - m.ws[i] / 2 - padX + ox, y: ya + oy, w: m.ws[i] + padX * 2, h: yb - ya });
    });
  } else {
    rects.push({ x: cxBase - m.w / 2 - padX + ox, y: top - padY + oy, w: m.w + padX * 2, h: m.h + padY * 2 });
  }
  if (!rects.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  rects.forEach(function (r) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  });
  return {
    rects: rects,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w: maxX - minX,
    h: maxY - minY,
    rad: m.px * (l.plateRadius == null ? 0.3 : l.plateRadius),
    skew: Math.tan(((l.plateSkew || 0) * Math.PI) / 180)
  };
}

function tracePlate(g, l, geom) {
  const shape = l.plateShape || 'rect';
  g.save();
  g.translate(geom.cx, geom.cy);
  g.transform(1, 0, geom.skew, 1, 0, 0);
  g.translate(-geom.cx, -geom.cy);
  g.beginPath();
  geom.rects.forEach(function (r) {
    const rad = shape === 'pill' ? Math.min(r.w, r.h) / 2 : Math.min(geom.rad, r.w / 2, r.h / 2);
    if (shape === 'cut') {
      g.moveTo(r.x + rad, r.y);
      g.lineTo(r.x + r.w - rad, r.y);
      g.lineTo(r.x + r.w, r.y + rad);
      g.lineTo(r.x + r.w, r.y + r.h - rad);
      g.lineTo(r.x + r.w - rad, r.y + r.h);
      g.lineTo(r.x + rad, r.y + r.h);
      g.lineTo(r.x, r.y + r.h - rad);
      g.lineTo(r.x, r.y + rad);
      g.closePath();
    } else if (typeof g.roundRect === 'function') {
      g.roundRect(r.x, r.y, r.w, r.h, rad);
    } else {
      g.rect(r.x, r.y, r.w, r.h);
    }
  });
  g.restore();
}

let plCanvas = null;
let plCtx = null;

function drawPlate(g, l, m, cxBase, top) {
  const geom = plateGeom(l, m, cxBase, top);
  if (!geom) return;
  const W = g.canvas.width;
  const H = g.canvas.height;
  const alpha = l.plateAlpha == null ? 0.7 : l.plateAlpha;
  const c1 = l.plateColor || '#000000';
  let fill = hexRgba(c1, alpha);
  if (l.plateGrad) {
    const a = ((l.plateGradAngle == null ? 90 : l.plateGradAngle) * Math.PI) / 180;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const r = (Math.abs(dx) * geom.w + Math.abs(dy) * geom.h) / 2;
    fill = g.createLinearGradient(geom.cx - dx * r, geom.cy - dy * r, geom.cx + dx * r, geom.cy + dy * r);
    fill.addColorStop(0, hexRgba(c1, alpha));
    fill.addColorStop(1, hexRgba(l.plateColor2 || '#7c3aed', alpha));
  }

  clearShadow(g);
  tracePlate(g, l, geom);

  if (l.plateShadow) {
    setShadow(
      g,
      l.plateShadowColor || '#000000',
      l.plateShadowAlpha == null ? 0.6 : l.plateShadowAlpha,
      m.px * (l.plateShadowBlur == null ? 0.3 : l.plateShadowBlur),
      0,
      m.px * (l.plateShadowDist == null ? 0.12 : l.plateShadowDist)
    );
    g.fillStyle = '#000000';
    g.fill();
    clearShadow(g);
    g.globalCompositeOperation = 'destination-out';
    g.fill();
    g.globalCompositeOperation = 'source-over';
  }

  g.fillStyle = fill;
  g.fill();

  if (l.plateBorder) {
    const bw = Math.max(1, m.px * (l.plateBorderW == null ? 0.05 : l.plateBorderW));
    if (!plCanvas) {
      plCanvas = document.createElement('canvas');
      plCtx = plCanvas.getContext('2d');
    }
    if (plCanvas.width !== W || plCanvas.height !== H) {
      plCanvas.width = W;
      plCanvas.height = H;
    }
    const P = plCtx;
    P.setTransform(1, 0, 0, 1, 0, 0);
    P.globalAlpha = 1;
    P.globalCompositeOperation = 'source-over';
    P.clearRect(0, 0, W, H);
    tracePlate(P, l, geom);
    P.lineJoin = 'round';
    P.lineWidth = bw * 2;
    P.strokeStyle = l.plateBorderColor || '#ffffff';
    P.stroke();
    P.globalCompositeOperation = 'destination-out';
    P.fillStyle = '#000000';
    P.fill();
    P.globalCompositeOperation = 'source-over';
    g.drawImage(plCanvas, 0, 0);
  }
}

const glassLv = [];

function glassLevel(k, W, H) {
  let c = glassLv[k];
  if (!c) {
    c = document.createElement('canvas');
    c.gctx = c.getContext('2d');
    glassLv[k] = c;
  }
  const s = Math.pow(2, k);
  const w = Math.max(2, Math.ceil(W / s));
  const h = Math.max(2, Math.ceil(H / s));
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c;
}

function drawGlass(ctx, l, m, cx, top) {
  if (!l.plate || !l.plateGlass) return;
  const geom = plateGeom(l, m, cx, top);
  if (!geom) return;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const lv = Math.max(1, Math.min(5, Math.round(1 + 4 * (l.plateGlassBlur == null ? 0.5 : l.plateGlassBlur))));
  let src = ctx.canvas;
  for (let k = 1; k <= lv; k++) {
    const c = glassLevel(k, W, H);
    c.gctx.drawImage(src, 0, 0, c.width, c.height);
    src = c;
  }
  for (let k = lv - 1; k >= 1; k--) {
    const c = glassLevel(k, W, H);
    c.gctx.drawImage(src, 0, 0, c.width, c.height);
    src = c;
  }
  ctx.save();
  tracePlate(ctx, l, geom);
  ctx.clip();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.shadowBlur = 0;
  ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, W, H);
  ctx.restore();
}
function drawTextFx(ctx, l, m, cxBase, top) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  if (!fxCanvas) {
    fxCanvas = document.createElement('canvas');
    fxCtx = fxCanvas.getContext('2d');
  }
  if (fxCanvas.width !== W || fxCanvas.height !== H) {
    fxCanvas.width = W;
    fxCanvas.height = H;
  }
   const key = fxKey(l, W, H);
  let hit = fxCache.get(l.id);
  if (hit && hit.key === key) {
    ctx.drawImage(hit.canvas, 0, 0);
    return;
  }
  if (!hit) {
    hit = { key: '', canvas: document.createElement('canvas') };
    fxCache.set(l.id, hit);
  }
  if (hit.canvas.width !== W || hit.canvas.height !== H) {
    hit.canvas.width = W;
    hit.canvas.height = H;
  }
  hit.key = key;
  const g = hit.canvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
    g.font = fontStr(l, m.px);
  setSpacing(g, l, m.px);
  curFill = makeFill(g, l, m, cxBase, top);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
    if (l.plate) {
    drawPlate(g, l, m, cxBase, top);
  }
    m.lines.forEach(function (t, i) {
    const cx = l.align === 'left' ? cxBase - m.w / 2 + m.ws[i] / 2 : l.align === 'right' ? cxBase + m.w / 2 - m.ws[i] / 2 : cxBase;
    const y = top + m.lh * i + m.lh / 2;
    if (l.curve) {
      drawCurvedLine(g, l, m, t, cx, y);
    } else {
      drawExtrude(g, l, m.px, t, cx, y);
      drawTextLine(g, l, m.px, t, cx, y);
      drawInnerShadow(g, l, m.px, t, cx, y);
      drawBevel(g, l, m.px, t, cx, y);
      drawGloss(g, l, m.px, t, cx, y);
    }
        drawDecor(g, l, m.px, t, cx, y);
  });
  clearShadow(g);
   ctx.drawImage(hit.canvas, 0, 0);
}
function bassLevel(bars) {
  if (!bars) return 0;
  const n = Math.min(8, bars.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += bars[i];
  return Math.min(1, (s / Math.max(1, n)) * 1.4);
}

function applyAnim(ctx, l, W, H, bars, time) {
  if (!l.anim || l.anim === 'none' || !bars) return;
  const lv = bassLevel(bars);
  if (lv <= 0.001) return;
  const p = l.animPower == null ? 0.6 : l.animPower;
  const t = time || 0;
  let k = 1;
  let dx = 0;
  let dy = 0;
  let glow = 0;
  if (l.anim === 'pulse') {
    k = 1 + p * 0.4 * lv;
  } else if (l.anim === 'shake') {
    dx = (Math.sin(t * 53) + Math.sin(t * 37.3)) * 0.5 * p * lv * W * 0.025;
    dy = (Math.sin(t * 61.7) + Math.sin(t * 29.1)) * 0.5 * p * lv * H * 0.012;
  } else if (l.anim === 'bounce') {
    dy = -p * lv * H * 0.05;
  } else if (l.anim === 'glow') {
    glow = p * lv * W * 0.12;
  }
  const cx = l.x * W;
  const cy = l.y * H;
  ctx.translate(cx + dx, cy + dy);
  ctx.scale(k, k);
  ctx.translate(-cx, -cy);
  if (glow > 0) {
    ctx.shadowColor = l.type === 'text' ? (l.color || '#ffffff') : '#ffffff';
    ctx.shadowBlur = glow;
  }
}
function imageFilter(l, W) {
  const parts = [];
  if (l.bright != null && l.bright !== 1) parts.push('brightness(' + l.bright + ')');
  if (l.contrast != null && l.contrast !== 1) parts.push('contrast(' + l.contrast + ')');
  if (l.sat != null && l.sat !== 1) parts.push('saturate(' + l.sat + ')');
  if (l.hue) parts.push('hue-rotate(' + l.hue + 'deg)');
  if (l.gray) parts.push('grayscale(' + l.gray + ')');
  if (l.sepia) parts.push('sepia(' + l.sepia + ')');
  if (l.invert) parts.push('invert(' + l.invert + ')');
  if (l.blur) parts.push('blur(' + (l.blur * W * 0.03).toFixed(2) + 'px)');
  if (l.outlineOn) {
    const o = Math.max(1, (l.outlineW == null ? 0.01 : l.outlineW) * W).toFixed(2);
    const c = l.outlineColor || '#ffffff';
    parts.push('drop-shadow(' + o + 'px 0 0 ' + c + ') drop-shadow(-' + o + 'px 0 0 ' + c + ') drop-shadow(0 ' + o + 'px 0 ' + c + ') drop-shadow(0 -' + o + 'px 0 ' + c + ')');
  }
  if (l.glowOn) {
    const gs = Math.max(1, (l.glowSize == null ? 0.03 : l.glowSize) * W);
    const gc = l.glowColor || '#ffffff';
    parts.push('drop-shadow(0 0 ' + gs.toFixed(2) + 'px ' + gc + ') drop-shadow(0 0 ' + (gs / 2).toFixed(2) + 'px ' + gc + ')');
  }
  return parts.join(' ');
}

let imCv = null;
function needsPrep(l) {
  return (l.round || 0) > 0 || (l.tint || 0) > 0 || !!(l.cropL || l.cropR || l.cropT || l.cropB) || (!!l.shape && l.shape !== 'none');
}

function shapePath(g, shape, cw, ch) {
  g.beginPath();
  if (shape === 'circle') {
    g.arc(cw / 2, ch / 2, Math.min(cw, ch) / 2, 0, Math.PI * 2);
  } else if (shape === 'heart') {
    g.moveTo(cw * 0.5, ch * 0.92);
    g.bezierCurveTo(cw * -0.05, ch * 0.55, cw * 0.1, ch * 0.05, cw * 0.5, ch * 0.3);
    g.bezierCurveTo(cw * 0.9, ch * 0.05, cw * 1.05, ch * 0.55, cw * 0.5, ch * 0.92);
    g.closePath();
  } else if (shape === 'star') {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.42 : 1;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = cw / 2 + Math.cos(a) * (cw / 2) * r;
      const y = ch / 2 + Math.sin(a) * (ch / 2) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
  } else if (shape === 'diamond') {
    g.moveTo(cw / 2, 0);
    g.lineTo(cw, ch / 2);
    g.lineTo(cw / 2, ch);
    g.lineTo(0, ch / 2);
    g.closePath();
  }
}

function prepImage(img, w, h, l) {
  if (!imCv) imCv = document.createElement('canvas');
  const cw = Math.max(1, Math.round(w));
  const ch = Math.max(1, Math.round(h));
  imCv.width = cw;
  imCv.height = ch;
  const g = imCv.getContext('2d');
  if (l.shape && l.shape !== 'none') {
    shapePath(g, l.shape, cw, ch);
    g.clip();
  } else if ((l.round || 0) > 0) {
    const rad = (Math.min(cw, ch) / 2) * l.round;
    g.beginPath();
    if (typeof g.roundRect === 'function') g.roundRect(0, 0, cw, ch, rad);
    else g.rect(0, 0, cw, ch);
    g.clip();
  }
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const cl = l.cropL || 0;
  const ct = l.cropT || 0;
  const sw = iw * Math.max(0.05, 1 - cl - (l.cropR || 0));
  const sh = ih * Math.max(0.05, 1 - ct - (l.cropB || 0));
  g.drawImage(img, cl * iw, ct * ih, sw, sh, 0, 0, cw, ch);
  if ((l.tint || 0) > 0) {
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = l.tint;
    g.fillStyle = l.tintColor || '#ff2d55';
    g.fillRect(0, 0, cw, ch);
  }
  return imCv;
}
function applyMotion(ctx, l, W, H, time) {
  const t = time || 0;
  let dx = 0;
  let dy = 0;
  let k = 1;
  let rot = 0;
  let al = 1;

  const inMode = l.inAnim || 'none';
  if (inMode !== 'none' && !forceShow) {
    const dur = Math.max(0.05, l.inDur == null ? 0.6 : l.inDur);
    const raw = Math.min(1, Math.max(0, (t - (l.tStart || 0)) / dur));
    const rest = Math.pow(1 - raw, 3);
    al = 1 - rest;
    if (inMode === 'up') dy = rest * H * 0.18;
    else if (inMode === 'down') dy = -rest * H * 0.18;
    else if (inMode === 'left') dx = -rest * W * 0.4;
    else if (inMode === 'right') dx = rest * W * 0.4;
    else if (inMode === 'zoom') k = 1 - rest * 0.8;
  }

  const loop = l.loop || 'none';
  if (loop !== 'none') {
    const sp = l.loopSpeed == null ? 1 : l.loopSpeed;
    if (loop === 'spin') rot += (t * 60 * sp * Math.PI) / 180;
    else if (loop === 'float') dy += Math.sin(t * 2 * sp) * H * 0.015;
    else if (loop === 'sway') rot += (Math.sin(t * 2 * sp) * 8 * Math.PI) / 180;
    else if (loop === 'blink') al *= 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 4 * sp));
  }

  if (al < 1) ctx.globalAlpha *= al;
  if (!dx && !dy && !rot && k === 1) return;
  const cx = l.x * W;
  const cy = l.y * H;
  ctx.translate(cx + dx, cy + dy);
  if (rot) ctx.rotate(rot);
  if (k !== 1) ctx.scale(k, k);
  ctx.translate(-cx, -cy);
}
let tiltCv = null;
let tiltCtx = null;
let tiltTmp = null;
let tiltTmpCtx = null;

function tiltBegin(main, W, H) {
  if (!tiltCv) {
    tiltCv = document.createElement('canvas');
    tiltCtx = tiltCv.getContext('2d');
    tiltTmp = document.createElement('canvas');
    tiltTmpCtx = tiltTmp.getContext('2d');
  }
  if (tiltCv.width !== W || tiltCv.height !== H) {
    tiltCv.width = W;
    tiltCv.height = H;
    tiltTmp.width = W;
    tiltTmp.height = H;
  }
  const g = tiltCtx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.shadowColor = 'rgba(0,0,0,0)';
  g.shadowBlur = 0;
  g.shadowOffsetX = 0;
  g.shadowOffsetY = 0;
  if ('filter' in g) g.filter = 'none';
  g.clearRect(0, 0, W, H);
  g.setTransform(main.getTransform());
  return g;
}

function warpRowsAt(dst, src, a, F, cx, cy, x0, x1, y0, y1) {
  const cosA = Math.cos(a);
  const sinA = Math.sin(a);
  for (let y = y0; y < y1; y += 2) {
    const ye = Math.min(y1, y + 2);
    const v0 = y - cy;
    const v1 = ye - cy;
    const den0 = F - v0 * sinA;
    const den1 = F - v1 * sinA;
    if (den0 < F * 0.2 || den1 < F * 0.2) continue;
    const d0 = Math.round(cy + (v0 * cosA * F) / den0);
    const d1 = Math.round(cy + (v1 * cosA * F) / den1);
    if (d1 <= d0) continue;
    const sm = F / (F - ((v0 + v1) / 2) * sinA);
    dst.drawImage(src, x0, y, x1 - x0, ye - y, cx + (x0 - cx) * sm, d0, (x1 - x0) * sm, d1 - d0);
  }
}

function warpColsAt(dst, src, a, F, cx, cy, x0, x1, y0, y1) {
  const cosA = Math.cos(a);
  const sinA = Math.sin(a);
  for (let x = x0; x < x1; x += 2) {
    const xe = Math.min(x1, x + 2);
    const u0 = x - cx;
    const u1 = xe - cx;
    const den0 = F - u0 * sinA;
    const den1 = F - u1 * sinA;
    if (den0 < F * 0.2 || den1 < F * 0.2) continue;
    const d0 = Math.round(cx + (u0 * cosA * F) / den0);
    const d1 = Math.round(cx + (u1 * cosA * F) / den1);
    if (d1 <= d0) continue;
    const sm = F / (F - ((u0 + u1) / 2) * sinA);
    dst.drawImage(src, x, y0, xe - x, y1 - y0, d0, cy + (y0 - cy) * sm, d1 - d0, (y1 - y0) * sm);
  }
}

function tiltEnd(main, l, W, H, bw, bh) {
  const m = main.getTransform();
  const px = l.x * W;
  const py = l.y * H;
  const cx = m.a * px + m.c * py + m.e;
  const cy = m.b * px + m.d * py + m.f;
  const rad = Math.PI / 180;
  const ax = (l.tiltX || 0) * rad;
  const ay = (l.tiltY || 0) * rad;
  const F = Math.max(40, (Math.max(bw, bh) * 2.2) / Math.max(0.3, l.persp == null ? 1 : l.persp));
  const R = Math.hypot(bw, bh) / 2 + W * 0.15;
  const both = ax !== 0 && ay !== 0;
  const RR = both ? R * 1.6 : R;
  const clampX = (v) => Math.max(0, Math.min(W, v));
  const clampY = (v) => Math.max(0, Math.min(H, v));
  const rx0 = clampX(Math.floor(cx - R));
  const rx1 = clampX(Math.ceil(cx + R));
  const ry0 = clampY(Math.floor(cy - R));
  const ry1 = clampY(Math.ceil(cy + R));
  const qx0 = clampX(Math.floor(cx - RR));
  const qx1 = clampX(Math.ceil(cx + RR));
  const qy0 = clampY(Math.floor(cy - RR));
  const qy1 = clampY(Math.ceil(cy + RR));

  main.setTransform(1, 0, 0, 1, 0, 0);
  main.shadowColor = 'rgba(0,0,0,0)';
  main.shadowBlur = 0;
  main.shadowOffsetX = 0;
  main.shadowOffsetY = 0;
  if ('filter' in main) main.filter = 'none';
  if (l.blend && l.blend !== 'source-over') main.globalCompositeOperation = l.blend;

  if (both) {
    tiltTmpCtx.setTransform(1, 0, 0, 1, 0, 0);
    tiltTmpCtx.clearRect(0, 0, W, H);
    warpRowsAt(tiltTmpCtx, tiltCv, ax, F, cx, cy, rx0, rx1, ry0, ry1);
    warpColsAt(main, tiltTmp, ay, F, cx, cy, qx0, qx1, qy0, qy1);
  } else if (ax !== 0) {
    warpRowsAt(main, tiltCv, ax, F, cx, cy, rx0, rx1, ry0, ry1);
  } else {
    warpColsAt(main, tiltCv, ay, F, cx, cy, rx0, rx1, ry0, ry1);
  }
}
export function drawOverlay(ctx, bars, time) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  layers.forEach(function (l) {
    if (l.hidden) return;
    const ta = timeAlpha(l, time || 0);
    if (ta <= 0 && !forceShow) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.globalAlpha = l.opacity * (ta > 0 ? ta : 0.35);
    applyAnim(ctx, l, W, H, bars, time);
        applyMotion(ctx, l, W, H, time);
        if (l.rot) {
      ctx.translate(l.x * W, l.y * H);
      ctx.rotate((l.rot * Math.PI) / 180);
      ctx.translate(-l.x * W, -l.y * H);
    }
    if (l.type === 'image') {
      const w = l.size * W * Math.max(0.05, 1 - (l.cropL || 0) - (l.cropR || 0));
      const h = (l.size * W * l.img.height / l.img.width) * Math.max(0.05, 1 - (l.cropT || 0) - (l.cropB || 0));
   const tilted = !!(l.tiltX || l.tiltY);
      const mainCtx = ctx;
      if (tilted) ctx = tiltBegin(ctx, W, H);
      const flt = imageFilter(l, W);
      if (flt && 'filter' in ctx) ctx.filter = flt;
      if (l.flipX || l.flipY) {
        ctx.translate(l.x * W, l.y * H);
        ctx.scale(l.flipX ? -1 : 1, l.flipY ? -1 : 1);
        ctx.translate(-l.x * W, -l.y * H);
      }
      if (l.shOn) {
        const sa = ((l.shAngle == null ? 90 : l.shAngle) * Math.PI) / 180;
        const sd = (l.shDist == null ? 0.02 : l.shDist) * W;
        ctx.shadowColor = hexRgba(l.shColor || '#000000', l.shAlpha == null ? 0.6 : l.shAlpha);
        ctx.shadowBlur = (l.shBlur == null ? 0.02 : l.shBlur) * W;
        ctx.shadowOffsetX = Math.cos(sa) * sd;
        ctx.shadowOffsetY = Math.sin(sa) * sd;
      }
      if (l.blend && l.blend !== 'source-over') ctx.globalCompositeOperation = l.blend;
      let imgSrc = l.img;
        if (needsPrep(l)) imgSrc = prepImage(l.img, w, h, l);
  ctx.drawImage(imgSrc, l.x * W - w / 2, l.y * H - h / 2, w, h);
      if (tilted) {
        ctx = mainCtx;
        tiltEnd(ctx, l, W, H, w, h);
      }
    } else {
      const m = textMetrics(ctx, l);
      const cx = l.x * W;
      const top = l.y * H - m.h / 2;
          drawGlass(ctx, l, m, cx, top);
      drawTextFx(ctx, l, m, cx, top);
    }
    ctx.restore();
  });
}