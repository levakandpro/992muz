// ============================================
// chat.js - 992MUZ Radio Chat
// Firebase Firestore realtime
// ============================================
// ЧАТ ОТКЛЮЧЁН — технические работы. Чтобы включить обратно, удали строку ниже целиком.
export const CHAT_KILL_SWITCH = true;
if (CHAT_KILL_SWITCH) {
  document.addEventListener('DOMContentLoaded', () => {
    const tryBlock = () => {
      const panel = document.querySelector('.chat-panel');
      if (!panel) { setTimeout(tryBlock, 300); return; }
      panel.innerHTML = `
        <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;gap:12px;background:#0a0a0a;position:relative;">
          <button onclick="document.querySelector('.hero-flip-card')?.classList.remove('flipped')" style="position:absolute;top:12px;right:12px;background:none;border:none;color:rgba(255,255,255,0.5);font-size:20px;cursor:pointer;">✕</button>
    <div style="font-size:32px;filter:grayscale(1) brightness(0) saturate(100%) invert(21%) sepia(90%) saturate(3000%) hue-rotate(340deg) brightness(95%) contrast(105%);">🛠</div>
          <div style="color:#fff;font-weight:700;font-size:15px;">Ведутся технические работы</div>
          <div style="color:rgba(255,255,255,0.6);font-size:13px;max-width:260px;">Чат скоро снова заработает. Спасибо за терпение!</div>
        </div>`;
    };
    tryBlock();
  });
}
import { db } from '../config/firebase.js';
import { auth } from '../config/firebase.js';
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  increment
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ---- Состояние ----
let currentUser = null;
const soundIn = new Audio('assets/audio/apchih.mp3');
const soundOut = new Audio('assets/audio/otpravka.mp3');
let chatListener = null;
let lastMsgTime = 0;
let activeReply = null;
let isMuted = true;
const COOLDOWN_MS = 3000;
const MAX_MSG_LEN = 300;

// Технические работы: чат временно не пишет и не читает Firestore,
// чтобы не жрать квоту, пока не разберёмся с лимитами.
// Когда будет готово вернуть чат - просто поменяй true на false.
const CHAT_DISABLED = true;

// Мат-фильтр
const BAD_WORDS = ['хуй','пизда','ёбан','бля','блять','сука','пидор','шлюха'];

function containsBadWords(text) {
  const lower = text.toLowerCase();
  return BAD_WORDS.some(w => lower.includes(w));
}

// Эмодзи из папки assets/icons/reac/
const EMOJI_LIST = [
  { file: 'icons8-fire-100 (2).png',                      label: '🔥' },
  { file: 'icons8-love-100.png',                          label: '❤️' },
  { file: 'icons8-cool-100.png',                          label: '😎' },
  { file: 'icons8-rolling-on-the-floor-laughing-100.png', label: '😂' },
  { file: 'icons8-star-struck-100.png',                   label: '🤩' },
  { file: 'icons8-partying-face-100.png',                 label: '🥳' },
  { file: 'icons8-hot-face-100.png',                      label: '🥵' },
  { file: 'icons8-exploding-head-100.png',                label: '🤯' },
  { file: 'icons8-saluting-face-100.png',                 label: '🫡' },
  { file: 'icons8-pile-of-poo-100.png',                   label: '💩' },
  { file: 'icons8-enraged-face-emoji-100.png',            label: '😡' },
  { file: 'icons8-yawning-face-100.png',                  label: '🥱' },
  { file: 'icons8-emoji-sneezing-face-100.png',           label: '🤧' },
];

// ============================================
// ЗАПУСК — слушаем Auth и стартуем
// ============================================
let pinnedListener = null;
let typingListener = null;
let chatIsOpen = false;

renderEmojiBar();
setupFlipButton();
trackOnline();
// startListening(), trackTyping(), trackPinnedMessage() запускаются только когда
// пользователь реально открыл чат-панель (см. openChat/closeChat ниже) — это экономит
// лимиты Firestore, не открывая live-подключения для каждого визита на главную страницу
onAuthStateChanged(auth, (user) => {
  currentUser = user ? {
    uid: user.uid,
    displayName: user.displayName || user.email?.split('@')[0] || 'Слушатель',
    isArtist: false,
    isVerified: false,
    isAdmin: false
  } : null;
  renderInputArea();
});
if (currentUser) onlineUsers.set(currentUser.uid, currentUser.displayName);
// ============================================
// FLIP АНИМАЦИЯ
// ============================================
function setupFlipButton() {
  const chatBtn = document.getElementById('heroChatBtn');
  const closeBtn = document.getElementById('chatCloseBtn');
  const flipCard = document.querySelector('.hero-flip-card');

  if (chatBtn) {
    chatBtn.addEventListener('click', () => openChat());
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeChat());
  }
