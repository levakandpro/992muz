/**
 * comments-section.js — универсальный компонент комментариев PamirNation
 *
 * ПОДКЛЮЧЕНИЕ (одна строка):
 *   import { initComments } from './js/components/comments-section.js';
 *   initComments('profile_UID123', 'commentsContainer');
 *
 * ПАРАМЕТРЫ initComments(entityId, containerId):
 *   entityId    — уникальный ID сущности (uid профиля, id трека, id альбома...)
 *   containerId — id HTML-элемента куда рендерить
 *
 * СТРУКТУРА FIRESTORE:
 *   comments/{entityId}/messages/{commentId}  — коммент
 *   comments/{entityId}/messages/{commentId}/replies/{replyId} — ответ
 */

import { auth, db } from '../config/firebase.js';
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, onSnapshot, getDoc,
  limit, startAfter, getCountFromServer
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ========== АНТИСПАМ ==========
// uid -> { lastTs: number, count: number }
const _spamMap = new Map();
const SPAM_WINDOW_MS = 60_000; // окно 1 минута
const SPAM_MAX       = 5;       // максимум сообщений за окно

function checkSpam(uid) {
  const now = Date.now();
  const entry = _spamMap.get(uid) || { lastTs: 0, count: 0 };
  if (now - entry.lastTs > SPAM_WINDOW_MS) {
    _spamMap.set(uid, { lastTs: now, count: 1 });
    return false; // ок
  }
  entry.count++;
  entry.lastTs = now;
  _spamMap.set(uid, entry);
  return entry.count > SPAM_MAX; // true = спам
}

// ========== КЭШ СЧЁТЧИКОВ РЕПЛАЕВ ==========
// commentId -> number
const _replyCounts = new Map();

// ========== УТИЛИТЫ ==========
// Живое время: возвращает { text, nextMs } — через сколько мс перечитать
function timeAgoLive(ts) {
  if (!ts) return { text: '', nextMs: 60_000 };
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)      return { text: 'только что',                             nextMs: 30_000 };
  if (diff < 3600)    return { text: `${Math.floor(diff / 60)} мин назад`,     nextMs: 60_000 };
  if (diff < 86400)   return { text: `${Math.floor(diff / 3600)} ч назад`,     nextMs: 600_000 };
  if (diff < 2592000) return { text: `${Math.floor(diff / 86400)} д назад`,    nextMs: 3_600_000 };
  return { text: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), nextMs: 0 };
}

