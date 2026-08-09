/* URBIS V102 · Movilidad GPS · Reescritura completa — accede al map global directamente */

// ─── Estado ───────────────────────────────────────────────────────────────────
var urbisM = {
  active: false,
  pendingDest: false,
  destLatlng: null,
  destMarker: null,
  transport: localStorage.getItem('urbis_mobility_transport') || 'car',
  shell: null,
  floatingDest: null,
  resultsBox: null,
  transportPanel: null,
  toastEl: null,
  mapClickBound: false,
  lastCancelAt: 0
};

var URBIS_TRANSPORTS = [
  { key: 'car',        label: 'Carro',  icon: '🚗' },
  { key: 'motorcycle', label: 'Moto',   icon: '🏍️' },
  { key: 'bike',       label: 'Bici',   icon: '🚲' },
  { key: 'walking',    label: 'A pie',  icon: '🚶' },
  { key: 'bus',        label: 'Bus',    icon: '🚌' }
];


function urbisCutePinIconHtml(extraClass) {
  return '<img class="u88-cute-pin-icon ' + (extraClass || '') + '" src="assets/icons/urbis-pin-kawaii.png" alt="Ubicación">';
}

// ─── Obtener mapa ─────────────────────────────────────────────────────────────
// "map" es la variable global de 03-map-data-config.js (sin IIFE, accesible globalmente)
function urbisGetMap() {
  try { if (typeof map !== 'undefined' && map && typeof map.on === 'function') return map; } catch(e) {}
  if (window.map && typeof window.map.on === 'function') return window.map;
  if (window.urbisMap && typeof window.urbisMap.on === 'function') return window.urbisMap;
  try {
    var el = document.getElementById('map');
    if (el && el._leaflet_map) return el._leaflet_map;
    var lc = document.querySelector('.leaflet-container');
    if (lc && lc._leaflet_map) return lc._leaflet_map;
  } catch(e) {}
  return null;
}

// ─── Shell UI ─────────────────────────────────────────────────────────────────
function urbisCreateShell() {
  if (urbisM.shell && document.body.contains(urbisM.shell)) return;
  var shell = document.createElement('div');
  shell.id = 'u88-mobility-shell';
  shell.innerHTML =
    '<div id="u88-floating-destination">' +
      '<div class="u95-destination-card">' +
        '<span>\u00bfQuieres llegar aqu\u00ed?</span>' +
        '<button type="button" class="u95-destination-go" id="u95-btn-go">Ir</button>' +
        '<button type="button" class="u95-destination-x" id="u95-btn-cancel">\u00d7</button>' +
      '</div>' +
    '</div>' +
    '<form class="u88-search" id="u88-search-form" autocomplete="off">' +
      '<div class="u88-search-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M10.7 18.2a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" stroke-width="2.4"/><path d="m16.2 16.2 5 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></div>' +
      '<input id="u88-search-input" type="search" placeholder="\u00bfA d\u00f3nde quieres ir?" />' +
      '<button class="u88-gps-btn" id="u88-gps-btn" type="button">' + urbisCutePinIconHtml('u88-gps-btn-img') + '</button>' +
    '</form>' +
    '<div id="u88-search-results"></div>' +
    '<section id="u88-transport-panel">' +
      '<div class="u88-transport-title"><b>\u00bfC\u00f3mo quieres ir?</b></div>' +
      '<div class="u88-transport-grid">' +
        URBIS_TRANSPORTS.map(function(t) {
          return '<button type="button" data-u88-transport="' + t.key + '"><span>' + t.icon + '</span><small>' + t.label + '</small></button>';
        }).join('') +
      '</div>' +
      '<button class="u88-start-route" type="button" id="u88-start-route">Iniciar recorrido</button>' +
    '</section>' +
    '<nav class="u88-bottom-dock">' +
      '<button class="u88-tab" type="button" data-u88-go="home"><img class="u88-tab-img u88-tab-img-home" src="assets/icons/urbis-home.png" alt=""></button>' +
      '<button class="u88-tab active" type="button" data-u88-go="mobility"><img class="u88-tab-img u88-tab-img-car" src="assets/icons/urbis-car.png" alt=""></button>' +
      '<button class="u88-plus" type="button" data-u88-go="plus">+</button>' +
      '<button class="u88-tab" type="button" data-u88-go="destinations"><img class="u88-tab-img u88-tab-img-destination" src="assets/icons/llegada.png" alt=""></button>' +
      '<button class="u88-tab" type="button" data-u88-go="map"><img class="u88-tab-img u88-tab-img-map" src="assets/icons/urbis-map.png" alt=""></button>' +
    '</nav>' +
    '<div id="u88-toast"></div>';

  document.body.appendChild(shell);
  urbisM.shell          = shell;
  urbisM.floatingDest   = shell.querySelector('#u88-floating-destination');
  urbisM.resultsBox     = shell.querySelector('#u88-search-results');
  urbisM.transportPanel = shell.querySelector('#u88-transport-panel');
  urbisM.toastEl        = shell.querySelector('#u88-toast');

  shell.querySelector('#u95-btn-go').addEventListener('click', function(ev) { ev.stopPropagation(); urbisConfirmDest(); });
  shell.querySelector('#u95-btn-cancel').addEventListener('click', function(ev) { ev.stopPropagation(); urbisCancelDest(); });

  var form  = shell.querySelector('#u88-search-form');
  var input = shell.querySelector('#u88-search-input');
  form.addEventListener('submit', function(ev) { ev.preventDefault(); urbisSearchAddress(input.value); });
  input.addEventListener('input', function() {
    var value = input.value.trim();
    if (!value) { urbisHideResults(); return; }
    urbisSearchAddressDebounced(value);
  });
  input.addEventListener('focus', function() {
    var value = input.value.trim();
    if (value.length >= 3) urbisSearchAddressDebounced(value);
  });
  shell.querySelector('#u88-gps-btn').addEventListener('click', urbisLocate);
  shell.querySelectorAll('[data-u88-transport]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      urbisM.transport = btn.dataset.u88Transport;
      localStorage.setItem('urbis_mobility_transport', urbisM.transport);
      try { if (window.URBIS_MOBILITY_STATE && typeof window.URBIS_MOBILITY_STATE.setTransport === 'function') window.URBIS_MOBILITY_STATE.setTransport(urbisM.transport); } catch(e) {}
      urbisUpdateTransportBtns();
      urbisToast(btn.querySelector('small').textContent + ' seleccionado.');
    });
  });
  shell.querySelector('#u88-start-route').addEventListener('click', urbisStartRoute);
  shell.querySelectorAll('[data-u88-go]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var t = btn.dataset.u88Go;
      if (t === 'home')         urbisGoScreen('home');
      else if (t === 'mobility') urbisGoScreen('mobility');
      else if (t === 'map') {
        if (typeof window.urbisOpenMobilityMapPicker === 'function') {
          window.urbisOpenMobilityMapPicker();
        } else {
          urbisForceCreateMobilityMapPicker();
        }
        return;
      }
      else if (t === 'destinations') urbisBeginManualDest();
      else if (t === 'plus')     urbisGoScreen('alerts');
    });
  });
  urbisUpdateTransportBtns();
}

