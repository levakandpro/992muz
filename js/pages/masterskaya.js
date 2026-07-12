// ===== 992MUZ - Мастерская: аудио конвертер =====
// MP3/WAV - всегда работает (Web Audio + lamejs, без wasm)
// FLAC/OGG/OPUS/M4A - только когда включена кросс-изоляция (после деплоя с COOP/COEP заголовками)
(function () {
  'use strict';

  var FORMATS = {
    mp3:  { label: 'MP3',  lossy: true,  mime: 'audio/mpeg', wasmOnly: false },
    wav:  { label: 'WAV',  lossy: false, mime: 'audio/wav',  wasmOnly: false },
    flac: { label: 'FLAC', lossy: false, mime: 'audio/flac', wasmOnly: true },
    ogg:  { label: 'OGG',  lossy: true,  mime: 'audio/ogg',  wasmOnly: true },
    opus: { label: 'OPUS', lossy: true,  mime: 'audio/opus', wasmOnly: true },
    m4a:  { label: 'M4A',  lossy: true,  mime: 'audio/mp4',  wasmOnly: true }
  };

  var dropzone      = document.getElementById('wsDropzone');
  var fileInput     = document.getElementById('wsFileInput');
  var targetSelect  = document.getElementById('wsTargetFormat');
  var bitrateGroup  = document.getElementById('wsBitrateGroup');
  var bitrateSelect = document.getElementById('wsBitrate');
  var convertAllBtn = document.getElementById('wsConvertAllBtn');
  var clearBtn      = document.getElementById('wsClearBtn');
  var queueEl       = document.getElementById('wsQueue');
  var emptyState    = document.getElementById('wsEmptyState');
  var engineStatus  = document.getElementById('wsEngineStatus');
  var reelLeft      = document.getElementById('wsReelLeft');
  var reelRight     = document.getElementById('wsReelRight');

  if (!dropzone) return; // не та страница

  var isIsolated = !!window.crossOriginIsolated; // true только после деплоя с COOP/COEP
  var queue = [];
  var idSeq = 0;
  var ffmpegInstance = null;
  var ffmpegLoadingPromise = null;
  var sharedAudioCtx = null;
  var isBusy = false;

  // ---------- helpers ----------
  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  }

  function getExt(name) {
    var m = /\.([a-z0-9]+)$/i.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  }

  function stripExt(name) {
    return (name || '').replace(/\.[a-z0-9]+$/i, '');
  }

  function buildOutputName(originalName, ext) {
    var base = stripExt(originalName).trim() || 'track';
    return '992muz_' + base + '.' + ext;
  }

  function setReels(spinning) {
    if (reelLeft) reelLeft.classList.toggle('spinning', spinning);
    if (reelRight) reelRight.classList.toggle('spinning', spinning);
  }

  function updateBitrateVisibility() {
    var fmt = FORMATS[targetSelect.value];
    bitrateGroup.style.display = fmt && fmt.lossy ? '' : 'none';
  }

  function refreshEmptyState() {
    var hasItems = queue.length > 0;
    queueEl.classList.toggle('has-items', hasItems);
    emptyState.style.display = hasItems ? 'none' : '';
    convertAllBtn.disabled = !hasItems || isBusy;
    clearBtn.disabled = !hasItems || isBusy;
  }

  function decorateFormatSelect(selectEl) {
    if (isIsolated || !selectEl) return;
    Array.prototype.forEach.call(selectEl.options, function (opt) {
      var fmt = FORMATS[opt.value];
      if (fmt && fmt.wasmOnly) {
        opt.disabled = true;
        if (opt.dataset.decorated !== '1') {
          opt.textContent = opt.textContent + ' (после деплоя)';
          opt.dataset.decorated = '1';
        }
      }
    });
  }

  // ---------- queue rendering ----------
  function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList).filter(function (f) {
      return f.type.indexOf('audio') === 0 || /\.(mp3|wav|flac|ogg|opus|m4a|aac|wma|webm)$/i.test(f.name);
    });
    files.forEach(function (file) {
      var item = {
        id: 'f' + (++idSeq),
        file: file,
        targetFormat: targetSelect.value,
        bitrate: bitrateSelect.value,
        status: 'idle'
      };
      queue.push(item);
      renderRow(item);
    });
    refreshEmptyState();
  }

  function renderRow(item) {
    var row = document.createElement('div');
    row.className = 'ws-track';
    row.dataset.id = item.id;

    var eqBars = '';
    for (var i = 0; i < 7; i++) eqBars += '<span></span>';

    var formatOptions = Object.keys(FORMATS).map(function (key) {
      var selected = key === item.targetFormat ? ' selected' : '';
      var label = FORMATS[key].label + (!isIsolated && FORMATS[key].wasmOnly ? ' (после деплоя)' : '');
      var disabled = (!isIsolated && FORMATS[key].wasmOnly) ? ' disabled' : '';
      return '<option value="' + key + '"' + selected + disabled + '>' + label + '</option>';
    }).join('');

    row.innerHTML =
      '<div class="ws-track-icon">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' +
      '</div>' +
      '<div class="ws-track-main">' +
        '<div class="ws-track-name" title="' + item.file.name + '">' + item.file.name + '</div>' +
        '<div class="ws-track-meta">' +
          '<span>' + fmtSize(item.file.size) + '</span>' +
          '<span class="ws-arrow">→</span>' +
          '<span class="ws-track-target-label">' + FORMATS[item.targetFormat].label + '</span>' +
        '</div>' +
        '<div class="ws-eq">' + eqBars + '</div>' +
      '</div>' +
      '<div class="ws-track-side">' +
        '<select class="ws-track-select ws-track-format">' + formatOptions + '</select>' +
        '<span class="ws-track-status">Ожидание</span>' +
        '<button class="ws-track-btn ws-track-convert" title="Конвертировать">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5,3 19,12 5,21"/></svg>' +
        '</button>' +
        '<button class="ws-track-btn ws-track-remove" title="Удалить">✕</button>' +
      '</div>';

    queueEl.appendChild(row);
    item.row = row;

    row.querySelector('.ws-track-format').addEventListener('change', function (e) {
      item.targetFormat = e.target.value;
      row.querySelector('.ws-track-target-label').textContent = FORMATS[item.targetFormat].label;
    });

    row.querySelector('.ws-track-convert').addEventListener('click', function () {
      convertOne(item);
    });

    row.querySelector('.ws-track-remove').addEventListener('click', function () {
      queue = queue.filter(function (q) { return q.id !== item.id; });
      row.remove();
      refreshEmptyState();
    });
  }

  function setRowStatus(item, statusClass, label) {
    item.status = statusClass;
    item.row.classList.remove('idle', 'loading', 'converting', 'done', 'error');
    item.row.classList.add(statusClass);
    item.row.querySelector('.ws-track-status').textContent = label;
  }

  // ---------- info banner ----------
  function showEngineStatus(text) {
    engineStatus.style.display = 'flex';
    engineStatus.innerHTML = '<span class="ws-dot"></span><span>' + text + '</span>';
  }
  function hideEngineStatus() {
    engineStatus.style.display = 'none';
  }

  // ---------- WebAudio + lamejs (MP3/WAV, всегда доступно) ----------
  function getAudioContext() {
    if (!sharedAudioCtx) sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return sharedAudioCtx;
  }

  function decodeFile(file) {
    return file.arrayBuffer().then(function (buf) {
      return getAudioContext().decodeAudioData(buf);
    });
  }

  function floatTo16BitPCM(input) {
    var output = new Int16Array(input.length);
    for (var i = 0; i < input.length; i++) {
      var s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }

  function encodeWavBlob(audioBuffer) {
    var numChannels = audioBuffer.numberOfChannels;
    var sampleRate = audioBuffer.sampleRate;
    var length = audioBuffer.length;
    var interleaved = new Float32Array(length * numChannels);
    for (var ch = 0; ch < numChannels; ch++) {
      var data = audioBuffer.getChannelData(ch);
      for (var i = 0; i < length; i++) interleaved[i * numChannels + ch] = data[i];
    }
    var pcm = floatTo16BitPCM(interleaved);
    var blockAlign = numChannels * 2;
    var byteRate = sampleRate * blockAlign;
    var dataSize = pcm.length * 2;
    var buffer = new ArrayBuffer(44 + dataSize);
    var view = new DataView(buffer);
    function writeStr(offset, str) { for (var i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); }
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);
    var offset = 44;
    for (var j = 0; j < pcm.length; j++, offset += 2) view.setInt16(offset, pcm[j], true);
    return new Blob([buffer], { type: 'audio/wav' });
  }

  function encodeMp3Blob(audioBuffer, bitrateKbps) {
    var numChannels = Math.min(audioBuffer.numberOfChannels, 2);
    var sampleRate = audioBuffer.sampleRate;
    var encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrateKbps || 192);
    var chunkSize = 1152;
    var mp3Data = [];

    var left = floatTo16BitPCM(audioBuffer.getChannelData(0));
    var right = numChannels > 1 ? floatTo16BitPCM(audioBuffer.getChannelData(1)) : null;

    for (var i = 0; i < left.length; i += chunkSize) {
      var leftChunk = left.subarray(i, i + chunkSize);
      var mp3buf;
      if (right) {
        var rightChunk = right.subarray(i, i + chunkSize);
        mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
      } else {
        mp3buf = encoder.encodeBuffer(leftChunk);
      }
      if (mp3buf.length > 0) mp3Data.push(new Int8Array(mp3buf));
    }
    var end = encoder.flush();
    if (end.length > 0) mp3Data.push(new Int8Array(end));

    return new Blob(mp3Data, { type: 'audio/mpeg' });
  }

  function convertViaWebAudio(item) {
    setRowStatus(item, 'converting', 'Кодируем…');
    return decodeFile(item.file).then(function (audioBuffer) {
      var blob = item.targetFormat === 'wav'
        ? encodeWavBlob(audioBuffer)
        : encodeMp3Blob(audioBuffer, parseInt(item.bitrate, 10));
      item.outputBlob = blob;
      item.outputName = buildOutputName(item.file.name, item.targetFormat);
    });
  }

  // ---------- ffmpeg.wasm (FLAC/OGG/OPUS/M4A, только после деплоя) ----------
  function getFFmpeg() {
    if (ffmpegInstance) return Promise.resolve(ffmpegInstance);
    if (ffmpegLoadingPromise) return ffmpegLoadingPromise;

    showEngineStatus('Загружаем движок для FLAC/OGG/OPUS/M4A - один раз, дальше быстро…');
    ffmpegLoadingPromise = new Promise(function (resolve, reject) {
      try {
        var createFFmpeg = window.FFmpeg.createFFmpeg;
        var inst = createFFmpeg({
          log: false,
          corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
        });
        inst.load().then(function () {
          ffmpegInstance = inst;
          hideEngineStatus();
          resolve(inst);
        }).catch(reject);
      } catch (err) {
        reject(err);
      }
    });
    return ffmpegLoadingPromise;
  }

  function buildArgs(inputName, outputName, item) {
    var fmt = item.targetFormat;
    var args = ['-i', inputName, '-vn'];
    if (fmt === 'ogg') args = args.concat(['-c:a', 'libvorbis', '-b:a', item.bitrate + 'k', outputName]);
    else if (fmt === 'opus') args = args.concat(['-c:a', 'libopus', '-b:a', item.bitrate + 'k', outputName]);
    else if (fmt === 'm4a') args = args.concat(['-c:a', 'aac', '-b:a', item.bitrate + 'k', outputName]);
    else args = args.concat(['-c:a', 'flac', outputName]); // flac
    return args;
  }

  function convertViaFFmpeg(item, sourceExt) {
    return getFFmpeg().then(function (ffmpeg) {
      var inputName = 'in_' + item.id + '.' + (sourceExt || 'bin');
      var outputName = 'out_' + item.id + '.' + item.targetFormat;
      setRowStatus(item, 'converting', 'Конвертация…');
      return window.FFmpeg.fetchFile(item.file).then(function (data) {
        ffmpeg.FS('writeFile', inputName, data);
        var args = buildArgs(inputName, outputName, item);
        return ffmpeg.run.apply(ffmpeg, args);
      }).then(function () {
        var outData = ffmpeg.FS('readFile', outputName);
        item.outputBlob = new Blob([outData.buffer], { type: FORMATS[item.targetFormat].mime });
        item.outputName = buildOutputName(item.file.name, item.targetFormat);
        try { ffmpeg.FS('unlink', inputName); } catch (e) {}
        try { ffmpeg.FS('unlink', outputName); } catch (e) {}
      });
    });
  }

  // ---------- shared flow ----------
  function triggerDownload(item) {
    var url = URL.createObjectURL(item.outputBlob);
    var a = document.createElement('a');
    a.href = url;
    a.download = item.outputName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function convertOne(item) {
    if (item.status === 'converting' || item.status === 'loading') return;
    var sourceExt = getExt(item.file.name);
    if (sourceExt === item.targetFormat) {
      setRowStatus(item, 'error', 'Уже такой формат');
      return;
    }

    var needsWasm = FORMATS[item.targetFormat].wasmOnly;
    if (needsWasm && !isIsolated) {
      setRowStatus(item, 'error', 'Нужен деплой');
      return;
    }

    setRowStatus(item, 'loading', 'Готовим…');
    setReels(true);

    var task = needsWasm ? convertViaFFmpeg(item, sourceExt) : convertViaWebAudio(item);

    return task.then(function () {
      setRowStatus(item, 'done', 'Готово ✓');
      triggerDownload(item);
    }).catch(function (err) {
      console.error('Ошибка конвертации:', err);
      setRowStatus(item, 'error', 'Ошибка');
    }).finally(function () {
      setReels(false);
    });
  }

  function convertAll() {
    if (isBusy || !queue.length) return;
    isBusy = true;
    refreshEmptyState();

    var pending = queue.filter(function (it) { return it.status !== 'done'; });
    var chain = Promise.resolve();
    pending.forEach(function (item) {
      chain = chain.then(function () { return convertOne(item); });
    });
    chain.finally(function () {
      isBusy = false;
      refreshEmptyState();
    });
  }

  // ---------- events ----------
  dropzone.addEventListener('click', function () { fileInput.click(); });
  dropzone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener('change', function (e) {
    addFiles(e.target.files);
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach(function (evt) {
    dropzone.addEventListener(evt, function (e) { e.preventDefault(); dropzone.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    dropzone.addEventListener(evt, function (e) { e.preventDefault(); dropzone.classList.remove('dragover'); });
  });
  dropzone.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });

  targetSelect.addEventListener('change', function () {
    updateBitrateVisibility();
    queue.forEach(function (item) {
      if (item.status === 'idle') {
        item.targetFormat = targetSelect.value;
        var sel = item.row.querySelector('.ws-track-format');
        if (sel) sel.value = targetSelect.value;
        item.row.querySelector('.ws-track-target-label').textContent = FORMATS[item.targetFormat].label;
      }
    });
  });
  bitrateSelect.addEventListener('change', function () {
    queue.forEach(function (item) { item.bitrate = bitrateSelect.value; });
  });

  convertAllBtn.addEventListener('click', convertAll);
  clearBtn.addEventListener('click', function () {
    queue = [];
    queueEl.innerHTML = '';
    refreshEmptyState();
  });

  decorateFormatSelect(targetSelect);
  if (!isIsolated) {
    showEngineStatus('Локальный режим: доступны MP3 и WAV. FLAC · OGG · OPUS · M4A включатся сами после деплоя на хостинг.');
  }

updateBitrateVisibility();
  refreshEmptyState();

  // ================= ОБРЕЗКА ТРЕКА (Trim) =================
  var trimDropzone      = document.getElementById('wsTrimDropzone');
  var trimFileInput     = document.getElementById('wsTrimFileInput');
  var trimEditor        = document.getElementById('wsTrimEditor');
  var trimNameEl        = document.getElementById('wsTrimName');
  var trimCanvasWrap    = document.getElementById('wsTrimCanvasWrap');
  var trimCanvas        = document.getElementById('wsTrimCanvas');
  var trimMaskLeft      = document.getElementById('wsTrimMaskLeft');
  var trimMaskRight     = document.getElementById('wsTrimMaskRight');
  var trimPlayhead      = document.getElementById('wsTrimPlayhead');
  var trimHandleStart   = document.getElementById('wsTrimHandleStart');
  var trimHandleEnd     = document.getElementById('wsTrimHandleEnd');
var trimSelectedLabel = document.getElementById('wsTrimSelectedLabel');
  var trimPlayBtn       = document.getElementById('wsTrimPlayBtn');
  var trimFormatSelect  = document.getElementById('wsTrimFormat');
  var trimDownloadBtn   = document.getElementById('wsTrimDownloadBtn');
  var trimResetBtn      = document.getElementById('wsTrimResetBtn');

  if (trimDropzone) {
    var trimAudioBuffer = null;
    var trimFile = null;
    var trimStart = 0;
    var trimEnd = 1;
    var trimDragTarget = null;
    var trimPlaySource = null;
    var trimPlayRAF = null;
    var trimPlayStartedAt = 0;
    var trimTheme = 'classic';
    var trimThemeBtns = document.querySelectorAll('.ws-trim-theme-btn');
    var trimStartInput = document.getElementById('wsTrimStartInput');
    var trimEndInput = document.getElementById('wsTrimEndInput');
    var trimFadeCheck = document.getElementById('wsTrimFadeCheck');
  var trimPresetBtns = document.querySelectorAll('.ws-trim-preset-btn');
    var trimSelectionEl = document.getElementById('wsTrimSelection');
    var trimDragOffset = 0;
    var trimIsDraggingSelection = false;
    var cachedPeaks = null;
    var cachedPeaksWidth = 0;
    var trimAnalyser = null;

    function fmtTime(sec) {
      if (!isFinite(sec) || sec < 0) sec = 0;
      var m = Math.floor(sec / 60);
      var s = Math.floor(sec % 60);
      return m + ':' + (s < 10 ? '0' : '') + s;
    }

    trimDropzone.addEventListener('click', function () { trimFileInput.click(); });
    trimDropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trimFileInput.click(); }
    });
    trimFileInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) loadTrimFile(e.target.files[0]);
      trimFileInput.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (evt) {
      trimDropzone.addEventListener(evt, function (e) { e.preventDefault(); trimDropzone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      trimDropzone.addEventListener(evt, function (e) { e.preventDefault(); trimDropzone.classList.remove('dragover'); });
    });
    trimDropzone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) loadTrimFile(e.dataTransfer.files[0]);
    });

    function loadTrimFile(file) {
      trimFile = file;
      trimNameEl.textContent = file.name + ' · ' + fmtSize(file.size);
      file.arrayBuffer().then(function (buf) {
        return getAudioContext().decodeAudioData(buf);
      }).then(function (audioBuffer) {
trimAudioBuffer = audioBuffer;
        trimStart = 0;
        trimEnd = 1;
        cachedPeaks = null;
        trimDropzone.style.display = 'none';
        trimEditor.style.display = '';
        drawWaveform();
        updateHandles();
      }).catch(function (err) {
        console.error('Не удалось прочитать аудио:', err);
        alert('Не удалось прочитать этот файл. Попробуй другой.');
      });
    }

