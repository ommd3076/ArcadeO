/// <reference lib="webworker" />
declare const __SHELL_ASSETS__: string[];
declare const __SHELL_REVISION__: string;
declare const __PUBLIC_ASSETS__: string[];
const sw = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `arcade-shell-${__SHELL_REVISION__}`;
const publicPaths = new Set(__PUBLIC_ASSETS__);

sw.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(__SHELL_ASSETS__)));
  // Wait for existing clients to leave; never interrupt an active match.
});
sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("arcade-shell-") && key !== cacheName)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
});
sw.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    url.origin !== sw.location.origin ||
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.search
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(
        async () => (await caches.match("/index.html")) || Response.error(),
      ),
    );
  } else if (publicPaths.has(url.pathname)) {
    event.respondWith(
      caches.open(cacheName).then(async (cache) => {
        const saved = await cache.match(event.request);
        if (saved) return saved;
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      }),
    );
  }
});