function timeAgo(ts) {
  return timeAgoLive(ts).text;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Подсветка @упоминаний
function highlightMentions(text) {
  return escHtml(text).replace(
    /@([\w\u0400-\u04FF.-]{1,32})/g,
    '<a class="pn-mention" href="public-profile.html?username=$1">@$1</a>'
  );
}


function injectStyles() {
  if (document.getElementById('pn-comments-style')) return;
  const style = document.createElement('style');
  style.id = 'pn-comments-style';
  style.textContent = `
    .pn-comments { margin-top: 24px; }
.pn-comments-title {
      font-size: 15px; font-weight: 700; color: var(--pr-text);
      margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
    }
    .pn-info-btn {
      width: 18px; height: 18px; border-radius: 50%;
      border: 1.5px solid var(--pr-text3); background: none;
      color: var(--pr-text3); font-size: 11px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all 0.15s; flex-shrink: 0;
    }
    .pn-info-btn:hover { border-color: var(--pr-accent); color: var(--pr-accent); }
    .pn-info-modal {
      position: fixed; inset: 0; z-index: 20000;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
    }
.pn-info-box {
      background: var(--pr-bg2, #fff); border-radius: 20px;
      padding: 20px 24px; width: 420px; max-width: calc(100vw - 32px);
      box-shadow: 0 24px 80px rgba(0,0,0,0.3);
    }
    .pn-info-box h3 { font-size: 15px; font-weight: 700; margin-bottom: 10px; color: var(--pr-text); }
    .pn-info-box p { font-size: 13px; color: var(--pr-text3); line-height: 1.4; margin-bottom: 6px; display: flex; align-items: flex-start; gap: 6px; }
    .pn-info-close {
      margin-top: 14px; width: 100%; padding: 10px; border-radius: 12px;
      background: var(--pr-accent); border: none; color: #fff;
      font-size: 13px; font-weight: 600; cursor: pointer; display: block;
      font-family: 'Inter', sans-serif;
    }
    .pn-comments-title .pn-count {
      font-size: 12px; font-weight: 500; color: var(--pr-text3);
      background: var(--pr-bg3); padding: 2px 8px; border-radius: 100px;
    }

    /* ФОРМА */
    .pn-comment-form {
      display: flex; gap: 10px; align-items: flex-start; margin-bottom: 20px;
    }
    .pn-comment-form .pn-ava {
      width: 34px; height: 34px; border-radius: 50%;
      object-fit: cover; flex-shrink: 0; background: var(--pr-bg3);
    }
    .pn-comment-input-wrap { flex: 1; position: relative; }
    .pn-comment-input {
      width: 100%; background: var(--pr-input-bg);
      border: 1px solid var(--pr-input-border);
      border-radius: 12px; padding: 10px 44px 10px 14px;
      color: var(--pr-text); font-size: 13px;
      font-family: 'Inter', sans-serif;
      outline: none; resize: none; min-height: 42px;
      max-height: 140px; overflow-y: auto;
      transition: border-color .2s;
      line-height: 1.5;
    }
    .pn-comment-input:focus { border-color: var(--pr-accent); }
    .pn-comment-input::placeholder { color: var(--pr-text3); }
    .pn-comment-send {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; padding: 4px;
      opacity: 0.5; transition: opacity .2s;
    }
    .pn-comment-send:hover { opacity: 1; }
    .pn-comment-send svg { width: 20px; height: 20px; fill: var(--pr-accent); display: block; }
    .pn-auth-hint {
      text-align: center; padding: 16px; font-size: 13px;
      color: var(--pr-text3); background: var(--pr-bg3);
      border-radius: 12px; margin-bottom: 16px;
    }
    .pn-auth-hint a { color: var(--pr-accent); text-decoration: none; font-weight: 600; }

    /* СПИСОК */
    .pn-comments-list { display: flex; flex-direction: column; gap: 0; }

    /* КОММЕНТ */
    .pn-comment {
      display: flex; gap: 10px; padding: 14px 0;
      border-bottom: 1px solid var(--pr-border);
    }
    .pn-comment:last-child { border-bottom: none; }
    .pn-comment-ava {
      width: 36px; height: 36px; border-radius: 50%;
      object-fit: cover; flex-shrink: 0; background: var(--pr-bg3);
    }
    .pn-comment-body { flex: 1; min-width: 0; }
    .pn-comment-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;
    }
    .pn-comment-name {
      font-size: 13px; font-weight: 600; color: var(--pr-text);
      text-decoration: none;
    }
    .pn-comment-name:hover { color: var(--pr-accent); }
    .pn-comment-time { font-size: 11px; color: var(--pr-text3); }
    .pn-comment-text {
      font-size: 13px; color: var(--pr-text); line-height: 1.6;
      word-break: break-word; white-space: pre-wrap;
    }
    .pn-comment-actions {
      display: flex; gap: 14px; margin-top: 8px; align-items: center;
    }
    .pn-comment-action {
      display: flex; align-items: center; gap: 4px;
      background: none; border: none; cursor: pointer;
      font-size: 11px; color: var(--pr-text3);
      transition: color .2s; padding: 0; font-family: 'Inter', sans-serif;
    }
    .pn-comment-action:hover { color: var(--pr-accent); }
    .pn-comment-action.liked { color: var(--pr-accent); }
    .pn-comment-action svg { width: 14px; height: 14px; flex-shrink: 0; }
    .pn-comment-action.delete:hover { color: #e74c3c; }

    /* РЕПЛАИ */
    .pn-replies { margin-top: 10px; padding-left: 14px; border-left: 2px solid var(--pr-border); }
    .pn-reply { display: flex; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--pr-border); }
    .pn-reply:last-child { border-bottom: none; }
    .pn-reply-ava {
      width: 28px; height: 28px; border-radius: 50%;
      object-fit: cover; flex-shrink: 0; background: var(--pr-bg3);
    }

    /* ФОРМА ОТВЕТА */
    .pn-reply-form {
      display: flex; gap: 8px; align-items: flex-start;
      margin-top: 10px; padding-left: 14px;
    }
    .pn-reply-form .pn-ava {
      width: 28px; height: 28px; border-radius: 50%;
      object-fit: cover; flex-shrink: 0; background: var(--pr-bg3);
    }
    .pn-reply-input {
      flex: 1; background: var(--pr-input-bg);
      border: 1px solid var(--pr-input-border);
      border-radius: 10px; padding: 8px 38px 8px 12px;
      color: var(--pr-text); font-size: 12px;
      font-family: 'Inter', sans-serif;
      outline: none; resize: none;
      min-height: 36px; max-height: 100px;
      overflow-y: auto; transition: border-color .2s;
    }
    .pn-reply-input:focus { border-color: var(--pr-accent); }
    .pn-reply-input::placeholder { color: var(--pr-text3); }
    .pn-reply-send {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer;
      padding: 3px; opacity: 0.5; transition: opacity .2s;
    }
    .pn-reply-send:hover { opacity: 1; }
    .pn-reply-send svg { width: 16px; height: 16px; fill: var(--pr-accent); }
    .pn-reply-input-wrap { flex: 1; position: relative; }

    /* ЗАГРУЗКА */
    .pn-comments-loading {
      text-align: center; padding: 20px; font-size: 13px; color: var(--pr-text3);
    }
    .pn-empty {
      text-align: center; padding: 24px; font-size: 13px; color: var(--pr-text3);
    }
    .pn-load-more {
      width: 100%; padding: 10px; margin-top: 12px;
      background: var(--pr-bg3); border: none; border-radius: 10px;
      color: var(--pr-text2); font-size: 13px; cursor: pointer;
      transition: background .2s; font-family: 'Inter', sans-serif;
    }
    .pn-load-more:hover { background: var(--pr-border); }

    /* УПОМИНАНИЯ */
    .pn-mention {
      color: var(--pr-accent); font-weight: 600; text-decoration: none;
    }
    .pn-mention:hover { text-decoration: underline; }

    /* БЕЙДЖ АРТИСТА */
    .pn-badge-artist {
      font-size: 10px; font-weight: 600; letter-spacing: .3px;
      background: var(--pr-accent); color: #fff;
      border-radius: 4px; padding: 1px 5px;
    }

    /* СЧЁТЧИК СИМВОЛОВ */
    .pn-char-counter {
      font-size: 10px; color: var(--pr-text3);
      position: absolute; right: 38px; bottom: 8px;
      pointer-events: none;
    }
    .pn-char-counter.warn { color: #e67e22; }
    .pn-char-counter.over { color: #e74c3c; font-weight: 600; }

    /* РЕДАКТИРОВАНИЕ */
    .pn-edit-wrap {
      margin-top: 6px; position: relative;
    }
    .pn-edit-textarea {
      width: 100%; background: var(--pr-input-bg);
      border: 1px solid var(--pr-accent);
      border-radius: 10px; padding: 8px 12px;
      color: var(--pr-text); font-size: 13px;
      font-family: 'Inter', sans-serif;
      outline: none; resize: none;
      min-height: 38px; max-height: 140px; overflow-y: auto;
      line-height: 1.5; box-sizing: border-box; width: 100%;
    }
    .pn-edit-actions { display: flex; gap: 8px; margin-top: 6px; }
    .pn-edit-save, .pn-edit-cancel {
      font-size: 12px; padding: 4px 12px; border-radius: 8px;
      border: none; cursor: pointer; font-family: 'Inter', sans-serif;
    }
    .pn-edit-save   { background: var(--pr-accent); color: #fff; }
    .pn-edit-cancel { background: var(--pr-bg3); color: var(--pr-text2); }
  `;
  document.head.appendChild(style);
}

// ========== ГЛАВНАЯ ФУНКЦИЯ ==========
// entityOwnerId — uid хозяина профиля/трека (для бейджа «артист»)
export async function initComments(entityId, containerId, { entityOwnerId = null } = {}) {
  injectStyles();

  const container = document.getElementById(containerId);
  if (!container) return;

  const PAGE_SIZE = 20;

  container.innerHTML = `
    <div class="pn-comments">
<div class="pn-comments-title">
        Комменты <span class="pn-count" id="pnCount_${entityId}">0</span>
        <button class="pn-info-btn" id="pnInfoBtn_${entityId}" style="display:none;">?</button>
      </div>
      <div id="pnForm_${entityId}"></div>
      <div class="pn-comments-list" id="pnList_${entityId}">
        <div class="pn-comments-loading">Загружаем...</div>
      </div>
      <button class="pn-load-more" id="pnMore_${entityId}" style="display:none;">
        Показать ещё
      </button>
    </div>`;

  const colRef = collection(db, 'comments', entityId, 'messages');

  // Слушаем текущего юзера
  let currentUser = auth.currentUser;
  let currentProfile = null;

  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
      const snap = await getDoc(doc(db, 'users', user.uid));
      currentProfile = snap.exists() ? snap.data() : null;
    } else {
      currentProfile = null;
    }
    renderForm(entityId, currentUser, currentProfile);
  });

  // ---- Пагинация ----
  let lastVisible = null;
  let totalCount  = 0;
  let loadedCount = 0;
  const list    = document.getElementById(`pnList_${entityId}`);
  const countEl = document.getElementById(`pnCount_${entityId}`);
  const moreBtn = document.getElementById(`pnMore_${entityId}`);

  // Общий счётчик (без чтения всех документов)
  try {
    const countSnap = await getCountFromServer(collection(db, 'comments', entityId, 'messages'));
    totalCount = countSnap.data().count;
    if (countEl) countEl.textContent = totalCount;
  } catch (_) { /* старый SDK — не критично */ }

  async function loadPage() {
    const q = lastVisible
      ? query(colRef, orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE))
      : query(colRef, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));

    const snap = await getDocs(q);

    if (snap.empty && loadedCount === 0) {
      list.innerHTML = '<div class="pn-empty">Будь первым - напиши коммент 👇</div>';
      if (countEl) countEl.textContent = '0';
      moreBtn.style.display = 'none';
      return;
    }

    if (loadedCount === 0) list.innerHTML = '';

    // Предзагружаем счётчики реплаев пачкой
