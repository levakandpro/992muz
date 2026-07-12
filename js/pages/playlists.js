// js/pages/playlists.js

import { initComments } from '../components/comments-section.js';
import { db } from '../config/firebase.js';
import { collection, query, where, orderBy, getDocs, updateDoc, doc, limit, setDoc, deleteDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { auth } from '../config/firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

let currentUser = null;
onAuthStateChanged(auth, (user) => { currentUser = user; });

const PLAYLISTS = [
{ id: 1,  firebaseKey: 'medlyaki',     title: 'Медляки',        desc: 'Тихо. Медленно. До мурашек.',                  cover: 'assets/icons/med.jfif', tag: 'Медленный'   },
 { id: 2,  firebaseKey: 'klubnye',      title: 'Клубные',        desc: 'Бас в пол. Ночь без конца.',                    cover: 'assets/icons/cl.jfif', tag: 'Энергия'     },
 { id: 3,  firebaseKey: 'guitar',       title: 'Под гитару',     desc: 'Струны, душа и горный воздух.',                 cover: 'assets/icons/gui.jfif', tag: 'Акустика'    },
 { id: 4,  firebaseKey: 'pamirskie',    title: 'Памирские',      desc: 'Корни. Земля. Наш звук.',                       cover: 'assets/icons/gbao.jfif',     tag: 'Народное'    },
 { id: 5,  firebaseKey: 'fity',         title: 'Фиты',           desc: 'Когда двое делают шедевр.',                     cover: 'assets/icons/ft.jfif',          tag: 'Коллабы'     },
  { id: 6,  firebaseKey: 'pered-snom',   title: 'Перед сном',     desc: 'Отключи мир. Включи нас.',                      cover: 'assets/icons/son.jfif', tag: 'Ночное'      },
 { id: 7,  firebaseKey: 'andergrand',   title: 'Андерграунд',    desc: 'Не для всех. Для своих.',                       cover: 'assets/icons/under.jfif',   tag: 'Андерграунд' },
 { id: 8,  firebaseKey: 'v-tachku',     title: 'В тачку',        desc: 'Окна вниз. Трасса зовёт.',                      cover: 'assets/icons/cd playlist cover.jfif',       tag: 'Дорога'      },
 { id: 9,  firebaseKey: 'vayb-gor',     title: 'Вайб гор',       desc: 'Высота. Ветер. Свобода.',                       cover: 'assets/icons/gor.jfif',       tag: 'Атмосфера'   },
 { id: 10, firebaseKey: 'redakciya',    title: 'Выбор редакции', desc: 'Лучшее по мнению команды PamirNation.',         cover: 'assets/icons/vib.jfif', tag: '★ Редакция', gold: true },
{ id: 11, firebaseKey: 'arhivnyy',     title: 'Архивный',       desc: 'Старое золото, которое не ржавеет.',            cover: 'assets/icons/pr.jfif', tag: 'Классика'    },
 { id: 12, firebaseKey: 'pripevy',      title: 'Припевы',        desc: 'Только лучшие моменты. Без воды.',              cover: 'assets/icons/priv.jfif',       tag: 'Хиты'        },
 { id: 13, firebaseKey: 'russkiy',      title: 'Иранские',       desc: 'Два языка. Один ритм.',                         cover: 'assets/icons/iran.jfif',      tag: 'Билингвал'   },
 { id: 14, firebaseKey: 'trap',         title: 'Trap / Drill',   desc: 'Тёмные биты. Острые слова.',                    cover: 'assets/icons/trap.jfif',     tag: 'Trap'        },
{ id: 15, firebaseKey: 'chernyy-rep',  title: 'Чёрный рэп',     desc: 'Без фильтров. Только правда.',                  cover: 'assets/icons/DARK.jfif', tag: 'Hardcore'    },
  { id: 16, firebaseKey: 'hiphop',       title: 'Хип-хоп',        desc: 'Культура. Движение. Памир в ритме.',            cover: 'assets/icons/hiphop.jfif', tag: 'Hip-Hop'     },
 { id: 17, firebaseKey: 'tancevalnye',  title: 'Танцевальные',   desc: 'Ноги сами знают что делать.',                   cover: 'assets/icons/tanc.jfif', tag: 'Dance'       },
 { id: 18, firebaseKey: 'zhenskiy',     title: 'Женский',        desc: 'Сила, нежность и голос женщины Памира.',        cover: 'assets/icons/jen.jfif',       tag: 'Женский'     },
 { id: 19, firebaseKey: 'legendy',      title: 'Легенды',        desc: 'Те, кого не забудут никогда.',                  cover: 'assets/icons/leg.jfif', tag: 'Легенды', gold: true },
  { id: 20, firebaseKey: 'deep-house',   title: 'Дип хаус',       desc: 'Глубина звука. Бесконечный груув.',             cover: 'assets/icons/deep.jfif', tag: 'Deep House'  },
 { id: 21, firebaseKey: 'narodnye',     title: 'Народные',       desc: 'Дедовские мелодии, живые как горы.',            cover: 'assets/icons/nar.jfif',      tag: 'Фольклор'    },
];
let _commentsOpenId = null;
let currentAudio = null;
let currentRow = null;

// ── СОСТОЯНИЕ ГРИДА (поиск / сортировка / прослушивания) ──
let _gridSearchQuery = '';
let _gridSortPopular = false;
let _gridOrderSeed = null;
const _playlistStats = new Map(); // id -> { tracks, totalPlays }

function shuffleArrayCopy(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Считаем реальное кол-во треков и суммарные прослушивания прямо из Firestore —
// цифры всегда актуальны, даже если трек добавили только что
async function loadPlaylistStats(pl) {
  if (_playlistStats.has(pl.id)) return _playlistStats.get(pl.id);
  try {
    const snap = await getDocs(query(collection(db, 'tracks'), where('playlists', 'array-contains', pl.firebaseKey)));
    let totalPlays = 0;
    snap.forEach(d => { totalPlays += (d.data().plays || 0); });
    const stats = { tracks: snap.size, totalPlays };
    _playlistStats.set(pl.id, stats);
    return stats;
  } catch (e) {
    const stats = { tracks: 0, totalPlays: 0 };
    _playlistStats.set(pl.id, stats);
    return stats;
  }
}

function fmtPlays(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

window.renderPlaylistsGrid = function() {
  const grid = document.getElementById('plGrid');
  if (!grid) return;

  let list = PLAYLISTS.slice();

  if (_gridSearchQuery) {
    const q = _gridSearchQuery.toLowerCase();
    list = list.filter(pl => pl.title.toLowerCase().includes(q));
  }

  if (_gridSortPopular) {
    list.sort((a, b) => (_playlistStats.get(b.id)?.totalPlays || 0) - (_playlistStats.get(a.id)?.totalPlays || 0));
  } else {
    if (!_gridOrderSeed) _gridOrderSeed = shuffleArrayCopy(PLAYLISTS).map(p => p.id);
    list.sort((a, b) => _gridOrderSeed.indexOf(a.id) - _gridOrderSeed.indexOf(b.id));
  }

  const countBadge = document.getElementById('plCountBadge');
  if (countBadge) countBadge.textContent = `${list.length} плейлист${list.length === 1 ? '' : list.length < 5 ? 'а' : 'ов'}`;

  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#999;">Плейлисты не найдены</div>`;
    return;
  }

  grid.innerHTML = list.map((pl, idx) => {
    const stats = _playlistStats.get(pl.id);
    const trackLabel = stats ? `${stats.tracks} треков` : '···';
    const playsLabel = stats ? `👁 ${fmtPlays(stats.totalPlays)}` : '···';
    return `
    <div class="pl-card" data-id="${pl.id}" onclick="openPlaylist(${pl.id})" style="animation-delay:${(idx * 0.03).toFixed(2)}s">
      <div class="pl-card-cover">
        <img src="${pl.cover}" alt="${pl.title}" ${pl.coverGif ? `onmouseover="this.src='${pl.coverGif}'" onmouseout="this.src='${pl.cover}'"` : ''}>
 <div class="pl-track-badge">${trackLabel}</div>
        <div class="pl-plays-badge" style="position:absolute;z-index:5;bottom:8px;right:8px;padding:3px 9px;border-radius:100px;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);color:#fff;font-size:10.5px;font-weight:600;letter-spacing:.02em;">${playsLabel}</div>
        <div class="pl-card-overlay">
          <button class="pl-play-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21"/></svg>
          </button>
        </div>
      </div>
      <div class="pl-card-info">
        <div class="pl-card-title">${pl.title}</div>
        <div class="pl-card-desc">${pl.desc}</div>
        <div class="pl-card-meta"><span class="pl-tag${pl.gold ? ' pl-tag-gold' : ''}">${pl.tag}</span></div>
      </div>
    </div>`;
  }).join('');
};

async function loadAllPlaylistStatsAndRender() {
  await Promise.all(PLAYLISTS.map(pl => loadPlaylistStats(pl)));
  renderPlaylistsGrid();
}

window.setPlaylistSearch = function(val) {
  _gridSearchQuery = (val || '').trim();
  renderPlaylistsGrid();
};

window.togglePopularSort = function() {
  _gridSortPopular = !_gridSortPopular;
  const btn = document.getElementById('plPopularBtn');
  if (btn) {
    btn.style.background = _gridSortPopular ? '#8B1A2F' : '#fff';
    btn.style.color = _gridSortPopular ? '#fff' : '#555';
    btn.style.borderColor = _gridSortPopular ? '#8B1A2F' : '#e5e5e5';
  }
  renderPlaylistsGrid();
};

const _plSearchInput = document.getElementById('plSearchInput');
if (_plSearchInput) {
  let _searchDebounce = null;
  _plSearchInput.addEventListener('input', (e) => {
    clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(() => setPlaylistSearch(e.target.value), 150);
  });
}

renderPlaylistsGrid();
loadAllPlaylistStatsAndRender();

// ── ССЫЛКА НА КАРТОЧКУ АРТИСТА (если она есть) ──
const _artistCardCache = new Map(); // uid -> true/false (есть активная карточка или нет)

async function artistHasCard(uid) {
  if (!uid) return false;
  if (_artistCardCache.has(uid)) return _artistCardCache.get(uid);
  try {
    const snap = await getDocs(query(
      collection(db, 'artistApplications'),
      where('uid', '==', uid),
      where('status', '==', 'active'),
      limit(1)
    ));
    const exists = !snap.empty;
    _artistCardCache.set(uid, exists);
    return exists;
  } catch (e) {
    _artistCardCache.set(uid, false);
    return false;
  }
}

window.openArtistOverlay = function(uid) {
  if (!uid) return;
  const existing = document.getElementById('artistOverlayModal');
  if (existing) existing.remove();
  const ov = document.createElement('div');
  ov.id = 'artistOverlayModal';
  ov.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
  ov.innerHTML = `
    <div style="position:relative;width:100%;max-width:480px;height:92vh;max-height:900px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,0.4);">
      <button id="artistOverlayClose" style="position:absolute;top:14px;left:14px;z-index:10;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,0.4);backdrop-filter:blur(6px);border:none;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <iframe src="artists.html?artist=${uid}" style="width:100%;height:100%;border:none;"></iframe>
    </div>`;
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
  document.getElementById('artistOverlayClose').addEventListener('click', () => {
    ov.remove();
    document.body.style.overflow = '';
  });
  ov.addEventListener('click', (e) => { if (e.target === ov) { ov.remove(); document.body.style.overflow = ''; } });
};

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── ЦВЕТ ФОНА ИЗ ОБЛОЖКИ ──
function extractColor(imgEl, callback) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 10;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function() {
    ctx.drawImage(img, 0, 0, 10, 10);
    const d = ctx.getImageData(0, 0, 10, 10).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
    const px = d.length / 4;
    callback(Math.round(r/px), Math.round(g/px), Math.round(b/px));
  };
  img.src = imgEl.src;
}

function applyModalColor(r, g, b) {
  const top = document.querySelector('.pl-modal-top');
  if (top) {
    top.style.background = `linear-gradient(135deg, rgba(${r},${g},${b},0.18) 0%, rgba(${r},${g},${b},0.04) 100%)`;
  }
}

// ── OPEN PLAYLIST ──
window.openPlaylist = async function(id) {
  window._currentPlaylistId = id;

  const panel = document.getElementById('plCommentsPanel');
  if (panel) panel.classList.remove('open');
  _commentsOpenId = null;
  const container = document.getElementById('plCommentsContainer');
  if (container) container.innerHTML = '';

  const pl = PLAYLISTS.find(p => p.id === id);
  if (!pl) return;

  document.getElementById('plModalCover').src = pl.coverGif || pl.cover;
  document.getElementById('plModalTitle').textContent = pl.title;
  document.getElementById('plModalDesc').textContent = pl.desc;

  const tracksEl = document.getElementById('plModalTracks');
  tracksEl.innerHTML = `
  <div style="padding:40px 30px;text-align:center;">
    <div style="position:relative;width:64px;height:64px;margin:0 auto 16px;">
      <div style="position:absolute;inset:0;border-radius:50%;border:3px solid #f0f0f0;"></div>
      <div style="position:absolute;inset:0;border-radius:50%;border:3px solid transparent;border-top-color:#8B1A2F;animation:pl-spin 0.9s linear infinite;"></div>
      <img src="assets/icons/logonew/zegr.png" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:14px;border-radius:50%;">
    </div>
    <div style="font-size:12px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#8B1A2F;animation:pl-fade-pulse 1.4s ease-in-out infinite;">Загрузка</div>
    <style>
      @keyframes pl-spin { to { transform: rotate(360deg); } }
      @keyframes pl-fade-pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
    </style>
  </div>`;

  document.getElementById('plModal').classList.add('open');
  document.body.style.overflow = 'hidden';

  setTimeout(() => {
    extractColor(document.getElementById('plModalCover'), applyModalColor);
  }, 100);

const likeBtn = document.getElementById('plLikeBtn');
  likeBtn.classList.remove('liked');
  document.getElementById('plLikeIcon').src = 'assets/icons/like2.png';

  if (currentUser) {
    try {
      const likeSnap = await getDoc(doc(db, 'playlistLikes', `${currentUser.uid}_${pl.id}`));
      if (likeSnap.exists()) {
        likeBtn.classList.add('liked');
        document.getElementById('plLikeIcon').src = 'assets/icons/like.png';
      }
    } catch (e) {}
  }

  try {
    const q = query(
      collection(db, 'tracks'),
      where('playlists', 'array-contains', pl.firebaseKey),
      orderBy('addedAt', 'desc')
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      tracksEl.innerHTML = '<div style="padding:30px;text-align:center;color:#666;font-size:13px;">Треков пока нет</div>';
      return;
    }

const list = document.createElement('div');
    list.className = 'new-tracks-list';
    let i = 1;

    shuffleArray(snap.docs).forEach(d => {
      const t = d.data();
      const cover = t.coverUrl || 'assets/icons/mountain.png';
      const coverStyle = t.coverUrl ? '' : 'style="padding:8px;filter:invert(0.7);"';
      const mm = Math.floor((t.duration||0)/60), ss = Math.floor((t.duration||0)%60).toString().padStart(2,'0');
      const dur = t.duration ? `${mm}:${ss}` : '-';

const artistText = t.artist || 'Артист';
      const artistUid = t.userId || '';
      const isLong = artistText.length > 20;
      const artistHtml = isLong
        ? `<div class="new-track-artist marquee" data-uid="${artistUid}"><span>${artistText}&nbsp;&nbsp;&nbsp;&nbsp;${artistText}</span></div>`
        : `<div class="new-track-artist" data-uid="${artistUid}"><span>${artistText}</span></div>`;

      const row = document.createElement('div');
      row.className = 'new-track-row';
      row.innerHTML = `
        <span class="new-track-num">${i++}</span>
        <div class="new-track-cover-wrap">
          <img class="new-track-cover" src="${cover}" alt="" ${coverStyle}>
          <div class="new-track-play-overlay"><img src="assets/icons/play.png" alt="" style="filter:invert(1);width:16px;height:16px;"></div>
        </div>
        <div class="new-track-info">
          <div class="new-track-name">${t.title || 'Без названия'}</div>
          ${artistHtml}
        </div>
        <div class="new-track-actions">
          <span class="new-track-duration">${dur}</span>
          <button class="new-track-btn like-btn" data-likes="${t.likes||0}">
            <img src="assets/icons/like2.png" alt=""> <span>${t.likes||0}</span>
          </button>
          <button class="new-track-btn share-btn">
            <img src="assets/icons/share.png" alt="">
          </button>
          <button class="new-track-btn">
            <img src="assets/icons/play.png" alt="" style="filter:invert(0.5);"> <span>${t.plays||0}</span>
          </button>
        </div>
        <div class="new-track-progress-wrap" style="display:none;">
          <div class="new-track-progress-bar"><div class="new-track-progress-fill"></div></div>
          <span class="new-track-progress-time">0:00</span>
        </div>`;

      row.querySelector('.new-track-cover-wrap').addEventListener('click', () => {
        const url = t.trackUrl; if (!url) return;
        const fill = row.querySelector('.new-track-progress-fill');
        const timeEl = row.querySelector('.new-track-progress-time');
        const prog = row.querySelector('.new-track-progress-wrap');
        const overlay = row.querySelector('.new-track-play-overlay img');
if (currentAudio && currentRow === row && !currentAudio.paused) {
          currentAudio.pause(); overlay.src = 'assets/icons/play.png';
          document.getElementById('plNowPlayingLoader')?.classList.remove('active');
          document.querySelector('.pl-modal-cover-wrap')?.classList.remove('playing');
          return;
        }
        if (currentAudio) {
          currentAudio.pause();
          if (currentRow) {
            currentRow.querySelector('.new-track-play-overlay img').src = 'assets/icons/play.png';
            currentRow.querySelector('.new-track-progress-wrap').style.display = 'none';
          }
          document.querySelector('.pl-modal-cover-wrap')?.classList.remove('playing');
        }
currentAudio = new Audio(url); currentRow = row;
        // Обновляем нижний плеер
        const barName = document.querySelector('.player-track-name');
        const barArtist = document.querySelector('.player-track-artist');
        const barThumb = document.querySelector('.player-thumb img');
        const barPlayBtn = document.querySelector('.player-btn-main img');
        const barFill = document.querySelector('.progress-fill');
        const barTime = document.querySelectorAll('.player-time');
if (barName) {
          barName.textContent = t.title || 'Без названия';
          barName.classList.toggle('marquee', (t.title||'').length > 20);
        }
        if (barArtist) {
          barArtist.textContent = t.artist || '992MUZ';
          barArtist.classList.toggle('marquee', (t.artist||'').length > 20);
        }
        const barPlaylist = document.getElementById('barPlaylist');
        if (barPlaylist) barPlaylist.textContent = pl.title || '';
        if (barThumb) { barThumb.src = cover; barThumb.style = t.coverUrl ? '' : 'padding:8px;filter:invert(0.7);'; }
const barFillEl = document.getElementById('barProgressFill');
        if (barFillEl) barFillEl.style.width = '0%';
        const barTimeCur = document.getElementById('barTimeCur');
        if (barTimeCur) barTimeCur.textContent = '0:00';
const barProgressBar = document.getElementById('barProgressBar');
        if (barProgressBar) {
          barProgressBar.onclick = (e) => {
            if (!currentAudio || !currentAudio.duration) return;
            const rect = barProgressBar.getBoundingClientRect();
            currentAudio.currentTime = ((e.clientX - rect.left) / rect.width) * currentAudio.duration;
          };
        }
        currentAudio.addEventListener('ended', () => { if (barPlayBtn) barPlayBtn.src = 'assets/icons/play.png'; if (barFill) barFill.style.width='0%'; stopVisualizer(); });

prog.style.display = 'flex'; overlay.src = 'assets/icons/pause.png';
        const coverWrap = document.querySelector('.pl-modal-cover-wrap');
        if (coverWrap) coverWrap.classList.add('playing');

        currentAudio.addEventListener('timeupdate', () => {
          if (!currentAudio.duration) return;
          fill.style.width = (currentAudio.currentTime/currentAudio.duration*100)+'%';
          const m2=Math.floor(currentAudio.currentTime/60), s2=Math.floor(currentAudio.currentTime%60).toString().padStart(2,'0');
          timeEl.textContent = `${m2}:${s2}`;
        });
currentAudio.addEventListener('ended', () => {
          overlay.src='assets/icons/play.png'; fill.style.width='0%'; prog.style.display='none';
          document.getElementById('plNowPlayingLoader')?.classList.remove('active');
          document.querySelector('.pl-modal-cover-wrap')?.classList.remove('playing');
          advanceAfterTrackEnd(row);
        });
currentAudio.play().catch(err => console.warn('audio play error', err));
        startVisualizer(currentAudio);
        updateDoc(doc(db,'tracks',d.id),{plays:(t.plays||0)+1});
      });

      row.querySelector('.like-btn').addEventListener('click', async e => {
        const btn = e.currentTarget;
        const cur = parseInt(btn.dataset.likes)||0;
        const isLiked = btn.classList.contains('liked');
        const nv = isLiked ? cur-1 : cur+1;
        btn.dataset.likes = nv; btn.querySelector('span').textContent = nv;
        btn.querySelector('img').src = isLiked ? 'assets/icons/like2.png' : 'assets/icons/like.png';
        btn.classList.toggle('liked');
        await updateDoc(doc(db,'tracks',d.id),{likes:nv});
      });

      row.querySelector('.share-btn').addEventListener('click', () => {
        if (navigator.share) navigator.share({title:t.title, url:t.trackUrl});
        else navigator.clipboard.writeText(t.trackUrl||'');
      });

      list.appendChild(row);
    });

tracksEl.innerHTML = '';
    tracksEl.appendChild(list);

    // если у артиста есть активная карточка — делаем имя кликабельным (открывает карточку поверх плейлиста)
    list.querySelectorAll('.new-track-artist[data-uid]').forEach(async (el) => {
      const uid = el.dataset.uid;
      if (!uid) return;
      const hasCard = await artistHasCard(uid);
      if (hasCard) {
        el.style.cursor = 'pointer';
        el.style.textDecoration = 'underline';
        el.style.textUnderlineOffset = '2px';
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          openArtistOverlay(uid);
        });
      }
    });

  } catch(e) {
    console.error(e);
    tracksEl.innerHTML = '<div style="padding:30px;text-align:center;color:#e74c3c;font-size:13px;">Ошибка загрузки</div>';
  }
};

