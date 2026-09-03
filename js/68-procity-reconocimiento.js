/* URBIS Pro City · RECONOCIMIENTO DEL SECTOR (fase 1: por radio)
   ─────────────────────────────────────────────────────────────────────────
   Qué hay en un sector ANTES de ir a mapearlo.

   POR QUÉ ES OTRA COSA QUE EL ANÁLISIS QUE YA EXISTE
   El módulo de empresas pregunta «¿me conviene este lote?» y responde con
   viabilidad, competencia y FODA: un juicio sobre un punto ya elegido.
   El análisis educativo (js/64) pregunta «¿qué levantó el curso?» y responde
   sobre lo que los estudiantes mapearon con sus manos.

   Esto pregunta una tercera cosa: «¿qué hay acá según OpenStreetMap, antes de
   que salgamos?». La respuesta no es un juicio, es un inventario. Y tiene dos
   mitades que valen lo mismo:

     1. Lo que hay.       Cuántos usos, de qué tipo, dónde se agrupan.
     2. Lo que NO está.   Qué sectores están vacíos en OpenStreetMap.

   La segunda mitad es la que sirve pedagógicamente. Un vacío en OSM no
   significa que no haya nada: significa que nadie lo mapeó todavía. Ahí es
   justo adonde conviene mandar a los estudiantes, porque es donde su trabajo
   agrega algo que no existía. Por eso el sector vacío no se esconde ni se
   presenta como un cero: se presenta como una tarea.

   NO DUPLICA NADA
   Los puntos los trae js/61 (Overpass, con caché y espejo). La clasificación
   la hace el servidor, igual que el módulo de empresas. Acá solo se arma la
   pregunta y se redacta la respuesta. Si mañana el motor mejora, esto mejora
   solo, sin tocarlo. */
