const CACHE_NAME = "project-monitor-static-v2";
const STATIC_ASSETS = ["/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // NEVER cache API requests, auth endpoints, or HTML page requests
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/monitor") ||
    url.pathname.startsWith("/login") ||
    event.request.method !== "GET"
  ) {
    return;
  }

  // Network-first for static shell assets
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  );
});