// ── АВТООТКРЫТИЕ ПО ССЫЛКЕ ?pl=... (лента плейлистов с главной страницы) ──
(function() {
  const params = new URLSearchParams(window.location.search);
  const plKey = params.get('pl');
  if (!plKey) return;
  const pl = PLAYLISTS.find(p => p.firebaseKey === plKey);
  if (pl) openPlaylist(pl.id);
})();

window.closePlaylist = function() {
  document.getElementById('plModal').classList.remove('open');
  document.body.style.overflow = '';
  const panel = document.getElementById('plCommentsPanel');
  if (panel) panel.classList.remove('open');
  _commentsOpenId = null;
  // если плейлист открыт как превью-оверлей с главной (внутри iframe) — сообщаем родительской странице закрыть обёртку
  if (window.parent && window.parent !== window && new URLSearchParams(window.location.search).get('pl')) {
    window.parent.postMessage({ type: 'closePlStripModal' }, '*');
  }
};
window.handleModalClick = function(e) {
  if (e.target === document.getElementById('plModal')) closePlaylist();
};

window.toggleLike = async function(btn) {
  if (!currentUser) {
    alert('Войди в аккаунт, чтобы сохранять плейлисты');
    window.location.href = 'login.html';
    return;
  }
  const id = window._currentPlaylistId;
  const pl = PLAYLISTS.find(p => p.id === id);
  if (!pl) return;

  const liked = btn.classList.toggle('liked');
  document.getElementById('plLikeIcon').src = liked ? 'assets/icons/like.png' : 'assets/icons/like2.png';

  const likeDocId = `${currentUser.uid}_${pl.id}`;
  try {
    if (liked) {
      await setDoc(doc(db, 'playlistLikes', likeDocId), {
        uid: currentUser.uid,
        playlistId: pl.id,
        title: pl.title,
        cover: pl.cover,
        tag: pl.tag || '',
        createdAt: Date.now(),
      });
    } else {
      await deleteDoc(doc(db, 'playlistLikes', likeDocId));
    }
  } catch (e) {
    console.warn('playlist like error', e);
    btn.classList.toggle('liked'); // откатываем если запись не удалась
    document.getElementById('plLikeIcon').src = liked ? 'assets/icons/like2.png' : 'assets/icons/like.png';
  }
};

