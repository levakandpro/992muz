// Кастомное окно "Поделиться" карточкой артиста

// Транслитерация кириллицы в латиницу + приведение к формату slug.
// Используется как запасной вариант, если у артиста в базе ещё нет поля slug
// (после запуска миграции slug будет у всех, и эта функция станет просто подстраховкой).
export function slugify(str) {
  const map = {
    а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e', ж:'zh', з:'z', и:'i', й:'y',
    к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f',
    х:'h', ц:'ts', ч:'ch', ш:'sh', щ:'sch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya'
  };
  return String(str || '')
    .toLowerCase()
    .split('')
    .map(ch => (map[ch] !== undefined ? map[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

let shareModalEl = null;

function buildShareModal() {
  if (shareModalEl) return shareModalEl;

  const overlay = document.createElement('div');
  overlay.id = 'shareModalOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:none;align-items:center;justify-content:center;padding:20px;';

  overlay.innerHTML = `
    <div id="shareModalBox" style="background:#fff;border-radius:20px;max-width:380px;width:100%;padding:24px;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <button id="shareModalClose" style="position:absolute;top:14px;right:14px;width:32px;height:32px;border:none;background:#f2f2f2;border-radius:50%;cursor:pointer;font-size:16px;line-height:1;color:#666;">✕</button>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
        <img id="shareModalPhoto" src="" alt="" style="width:52px;height:52px;border-radius:50%;object-fit:cover;flex-shrink:0;">
        <div style="min-width:0;">
          <div id="shareModalName" style="font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Артист</div>
          <div style="font-size:12px;color:#999;">Поделиться карточкой</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;background:#f5f5f7;border-radius:12px;padding:10px 12px;margin-bottom:16px;">
        <input id="shareModalLink" readonly style="flex:1;border:none;background:transparent;font-size:13px;color:#333;outline:none;min-width:0;">
        <button id="shareModalCopy" style="flex-shrink:0;padding:8px 14px;border:none;border-radius:100px;background:#111;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Копировать</button>
      </div>
      <div style="display:flex;gap:10px;">
        <a id="shareModalTelegram" target="_blank" rel="noopener" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px;border-radius:12px;background:#2AABEE;color:#fff;text-decoration:none;font-size:13px;font-weight:600;">Telegram</a>
        <a id="shareModalWhatsapp" target="_blank" rel="noopener" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px;border-radius:12px;background:#25D366;color:#fff;text-decoration:none;font-size:13px;font-weight:600;">WhatsApp</a>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeShareModal();
  });
  overlay.querySelector('#shareModalClose').addEventListener('click', closeShareModal);

  overlay.querySelector('#shareModalCopy').addEventListener('click', () => {
    const input = overlay.querySelector('#shareModalLink');
    input.select();
    navigator.clipboard?.writeText(input.value).then(() => {
      const btn = overlay.querySelector('#shareModalCopy');
      const oldText = btn.textContent;
      btn.textContent = 'Скопировано!';
      setTimeout(() => { btn.textContent = oldText; }, 1500);
    }).catch(() => {});
  });

  shareModalEl = overlay;
  return overlay;
}

function closeShareModal() {
  if (shareModalEl) shareModalEl.style.display = 'none';
  document.removeEventListener('keydown', onShareModalEsc);
}

function onShareModalEsc(e) {
  if (e.key === 'Escape') closeShareModal();
}

export function openShareModal(artist) {
  const overlay = buildShareModal();
  const shareUrl = `https://992muz.ru/artist/${artist.slug || slugify(artist.name) || artist.id}`;

  overlay.querySelector('#shareModalPhoto').src = artist.photo || artist.photoInner || 'assets/images/kartochki/vert.jpg';
  overlay.querySelector('#shareModalName').textContent = artist.name || 'Артист';
  overlay.querySelector('#shareModalLink').value = shareUrl;
  overlay.querySelector('#shareModalTelegram').href = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(artist.name || 'Артист')}`;
  overlay.querySelector('#shareModalWhatsapp').href = `https://wa.me/?text=${encodeURIComponent((artist.name || 'Артист') + ' — ' + shareUrl)}`;

  overlay.style.display = 'flex';
  document.addEventListener('keydown', onShareModalEsc);
}