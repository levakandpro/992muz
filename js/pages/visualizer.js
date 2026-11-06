import { VIZ_W, VIZ_H, BAR_COUNT, drawWaves as drawWavesBase, spectrumToBars, setBackgroundImage, setBackgroundVideo, setFormat } from '/js/visualizer/waves.js';
import { FONTS, STICKERS, setOverlayChange, setFontFail, touch, getLayers, getLayer, getSelected, select, addText, addSticker, removeLayer, duplicateLayer, resetTextStyle, resetShadow, resetEffect, loadFont, drawOverlay, layerBounds, hitTest, moveLayer, undo, redo, canUndo, canRedo, histSchedule, setHistChange, checkFont, setForceShow, groupMembers, groupBounds, isGlued, setGroupOpen } from '/js/visualizer/overlay.js';
import { checkExportSupport, exportVideo, exportAudio } from '/js/visualizer/exporter.js';
import { createWavePicker } from '/js/visualizer/wavepicker.js';
import { wave, setWave, resetWave, WAVE_DEFAULTS, setTransparent, STYLES, getBackground, slideshow, setSlides, setSlideOpts } from '/js/visualizer/waves.js';
import { drawParticles, particles, PARTICLE_TYPES, PARTICLE_DEFAULTS, setParticles } from '/js/visualizer/particles.js';
import { mountParticlesPanel } from '/js/visualizer/particles-ui.js';
import { mountEffectsPanel, ITEMS as EFFECT_ITEMS, openEffectsSettings, closeEffectsSettings, effectsSettingsOpen } from '/js/visualizer/effects-ui.js';
import { effects, EFFECT_DEFAULTS, drawEffects, drawFrameExtras, setEffects } from '/js/visualizer/effects.js';
import { analyzeBeats, setBeatGrid } from '/js/visualizer/beats.js';
import { audioFx, setAudioFx, createReverb, createLimiter, createEq, createEcho, createSpatial, createFilter, createLofi, createMod, createWide, AUDIO_FX_DEFAULTS } from '/js/visualizer/audio-fx.js';
import { mountTemplatesPanel } from '/js/visualizer/templates.js';
import { drawLayers, getLayerOrder, moveLayerKey, setLayerOrder } from '/js/visualizer/layers.js';
import { exportLayers, importLayers } from '/js/visualizer/overlay.js';
// Показ появления или конца ролика по кнопке в панели «Эффекты»
let trPreview = null;

function previewTransition(kind) {
  if (exporting || transparentMode) return;
  const fo = Math.min(effects.fadeOut || 0, duration / 2);
  if (mediaReady() && duration > 0) {
    trPreview = null;
    stopPlayback(true);
    if (kind === 'out') startOffset = Math.max(0, duration - fo - 0.6);
    startPlayback();
    return;
  }
  trPreview = { kind: kind, t0: performance.now() };
  startPartPreview();
}

function drawWaves(c, b, t, style) {
  setForceShow(!playing && !exporting && (openTab === 'text' || openTab === 'layers'));
  drawLayers(c, b, t, style, { noEffects: transparentMode, overlay: true });
  if (transparentMode) return;
  if (trPreview) {
    const total = duration > 0 ? duration : 10;
    const fo = Math.min(effects.fadeOut || 0, total / 2);
    const fi = Math.min(effects.fadeIn || 0, total / 2);
    const pt = (performance.now() - trPreview.t0) / 1000;
    const out = trPreview.kind === 'out';
    drawFrameExtras(c, out ? total - fo - 0.5 + pt : pt, total, true);
    if (pt > (out ? fo + 1.2 : fi + 0.8)) trPreview = null;
    return;
  }
  drawFrameExtras(c, t, duration, playing);
}
const MAX_SECONDS = 60;
const MAX_FILE_MB = 80;
let clipSeconds = 60;
let transparentMode = false;
const canvas = document.getElementById('vizCanvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('audioFile');
const playBtn = document.getElementById('playBtn');
const seek = document.getElementById('seek');
const timeLabel = document.getElementById('timeLabel');
const loopBtn = document.getElementById('loopBtn');
let loopOn = true;
loopBtn.addEventListener('click', () => {
  loopOn = !loopOn;
  loopBtn.classList.toggle('active', loopOn);
  loopBtn.setAttribute('aria-pressed', String(loopOn));
});
const trackInfo = document.getElementById('trackInfo');
const statusEl = document.getElementById('status');
const emptyEl = document.getElementById('vizEmpty');
const exportBtn = document.getElementById('exportBtn');
const exportProgress = document.getElementById('exportProgress');
const expBar = document.getElementById('expBar');
const expLabel = document.getElementById('expLabel');
const cancelBtn = document.getElementById('cancelBtn');
const resultBox = document.getElementById('resultBox');
const resultVideo = document.getElementById('resultVideo');
const saveBtn = document.getElementById('saveBtn');
const shareBtn = document.getElementById('shareBtn');

const waveBox = document.getElementById('waveBox');
const waveRange = document.getElementById('waveRange');
const waveHint = document.getElementById('waveHint');
const applyBtn = document.getElementById('applyBtn');
const editClipBtn = document.getElementById('editClipBtn');
const closeResultBtn = document.getElementById('closeResultBtn');

const tabBar = document.getElementById('tabBar');
const soonBox = document.getElementById('soonBox');
const partBox = document.getElementById('partBox');
const tmplBox = document.getElementById('tmplBox');
const stkBox = document.getElementById('stkBox');
const effBox = document.getElementById('effBox');
const TAB_NAMES = {
  effects: 'Эффекты',
  particles: 'Частицы',
  text: 'Текст',
  templates: 'Шаблоны',
  stickers: 'Стикеры',
  layers: 'Слои'
};
const settingsBtn = document.getElementById('settingsBtn');
const settingsBox = document.getElementById('settingsBox');
const settingsClose = document.getElementById('settingsClose');
const lengthBox = document.getElementById('lengthBox');


settingsBtn.addEventListener('click', () => {
  if (exporting) return;
  settingsBox.hidden = false;
});

settingsClose.addEventListener('click', () => {
  settingsBox.hidden = true;
});

settingsBox.addEventListener('pointerdown', (e) => {
  if (e.target === settingsBox) settingsBox.hidden = true;
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || settingsBox.hidden) return;
  if (!window.matchMedia('(min-width: 1024px)').matches) return;
  settingsBox.hidden = true;
});

lengthBox.addEventListener('click', (e) => {
  const chip = e.target.closest('.viz-chip');
  if (!chip || exporting) return;
  clipSeconds = Number(chip.dataset.len);
  lengthBox.querySelectorAll('.viz-chip').forEach((c) => c.classList.toggle('active', c === chip));
  if (!buffer) {
    if (hasVideo()) {
      stopPlayback(true);
      duration = Math.min(vidDur(), clipSeconds);
      updateUi(0);
      updateVideoPill();
    }
    return;
  }

  stopPlayback(true);
  duration = Math.min(buffer.duration, clipSeconds);
  clipStart = picker.setClipLen(duration);
  updateUi(0);
  showClipRange();
  if (!editClipBtn.hidden) {
    editClipBtn.textContent = `${fmt(clipStart)} – ${fmt(clipStart + duration)}`;
  }
});


const libraryBtn = document.getElementById('libraryBtn');
const libraryBox = document.getElementById('libraryBox');
const libraryClose = document.getElementById('libraryClose');

libraryBtn.addEventListener('click', () => {
  if (exporting) return;
  stopPlayback(false);
  libraryBox.hidden = false;
});

libraryClose.addEventListener('click', () => {
  libraryBox.hidden = true;
});

libraryBox.addEventListener('pointerdown', (e) => {
  if (e.target === libraryBox) libraryBox.hidden = true;
});

// ---------- ТОЛЬКО КОМПЬЮТЕР: библиотека 992MUZ (треки из Firestore, файлы из R2) ----------
const LIB_COLLECTION = 'tracks';
let libTracks = null;
let libLoading = false;

const libSearch = document.createElement('input');
libSearch.type = 'text';
libSearch.className = 'lib-search';
libSearch.placeholder = 'Поиск: название или артист';
libSearch.spellcheck = false;
libSearch.autocomplete = 'off';

const libList = document.createElement('div');
libList.className = 'lib-list';

const libMsg = document.createElement('p');
libMsg.className = 'lib-msg';

libraryClose.before(libSearch, libList, libMsg);

let libAudio = null;
let libCur = null;
let libSeeking = false;

const libFmt = (s) => {
  const v = isFinite(s) && s > 0 ? s : 0;
  const m = Math.floor(v / 60);
  const r = Math.floor(v % 60);
  return m + ':' + (r < 10 ? '0' : '') + r;
};

function libFill(el) {
  el.style.setProperty('--p', Number(el.value) / 10 + '%');
}

function libRowOf(t) {
  return Array.from(libList.children).find((r) => r._track === t) || null;
}

function libPaint() {
  Array.from(libList.children).forEach((r) => {
    const on = !!libCur && r._track === libCur;
    r.classList.toggle('active', on);
    r.classList.toggle('playing', on && !!libAudio && !libAudio.paused);
    if (!on) r.classList.remove('loading');
  });
}

function libSync() {
  const row = libCur ? libRowOf(libCur) : null;
  if (!row || !libAudio) return;
  const d = libAudio.duration;
  const c = libAudio.currentTime;
  const ok = isFinite(d) && d > 0;
  row._dur.textContent = ok ? libFmt(d) : '--:--';
  if (!libSeeking) {
    row._cur.textContent = libFmt(c);
    row._seek.value = String(ok ? Math.round((c / d) * 1000) : 0);
    libFill(row._seek);
  }
}

function libStop() {
  if (libAudio) {
    libAudio.pause();
    libAudio.removeAttribute('src');
    libAudio.load();
  }
  libCur = null;
  libSeeking = false;
  libPaint();
}

function libToggle(t) {
  if (!libAudio) {
    libAudio = new Audio();
    libAudio.preload = 'auto';
    libAudio.addEventListener('timeupdate', libSync);
    libAudio.addEventListener('loadedmetadata', libSync);
    libAudio.addEventListener('durationchange', libSync);
    libAudio.addEventListener('play', libPaint);
    libAudio.addEventListener('pause', libPaint);
    libAudio.addEventListener('waiting', () => {
      const r = libCur ? libRowOf(libCur) : null;
      if (r) r.classList.add('loading');
    });
    libAudio.addEventListener('playing', () => {
      const r = libCur ? libRowOf(libCur) : null;
      if (r) r.classList.remove('loading');
      libPaint();
    });
    libAudio.addEventListener('ended', () => {
      libAudio.currentTime = 0;
      libPaint();
      libSync();
    });
    libAudio.addEventListener('error', () => {
      if (!libCur) return;
      libMsg.textContent = 'Не удалось воспроизвести «' + libCur.title + '».';
      libCur = null;
      libPaint();
    });
  }
  libMsg.textContent = '';
  if (libCur === t) {
    if (libAudio.paused) libAudio.play().catch(() => {});
    else libAudio.pause();
    return;
  }
  libCur = t;
  libSeeking = false;
  libAudio.src = t.url;
  libPaint();
  const row = libRowOf(t);
  if (row) {
    row.classList.add('loading');
    row._cur.textContent = '0:00';
    row._dur.textContent = '--:--';
    row._seek.value = '0';
    libFill(row._seek);
  }
  libAudio.play().catch(() => {});
}

// Закрыли библиотеку (крестик, фон, «Взять»): прослушивание останавливается.
new MutationObserver(() => {
  if (libraryBox.hidden) libStop();
}).observe(libraryBox, { attributes: true, attributeFilter: ['hidden'] });

function libRender() {
  const q = libSearch.value.trim().toLowerCase();
  libList.textContent = '';
  const list = (libTracks || []).filter((t) => !q || (t.title + ' ' + t.artist).toLowerCase().indexOf(q) >= 0);
  if (libTracks) libMsg.textContent = list.length ? '' : 'Ничего не найдено.';
  list.forEach((t) => {
    const row = document.createElement('div');
    row.className = 'lib-row';
    row._track = t;

    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'lib-play';
    play.setAttribute('aria-label', 'Слушать «' + t.title + '»');

    const name = document.createElement('span');
    name.className = 'lib-name';
    name.textContent = t.title;
    const art = document.createElement('span');
    art.className = 'lib-art';
    art.textContent = t.artist || 'Без артиста';

    const take = document.createElement('button');
    take.type = 'button';
    take.className = 'lib-take';
    take.textContent = 'Взять';

    const seekBox = document.createElement('div');
    seekBox.className = 'lib-seek';
    const cur = document.createElement('span');
    cur.textContent = '0:00';
    const seek = document.createElement('input');
    seek.type = 'range';
    seek.min = '0';
    seek.max = '1000';
    seek.step = '1';
    seek.value = '0';
    libFill(seek);
    const dur = document.createElement('span');
    dur.textContent = '--:--';
    seekBox.append(cur, seek, dur);

    row._cur = cur;
    row._dur = dur;
    row._seek = seek;

    seek.addEventListener('input', () => {
      libSeeking = true;
      libFill(seek);
      const d = libAudio ? libAudio.duration : 0;
      if (isFinite(d) && d > 0) cur.textContent = libFmt((Number(seek.value) / 1000) * d);
    });
    seek.addEventListener('change', () => {
      const d = libAudio ? libAudio.duration : 0;
      if (libCur === t && isFinite(d) && d > 0) libAudio.currentTime = (Number(seek.value) / 1000) * d;
      libSeeking = false;
    });

    take.addEventListener('click', (e) => {
      e.stopPropagation();
      libPick(t);
    });
    row.addEventListener('click', (e) => {
      if (e.target.closest('.lib-take, .lib-seek')) return;
      libToggle(t);
    });

    row.append(play, name, art, take, seekBox);
    libList.append(row);
  });
  libPaint();
  libSync();
}
async function libLoad() {
  if (libTracks || libLoading) return;
  libLoading = true;
  libMsg.textContent = 'Загружаю список…';
  try {
    const { db } = await import('/js/config/firebase.js');
    const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await fs.getDocs(fs.query(fs.collection(db, LIB_COLLECTION), fs.limit(300)));
    const out = [];
    snap.forEach((d) => {
      const x = d.data();
      if (!x || !x.trackUrl) return;
      const ts = x.addedAt && x.addedAt.toMillis ? x.addedAt.toMillis() : (Date.parse(x.uploadedAt) || 0);
      out.push({ title: String(x.title || 'Без названия'), artist: String(x.artist || ''), url: x.trackUrl, format: x.format || 'mp3', ts: ts });
    });
    out.sort((a, b) => b.ts - a.ts);
    libTracks = out;
    libMsg.textContent = '';
    libRender();
  } catch (e) {
    console.error(e);
    libMsg.textContent = 'Не удалось загрузить список. Проверьте интернет и правила чтения Firestore.';
  } finally {
    libLoading = false;
  }
}

async function libPick(t) {
  if (exporting || libList.classList.contains('busy')) return;
  libList.classList.add('busy');
  libMsg.textContent = 'Скачиваю «' + t.title + '»…';
  try {
    const res = await fetch(t.url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const base = ((t.artist ? t.artist + ' - ' : '') + t.title).replace(/[\\/:*?"<>|]+/g, '').trim() || 'track';
    const file = new File([blob], base + '.' + t.format, { type: blob.type || 'audio/mpeg' });
    libraryBox.hidden = true;
    libMsg.textContent = '';
    loadFile(file);
  } catch (e) {
    console.error(e);
    libMsg.textContent = 'Не удалось скачать трек. Скорее всего, у cdn.992muz.ru не включён CORS.';
  } finally {
    libList.classList.remove('busy');
  }
}

libSearch.addEventListener('input', libRender);

libraryBtn.addEventListener('click', () => {
  if (!window.matchMedia('(min-width: 1024px)').matches) return;
  libLoad();
});
let tmplMode = 'templates';

function renderTmplTab() {
  tmplBox.textContent = '';
  if (window.matchMedia('(min-width: 1024px)').matches) return;
  const seg = ovlEl('div', 'viz-seg viz-stk-tabs');
  [['templates', 'Шаблоны'], ['stickers', 'Стикеры']].forEach((t) => {
    const b = ovlEl('button', 'viz-sub' + (tmplMode === t[0] ? ' active' : ''), t[1]);
    b.type = 'button';
    b.addEventListener('click', () => {
      tmplMode = t[0];
      renderTmplTab();
    });
    seg.append(b);
  });
  const host = ovlEl('div');
  tmplBox.append(seg, host);
  if (tmplMode === 'stickers') {
    ovlRenderStickerPicker(host, renderTmplTab);
    return;
  }
  mountTemplatesPanel(host, {
    ready: ovlReady,
    canApply: () => !exporting,
    onApply: () => {
      buzz();
      ovlCollapsed = true;
      showTab('text');
    }
  });
}
// ТОЛЬКО КОМПЬЮТЕР: вкладка «Стикеры». Верх (кнопка и категории) стоит на месте, прокручивается только список.
function renderStkTab() {
  stkBox.textContent = '';
  const tmp = ovlEl('div');
  ovlRenderStickerPicker(tmp, renderStkTab);
  const kids = Array.from(tmp.children);
  const list = ovlEl('div', 'stk-scroll');
  kids.forEach((k, i) => (i < 2 && kids.length > 2 ? stkBox : list).append(k));
  stkBox.append(list);
}
let openTab = null;

function showTab(id) {
  if (id !== 'effects') closeEffectsSettings();
    libraryBtn.hidden = !!id;
   const wasPart = openTab === 'particles' || openTab === 'effects';
  openTab = id;
  tabBar.querySelectorAll('.viz-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === id));
  document.getElementById('styleBox').hidden = id !== 'waves';
  if (id === 'waves') syncAudioAsk();
    if (!playing && !exporting) drawIdle(startOffset);
  const ovl = id === 'text' || id === 'layers';
  const part = id === 'particles';
  const tmpl = id === 'templates';
  const eff = id === 'effects';
  const stk = id === 'stickers';
  soonBox.hidden = !id || id === 'waves' || ovl || part || tmpl || eff || stk;
  if (id && id !== 'waves' && !ovl && !part && !tmpl && !eff && !stk) soonBox.textContent = `${TAB_NAMES[id]} — скоро`;
  partBox.hidden = !part;
  tmplBox.hidden = !tmpl;
  effBox.hidden = !eff;
  stkBox.hidden = !stk;
  if (eff) {
    mountEffectsPanel(effBox, { onChange: startPartPreview, onPreview: previewTransition });
    startPartPreview();
  }
  if (tmpl) renderTmplTab();
  if (stk) renderStkTab();
  if (part) {
    mountParticlesPanel(partBox, { onChange: startPartPreview });
    startPartPreview();
  } else if (wasPart && !playing) {
    drawIdle(startOffset);
  }
  renderOvl();
}
// Пока открыта вкладка «Частицы» и трек не играет, крутим живой предпросмотр
// на демо-звуке, чтобы настройки было видно сразу.
let partId = 0;
let partT0 = 0;

function partFrame(now) {
  partId = 0;
  if ((openTab !== 'particles' && openTab !== 'effects') || exporting) return;
  if (!playing && !demoId) {
    const t = (now - partT0) / 1000;
    fillDemoBars(t);
    drawWaves(ctx, bars, t, buffer ? currentStyle : 'none');
  }
  partId = requestAnimationFrame(partFrame);
}

function startPartPreview() {
  if (partId) return;
  partT0 = performance.now();
  partId = requestAnimationFrame(partFrame);
}
tabBar.addEventListener('click', (e) => {
  const tab = e.target.closest('.viz-tab');
  if (!tab) return;
  const id = tab.dataset.tab;
  if (id === 'effects' && window.matchMedia('(min-width: 1024px)').matches) {
    if (effectsSettingsOpen()) {
      closeEffectsSettings();
      return;
    }
    if (openTab === 'effects') {
      openEffectsSettings();
      return;
    }
  }
  if (id === 'waves' && wavePanelOpen) {
    closeWavePanel();
    return;
  }
  if (id === 'waves' && openTab === 'waves') {
    showTab(null);
    openWavePanel();
    return;
  }
  closeWavePanel();
  ovlCollapsed = false;
  showTab(openTab === id ? null : id);
});
document.addEventListener('pointerdown', (e) => {
  if (!openTab) return;
  if (window.matchMedia('(min-width: 1024px)').matches) return;
  if (effectsSettingsOpen()) return;
  if (e.target.closest('.viz-toolbar')) return;
    if ((openTab === 'text' || openTab === 'layers') && e.target.closest('.viz-frame')) return;
  showTab(null);
});
closeResultBtn.addEventListener('click', () => {
  resultBox.hidden = true;
});
let clipStart = 0;
let resumeAfterDrag = false;

const picker = createWavePicker(document.getElementById('waveCanvas'), {
  canDrag: () => !exporting,
    snap: (t) => snapStart(t),
  onDragStart() {
    resumeAfterDrag = playing;
    stopPlayback(true);
  },
  onChange(start) {
    clipStart = start;
    showClipRange();
  },
  onDragEnd() {
    if (resumeAfterDrag) startPlayback();
    resumeAfterDrag = false;
  }
});

function showClipRange() {
  const movable = !!buffer && buffer.duration > duration + 0.05;
  waveRange.textContent = buffer ? `${fmt(clipStart)} – ${fmt(clipStart + duration)}` : '';
  waveHint.textContent = movable
    ? 'Потяните рамку, чтобы выбрать фрагмент трека'
    : 'Трек короче выбранной длины — будет использован целиком';
}
const photoInput = document.getElementById('photoFile');
let photoUrl = null;

let photoMode = 'bg';

photoInput.addEventListener('cancel', () => {
  photoMode = 'bg';
  photoInput.multiple = false;
});
document.querySelector('label[for="photoFile"]').addEventListener('click', () => {
  photoMode = 'bg';
});
photoInput.addEventListener('change', () => {
  const file = photoInput.files && photoInput.files[0];
  const allFiles = photoInput.files ? Array.from(photoInput.files) : [];
  photoInput.value = '';
  photoInput.multiple = false;
  const mode = photoMode;
  photoMode = 'bg';
  if (!file || exporting) return;
  if (!file.type.startsWith('image/')) {
    setStatus('Выберите картинку: JPG, PNG или WEBP.');
    return;
  }
  if (mode === 'slide') {
    addSlides(allFiles);
    return;
  }
  if (mode === 'overlay') {
    if (file.size > 10 * 1024 * 1024) {
      setStatus('Картинка слишком большая (максимум 10 МБ).');
      return;
    }
    const overUrl = URL.createObjectURL(file);
    addSticker(overUrl).then((l) => {
      if (!l || !l.img.naturalWidth) {
        if (l) removeLayer(l.id);
        URL.revokeObjectURL(overUrl);
        setStatus('Не удалось открыть фото.');
        renderOvl();
        return;
      }
      ovlCollapsed = true;
        showTab('layers');
         setStatus('');
    });
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = url;
    setBackgroundImage(img);
        setTransparentMode(false);
        removeVideo();
    if (!playing) drawIdle(startOffset);
    emptyEl.classList.add('has-photo');
    renderOvl();
    setStatus('');
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus('Не удалось открыть фото.');
  };
  img.src = url;
});
canvas.width = VIZ_W;
canvas.height = VIZ_H;
// ---------- видео в фоне ----------

const videoInput = document.getElementById('videoFile');
const videoBtn = document.getElementById('videoBtn');
const videoBox = document.getElementById('videoBox');
const vidInfo = document.getElementById('vidInfo');
const vidStart = document.getElementById('vidStart');
const vidStartOut = document.getElementById('vidStartOut');
const vidVolEl = document.getElementById('vidVol');
const vidVolOut = document.getElementById('vidVolOut');
const musVolEl = document.getElementById('musVol');
const musVolOut = document.getElementById('musVolOut');
const vidRemove = document.getElementById('vidRemove');
const vidClose = document.getElementById('vidClose');
const MAX_VIDEO_MB = 300;
const addTrackBtn = document.getElementById('addTrackBtn');
const addPhotoBtn = document.getElementById('addPhotoBtn');
const soundBtn = document.getElementById('soundBtn');
const audioBox = document.getElementById('audioBox');
const sndPlay = document.getElementById('sndPlay');
const sndVolEl = document.getElementById('sndVol');
const sndVolOut = document.getElementById('sndVolOut');
const sndFadeInEl = document.getElementById('sndFadeIn');
const sndFadeInOut = document.getElementById('sndFadeInOut');
const sndFadeOutEl = document.getElementById('sndFadeOut');
const sndFadeOutOut = document.getElementById('sndFadeOutOut');
const sndRevEl = document.getElementById('sndReverb');
const sndRevOut = document.getElementById('sndReverbOut');
const sndEqPresets = document.getElementById('sndEqPresets');
const sndBassEl = document.getElementById('sndBass');
const sndBassOut = document.getElementById('sndBassOut');
const sndMidEl = document.getElementById('sndMid');
const sndMidOut = document.getElementById('sndMidOut');
const sndTrebleEl = document.getElementById('sndTreble');
const sndTrebleOut = document.getElementById('sndTrebleOut');
const sndClose = document.getElementById('sndClose');
const bestBtn = document.getElementById('bestBtn');
const snapBtn = document.getElementById('snapBtn');
const photoModeBox = document.getElementById('photoModeBox');

addPhotoBtn.addEventListener('click', () => {
  if (exporting) return;
  photoMode = 'bg';
  if (!photoUrl && !hasVideo()) {
    photoInput.click();
    return;
  }
  photoModeBox.hidden = false;
});

document.getElementById('photoModeBg').addEventListener('click', () => {
  photoModeBox.hidden = true;
  photoMode = 'bg';
  photoInput.click();
});

document.getElementById('photoModeOver').addEventListener('click', () => {
  photoModeBox.hidden = true;
  photoMode = 'overlay';
  photoInput.click();
});

document.getElementById('photoModeCancel').addEventListener('click', () => {
  photoModeBox.hidden = true;
});

photoModeBox.addEventListener('pointerdown', (e) => {
  if (e.target === photoModeBox) photoModeBox.hidden = true;
});
// ---------- слайд-шоу под бит ----------

function loadImg(url) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = url;
  });
}

const photoModeSlide = document.createElement('button');
photoModeSlide.type = 'button';
photoModeSlide.className = 'viz-btn';
photoModeSlide.textContent = 'В слайд-шоу';
const photoModeSlideHint = document.createElement('p');
photoModeSlideHint.className = 'viz-wave-hint';
photoModeSlideHint.textContent = 'Фото будут меняться на удар трека.';
document.getElementById('photoModeCancel').before(photoModeSlide, photoModeSlideHint);

photoModeSlide.addEventListener('click', () => {
  photoModeBox.hidden = true;
  photoMode = 'slide';
  photoInput.multiple = true;
  photoInput.click();
});

const slideBox = document.createElement('div');
slideBox.className = 'viz-sheet viz-sheet-clear';
slideBox.hidden = true;
slideBox.innerHTML =
  '<div class="viz-sheet-card viz-settings">' +
  '<h2 class="viz-sheet-title">Слайд-шоу</h2>' +
  '<div class="viz-set-row"><div class="viz-set-label">Менять каждые</div><div class="viz-seg" id="slideEvery"></div></div>' +
  '<div class="viz-set-row"><div class="viz-set-label">Переход</div><div class="viz-seg" id="slideMode"></div></div>' +
  '<div id="slideThumbs"></div>' +
  '<p class="viz-wave-hint" id="slideInfo"></p>' +
  '<button type="button" class="viz-btn" id="slideAdd">+ Добавить фото</button>' +
  '<button type="button" class="viz-btn" id="slideClear">Убрать слайд-шоу</button>' +
  '<button type="button" class="viz-btn viz-btn-primary" id="slideClose">Готово</button>' +
  '</div>';
document.body.append(slideBox);

const slideEvery = document.getElementById('slideEvery');
const slideMode = document.getElementById('slideMode');
const slideInfo = document.getElementById('slideInfo');
const slideThumbs = document.getElementById('slideThumbs');

[[1, '1 удар'], [2, '2 удара'], [4, '4 удара'], [8, '8 ударов']].forEach((d) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'viz-chip';
  b.dataset.v = String(d[0]);
  b.textContent = d[1];
  slideEvery.append(b);
});

[['cut', 'Резко'], ['fade', 'Плавно'], ['zoom', 'Зум']].forEach((d) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'viz-chip';
  b.dataset.v = d[0];
  b.textContent = d[1];
  slideMode.append(b);
});

function syncSlideSheet() {
  slideEvery.querySelectorAll('.viz-chip').forEach((c) => c.classList.toggle('active', Number(c.dataset.v) === slideshow.every));
  slideMode.querySelectorAll('.viz-chip').forEach((c) => c.classList.toggle('active', c.dataset.v === slideshow.mode));
  slideInfo.textContent = slideshow.list.length > 1
    ? 'Выбрано фото: ' + slideshow.list.length + '. Смена идёт по ударам трека. Нажмите ▶, чтобы увидеть.'
    : 'Добавьте ещё хотя бы одно фото, и слайд-шоу включится.';

  slideThumbs.textContent = '';
  slideThumbs.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; max-height: 190px; overflow-y: auto; overscroll-behavior: contain;';
  slideshow.list.forEach((im, i) => {
    const cell = document.createElement('div');
    cell.style.cssText = 'position: relative; aspect-ratio: 3 / 4; border-radius: 8px; overflow: hidden; background: #000; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15);';
    const img = document.createElement('img');
    img.src = im.src;
    img.alt = '';
    img.style.cssText = 'display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none;';
    const num = document.createElement('span');
    num.textContent = String(i + 1);
    num.style.cssText = 'position: absolute; left: 4px; bottom: 4px; min-width: 18px; padding: 1px 5px; border-radius: 9px; background: rgba(0, 0, 0, 0.7); color: #fff; font-size: 11px; font-weight: 700; text-align: center;';
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '✕';
    del.setAttribute('aria-label', 'Убрать фото ' + (i + 1));
    del.style.cssText = 'position: absolute; right: 4px; top: 4px; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 50%; background: rgba(0, 0, 0, 0.7); color: #fff; font-size: 11px; line-height: 1; cursor: pointer;';
    del.addEventListener('click', () => {
      const next = slideshow.list.slice();
      next.splice(i, 1);
      setSlides(next);
      setSlideOpts({ on: next.length > 1 });
      syncSlideSheet();
      if (!playing) drawIdle(startOffset);
      renderOvl();
    });
    cell.append(img, num, del);
    slideThumbs.append(cell);
  });
}

function openSlideSheet() {
  syncSlideSheet();
  slideBox.hidden = false;
}

async function addSlides(files) {
  const imgs = files.filter((f) => f.type.startsWith('image/'));
  if (!imgs.length) {
    setStatus('Выберите картинки: JPG, PNG или WEBP.');
    return;
  }
  setStatus('Загружаю фото: ' + imgs.length + '…', true);
  const list = slideshow.list.slice();
  if (!list.length && photoUrl) {
    const first = await loadImg(photoUrl);
    if (first) list.push(first);
  }
  let skipped = 0;
  for (const file of imgs) {
    if (list.length >= 30 || file.size > 10 * 1024 * 1024) {
      skipped++;
      continue;
    }
    const im = await loadImg(URL.createObjectURL(file));
    if (im) list.push(im);
    else skipped++;
  }
  setSlides(list);
  setSlideOpts({ on: list.length > 1 });
  setStatus(skipped ? 'Пропущено фото: ' + skipped + ' (больше 10 МБ, не открылись или лимит 30).' : '');
  if (!playing) drawIdle(startOffset);
  renderOvl();
  openSlideSheet();
}

async function addSlideOld(file) {
  if (file.size > 10 * 1024 * 1024) {
    setStatus('Картинка слишком большая (максимум 10 МБ).');
    return;
  }
  const url = URL.createObjectURL(file);
  const im = await loadImg(url);
  if (!im) {
    URL.revokeObjectURL(url);
    setStatus('Не удалось открыть фото.');
    return;
  }
  let list = slideshow.list.slice();
  if (!list.length && photoUrl) {
    const first = await loadImg(photoUrl);
    if (first) list.push(first);
  }
  list.push(im);
  setSlides(list);
  setSlideOpts({ on: list.length > 1 });
  setStatus('');
  if (!playing) drawIdle(startOffset);
  renderOvl();
  openSlideSheet();
}

slideEvery.addEventListener('click', (e) => {
  const c = e.target.closest('.viz-chip');
  if (!c) return;
  setSlideOpts({ every: Number(c.dataset.v) });
  syncSlideSheet();
  if (!playing) drawIdle(startOffset);
});

slideMode.addEventListener('click', (e) => {
  const c = e.target.closest('.viz-chip');
  if (!c) return;
  setSlideOpts({ mode: c.dataset.v });
  syncSlideSheet();
  if (!playing) drawIdle(startOffset);
});

document.getElementById('slideAdd').addEventListener('click', () => {
  slideBox.hidden = true;
  photoMode = 'slide';
  photoInput.multiple = true;
  photoInput.click();
});

document.getElementById('slideClear').addEventListener('click', () => {
  setSlides([]);
  setSlideOpts({ on: false });
  slideBox.hidden = true;
  if (!playing) drawIdle(startOffset);
  renderOvl();
});

document.getElementById('slideClose').addEventListener('click', () => {
  slideBox.hidden = true;
});

slideBox.addEventListener('pointerdown', (e) => {
  if (e.target === slideBox) slideBox.hidden = true;
});
function setTransparentMode(on) {
  on = !!on;
  if (transparentMode === on) return;
  transparentMode = on;
  setTransparent(on);
  document.body.classList.toggle('transp', on);
  if (on) {
    if (openTab === 'effects' || openTab === 'waves') showTab(null);
    closeWavePanel();
    stopDemo();
    emptyEl.classList.remove('has-demo');
    setStatus('');
  }
  syncVideoBtn();
  if (!playing) drawIdle(startOffset);
  renderOvl();
}

document.getElementById('transpBtn').addEventListener('click', () => {
  if (exporting) return;
  setTransparentMode(true);
});
let videoEl = null;
let videoFile = null;
let videoUrl = null;
let videoStart = 0;
let videoVol = 1;
let musicVol = 1;
let musicGain = null;
let musicFx = null;
let musicEq = null;
let musicEcho = null;
let musicSpatial = null;
let musicFilter = null;
let musicLofi = null;
let musicMod = null;
let musicWide = null;
let videoGain = null;
let masterLimiter = null;

const vidStrip = document.getElementById('vidStrip');
let stripThumbs = null;
let stripToken = 0;
let stripDrag = null;
const STRIP_N = 12;

function drawStrip() {
  if (!vidStrip.clientWidth || !vidStrip.clientHeight) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(vidStrip.clientWidth * dpr));
  const h = Math.max(1, Math.round(vidStrip.clientHeight * dpr));
  if (vidStrip.width !== w || vidStrip.height !== h) {
    vidStrip.width = w;
    vidStrip.height = h;
  }
  const g = vidStrip.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#1a1a1f';
  g.fillRect(0, 0, w, h);
  if (stripThumbs) {
    const n = STRIP_N;
    const cw = w / n;
    const sw0 = stripThumbs.width / n;
    const sh0 = stripThumbs.height;
    const k0 = Math.max(cw / sw0, h / sh0);
    const cropW = cw / k0;
    const cropH = h / k0;
    for (let i = 0; i < n; i++) {
      g.drawImage(stripThumbs, i * sw0 + (sw0 - cropW) / 2, (sh0 - cropH) / 2, cropW, cropH, i * cw, 0, cw, h);
    }
  }
  const d = vidDur();
  if (!d) return;
  const x0 = (curVideoStart() / d) * w;
  const x1 = Math.min(1, (curVideoStart() + windowLen()) / d) * w;
  g.fillStyle = 'rgba(0, 0, 0, 0.6)';
  g.fillRect(0, 0, x0, h);
  g.fillRect(x1, 0, w - x1, h);
  const lw = Math.max(2, Math.round(w / 200));
  g.fillStyle = '#ffffff';
  g.fillRect(x0, 0, lw * 2, h);
  g.fillRect(x1 - lw * 2, 0, lw * 2, h);
  g.fillRect(x0, 0, x1 - x0, lw);
  g.fillRect(x0, h - lw, x1 - x0, lw);
}

function buildStrip() {
  stripThumbs = null;
  const token = ++stripToken;
  if (!videoUrl) return;
  const tv = document.createElement('video');
  tv.muted = true;
  tv.playsInline = true;
  tv.preload = 'auto';
  const N = STRIP_N;
  let tw = 96;
  const th = 64;
  const c = document.createElement('canvas');
  c.width = tw * N;
  c.height = th;
  const g = c.getContext('2d');

  const cleanup = () => {
    tv.removeAttribute('src');
    tv.load();
  };

  function shot(i) {
    if (token !== stripToken || i >= N || !isFinite(tv.duration)) {
      cleanup();
      return;
    }
    const t = Math.max(0, Math.min(tv.duration - 0.05, ((i + 0.5) / N) * tv.duration));
    let done = false;
    const next = () => {
      if (done) return;
      done = true;
      tv.removeEventListener('seeked', next);
      clearTimeout(tm);
      if (token !== stripToken) {
        cleanup();
        return;
      }
      try {
        const k = Math.max(tw / tv.videoWidth, th / tv.videoHeight);
        const dw = tv.videoWidth * k;
        const dh = tv.videoHeight * k;
        g.save();
        g.beginPath();
        g.rect(i * tw, 0, tw, th);
        g.clip();
        g.drawImage(tv, i * tw + (tw - dw) / 2, (th - dh) / 2, dw, dh);
        g.restore();
      } catch (e) {}
      stripThumbs = c;
      drawStrip();
      shot(i + 1);
    };
    const tm = setTimeout(next, 2500);
    tv.addEventListener('seeked', next);
    tv.currentTime = t;
  }

  tv.addEventListener('loadeddata', () => {
    tw = Math.max(24, Math.min(160, Math.round(th * (tv.videoWidth / Math.max(1, tv.videoHeight)))));
    c.width = tw * N;
    shot(0);
  }, { once: true });
  tv.addEventListener('error', cleanup, { once: true });
  tv.src = videoUrl;
  tv.load();
}

function stripSec(e) {
  const r = vidStrip.getBoundingClientRect();
  return clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1) * vidDur();
}

function moveStrip(s) {
  videoStart = clamp(s, 0, videoMaxStart());
  vidStart.value = String(videoStart);
  fillRange(vidStart);
  showVideoInfo();
  drawStrip();
  drawIdle(0);
}

vidStrip.addEventListener('pointerdown', (e) => {
  if (!hasVideo() || videoMaxStart() <= 0.05) return;
  const t = stripSec(e);
  const s = curVideoStart();
  const inside = t >= s && t <= s + windowLen();
  stripDrag = { grab: inside ? t - s : windowLen() / 2 };
  try { vidStrip.setPointerCapture(e.pointerId); } catch (err) {}
  stopPlayback(true);
  moveStrip(t - stripDrag.grab);
  e.preventDefault();
});