function getPeaks(w) {
      if (cachedPeaks && cachedPeaksWidth === w) return cachedPeaks;
      var data = trimAudioBuffer.getChannelData(0);
      var step = Math.ceil(data.length / w);
      var peaks = [];
      for (var x = 0; x < w; x++) {
        var min = 1.0, max = -1.0;
        for (var i = 0; i < step; i++) {
          var idx = x * step + i;
          if (idx >= data.length) break;
          var v = data[idx];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        peaks.push([min, max]);
      }
      cachedPeaks = peaks;
      cachedPeaksWidth = w;
      return peaks;
    }

    function drawWaveform(scale) {
      scale = scale || 1;
      var dpr = window.devicePixelRatio || 1;
      var w = trimCanvasWrap.clientWidth;
      var h = trimCanvasWrap.clientHeight;
      trimCanvas.width = w * dpr;
      trimCanvas.height = h * dpr;
      var ctx = trimCanvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      var peaksRaw = getPeaks(w);
      var peaks = scale === 1 ? peaksRaw : peaksRaw.map(function (p) { return [p[0] * scale, p[1] * scale]; });
      var mid = h / 2;
      if (trimTheme === 'mirror') {
        ctx.fillStyle = '#e8a33d';
        for (var x = 0; x < w; x++) {
          var amp = Math.max(peaks[x][1], -peaks[x][0]) * mid * 0.9;
          ctx.fillRect(x, mid - amp, 1, amp);
          ctx.globalAlpha = 0.45;
          ctx.fillRect(x, mid, 1, amp);
          ctx.globalAlpha = 1;
        }
      } else if (trimTheme === 'neon') {
        ctx.strokeStyle = '#e8a33d';
        ctx.shadowColor = '#e8a33d';
        ctx.shadowBlur = 6;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (var x2 = 0; x2 < w; x2++) {
          var amp2 = peaks[x2][1] * mid * 0.9;
          var y = mid - amp2;
          if (x2 === 0) ctx.moveTo(x2, y); else ctx.lineTo(x2, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (trimTheme === 'blocks') {
        var blockW = 4;
        ctx.fillStyle = '#c0392b';
        for (var x3 = 0; x3 < w; x3 += blockW) {
          var min3 = 1, max3 = -1;
          for (var k = 0; k < blockW && x3 + k < w; k++) {
            min3 = Math.min(min3, peaks[x3 + k][0]);
            max3 = Math.max(max3, peaks[x3 + k][1]);
          }
          var barH3 = Math.max(2, (max3 - min3) * mid);
          ctx.fillRect(x3, mid - barH3 / 2, blockW - 1, barH3);
        }
      } else {
        ctx.fillStyle = '#8b1a2f';
        for (var x4 = 0; x4 < w; x4++) {
          var barH4 = Math.max(1, (peaks[x4][1] - peaks[x4][0]) * mid);
          ctx.fillRect(x4, mid - barH4 / 2, 1, barH4);
        }
      }
    }
    function updateHandles() {
      var w = trimCanvasWrap.clientWidth;
      var startPx = trimStart * w;
      var endPx = trimEnd * w;
trimHandleStart.style.left = startPx + 'px';
      trimHandleEnd.style.left = endPx + 'px';
      trimMaskLeft.style.width = startPx + 'px';
      trimMaskRight.style.width = (w - endPx) + 'px';
      trimSelectionEl.style.left = startPx + 'px';
      trimSelectionEl.style.width = (endPx - startPx) + 'px';

var dur = trimAudioBuffer.duration;
      trimStartInput.value = fmtTime(trimStart * dur);
      trimEndInput.value = fmtTime(trimEnd * dur);
      trimSelectedLabel.textContent = 'Фрагмент: ' + fmtTime((trimEnd - trimStart) * dur);
    }

    function posToRatio(clientX) {
      var rect = trimCanvasWrap.getBoundingClientRect();
      var ratio = (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(1, ratio));
    }

trimHandleStart.addEventListener('pointerdown', function (e) { e.preventDefault(); trimDragTarget = 'start'; });
    trimHandleEnd.addEventListener('pointerdown', function (e) { e.preventDefault(); trimDragTarget = 'end'; });

    trimSelectionEl.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      trimIsDraggingSelection = true;
      var ratio = posToRatio(e.clientX);
      trimDragOffset = ratio - trimStart;
    });

    window.addEventListener('pointermove', function (e) {
      if (!trimAudioBuffer) return;
      if (trimIsDraggingSelection) {
        var width = trimEnd - trimStart;
        var ratio2 = posToRatio(e.clientX) - trimDragOffset;
        ratio2 = Math.max(0, Math.min(ratio2, 1 - width));
        trimStart = ratio2;
        trimEnd = ratio2 + width;
        updateHandles();
        return;
      }
      if (!trimDragTarget) return;
      var ratio = posToRatio(e.clientX);
      if (trimDragTarget === 'start') {
        trimStart = Math.min(ratio, trimEnd - 0.01);
        if (trimStart < 0) trimStart = 0;
      } else {
        trimEnd = Math.max(ratio, trimStart + 0.01);
        if (trimEnd > 1) trimEnd = 1;
      }
      updateHandles();
    });
    window.addEventListener('pointerup', function () { trimDragTarget = null; trimIsDraggingSelection = false; });

window.addEventListener('resize', function () {
    var edCanvasEl = document.getElementById('wsEditorCanvas');
    if (edCanvasEl && edCanvasEl.parentElement) {
      var evt = new Event('ws-editor-reflow');
      edCanvasEl.dispatchEvent(evt);
    }
  });
    trimThemeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        trimThemeBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        trimTheme = btn.dataset.theme;
        if (trimAudioBuffer) drawWaveform();
      });
    });

    function parseTimeStr(str) {
      var parts = String(str).split(':');
      var sec = 0;
      if (parts.length === 2) sec = (parseInt(parts[0], 10) || 0) * 60 + (parseFloat(parts[1]) || 0);
      else sec = parseFloat(parts[0]) || 0;
      return sec;
    }

    trimStartInput.addEventListener('change', function () {
      if (!trimAudioBuffer) return;
      var sec = parseTimeStr(trimStartInput.value);
      var ratio = Math.max(0, Math.min(sec / trimAudioBuffer.duration, trimEnd - 0.01));
      trimStart = ratio;
      updateHandles();
    });
    trimEndInput.addEventListener('change', function () {
      if (!trimAudioBuffer) return;
      var sec = parseTimeStr(trimEndInput.value);
      var ratio = Math.min(1, Math.max(sec / trimAudioBuffer.duration, trimStart + 0.01));
      trimEnd = ratio;
      updateHandles();
    });

    trimPresetBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!trimAudioBuffer) return;
        var len = parseFloat(btn.dataset.len);
        var dur = trimAudioBuffer.duration;
        var newEndRatio = Math.min(1, trimStart + len / dur);
        trimEnd = newEndRatio;
        updateHandles();
      });
    });

    function applyFade(buffer) {
      if (!trimFadeCheck.checked) return buffer;
      var fadeSamples = Math.min(Math.floor(buffer.sampleRate * 0.03), Math.floor(buffer.length / 4));
      if (fadeSamples < 1) return buffer;
      for (var ch = 0; ch < buffer.numberOfChannels; ch++) {
        var data = buffer.getChannelData(ch);
        for (var i = 0; i < fadeSamples; i++) {
          var g = i / fadeSamples;
          data[i] *= g;
          data[data.length - 1 - i] *= g;
        }
      }
      return buffer;
    }
    function sliceBuffer(buffer, startRatio, endRatio) {
      var ctxA = getAudioContext();
      var startSample = Math.floor(startRatio * buffer.length);
      var endSample = Math.floor(endRatio * buffer.length);
      var frameCount = Math.max(1, endSample - startSample);
      var sliced = ctxA.createBuffer(buffer.numberOfChannels, frameCount, buffer.sampleRate);
      for (var ch = 0; ch < buffer.numberOfChannels; ch++) {
        var srcData = buffer.getChannelData(ch).subarray(startSample, endSample);
        sliced.copyToChannel(srcData, ch, 0);
      }
      return sliced;
    }

    trimPlayBtn.addEventListener('click', function () {
      if (!trimAudioBuffer) return;
if (trimPlaySource) {
        try { trimPlaySource.stop(); } catch (e) {}
        trimPlaySource = null;
        trimPlayhead.style.display = 'none';
        trimCanvasWrap.classList.remove('is-playing');
        if (trimPlayRAF) cancelAnimationFrame(trimPlayRAF);
        trimPlayBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Прослушать фрагмент';
        drawWaveform(1);
        return;
      }
var sliced = applyFade(sliceBuffer(trimAudioBuffer, trimStart, trimEnd));
      var ctxA = getAudioContext();
      var source = ctxA.createBufferSource();
      source.buffer = sliced;
      trimAnalyser = ctxA.createAnalyser();
      trimAnalyser.fftSize = 256;
      var freqData = new Uint8Array(trimAnalyser.frequencyBinCount);
      source.connect(trimAnalyser);
      trimAnalyser.connect(ctxA.destination);
      trimPlaySource = source;
      trimPlayStartedAt = ctxA.currentTime;
      trimPlayhead.style.display = '';
      trimCanvasWrap.classList.add('is-playing');
      trimPlayBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg> Остановить';

      function animate() {
        if (!trimPlaySource) return;
        var elapsed = ctxA.currentTime - trimPlayStartedAt;
        var ratio = trimStart + (elapsed / sliced.duration) * (trimEnd - trimStart);
        if (ratio >= trimEnd) return;
        trimPlayhead.style.left = (ratio * trimCanvasWrap.clientWidth) + 'px';

        trimAnalyser.getByteFrequencyData(freqData);
        var sum = 0;
        for (var i = 0; i < freqData.length; i++) sum += freqData[i];
        var avg = sum / freqData.length / 255;
        var scale = 1 + avg * 0.9;
        drawWaveform(scale);

        trimPlayRAF = requestAnimationFrame(animate);
      }
      trimPlayRAF = requestAnimationFrame(animate);

      source.onended = function () {
        trimPlaySource = null;
        trimPlayhead.style.display = 'none';
        trimCanvasWrap.classList.remove('is-playing');
        trimPlayBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Прослушать фрагмент';
        if (trimPlayRAF) cancelAnimationFrame(trimPlayRAF);
        drawWaveform(1);
      };
      source.start(0);
    });

trimDownloadBtn.addEventListener('click', function () {
      if (!trimAudioBuffer) return;
      var sliced = applyFade(sliceBuffer(trimAudioBuffer, trimStart, trimEnd));
      var fmt = trimFormatSelect.value;
      var blob = fmt === 'wav' ? encodeWavBlob(sliced) : encodeMp3Blob(sliced, 192);
      var name = buildOutputName(trimFile.name, fmt);
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    });