window.openComments = function() {
  const panel = document.getElementById('plCommentsPanel');
  const container = document.getElementById('plCommentsContainer');
  const currentId = window._currentPlaylistId;
  if (panel.classList.contains('open') && _commentsOpenId === currentId) {
    panel.classList.remove('open');
    _commentsOpenId = null;
    return;
  }
  container.innerHTML = '';
  initComments('playlist_' + currentId, 'plCommentsContainer');
  panel.classList.add('open');
  _commentsOpenId = currentId;
};

window.closeCommentPanel = function() {
  document.getElementById('plCommentsPanel').classList.remove('open');
  _commentsOpenId = null;
};

// ── РЕЖИМ ВОСПРОИЗВЕДЕНИЯ ──
let _currentMode = 'normal';

window.setMode = function(mode) {
  _currentMode = mode;
  document.querySelectorAll('.pl-mode-btn').forEach(b => b.classList.remove('active'));
  const map = { normal: 'modeNormal', shuffle: 'modeShuffle', repeat1: 'modeRepeat1', repeatAll: 'modeRepeatAll', nonstop: 'modeRepeatNonstop' };
  const btn = document.getElementById(map[mode]);
  if (btn) btn.classList.add('active');
};

const _plPlayAllBtn = document.getElementById('plPlayAllBtn');
if (_plPlayAllBtn) {
  _plPlayAllBtn.addEventListener('click', () => {
    const rows = [...document.querySelectorAll('.new-track-row')];
    if (!rows.length) return;
    const startIdx = _currentMode === 'shuffle' ? Math.floor(Math.random() * rows.length) : 0;
    rows[startIdx].querySelector('.new-track-cover-wrap').click();
  });
}
// ── ГЛОБАЛЬНЫЕ КНОПКИ ──
window.playAllPlaylists = function() {
  alert('Запуск всех плейлистов подряд - подключи к плееру!');
};