vidStrip.addEventListener('pointermove', (e) => {
  if (!stripDrag) return;
  moveStrip(stripSec(e) - stripDrag.grab);
});

function stripEnd() {
  if (!stripDrag) return;
  stripDrag = null;
  startPlayback();
}

vidStrip.addEventListener('pointerup', stripEnd);
vidStrip.addEventListener('pointercancel', stripEnd);
function hasVideo() {
  return !!videoEl && !!videoFile && videoEl.readyState >= 1 && videoEl.videoWidth > 0;
}

function vidDur() {
  return videoEl && isFinite(videoEl.duration) ? videoEl.duration : 0;
}

function windowLen() {
  return duration > 0 ? duration : Math.min(clipSeconds, vidDur() || clipSeconds);
}

function videoMaxStart() {
  return Math.max(0, vidDur() - windowLen());
}

function curVideoStart() {
  return Math.min(Math.max(0, videoStart), videoMaxStart());
}

function ensureVideoEl() {
  if (videoEl) return videoEl;
  const el = document.createElement('video');
  el.playsInline = true;
  el.setAttribute('playsinline', '');
  el.preload = 'auto';
  el.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;';
  document.body.appendChild(el);
  el.addEventListener('seeked', () => {
    if (!playing && !exporting) paintIdle(startOffset);
  });
  videoEl = el;
  return el;
}

function attachVideoAudio() {
  if (videoGain) return;
  const ac = ensureAudio();
  try {
    const node = ac.createMediaElementSource(videoEl);
    videoGain = ac.createGain();
    videoGain.gain.value = videoVol;
    node.connect(videoGain);
    videoGain.connect(masterLimiter || analyser);
  } catch (e) {
    videoGain = null;
  }
}

function applyVolumes() {
  if (musicGain) musicGain.gain.value = musicVol;
  if (videoGain) videoGain.gain.value = videoVol;
  else if (videoEl) videoEl.volume = videoVol;
}

function mediaReady() {
  return !!buffer || hasVideo();
}

function syncAudioAsk() {
  const ask = document.getElementById('audioAsk');
  if (ask) ask.hidden = mediaReady();
}

function syncReady() {
  syncAudioAsk();
  const ok = mediaReady() && !exporting;
  playBtn.disabled = !ok;
  exportBtn.disabled = !(exportReady() && !exporting);
  seek.disabled = !ok;
}

function silentBuffer() {
  return ensureAudio().createBuffer(2, 48000, 48000);
}

function restoreVideoOnly() {
  duration = hasVideo() ? Math.min(vidDur(), clipSeconds) : 0;
  trackInfo.textContent = hasVideo() ? videoFile.name : '';
  updateUi(0);
  syncVideoBtn();
}

function updateVideoPill() {
  if (buffer) return;
  if (!hasVideo()) {
    editClipBtn.hidden = true;
    return;
  }
  const s = curVideoStart();
  editClipBtn.hidden = false;
  editClipBtn.textContent = `${fmt(s)} – ${fmt(s + windowLen())}`;
}

function syncVideoBtn() {
  videoBtn.hidden = !(buffer || videoFile);
    soundBtn.hidden = !buffer;
  videoBtn.textContent = videoFile ? 'Видео' : '+ Видео';
  addTrackBtn.hidden = !((videoFile || photoUrl || transparentMode) && !buffer);
  addPhotoBtn.hidden = !(mediaReady() || !!photoUrl || transparentMode);
  updateVideoPill();
  syncReady();
}
function removeVideo() {
  if (videoEl) {
    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.load();
  }
  stripToken++;
  stripThumbs = null;
  setBackgroundVideo(null);
  if (videoUrl) URL.revokeObjectURL(videoUrl);
  videoUrl = null;
  videoFile = null;
  videoStart = 0;
  if (!photoUrl) emptyEl.classList.remove('has-photo');
  if (!buffer) {
    duration = 0;
    emptyEl.classList.remove('hidden');
    trackInfo.textContent = '';
    updateUi(0);
  }
  syncVideoBtn();
}

function loadVideo(file) {
  stopPlayback(true);
  removeVideo();
  const el = ensureVideoEl();
  const url = URL.createObjectURL(file);
  setStatus('Читаю видео…', true);

  const fail = () => {
    URL.revokeObjectURL(url);
    el.removeAttribute('src');
    el.load();
    setStatus('Не удалось открыть видео. Лучше всего подходит MP4 (H.264).');
  };

  const onErr = () => {
    el.removeEventListener('loadeddata', onLoad);
    el.removeEventListener('error', onErr);
    fail();
  };

  const onLoad = () => {
    el.removeEventListener('loadeddata', onLoad);
    el.removeEventListener('error', onErr);
    if (!el.videoWidth) {
      fail();
      return;
    }
    videoUrl = url;
    videoFile = file;
    videoStart = 0;
    buildStrip();
    attachVideoAudio();
    applyVolumes();
    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
      photoUrl = null;
    }
    setBackgroundImage(null);
    setBackgroundVideo(el);
        setTransparentMode(false);
    emptyEl.classList.add('has-photo');
    if (!buffer) {
      duration = Math.min(vidDur(), clipSeconds);
      startOffset = 0;
      emptyEl.classList.add('hidden');
      trackInfo.textContent = file.name;
      updateUi(0);
    }
    syncVideoBtn();
    drawIdle(startOffset);
    renderOvl();
    setStatus(buffer ? 'Видео добавлено. Нажмите ▶ на экране.' : 'Видео добавлено. Нажмите ▶ или добавьте трек кнопкой «+ Трек».', true);
        if (vidDur() > windowLen() + 0.05) {
      syncVideoSheet();
      videoBox.hidden = false;
    }
  };

  el.addEventListener('loadeddata', onLoad);
  el.addEventListener('error', onErr);
  el.src = url;
  el.load();
}

function playVideoFrom(pos) {
  if (!hasVideo()) return;
  const t = curVideoStart() + pos;
  if (t >= vidDur() - 0.05) return;
  try { videoEl.currentTime = t; } catch (e) {}
  const p = videoEl.play();
  if (p && p.catch) p.catch(() => {});
}

function syncVideoDrift(pos) {
  if (!hasVideo() || videoEl.paused || videoEl.ended) return;
  const want = curVideoStart() + pos;
  if (Math.abs(videoEl.currentTime - want) > 0.35) {
    try { videoEl.currentTime = want; } catch (e) {}
  }
}

function videoSeekIdle(pos) {
  if (!hasVideo()) return;
  const t = Math.min(curVideoStart() + pos, Math.max(0, vidDur() - 0.05));
  if (Math.abs(videoEl.currentTime - t) > 0.02) {
    try { videoEl.currentTime = t; } catch (e) {}
  }
}

async function prepareVideoForExport() {
  if (!hasVideo()) return null;
  let audioBuffer = null;
  if (videoVol > 0) {
    expLabel.textContent = 'Читаю звук видео…';
    try {
      const data = await videoFile.arrayBuffer();
      audioBuffer = await ensureAudio().decodeAudioData(data);
    } catch (e) {
      audioBuffer = null;
      setStatus('Звук видео прочитать не удалось: в ролик пойдёт только музыка.');
    }
  }
  return { el: videoEl, start: curVideoStart(), vol: videoVol, audioBuffer: audioBuffer };
}

function showVideoInfo() {
  if (!videoEl || !videoFile) return;
  const s = curVideoStart();
  vidStartOut.textContent = fmt(s);
  vidInfo.textContent = videoMaxStart() > 0.05
    ? `Фрагмент ${fmt(s)} – ${fmt(s + windowLen())} из ${fmt(vidDur())}. Потяните рамку, чтобы выбрать момент.`
    : 'Видео короче выбранной длины ролика: будет использовано целиком.';
  updateVideoPill();
}
function syncVideoSheet() {
  if (!videoEl || !videoFile) return;
  const max = videoMaxStart();
  vidStart.max = String(max);
  vidStart.disabled = max <= 0.05;
  vidStart.value = String(curVideoStart());
  fillRange(vidStart);
  showVideoInfo();
  vidVolEl.value = String(Math.round(videoVol * 100));
  fillRange(vidVolEl);
  vidVolOut.textContent = Math.round(videoVol * 100) + '%';
  musVolEl.value = String(Math.round(musicVol * 100));
  fillRange(musVolEl);
  musVolOut.textContent = Math.round(musicVol * 100) + '%';
}

videoInput.addEventListener('change', () => {
  const file = videoInput.files && videoInput.files[0];
  videoInput.value = '';
  if (!file || exporting) return;
  if (!file.type.startsWith('video/')) {
    setStatus('Выберите видео: MP4 или MOV.');
    return;
  }
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    setStatus(`Видео слишком большое (максимум ${MAX_VIDEO_MB} МБ).`);
    return;
  }
  loadVideo(file);
});

videoBtn.addEventListener('click', () => {
  if (exporting) return;
  if (!videoFile) {
    videoInput.click();
    return;
  }
  stopPlayback(false);
  syncVideoSheet();
  videoBox.hidden = false;
});

vidStart.addEventListener('input', () => {
  videoStart = Number(vidStart.value);
  fillRange(vidStart);
  stopPlayback(true);
  showVideoInfo();
});

vidVolEl.addEventListener('input', () => {
  videoVol = Number(vidVolEl.value) / 100;
  fillRange(vidVolEl);
  vidVolOut.textContent = Math.round(videoVol * 100) + '%';
  applyVolumes();
});

musVolEl.addEventListener('input', () => {
  musicVol = Number(musVolEl.value) / 100;
  fillRange(musVolEl);
  musVolOut.textContent = Math.round(musicVol * 100) + '%';
  applyVolumes();
});

vidClose.addEventListener('click', () => {
  stopPlayback(true);
  videoBox.hidden = true;
});

const vidPlay = document.getElementById('vidPlay');
vidPlay.addEventListener('click', () => playBtn.click());

function syncVidPlay() {
  vidPlay.disabled = playBtn.disabled;
  vidPlay.classList.toggle('playing', playBtn.classList.contains('playing'));
}

new MutationObserver(syncVidPlay).observe(playBtn, { attributes: true, attributeFilter: ['class', 'disabled'] });
syncVidPlay();

new MutationObserver(() => {
  if (!videoBox.hidden) requestAnimationFrame(drawStrip);
}).observe(videoBox, { attributes: true, attributeFilter: ['hidden'] });

vidRemove.addEventListener('click', () => {
  removeVideo();
  videoBox.hidden = true;
  drawIdle(startOffset);
  renderOvl();
  setStatus('Видео убрано.', true);
});

videoBox.addEventListener('pointerdown', (e) => {
  if (e.target === videoBox) videoBox.hidden = true;
});
// ---------- панель «Звук» ----------

const pctText = (v) => Math.round(v * 100) + '%';
const secText = (v) => (v > 0 ? v.toFixed(1) + ' с' : 'выкл');

function syncSoundSheet() {
  sndVolEl.value = String(Math.round(musicVol * 100));
  fillRange(sndVolEl);
  sndVolOut.textContent = pctText(musicVol);
  sndFadeInEl.value = String(effects.fadeIn || 0);
  fillRange(sndFadeInEl);
  sndFadeInOut.textContent = secText(effects.fadeIn || 0);
  sndFadeOutEl.value = String(effects.fadeOut || 0);
  fillRange(sndFadeOutEl);
  sndFadeOutOut.textContent = secText(effects.fadeOut || 0);
  sndRevEl.value = String(Math.round(audioFx.reverb * 100));
  fillRange(sndRevEl);
  sndRevOut.textContent = pctText(audioFx.reverb);
  syncEq();
  syncMore();
  syncFilter();
  syncFx2();
  syncPresets();
  syncExport();
}
soundBtn.addEventListener('click', () => {
  if (exporting || !buffer) return;
  stopPlayback(false);
  syncSoundSheet();
  audioBox.hidden = false;
});

sndVolEl.addEventListener('input', () => {
  musicVol = Number(sndVolEl.value) / 100;
  fillRange(sndVolEl);
  sndVolOut.textContent = pctText(musicVol);
  applyVolumes();
});

function onFadeInput(el, out, key) {
  const v = Number(el.value);
  setEffects({ [key]: v });
  fillRange(el);
  out.textContent = secText(v);
}

// Плавный старт и затухание расписываются при запуске, поэтому после отпускания ползунка
// ролик, если он играл, стартует заново, чтобы новое значение было слышно сразу.
function restartToHear() {
  if (!playing) return;
  stopPlayback(true);
  startPlayback();
}

sndFadeInEl.addEventListener('input', () => onFadeInput(sndFadeInEl, sndFadeInOut, 'fadeIn'));
sndFadeInEl.addEventListener('change', restartToHear);
sndFadeOutEl.addEventListener('input', () => onFadeInput(sndFadeOutEl, sndFadeOutOut, 'fadeOut'));
sndFadeOutEl.addEventListener('change', restartToHear);

sndRevEl.addEventListener('input', () => {
  const v = Number(sndRevEl.value) / 100;
  setAudioFx({ reverb: v });
  fillRange(sndRevEl);
  sndRevOut.textContent = pctText(v);
  if (musicFx) musicFx.setAmount(audioFx.reverb);
});
// ---------- эквалайзер и пресеты ----------

const EQ_PRESETS = [
  ['Обычный', 0, 0, 0],
  ['Бас', 0.6, 0, -0.1],
  ['Чётко', -0.1, 0.1, 0.5],
  ['Тепло', 0.3, 0.1, -0.3]
];
const dbText = (v) => {
  const d = Math.round(v * 12 * 10) / 10;
  return (d > 0 ? '+' : '') + d + ' дБ';
};
const eqRows = [
  ['bass', sndBassEl, sndBassOut],
  ['mid', sndMidEl, sndMidOut],
  ['treble', sndTrebleEl, sndTrebleOut]
];

function syncEq() {
  eqRows.forEach(([k, el, out]) => {
    el.value = String(Math.round(audioFx[k] * 100));
    fillRange(el);
    out.textContent = dbText(audioFx[k]);
  });
  Array.from(sndEqPresets.children).forEach((b, i) => {
    const p = EQ_PRESETS[i];
    b.classList.toggle('active', Math.abs(p[1] - audioFx.bass) < 0.005 && Math.abs(p[2] - audioFx.mid) < 0.005 && Math.abs(p[3] - audioFx.treble) < 0.005);
  });
}

EQ_PRESETS.forEach((p) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'viz-chip';
  b.textContent = p[0];
  b.addEventListener('click', () => {
    setAudioFx({ bass: p[1], mid: p[2], treble: p[3] });
    if (musicEq) musicEq.update();
    syncEq();
  });
  sndEqPresets.append(b);
});

eqRows.forEach(([k, el]) => {
  el.addEventListener('input', () => {
    setAudioFx({ [k]: Number(el.value) / 100 });
    if (musicEq) musicEq.update();
    syncEq();
  });
});
// ---------- 8D и эхо по BPM ----------

const sndD8El = document.getElementById('sndD8');
const sndD8Out = document.getElementById('sndD8Out');
const sndD8SpEl = document.getElementById('sndD8Speed');
const sndD8SpOut = document.getElementById('sndD8SpeedOut');
const sndEchoEl = document.getElementById('sndEcho');
const sndEchoOut = document.getElementById('sndEchoOut');
const sndEchoFbEl = document.getElementById('sndEchoFb');
const sndEchoFbOut = document.getElementById('sndEchoFbOut');
const sndEchoDiv = document.getElementById('sndEchoDiv');

const offText = (v) => (v > 0.004 ? pctText(v) : 'выкл');
const hzText = (v) => v.toFixed(2) + ' Гц';
const moreRows = [
  ['d8', sndD8El, sndD8Out, offText],
  ['d8Speed', sndD8SpEl, sndD8SpOut, hzText],
  ['echo', sndEchoEl, sndEchoOut, offText],
  ['echoFb', sndEchoFbEl, sndEchoFbOut, pctText]
];
const ECHO_DIVS = [['1/4', 1], ['1/8', 0.5], ['1/16', 0.25]];

function fxUpdateAll() {
  if (musicEq) musicEq.update();
  if (musicEcho) musicEcho.update();
  if (musicSpatial) musicSpatial.update();
  if (musicFilter) musicFilter.update();
  if (musicLofi) musicLofi.update();
  if (musicMod) musicMod.update();
  if (musicWide) musicWide.update();
}

function syncMore() {
  moreRows.forEach(([k, el, out, f]) => {
    el.value = String(Math.round(audioFx[k] * 100));
    fillRange(el);
    out.textContent = f(audioFx[k]);
  });
  Array.from(sndEchoDiv.children).forEach((b, i) => {
    b.classList.toggle('active', Math.abs(ECHO_DIVS[i][1] - audioFx.echoDiv) < 0.001);
  });
}

moreRows.forEach(([k, el]) => {
  el.addEventListener('input', () => {
    setAudioFx({ [k]: Number(el.value) / 100 });
    fxUpdateAll();
    syncMore();
  });
});

ECHO_DIVS.forEach((d) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'viz-chip';
  b.textContent = 'Эхо ' + d[0];
  b.addEventListener('click', () => {
    setAudioFx({ echoDiv: d[1] });
    fxUpdateAll();
    syncMore();
  });
  sndEchoDiv.append(b);
});
// ---------- фильтры и сброс звука ----------

const sndFilterEl = document.getElementById('sndFilter');
const sndFilterOut = document.getElementById('sndFilterOut');
const sndFilterMode = document.getElementById('sndFilterMode');
const sndReset = document.getElementById('sndReset');
const FILTER_MODES = [['Без фильтра', 0], ['Под водой', 1], ['Из-за стены', 2], ['Радио', 3]];

function syncFilter() {
  sndFilterEl.value = String(Math.round(audioFx.filter * 100));
  fillRange(sndFilterEl);
  sndFilterOut.textContent = audioFx.filterMode > 0 ? pctText(audioFx.filter) : 'выкл';
  Array.from(sndFilterMode.children).forEach((b, i) => {
    b.classList.toggle('active', FILTER_MODES[i][1] === Math.round(audioFx.filterMode));
  });
}

FILTER_MODES.forEach((d) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'viz-chip';
  b.textContent = d[0];
  b.addEventListener('click', () => {
    setAudioFx({ filterMode: d[1] });
    if (d[1] > 0 && audioFx.filter < 0.05) setAudioFx({ filter: 0.7 });
    fxUpdateAll();
    syncFilter();
  });
  sndFilterMode.append(b);
});

sndFilterEl.addEventListener('input', () => {
  setAudioFx({ filter: Number(sndFilterEl.value) / 100 });
  fxUpdateAll();
  syncFilter();
});

// Полный сброс панели «Звук»
function resetSound() {
  musicVol = 1;
  setEffects({ fadeIn: 0, fadeOut: 0 });
  setAudioFx(AUDIO_FX_DEFAULTS);
  if (musicFx) musicFx.setAmount(audioFx.reverb);
  applyVolumes();
  fxUpdateAll();
  syncSoundSheet();
  restartToHear();
}

sndReset.addEventListener('click', () => {
  buzz();
  resetSound();
});

// Двойной клик по ползунку возвращает значение по умолчанию
function dblReset(el, fn) {
  el.addEventListener('dblclick', () => {
    fn();
    fxUpdateAll();
    syncSoundSheet();
  });
}

dblReset(sndVolEl, () => { musicVol = 1; applyVolumes(); });
dblReset(sndFadeInEl, () => { setEffects({ fadeIn: 0 }); restartToHear(); });
dblReset(sndFadeOutEl, () => { setEffects({ fadeOut: 0 }); restartToHear(); });
dblReset(sndRevEl, () => {
  setAudioFx({ reverb: 0 });
  if (musicFx) musicFx.setAmount(audioFx.reverb);
});
eqRows.forEach(([k, el]) => dblReset(el, () => setAudioFx({ [k]: AUDIO_FX_DEFAULTS[k] })));
moreRows.forEach(([k, el]) => dblReset(el, () => setAudioFx({ [k]: AUDIO_FX_DEFAULTS[k] })));
dblReset(sndFilterEl, () => setAudioFx({ filter: 0, filterMode: 0 }));
// ---------- стерео, лоу-фай, хорус / фленджер / тремоло ----------

const sndWideEl = document.getElementById('sndWide');
const sndWideOut = document.getElementById('sndWideOut');
const sndLofiEl = document.getElementById('sndLofi');
const sndLofiOut = document.getElementById('sndLofiOut');
const sndModEl = document.getElementById('sndMod');
const sndModOut = document.getElementById('sndModOut');
const sndModRateEl = document.getElementById('sndModRate');
const sndModRateOut = document.getElementById('sndModRateOut');
const sndModMode = document.getElementById('sndModMode');
const MOD_MODES = [['Без модуляции', 0], ['Хорус', 1], ['Фленджер', 2], ['Тремоло', 3]];
const fx2Rows = [
  ['wide', sndWideEl, sndWideOut, offText],
  ['lofi', sndLofiEl, sndLofiOut, offText],
  ['modDepth', sndModEl, sndModOut, pctText],
  ['modRate', sndModRateEl, sndModRateOut, hzText]
];

function syncFx2() {
  fx2Rows.forEach(([k, el, out, f]) => {
    el.value = String(Math.round(audioFx[k] * 100));
    fillRange(el);
    out.textContent = f(audioFx[k]);
  });
  Array.from(sndModMode.children).forEach((b, i) => {
    b.classList.toggle('active', MOD_MODES[i][1] === Math.round(audioFx.modMode));
  });
}

fx2Rows.forEach(([k, el]) => {
  el.addEventListener('input', () => {
    setAudioFx({ [k]: Number(el.value) / 100 });
    fxUpdateAll();
    syncFx2();
  });
  el.addEventListener('dblclick', () => {
    setAudioFx({ [k]: AUDIO_FX_DEFAULTS[k] });
    fxUpdateAll();
    syncFx2();
  });
});

MOD_MODES.forEach((d) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'viz-chip';
  b.textContent = d[0];
  b.addEventListener('click', () => {
    setAudioFx({ modMode: d[1] });
    fxUpdateAll();
    syncFx2();
  });
  sndModMode.append(b);
});
// ---------- пресеты звука ----------

const sndPresets = document.getElementById('sndPresets');
const SOUND_PRESETS = [
  ['Обычный', {}],
  ['Slowed + Reverb', { reverb: 0.55, lofi: 0.2, bass: 0.2, treble: -0.15 }],
  ['Бас', { bass: 0.7, mid: -0.05, treble: -0.1 }],
  ['Радио', { filterMode: 3, filter: 0.8 }],
  ['Под водой', { filterMode: 1, filter: 0.8, reverb: 0.2 }],
  ['8D', { d8: 1, d8Speed: 0.2, reverb: 0.25 }]
];

function syncPresets() {
  Array.from(sndPresets.children).forEach((b, i) => {
    const want = Object.assign({}, AUDIO_FX_DEFAULTS, SOUND_PRESETS[i][1]);
    const same = Object.keys(want).every((k) => Math.abs(want[k] - audioFx[k]) < 0.006);
    b.classList.toggle('active', same);
  });
}

SOUND_PRESETS.forEach((p) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'viz-chip';
  b.textContent = p[0];
  b.addEventListener('click', () => {
    buzz();
    setAudioFx(Object.assign({}, AUDIO_FX_DEFAULTS, p[1]));
    if (musicFx) musicFx.setAmount(audioFx.reverb);
    fxUpdateAll();
    syncSoundSheet();
  });
  sndPresets.append(b);
});

audioBox.addEventListener('input', syncPresets);
audioBox.addEventListener('click', syncPresets);
// ---------- скачать аудио: MP3 / WAV, любой фрагмент ----------

const sndExpCv = document.getElementById('sndExpWave');
const sndExpFromOut = document.getElementById('sndExpFromOut');
const sndExpToOut = document.getElementById('sndExpToOut');
const sndExpInfo = document.getElementById('sndExpInfo');
const sndExpMp3 = document.getElementById('sndExpMp3');
const sndExpWav = document.getElementById('sndExpWav');
const EXP_MIN = 0.5;
let expBuf = null;
let expFrom = 0;
let expTo = 0;
let audioBusy = false;

function expTime(s) {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
}

function syncExport() {
  if (!buffer) return;
  const dur = buffer.duration;
  if (expBuf !== buffer) {
    expBuf = buffer;
    expFrom = clipStart;
    expTo = Math.min(dur, clipStart + duration);
  }
  expFrom = clamp(expFrom, 0, Math.max(0, dur - EXP_MIN));
  expTo = clamp(expTo, Math.min(dur, expFrom + EXP_MIN), dur);
  sndExpFromOut.textContent = expTime(expFrom);
  sndExpToOut.textContent = expTime(expTo);
  drawExpWave();
  if (!audioBusy) sndExpInfo.textContent = 'Длина файла: ' + (expTo - expFrom).toFixed(1) + ' с из ' + dur.toFixed(1) + ' с.';
}

// --- волна с рамкой ---

const EXP_BARS = 240;
let expPeaks = null;
let expPeaksBuf = null;
let expSrc = null;
let expStartAt = 0;
let expPlayFrom = 0;
let expPlayhead = -1;
let expRaf = 0;
let expDrag = null;
let expLastPrev = 0;

function expGetPeaks() {
  if (expPeaks && expPeaksBuf === buffer) return expPeaks;
  const ch = buffer.getChannelData(0);
  const n = EXP_BARS;
  const per = ch.length / n;
  const stride = Math.max(1, Math.floor(per / 80));
  const out = new Float32Array(n);
  let top = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * per);
    const b = Math.min(ch.length, Math.floor((i + 1) * per));
    let m = 0;
    for (let j = a; j < b; j += stride) {
      const v = ch[j] < 0 ? -ch[j] : ch[j];
      if (v > m) m = v;
    }
    out[i] = m;
    if (m > top) top = m;
  }
  if (top > 0) for (let i = 0; i < n; i++) out[i] /= top;
  expPeaks = out;
  expPeaksBuf = buffer;
  return out;
}

function drawExpWave() {
  if (!buffer || !sndExpCv.clientWidth || !sndExpCv.clientHeight) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(sndExpCv.clientWidth * dpr));
  const h = Math.max(1, Math.round(sndExpCv.clientHeight * dpr));
  if (sndExpCv.width !== w || sndExpCv.height !== h) {
    sndExpCv.width = w;
    sndExpCv.height = h;
  }
  const g = sndExpCv.getContext('2d');
  g.clearRect(0, 0, w, h);
  const pk = expGetPeaks();
  const dur = buffer.duration;
  const x0 = (expFrom / dur) * w;
  const x1 = (expTo / dur) * w;
  const bw = w / pk.length;
  const mid = h / 2;
  const lw = Math.max(2, Math.round(w / 220));
  const px = expPlayhead >= 0 ? (expPlayhead / dur) * w : -1;

  // Все столбики собираются в один контур: так быстрее, чем рисовать по одному.
  const barW = bw * 0.6;
  const bars = new Path2D();
  for (let i = 0; i < pk.length; i++) {
    const bh = Math.max(barW, pk[i] * h * 0.8);
    const bx = i * bw + bw * 0.2;
    if (bars.roundRect) bars.roundRect(bx, mid - bh / 2, barW, bh, barW / 2);
    else bars.rect(bx, mid - bh / 2, barW, bh);
  }

  // 1. Весь трек: тусклый «призрак».
  g.fillStyle = 'rgba(255, 255, 255, 0.16)';
  g.fill(bars);

  // 2. Фон выбранного куска.
  // Флаг Таджикистана: красная, белая (шире), зелёная полоса, пропорции 2:3:2.
  const grad = g.createLinearGradient(0, h * 0.1, 0, h * 0.9);
  grad.addColorStop(0, '#ff2f3f');
  grad.addColorStop(0.27, '#ff2f3f');
  grad.addColorStop(0.31, '#ffffff');
  grad.addColorStop(0.69, '#ffffff');
  grad.addColorStop(0.73, '#14b85a');
  grad.addColorStop(1, '#14b85a');
  const back = g.createLinearGradient(0, 0, 0, h);
  back.addColorStop(0, 'rgba(255, 47, 63, 0.18)');
  back.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
  back.addColorStop(1, 'rgba(20, 184, 90, 0.18)');
  g.fillStyle = back;
  g.fillRect(x0, 0, x1 - x0, h);

  // 3. Столбики куска: впереди приглушённо, проигранная часть горит полностью.
  g.save();
  g.beginPath();
  g.rect(x0, 0, x1 - x0, h);
  g.clip();
  g.fillStyle = grad;
  g.globalAlpha = 0.68;
  g.fill(bars);
  if (px > x0) {
    g.beginPath();
    g.rect(x0, 0, px - x0, h);
    g.clip();
    g.globalAlpha = 1;
    g.fill(bars);
  }
  g.restore();

  // 4. Рамка: градиентные линии сверху и снизу и две ручки-капсулы по краям.
  g.fillStyle = grad;
  g.fillRect(x0, 0, x1 - x0, lw);
  g.fillRect(x0, h - lw, x1 - x0, lw);

  const hw = lw * 3;
  const hh = h * 0.5;
  const hy = (h - hh) / 2;
  g.save();
  g.fillStyle = '#ffffff';
  g.shadowColor = 'rgba(248, 195, 0, 0.95)';
  g.shadowBlur = lw * 5;
  g.beginPath();
  if (g.roundRect) g.roundRect(x0, hy, hw, hh, hw / 2);
  else g.rect(x0, hy, hw, hh);
  g.fill();
  g.beginPath();
  if (g.roundRect) g.roundRect(x1 - hw, hy, hw, hh, hw / 2);
  else g.rect(x1 - hw, hy, hw, hh);
  g.fill();
  g.restore();

  // 5. Плейхед: световой след, линия со свечением и «головка».
  if (px >= 0) {
    const gw = Math.max(8, w * 0.025);
    const trail = g.createLinearGradient(px - gw, 0, px + gw, 0);
    trail.addColorStop(0, 'rgba(248, 195, 0, 0)');
    trail.addColorStop(0.5, 'rgba(248, 195, 0, 0.3)');
    trail.addColorStop(1, 'rgba(248, 195, 0, 0)');
    g.fillStyle = trail;
    g.fillRect(px - gw, 0, gw * 2, h);

    g.save();
    g.fillStyle = '#ffd54a';
    g.shadowColor = '#f8c300';
    g.shadowBlur = lw * 6;
    g.fillRect(px - lw / 2, 0, lw, h);
    g.beginPath();
    g.arc(px, lw * 2, lw * 2, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
}
function expTick() {
  expRaf = 0;
  if (!expSrc || !audioCtx) return;
  expPlayhead = expPlayFrom + (audioCtx.currentTime - expStartAt);
  drawExpWave();
  expRaf = requestAnimationFrame(expTick);
}

// Играет кусок трека через ту же цепочку эффектов, что и обычное воспроизведение.
function startExpPreview(from, len) {
  if (!buffer || audioBusy || exporting) return;
  if (playing) stopPlayback(false);
  stopExpPreview();
  const ac = ensureAudio();
  if (ac.state === 'suspended') ac.resume();
  resetGains();
  const s = ac.createBufferSource();
  s.buffer = buffer;
  s.connect(musicEq.input);
  s.start(0, from, Math.max(0.05, len));
  if (musicLofi) musicLofi.start();
  expSrc = s;
  expStartAt = ac.currentTime;
  expPlayFrom = from;
  expPlayhead = from;
  s.onended = () => {
    if (expSrc === s) stopExpPreview();
  };
  if (!expRaf) expRaf = requestAnimationFrame(expTick);
}

function stopExpPreview() {
  if (!expSrc) return;
  const s = expSrc;
  expSrc = null;
  try { s.onended = null; s.stop(); } catch (e) {}
  try { s.disconnect(); } catch (e) {}
  if (musicFx) musicFx.flush();
  if (musicEcho) musicEcho.flush();
  if (musicLofi) musicLofi.stop();
  expPlayhead = -1;
  drawExpWave();
}

function expX(e) {
  const r = sndExpCv.getBoundingClientRect();
  return clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1);
}

function expMove(t) {
  const d = expDrag;
  const dur = buffer.duration;
  if (d.mode === 'a') {
    expFrom = clamp(t - d.off, 0, Math.max(0, expTo - EXP_MIN));
  } else if (d.mode === 'b') {
    expTo = clamp(t - d.off, Math.min(dur, expFrom + EXP_MIN), dur);
  } else {
    const a = clamp(t - d.off, 0, Math.max(0, dur - d.len));
    expFrom = a;
    expTo = a + d.len;
  }
  syncExport();
  // пока тянем: короткий кусок у той границы, которую двигаем
  const now = performance.now();
  if (now - expLastPrev < 140) return;
  expLastPrev = now;
  const snip = Math.min(1.5, expTo - expFrom);
  if (d.mode === 'b') startExpPreview(Math.max(expFrom, expTo - snip), snip);
  else startExpPreview(expFrom, snip);
}

sndExpCv.addEventListener('pointerdown', (e) => {
  if (!buffer || audioBusy || exporting) return;
  const dur = buffer.duration;
  const r = sndExpCv.getBoundingClientRect();
  const x = e.clientX - r.left;
  const t = expX(e) * dur;
  const pxOf = (s) => (s / dur) * r.width;
  const dA = Math.abs(x - pxOf(expFrom));
  const dB = Math.abs(x - pxOf(expTo));
  let mode;
  let off = 0;
  if (Math.min(dA, dB) <= 22) {
    mode = dA <= dB ? 'a' : 'b';
    off = t - (mode === 'a' ? expFrom : expTo);
  } else if (t > expFrom && t < expTo) {
    mode = 'mv';
    off = t - expFrom;
  } else {
    mode = t < expFrom ? 'a' : 'b';
  }
  expDrag = { pid: e.pointerId, mode: mode, off: off, len: expTo - expFrom };
  try { sndExpCv.setPointerCapture(e.pointerId); } catch (err) {}
  e.preventDefault();
  expLastPrev = 0;
  expMove(t);
});

sndExpCv.addEventListener('pointermove', (e) => {
  if (!expDrag || e.pointerId !== expDrag.pid) return;
  expMove(expX(e) * buffer.duration);
});

function expEnd(e) {
  if (!expDrag || e.pointerId !== expDrag.pid) return;
  expDrag = null;
  startExpPreview(expFrom, expTo - expFrom);
}

sndExpCv.addEventListener('pointerup', expEnd);
sndExpCv.addEventListener('pointercancel', expEnd);

// Окно «Звук» открылось: холст был скрыт, перерисовываем. Закрылось: глушим предпрослушивание.
new MutationObserver(() => {
  if (audioBox.hidden) stopExpPreview();
  else requestAnimationFrame(drawExpWave);
}).observe(audioBox, { attributes: true, attributeFilter: ['hidden'] });
window.addEventListener('resize', drawExpWave);
document.getElementById('sndExpClip').addEventListener('click', () => {
  if (!buffer) return;
  expFrom = clipStart;
  expTo = Math.min(buffer.duration, clipStart + duration);
  syncExport();
});

document.getElementById('sndExpAll').addEventListener('click', () => {
  if (!buffer) return;
  expFrom = 0;
  expTo = buffer.duration;
  syncExport();
});