trimResetBtn.addEventListener('click', function () {
      if (trimPlaySource) { try { trimPlaySource.stop(); } catch (e) {} trimPlaySource = null; }
      trimAudioBuffer = null;
      trimFile = null;
      trimEditor.style.display = 'none';
      trimDropzone.style.display = '';
    });
  }

  // ================= ТЕГЕР МЕТАДАННЫХ (ID3) =================
  var id3Dropzone     = document.getElementById('wsId3Dropzone');
  var id3FileInput    = document.getElementById('wsId3FileInput');
  var id3Editor       = document.getElementById('wsId3Editor');
  var id3Cover        = document.getElementById('wsId3Cover');
  var id3CoverImg     = document.getElementById('wsId3CoverImg');
  var id3CoverPlaceholder = document.getElementById('wsId3CoverPlaceholder');
  var id3CoverInput   = document.getElementById('wsId3CoverInput');
  var id3CoverBtn     = document.getElementById('wsId3CoverBtn');
  var id3TitleInput   = document.getElementById('wsId3Title');
  var id3ArtistInput  = document.getElementById('wsId3Artist');
  var id3AlbumInput   = document.getElementById('wsId3Album');
  var id3YearInput    = document.getElementById('wsId3Year');
  var id3SaveBtn      = document.getElementById('wsId3SaveBtn');
  var id3ResetBtn     = document.getElementById('wsId3ResetBtn');

  if (id3Dropzone) {
    var id3File = null;
    var id3OriginalArrayBuffer = null;
    var id3CoverArrayBuffer = null;
    var id3CoverMime = null;

    id3Dropzone.addEventListener('click', function () { id3FileInput.click(); });
    id3Dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); id3FileInput.click(); }
    });
    id3FileInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) loadId3File(e.target.files[0]);
      id3FileInput.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (evt) {
      id3Dropzone.addEventListener(evt, function (e) { e.preventDefault(); id3Dropzone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      id3Dropzone.addEventListener(evt, function (e) { e.preventDefault(); id3Dropzone.classList.remove('dragover'); });
    });
    id3Dropzone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) loadId3File(e.dataTransfer.files[0]);
    });

    function resetCoverPreview() {
      id3CoverImg.style.display = 'none';
      id3CoverImg.src = '';
      id3CoverPlaceholder.style.display = '';
      id3CoverArrayBuffer = null;
      id3CoverMime = null;
    }

    function setCoverPreviewFromBytes(bytes, mime) {
      var blob = new Blob([bytes], { type: mime || 'image/jpeg' });
      var url = URL.createObjectURL(blob);
      id3CoverImg.src = url;
      id3CoverImg.style.display = '';
      id3CoverPlaceholder.style.display = 'none';
    }

    function loadId3File(file) {
      id3File = file;
      resetCoverPreview();
      id3TitleInput.value = '';
      id3ArtistInput.value = '';
      id3AlbumInput.value = '';
      id3YearInput.value = '';

      file.arrayBuffer().then(function (buf) {
        id3OriginalArrayBuffer = buf;
        id3Dropzone.style.display = 'none';
        id3Editor.style.display = 'flex';

        if (window.jsmediatags) {
          window.jsmediatags.read(file, {
            onSuccess: function (tag) {
              var t = tag.tags || {};
              id3TitleInput.value = t.title || '';
              id3ArtistInput.value = t.artist || '';
              id3AlbumInput.value = t.album || '';
              id3YearInput.value = t.year || '';
              if (t.picture) {
                var pic = t.picture;
                var bytes = new Uint8Array(pic.data);
                id3CoverArrayBuffer = bytes.buffer;
                id3CoverMime = pic.format;
                setCoverPreviewFromBytes(bytes, pic.format);
              }
            },
            onError: function () { /* тегов нет - просто оставляем поля пустыми */ }
          });
        }
      });
    }

    id3Cover.addEventListener('click', function () { id3CoverInput.click(); });
    id3CoverBtn.addEventListener('click', function () { id3CoverInput.click(); });
    id3CoverInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      file.arrayBuffer().then(function (buf) {
        id3CoverArrayBuffer = buf;
        id3CoverMime = file.type || 'image/jpeg';
        setCoverPreviewFromBytes(new Uint8Array(buf), id3CoverMime);
      });
      id3CoverInput.value = '';
    });

    id3SaveBtn.addEventListener('click', function () {
      if (!id3OriginalArrayBuffer || !window.ID3Writer) return;
      try {
        var writer = new ID3Writer(id3OriginalArrayBuffer.slice(0));
        if (id3TitleInput.value)  writer.setFrame('TIT2', id3TitleInput.value);
        if (id3ArtistInput.value) writer.setFrame('TPE1', [id3ArtistInput.value]);
        if (id3AlbumInput.value)  writer.setFrame('TALB', id3AlbumInput.value);
        if (id3YearInput.value)   writer.setFrame('TYER', id3YearInput.value);
        if (id3CoverArrayBuffer) {
          writer.setFrame('APIC', {
            type: 3,
            data: id3CoverArrayBuffer,
            description: 'Cover',
            mimeType: id3CoverMime || 'image/jpeg'
          });
        }
        writer.addTag();
        var blob = writer.getBlob();
        var outName = buildOutputName(id3File.name, 'mp3');
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = outName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      } catch (err) {
        console.error('Ошибка записи тегов:', err);
        alert('Не удалось записать теги в этот файл.');
      }
    });

id3ResetBtn.addEventListener('click', function () {
      id3File = null;
      id3OriginalArrayBuffer = null;
      resetCoverPreview();
      id3Editor.style.display = 'none';
      id3Dropzone.style.display = '';
    });
  }

  // ================= BPM & ТОНАЛЬНОСТЬ =================
  var bpmDropzone   = document.getElementById('wsBpmDropzone');
  var bpmFileInput  = document.getElementById('wsBpmFileInput');
  var bpmStatus     = document.getElementById('wsBpmStatus');
  var bpmResult     = document.getElementById('wsBpmResult');
  var bpmValueEl    = document.getElementById('wsBpmValue');
  var bpmKeyValueEl = document.getElementById('wsBpmKeyValue');
  var bpmResetBtn   = document.getElementById('wsBpmResetBtn');

  function fft(re, im) {
    var n = re.length;
    if (n <= 1) return;
    var half = n / 2;
    var evenRe = new Float32Array(half), evenIm = new Float32Array(half);
    var oddRe = new Float32Array(half), oddIm = new Float32Array(half);
    for (var i = 0; i < half; i++) {
      evenRe[i] = re[2 * i]; evenIm[i] = im[2 * i];
      oddRe[i] = re[2 * i + 1]; oddIm[i] = im[2 * i + 1];
    }
    fft(evenRe, evenIm);
    fft(oddRe, oddIm);
    for (var k = 0; k < half; k++) {
      var theta = -2 * Math.PI * k / n;
      var cosT = Math.cos(theta), sinT = Math.sin(theta);
      var tRe = cosT * oddRe[k] - sinT * oddIm[k];
      var tIm = sinT * oddRe[k] + cosT * oddIm[k];
      re[k] = evenRe[k] + tRe;
      im[k] = evenIm[k] + tIm;
      re[k + half] = evenRe[k] - tRe;
      im[k + half] = evenIm[k] - tIm;
    }
  }

  function detectBPM(buffer) {
    var sr = buffer.sampleRate;
    var data = buffer.getChannelData(0);
    var maxSamples = Math.min(data.length, sr * 60);
    var frameSize = 1024, hop = 512;
    var envelope = [];
    var prevEnergy = 0;
    for (var i = 0; i + frameSize < maxSamples; i += hop) {
      var sum = 0;
      for (var j = 0; j < frameSize; j++) { var v = data[i + j]; sum += v * v; }
      var energy = Math.sqrt(sum / frameSize);
      var diff = energy - prevEnergy;
      envelope.push(diff > 0 ? diff : 0);
      prevEnergy = energy;
    }
    var hopDuration = hop / sr;
    var minBPM = 70, maxBPM = 180;
    var minLag = Math.round(60 / maxBPM / hopDuration);
    var maxLag = Math.round(60 / minBPM / hopDuration);
    var bestLag = minLag, bestScore = -Infinity;
    for (var lag = minLag; lag <= maxLag; lag++) {
      var score = 0;
      for (var k = 0; k + lag < envelope.length; k++) score += envelope[k] * envelope[k + lag];
      if (score > bestScore) { bestScore = score; bestLag = lag; }
    }
    return Math.round(60 / (bestLag * hopDuration));
  }

  function detectKey(buffer) {
    var sr = buffer.sampleRate;
    var data = buffer.getChannelData(0);
    var fftSize = 4096, hop = 4096;
    var maxSamples = Math.min(data.length, sr * 30);
    var chroma = new Float32Array(12);
    var noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    for (var start = 0; start + fftSize < maxSamples; start += hop) {
      var re = new Float32Array(fftSize), im = new Float32Array(fftSize);
      for (var i = 0; i < fftSize; i++) {
        var w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (fftSize - 1));
        re[i] = data[start + i] * w;
      }
      fft(re, im);
      for (var bin = 1; bin < fftSize / 2; bin++) {
        var freq = bin * sr / fftSize;
        if (freq < 60 || freq > 5000) continue;
        var mag = Math.sqrt(re[bin] * re[bin] + im[bin] * im[bin]);
        var midi = 69 + 12 * Math.log2(freq / 440);
        var pc = ((Math.round(midi) % 12) + 12) % 12;
        chroma[pc] += mag;
      }
    }
    var maxC = 0;
    for (var c = 0; c < 12; c++) if (chroma[c] > maxC) maxC = chroma[c];
    if (maxC > 0) for (var c2 = 0; c2 < 12; c2++) chroma[c2] /= maxC;

    var majorProfile = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
    var minorProfile = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

    function correlate(profile, tonic) {
      var sum = 0;
      for (var i = 0; i < 12; i++) sum += chroma[i] * profile[((i - tonic) % 12 + 12) % 12];
      return sum;
    }

    var bestScore = -Infinity, bestKey = 'C', bestMode = 'мажор';
    for (var s = 0; s < 12; s++) {
      var majorScore = correlate(majorProfile, s);
      var minorScore = correlate(minorProfile, s);
      if (majorScore > bestScore) { bestScore = majorScore; bestKey = noteNames[s]; bestMode = 'мажор'; }
      if (minorScore > bestScore) { bestScore = minorScore; bestKey = noteNames[s]; bestMode = 'минор'; }
    }
    return bestKey + ' ' + bestMode;
  }

  if (bpmDropzone) {
    bpmDropzone.addEventListener('click', function () { bpmFileInput.click(); });
    bpmDropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bpmFileInput.click(); }
    });
    bpmFileInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) analyzeBpmFile(e.target.files[0]);
      bpmFileInput.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (evt) {
      bpmDropzone.addEventListener(evt, function (e) { e.preventDefault(); bpmDropzone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      bpmDropzone.addEventListener(evt, function (e) { e.preventDefault(); bpmDropzone.classList.remove('dragover'); });
    });
    bpmDropzone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) analyzeBpmFile(e.dataTransfer.files[0]);
    });

    function analyzeBpmFile(file) {
      bpmStatus.style.display = 'flex';
      bpmStatus.innerHTML = '<span class="ws-dot"></span><span>Анализируем трек…</span>';
      bpmDropzone.style.display = 'none';
      file.arrayBuffer().then(function (buf) {
        return getAudioContext().decodeAudioData(buf);
      }).then(function (audioBuffer) {
        setTimeout(function () {
          var bpm = detectBPM(audioBuffer);
          var key = detectKey(audioBuffer);
          bpmValueEl.textContent = bpm;
          bpmKeyValueEl.textContent = key;
          bpmStatus.style.display = 'none';
          bpmResult.style.display = 'flex';
        }, 30);
      }).catch(function (err) {
        console.error('Ошибка анализа:', err);
        bpmStatus.innerHTML = '<span>Не удалось прочитать файл.</span>';
      });
    }

    bpmResetBtn.addEventListener('click', function () {
      bpmResult.style.display = 'none';
      bpmDropzone.style.display = '';
    });
  }

 // ================= QR-КОД =================
  var qrTextInput    = document.getElementById('wsQrText');
  var qrSizeSelect   = document.getElementById('wsQrSize');
  var qrDesignSelect = document.getElementById('wsQrDesign');
var qrColorPicker  = document.getElementById('wsQrColorPicker');
  var qrSwatches     = document.querySelectorAll('.ws-qr-swatch[data-color]');
  var qrGenerateBtn  = document.getElementById('wsQrGenerateBtn');
  var qrDownloadBtn  = document.getElementById('wsQrDownloadBtn');
  var qrPreview      = document.getElementById('wsQrPreview');

if (qrGenerateBtn) {
    var qrHasGenerated = false;

    function drawLogoOnCanvas(canvas) {
      return new Promise(function (resolve) {
        var ctx = canvas.getContext('2d');
        var logo = new Image();
        logo.crossOrigin = 'anonymous';
        logo.onload = function () {
          var size = canvas.width;
          var logoSize = size * 0.22;
          var cx = size / 2, cy = size / 2;
          var pad = logoSize * 0.16;

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cx, cy, logoSize / 2 + pad, 0, Math.PI * 2);
          ctx.fill();

          var dx = cx - logoSize / 2;
          var dy = cy - logoSize / 2;
          ctx.drawImage(logo, dx, dy, logoSize, logoSize);
          resolve();
        };
        logo.onerror = function () { resolve(); };
        logo.src = 'assets/png/red.png';
      });
    }

    function generateQR() {
      var text = qrTextInput.value.trim();
      if (!text) { alert('Введите ссылку или текст для QR-кода.'); return; }
      var size = parseInt(qrSizeSelect.value, 10);
      var color = qrColorPicker.value;
      var design = qrDesignSelect.value;

      qrPreview.className = 'ws-qr-preview design-' + design;
      qrPreview.innerHTML = '';

      new QRCode(qrPreview, {
        text: text,
        width: size,
        height: size,
        colorDark: color,
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });

      setTimeout(function () {
        var canvas = qrPreview.querySelector('canvas');
        var img = qrPreview.querySelector('img');
        if (!canvas) { qrDownloadBtn.disabled = false; return; }
        drawLogoOnCanvas(canvas).then(function () {
          var dataUrl = canvas.toDataURL('image/png');
          if (img) img.src = dataUrl;
          qrPreview.dataset.finalUrl = dataUrl;
          qrDownloadBtn.disabled = false;
          qrHasGenerated = true;
        });
      }, 50);
    }

    qrSwatches.forEach(function (btn) {
      btn.addEventListener('click', function () {
        qrColorPicker.value = btn.dataset.color;
        qrSwatches.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        if (qrHasGenerated) generateQR();
      });
    });

    qrColorPicker.addEventListener('input', function () {
      qrSwatches.forEach(function (b) { b.classList.remove('active'); });
      if (qrHasGenerated) generateQR();
    });

    qrSizeSelect.addEventListener('change', function () {
      if (qrHasGenerated) generateQR();
    });
    qrDesignSelect.addEventListener('change', function () {
      if (qrHasGenerated) generateQR();
    });

    qrGenerateBtn.addEventListener('click', generateQR);

    qrDownloadBtn.addEventListener('click', function () {
      var url = qrPreview.dataset.finalUrl;
      if (!url) return;
      var a = document.createElement('a');
      a.href = url;
      a.download = '992muz_qrcode.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }
  // ================= ВЫРАВНИВАНИЕ ГРОМКОСТИ =================
  var normDropzone   = document.getElementById('wsNormDropzone');
  var normFileInput  = document.getElementById('wsNormFileInput');
  var normTargetSel  = document.getElementById('wsNormTarget');
  var normFormatSel  = document.getElementById('wsNormFormat');
  var normAllBtn     = document.getElementById('wsNormAllBtn');
  var normClearBtn   = document.getElementById('wsNormClearBtn');
  var normQueueEl    = document.getElementById('wsNormQueue');
  var normEmptyState = document.getElementById('wsNormEmptyState');

  if (normDropzone) {
    var normQueue = [];
    var normIdSeq = 0;
    var normBusy = false;

    function normRefreshEmpty() {
      var hasItems = normQueue.length > 0;
      normQueueEl.classList.toggle('has-items', hasItems);
      normEmptyState.style.display = hasItems ? 'none' : '';
      normAllBtn.disabled = !hasItems || normBusy;
      normClearBtn.disabled = !hasItems || normBusy;
    }

    normDropzone.addEventListener('click', function () { normFileInput.click(); });
    normDropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); normFileInput.click(); }
    });
    normFileInput.addEventListener('change', function (e) {
      normAddFiles(e.target.files);
      normFileInput.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (evt) {
      normDropzone.addEventListener(evt, function (e) { e.preventDefault(); normDropzone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      normDropzone.addEventListener(evt, function (e) { e.preventDefault(); normDropzone.classList.remove('dragover'); });
    });
    normDropzone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) normAddFiles(e.dataTransfer.files);
    });

    function normAddFiles(fileList) {
      var files = Array.prototype.slice.call(fileList).filter(function (f) {
        return f.type.indexOf('audio') === 0 || /\.(mp3|wav|flac|ogg|opus|m4a|aac)$/i.test(f.name);
      });
      files.forEach(function (file) {
        var item = { id: 'n' + (++normIdSeq), file: file, status: 'idle' };
        normQueue.push(item);
        normRenderRow(item);
      });
      normRefreshEmpty();
    }

    function normRenderRow(item) {
      var row = document.createElement('div');
      row.className = 'ws-track';
      row.dataset.id = item.id;
      var eqBars = '';
      for (var i = 0; i < 7; i++) eqBars += '<span></span>';
      row.innerHTML =
        '<div class="ws-track-icon">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' +
        '</div>' +
        '<div class="ws-track-main">' +
          '<div class="ws-track-name" title="' + item.file.name + '">' + item.file.name + '</div>' +
          '<div class="ws-track-meta"><span>' + fmtSize(item.file.size) + '</span></div>' +
          '<div class="ws-eq">' + eqBars + '</div>' +
        '</div>' +
        '<div class="ws-track-side">' +
          '<span class="ws-track-status">Ожидание</span>' +
          '<button class="ws-track-btn ws-track-remove" title="Удалить">✕</button>' +
        '</div>';
      normQueueEl.appendChild(row);
      item.row = row;
      row.querySelector('.ws-track-remove').addEventListener('click', function () {
        normQueue = normQueue.filter(function (q) { return q.id !== item.id; });
        row.remove();
        normRefreshEmpty();
      });
    }

    function normSetStatus(item, cls, label) {
      item.status = cls;
      item.row.classList.remove('idle', 'converting', 'done', 'error');
      item.row.classList.add(cls);
      item.row.querySelector('.ws-track-status').textContent = label;
    }

    function computeRMS(buffer) {
      var data = buffer.getChannelData(0);
      var sum = 0;
      for (var i = 0; i < data.length; i++) sum += data[i] * data[i];
      return Math.sqrt(sum / data.length);
    }

    function applyGain(buffer, gain) {
      for (var ch = 0; ch < buffer.numberOfChannels; ch++) {
        var data = buffer.getChannelData(ch);
        for (var i = 0; i < data.length; i++) data[i] = Math.max(-1, Math.min(1, data[i] * gain));
      }
      return buffer;
    }

    function normalizeOne(item) {
      normSetStatus(item, 'converting', 'Анализ…');
      return item.file.arrayBuffer().then(function (buf) {
        return getAudioContext().decodeAudioData(buf);
      }).then(function (audioBuffer) {
        var rms = computeRMS(audioBuffer);
        var targetRms = Math.pow(10, parseFloat(normTargetSel.value) / 20);
        var gain = rms > 0 ? Math.min(targetRms / rms, 8) : 1;
        applyGain(audioBuffer, gain);
        var fmt = normFormatSel.value;
        var blob = fmt === 'wav' ? encodeWavBlob(audioBuffer) : encodeMp3Blob(audioBuffer, 192);
        var name = buildOutputName(item.file.name, fmt);
        normSetStatus(item, 'done', 'Готово ✓');
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      }).catch(function (err) {
        console.error('Ошибка выравнивания:', err);
        normSetStatus(item, 'error', 'Ошибка');
      });
    }

    normAllBtn.addEventListener('click', function () {
      if (normBusy || !normQueue.length) return;
      normBusy = true;
      normRefreshEmpty();
      var chain = Promise.resolve();
      normQueue.forEach(function (item) {
        chain = chain.then(function () { return normalizeOne(item); });
      });
      chain.finally(function () {
        normBusy = false;
        normRefreshEmpty();
      });
    });

