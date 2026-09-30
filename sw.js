// Service worker di Armadio: l'app funziona anche senza rete. Prima la rete, con la copia salvata come riserva.
const VERSIONE = 'arm-v1';
const FILE = [
  './', 'index.html', 'manifest.webmanifest', 'css/armadio.css', 'css/tokens.css', 'css/app.css',
  'js/app.js', 'js/db.js', 'js/model.js', 'js/immagini.js', 'js/ai.js', 'js/ui.js', 'js/expiry.js',
  'fonts/roboto-latin-wght.woff2', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSIONE).then((c) => Promise.all(FILE.map((f) => c.add(f).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((nomi) => Promise.all(nomi.filter((n) => n.startsWith('arm-') && n !== VERSIONE).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});

function conTimeout(promessa, ms) {
  return new Promise((ok, no) => {
    const t = setTimeout(() => no(new Error('timeout')), ms);
    promessa.then((r) => { clearTimeout(t); ok(r); }, (err) => { clearTimeout(t); no(err); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSIONE);
    try {
      const rete = await conTimeout(fetch(req), 4000);
      if (rete.ok) cache.put(req, rete.clone());
      return rete;
    } catch {
      const salvata = await cache.match(req, { ignoreSearch: true });
      if (salvata) return salvata;
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
});
