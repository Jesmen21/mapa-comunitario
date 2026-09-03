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
    // 'radio' o 'poligono'. El polígono no se dibuja acá: se toma prestado el
    // que el usuario ya trazó en Pro City, que es el mismo gesto que usa para
    // agrupar mapeos. Aprender dos formas de dibujar por una función sería
    // pedirle al estudiante que recuerde cuál sirve para qué.
    forma: 'radio',
    poligono: null,
    radioM: RADIO_POR_DEFECTO,
    centro: null,
    capa: null,
    cargando: false,
    resultado: null,
    error: '',
    aviso: '',
    ultimasZonas: null,
    comparacion: null,
    comparando: false,
    enMapa: false,
    // Encogida: la hoja baja a una barra y deja ver el mapa. Es el momento en
    // que uno mueve el mapa para poner el radio donde lo quiere, o dibuja el
    // área. Con la hoja entera encima no se ve dónde se está poniendo.
    encogida: false,
    // De qué área es el resultado que está en memoria, para no mostrar una
    // ficha de un sector distinto al que está elegido en el mapa.
    huellaAnalizada: '',
    // La comparación con lo que mapeó el curso, hecha sobre el área que está
    // en pantalla. Se pide a botón como el terreno o el clima: cuesta una
    // consulta y no siempre hay puntos del curso que comparar.
    campo: null, campoCargando: false, campoAviso: '',
    nombreGuardado: '',
    puntosEnMapa: 0,
    estratos: null,
    cargandoEstratos: false,
    // Mapa de calor a la carta: ids de lo que el usuario eligió teñir.
    // 'todos', 'g:<grupo>' o 's:<uso>'. Se combinan —igual que en los
    // análisis personalizados— porque la pregunta interesante casi nunca es
    // "dónde hay comercio" sino "dónde coinciden comercio y educación".
    calor: [],
    // La ficha que se guardó sola al terminar el último análisis. Ponerle
    // nombre la actualiza en vez de duplicarla.
    fichaActualId: '',
    // Qué ficha está desplegada en la pestaña «Sector», y su aviso (el de la
    // hoja no sirve: son dos pantallas distintas, cada una con lo suyo).
    pestanaAbierta: '',
    avisoPestana: '',
    // Qué capa de calor está encendida desde la pestaña, y de qué ficha.
    calorGuardado: { ficha: '', cal: '' },
    // En cuántos grupos sale el curso. Cuatro es lo típico de un curso de 30.
    grupos: 4,
    /* Cobertura del suelo leída de la foto satelital. El «verde» que sale de
       OpenStreetMap cuenta parques REGISTRADOS; esto mide el verde que de
       verdad hay, píxel a píxel. Son dos cosas distintas y el informe las
       muestra juntas a propósito: la diferencia entre las dos es, muchas
       veces, el hallazgo. */
    cobertura: null,
    cobCargando: false,
    cobAviso: '',
    // El trazado urbano, que también se pide a botón.
    trazado: null,
    trzCargando: false,
    trzAviso: '',
    // El terreno, que también se pide a botón.
    terreno: null,
    terCargando: false,
    terAviso: '',
    // Las huellas de los edificios, para poder dibujar los llenos y vacíos.
    trzHuellas: null,
    llenosEnMapa: false,
    // El clima, que también se pide a botón.
    clima: null,
    cliCargando: false,
    cliAviso: '',
    cobEnMapa: false
  };

  /* Icono lineal (js/71) o nada: la ficha no puede depender de que el
     archivo de iconos haya cargado, así que sin él sale solo el texto. */
  function ico(nombre, tam) {
    return (window.URBIS_ICONO ? window.URBIS_ICONO(nombre, { tam: tam || 18 }) : '');
  }
  /* Título de sección: icono en su cajita + texto. Un solo sitio para que
     las veintitantas cabeceras de la ficha se compongan igual. */
  /* Icono lineal para un emoji del catálogo (usos, edades, cobertura). */
  function icoCat(emoji, tam) {
    var I = window.URBIS_ICONO;
    if (!I || !I.deEmoji) return '';
    return '<i class="pcr-cat-ico">' + I.deEmoji(emoji, { tam: tam || 14 }) + '</i>';
  }
  function sinEmoji(t) {
    var I = window.URBIS_ICONO;
    return I && I.sinEmoji ? I.sinEmoji(t) : String(t || '').replace(/^\S+\s/, '');
  }
  function h4(icono, titulo) {
    return '<h4 class="pcr-h">' + (icono ? '<i class="pcr-h-ico">' + ico(icono, 16) + '</i>' : '') +
      '<span>' + titulo + '</span></h4>';
  }
  /* La barra de arriba de la hoja: eyebrow pequeño + título. El eyebrow dice
     en qué parte del producto se está («Modo educativo»); el título, qué se
     está mirando. */
  function barra(eyebrow, titulo, icono, accionCerrar) {
    return '<div class="pcr-barra">' +
      '<div class="pcr-titulo">' +
        '<span class="pcr-eyebrow">' + esc(eyebrow) + '</span>' +
        '<b>' + (icono ? ico(icono, 18) : '') + titulo + '</b>' +
      '</div>' +
      '<button type="button" data-pcr="' + (accionCerrar || 'cerrar') + '" class="pcr-x" aria-label="Cerrar">' +
        ico('cerrar', 18) + '</button>' +
    '</div>';
  }

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
    // El rumbo con más cosas, para decir hacia dónde mira el sector. Solo se
    // nombra si de verdad destaca: con el reparto parejo, señalar «el más
    // grande» sería inventar un patrón donde no lo hay.
    var lleno = null;
    RUMBOS.forEach(function (r) {
      if (!lleno || cuenta[r.id] > cuenta[lleno.id]) lleno = r;
    });
    var destaca = lleno && total > 0 && cuenta[lleno.id] > parejo * 1.6;

    return {
      cuenta: cuenta, vacios: vacios, flojos: flojos, total: total, parejo: parejo,
      concentracion: destaca ? { rumbo: lleno, n: cuenta[lleno.id],
                                pct: Math.round(cuenta[lleno.id] / total * 100) } : null
    };
  }

  // ── Fichas guardadas ──────────────────────────────────────────────────
  // Una ficha se guarda para dos cosas: llevarla a campo sin depender de la
  // red, y poder comparar después lo que decía OpenStreetMap con lo que el
  // curso encontró. Por eso se guardan los puntos y no solo los totales.
  var FICHAS_KEY = 'pcr_fichas_v1';
  var MAX_FICHAS = 12;

  function leerFichas() {
    try { var f = JSON.parse(localStorage.getItem(FICHAS_KEY) || '[]'); return Array.isArray(f) ? f : []; }
    catch (e) { return []; }
  }

  /* Lo pesado del análisis fuera. `stats` completo trae listas que no se
     vuelven a leer (cada tramo de vía, cada punto de cada anillo) y que
     llenarían el localStorage del celular en tres fichas. Se conserva lo que
     la pestaña vuelve a dibujar y nada más. */
  function statsLigero(st) {
    if (!st) return {};
    var mv = st.movilidad || null;
    return {
      total: st.total, areaHa: st.areaHa, densidadPorHa: st.densidadPorHa,
      porGrupo: st.porGrupo || {}, porSub: st.porSub || {},
      usoPredominante: st.usoPredominante || null,
      nucleos: (st.nucleos || []).slice(0, 4),
      // Hitos y alturas pesan poco (nueve hitos y cuatro filas) y son mitad
      // del análisis físico: si no se guardan, la pestaña «Sector» pierde dos
      // bloques al reabrir sin que nada avise.
      hitos: (st.hitos || []).slice(0, 9),
      alturas: st.alturas || null,
      ambiente: st.ambiente || null,
      // La cobertura de equipamientos son cuatro filas: cabe de sobra, y sin
      // ella un sector reabierto perdería el bloque entero.
      accesibilidad: st.accesibilidad || null,
      mezcla: st.mezcla || null,
      movilidad: mv ? {
        nViasArterias: mv.nViasArterias, paradasBus: mv.paradasBus,
        ciclorrutas: mv.ciclorrutas, scoreAcceso: mv.scoreAcceso,
        exposicion: mv.exposicion, nivelExposicion: mv.nivelExposicion,
        viaPrincipal: mv.viaPrincipal || null,
        viasArterias: (mv.viasArterias || []).slice(0, 4),
        // Las rutas pesan cuatro líneas y son la mitad de «cómo se llega»:
        // sin guardarlas, un sector reabierto perdía el transporte público.
        rutas: (mv.rutas || []).slice(0, 12)
      } : null,
      // Población y demografía: es la mitad del informe que no depende del
      // mapeo, así que sin ella la ficha guardada quedaría coja.
      /* Los nombres tienen que ser EXACTAMENTE los que lee el bloque de
         población: guardar `viviendas` cuando el bloque lee `viviendasCenso`
         hacía que la ficha guardada perdiera el conteo de viviendas sin que
         nada avisara. */
      poblacionEstimada: st.poblacionEstimada, poblacionCenso: st.poblacionCenso,
      poblacionProyectada: st.poblacionProyectada, poblacionEsCensal: st.poblacionEsCensal,
      censoAnio: st.censoAnio, anioProyeccion: st.anioProyeccion,
      tasaAnualDane: st.tasaAnualDane, crecimientoPct: st.crecimientoPct,
      advertenciaProyeccion: st.advertenciaProyeccion,
      serieProyeccion: st.serieProyeccion || [],
      viviendasCenso: st.viviendasCenso, personasPorVivienda: st.personasPorVivienda,
      estrato: st.estrato || null, demografia: st.demografia || null,
      /* El resumen de la cobertura sí cabe: son cuatro cifras. La rejilla y
         las imágenes no —son megas— así que un sector guardado dice cuánto
         verde tenía, pero para volver a verlo en el mapa hay que releer la
         foto. Es un intercambio consciente: el dato importa más que la
         imagen, y el dato pesa nada. */
      cobertura: S.cobertura
        ? { clases: S.cobertura.clases.map(function (c) {
              return { id: c.id, etq: c.etq, ico: c.ico, color: c.color, pct: c.pct, m2: Math.round(c.m2) };
            }),
            malla: S.cobertura.malla, mPorPx: S.cobertura.mPorPx,
            grueso: S.cobertura.grueso, pctAmbiguo: S.cobertura.pctAmbiguo }
        : null,
      // Para la lista de campo y los anillos, que también se redibujan.
      rubros: (st.rubros || []).slice(0, 14),
      anillos: (st.anillos || []).map(function (a) {
        return { etiqueta: a.etiqueta, n: a.n, comercios: a.comercios, peso: a.peso,
                 ejemplos: (a.ejemplos || []).slice(0, 3) };
      })
    };
  }

  function guardarFicha(res, zonas, nombre, id) {
    var meta = res.meta || {}, st = res.stats || {};
    var ficha = {
      id: id || ('f' + Date.now()),
      ts: new Date().toISOString(),
      nombre: nombre || '',
      // Lo que necesita la pestaña «Sector» para redibujar el informe sin
      // volver a consultar la red.
      stats: statsLigero(st),
      zonas: zonas ? {
        vacios: (zonas.vacios || []).map(function (r) { return { id: r.id, nombre: r.nombre }; }),
        flojos: (zonas.flojos || []).map(function (f) {
          return { id: f.rumbo.id, nombre: f.rumbo.nombre, n: f.n };
        }),
        total: zonas.total,
        concentracion: zonas.concentracion
          ? { nombre: zonas.concentracion.rumbo.nombre, n: zonas.concentracion.n, pct: zonas.concentracion.pct }
          : null
      } : null,
      ubicacion: res.ubicacion || null,
      // El trazado no viene del análisis sino de una medición aparte, así que
      // se toma del estado: si el estudiante lo midió, se guarda con la ficha.
      trazado: S.trazado || null,
      terreno: S.terreno || null,
      clima: S.clima || null,
      /* La comparación con el campo, en versión corta: las cuentas y unos
         pocos nombres. Guardar las cuatro listas enteras duplicaría todos los
         puntos del sector dentro de la ficha, y lo que se lee después son las
         cifras. */
      campo: S.campo ? {
        nuevos: (S.campo.nuevos || []).slice(0, 20).map(function (x) {
          return { lat: x.lat, lng: x.lng, nombre: x.nombre || '', grupo: x.grupo || 'otro' };
        }),
        // De confirmados y sin verificar solo se lee la cantidad: se guardan
        // vacíos para no duplicar cada punto del sector dentro de la ficha.
        confirmados: (S.campo.confirmados || []).map(function () { return {}; }),
        /* Se guarda con la MISMA forma que tiene viva —{campo, osm}— y no con
           una propia. Un segundo formato obliga a que cada sitio que lo lea
           sepa de cuál de los dos viene, y ese es el tipo de detalle que se
           olvida y rompe la ficha guardada meses después. */
        discrepancias: (S.campo.discrepancias || []).slice(0, 10).map(function (d) {
          return {
            campo: { nombre: (d.campo && d.campo.nombre) || '', grupo: (d.campo && d.campo.grupo) || 'otro' },
            osm: { nombre: (d.osm && d.osm.nombre) || '', grupo: (d.osm && d.osm.grupo) || 'otro' },
            distM: d.distM || 0
          };
        }),
        sinVerificar: (S.campo.sinVerificar || []).map(function () { return {}; }),
        cuando: new Date().toISOString()
      } : null,
      forma: meta.forma || 'radio',
      centro: { lat: meta.lat, lng: meta.lng },
      radioM: meta.radioM,
      areaM2: meta.areaM2 || null,
      perimetroM: meta.perimetroM || null,
      vertices: meta.vertices || 0,
      poligono: meta.poligono || null,
      total: st.total || 0,
      porGrupo: st.porGrupo || {},
      porSub: st.porSub || {},
      rumbos: zonas.cuenta,
      // Lo mínimo para comparar más adelante: dónde estaba y qué era.
      pois: (res.pois || []).map(function (p) {
        return { lat: p.lat, lng: p.lng, sub: p.sub, grupo: p.grupo, nombre: p.nombre || '' };
      })
    };
    // Volver a guardar el MISMO análisis lo reemplaza en su sitio: sin esto,
    // el guardado automático más el botón «Guardar ficha» dejaban dos copias
    // idénticas del mismo sector, una con nombre y otra sin él.
    var todas = leerFichas().filter(function (f) { return f.id !== ficha.id; });
    todas.unshift(ficha);
    while (todas.length > MAX_FICHAS) todas.pop();
    try {
      localStorage.setItem(FICHAS_KEY, JSON.stringify(todas));
      return { ok: true, n: todas.length };
    } catch (e) {
      // localStorage lleno. Se reintenta con la mitad antes de rendirse: es
      // preferible perder las fichas viejas que perder la que acaba de hacer.
      try {
        localStorage.setItem(FICHAS_KEY, JSON.stringify(todas.slice(0, Math.max(1, Math.floor(todas.length / 2)))));
        return { ok: true, n: Math.max(1, Math.floor(todas.length / 2)), recortada: true };
      } catch (e2) {
        return { ok: false, error: 'No hay espacio para guardar la ficha en este dispositivo.' };
      }
    }
  }

  function borrarFicha(id) {
    var todas = leerFichas().filter(function (f) { return f.id !== id; });
    try { localStorage.setItem(FICHAS_KEY, JSON.stringify(todas)); } catch (e) {}
  }

  // Área por exceso esférico, en m². Misma fórmula que usa Pro City, para que
  // los dos digan lo mismo del mismo trazo.
  function areaM2De(pts) {
    if (!pts || pts.length < 3) return 0;
    var R = 6378137, rad = Math.PI / 180, acc = 0;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      acc += (b.lng - a.lng) * rad * (2 + Math.sin(a.lat * rad) + Math.sin(b.lat * rad));
    }
    return Math.abs(acc * R * R / 2);
  }

  /* Centroide del ÁREA, igual que el del servidor: la media de los vértices
     se iría hacia el lado donde el trazo dejó más puntos. */
  function centroideDe(pts) {
    if (!pts || !pts.length) return null;
    if (pts.length < 3) {
      return { lat: pts.reduce(function (a, p) { return a + p.lat; }, 0) / pts.length,
               lng: pts.reduce(function (a, p) { return a + p.lng; }, 0) / pts.length };
    }
    var a2 = 0, cx = 0, cy = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q = pts[(i + 1) % pts.length];
      var cruz = p.lng * q.lat - q.lng * p.lat;
      a2 += cruz; cx += (p.lng + q.lng) * cruz; cy += (p.lat + q.lat) * cruz;
    }
    if (Math.abs(a2) < 1e-12) {
      return { lat: pts.reduce(function (a, p) { return a + p.lat; }, 0) / pts.length,
               lng: pts.reduce(function (a, p) { return a + p.lng; }, 0) / pts.length };
    }
    return { lat: cy / (3 * a2), lng: cx / (3 * a2) };
  }

  /* El DANE se consulta por punto y radio. Con un área dibujada se usa el
     radio de un círculo de la MISMA superficie: es una aproximación, y la
     ficha lo dice donde se muestra el número. */
  function radioParaDane() {
    if (S.forma !== 'poligono') return S.radioM;
    var a = areaDelPoligono();
    return a > 0 ? Math.max(50, Math.round(Math.sqrt(a / Math.PI))) : S.radioM;
  }

  function areaDelPoligono() {
    return (S.forma === 'poligono' && S.poligono) ? areaM2De(S.poligono) : 0;
  }

  // Metros cuadrados con separador de miles: una lámina de análisis rotula el
  // área en m² además de en hectáreas, porque el m² es la unidad con la que se
  // trabaja el lote y la hectárea la que se lee de un vistazo.
  function formatearM2(m2) {
    if (!m2) return '—';
    return Math.round(m2).toLocaleString('es-CO') + ' m²';
  }
  function formatearLargo(m) {
    if (!m) return '—';
    if (m >= 1000) return (m / 1000).toFixed(2).replace('.', ',') + ' km';
    return Math.round(m).toLocaleString('es-CO') + ' m';
  }

  function formatearArea(m2) {
    if (!m2) return '';
    if (m2 >= 1000000) return (m2 / 1000000).toFixed(2) + ' km²';
    return (m2 / 10000).toFixed(1) + ' ha';
  }

  function listoParaAnalizar() {
    if (S.forma === 'poligono') return !!(S.poligono && S.poligono.length >= 3);
    return !!S.centro;
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
    if (!c) return;
    c.clearLayers();
    var estilo = { color: '#0A6F9E', weight: 2, dashArray: '6 5',
                   fillColor: '#34CCFE', fillOpacity: 0.10 };

    if (S.forma === 'poligono' && S.poligono && S.poligono.length >= 3) {
      L.polygon(S.poligono.map(function (p) { return [p.lat, p.lng]; }), estilo).addTo(c);
      return;
    }
    if (!S.centro) return;
    L.circle([S.centro.lat, S.centro.lng], Object.assign({ radius: S.radioM }, estilo)).addTo(c);
    L.circleMarker([S.centro.lat, S.centro.lng], {
      radius: 5, color: '#075E88', weight: 2, fillColor: '#FABD0A', fillOpacity: 1
    }).addTo(c);
  }

  /* Pro City guarda el área que el usuario dibujó. Se lee cada vez y no se
     copia al abrir: si redibuja mientras esta hoja está abierta, lo que se
     analiza tiene que ser lo último que trazó, no lo que había antes. */
  function poligonoDeProCity() {
    try {
      var A = window.URBIS_PC_ANALISIS;
      if (!A || !A.hayArea || !A.hayArea()) return null;
      var pts = A.puntosDelArea();
      return (pts && pts.length >= 3) ? pts : null;
    } catch (e) { return null; }
  }

  function borrarCirculo() {
    if (S.capa) { try { S.capa.clearLayers(); } catch (e) {} }
  }

  // ── Fase 4: lo que decía el mapa contra lo que encontró el curso ───────
  //
  // La idea: guardar el reconocimiento ANTES de salir, y al volver comparar.
  // No es un ejercicio de puntaje, es la lección: el estudiante ve con números
  // suyos que un mapa incompleto no es un mapa falso, pero tampoco la realidad.
  //
  // Los puntos del curso pasan por el MISMO motor que los de OpenStreetMap.
  // Comparar «lo que dice OSM» con «lo que anotó el estudiante» exige que
  // ambos hablen el mismo idioma de categorías; si cada lado usara el suyo,
  // toda diferencia sería de vocabulario y ninguna de la calle.

  // Dos puntos son «el mismo sitio» si están a menos de esto. Un local tiene
  // frente de 5 a 10 m, y una coordenada tomada a pulso en el celular se va
  // fácil 15 m. Por debajo de 35 m se perderían coincidencias reales; por
  // encima, un local se emparejaría con su vecino.
  var MISMO_SITIO_M = 35;

  function puntosDelCurso() {
    try {
      if (typeof window.urbisDatosVisibles === 'function') return window.urbisDatosVisibles() || [];
      return window.URBIS_EDU_DATOS || [];
    } catch (e) { return []; }
  }

  /* Compara dos listas de puntos ya clasificados y reparte en cuatro cajas.
     Es geometría pura y no toca red ni pantalla: se exporta para poder
     comprobarla sin montar la aplicación. */
  function compararListas(osm, campo) {
    var usadoOsm = {};
    var nuevos = [], confirmados = [], discrepancias = [];

    (campo || []).forEach(function (c) {
      var mejor = null, mejorD = Infinity, mejorI = -1;
      (osm || []).forEach(function (o, i) {
        if (usadoOsm[i]) return;
        var d = haversineM({ lat: c.lat, lng: c.lng }, { lat: o.lat, lng: o.lng });
        if (d < mejorD) { mejorD = d; mejor = o; mejorI = i; }
      });
      if (!mejor || mejorD > MISMO_SITIO_M) { nuevos.push(c); return; }
      usadoOsm[mejorI] = true;
      if (mejor.grupo === c.grupo) confirmados.push({ campo: c, osm: mejor, distM: Math.round(mejorD) });
      else discrepancias.push({ campo: c, osm: mejor, distM: Math.round(mejorD) });
    });

    // Lo que OpenStreetMap tenía y el curso no tocó. NO significa que haya
    // cerrado: puede que nadie pasara por esa cuadra. Se nombra por lo que
    // es —sin verificar— y no por lo que se supone.
    var sinVerificar = (osm || []).filter(function (o, i) { return !usadoOsm[i]; });

    return { nuevos: nuevos, confirmados: confirmados,
             discrepancias: discrepancias, sinVerificar: sinVerificar };
  }

  /* Toma una ficha guardada, pide al servidor que clasifique lo que el curso
     mapeó DENTRO de esa misma área, y devuelve la comparación. */
  async function compararConCampo(ficha) {
    if (!window.URBIS_EDU || !window.URBIS_EDU.puntoAElemento) {
      throw new Error('Falta el módulo educativo (js/64). Recarga la página.');
    }
    var crudos = puntosDelCurso();
    if (!crudos.length) {
      throw new Error('El curso todavía no tiene puntos mapeados en este dispositivo.');
    }

    var elementos = [];
    crudos.forEach(function (p, i) {
      var els = window.URBIS_EDU.puntoAElemento(p, i);
      if (Array.isArray(els)) elementos = elementos.concat(els);
      else if (els) elementos.push(els);
    });

    var peticion = {
      elementos: elementos,
      tipoEstudio: 'completo', proyectoId: 'recomendar',
      dane: null, caminabilidad: null
    };
    if (ficha.forma === 'poligono' && ficha.poligono && ficha.poligono.length >= 3) {
      peticion.poligono = ficha.poligono;
    } else {
      peticion.radioM = ficha.radioM;
      peticion.centro = ficha.centro;
    }

    var res = await window.AIA_MOTOR.analizar(peticion);
    var comp = compararListas(ficha.pois || [], res.pois || []);
    comp.totalOsm = (ficha.pois || []).length;
    comp.totalCampo = (res.pois || []).length;
    comp.ficha = ficha;
    return comp;
  }

  // ── Ver los reconocimientos en el mapa ────────────────────────────────
  // Sirve para una pregunta que la lista no responde: ¿qué parte de la ciudad
  // ya revisó el curso, y qué parte no? Sobre el mapa se ve de un vistazo;
  // en una lista de fechas, no.
  var capaGuardadas = null;

  function verGuardadasEnMapa(encender) {
    var m = mapa();
    if (!m || typeof L === 'undefined') return false;
    if (capaGuardadas) { try { m.removeLayer(capaGuardadas); } catch (e) {} capaGuardadas = null; }
    if (!encender) return false;

    var fichas = leerFichas();
    if (!fichas.length) return false;
    capaGuardadas = L.layerGroup().addTo(m);
    var caja = null;

    fichas.forEach(function (f) {
      var estilo = { color: '#3a3f78', weight: 2, fillColor: '#7b83c9',
                     fillOpacity: 0.12, dashArray: '4 4' };
      var forma = (f.forma === 'poligono' && f.poligono && f.poligono.length >= 3)
        ? L.polygon(f.poligono.map(function (p) { return [p.lat, p.lng]; }), estilo)
        : (f.centro && Number.isFinite(f.centro.lat)
            ? L.circle([f.centro.lat, f.centro.lng], Object.assign({ radius: f.radioM }, estilo))
            : null);
      if (!forma) return;
      var cuando = new Date(f.ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
      forma.bindTooltip((f.nombre || cuando) + ' · ' + f.total + ' usos', { sticky: true });
      forma.addTo(capaGuardadas);
      try { caja = caja ? caja.extend(forma.getBounds()) : forma.getBounds(); } catch (e) {}
    });

    // Encuadrar en todo lo revisado: si quedan fuera de pantalla, encender la
    // capa no muestra nada y parece que el botón está roto.
    if (caja) { try { m.fitBounds(caja.pad(0.15)); } catch (e) {} }
    return true;
  }

  // ── El informe para imprimir ──────────────────────────────────────────
  /* Usa la misma ventana de impresión que el resto de URBIS, pero NO el
     informe de viabilidad: aquel responde «¿me conviene?» y este responde
     «¿qué hay?». Meter la ficha en aquella plantilla haría que un
     reconocimiento pareciera un estudio de mercado. */
  function coberturaImpresa(cob) {
    var c = cob || S.cobertura;
    if (!c || !c.clases) return '';
    var orden = c.clases.slice().sort(function (a, b) { return b.pct - a.pct; });
    return '<h2>Cobertura del suelo (foto satelital)</h2>' +
      '<div class="cob">' + orden.filter(function (x) { return x.pct > 0; }).map(function (x) {
        return '<i style="width:' + x.pct + '%;background:' + x.color + '"></i>';
      }).join('') + '</div>' +
      '<table>' + orden.filter(function (x) { return x.pct > 0; }).map(function (x) {
        return '<tr><td>' + esc(x.etq) + '</td><td class="n">' + x.pct + '%</td>' +
          '<td class="n">' + Math.round(x.m2).toLocaleString('es-CO') + ' m²</td></tr>';
      }).join('') + '</table>' +
      '<p class="pie">Medido sobre ' + esc(c.malla || '') + ' píxeles, a ' + (c.mPorPx || '?') +
      ' m por píxel.' + (c.grueso ? ' A esta escala la lectura es de masas, no de elementos sueltos.' : '') +
      (c.pctAmbiguo > 25 ? ' Un ' + c.pctAmbiguo + '% quedó en tonos cálidos no separables.' : '') + '</p>';
  }

  // Lo que explica POR QUÉ el sector es como es. Estaba en la pantalla y no
  // en el papel, que es lo que se lleva a la salida.
  function contextoImpreso(st) {
    var up = st.usoPredominante, mv = st.movilidad, am = st.ambiente;
    if (!up && !mv && !am) return '';
    var filas = [];
    if (up) {
      Object.keys(up).filter(function (k) { return up[k] > 0; })
        .sort(function (a, b) { return up[b] - up[a]; })
        .forEach(function (k) {
          filas.push('<tr><td>' + esc((NOMBRE_USO[k] || k).replace(/^\S+\s/, '')) +
            '</td><td class="n">' + up[k] + '%</td></tr>');
        });
    }
    var mvTxt = mv
      ? '<p>' + (mv.viaPrincipal
          ? 'Vía principal: <b>' + esc(mv.viaPrincipal.nombre || 'sin nombre') + '</b>' +
            (mv.viaPrincipal.distM != null ? ', a ' + mv.viaPrincipal.distM + ' m' : '') + '. '
          : 'Sin vías con nombre registradas. ') +
        (mv.nViasArterias || 0) + ' corredor' + (mv.nViasArterias === 1 ? '' : 'es') +
        ', ' + (mv.paradasBus || 0) + ' parada' + (mv.paradasBus === 1 ? '' : 's') + ' de bus, ' +
        (mv.ciclorrutas || 0) + ' tramo' + (mv.ciclorrutas === 1 ? '' : 's') + ' de ciclorruta. ' +
        'Facilidad para llegar ' + (mv.scoreAcceso || 0) + '/100 · exposición al tránsito ' +
        (mv.exposicion || 0) + '/100 (' + esc(String(mv.nivelExposicion || '—').toLowerCase()) + ').</p>'
      : '';
    var amTxt = am
      ? '<p>Verde y agua: ' + (am.parques || 0) + ' parque' + (am.parques === 1 ? '' : 's') + ', ' +
        (am.cuerposAgua || 0) + ' cuerpo' + (am.cuerposAgua === 1 ? '' : 's') + ' de agua, ' +
        (am.verdeNatural || 0) + ' mancha' + (am.verdeNatural === 1 ? '' : 's') + ' de verde. ' +
        'Presencia de verde ' + (am.scoreVerde || 0) + '/100.</p>'
      : '';
    return '<h2>Cómo funciona el sector</h2>' + mvTxt + amTxt +
      (filas.length ? '<table>' + filas.join('') + '</table>' : '');
  }

  function planImpreso(res, zonas) {
    var plan;
    try { plan = repartirTrabajo(res, zonas, S.grupos || 4); } catch (e) { return ''; }
    if (!plan || !plan.length) return '';
    return '<h2>El plan de la salida (' + plan.length + ' grupos)</h2>' +
      '<table class="plan">' + plan.map(function (a) {
        return '<tr><td class="g"><b>' + esc(a.nombre) + '</b><br><span>al ' + esc(a.rumbo.nombre) +
          (a.franja !== 'toda la franja' ? '<br>' + esc(a.franja) : '') + '</span></td>' +
          '<td>' + esc(a.encargo) + (a.pista ? '<br><em>' + esc(a.pista) + '</em>' : '') + '</td></tr>';
      }).join('') + '</table>';
  }

  function listaImpresa(st) {
    var rubros = (st.rubros || []).filter(function (r) { return r.n > 0 && (r.ejemplos || []).length; });
    if (!rubros.length) return '';
    return '<h2>La lista para verificar (con nombre)</h2><ul class="check">' +
      rubros.slice(0, 12).map(function (r) {
        return '<li><b>' + esc(r.nombre) + '</b> (' + r.n + '): ' +
          esc(r.ejemplos.join(', ')) + '</li>';
      }).join('') + '</ul>';
  }

  // Medidas del sitio, para el PDF.
  function loteImpreso(meta, esPol) {
    if (!meta || !meta.areaM2) return '';
    return '<h2>Información del ' + (esPol ? 'área' : 'sector') + '</h2><table>' +
      '<tr><td>Área</td><td class="n">' + formatearArea(meta.areaM2) + '</td></tr>' +
      '<tr><td>En metros cuadrados</td><td class="n">' + formatearM2(meta.areaM2) + '</td></tr>' +
      '<tr><td>Perímetro</td><td class="n">' + formatearLargo(meta.perimetroM) + '</td></tr>' +
      (esPol
        ? '<tr><td>Vértices del contorno</td><td class="n">' + (meta.vertices || 0) + '</td></tr>'
        : '<tr><td>Radio</td><td class="n">' + formatearLargo(meta.radioM) + '</td></tr>') +
      '</table>';
  }

  function climaImpreso(c) {
    if (!c) return '';
    var t = c.temperatura || {}, ll = c.lluvia || {}, vi = c.viento || {};
    return '<h2>El clima del sitio</h2><table>' +
      (t.media != null ? '<tr><td>Temperatura media</td><td class="n">' + String(t.media).replace('.', ',') + ' °C</td></tr>' : '') +
      (t.maxMedia != null ? '<tr><td>Máxima media</td><td class="n">' + String(t.maxMedia).replace('.', ',') + ' °C</td></tr>' : '') +
      (t.minMedia != null ? '<tr><td>Mínima media</td><td class="n">' + String(t.minMedia).replace('.', ',') + ' °C</td></tr>' : '') +
      (ll.anual != null ? '<tr><td>Lluvia al año</td><td class="n">' + ll.anual + ' mm</td></tr>' : '') +
      (ll.masLluvioso ? '<tr><td>Mes más lluvioso</td><td class="n">' + esc(ll.masLluvioso.nombre) + ' · ' + ll.masLluvioso.lluvia + ' mm</td></tr>' : '') +
      (ll.masSeco ? '<tr><td>Mes más seco</td><td class="n">' + esc(ll.masSeco.nombre) + ' · ' + ll.masSeco.lluvia + ' mm</td></tr>' : '') +
      (vi.dominante ? '<tr><td>El viento viene del</td><td class="n">' + esc(vi.dominante.rumbo) + ' (' + vi.dominante.pct + '%)</td></tr>' : '') +
      (vi.mediaKmh != null ? '<tr><td>Viento medio</td><td class="n">' + String(vi.mediaKmh).replace('.', ',') + ' km/h</td></tr>' : '') +
      '</table>' +
      '<table>' + (c.meses || []).filter(function (m) { return m.lluvia !== null; }).map(function (m) {
        return '<tr><td>' + esc(m.nombre) + '</td><td class="n">' + m.lluvia + ' mm · ' +
               (m.tMax != null ? String(m.tMax).replace('.', ',') + ' °C' : '') + '</td></tr>';
      }).join('') + '</table>' +
      '<p class="pie">' + esc(c.lectura || '') + ' ' + esc(c.advertencia || '') + '</p>';
  }

  function terrenoImpreso(t) {
    if (!t) return '';
    var e = t.elevacion || {}, p = t.pendiente || {};
    return '<h2>El terreno</h2><table>' +
      '<tr><td>Cota más baja</td><td class="n">' + e.min + ' msnm</td></tr>' +
      '<tr><td>Cota más alta</td><td class="n">' + e.max + ' msnm</td></tr>' +
      '<tr><td>Desnivel</td><td class="n">' + e.relieve + ' m</td></tr>' +
      '<tr><td>Pendiente media</td><td class="n">' + String(p.media).replace('.', ',') + '%</td></tr>' +
      '<tr><td>Pendiente máxima</td><td class="n">' + String(p.maxima).replace('.', ',') + '%</td></tr>' +
      (t.orientacion ? '<tr><td>La ladera baja hacia</td><td class="n">' + esc(t.orientacion.rumbo) + '</td></tr>' : '') +
      '</table>' +
      '<table>' + (p.clases || []).map(function (c) {
        return '<tr><td>' + esc(c.etiqueta) + '</td><td class="n">' + String(c.pct).replace('.', ',') + '%</td></tr>';
      }).join('') + '</table>' +
      '<p class="pie">' + esc(t.lectura || '') + ' Alturas de un modelo de ' + t.resolucionM +
      ' m de paso (' + esc(t.fuente || '') + '): sirve para leer el relieve, no para dar la cota de una ' +
      'esquina. La medida fina se levanta en campo.</p>';
  }

  function trazadoImpreso(t) {
    if (!t) return '';
    var ll = t.llenos || {}, vi = t.vias || {}, mo = t.morfologia || {};
    return '<h2>El trazado del sector</h2>' +
      '<div class="cob"><i style="width:' + ll.pctLleno + '%;background:#3B4A5A"></i>' +
      '<i style="width:' + ll.pctVacio + '%;background:#E6F7FE"></i></div>' +
      '<p class="pie">Lleno ' + ll.pctLleno + '% · vacío ' + ll.pctVacio + '% · ' +
      (ll.edificios || 0) + ' edificios' +
      (ll.sinGeometria ? ' (' + ll.sinGeometria + ' mapeados solo como punto, sin área)' : '') + '</p>' +
      '<table>' +
        (vi.porMalla || []).map(function (m) {
          return '<tr><td>' + esc(m.etiqueta) + '</td><td class="n">' + String(m.km).replace('.', ',') + ' km</td></tr>';
        }).join('') +
        '<tr><td>Total de vías</td><td class="n">' + String(vi.kmTotal || 0).replace('.', ',') + ' km</td></tr>' +
        '<tr><td>En un sentido</td><td class="n">' + (vi.unSentidoPct || 0) + '%</td></tr>' +
        '<tr><td>Intersecciones</td><td class="n">' + (mo.intersecciones || 0) + '</td></tr>' +
        '<tr><td>Tramo medio entre cruces</td><td class="n">' + (mo.tramoMedioM || 0) + ' m</td></tr>' +
        '<tr><td>Calles sin salida</td><td class="n">' + (mo.sinSalida || 0) + '</td></tr>' +
      '</table>' +
      '<p class="pie">' + esc(mo.lectura || '') + ' Orden de la traza: ' +
      String(mo.orden != null ? mo.orden : '—').replace('.', ',') + ' (0 = ninguna dirección manda, 1 = todas la misma).</p>';
  }

  function sintesisImpresa(res) {
    var s2 = sintesisDelSector(res);
    var lista = function (t, l) {
      if (!l.length) return '';
      return '<tr><td colspan="2"><b>' + t + '</b></td></tr>' +
        l.map(function (x) {
          return '<tr><td>' + esc(x.texto) + '</td><td class="n">' + esc(x.dato) + '</td></tr>';
        }).join('');
    };
    var cuerpo = lista('Lo que juega a favor', s2.favor) +
                 lista('Lo que juega en contra', s2.contra) +
                 lista('Lo que falta levantar en campo', s2.falta);
    if (!cuerpo) return '';
    return '<h2>Síntesis del sector</h2><table>' + cuerpo + '</table>' +
      '<p class="pie">Cada frase nace de un dato medido y solo aparece si ese dato está.</p>';
  }

  function accesibilidadImpresa(st) {
    var a = st && st.accesibilidad;
    if (!a || !(a.categorias || []).length) return '';
    var hab = Number(st.poblacionEstimada || 0);
    return '<h2>A distancia de caminar</h2><table>' +
      a.categorias.map(function (c) {
        return '<tr><td>' + esc(c.etiqueta) + ' <em>· ' + c.minutos + ' min (' + c.radioM + ' m)</em></td>' +
          '<td class="n">' + String(c.pctCubierto).replace('.', ',') + '% del área' +
          (hab > 0 && c.pctSinCubrir > 0
            ? ' · ' + Math.round(hab * c.pctSinCubrir / 100).toLocaleString('es-CO') + ' hab. lejos'
            : '') + '</td></tr>';
      }).join('') +
      '</table><p class="pie">Distancia en línea recta: caminando siempre es más. Cuenta solo lo ' +
      'que está dentro del área y lo que alguien mapeó. ' + esc(a.metodo || '') + '</p>';
  }

  function campoImpreso(c) {
    if (!c) return '';
    var nv = (c.nuevos || []).length, ds = (c.discrepancias || []).length;
    var cf = (c.confirmados || []).length, sv = (c.sinVerificar || []).length;
    return '<h2>Lo levantado en campo</h2><table>' +
      '<tr><td>Coinciden con el mapa</td><td class="n">' + cf + '</td></tr>' +
      '<tr><td>Encontrados por el curso, no estaban</td><td class="n">' + nv + '</td></tr>' +
      '<tr><td>No coinciden: hay que corregir el mapa</td><td class="n">' + ds + '</td></tr>' +
      '<tr><td>Del mapa, sin verificar en la calle</td><td class="n">' + sv + '</td></tr>' +
      '</table>' +
      (nv
        ? '<p class="pie">Lo que el curso agrega: ' +
          (c.nuevos || []).slice(0, 12).map(function (n2) {
            return esc(n2.nombre || 'sin nombre');
          }).join(' · ') + (nv > 12 ? ' y ' + (nv - 12) + ' más' : '') + '.</p>'
        : '') +
      '<p class="pie">«Sin verificar» no es «cerrado»: es que nadie pasó por ahí. Se considera el ' +
      'mismo sitio a menos de ' + MISMO_SITIO_M + ' m, comparando la categoría y no el nombre.</p>';
  }

  function perfilImpreso(t) {
    var p = t && t.perfil;
    if (!p) return '';
    var an = p.anden || {};
    return '<h2>El perfil de la calle</h2><table>' +
      (p.relacion != null
        ? '<tr><td>Altura ÷ ancho de calzada</td><td class="n">' + String(p.relacion).replace('.', ',') + '</td></tr>' +
          '<tr><td>Altura media construida</td><td class="n">' + String(p.alturaMediaM).replace('.', ',') + ' m</td></tr>' +
          '<tr><td>Ancho medio de calzada</td><td class="n">' + String(p.anchoMedioM).replace('.', ',') + ' m</td></tr>'
        : '') +
      (p.porMalla || []).map(function (m) {
        return '<tr><td>' + esc(m.etiqueta) + '</td><td class="n">' + String(m.anchoM).replace('.', ',') + ' m</td></tr>';
      }).join('') +
      '<tr><td>Vía con andén registrado</td><td class="n">' + String(an.conAndenPct).replace('.', ',') + '%</td></tr>' +
      '<tr><td>Vía sin andén</td><td class="n">' + String(an.sinAndenPct).replace('.', ',') + '%</td></tr>' +
      '<tr><td>Vía sin dato de andén</td><td class="n">' + String(an.sinDatoPct).replace('.', ',') + '%</td></tr>' +
      '</table>' +
      '<p class="pie">' + esc(p.lectura || '') + ' El ancho es el de la calzada, no de fachada a fachada. ' +
      'Hay dato de ancho en ' + p.coberturaAncho + '% de la vía y de pisos en ' + p.coberturaAltura +
      '% de los edificios.</p>';
  }

  function espacioImpreso(t, st) {
    if (!t || !t.espacio || !t.espacio.piezas) return '';
    var e = t.espacio;
    var hab = Number((st && st.poblacionEstimada) || 0);
    var porHab = hab > 0 ? Math.round(10 * e.areaM2 / hab) / 10 : null;
    return '<h2>Espacio público efectivo</h2><table>' +
      '<tr><td>Área de espacio público</td><td class="n">' + formatearM2(e.areaM2) + '</td></tr>' +
      '<tr><td>Del área del sector</td><td class="n">' + String(e.pctDelSector).replace('.', ',') + '%</td></tr>' +
      (porHab != null
        ? '<tr><td>Por habitante</td><td class="n">' + String(porHab).replace('.', ',') + ' m²</td></tr>' +
          '<tr><td>Meta del Decreto 1504 de 1998</td><td class="n">' + (e.metaM2Hab || 15) + ' m²</td></tr>'
        : '') +
      (e.porClase || []).map(function (c) {
        return '<tr><td>' + esc(c.etiqueta) + '</td><td class="n">' + formatearM2(c.areaM2) + '</td></tr>';
      }).join('') +
      '</table>' +
      '<p class="pie">Cuenta parques, plazas, zonas verdes y escenarios deportivos de uso público ' +
      'con forma mapeada. No cuenta andenes ni vías. Lo que nadie ha mapeado no aparece.</p>';
  }

  function rutasImpresas(st) {
    var rutas = (st.movilidad && st.movilidad.rutas) || [];
    if (!rutas.length) return '';
    return '<h2>Rutas de transporte público</h2><table>' +
      rutas.map(function (r) {
        return '<tr><td>' + esc(r.nombre || 'Sin nombre registrado') +
          (r.operador ? ' <em>· ' + esc(r.operador) + '</em>' : '') +
          '</td><td class="n">' + esc(r.ref || '·') + '</td></tr>';
      }).join('') +
      '</table><p class="pie">Rutas que recogen en alguna parada del área según OpenStreetMap. ' +
      'El recorrido completo no se dibuja.</p>';
  }

  function ubicacionImpresa(ubic) {
    if (!ubic) return '';
    var filas = [['País', ubic.pais], ['Departamento', ubic.departamento], ['Municipio', ubic.ciudad],
                 ['Comuna', ubic.comuna], ['Barrio', ubic.barrio]].filter(function (x) { return x[1]; });
    if (!filas.length) return '';
    return '<h2>Ubicación</h2><table>' +
      filas.map(function (x) { return '<tr><td>' + x[0] + '</td><td class="n">' + esc(x[1]) + '</td></tr>'; }).join('') +
      '</table>';
  }

  function solImpreso(meta) {
    var SOL = window.URBIS_SOLAR;
    if (!SOL || !meta || meta.lat == null || meta.lng == null) return '';
    var d, a;
    try {
      d = SOL.dia(new Date(), Number(meta.lat), Number(meta.lng));
      a = SOL.anio(Number(meta.lat), Number(meta.lng));
    } catch (e) { return ''; }
    if (!d || !d.salida) return '';
    var hora = function (x) { return x.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }); };
    var cen = (a.cenitales || []).map(function (x) {
      return x.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
    });
    return '<h2>Asoleamiento</h2><table>' +
      '<tr><td>Amanecer</td><td class="n">' + hora(d.salida) + ' · ' + d.azimutSalida + '°</td></tr>' +
      '<tr><td>Mediodía solar</td><td class="n">' + hora(d.cenit) + ' · ' + d.alturaMaxima + '°</td></tr>' +
      '<tr><td>Atardecer</td><td class="n">' + hora(d.puesta) + ' · ' + d.azimutPuesta + '°</td></tr>' +
      '<tr><td>Horas de luz</td><td class="n">' + String(d.duracionH).replace('.', ',') + ' h</td></tr>' +
      '<tr><td>Sol más alto del año</td><td class="n">' + a.solsticios.masAlto.altura + '°</td></tr>' +
      '<tr><td>Sol más bajo del año</td><td class="n">' + a.solsticios.masBajo.altura + '°</td></tr>' +
      '</table>' +
      '<p class="pie">Calculado para hoy en las coordenadas del sector. Es el sol geométrico: ' +
      'no considera montañas ni edificios vecinos. La fachada occidental es la que recibe el sol ' +
      'bajo de la tarde.' +
      (cen.length === 2 ? ' El sol pasa por el cenit dos veces al año, alrededor del ' +
        esc(cen[0]) + ' y del ' + esc(cen[1]) + '.' : '') + '</p>';
  }

  function alturasImpresas(st) {
    var a = st.alturas;
    if (!a || !a.edificios) return '';
    if (!a.conDato) {
      return '<h2>Alturas de lo construido</h2><p>' + a.edificios + ' edificio' +
        (a.edificios === 1 ? '' : 's') + ' en el área, ninguno con su número de pisos ' +
        'registrado en OpenStreetMap. Contar niveles es tarea de campo.</p>';
    }
    return '<h2>Alturas de lo construido</h2><table>' +
      a.niveles.map(function (x) {
        return '<tr><td>' + esc(x.etiqueta) + '</td><td class="n">' + x.edificios + ' · ' + x.pct + '%</td></tr>';
      }).join('') +
      '</table><p class="pie">' + a.conDato + ' de ' + a.edificios +
      ' edificios traen la altura (' + a.cobertura + '%); el más alto tiene ' + a.maximo + ' pisos.' +
      (a.cobertura < 60 ? ' Los porcentajes describen esa muestra, no el sector completo.' : '') +
      '</p>';
  }

  function hitosImpresos(st) {
    var hs = st.hitos || [];
    if (!hs.length) return '';
    return '<h2>Hitos y nodos</h2><table class="plan">' +
      hs.map(function (h) {
        return '<tr><td class="g">' + h.n + '. <span>' + esc(h.categoriaNombre) + '</span></td>' +
          '<td>' + esc(h.nombre) + ' <em>a ' + h.distM + ' m del centro' +
          (h.registrado ? ' · registrado como patrimonio o en Wikidata' : '') + '</em></td></tr>';
      }).join('') +
      '</table><p class="pie">Falta la foto de cada uno: eso se levanta en la salida.</p>';
  }

  /* ═══════════════════════════════════════════════════════════════════════
     LA LÁMINA
     600 × 900 mm en vertical, que es el formato que se pidió y el que se
     entrega en un taller. No es el informe en otro papel: es OTRA cosa. El
     informe se lee de arriba abajo y explica; la lámina se cuelga en una
     pared y se entiende de un vistazo desde dos metros. Por eso acá manda el
     plano y las cifras van en cajas, no en párrafos.

     Se arma con lo que el análisis ya sabe. Los bloques que se piden a botón
     —terreno, clima, trazado, cobertura— solo aparecen si se midieron: una
     lámina con huecos rotulados «sin datos» no la cuelga nadie.
     ═══════════════════════════════════════════════════════════════════════ */
  /* Abrir una hoja para imprimir. Es el mismo baile de siempre —usar el
     ayudante del informe si está, si no abrir una ventana y escribirle
     encima— y estaba copiado en tres sitios; acá está una vez. Avisa por
     `alFallar` en vez de tocar el estado, porque quien lo llama sabe si el
     aviso va en la ficha o en la pestaña. */
  function abrirImpresion(html, alFallar) {
    var ayuda = window.AIA_INFORME && window.AIA_INFORME.abrirVentanaImpresion;
    if (ayuda) { ayuda(html); return true; }
    var w = window.open('', '_blank');
    if (!w) {
      if (alFallar) alFallar('Permití las ventanas emergentes para poder imprimir.');
      return false;
    }
    w.document.write(html); w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 600);
    return true;
  }

  function laminaImprimible(res, opts) {
    var o = opts || {};
    var st = res.stats || {}, meta = res.meta || {};
    var ubic = res.ubicacion || o.ubicacion || null;
    var cmp = o.campo !== undefined ? o.campo : S.campo;
    var ter = o.terreno !== undefined ? o.terreno : S.terreno;
    var cli = o.clima !== undefined ? o.clima : S.clima;
    var trz = o.trazado !== undefined ? o.trazado : S.trazado;
    var huellas = o.huellas !== undefined ? o.huellas : S.trzHuellas;
    var nombre = String(o.nombre !== undefined ? o.nombre : (S.nombreGuardado || '')).trim();
    var esPol = meta.forma === 'poligono';
    var A = window.URBIS_PC_ANALISIS;
    // El catálogo de grupos y sus colores: se lee antes del plano porque el
    // plano ya los necesita para pintar cada punto.
    var CAT = window.AIA_CATALOGO || {};
    var G = CAT.GRUPOS || {}, COL = CAT.GRUPO_COLOR || {};

    /* La hoja no puede crecer: son 900 mm y punto, y todo lo que no quepa se
       recorta en silencio. Dos decisiones lo evitan.

       La primera está en el CSS: la rejilla NO reparte el papel sobrante entre
       las filas (`align-content:start`). Antes lo repartía por igual, así que
       la fila del plano recibía un regalo que no necesitaba mientras la del
       clima se quedaba corta y se comía su propia lectura.

       La segunda es esta: el plano es la única caja con alto propio, y cede
       milímetros a medida que hay más bloques medidos. Es el único elemento
       elástico de la hoja, porque es el único al que encoger no le quita
       información: el dibujo se escala dentro. */
    var extras = (ter ? 1 : 0) + (cli ? 1 : 0) + (trz ? 1 : 0) +
                 (trz && trz.espacio && trz.espacio.piezas ? 1 : 0);
    var altoDelPlano = Math.max(150, 370 - 45 * extras);

    // ── El plano: el contorno con lo que hay dentro ────────────────────
    var forma = esPol && meta.poligono && meta.poligono.length >= 3
      ? { pts: meta.poligono }
      : { centro: { lat: meta.lat, lng: meta.lng }, radioM: meta.radioM };
    var plano = (A && typeof A.miniatura === 'function')
      ? A.miniatura(forma, {
          w: 520, h: altoDelPlano, radioPunto: 2.6,
          // Una ficha guardada no guarda el color de cada punto —sería
          // repetir el mismo dato cientos de veces—, así que se vuelve a
          // sacar del catálogo por su grupo. Sin esto la lámina de un sector
          // viejo salía con el plano en gris.
          puntos: (res.pois || []).map(function (p) {
            return { lat: p.lat, lng: p.lng, color: p.color || COL[p.grupo] || null };
          }),
          huellas: huellas || null,
          // Lo que el curso encontró y no estaba: en rombo, para que se
          // distinga del resto incluso impreso en blanco y negro.
          destacados: (cmp && cmp.nuevos ? cmp.nuevos : []).map(function (n3) {
            return { lat: n3.lat, lng: n3.lng, color: COL[n3.grupo] || '#34CCFE' };
          }),
          etiqueta: 'Plano del sector analizado'
        })
      : '';

    // ── Convenciones: los colores que aparecen en el plano ─────────────
    var conv = Object.keys(st.porGrupo || {})
      .map(function (g) { return { id: g, n: st.porGrupo[g] || 0 }; })
      .filter(function (x) { return x.n > 0 && x.id !== 'otro'; })
      .sort(function (a, b) { return b.n - a.n; })
      .map(function (x) {
        var d = G[x.id] || {};
        return '<span class="cv"><i style="background:' + (COL[x.id] || '#94a3b8') + '"></i>' +
          esc(d.t || d.nombre || x.id) + ' <b>' + x.n + '</b></span>';
      }).join('');

    function caja(titulo, cuerpo, clase) {
      if (!cuerpo) return '';
      return '<section class="caja' + (clase ? ' ' + clase : '') + '">' +
        '<h2>' + esc(titulo) + '</h2>' + cuerpo + '</section>';
    }
    function fila(etq, val) {
      return val === null || val === undefined || val === ''
        ? '' : '<div class="f"><span>' + esc(etq) + '</span><b>' + val + '</b></div>';
    }
    function barras(lista, etqDe, valDe, pctDe) {
      var max = lista.reduce(function (m, x) { return Math.max(m, pctDe(x)); }, 0) || 1;
      return '<div class="barras">' + lista.map(function (x) {
        return '<div class="b"><span>' + esc(etqDe(x)) + '</span>' +
          '<i><u style="width:' + Math.round(100 * pctDe(x) / max) + '%"></u></i>' +
          '<b>' + valDe(x) + '</b></div>';
      }).join('') + '</div>';
    }

    // ── Ubicación ───────────────────────────────────────────────────────
    var cadena = ubic
      ? [ubic.pais, ubic.departamento, ubic.ciudad, ubic.comuna, ubic.barrio].filter(Boolean).join(' › ')
      : '';

    // ── Asoleamiento ────────────────────────────────────────────────────
    var SOL = window.URBIS_SOLAR, sol = null, solAnio = null;
    try {
      if (SOL && meta.lat != null) {
        sol = SOL.dia(new Date(), Number(meta.lat), Number(meta.lng));
        solAnio = SOL.anio(Number(meta.lat), Number(meta.lng));
      }
    } catch (e) { sol = null; }
    var hh = function (x) {
      return x ? x.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '—';
    };

    var hoy = new Date();
    return '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
      '<title>Lámina · ' + esc(nombre || 'Análisis urbano') + '</title><style>' +
      '@page{ size:600mm 900mm; margin:0 }' +
      '*{ box-sizing:border-box }' +
      'html,body{ width:600mm; height:900mm; margin:0; padding:0;' +
        'font-family:Inter,"Segoe UI",system-ui,sans-serif; color:#0F1F2E;' +
        '-webkit-print-color-adjust:exact; print-color-adjust:exact }' +
      '.hoja{ width:600mm; height:900mm; padding:22mm 20mm 16mm; display:flex;' +
        'flex-direction:column; gap:9mm; background:#fff }' +
      // Cabecera: el logo arriba a la izquierda, como se pidió.
      '.cab{ display:flex; align-items:flex-start; gap:8mm; border-bottom:1.2mm solid #34CCFE; padding-bottom:6mm }' +
      '.marca{ flex:0 0 auto; display:flex; flex-direction:column; gap:1mm }' +
      '.marca b{ font-size:13mm; line-height:1; letter-spacing:.06em; color:#0A6F9E; font-weight:800 }' +
      '.marca small{ font-size:2.8mm; letter-spacing:.28em; text-transform:uppercase; color:#6B7A8A; font-weight:700 }' +
      '.tit{ flex:1; min-width:0 }' +
      '.tit .ey{ font-size:3mm; letter-spacing:.24em; text-transform:uppercase; color:#0A6F9E; font-weight:800 }' +
      '.tit h1{ margin:1mm 0 2mm; font-size:11mm; line-height:1.05; letter-spacing:-.02em; font-weight:800 }' +
      '.tit .sub{ font-size:3.6mm; color:#3B4A5A; line-height:1.4 }' +
      '.tit .cad{ font-size:3.2mm; color:#6B7A8A; margin-top:1.5mm }' +
      // Rejilla de cajas
      '.rej{ display:grid; grid-template-columns:repeat(6,1fr); gap:6mm; flex:1; min-height:0;' +
        'align-content:start }' +
      '.caja{ border:.35mm solid #E3EAF0; border-radius:3mm; padding:5mm; background:#fff;' +
        'display:flex; flex-direction:column; gap:2.5mm; overflow:hidden }' +
      '.caja h2{ margin:0; font-size:3.4mm; letter-spacing:.14em; text-transform:uppercase;' +
        'color:#0A6F9E; font-weight:800 }' +
      '.g6{ grid-column:span 6 } .g4{ grid-column:span 4 } .g3{ grid-column:span 3 }' +
      '.g2{ grid-column:span 2 }' +
      '.alto3{ grid-row:span 3 }' +
      // El dibujo manda el alto de su caja y ocupa todo el ancho: así no
      // quedan bandas blancas a los lados, que es lo que pasaba cuando la
      // caja tenía alto propio y el plano se centraba dentro.
      '.plano{ background:#F3F8FB; border-radius:2mm; padding:2mm }' +
      '.plano svg{ display:block; width:100%; height:auto }' +
      '.conv{ display:flex; flex-wrap:wrap; gap:2mm 5mm; margin-top:2mm }' +
      '.cv{ font-size:3mm; color:#3B4A5A; display:inline-flex; align-items:center; gap:1.5mm }' +
      '.cv i{ width:2.6mm; height:2.6mm; border-radius:50%; display:inline-block }' +
      '.cv i.rombo{ border-radius:0; transform:rotate(45deg); background:#34CCFE;' +
        'box-shadow:0 0 0 .25mm #0F1F2E }' +
      '.cv b{ color:#0F1F2E }' +
      // Cifras grandes
      '.kpis{ display:flex; gap:5mm; flex-wrap:wrap }' +
      '.k{ flex:1 1 0; min-width:24mm }' +
      '.k b{ display:block; font-size:8mm; line-height:1; font-weight:800; letter-spacing:-.02em; color:#0A6F9E;' +
        'font-variant-numeric:tabular-nums }' +
      '.k small{ display:block; font-size:2.8mm; color:#6B7A8A; margin-top:1mm; line-height:1.25 }' +
      '.f{ display:flex; justify-content:space-between; gap:3mm; font-size:3.2mm; padding:1.2mm 0;' +
        'border-bottom:.25mm solid #EEF3F7 }' +
      '.f span{ color:#3B4A5A } .f b{ color:#0F1F2E; font-variant-numeric:tabular-nums }' +
      '.barras{ display:flex; flex-direction:column; gap:1.8mm }' +
      '.b{ display:grid; grid-template-columns:26mm 1fr 14mm; align-items:center; gap:2mm; font-size:3mm }' +
      '.b span{ color:#3B4A5A } ' +
      '.b i{ display:block; height:2.6mm; border-radius:2mm; background:#EEF3F7 }' +
      '.b u{ display:block; height:100%; border-radius:2mm; background:#0A6F9E; text-decoration:none }' +
      '.b b{ text-align:right; color:#0F1F2E; font-variant-numeric:tabular-nums }' +
      '.nota{ font-size:2.8mm; color:#6B7A8A; line-height:1.45 }' +
      '.lee{ font-size:3.2mm; color:#0F1F2E; line-height:1.45; border-left:.8mm solid #34CCFE; padding-left:3mm }' +
      '.hit{ display:grid; grid-template-columns:6mm 1fr auto; gap:2mm; align-items:baseline; font-size:3mm;' +
        'padding:1mm 0; border-bottom:.25mm solid #EEF3F7 }' +
      '.perf{ display:grid; grid-template-columns:1fr; gap:3mm; align-items:start }' +
      '.perf-dib{ background:#F3F8FB; border-radius:2mm; padding:3mm }' +
      '.pcr-seccion svg{ display:block; width:100%; height:auto }' +
      '.pcr-sec-edif{ fill:#3B4A5A }' +
      '.pcr-sec-suelo{ stroke:#5A6878; stroke-width:1.4; fill:none }' +
      '.pcr-sec-alt{ stroke:#0A6F9E; stroke-width:1.4; fill:none }' +
      '.pcr-sec-cota{ stroke:#5A6878; stroke-width:1; fill:none }' +
      '.pcr-sec-t{ fill:#3B4A5A; font-size:9px; font-weight:700 }' +
      '.sint{ display:grid; grid-template-columns:repeat(3,1fr); gap:7mm }' +
      '.sn h3{ margin:0 0 2.5mm; font-size:3mm; letter-spacing:.14em; text-transform:uppercase;' +
        'font-weight:800; color:#6B7A8A }' +
      '.sn.ok h3{ color:#177245 } .sn.no h3{ color:#B3282C } .sn.tarea h3{ color:#0A6F9E }' +
      '.sx{ border-left:.8mm solid #E3EAF0; padding:.5mm 0 1.5mm 3mm; margin-bottom:2.5mm }' +
      '.sn.ok .sx{ border-left-color:#22c55e } .sn.no .sx{ border-left-color:#E5484D }' +
      '.sn.tarea .sx{ border-left-color:#34CCFE }' +
      '.sx span{ display:block; font-size:3.1mm; line-height:1.35; color:#0F1F2E }' +
      '.sx small{ display:block; font-size:2.7mm; color:#6B7A8A; margin-top:.8mm;' +
        'font-variant-numeric:tabular-nums }' +
      '.camina{ display:grid; grid-template-columns:repeat(2,1fr); gap:4mm 6mm }' +
      '.cm b{ display:block; font-size:9mm; line-height:1; font-weight:800; letter-spacing:-.02em;' +
        'color:#0A6F9E; font-variant-numeric:tabular-nums }' +
      '.cm span{ display:block; font-size:3.2mm; color:#0F1F2E; margin:1.5mm 0 2mm; font-weight:700 }' +
      '.cm i{ display:block; height:2.6mm; border-radius:2mm; background:#EEF3F7 }' +
      '.cm u{ display:block; height:100%; border-radius:2mm; background:#34CCFE; text-decoration:none }' +
      '.cm small{ display:block; font-size:2.7mm; color:#6B7A8A; margin-top:1.5mm; line-height:1.35 }' +
      '.hit i{ font-style:normal; font-weight:800; color:#0A6F9E }' +
      '.hit u{ text-decoration:none; color:#6B7A8A }' +
      // Los dibujos que vienen de la ficha
      '.pcr-clima-lluvia{ fill:#34CCFE; fill-opacity:.55 }' +
      '.pcr-clima-temp{ fill:none; stroke:#E5484D; stroke-width:1.8; stroke-linejoin:round }' +
      '.pcr-clima-mes,.pcr-clima-eje{ fill:#6B7A8A; font-size:8px; font-weight:700 }' +
      '.pcr-clima-graf svg{ display:block; width:100%; height:auto; max-height:34mm }' +
      '.pcr-clima-graf .pcr-pista{ font-size:2.8mm; color:#6B7A8A; line-height:1.4; margin:2mm 0 0 }' +
      '.pcr-perfil{ margin:0 0 2mm }' +
      '.pcr-perfil svg{ display:block; width:100%; height:auto; max-height:20mm }' +
      '.pcr-perfil .pcr-lab{ font-size:2.6mm; letter-spacing:.1em; text-transform:uppercase; color:#6B7A8A; font-weight:700 }' +
      '.pcr-perfil-area{ fill:#E6F7FE } ' +
      '.pcr-perfil-linea{ fill:none; stroke:#0A6F9E; stroke-width:1.6 }' +
      '.pcr-perfil-dentro{ stroke:#34CCFE; stroke-width:3; stroke-linecap:round }' +
      '.pcr-perfil-n{ fill:#6B7A8A; font-size:8px; font-weight:600 }' +
      '.pcr-rosa{ width:34mm; height:34mm }' +
      '.pcr-rosa-borde,.pcr-rosa-eje{ fill:none; stroke:#E3EAF0; stroke-width:1 }' +
      '.pcr-rosa-petalos path{ fill:#34CCFE; fill-opacity:.55; stroke:#0A6F9E; stroke-width:.5 }' +
      '.pcr-rosa-n{ fill:#6B7A8A; font-size:9px; font-weight:700; text-anchor:middle }' +
      '.pie{ display:flex; justify-content:space-between; align-items:flex-end; gap:6mm;' +
        'border-top:.35mm solid #E3EAF0; padding-top:4mm; font-size:2.8mm; color:#6B7A8A }' +
      '</style></head><body><div class="hoja">' +

      '<header class="cab">' +
        '<div class="marca"><b>URBIS</b><small>Pro City</small></div>' +
        '<div class="tit">' +
          '<div class="ey">Análisis urbano · reconocimiento del sector</div>' +
          '<h1>' + esc(nombre || (ubic && ubic.barrio) || 'Sector analizado') + '</h1>' +
          '<div class="sub">' +
            (esPol ? 'Área dibujada de ' + esc(formatearArea(meta.areaM2) || '') : 'Radio de ' + meta.radioM + ' m') +
            (meta.perimetroM ? ' · perímetro ' + esc(formatearLargo(meta.perimetroM)) : '') +
            ' · ' + (st.total || 0) + ' usos registrados' +
          '</div>' +
          (cadena ? '<div class="cad">' + esc(cadena) + '</div>' : '') +
        '</div>' +
      '</header>' +

      '<div class="rej">' +

        caja('Plano del sector', (plano ? '<div class="plano">' + plano + '</div>' : '') +
          (conv
            ? '<div class="conv">' + conv +
              (cmp && (cmp.nuevos || []).length
                ? '<span class="cv"><i class="rombo"></i>Encontrado por el curso <b>' +
                  cmp.nuevos.length + '</b></span>'
                : '') +
              '</div>'
            : '') +
          (huellas && huellas.length
            ? '<p class="nota">Las manchas oscuras son las huellas de los edificios registrados; ' +
              'los puntos, los usos mapeados, con el color de su categoría.</p>'
            : '<p class="nota">Los puntos son los usos mapeados, con el color de su categoría.</p>'),
          'g4 alto3') +

        caja('El sitio',
          '<div class="kpis">' +
            '<div class="k"><b>' + (st.total || 0) + '</b><small>usos registrados</small></div>' +
            '<div class="k"><b>' + (st.densidadPorHa != null ? Number(st.densidadPorHa).toFixed(1) : '—') +
              '</b><small>por hectárea</small></div>' +
          '</div>' +
          fila('Área', esc(formatearArea(meta.areaM2) || '—')) +
          fila('En metros cuadrados', esc(formatearM2(meta.areaM2))) +
          fila('Perímetro', esc(formatearLargo(meta.perimetroM))) +
          (esPol ? fila('Vértices', meta.vertices || 0) : fila('Radio', esc(formatearLargo(meta.radioM)))) +
          (st.poblacionEstimada ? fila('Población', Number(st.poblacionEstimada).toLocaleString('es-CO')) : '') +
          (st.viviendasCenso ? fila('Viviendas', Number(st.viviendasCenso).toLocaleString('es-CO')) : '') +
          (st.estrato && st.estrato.predominante
            ? fila('Estrato predominante', esc(String(st.estrato.predominante))) : ''),
          'g2') +

        caja('Qué hay, por categoría',
          (function () {
            var filas = Object.keys(st.porGrupo || {})
              .map(function (g) { return { id: g, n: st.porGrupo[g] || 0 }; })
              .filter(function (x) { return x.n > 0 && x.id !== 'otro'; })
              .sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
            if (!filas.length) return '';
            var m = st.mezcla;
            return barras(filas, function (x) { return sinEmoji(nombreGrupo(x.id)); },
                          function (x) { return x.n; }, function (x) { return x.n; }) +
              // El índice de mezcla cierra la caja: es la cifra que resume
              // este reparto en una sola palabra defendible.
              (m && m.usos
                ? fila('Mezcla de usos', String(m.indice).replace('.', ',') + ' · ' + esc(m.nivel)) +
                  '<p class="nota">0 = un solo uso manda · 1 = los siete repartidos por igual. ' +
                  'Se mide sobre lo mapeado, y en OpenStreetMap la vivienda está peor registrada ' +
                  'que el comercio.</p>'
                : '');
          })(), 'g3') +

        caja('Hitos y nodos',
          (function () {
            var hs = st.hitos || [];
            if (!hs.length) return '';
            return hs.map(function (h) {
              return '<div class="hit"><i>' + h.n + '</i><span>' + esc(h.nombre) +
                '</span><u>' + esc(h.categoriaNombre) + ' · ' + h.distM + ' m</u></div>';
            }).join('');
          })(), 'g2') +

        caja('Alturas de lo construido',
          (function () {
            var a = (trz && trz.alturas && trz.alturas.conDato) ? trz.alturas : st.alturas;
            if (!a || !a.conDato) return '';
            return barras(a.niveles, function (x) { return x.etiqueta; },
                          function (x) { return x.pct + '%'; }, function (x) { return x.pct; }) +
              '<p class="nota">' + a.conDato + ' de ' + a.edificios + ' edificios traen la altura ' +
              'registrada (' + a.cobertura + '%). El más alto: ' + a.maximo + ' pisos.</p>';
          })(), 'g3') +

        caja('Llenos y vacíos',
          (function () {
            if (!trz || !trz.llenos) return '';
            var ll = trz.llenos, vi = trz.vias || {}, mo = trz.morfologia || {};
            return '<div class="kpis">' +
                '<div class="k"><b>' + ll.pctLleno + '%</b><small>construido</small></div>' +
                '<div class="k"><b>' + ll.pctVacio + '%</b><small>libre</small></div>' +
                '<div class="k"><b>' + (mo.intersecciones || 0) + '</b><small>intersecciones</small></div>' +
              '</div>' +
              fila('Área construida', esc(formatearM2(ll.areaConstruidaM2))) +
              fila('Vías', String(vi.kmTotal || 0).replace('.', ',') + ' km') +
              fila('Tramo medio entre cruces', (mo.tramoMedioM || 0) + ' m') +
              (mo.lectura ? '<p class="lee">' + esc(mo.lectura) + '</p>' : '');
          })(), 'g3') +

        caja('El terreno',
          (function () {
            if (!ter) return '';
            var e = ter.elevacion || {}, p = ter.pendiente || {};
            return '<div class="kpis">' +
                '<div class="k"><b>' + e.min + '</b><small>msnm, lo más bajo</small></div>' +
                '<div class="k"><b>' + e.max + '</b><small>msnm, lo más alto</small></div>' +
                '<div class="k"><b>' + e.relieve + '</b><small>m de desnivel</small></div>' +
              '</div>' +
              fila('Pendiente media', String(p.media).replace('.', ',') + '%') +
              (ter.orientacion ? fila('La ladera baja hacia', esc(ter.orientacion.rumbo)) : '') +
              (ter.perfiles || []).map(perfilDibujado).join('') +
              (ter.lectura ? '<p class="lee">' + esc(ter.lectura) + '</p>' : '');
          })(), 'g3') +

        caja('El clima',
          (function () {
            if (!cli) return '';
            var t = cli.temperatura || {}, ll = cli.lluvia || {}, vi = cli.viento || {};
            return '<div class="kpis">' +
                '<div class="k"><b>' + (t.media != null ? String(t.media).replace('.', ',') + '°' : '—') +
                  '</b><small>media</small></div>' +
                '<div class="k"><b>' + (ll.anual != null ? ll.anual : '—') + '</b><small>mm al año</small></div>' +
              '</div>' +
              climograma(cli.meses) +
              (vi.dominante ? fila('El viento viene del', esc(vi.dominante.rumbo) + ' (' + vi.dominante.pct + '%)') : '') +
              (cli.lectura ? '<p class="lee">' + esc(cli.lectura) + '</p>' : '');
          })(), 'g3') +

        caja('Asoleamiento',
          (function () {
            if (!sol || !sol.salida) return '';
            var cen = ((solAnio && solAnio.cenitales) || []).map(function (x) {
              return x.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
            });
            return '<div class="kpis">' +
                '<div class="k"><b>' + hh(sol.salida) + '</b><small>amanecer</small></div>' +
                '<div class="k"><b>' + hh(sol.puesta) + '</b><small>atardecer</small></div>' +
                '<div class="k"><b>' + sol.alturaMaxima + '°</b><small>al mediodía</small></div>' +
              '</div>' +
              fila('Sale por el', esc(SOL.rumbo(sol.azimutSalida)) + ' · ' + sol.azimutSalida + '°') +
              fila('Se pone por el', esc(SOL.rumbo(sol.azimutPuesta)) + ' · ' + sol.azimutPuesta + '°') +
              fila('Horas de luz', String(sol.duracionH).replace('.', ',') + ' h') +
              (solAnio ? fila('En el año', solAnio.solsticios.masBajo.altura + '° a ' +
                              solAnio.solsticios.masAlto.altura + '°') : '') +
              '<p class="lee">La fachada occidental recibe el sol bajo de la tarde: es la que hay que proteger.' +
              (cen.length === 2 ? ' El sol pasa por el cenit el ' + esc(cen[0]) + ' y el ' + esc(cen[1]) + '.' : '') +
              '</p>';
          })(), 'g3') +

        caja('Espacio público efectivo',
          (function () {
            var e = trz && trz.espacio;
            if (!e || !e.piezas) return '';
            var hab = Number(st.poblacionEstimada || 0);
            var porHab = hab > 0 ? Math.round(10 * e.areaM2 / hab) / 10 : null;
            var meta = e.metaM2Hab || 15;
            return '<div class="kpis">' +
                '<div class="k"><b>' + String(e.areaHa).replace('.', ',') + '</b><small>hectáreas</small></div>' +
                '<div class="k"><b>' + String(e.pctDelSector).replace('.', ',') + '%</b><small>del sector</small></div>' +
                '<div class="k"><b>' + (porHab != null ? String(porHab).replace('.', ',') : '—') +
                  '</b><small>m² por habitante</small></div>' +
              '</div>' +
              (e.porClase || []).map(function (c) {
                return fila(c.etiqueta, formatearM2(c.areaM2));
              }).join('') +
              (porHab != null
                ? '<p class="lee">La meta nacional son ' + meta + ' m² por habitante (Decreto 1504 ' +
                  'de 1998). Acá ' + (porHab >= meta ? 'se cumple' : 'falta' + ' ' +
                  String(Math.round(10 * (meta - porHab)) / 10).replace('.', ',') + ' m² por habitante') + '.</p>'
                : '') +
              '<p class="nota">Parques, plazas, zonas verdes y escenarios deportivos de uso público ' +
              'con forma mapeada. No entran andenes ni vías.</p>';
          })(), 'g3') +

        caja('El perfil de la calle',
          (function () {
            var pf = trz && trz.perfil;
            if (!pf) return '';
            var an = pf.anden || {};
            if (pf.relacion == null) {
              return '<p class="lee">' + esc(pf.lectura || '') + '</p>';
            }
            return '<div class="perf">' +
                '<div class="perf-dib">' + seccionDibujada(pf) + '</div>' +
                '<div class="perf-datos">' +
                  '<div class="kpis">' +
                    '<div class="k"><b>' + String(pf.relacion).replace('.', ',') + '</b><small>altura ÷ ancho de calzada</small></div>' +
                    '<div class="k"><b>' + String(pf.alturaMediaM).replace('.', ',') + '</b><small>m construidos</small></div>' +
                    '<div class="k"><b>' + String(pf.anchoMedioM).replace('.', ',') + '</b><small>m de calzada</small></div>' +
                  '</div>' +
                  (pf.porMalla || []).map(function (m) {
                    return fila(m.etiqueta, String(m.anchoM).replace('.', ',') + ' m');
                  }).join('') +
                  fila('Vía con andén registrado', String(an.conAndenPct).replace('.', ',') + '%') +
                  fila('Sin dato de andén', String(an.sinDatoPct).replace('.', ',') + '%') +
                  '<p class="lee">' + esc(pf.lectura || '') + '</p>' +
                '</div>' +
              '</div>' +
              '<p class="nota">Sección tipo, armada con los promedios del sector: no es la de una ' +
              'calle concreta. El ancho es el de la calzada, no de fachada a fachada. Hay dato de ' +
              'ancho en ' + pf.coberturaAncho + '% de la vía y de pisos en ' + pf.coberturaAltura +
              '% de los edificios.</p>';
          })(), 'g3') +

        caja('A distancia de caminar',
          (function () {
            var a = st.accesibilidad;
            if (!a || !(a.categorias || []).length) return '';
            var hab = Number(st.poblacionEstimada || 0);
            return '<div class="camina">' +
                a.categorias.map(function (c) {
                  return '<div class="cm">' +
                    '<b>' + String(c.pctCubierto).replace('.', ',') + '%</b>' +
                    '<span>' + esc(c.etiqueta) + '</span>' +
                    '<i><u style="width:' + c.pctCubierto + '%"></u></i>' +
                    '<small>a ' + c.minutos + ' min a pie · ' + c.radioM + ' m' +
                      (hab > 0 && c.pctSinCubrir > 0
                        ? ' · ' + Math.round(hab * c.pctSinCubrir / 100).toLocaleString('es-CO') + ' hab. lejos'
                        : '') + '</small>' +
                  '</div>';
                }).join('') +
              '</div>' +
              '<p class="nota">Qué parte del área tiene cada cosa cerca, no cuántas hay. Distancia ' +
              'en línea recta: caminando siempre es más. Cuenta solo lo que está dentro del área y ' +
              'lo que alguien mapeó. ' + esc(a.metodo || '') + '</p>';
          })(), 'g3') +

        caja('Lo levantado en campo',
          (function () {
            if (!cmp) return '';
            var nv = (cmp.nuevos || []).length, ds = (cmp.discrepancias || []).length;
            var cf = (cmp.confirmados || []).length, sv = (cmp.sinVerificar || []).length;
            return '<div class="kpis">' +
                '<div class="k"><b>' + cf + '</b><small>coinciden</small></div>' +
                '<div class="k"><b>' + nv + '</b><small>los encontró el curso</small></div>' +
                '<div class="k"><b>' + ds + '</b><small>no coinciden</small></div>' +
              '</div>' +
              fila('Del mapa, sin verificar en la calle', sv) +
              (nv
                ? '<p class="lee">Lo que el curso le devuelve al mapa: ' +
                  esc((cmp.nuevos || []).slice(0, 6).map(function (n6) {
                    return n6.nombre || 'sin nombre';
                  }).join(' · ')) + (nv > 6 ? ' y ' + (nv - 6) + ' más' : '') + '.</p>'
                : '') +
              '<p class="nota">«Sin verificar» no es «cerrado»: es que nadie pasó por ahí. Mismo ' +
              'sitio a menos de ' + MISMO_SITIO_M + ' m, comparando la categoría y no el nombre.</p>';
          })(), 'g3') +

        caja('Síntesis del sector',
          (function () {
            var sn = sintesisDelSector(res);
            if (!sn.favor.length && !sn.contra.length && !sn.falta.length) return '';
            /* Cuatro por columna. En pantalla la lista puede ser larga; en una
               lámina, una columna de doce viñetas no la lee nadie de pie a dos
               metros. Se quedan las cuatro primeras, que son las que salieron
               de los datos más gruesos. */
            var col = function (titulo, lista, clase) {
              return '<div class="sn ' + clase + '"><h3>' + esc(titulo) + '</h3>' +
                (lista.length
                  ? lista.slice(0, 4).map(function (x) {
                      return '<div class="sx"><span>' + esc(x.texto) + '</span>' +
                        '<small>' + esc(x.dato) + '</small></div>';
                    }).join('')
                  : '<div class="sx"><span>—</span></div>') +
                '</div>';
            };
            return '<div class="sint">' +
                col('A favor', sn.favor, 'ok') +
                col('En contra', sn.contra, 'no') +
                col('Falta levantar', sn.falta, 'tarea') +
              '</div>';
          })(), 'g6') +

      '</div>' +

      '<footer class="pie">' +
        '<div>URBIS · urbispro.city · Generada el ' + esc(hoy.toLocaleDateString('es-CO')) +
          (meta.lat != null ? ' · ' + Number(meta.lat).toFixed(5) + ', ' + Number(meta.lng).toFixed(5) : '') + '</div>' +
        '<div style="max-width:120mm;text-align:right">Usos y vías de OpenStreetMap · población del DANE' +
          (ter ? ' · relieve ' + esc(ter.fuente || '') : '') +
          (cli ? ' · clima ' + esc(cli.fuente || '') : '') +
          '. Esto no es el sector: es lo que estas fuentes saben de él.</div>' +
      '</footer>' +
      '</div></body></html>';
  }

  /* `opts` deja imprimir algo que NO es lo que está en pantalla: un sector
     guardado, semanas después, desde la pestaña. Sin esto el PDF de una ficha
     vieja salía con el nombre y la cobertura del último análisis hecho, que
     es peor que no tener el botón. */
  function htmlImprimible(res, zonas, opts) {
    var o = opts || {};
    var st = res.stats || {}, meta = res.meta || {};
    var TAX = (window.AIA_MOTOR && window.AIA_MOTOR.TAXONOMIA) || [];
    var nom = String(o.nombre !== undefined ? o.nombre : (S.nombreGuardado || '')).trim();
    var cuando = new Date().toLocaleString('es-CO');
    var area = meta.forma === 'poligono'
      ? 'Área dibujada de ' + formatearArea(meta.areaM2)
      : 'Radio de ' + meta.radioM + ' m desde ' + Number(meta.lat).toFixed(5) + ', ' + Number(meta.lng).toFixed(5);

    function filas(obj, nombrar) {
      return Object.keys(obj || {})
        .map(function (k) { return { id: k, n: obj[k] || 0 }; })
        .filter(function (x) { return x.n > 0 && x.id !== 'otro'; })
        .sort(function (a, b) { return b.n - a.n; })
        .map(function (x) { return '<tr><td>' + esc(nombrar(x.id)) + '</td><td class="n">' + x.n + '</td></tr>'; })
        .join('');
    }

    var tareas = (!zonas.vacios.length && !zonas.flojos.length)
      ? '<p>Los ocho rumbos tienen datos. El trabajo será de verificación y corrección.</p>'
      : '<ul class="tareas">' +
          zonas.vacios.map(function (r) { return '<li>Al ' + esc(r.nombre) + ' — sin un solo registro</li>'; }).join('') +
          zonas.flojos.map(function (f) { return '<li>Al ' + esc(f.rumbo.nombre) + ' — apenas ' + f.n + '</li>'; }).join('') +
        '</ul>';

    return '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
      '<title>Reconocimiento · ' + esc(nom || 'sector') + '</title><style>' +
      '@page{margin:16mm}' +
      'body{font:13px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;color:#12202e;margin:0}' +
      'h1{font-size:21px;margin:0 0 3px;color:#075E88}' +
      '.sub{color:#5a6472;font-size:12px;margin:0 0 18px}' +
      'h2{font-size:14px;margin:22px 0 7px;color:#075E88;border-bottom:1px solid #c7e7f7;padding-bottom:4px}' +
      'table{border-collapse:collapse;width:100%;max-width:340px}' +
      'td{padding:3px 8px 3px 0;border-bottom:1px solid #eef2f6}' +
      'td.n{text-align:right;font-weight:700;color:#0A6F9E;width:52px}' +
      '.kpis{display:flex;gap:22px;margin:0 0 6px}' +
      '.kpi b{display:block;font-size:19px;color:#0A6F9E}' +
      '.kpi small{color:#5a6472;font-size:11px}' +
      '.tareas{margin:0;padding-left:18px}' +
      '.tareas li{margin-bottom:4px}' +
      '.check{margin:0;padding-left:18px;list-style:none}' +
      '.check li{margin-bottom:7px}' +
      '.check li:before{content:"☐  ";color:#9aa7b4}' +
      'table.plan{max-width:none;margin-top:4px}' +
      'table.plan td{vertical-align:top;padding:7px 10px 7px 0;border-bottom:1px solid #eef2f6}' +
      'table.plan td.g{width:110px}' +
      'table.plan td.g span{color:#5a6472;font-size:11.5px}' +
      'table.plan em{color:#5a6472;font-style:normal;font-size:11.5px}' +
      '.cob{display:flex;height:12px;border-radius:3px;overflow:hidden;max-width:340px;margin:2px 0 8px}' +
      '.cob i{display:block;height:100%}' +
      '.pie{color:#5a6472;font-size:11px;margin:5px 0 0}' +
      '.nota{margin-top:24px;padding:10px 12px;background:#f4f7fa;border:1px solid #e2e8f0;' +
        'border-radius:6px;font-size:11.5px;color:#4a5568}' +
      '</style></head><body>' +
      '<h1>Reconocimiento del sector' + (nom ? ' · ' + esc(nom) : '') + '</h1>' +
      '<p class="sub">URBIS Pro City · ' + esc(cuando) + ' · ' + esc(area) + '</p>' +
      '<div class="kpis">' +
        '<div class="kpi"><b>' + (st.total || 0) + '</b><small>usos registrados</small></div>' +
        '<div class="kpi"><b>' + (st.densidadPorHa != null ? Number(st.densidadPorHa).toFixed(1) : '—') + '</b><small>por hectárea</small></div>' +
        '<div class="kpi"><b>' + (zonas.vacios.length + zonas.flojos.length) + '</b><small>rumbos sin datos</small></div>' +
      '</div>' +
      ubicacionImpresa(res.ubicacion || (o && o.ubicacion)) +
      loteImpreso(meta, meta.forma === 'poligono') +
      '<h2>Qué hay, por categoría</h2><table>' + filas(st.porGrupo, nombreGrupo) + '</table>' +
      '<h2>Lo más repetido</h2><table>' + filas(st.porSub, function (id) {
        var t = TAX.filter(function (u) { return u.sub === id; })[0];
        return t ? t.nombre : id;
      }) + '</table>' +
      alturasImpresas(st) +
      terrenoImpreso(o.terreno !== undefined ? o.terreno : S.terreno) +
      climaImpreso(o.clima !== undefined ? o.clima : S.clima) +
      trazadoImpreso(o.trazado !== undefined ? o.trazado : S.trazado) +
      perfilImpreso(o.trazado !== undefined ? o.trazado : S.trazado) +
      espacioImpreso(o.trazado !== undefined ? o.trazado : S.trazado, st) +
      accesibilidadImpresa(st) +
      campoImpreso(o.campo !== undefined ? o.campo : S.campo) +
      sintesisImpresa(res) +
      rutasImpresas(st) +
      solImpreso(meta) +
      hitosImpresos(st) +
      coberturaImpresa(o.cobertura !== undefined ? o.cobertura : S.cobertura) +
      contextoImpreso(st) +

      '<h2>A dónde ir</h2>' + tareas +

      /* El plan y la lista con nombres son la razón de imprimir esto: el
         diagnóstico se lee en el celular, pero el reparto se recorta y se le
         da a cada grupo, y la lista se tacha caminando. */
      planImpreso(res, zonas) +
      listaImpresa(st) +

      '<h2>Para verificar en campo</h2><ul class="check">' +
        '<li>Los usos sin categoría: mirar qué son de verdad.</li>' +
        '<li>Una muestra de lo más repetido: comprobar que siga abierto.</li>' +
        '<li>Anotar lo que existe y no aparece acá.</li>' +
      '</ul>' +
      '<p class="nota"><b>Esto no es el sector: es lo que OpenStreetMap sabe del sector.</b> ' +
      'Los datos los pone gente voluntaria, así que están incompletos y a veces desactualizados. ' +
      'Sirve para llegar con una idea formada, no para reemplazar la salida a campo.</p>' +
      '</body></html>';
  }

  // ── Lo que se ve en el mapa ───────────────────────────────────────────
  // Una lista de números no dice dónde está nada. El sentido de mirar un
  // sector antes de ir es verlo, así que el resultado se pinta: cada uso en
  // el color de su categoría y, debajo, las manzanas por estrato.
  var capaPuntos = null, capaEstratos = null, capaLlenos = null;

  function pintarPuntos(pois) {
    var m = mapa();
    if (!m || typeof L === 'undefined') return 0;
    if (capaPuntos) { try { m.removeLayer(capaPuntos); } catch (e) {} capaPuntos = null; }
    if (!pois || !pois.length) return 0;

    capaPuntos = L.layerGroup().addTo(m);
    var CAT = window.AIA_CATALOGO || {};
    var G = CAT.GRUPOS || {};
    pois.forEach(function (p) {
      if (p.lat == null || p.lng == null) return;
      var g = G[p.grupo] || {};
      // Los que no se pudieron clasificar salen más grandes: son la tarea de
      // campo, no ruido que haya que buscar con lupa.
      var sinCategoria = !p.grupo || p.grupo === 'otro';
      L.circleMarker([p.lat, p.lng], {
        radius: sinCategoria ? 7 : 5,
        color: '#12202e', weight: sinCategoria ? 1.8 : 1.1,
        fillColor: p.color || '#94a3b8',
        fillOpacity: sinCategoria ? 0.95 : 0.85
      }).bindPopup(
        '<b>' + (p.icono ? icoCat(p.icono, 14) : '') + esc(p.nombre || 'Sin nombre') + '</b><br>' +
        esc(g.t || g.nombre || p.grupo || 'sin categoría') +
        (p.distM != null ? ' · ' + p.distM + ' m' : '') +
        (sinCategoria ? '<br><em>Sin categoría: verificar en campo</em>' : '')
      ).addTo(capaPuntos);
    });
    return pois.length;
  }

  function quitarDelMapa() {
    var m = mapa();
    [capaPuntos, capaEstratos, capaLlenos].forEach(function (c) {
      if (c && m) { try { m.removeLayer(c); } catch (e) {} }
    });
    capaPuntos = null; capaEstratos = null; capaLlenos = null;
    S.llenosEnMapa = false;
  }

  /* Los llenos y vacíos, dibujados. Las cifras dicen QUÉ PROPORCIÓN del área
     está construida; el dibujo dice DÓNDE, que es otra cosa y es la que sirve
     para proyectar: no es lo mismo un 12% repartido que un 12% todo en una
     esquina. Es la lámina de llenos y vacíos de toda la vida.

     Las huellas se guardan al medir el trazado y se pintan desde memoria: no
     se vuelve a consultar la red para verlas. */
  function pintarLlenos(encender) {
    var m = mapa();
    if (!m || typeof L === 'undefined') return false;
    if (capaLlenos) { try { m.removeLayer(capaLlenos); } catch (e) {} capaLlenos = null; }
    S.llenosEnMapa = false;
    if (!encender) return false;
    var huellas = S.trzHuellas || [];
    if (!huellas.length) return false;

    capaLlenos = L.layerGroup();
    huellas.forEach(function (anillo) {
      try {
        L.polygon(anillo.map(function (p) { return [p.lat, p.lng]; }), {
          // Tinta plana y borde fino: es una lámina de llenos, no un mapa de
          // colores. Lo construido pesa, lo libre es el fondo.
          color: '#0F1F2E', weight: 0.6, opacity: 0.9,
          fillColor: '#3B4A5A', fillOpacity: 0.82, interactive: false
        }).addTo(capaLlenos);
      } catch (e) {}
    });
    capaLlenos.addTo(m);
    // Debajo de los puntos: los usos se siguen leyendo encima del tejido.
    try { if (capaLlenos.bringToBack) capaLlenos.bringToBack(); } catch (e) {}
    S.llenosEnMapa = true;
    return true;
  }

  /* Manzanas por estrato, del DANE. Van DEBAJO de los puntos: son el fondo
     sobre el que se leen los usos, no un dato que compita con ellos. */
  async function pintarEstratos(encender) {
    var m = mapa();
    if (!m || typeof L === 'undefined') return { ok: false, error: 'El mapa no está listo.' };
    if (capaEstratos) { try { m.removeLayer(capaEstratos); } catch (e) {} capaEstratos = null; }
    if (!encender) return { ok: true, apagado: true };
    if (!window.AIA_DATOS || !window.AIA_DATOS.manzanasEstrato) {
      return { ok: false, error: 'Falta el módulo de datos del DANE.' };
    }

    var eje = ejeActual();
    if (!eje) return { ok: false, error: 'Primero elegí un sector.' };
    var radio = S.forma === 'poligono' ? radioParaDane() : S.radioM;

    var d;
    try { d = await window.AIA_DATOS.manzanasEstrato(eje.lat, eje.lng, radio); }
    catch (e) { return { ok: false, error: (e && e.message) || 'No se pudo cargar la estratificación.' }; }
    if (!d || !d.manzanas || !d.manzanas.length) {
      return { ok: false, error: 'El DANE no tiene manzanas con estrato en esta zona. Suele pasar fuera del perímetro urbano.' };
    }

    capaEstratos = L.layerGroup();
    d.manzanas.forEach(function (mz) {
      L.polygon(mz.anillos, { color: mz.color, weight: 0.8, opacity: 0.9,
                              fillColor: mz.color, fillOpacity: 0.45 })
        .bindPopup('<b>' + esc(mz.etiqueta) + '</b>')
        .addTo(capaEstratos);
    });
    capaEstratos.addTo(m);
    try { capaEstratos.eachLayer(function (l) { if (l.bringToBack) l.bringToBack(); }); } catch (e) {}
    return { ok: true, n: d.manzanas.length, colores: d.colores, manzanas: d.manzanas };
  }

  function ejeActual() {
    if (S.forma === 'poligono' && S.poligono && S.poligono.length >= 3) return centroideDe(S.poligono);
    return S.centro;
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
      if (acc === 'volver') { S.resultado = null; S.comparacion = null; S.aviso = ''; S.textoPlano = ''; pintar(); return; }
      if (acc === 'borrar-ficha') { borrarFicha(b.getAttribute('data-id')); pintar(); return; }
      if (acc === 'comparar') { comparar(b.getAttribute('data-id')); return; }
      if (acc === 'imprimir') {
        if (!S.resultado || !S.ultimasZonas) return;
        var caja2 = document.getElementById('pcr-nombre');
        S.nombreGuardado = caja2 ? String(caja2.value || '').trim() : '';
        var html = htmlImprimible(S.resultado, S.ultimasZonas);
        var abrir = window.AIA_INFORME && window.AIA_INFORME.abrirVentanaImpresion;
        if (abrir) { abrir(html); return; }
        var w = window.open('', '_blank');
        if (!w) { S.aviso = 'Permite las ventanas emergentes para poder imprimir.'; pintar(); return; }
        w.document.write(html); w.document.close();
        setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 600);
        return;
      }
      if (acc === 'lamina') {
        if (!S.resultado) return;
        var caja3 = document.getElementById('pcr-nombre');
        S.nombreGuardado = caja3 ? String(caja3.value || '').trim() : '';
        abrirImpresion(laminaImprimible(S.resultado), function (m) { S.aviso = m; pintar(); });
        return;
      }
      if (acc === 'campo') { analizarCampo(); return; }
      if (acc === 'estratos') { alternarEstratos(); return; }
      if (acc === 'ver-mapa') {
        S.enMapa = !S.enMapa;
        var pudo = verGuardadasEnMapa(S.enMapa);
        if (S.enMapa && !pudo) { S.enMapa = false; S.aviso = 'No hay reconocimientos que dibujar.'; }
        else S.aviso = S.enMapa ? 'Áreas revisadas dibujadas en el mapa. Cerrá esta hoja para verlas.' : '';
        pintar();
        return;
      }
      if (acc === 'radio') { S.radioM = Number(b.getAttribute('data-r')) || RADIO_POR_DEFECTO;
                             S.forma = 'radio'; S.resultado = null; S.error = '';
                             pintarCirculo(); pintar(); return; }
      if (acc === 'forma') {
        var f = b.getAttribute('data-f');
        if (f === 'poligono') {
          var pol = poligonoDeProCity();
          if (!pol) { S.error = 'Primero dibuja un área en Pro City, y vuelve acá.'; pintar(); return; }
          S.poligono = pol;
        }
        S.forma = f; S.resultado = null; S.error = '';
        // Al elegir la forma, la hoja baja: es cuando hay que VER el mapa
        // para poner el radio o dibujar el área.
        S.encogida = true;
        if (f === 'radio') { tomarCentro(); seguirAlMapa(true); }
        else seguirAlMapa(false);
        pintarCirculo(); pintar(); return;
      }
      if (acc === 'agrandar') { S.encogida = false; seguirAlMapa(false); pintar(); return; }
      // Nota: el calor sigue encendido en el mapa al volver al informe. Se
      // apaga desde los chips o desde el chip del propio mapa.
      if (acc === 'encoger') { S.encogida = true;
        if (S.forma === 'radio') seguirAlMapa(true);
        pintar(); return; }
      if (acc === 'dibujar-area') {
        // Se le pide a Pro City su lápiz de siempre y se cierra esta hoja: no
        // se puede dibujar sobre el mapa con una hoja encima.
        cerrar();
        try { if (window.URBIS_PC_ANALISIS) window.URBIS_PC_ANALISIS.iniciarDibujo(); } catch (e) {}
        return;
      }
      if (acc === 'analizar') { analizar(); return; }
      if (acc === 'guardar') {
        if (!S.resultado || !S.ultimasZonas) return;
        // Un nombre, porque tres fichas del mismo día son indistinguibles por
        // la fecha. Si no escribe nada, se guarda igual: obligarlo a nombrar
        // algo que quizá analiza una sola vez sería cobrarle por adelantado.
        var caja = document.getElementById('pcr-nombre');
        var nom = caja ? String(caja.value || '').trim().slice(0, 60) : '';
        S.nombreGuardado = nom;
        var g = guardarFicha(S.resultado, S.ultimasZonas, nom, S.fichaActualId);
        S.aviso = g.ok
          ? ('Ficha guardada' + (g.recortada ? ' (se borraron las más viejas por falta de espacio)' : '') +
             '. La encontrás en la pestaña «Sector», con ' + g.n + ' más.')
          : g.error;
        pintar();
        return;
      }
      if (acc === 'copiar') {
        if (!S.resultado || !S.ultimasZonas) return;
        var txt = fichaComoTexto(S.resultado, S.ultimasZonas);
        var listo = function () { S.aviso = 'Copiado. Pegalo en tus notas o en un chat para tenerlo sin señal.'; pintar(); };
        var falló = function () {
          // Sin portapapeles (navegador viejo, o sin HTTPS) no se deja al
          // usuario sin salida: se le muestra el texto para copiarlo a mano.
          S.aviso = 'Este navegador no deja copiar solo. Mantené pulsado el texto de abajo para copiarlo.';
          S.textoPlano = txt; pintar();
        };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txt).then(listo, falló);
          } else { falló(); }
        } catch (e) { falló(); }
        return;
      }
      if (acc === 'calor') { alternarCalor(b.getAttribute('data-cal')); return; }
      if (acc === 'calor-off') { S.calor = []; aplicarCalor(); pintar(); return; }
      if (acc === 'guardar-area') {
        var A2 = window.URBIS_PC_ANALISIS;
        var pol = (S.resultado && S.resultado.meta && S.resultado.meta.poligono) || S.poligono;
        if (!A2 || typeof A2.guardarAreaConNombre !== 'function' || !pol || pol.length < 3) {
          S.aviso = 'Solo se puede guardar un área dibujada. Analizá por área y volvé a intentar.';
          pintar(); return;
        }
        var caja3 = document.getElementById('pcr-nombre');
        var nom2 = caja3 ? String(caja3.value || '').trim().slice(0, 60) : '';
        if (!nom2) {
          // Sin nombre, la lista de áreas guardadas es una fila de fechas
          // idénticas. Acá sí se exige: el área se guarda para volver a
          // ELLA, y volver empieza por reconocerla.
          S.aviso = 'Escribí arriba un nombre para el sector antes de guardar el área.';
          pintar();
          try { if (caja3) caja3.focus(); } catch (e) {}
          return;
        }
        var g2 = A2.guardarAreaConNombre(nom2, pol.map(function (q) {
          return { lat: q.lat, lng: q.lng };
        }));
        /* El nombre es uno solo: el que se escribió en la caja. Si nombra el
           área y la ficha del mismo sector sigue llamándose «Sector del 3 de
           septiembre», la pestaña «Sector» le muestra un nombre que él no
           puso y no reconoce. */
        S.nombreGuardado = nom2;
        if (S.resultado && S.ultimasZonas) {
          try { guardarFicha(S.resultado, S.ultimasZonas, nom2, S.fichaActualId); } catch (e) {}
        }
        S.aviso = g2
          ? ('Área «' + nom2 + '» guardada. La encontrás en Análisis → Áreas guardadas.')
          : 'No se pudo guardar el área.';
        pintar(); return;
      }
      if (acc === 'comp-copiar') {
        if (!S.comparacion) return;
        var txtC = comparacionComoTexto(S.comparacion);
        var listoC = function () { S.aviso = 'Copiado. Pegalo en el informe del curso.'; pintar(); };
        var falloC = function () {
          S.aviso = 'Este navegador no deja copiar solo. Mantené pulsado el texto de abajo.';
          S.textoPlano = txtC; pintar();
        };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txtC).then(listoC, falloC);
          } else falloC();
        } catch (e) { falloC(); }
        return;
      }
      if (acc === 'comp-pdf') {
        if (!S.comparacion) return;
        var htmlC = comparacionImprimible(S.comparacion);
        var abrirC = window.AIA_INFORME && window.AIA_INFORME.abrirVentanaImpresion;
        if (abrirC) { abrirC(htmlC); return; }
        var wC = window.open('', '_blank');
        if (!wC) { S.aviso = 'Permite las ventanas emergentes para poder imprimir.'; pintar(); return; }
        wC.document.write(htmlC); wC.document.close();
        setTimeout(function () { try { wC.focus(); wC.print(); } catch (e) {} }, 600);
        return;
      }
      if (acc === 'comp-exp') {
        var EXPC = window.URBIS_PC_EXPORTAR;
        var dC = S.comparacion ? datosDeComparacion(S.comparacion) : null;
        if (!EXPC || !dC) { S.aviso = 'No hay una comparación que exportar.'; pintar(); return; }
        EXPC.exportar(b.getAttribute('data-f'), dC);
        return;
      }
      if (acc === 'cobertura') { analizarCobertura(); return; }
      if (acc === 'otro') {
        // Se suelta el resultado, no el área: quien quiera el mismo sector con
        // otro radio no tiene que volver a dibujarlo.
        S.resultado = null; S.huellaAnalizada = ''; S.trazado = null; S.terreno = null;
        S.cobertura = null; S.cobEnMapa = false; S.calor = []; S.encogida = false;
        S.trzHuellas = null; pintarLlenos(false);
        try {
          var A5 = window.URBIS_PC_ANALISIS;
          if (A5 && typeof A5.quitarRaster === 'function') A5.quitarRaster();
        } catch (e) {}
        pintar(); return;
      }
      if (acc === 'trazado') { analizarTrazado(); return; }
      if (acc === 'terreno') { analizarTerreno(); return; }
      if (acc === 'clima') { analizarClima(); return; }
      if (acc === 'llenos-mapa') {
        var puesto = pintarLlenos(!S.llenosEnMapa);
        // Verlos es bajar la hoja: están justo debajo de ella.
        if (puesto) S.encogida = true;
        pintar();
        return;
      }
      if (acc === 'cob-mapa') {
        var A4 = window.URBIS_PC_ANALISIS;
        if (!A4 || !S.cobertura) return;
        S.cobEnMapa = !S.cobEnMapa;
        try {
          if (S.cobEnMapa && typeof A4.mostrarRaster === 'function') A4.mostrarRaster(S.cobertura);
          else if (typeof A4.quitarRaster === 'function') A4.quitarRaster();
        } catch (e) {}
        // Verla es cerrar la hoja: está justo encima del mapa.
        if (S.cobEnMapa) { S.encogida = true; }
        pintar();
        return;
      }
      if (acc === 'exp') {
        var EXP = window.URBIS_PC_EXPORTAR;
        var f = b.getAttribute('data-f');
        var datos = datosParaExportar(null);
        if (!EXP || !datos) { S.aviso = 'No hay un área analizada que exportar.'; pintar(); return; }
        EXP.exportar(f, datos);
        return;
      }
      if (acc === 'grupos') {
        S.grupos = Number(b.getAttribute('data-g')) || 4;
        pintar();
        return;
      }
      if (acc === 'recentrar') { tomarCentro(); pintarCirculo(); pintar(); return; }
    });
    return el;
  }

  /* Mientras la hoja está encogida y se analiza por radio, el círculo sigue
     al centro del mapa: se mueve el mapa y se ve exactamente qué se va a
     analizar, sin tener que tocar «usar el centro» cada vez. Se conecta y se
     desconecta a propósito —dejarlo escuchando siempre repintaría el círculo
     en cada gesto del usuario aunque esta herramienta esté cerrada—. */
  var siguiendo = false;
  function alMoverElMapa() {
    if (!S.encogida || S.forma !== 'radio') return;
    var m = mapa(); if (!m) return;
    var c = m.getCenter();
    S.centro = { lat: c.lat, lng: c.lng };
    pintarCirculo();
    var eco = document.getElementById('pcr-eco');
    if (eco) eco.textContent = S.centro.lat.toFixed(5) + ', ' + S.centro.lng.toFixed(5);
  }
  function seguirAlMapa(activar) {
    var m = mapa(); if (!m) return;
    if (activar && !siguiendo) { m.on('moveend', alMoverElMapa); siguiendo = true; }
    else if (!activar && siguiendo) { m.off('moveend', alMoverElMapa); siguiendo = false; }
  }

  function tomarCentro() {
    var m = mapa();
    if (!m) return;
    var c = m.getCenter();
    S.centro = { lat: c.lat, lng: c.lng };
    S.resultado = null;
    S.error = '';
  }

  var grafica = null;

  /* El anillo de categorías, con los colores del catálogo —los mismos del
     modo empresarial, de donde salen el rosado de salud y el celeste—. Se
     pinta DESPUÉS de meter el HTML: Chart.js necesita el canvas ya en el
     documento. Si la librería no cargó, no pasa nada: las barras de abajo
     cuentan lo mismo. La gráfica es la forma bonita del dato, no el dato. */
  function pintarGrafica(res) {
    if (grafica) { try { grafica.destroy(); } catch (e) {} grafica = null; }
    if (typeof Chart === 'undefined') return;
    var lienzo = document.getElementById('pcr-donut');
    if (!lienzo || !res) return;

    var st = res.stats || {};
    var CAT = window.AIA_CATALOGO || {};
    var G = CAT.GRUPOS || {}, COL = CAT.GRUPO_COLOR || {};
    var datos = Object.keys(st.porGrupo || {})
      .map(function (g) { return { id: g, n: st.porGrupo[g] || 0 }; })
      .filter(function (x) { return x.n > 0 && x.id !== 'otro'; })
      .sort(function (a, b) { return b.n - a.n; });
    if (!datos.length) return;

    try {
      grafica = new Chart(lienzo, {
        type: 'doughnut',
        data: {
          labels: datos.map(function (x) {
            var d = G[x.id] || {};
            return (d.t || d.nombre || x.id) + ' · ' + x.n;
          }),
          datasets: [{
            data: datos.map(function (x) { return x.n; }),
            backgroundColor: datos.map(function (x) { return COL[x.id] || '#94a3b8'; }),
            borderColor: '#ffffff', borderWidth: 2
          }]
        },
        options: (function () {
          var TG = window.URBIS_TEMA_GRAFICA;
          return {
            responsive: true, maintainAspectRatio: false, cutout: '62%',
            plugins: {
              legend: TG ? TG.leyenda('bottom')
                         : { position: 'bottom', labels: { color: '#3f4b5c', font: { size: 10 }, boxWidth: 10, padding: 8 } },
              tooltip: TG ? TG.tooltip() : {}
            }
          };
        })()
      });
    } catch (e) {
      try { console.warn('[URBIS] no se pudo pintar la gráfica:', e); } catch (x) {}
    }
  }

  /* La barra de abajo cuando la hoja está encogida. Lleva SOLO lo que hace
     falta con el mapa a la vista: qué se va a analizar, el radio, y el botón.
     Todo lo demás está a un toque, en el asa. */
  function htmlEncogida() {
    // Encogida CON resultado solo pasa por el mapa de calor: la barra habla
    // de eso y no de radios ni de dibujar, que ya son pasos cumplidos.
    if (S.resultado) return htmlEncogidaCalor();
    var esPol = S.forma === 'poligono';
    var hayPol = !!(S.poligono && S.poligono.length >= 3);

    var radios = RADIOS.map(function (r) {
      return '<button type="button" data-pcr="radio" data-r="' + r + '"' +
        ' class="pcr-radio' + (r === S.radioM ? ' pcr-radio-on' : '') + '">' +
        (r >= 1000 ? (r / 1000) + 'km' : r + 'm') + '</button>';
    }).join('');

    return '' +
      '<button type="button" data-pcr="agrandar" class="pcr-asa" aria-label="Abrir la hoja"></button>' +
      '<div class="pcr-mini-cuerpo">' +
        '<div class="pcr-mini-fila">' +
          '<div class="pcr-mini-que">' +
            (esPol
              ? '<b>' + ico('area', 16) + 'El área dibujada</b>' +
                (hayPol ? '<small>' + (formatearArea(areaDelPoligono()) || '') + '</small>'
                        : '<small>todavía no hay ninguna</small>')
              : '<b>' + ico('radio', 16) + 'Un radio</b><small id="pcr-eco">' +
                (S.centro ? S.centro.lat.toFixed(5) + ', ' + S.centro.lng.toFixed(5) : 'mové el mapa') +
                '</small>') +
          '</div>' +
          '<button type="button" data-pcr="agrandar" class="pcr-mini-mas" aria-label="Más opciones">⋯</button>' +
        '</div>' +

        (esPol ? '' : '<div class="pcr-radios pcr-radios-mini">' + radios + '</div>') +
        (esPol ? '' : '<p class="pcr-pista pcr-mini-pista">Mové el mapa: el círculo sigue el centro.</p>') +

        (esPol && !hayPol
          ? '<button type="button" data-pcr="dibujar-area" class="pcr-principal">' + ico('lapiz') + 'Dibujar el área en el mapa</button>'
          : '<button type="button" data-pcr="analizar" class="pcr-principal"' +
              (S.cargando || !listoParaAnalizar() ? ' disabled' : '') + '>' +
              (S.cargando ? 'Consultando…' : ico('lupa') + 'Ver qué hay') + '</button>') +

        (S.error ? '<p class="pcr-error">' + esc(S.error) + '</p>' : '') +
        (S.cargando ? '<p class="pcr-pista pcr-espera">La primera consulta del día puede tardar.</p>' : '') +
      '</div>';
  }

  function pintar() {
    var h = hoja();
    pintarVolver();
    // La ficha y la comparación se ven enteras: son para leer, no para
    // manipular el mapa.
    /* Con la ficha en pantalla la hoja NO se encoge: es para leer. La
       excepción es el mapa de calor, que se mira en el mapa —con la hoja
       entera encima no se ve nada de lo que se acaba de encender—, así que
       ahí sí baja, y baja mostrando los mismos interruptores. */
    /* Encogida con resultado: pasa siempre que haya ALGO puesto en el mapa
       que valga la pena mirar —el calor, la foto de cobertura o los llenos y
       vacíos—. Antes solo contaba el calor, así que «Ver en el mapa» del
       raster marcaba la hoja para encogerse y la hoja no se movía: se pulsaba
       el botón y no pasaba nada visible. */
    var hayCapa = S.calor.length > 0 || S.cobEnMapa || S.llenosEnMapa || !!S.estratos;
    var encoger = S.encogida && !S.comparacion && (!S.resultado || hayCapa);
    h.classList.toggle('pcr-encogida', encoger);
    // `encoger` va ANTES de `S.resultado`: si no, con la ficha en pantalla la
    // hoja se quedaba con la clase de encogida y el contenido entero dentro
    // —bajaba a una barra de 90 px con el informe completo comprimido—.
    h.innerHTML = S.comparacion ? htmlComparacion(S.comparacion)
                : encoger        ? htmlEncogida()
                : S.resultado    ? htmlFicha(S.resultado)
                : htmlAjustes();
    h.classList.toggle('pcr-visible', S.abierto);
    // El anillo solo existe en la ficha entera: pintarlo encogida buscaría un
    // canvas que no está.
    if (S.resultado && !S.comparacion && !encoger) pintarGrafica(S.resultado);
    else if (grafica) { try { grafica.destroy(); } catch (e) {} grafica = null; }
  }

  function htmlEncogidaCalor() {
    var st = (S.resultado && S.resultado.stats) || {};
    var grupos = Object.keys(st.porGrupo || {})
      .map(function (g) { return { id: g, n: st.porGrupo[g] || 0 }; })
      .filter(function (x) { return x.n > 0 && x.id !== 'otro'; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, 6);

    function chip(id, texto, n, color) {
      var on = S.calor.indexOf(id) !== -1;
      return '<button type="button" class="pcr-cal-chip' + (on ? ' on' : '') + '"' +
        ' data-pcr="calor" data-cal="' + esc(id) + '"' +
        (color ? ' style="--cal:' + esc(color) + '"' : '') + '>' +
        '<i></i>' + esc(texto) + (n != null ? ' <b>' + n + '</b>' : '') + '</button>';
    }

    /* La barra encogida tiene que decir QUÉ se está mirando. Decía siempre
       «Mapa de calor», también cuando lo puesto era la foto de cobertura: el
       estudiante encendía el raster, la hoja bajaba y el rótulo hablaba de
       otra cosa. */
    var capa = S.calor.length
      ? { icono: 'calor', titulo: 'Mapa de calor', detalle: etiquetaCalor() }
      : S.estratos
        ? { icono: 'capas', titulo: 'Manzanas por estrato',
            detalle: (S.estratos.manzanas ? S.estratos.manzanas.length + ' manzanas del DANE' : 'del DANE') }
      : S.llenosEnMapa
        ? { icono: 'capas', titulo: 'Llenos y vacíos',
            detalle: (S.trazado && S.trazado.llenos)
              ? S.trazado.llenos.pctLleno + '% construido · ' + (S.trzHuellas || []).length + ' huellas'
              : 'las huellas de los edificios' }
      : S.cobEnMapa
        ? { icono: 'satelite', titulo: 'Cobertura del suelo',
            detalle: (S.cobertura && S.cobertura.clases
              ? (function () {
                  var v = S.cobertura.clases.filter(function (c) { return c.id === 'verde'; })[0];
                  return v ? 'verde ' + v.pct + '% del área' : 'sobre la foto satelital';
                })()
              : 'sobre la foto satelital') }
        : { icono: 'capas', titulo: 'Sobre el mapa', detalle: 'ninguna capa encendida' };

    return '' +
      '<button type="button" data-pcr="agrandar" class="pcr-asa" aria-label="Volver al informe"></button>' +
      '<div class="pcr-mini-cuerpo">' +
        '<div class="pcr-mini-fila">' +
          '<div class="pcr-mini-que">' +
            '<b>' + ico(capa.icono, 16) + esc(capa.titulo) + '</b>' +
            '<small>' + esc(capa.detalle) + '</small>' +
          '</div>' +
          '<button type="button" data-pcr="agrandar" class="pcr-mini-mas" aria-label="Volver al informe">⋯</button>' +
        '</div>' +
        (S.cobEnMapa
          ? '<button type="button" data-pcr="cob-mapa" class="pcr-mini">' +
              ico('apagar', 16) + 'Quitar la foto del mapa</button>'
          : '') +
        (S.llenosEnMapa
          ? '<button type="button" data-pcr="llenos-mapa" class="pcr-mini">' +
              ico('apagar', 16) + 'Quitar los llenos del mapa</button>'
          : '') +
        (S.estratos
          ? '<button type="button" data-pcr="estratos" class="pcr-mini">' +
              ico('apagar', 16) + 'Quitar los estratos del mapa</button>' +
            (S.estratos.leyenda || '')
          : '') +
        '<div class="pcr-calor-chips">' +
          chip('todos', 'Todos los usos', st.total || 0, null) +
          grupos.map(function (g) { return chip('g:' + g.id, nombreGrupo(g.id), g.n, colorDeGrupo(g.id)); }).join('') +
        '</div>' +
        '<button type="button" data-pcr="agrandar" class="pcr-principal">' + ico('atras') + 'Volver al informe</button>' +
      '</div>';
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

    var hayPol = !!poligonoDeProCity();
    var esPol = S.forma === 'poligono';
    var selector =
      '<div class="pcr-formas" role="group" aria-label="Forma del área">' +
        '<button type="button" data-pcr="forma" data-f="radio" class="pcr-forma' +
          (esPol ? '' : ' pcr-forma-on') + '" aria-pressed="' + (esPol ? 'false' : 'true') + '">' +
          ico('radio') + 'Un radio</button>' +
        '<button type="button" data-pcr="forma" data-f="poligono" class="pcr-forma' +
          (esPol ? ' pcr-forma-on' : '') + '" aria-pressed="' + (esPol ? 'true' : 'false') + '">' +
          ico('area') + 'El área dibujada</button>' +
      '</div>' +
      (hayPol || esPol ? '' :
        '<small class="pcr-pista">Para usar un área a medida, dibújala primero en Pro City con «Dibujar área en el mapa».</small>');

    // Con un área dibujada no hay centro ni radio que elegir: los deduce el
    // servidor del propio trazo. Mostrar esos controles ahí sería ofrecer una
    // decisión que no existe.
    var ajusteArea = esPol
      ? '<div class="pcr-campo">' +
          '<label class="pcr-lab">Área dibujada</label>' +
          '<p class="pcr-areainfo">' + (S.poligono ? S.poligono.length : 0) + ' vértices' +
            (areaDelPoligono() ? ' · ' + formatearArea(areaDelPoligono()) : '') + '</p>' +
          '<small class="pcr-pista">Se analiza exactamente lo que trazaste. Si lo redibujas, vuelve a tocar «El área dibujada».</small>' +
        '</div>'
      : '<div class="pcr-campo">' +
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
        '</div>';

    return '' +
      barra('Modo educativo · Reconocimiento', '¿Qué hay en este sector?', 'lupa') +
      '<div class="pcr-cuerpo">' +
        '<p class="pcr-intro">Antes de salir a mapear, mira qué tiene registrado OpenStreetMap en la zona. ' +
        'Sirve para llegar sabiendo qué esperar —y sobre todo, para ver qué <b>todavía no está mapeado</b>.</p>' +

        selector +
        ajusteArea +

        (S.error ? '<p class="pcr-error">' + esc(S.error) + '</p>' : '') +

        '<button type="button" data-pcr="analizar" class="pcr-principal"' +
          (S.cargando || !listoParaAnalizar() ? ' disabled' : '') + '>' +
          (S.cargando ? 'Consultando…' : ico('lupa') + 'Ver qué hay') +
        '</button>' +
        (S.cargando ? '<p class="pcr-pista pcr-espera">La primera consulta del día puede tardar. No cierres esta hoja.</p>' : '') +

        htmlGuardadas() +
      '</div>';
  }

  /* Las fichas guardadas, con lo único que se hace con ellas: compararlas
     contra lo que el curso mapeó después. Si no hay ninguna, no se muestra
     nada: un cajón vacío con un título encima solo ocupa pantalla. */
  function htmlGuardadas() {
    var fichas = leerFichas();
    if (!fichas.length) return '';
    var hayCampo = puntosDelCurso().length > 0;

    return '<div class="pcr-guardadas">' +
      '<div class="pcr-guardadas-cab">' +
        h4('guardar', 'Reconocimientos guardados') +
        '<button type="button" data-pcr="ver-mapa" class="pcr-mini">' +
          (S.enMapa ? ico('apagar') + 'Quitar del mapa' : ico('mapa') + 'Ver en el mapa') + '</button>' +
      '</div>' +
      (hayCampo
        ? '<p class="pcr-pista">Después de la salida a campo, compará: vas a ver cuánto agregó el curso.</p>'
        : '<p class="pcr-pista">Cuando el curso mapee en estas zonas, acá vas a poder comparar el antes y el después.</p>') +
      fichas.map(function (f) {
        var cuando = new Date(f.ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
        var tam = f.forma === 'poligono' ? formatearArea(f.areaM2) : (f.radioM + ' m');
        return '<div class="pcr-guardada">' +
          '<div class="pcr-guardada-t">' +
            '<b>' + esc(f.nombre || cuando) + '</b>' +
            (f.nombre ? '<em class="pcr-guardada-f">' + esc(cuando) + '</em>' : '') +
            '<small>' + esc(tam) + ' · ' + f.total + ' usos</small>' +
          '</div>' +
          '<button type="button" data-pcr="comparar" data-id="' + esc(f.id) + '"' +
            ' class="pcr-mini"' + (hayCampo && !S.comparando ? '' : ' disabled') + '>' +
            (S.comparando ? '…' : ico('comparar', 16) + 'Comparar') + '</button>' +
          '<button type="button" data-pcr="borrar-ficha" data-id="' + esc(f.id) + '"' +
            ' class="pcr-x pcr-x-mini" aria-label="Borrar ficha">' + ico('borrar', 16) + '</button>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  // ── La ficha ──────────────────────────────────────────────────────────
  function nombreGrupo(g) {
    // El catálogo público (js/59) llama «t» al nombre del grupo; el motor
    // remoto, «nombre». Sin mirar los dos, la fila decía «comercio» donde
    // la leyenda del anillo decía «Comercio y economía».
    var G = (window.AIA_MOTOR && window.AIA_MOTOR.GRUPOS) ||
            (window.AIA_CATALOGO && window.AIA_CATALOGO.GRUPOS) || {};
    var d = G[g];
    if (!d) return g;
    return d.t || d.nombre || d.n || g;
  }

  /* La ficha en texto pelado, para pegarla en WhatsApp o en las notas del
     celular. Un estudiante en la calle puede quedarse sin datos justo cuando
     la necesita; el papel —o una nota copiada— no se cae. */
  function fichaComoTexto(res, zonas) {
    var st = res.stats || {}, meta = res.meta || {};
    var TAX = (window.AIA_MOTOR && window.AIA_MOTOR.TAXONOMIA) || [];
    var L = [];
    L.push('RECONOCIMIENTO DEL SECTOR — URBIS Pro City');
    L.push(new Date().toLocaleString('es-CO'));
    L.push(meta.forma === 'poligono'
      ? 'Área dibujada: ' + formatearArea(meta.areaM2)
      : 'Radio: ' + meta.radioM + ' m desde ' + Number(meta.lat).toFixed(5) + ', ' + Number(meta.lng).toFixed(5));
    var ub = res.ubicacion;
    if (ub) {
      var cad = [ub.pais, ub.departamento, ub.ciudad, ub.comuna, ub.barrio].filter(Boolean);
      if (cad.length) L.push('Ubicación: ' + cad.join(' › '));
    }
    L.push('Usos registrados en OpenStreetMap: ' + (st.total || 0));
    if (meta.areaM2) {
      L.push('Área: ' + formatearArea(meta.areaM2) + ' (' + formatearM2(meta.areaM2) + ')');
      if (meta.perimetroM) L.push('Perímetro: ' + formatearLargo(meta.perimetroM));
    }
    L.push('');
    L.push('POR CATEGORÍA');
    Object.keys(st.porGrupo || {}).forEach(function (g) {
      if (st.porGrupo[g] > 0) L.push('  ' + nombreGrupo(g) + ': ' + st.porGrupo[g]);
    });
    L.push('');
    L.push('LO MÁS REPETIDO');
    Object.keys(st.porSub || {})
      .map(function (k) { return { id: k, n: st.porSub[k] }; })
      // «otro» no es un uso: es la falta de uno. Ya se cuenta aparte, y en la
      // lista de lo más repetido solo sirve para ensuciarla.
      .filter(function (x) { return x.n > 0 && x.id !== 'otro'; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, 10)
      .forEach(function (x) {
        var t = TAX.filter(function (u) { return u.sub === x.id; })[0];
        L.push('  ' + (t ? t.nombre : x.id) + ': ' + x.n);
      });
    L.push('');
    var alt = st.alturas;
    if (alt && alt.edificios) {
      L.push('ALTURAS DE LO CONSTRUIDO');
      if (!alt.conDato) {
        L.push('  ' + alt.edificios + ' edificios, ninguno con su número de pisos registrado.');
      } else {
        alt.niveles.forEach(function (x) {
          L.push('  ' + x.etiqueta + ': ' + x.edificios + ' (' + x.pct + '%)');
        });
        L.push('  ' + alt.conDato + ' de ' + alt.edificios + ' edificios traen la altura (' +
               alt.cobertura + '%). El más alto: ' + alt.maximo + ' pisos.');
      }
      L.push('');
    }
    var cli = res.clima || S.clima;
    if (cli) {
      var ct = cli.temperatura || {}, cll = cli.lluvia || {}, cv = cli.viento || {};
      L.push('EL CLIMA DEL SITIO');
      if (ct.media != null) L.push('  Temperatura media: ' + ct.media + ' °C (máx ' + ct.maxMedia + ', mín ' + ct.minMedia + ')');
      if (cll.anual != null) L.push('  Lluvia: ' + cll.anual + ' mm al año · ' + cll.diasConLluviaPct + '% de días con lluvia');
      if (cll.masLluvioso) L.push('  Más lluvioso: ' + cll.masLluvioso.nombre + ' (' + cll.masLluvioso.lluvia + ' mm) · más seco: ' + cll.masSeco.nombre + ' (' + cll.masSeco.lluvia + ' mm)');
      if (cv.dominante) L.push('  El viento viene del ' + cv.dominante.rumbo + ' (' + cv.dominante.pct + '%)');
      L.push('  ' + cli.lectura);
      L.push('  ' + cli.advertencia);
      L.push('');
    }
    var ter = res.terreno || S.terreno;
    if (ter) {
      var te = ter.elevacion || {}, tp = ter.pendiente || {};
      L.push('EL TERRENO');
      L.push('  Entre ' + te.min + ' y ' + te.max + ' msnm · ' + te.relieve + ' m de desnivel');
      L.push('  Pendiente media: ' + tp.media + '% · máxima: ' + tp.maxima + '%');
      if (ter.orientacion) L.push('  La ladera baja hacia el ' + ter.orientacion.rumbo);
      (tp.clases || []).forEach(function (c) { L.push('  ' + c.etiqueta + ': ' + c.pct + '%'); });
      L.push('  ' + ter.lectura);
      L.push('  Modelo de ' + ter.resolucionM + ' m de paso: para leer el relieve, no para dar cotas.');
      L.push('');
    }
    var trz = res.trazado || S.trazado;
    if (trz) {
      var tll = trz.llenos || {}, tvi = trz.vias || {}, tmo = trz.morfologia || {};
      L.push('EL TRAZADO DEL SECTOR');
      L.push('  Lleno: ' + tll.pctLleno + '% · vacío: ' + tll.pctVacio + '% (' + (tll.edificios || 0) + ' edificios)');
      (tvi.porMalla || []).forEach(function (m) { L.push('  ' + m.etiqueta + ': ' + m.km + ' km'); });
      L.push('  Total de vías: ' + tvi.kmTotal + ' km · en un sentido: ' + tvi.unSentidoPct + '%');
      L.push('  Intersecciones: ' + tmo.intersecciones + ' · tramo medio: ' + tmo.tramoMedioM + ' m · sin salida: ' + tmo.sinSalida);
      L.push('  ' + tmo.lectura);
      L.push('');
    }
    var rts = (st.movilidad && st.movilidad.rutas) || [];
    if (rts.length) {
      L.push('RUTAS DE TRANSPORTE PÚBLICO');
      rts.forEach(function (r) {
        L.push('  ' + (r.ref ? '[' + r.ref + '] ' : '') + (r.nombre || 'Sin nombre registrado') +
               (r.operador ? ' · ' + r.operador : ''));
      });
      L.push('');
    }
    var SOL = window.URBIS_SOLAR;
    if (SOL && meta.lat != null && meta.lng != null) {
      try {
        var sd = SOL.dia(new Date(), Number(meta.lat), Number(meta.lng));
        var sa = SOL.anio(Number(meta.lat), Number(meta.lng));
        if (sd && sd.salida) {
          var hh = function (x) { return x.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }); };
          L.push('ASOLEAMIENTO (hoy, calculado)');
          L.push('  Amanecer: ' + hh(sd.salida) + ' por el ' + SOL.rumbo(sd.azimutSalida) + ' (' + sd.azimutSalida + '°)');
          L.push('  Mediodía solar: ' + hh(sd.cenit) + ' a ' + sd.alturaMaxima + '° de altura');
          L.push('  Atardecer: ' + hh(sd.puesta) + ' por el ' + SOL.rumbo(sd.azimutPuesta) + ' (' + sd.azimutPuesta + '°)');
          L.push('  Horas de luz: ' + String(sd.duracionH).replace('.', ',') + ' h');
          L.push('  En el año: de ' + sa.solsticios.masBajo.altura + '° a ' + sa.solsticios.masAlto.altura + '° al mediodía');
          (sa.cenitales || []).forEach(function (x) {
            L.push('  Sol en el cenit: ' + x.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }));
          });
          L.push('  La fachada occidental recibe el sol bajo de la tarde.');
          L.push('');
        }
      } catch (e) {}
    }
    var hs = st.hitos || [];
    if (hs.length) {
      L.push('HITOS Y NODOS');
      hs.forEach(function (h) {
        L.push('  ' + h.n + '. ' + h.nombre + ' — ' + h.categoriaNombre + ', a ' + h.distM + ' m' +
               (h.registrado ? ' (patrimonio o Wikidata)' : ''));
      });
      L.push('  [ ] Falta la foto de cada uno: es de la salida.');
      L.push('');
    }
    L.push('A DÓNDE IR (sin datos en OpenStreetMap)');
    if (!zonas.vacios.length && !zonas.flojos.length) {
      L.push('  Los ocho rumbos tienen datos. Toca verificar y corregir.');
    } else {
      zonas.vacios.forEach(function (r) { L.push('  [ ] Al ' + r.nombre + ' — sin un solo registro'); });
      zonas.flojos.forEach(function (f) { L.push('  [ ] Al ' + f.rumbo.nombre + ' — apenas ' + f.n); });
    }
    L.push('');
    var up = st.usoPredominante;
    if (up) {
      L.push('QUÉ MANDA EN EL SECTOR');
      Object.keys(up).filter(function (k) { return up[k] > 0; })
        .sort(function (a, b) { return up[b] - up[a]; })
        .forEach(function (k) {
          L.push('  ' + (NOMBRE_USO[k] || k).replace(/^\S+\s/, '') + ': ' + up[k] + '%');
        });
      L.push('');
    }
    var mv = st.movilidad;
    if (mv) {
      L.push('CÓMO SE LLEGA');
      L.push('  ' + (mv.viaPrincipal
        ? 'Vía principal: ' + (mv.viaPrincipal.nombre || 'sin nombre') +
          (mv.viaPrincipal.distM != null ? ' (a ' + mv.viaPrincipal.distM + ' m)' : '')
        : 'Sin vías con nombre registradas'));
      L.push('  ' + (mv.nViasArterias || 0) + ' corredores · ' + (mv.paradasBus || 0) +
             ' paradas de bus · ' + (mv.ciclorrutas || 0) + ' tramos de ciclorruta');
      L.push('  Facilidad para llegar: ' + (mv.scoreAcceso || 0) + '/100 · exposición al tránsito: ' +
             (mv.exposicion || 0) + '/100');
      L.push('');
    }
    var am = st.ambiente;
    if (am) {
      L.push('VERDE Y AGUA');
      L.push('  ' + (am.parques || 0) + ' parques · ' + (am.cuerposAgua || 0) + ' cuerpos de agua · ' +
             (am.verdeNatural || 0) + ' manchas de verde · presencia de verde ' + (am.scoreVerde || 0) + '/100');
      L.push('');
    }
    var cobTxt = S.cobertura || (st && st.cobertura);
    if (cobTxt && cobTxt.clases) {
      L.push('COBERTURA DEL SUELO (foto satelital)');
      cobTxt.clases.slice().sort(function (a, b) { return b.pct - a.pct; })
        .filter(function (x) { return x.pct > 0; })
        .forEach(function (x) {
          L.push('  ' + x.etq + ': ' + x.pct + '% (' + Math.round(x.m2).toLocaleString('es-CO') + ' m²)');
        });
      L.push('');
    }
    if (zonas && zonas.vacios) {
      try { L.push(planComoTexto(res, zonas)); L.push(''); } catch (e) {}
    }
    L.push('Esto es lo que OpenStreetMap sabe del sector, no el sector.');
    L.push('Lo pone gente voluntaria: está incompleto y a veces desactualizado.');
    return L.join('\n');
  }

  /* Población del censo y su proyección. Va ANTES del inventario a propósito:
     es la mitad del análisis que no depende de cuánto se haya mapeado, así que
     está completa aunque OpenStreetMap no tenga nada del sector. */
  function bloquePoblacion(st, esPol) {
    if (!st || (!st.poblacionCenso && !st.poblacionEstimada)) return '';

    var censal = st.poblacionEsCensal && st.poblacionCenso;
    var hoy = st.poblacionProyectada || st.poblacionCenso || st.poblacionEstimada;
    var serie = st.serieProyeccion || [];

    /* La curva, con el mismo criterio que el modo empresarial: SÓLIDO lo que
       llega hasta hoy, PUNTEADO lo que va hacia adelante. Un dato observado y
       una estimación no pueden dibujarse igual; si se dibujan igual, el
       estudiante lee la proyección como si fuera un conteo.
       Se hace a mano en SVG y no con una librería: son doce puntos y una
       línea, y así se ve igual sin red. */
    var curva = '';
    if (serie.length > 1) {
      var W = 300, H = 66, pad = 4;
      var vals = serie.map(function (p) { return p.poblacion; });
      var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
      var rango = (max - min) || 1;
      var px = function (i) { return pad + (i / (serie.length - 1)) * (W - pad * 2); };
      var py = function (v) { return H - pad - ((v - min) / rango) * (H - pad * 2); };
      var punto = function (p, i) { return (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(p.poblacion).toFixed(1); };

      // Dónde termina lo conocido y empieza el pronóstico.
      var iFuturo = -1;
      serie.forEach(function (p, i) { if (iFuturo < 0 && p.futuro) iFuturo = i; });
      var corte = iFuturo > 0 ? iFuturo - 1 : serie.length - 1;

      var todo = serie.map(punto).join(' ');
      var solido = serie.slice(0, corte + 1).map(punto).join(' ');
      var area = solido + ' L' + px(corte).toFixed(1) + ' ' + H + ' L' + px(0).toFixed(1) + ' ' + H + ' Z';
      var hoyP = serie[corte];

      curva =
        '<svg class="pcr-curva" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" ' +
          'aria-label="Curva de población de ' + serie[0].anio + ' a ' + serie[serie.length - 1].anio + '">' +
          '<path d="' + area + '" fill="rgba(52,204,254,.20)"/>' +
          '<path d="' + todo + '" fill="none" stroke="#34CCFE" stroke-width="2" ' +
            'stroke-dasharray="5 3" opacity=".55" vector-effect="non-scaling-stroke"/>' +
          '<path d="' + solido + '" fill="none" stroke="#34CCFE" stroke-width="2" ' +
            'stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
          '<circle cx="' + px(0).toFixed(1) + '" cy="' + py(serie[0].poblacion).toFixed(1) + '" r="3.5" fill="#ec4899"/>' +
          '<circle cx="' + px(corte).toFixed(1) + '" cy="' + py(hoyP.poblacion).toFixed(1) +
            '" r="3.5" fill="#fff" stroke="#0A6F9E" stroke-width="2"/>' +
        '</svg>' +
        '<div class="pcr-curva-eje">' +
          '<span>' + serie[0].anio + '</span>' +
          '<span>' + hoyP.anio + '</span>' +
          '<span>' + serie[serie.length - 1].anio + '</span>' +
        '</div>';
    }

    // El pronóstico en números, no solo en dibujo: de dónde viene, dónde está
    // y a cuánto va. Es lo que un estudiante copia en su informe.
    var pronostico = '';
    if (st.poblacionCenso && st.poblacionProyectada && st.censoAnio) {
      var ultimo = serie.length ? serie[serie.length - 1] : null;
      pronostico =
        '<div class="pcr-crece">' +
          '<div><small>Censo ' + st.censoAnio + '</small><b>' +
            Number(st.poblacionCenso).toLocaleString('es-CO') + '</b><em>contado</em></div>' +
          '<span class="pcr-flecha">→</span>' +
          '<div><small>' + (st.anioProyeccion || '') + '</small><b>' +
            Number(st.poblacionProyectada).toLocaleString('es-CO') + '</b><em>hoy</em></div>' +
          (ultimo && ultimo.futuro
            ? '<span class="pcr-flecha">→</span>' +
              '<div class="pcr-futuro"><small>' + ultimo.anio + '</small><b>' +
                Number(ultimo.poblacion).toLocaleString('es-CO') + '</b><em>pronóstico</em></div>'
            : '') +
          (st.crecimientoPct != null ? '<span class="pcr-delta">+' + st.crecimientoPct + '%</span>' : '') +
        '</div>';
    }

    return h4('poblacion', 'Cuánta gente vive acá') +
      '<div class="pcr-pobla">' +
        '<div class="pcr-pobla-n">' +
          '<b>' + Number(hoy).toLocaleString('es-CO') + '</b>' +
          '<small>' + (censal ? 'personas · DANE' : 'personas · estimado') + '</small>' +
        '</div>' +
        (st.viviendasCenso
          ? '<div class="pcr-pobla-n"><b>' + Number(st.viviendasCenso).toLocaleString('es-CO') + '</b><small>viviendas</small></div>'
          : '') +
        // `estrato` NO es un número: es un objeto con el reparto por manzanas
        // (predominante, mínimo, máximo, promedio). Pintarlo con String() daba
        // «[object Object]» en pantalla. Se muestra el predominante, y el
        // rango al lado cuando el sector es mixto, que es lo que de verdad
        // describe un barrio: «3 a 5» dice más que «promedio 4».
        (st.estrato && st.estrato.predominante
          ? '<div class="pcr-pobla-n"><b>' + esc(String(st.estrato.predominante)) + '</b><small>' +
            (st.estrato.minimo !== st.estrato.maximo
              ? 'estrato · va de ' + st.estrato.minimo + ' a ' + st.estrato.maximo
              : 'estrato') + '</small></div>'
          : '') +
      '</div>' +
      /* Pintar las manzanas NO depende de que el censo haya traído el estrato:
         son dos consultas distintas al DANE. Condicionarlo a eso escondía el
         botón justo donde más falta hace —cuando la ficha no pudo decir de
         qué estrato es el sector— y dejaba al estudiante sin la única forma
         de averiguarlo. */
      '<button type="button" data-pcr="estratos" class="pcr-mini pcr-estratos-btn"' +
        (S.cargandoEstratos ? ' disabled' : '') + '>' +
        (S.cargandoEstratos ? 'Cargando…'
          : (S.estratos ? ico('apagar', 16) + 'Quitar los estratos'
                        : ico('capas', 16) + 'Ver las manzanas por estrato')) +
      '</button>' +
      pronostico +
      curva +
      '<p class="pcr-pista">' +
        (censal
          ? 'Parte del censo del DANE; lo demás es proyección con su tasa de crecimiento' +
            (st.tasaAnualDane ? ' (' + (st.tasaAnualDane * 100).toFixed(2) + '% al año)' : '') +
            '. <b>El tramo punteado es pronóstico hacia adelante</b>, no un dato contado.'
          : 'Sin cobertura del censo en este punto: la cifra es una estimación por densidad, no un dato observado.') +
        (esPol ? ' En un área dibujada se consulta por el centro y un radio de superficie equivalente, así que es aproximada.' : '') +
        (st.advertenciaProyeccion ? ' ' + esc(st.advertenciaProyeccion) : '') +
      '</p>';
  }

  /* Quién vive acá: sexo y edades del censo, con su iconografía.
     Las barras se dibujan con divs y no con Chart.js: son cinco tramos, y una
     librería para eso pesa más de lo que aporta —además de que si no carga,
     esto sigue viéndose—. */
  function bloqueDemografia(st) {
    var d = st && st.demografia;
    if (!d || !d.totalSexo) return '';

    // Hombres y mujeres: una sola barra partida, que es como se compara mejor
    // una proporción de dos.
    var pctM = d.pctMujeres || 0, pctH = d.pctHombres || 0;
    var sexo =
      '<div class="pcr-sexo">' +
        '<div class="pcr-sexo-barra">' +
          '<i class="pcr-sexo-m" style="width:' + pctM + '%"></i>' +
          '<i class="pcr-sexo-h" style="width:' + pctH + '%"></i>' +
        '</div>' +
        '<div class="pcr-sexo-pie">' +
          '<span><i class="pcr-punto pcr-punto-m"></i> Mujeres <b>' +
            Number(d.mujeres).toLocaleString('es-CO') + '</b> · ' + pctM + '%</span>' +
          '<span><i class="pcr-punto pcr-punto-h"></i> Hombres <b>' +
            Number(d.hombres).toLocaleString('es-CO') + '</b> · ' + pctH + '%</span>' +
        '</div>' +
      '</div>';

    // Edades: barras horizontales, cada tramo con su icono. El más numeroso
    // se marca, para que el ojo encuentre solo de qué edad es el sector.
    var tramos = d.tramos || [];
    var mayor = tramos.reduce(function (a, t) { return Math.max(a, t.personas || 0); }, 0) || 1;
    var edades = tramos.map(function (t) {
      var esDominante = t.id === d.tramoDominante;
      return '<div class="pcr-edad' + (esDominante ? ' pcr-edad-top' : '') + '">' +
        '<span class="pcr-edad-ico">' + icoCat(t.icono, 16) + '</span>' +
        '<span class="pcr-edad-nom">' + esc(t.etiqueta) + '</span>' +
        '<span class="pcr-edad-barra"><i style="width:' +
          Math.round((t.personas / mayor) * 100) + '%"></i></span>' +
        '<span class="pcr-edad-n">' + Number(t.personas).toLocaleString('es-CO') +
          '<em>' + t.pct + '%</em></span>' +
      '</div>';
    }).join('');

    /* El índice de envejecimiento en palabras. Un número suelto —«112»— no
       dice nada a un estudiante; la frase sí, y de paso enseña a leerlo. */
    var env = '';
    if (d.envejecimiento != null) {
      env = '<p class="pcr-pista"><b>Índice de envejecimiento: ' + d.envejecimiento + '</b> — ' +
        'por cada 100 menores de 15 años hay ' + d.envejecimiento + ' personas de 65 o más. ' +
        (d.envejecimiento >= 100
          ? 'Por encima de 100 el sector ya tiene más personas mayores que niños: pesa en escuelas, en salud y en accesibilidad.'
          : 'Por debajo de 100 hay más niños que personas mayores.') + '</p>';
    }

    return h4('edades', 'Quiénes viven acá') +
      sexo +
      '<div class="pcr-edades">' + edades + '</div>' +
      '<p class="pcr-pista">El tramo más numeroso es <b>' + esc(d.tramoDominanteEtq || '') + '</b>.</p>' +
      env;
  }

  // ── Mapa de calor a la carta ──────────────────────────────────────────
  /* El calor no lo pinta este archivo: lo pinta js/24, que ya sabe seguir al
     mapa, atenuarse al arrastrar y reintentar cuando el mapa está oculto. Acá
     solo se decide QUÉ puntos se le prestan. */

  function poisDelResultado() {
    return (S.resultado && S.resultado.pois) || [];
  }

  // Color de una categoría: el que el propio catálogo le dio a sus puntos.
  // Así el calor y los círculos del mapa hablan del mismo color, que es lo
  // que permite leerlos juntos.
  function colorDelCatalogo(g) {
    var CAT = window.AIA_CATALOGO || {};
    return (CAT.GRUPO_COLOR && CAT.GRUPO_COLOR[g]) || null;
  }

  function colorDeGrupo(g) {
    var p = poisDelResultado().filter(function (x) { return x.grupo === g && x.color; })[0];
    return (p && p.color) || null;
  }
  function colorDeSub(sub) {
    var p = poisDelResultado().filter(function (x) { return x.sub === sub && x.color; })[0];
    return (p && p.color) || null;
  }

  function puntosDeCalor() {
    var pois = poisDelResultado();
    if (!S.calor.length) return [];
    if (S.calor.indexOf('todos') !== -1) return pois;
    return pois.filter(function (p) {
      return S.calor.indexOf('g:' + p.grupo) !== -1 || S.calor.indexOf('s:' + p.sub) !== -1;
    });
  }

  function nombreDeSub(sub) {
    var TAX = (window.AIA_MOTOR && window.AIA_MOTOR.TAXONOMIA) || [];
    var t = TAX.filter(function (u) { return u.sub === sub; })[0];
    return t ? t.nombre : sub;
  }

  function etiquetaCalor() {
    if (S.calor.indexOf('todos') !== -1) return 'Todos los usos encontrados';
    if (S.calor.length === 1) {
      var id = S.calor[0];
      return (id.slice(0, 2) === 'g:' ? nombreGrupo(id.slice(2)) : nombreDeSub(id.slice(2)));
    }
    return S.calor.length + ' capas combinadas';
  }

  // Con una sola capa se tiñe con SU color (se reconoce de inmediato cuál es);
  // combinando varias no hay un color honesto, así que va la rampa multicolor.
  function colorDeCalor() {
    if (S.calor.length !== 1 || S.calor[0] === 'todos') return null;
    var id = S.calor[0];
    return id.slice(0, 2) === 'g:' ? colorDeGrupo(id.slice(2)) : colorDeSub(id.slice(2));
  }

  function aplicarCalor() {
    var A = window.URBIS_PC_ANALISIS;
    if (!A || typeof A.calorExterno !== 'function') {
      S.calor = [];
      S.aviso = 'El mapa de calor necesita el módulo de análisis por área. Recargá la app.';
      return;
    }
    var pts = puntosDeCalor();
    if (!pts.length) { A.calorExterno(null); return; }
    A.calorExterno(
      pts.map(function (p) { return { lat: p.lat, lng: p.lng }; }),
      colorDeCalor(), etiquetaCalor(),
      // Si lo apagan desde el chip del mapa, los botones de acá se apagan solos.
      function () { S.calor = []; if (S.abierto) pintar(); }
    );
  }

  function alternarCalor(id) {
    var i = S.calor.indexOf(id);
    if (id === 'todos') S.calor = (i === -1) ? ['todos'] : [];
    else {
      // 'todos' y una categoría concreta se contradicen: elegir una apaga la otra.
      S.calor = S.calor.filter(function (x) { return x !== 'todos'; });
      if (i === -1) S.calor = S.calor.concat(id);
      else S.calor = S.calor.filter(function (x) { return x !== id; });
    }
    aplicarCalor();
    // Un mapa de calor se mira en el mapa: la hoja baja sola al encenderlo.
    if (S.calor.length) S.encogida = true;
    pintar();
  }

  function bloqueCalor(res) {
    var st = res.stats || {};
    var pois = poisDelResultado();
    if (!pois.length) return '';

    var grupos = Object.keys(st.porGrupo || {})
      .map(function (g) { return { id: g, n: st.porGrupo[g] || 0 }; })
      .filter(function (x) { return x.n > 0 && x.id !== 'otro'; })
      .sort(function (a, b) { return b.n - a.n; });

    var subs = Object.keys(st.porSub || {})
      .map(function (x) { return { id: x, n: st.porSub[x] || 0 }; })
      .filter(function (x) { return x.n > 1 && x.id !== 'otro'; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, 8);

    function chip(id, texto, n, color) {
      var on = S.calor.indexOf(id) !== -1;
      return '<button type="button" class="pcr-cal-chip' + (on ? ' on' : '') + '"' +
        ' data-pcr="calor" data-cal="' + esc(id) + '"' +
        (color ? ' style="--cal:' + esc(color) + '"' : '') +
        ' aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<i></i>' + esc(texto) + (n != null ? ' <b>' + n + '</b>' : '') + '</button>';
    }

    var TAX = (window.AIA_MOTOR && window.AIA_MOTOR.TAXONOMIA) || [];
    return '' +
      h4('calor', 'Mapas de calor') +
      '<p class="pcr-pista">Elegí qué querés ver caliente. Podés <b>combinar varias</b> ' +
      'para encontrar dónde coinciden. Se pinta sobre el mapa: la hoja baja sola.</p>' +
      '<div class="pcr-calor-chips">' +
        chip('todos', 'Todos los usos', st.total || pois.length, null) +
        grupos.map(function (g) {
          return chip('g:' + g.id, nombreGrupo(g.id), g.n, colorDeGrupo(g.id));
        }).join('') +
      '</div>' +
      (subs.length
        ? '<p class="pcr-pista">Por uso concreto:</p><div class="pcr-calor-chips">' +
          subs.map(function (x) {
            var t = TAX.filter(function (u) { return u.sub === x.id; })[0];
            return chip('s:' + x.id, nombreDeSub(x.id),
                        x.n, colorDeSub(x.id));
          }).join('') + '</div>'
        : '') +
      (S.calor.length
        ? '<p class="pcr-calor-on">' + esc(etiquetaCalor()) + ' · <b>' + puntosDeCalor().length +
          '</b> puntos teñidos. <button type="button" data-pcr="calor-off" class="pcr-mini">Apagar</button></p>'
        : '');
  }

  // ── Movilidad, ambiente, uso predominante y núcleos ───────────────────
  /* Todo esto ya venía en la respuesta del servidor y no se estaba mostrando:
     es la mitad del análisis que explica POR QUÉ el sector es como es. Un
     inventario dice qué hay; esto dice cómo se llega, qué lo rodea y dónde
     está la calle que de verdad manda. */

  // Una medida de 0 a 100 con su barra. Se dice el número Y la palabra: «68»
  // no significa nada sin saber si eso es bueno.
  function medidor(titulo, valor, palabra, color) {
    var v = Math.max(0, Math.min(100, Math.round(Number(valor) || 0)));
    return '<div class="pcr-med">' +
      '<div class="pcr-med-cab"><span>' + esc(titulo) + '</span><b>' + v + '<em>/100</em></b></div>' +
      '<div class="pcr-med-barra"><i style="width:' + v + '%;background:' + (color || '#34CCFE') + '"></i></div>' +
      (palabra ? '<small>' + esc(palabra) + '</small>' : '') +
    '</div>';
  }

  /* Información del área. Las medidas del sitio, juntas y en las dos unidades
     con que se trabaja: hectáreas para leerlas, metros cuadrados para
     proyectar. El perímetro ya lo calculaba el motor y no se mostraba en
     ninguna parte de la ficha. Acá también entrará la elevación del terreno. */
  function bloqueLote(meta, esPol) {
    if (!meta) return '';
    var filas = [
      { etq: 'Área', val: formatearArea(meta.areaM2) },
      { etq: 'En metros cuadrados', val: formatearM2(meta.areaM2) },
      { etq: 'Perímetro', val: formatearLargo(meta.perimetroM) },
      esPol
        ? { etq: 'Vértices del contorno', val: (meta.vertices || 0) + '' }
        : { etq: 'Radio', val: formatearLargo(meta.radioM) }
    ];
    return h4('area', esPol ? 'Información del área' : 'Información del sector') +
      '<div class="pcr-lote">' +
        filas.map(function (x) {
          return '<div class="pcr-lote-fila"><span>' + esc(x.etq) + '</span><b>' + esc(x.val) + '</b></div>';
        }).join('') +
      '</div>' +
      '<p class="pcr-pista">El perímetro es el borde que se recorre a pie; ' +
      'el área, lo que se puede ocupar. Las dos cifras salen de la geometría que ' +
      (esPol ? 'dibujaste' : 'define el radio') + ', no de una estimación.</p>';
  }

  /* Alturas de lo construido. El dato viene edificio por edificio de
     OpenStreetMap, y ahí está el problema: casi nadie lo registra. Por eso el
     bloque empieza diciendo sobre cuántos edificios habla — un «54 % de un
     nivel» sacado de seis edificios de trescientos no describe el sector,
     describe la muestra. */
  function bloqueAlturas(st) {
    /* Dos fuentes para lo mismo, y hay que elegir bien. La consulta del
       análisis pide los edificios dejando fuera `building=yes` —el valor más
       común de todos—, así que su muestra es pequeña y sesgada. La del
       trazado los trae todos. Cuando el estudiante ha medido el trazado, ese
       es el reparto bueno; además así los dos bloques dejan de dar conteos de
       edificios distintos en la misma ficha, que es lo que confunde. */
    var a = st.alturas;
    var t = S.trazado && S.trazado.alturas;
    var deTrazado = !!(t && t.edificios > ((a && a.edificios) || 0));
    if (deTrazado) a = t;
    if (!a || !a.edificios) return '';
    if (!a.conDato) {
      return h4('crecer', 'Alturas de lo construido') +
        '<p class="pcr-pista">Se encontraron <b>' + a.edificios + '</b> edificio' +
        (a.edificios === 1 ? '' : 's') + ' en el área, pero ninguno tiene registrado ' +
        'su número de pisos en OpenStreetMap. <b>Es una tarea de campo:</b> contar niveles ' +
        'es de lo más rápido de levantar y de lo que más falta.</p>';
    }
    var mayor = a.niveles.reduce(function (m, x) { return Math.max(m, x.edificios); }, 0) || 1;
    return h4('crecer', 'Alturas de lo construido') +
      '<p class="pcr-conc">Predominan los de <b>' + esc(a.predominante.etiqueta.toLowerCase()) +
        '</b>: ' + a.predominante.pct + '% de los que tienen el dato.</p>' +
      '<div class="pcr-niveles">' +
        a.niveles.map(function (x) {
          return '<div class="pcr-nivel">' +
            '<span class="pcr-nivel-nom">' + esc(x.etiqueta) + '</span>' +
            '<span class="pcr-nivel-barra"><i style="width:' +
              Math.round(100 * x.edificios / mayor) + '%"></i></span>' +
            '<span class="pcr-nivel-n">' + x.edificios + '<em>' + x.pct + '%</em></span>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + a.edificios + '</b><small>edificios en el área</small></div>' +
        '<div class="pcr-kpi"><b>' + a.cobertura + '%</b><small>con altura registrada</small></div>' +
        '<div class="pcr-kpi"><b>' + a.maximo + '</b><small>el más alto, en pisos</small></div>' +
      '</div>' +
      (a.cobertura < 60
        ? '<p class="pcr-pista">Ojo con leer esos porcentajes como si fueran el sector entero: ' +
          'solo <b>' + a.conDato + ' de ' + a.edificios + '</b> edificios traen la altura. ' +
          'Los otros ' + a.sinDato + ' están sin contar — y contarlos en campo es trabajo del curso.</p>'
        : '<p class="pcr-pista">Casi todos los edificios del área traen su altura registrada, ' +
          'así que el reparto de arriba sí describe el sector.</p>') +
      (deTrazado
        ? ''
        : '<p class="pcr-pista">Este conteo deja fuera los edificios mapeados sin decir de qué son, ' +
          'que suelen ser la mayoría. <b>Midiendo el trazado del sector</b> se cuentan todos.</p>');
  }

  /* Hitos y nodos. Los núcleos dicen dónde se concentra la actividad; los
     hitos dicen qué le da identidad al sector y con qué se orienta la gente.
     Van numerados porque así se citan en una lámina: «el 3» y todos saben
     cuál es. */
  function bloqueHitos(st) {
    var hs = st.hitos || [];
    if (!hs.length) return '';
    var porCat = {};
    hs.forEach(function (h) {
      (porCat[h.categoriaNombre] = porCat[h.categoriaNombre] || []).push(h);
    });
    return h4('campo', 'Hitos y nodos') +
      '<p class="pcr-pista">Lo que le da identidad al sector y sirve para orientarse. ' +
      'Van numerados para poder citarlos: el número es el mismo en la lista y en el informe.</p>' +
      '<div class="pcr-hitos">' +
        Object.keys(porCat).map(function (cat) {
          return '<div class="pcr-hito-cat">' +
            '<span class="pcr-lab">' + esc(cat) + '</span>' +
            porCat[cat].map(function (h) {
              return '<div class="pcr-hito">' +
                '<span class="pcr-hito-n">' + h.n + '</span>' +
                '<span class="pcr-hito-nom">' + esc(h.nombre) +
                  (h.registrado ? '<em>con ficha en Wikidata o declarado patrimonio</em>' : '') +
                '</span>' +
                '<span class="pcr-hito-d">' + h.distM + ' m</span>' +
              '</div>';
            }).join('') +
          '</div>';
        }).join('') +
      '</div>' +
      '<p class="pcr-pista">Falta la foto de cada uno: esa no la tiene ninguna base de datos. ' +
      'Es el registro fotográfico de la salida.</p>';
  }

  /* Asoleamiento. El único bloque del análisis que no depende de que alguien
     haya mapeado algo: la posición del sol es geometría, así que sale igual
     en un sector lleno de datos y en uno vacío. Se calcula al PINTAR, no al
     analizar, para que un sector guardado en marzo no muestre en octubre las
     horas de marzo. */
  function bloqueSol(meta) {
    var SOL = window.URBIS_SOLAR;
    if (!SOL || !meta || meta.lat == null || meta.lng == null) return '';
    var lat = Number(meta.lat), lng = Number(meta.lng);
    if (!isFinite(lat) || !isFinite(lng)) return '';

    var hoy = new Date();
    var d, a;
    try { d = SOL.dia(hoy, lat, lng); a = SOL.anio(lat, lng, hoy.getFullYear()); }
    catch (e) { return ''; }
    if (!d || !d.salida) return '';

    /* «05:43 a. m.» no cabe en un tercio de pantalla de teléfono y parte en
       dos líneas, dejando las tres tarjetas descuadradas. Se separa la hora
       del meridiano: la hora grande, el «a. m.» pequeño al lado. */
    var hora = function (x) {
      if (!x) return '—';
      var t = x.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
      var m = t.match(/^(\d{1,2}:\d{2})\s*(.*)$/);
      return m ? esc(m[1]) + (m[2] ? '<em>' + esc(m[2]) + '</em>' : '') : esc(t);
    };
    var fc = SOL.fachadaCritica(d, lat);
    var sombraAmanecer = SOL.rumbo(SOL.sombra(d.azimutSalida));
    var sombraTarde = SOL.rumbo(SOL.sombra(d.azimutPuesta));
    var cenitales = (a.cenitales || []).map(function (x) {
      return x.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
    });

    return h4('brujula', 'Asoleamiento') +
      '<p class="pcr-pista">Para <b>hoy</b>, en las coordenadas de este sector y en la hora ' +
      'de este teléfono. Es el sol geométrico: no sabe si enfrente hay una montaña o una torre. ' +
      'Dice de dónde viene la luz — la sombra real se mide en el sitio.</p>' +
      '<div class="pcr-sol">' +
        '<div class="pcr-sol-hito">' +
          '<span class="pcr-lab">Amanecer</span><b>' + hora(d.salida) + '</b>' +
          '<small>por el ' + esc(SOL.rumbo(d.azimutSalida)) + ' · ' + d.azimutSalida + '°</small>' +
        '</div>' +
        '<div class="pcr-sol-hito pcr-sol-alto">' +
          '<span class="pcr-lab">Mediodía solar</span><b>' + hora(d.cenit) + '</b>' +
          '<small>a ' + d.alturaMaxima + '° sobre el horizonte</small>' +
        '</div>' +
        '<div class="pcr-sol-hito">' +
          '<span class="pcr-lab">Atardecer</span><b>' + hora(d.puesta) + '</b>' +
          '<small>por el ' + esc(SOL.rumbo(d.azimutPuesta)) + ' · ' + d.azimutPuesta + '°</small>' +
        '</div>' +
      '</div>' +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + String(d.duracionH).replace('.', ',') + ' h</b><small>de luz hoy</small></div>' +
        '<div class="pcr-kpi"><b>' + a.solsticios.masAlto.altura + '°</b><small>lo más alto del año</small></div>' +
        '<div class="pcr-kpi"><b>' + a.solsticios.masBajo.altura + '°</b><small>lo más bajo del año</small></div>' +
      '</div>' +
      '<p class="pcr-conc">Al amanecer las sombras caen hacia el <b>' + esc(sombraAmanecer) +
        '</b>; en la tarde, hacia el <b>' + esc(sombraTarde) + '</b>. ' +
        (fc.manda === 'cubierta'
          ? 'Hoy el sol culmina casi vertical (' + d.alturaMaxima + '°), así que a esa hora ' +
            'la fachada recibe poco y <b>el problema es la cubierta</b>.'
          : 'El sol culmina hacia el <b>' + esc(fc.culminacion) + '</b> a ' + d.alturaMaxima + '°.') +
        ' Lo que de verdad recalienta es el sol de la tarde, que entra bajo por el ' +
        '<b>occidente</b>: es la fachada que hay que proteger.</p>' +
      (cenitales.length === 2
        ? '<p class="pcr-pista">Este sector está en el trópico, así que el sol le pasa por ' +
          '<b>el cenit dos veces al año</b>: alrededor del <b>' + esc(cenitales[0]) + '</b> y del <b>' +
          esc(cenitales[1]) + '</b>. Esos días la luz cae vertical, la fachada casi no la recibe y ' +
          'la cubierta se lleva todo. Un manual europeo no cuenta con esto porque allá no pasa nunca.</p>'
        : '');
  }

  /* Ubicación. Una lámina de análisis urbano abre situando el lote: país,
     departamento, municipio, comuna, barrio. No es adorno — es lo que permite
     a alguien que no conoce la ciudad entender de qué se está hablando.
     Se arma con la geocodificación inversa que ya se consulta para el censo,
     así que no cuesta una petición más. */
  function bloqueUbicacion(ubic, st, meta) {
    if (!ubic) return '';
    var cadena = [
      { etq: 'País', val: ubic.pais },
      { etq: 'Departamento', val: ubic.departamento },
      { etq: 'Municipio', val: ubic.ciudad },
      { etq: 'Comuna', val: ubic.comuna },
      { etq: 'Barrio', val: ubic.barrio }
    ].filter(function (x) { return x.val; });
    if (!cadena.length) return '';
    return h4('mapa', 'Ubicación') +
      '<div class="pcr-ubic">' +
        cadena.map(function (x, i) {
          return '<div class="pcr-ubic-paso' + (i === cadena.length - 1 ? ' pcr-ubic-fin' : '') + '">' +
            '<span class="pcr-lab">' + esc(x.etq) + '</span>' +
            '<b>' + esc(x.val) + '</b></div>';
        }).join('') +
      '</div>' +
      parrafoDeContexto(ubic, st, meta) +
      '<p class="pcr-pista">La cadena sale de la geocodificación inversa de las coordenadas ' +
      'del sector. Si el barrio o la comuna no aparecen, es que no están registrados ahí — ' +
      'no que no existan.</p>';
  }

  /* El párrafo que la lámina escribe a mano para situar el lote. Se redacta
     con lo que ya se sabe y NADA más: si no hay estrato, no se menciona; si
     no hay hitos, no se inventan colindancias. Un párrafo que afirme de más
     es peor que no tenerlo, porque el estudiante lo copia tal cual. */
  function parrafoDeContexto(ubic, st, meta) {
    var p = [];
    var donde = [];
    if (ubic.barrio) donde.push('el barrio <b>' + esc(ubic.barrio) + '</b>');
    if (ubic.comuna) donde.push('la <b>' + esc(ubic.comuna) + '</b>');
    var lugar = donde.length ? donde.join(', de ') : '';
    if (lugar && ubic.ciudad) {
      p.push('El área analizada está en ' + lugar + ', en <b>' + esc(ubic.ciudad) + '</b>' +
             (ubic.departamento ? ', ' + esc(ubic.departamento) : '') + '.');
    } else if (ubic.ciudad) {
      p.push('El área analizada está en <b>' + esc(ubic.ciudad) + '</b>' +
             (ubic.departamento ? ', ' + esc(ubic.departamento) : '') + '.');
    }
    if (meta && meta.areaM2) {
      p.push('Cubre <b>' + formatearArea(meta.areaM2) + '</b>.');
    }
    var up = st && st.usoPredominante;
    if (up && up.id && up.pct >= 40) {
      p.push('Es un sector predominantemente <b>' +
             esc(sinEmoji(NOMBRE_USO[up.id] || up.id).toLowerCase()) + '</b> (' + up.pct + '% del peso de los usos).');
    }
    if (st && st.estrato) {
      p.push('El estrato predominante de las manzanas es <b>' + esc(String(st.estrato)) + '</b>.');
    }
    var hs = (st && st.hitos) || [];
    if (hs.length) {
      var cerca = hs.slice().sort(function (a, b) { return a.distM - b.distM; }).slice(0, 2);
      p.push('Lo más cercano que sirve de referencia: ' +
             cerca.map(function (h) { return '<b>' + esc(h.nombre) + '</b> (a ' + h.distM + ' m)'; }).join(' y ') + '.');
    }
    if (!p.length) return '';
    return '<p class="pcr-conc">' + p.join(' ') + '</p>';
  }

  /* Las rutas de transporte público que sirven al sector. Lo que se muestra
     es el número y el nombre —que es como la gente las llama—, no el
     recorrido: dibujarlo pediría traer la ruta completa de punta a punta, y
     lo que un análisis necesita saber es CUÁNTAS y CUÁLES pasan por acá. */
  function bloqueRutas(mv) {
    var rutas = (mv && mv.rutas) || [];
    if (!rutas.length) {
      if (!mv || !mv.paradasBus) return '';
      return '<p class="pcr-pista">Hay <b>' + mv.paradasBus + '</b> parada' +
        (mv.paradasBus === 1 ? '' : 's') + ' en el área, pero ninguna tiene ruta asociada en ' +
        'OpenStreetMap. <b>Es tarea de campo:</b> anotar qué rutas paran ahí es de lo más útil ' +
        'que se puede mapear, porque no está en ninguna parte.</p>';
    }
    return '<p class="pcr-lab">Rutas que recogen acá</p>' +
      '<div class="pcr-rutas">' +
        rutas.slice(0, 12).map(function (r) {
          var etq = r.ref || '·';
          var col = /^#[0-9a-f]{3,8}$/i.test(r.color) ? r.color : '';
          return '<div class="pcr-ruta"' + (col ? ' style="--ruta:' + esc(col) + '"' : '') + '>' +
            '<span class="pcr-ruta-n">' + esc(etq) + '</span>' +
            '<span class="pcr-ruta-nom">' + esc(r.nombre || 'Sin nombre registrado') +
              (r.operador ? '<em>' + esc(r.operador) + '</em>' : '') +
            '</span></div>';
        }).join('') +
      '</div>' +
      '<p class="pcr-pista">Son las rutas que en OpenStreetMap recogen en alguna parada de esta ' +
      'área' + (rutas.length > 12 ? ' (se muestran 12 de ' + rutas.length + ')' : '') + '. ' +
      'El recorrido completo no se dibuja: lo que importa acá es cuántas y cuáles sirven al sector.</p>';
  }

  /* La rosa de orientación de las vías: un histograma polar de hacia dónde
     apuntan las calles, ponderado por su longitud. Una cuadrícula da dos
     pares de pétalos en cruz; un tejido irregular, una flor pareja. Es la
     forma de ver de un golpe lo que el número de «orden» resume.
     Se dibuja con los 18 sectores del motor reflejados a 36, porque una
     calle no tiene sentido: la que va al nororiente va también al
     suroccidente. */
  function rosaDeVias(rosa) {
    if (!rosa || !rosa.length) return '';
    var R = 52, cx = 60, cy = 60;
    var max = rosa.reduce(function (m, x) { return Math.max(m, x.metros); }, 0) || 1;
    var petalos = '';
    for (var vuelta = 0; vuelta < 2; vuelta++) {
      rosa.forEach(function (b) {
        var largo = R * Math.sqrt(b.metros / max);   // raíz: el área del pétalo es la que se compara
        if (largo < 1) return;
        var a1 = (b.desde + vuelta * 180 - 90) * Math.PI / 180;
        var a2 = (b.hasta + vuelta * 180 - 90) * Math.PI / 180;
        var x1 = cx + Math.cos(a1) * largo, y1 = cy + Math.sin(a1) * largo;
        var x2 = cx + Math.cos(a2) * largo, y2 = cy + Math.sin(a2) * largo;
        petalos += '<path d="M' + cx + ' ' + cy + ' L' + x1.toFixed(1) + ' ' + y1.toFixed(1) +
          ' A' + largo.toFixed(1) + ' ' + largo.toFixed(1) + ' 0 0 1 ' +
          x2.toFixed(1) + ' ' + y2.toFixed(1) + ' Z"/>';
      });
    }
    return '<svg class="pcr-rosa" viewBox="0 0 120 120" width="120" height="120" ' +
      'role="img" aria-label="Rosa de orientación de las vías del sector">' +
      '<circle cx="60" cy="60" r="52" class="pcr-rosa-borde"/>' +
      '<circle cx="60" cy="60" r="26" class="pcr-rosa-borde"/>' +
      '<path d="M60 4V116M4 60H116" class="pcr-rosa-eje"/>' +
      '<g class="pcr-rosa-petalos">' + petalos + '</g>' +
      '<text x="60" y="12" class="pcr-rosa-n">N</text>' +
      '</svg>';
  }

  /* El climograma: barras de lluvia y línea de temperatura sobre los doce
     meses. Es el dibujo con el que se lee un clima de un vistazo —dónde está
     la temporada seca y dónde la de lluvias— y el que va en cualquier lámina.
     Las dos escalas son distintas a propósito y por eso van rotuladas: mezclar
     milímetros y grados en un solo eje sería mentir con el dibujo. */
  function climograma(meses) {
    var lista = (meses || []).filter(function (m) { return m.lluvia !== null || m.tMax !== null; });
    if (lista.length < 6) return '';
    var W = 300, H = 120, mIzq = 24, mDer = 24, mAb = 18, mAr = 8;
    var anchoUtil = W - mIzq - mDer;
    var paso = anchoUtil / lista.length;
    var maxLl = Math.max(10, Math.max.apply(null, lista.map(function (m) { return m.lluvia || 0; })));
    var temps = lista.map(function (m) { return m.tMax; }).filter(function (x) { return x !== null; })
      .concat(lista.map(function (m) { return m.tMin; }).filter(function (x) { return x !== null; }));
    var tMin = Math.min.apply(null, temps), tMax = Math.max.apply(null, temps);
    var rangoT = Math.max(4, tMax - tMin);
    var Yll = function (v) { return (H - mAb) - (H - mAb - mAr) * (v / maxLl); };
    var Yt = function (v) { return (H - mAb) - (H - mAb - mAr) * ((v - tMin) / rangoT); };

    var barras = lista.map(function (m, i) {
      if (m.lluvia === null) return '';
      var x = mIzq + i * paso + paso * 0.18, w = paso * 0.64;
      var y = Yll(m.lluvia);
      return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) +
             '" height="' + Math.max(0, (H - mAb) - y).toFixed(1) + '" class="pcr-clima-lluvia"/>';
    }).join('');
    var linea = lista.map(function (m, i) {
      if (m.tMax === null) return '';
      return (i ? 'L' : 'M') + (mIzq + i * paso + paso / 2).toFixed(1) + ' ' + Yt(m.tMax).toFixed(1);
    }).filter(Boolean).join(' ');
    var etiquetas = lista.map(function (m, i) {
      // Solo las iniciales, y una de cada dos en pantallas estrechas: doce
      // etiquetas de tres letras no caben sin encimarse.
      return '<text x="' + (mIzq + i * paso + paso / 2).toFixed(1) + '" y="' + (H - 5) +
             '" class="pcr-clima-mes" text-anchor="middle">' +
             esc(m.nombre.charAt(0).toUpperCase()) + '</text>';
    }).join('');

    return '<div class="pcr-clima-graf">' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" ' +
        'role="img" aria-label="Lluvia y temperatura mes a mes">' +
        barras +
        '<path d="' + linea + '" class="pcr-clima-temp"/>' +
        '<text x="2" y="' + (mAr + 6) + '" class="pcr-clima-eje">' + Math.round(maxLl) + ' mm</text>' +
        '<text x="' + (W - 2) + '" y="' + (mAr + 6) + '" class="pcr-clima-eje" text-anchor="end">' +
          Math.round(tMax) + '°</text>' +
        '<text x="' + (W - 2) + '" y="' + (H - mAb) + '" class="pcr-clima-eje" text-anchor="end">' +
          Math.round(tMin) + '°</text>' +
        etiquetas +
      '</svg>' +
      '<p class="pcr-pista pcr-clima-leyenda">Las barras son la lluvia del mes (izquierda, en mm) ' +
      'y la línea la temperatura máxima media (derecha, en °C). Son dos escalas distintas.</p>' +
    '</div>';
  }

  /* El clima del sitio. No el pronóstico de mañana: promedios de varios años,
     que es lo que decide hacia dónde se abre, cuánto alero se necesita y por
     dónde entra el aire. */
  function bloqueClima() {
    var c = S.clima;
    if (!c) {
      return h4('agua', 'El clima del sitio') +
        '<p class="pcr-pista">Temperatura, lluvia y vientos, promediados de varios años. ' +
        'No es el pronóstico de mañana: es cómo es el sitio.</p>' +
        '<div class="pcr-llevar">' +
          '<button type="button" data-pcr="clima" class="pcr-mini pcr-llevar-b"' +
            (S.cliCargando ? ' disabled' : '') + '>' +
            (S.cliCargando ? 'Consultando…' : ico('agua') + 'Ver el clima del sitio') +
          '</button>' +
        '</div>' +
        (S.cliCargando ? '<p class="pcr-pista" id="pcr-cli-estado">' + esc(S.cliAviso || 'Preparando…') + '</p>' : '') +
        (S.cliAviso && !S.cliCargando ? '<p class="pcr-error">' + esc(S.cliAviso) + '</p>' : '');
    }

    var t = c.temperatura || {}, ll = c.lluvia || {}, vi = c.viento || {};
    return h4('agua', 'El clima del sitio') +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + (t.media != null ? String(t.media).replace('.', ',') + '°' : '—') +
          '</b><small>de temperatura media</small></div>' +
        '<div class="pcr-kpi"><b>' + (ll.anual != null ? ll.anual : '—') +
          '</b><small>mm de lluvia al año</small></div>' +
        '<div class="pcr-kpi"><b>' + (vi.mediaKmh != null ? String(vi.mediaKmh).replace('.', ',') : '—') +
          '</b><small>km/h de viento</small></div>' +
      '</div>' +
      (c.lectura ? '<p class="pcr-conc">' + esc(c.lectura) + '</p>' : '') +
      climograma(c.meses) +
      '<div class="pcr-lote">' +
        (t.masCaliente ? '<div class="pcr-lote-fila"><span>Mes más caliente</span><b>' +
          esc(t.masCaliente.nombre) + ' · ' + String(t.masCaliente.tMax).replace('.', ',') + '°</b></div>' : '') +
        (t.masFresco ? '<div class="pcr-lote-fila"><span>Mes más fresco</span><b>' +
          esc(t.masFresco.nombre) + ' · ' + String(t.masFresco.tMax).replace('.', ',') + '°</b></div>' : '') +
        (ll.masLluvioso ? '<div class="pcr-lote-fila"><span>Mes más lluvioso</span><b>' +
          esc(ll.masLluvioso.nombre) + ' · ' + ll.masLluvioso.lluvia + ' mm</b></div>' : '') +
        (ll.masSeco ? '<div class="pcr-lote-fila"><span>Mes más seco</span><b>' +
          esc(ll.masSeco.nombre) + ' · ' + ll.masSeco.lluvia + ' mm</b></div>' : '') +
        (ll.diasConLluviaPct != null ? '<div class="pcr-lote-fila"><span>Días con lluvia</span><b>' +
          ll.diasConLluviaPct + '% del año</b></div>' : '') +
        (vi.dominante ? '<div class="pcr-lote-fila"><span>El viento viene del</span><b>' +
          esc(vi.dominante.rumbo) + ' (' + vi.dominante.pct + '%)</b></div>' : '') +
      '</div>' +
      (vi.dominante
        ? '<p class="pcr-conc">El viento entra sobre todo por el <b>' + esc(vi.dominante.rumbo) +
          '</b>. Es por donde conviene abrir para ventilar — y por donde llega el ruido y el polvo ' +
          'de lo que haya en esa dirección.</p>'
        : '') +
      '<p class="pcr-pista">' + esc(c.advertencia || '') +
      (c.periodo ? ' Promedios de ' + esc(String(c.periodo.desde || '')) + ' a ' +
        esc(String(c.periodo.hasta || '')) + '.' : '') + '</p>';
  }

  /* El corte del terreno, dibujado. Un perfil es la silueta que se vería si
     se cortara el sector con un cuchillo por esa línea: el tramo que está
     DENTRO del área va lleno y el de fuera apenas insinuado, para que se
     entienda dónde empieza y termina lo analizado. */
  function perfilDibujado(p) {
    var pts = (p && p.puntos) || [];
    if (pts.length < 3) return '';
    var W = 300, H = 84, mIzq = 30, mAb = 16;
    var zs = pts.map(function (x) { return x.z; });
    var zMin = Math.min.apply(null, zs), zMax = Math.max.apply(null, zs);
    var dMax = pts[pts.length - 1].d || 1;
    // Con un terreno plano el rango sería cero y todo se dibujaría en una
    // raya: se le da un mínimo de 10 m para que la silueta se vea.
    var rango = Math.max(10, zMax - zMin);
    var X = function (d) { return mIzq + (W - mIzq - 4) * (d / dMax); };
    var Y = function (z) { return (H - mAb) - (H - mAb - 8) * ((z - zMin) / rango); };

    var linea = pts.map(function (x, i) { return (i ? 'L' : 'M') + X(x.d).toFixed(1) + ' ' + Y(x.z).toFixed(1); }).join(' ');
    var relleno = linea + ' L' + X(dMax).toFixed(1) + ' ' + (H - mAb) + ' L' + X(0).toFixed(1) + ' ' + (H - mAb) + ' Z';
    // El tramo de dentro del área, marcado sobre el eje.
    var dentro = pts.filter(function (x) { return x.dentro; });
    var marca = dentro.length
      ? '<path d="M' + X(dentro[0].d).toFixed(1) + ' ' + (H - mAb + 3) + ' L' +
        X(dentro[dentro.length - 1].d).toFixed(1) + ' ' + (H - mAb + 3) + '" class="pcr-perfil-dentro"/>'
      : '';
    return '<div class="pcr-perfil">' +
      '<span class="pcr-lab">' + esc(p.etiqueta) + '</span>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" preserveAspectRatio="none" ' +
        'role="img" aria-label="Perfil del terreno ' + esc(p.etiqueta) + '">' +
        '<path d="' + relleno + '" class="pcr-perfil-area"/>' +
        '<path d="' + linea + '" class="pcr-perfil-linea"/>' +
        marca +
        '<text x="2" y="12" class="pcr-perfil-n">' + Math.round(zMax) + '</text>' +
        '<text x="2" y="' + (H - mAb) + '" class="pcr-perfil-n">' + Math.round(zMin) + '</text>' +
        '<text x="' + (W - 4) + '" y="' + (H - 3) + '" class="pcr-perfil-n" text-anchor="end">' +
          Math.round(dMax) + ' m</text>' +
      '</svg></div>';
  }

  /* El terreno. En un lote de ladera esto manda sobre casi todo lo demás:
     decide por dónde corre el agua, cuánto cuesta construir y qué parte no se
     puede ocupar. Hasta ahora el análisis no lo miraba. */
  function bloqueTerreno() {
    var t = S.terreno;
    if (!t) {
      return h4('crecer', 'El terreno') +
        '<p class="pcr-pista">Alturas, pendiente, hacia dónde baja la ladera y dos cortes del ' +
        'terreno. Se mide aparte porque hay que consultar la altura de una rejilla de puntos ' +
        'sobre el área.</p>' +
        '<div class="pcr-llevar">' +
          '<button type="button" data-pcr="terreno" class="pcr-mini pcr-llevar-b"' +
            (S.terCargando ? ' disabled' : '') + '>' +
            (S.terCargando ? 'Midiendo…' : ico('crecer') + 'Medir el terreno') +
          '</button>' +
        '</div>' +
        (S.terCargando ? '<p class="pcr-pista" id="pcr-ter-estado">' + esc(S.terAviso || 'Preparando…') + '</p>' : '') +
        (S.terAviso && !S.terCargando ? '<p class="pcr-error">' + esc(S.terAviso) + '</p>' : '');
    }

    var e = t.elevacion || {}, p = t.pendiente || {};
    var mayor = (p.clases || []).reduce(function (m, x) { return Math.max(m, x.pct); }, 0) || 1;
    return h4('crecer', 'El terreno') +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + e.min + '</b><small>msnm, lo más bajo</small></div>' +
        '<div class="pcr-kpi"><b>' + e.max + '</b><small>msnm, lo más alto</small></div>' +
        '<div class="pcr-kpi"><b>' + e.relieve + ' m</b><small>de desnivel</small></div>' +
      '</div>' +
      '<p class="pcr-conc">' + esc(t.lectura || '') +
        ' La pendiente media es del <b>' + String(p.media).replace('.', ',') + '%</b>' +
        (p.maxima ? ' y llega al ' + String(p.maxima).replace('.', ',') + '%' : '') + '.' +
        (t.orientacion
          ? ' El terreno baja sobre todo hacia el <b>' + esc(t.orientacion.rumbo) + '</b> (' +
            t.orientacion.pct + '% del área): por ahí corre el agua.'
          : '') + '</p>' +

      '<p class="pcr-lab">Cuánto del área tiene cada pendiente</p>' +
      '<div class="pcr-niveles">' +
        (p.clases || []).map(function (c) {
          return '<div class="pcr-nivel">' +
            '<span class="pcr-nivel-nom">' + esc(c.etiqueta) + '</span>' +
            '<span class="pcr-nivel-barra"><i style="width:' + Math.round(100 * c.pct / mayor) + '%"></i></span>' +
            '<span class="pcr-nivel-n">' + String(c.pct).replace('.', ',') + '<em>%</em></span>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<ul class="pcr-check">' +
        (p.clases || []).map(function (c) {
          return '<li><b>' + esc(c.etiqueta) + '</b> — ' + esc(c.que) + '</li>';
        }).join('') +
      '</ul>' +

      '<p class="pcr-lab">Cortes del terreno</p>' +
      (t.perfiles || []).map(perfilDibujado).join('') +

      '<p class="pcr-pista">Las alturas salen de un modelo de <b>' + t.resolucionM + ' metros de paso</b> (' +
      esc(t.fuente || '') + '). Sirve para leer el relieve del sector; <b>no</b> para dar la cota de una ' +
      'esquina ni para un diseño: entre dos puntos de la rejilla el terreno puede hacer cualquier cosa. ' +
      'La medida fina se levanta con topografía en campo.</p>';
  }

  /* Trazado urbano: llenos y vacíos, jerarquía de las vías y morfología. Los
     tres salen de la misma consulta —la que trae la forma de las cosas— así
     que van en un solo bloque, detrás de un solo botón. */
  function bloqueTrazado() {
    var t = S.trazado;
    if (!t) {
      return h4('capas', 'El trazado del sector') +
        '<p class="pcr-pista">Llenos y vacíos, jerarquía de las vías y morfología de la traza. ' +
        'Se mide aparte porque hay que traer <b>la forma</b> de cada edificio y cada calle del ' +
        'área, y eso pesa bastante más que traer sus puntos.</p>' +
        '<div class="pcr-llevar">' +
          '<button type="button" data-pcr="trazado" class="pcr-mini pcr-llevar-b"' +
            (S.trzCargando ? ' disabled' : '') + '>' +
            (S.trzCargando ? 'Midiendo…' : ico('area') + 'Medir el trazado del sector') +
          '</button>' +
        '</div>' +
        (S.trzCargando ? '<p class="pcr-pista" id="pcr-trz-estado">' + esc(S.trzAviso || 'Preparando…') + '</p>' : '') +
        (S.trzAviso && !S.trzCargando ? '<p class="pcr-error">' + esc(S.trzAviso) + '</p>' : '');
    }

    var ll = t.llenos || {}, vi = t.vias || {}, mo = t.morfologia || {};
    var mallas = vi.porMalla || [];
    return h4('capas', 'El trazado del sector') +

      // ── Llenos y vacíos
      '<p class="pcr-lab">Llenos y vacíos</p>' +
      '<div class="pcr-llenos">' +
        '<div class="pcr-llenos-barra">' +
          '<i class="pcr-lleno" style="width:' + ll.pctLleno + '%"></i>' +
          '<i class="pcr-vacio" style="width:' + ll.pctVacio + '%"></i>' +
        '</div>' +
        '<div class="pcr-llenos-cifras">' +
          '<span><b>' + ll.pctLleno + '%</b> lleno</span>' +
          '<span><b>' + ll.pctVacio + '%</b> vacío</span>' +
        '</div>' +
      '</div>' +
      ((S.trzHuellas && S.trzHuellas.length)
        ? '<button type="button" data-pcr="llenos-mapa" class="pcr-mini">' +
            (S.llenosEnMapa ? ico('apagar', 16) + 'Quitar del mapa'
                            : ico('mapa', 16) + 'Ver los llenos en el mapa') + '</button>'
        : '') +
      '<p class="pcr-pista">' + (ll.edificios || 0) + ' edificio' + (ll.edificios === 1 ? '' : 's') +
        ' en el área. ' +
        (ll.sinGeometria
          ? '<b>' + ll.conGeometria + '</b> tienen forma registrada y suman ' +
            formatearM2(ll.areaConstruidaM2) + ' construidos; ' +
            (ll.sinGeometria === 1 ? 'el otro está mapeado' : 'los otros ' + ll.sinGeometria + ' están mapeados') +
            ' solo como punto y no suma' + (ll.sinGeometria === 1 ? '' : 'n') + ' área, ' +
            'así que el porcentaje es de los que sí tienen forma.'
          : 'Suman ' + formatearM2(ll.areaConstruidaM2) + ' construidos. Se cuenta el edificio ' +
            'entero cuando su centro cae dentro del área.') + '</p>' +

      // ── Jerarquía vial
      '<p class="pcr-lab">Jerarquía de las vías</p>' +
      (mallas.length
        ? '<div class="pcr-niveles">' +
            mallas.map(function (m) {
              return '<div class="pcr-nivel">' +
                '<span class="pcr-nivel-nom">' + esc(m.etiqueta) + '</span>' +
                '<span class="pcr-nivel-barra"><i style="width:' + m.pct + '%"></i></span>' +
                '<span class="pcr-nivel-n">' + String(m.km).replace('.', ',') + '<em>km</em></span>' +
              '</div>';
            }).join('') +
          '</div>'
        : '<p class="pcr-pista">Sin vías con forma registrada en el área.</p>') +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + String(vi.kmTotal || 0).replace('.', ',') + '</b><small>km de vía</small></div>' +
        '<div class="pcr-kpi"><b>' + (vi.unSentidoPct || 0) + '%</b><small>en un sentido</small></div>' +
        '<div class="pcr-kpi"><b>' + (vi.sinNombre || 0) + '</b><small>tramo' +
          (vi.sinNombre === 1 ? '' : 's') + ' sin nombre</small></div>' +
      '</div>' +
      (vi.sinNombre
        ? '<p class="pcr-pista">' +
          (vi.sinNombre === 1
            ? 'Ese tramo sin nombre es tarea de campo'
            : 'Esos ' + vi.sinNombre + ' tramos sin nombre son tarea de campo') +
          ': ponerle nombre a una calle es de lo más útil que se puede mapear.</p>'
        : '') +

      // ── Morfología
      '<p class="pcr-lab">Morfología de la traza</p>' +
      '<div class="pcr-morfo">' +
        rosaDeVias(mo.rosa) +
        '<div class="pcr-morfo-datos">' +
          '<div class="pcr-lote-fila"><span>Intersecciones</span><b>' + (mo.intersecciones || 0) + '</b></div>' +
          '<div class="pcr-lote-fila"><span>Por km²</span><b>' + (mo.porKm2 || 0) + '</b></div>' +
          '<div class="pcr-lote-fila"><span>Tramo medio</span><b>' + (mo.tramoMedioM || 0) + ' m</b></div>' +
          '<div class="pcr-lote-fila"><span>Calles sin salida</span><b>' + (mo.sinSalida || 0) + '</b></div>' +
        '</div>' +
      '</div>' +
      '<p class="pcr-conc">' + esc(mo.lectura || '') + '</p>' +
      '<p class="pcr-pista">La rosa mide hacia dónde apuntan las calles, pesando cada una por su ' +
      'longitud. Dos pares de pétalos en cruz es una cuadrícula; una flor pareja, un tejido que ' +
      'creció por adición. El número de orden va de 0 —ninguna dirección manda— a 1 —todas la ' +
      'misma—: acá da <b>' + (mo.orden != null ? String(mo.orden).replace('.', ',') : '—') + '</b>.</p>';
  }


  /* ── Espacio público efectivo ──────────────────────────────────────────
     Cuántos metros cuadrados de parque, plaza y cancha tiene el sector, y
     cuántos le tocan a cada habitante. La cifra por habitante es la que se
     discute en un consejo municipal, y la meta con la que se compara no es
     opinión: el Decreto 1504 de 1998 fija 15 m² por habitante.

     Sale del mismo viaje que el trazado —es la misma geometría— así que no
     cuesta ninguna consulta más. Lo que sí hay que decir, y se dice, es que
     solo cuenta lo que alguien mapeó: un parque que existe y no está en
     OpenStreetMap deja el sector peor de lo que está, y eso se arregla
     mapeándolo, que es justamente el trabajo del curso. */
  function bloqueEspacio(st) {
    var t = S.trazado;
    if (!t || !t.espacio) return '';
    var e = t.espacio;
    var hab = Number((st && st.poblacionEstimada) || 0);
    var porHab = hab > 0 ? Math.round(10 * e.areaM2 / hab) / 10 : null;
    var meta = e.metaM2Hab || 15;
    var pctMeta = porHab != null ? Math.min(100, Math.round(100 * porHab / meta)) : 0;

    if (!e.piezas) {
      return h4('verde', 'Espacio público efectivo') +
        '<p class="pcr-conc">No hay <b>ningún</b> parque, plaza ni cancha con forma registrada ' +
        'dentro del área.</p>' +
        '<p class="pcr-pista">Eso no significa que no exista: significa que nadie lo ha mapeado. ' +
        'Es de lo más útil que puede levantar el curso, porque sin el polígono no hay metros ' +
        'cuadrados y sin metros cuadrados no hay indicador que discutir.</p>';
    }

    return h4('verde', 'Espacio público efectivo') +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + String(e.areaHa).replace('.', ',') + '</b><small>hectáreas de espacio público</small></div>' +
        '<div class="pcr-kpi"><b>' + String(e.pctDelSector).replace('.', ',') + '%</b><small>del área del sector</small></div>' +
        '<div class="pcr-kpi"><b>' + (porHab != null ? String(porHab).replace('.', ',') : '—') +
          '</b><small>m² por habitante</small></div>' +
      '</div>' +
      (porHab != null
        ? medidor('Frente a la meta nacional (' + meta + ' m²/hab)', pctMeta,
            (porHab >= meta
              ? 'El sector cumple la meta del Decreto 1504 de 1998.'
              : porHab >= meta / 2
                ? 'Por debajo de la meta del Decreto 1504 de 1998: le falta cerca de la mitad.'
                : 'Muy por debajo de la meta del Decreto 1504 de 1998. Es el dato con el que se ' +
                  'pide un parque.'),
            '#22c55e') +
          '<p class="pcr-pista">Se usa la población estimada del sector (' +
          hab.toLocaleString('es-CO') + ' habitantes, del censo del DANE repartido por área). ' +
          'Si el área es pequeña, ese reparto tiene bastante margen y el m² por habitante lo ' +
          'hereda.</p>'
        : '<p class="pcr-pista">Sin población estimada no se puede sacar el metro cuadrado por ' +
          'habitante, que es la cifra que compara el Decreto 1504 de 1998.</p>') +
      (e.porClase && e.porClase.length
        ? '<p class="pcr-lab">De qué está hecho</p>' +
          '<div class="pcr-niveles">' +
            e.porClase.map(function (c) {
              return '<div class="pcr-nivel">' +
                '<span class="pcr-nivel-nom">' + esc(c.etiqueta) + '</span>' +
                '<span class="pcr-nivel-barra"><i style="width:' + c.pct + '%"></i></span>' +
                '<span class="pcr-nivel-n">' + formatearM2(c.areaM2) + '</span>' +
              '</div>';
            }).join('') +
          '</div>'
        : '') +
      ((e.mayores || []).length
        ? '<p class="pcr-lab">Las piezas más grandes</p>' +
          e.mayores.slice(0, 6).map(function (x) {
            return '<div class="pcr-lote-fila"><span>' +
              esc(x.nombre || x.tipo) + (x.nombre ? ' · ' + esc(x.tipo.toLowerCase()) : '') +
              '</span><b>' + formatearM2(x.areaM2) + '</b></div>';
          }).join('')
        : '') +
      '<p class="pcr-pista">Cuenta parques, plazas, zonas verdes y escenarios deportivos de uso ' +
      'público con forma mapeada. <b>No</b> cuenta andenes ni vías: son espacio público, pero el ' +
      'decreto no los llama efectivo. Tampoco cuenta lo privado ni lo que nadie ha mapeado.</p>';
  }


  /* ── A distancia de caminar ────────────────────────────────────────────
     No cuántos colegios hay: qué parte del sector tiene uno cerca. Son dos
     preguntas distintas y la segunda es la que decide dónde falta algo. Un
     sector puede tener tres colegios juntos en una esquina y media población
     a veinte minutos del más cercano.

     El motor reparte puntos de muestreo por dentro del área y pregunta desde
     cada uno. Acá se muestra el resultado y, sobre todo, lo que el número NO
     dice: mide en línea recta, cuenta solo lo que está dentro del área y solo
     lo que alguien mapeó. */
  function bloqueAccesibilidad(st) {
    var a = st && st.accesibilidad;
    if (!a || !a.categorias || !a.categorias.length) return '';
    var hab = Number(st.poblacionEstimada || 0);
    var cats = a.categorias;
    var peor = cats.slice().sort(function (x, y) { return x.pctCubierto - y.pctCubierto; })[0];

    return h4('caminar', 'A distancia de caminar') +
      '<p class="pcr-pista">Qué parte del área tiene cada cosa cerca. No es lo mismo que ' +
      'cuántas hay: tres colegios en la misma esquina dejan media población lejos.</p>' +
      '<div class="pcr-niveles">' +
        cats.map(function (c) {
          return '<div class="pcr-nivel">' +
            '<span class="pcr-nivel-nom">' + esc(c.etiqueta) +
              '<small class="pcr-nivel-sub">' + c.minutos + ' min · ' + c.radioM + ' m</small></span>' +
            '<span class="pcr-nivel-barra"><i style="width:' + c.pctCubierto + '%"></i></span>' +
            '<span class="pcr-nivel-n">' + String(c.pctCubierto).replace('.', ',') + '<em>%</em></span>' +
          '</div>';
        }).join('') +
      '</div>' +
      (peor
        ? '<p class="pcr-conc">Lo que más falta es <b>' + esc(peor.etiqueta.toLowerCase()) + '</b>: ' +
          (peor.puntos === 0
            ? 'no hay ninguno registrado dentro del área.'
            : String(peor.pctSinCubrir).replace('.', ',') + '% del sector queda a más de ' +
              peor.radioM + ' m del más cercano' +
              (hab > 0
                ? ', unos <b>' + Math.round(hab * peor.pctSinCubrir / 100).toLocaleString('es-CO') +
                  ' habitantes</b>'
                : '') + '.') +
          '</p>'
        : '') +
      cats.filter(function (c) { return c.puntos > 0 && (c.ejemplos || []).length; })
        .map(function (c) {
          return '<div class="pcr-lote-fila"><span>' + esc(c.etiqueta) + '</span><b>' +
            c.puntos + ' en el área</b></div>';
        }).join('') +
      '<p class="pcr-pista">Tres advertencias que cambian la lectura. La distancia se mide ' +
      '<b>en línea recta</b>: caminando siempre es más, porque hay manzanas y vías que no se ' +
      'cruzan. Solo cuenta lo que está <b>dentro del área</b>: un colegio a media cuadra por ' +
      'fuera del borde no entra, así que si el equipamiento está justo afuera, dibujá el área ' +
      'un poco más grande. Y solo cuenta lo <b>mapeado</b>. ' + esc(a.metodo || '') + '</p>';
  }


  /* ── Síntesis del sector ───────────────────────────────────────────────
     Hasta acá la ficha entrega treinta cifras. Una lámina de análisis no se
     defiende con cifras sueltas: se defiende con cuatro o cinco frases que
     digan qué le pasa a este sector, cada una con el número que la sostiene.
     Eso es lo que arma este bloque.

     Regla de oro: NO inventa. Cada frase nace de un dato medido y se apaga
     sola si ese dato no está. Un sector al que no se le midió el terreno no
     dice nada del terreno —ni bien ni mal—, y la tercera columna, «lo que
     falta levantar», es tan parte de la síntesis como las otras dos: es la
     tarea del curso escrita como tarea.

     Devuelve listas en vez de HTML porque la usan tres superficies distintas
     —la ficha, la lámina y el PDF— y cada una la pinta a su manera. */
  function sintesisDelSector(res) {
    var st = (res && res.stats) || {}, meta = (res && res.meta) || {};
    var trz = S.trazado, ter = S.terreno, cli = S.clima;
    var favor = [], contra = [], falta = [];
    var F = function (t, d) { favor.push({ texto: t, dato: d }); };
    var C = function (t, d) { contra.push({ texto: t, dato: d }); };
    var T = function (t, d) { falta.push({ texto: t, dato: d }); };
    var num = function (x) { return String(x).replace('.', ','); };

    // ── Mezcla de usos
    var m = st.mezcla;
    if (m && m.usos >= 1) {
      if (m.indice >= 0.55) F('Usos mezclados: hay actividad a distintas horas', 'índice ' + num(m.indice));
      else if (m.indice < 0.35) C('Sector monofuncional: se vacía a ciertas horas', 'índice ' + num(m.indice));
    }

    // ── Cuánto hay
    if (st.densidadPorHa != null) {
      if (st.densidadPorHa >= 12) F('Actividad concentrada, se recorre a pie', num(st.densidadPorHa) + ' usos por hectárea');
      else if (st.densidadPorHa < 3) C('Muy poca actividad registrada por hectárea', num(st.densidadPorHa) + ' por ha');
    }

    // ── Espacio público
    var e = trz && trz.espacio;
    var hab = Number(st.poblacionEstimada || 0);
    if (e) {
      var meta1504 = e.metaM2Hab || 15;
      var porHab = hab > 0 ? Math.round(10 * e.areaM2 / hab) / 10 : null;
      if (!e.piezas) {
        C('Sin parques ni plazas con forma registrada en el área', '0 m² de espacio público');
        T('Dibujar los parques y canchas que sí existen: sin el polígono no hay metros cuadrados', 'espacio público');
      } else if (porHab != null && porHab < meta1504 / 2) {
        C('Espacio público muy por debajo de la meta nacional', num(porHab) + ' de ' + meta1504 + ' m²/hab');
      } else if (porHab != null && porHab >= meta1504) {
        F('Cumple la meta nacional de espacio público', num(porHab) + ' m²/hab');
      }
    }

    // ── Cobertura de equipamientos
    var ac = st.accesibilidad;
    if (ac && (ac.categorias || []).length) {
      var peor = ac.categorias.slice().sort(function (a, b) { return a.pctCubierto - b.pctCubierto; })[0];
      var todas = ac.categorias.every(function (c) { return c.pctCubierto >= 80; });
      if (todas) F('Todo lo básico queda a distancia de caminar', 'las cuatro coberturas sobre 80%');
      else if (peor && peor.pctCubierto < 50) {
        C('Falta ' + peor.etiqueta.toLowerCase() + ' a distancia de caminar',
          num(peor.pctCubierto) + '% del área cubierta' +
          (hab > 0 ? ' · ' + Math.round(hab * peor.pctSinCubrir / 100).toLocaleString('es-CO') + ' hab. lejos' : ''));
      }
    }

    // ── Cómo se llega
    var mv = st.movilidad;
    if (mv) {
      if ((mv.rutas || []).length) F('Pasa transporte público por el área', (mv.rutas || []).length + ' rutas registradas');
      else if (mv.paradasBus === 0) C('Sin paradas de transporte público registradas', '0 paradas');
      if (mv.nViasArterias > 0) F('Conectado a la malla arterial de la ciudad', mv.nViasArterias + ' vías principales');
    }

    // ── El trazado
    if (trz) {
      var mo = trz.morfologia || {}, ll = trz.llenos || {};
      if (mo.orden >= 0.35 && mo.perpendicular) F('Traza en cuadrícula: fácil de recorrer y de orientarse', 'orden ' + num(mo.orden));
      else if (mo.orden != null && mo.orden < 0.18) C('Traza irregular: crecimiento por adición, difícil de recorrer', 'orden ' + num(mo.orden));
      if (mo.tramoMedioM && mo.tramoMedioM > 200) C('Manzanas largas: pocas esquinas donde cruzar', mo.tramoMedioM + ' m entre cruces');
      if (ll.pctLleno != null && ll.pctLleno < 15 && ll.conGeometria > 10)
        F('Queda suelo sin construir dentro del área', num(ll.pctVacio) + '% libre');
      if (ll.sinGeometria > ll.conGeometria)
        T('Dibujar la forma de los edificios mapeados solo como punto', ll.sinGeometria + ' sin forma');

      var pf = trz.perfil;
      if (pf && pf.relacion != null) {
        if (pf.relacion >= 1)
          F('Calle contenida: la altura acompaña al ancho', 'relación ' + num(pf.relacion));
        else if (pf.relacion < 0.5)
          C('Calle ancha para lo poco construido: escala de vehículo', 'relación ' + num(pf.relacion));
      }
      if (pf && pf.anden) {
        if (pf.anden.sinAndenPct >= 20)
          C('Vías sin andén registrado: no se puede caminar por todas partes',
            num(pf.anden.sinAndenPct) + '% de la vía');
        if (pf.anden.sinDatoPct >= 50)
          T('Caminar el sector anotando dónde hay andén y dónde no',
            num(pf.anden.sinDatoPct) + '% sin dato');
      }
    }

    // ── El terreno
    if (ter) {
      var pe = ter.pendiente || {}, el = ter.elevacion || {};
      if (pe.media != null && pe.media >= 12)
        C('Pendiente fuerte: condiciona calles, accesos y costos', num(pe.media) + '% de pendiente media');
      else if (pe.media != null && pe.media < 5)
        F('Terreno plano: sin sobrecostos de topografía', num(pe.media) + '% de pendiente media');
      if (el.relieve != null && el.relieve >= 60)
        C('Desnivel alto de un extremo al otro', el.relieve + ' m de desnivel');
      if (ter.orientacion && ter.orientacion.rumbo)
        F('La ladera baja hacia el ' + ter.orientacion.rumbo + ': por ahí corre el agua', 'orientación medida');
    }

    // ── El clima y el sol
    if (cli) {
      var t = cli.temperatura || {}, vi = cli.viento || {};
      if (t.media != null && t.media >= 26)
        C('Clima cálido: sin sombra ni aire cruzado no se puede estar afuera', num(t.media) + '° de media');
      if (vi.dominante && vi.dominante.rumbo)
        F('El viento entra del ' + vi.dominante.rumbo + ': por ahí se ventila', vi.dominante.pct + '% del tiempo');
    }
    var SOL = window.URBIS_SOLAR;
    if (SOL && meta.lat != null) {
      try {
        var sol = SOL.dia(new Date(), Number(meta.lat), Number(meta.lng));
        if (sol && sol.alturaMaxima != null) {
          C('La fachada occidental recibe el sol bajo de la tarde: es la que hay que proteger',
            sol.alturaMaxima + '° al mediodía');
        }
      } catch (err) {}
    }

    // ── Lo levantado en campo
    var cp = S.campo;
    if (cp) {
      var nv = (cp.nuevos || []).length, ds = (cp.discrepancias || []).length;
      var cf = (cp.confirmados || []).length, sv = (cp.sinVerificar || []).length;
      if (nv) F('El curso encontró usos que no estaban en el mapa', nv + ' nuevos');
      if (cf + ds > 0 && cf >= (cf + ds) * 0.8)
        F('Lo que se revisó en la calle coincide con el mapa', cf + ' de ' + (cf + ds));
      if (ds) C('El mapa y la calle no coinciden en varios puntos', ds + ' por corregir');
      if (sv) T('Recorrer las cuadras donde quedan registros sin verificar', sv + ' sin verificar');
    } else if (puntosDelCurso().length) {
      T('Comparar el análisis con lo que ya mapeó el curso', puntosDelCurso().length + ' puntos sin cruzar');
    }

    // ── Lo que falta levantar en campo
    var al = st.alturas || (trz && trz.alturas);
    if (al && al.edificios && al.cobertura < 50)
      T('Contar los pisos de los edificios: hoy solo se sabe de una parte',
        al.cobertura + '% con altura registrada');
    if (trz && (trz.vias || {}).sinNombre)
      T('Ponerle nombre a las calles sin nombre', trz.vias.sinNombre + ' tramos');
    if ((st.porGrupo || {}).otro)
      T('Definir la categoría de los usos que quedaron sin clasificar', st.porGrupo.otro + ' puntos');
    if (!trz) T('Medir el trazado del sector: llenos y vacíos, vías y morfología', 'sin medir');
    if (!ter) T('Medir el terreno: cotas, pendiente y perfiles', 'sin medir');
    if (!cli) T('Medir el clima del sitio', 'sin medir');

    return { favor: favor, contra: contra, falta: falta };
  }

  function bloqueSintesis(res) {
    var s2 = sintesisDelSector(res);
    if (!s2.favor.length && !s2.contra.length && !s2.falta.length) return '';
    var col = function (titulo, lista, clase) {
      if (!lista.length) return '';
      return '<p class="pcr-lab">' + esc(titulo) + '</p>' +
        '<ul class="pcr-sintesis pcr-sintesis-' + clase + '">' +
          lista.map(function (x) {
            return '<li><span>' + esc(x.texto) + '</span><b>' + esc(x.dato) + '</b></li>';
          }).join('') +
        '</ul>';
    };
    return h4('lista', 'Síntesis del sector') +
      '<p class="pcr-pista">Lo que dicen juntas todas las mediciones. Cada frase trae el número que ' +
      'la sostiene, y solo aparece si ese número se midió.</p>' +
      col('Lo que juega a favor', s2.favor, 'bien') +
      col('Lo que juega en contra', s2.contra, 'mal') +
      col('Lo que falta levantar en campo', s2.falta, 'falta');
  }


  /* ── El perfil de la calle ─────────────────────────────────────────────
     Lo alto que está construido contra lo ancho que es la calle. Es la medida
     que explica por qué una cuadra se siente un sitio y la siguiente un
     descampado, y es de lo que siempre lleva una lámina de análisis urbano.

     Va con un dibujo de la sección porque el número solo no se entiende: dos
     edificios enfrentados y la calzada entre ellos, a escala. El dibujo se
     arma con los promedios del sector, así que es una sección TIPO, no la de
     una calle concreta; se dice.

     Y se dice también sobre qué parte de la vía hay dato. En OpenStreetMap el
     ancho y los andenes están mapeados en muy pocas calles de Cúcuta: si la
     cobertura es baja, el promedio es de esas pocas y no del sector. Anotarlo
     caminando es de las tareas de campo que más cambian este bloque. */
  function seccionDibujada(p) {
    if (!p || p.alturaMediaM == null || p.anchoMedioM == null) return '';
    var W = 320, H = 150, base = H - 26;
    // Escala: que la calzada más los dos edificios entren en el ancho útil.
    var anchoEdif = Math.max(18, p.anchoMedioM * 0.75);
    var totalM = p.anchoMedioM + 2 * anchoEdif;
    var k = (W - 24) / totalM;
    var hPx = Math.min(base - 18, p.alturaMediaM * k);
    var calzPx = p.anchoMedioM * k, edifPx = anchoEdif * k;
    var x0 = 12, x1 = x0 + edifPx, x2 = x1 + calzPx, x3 = x2 + edifPx;
    var cota = function (xa, xb, txt) {
      var y = base + 13, m = (xa + xb) / 2;
      return '<path d="M' + xa.toFixed(1) + ' ' + y + 'H' + xb.toFixed(1) + '" class="pcr-sec-cota"/>' +
        '<path d="M' + xa.toFixed(1) + ' ' + (y - 3) + 'v6M' + xb.toFixed(1) + ' ' + (y - 3) + 'v6" class="pcr-sec-cota"/>' +
        '<text x="' + m.toFixed(1) + '" y="' + (y + 11) + '" class="pcr-sec-t" text-anchor="middle">' + esc(txt) + '</text>';
    };
    return '<div class="pcr-seccion"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
      'aria-label="Sección tipo de la calle">' +
      '<path d="M' + x0 + ' ' + base + 'H' + x3.toFixed(1) + '" class="pcr-sec-suelo"/>' +
      '<rect x="' + x0 + '" y="' + (base - hPx).toFixed(1) + '" width="' + edifPx.toFixed(1) +
        '" height="' + hPx.toFixed(1) + '" class="pcr-sec-edif"/>' +
      '<rect x="' + x2.toFixed(1) + '" y="' + (base - hPx).toFixed(1) + '" width="' + edifPx.toFixed(1) +
        '" height="' + hPx.toFixed(1) + '" class="pcr-sec-edif"/>' +
      '<path d="M' + (x1 + 4).toFixed(1) + ' ' + (base - hPx).toFixed(1) + 'v' + hPx.toFixed(1) +
        '" class="pcr-sec-alt"/>' +
      '<text x="' + (x1 + 8).toFixed(1) + '" y="' + (base - hPx / 2).toFixed(1) + '" class="pcr-sec-t">' +
        String(p.alturaMediaM).replace('.', ',') + ' m</text>' +
      cota(x1, x2, String(p.anchoMedioM).replace('.', ',') + ' m de calzada') +
      '</svg></div>';
  }

  function bloquePerfil() {
    var t = S.trazado, p = t && t.perfil;
    if (!p) return '';
    var an = p.anden || {};
    return h4('via', 'El perfil de la calle') +
      (p.relacion != null
        ? '<div class="pcr-kpis">' +
            '<div class="pcr-kpi"><b>' + String(p.relacion).replace('.', ',') + '</b><small>altura ÷ ancho de calzada</small></div>' +
            '<div class="pcr-kpi"><b>' + String(p.alturaMediaM).replace('.', ',') + '</b><small>m de altura media</small></div>' +
            '<div class="pcr-kpi"><b>' + String(p.anchoMedioM).replace('.', ',') + '</b><small>m de calzada</small></div>' +
          '</div>' +
          seccionDibujada(p) +
          '<p class="pcr-conc">' + esc(p.lectura) + '</p>'
        : '<p class="pcr-pista">' + esc(p.lectura) + '</p>') +

      (p.porMalla && p.porMalla.length
        ? '<p class="pcr-lab">Ancho de calzada por jerarquía</p>' +
          p.porMalla.map(function (m) {
            return '<div class="pcr-lote-fila"><span>' + esc(m.etiqueta) + '</span><b>' +
              String(m.anchoM).replace('.', ',') + ' m</b></div>';
          }).join('')
        : '') +

      '<p class="pcr-lab">Andenes</p>' +
      '<div class="pcr-llenos">' +
        '<div class="pcr-llenos-barra">' +
          '<i class="pcr-lleno" style="width:' + an.conAndenPct + '%"></i>' +
          '<i class="pcr-vacio" style="width:' + (100 - an.conAndenPct - an.sinDatoPct) + '%"></i>' +
          '<i class="pcr-sindato" style="width:' + an.sinDatoPct + '%"></i>' +
        '</div>' +
        '<div class="pcr-llenos-cifras">' +
          '<span><b>' + String(an.conAndenPct).replace('.', ',') + '%</b> con andén</span>' +
          '<span><b>' + String(an.sinAndenPct).replace('.', ',') + '%</b> sin andén</span>' +
          '<span><b>' + String(an.sinDatoPct).replace('.', ',') + '%</b> sin dato</span>' +
        '</div>' +
      '</div>' +
      (an.sinDatoPct >= 50
        ? '<p class="pcr-conc">De <b>' + String(an.sinDatoPct).replace('.', ',') + '%</b> de las vías nadie ' +
          'ha dicho si tienen andén. Caminar el sector anotando dónde hay y dónde no es un levantamiento ' +
          'de una tarde, y es el que más cambia lo que se puede decir de la caminabilidad.</p>'
        : '') +

      '<p class="pcr-pista">El dibujo es una <b>sección tipo</b>, armada con los promedios del ' +
      'sector: no es la de una calle concreta. El ancho es el de la <b>calzada</b>, no de fachada a fachada: en ' +
      'OpenStreetMap eso es lo que guarda la etiqueta, así que la relación sale más alta que la de un ' +
      'manual y los umbrales están corridos para eso. Sale de ' +
      (p.anchoDe === 'width' ? '<b>el ancho registrado</b>' : '<b>los carriles</b>, a 3 m cada uno') +
      ' en <b>' + p.coberturaAncho + '%</b> de la vía, y de los pisos registrados en <b>' +
      p.coberturaAltura + '%</b> de los edificios. Con cobertura baja el promedio es de esos pocos y ' +
      'no del sector.</p>';
  }


  /* ── Lo levantado en campo ─────────────────────────────────────────────
     La otra mitad del trabajo. Hasta acá todo el análisis dice lo que
     OpenStreetMap sabe del sector; esto dice qué encontró el curso parado en
     la esquina, y sobre todo dónde las dos cosas no coinciden.

     Ya existía como pantalla aparte, colgada de una ficha guardada. El
     problema de tenerlo aparte es que no entraba en el análisis: la síntesis
     y la lámina hablaban del sector como si nadie lo hubiera caminado. Ahora
     corre sobre el área que está en pantalla y alimenta las dos.

     Las cuatro cajas de la comparación importan por separado y no se suman:
     · CONFIRMADOS — el curso vio lo mismo que el mapa. Es el dato más
       aburrido y el más valioso: valida la fuente.
     · NUEVOS — existe y nadie lo había mapeado. Es lo que el curso le
       devuelve a la ciudad.
     · DISCREPANCIAS — el mapa dice una cosa y la calle otra. Cada una es una
       corrección que hay que subir.
     · SIN VERIFICAR — el mapa lo tiene y nadie pasó por ahí. NO significa que
       haya cerrado; significa que falta caminar esa cuadra. Confundir las dos
       cosas es el error que convierte un levantamiento en un rumor. */
  async function analizarCampo() {
    if (!S.resultado || S.campoCargando) return;
    S.campoCargando = true; S.campoAviso = ''; pintar();
    try {
      var meta = S.resultado.meta || {};
      // Una ficha de mentira con lo que `compararConCampo` necesita: el área y
      // los puntos que ya trajo el análisis. Así no hay dos caminos distintos
      // para lo mismo según la ficha esté guardada o no.
      S.campo = await compararConCampo({
        forma: meta.forma,
        poligono: meta.poligono,
        radioM: meta.radioM,
        centro: { lat: meta.lat, lng: meta.lng },
        pois: S.resultado.pois || []
      });
    } catch (e) {
      S.campo = null;
      S.campoAviso = (e && e.message) || 'No se pudo comparar con lo del curso.';
    }
    S.campoCargando = false;
    pintar();
  }

  function bloqueCampo() {
    var c = S.campo;
    if (!c) {
      var hay = puntosDelCurso().length;
      return h4('campo', 'Lo levantado en campo') +
        '<p class="pcr-pista">Compara este análisis con lo que el curso mapeó en la calle: qué ' +
        'coincide, qué encontraron que no estaba y dónde el mapa dice una cosa y la esquina otra.' +
        (hay ? ' Hay <b>' + hay + '</b> puntos del curso en este dispositivo.'
             : ' <b>Todavía no hay puntos del curso en este dispositivo</b>, así que no hay con qué comparar.') +
        '</p>' +
        (hay
          ? '<div class="pcr-llevar">' +
              '<button type="button" data-pcr="campo" class="pcr-mini pcr-llevar-b"' +
                (S.campoCargando ? ' disabled' : '') + '>' +
                (S.campoCargando ? 'Comparando…' : ico('comparar') + 'Comparar con lo que mapeó el curso') +
              '</button>' +
            '</div>'
          : '') +
        (S.campoAviso ? '<p class="pcr-error">' + esc(S.campoAviso) + '</p>' : '');
    }

    var nuevos = c.nuevos || [], conf = c.confirmados || [];
    var disc = c.discrepancias || [], sinV = c.sinVerificar || [];
    var vistos = conf.length + disc.length;
    return h4('campo', 'Lo levantado en campo') +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + conf.length + '</b><small>coinciden con el mapa</small></div>' +
        '<div class="pcr-kpi"><b>' + nuevos.length + '</b><small>encontrados por el curso</small></div>' +
        '<div class="pcr-kpi"><b>' + disc.length + '</b><small>no coinciden</small></div>' +
      '</div>' +
      (vistos
        ? '<p class="pcr-conc">De lo que el curso revisó, <b>' + conf.length + ' de ' + vistos +
          '</b> están bien en OpenStreetMap' +
          (disc.length ? ' y <b>' + disc.length + '</b> no.' : '.') + '</p>'
        : '') +
      (nuevos.length
        ? '<p class="pcr-lab">Lo que el curso agrega al mapa</p>' +
          nuevos.slice(0, 8).map(function (n) {
            return '<div class="pcr-lote-fila"><span>' + esc(n.nombre || 'Sin nombre') +
              '</span><b>' + esc(nombreGrupo(n.grupo || 'otro')) + '</b></div>';
          }).join('') +
          (nuevos.length > 8 ? '<p class="pcr-pista">Y ' + (nuevos.length - 8) + ' más.</p>' : '')
        : '') +
      (disc.length
        ? '<p class="pcr-lab">Donde el mapa y la calle no coinciden</p>' +
          disc.slice(0, 6).map(function (d) {
            return '<div class="pcr-lote-fila"><span>' + esc(d.campo.nombre || d.osm.nombre || 'Sin nombre') +
              '</span><b>' + esc(nombreGrupo(d.osm.grupo || 'otro')) + ' → ' +
              esc(nombreGrupo(d.campo.grupo || 'otro')) + '</b></div>';
          }).join('') +
          '<p class="pcr-pista">A la izquierda lo que dice el mapa, a la derecha lo que se vio. Cada ' +
          'una de estas es una corrección para subir a OpenStreetMap.</p>'
        : '') +
      (sinV.length
        ? '<p class="pcr-conc"><b>' + sinV.length + '</b> registros del mapa quedaron <b>sin ' +
          'verificar</b>: nadie del curso pasó por ahí. No quiere decir que hayan cerrado — quiere ' +
          'decir que falta caminar esas cuadras.</p>'
        : '') +
      '<p class="pcr-pista">Se considera el mismo sitio cuando los dos puntos están a menos de ' +
      MISMO_SITIO_M + ' m. Compara la categoría, no el nombre: dos droguerías con nombre distinto ' +
      'en la misma esquina son la misma droguería mal escrita.</p>';
  }

  function bloqueMovilidad(st) {
    var mv = st.movilidad;
    if (!mv) return '';
    var via = mv.viaPrincipal;
    var vias = (mv.viasArterias || []).slice(0, 4);
    return '' +
      h4('movilidad', 'Cómo se llega') +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + (mv.nViasArterias || 0) + '</b><small>corredor' +
          ((mv.nViasArterias === 1) ? '' : 'es') + ' principal' + ((mv.nViasArterias === 1) ? '' : 'es') + '</small></div>' +
        '<div class="pcr-kpi"><b>' + (mv.paradasBus || 0) + '</b><small>paradas de bus</small></div>' +
        '<div class="pcr-kpi"><b>' + (mv.ciclorrutas || 0) + '</b><small>tramos de ciclorruta</small></div>' +
      '</div>' +
      medidor('Facilidad para llegar', mv.scoreAcceso, 
        (mv.scoreAcceso >= 60 ? 'Bien conectado: llega transporte y hay vías de peso.'
         : mv.scoreAcceso >= 30 ? 'Conexión intermedia. Verificá en campo cómo llega la gente.'
         : 'Poco conectado según OpenStreetMap. Suele faltar mapeo de rutas: buen dato para levantar.'),
        '#34CCFE') +
      medidor('Exposición al tránsito', mv.exposicion,
        'Nivel ' + String(mv.nivelExposicion || '—').toLowerCase() +
        '. Cuánto ve este sector el tránsito de la ciudad.', '#ec4899') +
      (via
        ? '<p class="pcr-conc">La vía que manda es <b>' + esc(via.nombre || 'sin nombre') + '</b>' +
          (via.jerarquia ? ' (' + esc(via.jerarquia) + ')' : '') +
          (via.distM != null ? ', a ' + via.distM + ' m del centro del área' : '') + '.</p>'
        : '<p class="pcr-pista">OpenStreetMap no registra vías con nombre acá. Anotar los nombres de las calles es de lo más útil que puede hacer el curso.</p>') +
      (vias.length > 1
        ? '<div class="pcr-chips">' + vias.map(function (v) {
            return '<span class="pcr-chip">' + esc(v.nombre || 'sin nombre') +
              (v.distM != null ? ' <b>' + v.distM + ' m</b>' : '') + '</span>';
          }).join('') + '</div>'
        : '') +
      (mv.paradasBus === 0
        ? '<p class="pcr-pista">Sin paradas de bus registradas. Si en la calle sí las hay, ubicarlas es una tarea concreta para la salida.</p>'
        : '') +
      bloqueRutas(mv);
  }

  function bloqueAmbiente(st) {
    var am = st.ambiente;
    if (!am) return '';
    return '' +
      h4('verde', 'Verde y agua') +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + (am.parques || 0) + '</b><small>parques y plazas</small></div>' +
        '<div class="pcr-kpi"><b>' + (am.cuerposAgua || 0) + '</b><small>cuerpos de agua</small></div>' +
        '<div class="pcr-kpi"><b>' + (am.verdeNatural || 0) + '</b><small>manchas de verde</small></div>' +
      '</div>' +
      medidor('Presencia de verde', am.scoreVerde,
        (am.scoreVerde >= 55 ? 'Sector con verde a la mano.'
         : am.scoreVerde >= 25 ? 'Verde escaso: mirá si el que hay está en uso o abandonado.'
         : 'Casi sin verde registrado. Contar los árboles de la calle es un levantamiento que cambia este número.'),
        '#22c55e') +
      bloqueCobertura();
  }

  var NOMBRE_USO = {
    residencial: '🏠 Vivienda', comercial: '🛍️ Comercio',
    institucional: '🏛️ Institucional', servicios: '🔧 Servicios',
    industrial: '🏭 Industria', mixto: '🧩 Usos mezclados', ambiental: '🌳 Ambiental'
  };

  function bloqueUsoPredominante(st) {
    var up = st.usoPredominante;
    if (!up) return '';
    var filas = Object.keys(up)
      .map(function (k) { return { id: k, n: up[k] || 0 }; })
      .filter(function (x) { return x.n > 0; })
      .sort(function (a, b) { return b.n - a.n; });
    if (!filas.length) return '';
    var top = filas[0];
    return '' +
      h4('estadistica', 'Qué manda en el sector') +
      '<p class="pcr-conc">Predomina <b>' + esc((NOMBRE_USO[top.id] || top.id).replace(/^\S+\s/, '')) +
        '</b> con el ' + top.n + '% del peso de los usos.</p>' +
      filas.map(function (x) {
        return '<div class="pcr-fila">' +
          '<span class="pcr-fila-nom">' + icoCat(NOMBRE_USO[x.id] || '', 14) + esc(sinEmoji(NOMBRE_USO[x.id] || x.id)) + '</span>' +
          '<span class="pcr-fila-barra"><i style="width:' + x.n + '%"></i></span>' +
          '<span class="pcr-fila-n">' + x.n + '%</span>' +
        '</div>';
      }).join('') +
      '<p class="pcr-pista">El porcentaje pesa lo que representa cada cosa: una zona residencial completa pesa más que un solo local.</p>' +
      bloqueMezcla(st);
  }

  /* ── Mezcla de usos ────────────────────────────────────────────────────
     El número que separa un sector vivo de uno que se vacía. Un centro que a
     las siete de la noche queda desierto y un barrio dormitorio donde no hay
     dónde comprar el pan son el mismo problema medido desde dos lados, y los
     dos dan un índice bajo.

     Es entropía de Shannon normalizada sobre los mismos pesos del uso
     predominante: 0 si todo el peso está en un uso, 1 si está repartido por
     igual entre los siete. Se muestra con el nivel en palabras porque «0,62»
     no le dice nada a nadie sin la escala al lado. */
  function bloqueMezcla(st) {
    var m = st && st.mezcla;
    if (!m || m.usos < 1) return '';
    var pct = Math.round(m.indice * 100);
    return '<p class="pcr-lab">Mezcla de usos</p>' +
      medidor('Índice de mezcla · ' + m.nivel, pct, m.lectura,
              pct >= 55 ? '#22c55e' : pct >= 35 ? '#eab308' : '#e5484d') +
      '<p class="pcr-pista">Va de 0 —un solo uso manda— a 100 —los siete repartidos por igual—. ' +
      'Acá da <b>' + String(m.indice).replace('.', ',') + '</b> con <b>' + m.usos + ' de ' + m.maximo +
      '</b> usos presentes. Se mide sobre lo mapeado: en OpenStreetMap el comercio está mucho mejor ' +
      'registrado que la vivienda, así que un barrio de casas sin polígono de uso residencial sale ' +
      'menos mezclado de lo que es. Mapear el uso del suelo corrige este número más que cualquier ' +
      'otra cosa.</p>';
  }

  function bloqueNucleos(st) {
    var ns = st.nucleos || [];
    if (!ns.length) return '';
    return '' +
      h4('comercio', 'Dónde está la calle comercial') +
      '<p class="pcr-pista">Grupos de comercios que están juntos. No es cuántos hay: es dónde se juntan, ' +
      'que es lo que hace que una calle tenga vida.</p>' +
      ns.map(function (n, i) {
        return '<div class="pcr-nucleo">' +
          '<span class="pcr-nucleo-i">' + (i + 1) + '</span>' +
          '<div class="pcr-nucleo-t">' +
            '<b>' + n.n + ' locales · ' + esc(n.rubroDominante || 'comercio') + '</b>' +
            '<small>a unos ' + n.distM + ' m del centro del área' +
            (n.nombres && n.nombres.length ? ' · ' + esc(n.nombres.join(', ')) : '') + '</small>' +
          '</div>' +
        '</div>';
      }).join('');
  }

  // ── La lista de campo, con nombres propios ────────────────────────────
  /* Hasta acá el informe cuenta cosas: «15 droguerías». Eso no se puede
     verificar caminando. Lo que sí se puede es una lista con NOMBRES —«Cruz
     Verde, La Rebaja, Farmatodo»—: el estudiante llega, los busca, marca los
     que siguen abiertos y anota los que faltan. El servidor ya mandaba esos
     nombres en `rubros.ejemplos` y no se estaban usando. */
  function bloqueRubros(st) {
    var rubros = (st.rubros || []).filter(function (r) { return r.n > 0 && r.sub !== 'otro'; });
    if (!rubros.length) return '';
    var conNombre = rubros.filter(function (r) { return (r.ejemplos || []).length; });

    return '' +
      h4('lista', 'La lista para ir a verificar') +
      '<p class="pcr-tarea-intro">Esto es lo que OpenStreetMap dice que hay, <b>con nombre y apellido</b>. ' +
      (conNombre.length
        ? 'Buscá cada uno en la calle: los que sigan abiertos se confirman, los que no, se corrigen. ' +
          'Lo que encuentres y no esté en esta lista es lo que el curso le agrega al mapa.'
        : 'Ninguno tiene nombre registrado: son puntos anónimos, así que la tarea es justamente ponerles nombre.') +
      '</p>' +
      '<div class="pcr-rubros">' +
        rubros.slice(0, 14).map(function (r) {
          return '<div class="pcr-rubro">' +
            '<div class="pcr-rubro-cab">' +
              '<span class="pcr-rubro-n">' + (r.icono ? icoCat(r.icono, 15) : '') + esc(r.nombre) + '</span>' +
              '<b>' + r.n + '</b>' +
            '</div>' +
            ((r.ejemplos || []).length
              ? '<ul class="pcr-rubro-ej">' + r.ejemplos.map(function (e) {
                  return '<li>' + esc(e) + '</li>';
                }).join('') +
                (r.n > r.ejemplos.length
                  ? '<li class="pcr-mas">y ' + (r.n - r.ejemplos.length) + ' más sin nombre registrado</li>'
                  : '') + '</ul>'
              : '<p class="pcr-rubro-sin">Sin nombres registrados — anotarlos es tarea de campo.</p>') +
          '</div>';
        }).join('') +
      '</div>' +
      (rubros.length > 14
        ? '<p class="pcr-pista">Y ' + (rubros.length - 14) + ' rubros más con menos presencia.</p>'
        : '');
  }

  // ── Cómo cambia al alejarse del centro ────────────────────────────────
  /* Un total no dice si las cosas están pegadas o desperdigadas. Los anillos
     sí: «la mitad está en los primeros 200 m» es una forma del sector, y de
     paso reparte el trabajo —a este grupo el anillo de adentro, a este otro
     el de afuera—. */
  function bloqueAnillos(st, esPol) {
    var an = (st.anillos || []).filter(function (a) { return a.n > 0; });
    if (an.length < 2) return '';
    var mayor = an.reduce(function (m, a) { return Math.max(m, a.n); }, 1);
    var primero = an[0];

    return '' +
      h4('anillos', 'Cómo cambia al alejarse') +
      '<p class="pcr-pista">Distancia medida desde el ' +
      (esPol ? 'centro del área dibujada' : 'centro del círculo') + '. ' +
      'Sirve para repartir el trabajo: un grupo por anillo.</p>' +
      an.map(function (a) {
        return '<div class="pcr-anillo">' +
          '<div class="pcr-fila">' +
            '<span class="pcr-fila-nom">' + esc(a.etiqueta) + '</span>' +
            '<span class="pcr-fila-barra"><i style="width:' + Math.round(a.n / mayor * 100) + '%"></i></span>' +
            '<span class="pcr-fila-n">' + a.n + '</span>' +
          '</div>' +
          ((a.ejemplos || []).length
            ? '<small class="pcr-anillo-ej">' + a.ejemplos.map(function (e) {
                return esc(e.nombre) + ' (' + e.distM + ' m)';
              }).join(' · ') + '</small>'
            : '') +
        '</div>';
      }).join('') +
      (primero && primero.n / Math.max(1, st.total) >= 0.5
        ? '<p class="pcr-conc">Más de la mitad de lo registrado está <b>' + esc(primero.etiqueta) +
          '</b>. Es un sector concentrado: se recorre a pie sin problema.</p>'
        : '');
  }

  // ── El plan de salida ─────────────────────────────────────────────────
  /* Todo lo anterior es diagnóstico. Esto es lo que se imprime y se reparte
     el día de la salida: a cada grupo, un rumbo, un encargo y un ejemplo
     concreto de lo que va a encontrarse. Sale de lo que ya se calculó —los
     rumbos vacíos, los flojos y los llenos— y no pide ningún dato nuevo.

     El orden de reparto no es alfabético ni por tamaño: primero los rumbos
     SIN datos, porque ahí todo lo que se levante es información que no
     existía; después los flojos; y solo al final los llenos, donde el
     trabajo es verificar. Un curso con pocos grupos debe gastar sus grupos
     en lo primero. */

  var GRUPOS_POSIBLES = [2, 3, 4, 5, 6, 8, 10];

  function repartirTrabajo(res, zonas, nGrupos) {
    var pois = (res.pois || []);
    var eje = (res.meta && Number.isFinite(res.meta.lat))
      ? { lat: res.meta.lat, lng: res.meta.lng } : S.centro;

    // Qué hay en cada rumbo, con nombres: es lo que convierte «al nororiente»
    // en «al nororiente, donde está la Droguería La Rebaja».
    var porRumbo = {};
    RUMBOS.forEach(function (r) { porRumbo[r.id] = { rumbo: r, n: 0, nombres: [], subs: {} }; });
    pois.forEach(function (p) {
      if (p.lat == null || p.lng == null || !eje) return;
      var id = rumboDe360(rumboDe(eje, p)).id;
      var casilla = porRumbo[id];
      casilla.n++;
      if (p.sub) casilla.subs[p.sub] = (casilla.subs[p.sub] || 0) + 1;
      if (p.nombre && casilla.nombres.length < 3 && casilla.nombres.indexOf(p.nombre) === -1) {
        casilla.nombres.push(p.nombre);
      }
    });

    var vacios = zonas.vacios.map(function (r) { return r.id; });
    var flojos = zonas.flojos.map(function (f) { return f.rumbo.id; });
    var orden = RUMBOS.slice().sort(function (a, b) {
      var pa = vacios.indexOf(a.id) !== -1 ? 0 : flojos.indexOf(a.id) !== -1 ? 1 : 2;
      var pb = vacios.indexOf(b.id) !== -1 ? 0 : flojos.indexOf(b.id) !== -1 ? 1 : 2;
      if (pa !== pb) return pa - pb;
      return porRumbo[b.id].n - porRumbo[a.id].n;   // dentro de un nivel, primero lo más cargado
    });

    var n = Math.max(2, Math.min(10, nGrupos || 4));
    var asignaciones = [];
    for (var i = 0; i < n; i++) {
      var r = orden[i % orden.length];
      var casilla = porRumbo[r.id];
      var vacio = vacios.indexOf(r.id) !== -1;
      var flojo = flojos.indexOf(r.id) !== -1;
      // Con más grupos que rumbos, el segundo grupo del mismo rumbo trabaja
      // la parte de afuera: mandar dos grupos a la misma esquina es mandar a
      // uno de los dos a repetir el trabajo del otro.
      var vuelta = Math.floor(i / orden.length);
      var subs = Object.keys(casilla.subs).sort(function (a, b) { return casilla.subs[b] - casilla.subs[a]; });
      asignaciones.push({
        nombre: 'Grupo ' + (i + 1),
        rumbo: r,
        franja: vuelta === 0 ? 'toda la franja' : (vuelta === 1 ? 'la mitad de afuera' : 'los bordes'),
        n: casilla.n,
        vacio: vacio, flojo: flojo,
        encargo: vacio
          ? 'Levantar de cero: acá OpenStreetMap no tiene NADA. Todo lo que anoten es información nueva.'
          : flojo
            ? 'Completar: hay apenas ' + casilla.n + ' registro' + (casilla.n === 1 ? '' : 's') +
              '. Falta casi todo, así que lo suyo es levantar lo que no está.'
            : 'Verificar y corregir: hay ' + casilla.n + ' registros. Comprobar que sigan ahí y anotar los que falten.',
        pista: casilla.nombres.length
          ? 'Van a pasar por ' + casilla.nombres.join(', ') + '.'
          : (subs.length ? 'Lo que más hay por ahí: ' + nombreDeSub(subs[0]) + '.' : ''),
        nombres: casilla.nombres
      });
    }
    return asignaciones;
  }

  function bloquePlan(res, zonas) {
    if (!zonas || !RUMBOS.length) return '';
    var n = S.grupos || 4;
    var plan = repartirTrabajo(res, zonas, n);
    if (!plan.length) return '';

    var botones = GRUPOS_POSIBLES.map(function (g) {
      return '<button type="button" data-pcr="grupos" data-g="' + g + '"' +
        ' class="pcr-radio' + (g === n ? ' pcr-radio-on' : '') + '">' + g + '</button>';
    }).join('');

    return '' +
      h4('brujula', 'El plan de la salida') +
      '<p class="pcr-tarea-intro">Reparto listo para imprimir: a cada grupo, un rumbo y un encargo. ' +
      'Primero los rumbos donde <b>no hay nada</b> —ahí todo lo que levanten es nuevo—, ' +
      'después los que tienen poco, y al final los que ya están mapeados, donde el trabajo es verificar.</p>' +
      '<label class="pcr-lab">¿En cuántos grupos sale el curso?</label>' +
      '<div class="pcr-radios">' + botones + '</div>' +
      '<div class="pcr-plan">' +
        plan.map(function (a) {
          return '<div class="pcr-tarea' + (a.vacio ? ' pcr-tarea-nueva' : '') + '">' +
            '<div class="pcr-tarea-cab">' +
              '<b>' + esc(a.nombre) + '</b>' +
              '<span class="pcr-tarea-rumbo">al ' + esc(a.rumbo.nombre) +
              (a.franja !== 'toda la franja' ? ' · ' + esc(a.franja) : '') + '</span>' +
            '</div>' +
            '<p class="pcr-tarea-que">' + esc(a.encargo) + '</p>' +
            (a.pista ? '<small class="pcr-tarea-pista">' + esc(a.pista) + '</small>' : '') +
          '</div>';
        }).join('') +
      '</div>' +
      '<p class="pcr-pista">Se imprime con el informe en PDF y va en el texto que se copia.</p>';
  }

  // El mismo plan en texto pelado, para el PDF y para el portapapeles.
  function planComoTexto(res, zonas) {
    var plan = repartirTrabajo(res, zonas, S.grupos || 4);
    var L = ['PLAN DE LA SALIDA (' + plan.length + ' grupos)'];
    plan.forEach(function (a) {
      L.push('  ' + a.nombre + ' — al ' + a.rumbo.nombre +
             (a.franja !== 'toda la franja' ? ' (' + a.franja + ')' : ''));
      L.push('     ' + a.encargo);
      if (a.pista) L.push('     ' + a.pista);
    });
    return L.join('\n');
  }

  // ── Cobertura del suelo, de la foto satelital ─────────────────────────
  /* El motor de cobertura ya existe y está probado: vive en js/24 y lo usa el
     análisis por área. Acá no se reescribe —serían mil líneas de clasificación
     por píxel, con sus tres pasadas y su umbral adaptativo—: se le presta el
     contorno de este sector y se le pide que lo analice. */

  function circuloComoContorno(centro, radioM, lados) {
    var n = lados || 48, rad = Math.PI / 180, R = 6378137;
    var dLat = radioM / R / rad;
    var dLng = dLat / Math.max(1e-6, Math.cos(centro.lat * rad));
    var out = [];
    for (var i = 0; i < n; i++) {
      var a = i / n * 2 * Math.PI;
      out.push({ lat: centro.lat + dLat * Math.sin(a), lng: centro.lng + dLng * Math.cos(a) });
    }
    return out;
  }

  // El contorno de LO ANALIZADO, sea un trazo o un círculo. Con radio no hay
  // ningún polígono dibujado, así que se fabrica uno: es la misma forma que
  // se le mostró al usuario en el mapa.
  function contornoDelSector() {
    var meta = (S.resultado && S.resultado.meta) || {};
    if (meta.forma === 'poligono' || S.forma === 'poligono') {
      var pol = meta.poligono || S.poligono;
      if (pol && pol.length >= 3) {
        return pol.map(function (p) { return { lat: Number(p.lat), lng: Number(p.lng) }; });
      }
      return null;
    }
    var c = Number.isFinite(meta.lat) ? { lat: meta.lat, lng: meta.lng } : S.centro;
    if (!c) return null;
    return circuloComoContorno(c, meta.radioM || S.radioM, 48);
  }

  /* El trazado urbano: llenos y vacíos, jerarquía vial y morfología. Se pide
     a botón, como la lectura de la foto satelital y por la misma razón: trae
     la FORMA de cada edificio y cada vía del área, que pesa mucho más que sus
     centros. En un teléfono con datos, eso se pregunta antes de gastarlo. */
  /* El terreno: alturas, pendiente, hacia dónde baja la ladera y dos
     perfiles. Como el trazado y la foto satelital, se pide a botón: son tres
     consultas a un servicio de elevación, y eso no se gasta sin permiso. */
  /* El clima. Una consulta al archivo climático y a promediar por mes. Como
     el terreno y el trazado, se pide a botón. */
  function analizarClima() {
    var D = window.AIA_DATOS;
    if (!D || !D.consultarClima || !window.AIA_REMOTO || !window.AIA_REMOTO.clima) {
      S.cliAviso = 'Falta el módulo de datos. Recargá la app.'; pintar(); return;
    }
    var eje = ejeDelSector();
    if (!eje) { S.cliAviso = 'Primero elegí el área.'; pintar(); return; }

    S.cliCargando = true; S.cliAviso = 'Consultando el clima…';
    pintar();

    D.consultarClima(eje.lat, eje.lng, function (txt) {
      S.cliAviso = txt;
      var caja = document.getElementById('pcr-cli-estado');
      if (caja) caja.textContent = txt;
    }).then(function (clima) {
      return window.AIA_REMOTO.clima({ clima: clima });
    }).then(function (res) {
      S.clima = res; S.cliCargando = false; S.cliAviso = '';
      try {
        if (S.fichaActualId && S.resultado) {
          guardarFicha(S.resultado, zonasSinDatos(S.resultado.pois || [], ejeDelSector()),
                       S.nombreGuardado || '', S.fichaActualId);
        }
      } catch (e) {}
      pintar();
    }).catch(function (e) {
      S.cliCargando = false;
      S.cliAviso = (e && e.message) || 'No se pudo consultar el clima.';
      pintar();
    });
  }

  function analizarTerreno() {
    var D = window.AIA_DATOS;
    if (!D || !D.consultarElevacion || !window.AIA_REMOTO || !window.AIA_REMOTO.terreno) {
      S.terAviso = 'Falta el módulo de datos. Recargá la app.'; pintar(); return;
    }
    if (!listoParaAnalizar()) { S.terAviso = 'Primero elegí el área.'; pintar(); return; }

    var esPol = S.forma === 'poligono';
    S.terCargando = true; S.terAviso = 'Preparando la rejilla de alturas…';
    pintar();

    var rej;
    try {
      rej = D.rejillaDe(esPol ? S.poligono : null, esPol ? null : S.centro, S.radioM);
    } catch (e) {
      S.terCargando = false; S.terAviso = 'No se pudo armar la rejilla.'; pintar(); return;
    }

    D.consultarElevacion(rej.puntos, function (txt) {
      S.terAviso = txt;
      var caja = document.getElementById('pcr-ter-estado');
      if (caja) caja.textContent = txt;
    }).then(function (alturas) {
      var puntos = rej.puntos.map(function (p, i) {
        return { lat: p.lat, lng: p.lng, elev: alturas[i] };
      });
      var peticion = { rejilla: { filas: rej.filas, columnas: rej.columnas, puntos: puntos } };
      if (esPol) {
        peticion.poligono = S.poligono.map(function (p) { return { lat: p.lat, lng: p.lng }; });
      } else {
        peticion.radioM = S.radioM;
        peticion.centro = { lat: S.centro.lat, lng: S.centro.lng };
      }
      return window.AIA_REMOTO.terreno(peticion);
    }).then(function (res) {
      S.terreno = res; S.terCargando = false; S.terAviso = '';
      try {
        if (S.fichaActualId && S.resultado) {
          guardarFicha(S.resultado, zonasSinDatos(S.resultado.pois || [], ejeDelSector()),
                       S.nombreGuardado || '', S.fichaActualId);
        }
      } catch (e) {}
      pintar();
    }).catch(function (e) {
      S.terCargando = false;
      S.terAviso = (e && e.message) || 'No se pudo medir el terreno.';
      pintar();
    });
  }

  function analizarTrazado() {
    if (!window.AIA_DATOS || !window.AIA_REMOTO || !window.AIA_REMOTO.trazado) {
      S.trzAviso = 'Falta el módulo de datos. Recargá la app.'; pintar(); return;
    }
    var esPol = S.forma === 'poligono';
    if (!listoParaAnalizar()) { S.trzAviso = 'Primero elegí el área.'; pintar(); return; }

    S.trzCargando = true; S.trzAviso = 'Trayendo la forma de las calles y los edificios…';
    pintar();

    var traer = esPol
      ? window.AIA_DATOS.consultarTrazadoPoligono(S.poligono)
      : window.AIA_DATOS.consultarTrazado(S.centro.lat, S.centro.lng, S.radioM);

    traer.then(function (elementos) {
      /* Las huellas de los edificios se guardan en memoria para poder
         pintarlas cuando se pida, sin repetir la consulta. Solo los anillos:
         las etiquetas no hacen falta para dibujar y ocupan de más. El tope
         existe porque un sector grande del centro puede traer miles y el
         teléfono no tiene por qué cargar con todos. */
      S.trzHuellas = (elementos || [])
        .filter(function (el) {
          var t = el && el.tags;
          return t && t.building && t.building !== 'no' &&
                 Array.isArray(el.geometry) && el.geometry.length >= 3;
        })
        .slice(0, 3000)
        .map(function (el) {
          return el.geometry.map(function (p) {
            return { lat: p.lat, lng: p.lon != null ? p.lon : p.lng };
          });
        });
      var peticion = { elementos: elementos || [] };
      if (esPol) {
        peticion.poligono = S.poligono.map(function (p) { return { lat: p.lat, lng: p.lng }; });
      } else {
        peticion.radioM = S.radioM;
        peticion.centro = { lat: S.centro.lat, lng: S.centro.lng };
      }
      return window.AIA_REMOTO.trazado(peticion, function (txt) {
        S.trzAviso = txt;
        var caja = document.getElementById('pcr-trz-estado');
        if (caja) caja.textContent = txt;
      });
    }).then(function (res) {
      S.trazado = res; S.trzCargando = false; S.trzAviso = '';
      // Se guarda con la ficha: pesa unas pocas cifras y es media lámina.
      try {
        if (S.fichaActualId && S.resultado) {
          guardarFicha(S.resultado, zonasSinDatos(S.resultado.pois || [], ejeDelSector()),
                       S.nombreGuardado || '', S.fichaActualId);
        }
      } catch (e) {}
      pintar();
    }).catch(function (e) {
      S.trzCargando = false;
      S.trzAviso = (e && e.message) || 'No se pudo medir el trazado.';
      pintar();
    });
  }

  function ejeDelSector() {
    var m = S.resultado && S.resultado.meta;
    if (m && Number.isFinite(m.lat)) return { lat: m.lat, lng: m.lng };
    return S.forma === 'poligono' ? centroideDe(S.poligono) : S.centro;
  }

  function analizarCobertura() {
    var A = window.URBIS_PC_ANALISIS;
    if (!A || typeof A.analizarRaster !== 'function') {
      S.cobAviso = 'Falta el módulo de análisis por área. Recargá la app.';
      pintar(); return;
    }
    var contorno = contornoDelSector();
    if (!contorno) { S.cobAviso = 'Primero analizá un sector.'; pintar(); return; }

    S.cobCargando = true; S.cobAviso = 'Preparando la lectura de la foto…';
    pintar();
    A.analizarRaster(function (txt) {
      // Son tres pasadas sobre millones de píxeles: callado se siente colgado.
      S.cobAviso = txt;
      var caja = document.getElementById('pcr-cob-estado');
      if (caja) caja.textContent = txt;
    }, contorno).then(function (res) {
      S.cobertura = res; S.cobCargando = false; S.cobAviso = '';
      // Se pinta sola en el mapa: el sentido de leer la foto es VER dónde
      // está el verde, no solo con cuánto por ciento se quedó.
      try {
        if (typeof A.mostrarRaster === 'function') { A.mostrarRaster(res); S.cobEnMapa = true; }
      } catch (e) {}
      pintar();
    }).catch(function (e) {
      S.cobCargando = false;
      S.cobAviso = 'No se pudo leer la foto satelital: ' + ((e && e.message) || e);
      pintar();
    });
  }

  function bloqueCobertura() {
    var c = S.cobertura;
    if (!c) {
      return '<div class="pcr-llevar">' +
        '<button type="button" data-pcr="cobertura" class="pcr-mini pcr-llevar-b"' +
          (S.cobCargando ? ' disabled' : '') + '>' +
          (S.cobCargando ? 'Leyendo la foto…' : ico('satelite') + 'Medir el verde en la foto satelital') +
        '</button>' +
      '</div>' +
      (S.cobCargando
        ? '<p class="pcr-pista" id="pcr-cob-estado">' + esc(S.cobAviso || 'Preparando…') + '</p>'
        : '<p class="pcr-pista">Lo de arriba cuenta parques <b>registrados</b> en OpenStreetMap. ' +
          'Esto mide el verde que de verdad hay en la foto, píxel a píxel — y la diferencia ' +
          'entre los dos números suele ser el hallazgo.</p>') +
      (S.cobAviso && !S.cobCargando ? '<p class="pcr-error">' + esc(S.cobAviso) + '</p>' : '');
    }

    var orden = c.clases.slice().sort(function (a, b) { return b.pct - a.pct; });
    var verde = c.clases.filter(function (x) { return x.id === 'verde'; })[0] || { pct: 0, m2: 0 };
    var dom = orden[0];

    return '' +
      '<div class="pcr-cob-barra">' +
        orden.filter(function (x) { return x.pct > 0; }).map(function (x) {
          return '<i style="width:' + x.pct + '%;background:' + x.color + '" title="' + esc(x.etq) + '"></i>';
        }).join('') +
      '</div>' +
      '<div class="pcr-cob-lista">' +
        orden.filter(function (x) { return x.pct > 0; }).map(function (x) {
          return '<div class="pcr-cob-fila">' +
            '<span class="pcr-cob-pin" style="background:' + x.color + '"></span>' +
            '<span class="pcr-cob-etq">' + icoCat(x.ico, 14) + esc(x.etq) + '</span>' +
            '<b>' + x.pct + '%</b>' +
            '<small>' + Math.round(x.m2).toLocaleString('es-CO') + ' m²</small>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<p class="pcr-conc">La foto dice que <b>' + verde.pct + '%</b> del área es vegetación viva' +
        (dom && dom.id !== 'verde' ? ', y que lo que más hay es ' + esc(dom.etq.toLowerCase()) : '') +
        '. Medido sobre ' + (c.malla || '') + ' píxeles, a ' + (c.mPorPx || '?') + ' m por píxel.</p>' +
      (c.grueso
        ? '<p class="pcr-pista">A esta escala cada píxel cubre varios metros: la lectura es de <b>masas</b>, ' +
          'no de árboles sueltos. Para leer elementos, analizá un sector más chico.</p>'
        : '') +
      (c.pctAmbiguo > 25
        ? '<p class="pcr-pista">Un ' + c.pctAmbiguo + '% quedó en tonos cálidos que no se pueden separar ' +
          '(teja, concreto viejo, suelo desnudo y matorral seco comparten color). Eso se resuelve en campo.</p>'
        : '') +
      '<div class="pcr-llevar">' +
        '<button type="button" data-pcr="cob-mapa" class="pcr-mini pcr-llevar-b">' +
          (S.cobEnMapa ? ico('apagar') + 'Quitar del mapa' : ico('mapa') + 'Ver en el mapa') + '</button>' +
        '<button type="button" data-pcr="cobertura" class="pcr-mini pcr-llevar-b">' + ico('reloj') + 'Volver a leer</button>' +
      '</div>';
  }

  // ── Llevarse el sector a otro programa ────────────────────────────────
  /* Los formatos ya existen y están probados en js/26 —KMZ, DXF en metros
     UTM, GeoJSON, SVG y el paquete completo—. Lo único que faltaba era
     entregarle ESTOS datos: el contorno analizado (que a veces es un
     círculo), los usos que se encontraron en OpenStreetMap y, si se leyó, la
     cobertura vectorizada. */
  function datosParaExportar(ficha) {
    var EXP = window.URBIS_PC_EXPORTAR, A = window.URBIS_PC_ANALISIS;
    if (!EXP || !A) return null;

    var pts, pois, raster, nombre;
    if (ficha) {
      // Un sector guardado: no lleva raster (ocuparía demasiado en el
      // teléfono), pero sí su contorno y sus puntos.
      pts = (ficha.forma === 'poligono' && ficha.poligono && ficha.poligono.length >= 3)
        ? ficha.poligono.map(function (p) { return { lat: p.lat, lng: p.lng }; })
        : (ficha.centro ? circuloComoContorno(ficha.centro, ficha.radioM || 500, 48) : null);
      pois = ficha.pois || [];
      raster = null;
      nombre = ficha.nombre || '';
    } else {
      pts = contornoDelSector();
      pois = poisDelResultado();
      raster = S.cobertura;
      nombre = S.nombreGuardado || '';
    }
    if (!pts || pts.length < 3) return null;

    var cobertura = [];
    if (raster && raster.rejilla && typeof EXP.vectorizarCobertura === 'function') {
      try { cobertura = EXP.vectorizarCobertura(raster); } catch (e) { cobertura = []; }
    }

    var colores = {};
    (pois || []).forEach(function (p) {
      var g = p.grupo || 'otro';
      if (!colores[g]) colores[g] = p.color || colorDelCatalogo(g) || '#6b70e0';
    });

    var deOSM = (pois || []).filter(function (p) {
      return p && isFinite(p.lat) && isFinite(p.lng);
    }).map(function (p) {
      var reg = {
        lat: Number(p.lat), lng: Number(p.lng),
        nombre: p.nombre || 'Sin nombre',
        grupo: nombreGrupo(p.grupo || 'otro'),
        gid: p.grupo || 'otro',
        fuente: 'OpenStreetMap'
      };
      // El uso concreto y la distancia viajan como atributos: es lo que
      // permite filtrar en QGIS o etiquetar en AutoCAD sin volver a la app.
      if (p.sub) reg.uso = nombreDeSub(p.sub);
      if (p.distM != null) reg.dist_m = p.distM;
      return reg;
    });

    /* Y lo que levantó el curso dentro del mismo contorno. Es la mitad que
       da sentido a la otra: el archivo que se entrega dice qué había
       registrado y qué se encontró en la calle, en las mismas coordenadas y
       distinguible por el atributo `fuente`. Cada punto del curso llega con
       su ficha de edificio —material, pisos, época— porque la lectura la
       hace js/26, que ya sabía leerla. */
    var deCampo = [];
    try {
      if (typeof EXP.puntosProCityDentro === 'function') {
        deCampo = (EXP.puntosProCityDentro(pts) || []).map(function (r) {
          r.fuente = 'Mapeo del curso';
          return r;
        });
      }
    } catch (e) { deCampo = []; }

    return {
      pts: pts,
      puntos: deOSM.concat(deCampo),
      osm: deOSM.length, campo: deCampo.length,
      geo: null,
      raster: raster, cobertura: cobertura, colores: colores,
      nombre: nombre,
      areaM2: A.areaM2(pts), perimetroM: A.perimetroM(pts, true)
    };
  }

  function bloqueExportar() {
    var d = datosParaExportar(null);
    if (!d) return '';
    var trae = [
      d.osm + ' uso' + (d.osm === 1 ? '' : 's') + ' de OpenStreetMap',
      d.campo ? d.campo + ' mapeo' + (d.campo === 1 ? '' : 's') + ' del curso' : null,
      'el contorno del área',
      d.cobertura.length ? 'la cobertura en ' + d.cobertura.length + ' polígonos' : null
    ].filter(Boolean).join(' · ');

    return '' +
      h4('exportar', 'Llevarlo a otro programa') +
      '<p class="pcr-tarea-intro">Sale <b>georreferenciado y en vectores</b>: el contorno, cada uso con su ' +
      'categoría y su distancia, y —si leíste la foto— las manchas de vegetación como polígonos de verdad, ' +
      'editables y acotables. El DXF va en <b>metros UTM reales</b>: en AutoCAD 1 unidad = 1 metro.</p>' +
      (d.campo
        ? '<p class="pcr-pista">Van <b>las dos mitades</b>: lo que OpenStreetMap tenía registrado y lo que ' +
          'levantó el curso, en el mismo archivo y distinguibles por el atributo <b>fuente</b>. Es el ' +
          'entregable de la salida.</p>'
        : '') +
      '<p class="pcr-pista">Ahora mismo se llevaría: <b>' + esc(trae) + '</b>.' +
      (d.cobertura.length ? '' : ' Si leés la foto satelital antes de exportar, también van las manchas de verde.') +
      '</p>' +
      '<div class="pcr-exp-btns">' +
        '<button type="button" data-pcr="exp" data-f="paquete" class="pcr-mini pcr-exp-todo">' + ico('exportar') + 'Paquete completo (ZIP)</button>' +
        '<button type="button" data-pcr="exp" data-f="kmz" class="pcr-mini">' + ico('mapa') + 'KMZ · Google Earth</button>' +
        '<button type="button" data-pcr="exp" data-f="dxf" class="pcr-mini">' + ico('area') + 'DXF · AutoCAD</button>' +
        '<button type="button" data-pcr="exp" data-f="svg" class="pcr-mini">' + ico('lapiz') + 'SVG · Corel / Illustrator</button>' +
        '<button type="button" data-pcr="exp" data-f="geojson" class="pcr-mini">' + ico('capas') + 'GeoJSON · QGIS</button>' +
        '<button type="button" data-pcr="exp" data-f="kml" class="pcr-mini">KML suelto</button>' +
      '</div>';
  }

  function htmlFicha(res) {
    var st = res.stats || {};
    var pois = res.pois || [];

    // El centro para repartir los rumbos sale de la respuesta, no del estado
    // local: con un área dibujada el servidor usó el CENTROIDE del polígono, y
    // medir los rumbos desde el centro del mapa daría direcciones que no
    // corresponden al área analizada. Mandaría al estudiante a otra parte.
    var eje = (res.meta && Number.isFinite(res.meta.lat) && Number.isFinite(res.meta.lng))
      ? { lat: res.meta.lat, lng: res.meta.lng }
      : S.centro;
    var zonas = zonasSinDatos(pois, eje);
    S.ultimasZonas = zonas;   // la usan «guardar» y «copiar», que corren después

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
      .filter(function (x) { return x.n > 0 && x.id !== 'otro'; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, 8);
    var TAX = (window.AIA_MOTOR && window.AIA_MOTOR.TAXONOMIA) || [];
    var chips = subs.map(function (x) {
      var t = TAX.filter(function (u) { return u.sub === x.id; })[0];
      return '<span class="pcr-chip">' + (t && t.icono ? icoCat(t.icono, 13) : '') +
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

    // Con un área dibujada, decir «radio de 412 m» sería inventarse una forma
    // que el usuario no trazó: el radio equivalente existe para los cálculos,
    // no para leerlo. Se muestra el tamaño real del área.
    var meta = res.meta || {};
    var esPol = meta.forma === 'poligono';
    var radioTxt = esPol
      ? (formatearArea(meta.areaM2) || '—')
      : (S.radioM >= 1000 ? (S.radioM / 1000) + ' km' : S.radioM + ' m');
    var radioEtiqueta = esPol ? 'de área dibujada' : 'de radio';

    return '' +
      barra('Modo educativo · Reconocimiento', 'Lo que hay ' + (esPol ? 'en el área' : 'en el sector'), 'lupa') +
      '<div class="pcr-cuerpo">' +

        /* Desde que la ficha sobrevive a cerrar la hoja, hace falta una salida
           clara hacia la pantalla de elegir área: sin ella, quien quisiera
           analizar OTRO sector no tenía por dónde. */
        '<button type="button" data-pcr="otro" class="pcr-mini pcr-otro">' +
          ico('atras', 16) + 'Analizar otro sector</button>' +

        '<div class="pcr-kpis">' +
          '<div class="pcr-kpi"><b>' + (st.total || 0) + '</b><small>usos registrados</small></div>' +
          '<div class="pcr-kpi"><b>' + radioTxt + '</b><small>' + radioEtiqueta + '</small></div>' +
          '<div class="pcr-kpi"><b>' + dens + '</b><small>por hectárea</small></div>' +
          '<div class="pcr-kpi"><b>' + (zonas.vacios.length + zonas.flojos.length) + '</b><small>rumbos sin datos</small></div>' +
        '</div>' +

        bloqueUbicacion(res.ubicacion, st, meta) +
        bloqueLote(meta, esPol) +
        bloquePoblacion(st, esPol) +
        bloqueDemografia(st) +

        h4('capas', 'Qué hay, por categoría') +
        // El anillo se pinta después, cuando el canvas ya está en el documento.
        // Si Chart.js no cargó, las barras de abajo siguen contando lo mismo:
        // la gráfica es la forma bonita del dato, no el dato.
        (grupos.length ? '<div class="pcr-grafica"><canvas id="pcr-donut" height="190"></canvas></div>' : '') +
        (filas || '<p class="pcr-pista">Ningún uso quedó clasificado en una categoría.</p>') +
        (sinCategoria ? '<p class="pcr-pista">' + sinCategoria + ' punto' + (sinCategoria === 1 ? '' : 's') +
          ' sin categoría reconocida. Suelen ser usos poco comunes: buen material para revisar en campo.</p>' : '') +

        (chips ? h4('porcentaje', 'Lo más repetido') + '<div class="pcr-chips">' + chips + '</div>' : '') +

        // El inventario dice QUÉ hay; lo que sigue dice cómo funciona el
        // sector: qué uso manda, cómo se llega, qué lo rodea y dónde está la
        // calle que concentra la actividad.
        bloqueUsoPredominante(st) +
        bloqueAlturas(st) +
        bloqueTerreno() +
        bloqueClima() +
        bloqueTrazado() +
        bloquePerfil() +
        bloqueEspacio(st) +
        bloqueAccesibilidad(st) +
        bloqueCampo() +
        bloqueSol(meta) +
        bloqueMovilidad(st) +
        bloqueAmbiente(st) +
        bloqueNucleos(st) +
        bloqueHitos(st) +
        bloqueAnillos(st, esPol) +
        bloqueCalor(res) +

        // Hacia dónde mira el sector. Solo aparece si de verdad hay un lado
        // que domina: señalar «el mayor» en un reparto parejo sería inventar
        // un patrón que no existe.
        (zonas.concentracion
          ? h4('campo', 'Dónde se concentra') +
            '<p class="pcr-conc">La mitad ' + esc(zonas.concentracion.rumbo.nombre) +
            ' reúne <b>' + zonas.concentracion.n + ' de ' + zonas.total + '</b> (' +
            zonas.concentracion.pct + '%). Es el lado más activo según los datos.</p>'
          : '') +

        h4('norte', 'A dónde ir') +
        tareas +

        // La síntesis va acá, después de todas las mediciones y antes de las
        // tareas: es el puente entre «esto es lo que hay» y «esto es lo que
        // vas a hacer».
        bloqueSintesis(res) +

        bloquePlan(res, zonas) +

        // De inventario a lista de tareas. Lo que el estudiante hace con esto
        // parado en la esquina, que es de lo que se trataba.
        bloqueRubros(st) +

        h4('ok', 'Qué verificar en campo') +
        '<ul class="pcr-check">' +
          (sinCategoria
            ? '<li>Los <b>' + sinCategoria + '</b> punto' + (sinCategoria === 1 ? '' : 's') +
              ' sin categoría: mirá qué son de verdad. Suelen ser usos que la clasificación no conoce todavía.</li>'
            : '') +
          (subs.length
            ? '<li>Tomá una muestra de <b>' + (TAX.filter(function (u) { return u.sub === subs[0].id; })[0] || {}).nombre +
              '</b> y comprobá que sigan abiertos. Los datos los pone gente voluntaria y envejecen.</li>'
            : '') +
          '<li>Anotá lo que <b>existe y no aparece acá</b>: eso es lo que el curso aporta al mapa.</li>' +
          (zonas.total === 0
            ? '<li>Este sector está entero sin mapear: cualquier cosa que levanten es información nueva.</li>'
            : '') +
        '</ul>' +

        '<label class="pcr-lab" for="pcr-nombre">Nombre del sector (opcional)</label>' +
        '<input id="pcr-nombre" class="pcr-nombre" type="text" maxlength="60" ' +
          'placeholder="Ej: La Playa, entre calles 8 y 12" ' +
          'value="' + esc(S.nombreSugerido || '') + '">' +

        // Lo que se ve en el mapa detrás de esta hoja.
        h4('mapa', 'En el mapa') +
        '<p class="pcr-pista">' + (S.puntosEnMapa || 0) + ' puntos pintados con el color de su categoría. ' +
        'Cerrá esta hoja para verlos; tocá uno para saber qué es.</p>' +
        '<div class="pcr-llevar">' +
          '<button type="button" data-pcr="estratos" class="pcr-mini pcr-llevar-b"' +
            (S.cargandoEstratos ? ' disabled' : '') + '>' +
            (S.cargandoEstratos ? 'Cargando…' : (S.estratos ? ico('apagar') + 'Quitar estratos' : ico('capas') + 'Pintar estratos')) +
          '</button>' +
        '</div>' +
        (S.estratos && S.estratos.leyenda ? S.estratos.leyenda : '') +

        '<div class="pcr-llevar">' +
          '<button type="button" data-pcr="guardar" class="pcr-mini pcr-llevar-b">' + ico('guardar') + 'Guardar ficha</button>' +
          '<button type="button" data-pcr="copiar" class="pcr-mini pcr-llevar-b">' + ico('copiar') + 'Copiar</button>' +
          '<button type="button" data-pcr="imprimir" class="pcr-mini pcr-llevar-b">' + ico('imprimir') + 'PDF</button>' +
          '<button type="button" data-pcr="lamina" class="pcr-mini pcr-llevar-b">' + ico('documento') + 'Lámina 60×90</button>' +
        '</div>' +
        '<p class="pcr-pista">La <b>lámina</b> arma una hoja vertical de 60 × 90 cm con el plano del ' +
        'sector y todo lo medido, lista para imprimir o colgar. Lo que no mediste no sale: ' +
        'medí el terreno, el clima y el trazado antes si querés que aparezcan.</p>' +

        // Guardar el ÁREA, no la ficha: queda en la misma lista de áreas de
        // Pro City, así que se puede volver a ella sin redibujarla y el
        // análisis de los mapeos del curso corre sobre exactamente el mismo
        // trazo que se reconoció. Es lo que junta las dos mitades.
        bloqueExportar() +

        (esPol
          ? '<div class="pcr-llevar">' +
              '<button type="button" data-pcr="guardar-area" class="pcr-mini pcr-llevar-b">' + ico('area') + 'Guardar el área dibujada</button>' +
            '</div>' +
            '<p class="pcr-pista">Queda guardada con el nombre de arriba. Después la volvés a cargar desde ' +
            '<b>Análisis → Áreas guardadas</b> y ahí se le suman los mapeos que haga el curso.</p>'
          : '<p class="pcr-pista">Para guardar el sector y volver a él sin redibujarlo, analizá por <b>área dibujada</b> en vez de por radio.</p>') +
        (S.aviso ? '<p class="pcr-aviso">' + esc(S.aviso) + '</p>' : '') +
        (S.textoPlano ? '<textarea class="pcr-plano" readonly rows="8">' + esc(S.textoPlano) + '</textarea>' : '') +

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
    if (S.cargando || !listoParaAnalizar()) return;
    /* La licencia se pide ACÁ, al tocar el botón, y no cuando el servidor
       rechace la consulta treinta segundos después. Ver el mapa y elegir el
       sector es gratis; analizarlo es lo que cuesta. */
    var LIC = window.URBIS_LICENCIA;
    if (LIC && typeof LIC.permitido === 'function' && !LIC.permitido()) {
      // La pantalla de licencia se abrió sola; acá no hay nada que decir.
      cerrar();
      return;
    }
    if (!window.AIA_DATOS || !window.AIA_DATOS.consultarEntorno) {
      S.error = 'Falta el módulo de datos (js/61). Recarga la página.'; pintar(); return;
    }
    if (!window.AIA_MOTOR || !window.AIA_MOTOR.analizar) {
      S.error = 'Falta el motor de análisis. Recarga la página.'; pintar(); return;
    }

    S.cargando = true; S.error = ''; S.aviso = ''; S.textoPlano = '';
    quitarDelMapa(); S.estratos = null; S.puntosEnMapa = 0;
    pintar();
    try {
      var esPol = S.forma === 'poligono';
      if (esPol && (!window.AIA_DATOS.consultarEntornoPoligono)) {
        throw new Error('Esta versión no sabe consultar áreas dibujadas. Recarga la página.');
      }

      var elementos = esPol
        ? await window.AIA_DATOS.consultarEntornoPoligono(S.poligono)
        : await window.AIA_DATOS.consultarEntorno(S.centro.lat, S.centro.lng, S.radioM);

      // El censo NO depende de lo que OpenStreetMap tenga mapeado: viene del
      // DANE. Es la mitad del análisis que siempre está completa, y por eso
      // conviene que el estudiante la vea incluso en un sector sin datos. Si
      // falla (sin red, o fuera de cobertura), el análisis sigue: se pierde la
      // población, no la ficha.
      var eje = esPol ? centroideDe(S.poligono) : S.centro;
      var ubic = null, dane = null;
      try {
        if (window.AIA_DATOS.ubicacionDe) ubic = await window.AIA_DATOS.ubicacionDe(eje.lat, eje.lng);
      } catch (e) { ubic = null; }
      try {
        if (window.AIA_DATOS.consultarDANE) {
          dane = await window.AIA_DATOS.consultarDANE(
            eje.lat, eje.lng, radioParaDane(), (ubic && ubic.ciudad) || '');
        }
      } catch (e) { dane = null; }

      var peticion = {
        elementos: elementos || [],
        tipoEstudio: 'completo',
        proyectoId: 'recomendar',
        direccionAprox: (ubic && ubic.ciudad) || '',
        dane: dane,
        caminabilidad: null
      };
      if (esPol) {
        // Ni centro ni radio: el servidor saca el centroide y el radio
        // equivalente del propio trazo. Mandarlos sería inventar un área que
        // el usuario no dibujó.
        peticion.poligono = S.poligono.map(function (p) { return { lat: p.lat, lng: p.lng }; });
      } else {
        peticion.radioM = S.radioM;
        peticion.centro = { lat: S.centro.lat, lng: S.centro.lng };
      }

      // Un sector sin datos NO es un fallo: es el resultado más interesante
      // que puede dar esta herramienta. Se sigue adelante con la lista vacía
      // para que la ficha lo diga con todas las letras.
      var res = await window.AIA_MOTOR.analizar(peticion);
      // La ubicación ya se consultó arriba para el DANE: se guarda con el
      // resultado en vez de volver a pedirla, y así viaja también a la ficha.
      if (ubic) res.ubicacion = ubic;
      S.resultado = res;
      S.huellaAnalizada = huellaDelArea(S.forma, S.poligono, S.centro, S.radioM);
      // La cobertura leída era la del sector ANTERIOR: dejarla puesta sería
      // mostrar el verde de otra parte junto a los datos de esta.
      S.cobertura = null; S.cobAviso = ''; S.cobEnMapa = false;
      try {
        var Aq = window.URBIS_PC_ANALISIS;
        if (Aq && typeof Aq.quitarRaster === 'function') Aq.quitarRaster();
      } catch (e) {}
      // Se pintan sin que haya que pedirlo: el sentido de mirar un sector
      // antes de ir es VERLO. Una lista de números no dice dónde está nada.
      S.puntosEnMapa = pintarPuntos(res.pois || []);
    } catch (e) {
      S.error = (e && e.message) || 'No se pudo consultar el sector.';
    }
    S.cargando = false;
    // Con resultado, la hoja se abre sola: ya no hay nada que ubicar en el
    // mapa y sí mucho que leer.
    if (S.resultado) {
      S.encogida = false; seguirAlMapa(false);
      /* Se guarda solo. Pedido explícito: «que lo que hice recientemente
         quede guardado ahí y no perderlo si me salgo de la pestaña». Un
         análisis cuesta una consulta a la red y varios segundos; perderlo por
         cerrar una hoja es el tipo de pérdida que no se perdona. El botón
         «Guardar ficha» sigue existiendo, y lo que hace ahora es ponerle
         nombre a esta misma entrada en vez de crear otra. */
      try {
        var ejeAuto = (S.resultado.meta && Number.isFinite(S.resultado.meta.lat))
          ? { lat: S.resultado.meta.lat, lng: S.resultado.meta.lng } : S.centro;
        S.fichaActualId = 'f' + Date.now();
        guardarFicha(S.resultado, zonasSinDatos(S.resultado.pois || [], ejeAuto),
                     S.nombreGuardado || '', S.fichaActualId);
      } catch (e) {}
    }
    pintar();
  }

  async function comparar(id) {
    var ficha = leerFichas().filter(function (f) { return f.id === id; })[0];
    if (!ficha) { S.error = 'Esa ficha ya no está guardada.'; pintar(); return; }
    S.comparando = true; S.error = ''; S.aviso = ''; pintar();
    try {
      S.comparacion = await compararConCampo(ficha);
      S.resultado = null;
    } catch (e) {
      S.error = (e && e.message) || 'No se pudo comparar.';
    }
    S.comparando = false;
    pintar();
  }

  // ── El antes y el después, para llevárselo ────────────────────────────
  /* La comparación es la conclusión del ejercicio: cuánto agregó el curso al
     mapa. Hasta ahora solo se podía mirar en la pantalla. Se copia, se
     imprime y se exporta como todo lo demás, y en el archivo cada punto va
     teñido por su CONCLUSIÓN —nuevo, confirmado, discrepante, sin
     verificar—, que es la lectura que se quiere de un vistazo en Google
     Earth: cuatro colores, cuatro conclusiones. */

  var ESTADO_COMP = {
    nuevo:        { etq: 'Nuevo del curso',  color: '#eab308' },
    confirmado:   { etq: 'Confirmado',       color: '#22c55e' },
    discrepancia: { etq: 'Discrepancia',     color: '#ec4899' },
    sin_verificar:{ etq: 'Sin verificar',    color: '#94a3b8' }
  };

  function comparacionComoTexto(c) {
    var f = c.ficha || {};
    var L = [];
    L.push('ANTES Y DESPUÉS — URBIS Pro City');
    L.push((f.nombre ? f.nombre + ' · ' : '') + new Date().toLocaleString('es-CO'));
    L.push('Reconocimiento del ' + new Date(f.ts).toLocaleDateString('es-CO') +
           ' contra lo que el curso lleva mapeado.');
    L.push('');
    L.push('OpenStreetMap tenía: ' + c.totalOsm);
    L.push('El curso mapeó: ' + c.totalCampo);
    L.push('Usos NUEVOS: ' + c.nuevos.length +
      (c.totalOsm > 0 ? ' (un ' + Math.round(c.nuevos.length / c.totalOsm * 100) + '% más de lo que había)' : ''));
    L.push('Confirmados: ' + c.confirmados.length);
    L.push('Discrepancias: ' + c.discrepancias.length);
    L.push('Sin verificar: ' + c.sinVerificar.length);
    L.push('');
    if (c.nuevos.length) {
      L.push('LO QUE EL CURSO AGREGÓ AL MAPA');
      c.nuevos.forEach(function (x) {
        L.push('  + ' + (x.nombre || 'Sin nombre') + ' · ' + (x.sub || ''));
      });
      L.push('');
    }
    if (c.discrepancias.length) {
      L.push('DONDE NO COINCIDEN');
      c.discrepancias.forEach(function (x) {
        L.push('  ! ' + (x.campo.nombre || 'Sin nombre') + ': el curso dice «' + (x.campo.grupo || '?') +
               '», OSM dice «' + (x.osm.grupo || '?') + '»');
      });
      L.push('');
    }
    if (c.sinVerificar.length) {
      L.push('SIN VERIFICAR (la lista para la próxima salida)');
      c.sinVerificar.forEach(function (x) {
        L.push('  [ ] ' + (x.nombre || 'Sin nombre') + ' · ' + (x.sub || ''));
      });
      L.push('');
    }
    L.push('Ninguna de las dos listas es la verdad: OpenStreetMap tiene lo que');
    L.push('alguien mapeó alguna vez, y el curso lo que alcanzó a caminar. La');
    L.push('diferencia entre las dos es el valor del trabajo de campo.');
    return L.join('\n');
  }

  function comparacionImprimible(c) {
    var f = c.ficha || {};
    var aporte = c.totalOsm > 0 ? Math.round(c.nuevos.length / c.totalOsm * 100) : null;
    function tabla(items, saca) {
      return '<ul class="check">' + items.map(function (x) {
        return '<li>' + esc(saca(x)) + '</li>';
      }).join('') + '</ul>';
    }
    return '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
      '<title>Antes y después · ' + esc(f.nombre || 'sector') + '</title><style>' +
      '@page{margin:16mm}' +
      'body{font:13px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;color:#12202e;margin:0}' +
      'h1{font-size:21px;margin:0 0 3px;color:#075E88}' +
      '.sub{color:#5a6472;font-size:12px;margin:0 0 18px}' +
      'h2{font-size:14px;margin:22px 0 7px;color:#075E88;border-bottom:1px solid #c7e7f7;padding-bottom:4px}' +
      '.kpis{display:flex;gap:22px;margin:0 0 6px;flex-wrap:wrap}' +
      '.kpi b{display:block;font-size:19px;color:#0A6F9E}' +
      '.kpi small{color:#5a6472;font-size:11px}' +
      '.kpi.oro b{color:#8a6400}' +
      '.check{margin:0;padding-left:18px;list-style:none}' +
      '.check li{margin-bottom:5px}' +
      '.check li:before{content:"☐  ";color:#9aa7b4}' +
      '.nota{margin-top:24px;padding:10px 12px;background:#f4f7fa;border:1px solid #e2e8f0;' +
        'border-radius:6px;font-size:11.5px;color:#4a5568}' +
      '</style></head><body>' +
      '<h1>Antes y después' + (f.nombre ? ' · ' + esc(f.nombre) : '') + '</h1>' +
      '<p class="sub">URBIS Pro City · ' + esc(new Date().toLocaleString('es-CO')) +
      ' · reconocimiento del ' + esc(new Date(f.ts).toLocaleDateString('es-CO')) + '</p>' +
      '<div class="kpis">' +
        '<div class="kpi"><b>' + c.totalOsm + '</b><small>tenía OSM</small></div>' +
        '<div class="kpi"><b>' + c.totalCampo + '</b><small>mapeó el curso</small></div>' +
        '<div class="kpi oro"><b>' + c.nuevos.length + '</b><small>usos nuevos</small></div>' +
        '<div class="kpi"><b>' + c.confirmados.length + '</b><small>confirmados</small></div>' +
        '<div class="kpi"><b>' + c.sinVerificar.length + '</b><small>sin verificar</small></div>' +
      '</div>' +
      (c.nuevos.length
        ? '<h2>Lo que el curso agregó al mapa</h2>' +
          '<p>' + c.nuevos.length + ' usos que no estaban en OpenStreetMap' +
          (aporte !== null ? ' — un ' + aporte + '% más de lo que había' : '') + '.</p>' +
          tabla(c.nuevos, function (x) { return (x.nombre || 'Sin nombre') + ' · ' + (x.sub || ''); })
        : '<h2>Lo que el curso agregó al mapa</h2><p>Todo lo mapeado ya estaba en OpenStreetMap: el aporte de esta salida fue de verificación.</p>') +
      (c.discrepancias.length
        ? '<h2>Donde no coinciden</h2>' +
          tabla(c.discrepancias, function (x) {
            return (x.campo.nombre || 'Sin nombre') + ': el curso dice «' + (x.campo.grupo || '?') +
                   '», OSM dice «' + (x.osm.grupo || '?') + '»';
          })
        : '') +
      (c.sinVerificar.length
        ? '<h2>Sin verificar — la lista para la próxima salida</h2>' +
          tabla(c.sinVerificar, function (x) { return (x.nombre || 'Sin nombre') + ' · ' + (x.sub || ''); })
        : '') +
      '<p class="nota"><b>Qué enseña este cuadro.</b> Ninguna de las dos listas es «la verdad». ' +
      'OpenStreetMap tiene lo que alguien alguna vez mapeó; el curso tiene lo que alcanzó a caminar. ' +
      'La diferencia entre las dos es, precisamente, el valor del trabajo de campo.</p>' +
      '</body></html>';
  }

  function datosDeComparacion(c) {
    var EXP = window.URBIS_PC_EXPORTAR, A = window.URBIS_PC_ANALISIS;
    if (!EXP || !A || !c) return null;
    var f = c.ficha || {};
    var pts = (f.forma === 'poligono' && f.poligono && f.poligono.length >= 3)
      ? f.poligono.map(function (p) { return { lat: p.lat, lng: p.lng }; })
      : (f.centro ? circuloComoContorno(f.centro, f.radioM || 500, 48) : null);
    if (!pts) return null;

    var puntos = [];
    function meter(p, estado, extra) {
      if (!p || !isFinite(p.lat) || !isFinite(p.lng)) return;
      var reg = {
        lat: Number(p.lat), lng: Number(p.lng),
        nombre: p.nombre || 'Sin nombre',
        grupo: ESTADO_COMP[estado].etq,
        gid: estado,
        fuente: (estado === 'sin_verificar') ? 'OpenStreetMap' : 'Mapeo del curso'
      };
      if (p.sub) reg.uso = nombreDeSub(p.sub);
      if (extra) Object.keys(extra).forEach(function (k) { reg[k] = extra[k]; });
      puntos.push(reg);
    }
    c.nuevos.forEach(function (p) { meter(p, 'nuevo'); });
    c.confirmados.forEach(function (x) { meter(x.campo, 'confirmado', { dist_m: x.distM }); });
    c.discrepancias.forEach(function (x) {
      meter(x.campo, 'discrepancia', { dist_m: x.distM, segun_osm: x.osm.grupo || '' });
    });
    c.sinVerificar.forEach(function (p) { meter(p, 'sin_verificar'); });

    var colores = {};
    Object.keys(ESTADO_COMP).forEach(function (k) { colores[k] = ESTADO_COMP[k].color; });

    return {
      pts: pts, puntos: puntos, geo: null, raster: null, cobertura: [],
      colores: colores, nombre: f.nombre || '',
      osm: c.sinVerificar.length, campo: puntos.length - c.sinVerificar.length,
      areaM2: A.areaM2(pts), perimetroM: A.perimetroM(pts, true)
    };
  }

  function bloqueLlevarComparacion(c) {
    var d = datosDeComparacion(c);
    return '' +
      h4('exportar', 'Llevarse el resultado') +
      '<p class="pcr-pista">El cuadro completo, para el informe del curso. En los archivos, cada punto va ' +
      'teñido por su conclusión: <b>nuevo</b>, confirmado, discrepante o sin verificar.</p>' +
      '<div class="pcr-llevar">' +
        '<button type="button" data-pcr="comp-copiar" class="pcr-mini pcr-llevar-b">' + ico('copiar') + 'Copiar</button>' +
        '<button type="button" data-pcr="comp-pdf" class="pcr-mini pcr-llevar-b">' + ico('imprimir') + 'PDF</button>' +
      '</div>' +
      (d
        ? '<div class="pcr-exp-btns">' +
            '<button type="button" data-pcr="comp-exp" data-f="paquete" class="pcr-mini pcr-exp-todo">' + ico('exportar') + 'Paquete completo (ZIP)</button>' +
            '<button type="button" data-pcr="comp-exp" data-f="kmz" class="pcr-mini">' + ico('mapa') + 'KMZ · Google Earth</button>' +
            '<button type="button" data-pcr="comp-exp" data-f="dxf" class="pcr-mini">' + ico('area') + 'DXF · AutoCAD</button>' +
            '<button type="button" data-pcr="comp-exp" data-f="svg" class="pcr-mini">' + ico('lapiz') + 'SVG · Corel</button>' +
            '<button type="button" data-pcr="comp-exp" data-f="geojson" class="pcr-mini">' + ico('capas') + 'GeoJSON · QGIS</button>' +
            '<button type="button" data-pcr="comp-exp" data-f="kml" class="pcr-mini">KML suelto</button>' +
          '</div>'
        : '') +
      (S.aviso ? '<p class="pcr-aviso">' + esc(S.aviso) + '</p>' : '') +
      (S.textoPlano ? '<textarea class="pcr-plano" readonly rows="8">' + esc(S.textoPlano) + '</textarea>' : '');
  }

  function htmlComparacion(c) {
    var f = c.ficha;
    var cuando = new Date(f.ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
    var comoSeLlama = f.nombre ? esc(f.nombre) : 'el sector';
    var aporte = c.totalOsm > 0 ? Math.round(c.nuevos.length / c.totalOsm * 100) : null;

    function lista(items, saca) {
      return '<ul class="pcr-comp-lista">' + items.slice(0, 8).map(function (x) {
        return '<li>' + esc(saca(x)) + '</li>';
      }).join('') + (items.length > 8 ? '<li class="pcr-mas">y ' + (items.length - 8) + ' más</li>' : '') + '</ul>';
    }

    return '' +
      barra('Modo educativo · Trabajo de campo', 'Antes y después', 'comparar') +
      '<div class="pcr-cuerpo">' +
        '<p class="pcr-intro">Reconocimiento de ' + comoSeLlama + ', del <b>' + esc(cuando) +
        '</b>, contra lo que el curso lleva mapeado en esa misma área.</p>' +

        '<div class="pcr-kpis">' +
          '<div class="pcr-kpi"><b>' + c.totalOsm + '</b><small>tenía OSM</small></div>' +
          '<div class="pcr-kpi"><b>' + c.totalCampo + '</b><small>mapeó el curso</small></div>' +
          '<div class="pcr-kpi pcr-kpi-oro"><b>' + c.nuevos.length + '</b><small>usos nuevos</small></div>' +
          '<div class="pcr-kpi"><b>' + c.confirmados.length + '</b><small>confirmados</small></div>' +
        '</div>' +

        (c.nuevos.length
          ? h4('mas', 'Lo que el curso agregó al mapa') +
            '<p class="pcr-conc">' + c.nuevos.length + ' usos que <b>no estaban en OpenStreetMap</b>' +
            (aporte !== null ? ' — un ' + aporte + '% más de lo que había' : '') + '. ' +
            'Esto es trabajo que nadie había hecho antes en este sector.</p>' +
            lista(c.nuevos, function (x) { return (x.nombre || 'Sin nombre') + ' · ' + (x.sub || ''); })
          : h4('mas', 'Lo que el curso agregó al mapa') +
            '<p class="pcr-ok">Todo lo que el curso mapeó ya estaba en OpenStreetMap. El aporte de esta salida fue de verificación, no de descubrimiento.</p>') +

        (c.discrepancias.length
          ? h4('alerta', 'Donde no coinciden') +
            '<p class="pcr-tarea-intro">Mismo sitio, categoría distinta. Puede que el local haya cambiado de uso, o que una de las dos clasificaciones esté equivocada. Vale la pena mirarlo.</p>' +
            lista(c.discrepancias, function (x) {
              return (x.campo.nombre || 'Sin nombre') + ': el curso dice «' + (x.campo.grupo || '?') +
                     '», OSM dice «' + (x.osm.grupo || '?') + '»';
            })
          : '') +

        (c.sinVerificar.length
          ? h4('ojo', 'Sin verificar') +
            '<p class="pcr-tarea-intro">' + c.sinVerificar.length + ' usos que OpenStreetMap tiene y el curso no visitó. ' +
            '<b>Esto no significa que hayan cerrado</b>: lo más probable es que nadie pasara por esas cuadras. Es la lista para la próxima salida.</p>' +
            lista(c.sinVerificar, function (x) { return (x.nombre || 'Sin nombre') + ' · ' + (x.sub || ''); })
          : '') +

        bloqueLlevarComparacion(c) +

        '<div class="pcr-nota">' +
          '<b>Qué enseña este cuadro.</b> Ninguna de las dos listas es «la verdad». ' +
          'OpenStreetMap tiene lo que alguien alguna vez mapeó; el curso tiene lo que alcanzó a caminar. ' +
          'La diferencia entre las dos es, precisamente, el valor del trabajo de campo.' +
        '</div>' +

        '<button type="button" data-pcr="volver" class="pcr-principal pcr-secundario">Volver</button>' +
      '</div>';
  }

  async function alternarEstratos() {
    if (S.cargandoEstratos) return;
    if (S.estratos) { await pintarEstratos(false); S.estratos = null; pintar(); return; }
    S.cargandoEstratos = true; S.aviso = ''; pintar();
    var r = await pintarEstratos(true);
    S.cargandoEstratos = false;
    if (!r.ok) { S.estratos = null; S.aviso = r.error; pintar(); return; }
    // Verlas es bajar la hoja: las manzanas están justo debajo.
    S.encogida = true;

    // La leyenda: sin ella los colores son adivinanza. «Sin estrato» va al
    // final porque es la excepción del mapa —industrial, dotacional, lotes—,
    // no el escalón anterior al 1.
    var presentes = [];
    r.manzanas.forEach(function (mz) { if (presentes.indexOf(mz.estrato) === -1) presentes.push(mz.estrato); });
    presentes.sort(function (a, b) { return (a === 0) - (b === 0) || a - b; });
    S.estratos = {
      n: r.n,
      leyenda: '<div class="pcr-leyenda"><b>Estratificación DANE · ' + r.n + ' manzanas</b>' +
        presentes.map(function (n) {
          return '<span><i style="background:' + ((r.colores && r.colores[n]) || '#6b7280') + '"></i>' +
                 (n ? n : 'S/E') + '</span>';
        }).join('') +
        '<em>S/E = sin estrato (industrial, dotacional o lotes)</em></div>'
    };
    S.aviso = 'Estratos pintados. Cerrá esta hoja para verlos.';
    pintar();
  }

  // ── Entrada y salida ──────────────────────────────────────────────────
  /* La huella del área analizada, para saber si la que hay ahora es la misma.
     Con los vértices redondeados: mover el mapa un metro no es cambiar de
     sector. */
  function huellaDelArea(forma, poligono, centro, radioM) {
    if (forma === 'poligono' && poligono && poligono.length >= 3) {
      return 'p|' + poligono.map(function (p) {
        return p.lat.toFixed(5) + ',' + p.lng.toFixed(5);
      }).join(';');
    }
    if (centro) return 'r|' + centro.lat.toFixed(5) + ',' + centro.lng.toFixed(5) + '|' + radioM;
    return '';
  }

  function abrir() {
    if (!mapa()) { alert('El mapa aún no está listo.'); return; }
    S.abierto = true;
    S.error = '';
    // Si viene de dibujar un área, esa es la que quiere analizar. Obligarlo a
    // elegirla de nuevo sería no haber mirado lo que acababa de hacer.
    var pol = poligonoDeProCity();
    if (pol) { S.poligono = pol; S.forma = 'poligono'; }
    if (!S.centro) tomarCentro();
    /* El análisis SOBREVIVE a cerrar la hoja. Antes no: al volver a entrar por
       la lupa se borraba, y el estudiante tenía que volver a consultar la red
       y esperar por algo que ya había hecho hace un minuto. Solo se descarta
       si el área cambió —otro polígono, otro centro, otro radio—, porque
       entonces la ficha hablaría de un sector que ya no es el que está
       elegido, y eso es peor que perderla. */
    var ahora = huellaDelArea(S.forma, S.poligono, S.centro, S.radioM);
    /* Y si el área dibujada se borró desde Pro City, la ficha habla de algo
       que ya no está seleccionado: también se descarta. Se pregunta al módulo
       de análisis y solo se hace caso cuando está cargado —si no lo está, no
       sabemos nada y borrar sería peor que esperar—. */
    var A0 = window.URBIS_PC_ANALISIS;
    var areaBorrada = !!(A0 && typeof A0.hayArea === 'function' &&
                         !A0.hayArea() && S.huellaAnalizada.slice(0, 2) === 'p|');
    if (S.resultado && S.huellaAnalizada && (ahora !== S.huellaAnalizada || areaBorrada)) {
      S.resultado = null; S.huellaAnalizada = ''; S.trazado = null; S.terreno = null;
      /* El clima y el nombre también. Se quedaron fuera de esta lista la
         primera vez y el resultado era feo de encontrar: como el análisis
         siguiente se guarda solo, el sector nuevo quedaba archivado con el
         nombre del anterior y con SU climatología —del sitio de al lado o de
         otro barrio— pegada encima. Nadie lo nota mirando la ficha; se nota
         meses después, cuando los datos ya no se pueden creer. */
      S.clima = null; S.nombreGuardado = ''; S.nombreSugerido = ''; S.campo = null;
      S.cobertura = null; S.cobEnMapa = false; S.calor = [];
      S.trzHuellas = null; pintarLlenos(false);
    }
    if (!S.centro) tomarCentro();
    pintarCirculo();
    pintar();
  }

  /* El acceso directo para volver. Con la hoja cerrada, el análisis sigue en
     memoria pero no hay ni una señal de que exista: el estudiante cierra para
     ver el mapa y ya no sabe cómo volver sin repetirlo todo. Este botón está
     mientras haya algo a lo que volver, y desaparece cuando no. */
  function volverBtn() {
    var el = document.getElementById('pcr-volver');
    if (!el) {
      el = document.createElement('button');
      el.id = 'pcr-volver';
      el.type = 'button';
      el.className = 'pcr-volver';
      el.addEventListener('click', function () { S.encogida = false; abrir(); });
      document.body.appendChild(el);
    }
    return el;
  }

  function pintarVolver() {
    var el = volverBtn();
    var hay = !!S.resultado && !S.abierto && !!window.urbisProCityActivo;
    el.hidden = !hay;
    if (!hay) return;
    var st = (S.resultado.stats) || {};
    var nombre = (S.nombreGuardado || '').trim();
    el.innerHTML = ico('lupa', 18) +
      '<span><b>' + esc(nombre || 'Volver al análisis') + '</b>' +
      '<small>' + (st.total || 0) + ' usos · ' +
      (S.resultado.meta && S.resultado.meta.forma === 'poligono'
        ? esc(formatearArea(S.resultado.meta.areaM2) || 'área dibujada')
        : (S.radioM >= 1000 ? (S.radioM / 1000) + ' km' : S.radioM + ' m')) +
      '</small></span>';
    el.setAttribute('aria-label', 'Volver al análisis del sector, sin repetirlo');
  }

  function cerrar() {
    S.abierto = false;
    borrarCirculo();
    // Los puntos y los estratos SE QUEDAN: cerrar la hoja es justamente lo
    // que se hace para poder mirarlos. Se van cuando se analiza otra cosa o
    // con «Quitar del mapa».

    var h = document.getElementById('pcr-hoja');
    if (h) h.classList.remove('pcr-visible');
    pintarVolver();
  }

  // ── La pestaña «Sector» ───────────────────────────────────────────────
  /* Pedido explícito: que el análisis recién hecho quede en las pestañas de
     Pro City —junto a Cooperativo, Amigos y Análisis— y no se pierda al salir.
     Acá no se consulta la red: todo sale de lo que se guardó, así que la
     pestaña funciona sin señal, que es justo cuando se necesita en campo. */

  function fmtFecha(ts) {
    try {
      return new Date(ts).toLocaleDateString('es-CO',
        { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return ''; }
  }

  /* Una ficha guardada, con la forma que esperan los bloques que se
     escribieron para un resultado recién traído. Son los mismos datos con
     otro envoltorio: sin esto habría que duplicar el plan, el impreso y el
     texto, uno para lo vivo y otro para lo guardado. */
  function comoResultado(f) {
    return {
      stats: f.stats || { total: f.total, porGrupo: f.porGrupo, porSub: f.porSub },
      pois: f.pois || [],
      ubicacion: f.ubicacion || null,
      meta: { forma: f.forma, areaM2: f.areaM2, radioM: f.radioM,
              perimetroM: f.perimetroM || null, vertices: f.vertices || 0,
              poligono: f.poligono || null,
              lat: f.centro && f.centro.lat, lng: f.centro && f.centro.lng }
    };
  }
  function comoZonas(f) {
    if (!f.zonas) return { vacios: [], flojos: [], total: (f.pois || []).length };
    return {
      vacios: (f.zonas.vacios || []).map(function (x) { return { id: x.id, nombre: x.nombre }; }),
      flojos: (f.zonas.flojos || []).map(function (x) {
        return { rumbo: { id: x.id, nombre: x.nombre }, n: x.n };
      }),
      total: f.zonas.total != null ? f.zonas.total : (f.pois || []).length,
      concentracion: null
    };
  }

  function informeGuardado(f) {
    var st = f.stats;
    // El bloque del trazado lee S.trazado; para pintar el de una ficha
    // guardada se le presta el suyo y se devuelve el estado como estaba.
    var trzAntes = S.trazado, terAntes = S.terreno, cliAntes = S.clima, cmpAntes = S.campo;
    if (!st) {
      return '<p class="pcr-pista">Esta ficha se guardó con una versión anterior y solo tiene los ' +
        'totales. Volvé a analizar el sector para tener el informe completo.</p>';
    }
    var esPol = f.forma === 'poligono';
    var z = f.zonas || null;
    var tam = esPol ? formatearArea(f.areaM2) : ((f.radioM || 0) + ' m de radio');

    var filas = Object.keys(st.porGrupo || {})
      .map(function (g) { return { id: g, n: st.porGrupo[g] || 0 }; })
      .filter(function (x) { return x.n > 0 && x.id !== 'otro'; })
      .sort(function (a, b) { return b.n - a.n; });
    var mayor = filas.length ? filas[0].n : 1;

    return '<div class="pcr-informe">' +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + (st.total || 0) + '</b><small>usos registrados</small></div>' +
        '<div class="pcr-kpi"><b>' + esc(tam) + '</b><small>' + (esPol ? 'área' : 'alcance') + '</small></div>' +
        '<div class="pcr-kpi"><b>' + (st.densidadPorHa != null ? Number(st.densidadPorHa).toFixed(1) : '—') +
          '</b><small>por hectárea</small></div>' +
      '</div>' +
      bloqueUbicacion(f.ubicacion, st, comoResultado(f).meta) +
      bloqueLote(comoResultado(f).meta, esPol) +
      bloquePoblacion(st, esPol) +
      bloqueDemografia(st) +
      (filas.length
        ? h4('capas', 'Qué hay, por categoría') +
          filas.map(function (x) {
            return '<div class="pcr-fila">' +
              '<span class="pcr-fila-nom">' + esc(nombreGrupo(x.id)) + '</span>' +
              '<span class="pcr-fila-barra"><i style="width:' + Math.round(x.n / mayor * 100) + '%"></i></span>' +
              '<span class="pcr-fila-n">' + x.n + '</span></div>';
          }).join('')
        : '') +
      bloqueUsoPredominante(st) +
      (function () {
        // Con el trazado guardado, las alturas salen de su muestra —la
        // completa— igual que en la ficha viva.
        S.trazado = f.trazado || null;
        S.terreno = f.terreno || null;
        S.clima = f.clima || null;
        S.campo = f.campo || null;
        var html = bloqueAlturas(st) + (f.terreno ? bloqueTerreno() : '') +
                   (f.clima ? bloqueClima() : '') + (f.trazado ? bloqueTrazado() : '') +
                   (f.trazado ? bloquePerfil() : '') +
                   (f.trazado ? bloqueEspacio(st) : '') + bloqueAccesibilidad(st) +
                   (f.campo ? bloqueCampo() : '') +
                   bloqueSintesis(comoResultado(f));
        S.trazado = trzAntes; S.terreno = terAntes; S.clima = cliAntes; S.campo = cmpAntes;
        return html;
      })() +
      bloqueSol(comoResultado(f).meta) +
      bloqueMovilidad(st) +
      bloqueAmbiente(st) +
      coberturaGuardada(st.cobertura) +
      bloqueNucleos(st) +
      bloqueHitos(st) +
      bloqueAnillos(st, esPol) +
      bloqueRubros(st) +
      // El reparto de la salida, reconstruido de lo guardado: es lo que se
      // imprime la víspera para repartir a la mañana siguiente.
      bloquePlan(comoResultado(f), comoZonas(f)) +
      (z && (z.vacios.length || z.flojos.length)
        ? '<h4 class="pcr-h">A dónde ir</h4><ul class="pcr-tareas">' +
          z.vacios.map(function (r) { return '<li><b>Al ' + esc(r.nombre) + '</b> — sin un solo registro</li>'; }).join('') +
          z.flojos.map(function (r) {
            return '<li><b>Al ' + esc(r.nombre) + '</b> — apenas ' + r.n + ' registro' + (r.n === 1 ? '' : 's') + '</li>';
          }).join('') + '</ul>'
        : '') +
      (z && z.concentracion
        ? '<p class="pcr-conc">La mitad ' + esc(z.concentracion.nombre) + ' reúne <b>' +
          z.concentracion.n + ' de ' + z.total + '</b> (' + z.concentracion.pct + '%).</p>'
        : '') +
    '</div>';
  }

  /* Los mismos interruptores de calor, pero sobre un sector YA guardado: se
     puede volver semanas después y encender solo lo que interesa. Los puntos
     salen de la ficha, así que esto funciona sin red. */
  function chipsCalorGuardado(f) {
    var pois = f.pois || [];
    if (!pois.length) return '';
    var cuenta = {};
    pois.forEach(function (p) { if (p.grupo && p.grupo !== 'otro') cuenta[p.grupo] = (cuenta[p.grupo] || 0) + 1; });
    var grupos = Object.keys(cuenta).sort(function (a, b) { return cuenta[b] - cuenta[a]; });
    if (!grupos.length) return '';

    function chip(cal, texto, n, color) {
      var on = S.calorGuardado.ficha === f.id && S.calorGuardado.cal === cal;
      return '<button type="button" class="pcr-cal-chip' + (on ? ' on' : '') + '"' +
        ' data-u52-call="pcr-calorcat" data-id="' + esc(f.id) + '" data-cal="' + esc(cal) + '"' +
        (color ? ' style="--cal:' + esc(color) + '"' : '') + '>' +
        '<i></i>' + esc(texto) + (n != null ? ' <b>' + n + '</b>' : '') + '</button>';
    }

    return h4('calor', 'Mapa de calor de este sector') +
      '<p class="pcr-pista">Se pinta en el mapa; esta hoja se cierra sola para dejarlo ver.</p>' +
      '<div class="pcr-calor-chips">' +
        chip('todos', 'Todos los usos', pois.length, null) +
        grupos.map(function (g) {
          return chip('g:' + g, nombreGrupo(g), cuenta[g], colorDelCatalogo(g));
        }).join('') +
      '</div>';
  }

  function exportarGuardado(f) {
    var EXP = window.URBIS_PC_EXPORTAR;
    if (!EXP || typeof EXP.bloque !== 'function') return '';
    var d = datosParaExportar(f);
    if (!d) return '';
    // Mismos botones que en el análisis por área, con prefijo propio para que
    // los clics no acaben exportando el área de Pro City, que es otra cosa.
    try { return EXP.bloque(d, 'pcr-'); } catch (e) { return ''; }
  }

  // La cobertura de un sector guardado: los mismos números, sin la imagen.
  function coberturaGuardada(c) {
    if (!c || !c.clases || !c.clases.length) return '';
    var orden = c.clases.slice().sort(function (a, b) { return b.pct - a.pct; });
    var verde = c.clases.filter(function (x) { return x.id === 'verde'; })[0] || { pct: 0 };
    return h4('satelite', 'Cobertura medida en la foto') +
      '<div class="pcr-cob-barra">' +
        orden.filter(function (x) { return x.pct > 0; }).map(function (x) {
          return '<i style="width:' + x.pct + '%;background:' + x.color + '"></i>';
        }).join('') +
      '</div>' +
      '<div class="pcr-cob-lista">' +
        orden.filter(function (x) { return x.pct > 0; }).map(function (x) {
          return '<div class="pcr-cob-fila">' +
            '<span class="pcr-cob-pin" style="background:' + x.color + '"></span>' +
            '<span class="pcr-cob-etq">' + (x.ico ? icoCat(x.ico, 14) : '') + esc(x.etq) + '</span>' +
            '<b>' + x.pct + '%</b><small>' + Math.round(x.m2).toLocaleString('es-CO') + ' m²</small>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<p class="pcr-pista">' + verde.pct + '% de vegetación viva cuando se analizó, sobre ' +
      esc(String(c.malla || '')) + ' píxeles. Para volver a verlo pintado en el mapa hay que releer la foto.</p>';
  }

  function htmlPestana() {
    var fichas = leerFichas();
    if (!fichas.length) {
      return '<div class="u52-empty-card"><span class="pcr-vacio-ico">' + ico('lupa', 26) + '</span><div>' +
        '<b>Todavía no analizaste ningún sector</b>' +
        '<small>Con la lupa del mapa mirás qué hay en un sector antes de ir a mapearlo. ' +
        'Cada análisis queda guardado acá.</small></div></div>' +
        '<div class="pcr-pest-pie">' +
          '<button type="button" class="pcr-mini" data-u52-call="pcr-nuevo">' + ico('lupa', 16) + 'Analizar un sector</button>' +
        '</div>';
    }
    var hayCampo = puntosDelCurso().length > 0;

    return '<div class="pcr-pestana">' +
      '<p class="pcr-pista">Cada sector que analizaste queda acá con su informe completo, ' +
      'aunque cierres la app. Cargá el área para que los mapeos del curso se sumen a lo que ya se sabía.</p>' +
      fichas.map(function (f) {
        var abierta = S.pestanaAbierta === f.id;
        var tam = f.forma === 'poligono' ? formatearArea(f.areaM2) : ((f.radioM || 0) + ' m');
        /* La tarjeta muestra la FORMA del sector —el polígono real o el
           círculo del radio— como miniatura de mapa, no un emoji. Es lo que
           permite reconocer un sector guardado de un vistazo, como en
           cualquier app de mapas. La dibuja js/24 para que esta lista y la de
           «Áreas guardadas» se vean como la misma cosa. */
        var A = window.URBIS_PC_ANALISIS;
        var mini = (A && typeof A.miniatura === 'function')
          ? A.miniatura(
              (f.forma === 'poligono' && f.poligono && f.poligono.length >= 3)
                ? { pts: f.poligono }
                : { centro: f.centro, radioM: f.radioM || 500 },
              { w: 108, h: 76, clase: 'pcr-pest-mini', etiqueta: 'Forma del sector ' + (f.nombre || '') })
          : '';
        var cuando = (A && typeof A.haceCuanto === 'function') ? A.haceCuanto(f.ts) : fmtFecha(f.ts);
        var ico = function (n, t) { return window.URBIS_ICONO ? window.URBIS_ICONO(n, { tam: t || 18 }) : ''; };
        return '<div class="pcr-pest-ficha' + (abierta ? ' abierta' : '') + '">' +
          '<button type="button" class="pcr-pest-cab" data-u52-call="pcr-ver" data-id="' + esc(f.id) + '"' +
            ' aria-expanded="' + (abierta ? 'true' : 'false') + '">' +
            (mini || '<span class="pcr-pest-ico">' + ico(f.forma === 'poligono' ? 'area' : 'radio', 22) + '</span>') +
            '<span class="pcr-pest-t">' +
              '<b>' + esc(f.nombre || ('Sector del ' + fmtFecha(f.ts))) + '</b>' +
              '<span class="pcr-pest-dato">' + esc(tam) + '</span>' +
              '<small>' + (f.total || 0) + ' uso' + ((f.total || 0) === 1 ? '' : 's') + ' · ' + esc(cuando) + '</small>' +
            '</span>' +
            '<span class="pcr-pest-fl">' + ico(abierta ? 'abajo' : 'chevron', 18) + '</span>' +
          '</button>' +
          (abierta
            ? '<div class="pcr-pest-cuerpo">' +
                informeGuardado(f) +
                chipsCalorGuardado(f) +
                exportarGuardado(f) +
                '<div class="pcr-llevar">' +
                  (f.forma === 'poligono'
                    ? '<button type="button" class="pcr-mini pcr-llevar-b" data-u52-call="pcr-area" data-id="' +
                      esc(f.id) + '">' + ico('area', 16) + 'Cargar el área en Análisis</button>'
                    : '') +
                  '<button type="button" class="pcr-mini pcr-llevar-b" data-u52-call="pcr-copiar" data-id="' +
                    esc(f.id) + '">' + ico('copiar') + 'Copiar</button>' +
                  '<button type="button" class="pcr-mini pcr-llevar-b" data-u52-call="pcr-pdf" data-id="' +
                    esc(f.id) + '">' + ico('imprimir') + 'PDF</button>' +
                  '<button type="button" class="pcr-mini pcr-llevar-b" data-u52-call="pcr-lamina" data-id="' +
                    esc(f.id) + '">' + ico('documento') + 'Lámina 60×90</button>' +
                  (hayCampo
                    ? '<button type="button" class="pcr-mini pcr-llevar-b" data-u52-call="pcr-comparar" data-id="' +
                      esc(f.id) + '">' + ico('comparar', 16) + 'Comparar con el campo</button>'
                    : '') +
                  '<button type="button" class="pcr-mini pcr-llevar-b" data-u52-call="pcr-borrar" data-id="' +
                    esc(f.id) + '">' + ico('borrar', 16) + 'Borrar</button>' +
                '</div>' +
                (f.forma !== 'poligono'
                  ? '<p class="pcr-pista">Este sector se analizó por radio, así que no hay un área que cargar. ' +
                    'Analizá por <b>área dibujada</b> si querés que el análisis de los mapeos corra sobre el mismo trazo.</p>'
                  : '') +
              '</div>'
            : '') +
        '</div>';
      }).join('') +
      '<div class="pcr-pest-pie">' +
        '<button type="button" class="pcr-mini" data-u52-call="pcr-nuevo">' + ico('lupa', 16) + 'Analizar otro sector</button>' +
      '</div>' +
      (S.avisoPestana ? '<p class="pcr-aviso">' + esc(S.avisoPestana) + '</p>' : '') +
    '</div>';
  }

  // Las acciones de la pestaña. Las despacha js/20, que es el dueño de la
  // hoja donde vive; por eso repinta él y no `pintar()`, que es de la otra.
  function accionPestana(name, el) {
    var id = el && el.getAttribute ? el.getAttribute('data-id') : '';
    var f = id ? leerFichas().filter(function (x) { return x.id === id; })[0] : null;
    var repintar = function () {
      try { if (typeof window.urbisProCityAbrirSector === 'function') window.urbisProCityAbrirSector(); } catch (e) {}
    };

    if (name === 'nuevo') {
      S.avisoPestana = '';
      try { if (typeof window.urbisProCityCerrarStats === 'function') window.urbisProCityCerrarStats(); } catch (e) {}
      abrir();
      return true;
    }
    if (name === 'ver') {
      S.pestanaAbierta = (S.pestanaAbierta === id) ? '' : id;
      S.avisoPestana = '';
      repintar(); return true;
    }
    if (name === 'borrar') {
      if (!confirm('¿Borrar este análisis de sector?')) return true;
      borrarFicha(id);
      if (S.pestanaAbierta === id) S.pestanaAbierta = '';
      S.avisoPestana = '';
      repintar(); return true;
    }
    if (name === 'area') {
      var A = window.URBIS_PC_ANALISIS;
      if (!f || !f.poligono || f.poligono.length < 3 || !A || typeof A.guardarAreaConNombre !== 'function') {
        S.avisoPestana = 'Este sector no tiene un área dibujada que cargar.';
        repintar(); return true;
      }
      // Se guarda con su nombre y se carga: a partir de ahí el análisis de
      // Pro City —el de los mapeos del curso— corre sobre exactamente el
      // mismo trazo que se reconoció. Es lo que suma las dos mitades.
      var nom = f.nombre || ('Sector del ' + fmtFecha(f.ts));
      var area = A.guardarAreaConNombre(nom, f.poligono.map(function (q) {
        return { lat: q.lat, lng: q.lng };
      }));
      if (area && typeof A.cargarAreaPorId === 'function') A.cargarAreaPorId(area.id);
      return true;
    }
    if (name.indexOf('exp-') === 0) {
      var EXP2 = window.URBIS_PC_EXPORTAR;
      var fx = leerFichas().filter(function (x) { return x.id === S.pestanaAbierta; })[0];
      var dx = fx ? datosParaExportar(fx) : null;
      if (!EXP2 || !dx) {
        S.avisoPestana = 'Este sector no tiene un contorno que exportar.';
        repintar(); return true;
      }
      EXP2.accion(name, dx);
      return true;
    }
    if (name === 'calorcat') {
      var A3 = window.URBIS_PC_ANALISIS;
      var cal = el && el.getAttribute ? el.getAttribute('data-cal') : 'todos';
      if (!f || !A3 || typeof A3.calorExterno !== 'function') {
        S.avisoPestana = 'No se pudo pintar el calor de este sector.';
        repintar(); return true;
      }
      // Tocar el mismo chip encendido lo apaga: es un interruptor.
      if (S.calorGuardado.ficha === f.id && S.calorGuardado.cal === cal) {
        S.calorGuardado = { ficha: '', cal: '' };
        A3.calorExterno(null);
        repintar(); return true;
      }
      var sel = (cal === 'todos')
        ? (f.pois || [])
        : (f.pois || []).filter(function (p) { return 'g:' + p.grupo === cal; });
      if (!sel.length) {
        S.avisoPestana = 'Ese grupo no tiene puntos guardados en este sector.';
        repintar(); return true;
      }
      S.calorGuardado = { ficha: f.id, cal: cal };
      A3.calorExterno(
        sel.map(function (q) { return { lat: q.lat, lng: q.lng }; }),
        cal === 'todos' ? null : colorDelCatalogo(cal.slice(2)),
        (cal === 'todos' ? (f.nombre || 'Sector guardado')
                                 : nombreGrupo(cal.slice(2)) + ' · ' + (f.nombre || 'sector guardado')),
        function () { S.calorGuardado = { ficha: '', cal: '' }; });
      try { if (typeof window.urbisProCityCerrarStats === 'function') window.urbisProCityCerrarStats(); } catch (e) {}
      return true;
    }
    if (name === 'pdf') {
      if (!f) return true;
      var htmlG = htmlImprimible(comoResultado(f), comoZonas(f),
                                 { nombre: f.nombre || '', cobertura: (f.stats && f.stats.cobertura) || null,
                                   // El trazado y el terreno de ESTA ficha, no los del
                                   // último sector medido.
                                   trazado: f.trazado || null, terreno: f.terreno || null,
                                   clima: f.clima || null });
      var abrirG = window.AIA_INFORME && window.AIA_INFORME.abrirVentanaImpresion;
      if (abrirG) { abrirG(htmlG); return true; }
      var wG = window.open('', '_blank');
      if (!wG) {
        S.avisoPestana = 'Permití las ventanas emergentes para poder imprimir.';
        repintar(); return true;
      }
      wG.document.write(htmlG); wG.document.close();
      setTimeout(function () { try { wG.focus(); wG.print(); } catch (e) {} }, 600);
      return true;
    }
    if (name === 'lamina') {
      if (!f) return true;
      // La lámina de ESTA ficha: su nombre, su terreno, su clima, su trazado.
      // Si se dejara leer el estado, un sector guardado en marzo saldría con
      // el relieve del último sector medido hoy, que es un error que nadie
      // detecta mirando la hoja impresa.
      abrirImpresion(
        laminaImprimible(comoResultado(f), {
          nombre: f.nombre || '',
          trazado: f.trazado || null, terreno: f.terreno || null,
          clima: f.clima || null, campo: f.campo || null, huellas: null
        }),
        function (m) { S.avisoPestana = m; repintar(); });
      return true;
    }
    if (name === 'copiar') {
      if (!f) return true;
      var txt = fichaComoTexto(comoResultado(f), comoZonas(f));
      var ok = function () { S.avisoPestana = 'Copiado. Pegalo en tus notas o en un chat.'; repintar(); };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, ok);
        else ok();
      } catch (e) { ok(); }
      return true;
    }
    if (name === 'comparar') {
      try { if (typeof window.urbisProCityCerrarStats === 'function') window.urbisProCityCerrarStats(); } catch (e) {}
      abrir();
      comparar(id);
      return true;
    }
    return false;
  }

  window.URBIS_PC_RECON = {
    abrir: abrir,
    cerrar: cerrar,
    analizar: analizar,
    abierto: function () { return S.abierto; },
    // Se exponen para poder comprobarlos sin montar la app entera: el reparto
    // por rumbos es la parte que decide a dónde se manda a un estudiante.
    zonasSinDatos: zonasSinDatos,
    compararListas: compararListas,
    pintarEstratos: pintarEstratos,
    quitarDelMapa: quitarDelMapa,
    compararConCampo: compararConCampo,
    // La conclusión del ejercicio, en texto y como paquete exportable.
    comparacionComoTexto: comparacionComoTexto,
    datosDeComparacion: datosDeComparacion,
    leerFichas: leerFichas,
    guardarFicha: guardarFicha,
    // Cobertura leída de la foto y el paquete que se lleva a otro programa.
    // Se exponen para poder comprobarlos sin depender de una descarga real.
    cobertura: function () { return S.cobertura; },
    datosParaExportar: datosParaExportar,
    contornoDelSector: contornoDelSector,
    // La pestaña «Sector» de Pro City: js/20 pide el HTML y despacha los clics.
    htmlPestana: htmlPestana,
    accion: accionPestana,
    hayFichas: function () { return leerFichas().length; },
    fichaComoTexto: fichaComoTexto,
    rumboDe: rumboDe,
    rumboDe360: rumboDe360,
    estado: function () {
      return {
        forma: S.forma,
        radioM: S.radioM,
        centro: S.centro,
        vertices: S.poligono ? S.poligono.length : 0,
        areaM2: Math.round(areaDelPoligono()),
        hay: !!S.resultado
      };
    }
  };
})();