window.shuffleAllPlaylists = function() {
  alert('Случайный порядок всех плейлистов - подключи к плееру!');
};

// ── ПРЕВЬЮ ПРИ НАВЕДЕНИИ ──
let _previewTimeout = null;
let _previewAudio = null;

document.querySelectorAll('.pl-card').forEach(function(card) {
  card.addEventListener('mouseenter', function() {
    _previewTimeout = setTimeout(() => {}, 600);
  });
  card.addEventListener('mouseleave', function() {
    clearTimeout(_previewTimeout);
    if (_previewAudio) { _previewAudio.pause(); _previewAudio = null; }
  });
});
// ── ЧАСТИЦЫ ──
let _particleCanvas = null;
let _particleRAF = null;

function startParticles(wrap, coverImg) {
  stopParticles();

  const canvas = document.createElement('canvas');
  canvas.style.cssText = `
    position:absolute;inset:-40px;width:calc(100% + 80px);height:calc(100% + 80px);
    pointer-events:none;z-index:3;border-radius:20px;
  `;
  wrap.appendChild(canvas);
  _particleCanvas = canvas;

  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight;
  canvas.width = W;
  canvas.height = H;

  const cx = W / 2, cy = H / 2;
  const coverR = Math.min(W, H) / 2 - 40;

  const COLORS = ['#cc0000','#ff4444','#009a44','#00cc55','#ffffff','#ffcccc','#ccffdd'];

  const particles = [];
  function spawnParticle() {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.4 + Math.random() * 1.2;
    particles.push({
      x: cx + Math.cos(angle) * coverR,
      y: cy + Math.sin(angle) * coverR,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 1.5 + Math.random() * 3,
      alpha: 0.8 + Math.random() * 0.2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 0,
      maxLife: 40 + Math.random() * 60,
    });
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);

    if (Math.random() < 0.6) spawnParticle();

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 0.01;
      p.life++;
      p.alpha = (1 - p.life / p.maxLife) * 0.9;
      p.r *= 0.99;

      if (p.life >= p.maxLife || p.r < 0.3) { particles.splice(i, 1); continue; }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    _particleRAF = requestAnimationFrame(loop);
  }

  loop();
}

