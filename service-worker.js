const URBIS_CACHE = 'urbis-v478-boton-toda-colombia-icono-filtro';
const URBIS_ASSETS = [
  './',
  './index.html',
  './analisis-ia.html',
  './css/60-analisis-ia.css',
  './js/60-analisis-ia-motor.js',
  './js/61-analisis-ia-datos.js',
  './js/62-analisis-ia-app.js',
  './js/63-analisis-ia-informe.js',
  './manifest.json',
  './assets/brand/urbis-logo.png',
  './assets/brand/llegada.png',
  './assets/brand/welcome-illustration.jpg',
  './assets/brand/aurea.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/llegada.png',
  './assets/icons/urbis-home.png',
  './assets/icons/urbis-car.png',
  './assets/icons/urbis-map.png',
  './assets/icons/urbis-colombia.png',
  './assets/icons/urbis-filtro.png',
  './assets/icons/alerta-sismo.png',
  './assets/icons/alerta-incendio-forestal.png',
  './assets/icons/urbis-report.svg',
  './assets/icons/urbis-event.svg',
  './assets/icons/urbis-events.svg',
  './assets/avatars/avatar-01.png',
  './assets/avatars/avatar-02.png',
  './assets/avatars/avatar-03.png',
  './assets/avatars/avatar-04.png',
  './assets/avatars/avatar-05.png',
  './assets/avatars/avatar-06.png',
  './assets/avatars/avatar-07.png',
  './assets/avatars/avatar-08.png',
  './assets/avatars/avatar-09.png',
  './assets/avatars/avatar-10.png',
  './assets/avatars/avatar-11.png',
  './assets/avatars/avatar-12.png',
  './css/main.css',
  './css/99-safe-destination-dot.css',
  './css/00-brand-urbis.css',
  './css/01-base-layout.css',
  './css/02-map-tools-routing.css',
  './css/03-basemap-and-panels.css',
  './css/04-automap-markers-performance.css',
  './css/05-clusters.css',
  './css/06-landing.css',
  './css/07-mobile-advanced.css',
  './css/08-role-accessibility.css',
  './css/09-achievements.css',
  './css/10-sport.css',
  './css/12-module-access.css',
  './css/99-contrast-fix.css',
  './css/50-mobile-first-app.css',
  './css/15-mobile-mobility-pro.css',
  './css/16-mobility-clean-traffic.css',
  './css/17-contextual-mobility-ui.css',
  './css/13-mobile-app-own.css',
  './js/00-config.js',
  './js/26-sheetdb-mobile-guard.js',
  './js/01-audio-feedback.js',
  './js/02-auth-roles.js',
  './js/03-map-data-config.js',
  './js/04-marker-proximity.js',
  './js/05-helpers-temporal-security.js',
  './js/06-mobility-traffic.js',
  './js/07-admin-verification.js',
  './js/08-charts-dashboard.js',
  './js/09-events.js',
  './js/10-visible-markers.js',
  './js/11-report-form.js',
  './js/12-spa-ui.js',
  './js/13-landing-metrics.js',
  './js/47-aurea-forzado.js',
  './js/50-alerta-forzado.js',
  './js/14-advanced-tools.js',
  './js/15-role-accessibility-layers.js',
  './js/16-achievements.js',
  './js/17-sport.js',
  './js/45-mascotas-fundacion.js',
  './css/45-mascotas-fundacion.css',
  './js/46-runner-strava.js',
  './js/48-runner-stats.js',
  './js/49-urbis-analisis.js',
  './css/46-runner-strava.css',
  './css/47-aurea-menu.css',
  './css/48-runner-stats.css',
  './css/49-urbis-analisis.css',
  './css/51-cute-theme-pc.css',
  './css/52-urbis-pro-city.css',
  './css/24-procity-analisis.css',
  './js/24-procity-analisis.js',
  './js/25-procity-analitica.js',
  './js/26-procity-exportar.js',
  './js/20-mobile-functional-app.js',
  './js/21-mobile-mobility-pro.js',
  './js/22-mobility-clean-traffic.js',
  './js/23-contextual-mobility-ui.js',
  './js/36-mobility-static-search.js',
  './js/19-mobile-own-app.js',
  './js/18-mobile-first-ux.js',
  './css/28-mobile-kawaii-entry.css',
  './css/29-mobile-kawaii-platform.css',
  './css/36-mobility-static-search.css',
  './css/43-clean-user-entry.css',
  './css/44-mobile-auth-onboarding.css',
  './assets/data/future-uses-taxonomy.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(URBIS_CACHE).then(cache => cache.addAll(URBIS_ASSETS)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== URBIS_CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // HTML siempre network-first para evitar que iPhone/Brave muestre versiones corruptas o mezcladas.
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    // BUG corregido (v434): antes CUALQUIER navegación se cacheaba bajo la
    // clave './index.html', así que visitar otra página (ej. analisis-ia.html)
    // corrompía el fallback offline de la app. Ahora cada página se cachea
    // bajo su propia URL y el fallback usa la página pedida (con index como
    // último recurso).
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();
          caches.open(URBIS_CACHE).then(cache => cache.put(request, copy)).catch(() => null);
          return response;
        })
        .catch(() => caches.match(request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Assets: network-first con fallback cacheado.
  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone();
        caches.open(URBIS_CACHE).then(cache => cache.put(request, copy)).catch(() => null);
        return response;
      })
      .catch(() => caches.match(request))
  );
});
