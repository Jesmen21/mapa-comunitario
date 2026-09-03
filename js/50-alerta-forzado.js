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
        tipoLow.indexOf('chat') !== -1 || tipoLow.indexOf('peticion') !== -1 ||
        tipoLow.indexOf('emprendimiento') !== -1 || tipoLow.indexOf('portafolio') !== -1 ||
        tipoLow.indexOf('logo urbis') !== -1) return false;
    var item = String(p.descripcion || '').split(' | ')[0];
    // La lista de qué cuenta como alerta nacional vive en el catálogo (js/03c).
    // Estaba escrita aquí Y en js/10, con contenidos distintos: añadir un tipo
    // en una y olvidarlo en la otra daba un marcador que se dibujaba pero se
    // perdía al alejar el mapa, que es exactamente lo que hay que evitar.
    if (typeof window.urbisEsAlertaNacionalItem === 'function') {
      return window.urbisEsAlertaNacionalItem(item);
    }
    var it = _quitarAc(item).trim();
    return it === 'sismo' || it === 'terremoto' ||
           it.replace(/\s+/g, '') === 'sismo/terremoto' ||
           it === 'incendio forestal';
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

  // ── Alertas editoriales del repo ──────────────────────────────────────────
  // Además de las que están en la hoja de cálculo, el equipo URBIS puede
  // publicar alertas editando assets/data/alertas-urbis.json. Esa vía no
  // necesita credenciales ni el formato de 56 campos, así que la puede usar
  // una rutina automática. Se convierten al mismo formato interno y se
  // deduplican por coordenada contra las de la base.
  var _editoriales = [];

  function filaDesdeEditorial(a) {
    var creado = (a.desde || '') + 'T12:00:00.000Z';
    var expira = (a.expira || '') + 'T12:00:00.000Z';
    var nota = Array.isArray(a.lineas) ? a.lineas.join(';;') : String(a.lineas || '');
    var arr = [a.tipo, a.titulo, nota, 'Bueno', 'Activo', 'N/A']
      .concat(new Array(37).fill('NO'))
      // Firmadas por la cuenta del administrador de URBIS, no por un nombre
      // suelto. Importa por algo más que el crédito: el servidor autoriza las
      // ediciones y los borrados comparando el AUTOR con quien escribe, así
      // que con "UrbisNoticia" —una cuenta que ya no se usa— estas alertas
      // quedaban sin dueño real que pudiera corregirlas.
      .concat(['N/A', 'Aprobado', 'urbisprocity', 'admin',
               '0', '', '', '', creado, expira, 'Temporal', 'Activo', 'Alerta']);
    return {
      tipo: '🌪️ Desastres Naturales y Clima',
      lat: String(a.lat), lng: String(a.lng),
      descripcion: arr.join(' | '),
      fecha: creado
    };
  }

  // Expuesta para poder comprobar la conversión desde fuera: lo que importa no
  // es que el código diga "urbisprocity", sino que ese nombre caiga en la
  // casilla exacta que el servidor mira para autorizar ediciones y borrados.
  window.urbisFilaAlertaEditorial = filaDesdeEditorial;

  function cargarEditoriales() {
    try {
      fetch('assets/data/alertas-urbis.json?v=' + Date.now())
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !Array.isArray(j.alertas)) return;
          _editoriales = j.alertas
            .filter(function (a) { return a && a.tipo && a.lat != null && a.lng != null; })
            .map(filaDesdeEditorial);
          render();
        })
        .catch(function () { /* si falla, el mapa sigue igual con las de la base */ });
    } catch (e) {}
  }

  /* En qué módulo estamos. Mismo criterio que la gota Áurea (js/47), y por la
     misma razón: estar en capa propia hacía a estas alertas inmunes al cambio
     de módulo, y se quedaban flotando encima de la matriz de usos de Pro City.
     Reportado desde el uso real: «sale un evento viejo dentro del módulo
     educativo».

     Lista BLANCA y no negra a propósito: cualquier módulo nuevo que se monte
     sobre este mismo mapa nace SIN las alertas, en vez de heredarlas hasta
     que alguien reporte el fallo. */
  function enModuloReportesYEventos() {
    var pantalla;
    try { pantalla = document.querySelector('.u52-screen[data-u52-screen="map"]'); } catch (e) { return true; }
    if (!pantalla) return true;                                              // mapa clásico, sin módulos que separar
    if (!pantalla.classList.contains('active')) return false;                // Movilidad, Nav, cualquier otra
    if (window.urbisProCityActivo) return false;                             // bandera de js/20
    if (pantalla.classList.contains('u52-procity-mapscreen')) return false;  // respaldo por clase
    return true;
  }

  // Retira la capa del mapa sin destruirla: al volver al módulo ciudadano,
  // render() la vuelve a poblar desde cero.
  function limpiarCapa(m) {
    Object.keys(_rendered).forEach(function (key) {
      try { if (_layer) _layer.removeLayer(_rendered[key]); } catch (e) {}
      delete _rendered[key];
    });
    try { if (m && _layer && m.hasLayer(_layer)) m.removeLayer(_layer); } catch (e) {}
  }

  function render() {
    var m = getMap();
    if (!m) return;
    if (!enModuloReportesYEventos()) { limpiarCapa(m); return; }
    var layer = ensureLayer(m);
    if (!layer) return;
    if (typeof window.urbisCrearMarcadorUrbano !== 'function') return;

    var data = Array.isArray(window.globalData) ? window.globalData
             : (typeof globalData !== 'undefined' && Array.isArray(globalData) ? globalData : []);
    // Dedupe EXPLÍCITO por coordenada: si una alerta editorial repite el punto
    // de una que ya está en la base, gana la de la base. No se puede dejar al
    // orden de renderizado, porque el JSON llega por red y el resultado
    // quedaría a merced de quién cargue primero.
    var claveBase = {};
    data.forEach(function (p) {
      var la = parseFloat(String(p.lat).replace(',', '.'));
      var ln = parseFloat(String(p.lng).replace(',', '.'));
      if (!isNaN(la) && !isNaN(ln)) claveBase[la.toFixed(4) + ',' + ln.toFixed(4)] = true;
    });
    data = data.concat(_editoriales.filter(function (p) {
      var la = parseFloat(p.lat), ln = parseFloat(p.lng);
      if (isNaN(la) || isNaN(ln)) return false;
      return !claveBase[la.toFixed(4) + ',' + ln.toFixed(4)];
    }));

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
      // Firma del contenido: si el texto de la alerta cambió (se editó en la
      // hoja o en el JSON editorial), hay que rehacer el marcador. Antes se
      // conservaba el viejo para siempre por estar cacheado por coordenada.
      var sig = String(p.descripcion || '').slice(0, 200);
      if (_rendered[key]) {
        if (_rendered[key].__urbisSig === sig) return;
        try { layer.removeLayer(_rendered[key]); } catch (e) {}
        delete _rendered[key];
      }
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
          marker.__urbisSig = sig;
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
    cargarEditoriales();
    render();
    if (!_timer) _timer = setInterval(render, 3500);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(arrancar, 800);
  } else {
    window.addEventListener('load', function () { setTimeout(arrancar, 800); });
  }
})();
