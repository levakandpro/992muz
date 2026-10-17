(function () {
  'use strict';

  // Общий словарь для talents.html и topw.html.
  // Языки: ru, en, tj. Если перевода нет, возвращается русский вариант или исходный текст.

  var ROLES = {
    singer:        { ru: 'Певица', en: 'Singer', tj: 'Хонанда' },
    poet:          { ru: 'Поэтесса', en: 'Poet', tj: 'Шоира' },
    blogger:       { ru: 'Блогер', en: 'Blogger', tj: 'Блогер' },
    videocreator:  { ru: 'Видеокреатор', en: 'Video creator', tj: 'Эҷодкори видео' },
    influencer:    { ru: 'Инфлюенсер', en: 'Influencer', tj: 'Инфлюенсер' },
    personalblog:  { ru: 'Личный блог', en: 'Personal blog', tj: 'Блоги шахсӣ' },
    model:         { ru: 'Модель', en: 'Model', tj: 'Модел' },
    dancer:        { ru: 'Танцовщица', en: 'Dancer', tj: 'Раққоса' },
    actress:       { ru: 'Актриса', en: 'Actress', tj: 'Ҳунарпеша' },
    host:          { ru: 'Ведущая', en: 'Host', tj: 'Мизбон' },
    comic:         { ru: 'Комик', en: 'Comedian', tj: 'Комик' },
    artist:        { ru: 'Художница', en: 'Artist', tj: 'Рассом' },
    photographer:  { ru: 'Фотограф', en: 'Photographer', tj: 'Суратгир' },
    talent:        { ru: 'Талант', en: 'Talent', tj: 'Истеъдод' },
    makeup:        { ru: 'Визажист', en: 'Makeup artist', tj: 'Визажист' },
    stylist:       { ru: 'Стилист', en: 'Stylist', tj: 'Стилист' },
    seamstress:    { ru: 'Швея', en: 'Seamstress', tj: 'Дӯзанда' },
    fitness:       { ru: 'Фитнес-тренер', en: 'Fitness trainer', tj: 'Мураббии фитнес' },
    athlete:       { ru: 'Спортсменка', en: 'Athlete', tj: 'Варзишгар' },
    entrepreneur:  { ru: 'Предпринимательница', en: 'Entrepreneur', tj: 'Соҳибкор' },
    businesswoman: { ru: 'Бизнесменка', en: 'Businesswoman', tj: 'Бизнесвумен' },
    brand:         { ru: 'Свой бренд', en: 'Own brand', tj: 'Бренди худӣ' },
    teacher:       { ru: 'Учительница', en: 'Teacher', tj: 'Омӯзгор' },
    cook:          { ru: 'Кулинарка', en: 'Cook', tj: 'Ошпаз' },
    housewife:     { ru: 'Домохозяйка', en: 'Housewife', tj: 'Бонуи хонадор' },
    mom:           { ru: 'Мама', en: 'Mom', tj: 'Модар' }
  };

  // Порядок совпадает с GROUPS в talents.js
  var GROUPS = [
    { ru: 'Музыка и слово', en: 'Music and words', tj: 'Мусиқӣ ва калом' },
    { ru: 'Блог и медиа', en: 'Blog and media', tj: 'Блог ва медиа' },
    { ru: 'Сцена и экран', en: 'Stage and screen', tj: 'Саҳна ва экран' },
    { ru: 'Творчество', en: 'Creativity', tj: 'Эҷодкорӣ' },
    { ru: 'Красота и стиль', en: 'Beauty and style', tj: 'Зебоӣ ва услуб' },
    { ru: 'Спорт', en: 'Sport', tj: 'Варзиш' },
    { ru: 'Бизнес', en: 'Business', tj: 'Тиҷорат' },
    { ru: 'Дом и работа', en: 'Home and work', tj: 'Хона ва кор' }
  ];

  var SECTIONS = {
    cities:    { ru: 'Города Таджикистана', en: 'Cities of Tajikistan', tj: 'Шаҳрҳои Тоҷикистон' },
    countries: { ru: 'Другие страны', en: 'Other countries', tj: 'Давлатҳои дигар' }
  };

  var COUNTRIES = {
    tj: { ru: 'Таджикистан', en: 'Tajikistan', tj: 'Тоҷикистон' },
    ru: { ru: 'Россия', en: 'Russia', tj: 'Русия' },
    uz: { ru: 'Узбекистан', en: 'Uzbekistan', tj: 'Ӯзбекистон' },
    kz: { ru: 'Казахстан', en: 'Kazakhstan', tj: 'Қазоқистон' },
    kg: { ru: 'Киргизия', en: 'Kyrgyzstan', tj: 'Қирғизистон' }
  };

  // Ключ: русское название, как оно хранится в talents.json
  var CITIES = {
    'Душанбе':     { en: 'Dushanbe', tj: 'Душанбе' },
    'Худжанд':     { en: 'Khujand', tj: 'Хуҷанд' },
    'Бохтар':      { en: 'Bokhtar', tj: 'Бохтар' },
    'Куляб':       { en: 'Kulob', tj: 'Кулоб' },
    'Истаравшан':  { en: 'Istaravshan', tj: 'Истаравшан' },
    'Исфара':      { en: 'Isfara', tj: 'Исфара' },
    'Пенджикент':  { en: 'Panjakent', tj: 'Панҷакент' },
    'Турсунзода':  { en: 'Tursunzoda', tj: 'Турсунзода' },
    'Вахдат':      { en: 'Vahdat', tj: 'Ваҳдат' },
    'Гиссар':      { en: 'Hisor', tj: 'Ҳисор' },
    'Нурек':       { en: 'Nurek', tj: 'Норак' },
    'Канибадам':   { en: 'Konibodom', tj: 'Конибодом' },
    'Бустон':      { en: 'Buston', tj: 'Бустон' },
    'Гафуров':     { en: 'Gafurov', tj: 'Ғафуров' },
    'Рогун':       { en: 'Rogun', tj: 'Роғун' },
    'Хорог':       { en: 'Khorog', tj: 'Хоруғ' },
    'Яван':        { en: 'Yovon', tj: 'Ёвон' },
    'Дангара':     { en: 'Danghara', tj: 'Данғара' },
    'Шахритус':    { en: 'Shahritus', tj: 'Шаҳритус' },
    'Сарбанд':     { en: 'Sarband', tj: 'Сарбанд' },
    'Файзабад':    { en: 'Fayzobod', tj: 'Файзобод' },
    'Пяндж':       { en: 'Panj', tj: 'Панҷ' },
    'Зафарабад':   { en: 'Zafarobod', tj: 'Зафаробод' },
    'Айни':        { en: 'Ayni', tj: 'Айнӣ' },
    'Гулистон':    { en: 'Gulistan', tj: 'Гулистон' },

    'Москва':          { en: 'Moscow', tj: 'Маскав' },
    'Санкт-Петербург': { en: 'Saint Petersburg', tj: 'Санкт-Петербург' },
    'Ташкент':         { en: 'Tashkent', tj: 'Тошканд' },
    'Самарканд':       { en: 'Samarkand', tj: 'Самарқанд' },
    'Бухара':          { en: 'Bukhara', tj: 'Бухоро' },
    'Алматы':          { en: 'Almaty', tj: 'Алматӣ' },
    'Астана':          { en: 'Astana', tj: 'Остона' },
    'Бишкек':          { en: 'Bishkek', tj: 'Бишкек' },
    'Ош':              { en: 'Osh', tj: 'Ӯш' }
  };

  function lang(code) {
    if (code === 'ru' || code === 'en' || code === 'tj') return code;
    try {
      var c = window.TLSite && window.TLSite.lang && window.TLSite.lang();
      if (c === 'en' || c === 'tj') return c;
    } catch (e) {}
    return 'ru';
  }

  function pick(entry, code) {
    if (!entry) return '';
    return entry[lang(code)] || entry.ru || '';
  }

  var TLDict = {
    // Роль по коду: TLDict.role('singer') или TLDict.role('singer', 'en')
    role: function (key, code) {
      return pick(ROLES[key] || ROLES.talent, code);
    },
    // Страна по коду: ru, uz, kz, kg, tj
    country: function (key, code) {
      return pick(COUNTRIES[key], code) || String(key || '');
    },
    // Город по русскому названию; неизвестный город возвращается как есть
    city: function (name, code) {
      var l = lang(code);
      if (!name || l === 'ru') return name || '';
      var c = CITIES[name];
      return (c && c[l]) || name;
    },
    // Подпись места для анкеты: «Москва, Россия» или «Душанбе»
    place: function (p, code) {
      if (!p) return '';
      var city = TLDict.city(p.city, code);
      if (p.country && p.country !== 'tj') {
        var country = TLDict.country(p.country, code);
        return city ? city + ', ' + country : country;
      }
      return city;
    },
    // Название группы фильтра по номеру (порядок как в GROUPS)
    group: function (index, code) {
      return pick(GROUPS[index], code);
    },
    // Заголовок раздела фильтра: 'cities' или 'countries'
    section: function (key, code) {
      return pick(SECTIONS[key], code);
    }
  };

  window.TLDict = TLDict;
})();
