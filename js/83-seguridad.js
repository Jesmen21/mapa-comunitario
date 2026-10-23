/* URBIS · SEGURIDAD: LO QUE YA SE REPORTÓ CERCA (js/83)
   ─────────────────────────────────────────────────────────────────────────
   Primer peldaño del módulo Seguridad, aprobado por Daniel el 23 de octubre
   de 2026: una pantalla que LEE lo que ya existe y no escribe nada.

   · Los reportes de seguridad y los accidentes de tránsito que están
     vigentes cerca, con su antigüedad.
   · Los teléfonos 123 y 165 siempre a la vista, como enlaces de marcado.
     URBIS no es una línea de emergencia y no puede sustituirla: por eso no
     hay botón de pánico, ni avisos a nadie, ni servidor.

   Cuatro reglas, y las cuatro están acá:

   1. CERO DATOS NUEVOS. Este archivo no llama a urbisGuardarFila, ni a
      urbisDBUpdate, ni a urbisDBDelete, ni sigue el GPS. La posición se pide
      UNA vez y solo cuando la persona toca «Usar mi ubicación», y no sale del
      teléfono. Lo vigila revisar.js.

   2. QUÉ ES «DE SEGURIDAD» NO SE ESCRIBE ACÁ. Sale del catálogo de Reportes
      (js/03c): las pestañas `security` y `conflicto` enteras, y del tráfico
      solo `traffic-crash`. El módulo Reportes/Eventos es el dueño de esas
      pestañas; si agrega un tipo, esta pantalla lo cuenta sin que nadie se
      acuerde. Una copia de la lista sería la clase B del CLAUDE.md.

   3. SE LEE LO MISMO QUE MUESTRA EL MAPA: `urbisDatosVisibles()` (js/05),
      con su moderación y su vigencia. Un reporte vencido o escondido por una
      denuncia no aparece acá tampoco.

   4. «SIN MEDIR» Y CERO SON COSAS DISTINTAS. Si los reportes no se han
      leído, si la lectura falló, si no hay punto de referencia o si un
      reporte no trae fecha, se imprime SIN MEDIR con su causa. Un cero solo
      se imprime cuando se leyó y no había nada: un barrio sin reportes y un
      mapa que no cargó se ven iguales, y aquí no pueden verse iguales.

   Lo que esta pantalla NO hace: no sabe nada de reportes vencidos —el mapa
   los retira y ella también—, no reconoce reportes guardados con una
   etiqueta que el catálogo ya no tiene, y no lee la ubicación de nadie más
   que de quien la abre.                                                  */