function audioFileName(ext) {
  let n = trackInfo.textContent.replace(/ · \d+ BPM$/, '').replace(/\.[^.]+$/, '');
  n = n.replace(/[^\wА-Яа-яЁё-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'track';
  return '992muz_' + n + '_' + Math.round(expFrom) + 's-' + Math.round(expTo) + 's.' + ext;
}

async function downloadAudio(format) {
  if (!buffer || audioBusy || exporting) return;
  audioBusy = true;
  stopPlayback(true);
  sndExpMp3.disabled = true;
  sndExpWav.disabled = true;
  try {
    const blob = await exportAudio({
      buffer: buffer,
      from: expFrom,
      duration: expTo - expFrom,
      musicVol: musicVol,
      format: format,
      onProgress: (f, label) => {
        sndExpInfo.textContent = label + ' ' + Math.round(f * 100) + '%';
      }
    });
    const name = audioFileName(format === 'wav' ? 'wav' : 'mp3');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    audioBusy = false;
    sndExpInfo.textContent = 'Готово: ' + name + ' (' + (blob.size / 1048576).toFixed(1) + ' МБ).';
  } catch (e) {
    console.error(e);
    audioBusy = false;
    sndExpInfo.textContent = 'Не удалось создать файл: ' + (e && e.message ? e.message : 'неизвестная ошибка');
  } finally {
    audioBusy = false;
    sndExpMp3.disabled = false;
    sndExpWav.disabled = false;
  }
}

sndExpMp3.addEventListener('click', () => downloadAudio('mp3'));
sndExpWav.addEventListener('click', () => downloadAudio('wav'));
sndClose.addEventListener('click', () => {
  stopPlayback(true);
  audioBox.hidden = true;
});

document.getElementById('sndX').addEventListener('click', () => sndClose.click());
audioBox.addEventListener('pointerdown', (e) => {
  if (e.target === audioBox) audioBox.hidden = true;
});

sndPlay.addEventListener('click', () => playBtn.click());

function syncSndPlay() {
  sndPlay.disabled = playBtn.disabled;
  sndPlay.classList.toggle('playing', playBtn.classList.contains('playing'));
}

new MutationObserver(syncSndPlay).observe(playBtn, { attributes: true, attributeFilter: ['class', 'disabled'] });
syncSndPlay();


// Кнопка ▶ прямо в окне «Выберите фрагмент»: слушать фрагмент, не закрывая окно.
const wavePlay = document.getElementById('wavePlay');
wavePlay.addEventListener('click', () => playBtn.click());

function syncWavePlay() {
  wavePlay.disabled = playBtn.disabled;
  wavePlay.classList.toggle('playing', playBtn.classList.contains('playing'));
}

new MutationObserver(syncWavePlay).observe(playBtn, { attributes: true, attributeFilter: ['class', 'disabled'] });
syncWavePlay();


// Быстрый вход в панель «Звук» прямо из окна выбора фрагмента.
document.getElementById('waveSoundBtn').addEventListener('click', () => soundBtn.click());
// ---------- «Лучший момент» и привязка рамки к биту ----------

let snapOn = false;
let wholeGrid = null;
let wholeGridBuf = null;

// Темп и сетка ударов для всего трека. Считается один раз при первом включении «По биту».
function trackGrid() {
  if (!buffer) return null;
  if (wholeGridBuf !== buffer) {
    wholeGridBuf = buffer;
    try {
      wholeGrid = analyzeBeats(buffer, 0, buffer.duration);
    } catch (e) {
      wholeGrid = null;
    }
  }
  return wholeGrid;
}

// Подтягивает начало фрагмента к ближайшему удару.
function snapStart(t) {
  if (!snapOn || !wholeGrid || wholeGridBuf !== buffer) return t;
  const k = Math.round((t - wholeGrid.first) / wholeGrid.period);
  return Math.max(0, wholeGrid.first + k * wholeGrid.period);
}

function resetSnap() {
  snapOn = false;
  wholeGrid = null;
  wholeGridBuf = null;
  snapBtn.classList.remove('active');
  snapBtn.setAttribute('aria-pressed', 'false');
  snapBtn.textContent = 'По биту';
}

snapBtn.addEventListener('click', () => {
  if (!buffer || exporting) return;
  if (snapOn) {
    snapOn = false;
    snapBtn.classList.remove('active');
    snapBtn.setAttribute('aria-pressed', 'false');
    snapBtn.textContent = 'По биту';
    return;
  }
  snapBtn.textContent = 'Считаю темп…';
  setTimeout(() => {
    const g = trackGrid();
    if (!g) {
      snapBtn.textContent = 'По биту';
      waveHint.textContent = 'Не удалось определить темп этого трека.';
      return;
    }
    snapOn = true;
    snapBtn.classList.add('active');
    snapBtn.setAttribute('aria-pressed', 'true');
    snapBtn.textContent = 'По биту · ' + Math.round(g.bpm) + ' BPM';
    stopPlayback(true);
    picker.setStart(picker.getStart());
  }, 30);
});

bestBtn.addEventListener('click', () => {
  if (!buffer || exporting) return;
  stopPlayback(true);
  picker.findBest();
});
const frameEl = document.querySelector('.viz-frame');

const formatBox = document.getElementById('formatBox');

function applyFormat(id) {
  setFormat(id);
  canvas.width = VIZ_W;
  canvas.height = VIZ_H;
  frameEl.style.setProperty('--fw', String(VIZ_W));
  frameEl.style.setProperty('--fh', String(VIZ_H));
  document.body.classList.toggle('fmt-wide', VIZ_W > VIZ_H);
  if (!playing) drawIdle(startOffset);
}

formatBox.addEventListener('click', (e) => {
  const chip = e.target.closest('.viz-chip');
  if (!chip || exporting) return;
  formatBox.querySelectorAll('.viz-chip').forEach((c) => c.classList.toggle('active', c === chip));
  applyFormat(chip.dataset.format);
});
frameEl.addEventListener('click', (e) => {
    if (e.target.closest('.viz-hud') || wavePanelOpen || openTab === 'text' || openTab === 'layers') return;
  if (!emptyEl.classList.contains('hidden')) return;
  frameEl.classList.toggle('hud-off');
});
let audioCtx = null;
let analyser = null;
let freqData = null;
let buffer = null;
let duration = 0;

let source = null;
let playing = false;
let startedAt = 0;
let startOffset = 0;
let rafId = 0;

const bars = new Float32Array(BAR_COUNT);
const styleBox = document.getElementById('styleBox');
styleBox.addEventListener('click', (e) => {
  if (e.target.closest('#audioAskBtn')) fileInput.click();
});
let currentStyle = 'none';

styleBox.addEventListener('click', (e) => {
  const chip = e.target.closest('.viz-chip');
  if (!chip || exporting) return;
  currentStyle = chip.dataset.style;
  styleBox.querySelectorAll('.viz-chip').forEach((c) => c.classList.toggle('active', c === chip));
  if (mediaReady()) {
    if (!playing) drawIdle(startOffset);
  } else {
    emptyEl.classList.add('has-demo');
    const hint = emptyEl.querySelector('.viz-pick-hint');
    if (hint) hint.textContent = 'Это демо стиля. Добавьте трек, и волны оживут под вашу музыку.';
    startDemo();
  }
});
let demoId = 0;
let demoT0 = 0;

function demoFrame(now) {
  if (mediaReady() || currentStyle === 'none') {
    demoId = 0;
    return;
  }
  const t = (now - demoT0) / 1000;
  for (let i = 0; i < BAR_COUNT; i++) {
    const k = i / BAR_COUNT;
    const waveA = 0.5 + 0.5 * Math.sin(t * 2.4 + i * 0.45);
    const waveB = 0.5 + 0.5 * Math.sin(t * 1.3 - i * 0.2);
    const beat = Math.pow(Math.max(0, Math.sin(t * 6)), 4) * (1 - k);
    bars[i] = Math.min(1, (0.12 + waveA * waveB * 0.5 + beat * 0.35) * (1 - k * 0.5));
  }
  drawWaves(ctx, bars, t, currentStyle);
  demoId = requestAnimationFrame(demoFrame);
}

function startDemo() {
  if (demoId || mediaReady() || currentStyle === 'none') return;
  demoT0 = performance.now();
  demoId = requestAnimationFrame(demoFrame);
}

function stopDemo() {
  if (demoId) cancelAnimationFrame(demoId);
  demoId = 0;
}
function setStatus(text, ok) {
  statusEl.textContent = text || '';
  statusEl.classList.toggle('ok', !!ok);
}

function fmt(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.78;
    analyser.connect(audioCtx.destination);
        musicGain = audioCtx.createGain();
    musicGain.gain.value = musicVol;
    musicFx = createReverb(audioCtx, audioFx.reverb);
    musicFx.output.connect(musicGain);
    musicEq = createEq(audioCtx);
    musicEcho = createEcho(audioCtx);
    musicSpatial = createSpatial(audioCtx);
    musicFilter = createFilter(audioCtx);
    musicLofi = createLofi(audioCtx);
    musicMod = createMod(audioCtx);
    musicWide = createWide(audioCtx);
    musicEq.output.connect(musicEcho.input);
    musicEcho.output.connect(musicLofi.input);
    musicLofi.output.connect(musicMod.input);
    musicMod.output.connect(musicFilter.input);
    musicFilter.output.connect(musicWide.input);
    musicWide.output.connect(musicSpatial.input);
    musicSpatial.output.connect(musicFx.input);
    masterLimiter = createLimiter(audioCtx);
    masterLimiter.connect(analyser);
    musicGain.connect(masterLimiter);
    freqData = new Uint8Array(analyser.frequencyBinCount);
  }
  return audioCtx;
}

function currentPos() {
  if (!playing) return startOffset;
  return startOffset + (audioCtx.currentTime - startedAt);
}

function paintIdle(pos) {
  if (wavePanelOpen && currentStyle !== 'none') {
    fillDemoBars(1.2);
    drawWaves(ctx, bars, pos || 0, currentStyle);
    return;
  }
  bars.fill(0);
  drawWaves(ctx, bars, pos || 0, mediaReady() ? currentStyle : 'none');
}

function drawIdle(pos) {
  videoSeekIdle(pos || 0);
  paintIdle(pos);
}
function updateUi(pos) {
  seek.value = duration ? Math.round((pos / duration) * 1000) : 0;
  timeLabel.textContent = `${fmt(pos)} / ${fmt(duration)}`;
  picker.setPlayhead(pos);
}
function tick() {
  if (!playing) return;
  const pos = currentPos();

  if (pos >= duration) {
    if (loopOn) {
      killSource();
      startOffset = 0;
      startPlayback();
      return;
    }
    stopPlayback(true);
    return;
  }
  syncVideoDrift(pos);
  analyser.getByteFrequencyData(freqData);
  spectrumToBars(freqData, bars);
  drawWaves(ctx, bars, pos, currentStyle);
  updateUi(pos);
  rafId = requestAnimationFrame(tick);
}

let beatBuf = null;
let beatSig = '';

// Считает BPM и сетку ударов для выбранного фрагмента (только если фрагмент или трек поменялись).
function ensureBeats() {
  if (!buffer) {
    if (beatBuf) {
      beatBuf = null;
      beatSig = '';
      setBeatGrid(null);
    }
    return;
  }
  const sig = clipStart.toFixed(2) + '|' + duration.toFixed(2);
  if (beatBuf === buffer && beatSig === sig) return;
  beatBuf = buffer;
  beatSig = sig;
  let grid = null;
  try {
    grid = analyzeBeats(buffer, clipStart, duration);
  } catch (e) {
    grid = null;
  }
  setBeatGrid(grid);
  if (musicEcho) musicEcho.update();
  const base = trackInfo.textContent.replace(/ · \d+ BPM$/, '');
  trackInfo.textContent = grid ? `${base} · ${Math.round(grid.bpm)} BPM` : base;
}

// Плавное вступление и затухание звука при воспроизведении.
function scheduleFades(ac) {
  const fi = Math.min(effects.fadeIn || 0, duration / 2);
  const fo = Math.min(effects.fadeOut || 0, duration / 2);
  const now = ac.currentTime;
  [[musicGain, musicVol], [videoGain, videoVol]].forEach(([g, vol]) => {
    if (!g) return;
    const p = g.gain;
    p.cancelScheduledValues(now);
    let k = 1;
    if (fi > 0 && startOffset < fi) k = Math.min(k, startOffset / fi);
    if (fo > 0 && startOffset > duration - fo) k = Math.min(k, Math.max(0, (duration - startOffset) / fo));
    p.setValueAtTime(vol * k, now);
    if (fi > 0 && startOffset < fi) p.linearRampToValueAtTime(vol, now + (fi - startOffset));
    if (fo > 0) {
      const from = duration - fo;
      if (startOffset < from) p.setValueAtTime(vol, now + (from - startOffset));
      p.linearRampToValueAtTime(0, now + (duration - startOffset));
    }
  });
}

// Возвращает громкость в норму (после паузы, перемотки, остановки).
function resetGains() {
  [[musicGain, musicVol], [videoGain, videoVol]].forEach(([g, vol]) => {
    if (!g) return;
    g.gain.cancelScheduledValues(0);
    g.gain.value = vol;
  });
}

function startPlayback() {
  if (!buffer && !hasVideo()) return;
  stopExpPreview();
  ensureBeats();
  const ac = ensureAudio();
  if (ac.state === 'suspended') ac.resume();

  if (buffer) {
    source = ac.createBufferSource();
    source.buffer = buffer;
          source.connect(musicEq.input);
    source.start(0, clipStart + startOffset, duration - startOffset);
  }

  startedAt = ac.currentTime;
  playing = true;
  scheduleFades(ac);
  if (buffer && musicLofi) musicLofi.start();
  playVideoFrom(startOffset);
  playBtn.classList.add('playing');
  rafId = requestAnimationFrame(tick);
}
function pausePlayback() {
  if (!playing) return;
  startOffset = currentPos();
  killSource();
  playing = false;
  cancelAnimationFrame(rafId);
  playBtn.classList.remove('playing');
}

function stopPlayback(reset) {
  killSource();
  playing = false;
  cancelAnimationFrame(rafId);
  playBtn.classList.remove('playing');
  if (reset) {
    startOffset = 0;
    drawIdle(0);
    updateUi(0);
  }
}

function killSource() {
  stopExpPreview();
  resetGains();
  if (musicFx) musicFx.flush();
  if (musicEcho) musicEcho.flush();
  if (musicLofi) musicLofi.stop();
  if (videoEl) videoEl.pause();
  if (source) {
    try { source.onended = null; source.stop(); } catch (e) {}
    try { source.disconnect(); } catch (e) {}
    source = null;
  }
}

async function loadFile(file) {
  stopPlayback(true);
  buffer = null;
  duration = 0;
  playBtn.disabled = true;
    waveBox.hidden = true;
  picker.clear();
    editClipBtn.hidden = true;
  exportBtn.disabled = true;
  clearResult();
  seek.disabled = true;
  setStatus('');

  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    setStatus(`Файл слишком большой (максимум ${MAX_FILE_MB} МБ).`);
    restoreVideoOnly();
    return;
  }

  setStatus('Читаю трек…', true);

  try {
    const ac = ensureAudio();
    const data = await file.arrayBuffer();
    buffer = await ac.decodeAudioData(data);
  } catch (e) {
    buffer = null;
       setStatus('Не удалось прочитать файл. Используйте MP3, WAV или M4A.');
    restoreVideoOnly();
    return;
  }

  duration = Math.min(buffer.duration, clipSeconds);
  startOffset = 0;

  clipStart = 0;
  trackInfo.textContent = file.name;
  ensureBeats();
  waveBox.hidden = false;
    setTransparentMode(false);
  picker.setTrack(buffer, duration);
    resetSnap();
  showClipRange();
  stopDemo();
  emptyEl.classList.add('hidden');
    syncVideoBtn();
  playBtn.disabled = false;
  exportBtn.disabled = false;
  seek.disabled = false;
  drawIdle(0);
  updateUi(0);
    renderOvl();
  setStatus('Трек загружен. Выберите фрагмент и нажмите «Применить».', true);
}
applyBtn.addEventListener('click', () => {
  if (!buffer) return;
  stopPlayback(true);
  ensureBeats();
  waveBox.hidden = true;
  editClipBtn.hidden = false;
  editClipBtn.textContent = `${fmt(clipStart)} – ${fmt(clipStart + duration)}`;
  setStatus('Фрагмент выбран. Нажмите ▶ на экране.', true);
});
// ---------- отмена выбора фрагмента (десктоп) ----------
let waveOpenStart = 0;
new MutationObserver(() => {
  if (!waveBox.hidden) waveOpenStart = clipStart;
}).observe(waveBox, { attributes: true, attributeFilter: ['hidden'] });

function cancelWaveSheet() {
  if (waveBox.hidden) return;
  stopPlayback(true);
  if (buffer) {
    clipStart = picker.setStart(waveOpenStart);
    showClipRange();
    editClipBtn.hidden = false;
    editClipBtn.textContent = `${fmt(clipStart)} – ${fmt(clipStart + duration)}`;
    setStatus('Фрагмент выбран. Нажмите ▶ на экране.', true);
  }
  waveBox.hidden = true;
}

document.getElementById('waveCancelBtn').addEventListener('click', cancelWaveSheet);
document.getElementById('waveCloseBtn').addEventListener('click', cancelWaveSheet);

waveBox.addEventListener('pointerdown', (e) => {
  if (e.target !== waveBox) return;
  if (!window.matchMedia('(min-width: 1024px)').matches) return;
  cancelWaveSheet();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || waveBox.hidden) return;
  if (!window.matchMedia('(min-width: 1024px)').matches) return;
  cancelWaveSheet();
});
// ---------- ТОЛЬКО КОМПЬЮТЕР: «Другой трек» → выбор источника ----------
const waveSwap = document.querySelector('#waveBox .viz-wave-swap');
const waveHeadRow = document.querySelector('#waveBox .viz-wave-head');
const waveSrcMenu = document.createElement('div');
waveSrcMenu.className = 'wave-src';
waveSrcMenu.hidden = true;
waveSrcMenu.innerHTML =
  '<button type="button" class="wave-src-item" data-src="file">' +
    '<span class="wave-src-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg></span>' +
    '<span class="wave-src-txt"><b>Со своего устройства</b><small>MP3, WAV, M4A и другие</small></span>' +
  '</button>' +
  '<button type="button" class="wave-src-item" data-src="lib">' +
    '<span class="wave-src-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg></span>' +
    '<span class="wave-src-txt"><b>Из библиотеки 992MUZ</b><small>Треки, загруженные на сайт</small></span>' +
  '</button>';
waveHeadRow.append(waveSrcMenu);

function closeWaveSrc() {
  waveSrcMenu.hidden = true;
  waveSwap.classList.remove('open');
}

waveSwap.addEventListener('click', (e) => {
  if (!window.matchMedia('(min-width: 1024px)').matches) return;
  e.preventDefault();
  waveSrcMenu.hidden = !waveSrcMenu.hidden;
  waveSwap.classList.toggle('open', !waveSrcMenu.hidden);
});

waveSrcMenu.addEventListener('click', (e) => {
  const item = e.target.closest('[data-src]');
  if (!item) return;
  closeWaveSrc();
  if (item.dataset.src === 'file') document.getElementById('audioFile').click();
  else libraryBtn.click();
});

document.addEventListener('pointerdown', (e) => {
  if (waveSrcMenu.hidden) return;
  if (e.target.closest('.wave-src') || e.target.closest('.viz-wave-swap')) return;
  closeWaveSrc();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || waveSrcMenu.hidden) return;
  e.stopPropagation();
  closeWaveSrc();
}, true);

new MutationObserver(() => {
  if (waveBox.hidden) closeWaveSrc();
}).observe(waveBox, { attributes: true, attributeFilter: ['hidden'] });
editClipBtn.addEventListener('click', () => {
  if (exporting) return;
  if (!buffer) {
    if (!hasVideo()) return;
    stopPlayback(true);
    syncVideoSheet();
    videoBox.hidden = false;
    return;
  }
  stopPlayback(true);
  waveBox.hidden = false;
  picker.refresh();
  showClipRange();
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files && fileInput.files[0];
  if (file) loadFile(file);
  fileInput.value = '';
});

playBtn.addEventListener('click', () => {
  if (playing) pausePlayback();
  else startPlayback();
});

seek.addEventListener('input', () => {
  if (!mediaReady()) return;
  const wasPlaying = playing;
  if (wasPlaying) {
    killSource();
    playing = false;
    cancelAnimationFrame(rafId);
  }
  startOffset = (seek.value / 1000) * duration;
  updateUi(startOffset);
  drawIdle(startOffset);
  if (wasPlaying) startPlayback();
});

let exporting = false;
let abortCtl = null;
let resultUrl = null;
let resultBlob = null;
const RESULT_NAME = '992muz-visualizer.mp4';

function clearResult() {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
  resultBlob = null;
  resultVideo.removeAttribute('src');
  resultVideo.load();
  resultBox.hidden = true;
  shareBtn.hidden = true;
}

function setBusy(busy) {
  exporting = busy;
  styleBox.classList.toggle('busy', busy);
  exportBtn.disabled = busy || !exportReady();
  playBtn.disabled = busy || !mediaReady();
  seek.disabled = busy || !mediaReady();
  exportProgress.hidden = !busy;
  if (busy) {
    expBar.value = 0;
    expLabel.textContent = '';
  }
}
function exportReady() {
  return mediaReady() || !!photoUrl || transparentMode;
}


async function exportImage(fmt) {
  stopPlayback(true);
  clearResult();
  closeWavePanel();
  closeCtxMenu();
  showTab(null);
  setForceShow(false);
  drawIdle(0);

  let blob = null;
  let ext = 'png';
  if (fmt === 'svg') {
    const png = canvas.toDataURL('image/png');
    const svg = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + canvas.width + '" height="' + canvas.height + '" viewBox="0 0 ' + canvas.width + ' ' + canvas.height + '">' +
      '<image width="' + canvas.width + '" height="' + canvas.height + '" xlink:href="' + png + '" href="' + png + '"/></svg>';
    blob = new Blob([svg], { type: 'image/svg+xml' });
    ext = 'svg';
  } else {
    const mime = fmt === 'jpeg' ? 'image/jpeg' : 'image/png';
    let src = canvas;
    if (fmt === 'jpeg' && transparentMode) {
      src = document.createElement('canvas');
      src.width = canvas.width;
      src.height = canvas.height;
      const g = src.getContext('2d');
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, src.width, src.height);
      g.drawImage(canvas, 0, 0);
    }
    blob = await new Promise((resolve) => src.toBlob(resolve, mime, 0.95));
    ext = fmt === 'jpeg' ? 'jpg' : 'png';
  }
  if (!blob) {
    setStatus('Не удалось сохранить картинку.');
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '992muz-photo.' + ext;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  setStatus('Картинка сохранена.', true);
}
const imgModeBox = document.getElementById('imgModeBox');

imgModeBox.querySelectorAll('[data-imgfmt]').forEach((b) => {
  b.addEventListener('click', () => {
    imgModeBox.hidden = true;
    exportImage(b.dataset.imgfmt);
  });
});

document.getElementById('imgModeCancel').addEventListener('click', () => {
  imgModeBox.hidden = true;
});

imgModeBox.addEventListener('pointerdown', (e) => {
  if (e.target === imgModeBox) imgModeBox.hidden = true;
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || imgModeBox.hidden) return;
  if (!window.matchMedia('(min-width: 1024px)').matches) return;
  imgModeBox.hidden = true;
});
exportBtn.addEventListener('click', async () => {
  if (!exportReady() || exporting) return;
  if (!mediaReady()) {
    document.getElementById('imgModeHint').hidden = !transparentMode;
    imgModeBox.hidden = false;
    return;
  }
  stopPlayback(true);
  clearResult();
  closeWavePanel();
  setStatus('Проверяю возможности устройства…', true);

  const support = await checkExportSupport();
  if (!support.ok) {
    setStatus(support.reason);
    return;
  }

  abortCtl = new AbortController();
  setBusy(true);
    setForceShow(false);
  setStatus('Создаю видео. Не закрывайте страницу и не сворачивайте браузер.', true);

  try {
        ensureBeats();
    const blob = await exportVideo({
      buffer: buffer || silentBuffer(),
      duration,
      offset: clipStart,
      canvas,
      ctx,
      support,
           signal: abortCtl.signal,
           style: currentStyle,
      musicVol: musicVol,
      video: await prepareVideoForExport(),
      onProgress: (fraction, label) => {
        expBar.value = Math.round(fraction * 100);
        expLabel.textContent = label;
      }
    });

    resultBlob = blob;
    resultUrl = URL.createObjectURL(blob);
    resultVideo.src = resultUrl;
    resultBox.hidden = false;

    try {
      const probe = new File([blob], RESULT_NAME, { type: 'video/mp4' });
      shareBtn.hidden = !(navigator.canShare && navigator.canShare({ files: [probe] }));
    } catch (e) {
      shareBtn.hidden = true;
    }

    setStatus('Готово! Проверьте ролик и сохраните его.', true);
  } catch (e) {
    console.error(e);
    if (e && e.name === 'AbortError') {
      setStatus('Создание видео отменено.');
    } else {
      setStatus('Не удалось создать видео: ' + (e && e.message ? e.message : 'неизвестная ошибка'));
    }
  } finally {
    abortCtl = null;
    setBusy(false);
    drawIdle(0);
    updateUi(0);
  }
});

cancelBtn.addEventListener('click', () => {
  if (abortCtl) abortCtl.abort();
});

saveBtn.addEventListener('click', () => {
  if (!resultUrl) return;
  const a = document.createElement('a');
  a.href = resultUrl;
  a.download = RESULT_NAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

shareBtn.addEventListener('click', async () => {
  if (!resultBlob) return;
  try {
    const file = new File([resultBlob], RESULT_NAME, { type: 'video/mp4' });
    await navigator.share({ files: [file] });
  } catch (e) {
    if (!e || e.name !== 'AbortError') setStatus('Не удалось открыть меню «Поделиться». Нажмите «Сохранить видео».');
  }
});
document.querySelectorAll('.viz-sheet').forEach((sheet) => {
  const card = sheet.querySelector('.viz-sheet-card');
  if (!card) return;

  const grip = document.createElement('div');
  grip.className = 'viz-grip';
  card.prepend(grip);

  let startY = 0;
  let dy = 0;
  let dragging = false;

  grip.addEventListener('pointerdown', (e) => {
    dragging = true;
    startY = e.clientY;
    dy = 0;
    card.style.transition = 'none';
    try { grip.setPointerCapture(e.pointerId); } catch (err) {}
  });

  grip.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dy = Math.max(0, e.clientY - startY);
    card.style.transform = `translateY(${dy}px)`;
  });

  function release() {
    if (!dragging) return;
    dragging = false;
    const close = dy > 90;
    card.style.transition = 'transform 0.2s ease';
    card.style.transform = '';
    dy = 0;
    if (!close) return;
    const main = card.querySelector('.viz-btn-primary');
    if (main) main.click();
    else sheet.hidden = true;
  }

  grip.addEventListener('pointerup', release);
  grip.addEventListener('pointercancel', release);
});
// ---------- панель настроек волн ----------

const wavePanel = document.getElementById('wavePanel');
const panelPlay = document.getElementById('panelPlay');
const panelTabs = document.getElementById('panelTabs');
const panelStyles = document.getElementById('panelStyles');
const colorModes = document.getElementById('colorModes');
const paletteBox = document.getElementById('paletteBox');
const color1 = document.getElementById('color1');
const color2 = document.getElementById('color2');
const color1Row = document.getElementById('color1Row');
const color2Row = document.getElementById('color2Row');
const bgBox = document.getElementById('bgBox');
const bgCustom = document.getElementById('bgCustom');
let wavePanelOpen = false;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pct = (v) => Math.round(v * 100) + '%';
const deg = (v) => Math.round(v) + '°';
const num = (v) => String(Math.round(v));

const SLIDERS = [
  { pane: 'shape', k: 'size', label: 'Размер', min: 0.3, max: 2.5, step: 0.01, fmt: pct },
  { pane: 'shape', k: 'stretch', label: 'Длина волн', min: 0.4, max: 2, step: 0.01, fmt: pct },
  { pane: 'shape', k: 'amp', label: 'Высота волн', min: 0.2, max: 2.5, step: 0.01, fmt: pct },
  { pane: 'shape', k: 'thick', label: 'Толщина', min: 0.3, max: 2, step: 0.01, fmt: pct },
  { pane: 'shape', k: 'rotate', label: 'Поворот', min: -180, max: 180, step: 1, fmt: deg },
  { pane: 'shape', k: 'x', label: 'Позиция X', min: -640, max: 640, step: 1, fmt: num },
  { pane: 'shape', k: 'y', label: 'Позиция Y', min: -640, max: 640, step: 1, fmt: num },
  { pane: 'motion', k: 'speed', label: 'Скорость', min: 0, max: 3, step: 0.05, fmt: (v) => '×' + v.toFixed(2) },
  { pane: 'motion', k: 'spin', label: 'Вращение', min: -60, max: 60, step: 1, fmt: (v) => Math.round(v) + '°/с' },
  { pane: 'motion', k: 'pulse', label: 'Пульсация', min: 0, max: 2, step: 0.01, fmt: pct },
    { pane: '3d', k: 'tiltX', label: 'Наклон ↕', min: -75, max: 75, step: 1, fmt: deg },
  { pane: '3d', k: 'tiltY', label: 'Поворот ↔', min: -75, max: 75, step: 1, fmt: deg },
  { pane: '3d', k: 'persp', label: 'Перспектива', min: 0.3, max: 2, step: 0.01, fmt: pct },
  { pane: 'color', k: 'opacity', label: 'Прозрачность', min: 0.1, max: 1, step: 0.01, fmt: pct },
  { pane: 'color', k: 'glow', label: 'Свечение', min: 0, max: 40, step: 1, fmt: num },
  { pane: 'color', k: 'hue', label: 'Сдвиг оттенка', min: -180, max: 180, step: 1, fmt: deg }
];

const PALETTES = [
  ['#7c3aed', '#ff4fa3'],
  ['#ff9a3c', '#ff3d6e'],
  ['#27d3ff', '#6a5cff'],
  ['#c8f0ff', '#ffffff'],
  ['#ffd23c', '#ff3b30'],
  ['#3cffb0', '#2a9dff']
];

const BG_PRESETS = [
  { name: 'Стандарт', color: '', css: 'linear-gradient(180deg, #0c0c0e, #1b1b20)' },
  { name: 'Чёрный', color: '#000000', css: '#000000' },
  { name: 'Графит', color: '#16161a', css: '#16161a' },
  { name: 'Синий', color: '#0b1226', css: '#0b1226' },
  { name: 'Бордо', color: '#2a0b17', css: '#2a0b17' },
  { name: 'Хвоя', color: '#082219', css: '#082219' },
  { name: 'Фиолет', color: '#1c0d33', css: '#1c0d33' },
  { name: 'Светлый', color: '#f2f2f4', css: '#f2f2f4' }
];

const sliderRefs = [];

SLIDERS.forEach((def) => {
  const row = document.createElement('label');
  row.className = 'viz-sl';
  const name = document.createElement('span');
  name.textContent = def.label;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(def.min);
  input.max = String(def.max);
  input.step = String(def.step);
  const out = document.createElement('output');
  row.append(name, input, out);
  wavePanel.querySelector(`.viz-pane[data-pane="${def.pane}"]`).append(row);

  input.addEventListener('input', () => {
    setWave({ [def.k]: Number(input.value) });
    fillRange(input);
    out.textContent = def.fmt(wave[def.k]);
    redrawWave();
  });

  input.addEventListener('dblclick', () => {
    setWave({ [def.k]: WAVE_DEFAULTS[def.k] });
    syncPanel();
    redrawWave();
  });

  sliderRefs.push({ def, row, input, out });
});

PALETTES.forEach(([c1, c2]) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'viz-sw';
  b.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
  b.setAttribute('aria-label', 'Палитра');
  b.addEventListener('click', () => {
    setWave({ colorMode: 'gradient', color1: c1, color2: c2 });
    syncPanel();
    redrawWave();
  });
  paletteBox.append(b);
});

BG_PRESETS.forEach((p) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'viz-sw';
  b.dataset.color = p.color;
  b.title = p.name;
  b.setAttribute('aria-label', p.name);
  b.style.background = p.css;
  b.addEventListener('click', () => {
    setWave({ bgColor: p.color });
    syncPanel();
    redrawWave();
  });
  bgBox.append(b);
});
// ---------- автоцвет: цвета волн из фото или видео фона ----------

function rgbToHsv(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: h, s: mx ? d / mx : 0, v: mx / 255 };
}

// Берёт два главных цвета картинки: самый «весомый» и второй, заметно отличающийся по оттенку.
function pickBgColors() {
  const src = getBackground();
  if (!src) return null;
  const iw = src.videoWidth || src.naturalWidth || src.width;
  const ih = src.videoHeight || src.naturalHeight || src.height;
  if (!iw || !ih) return null;
  const N = 48;
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  const g = c.getContext('2d', { willReadFrequently: true });
  let data;
  try {
    g.drawImage(src, 0, 0, N, N);
    data = g.getImageData(0, 0, N, N).data;
  } catch (e) {
    return null;
  }

  const B = 12;
  const bins = [];
  for (let i = 0; i < B; i++) bins.push({ i: i, w: 0, r: 0, g: 0, b: 0 });
  let valid = 0;
  let bright = 0;
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] < 128) continue;
    valid++;
    const r = data[p];
    const gg = data[p + 1];
    const b = data[p + 2];
    const hsv = rgbToHsv(r, gg, b);
    bright += hsv.v;
    if (hsv.v < 0.2 || hsv.s < 0.25) continue;
    const w = hsv.s * hsv.v;
    const bin = bins[Math.min(B - 1, Math.floor(hsv.h / 30))];
    bin.w += w;
    bin.r += r * w;
    bin.g += gg * w;
    bin.b += b * w;
  }
  if (!valid) return null;

  bins.sort((a, b) => b.w - a.w);
  const first = bins[0];
  // картинка почти чёрно-белая: берём светлый и серый
  if (first.w <= 0) {
    return bright / valid > 0.5 ? ['#ffffff', '#9a9aa4'] : ['#e8e8ec', '#6a6a74'];
  }

  let second = null;
  for (let k = 1; k < bins.length; k++) {
    const d = Math.abs(bins[k].i - first.i);
    if (Math.min(d, B - d) >= 2 && bins[k].w >= first.w * 0.15) {
      second = bins[k];
      break;
    }
  }

  // делаем цвета яркими, чтобы волны были видны на тёмном фоне
  const vivid = (bin) => {
    const hsv = rgbToHsv(bin.r / bin.w, bin.g / bin.w, bin.b / bin.w);
    return { h: hsv.h, s: Math.max(hsv.s, 0.55), v: Math.max(hsv.v, 0.85) };
  };
  const a = vivid(first);
  const b = second ? vivid(second) : { h: (a.h + 40) % 360, s: a.s * 0.8, v: 1 };
  return [hsvToHex(a.h, a.s, a.v), hsvToHex(b.h, b.s, b.v)];
}

const autoColorBtn = document.createElement('button');
autoColorBtn.type = 'button';
autoColorBtn.className = 'viz-btn';
autoColorBtn.textContent = '✦ Цвета из фона';
autoColorBtn.style.padding = '8px 12px';
autoColorBtn.style.fontSize = '13px';
autoColorBtn.title = 'Подобрать цвета волн под фото или видео';
paletteBox.before(autoColorBtn);

autoColorBtn.addEventListener('click', () => {
  const cols = pickBgColors();
  if (!cols) return;
  setWave({ colorMode: 'gradient', color1: cols[0], color2: cols[1] });
  syncPanel();
  redrawWave();
});
function fillDemoBars(t) {
  for (let i = 0; i < BAR_COUNT; i++) {
    const k = i / BAR_COUNT;
    const waveA = 0.5 + 0.5 * Math.sin(t * 2.4 + i * 0.45);
    const waveB = 0.5 + 0.5 * Math.sin(t * 1.3 - i * 0.2);
    const beat = Math.pow(Math.max(0, Math.sin(t * 6)), 4) * (1 - k);
    bars[i] = Math.min(1, (0.12 + waveA * waveB * 0.5 + beat * 0.35) * (1 - k * 0.5));
  }
}

function redrawWave() {
  if (playing) return;
  if (!mediaReady() && currentStyle !== 'none') return;
  drawIdle(startOffset);
}

function syncPanel() {
  sliderRefs.forEach(({ def, row, input, out }) => {
     input.value = String(wave[def.k]);
    fillRange(input);
    out.textContent = def.fmt(wave[def.k]);
    if (def.k === 'hue') row.hidden = wave.colorMode !== 'rainbow';
  });
  panelStyles.querySelectorAll('.viz-chip').forEach((c) => c.classList.toggle('active', c.dataset.style === currentStyle));
  colorModes.querySelectorAll('.viz-chip').forEach((c) => c.classList.toggle('active', c.dataset.cm === wave.colorMode));
  color1.style.background = wave.color1;
  color2.style.background = wave.color2;
  color1Row.hidden = wave.colorMode === 'rainbow';
  color2Row.hidden = wave.colorMode !== 'gradient';
  bgBox.querySelectorAll('.viz-sw').forEach((b) => b.classList.toggle('active', b.dataset.color === wave.bgColor));
  bgCustom.style.background = wave.bgColor || '#0c0c0e';
  autoColorBtn.disabled = !getBackground();
}

function openWavePanel() {
  if (exporting) return;
  if (currentStyle === 'none') {
    const first = styleBox.querySelector('.viz-chip');
    if (first) first.click();
  }
  wavePanelOpen = true;
    libraryBtn.hidden = true;
  wavePanel.hidden = false;
  frameEl.classList.add('editing');
  tabBar.querySelector('[data-tab="waves"]').classList.add('on');
  syncPanel();
  redrawWave();
}

function closeWavePanel() {
  if (!wavePanelOpen) return;
  wavePanelOpen = false;
  libraryBtn.hidden = !!openTab;
  closePicker();
  wavePanel.hidden = true;
  frameEl.classList.remove('editing');
  tabBar.querySelector('[data-tab="waves"]').classList.remove('on');
  editPtrs.clear();
  redrawWave();
}

panelTabs.addEventListener('click', (e) => {
  const t = e.target.closest('.viz-ptab');
  if (!t) return;
  closePicker();
  panelTabs.querySelectorAll('.viz-ptab').forEach((b) => b.classList.toggle('active', b === t));
  wavePanel.querySelectorAll('.viz-pane').forEach((p) => {
    p.hidden = p.dataset.pane !== t.dataset.pane;
  });
});

panelStyles.addEventListener('click', (e) => {
  const chip = e.target.closest('.viz-chip');
  if (!chip || exporting) return;
  const real = styleBox.querySelector(`.viz-chip[data-style="${chip.dataset.style}"]`);
  if (real) real.click();
  syncPanel();
  redrawWave();
});

if (window.matchMedia('(min-width: 1024px)').matches) {
  panelStyles.addEventListener('pointermove', (e) => {
    const chip = e.target.closest('.viz-chip');
    if (!chip) return;
    const r = chip.getBoundingClientRect();
    chip.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    chip.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
}
colorModes.addEventListener('click', (e) => {
  const chip = e.target.closest('.viz-chip');
  if (!chip) return;
  setWave({ colorMode: chip.dataset.cm });
  syncPanel();
  redrawWave();
});

// ---------- своя палитра цвета ----------

const cpick = document.getElementById('cpick');
const cpickSv = document.getElementById('cpickSv');
const cpickSvDot = document.getElementById('cpickSvDot');
const cpickHue = document.getElementById('cpickHue');
const cpickHueDot = document.getElementById('cpickHueDot');
const cpickPrev = document.getElementById('cpickPrev');
const cpickHex = document.getElementById('cpickHex');
let cpTarget = null;
let cpH = 0;
let cpS = 1;
let cpV = 1;

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

function cpRender(keepText) {
  const hex = hsvToHex(cpH, cpS, cpV);
  const dark = 'rgba(0, 0, 0, ' + (1 - cpV) + ')';
  cpick.style.gap = '10px';
  cpick.style.padding = '2px 10px 0';
  cpick.parentElement.style.overflowX = 'hidden';

  // колесо: чистое, без сетки, с тонким кольцом и тенью
  cpickSv.style.aspectRatio = '1 / 1';
  cpickSv.style.height = 'auto';
  cpickSv.style.width = 'min(100%, 132px)';
  cpickSv.style.margin = '0 auto';
  cpickSv.style.borderRadius = '50%';
  cpickSv.style.touchAction = 'none';
  cpickSv.style.border = '0';
  cpickSv.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.55), 0 0 0 5px rgba(255, 255, 255, 0.08), 0 8px 22px rgba(0, 0, 0, 0.55)';
  cpickSv.style.background =
    `linear-gradient(${dark}, ${dark}), ` +
    `radial-gradient(circle closest-side, #fff, rgba(255, 255, 255, 0)), ` +
    `conic-gradient(from 90deg, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))`;

  // бегунок колеса: залит выбранным цветом
  const a = (cpH * Math.PI) / 180;
  cpickSvDot.style.left = (50 + Math.cos(a) * cpS * 50) + '%';
  cpickSvDot.style.top = (50 + Math.sin(a) * cpS * 50) + '%';
  cpickSvDot.style.width = '18px';
  cpickSvDot.style.height = '18px';
  cpickSvDot.style.margin = '-9px 0 0 -9px';
  cpickSvDot.style.border = '3px solid #fff';
  cpickSvDot.style.background = hex;
  cpickSvDot.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.6)';

  // шкала яркости: гладкая полоса от чёрного до чистого цвета
  cpickHue.style.touchAction = 'none';
  cpickHue.style.height = '12px';
  cpickHue.style.border = '0';
  cpickHue.style.borderRadius = '6px';
  cpickHue.style.boxShadow = 'inset 0 0 0 1px rgba(255, 255, 255, 0.18)';
  cpickHue.style.background = `linear-gradient(to right, #000, ${hsvToHex(cpH, cpS, 1)})`;
  cpickHueDot.style.left = (cpV * 100) + '%';
  cpickHueDot.style.width = '20px';
  cpickHueDot.style.height = '20px';
  cpickHueDot.style.margin = '-10px 0 0 -10px';
  cpickHueDot.style.border = '3px solid #fff';
  cpickHueDot.style.background = hex;
  cpickHueDot.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.6)';

  // значения H / S / B в аккуратных ячейках
  let info = document.getElementById('cpickInfo');
  if (!info) {
    info = document.createElement('div');
    info.id = 'cpickInfo';
    cpickHue.after(info);
  }
  info.style.cssText = 'display: flex; justify-content: center; gap: 8px;';
  const cell = (k, v) => '<span style="display: flex; gap: 6px; align-items: baseline; padding: 3px 9px; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; background: rgba(255, 255, 255, 0.05); font: 600 12px ui-monospace, Menlo, Consolas, monospace; color: #fff;"><b style="font-size: 10px; font-weight: 600; color: rgba(255, 255, 255, 0.45);">' + k + '</b>' + v + '</span>';
  info.innerHTML = cell('H', Math.round(cpH) + '°') + cell('S', Math.round(cpS * 100) + '%') + cell('B', Math.round(cpV * 100) + '%');

  cpickPrev.style.background = hex;
  if (!keepText) cpickHex.value = hex;
  return hex;
}