// ─── Navegación ───────────────────────────────────────────────────────────────
function urbisGoScreen(name) {
  if (name === 'home') urbisDisable();
  try {
    if (window.UrbisMobileAppV58 && typeof window.UrbisMobileAppV58.show === 'function') {
      window.UrbisMobileAppV58.show(name); return;
    }
  } catch(e) {}
  var app = document.getElementById('urbis-mobile-app');
  if (!app) return;
  app.querySelectorAll('[data-u52-screen]').forEach(function(s) {
    s.classList.toggle('active', s.dataset.u52Screen === name);
  });
}

// ─── Conectar click al mapa ────────────────────────────────────────────────────
function urbisBindMapClick() {
  if (urbisM.mapClickBound) return;
  var m = urbisGetMap();
  if (!m) return;
  if (!window.map) window.map = m; // exponer para otros módulos

  m.on('click', function(ev) {
    if (!urbisM.active) return;
    if (!document.body.classList.contains('u88-mobility-mode')) return;
    if (!ev || !ev.latlng) return;

    // Mientras estamos en Movilidad, este click pertenece SOLO a destino.
    // Esto evita que el mismo toque active también reportes/puntos azules del mapa global.
    window.urbisMobilityDestinationOnly = true;
    window.urbisDisableReportMapClick = true;
    window.__urbisSuppressNormalMapClickUntil = Date.now() + 700;

    var raw = ev.originalEvent;
    if (raw && raw.target && raw.target.closest) {
      if (raw.target.closest('#u88-mobility-shell'))       return;
      if (raw.target.closest('#u88-floating-destination')) return;
      if (raw.target.closest('button,input,a,select,textarea,.leaflet-control')) return;
    }

    // COMPORTAMIENTO TIPO MAPAS MODERNOS:
    // 1er toque: crea pin y burbuja.
    // 2do toque en zona vacía: cancela todo y NO crea otro pin en ese mismo toque.
    if (urbisM.pendingDest && urbisM.destLatlng) {
      urbisCancelDest();
      urbisM.lastCancelAt = Date.now();
      return;
    }

    // Pequeño seguro: si acabamos de cancelar, este mismo ciclo no debe recrear destino.
    if (Date.now() - (urbisM.lastCancelAt || 0) < 250) return;

    urbisSetDest(ev.latlng.lat, ev.latlng.lng);
  });
  urbisM.mapClickBound = true;
}

