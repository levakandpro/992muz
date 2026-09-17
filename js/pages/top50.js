// js/pages/top50.js
import { db } from '../config/firebase.js';
import { collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const list = document.getElementById('top50-list');
const playAllBtn = document.getElementById('playAllBtn');
const nowPlayingBtn = document.getElementById('nowPlayingBtn');

let allTracks = [];
let currentAudio = null;
let currentRow = null;

function formatTime(sec) {
  if (!sec || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updatePlayerBar(t) {
  const nameEl = document.querySelector('.player-bar .player-track-name');
  const artistEl = document.querySelector('.player-bar .player-track-artist');
  const thumbImg = document.querySelector('.player-bar .player-thumb img');
  if (nameEl) nameEl.textContent = t.title || 'Без названия';
  if (artistEl) artistEl.textContent = t.artist || '992MUZ';
  if (thumbImg) {
    if (t.coverUrl) { thumbImg.src = t.coverUrl; thumbImg.style = ''; }
    else { thumbImg.src = 'assets/icons/mountain.png'; thumbImg.style = 'padding:8px;filter:invert(0.7);'; }
  }
}

function updateMainPlayBtn() {
  const btn = document.querySelector('.player-btn-main img');
  if (btn) btn.src = (currentAudio && !currentAudio.paused) ? 'assets/icons/pause.png' : 'assets/icons/play.png';
  updatePlayAllBtn();
  if (nowPlayingBtn) nowPlayingBtn.classList.toggle('visible', !!(currentAudio && !currentAudio.paused));
}

function updatePlayAllBtn() {
  if (!playAllBtn) return;
  const icon = playAllBtn.querySelector('img');
  const label = playAllBtn.querySelector('span') || playAllBtn;
  const playing = currentAudio && !currentAudio.paused;
  if (icon) icon.src = playing ? 'assets/icons/pause.png' : 'assets/icons/play.png';
}
function setRowIcon(row, playing) {
  if (!row) return;
  const img = row.querySelector('.track-cover-play img');
  if (img) img.src = playing ? 'assets/icons/pause.png' : 'assets/icons/play.png';
}

function toggleTrackPlay(t, row) {
  if (!t.trackUrl) return;

  if (currentAudio && currentRow === row) {
    if (currentAudio.paused) { currentAudio.play(); row.classList.add('playing'); }
    else { currentAudio.pause(); row.classList.remove('playing'); }
    setRowIcon(row, !currentAudio.paused);
    updateMainPlayBtn();
    return;
  }

  if (currentAudio) {
    currentAudio.pause();
    if (currentRow) {
      currentRow.classList.remove('playing');
      setRowIcon(currentRow, false);
      const prevProg = currentRow.querySelector('.track-progress-wrap');
      if (prevProg) prevProg.style.display = 'none';
    }
  }

  currentAudio = new Audio(t.trackUrl);
  currentAudio.preload = 'auto';
  currentRow = row;
  row.classList.add('playing');
  setRowIcon(row, true);
  updatePlayerBar(t);
  currentAudio.play();
  updateMainPlayBtn();

  const prog = row.querySelector('.track-progress-wrap');
  const fillRow = row.querySelector('.track-progress-fill');
  const timeRow = row.querySelector('.track-progress-time');
  if (prog) prog.style.display = 'flex';

  currentAudio.addEventListener('timeupdate', () => {
    if (!currentAudio.duration) return;
    const pct = (currentAudio.currentTime / currentAudio.duration * 100) + '%';
    if (fillRow) fillRow.style.width = pct;
    if (timeRow) timeRow.textContent = formatTime(currentAudio.currentTime);

    const fill = document.querySelector('.player-bar .progress-fill');
    if (fill) fill.style.width = pct;
    const times = document.querySelectorAll('.player-bar .player-time');
    if (times[0]) times[0].textContent = formatTime(currentAudio.currentTime);
    if (times[1]) times[1].textContent = formatTime(currentAudio.duration);
  });

  currentAudio.addEventListener('ended', () => {
    row.classList.remove('playing');
    setRowIcon(row, false);
    updateMainPlayBtn();
    if (fillRow) fillRow.style.width = '0%';
    if (timeRow) timeRow.textContent = '0:00';
    if (prog) prog.style.display = 'none';
  });
}
function rankClass(i) {
  if (i === 0) return 'gold';
  if (i === 1) return 'silver';
  if (i === 2) return 'bronze';
  return '';
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function renderTracks(tracks) {
  if (!tracks.length) {
    list.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">Треки не найдены</div>`;
    return;
  }
  list.innerHTML = tracks.map((t, i) => {
    const cover = t.coverUrl
      ? `<img src="${t.coverUrl}" alt="">`
      : `<img src="assets/icons/mountain2.png" alt="" style="padding:10px;filter:invert(0.7);">`;
    return `
    <div class="track-row" data-id="${t.id}">
      <span class="track-num ${rankClass(i)}">${i + 1}</span>
      <div class="track-cover">
        ${cover}
        <div class="track-cover-play"><img src="assets/icons/play.png" alt=""></div>
      </div>
      <div class="track-info">
        <div class="track-name">${t.title || 'Без названия'}</div>
        <div class="track-artist">${t.artist || '-'}</div>
      </div>
      <div class="track-progress-wrap" style="display:none;">
        <div class="track-progress-bar"><div class="track-progress-fill"></div></div>
        <span class="track-progress-time">0:00</span>
      </div>
<div class="track-btns">
        <button class="track-download-btn" data-url="${t.trackUrl || ''}" title="Скачать">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

function applyTrackNameMarquee() {
  document.querySelectorAll('#top50-list .track-artist').forEach(el => {
    if (el.classList.contains('marquee')) return;
    if (el.scrollWidth > el.clientWidth + 4) {
      const text = el.textContent;
      el.innerHTML = `<span>${text}</span><span>${text}</span>`;
      el.classList.add('marquee');
    }
  });
}
function renderFiltered() {
  renderTracks(allTracks);
  requestAnimationFrame(applyTrackNameMarquee);
}

window.addEventListener('resize', () => requestAnimationFrame(applyTrackNameMarquee));
const TOP50_CACHE_KEY = 'top50_cache_v1';
const TOP50_CACHE_TTL_MS = 3 * 60 * 1000; // 3 минуты — можно увеличить до 5-10 минут

function readTop50Cache() {
  try {
    const raw = sessionStorage.getItem(TOP50_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.ts || (Date.now() - parsed.ts) > TOP50_CACHE_TTL_MS) return null;
    return parsed.tracks;
  } catch(e) {
    return null;
  }
}

function writeTop50Cache(tracks) {
  try {
    sessionStorage.setItem(TOP50_CACHE_KEY, JSON.stringify({ ts: Date.now(), tracks }));
  } catch(e) {
    // sessionStorage может быть недоступен (приватный режим) — просто пропускаем кэш
  }
}

async function loadTracks() {
  try {
    list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3)">Загрузка...</div>';

    const cached = readTop50Cache();

    if (cached && cached.length) {
      allTracks = cached;
    } else {
      const q = query(collection(db, 'top50'), orderBy('plays', 'desc'));
      const snap = await getDocs(q);
      if (snap.empty) {
        list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3)">Треков пока нет</div>';
        return;
      }
      allTracks = [];
      snap.forEach(d => allTracks.push({ id: d.id, ...d.data() }));
      writeTop50Cache(allTracks);
    }

    shuffleArray(allTracks);
    renderFiltered();
  } catch(e) {
    console.error(e);
    list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3)">Ошибка загрузки</div>';
  }
}
list.addEventListener('click', (e) => {
  const downloadBtn = e.target.closest('.track-download-btn');
  if (downloadBtn) {
    const row = downloadBtn.closest('.track-row');
    const t = allTracks.find(tr => tr.id === row.dataset.id);
    const url = t && t.trackUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    a.download = `${t.artist ? t.artist + ' - ' : ''}${t.title || 'track'} (by 992muz).mp3`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  const progressBar = e.target.closest('.track-progress-bar');
  if (progressBar) {
    const row = progressBar.closest('.track-row');
    if (row !== currentRow || !currentAudio) return;
    const rect = progressBar.getBoundingClientRect();
    if (currentAudio.duration) currentAudio.currentTime = ((e.clientX - rect.left) / rect.width) * currentAudio.duration;
    return;
  }

  const coverWrap = e.target.closest('.track-cover');
  if (!coverWrap) return;
  const row = coverWrap.closest('.track-row');
  if (!row) return;
  const t = allTracks.find(tr => tr.id === row.dataset.id);
  if (!t) return;
  toggleTrackPlay(t, row);
});



const mainPlayerBtn = document.querySelector('.player-btn-main');
if (mainPlayerBtn) {
  mainPlayerBtn.addEventListener('click', () => {
    if (!currentAudio) return;
    if (currentAudio.paused) { currentAudio.play(); if (currentRow) { currentRow.classList.add('playing'); setRowIcon(currentRow, true); } }
    else { currentAudio.pause(); if (currentRow) { currentRow.classList.remove('playing'); setRowIcon(currentRow, false); } }
    updateMainPlayBtn();
  });
}

if (playAllBtn) {
  playAllBtn.addEventListener('click', () => {
    if (!allTracks.length) return;
    if (currentAudio) {
      if (currentAudio.paused) { currentAudio.play(); if (currentRow) { currentRow.classList.add('playing'); setRowIcon(currentRow, true); } }
      else { currentAudio.pause(); if (currentRow) { currentRow.classList.remove('playing'); setRowIcon(currentRow, false); } }
      updateMainPlayBtn();
      return;
    }
    const firstRow = list.querySelector('.track-row');
    if (firstRow) toggleTrackPlay(allTracks[0], firstRow);
  });
}
loadTracks();

if (nowPlayingBtn) {
  nowPlayingBtn.addEventListener('click', () => {
    if (!currentRow) return;
    currentRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    currentRow.classList.remove('flash');
    void currentRow.offsetWidth;
    currentRow.classList.add('flash');
    currentRow.addEventListener('animationend', () => {
      currentRow.classList.remove('flash');
    }, { once: true });
  });
}