(function () {
  'use strict';

  var RADIOS = [250, 500, 1000];
  var RADIO_POR_DEFECTO = 500;

  // Ocho rumbos, no cuatro: «andá al noreste» es una instrucción que un
  // estudiante puede seguir parado en la esquina; «andá al norte» sobre un
  // cuarto del círculo, no tanto.
  var RUMBOS = [
    { id: 'N',  nombre: 'norte',    desde: 337.5, hasta: 22.5  },
    { id: 'NE', nombre: 'noreste',  desde: 22.5,  hasta: 67.5  },
    { id: 'E',  nombre: 'oriente',  desde: 67.5,  hasta: 112.5 },
    { id: 'SE', nombre: 'sureste',  desde: 112.5, hasta: 157.5 },
    { id: 'S',  nombre: 'sur',      desde: 157.5, hasta: 202.5 },
    { id: 'SO', nombre: 'suroeste', desde: 202.5, hasta: 247.5 },
    { id: 'O',  nombre: 'occidente',desde: 247.5, hasta: 292.5 },
    { id: 'NO', nombre: 'noroeste', desde: 292.5, hasta: 337.5 }
  ];

  var S = {
    abierto: false,
    radioM: RADIO_POR_DEFECTO,
    centro: null,
    capa: null,
    cargando: false,
    resultado: null,
    error: ''
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mapa() {
    try { if (typeof map !== 'undefined' && map && typeof map.addLayer === 'function') return map; } catch (e) {}
    return null;
  }

  // ── Geometría ─────────────────────────────────────────────────────────
  function haversineM(a, b) {
    var R = 6371000, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var s = Math.pow(Math.sin(dLat / 2), 2) +
            Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.pow(Math.sin(dLng / 2), 2);
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  /* Rumbo de 0 a 360 desde el centro. Se corrige la longitud por el coseno de
     la latitud: sin eso, en Cúcuta un punto al este se reportaría más al norte
     de lo que está, y la instrucción mandaría al estudiante a la cuadra
     equivocada. */
  function rumboDe(centro, p) {
    var rad = Math.PI / 180;
    var dy = p.lat - centro.lat;
    var dx = (p.lng - centro.lng) * Math.cos(centro.lat * rad);
    var ang = Math.atan2(dx, dy) / rad;
    return (ang + 360) % 360;
  }

  function rumboDe360(g) {
    for (var i = 0; i < RUMBOS.length; i++) {
      var r = RUMBOS[i];
      if (r.desde > r.hasta) { if (g >= r.desde || g < r.hasta) return r; }
      else if (g >= r.desde && g < r.hasta) return r;
    }
    return RUMBOS[0];
  }

  /* Reparte los puntos en los ocho rumbos y devuelve los que están vacíos o
     casi. «Casi» es menos del 30 % de lo que le tocaría si todo estuviera
     repartido parejo: un sector con 2 puntos entre 300 está tan sin mapear
     como uno con 0, y decir que tiene datos sería mentir por tecnicismo. */
  function zonasSinDatos(pois, centro) {
    var cuenta = {};
    RUMBOS.forEach(function (r) { cuenta[r.id] = 0; });
    (pois || []).forEach(function (p) {
      if (p.lat == null || p.lng == null) return;
      cuenta[rumboDe360(rumboDe(centro, p)).id]++;
    });
    var total = (pois || []).length;
    var parejo = total / RUMBOS.length;
    var vacios = [], flojos = [];
    RUMBOS.forEach(function (r) {
      var n = cuenta[r.id];
      if (n === 0) vacios.push(r);
      else if (parejo > 0 && n < parejo * 0.3) flojos.push({ rumbo: r, n: n });
    });
    return { cuenta: cuenta, vacios: vacios, flojos: flojos, total: total, parejo: parejo };
  }

  // ── El círculo en el mapa ─────────────────────────────────────────────
  function capa() {
    var m = mapa();
    if (!m || typeof L === 'undefined') return null;
    if (!S.capa) S.capa = L.layerGroup().addTo(m);
    return S.capa;
  }

  function pintarCirculo() {
    var c = capa();
    if (!c || !S.centro) return;
    c.clearLayers();
    L.circle([S.centro.lat, S.centro.lng], {
      radius: S.radioM, color: '#0A6F9E', weight: 2, dashArray: '6 5',
      fillColor: '#34CCFE', fillOpacity: 0.10
    }).addTo(c);
    L.circleMarker([S.centro.lat, S.centro.lng], {
      radius: 5, color: '#075E88', weight: 2, fillColor: '#FABD0A', fillOpacity: 1
    }).addTo(c);
  }

  function borrarCirculo() {
    if (S.capa) { try { S.capa.clearLayers(); } catch (e) {} }
  }

  // ── La hoja ───────────────────────────────────────────────────────────
  function hoja() {
    var el = document.getElementById('pcr-hoja');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'pcr-hoja';
    el.className = 'pcr-hoja';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Reconocimiento del sector');
    document.body.appendChild(el);
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-pcr]');
      if (!b) return;
      var acc = b.getAttribute('data-pcr');
      if (acc === 'cerrar') { cerrar(); return; }
      if (acc === 'radio') { S.radioM = Number(b.getAttribute('data-r')) || RADIO_POR_DEFECTO;
                             S.resultado = null; S.error = ''; pintarCirculo(); pintar(); return; }
      if (acc === 'analizar') { analizar(); return; }
      if (acc === 'recentrar') { tomarCentro(); pintarCirculo(); pintar(); return; }
    });
    return el;
  }

  function tomarCentro() {
    var m = mapa();
    if (!m) return;
    var c = m.getCenter();
    S.centro = { lat: c.lat, lng: c.lng };
    S.resultado = null;
    S.error = '';
  }

  function pintar() {
    var h = hoja();
    h.innerHTML = S.resultado ? htmlFicha(S.resultado) : htmlAjustes();
    h.classList.toggle('pcr-visible', S.abierto);
  }

  function htmlAjustes() {
    var botones = RADIOS.map(function (r) {
      return '<button type="button" data-pcr="radio" data-r="' + r + '"' +
             ' class="pcr-radio' + (r === S.radioM ? ' pcr-radio-on' : '') + '"' +
             (r === S.radioM ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' +
             (r >= 1000 ? (r / 1000) + ' km' : r + ' m') + '</button>';
    }).join('');

    var donde = S.centro
      ? S.centro.lat.toFixed(5) + ', ' + S.centro.lng.toFixed(5)
      : 'sin definir';

    return '' +
      '<div class="pcr-barra">' +
        '<b>🔍 ¿Qué hay en este sector?</b>' +
        '<button type="button" data-pcr="cerrar" class="pcr-x" aria-label="Cerrar">✕</button>' +
      '</div>' +
      '<div class="pcr-cuerpo">' +
        '<p class="pcr-intro">Antes de salir a mapear, mira qué tiene registrado OpenStreetMap en la zona. ' +
        'Sirve para llegar sabiendo qué esperar —y sobre todo, para ver qué <b>todavía no está mapeado</b>.</p>' +

        '<div class="pcr-campo">' +
          '<label class="pcr-lab">Centro del sector</label>' +
          '<div class="pcr-centro">' +
            '<code>' + esc(donde) + '</code>' +
            '<button type="button" data-pcr="recentrar" class="pcr-mini">Usar el centro del mapa</button>' +
          '</div>' +
          '<small class="pcr-pista">Mueve el mapa hasta el sector y toca «Usar el centro del mapa».</small>' +
        '</div>' +

        '<div class="pcr-campo">' +
          '<label class="pcr-lab">Radio</label>' +
          '<div class="pcr-radios">' + botones + '</div>' +
        '</div>' +

        (S.error ? '<p class="pcr-error">' + esc(S.error) + '</p>' : '') +

        '<button type="button" data-pcr="analizar" class="pcr-principal"' +
          (S.cargando || !S.centro ? ' disabled' : '') + '>' +
          (S.cargando ? '⏳ Consultando…' : '🔍 Ver qué hay') +
        '</button>' +
        (S.cargando ? '<p class="pcr-pista pcr-espera">La primera consulta del día puede tardar. No cierres esta hoja.</p>' : '') +
      '</div>';
  }

  // ── La ficha ──────────────────────────────────────────────────────────
  function nombreGrupo(g) {
    var G = (window.AIA_MOTOR && window.AIA_MOTOR.GRUPOS) || {};
    var d = G[g];
    if (!d) return g;
    return d.nombre || d.n || g;
  }

  function htmlFicha(res) {
    var st = res.stats || {};
    var pois = res.pois || [];
    var zonas = zonasSinDatos(pois, S.centro);

    // Categorías con al menos un punto, de mayor a menor.
    var grupos = Object.keys(st.porGrupo || {})
      .map(function (g) { return { id: g, n: st.porGrupo[g] || 0 }; })
      .filter(function (x) { return x.n > 0 && x.id !== 'otro'; })
      .sort(function (a, b) { return b.n - a.n; });
    var mayor = grupos.length ? grupos[0].n : 1;
    var sinCategoria = (st.porGrupo && st.porGrupo.otro) || 0;

    var filas = grupos.map(function (x) {
      var pct = Math.round((x.n / mayor) * 100);
      return '<div class="pcr-fila">' +
        '<span class="pcr-fila-nom">' + esc(nombreGrupo(x.id)) + '</span>' +
        '<span class="pcr-fila-barra"><i style="width:' + pct + '%"></i></span>' +
        '<span class="pcr-fila-n">' + x.n + '</span>' +
      '</div>';
    }).join('');

    // Los usos concretos más repetidos: es lo que el estudiante va a ver
    // en la calle, más útil que la categoría general.
    var subs = Object.keys(st.porSub || {})
      .map(function (s) { return { id: s, n: st.porSub[s] || 0 }; })
      .filter(function (x) { return x.n > 0; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, 8);
    var TAX = (window.AIA_MOTOR && window.AIA_MOTOR.TAXONOMIA) || [];
    var chips = subs.map(function (x) {
      var t = TAX.filter(function (u) { return u.sub === x.id; })[0];
      return '<span class="pcr-chip">' + (t && t.icono ? t.icono + ' ' : '') +
             esc(t ? t.nombre : x.id) + ' <b>' + x.n + '</b></span>';
    }).join('');

    // El bloque que da sentido a todo esto.
    var tareas;
    if (zonas.total === 0) {
      tareas = '<p class="pcr-vacio-todo">OpenStreetMap <b>no tiene nada registrado</b> en este sector. ' +
               'No es un error: es un sector entero sin mapear. Todo lo que levanten ahí es información nueva.</p>';
    } else if (!zonas.vacios.length && !zonas.flojos.length) {
      tareas = '<p class="pcr-ok">Los ocho rumbos tienen datos. Este sector ya está bastante mapeado, ' +
               'así que el trabajo del curso será sobre todo <b>verificar y corregir</b> lo que ya está.</p>';
    } else {
      var lista = zonas.vacios.map(function (r) {
        return '<li><b>Al ' + esc(r.nombre) + '</b> — sin un solo registro</li>';
      }).concat(zonas.flojos.map(function (f) {
        return '<li><b>Al ' + esc(f.rumbo.nombre) + '</b> — apenas ' + f.n +
               ' registro' + (f.n === 1 ? '' : 's') + '</li>';
      })).join('');
      tareas = '<p class="pcr-tarea-intro">Estos rumbos están vacíos o casi. ' +
               'Un vacío en OpenStreetMap no quiere decir que no haya nada: quiere decir que ' +
               '<b>nadie lo ha mapeado</b>. Es donde el trabajo del curso agrega algo que no existía.</p>' +
               '<ul class="pcr-tareas">' + lista + '</ul>';
    }

    var dens = st.densidadPorHa != null ? Number(st.densidadPorHa).toFixed(1) : '—';
    var radioTxt = S.radioM >= 1000 ? (S.radioM / 1000) + ' km' : S.radioM + ' m';

    return '' +
      '<div class="pcr-barra">' +
        '<b>🔍 Lo que hay en el sector</b>' +
        '<button type="button" data-pcr="cerrar" class="pcr-x" aria-label="Cerrar">✕</button>' +
      '</div>' +
      '<div class="pcr-cuerpo">' +

        '<div class="pcr-kpis">' +
          '<div class="pcr-kpi"><b>' + (st.total || 0) + '</b><small>usos registrados</small></div>' +
          '<div class="pcr-kpi"><b>' + radioTxt + '</b><small>de radio</small></div>' +
          '<div class="pcr-kpi"><b>' + dens + '</b><small>por hectárea</small></div>' +
          '<div class="pcr-kpi"><b>' + (zonas.vacios.length + zonas.flojos.length) + '</b><small>rumbos sin datos</small></div>' +
        '</div>' +

        '<h4 class="pcr-h">Qué hay, por categoría</h4>' +
        (filas || '<p class="pcr-pista">Ningún uso quedó clasificado en una categoría.</p>') +
        (sinCategoria ? '<p class="pcr-pista">' + sinCategoria + ' punto' + (sinCategoria === 1 ? '' : 's') +
          ' sin categoría reconocida. Suelen ser usos poco comunes: buen material para revisar en campo.</p>' : '') +

        (chips ? '<h4 class="pcr-h">Lo más repetido</h4><div class="pcr-chips">' + chips + '</div>' : '') +

        '<h4 class="pcr-h">A dónde ir</h4>' +
        tareas +

        '<div class="pcr-nota">' +
          '<b>Esto no es el sector: es lo que OpenStreetMap sabe del sector.</b> ' +
          'Los datos los pone gente voluntaria, así que están incompletos y a veces desactualizados. ' +
          'Sirve para llegar con una idea formada, no para reemplazar la salida a campo.' +
        '</div>' +

        '<button type="button" data-pcr="cerrar" class="pcr-principal pcr-secundario">Listo</button>' +
      '</div>';
  }

  // ── El análisis ───────────────────────────────────────────────────────
  async function analizar() {
    if (S.cargando || !S.centro) return;
    if (!window.AIA_DATOS || !window.AIA_DATOS.consultarEntorno) {
      S.error = 'Falta el módulo de datos (js/61). Recarga la página.'; pintar(); return;
    }
    if (!window.AIA_MOTOR || !window.AIA_MOTOR.analizar) {
      S.error = 'Falta el motor de análisis. Recarga la página.'; pintar(); return;
    }

    S.cargando = true; S.error = ''; pintar();
    try {
      var elementos = await window.AIA_DATOS.consultarEntorno(S.centro.lat, S.centro.lng, S.radioM);

      // Un sector sin datos NO es un fallo: es el resultado más interesante
      // que puede dar esta herramienta. Se sigue adelante con la lista vacía
      // para que la ficha lo diga con todas las letras.
      var res = await window.AIA_MOTOR.analizar({
        elementos: elementos || [],
        radioM: S.radioM,
        centro: { lat: S.centro.lat, lng: S.centro.lng },
        tipoEstudio: 'completo',
        proyectoId: 'recomendar',
        dane: null,
        caminabilidad: null
      });
      S.resultado = res;
    } catch (e) {
      S.error = (e && e.message) || 'No se pudo consultar el sector.';
    }
    S.cargando = false;
    pintar();
  }

  // ── Entrada y salida ──────────────────────────────────────────────────
  function abrir() {
    if (!mapa()) { alert('El mapa aún no está listo.'); return; }
    S.abierto = true;
    S.resultado = null;
    S.error = '';
    if (!S.centro) tomarCentro();
    pintarCirculo();
    pintar();
  }

  function cerrar() {
    S.abierto = false;
    borrarCirculo();
    var h = document.getElementById('pcr-hoja');
    if (h) h.classList.remove('pcr-visible');
  }

  window.URBIS_PC_RECON = {
    abrir: abrir,
    cerrar: cerrar,
    analizar: analizar,
    abierto: function () { return S.abierto; },
    // Se exponen para poder comprobarlos sin montar la app entera: el reparto
    // por rumbos es la parte que decide a dónde se manda a un estudiante.
    zonasSinDatos: zonasSinDatos,
    rumboDe: rumboDe,
    rumboDe360: rumboDe360,
    estado: function () { return { radioM: S.radioM, centro: S.centro, hay: !!S.resultado }; }
  };
})();