normClearBtn.addEventListener('click', function () {
      normQueue = [];
      normQueueEl.innerHTML = '';
      normRefreshEmpty();
    });
  }

  // ================= ФОТОРЕДАКТОР ОБЛОЖЕК =================
  var edCanvas       = document.getElementById('wsEditorCanvas');
  var edFormatBtns   = document.querySelectorAll('.ws-editor-format-btn');
  var edBgInput      = document.getElementById('wsEditorBgInput');
  var edBgBtn        = document.getElementById('wsEditorBgBtn');
  var edPhotoInput   = document.getElementById('wsEditorPhotoInput');
  var edPhotoBtn     = document.getElementById('wsEditorPhotoBtn');
  var edTextBtn      = document.getElementById('wsEditorTextBtn');
  var edStickerBtn   = document.getElementById('wsEditorStickerBtn');
  var edStickerPopup = document.getElementById('wsEditorStickerPopup');
  var edLayersEl     = document.getElementById('wsEditorLayers');
  var edProps        = document.getElementById('wsEditorProps');
  var edPropsText    = document.getElementById('wsEditorPropsText');
var edTextContent  = document.getElementById('wsEditorTextContent');
  var edFontSelect   = document.getElementById('wsEditorFontSelect');
  var edFontBtn      = document.getElementById('wsEditorFontBtn');
  var edFontPopup    = document.getElementById('wsEditorFontPopup');
  var edFontList     = document.getElementById('wsEditorFontList');
  var edColorInput   = document.getElementById('wsEditorColorInput');
var edOpacityRange = document.getElementById('wsEditorOpacityRange');
  var edOpacityValueEl = document.getElementById('wsEditorOpacityValue');
  var edBoldBtn = document.getElementById('wsEditorBoldBtn');
  var edItalicBtn = document.getElementById('wsEditorItalicBtn');
  var edUnderlineBtn = document.getElementById('wsEditorUnderlineBtn');
  var edStrikeBtn = document.getElementById('wsEditorStrikeBtn');
  var edAlignBtns = document.querySelectorAll('.ws-fmt-align');
  var edAnchorBtns = document.querySelectorAll('.ws-fmt-anchor');
  var edLetterSpacingRange = document.getElementById('wsEditorLetterSpacingRange');
  var edLetterSpacingValueEl = document.getElementById('wsEditorLetterSpacingValue');
var edLineHeightRange = document.getElementById('wsEditorLineHeightRange');
  var edLineHeightValueEl = document.getElementById('wsEditorLineHeightValue');
var edFloorTiltRange = document.getElementById('wsEditorFloorTiltRange');
  var edFloorTiltValueEl = document.getElementById('wsEditorFloorTiltValue');
  var edWallTiltRange = document.getElementById('wsEditorWallTiltRange');
  var edWallTiltValueEl = document.getElementById('wsEditorWallTiltValue');
  var edGroupLight = document.getElementById('wsEditorGroupLight');
  var edGroupColor = document.getElementById('wsEditorGroupColor');
  var edGroupTexture = document.getElementById('wsEditorGroupTexture');
  var edBrightnessRange  = document.getElementById('wsEditorBrightnessRange');
  var edBrightnessValueEl = document.getElementById('wsEditorBrightnessValue');
  var edContrastRange = document.getElementById('wsEditorContrastRange');
  var edContrastValueEl = document.getElementById('wsEditorContrastValue');
  var edSaturationRange = document.getElementById('wsEditorSaturationRange');
  var edSaturationValueEl = document.getElementById('wsEditorSaturationValue');
  var edWarmthRange = document.getElementById('wsEditorWarmthRange');
  var edWarmthValueEl = document.getElementById('wsEditorWarmthValue');
  var edSharpenRange = document.getElementById('wsEditorSharpenRange');
  var edSharpenValueEl = document.getElementById('wsEditorSharpenValue');
  var edVignetteRange = document.getElementById('wsEditorVignetteRange');
  var edVignetteValueEl = document.getElementById('wsEditorVignetteValue');
  var edShadowToggle     = document.getElementById('wsEditorShadowToggle');
  var edShadowColor      = document.getElementById('wsEditorShadowColor');
  var edShadowBlur       = document.getElementById('wsEditorShadowBlur');
var edOutlineToggle    = document.getElementById('wsEditorOutlineToggle');
  var edOutlineColor     = document.getElementById('wsEditorOutlineColor');
  var edOutlineWidth     = document.getElementById('wsEditorOutlineWidth');
  var edGlowToggle       = document.getElementById('wsEditorGlowToggle');
  var edGlowColor        = document.getElementById('wsEditorGlowColor');
  var edGlowBlur         = document.getElementById('wsEditorGlowBlur');
  var edExportPng    = document.getElementById('wsEditorExportPng');
  var edExportJpg    = document.getElementById('wsEditorExportJpg');

  if (edCanvas) {
    var edCtx = edCanvas.getContext('2d');
    var edW = 1080, edH = 1080;
var edLayers = [];
    var edSelectedId = null;
    var edIdSeq = 0;
    var edDrag = null;
    var edPerspectiveCanvas = document.createElement('canvas');
    var edPerspectiveCtx = edPerspectiveCanvas.getContext('2d');
edCanvas.width = edW;
    edCanvas.height = edH;

    var edSidebarEl = document.querySelector('.ws-editor-sidebar');
    var edCanvasColEl = document.querySelector('.ws-editor-canvas-col');

function edSyncSidebarHeight() {
      if (!edSidebarEl || !edCanvasColEl) return;
      if (window.innerWidth <= 900) {
        edSidebarEl.style.height = '';
        return;
      }
      var h = edCanvasColEl.getBoundingClientRect().height;
      if (h > 0) edSidebarEl.style.height = h + 'px';
    }

    window.addEventListener('resize', edSyncSidebarHeight);
    if (window.ResizeObserver && edCanvasColEl) {
      new ResizeObserver(edSyncSidebarHeight).observe(edCanvasColEl);
    }
    setTimeout(edSyncSidebarHeight, 50);

    var edSelOverlay = document.getElementById('wsEditorSelOverlay');
    var edSelDelBtn  = document.getElementById('wsEditorSelDel');
    var edSelDupBtn  = document.getElementById('wsEditorSelDup');
    var edCornerDrag = null;

    edFormatBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (edLayers.length && !confirm('Смена формата очистит текущую обложку. Продолжить?')) return;
        edFormatBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        edW = parseInt(btn.dataset.w, 10);
        edH = parseInt(btn.dataset.h, 10);
        edCanvas.width = edW;
        edCanvas.height = edH;
        edLayers = [];
        edSelectedId = null;
        edRender();
        edRenderLayerList();
        edUpdateProps();
      });
    });

function edNewLayerBase() {
      return { id: 'l' + (++edIdSeq), x: edW / 2, y: edH / 2, scale: 1, opacity: 1, brightness: 0, contrastVal: 0, saturation: 0, warmth: 0, sharpen: 0, vignette: 0 };
    }

    function edAddImageLayer(file, asBackground) {
      var reader = new FileReader();
      reader.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          var layer = edNewLayerBase();
          layer.type = 'image';
          layer.img = img;
          if (asBackground) {
            layer.scale = Math.max(edW / img.width, edH / img.height);
            edLayers.unshift(layer);
          } else {
            layer.scale = Math.min(edW * 0.6 / img.width, edH * 0.6 / img.height);
            edLayers.push(layer);
          }
          edSelectedId = layer.id;
          edRender();
          edRenderLayerList();
          edUpdateProps();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }

    edBgBtn.addEventListener('click', function () { edBgInput.click(); });
    edBgInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) edAddImageLayer(e.target.files[0], true);
      edBgInput.value = '';
    });
    edPhotoBtn.addEventListener('click', function () { edPhotoInput.click(); });
    edPhotoInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) edAddImageLayer(e.target.files[0], false);
      edPhotoInput.value = '';
    });

function edAddTextLayer(content, sizeMult) {
      var layer = edNewLayerBase();
      layer.type = 'text';
      layer.text = content;
      layer.font = "'Unbounded', sans-serif";
      layer.color = '#ffffff';
      layer.baseSize = edW * (sizeMult || 0.08);
      layer.shadowEnabled = false;
      layer.shadowColor = '#000000';
      layer.shadowBlur = 8;
layer.outlineEnabled = false;
      layer.outlineColor = '#000000';
      layer.outlineWidth = 4;
layer.effect = 'none';
      layer.curved = false;
      layer.bgColor = '#7c3aed';
      layer.bgPadding = 0.35;
      layer.shadowOffsetX = 4;
      layer.shadowOffsetY = 4;
layer.glowEnabled = false;
      layer.glowColor = '#e8a33d';
      layer.glowBlur = 16;
      layer.bold = false;
      layer.italic = false;
      layer.underline = false;
      layer.strike = false;
      layer.align = 'center';
      layer.letterSpacing = 0;
      layer.lineHeight = 1.2;
layer.vAnchor = 'middle';
      layer.perspectiveFloor = 0;
      layer.perspectiveWall = 0;
      edLayers.push(layer);
      edSelectedId = layer.id;
      edRender();
      edRenderLayerList();
      edUpdateProps();
    }

    edTextBtn.addEventListener('click', function () { edAddTextLayer('Текст', 0.08); });

var ADVISORY_FILES = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17,18].map(function (n) {
      return '1 (' + n + ').png';
    });
    var RAPICONZ_FILES = [];
    for (var rn = 1; rn <= 62; rn++) RAPICONZ_FILES.push('1 (' + rn + ').png');

    function edAddImageStickerLayer(url) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        var layer = edNewLayerBase();
        layer.type = 'image';
        layer.img = img;
        layer.scale = Math.min(edW * 0.3 / img.width, edH * 0.3 / img.height);
        edLayers.push(layer);
        edSelectedId = layer.id;
        edRender();
        edRenderLayerList();
        edUpdateProps();
      };
      img.src = url;
    }

var edStickerHoldTimer = null;
    var edStickerHoldBtn = null;
    var edStickerHOLD_DELAY = 280;

    function edStickerClearHold() {
      if (edStickerHoldTimer) { clearTimeout(edStickerHoldTimer); edStickerHoldTimer = null; }
      if (edStickerHoldBtn) { edStickerHoldBtn.classList.remove('is-holding'); edStickerHoldBtn = null; }
    }

    function edBuildStickerGrid(container, folder, files) {
      container.innerHTML = '';
      files.forEach(function (filename) {
        var url = 'assets/images/' + folder + '/' + encodeURIComponent(filename);
        var btn = document.createElement('button');
        var thumb = document.createElement('img');
        thumb.src = url;
        thumb.alt = '';
        btn.appendChild(thumb);

        btn.addEventListener('pointerdown', function () {
          edStickerClearHold();
          edStickerHoldBtn = btn;
          edStickerHoldTimer = setTimeout(function () {
            btn.classList.add('is-holding');
          }, edStickerHOLD_DELAY);
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (evt) {
          btn.addEventListener(evt, function () {
            if (edStickerHoldBtn === btn) edStickerClearHold();
          });
        });

        btn.addEventListener('click', function () {
          edStickerClearHold();
          edAddImageStickerLayer(url);
          edStickerPopup.style.display = 'none';
        });
        container.appendChild(btn);
      });
    }

var edStickerGridAdvisory  = document.getElementById('wsEditorStickerGridAdvisory');
    var edStickerGridRapiconz  = document.getElementById('wsEditorStickerGridRapiconz');
    var edStickerBuilt = false;

    edStickerBtn.addEventListener('click', function () {
      var opening = edStickerPopup.style.display === 'none';
      edStickerPopup.style.display = opening ? 'block' : 'none';
      if (opening && !edStickerBuilt) {
        edBuildStickerGrid(edStickerGridAdvisory, 'advisory', ADVISORY_FILES);
        edBuildStickerGrid(edStickerGridRapiconz, 'rapiconz', RAPICONZ_FILES);
        edStickerBuilt = true;
      }
    });
    var EDITOR_EFFECTS = [
      { key: 'none', label: 'Обычный' },
      { key: 'shadow', label: 'Падающая тень' },
      { key: 'glow', label: 'Подсветка' },
      { key: 'echo', label: 'Эхо' },
      { key: 'outline', label: 'С контуром' },
      { key: 'background', label: 'Фон' },
      { key: 'overlap', label: 'Совмещение' },
      { key: 'contour', label: 'Контур' },
      { key: 'neon', label: 'Неон' },
      { key: 'distort', label: 'Искажение' }
    ];

    function edApplyTextEffect(layer, key) {
      if (!layer || layer.type !== 'text') return;
      layer.effect = key;
      edRender();
      edRenderLayerList();
      edSyncEffectButtons();
    }

function edBuildEffectsGrid(container) {
      if (!container) return;
      container.innerHTML = '';
      EDITOR_EFFECTS.forEach(function (fx) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ws-fx-btn ws-fx-' + fx.key;
        btn.dataset.effect = fx.key;
        btn.innerHTML = '<span class="ws-fx-preview">Ag</span><span class="ws-fx-name">' + fx.label + '</span>';
        btn.addEventListener('click', function () {
          edApplyTextEffect(edGetLayer(edSelectedId), fx.key);
        });
        container.appendChild(btn);
      });
    }

