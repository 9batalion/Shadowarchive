/* Change RELEASE whenever any cached file changes. Never cache external research URLs. */
const RELEASE = '1.0.0-r1';
const PREFIX = 'shadowarchive:' + self.registration.scope + ':';
const CACHE = PREFIX + RELEASE;
const ASSETS = ['./', './index.html', './manifest.webmanifest', './app.css', './print.css',
  './ids.js', './app.js', './schema.js', './db.js', './state.js', './ui.js',
  './editor.js', './views.js', './graph.js', './report.js', './quality.js', './dork.js',
  './settings.js', './security.js', './crypto.js', './multipart.js', './transfer.js',
  './search.js', './search-worker.js', './demo.js', './pwa.js', './icon.svg',
  './icon-192.png', './icon-512.png', './maskable-512.png', './apple-touch-icon.png'
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(
  p => new Request(new URL(p, self.registration.scope), {
    cache: 'reload'
  }))))));
self.addEventListener('activate', e => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(
    k)));
  await self.clients.claim();
})()));
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || !u.href.startsWith(self.registration.scope)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(e.request, {
      ignoreSearch: true
    });
    if (cached) return cached;
    try {
      return await fetch(e.request);
    } catch (error) {
      if (e.request.mode === 'navigate') return (await cache.match(new URL('./index.html', self
        .registration.scope))) || Response.error();
      throw error;
    }
  })());
});
