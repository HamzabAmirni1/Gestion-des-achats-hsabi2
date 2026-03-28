const CACHE = 'brasti-v2';
const ASSETS = ['/', '/index.html', '/logo.png', '/manifest.json'];

// ── Install: cache assets ──────────────────────────────
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))
  );
});

// ── Activate: clean old caches ─────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network first, cache fallback ──────────────
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});

// ── Push notifications ─────────────────────────────────
self.addEventListener('push', (e) => {
  let data = { title: 'Brasti', body: 'Nouvelle notification', icon: '/logo.png', badge: '/logo.png' };
  try { data = { ...data, ...e.data.json() }; } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/logo.png',
      badge: data.badge || '/logo.png',
      vibrate: [200, 100, 200],
      tag: 'brasti-notif',
      renotify: true,
      data: { url: data.url || '/' }
    })
  );
});

// ── Notification click ─────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length) return list[0].focus();
      return clients.openWindow(e.notification.data?.url || '/');
    })
  );
});