const muteBtn = document.getElementById('chatMuteBtn');
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      isMuted = !isMuted;
 document.getElementById('chatMuteIcon').innerHTML = isMuted
        ? `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/>`
        : `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>`;
    });
  }
const fullBtn = document.getElementById('chatFullscreenBtn');
  if (fullBtn) {
    fullBtn.addEventListener('click', () => {
      const panel = document.querySelector('.chat-panel');
      const isFs = !panel.classList.contains('fullscreen');
      if (isFs) {
        document.body.appendChild(panel);
        panel.classList.add('fullscreen');
        document.body.style.overflow = 'hidden';
} else {
        const back = document.querySelector('.hero-flip-face--back');
        back.appendChild(panel);
        panel.classList.remove('fullscreen');
        document.body.style.overflow = '';
      }
      fullBtn.innerHTML = isFs
        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>`
        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const panel = document.querySelector('.chat-panel');
if (panel?.classList.contains('fullscreen')) {
        const back = document.querySelector('.hero-flip-face--back');
        back.appendChild(panel);
        panel.classList.remove('fullscreen');
        document.body.style.overflow = '';
        const fullBtn = document.getElementById('chatFullscreenBtn');
        if (fullBtn) fullBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
      } else if (flipCard?.classList.contains('flipped')) {
        closeChat();
      }
    }
  });
}
const settingsBtn = document.getElementById('chatSettingsBtn');
const settingsClose = document.getElementById('chatSettingsClose');
const settingsOverlay = document.getElementById('chatSettingsOverlay');
if (settingsBtn) settingsBtn.addEventListener('click', () => settingsOverlay.classList.add('open'));
if (settingsClose) settingsClose.addEventListener('click', () => settingsOverlay.classList.remove('open'));
if (settingsOverlay) settingsOverlay.addEventListener('click', e => { if (e.target === settingsOverlay) settingsOverlay.classList.remove('open'); });

// Темы
document.querySelectorAll('.chat-theme-btn[data-theme]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.chat-theme-btn[data-theme]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.querySelector('.chat-panel');
    panel.classList.remove('theme-dark', 'theme-light');
    if (btn.dataset.theme === 'dark') panel.classList.add('theme-dark');
    if (btn.dataset.theme === 'light') panel.classList.add('theme-light');
    localStorage.setItem('chatTheme', btn.dataset.theme);
  });
});

// Анимации
let animFrame = null;
document.querySelectorAll('.chat-theme-btn[data-anim]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.chat-theme-btn[data-anim]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    startChatAnim(btn.dataset.anim);
    localStorage.setItem('chatAnim', btn.dataset.anim);
  });
});

// Эмодзи-бар
const settingEmoji = document.getElementById('settingEmoji');
if (settingEmoji) {
  settingEmoji.addEventListener('change', () => {
    const bar = document.getElementById('chatEmojiBar');
    if (bar) bar.style.display = settingEmoji.checked ? 'flex' : 'none';
    localStorage.setItem('chatEmoji', settingEmoji.checked);
  });
}

// Печатает
const settingTyping = document.getElementById('settingTyping');
if (settingTyping) {
  settingTyping.addEventListener('change', () => {
    localStorage.setItem('chatTyping', settingTyping.checked);
  });
}

// Восстановить настройки
const savedTheme = localStorage.getItem('chatTheme');
if (savedTheme && savedTheme !== 'red') {
  const panel = document.querySelector('.chat-panel');
  if (panel) panel.classList.add('theme-' + savedTheme);
  const btn = document.querySelector(`.chat-theme-btn[data-theme="${savedTheme}"]`);
  if (btn) { document.querySelectorAll('.chat-theme-btn[data-theme]').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
}
const savedAnim = localStorage.getItem('chatAnim');
if (savedAnim) {
  startChatAnim(savedAnim);
  const btn = document.querySelector(`.chat-theme-btn[data-anim="${savedAnim}"]`);
  if (btn) { document.querySelectorAll('.chat-theme-btn[data-anim]').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
}
if (localStorage.getItem('chatEmoji') === 'false') {
  const bar = document.getElementById('chatEmojiBar');
  if (bar) bar.style.display = 'none';
  if (settingEmoji) settingEmoji.checked = false;
}
if (localStorage.getItem('chatTyping') === 'false') {
  if (settingTyping) settingTyping.checked = false;
}

function startChatAnim(type) {
  if (animFrame) cancelAnimationFrame(animFrame);
  let canvas = document.getElementById('chatAnimCanvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'chatAnimCanvas';
    document.querySelector('.chat-panel').appendChild(canvas);
  }
  const ctx = canvas.getContext('2d');
  if (type === 'none') { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';

  function resize() {
    const panel = document.querySelector('.chat-panel');
    canvas.width = panel.offsetWidth;
    canvas.height = panel.offsetHeight;
  }
  resize();

  if (type === 'fireflies') {
    const dots = Array.from({length: 28}, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 1,
      dx: (Math.random() - 0.5) * 0.4,
      dy: -Math.random() * 0.5 - 0.2,
      alpha: Math.random(),
      da: (Math.random() - 0.5) * 0.02
    }));
    function draw() {
      resize();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dots.forEach(d => {
        d.x += d.dx; d.y += d.dy; d.alpha += d.da;
        if (d.alpha <= 0 || d.alpha >= 1) d.da *= -1;
        if (d.y < 0) { d.y = canvas.height; d.x = Math.random() * canvas.width; }
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,80,100,${d.alpha * 0.6})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ff3b5c';
        ctx.fill();
      });
      animFrame = requestAnimationFrame(draw);
    }
    draw();
  }

  if (type === 'waves') {
    let t = 0;
    function draw() {
      resize();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let w = 0; w < 3; w++) {
        ctx.beginPath();
        for (let x = 0; x <= canvas.width; x += 4) {
          const y = canvas.height * 0.7 + Math.sin((x / 80) + t + w * 1.2) * (12 + w * 6);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fillStyle = `rgba(139,26,47,${0.07 - w * 0.02})`;
        ctx.fill();
      }
      t += 0.012;
      animFrame = requestAnimationFrame(draw);
    }
    draw();
  }

  if (type === 'stars') {
    const stars = Array.from({length: 50}, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.3,
      alpha: Math.random(),
      da: (Math.random() - 0.5) * 0.015
    }));
    function draw() {
      resize();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.alpha += s.da;
        if (s.alpha <= 0.05 || s.alpha >= 1) s.da *= -1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.alpha * 0.5})`;
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(255,200,200,0.5)';
        ctx.fill();
      });
      animFrame = requestAnimationFrame(draw);
    }
    draw();
  }
}
const rulesBtn = document.getElementById('chatRulesBtn');
  const rulesClose = document.getElementById('chatRulesClose');
  const rulesOverlay = document.getElementById('chatRulesOverlay');
  if (rulesBtn) rulesBtn.addEventListener('click', () => rulesOverlay.classList.add('open'));
  if (rulesClose) rulesClose.addEventListener('click', () => rulesOverlay.classList.remove('open'));
  if (rulesOverlay) rulesOverlay.addEventListener('click', e => { if (e.target === rulesOverlay) rulesOverlay.classList.remove('open'); });
  function showChatMaintenanceOverlay() {
  const panel = document.querySelector('.chat-panel');
  if (!panel) return;
  if (document.getElementById('chatMaintenanceOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'chatMaintenanceOverlay';
  overlay.style.cssText = 'position:absolute;inset:0;background:rgba(10,10,10,0.92);z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;gap:12px;';
  overlay.innerHTML = `
    <button id="chatMaintenanceClose" style="position:absolute;top:12px;right:12px;background:none;border:none;color:rgba(255,255,255,0.5);font-size:20px;cursor:pointer;">✕</button>
   <div style="font-size:32px;filter:grayscale(1) brightness(0) saturate(100%) invert(21%) sepia(90%) saturate(3000%) hue-rotate(340deg) brightness(95%) contrast(105%);">🛠</div>
    <div style="color:#fff;font-weight:700;font-size:15px;">Ведутся технические работы</div>
    <div style="color:rgba(255,255,255,0.6);font-size:13px;max-width:260px;">Чат скоро снова заработает. Спасибо за терпение!</div>
  `;
  if (!panel.style.position) panel.style.position = 'relative';
  panel.appendChild(overlay);
  document.getElementById('chatMaintenanceClose').addEventListener('click', () => {
    overlay.remove();
  });
}
function openChat() {
  const flipCard = document.querySelector('.hero-flip-card');
  if (flipCard) {
    flipCard.classList.add('flipped');
    setTimeout(() => {
      const input = document.getElementById('chatInput');
      if (input && !input.disabled) input.focus();
    }, 800);
  }
  if (CHAT_DISABLED) {
    showChatMaintenanceOverlay();
    return;
  }
  if (!chatIsOpen) {
    chatIsOpen = true;
    startListening();
    trackPinnedMessage();
    trackTyping();
  }
}
function closeChat() {
  const panel = document.querySelector('.chat-panel');
  if (panel?.classList.contains('fullscreen')) {
    const back = document.querySelector('.hero-flip-face--back');
    if (back && panel.parentElement !== back) back.appendChild(panel);
    panel.classList.remove('fullscreen');
    document.body.style.overflow = '';
    const fullBtn = document.getElementById('chatFullscreenBtn');
    if (fullBtn) fullBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
  }
  const flipCard = document.querySelector('.hero-flip-card');
  if (flipCard) flipCard.classList.remove('flipped');

  // Чат реально закрыт — отключаем все live-подключения к Firestore,
  // чтобы вкладка в фоне не продолжала тратить лимиты впустую
  chatIsOpen = false;
  if (chatListener) { chatListener(); chatListener = null; }
  if (pinnedListener) { pinnedListener(); pinnedListener = null; }
  if (typingListener) { typingListener(); typingListener = null; }
}
// ============================================
// ОНЛАЙН СЧЁТЧИК
// ============================================
function trackOnline() {
  const el = document.getElementById('chatOnlineCount');
  if (!el) return;
  let base = 12;
  el.textContent = base + ' онлайн';
  setInterval(() => {
    const delta = Math.floor(Math.random() * 3) - 1;
    base = Math.max(1, base + delta);
    el.textContent = base + ' онлайн';
  }, 8000);
}

// ============================================
// FIRESTORE СЛУШАТЕЛЬ
// ============================================
function startListening() {
  if (chatListener) chatListener();

  const q = query(
    collection(db, 'radioChat'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );

  chatListener = onSnapshot(q, snapshot => {
    snapshot.docChanges().forEach(change => {
if (change.type === 'added') {
        renderMessage(change.doc.id, change.doc.data());
        if (currentUser && change.doc.data().uid !== currentUser.uid) {
   soundIn.currentTime = 0;
          if (!isMuted) soundIn.play().catch(() => {});
        }
      }
    });
    scrollToBottom();
  }, err => {
    console.error('Chat error:', err);
  });
}

// ============================================
// РЕНДЕР СООБЩЕНИЙ
// ============================================
function renderMessage(id, data) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const empty = container.querySelector('.chat-empty');
  if (empty) empty.remove();

  if (document.getElementById('msg-' + id)) return;

  const isOwn = currentUser && data.uid === currentUser.uid;
  const isSystem = data.type === 'system';

  const div = document.createElement('div');
  div.id = 'msg-' + id;
  div.className = 'chat-msg' + (isOwn ? ' own' : '') + (isSystem ? ' system' : '');
if (data.uid && data.displayName) onlineUsers.set(data.uid, data.displayName);
  if (isSystem) {
    div.innerHTML = `<div class="chat-msg-bubble">${escapeHtml(data.text)}</div>`;
  } else {
    const nameClass = data.isArtist ? 'artist' : (data.isVerified ? 'verified' : '');
    const time = data.createdAt?.toDate ? formatTime(data.createdAt.toDate()) : '';
    const likes = data.likes || 0;
    const myName = currentUser?.displayName;
  const isMentioned = myName && data.mentions?.some(m => myName.toLowerCase().startsWith(m.toLowerCase()));
  if (isMentioned) {
soundIn.currentTime = 0;
    if (!isMuted) soundIn.play().catch(() => {});
    div.classList.add('mentioned');
  }
  const msgText = data.text.replace(/@(\S+)/g, '<span class="chat-mention-tag">@$1</span>');
    const replyTo = data.replyTo
      ? `<div class="chat-reply-preview">↩ ${escapeHtml(data.replyTo.displayName)}: ${escapeHtml(data.replyTo.text.slice(0, 60))}</div>`
      : '';

const letter = (data.displayName || 'А')[0].toUpperCase();
    div.innerHTML = `
      <div class="chat-msg-row">
      <div class="chat-msg-avatar">${letter}</div>
      <div class="chat-msg-inner">
      <div class="chat-msg-meta">
        <span class="chat-msg-name ${nameClass}">${escapeHtml(data.displayName || 'Аноним')}</span>
        <span class="chat-msg-time">${time}</span>
      </div>
      ${replyTo}
      <div class="chat-msg-bubble">${msgText}</div>
     <div class="chat-msg-reactions-bar">
        <button class="chat-react-btn" data-emoji="👍" data-id="${id}">👍</button>
        <button class="chat-react-btn" data-emoji="❤️" data-id="${id}">❤️</button>
        <button class="chat-react-btn" data-emoji="🔥" data-id="${id}">🔥</button>
        <button class="chat-react-btn" data-emoji="😂" data-id="${id}">😂</button>
      </div>
      <div class="chat-msg-actions">
        <button class="chat-action-reply" data-id="${id}" data-name="${escapeHtml(data.displayName || 'Аноним')}" data-text="${escapeHtml(data.text)}">
          ↩ Ответить
        </button>
        <button class="chat-action-like ${data.likedBy?.[currentUser?.uid] ? 'liked' : ''}" data-id="${id}">
          ❤️ <span>${likes}</span>
        </button>
</div>
      </div>
      </div>
    `;
    // Лайк
    div.querySelector('.chat-action-like').addEventListener('click', async (e) => {
      if (!currentUser) return;
      const btn = e.currentTarget;
      const span = btn.querySelector('span');
      const isLiked = btn.classList.contains('liked');
      const msgRef = doc(db, 'radioChat', id);
      btn.classList.toggle('liked');
      const newCount = isLiked ? likes - 1 : likes + 1;
      span.textContent = newCount;
      await updateDoc(msgRef, {
        likes: increment(isLiked ? -1 : 1),
        [`likedBy.${currentUser.uid}`]: !isLiked
      });
    });
div.querySelectorAll('.chat-react-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!currentUser) return;
        const emoji = btn.dataset.emoji;
        const msgRef = doc(db, 'radioChat', id);
        const snap = await getDoc(msgRef);
        const reactions = snap.data().reactions || {};
        const users = reactions[emoji] || [];
        const hasReacted = users.includes(currentUser.uid);
        reactions[emoji] = hasReacted ? users.filter(u => u !== currentUser.uid) : [...users, currentUser.uid];
        await updateDoc(msgRef, { reactions });
        btn.classList.toggle('active', !hasReacted);
        btn.textContent = emoji + (reactions[emoji].length > 0 ? ' ' + reactions[emoji].length : '');
      });
    });
    // Ответить
    div.querySelector('.chat-action-reply').addEventListener('click', () => {
      setReply({ id, displayName: data.displayName, text: data.text });
    });
    let touchStartX = 0;
    div.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    div.addEventListener('touchend', e => {
      const diff = e.changedTouches[0].clientX - touchStartX;
      if (diff > 60) {
        setReply({ id, displayName: data.displayName, text: data.text });
        div.style.transform = 'translateX(10px)';
        setTimeout(() => div.style.transform = '', 300);
      }
    });
  }

  container.appendChild(div);
}