function stopParticles() {
  if (_particleRAF) { cancelAnimationFrame(_particleRAF); _particleRAF = null; }
  if (_particleCanvas) { _particleCanvas.remove(); _particleCanvas = null; }
}
// ── НИЖНИЙ ПЛЕЕР: кнопка плей/пауза и свайп ──
(function() {
  const playBtn = document.getElementById('barPlayBtn');
  const bar = document.getElementById('playerBar');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (!currentAudio) return;
if (currentAudio.paused) {
        currentAudio.play();
        document.getElementById('barPlayIcon').src = 'assets/icons/pause.png';
        document.querySelector('.pl-modal-cover-wrap')?.classList.add('playing');

        if (currentRow) {
          currentRow.querySelector('.new-track-play-overlay img').src = 'assets/icons/pause.png';
        }
      } else {
        currentAudio.pause();
        document.getElementById('barPlayIcon').src = 'assets/icons/play.png';
        document.querySelector('.pl-modal-cover-wrap')?.classList.remove('playing');
        document.getElementById('plNowPlayingLoader')?.classList.remove('active');
        if (currentRow) {
          currentRow.querySelector('.new-track-play-overlay img').src = 'assets/icons/play.png';
        }
      }
    });
  }

  // Свайп на мобильном / drag на десктопе
  let startX = 0;
  if (bar) {
    bar.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    bar.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 60) dx < 0 ? playNext() : playPrev();
    });
    let mouseDown = false;
    bar.addEventListener('mousedown', e => { startX = e.clientX; mouseDown = true; });
    bar.addEventListener('mouseup', e => {
      if (!mouseDown) return; mouseDown = false;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 80) dx < 0 ? playNext() : playPrev();
    });
  }
})();

