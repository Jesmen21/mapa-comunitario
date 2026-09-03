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
    cobEnMapa: false
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
      ambiente: st.ambiente || null,
      movilidad: mv ? {
        nViasArterias: mv.nViasArterias, paradasBus: mv.paradasBus,
        ciclorrutas: mv.ciclorrutas, scoreAcceso: mv.scoreAcceso,
        exposicion: mv.exposicion, nivelExposicion: mv.nivelExposicion,
        viaPrincipal: mv.viaPrincipal || null,
        viasArterias: (mv.viasArterias || []).slice(0, 4)
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
      forma: meta.forma || 'radio',
      centro: { lat: meta.lat, lng: meta.lng },
      radioM: meta.radioM,
      areaM2: meta.areaM2 || null,
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
      '<h2>Qué hay, por categoría</h2><table>' + filas(st.porGrupo, nombreGrupo) + '</table>' +
      '<h2>Lo más repetido</h2><table>' + filas(st.porSub, function (id) {
        var t = TAX.filter(function (u) { return u.sub === id; })[0];
        return t ? t.nombre : id;
      }) + '</table>' +
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
  var capaPuntos = null, capaEstratos = null;

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
        '<b>' + (p.icono ? p.icono + ' ' : '') + esc(p.nombre || 'Sin nombre') + '</b><br>' +
        esc(g.t || g.nombre || p.grupo || 'sin categoría') +
        (p.distM != null ? ' · ' + p.distM + ' m' : '') +
        (sinCategoria ? '<br><em>Sin categoría: verificar en campo</em>' : '')
      ).addTo(capaPuntos);
    });
    return pois.length;
  }

  function quitarDelMapa() {
    var m = mapa();
    [capaPuntos, capaEstratos].forEach(function (c) {
      if (c && m) { try { m.removeLayer(c); } catch (e) {} }
    });
    capaPuntos = null; capaEstratos = null;
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
             '. La encontrás en la pestaña 🔍 Sector, con ' + g.n + ' más.')
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
            return (d.i ? d.i + ' ' : '') + (d.t || d.nombre || x.id) + ' · ' + x.n;
          }),
          datasets: [{
            data: datos.map(function (x) { return x.n; }),
            backgroundColor: datos.map(function (x) { return COL[x.id] || '#94a3b8'; }),
            borderColor: '#ffffff', borderWidth: 2
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '56%',
          plugins: { legend: { position: 'bottom',
            labels: { color: '#3f4b5c', font: { size: 10 }, boxWidth: 10, padding: 8 } } }
        }
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
              ? '<b>✏️ El área dibujada</b>' +
                (hayPol ? '<small>' + (formatearArea(areaDelPoligono()) || '') + '</small>'
                        : '<small>todavía no hay ninguna</small>')
              : '<b>⭕ Un radio</b><small id="pcr-eco">' +
                (S.centro ? S.centro.lat.toFixed(5) + ', ' + S.centro.lng.toFixed(5) : 'mové el mapa') +
                '</small>') +
          '</div>' +
          '<button type="button" data-pcr="agrandar" class="pcr-mini-mas" aria-label="Más opciones">⋯</button>' +
        '</div>' +

        (esPol ? '' : '<div class="pcr-radios pcr-radios-mini">' + radios + '</div>') +
        (esPol ? '' : '<p class="pcr-pista pcr-mini-pista">Mové el mapa: el círculo sigue el centro.</p>') +

        (esPol && !hayPol
          ? '<button type="button" data-pcr="dibujar-area" class="pcr-principal">✏️ Dibujar el área en el mapa</button>'
          : '<button type="button" data-pcr="analizar" class="pcr-principal"' +
              (S.cargando || !listoParaAnalizar() ? ' disabled' : '') + '>' +
              (S.cargando ? '⏳ Consultando…' : '🔍 Ver qué hay') + '</button>') +

        (S.error ? '<p class="pcr-error">' + esc(S.error) + '</p>' : '') +
        (S.cargando ? '<p class="pcr-pista pcr-espera">La primera consulta del día puede tardar.</p>' : '') +
      '</div>';
  }

  function pintar() {
    var h = hoja();
    // La ficha y la comparación se ven enteras: son para leer, no para
    // manipular el mapa.
    /* Con la ficha en pantalla la hoja NO se encoge: es para leer. La
       excepción es el mapa de calor, que se mira en el mapa —con la hoja
       entera encima no se ve nada de lo que se acaba de encender—, así que
       ahí sí baja, y baja mostrando los mismos interruptores. */
    var encoger = S.encogida && !S.comparacion && (!S.resultado || S.calor.length > 0);
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

    return '' +
      '<button type="button" data-pcr="agrandar" class="pcr-asa" aria-label="Volver al informe"></button>' +
      '<div class="pcr-mini-cuerpo">' +
        '<div class="pcr-mini-fila">' +
          '<div class="pcr-mini-que">' +
            '<b>🔥 Mapa de calor</b>' +
            '<small>' + esc(S.calor.length ? etiquetaCalor().replace('🔥 ', '') : 'ninguna capa encendida') + '</small>' +
          '</div>' +
          '<button type="button" data-pcr="agrandar" class="pcr-mini-mas" aria-label="Volver al informe">⋯</button>' +
        '</div>' +
        '<div class="pcr-calor-chips">' +
          chip('todos', '🔥 Todos', st.total || 0, null) +
          grupos.map(function (g) { return chip('g:' + g.id, nombreGrupo(g.id), g.n, colorDeGrupo(g.id)); }).join('') +
        '</div>' +
        '<button type="button" data-pcr="agrandar" class="pcr-principal">📄 Volver al informe</button>' +
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
          '⭕ Un radio</button>' +
        '<button type="button" data-pcr="forma" data-f="poligono" class="pcr-forma' +
          (esPol ? ' pcr-forma-on' : '') + '" aria-pressed="' + (esPol ? 'true' : 'false') + '">' +
          '✏️ El área dibujada</button>' +
      '</div>' +
      (hayPol || esPol ? '' :
        '<small class="pcr-pista">Para usar un área a medida, dibújala primero en Pro City con «✏️ Dibujar área en el mapa».</small>');

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
      '<div class="pcr-barra">' +
        '<b>🔍 ¿Qué hay en este sector?</b>' +
        '<button type="button" data-pcr="cerrar" class="pcr-x" aria-label="Cerrar">✕</button>' +
      '</div>' +
      '<div class="pcr-cuerpo">' +
        '<p class="pcr-intro">Antes de salir a mapear, mira qué tiene registrado OpenStreetMap en la zona. ' +
        'Sirve para llegar sabiendo qué esperar —y sobre todo, para ver qué <b>todavía no está mapeado</b>.</p>' +

        selector +
        ajusteArea +

        (S.error ? '<p class="pcr-error">' + esc(S.error) + '</p>' : '') +

        '<button type="button" data-pcr="analizar" class="pcr-principal"' +
          (S.cargando || !listoParaAnalizar() ? ' disabled' : '') + '>' +
          (S.cargando ? '⏳ Consultando…' : '🔍 Ver qué hay') +
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
        '<h4 class="pcr-h">Reconocimientos guardados</h4>' +
        '<button type="button" data-pcr="ver-mapa" class="pcr-mini">' +
          (S.enMapa ? '🙈 Quitar del mapa' : '🗺️ Ver en el mapa') + '</button>' +
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
            (S.comparando ? '…' : '📊 Comparar') + '</button>' +
          '<button type="button" data-pcr="borrar-ficha" data-id="' + esc(f.id) + '"' +
            ' class="pcr-x pcr-x-mini" aria-label="Borrar ficha">🗑️</button>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  // ── La ficha ──────────────────────────────────────────────────────────
  function nombreGrupo(g) {
    var G = (window.AIA_MOTOR && window.AIA_MOTOR.GRUPOS) || {};
    var d = G[g];
    if (!d) return g;
    return d.nombre || d.n || g;
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
    L.push('Usos registrados en OpenStreetMap: ' + (st.total || 0));
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

    return '<h4 class="pcr-h">Cuánta gente vive acá</h4>' +
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
          '<span><i class="pcr-punto pcr-punto-m"></i> 👩 Mujeres <b>' +
            Number(d.mujeres).toLocaleString('es-CO') + '</b> · ' + pctM + '%</span>' +
          '<span><i class="pcr-punto pcr-punto-h"></i> 👨 Hombres <b>' +
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
        '<span class="pcr-edad-ico">' + t.icono + '</span>' +
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

    return '<h4 class="pcr-h">Quiénes viven acá</h4>' +
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
    if (S.calor.indexOf('todos') !== -1) return '🔥 Todos los usos encontrados';
    if (S.calor.length === 1) {
      var id = S.calor[0];
      return '🔥 ' + (id.slice(0, 2) === 'g:' ? nombreGrupo(id.slice(2)) : nombreDeSub(id.slice(2)));
    }
    return '🔥 ' + S.calor.length + ' capas combinadas';
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
      '<h4 class="pcr-h">Mapas de calor</h4>' +
      '<p class="pcr-pista">Elegí qué querés ver caliente. Podés <b>combinar varias</b> ' +
      'para encontrar dónde coinciden. Se pinta sobre el mapa: la hoja baja sola.</p>' +
      '<div class="pcr-calor-chips">' +
        chip('todos', '🔥 Todos', st.total || pois.length, null) +
        grupos.map(function (g) {
          return chip('g:' + g.id, nombreGrupo(g.id), g.n, colorDeGrupo(g.id));
        }).join('') +
      '</div>' +
      (subs.length
        ? '<p class="pcr-pista">Por uso concreto:</p><div class="pcr-calor-chips">' +
          subs.map(function (x) {
            var t = TAX.filter(function (u) { return u.sub === x.id; })[0];
            return chip('s:' + x.id, (t && t.icono ? t.icono + ' ' : '') + nombreDeSub(x.id),
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

  function bloqueMovilidad(st) {
    var mv = st.movilidad;
    if (!mv) return '';
    var via = mv.viaPrincipal;
    var vias = (mv.viasArterias || []).slice(0, 4);
    return '' +
      '<h4 class="pcr-h">🚦 Cómo se llega</h4>' +
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
        : '');
  }

  function bloqueAmbiente(st) {
    var am = st.ambiente;
    if (!am) return '';
    return '' +
      '<h4 class="pcr-h">🌳 Verde y agua</h4>' +
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
      '<h4 class="pcr-h">Qué manda en el sector</h4>' +
      '<p class="pcr-conc">Predomina <b>' + esc((NOMBRE_USO[top.id] || top.id).replace(/^\S+\s/, '')) +
        '</b> con el ' + top.n + '% del peso de los usos.</p>' +
      filas.map(function (x) {
        return '<div class="pcr-fila">' +
          '<span class="pcr-fila-nom">' + esc(NOMBRE_USO[x.id] || x.id) + '</span>' +
          '<span class="pcr-fila-barra"><i style="width:' + x.n + '%"></i></span>' +
          '<span class="pcr-fila-n">' + x.n + '%</span>' +
        '</div>';
      }).join('') +
      '<p class="pcr-pista">El porcentaje pesa lo que representa cada cosa: una zona residencial completa pesa más que un solo local.</p>';
  }

  function bloqueNucleos(st) {
    var ns = st.nucleos || [];
    if (!ns.length) return '';
    return '' +
      '<h4 class="pcr-h">Dónde está la calle comercial</h4>' +
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
      '<h4 class="pcr-h">📋 La lista para ir a verificar</h4>' +
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
              '<span class="pcr-rubro-n">' + (r.icono ? r.icono + ' ' : '') + esc(r.nombre) + '</span>' +
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
      '<h4 class="pcr-h">Cómo cambia al alejarse</h4>' +
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
      '<h4 class="pcr-h">🧭 El plan de la salida</h4>' +
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
      '<p class="pcr-pista">Se imprime con el informe (🖨️ PDF) y va en el texto que copia 📋.</p>';
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
          (S.cobCargando ? '⏳ Leyendo la foto…' : '🛰️ Medir el verde en la foto satelital') +
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
            '<span class="pcr-cob-etq">' + x.ico + ' ' + esc(x.etq) + '</span>' +
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
          (S.cobEnMapa ? '🙈 Quitar del mapa' : '🗺️ Ver en el mapa') + '</button>' +
        '<button type="button" data-pcr="cobertura" class="pcr-mini pcr-llevar-b">↻ Volver a leer</button>' +
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
      '<h4 class="pcr-h">🌍 Llevarlo a otro programa</h4>' +
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
        '<button type="button" data-pcr="exp" data-f="paquete" class="pcr-mini pcr-exp-todo">📦 Paquete completo (ZIP)</button>' +
        '<button type="button" data-pcr="exp" data-f="kmz" class="pcr-mini">🌍 KMZ · Google Earth</button>' +
        '<button type="button" data-pcr="exp" data-f="dxf" class="pcr-mini">📐 DXF · AutoCAD</button>' +
        '<button type="button" data-pcr="exp" data-f="svg" class="pcr-mini">🎨 SVG · Corel / Illustrator</button>' +
        '<button type="button" data-pcr="exp" data-f="geojson" class="pcr-mini">🗺️ GeoJSON · QGIS</button>' +
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
      '<div class="pcr-barra">' +
        '<b>🔍 Lo que hay ' + (esPol ? 'en el área' : 'en el sector') + '</b>' +
        '<button type="button" data-pcr="cerrar" class="pcr-x" aria-label="Cerrar">✕</button>' +
      '</div>' +
      '<div class="pcr-cuerpo">' +

        '<div class="pcr-kpis">' +
          '<div class="pcr-kpi"><b>' + (st.total || 0) + '</b><small>usos registrados</small></div>' +
          '<div class="pcr-kpi"><b>' + radioTxt + '</b><small>' + radioEtiqueta + '</small></div>' +
          '<div class="pcr-kpi"><b>' + dens + '</b><small>por hectárea</small></div>' +
          '<div class="pcr-kpi"><b>' + (zonas.vacios.length + zonas.flojos.length) + '</b><small>rumbos sin datos</small></div>' +
        '</div>' +

        bloquePoblacion(st, esPol) +
        bloqueDemografia(st) +

        '<h4 class="pcr-h">Qué hay, por categoría</h4>' +
        // El anillo se pinta después, cuando el canvas ya está en el documento.
        // Si Chart.js no cargó, las barras de abajo siguen contando lo mismo:
        // la gráfica es la forma bonita del dato, no el dato.
        (grupos.length ? '<div class="pcr-grafica"><canvas id="pcr-donut" height="190"></canvas></div>' : '') +
        (filas || '<p class="pcr-pista">Ningún uso quedó clasificado en una categoría.</p>') +
        (sinCategoria ? '<p class="pcr-pista">' + sinCategoria + ' punto' + (sinCategoria === 1 ? '' : 's') +
          ' sin categoría reconocida. Suelen ser usos poco comunes: buen material para revisar en campo.</p>' : '') +

        (chips ? '<h4 class="pcr-h">Lo más repetido</h4><div class="pcr-chips">' + chips + '</div>' : '') +

        // El inventario dice QUÉ hay; lo que sigue dice cómo funciona el
        // sector: qué uso manda, cómo se llega, qué lo rodea y dónde está la
        // calle que concentra la actividad.
        bloqueUsoPredominante(st) +
        bloqueMovilidad(st) +
        bloqueAmbiente(st) +
        bloqueNucleos(st) +
        bloqueAnillos(st, esPol) +
        bloqueCalor(res) +

        // Hacia dónde mira el sector. Solo aparece si de verdad hay un lado
        // que domina: señalar «el mayor» en un reparto parejo sería inventar
        // un patrón que no existe.
        (zonas.concentracion
          ? '<h4 class="pcr-h">Dónde se concentra</h4>' +
            '<p class="pcr-conc">La mitad ' + esc(zonas.concentracion.rumbo.nombre) +
            ' reúne <b>' + zonas.concentracion.n + ' de ' + zonas.total + '</b> (' +
            zonas.concentracion.pct + '%). Es el lado más activo según los datos.</p>'
          : '') +

        '<h4 class="pcr-h">A dónde ir</h4>' +
        tareas +

        bloquePlan(res, zonas) +

        // De inventario a lista de tareas. Lo que el estudiante hace con esto
        // parado en la esquina, que es de lo que se trataba.
        bloqueRubros(st) +

        '<h4 class="pcr-h">Qué verificar en campo</h4>' +
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
        '<h4 class="pcr-h">En el mapa</h4>' +
        '<p class="pcr-pista">' + (S.puntosEnMapa || 0) + ' puntos pintados con el color de su categoría. ' +
        'Cerrá esta hoja para verlos; tocá uno para saber qué es.</p>' +
        '<div class="pcr-llevar">' +
          '<button type="button" data-pcr="estratos" class="pcr-mini pcr-llevar-b"' +
            (S.cargandoEstratos ? ' disabled' : '') + '>' +
            (S.cargandoEstratos ? '⏳ Cargando…' : (S.estratos ? '🙈 Quitar estratos' : '🎨 Pintar estratos')) +
          '</button>' +
        '</div>' +
        (S.estratos && S.estratos.leyenda ? S.estratos.leyenda : '') +

        '<div class="pcr-llevar">' +
          '<button type="button" data-pcr="guardar" class="pcr-mini pcr-llevar-b">💾 Guardar ficha</button>' +
          '<button type="button" data-pcr="copiar" class="pcr-mini pcr-llevar-b">📋 Copiar</button>' +
          '<button type="button" data-pcr="imprimir" class="pcr-mini pcr-llevar-b">🖨️ PDF</button>' +
        '</div>' +

        // Guardar el ÁREA, no la ficha: queda en la misma lista de áreas de
        // Pro City, así que se puede volver a ella sin redibujarla y el
        // análisis de los mapeos del curso corre sobre exactamente el mismo
        // trazo que se reconoció. Es lo que junta las dos mitades.
        bloqueExportar() +

        (esPol
          ? '<div class="pcr-llevar">' +
              '<button type="button" data-pcr="guardar-area" class="pcr-mini pcr-llevar-b">📐 Guardar el área dibujada</button>' +
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
      S.resultado = res;
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
      '<h4 class="pcr-h">Llevarse el resultado</h4>' +
      '<p class="pcr-pista">El cuadro completo, para el informe del curso. En los archivos, cada punto va ' +
      'teñido por su conclusión: <b>nuevo</b>, confirmado, discrepante o sin verificar.</p>' +
      '<div class="pcr-llevar">' +
        '<button type="button" data-pcr="comp-copiar" class="pcr-mini pcr-llevar-b">📋 Copiar</button>' +
        '<button type="button" data-pcr="comp-pdf" class="pcr-mini pcr-llevar-b">🖨️ PDF</button>' +
      '</div>' +
      (d
        ? '<div class="pcr-exp-btns">' +
            '<button type="button" data-pcr="comp-exp" data-f="paquete" class="pcr-mini pcr-exp-todo">📦 Paquete completo (ZIP)</button>' +
            '<button type="button" data-pcr="comp-exp" data-f="kmz" class="pcr-mini">🌍 KMZ · Google Earth</button>' +
            '<button type="button" data-pcr="comp-exp" data-f="dxf" class="pcr-mini">📐 DXF · AutoCAD</button>' +
            '<button type="button" data-pcr="comp-exp" data-f="svg" class="pcr-mini">🎨 SVG · Corel</button>' +
            '<button type="button" data-pcr="comp-exp" data-f="geojson" class="pcr-mini">🗺️ GeoJSON · QGIS</button>' +
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
      '<div class="pcr-barra">' +
        '<b>📊 Antes y después</b>' +
        '<button type="button" data-pcr="cerrar" class="pcr-x" aria-label="Cerrar">✕</button>' +
      '</div>' +
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
          ? '<h4 class="pcr-h">Lo que el curso agregó al mapa</h4>' +
            '<p class="pcr-conc">' + c.nuevos.length + ' usos que <b>no estaban en OpenStreetMap</b>' +
            (aporte !== null ? ' — un ' + aporte + '% más de lo que había' : '') + '. ' +
            'Esto es trabajo que nadie había hecho antes en este sector.</p>' +
            lista(c.nuevos, function (x) { return (x.nombre || 'Sin nombre') + ' · ' + (x.sub || ''); })
          : '<h4 class="pcr-h">Lo que el curso agregó al mapa</h4>' +
            '<p class="pcr-ok">Todo lo que el curso mapeó ya estaba en OpenStreetMap. El aporte de esta salida fue de verificación, no de descubrimiento.</p>') +

        (c.discrepancias.length
          ? '<h4 class="pcr-h">Donde no coinciden</h4>' +
            '<p class="pcr-tarea-intro">Mismo sitio, categoría distinta. Puede que el local haya cambiado de uso, o que una de las dos clasificaciones esté equivocada. Vale la pena mirarlo.</p>' +
            lista(c.discrepancias, function (x) {
              return (x.campo.nombre || 'Sin nombre') + ': el curso dice «' + (x.campo.grupo || '?') +
                     '», OSM dice «' + (x.osm.grupo || '?') + '»';
            })
          : '') +

        (c.sinVerificar.length
          ? '<h4 class="pcr-h">Sin verificar</h4>' +
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
  function abrir() {
    if (!mapa()) { alert('El mapa aún no está listo.'); return; }
    S.abierto = true;
    S.resultado = null;
    S.error = '';
    // Si viene de dibujar un área, esa es la que quiere analizar. Obligarlo a
    // elegirla de nuevo sería no haber mirado lo que acababa de hacer.
    var pol = poligonoDeProCity();
    if (pol) { S.poligono = pol; S.forma = 'poligono'; }
    if (!S.centro) tomarCentro();
    pintarCirculo();
    pintar();
  }

  function cerrar() {
    S.abierto = false;
    borrarCirculo();
    // Los puntos y los estratos SE QUEDAN: cerrar la hoja es justamente lo
    // que se hace para poder mirarlos. Se van cuando se analiza otra cosa o
    // con «Quitar del mapa».

    var h = document.getElementById('pcr-hoja');
    if (h) h.classList.remove('pcr-visible');
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
      meta: { forma: f.forma, areaM2: f.areaM2, radioM: f.radioM,
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
      bloquePoblacion(st, esPol) +
      bloqueDemografia(st) +
      (filas.length
        ? '<h4 class="pcr-h">Qué hay, por categoría</h4>' +
          filas.map(function (x) {
            return '<div class="pcr-fila">' +
              '<span class="pcr-fila-nom">' + esc(nombreGrupo(x.id)) + '</span>' +
              '<span class="pcr-fila-barra"><i style="width:' + Math.round(x.n / mayor * 100) + '%"></i></span>' +
              '<span class="pcr-fila-n">' + x.n + '</span></div>';
          }).join('')
        : '') +
      bloqueUsoPredominante(st) +
      bloqueMovilidad(st) +
      bloqueAmbiente(st) +
      coberturaGuardada(st.cobertura) +
      bloqueNucleos(st) +
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

    return '<h4 class="pcr-h">Mapa de calor de este sector</h4>' +
      '<p class="pcr-pista">Se pinta en el mapa; esta hoja se cierra sola para dejarlo ver.</p>' +
      '<div class="pcr-calor-chips">' +
        chip('todos', '🔥 Todos', pois.length, null) +
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
    return '<h4 class="pcr-h">🛰️ Cobertura medida en la foto</h4>' +
      '<div class="pcr-cob-barra">' +
        orden.filter(function (x) { return x.pct > 0; }).map(function (x) {
          return '<i style="width:' + x.pct + '%;background:' + x.color + '"></i>';
        }).join('') +
      '</div>' +
      '<div class="pcr-cob-lista">' +
        orden.filter(function (x) { return x.pct > 0; }).map(function (x) {
          return '<div class="pcr-cob-fila">' +
            '<span class="pcr-cob-pin" style="background:' + x.color + '"></span>' +
            '<span class="pcr-cob-etq">' + (x.ico || '') + ' ' + esc(x.etq) + '</span>' +
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
      return '<div class="u52-empty-card"><span>🔍</span><div>' +
        '<b>Todavía no analizaste ningún sector</b>' +
        '<small>Con la lupa 🔍 del mapa mirás qué hay en un sector antes de ir a mapearlo. ' +
        'Cada análisis queda guardado acá.</small></div></div>' +
        '<div class="pcr-pest-pie">' +
          '<button type="button" class="pcr-mini" data-u52-call="pcr-nuevo">🔍 Analizar un sector</button>' +
        '</div>';
    }
    var hayCampo = puntosDelCurso().length > 0;

    return '<div class="pcr-pestana">' +
      '<p class="pcr-pista">Cada sector que analizaste queda acá con su informe completo, ' +
      'aunque cierres la app. Cargá el área para que los mapeos del curso se sumen a lo que ya se sabía.</p>' +
      fichas.map(function (f) {
        var abierta = S.pestanaAbierta === f.id;
        var tam = f.forma === 'poligono' ? formatearArea(f.areaM2) : ((f.radioM || 0) + ' m');
        return '<div class="pcr-pest-ficha' + (abierta ? ' abierta' : '') + '">' +
          '<button type="button" class="pcr-pest-cab" data-u52-call="pcr-ver" data-id="' + esc(f.id) + '">' +
            '<span class="pcr-pest-ico">' + (f.forma === 'poligono' ? '📐' : '🎯') + '</span>' +
            '<span class="pcr-pest-t"><b>' + esc(f.nombre || ('Sector del ' + fmtFecha(f.ts))) + '</b>' +
            '<small>' + esc(tam) + ' · ' + (f.total || 0) + ' usos · ' + esc(fmtFecha(f.ts)) + '</small></span>' +
            '<span class="pcr-pest-fl">' + (abierta ? '▾' : '▸') + '</span>' +
          '</button>' +
          (abierta
            ? '<div class="pcr-pest-cuerpo">' +
                informeGuardado(f) +
                chipsCalorGuardado(f) +
                exportarGuardado(f) +
                '<div class="pcr-llevar">' +
                  (f.forma === 'poligono'
                    ? '<button type="button" class="pcr-mini pcr-llevar-b" data-u52-call="pcr-area" data-id="' +
                      esc(f.id) + '">📐 Cargar el área en Análisis</button>'
                    : '') +
                  '<button type="button" class="pcr-mini pcr-llevar-b" data-u52-call="pcr-copiar" data-id="' +
                    esc(f.id) + '">📋 Copiar</button>' +
                  '<button type="button" class="pcr-mini pcr-llevar-b" data-u52-call="pcr-pdf" data-id="' +
                    esc(f.id) + '">🖨️ PDF</button>' +
                  (hayCampo
                    ? '<button type="button" class="pcr-mini pcr-llevar-b" data-u52-call="pcr-comparar" data-id="' +
                      esc(f.id) + '">📊 Comparar con el campo</button>'
                    : '') +
                  '<button type="button" class="pcr-mini pcr-llevar-b" data-u52-call="pcr-borrar" data-id="' +
                    esc(f.id) + '">🗑️ Borrar</button>' +
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
        '<button type="button" class="pcr-mini" data-u52-call="pcr-nuevo">🔍 Analizar otro sector</button>' +
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
        '🔥 ' + (cal === 'todos' ? (f.nombre || 'Sector guardado')
                                 : nombreGrupo(cal.slice(2)) + ' · ' + (f.nombre || 'sector guardado')),
        function () { S.calorGuardado = { ficha: '', cal: '' }; });
      try { if (typeof window.urbisProCityCerrarStats === 'function') window.urbisProCityCerrarStats(); } catch (e) {}
      return true;
    }
    if (name === 'pdf') {
      if (!f) return true;
      var htmlG = htmlImprimible(comoResultado(f), comoZonas(f),
                                 { nombre: f.nombre || '', cobertura: (f.stats && f.stats.cobertura) || null });
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