function edSyncEffectButtons() {
      var layer = edGetLayer(edSelectedId);
      var effectKey = layer && layer.type === 'text' ? (layer.effect || 'none') : 'none';
      document.querySelectorAll('.ws-fx-btn[data-effect]').forEach(function (b) {
        b.classList.toggle('active', b.dataset.effect === effectKey);
      });
    }
    var edEffectsBtn = document.getElementById('wsEditorEffectsBtn');
    var edEffectsPopup = document.getElementById('wsEditorEffectsPopup');
    var edEffectsGrid = document.getElementById('wsEditorEffectsGrid');
    var edPropsEffectsGrid = document.getElementById('wsEditorPropsEffectsGrid');

    edBuildEffectsGrid(edEffectsGrid);
    edBuildEffectsGrid(edPropsEffectsGrid);

    if (edEffectsBtn) {
      edEffectsBtn.addEventListener('click', function () {
        edEffectsPopup.style.display = (edEffectsPopup.style.display === 'none') ? 'block' : 'none';
        edSyncEffectButtons();
      });
    }
    function edGetLayer(id) {
      return edLayers.filter(function (l) { return l.id === id; })[0];
    }

function edGetFontString(layer, size) {
      var weight = layer.bold ? '800' : '400';
      var style = layer.italic ? 'italic' : 'normal';
      return style + ' ' + weight + ' ' + size + 'px ' + layer.font;
    }

    function edMeasureLine(ctx, text, letterSpacing) {
      if (!text) return 0;
      if (!letterSpacing) return ctx.measureText(text).width;
      var total = 0;
      for (var i = 0; i < text.length; i++) {
        total += ctx.measureText(text[i]).width;
        if (i < text.length - 1) total += letterSpacing;
      }
      return total;
    }

    function edDrawLineSpaced(ctx, text, startX, y, letterSpacing, mode, color, outlineWidthVal) {
      var x = startX;
      for (var i = 0; i < text.length; i++) {
        var ch = text[i];
        if (mode === 'stroke') {
          ctx.lineWidth = outlineWidthVal;
          ctx.strokeStyle = color;
          ctx.strokeText(ch, x, y);
        } else {
          ctx.fillStyle = color;
          ctx.fillText(ch, x, y);
        }
        x += ctx.measureText(ch).width + letterSpacing;
      }
    }

    function edLayerBounds(layer) {
      if (layer.type === 'image') {
        var w = layer.img.width * layer.scale;
        var h = layer.img.height * layer.scale;
        return { x: layer.x - w / 2, y: layer.y - h / 2, w: w, h: h };
      } else {
        var size = layer.baseSize * layer.scale;
        edCtx.font = edGetFontString(layer, size);
        var lines = (layer.text || '').split('\n');
        if (!lines.length) lines = [''];
        var letterSpacing = layer.letterSpacing || 0;
        var widths = lines.map(function (l) { return edMeasureLine(edCtx, l, letterSpacing); });
        var maxW = Math.max.apply(null, widths.concat([0]));
        var lh = size * (layer.lineHeight != null ? layer.lineHeight : 1.2);
        var totalH = lh * lines.length;
        return { x: layer.x - maxW / 2, y: layer.y - totalH / 2, w: maxW, h: totalH };
      }
    }
function edGetFlatTextCanvas(layer, bw, bh, cacheKey) {
      if (layer._pCache && layer._pCache.key === cacheKey) return layer._pCache.canvas;

      edPerspectiveCanvas.width = bw;
      edPerspectiveCanvas.height = bh;
      edPerspectiveCtx.clearRect(0, 0, bw, bh);

      var savedCtx = edCtx;
      var savedX = layer.x, savedY = layer.y, savedFloor = layer.perspectiveFloor, savedWall = layer.perspectiveWall, savedOpacity = layer.opacity;
      edCtx = edPerspectiveCtx;
      layer.perspectiveFloor = 0;
      layer.perspectiveWall = 0;
      layer.opacity = 1;
      layer.x = bw / 2;
      layer.y = bh / 2;
      edDrawTextLayer(layer);
      layer.x = savedX; layer.y = savedY; layer.perspectiveFloor = savedFloor; layer.perspectiveWall = savedWall; layer.opacity = savedOpacity;
      edCtx = savedCtx;

      var texCanvas = document.createElement('canvas');
      texCanvas.width = bw;
      texCanvas.height = bh;
      texCanvas.getContext('2d').drawImage(edPerspectiveCanvas, 0, 0);
      layer._pCache = { key: cacheKey, canvas: texCanvas };
      return texCanvas;
    }

function edApplyFloorTilt(srcCanvas, srcW, srcH, floorVal, textTop, textBottom) {
      if (!floorVal) return { canvas: srcCanvas, w: srcW, h: srcH };
      // Нижний край (ближе к зрителю) - масштаб 1, то есть текст остаётся "на месте"
      // и не растёт. Верхний край (дальше, "уходит в пол") - сжимается, но не в точку
      // (нижняя граница 0.5, чтобы не собиралось в треугольник).
var topScale = Math.max(0.7, 1 - floorVal * 0.3);
      var bottomScale = 1;
      var top = textTop != null ? textTop : 0;
      var bottom = textBottom != null ? textBottom : srcH;
      var span = Math.max(1, bottom - top);

      function scaleAt(y) {
        var t = (y - top) / span;
        t = Math.max(0, Math.min(1, t));
        return topScale + (bottomScale - topScale) * t;
      }

      // ВАЖНО: масштабируем каждую полоску ОДИНАКОВО по ширине И по высоте (изотропно),
      // И берём полоску толщиной в 1px - это убирает ступеньки/сдвиг между соседними
      // полосками, из-за которых вертикальные штрихи букв "ехали" относительно друг
      // друга и текст выглядел как курсив/собранным в кучу. При сплошном (1px) шаге
      // сдвиг становится непрерывным, и буквы уменьшаются ровно, без перекоса формы.
      var strips = Math.max(1, Math.round(srcH));
      var stripH = srcH / strips;
      var maxScale = Math.max(topScale, bottomScale);
      var outW = Math.ceil(srcW * maxScale);

      var totalH = 0;
      var s;
      for (s = 0; s < strips; s++) {
        totalH += stripH * scaleAt(s * stripH + stripH / 2);
      }

      var out = document.createElement('canvas');
      out.width = outW;
      out.height = Math.ceil(totalH);
      var octx = out.getContext('2d');

      var cursorY = 0;
      for (s = 0; s < strips; s++) {
        var y = s * stripH;
        var scl = scaleAt(y + stripH / 2);
        var dh = stripH * scl;
        var dw = srcW * scl;
        octx.drawImage(srcCanvas, 0, y, srcW, stripH, (outW - dw) / 2, cursorY, dw, dh + 0.5);
        cursorY += dh;
      }

      return { canvas: out, w: outW, h: out.height };
    }
function edApplyWallTilt(srcCanvas, srcW, srcH, wallVal) {
      if (!wallVal) return { canvas: srcCanvas, w: srcW, h: srcH };
      var nearScale = 1;
      var farScale = Math.max(0.15, 1 - wallVal * 0.8);
      var strips = Math.max(60, Math.min(160, Math.round(srcW)));
      var stripW = srcW / strips;
      var scales = [];
      var totalW = 0;
      for (var s = 0; s < strips; s++) {
        var t = (s + 0.5) / strips;
        var scl = nearScale + (farScale - nearScale) * t;
        scales.push(scl);
        totalW += stripW * scl;
      }
      var maxH = srcH * nearScale;
      var out = document.createElement('canvas');
      out.width = Math.ceil(totalW);
      out.height = Math.ceil(maxH);
      var octx = out.getContext('2d');
      var runX = 0;
      for (var s2 = 0; s2 < strips; s2++) {
        var scl2 = scales[s2];
        var sw = stripW * scl2 + 0.35;
        var sh = srcH * scl2;
        octx.drawImage(srcCanvas, s2 * stripW, 0, stripW, srcH, runX, (out.height - sh) / 2, sw, sh);
        runX += stripW * scl2;
      }
      return { canvas: out, w: out.width, h: out.height };
    }

function edApplyCombinedTilt(srcCanvas, srcW, srcH, floorVal, wallVal, textTop, textBottom) {
      // Единый проход вместо цепочки "Пол потом Стена".
      var topScale = floorVal ? Math.max(0.7, 1 - floorVal * 0.3) : 1;
      var bottomScale = 1;
      var top = textTop != null ? textTop : 0;
      var bottom = textBottom != null ? textBottom : srcH;
      var span = Math.max(1, bottom - top);
      function floorScaleAt(y) {
        var t = (y - top) / span;
        t = Math.max(0, Math.min(1, t));
        return topScale + (bottomScale - topScale) * t;
      }

      var nearScale = 1;
      var farScale = wallVal ? Math.max(0.35, 1 - wallVal * 0.5) : 1;
      function wallScaleAt(x) {
        var t = Math.max(0, Math.min(1, x / srcW));
        return nearScale + (farScale - nearScale) * t;
      }

      var rows = Math.max(1, Math.round(srcH));
      var cols = Math.max(1, Math.round(srcW));
      var rowH = srcH / rows;
      var colW = srcW / cols;
      var maxScale = Math.max(topScale, bottomScale, nearScale, farScale);
      var outW = Math.ceil(srcW * maxScale);
      var outH = Math.ceil(srcH * maxScale);

      // ВАЖНО: раньше соседние ячейки сетки нарочно перекрывались на 0.6px,
      // чтобы не было щелей. Но края текста полупрозрачные (антиалиасинг),
      // и это перекрытие рисовало один и тот же полупрозрачный пиксель ДВАЖДЫ -
      // отсюда рваный/задвоенный контур букв. Здесь вместо этого считаем
      // кумулятивные (накопленные) позиции по строкам и столбцам - тогда
      // соседние ячейки стыкуются встык, без наложения и без щелей.

      // Базовая (немасштабированная по "полу") ширина каждого столбца,
      // и её накопленная сумма - это одинаково для всех строк,
      // масштаб "пола" применяется к строке целиком.
      var colBaseW = new Array(cols);
      var colBaseX = new Array(cols + 1);
      colBaseX[0] = 0;
      var c;
      for (c = 0; c < cols; c++) {
        var wS = wallScaleAt(c * colW + colW / 2);
        colBaseW[c] = colW * wS;
        colBaseX[c + 1] = colBaseX[c] + colBaseW[c];
      }
      var baseTotalW = colBaseX[cols];

      // Накопленные позиции по строкам (масштаб "пола").
      var rowDH = new Array(rows);
      var rowY = new Array(rows + 1);
      rowY[0] = 0;
      var r;
      for (r = 0; r < rows; r++) {
        var fS = floorScaleAt(r * rowH + rowH / 2);
        rowDH[r] = rowH * fS;
        rowY[r + 1] = rowY[r] + rowDH[r];
      }
      var totalH = rowY[rows];
      var offsetY = (outH - totalH) / 2;

      var out = document.createElement('canvas');
      out.width = outW;
      out.height = outH;
      var octx = out.getContext('2d');

      for (r = 0; r < rows; r++) {
        var sy = r * rowH;
        var fSr = floorScaleAt(sy + rowH / 2);
        var dy = offsetY + rowY[r];
        var dh = rowDH[r];
        var rowW = baseTotalW * fSr;
        var offsetXRow = (outW - rowW) / 2;
        for (c = 0; c < cols; c++) {
          var dx = offsetXRow + colBaseX[c] * fSr;
          var dw = colBaseW[c] * fSr;
          octx.drawImage(srcCanvas, c * colW, sy, colW, rowH, dx, dy, dw + 0.4, dh + 0.4);
        }
      }
      return { canvas: out, w: outW, h: outH };
    }
    function edDrawPerspectiveText(layer) {
      var bounds = edLayerBounds(layer);
      var size = layer.baseSize * layer.scale;
      var padExtra = Math.max(
        size * 1.3,
        (layer.shadowBlur || 0) + Math.abs(layer.shadowOffsetX || 0) + Math.abs(layer.shadowOffsetY || 0),
        (layer.glowBlur || 0)
      );
      var bw = Math.max(10, Math.ceil(bounds.w + padExtra * 2));
      var bh = Math.max(10, Math.ceil(bounds.h + padExtra * 2));

      var cacheKey = [
        layer.text, layer.font, layer.color, layer.bold, layer.italic, layer.underline, layer.strike,
        layer.align, layer.letterSpacing, layer.lineHeight, size, layer.effect,
        layer.shadowEnabled, layer.shadowColor, layer.shadowBlur, layer.shadowOffsetX, layer.shadowOffsetY,
        layer.outlineEnabled, layer.outlineColor, layer.outlineWidth,
        layer.glowEnabled, layer.glowColor, layer.glowBlur, layer.vAnchor, bw, bh
      ].join('|');

      var flatCanvas = edGetFlatTextCanvas(layer, bw, bh, cacheKey);
      var floorVal = (layer.perspectiveFloor || 0) / 100;
      var wallVal = (layer.perspectiveWall || 0) / 100;

      var textTop = (bh - bounds.h) / 2;
      var textBottom = textTop + bounds.h;

      var step, drawX, drawY;
      if (floorVal > 0 && wallVal > 0) {
        step = edApplyCombinedTilt(flatCanvas, bw, bh, floorVal, wallVal, textTop, textBottom);
        drawX = layer.x - step.w / 2;
        drawY = (layer.y + bh / 2) - step.h;
      } else if (wallVal > 0) {
        step = edApplyWallTilt(flatCanvas, bw, bh, wallVal);
        drawX = layer.x - bw / 2;
        drawY = layer.y - step.h / 2;
      } else if (floorVal > 0) {
        step = edApplyFloorTilt(flatCanvas, bw, bh, floorVal, textTop, textBottom);
        drawX = layer.x - step.w / 2;
        drawY = (layer.y + bh / 2) - step.h;
      } else {
        step = { canvas: flatCanvas, w: bw, h: bh };
        drawX = layer.x - bw / 2;
        drawY = layer.y - bh / 2;
      }

      edCtx.save();
      edCtx.globalAlpha = layer.opacity != null ? layer.opacity : 1;
      edCtx.drawImage(step.canvas, drawX, drawY, step.w, step.h);
      edCtx.restore();
    }