// ── СЛЕДУЮЩИЙ / ПРЕДЫДУЩИЙ ──
function advanceAfterTrackEnd(row) {
  const rows = [...document.querySelectorAll('.new-track-row')];
  const idx = rows.indexOf(row);
  if (idx === -1 || !rows.length) return;

  if (_currentMode === 'repeat1') {
    rows[idx].querySelector('.new-track-cover-wrap').click();
  } else if (_currentMode === 'shuffle') {
    let nextIdx = idx;
    if (rows.length > 1) { while (nextIdx === idx) nextIdx = Math.floor(Math.random() * rows.length); }
    rows[nextIdx].querySelector('.new-track-cover-wrap').click();
  } else if (_currentMode === 'repeatAll' || _currentMode === 'nonstop') {
    const nextIdx = (idx + 1) % rows.length;
    rows[nextIdx].querySelector('.new-track-cover-wrap').click();
  } else {
    // normal — просто по порядку, останавливаемся на последнем треке
    if (idx < rows.length - 1) rows[idx + 1].querySelector('.new-track-cover-wrap').click();
  }
}

function playNext() {
  if (!currentRow) return;
  const rows = [...document.querySelectorAll('.new-track-row')];
  const idx = rows.indexOf(currentRow);
  if (idx >= 0 && idx < rows.length - 1) rows[idx + 1].querySelector('.new-track-cover-wrap').click();
}
function playPrev() {
  if (!currentRow) return;
  const rows = [...document.querySelectorAll('.new-track-row')];
  const idx = rows.indexOf(currentRow);
  if (idx > 0) rows[idx - 1].querySelector('.new-track-cover-wrap').click();
}
// ── ВИЗУАЛИЗАТОР ──
let _vizCtx = null;
let _vizRAF = null;
let _analyser = null;
let _audioCtx = null;