for (const docSnap of snap.docs) {
      try {
        const repliesCol = collection(db, 'comments', entityId, 'messages', docSnap.id, 'replies');
        const rc = await getCountFromServer(repliesCol);
        _replyCounts.set(docSnap.id, rc.data().count);
      } catch (_) { _replyCounts.set(docSnap.id, null); }
      await new Promise(r => setTimeout(r, 100));
    }

    for (const docSnap of snap.docs) {
      const el = await renderComment(
        entityId, docSnap.id, docSnap.data(), currentUser, currentProfile, entityOwnerId
      );
      list.appendChild(el);
    }

    loadedCount += snap.size;
    lastVisible  = snap.docs[snap.docs.length - 1];

    // Показываем «Ещё» если есть что грузить
    moreBtn.style.display = loadedCount < totalCount ? 'block' : 'none';

    // Обновляем счётчик если getCountFromServer не сработал
    if (!totalCount && countEl) countEl.textContent = loadedCount;
  }

  moreBtn.addEventListener('click', loadPage);
document.getElementById(`pnInfoBtn_${entityId}`)?.addEventListener('click', () => {
    const m = document.createElement('div');
    m.className = 'pn-info-modal';
    m.innerHTML = `<div class="pn-info-box">
      <h3>⚠️ Правила комментариев</h3>
      <p>🚫 Маты, оскорбления и унижения - <b>бан</b></p>
      <p>🚫 Ссылки и реклама - <b>удаление</b></p>
      <p>🚫 Религиозные темы и пропаганда - <b>бан</b></p>
      <p>🚫 Политика и агитация - <b>бан</b></p>
      <p>✅ Максимум 5 сообщений в минуту</p>
      <p>✅ Комменты с 50+ лайками видны всем</p>
<p style="color:#e74c3c;font-weight:600;margin-top:8px;">⛔ Нарушители будут заблокированы навсегда по ID аккаунта и устройства</p>
      <button class="pn-info-close" style="margin-top:14px;width:100%;padding:10px;border-radius:12px;background:var(--pr-accent,#8b1a2f);border:none;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;">Понятно</button>
    </div>`;
    document.body.appendChild(m);
    m.querySelector('.pn-info-close').addEventListener('click', () => m.remove());
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  });
  // Первая страница
  await loadPage();

  // Realtime — только новые комменты (не перегружаем всё)
  const liveQ = query(colRef, orderBy('createdAt', 'desc'), limit(1));
  let isFirst = true;
  onSnapshot(liveQ, async (snap) => {
    if (isFirst) { isFirst = false; return; } // пропускаем начальный снимок
    if (snap.empty) return;
    const docSnap = snap.docs[0];
    // Если уже есть в DOM — не дублируем
    if (list.querySelector(`[data-id="${docSnap.id}"]`)) return;
    totalCount++;
    loadedCount++;
    if (countEl) countEl.textContent = totalCount;
    _replyCounts.set(docSnap.id, 0);
    const el = await renderComment(
      entityId, docSnap.id, docSnap.data(), currentUser, currentProfile, entityOwnerId
    );
    list.prepend(el);
  });
}

