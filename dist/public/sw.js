// Service Worker para CobraPro PWA
// IMPORTANTE: Incrementar CACHE_VERSION a cada deploy para invalidar cache antigo
const CACHE_VERSION = 'cobrapro-v3';
const CACHE_NAME = CACHE_VERSION;

// Instalação: ativar imediatamente sem esperar tabs antigas fecharem
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', CACHE_VERSION);
  self.skipWaiting();
});

// Ativação: limpar TODOS os caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia de fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições não-GET
  if (request.method !== 'GET') return;

  // Ignorar APIs - sempre ir para rede
  if (url.pathname.startsWith('/api/')) return;

  // Ignorar outros domínios (fonts, analytics, CDN)
  if (url.origin !== self.location.origin) return;

  // Assets com hash (/assets/*.js, /assets/*.css): sempre rede
  // O browser já tem Cache-Control: max-age=1y, immutable - não precisa do SW
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Navegação HTML: sempre rede para garantir versão nova
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html') || new Response('Offline', { status: 503 })
      )
    );
    return;
  }

  // Outros recursos estáticos: network first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Mensagens do cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
