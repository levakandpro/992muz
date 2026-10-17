(function () {
  'use strict';

  var LANG_KEY = 'tl_lang';
  var THEME_KEY = 'tl_theme';
  var VIBRO_KEY = 'tl_vibro';
  var ANIM_KEY = 'tl_anim';

  var TG_URL = 'https://t.me/producer992muz';
  var SUBMIT_URL = TG_URL;

  var RULES_URL = 'pravila.html';
  var PRIVACY_URL = 'privacy.html';
  var TG_ICON = 'assets/992w/soc/telegram-svgrepo-com.svg';

  var THEMES = [
    { key: 'default', color: '#ffffff' },
    { key: 'teal', color: 'linear-gradient(135deg,#14b8a6,#38bdf8)' },
    { key: 'violet', color: 'linear-gradient(135deg,#8b5cf6,#ec4899)' },
    { key: 'black', color: 'linear-gradient(135deg,#000000,#4a1d6b)' },
    { key: 'gold', color: 'linear-gradient(135deg,#f5b301,#ff8a00)' },
    { key: 'pink', color: 'linear-gradient(135deg,#ff4f7b,#ff9a5a)' }
  ];

  var I18N = {
    ru: {
      menu: 'Меню', lang: 'Язык', theme: 'Тема', settings: 'Настройки',
      vibro: 'Вибрация при лайке', anim: 'Анимации',
      submit: 'Подать анкету', tariffs: 'Тарифы', rules: 'Правила',
      privacy: 'Политика конфиденциальности',
      ask: 'По всем вопросам — в Telegram', reset: 'Сбросить',
      themes: { default: 'Стандартная', teal: 'Бирюзовая', violet: 'Фиолетовая', black: 'Чёрная', gold: 'Золотая', pink: 'Розовая' }
    },
    en: {
      menu: 'Menu', lang: 'Language', theme: 'Theme', settings: 'Settings',
      vibro: 'Vibration on like', anim: 'Animations',
      submit: 'Submit your profile', tariffs: 'Pricing', rules: 'Rules',
      privacy: 'Privacy policy',
      ask: 'Any questions — message us on Telegram', reset: 'Reset',
      themes: { default: 'Default', teal: 'Turquoise', violet: 'Purple', black: 'Black', gold: 'Gold', pink: 'Pink' }
    },
    tj: {
      menu: 'Меню', lang: 'Забон', theme: 'Мавзӯъ', settings: 'Танзимот',
      vibro: 'Ларзиш ҳангоми лайк', anim: 'Анимацияҳо',
      submit: 'Анкета фиристодан', tariffs: 'Тарифҳо', rules: 'Қоидаҳо',
      privacy: 'Сиёсати махфият',
      ask: 'Оид ба ҳама саволҳо — дар Telegram нависед', reset: 'Тоза кардан',
      themes: { default: 'Стандартӣ', teal: 'Фирузагӣ', violet: 'Бунафш', black: 'Сиёҳ', gold: 'Тиллоӣ', pink: 'Гулобӣ' }
    }
  };
  var PROMO_END = new Date(2026, 11, 31, 23, 59, 59);
  var PREMIUM_NEW = '500 TJS';
  var PREMIUM_OLD = '860 TJS';
    var PRO_PRICE = '80 TJS';
    var PAY_NUMBER = '888553852';
    var PAY_QR = 'assets/992w/qr.jpg';

  var TARIFF_I18N = {
    ru: {
      title: 'Тарифы',
      howto: 'Напишите нам название тарифа, оплатите, и мы подключим в течение 4 минут.',
      submit: 'Подать заявку',
      promo: 'Акция до 31 декабря',
            payTitle: 'Оплата',
      payText: 'Оплатите по номеру Душанбе Сити и пришлите нам чек.',
      payBank: 'Душанбе Сити',
            payThen: 'После оплаты нажмите «Отправить скриншот чека» и пришлите его нам в Telegram.',
            send: 'Отправить скриншот чека',
      back: 'Назад к тарифам',
      infoTitle: 'Важно',
      infoItems: ['Отправляйте точную сумму по выбранному тарифу.', 'Если отправили больше — разница не возвращается и считается помощью проекту.', 'Если отправили меньше — возврата не будет и тариф не активируется.'],
      infoClose: 'Понятно',
      free: 'Бесплатно', freePrice: '0 TJS',
      freeItems: ['Одна ссылка — только Instagram', 'Показ в общей ленте'],
      proPer: 'в месяц',
      proItems: ['Галочка подтверждённой анкеты', 'Бейдж «ТОПОВАЯ»', 'До 14 соцсетей', 'Кнопка «Смотреть видео о работе»', 'Приоритет в ленте'],
      premiumPer: 'в год',
      premiumItems: ['Всё, что входит в Pro', 'Место в «Топ 50» — 1 месяц', 'Остальное — на весь год', 'Продление в топе — 300 TJS в месяц']
    },
    en: {
      title: 'Pricing',
      howto: 'Message us the plan name, pay, and we will activate it within 4 minutes.',
      submit: 'Submit your profile',
      promo: 'Sale until December 31',
            payTitle: 'Payment',
      payText: 'Pay to the Dushanbe City number and send us the receipt.',
      payBank: 'Dushanbe City',
           payThen: 'After paying, tap "Send" and send the receipt on Telegram.',
            send: 'Send receipt screenshot',
      back: 'Back to pricing',
      infoTitle: 'Important',
      infoItems: ['Send the exact amount for your plan.', 'If you send more, the difference is not refunded and counts as support for the project.', 'If you send less, there is no refund and the plan will not be activated.'],
      infoClose: 'Got it',
      free: 'Free', freePrice: '0 TJS',
      freeItems: ['One link — Instagram only', 'Shown in the general feed'],
      proPer: 'per month',
      proItems: ['Verified profile checkmark', '"TOP" badge', 'Up to 14 social links', '"Watch my work" video button', 'Feed priority'],
      premiumPer: 'per year',
      premiumItems: ['Everything in Pro', 'Spot in "Top 50" — 1 month', 'Everything else — for the whole year', 'Top spot renewal — 300 TJS per month']
    },
    tj: {
      title: 'Тарифҳо',
      howto: 'Номи тарифро ба мо нависед, пардохт кунед ва мо дар муддати 4 дақиқа пайваст мекунем.',
      submit: 'Дархост фиристодан',
      promo: 'Аксия то 31 декабр',
            payTitle: 'Пардохт',
      payText: 'Ба рақами Душанбе Сити пардохт кунед ва чекро ба мо фиристед.',
      payBank: 'Душанбе Сити',
            payThen: 'Баъд аз пардохт «Скриншоти чекро фиристодан»-ро пахш кунед ва онро дар Telegram ба мо фиристед.',
           send: 'Скриншоти чекро фиристодан',
      back: 'Бозгашт ба тарифҳо',
      infoTitle: 'Муҳим',
      infoItems: ['Маблағи дақиқи тарифи интихобкардаро фиристед.', 'Агар зиёд фиристед, фарқият баргардонида намешавад ва ҳамчун кӯмак ба лоиҳа ҳисоб мешавад.', 'Агар кам фиристед, баргардонида намешавад ва тариф фаъол намегардад.'],
      infoClose: 'Фаҳмо',
      free: 'Ройгон', freePrice: '0 TJS',
      freeItems: ['Танҳо як истинод — Instagram', 'Намоиш дар лентаи умумӣ'],
      proPer: 'дар як моҳ',
      proItems: ['Нишонаи анкетаи тасдиқшуда', 'Нишони «ТОПОВАЯ»', 'То 14 шабакаи иҷтимоӣ', 'Тугмаи «Дидани видео дар бораи кор»', 'Афзалият дар лента'],
      premiumPer: 'дар як сол',
      premiumItems: ['Ҳама чизе, ки дар Pro ҳаст', 'Ҷой дар «Топ 50» — 1 моҳ', 'Боқимонда — барои як сол', 'Тамдид дар топ — 300 TJS дар як моҳ']
    }
  };
  function read(key, def) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? def : v;
    } catch (e) {
      return def;
    }
  }

  function write(key, val) {
    try { localStorage.setItem(key, val); } catch (e) {}
  }

  function emit(name, detail) {
    try {
      document.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) {}
  }

  var sysReduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var curLang = read(LANG_KEY, 'ru');
  var curTheme = read(THEME_KEY, 'default');
  var vibroOn = read(VIBRO_KEY, '1') !== '0';
  var animOn = read(ANIM_KEY, sysReduce ? '0' : '1') !== '0';

  if (!I18N[curLang]) curLang = 'ru';
  if (!THEMES.some(function (t) { return t.key === curTheme; })) curTheme = 'default';
  function applyTheme(code) {
    if (code === 'default') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', code);
    var bgs = { default: '#ffffff', teal: '#d5f1ec', violet: '#e6dcfb', black: '#000000', gold: '#f6e8bd', pink: '#fde0ea' };
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', bgs[code] || '#ffffff');
    write(THEME_KEY, code);
  }
  function applyAnim() {
    if (animOn) document.documentElement.removeAttribute('data-anim');
    else document.documentElement.setAttribute('data-anim', 'off');
  }

  function applyLangAttr(code) {
    document.documentElement.lang = code === 'tj' ? 'tg' : code;
  }

  function setLang(code) {
    curLang = code;
    write(LANG_KEY, code);
    applyLangAttr(code);
    emit('tl:lang', code);
  }

  window.TLSite = {
    lang: function () { return curLang; },
    vibrationOn: function () { return vibroOn; },
    noMotion: function () { return !animOn; }
  };

  applyTheme(curTheme);
  applyAnim();
  applyLangAttr(curLang);

  var menuModal = null;
  var menuTitle = null;
  var menuBody = null;

  function closeMenu() {
    if (menuModal) menuModal.hidden = true;
    document.body.style.overflow = '';
  }

  function menuArrow(a) {
    var arr = document.createElement('span');
    arr.className = 'tl-soc-arr';
    a.appendChild(arr);
  }

  function menuLink(href, iconSrc, text, external) {
    var a = document.createElement('a');
    a.className = 'tl-soc-item';
    a.href = href;
    if (external) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    if (iconSrc) {
      var ico = document.createElement('img');
      ico.className = 'tl-soc-ico';
      ico.src = iconSrc;
      ico.alt = '';
      a.appendChild(ico);
    }
    var label = document.createElement('span');
    label.className = 'tl-soc-name';
    label.textContent = text;
    a.appendChild(label);
    menuArrow(a);
    return a;
  }

  function switchRow(label, on, onChange) {
    var row = document.createElement('button');
    row.type = 'button';
    row.className = 'tl-switch-row';
    row.setAttribute('role', 'switch');
    row.setAttribute('aria-checked', on ? 'true' : 'false');

    var text = document.createElement('span');
    text.textContent = label;
    row.appendChild(text);

    var knob = document.createElement('span');
    knob.className = 'tl-switch';
    row.appendChild(knob);

    row.addEventListener('click', function () {
      on = !on;
      row.setAttribute('aria-checked', on ? 'true' : 'false');
      onChange(on);
    });
    return row;
  }

  function renderMenu() {
    var d = I18N[curLang];
    var scroll = menuBody.scrollTop;
    menuTitle.textContent = d.menu;
    menuBody.textContent = '';


    var t1 = document.createElement('h3');
    t1.className = 'tl-group-title';
    t1.textContent = d.lang;
    menuBody.appendChild(t1);

    var langs = document.createElement('div');
    langs.className = 'tl-tags';
    [['ru', 'RU'], ['en', 'ENG'], ['tj', 'TJK']].forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tl-chip';
      b.setAttribute('aria-pressed', curLang === l[0] ? 'true' : 'false');
      b.textContent = l[1];
      b.addEventListener('click', function () {
        setLang(l[0]);
        renderMenu();
      });
      langs.appendChild(b);
    });
    menuBody.appendChild(langs);

    var t2 = document.createElement('h3');
    t2.className = 'tl-group-title';
    t2.textContent = d.theme;
    menuBody.appendChild(t2);

    var themes = document.createElement('div');
    themes.className = 'tl-themes';
    THEMES.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tl-theme';
      b.style.background = t.color;
      b.setAttribute('aria-label', d.themes[t.key]);
      b.title = d.themes[t.key];
      b.setAttribute('aria-pressed', curTheme === t.key ? 'true' : 'false');
      b.addEventListener('click', function () {
        curTheme = t.key;
        applyTheme(curTheme);
        renderMenu();
      });
      themes.appendChild(b);
    });

    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'tl-theme-reset';
    resetBtn.textContent = '↺';
    resetBtn.setAttribute('aria-label', d.reset);
    resetBtn.title = d.reset;
    resetBtn.addEventListener('click', function () {
      curTheme = 'default';
      applyTheme(curTheme);
      setLang('ru');
      renderMenu();
    });
    themes.appendChild(resetBtn);
    menuBody.appendChild(themes);

    var t3 = document.createElement('h3');
    t3.className = 'tl-group-title';
    t3.textContent = d.settings;
    menuBody.appendChild(t3);

    menuBody.appendChild(switchRow(d.vibro, vibroOn, function (on) {
      vibroOn = on;
      write(VIBRO_KEY, on ? '1' : '0');
      if (on && navigator.vibrate) navigator.vibrate(10);
    }));
    menuBody.appendChild(switchRow(d.anim, animOn, function (on) {
      animOn = on;
      write(ANIM_KEY, on ? '1' : '0');
      applyAnim();
      emit('tl:anim', on);
    }));

    var links = document.createElement('div');
    links.className = 'tl-soc-list';
    links.style.marginTop = '18px';
    var tariffBtn = menuLink('#', '', d.tariffs, false);
    tariffBtn.addEventListener('click', function (ev) {
      ev.preventDefault();
      closeMenu();
      openTariffs();
    });
    links.appendChild(tariffBtn);

    var privacyBtn = menuLink(PRIVACY_URL, '', d.privacy, false);
    privacyBtn.addEventListener('click', function (ev) {
      ev.preventDefault();
      closeMenu();
      openPrivacy();
    });
    links.appendChild(privacyBtn);
    links.appendChild(menuLink(TG_URL, TG_ICON, d.ask, true));
    menuBody.appendChild(links);

    menuBody.scrollTop = scroll;
  }

  function openMenu(e) {
    if (e) e.preventDefault();
    if (!menuModal) {
      menuModal = document.createElement('div');
      menuModal.className = 'tl-modal';
      menuModal.hidden = true;
      menuModal.innerHTML =
        '<div class="tl-backdrop"></div>' +
        '<div class="tl-sheet" role="dialog" aria-modal="true">' +
        '<div class="tl-sheet-head"><h2 class="tl-sheet-title"></h2>' +
        '<button class="tl-sheet-close" type="button" aria-label="Закрыть">✕</button></div>' +
        '<div class="tl-sheet-body"></div></div>';
      document.body.appendChild(menuModal);
      menuTitle = menuModal.querySelector('.tl-sheet-title');
      menuBody = menuModal.querySelector('.tl-sheet-body');
      menuModal.querySelector('.tl-backdrop').addEventListener('click', closeMenu);
      menuModal.querySelector('.tl-sheet-close').addEventListener('click', closeMenu);
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && menuModal && !menuModal.hidden) closeMenu();
      });
    }
    renderMenu();
    menuModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  var tariffModal = null;
  var tariffTitle = null;
  var tariffBody = null;
  var tariffSubmit = null;
  var tariffStep = 'plans';
  var payInfoModal = null;
  

  function closeTariffs() {
    if (tariffModal) tariffModal.hidden = true;
    document.body.style.overflow = '';
  }

  function tEl(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function tariffCard(name, price, per, items, opts) {
    opts = opts || {};
    var card = tEl('section', 'tl-tariff' + (opts.accent ? ' is-accent' : ''));
    if (opts.tag) card.appendChild(tEl('span', 'tl-tariff-tag', opts.tag));
    card.appendChild(tEl('h3', 'tl-tariff-name', name));

    var row = tEl('div', 'tl-tariff-price');
    if (opts.oldPrice) row.appendChild(tEl('s', 'tl-tariff-old', opts.oldPrice));
    row.appendChild(tEl('b', '', price));
    if (per) row.appendChild(tEl('span', 'tl-tariff-per', per));
    card.appendChild(row);

    var ul = tEl('ul', 'tl-tariff-list');
    items.forEach(function (t) { ul.appendChild(tEl('li', '', t)); });
    card.appendChild(ul);
    return card;
  }
  function openPayInfo() {
    var d = TARIFF_I18N[curLang] || TARIFF_I18N.ru;
    if (!payInfoModal) {
      payInfoModal = tEl('div', 'tl-modal tl-modal-small');
      payInfoModal.hidden = true;
      document.body.appendChild(payInfoModal);
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && payInfoModal && !payInfoModal.hidden) payInfoModal.hidden = true;
      });
    }
    payInfoModal.textContent = '';

    var back = tEl('div', 'tl-backdrop');
    back.addEventListener('click', function () { payInfoModal.hidden = true; });
    payInfoModal.appendChild(back);

    var pop = tEl('div', 'tl-pay-pop');
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'true');
    pop.appendChild(tEl('h3', 'tl-pay-pop-title', d.infoTitle));
    var ul = tEl('ul', 'tl-pay-pop-list');
    d.infoItems.forEach(function (t) { ul.appendChild(tEl('li', '', t)); });
    pop.appendChild(ul);
    var ok = tEl('button', 'tl-btn-main tl-submit', d.infoClose);
    ok.type = 'button';
    ok.addEventListener('click', function () { payInfoModal.hidden = true; });
    pop.appendChild(ok);
    payInfoModal.appendChild(pop);

    payInfoModal.hidden = false;
  }

  function showPay() {
    var d = TARIFF_I18N[curLang] || TARIFF_I18N.ru;
    tariffStep = 'pay';
    tariffTitle.textContent = d.payTitle;
    tariffSubmit.href = SUBMIT_URL;
    tariffSubmit.textContent = d.send;
    tariffBody.textContent = '';

    var box = tEl('div', 'tl-pay');
    box.appendChild(tEl('p', 'tl-tariff-howto', d.payText));

    var qr = document.createElement('img');
    qr.className = 'tl-pay-qr';
    qr.src = PAY_QR;
    qr.alt = 'QR';
    box.appendChild(qr);

    var num = tEl('div', 'tl-pay-num');
    var info = tEl('div', 'tl-pay-num-main');
    info.appendChild(tEl('span', 'tl-pay-bank', d.payBank));
    info.appendChild(tEl('b', '', PAY_NUMBER));
    num.appendChild(info);
    var help = tEl('button', 'tl-pay-help', '?');
    help.type = 'button';
    help.setAttribute('aria-label', d.infoTitle);
    help.addEventListener('click', openPayInfo);
    num.appendChild(help);
    box.appendChild(num);

    box.appendChild(tEl('p', 'tl-pay-then', d.payThen));

    var backBtn = tEl('button', 'tl-btn-ghost tl-pay-back', d.back);
    backBtn.type = 'button';
    backBtn.addEventListener('click', openTariffs);
    box.appendChild(backBtn);

    tariffBody.appendChild(box);
    tariffBody.scrollTop = 0;
  }
  function openTariffs() {
    var d = TARIFF_I18N[curLang] || TARIFF_I18N.ru;
    if (!tariffModal) {
      tariffModal = document.createElement('div');
      tariffModal.className = 'tl-modal';
      tariffModal.hidden = true;
      tariffModal.innerHTML =
        '<div class="tl-backdrop"></div>' +
        '<div class="tl-sheet" role="dialog" aria-modal="true">' +
        '<div class="tl-sheet-head"><h2 class="tl-sheet-title"></h2>' +
        '<button class="tl-sheet-close" type="button" aria-label="Закрыть">✕</button></div>' +
        '<div class="tl-sheet-body"></div>' +
        '<div class="tl-sheet-foot"><a class="tl-btn-main tl-btn-wide" target="_blank" rel="noopener noreferrer"></a></div></div>';
      document.body.appendChild(tariffModal);
      tariffTitle = tariffModal.querySelector('.tl-sheet-title');
      tariffBody = tariffModal.querySelector('.tl-sheet-body');
      tariffSubmit = tariffModal.querySelector('.tl-sheet-foot a');
            tariffSubmit.addEventListener('click', function (ev) {
        if (tariffStep === 'plans') {
          ev.preventDefault();
          showPay();
        }
      });
           tariffSubmit.href = SUBMIT_URL;
      tariffModal.querySelector('.tl-backdrop').addEventListener('click', closeTariffs);
      tariffModal.querySelector('.tl-sheet-close').addEventListener('click', closeTariffs);
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && tariffModal && !tariffModal.hidden) closeTariffs();
      });
    }

    tariffTitle.textContent = d.title;
       tariffStep = 'plans';
    tariffSubmit.href = '#';
    tariffSubmit.textContent = d.submit;
    tariffBody.textContent = '';
    tariffBody.appendChild(tEl('p', 'tl-tariff-howto', d.howto));

    var promo = new Date() <= PROMO_END;

    tariffBody.appendChild(tariffCard(d.free, d.freePrice, '', d.freeItems));
      tariffBody.appendChild(tariffCard('Pro', PRO_PRICE, d.proPer, d.proItems));
    tariffBody.appendChild(tariffCard('Premium', promo ? PREMIUM_NEW : PREMIUM_OLD, d.premiumPer, d.premiumItems, {
      accent: true,
      tag: promo ? d.promo : '',
      oldPrice: promo ? PREMIUM_OLD : ''
    }));

    tariffBody.scrollTop = 0;
    tariffModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
    var privacyModal = null;
  var privacyTitle = null;
  var privacyBody = null;
  var privacyHtml = '';

  function closePrivacy() {
    if (privacyModal) privacyModal.hidden = true;
    document.body.style.overflow = '';
  }

  function openPrivacy() {
    var d = I18N[curLang] || I18N.ru;
    if (!privacyModal) {
      privacyModal = document.createElement('div');
      privacyModal.className = 'tl-modal';
      privacyModal.hidden = true;
      privacyModal.innerHTML =
        '<div class="tl-backdrop"></div>' +
        '<div class="tl-sheet tl-sheet-tall" role="dialog" aria-modal="true">' +
        '<div class="tl-sheet-head"><h2 class="tl-sheet-title"></h2>' +
        '<button class="tl-sheet-close" type="button" aria-label="Закрыть">✕</button></div>' +
        '<div class="tl-sheet-body tl-policy"></div></div>';
      document.body.appendChild(privacyModal);
      privacyTitle = privacyModal.querySelector('.tl-sheet-title');
      privacyBody = privacyModal.querySelector('.tl-policy');
      privacyModal.querySelector('.tl-backdrop').addEventListener('click', closePrivacy);
      privacyModal.querySelector('.tl-sheet-close').addEventListener('click', closePrivacy);
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && privacyModal && !privacyModal.hidden) closePrivacy();
      });
    }

    privacyTitle.textContent = d.privacy;
    privacyModal.hidden = false;
    document.body.style.overflow = 'hidden';

    if (privacyHtml) {
      privacyBody.innerHTML = privacyHtml;
      privacyBody.scrollTop = 0;
      return;
    }

    privacyBody.textContent = '...';
    fetch(PRIVACY_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('http');
        return r.text();
      })
      .then(function (t) {
        var doc = new DOMParser().parseFromString(t, 'text/html');
        var main = doc.querySelector('main.pp');
        if (!main) throw new Error('no');
        privacyHtml = main.innerHTML;
        privacyBody.innerHTML = privacyHtml;
        privacyBody.scrollTop = 0;
      })
      .catch(function () {
        closePrivacy();
        window.location.href = PRIVACY_URL;
      });
  }
 
  var btnMenu = document.getElementById('btnMenu');
  if (btnMenu) btnMenu.addEventListener('click', openMenu);
})();