// ========== РЕНДЕР ФОРМЫ ==========
function renderForm(entityId, user, profile) {
  const formEl = document.getElementById(`pnForm_${entityId}`);
  if (!formEl) return;

  if (!user) {
    formEl.innerHTML = `
      <div class="pn-auth-hint">
        <a href="login.html">Войди</a>, чтобы оставить коммент
      </div>`;
    return;
  }

  const ava = profile?.avatarUrl || 'assets/images/ava.jpg';
  formEl.innerHTML = `
    <div class="pn-comment-form">
      <img class="pn-ava" src="${ava}" alt="">
      <div class="pn-comment-input-wrap">
        <textarea class="pn-comment-input" id="pnInput_${entityId}"
          placeholder="Напиши коммент..." rows="1"></textarea>
        <span class="pn-char-counter" id="pnCharCount_${entityId}"></span>
        <button class="pn-comment-send" id="pnSend_${entityId}">
          <svg viewBox="0 0 24 24"><path d="M2 12L22 2 12 22 10 14z"/></svg>
        </button>
      </div>
    </div>`;

  // Авто-высота textarea + счётчик символов
  const ta = document.getElementById(`pnInput_${entityId}`);
  const counterEl = document.getElementById(`pnCharCount_${entityId}`);
  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    updateCharCounter(ta, counterEl);
  });

  // Отправка Enter (Shift+Enter = перенос)
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendComment(entityId, user, profile);
    }
  });

  document.getElementById(`pnSend_${entityId}`)
    .addEventListener('click', () => sendComment(entityId, user, profile));
}

