// ==========================================================================
// URBIS · Renderizador FORZADO de la gota de Juegos URBIS (Evento Premium)
// --------------------------------------------------------------------------
// La gota del evento de Juegos URBIS NO pasa por el pipeline normal de marcadores
// (pintarPuntos), que la filtra por zoom (puedeMostrarMarcadorPorZoom),
// por capa activa, o por validez temporal (datosVisiblesActuales).
// Aquí la dibujamos en una CAPA PROPIA, siempre visible para TODOS, directo
// sobre el mapa, para que cualquiera vea que el evento existe y pueda entrar
// a competir tocándola. Reusa el icono+popup premium de crearMarcadorUrbano.
// ==========================================================================
(function () {
  'use strict';

  var _layer = null;        // capa dedicada (siempre encima)
  var _rendered = {};       // key "lat,lng" -> marker ya pintado
  var _timer = null;
  var _prevCount = 0;       // cuántas gotas había en el render anterior

  function _quitarAc(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // ¿Es el evento de Juegos URBIS premium? Detección robusta (sin depender del
  // acento de "Áurea"). Se sigue reconociendo el nombre viejo a propósito: quedó
  // ESCRITO dentro de los eventos publicados antes del cambio de nombre, y este
  // detector es lo único que los hace aparecer en el mapa.
  function esEventoAurea(p) {
    if (!p) return false;
    var tipoLow = _quitarAc(p.tipo);
    // Nunca tratar como evento una fila meta (ubicacion/comentario/relacion/etc.).
    if (tipoLow.indexOf('ubicacion') !== -1 || tipoLow.indexOf('comentario') !== -1 ||
        tipoLow.indexOf('relacion') !== -1 || tipoLow.indexOf('puntaje') !== -1 ||
        tipoLow.indexOf('permiso') !== -1 || tipoLow.indexOf('avatar') !== -1 ||
        tipoLow.indexOf('chat') !== -1 || tipoLow.indexOf('peticion') !== -1 ||
        tipoLow.indexOf('emprendimiento') !== -1 || tipoLow.indexOf('portafolio') !== -1) return false;
    var d = String(p.descripcion || '').split(' | ');
    var itemLow = _quitarAc(d[0]);
    var descLow = _quitarAc(p.descripcion);
    return itemLow.indexOf('aurea') !== -1
      || itemLow.indexOf('juegos urbis') !== -1
      || itemLow.indexOf('coliseo dorado') !== -1
      || itemLow.indexOf('sol solidario') !== -1
      || (descLow.indexOf('premium') !== -1 &&
          (descLow.indexOf('evento') !== -1 || itemLow.indexOf('evento') !== -1 || tipoLow.indexOf('evento') !== -1));
  }
  window.urbisEsEventoAurea = esEventoAurea;

  // Misma extracción que hace el popup en js/10-visible-markers.js: el evento
  // guarda premio, detalle y fin dentro del campo de notas, y el id de juego se
  // deriva de la latitud para que cada gota tenga su propia tabla.
  function abrirDesdePunto(p) {
    if (typeof window.urbisAbrirAureaModulo !== 'function') return;
    var d = String(p.descripcion || '').split(' | ');
    var notas = String(d[2] || '');
    var sacar = function (re, def) { var m = notas.match(re); return m ? m[1].trim() : def; };

    var premio = sacar(/Premio:\s*([^·|]+)/i, 'Premio sorpresa');
    var fin = sacar(/termina\s*([^·|]+)/i, '');
    var terminado = false;
    try {
      var meta = (typeof obtenerMetaTemporal === 'function') ? obtenerMetaTemporal(p)
               : (typeof window.obtenerMetaTemporal === 'function' ? window.obtenerMetaTemporal(p) : null);
      if (meta) {
        terminado = !!meta.archivado;
        if (!fin && meta.expira && typeof window.formatearFechaHora === 'function') {
          fin = window.formatearFechaHora(meta.expira);
        }
      }
    } catch (e) {}

    window.urbisAbrirAureaModulo(
      'aurea_' + String(p.lat).replace(/[^0-9]/g, ''),
      String(d[1] || 'Juegos URBIS'),
      String(premio),
      String(fin || ''),
      terminado
    );
  }

  function getMap() {
    try { if (typeof map !== 'undefined' && map && map.addLayer) return map; } catch (e) {}
    if (window.map && window.map.addLayer) return window.map;
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

  // La gota de Juegos URBIS es del módulo de REPORTES Y EVENTOS y de ningún otro. El
  // mapa de fondo (#map) es UNO SOLO y lo comparten varias pantallas —
  // UrbisProCity (mapeo urbano profesional), Movilidad, Navegación, URBIS
  // Rush —, así que "estar en el mapa" no alcanza para saber en qué módulo
  // está parado el usuario: hay que mirar qué pantalla tiene el frente.
  //
  // A propósito es lista BLANCA y no lista negra: así cualquier módulo nuevo
  // que se monte sobre este mismo mapa nace SIN la gota, en vez de heredarla
  // hasta que alguien reporte el bug.
  function enModuloReportesYEventos() {
    var pantalla;
    try { pantalla = document.querySelector('.u52-screen[data-u52-screen="map"]'); } catch (e) { return true; }
    if (!pantalla) return true; // shell móvil sin montar: mapa clásico, sin módulos que separar
    if (!pantalla.classList.contains('active')) return false; // Movilidad / Nav / Rush / cualquier otra
    if (window.urbisProCityActivo) return false;              // bandera de js/20
    if (pantalla.classList.contains('u52-procity-mapscreen')) return false; // respaldo por clase
    return true;
  }

  // Borra la capa entera del mapa (sin destruirla): al volver al módulo
  // ciudadano, render() la vuelve a poblar desde cero.
  function limpiar(m) {
    Object.keys(_rendered).forEach(function (key) {
      try { if (_layer) _layer.removeLayer(_rendered[key]); } catch (e) {}
      delete _rendered[key];
    });
    try { if (m && _layer && m.hasLayer(_layer)) m.removeLayer(_layer); } catch (e) {}
    try { document.body.classList.remove('urbis-evento-aurea-activo'); } catch (e) {}
    _prevCount = 0;
  }

  function render() {
    var m = getMap();
    if (!m) return;
    // Estar en capa propia hacía a la gota inmune al cambio de módulo: se
    // quedaba flotando encima de la matriz de usos de Pro City. Fuera del
    // módulo de reportes y eventos se retira, y al volver se repinta sola
    // (js/20 avisa en cada cambio de pantalla y de modo).
    if (!enModuloReportesYEventos()) { limpiar(m); return; }
    var layer = ensureLayer(m);
    if (!layer) return;
    if (typeof window.urbisCrearMarcadorUrbano !== 'function') return;

    var data = Array.isArray(window.globalData) ? window.globalData
             : (typeof globalData !== 'undefined' && Array.isArray(globalData) ? globalData : []);

    var vistos = {};
    data.forEach(function (p) {
      if (!esEventoAurea(p)) return;
      // Evento archivado (window.urbisArchivarEventoAurea): se salta aquí para
      // que desaparezca del mapa de TODOS. Sigue guardado en la base con estado
      // "Archivado" (línea de tiempo / histórico), solo deja de dibujarse.
      try { if (typeof obtenerMetaTemporal === 'function' && obtenerMetaTemporal(p).archivado) return; } catch (e) {}
      var lat = parseFloat(String(p.lat).replace(',', '.'));
      var lng = parseFloat(String(p.lng).replace(',', '.'));
      if (isNaN(lat) || isNaN(lng)) return;
      var key = lat.toFixed(6) + ',' + lng.toFixed(6);
      vistos[key] = true;
      if (_rendered[key]) return; // ya está dibujada
      try {
        var marker = window.urbisCrearMarcadorUrbano(lat, lng, dimKeyDe(p), p);
        if (marker) {
          marker.addTo(layer);
          _rendered[key] = marker;
          // La gota de Juegos URBIS entra DIRECTO al módulo a pantalla completa. El
          // popup intermedio solo servía para mostrar un botón "entrar", y
          // encima quedaba flotando sobre la interfaz.
          try { marker.off('click'); } catch (e) {}
          marker.on('click', function (ev) {
            try {
              if (ev && ev.originalEvent) {
                window.__urbisAureaOrigen = {
                  x: ev.originalEvent.clientX,
                  y: ev.originalEvent.clientY
                };
              }
            } catch (e2) {}
            abrirDesdePunto(p);
          });
        }
      } catch (e) {}
    });

    // Quitar gotas de eventos que ya no existen (eliminados / finalizados-borrados).
    Object.keys(_rendered).forEach(function (key) {
      if (!vistos[key]) {
        try { layer.removeLayer(_rendered[key]); } catch (e) {}
        delete _rendered[key];
      }
    });
    // La campanita de Noti lleva el aura dorada SOLO mientras haya una gota premium
    // disponible en el mapa (exactamente lo que pidió el usuario).
    var nowCount = Object.keys(_rendered).length;
    try { document.body.classList.toggle('urbis-evento-aurea-activo', nowCount > 0); } catch (e) {}
    // Si apareció una gota NUEVA, refresca las notificaciones YA (no esperar el ciclo de 90s).
    if (nowCount > _prevCount && typeof window.urbisCargarNotificaciones === 'function') {
      try { window.urbisCargarNotificaciones(); } catch (e) {}
    }
    _prevCount = nowCount;
  }
  window.urbisRenderAureaForzado = render;

  // Disparadores: intervalo (la "fuerza"), eventos de mapa y arranque.
  function arrancar() {
    var m = getMap();
    if (m) {
      try {
        m.on('zoomend moveend', function () { setTimeout(render, 60); });
      } catch (e) {}
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
