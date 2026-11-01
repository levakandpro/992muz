import { drawBackdrop, drawWaves, setSlideTime, setBgFilter } from '/js/visualizer/waves.js';
import { drawParticles } from '/js/visualizer/particles.js';
import { drawEffects, effects } from '/js/visualizer/effects.js';

// Порядок слоёв снизу вверх. Фон всегда самый нижний.
export const layers = { order: ['waves', 'particles', 'effects'] };

export const LAYER_PRESETS = [
  { id: 'waves,particles,effects', name: 'Волны → Частицы → Эффекты' },
  { id: 'waves,effects,particles', name: 'Волны → Эффекты → Частицы' },
  { id: 'particles,waves,effects', name: 'Частицы → Волны → Эффекты' },
  { id: 'particles,effects,waves', name: 'Частицы → Эффекты → Волны' },
  { id: 'effects,waves,particles', name: 'Эффекты → Волны → Частицы' },
  { id: 'effects,particles,waves', name: 'Эффекты → Частицы → Волны' }
];
export function getLayerOrder() {
  return layers.order.slice();
}

// dir = 1: слой выше (ближе к зрителю), dir = -1: ниже.
export function moveLayerKey(key, dir) {
  const i = layers.order.indexOf(key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= layers.order.length) return false;
  const a = layers.order.slice();
  a.splice(i, 1);
  a.splice(j, 0, key);
  layers.order = a;
  return true;
}
export function getLayerPreset() {
  return layers.order.join(',');
}

export function setLayerOrder(id) {
  const list = String(id).split(',');
  if (list.length === 3 && ['waves', 'particles', 'effects'].every((k) => list.includes(k))) {
    layers.order = list;
  }
}

// opts.noEffects = true: пропустить эффекты (прозрачный режим).
export function drawLayers(ctx, bars, t, style, opts) {
  setSlideTime(t);
    setBgFilter(effects.filter, effects.filterAmt);
  drawBackdrop(ctx, bars, style);
  for (let i = 0; i < layers.order.length; i++) {
    const k = layers.order[i];
    if (k === 'waves') drawWaves(ctx, bars, t, style, false);
    else if (k === 'particles') drawParticles(ctx, bars, t);
    else if (k === 'effects' && !(opts && opts.noEffects)) drawEffects(ctx, bars, t);
  }
}