// ─── Destino ──────────────────────────────────────────────────────────────────
function urbisSetDest(lat, lng) {
  var m = urbisGetMap();
  if (!m) { urbisToast('Mapa no listo.'); return; }
  var icon = L.divIcon({
    className: 'u91-destination-leaflet-icon',
    html: '<img class="u91-map-pin-only" src="assets/icons/llegada.png" alt="">',
    iconSize: [54, 54], iconAnchor: [27, 48]
  });
  if (urbisM.destMarker) {
    urbisM.destMarker.setLatLng([lat, lng]);
    urbisM.destMarker.setIcon(icon);
  } else {
    urbisM.destMarker = L.marker([lat, lng], { zIndexOffset: 2400, icon: icon }).addTo(m);
  }
  try { m.setView([lat, lng], Math.max(m.getZoom() || 16, 16), { animate: true }); } catch(e) {}
  try {
    window.destinoSeleccionado      = { lat: lat, lng: lng };
    window.urbisDestinoSeleccionado = { lat: lat, lng: lng };
    window.destinoActual            = { lat: lat, lng: lng };
    window.routeRealPointB          = { lat: lat, lng: lng };
    window.simPointB                = { lat: lat, lng: lng };
  } catch(e) {}
  urbisM.destLatlng  = { lat: lat, lng: lng };
  urbisM.pendingDest = true;
  try { if (window.URBIS_MOBILITY_STATE && typeof window.URBIS_MOBILITY_STATE.setDestination === 'function') window.URBIS_MOBILITY_STATE.setDestination(lat, lng, 'mobile-v102'); } catch(e) {}
  urbisHideResults();
  urbisHideTransport();
  urbisShowFloating(lat, lng);
  urbisToast('Destino marcado. Toca "Ir" para continuar.');
}

function urbisCancelDest() {
  var m = urbisGetMap();
  if (urbisM.destMarker && m) { try { m.removeLayer(urbisM.destMarker); } catch(e) {} }
  urbisM.destMarker  = null;
  urbisM.destLatlng  = null;
  urbisM.pendingDest = false;
  urbisM.lastCancelAt = Date.now();

  // Limpiar referencias viejas para que ningún intervalo o flujo anterior regenere el pin.
  try {
    window.destinoSeleccionado      = null;
    window.urbisDestinoSeleccionado = null;
    window.destinoActual            = null;
    window.routeRealPointB          = null;
    window.simPointB                = null;
  } catch(e) {}

  try { if (window.URBIS_MOBILITY_STATE && typeof window.URBIS_MOBILITY_STATE.clearDestination === 'function') window.URBIS_MOBILITY_STATE.clearDestination(); } catch(e) {}
  urbisHideFloating();
  urbisHideTransport();
  urbisToast('Destino cancelado.');
}

function urbisConfirmDest() {
  if (!urbisM.destLatlng) { urbisToast('Toca el mapa para elegir destino.'); return; }
  urbisM.pendingDest = false;
  urbisHideFloating();
  urbisShowTransport();
  urbisToast('\u00bfC\u00f3mo quieres ir?');
}

// ─── Floating bubble ──────────────────────────────────────────────────────────
function urbisShowFloating(lat, lng) {
  if (!urbisM.floatingDest) return;
  var m = urbisGetMap();
  if (!m) { urbisM.floatingDest.classList.add('active'); return; }
  function reposition() {
    if (!urbisM.destLatlng) return;
    try {
      var container = (m.getContainer && m.getContainer()) || document.querySelector('.leaflet-container,#map');
      if (!container) return;
      var rect = container.getBoundingClientRect();
      var pt   = m.latLngToContainerPoint([urbisM.destLatlng.lat, urbisM.destLatlng.lng]);
      var x = rect.left + pt.x;
      var y = rect.top  + pt.y;

      // Burbuja inteligente: evita montarse sobre el pin.
      // Prioriza derecha/izquierda; si no hay espacio, usa arriba/abajo.
      var vw = window.innerWidth || document.documentElement.clientWidth || 390;
      var vh = window.innerHeight || document.documentElement.clientHeight || 760;
      var bubbleW = Math.max(urbisM.floatingDest.offsetWidth || 178, 150);
      var bubbleH = Math.max(urbisM.floatingDest.offsetHeight || 38, 34);
      var gap = 18;
      var pinR = 30;
      var safeTop = 78;
      var safeBottom = 118;
      var left = x;
      var top = y;
      var transform = 'translate(-50%,-100%)';

      function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

      if (x + pinR + gap + bubbleW < vw - 8) {
        left = x + pinR + gap;
        top = clamp(y - bubbleH / 2, safeTop, vh - safeBottom - bubbleH);
        transform = 'translate(0,0)';
      } else if (x - pinR - gap - bubbleW > 8) {
        left = x - pinR - gap;
        top = clamp(y - bubbleH / 2, safeTop, vh - safeBottom - bubbleH);
        transform = 'translate(-100%,0)';
      } else if (y - pinR - gap - bubbleH > safeTop) {
        left = clamp(x, bubbleW / 2 + 8, vw - bubbleW / 2 - 8);
        top = y - pinR - gap;
        transform = 'translate(-50%,-100%)';
      } else {
        left = clamp(x, bubbleW / 2 + 8, vw - bubbleW / 2 - 8);
        top = y + pinR + gap;
        transform = 'translate(-50%,0)';
      }

      urbisM.floatingDest.style.left = left + 'px';
      urbisM.floatingDest.style.top  = top + 'px';
      urbisM.floatingDest.style.transform = transform;
      urbisM.floatingDest.classList.add('active');
    } catch(e) {}
  }
  reposition();
  if (!m._u102floatBound) { m.on('move zoom resize', reposition); m._u102floatBound = true; }
}
function urbisHideFloating() {
  if (urbisM.floatingDest) urbisM.floatingDest.classList.remove('active');
}