// ============================================
// ОТПРАВКА СООБЩЕНИЯ
// ============================================
async function sendMessage(text) {
  if (CHAT_DISABLED) return;
  if (!text.trim()) return;
  if (!currentUser) return;

  const now = Date.now();
  if (now - lastMsgTime < COOLDOWN_MS) {
    showCooldown(Math.ceil((COOLDOWN_MS - (now - lastMsgTime)) / 1000));
    return;
  }

  if (text.length > MAX_MSG_LEN) text = text.slice(0, MAX_MSG_LEN);
  if (containsBadWords(text)) { showError('Такие слова здесь не нужны 🚫'); return; }
lastMsgTime = now;

  const msgData = {
    text: text.trim(),
    uid: currentUser.uid,
    displayName: currentUser.displayName,
    isArtist: currentUser.isArtist || false,
    isVerified: currentUser.isVerified || false,
    isAdmin: currentUser.isAdmin || false,
    createdAt: serverTimestamp(),
    type: 'message',
    likes: 0,
    likedBy: {}
  };

  if (activeReply) {
    msgData.replyTo = {
      id: activeReply.id,
      displayName: activeReply.displayName,
      text: activeReply.text.slice(0, 60)
    };
    clearReply();
  }

try {
    await addDoc(collection(db, 'radioChat'), msgData);
soundOut.currentTime = 0;
    if (!isMuted) soundOut.play().catch(() => {});
    const input = document.getElementById('chatInput');
    if (input) input.value = '';
  } catch (e) {
    console.error('Send error:', e);
  }
}