function cpRenderOld(keepText) {
  const hex = hsvToHex(cpH, cpS, cpV);
  const dark = 'rgba(0, 0, 0, ' + (1 - cpV) + ')';
  const line = 'rgba(255, 255, 255, 0.32)';
  cpick.style.gap = '6px';
  cpick.style.padding = '0 9px';
  cpick.parentElement.style.overflowX = 'hidden';
  // колесо: компактное, с тонкой сеткой поверх цвета
  cpickSv.style.aspectRatio = '1 / 1';
  cpickSv.style.height = 'auto';
  cpickSv.style.width = 'min(100%, 108px)';
  cpickSv.style.margin = '0 auto';
  cpickSv.style.borderRadius = '50%';
  cpickSv.style.touchAction = 'none';
  cpickSv.style.border = '1px solid rgba(255, 255, 255, 0.35)';
  cpickSv.style.boxShadow = '0 0 0 3px rgba(255, 255, 255, 0.06), 0 0 18px rgba(0, 0, 0, 0.5)';
  cpickSv.style.background =
    `linear-gradient(${line}, ${line}) center / 1px 100% no-repeat, ` +
    `linear-gradient(${line}, ${line}) center / 100% 1px no-repeat, ` +
    `repeating-radial-gradient(circle closest-side, transparent 0, transparent calc(25% - 1px), ${line} calc(25% - 1px), ${line} 25%), ` +
    `linear-gradient(${dark}, ${dark}), ` +
    `radial-gradient(circle closest-side, #fff, rgba(255, 255, 255, 0)), ` +
    `conic-gradient(from 90deg, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))`;
  const a = (cpH * Math.PI) / 180;
  cpickSvDot.style.left = (50 + Math.cos(a) * cpS * 50) + '%';
  cpickSvDot.style.top = (50 + Math.sin(a) * cpS * 50) + '%';
  cpickSvDot.style.width = '14px';
  cpickSvDot.style.height = '14px';
  cpickSvDot.style.margin = '-7px 0 0 -7px';
  // полоска яркости: от чёрного до чистого цвета, сверху тонкие риски
  cpickHue.style.touchAction = 'none';
  cpickHue.style.height = '10px';
  cpickHue.style.border = '1px solid rgba(255, 255, 255, 0.25)';
  cpickHue.style.background =
    `repeating-linear-gradient(to right, rgba(255, 255, 255, 0.4) 0, rgba(255, 255, 255, 0.4) 1px, transparent 1px, transparent 10%), ` +
    `linear-gradient(to right, #000, ${hsvToHex(cpH, cpS, 1)})`;
  cpickHueDot.style.left = (cpV * 100) + '%';
  // строка значений H / S / B
  let info = document.getElementById('cpickInfo');
  if (!info) {
    info = document.createElement('div');
    info.id = 'cpickInfo';
    info.style.cssText = 'text-align: center; font: 600 10px ui-monospace, Menlo, Consolas, monospace; letter-spacing: 0.6px; color: rgba(255, 255, 255, 0.5);';
    cpickHue.after(info);
  }
  info.textContent = 'H ' + Math.round(cpH) + '°   S ' + Math.round(cpS * 100) + '%   B ' + Math.round(cpV * 100) + '%';
  cpickPrev.style.background = hex;
  if (!keepText) cpickHex.value = hex;
  return hex;
}
function cpApply(keepText) {
  const hex = cpRender(keepText);
  setWave({ [cpTarget]: hex });
  syncPanel();
  redrawWave();
}

function openPicker(target) {
  cpTarget = target;
  const cur = target === 'bgColor' ? (wave.bgColor || '#0c0c0e') : wave[target];
  const hsv = hexToHsv(cur) || { h: 0, s: 1, v: 1 };
  cpH = hsv.h;
  cpS = hsv.s;
  cpV = hsv.v;
  wavePanel.querySelectorAll('.viz-pane').forEach((p) => { p.hidden = true; });
  cpick.hidden = false;
  wavePanel.querySelector('.viz-panel-foot').style.display = 'none';
  cpRender();
}

function closePicker() {
  if (cpick.hidden) return;
  cpick.hidden = true;
  wavePanel.querySelector('.viz-panel-foot').style.display = '';
  const active = panelTabs.querySelector('.viz-ptab.active');
  wavePanel.querySelectorAll('.viz-pane').forEach((p) => {
    p.hidden = !active || p.dataset.pane !== active.dataset.pane;
  });
}

function cpDrag(el, onMove) {
  let on = false;
  const move = (e) => {
    const r = el.getBoundingClientRect();
    onMove(
      clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1),
      clamp((e.clientY - r.top) / Math.max(1, r.height), 0, 1)
    );
  };
  el.addEventListener('pointerdown', (e) => {
    on = true;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    move(e);
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (on) move(e);
  });
  const stop = () => { on = false; };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
}
cpDrag(cpickSv, (x, y) => {
  const dx = x - 0.5;
  const dy = y - 0.5;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  cpH = deg;
  cpS = Math.min(1, Math.hypot(dx, dy) * 2);
  cpApply(false);
});

cpDrag(cpickHue, (x) => {
  cpV = x;
  cpApply(false);
});

cpickHex.addEventListener('input', () => {
  let v = cpickHex.value.trim();
  if (v && v[0] !== '#') v = '#' + v;
  const hsv = hexToHsv(v);
  if (!hsv) return;
  cpH = hsv.h;
  cpS = hsv.s;
  cpV = hsv.v;
  cpApply(true);
});

document.getElementById('cpickOk').addEventListener('click', closePicker);
const cpickReset = document.createElement('button');
cpickReset.type = 'button';
cpickReset.className = 'viz-btn';
cpickReset.textContent = '↺';
cpickReset.title = 'Вернуть цвет по умолчанию';
cpickReset.setAttribute('aria-label', 'Вернуть цвет по умолчанию');
document.getElementById('cpickOk').before(cpickReset);

cpickReset.addEventListener('click', () => {
  if (!cpTarget) return;
  const def = WAVE_DEFAULTS[cpTarget];
  setWave({ [cpTarget]: def });
  const hsv = hexToHsv(def || '#0c0c0e') || { h: 0, s: 0, v: 1 };
  cpH = hsv.h;
  cpS = hsv.s;
  cpV = hsv.v;
  cpRender();
  syncPanel();
  redrawWave();
});
[color1, color2, bgCustom].forEach((btn) => {
  btn.addEventListener('click', () => openPicker(btn.dataset.target));
});
document.getElementById('panelReset').addEventListener('click', () => {
  closePicker();
  resetWave();
  syncPanel();
  redrawWave();
});

document.getElementById('panelDone').addEventListener('click', closeWavePanel);
document.getElementById('presets3d').addEventListener('click', (e) => {
  const chip = e.target.closest('.viz-chip');
  if (!chip) return;
  const parts = chip.dataset.t3d.split(',').map(Number);
  setWave({ tiltX: parts[0], tiltY: parts[1] });
  syncPanel();
  redrawWave();
});
panelPlay.addEventListener('click', () => playBtn.click());

function syncPanelPlay() {
  panelPlay.disabled = playBtn.disabled;
  panelPlay.classList.toggle('playing', playBtn.classList.contains('playing'));
}

new MutationObserver(syncPanelPlay).observe(playBtn, { attributes: true, attributeFilter: ['class', 'disabled'] });
syncPanelPlay();

// перетаскивание, колесо мыши и щипок двумя пальцами

const editPtrs = new Map();
let editBase = null;

function is3dPane() {
  const a = panelTabs.querySelector('.viz-ptab.active');
  return !!a && a.dataset.pane === '3d' && cpick.hidden;
}
function editSnapshot() {
  const pts = [...editPtrs.values()];
  editBase = {
    x: wave.x,
    y: wave.y,
        size: wave.size,
    tx: wave.tiltX,
    ty: wave.tiltY,
    p0: pts[0] ? { x: pts[0].x, y: pts[0].y } : null,
    dist: pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0
  };
}

frameEl.addEventListener('pointerdown', (e) => {
  if (!wavePanelOpen || exporting) return;
  if (e.target.closest('.viz-hud, .viz-pick, button, input, label')) return;
  editPtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { frameEl.setPointerCapture(e.pointerId); } catch (err) {}
  editSnapshot();
  e.preventDefault();
});

frameEl.addEventListener('pointermove', (e) => {
  if (!editPtrs.has(e.pointerId) || !editBase) return;
  editPtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const rect = frameEl.getBoundingClientRect();
  const kx = VIZ_W / Math.max(1, rect.width);
  const ky = VIZ_H / Math.max(1, rect.height);
  const pts = [...editPtrs.values()];

  if (pts.length >= 2 && editBase.dist > 0) {
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    setWave({ size: clamp(editBase.size * (d / editBase.dist), 0.3, 2.5) });
  } else if (pts.length === 1 && editBase.p0) {
    if (is3dPane()) {
      setWave({
        tiltY: clamp(editBase.ty + (pts[0].x - editBase.p0.x) * 0.4, -75, 75),
        tiltX: clamp(editBase.tx - (pts[0].y - editBase.p0.y) * 0.4, -75, 75)
      });
    } else {
      setWave({
        x: clamp(editBase.x + (pts[0].x - editBase.p0.x) * kx, -640, 640),
        y: clamp(editBase.y + (pts[0].y - editBase.p0.y) * ky, -640, 640)
      });
    }
  }
  syncPanel();
  redrawWave();
});

function endEdit(e) {
  if (!editPtrs.delete(e.pointerId)) return;
  editSnapshot();
}

frameEl.addEventListener('pointerup', endEdit);
frameEl.addEventListener('pointercancel', endEdit);

frameEl.addEventListener('wheel', (e) => {
  if (!wavePanelOpen || exporting) return;
  e.preventDefault();
  setWave({ size: clamp(wave.size * (e.deltaY < 0 ? 1.05 : 0.95), 0.3, 2.5) });
  syncPanel();
  redrawWave();
}, { passive: false });
// ---------- текст и стикеры поверх ролика ----------

const ovlBox = document.getElementById('ovlBox');
let ovlCollapsed = false;
const stickerInput = document.getElementById('stickerFile');

stickerInput.addEventListener('change', () => {
  const file = stickerInput.files && stickerInput.files[0];
  stickerInput.value = '';
  if (!file || exporting) return;
  if (!file.type.startsWith('image/')) {
    setStatus('Выберите картинку: PNG, JPG, WEBP или SVG.');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    setStatus('Картинка слишком большая (максимум 10 МБ).');
    return;
  }
  const url = URL.createObjectURL(file);
  addSticker(url).then((l) => {
    if (!l || !l.img.naturalWidth) {
      if (l) removeLayer(l.id);
      URL.revokeObjectURL(url);
      setStatus('Не удалось открыть картинку.');
      renderOvl();
      return;
    }
    ovlCollapsed = true;
    showTab('layers');
  });
});
const selBox = document.createElement('div');
selBox.className = 'viz-sel';
selBox.hidden = true;
frameEl.append(selBox);

const guideV = document.createElement('div');
guideV.className = 'viz-guide viz-guide-v';
guideV.hidden = true;
const guideH = document.createElement('div');
guideH.className = 'viz-guide viz-guide-h';
guideH.hidden = true;
frameEl.append(guideV, guideH);
function selButton(cls, label, svg) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'viz-sel-btn ' + cls;
  b.setAttribute('aria-label', label);
  b.innerHTML = svg;
  selBox.append(b);
  return b;
}