// ─── Botón "Elegir destino" ───────────────────────────────────────────────────
function urbisBeginManualDest() {
  // No llamamos prepararDestinoDesdeGPS porque activa flujos antiguos del mapa.
  // En Movilidad, el click del mapa lo controla únicamente urbisBindMapClick().
  window.urbisMobilityDestinationOnly = true;
  window.urbisDisableReportMapClick = true;
  urbisBindMapClick();
  urbisToast('Toca el mapa para elegir destino.');
}

// ─── Búsqueda con LocationIQ ──────────────────────────────────────────────────
var urbisLocationIqTimer = null;
var urbisLocationIqAbort = null;
var urbisLocationIqCache = {};

function urbisGetLocationIqConfig() {
  var cfg = (window.URBIS_CONFIG && window.URBIS_CONFIG.LOCATIONIQ) ? window.URBIS_CONFIG.LOCATIONIQ : {};
  return {
    apiKey: String(cfg.apiKey || cfg.key || '').trim(),
    countrycodes: String(cfg.countrycodes || 'co').trim(),
    limit: Math.max(1, Math.min(10, Number(cfg.limit || 8))),
    debounceMs: Math.max(180, Number(cfg.debounceMs || 320)),
    language: String(cfg.language || 'es').trim(),
    minChars: Math.max(2, Number(cfg.minChars || 2)),
    localRadiusKm: Math.max(2, Math.min(40, Number(cfg.localRadiusKm || 15))),
    fallbackRadiusKm: Math.max(20, Math.min(150, Number(cfg.fallbackRadiusKm || 80))),
    bounded: cfg.bounded === undefined ? 0 : Number(cfg.bounded ? 1 : 0)
  };
}

function urbisHasLocationIqKey(key) {
  return !!key && key !== 'PASTE_YOUR_LOCATIONIQ_API_KEY_HERE' && key !== 'YOUR_ACCESS_TOKEN';
}


function urbisValidLatLng(p){
  return p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));
}

function urbisCurrentSearchCenter(){
  try{
    var gps = window.UrbisMobileGPS && typeof window.UrbisMobileGPS.getLast === 'function' ? window.UrbisMobileGPS.getLast() : null;
    if(urbisValidLatLng(gps)) return {lat:Number(gps.lat), lng:Number(gps.lng), source:'gps'};
  }catch(e){}
  try{
    if(window.urbisMobileLastGPS && urbisValidLatLng(window.urbisMobileLastGPS)) return {lat:Number(window.urbisMobileLastGPS.lat), lng:Number(window.urbisMobileLastGPS.lng), source:'gps'};
  }catch(e){}
  try{
    var m = urbisGetMap && urbisGetMap();
    var c = m && m.getCenter && m.getCenter();
    if(c && urbisValidLatLng(c)) return {lat:Number(c.lat), lng:Number(c.lng), source:'map'};
  }catch(e){}
  try{
    var def = window.URBIS_CONFIG && window.URBIS_CONFIG.DEFAULT_CENTER;
    if(Array.isArray(def) && def.length >= 2) return {lat:Number(def[0]), lng:Number(def[1]), source:'default'};
  }catch(e){}
  return null;
}

function urbisViewboxAround(center, radiusKm){
  if(!urbisValidLatLng(center)) return '';
  var lat = Number(center.lat), lng = Number(center.lng);
  var dLat = radiusKm / 111.32;
  var dLng = radiusKm / (111.32 * Math.max(0.25, Math.cos(lat * Math.PI / 180)));
  var minLon = lng - dLng;
  var minLat = lat - dLat;
  var maxLon = lng + dLng;
  var maxLat = lat + dLat;
  return [minLon.toFixed(6), minLat.toFixed(6), maxLon.toFixed(6), maxLat.toFixed(6)].join(',');
}

function urbisDistanceM(a,b){
  if(!urbisValidLatLng(a) || !urbisValidLatLng(b)) return Infinity;
  var R = 6371000;
  var p1 = Number(a.lat) * Math.PI / 180;
  var p2 = Number(b.lat) * Math.PI / 180;
  var dp = (Number(b.lat)-Number(a.lat)) * Math.PI / 180;
  var dl = (Number(b.lng)-Number(a.lng)) * Math.PI / 180;
  var s = Math.sin(dp/2)*Math.sin(dp/2) + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)*Math.sin(dl/2);
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
}

function urbisFormatDistance(m){
  if(!Number.isFinite(m)) return '';
  if(m < 950) return Math.max(20, Math.round(m/10)*10) + ' m';
  if(m < 10000) return (m/1000).toFixed(1).replace('.', ',') + ' km';
  return Math.round(m/1000) + ' km';
}

function urbisSortLocalResults(data, center){
  if(!Array.isArray(data)) return [];
  var arr = data.map(function(item){
    var lat = Number(item && item.lat);
    var lon = Number(item && (item.lon || item.lng));
    var d = Number.isFinite(lat) && Number.isFinite(lon) && urbisValidLatLng(center) ? urbisDistanceM(center, {lat:lat,lng:lon}) : Infinity;
    item.__urbisDistanceM = d;
    return item;
  });
  arr.sort(function(a,b){
    var da = Number.isFinite(a.__urbisDistanceM) ? a.__urbisDistanceM : Infinity;
    var db = Number.isFinite(b.__urbisDistanceM) ? b.__urbisDistanceM : Infinity;
    if(Math.abs(da-db) > 80) return da - db;
    return Number(b.importance || 0) - Number(a.importance || 0);
  });
  return arr;
}

