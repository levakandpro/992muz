const CACHE_NAME = '992muz-v3';
const STATIC_CACHE = '992muz-static-v1';
const OFFLINE_URL = '/offline.html';
const STATIC_EXTENSIONS = ['.css', '.woff', '.woff2', '.otf', '.ttf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico'];
const AUDIO_CACHE = '992muz-audio-v1';
const AUDIO_CACHE_LIMIT = 15; // сколько последних треков держим в памяти телефона
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((n) => ![CACHE_NAME, STATIC_CACHE, AUDIO_CACHE].includes(n)).map((n) => caches.delete(n))
    ))
  );
});

async function trimAudioCache() {
  const cache = await caches.open(AUDIO_CACHE);
  const keys = await cache.keys();
  if (keys.length > AUDIO_CACHE_LIMIT) {
    const toDelete = keys.slice(0, keys.length - AUDIO_CACHE_LIMIT);
    await Promise.all(toDelete.map((k) => cache.delete(k)));
  }
}

async function handleAudioRequest(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    // Кэшируем только полный файл (200), а не кусок при перемотке (206)
    if (response.ok && response.status === 200) {
      cache.put(request, response.clone());
      trimAudioCache();
    }
    return response;
  } catch (e) {
    return cached || Response.error();
  }
}
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (event.request.destination === 'audio') {
    event.respondWith(handleAudioRequest(event.request));
    return;
  }

if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cachedOffline = await caches.match(OFFLINE_URL);
        return cachedOffline || new Response(
          '<h1>Нет соединения</h1><p>Проверьте интернет и обновите страницу.</p>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })
    );
    return;
  }

  const isStatic = STATIC_EXTENSIONS.some((ext) => url.includes(ext)) && !url.includes('res.cloudinary.com');

  if (isStatic) {
    // Статика (свои иконки, шрифты, css) - сразу из кэша, без ожидания сети
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

// Всё остальное (аудио, Firestore, Cloudinary картинки) - сеть, кэш только как запасной вариант
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      return cached || Response.error();
    })
  );
});