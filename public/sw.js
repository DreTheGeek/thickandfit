// Thick & Fit PWA service worker.
// Network-first for navigations (HTML) so a new deploy is NEVER masked by a stale
// cached page; cache-first (with background refresh) for hashed static assets only.
// Authed HTML is never cached, so a shared device can't serve one user's page to another.
// v3: the offline fallback stopped being the marketing homepage. Bumping the name is what evicts
// the old cache, which still holds "/" from every existing install.
const CACHE = 'tf-shell-v3';
/**
 * The page shown when a navigation cannot reach the network.
 *
 * WAS '/' - the public MARKETING page, precached on install and served to anyone whose connection
 * dropped. A signed-in member opening the app on a bad connection was handed pricing and a sign-up
 * button, which is also why the installed app appeared to "load the landing page" on launch.
 *
 * A static file, not a Next route: this is served precisely when the server cannot be reached, so
 * it has to be something the cache can hold whole.
 */
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/assets/') ||
    /\.(?:css|js|woff2?|png|jpe?g|webp|avif|svg|ico)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations / HTML documents: NETWORK-FIRST. Never serve a stale page.
  const isNavigation =
    request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
  if (isNavigation) {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Hashed static assets: cache-first, refresh in the background.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // Everything else (APIs, etc.): straight to network, never cached.
});

// ---------------------------------------------------------------------------------------------
// Web Push. The server (sendPush) posts a JSON body { title, body, url }. We render a system
// notification. Tapping it focuses an open app tab (or opens one) at the notification's link.
// All of this is inert unless the user has subscribed, which only happens when VAPID is set.
// ---------------------------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_e) {
    payload = { title: 'Thick & Fit', body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'Thick & Fit';
  const options = {
    body: payload.body || '',
    icon: '/assets/images/apple-touch-icon.jpg',
    badge: '/assets/images/apple-touch-icon.jpg',
    data: { url: payload.url || '/notifications' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    }),
  );
});