function setReply(msg) {
  activeReply = msg;
  let bar = document.getElementById('chatReplyBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'chatReplyBar';
    bar.className = 'chat-reply-bar';
    const wrap = document.querySelector('.chat-input-wrap');
    wrap.parentNode.insertBefore(bar, wrap);
  }
  bar.innerHTML = `
    <span>↩ Отвечаешь <b>${escapeHtml(msg.displayName)}</b>: ${escapeHtml(msg.text.slice(0, 50))}</span>
    <button id="chatReplyCancel">✕</button>
  `;
  document.getElementById('chatReplyCancel').addEventListener('click', clearReply);
  document.getElementById('chatInput')?.focus();
}
function trackPinnedMessage() {
  const q = query(
    collection(db, 'adminMessages'),
    orderBy('createdAt', 'desc'),
    limit(1)
  );
  pinnedListener = onSnapshot(q, snap => {
    let bar = document.getElementById('chatPinnedMsg');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'chatPinnedMsg';
      bar.className = 'chat-pinned-msg';
      document.getElementById('chatMessages').before(bar);
    }
    if (snap.empty) { bar.style.display = 'none'; return; }
    const m = snap.docs[0].data();
    if (!m.pinned) { bar.style.display = 'none'; return; }
   const icons = { announcement:'📢', promotion:'🎉', warning:'<img src="assets/icons/war.png" style="width:16px;height:16px;vertical-align:middle;">', urgently:'⛔' };
    bar.style.display = 'flex';
const docId = snap.docs[0].id;
const ytBtn = m.ytId ? `<button class="chat-pinned-yt-btn" onclick="openYoutubeModal('${m.ytId}')">▶ Рекомендуем посмотреть</button>` : '';
    bar.innerHTML = `
      <span class="chat-pinned-icon">${icons[m.type] || '📢'}</span>
      <span class="chat-pinned-text">${escapeHtml(m.text)}</span>
      ${ytBtn}
      <button onclick="document.getElementById('chatPinnedMsg').style.display='none'" style="background:none;border:none;color:rgba(255,255,255,0.3);font-size:14px;cursor:pointer;margin-left:auto;flex-shrink:0;">✕</button>
    `;
  });
}
function trackTyping() {
  const q = query(collection(db, 'typing'));
  typingListener = onSnapshot(q, snap => {
    const now = Date.now();
    const names = [];
    snap.forEach(d => {
      const data = d.data();
      if (d.id !== currentUser?.uid && now - data.ts < 3000) {
        names.push(data.name);
      }
    });
    let el = document.getElementById('chatTyping');
    if (!el) {
      el = document.createElement('div');
      el.id = 'chatTyping';
      el.className = 'chat-typing';
      document.querySelector('.chat-emoji-bar').before(el);
    }
    el.textContent = names.length ? names.join(', ') + ' печатает...' : '';
    el.style.display = names.length ? 'block' : 'none';
  });
}
const onlineUsers = new Map();