// ========== ОТПРАВИТЬ КОММЕНТ ==========
const MAX_CHARS = 1000;

async function sendComment(entityId, user, profile) {
  const ta = document.getElementById(`pnInput_${entityId}`);
  if (!ta) return;
  const text = ta.value.trim();
  if (!text) return;
  if (text.length > MAX_CHARS) {
    ta.style.borderColor = '#e74c3c';
    setTimeout(() => (ta.style.borderColor = ''), 1500);
    return;
  }
  if (checkSpam(user.uid)) {
    showToast('Слишком часто - подожди минуту 🙏');
    return;
  }

  ta.value = '';
  ta.style.height = 'auto';
  const counterEl = document.getElementById(`pnCharCount_${entityId}`);
  if (counterEl) { counterEl.textContent = ''; counterEl.className = 'pn-char-counter'; }

  const colRef = collection(db, 'comments', entityId, 'messages');
  await addDoc(colRef, {
    text,
    userId: user.uid,
    displayName: profile?.displayName || 'Пользователь',
    avatarUrl: profile?.avatarUrl || '',
    username: profile?.username || '',
    likes: 0,
    likedBy: [],
    createdAt: serverTimestamp(),
  });
}

// ========== РЕНДЕР КОММЕНТА ==========
async function renderComment(entityId, commentId, c, currentUser, currentProfile, entityOwnerId) {
  const wrap = document.createElement('div');
  wrap.className = 'pn-comment';
  wrap.dataset.id = commentId;

  const ava = c.avatarUrl || 'assets/images/ava.jpg';
  const isOwn = currentUser && currentUser.uid === c.userId;
  const isArtist = entityOwnerId && c.userId === entityOwnerId;
  const isLiked = currentUser && (c.likedBy || []).includes(currentUser.uid);
  const profileLink = c.username ? `public-profile.html?uid=${c.userId}` : '#';
  const replyCount = _replyCounts.get(commentId);
  const replyCountBadge = replyCount ? ` (${replyCount})` : '';

  const artistBadge = isArtist
    ? '<span class="pn-badge-artist">артист</span>'
    : '';

  wrap.innerHTML = `
    <img class="pn-comment-ava" src="${ava}" alt="">
    <div class="pn-comment-body">
      <div class="pn-comment-header">
        <a class="pn-comment-name" href="${profileLink}">${escHtml(c.displayName)}</a>
        ${artistBadge}
        <span class="pn-comment-time" data-ts="${c.createdAt?.seconds || ''}">${timeAgo(c.createdAt)}</span>
      </div>
      <div class="pn-comment-text">${highlightMentions(c.text)}</div>
      <div class="pn-comment-actions">
        <button class="pn-comment-action like-btn ${isLiked ? 'liked' : ''}" data-id="${commentId}" data-likes="${c.likes || 0}">
          <svg viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span>${c.likes || 0}</span>
        </button>
        <button class="pn-comment-action reply-toggle-btn" data-id="${commentId}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Ответить${replyCountBadge}
        </button>
        ${isOwn ? `
        <button class="pn-comment-action edit-btn" data-id="${commentId}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Изменить
        </button>
        <button class="pn-comment-action delete delete-btn" data-id="${commentId}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
          Удалить
        </button>` : ''}
      </div>
      <div class="pn-replies" id="pnReplies_${commentId}" style="display:none;"></div>
    </div>`;

  // Живое время
  scheduleLiveTime(wrap.querySelector('.pn-comment-time'), c.createdAt);

  // Лайк
  wrap.querySelector('.like-btn').addEventListener('click', async (e) => {
    if (!currentUser) return showAuthHint();
    const btn = e.currentTarget;
    const commentRef = doc(db, 'comments', entityId, 'messages', commentId);
    const snap = await getDoc(commentRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const likedBy = data.likedBy || [];
    const uid = currentUser.uid;
    const alreadyLiked = likedBy.includes(uid);
    const newLikes = alreadyLiked ? (data.likes || 1) - 1 : (data.likes || 0) + 1;
    const newLikedBy = alreadyLiked ? likedBy.filter(id => id !== uid) : [...likedBy, uid];
    await updateDoc(commentRef, { likes: newLikes, likedBy: newLikedBy });
  });

  // Удалить
  const delBtn = wrap.querySelector('.delete-btn');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      const ok = await pnConfirm({ title: 'Удалить коммент?', text: 'Это действие нельзя отменить' });
      if (!ok) return;
      await deleteDoc(doc(db, 'comments', entityId, 'messages', commentId));
    });
  }

  // Редактировать
  const editBtn = wrap.querySelector('.edit-btn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      const textEl = wrap.querySelector('.pn-comment-text');
      if (wrap.querySelector('.pn-edit-wrap')) return; // уже открыто
      const editWrap = document.createElement('div');
      editWrap.className = 'pn-edit-wrap';
      editWrap.innerHTML = `
        <textarea class="pn-edit-textarea">${escHtml(c.text)}</textarea>
        <div class="pn-edit-actions">
          <button class="pn-edit-save">Сохранить</button>
          <button class="pn-edit-cancel">Отмена</button>
        </div>`;
      textEl.after(editWrap);
      textEl.style.display = 'none';
      const ta = editWrap.querySelector('.pn-edit-textarea');
      ta.style.height = ta.scrollHeight + 'px';
      ta.focus();

      editWrap.querySelector('.pn-edit-cancel').addEventListener('click', () => {
        editWrap.remove();
        textEl.style.display = '';
      });

      editWrap.querySelector('.pn-edit-save').addEventListener('click', async () => {
        const newText = ta.value.trim();
        if (!newText || newText.length > MAX_CHARS) return;
        await updateDoc(doc(db, 'comments', entityId, 'messages', commentId), {
          text: newText,
          editedAt: serverTimestamp(),
        });
        c.text = newText;
        textEl.innerHTML = highlightMentions(newText);
        editWrap.remove();
        textEl.style.display = '';
      });
    });
  }

  // Реплаи — загрузить и показать/скрыть
  const repliesEl = wrap.querySelector(`#pnReplies_${commentId}`);
  const replyToggle = wrap.querySelector('.reply-toggle-btn');
  let repliesLoaded = false;

  replyToggle.addEventListener('click', async () => {
    const isOpen = repliesEl.style.display !== 'none';
    if (isOpen) {
      repliesEl.style.display = 'none';
      return;
    }
    repliesEl.style.display = 'block';
    if (!repliesLoaded) {
      repliesLoaded = true;
      await loadReplies(entityId, commentId, repliesEl, currentUser, currentProfile);
    }
  });

  return wrap;
}

