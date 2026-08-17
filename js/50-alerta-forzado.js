// ==========================================================================
// URBIS · Renderizador FORZADO de las alertas nacionales (sismo / incendio)
// --------------------------------------------------------------------------
// Mismo problema que la gota Áurea: pintarPuntos mete cada marcador en la capa
// de su "dimensión" (capas[dimKey]), y esa capa se desmonta del mapa cuando su
// casilla está apagada o cuando el optimizador de zoom la retira. La alerta
// desaparecía con ella, mientras la zona de impacto (otra capa) seguía
// viéndose: de ahí que solo quedara la "mancha" y ningún icono.
//
// Estas alertas son noticia de escala nacional: se dibujan en una CAPA PROPIA
// siempre montada, para que cualquiera las vea desde lejos y pueda abrir su
// ficha. Reusa el icono de crearMarcadorUrbano.
//
// OJO: estar en capa propia NO las exime del filtro ciudadano. El render
// consulta window.urbisPasaFiltroCiudadano (js/20) para respetar los chips de
// categoría y el viaje en el tiempo, igual que cualquier otro reporte.
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

  // ── Ficha movible ─────────────────────────────────────────────────────────
  // Panel único (se reutiliza) con cabecera arrastrable, botón de cerrar y
  // cuerpo con scroll propio, para que nunca se salga de la pantalla.
  var _ficha = null;

  function construirFicha() {
    if (_ficha) return _ficha;
    var d = document.createElement('div');
    d.id = 'urbis-alerta-ficha';
    d.hidden = true;
    d.innerHTML =
      '<div class="af-head">' +
        '<span class="af-grip">⋮⋮</span>' +
        '<span class="af-badge">🚨 ALERTA NACIONAL · URBIS</span>' +
        '<button type="button" class="af-close" aria-label="Cerrar">✕</button>' +
      '</div>' +
      '<div class="af-body">' +
        '<h3 class="af-title"></h3>' +
        '<ul class="af-datos"></ul>' +
        '<div class="af-autor"></div>' +
      '</div>';
    document.body.appendChild(d);

    d.querySelector('.af-close').addEventListener('click', function (e) {
      e.stopPropagation();
      cerrarFicha();
    });

    // Arrastre con Pointer Events: sirve igual con dedo y con mouse.
    var head = d.querySelector('.af-head');
    var arrastrando = false, dx = 0, dy = 0;
    head.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.af-close')) return;
      var r = d.getBoundingClientRect();
      // Al empezar a arrastrar fijamos left/top reales y soltamos el centrado
      // por transform, si no el panel "saltaría" media pantalla al primer toque.
      d.style.transform = 'none';
      d.style.left = r.left + 'px';
      d.style.top = r.top + 'px';
      dx = ev.clientX - r.left;
      dy = ev.clientY - r.top;
      arrastrando = true;
      try { head.setPointerCapture(ev.pointerId); } catch (e) {}
      ev.preventDefault();
    });
    head.addEventListener('pointermove', function (ev) {
      if (!arrastrando) return;
      var w = d.offsetWidth, h = d.offsetHeight;
      // Se deja siempre un trozo visible para que no se pueda "perder" fuera.
      var x = Math.min(Math.max(ev.clientX - dx, 8 - w + 60), window.innerWidth - 60);
      var y = Math.min(Math.max(ev.clientY - dy, 4), window.innerHeight - 44);
      d.style.left = x + 'px';
      d.style.top = y + 'px';
    });
    function soltar(ev) {
      if (!arrastrando) return;
      arrastrando = false;
      try { head.releasePointerCapture(ev.pointerId); } catch (e) {}
    }
    head.addEventListener('pointerup', soltar);
    head.addEventListener('pointercancel', soltar);

    // Escape también cierra (escritorio).
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !d.hidden) cerrarFicha();
    });

    _ficha = d;
    return d;
  }

  function cerrarFicha() {
    if (_ficha) _ficha.hidden = true;
  }
  window.urbisCerrarFichaAlerta = cerrarFicha;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function abrirFicha(p) {
    var d = construirFicha();
    var campos = String(p.descripcion || '').split(' | ');
    var titulo = campos[1] || campos[0] || 'Alerta';
    // La nota trae los datos verificados separados por ';;' (magnitud,
    // profundidad, víctimas, hectáreas…): una línea por dato.
    var lineas = String(campos[2] || '').split(';;')
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    var autor = campos[45] || 'URBIS';

    d.querySelector('.af-title').textContent = titulo;
    d.querySelector('.af-datos').innerHTML =
      lineas.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('');
    d.querySelector('.af-autor').textContent = '👤 ' + autor;

    // Reposicionar al centro cada vez que se abre (por si quedó arrastrada
    // fuera de vista en una apertura anterior).
    d.style.left = '50%';
    d.style.top = '14vh';
    d.style.transform = 'translateX(-50%)';
    d.querySelector('.af-body').scrollTop = 0;
    d.hidden = false;
  }
  window.urbisAbrirFichaAlerta = abrirFicha;

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
      // Respetar el filtro ciudadano (chips de categoría + viaje en el tiempo).
      // Estar en capa propia sirve para que el zoom no las esconda, pero NO
      // debe volverlas inmunes al filtro: si el usuario apaga "Desastres
      // Naturales y Clima" u "Ocultar todos", tienen que desaparecer.
      try {
        if (typeof window.urbisPasaFiltroCiudadano === 'function' && !window.urbisPasaFiltroCiudadano(p)) return;
      } catch (e) {}
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
        if (marker) {
          // crearMarcadorUrbano deja su propio handler (abre el panel genérico
          // de detalles). Para las alertas lo reemplazamos por la ficha movible.
          try { marker.off('click'); } catch (e) {}
          (function (punto) {
            marker.on('click', function (ev) {
              try { L.DomEvent.stopPropagation(ev); } catch (e) {}
              abrirFicha(punto);
            });
          })(p);
          marker.addTo(layer);
          _rendered[key] = marker;
        }
      } catch (e) {}
    });

    Object.keys(_rendered).forEach(function (key) {
      if (!vistos[key]) {
        try { layer.removeLayer(_rendered[key]); } catch (e) {}
        delete _rendered[key];
      }
    });

    // Si el filtro dejó el mapa sin alertas, la ficha abierta ya no
    // corresponde a nada visible: se cierra para no dejarla huérfana.
    if (!Object.keys(_rendered).length) cerrarFicha();
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