const selDel = selButton('viz-sel-del', 'Удалить', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>');
const selDup = selButton('viz-sel-dup', 'Дублировать', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>');
const selSize = selButton('viz-sel-size', 'Изменить размер', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M11 7h6v6"/></svg>');
const SEL_LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const SEL_UNLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-1.5"/></svg>';
const selGlue = selButton('viz-sel-glue', 'Склейка шаблона', SEL_LOCK);
selGlue.style.display = 'none';

selGlue.addEventListener('click', () => {
  const l = getSelected();
  if (!l || exporting || !l.group) return;
  setGroupOpen(l.group, !l.gOpen);
  buzz();
  renderOvl();
});
selDel.addEventListener('click', () => {
  const l = getSelected();
  if (!l || exporting) return;
  groupMembers(l).slice().forEach((m) => removeLayer(m.id));
  ovlCollapsed = false;
  renderOvl();
});
selDup.addEventListener('click', () => {
  const l = getSelected();
  if (!l || exporting) return;
  duplicateLayer(l.id);
  renderOvl();
});

let ovlResize = null;

selSize.addEventListener('pointerdown', (e) => {
  const l = getSelected();
  if (!l || exporting || l.locked) return;
  const r = canvas.getBoundingClientRect();
  const gm = groupMembers(l).filter((m) => !m.locked);
  let gx = l.x;
  let gy = l.y;
  let group = null;
  let fmin = 0;
  let fmax = Infinity;
  if (gm.length > 1) {
    const gb = groupBounds(ctx, l);
    gx = (gb.x + gb.w / 2) / canvas.width;
    gy = (gb.y + gb.h / 2) / canvas.height;
    group = gm.map((m) => ({ l: m, size: m.size, x: m.x, y: m.y }));
    gm.forEach((m) => {
           const mn = m.type === 'text' ? 0.01 : 0.02;
      const mx = m.type === 'text' ? 0.4 : 1;
      fmin = Math.max(fmin, mn / m.size);
      fmax = Math.min(fmax, mx / m.size);
    });
  }
  const cx = r.left + gx * r.width;
  const cy = r.top + gy * r.height;
  ovlResize = {
    id: l.id,
    pid: e.pointerId,
    cx: cx,
    cy: cy,
    size: l.size,
    dist: Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy)),
    group: group,
    gx: gx,
    gy: gy,
    fmin: fmin,
    fmax: fmax
  };
  try { selSize.setPointerCapture(e.pointerId); } catch (err) {}
  e.preventDefault();
  e.stopPropagation();
});
selSize.addEventListener('pointermove', (e) => {
  if (!ovlResize || e.pointerId !== ovlResize.pid) return;
  const l = getLayer(ovlResize.id);
  if (!l) return;
  const dist = Math.hypot(e.clientX - ovlResize.cx, e.clientY - ovlResize.cy);
  if (ovlResize.group) {
    const f = clamp(dist / ovlResize.dist, ovlResize.fmin, ovlResize.fmax);
    ovlResize.group.forEach((m) => {
      m.l.size = m.size * f;
      m.l.x = ovlResize.gx + (m.x - ovlResize.gx) * f;
      m.l.y = ovlResize.gy + (m.y - ovlResize.gy) * f;
    });
    touch();
    return;
  }
  const min = l.type === 'text' ? 0.03 : 0.05;
  const max = l.type === 'text' ? 0.4 : 1;
  l.size = clamp(ovlResize.size * (dist / ovlResize.dist), min, max);
  touch();
});

function selSizeEnd(e) {
  if (!ovlResize || e.pointerId !== ovlResize.pid) return;
  ovlResize = null;
  renderOvl();
}

selSize.addEventListener('pointerup', selSizeEnd);
selSize.addEventListener('pointercancel', selSizeEnd);
let ovlDrag = null;
const ovlPtrs = new Map();
let ovlGesture = null;
let ovlFontsOpen = false;

function ovlOpen() {
  return openTab === 'text' || openTab === 'layers';
}
// Снимок склеенной группы для масштабирования. Если слой не в склеенной группе, вернёт null.
function ovlGroupSnap(l) {
  const gm = groupMembers(l).filter((m) => !m.locked);
  if (gm.length < 2) return null;
  const gb = groupBounds(ctx, l);
  let fmin = 0;
  let fmax = Infinity;
  gm.forEach((m) => {
    const mn = m.type === 'text' ? 0.01 : 0.02;
    const mx = m.type === 'text' ? 0.4 : 1;
    fmin = Math.max(fmin, mn / m.size);
    fmax = Math.min(fmax, mx / m.size);
  });
  return {
    items: gm.map((m) => ({ l: m, size: m.size, x: m.x, y: m.y })),
    gx: (gb.x + gb.w / 2) / canvas.width,
    gy: (gb.y + gb.h / 2) / canvas.height,
    fmin: fmin,
    fmax: fmax
  };
}

function ovlGroupScale(snap, f) {
  const k = clamp(f, snap.fmin, snap.fmax);
  snap.items.forEach((m) => {
    m.l.size = m.size * k;
    m.l.x = snap.gx + (m.x - snap.gx) * k;
    m.l.y = snap.gy + (m.y - snap.gy) * k;
  });
}
function ovlSyncSel() {
  const l = getSelected();
  if (!l || !ovlOpen()) {
    selBox.hidden = true;
    return;
  }
  const glued = isGlued(l);
  const b = glued ? groupBounds(ctx, l) : layerBounds(ctx, l);
  selBox.hidden = false;
  selGlue.style.display = l.group ? '' : 'none';
  if (l.group) {
    const gs = l.gOpen ? '1' : '0';
    if (selGlue.dataset.s !== gs) {
      selGlue.dataset.s = gs;
      selGlue.innerHTML = l.gOpen ? SEL_UNLOCK : SEL_LOCK;
      selGlue.classList.toggle('open', !!l.gOpen);
      selGlue.style.top = 'auto';
      selGlue.style.right = 'auto';
      selGlue.style.left = '-12px';
      selGlue.style.bottom = '-12px';
      selGlue.style.background = l.gOpen ? '#ffd84d' : '#7c3aed';
      selGlue.style.color = l.gOpen ? '#111' : '#fff';
      selGlue.title = l.gOpen ? 'Части свободны. Нажми, чтобы склеить шаблон' : 'Шаблон склеен. Нажми, чтобы разделить на части';
      selGlue.setAttribute('aria-label', selGlue.title);
    }
  }
  selBox.style.left = (b.x / canvas.width * 100) + '%';
  selBox.style.top = (b.y / canvas.height * 100) + '%';
  selBox.style.width = (b.w / canvas.width * 100) + '%';
  selBox.style.height = (b.h / canvas.height * 100) + '%';
      selBox.style.transform = 'rotate(' + (glued ? 0 : (l.rot || 0)) + 'deg)';
}

function ovlRedraw() {
  emptyEl.classList.toggle('has-layers', getLayers().length > 0);
    histSchedule();
  if (!playing) drawIdle(startOffset);
  ovlSyncSel();
  if (ovlOpen() && ovlCollapsed && !getLayers().length) {
    ovlCollapsed = false;
    showTab(null);
  }
}
setOverlayChange(ovlRedraw);
setHistChange(ovlHistSync);
setFontFail(function (label, url) {
  setStatus('Шрифт «' + label + '» не загрузился: ' + url);
});
function ovlEl(tag, cls, text) {
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

function ovlSlider(label, min, max, step, value, fmtFn, onInput, def) {
  const row = ovlEl('label', 'viz-sl');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  fillRange(input);
  const out = ovlEl('output', null, fmtFn(value));
  input.addEventListener('input', () => {
    const v = Number(input.value);
    fillRange(input);
    out.textContent = fmtFn(v);
    onInput(v);
  });

  // двойной клик / двойной тап по ползунку возвращает значение по умолчанию
  const target = def !== undefined ? def : onInput.def;
  if (target !== undefined) {
    let startVal = input.value;
    let lastUp = 0;
    input.addEventListener('pointerdown', () => { startVal = input.value; });
    input.addEventListener('pointerup', () => {
      const now = Date.now();
      const moved = input.value !== startVal;
      if (!moved && lastUp && now - lastUp < 350) {
        lastUp = 0;
        input.value = String(target);
        const v = Number(input.value);
        fillRange(input);
        out.textContent = fmtFn(v);
        onInput(v);
      } else {
        lastUp = now;
      }
    });
  }

  row.append(ovlEl('span', null, label), input, out);
  return row;
}
function ovlChip(label, on, onClick) {
  const b = ovlEl('button', 'viz-chip' + (on ? ' active' : ''), label);
  b.type = 'button';
  b.addEventListener('click', () => {
    b.classList.toggle('active', onClick());
  });
  return b;
}

function ovlCommon(l, minSize, maxSize) {
  const wrap = ovlEl('div', 'viz-pane');
  wrap.append(
    ovlSlider('Прозрачность', 0.1, 1, 0.01, l.opacity, pct, (v) => { l.opacity = v; touch(); }, 1)
  );
  return wrap;
}
function ovlReady() {
  return !!photoUrl || !!videoFile || !!buffer || transparentMode;
}
const ICON_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const ICON_LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const ICON_UNLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-1.5"/></svg>';
function ovlLayerList(onPick, after) {
  const all = getLayers();
  const box = ovlEl('div', 'viz-layers');
  for (let i = all.length - 1; i >= 0; i--) {
    const l = all[i];
    const row = ovlEl('div', 'viz-lrow' + (getSelected() === l ? ' active' : '') + (l.hidden ? ' off' : ''));
    const name = l.type === 'text' ? (String(l.text).trim().slice(0, 14) || 'Текст') : 'Стикер ' + (i + 1);
    const pick = ovlEl('button', 'viz-lname', name);
    pick.type = 'button';
    pick.addEventListener('click', () => onPick(l));

    const eye = ovlEl('button', 'viz-lbtn' + (l.hidden ? '' : ' on'));
    eye.type = 'button';
    eye.innerHTML = ICON_EYE;
    eye.title = l.hidden ? 'Показать' : 'Скрыть';
    eye.setAttribute('aria-label', eye.title);
    eye.addEventListener('click', () => {
      l.hidden = !l.hidden;
      buzz();
      touch();
      after();
    });

    const lock = ovlEl('button', 'viz-lbtn' + (l.locked ? ' on' : ''));
    lock.type = 'button';
    lock.innerHTML = ICON_LOCK;
    lock.title = l.locked ? 'Открепить' : 'Закрепить';
    lock.setAttribute('aria-label', lock.title);
    lock.addEventListener('click', () => {
      l.locked = !l.locked;
      buzz();
      touch();
      after();
    });

    if (l.group) {
      const glue = ovlEl('button', 'viz-lbtn' + (l.gOpen ? '' : ' on'));
      glue.type = 'button';
      glue.innerHTML = l.gOpen ? ICON_UNLOCK : ICON_LOCK;
      glue.title = l.gOpen ? 'Части свободны. Нажми, чтобы склеить шаблон' : 'Шаблон склеен. Нажми, чтобы разделить на части';
      glue.setAttribute('aria-label', glue.title);
      glue.addEventListener('click', () => {
        setGroupOpen(l.group, !l.gOpen);
        buzz();
        after();
      });
      row.append(pick, eye, glue, lock);
    } else {
      row.append(pick, eye, lock);
    }
    box.append(row);
  }
  return box;
}


const STYLE_SKIP = ['id', 'type', 'text', 'img', 'x', 'y', 'size', 'rot', 'tStart', 'tEnd', 'fadeIn', 'fadeOut', 'hidden', 'locked', 'group', 'gOpen'];

let styleClip = null;

function copyStyle(l) {
  const o = {};
  Object.keys(l).forEach((k) => {
    if (STYLE_SKIP.indexOf(k) < 0) o[k] = l[k];
  });
  styleClip = { type: l.type, data: o };
}

function pasteStyle(l) {
  if (!styleClip || styleClip.type !== l.type) return false;
  Object.assign(l, styleClip.data);
  touch();
  return true;
}

function ovlStyleBtns(l) {
  const wrap = ovlEl('div', 'viz-histbtns viz-stylebtns');
  const cp = ovlEl('button', 'viz-mini', 'Копир.');
  cp.type = 'button';
  cp.title = 'Скопировать стиль этого слоя';
  cp.addEventListener('click', () => {
    copyStyle(l);
    buzz();
    renderOvl();
  });
  const ps = ovlEl('button', 'viz-mini', 'Встав.');
  ps.type = 'button';
  ps.title = 'Вставить скопированный стиль';
  ps.disabled = !styleClip || styleClip.type !== l.type;
  ps.addEventListener('click', () => {
    if (pasteStyle(l)) {
      buzz();
      renderOvl();
    }
  });
  wrap.append(cp, ps);
  return wrap;
}

const tlCache = { key: '', peaks: null };

function tlPeaks(n) {
  if (!buffer) return null;
  const key = n + '|' + clipStart + '|' + duration + '|' + buffer.length;
  if (tlCache.key === key) return tlCache.peaks;
  const sr = buffer.sampleRate;
  const from = Math.floor(clipStart * sr);
  const len = Math.max(1, Math.floor(duration * sr));
  const ch = buffer.getChannelData(0);
  const out = new Float32Array(n);
  const per = len / n;
  const stride = Math.max(1, Math.floor(per / 64));
  let top = 0;
  for (let i = 0; i < n; i++) {
    const a = from + Math.floor(i * per);
    const b = Math.min(ch.length, from + Math.floor((i + 1) * per));
    let m = 0;
    for (let j = a; j < b; j += stride) {
      const v = ch[j] < 0 ? -ch[j] : ch[j];
      if (v > m) m = v;
    }
    out[i] = m;
    if (m > top) top = m;
  }
  if (top > 0) for (let i = 0; i < n; i++) out[i] /= top;
  tlCache.key = key;
  tlCache.peaks = out;
  return out;
}

function ovlPaneTime(l) {
  const max = Math.max(1, Math.round(duration * 10) / 10);
  const MIN = 0.2;
  const MAXFADE = 3;
  const r1 = (v) => Math.round(v * 10) / 10;
  const sec = (v) => v.toFixed(1) + ' с';
  const pane = ovlEl('div', 'viz-pane');
  const wrap = ovlEl('div', 'viz-tl2');

  const sum = ovlEl('p', 'viz-tl2-sum');
  const ruler = ovlEl('div', 'viz-tl2-ruler');
  const track = ovlEl('div', 'viz-tl2-track');
  const bg = ovlEl('canvas', 'viz-tl2-bg');
  track.append(bg);

  // фон полосы: кадры видео, иначе волна трека
  const drawBg = () => {
    const W = 600;
    const H = 120;
    bg.width = W;
    bg.height = H;
    const g = bg.getContext('2d');
    g.fillStyle = '#17171c';
    g.fillRect(0, 0, W, H);
    if (hasVideo() && stripThumbs && vidDur() > 0) {
      const d = vidDur();
      const sx = (curVideoStart() / d) * stripThumbs.width;
      const sw = Math.min(1, max / d) * stripThumbs.width;
      try { g.drawImage(stripThumbs, sx, 0, Math.max(1, sw), stripThumbs.height, 0, 0, W, H); } catch (e) {}
      g.fillStyle = 'rgba(0, 0, 0, 0.25)';
      g.fillRect(0, 0, W, H);
      return;
    }
    const pk = tlPeaks(120);
    if (pk) {
      const bw = W / pk.length;
      g.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let i = 0; i < pk.length; i++) {
        const h = Math.max(4, pk[i] * H * 0.8);
        g.fillRect(i * bw + bw * 0.2, (H - h) / 2, bw * 0.6, h);
      }
    }
  };
  drawBg();

  // линейка с секундами и тонкая сетка
  const steps = [1, 2, 5, 10, 15, 30, 60, 120];
  let step = steps[steps.length - 1];
  for (let i = 0; i < steps.length; i++) {
    if (max / steps[i] <= 6) {
      step = steps[i];
      break;
    }
  }
  const tickText = (s) => (max >= 60 ? fmt(s) : r1(s) + ' с');
  const addTick = (s) => {
    const pos = (s / max) * 100;
    const gr = ovlEl('div', 'viz-tl2-grid');
    gr.style.left = pos + '%';
    track.append(gr);
    const tk = ovlEl('div', 'viz-tl2-tick', tickText(s));
    tk.style.left = pos + '%';
    ruler.append(tk);
  };
  let lastTick = 0;
  for (let s = 0; s <= max + 0.001; s += step) {
    addTick(s);
    lastTick = s;
  }
  if (max - lastTick > step * 0.35) addTick(max);

  const dimL = ovlEl('div', 'viz-tl2-dim');
  const dimR = ovlEl('div', 'viz-tl2-dim');
  const block = ovlEl('div', 'viz-tl2-block');
  const fadeBg = ovlEl('div', 'viz-tl2-fade');
  block.append(fadeBg);
  const hA = ovlEl('div', 'viz-tl2-h');
  const hB = ovlEl('div', 'viz-tl2-h');
  hA.title = 'Начало показа';
  hB.title = 'Конец показа';
  track.append(dimL, dimR, block, hA, hB);

  const pills = ovlEl('div', 'viz-tl2-pills');
  const pA = ovlEl('div', 'viz-tl2-pill');
  const pB = ovlEl('div', 'viz-tl2-pill');
  pills.append(pA, pB);

  const startOf = () => Math.min(l.tStart || 0, Math.max(0, max - MIN));
  const endOf = () => (l.tEnd > 0 ? Math.min(l.tEnd, max) : max);
  const stepSize = () => (endOf() - startOf() < 6 ? 0.1 : 0.5);
  const maxFade = () => Math.min(MAXFADE, endOf() - startOf());

  const fit = () => {
    const len = endOf() - startOf();
    if ((l.fadeIn || 0) > len) l.fadeIn = r1(len);
    if ((l.fadeOut || 0) > len) l.fadeOut = r1(len);
  };

  // плавность: карточки с кнопками − и +
  const mkFade = (title, getV, setV) => {
    const g = ovlEl('div', 'viz-tl2-fg');
    const st = ovlEl('div', 'viz-tl2-st');
    const minus = ovlEl('button', null, '−');
    const plus = ovlEl('button', null, '+');
    minus.type = 'button';
    plus.type = 'button';
    const val = ovlEl('b', null, '');
    minus.addEventListener('click', () => {
      setV(r1(Math.max(0, getV() - stepSize())));
      buzz();
    });
    plus.addEventListener('click', () => {
      setV(r1(Math.min(maxFade(), getV() + stepSize())));
      buzz();
    });
    st.append(minus, val, plus);
    g.append(ovlEl('span', null, title), st);
    return { g: g, val: val };
  };

  const fIn = mkFade('Плавно появляется', () => l.fadeIn || 0, (v) => {
    l.fadeIn = v;
    update();
  });
  const fOut = mkFade('Плавно исчезает', () => l.fadeOut || 0, (v) => {
    if (!(l.tEnd > 0)) l.tEnd = max;
    l.fadeOut = v;
    if (v === 0 && l.tEnd >= max - 0.05) l.tEnd = 0;
    update();
  });
  const fades = ovlEl('div', 'viz-tl2-fades');
  fades.append(fIn.g, fOut.g);

  const paint = () => {
    const a = startOf();
    const b = endOf();
    const len = Math.max(0.0001, b - a);
    const fi = Math.min(l.fadeIn || 0, len);
    const fo = Math.min(l.fadeOut || 0, len);
    const pa = (a / max) * 100;
    const pb = (b / max) * 100;
    const gi = (fi / len) * 100;
    const go = (fo / len) * 100;
    dimL.style.left = '0';
    dimL.style.width = pa + '%';
    dimR.style.left = pb + '%';
    dimR.style.right = '0';
    block.style.left = pa + '%';
    block.style.width = (pb - pa) + '%';
    fadeBg.style.background = 'linear-gradient(90deg, rgba(0, 0, 0, 0.72) 0%, rgba(0, 0, 0, 0) ' + gi + '%, rgba(0, 0, 0, 0) ' + (100 - go) + '%, rgba(0, 0, 0, 0.72) 100%)';
    hA.style.left = pa + '%';
    hB.style.left = pb + '%';

    const close = pb - pa < 28;
    pA.textContent = sec(a);
    pB.textContent = sec(b);
    pA.style.left = pa + '%';
    pB.style.left = pb + '%';
    pA.style.transform = close ? 'translateX(-90%)' : 'translateX(-50%)';
    pB.style.transform = close ? 'translateX(-10%)' : 'translateX(-50%)';

    const open = !(l.tEnd > 0 && l.tEnd < max - 0.05);
    const startTxt = a > 0.05 ? 'с ' + sec(a) : 'с начала';
    const endTxt = open ? 'до конца' : 'до ' + sec(b);
    sum.textContent = 'Виден ' + startTxt + ' ' + endTxt + ' · ' + sec(b - a);
    fIn.val.textContent = fi > 0.05 ? sec(fi) : 'нет';
    fOut.val.textContent = fo > 0.05 ? sec(fo) : 'нет';
  };

  const update = () => {
    paint();
    touch();
  };

  const secAt = (e) => {
    const rc = track.getBoundingClientRect();
    return clamp((e.clientX - rc.left) / Math.max(1, rc.width), 0, 1) * max;
  };

  const drag = (el, onMove) => {
    let pid = null;
    el.addEventListener('pointerdown', (e) => {
      pid = e.pointerId;
      try { el.setPointerCapture(pid); } catch (err) {}
      e.preventDefault();
      e.stopPropagation();
    });
    el.addEventListener('pointermove', (e) => {
      if (pid !== e.pointerId) return;
      onMove(secAt(e));
    });
    const end = (e) => { if (pid === e.pointerId) pid = null; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };

  const setStart = (t) => {
    l.tStart = r1(clamp(t, 0, endOf() - MIN));
    fit();
    update();
  };
  const setEnd = (t) => {
    const v = r1(clamp(t, startOf() + MIN, max));
    l.tEnd = v >= max - 0.05 && !(l.fadeOut > 0) ? 0 : v;
    fit();
    update();
  };

  drag(hA, setStart);
  drag(hB, setEnd);

  // тап по затемнённой части подтягивает ближайший край
  track.addEventListener('pointerdown', (e) => {
    if (e.target !== track) return;
    const t = secAt(e);
    if (t < startOf()) setStart(t);
    else if (t > endOf()) setEnd(t);
  });

  // кусок можно двигать целиком
  let mv = null;
  block.addEventListener('pointerdown', (e) => {
    mv = { pid: e.pointerId, off: secAt(e) - startOf(), len: endOf() - startOf() };
    try { block.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  block.addEventListener('pointermove', (e) => {
    if (!mv || mv.pid !== e.pointerId) return;
    const a = r1(clamp(secAt(e) - mv.off, 0, Math.max(0, max - mv.len)));
    const b = r1(a + mv.len);
    l.tStart = a;
    l.tEnd = b >= max - 0.05 && !(l.fadeOut > 0) ? 0 : b;
    update();
  });
  const mvEnd = (e) => { if (mv && mv.pid === e.pointerId) mv = null; };
  block.addEventListener('pointerup', mvEnd);
  block.addEventListener('pointercancel', mvEnd);

  const reset = ovlEl('button', 'viz-mini', '↺ Весь ролик');
  reset.type = 'button';
  reset.title = 'Показывать слой весь ролик, без плавности';
  reset.addEventListener('click', () => {
    l.tStart = 0;
    l.tEnd = 0;
    l.fadeIn = 0;
    l.fadeOut = 0;
    buzz();
    update();
  });

   const help = ovlEl('button', 'viz-tl2-help', '?');
  help.type = 'button';
  help.title = 'Подсказка';
  const hint = ovlEl('p', 'viz-wave-hint', 'Тяните белые ручки: это начало и конец показа. Саму рамку можно двигать целиком. Кнопки − и + задают, как плавно слой появляется и исчезает.' + (duration > 0 ? '' : ' Длина ролика пока неизвестна (нет трека и видео), поэтому шкала показывает 1 секунду. Добавьте трек, и здесь появятся настоящие секунды.'));
  hint.hidden = true;
  help.addEventListener('click', () => {
    hint.hidden = !hint.hidden;
  });
  const foot = ovlEl('div', 'viz-tl2-foot');
  foot.append(reset, help);
  wrap.append(sum, ruler, track, pills, fades, foot, hint);
  pane.append(wrap);
  paint();
  return pane;
}
function ovlPaneTimeV3(l) {
  const max = Math.max(1, Math.round(duration * 10) / 10);
  const MIN = 0.2;
  const MAXFADE = 3;
  const r1 = (v) => Math.round(v * 10) / 10;
  const sec = (v) => v.toFixed(1) + ' с';
  const pane = ovlEl('div', 'viz-pane');
  const wrap = ovlEl('div', 'viz-tl');

  const mkCard = (title) => {
    const c = ovlEl('div', 'viz-tl-card');
    const v = ovlEl('b', null, '');
    c.append(ovlEl('span', null, title), v);
    return { c: c, v: v };
  };
  const cardA = mkCard('Начало');
  const cardB = mkCard('Конец');
  const cardL = mkCard('Показ');
  const cards = ovlEl('div', 'viz-tl-cards');
  cards.append(cardA.c, cardB.c, cardL.c);

  const track = ovlEl('div', 'viz-tl-track');
  const ruler = ovlEl('div', 'viz-tl-ruler');

  const steps = [1, 2, 5, 10, 15, 30, 60, 120];
  let step = steps[steps.length - 1];
  for (let i = 0; i < steps.length; i++) {
    if (max / steps[i] <= 8) {
      step = steps[i];
      break;
    }
  }
  const tickText = (s) => (max >= 60 ? fmt(s) : r1(s) + ' с');
  const addTick = (s) => {
    const pos = (s / max) * 100;
    const g = ovlEl('div', 'viz-tl-grid');
    g.style.left = pos + '%';
    track.append(g);
    const tk = ovlEl('div', 'viz-tl-tick', tickText(s));
    tk.style.left = pos + '%';
    ruler.append(tk);
  };
  let last = 0;
  for (let s = 0; s <= max + 0.001; s += step) {
    addTick(s);
    last = s;
  }
  if (max - last > step * 0.35) addTick(max);

  const block = ovlEl('div', 'viz-tl-block');
  const hA = ovlEl('div', 'viz-tl-h');
  const hB = ovlEl('div', 'viz-tl-h');
  const kIn = ovlEl('div', 'viz-tl-k');
  const kOut = ovlEl('div', 'viz-tl-k');
  kIn.title = 'Плавное появление';
  kOut.title = 'Плавное исчезновение';
  hA.title = 'Начало показа';
  hB.title = 'Конец показа';
  track.append(block, hA, hB, kIn, kOut);

  const fadeLine = ovlEl('p', 'viz-tl-fade');

  const startOf = () => Math.min(l.tStart || 0, Math.max(0, max - MIN));
  const endOf = () => (l.tEnd > 0 ? Math.min(l.tEnd, max) : max);

  const fit = () => {
    const len = endOf() - startOf();
    if ((l.fadeIn || 0) > len) l.fadeIn = r1(len);
    if ((l.fadeOut || 0) > len) l.fadeOut = r1(len);
  };

  const paint = () => {
    const a = startOf();
    const b = endOf();
    const len = Math.max(0.0001, b - a);
    const fi = Math.min(l.fadeIn || 0, len);
    const fo = Math.min(l.fadeOut || 0, len);
    const pa = (a / max) * 100;
    const pb = (b / max) * 100;
    const gi = (fi / len) * 100;
    const go = (fo / len) * 100;
    block.style.left = pa + '%';
    block.style.width = (pb - pa) + '%';
    block.style.background = 'linear-gradient(90deg, rgba(124, 58, 237, 0.18) 0%, rgba(168, 85, 247, 0.95) ' + gi + '%, rgba(255, 79, 163, 0.95) ' + (100 - go) + '%, rgba(255, 79, 163, 0.18) 100%)';
    hA.style.left = pa + '%';
    hB.style.left = pb + '%';
    kIn.style.left = ((a + fi) / max) * 100 + '%';
    kOut.style.left = ((b - fo) / max) * 100 + '%';

    const open = !(l.tEnd > 0 && l.tEnd < max - 0.05);
    cardA.v.textContent = a > 0.05 ? sec(a) : 'с начала';
    cardB.v.textContent = open ? 'до конца' : sec(b);
    cardL.v.textContent = sec(b - a);

    const parts = [];
    if (fi > 0.05) parts.push('появляется плавно ' + sec(fi));
    if (fo > 0.05) parts.push('исчезает плавно ' + sec(fo));
    fadeLine.textContent = parts.length ? parts.join(' · ') : 'Появляется и исчезает сразу';
  };

  const update = () => {
    paint();
    touch();
  };

  const secAt = (e) => {
    const rc = track.getBoundingClientRect();
    return clamp((e.clientX - rc.left) / Math.max(1, rc.width), 0, 1) * max;
  };

  const drag = (el, onMove) => {
    let pid = null;
    el.addEventListener('pointerdown', (e) => {
      pid = e.pointerId;
      try { el.setPointerCapture(pid); } catch (err) {}
      e.preventDefault();
      e.stopPropagation();
    });
    el.addEventListener('pointermove', (e) => {
      if (pid !== e.pointerId) return;
      onMove(secAt(e));
    });
    const end = (e) => { if (pid === e.pointerId) pid = null; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };

  drag(hA, (t) => {
    l.tStart = r1(clamp(t, 0, endOf() - MIN));
    fit();
    update();
  });

  drag(hB, (t) => {
    const v = r1(clamp(t, startOf() + MIN, max));
    l.tEnd = v >= max - 0.05 && !(l.fadeOut > 0) ? 0 : v;
    fit();
    update();
  });

  drag(kIn, (t) => {
    const a = startOf();
    l.fadeIn = r1(clamp(t - a, 0, Math.min(MAXFADE, endOf() - a)));
    update();
  });

  drag(kOut, (t) => {
    if (!(l.tEnd > 0)) l.tEnd = max;
    const a = startOf();
    const b = endOf();
    l.fadeOut = r1(clamp(b - t, 0, Math.min(MAXFADE, b - a)));
    if (l.fadeOut === 0 && l.tEnd >= max - 0.05) l.tEnd = 0;
    update();
  });

  let mv = null;
  block.addEventListener('pointerdown', (e) => {
    mv = { pid: e.pointerId, off: secAt(e) - startOf(), len: endOf() - startOf() };
    try { block.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  block.addEventListener('pointermove', (e) => {
    if (!mv || mv.pid !== e.pointerId) return;
    const a = r1(clamp(secAt(e) - mv.off, 0, Math.max(0, max - mv.len)));
    const b = r1(a + mv.len);
    l.tStart = a;
    l.tEnd = b >= max - 0.05 && !(l.fadeOut > 0) ? 0 : b;
    update();
  });
  const mvEnd = (e) => { if (mv && mv.pid === e.pointerId) mv = null; };
  block.addEventListener('pointerup', mvEnd);
  block.addEventListener('pointercancel', mvEnd);

  const reset = ovlEl('button', 'viz-mini', '↺ Весь ролик');
  reset.type = 'button';
  reset.title = 'Показывать слой весь ролик, без плавности';
  reset.addEventListener('click', () => {
    l.tStart = 0;
    l.tEnd = 0;
    l.fadeIn = 0;
    l.fadeOut = 0;
    buzz();
    update();
  });

  wrap.append(cards, track, ruler, fadeLine, reset);
  if (!(duration > 0)) {
    wrap.append(ovlEl('p', 'viz-wave-hint', 'Длина ролика пока неизвестна (нет трека и видео), поэтому шкала показывает 1 секунду. Добавьте трек, и здесь появятся настоящие секунды.'));
  }
  wrap.append(ovlEl('p', 'viz-wave-hint', 'Тяните белые края полосы: это начало и конец показа. Кружки сверху: плавное появление и исчезновение. Саму полосу можно двигать целиком.'));
  pane.append(wrap);
  paint();
  return pane;
}
function ovlPaneTimeV1(l) {
  const max = Math.max(1, Math.round(duration * 10) / 10);
  const MIN = 0.2;
  const MAXFADE = 3;
  const r1 = (v) => Math.round(v * 10) / 10;
  const sec = (v) => v.toFixed(1) + ' с';
  const pane = ovlEl('div', 'viz-pane');

  const wrap = ovlEl('div', 'viz-tl');
  const sum = ovlEl('p', 'viz-tl-sum');
  const track = ovlEl('div', 'viz-tl-track');
  const block = ovlEl('div', 'viz-tl-block');
  const hA = ovlEl('div', 'viz-tl-h');
  const hB = ovlEl('div', 'viz-tl-h');
  const kIn = ovlEl('div', 'viz-tl-k');
  const kOut = ovlEl('div', 'viz-tl-k');
  kIn.title = 'Плавное появление';
  kOut.title = 'Плавное исчезновение';
  hA.title = 'Начало показа';
  hB.title = 'Конец показа';
  track.append(block, hA, hB, kIn, kOut);
  const scale = ovlEl('div', 'viz-tl-scale');
  scale.append(ovlEl('span', null, '0 с'), ovlEl('span', null, sec(max)));
  const fadeLine = ovlEl('p', 'viz-tl-fade');

  const startOf = () => Math.min(l.tStart || 0, Math.max(0, max - MIN));
  const endOf = () => (l.tEnd > 0 ? Math.min(l.tEnd, max) : max);

  const fit = () => {
    const len = endOf() - startOf();
    if ((l.fadeIn || 0) > len) l.fadeIn = r1(len);
    if ((l.fadeOut || 0) > len) l.fadeOut = r1(len);
  };

  const paint = () => {
    const a = startOf();
    const b = endOf();
    const len = Math.max(0.0001, b - a);
    const fi = Math.min(l.fadeIn || 0, len);
    const fo = Math.min(l.fadeOut || 0, len);
    const pa = (a / max) * 100;
    const pb = (b / max) * 100;
    const gi = (fi / len) * 100;
    const go = (fo / len) * 100;
    block.style.left = pa + '%';
    block.style.width = (pb - pa) + '%';
    block.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.55) ' + gi + '%, rgba(255,255,255,0.55) ' + (100 - go) + '%, rgba(255,255,255,0.1) 100%)';
    hA.style.left = pa + '%';
    hB.style.left = pb + '%';
    kIn.style.left = ((a + fi) / max) * 100 + '%';
    kOut.style.left = ((b - fo) / max) * 100 + '%';

    const startTxt = a > 0.05 ? 'с ' + sec(a) : 'с начала';
    const endTxt = l.tEnd > 0 && l.tEnd < max - 0.05 ? 'до ' + sec(b) : 'до конца';
    sum.textContent = 'Виден ' + startTxt + ' ' + endTxt;
    const parts = [];
    if (fi > 0.05) parts.push('появляется плавно ' + sec(fi));
    if (fo > 0.05) parts.push('исчезает плавно ' + sec(fo));
    fadeLine.textContent = parts.length ? parts.join(' · ') : 'Появляется и исчезает сразу';
  };

  const update = () => {
    paint();
    touch();
  };

  const secAt = (e) => {
    const rc = track.getBoundingClientRect();
    return clamp((e.clientX - rc.left) / Math.max(1, rc.width), 0, 1) * max;
  };

  const drag = (el, onMove) => {
    let pid = null;
    el.addEventListener('pointerdown', (e) => {
      pid = e.pointerId;
      try { el.setPointerCapture(pid); } catch (err) {}
      e.preventDefault();
      e.stopPropagation();
    });
    el.addEventListener('pointermove', (e) => {
      if (pid !== e.pointerId) return;
      onMove(secAt(e));
    });
    const end = (e) => { if (pid === e.pointerId) pid = null; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };

  drag(hA, (t) => {
    l.tStart = r1(clamp(t, 0, endOf() - MIN));
    fit();
    update();
  });

  drag(hB, (t) => {
    const v = r1(clamp(t, startOf() + MIN, max));
    l.tEnd = v >= max - 0.05 && !(l.fadeOut > 0) ? 0 : v;
    fit();
    update();
  });

  drag(kIn, (t) => {
    const a = startOf();
    l.fadeIn = r1(clamp(t - a, 0, Math.min(MAXFADE, endOf() - a)));
    update();
  });

  drag(kOut, (t) => {
    if (!(l.tEnd > 0)) l.tEnd = max;
    const a = startOf();
    const b = endOf();
    l.fadeOut = r1(clamp(b - t, 0, Math.min(MAXFADE, b - a)));
    if (l.fadeOut === 0 && l.tEnd >= max - 0.05) l.tEnd = 0;
    update();
  });

  let mv = null;
  block.addEventListener('pointerdown', (e) => {
    mv = { pid: e.pointerId, off: secAt(e) - startOf(), len: endOf() - startOf() };
    try { block.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  block.addEventListener('pointermove', (e) => {
    if (!mv || mv.pid !== e.pointerId) return;
    const a = r1(clamp(secAt(e) - mv.off, 0, Math.max(0, max - mv.len)));
    const b = r1(a + mv.len);
    l.tStart = a;
    l.tEnd = b >= max - 0.05 && !(l.fadeOut > 0) ? 0 : b;
    update();
  });
  const mvEnd = (e) => { if (mv && mv.pid === e.pointerId) mv = null; };
  block.addEventListener('pointerup', mvEnd);
  block.addEventListener('pointercancel', mvEnd);

  const reset = ovlEl('button', 'viz-mini', '↺ Весь ролик');
  reset.type = 'button';
  reset.title = 'Показывать слой весь ролик, без плавности';
  reset.addEventListener('click', () => {
    l.tStart = 0;
    l.tEnd = 0;
    l.fadeIn = 0;
    l.fadeOut = 0;
    buzz();
    update();
  });

  wrap.append(
    sum,
    track,
    scale,
    fadeLine,
    reset,
    ovlEl('p', 'viz-wave-hint', 'Тяните белые края полосы: это начало и конец показа. Кружки сверху — плавное появление и исчезновение. Пока открыта вкладка, слой виден всегда, вне времени показа — полупрозрачный.')
  );
  pane.append(wrap);
  paint();
  return pane;
}
function ovlPaneTimeOld(l) {
  const max = Math.max(1, Math.round(duration * 10) / 10);
  const MIN = 0.2;
  const MAXFADE = 3;
  const r1 = (v) => Math.round(v * 10) / 10;
  const sec = (v) => v.toFixed(1) + ' с';
  const pane = ovlEl('div', 'viz-pane');

  const wrap = ovlEl('div', 'viz-tl');
  const sum = ovlEl('p', 'viz-tl-sum');
  const track = ovlEl('div', 'viz-tl-track');
  const block = ovlEl('div', 'viz-tl-block');
  const hA = ovlEl('div', 'viz-tl-h');
  const hB = ovlEl('div', 'viz-tl-h');
  const kIn = ovlEl('div', 'viz-tl-k');
  const kOut = ovlEl('div', 'viz-tl-k');
  kIn.title = 'Плавное появление';
  kOut.title = 'Плавное исчезновение';
  hA.title = 'Начало показа';
  hB.title = 'Конец показа';
  track.append(block, hA, hB, kIn, kOut);
  const scale = ovlEl('div', 'viz-tl-scale');
  scale.append(ovlEl('span', null, '0 с'), ovlEl('span', null, sec(max)));
  const fadeLine = ovlEl('p', 'viz-tl-fade');

  const startOf = () => Math.min(l.tStart || 0, Math.max(0, max - MIN));
  const endOf = () => (l.tEnd > 0 ? Math.min(l.tEnd, max) : max);

  const fit = () => {
    const len = endOf() - startOf();
    if ((l.fadeIn || 0) > len) l.fadeIn = r1(len);
    if ((l.fadeOut || 0) > len) l.fadeOut = r1(len);
  };

  const paint = () => {
    const a = startOf();
    const b = endOf();
    const len = Math.max(0.0001, b - a);
    const fi = Math.min(l.fadeIn || 0, len);
    const fo = Math.min(l.fadeOut || 0, len);
    const pa = (a / max) * 100;
    const pb = (b / max) * 100;
    const gi = (fi / len) * 100;
    const go = (fo / len) * 100;
    block.style.left = pa + '%';
    block.style.width = (pb - pa) + '%';
    block.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.55) ' + gi + '%, rgba(255,255,255,0.55) ' + (100 - go) + '%, rgba(255,255,255,0.1) 100%)';
    hA.style.left = pa + '%';
    hB.style.left = pb + '%';
    kIn.style.left = ((a + fi) / max) * 100 + '%';
    kOut.style.left = ((b - fo) / max) * 100 + '%';

    const startTxt = a > 0.05 ? 'с ' + sec(a) : 'с начала';
    const endTxt = l.tEnd > 0 && l.tEnd < max - 0.05 ? 'до ' + sec(b) : 'до конца';
    sum.textContent = 'Виден ' + startTxt + ' ' + endTxt;
    const parts = [];
    if (fi > 0.05) parts.push('появляется плавно ' + sec(fi));
    if (fo > 0.05) parts.push('исчезает плавно ' + sec(fo));
    fadeLine.textContent = parts.length ? parts.join(' · ') : 'Появляется и исчезает сразу';
  };

  const update = () => {
    paint();
    touch();
  };

  const secAt = (e) => {
    const rc = track.getBoundingClientRect();
    return clamp((e.clientX - rc.left) / Math.max(1, rc.width), 0, 1) * max;
  };

  const drag = (el, onMove) => {
    let pid = null;
    el.addEventListener('pointerdown', (e) => {
      pid = e.pointerId;
      try { el.setPointerCapture(pid); } catch (err) {}
      e.preventDefault();
      e.stopPropagation();
    });
    el.addEventListener('pointermove', (e) => {
      if (pid !== e.pointerId) return;
      onMove(secAt(e));
    });
    const end = (e) => { if (pid === e.pointerId) pid = null; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };

  drag(hA, (t) => {
    l.tStart = r1(clamp(t, 0, endOf() - MIN));
    fit();
    update();
  });

  drag(hB, (t) => {
    const v = r1(clamp(t, startOf() + MIN, max));
    l.tEnd = v >= max - 0.05 && !(l.fadeOut > 0) ? 0 : v;
    fit();
    update();
  });

  drag(kIn, (t) => {
    const a = startOf();
    l.fadeIn = r1(clamp(t - a, 0, Math.min(MAXFADE, endOf() - a)));
    update();
  });

  drag(kOut, (t) => {
    if (!(l.tEnd > 0)) l.tEnd = max;
    const a = startOf();
    const b = endOf();
    l.fadeOut = r1(clamp(b - t, 0, Math.min(MAXFADE, b - a)));
    if (l.fadeOut === 0 && l.tEnd >= max - 0.05) l.tEnd = 0;
    update();
  });

  let mv = null;
  block.addEventListener('pointerdown', (e) => {
    mv = { pid: e.pointerId, off: secAt(e) - startOf(), len: endOf() - startOf() };
    try { block.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  block.addEventListener('pointermove', (e) => {
    if (!mv || mv.pid !== e.pointerId) return;
    const a = r1(clamp(secAt(e) - mv.off, 0, Math.max(0, max - mv.len)));
    const b = r1(a + mv.len);
    l.tStart = a;
    l.tEnd = b >= max - 0.05 && !(l.fadeOut > 0) ? 0 : b;
    update();
  });
  const mvEnd = (e) => { if (mv && mv.pid === e.pointerId) mv = null; };
  block.addEventListener('pointerup', mvEnd);
  block.addEventListener('pointercancel', mvEnd);

  const reset = ovlEl('button', 'viz-mini', '↺ Весь ролик');
  reset.type = 'button';
  reset.title = 'Показывать слой весь ролик, без плавности';
  reset.addEventListener('click', () => {
    l.tStart = 0;
    l.tEnd = 0;
    l.fadeIn = 0;
    l.fadeOut = 0;
    buzz();
    update();
  });

  wrap.append(
    sum,
    track,
    scale,
    fadeLine,
    reset,
    ovlEl('p', 'viz-wave-hint', 'Тяните белые края полосы: это начало и конец показа. Кружки сверху — плавное появление и исчезновение. Пока открыта вкладка, слой виден всегда, вне времени показа — полупрозрачный.')
  );
  pane.append(wrap);
  paint();
  return pane;
}
function ovlPaneTimeOld2(l) {
  const max = Math.max(1, Math.round(duration * 10) / 10);
  const sec = (v) => v.toFixed(1) + ' с';
  const pane = ovlEl('div', 'viz-pane');
  pane.append(
    ovlSlider('Начало', 0, max, 0.1, Math.min(l.tStart || 0, max), sec, (v) => { l.tStart = v; touch(); }, 0),
    ovlSlider('Конец', 0, max, 0.1, Math.min(l.tEnd || 0, max), (v) => (v > 0 ? sec(v) : 'до конца'), (v) => { l.tEnd = v; touch(); }, 0),
      ovlSlider('Вход', 0, 3, 0.1, l.fadeIn || 0, sec, (v) => { l.fadeIn = v; touch(); }, 0),
       ovlSlider('Выход', 0, 3, 0.1, l.fadeOut || 0, sec, (v) => { l.fadeOut = v; touch(); }, 0),
    ovlEl('p', 'viz-wave-hint', 'Вход и выход — длительность плавного появления и исчезновения. Выход работает, если задан «Конец». Пока открыта вкладка, слой виден всегда, вне времени показа — полупрозрачный.')
  );
  return pane;
}
let ovlColorOpen = false;

const OVL_QUICK = ['#000000', '#ffffff', '#ff2d55', '#ff9500', '#ffd60a', '#34c759', '#00e5ff', '#7c3aed'];
const ovlRecent = [];

function ovlRememberColor(hex) {
  const c = String(hex || '').toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(c)) return;
  const i = ovlRecent.indexOf(c);
  if (i >= 0) ovlRecent.splice(i, 1);
  ovlRecent.unshift(c);
  if (ovlRecent.length > 4) ovlRecent.length = 4;
}

function buzz() {
  try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
}
function ovlColorRow(l, prop, label, onPick) {
  const box = ovlEl('div', 'viz-pane');

  const row = ovlEl('div', 'viz-color');
  const swatch = ovlEl('button', 'viz-cbtn');
  swatch.type = 'button';
  swatch.setAttribute('aria-label', label);
  swatch.style.background = l[prop];
  row.append(ovlEl('span', null, label));

  const pick = ovlEl('div', 'viz-cpick');
  pick.hidden = ovlColorOpen !== prop;
  const sv = ovlEl('div', 'viz-cpick-sv');
  const svDot = document.createElement('i');
  sv.append(svDot);
  const hueBar = ovlEl('div', 'viz-cpick-hue');
  const hueDot = document.createElement('i');
  hueBar.append(hueDot);
  const prow = ovlEl('div', 'viz-cpick-row');
  const prev = ovlEl('span', 'viz-cpick-prev');
  const hexIn = document.createElement('input');
  hexIn.type = 'text';
  hexIn.maxLength = 7;
  hexIn.spellcheck = false;
  hexIn.autocomplete = 'off';
  hexIn.setAttribute('aria-label', 'Код цвета');
  const ok = ovlEl('button', 'viz-btn viz-btn-primary', 'Готово');
  ok.type = 'button';
  prow.append(prev, hexIn, ok);
  pick.append(sv, hueBar, prow);
  const quick = ovlEl('div', 'viz-quick');
  box.append(row, quick, pick);

  const start = hexToHsv(l[prop]) || { h: 0, s: 0, v: 1 };
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
    l[prop] = hex;
    swatch.style.background = hex;
    if (onPick) onPick();
    else touch();
  }

  cpDrag(sv, (x, y) => {
    s = x;
    v = 1 - y;
    apply(false);
  });

  cpDrag(hueBar, (x) => {
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
    ovlColorOpen = ovlColorOpen === prop ? false : prop;
    renderOvl();
    const opened = ovlBox.querySelector('.viz-cpick:not([hidden])');
    if (opened) opened.scrollIntoView({ block: 'nearest' });
  });

  ok.addEventListener('click', () => {
    ovlColorOpen = false;
    pick.hidden = true;
    ovlRememberColor(l[prop]);
    fillQuick();
  });

  function fillQuick() {
    quick.textContent = '';
    const add = (hex) => {
      const b = ovlEl('button', 'viz-qsw');
      b.type = 'button';
      b.style.background = hex;
      b.setAttribute('aria-label', hex);
      b.addEventListener('click', () => {
        const hsv = hexToHsv(hex);
        if (!hsv) return;
        h = hsv.h;
        s = hsv.s;
        v = hsv.v;
        apply(false);
        ovlRememberColor(hex);
        fillQuick();
        buzz();
      });
      quick.append(b);
    };
    OVL_QUICK.forEach(add);
    if (ovlRecent.length) {
      quick.append(ovlEl('span', 'viz-qsep'));
      ovlRecent.forEach(add);
    }
    quick.append(ovlEl('span', 'viz-qsep'));
    quick.append(swatch);
  }

  fillQuick();
  render(false);
  return box;
}
let ovlTextTab = 'font';

function ovlPaneColor(l) {
  const pane = ovlEl('div', 'viz-pane');
  pane.append(ovlColorRow(l, 'color', 'Цвет текста'), ovlCommon(l, 0.03, 0.4));
  return pane;
}

function ovlPaneEffect(l, kind) {
  const isOut = kind === 'outline';
  const flag = isOut ? 'outline' : 'shadow';
  const pane = ovlEl('div', 'viz-pane');

  const sw = ovlSwitch(l, flag);
  const enable = sw.enable;
  pane.append(ovlSwitchRow(sw, 'Контур'));

  if (isOut) {
    pane.append(
      ovlColorRow(l, 'outlineColor', 'Цвет контура', enable),
        ovlSlider('Толщина', 0.02, 0.3, 0.01, l.outlineWidth, pct, (v) => { l.outlineWidth = v; enable(); }, 0.12)
    );
  } else {
    pane.append(
      ovlColorRow(l, 'shadowColor', 'Цвет тени', enable),
           ovlSlider('Размытие', 0, 0.6, 0.01, l.shadowBlur, pct, (v) => { l.shadowBlur = v; enable(); }, 0.15),
             ovlSlider('Смещение ↔', -0.25, 0.25, 0.005, l.shadowX || 0, pct, (v) => { l.shadowX = v; enable(); }, 0),
         ovlSlider('Смещение ↕', -0.25, 0.25, 0.005, l.shadowDist, pct, (v) => { l.shadowDist = v; enable(); }, 0.04)
    );
  }
  return pane;
}
function ovlSwitch(l, flag) {
  const tg = ovlEl('button', 'viz-switch');
  tg.type = 'button';
  tg.setAttribute('role', 'switch');
  tg.append(document.createElement('span'));

  function paint() {
    tg.setAttribute('aria-checked', l[flag] ? 'true' : 'false');
  }

  paint();
  tg.addEventListener('click', () => {
    l[flag] = !l[flag];
    buzz();
    touch();
    renderOvl();
  });

  return {
    tg: tg,
    enable() {
      if (!l[flag]) {
        l[flag] = true;
        paint();
      }
      touch();
    }
  };
}

function ovlSwitchRow(sw, text) {
  const row = ovlEl('div', 'viz-set-inline');
  row.append(ovlEl('span', 'viz-set-label', text), sw.tg);
  return row;
}

let ovlShadowIdx = 1;

function ovlShadowReset(l) {
  const names = { 1: 'Тень 1', 2: 'Тень 2', 3: 'Внутри' };
  const b = ovlEl('button', 'viz-mini', '↺ Сброс');
  b.style.marginLeft = 'auto';
  b.title = 'Сбросить: ' + names[ovlShadowIdx];
  b.type = 'button';
  b.addEventListener('click', () => {
    buzz();
    resetShadow(l.id, ovlShadowIdx);
    ovlColorOpen = false;
    renderOvl();
  });
  return b;
}
function ovlPaneShadow(l) {
  const second = ovlShadowIdx === 2;
  const third = ovlShadowIdx === 3;
  const k = third
    ? { flag: 'inner', color: 'innerColor', alpha: 'innerAlpha', blur: 'innerBlur', x: 'innerX', y: 'innerY' }
    : second
      ? { flag: 'shadow2', color: 'shadow2Color', alpha: 'shadow2Alpha', blur: 'shadow2Blur', x: 'shadow2X', y: 'shadow2Y' }
      : { flag: 'shadow', color: 'shadowColor', alpha: 'shadowAlpha', blur: 'shadowBlur', x: 'shadowX', y: 'shadowDist' };
  const sw = ovlSwitch(l, k.flag);
    const offX = l[k.x] || 0;
  const offY = l[k.y] || 0;
  let dist = Math.hypot(offX, offY);
  let ang = dist > 0.0005 ? Math.round(((Math.atan2(offY, offX) * 180) / Math.PI + 360) % 360) : 90;
  const applyOffset = () => {
    const r = (ang * Math.PI) / 180;
    l[k.x] = Math.cos(r) * dist;
    l[k.y] = Math.sin(r) * dist;
    sw.enable();
  };
  const pane = ovlEl('div', 'viz-pane');

  const row = ovlEl('div', 'viz-seg');
  [1, 2, 3].forEach((n) => {
    const on = n === 1 ? l.shadow : n === 2 ? l.shadow2 : l.inner;
    const b = ovlEl('button', 'viz-sub' + (ovlShadowIdx === n ? ' active' : ''), n === 3 ? 'Внутри' : 'Тень ' + n);
    b.style.padding = '4px 2px 1px';
    b.style.lineHeight = '1.2';
    if (on) {
      const dot = ovlEl('i', 'viz-dot');
  
      b.append(dot);
    }
    b.type = 'button';
    b.addEventListener('click', () => {
      ovlShadowIdx = n;
      ovlColorOpen = false;
      renderOvl();
    });
    row.append(b);
  });

  row.style.alignItems = 'center';
  row.style.gap = '6px';
  row.append(sw.tg, ovlShadowReset(l));

  pane.append(
    row,
        ovlColorRow(l, k.color, third ? 'Цвет внутр. тени' : second ? 'Цвет тени 2' : 'Цвет тени', sw.enable),
       ovlSlider('Прозрачность', 0, 1, 0.01, l[k.alpha] == null ? 0.8 : l[k.alpha], pct, (v) => { l[k.alpha] = v; sw.enable(); }, third ? 0.9 : second ? 1 : 0.8),
       ovlSlider('Размытие', 0, 0.8, 0.01, l[k.blur], pct, (v) => { l[k.blur] = v; sw.enable(); }, third ? 0.12 : second ? 0.4 : 0.15),
       ovlSlider('Угол', 0, 360, 1, ang, deg, (v) => { ang = v; applyOffset(); }, 90),
      ovlSlider('Дистанция', 0, 0.35, 0.005, Math.min(dist, 0.35), pct, (v) => { dist = v; applyOffset(); }, third ? 0.05 : second ? 0 : 0.04),
  );
  return pane;
}

function ovlPaneNeon(l) {
  const sw = ovlSwitch(l, 'neon');
  const pane = ovlEl('div', 'viz-pane');
  pane.append(
    ovlSwitchRow(sw, 'Неон'),
    ovlColorRow(l, 'neonColor', 'Цвет свечения', sw.enable),
       ovlSlider('Радиус', 0.1, 1.2, 0.01, l.neonSize, pct, (v) => { l.neonSize = v; sw.enable(); }, 0.5),
    ovlSlider('Слои', 1, 3, 1, l.neonLayers, num, (v) => { l.neonLayers = Math.round(v); sw.enable(); }, 3),
       ovlSlider('Трубка', 0.02, 0.15, 0.005, l.neonTube == null ? 0.06 : l.neonTube, pct, (v) => { l.neonTube = v; sw.enable(); }, 0.06),
    ovlEl('p', 'viz-wave-hint', 'Неон делает текст белым, а цвет свечения берётся отсюда.')
  );
  return pane;
}

function ovlPaneLong(l) {
  const sw = ovlSwitch(l, 'long');
  const pane = ovlEl('div', 'viz-pane');
  pane.append(
    ovlSwitchRow(sw, 'Длинная тень'),
    ovlColorRow(l, 'longColor', 'Цвет тени', sw.enable),
    ovlSlider('Длина', 0.05, 2, 0.01, l.longLen, pct, (v) => { l.longLen = v; sw.enable(); }, 0.6),
    ovlSlider('Угол', 0, 360, 5, l.longAngle, deg, (v) => { l.longAngle = v; sw.enable(); }, 45)
  );
  return pane;
}
let ovlTplOpen = false;

// ТОЛЬКО КОМПЬЮТЕР: шаблоны и стикеры живут во вкладке «Текст», под кнопкой «Добавить текст».
function ovlTemplatesBlock(root, collapsible) {
  const open = !collapsible || ovlTplOpen;
  if (collapsible) {
    const fold = ovlEl('button', 'viz-ovl-fold' + (open ? ' open' : ''), 'Шаблоны');
    fold.type = 'button';
    fold.addEventListener('click', () => {
      ovlTplOpen = !ovlTplOpen;
      renderOvl();
    });
    root.append(fold);
  }
  if (!open) return;
  const box = ovlEl('div', 'ovl-tpl');
  root.append(box);
  const fill = () => {
    box.textContent = '';
    const host = ovlEl('div', 'ovl-tpl-host');
    box.append(host);
    mountTemplatesPanel(host, {
      ready: ovlReady,
      canApply: () => !exporting,
      onApply: () => {
        buzz();
        renderOvl();
      }
    });
  };
  fill();
}
function ovlRenderText(root) {
  if (!ovlReady()) {
    root.append(ovlEl('p', 'viz-ovl-title', 'Сначала добавьте фото или трек, потом можно добавлять текст.'));
    return;
  }
  const add = ovlEl('button', 'viz-btn viz-btn-primary', '+ Добавить текст');
  add.type = 'button';
  add.addEventListener('click', () => {
    addText(FONTS[0]);
    renderOvl();
  });
    const head = ovlEl('div', 'viz-ovl-head');
   head.append(add);
  root.append(head);

  const l = getSelected();
  if (window.matchMedia('(min-width: 1024px)').matches) ovlTemplatesBlock(root, !!l && l.type === 'text');
  if (!l || l.type !== 'text') return;
  const ta = ovlEl('textarea', 'viz-ovl-text');
  ta.rows = 1;
  ta.value = l.text;
  ta.addEventListener('input', () => {
    l.text = ta.value || ' ';
    touch();
  });
  root.append(ta);

const tabs = [['font', 'Шрифт'], ['fx', 'Эффекты'], ['anim', 'Анимация'], ['time', 'Время']];
    const tabOn = { fx: l.outline || l.shadow || l.shadow2 || l.inner || l.long || l.plate || !!l.curve, anim: !!l.anim && l.anim !== 'none', time: !!(l.tStart || l.tEnd || l.fadeIn || l.fadeOut) };
  const bar = ovlEl('div', 'viz-seg');
  bar.style.overflowX = 'auto';
  bar.classList.add('viz-tabscroll');
  tabs.forEach((t) => {
    const b = ovlEl('button', 'viz-chip' + (ovlTextTab === t[0] ? ' active' : ''), t[1]);
    if (tabOn[t[0]]) {
      const dot = ovlEl('i', 'viz-dot');
      
      b.append(dot);
    }
    b.type = 'button';
    b.style.flex = '0 0 auto';
        b.style.padding = '4px 9px';
    b.addEventListener('click', () => {
      ovlTextTab = t[0];
      ovlColorOpen = false;
      renderOvl();
    });
    bar.append(b);
  });
  root.append(bar);

   if (ovlTextTab === 'fx') root.append(ovlPaneFx(l));
  else if (ovlTextTab === 'outline') root.append(ovlPaneEffect(l, 'outline'));
  else if (ovlTextTab === 'shadow') root.append(ovlPaneShadow(l));

  else if (ovlTextTab === 'long') root.append(ovlPaneLong(l));
  else if (ovlTextTab === 'size') root.append(ovlPaneSize(l));
else if (ovlTextTab === 'anim') root.append(ovlPaneAnim(l, false));
  else if (ovlTextTab === 'time') root.append(ovlPaneTime(l));
    else if (ovlTextTab === 'plate') root.append(ovlPanePlate(l));
  else if (ovlTextTab === 'curve') root.append(ovlPaneCurve(l));
  else root.append(ovlPaneFont(l));
  
    const reset = ovlEl('button', 'viz-mini', '↺ Всё');
  reset.title = 'Сбросить весь стиль текста';
  reset.type = 'button';
  reset.addEventListener('click', () => {
       buzz();
    resetTextStyle(l.id);
    ovlColorOpen = false;
    renderOvl();
  });
       head.append(ovlHistBtns(), ovlStyleBtns(l), reset);
}
let ovlStickerTab = 'all';
let ovlTimeOpen = false;
let stickerRecent = (() => {
  try {
    const v = JSON.parse(localStorage.getItem('viz-recent-stickers') || '[]');
    return Array.isArray(v) ? v.filter((u) => typeof u === 'string').slice(0, 8) : [];
  } catch (e) {
    return [];
  }
})();
function rememberSticker(url) {
  stickerRecent = [url].concat(stickerRecent.filter((u) => u !== url)).slice(0, 8);
  try { localStorage.setItem('viz-recent-stickers', JSON.stringify(stickerRecent)); } catch (e) {}
}
let stkPreview = null;
function showStickerPreview(url) {
  if (!stkPreview) {
    stkPreview = document.createElement('div');
    stkPreview.className = 'viz-stk-preview';
    stkPreview.hidden = true;
    stkPreview.append(document.createElement('img'));
    document.body.append(stkPreview);
  }
  stkPreview.firstChild.src = url;
  stkPreview.hidden = false;
}
function hideStickerPreview() {
  if (stkPreview) stkPreview.hidden = true;
}
function ovlProjectRows() {
  const box = ovlEl('div', 'viz-layers');
  const row = (name, status, on, tap, key) => {
    const r = ovlEl(tap ? 'button' : 'div', 'viz-prow' + (on ? ' on' : ''));
    if (tap) {
      r.type = 'button';
      r.addEventListener('click', tap);
    }
    r.append(ovlEl('i', 'viz-pdot'), ovlEl('span', 'viz-pname', name), ovlEl('span', 'viz-pstat', status));
    if (!key) {
      box.append(r);
      return;
    }
    const order = getLayerOrder();
    const idx = order.indexOf(key);
      const wrap = ovlEl('div', 'viz-lrow');
    wrap.style.padding = '0';
    wrap.style.border = '0';
    wrap.style.background = 'none';
    wrap.style.gap = '4px';
    r.style.flex = '1 1 auto';
    r.style.minWidth = '0';
    wrap.append(r);
    [['↑', 1, 'Выше'], ['↓', -1, 'Ниже']].forEach((d) => {
      const b = ovlEl('button', 'viz-lbtn on', d[0]);
      b.type = 'button';
      b.title = d[2];
      b.setAttribute('aria-label', d[2]);
      b.disabled = idx + d[1] < 0 || idx + d[1] >= order.length;
      b.style.opacity = b.disabled ? '0.2' : '1';
      b.addEventListener('click', () => {
        if (moveLayerKey(key, d[1])) {
          buzz();
          touch();
          renderOvl();
        }
      });
      wrap.append(b);
    });
    box.append(wrap);
  };
  const openTabBy = (id) => () => tabBar.querySelector('[data-tab="' + id + '"]').click();

  row('Трек', buffer ? (trackInfo.textContent || 'загружен') : 'не добавлен', !!buffer, buffer ? null : () => fileInput.click());

  let bg = 'стандартный';
  if (transparentMode) bg = 'прозрачный';
  else if (hasVideo()) bg = 'видео';
  else if (photoUrl) bg = slideshow.on ? 'слайд-шоу · ' + slideshow.list.length : 'фото';
  row('Фон', bg, transparentMode || hasVideo() || !!photoUrl, (photoUrl && !hasVideo()) ? () => openSlideSheet() : null);

  // сверху вниз: верхняя строка лежит поверх остальных
  getLayerOrder().reverse().forEach((key) => {
    if (key === 'waves') {
      if (transparentMode) return;
      const st = STYLES.find((s) => s.id === currentStyle);
      row('Волны', st ? st.name : 'выкл', !!st, () => { showTab(null); openWavePanel(); }, 'waves');
    } else if (key === 'particles') {
      const pt = PARTICLE_TYPES.find((p) => p.id === particles.type);
      row('Частицы', pt ? pt.name : 'выкл', !!pt, openTabBy('particles'), 'particles');
    } else if (key === 'effects') {
      if (transparentMode) return;
      const act = EFFECT_ITEMS.filter((d) => d.k !== 'sens' && effects[d.k] !== EFFECT_DEFAULTS[d.k]);
      let txt = 'выкл';
      if (act.length) txt = act.slice(0, 3).map((d) => d.label).join(', ') + (act.length > 3 ? ' +' + (act.length - 3) : '');
      row('Эффекты', txt, act.length > 0, openTabBy('effects'), 'effects');
    }
  });
  return box;
}
// ===== вкладка «Слои» для компьютера: полочки с разделителями =====
const lzSvg = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
const LZ_SVG = {
  track: lzSvg('<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
  bg: lzSvg('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>'),
  effects: lzSvg('<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M19 15v5M16.5 17.5h5"/>'),
  particles: lzSvg('<circle cx="7" cy="8" r="1.7"/><circle cx="16" cy="6" r="1.1"/><circle cx="17" cy="15" r="2.2"/><circle cx="8" cy="17" r="1.2"/>'),
  waves: lzSvg('<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>'),
  text: lzSvg('<path d="M5 7V5h14v2M12 5v14M9 19h6"/>'),
  image: lzSvg('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>'),
  up: lzSvg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: lzSvg('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  copy: lzSvg('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  trash: lzSvg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
  sliders: lzSvg('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'),
  plus: lzSvg('<path d="M12 5v14M5 12h14"/>'),
  stack: lzSvg('<path d="M12 3l9 4.5-9 4.5-9-4.5z"/><path d="M3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5"/>')
};

function lzIco(name, cls) {
  const s = ovlEl('span', 'lz-ico' + (cls ? ' ' + cls : ''));
  s.innerHTML = LZ_SVG[name] || '';
  return s;
}

function lzSection(title, note, extra) {
  const sec = ovlEl('section', 'lz-sec');
  const head = ovlEl('div', 'lz-sec-head');
  head.append(ovlEl('span', 'lz-sec-title', title), ovlEl('span', 'lz-sec-line'));
  if (note != null && note !== '') head.append(ovlEl('span', 'lz-sec-note', note));
  if (extra) head.append(extra);
  sec.append(head);
  return sec;
}

function lzRow(icon, name, status, on, tap) {
  const r = ovlEl(tap ? 'button' : 'div', 'lz-row' + (on ? ' on' : '') + (tap ? ' tap' : ''));
  if (tap) {
    r.type = 'button';
    r.addEventListener('click', tap);
  }
  r.append(lzIco(icon, 'lz-tile'), ovlEl('span', 'lz-name', name), ovlEl('span', 'lz-stat', status));
  return r;
}

function lzStackRow(key, icon, name, status, on, tap) {
  const order = getLayerOrder();
  const idx = order.indexOf(key);
  const wrap = ovlEl('div', 'lz-srow' + (on ? ' on' : ''));
  const mv = ovlEl('div', 'lz-move');
  [['up', 1, 'Выше'], ['down', -1, 'Ниже']].forEach((d) => {
    const b = ovlEl('button', 'lz-mbtn');
    b.type = 'button';
    b.title = d[2];
    b.setAttribute('aria-label', d[2]);
    b.innerHTML = LZ_SVG[d[0]];
    b.disabled = idx + d[1] < 0 || idx + d[1] >= order.length;
    b.addEventListener('click', () => {
      if (moveLayerKey(key, d[1])) {
        buzz();
        touch();
        renderOvl();
      }
    });
    mv.append(b);
  });
  wrap.append(lzRow(icon, name, status, on, tap), mv);
  return wrap;
}

function lzLayerRows() {
  const all = getLayers();
  const box = ovlEl('div', 'lz-list');
  for (let i = all.length - 1; i >= 0; i--) {
    const l = all[i];
    const row = ovlEl('div', 'lz-lrow' + (getSelected() === l ? ' active' : '') + (l.hidden ? ' off' : ''));
    const name = l.type === 'text' ? (String(l.text).trim().slice(0, 14) || 'Текст') : 'Стикер ' + (i + 1);
    const pick = ovlEl('button', 'lz-lpick');
    pick.type = 'button';
    pick.append(lzIco(l.type === 'text' ? 'text' : 'image', 'lz-tile sm'), ovlEl('span', 'lz-name', name));
    pick.addEventListener('click', () => ovlSelect(l.id));

    const mkBtn = (on, html, title, fn) => {
      const b = ovlEl('button', 'lz-lbtn' + (on ? ' on' : ''));
      b.type = 'button';
      b.innerHTML = html;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.addEventListener('click', fn);
      return b;
    };
    const eye = mkBtn(!l.hidden, ICON_EYE, l.hidden ? 'Показать' : 'Скрыть', () => {
      l.hidden = !l.hidden;
      buzz();
      touch();
      renderOvl();
    });
    const lock = mkBtn(!!l.locked, ICON_LOCK, l.locked ? 'Открепить' : 'Закрепить', () => {
      l.locked = !l.locked;
      buzz();
      touch();
      renderOvl();
    });
    row.append(pick, eye);
    if (l.group) {
      const glue = mkBtn(!l.gOpen, l.gOpen ? ICON_UNLOCK : ICON_LOCK, l.gOpen ? 'Части свободны. Нажми, чтобы склеить шаблон' : 'Шаблон склеен. Нажми, чтобы разделить на части', () => {
        setGroupOpen(l.group, !l.gOpen);
        buzz();
        renderOvl();
      });
      row.append(glue);
    }
    row.append(lock);
    box.append(row);
  }
  return box;
}
// ===== общая стопка: волны, частицы, эффекты, текст и стикеры вперемешку =====
let lzDrag = null;

// Снизу вверх. У текста и стикера vz = сколько визуальных слоёв лежит под ним (0..3).
function lzUnified() {
  const vis = getLayerOrder();
  const out = [];
  for (let s = 0; s <= vis.length; s++) {
    getLayers().forEach((l) => {
      const z = Math.min(vis.length, Math.max(0, l.vz == null ? vis.length : l.vz));
      if (z === s) out.push({ kind: 'ovl', l: l });
    });
    if (s < vis.length) out.push({ kind: 'vis', key: vis[s] });
  }
  return out;
}

function lzSame(a, b) {
  return a.kind === b.kind && (a.kind === 'vis' ? a.key === b.key : a.l === b.l);
}

function lzSkip(it) {
  return it.kind === 'vis' && transparentMode && it.key !== 'particles';
}

function lzApply(list) {
  const vis = [];
  const ovl = [];
  list.forEach((it) => {
    if (it.kind === 'vis') {
      vis.push(it.key);
    } else {
      it.l.vz = vis.length;
      ovl.push(it.l);
    }
  });
  setLayerOrder(vis.join(','));
  const arr = getLayers();
  arr.splice(0, arr.length);
  ovl.forEach((l) => arr.push(l));
  touch();
}

// dir = 1: выше (ближе к зрителю), dir = -1: ниже.
function lzMove(item, dir) {
  const full = lzUnified();
  const i = full.findIndex((x) => lzSame(x, item));
  if (i < 0) return false;
  let j = i + dir;
  while (j >= 0 && j < full.length && lzSkip(full[j])) j += dir;
  if (j < 0 || j >= full.length) return false;
  const it = full.splice(i, 1)[0];
  full.splice(j, 0, it);
  lzApply(full);
  return true;
}

// above = true: положить выше строки target, false: ниже неё.
function lzDrop(item, target, above) {
  const full = lzUnified();
  const it = full.find((x) => lzSame(x, item));
  if (!it) return;
  const rest = full.filter((x) => x !== it);
  const k = rest.findIndex((x) => lzSame(x, target));
  if (k < 0) return;
  rest.splice(above ? k + 1 : k, 0, it);
  lzApply(rest);
}

function lzUniRow(it, canUp, canDown, openTabBy) {
  let wrap;
  if (it.kind === 'vis') {
    const key = it.key;
    let name = '';
    let status = '';
    let on = false;
    let tap = null;
    if (key === 'waves') {
      const st = STYLES.find((s) => s.id === currentStyle);
      name = 'Волны';
      status = st ? st.name : 'выкл';
      on = !!st;
      tap = () => { showTab(null); openWavePanel(); };
    } else if (key === 'particles') {
      const pt = PARTICLE_TYPES.find((p) => p.id === particles.type);
      name = 'Частицы';
      status = pt ? pt.name : 'выкл';
      on = !!pt;
      tap = openTabBy('particles');
    } else {
      const act = EFFECT_ITEMS.filter((d) => d.k !== 'sens' && effects[d.k] !== EFFECT_DEFAULTS[d.k]);
      let txt = 'выкл';
      if (act.length) txt = act.slice(0, 3).map((d) => d.label).join(', ') + (act.length > 3 ? ' +' + (act.length - 3) : '');
      name = 'Эффекты';
      status = txt;
      on = act.length > 0;
      tap = openTabBy('effects');
    }
    wrap = ovlEl('div', 'lz-srow' + (on ? ' on' : ''));
    const vrow = lzRow(key, name, status, on, null);
    const gear = ovlEl('button', 'lz-lbtn on');
    gear.type = 'button';
    gear.title = 'Настройки слоя';
    gear.setAttribute('aria-label', 'Настройки слоя');
    gear.innerHTML = LZ_SVG.sliders;
    gear.addEventListener('click', tap);
    vrow.append(gear);
    wrap.append(vrow);
  } else {
    const l = it.l;
    const picked = getSelected() === l;
    wrap = ovlEl('div', 'lz-srow' + (picked ? ' on' : ''));
    const row = ovlEl('div', 'lz-lrow' + (picked ? ' active' : '') + (l.hidden ? ' off' : ''));
    const name = l.type === 'text' ? (String(l.text).trim().slice(0, 14) || 'Текст') : 'Стикер ' + (getLayers().indexOf(l) + 1);
    const pick = ovlEl('button', 'lz-lpick');
    pick.type = 'button';
    pick.append(lzIco(l.type === 'text' ? 'text' : 'image', 'lz-tile sm'), ovlEl('span', 'lz-name', name));
    pick.addEventListener('click', () => ovlSelect(l.id));

    const mkBtn = (on, html, title, fn) => {
      const b = ovlEl('button', 'lz-lbtn' + (on ? ' on' : ''));
      b.type = 'button';
      b.innerHTML = html;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.addEventListener('click', fn);
      return b;
    };
    const eye = mkBtn(!l.hidden, ICON_EYE, l.hidden ? 'Показать' : 'Скрыть', () => {
      l.hidden = !l.hidden;
      buzz();
      touch();
      renderOvl();
    });
    const lock = mkBtn(!!l.locked, ICON_LOCK, l.locked ? 'Открепить' : 'Закрепить', () => {
      l.locked = !l.locked;
      buzz();
      touch();
      renderOvl();
    });
    row.append(pick, eye);
    if (l.group) {
      const glue = mkBtn(!l.gOpen, l.gOpen ? ICON_UNLOCK : ICON_LOCK, l.gOpen ? 'Части свободны. Нажми, чтобы склеить шаблон' : 'Шаблон склеен. Нажми, чтобы разделить на части', () => {
        setGroupOpen(l.group, !l.gOpen);
        buzz();
        renderOvl();
      });
      row.append(glue);
    }
    row.append(lock);
    wrap.append(row);
  }

  const mv = ovlEl('div', 'lz-move');
  [['up', 1, 'Выше', canUp], ['down', -1, 'Ниже', canDown]].forEach((d) => {
    const b = ovlEl('button', 'lz-mbtn');
    b.type = 'button';
    b.title = d[2];
    b.setAttribute('aria-label', d[2]);
    b.innerHTML = LZ_SVG[d[0]];
    b.disabled = !d[3];
    b.addEventListener('click', () => {
      if (lzMove(it, d[1])) {
        buzz();
        renderOvl();
      }
    });
    mv.append(b);
  });
  wrap.append(mv);

  // перетаскивание мышью
  wrap.draggable = true;
  wrap.addEventListener('dragstart', (e) => {
    lzDrag = it;
    wrap.classList.add('dragging');
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'layer');
    } catch (err) {}
  });
  wrap.addEventListener('dragend', () => {
    lzDrag = null;
    wrap.classList.remove('dragging');
  });
  wrap.addEventListener('dragover', (e) => {
    if (!lzDrag || lzSame(lzDrag, it)) return;
    e.preventDefault();
    const r = wrap.getBoundingClientRect();
    const up = e.clientY < r.top + r.height / 2;
    wrap.classList.toggle('drop-up', up);
    wrap.classList.toggle('drop-down', !up);
  });
  wrap.addEventListener('dragleave', () => {
    wrap.classList.remove('drop-up', 'drop-down');
  });
  wrap.addEventListener('drop', (e) => {
    if (!lzDrag) return;
    e.preventDefault();
    const r = wrap.getBoundingClientRect();
    const up = e.clientY < r.top + r.height / 2;
    const src = lzDrag;
    lzDrag = null;
    wrap.classList.remove('drop-up', 'drop-down');
    if (lzSame(src, it)) return;
    lzDrop(src, it, up);
    buzz();
    renderOvl();
  });
  return wrap;
}
function ovlRenderLayersDesk(root) {
  const all = getLayers();
  const l = getSelected();
  const openTabBy = (id) => () => tabBar.querySelector('[data-tab="' + id + '"]').click();

  // шапка
  const top = ovlEl('div', 'lz-top');
  const ttl = ovlEl('div', 'lz-top-t');
  ttl.append(ovlEl('b', '', 'Слои'), ovlEl('span', '', 'Порядок, видимость и состав проекта'));
  top.append(ttl, ovlHistBtns());
  root.append(top);

  // полка 1: исходники
  const src = lzSection('Исходники', '');
  const srcBox = ovlEl('div', 'lz-rows');
  srcBox.append(lzRow('track', 'Трек', buffer ? (trackInfo.textContent || 'загружен') : 'не добавлен', !!buffer, buffer ? null : () => fileInput.click()));
  let bg = 'стандартный';
  if (transparentMode) bg = 'прозрачный';
  else if (hasVideo()) bg = 'видео';
  else if (photoUrl) bg = slideshow.on ? 'слайд-шоу · ' + slideshow.list.length : 'фото';
  srcBox.append(lzRow('bg', 'Фон', bg, transparentMode || hasVideo() || !!photoUrl, (photoUrl && !hasVideo()) ? () => openSlideSheet() : null));
  src.append(srcBox);
  root.append(src);

   // полка 2: общая стопка, верхняя строка лежит поверх остальных
  const stackSec = lzSection('Порядок слоёв', 'тяните или стрелки');
  const stack = ovlEl('div', 'lz-stack');
  const rows = lzUnified().filter((x) => !lzSkip(x)).reverse();
  rows.forEach((it, i) => {
    stack.append(lzUniRow(it, i > 0, i < rows.length - 1, openTabBy));
  });
  stackSec.append(stack);
  if (!all.length) {
    const empty = ovlEl('div', 'lz-empty');
    empty.append(lzIco('stack', 'lz-empty-ico'));
    empty.append(ovlEl('b', '', 'Текста и стикеров пока нет'));
    empty.append(ovlEl('span', '', 'Добавьте текст или стикер, и они появятся в этом списке.'));
    const btns = ovlEl('div', 'lz-empty-btns');
    [['text', 'Текст', 'text'], ['image', 'Шаблоны', 'text']].forEach((d) => {
      const b = ovlEl('button', 'lz-ghost');
      b.type = 'button';
      b.append(lzIco(d[0]), ovlEl('span', '', d[1]));
      b.addEventListener('click', openTabBy(d[2]));
      btns.append(b);
    });
    empty.append(btns);
    stackSec.append(empty);
    root.append(stackSec);
    return;
  }
  if (!l) stackSec.append(ovlEl('p', 'lz-hint', 'Нажмите на слой в списке или на холсте, чтобы изменить его. Верхний слой лежит поверх нижних.'));
  root.append(stackSec);
  if (!l) return;

  // полка 4: выбранный слой
  let gear = null;
  if (l.type === 'image') {
    gear = ovlEl('button', 'lz-lbtn on');
    gear.type = 'button';
    gear.title = 'Настроить стикер';
    gear.setAttribute('aria-label', 'Настроить стикер');
    gear.innerHTML = LZ_SVG.sliders;
    gear.addEventListener('click', () => openCtxMenu(l, Math.max(8, window.innerWidth - 310), 80));
  }
  const sel = lzSection('Выбранный слой', l.type === 'text' ? 'Текст' : 'Стикер', gear);
  const acts = ovlEl('div', 'lz-acts');
  [
    ['copy', 'Дубль', () => duplicateLayer(l.id), ''],
    ['trash', 'Удалить', () => {
      groupMembers(l).slice().forEach((m) => removeLayer(m.id));
      ovlCollapsed = false;
    }, ' danger']
  ].forEach((d) => {
    const b = ovlEl('button', 'lz-act' + d[3]);
    b.type = 'button';
    b.append(lzIco(d[0]), ovlEl('span', '', d[1]));
    b.addEventListener('click', () => {
      d[2]();
      buzz();
      renderOvl();
    });
    acts.append(b);
  });
  sel.append(acts);
  if (l.type === 'image') {
    const timeBtn = ovlEl('button', 'viz-ovl-fold' + (ovlTimeOpen ? ' open' : ''), 'Время показа');
    timeBtn.type = 'button';
    timeBtn.addEventListener('click', () => {
      ovlTimeOpen = !ovlTimeOpen;
      renderOvl();
    });
    sel.append(ovlPaneAnim(l, true), timeBtn);
    if (ovlTimeOpen) sel.append(ovlPaneTime(l));
  } else {
    const edit = ovlEl('button', 'viz-btn', 'Править текст');
    edit.type = 'button';
    edit.addEventListener('click', () => {
      ovlCollapsed = false;
      showTab('text');
    });
    sel.append(edit);
  }
  root.append(sel);
}
function ovlRenderLayersTab(root) {
  if (!ovlReady()) {
    root.append(ovlEl('p', 'viz-ovl-title', 'Сначала добавьте фото или трек, потом можно работать со слоями.'));
    return;
  }
  if (window.matchMedia('(min-width: 1024px)').matches) {
    ovlRenderLayersDesk(root);
    return;
  }
  const all = getLayers();
  const l = getSelected();
  root.append(ovlEl('p', 'viz-ovl-title', 'Проект'), ovlProjectRows());
  const head = ovlEl('div', 'viz-ovl-head');
  head.append(ovlEl('p', 'viz-ovl-title', 'Слои: ' + all.length));
  if (l && l.type === 'image') {
    const gear = ovlEl('button', 'viz-mini viz-gearbtn');
    gear.type = 'button';
    gear.title = 'Настроить стикер';
    gear.setAttribute('aria-label', 'Настроить стикер');
    gear.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>';
    gear.addEventListener('click', () => openCtxMenu(l, Math.max(8, window.innerWidth - 310), 80));
    head.append(gear);
  }
  head.append(ovlHistBtns());
  root.append(head);
  if (!all.length) {
    root.append(ovlEl('p', 'viz-wave-hint', 'Слоёв пока нет. Текст добавляется во вкладке «Текст», а стикеры и шаблоны во вкладке «Шаблоны».'));
    return;
  }
  root.append(ovlLayerList((x) => ovlSelect(x.id), renderOvl));
  if (!l) {
    root.append(ovlEl('p', 'viz-wave-hint', 'Нажмите на слой в списке или на холсте, чтобы изменить его. Верхний слой в списке лежит поверх нижних.'));
    return;
  }
  const acts = ovlEl('div', 'viz-seg');
  [
    ['↑ Выше', () => ctxMove(l, 'up')],
    ['↓ Ниже', () => ctxMove(l, 'down')],
    ['Дубль', () => duplicateLayer(l.id)],
    ['Удалить', () => {
      groupMembers(l).slice().forEach((m) => removeLayer(m.id));
      ovlCollapsed = false;
    }]
  ].forEach((d) => {
    const b = ovlEl('button', 'viz-chip', d[0]);
    b.type = 'button';
    b.addEventListener('click', () => {
      d[1]();
      buzz();
      renderOvl();
    });
    acts.append(b);
  });
  root.append(acts);
  if (l.type === 'image') {
    const timeBtn = ovlEl('button', 'viz-ovl-fold' + (ovlTimeOpen ? ' open' : ''), 'Время показа');
    timeBtn.type = 'button';
    timeBtn.addEventListener('click', () => {
      ovlTimeOpen = !ovlTimeOpen;
      renderOvl();
    });
    root.append(ovlPaneAnim(l, true), timeBtn);
    if (ovlTimeOpen) root.append(ovlPaneTime(l));
  } else {
    const edit = ovlEl('button', 'viz-btn', 'Править текст');
    edit.type = 'button';
    edit.addEventListener('click', () => {
      ovlCollapsed = false;
      showTab('text');
    });
    root.append(edit);
  }
}

function ovlRenderStickerPicker(root, rerender) {
  if (!ovlReady()) {
    root.append(ovlEl('p', 'viz-ovl-title', 'Сначала добавьте фото или трек, потом можно добавлять стикеры.'));
    return;
  }
  const upRow = ovlEl('div', 'viz-ovl-head');
  const up = ovlEl('button', 'viz-btn viz-btn-primary', '+ Своё изображение');
  up.type = 'button';
  up.addEventListener('click', () => stickerInput.click());
  upRow.append(up);
  root.append(upRow);
  const packs = [['advisory', 'Advisory', STICKERS.advisory], ['icons', 'Иконки', STICKERS.rapiconz]];

  const stkTabs = ovlEl('div', 'viz-seg viz-stk-tabs');
  [['all', 'Все']].concat(packs.map((p) => [p[0], p[1]])).forEach((t) => {
    const b = ovlEl('button', 'viz-sub' + (ovlStickerTab === t[0] ? ' active' : ''), t[1]);
    b.type = 'button';
    b.addEventListener('click', () => {
      ovlStickerTab = t[0];
      rerender();
    });
    stkTabs.append(b);
  });
  root.append(stkTabs);

  const addPack = (title, list) => {
    root.append(ovlEl('p', 'viz-ovl-title', title));
    const grid = ovlEl('div', 'viz-ovl-grid');
    list.forEach((url) => {
      const b = ovlEl('button');
      b.type = 'button';
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.loading = 'lazy';
      b.append(img);

      let timer = 0;
      let held = false;
      let sx = 0;
      let sy = 0;
      const cancel = () => {
        clearTimeout(timer);
        timer = 0;
        hideStickerPreview();
      };
      b.addEventListener('pointerdown', (ev) => {
        held = false;
        sx = ev.clientX;
        sy = ev.clientY;
        clearTimeout(timer);
        timer = setTimeout(() => {
          held = true;
          showStickerPreview(url);
        }, 350);
      });
      b.addEventListener('pointermove', (ev) => {
        if (!held && timer && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 10) {
          clearTimeout(timer);
          timer = 0;
        }
      });
      b.addEventListener('pointerup', cancel);
      b.addEventListener('pointercancel', cancel);
      b.addEventListener('pointerleave', cancel);
      b.addEventListener('contextmenu', (ev) => ev.preventDefault());
      b.addEventListener('click', () => {
        if (held) {
          held = false;
          return;
        }
        rememberSticker(url);
        addSticker(url).then(() => {
          ovlCollapsed = true;
          showTab('layers');
        });
      });
      grid.append(b);
    });
    root.append(grid);
  };

  const knownStickers = STICKERS.advisory.concat(STICKERS.rapiconz);
  const recentStickers = stickerRecent.filter((u) => knownStickers.indexOf(u) !== -1);
  if (ovlStickerTab === 'all' && recentStickers.length) addPack('Недавние', recentStickers);
  packs.forEach((p) => {
    if (ovlStickerTab === 'all' || ovlStickerTab === p[0]) addPack(p[1], p[2]);
  });
}
function ovlPaneFont(l) {
  const pane = ovlEl('div', 'viz-pane');

  const styleBar = ovlEl('div', 'viz-fmtbar');
  [
    ['Жирный', 'bold', 'B', 'fmt-b'],
    ['Курсив', 'italic', 'I', 'fmt-i'],
    ['Подчёркнутый', 'underline', 'U', 'fmt-u'],
    ['Зачёркнутый', 'strike', 'S', 'fmt-s'],
    ['ЗАГЛАВНЫЕ', 'caps', 'AA', 'fmt-c']
  ].forEach((d) => {
    const b = ovlEl('button', 'viz-fmt ' + d[3] + (l[d[1]] ? ' on' : ''), d[2]);
    b.type = 'button';
    b.title = d[0];
    b.setAttribute('aria-label', d[0]);
    b.setAttribute('aria-pressed', l[d[1]] ? 'true' : 'false');
    b.addEventListener('click', () => {
      l[d[1]] = !l[d[1]];
      b.classList.toggle('on', !!l[d[1]]);
      b.setAttribute('aria-pressed', l[d[1]] ? 'true' : 'false');
      buzz();
      touch();
    });
    styleBar.append(b);
  });

  const fontBtn = ovlEl('button', 'viz-ovl-fontbtn');
  fontBtn.type = 'button';
  const fbName = ovlEl('span', 'viz-fb-name', l.fontLabel);
  fbName.style.fontFamily = l.font;
  const fbSample = ovlEl('span', 'viz-fb-sample', 'Аа Ғғ Ӣӣ');
  fbSample.style.fontFamily = l.font;
  const fbArrow = ovlEl('span', 'viz-fb-arrow', ovlFontsOpen ? '▴' : '▾');
  fontBtn.append(fbName, fbSample, fbArrow);

  const list = ovlEl('div', 'viz-ovl-fonts');
  list.hidden = !ovlFontsOpen;
  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'viz-ovl-search';
  search.placeholder = 'Поиск шрифта';
  search.value = ovlFontQuery;
  search.spellcheck = false;
  search.autocomplete = 'off';
  const items = ovlEl('div', 'viz-ovl-items');
  list.append(search, items);

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const f = en.target._font;
      if (!f) return;
      checkFont(f).then((cov) => ovlFontBadge(en.target, cov));
    });
  }, { root: list });

  function renderItems() {
    items.textContent = '';
    const q = ovlFontQuery.trim().toLowerCase();
    const favs = ovlFavs();
    const match = FONTS.filter((f) => !q || f.label.toLowerCase().indexOf(q) >= 0);

    function addRow(f) {
      const r = ovlEl('div', 'viz-ovl-row');
      const b = ovlEl('button', 'viz-ovl-font' + (f.family === l.font ? ' active' : ''));
      b.type = 'button';
      const nm = ovlEl('span', null, f.label);
      nm.style.fontFamily = f.family;
      b.append(nm);
      b._font = f;
      if (f.cov) ovlFontBadge(b, f.cov);
      b.addEventListener('click', () => {
        l.font = f.family;
        l.fontLabel = f.label;
        ovlFontsOpen = false;
        loadFont(f);
        touch();
        renderOvl();
        checkFont(f).then((c) => {
          if (!c.ru) setStatus('В шрифте «' + f.label + '» нет кириллицы: буквы будут другим шрифтом.');
          else if (!c.tj) setStatus('В шрифте «' + f.label + '» нет таджикских букв (ғ ӣ қ ӯ ҳ ҷ): они будут другим шрифтом.');
        });
      });
      const star = ovlEl('button', 'viz-ovl-star' + (favs.indexOf(f.label) >= 0 ? ' on' : ''), '★');
      star.type = 'button';
      star.setAttribute('aria-label', 'В избранное');
      star.addEventListener('click', () => {
        const cur = ovlFavs();
        const i = cur.indexOf(f.label);
        if (i >= 0) cur.splice(i, 1);
        else cur.push(f.label);
        ovlSaveFavs(cur);
        renderItems();
      });
      r.append(b, star);
      items.append(r);
      io.observe(b);
    }

    const favList = match.filter((f) => favs.indexOf(f.label) >= 0);
    if (favList.length) {
      items.append(ovlEl('div', 'viz-ovl-group', 'Избранное'));
      favList.forEach(addRow);
    }
    let group = '';
    match.forEach((f) => {
      if (f.group !== group) {
        group = f.group;
        items.append(ovlEl('div', 'viz-ovl-group', group));
      }
      addRow(f);
    });
    if (!match.length) items.append(ovlEl('div', 'viz-ovl-group', 'Ничего не найдено'));
  }

  search.addEventListener('input', () => {
    ovlFontQuery = search.value;
    renderItems();
  });

  fontBtn.addEventListener('click', () => {
    ovlFontsOpen = !ovlFontsOpen;
    list.hidden = !ovlFontsOpen;
    fbArrow.textContent = ovlFontsOpen ? '▴' : '▾';
    if (ovlFontsOpen) list.scrollIntoView({ block: 'nearest' });
  });

  renderItems();

  pane.append(
    styleBar,
    ovlEl('div', 'viz-hr'),
    ovlColorRow(l, 'color', 'Цвет текста'),
    ovlGradient(l),
    ovlCommon(l, 0.03, 0.4),
    ovlEl('div', 'viz-hr'),
    ovlPaneSize(l),
    ovlEl('div', 'viz-hr'),
    fontBtn,
    list
  );
  return pane;
}
function ovlHistBtns() {
  const wrap = ovlEl('div', 'viz-histbtns');
  [
    ['viz-undo', '↶', 'Отменить', undo, canUndo],
    ['viz-redo', '↷', 'Вернуть', redo, canRedo]
  ].forEach((d) => {
    const b = ovlEl('button', 'viz-mini ' + d[0], d[1]);
    b.type = 'button';
    b.title = d[2];
    b.setAttribute('aria-label', d[2]);
    b.disabled = !d[4]();
    b.addEventListener('click', () => {
      if (d[3]()) {
        buzz();
        renderOvl();
      }
    });
    wrap.append(b);
  });
  return wrap;
}

function ovlHistSync() {
  [ovlBox, ctxMenu].forEach((root) => {
    const u = root.querySelector('.viz-undo');
    const r = root.querySelector('.viz-redo');
    if (u) u.disabled = !canUndo();
    if (r) r.disabled = !canRedo();
  });
}
document.addEventListener('keydown', (e) => {
  if (!ovlOpen() || exporting) return;
  const tag = e.target && e.target.tagName;
  const type = e.target && e.target.type;
  if (tag === 'TEXTAREA' || (tag === 'INPUT' && type !== 'range' && type !== 'checkbox')) return;

  if (e.ctrlKey || e.metaKey) {
    if (e.code === 'KeyZ' && !e.shiftKey) {
      e.preventDefault();
      if (undo()) renderOvl();
    } else if (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey)) {
      e.preventDefault();
      if (redo()) renderOvl();
    } else if (e.code === 'KeyD') {
      const src = getSelected();
      if (!src) return;
      e.preventDefault();
      duplicateLayer(src.id);
      renderOvl();
    }
    return;
  }

  const l = getSelected();
  if (!l || l.locked) return;

  if ((e.key === 'Delete' || e.key === 'Backspace') && tag !== 'INPUT') {
    e.preventDefault();
    groupMembers(l).slice().forEach((m) => removeLayer(m.id));
    closeCtxMenu();
    ovlCollapsed = false;
    renderOvl();
    return;
  }

  if (tag === 'INPUT') return;
  const step = e.shiftKey ? 10 : 1;
  let dx = 0;
  let dy = 0;
  if (e.key === 'ArrowLeft') dx = -step;
  else if (e.key === 'ArrowRight') dx = step;
  else if (e.key === 'ArrowUp') dy = -step;
  else if (e.key === 'ArrowDown') dy = step;
  else return;
  e.preventDefault();
  const mv = groupMembers(l).filter((m) => !m.locked);
  const ddx = clamp(dx / canvas.width, -Math.min(...mv.map((m) => m.x)), 1 - Math.max(...mv.map((m) => m.x)));
  const ddy = clamp(dy / canvas.height, -Math.min(...mv.map((m) => m.y)), 1 - Math.max(...mv.map((m) => m.y)));
  mv.forEach((m) => {
    m.x += ddx;
    m.y += ddy;
  });
  touch();
});

function ovlOrderRow(l) {
  if (getLayers().length < 2) return null;
  const row = ovlEl('div', 'viz-seg');
  [['↑ Выше', 1], ['↓ Ниже', -1]].forEach((d) => {
    const b = ovlEl('button', 'viz-chip', d[0]);
    b.type = 'button';
    b.addEventListener('click', () => {
      moveLayer(l.id, d[1]);
      buzz();
    });
    row.append(b);
  });
  return row;
}

const OVL_ALIGN = [
  ['left', 'По левому краю', 'M4 6h16M4 10h10M4 14h16M4 18h10'],
  ['center', 'По центру', 'M4 6h16M7 10h10M4 14h16M7 18h10'],
  ['right', 'По правому краю', 'M4 6h16M10 10h10M4 14h16M10 18h10']
];

function ovlPaneSize(l) {
  const pane = ovlEl('div', 'viz-pane');
  pane.append(
    ovlSlider('Размер', 0.03, 0.4, 0.005, l.size, (v) => String(Math.round(v * 100)), (v) => {
      const sn = ovlGroupSnap(l);
      if (sn) ovlGroupScale(sn, v / l.size);
      else l.size = v;
      touch();
    }, 0.09),
    ovlSlider('Меж. букв', -0.1, 0.6, 0.01, l.letterSp || 0, pct, (v) => { l.letterSp = v; touch(); }, 0),
        ovlSlider('Меж. строк', 0.7, 2.2, 0.01, l.lineH == null ? 1.2 : l.lineH, pct, (v) => { l.lineH = v; touch(); }, 1.2),
        ovlRotRow(l),
    ovlEl('div', 'viz-hr')
  );
  const bar = ovlEl('div', 'viz-fmtbar');
  OVL_ALIGN.forEach((d) => {
    const b = ovlEl('button', 'viz-fmt' + ((l.align || 'center') === d[0] ? ' on' : ''));
    b.type = 'button';
    b.title = d[1];
    b.setAttribute('aria-label', d[1]);
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="' + d[2] + '"/></svg>';
    b.addEventListener('click', () => {
      l.align = d[0];
      bar.querySelectorAll('.viz-fmt').forEach((x) => x.classList.toggle('on', x === b));
      buzz();
      touch();
    });
    bar.append(b);
  });
  pane.append(bar, ovlEl('p', 'viz-wave-hint', 'Выравнивание заметно у текста в несколько строк.'));
  const ord = ovlOrderRow(l);
  if (ord) pane.append(ovlEl('div', 'viz-hr'), ord);
  return pane;
}

const ANIM_MODES = [
  ['none', 'Нет'],
  ['pulse', 'Пульс'],
  ['shake', 'Тряска'],
  ['bounce', 'Прыжок'],
  ['glow', 'Свечение']
];

function ovlPaneAnim(l, compact) {
  const pane = ovlEl('div', 'viz-pane');
  const row = ovlEl('div', 'viz-seg');
  row.style.flexWrap = 'wrap';
  ANIM_MODES.forEach((d) => {
    const on = (l.anim || 'none') === d[0];
    const b = ovlEl('button', 'viz-chip' + (on ? ' active' : ''), d[1]);
    b.type = 'button';
    b.style.flex = '0 0 auto';
    b.style.padding = '4px 10px';
    b.addEventListener('click', () => {
      l.anim = d[0];
      buzz();
      touch();
      renderOvl();
    });
    row.append(b);
  });
  pane.append(row);
   if (l.anim && l.anim !== 'none') {
    pane.append(ovlSlider('Сила', 0.1, 1, 0.01, l.animPower == null ? 0.6 : l.animPower, pct, (v) => { l.animPower = v; touch(); }, 0.6));
  }
  if (!compact) pane.append(ovlEl('p', 'viz-wave-hint', 'Реагирует на бас трека. Видно при воспроизведении и в готовом видео.'));
  return pane;
}

function ovlGradient(l) {
  const box = ovlEl('div', 'viz-pane');
  const sw = ovlSwitch(l, 'gradient');
  box.append(ovlSwitchRow(sw, 'Градиент'));
  if (l.gradient) {
    box.append(
      ovlColorRow(l, 'gradColor2', 'Второй цвет', sw.enable),
      ovlSlider('Угол', 0, 360, 5, l.gradAngle == null ? 90 : l.gradAngle, deg, (v) => { l.gradAngle = v; sw.enable(); }, 90)
    );
  }
  return box;
}

let ovlFontQuery = '';

function ovlFavs() {
  try { return JSON.parse(localStorage.getItem('viz-fav-fonts') || '[]'); } catch (e) { return []; }
}

function ovlSaveFavs(list) {
  try { localStorage.setItem('viz-fav-fonts', JSON.stringify(list)); } catch (e) {}
}

function ovlFontBadge(btn, cov) {
  const old = btn.querySelector('.viz-ovl-badge');
  if (old) old.remove();
  const msg = !cov.ru ? 'нет кириллицы' : !cov.tj ? 'без тадж. букв' : '';
  if (msg) btn.append(ovlEl('span', 'viz-ovl-badge', msg));
}
function ovlFxReset(l, which) {
  const b = ovlEl('button', 'viz-mini', '↺ Сброс');
  b.type = 'button';
  b.title = 'Сбросить этот эффект';
  b.addEventListener('click', () => {
    buzz();
    resetEffect(l.id, which);
    ovlColorOpen = false;
    renderOvl();
  });
  return b;
}
let ovlFxTab = 'outline';

function ovlPaneFx(l) {
  const subs = [
    ['outline', 'Контур', l.outline],
    ['shadow', 'Тень', l.shadow || l.shadow2 || l.inner],
    ['long', 'Длинная', l.long],
    ['plate', 'Плашка', l.plate],
    ['curve', 'Дуга', !!l.curve]
  ];
  const pane = ovlEl('div', 'viz-pane');
  const bar = ovlEl('div', 'viz-seg');
  bar.style.overflowX = 'auto';
  bar.style.alignItems = 'center';
     bar.style.gap = '14px';
  subs.forEach((s) => {
    const b = ovlEl('button', 'viz-sub' + (ovlFxTab === s[0] ? ' active' : ''), s[1]);
    b.type = 'button';
    b.style.padding = '4px 2px 3px';
    if (s[2]) b.append(ovlEl('i', 'viz-dot'));
    b.addEventListener('click', () => {
      ovlFxTab = s[0];
      ovlColorOpen = false;
      renderOvl();
    });
    bar.append(b);
  });
  const head = ovlEl('div', 'viz-ovl-head');
  head.style.alignItems = 'center';
  bar.style.flex = '1';
  bar.style.minWidth = '0';
  head.append(bar);
    if (ovlFxTab !== 'shadow') head.append(ovlFxReset(l, ovlFxTab));
  pane.append(head);
  if (ovlFxTab === 'shadow') pane.append(ovlPaneShadow(l));
  else if (ovlFxTab === 'long') pane.append(ovlPaneLong(l));
  else if (ovlFxTab === 'plate') pane.append(ovlPanePlate(l));
  else if (ovlFxTab === 'curve') pane.append(ovlPaneCurve(l));
  else pane.append(ovlPaneEffect(l, 'outline'));
  return pane;
}
function ovlRotRow(l) {
  return ovlSlider('Поворот', -180, 180, 1, l.rot || 0, deg, (v) => { l.rot = v; touch(); }, 0);
}

function ovlPanePlate(l) {
  if (!l.plateColor) l.plateColor = '#000000';
  if (!l.plateColor2) l.plateColor2 = '#7c3aed';
  if (!l.plateBorderColor) l.plateBorderColor = '#ffffff';
  if (!l.plateShadowColor) l.plateShadowColor = '#000000';

  const main = ovlSwitch(l, 'plate');
  const swEach = ovlSwitch(l, 'plateEach');
  const swGrad = ovlSwitch(l, 'plateGrad');
  const swBorder = ovlSwitch(l, 'plateBorder');
  const swShadow = ovlSwitch(l, 'plateShadow');
  const swGlass = ovlSwitch(l, 'plateGlass');
  const en = (sw) => () => { main.enable(); sw.enable(); };

  const pane = ovlEl('div', 'viz-pane');

  const rowS = ovlEl('div', 'viz-seg');
  [['rect', 'Блок'], ['pill', 'Таблетка'], ['cut', 'Срез']].forEach((d) => {
    const b = ovlEl('button', 'viz-chip' + ((l.plateShape || 'rect') === d[0] ? ' active' : ''), d[1]);
    b.type = 'button';
    b.addEventListener('click', () => {
      l.plateShape = d[0];
      main.enable();
      buzz();
      renderOvl();
    });
    rowS.append(b);
  });

  pane.append(
    ovlSwitchRow(main, 'Плашка'),
    ovlColorRow(l, 'plateColor', 'Цвет плашки', main.enable),
       ovlSlider('Прозрачность', 0, 1, 0.01, l.plateAlpha == null ? 0.7 : l.plateAlpha, pct, (v) => { l.plateAlpha = v; main.enable(); }, 0.7),
    rowS,
      ovlSlider('Углы', 0, 1, 0.01, l.plateRadius == null ? 0.3 : l.plateRadius, pct, (v) => { l.plateRadius = v; main.enable(); }, 0.3),
      ovlSlider('Отступ ↔', 0, 1.5, 0.01, l.platePadX == null ? 0.25 : l.platePadX, pct, (v) => { l.platePadX = v; main.enable(); }, 0.25),
       ovlSlider('Отступ ↕', 0, 1.5, 0.01, l.platePadY == null ? 0.25 : l.platePadY, pct, (v) => { l.platePadY = v; main.enable(); }, 0.25),
       ovlSlider('Сдвиг ↔', -1, 1, 0.01, l.plateX || 0, pct, (v) => { l.plateX = v; main.enable(); }, 0),
      ovlSlider('Сдвиг ↕', -1, 1, 0.01, l.plateY || 0, pct, (v) => { l.plateY = v; main.enable(); }, 0),
      ovlSlider('Наклон', -45, 45, 1, l.plateSkew || 0, deg, (v) => { l.plateSkew = v; main.enable(); }, 0),
    ovlSwitchRow(swEach, 'Каждая строка отдельно'),
    ovlEl('div', 'viz-hr'),
    ovlSwitchRow(swGrad, 'Градиент')
  );
  if (l.plateGrad) {
    pane.append(
      ovlColorRow(l, 'plateColor2', 'Второй цвет', en(swGrad)),
            ovlSlider('Угол', 0, 360, 5, l.plateGradAngle == null ? 90 : l.plateGradAngle, deg, (v) => { l.plateGradAngle = v; en(swGrad)(); }, 90)
    );
  }

  pane.append(ovlEl('div', 'viz-hr'), ovlSwitchRow(swBorder, 'Рамка'));
  if (l.plateBorder) {
    pane.append(
      ovlColorRow(l, 'plateBorderColor', 'Цвет рамки', en(swBorder)),
        ovlSlider('Толщина', 0.01, 0.2, 0.005, l.plateBorderW == null ? 0.05 : l.plateBorderW, pct, (v) => { l.plateBorderW = v; en(swBorder)(); }, 0.05)
    );
  }

  pane.append(ovlEl('div', 'viz-hr'), ovlSwitchRow(swShadow, 'Тень'));
  if (l.plateShadow) {
    pane.append(
      ovlColorRow(l, 'plateShadowColor', 'Цвет тени', en(swShadow)),
         ovlSlider('Сила', 0, 1, 0.01, l.plateShadowAlpha == null ? 0.6 : l.plateShadowAlpha, pct, (v) => { l.plateShadowAlpha = v; en(swShadow)(); }, 0.6),
      ovlSlider('Размытие', 0, 1, 0.01, l.plateShadowBlur == null ? 0.3 : l.plateShadowBlur, pct, (v) => { l.plateShadowBlur = v; en(swShadow)(); }, 0.3),
       ovlSlider('Дистанция', 0, 0.6, 0.01, l.plateShadowDist == null ? 0.12 : l.plateShadowDist, pct, (v) => { l.plateShadowDist = v; en(swShadow)(); }, 0.12)
    );
  }

  pane.append(ovlEl('div', 'viz-hr'), ovlSwitchRow(swGlass, 'Стекло'));
  if (l.plateGlass) {
    pane.append(
         ovlSlider('Размытие', 0, 1, 0.01, l.plateGlassBlur == null ? 0.5 : l.plateGlassBlur, pct, (v) => { l.plateGlassBlur = v; en(swGlass)(); }, 0.5),
      ovlEl('p', 'viz-wave-hint', 'Размывает всё под плашкой. Чтобы эффект был виден, уменьшите «Прозрачность» плашки.')
    );
  }
  return pane;
}
function ovlPaneD3(l) {
  if (!l.extColor) l.extColor = '#7c3aed';
  const pane = ovlEl('div', 'viz-pane');

  const swE = ovlSwitch(l, 'ext');
  const rowE = ovlSwitchRow(swE, 'Объём');
  rowE.append(ovlFxReset(l, 'ext'));
  pane.append(
    rowE,
    ovlColorRow(l, 'extColor', 'Цвет боковой стенки', swE.enable),
       ovlSlider('Глубина', 0.02, 0.8, 0.01, l.extDepth == null ? 0.25 : l.extDepth, pct, (v) => { l.extDepth = v; swE.enable(); }, 0.25),
    ovlSlider('Угол', 0, 360, 5, l.extAngle == null ? 45 : l.extAngle, deg, (v) => { l.extAngle = v; swE.enable(); }, 45),
    ovlEl('div', 'viz-hr')
  );

  const swB = ovlSwitch(l, 'bevel');
  const rowB = ovlSwitchRow(swB, 'Выпуклость');
  rowB.append(ovlFxReset(l, 'bevel'));
  pane.append(
    rowB,
    ovlSlider('Размер', 0, 1, 0.01, l.bevelSize == null ? 0.5 : l.bevelSize, pct, (v) => { l.bevelSize = v; swB.enable(); }, 0.5),
      ovlSlider('Сила', 0.1, 1, 0.01, l.bevelAlpha == null ? 0.7 : l.bevelAlpha, pct, (v) => { l.bevelAlpha = v; swB.enable(); }, 0.7),
    ovlEl('div', 'viz-hr')
  );

  const swG = ovlSwitch(l, 'gloss');
  const rowG = ovlSwitchRow(swG, 'Глянец');
  rowG.append(ovlFxReset(l, 'gloss'));
  pane.append(
    rowG,
       ovlSlider('Высота блика', 0.1, 1, 0.01, l.glossSize == null ? 0.5 : l.glossSize, pct, (v) => { l.glossSize = v; swG.enable(); }, 0.5),
      ovlSlider('Яркость', 0.1, 1, 0.01, l.glossAlpha == null ? 0.6 : l.glossAlpha, pct, (v) => { l.glossAlpha = v; swG.enable(); }, 0.6),
    ovlEl('p', 'viz-wave-hint', 'Лучше всего работает на крупном тексте. Объём + выпуклость + глянец вместе дают «надутый» 3D. На дуге эти эффекты не рисуются.')
  );
  return pane;
}
function ovlPaneCurve(l) {
  const pane = ovlEl('div', 'viz-pane');
  pane.append(
    ovlSlider('Дуга', -1, 1, 0.01, l.curve || 0, pct, (v) => { l.curve = v; touch(); }, 0),
    ovlEl('p', 'viz-wave-hint', 'Плюс — арка вверх, минус — «улыбка». На дуге не рисуются подчёркивание, зачёркивание и внутренняя тень.')
  );
  return pane;
}
function renderOvl() {
  const st = ovlBox.scrollTop;
  ovlBox.textContent = '';
  const open = ovlOpen();
  frameEl.classList.toggle('ovl-edit', open);
  ovlBox.hidden = !open;
    const selLayer = getSelected();
  ovlBox.classList.toggle('viz-ovl-fixed', open && openTab === 'text' && !!selLayer && selLayer.type === 'text');
  ovlBox.classList.toggle('viz-ovl-mini', open && ovlCollapsed);
  if (open && ovlCollapsed) {
    const expand = ovlEl('button', 'viz-btn', '▲ Настройки');
    expand.type = 'button';
    expand.addEventListener('click', () => {
      ovlCollapsed = false;
      renderOvl();
    });
    if (!buffer) {
      const addTrack = ovlEl('label', 'viz-btn', '♪ + Трек');
      addTrack.htmlFor = 'audioFile';
      ovlBox.append(addTrack);
    }
    ovlBox.append(expand);
  } else if (open) {
    const fold = ovlEl('button', 'viz-mini viz-ovl-fold', '▼ Свернуть');
    fold.type = 'button';
    fold.title = 'Свернуть панель, чтобы двигать текст по кадру';
    fold.addEventListener('click', () => {
      ovlCollapsed = true;
      renderOvl();
    });
    ovlBox.append(fold);
    if (openTab === 'text') ovlRenderText(ovlBox);
    else ovlRenderLayersTab(ovlBox);
    ovlBox.scrollTop = st;
  }
  ovlSyncSel();
}
function ovlSelect(id) {
  select(id);
  const l = getSelected();
  if (l && openTab !== 'layers') {
    const want = l.type === 'text' ? 'text' : 'layers';
    if (openTab !== want) {
      ovlCollapsed = true;
      showTab(want);
      return;
    }
  }
  renderOvl();
}

function ovlPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * canvas.width / Math.max(1, r.width),
    y: (e.clientY - r.top) * canvas.height / Math.max(1, r.height)
  };
}

let lpTimer = 0;

function lpCancel() {
  if (lpTimer) clearTimeout(lpTimer);
  lpTimer = 0;
}

frameEl.addEventListener('pointerdown', (e) => {
  if (exporting || wavePanelOpen) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.target.closest('.viz-hud, button, input, textarea, label')) return;
    ovlPtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { frameEl.setPointerCapture(e.pointerId); } catch (err) {}
  if (ovlPtrs.size === 2) {
    const target = getSelected();
    if (target && !target.locked && ovlOpen()) {
      const pts = [...ovlPtrs.values()];
      ovlGesture = {
        id: target.id,
        dist: Math.max(8, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)),
        ang: Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x),
        size: target.size,
        rot: target.rot || 0,
        group: ovlGroupSnap(target)
      };
      ovlDrag = null;
      lpCancel();
      e.preventDefault();
      return;
    }
  }
  const p = ovlPoint(e);
  const hit = hitTest(ctx, p.x, p.y);
  if (!hit) {
    closeCtxMenu();
    if (ovlOpen()) ovlSelect(null);
    return;
  }
  ovlSelect(hit.id);
  if (!ctxMenu.hidden && ctxId !== hit.id) {
    if (hit.type === 'image') openCtxMenu(hit, 0, 0, true);
    else closeCtxMenu();
  }
    if (hit.locked) {
    e.preventDefault();
    return;
  }
  const gm = groupMembers(hit).filter((m) => !m.locked);
  let gox = 0;
  let goy = 0;
  if (gm.length > 1) {
    const gb = groupBounds(ctx, hit);
    gox = gb.x + gb.w / 2 - hit.x * canvas.width;
    goy = gb.y + gb.h / 2 - hit.y * canvas.height;
  }
  ovlDrag = {
    id: hit.id,
    pid: e.pointerId,
    dx: p.x - hit.x * canvas.width,
    dy: p.y - hit.y * canvas.height,
    sx: e.clientX,
    sy: e.clientY,
    moved: false,
    gm: gm.length > 1 ? gm.map((m) => ({ l: m, x: m.x, y: m.y })) : null,
    hx: hit.x,
    hy: hit.y,
    gox: gox,
    goy: goy,
    minX: Math.min(...gm.map((m) => m.x)),
    maxX: Math.max(...gm.map((m) => m.x)),
    minY: Math.min(...gm.map((m) => m.y)),
    maxY: Math.max(...gm.map((m) => m.y)),
    snapped: false
  };
  try { frameEl.setPointerCapture(e.pointerId); } catch (err) {}
  lpCancel();
  if (e.pointerType !== 'mouse' && hit.type === 'image') {
    const px = e.clientX;
    const py = e.clientY;
    lpTimer = setTimeout(() => {
      lpTimer = 0;
      if (!ovlDrag || ovlDrag.id !== hit.id || ovlDrag.moved) return;
      if (!ctxMenu.hidden && ctxId === hit.id) return;
      ovlDrag = null;
      openCtxMenu(hit, px, py);
    }, 550);
  }
  e.preventDefault();
});

frameEl.addEventListener('pointermove', (e) => {
  if (!ovlDrag || e.pointerId !== ovlDrag.pid) return;
  const l = getLayer(ovlDrag.id);
  if (!l) return;
  if (!ovlDrag.moved && Math.hypot(e.clientX - ovlDrag.sx, e.clientY - ovlDrag.sy) > 6) {
    ovlDrag.moved = true;
    lpCancel();
  }
  const p = ovlPoint(e);
  if (ovlDrag.gm) {
    const W = canvas.width;
    const H = canvas.height;
    let tx = (p.x - ovlDrag.dx) / W;
    let ty = (p.y - ovlDrag.dy) / H;
    const gx = tx + ovlDrag.gox / W;
    const gy = ty + ovlDrag.goy / H;
    const sX = Math.abs(gx - 0.5) < 0.02;
    const sY = Math.abs(gy - 0.5) < 0.02;
    if (sX) tx += 0.5 - gx;
    if (sY) ty += 0.5 - gy;
    if ((sX || sY) && !ovlDrag.snapped) buzz();
    ovlDrag.snapped = sX || sY;
    const ddx = clamp(tx - ovlDrag.hx, -ovlDrag.minX, 1 - ovlDrag.maxX);
    const ddy = clamp(ty - ovlDrag.hy, -ovlDrag.minY, 1 - ovlDrag.maxY);
    ovlDrag.gm.forEach((m) => {
      m.l.x = m.x + ddx;
      m.l.y = m.y + ddy;
    });
    guideV.hidden = !sX;
    guideH.hidden = !sY;
    touch();
    return;
  }
  let nx = clamp((p.x - ovlDrag.dx) / canvas.width, 0, 1);
  let ny = clamp((p.y - ovlDrag.dy) / canvas.height, 0, 1);
  const snapX = Math.abs(nx - 0.5) < 0.02;
  const snapY = Math.abs(ny - 0.5) < 0.02;
  if ((snapX && l.x !== 0.5) || (snapY && l.y !== 0.5)) buzz();
  if (snapX) nx = 0.5;
  if (snapY) ny = 0.5;
  l.x = nx;
  l.y = ny;
  guideV.hidden = !snapX;
  guideH.hidden = !snapY;
  touch();
});

function ovlEnd(e) {
  lpCancel();
  if (ovlDrag && e.pointerId === ovlDrag.pid) ovlDrag = null;
  guideV.hidden = true;
  guideH.hidden = true;
  const wasGesture = !!ovlGesture;
  ovlPtrs.delete(e.pointerId);
  if (ovlPtrs.size < 2) ovlGesture = null;
  if (wasGesture && !ovlGesture) renderOvl();
}
frameEl.addEventListener('pointerup', ovlEnd);
frameEl.addEventListener('pointercancel', ovlEnd);

frameEl.addEventListener('pointermove', (e) => {
  if (!ovlPtrs.has(e.pointerId)) return;
  ovlPtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!ovlGesture || ovlPtrs.size < 2) return;
  const l = getLayer(ovlGesture.id);
  if (!l) return;
  const pts = [...ovlPtrs.values()];
  const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  const a = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
  if (ovlGesture.group) {
    ovlGroupScale(ovlGesture.group, d / ovlGesture.dist);
    touch();
    return;
  }
  const min = l.type === 'text' ? 0.03 : 0.05;
  const max = l.type === 'text' ? 0.4 : 1;
  l.size = clamp(ovlGesture.size * (d / ovlGesture.dist), min, max);
  let r = ovlGesture.rot + ((a - ovlGesture.ang) * 180) / Math.PI;
  r = ((r + 540) % 360) - 180;
  l.rot = Math.round(r);
  touch();
});
// ---------- меню стикера (правая кнопка мыши / долгое нажатие) ----------

