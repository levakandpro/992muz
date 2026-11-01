const PEAKS = 600;

export function createWavePicker(canvas, handlers = {}) {
  const ctx = canvas.getContext('2d');
  let peaks = null;
  let total = 0;
  let clipLen = 0;
  let clipStart = 0;
  let playhead = -1;
  let drag = null;

  function computePeaks(buffer) {
    const out = new Float32Array(PEAKS);
    const chans = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
    const len = buffer.length;
    const step = len / PEAKS;

    for (let i = 0; i < PEAKS; i++) {
      const from = Math.floor(i * step);
      const to = Math.max(from + 1, Math.floor((i + 1) * step));
      let max = 0;
      for (let c = 0; c < chans.length; c++) {
        const d = chans[c];
        for (let j = from; j < to && j < len; j++) {
          const v = d[j] < 0 ? -d[j] : d[j];
          if (v > max) max = v;
        }
      }
      out[i] = max;
    }

    let top = 0;
    for (let i = 0; i < PEAKS; i++) if (out[i] > top) top = out[i];
    if (top > 0) for (let i = 0; i < PEAKS; i++) out[i] /= top;
    return out;
  }

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function movable() {
    return !!peaks && total > clipLen + 0.05;
  }

  function draw() {
    if (!peaks) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const colW = w / PEAKS;
    const barW = Math.max(1, colW * 0.62);
    const mid = h / 2;
    const x0 = (clipStart / total) * w;
    const x1 = ((clipStart + clipLen) / total) * w;
    const px = playhead >= 0 ? ((clipStart + playhead) / total) * w : -1;

    for (let i = 0; i < PEAKS; i++) {
      const x = i * colW;
      const c = x + colW / 2;
      let alpha = 0.2;
      if (c >= x0 && c <= x1) alpha = px >= 0 && c <= px ? 0.95 : 0.55;
      const bh = Math.max(2, peaks[i] * h * 0.88);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(x + (colW - barW) / 2, mid - bh / 2, barW, bh);
    }

    if (movable()) {
      const lw = Math.max(2, Math.round(w / 260));
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(x0, 0, x1 - x0, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillRect(x0, 0, lw * 2, h);
      ctx.fillRect(x1 - lw * 2, 0, lw * 2, h);
      ctx.fillRect(x0, 0, x1 - x0, lw);
      ctx.fillRect(x0, h - lw, x1 - x0, lw);
    }

    if (px >= 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - 1, 0, 2, h);
    }
  }

  function secAt(ev) {
    const r = canvas.getBoundingClientRect();
    const f = (ev.clientX - r.left) / Math.max(1, r.width);
    return Math.min(1, Math.max(0, f)) * total;
  }

   function moveTo(start) {
    const max = Math.max(0, total - clipLen);
    let s = start;
    if (handlers.snap) s = handlers.snap(s);
    clipStart = Math.min(max, Math.max(0, s));
    draw();
    if (handlers.onChange) handlers.onChange(clipStart);
  }
  canvas.addEventListener('pointerdown', (ev) => {
    if (!movable()) return;
    if (handlers.canDrag && !handlers.canDrag()) return;
    const t = secAt(ev);
    const inside = t >= clipStart && t <= clipStart + clipLen;
    drag = { grab: inside ? t - clipStart : clipLen / 2 };
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
    if (handlers.onDragStart) handlers.onDragStart();
    moveTo(t - drag.grab);
    ev.preventDefault();
  });

  canvas.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    moveTo(secAt(ev) - drag.grab);
  });

  function endDrag() {
    if (!drag) return;
    drag = null;
    if (handlers.onDragEnd) handlers.onDragEnd();
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  window.addEventListener('resize', () => {
    if (!peaks || !canvas.clientWidth) return;
    fit();
    draw();
  });

  return {
    setTrack(buffer, len) {
      total = buffer.duration;
      clipLen = Math.min(len, total);
      clipStart = 0;
      playhead = 0;
      peaks = computePeaks(buffer);
      fit();
      draw();
    },
    clear() {
      peaks = null;
      playhead = -1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    setPlayhead(sec) {
      playhead = sec;
      draw();
    },
        setStart(sec) {
      if (!peaks) return clipStart;
      moveTo(sec);
      return clipStart;
    },
    // Ставит рамку на самый громкий участок трека.
    findBest() {
      if (!peaks || !movable()) return clipStart;
      const win = Math.max(1, Math.round((clipLen / total) * PEAKS));
      const last = Math.max(0, PEAKS - win);
      const pre = new Float32Array(PEAKS + 1);
      for (let i = 0; i < PEAKS; i++) pre[i + 1] = pre[i] + peaks[i] * peaks[i];
      let bestI = 0;
      let bestV = -1;
      for (let i = 0; i <= last; i++) {
        const v = pre[Math.min(PEAKS, i + win)] - pre[i];
        if (v > bestV) {
          bestV = v;
          bestI = i;
        }
      }
      moveTo((bestI / PEAKS) * total);
      return clipStart;
    },
    getStart() {
      return clipStart;
    },
    refresh() {
      if (!peaks || !canvas.clientWidth) return;
      fit();
      draw();
    },
    setClipLen(len) {
      if (!peaks) return clipStart;
      clipLen = Math.min(len, total);
      const max = Math.max(0, total - clipLen);
      if (clipStart > max) clipStart = max;
      draw();
      return clipStart;
    }
  };
}