function edDrawTextLayer(layer) {
      if ((layer.perspectiveFloor && layer.perspectiveFloor > 0) || (layer.perspectiveWall && layer.perspectiveWall > 0)) {
        edDrawPerspectiveText(layer);
        return;
      }
      var size = layer.baseSize * layer.scale;
      var lines = (layer.text || '').split('\n');
      if (!lines.length) lines = [''];
      edCtx.font = edGetFontString(layer, size);
      edCtx.textAlign = 'left';
      edCtx.textBaseline = 'middle';

      var fillColor = layer.color;
      var outlineOn = !!layer.outlineEnabled;
      var outlineColor = layer.outlineColor || '#000000';
      var outlineWidth = layer.outlineWidth != null ? layer.outlineWidth : 4;
var shadowOn = !!layer.shadowEnabled;
      var shadowColor = layer.shadowColor || '#000000';
      var shadowBlur = layer.shadowBlur != null ? layer.shadowBlur : 8;
      var shadowOffX = layer.shadowOffsetX != null ? layer.shadowOffsetX : 0;
      var shadowOffY = layer.shadowOffsetY != null ? layer.shadowOffsetY : 0;

var letterSpacing = layer.letterSpacing || 0;
      var lineHeightPx = size * (layer.lineHeight != null ? layer.lineHeight : 1.2);
      var totalH = lineHeightPx * lines.length;
      var vAnchor = layer.vAnchor || 'middle';
      var baseY;
      if (vAnchor === 'top') baseY = layer.y + lineHeightPx / 2;
      else if (vAnchor === 'bottom') baseY = layer.y - totalH + lineHeightPx / 2;
      else baseY = layer.y - totalH / 2 + lineHeightPx / 2;
      var lineWidths = lines.map(function (l) { return edMeasureLine(edCtx, l, letterSpacing); });
      var maxLineW = Math.max.apply(null, lineWidths.concat([0]));
      var align = layer.align || 'center';

      function drawGlyphs(offsetX, offsetY, mode, alpha, colorOverride, withUnderline) {
        edCtx.save();
        edCtx.globalAlpha = (layer.opacity || 1) * (alpha != null ? alpha : 1);
        edCtx.font = edGetFontString(layer, size);
        edCtx.textAlign = 'left';
        edCtx.textBaseline = 'middle';
for (var li = 0; li < lines.length; li++) {
          var lw = lineWidths[li];
          var startX;
          if (align === 'left') startX = layer.x - maxLineW / 2;
          else if (align === 'right') startX = layer.x + maxLineW / 2 - lw;
          else startX = layer.x - lw / 2;
          var lineY = baseY + li * lineHeightPx + offsetY;
          var lineX = startX + offsetX;
          edDrawLineSpaced(edCtx, lines[li], lineX, lineY, letterSpacing, mode, colorOverride || (mode === 'stroke' ? outlineColor : fillColor), outlineWidth);
          if (withUnderline && layer.underline && mode !== 'stroke') {
            edCtx.save();
            edCtx.strokeStyle = colorOverride || fillColor;
            edCtx.lineWidth = Math.max(1, size * 0.05);
            edCtx.beginPath();
            var uy = lineY + size * 0.32;
            edCtx.moveTo(lineX, uy);
            edCtx.lineTo(lineX + lw, uy);
            edCtx.stroke();
            edCtx.restore();
          }
          if (layer.strike && mode !== 'stroke') {
            edCtx.save();
            edCtx.strokeStyle = colorOverride || fillColor;
            edCtx.lineWidth = Math.max(1, size * 0.05);
            edCtx.beginPath();
            var sy = lineY - size * 0.05;
            edCtx.moveTo(lineX, sy);
            edCtx.lineTo(lineX + lw, sy);
            edCtx.stroke();
            edCtx.restore();
          }
        }
        edCtx.restore();
      }

      if (layer.glowEnabled) {
        edCtx.save();
        edCtx.shadowColor = layer.glowColor || '#e8a33d';
        edCtx.shadowBlur = layer.glowBlur != null ? layer.glowBlur : 16;
        drawGlyphs(0, 0, 'fill', 1);
        drawGlyphs(0, 0, 'fill', 1);
        edCtx.restore();
      }
      if (layer.effect === 'echo') {
        for (var e = 3; e >= 1; e--) {
          edCtx.shadowBlur = 0;
          drawGlyphs(e * size * 0.06, e * size * 0.06, 'fill', 0.35 / e, fillColor);
        }
edCtx.shadowBlur = 0;
        drawGlyphs(0, 0, 'fill', 1, null, true);
        return;
      }

      if (layer.effect === 'overlap') {
        edCtx.shadowBlur = 0;
        drawGlyphs(-size * 0.045, 0, 'fill', 0.85, '#3ddaf7');
drawGlyphs(size * 0.045, 0, 'fill', 0.85, '#f73d9d');
        drawGlyphs(0, 0, 'fill', 1, fillColor, true);
        return;
      }

      if (layer.effect === 'background' && !layer.curved) {
        var pad = size * (layer.bgPadding != null ? layer.bgPadding : 0.35);
        var bw = maxLineW + pad * 2, bh = totalH + pad;
        var br = Math.min(18, bh / 4);
        var bx = layer.x - bw / 2, by = baseY - lineHeightPx / 2 - pad / 2;
        edCtx.save();
        edCtx.fillStyle = layer.bgColor || '#7c3aed';
        edCtx.beginPath();
        edCtx.moveTo(bx + br, by);
        edCtx.arcTo(bx + bw, by, bx + bw, by + bh, br);
        edCtx.arcTo(bx + bw, by + bh, bx, by + bh, br);
        edCtx.arcTo(bx, by + bh, bx, by, br);
        edCtx.arcTo(bx, by, bx + bw, by, br);
        edCtx.closePath();
        edCtx.fill();
        edCtx.restore();
      }

      if (layer.effect === 'contour') {
        edCtx.shadowBlur = 0;
        drawGlyphs(0, 0, 'stroke', 1, outlineColor);
        return;
      }

      if (layer.effect === 'neon') {
edCtx.shadowColor = fillColor;
        edCtx.shadowBlur = size * 0.35;
        drawGlyphs(0, 0, 'fill', 1, null, true);
        edCtx.shadowBlur = 0;
        drawGlyphs(0, 0, 'stroke', 0.9, '#ffffff');
        return;
      }

      if (layer.effect === 'distort') {
        edCtx.save();
        edCtx.translate(layer.x, layer.y);
        edCtx.transform(1, 0, -0.22, 1, 0, 0);
        edCtx.translate(-layer.x, -layer.y);
        edCtx.shadowBlur = 0;
drawGlyphs(size * 0.05, size * 0.05, 'fill', 0.6, '#3d7bff');
        drawGlyphs(0, 0, 'fill', 1, fillColor, true);
        edCtx.restore();
        return;
      }
      if (layer.effect === 'shadow' || layer.effect === 'glow') {
        shadowOn = true;
        shadowColor = layer.effect === 'glow' ? fillColor : (layer.shadowColor || '#000000');
        shadowBlur = layer.effect === 'glow' ? Math.max(shadowBlur, 20) : shadowBlur;
        shadowOffX = layer.effect === 'glow' ? 0 : shadowOffX;
        shadowOffY = layer.effect === 'glow' ? 0 : shadowOffY;
      }

      if (shadowOn) {
        edCtx.shadowColor = shadowColor;
        edCtx.shadowBlur = shadowBlur;
        edCtx.shadowOffsetX = shadowOffX;
        edCtx.shadowOffsetY = shadowOffY;
      } else {
        edCtx.shadowBlur = 0;
      }
      if (outlineOn || layer.effect === 'outline') {
        edCtx.shadowBlur = 0;
        drawGlyphs(0, 0, 'stroke', 1, outlineColor);
      }
      edCtx.shadowOffsetX = 0; edCtx.shadowOffsetY = 0;
if (shadowOn) { edCtx.shadowColor = shadowColor; edCtx.shadowBlur = shadowBlur; edCtx.shadowOffsetX = shadowOffX; edCtx.shadowOffsetY = shadowOffY; }
      drawGlyphs(0, 0, 'fill', 1, fillColor, true);
      edCtx.shadowBlur = 0; edCtx.shadowOffsetX = 0; edCtx.shadowOffsetY = 0;
    }
function edDrawPerspectiveLines(layer, offsetX, offsetY, mode, colorOverride, outlineColor, outlineWidth, letterSpacing, lines, lineWidths, lineHeightPx, baseY, align, maxLineW, fillColor) {
      var n = lines.length;
      var strength = (layer.perspectiveStrength != null ? layer.perspectiveStrength : 50) / 100;
      var farScale = Math.max(0.25, 1 - strength * 0.75);
      var cumY = baseY;
      for (var li = 0; li < n; li++) {
        var t = n > 1 ? li / (n - 1) : 1;
        var lineScale = farScale + (1 - farScale) * t;
        var lw = lineWidths[li];
        var startX;
        if (align === 'left') startX = -maxLineW / 2;
        else if (align === 'right') startX = maxLineW / 2 - lw;
        else startX = -lw / 2;

        edCtx.save();
        edCtx.translate(layer.x + offsetX, cumY + offsetY);
        edCtx.scale(lineScale, lineScale);
        edDrawLineSpaced(edCtx, lines[li], startX, 0, letterSpacing, mode, colorOverride || (mode === 'stroke' ? outlineColor : fillColor), outlineWidth);
        edCtx.restore();

var gap = lineHeightPx * (0.55 + 0.65 * t);
        cumY += gap;
      }
    }

    function edDrawCurvedText(layer, size, offsetX, offsetY, mode, colorOverride, outlineColor, outlineWidth, letterSpacing) {
      var text = (layer.text || '').replace(/\n/g, ' ');
      if (!text.length) return;
      letterSpacing = letterSpacing || 0;
      var totalWidth = edMeasureLine(edCtx, text, letterSpacing);
      var radius = Math.max(size * 2.2, totalWidth * 0.9);
      var totalAngle = Math.min(Math.PI * 1.4, totalWidth / radius);
      var startAngle = -Math.PI / 2 - totalAngle / 2;
      var cx = layer.x + offsetX, cy = layer.y + offsetY + radius * 0.55;
      edCtx.save();
      edCtx.translate(cx, cy);
      var angle = startAngle;
      for (var i = 0; i < text.length; i++) {
        var ch = text[i];
        var chWidth = edCtx.measureText(ch).width;
        var chAngle = (chWidth + letterSpacing) / radius;
        edCtx.save();
        edCtx.rotate(angle + chAngle / 2);
        edCtx.translate(0, -radius);
        if (mode === 'stroke') {
          edCtx.lineWidth = outlineWidth;
          edCtx.strokeStyle = colorOverride || outlineColor;
          edCtx.strokeText(ch, 0, 0);
        } else {
          edCtx.fillStyle = colorOverride || layer.color;
          edCtx.fillText(ch, 0, 0);
        }
        edCtx.restore();
        angle += chAngle;
      }
      edCtx.restore();
    }
var edSelOverlay = document.getElementById('wsEditorSelOverlay');
    var edSelDelBtn  = document.getElementById('wsEditorSelDel');
    var edSelDupBtn  = document.getElementById('wsEditorSelDup');
    var edCornerDrag = null;

    function edUpdateOverlay() {
      if (!edSelOverlay) return;
      var layer = edGetLayer(edSelectedId);
      if (!layer) { edSelOverlay.style.display = 'none'; return; }
      var b = edLayerBounds(layer);
      var canvasRect = edCanvas.getBoundingClientRect();
      var wrapRect = edCanvas.parentElement.getBoundingClientRect();
      var scaleX = canvasRect.width / edW;
      var scaleY = canvasRect.height / edH;
      var left = (canvasRect.left - wrapRect.left) + b.x * scaleX;
      var top  = (canvasRect.top - wrapRect.top) + b.y * scaleY;
      edSelOverlay.style.display = 'block';
      edSelOverlay.style.left = left + 'px';
      edSelOverlay.style.top = top + 'px';
      edSelOverlay.style.width = (b.w * scaleX) + 'px';
      edSelOverlay.style.height = (b.h * scaleY) + 'px';
    }

    function edDeleteSelectedLayer() {
      edLayers = edLayers.filter(function (l) { return l.id !== edSelectedId; });
      edSelectedId = null;
      edRender(); edRenderLayerList(); edUpdateProps();
    }

    function edDuplicateSelectedLayer() {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      var copy = Object.assign({}, layer);
      copy.id = 'l' + (++edIdSeq);
      copy.x = layer.x + edW * 0.03;
      copy.y = layer.y + edW * 0.03;
      edLayers.push(copy);
      edSelectedId = copy.id;
      edRender(); edRenderLayerList(); edUpdateProps();
    }

    if (edSelDelBtn) edSelDelBtn.addEventListener('click', function (e) { e.stopPropagation(); edDeleteSelectedLayer(); });
    if (edSelDupBtn) edSelDupBtn.addEventListener('click', function (e) { e.stopPropagation(); edDuplicateSelectedLayer(); });

    document.querySelectorAll('.ws-editor-sel-handle').forEach(function (handle) {
      handle.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation();
        var layer = edGetLayer(edSelectedId);
        if (!layer) return;
        var pt = edCanvasPoint(e.clientX, e.clientY);
        var dx = pt.x - layer.x, dy = pt.y - layer.y;
        edCornerDrag = {
          layer: layer,
          initDist: Math.max(1, Math.sqrt(dx * dx + dy * dy)),
          initScale: layer.scale
        };
        try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      });
    });
    window.addEventListener('pointermove', function (e) {
      if (!edCornerDrag) return;
      e.preventDefault();
      var pt = edCanvasPoint(e.clientX, e.clientY);
      var layer = edCornerDrag.layer;
      var dx = pt.x - layer.x, dy = pt.y - layer.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var ratio = dist / edCornerDrag.initDist;
      var newScale = edCornerDrag.initScale * ratio;
      layer.scale = Math.max(0.05, Math.min(6, newScale));
      edRender();
      if (layer.id === edSelectedId) edUpdateProps();
    });
    window.addEventListener('pointerup', function () { edCornerDrag = null; });