function urbisSearchAddressDebounced(query) {
  query = String(query || '').trim();
  var cfg = urbisGetLocationIqConfig();

  clearTimeout(urbisLocationIqTimer);

  if (!query) { urbisHideResults(); return; }

  if (query.length < cfg.minChars) {
    urbisShowResults('<div class="u88-result muted">Escribe al menos ' + cfg.minChars + ' letras para buscar cerca de ti.</div>');
    return;
  }

  urbisLocationIqTimer = setTimeout(function() {
    urbisSearchAddress(query);
  }, cfg.debounceMs);
}

function urbisSearchAddress(query) {
  query = String(query || '').trim();
  if (!query) { urbisToast('Escribe un lugar.'); return; }

  var cfg = urbisGetLocationIqConfig();
  if (!urbisHasLocationIqKey(cfg.apiKey)) {
    urbisShowResults(
      '<div class="u88-result muted">' +
      '<b>Falta conectar LocationIQ</b>' +
      '<small>Abre js/00-config.js y pega tu API key en URBIS_CONFIG.LOCATIONIQ.apiKey.</small>' +
      '</div>'
    );
    return;
  }

  if (query.length < cfg.minChars) {
    urbisShowResults('<div class="u88-result muted">Escribe al menos ' + cfg.minChars + ' letras para buscar cerca de ti.</div>');
    return;
  }

  var center = urbisCurrentSearchCenter();
  var centerKey = center ? [center.source, Number(center.lat).toFixed(3), Number(center.lng).toFixed(3), cfg.localRadiusKm].join(':') : 'nogps';
  var cacheKey = [query.toLowerCase(), cfg.countrycodes, cfg.limit, centerKey].join('|');
  if (urbisLocationIqCache[cacheKey]) {
    urbisRenderSearchResults(urbisLocationIqCache[cacheKey], center);
    return;
  }

  if (urbisLocationIqAbort) {
    try { urbisLocationIqAbort.abort(); } catch(e) {}
  }
  urbisLocationIqAbort = ('AbortController' in window) ? new AbortController() : null;

  var nearText = center && center.source === 'gps' ? 'cerca de tu GPS' : (center ? 'cerca del mapa actual' : 'en Colombia');
  urbisShowResults('<div class="u88-result muted">Buscando ' + nearText + '…</div>');

  function buildParams(radiusKm, bounded, limit){
    var params = new URLSearchParams({
      key: cfg.apiKey,
      q: query,
      limit: String(limit || cfg.limit),
      countrycodes: cfg.countrycodes,
      'accept-language': cfg.language,
      normalizecity: '1',
      dedupe: '1',
      addressdetails: '1',
      importancesort: '0'
    });
    if(center){
      params.set('viewbox', urbisViewboxAround(center, radiusKm));
      params.set('bounded', String(bounded ? 1 : cfg.bounded));
    }
    return params;
  }

  function fetchLocationIq(params){
    var url = 'https://api.locationiq.com/v1/autocomplete?' + params.toString();
    return fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: urbisLocationIqAbort ? urbisLocationIqAbort.signal : undefined
    }).then(function(r) {
      if (!r.ok) throw new Error('LocationIQ HTTP ' + r.status);
      return r.json();
    });
  }

  fetchLocationIq(buildParams(cfg.localRadiusKm, 0, Math.max(cfg.limit, 8)))
    .then(function(data) {
      data = Array.isArray(data) ? data : [];
      data = urbisSortLocalResults(data, center);
      if(!data.length && center){
        return fetchLocationIq(buildParams(cfg.fallbackRadiusKm, 0, cfg.limit)).then(function(fallback){
          return urbisSortLocalResults(Array.isArray(fallback) ? fallback : [], center);
        });
      }
      return data;
    })
    .then(function(data) {
      data = Array.isArray(data) ? data : [];
      urbisLocationIqCache[cacheKey] = data;
      urbisRenderSearchResults(data, center);
    })
    .catch(function(err) {
      if (err && err.name === 'AbortError') return;
      console.warn('URBIS LocationIQ search error:', err);
      urbisShowResults('<div class="u88-result muted">No se pudo buscar ahora. Revisa tu API key o conexión.</div>');
    });
}

function urbisResultIcon(item) {
  var cls = String(item.class || item.type || '').toLowerCase();
  var type = String(item.type || '').toLowerCase();
  if (cls.indexOf('amenity') >= 0 || type.indexOf('restaurant') >= 0 || type.indexOf('cafe') >= 0) return '🏪';
  if (type.indexOf('school') >= 0 || type.indexOf('university') >= 0) return '🏫';
  if (type.indexOf('hospital') >= 0 || type.indexOf('clinic') >= 0) return '🏥';
  if (type.indexOf('park') >= 0 || cls.indexOf('leisure') >= 0) return '🌳';
  if (cls.indexOf('highway') >= 0 || type.indexOf('road') >= 0) return '🛣️';
  return urbisCutePinIconHtml('u88-result-pin');
}

function urbisResultTitle(item) {
  var named = item.namedetails || {};
  return item.name || named.name || named['name:es'] || item.display_place || item.display_name || 'Lugar';
}

