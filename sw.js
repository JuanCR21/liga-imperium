/* ============================================================
   sw.js — Service worker de Liga Imperium Fantasy
   Objetivo: que la web se pueda instalar como app y que SIEMPRE
   muestre lo último que subas (red primero), pero siga abriéndose
   sin conexión con lo último que se vio.
   No hace falta tocar nada aquí.
   ============================================================ */
const VERSION = 'liga-imperium-v1';
const NUCLEO = ['./', 'index.html', 'calc.js', 'data.js', 'manifest.json', 'icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.allSettled(NUCLEO.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red primero: siempre intenta traer lo más nuevo (revalidando con el
// servidor, aunque el navegador tuviera una copia "fresca" guardada) y solo
// si no hay conexión tira de la copia guardada.
async function redPrimero(request, esNavegacion) {
  const cache = await caches.open(VERSION);
  try {
    const respuesta = await fetch(esNavegacion ? request.url : request, { cache: 'no-cache' });
    if (respuesta && respuesta.ok) cache.put(esNavegacion ? 'index.html' : request, respuesta.clone());
    return respuesta;
  } catch (err) {
    const guardada = await cache.match(esNavegacion ? 'index.html' : request, { ignoreSearch: true });
    if (guardada) return guardada;
    throw err;
  }
}

// Imágenes y tipografías: enseña la copia guardada al instante y por
// detrás la refresca para la próxima vez.
async function guardadaYRefresca(request) {
  const cache = await caches.open(VERSION);
  const guardada = await cache.match(request);
  const refresco = fetch(request).then(r => {
    if (r && (r.ok || r.type === 'opaque')) cache.put(request, r.clone());
    return r;
  }).catch(() => guardada);
  return guardada || refresco;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const mismoOrigen = url.origin === self.location.origin;

  if (mismoOrigen) {
    if (req.mode === 'navigate') { e.respondWith(redPrimero(req, true)); return; }
    if (/\.(js|json|html|webmanifest)$/i.test(url.pathname)) { e.respondWith(redPrimero(req, false)); return; }
    if (/\.(png|jpe?g|webp|svg|gif|ico)$/i.test(url.pathname)) { e.respondWith(guardadaYRefresca(req)); return; }
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(guardadaYRefresca(req));
  }
});
