/* Service worker de URBIS Reportes.
   Caché propia y separada de la app completa: instalar la app ligera no debe
   arrastrar los 2,1 MB de la grande, que es justamente lo que se quiere evitar. */
const CACHE = 'urbis-reportes-v1';
const ASSETS = [
  './reportes.html',
  './manifest-reportes.json',
  './css/00-brand-urbis.css',
  './css/01-base-layout.css',
  './js/00-config.js',
  './js/02-auth-roles.js',
  './js/03-map-data-config.js',
  './js/03b-edificio-vocabulario.js',
  './js/03c-reportes-rapidos.js',
  './js/04-marker-proximity.js',
  './js/05-helpers-temporal-security.js',
  './js/11-report-form.js',
  './js/12-spa-ui.js',
  './js/13b-duplicados.js',
  './js/13c-denuncias.js',
  './js/13d-mis-reportes-noti.js',
  './js/13e-nivel2.js',
  './js/13f-victimas.js',
  './js/13g-config-admin.js',
  './js/13h-permisos.js',
  './js/13i-vitrina.js',
  './js/80-reportes-shell.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => null));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k.startsWith('urbis-reportes-') && k !== CACHE)
                  .map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Red primero para los datos (siempre queremos lo último que reportó la
  // comunidad); caché primero para lo que no cambia.
  e.respondWith(
    fetch(e.request).then(r => {
      if (r && r.ok && e.request.url.startsWith(self.location.origin)) {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia)).catch(() => null);
      }
      return r;
    }).catch(() => caches.match(e.request))
  );
});
