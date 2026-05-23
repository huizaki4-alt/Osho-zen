const CACHE = 'divination-v3';
const FILES = [
  './index.html',
  './osho-zen.html',
  './iching.html',
  './astro-dice.html',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of FILES) {
      try { await cache.add(url); }
      catch (err) { console.warn('[SW] skip:', url, err.message); }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Navigation: try exact match, then index.html fallback
  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      const cached = await caches.match(e.request)
        || await caches.match(new Request(url.pathname.replace(/\/$/, '/index.html') || './index.html'));
      if (cached) return cached;
      try {
        const res = await fetch(e.request);
        if (res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(e.request, res.clone());
        }
        return res;
      } catch {
        return await caches.match('./index.html') || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Other GET requests: cache-first
  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;
    try {
      const res = await fetch(e.request);
      if (res.ok) {
        const cache = await caches.open(CACHE);
        cache.put(e.request, res.clone());
      }
      return res;
    } catch {
      return new Response('Offline', { status: 503 });
    }
  })());
});
