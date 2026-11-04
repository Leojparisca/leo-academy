/* Leo Academy — offline shell.
   Network-first for navigations (fresh data when possible), cache-first for
   immutable brand/static assets, with a graceful offline fallback. */

const CACHE = "leo-academy-v3";
// The teacher dashboard is never precached: it renders private academy data,
// so its HTML must only exist while the httpOnly session is valid.
const SHELL = [
  "/",
  "/mapa",
  "/estudio",
  "/juegos",
  "/logo.jpg",
  "/logo-512.jpg",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.allSettled(SHELL.map((url) => cache.add(url))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const isPrivate = url.pathname.startsWith("/profesor");

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!isPrivate && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          if (isPrivate) {
            return (
              (await caches.match("/mapa")) ||
              new Response("La mesa del profesor necesita conexión.", {
                status: 503,
                headers: { "content-type": "text/plain; charset=utf-8" },
              })
            );
          }
          const cached =
            (await caches.match(request)) || (await caches.match("/mapa"));
          return (
            cached ||
            new Response("Leo Academy está sin luz. Abre la app de nuevo.", {
              status: 503,
              headers: { "content-type": "text/plain; charset=utf-8" },
            })
          );
        }),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  if (/\.(?:png|jpg|jpeg|webp|svg|woff2?|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
