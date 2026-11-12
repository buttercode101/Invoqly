const CACHE_VERSION = "invoqly-shell-v1";
const SHELL_CACHE = CACHE_VERSION + "-pages";
const ASSET_CACHE = CACHE_VERSION + "-assets";
const CORE_URLS = ["/", "/guest", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.allSettled(CORE_URLS.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("invoqly-") && !key.startsWith(CACHE_VERSION)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/sign-in") || url.pathname.startsWith("/sign-up")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok && response.type !== "opaque") await cache.put(request, response.clone());
        return response;
      } catch {
        const exact = await cache.match(request, { ignoreSearch: true });
        if (exact) return exact;
        const fallback = await cache.match(url.pathname === "/guest" ? "/guest" : "/");
        if (fallback) return fallback;
        return new Response("<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Offline · Invoqly</title><body><main><h1>You're offline</h1><p>Reconnect once to open Invoqly, then your guest workspace can keep working on this device.</p></main></body></html>", {status:503,headers:{"Content-Type":"text/html; charset=utf-8"}});
      }
    })());
    return;
  }

  if (url.pathname === "/manifest.webmanifest" || url.pathname === "/icon.svg") {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});