const ctxMenu = document.createElement('div');
ctxMenu.className = 'viz-ctx';
ctxMenu.hidden = true;
document.body.append(ctxMenu);
let ctxId = null;
let ctxPos = { x: 0, y: 0 };

const IMG_DEFAULTS = {
  bright: 1, contrast: 1, sat: 1, hue: 0, gray: 0, sepia: 0, invert: 0, blur: 0,
  tint: 0, tintColor: '#ff2d55',
  shOn: false, shColor: '#000000', shAlpha: 0.6, shBlur: 0.02, shAngle: 90, shDist: 0.02,
  glowOn: false, glowColor: '#ffffff', glowSize: 0.03,
  outlineOn: false, outlineColor: '#ffffff', outlineW: 0.01,
  round: 0, blend: 'source-over',
    opacity: 1, rot: 0, flipX: false, flipY: false, anim: 'none',
  tiltX: 0, tiltY: 0, persp: 1,
  cropL: 0, cropR: 0, cropT: 0, cropB: 0, shape: 'none',
  inAnim: 'none', inDur: 0.6, loop: 'none', loopSpeed: 1
};

let ctxTab = 'color';
let ctxDrag = null;

const CTX_KEYS = {
  color: ['bright', 'contrast', 'sat', 'hue', 'gray', 'sepia', 'invert', 'tint', 'tintColor'],
  fx: ['shOn', 'shColor', 'shAlpha', 'shBlur', 'shAngle', 'shDist', 'glowOn', 'glowColor', 'glowSize', 'outlineOn', 'outlineColor', 'outlineW', 'blur'],
   view: ['round', 'blend', 'opacity', 'rot', 'flipX', 'flipY', 'cropL', 'cropR', 'cropT', 'cropB', 'shape']
};

