const URBIS_CACHE = 'urbis-v703-la-forma-primero';
const URBIS_ASSETS = [
  './',
  './index.html',
  './analisis-ia.html',
  './seguimiento.html',
  './css/70-seguimiento.css',
  './js/70-seguimiento.js',
  './assets/data/seguimiento-presidencial.json',
  './assets/data/alertas-urbis.json',
  './css/60-analisis-ia.css',
  './js/59-analisis-ia-catalogo.js',
  './js/67-analisis-cliente.js',
  './js/61-analisis-ia-datos.js',
  './js/62-analisis-ia-app.js',
  './js/63-analisis-ia-informe.js',
  './js/66-analisis-remoto.js',
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
  './js/01-audio-feedback.js',
  './js/02-auth-roles.js',
  './js/03-map-data-config.js',
  './js/03b-edificio-vocabulario.js',
  './js/03c-reportes-rapidos.js',
  './js/04-marker-proximity.js',
  './js/05-helpers-temporal-security.js',
  './js/06-mobility-traffic.js',
  './js/07-admin-verification.js',
  './js/08-charts-dashboard.js',
  './js/09-events.js',
  './js/10-visible-markers.js',
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
  './css/68-procity-reconocimiento.css',
  './js/68-procity-reconocimiento.js',
  './css/69-licencia.css',
  './js/69-licencia.js',
  './js/25-procity-analitica.js',
  './js/26-procity-exportar.js',
  './js/26-procity-diagnostico.js',
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
  /* Nueve archivos que index.html carga y que no estaban en esta lista. Sin
     ellos la app abre sin red pero les falta media función: el módulo
     educativo (js/64 y js/65) es justamente el que compara lo reconocido con
     lo que el curso mapeó —y su ausencia se manifestaba como «Falta el
     módulo educativo», sin señal, en plena salida a campo—. Los otros son la
     cáscara de la app, el registro por correo y los ajustes de mapa.
     Se comprueban en pruebas/revisar.js: si alguno se borra, `cache.addAll`
     rechaza el lote ENTERO y el modo sin conexión desaparece en silencio. */
  './js/00-app-shell.js',
  './js/27-automapeo-default-off.js',
  './js/28-zoom-marker-optimizer.js',
  './js/41-email-registration-auth.js',
  './js/37-mobility-state-controller.js',
  './js/38-mobile-shell-visibility-guard.js',
  './js/39-mobility-map-picker-hardfix.js',
  './js/64-analisis-edu.js',
  './js/65-analisis-edu-ui.js',
  './js/70-modo-app.js',
  './css/70-modo-app.css',
  './js/71-iconos-urbis.js',
  './css/72-edu-diseno.css',
  './js/73-solar.js',
  './js/74-dibujos-analisis.js',
  './js/75-lo-intangible.js',
  './js/76-amenaza-sismica.js',
  './js/79-amenaza-inundacion.js',
  './js/80-cortes-a-mano.js',
  './js/77-sin-senal.js',
  './js/78-que-cabe.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(URBIS_CACHE).then(cache => cache.addAll(URBIS_ASSETS)).catch(() => null)
  );
  self.skipWaiting();
});

/* Las teselas del mapa que alguien se llevó a la calle. Van en un depósito
   APARTE y sin versión a propósito: el de la aplicación se borra entero en
   cada actualización —para eso está— y un sector que se guardó anoche para
   recorrerlo hoy no puede desaparecer porque salió una versión nueva. Lo
   llena js/77 desde la página; acá solo se conserva y se sirve. */
const URBIS_TESELAS = 'urbis-teselas-v1';

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== URBIS_CACHE && k !== URBIS_TESELAS).map(k => caches.delete(k))))
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

  /* Las teselas guardadas se miran ANTES de salir a la red. Con señal la
     diferencia es de milisegundos; sin ella es la diferencia entre un mapa y
     una pantalla gris, que es donde se marca lo que se ve caminando.

     Se reconocen por la URL y no por el destino de la petición: una tesela
     pedida por Leaflet y la misma pedida por el guardador tienen destinos
     distintos y son el mismo archivo. */
  if (/basemaps\.cartocdn\.com|server\.arcgisonline\.com|clarity\.maptiles\.arcgis\.com|mt\d\.google\.com\/vt/.test(request.url)) {
    /* Coincidencia exacta, sin normalizar nada. El guardador pide la
       dirección con el propio `getTileUrl` de la capa que está puesta, así que
       la clave con la que archivó es carácter por carácter la que el mapa
       pide ahora — subdominio, sufijo de retina y parámetros incluidos.
       Cualquier arreglo de la URL acá sería adivinar de nuevo lo que Leaflet
       ya sabe. */
    event.respondWith(
      caches.open(URBIS_TESELAS)
        .then(cache => cache.match(request, { ignoreVary: true }))
        .then(hit => hit || fetch(request))
        .catch(() => fetch(request))
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
