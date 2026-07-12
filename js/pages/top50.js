// js/pages/top50.js
import { db } from '../config/firebase.js';
import { collection, query, orderBy, getDocs, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const list = document.getElementById('top50-list');
const totalEl = document.getElementById('totalListens');
const filters = document.querySelectorAll('.top50-filter');
const playAllBtn = document.getElementById('playAllBtn');

let allTracks = [];
let activeGenre = 'all';
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
    if (currentRow) { currentRow.classList.remove('playing'); setRowIcon(currentRow, false); }
  }

currentAudio = new Audio(t.trackUrl);
  currentAudio.preload = 'auto';
  currentRow = row;
  row.classList.add('playing');
  setRowIcon(row, true);
  updatePlayerBar(t);
  currentAudio.play();
  updateMainPlayBtn();

  currentAudio.addEventListener('timeupdate', () => {
    if (!currentAudio.duration) return;
    const fill = document.querySelector('.player-bar .progress-fill');
    if (fill) fill.style.width = (currentAudio.currentTime / currentAudio.duration * 100) + '%';
    const times = document.querySelectorAll('.player-bar .player-time');
    if (times[0]) times[0].textContent = formatTime(currentAudio.currentTime);
    if (times[1]) times[1].textContent = formatTime(currentAudio.duration);
  });

currentAudio.addEventListener('ended', () => {
    row.classList.remove('playing');
    setRowIcon(row, false);
    updateMainPlayBtn();

    t.plays = (t.plays || 0) + 1;
    const playsCell = row.querySelector('.track-plays');
    if (playsCell) playsCell.textContent = fmtPlays(t.plays);
    writeTop50Cache(allTracks);
    updateDoc(doc(db, 'top50', t.id), { plays: t.plays }).catch(e => console.error('Не удалось обновить прослушивания:', e));
  });
}
function fmtPlays(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'М';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'К';
  return String(n);
}

