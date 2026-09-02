// Service worker simples, para o app funcionar como PWA instalável.
//
// Estratégia "network-first": toda requisição tenta a rede primeiro, e só
// cai no cache se a rede falhar (uso offline). Isso é importante porque o
// app é atualizado com frequência — com "cache-first" (como era antes),
// quem já tinha aberto o app uma vez ficava preso para sempre na versão
// antiga do HTML/JS, mesmo depois de um novo deploy, porque o cache nunca
// era invalidado. Isso causava tela branca: o HTML antigo em cache
// referenciava arquivos JS que não existem mais no deploy atual.
const CACHE_NAME = "horario-escolar-cache-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Remove caches de versões antigas do service worker.
      caches.keys().then((nomes) =>
        Promise.all(
          nomes
            .filter((nome) => nome !== CACHE_NAME)
            .map((nome) => caches.delete(nome))
        )
      ),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Só intercepta GET do mesmo domínio — nunca POST/PUT/DELETE (a API usa
  // esses métodos e não deve ser cacheada) e nunca requisições de outra
  // origem (evita erros como tentar cachear "chrome-extension://...").
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const respClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
