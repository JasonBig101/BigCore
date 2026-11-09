// BIG CORE: офлайн-кэш приложения.
// При изменении файлов увеличьте номер версии, чтобы телефоны получили обновление.
const CACHE = 'bigcore-1.0';
const FONTS = 'bigcore-fonts';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bigcore-') && k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Шрифты Google: из кэша, а в фоне обновляем. Без интернета приложение берёт их из кэша.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const cache = await caches.open(FONTS);
      const hit = await cache.match(req);
      const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || Response.error();
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Страница: сначала сеть (чтобы получать обновления), без сети — из кэша.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 3500);
        const res = await fetch(url.pathname, { signal: ctl.signal, cache: 'no-cache' });
        clearTimeout(timer);
        if (res.ok) {
          cache.put('./index.html', res.clone());
          return res;
        }
        throw new Error('bad status');
      } catch (err) {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Иконки и манифест: из кэша, иначе из сети.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