function showMentionSuggestions(query, input, atIndex) {
  let box = document.getElementById('chatMentionBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'chatMentionBox';
    box.className = 'chat-mention-box';
    document.querySelector('.chat-input-wrap').parentNode.insertBefore(box, document.querySelector('.chat-input-wrap'));
  }
  const matches = [...onlineUsers.values()].filter(u => u.toLowerCase().startsWith(query));
  if (!matches.length) { hideMentionSuggestions(); return; }
  box.innerHTML = matches.map(name => `<div class="chat-mention-item" data-name="${name}">@${name}</div>`).join('');
  box.style.display = 'block';
  box.querySelectorAll('.chat-mention-item').forEach(item => {
    item.addEventListener('click', () => {
      const before = input.value.slice(0, atIndex);
      input.value = before + '@' + item.dataset.name + ' ';
      hideMentionSuggestions();
      input.focus();
    });
  });
}

function hideMentionSuggestions() {
  const box = document.getElementById('chatMentionBox');
  if (box) box.style.display = 'none';
}
window.openYoutubeModal = (ytId) => {
  let modal = document.getElementById('ytModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ytModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:999999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="position:relative;width:90%;max-width:800px;">
        <button onclick="document.getElementById('ytModal').remove()" style="position:absolute;top:-36px;right:0;background:none;border:none;color:#fff;font-size:24px;cursor:pointer;">✕</button>
        <div id="ytModalInner" style="border-radius:12px;overflow:hidden;aspect-ratio:16/9;"></div>
      </div>
    `;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }
  document.getElementById('ytModalInner').innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${ytId}?autoplay=1" frameborder="0" allowfullscreen style="display:block;"></iframe>`;
};
function scrollToBottom() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
 container.scrollTop = container.scrollHeight;
}
function clearReply() {
  activeReply = null;
  const bar = document.getElementById('chatReplyBar');
  if (bar) bar.remove();
}