// ========== ЗАГРУЗИТЬ РЕПЛАИ ==========
async function loadReplies(entityId, commentId, container, currentUser, currentProfile) {
  const colRef = collection(db, 'comments', entityId, 'messages', commentId, 'replies');
  const q = query(colRef, orderBy('createdAt', 'asc'));

  // Форма ответа
  const ava = currentProfile?.avatarUrl || 'assets/images/ava.jpg';
  const formHtml = currentUser ? `
    <div class="pn-reply-form" id="pnReplyForm_${commentId}">
      <img class="pn-ava" src="${ava}" alt="">
      <div class="pn-reply-input-wrap">
        <textarea class="pn-reply-input" id="pnReplyInput_${commentId}"
          placeholder="Ответить..." rows="1"></textarea>
        <button class="pn-reply-send" id="pnReplySend_${commentId}">
          <svg viewBox="0 0 24 24"><path d="M2 12L22 2 12 22 10 14z"/></svg>
        </button>
      </div>
    </div>` : `<div class="pn-auth-hint" style="font-size:11px;padding:8px;margin-top:8px;">
      <a href="login.html">Войди</a>, чтобы ответить
    </div>`;

  container.innerHTML = `<div id="pnReplyList_${commentId}"></div>${formHtml}`;

  const listEl = container.querySelector(`#pnReplyList_${commentId}`);

  // Realtime реплаи
  onSnapshot(q, (snap) => {
    listEl.innerHTML = '';
    snap.forEach(d => {
      const r = d.data();
      const replyEl = document.createElement('div');
      replyEl.className = 'pn-reply';
      const isOwnReply = currentUser && currentUser.uid === r.userId;
      replyEl.innerHTML = `
        <img class="pn-reply-ava" src="${r.avatarUrl || 'assets/images/ava.jpg'}" alt="">
        <div class="pn-comment-body">
          <div class="pn-comment-header">
            <a class="pn-comment-name" href="${r.username ? 'public-profile.html?uid=' + r.userId : '#'}">${escHtml(r.displayName)}</a>
            <span class="pn-comment-time">${timeAgo(r.createdAt)}</span>
          </div>
          <div class="pn-comment-text">${escHtml(r.text)}</div>
          ${isOwnReply ? `
          <div class="pn-comment-actions" style="margin-top:6px;">
            <button class="pn-comment-action delete" data-reply-id="${d.id}" style="font-size:10px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              </svg>
              Удалить
            </button>
          </div>` : ''}
        </div>`;

      // Удалить реплай
      const delReply = replyEl.querySelector('[data-reply-id]');
      if (delReply) {
        delReply.addEventListener('click', async () => {
          const ok = await pnConfirm({ title: 'Удалить ответ?', text: 'Это действие нельзя отменить' });
          if (!ok) return;
          await deleteDoc(doc(db, 'comments', entityId, 'messages', commentId, 'replies', d.id));
        });
      }

      listEl.appendChild(replyEl);
    });
  });

  // Отправить реплай
  if (currentUser) {
    const ta = container.querySelector(`#pnReplyInput_${commentId}`);
    const sendBtn = container.querySelector(`#pnReplySend_${commentId}`);

    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    });

    const sendReply = async () => {
      const text = ta.value.trim();
      if (!text) return;
      if (text.length > MAX_CHARS) {
        ta.style.borderColor = '#e74c3c';
        setTimeout(() => (ta.style.borderColor = ''), 1500);
        return;
      }
      if (checkSpam(currentUser.uid)) {
        showToast('Слишком часто - подожди минуту 🙏');
        return;
      }
      ta.value = '';
      ta.style.height = 'auto';
      const colRef = collection(db, 'comments', entityId, 'messages', commentId, 'replies');
      await addDoc(colRef, {
        text,
        userId: currentUser.uid,
        displayName: currentProfile?.displayName || 'Пользователь',
        avatarUrl: currentProfile?.avatarUrl || '',
        username: currentProfile?.username || '',
        createdAt: serverTimestamp(),
      });
    };

    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
    });
    sendBtn.addEventListener('click', sendReply);
  }
}