function startVisualizer(audio) {
  const canvas = document.getElementById('barVisualizer');
  if (!canvas) return;
  _vizCtx = canvas.getContext('2d');

  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = _audioCtx.createMediaElementSource(audio);
    _analyser = _audioCtx.createAnalyser();
    _analyser.fftSize = 64;
    source.connect(_analyser);
    _analyser.connect(_audioCtx.destination);
  }
  // Браузер иногда сам приостанавливает AudioContext — без этого звук пропадает,
  // хотя трек внешне продолжает "играть" (прогресс-бар идёт)
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }

  const bufLen = _analyser.frequencyBinCount;
  const dataArr = new Uint8Array(bufLen);
  const W = canvas.width, H = canvas.height;
  const barW = W / bufLen * 2;

  function draw() {
    _vizRAF = requestAnimationFrame(draw);
    _analyser.getByteFrequencyData(dataArr);
    _vizCtx.clearRect(0, 0, W, H);
    for (let i = 0; i < bufLen; i++) {
      const barH = (dataArr[i] / 255) * H;
      const alpha = 0.5 + (dataArr[i] / 255) * 0.5;
      _vizCtx.fillStyle = `rgba(139,26,47,${alpha})`;
      _vizCtx.fillRect(i * (barW + 1), H - barH, barW, barH);
    }
  }
  draw();
}

function stopVisualizer() {
  if (_vizRAF) { cancelAnimationFrame(_vizRAF); _vizRAF = null; }
  const canvas = document.getElementById('barVisualizer');
  if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
}