function edApplySharpen(layer, bounds) {
      var w = Math.round(bounds.w), h = Math.round(bounds.h);
      var x = Math.round(bounds.x), y = Math.round(bounds.y);
      if (w < 2 || h < 2) return;
      var imgData;
      try { imgData = edCtx.getImageData(x, y, w, h); } catch (e) { return; }
      var amount = layer.sharpen / 100;
      if (amount <= 0) return;
      var src = imgData.data;
      var out = new Uint8ClampedArray(src.length);
      var center = 1 + 4 * amount;
      var side = -amount;
      for (var yy = 0; yy < h; yy++) {
        for (var xx = 0; xx < w; xx++) {
          var idx = (yy * w + xx) * 4;
          for (var ch = 0; ch < 3; ch++) {
            var cIdx = idx + ch;
            var sum = src[cIdx] * center;
            sum += (xx > 0 ? src[cIdx - 4] : src[cIdx]) * side;
            sum += (xx < w - 1 ? src[cIdx + 4] : src[cIdx]) * side;
            sum += (yy > 0 ? src[cIdx - w * 4] : src[cIdx]) * side;
            sum += (yy < h - 1 ? src[cIdx + w * 4] : src[cIdx]) * side;
            out[cIdx] = sum;
          }
          out[idx + 3] = src[idx + 3];
        }
      }
      imgData.data.set(out);
      edCtx.putImageData(imgData, x, y);
    }

    function edRender() {
      edCtx.clearRect(0, 0, edW, edH);
      edCtx.fillStyle = '#111';
      edCtx.fillRect(0, 0, edW, edH);
edLayers.forEach(function (layer) {
        edCtx.save();
        edCtx.globalAlpha = layer.opacity;
        var edB = 1 + (layer.brightness || 0) / 100;
        var edC = 1 + (layer.contrastVal || 0) / 100;
        var edS = 1 + (layer.saturation || 0) / 100;
        edCtx.filter = 'brightness(' + edB + ') contrast(' + edC + ') saturate(' + edS + ')';
        if (layer.type === 'image') {
          var w = layer.img.width * layer.scale;
          var h = layer.img.height * layer.scale;
          edCtx.drawImage(layer.img, layer.x - w / 2, layer.y - h / 2, w, h);
} else {
          edDrawTextLayer(layer);
        }
        edCtx.restore();

        if (layer.type === 'image') {
          var edBounds = edLayerBounds(layer);
          if (layer.sharpen) edApplySharpen(layer, edBounds);
          if (layer.warmth) {
            edCtx.save();
            edCtx.beginPath();
            edCtx.rect(edBounds.x, edBounds.y, edBounds.w, edBounds.h);
            edCtx.clip();
            edCtx.globalCompositeOperation = 'overlay';
            edCtx.globalAlpha = Math.min(1, Math.abs(layer.warmth) / 100) * 0.55 * layer.opacity;
            edCtx.fillStyle = layer.warmth > 0 ? '#ff9d3d' : '#3d7bff';
            edCtx.fillRect(edBounds.x, edBounds.y, edBounds.w, edBounds.h);
            edCtx.restore();
          }
          if (layer.vignette) {
            edCtx.save();
            edCtx.beginPath();
            edCtx.rect(edBounds.x, edBounds.y, edBounds.w, edBounds.h);
            edCtx.clip();
            var vcx = edBounds.x + edBounds.w / 2, vcy = edBounds.y + edBounds.h / 2;
            var vr = Math.max(edBounds.w, edBounds.h) * 0.72;
            var vgrad = edCtx.createRadialGradient(vcx, vcy, vr * 0.25, vcx, vcy, vr);
            vgrad.addColorStop(0, 'rgba(0,0,0,0)');
            vgrad.addColorStop(1, 'rgba(0,0,0,' + (layer.vignette / 100 * 0.85 * layer.opacity) + ')');
            edCtx.fillStyle = vgrad;
            edCtx.fillRect(edBounds.x, edBounds.y, edBounds.w, edBounds.h);
            edCtx.restore();
          }
        }

if (layer.id === edSelectedId) {
          var b = edLayerBounds(layer);
          edCtx.save();
          edCtx.strokeStyle = '#e8a33d';
          edCtx.lineWidth = Math.max(2, edW * 0.003);
          edCtx.setLineDash([edW * 0.012, edW * 0.008]);
          edCtx.strokeRect(b.x, b.y, b.w, b.h);
          edCtx.restore();
        }
      });
      edUpdateOverlay();
    }
var edLayerDrag = null;

    function edRenderLayerList() {
      edLayersEl.innerHTML = '';
      for (var i = edLayers.length - 1; i >= 0; i--) {
        (function (layer) {
          var row = document.createElement('div');
          row.className = 'ws-editor-layer-row' + (layer.id === edSelectedId ? ' active' : '');
          row.dataset.layerId = layer.id;
          var label = layer.type === 'image' ? '🖼 Фото' : layer.text;
          row.innerHTML =
            '<span class="ws-editor-layer-handle"><span></span><span></span><span></span></span>' +
            '<span>' + label + '</span>';

          row.addEventListener('click', function (e) {
            if (edLayerDrag && edLayerDrag.moved) return;
            edSelectedId = layer.id;
            edRender();
            edRenderLayerList();
            edUpdateProps();
          });

          var handle = row.querySelector('.ws-editor-layer-handle');
          handle.addEventListener('pointerdown', function (e) {
            e.preventDefault(); e.stopPropagation();
            edLayerDrag = {
              id: layer.id,
              row: row,
              startY: e.clientY,
              moved: false
            };
            row.classList.add('is-dragging');
            try { handle.setPointerCapture(e.pointerId); } catch (err) {}
          });

          edLayersEl.appendChild(row);
        })(edLayers[i]);
      }
    }

    function edClearDropMarkers() {
      Array.prototype.forEach.call(edLayersEl.children, function (r) {
        r.classList.remove('is-drop-before', 'is-drop-after');
      });
    }

    window.addEventListener('pointermove', function (e) {
      if (!edLayerDrag) return;
      e.preventDefault();
      if (Math.abs(e.clientY - edLayerDrag.startY) > 4) edLayerDrag.moved = true;

      edClearDropMarkers();
      var rows = Array.prototype.slice.call(edLayersEl.children);
      var target = null, before = false;
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r === edLayerDrag.row) continue;
        var rect = r.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) { target = r; before = true; break; }
        if (e.clientY <= rect.bottom) { target = r; before = false; break; }
      }
      if (target) target.classList.add(before ? 'is-drop-before' : 'is-drop-after');
      edLayerDrag.dropTarget = target;
      edLayerDrag.dropBefore = before;
    });

    window.addEventListener('pointerup', function () {
      if (!edLayerDrag) return;
      var dragId = edLayerDrag.id;
      var dropTarget = edLayerDrag.dropTarget;
      var dropBefore = edLayerDrag.dropBefore;

      if (edLayerDrag.row) edLayerDrag.row.classList.remove('is-dragging');
      edClearDropMarkers();

      if (dropTarget) {
        var targetId = dropTarget.dataset.layerId;
        var fromIdx = edLayers.findIndex(function (l) { return l.id === dragId; });
        var toIdx = edLayers.findIndex(function (l) { return l.id === targetId; });
        if (fromIdx > -1 && toIdx > -1 && fromIdx !== toIdx) {
          var moving = edLayers.splice(fromIdx, 1)[0];
          toIdx = edLayers.findIndex(function (l) { return l.id === targetId; });
          // список отображается сверху вниз как edLayers[last..0] (верхний слой на канвасе - сверху списка),
          // поэтому "перед" в DOM = "после" по z-индексу в массиве, и наоборот
          var insertAt = dropBefore ? toIdx + 1 : toIdx;
          edLayers.splice(insertAt, 0, moving);
          edRender();
          edRenderLayerList();
        }
      }

      edLayerDrag = null;
    });

function edBuildFontList() {
      if (!edFontList || !edFontSelect) return;
      edFontList.innerHTML = '';
      Array.prototype.forEach.call(edFontSelect.children, function (node) {
        if (node.tagName === 'OPTGROUP') {
          var groupLabel = document.createElement('div');
          groupLabel.className = 'ws-editor-font-group-label';
          groupLabel.textContent = node.label;
          edFontList.appendChild(groupLabel);
          Array.prototype.forEach.call(node.children, function (opt) {
            edFontList.appendChild(edMakeFontOption(opt));
          });
        } else if (node.tagName === 'OPTION') {
          edFontList.appendChild(edMakeFontOption(node));
        }
      });
    }

    function edMakeFontOption(opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ws-editor-font-option';
      btn.dataset.value = opt.value;
      btn.textContent = opt.textContent;
      btn.style.fontFamily = opt.value;
      btn.addEventListener('click', function () {
        edFontSelect.value = opt.value;
        edFontSelect.dispatchEvent(new Event('change'));
        edSetFontButtonLabel(opt.textContent);
        edFontPopup.style.display = 'none';
        edHighlightFontOption(opt.value);
      });
      return btn;
    }

    function edSetFontButtonLabel(text) {
      if (!edFontBtn) return;
      edFontBtn.innerHTML = text + ' <span class="ws-editor-font-arrow">▾</span>';
    }

    function edHighlightFontOption(value) {
      if (!edFontList) return;
      Array.prototype.forEach.call(edFontList.querySelectorAll('.ws-editor-font-option'), function (b) {
        b.classList.toggle('active', b.dataset.value === value);
      });
    }

    edBuildFontList();

    if (edFontBtn) {
      edFontBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var opening = edFontPopup.style.display === 'none';
        edFontPopup.style.display = opening ? 'block' : 'none';
      });
    }
    document.addEventListener('pointerdown', function (e) {
      if (!edFontPopup || edFontPopup.style.display === 'none') return;
      if (edFontPopup.contains(e.target) || (edFontBtn && edFontBtn.contains(e.target))) return;
      edFontPopup.style.display = 'none';
    });

    function edPopulatePropsFields(layer) {
      var isText = layer.type === 'text';
      if (edGroupLight) edGroupLight.style.display = isText ? 'none' : 'flex';
      if (edGroupColor) edGroupColor.style.display = isText ? 'none' : 'flex';
      if (edGroupTexture) edGroupTexture.style.display = isText ? 'none' : 'flex';
      if (layer.type === 'text') {
        edPropsText.style.display = 'flex';
edTextContent.value = layer.text;
        edFontSelect.value = layer.font;
        var edActiveFontOpt = edFontSelect.querySelector('option[value="' + layer.font.replace(/"/g, '\\"') + '"]');
        edSetFontButtonLabel(edActiveFontOpt ? edActiveFontOpt.textContent : layer.font);
        edHighlightFontOption(layer.font);
        edColorInput.value = layer.color;
        edBoldBtn.classList.toggle('active', !!layer.bold);
        edItalicBtn.classList.toggle('active', !!layer.italic);
        edUnderlineBtn.classList.toggle('active', !!layer.underline);
        edStrikeBtn.classList.toggle('active', !!layer.strike);
        edAlignBtns.forEach(function (b) { b.classList.toggle('active', b.dataset.align === (layer.align || 'center')); });
        edAnchorBtns.forEach(function (b) { b.classList.toggle('active', b.dataset.anchor === (layer.vAnchor || 'middle')); });
        edLetterSpacingRange.value = layer.letterSpacing || 0;
        edLetterSpacingValueEl.value = layer.letterSpacing || 0;
        var lhVal = layer.lineHeight != null ? layer.lineHeight : 1.2;
        edLineHeightRange.value = Math.round(lhVal * 10);
        edLineHeightValueEl.value = lhVal.toFixed(1);
        edShadowToggle.checked = !!layer.shadowEnabled;
        edShadowColor.value = layer.shadowColor || '#000000';
        edShadowBlur.value = layer.shadowBlur != null ? layer.shadowBlur : 8;
edOutlineToggle.checked = !!layer.outlineEnabled;
        edOutlineColor.value = layer.outlineColor || '#000000';
        edOutlineWidth.value = layer.outlineWidth != null ? layer.outlineWidth : 4;
        edGlowToggle.checked = !!layer.glowEnabled;
        edGlowColor.value = layer.glowColor || '#e8a33d';
        edGlowBlur.value = layer.glowBlur != null ? layer.glowBlur : 16;
      } else {
        edPropsText.style.display = 'none';
      }
edOpacityRange.value = Math.round(layer.opacity * 100);
      if (edOpacityValueEl) edOpacityValueEl.value = edOpacityRange.value;
      edBrightnessRange.value = layer.brightness || 0;
      if (edBrightnessValueEl) edBrightnessValueEl.value = edBrightnessRange.value;
      edContrastRange.value = layer.contrastVal || 0;
      if (edContrastValueEl) edContrastValueEl.value = edContrastRange.value;
      edSaturationRange.value = layer.saturation || 0;
      if (edSaturationValueEl) edSaturationValueEl.value = edSaturationRange.value;
      edWarmthRange.value = layer.warmth || 0;
      if (edWarmthValueEl) edWarmthValueEl.value = edWarmthRange.value;
      edSharpenRange.value = layer.sharpen || 0;
      if (edSharpenValueEl) edSharpenValueEl.value = edSharpenRange.value;
edVignetteRange.value = layer.vignette || 0;
      if (edVignetteValueEl) edVignetteValueEl.value = edVignetteRange.value;
      edFloorTiltRange.value = layer.perspectiveFloor || 0;
      if (edFloorTiltValueEl) edFloorTiltValueEl.value = edFloorTiltRange.value;
      edWallTiltRange.value = layer.perspectiveWall || 0;
      if (edWallTiltValueEl) edWallTiltValueEl.value = edWallTiltRange.value;
    }
    function edUpdateProps() {
      var layer = edGetLayer(edSelectedId);
      if (!layer) { edCloseCtxMenu(); return; }
      if (!edProps.style.display || edProps.style.display === 'none') return;
      edPopulatePropsFields(layer);
    }

function edOpenCtxMenu(clientX, clientY) {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      edPopulatePropsFields(layer);
      edSyncEffectButtons();
      edProps.style.display = 'flex';
      edProps.style.left = clientX + 'px';
      edProps.style.top = clientY + 'px';
      requestAnimationFrame(function () {
        var rect = edProps.getBoundingClientRect();
        var maxX = window.innerWidth - rect.width - 10;
        var maxY = window.innerHeight - rect.height - 10;
        var x = Math.min(Math.max(10, clientX), Math.max(10, maxX));
        var y = Math.min(Math.max(10, clientY), Math.max(10, maxY));
        edProps.style.left = x + 'px';
        edProps.style.top = y + 'px';
      });
    }

    function edCloseCtxMenu() {
      edProps.style.display = 'none';
    }

    document.addEventListener('pointerdown', function (e) {
      if (!edProps.style.display || edProps.style.display === 'none') return;
      if (edProps.contains(e.target)) return;
      edCloseCtxMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') edCloseCtxMenu();
    });
var edPropsDragHandle = document.getElementById('wsEditorPropsDragHandle');
    var edPropsDrag = null;
    if (edPropsDragHandle) {
      edPropsDragHandle.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation();
        var rect = edProps.getBoundingClientRect();
        edPropsDrag = { offX: e.clientX - rect.left, offY: e.clientY - rect.top };
        try { edPropsDragHandle.setPointerCapture(e.pointerId); } catch (err) {}
      });
    }
    window.addEventListener('pointermove', function (e) {
      if (!edPropsDrag) return;
      e.preventDefault();
      var x = e.clientX - edPropsDrag.offX;
      var y = e.clientY - edPropsDrag.offY;
      var maxX = window.innerWidth - edProps.offsetWidth - 4;
      var maxY = window.innerHeight - edProps.offsetHeight - 4;
      x = Math.min(Math.max(4, x), Math.max(4, maxX));
      y = Math.min(Math.max(4, y), Math.max(4, maxY));
      edProps.style.left = x + 'px';
      edProps.style.top = y + 'px';
    });
    window.addEventListener('pointerup', function () { edPropsDrag = null; });
    edTextContent.addEventListener('input', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.text = edTextContent.value || ' ';
      edRender(); edRenderLayerList();
    });
edFontSelect.addEventListener('change', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.font = edFontSelect.value;
      if (document.fonts && document.fonts.load) {
        document.fonts.load('40px ' + edFontSelect.value).then(edRender).catch(edRender);
      }
      edRender();
    });