// ============================================
// ЭМОДЗИ-БАРА
// ============================================
function renderEmojiBar() {
  const bar = document.getElementById('chatEmojiBar');
  if (!bar) return;

  EMOJI_LIST.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'chat-emoji-item';
    btn.title = emoji.label;
    btn.innerHTML = `<img src="assets/icons/reac/${emoji.file}" alt="${emoji.label}">`;
    btn.addEventListener('click', () => {
      const input = document.getElementById('chatInput');
      if (input && !input.disabled) {
        input.value += emoji.label;
        input.focus();
      }
    });
    bar.appendChild(btn);
  });
}

// ============================================
// ИНПУТ ОБЛАСТЬ
// ============================================
function renderInputArea() {
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');
  const loginBanner = document.getElementById('chatLoginBanner');

  if (CHAT_DISABLED) {
    if (input) input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    if (loginBanner) loginBanner.style.display = 'none';
    return;
  }

  if (!currentUser) {
    if (input) input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    if (loginBanner) loginBanner.style.display = 'flex';
    return;
  }

  if (loginBanner) loginBanner.style.display = 'none';

  if (input) {
    input.disabled = false;
    // убираем старые листенеры клонированием
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
let typingTimeout;
    newInput.addEventListener('keyup', () => {
      const val = newInput.value;
      const atIndex = val.lastIndexOf('@');
      if (atIndex !== -1) {
        const query = val.slice(atIndex + 1).toLowerCase();
        showMentionSuggestions(query, newInput, atIndex);
      } else {
        hideMentionSuggestions();
      }
    });
let lastTypingWrite = 0;
    newInput.addEventListener('input', () => {
      if (!currentUser) return;
      const typingRef = doc(db, 'typing', currentUser.uid);
      const now = Date.now();
      // Пишем статус "печатает" не чаще раза в 1.5 сек, а не на каждую букву —
      // резко снижает число записей и лишних пересчётов у всех открытых вкладок с чатом
      if (now - lastTypingWrite > 1500) {
        lastTypingWrite = now;
        setDoc(typingRef, { name: currentUser.displayName, ts: now });
      }
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => deleteDoc(typingRef), 2000);
      const left = 300 - newInput.value.length;
      const el = document.getElementById('chatCharCount');
      if (el) {
        el.textContent = left;
        el.className = 'chat-char-count' + (left < 20 ? ' danger' : left < 50 ? ' warn' : '');
      }
    });
    newInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(newInput.value);
      }
    });
  }

  if (sendBtn) {
    const newBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newBtn, sendBtn);
    newBtn.disabled = false;
    newBtn.addEventListener('click', () => {
      const inp = document.getElementById('chatInput');
      if (inp) sendMessage(inp.value);
    });
  }
}

// ============================================
// УТИЛИТЫ
// ============================================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 10) return 'только что';
  if (diff < 60) return diff + ' сек назад';
  if (diff < 3600) return Math.floor(diff / 60) + ' мин назад';
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function showCooldown(seconds) {
  const el = document.getElementById('chatCooldown');
  if (!el) return;
  el.textContent = `Подождите ${seconds} сек...`;
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), COOLDOWN_MS);
}

function showError(msg) {
  const el = document.getElementById('chatCooldown');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 2500);
}

// ============================================
// ОЧИСТКА
// ============================================
export function destroyChat() {
  if (chatListener) {
    chatListener();
    chatListener = null;
  }
}