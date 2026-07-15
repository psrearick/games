const CACHE_NAME = "static-v4";
const PRECACHE_URLS = ["/", "/index.html", "/boggle-static.html", "/yahtzee-roller.html", "/boggle.html", "/yahtzee.html", "/family-feud.html", "/about.html", "/words.js", "/shared.css", "/theme.js", "/boggle-shared.css", "/boggle-shared.js"];

self.addEventListener("install", (e) => {
  self.skipWaiting().then(() => {});
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Network-first: always serve the latest version when online, refreshing
// the cache as a side effect, and only fall back to the cache when the
// network is unavailable so the games still work offline.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