edColorInput.addEventListener('input', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.color = edColorInput.value;
      edRender();
    });
    edBoldBtn.addEventListener('click', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.bold = !layer.bold;
      edBoldBtn.classList.toggle('active', layer.bold);
      edRender();
    });
    edItalicBtn.addEventListener('click', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.italic = !layer.italic;
      edItalicBtn.classList.toggle('active', layer.italic);
      edRender();
    });
    edUnderlineBtn.addEventListener('click', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.underline = !layer.underline;
      edUnderlineBtn.classList.toggle('active', layer.underline);
      edRender();
    });
    edStrikeBtn.addEventListener('click', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.strike = !layer.strike;
      edStrikeBtn.classList.toggle('active', layer.strike);
      edRender();
    });
    edAlignBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var layer = edGetLayer(edSelectedId);
        if (!layer) return;
        layer.align = btn.dataset.align;
        edAlignBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        edRender();
      });
    });
    edAnchorBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var layer = edGetLayer(edSelectedId);
        if (!layer) return;
        layer.vAnchor = btn.dataset.anchor;
        edAnchorBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        edRender();
      });
    });
    edLetterSpacingRange.addEventListener('input', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.letterSpacing = parseInt(edLetterSpacingRange.value, 10);
      edLetterSpacingValueEl.value = layer.letterSpacing;
      edRender();
    });
    edLetterSpacingValueEl.addEventListener('change', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      var v = parseInt(edLetterSpacingValueEl.value, 10);
      if (isNaN(v)) v = 0;
      v = Math.max(-10, Math.min(40, v));
      layer.letterSpacing = v;
      edLetterSpacingRange.value = v;
      edLetterSpacingValueEl.value = v;
      edRender();
    });
    edLineHeightRange.addEventListener('input', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      var v = parseInt(edLineHeightRange.value, 10) / 10;
      layer.lineHeight = v;
      edLineHeightValueEl.value = v.toFixed(1);
      edRender();
    });
    edLineHeightValueEl.addEventListener('change', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      var v = parseFloat(edLineHeightValueEl.value);
      if (isNaN(v)) v = 1.2;
      v = Math.max(0.8, Math.min(3, v));
      layer.lineHeight = v;
      edLineHeightRange.value = Math.round(v * 10);
      edLineHeightValueEl.value = v.toFixed(1);
      edRender();
    });
function edBindLayerSlider(rangeEl, valueEl, prop, min, max) {
      function apply(v) {
        var layer = edGetLayer(edSelectedId);
        if (!layer) return;
        v = Math.max(min, Math.min(max, v));
        layer[prop] = v;
        rangeEl.value = v;
        if (valueEl) valueEl.value = v;
        edRender();
      }
      rangeEl.addEventListener('input', function () { apply(parseInt(rangeEl.value, 10)); });
      if (valueEl) {
        valueEl.addEventListener('change', function () {
          var v = parseInt(valueEl.value, 10);
          if (isNaN(v)) v = 0;
          apply(v);
        });
      }
    }

    edOpacityRange.addEventListener('input', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.opacity = parseInt(edOpacityRange.value, 10) / 100;
      if (edOpacityValueEl) edOpacityValueEl.value = edOpacityRange.value;
      edRender();
    });
    if (edOpacityValueEl) {
      edOpacityValueEl.addEventListener('change', function () {
        var layer = edGetLayer(edSelectedId);
        if (!layer) return;
        var v = parseInt(edOpacityValueEl.value, 10);
        if (isNaN(v)) v = 100;
        v = Math.max(10, Math.min(100, v));
        edOpacityRange.value = v;
        edOpacityValueEl.value = v;
        layer.opacity = v / 100;
        edRender();
      });
    }
    edBindLayerSlider(edBrightnessRange, edBrightnessValueEl, 'brightness', -50, 50);
    edBindLayerSlider(edContrastRange, edContrastValueEl, 'contrastVal', -50, 50);
    edBindLayerSlider(edSaturationRange, edSaturationValueEl, 'saturation', -50, 50);
    edBindLayerSlider(edWarmthRange, edWarmthValueEl, 'warmth', -50, 50);
    edBindLayerSlider(edSharpenRange, edSharpenValueEl, 'sharpen', 0, 100);
  edBindLayerSlider(edVignetteRange, edVignetteValueEl, 'vignette', 0, 100);
    edBindLayerSlider(edFloorTiltRange, edFloorTiltValueEl, 'perspectiveFloor', 0, 100);
    edBindLayerSlider(edWallTiltRange, edWallTiltValueEl, 'perspectiveWall', 0, 100);
    edShadowToggle.addEventListener('change', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.shadowEnabled = edShadowToggle.checked;
      edRender();
    });
    edShadowColor.addEventListener('input', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.shadowColor = edShadowColor.value;
      edRender();
    });
    edShadowBlur.addEventListener('input', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.shadowBlur = parseInt(edShadowBlur.value, 10);
      edRender();
    });
    edOutlineToggle.addEventListener('change', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.outlineEnabled = edOutlineToggle.checked;
      edRender();
    });
    edOutlineColor.addEventListener('input', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.outlineColor = edOutlineColor.value;
      edRender();
    });
    edOutlineWidth.addEventListener('input', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.outlineWidth = parseInt(edOutlineWidth.value, 10);
      edRender();
    });
edGlowToggle.addEventListener('change', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.glowEnabled = edGlowToggle.checked;
      edRender();
    });
    edGlowColor.addEventListener('input', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.glowColor = edGlowColor.value;
      edRender();
    });
    edGlowBlur.addEventListener('input', function () {
      var layer = edGetLayer(edSelectedId);
      if (!layer) return;
      layer.glowBlur = parseInt(edGlowBlur.value, 10);
      edRender();
    });
function edCanvasPoint(clientX, clientY) {
      var rect = edCanvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (edW / rect.width),
        y: (clientY - rect.top) * (edH / rect.height)
      };
    }

    function edHitTest(pt) {
      for (var i = edLayers.length - 1; i >= 0; i--) {
        var b = edLayerBounds(edLayers[i]);
        if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) return edLayers[i];
      }
      return null;
    }

var edCanvasHoldTimer = null;
    var edCanvasHoldStart = null;

    edCanvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var pt = edCanvasPoint(e.clientX, e.clientY);
      var hit = edHitTest(pt);
      edSelectedId = hit ? hit.id : null;
      edRender(); edRenderLayerList(); edUpdateProps();
      if (hit) {
        edDrag = { layer: hit, offX: pt.x - hit.x, offY: pt.y - hit.y };
        try { edCanvas.setPointerCapture(e.pointerId); } catch (err) {}

        if (e.pointerType === 'touch' || e.pointerType === 'pen') {
          edCanvasHoldStart = { x: e.clientX, y: e.clientY };
          var holdX = e.clientX, holdY = e.clientY;
          edCanvasHoldTimer = setTimeout(function () {
            edCanvasHoldTimer = null;
            edDrag = null;
            edOpenCtxMenu(holdX, holdY);
          }, 480);
        }
      }
    });
var edRenderPending = false;
    function edRenderThrottled() {
      if (edRenderPending) return;
      edRenderPending = true;
      requestAnimationFrame(function () {
        edRenderPending = false;
        edRender();
      });
    }

    edCanvas.addEventListener('pointermove', function (e) {
      if (edCanvasHoldTimer && edCanvasHoldStart) {
        var dx0 = e.clientX - edCanvasHoldStart.x, dy0 = e.clientY - edCanvasHoldStart.y;
        if (Math.sqrt(dx0 * dx0 + dy0 * dy0) > 8) { clearTimeout(edCanvasHoldTimer); edCanvasHoldTimer = null; }
      }
      if (!edDrag) return;
      e.preventDefault();
      var pt = edCanvasPoint(e.clientX, e.clientY);
      edDrag.layer.x = pt.x - edDrag.offX;
      edDrag.layer.y = pt.y - edDrag.offY;
      edRenderThrottled();
    });
    edCanvas.addEventListener('pointerup', function (e) {
      if (edCanvasHoldTimer) { clearTimeout(edCanvasHoldTimer); edCanvasHoldTimer = null; }
      edDrag = null;
      try { edCanvas.releasePointerCapture(e.pointerId); } catch (err) {}
    });
    edCanvas.addEventListener('pointercancel', function () {
      if (edCanvasHoldTimer) { clearTimeout(edCanvasHoldTimer); edCanvasHoldTimer = null; }
      edDrag = null;
    });
    edCanvas.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var pt = edCanvasPoint(e.clientX, e.clientY);
      var hit = edHitTest(pt);
      if (!hit) { edCloseCtxMenu(); return; }
      edSelectedId = hit.id;
      edRender(); edRenderLayerList();
      edOpenCtxMenu(e.clientX, e.clientY);
    });

    function edExport(type) {
      var wasSelected = edSelectedId;
      edSelectedId = null;
      edRender();
      var mime = type === 'jpg' ? 'image/jpeg' : 'image/png';
      var url = edCanvas.toDataURL(mime, 0.95);
      edSelectedId = wasSelected;
      edRender();
      var a = document.createElement('a');
      a.href = url;
      a.download = '992muz_cover.' + (type === 'jpg' ? 'jpg' : 'png');
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    edExportPng.addEventListener('click', function () { edExport('png'); });
    edExportJpg.addEventListener('click', function () { edExport('jpg'); });

function edEnhanceColorInput(input) {
      if (!input || input.dataset.enhanced) return;
      input.dataset.enhanced = '1';

      var wrap = document.createElement('div');
      wrap.className = 'ws-color-field';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      input.classList.add('ws-visually-hidden');

      var swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'ws-color-swatch';
      var fill = document.createElement('span');
      fill.className = 'ws-color-swatch-fill';
      fill.style.background = input.value || '#000000';
      swatch.appendChild(fill);
      wrap.appendChild(swatch);

      var popup = document.createElement('div');
      popup.className = 'ws-color-popup';
      popup.style.display = 'none';
      popup.innerHTML =
        '<div class="ws-color-canvas-wrap"><canvas width="200" height="130"></canvas><div class="ws-color-canvas-cursor"></div></div>' +
        '<div class="ws-color-hue-wrap"><div class="ws-color-hue-cursor"></div></div>' +
        '<div class="ws-color-fields-row">' +
          '<input type="text" class="ws-color-hex" maxlength="7" placeholder="#000000">' +
          '<input type="text" class="ws-color-r" inputmode="numeric" placeholder="R">' +
          '<input type="text" class="ws-color-g" inputmode="numeric" placeholder="G">' +
          '<input type="text" class="ws-color-b" inputmode="numeric" placeholder="B">' +
        '</div>';
      document.body.appendChild(popup);

      var canvas = popup.querySelector('canvas');
      var cctx = canvas.getContext('2d');
      var cursor = popup.querySelector('.ws-color-canvas-cursor');
      var hueWrap = popup.querySelector('.ws-color-hue-wrap');
      var hueCursor = popup.querySelector('.ws-color-hue-cursor');
      var hexInput = popup.querySelector('.ws-color-hex');
      var rInput = popup.querySelector('.ws-color-r');
      var gInput = popup.querySelector('.ws-color-g');
      var bInput = popup.querySelector('.ws-color-b');

      var state = { h: 0, s: 1, v: 1 };

      function hexToRgb(hex) {
        hex = (hex || '#000000').replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
        var num = parseInt(hex, 16) || 0;
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
      }
      function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(function (v) {
          var n = Math.max(0, Math.min(255, Math.round(v)));
          var s = n.toString(16);
          return s.length === 1 ? '0' + s : s;
        }).join('');
      }
      function rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        var d = max - min, h;
        if (d === 0) h = 0;
        else if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h = h * 60; if (h < 0) h += 360;
        var s = max === 0 ? 0 : d / max;
        return { h: h, s: s, v: max };
      }
      function hsvToRgb(h, s, v) {
        var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
        var r, g, b;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
      }

      function drawSVCanvas() {
        var w = canvas.width, h = canvas.height;
        var hueRgb = hsvToRgb(state.h, 1, 1);
        cctx.fillStyle = 'rgb(' + Math.round(hueRgb.r) + ',' + Math.round(hueRgb.g) + ',' + Math.round(hueRgb.b) + ')';
        cctx.fillRect(0, 0, w, h);
        var gradWhite = cctx.createLinearGradient(0, 0, w, 0);
        gradWhite.addColorStop(0, 'rgba(255,255,255,1)');
        gradWhite.addColorStop(1, 'rgba(255,255,255,0)');
        cctx.fillStyle = gradWhite;
        cctx.fillRect(0, 0, w, h);
        var gradBlack = cctx.createLinearGradient(0, 0, 0, h);
        gradBlack.addColorStop(0, 'rgba(0,0,0,0)');
        gradBlack.addColorStop(1, 'rgba(0,0,0,1)');
        cctx.fillStyle = gradBlack;
        cctx.fillRect(0, 0, w, h);
      }

      function updateCursors() {
        cursor.style.left = (state.s * canvas.clientWidth) + 'px';
        cursor.style.top = ((1 - state.v) * canvas.clientHeight) + 'px';
        hueCursor.style.left = (state.h / 360 * hueWrap.clientWidth) + 'px';
      }

      function applyState(dispatch) {
        var rgb = hsvToRgb(state.h, state.s, state.v);
        var hex = rgbToHex(rgb.r, rgb.g, rgb.b);
        fill.style.background = hex;
        hexInput.value = hex;
        rInput.value = Math.round(rgb.r);
        gInput.value = Math.round(rgb.g);
        bInput.value = Math.round(rgb.b);
        input.value = hex;
        if (dispatch) input.dispatchEvent(new Event('input'));
      }

      function setFromHex(hex, dispatch) {
        var rgb = hexToRgb(hex);
        var hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        state.h = hsv.h; state.s = hsv.s; state.v = hsv.v;
        drawSVCanvas();
        updateCursors();
        applyState(dispatch);
      }

      setFromHex(input.value || '#000000', false);

      swatch.addEventListener('click', function (e) {
        e.stopPropagation();
        var opening = popup.style.display === 'none';
        document.querySelectorAll('.ws-color-popup').forEach(function (p) { p.style.display = 'none'; });
        if (opening) {
          var rect = swatch.getBoundingClientRect();
          var popW = 220, popH = 260;
          var left = Math.min(rect.left, window.innerWidth - popW - 10);
          var top = rect.bottom + 6;
          if (top + popH > window.innerHeight) top = Math.max(10, rect.top - popH - 6);
          popup.style.left = Math.max(10, left) + 'px';
          popup.style.top = top + 'px';
          popup.style.display = 'flex';
          drawSVCanvas();
          updateCursors();
        }
      });
      document.addEventListener('pointerdown', function (e) {
        if (popup.style.display === 'none') return;
        if (popup.contains(e.target) || swatch.contains(e.target)) return;
        popup.style.display = 'none';
      });

      var svDragging = false;
      function pickSV(clientX, clientY) {
        var rect = canvas.getBoundingClientRect();
        var x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        var y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        state.s = x; state.v = 1 - y;
        updateCursors();
        applyState(true);
      }
      canvas.addEventListener('pointerdown', function (e) { svDragging = true; pickSV(e.clientX, e.clientY); });
      window.addEventListener('pointermove', function (e) { if (svDragging) pickSV(e.clientX, e.clientY); });
      window.addEventListener('pointerup', function () { svDragging = false; });

      var hueDragging = false;
      function pickHue(clientX) {
        var rect = hueWrap.getBoundingClientRect();
        var x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        state.h = x * 360;
        drawSVCanvas();
        updateCursors();
        applyState(true);
      }
      hueWrap.addEventListener('pointerdown', function (e) { hueDragging = true; pickHue(e.clientX); });
      window.addEventListener('pointermove', function (e) { if (hueDragging) pickHue(e.clientX); });
      window.addEventListener('pointerup', function () { hueDragging = false; });

      hexInput.addEventListener('change', function () {
        var v = hexInput.value.trim();
        if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
          if (v[0] !== '#') v = '#' + v;
          setFromHex(v, true);
        }
      });
      function rgbFieldsChange() {
        var r = parseInt(rInput.value, 10) || 0;
        var g = parseInt(gInput.value, 10) || 0;
        var b = parseInt(bInput.value, 10) || 0;
        setFromHex(rgbToHex(r, g, b), true);
      }
      [rInput, gInput, bInput].forEach(function (el) { el.addEventListener('change', rgbFieldsChange); });
    }

    ['wsEditorColorInput', 'wsEditorShadowColor', 'wsEditorOutlineColor', 'wsEditorGlowColor'].forEach(function (id) {
      edEnhanceColorInput(document.getElementById(id));
    });

    edRender();
  }
})();