function showAuthHint() {
  showToast('Войди, чтобы ставить лайки');
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

// ========== КАСТОМНАЯ МОДАЛКА ПОДТВЕРЖДЕНИЯ ==========
function injectModalStyles() {
  if (document.getElementById('pn-modal-style')) return;
  const s = document.createElement('style');
  s.id = 'pn-modal-style';
  s.textContent = `
    .pn-modal-overlay {
      position: fixed; inset: 0; z-index: 10000;
      background: rgba(0,0,0,.55); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity .18s;
    }
    .pn-modal-overlay.show { opacity: 1; }
    .pn-modal {
      background: var(--pr-bg2, #1a1a1a);
      border: 1px solid var(--pr-border, rgba(255,255,255,.08));
      border-radius: 18px; padding: 28px 28px 22px;
      width: 320px; max-width: calc(100vw - 32px);
      transform: scale(.93) translateY(10px);
      transition: transform .18s, opacity .18s;
      opacity: 0;
    }
    .pn-modal-overlay.show .pn-modal {
      transform: scale(1) translateY(0);
      opacity: 1;
    }
    .pn-modal-icon {
      width: 44px; height: 44px; border-radius: 50%;
      background: rgba(231,76,60,.12);
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 14px;
    }
    .pn-modal-icon svg {
      width: 22px; height: 22px; stroke: #e74c3c; fill: none; stroke-width: 2;
    }
    .pn-modal-title {
      font-size: 15px; font-weight: 700; color: var(--pr-text, #fff);
      margin-bottom: 6px;
    }
    .pn-modal-text {
      font-size: 13px; color: var(--pr-text3, rgba(255,255,255,.45));
      line-height: 1.5; margin-bottom: 22px;
    }
    .pn-modal-btns {
      display: flex; gap: 10px;
    }
    .pn-modal-cancel {
      flex: 1; padding: 10px; border-radius: 12px;
      background: var(--pr-bg3, rgba(255,255,255,.06));
      border: 1px solid var(--pr-border, rgba(255,255,255,.08));
      color: var(--pr-text2, rgba(255,255,255,.7));
      font-size: 13px; font-weight: 600; cursor: pointer;
      font-family: 'Inter', sans-serif; transition: background .15s;
    }
    .pn-modal-cancel:hover { background: var(--pr-border, rgba(255,255,255,.12)); }
    .pn-modal-confirm {
      flex: 1; padding: 10px; border-radius: 12px;
      background: #e74c3c; border: none;
      color: #fff; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: 'Inter', sans-serif;
      transition: background .15s;
    }
    .pn-modal-confirm:hover { background: #c0392b; }
  `;
  document.head.appendChild(s);
}

function pnConfirm({ title = 'Удалить?', text = '', confirmText = 'Удалить', cancelText = 'Отмена' } = {}) {
  injectModalStyles();
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'pn-modal-overlay';
    overlay.innerHTML = `
      <div class="pn-modal" role="dialog" aria-modal="true">
        <div class="pn-modal-icon">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </div>
        <div class="pn-modal-title">${escHtml(title)}</div>
        ${text ? `<div class="pn-modal-text">${escHtml(text)}</div>` : ''}
        <div class="pn-modal-btns">
          <button class="pn-modal-cancel">${escHtml(cancelText)}</button>
          <button class="pn-modal-confirm">${escHtml(confirmText)}</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    function close(result) {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    }

    overlay.querySelector('.pn-modal-confirm').addEventListener('click', () => close(true));
    overlay.querySelector('.pn-modal-cancel').addEventListener('click',  () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', esc); }
    });
  });
}

function showToast(msg) {
  let toast = document.getElementById('pn-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'pn-toast';
    toast.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);
      background:var(--pr-bg3,#222);color:var(--pr-text,#fff);
      padding:8px 18px;border-radius:20px;font-size:13px;
      opacity:0;transition:opacity .2s,transform .2s;
      z-index:9999;pointer-events:none;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2500);
}

function updateCharCounter(ta, counterEl) {
  if (!counterEl) return;
  const len = ta.value.length;
  if (len === 0) { counterEl.textContent = ''; counterEl.className = 'pn-char-counter'; return; }
  if (len >= MAX_CHARS) {
    counterEl.textContent = `${len}/${MAX_CHARS}`;
    counterEl.className = 'pn-char-counter over';
  } else if (len >= MAX_CHARS * 0.85) {
    counterEl.textContent = `${MAX_CHARS - len}`;
    counterEl.className = 'pn-char-counter warn';
  } else {
    counterEl.textContent = '';
    counterEl.className = 'pn-char-counter';
  }
}

function scheduleLiveTime(el, ts) {
  if (!el || !ts) return;
  const { nextMs } = timeAgoLive(ts);
  if (!nextMs) return;
  setTimeout(() => {
    el.textContent = timeAgoLive(ts).text;
    scheduleLiveTime(el, ts);
  }, nextMs);
}