// Service worker: apre l'interfaccia anche senza rete e mostra le notifiche dei promemoria.
const CACHE = 'badante-v4';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // il traffico verso Supabase non passa dalla cache
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match(self.registration.scope)))
  );
});
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Badante di Maria', {
    body: d.body || '',
    icon: `${self.registration.scope}icons/icon-192.png`,
    badge: `${self.registration.scope}icons/icon-192.png`,
    tag: d.tag || 'badante',
    data: { url: d.url || self.registration.scope },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
    for (const c of lista) if (c.url.startsWith(self.registration.scope)) return c.focus();
    return self.clients.openWindow(url);
  }));
});