(function () {
  'use strict';

  /* El radio y el orden son decisiones de producto pendientes de Daniel
     (herramientas/modulos/seguridad-familiar.md). Van con nombre y en un
     solo sitio, y la pantalla los declara. */
  var RADIO_M = 1000;
  var SECCIONES = [
    { id: 'security', titulo: 'Seguridad y emergencias' },
    { id: 'conflicto', titulo: 'Seguridad nacional y conflicto' },
    { id: 'vial', titulo: 'Accidentes de tránsito', solo: ['traffic-crash'] }
  ];
  var SIN_MEDIR = 'SIN MEDIR';

  var dep = {
    ahora: function () { return Date.now(); },
    secciones: function () { return window.URBIS_QUICK_REPORT_SECTIONS || null; },
    visibles: function () { return typeof window.urbisDatosVisibles === 'function' ? window.urbisDatosVisibles() : null; },
    estadoLectura: function () { return window.urbisDBEstadoLectura || null; },
    cargados: function () { return !!window.urbisPuntosCargados; },
    cargar: function () { try { if (typeof window.urbisCargarPuntos === 'function') return window.urbisCargarPuntos(); } catch (e) {} },
    duenoDe: function (tipo) { return (window.URBIS_CAMPOS && window.URBIS_CAMPOS.duenoDe) ? window.URBIS_CAMPOS.duenoDe(tipo) : null; },
    centroMapa: function () {
      try { var m = window.map; if (m && m.getCenter) { var c = m.getCenter(); return { lat: c.lat, lng: c.lng }; } } catch (e) {}
      return null;
    },
    geo: function () { return navigator.geolocation || null; },
    offsetFecha: function () {
      return (typeof BASE_OFFSET === 'number' && typeof TIMELINE_EXTRA_OFFSET === 'number') ? BASE_OFFSET + TIMELINE_EXTRA_OFFSET : null;
    }
  };
  function configurar(d) { Object.keys(d || {}).forEach(function (k) { dep[k] = d[k]; }); }

  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* De la etiqueta de un reporte a su sección, leído del catálogo. */
  function indiceDeEtiquetas() {
    var cat = dep.secciones();
    if (!Array.isArray(cat)) return null;
    var idx = {};
    SECCIONES.forEach(function (sec) {
      var s = cat.find(function (x) { return x && x.id === sec.id; });
      if (!s || !Array.isArray(s.items)) return;
      s.items.forEach(function (it) {
        if (sec.solo && sec.solo.indexOf(it[0]) === -1) return;
        idx[norm(it[2])] = { seccion: sec.id, id: it[0], icono: it[1], etiqueta: it[2] };
      });
    });
    return idx;
  }

  /* La fecha de creación, SIN inventarla. `parseFechaReporte` (js/05) cae en
     «ahora» cuando no encuentra fecha, y eso aquí publicaría «hace un
     momento» de un reporte del que no se sabe cuándo es. */
  function creadoMs(p) {
    var off = dep.offsetFecha(), d = String(p.descripcion || '').split(' | ');
    var cands = [off != null ? d[off] : '', p.fecha];
    for (var i = 0; i < cands.length; i++) {
      var v = String(cands[i] || '').trim();
      if (!v || v === 'N/A') continue;
      var m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      var t = m ? new Date(+m[3], +m[2] - 1, +m[1], 12).getTime() : Date.parse(v);
      if (isFinite(t)) return t;
    }
    return null;
  }
  function haceCuanto(ms) {
    if (ms == null) return 'antigüedad ' + SIN_MEDIR + ' · el reporte no trae fecha';
    var m = Math.max(0, Math.floor(ms / 60000));
    if (m < 1) return 'hace menos de un minuto';
    if (m < 60) return 'hace ' + m + ' min';
    var h = Math.floor(m / 60); if (h < 24) return 'hace ' + h + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
    var dd = Math.floor(h / 24); return 'hace ' + dd + (dd === 1 ? ' día' : ' días');
  }
  function distanciaM(a, b) {
    var R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  /* El punto de referencia: el que la persona dio, o el centro del mapa, y se
     dice cuál de los dos es. */
  var referencia = null;
  function puntoDeReferencia() {
    if (referencia) return referencia;
    var c = dep.centroMapa();
    return c ? { lat: c.lat, lng: c.lng, origen: 'centro del mapa' } : null;
  }

  /* El estado entero, CALCULADO. La pantalla solo lo pinta. */
  function medir() {
    var out = { radio: RADIO_M, secciones: [], referencia: puntoDeReferencia(), sinMedir: '', aviso: '' };
    var idx = indiceDeEtiquetas();
    var est = dep.estadoLectura();
    if (!idx) out.sinMedir = 'el catálogo de reportes no cargó';
    else if (!est && !dep.cargados()) out.sinMedir = 'los reportes todavía no se han leído';
    else if (est && est.ok === false && !est.desdeCache) out.sinMedir = 'no se pudieron leer los reportes';
    else if (!out.referencia) out.sinMedir = 'falta un punto de referencia: toque «Usar mi ubicación» o abra el mapa';
    if (est && est.ok === false && est.desdeCache) {
      out.aviso = 'No se pudo leer la lista nueva: esto es lo último guardado en el teléfono, de ' + haceCuanto(est.edadMs) + '.';
    }
    SECCIONES.forEach(function (sec) { out.secciones.push({ id: sec.id, titulo: sec.titulo, n: null, items: [] }); });
    if (out.sinMedir) return out;

    var visibles = dep.visibles();
    if (!Array.isArray(visibles)) { out.sinMedir = 'no se pudo leer la lista que muestra el mapa'; return out; }
    var ahora = dep.ahora(), ref = out.referencia;
    var porSec = {};
    out.secciones.forEach(function (s) { s.n = 0; porSec[s.id] = s; });
    visibles.forEach(function (p) {
      if (!p) return;
      var due = dep.duenoDe(p.tipo);
      if (due !== null && due !== 'reportes') return;
      var etiqueta = String(p.descripcion || '').split(' | ')[0];
      var hit = idx[norm(etiqueta)];
      if (!hit) return;
      var lat = parseFloat(String(p.lat).replace(',', '.')), lng = parseFloat(String(p.lng).replace(',', '.'));
      if (!isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) return;
      var dist = distanciaM(ref, { lat: lat, lng: lng });
      if (dist > RADIO_M) return;
      var c = creadoMs(p);
      var s = porSec[hit.seccion];
      s.n++;
      s.items.push({ icono: hit.icono, etiqueta: hit.etiqueta, metros: Math.round(dist), edadMs: c == null ? null : Math.max(0, ahora - c) });
    });
    out.secciones.forEach(function (s) { s.items.sort(function (a, b) { return a.metros - b.metros; }); });
    return out;
  }

  // ── La pantalla ──────────────────────────────────────────────────────
  var raiz = null, abierta = false;
  function lineas() {
    return '<div class="urb-seg-lineas" role="group" aria-label="Líneas de emergencia">' +
      '<a class="urb-seg-tel urb-seg-123" href="tel:123">📞 Llamar al 123 · Emergencias</a>' +
      '<a class="urb-seg-tel urb-seg-165" href="tel:165">🆘 165 · GAULA (secuestro y extorsión)</a>' +
      '<small>URBIS no es una línea de emergencia. Si hay una vida en riesgo, llame primero.</small>' +
      '</div>';
  }
  function pintar() {
    if (!raiz) return;
    var m = medir();
    var ref = m.referencia;
    var cab = ref
      ? 'En ' + (m.radio >= 1000 ? (m.radio / 1000) + ' km' : m.radio + ' m') + ' a la redonda del <b>' + esc(ref.origen) + '</b>'
      : 'Sin punto de referencia';
    var cuerpo = '';
    if (m.sinMedir) {
      cuerpo = '<p class="urb-seg-sinmedir"><b>' + SIN_MEDIR + '</b> · ' + esc(m.sinMedir) + '.</p>';
    }
    cuerpo += m.secciones.map(function (s) {
      var cifra = s.n == null ? SIN_MEDIR : String(s.n);
      var lista = s.n == null ? '' : (s.n === 0
        ? '<p class="urb-seg-cero">Ninguno vigente en este radio.</p>'
        : '<ul>' + s.items.map(function (it) {
            return '<li><span>' + it.icono + '</span><b>' + esc(it.etiqueta) + '</b><small>a ' + it.metros + ' m · ' + esc(haceCuanto(it.edadMs)) + '</small></li>';
          }).join('') + '</ul>');
      return '<section class="urb-seg-sec" data-seccion="' + s.id + '"><h3>' + esc(s.titulo) +
        ' <span class="urb-seg-n">' + cifra + '</span></h3>' + lista + '</section>';
    }).join('');
    raiz.innerHTML =
      '<div class="urb-seg-hoja" role="dialog" aria-modal="true" aria-label="Seguridad">' +
        '<header><b>🛡️ Seguridad</b><button type="button" class="urb-seg-cerrar" aria-label="Cerrar">×</button></header>' +
        lineas() +
        '<div class="urb-seg-ref">' + cab + ' <button type="button" class="urb-seg-gps">📍 Usar mi ubicación</button></div>' +
        (m.aviso ? '<p class="urb-seg-aviso">' + esc(m.aviso) + '</p>' : '') +
        cuerpo +
        '<p class="urb-seg-nota">Son los mismos reportes vigentes que muestra el mapa: se retiran cuando vence su vigencia. ' +
        'Los publica la comunidad y nadie los ha verificado por usted. Su ubicación no se guarda ni se comparte.</p>' +
      '</div>';
    raiz.querySelector('.urb-seg-cerrar').onclick = cerrar;
    raiz.querySelector('.urb-seg-gps').onclick = pedirUbicacion;
  }

  function pedirUbicacion() {
    var g = dep.geo();
    if (!g || !g.getCurrentPosition) { alert('Este teléfono no deja leer la ubicación.'); return; }
    g.getCurrentPosition(function (pos) {
      referencia = { lat: pos.coords.latitude, lng: pos.coords.longitude, origen: 'lugar donde está (±' + Math.round(pos.coords.accuracy || 0) + ' m)' };
      pintar();
    }, function () {
      alert('No se pudo leer la ubicación. Se sigue usando el centro del mapa, si lo hay.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  function abrir() {
    if (!raiz) {
      raiz = document.createElement('div');
      raiz.id = 'urbis-seguridad';
      document.body.appendChild(raiz);
    }
    raiz.hidden = false; abierta = true;
    if (!dep.estadoLectura() && !dep.cargados()) {
      var p = dep.cargar();
      if (p && typeof p.then === 'function') p.then(function () { if (abierta) pintar(); }, function () { if (abierta) pintar(); });
    }
    pintar();
  }
  function cerrar() { if (raiz) { raiz.hidden = true; raiz.innerHTML = ''; } abierta = false; }

  window.URBIS_SEGURIDAD = {
    abrir: abrir, cerrar: cerrar, medir: medir, configurar: configurar,
    haceCuanto: haceCuanto, creadoMs: creadoMs,
    get abierta() { return abierta; },
    RADIO_M: RADIO_M, SIN_MEDIR: SIN_MEDIR
  };
})();
