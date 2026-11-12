const CACHE_NAME = "invoqly-guest-shell-v1";
const SHELL_URLS = ["/guest", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("invoqly-guest-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/app") || url.pathname.startsWith("/sign-in") || url.pathname.startsWith("/sign-up")) return;

  if (request.mode === "navigate") {
    if (url.pathname !== "/guest" && url.pathname !== "/") return;
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(url.pathname === "/" ? "/guest" : "/guest", copy));
        }
        return response;
      }).catch(async () => (await caches.match("/guest")) || new Response("Invoqly is offline. Reconnect to refresh the workspace shell.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }))
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg" || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});