// ==========================================================================
// URBIS · Renderizador FORZADO de las alertas nacionales (sismo / incendio)
// --------------------------------------------------------------------------
// Mismo problema que la gota Áurea: pintarPuntos mete cada marcador en la capa
// de su "dimensión" (capas[dimKey]) y aplicarCapasSegunZoom desmonta esa capa
// si su casilla está desactivada. Como "🌪️ Desastres Naturales y Clima" no es
// una dimensión propia, la alerta caía en la capa por defecto y desaparecía
// con ella — mientras la zona de impacto (otra capa) sí seguía viéndose: de ahí
// que solo quedara la "mancha" y ningún icono.
//
// Estas alertas son noticia de escala nacional: se dibujan en una CAPA PROPIA
// siempre montada, para que cualquiera las vea desde lejos y pueda abrir su
// ficha. Reusa el icono + popup de crearMarcadorUrbano.
// ==========================================================================
(function () {
  'use strict';

  var _layer = null;
  var _rendered = {};   // "lat,lng" -> marcador ya pintado
  var _timer = null;

  function _quitarAc(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  // Solo las alertas publicadas por el equipo URBIS (item exacto), no un
  // reporte ciudadano cuyo texto mencione de pasada un sismo o un incendio.
  function esAlertaNacional(p) {
    if (!p) return false;
    var tipoLow = _quitarAc(p.tipo);
    if (tipoLow.indexOf('ubicacion') !== -1 || tipoLow.indexOf('comentario') !== -1 ||
        tipoLow.indexOf('relacion') !== -1 || tipoLow.indexOf('puntaje') !== -1 ||
        tipoLow.indexOf('permiso') !== -1 || tipoLow.indexOf('avatar') !== -1 ||
        tipoLow.indexOf('chat') !== -1) return false;
    var item = _quitarAc(String(p.descripcion || '').split(' | ')[0]).trim();
    return item === 'sismo' || item === 'terremoto' || item === 'incendio forestal';
  }
  window.urbisEsAlertaNacional = esAlertaNacional;

  function getMap() {
    try { if (typeof map !== 'undefined' && map && map.addLayer) return map; } catch (e) {}
    if (window.map && window.map.addLayer) return window.map;
    if (window.urbisMap && window.urbisMap.addLayer) return window.urbisMap;
    return null;
  }

  function ensureLayer(m) {
    if (!_layer) {
      try { _layer = L.layerGroup(); } catch (e) { return null; }
    }
    if (m && !m.hasLayer(_layer)) { try { m.addLayer(_layer); } catch (e) {} }
    return _layer;
  }

  function dimKeyDe(p) {
    try {
      if (typeof dimensiones === 'object' && dimensiones) {
        var ks = Object.keys(dimensiones);
        return ks.find(function (k) { return p.tipo === k; }) || ks[0];
      }
    } catch (e) {}
    return undefined;
  }

  function render() {
    var m = getMap();
    if (!m) return;
    var layer = ensureLayer(m);
    if (!layer) return;
    if (typeof window.urbisCrearMarcadorUrbano !== 'function') return;

    var data = Array.isArray(window.globalData) ? window.globalData
             : (typeof globalData !== 'undefined' && Array.isArray(globalData) ? globalData : []);

    var vistos = {};
    data.forEach(function (p) {
      if (!esAlertaNacional(p)) return;
      // Vencida (pasaron sus 14 días) o archivada: deja de dibujarse, pero
      // sigue guardada en la base para el histórico / línea de tiempo.
      try {
        if (typeof obtenerMetaTemporal === 'function') {
          var meta = obtenerMetaTemporal(p);
          if (meta.archivado) return;
          if (meta.temporal && meta.expira && meta.expira.getTime() < Date.now()) return;
        }
      } catch (e) {}
      var lat = parseFloat(String(p.lat).replace(',', '.'));
      var lng = parseFloat(String(p.lng).replace(',', '.'));
      if (isNaN(lat) || isNaN(lng)) return;
      var key = lat.toFixed(6) + ',' + lng.toFixed(6);
      vistos[key] = true;
      if (_rendered[key]) return;
      try {
        var marker = window.urbisCrearMarcadorUrbano(lat, lng, dimKeyDe(p), p);
        if (marker) { marker.addTo(layer); _rendered[key] = marker; }
      } catch (e) {}
    });

    Object.keys(_rendered).forEach(function (key) {
      if (!vistos[key]) {
        try { layer.removeLayer(_rendered[key]); } catch (e) {}
        delete _rendered[key];
      }
    });
  }
  window.urbisRenderAlertasForzado = render;

  function arrancar() {
    var m = getMap();
    if (m) {
      try { m.on('zoomend moveend', function () { setTimeout(render, 60); }); } catch (e) {}
    }
    render();
    if (!_timer) _timer = setInterval(render, 3500);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(arrancar, 800);
  } else {
    window.addEventListener('load', function () { setTimeout(arrancar, 800); });
  }
})();