function ctxResetBtn(l, tab) {
  const b = ovlEl('button', 'viz-mini', '↺ Сброс вкладки');
  b.type = 'button';
  b.addEventListener('click', () => {
    buzz();
    CTX_KEYS[tab].forEach((k) => { l[k] = IMG_DEFAULTS[k]; });
    touch();
    openCtxMenu(l, 0, 0, true);
  });
  return b;
}
function closeCtxMenu() {
  ctxMenu.hidden = true;
  ctxMenu.textContent = '';
  ctxId = null;
}
function ctxHistBtns() {
  const wrap = ovlEl('div', 'viz-histbtns');
  [
    ['viz-undo', '↶', 'Отменить', undo, canUndo],
    ['viz-redo', '↷', 'Вернуть', redo, canRedo]
  ].forEach((d) => {
    const b = ovlEl('button', 'viz-mini ' + d[0], d[1]);
    b.type = 'button';
    b.title = d[2];
    b.setAttribute('aria-label', d[2]);
    b.disabled = !d[4]();
    b.addEventListener('click', () => {
      if (!d[3]()) return;
      buzz();
      renderOvl();
      const s = getSelected();
      if (s && s.type === 'image') openCtxMenu(s, 0, 0, true);
      else closeCtxMenu();
    });
    wrap.append(b);
  });
  return wrap;
}
function ctxChoice(l, key, items, def) {
  const row = ovlEl('div', 'viz-seg viz-seg-wrap');
  const paint = () => {
    const cur = l[key] || def;
    row.querySelectorAll('.viz-chip').forEach((x, i) => x.classList.toggle('active', items[i][1] === cur));
  };
  items.forEach((d) => {
    const b = ovlEl('button', 'viz-chip' + ((l[key] || def) === d[1] ? ' active' : ''), d[0]);
    b.type = 'button';
    b.addEventListener('click', () => {
      // повторное нажатие на выбранный вариант возвращает «по умолчанию»
      const same = (l[key] || def) === d[1];
      l[key] = same && d[1] !== def ? def : d[1];
      paint();
      buzz();
      touch();
    });
    row.append(b);
  });
  return row;
}
function ctxBtn(label, cls, onClick) {
  const b = ovlEl('button', 'viz-chip' + (cls ? ' ' + cls : ''), label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

const CTX_BLENDS = [
  ['Обычный', 'source-over'],
  ['Умножение', 'multiply'],
  ['Экран', 'screen'],
  ['Перекрытие', 'overlay'],
  ['Светлее', 'lighten'],
  ['Темнее', 'darken'],
  ['Разница', 'difference'],
  ['Осветление', 'color-dodge']
];

function ctxColor(l, prop, label, onChange, def) {
  const cur = /^#[0-9a-f]{6}$/i.test(l[prop] || '') ? l[prop] : def;
  const row = ovlEl('div', 'viz-ctx-color');
  const quick = ovlEl('div', 'viz-quick');

  const swatch = ovlEl('button', 'viz-cbtn');
  swatch.type = 'button';
  swatch.setAttribute('aria-label', label);
  swatch.style.background = cur;

  const pick = ovlEl('div', 'viz-cpick');
  pick.hidden = true;
  const sv = ovlEl('div', 'viz-cpick-sv');
  const svDot = document.createElement('i');
  sv.append(svDot);
  const hueBar = ovlEl('div', 'viz-cpick-hue');
  const hueDot = document.createElement('i');
  hueBar.append(hueDot);
  const prow = ovlEl('div', 'viz-cpick-row');
  const prev = ovlEl('span', 'viz-cpick-prev');
  const hexIn = document.createElement('input');
  hexIn.type = 'text';
  hexIn.maxLength = 7;
  hexIn.spellcheck = false;
  hexIn.autocomplete = 'off';
  hexIn.setAttribute('aria-label', 'Код цвета');
  const ok = ovlEl('button', 'viz-btn viz-btn-primary', 'Готово');
  ok.type = 'button';
  prow.append(prev, hexIn, ok);
  pick.append(sv, hueBar, prow);

  const start = hexToHsv(cur) || { h: 0, s: 0, v: 1 };
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
    l[prop] = hex;
    swatch.style.background = hex;
    onChange();
    paintReset();
  }

  cpDrag(sv, (x, y) => {
    s = x;
    v = 1 - y;
    apply(false);
  });

  cpDrag(hueBar, (x) => {
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

  OVL_QUICK.forEach((hex) => {
    const b = ovlEl('button', 'viz-qsw');
    b.type = 'button';
    b.style.background = hex;
    b.setAttribute('aria-label', hex);
    b.addEventListener('click', () => {
      const hsv = hexToHsv(hex);
      if (!hsv) return;
      h = hsv.h;
      s = hsv.s;
      v = hsv.v;
      apply(false);
      buzz();
    });
    quick.append(b);
  });

  quick.append(ovlEl('span', 'viz-qsep'));
  quick.append(swatch);

  const resetBtn = ovlEl('button', 'viz-qreset', '↺');
  resetBtn.type = 'button';
  resetBtn.title = 'Вернуть цвет по умолчанию';
  resetBtn.setAttribute('aria-label', 'Вернуть цвет по умолчанию');
  const paintReset = () => {
    const now = String(l[prop] || def).toLowerCase();
    resetBtn.style.display = now === String(def).toLowerCase() ? 'none' : '';
  };
  resetBtn.addEventListener('click', () => {
    const hsv = hexToHsv(def);
    if (!hsv) return;
    h = hsv.h;
    s = hsv.s;
    v = hsv.v;
    apply(false);
    buzz();
  });
  quick.append(resetBtn);
  paintReset();
  swatch.addEventListener('click', () => {
    pick.hidden = !pick.hidden;
    if (!pick.hidden) {
      render(false);
      if (pick.scrollIntoView) pick.scrollIntoView({ block: 'nearest' });
    }
  });

  ok.addEventListener('click', () => {
    pick.hidden = true;
  });

  render(false);
  row.append(ovlEl('span', null, label), quick, pick);
  return row;
}
function ctxSwitch(l, flag, text) {
  const row = ovlEl('div', 'viz-set-inline');
  const tg = ovlEl('button', 'viz-switch');
  tg.type = 'button';
  tg.setAttribute('role', 'switch');
  tg.append(document.createElement('span'));
  const paint = () => tg.setAttribute('aria-checked', l[flag] ? 'true' : 'false');
  paint();
  tg.addEventListener('click', () => {
    l[flag] = !l[flag];
    paint();
    buzz();
    touch();
  });
  row.append(ovlEl('span', 'viz-set-label', text), tg);
  return {
    row: row,
    on() {
      if (!l[flag]) {
        l[flag] = true;
        paint();
      }
      touch();
    }
  };
}

function ctxMove(l, mode) {
  const arr = getLayers();
  const i = arr.indexOf(l);
  if (i < 0) return;
  let j = i;
  if (mode === 'up') j = i + 1;
  else if (mode === 'down') j = i - 1;
  else if (mode === 'front') j = arr.length - 1;
  else if (mode === 'back') j = 0;
  if (j < 0 || j >= arr.length || j === i) return;
  arr.splice(i, 1);
  arr.splice(j, 0, l);
  touch();
}

function openCtxMenu(l, cx, cy, keep) {
  ctxId = l.id;
  ctxMenu.textContent = '';

  const head = ovlEl('div', 'viz-ctx-head');
  const close = ovlEl('button', 'viz-ctx-close', '✕');
  close.type = 'button';
  close.setAttribute('aria-label', 'Закрыть');
  close.addEventListener('click', closeCtxMenu);
  head.append(ovlEl('span', 'viz-ctx-title', '⠿ Стикер'), ctxHistBtns(), close);

  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.viz-ctx-close')) return;
    const r = ctxMenu.getBoundingClientRect();
    ctxDrag = { pid: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
    try { head.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  head.addEventListener('pointermove', (e) => {
    if (!ctxDrag || e.pointerId !== ctxDrag.pid) return;
    const w0 = ctxMenu.offsetWidth;
    const h0 = ctxMenu.offsetHeight;
    ctxMenu.style.left = clamp(e.clientX - ctxDrag.dx, 4, Math.max(4, window.innerWidth - w0 - 4)) + 'px';
    ctxMenu.style.top = clamp(e.clientY - ctxDrag.dy, 4, Math.max(4, window.innerHeight - h0 - 4)) + 'px';
  });
  const headEnd = (e) => {
    if (ctxDrag && e.pointerId === ctxDrag.pid) ctxDrag = null;
  };
  head.addEventListener('pointerup', headEnd);
  head.addEventListener('pointercancel', headEnd);

  const defs = {};
  const val = (k, d) => { defs[k] = d; return l[k] == null ? d : l[k]; };
  const set = (k) => {
    const f = (v) => { l[k] = v; touch(); };
    f.def = defs[k];
    return f;
  };
  const hr = () => ovlEl('div', 'viz-hr');

  const panes = {};
  const mk = (id) => {
    const p = ovlEl('div', 'viz-ctx-pane');
    p.hidden = ctxTab !== id;
    panes[id] = p;
    return p;
  };
  const pc = mk('color');
  const pf = mk('fx');
  const pv = mk('view');
  const pl = mk('layers');
  const body = ovlEl('div', 'viz-ctx-body');
  body.append(pc, pf, pv, pl);

  const tabs = ovlEl('div', 'viz-ctx-tabs');
  [['color', 'Цвет'], ['fx', 'Эффекты'], ['view', 'Вид'], ['layers', window.matchMedia('(min-width: 1024px)').matches ? 'Анимация' : 'Слои']].forEach((t) => {
    const b = ovlEl('button', 'viz-chip' + (ctxTab === t[0] ? ' active' : ''), t[1]);
    b.type = 'button';
    b.addEventListener('click', () => {
      ctxTab = t[0];
      tabs.querySelectorAll('.viz-chip').forEach((x) => x.classList.toggle('active', x === b));
      Object.keys(panes).forEach((k) => { panes[k].hidden = k !== t[0]; });
      body.scrollTop = 0;
    });
    tabs.append(b);
  });

  // ----- вкладка «Цвет» -----
  const tintSl = ovlSlider('Сила оверлея', 0, 1, 0.01, val('tint', 0), pct, set('tint'));
  const tintInp = tintSl.querySelector('input');
  const tintOut = tintSl.querySelector('output');
  pc.append(
    ovlSlider('Яркость', 0, 2, 0.01, val('bright', 1), pct, set('bright')),
    ovlSlider('Контраст', 0, 2, 0.01, val('contrast', 1), pct, set('contrast')),
    ovlSlider('Насыщенность', 0, 2, 0.01, val('sat', 1), pct, set('sat')),
    ovlSlider('Оттенок', -180, 180, 1, val('hue', 0), deg, set('hue')),
    ovlSlider('Чёрно-белое', 0, 1, 0.01, val('gray', 0), pct, set('gray')),
    ovlSlider('Сепия', 0, 1, 0.01, val('sepia', 0), pct, set('sepia')),
    ovlSlider('Негатив', 0, 1, 0.01, val('invert', 0), pct, set('invert')),
    hr(),
    ovlEl('p', 'viz-ovl-title', 'Цветной оверлей'),
    ctxColor(l, 'tintColor', 'Цвет', () => {
      if (!l.tint) {
        l.tint = 0.5;
        tintInp.value = '0.5';
        fillRange(tintInp);
        tintOut.textContent = pct(0.5);
      }
      touch();
    }, '#ff2d55'),
    tintSl
  );

  // ----- вкладка «Эффекты» -----
  const sh = ctxSwitch(l, 'shOn', 'Тень');
  const gl = ctxSwitch(l, 'glowOn', 'Свечение');
  const ou = ctxSwitch(l, 'outlineOn', 'Обводка');
  pf.append(
    sh.row,
    ctxColor(l, 'shColor', 'Цвет тени', sh.on, '#000000'),
       ovlSlider('Сила', 0, 1, 0.01, val('shAlpha', 0.6), pct, (v) => { l.shAlpha = v; sh.on(); }, 0.6),
       ovlSlider('Размытие', 0, 0.12, 0.002, val('shBlur', 0.02), pct, (v) => { l.shBlur = v; sh.on(); }, 0.02),
      ovlSlider('Угол', 0, 360, 1, val('shAngle', 90), deg, (v) => { l.shAngle = v; sh.on(); }, 90),
       ovlSlider('Дистанция', 0, 0.15, 0.002, val('shDist', 0.02), pct, (v) => { l.shDist = v; sh.on(); }, 0.02),
    hr(),
    gl.row,
    ctxColor(l, 'glowColor', 'Цвет свечения', gl.on, '#ffffff'),
       ovlSlider('Размер', 0.005, 0.1, 0.001, val('glowSize', 0.03), pct, (v) => { l.glowSize = v; gl.on(); }, 0.03),
    hr(),
    ou.row,
    ctxColor(l, 'outlineColor', 'Цвет обводки', ou.on, '#ffffff'),
       ovlSlider('Толщина', 0.002, 0.04, 0.001, val('outlineW', 0.01), pct, (v) => { l.outlineW = v; ou.on(); }, 0.01),
    hr(),
    ovlSlider('Размытие', 0, 1, 0.01, val('blur', 0), pct, set('blur'))
  );

  // ----- вкладка «Вид» -----
  const blendRow = ovlEl('div', 'viz-seg viz-seg-blend');
  CTX_BLENDS.forEach((d) => {
    const b = ovlEl('button', 'viz-chip' + ((l.blend || 'source-over') === d[1] ? ' active' : ''), d[0]);
    b.type = 'button';
    b.addEventListener('click', () => {
      l.blend = d[1];
      blendRow.querySelectorAll('.viz-chip').forEach((x) => x.classList.toggle('active', x === b));
      buzz();
      touch();
    });
    blendRow.append(b);
  });

  const rowFlip = ovlEl('div', 'viz-seg');
  const fx = ctxBtn('↔ Отразить', l.flipX ? 'active' : '', () => {
    l.flipX = !l.flipX;
    fx.classList.toggle('active', !!l.flipX);
    touch();
  });
  const fy = ctxBtn('↕ Отразить', l.flipY ? 'active' : '', () => {
    l.flipY = !l.flipY;
    fy.classList.toggle('active', !!l.flipY);
    touch();
  });
  rowFlip.append(fx, fy);

  const xSl = ovlSlider('Позиция X', 0, 1, 0.005, val('x', 0.5), pct, set('x'));
  const ySl = ovlSlider('Позиция Y', 0, 1, 0.005, val('y', 0.5), pct, set('y'));

  const syncXY = () => {
    [[xSl, 'x'], [ySl, 'y']].forEach((d) => {
      const inp = d[0].querySelector('input');
      inp.value = String(l[d[1]]);
      fillRange(inp);
      d[0].querySelector('output').textContent = pct(l[d[1]]);
    });
  };

  const alignTo = (mode) => {
    const b = layerBounds(ctx, l);
    const hw = b.w / 2 / canvas.width;
    const hh = b.h / 2 / canvas.height;
    if (mode === 'cx') l.x = 0.5;
    else if (mode === 'cy') l.y = 0.5;
    else if (mode === 'left') l.x = clamp(hw, 0, 1);
    else if (mode === 'right') l.x = clamp(1 - hw, 0, 1);
    else if (mode === 'top') l.y = clamp(hh, 0, 1);
    else if (mode === 'bottom') l.y = clamp(1 - hh, 0, 1);
    buzz();
    syncXY();
    touch();
  };
  const tSlX = ovlSlider('Наклон ↕', -75, 75, 1, val('tiltX', 0), deg, set('tiltX'));
  const tSlY = ovlSlider('Поворот ↔', -75, 75, 1, val('tiltY', 0), deg, set('tiltY'));
  const tSlP = ovlSlider('Перспектива', 0.3, 2, 0.01, val('persp', 1), pct, set('persp'));

  const syncTilt = () => {
    [[tSlX, 'tiltX', 0, deg], [tSlY, 'tiltY', 0, deg], [tSlP, 'persp', 1, pct]].forEach((d) => {
      const inp = d[0].querySelector('input');
      const cur = val(d[1], d[2]);
      inp.value = String(cur);
      fillRange(inp);
      d[0].querySelector('output').textContent = d[3](cur);
    });
  };

   const tiltRow = ovlEl('div', 'viz-seg viz-seg-tilt');
  [['Плоско', 0, 0], ['Пол', 55, 0], ['Потолок', -55, 0], ['Стена ←', 0, 55], ['Стена →', 0, -55]].forEach((d) => {
    tiltRow.append(ctxBtn(d[0], '', () => {
      l.tiltX = d[1];
      l.tiltY = d[2];
      buzz();
      syncTilt();
      touch();
    }));
  });
  const alignRow1 = ovlEl('div', 'viz-seg');
  alignRow1.append(
    ctxBtn('⇤ Слева', '', () => alignTo('left')),
    ctxBtn('↔ Центр', '', () => alignTo('cx')),
    ctxBtn('Справа ⇥', '', () => alignTo('right'))
  );
  const alignRow2 = ovlEl('div', 'viz-seg');
  alignRow2.append(
    ctxBtn('⤒ Сверху', '', () => alignTo('top')),
    ctxBtn('↕ Центр', '', () => alignTo('cy')),
    ctxBtn('Снизу ⤓', '', () => alignTo('bottom'))
  );

  pv.append(
    ovlSlider('Прозрачность', 0.05, 1, 0.01, val('opacity', 1), pct, set('opacity')),
    ovlSlider('Поворот', -180, 180, 1, val('rot', 0), deg, set('rot')),
    ovlSlider('Размер', 0.05, 1, 0.01, val('size', 0.3), pct, set('size')),
    xSl,
    ySl,
    ovlSlider('Скругление', 0, 1, 0.01, val('round', 0), pct, set('round')),
    hr(),
    ovlEl('p', 'viz-ovl-title', 'Выравнивание'),
    alignRow1,
    alignRow2,
    hr(),
    ovlEl('p', 'viz-ovl-title', 'Обрезка'),
    ovlSlider('Слева', 0, 0.8, 0.01, val('cropL', 0), pct, set('cropL')),
    ovlSlider('Справа', 0, 0.8, 0.01, val('cropR', 0), pct, set('cropR')),
    ovlSlider('Сверху', 0, 0.8, 0.01, val('cropT', 0), pct, set('cropT')),
    ovlSlider('Снизу', 0, 0.8, 0.01, val('cropB', 0), pct, set('cropB')),
    hr(),
    ovlEl('p', 'viz-ovl-title', 'Форма'),
    ctxChoice(l, 'shape', [['Нет', 'none'], ['Круг', 'circle'], ['Сердце', 'heart'], ['Звезда', 'star'], ['Ромб', 'diamond']], 'none'),
    hr(),
        ovlEl('p', 'viz-ovl-title', 'Наклон (3D)'),
    tiltRow,
    tSlX,
    tSlY,
    tSlP,
    hr(),
    ovlEl('p', 'viz-ovl-title', 'Режим наложения'),
    blendRow,
    hr(),
    rowFlip
  );

  // ----- вкладка «Слои» -----
  const info = ovlEl('p', 'viz-wave-hint', '');
  const mvBtns = {};
    const listHost = ovlEl('div');
  const fillList = () => {
    listHost.textContent = '';
    listHost.append(ovlLayerList((x) => {
      ovlSelect(x.id);
      if (x.type === 'image') openCtxMenu(x, 0, 0, true);
      else closeCtxMenu();
    }, fillList));
  };
  const refreshOrder = () => {
    const arr = getLayers();
    const i = arr.indexOf(l);
    info.textContent = 'Слой ' + (i + 1) + ' из ' + arr.length + '. Верхний слой закрывает нижние.';
    mvBtns.front.disabled = i >= arr.length - 1;
    mvBtns.up.disabled = i >= arr.length - 1;
    mvBtns.down.disabled = i <= 0;
    mvBtns.back.disabled = i <= 0;
        fillList();
  };
  const mv = (key, label, mode) => {
    const b = ctxBtn(label, '', () => {
      ctxMove(l, mode);
      buzz();
      refreshOrder();
    });
    mvBtns[key] = b;
    return b;
  };
  const rowO1 = ovlEl('div', 'viz-seg');
  rowO1.append(mv('front', '⇈ На передний план', 'front'), mv('up', '↑ Выше', 'up'));
  const rowO2 = ovlEl('div', 'viz-seg');
  rowO2.append(mv('down', '↓ Ниже', 'down'), mv('back', '⇊ На задний план', 'back'));

  const animRow = ovlEl('div', 'viz-seg viz-seg-wrap');
  ANIM_MODES.forEach((d) => {
    const b = ovlEl('button', 'viz-chip' + ((l.anim || 'none') === d[0] ? ' active' : ''), d[1]);
    b.type = 'button';
    b.addEventListener('click', () => {
      l.anim = d[0];
      animRow.querySelectorAll('.viz-chip').forEach((x) => x.classList.toggle('active', x === b));
      buzz();
      touch();
    });
    animRow.append(b);
  });

  if (!window.matchMedia('(min-width: 1024px)').matches) pl.append(info, rowO1, rowO2, listHost, hr());
  pl.append(
    ovlEl('p', 'viz-ovl-title', 'Появление'),
    ctxChoice(l, 'inAnim', [['Нет', 'none'], ['Плавно', 'fade'], ['Снизу', 'up'], ['Сверху', 'down'], ['Слева', 'left'], ['Справа', 'right'], ['Зум', 'zoom']], 'none'),
    ovlSlider('Длительность', 0.1, 2, 0.05, val('inDur', 0.6), (v) => v.toFixed(2) + ' с', set('inDur')),
    hr(),
    ovlEl('p', 'viz-ovl-title', 'Постоянное движение'),
    ctxChoice(l, 'loop', [['Нет', 'none'], ['Вращение', 'spin'], ['Парение', 'float'], ['Качание', 'sway'], ['Мигание', 'blink']], 'none'),
    ovlSlider('Скорость', 0.2, 3, 0.05, val('loopSpeed', 1), (v) => '×' + v.toFixed(2), set('loopSpeed')),
    hr(),
    ovlEl('p', 'viz-ovl-title', 'Реакция на музыку'),
    animRow,
    ovlSlider('Сила', 0.1, 1, 0.01, val('animPower', 0.6), pct, set('animPower')),
    hr(),
    ovlEl('p', 'viz-ovl-title', 'Время показа'),
    ovlPaneTime(l)
  );
  refreshOrder();

  // ----- кнопки внизу -----
  const foot = ovlEl('div', 'viz-seg');
  foot.append(
    ctxBtn('Копия', '', () => {
      const c = duplicateLayer(l.id);
      renderOvl();
      if (c) openCtxMenu(c, 0, 0, true);
    }),
    ctxBtn('Сброс', '', () => {
      Object.assign(l, IMG_DEFAULTS);
      touch();
      openCtxMenu(l, 0, 0, true);
    }),
    ctxBtn('Удалить', 'danger', () => {
      removeLayer(l.id);
      closeCtxMenu();
      ovlCollapsed = false;
      renderOvl();
    })
  );

  const foot2 = ovlEl('div', 'viz-seg');
  const pasteBtn = ctxBtn('Встав. стиль', '', () => {
    if (!pasteStyle(l)) return;
    buzz();
    openCtxMenu(l, 0, 0, true);
  });
  pasteBtn.disabled = !styleClip || styleClip.type !== l.type;
  foot2.append(
    ctxBtn('Копир. стиль', '', () => {
      copyStyle(l);
      buzz();
      openCtxMenu(l, 0, 0, true);
    }),
    pasteBtn
  );

  ctxMenu.append(head, tabs, body, foot, foot2);

  ctxMenu.hidden = false;
  const w = ctxMenu.offsetWidth;
  const h = ctxMenu.offsetHeight;
  let left = cx + 8;
  let top = cy + 8;
  if (keep && ctxMenu.style.left) {
    left = parseFloat(ctxMenu.style.left);
    top = parseFloat(ctxMenu.style.top);
  }
  ctxMenu.style.left = clamp(left, 8, Math.max(8, window.innerWidth - w - 8)) + 'px';
  ctxMenu.style.top = clamp(top, 8, Math.max(8, window.innerHeight - h - 8)) + 'px';
  ctxPos = { x: left, y: top };
}

const lastPt = { x: 0, y: 0, t: 0 };

function rememberPt(e) {
  if (e.clientX <= 2 && e.clientY <= 2) return;
  lastPt.x = e.clientX;
  lastPt.y = e.clientY;
  lastPt.t = Date.now();
}

window.addEventListener('pointerdown', rememberPt, true);
window.addEventListener('pointermove', rememberPt, true);

window.addEventListener('contextmenu', (e) => {
    if (e.target && e.target.closest && e.target.closest('textarea, input, [contenteditable="true"], .viz-ovl')) return;
  const bad = e.clientX <= 2 && e.clientY <= 2 && lastPt.t && Date.now() - lastPt.t < 15000;
  const cx = bad ? lastPt.x : e.clientX;
  const cy = bad ? lastPt.y : e.clientY;
  const r = canvas.getBoundingClientRect();
  const inside = cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  if (!inside) return;
  e.preventDefault();
  if (exporting || wavePanelOpen) return;
  const p = ovlPoint({ clientX: cx, clientY: cy });
  const hit = hitTest(ctx, p.x, p.y);
  if (!hit) return;
  if (hit.type !== 'image') {
    lpCancel();
    ovlDrag = null;
    ovlCollapsed = false;
    select(hit.id);
    showTab('text');
    return;
  }
  lpCancel();
  ovlDrag = null;
  ovlSelect(hit.id);
  openCtxMenu(hit, cx, cy);
}, true);

ctxMenu.addEventListener('pointerdown', (e) => e.stopPropagation());

document.addEventListener('pointerdown', (e) => {
  if (ctxMenu.hidden) return;
  if (ctxMenu.contains(e.target) || frameEl.contains(e.target)) return;
  closeCtxMenu();
}, true);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCtxMenu();
});

window.addEventListener('resize', closeCtxMenu);

// ---------- проекты: сохранение настроек ----------

const PRESET_KEY = 'viz-presets-v1';
const PRESET_MAX = 30;

function readPresets() {
  try {
    const v = JSON.parse(localStorage.getItem(PRESET_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch (e) {
    return {};
  }
}

function writePresets(all) {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(all));
    return true;
  } catch (e) {
    return false;
  }
}

function currentFormatId() {
  if (VIZ_W === VIZ_H) return '1:1';
  return VIZ_W > VIZ_H ? '16:9' : '9:16';
}
// Маленькая картинка для карточки проекта. В покое волны плоские, поэтому на миг рисуем демо-кадр.
function makeThumb() {
  try {
    if (!playing) {
      fillDemoBars(1.2);
      drawWaves(ctx, bars, 1.2, currentStyle);
    }
    const w = 108;
    const h = Math.round((w * canvas.height) / canvas.width);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(canvas, 0, 0, w, h);
    const url = c.toDataURL('image/jpeg', 0.7);
    if (!playing) drawIdle(startOffset);
    return url;
  } catch (e) {
    if (!playing) drawIdle(startOffset);
    return '';
  }
}
function collectProject(name, noThumb) {
  const lay = exportLayers();
  return {
    v: 1,
    name: name,
    wave: Object.assign({}, wave),
    style: currentStyle,
    effects: Object.assign({}, effects),
    particles: Object.assign({}, particles),
        audio: Object.assign({}, audioFx),
    order: getLayerOrder(),
    slide: { every: slideshow.every, mode: slideshow.mode },
    format: currentFormatId(),
    len: clipSeconds,
    layers: lay.list,
    skipped: lay.skipped,
thumb: noThumb ? '' : makeThumb(),
    saved: Date.now()
  };
}

// Берёт из файла только известные ключи нужного типа, чужое и лишнее игнорирует.
function pickKnown(src, defs) {
  const out = {};
  if (!src || typeof src !== 'object') return out;
  Object.keys(defs).forEach((k) => {
    if (k in src && typeof src[k] === typeof defs[k]) out[k] = src[k];
  });
  return out;
}

async function applyProject(p) {
  stopLive();
  if (!p || typeof p !== 'object' || p.v !== 1 || exporting) return false;
  stopPlayback(true);
  setWave(pickKnown(p.wave, WAVE_DEFAULTS));
  setEffects(pickKnown(p.effects, EFFECT_DEFAULTS));
  setParticles(pickKnown(p.particles, PARTICLE_DEFAULTS));
  if (Array.isArray(p.order)) setLayerOrder(p.order.join(','));
    setAudioFx(Object.assign({}, AUDIO_FX_DEFAULTS, p.audio || {}));
  if (musicFx) musicFx.setAmount(audioFx.reverb);
  fxUpdateAll();
  if (p.slide && typeof p.slide === 'object') {
    setSlideOpts({
      every: [1, 2, 4, 8].includes(p.slide.every) ? p.slide.every : slideshow.every,
      mode: ['cut', 'fade', 'zoom'].includes(p.slide.mode) ? p.slide.mode : slideshow.mode
    });
  }
  if (['9:16', '1:1', '16:9'].includes(p.format) && p.format !== currentFormatId()) {
    const chip = Array.from(formatBox.children).find((c) => c.dataset.format === p.format);
    if (chip) chip.click();
  }
  if ([15, 30, 60].includes(p.len) && p.len !== clipSeconds) {
    const chip = Array.from(lengthBox.children).find((c) => Number(c.dataset.len) === p.len);
    if (chip) chip.click();
  }
    if (!mediaReady() && typeof p.style === 'string' && p.style !== 'none') {
    const chip0 = Array.from(styleBox.children).find((c) => c.dataset.style === p.style);
    if (chip0) {
      currentStyle = p.style;
      Array.from(styleBox.children).forEach((c) => c.classList.toggle('active', c === chip0));
    }
  }
  if (typeof p.style === 'string' && p.style !== 'none' && p.style !== currentStyle) {
    const chip = Array.from(styleBox.children).find((c) => c.dataset.style === p.style);
    if (chip) chip.click();
  }
  if (Array.isArray(p.layers)) await importLayers(p.layers);
  syncPanel();
  if (!playing) drawIdle(startOffset);
  renderOvl();
  return true;
}

const presetBox = document.createElement('div');
presetBox.className = 'viz-set-row';
presetBox.id = 'presetBox';

const presetTitle = document.createElement('div');
presetTitle.className = 'viz-set-label';
presetTitle.textContent = 'Проекты';

const presetName = document.createElement('input');
presetName.type = 'text';
presetName.className = 'viz-ovl-search';
presetName.maxLength = 40;
presetName.placeholder = 'Название проекта';
presetName.spellcheck = false;
presetName.autocomplete = 'off';
presetName.style.marginBottom = '0';

const presetSave = document.createElement('button');
presetSave.type = 'button';
presetSave.className = 'viz-btn viz-btn-primary';
presetSave.textContent = 'Сохранить в браузере';

const presetList = document.createElement('div');
presetList.className = 'viz-layers';
presetList.style.maxHeight = '150px';
presetList.style.overflowY = 'auto';

const presetFiles = document.createElement('div');
presetFiles.className = 'viz-seg';
const presetDown = document.createElement('button');
presetDown.type = 'button';
presetDown.className = 'viz-chip';
presetDown.textContent = 'Скачать файл';
const presetUp = document.createElement('button');
presetUp.type = 'button';
presetUp.className = 'viz-chip';
presetUp.textContent = 'Открыть файл';
presetFiles.append(presetDown, presetUp);

const presetFile = document.createElement('input');
presetFile.type = 'file';
presetFile.accept = '';
presetFile.hidden = true;

const presetMsg = document.createElement('p');
presetMsg.className = 'viz-wave-hint';
presetMsg.textContent = 'Сохраняются настройки, текст и стикеры из паков. Трек, фото и видео нужно загрузить заново.';

presetBox.append(presetTitle, presetName, presetSave, presetList, presetFiles, presetFile, presetMsg);
settingsClose.before(presetBox);

// Кнопка «?» в углу окна и плашка про хранение проектов
const settingsCard = settingsBox.querySelector('.viz-sheet-card');

const presetHelp = document.createElement('button');
presetHelp.type = 'button';
presetHelp.textContent = '?';
presetHelp.title = 'Где хранятся проекты';
presetHelp.setAttribute('aria-label', 'Где хранятся проекты');
presetHelp.style.cssText = 'position: absolute; top: 30px; right: 16px; width: 26px; height: 26px; padding: 0; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 50%; background: rgba(255, 255, 255, 0.08); color: #e8e8ec; font-size: 14px; font-weight: 700; line-height: 1; cursor: pointer;';

const presetNote = document.createElement('div');
presetNote.id = 'presetNote';
presetNote.hidden = true;
presetNote.style.cssText = 'padding: 12px 14px; border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 12px; background: rgba(255, 255, 255, 0.06); font-size: 12px; line-height: 1.5; color: #d4d4da;';
presetNote.innerHTML =
  '<b style="display: block; margin-bottom: 6px; color: #fff;">Где хранятся проекты</b>' +
  '<p style="margin: 0 0 8px;">Проекты хранятся только в этом браузере на этом устройстве. Сайт их не получает и не видит.</p>' +
  '<p style="margin: 0 0 8px;">Если очистить данные сайта или историю с кэшем, сохранённые проекты удалятся. В режиме инкогнито они не сохраняются совсем. В другом браузере или на другом устройстве их не будет.</p>' +
  '<p style="margin: 0 0 8px;">Чтобы не потерять проект или перенести его, нажмите «Скачать файл». Получится файл .992, его можно открыть кнопкой «Открыть файл» или перетащить на страницу редактора.</p>' +
  '<p style="margin: 0 0 8px;">Файл можно передать другому человеку, и у него загрузятся ваши настройки, текст и стикеры из встроенных наборов.</p>' +
  '<p style="margin: 0;">В проект не входят трек, фото, видео, свои картинки и фото слайд-шоу. Их нужно добавить заново, потому что в файле хранятся только настройки.</p>';

settingsCard.append(presetHelp);
settingsCard.querySelector('.viz-sheet-title').after(presetNote);

presetHelp.addEventListener('click', () => {
  presetNote.hidden = !presetNote.hidden;
});

settingsBtn.addEventListener('click', () => {
  presetNote.hidden = true;
});
settingsBox.querySelector('.viz-sheet-card').style.maxHeight = '90dvh';
settingsBox.querySelector('.viz-sheet-card').style.overflowY = 'auto';

// ---------- карточки проектов: значки, живое превью, полёт кадра ----------

const ICON_PART = '<circle cx="7" cy="8" r="2"/><circle cx="16.5" cy="6" r="1.2"/><circle cx="17" cy="15" r="2.6"/><circle cx="8" cy="17" r="1.3"/>';
const ICON_FX = '<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M19 15v5M16.5 17.5h5"/>';
const ICON_TXT = '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>';
const ICON_STK = '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>';

function projectIcons(p) {
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; gap: 5px; min-height: 14px; color: rgba(255, 255, 255, 0.55);';
  const parts = [];
  if (p.particles && p.particles.type && p.particles.type !== 'none') parts.push(['Частицы', ICON_PART]);
  if (p.effects && Object.keys(EFFECT_DEFAULTS).some((k) => k !== 'sens' && p.effects[k] !== undefined && p.effects[k] !== EFFECT_DEFAULTS[k])) {
    parts.push(['Эффекты', ICON_FX]);
  }
  const lay = Array.isArray(p.layers) ? p.layers : [];
  if (lay.some((l) => l && l.type === 'text')) parts.push(['Текст', ICON_TXT]);
  if (lay.some((l) => l && l.type === 'image')) parts.push(['Стикеры', ICON_STK]);
  parts.forEach((d) => {
    const s = document.createElement('span');
    s.title = d[0];
    s.style.display = 'flex';
    s.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d[1] + '</svg>';
    row.append(s);
  });
  return row;
}

// Живое превью: на время показа применяются настройки проекта, потом возвращаются твои.
let livePrev = null;

function startLive(p, liveCv) {
  stopLive();
  if (exporting || playing || !p || p.v !== 1) return;
  const snap = {
    wave: Object.assign({}, wave),
    effects: Object.assign({}, effects),
    particles: Object.assign({}, particles),
    order: getLayerOrder().join(',')
  };
  setWave(pickKnown(p.wave, WAVE_DEFAULTS));
  setEffects(pickKnown(p.effects, EFFECT_DEFAULTS));
  setParticles(pickKnown(p.particles, PARTICLE_DEFAULTS));
  if (Array.isArray(p.order)) setLayerOrder(p.order.join(','));
  const style = typeof p.style === 'string' ? p.style : 'none';
  const lg = liveCv.getContext('2d');
  const t0 = performance.now();
  livePrev = { snap: snap, cv: liveCv, raf: 0 };
  liveCv.style.opacity = '1';

  const frame = (now) => {
    if (!livePrev) return;
    const t = (now - t0) / 1000;
    fillDemoBars(t);
    drawLayers(ctx, bars, t, style, { noEffects: transparentMode });
    const cw = liveCv.width;
    const ch = liveCv.height;
    const sa = cw / ch;
    let sw = canvas.width;
    let sh = canvas.height;
    let sx = 0;
    let sy = 0;
    if (canvas.width / canvas.height > sa) {
      sw = canvas.height * sa;
      sx = (canvas.width - sw) / 2;
    } else {
      sh = canvas.width / sa;
      sy = (canvas.height - sh) / 2;
    }
    lg.drawImage(canvas, sx, sy, sw, sh, 0, 0, cw, ch);
    livePrev.raf = requestAnimationFrame(frame);
  };
  livePrev.raf = requestAnimationFrame(frame);
}

function stopLive() {
  if (!livePrev) return;
  const lp = livePrev;
  livePrev = null;
  cancelAnimationFrame(lp.raf);
  setWave(lp.snap.wave);
  setEffects(lp.snap.effects);
  setParticles(lp.snap.particles);
  setLayerOrder(lp.snap.order);
  lp.cv.style.opacity = '0';
  if (!playing) drawIdle(startOffset);
}

// Страховка: если палец или мышь «потерялись», настройки всё равно вернутся
new MutationObserver(() => {
  if (settingsBox.hidden) stopLive();
}).observe(settingsBox, { attributes: true, attributeFilter: ['hidden'] });
document.addEventListener('visibilitychange', stopLive);
window.addEventListener('blur', stopLive);

const savedStyle = document.createElement('style');
savedStyle.textContent = '@keyframes viz-saved { 0% { box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15), 0 0 0 0 rgba(255, 255, 255, 0.8); } 100% { box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15), 0 0 0 16px rgba(255, 255, 255, 0); } }';
document.head.append(savedStyle);

// Кадр с экрана летит в новую карточку
function flyToCard(thumb, name) {
  const card = Array.from(presetList.children).find((c) => c.dataset.name === name);
  if (!card) return;
  card.scrollIntoView({ block: 'nearest' });
  const pic = card.querySelector('[data-pic]');
  if (!pic) return;
  const to = pic.getBoundingClientRect();
  const from = frameEl.getBoundingClientRect();
  if (!thumb || !to.width || !from.width) {
    pic.style.animation = 'viz-saved 0.8s ease-out';
    return;
  }
  pic.style.opacity = '0';
  const fly = document.createElement('div');
  fly.style.cssText = 'position: fixed; z-index: 200; pointer-events: none; border-radius: 18px; background: #000 center / cover no-repeat; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6); transition: all 0.6s cubic-bezier(0.5, 0, 0.2, 1);' +
    'left: ' + from.left + 'px; top: ' + from.top + 'px; width: ' + from.width + 'px; height: ' + from.height + 'px; background-image: url(' + thumb + ');';
  document.body.append(fly);
  fly.getBoundingClientRect();
  requestAnimationFrame(() => {
    fly.style.left = to.left + 'px';
    fly.style.top = to.top + 'px';
    fly.style.width = to.width + 'px';
    fly.style.height = to.height + 'px';
    fly.style.borderRadius = '10px';
  });
  setTimeout(() => {
    fly.remove();
    pic.style.opacity = '';
    pic.style.animation = 'viz-saved 0.8s ease-out';
  }, 650);
}

function fmtSaved(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const p2 = (n) => String(n).padStart(2, '0');
  return p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
}

function renderPresetList() {
  const all = readPresets();
  const names = Object.keys(all).sort((a, b) => ((all[b] && all[b].pin) ? 1 : 0) - ((all[a] && all[a].pin) ? 1 : 0) || ((all[b] && all[b].saved) || 0) - ((all[a] && all[a].saved) || 0));
  presetList.textContent = '';
  presetList.style.display = names.length ? 'grid' : 'none';
  presetList.style.gridTemplateColumns = 'repeat(3, 1fr)';
  presetList.style.alignItems = 'start';
  presetList.style.gap = '10px 8px';
  presetList.style.maxHeight = '290px';
  presetList.style.overflowY = 'auto';

  names.forEach((name) => {
    const p = all[name] || {};
    const card = document.createElement('div');
    card.style.cssText = 'position: relative; display: flex; flex-direction: column; gap: 3px; min-width: 0;';
    card.dataset.name = name;

    const load = async () => {
      const ok = await applyProject(all[name]);
      if (!ok) {
        presetMsg.textContent = 'Не удалось загрузить проект.';
        return;
      }
      buzz();
      settingsBox.hidden = true;
      setStatus('Проект «' + name + '» загружен. Трек, фото и видео добавьте заново.', true);
    };

    const pick = document.createElement('button');
    pick.type = 'button';
    pick.title = 'Загрузить проект';
    pick.style.cssText = 'display: block; width: 100%; padding: 0; border: 0; background: none; cursor: pointer;';
    const ratio = p.format === '1:1' ? '1 / 1' : p.format === '16:9' ? '16 / 9' : '9 / 16';
    const pic = document.createElement('div');
    pic.style.cssText = 'display: grid; place-items: center; width: 100%; aspect-ratio: ' + ratio + '; border-radius: 10px; overflow: hidden; background: #0c0c0e center / cover no-repeat; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15); font-size: 10px; color: rgba(255, 255, 255, 0.35);';
    if (typeof p.thumb === 'string' && p.thumb.indexOf('data:image/jpeg;base64,') === 0) {
      pic.style.backgroundImage = 'url(' + p.thumb + ')';
    } else {
      pic.textContent = 'нет превью';
    }
    pick.append(pic);
    pic.dataset.pic = '1';
    pic.style.position = 'relative';
    const live = document.createElement('canvas');
    live.width = 160;
    live.height = Math.round(160 * (p.format === '1:1' ? 1 : p.format === '16:9' ? 9 / 16 : 16 / 9));
    live.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; transition: opacity 0.15s; pointer-events: none;';
    pic.append(live);
    let liveTimer = 0;
    let held = false;
    pick.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') startLive(p, live);
    });
    pick.addEventListener('pointerleave', () => {
      clearTimeout(liveTimer);
      liveTimer = 0;
      stopLive();
    });
    pick.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      held = false;
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => {
        held = true;
        startLive(p, live);
      }, 350);
    });
    const liveEnd = () => {
      clearTimeout(liveTimer);
      liveTimer = 0;
      if (held) stopLive();
    };
    pick.addEventListener('pointerup', liveEnd);
    pick.addEventListener('pointercancel', liveEnd);
    pick.addEventListener('contextmenu', (e) => e.preventDefault());
    pick.addEventListener('click', () => {
      if (held) {
        held = false;
        return;
      }
      load();
    });

    const title = document.createElement('span');
    title.textContent = name;
    title.style.cssText = 'display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 700; color: #f2f2f4; cursor: pointer;';
    title.addEventListener('click', load);

    const st = STYLES.find((s) => s.id === p.style);
    const pt = p.particles ? PARTICLE_TYPES.find((x) => x.id === p.particles.type) : null;
    const bits = [st ? st.name : 'без волн'];
    if (pt) bits.push(pt.name);
    bits.push(p.format || '9:16');
    const sub = document.createElement('span');
    sub.textContent = bits.join(' · ');
    sub.style.cssText = 'display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; color: rgba(255, 255, 255, 0.45);';

    const date = document.createElement('span');
    date.textContent = fmtSaved(p.saved);
    date.style.cssText = 'display: block; font-size: 10px; color: rgba(255, 255, 255, 0.3);';

    const btnCss = 'position: absolute; top: 4px; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 50%; background: rgba(0, 0, 0, 0.7); color: #fff; font-size: 11px; line-height: 1; cursor: pointer;';

    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '✕';
    del.title = 'Удалить проект';
    del.setAttribute('aria-label', 'Удалить проект ' + name);
    del.style.cssText = btnCss + ' right: 4px;';
    del.addEventListener('click', () => {
      const cur = readPresets();
      delete cur[name];
      writePresets(cur);
      renderPresetList();
    });

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = '✎';
    edit.title = 'Переименовать';
    edit.setAttribute('aria-label', 'Переименовать проект ' + name);
    edit.style.cssText = btnCss + ' left: 4px;';
    edit.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = name;
      inp.maxLength = 40;
      inp.spellcheck = false;
      inp.style.cssText = 'width: 100%; min-width: 0; box-sizing: border-box; padding: 2px 6px; border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 6px; background: #1a1a1f; color: #fff; font: 700 12px system-ui, -apple-system, sans-serif;';
      title.replaceWith(inp);
      inp.focus();
      inp.select();
      let done = false;
      const commit = (save) => {
        if (done) return;
        done = true;
        const nn = inp.value.trim().slice(0, 40);
        if (save && nn && nn !== name) {
          const cur = readPresets();
          if (nn in cur) {
            presetMsg.textContent = 'Проект «' + nn + '» уже есть. Выберите другое название.';
          } else if (name in cur) {
            const rebuilt = {};
            Object.keys(cur).forEach((k) => {
              if (k === name) rebuilt[nn] = Object.assign({}, cur[k], { name: nn });
              else rebuilt[k] = cur[k];
            });
            writePresets(rebuilt);
          }
        }
        renderPresetList();
      };
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit(true);
        } else if (e.key === 'Escape') {
          commit(false);
        }
      });
      inp.addEventListener('blur', () => commit(true));
    });

    const star = document.createElement('button');
    star.type = 'button';
    star.textContent = p.pin ? '★' : '☆';
    star.title = p.pin ? 'Открепить' : 'Закрепить вверху';
    star.setAttribute('aria-label', star.title);
    star.style.cssText = btnCss + ' left: 30px;' + (p.pin ? ' color: #ffd84d;' : '');
    star.addEventListener('click', () => {
      const cur = readPresets();
      if (cur[name]) {
        cur[name].pin = !cur[name].pin;
        writePresets(cur);
      }
      renderPresetList();
    });

    card.append(pick, title, sub, projectIcons(p), date, edit, star, del);
    presetList.append(card);
  });
}

