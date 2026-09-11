/* URBIS · Visión Territorial · service worker PROPIO
   ─────────────────────────────────────────────────────────────────────────
   Ámbito y caché propios: un módulo no sirve archivos de otro. Se registra
   con scope '/vision-territorial', que es más estrecho que el del service
   worker general ('/'), y el navegador le da la página a quien tenga el
   ámbito más largo que coincida: a este.

   Qué guarda: la cáscara (HTML, CSS, JS, iconos, manifiesto). Qué NO
   guarda: nada de api.urbispro.city. Los datos del último análisis los
   guarda la página en su propio almacenamiento, con fecha, y los enseña
   diciendo que son guardados. Sin red se consulta y se exporta; no se
   recalcula ni se aprueba.

   La versión va acá y en vision-territorial.html, idéntica, como en los
   otros siete archivos de versión del sitio: revisar.js lo comprueba. */
const VT_CACHE = 'urbis-vt-v868-mas-de-una-lista-viva';
const VT_ASSETS = [
  './vision-territorial.html',
  './css/90-vt.css',
  './js/00-config.js',
  './js/71-iconos-urbis.js',
  './js/90-vt-app.js',
  './manifest-gobierno.json',
  './assets/icons/gobierno/icon-192.png',
  './assets/icons/gobierno/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VT_CACHE).then(c => c.addAll(VT_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k.indexOf('urbis-vt-') === 0 && k !== VT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  // Nada del motor ni de terceros pasa por la caché: el dato viejo se
  // enseña como viejo desde la página, no como si fuera de ahora.
  if (u.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      const red = fetch(req).then(res => {
        if (res && res.ok && VT_ASSETS.some(a => u.pathname.endsWith(a.replace('./', '/')))) {
          const copia = res.clone();
          caches.open(VT_CACHE).then(c => c.put(req, copia));
        }
        return res;
      }).catch(() => hit);
      return hit || red;
    })
  );
});