function fmtDuration(sec) {
  if (!sec) return '-';
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function renderTrend(change) {
  if (change === 'new') return `<span class="track-trend new" style="color:#4caf50;font-weight:700;font-size:11px;">NEW</span>`;
  if (!change || change === 0) return `<span class="track-trend eq">-</span>`;
  if (change > 0) return `<span class="track-trend up">▲ ${change}</span>`;
  return `<span class="track-trend down">▼ ${Math.abs(change)}</span>`;
}
function rankClass(i) {
  if (i === 0) return 'gold';
  if (i === 1) return 'silver';
  if (i === 2) return 'bronze';
  return '';
}

function computeTrends(tracks) {
  const prevRanked = [...tracks].sort((a, b) => (b.previousPlays || 0) - (a.previousPlays || 0) || a.id.localeCompare(b.id));
  const prevRankMap = {};
  prevRanked.forEach((t, i) => { prevRankMap[t.id] = i; });
  tracks.forEach((t, i) => {
    const hadPrev = typeof t.previousPlays === 'number' && t.previousPlays > 0;
    if (!hadPrev) { t.trendChange = 'new'; return; }
    t.trendChange = prevRankMap[t.id] - i;
  });
}
const genreMap = {
  rap: 'Рэп', pop: 'Поп', folk: 'Фолк', pamir: 'Памирский',
  rnb: 'R&B', electronic: 'Электро', classic: 'Классика'
};

function renderTracks(tracks) {
  if (!tracks.length) {
    list.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">Треки не найдены</div>`;
    return;
  }
  list.innerHTML = tracks.map((t, i) => {
    const cover = t.coverUrl
      ? `<img src="${t.coverUrl}" alt="">`
      : `<img src="assets/icons/mountain2.png" alt="" style="padding:10px;filter:invert(0.7);">`;
    const genre = genreMap[t.genre] || t.genre || '-';
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
      <div class="track-plays">${fmtPlays(t.plays)}</div>
      ${renderTrend(t.trendChange)}
<div class="track-btns">
        <button class="track-analytics-btn" title="Аналитика трека" style="background:none;border:none;cursor:pointer;padding:4px;display:inline-flex;align-items:center;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#888;"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.1-2.8-2.8L7 14"/></svg>
        </button>
        <button class="track-share-btn"><img src="assets/icons/share.png" alt=""><span class="track-btn-count">${t.shares || 0}</span></button>
      </div>
    </div>`;
  }).join('');
}

function applyTrackNameMarquee() {
  if (window.innerWidth > 768) return;
  document.querySelectorAll('#top50-list .track-name').forEach(el => {
    if (el.classList.contains('marquee')) return;
    if (el.scrollWidth > el.clientWidth + 4) {
      const text = el.textContent;
      el.innerHTML = `<span>${text}</span><span>${text}</span>`;
      el.classList.add('marquee');
    }
  });
}

function renderFiltered() {
  const filtered = activeGenre === 'all'
    ? allTracks
    : allTracks.filter(t => t.genre === activeGenre);
  renderTracks(filtered);
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
    let fromCache = false;

    if (cached && cached.length) {
      allTracks = cached;
      fromCache = true;
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

    allTracks.sort((a, b) => (b.plays || 0) - (a.plays || 0) || a.id.localeCompare(b.id));
    const total = allTracks.reduce((acc, t) => acc + (t.plays || 0), 0);
    if (totalEl) totalEl.textContent = fmtPlays(total);
    const countEl = document.getElementById('trackCountNum');
    if (countEl) countEl.textContent = String(allTracks.length);
    computeTrends(allTracks);
    renderFiltered();

    // Снапшоты для истории позиций пишем в базу только если данные реально свежие из Firestore,
    // а не взятые из кэша — иначе будем писать одно и то же много раз зря
    if (!fromCache) {
      recordWeeklySnapshots();
    }
  } catch(e) {
    console.error(e);
    list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3)">Ошибка загрузки</div>';
  }
}
filters.forEach(btn => {
  btn.addEventListener('click', () => {
    filters.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeGenre = btn.dataset.genre;
    renderFiltered();
  });
});

list.addEventListener('click', (e) => {
  const analyticsBtn = e.target.closest('.track-analytics-btn');
  if (analyticsBtn) {
    const row = analyticsBtn.closest('.track-row');
    const t = allTracks.find(tr => tr.id === row.dataset.id);
    if (t) openAnalytics(t);
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

// ========== АНАЛИТИКА ТРЕКА ==========
function weekKey(ts) {
  const d = new Date(ts);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-${week}`;
}

async function recordWeeklySnapshots() {
  const now = Date.now();
  const wk = weekKey(now);
  const updates = [];
  allTracks.forEach((t, i) => {
    const history = Array.isArray(t.history) ? t.history : [];
    const last = history[history.length - 1];
    if (last && last.week === wk) return;
    const newHistory = [...history, { week: wk, ts: now, position: i + 1, plays: t.plays || 0 }].slice(-26);
    t.history = newHistory;
    updates.push(updateDoc(doc(db, 'top50', t.id), { history: newHistory }));
  });
  if (updates.length) { try { await Promise.all(updates); } catch(e) { console.error(e); } }
}

function openAnalytics(t) {
  const overlay = document.getElementById('analyticsOverlay');
  document.getElementById('analyticsCover').src = t.coverUrl || 'assets/icons/mountain2.png';
  document.getElementById('analyticsTitle').textContent = t.title || 'Без названия';
  document.getElementById('analyticsArtist').textContent = t.artist || '-';

  const history = Array.isArray(t.history) ? t.history : [];
  const posIdx = allTracks.findIndex(x => x.id === t.id);
  const currentPos = posIdx + 1;
  const peak = history.length ? Math.min(currentPos, ...history.map(h => h.position)) : currentPos;
  document.getElementById('analyticsPos').textContent = '#' + currentPos;
  document.getElementById('analyticsPeak').textContent = '#' + peak;
  document.getElementById('analyticsWeeks').textContent = Math.max(1, history.length);

  const chart = document.getElementById('analyticsChart');
  if (history.length < 2) {
    chart.innerHTML = `<div class="analytics-empty">История позиций появится через неделю - начали отслеживать сегодня 📈</div>`;
  } else {
    const points = [...history, { position: currentPos }].slice(-8);
    const maxPos = Math.max(...points.map(p => p.position), 10);
    const w = 360, h = 90, pad = 10;
    const stepX = (w - pad * 2) / (points.length - 1);
    const coords = points.map((p, i) => {
      const x = pad + i * stepX;
      const y = pad + ((p.position - 1) / maxPos) * (h - pad * 2);
      return [x, y];
    });
    const path = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c[0] + ',' + c[1]).join(' ');
    const dots = coords.map(c => `<circle cx="${c[0]}" cy="${c[1]}" r="3" fill="var(--accent,#8B1A2F)"/>`).join('');
    chart.innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:90px;">
      <path d="${path}" fill="none" stroke="var(--accent,#8B1A2F)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
    </svg>`;
  }
  overlay.classList.add('open');
}
document.getElementById('analyticsClose')?.addEventListener('click', () => document.getElementById('analyticsOverlay').classList.remove('open'));
document.getElementById('analyticsOverlay')?.addEventListener('click', (e) => { if (e.target.id === 'analyticsOverlay') e.currentTarget.classList.remove('open'); });

document.getElementById('analyticsDownload')?.addEventListener('click', async () => {
  const btn = document.getElementById('analyticsDownload');
  const target = document.getElementById('analyticsCardInner');
  if (!window.html2canvas || !target) return;
  btn.style.opacity = '0.4';
  try {
    const canvas = await html2canvas(target, { backgroundColor: '#181818', scale: 2, useCORS: true });
    const link = document.createElement('a');
    const name = (document.getElementById('analyticsTitle')?.textContent || 'track').replace(/[^a-zA-Zа-яА-Я0-9]+/g, '_');
    link.download = `992muz_${name}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch(e) {
    console.error(e);
  } finally {
    btn.style.opacity = '1';
  }
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

window.toggleInfo = function() {
  const modal = document.getElementById('infoModal');
  const btn = document.querySelector('.top50-info-btn');
  if (modal.classList.contains('open')) {
    modal.classList.remove('open');
    return;
  }
  const rect = btn.getBoundingClientRect();
  modal.style.position = 'fixed';
  modal.style.top = (rect.bottom + 8) + 'px';
  modal.style.left = rect.left + 'px';
  modal.style.zIndex = '9999';
  modal.classList.add('open');
}
document.addEventListener('click', function(e) {
  if (!e.target.closest('.top50-info-btn') && !e.target.closest('.top50-info-modal')) {
    document.getElementById('infoModal').classList.remove('open');
  }
});
window.addEventListener('scroll', function() {
  document.getElementById('infoModal').classList.remove('open');
}, true);