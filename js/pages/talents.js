(function () {
  'use strict';

  // Анкеты подгружаются из talents.json (его создаёт админка).
  // country: tj | ru | uz | kz | kg. verified: true или false
  var PROFILES = [];
  var ROLES = {
    singer: 'Певица',
    poet: 'Поэтесса',
    blogger: 'Блогер',
    videocreator: 'Видеокреатор',
    influencer: 'Инфлюенсер',
    personalblog: 'Личный блог',
    model: 'Модель',
    dancer: 'Танцовщица',
    actress: 'Актриса',
    host: 'Ведущая',
    comic: 'Комик',
    artist: 'Художница',
    photographer: 'Фотограф',
    talent: 'Талант',
    makeup: 'Визажист',
    stylist: 'Стилист',
    seamstress: 'Швея',
    fitness: 'Фитнес-тренер',
    athlete: 'Спортсменка',
    entrepreneur: 'Предпринимательница',
    businesswoman: 'Бизнесменка',
    brand: 'Свой бренд',
    teacher: 'Учительница',
    cook: 'Кулинарка',
    housewife: 'Домохозяйка',
    mom: 'Мама'
  };

  var GROUPS = [
    { title: 'Музыка и слово', roles: ['singer', 'poet'] },
    { title: 'Блог и медиа', roles: ['blogger', 'videocreator', 'influencer', 'personalblog'] },
    { title: 'Сцена и экран', roles: ['model', 'dancer', 'actress', 'host', 'comic'] },
    { title: 'Творчество', roles: ['artist', 'photographer', 'talent'] },
    { title: 'Красота и стиль', roles: ['makeup', 'stylist', 'seamstress'] },
    { title: 'Спорт', roles: ['fitness', 'athlete'] },
    { title: 'Бизнес', roles: ['entrepreneur', 'businesswoman', 'brand'] },
    { title: 'Дом и работа', roles: ['teacher', 'cook', 'housewife', 'mom'] }
  ];
  var TJ_CITIES = [
    'Душанбе', 'Худжанд', 'Бохтар', 'Куляб', 'Истаравшан', 'Исфара',
    'Пенджикент', 'Турсунзода', 'Вахдат', 'Гиссар', 'Нурек', 'Канибадам',
    'Бустон', 'Гафуров', 'Рогун', 'Хорог', 'Яван', 'Дангара',
    'Шахритус', 'Сарбанд', 'Файзабад', 'Пяндж', 'Зафарабад', 'Айни', 'Гулистон'
  ];

  var COUNTRIES = { ru: 'Россия', uz: 'Узбекистан', kz: 'Казахстан', kg: 'Киргизия' };

  var BADGE_SRC = 'assets/992w/verify-svgrepo-com.svg';
  var TOP_SRC = 'assets/992w/topovaya.png';
  var YT_SRC = 'assets/992w/youtube.png';

  function placeKey(p) {
    return p.country && p.country !== 'tj' ? p.country : p.city;
  }
  // Кто показывается на главной. Позже здесь можно проверять отдельное поле из админки.
  function isMain(p) {
    return !!p.top;
  }
  function placeLabel(p) {
    return window.TLDict.place(p);
  }
    var SOC_DIR = 'assets/992w/soc/';
  var SOC = {
    instagram: { name: 'Instagram', icon: 'instagram-svgrepo-com.svg' },
    telegram: { name: 'Telegram', icon: 'telegram-svgrepo-com.svg' },
    tiktok: { name: 'TikTok', icon: 'tiktok-svgrepo-com%20(1).svg' },
    youtube: { name: 'YouTube', icon: 'youtube-svgrepo-com.svg' },
    vk: { name: 'VK', icon: 'vk-svgrepo-com.svg' },
    facebook: { name: 'Facebook', icon: 'facebook-svgrepo-com.svg' },
    twitter: { name: 'X (Twitter)', icon: 'twitter-svgrepo-com.svg' },
    ok: { name: 'Одноклассники', icon: 'ok-ru-svgrepo-com.svg' },
    whatsapp: { name: 'WhatsApp', icon: 'whatsapp-128-svgrepo-com.svg' },
    pinterest: { name: 'Pinterest', icon: 'pinterest-180-svgrepo-com.svg' },
    snapchat: { name: 'Snapchat', icon: 'snapchat-136-svgrepo-com.svg' },
    max: { name: 'MAX', icon: 'Max_logo_black.svg' },
    web: { name: 'Сайт', icon: 'web-svgrepo-com.svg' }
  };

  function socKey(url) {
    var h = '';
    try { h = new URL(url).hostname.toLowerCase(); } catch (e) {}
    if (h.indexOf('instagram.com') !== -1) return 'instagram';
    if (h.indexOf('t.me') !== -1 || h.indexOf('telegram') !== -1) return 'telegram';
    if (h.indexOf('tiktok.com') !== -1) return 'tiktok';
    if (h.indexOf('youtube.com') !== -1 || h.indexOf('youtu.be') !== -1) return 'youtube';
    if (h === 'vk.com' || h.slice(-6) === '.vk.com' || h.indexOf('vk.ru') !== -1) return 'vk';
    if (h.indexOf('facebook.com') !== -1 || h.indexOf('fb.com') !== -1) return 'facebook';
    if (h.indexOf('twitter.com') !== -1 || h === 'x.com' || h.slice(-6) === '.x.com') return 'twitter';
    if (h.indexOf('ok.ru') !== -1) return 'ok';
    if (h.indexOf('wa.me') !== -1 || h.indexOf('whatsapp') !== -1) return 'whatsapp';
    if (h.indexOf('pinterest') !== -1) return 'pinterest';
    if (h.indexOf('snapchat') !== -1) return 'snapchat';
    if (h.indexOf('max.ru') !== -1) return 'max';
    return 'web';
  }

   function parseLinks(s) {
    var list = String(s || '').split(/\s+/).filter(function (u) { return /^https?:\/\//i.test(u); });
    var insta = list.filter(function (u) { return socKey(u) === 'instagram'; });
    var rest = list.filter(function (u) { return socKey(u) !== 'instagram'; });
    if (!insta.length) insta = ['https://www.instagram.com/992women/'];
    return insta.concat(rest);
  }

  var socModal = null;
  var socList = null;
  var socTitle = null;

  function closeSocModal() {
    if (socModal) socModal.hidden = true;
    document.body.style.overflow = '';
  }

  function openSocModal(name, links) {
    if (!socModal) {
      socModal = document.createElement('div');
      socModal.className = 'tl-modal';
      socModal.hidden = true;
      socModal.innerHTML =
        '<div class="tl-backdrop"></div>' +
        '<div class="tl-sheet" role="dialog" aria-modal="true">' +
        '<div class="tl-sheet-head"><h2 class="tl-sheet-title"></h2></div>' +
        '<div class="tl-sheet-body tl-soc-list"></div>' +
        '<div class="tl-soc-foot"></div></div>';
      document.body.appendChild(socModal);
      socTitle = socModal.querySelector('.tl-sheet-title');
      socList = socModal.querySelector('.tl-soc-list');
      socModal.querySelector('.tl-backdrop').addEventListener('click', closeSocModal);

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && socModal && !socModal.hidden) closeSocModal();
      });
    }
    socTitle.textContent = name;
    socList.textContent = '';
    links.forEach(function (url) {
      var s = SOC[socKey(url)];
      var a = document.createElement('a');
      a.className = 'tl-soc-item';
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';

      var ico = document.createElement('img');
      ico.className = 'tl-soc-ico';
      ico.src = SOC_DIR + s.icon;
      ico.alt = '';
      a.appendChild(ico);

      var label = document.createElement('span');
      label.className = 'tl-soc-name';
      label.textContent = s.name;
      a.appendChild(label);

      list_arrow(a);
      socList.appendChild(a);
    });
    socModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function list_arrow(a) {
    var arr = document.createElement('span');
    arr.className = 'tl-soc-arr';
    a.appendChild(arr);
  }
  var STORE_KEY = 'tl_liked';
  var SWIPE_DISTANCE = 110;
  var reduceMotion = window.TLSite.noMotion();

  var stackEl = document.getElementById('stack');
  var emptyEl = document.getElementById('empty');
  var counterEl = document.getElementById('counter');
  var btnLike = document.getElementById('btnLike');
  var btnSkip = document.getElementById('btnSkip');
  var btnRestart = document.getElementById('restart');
  var btnUndo = document.getElementById('btnUndo');
  var btnFilterNav = document.getElementById('btnFilterNav');
  var filterCountEl = document.getElementById('filterCount');
  var arrowsEl = document.getElementById('arrows');

  var liked = loadLiked();
  var selected = [];
  var places = [];

  var swipedStack = [];
  var queue = [];
  var busy = false;


  function loadLiked() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLiked() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(liked)); } catch (e) {}
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function buildQueue() {
    swipedStack = [];
        queue = shuffle(PROFILES.filter(function (p) {
      if (!isMain(p)) return false;
      if (selected.length && selected.indexOf(p.role) === -1) return false;
      if (places.length && places.indexOf(placeKey(p)) === -1) return false;
      return true;
    }));
  }
  function renderFilters() {
    var count = selected.length + places.length;
    btnFilterNav.setAttribute('aria-pressed', count ? 'true' : 'false');
    filterCountEl.textContent = count ? String(count) : '';
    filterCountEl.hidden = !count;
  }
  function makeCard(p) {
    var card = document.createElement('article');
    card.className = 'tl-card';
    card.tabIndex = 0;

    var img = document.createElement('img');
    img.className = 'tl-photo';
    img.decoding = 'async';
    var failed = false;
    function showPhoto() { img.classList.add('is-ready'); }
    function noPhoto() {
      if (failed) return;
      failed = true;
      img.style.display = 'none';
      var ph = document.createElement('div');
      ph.className = 'tl-nophoto';
      ph.textContent = String(p.name || '?').trim().charAt(0).toUpperCase();
      card.insertBefore(ph, card.firstChild);
    }
    img.addEventListener('load', showPhoto);
    img.addEventListener('error', noPhoto);
    img.referrerPolicy = 'no-referrer';
    img.src = p.photo;
    if (img.complete) { if (img.naturalWidth) showPhoto(); else noPhoto(); }
    img.alt = p.name;
    img.draggable = false;
    card.appendChild(img);

    var shade = document.createElement('div');
    shade.className = 'tl-shade';
    card.appendChild(shade);

    var stampLike = document.createElement('div');
    stampLike.className = 'tl-stamp tl-stamp-like';
    stampLike.textContent = 'Нравится';
    card.appendChild(stampLike);

    var stampSkip = document.createElement('div');
    stampSkip.className = 'tl-stamp tl-stamp-skip';
    stampSkip.textContent = 'Дальше';
    card.appendChild(stampSkip);

    var info = document.createElement('div');
    info.className = 'tl-info';


    var name = document.createElement('h2');
    name.className = 'tl-name';
    name.textContent = p.name;
    if (p.verified) {
      var badge = document.createElement('img');
      badge.className = 'tl-badge';
      badge.src = BADGE_SRC;
      badge.alt = 'Проверено';
      badge.title = 'Анкета проверена';
      name.appendChild(badge);
    }
    if (p.top) {
      var topBadge = document.createElement('img');
      topBadge.className = 'tl-top-badge';
      topBadge.src = TOP_SRC;
      topBadge.alt = 'Топовая';
      topBadge.title = 'Топовая анкета';
           name.appendChild(topBadge);
    }
    info.appendChild(name);

    var meta = document.createElement('div');
    meta.className = 'tl-meta';

    var city = document.createElement('p');
    city.className = 'tl-city';
    city.textContent = placeLabel(p);
    meta.appendChild(city);

    var role = document.createElement('span');
    role.className = 'tl-role';
    role.textContent = window.TLDict.role(p.role);
        meta.appendChild(role);

    if (p.youtube && /^https?:\/\//i.test(p.youtube)) {
      var yt = document.createElement('a');
      yt.className = 'tl-yt';
      yt.href = p.youtube;
      yt.target = '_blank';
      yt.rel = 'noopener noreferrer';
      yt.setAttribute('aria-label', 'YouTube');
      var ytImg = document.createElement('img');
      ytImg.src = YT_SRC;
      ytImg.alt = '';
      yt.appendChild(ytImg);
      meta.appendChild(yt);
    }

    info.appendChild(meta);

    var bio = document.createElement('p');
    bio.className = 'tl-bio';
    bio.textContent = p.bio;
    info.appendChild(bio);
        var more = document.createElement('span');
    more.className = 'tl-more';
    more.textContent = 'Подробнее';
    info.appendChild(more);

      var links = parseLinks(p.link);
    if (links.length === 1) {
      var a = document.createElement('a');
      a.className = 'tl-link';
      a.href = links[0];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Открыть профиль';
      info.appendChild(a);
    } else if (links.length > 1) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tl-link';
      btn.textContent = 'Открыть профиль';
      btn.addEventListener('click', function () { openSocModal(p.name, links); });
      info.appendChild(btn);
    }
    card.appendChild(info);
    card._profile = p;
    card._stampLike = stampLike;
    card._stampSkip = stampSkip;
    return card;
  }

  function renderStack() {
    stackEl.textContent = '';
    busy = false;

    var hasCards = queue.length > 0;
    emptyEl.hidden = hasCards;
    document.documentElement.classList.toggle('ended', !hasCards);
    stackEl.hidden = !hasCards;
    btnLike.disabled = !hasCards;
    btnSkip.disabled = !hasCards;
    btnUndo.disabled = swipedStack.length === 0;
    counterEl.textContent = hasCards ? 'Осталось анкет: ' + queue.length : '';

    arrowsEl.classList.toggle('is-off', !hasCards);
        arrowsEl.hidden = arrowsSeen || !hasCards;
        btnFilterNav.classList.toggle('is-pulse', !hasCards);
    if (!hasCards) return;
    var visible = queue.slice(0, 3);
    for (var i = visible.length - 1; i >= 0; i--) {
      var card = makeCard(visible[i]);
      if (i > 0) {
        card.classList.add('is-back');
        card.style.transform = 'scale(' + (1 - i * 0.04) + ') translateY(' + (i * 12) + 'px)';
      } else {
        attachDrag(card);
      }
      stackEl.appendChild(card);
    }
  }

  function moveBack(power, ms) {
    var cards = stackEl.querySelectorAll('.tl-card');
    var n = cards.length;
    for (var i = 1; i < n; i++) {
      var c = cards[n - 1 - i];
      var d = Math.max(i - power, 0);
      c.style.transition = ms ? 'transform ' + ms + 'ms ease' : 'none';
      c.style.transform = 'scale(' + (1 - d * 0.04) + ') translateY(' + (d * 12) + 'px)';
    }
  }

  function attachDrag(card) {
    var startX = 0, startY = 0, dx = 0, dragging = false, moved = false, lastTap = 0;
    var lastX = 0, lastT = 0, vx = 0;
    card.style.transformOrigin = '50% 120%';

    card.addEventListener('pointerdown', function (e) {
      if (busy || e.target.closest('a, button')) return;
       card.classList.remove('is-hint');
      hideArrows();
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      lastT = Date.now();
      vx = 0;
      dx = 0;
      card.style.transition = 'none';
      card.classList.add('is-drag');
      card.setPointerCapture(e.pointerId);
    });

    card.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
      var now = Date.now();
      var dt = now - lastT;
      if (dt > 0) {
        vx = 0.5 * vx + 0.5 * ((e.clientX - lastX) / dt);
        lastX = e.clientX;
        lastT = now;
      }
      card.style.transform = 'translate(' + dx + 'px,' + (dy * 0.3) + 'px) rotate(' + (dx / 18) + 'deg)';
      var power = Math.min(Math.abs(dx) / SWIPE_DISTANCE, 1);
      card._stampLike.style.opacity = dx > 0 ? power : 0;
      card._stampSkip.style.opacity = dx < 0 ? power : 0;
      moveBack(power, 0);
    });

    function end() {
      if (!dragging) return;
      dragging = false;
      card.classList.remove('is-drag');
      if (Date.now() - lastT > 100) vx = 0;
      var flick = Math.abs(vx) > 0.5 && Math.abs(dx) > 30;
      if (Math.abs(dx) > SWIPE_DISTANCE || flick) {
        var dir = flick ? (vx > 0 ? 1 : -1) : (dx > 0 ? 1 : -1);
        fling(card, dir, Math.abs(vx));
      } else {
        card.style.transition = reduceMotion ? 'none' : 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)';
        card.style.transform = '';
        card._stampLike.style.opacity = 0;
        card._stampSkip.style.opacity = 0;
        moveBack(0, reduceMotion ? 0 : 250);
        if (!moved) {
          var now = Date.now();
          if (now - lastTap < 300) {
            lastTap = 0;
            card.classList.remove('is-open');
            card.style.pointerEvents = 'none';
            popHeart(card);
            setTimeout(function () { fling(card, 1); }, 380);
          } else {
            lastTap = now;
            card.classList.toggle('is-open');
          }
        }
      }
    }

    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);

    card.addEventListener('keydown', function (e) {
      if (e.target !== card) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); fling(card, 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); fling(card, -1); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.classList.toggle('is-open'); }
    });
  }
  function fling(card, dir, speed) {
    if (busy) return;
    busy = true;
    var p = card._profile;
    hideArrows();
    if (dir > 0) likeEffect();

    var newLike = dir > 0 && liked.indexOf(p.id) === -1;
    if (newLike) {
      liked.push(p.id);
      saveLiked();
    }
    swipedStack.push({ profile: p, newLike: newLike });
    if (swipedStack.length > 20) swipedStack.shift();
    var duration = reduceMotion ? 0 : Math.max(180, Math.min(320, 320 - (speed || 0) * 120));
    card.style.transition = duration ? 'transform ' + duration + 'ms ease, opacity ' + duration + 'ms ease' : 'none';
    card.style.transform = 'translate(' + (dir * window.innerWidth) + 'px,-40px) rotate(' + (dir * 24) + 'deg)';
    card.style.opacity = '0';
    moveBack(1, duration);
    if (singleMode) {
      setTimeout(backToTop, dir > 0 ? 650 : duration);
      return;
    }
    setTimeout(function () {
      queue.shift();
      renderStack();
    }, duration);
  }
  var HEART_COUNT = 9;
  var likeTimer = 0;

  function likeEffect() {
      if (navigator.vibrate && window.TLSite.vibrationOn()) navigator.vibrate(10);
    btnLike.classList.add('is-liked');
    clearTimeout(likeTimer);
    likeTimer = setTimeout(function () { btnLike.classList.remove('is-liked'); }, 900);
    if (reduceMotion) return;

    var burst = document.createElement('span');
    burst.className = 'tl-burst';
    for (var i = 0; i < HEART_COUNT; i++) {
      var h = document.createElement('i');
      var angle = (-90 + (i - (HEART_COUNT - 1) / 2) * (150 / (HEART_COUNT - 1)) + (Math.random() * 16 - 8)) * Math.PI / 180;
      var dist = 70 + Math.random() * 60;
      h.style.setProperty('--dx', Math.round(Math.cos(angle) * dist) + 'px');
      h.style.setProperty('--dy', Math.round(Math.sin(angle) * dist) + 'px');
      h.style.setProperty('--rot', Math.round(Math.random() * 50 - 25) + 'deg');
      h.style.setProperty('--s', (0.8 + Math.random() * 0.5).toFixed(2));
      h.style.width = h.style.height = Math.round(10 + Math.random() * 10) + 'px';
      h.style.animationDelay = Math.round(Math.random() * 120) + 'ms';
      burst.appendChild(h);
    }
    btnLike.appendChild(burst);
    setTimeout(function () { if (burst.parentNode) burst.parentNode.removeChild(burst); }, 1100);
  }
  function popHeart(card) {
    var h = document.createElement('img');
    h.className = 'tl-bigheart';
      h.src = 'assets/992w/like.svg';
    h.alt = '';
    card.appendChild(h);
  }

  function hintSwipe() {
    var seen = false;
    try { seen = localStorage.getItem('tl_hint') === '1'; } catch (e) {}
    if (seen || reduceMotion) return;
    var c = topCard();
    if (!c) return;
    c.classList.add('is-hint');
    c.addEventListener('animationend', function () { c.classList.remove('is-hint'); }, { once: true });
    try { localStorage.setItem('tl_hint', '1'); } catch (e) {}
  }
  function hideArrows() {
    if (arrowsSeen) return;
    arrowsSeen = true;
    arrowsEl.hidden = true;
  }
  function topCard() {
    var cards = stackEl.querySelectorAll('.tl-card');
    return cards.length ? cards[cards.length - 1] : null;
  }

  btnLike.addEventListener('click', function () {
    var c = topCard();
    if (c) fling(c, 1);
  });

  btnSkip.addEventListener('click', function () {
    var c = topCard();
    if (c) fling(c, -1);
  });

  btnRestart.addEventListener('click', function () {
    selected = [];
    places = [];
    renderFilters();
    buildQueue();
    renderStack();
  });
  var modalEl = document.getElementById('filterModal');
  var modalBody = document.getElementById('filterBody');
  var btnApply = document.getElementById('filterApply');
  var btnReset = document.getElementById('filterReset');
  var btnClose = document.getElementById('filterClose');
  var backdropEl = document.getElementById('filterBackdrop');
  var draft = [];
  var draftPlaces = [];
  var lastFocus = null;

  function countFor(roles, locs) {
    return PROFILES.filter(function (p) {
      if (!isMain(p)) return false;
      if (roles.length && roles.indexOf(p.role) === -1) return false;
      if (locs.length && locs.indexOf(placeKey(p)) === -1) return false;
      return true;
    }).length;
  }

  function updateApply() {
    btnApply.textContent = 'Показать (' + countFor(draft, draftPlaces) + ')';
  }

  function addTagGroup(titleText, items, list) {
    var title = document.createElement('h3');
    title.className = 'tl-group-title';
    title.textContent = titleText;
    modalBody.appendChild(title);

    var tags = document.createElement('div');
    tags.className = 'tl-tags';

    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tl-chip';
      b.setAttribute('aria-pressed', list.indexOf(it.key) !== -1 ? 'true' : 'false');
      b.textContent = it.label;
      b.addEventListener('click', function () {
        var i = list.indexOf(it.key);
        if (i === -1) list.push(it.key); else list.splice(i, 1);
        b.setAttribute('aria-pressed', i === -1 ? 'true' : 'false');
        updateApply();
      });
      tags.appendChild(b);
    });

    modalBody.appendChild(tags);
  }
  function renderSheet() {
    modalBody.textContent = '';
    GROUPS.forEach(function (g, gi) {
      addTagGroup(window.TLDict.group(gi), g.roles.map(function (k) { return { key: k, label: window.TLDict.role(k) }; }), draft);
    });
    addTagGroup(window.TLDict.section('cities'), TJ_CITIES.map(function (c) { return { key: c, label: window.TLDict.city(c) }; }), draftPlaces);
    addTagGroup(window.TLDict.section('countries'), Object.keys(COUNTRIES).map(function (k) { return { key: k, label: window.TLDict.country(k) }; }), draftPlaces);
    updateApply();
  }
  function openSheet() {
    lastFocus = document.activeElement;
    draft = selected.slice();
    draftPlaces = places.slice();
    renderSheet();
    modalEl.hidden = false;
    document.body.style.overflow = 'hidden';
    btnClose.focus();
  }

  function closeSheet() {
    modalEl.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  btnApply.addEventListener('click', function () {
    selected = draft.slice();
    places = draftPlaces.slice();
    closeSheet();
    buildQueue();
    renderFilters();
    renderStack();
  });

  btnReset.addEventListener('click', function () {
    draft = [];
    draftPlaces = [];
    renderSheet();
  });

  btnClose.addEventListener('click', closeSheet);
  backdropEl.addEventListener('click', closeSheet);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modalEl.hidden) closeSheet();
  });
  function undoSwipe() {
    if (busy || !swipedStack.length) return;
    var last = swipedStack.pop();
    if (last.newLike) {
      var i = liked.indexOf(last.profile.id);
      if (i !== -1) liked.splice(i, 1);
      saveLiked();
    }
    queue.unshift(last.profile);
    renderStack();
    var c = topCard();
    if (c) c.classList.add('is-return');
  }
  var CYR = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ж': 'zh', 'з': 'z',
    'и': 'i', 'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p',
    'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch',
    'ш': 'sh', 'щ': 'sh', 'ъ': '', 'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'iu', 'я': 'ia',
    'ӯ': 'u', 'ҳ': 'h', 'қ': 'k', 'ғ': 'g', 'ҷ': 'j', 'ӣ': 'i'
  };

  // Приводит и русский, и латинский текст к одной «латинской основе», чтобы они сравнивались
  function skeleton(s) {
    s = String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/дж/g, 'j');
    s = s.replace(/[а-яӯҳқғҷӣ]/g, function (ch) { return CYR[ch] !== undefined ? CYR[ch] : ch; });
    s = s.replace(/shch|sch/g, 'sh').replace(/kh/g, 'h').replace(/ts/g, 'c')
      .replace(/yo|ye/g, 'e').replace(/yu/g, 'iu').replace(/ya/g, 'ia')
      .replace(/y/g, 'i').replace(/w/g, 'v').replace(/x/g, 'ks').replace(/q/g, 'k')
      .replace(/ck/g, 'k');
    s = s.replace(/[^a-z0-9]/g, '');
    return s.replace(/(.)\1+/g, '$1');
  }

  var searchModal = null;
  var searchInput = null;
  var searchResults = null;

  function closeSearch() {
    if (searchModal) searchModal.hidden = true;
    document.body.style.overflow = '';
  }

  function showProfile(p) {
    selected = [];
    places = [];
    renderFilters();
    buildQueue();
    queue = queue.filter(function (x) { return x.id !== p.id; });
    queue.unshift(p);
        pushRecent(p.id);
    renderStack();
    closeSearch();
  }

   var searchFound = [];
  var searchClear = null;
  var searchTitleEl = null;
  var RECENT_KEY = 'tl_recent';

  function sT(key) {
    var d = I18N[window.TLSite.lang()] || I18N.ru;
    return d[key] || I18N.ru[key];
  }

  function loadRecent() {
    try {
      var r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(r) ? r : [];
    } catch (e) {
      return [];
    }
  }

  function pushRecent(id) {
    var r = loadRecent().filter(function (x) { return String(x) !== String(id); });
    r.unshift(id);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 5))); } catch (e) {}
  }

  function clearRecent() {
    try { localStorage.removeItem(RECENT_KEY); } catch (e) {}
    renderSearch();
  }

  // true, если слова отличаются не больше чем на одну букву (опечатка)
  function within1(a, b) {
    if (a === b) return true;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    var i = 0, j = 0, edits = 0;
    while (i < la && j < lb) {
      if (a.charAt(i) === b.charAt(j)) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (la > lb) i++;
      else if (lb > la) j++;
      else { i++; j++; }
    }
    return edits + (la - i) + (lb - j) <= 1;
  }

  // Сколько очков у анкеты для запроса. 0 = не подходит
  function searchScore(p, tokens, whole) {
    var words = String(p.name || '').split(/\s+/).map(skeleton).filter(Boolean);
    var others = [p.role, window.TLDict.role(p.role), placeLabel(p), p.city].map(skeleton);
    var score = 0;
    for (var t = 0; t < tokens.length; t++) {
      var tk = tokens[t];
      var best = 0;
      var w, k;
      for (w = 0; w < words.length; w++) {
        if (words[w].indexOf(tk) === 0) best = Math.max(best, 10);
        else if (words[w].indexOf(tk) !== -1) best = Math.max(best, 6);
        else if (tk.length >= 4 && (within1(words[w], tk) || within1(words[w].slice(0, tk.length), tk))) best = Math.max(best, 4);
      }
      if (!best) {
        for (k = 0; k < others.length; k++) {
          if (others[k] && others[k].indexOf(tk) !== -1) best = 3;
        }
      }
      if (!best) return 0;
      score += best;
    }
    if (whole && skeleton(p.name).indexOf(whole) === 0) score += 5;
    if (p.top) score += 2;
    if (p.verified) score += 1;
    return score;
  }

  function addSearchRow(p) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tl-sr-item';

    var ph = document.createElement('img');
    ph.className = 'tl-sr-photo';
    ph.referrerPolicy = 'no-referrer';
    ph.src = p.photo;
    ph.alt = '';
    b.appendChild(ph);

    var main = document.createElement('div');
    main.className = 'tl-sr-main';
    var nm = document.createElement('p');
    nm.className = 'tl-sr-name';
    nm.textContent = p.name;
    main.appendChild(nm);
    var sub = document.createElement('p');
    sub.className = 'tl-sr-sub';
    sub.textContent = window.TLDict.role(p.role) + ' · ' + placeLabel(p);
    main.appendChild(sub);
    b.appendChild(main);

    b.addEventListener('click', function () { showProfile(p); });
    searchResults.appendChild(b);
  }

  function addSearchTitle(text, actionText, action) {
    var row = document.createElement('div');
    row.className = 'tl-sr-head';
    var h = document.createElement('h3');
    h.className = 'tl-group-title';
    h.textContent = text;
    row.appendChild(h);
    if (action) {
      var a = document.createElement('button');
      a.type = 'button';
      a.className = 'tl-sr-clear-recent';
      a.textContent = actionText;
      a.addEventListener('click', action);
      row.appendChild(a);
    }
    searchResults.appendChild(row);
  }

  // Что видно, пока в поле пусто: недавние и популярные
  function renderSearchStart() {
    var byId = {};
    PROFILES.forEach(function (p) { byId[String(p.id)] = p; });
    var recent = loadRecent().map(function (id) { return byId[String(id)]; }).filter(Boolean);
    var seen = {};
    if (recent.length) {
      addSearchTitle(sT('searchRecent'), sT('searchClearRecent'), clearRecent);
      recent.forEach(function (p) {
        seen[String(p.id)] = true;
        addSearchRow(p);
      });
    }
    var rest = PROFILES.filter(function (p) { return !seen[String(p.id)]; });
    var popular = shuffle(rest.filter(function (p) { return p.top; }))
      .concat(rest.filter(function (p) { return !p.top; }))
      .slice(0, 5);
    if (popular.length) {
      addSearchTitle(sT('searchPopular'));
      popular.forEach(addSearchRow);
    }
  }

  function renderSearch() {
    searchResults.textContent = '';
    searchFound = [];
    var raw = searchInput.value;
    searchClear.hidden = !raw;
    var tokens = raw.split(/\s+/).map(skeleton).filter(Boolean);
    if (!tokens.length) {
      renderSearchStart();
      return;
    }
    var whole = skeleton(raw);
    var found = [];
    PROFILES.forEach(function (p) {
      var s = searchScore(p, tokens, whole);
      if (s) found.push({ p: p, s: s });
    });
    found.sort(function (a, b) { return b.s - a.s; });
    searchFound = found.slice(0, 30).map(function (x) { return x.p; });

    if (!searchFound.length) {
      var empty = document.createElement('p');
      empty.className = 'tl-sr-empty';
      empty.textContent = sT('searchEmpty');
      searchResults.appendChild(empty);
      var hint = document.createElement('p');
      hint.className = 'tl-sr-hint';
      hint.textContent = sT('searchWrite');
      searchResults.appendChild(hint);
      var contacts = document.createElement('div');
      contacts.className = 'tl-sr-contact';
      [
        { url: 'https://instagram.com/992woman', icon: 'instagram-svgrepo-com.svg', name: 'Instagram', handle: '@992woman' },
        { url: 'https://t.me/producer992muz', icon: 'telegram-svgrepo-com.svg', name: 'Telegram', handle: '@producer992muz' }
      ].forEach(function (c) {
        var a = document.createElement('a');
        a.className = 'tl-soc-item';
        a.href = c.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        var ico = document.createElement('img');
        ico.className = 'tl-soc-ico';
        ico.src = SOC_DIR + c.icon;
        ico.alt = '';
        a.appendChild(ico);
        var nm = document.createElement('span');
        nm.className = 'tl-soc-name';
        nm.textContent = c.name;
        a.appendChild(nm);
        var hd = document.createElement('span');
        hd.className = 'tl-sr-handle';
        hd.textContent = c.handle;
        a.appendChild(hd);
        list_arrow(a);
        contacts.appendChild(a);
      });
      searchResults.appendChild(contacts);
      return;
    }

    searchFound.forEach(addSearchRow);
  }

   function fillSearchTexts() {
    searchTitleEl.textContent = sT('searchTitle');
    searchInput.placeholder = sT('searchPh');
    searchClear.setAttribute('aria-label', sT('searchClearBtn'));
  }

  function openSearch() {
    if (!searchModal) {
      searchModal = document.createElement('div');
      searchModal.className = 'tl-modal';
      searchModal.hidden = true;
      searchModal.innerHTML =
        '<div class="tl-backdrop"></div>' +
        '<div class="tl-sheet tl-sheet-search" role="dialog" aria-modal="true">' +
        '<div class="tl-sheet-head"><h2 class="tl-sheet-title"></h2></div>' +
        '<div class="tl-sheet-body">' +
        '<div class="tl-search-box">' +
        '<input class="tl-search-input" type="search" autocomplete="off" enterkeyhint="search">' +
        '<button class="tl-search-clear" type="button" hidden>✕</button></div>' +
        '<div class="tl-sr-list"></div></div></div>';
      document.body.appendChild(searchModal);
      searchTitleEl = searchModal.querySelector('.tl-sheet-title');
      searchInput = searchModal.querySelector('.tl-search-input');
      searchClear = searchModal.querySelector('.tl-search-clear');
      searchResults = searchModal.querySelector('.tl-sr-list');
      searchModal.querySelector('.tl-backdrop').addEventListener('click', closeSearch);
      searchInput.addEventListener('input', renderSearch);
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && searchFound[0]) {
          e.preventDefault();
          showProfile(searchFound[0]);
        }
      });
      searchClear.addEventListener('click', function () {
        searchInput.value = '';
        renderSearch();
        searchInput.focus();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && searchModal && !searchModal.hidden) closeSearch();
      });
    }
    fillSearchTexts();
    searchInput.value = '';
    renderSearch();
    searchModal.hidden = false;
    document.body.style.overflow = 'hidden';
    searchInput.focus();
  }

  document.getElementById('btnSearchNav').addEventListener('click', openSearch);
  btnUndo.addEventListener('click', undoSwipe);
  btnFilterNav.addEventListener('click', openSheet);
  var TITLES = [
    'Известные таджички',
    'Таджички, которых знают',
    'Лица 992 WOMEN',
    'Талантливые таджички',
    'WOMEN OF TAJIKISTAN'
  ];
  var titleEl = document.querySelector('.tl-title');
  if (titleEl) {
    var titleIdx = 0;
    setInterval(function () {
      if (reduceMotion) return;
      titleEl.classList.add('is-out');
      setTimeout(function () {
        titleIdx = (titleIdx + 1) % TITLES.length;
        titleEl.textContent = TITLES[titleIdx];
        titleEl.classList.remove('is-out');
      }, 400);
    }, 3500);
  }
  if (location.search.indexOf('reset') !== -1) {
    try { localStorage.removeItem('tl_hint'); localStorage.removeItem('tl_swiped'); } catch (e) {}
  }
  var arrowsSeen = false;
   var I18N = {
    ru: {
      sub: 'Топы инстаграма',
      nav: ['Главная', 'Фильтр', 'Топ 50', 'Музыка', 'Поиск'],
      filterTitle: 'Кто вас интересует', reset: 'Сбросить',
      empty: 'Анкеты закончились', emptyText: 'Выберите другую категорию или посмотрите всё сначала.', restart: 'Смотреть сначала',
            errTitle: 'Не удалось загрузить анкеты', errText: 'Проверьте интернет и попробуйте ещё раз.', retry: 'Повторить',
                  searchWrite: 'Нет в списке? Напишите нам',
                        allProfiles: 'Все анкеты',
               searchTitle: 'Поиск', searchPh: 'Имя, город или занятие', searchEmpty: 'Никого не нашли', searchIg: 'Нет в списке? Напишите нам в Instagram', searchPopular: 'Популярные', searchRecent: 'Недавние', searchClearRecent: 'Очистить', searchClearBtn: 'Стереть',
          titles: ['Известные таджички', 'Таджички, которых знают', 'Лица 992 WOMEN', 'Талантливые таджички', 'WOMEN OF TAJIKISTAN']
    },
    en: {
      sub: 'Instagram tops',
      nav: ['Home', 'Filter', 'Top 50', 'Music', 'Search'],
      filterTitle: 'Who are you looking for', reset: 'Reset',
      empty: 'No more profiles', emptyText: 'Pick another category or start over.', restart: 'Start over',
      errTitle: 'Could not load profiles', errText: 'Check your connection and try again.', retry: 'Retry',
                   searchTitle: 'Search', searchPh: 'Name, city or activity', searchEmpty: 'No one found', searchIg: 'Not on the list? Message us on Instagram', searchPopular: 'Popular', searchRecent: 'Recent', searchClearRecent: 'Clear', searchClearBtn: 'Clear',
                  searchWrite: 'Not on the list? Message us',
                        allProfiles: 'All profiles',
      titles: ['Famous girls of Tajikistan', 'Tajik women everyone knows', 'Faces of 992 WOMEN', 'Talented girls of Tajikistan', 'WOMEN OF TAJIKISTAN']
    },
    tj: {
      sub: 'Топи Instagram',
      nav: ['Асосӣ', 'Филтр', 'Топ 50', 'Мусиқӣ', 'Ҷустуҷӯ'],
      filterTitle: 'Кӣ шуморо шавқманд мекунад', reset: 'Тоза кардан',
      empty: 'Анкетаҳо тамом шуданд', emptyText: 'Категорияи дигарро интихоб кунед ё аз аввал бинед.', restart: 'Аз аввал дидан',
      errTitle: 'Анкетаҳо бор нашуданд', errText: 'Интернетро санҷед ва бори дигар кӯшиш кунед.', retry: 'Такрор',
                      searchTitle: 'Ҷустуҷӯ', searchPh: 'Ном, шаҳр ё машғулият', searchEmpty: 'Касе ёфт нашуд', searchIg: 'Дар рӯйхат нест? Ба мо дар Instagram нависед', searchPopular: 'Машҳур', searchRecent: 'Охирин', searchClearRecent: 'Тоза кардан', searchClearBtn: 'Пок кардан',
                  searchWrite: 'Дар рӯйхат нест? Ба мо нависед',
                        allProfiles: 'Ҳамаи анкетаҳо',
           titles: ['Духтарони машҳури Тоҷикистон', 'Тоҷикдухтарони маъруф', 'Чеҳраҳои 992 WOMEN', 'Духтарони боистеъдод', 'WOMEN OF TAJIKISTAN']
    }
  };

  function setText(sel, txt) {
    var el = document.querySelector(sel);
    if (el) el.textContent = txt;
  }

  function applyLang(code) {
    var d = I18N[code] || I18N.ru;
    setText('.tl-sub', d.sub);
    setText('#filterTitle', d.filterTitle);
    setText('#filterReset', d.reset);
    setText('#empty .tl-empty-title', d.empty);
    setText('#empty .tl-empty-text', d.emptyText);
    setText('#restart', d.restart);
        setText('#allProfiles', d.allProfiles);
    setText('#loadError .tl-empty-title', d.errTitle);
    setText('#loadError .tl-empty-text', d.errText);
    setText('#retryLoad', d.retry);
    var navItems = document.querySelectorAll('.tl-nav-item');
    for (var i = 0; i < navItems.length && i < d.nav.length; i++) {
      navItems[i].lastElementChild.textContent = d.nav[i];
    }
    TITLES.length = 0;
    d.titles.forEach(function (t) { TITLES.push(t); });
    if (titleEl) titleEl.textContent = TITLES[0];
        if (!modalEl.hidden) renderSheet();
    if (PROFILES.length) renderStack();
  }

  document.addEventListener('tl:lang', function (e) { applyLang(e.detail); });
  document.addEventListener('tl:anim', function () { reduceMotion = window.TLSite.noMotion(); });
  applyLang(window.TLSite.lang());
  // Анкеты из админки: файл talents.json в R2 (обновляется кнопкой/автоматически из админки).
  var loadErrorEl = document.getElementById('loadError');
  var btnRetry = document.getElementById('retryLoad');

  function loadProfiles() {
    loadErrorEl.hidden = true;
    fetch('https://cdn.992muz.ru/data/talents.json?t=' + Math.floor(Date.now() / 300000))
      .then(function (r) {
        if (!r.ok) throw new Error('http');
        return r.json();
      })
      .then(function (list) {
        if (!list || !list.length) throw new Error('empty');
        PROFILES = list;
        return true;
      })
      .catch(function () {
        stackEl.textContent = '';
        stackEl.hidden = true;
        emptyEl.hidden = true;
        loadErrorEl.hidden = false;
        btnLike.disabled = true;
        btnSkip.disabled = true;
        counterEl.textContent = '';
        arrowsEl.classList.add('is-off');
                document.documentElement.classList.remove('single');
        return false;
      })
      .then(function (ok) {
            if (!ok) { hideSplash(); return; }
        buildQueue();
        var wantId = '';
        try { wantId = new URLSearchParams(location.search).get('id') || ''; } catch (e) {}
        if (wantId) {
          var want = PROFILES.filter(function (x) { return String(x.id) === wantId; })[0];
          if (want) {
            queue = [want];
            singleMode = true;
          } else {
            document.documentElement.classList.remove('single');
          }
          try { history.replaceState(null, '', location.pathname); } catch (e) {}
        }
        renderFilters();
        renderStack();
        hintSwipe();
                hideSplash();
      });
  }
    var singleMode = false;
  function backToTop() {
    var fromTop = false;
    try { fromTop = new URL(document.referrer).pathname.indexOf('topw') !== -1; } catch (e) {}
    if (fromTop && history.length > 1) history.back(); else location.href = 'topw.html';
  }
  var splashEl = document.getElementById('splash');
  var splashStart = Date.now();
  function hideSplash() {
    if (!splashEl) return;
    var el = splashEl;
    splashEl = null;
    setTimeout(function () {
      el.classList.add('is-hide');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 600);
    }, Math.max(0, 800 - (Date.now() - splashStart)));
  }
  setTimeout(hideSplash, 10000);
  btnRetry.addEventListener('click', loadProfiles);
  loadProfiles();
})();