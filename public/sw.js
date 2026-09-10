/* BMU WATCH Service Worker
 * Offline-first caching strategy.
 *
 * Caching rules:
 *  - Navigations (app shell): network-first with cache fallback -> app opens offline.
 *  - Static assets (JS/CSS/images/fonts): stale-while-revalidate.
 *  - Reference data (/api/categories, /api/locations): stale-while-revalidate.
 *  - Sensitive APIs: NEVER cached (report content, admin endpoints, responses).
 */

const VERSION = "bmu-watch-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const REF_CACHE = `${VERSION}-ref`;

const REFERENCE_API = ["/api/categories", "/api/locations"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(["/offline"])).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Network-first for navigation: serve fresh shell if online, else fall back to cache.
async function navigationHandler(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(SHELL_CACHE);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallback = await caches.match("/offline");
    if (fallback) return fallback;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  const path = url.pathname;

  // Navigations -> network first with shell fallback.
  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request).catch(() => caches.match("/offline")));
    return;
  }

  // Reference data (categories/locations) -> stale-while-revalidate.
  if (REFERENCE_API.includes(path)) {
    event.respondWith(
      caches.open(REF_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Static assets -> stale-while-revalidate.
  if (/\.(?:js|css|png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|eot|json)$/.test(path)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Other same-origin GETs: try network, fall back to cache (non-sensitive only).
  // Reports/admin APIs still pass through to network; we never cache them.
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