function urbisResultSubtitle(item) {
  return item.display_address || item.display_name || '';
}

function urbisRenderSearchResults(data, center) {
  if (!data.length) {
    urbisShowResults('<div class="u88-result muted">Sin resultados. Prueba con otra dirección o toca el mapa.</div>');
    return;
  }

  urbisShowResults(data.slice(0, 8).map(function(item, i) {
    var title = urbisResultTitle(item);
    var subtitle = urbisResultSubtitle(item);
    var dist = urbisFormatDistance(item.__urbisDistanceM);
    return '' +
      '<button class="u88-result u88-locationiq-result" type="button" data-idx="' + i + '">' +
        '<span class="u88-result-ico">' + urbisResultIcon(item) + '</span>' +
        '<span class="u88-result-copy">' +
          '<b>' + urbisEsc(String(title).substring(0, 52)) + (dist ? ' <em>' + urbisEsc(dist) + '</em>' : '') + '</b>' +
          '<small>' + urbisEsc(String(subtitle).substring(0, 96)) + '</small>' +
        '</span>' +
      '</button>';
  }).join(''));

  urbisM.resultsBox.querySelectorAll('[data-idx]').forEach(function(btn) {
    btn.addEventListener('click', function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var item = data[Number(btn.dataset.idx)];
      if (!item) return;
      var lat = Number(item.lat);
      var lon = Number(item.lon || item.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        urbisToast('Ese resultado no tiene coordenadas válidas.');
        return;
      }
      var input = document.getElementById('u88-search-input');
      if (input) input.value = urbisResultTitle(item);
      urbisSetDest(lat, lon);
      urbisHideResults();
      urbisToast('Destino seleccionado desde búsqueda.');
    });
  });
}

function urbisShowResults(html) { if (!urbisM.resultsBox) return; urbisM.resultsBox.innerHTML = html; urbisM.resultsBox.classList.add('active'); }
function urbisHideResults()     { if (!urbisM.resultsBox) return; urbisM.resultsBox.classList.remove('active'); urbisM.resultsBox.innerHTML = ''; }

// ─── Transporte ───────────────────────────────────────────────────────────────
function urbisShowTransport()   { if (urbisM.transportPanel) urbisM.transportPanel.classList.add('active'); urbisUpdateTransportBtns(); }
function urbisHideTransport()   { if (urbisM.transportPanel) urbisM.transportPanel.classList.remove('active'); }
function urbisUpdateTransportBtns() {
  if (!urbisM.transportPanel) return;
  urbisM.transportPanel.querySelectorAll('[data-u88-transport]').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.u88Transport === urbisM.transport);
  });
}

// ─── Iniciar ruta ─────────────────────────────────────────────────────────────
function urbisStartRoute() {
  if (!urbisM.destLatlng) { urbisToast('Elige un destino primero.'); urbisBeginManualDest(); return; }
  try { window.routeRealMode = urbisM.transport === 'motorcycle' ? 'car' : urbisM.transport; } catch(e) {}
  try { document.querySelectorAll('[data-u52-transport]').forEach(function(b) { b.classList.toggle('active', b.dataset.u52Transport === urbisM.transport); }); } catch(e) {}
  try { if (typeof seleccionarModoRutaReal === 'function') seleccionarModoRutaReal(urbisM.transport); } catch(e) {}
  try { if (typeof window.urbisSetRutaRealDestinoMovil === 'function') window.urbisSetRutaRealDestinoMovil(urbisM.destLatlng, urbisM.transport); } catch(e) {}
  urbisToast('Calculando ruta\u2026');
  urbisHideTransport();
  Promise.resolve()
    .then(function() {
      if (window.URBIS_MOBILITY_STATE && typeof window.URBIS_MOBILITY_STATE.startRoute === 'function') {
        return window.URBIS_MOBILITY_STATE.startRoute();
      }
      return typeof calcularRutaRealActual === 'function' ? calcularRutaRealActual() : null;
    })
    .then(function(route) {
      try { if (typeof iniciarRastreoGPS === 'function') iniciarRastreoGPS(); } catch(e) {}
      var ok = route || (window.routeRealLastResult && window.routeRealLastResult.geometry);
      if(!ok){ urbisToast('No se pudo dibujar la ruta. Reintenta con GPS activo.'); urbisShowTransport(); return; }
      urbisToast('Ruta iniciada. Sigue la línea celeste.');
      urbisGoScreen('nav');
    })
    .catch(function(e) { console.warn('[URBIS V102] ruta:', e); urbisToast('No se pudo iniciar.'); urbisShowTransport(); });
}

