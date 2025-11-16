self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Cache simples apenas para modo offline básico (pode ser melhorado depois)
const CACHE_NAME = "horario-escolar-cache-v1";

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        const respClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, respClone);
        });
        return response;
      });
    })
  );
});