function renderPresetListOld2() {
  const all = readPresets();
  const names = Object.keys(all);
  presetList.textContent = '';
  presetList.style.display = names.length ? 'grid' : 'none';
  presetList.style.gridTemplateColumns = '';
  presetList.style.gridAutoFlow = 'column';
  presetList.style.gridAutoColumns = '31%';
  presetList.style.alignItems = 'start';
  presetList.style.gap = '8px';
  presetList.style.maxHeight = 'none';
  presetList.style.overflowX = 'auto';
  presetList.style.overflowY = 'hidden';
  presetList.style.paddingBottom = '6px';
  presetList.style.overscrollBehavior = 'contain';

  names.forEach((name) => {
    const p = all[name] || {};
    const card = document.createElement('div');
    card.style.cssText = 'position: relative; min-width: 0;';

    const pick = document.createElement('button');
    pick.type = 'button';
    pick.title = 'Загрузить проект';
    pick.style.cssText = 'display: flex; flex-direction: column; gap: 4px; width: 100%; padding: 0; border: 0; background: none; color: inherit; text-align: left; cursor: pointer;';

    const ratio = p.format === '1:1' ? '1 / 1' : p.format === '16:9' ? '16 / 9' : '9 / 16';
    const pic = document.createElement('div');
    pic.style.cssText = 'display: grid; place-items: center; width: 100%; aspect-ratio: ' + ratio + '; border-radius: 10px; overflow: hidden; background: #0c0c0e center / cover no-repeat; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15); font-size: 10px; color: rgba(255, 255, 255, 0.35);';
    if (typeof p.thumb === 'string' && p.thumb.indexOf('data:image/jpeg;base64,') === 0) {
      pic.style.backgroundImage = 'url(' + p.thumb + ')';
    } else {
      pic.textContent = 'нет превью';
    }

    const title = document.createElement('span');
    title.textContent = name;
    title.style.cssText = 'display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 700; color: #f2f2f4;';

    const st = STYLES.find((s) => s.id === p.style);
    const pt = p.particles ? PARTICLE_TYPES.find((x) => x.id === p.particles.type) : null;
    const bits = [st ? st.name : 'без волн'];
    if (pt) bits.push(pt.name);
    bits.push(p.format || '9:16');
    const sub = document.createElement('span');
    sub.textContent = bits.join(' · ');
    sub.style.cssText = 'display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; color: rgba(255, 255, 255, 0.45);';

    pick.append(pic, title, sub);
    pick.addEventListener('click', async () => {
      const ok = await applyProject(all[name]);
      if (!ok) {
        presetMsg.textContent = 'Не удалось загрузить проект.';
        return;
      }
      buzz();
      settingsBox.hidden = true;
      setStatus('Проект «' + name + '» загружен. Трек, фото и видео добавьте заново.', true);
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '✕';
    del.title = 'Удалить проект';
    del.setAttribute('aria-label', 'Удалить проект ' + name);
    del.style.cssText = 'position: absolute; right: 4px; top: 4px; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 50%; background: rgba(0, 0, 0, 0.7); color: #fff; font-size: 11px; line-height: 1; cursor: pointer;';
    del.addEventListener('click', () => {
      const cur = readPresets();
      delete cur[name];
      writePresets(cur);
      renderPresetList();
    });

    card.append(pick, del);
    presetList.append(card);
  });
}

function renderPresetListOld() {
  const all = readPresets();
  const names = Object.keys(all);
  presetList.textContent = '';
  names.forEach((name) => {
    const row = document.createElement('div');
    row.className = 'viz-lrow';
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'viz-lname';
    pick.textContent = name;
    pick.title = 'Загрузить проект';
    pick.addEventListener('click', async () => {
      const ok = await applyProject(all[name]);
      if (!ok) {
        presetMsg.textContent = 'Не удалось загрузить проект.';
        return;
      }
      buzz();
      settingsBox.hidden = true;
      setStatus('Проект «' + name + '» загружен. Трек, фото и видео добавьте заново.', true);
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'viz-lbtn on';
    del.textContent = '✕';
    del.title = 'Удалить проект';
    del.setAttribute('aria-label', 'Удалить проект ' + name);
    del.addEventListener('click', () => {
      const cur = readPresets();
      delete cur[name];
      writePresets(cur);
      renderPresetList();
    });
    row.append(pick, del);
    presetList.append(row);
  });
  presetList.hidden = !names.length;
}
// Первое свободное имя вида 992-1, 992-2, 992-3
function autoName(all) {
  let n = 1;
  while (('992-' + n) in all) n++;
  return '992-' + n;
}
presetSave.addEventListener('click', () => {
  const all = readPresets();
  let name = presetName.value.trim();
  if (!name) name = autoName(all);
    if (name in all && pendingReplace !== name) {
    pendingReplace = name;
    presetSave.textContent = 'Заменить «' + name + '»?';
    presetMsg.textContent = 'Проект с таким названием уже есть. Нажмите ещё раз, чтобы заменить его.';
    return;
  }
  if (!(name in all) && Object.keys(all).length >= PRESET_MAX) {
    presetMsg.textContent = 'Можно хранить до ' + PRESET_MAX + ' проектов. Удалите ненужные.';
    return;
  }
  const p = collectProject(name);
  p.pin = !!(all[name] && all[name].pin);
  all[name] = p;
  if (!writePresets(all)) {
    presetMsg.textContent = 'Не удалось сохранить: в браузере нет места или хранилище отключено.';
    return;
  }
  presetName.value = '';
    pendingReplace = '';
  presetSave.textContent = 'Сохранить в браузере';
  buzz();
    presetMsg.textContent = 'Сохранено: «' + name + '».' + (p.skipped ? ' Своих картинок не сохранено: ' + p.skipped + '.' : '');
  setTimeout(() => flyToCard(p.thumb, name), 0);
  renderPresetList();
});

presetDown.addEventListener('click', () => {
  const name = presetName.value.trim() || autoName(readPresets());
  const blob = new Blob([JSON.stringify(collectProject(name))], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
    a.download = name.replace(/[^\wА-Яа-яЁё-]+/g, '_') + '.992';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  presetMsg.textContent = 'Файл проекта скачан.';
});

presetUp.addEventListener('click', () => presetFile.click());

presetFile.addEventListener('change', async () => {
  const file = presetFile.files && presetFile.files[0];
  presetFile.value = '';
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    presetMsg.textContent = 'Файл слишком большой для проекта.';
    return;
  }
  let data = null;
  try {
    data = JSON.parse(await file.text());
  } catch (e) {
    data = null;
  }
  const ok = await applyProject(data);
  if (!ok) {
    presetMsg.textContent = 'Это не файл проекта 992MUZ.';
    return;
  }
  buzz();
  settingsBox.hidden = true;
  setStatus('Проект загружен из файла. Трек, фото и видео добавьте заново.', true);
});

settingsBtn.addEventListener('click', renderPresetList);

// Сброс подтверждения замены, если название изменили
let pendingReplace = '';
presetName.addEventListener('input', () => {
  pendingReplace = '';
  presetSave.textContent = 'Сохранить в браузере';
});

// Пустой проект: всё по умолчанию, стиль волн остаётся
function defaultProject() {
  return {
    v: 1,
    wave: Object.assign({}, WAVE_DEFAULTS),
    style: currentStyle,
    effects: Object.assign({}, EFFECT_DEFAULTS),
    particles: Object.assign({}, PARTICLE_DEFAULTS),
    order: ['waves', 'particles', 'effects'],
    slide: { every: 2, mode: 'fade' },
    format: '9:16',
    len: 60,
    layers: []
  };
}

const presetNew = document.createElement('button');
presetNew.type = 'button';
presetNew.className = 'viz-chip';
presetNew.textContent = 'Новый проект (сбросить всё)';
presetFiles.after(presetNew);

let newTimer = 0;
presetNew.addEventListener('click', async () => {
  if (!newTimer) {
    presetNew.textContent = 'Сбросить все настройки, текст и стикеры? Нажмите ещё раз';
    newTimer = setTimeout(() => {
      newTimer = 0;
      presetNew.textContent = 'Новый проект (сбросить всё)';
    }, 4000);
    return;
  }
  clearTimeout(newTimer);
  newTimer = 0;
  presetNew.textContent = 'Новый проект (сбросить всё)';
  await applyProject(defaultProject());
  buzz();
  settingsBox.hidden = true;
  setStatus('Новый проект: все настройки сброшены.', true);
});
// Клик по логотипу: окно подтверждения. «Сбросить всё» стирает автосохранение и перезагружает страницу.
const newProjBox = document.getElementById('newProjBox');

function closeNewProj() {
  newProjBox.hidden = true;
}

document.getElementById('logoHome').addEventListener('click', () => {
  if (exporting) {
    setStatus('Дождитесь конца экспорта.');
    return;
  }
  newProjBox.hidden = false;
});

document.getElementById('newProjCancel').addEventListener('click', closeNewProj);

// ---------- ТОЛЬКО КОМПЬЮТЕР: окно «О версии» по клику на V1 ----------
const verBox = document.createElement('div');
verBox.className = 'viz-sheet';
verBox.id = 'verBox';
verBox.hidden = true;
verBox.innerHTML =
  '<div class="viz-sheet-card ver-card">' +
    '<div class="ver-glow" aria-hidden="true"></div>' +
    '<div class="ver-top">' +
      '<div class="ver-badge"><b>V1</b><span>Текущая версия</span></div>' +
      '<h2 class="viz-sheet-title">992 Studio</h2>' +
      '<p class="ver-lead">Профессиональный визуализатор прямо в браузере. Загрузите трек, соберите ролик и скачайте в MP4.</p>' +
    '</div>' +

    '<div class="ver-sec">' +
      '<div class="ver-label">Что уже есть в V1</div>' +
      '<div class="ver-chips">' +
        '<span>14 стилей волн</span><span>Частицы</span><span>Эффекты и фильтры</span>' +
        '<span>Текст и шаблоны</span><span>Стикеры</span><span>Слои</span>' +
        '<span>Звук и эхо по BPM</span><span>MP4 / MP3 / WAV</span>' +
      '</div>' +
    '</div>' +

    '<div class="ver-sec">' +
      '<div class="ver-label ver-label-hot">Скоро в V2</div>' +
      '<div class="ver-list">' +
        '<div class="ver-item"><i>🎚</i><div><b>Профессиональная обработка звука</b><span>Многополосный эквалайзер, компрессор, лимитер</span></div><em>скоро</em></div>' +
        '<div class="ver-item"><i>🧩</i><div><b>Плагины</b><span>Подключаемые эффекты и свои пресеты</span></div><em>скоро</em></div>' +
        '<div class="ver-item"><i>🎛</i><div><b>Мастеринг одним нажатием</b><span>Громкость, баланс и чистота звучания для релиза</span></div><em>скоро</em></div>' +
        '<div class="ver-item"><i>✨</i><div><b>ИИ-помощник</b><span>Авто-ролик под бит, подбор цветов и текста</span></div><em>скоро</em></div>' +
        '<div class="ver-item"><i>➕</i><div><b>И многое другое</b><span>Список будет расти, следите за новостями</span></div><em>скоро</em></div>' +
      '</div>' +
    '</div>' +

    '<div class="ver-promo">' +
      '<div class="ver-promo-t">Первые 5 месяцев бесплатно</div>' +
      '<p>Для всех подписчиков 992MUZ. Сообщим об обновлении в Instagram, следите за новостями.</p>' +
    '</div>' +

    '<a class="ver-ig" href="https://www.instagram.com/992muz/" target="_blank" rel="noopener noreferrer">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>' +
      '<span>Подписаться в Instagram</span><small>@992muz</small>' +
    '</a>' +

    '<button type="button" class="viz-btn" id="verClose">Закрыть<span class="ver-esc">Esc</span></button>' +
  '</div>';
document.body.append(verBox);

const verBadge = document.querySelector('.viz-ver');

function closeVer() {
  verBox.hidden = true;
}

verBadge.addEventListener('click', (e) => {
  if (!window.matchMedia('(min-width: 1024px)').matches) return;
  e.stopPropagation();
  if (exporting) return;
  verBox.hidden = false;
});

document.getElementById('verClose').addEventListener('click', closeVer);

verBox.addEventListener('pointerdown', (e) => {
  if (e.target === verBox) closeVer();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !verBox.hidden) closeVer();
});
newProjBox.addEventListener('click', (e) => {
  if (e.target === newProjBox) closeNewProj();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !newProjBox.hidden) closeNewProj();
});

document.getElementById('newProjOk').addEventListener('click', () => {
  autoReady = false;
  try { localStorage.removeItem(AUTO_KEY); } catch (e) {}
  location.reload();
});
// ---------- автосохранение последней сессии ----------

const AUTO_KEY = 'viz-autosave-v1';
let autoReady = false;
let autoLast = '';

function autoSave() {
  if (!autoReady || exporting || livePrev) return;
  try {
    const p = collectProject('auto', true);
    p.saved = 0;
    const s = JSON.stringify(p);
    if (s === autoLast) return;
    autoLast = s;
    localStorage.setItem(AUTO_KEY, s);
  } catch (e) {}
}

setInterval(autoSave, 3000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) autoSave();
});
window.addEventListener('pagehide', autoSave);

(async () => {
  const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
  if (isDesktop) {
    const wideChip = formatBox.querySelector('[data-format="16:9"]');
    if (wideChip) wideChip.click();
  }
  try {
    const raw = localStorage.getItem(AUTO_KEY);
    if (raw) {
      if (isDesktop && p && typeof p === 'object') p.format = '16:9';
      if (await applyProject(p)) {
        autoLast = raw;
        if ((p.style && p.style !== 'none') || (Array.isArray(p.layers) && p.layers.length)) {
          setStatus('Настройки прошлой сессии восстановлены. Трек, фото и видео добавьте заново.', true);
        }
      }
    }
  } catch (e) {}
  autoReady = true;
})();
// Перетаскивание файла проекта (.992) прямо на страницу
document.addEventListener('dragover', (e) => {
  if (e.dataTransfer && Array.from(e.dataTransfer.types).indexOf('Files') >= 0) e.preventDefault();
});

document.addEventListener('drop', (e) => {
  const files = e.dataTransfer && e.dataTransfer.files;
  if (!files || !files.length) return;
  e.preventDefault();
  if (exporting) return;
  if (!/\.(992|json)$/i.test(files[0].name)) {
    setStatus('Сюда можно перетащить только файл проекта .992');
    return;
  }
  presetFile.files = files;
  presetFile.dispatchEvent(new Event('change'));
});
renderPresetList();
window.addEventListener('pagehide', () => {
  if (abortCtl) abortCtl.abort();
  stopPlayback(false);
  clearResult();
  buffer = null;
  if (audioCtx) audioCtx.close();
});

drawIdle(0);
updateUi(0);