// ─── GPS ──────────────────────────────────────────────────────────────────────
function urbisLocate() {
  try { if (window.UrbisMobileGPS && typeof window.UrbisMobileGPS.centerOnMobileGps === 'function') { window.UrbisMobileGPS.centerOnMobileGps(); return; } } catch(e) {}
  if (!navigator.geolocation) { urbisToast('GPS no disponible.'); return; }
  navigator.geolocation.getCurrentPosition(function(pos) {
    var m = urbisGetMap();
    if (m) m.setView([pos.coords.latitude, pos.coords.longitude], Math.max(m.getZoom() || 16, 16), { animate: true });
    urbisToast('Ubicaci\u00f3n centrada.');
  }, function() { urbisToast('Activa permisos de GPS.'); }, { enableHighAccuracy: true, timeout: 10000 });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function urbisToast(msg) {
  if (!urbisM.toastEl) return;
  urbisM.toastEl.textContent = msg;
  urbisM.toastEl.classList.add('active');
  clearTimeout(urbisM.toastEl._t);
  urbisM.toastEl._t = setTimeout(function() { urbisM.toastEl.classList.remove('active'); }, 2400);
}
function urbisEsc(t) {
  return String(t || '').replace(/[&<>"']/g, function(c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]; });
}

// ─── Activar / Desactivar ─────────────────────────────────────────────────────
function urbisApplyMobilityBasemap() {
  try {
    var key = 'mobilityPoi';
    if (window.URBIS_BASEMAPS && window.URBIS_BASEMAPS.mobilityKey) key = window.URBIS_BASEMAPS.mobilityKey;
    else if (window.URBIS_BASEMAPS) window.URBIS_BASEMAPS.mobilityKey = key;
    if (typeof window.cambiarMapaBase === 'function') window.cambiarMapaBase(key, { silent:true });
  } catch(e) {}
}

function urbisEnable() {
  if (urbisM.active) {
    urbisApplyMobilityBasemap();
    if (!urbisM.mapClickBound) urbisBindMapClick();
    return;
  }
  urbisCreateShell();
  document.body.classList.add('u88-mobility-mode');
  urbisM.active = true;
  urbisApplyMobilityBasemap();

  // En Movilidad se bloquean reportes/global clicks, pero NO se bloquea el mapa.
  // El mapa sigue navegable; solo se reserva el tap para destino.
  window.urbisMobilityDestinationOnly = true;
  window.urbisDisableReportMapClick = true;
  var tries = 0;
  function tryBind() {
    urbisBindMapClick();
    if (!urbisM.mapClickBound && tries++ < 15) setTimeout(tryBind, 300);
  }
  setTimeout(function() {
    try { var m = urbisGetMap(); if (m) m.invalidateSize(); } catch(e) {}
    tryBind();
  }, 100);
  try { if (typeof window.aplicarMapaClaro === 'function') window.aplicarMapaClaro(); } catch(e) {}
}

function urbisDisable() {
  if (!urbisM.active) return;
  document.body.classList.remove('u88-mobility-mode');
  urbisM.active = false;
  window.urbisMobilityDestinationOnly = false;
  window.urbisDisableReportMapClick = false;
  urbisHideFloating();
  urbisHideResults();
  urbisHideTransport();
}

// ─── Detectar pantalla de movilidad ──────────────────────────────────────────
function urbisMobilityVisible() {
  var screen = document.querySelector('[data-u52-screen="mobility"]');
  if (!screen || !screen.classList.contains('active')) return false;
  var cs = window.getComputedStyle(screen);
  return cs.display !== 'none' && cs.visibility !== 'hidden';
}

function urbisWatch() {
  if (urbisMobilityVisible()) urbisEnable();
  else urbisDisable();
}

// ─── Sincronizar con routeRealPointB del sistema viejo ───────────────────────
setInterval(function() {
  if (!urbisM.active) return;
  if (Date.now() - (urbisM.lastCancelAt || 0) < 1000) return;
  var b = window.routeRealPointB;
  if (!b || !b.lat) return;
  if (urbisM.destLatlng && urbisM.destLatlng.lat === b.lat && urbisM.destLatlng.lng === b.lng) return;
  // Si algún flujo viejo puso destino, sincronizamos solo la burbuja sin crear ciclos de recreación.
  urbisM.destLatlng  = { lat: b.lat, lng: b.lng };
  urbisM.pendingDest = true;
  urbisShowFloating(b.lat, b.lng);
}, 600);

// ─── Arranque ─────────────────────────────────────────────────────────────────
document.addEventListener('click', function(ev) {
  if (ev.target && ev.target.closest && ev.target.closest('[data-u52-go],[data-u52-back],[data-u52-call]')) {
    setTimeout(urbisWatch, 120);
    setTimeout(urbisWatch, 400);
  }
}, true);

window.addEventListener('load', function() {
  setTimeout(urbisWatch, 500);
  setTimeout(urbisWatch, 1500);
});

setInterval(urbisWatch, 500);

// API pública
window.URBIS_MOBILITY_V102 = {
  enable: urbisEnable, disable: urbisDisable,
  setDestination: urbisSetDest, cancelDestination: urbisCancelDest,
  locate: urbisLocate,
  get state() { return urbisM; }
};


// ─── Selector vertical de mapas SOLO para Movilidad ───────────────────────────
// Hardfix integrado en el módulo real de movilidad: no depende de otro archivo.
function urbisMobilityMapOptions() {
  return [
    {key:'mobilityPoi', icon:'✨', title:'Blanco GPS', desc:'Minimalista claro para rutas'},
    {key:'actual', icon:'🟦', title:'URBIS', desc:'Base normal de la app'},
    {key:'googleRoads', icon:'🏙️', title:'Calles', desc:'Vías y nombres urbanos'},
    {key:'cartoLightMatter', icon:'☀️', title:'Claro técnico', desc:'Plano blanco y legible'},
    {key:'osmHumanitarian', icon:'🌿', title:'Comunitario', desc:'Servicios y referencias'},
    {key:'cartoDarkMatter', icon:'🌙', title:'Nocturno', desc:'Oscuro para rutas'},
    {key:'esriHD', icon:'🛰️', title:'Satélite HD', desc:'Imagen aérea real'},
    {key:'googleHybrid', icon:'🧭', title:'Híbrido', desc:'Satélite con vías'},
    {key:'googleTerrain', icon:'⛰️', title:'Terreno', desc:'Relieve urbano'},
    {key:'googleTerrainHybrid', icon:'🗻', title:'Relieve + vías', desc:'Terreno con calles'}
  ];
}

function urbisCurrentMobilityMapKey() {
  try {
    if (window.URBIS_BASEMAPS && window.URBIS_BASEMAPS.mobilityKey) return window.URBIS_BASEMAPS.mobilityKey;
    if (window.URBIS_BASEMAPS && typeof window.URBIS_BASEMAPS.getCurrent === 'function') return window.URBIS_BASEMAPS.getCurrent();
  } catch(e) {}
  return 'mobilityPoi';
}

function urbisForceCreateMobilityMapPicker() {
  var existing = document.getElementById('u120-mobility-map-picker');
  if (existing) return existing;

  var picker = document.createElement('div');
  picker.id = 'u120-mobility-map-picker';
  picker.innerHTML =
    '<div class="u120-map-backdrop" data-u120-close="1"></div>' +
    '<section class="u120-map-list" aria-label="Tipos de mapa para movilidad">' +
      '<div class="u120-map-handle"></div>' +
      '<header class="u120-map-header">' +
        '<div><b>Tipos de mapa</b><small id="u120-map-current">Selecciona el mapa base</small></div>' +
        '<button type="button" class="u120-map-close" data-u120-close="1">×</button>' +
      '</header>' +
      '<div class="u120-map-options"></div>' +
    '</section>';
  document.body.appendChild(picker);

  picker.addEventListener('click', function(ev) {
    var close = ev.target.closest('[data-u120-close]');
    if (close) {
      ev.preventDefault();
      ev.stopPropagation();
      urbisCloseMobilityMapPicker();
      return;
    }

    var option = ev.target.closest('[data-u120-map]');
    if (!option) return;
    ev.preventDefault();
    ev.stopPropagation();
    urbisChooseMobilityMap(option.dataset.u120Map, option.dataset.u120Title || 'Mapa');
  }, true);

  return picker;
}

function urbisRenderMobilityMapPicker() {
  var picker = urbisForceCreateMobilityMapPicker();
  var current = urbisCurrentMobilityMapKey();
  var maps = urbisMobilityMapOptions();
  var currentMap = maps.find(function(m){ return m.key === current; });
  var label = picker.querySelector('#u120-map-current');
  var options = picker.querySelector('.u120-map-options');
  if (label) label.textContent = 'Mapa actual: ' + (currentMap ? currentMap.title : 'Movilidad');
  if (options) {
    options.innerHTML = maps.map(function(m) {
      return '<button type="button" class="u120-map-option ' + (m.key === current ? 'active' : '') + '" data-u120-map="' + m.key + '" data-u120-title="' + m.title + '">' +
        '<span class="u120-map-icon">' + m.icon + '</span>' +
        '<span class="u120-map-text"><b>' + m.title + '</b><small>' + m.desc + '</small></span>' +
        '<span class="u120-map-check">✓</span>' +
      '</button>';
    }).join('');
  }
}

function urbisOpenMobilityMapPicker() {
  // Siempre permanecer dentro de Movilidad.
  document.body.classList.add('u88-mobility-mode');
  urbisRenderMobilityMapPicker();
  document.body.classList.add('u120-map-picker-open');
}

function urbisCloseMobilityMapPicker() {
  document.body.classList.remove('u120-map-picker-open');
}

function urbisChooseMobilityMap(key, title) {
  try {
    if (window.URBIS_BASEMAPS) window.URBIS_BASEMAPS.mobilityKey = key;
    if (typeof window.cambiarMapaBase === 'function') window.cambiarMapaBase(key, { silent:true });
  } catch(e) {
    console.warn('URBIS: no se pudo cambiar el mapa base', e);
  }
  urbisRenderMobilityMapPicker();
  try { urbisToast('Mapa ' + title + ' activo.'); } catch(e) {}
  try { if (typeof window.urbisMobileSetMobilityStatus === 'function') window.urbisMobileSetMobilityStatus('Mapa ' + title + ' activo.'); } catch(e) {}
}

window.urbisOpenMobilityMapPicker = urbisOpenMobilityMapPicker;
window.urbisCloseMobilityMapPicker = urbisCloseMobilityMapPicker;

// Captura directa del botón real del dock. Esto evita que cualquier handler viejo lo mande a otra interfaz.
document.addEventListener('click', function(ev) {
  var btn = ev.target && ev.target.closest ? ev.target.closest('#u88-mobility-shell [data-u88-go="map"], #u88-mobility-shell .u88-tab-img-map') : null;
  if (!btn) return;
  ev.preventDefault();
  ev.stopPropagation();
  ev.stopImmediatePropagation();
  urbisOpenMobilityMapPicker();
}, true);
