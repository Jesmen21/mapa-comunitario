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

  /* ── Lo que NO entra al pliego mientras nadie lo encienda ──────────────
     «Lo que sí quitaría del pdf es donde dice falta mapear, 07 trabajo de
     campo, porque eso es un pdf pa presentar algo que existe en el momento.»

     Es una distinción buena y vale la pena escribirla: la ficha en pantalla es
     una herramienta de trabajo y ahí lo que falta es lo más útil que hay —dice
     a dónde ir mañana—; el pliego es una entrega, y una entrega presenta lo
     que se levantó, no la lista de lo que no. Las dos cajas siguen en la ficha
     y siguen en el selector del pliego, encendibles con un toque: quien esté
     armando un pliego para una revisión de avance las quiere. Lo que cambia es
     de qué lado empieza el interruptor. */
  var APAGADAS_DE_ENTRADA = ['donde-falta-mapear', 'lo-que-falta-levantar'];

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
    /* De dónde salió el punto alrededor del cual se consulta. Se marca donde
       se decide y viaja con la ficha. No es adorno: llegó un informe de campo
       —«ajusté el radio sobre el lote y el análisis se hizo en mi ubicación
       GPS»— que no pude reproducir en tres intentos. Con esto, una foto de la
       hoja contesta sola de dónde salió el centro. */
    centroDe: '',
    /* Dónde y hasta dónde llegaba el sector analizado. Es contra esto que se
       decide si lo siguiente es el mismo lugar con otro encuadre o un barrio
       distinto. */
    sectorAnclado: null,
    /* Cuando cambiar de área destruiría trabajo que no se pudo archivar, la
       hoja se planta acá hasta que alguien decida. Guarda el recuento de lo
       que está en juego. */
    trabaDescartar: null,
    // La comparación con lo que mapeó el curso, hecha sobre el área que está
    // en pantalla. Se pide a botón como el terreno o el clima: cuesta una
    // consulta y no siempre hay puntos del curso que comparar.
    campo: null, campoCargando: false, campoAviso: '',
    /* Los sectores elegidos para comparar entre sí. Es una lista de ids, no
       de fichas: las fichas se releen del almacenamiento cada vez, así que si
       una se borra la comparación se entera sola. */
    cotejo: [],
    /* El LOTE: el polígono chico que la estudiante quiere intervenir, dentro
       del sector. Es otra cosa que el área: el área es «qué hay alrededor»,
       el lote es «acá voy a proponer algo». Por eso va aparte, en amarillo, y
       tiene su propio análisis. */
    encogidaAMano: false,
    /* Encogida al mínimo: solo el asa y una línea. Es lo que hace falta para
       mirar el mapa sin nada encima y para mandar una captura. */
    minima: false,
    // El intervalo de las curvas que pidió la persona; null = lo elige el relieve.
    curvasPaso: null,
    lote: null, loteDibujando: false, loteAviso: '', caminata: null, caminataEnMapa: false,
    llenosFoto: null, llenosFotoCargando: false, llenosFotoAviso: '', llenosFotoEnMapa: false,
    /* LO INTANGIBLE: lo que no se puede bajar de ningún servidor. Dónde no se
       pasa de noche, qué esquina está oscura, dónde huele mal, dónde da gusto
       quedarse. Es una lista de marcas dibujadas a mano, con su tipo y su
       nota; el módulo js/75 sabe qué significa cada una y qué se puede cruzar
       con lo que sí se midió. */
    intangible: [], intDibujando: false, intTipo: '', intPts: null, intAviso: '',
    intEnMapa: false,
    /* Los recorridos del curso, juntados. Es lo que convierte veinte opiniones
       sueltas en un dato: dónde varias personas, cada una por su lado,
       dijeron lo mismo. */
    intCurso: [], intUnion: null, intAcuerdosEnMapa: false, intCursoAviso: '',
    /* Lo que el archivado tenga que decir. Vive aparte de `aviso` a propósito:
       varios sitios escriben `aviso` JUSTO DESPUÉS de guardar —la importación
       del curso, sin ir más lejos, ponía «Se juntaron 14 recorridos» encima
       del aviso de que ninguno se había podido guardar— y una advertencia de
       pérdida no puede depender del orden en que se llamen dos funciones. */
    avisoGuardado: '',
    /* Los índices del POT que el estudiante escribe a mano. URBIS no los
       conoce: acá solo se guardan para hacer la cuenta con ellos. */
    indices: null, queCabeAbierto: false,
    /* De dónde salieron los índices y de qué año son. Los escribe la persona
       que fue a buscarlos. Sin esto, un número copiado en una ventanilla se
       lee meses después como si lo hubiera medido la aplicación —el mismo
       error que ya se corrigió dos veces: un valor puesto a mano mostrado con
       la seguridad de una medición—. */
    indicesFuente: null,
    /* EL PLIEGO: qué cajas y qué mapas van al papel. Guarda las APAGADAS y no
       las encendidas, para que una caja nueva —de una versión posterior—
       aparezca sola en el pliego de un sector guardado hace meses en vez de
       quedar fuera por no estar en una lista que se escribió antes de que
       existiera. */
    viasEnMapa: false,
    evo: null, evoCargando: '', evoAviso: '',
    pliegoOff: APAGADAS_DE_ENTRADA.slice(), pliegoMapasOff: [], pliegoCabe: null, pliegoProbando: false,
    /* De fábrica, «cabe todo». No es lo que se leería mejor —es letra de
       lupa— y aun así es lo correcto de entrada: entra en conflicto directo
       con lo que se pidió antes, «no me dejes mapas a un lado», y esa
       decisión no la puede tomar el programa por su cuenta. La ficha dice
       ahora en milímetros de qué tamaño sale la letra, así que la elección
       está a la vista y a un toque. */
    pliegoLetra: 'todo', pliegoFuera: [],
    // La amenaza sísmica del municipio, del Servicio Geológico. Se pide a
    // botón como el clima o el terreno: es una consulta a un servidor lento y
    // no todos los ejercicios la necesitan.
    amenaza: null, amenazaCargando: false, amenazaAviso: '',
    // Mientras corre «Medir todo»: qué paso va y qué salió. Null cuando no
    // hay nada corriendo, que es también la señal para cancelar la cadena.
    midiendoTodo: null,
    // Las teselas guardadas para caminar sin señal: qué hay y qué va bajando.
    teselas: null, bajandoTeselas: null, cortesEnMapa: false,
    corteDibujando: false, cortePts: null, corteAviso: '',
    terRejilla: null, curvas: null, curvasEnMapa: false, sombras: null, sombrasEnMapa: false,
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
    trzHuellas: null, trzPisos: null,
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
    /* El asa va también en la hoja abierta, no solo en la encogida. Sirve
       para dos cosas: se toca para bajar la hoja y se ARRASTRA para bajarla o
       subirla siguiendo el dedo. Antes solo se podía con botones —«volver al
       informe» y la X—, que obliga a buscar un objetivo pequeño para algo que
       el pulgar ya sabe hacer solo. */
    return '<button type="button" data-pcr="asa" class="pcr-asa pcr-asa-abierta" ' +
      'aria-label="Arrastrar para ver el mapa"></button>' +
      '<div class="pcr-barra">' +
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
        rutas: (mv.rutas || []).slice(0, 12),
        /* Y el flujo, que son diez números: cuánto peatón, cuánto carro, cuál
           manda, el reparto por franjas y si la calle sigue viva de noche. Es
           lo que decide el formato de un proyecto, así que una ficha reabierta
           sin él perdería la caja entera de «cómo se llega». */
        flujo: mv.flujo || null
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
      /* La rejilla de cotas, cruda. Son 18 × 18 números —dos kilobytes— y con
         ella una ficha reabierta puede volver a cortar el terreno por el lote
         sin pedirle nada al servicio de elevación. Guardar los cortes ya
         dibujados ocuparía más y serviría para menos. */
      terrenoRejilla: S.terRejilla || null,
      clima: S.clima || null,
      /* La comparación con el campo, en versión corta: las cuentas y unos
         pocos nombres. Guardar las cuatro listas enteras duplicaría todos los
         puntos del sector dentro de la ficha, y lo que se lee después son las
         cifras. */
      /* El lote va con la ficha: es la mitad del trabajo. Sin él, reabrir un
         sector guardado devuelve el análisis del entorno y pierde el terreno
         que la estudiante ya había marcado. */
      lote: (S.lote && S.lote.length >= 3)
        ? S.lote.map(function (q) { return { lat: q.lat, lng: q.lng }; })
        : null,
      loteAnalisis: (function () {
        try { return analisisDelLote(); } catch (e) { return null; }
      })(),
      /* Lo intangible va entero: son unas pocas decenas de vértices y es lo
         único de la ficha que no se puede volver a pedir. Si se pierde, se
         pierde el recorrido de una persona. */
      intangible: (function () {
        var I = window.URBIS_INTANGIBLE;
        try { return I ? I.paraGuardar(S.intangible || []) : []; } catch (e) { return []; }
      })(),
      /* Los recorridos que trajo el curso. Vale la misma razón que para el
         propio, y multiplicada por cuarenta: un recorrido de campo no se
         puede volver a pedir a ningún servidor.

         Vivían SOLO en memoria. Un profesor importaba los cuarenta archivos
         de su curso, el teléfono se bloqueaba o el navegador reclamaba la
         pestaña, y había que volver a importarlos uno por uno. Sin ningún
         aviso: la pantalla simplemente volvía a decir que había un solo
         recorrido, el suyo.

         Van con la ficha y no en su propia caja porque pertenecen a ESTE
         sector: en otro barrio serían manchas de color sobre calles donde
         nadie estuvo, que es la misma razón por la que se borran al analizar
         un sector nuevo. Cuarenta recorridos pesan unos 120 KB. */
      intCurso: (function () {
        var lista = S.intCurso || [];
        if (!lista.length) return null;
        try { return JSON.parse(JSON.stringify(lista)); } catch (e) { return null; }
      })(),
      // Cómo quedó armado el pliego. Son unos pocos nombres y evitan que
      // reabrir una ficha para reimprimirla devuelva otra lámina.
      // La amenaza es del municipio y no cambia nunca: guardarla evita
      // volver a esperar medio minuto al servidor del SGC.
      amenaza: S.amenaza || null,
      /* Y la inundación con ella: son dos servicios distintos del mismo
         momento y guardarlos por separado dejaría fichas con el sismo y sin
         el río, que en Cúcuta es la mitad que falta. */
      inundacion: S.inundacion || null,
      /* Las manzanas por estrato, con sus contornos. Se pidieron en el PDF y
         no salían: se pintaban, se archivaba la ficha, y al reabrirla para
         imprimir el pliego ya no estaban, porque no viajaban con ella y el
         mapa del pliego se dibuja de lo que hay en memoria. Pesan poco —los
         vértices van redondeados al metro— y volver a pedírselas al DANE
         para reimprimir sería cobrar dos veces la misma consulta. */
      estratos: (function () {
        var e = S.estratos;
        if (!e || !e.manzanas || !e.manzanas.length) return null;
        var r5 = function (x) { return Math.round(Number(x) * 1e5) / 1e5; };
        return { n: e.n, leyenda: e.leyenda || '',
          manzanas: e.manzanas.map(function (mz) {
            return { estrato: mz.estrato, color: mz.color, etiqueta: mz.etiqueta,
              anillos: (mz.anillos || []).map(function (an) {
                return (an || []).map(function (p) {
                  return Array.isArray(p) ? [r5(p[0]), r5(p[1])] : [r5(p.lat), r5(p.lng)];
                });
              }) };
          }) };
      })(),
      /* La evolución, SIN las imágenes. Cada estampa es un PNG en base64 y
         quince de ellas son megas: el almacenamiento del teléfono son cinco
         en total. Lo que se defiende son las cifras y la tendencia, y eso
         pesa nada; las imágenes se vuelven a pedir con un botón. */
      evo: (function () {
        var e = S.evo;
        if (!e) return null;
        var limpiar = function (s2) {
          if (!s2) return null;
          return { fuente: s2.fuente, nombre: s2.nombre, modo: s2.modo,
                   metrosPorPixel: s2.metrosPorPixel, caja: s2.caja,
                   tendencia: s2.tendencia || null,
                   pasos: (s2.pasos || []).map(function (p) {
                     return { anio: p.anio, ok: p.ok, hueco: p.hueco,
                              fiable: p.fiable, medida: p.medida || null };
                   }) };
        };
        return { landsat: limpiar(e.landsat), wayback: limpiar(e.wayback) };
      })(),
      // Los índices que escribió el estudiante. Son siete números y son el
      // trabajo de haber ido a buscar el POT: perderlos al recargar sería
      // hacerle repetir esa búsqueda.
      indices: S.indices || null,
      /* Cuáles se escribieron a mano. Se guardaba el VALOR y no esto, así que
         un sector reabierto con los siete índices del POT puestos volvía
         diciendo «cuenta de ejemplo»: la única señal de que un número salió
         de la ficha normativa es que alguien lo escribió. */
      indicesPuestos: S.indicesPuestos || null,
      indicesFuente: S.indicesFuente || null,
      pliegoOff: (S.pliegoOff || []).slice(),
      pliegoLetra: S.pliegoLetra || 'todo',
      pliegoMapasOff: (S.pliegoMapasOff || []).slice(),
      /* El recorrido a pie va SIN los tramos: la geometría de las calles
         alcanzadas son miles de segmentos y no cabe en el almacenamiento del
         teléfono. Lo que se lee después son los tres anillos. */
      caminata: (function () {
        var c = S.caminata;
        if (!c || !c.anillos) return null;
        return { anillos: c.anillos, distanciaAlaCalleM: c.distanciaAlaCalleM,
                 pasoMPorMin: c.pasoMPorMin };
      })(),
      campo: S.campo ? {
        nuevos: (S.campo.nuevos || []).slice(0, 20).map(function (x) {
          return { lat: x.lat, lng: x.lng, nombre: x.nombre || '', grupo: x.grupo || 'otro',
                   // La etiqueta OSM viaja con el punto: sin ella, un sector
                   // guardado no se puede volver a exportar para subirlo.
                   tags: x.tags || null };
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
      // Cómo se eligió el centro. Es una palabra y contesta la pregunta que
      // una captura de pantalla no podía contestar.
      centroDe: S.centroDeAnalizado || '',
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
    return escribirFichas(todas);
  }

  /* La caché de consultas de Overpass, que vive en js/61. Se nombra acá y no
     se importa de allá para no atar dos módulos por una cadena de texto que
     cambia una vez cada nunca. */
  var CACHE_USOS_KEY = 'aia_overpass_cache_v1';

  /* Escribir cuando el teléfono ya no tiene sitio.

     El almacenamiento de un navegador son unos cinco megabytes, y cuando se
     acaban `setItem` lanza y ya está: quien no mire lo que devuelve pierde el
     trabajo sin enterarse. Medido con un sector de trescientos usos, una
     ficha llena pesa 44 KB, de los cuales 31 son los puntos.

     Se suelta lastre en el orden en que duele menos, y lo que se soltó se
     dice:

       1. La caché de consultas. Es caché: se vuelve a llenar sola y lo único
          que cuesta es que la próxima consulta tarde unos segundos más.
       2. Los puntos del sector que se está guardando. Overpass los vuelve a
          dar con una consulta; las cuentas —totales, grupos, rumbos— se
          quedan, así que el informe se sigue leyendo entero.
       3. Las fichas viejas, de una en una y de la más vieja a la más nueva.
          Van al final porque cada una es el trabajo de una tarde, y porque
          antes se tiraba la mitad de golpe aunque hubiera bastado con una.
       4. Rendirse. Y decirlo, que es la parte que faltaba.

     Lo que una persona caminó no se suelta nunca —las marcas intangibles, los
     recorridos que trajo el curso, el lote, los índices del POT, los puntos
     levantados en campo—: no hay servidor al que volver a pedírselos. */
  function escribirFichas(todas) {
    function intento(lista) {
      try { localStorage.setItem(FICHAS_KEY, JSON.stringify(lista)); return true; }
      catch (e) { return false; }
    }
    if (intento(todas)) return { ok: true, n: todas.length };

    var soltado = {};

    // 1. La caché de Overpass. Es caché: se vuelve a llenar sola con la
    //    siguiente consulta y no le cuesta a nadie más que unos segundos.
    try {
      if (localStorage.getItem(CACHE_USOS_KEY)) {
        localStorage.removeItem(CACHE_USOS_KEY);
        soltado.cache = true;
        if (intento(todas)) return { ok: true, n: todas.length, cache: true };
      }
    } catch (e) {}

    // 2. Los puntos del sector que se está guardando. Las cuentas se quedan;
    //    lo que se pierde es la lista, y esa la vuelve a dar una consulta.
    var f = todas[0], puntos = (f && f.pois) ? f.pois.length : 0;
    if (puntos) {
      f.pois = [];
      // Cuántos se soltaron, para poder avisarlo al reabrir el sector.
      f.sinPuntos = puntos;
      soltado.sinPuntos = puntos;
      if (intento(todas)) {
        return { ok: true, n: todas.length, cache: soltado.cache, sinPuntos: puntos };
      }
    }

    // 3. Las fichas viejas, de una en una y de la más vieja a la más nueva.
    //    Es lo último porque cada una es el trabajo entero de una tarde.
    var borradas = 0;
    while (todas.length > 1) {
      todas.pop(); borradas++;
      if (intento(todas)) {
        return { ok: true, n: todas.length, cache: soltado.cache,
                 sinPuntos: soltado.sinPuntos, borradas: borradas };
      }
    }

    /* Ni así. No se llegó a escribir, así que lo que hubiera guardado sigue
       donde estaba: no se informan fichas borradas porque no se borró
       ninguna —el `pop` fue sobre una copia en memoria que nunca se
       escribió—. La caché sí se soltó de verdad, y no se echa de menos. */
    return { ok: false, error: 'No hay espacio en este teléfono para guardar el sector.' };
  }

  /* ── El respaldo de la salida entera ──────────────────────────────────

     Hasta v707 se podía exportar una ficha, o un recorrido. Al final de una
     jornada de campo, con el curso entero en un teléfono, no había forma de
     archivar el día: y un teléfono que se pierde se lleva la salida completa,
     que son cuarenta personas caminando una tarde.

     Medido: las doce fichas que caben pesan 522 KB y el paquete se arma en
     dos milisegundos. Cabe en un correo. */
  var RESPALDO_FORMATO = 'urbis-respaldo-1';

  function respaldoDeTodo(fichas) {
    return {
      formato: RESPALDO_FORMATO,
      app: (window.URBIS_APP_VERSION || ''),
      cuando: new Date().toISOString(),
      quien: quienSoy() || '',
      fichas: fichas || []
    };
  }

  /* Traer un respaldo. Las fichas que ya están NO se duplican ni se pisan: se
     reconocen por su id, que lleva la marca de tiempo de cuando se analizó el
     sector. Traer dos veces el mismo archivo tiene que dar lo mismo que
     traerlo una, o el respaldo no sirve para juntar los de varios teléfonos. */
  function traerRespaldo(texto) {
    var d;
    try { d = JSON.parse(String(texto || '')); }
    catch (e) { return { error: 'Ese archivo no es un respaldo de URBIS: no se pudo leer.' }; }
    if (!d || d.formato !== RESPALDO_FORMATO || !Array.isArray(d.fichas)) {
      return { error: 'Ese archivo no es un respaldo de URBIS. Buscá el que dice «urbis-respaldo».' };
    }
    var buenas = d.fichas.filter(function (f) { return f && f.id && f.stats; });
    if (!buenas.length) return { error: 'El respaldo no trae ningún sector con informe.' };

    var mias = leerFichas();
    var tengo = {};
    mias.forEach(function (f) { tengo[f.id] = true; });
    var nuevas = buenas.filter(function (f) { return !tengo[f.id]; });
    var repetidas = buenas.length - nuevas.length;

    // Las más nuevas primero, medidas por su fecha, sin importar de qué
    // teléfono vinieron: al recortar por falta de sitio se cae lo más viejo.
    var todas = mias.concat(nuevas).sort(function (a, b) {
      return String(b.ts || '').localeCompare(String(a.ts || ''));
    });
    var cabian = todas.length;
    while (todas.length > MAX_FICHAS) todas.pop();
    var noCupieron = cabian - todas.length;

    var g = escribirFichas(todas);
    if (!g.ok) return { error: g.error };
    return { ok: true, nuevas: nuevas.length, repetidas: repetidas,
             noCupieron: noCupieron, guardado: g };
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

  /* «800 m» o «1,2 km»: la misma cifra dicha como se dice en una conversación
     y no como la guarda el programa. */
  function textoRadio(m) {
    var r = Number(m) || 0;
    return r >= 1000 ? String(Math.round(r / 100) / 10).replace('.', ',') + ' km' : r + ' m';
  }

  function listoParaAnalizar() {
    if (S.forma === 'poligono') return !!(S.poligono && S.poligono.length >= 3);
    // Con el lote como punto de partida, el centro lo pone el propio lote: no
    // hay nada que tocar en el mapa, y por eso alcanza con haberlo marcado.
    if (S.forma === 'lote') return !!(S.lote && S.lote.length >= 3);
    return !!S.centro;
  }

  /* El centro del análisis cuando se parte del lote: su centroide. Se recalcula
     cada vez y no se copia, para que redibujar el lote mueva el círculo. */
  function centroDelLote() {
    return (S.lote && S.lote.length >= 3) ? centroideDe(S.lote) : null;
  }

  /* El centro MIENTRAS se dibuja, que no es lo mismo: con una o dos esquinas
     todavía no hay polígono del que sacar un centroide, pero sí hay un sitio
     al que el círculo tiene que ir. Es el promedio de lo que lleve puesto.

     Existe porque el círculo se quedaba donde estuviera hasta que el lote se
     cerraba. Llegó con la captura: seis esquinas marcadas sobre un predio al
     sur de la ciudad y el círculo punteado a dos kilómetros, encima del
     centro de Cúcuta, que era donde estaba el mapa al empezar. Marcar un lote
     viendo el círculo en otro barrio es marcar a ciegas: la pantalla dice que
     se va a estudiar un sitio mientras se está señalando otro. */
  function centroDibujandoLote() {
    var pts = S.lote || [];
    if (!pts.length) return null;
    if (pts.length >= 3) return centroideDe(pts);
    var la = 0, ln = 0;
    pts.forEach(function (p) { la += Number(p.lat); ln += Number(p.lng); });
    return { lat: la / pts.length, lng: ln / pts.length };
  }

  /* ── De dónde sale el centro, en un solo sitio ───────────────────────
     Había tres funciones eligiéndolo por su cuenta —la que dibuja el
     círculo, la que consulta OpenStreetMap y la que pide clima, terreno y
     amenaza— y solo la primera sabía del caso del lote. Las otras dos
     tomaban `S.centro`, que es una copia: se sincroniza al cerrar el lote y
     puede quedarse vieja después.

     El resultado de que discrepen es el peor que puede dar esta aplicación:
     el círculo dibujado en un sitio y las cifras traídas de otro, sin nada
     en pantalla que lo delate. Llegó reportado así —«el análisis lo hizo
     alrededor de mi ubicación y no donde le marqué»— con la captura de un
     círculo a la izquierda y todos los puntos a la derecha.

     Ahora es una sola función y se calcula al usarla, no se guarda. Tres
     lugares no pueden discrepar si solo hay uno. */
  function centroDeAnalisis() {
    if (S.forma === 'poligono' && S.poligono && S.poligono.length >= 3) {
      return centroideDe(S.poligono);
    }
    if (S.forma === 'lote') {
      var c = centroDelLote();
      if (c) return c;
    }
    return S.centro;
  }

  /* De dónde salió ese punto, con las MISMAS ramas y en el mismo orden que la
     función de arriba. Van juntas a propósito: si una crece una rama y la
     otra no, la hoja diría que el análisis se hizo alrededor de una cosa
     mientras se hace alrededor de otra, que es peor que no decir nada. */
  function origenDelCentro() {
    if (S.forma === 'poligono' && S.poligono && S.poligono.length >= 3) return 'area';
    if (S.forma === 'lote' && centroDelLote()) return 'lote';
    return S.centroDe || 'mapa';
  }

  var ORIGEN_TEXTO = {
    area: 'el área que dibujaste',
    lote: 'el lote que marcaste',
    mapa: 'el centro del mapa, donde estaba la vista',
    ficha: 'el sector guardado que retomaste'
  };

  function comoSeEligioElCentro(id) {
    return ORIGEN_TEXTO[id] || ORIGEN_TEXTO.mapa;
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
    /* Partiendo del lote, el círculo va centrado en él: el lote amarillo se
       pinta aparte y queda encima, que es como se lee la lámina —el terreno a
       intervenir sobre el entorno que se estudia—. */
    /* Dibujando el lote y con el lote como punto de partida, el círculo sigue
       a las esquinas que se van poniendo. En cualquier otro caso manda
       `centroDeAnalisis`: si ya hay un sector analizado, su círculo es suyo y
       marcar un predio dentro no lo mueve. */
    var centro = (S.forma === 'lote' && S.loteDibujando)
      ? (centroDibujandoLote() || centroDeAnalisis())
      : centroDeAnalisis();
    if (!centro) return;
    L.circle([centro.lat, centro.lng], Object.assign({ radius: S.radioM }, estilo)).addTo(c);
    var S_centro = centro;
    L.circleMarker([S_centro.lat, S_centro.lng], {
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

    /* A cada hallazgo se le pega la etiqueta OSM de la que salió. El motor
       devuelve el punto ya clasificado —categoría, subcategoría, nombre— pero
       para devolverle el dato a OpenStreetMap hace falta la etiqueta original
       (`amenity=pharmacy`), no nuestra traducción. Deshacer la clasificación
       al revés sería inventar; la etiqueta ya la había armado la app educativa
       antes de mandarla, así que se guarda y se reusa. */
    var porCoord = {};
    elementos.forEach(function (el) {
      if (!el || el.lat == null || el.lon == null) return;
      porCoord[Number(el.lat).toFixed(6) + ',' + Number(el.lon).toFixed(6)] = el.tags || {};
    });
    (comp.nuevos || []).forEach(function (n) {
      var k = Number(n.lat).toFixed(6) + ',' + Number(n.lng).toFixed(6);
      if (porCoord[k]) n.tags = porCoord[k];
    });
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
    /* El flujo, que no salía en ningún documento. Va acá y no en una sección
       propia porque es la otra mitad de «cómo funciona el sector»: la primera
       dice por dónde se llega y esta, quién pasa. */
    var flTxt = (mv && mv.flujo)
      ? (function () {
          var f = mv.flujo;
          var LEE = { peatonal: 'Manda el peatón: el proyecto se abre a la calle.',
                      vehicular: 'Manda el carro: hay que resolver el acceso y protegerse del ruido.',
                      ninguno: 'No pasa casi nadie, ni a pie ni en carro: el proyecto tiene que traer su propia gente.',
                      equilibrado: 'Peatón y carro parejos: los dos accesos hay que atenderlos bien.' };
          var FR = [['manana', 'mañana'], ['mediodia', 'mediodía'], ['tarde', 'tarde'], ['noche', 'noche']];
          return '<p>Quién pasa: flujo a pie <b>' + (f.peatonal || 0) + '</b>/100 y en carro <b>' +
            (f.vehicular || 0) + '</b>/100. ' + esc(LEE[f.dominante] || LEE.equilibrado) +
            (f.franjaFuerte ? ' Más viva en ' + esc(f.franjaFuerte) + '.' : '') +
            (f.vidaNocturna ? ' Sigue viva de noche.' : '') +
            (f.franjas
              ? ' Reparto del día: ' + FR.filter(function (x) { return f.franjas[x[0]] != null; })
                  .map(function (x) { return x[1] + ' ' + f.franjas[x[0]] + '%'; }).join(', ') + '.'
              : '') +
            ' Es una estimación a partir de los usos y los corredores, no un aforo.</p>';
        })()
      : '';
    var amTxt = am
      ? '<p>Verde y agua: ' + (am.parques || 0) + ' parque' + (am.parques === 1 ? '' : 's') + ', ' +
        (am.cuerposAgua || 0) + ' cuerpo' + (am.cuerposAgua === 1 ? '' : 's') + ' de agua, ' +
        (am.verdeNatural || 0) + ' mancha' + (am.verdeNatural === 1 ? '' : 's') + ' de verde. ' +
        'Presencia de verde ' + (am.scoreVerde || 0) + '/100.</p>'
      : '';
    return '<h2>Cómo funciona el sector</h2>' + mvTxt + flTxt + amTxt +
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
      (function () {
        var rosa = (vi.rosa || []).filter(function (r2) { return r2 && r2.pct != null; });
        var dr = rosa.length === 8
          ? dib('rosaDeRumbos', rosa.map(function (r2) { return { n: r2.pct }; }),
                { etiqueta: 'De dónde viene el viento, por rumbo' }) : '';
        return dr ? '<div class="dib dib-chico" style="max-width:150px">' + dr + '</div>' +
          '<p class="pie">La rosa de los vientos: qué parte del tiempo viene de cada rumbo.</p>' : '';
      })() +
      '<table>' + (c.meses || []).filter(function (m) { return m.lluvia !== null; }).map(function (m) {
        return '<tr><td>' + esc(m.nombre) + '</td><td class="n">' + m.lluvia + ' mm · ' +
               (m.tMax != null ? String(m.tMax).replace('.', ',') + ' °C' : '') + '</td></tr>';
      }).join('') + '</table>' +
      '<p class="pie">' + esc(c.lectura || '') + ' ' + esc(c.advertencia || '') + '</p>';
  }

  /* ── Lo que faltaba en el informe en hojas ────────────────────────────
     El pliego y el informe son dos documentos distintos y por eso no traen lo
     mismo —uno es una hoja para colgar y el otro son páginas para leer—, pero
     lo que traen no puede CONTRADECIRSE. Seis cosas medidas llegaban al
     pliego y no al informe: quien archivara el informe de un sector se
     quedaba sin la inundación, sin el ruido, sin la sombra que arroja, sin la
     infraestructura, sin el flujo y sin la evolución.

     La regla, para lo que venga: una medición nueva entra en los dos o en
     ninguno, y si entra en uno solo hay que poder decir por qué. */
  function demografiaImpresa(st) {
    var d = st && st.demografia;
    if (!d || !d.totalSexo) return '';
    return '<h2>Quién vive acá</h2><table>' +
      '<tr><td>Mujeres</td><td class="n">' + conComa(d.pctMujeres || 0) + '%</td></tr>' +
      '<tr><td>Hombres</td><td class="n">' + conComa(d.pctHombres || 0) + '%</td></tr>' +
      (d.envejecimiento != null
        ? '<tr><td>Índice de envejecimiento</td><td class="n">' + conComa(d.envejecimiento) + '</td></tr>'
        : '') +
      (d.tramos || []).filter(function (t) { return (t.personas || 0) > 0; }).map(function (t) {
        return '<tr><td>' + esc(t.etiqueta) + '</td><td class="n">' +
          Number(t.personas).toLocaleString('es-CO') + '</td></tr>';
      }).join('') +
      '</table>' +
      (d.tramoDominanteEtq
        ? '<p>El grupo más numeroso es <b>' + esc(d.tramoDominanteEtq) + '</b>. Es lo que decide ' +
          'el programa: no pide lo mismo un sector de familias jóvenes que uno que envejece.</p>'
        : '') +
      '<p class="pie">Censo del DANE de 2018 por manzana, proyectado al año en curso. Es el ' +
      'reparto de quien vive acá, no de quien pasa.</p>';
  }

  /* ── Cuánta gente vive acá ─────────────────────────────────────────────
     `demografiaImpresa` cuenta CÓMO está repartida la gente —sexo, edades—
     pero no CUÁNTA hay. El conteo del censo, la proyección a hoy y el
     pronóstico salían en la ficha y en ningún documento: el pliego llevaba
     el número suelto en «El sitio» y el informe no llevaba nada. Es la
     primera cifra que pide un jurado —«¿para cuánta gente proyectás?»— y no
     se podía citar.

     La proyección va marcada como tal en la misma tabla. Un conteo y un
     pronóstico no son la misma clase de dato, y ponerlos juntos sin decirlo
     es lo que hace que después alguien defienda una cifra inventada. */
  function poblacionImpresa(st) {
    if (!st) return '';
    var hay = st.poblacionCenso || st.poblacionProyectada || st.poblacionEstimada;
    if (!hay) return '';
    var n = function (x) { return Number(x).toLocaleString('es-CO'); };
    var censal = !!st.poblacionCenso;
    return '<h2>Cuánta gente vive acá</h2><table>' +
      (st.poblacionCenso
        ? '<tr><td>Contadas por el censo de ' + (st.censoAnio || '—') + '</td><td class="n">' +
          n(st.poblacionCenso) + '</td></tr>'
        : '') +
      (st.poblacionProyectada
        ? '<tr><td>Proyectadas a ' + (st.anioProyeccion || 'hoy') + '</td><td class="n">' +
          n(st.poblacionProyectada) + '</td></tr>'
        : '<tr><td>Estimadas por densidad</td><td class="n">' + n(st.poblacionEstimada) + '</td></tr>') +
      (st.crecimientoPct != null
        ? '<tr><td>Crecimiento desde el censo</td><td class="n">+' + conComa(st.crecimientoPct) + '%</td></tr>'
        : '') +
      (st.tasaAnualDane != null
        ? '<tr><td>Tasa anual del DANE</td><td class="n">' +
          conComa(Number((st.tasaAnualDane * 100).toFixed(2))) + '%</td></tr>'
        : '') +
      (st.viviendasCenso
        ? '<tr><td>Viviendas</td><td class="n">' + n(st.viviendasCenso) + '</td></tr>'
        : '') +
      (st.estrato && st.estrato.predominante
        ? '<tr><td>Estrato predominante</td><td class="n">' + esc(String(st.estrato.predominante)) +
          (st.estrato.minimo !== st.estrato.maximo
            ? ' (de ' + st.estrato.minimo + ' a ' + st.estrato.maximo + ')' : '') + '</td></tr>'
        : '') +
      '</table>' +
      '<p class="pie">' +
      (censal
        ? 'El conteo es censo del DANE por manzana; lo demás es proyección con su tasa de ' +
          'crecimiento. <b>El pronóstico no es un dato contado.</b>'
        : 'Sin cobertura del censo en este punto: la cifra es una estimación por densidad, no ' +
          'un dato observado.') +
      (st.advertenciaProyeccion ? ' ' + esc(st.advertenciaProyeccion) : '') + '</p>';
  }

  /* ── Dónde está la calle comercial ─────────────────────────────────────
     Los núcleos: no cuántos comercios hay —eso ya lo dice «por categoría»—
     sino dónde se juntan. Un jurado que ve «38 locales a 120 m al oriente»
     entiende de qué lado se abre el proyecto; el mismo número repartido por
     todo el sector no dice nada. */
  function nucleosImpresos(st) {
    var ns = (st && st.nucleos) || [];
    if (!ns.length) return '';
    return '<h2>Dónde está la calle comercial</h2><table class="ancha">' +
      ns.map(function (x, i) {
        return '<tr><td>' + (i + 1) + '. ' + esc(x.rubroDominante || 'comercio') +
          ((x.nombres || []).length ? ' — ' + esc(x.nombres.join(', ')) : '') +
          '</td><td class="n">' + x.n + ' locales</td>' +
          '<td class="n">' + x.distM + ' m</td></tr>';
      }).join('') + '</table>' +
      '<p class="pie">Grupos de comercios que están juntos, con la distancia al centro del área. ' +
      'Es dónde se juntan, no cuántos hay: eso es lo que le da vida a una calle.</p>';
  }

  /* ── Cómo cambia al alejarse ───────────────────────────────────────────
     Un total no dice si las cosas están pegadas o desperdigadas. Los anillos
     sí, y de paso reparten la salida a campo: un grupo por anillo. Estaba en
     la ficha desde el principio y no llegaba a ningún documento, que es
     justamente donde hace falta —el reparto se imprime y se recorta—. */
  function anillosImpresos(st, esPol) {
    var an = ((st && st.anillos) || []).filter(function (a) { return a.n > 0; });
    if (an.length < 2) return '';
    var primero = an[0];
    return '<h2>Cómo cambia al alejarse</h2><table class="ancha">' +
      an.map(function (a) {
        return '<tr><td>' + esc(a.etiqueta) +
          ((a.ejemplos || []).length
            ? '<br><span class="ej">' + a.ejemplos.map(function (e) {
                return esc(e.nombre) + ' (' + e.distM + ' m)';
              }).join(' · ') + '</span>'
            : '') +
          '</td><td class="n">' + a.n + '</td></tr>';
      }).join('') + '</table>' +
      (primero && primero.n / Math.max(1, st.total) >= 0.5
        ? '<p>Más de la mitad de lo registrado está <b>' + esc(primero.etiqueta) +
          '</b>. Es un sector concentrado: se recorre a pie sin problema.</p>'
        : '') +
      '<p class="pie">Distancia medida desde el ' +
      (esPol ? 'centro del área dibujada' : 'centro del círculo') +
      '. Sirve para repartir el trabajo: un grupo por anillo.</p>';
  }

  function inundacionImpresa(inu) {
    if (!inu || inu.sinDato) return '';
    if (!inu.cobertura) {
      return '<h2>La inundación</h2>' +
        '<p><b>Sin modelar.</b> ' + esc(inu.que) + '</p>' +
        '<p class="pie">NO quiere decir que no se inunde: quiere decir que nadie lo midió con ' +
        'este mapa. ' + esc(inu.salvedad) + ' ' + esc(inu.fuente) + '.</p>';
    }
    var dentro = inu.trPeor != null;
    return '<h2>La inundación</h2><table>' +
      '<tr><td>Amenaza</td><td class="n">' + esc(inu.nombre) + '</td></tr>' +
      (dentro ? '<tr><td>Periodo de retorno</td><td class="n">' + inu.trPeor + ' años</td></tr>' +
                '<tr><td>Se inunda</td><td class="n">' + esc(inu.frecuencia) + '</td></tr>' : '') +
      (dentro && inu.enLaDeCien
        ? '<tr><td>En la mancha de 100 años</td><td class="n">sí · es la del POT</td></tr>' : '') +
      (inu.creciente && inu.creciente.length
        ? '<tr><td>Creciente súbita</td><td class="n">sí</td></tr>' : '') +
      '</table>' +
      '<p>' + esc(inu.que) + '</p>' +
      '<p class="pie">' + esc(inu.salvedad) + ' Escala ' + esc(inu.escala) + '. ' + esc(inu.fuente) + '.</p>';
  }

  function ruidoImpreso(ru) {
    if (!ru) return '';
    return '<h2>El ruido del tránsito</h2><table>' +
      '<tr><td>Nivel estimado</td><td class="n">' + conComa(ru.dB) + ' dB(A) · ' + esc(ru.etq) + '</td></tr>' +
      '<tr><td>Límite diurno para vivienda</td><td class="n">' + ru.limiteDiaVivienda + ' dB(A)</td></tr>' +
      ru.principales.map(function (a) {
        return '<tr><td>' + esc(a.nombre || a.etq) + '</td><td class="n">' + conComa(a.dB) +
          ' dB · a ' + a.distM + ' m</td></tr>';
      }).join('') +
      '</table>' +
      '<p class="pie">ESTIMADO, no medido: de la jerarquía de las ' + ru.cuantas + ' vías cercanas y ' +
      'su distancia, con caída de 3 dB al doblar la distancia y suma de energías. No sabe cuánto ' +
      'tránsito pasa, ni si hay semáforo, pendiente, tapia o fachada que rebote, ni cuenta las ' +
      'motos aparte. Límite de la Resolución 627 de 2006.</p>';
  }

  function sombraProyectoImpresa(sp) {
    if (!sp || !sp.horas || !sp.horas.length) return '';
    var util = sp.horas.filter(function (h) { return !h.bajo; });
    if (!util.length) return '';
    return '<h2>La sombra que arroja el proyecto</h2><table>' +
      '<tr><td>Volumen que permite la norma</td><td class="n">' + sp.pisos + ' pisos · ' +
        sp.alturaM + ' m</td></tr>' +
      '<tr><td>Huella</td><td class="n">' + Number(sp.huellaM2).toLocaleString('es-CO') + ' m²</td></tr>' +
      util.map(function (h) {
        return '<tr><td>A las ' + h.hora + ':00</td><td class="n">' +
          Number(h.m2Fuera).toLocaleString('es-CO') + ' m² fuera del lote · ' +
          (h.tocados.length
            ? h.tocados.length + (h.tocados.length === 1 ? ' vecino tocado' : ' vecinos tocados') +
              ' · al más afectado ' + h.tocados[0].pct + '%'
            : 'sin vecinos tocados') + '</td></tr>';
      }).join('') +
      '</table>' +
      '<p class="pie">El volumen es el que permite la norma, no un proyecto dibujado, y la huella ' +
      'se modela encogiendo el lote hacia su centro: un proyecto real se separa distinto en cada ' +
      'lindero. Sirve para saber a quién le cae la sombra y en qué orden de magnitud.' +
      (sp.vecinosSinPisos ? ' ' + sp.vecinosSinPisos + ' vecinos sin pisos registrados no se ' +
      'pueden evaluar.' : '') + '</p>';
  }

  function infraImpresa(inf) {
    if (!inf) return '';
    return '<h2>Infraestructura de servicios</h2><table>' +
      inf.lista.slice(0, 10).map(function (x) {
        return '<tr><td>' + esc(x.nombre || (x.etq || 'Sin nombre')) + '</td><td class="n">' +
          (x.etq && x.nombre ? esc(x.etq) + ' · ' : '') +
          (x.distM != null ? 'a ' + x.distM + ' m' : 'sin ubicar') + '</td></tr>';
      }).join('') +
      '</table>' +
      '<p class="pie">Esto NO es la cobertura de servicios públicos: es lo que OpenStreetMap tiene ' +
      'registrado como infraestructura y a qué distancia queda. Si el barrio tiene agua, ' +
      'alcantarillado y energía, y cuántas horas al día, lo levanta el censo del DANE por manzana ' +
      'y no hay servicio que lo sirva a una aplicación.</p>';
  }

  function evolucionImpresa(evo) {
    var EV = window.URBIS_EVOLUCION;
    var L = evo && evo.landsat, W = evo && evo.wayback;
    if (!EV || (!L && !W)) return '';
    var conFoto = function (ps) {
      return (ps || []).filter(function (p) { return p.ok && p.imagen; });
    };
    var fotos = conFoto(W && W.pasos);
    var medidos = conFoto(L && L.pasos).filter(function (p) { return p.medida; });
    var cifras = ((L && L.pasos) || []).filter(function (p) { return p.ok && p.medida; });
    if (!fotos.length && cifras.length < 2) return '';
    var t = L && L.tendencia;
    /* Las estampas, también acá. El informe llevaba una tabla de porcentajes
       y ninguna imagen: se pidió que el historial saliera «diagramado en el
       PDF», y una tabla de números no es el historial de un sitio, es su
       resumen. La regla de siempre —una medición entra en los dos documentos
       o en ninguno— vale igual para cómo se presenta. */
    var tira = function (pasos, clase, pieDe) {
      if (!pasos.length) return '';
      return '<div class="evo' + (clase ? ' ' + clase : '') + '">' +
        pasos.map(function (p) {
          return '<figure' + (p.fiable === false || p.sustituto ? ' class="dudoso"' : '') + '>' +
            '<img src="' + p.imagen + '" alt="El sector en ' + (p.anioReal || p.anio) + '">' +
            '<figcaption>' + (p.anioReal || p.anio) + '</figcaption>' +
            '<small>' + esc(pieDe(p)) + '</small></figure>';
        }).join('') + '</div>';
    };
    return '<h2>Cómo cambió el sitio</h2>' +
      (fotos.length
        ? '<h3>Las fotos, de ' + (fotos[0].anioReal || fotos[0].anio) + ' a ' +
          (fotos[fotos.length - 1].anioReal || fotos[fotos.length - 1].anio) + '</h3>' +
          tira(fotos, 'evo-alta', function (p) { return p.fecha || ''; }) +
          '<p class="pie">Debajo de cada foto va la <b>fecha de la entrega</b> de la que salió, no ' +
          'el año que se pidió: el proveedor publica por entregas fechadas. Son para mirar —qué se ' +
          'construyó, qué se taló, por dónde iba el agua— y por eso no llevan porcentaje.</p>'
        : '') +
      (medidos.length ? '<h3>Medido desde ' + medidos[0].anio + '</h3>' +
        tira(medidos, '', function (p) { return conComa(p.medida.verde) + '% verde'; }) : '') +
      (cifras.length
        ? '<table>' + cifras.map(function (p) {
            return '<tr><td>' + p.anio + (p.fiable ? '' : ' (medio tapado, no cuenta)') +
              '</td><td class="n">' + conComa(p.medida.verde) + '% verde · ' +
              conComa(p.medida.duro) + '% duro · ' + conComa(p.medida.agua) + '% agua</td></tr>';
          }).join('') + '</table>'
        : '') +
      (t
        ? EV.conclusion(L).map(function (c) {
            return '<p>' + esc(c.texto) + ' <b>' + esc(c.dato) + '</b></p>';
          }).join('')
        : '') +
      (cifras.length
        ? '<p class="pie">Landsat, 30 m por píxel: la imagen se ve a cuadros y el lote son unos ' +
          'pocos píxeles, pero lo que se mide es una proporción sobre miles y eso sí aguanta. Con ' +
          'NDVI, el índice de la banda infrarroja, que significa lo mismo en 1984 y hoy; el ' +
          'clasificador de colores de la foto de hoy mediría la diferencia entre dos cámaras. Los ' +
          'años medio tapados por nubes se marcan y no entran en la conclusión.</p>'
        : '');
  }

  /* Las sombras de los vecinos, impresas. El dibujo y las tres cifras: es lo
     que se lleva a la asesoría para defender dónde va el patio. */
  function sombrasImpresas(so) {
    if (!so || !so.horas || !so.horas.length) return '';
    var d = dib('planoDeSombras', so);
    return '<h2>La sombra de los vecinos sobre el lote</h2>' +
      (d ? '<div class="dib dib-ancho">' + d + '</div>' : '') +
      '<table>' +
        so.horas.map(function (h) {
          return '<tr><td>A las ' + h.hora + ':00 · sol a ' + h.altitud + '°</td>' +
            '<td class="n">' + h.pctLote + '% del lote</td></tr>';
        }).join('') +
      '</table>' +
      '<p class="pie">' + so.vecinos + ' edificios a menos de 200 m, el más alto de ' + so.masAlto +
      ' pisos, contando ' + so.alturaPorPiso + ' m por piso.' +
      (so.vecinosSinPisos
        ? ' Otros ' + so.vecinosSinPisos + ' no tienen pisos registrados y no proyectan nada: la ' +
          'sombra real es mayor que esta.'
        : '') +
      ' No entran árboles ni muros y el terreno se supone plano.</p>';
  }

  function terrenoImpreso(t, terLote, curvas) {
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
      /* Los cortes DEL SECTOR: A–A′, B–B′ y los que haya dibujado el
         estudiante. Faltaban en el PDF, y era el hueco más caro de todos:
         alguien corta el terreno por donde le importa, parado en la calle, y
         eso no aparece en la hoja que entrega. La ficha los mostraba, la
         lámina también, y el informe no.

         Cada uno con su rótulo debajo —A–A′, C–C′— porque un corte sin
         nombre no se puede referir desde el texto ni cruzar con la línea
         dibujada en el plano, que es para lo que sirve la letra. */
      ((t.perfiles || []).length
        ? '<h3>Cortes del terreno</h3>' +
          (t.perfiles || []).map(function (p) {
            var d = dib('corteTopografico', { etiqueta: p.etiqueta || '', puntos: p.puntos || [] });
            if (!d) return '';
            return '<div class="dib dib-ancho">' + d + '</div>' +
              '<p class="pie pie-corte"><b>' + esc((p.marca || '') + '–' + (p.marcaFin || '')) +
              '</b> ' + esc(p.etiqueta || '') +
              (p.aMano ? ' · trazado en campo' : '') +
              (p.largoM ? ' · ' + p.largoM + ' m' : '') + '</p>';
          }).join('') +
          '<p class="pie">Las líneas de estos cortes van marcadas en el plano del sector con su ' +
          'letra en cada punta.</p>'
        : '') +
      /* Los cortes por el lote van también al PDF: es la hoja que la
         estudiante lleva impresa a la asesoría. */
      (terLote && terLote.cortes && terLote.cortes.length
        ? terLote.cortes.map(function (c) {
            var d = dib('corteTopografico', c);
            return d ? '<div class="dib dib-ancho">' + d + '</div>' : '';
          }).join('') +
          '<p class="pie">Los dos cortes cruzan el sector por el centro del lote; la banda amarilla ' +
          'es el lote.' +
          (terLote.baja ? ' Ahí el terreno baja hacia el ' + esc(terLote.baja.nombre) +
            (terLote.pendientePct != null ? ', con ' + terLote.pendientePct + '% de pendiente' : '') + '.' : '') +
          '</p>'
        : '') +
      (curvas && curvas.curvas && curvas.curvas.length
        ? '<p class="pie">Curvas de nivel cada ' + curvas.intervalo + ' m, entre los ' +
          curvas.zMin + ' y los ' + curvas.zMax + ' msnm: van dibujadas sobre el plano del sector ' +
          'en la lámina, y se pueden ver sobre el mapa desde la aplicación.</p>'
        : '') +
      '<p class="pie">' + esc(t.lectura || '') + ' Alturas de un modelo de ' + t.resolucionM +
      ' m de paso (' + esc(t.fuente || '') + '): sirve para leer el relieve, no para dar la cota de una ' +
      'esquina. La medida fina se levanta en campo.</p>';
  }

  /* ¿Este trazado midió algo, o son ceros de no haber encontrado nada?

     Los dos se ven idénticos en la respuesta del motor: con un sector donde
     OpenStreetMap no tiene nada, contesta 0 km de vías, 0 intersecciones, 0
     edificios y una lectura honesta al pie que dice que no hay con qué
     describir la traza. Pero la lectura va DESPUÉS de una tabla de cinco
     ceros, y lo que se lee primero es la tabla. En un PDF que se entrega,
     «0 intersecciones» no se lee como «acá no hay datos»: se lee como una
     medición, y en un sector urbano es una medición imposible.

     Es el mismo error que decirle a alguien que su lote no se inunda cuando
     nadie lo midió, y que darle una cuenta de índices inventados con cara de
     norma. Tercera vez en esta aplicación, en el tercer sitio distinto.

     Acá además no es un callejón sin salida: que OSM no tenga nada mapeado es
     el PRINCIPIO del ejercicio de campo, y URBIS ya sabe exportar a JOSM. */
  function trazadoSinDatos(t) {
    if (!t) return true;
    var ll = t.llenos || {}, vi = t.vias || {}, mo = t.morfologia || {};
    return !(Number(vi.kmTotal) > 0) &&
           !(Number(ll.edificios) > 0) &&
           !(Number(mo.intersecciones) > 0);
  }

  /* El texto de «acá no hay nada», en un solo sitio para que la ficha, la
     lámina y el PDF digan lo mismo. */
  var TRAZADO_VACIO = 'OpenStreetMap no tiene vías ni edificios mapeados en este sector. ' +
    'Eso no quiere decir que no los haya: quiere decir que nadie los ha dibujado todavía. ' +
    'No hay cifras que mostrar acá hasta que alguien salga a levantarlas.';

  function trazadoImpreso(t) {
    if (!t) return '';
    if (trazadoSinDatos(t)) {
      return '<h2>El trazado del sector</h2>' +
        '<p class="pie">' + esc(TRAZADO_VACIO) + '</p>';
    }
    var ll = t.llenos || {}, vi = t.vias || {}, mo = t.morfologia || {};
    var tr = dib('trama', ll.pctLleno);
    return '<h2>El trazado del sector</h2>' +
      (tr ? '<div class="dib dib-chico">' + tr + '</div>' : '') +
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
    var fd = s2.foda || fodaDe(s2.favor, s2.contra, s2.falta);
    var cuerpo = FODA_CUADRANTES.map(function (q) { return lista(q.t + ' · ' + q.que, fd[q.id] || []); }).join('');
    if (!cuerpo) return '';
    return '<h2>Síntesis del sector</h2><h3>Matriz FODA</h3><table>' + cuerpo + '</table>' +
      '<p class="pie">Cada frase nace de un dato medido y solo aparece si ese dato está. Fortalezas y ' +
      'debilidades son lo interno del sector; oportunidades y amenazas, lo que le viene de afuera; lo que ' +
      'falta levantar en campo va con las oportunidades.</p>';
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

  function loteImpresoIntervenir(a, poligono) {
    if (!a) return '';
    var pl = dib('planoDelLote', poligono || S.lote, a);
    return '<h2>El lote a intervenir</h2>' +
      (pl ? '<div class="dib">' + pl + '</div>' : '') +
      '<table>' +
      '<tr><td>Área</td><td class="n">' + Number(a.areaM2).toLocaleString('es-CO') + ' m²</td></tr>' +
      '<tr><td>Perímetro</td><td class="n">' + a.perimetroM + ' m</td></tr>' +
      '<tr><td>Esquinas</td><td class="n">' + a.esquinas + '</td></tr>' +
      (a.frentes || []).map(function (f) {
        return '<tr><td>Frente sobre ' + esc(f.via) + '</td><td class="n">' + f.metros + ' m</td></tr>';
      }).join('') +
      (a.sinFrenteM
        ? '<tr><td>Sin frente a calle registrada</td><td class="n">' + a.sinFrenteM + ' m</td></tr>'
        : '') +
      (a.lados || []).map(function (l) {
        var nv = l.nivelSol || nivelDeSol(l.solTarde);
        return '<tr><td><span class="sol-punto" style="background:' + esc(nv.color) + '"></span>Lado ' +
          l.i + (l.via ? ' · ' + esc(l.via) : '') + '</td><td class="n">' +
          l.largoM + ' m · mira al ' + esc((l.mira && l.mira.nombre) || '—') + ' · ' + esc(nv.nombre) + '</td></tr>';
      }).join('') +
      '</table>' +
      (a.critica
        ? '<p class="pie">La fachada que se calienta es el lado ' + a.critica.i +
          (a.critica.via ? ' (' + esc(a.critica.via) + ')' : '') + ', que mira al ' +
          esc((a.critica.mira && a.critica.mira.nombre) || 'occidente') + ': en el trópico el sol de ' +
          'la tarde entra casi horizontal por ahí.</p>'
        : '') +
      '<p class="pie">' + (a.esquinero ? 'Lote esquinero. ' : 'Lote medianero. ') +
      a.nVecinos + ' usos registrados a menos de 200 m del centro del lote, en línea recta.</p>';
  }

  /* El recorrido a pie, impreso. Tres filas y la comparación con la línea
     recta, que es lo único que no se puede reconstruir mirando el plano. */
  function caminataImpresa(c) {
    if (!c || !c.anillos || !c.anillos.length) return '';
    var a = c.anillos[1] || c.anillos[0];
    var dif = a ? (a.usosRecta - a.usos) : 0;
    return '<h2>Hasta dónde se llega caminando</h2><table>' +
      c.anillos.map(function (x) {
        return '<tr><td>' + x.minutos + ' minutos · ' + x.metros + ' m de recorrido</td>' +
          '<td class="n">' + x.usos + '</td></tr>';
      }).join('') +
      '</table>' +
      (a && dif > 0
        ? '<p class="pie">A ' + a.minutos + ' minutos caminando se llega a ' + a.usos +
          ' usos; en línea recta parecían ' + a.usosRecta + '. Los ' + dif + ' de diferencia ' +
          'están más lejos de lo que aparentan porque hay que dar la vuelta.</p>'
        : a
          ? '<p class="pie">A ' + a.minutos + ' minutos se llega a ' + a.usos +
            ' usos: acá la línea recta no engañaba.</p>'
          : '') +
      '<p class="pie">Recorrido por las calles registradas a ' + (c.pasoMPorMin || 80) +
      ' metros por minuto; el lote engancha a la calle más cercana, a ' +
      c.distanciaAlaCalleM + ' m. No sabe si hay andén, dónde cruzar ni si la cuadra sube.</p>';
  }

  /* Lo intangible, en el PDF. Va con las notas completas: la lámina las
     recorta por falta de papel, pero el informe es donde tienen que estar
     enteras —son la voz de quien recorrió, y sin ellas las manchas de color
     no significan nada dentro de seis meses—. */
  function intangibleImpreso(marcas, an) {
    var IT = window.URBIS_INTANGIBLE;
    if (!IT) return '';
    var ms = (marcas || []).filter(IT.valida);
    if (!ms.length) return '';
    if (!an) return '';
    return '<h2>Lo intangible</h2>' +
      '<p class="pie">Todo lo demás de este informe se bajó de algún lado. Esto no: lo marcó ' +
      'quien caminó el sector. Es un testimonio, no una medición, y no se promedia con las ' +
      'cifras de arriba.</p>' +
      '<table>' +
        an.porTipo.map(function (t) {
          return '<tr><td>' + esc(t.nombre) + '</td><td class="n">' + t.n +
            (t.geom === 'linea' ? ' · ' + t.metros + ' m'
             : t.m2 ? ' · ' + formatearM2(t.m2) : '') + '</td></tr>';
        }).join('') +
        (an.pctSector != null
          ? '<tr><td>Superficie marcada</td><td class="n">' + an.pctSector + '% del sector</td></tr>'
          : '') +
      '</table>' +
      (an.lote && an.lote.dentroDe.length
        ? '<p class="pie">El lote cae dentro de: ' +
          esc(an.lote.dentroDe.map(function (x) { return x.nombre.toLowerCase(); }).join(', ')) +
          '. Eso no se resuelve con la implantación.</p>'
        : '') +
      (an.desacuerdos.length
        ? '<h3>Donde no coinciden la percepción y el conteo</h3>' +
          an.desacuerdos.map(function (d) {
            return '<p class="pie">' + esc(d.texto) + '</p>';
          }).join('')
        : '') +
      (function () {
        var conNota = ms.filter(function (m) { return !!m.nota; });
        if (!conNota.length) return '';
        return '<h3>En sus palabras</h3><table>' +
          conNota.map(function (m) {
            var t = IT.tipo(m.tipo) || { nombre: m.tipo };
            return '<tr><td>' + esc(t.nombre) + '</td><td>' + esc(m.nota) + '</td></tr>';
          }).join('') + '</table>';
      })() +
      an.avisos.map(function (a) { return '<p class="nota">' + esc(a) + '</p>'; }).join('');
  }

  function queCabeImpreso(lote, idx) {
    var Q = window.URBIS_QUE_CABE;
    if (!Q || !lote) return '';
    var q = null;
    try { q = Q.calcular(lote, idx || S.indices || Q.porDefecto(), ctxQueCabe(), S.indicesPuestos); }
    catch (e) { return ''; }
    if (!q) return '';
    return '<h2>Qué cabe en el lote</h2>' +
      '<p class="pie"><b>Los índices de esta cuenta los puso a mano quien hizo el informe y ' +
      'salen del POT del municipio.</b> URBIS no los conoce ni los verifica: si están mal, ' +
      'todo lo que sigue está mal. Buscarlos y citarlos es parte del trabajo.</p>' +
      '<table>' +
        '<tr><td>Índice de ocupación</td><td class="n">' +
          String(q.indices.io).replace('.', ',') + '</td></tr>' +
        '<tr><td>Índice de construcción</td><td class="n">' +
          String(q.indices.ic).replace('.', ',') + '</td></tr>' +
        '<tr><td>Altura máxima</td><td class="n">' + q.indices.pisos + ' pisos</td></tr>' +
        '<tr><td>Aislamientos (antejardín / lateral / posterior)</td><td class="n">' +
          q.indices.aisFrente + ' / ' + q.indices.aisLado + ' / ' + q.indices.aisFondo +
          ' m</td></tr>' +
        '<tr><td>Área del lote</td><td class="n">' + formatearM2(q.areaLoteM2) + '</td></tr>' +
        '<tr><td>Área libre de aislamientos (aproximada)</td><td class="n">' +
          formatearM2(q.areaNetaM2) + '</td></tr>' +
        '<tr><td>Huella posible</td><td class="n">' + formatearM2(q.huellaM2) + '</td></tr>' +
        '<tr><td>Área construible</td><td class="n">' + formatearM2(q.construibleM2) +
          '</td></tr>' +
        '<tr><td>Pisos que salen</td><td class="n">' +
          String(q.pisosQueSalen).replace('.', ',') + '</td></tr>' +
        '<tr><td>Viviendas de ' + q.indices.m2Vivienda + ' m²</td><td class="n">' +
          q.viviendas + '</td></tr>' +
        '<tr><td>Personas, a ' + String(q.personasPorVivienda).replace('.', ',') +
          ' por vivienda</td><td class="n">' + q.personas + '</td></tr>' +
      '</table>' +
      (q.cruces.length
        ? '<h3>Contra lo que se midió del sitio</h3>' +
          q.cruces.map(function (c) { return '<p class="pie">' + esc(c.texto) + '</p>'; }).join('')
        : '') +
      /* De dónde salieron los índices, también acá: el pliego y el informe no
         pueden decir cosas distintas, y un número sin fuente en el informe
         archivado es un número que hay que volver a buscar. */
      (function () {
        var f = S.indicesFuente || {};
        if (!f.documento && !f.fecha && !f.tratamiento) {
          return '<p class="pie">Estos índices se escribieron a mano y nadie anotó de dónde ' +
            'salieron: no se pueden citar sin volver a buscar la fuente.</p>';
        }
        return '<p>Según <b>' + esc(f.documento || 'documento sin anotar') + '</b>' +
          (f.fecha ? ', de ' + esc(f.fecha) : '') +
          (f.tratamiento ? ' · tratamiento <b>' + esc(f.tratamiento) + '</b>' : '') + '.</p>';
      })() +
      q.avisos.map(function (a) { return '<p class="nota">' + esc(a) + '</p>'; }).join('');
  }

  /* La cuadra, impresa. La escala del medio: ni el sector ni el lote, sino el
     frente al que da el proyecto. Ver `laCuadraDelLote` para qué se mide y
     por qué cada cosa. */
  function cuadraImpresa(cu) {
    if (!cu) return '';
    return '<h2>La cuadra del lote</h2><table>' +
      '<tr><td>Frente sobre</td><td class="n">' + esc(cu.via || 'calle sin nombre') +
        (cu.jerarquia ? ' · ' + esc(cu.jerarquia.toLowerCase()) : '') + '</td></tr>' +
      '<tr><td>Tramo medido</td><td class="n">' + cu.largoM + ' m</td></tr>' +
      '<tr><td>Fachada construida</td><td class="n">' + cu.llenoM + ' m · ' + cu.pctLleno + '%</td></tr>' +
      '<tr><td>Edificios que dan al frente</td><td class="n">' + cu.edificios + '</td></tr>' +
      (cu.frenteTipicoM != null
        ? '<tr><td>Frente típico de un edificio</td><td class="n">' + cu.frenteTipicoM + ' m</td></tr>' : '') +
      '<tr><td>Huecos</td><td class="n">' + cu.huecos +
        (cu.mayorHuecoM ? ' · el mayor de ' + cu.mayorHuecoM + ' m' : '') + '</td></tr>' +
      (cu.esquinas.length
        ? '<tr><td>Esquinas en el tramo</td><td class="n">' +
          esc(cu.esquinas.map(function (e) { return e.nombre || 'sin nombre'; }).join(', ')) +
          '</td></tr>' : '') +
      (cu.usos.length
        ? '<tr><td>Usos que se asoman</td><td class="n">' +
          esc(cu.usos.slice(0, 4).map(function (u) { return u.nombre + ' ' + u.n; }).join(' · ')) +
          '</td></tr>' : '') +
      '</table>' +
      '<p>' + (cu.continua
        ? 'Frente continuo: la fachada acompaña la calle y un proyecto que se retire rompe algo que funciona.'
        : cu.rota
          ? 'Frente roto: más de la mitad del tramo está vacío. Acá un proyecto no continúa una fachada, la empieza.'
          : 'Frente a medias: hay fachada y hay huecos. Lo que decide es dónde caen los huecos, no el promedio.') +
      (cu.mayorHuecoM >= 25
        ? ' El hueco mayor es de ' + cu.mayorHuecoM + ' m: eso no es un retiro, es un lote sin construir o un predio grande.'
        : '') + '</p>' +
      '<p class="pie">El frente son ' + cu.largoM + ' m de la calle a la que da el lote, con lo que ' +
      'se asoma a menos de 30 m. NO es catastro: cuenta EDIFICIOS, que es lo que OpenStreetMap ' +
      'registra, no predios; dos casas pareadas con una sola huella cuentan como una.</p>';
  }

  function amenazaImpresa(am) {
    if (!am) return '';
    return '<h2>La amenaza sísmica</h2>' +
      '<table>' +
        '<tr><td>Nivel de amenaza (NSR-10)</td><td class="n">' + esc(am.nivel) + '</td></tr>' +
        (am.aa != null ? '<tr><td>Aa · aceleración horizontal pico efectiva</td><td class="n">' +
          String(am.aa).replace('.', ',') + '</td></tr>' : '') +
        (am.av != null ? '<tr><td>Av · velocidad horizontal pico efectiva</td><td class="n">' +
          String(am.av).replace('.', ',') + '</td></tr>' : '') +
        (am.ae != null ? '<tr><td>Ae · umbral de daño</td><td class="n">' +
          String(am.ae).replace('.', ',') + '</td></tr>' : '') +
        (am.intensidad
          ? '<tr><td>Cómo se percibe un sismo</td><td class="n">' +
            esc(am.intensidad.percepcion) + '</td></tr>' +
            '<tr><td>Potencial de daño esperado</td><td class="n">' +
            esc(am.intensidad.potencial) + '</td></tr>'
          : '') +
        (am.ad != null ? '<tr><td>Ad · seguridad limitada</td><td class="n">' +
          String(am.ad).replace('.', ',') + '</td></tr>' : '') +
        am.curva.map(function (p) {
          return '<tr><td>Aceleración pico en roca, cada ' + p.tr + ' años</td><td class="n">' +
            p.gal + ' gal · ' + String(p.g).replace('.', ',') + ' g</td></tr>';
        }).join('') +
      '</table>' +
      (am.pide ? '<p class="pie">' + esc(am.pide) + ' El sistema estructural lo decide un ' +
        'ingeniero: esto dice qué le pide la norma al proyecto, no cómo resolverlo.</p>' : '') +
      (am.discrepan && am.discrepan.length
        ? '<p class="pie">Las dos capas del SGC no coinciden en ' +
          esc(am.discrepan.map(function (d) {
            return d.cual + ' (' + d.normativa + ' contra ' + d.mapa + ')'; }).join(' ni en ')) +
          '. Acá se toma el de la capa de zonas NSR-10, que es la que existe para servir la ' +
          'norma. Verificalo contra la tabla A.2.3-2 antes de usarlo en un cálculo.</p>'
        : '') +
      (am.masa
        ? '<h3>Movimientos en masa</h3><table>' +
          am.masa.categorias.map(function (c) {
            return '<tr><td>Amenaza ' + esc(c.nombre.toLowerCase()) + '</td><td class="n">' +
              String(c.pct).replace('.', ',') + '% del municipio</td></tr>';
          }).join('') +
          '<tr><td>Superficie del municipio</td><td class="n">' +
          Math.round(am.masa.areaKm2).toLocaleString('es-CO') + ' km²</td></tr>' +
          '</table>' +
          '<p class="pie">Es el reparto del municipio entero, no del lote: a escala ' +
          esc(am.masa.escala) + ' un predio no se alcanza a leer, y los ' +
          Math.round(am.masa.areaKm2).toLocaleString('es-CO') + ' km² de ' +
          esc(am.masa.municipio) + ' son casi todos de ladera rural. Lo que sí habla del sitio ' +
          'es su pendiente, que se mide en la sección del terreno. Los porcentajes son los que ' +
          'publica el servicio y suman ' + String(am.masa.sumaPct).replace('.', ',') +
          '%, no cien exactos.</p>' +
          '<p class="nota">' + esc(am.masa.fuente) + '.</p>'
        : '') +
      '<p class="pie">Referido al municipio de ' + esc(am.municipio) + ' (' +
      esc(am.departamento) + '), no al lote: la NSR-10 da Aa y Av por municipio y la capa ' +
      'consultada es un punto por cabecera municipal. Si el municipio tiene microzonificación ' +
      'sísmica, esa manda sobre este valor. La aceleración se publica en gal (cm/s²); ' +
      'dividida por 981 da los g de la norma.</p>' +
      '<p class="nota">' + esc(am.fuente) +
      (am.intensidad ? '. La percepción y el potencial de daño, de ' +
        esc(am.intensidad.fuente) : '') + '.</p>';
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

  /* Por dónde pasa, impreso. Va aparte de las rutas y no dentro: aquéllas
     salen de OpenStreetMap y éstas se calculan cruzando las paradas con las
     vías con nombre del trazado, así que un sector puede tener lo uno sin lo
     otro. Y sale aunque no haya ninguna ruta registrada, que es el caso
     frecuente acá: las paradas sí están mapeadas y las rutas casi nunca. */
  function porDondeImpreso(res) {
    var pd = (function () { try { return porDondePasa(res); } catch (e) { return null; } })();
    if (!pd || !pd.ejes.length) return '';
    return '<h2>Por dónde pasa el transporte</h2><table>' +
      pd.ejes.slice(0, 8).map(function (e) {
        return '<tr><td>' + esc(e.nombre) + '</td><td class="n">' + e.n + ' parada' +
          (e.n === 1 ? '' : 's') + '</td></tr>';
      }).join('') + '</table>' +
      '<p class="pie">Cada una de las ' + pd.total + ' paradas del área se asignó a la vía con ' +
      'nombre más cercana, hasta 60 m: un paradero se pone en el andén, y más lejos de eso ya es ' +
      'otra calle.' +
      (pd.sueltas ? ' ' + pd.sueltas + ' no ' + (pd.sueltas === 1 ? 'cae' : 'caen') +
        ' cerca de ninguna vía con nombre: ahí hay que ir a mirar en qué calle están.' : '') +
      '</p>';
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
    var carta = dib('cartaSolar', { lat: Number(meta.lat), lng: Number(meta.lng) });
    return '<h2>Asoleamiento</h2>' +
      (carta ? '<div class="dib">' + carta + '</div>' : '') +
      '<table>' +
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
  /* El pliego, a un archivo PDF del tamaño que es.

     Se pidió con el diálogo de Android en la mano: al imprimir, el teléfono
     abre su propio cuadro de «Guardar como PDF» con SU lista de papeles
     —Carta, Oficio, Tabloide, ANSI— y ninguno mide 90 × 60; el pliego sale
     encajado en una hoja carta y no sirve ni para colgar ni para plotear.
     «Sería bueno ahorrar trabajo y que salga directamente en PDF, en el
     formato que yo quiero.»

     Así que se arma acá —ver js/75— y se baja como archivo. Sin otra
     pestaña, sin diálogo del sistema y sin elegir papel: el papel ya está
     escrito dentro del archivo. */
  function bajarPliegoPDF(horizontal, alAvisar) {
    var P = window.URBIS_PLIEGO_PDF;
    // Ajustada al papel antes de dibujarla: ver `laminaQueQuepa`.
    var html = laminaQueQuepa(S.resultado, { horizontal: !!horizontal, letra: S.pliegoLetra });
    if (!P || !P.disponible()) {
      // Sin lo que hace falta, se cae al camino de siempre en vez de dejar
      // a alguien sin lámina.
      abrirImpresion(html, alAvisar);
      return Promise.resolve(false);
    }
    var mm = horizontal ? { anchoMM: 900, altoMM: 600 } : { anchoMM: 600, altoMM: 900 };
    var nombre = (S.nombreGuardado || 'sector').replace(/[^\wáéíóúñÁÉÍÓÚÑ \-]/g, '').trim() || 'sector';
    S.pdfArmando = true; S.pdfAviso = 'Dibujando la lámina…'; pintar();
    return P.generar(html, {
      anchoMM: mm.anchoMM, altoMM: mm.altoMM,
      titulo: 'URBIS · ' + nombre + ' · ' + mm.anchoMM / 10 + '×' + mm.altoMM / 10 + ' cm',
      alAvisar: function (t) {
        S.pdfAviso = t;
        var c = document.getElementById('pcr-pdf-estado');
        if (c) c.textContent = t;
      }
    }).then(function (r) {
      P.bajar(r.blob, 'URBIS-lamina-' + nombre.replace(/\s+/g, '-') + '-' +
                      (mm.anchoMM / 10) + 'x' + (mm.altoMM / 10) + '.pdf');
      S.pdfArmando = false;
      if (alAvisar) {
        alAvisar('Lámina bajada: ' + (mm.anchoMM / 10) + ' × ' + (mm.altoMM / 10) + ' cm, ' +
                 Math.round(r.bytes / 1048576 * 10) / 10 + ' MB a ' + r.dpi + ' puntos por pulgada. ' +
                 'Está en las descargas del teléfono, ya con su tamaño puesto.');
      }
      return true;
    }).catch(function (e) {
      S.pdfArmando = false; S.pdfAviso = '';
      /* Y NO se cae en silencio al cuadro de impresión del teléfono. Eso es
         lo que pasaba: el PDF fallaba al final, se abría el cuadro de Android
         con su lista de papeles, y desde afuera parecía que el botón nuevo no
         hacía nada. Se dice qué falló y se deja la otra puerta a un toque,
         para que abrirla sea una decisión y no una sorpresa. */
      S.pdfError = 'No se pudo armar el PDF en este teléfono: ' + ((e && e.message) || e) +
        '. Podés abrir la vista de impresión, pero ahí el tamaño del papel lo elige el ' +
        'teléfono y el pliego sale encajado en una hoja carta.';
      if (alAvisar) alAvisar('');
      pintar();
      return false;
    });
  }

  /* La lámina de un sector GUARDADO, también en PDF. Misma cuenta que la de
     la ficha viva; lo único distinto es de dónde sale el nombre y que el
     aviso va a la pestaña. */
  function bajarPliegoDeFicha(f, horizontal, html, alAvisar) {
    var P = window.URBIS_PLIEGO_PDF;
    if (!P || !P.disponible()) { abrirImpresion(html, alAvisar); return; }
    var mm = horizontal ? { anchoMM: 900, altoMM: 600 } : { anchoMM: 600, altoMM: 900 };
    var nombre = String((f && f.nombre) || 'sector').replace(/[^\wáéíóúñÁÉÍÓÚÑ \-]/g, '').trim() || 'sector';
    if (alAvisar) alAvisar('Dibujando la lámina… tarda unos segundos.');
    P.generar(html, {
      anchoMM: mm.anchoMM, altoMM: mm.altoMM,
      titulo: 'URBIS · ' + nombre + ' · ' + mm.anchoMM / 10 + '×' + mm.altoMM / 10 + ' cm',
      alAvisar: function (t) { if (alAvisar) alAvisar(t); }
    }).then(function (r) {
      P.bajar(r.blob, 'URBIS-lamina-' + nombre.replace(/\s+/g, '-') + '-' +
                      (mm.anchoMM / 10) + 'x' + (mm.altoMM / 10) + '.pdf');
      if (alAvisar) {
        alAvisar('Lámina bajada: ' + (mm.anchoMM / 10) + ' × ' + (mm.altoMM / 10) + ' cm, ' +
                 Math.round(r.bytes / 1048576 * 10) / 10 + ' MB a ' + r.dpi + ' puntos por pulgada. ' +
                 'Está en las descargas del teléfono, ya con su tamaño puesto.');
      }
    }).catch(function (e) {
      if (alAvisar) {
        alAvisar('No se pudo armar el PDF en este teléfono: ' + ((e && e.message) || e) +
                 '. Probá desde la ficha del sector, o imprimí desde un computador.');
      }
    });
  }

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

  /* El logo de URBIS, el de verdad.

     Estuvo dibujado en trazos durante dos versiones: se midió el archivo
     píxel a píxel y el dibujo caía dentro de dos píxeles en el contorno del
     pin, en el punto amarillo y en los dos tallos de la U. No alcanzó: la U
     salía con otra forma y se notaba. «Deja este logo original, deja esta
     forma tal cual.» Una marca no se aproxima.

     Así que va el archivo, incrustado en base64 (js/77) y no como ruta: la
     lámina se arma en una ventana o en un marco que no comparte la carpeta
     del sitio, y un `<img src="assets/…">` sale roto justo en la cabecera.
     A 192 píxeles y quince milímetros de lado son más de trescientos puntos
     por pulgada, que es más de lo que imprime un plotter.

     Si por lo que sea no está el archivo de la marca, no se pone nada: mejor
     la cabecera sin logo que con un logo que no es el logo. */
  function marcaURBIS(mm) {
    var png = window.URBIS_MARCA_PNG;
    if (!png) return '';
    var m = mm || 14;
    return '<img class="logo" src="' + png + '" width="' + m + 'mm" height="' + m + 'mm" ' +
      'alt="URBIS" style="width:' + m + 'mm;height:' + m + 'mm">';
  }

  /* La lámina de un sector GUARDADO, también en PDF. Misma cuenta que la de
     la ficha viva; lo único distinto es de dónde sale el nombre y que el
     aviso va a la pestaña. */
  function bajarPliegoDeFicha(f, horizontal, html, alAvisar) {
    var P = window.URBIS_PLIEGO_PDF;
    if (!P || !P.disponible()) { abrirImpresion(html, alAvisar); return; }
    var mm = horizontal ? { anchoMM: 900, altoMM: 600 } : { anchoMM: 600, altoMM: 900 };
    var nombre = String((f && f.nombre) || 'sector').replace(/[^\wáéíóúñÁÉÍÓÚÑ \-]/g, '').trim() || 'sector';
    if (alAvisar) alAvisar('Dibujando la lámina… tarda unos segundos.');
    P.generar(html, {
      anchoMM: mm.anchoMM, altoMM: mm.altoMM,
      titulo: 'URBIS · ' + nombre + ' · ' + mm.anchoMM / 10 + '×' + mm.altoMM / 10 + ' cm',
      alAvisar: function (t) { if (alAvisar) alAvisar(t); }
    }).then(function (r) {
      P.bajar(r.blob, 'URBIS-lamina-' + nombre.replace(/\s+/g, '-') + '-' +
                      (mm.anchoMM / 10) + 'x' + (mm.altoMM / 10) + '.pdf');
      if (alAvisar) {
        alAvisar('Lámina bajada: ' + (mm.anchoMM / 10) + ' × ' + (mm.altoMM / 10) + ' cm, ' +
                 Math.round(r.bytes / 1048576 * 10) / 10 + ' MB a ' + r.dpi + ' puntos por pulgada. ' +
                 'Está en las descargas del teléfono, ya con su tamaño puesto.');
      }
    }).catch(function (e) {
      if (alAvisar) {
        alAvisar('No se pudo armar el PDF en este teléfono: ' + ((e && e.message) || e) +
                 '. Probá desde la ficha del sector, o imprimí desde un computador.');
      }
    });
  }

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

  /* Las redes de URBIS, para el pie de todo lo que se imprime. Van acá y no
     escritas cuatro veces: el día que cambie una cuenta se cambia una línea y
     no queda un documento viejo mandando a un perfil que ya no existe.

     Cada una con su icono y separada de la otra. Se probó primero con la
     frase corrida —«Instagram y TikTok @urbis_co»— y en el pliego impreso se
     leía como una línea más de texto legal: la marca de una red se reconoce
     por su forma antes que por su nombre, y dos logos a la derecha del pie se
     ven desde lejos donde una frase no.

     Los iconos van dibujados acá y no traídos de ninguna parte: son dos
     trazos, el PDF se arma metiendo el HTML en un SVG y una imagen externa lo
     habría dejado en blanco. */
  var CUENTA_URBIS = '@urbis_co';
  var LOGO_RED = {
    instagram: '<rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5.4" fill="none" ' +
      'stroke="currentColor" stroke-width="2"/>' +
      '<circle cx="12" cy="12" r="4.3" fill="none" stroke="currentColor" stroke-width="2"/>' +
      '<circle cx="17.5" cy="6.6" r="1.35" fill="currentColor"/>',
    tiktok: '<path fill="currentColor" d="M15.9 2.2h2.9c.2 1.3.8 2.4 1.8 3.2.8.6 1.7 1 2.7 1.1v2.9' +
      'c-1.7 0-3.3-.5-4.6-1.5v6.4a6.1 6.1 0 1 1-6.1-6.1c.3 0 .6 0 .9.1v3a3.2 3.2 0 1 0 2.4 3.1V2.2z"/>'
  };
  function logoRed(cual, tam) {
    var d = LOGO_RED[cual];
    if (!d) return '';
    return '<svg viewBox="0 0 24 24" width="' + tam + '" height="' + tam + '" ' +
      'aria-hidden="true" focusable="false">' + d + '</svg>';
  }
  /* El bloque del pie: los dos perfiles, uno al lado del otro. `unidad` es
     'mm' en el pliego —que se compone en milímetros de papel— y 'px' en las
     hojas de tamaño carta. */
  function pieRedes(tam, unidad) {
    var u = unidad || 'px';
    return ['instagram', 'tiktok'].map(function (r) {
      return '<span class="red">' + logoRed(r, tam + u) + '<b>' + CUENTA_URBIS + '</b></span>';
    }).join('');
  }

  /* Por dónde se cortó el terreno, en la forma que dibuja la miniatura. El
     informe decía desde v72x que «las líneas de estos cortes van marcadas en
     el plano del sector con su letra en cada punta» y no iban: el plano se
     armaba con las curvas de nivel y sin las trazas, así que el lector veía
     los cortes dibujados abajo y no tenía dónde ubicarlos. Llegó en captura
     de un sector real: la caja de curvas mostraba el relieve y ninguna
     línea. */
  function grupoDeUsos(st, tope) {
    var CAT = window.AIA_CATALOGO || {};
    var G = CAT.GRUPOS || {}, COL = CAT.GRUPO_COLOR || {};
    return Object.keys((st && st.porGrupo) || {})
      .map(function (g) { return { id: g, n: st.porGrupo[g] || 0 }; })
      .filter(function (x) { return x.n > 0 && x.id !== 'otro'; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, tope || 6)
      .map(function (x) {
        var d = G[x.id] || {};
        return { c: COL[x.id] || '#94a3b8',
                 t: sinEmoji(d.t || d.nombre || x.id) + ' · ' + x.n };
      });
  }

  /* Los rangos de pendiente de la guía colombiana de movimientos en masa
     (SGC, 2017), que son los que usa cualquier estudio de zonificación: hasta
     7 % plano o suave, 7 a 15 % moderado, 15 a 30 % fuerte, más de 30 % muy
     fuerte. La pendiente es el primer factor de susceptibilidad y el único
     que se puede medir desde acá con lo que ya se tiene: el modelo de
     elevación del terreno. */
  var RANGOS_PENDIENTE = [
    { id: 'baja',    etq: 'Baja',     rango: '< 7 %',    hasta: 7,        color: '#D9F2E3' },
    { id: 'media',   etq: 'Media',    rango: '7 a 15 %', hasta: 15,       color: '#F6E27F' },
    { id: 'alta',    etq: 'Alta',     rango: '15 a 30 %', hasta: 30,      color: '#F59E0B' },
    { id: 'muyalta', etq: 'Muy alta', rango: '> 30 %',   hasta: Infinity, color: '#B91C1C' }
  ];
  function susceptibilidadPendiente(R) {
    if (!R || !R.limites || !R.z || R.filas < 3 || R.columnas < 3) return null;
    var L = R.limites, F = R.filas, C = R.columnas;
    var dLat = (L.maxLat - L.minLat) / (F - 1), dLng = (L.maxLng - L.minLng) / (C - 1);
    var latM = (L.maxLat + L.minLat) / 2;
    var pasoY = dLat * 110540, pasoX = dLng * 111320 * Math.cos(latM * Math.PI / 180);
    var z = function (f, c) { var v = R.z[f * C + c]; return v == null ? null : Number(v); };
    var celdas = [], cuenta = { baja: 0, media: 0, alta: 0, muyalta: 0 }, n = 0;
    for (var f = 0; f < F; f++) {
      for (var c = 0; c < C; c++) {
        var z0 = z(f, c); if (z0 == null) continue;
        var zn = z(Math.max(0, f - 1), c), zs = z(Math.min(F - 1, f + 1), c);
        var zo = z(f, Math.max(0, c - 1)), ze = z(f, Math.min(C - 1, c + 1));
        if (zn == null || zs == null || zo == null || ze == null) continue;
        var dzdy = (zn - zs) / (pasoY * (f === 0 || f === F - 1 ? 1 : 2));
        var dzdx = (ze - zo) / (pasoX * (c === 0 || c === C - 1 ? 1 : 2));
        var pend = Math.sqrt(dzdx * dzdx + dzdy * dzdy) * 100;
        var r2 = RANGOS_PENDIENTE.filter(function (x) { return pend < x.hasta; })[0] ||
                 RANGOS_PENDIENTE[RANGOS_PENDIENTE.length - 1];
        cuenta[r2.id]++; n++;
        var lat0 = L.maxLat - dLat * (f - 0.5), lat1 = L.maxLat - dLat * (f + 0.5);
        var lng0 = L.minLng + dLng * (c - 0.5), lng1 = L.minLng + dLng * (c + 0.5);
        celdas.push({ pts: [{ lat: lat0, lng: lng0 }, { lat: lat0, lng: lng1 },
                            { lat: lat1, lng: lng1 }, { lat: lat1, lng: lng0 }],
                      color: r2.color, rango: r2.id, pendiente: Math.round(pend * 10) / 10 });
      }
    }
    if (!n) return null;
    var reparto = {};
    Object.keys(cuenta).forEach(function (k) { reparto[k] = Math.round(1000 * cuenta[k] / n) / 10; });
    return { celdas: celdas, reparto: reparto, n: n };
  }

  /* El color de cada tipo de uso del suelo —vivienda, comercio, institucional…—
     para que las barras de «qué manda» lleven el color del uso que miden y no
     el azul de la casa. Son los de la paleta del catálogo cuando existen ahí y
     una elección fija para los que no. */
  var COLOR_USO = {
    residencial: '#F28C4B', comercial: '#E5484D', institucional: '#3B82F6',
    servicios: '#14B8A6', industrial: '#6B7280', mixto: '#6366F1', ambiental: '#22C55E'
  };

  /* La dona de las categorías, dibujada a mano: la ficha la hace con
     Chart.js, que no viaja al papel. Doce arcos y una leyenda con el color
     de cada uso, que es a la vez la TABLA DE CONVENCIONES de los mapas de
     usos —se pidió por su nombre— porque los puntos del plano llevan
     exactamente estos colores. */
function donaHTML(datos, colorDe, nombreDe) {
    var total = datos.reduce(function (a, x) { return a + x.n; }, 0);
    if (!total) return '';
    var R = 46, r = 28, cx = 60, cy = 60, ang = -Math.PI / 2, arcos = '';
    datos.forEach(function (x) {
      var a2 = ang + 2 * Math.PI * x.n / total;
      var grande = (a2 - ang) > Math.PI ? 1 : 0;
      var p = function (rad, a) { return (cx + rad * Math.cos(a)).toFixed(1) + ' ' + (cy + rad * Math.sin(a)).toFixed(1); };
      arcos += '<path d="M' + p(R, ang) + ' A' + R + ' ' + R + ' 0 ' + grande + ' 1 ' + p(R, a2) +
        ' L' + p(r, a2) + ' A' + r + ' ' + r + ' 0 ' + grande + ' 0 ' + p(r, ang) + ' Z" fill="' +
        esc(colorDe(x)) + '" stroke="#fff" stroke-width="1.2"/>';
      ang = a2;
    });
    return '<div class="dona-par">' +
      '<svg class="dona" viewBox="0 0 120 120" role="img" aria-label="Reparto de los usos por categoría">' +
        arcos + '<text x="60" y="57" text-anchor="middle" font-size="15" font-weight="800" fill="#0F1F2E">' +
        total + '</text><text x="60" y="69" text-anchor="middle" font-size="7" fill="#6B7A8A">usos</text>' +
      '</svg>' +
      '<div class="dona-ley">' + datos.map(function (x) {
        return '<span class="cv"><i class="mu mu-punto" style="background:' + esc(colorDe(x)) + '"></i>' +
          esc(nombreDe(x)) + ' <b>' + x.n + '</b></span>';
      }).join('') + '</div>' +
    '</div>';
  }


  var donaImpresa = donaHTML;

  function trazasDeCortes(ter) {
    var t = ter !== undefined ? ter : S.terreno;
    return ((t && t.perfiles) || [])
      .filter(function (p) { return p.traza && p.traza.length >= 2; })
      .map(function (p) {
        return { traza: p.traza,
                 marca: p.marca || String(p.id || 'A').charAt(0),
                 marcaFin: p.marcaFin || (String(p.id || 'A').charAt(0) + '′') };
      });
  }

  function laminaImprimible(res, opts) {
    var o = opts || {};
    /* Las cajas apagadas viajan por `opts` para que una ficha guardada se
       imprima con la composición con la que se guardó, y no con la que haya
       en pantalla en este momento. */
    var apagadas = o.pliegoOff !== undefined ? (o.pliegoOff || []) : (S.pliegoOff || []);
    var mapasApagados = o.pliegoMapasOff !== undefined
      ? (o.pliegoMapasOff || []) : (S.pliegoMapasOff || []);
    var st = res.stats || {}, meta = res.meta || {};
    var ubic = res.ubicacion || o.ubicacion || null;
    var cmp = o.campo !== undefined ? o.campo : S.campo;
    var lote = o.lote !== undefined ? o.lote : S.lote;
    var loteA = o.loteAnalisis !== undefined ? o.loteAnalisis
              : (function () { try { return analisisDelLote(); } catch (e) { return null; } })();
    /* Los rumbos con y sin datos: la misma cuenta que hace la ficha. Acá se
       rehace porque la lámina puede imprimirse de un sector guardado, donde
       las zonas no viajan con la ficha pero los puntos sí. */
    var zonasL = (function () {
      try {
        var c = (meta.lat != null && meta.lng != null)
          ? { lat: Number(meta.lat), lng: Number(meta.lng) } : null;
        return c ? zonasSinDatos(res.pois || [], c) : null;
      } catch (e) { return null; }
    })();
    var curvasL = o.curvas !== undefined ? o.curvas
                : (function () { try { return curvasDelTerreno(); } catch (e) { return null; } })();
    var sombrasL = o.sombras !== undefined ? o.sombras
                 : (function () { try { return sombrasDelLote(); } catch (e) { return null; } })();
    var terLote = o.terrenoLote !== undefined ? o.terrenoLote
                : (function () { try { return terrenoDelLote(); } catch (e) { return null; } })();
    var cam = o.caminata !== undefined ? o.caminata : S.caminata;
    var ter = o.terreno !== undefined ? o.terreno : S.terreno;
    var cli = o.clima !== undefined ? o.clima : S.clima;
    var trz = o.trazado !== undefined ? o.trazado : S.trazado;
    var huellas = o.huellas !== undefined ? o.huellas : S.trzHuellas;
    var nombre = String(o.nombre !== undefined ? o.nombre : (S.nombreGuardado || '')).trim();
    var esPol = meta.forma === 'poligono';
    /* Dos formatos del mismo pliego: 60 × 90 vertical, que es el que entra en
       cualquier plotter, y 90 × 60 acostado, que es como se cuelga en un panel
       de entrega. El contenido es el mismo; lo que cambia es cómo se acomoda.

       En vertical va una rejilla con cajas de distinto ancho: el plano grande
       arriba a la izquierda y el resto alrededor. Esa rejilla no sirve
       acostada. Con 300 mm menos de alto, cada fila vale por el alto de su
       caja más larga y los huecos que deja el encaje se pagan tres veces; con
       los dibujos dentro, la hoja dejó de cerrar y las últimas cajas se
       recortaban sin avisar.

       Acostada, entonces, no hay rejilla: hay tres columnas de periódico. Cada
       caja conserva su alto natural, no se parte por la mitad y la siguiente
       arranca pegada — no quedan huecos que rellenar. El alto que hace falta
       pasa a ser la suma de todo dividida entre tres, que es lo mínimo que
       puede ocupar este contenido en este papel. */
    var horiz = !!o.horizontal;
    var HOJA_W = horiz ? 900 : 600, HOJA_H = horiz ? 600 : 900;
    /* Cuánto se encoge la rejilla para que la hoja cierre. Lo pone
       `laminaQueQuepa` después de medir; 1 es «tal cual».

       El suelo es 0,4 y no 0,7, y la diferencia entre los dos números es una
       decisión, no una calibración. MEDIDO con un sector de diez capas —que es
       el que se reportó: «veo 10 mapas en el último análisis que hice»— más el
       lote de veintidós lados, con 0,7 el pliego se pasaba 201 mm por abajo,
       con 0,5 dieciséis y con 0,45 diez: se perdían cajas enteras sin avisar,
       que es el fallo del que salió todo esto.

       Entre una hoja apretada y una hoja incompleta, apretada: lo apretado se
       ve y se decide —se apagan capas y el resto crece—, lo que falta no se
       ve. Y se dice: la ficha avisa a qué tamaño se compuso antes de imprimir.
       Un pliego al 40 % es la señal de que sobran capas para este papel, no un
       pliego roto. */
    var escalaHoja = Math.max(0.3, Math.min(1, Number(o.escala) || 1));
    /* Cuántos lados del lote se enumeran antes de pasar al reparto. Acostada
       la hoja tiene 300 mm menos de alto, así que aguanta menos renglones.
       Ver el porqué entero donde se usan, en la caja del lote. */
    var TECHO_LADOS = horiz ? 7 : 9;
    var TECHO_AL_SOL = horiz ? 5 : 7;
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
                 (trz && trz.espacio && trz.espacio.piezas ? 1 : 0) +
                 (cam && cam.anillos && cam.anillos.length ? 1 : 0) +
                 (zonasL ? 1 : 0) +
                 (sombrasL && sombrasL.horas && sombrasL.horas.length ? 1 : 0) +
                 ((function () { try { return faltantesDelSector(st).length ? 1 : 0; }
                                 catch (e) { return 0; } })()) +
                 ((function () { try { return determinantesDelLote(st).length ? 1 : 0; }
                                 catch (e) { return 0; } })()) +
                 ((function () {
                    var msE = (o.intangible !== undefined ? o.intangible : S.intangible) || [];
                    return msE.length ? 1 : 0;
                  })());
    /* Acostado el plano puede ser bastante más alto: la columna en la que va
       es más angosta y le sobra papel debajo. Sin esto la lámina de 90 × 60
       quedaba con una banda blanca de 13 cm al pie. */
    /* El plano ocupa todo el ancho de la hoja, así que su alto sale de esta
       proporción: 520 de ancho por esto de alto. Cede a medida que hay más
       medido, porque lo que se mide va abajo y necesita papel; con un sector
       recién analizado se lleva media hoja, que es lo que corresponde cuando
       no hay nada más que contar. */
    /* El plano ocupa todo el ancho, así que su alto en el papel es una
       consecuencia de esa proporción. Se razona al revés: primero cuántos
       milímetros de hoja se le dan —bastantes si no hay nada más que contar,
       menos a medida que hay medido— y de ahí sale la proporción que hay que
       pedirle al dibujo.

       Acostada se le dan muchos menos: la hoja tiene 300 mm menos de alto y
       un plano a todo el ancho de 860 mm se comería el pliego entero. */
    /* Los mapas se arman una sola vez: cada uno proyecta cientos de puntos y
       hacerlo dos veces —para la banda y para contar cuántos hay— duplicaría
       el trabajo más caro de la hoja. */
    /* La forma del sector, que decide cuánto ancho merece un recuadro de mapa.
       La misma cuenta que hace `mapasDelPliego` para el dibujo; acá se
       necesita para el CSS y la rejilla, que se escriben antes. */
    var proporcionDelSector = (function () {
      try {
        var pts = (meta.forma === 'poligono' && meta.poligono && meta.poligono.length >= 3)
          ? meta.poligono : null;
        if (!pts) return 1;
        var lats = pts.map(function (q) { return +q.lat; });
        var lngs = pts.map(function (q) { return +q.lng; });
        var kx = Math.cos(((Math.min.apply(null, lats) + Math.max.apply(null, lats)) / 2) * Math.PI / 180);
        var al = Math.max.apply(null, lats) - Math.min.apply(null, lats);
        return al > 0 ? ((Math.max.apply(null, lngs) - Math.min.apply(null, lngs)) * kx) / al : 1;
      } catch (e) { return 1; }
    })();
    var mapas = (function () {
      try {
        return mapasDelPliego(res, {
          // El ancho ya no se manda: lo pone la proporción del sector, dentro
          // de `mapasDelPliego`. Ver la nota de ahí.
          h: horiz ? 180 : 200,
          lote: lote, cobertura: o.cobertura !== undefined ? o.cobertura : S.cobertura,
          estratos: o.estratos, huellas: huellas, curvas: curvasL,
          sombras: sombrasL, caminata: cam,
          intangible: o.intangible !== undefined ? o.intangible : S.intangible,
          maxCategorias: horiz ? 5 : 6
        }).filter(function (m) { return mapasApagados.indexOf(m.id) === -1; });
      } catch (e) { return []; }
    })();
    if (apagadas.indexOf('los-mapas-del-sector') !== -1) mapas = [];

    /* ── Lo ancho y lo alto de un mapa, en milímetros de papel ───────────
       Un mapa vive ahora en la banda de su tema y vale dos de sus columnas.
       Lo que mide una columna de banda es casi constante —el reparto de la
       fila es proporcional al peso, así que una columna es una columna caiga
       donde caiga—: MEDIDO, unos 81 mm acostado y unos 90 mm parado. Dos
       columnas y el hueco del medio son los que se llevan los mapas.

       El alto sale de ahí y de la proporción del dibujo, y NO de un número
       escrito a mano. Un techo de alto fijo no recorta el dibujo: lo encoge
       entero hasta caber y lo centra, así que el recuadro sigue midiendo lo
       mismo y el mapa adentro mide la mitad, con dos bandas blancas a los
       lados. Es lo que pasaba, y lo que se veía como «los mapas salen muy
       pequeños». Se calcula acá y no se le deja al navegador porque el techo
       tiene que ir escrito en la hoja de estilo: un `max-height` en
       porcentaje sobre un SVG que solo trae `viewBox` no significa nada. */
    /* Manda el ALTO, y el ancho lo pone la proporción del dibujo. Es la misma
       regla que ya siguen los demás dibujos de la hoja, y acá hace falta por
       una razón medida: el ancho de una caja NO es constante. Una banda que
       se queda sola en su fila se estira a los 860 mm, y su mapa —que vale
       dos columnas de esa banda— pasaba a medir 275 mm de ancho y 190 de
       alto. Cinco mapas así pedían 375 mm más de hoja de los que hay.

       Con el alto fijo, el mapa mide lo mismo caiga en la banda que caiga; si
       la caja le queda más ancha, sobra papel a los lados y no pasa nada, y
       si le queda más angosta se encoge entero sin deformarse. */
    /* Y NO cede con la cantidad de mediciones, como sí ceden el plano y los
       demás dibujos. Se probó y no servía: bajarlos a 62 mm no arreglaba el
       desbordamiento —lo que se pasaba no eran los mapas, era el conjunto— y
       a cambio devolvía los mapas al tamaño del que se venía quejando. Lo que
       cede ahora es la hoja entera, de una vez y en proporción: ver
       `laminaQueQuepa`. */
    /* Y NO depende de cuántos haya. Se probó encogerlos cuando hay muchos y
       sale al revés de lo que uno espera, porque la hoja se ajusta sola: lo
       que un mapa mide EN EL PAPEL es su alto por la escala a la que se
       compuso la hoja, y encogerlo de entrada solo le deja sitio al texto.

       MEDIDO con las diez capas: con 52 mm de alto la hoja cerraba al 62 % y
       el mapa salía de 32 mm; con 96, cierra más apretada y el mapa sale de
       46. Más grande, con la misma hoja y sin perder ninguna caja. Lo que
       paga la diferencia es el cuerpo de letra, que es lo que corresponde
       cuando lo que se pidió fue justamente que los mapas se vean.

       Parado el mapa mide un poco más: la hoja tiene 900 mm de alto y sobra
       papel donde acostada no sobra. */
    /* El techo de alto. Alto a propósito: solo tiene que impedir que un mapa
       en una banda muy ancha se lleve media hoja; el que manda es el ancho de
       la caja. Con un techo bajo volvía el problema de siempre —el dibujo se
       encogía hasta caber en el alto y dejaba franjas blancas a los lados—,
       que es justo lo que se pidió quitar. */
    var altoMapaMM = horiz ? 170 : 210;

    /* El plano comparte su banda con la ficha del sitio: ocupa tres de cuatro
       columnas parado y cinco de seis acostado. Si el sitio está apagado se
       queda con la fila entera. */
    var conSitio = apagadas.indexOf(slugPliego('El sitio')) === -1;
    /* Tres columnas si el sector es ancho; dos si es cuadrado. Mismo motivo
       que con los recuadros de mapa: un plano cuadrado en una caja de tres
       columnas no la puede llenar sin volverse altísimo, así que se encoge y
       queda flotando entre dos franjas de rejilla. En dos columnas la llena.
       «El cuadrado que estás analizando más grande, y no sobrealargarlo de
       más» es exactamente esto. */
    var pesoPlano = proporcionDelSector >= 1.25 ? 3 : 2;
    /* Cuántas columnas vale una fila del pliego. Acostado, la banda del plano
       comparte la fila con la del análisis ambiental y el plano se queda con
       tres de las cuatro columnas de la suya.

       Doce y no diez, y el número está MEDIDO. Con diez, las cajas nuevas de
       v739 empujaron dos bandas fuera de la fila que compartían —el ambiental
       dejó de caber con la ubicación, la morfología con lo demográfico— y la
       hoja acostada pasó de cinco filas a seis: 36 mm de más con la rejilla ya
       compuesta en su mínimo, o sea recortada por la impresora. Con doce las
       dos parejas vuelven a caber, la hoja cierra con 2 mm de sobra y, de
       paso, los recuadros del mapa suben de 68 a 73 mm de alto: al encogerse
       menos la hoja, todo lo que hay dentro se ve más grande.

       El margen es de dos milímetros, así que la próxima medición que entre
       vuelve a sacar la hoja de la hoja. No es un descuido: la prueba de
       `tpliegogrande` mide el desborde con la rejilla ya reducida y falla en
       cuanto pasa, que es exactamente como se descubrió esto. */
    var anchoFila = horiz ? 12 : 8;
    var anchoBanda1 = ((horiz ? 900 : 600) - 40) * ((pesoPlano + (conSitio ? 1 : 0)) / (horiz && mapas.length ? anchoFila : (pesoPlano + (conSitio ? 1 : 0))));
    var anchoPlanoMM = Math.round((anchoBanda1 - (conSitio ? 4 : 0)) *
                                  (conSitio ? pesoPlano / (pesoPlano + 1) : 1)) - 8;
    var altoPlanoMM = horiz ? Math.max(46, 96 - 8 * extras)
                            : Math.max(76, 198 - 14 * extras);
    // Con la banda de mapas debajo, el plano cede: son dos figuras grandes
    // seguidas y la hoja no da para las dos a tamaño completo.
    /* Con los mapas en la hoja el plano ya no es la única figura y cede; pero
       comparte banda con la ficha del sitio, que mide sus buenos 90 mm, así
       que encogerlo más de eso no le devuelve papel a nadie. */
    /* Más alto que antes: la foto y el plano son «los dos planos
       protagonistas» y con las bandas apiladas en dos renglones el papel
       alcanza. */
    if (mapas.length) altoPlanoMM = horiz ? 72 : 104;
    var altoDelPlano = Math.round(520 * altoPlanoMM / anchoPlanoMM);

    // ── El plano: el contorno con lo que hay dentro ────────────────────
    var forma = esPol && meta.poligono && meta.poligono.length >= 3
      ? { pts: meta.poligono }
      : { centro: { lat: meta.lat, lng: meta.lng }, radioM: meta.radioM };
    /* El ancho del dibujo lo pone la PROPORCIÓN del sector, no el papel.
       Con el dibujo siempre a todo el ancho, un sector cuadrado se ajustaba
       al alto y quedaba como una estampilla entre dos bandas blancas; y la
       barra de escala, que se calcula sobre el ancho, decía «5 km» para un
       sector de novecientos metros. Llegó en captura: el plano —lo que hace
       lámina a la lámina— era lo más chico de la hoja. */
    var anchoDelPlano = 520;
    try {
      var bb = forma.pts
        ? (function () {
            var lats = forma.pts.map(function (q) { return q.lat; });
            var lngs = forma.pts.map(function (q) { return q.lng; });
            var kx = Math.cos(((Math.min.apply(null, lats) + Math.max.apply(null, lats)) / 2) * Math.PI / 180);
            return { an: (Math.max.apply(null, lngs) - Math.min.apply(null, lngs)) * kx,
                     al: (Math.max.apply(null, lats) - Math.min.apply(null, lats)) };
          })()
        : { an: 1, al: 1 };
      if (bb.al > 0) {
        var proporcion = bb.an / bb.al;
        /* Un margen del 15 % alrededor del sector, y nunca más ancho que el
           papel. El mínimo es el propio alto del dibujo y no una cifra fija:
           con el plano a 76 mm de alto, un mínimo de 200 unidades volvía a
           dejar bandas vacías a los lados y la barra de escala decía «2 km». */
        anchoDelPlano = Math.max(altoDelPlano, Math.min(520, Math.round(altoDelPlano * proporcion * 1.15)));
      }
    } catch (e) { anchoDelPlano = 520; }
    var plano = (A && typeof A.miniatura === 'function')
      ? A.miniatura(forma, {
          /* Radio 1,5 y no 2,6. Con ochocientos usos, los puntos de 2,6 se
             montaban unos sobre otros y tapaban el plano entero: «salen muy
             grandes y dañan la estética y la claridad». A 1,5 se ven como
             una textura de color por sector, que es lo que dice un plano de
             usos; el detalle de cada punto está en los mapas por categoría. */
          w: anchoDelPlano, h: altoDelPlano, radioPunto: 1.5,
          // Una ficha guardada no guarda el color de cada punto —sería
          // repetir el mismo dato cientos de veces—, así que se vuelve a
          // sacar del catálogo por su grupo. Sin esto la lámina de un sector
          // viejo salía con el plano en gris.
          puntos: (res.pois || []).map(function (p) {
            return { lat: p.lat, lng: p.lng, color: p.color || COL[p.grupo] || null };
          }),
          huellas: huellas || null,
          // Las curvas de nivel van dentro del plano del sector: es el mismo
          // dibujo, no uno más, y no cuesta un milímetro de papel.
          curvas: curvasL,
          // El lote va encima del plano: es la pieza que la lámina tiene que
          // señalar con el dedo.
          lote: (lote && lote.length >= 3) ? lote : null,
          // Lo que el curso encontró y no estaba: en rombo, para que se
          // distinga del resto incluso impreso en blanco y negro.
          destacados: (cmp && cmp.nuevos ? cmp.nuevos : []).map(function (n3) {
            return { lat: n3.lat, lng: n3.lng, color: COL[n3.grupo] || '#34CCFE' };
          }),
          // Las trazas de los cortes, con su letra en cada punta: es lo que
          // el informe promete y lo que permite decir «el corte A–A′».
          cortes: trazasDeCortes(o.terreno !== undefined ? o.terreno : S.terreno),
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

    /* Una caja no sale por dos razones distintas y hay que distinguirlas: o
       no tiene con qué llenarse, o la apagaron. La primera es una medición
       que falta; la segunda, una decisión de quien arma la lámina. */
    /* Cada caja lleva la FAMILIA a la que pertenece —el sitio, el terreno y
       el clima, cómo se mueve la gente, el proyecto, lo que levantó el
       curso— y un icono. Es lo que hace que un pliego de veinte cajas se
       recorra con el ojo desde dos metros: las del mismo color se leen
       juntas, y el icono dice de qué va cada una antes que el rótulo.

       El icono va DESPUÉS del h2 y se coloca por CSS: el h2 tiene que seguir
       siendo el primer hijo de la sección y llevar el título limpio, porque
       así lo leen las pruebas y así lo entiende cualquiera que procese el
       HTML. Decorar no puede costar estructura. */
    var FAMILIAS = {
      sitio:    { tinte: '#0A6F9E', suave: '#E8F4FA' },
      suelo:    { tinte: '#0E7C86', suave: '#E3F3F4' },
      mover:    { tinte: '#0B98C4', suave: '#E4F5FB' },
      proyecto: { tinte: '#B8860B', suave: '#FBF3DC' },
      campo:    { tinte: '#6D4AC8', suave: '#EFEAFB' },
      forma:    { tinte: '#3B4A5A', suave: '#EDF1F4' },
      cierre:   { tinte: '#0F1F2E', suave: '#EEF3F7' }
    };
    var CARA = {
      'Plano del sector':                  ['sitio', 'mapa'],
      'Los mapas del sector':              ['sitio', 'capas'],
      'El sitio':                          ['sitio', 'ubicar'],
      'Qué hay, por categoría':            ['sitio', 'capas'],
      'Alturas de lo construido':          ['forma', 'edificio'],
      'Llenos y vacíos':                   ['forma', 'area'],
      'Hitos y nodos':                     ['sitio', 'red'],
      'Dónde falta mapear':                ['campo', 'norte'],
      'El terreno':                        ['suelo', 'perfil'],
      'El clima':                          ['suelo', 'nube'],
      'Asoleamiento':                      ['suelo', 'destello'],
      'La amenaza sísmica':                ['suelo', 'alerta'],
      'La inundación':                     ['suelo', 'agua'],
      'Verde y agua':                      ['suelo', 'verde'],
      'El ruido del tránsito':             ['mover', 'alerta'],
      'Infraestructura de servicios':      ['suelo', 'industria'],
      'Cómo cambió el sitio':              ['suelo', 'reloj'],
      'Quién vive acá':                    ['sitio', 'poblacion'],
      'Qué manda en el sector':             ['sitio', 'estadistica'],
      'Dónde está la calle comercial':      ['sitio', 'comercio'],
      'Cómo cambia al alejarse':            ['sitio', 'anillos'],
      'Cobertura del suelo':                ['suelo', 'satelite'],
      'Cómo se llega':                     ['mover', 'bus'],
      'La sombra de los vecinos':          ['suelo', 'brujula'],
      'La sombra que arrojás':             ['proyecto', 'destello'],
      'La cuadra del lote':                ['proyecto', 'via'],
      'A distancia de caminar':            ['mover', 'caminar'],
      'Hasta dónde se camina desde el lote': ['mover', 'ruta'],
      'El perfil de la calle':             ['mover', 'via'],
      'Espacio público efectivo':          ['mover', 'verde'],
      'El lote a intervenir':              ['proyecto', 'lapiz'],
      'Qué cabe en el lote':               ['proyecto', 'crecer'],
      'Qué le pide el sitio al proyecto':  ['proyecto', 'plan'],
      'Lo intangible':                     ['campo', 'ojo'],
      'Lo levantado en campo':             ['campo', 'campo'],
      'Lo que falta levantar':             ['campo', 'lista'],
      'Síntesis del sector':               ['cierre', 'documento']
    };
    /* Las cuatro cajas de dibujo —el lote, el clima, el asoleamiento, la
       amenaza— llevan una marca propia. Se pidieron «igual de grande a los
       mapas» y la primera respuesta fue darles dos columnas como a un
       recuadro de mapa: sacó la hoja del papel, 93 mm en la parada con la
       rejilla ya en su mínimo, y además era la respuesta a la pregunta
       equivocada.

       Lo que las hacía pequeñas no era el ancho de la caja sino que el dibujo
       no la llenaba —ver la nota de `.dib`—: la caja medía lo mismo que un
       recuadro de mapa y el dibujo se quedaba en los 240 píxeles del SVG.
       Arreglado eso, una caja de dibujo es exactamente igual de grande que un
       mapa, que es lo que se pidió, y el papel no cuesta ni un milímetro
       más. La marca se queda porque es lo que la prueba mide. */
    var CAJAS_DIBUJO = ['El lote a intervenir', 'El clima', 'Asoleamiento', 'La amenaza sísmica'];
    /* Y las que SÍ van a dos columnas, ahora que las bandas se apilan en dos
       renglones y el papel alcanza: el historial —«más grandes incluso que
       los mapas de mapeos, para ver con claridad»— y el lote, que se quedó
       sin la lista de lados y es todo dibujo. */
    var CAJAS_DOBLES = ['Cómo cambió el sitio', 'El lote a intervenir'];
    /* Y el lote además ocupa los dos renglones de su banda, como un mapa: es
       el dibujo que se pidió «más grande», y a dos columnas por un renglón
       quedaba ancho y chato, con el plano —que es casi cuadrado— del tamaño
       de antes y papel blanco a los lados. A dos por dos el plano crece de
       verdad y las cuatro cajas de la norma se apilan al lado. */
    var CAJAS_ALTAS = ['El lote a intervenir'];
    function caja(titulo, cuerpo, clase) {
      if (!cuerpo) return '';
      if (apagadas.indexOf(slugPliego(titulo)) !== -1) return '';
      var ancha = (CAJAS_DIBUJO.indexOf(titulo) !== -1 ? ' caja-dibujo' : '') +
                  (CAJAS_DOBLES.indexOf(titulo) !== -1 ? ' caja-doble' : '') +
                  (CAJAS_ALTAS.indexOf(titulo) !== -1 ? ' caja-alta' : '');
      var cara = CARA[titulo] || ['sitio', 'info'];
      var fam = FAMILIAS[cara[0]] || FAMILIAS.sitio;
      /* Las cajas con clase propia —el plano, la banda de mapas, la síntesis—
         conservan su `class` exacta: hay suites que la leen literal, y no es
         un capricho: es la promesa de que la estructura del pliego se puede
         procesar. Su tinte va por esa misma clase en la hoja de estilo. */
      return '<section class="caja ' + (clase ? clase : 'fam-' + cara[0]) + ancha + '">' +
        '<h2>' + esc(titulo) + '</h2>' +
        '<span class="ic" aria-hidden="true">' + ico(cara[1], 22) + '</span>' +
        cuerpo + '</section>';
    }
    function fila(etq, val) {
      return val === null || val === undefined || val === ''
        ? '' : '<div class="f"><span>' + esc(etq) + '</span><b>' + val + '</b></div>';
    }
    /* La tabla de convenciones de un mapa. La muestra lleva la FORMA de lo
       que representa —un punto es un punto, una vía es una raya, una mancha
       es un rectángulo, un corte es una raya punteada—: en una lámina que
       puede acabar fotocopiada en blanco y negro la forma distingue lo que el
       color ya no. */
    function convenciones(lista) {
      if (!lista || !lista.length) return '';
      return '<div class="conv conv-mp">' + lista.map(function (c) {
        if (!c || !c.t) return '';
        var f = c.f || 'punto';
        return '<span class="cv"><i class="mu mu-' + esc(f) + '" style="' +
          (f === 'punteado' ? 'border-color:' : 'background:') + esc(c.c || '#94a3b8') +
          '"></i>' + esc(c.t) + '</span>';
      }).join('') + '</div>';
    }
    /* `colorDe` es lo que pidió quien lee el pliego: «si estamos analizando
       vivienda, que es de un color, la barra debe ser de ese color». Todas las
       barras salían del mismo azul, y una barra azul de vivienda al lado de
       un mapa donde la vivienda es naranja obliga a leer dos veces. */
    function barras(lista, etqDe, valDe, pctDe, colorDe) {
      var max = lista.reduce(function (m, x) { return Math.max(m, pctDe(x)); }, 0) || 1;
      return '<div class="barras">' + lista.map(function (x) {
        var col = colorDe ? colorDe(x) : null;
        return '<div class="b"><span>' + esc(etqDe(x)) + '</span>' +
          '<i><u style="width:' + Math.round(100 * pctDe(x) / max) + '%' +
          (col ? ';background:' + esc(col) : '') + '"></u></i>' +
          '<b>' + valDe(x) + '</b></div>';
      }).join('') + '</div>';
    }
    var dona = donaHTML;

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

    /* Las cajas se arman antes de escribir la hoja, y no dentro del return,
       por una razón concreta: hace falta saber CUÁNTO OCUPAN para decidir en
       cuántas columnas se reparten. Un sector recién analizado llena media
       hoja y en tres columnas quedaría con una banda blanca de un palmo; uno
       con todo medido no cabe en dos. La medida es la longitud del HTML —no
       es el alto exacto, pero es proporcional a él, y para elegir entre dos y
       tres alcanza de sobra—. */
    var cajasHTML =
      
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
      
      caja('El lote a intervenir',
      (function () {
      if (!loteA) return '';
      var pl = dib('planoDelLote', lote, loteA);
      return (pl ? '<div class="dib">' + pl + '</div>' : '') +
      '<div class="kpis">' +
      '<div class="k"><b>' + Number(loteA.areaM2).toLocaleString('es-CO') + '</b><small>m² de lote</small></div>' +
      '<div class="k"><b>' + loteA.perimetroM + '</b><small>m de perímetro</small></div>' +
      '</div>' +
      (loteA.frentes || []).map(function (f) {
      return fila('Frente sobre ' + f.via, f.metros + ' m');
      }).join('') +
      (loteA.sinFrenteM ? fila('Sin frente a calle registrada', loteA.sinFrenteM + ' m') : '') +
      /* Sin la lista de lados. Se pidió así —«en vez de una lista larga de
         cada lado con su intensidad solar, con ver el gráfico se defiende
         solo»— y es verdad: el plano acotado ya trae cada lado con su
         medida y su color de sol. Lo que la lámina agrega es la CONCLUSIÓN,
         que es lo que el dibujo no dice solo: qué cara se calienta y cuánto
         del perímetro recibe sol de la tarde. La lista entera sigue en la
         ficha, en pantalla y con scroll. */
      (function () {
      var lados = (loteA.lados || []).map(function (l) {
      return { l: l, nv: l.nivelSol || nivelDeSol(l.solTarde) };
      });
      if (!lados.length) return '';
      var alSol = lados.filter(function (x) { return x.nv.id !== 'ninguno'; });
      var mSol = alSol.reduce(function (a, x) { return a + (Number(x.l.largoM) || 0); }, 0);
      var peor = lados.slice().sort(function (a, b) {
      return (b.l.solTarde || 0) - (a.l.solTarde || 0); })[0];
      return '<p class="lee">' +
      (peor && peor.nv.id !== 'ninguno'
      ? 'La cara que más se calienta es el <b>lado ' + peor.l.i + '</b>' +
        (peor.l.via ? ' sobre ' + esc(peor.l.via) : '') + ' —' + peor.l.largoM + ' m, ' +
        esc(peor.nv.nombre) + '—: es la que hay que proteger del sol de la tarde. '
      : 'Ningún lado recibe sol pleno de la tarde. ') +
      (alSol.length
      ? '<b>' + alSol.length + ' de ' + lados.length + ' lados</b> reciben algo de sol de la tarde, ' +
        Math.round(mSol) + ' m de perímetro; el resto mira al oriente o queda a la sombra.'
      : '') + '</p>';
      })() +
      (function () {
      var q = (o.loteAnalisis !== undefined ? o.loteAnalisis : loteA) || {};
      var ix = q.indices || (q.queCabe && q.queCabe.indices) || null;
      return ix && (ix.ocupacion || ix.construccion)
      ? '<p class="nota">Con los índices aplicados' +
        (ix.ocupacion ? ' —ocupación ' + conComa(ix.ocupacion) : '') +
        (ix.construccion ? ', construcción ' + conComa(ix.construccion) : '') +
        (ix.ocupacion || ix.construccion ? '—' : '') +
        ', lo que cabe está en la caja de al lado. Los lados del plano llevan su medida y el ' +
        'color de cuánto sol de la tarde reciben, del rojo al azul.</p>'
      : '<p class="nota">Los lados del plano llevan su medida y el color de cuánto sol de la tarde ' +
        'reciben, del rojo al azul.</p>';
      })();
      })(), 'g2') +

      
      /* La lectura de proyecto, en el papel. Va pegada al lote porque es su
      consecuencia: sol, sombra, agua, acceso y viento leídos como
      condiciones y no como cifras. */
      /* Qué cabe. Va con la advertencia adentro y no al pie: una lámina se
      lee colgada y de lejos, y quien la mire tiene que saber de dónde
      salieron esos índices sin agacharse a buscar la letra chica. */
      caja('Qué cabe en el lote',
      (function () {
      var Q = window.URBIS_QUE_CABE;
      if (!Q || !loteA) return '';
      var q = null;
      try { q = Q.calcular(loteA, o.indices || S.indices || Q.porDefecto(), ctxQueCabe(), o.indicesPuestos || S.indicesPuestos); }
      catch (e) { return ''; }
      if (!q) return '';
      return '<div class="kpis">' +
      '<div class="k"><b>' + q.huellaM2.toLocaleString('es-CO') + '</b><small>m² de huella</small></div>' +
      '<div class="k"><b>' + q.construibleM2.toLocaleString('es-CO') + '</b><small>m² construibles</small></div>' +
      '<div class="k"><b>' + q.viviendas + '</b><small>viviendas</small></div>' +
      '</div>' +
      fila('Índices usados', 'ocupación ' + String(q.indices.io).replace('.', ',') +
      ' · construcción ' + String(q.indices.ic).replace('.', ',') + ' · ' +
      q.indices.pisos + ' pisos') +
      fila('Aislamientos', q.indices.aisFrente + ' / ' + q.indices.aisLado + ' / ' +
      q.indices.aisFondo + ' m') +
      fila('Pisos que salen', String(q.pisosQueSalen).replace('.', ',')) +
      fila('Gente', q.personas + ' personas') +
      (q.cruces.length ? '<p class="lee">' + esc(q.cruces[0].texto) + '</p>' : '') +
      /* De dónde salieron los índices, EN EL PAPEL. El bloque de la ficha que
         los pide dice «sale en la lámina» desde que existe, y no salía: la
         lámina llevaba los números y no su procedencia, que es justo lo que
         los vuelve citables. Un índice sin fuente en una entrega es un número
         que hay que volver a buscar. */
      (function () {
      var f = (o.indicesFuente !== undefined ? o.indicesFuente : S.indicesFuente) || {};
      if (!f.documento && !f.fecha && !f.tratamiento) {
      return '<p class="nota">Estos índices se escribieron a mano y <b>nadie anotó de dónde ' +
      'salieron</b>: no se pueden citar sin volver a buscar la fuente.</p>';
      }
      return '<p class="lee">Según <b>' + esc(f.documento || 'documento sin anotar') + '</b>' +
      (f.fecha ? ', de ' + esc(f.fecha) : '') +
      (f.tratamiento ? ' · tratamiento <b>' + esc(f.tratamiento) + '</b>' : '') + '.</p>';
      })() +
      '<p class="nota">Los índices los puso quien hizo la lámina y salen del POT: URBIS no ' +
      'los conoce ni los verifica. El área después de aislamientos es aproximada.</p>';
      })(), 'g3') +
      
      caja('Qué le pide el sitio al proyecto',
      (function () {
      var lista = (function () { try { return determinantesDelLote(st); } catch (e) { return []; } })();
      if (!lista.length) return '';
      var quitar = function (t) { return String(t).replace(/<[^>]+>/g, ''); };
      return '<div class="deter">' +
      lista.slice(0, extras >= 5 ? 4 : 6).map(function (d) {
      return '<div class="de"><b>' + esc(quitar(d.titulo)) + '</b>' +
      '<span>' + esc(quitar(d.dice)) + '</span></div>';
      }).join('') +
      '</div>' +
      '<p class="nota">Determinantes, no propuestas: ninguna dice qué construir. Cada una ' +
      'sale de una medición de esta lámina.</p>';
      })(), 'g3') +
      
      caja('Qué hay, por categoría',
      (function () {
      var filas = Object.keys(st.porGrupo || {})
      .map(function (g) { return { id: g, n: st.porGrupo[g] || 0 }; })
      .filter(function (x) { return x.n > 0 && x.id !== 'otro'; })
      .sort(function (a, b) { return b.n - a.n; });
      if (!filas.length) return '';
      /* La dona que la ficha dibuja con Chart.js, acá a mano —«faltó el
         gráfico de usos en el PDF»— y las barras con el color de cada
         categoría. La leyenda de la dona es además la TABLA DE CONVENCIONES
         de los mapas de usos: son exactamente los colores de los puntos. */
      var colorDe = function (x) { return COL[x.id] || '#94a3b8'; };
      var nombreDe = function (x) { return sinEmoji(nombreGrupo(x.id)); };
      return dona(filas, colorDe, nombreDe) +
      '<p class="lee-min">Convenciones de los mapas de usos: cada punto del plano lleva el ' +
      'color de su categoría.</p>' +
      barras(filas.slice(0, 8), nombreDe, function (x) { return x.n; },
      function (x) { return x.n; }, colorDe);
      })(), 'g3') +

      /* ── Qué manda en el sector ───────────────────────────────────────
         CUÁNTOS puntos hay de cada categoría —la caja de arriba— y QUÉ USO
         pesa más no son lo mismo: quince locales de comercio son quince
         puntos y una manzana de vivienda es uno, y sin embargo el sector es
         residencial. El reparto por peso salía en la ficha y en el informe
         en hojas, y en el pliego no: quien defendía la lámina no tenía de
         dónde leer «acá manda la vivienda».

         La mezcla se mudó acá desde la caja de categorías. Se calcula sobre
         ESTOS pesos, no sobre aquellos conteos, y tenerla debajo del reparto
         del que sale es lo que la hace comprobable de un vistazo. */
      caja('Qué manda en el sector',
      (function () {
      var up = st.usoPredominante;
      if (!up) return '';
      var filas = Object.keys(up)
      .map(function (k) { return { id: k, n: up[k] || 0 }; })
      .filter(function (x) { return x.n > 0; })
      .sort(function (a, b) { return b.n - a.n; });
      if (!filas.length) return '';
      var top = filas[0], m = st.mezcla;
      return '<p class="lee">Predomina <b>' +
      esc(sinEmoji(NOMBRE_USO[top.id] || top.id)) + '</b> con el ' + top.n +
      '% del peso de los usos.</p>' +
      barras(filas, function (x) { return sinEmoji(NOMBRE_USO[x.id] || x.id); },
      function (x) { return x.n + '%'; }, function (x) { return x.n; },
      function (x) { return COLOR_USO[x.id] || '#0A6F9E'; }) +
      (m && m.usos
      ? fila('Mezcla de usos', String(m.indice).replace('.', ',') + ' · ' + esc(m.nivel)) +
      '<p class="nota">0 = un solo uso manda · 1 = los siete repartidos por igual. Acá da ' +
      String(m.indice).replace('.', ',') + ' con ' + m.usos + ' de ' + m.maximo + ' usos ' +
      'presentes. Se mide sobre lo mapeado, y en OpenStreetMap la vivienda está peor ' +
      'registrada que el comercio.</p>'
      : '<p class="nota">El porcentaje pesa lo que representa cada cosa: una zona ' +
      'residencial completa pesa más que un solo local.</p>');
      })(), 'g3') +

      /* ── Dónde está la calle comercial ────────────────────────────────
         Los núcleos: no cuántos comercios hay sino dónde se juntan, que es
         lo que hace que una calle tenga vida. Es de las que deciden por qué
         lado se abre el proyecto, y no llegaba a ningún documento. */
      caja('Dónde está la calle comercial',
      (function () {
      var ns = st.nucleos || [];
      if (!ns.length) return '';
      return ns.slice(0, 5).map(function (x, i) {
      return '<div class="hit"><i>' + (i + 1) + '</i><span>' +
      x.n + ' locales · ' + esc(x.rubroDominante || 'comercio') +
      ((x.nombres || []).length ? '<br>' + esc(x.nombres.join(', ')) : '') +
      '</span><u>' + x.distM + ' m</u></div>';
      }).join('') +
      '<p class="nota">Grupos de comercios que están juntos, con la distancia al centro ' +
      'del área. Es dónde se juntan, no cuántos hay.</p>';
      })(), 'g3') +

      /* ── Cómo cambia al alejarse ──────────────────────────────────────
         Un total no dice si las cosas están pegadas o desperdigadas; los
         anillos sí. Cierra con el rumbo que concentra —la otra mitad de la
         misma pregunta: a qué distancia está lo que hay, y hacia qué lado—.
         Las dos salían en la ficha y en ninguna hoja imprimible. */
      caja('Cómo cambia al alejarse',
      (function () {
      var an = (st.anillos || []).filter(function (a) { return a.n > 0; });
      var z = zonasL;
      var conc = (z && z.concentracion)
      ? '<p class="lee">La mitad <b>' + esc(z.concentracion.rumbo.nombre) + '</b> reúne <b>' +
      z.concentracion.n + ' de ' + z.total + '</b> (' + z.concentracion.pct + '%). Es el lado ' +
      'más activo según los datos.</p>'
      : '';
      if (an.length < 2) return conc;
      var primero = an[0];
      return barras(an, function (a) { return a.etiqueta; },
      function (a) { return a.n; }, function (a) { return a.n; }) +
      (primero.n / Math.max(1, st.total) >= 0.5
      ? '<p class="lee">Más de la mitad de lo registrado está <b>' + esc(primero.etiqueta) +
      '</b>: es un sector concentrado, se recorre a pie sin problema.</p>'
      : '') +
      conc +
      '<p class="nota">Distancia medida desde el ' +
      (esPol ? 'centro del área dibujada' : 'centro del círculo') +
      '. Sirve para repartir el trabajo: un grupo por anillo.</p>';
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
      var TONO = { '1': '#BFE3F7', '2': '#5BB4E5', '3': '#0A6F9E', '+3': '#0B3A57' };
      return barras(a.niveles, function (x) { return x.etiqueta; },
      function (x) { return x.pct + '%'; }, function (x) { return x.pct; },
      function (x) { return TONO[String(x.id || x.nivel || x.k || '')] ||
        (/más|\+/i.test(x.etiqueta) ? TONO['+3'] : (TONO[(x.etiqueta || '').charAt(0)] || '#0A6F9E')); }) +
      '<p class="nota">' + a.conDato + ' de ' + a.edificios + ' edificios traen la altura ' +
      'registrada (' + a.cobertura + '%). El más alto: ' + a.maximo + ' pisos.</p>';
      })(), 'g3') +
      
      caja('Llenos y vacíos',
      (function () {
      if (!trz || !trz.llenos) return '';
      var ll = trz.llenos, vi = trz.vias || {}, mo = trz.morfologia || {};
      var tr = dib('trama', ll.pctLleno);
      /* La trama va AL LADO de las cifras, no encima: sola en una caja
      ancha queda flotando en medio del papel como si se hubiera
      caído ahí. Pegada a los porcentajes, es la misma cifra dibujada
      y se lee de corrido. */
      if (trazadoSinDatos(trz)) return '<p class="lee">' + esc(TRAZADO_VACIO) + '</p>';
      return '<div class="dib-par">' +
      (tr ? '<div class="dib dib-chico">' + tr + '</div>' : '') +
      '<div class="kpis">' +
      '<div class="k"><b>' + ll.pctLleno + '%</b><small>construido</small></div>' +
      '<div class="k"><b>' + ll.pctVacio + '%</b><small>libre</small></div>' +
      '<div class="k"><b>' + (mo.intersecciones || 0) + '</b><small>intersecciones</small></div>' +
      '</div>' +
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
      /* Con un lote marcado, los cortes que van al papel son los que
      pasan POR ÉL: cruzan el sector igual que los del centro, pero
      además dicen dónde cae el lote en la ladera, que es lo que se
      defiende en la entrega. Sin lote, los del centro. */
      /* Los DOS cortes, siempre. Se recortaba a uno cuando la hoja iba llena
      —el segundo era lo que se sacrificaba para que la caja no se
      cortara—, y eso se decidió cuando la hoja no sabía encogerse sola.
      Ahora sabe: lo que cede es el tamaño de composición, no un corte
      del terreno, que es de lo que se defiende un proyecto en ladera. */
      (terLote && terLote.cortes.length
      ? terLote.cortes.slice(0, 2).map(function (c) {
      var d = dib('corteTopografico', c);
      return d ? '<div class="corte">' + d + '</div>' : '';
      }).join('') +
      (terLote.baja
      ? '<p class="nota">Bajo el lote el terreno baja hacia el ' + esc(terLote.baja.nombre) +
      ', con ' + (terLote.pendientePct != null ? terLote.pendientePct + '% de pendiente' :
      'pendiente suave') + '. La banda amarilla es el lote.</p>'
      : '<p class="nota">La banda amarilla es el lote.</p>')
      : (ter.perfiles || []).slice(0, 2)
      .map(perfilDibujado).join('')) +
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
      /* La rosa de los vientos. La caja del clima quedaba con medio metro de
         papel vacío y el dato estaba: el motor manda el reparto del viento
         por los ocho rumbos y solo se imprimía el dominante. Un proyecto
         orienta los patios y las aberturas con esto. */
      (function () {
      var rosa = (vi.rosa || []).filter(function (r2) { return r2 && r2.pct != null; });
      var dr = rosa.length === 8
      ? dib('rosaDeRumbos', rosa.map(function (r2) { return { n: r2.pct }; }),
      { etiqueta: 'De dónde viene el viento, en porcentaje del tiempo por cada rumbo' })
      : '';
      return dr
      ? '<div class="dib-par"><div class="dib dib-rosa">' + dr + '</div><div>' +
        (vi.dominante ? fila('El viento viene del', esc(vi.dominante.rumbo) + ' (' + vi.dominante.pct + '%)') : '') +
        (vi.mediaKmh != null ? fila('Viento medio', conComa(vi.mediaKmh) + ' km/h') : '') +
        '<p class="nota">La rosa dice de dónde viene el viento y qué parte del tiempo: ' +
        'el pétalo largo es el rumbo que ventila. Por ahí se abren los patios.</p></div></div>'
      : (vi.dominante ? fila('El viento viene del', esc(vi.dominante.rumbo) + ' (' + vi.dominante.pct + '%)') : '');
      })() +
      (cli.lectura ? '<p class="lee">' + esc(cli.lectura) + '</p>' : '');
      })(), 'g3') +
      
      caja('Asoleamiento',
      (function () {
      if (!sol || !sol.salida) return '';
      var cen = ((solAnio && solAnio.cenitales) || []).map(function (x) {
      return x.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
      });
      var carta = dib('cartaSolar', { lat: Number(meta.lat), lng: Number(meta.lng) });
      return (carta ? '<div class="dib">' + carta + '</div>' : '') +
      '<div class="kpis">' +
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
      
      /* La amenaza sísmica. Va con la curva dibujada: cinco cifras sueltas no
      dicen nada, y dibujadas dicen cuánto más fuerte es el sismo que se
      acepta cuando se acepta que pase más rara vez. */
      caja('La amenaza sísmica',
      (function () {
      var am = o.amenaza !== undefined ? o.amenaza : S.amenaza;
      if (!am) return '';
      var d3 = dib('curvaDeAmenaza', am.curva);
      return '<div class="kpis">' +
      '<div class="k"><b>' + esc(am.nivel) + '</b><small>amenaza sísmica</small></div>' +
      (am.aa != null ? '<div class="k"><b>' + String(am.aa).replace('.', ',') +
      '</b><small>Aa</small></div>' : '') +
      (am.av != null ? '<div class="k"><b>' + String(am.av).replace('.', ',') +
      '</b><small>Av</small></div>' : '') +
      '</div>' +
      (d3 ? '<div class="dib">' + d3 + '</div>' : '') +
      (am.diseno
      ? fila('Aceleración de diseño (475 años)', am.diseno.gal + ' gal · ' +
      String(am.diseno.g).replace('.', ',') + ' g')
      : '') +
      (am.intensidad
      ? fila('Cómo se siente un sismo acá',
      esc(am.intensidad.percepcion) + ', daño ' + esc(am.intensidad.potencial.toLowerCase()))
      : '') +
      (am.pide ? '<p class="lee">' + esc(am.pide) + '</p>' : '') +
      (am.masa
      ? fila('Municipio en amenaza alta o muy alta por deslizamiento',
      String(am.masa.altaOMasPct).replace('.', ',') + '% de sus ' +
      Math.round(am.masa.areaKm2).toLocaleString('es-CO') + ' km²')
      : '') +
      (am.discrepan && am.discrepan.length
      ? '<p class="lee">Las dos capas del SGC no coinciden en ' +
      esc(am.discrepan.map(function (d) { return d.cual; }).join(' ni en ')) +
      '; acá va el de la capa de zonas NSR-10. Verificalo contra la tabla A.2.3-2.</p>'
      : '') +
      '<p class="nota">Valor del municipio de ' + esc(am.municipio) + ', no del lote: la ' +
      'NSR-10 da Aa y Av por municipio. Si hay microzonificación sísmica, manda esa. ' +
      (am.masa ? 'El deslizamiento es el reparto del municipio entero a escala ' +
      esc(am.masa.escala) + ': un predio no se alcanza a leer ahí. ' : '') +
      esc(am.fuente) + '.</p>';
      })(), 'g3') +
      
      /* ── La inundación ────────────────────────────────────────────────
         Estaba medida, salía en la ficha y en el informe en hojas, y NO
         tenía caja en el pliego. En Cúcuta, con el Pamplonita y el Zulia,
         eso es de lo primero que pregunta un jurado y era lo único del
         análisis de riesgo que no llegaba al papel.

         Se dice entero, incluido cuando no se sabe: «sin modelar» no se
         pinta como buena noticia, porque en una lámina una ausencia con cara
         de todo-en-orden es peor que un renglón vacío. */
      caja('La inundación',
      (function () {
      var inu = o.inundacion !== undefined ? o.inundacion : S.inundacion;
      if (!inu || inu.sinDato) return '';
      if (!inu.cobertura) {
      return '<div class="kpis">' +
      '<div class="k"><b style="color:' + esc(inu.color) + '">Sin modelar</b>' +
      '<small>amenaza de inundación</small></div>' +
      '</div>' +
      '<p class="lee">' + esc(inu.que) + ' <b>No quiere decir que no se inunde</b>: quiere ' +
      'decir que nadie lo midió con este mapa.</p>' +
      '<p class="nota">' + esc(inu.salvedad) + ' ' + esc(inu.fuente) + '.</p>';
      }
      var dentro = inu.trPeor != null;
      return '<div class="kpis">' +
      '<div class="k"><b style="color:' + esc(inu.color) + '">' + esc(inu.nombre) + '</b>' +
      '<small>amenaza de inundación</small></div>' +
      (dentro ? '<div class="k"><b>' + inu.trPeor + '</b><small>años de retorno</small></div>' : '') +
      '</div>' +
      (dentro
      ? '<p class="lee">El lote cae en la mancha de <b>' + inu.trPeor + ' años</b>: se inunda ' +
      esc(inu.frecuencia) + '. ' + esc(inu.que) + '</p>' +
      (inu.dentroDe.length > 1
      ? inu.dentroDe.map(function (tr) {
      return fila('Mancha de ' + tr + ' años', 'lo toca'); }).join('')
      : '') +
      (inu.creciente && inu.creciente.length
      ? '<p class="lee">Además está en zona de <b>creciente súbita</b>: no sube despacio, ' +
      'llega de golpe. Cambia el acceso, la evacuación y el nivel del primer piso.</p>'
      : '') +
      (inu.enLaDeCien
      ? fila('En la mancha de 100 años', 'la que usa el POT para delimitar') : '')
      : '<p class="lee">El sitio está modelado y el lote queda <b>fuera</b> de las manchas.</p>') +
      '<p class="nota">' + esc(inu.salvedad) + ' Escala ' + esc(inu.escala) + '. ' +
      esc(inu.fuente) + '.</p>';
      })(), 'g3') +

      /* ── Cómo se llega ────────────────────────────────────────────────
         El pliego tenía el perfil de la calle, lo que se alcanza a pie, hasta
         dónde se camina y el mapa de jerarquía vial; le faltaban las cifras
         del corredor, que son las que contestan «cómo llega hasta acá quien
         no vive acá». Estaban calculadas desde siempre y solo salían en el
         informe en hojas.

         Y con ellas el FLUJO, que es la parte que no salía en ningún lado: si
         por esta calle pasa más gente a pie o más carros, en qué franja del
         día está viva y si sigue viva de noche. Es lo que decide el formato
         de un proyecto —a qué se abre, dónde entra, a qué hora sirve— y
         estaba dentro de la respuesta del servidor sin que nadie la leyera. */
      caja('Cómo se llega',
      (function () {
      var mv = st.movilidad;
      if (!mv) return '';
      var fl = mv.flujo || null;
      var FR = [['manana', 'Mañana'], ['mediodia', 'Mediodía'], ['tarde', 'Tarde'], ['noche', 'Noche']];
      return '<div class="kpis">' +
      '<div class="k"><b>' + (mv.scoreAcceso || 0) + '</b><small>facilidad para llegar /100</small></div>' +
      '<div class="k"><b>' + (mv.exposicion || 0) + '</b><small>exposición al tránsito /100</small></div>' +
      (fl && fl.dominante
      ? '<div class="k"><b>' + esc(fl.dominante === 'ninguno' ? 'poco' : fl.dominante) +
      '</b><small>qué predomina</small></div>'
      : '') +
      '</div>' +
      (mv.viaPrincipal
      ? fila('Vía principal', esc(mv.viaPrincipal.nombre || 'sin nombre') +
      (mv.viaPrincipal.jerarquia ? ' · ' + esc(mv.viaPrincipal.jerarquia) : '') +
      (mv.viaPrincipal.distM != null ? ' · a ' + Math.round(mv.viaPrincipal.distM) + ' m' : ''))
      : fila('Vías arterias', 'ninguna con nombre registrada')) +
      fila('Corredores arteriales', mv.nViasArterias || 0) +
      fila('Paradas de transporte', mv.paradasBus || 0) +
      fila('Tramos de ciclorruta', mv.ciclorrutas || 0) +
      (fl
      ? fila('Flujo a pie contra en carro', (fl.peatonal || 0) + ' / ' + (fl.vehicular || 0)) +
      (fl.franjas
      ? barras(FR.filter(function (f) { return fl.franjas[f[0]] != null; }),
      function (f) { return f[1]; },
      function (f) { return fl.franjas[f[0]] + '%'; },
      function (f) { return fl.franjas[f[0]]; })
      : '') +
      '<p class="lee">' +
      (fl.dominante === 'peatonal' ? 'Manda el peatón: el proyecto se abre a la calle.'
      : fl.dominante === 'vehicular' ? 'Manda el carro: hay que resolver el acceso y protegerse del ruido.'
      : fl.dominante === 'ninguno' ? 'No pasa casi nadie, ni a pie ni en carro: el proyecto tiene que traer su propia gente.'
      : 'Peatón y carro parejos: hay que atender bien los dos accesos.') +
      (fl.franjaFuerte ? ' La calle está más viva en ' + esc(fl.franjaFuerte) + '.' : '') +
      (fl.vidaNocturna ? ' Y sigue viva de noche.' : '') +
      '</p>'
      : '') +
      /* Por dónde pasa el transporte, también en el papel. Nació en la ficha
         y se quedó ahí una versión: es una medición nueva, y la regla de la
         casa es que entra en los dos documentos o en ninguno. Un paradero a
         seiscientos metros y uno en la esquina cambian el proyecto, y eso hay
         que poder defenderlo colgado en la pared. */
      (function () {
      var pd = porDondePasa(res);
      if (!pd || !pd.ejes.length) return '';
      return '<p class="lee">Por dónde pasa el transporte</p>' +
      pd.ejes.slice(0, 5).map(function (e) {
      return fila(e.nombre, e.n + ' parada' + (e.n === 1 ? '' : 's'));
      }).join('') +
      '<p class="nota">Cada parada se asignó a la vía con nombre más cercana, hasta 60 m: un ' +
      'paradero se pone en el andén, y más lejos de eso ya es otra calle.' +
      (pd.sueltas ? ' ' + pd.sueltas + ' no ' + (pd.sueltas === 1 ? 'cae' : 'caen') +
      ' cerca de ninguna vía con nombre.' : '') + '</p>';
      })() +
      '<p class="nota">La facilidad para llegar y la exposición al tránsito son índices de 0 a ' +
      '100 armados con la jerarquía de las vías cercanas y su distancia. El flujo es una ' +
      'estimación a partir de los usos y de los corredores, no un aforo.</p>';
      })(), 'g3') +

      /* ── Quién vive acá ───────────────────────────────────────────────
         El censo por edades y sexo estaba calculado, salía en la ficha y no
         llegaba al papel. Se me pasó en el inventario de v734 y lo encontré
         al buscar qué más faltaba: es de las que cambian el programa de un
         proyecto —un sector que envejece no pide lo mismo que uno de familias
         jóvenes— y no se podía defender en el pliego. */
      caja('Quién vive acá',
      (function () {
      var d = st.demografia;
      if (!d || !d.totalSexo) return '';
      var tramos = (d.tramos || []).filter(function (t) { return (t.personas || 0) > 0; });
      /* CUÁNTA gente, antes de cómo está repartida. El pliego llevaba el
         número suelto en «El sitio» y ahí no se puede citar: sin el año del
         censo al lado, un total de habitantes no se sabe si es un conteo o un
         pronóstico, y las dos cosas se defienden distinto. Acá van los tres
         momentos —contado, proyectado a hoy, pronosticado— con su año, y el
         pronóstico va rotulado como tal. */
      var mil = function (x) { return Number(x).toLocaleString('es-CO'); };
      var pobl =
      (st.poblacionCenso
      ? fila('Contadas por el censo de ' + (st.censoAnio || '—'), mil(st.poblacionCenso))
      : '') +
      (st.poblacionProyectada
      ? fila('Proyectadas a ' + (st.anioProyeccion || 'hoy'), mil(st.poblacionProyectada))
      : (st.poblacionEstimada
      ? fila('Estimadas por densidad', mil(st.poblacionEstimada)) : '')) +
      (st.crecimientoPct != null
      ? fila('Crecimiento desde el censo', '+' + conComa(st.crecimientoPct) + '%') : '') +
      (st.tasaAnualDane != null
      ? fila('Tasa anual del DANE', conComa(Number((st.tasaAnualDane * 100).toFixed(2))) + '%') : '') +
      (st.estrato && st.estrato.predominante
      ? fila('Estrato predominante', esc(String(st.estrato.predominante)) +
      (st.estrato.minimo !== st.estrato.maximo
      ? ' (de ' + st.estrato.minimo + ' a ' + st.estrato.maximo + ')' : ''))
      : '');
      return pobl +
      (pobl && st.poblacionCenso
      ? '<p class="nota">El conteo es censo; lo que sigue es proyección con la tasa del ' +
      'DANE. Un pronóstico no es un dato contado.</p>' : '') +
      /* La misma estética que la ficha: una sola barra partida para mujeres y
         hombres —que es como se compara mejor una proporción de dos— y las
         edades en barras con el tramo dominante más oscuro. Salían como
         cifras sueltas y barras azules; se pidió «el censo con sus gráficos y
         estética». */
      '<div class="sexo"><i class="sexo-m" style="width:' + (d.pctMujeres || 0) + '%"></i>' +
      '<i class="sexo-h" style="width:' + (d.pctHombres || 0) + '%"></i></div>' +
      '<div class="kpis">' +
      '<div class="k k-m"><b>' + conComa(d.pctMujeres || 0) + '%</b><small>mujeres · ' +
      Number(d.mujeres || 0).toLocaleString('es-CO') + '</small></div>' +
      '<div class="k k-h"><b>' + conComa(d.pctHombres || 0) + '%</b><small>hombres · ' +
      Number(d.hombres || 0).toLocaleString('es-CO') + '</small></div>' +
      (d.envejecimiento != null
      ? '<div class="k"><b>' + conComa(d.envejecimiento) + '</b><small>índice de envejecimiento</small></div>'
      : '') +
      '</div>' +
      (tramos.length
      ? barras(tramos, function (t) { return t.etiqueta; },
      function (t) { return Number(t.personas).toLocaleString('es-CO') + ' · ' + t.pct + '%'; },
      function (t) { return t.personas; },
      function (t) { return t.id === d.tramoDominante ? '#0B3A57' : '#5BB4E5'; })
      : '') +
      (d.tramoDominanteEtq
      ? '<p class="lee">El grupo más numeroso es <b>' + esc(d.tramoDominanteEtq) + '</b>. ' +
      'Es lo que decide el programa: no pide lo mismo un sector de familias jóvenes que uno ' +
      'que envejece.</p>'
      : '') +
      '<p class="nota">Censo del DANE de 2018 por manzana, proyectado al año en curso. Es el ' +
      'reparto de quien vive acá, no de quien pasa.</p>';
      })(), 'g3') +

      /* ── Cómo cambió el sitio ─────────────────────────────────────────
         La serie larga, en el papel: las estampas de cada año en fila, las
         cifras y la conclusión. Es de las pocas cajas del pliego que habla
         del TIEMPO y no del estado de hoy, y por eso vale lo que ocupa: un
         jurado que ve que el sector perdió catorce puntos de vegetación en
         cuarenta años entiende de qué va el proyecto antes de que se lo
         expliquen. */
      caja('Cómo cambió el sitio',
      (function () {
      var EV = window.URBIS_EVOLUCION;
      var ev = (o.evo !== undefined ? o.evo : S.evo) || {};
      var L = ev.landsat, W = ev.wayback;
      if (!EV) return '';
      /* Las estampas no viajan con la ficha archivada —quince PNG son megas y
         el almacenamiento del teléfono son cinco en total— así que una lámina
         reimpresa de un sector viejo trae las cifras y no las fotos. Se
         comprueba por imagen y no por paso: un `<img src="undefined">` es un
         recuadro roto en mitad del pliego. */
      var conFoto = function (ps) {
        return (ps || []).filter(function (p) { return p.ok && p.imagen; });
      };
      var tira = function (pasos, clase, pieDe) {
        if (!pasos.length) return '';
        return '<div class="evo-tira' + (clase ? ' ' + clase : '') + '">' +
        pasos.map(function (p) {
          return '<figure class="evo-p' + (p.fiable === false || p.sustituto ? ' evo-dudoso' : '') + '">' +
          '<img src="' + p.imagen + '" alt="El sector en ' + (p.anioReal || p.anio) + '">' +
          '<figcaption>' + (p.anioReal || p.anio) + '</figcaption>' +
          '<small>' + esc(pieDe(p)) + '</small></figure>';
        }).join('') + '</div>';
      };

      /* ── Las fotos, primero ──────────────────────────────────────────
         Se pidió que el historial saliera «diagramado en el PDF» y hasta
         ahora no salía: la caja solo sabía dibujar la serie de Landsat, que
         es la que mide, y la de alta resolución —la que se mira, y la única
         que de verdad funciona hoy— no llegaba al papel ni en el pliego ni en
         el informe. Van arriba porque son las que se leen de lejos: un jurado
         ve tres fotos del mismo sitio en tres décadas y entiende el proyecto
         antes de que se lo expliquen. */
      var fotos = conFoto(W && W.pasos);
      var medidos = conFoto(L && L.pasos).filter(function (p) { return p.medida; });
      var cifras = (L && L.pasos || []).filter(function (p) { return p.ok && p.medida; });
      if (!fotos.length && !cifras.length) return '';
      var t = L && L.tendencia;
      var conc = (L && cifras.length >= 2) ? (EV.conclusion(L) || []) : [];

      return (fotos.length
      ? '<p class="lee">Las fotos, de ' + (fotos[0].anioReal || fotos[0].anio) + ' a ' +
        (fotos[fotos.length - 1].anioReal || fotos[fotos.length - 1].anio) + '</p>' +
        tira(fotos, 'evo-alta', function (p) { return p.fecha || ''; })
      : '') +
      (medidos.length
      ? '<p class="lee">Medido desde ' + (medidos[0].anio) + '</p>' +
        tira(medidos, '', function (p) { return conComa(p.medida.verde) + '% verde'; })
      : '') +
      (t
      ? '<div class="kpis">' +
        '<div class="k"><b>' + conComa(t.verdeDesde) + '%</b><small>verde en ' + t.desde + '</small></div>' +
        '<div class="k"><b>' + conComa(t.verdeHasta) + '%</b><small>verde en ' + t.hasta + '</small></div>' +
        '<div class="k"><b>' + (t.verde > 0 ? '+' : '') + conComa(t.verde) +
        '</b><small>puntos de diferencia</small></div>' +
        '</div>'
      : '') +
      conc.map(function (c) {
      return '<p class="lee">' + esc(c.texto) + ' <b>' + esc(c.dato) + '</b></p>';
      }).join('') +
      '<p class="nota">' +
      (fotos.length
      ? 'Debajo de cada foto va la <b>fecha de la entrega</b> de la que salió, no el año que se ' +
        'pidió: el proveedor publica por entregas fechadas. Las fotos son para MIRAR —qué se ' +
        'construyó, qué se taló, por dónde iba el agua— y por eso no llevan porcentaje. '
      : '') +
      (cifras.length
      ? 'Los porcentajes salen de Landsat a 30 m por píxel: la estampa se ve a cuadros y el lote ' +
        'son unos pocos píxeles, pero lo que se mide es una proporción sobre miles y eso sí ' +
        'aguanta. Con <b>NDVI</b>, el índice de la banda infrarroja, que significa lo mismo en ' +
        (t ? t.desde : 1984) + ' y hoy; el clasificador de colores de la foto de hoy mediría la ' +
        'diferencia entre dos cámaras. Los años medio tapados por nubes se marcan y no entran en ' +
        'la conclusión.'
      : '') +
      '</p>';
      })(), 'g3') +

      /* ── La infraestructura de servicios ──────────────────────────────
         Lo que hay registrado y a qué distancia. NO es cobertura de servicios
         públicos —eso es censo del DANE y no hay de dónde bajarlo—, y la caja
         lo dice en vez de dejar que se lea como si lo fuera. */
      caja('Infraestructura de servicios',
      (function () {
      var inf = o.infra !== undefined ? o.infra
              : (function () { try { return infraDeServicios(res); } catch (e) { return null; } })();
      if (!inf) return '';
      return '<div class="kpis">' +
      '<div class="k"><b>' + inf.n + '</b><small>objetos registrados</small></div>' +
      (inf.masCerca && inf.masCerca.distM != null
      ? '<div class="k"><b>' + inf.masCerca.distM + '</b><small>m al más cercano</small></div>'
      : '') +
      '</div>' +
      inf.lista.slice(0, 6).map(function (x) {
      return fila(x.nombre || (x.etq ? x.etq.charAt(0).toUpperCase() + x.etq.slice(1) : 'Sin nombre'),
      (x.etq && x.nombre ? esc(x.etq) + ' · ' : '') +
      (x.distM != null ? 'a ' + x.distM + ' m' : 'sin ubicar'));
      }).join('') +
      '<p class="nota">Esto NO es la cobertura de servicios públicos: es lo que ' +
      'OpenStreetMap tiene registrado como infraestructura —tanques, subestaciones, plantas, ' +
      'rellenos— y a qué distancia queda. Si el barrio tiene agua, alcantarillado y energía, y ' +
      'cuántas horas al día, eso lo levanta el censo del DANE por manzana y no hay servicio que ' +
      'lo sirva a una aplicación: hay que pedirlo, o preguntarlo en la calle.</p>';
      })(), 'g3') +

      /* ── El ruido del tránsito ────────────────────────────────────────
         Modelado, no medido, y por eso lo dice en la caja. Nadie publica un
         mapa de ruido de Cúcuta; lo que sí está medido son las vías, su
         jerarquía y su distancia, y con eso el ruido del tránsito se estima
         razonablemente. Sirve para decidir a qué lado NO van los dormitorios.
         Ver el modelo entero, con lo que no sabe, en `ruidoDelLote`. */
      caja('El ruido del tránsito',
      (function () {
      var ru = o.ruido !== undefined ? o.ruido
             : (function () { try { return ruidoDelLote(); } catch (e) { return null; } })();
      if (!ru) return '';
      return '<div class="kpis">' +
      '<div class="k"><b style="color:' + esc(ru.color) + '">' + conComa(ru.dB) +
      '</b><small>dB(A) estimados</small></div>' +
      '<div class="k"><b style="color:' + esc(ru.color) + '">' + esc(ru.etq) +
      '</b><small>nivel</small></div>' +
      '</div>' +
      ru.principales.map(function (a) {
      return '<div class="f"><span><i class="sol-punto" style="background:' + esc(a.color) + '"></i>' +
        esc(a.nombre || a.etq) + '</span><b>' + conComa(a.dB) + ' dB · a ' + a.distM + ' m</b></div>';
      }).join('') +
      '<p class="lee">' +
      (ru.pasaElLimite
      ? 'Por encima de los <b>65 dB(A)</b> que la Resolución 627 de 2006 pone como límite de día ' +
        'para vivienda. La fachada que da a la vía no es la buena para dormir: por ahí van los ' +
        'servicios, y las ventanas de las alcobas al otro lado o con doble vidrio.'
      : 'Por debajo de los 65 dB(A) del límite diurno para vivienda. Es una ventaja del sitio y ' +
        'vale decirlo, sobre todo si el sector alrededor no la tiene.') +
      '</p>' +
      '<p class="nota">ESTIMADO, no medido: sale de la jerarquía de las ' + ru.cuantas + ' vías ' +
      'cercanas y de su distancia, con caída de 3 dB al doblar la distancia y suma de energías. ' +
      'No sabe cuánto tránsito pasa de verdad, ni si hay semáforo, pendiente, tapia o fachada que ' +
      'rebote, ni cuenta las motos aparte. Para un dato defendible hace falta un sonómetro y tres ' +
      'mediciones a horas distintas.</p>';
      })(), 'g3') +

      /* ── Verde y agua ─────────────────────────────────────────────────
         Lo mismo: contado desde siempre y solo en el informe en hojas. En una
         lámina de análisis ambiental es de las primeras cosas que se miran, y
         es distinto de la cobertura leída de la foto: esto son los parques,
         los cuerpos de agua y las manchas de verde REGISTRADOS —tienen nombre
         y dueño— y aquello es cuánto verde hay, lo haya registrado alguien o
         no. Juntas dicen si el verde del sector es público o es de patio. */
      caja('Verde y agua',
      (function () {
      var am = st.ambiente;
      if (!am) return '';
      var nada = !am.parques && !am.cuerposAgua && !am.verdeNatural;
      return '<div class="kpis">' +
      '<div class="k"><b>' + (am.parques || 0) + '</b><small>parques</small></div>' +
      '<div class="k"><b>' + (am.cuerposAgua || 0) + '</b><small>cuerpos de agua</small></div>' +
      '<div class="k"><b>' + (am.verdeNatural || 0) + '</b><small>manchas de verde</small></div>' +
      '</div>' +
      (am.scoreVerde != null ? fila('Presencia de verde', am.scoreVerde + ' / 100') : '') +
      (nada
      ? '<p class="lee">No hay parques, ni agua, ni verde registrados en el área. Puede que ' +
      'no los haya o que nadie los haya mapeado: la foto satelital lo desempata.</p>'
      : '') +
      '<p class="nota">Contado sobre lo que OpenStreetMap tiene registrado con nombre. La ' +
      'caja de cobertura del suelo dice cuánto verde hay de verdad, lo haya registrado ' +
      'alguien o no.</p>';
      })(), 'g3') +

      /* ── Cobertura del suelo ──────────────────────────────────────────
         Lo único de la lámina que no depende de que alguien haya mapeado
         nada: se lee de la foto satelital, píxel por píxel. La caja de
         «Verde y agua» llevaba desde el principio una nota que mandaba a
         leer ésta —«dice cuánto verde hay de verdad»— y ésta no estaba en el
         pliego: la promesa quedaba sin cumplir en el papel, y el porcentaje
         de vegetación, que es el número que un jurado pide primero cuando se
         habla de ambiente, había que buscarlo en el celular. */
      caja('Cobertura del suelo',
      (function () {
      var c = o.cobertura !== undefined ? o.cobertura : S.cobertura;
      if (!c || !c.clases || !c.clases.length) return '';
      /* Con el raster en la lámina la barra va debajo de él —ver `extra` del
         mapa de cobertura— y esta caja sobra: dos veces la misma medición a
         medio metro una de otra es lo que confundía. Solo sale cuando la
         clasificación existe sin imagen que la acompañe. */
      if (c.overlayImagen && c.overlayLimites &&
          mapasApagados.indexOf('cobertura') === -1) return '';
      var orden = c.clases.slice().sort(function (a, b) { return b.pct - a.pct; })
      .filter(function (x) { return x.pct > 0; });
      if (!orden.length) return '';
      return '<div class="cobb">' + orden.map(function (x) {
      return '<i style="width:' + x.pct + '%;background:' + esc(String(x.color)) + '"></i>';
      }).join('') + '</div>' +
      orden.map(function (x) {
      return fila(x.etq, x.pct + '% · ' + Math.round(x.m2).toLocaleString('es-CO') + ' m²');
      }).join('') +
      '<p class="nota">Medido sobre ' + esc(String(c.malla || '')) + ' píxeles de la foto ' +
      'satelital, a ' + (c.mPorPx || '?') + ' m por píxel.' +
      (c.grueso ? ' A esta escala la lectura es de masas, no de elementos sueltos.' : '') +
      (c.pctAmbiguo > 25 ? ' Un ' + c.pctAmbiguo + '% quedó en tonos cálidos no separables.' : '') +
      ' No depende de que alguien lo haya mapeado.</p>';
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
      
      /* Va pegada a «A distancia de caminar» a propósito: una mide en línea
      recta sobre todo el sector, la otra recorre las calles desde el
      lote. Leídas juntas, la diferencia entre las dos cifras es el
      argumento. */
      caja('Hasta dónde se camina desde el lote',
      (function () {
      if (!cam || !cam.anillos || !cam.anillos.length) return '';
      var mayor = cam.anillos[cam.anillos.length - 1];
      var a = cam.anillos[1] || cam.anillos[0];
      var dif = a ? (a.usosRecta - a.usos) : 0;
      return '<div class="camina">' +
      cam.anillos.map(function (x) {
      var pct = mayor.usos ? Math.round(100 * x.usos / mayor.usos) : 0;
      return '<div class="cm">' +
      '<b>' + x.usos + '</b>' +
      '<span>' + x.minutos + ' minutos</span>' +
      '<i><u style="width:' + pct + '%"></u></i>' +
      '<small>' + x.metros + ' m de recorrido por las calles</small>' +
      '</div>';
      }).join('') +
      '</div>' +
      (a && dif > 0
      ? '<p class="lee">A ' + a.minutos + ' minutos se llega a ' + a.usos +
      ' usos; en línea recta parecían ' + a.usosRecta + '.</p>'
      : a ? '<p class="lee">Acá la línea recta no engañaba: las calles llevan derecho.</p>'
      : '') +
      '<p class="nota">Recorrido real por las calles registradas, a ' +
      (cam.pasoMPorMin || 80) + ' m por minuto; engancha a la calle más cercana, a ' +
      cam.distanciaAlaCalleM + ' m. No sabe si hay andén, dónde cruzar ni si la cuadra ' +
      'sube.</p>';
      })(), 'g3') +
      
      /* La sombra de los vecinos, en planta. Va pegada al lote: las dos
      cajas responden a la misma pregunta —qué se puede poner acá— desde
      los dos lados, el suelo y el sol. */
      caja('La sombra de los vecinos',
      (function () {
      if (!sombrasL || !sombrasL.horas || !sombrasL.horas.length) return '';
      var d2 = dib('planoDeSombras', sombrasL);
      if (!d2) return '';
      return '<div class="dib">' + d2 + '</div>' +
      '<div class="kpis">' +
      sombrasL.horas.map(function (h) {
      return '<div class="k"><b>' + h.pctLote + '%</b><small>en sombra a las ' +
      h.hora + ':00</small></div>';
      }).join('') +
      '</div>' +
      '<p class="nota">' + sombrasL.vecinos + ' edificios a menos de 200 m, a ' +
      sombrasL.alturaPorPiso + ' m por piso' +
      (sombrasL.vecinosSinPisos
      ? '; otros ' + sombrasL.vecinosSinPisos + ' sin pisos registrados no proyectan nada, ' +
      'así que la sombra real es mayor'
      : '') +
      '. Sin árboles ni muros, y con el terreno supuesto plano.</p>';
      })(), 'g3') +
      
      /* ── La cuadra ────────────────────────────────────────────────────
         La escala que faltaba: ni el sector ni el lote, sino el frente al que
         da el proyecto. Ver `laCuadraDelLote` para qué se mide y por qué. */
      caja('La cuadra del lote',
      (function () {
      var cu = o.cuadra !== undefined ? o.cuadra
             : (function () { try { return laCuadraDelLote(); } catch (e) { return null; } })();
      if (!cu) return '';
      return '<div class="kpis">' +
      '<div class="k"><b>' + cu.pctLleno + '%</b><small>del frente con fachada</small></div>' +
      '<div class="k"><b>' + cu.edificios + '</b><small>edificios dan al frente</small></div>' +
      (cu.frenteTipicoM != null
      ? '<div class="k"><b>' + cu.frenteTipicoM + '</b><small>m de frente típico</small></div>' : '') +
      '</div>' +
      fila('Frente sobre', esc(cu.via || 'calle sin nombre') +
      (cu.jerarquia ? ' · ' + esc(cu.jerarquia.toLowerCase()) : '')) +
      fila('Tramo medido', cu.largoM + ' m') +
      fila('Fachada construida', cu.llenoM + ' m') +
      fila('Huecos', cu.huecos + (cu.mayorHuecoM ? ' · el mayor de ' + cu.mayorHuecoM + ' m' : '')) +
      (cu.esquinas.length
      ? fila('Esquinas en el tramo',
      esc(cu.esquinas.map(function (e) { return e.nombre || 'sin nombre'; }).join(', ')))
      : '') +
      (cu.usos.length
      ? fila('Usos que se asoman',
      esc(cu.usos.slice(0, 3).map(function (u) { return u.nombre + ' ' + u.n; }).join(' · ')))
      : '') +
      '<p class="lee">' + (cu.continua
      ? 'Frente continuo: la fachada acompaña la calle, y un proyecto que se retire rompe algo que funciona.'
      : cu.rota
      ? 'Frente roto: más de la mitad del tramo está vacío. Acá un proyecto no continúa una fachada, la empieza.'
      : 'Frente a medias: hay fachada y hay huecos. Lo que decide es dónde caen, no el promedio.') +
      (cu.mayorHuecoM >= 25
      ? ' El hueco mayor es de ' + cu.mayorHuecoM + ' m: eso no es un retiro, es un lote sin construir.'
      : '') + '</p>' +
      '<p class="nota">El frente son ' + cu.largoM + ' m de la calle a la que da el lote, con lo ' +
      'que se asoma a menos de 30 m. NO es catastro: cuenta EDIFICIOS —lo que OpenStreetMap ' +
      'registra— y no predios; dos casas pareadas con una huella cuentan como una.</p>';
      })(), 'g3') +

      /* ── La sombra que arroja el proyecto ─────────────────────────────
         La caja de arriba dice quién le tapa el sol al lote. Esta dice a
         quién se lo tapa el lote, que es la pregunta que hace un jurado
         apenas ve la volumetría y que hasta ahora no tenía respuesta en
         ninguna parte de la aplicación. */
      caja('La sombra que arrojás',
      (function () {
      var sp = o.sombraProyecto !== undefined ? o.sombraProyecto
             : (function () { try { return sombraDelProyecto(); } catch (e) { return null; } })();
      if (!sp || !sp.horas || !sp.horas.length) return '';
      var util = sp.horas.filter(function (h) { return !h.bajo; });
      if (!util.length) return '';
      return '<div class="kpis">' +
      '<div class="k"><b>' + sp.pisos + '</b><small>pisos que permite la norma</small></div>' +
      '<div class="k"><b>' + sp.alturaM + '</b><small>m de alto</small></div>' +
      (sp.peor
      ? '<div class="k"><b>' + Number(sp.peor.m2Fuera).toLocaleString('es-CO') +
      '</b><small>m² de sombra fuera del lote a las ' + sp.peor.hora + ':00</small></div>'
      : '') +
      '</div>' +
      util.map(function (h) {
      return fila('A las ' + h.hora + ':00',
      Number(h.m2Fuera).toLocaleString('es-CO') + ' m² fuera · ' +
      (h.tocados.length
        ? h.tocados.length + (h.tocados.length === 1 ? ' vecino tocado' : ' vecinos tocados')
        : 'sin vecinos tocados') +
      ' · sombra de ' + h.largoM + ' m');
      }).join('') +
      (sp.peor && sp.peor.tocados.length
      ? '<p class="lee">A las ' + sp.peor.hora + ':00 la sombra se sale <b>' +
      Number(sp.peor.m2Fuera).toLocaleString('es-CO') + ' m²</b> del lote y le cae encima a <b>' +
      sp.peor.tocados.length + '</b> edificio' + (sp.peor.tocados.length === 1 ? '' : 's') +
      '; al más afectado le tapa el <b>' + sp.peor.tocados[0].pct + '%</b>. Eso es lo que hay ' +
      'que poder defender: no que el proyecto reciba sol, sino que no se lo quite a nadie.</p>'
      : '<p class="lee">La sombra del volumen permitido no alcanza ningún edificio vecino ' +
      'registrado en las tres horas. Es un argumento a favor y conviene decirlo.</p>') +
      '<p class="nota">El volumen es el que permite la norma —' + sp.pisos + ' pisos sobre ' +
      Number(sp.huellaM2).toLocaleString('es-CO') + ' m² de huella—, no un proyecto dibujado, y la ' +
      'huella se modela encogiendo el lote hacia su centro: un proyecto real se separa distinto en ' +
      'cada lindero. Sirve para saber a quién le cae la sombra y en qué orden de magnitud.' +
      (sp.vecinosSinPisos ? ' ' + sp.vecinosSinPisos + ' vecinos sin pisos registrados no se ' +
      'pueden evaluar como afectados.' : '') + '</p>';
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
      
      /* Dónde falta mapear, dibujado. Es la caja que manda a alguien a
      caminar: un gajo punteado es un rumbo del que OpenStreetMap no sabe
      nada, y eso se lee de lejos, colgado en la pared. */
      caja('Dónde falta mapear',
      (function () {
      var rosa = rosaDeLoMapeado(zonasL);
      if (!rosa) return '';
      var sin = (zonasL.vacios || []).map(function (r) { return r.nombre; });
      var poco = (zonasL.flojos || []).map(function (f) { return f.rumbo.nombre; });
      return '<div class="dib">' + rosa + '</div>' +
      (sin.length
      ? '<p class="lee">Sin un solo registro al <b>' + esc(sin.join(', ')) + '</b>.</p>'
      : '<p class="lee">Los ocho rumbos tienen algo mapeado: el trabajo es verificar.</p>') +
      (poco.length ? fila('Con muy poco', esc(poco.join(', '))) : '') +
      fila('Usos mapeados en total', zonasL.total || 0) +
      '<p class="nota">Un rumbo vacío no quiere decir que no haya nada: quiere decir que ' +
      'nadie lo ha mapeado. Es donde el curso agrega lo que no existía.</p>';
      })(), 'g3') +
      
      /* La lista de faltantes, en el papel. Es la caja que se recorta y se
      lleva a la salida: dice qué anotar y qué se enciende con cada cosa. */
      caja('Lo que falta levantar',
      (function () {
      var lista = (function () { try { return faltantesDelSector(st); } catch (e) { return []; } })();
      if (!lista.length) return '';
      /* Con la hoja llena entran cuatro y no cinco: la quinta tarea es
      siempre la que menos enciende, y perderla cuesta menos que
      recortar en silencio la caja del terreno. */
      return '<div class="falta">' +
      lista.slice(0, extras >= 5 ? 4 : 5).map(function (x, i) {
      return '<div class="fa">' +
      '<span class="fa-n">' + (i + 1) + '</span>' +
      '<div><b>' + esc(x.titulo) + '</b>' +
      '<small>' + esc(x.cuantos) + '</small>' +
      '<em>enciende: ' + esc(x.enciende.join(' · ')) + '</em></div>' +
      '<code>' + esc(x.etiqueta) + '</code>' +
      '</div>';
      }).join('') +
      '</div>' +
      '<p class="nota">En orden de lo que más análisis enciende por menos trabajo. La ' +
      'etiqueta es la que se escribe en OpenStreetMap; lo que se levante vuelve a esta ' +
      'misma lámina cuando se vuelva a medir el sector.</p>';
      })(), 'g3') +
      
      /* Lo intangible. Es la única caja del pliego cuyo contenido no salió de
      ninguna consulta, y por eso lleva el nombre de quien caminó: en una
      lámina colgada, la diferencia entre un dato y un testimonio tiene que
      poder leerse sin preguntar. */
      caja('Lo intangible',
      (function () {
      var IT2 = window.URBIS_INTANGIBLE;
      var msL = (o.intangible !== undefined ? o.intangible : S.intangible) || [];
      if (!IT2) return '';
      msL = msL.filter(IT2.valida);
      if (!msL.length) return '';
      var anL = (function () {
      try { return analisisIntangible(msL); } catch (e) { return null; }
      })();
      if (!anL) return '';
      return '<div class="kpis">' +
      '<div class="k"><b>' + anL.total + '</b><small>marcas de lo que no se mide</small></div>' +
      (anL.pctSector != null
      ? '<div class="k"><b>' + anL.pctSector + '%</b><small>del sector marcado</small></div>'
      : '') +
      '</div>' +
      '<div class="barras">' +
      anL.porTipo.map(function (t) {
      return '<div class="b"><span>' + esc(t.nombre) + '</span>' +
      '<i><u style="width:' + Math.round(100 * t.n / anL.total) +
      '%;background:' + esc(t.color) + '"></u></i><b>' + t.n + '</b></div>';
      }).join('') +
      '</div>' +
      (anL.lote && anL.lote.dentroDe.length
      ? '<p class="lee">El lote cae dentro de <b>' +
      esc(anL.lote.dentroDe.map(function (x) { return x.nombre.toLowerCase(); }).join(', ')) +
      '</b>.</p>'
      : '') +
      anL.desacuerdos.slice(0, 2).map(function (d) {
      return '<p class="lee">' + esc(d.texto) + '</p>';
      }).join('') +
      (function () {
      var notas = [];
      msL.forEach(function (mk) {
      if (mk.nota) notas.push('«' + mk.nota + '»');
      });
      return notas.length
      ? '<p class="nota">' + esc(notas.slice(0, 4).join(' ')) + '</p>' : '';
      })() +
      '<p class="nota">Esto no es una medición: es lo que vio quien caminó, y vale por ' +
      'eso. No se promedia con las cifras de esta lámina.</p>';
      })(), 'g3');

    /* Columnas: dos parada y tres acostada mientras el contenido quepa; una
       más cuando no. Los umbrales salen de medir hojas reales: una hoja con
       terreno, clima, trazado, lote, sombras y las dos listas ronda los
       veinte mil caracteres de cajas. */
    /* Con la banda de mapas arriba, las cifras se reparten en una columna
       más: los mapas mandan en el pliego y el texto se acomoda alrededor, no
       al revés. */
    /* Con la banda de mapas arriba, al texto le queda menos hoja y necesita
       más columnas para caber. Si además hay mucho medido, una más: es lo que
       hace que el pliego cierre en vez de imprimirse por fuera del papel. */
    /* ── Ordenar por categorías ──────────────────────────────────────────
       Las cajas salían en el orden en que se miden, mezcladas: el terreno
       junto a los hitos, la sombra junto al perfil de la calle. Se pidió el
       orden de una lámina de análisis urbano —ambiental, movilidad,
       demográfico, forma, el lote, el campo— con cada bloque numerado y
       rotulado, que es como se presenta y como se lee de pie.

       Se hace DESPUÉS de armar las cajas y no reescribiendo el orden del
       código: cada caja se construye donde vive su cálculo, y reordenarlas
       en la fuente sería mover doscientas líneas por una decisión de
       presentación. Acá se cortan por su `<section>` —no hay secciones
       anidadas, y la prueba lo comprueba— y se vuelven a pegar por grupo,
       con su cabecera delante. En la rejilla de columnas la cabecera ocupa
       todo el ancho y el grupo fluye debajo. */
    /* Las categorías, en el orden en que se leen de pie: primero dónde es,
       después los mapas, y de ahí el análisis por temas hasta la síntesis.
       Cada una es una BANDA de ancho completo con su número, su título y una
       línea de qué trae, y sus cajas van en fila debajo. Es la organización
       que se pidió con una lámina en la mano: «organizada horizontalmente,
       con títulos». */
    var GRUPOS = [
      { id: 'ubicacion', titulo: 'Ubicación y delimitación', fam: 'sitio',
        que: 'dónde queda · cuánto mide · el plano del sector',
        cajas: ['Plano del sector', 'El sitio'] },
      { id: 'ambiental',  titulo: 'Análisis ambiental', fam: 'suelo',
        que: 'relieve · clima · sol · amenaza · inundación · verde · cobertura · espacio público',
        cajas: ['El terreno', 'El clima', 'Asoleamiento', 'La sombra de los vecinos',
                'La amenaza sísmica', 'La inundación', 'Verde y agua',
                'El ruido del tránsito', 'Infraestructura de servicios',
                'Cómo cambió el sitio', 'Cobertura del suelo', 'Espacio público efectivo'] },
      { id: 'movilidad',  titulo: 'Movilidad', fam: 'mover',
        que: 'la red · cómo se llega · la calle · lo que se alcanza a pie',
        cajas: ['Cómo se llega', 'El perfil de la calle', 'A distancia de caminar',
                'Hasta dónde se camina desde el lote'] },
      { id: 'demografico', titulo: 'Demográfico y usos del suelo', fam: 'sitio',
        que: 'cuánta gente · qué uso manda · dónde se juntan · hitos y nodos',
        cajas: ['Quién vive acá', 'Qué hay, por categoría', 'Qué manda en el sector',
                'Dónde está la calle comercial', 'Cómo cambia al alejarse', 'Hitos y nodos'] },
      { id: 'forma',      titulo: 'Morfología urbana', fam: 'forma',
        que: 'llenos y vacíos · alturas',
        cajas: ['Llenos y vacíos', 'Alturas de lo construido'] },
      { id: 'lote',       titulo: 'El lote y la norma', fam: 'proyecto',
        que: 'el predio · lo que cabe · lo que el sitio le pide al proyecto',
        cajas: ['El lote a intervenir', 'La cuadra del lote', 'Qué cabe en el lote',
                'La sombra que arrojás', 'Qué le pide el sitio al proyecto'] },
      { id: 'campo',      titulo: 'Trabajo de campo', fam: 'campo',
        que: 'lo intangible · lo levantado · lo que falta',
        cajas: ['Lo intangible', 'Lo levantado en campo', 'Dónde falta mapear', 'Lo que falta levantar'] },
      { id: 'sintesis',   titulo: 'Síntesis del sector', fam: 'cierre',
        que: 'a favor · en contra · falta levantar',
        cajas: ['Síntesis del sector'] }
    ];
    // De qué familia —y por tanto de qué color— es cada banda. Lo usan las
    // cajas de mapa, que se arman antes de saber en qué banda van a caer.
    var GRUPO_FAM = {};
    GRUPOS.forEach(function (g) { GRUPO_FAM[g.id] = g.fam; });
    /* Un mapa vale DOS columnas de su banda. Es lo que lo hace grande: al
       lado de las cajas de cifras del mismo tema, que valen una, el dibujo se
       lleva el doble de ancho. Con una sola columna quedaba igual de chico
       que en la tira que se quitó, y no habríamos arreglado nada. */
    var pesoDeMapaEnBanda = proporcionDelSector >= 1.25 ? 2 : 1;
    /* Cuántas columnas de la fila ocupa cada caja. El plano vale por varias
       —es la figura de la lámina— y la síntesis ocupa casi la fila entera. El
       resto vale una. */
    var ANCHO_FILA = anchoFila;
    /* La síntesis no pide la fila ENTERA acostada, sino siete de diez. No es
       un capricho de anchos: es alto. Con diez, la banda del trabajo de campo
       —que pesa dos— se quedaba sola en su fila y se estiraba a los 860 mm,
       de modo que dos bandas cortas se comían dos filas y 170 mm de papel
       para tres cajas. Con siete comparten fila y la síntesis, si nadie la
       acompaña, se estira igual: el peso permite compartir, no obliga. Esos
       milímetros son los que se van a los mapas. */
    var PESO = { 'Plano del sector': pesoPlano,
                 'Síntesis del sector': horiz ? 7 : ANCHO_FILA,
                 'Cómo cambió el sitio': 2, 'El lote a intervenir': 2 };
    function pesoDe(titulo) { return PESO[titulo] || 1; }
    /* Las bandas se arman DESPUÉS de las cajas y no reescribiendo el orden
       del código: cada caja se construye donde vive su cálculo, y moverlas
       en la fuente sería trasladar doscientas líneas por una decisión de
       presentación. Acá se cortan por su `<section>` —no hay secciones
       anidadas, y la prueba lo comprueba— y se vuelven a pegar por grupo.

       Una banda por fila cuando el grupo es ancho. Los grupos cortos —dos o
       tres cajas— comparten fila: con 900 mm de alto no hay papel para nueve
       bandas de ancho completo, y tampoco hace falta: dos títulos en la
       misma línea siguen siendo dos títulos, y las cajas siguen debajo del
       suyo. Cada banda ocupa de la fila la parte que le toca por sus cajas. */
    function agruparCajas(html) {
      var trozos = html.split(/(?=<section class="caja)/).filter(function (t) { return t.indexOf('<section') === 0; });
      var porTitulo = {}, porGrupo = {};
      trozos.forEach(function (t) {
        /* Una caja puede decir a qué banda va POR SU NOMBRE —la lista de cada
           grupo— o llevarlo escrito encima, en `data-g`. Lo segundo es para
           las cajas cuyo título no se sabe de antemano: los mapas se llaman
           «Comercio y economía» o «Jerarquía vial» según lo que se haya
           medido, así que no pueden estar en una lista fija. */
        var g = t.match(/^<section [^>]*data-g="([^"]+)"/);
        if (g) { (porGrupo[g[1]] || (porGrupo[g[1]] = [])).push(t); return; }
        var m = t.match(/<h2>([^<]*)<\/h2>/);
        var titulo = m ? m[1] : '';
        (porTitulo[titulo] || (porTitulo[titulo] = [])).push(t);
      });
      var puestas = {}, bandas = [], indice = [];
      GRUPOS.forEach(function (g) {
        var suyas = [], peso = 0;
        /* Los mapas de la banda van PRIMEROS, antes de las cifras del tema.
           Es el orden en que se lee una lámina de arquitectura: el ojo entra
           por el dibujo y después lee. */
        (porGrupo[g.id] || []).forEach(function (t) {
          suyas.push(t); peso += pesoDeMapaEnBanda;
        });
        g.cajas.forEach(function (tt) {
          (porTitulo[tt] || []).forEach(function (t) { suyas.push(t); peso += pesoDe(tt); puestas[tt] = true; });
        });
        if (!suyas.length) return;
        bandas.push({ g: g, cajas: suyas, peso: peso, fam: FAMILIAS[g.fam] || FAMILIAS.sitio });
      });
      /* ── Apilar de a dos ─────────────────────────────────────────────
         Cada fila del pliego medía lo que medía su mapa, y las cajas de
         cifras de al lado —la mitad de altas— quedaban con la mitad de abajo
         en blanco. Se veía en el PDF real: «El sitio», «Cómo se llega»,
         «Quién vive acá», todas con un palmo de papel vacío debajo. Ese
         palmo, multiplicado por treinta cajas, era la razón de que la hoja
         tuviera que encogerse al 42 % y la letra saliera de lupa.

         Ahora una banda con mapas se compone en DOS renglones: el mapa ocupa
         los dos y las cajas de cifras se apilan de a dos a su lado. La banda
         pide la mitad de columnas, caben el doble de bandas por fila, la
         hoja necesita menos filas y se encoge menos. Lo que se gana no es
         estética: es tamaño de letra sin quitar ni una caja. El número de
         columnas es la mitad de las CELDAS —un mapa vale dos por ancho que
         tenga, porque ocupa los dos renglones— y el peso con el que la banda
         entra en la fila es ese mismo número. */
      bandas.forEach(function (bd) {
        var esMapa = function (t) { return /^<section class="caja mapa-caja/.test(t); };
        var anchoDe = function (t) {
          if (esMapa(t)) return /mapa-ancho/.test(t) ? 2 : 1;
          var m = t.match(/<h2>([^<]*)<\/h2>/);
          return pesoDe(m ? m[1] : '');
        };
        var celdas = 0, celdasAncho = 0, conMapa = false;
        bd.cajas.forEach(function (t) {
          var an = anchoDe(t);
          var alto = (esMapa(t) || /plano-hero/.test(t) || /^<section class="caja[^"]*caja-alta/.test(t)) ? 2 : 1;
          if (alto === 2) conMapa = true;
          celdas += an * alto; celdasAncho += an;
        });
        bd.celdasAncho = celdasAncho;
        /* Dos renglones si hay un mapa que los justifique o si hay cajas de
           sobra para apilar; una sola caja no se apila con nadie. La síntesis
           va sola y a lo ancho: no entra en este reparto. */
        var renglones = (conMapa || bd.cajas.length >= 4) && !/sintesis-pie/.test(bd.cajas[0]) ? 2 : 1;
        /* Y tres —o los que hagan falta— cuando ni en dos cabe en el ancho
           de la fila. Se vio en el pliego parado: la banda demográfica con
           seis mapas y cinco cajas pedía nueve columnas para ocho, la grilla
           la partía sola en un tercer renglón y ahí quedaba UNA caja con
           siete huecos al lado. Si va a haber tercer renglón, que se decida
           acá y con las columnas repartidas, no que lo improvise la grilla. */
        if (renglones === 2 && Math.ceil(celdas / 2) > ANCHO_FILA) {
          renglones = Math.ceil(celdas / ANCHO_FILA);
        }
        bd.renglones = renglones;
        bd.cols = Math.max(1, Math.ceil(celdas / renglones));
        bd.peso = bd.cols;
      });
      /* Un mapa cuyo grupo no existe en la lámina —porque no se midió nada de
         ese tema— no puede desaparecer en silencio: va con las sueltas. */
      Object.keys(porGrupo).forEach(function (gid) {
        if (GRUPOS.some(function (g) { return g.id === gid; })) return;
        (porGrupo[gid] || []).forEach(function (t) {
          (porTitulo['(mapa suelto)'] || (porTitulo['(mapa suelto)'] = [])).push(t);
        });
      });
      // Lo que no esté en ningún grupo —una caja nueva que todavía no se
      // clasificó— sale al final, visible, en vez de perderse.
      var sueltas = [];
      Object.keys(porTitulo).forEach(function (tt) { if (!puestas[tt]) sueltas = sueltas.concat(porTitulo[tt]); });
      if (sueltas.length) {
        bandas.push({ g: { id: 'otras', titulo: 'Otras mediciones', que: 'sin categoría todavía' },
                      cajas: sueltas, peso: sueltas.length, fam: { tinte: '#6B7A8A', suave: '#EEF3F7' } });
      }
      /* Las filas: bandas seguidas mientras quepan en el ancho. Y cuando la
         siguiente no cabe, se mira si alguna de MÁS ADELANTE sí cabe antes
         de cerrar la fila. Se vio en el pliego parado: la movilidad —tres
         columnas— quedaba sola porque la demográfica pide seis, y sola se
         estiraba a la fila entera con el perfil de la calle de medio metro;
         la morfología, dos bandas después, pedía tres y cabía al lado. El
         orden de lectura cambia de a una banda y la numeración lo sigue; la
         síntesis no se adelanta nunca: cierra. */
      var filas = [], pendientes = bandas.slice(), orden = [];
      var esSintesis = function (bd) { return /sintesis-pie/.test(bd.cajas[0] || ''); };
      while (pendientes.length) {
        var fila = { bandas: [], peso: 0 };
        var primera = pendientes.shift();
        fila.bandas.push(primera); fila.peso += primera.peso; orden.push(primera);
        if (!esSintesis(primera)) {
          for (var k = 0; k < pendientes.length; k++) {
            var cand = pendientes[k];
            /* La síntesis solo entra si ya no queda nada más por poner: así
               comparte fila con la última banda cuando cabe —como antes— sin
               adelantarse a ninguna. */
            if ((esSintesis(cand) && pendientes.length > 1) || fila.peso + cand.peso > ANCHO_FILA) continue;
            fila.bandas.push(cand); fila.peso += cand.peso; orden.push(cand);
            pendientes.splice(k, 1); k--;
          }
        }
        filas.push(fila);
      }
      bandas = orden;
      bandas.forEach(function (bd, i) {
        bd.n = i + 1;
        indice.push({ n: bd.n, titulo: bd.g.titulo, fam: bd.fam });
      });
      var salida = filas.map(function (f) {
        return '<div class="fila">' + f.bandas.map(function (bd) {
          /* Cuántas columnas tiene la banda por dentro. Lo normal es una por
             caja, hasta lo que la banda ocupe de la fila.

             Cuando NO caben en un renglón, las columnas se reparten para que
             los renglones queden parejos en vez de dejar el último casi
             vacío. Llegó mirando el pliego parado de v739: el análisis
             ambiental pasó a siete cajas para seis columnas, así que la
             séptima —la cobertura del suelo— se caía sola al renglón de
             abajo con cinco columnas de blanco al lado. Siete en dos
             renglones no son seis y una: son cuatro y tres, y de paso cada
             caja queda más ancha, que es donde el texto deja de partirse. */
          /* Las columnas ya las decidió el reparto de arriba —la mitad de las
             celdas cuando la banda va en dos renglones—. El tope de la fila
             sigue mandando: una banda de más columnas que la fila se parte
             en más renglones, con las columnas repartidas parejas. */
          /* Con tope: una banda que pide más columnas que la fila se queda con
             las de la fila y baja a más renglones. NO se reparten las
             columnas «parejas» acá como se hacía antes: con mapas de dos
             renglones eso partía la banda demográfica en cuatro renglones de
             cuatro columnas y la hoja parada se salía 18 mm. La grilla densa
             rellena los huecos sola. */
          var cols = Math.min(bd.cols || bd.peso, ANCHO_FILA);
          var renglones = bd.renglones;
          /* Una banda que igual quedó sola en su fila se extiende a lo ancho
             en UN renglón, con una columna por caja: apilada en dos y
             estirada a la fila entera, cada caja salía del doble de ancho
             que de alto y el papel se iba en blanco. */
          if (f.bandas.length === 1 && renglones >= 2 && bd.celdasAncho <= ANCHO_FILA) {
            renglones = 1; cols = bd.celdasAncho;
          }
          return '<div class="banda banda-' + bd.g.id + (bd.cajas.length === 1 ? ' sola' : '') +
              '" style="--tinte:' + bd.fam.tinte + ';--suave:' + bd.fam.suave + ';flex:' + bd.peso + ' 1 0">' +
            '<div class="bcab"><b>' + (bd.n < 10 ? '0' : '') + bd.n + '</b><h3>' + esc(bd.g.titulo) + '</h3>' +
              '<small>' + esc(bd.g.que) + '</small></div>' +
            '<div class="bcuerpo' + (renglones >= 2 ? ' dos' : '') +
              '" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr))">' +
              bd.cajas.join('') + '</div>' +
          '</div>';
        }).join('') + '</div>';
      }).join('');
      return { html: salida, grupos: bandas.length, filas: filas.length, indice: indice };
    }

    /* Las tres cajas que no salen de la lista —el plano, la banda de mapas y
       la síntesis— se arman acá y entran a las bandas con las demás: el
       plano abre la primera con la ficha del sitio, los mapas van seguidos
       y la síntesis cierra. */
    var cajaPlano =
      /* El plano, a todo el ancho y antes de la rejilla. Era una caja más
         dentro de una cuadrícula, y eso obligaba a que las filas se
         repartieran el papel: cada fila valía por su caja más larga y los
         huecos del encaje se pagaban dos y tres veces. Fuera de la rejilla es
         lo que siempre fue en una lámina —el plano manda y el resto se
         acomoda— y de paso deja de competir por el alto. */
      caja('Plano del sector', (plano
            ? '<div class="plano"><div class="plano-cuerpo">' + plano + '</div></div>'
            : '') +
          (conv
            ? '<div class="conv">' + conv +
              (cmp && (cmp.nuevos || []).length
                ? '<span class="cv"><i class="rombo"></i>Encontrado por el curso <b>' +
                  cmp.nuevos.length + '</b></span>'
                : '') +
              (loteA ? '<span class="cv"><i class="lote"></i>El lote a intervenir</span>' : '') +
              '</div>'
            : '') +
          (huellas && huellas.length
            ? '<p class="nota">Las manchas oscuras son las huellas de los edificios registrados; ' +
              'los puntos, los usos mapeados, con el color de su categoría.</p>'
            : '<p class="nota">Los puntos son los usos mapeados, con el color de su categoría.</p>'),
          'plano-hero');
    /* ── Cada mapa, en la banda de su tema ────────────────────────────
       Estaban todos en una sola tira debajo del plano, y se pidió al revés:
       «en vez de que los mapas salgan en una sola línea, que se integren
       dependiendo el tema». Tiene dos razones, y las dos son buenas.

       La de leerlo: un mapa de curvas de nivel al lado de la caja del terreno
       dice algo; el mismo mapa a treinta centímetros, en una tira con otros
       ocho, es un recuadro más que hay que ir a buscar. Una lámina de
       análisis se arma por temas, no por técnicas.

       La de medirlo: en la tira, los recuadros se repartían los 505 mm de una
       sola banda entre todos. En su banda, cada mapa vale DOS columnas de las
       de esa banda, que es el doble de ancho de lo que tenía cualquier
       recuadro normal de la tira. Salen más grandes porque dejaron de
       competir entre ellos por el mismo trozo de papel.

       Uno por banda, eso sí: el mapa abre el tema, no lo reemplaza. Cuál de
       los del tema, lo decide la misma tabla de prioridad de siempre. */
    /* Cuando el mapa se llama igual que una caja de cifras del mismo tema
       —«Llenos y vacíos» es las dos cosas—, se le añade de qué se trata. Dos
       cajas con el mismo rótulo, una al lado de la otra y una con un dibujo
       adentro, hacen dudar de si son la misma repetida. */
    var titulosDeCaja = (cajasHTML.match(/<h2>([^<]*)<\/h2>/g) || [])
      .map(function (t) { return t.replace(/<\/?h2>/g, ''); });
    /* Dos columnas o una, según la forma del SECTOR. Un sector ancho llena una
       caja de dos columnas; uno cuadrado, no —y ahí estaba el problema que se
       reportó: «quiero el cuadrado que estás analizando más grande y no
       sobrealargarlo de más»—. Un dibujo cuadrado en una caja del doble de
       ancho tiene que encogerse hasta caber en el alto, y queda de la mitad
       del tamaño con dos franjas blancas a los lados. En una sola columna el
       mismo dibujo la llena de borde a borde y sale más grande. */
    var mapaAncho = proporcionDelSector >= 1.25;
    var cajaMapas = mapas.map(function (m) {
      var cara = CARA['Los mapas del sector'] || ['sitio', 'capas'];
      var titulo = titulosDeCaja.indexOf(m.titulo) >= 0 ? m.titulo + ' · el mapa' : m.titulo;
      return '<section class="caja mapa-caja' + (mapaAncho ? ' mapa-ancho' : '') +
          ' fam-' + (GRUPO_FAM[m.grupo] || 'sitio') +
          '" data-g="' + esc(m.grupo || 'mapas') + '">' +
          '<h2>' + esc(titulo) + '</h2>' +
          '<span class="ic" aria-hidden="true">' + ico(cara[1], 22) + '</span>' +
          '<div class="mp-dib">' + m.svg + '</div>' +
          /* Las convenciones, debajo del dibujo y encima del pie. Ese orden
             no es casual: el pie explica cómo se midió y la tabla dice qué es
             cada cosa, y lo segundo se necesita ANTES —mientras el ojo sigue
             en el dibujo—. */
          convenciones(m.conv) +
          /* Lo que el mapa quiera poner debajo además de su leyenda: la barra
             de cobertura va junto al raster porque separada confundía. */
          (m.extra || '') +
          '<small class="mp-pie">' + esc(m.pie) + '</small>' +
        '</section>';
    }).join('');
    var cajaSintesis =
      /* La síntesis cierra la hoja a todo el ancho, fuera de las columnas.
         Adentro era la última en entrar y la primera en no caber: quince
         cajas se reparten mal en dos columnas y la que sobra desaparece.
         Afuera, además, es lo que corresponde —es la conclusión, no un dato
         más— y sus tres listas se leen mejor en tres columnas anchas. */
      caja('Síntesis del sector',
          (function () {
            var sn = sintesisDelSector(res);
            if (!sn.favor.length && !sn.contra.length && !sn.falta.length) return '';
            /* Siete por columna, y antes eran cuatro. Se subió porque se pidió
               —«mejorar el sistema FODA porque argumenta muy poquitas cosas»—
               y porque el corte de cuatro se decidió cuando la síntesis sacaba
               ocho o nueve frases en total; ahora saca el doble y cortar en
               cuatro tiraba justo las de la red vial, la cobertura y el lote,
               que son las que un jurado pregunta.

               Siete y no todas: una columna de quince viñetas no la lee nadie
               de pie frente a un pliego. Las que no entran están en la ficha,
               en pantalla, donde se puede bajar con el dedo. Y se dice cuántas
               quedaron, que es la diferencia entre resumir y esconder. */
            var TOPE_SINTESIS = 7;
            /* La MATRIZ FODA, en sus cuatro cuadrantes. Antes eran tres
               columnas —a favor, en contra, falta levantar— y se pidió la
               matriz por su nombre, «muy importante». Fortalezas y
               debilidades son lo interno del sector; oportunidades y
               amenazas lo que le viene de afuera, y lo que falta levantar va
               con las oportunidades: es información que el proyecto todavía
               puede ganar. */
            var col = function (q, lista) {
              var mas = Math.max(0, lista.length - TOPE_SINTESIS);
              return '<div class="sn ' + q.clase + '"><h3>' + esc(q.t) + '<small>' + esc(q.que) + '</small></h3>' +
                (lista.length
                  ? lista.slice(0, TOPE_SINTESIS).map(function (x) {
                      return '<div class="sx' + (x.tarea ? ' sx-tarea' : '') + '"><span>' + esc(x.texto) + '</span>' +
                        '<small>' + esc(x.dato) + '</small></div>';
                    }).join('') +
                    (mas ? '<div class="sx sx-mas"><span>y ' + mas + ' más en la ficha</span></div>' : '')
                  : '<div class="sx"><span>—</span></div>') +
                '</div>';
            };
            var fd = sn.foda;
            return '<p class="lee">Matriz FODA del sector</p>' +
              '<div class="foda">' +
                FODA_CUADRANTES.map(function (q) { return col(q, fd[q.id] || []); }).join('') +
              '</div>';
          })(), 'sintesis-pie');
    var agrupado = agruparCajas(cajaPlano + cajaMapas + cajasHTML + cajaSintesis);
    cajasHTML = agrupado.html;

    var hoy = new Date();
    return '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
      '<title>Lámina · ' + esc(nombre || 'Análisis urbano') + '</title><style>' +
      '@page{ size:' + HOJA_W + 'mm ' + HOJA_H + 'mm; margin:0 }' +
      '*{ box-sizing:border-box }' +
      'html,body{ width:' + HOJA_W + 'mm; height:' + HOJA_H + 'mm; margin:0; padding:0;' +
        'font-family:Inter,"Segoe UI",system-ui,sans-serif; color:#0F1F2E;' +
        '-webkit-print-color-adjust:exact; print-color-adjust:exact }' +
      '.hoja{ width:' + HOJA_W + 'mm; height:' + HOJA_H + 'mm; padding:' + (horiz ? '11mm 20mm 8mm' : '15mm 20mm 9mm') + '; display:flex;' +
        'flex-direction:column; gap:' + (horiz ? 4.5 : 6) + 'mm; background:#fff }' +
      // Cabecera: el logo arriba a la izquierda, como se pidió.
      /* La cabecera es una BANDA de identidad y no una raya bajo el título:
         azul profundo de URBIS, con el agua —el celeste— arriba como filo. Se
         pidió con estas palabras: «el pliego celeste, con el agua arriba». Y
         es lo que hace que veinte pliegos colgados en un salón se
         reconozcan de la misma casa desde la puerta. */
      '.cab{ flex:0 0 auto; display:flex; align-items:flex-start; gap:8mm; padding:' + (horiz ? '3.5mm 9mm 3.5mm' : '5mm 9mm 5mm') + '; border-radius:3mm;' +
        'background:#075E88; color:#fff; border-top:2.2mm solid #34CCFE; position:relative; overflow:hidden }' +
      '.cab:after{ content:""; position:absolute; right:-30mm; top:-40mm; width:110mm; height:110mm;' +
        'border-radius:50%; background:#34CCFE; opacity:.13 }' +
      '.marca{ flex:0 0 auto; display:flex; flex-direction:column; gap:1mm; padding-right:8mm;' +
        'border-right:.4mm solid rgba(255,255,255,.28) }' +
      '.marca .logo{ display:block; margin-bottom:1.5mm; border-radius:3mm; object-fit:contain }' +
      '.marca b{ font-size:13mm; line-height:1; letter-spacing:.06em; color:#fff; font-weight:800 }' +
      '.marca small{ font-size:2.8mm; letter-spacing:.28em; text-transform:uppercase; color:#34CCFE; font-weight:700 }' +
      '.tit{ flex:1; min-width:0; position:relative }' +
      '.tit .ey{ font-size:3mm; letter-spacing:.24em; text-transform:uppercase; color:#34CCFE; font-weight:800 }' +
      '.tit h1{ margin:1mm 0 2mm; font-size:11.5mm; line-height:1.05; letter-spacing:-.02em; font-weight:800; color:#fff }' +
      '.tit .sub{ font-size:3.6mm; color:#D6EEF8; line-height:1.4 }' +
      '.tit .cad{ font-size:3.2mm; color:#9FD8F0; margin-top:1.5mm }' +
      // Las bandas
      /* La hoja es una pila de FILAS, y cada fila una o más BANDAS con su
         cabecera —número, título, qué trae— y sus cajas en una rejilla de
         tantas columnas como cajas. Antes era columnas de periódico, que
         llenan parejo pero mezclan los temas; y antes de eso una cuadrícula.
         Con las bandas cada categoría se lee de un vistazo y de lado a lado,
         que es como se lee una lámina colgada. */
      /* ── La hoja que se ajusta sola ──────────────────────────────────
         Un pliego es de 90 × 60 y no crece. Un sector con TODO medido —el
         terreno, el clima, el trazado, las sombras, la caminata, los rasters,
         el lote— tiene más contenido del que cabe: MEDIDO, pedía 111 mm más
         de los que hay, y lo de abajo se imprimía fuera del papel sin que
         nada avisara. No es un caso raro: es el sector bien trabajado, que es
         justamente el que se cuelga.

         Se resuelve como lo resuelve quien diagrama a mano: si sobra
         contenido, se baja el cuerpo de letra. La rejilla se compone en una
         hoja VIRTUAL más ancha —un uno partido por la escala— y después se
         reduce a la de verdad. Al componerse más ancha queda más baja, así
         que al reducirla cabe más; y como se reduce entera, ninguna
         proporción cambia: los mapas siguen siendo mapas y las cajas siguen
         alineadas.

         Cuánto se reduce lo decide `laminaQueQuepa` midiendo la hoja de
         verdad en el navegador, no una cuenta hecha acá. La transformación no
         ocupa espacio de composición —el navegador reserva el tamaño sin
         reducir—, así que la rejilla va dentro de un marco que sí lo ocupa y
         que recorta lo que sobre. */
      '.rejilla{ flex:1 1 auto; min-height:0; overflow:hidden }' +
      '.rej{ display:flex; flex-direction:column; gap:' + (horiz ? 3.5 : 5) + 'mm' +
        (escalaHoja < 1
          ? '; transform:scale(' + escalaHoja + '); transform-origin:top left;' +
            ' width:' + Math.round(1000 / escalaHoja) / 10 + '%'
          : '') + ' }' +
      '.fila{ display:flex; gap:' + (horiz ? 6 : 7) + 'mm; align-items:stretch }' +
      '.banda{ min-width:0; display:flex; flex-direction:column; gap:2.4mm }' +
      /* La cabecera de banda: el número en el color del tema, el título en
         mayúsculas y, a la derecha, la línea de qué trae. Una regla debajo
         cierra el título de lado a lado, como en la lámina de referencia. */
      '.bcab{ display:flex; align-items:baseline; gap:2.6mm; padding-bottom:1.4mm;' +
        'border-bottom:.55mm solid var(--tinte) }' +
      '.bcab b{ font-size:5.2mm; font-weight:800; color:var(--tinte); letter-spacing:.02em;' +
        'font-variant-numeric:tabular-nums }' +
      '.bcab h3{ margin:0; font-size:4.6mm; letter-spacing:.06em; text-transform:uppercase; color:#0F1F2E;' +
        'font-weight:800; line-height:1.1; white-space:nowrap }' +
      '.bcab small{ margin-left:auto; text-align:right; font-size:2.5mm; letter-spacing:.18em; text-transform:uppercase;' +
        'color:#6B7A8A; font-weight:700; line-height:1.3 }' +
      '.bcuerpo{ display:grid; gap:' + (horiz ? 3.5 : 4) + 'mm; align-items:stretch; flex:1;' +
        ' grid-auto-flow:row dense; grid-auto-rows:auto }' +
      /* En una banda de dos renglones el mapa —y el plano— ocupan los dos, y
         las cajas de cifras se apilan de a dos en las columnas de al lado. */
      '.bcuerpo.dos .mapa-caja, .bcuerpo.dos .plano-hero, .bcuerpo.dos .caja-alta{ grid-row:span 2 }' +
      /* En una banda de una sola caja el título de la caja repite el de la
         banda: se esconde y la caja queda como el cuerpo de su banda. */
      '.banda.sola .caja>h2, .banda.sola .caja>.ic{ display:none }' +
      '.banda.sola .caja{ border-top-width:.35mm; padding-top:3.4mm }' +
      '.plano-hero{ grid-column:span ' + pesoPlano + ' }' +
      '.sintesis-pie{ grid-column:1 / -1 }' +
      /* La caja de un mapa: dos columnas de su banda, el dibujo llenándola y
         el pie debajo. Ocupa dos porque un mapa al ancho de una caja de
         cifras es del tamaño que tenía en la tira que se quitó, y de eso se
         trataba. */
      /* La tira de la evolución, en el papel: cuadradas y en fila. Sin
         suavizado —a 30 m por píxel, suavizar es fingir un detalle que no
         está— y con el año medio tapado por nubes en punteado. */
      '.evo-tira{ display:flex; gap:2mm; flex-wrap:wrap; margin:1mm 0 2mm }' +
      '.evo-p{ margin:0; flex:0 0 auto; text-align:center }' +
      '.evo-p img{ display:block; width:22mm; height:22mm; object-fit:cover;' +
        'border-radius:1.5mm; border:.3mm solid #DBE5EC; image-rendering:pixelated }' +
      '.evo-p figcaption{ font-size:2.9mm; font-weight:800; color:#233748 }' +
      '.evo-p small{ font-size:2.7mm; color:#6B7A8A }' +
      /* Las fotos de alta resolución van más grandes que las estampas de
         Landsat, y no por gusto: aquéllas son para MEDIR —una proporción
         sobre miles de píxeles, que se lee en la cifra de al lado— y éstas
         son para MIRAR. Una foto de 22 mm en un pliego de 90 cm no se mira. */
      /* 46 mm, «más grandes incluso que los mapas de mapeos»: la caja va a dos
         columnas para que quepan cinco en fila. */
      '.evo-alta .evo-p img{ width:46mm; height:46mm; image-rendering:auto }' +
      '.caja-doble{ grid-column:span 2 }' +
      '.evo-dudoso img{ opacity:.55; border-style:dashed }' +
      '.mapa-caja{ grid-column:span 1 }' +
      '.mapa-caja.mapa-ancho{ grid-column:span 2 }' +
      '.mp-dib{ background:#F3F8FB; border-radius:1.5mm; padding:1mm }' +
      /* LLENA el ancho de su caja, con un techo de alto. Es al revés que los
         demás dibujos de la hoja, y a propósito: acá el recuadro ya tiene la
         proporción del sector —se calcula en `mapasDelPliego`— así que llenar
         el ancho es llenar la caja, sin franjas a los lados y sin deformar
         nada. El techo es lo único que impide que un mapa en una banda muy
         ancha se lleve media hoja de alto. */
      '.mp-dib svg{ display:block; width:100%; height:auto; max-height:' + altoMapaMM + 'mm }' +
      '.mp-pie{ font-size:2.7mm; color:#5A6472; line-height:1.35 }' +
      /* Una banda de un solo mapa —un tema del que solo se midió el dibujo—
         no puede esconder su título como hacen las de una sola caja: el
         título de la caja es el nombre del mapa y el de la banda es el del
         tema, y son cosas distintas. */
      '.banda.sola .mapa-caja>h2, .banda.sola .mapa-caja>.ic{ display:block }' +
      '.banda.sola .mapa-caja>.ic{ display:flex }' +
      /* 4 mm de margen interno y no 5: con los dibujos dentro, ese milímetro
         por caja es lo que hace que la hoja cierre. Menos de 4 y el texto
         empieza a tocar el borde impreso. */
      Object.keys(FAMILIAS).map(function (k) {
        return '.fam-' + k + '{ --tinte:' + FAMILIAS[k].tinte + '; --suave:' + FAMILIAS[k].suave + ' }';
      }).join('') +
      '.plano-hero{ --tinte:#0A6F9E; --suave:#E8F4FA }' +
      '.sintesis-pie{ --tinte:#0F1F2E; --suave:#EEF3F7 }' +
      '.caja{ --tinte:#0A6F9E; --suave:#E8F4FA; position:relative; border:.35mm solid #E3EAF0;' +
        'border-top:1.4mm solid var(--tinte); border-radius:3mm; padding:3.4mm 3.6mm 3.4mm; background:#fff;' +
        'display:flex; flex-direction:column; gap:2mm; overflow:hidden }' +
      '.caja h2{ margin:0 12mm 0 0; font-size:3.6mm; letter-spacing:.14em; text-transform:uppercase;' +
        'color:var(--tinte); font-weight:800; padding-bottom:1.6mm; border-bottom:.3mm solid var(--suave) }' +
      /* El distintivo con el icono, arriba a la derecha. Se coloca desde acá
         para que el h2 siga siendo lo primero de la caja. */
      '.caja .ic{ position:absolute; top:3.2mm; right:3.6mm; height:8.5mm; padding:0 2mm 0 1.4mm; border-radius:2.2mm;' +
        'background:var(--suave); color:var(--tinte); display:flex; align-items:center; justify-content:center; gap:1.4mm }' +
      '.caja .ic em{ font-style:normal; font-weight:800; font-size:3.6mm; width:5.4mm; height:5.4mm; border-radius:50%;' +
        'background:var(--tinte); color:#fff; display:inline-flex; align-items:center; justify-content:center }' +
      '.caja .ic svg{ width:5mm; height:5mm }' +
      '.caja h2{ margin-right:18mm }' +
      '.caja .k b, .caja .cm b, .caja .fa-n{ color:var(--tinte) }' +
      '.caja .b u{ background:var(--tinte) }' +
      '.caja .lee{ border-left-color:var(--tinte); background:var(--suave); padding:2.2mm 3mm; border-radius:0 2mm 2mm 0 }' +
      '.caja .de{ border-left-color:var(--tinte) }' +
      '.caja .mp figcaption{ color:var(--tinte) }' +
      /* Las clases de ancho vienen del tiempo de la cuadrícula. En columnas no
         mandan —el ancho lo pone la columna— y se dejan sin efecto en vez de
         quitarlas de cada caja: son catorce sitios y ninguno gana nada. */
      // El dibujo manda el alto de su caja y ocupa todo el ancho: así no
      // quedan bandas blancas a los lados, que es lo que pasaba cuando la
      // caja tenía alto propio y el plano se centraba dentro.
      /* El ancho del recuadro va en milímetros, calculado de la proporción del
         sector. Con `fit-content` sobre un SVG que solo trae viewBox, el
         recuadro y el dibujo se medían el uno al otro y daban cero: el plano
         desaparecía de la lámina sin dejar hueco. */
      '.plano{ background:#F3F8FB; border-radius:2mm; padding:2mm }' +
      /* Llena el ancho de su caja. El `viewBox` ya viene con la proporción del
         sector —se calcula justo arriba—, así que llenar el ancho es llenar
         la caja sin deformar nada; el techo de alto es lo único que impide
         que un plano cuadrado en una caja ancha se lleve media hoja. */
      '.plano-cuerpo{ width:100%; margin:0 auto }' +
      '.plano-cuerpo svg{ display:block; width:100%; height:auto; max-height:' +
        (horiz ? 120 : 190) + 'mm }' +
      /* Los dibujos de js/74 traen su propio color y su propio viewBox: acá
         solo se les da la caja y un techo de alto, que es lo único que puede
         desbordar una hoja que no crece. */
      /* ── Los dibujos llenan su caja ──────────────────────────────────
         La carta solar, el plano de sombras y el plano del lote se dibujaban
         con un alto FIJO de 21 mm cuando la hoja iba llena, y quedaban del
         tamaño de una estampilla al lado de mapas de 85 mm. Se pidió
         corregirlo por su nombre: «haga más grande el gráfico de asoleamiento,
         casi del mismo tamaño de los mapas», «igual aumenta el tamaño de las
         sombras de los vecinos», «donde dice lote a intervenir sale muy
         pequeño también el gráfico».

         Ahora manda el ANCHO de la caja, como en los recuadros de mapa: el
         dibujo la llena y el alto sale de su propia proporción. El techo está
         solo para que un dibujo cuadrado en una caja muy ancha no se lleve
         media hoja; lo que reparte el papel cuando falta es la reducción de la
         hoja entera, que se mide, y no un número escrito acá a ojo. */
      /* `align-self:stretch` y NO `margin:0 auto`. La caja es un contenedor
         flex en columna, y en uno de esos los márgenes automáticos del eje
         transversal encogen al hijo a su tamaño natural en vez de centrarlo
         estirado: el dibujo se quedaba en los 240 píxeles del SVG y dejaba el
         resto de la caja en blanco. No se notaba mientras las cajas eran
         angostas —240 era casi todo el ancho— y saltó a la vista al pedir
         estos cuatro dibujos «igual de grande a los mapas»: la caja se hizo
         el doble y el dibujo se quedó igual. */
      '.dib{ background:#F7FAFC; border-radius:2mm; padding:3mm; margin:0; align-self:stretch }' +
      /* El techo de alto es el MISMO que el de un recuadro de mapa, y ahí está
         la otra mitad de «igual de grande a los mapas». Un dibujo cuadrado en
         una caja del doble de ancho crece también el doble de alto, y cuatro
         de esos sacaron la hoja del papel —31 mm en la acostada, 93 en la
         parada, con la rejilla ya en su mínimo—. Con el techo del mapa, el
         dibujo ancho y bajo llena el ancho y el cuadrado se planta a la
         altura de un mapa y se centra: ninguno se lleva media hoja. */
      /* El techo de alto de un dibujo, en milímetros de papel. Es lo que
         impide que un dibujo cuadrado, ahora que por fin llena el ancho de su
         caja, crezca también a lo alto y saque la hoja del papel: con el
         techo viejo —200 mm, o sea ninguno— se pasaba 42 mm con la rejilla ya
         en su mínimo. Noventa está MEDIDO, no elegido: es el mayor de los que
         probé con el que la hoja cierra, y deja los dibujos a la altura de un
         recuadro de mapa, que es como se pidieron. Un dibujo ancho y bajo
         —el año de lluvia, la curva de amenaza— ni lo toca. */
      '.dib svg{ display:block; width:100%; height:auto; margin:0 auto; max-height:' +
        (horiz ? 90 : 108) + 'mm }' +
      /* El plano del lote, en su caja de dos por dos, crece hasta el alto de
         dos mapas: es lo que se pidió, «el gráfico más grande». */
      '.caja-alta .dib svg{ max-height:' + (horiz ? 160 : 190) + 'mm }' +
      /* La trama de llenos y vacíos es la excepción: es una muestra del patrón
         al lado de sus cifras, no un plano, y a 90 mm sería una cortina. */
      '.dib-chico{ max-width:30mm; margin:0; flex:0 0 auto; align-self:center }' +
      '.dib-chico svg{ width:100%; height:auto; max-height:30mm }' +
      '.dib-par{ display:flex; align-items:center; gap:5mm }' +
      '.corte{ background:#F7FAFC; border-radius:2mm; padding:2mm; margin:1.5mm 0 }' +
      /* Los cortes topográficos, a todo el ancho de su caja. Estaban a 15 mm
         de alto con la hoja llena, que en un pliego es una raya: «no veo el
         espacio para agregar cortes topográficos». Un corte es ancho y bajo
         por naturaleza, así que llenar el ancho no cuesta casi alto y es
         cuando por fin se le ve la ladera. */
      '.corte svg{ display:block; width:100%; height:auto; max-height:' +
        (horiz ? 55 : 65) + 'mm; margin:0 auto }' +
      '.dib-par .kpis{ flex:1 }' +
      '.plano svg{ display:block; width:100%; height:auto }' +
      '.conv{ display:flex; flex-wrap:wrap; gap:2mm 5mm; margin-top:2mm }' +
      '.cv{ font-size:3.3mm; color:#3B4A5A; display:inline-flex; align-items:center; gap:1.5mm }' +
      '.cv i{ width:2.6mm; height:2.6mm; border-radius:50%; display:inline-block }' +
      '.cv i.rombo{ border-radius:0; transform:rotate(45deg); background:#34CCFE;' +
        'box-shadow:0 0 0 .25mm #0F1F2E }' +
      '.cv i.lote{ border-radius:0; background:#FFD54F; box-shadow:0 0 0 .35mm #7A5901 }' +
      '.cv b{ color:#0F1F2E }' +
      /* La dona de categorías y su leyenda, que es la tabla de convenciones. */
      '.dona-par{ display:flex; align-items:center; gap:4mm; margin:1mm 0 2mm }' +
      '.dona{ width:34mm; height:34mm; flex:0 0 auto }' +
      '.dona-ley{ display:flex; flex-direction:column; gap:1.2mm; min-width:0 }' +
      '.lee-min{ font-size:2.7mm; color:#6B7A8A; margin:0 0 1.5mm }' +
      /* Mujeres y hombres en una sola barra partida, como en la ficha. */
      '.sexo{ display:flex; height:3.6mm; border-radius:2mm; overflow:hidden; margin:1mm 0 2mm }' +
      '.sexo i{ display:block; height:100% } .sexo-m{ background:#ec4899 } .sexo-h{ background:#34CCFE }' +
      '.k-m b{ color:#ec4899 } .k-h b{ color:#0A6F9E }' +
      '.dib-rosa{ max-width:40mm; margin:0; flex:0 0 auto } .dib-rosa svg{ max-height:40mm }' +
      /* Las muestras de los mapas: cada forma dice de qué clase es el dato. */
      '.cv i.mu-punto{ border-radius:50% }' +
      '.cv i.mu-area{ border-radius:.4mm; width:3.4mm; height:2.4mm }' +
      '.cv i.mu-linea{ border-radius:.6mm; width:4.6mm; height:1.1mm }' +
      '.cv i.mu-punteado{ background:none !important; width:4.6mm; height:0;' +
        'border-top:.9mm dashed #12202e; border-radius:0 }' +
      '.conv-mp{ gap:1.2mm 3.5mm; margin:1.5mm 0 0 }' +
      '.conv-mp .cv{ font-size:3mm }' +
      '.mapa-caja .mp-pie{ margin-top:1mm }' +
      // Cifras grandes
      '.kpis{ display:flex; gap:4mm; flex-wrap:wrap }' +
      '.k{ flex:1 1 0; min-width:20mm }' +
      '.k b{ display:block; font-size:7.4mm; line-height:1; font-weight:800; letter-spacing:-.025em; color:#0A6F9E;' +
        'font-variant-numeric:tabular-nums }' +
      '.k{ padding-left:2.4mm; border-left:.7mm solid var(--suave,#E8F4FA) }' +
      '.k small{ display:block; font-size:2.9mm; color:#6B7A8A; margin-top:.8mm; line-height:1.25 }' +
      '.f{ display:flex; justify-content:space-between; gap:3mm; font-size:3.6mm; padding:1mm 0;' +
        'border-bottom:.25mm solid #EEF3F7 }' +
      '.f span{ color:#3B4A5A } .f b{ color:#0F1F2E; font-variant-numeric:tabular-nums }' +
      '.barras{ display:flex; flex-direction:column; gap:1.8mm }' +
      '.b{ display:grid; grid-template-columns:28mm 1fr 16mm; align-items:center; gap:2mm; font-size:3.6mm }' +
      '.b span{ color:#3B4A5A } ' +
      '.b i{ display:block; height:2.6mm; border-radius:2mm; background:#EEF3F7 }' +
      '.b u{ display:block; height:100%; border-radius:2mm; background:#0A6F9E; text-decoration:none }' +
      '.b b{ text-align:right; color:#0F1F2E; font-variant-numeric:tabular-nums }' +
      '.nota{ font-size:3.1mm; color:#6B7A8A; line-height:1.45 }' +
      '.lee{ font-size:3.6mm; color:#0F1F2E; line-height:1.45; border-left:.8mm solid #34CCFE; padding-left:3mm }' +
      '.cobb{ display:flex; height:3.5mm; border-radius:1mm; overflow:hidden; margin:0 0 2mm }' +
      '.cobb i{ display:block; height:100% }' +
      '.hit{ display:grid; grid-template-columns:6mm 1fr auto; gap:2mm; align-items:baseline; font-size:3.6mm;' +
        'padding:1mm 0; border-bottom:.25mm solid #EEF3F7 }' +
      '.perf{ display:grid; grid-template-columns:1fr; gap:3mm; align-items:start }' +
      '.perf-dib{ background:#F3F8FB; border-radius:2mm; padding:3mm }' +
      '.pcr-seccion svg{ display:block; width:100%; height:auto }' +
      '.pcr-sec-edif{ fill:#3B4A5A }' +
      '.pcr-sec-suelo{ stroke:#5A6878; stroke-width:1.4; fill:none }' +
      '.pcr-sec-alt{ stroke:#0A6F9E; stroke-width:1.4; fill:none }' +
      '.pcr-sec-cota{ stroke:#5A6878; stroke-width:1; fill:none }' +
      '.pcr-sec-t{ fill:#3B4A5A; font-size:9px; font-weight:700 }' +
      '.deter{ display:flex; flex-direction:column; gap:2.5mm }' +
      '.de{ border-left:.8mm solid #34CCFE; padding:.5mm 0 1mm 3mm }' +
      '.de b{ display:block; font-size:3.1mm; color:#0F1F2E }' +
      '.de span{ display:block; font-size:2.8mm; color:#3B4A5A; line-height:1.35; margin-top:.6mm }' +
      '.falta{ display:flex; flex-direction:column; gap:2.5mm }' +
      '.fa{ display:grid; grid-template-columns:6mm 1fr auto; gap:2.5mm; align-items:baseline;' +
        'border-bottom:.25mm solid #EEF3F7; padding-bottom:2mm }' +
      '.fa-n{ font-weight:800; color:#0A6F9E; font-size:3.6mm }' +
      '.fa b{ display:block; font-size:3.2mm; color:#0F1F2E }' +
      '.fa small{ display:block; font-size:2.7mm; color:#6B7A8A; margin-top:.5mm }' +
      '.fa em{ display:block; font-size:2.7mm; color:#0A6F9E; font-style:normal; margin-top:.5mm }' +
      '.fa code{ font-size:2.6mm; color:#6B7A8A; background:#F3F8FB; padding:.6mm 1.4mm;' +
        'border-radius:1mm; white-space:nowrap }' +
      '.sint{ display:grid; grid-template-columns:repeat(3,1fr); gap:5mm }' +
      /* La matriz FODA: dos por dos, fortalezas y oportunidades arriba,
         debilidades y amenazas abajo, que es el orden en que se lee. */
      '.foda{ display:grid; grid-template-columns:repeat(2,1fr); gap:4mm }' +
      '.sn.riesgo{ background:#FFF4E5 } .sn.riesgo h3{ color:#B45309 } .sn.riesgo .sx{ border-left-color:#F59E0B }' +
      '.sn h3 small{ display:block; font-size:2.5mm; letter-spacing:0; text-transform:none; font-weight:500; color:#6B7A8A; margin-top:.5mm }' +
      '.sx-tarea span:before{ content:""; display:inline-block; width:2.2mm; height:2.2mm; ' +
        'border:0.3mm solid #9aa7b4; border-radius:0.4mm; margin-right:1mm; vertical-align:-0.2mm }' +
      /* Tres paneles de color y no tres columnas de texto: la síntesis es lo
         que se lee de pie desde el fondo del salón, y a favor, en contra y
         falta levantar tienen que distinguirse antes de leerse. */
      '.sn{ border-radius:2.5mm; padding:3.5mm 4mm 2mm; background:#F4F7FA }' +
      '.sn.ok{ background:#EAF7EF } .sn.no{ background:#FCEDEE } .sn.tarea{ background:#E6F6FC }' +
      '.sn h3{ margin:0 0 2.5mm; font-size:3mm; letter-spacing:.14em; text-transform:uppercase;' +
        'font-weight:800; color:#6B7A8A }' +
      '.sn.ok h3{ color:#177245 } .sn.no h3{ color:#B3282C } .sn.tarea h3{ color:#0A6F9E }' +
      '.sx{ border-left:.8mm solid #E3EAF0; padding:.5mm 0 1.5mm 3mm; margin-bottom:2.5mm }' +
      '.sx-mas{ border-left-style:dotted }' +
      '.sx-mas span{ font-style:italic; color:#6B7A8A }' +
      '.sn.ok .sx{ border-left-color:#22c55e } .sn.no .sx{ border-left-color:#E5484D }' +
      '.sn.tarea .sx{ border-left-color:#34CCFE }' +
      '.sx span{ display:block; font-size:3.1mm; line-height:1.35; color:#0F1F2E }' +
      '.sx small{ display:block; font-size:2.7mm; color:#6B7A8A; margin-top:.8mm;' +
        'font-variant-numeric:tabular-nums }' +
      '.camina{ display:grid; grid-template-columns:repeat(2,1fr); gap:4mm 6mm }' +
      '.cm b{ display:block; font-size:7.6mm; line-height:1; font-weight:800; letter-spacing:-.02em;' +
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
      /* El rótulo de cada corte, pegado a su dibujo: sin él, tres siluetas
         seguidas son tres siluetas y no A, B y C. */
      '.pie-corte{ margin:-1mm 0 3mm; font-size:2.7mm }' +
      '.pie-corte b{ color:#0A6F9E }' +
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
      // El pie se va al fondo del papel aunque el contenido termine antes.
      '.pie{ margin-top:auto; display:flex; justify-content:space-between; align-items:flex-end; gap:6mm;' +
        'border-top:1.2mm solid #34CCFE; padding-top:4mm; font-size:2.8mm; color:#6B7A8A }' +
      '.pie b{ color:#075E88 }' +
      '.pie .redes{ display:flex; justify-content:flex-end; gap:6mm; margin-top:2mm }' +
      '.pie .red{ display:inline-flex; align-items:center; gap:1.4mm; color:#075E88 }' +
      '.pie .red b{ font-size:3.1mm; letter-spacing:.04em }' +
      '</style></head><body><div class="hoja">' +

      '<header class="cab">' +
        '<div class="marca">' + marcaURBIS(15) + '<b>URBIS</b><small>Pro City</small></div>' +
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

      '<div class="rejilla"><div class="rej">' + cajasHTML + '</div></div>' +

      '<footer class="pie">' +
        '<div><b>URBIS</b> · urbispro.city · Generada el ' + esc(hoy.toLocaleDateString('es-CO')) +
          (meta.lat != null ? ' · ' + Number(meta.lat).toFixed(5) + ', ' + Number(meta.lng).toFixed(5) : '') + '</div>' +
        '<div style="max-width:120mm;text-align:right">Usos y vías de OpenStreetMap · población del DANE' +
          (ter ? ' · relieve ' + esc(ter.fuente || '') : '') +
          (cli ? ' · clima ' + esc(cli.fuente || '') : '') +
          '. Esto no es el sector: es lo que estas fuentes saben de él.' +
          '<span class="redes">' + pieRedes(3.4, 'mm') + '</span></div>' +
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
      'h3{font-size:11.5px;margin:12px 0 4px;color:#0A6F9E;letter-spacing:.02em}' +
      'table{border-collapse:collapse;width:100%;max-width:340px}' +
      'td{padding:3px 8px 3px 0;border-bottom:1px solid #eef2f6}' +
      'td.n{text-align:right;font-weight:700;color:#0A6F9E;width:52px}' +
      '.sol-punto{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle}' +
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
      /* Las redes, al pie: a la derecha y separadas por una raya fina, para
         que se lean como firma y no como una línea más del informe. */
      '.redes{display:flex;justify-content:flex-end;align-items:center;gap:16px;margin-top:18px;' +
        'padding-top:8px;border-top:1px solid #c7e7f7;color:#075E88;font-size:11px;letter-spacing:.04em}' +
      '.redes .red{display:inline-flex;align-items:center;gap:5px}' +
      '.redes .sitio{margin-right:auto;color:#6B7A8A}' +
      '.pie{color:#5a6472;font-size:11px;margin:5px 0 0}' +
      /* Dos de las tablas nuevas llevan tres columnas —los núcleos, los
         anillos— y a 340 mm la última quedaba partida en dos renglones. */
      'table.ancha{max-width:460px}' +
      'table.ancha td.n{width:auto;white-space:nowrap;padding-left:12px}' +
      '.ej{color:#5a6472;font-size:11px}' +
      /* Los dibujos traen su propio color en los atributos: acá solo se les
         pone un ancho de columna para que no salgan a tamaño de pantalla. */
      '.dib{margin:6px 0 8px;max-width:340px}' +
      '.dib svg{display:block;width:100%;height:auto}' +
      '.dib-chico{max-width:130px}' +
      '.dib-ancho{max-width:420px}' +
      '.mapas{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:6px 0 4px}' +
      /* Las tiras del historial: en fila, y que NO se partan entre dos
         páginas —media serie al pie de una hoja y media al principio de la
         siguiente deja de ser una comparación—. */
      '.evo{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 4px;break-inside:avoid}' +
      '.evo figure{margin:0;text-align:center}' +
      '.evo img{display:block;width:74px;height:74px;object-fit:cover;border-radius:5px;' +
        'border:1px solid #dbe5ec;background:#eef3f7;image-rendering:pixelated}' +
      '.evo.evo-alta img{width:104px;height:104px;image-rendering:auto}' +
      '.evo figcaption{font-size:10.5px;font-weight:700;color:#233748}' +
      '.evo small{font-size:9.5px;color:#6B7A8A;display:block}' +
      '.evo .dudoso img{opacity:.55;border-style:dashed}' +
      '.cv-l{list-style:none;margin:4px 0 2px;padding:0;display:flex;flex-wrap:wrap;gap:2px 10px}' +
      '.dona-par{display:flex;align-items:center;gap:14px;margin:6px 0 8px}' +
      '.dona{width:120px;height:120px;flex:0 0 auto}' +
      '.dona-ley{display:flex;flex-direction:column;gap:3px}' +
      '.dona-ley .cv{font-size:11px;color:#3B4A5A;display:inline-flex;align-items:center;gap:6px}' +
      '.dona-ley .cv i{width:9px;height:9px;border-radius:50%;display:inline-block}' +
      '.cv-l li{display:inline-flex;align-items:center;gap:5px;font-size:10px;color:#3B4A5A}' +
      '.cv-l i.mu{display:inline-block;width:9px;height:9px;border-radius:50%}' +
      '.cv-l i.mu-area{border-radius:2px;width:12px;height:8px}' +
      '.cv-l i.mu-linea{border-radius:2px;width:16px;height:4px}' +
      '.cv-l i.mu-punteado{background:none !important;width:16px;height:0;' +
        'border-top:3px dashed #12202e;border-radius:0}' +
      '.mp{margin:0;break-inside:avoid;page-break-inside:avoid}' +
      '.mp figcaption{font-size:11px;font-weight:700;color:#075E88;margin-bottom:2px}' +
      '.mp-dib{background:#F3F8FB;border-radius:4px;padding:3px}' +
      '.mp-dib svg{display:block;width:100%;height:auto}' +
      /* La clasificación del suelo y la foto de la que salió mandan la
         página: van al doble de ancho y encabezan la hoja. */
      '.mp.grande{grid-column:span 2}' +
      '.mp.grande figcaption{font-size:13px}' +
      '.mp small{display:block;font-size:9.5px;color:#5a6472;line-height:1.3;margin-top:2px}' +
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
      /* Los mapas, arriba del todo: en una hoja de arquitectura se entra por
         los planos y recién después se lee. Antes el PDF empezaba con una
         tabla de cifras. */
      (function () {
        var mps = (function () {
          try {
            return mapasDelPliego(res, { w: 260, h: 180,
              lote: o.lote !== undefined ? o.lote : S.lote,
              cobertura: o.cobertura !== undefined ? o.cobertura : (st.cobertura || S.cobertura),
              estratos: o.estratos, curvas: o.curvas, sombras: o.sombras,
              caminata: o.caminata !== undefined ? o.caminata : S.caminata,
              intangible: o.intangible !== undefined ? o.intangible : S.intangible,
              maxCategorias: 6 });
          } catch (e) { return []; }
        })();
        if (!mps.length) return '';
        return '<h2>Los mapas del sector</h2><div class="mapas">' +
          mps.map(function (m) {
            return '<figure class="mp' + (m.grande ? ' grande' : '') + '">' +
              '<figcaption>' + esc(m.titulo) + '</figcaption>' +
              '<div class="mp-dib">' + m.svg + '</div>' +
              /* Las mismas convenciones que en el pliego: un mapa sin ellas es
                 una mancha de colores, y eso no cambia porque la hoja sea
                 tamaño carta. */
              ((m.conv || []).length
                ? '<ul class="cv-l">' + m.conv.map(function (c) {
                    var f = c.f || 'punto';
                    return '<li><i class="mu mu-' + f + '" style="' +
                      (f === 'punteado' ? 'border-color:' : 'background:') +
                      esc(c.c || '#94a3b8') + '"></i>' + esc(c.t) + '</li>';
                  }).join('') + '</ul>'
                : '') +
              '<small>' + esc(m.pie) + '</small></figure>';
          }).join('') + '</div>' +
          '<p class="pie">Cada recuadro es la misma área con una capa encima. En la aplicación se ' +
          'encienden de a una; acá salen todas las que tienen datos.</p>';
      })() +
      ubicacionImpresa(res.ubicacion || (o && o.ubicacion)) +
      loteImpreso(meta, meta.forma === 'poligono') +
      '<h2>Qué hay, por categoría</h2>' +
      (function () {
        var datos = Object.keys(st.porGrupo || {})
          .map(function (g) { return { id: g, n: st.porGrupo[g] || 0 }; })
          .filter(function (x) { return x.n > 0 && x.id !== 'otro'; })
          .sort(function (a, b) { return b.n - a.n; });
        var COL2 = (window.AIA_CATALOGO && window.AIA_CATALOGO.GRUPO_COLOR) || {};
        return datos.length ? donaImpresa(datos, function (x) { return COL2[x.id] || '#94a3b8'; },
          function (x) { return sinEmoji(nombreGrupo(x.id)); }) : '';
      })() +
      '<table>' + filas(st.porGrupo, nombreGrupo) + '</table>' +
      '<h2>Lo más repetido</h2><table>' + filas(st.porSub, function (id) {
        var t = TAX.filter(function (u) { return u.sub === id; })[0];
        return t ? t.nombre : id;
      }) + '</table>' +
      queCabeImpreso((function () {
        try { return o.loteAnalisis !== undefined ? o.loteAnalisis : analisisDelLote(); }
        catch (e) { return null; }
      })(), o.indices) +
      loteImpresoIntervenir(o.loteAnalisis !== undefined ? o.loteAnalisis
        : (function () { try { return analisisDelLote(); } catch (e) { return null; } })(),
        o.lote !== undefined ? o.lote : S.lote) +
      caminataImpresa(o.caminata !== undefined ? o.caminata : S.caminata) +
      (function () {
        var ms = o.intangible !== undefined ? o.intangible : S.intangible;
        try { return intangibleImpreso(ms, analisisIntangible(ms, o.intangibleCtx)); }
        catch (e) { return ''; }
      })() +
      alturasImpresas(st) +
      terrenoImpreso(o.terreno !== undefined ? o.terreno : S.terreno,
        o.terrenoLote !== undefined ? o.terrenoLote
          : (function () { try { return terrenoDelLote(); } catch (e) { return null; } })(),
        o.curvas !== undefined ? o.curvas
          : (function () { try { return curvasDelTerreno(); } catch (e) { return null; } })()) +
      sombrasImpresas(o.sombras !== undefined ? o.sombras
        : (function () { try { return sombrasDelLote(); } catch (e) { return null; } })()) +
      climaImpreso(o.clima !== undefined ? o.clima : S.clima) +
      amenazaImpresa(o.amenaza !== undefined ? o.amenaza : S.amenaza) +
      // Pegada al sismo: son los dos riesgos del sitio y se leen juntos.
      inundacionImpresa(o.inundacion !== undefined ? o.inundacion : S.inundacion) +
      trazadoImpreso(o.trazado !== undefined ? o.trazado : S.trazado) +
      perfilImpreso(o.trazado !== undefined ? o.trazado : S.trazado) +
      espacioImpreso(o.trazado !== undefined ? o.trazado : S.trazado, st) +
      accesibilidadImpresa(st) +
      campoImpreso(o.campo !== undefined ? o.campo : S.campo) +
      determinantesImpresas(st) +
      sintesisImpresa(res) +
      rutasImpresas(st) +
      porDondeImpreso(res) +
      solImpreso(meta) +
      hitosImpresos(st) +
      coberturaImpresa(o.cobertura !== undefined ? o.cobertura : S.cobertura) +
      contextoImpreso(st) +
      /* Las seis que llegaban al pliego y no acá. Ver la nota donde se
         definen: una medición nueva entra en los dos documentos o en ninguno. */
      ruidoImpreso((function () { try { return ruidoDelLote(); } catch (e) { return null; } })()) +
      infraImpresa((function () { try { return infraDeServicios(res); } catch (e) { return null; } })()) +
      sombraProyectoImpresa(o.sombraProyecto !== undefined ? o.sombraProyecto
        : (function () { try { return sombraDelProyecto(); } catch (e) { return null; } })()) +
      evolucionImpresa(o.evo !== undefined ? o.evo : S.evo) +
      poblacionImpresa(st) +
      demografiaImpresa(st) +
      nucleosImpresos(st) +
      anillosImpresos(st, meta.forma === 'poligono') +
      cuadraImpresa(o.cuadra !== undefined ? o.cuadra
        : (function () { try { return laCuadraDelLote(); } catch (e) { return null; } })()) +

      queFaltaImpreso(st) +

      '<h2>A dónde ir</h2>' +
      (function () {
        var rosa = rosaDeLoMapeado(zonas);
        return rosa ? '<div class="dib">' + rosa + '</div>' : '';
      })() +
      /* Hacia dónde mira el sector. La rosa lo dibuja, pero la frase es lo
         que se cita: «la mitad oriental reúne 84 de 130». Solo sale si de
         verdad hay un lado que domina —señalar «el mayor» en un reparto
         parejo sería inventar un patrón que no existe—. */
      (zonas.concentracion
        ? '<p>La mitad <b>' + esc(zonas.concentracion.rumbo.nombre) + '</b> reúne <b>' +
          zonas.concentracion.n + ' de ' + zonas.total + '</b> (' + zonas.concentracion.pct +
          '%). Es el lado más activo según los datos.</p>'
        : '') + tareas +

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
      '<p class="redes"><span class="sitio">URBIS · urbispro.city</span>' + pieRedes(15) + '</p>' +
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

  /* Las capas que esta hoja pone sobre el mapa. Se declaran juntas y arriba
     porque quitarDelMapa las apaga todas de una vez: una capa que se declara
     al lado de su función es una capa que alguien olvida apagar. */
  var capaCurvas = null, capaSombras = null, capaCortes = null, capaVias = null;

  function quitarDelMapa() {
    var m = mapa();
    [capaPuntos, capaEstratos, capaLlenos, capaCurvas, capaSombras, capaCortes,
     capaVias].forEach(function (c) {
      if (c && m) { try { m.removeLayer(c); } catch (e) {} }
    });
    capaPuntos = null; capaEstratos = null; capaLlenos = null;
    capaCurvas = null; capaSombras = null; capaCortes = null; capaVias = null;
    S.llenosEnMapa = false; S.curvasEnMapa = false; S.sombrasEnMapa = false;
    S.cortesEnMapa = false; S.viasEnMapa = false;
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
  async function pintarEstratos(encender, guardadas) {
    var m = mapa();
    if (!m || typeof L === 'undefined') return { ok: false, error: 'El mapa no está listo.' };
    if (capaEstratos) { try { m.removeLayer(capaEstratos); } catch (e) {} capaEstratos = null; }
    if (!encender) return { ok: true, apagado: true };

    var d;
    if (guardadas && guardadas.manzanas) {
      // Las de una ficha reabierta: ya se pidieron una vez.
      d = guardadas;
    } else {
      if (!window.AIA_DATOS || !window.AIA_DATOS.manzanasEstrato) {
        return { ok: false, error: 'Falta el módulo de datos del DANE.' };
      }
      var eje = ejeActual();
      if (!eje) return { ok: false, error: 'Primero elegí un sector.' };
      var radio = S.forma === 'poligono' ? radioParaDane() : S.radioM;
      try { d = await window.AIA_DATOS.manzanasEstrato(eje.lat, eje.lng, radio); }
      catch (e) { return { ok: false, error: (e && e.message) || 'No se pudo cargar la estratificación.' }; }
    }
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
    /* El deslizador del radio se mueve con el dedo puesto encima: repintar la
       hoja en cada paso le arrancaría el control de la mano. Mientras se
       arrastra solo se mueve el círculo del mapa y el número; la hoja se
       repinta al soltar. */
    el.addEventListener('input', function (ev) {
      var b = ev.target.closest('[data-pcr="radio-rango"]');
      if (!b) return;
      S.radioM = Number(b.value) || S.radioM;
      var eco = document.getElementById('pcr-radio-eco');
      if (eco) eco.textContent = textoRadio(S.radioM);
      pintarCirculo();
    });
    el.addEventListener('change', function (ev) {
      var b = ev.target.closest('[data-pcr="radio-rango"]');
      if (!b) return;
      S.radioM = Number(b.value) || S.radioM;
      S.resultado = null;
      pintar();
    });
    /* La nota de una marca intangible se escribe letra a letra y NO repinta la
       hoja: si repintara, el campo se destruiría en la primera tecla y el
       teclado del teléfono se cerraría solo. Se guarda al salir del campo. */
    el.addEventListener('change', function (ev) {
      var n = ev.target.closest('[data-pcr-nota]');
      if (!n) return;
      anotarMarcaInt(n.getAttribute('data-pcr-nota'), n.value);
    });
    el.addEventListener('blur', function (ev) {
      var n = ev.target && ev.target.closest && ev.target.closest('[data-pcr-nota]');
      if (!n) return;
      anotarMarcaInt(n.getAttribute('data-pcr-nota'), n.value);
    }, true);
    /* Los índices del POT. Mismo criterio que la nota de una marca: se
       guardan al SALIR del campo y no en cada tecla, porque repintar la hoja
       destruiría el campo en la primera y cerraría el teclado del teléfono. */
    /* La fuente de los índices. Mismo criterio que los índices y las notas:
       al SALIR del campo, no en cada tecla. */
    el.addEventListener('change', function (ev) {
      var c = ev.target.closest && ev.target.closest('[data-pcr-fuente]');
      if (!c) return;
      S.indicesFuente = S.indicesFuente || {};
      S.indicesFuente[c.getAttribute('data-pcr-fuente')] = String(c.value || '').trim().slice(0, 120);
      guardarFichaViva();
      pintar();
    });
    el.addEventListener('change', function (ev) {
      var c = ev.target.closest && ev.target.closest('[data-pcr-idx]');
      if (!c) return;
      var Q = window.URBIS_QUE_CABE;
      if (!Q) return;
      S.indices = S.indices || Q.porDefecto();
      var v = Number(c.value);
      // Un índice negativo o vacío no es una opinión: es un error de tecleo.
      var cual = c.getAttribute('data-pcr-idx');
      S.indices[cual] = (isFinite(v) && v >= 0) ? v : 0;
      /* Que alguien haya escrito en la casilla es la única señal de que ese
         número salió de la ficha normativa y no del ejemplo. Se guarda aparte
         del valor: un índice que por casualidad coincide con el de ejemplo
         sigue estando confirmado si alguien lo escribió. */
      (S.indicesPuestos = S.indicesPuestos || {})[cual] = true;
      guardarFichaViva();
      pintar();
    });
    /* El respaldo entra por la pestaña «Sector», que la dibuja js/20 y vive
       fuera de esta hoja: por eso el oyente va en el documento y no en `el`.
       Se registra una sola vez, con la hoja, y no cada vez que se repinta la
       pestaña —que es varias veces por minuto—. */
    document.addEventListener('change', function (ev) {
      var inp = ev.target && ev.target.closest && ev.target.closest('#pcr-respaldo-archivo');
      if (!inp || !inp.files || !inp.files.length) return;
      var arch = inp.files[0];
      var fr = new FileReader();
      fr.onload = function () {
        var r = traerRespaldo(String(fr.result || ''));
        inp.value = '';
        if (r.error) { S.avisoPestana = arch.name + ': ' + r.error; }
        else {
          var partes = [];
          partes.push(r.nuevas
            ? ('Entraron ' + r.nuevas + ' sector' + (r.nuevas === 1 ? '' : 'es') + '.')
            : 'No entró ninguno nuevo.');
          if (r.repetidas) {
            partes.push(r.repetidas + (r.repetidas === 1 ? ' ya estaba' : ' ya estaban') +
                        ' y no se duplicaron.');
          }
          if (r.noCupieron) {
            partes.push('Se quedaron fuera ' + r.noCupieron + ' por el tope de ' + MAX_FICHAS +
                        ' sectores: los más viejos.');
          }
          S.avisoPestana = partes.join(' ');
          // Lo que el archivado tenga que decir de la falta de espacio.
          contarLoGuardado(r.guardado);
        }
        try { if (typeof window.urbisProCityAbrirSector === 'function') window.urbisProCityAbrirSector(); } catch (e) {}
      };
      fr.onerror = function () {
        inp.value = '';
        S.avisoPestana = arch.name + ': no se pudo leer el archivo.';
        try { if (typeof window.urbisProCityAbrirSector === 'function') window.urbisProCityAbrirSector(); } catch (e) {}
      };
      fr.readAsText(arch);
    });
    /* Los recorridos que llegan como archivo. Se lee cada uno por separado y
       se dice cuáles no sirvieron: importar cinco y que se caigan dos en
       silencio sería peor que no importar ninguno. */
    el.addEventListener('change', function (ev) {
      var inp = ev.target.closest && ev.target.closest('#pcr-int-archivo');
      if (!inp || !inp.files || !inp.files.length) return;
      var I2 = IN();
      if (!I2) return;
      var quedan = inp.files.length, buenos = 0, malos = [];
      Array.prototype.forEach.call(inp.files, function (f) {
        var fr = new FileReader();
        fr.onload = function () {
          var r = I2.leerPaquete(String(fr.result || ''));
          if (r.error) malos.push(f.name + ': ' + r.error);
          else {
            // El mismo recorrido dos veces no es un acuerdo: es el mismo.
            var yaEsta = (S.intCurso || []).some(function (p) {
              return p.autor === r.ok.autor && p.cuando === r.ok.cuando;
            });
            if (yaEsta) malos.push(f.name + ': ese recorrido ya estaba traído.');
            else { S.intCurso = (S.intCurso || []).concat([r.ok]); buenos++; }
          }
          if (--quedan === 0) {
            inp.value = '';
            rehacerUnion();
            /* Se guarda en cuanto llegan. Guardarlos solo cuando cambie otra
               cosa deja una ventana en la que un profesor acaba de importar
               los cuarenta archivos de su curso y todavía no hay nada
               escrito: si el teléfono se bloquea ahí, se perdieron los
               cuarenta y hay que repetir la importación uno por uno. */
            guardarFichaViva();
            S.intCursoAviso = malos.join(' · ');
            S.aviso = buenos
              ? 'Se juntaron ' + buenos + ' recorrido' + (buenos === 1 ? '' : 's') + '.'
              : 'No se pudo juntar ninguno.';
            pintar();
          }
        };
        fr.onerror = function () {
          malos.push(f.name + ': no se pudo leer el archivo.');
          if (--quedan === 0) { inp.value = ''; S.intCursoAviso = malos.join(' · '); pintar(); }
        };
        fr.readAsText(f);
      });
    });
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-pcr]');
      if (!b) return;
      var acc = b.getAttribute('data-pcr');
      if (acc === 'cerrar') { cerrar(); return; }
      if (acc === 'volver') { S.resultado = null; S.comparacion = null; S.aviso = ''; S.textoPlano = ''; pintar(); return; }
      if (acc === 'borrar-ficha') { borrarFicha(b.getAttribute('data-id')); pintar(); return; }
      if (acc === 'comparar') { comparar(b.getAttribute('data-id')); return; }
      /* Volver a ver un sector guardado, entero. El informe completo ya
         existe —lo arma `informeGuardado` con lo que la ficha trae, sin
         red— pero vivía solo en la pestaña de sectores, y desde la hoja no
         había cómo llegar. Acá se abre esa pestaña con la ficha desplegada,
         que es exactamente lo que hay que ver, en vez de duplicar el
         informe dentro de la hoja. */
      if (acc === 'ver-ficha') {
        var idV = b.getAttribute('data-id');
        if (!idV) return;
        S.pestanaAbierta = idV; S.avisoPestana = '';
        if (typeof window.urbisProCityAbrirSector === 'function') {
          cerrar();
          try { window.urbisProCityAbrirSector(); } catch (e) {}
          // Que la ficha desplegada quede a la vista y no debajo de las que
          // están antes en la lista.
          setTimeout(function () {
            try {
              var d = document.querySelector('.pcr-pest-ficha.abierta');
              if (d && d.scrollIntoView) d.scrollIntoView({ block: 'start', behavior: 'smooth' });
            } catch (e) {}
          }, 260);
        } else {
          S.aviso = 'El informe guardado se abre desde la pestaña de sectores.';
          pintar();
        }
        return;
      }
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
      if (acc === 'lamina' || acc === 'lamina-h') {
        if (!S.resultado || S.pdfArmando) return;
        S.pdfError = '';
        var caja3 = document.getElementById('pcr-nombre');
        S.nombreGuardado = caja3 ? String(caja3.value || '').trim() : '';
        bajarPliegoPDF(acc === 'lamina-h', function (m) { S.aviso = m; pintar(); });
        return;
      }
      // La vista de impresión sigue estando, para quien quiera mirarla antes
      // o mandarla a una impresora de verdad.
      if (acc === 'lamina-ver' || acc === 'lamina-ver-h') {
        if (!S.resultado) return;
        // El nombre se lee acá también: es el título de la lámina, y por los
        // dos caminos sale la misma hoja.
        var cajaV = document.getElementById('pcr-nombre');
        S.nombreGuardado = cajaV ? String(cajaV.value || '').trim() : S.nombreGuardado;
        var fueraAntes = (S.pliegoFuera || []).length;
        abrirImpresion(laminaQueQuepa(S.resultado, { horizontal: acc === 'lamina-ver-h',
          letra: S.pliegoLetra }),
                       function (m) { S.aviso = m; pintar(); });
        /* Armar la lámina es lo que averigua qué cajas no cupieron al tamaño
           de letra elegido, y ese aviso no sirve de nada si la ficha no se
           vuelve a dibujar para mostrarlo. Se repinta SOLO si hay algo nuevo
           que decir: un repintado gratuito reemplaza el DOM de la hoja, y con
           él los botones que alguien puede tener a medio tocar. */
        if ((S.pliegoFuera || []).length !== fueraAntes) pintar();
        return;
      }
      if (acc === 'reanudar') {
        var idF = b.getAttribute('data-id') || '';
        var fF = (leerFichas() || []).filter(function (x) { return x.id === idF; })[0];
        if (!fF) { S.error = 'Esa ficha ya no está guardada.'; pintar(); return; }
        if (reanudarFicha(fF)) {
          S.aviso = 'Listo, seguimos con «' + (fF.nombre || 'el sector') + '». Si necesitás ' +
                    'llenos y vacíos o sombras, volvé a medir el trazado.';
        } else {
          S.error = 'Esa ficha no guarda el área: no se puede reanudar.';
        }
        pintar(); return;
      }
      if (acc === 'teselas') { guardarTeselas(); return; }
      if (acc === 'teselas-parar') {
        var bt = S.bajandoTeselas;
        if (bt && bt.pr && bt.pr.estado) bt.pr.estado.cancelar();
        return;
      }
      if (acc === 'teselas-borrar') {
        var SS2 = window.URBIS_SIN_SENAL;
        if (!SS2) return;
        SS2.borrar().then(function () {
          S.teselas = { teselas: 0, mb: 0, hay: false };
          S.aviso = 'Se borró el mapa guardado.';
          pintar();
        });
        return;
      }
      if (acc === 'medir-todo') { medirTodo(false); return; }
      if (acc === 'medir-parar') {
        // Poner el estado en null es la señal que mira la cadena entre paso y
        // paso: lo que ya está pedido termina, pero no arranca nada más.
        S.midiendoTodo = null;
        S.aviso = 'Se paró de medir. Lo que ya estaba pedido termina solo.';
        pintar(); return;
      }
      if (acc === 'amenaza') { pedirAmenaza(); return; }
      if (acc === 'amenaza-texto') {
        var AM2 = window.URBIS_AMENAZA;
        var IN2 = window.URBIS_INUNDACION;
        if ((!AM2 || !S.amenaza) && !(IN2 && S.inundacion)) return;
        /* Lo que se pega en la memoria del proyecto lleva las dos amenazas.
           Copiar solo el sismo dejaría fuera justo la que en Cúcuta se puede
           ver desde la ventana. */
        var txtAm = [
          (AM2 && S.amenaza) ? AM2.comoTexto(S.amenaza) : '',
          (IN2 && S.inundacion) ? IN2.comoTexto(S.inundacion) : ''
        ].filter(Boolean).join('\n\n');
        S.textoPlano = txtAm;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txtAm);
            S.aviso = 'Copiado con la fuente y la advertencia. Va tal cual a la memoria.';
          } else { S.aviso = 'Copialo del cuadro de abajo.'; }
        } catch (e) { S.aviso = 'Copialo del cuadro de abajo.'; }
        pintar(); return;
      }
      if (acc === 'pedido-texto') {
        var QP = window.URBIS_QUE_CABE;
        if (!QP || !QP.textoDelPedido) return;
        var donde = (S.resultado && S.resultado.lugar && S.resultado.lugar.ciudad) || '';
        var txtP = QP.textoDelPedido(donde);
        S.textoPlano = txtP;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txtP);
            S.aviso = 'Copiada. Pegala en las notas del teléfono y llevala a la ventanilla.';
          } else { S.aviso = 'Copiala del cuadro de abajo.'; }
        } catch (e) { S.aviso = 'Copiala del cuadro de abajo.'; }
        pintar(); return;
      }
      if (acc === 'pliego-caja') {
        var idCaja = b.getAttribute('data-c') || '';
        var estabaC = cajasDelPliego(S.resultado).filter(function (c) {
          return c.id === idCaja; })[0];
        if (!estabaC || !estabaC.listo) return;
        alternarCajaPliego(idCaja, !estabaC.on);
        pintar(); return;
      }
      if (acc === 'pliego-mapa') {
        var idMapa = b.getAttribute('data-c') || '';
        var estabaM = mapasDisponibles(S.resultado).filter(function (m) {
          return m.id === idMapa; })[0];
        if (!estabaM || !estabaM.listo) return;
        alternarMapaPliego(idMapa, !estabaM.on);
        pintar(); return;
      }
      if (acc === 'pliego-todo' || acc === 'pliego-nada') {
        /* «Dejar solo el plano» no apaga TODO: un pliego sin plano no es un
           pliego, es una hoja de cifras. Deja lo que hace que se entienda de
           qué sector se está hablando. */
        var MINIMO = ['plano-del-sector', 'los-mapas-del-sector', 'el-sitio'];
        S.pliegoOff = acc === 'pliego-todo' ? []
          : cajasDelPliego(S.resultado).filter(function (c) {
              return MINIMO.indexOf(c.id) === -1; }).map(function (c) { return c.id; });
        // Los recuadros vuelven todos: la banda es lo que se mira primero, y
        // dejarla a medias al «poner todo» sería una sorpresa.
        if (acc === 'pliego-todo') S.pliegoMapasOff = [];
        S.pliegoCabe = null;
        guardarFichaViva();
        pintar(); return;
      }
      if (acc === 'pliego-letra') {
        var idL = b.getAttribute('data-c') || 'todo';
        if (LETRAS_PLIEGO.filter(function (x) { return x.id === idL; }).length) {
          S.pliegoLetra = idL;
          // Lo que quedó fuera con el tamaño anterior ya no vale: se recalcula
          // al armar la próxima lámina, y hasta entonces no se afirma nada.
          S.pliegoFuera = [];
          S.pliegoCabe = null;
          guardarFichaViva();
          pintar();
        }
        return;
      }
      if (acc === 'pliego-probar' || acc === 'pliego-probar-h') {
        probarSiCabe(acc === 'pliego-probar-h');
        return;
      }
      if (acc === 'capa') {
        var idCapa = b.getAttribute('data-c') || '';
        var estaba = capasDisponibles((S.resultado && S.resultado.stats) || {})
          .filter(function (c) { return c.id === idCapa; })[0];
        alternarCapa(idCapa, !(estaba && estaba.on));
        S.encogida = true;
        pintar(); return;
      }
      if (acc === 'capas-todo' || acc === 'capas-nada') {
        var prender = acc === 'capas-todo';
        capasDisponibles((S.resultado && S.resultado.stats) || {}).forEach(function (c) {
          if (!c.listo) return;
          /* Al encender todo, del calor se pone solo «todos»: encender las
             diez categorías a la vez pinta diez manchas superpuestas y no se
             lee ninguna. */
          if (prender && c.id.indexOf('calor:g:') === 0) return;
          alternarCapa(c.id, prender);
        });
        S.encogida = prender;
        S.encogidaAMano = false;
        pintar(); return;
      }
      if (acc === 'sombras-mapa') {
        var puestasS = pintarSombras(!S.sombrasEnMapa);
        S.encogida = S.sombrasEnMapa || hayCapaPuesta();
        S.encogidaAMano = false;
        if (!puestasS && !S.sombrasEnMapa) S.aviso = 'No hay sombras que dibujar.';
        pintar(); return;
      }
      if (acc === 'corte-nuevo') { iniciarCorte(); return; }
      if (acc === 'corte-borrar') {
        borrarCorte(b.getAttribute('data-c') || ''); return;
      }
      if (acc === 'cortes-mapa') {
        var puesto = pintarCortes(!S.cortesEnMapa);
        S.encogida = puesto;
        S.encogidaAMano = false;
        if (!puesto && !S.cortesEnMapa) S.aviso = 'Este análisis no trae por dónde se cortó. Volvé a medir el terreno.';
        pintar(); return;
      }
      if (acc === 'curvas-mapa') {
        var puestas = pintarCurvas(!S.curvasEnMapa);
        S.encogida = S.curvasEnMapa || hayCapaPuesta();
        S.encogidaAMano = false;
        if (!puestas && !S.curvasEnMapa) S.aviso = 'No hay curvas que dibujar: el sector es plano.';
        pintar(); return;
      }
      if (acc === 'caminata-mapa') {
        var puso = pintarCaminata(!S.caminataEnMapa);
        S.encogida = S.caminataEnMapa || hayCapaPuesta();
        S.encogidaAMano = false;
        if (!puso && !S.caminataEnMapa) S.aviso = 'No hay recorrido que dibujar.';
        pintar(); return;
      }
      if (acc === 'int-dibujar') { iniciarIntangible(b.getAttribute('data-t')); return; }
      if (acc === 'int-borrar') { borrarMarcaInt(b.getAttribute('data-m')); return; }
      if (acc === 'cabe-texto') {
        var QC = window.URBIS_QUE_CABE;
        if (!QC) return;
        var laC = null;
        try { laC = analisisDelLote(); } catch (e) {}
        if (!laC) return;
        var txtC = QC.comoTexto(QC.calcular(laC, S.indices || QC.porDefecto(), ctxQueCabe(), S.indicesPuestos));
        S.textoPlano = txtC;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txtC);
            S.aviso = 'Copiado, con la advertencia de dónde salen los índices.';
          } else { S.aviso = 'Copialo del cuadro de abajo.'; }
        } catch (e) { S.aviso = 'Copialo del cuadro de abajo.'; }
        pintar(); return;
      }
      if (acc === 'cabe-reiniciar') {
        var QR = window.URBIS_QUE_CABE;
        if (!QR) return;
        S.indices = QR.porDefecto();
        S.indicesPuestos = {};
        S.aviso = 'Volvieron los valores de ejemplo. No son la norma de Cúcuta: son un ' +
                  'punto de partida para que la cuenta arranque.';
        guardarFichaViva(); pintar(); return;
      }
      if (acc === 'int-exportar') {
        var IE = IN();
        if (!IE) return;
        var paq = IE.paraCompartir(S.intangible || [], {
          autor: quienSoy() || 'Sin nombre',
          sector: S.nombreGuardado || '',
          centro: ejeDelSector()
        });
        var comoNombre = (paq.autor || 'recorrido').toLowerCase()
          .replace(/[^\wáéíóúñ]+/gi, '-').replace(/^-+|-+$/g, '');
        var puso = descargarArchivo(JSON.stringify(paq),
          'urbis-intangible-' + (comoNombre || 'recorrido') + '.json', 'application/json');
        /* Además del archivo, al portapapeles: en un salón se pasa antes por
           el grupo de chat que por un cable. */
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(JSON.stringify(paq));
          }
        } catch (e) {}
        S.textoPlano = JSON.stringify(paq);
        S.aviso = puso
          ? 'Recorrido exportado y copiado. Pasáselo a quien lo va a juntar.'
          : 'No se pudo descargar acá, pero quedó copiado y en el cuadro de abajo.';
        pintar(); return;
      }
      if (acc === 'int-importar') {
        var inp = document.getElementById('pcr-int-archivo');
        if (inp) inp.click();
        return;
      }
      if (acc === 'int-curso-borrar') {
        S.intCurso = []; S.intCursoAviso = '';
        rehacerUnion(); pintarAcuerdos(false);
        // Que el borrado también quede escrito: si no, se quitan y vuelven.
        guardarFichaViva();
        S.aviso = 'Se quitaron los recorridos traídos. El tuyo queda.';
        pintar(); return;
      }
      if (acc === 'int-acuerdos-mapa') {
        var puestos = pintarAcuerdos(!S.intAcuerdosEnMapa);
        S.encogida = S.intAcuerdosEnMapa;
        S.encogidaAMano = false;
        if (!puestos && !S.intAcuerdosEnMapa) S.aviso = 'Todavía no hay sitios donde coincidan.';
        pintar(); return;
      }
      if (acc === 'int-mapa') {
        var puestasInt = pintarIntangible(!S.intEnMapa);
        S.encogida = S.intEnMapa;
        S.encogidaAMano = false;
        if (!puestasInt && !S.intEnMapa) S.aviso = 'Todavía no hay nada marcado.';
        pintar(); return;
      }
      if (acc === 'int-texto') {
        var I0 = IN();
        if (!I0) return;
        var txtInt = I0.comoTexto(analisisIntangible(), S.intangible || []);
        S.textoPlano = txtInt;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txtInt);
            S.aviso = 'Testimonio copiado. Va con nombre y fecha: es de quien caminó.';
          } else { S.aviso = 'Copialo del cuadro de abajo.'; }
        } catch (e) { S.aviso = 'Copialo del cuadro de abajo.'; }
        pintar(); return;
      }
      if (acc === 'lote-dibujar') { iniciarLote(); return; }
      if (acc === 'lote-borrar') { cancelarLote(); return; }
      if (acc === 'campo') { analizarCampo(); return; }
      if (acc === 'osm') {
        if (!S.campo) return;
        var nom = (S.nombreGuardado || 'sector').replace(/[^\wáéíóúñ ]+/gi, '').trim().replace(/\s+/g, '-');
        var pudo = descargarArchivo(construirOSM(S.campo),
          'urbis-' + (nom || 'sector').toLowerCase() + '.osm', 'application/xml;charset=utf-8');
        S.aviso = pudo
          ? 'Archivo descargado. Se abre con JOSM: revisá punto por punto antes de subir.'
          : 'No se pudo generar el archivo en este dispositivo.';
        pintar(); return;
      }
      if (acc === 'osm-texto') {
        if (!S.campo) return;
        var txtOsm = textoCorrecciones(S.campo);
        S.textoPlano = txtOsm;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txtOsm);
            S.aviso = 'Lista copiada. Pegala donde se reparta el trabajo.';
          } else { S.aviso = 'Copiala del cuadro de abajo.'; }
        } catch (e) { S.aviso = 'Copiala del cuadro de abajo.'; }
        pintar(); return;
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
        // Partiendo del lote, el centro es el suyo desde el primer momento.
        if (f === 'lote' && centroDelLote()) { S.centro = centroDelLote(); S.centroDe = 'lote'; }
        // Al elegir la forma, la hoja baja: es cuando hay que VER el mapa
        // para poner el radio o dibujar el área.
        S.encogida = true;
        if (f === 'radio') { tomarCentro(); seguirAlMapa(true); }
        else seguirAlMapa(false);
        pintarCirculo(); pintar(); return;
      }
      if (acc === 'asa') { alternarHoja(!S.encogida); return; }
      if (acc === 'lote-deshacer') { deshacerLote(); return; }
      if (acc === 'lote-cerrar') { cerrarLote(); return; }
      if (acc === 'lote-cancelar') { cancelarLote(); S.encogida = false; pintar(); return; }
      if (acc === 'agrandar') { alternarHoja(false); return; }
      // Nota: el calor sigue encendido en el mapa al volver al informe. Se
      // apaga desde los chips o desde el chip del propio mapa.
      if (acc === 'encoger') { alternarHoja(true); return; }
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
        if (g.ok) {
          S.aviso = 'Ficha guardada. La encontrás en la pestaña «Sector»' +
                    (g.n > 1 ? ', con ' + (g.n - 1) + ' más.' : '.');
          pintar();
        }
        /* Lo que haya que decir de la falta de espacio lo dice el mismo sitio
           que lo dice en el guardado automático: un solo texto, y no dos que
           se van separando. */
        contarLoGuardado(g);
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
        var g3 = null;
        if (S.resultado && S.ultimasZonas) {
          try { g3 = guardarFicha(S.resultado, S.ultimasZonas, nom2, S.fichaActualId); } catch (e) {}
        }
        S.aviso = g2
          ? ('Área «' + nom2 + '» guardada. La encontrás en Análisis → Áreas guardadas.')
          : 'No se pudo guardar el área.';
        pintar();
        // Si el sector que va con el área no cupo, se dice: el área sola no
        // sirve de nada si el análisis que la explica no se guardó.
        contarLoGuardado(g3);
        return;
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
      if (acc === 'evolucion' || acc === 'evolucion-alta') {
        pedirEvolucion(acc === 'evolucion-alta' ? 'wayback' : 'landsat'); return;
      }
      if (acc === 'curvas-paso') {
        S.curvasPaso = Number(b.getAttribute('data-paso')) || null;
        S.curvas = null;
        if (S.curvasEnMapa) pintarCurvas(true);
        pintar(); return;
      }
      if (acc === 'minimizar') { S.minima = true; pintar(); return; }
      if (acc === 'desminimizar') { S.minima = false; pintar(); return; }
      if (acc === 'int-mapa') { pintarIntangible(false); pintar(); return; }
      if (acc === 'traba-descartar') {
        // Lo decidió una persona sabiendo qué perdía. Eso es lo que faltaba.
        S.trabaDescartar = null;
        S.avisoGuardado = '';
        /* Sin recuento: `descartarSectorAnterior` con uno diría «quedó
           guardado», y este es justamente el caso en que no quedó. */
        descartarSectorAnterior(null);
        S.aviso = 'Se descartó el sector anterior, con lo que tenía sin guardar. ' +
                  'La hoja arranca de cero con el área nueva.';
        pintar(); return;
      }
      if (acc === 'otro') {
        /* Se suelta el resultado, no el área ni el trabajo a mano: quien
           quiera el mismo sector con otro radio no tiene que volver a
           dibujarlo, y sus marcas siguen siendo de ese barrio. Tampoco se
           suelta el ancla del sector: es lo que recuerda A QUÉ LUGAR
           pertenece lo que queda en memoria, y borrarla acá era lo que dejaba
           pasar las marcas de un barrio al siguiente. */
        soltarElAnalisis();
        pintar(); return;
      }
      if (acc === 'trazado') { analizarTrazado(); return; }
      if (acc === 'terreno') { analizarTerreno(); return; }
      if (acc === 'clima') { analizarClima(); return; }
      /* Leer los llenos de la foto: la cuenta la hace js/76 y tarda unos
         segundos sobre millones de píxeles, así que se avisa mientras. */
      if (acc === 'llenos-foto') {
        var LF = window.URBIS_LLENOS_FOTO;
        if (!LF || S.llenosFotoCargando) return;
        S.llenosFotoCargando = true; S.llenosFotoAviso = 'Leyendo la foto…'; pintar();
        LF.estimar({
          raster: S.cobertura, huellas: S.trzHuellas || [], vias: S.trzVias || [],
          alAvisar: function (t) {
            S.llenosFotoAviso = t;
            var c = document.getElementById('pcr-lfoto-estado');
            if (c) c.textContent = t;
          }
        }).then(function (r) {
          S.llenosFotoCargando = false; S.llenosFoto = r;
          if (r && r.ok) { pintarLlenosFoto(true); }
          guardarFichaViva(); pintar();
        }).catch(function (e) {
          S.llenosFotoCargando = false;
          S.llenosFoto = { ok: false, detalle: 'No se pudo leer la foto: ' + ((e && e.message) || e) };
          pintar();
        });
        return;
      }
      if (acc === 'llenos-foto-mapa') { pintarLlenosFoto(!S.llenosFotoEnMapa); pintar(); return; }
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
    /* Con un análisis hecho, el círculo YA NO es una propuesta: es el sector
       que se estudió, y tiene que quedarse donde se estudió.

       Sin esta guarda, bajar la hoja para mirar una capa y arrastrar el mapa
       movía el círculo detrás del dedo, y quedaba a un kilómetro de la foto
       clasificada del propio análisis. Llegó con dos capturas: en una, el
       recuadro de la cobertura arriba y el círculo punteado abajo, sin
       tocarse. Se leyó como «al navegar por el mapa salía este radio de
       más», y es peor que un dibujo suelto: son dos sitios distintos
       diciendo ser el mismo sector. */
    if (!S.encogida || S.forma !== 'radio' || S.resultado) return;
    var m = mapa(); if (!m) return;
    var c = m.getCenter();
    S.centro = { lat: c.lat, lng: c.lng };
    S.centroDe = 'mapa';
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
    S.centroDe = 'mapa';
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

    /* Partiendo del lote, la barra lleva lo único que hace falta con el mapa
       a la vista: el lote, cuánto alrededor se va a mirar y el botón. */
    if (S.forma === 'lote') {
      var cL = centroDelLote();
      return '' +
        '<button type="button" data-pcr="agrandar" class="pcr-asa" aria-label="Abrir la hoja"></button>' +
        '<div class="pcr-mini-cuerpo">' +
          '<div class="pcr-mini-fila">' +
            '<div class="pcr-mini-que">' +
              '<b>' + ico('lapiz', 16) + 'El lote y su entorno</b>' +
              '<small>' + (cL ? formatearM2(areaM2De(S.lote)) + ' de lote · ' + textoRadio(S.radioM) +
                                ' alrededor'
                              : 'todavía sin marcar') + '</small>' +
            '</div>' +
            '<button type="button" data-pcr="agrandar" class="pcr-mini-mas" aria-label="Más opciones">⋯</button>' +
          '</div>' +
          (cL
            ? '<div class="pcr-rango-fila">' +
                '<input type="range" class="pcr-rango" data-pcr="radio-rango" min="100" max="2000" ' +
                  'step="50" value="' + S.radioM + '" aria-label="Radio alrededor del lote, en metros">' +
                '<output id="pcr-radio-eco" class="pcr-rango-eco">' + textoRadio(S.radioM) + '</output>' +
              '</div>' +
              '<button type="button" data-pcr="analizar" class="pcr-principal"' +
                (S.cargando ? ' disabled' : '') + '>' +
                (S.cargando ? 'Consultando…' : ico('lupa') + 'Ver qué hay') + '</button>'
            : '<button type="button" data-pcr="lote-dibujar" class="pcr-principal">' +
                ico('lapiz') + 'Marcar el lote en el mapa</button>') +
          (S.error ? '<p class="pcr-error">' + esc(S.error) + '</p>' : '') +
          (S.cargando ? '<p class="pcr-pista pcr-espera">La primera consulta del día puede tardar.</p>' : '') +
        '</div>';
    }

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
    /* Con `cortesEnMapa` y `viasEnMapa`, que faltaban. Las dos capas se
       encendían, se pintaban sobre el mapa, marcaban la hoja para que se
       encogiera… y la hoja no se movía, porque esta lista decide si el
       encogimiento vale la pena y no las nombraba. Desde afuera: se toca «ver
       por dónde van los cortes», el panel sigue tapando el mapa y parece que
       el botón no hizo nada. Salió comprobando el ir y volver de la ficha, no
       buscándolo. */
    var hayCapa = S.calor.length > 0 || S.cobEnMapa || S.llenosEnMapa || !!S.estratos ||
                  S.caminataEnMapa || S.curvasEnMapa || S.sombrasEnMapa ||
                  S.cortesEnMapa || S.viasEnMapa;
    /* Dibujando el lote la hoja se encoge SIEMPRE: no se puede marcar las
       esquinas de un terreno sobre un mapa tapado por un panel. */
    /* `encogidaAMano` es la diferencia entre «se encogió sola porque encendí
       una capa» y «la empujé yo». El guardián de `hayCapa` existe para que
       una capa apagada no deje la hoja abajo mostrando nada; pero aplicado a
       un gesto de la persona significaba que, con la ficha analizada y sin
       ninguna capa encendida, la hoja NO SE DEJABA BAJAR. Que es justo lo
       que alguien quiere hacer cuando quiere mirar el mapa. */
    var encoger = S.loteDibujando ||
                  (S.encogida && !S.comparacion &&
                   (S.encogidaAMano || !S.resultado || hayCapa));
    h.classList.toggle('pcr-encogida', encoger);
    h.classList.toggle('pcr-minima', encoger && !!S.minima && !S.loteDibujando);
    // `encoger` va ANTES de `S.resultado`: si no, con la ficha en pantalla la
    // hoja se quedaba con la clase de encogida y el contenido entero dentro
    // —bajaba a una barra de 90 px con el informe completo comprimido—.
    /* Dónde iba leyendo, para devolverlo después.

       `innerHTML` tira el contenido y con él la posición del desplazamiento:
       la hoja vuelve arriba. Con una ficha de treinta bloques eso es perder
       el sitio en un texto de varias pantallas, y cada repintado lo hace. Se
       notó guardando el mapa —cuatrocientas imágenes, y la hoja saltando
       arriba en cada una, imposible de leer— pero pasaba en todos los
       repintados: encender una capa, medir algo, cambiar un índice.

       Cada vista recuerda LA SUYA, y ésa es la diferencia con lo que hacía
       antes. Se guardaba una sola posición y solo se devolvía si la hoja
       seguía mostrando lo mismo, que es correcto —volver al mismo píxel al
       pasar de los ajustes a la ficha no significa nada— pero dejaba fuera
       justo el caso que más duele:

         se baja media ficha hasta la topografía, se toca «ver por dónde van
         los cortes», la hoja se encoge para dejar ver el mapa, se mira, se
         vuelve a subir la hoja… y aparece arriba del todo. Hay que volver a
         bajar media ficha. Y pasa igual con las curvas, la caminata, las
         sombras y cada capa que se enciende.

       Con una posición por vista, la ficha vuelve donde estaba y la barra
       encogida vuelve donde estaba: son dos lecturas distintas y ninguna
       pisa a la otra. */
    var cuerpoAntes = h.querySelector('.pcr-cuerpo');
    var iba = cuerpoAntes ? cuerpoAntes.scrollTop : 0;
    var mismaVista = S.comparacion ? 'comparacion' : encoger ? 'encogida'
                   : S.resultado ? 'ficha' : 'ajustes';
    /* Y se olvida en cuanto cambia el sector. Devolver a alguien al píxel
       1.800 de la ficha ANTERIOR lo deja en mitad de un texto que no ha
       leído, y encima de otro sitio. Se compara el objeto del resultado y no
       una bandera: así vale para todos los caminos por los que cambia —un
       análisis nuevo, una ficha archivada que se retoma, «analizar otro»— sin
       tener que acordarse de limpiarlo en cada uno. */
    if (h.__deQuien !== S.resultado) { h.__donde = {}; h.__deQuien = S.resultado; }
    if (!h.__donde) h.__donde = {};
    if (h.__vista && iba > 0) h.__donde[h.__vista] = iba;
    var vuelveA = h.__donde[mismaVista] || 0;
    h.__vista = mismaVista;

    h.innerHTML = S.comparacion ? htmlComparacion(S.comparacion)
                : encoger        ? htmlEncogida()
                : S.resultado    ? htmlFicha(S.resultado)
                : htmlAjustes();

    if (vuelveA > 0) {
      var cuerpo = h.querySelector('.pcr-cuerpo');
      // Si la ficha encogió de contenido, el propio navegador recorta el
      // salto al final de lo que hay: no hace falta comprobarlo acá.
      if (cuerpo) cuerpo.scrollTop = vuelveA;
    }
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
      : S.sombrasEnMapa
        ? { icono: 'brujula', titulo: 'La sombra de los vecinos',
            detalle: (S.sombras && S.sombras.horas
              ? S.sombras.horas.map(function (h) { return h.hora + ':00'; }).join(' · ') + ' de hoy'
              : 'sobre el lote') }
      : S.curvasEnMapa
        ? { icono: 'crecer', titulo: 'Curvas de nivel',
            detalle: (S.curvas && S.curvas.intervalo
              ? 'cada ' + S.curvas.intervalo + ' m · ' + S.curvas.zMin + ' a ' + S.curvas.zMax + ' msnm'
              : 'del modelo de elevación') }
      : S.caminataEnMapa
        ? { icono: 'caminar', titulo: 'Hasta dónde se camina',
            detalle: (S.caminata && S.caminata.anillos && S.caminata.anillos.length)
              ? 'desde el lote · 5, 10 y 15 minutos'
              : 'desde el lote' }
      : S.cobEnMapa
        ? { icono: 'satelite', titulo: 'Cobertura del suelo',
            detalle: (S.cobertura && S.cobertura.clases
              ? (function () {
                  var v = S.cobertura.clases.filter(function (c) { return c.id === 'verde'; })[0];
                  return v ? 'verde ' + v.pct + '% del área' : 'sobre la foto satelital';
                })()
              : 'sobre la foto satelital') }
        : { icono: 'capas', titulo: 'Sobre el mapa', detalle: 'ninguna capa encendida' };

    /* Dibujando un lote, este panel mostraba los chips del mapa de calor y un
       botón «Volver al informe» que no volvía a ningún lado: `encoger` es
       verdadero mientras `loteDibujando` lo sea, así que bajar `S.encogida`
       no cambiaba nada. Desde afuera se veía como una aplicación colgada —el
       botón no hacía nada, el calor no se podía apagar, la ficha no aparecía—
       y encima cada toque en el mapa añadía otro vértice, porque el oyente
       del lote seguía puesto.

       Un panel que ofrece los controles de otra cosa no es un detalle de
       presentación: es lo que hace que alguien crea que la aplicación se
       rompió. Mientras se dibuja, acá van los controles del lote y nada más.
       (La barra flotante de abajo sigue estando; esto es para cuando queda
       tapada por la propia hoja, que es lo que pasó en campo.) */
    if (S.loteDibujando) {
      var nL = (S.lote || []).length;
      return '' +
        '<button type="button" data-pcr="agrandar" class="pcr-asa" ' +
          'aria-label="Cancelar el lote y volver"></button>' +
        '<div class="pcr-mini-cuerpo">' +
          '<div class="pcr-mini-fila">' +
            '<div class="pcr-mini-que">' +
              '<b>' + ico('lapiz', 16) + 'Marcando el lote</b>' +
              '<small>' + (nL === 0 ? 'tocá las esquinas sobre el mapa'
                        : nL < 3 ? 'llevás ' + nL + ' esquina' + (nL === 1 ? '' : 's')
                        : 'llevás ' + nL + ' esquinas · tocá la primera para cerrar') +
              '</small>' +
            '</div>' +
          '</div>' +
          '<div class="pcr-llevar">' +
            '<button type="button" data-pcr="lote-deshacer" class="pcr-mini"' +
              (nL ? '' : ' disabled') + '>' + ico('deshacer', 16) + 'Deshacer</button>' +
            '<button type="button" data-pcr="lote-cerrar" class="pcr-mini pcr-llevar-b"' +
              (nL >= 3 ? '' : ' disabled') + '>' + ico('ok', 16) + 'Listo</button>' +
          '</div>' +
          '<button type="button" data-pcr="lote-cancelar" class="pcr-principal">' +
            ico('atras') + 'Cancelar y volver al informe</button>' +
        '</div>';
    }

    /* Un interruptor por capa encendida, todos en UNA fila. Antes cada capa
       ponía un botón de ancho completo y el estrato además su leyenda; con
       la foto, los llenos, los estratos y las curvas encendidos la hoja
       encogida medía más que la pantalla y TAPABA EL MAPA ENTERO —llegó en
       captura: cuatro botones, una leyenda, siete chips y «Volver», y del
       mapa no quedaba un píxel—. Una hoja que existe para dejar ver el mapa
       y lo tapa no es un detalle de presentación. */
    function interruptor(acc, icono, texto) {
      return '<button type="button" data-pcr="' + acc + '" class="pcr-capa-chip on" ' +
        'aria-label="Quitar ' + esc(texto.toLowerCase()) + ' del mapa">' +
        ico(icono, 14) + esc(texto) + '<i>' + ico('apagar', 12) + '</i></button>';
    }
    var capas = [];
    if (S.cobEnMapa)      capas.push(interruptor('cob-mapa', 'satelite', 'Foto'));
    if (S.llenosEnMapa)   capas.push(interruptor('llenos-mapa', 'capas', 'Llenos'));
    if (S.llenosFotoEnMapa) capas.push(interruptor('llenos-foto-mapa', 'satelite', 'Llenos de la foto'));
    if (S.estratos)       capas.push(interruptor('estratos', 'capas', 'Estratos'));
    if (S.sombrasEnMapa)  capas.push(interruptor('sombras-mapa', 'brujula', 'Sombras'));
    if (S.curvasEnMapa)   capas.push(interruptor('curvas-mapa', 'crecer', 'Curvas'));
    if (S.caminataEnMapa) capas.push(interruptor('caminata-mapa', 'caminar', 'Recorrido'));
    if (S.intEnMapa && (S.intangible || []).length)
                          capas.push(interruptor('int-mapa', 'ojo', 'Percepción'));

    /* La leyenda de estratos en una sola línea, y solo mientras estén
       puestos: es lo único de las capas que necesita leyenda para leerse. */
    var leyendaCorta = S.estratos
      ? '<div class="pcr-leyenda-corta">' +
          [['#8B1A1A','1'],['#E4572E','2'],['#E8C547','3'],['#4CAF50','4'],['#2E9BD6','5'],['#7B3FE4','6'],['#7A8794','S/E']]
            .map(function (e) { return '<span><i style="background:' + e[0] + '"></i>' + e[1] + '</span>'; }).join('') +
          '<em>estrato DANE</em>' +
        '</div>'
      : '';

    /* Si está en mínimo, solo el asa y una línea: es el estado para mirar el
       mapa sin nada encima y para poder mandar una captura. Se llega
       empujando la hoja hacia abajo una segunda vez. */
    if (S.minima) {
      return '' +
        '<button type="button" data-pcr="desminimizar" class="pcr-asa" aria-label="Subir los controles"></button>' +
        '<div class="pcr-mini-cuerpo pcr-mini-linea">' +
          '<button type="button" data-pcr="desminimizar" class="pcr-mini-que pcr-mini-que-b">' +
            '<b>' + ico(capa.icono, 16) + esc(capa.titulo) + '</b>' +
            '<small>' + esc(capa.detalle) + (capas.length ? ' · ' + capas.length + (capas.length === 1 ? ' capa' : ' capas') : '') + '</small>' +
          '</button>' +
          '<button type="button" data-pcr="agrandar" class="pcr-mini" aria-label="Volver al informe">' +
            ico('atras', 14) + 'Informe</button>' +
        '</div>';
    }

    return '' +
      '<button type="button" data-pcr="agrandar" class="pcr-asa" aria-label="Volver al informe"></button>' +
      '<div class="pcr-mini-cuerpo">' +
        '<div class="pcr-mini-fila">' +
          '<div class="pcr-mini-que">' +
            '<b>' + ico(capa.icono, 16) + esc(capa.titulo) + '</b>' +
            '<small>' + esc(capa.detalle) + '</small>' +
          '</div>' +
          '<button type="button" data-pcr="minimizar" class="pcr-mini" aria-label="Bajar los controles y ver el mapa">' +
            ico('mapa', 14) + 'Ver el mapa</button>' +
          '<button type="button" data-pcr="agrandar" class="pcr-mini pcr-mini-mas" aria-label="Volver al informe">' +
            ico('atras', 14) + 'Informe</button>' +
        '</div>' +
        (capas.length
          ? '<div class="pcr-capas-fila">' +
              '<span class="pcr-capas-lab">En el mapa</span>' + capas.join('') +
            '</div>' + leyendaCorta
          : '') +
        (S.caminataEnMapa
          ? '<p class="pcr-pista pcr-pista-corta">Azul oscuro, 5 minutos; celeste, 10; claro, 15.</p>'
          : '') +
        '<div class="pcr-calor-chips pcr-calor-fila">' +
          chip('todos', 'Todos los usos', st.total || 0, null) +
          grupos.map(function (g) { return chip('g:' + g.id, nombreGrupo(g.id), g.n, colorDeGrupo(g.id)); }).join('') +
        '</div>' +
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
    var esLote = S.forma === 'lote';
    function botonForma(f, icono, texto) {
      var on = S.forma === f || (f === 'radio' && !esPol && !esLote);
      return '<button type="button" data-pcr="forma" data-f="' + f + '" class="pcr-forma' +
        (on ? ' pcr-forma-on' : '') + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        ico(icono) + texto + '</button>';
    }
    var selector =
      // Antes del selector: si hay un sector archivado, seguir con ese es casi
      // siempre lo que se quiere, y volver a dibujar el área es lo que no.
      bloqueReanudar() +
      '<div class="pcr-formas" role="group" aria-label="Forma del área">' +
        botonForma('radio', 'radio', 'Un radio') +
        botonForma('poligono', 'area', 'El área dibujada') +
        /* La tercera es la que corresponde al trabajo real del curso: primero
           se marca el lote a intervenir y después se estudia lo que tiene
           alrededor. El radio se mide desde el lote, no desde donde quedó el
           mapa. */
        botonForma('lote', 'lapiz', 'El lote y su entorno') +
      '</div>' +
      (hayPol || esPol || esLote ? '' :
        '<small class="pcr-pista">Para usar un área a medida, dibújala primero en Pro City con «Dibujar área en el mapa».</small>');

    // Con un área dibujada no hay centro ni radio que elegir: los deduce el
    // servidor del propio trazo. Mostrar esos controles ahí sería ofrecer una
    // decisión que no existe.
    var ajusteArea = esLote
      ? (function () {
          var c = centroDelLote();
          if (!c) {
            return '<div class="pcr-campo">' +
              '<label class="pcr-lab">El lote a intervenir</label>' +
              '<p class="pcr-pista">Marcá en el mapa el terreno sobre el que vas a proponer algo. ' +
              'Después elegís cuánto de su alrededor querés estudiar: el círculo azul sale ' +
              'centrado en el lote.</p>' +
              '<button type="button" data-pcr="lote-dibujar" class="pcr-mini pcr-lote-btn">' +
                ico('lapiz') + 'Marcar el lote en el mapa</button>' +
              (S.loteAviso ? '<p class="pcr-error">' + esc(S.loteAviso) + '</p>' : '') +
            '</div>';
          }
          return '<div class="pcr-campo">' +
              '<label class="pcr-lab">El lote a intervenir</label>' +
              '<p class="pcr-areainfo">' + formatearM2(areaM2De(S.lote)) + ' · ' +
                S.lote.length + ' esquinas · centro en ' + c.lat.toFixed(5) + ', ' + c.lng.toFixed(5) +
              '</p>' +
              '<div class="pcr-llevar">' +
                '<button type="button" data-pcr="lote-dibujar" class="pcr-mini">' +
                  ico('lapiz', 16) + 'Volver a marcarlo</button>' +
                '<button type="button" data-pcr="lote-borrar" class="pcr-mini">' +
                  ico('borrar', 16) + 'Quitarlo</button>' +
              '</div>' +
            '</div>' +
            '<div class="pcr-campo">' +
              '<label class="pcr-lab" for="pcr-radio-rango">Cuánto alrededor del lote</label>' +
              '<div class="pcr-rango-fila">' +
                '<input type="range" id="pcr-radio-rango" class="pcr-rango" data-pcr="radio-rango" ' +
                  'min="100" max="2000" step="50" value="' + S.radioM + '" ' +
                  'aria-label="Radio alrededor del lote, en metros">' +
                '<output id="pcr-radio-eco" class="pcr-rango-eco">' + textoRadio(S.radioM) + '</output>' +
              '</div>' +
              '<small class="pcr-pista">De 100 m a 2 km desde el centro del lote. El círculo azul del ' +
              'mapa se mueve con el control; el lote queda encima, en amarillo.</small>' +
            '</div>';
        })()
      : esPol
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
        bloqueTraba() +
        /* El aviso también acá. No estaba: la vista de ajustes era la única de
           las tres que no lo pintaba, así que todo lo que se dijera al soltar
           un sector —adónde fue a parar, qué llevaba— se escribía en un estado
           que nadie llegaba a leer nunca. */
        (S.aviso ? '<p class="pcr-aviso">' + esc(S.aviso) + '</p>' : '') +
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

  /* Las fichas guardadas. Dos cosas se hacen con ellas: VOLVER A VERLAS
     enteras —el informe completo, con sus gráficas, sin repetir el
     análisis— y compararlas contra lo que el curso mapeó después.

     Lo primero faltaba: la lista solo ofrecía «Comparar», y comparar además
     está apagado mientras nadie haya mapeado. Un sector analizado, con todo
     medido, quedaba guardado y sin puerta de entrada desde acá; había que
     saber que el informe vive en otra pestaña. Se dijo con estas palabras:
     «me gustaría entrar y volver a ver todo el análisis, todo lo que se
     investigó, y solo sale un botón que dice comparar».

     Si no hay ninguna ficha no se muestra nada: un cajón vacío con un
     título encima solo ocupa pantalla. */
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
      '<p class="pcr-pista">Tocá un sector para volver a ver su informe entero, con sus gráficas, ' +
      'sin repetir el análisis. ' +
      (hayCampo
        ? 'Y después de la salida a campo, compará: vas a ver cuánto agregó el curso.'
        : 'Cuando el curso mapee en estas zonas, acá vas a poder comparar el antes y el después.') +
      '</p>' +
      fichas.map(function (f) {
        var cuando = new Date(f.ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
        var tam = f.forma === 'poligono' ? formatearArea(f.areaM2) : (f.radioM + ' m');
        /* La tarjeta entera abre el informe: en un teléfono, apuntarle a un
           botón de 28 px al lado de la miniatura es peor que tocar la fila,
           y tocar la fila es lo que cualquiera intenta primero. Los dos
           botones de al lado se quedan por lo suyo. */
        return '<div class="pcr-guardada">' +
          '<button type="button" class="pcr-guardada-ir" data-pcr="ver-ficha" data-id="' + esc(f.id) + '"' +
            ' aria-label="Ver el informe de ' + esc(f.nombre || cuando) + '">' +
            miniaturaDeFicha(f) +
            '<span class="pcr-guardada-t">' +
              '<b>' + esc(f.nombre || cuando) + '</b>' +
              (f.nombre ? '<em class="pcr-guardada-f">' + esc(cuando) + '</em>' : '') +
              '<small>' + esc(tam) + ' · ' + f.total + ' usos</small>' +
              '<em class="pcr-guardada-ver">' + ico('lupa', 13) + 'Ver el análisis</em>' +
            '</span>' +
          '</button>' +
          '<button type="button" data-pcr="comparar" data-id="' + esc(f.id) + '"' +
            ' class="pcr-mini"' + (hayCampo && !S.comparando ? '' : ' disabled') + '>' +
            (S.comparando ? '…' : ico('comparar', 16) + 'Comparar') + '</button>' +
          '<button type="button" data-pcr="borrar-ficha" data-id="' + esc(f.id) + '"' +
            ' class="pcr-x pcr-x-mini" aria-label="Borrar ficha">' + ico('borrar', 16) + '</button>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  /* La miniatura de un reconocimiento guardado.

     La lista era solo texto: un nombre, una fecha y dos cifras. Con cuatro
     sectores parecidos —«La Playa», «La Playa 2»— eso no basta para saber
     cuál es cuál, y a un curso de arquitectura menos que a nadie: lo que
     identifica un sector es su FORMA.

     No es una imagen del mapa: es un plano de lo que se analizó, con la
     silueta del área, los usos que se encontraron pintados por categoría, y
     el lote si se marcó. Se dibuja del propio guardado, así que aparece
     instantáneo y sin señal —bajarle un mapa a cada ficha sería una imagen
     por ficha cada vez que se abre la lista—.

     La ficha ya guardaba todo esto para poder comparar después; acá no se
     agrega ni un byte al almacenamiento. */
  function miniaturaDeFicha(f, opts) {
    var op = opts || {};
    var A = window.URBIS_PC_ANALISIS;
    if (!A || typeof A.miniatura !== 'function' || !f) return '';
    var forma = (f.forma === 'poligono' && f.poligono && f.poligono.length >= 3)
      ? { pts: f.poligono }
      : (f.centro && f.radioM ? { centro: f.centro, radioM: f.radioM } : null);
    if (!forma) return '';

    /* Una muestra y no todos: una ficha puede traer mil usos y en 96 píxeles
       de ancho no se distinguen; dibujarlos todos solo hace el SVG pesado.
       Se toman repartidos por la lista —uno de cada n— y no los primeros,
       que vendrían todos del mismo rincón. */
    var pois = f.pois || [];
    var tope = 160;
    var paso = Math.max(1, Math.ceil(pois.length / tope));
    var puntos = [];
    for (var i = 0; i < pois.length; i += paso) {
      var p = pois[i];
      if (p && p.lat != null) {
        puntos.push({ lat: p.lat, lng: p.lng, color: colorDeGrupo(p.grupo) });
      }
    }
    var poligonos = (f.lote && f.lote.length >= 3)
      ? [{ pts: f.lote, relleno: '#E0A800', opacidad: .75, borde: '#7A5901' }]
      : null;

    var svg = '';
    try {
      svg = A.miniatura(forma, {
        w: op.w || 96, h: op.h || 68, puntos: puntos, radioPunto: op.radioPunto || 1.5,
        poligonos: poligonos, clase: op.clase || '',
        etiqueta: 'Plano de ' + (f.nombre || 'el sector guardado')
      });
    } catch (e) { svg = ''; }
    if (!svg) return '';
    return op.pelado ? svg : '<div class="pcr-guardada-mini">' + svg + '</div>';
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
    if (trz && trazadoSinDatos(trz)) {
      /* En la memoria de un proyecto, una línea de ceros se convierte en una
         cifra citada. Se dice lo que pasa. */
      L.push('EL TRAZADO DEL SECTOR');
      L.push('  ' + TRAZADO_VACIO);
      L.push('');
    } else if (trz) {
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
    // La lista de lo que falta va ANTES del reparto: es lo que hay que
    // anotar, y el reparto solo dice quién va a dónde.
    try { var dt = determinantesComoTexto(st); if (dt) { L.push(dt); L.push(''); } } catch (e) {}
    try { var qf = queFaltaComoTexto(st); if (qf) { L.push(qf); L.push(''); } } catch (e) {}
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
      /* La carta solar antes que los números: es el dibujo con el que un
         arquitecto decide dónde van los quiebrasoles, y hasta ahora este
         bloque lo daba en tres cifras y dos párrafos. */
      (function () {
        var carta = dib('cartaSolar', { lat: lat, lng: lng, fecha: hoy });
        return carta
          ? '<div class="pcr-dibujo pcr-dibujo-solo">' + carta +
            '<p class="pcr-dibujo-pie">Vista desde arriba: el centro es el cenit y el borde, el ' +
            'horizonte. La línea gruesa es el recorrido del sol <b>hoy</b>; las punteadas, el día ' +
            'más alto y el más bajo del año — entre esas dos se mueve el resto. El sector rojo es ' +
            'el occidente.</p></div>'
          : '';
      })() +
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
  /* Alrededor de qué se hizo la consulta, dicho con todas las letras y con
     las coordenadas al lado.

     Llegó un informe de campo que no pude reproducir en tres intentos:
     «marqué el lote, ajusté el radio, y el análisis se hizo en mi ubicación
     GPS». Sin esta línea, una captura de la hoja no permite distinguir un
     error de la aplicación de un lápiz que se soltó sin querer, así que la
     conversación se queda en dos personas adivinando. Con ella, la foto
     contesta sola.

     Y sirve aunque el error no exista: saber a qué está anclada la cuenta es
     parte de leerla. */
  function bloqueDondeSeMidio(origen, meta) {
    if (!origen) return '';
    var donde = '';
    if (meta && isFinite(meta.lat) && isFinite(meta.lng)) {
      donde = ' (' + Number(meta.lat).toFixed(5) + ', ' + Number(meta.lng).toFixed(5) + ')';
    }
    return '<p class="pcr-pista pcr-origen">Se midió alrededor de <b>' +
      esc(comoSeEligioElCentro(origen)) + '</b>' + esc(donde) + '.</p>';
  }

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
  /* ── Qué es cada color de la red vial ──────────────────────────────────
     Llegó como pregunta y es la pregunta correcta: «qué es la línea verde,
     qué es la línea amarilla, qué es la línea naranja». La capa de jerarquía
     pinta seis colores sobre el mapa y hasta ahora la única leyenda estaba en
     el pliego impreso. Quien enciende la capa en el teléfono veía una maraña
     de colores sin nombre, que es lo mismo que no verla.

     Va con los kilómetros de cada clase cuando el trazado está medido: el
     color dice QUÉ es y el número dice CUÁNTO hay, y las dos juntas son la
     lectura —«este sector es todo local, con una sola arterial al norte»—. */
  function leyendaVial(vias) {
    var red = redPorJerarquia(vias || S.trzVias);
    var hay = red.length;
    return '<p class="pcr-lab">Qué es cada color de la red</p>' +
      '<div class="pcr-leyvial">' +
      JERARQUIA_VIAL.map(function (j) {
        var suya = red.filter(function (x) { return x.id === j.id; })[0];
        if (hay && !suya) return '';
        return '<span class="pcr-leyv' + (hay && !suya ? ' pcr-leyv-no' : '') + '">' +
          '<i style="background:' + j.color + '"></i>' +
          '<b>' + esc(j.etq) + '</b>' +
          (suya ? '<em>' + conComa(suya.km) + ' km</em>' : '') +
        '</span>';
      }).join('') +
      '</div>' +
      '<p class="pcr-pista">' +
      (hay
        ? 'Los kilómetros son los de este sector, medidos sobre el trazado. La troncal y la ' +
          'principal son las que traen gente de fuera; la local es la que se camina.'
        : 'Medí el trazado para ver la red pintada sobre el mapa y saber cuánto hay de cada clase.') +
      '</p>';
  }

  /* ── Por dónde pasa el transporte ──────────────────────────────────────
     «Hacer más detallado el análisis de movilidad, por dónde pasa el
     transporte público si es que pasa en esa zona».

     La lista de rutas dice CUÁLES sirven al sector y no dónde paran, que es
     la mitad que hace falta para proyectar: no es lo mismo tener el paradero
     en la esquina del lote que a seiscientos metros. Acá se cruzan las dos
     cosas que ya están medidas —las paradas, que vienen con coordenada, y las
     vías con nombre del trazado— y sale por qué calles pasa: la vía con
     nombre más cercana a cada parada, agrupadas.

     El corte a 60 m no es redondo por gusto: una parada se pone en el andén,
     así que a más de esa distancia de un eje ya no es «esa calle» sino la
     siguiente, y decir lo contrario mandaría a alguien a esperar el bus donde
     no para. Las que no caen cerca de ninguna vía con nombre se cuentan
     aparte, porque son justamente las que hay que ir a verificar. */
  function porDondePasa(res) {
    var pois = (res && res.pois) || [];
    var paradas = pois.filter(function (p) {
      return p.sub === 'parada_bus' && p.lat != null && p.lng != null;
    });
    if (!paradas.length) return null;
    var vias = (S.trzVias || []).filter(function (v) {
      return v.nombre && v.pts && v.pts.length >= 2;
    });
    var TOPE_M = 60;
    var porVia = {}, sueltas = 0;
    paradas.forEach(function (pa) {
      var mejor = null, mejorD = Infinity;
      vias.forEach(function (v) {
        var d = distanciaAPolilinea(pa, v.pts);
        if (d < mejorD) { mejorD = d; mejor = v; }
      });
      if (mejor && mejorD <= TOPE_M) {
        var k = mejor.nombre;
        if (!porVia[k]) porVia[k] = { nombre: k, n: 0, clase: mejor.clase };
        porVia[k].n++;
      } else { sueltas++; }
    });
    var lista = Object.keys(porVia).map(function (k) { return porVia[k]; })
      .sort(function (a, b) { return b.n - a.n; });
    return { total: paradas.length, ejes: lista, sueltas: sueltas,
             conVias: vias.length > 0 };
  }

  /* Distancia de un punto a una polilínea, en metros. Se proyecta sobre cada
     tramo y se toma la menor: medir contra los vértices sueltos daría la
     distancia al poste de la esquina y no a la calle. */
  function distanciaAPolilinea(pt, pts) {
    var kx = Math.cos(pt.lat * Math.PI / 180) * 111320, ky = 110540;
    var px = pt.lng * kx, py = pt.lat * ky, mejor = Infinity;
    for (var i = 1; i < pts.length; i++) {
      var ax = pts[i - 1].lng * kx, ay = pts[i - 1].lat * ky;
      var bx = pts[i].lng * kx, by = pts[i].lat * ky;
      var dx = bx - ax, dy = by - ay, largo = dx * dx + dy * dy;
      var t = largo > 0 ? ((px - ax) * dx + (py - ay) * dy) / largo : 0;
      t = Math.max(0, Math.min(1, t));
      var qx = ax + t * dx, qy = ay + t * dy;
      var d = Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy));
      if (d < mejor) mejor = d;
    }
    return mejor;
  }

  function bloquePorDonde(res) {
    var pd = porDondePasa(res);
    if (!pd) return '';
    if (!pd.conVias) {
      return '<p class="pcr-pista">Hay <b>' + pd.total + '</b> parada' +
        (pd.total === 1 ? '' : 's') + ' en el área. Para saber por qué calles pasan hay que ' +
        '<b>medir el trazado</b>: sin los ejes con nombre no hay contra qué cruzarlas.</p>';
    }
    if (!pd.ejes.length) {
      return '<p class="pcr-pista">Las <b>' + pd.total + '</b> parada' +
        (pd.total === 1 ? '' : 's') + ' del área no caen sobre ninguna vía con nombre registrado. ' +
        'Anotar en qué calle está cada paradero es tarea de campo, y de las que más sirven.</p>';
    }
    return '<p class="pcr-lab">Por dónde pasa el transporte</p>' +
      '<div class="pcr-ejes">' +
        pd.ejes.slice(0, 6).map(function (e) {
          var j = jerarquiaVialDe(e.clase);
          return '<div class="pcr-eje" style="--via:' + (j ? j.color : '#0A6F9E') + '">' +
            '<span class="pcr-eje-nom">' + esc(e.nombre) + '</span>' +
            '<span class="pcr-eje-n">' + e.n + ' parada' + (e.n === 1 ? '' : 's') + '</span>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<p class="pcr-pista">Cada parada se asignó a la vía con nombre más cercana, hasta 60 m: ' +
      'un paradero se pone en el andén, y más lejos de eso ya es otra calle. ' +
      (pd.sueltas
        ? '<b>' + pd.sueltas + '</b> parada' + (pd.sueltas === 1 ? ' no cae' : 's no caen') +
          ' cerca de ninguna vía con nombre: ahí hay que ir a mirar en qué calle están.'
        : 'Todas cayeron sobre una vía con nombre.') + '</p>';
  }

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
  /* Los dibujos viven en js/74 para que la lámina y el PDF los usen sin
     arrastrar nada de acá. Este atajo evita repetir la comprobación de que el
     módulo cargó en los seis sitios donde se dibuja. */
  function dib(nombre, a, b, c) {
    var D = window.URBIS_DIBUJO;
    if (!D || typeof D[nombre] !== 'function') return '';
    try { return D[nombre](a, b, c) || ''; } catch (e) { return ''; }
  }

  /* La rosa de los ocho rumbos con lo que hay mapeado en cada uno. La cuenta
     ya la hace zonasSinDatos; acá solo se ordena como la espera el dibujo. */
  function rosaDeLoMapeado(zonas) {
    if (!zonas || !zonas.cuenta) return '';
    return dib('rosaDeRumbos', RUMBOS.map(function (r) {
      return { id: r.id, nombre: r.nombre, n: zonas.cuenta[r.id] || 0 };
    }), { etiqueta: 'Rosa de los ocho rumbos del sector: cuántos usos mapeados hay en cada uno; ' +
          'los rumbos punteados no tienen ninguno' });
  }

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
  /* ── La amenaza sísmica ────────────────────────────────────────────────
     La única determinante de este análisis que viene de una norma y no de una
     medición. Por eso se dice de dónde sale y qué alcance tiene: es del
     municipio, no del lote, y no dimensiona nada. */
  /* El agua. Se dibuja aparte del sismo porque puede llegar sola: si el SGC
     está caído y el IDEAM contesta, quedarse sin mostrar la inundación por
     solidaridad con el otro servidor no le sirve a nadie. Devuelve cadena
     vacía cuando no hay nada que decir, así que se puede sumar sin condición
     en los dos caminos del bloque de amenaza. */
  function bloqueInundacion() {
    var inu = S.inundacion;
    if (!inu && S.inundacionAviso) {
      return '<p class="pcr-lab">La inundación</p>' +
        '<p class="pcr-ojo">No se pudo consultar el mapa de inundación del IDEAM: ' +
        esc(S.inundacionAviso) + ' Eso <b>no quiere decir que el lote no se inunde</b>: ' +
        'quiere decir que no se sabe.</p>';
    }
    if (!inu) return '';
    if (inu.sinDato) {
      return '<p class="pcr-lab">La inundación</p>' +
        '<p class="pcr-ojo">El servicio del IDEAM contestó, pero ninguna de sus capas de ' +
        'inundación se pudo leer. No se sabe.</p>';
    }
    /* El sitio no está modelado. Esto NO se pinta en verde ni se parece a
       «queda fuera de la mancha»: es la ausencia de un dato, y en una ficha
       una ausencia con cara de buena noticia es peor que un renglón vacío. */
    if (!inu.cobertura) {
      return '<p class="pcr-lab">La inundación</p>' +
        '<div class="pcr-kpis">' +
          '<div class="pcr-kpi"><b style="color:' + esc(inu.color) + '">Sin modelar</b>' +
          '<small>amenaza de inundación</small></div>' +
        '</div>' +
        '<p class="pcr-conc pcr-ojo">' + esc(inu.que) + ' <b>No quiere decir que no se ' +
        'inunde</b>: quiere decir que nadie lo midió con este mapa.</p>' +
        '<p class="pcr-pista">' + esc(inu.salvedad) + '</p>' +
        '<p class="pcr-pista">Se consultaron ' + inu.consultadas + ' capas y ninguna tiene ' +
        'un polígono en 30 km a la redonda. ' + esc(inu.fuente) + '.</p>';
    }
    var dentro = inu.trPeor != null;
    return '<p class="pcr-lab">La inundación</p>' +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b style="color:' + esc(inu.color) + '">' + esc(inu.nombre) +
          '</b><small>amenaza de inundación</small></div>' +
        (dentro
          ? '<div class="pcr-kpi"><b>' + inu.trPeor + ' años</b>' +
            '<small>periodo de retorno</small></div>'
          : '') +
      '</div>' +
      (dentro
        ? '<p class="pcr-conc">El lote cae dentro de la mancha de <b>' + inu.trPeor +
          ' años</b>: según el mapa nacional, se inunda <b>' + esc(inu.frecuencia) + '</b>. ' +
          esc(inu.que) + '</p>' +
          (inu.dentroDe.length > 1
            ? '<div class="pcr-lote">' + inu.dentroDe.map(function (tr) {
                return '<div class="pcr-lote-fila"><span>Mancha de ' + tr +
                  ' años</span><b>lo toca</b></div>';
              }).join('') + '</div>'
            : '') +
          (inu.creciente && inu.creciente.length
            ? '<p class="pcr-conc pcr-ojo">Además está en zona de <b>creciente súbita</b>. ' +
              'Eso no sube despacio y no da tiempo a sacar nada: llega de golpe. Cambia el ' +
              'proyecto entero, no solo la cota del primer piso.</p>'
            : '') +
          (inu.enLaDeCien
            ? '<p class="pcr-conc pcr-ojo">Está dentro de la mancha de <b>100 años</b>, que es ' +
              'con la que los POT delimitan suelo de protección por amenaza de inundación. ' +
              'Antes de dibujar nada, esto se verifica en la cartografía del POT vigente: si ' +
              'ahí también aparece, el lote puede no ser urbanizable.</p>'
            : '')
        : '<p class="pcr-conc">El sitio <b>sí está modelado</b> —' + inu.capasQueCubren +
          ' de ' + inu.consultadas + ' capas tienen manchas cerca— y el lote queda ' +
          '<b>fuera</b> de todas.</p>') +
      /* La salvedad va SIEMPRE, y con más razón cuando el resultado es
         «fuera»: es justo ahí donde alguien lo leería como un permiso. */
      '<p class="pcr-pista">' + esc(inu.salvedad) + '</p>' +
      (function () {
        /* Lo mismo que se hace con la remoción en masa: cruzar el dato
           nacional con algo medido de ESTE lote. Un terreno plano al lado de
           un río es otra conversación que uno en pendiente. */
        var pe = S.terreno && S.terreno.pendiente;
        if (!pe || pe.media == null) return '';
        var m = Number(pe.media);
        return '<p class="pcr-pista">La pendiente medida acá es <b>' +
          String(pe.media).replace('.', ',') + '%</b>. ' +
          (m < 3
            ? 'Terreno casi plano: el agua que llegue no se va sola, se queda. El desagüe ' +
              'no es un detalle técnico de después, es parte de la implantación.'
            : 'Con esa pendiente el agua corre; el problema se traslada a dónde va a parar ' +
              'y a qué hay aguas abajo.') + '</p>';
      })() +
      '<p class="pcr-pista">' + esc(inu.fuente) + '.</p>';
  }

  function bloqueAmenaza() {
    var am = S.amenaza;
    if (!am) {
      return h4('escudo', 'La amenaza sísmica') +
        '<p class="pcr-pista">El nivel de amenaza del municipio y los coeficientes <b>Aa</b> y ' +
        '<b>Av</b> con los que la NSR-10 arma el espectro de diseño. Es la determinante más dura ' +
        'del sitio y la única que viene de una norma.</p>' +
        '<div class="pcr-llevar">' +
          '<button type="button" data-pcr="amenaza" class="pcr-mini pcr-llevar-b"' +
            (S.amenazaCargando ? ' disabled' : '') + '>' +
            (S.amenazaCargando ? 'Consultando…' : ico('escudo') + 'Ver la amenaza sísmica') +
          '</button>' +
        '</div>' +
        (S.amenazaCargando
          ? '<p class="pcr-pista">El servidor del Servicio Geológico es lento: puede tardar ' +
            'medio minuto.</p>' : '') +
        (S.amenazaAviso && !S.amenazaCargando
          ? '<p class="pcr-error">' + esc(S.amenazaAviso) + '</p>' : '') +
        bloqueInundacion();
    }
    var D = window.URBIS_DIBUJO;
    var dib = '';
    try { dib = (D && D.curvaDeAmenaza) ? D.curvaDeAmenaza(am.curva) : ''; } catch (e) { dib = ''; }
    return h4('escudo', 'La amenaza sísmica') +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b style="color:' + esc(am.color) + '">' + esc(am.nivel) +
          '</b><small>amenaza sísmica</small></div>' +
        (am.aa != null ? '<div class="pcr-kpi"><b>' + String(am.aa).replace('.', ',') +
          '</b><small>Aa</small></div>' : '') +
        (am.av != null ? '<div class="pcr-kpi"><b>' + String(am.av).replace('.', ',') +
          '</b><small>Av</small></div>' : '') +
      '</div>' +
      /* Cómo se siente, en palabras. Va ANTES de los coeficientes: «Aa =
         0,35» no le dice nada a alguien de primer año, y «se siente fuerte»
         sí. Es la misma amenaza contada de la única manera que se puede
         llevar a una discusión de taller. */
      (am.intensidad
        ? '<p class="pcr-conc">Un sismo acá <b>se siente ' +
          esc(am.intensidad.percepcion.toLowerCase()) + '</b>, con potencial de daño <b>' +
          esc(am.intensidad.potencial.toLowerCase()) + '</b>. Es la misma amenaza de arriba ' +
          'dicha en palabras, que es como se discute en un taller.</p>'
        : '') +
      (am.pide ? '<p class="pcr-conc">' + esc(am.pide) + ' El sistema estructural lo decide un ' +
        'ingeniero; lo que le toca al taller es saber que el edificio está en amenaza <b>' +
        esc(am.nivel.toLowerCase()) + '</b> y proyectar en consecuencia: regularidad en planta y ' +
        'en altura, juntas, y nada de plantas bajas sin muros.</p>' : '') +
      (dib ? '<div class="pcr-dibujo">' + dib + '</div>' : '') +
      '<div class="pcr-lote">' +
        am.curva.map(function (p) {
          return '<div class="pcr-lote-fila"><span>Cada ' + p.tr + ' años</span><b>' +
            p.gal + ' gal · ' + String(p.g).replace('.', ',') + ' g</b></div>';
        }).join('') +
        (am.ae != null ? '<div class="pcr-lote-fila"><span>Ae · umbral de daño</span><b>' +
          String(am.ae).replace('.', ',') + '</b></div>' : '') +
        (am.ad != null ? '<div class="pcr-lote-fila"><span>Ad · seguridad limitada</span><b>' +
          String(am.ad).replace('.', ',') + '</b></div>' : '') +
      '</div>' +
      // La discrepancia entre las dos capas del SGC. Se dice, no se decide.
      (am.discrepan && am.discrepan.length
        ? '<p class="pcr-conc pcr-cabe-no">Las dos capas del SGC no coinciden en ' +
          am.discrepan.map(function (d) {
            return '<b>' + esc(d.cual) + '</b> (' + String(d.normativa).replace('.', ',') +
              ' contra ' + String(d.mapa).replace('.', ',') + ')'; }).join(' ni en ') +
          '. Acá se muestra el de la capa de <b>zonas NSR-10</b>, que es la que existe para ' +
          'servir la norma; la otra los trae como dato secundario de un mapa de aceleraciones. ' +
          'Antes de meterlo en un cálculo, verificalo contra la tabla A.2.3-2.</p>'
        : '') +
      // Movimientos en masa. Va después del sismo porque en una ciudad de
      // laderas pesa más, y el orden de lectura de una ficha es de lo general
      // a lo que de verdad decide.
      (am.masa
        ? '<p class="pcr-lab">Movimientos en masa</p>' +
          '<div class="pcr-llenos">' +
            '<div class="pcr-llenos-barra">' +
              am.masa.categorias.map(function (c) {
                return '<i style="width:' + Math.min(100, c.pct) + '%;background:' +
                  esc(c.color) + '"></i>';
              }).join('') +
            '</div>' +
            '<div class="pcr-llenos-cifras">' +
              am.masa.categorias.filter(function (c) { return c.pct > 0; }).map(function (c) {
                return '<span><b>' + String(c.pct).replace('.', ',') + '%</b> ' +
                  esc(c.nombre.toLowerCase()) + '</span>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<p class="pcr-conc"><b>' + String(am.masa.altaOMasPct).replace('.', ',') +
          '%</b> del municipio de ' + esc(am.masa.municipio) + ' está en amenaza alta o muy ' +
          'alta por movimientos en masa. Pero eso son sus ' +
          Math.round(am.masa.areaKm2).toLocaleString('es-CO') + ' km² enteros, casi todos de ' +
          'ladera rural: <b>no dice nada de este lote</b>. A escala ' + esc(am.masa.escala) +
          ' un predio no se alcanza a leer.</p>' +
          (function () {
            /* Lo único que sí habla del lote es la pendiente, que URBIS ya
               mide. Cruzarlas es lo que convierte una cifra de contexto en
               una pregunta concreta para la salida de campo. */
            var pe = S.terreno && S.terreno.pendiente;
            if (!pe || pe.media == null) {
              return '<p class="pcr-pista">Lo que sí se puede medir de este sitio es su ' +
                'pendiente: medí el terreno y volvé acá.</p>';
            }
            var m = Number(pe.media);
            return '<p class="pcr-pista">Del lote, lo que sí está medido es la pendiente: <b>' +
              String(pe.media).replace('.', ',') + '%</b> de media. ' +
              (m >= 25
                ? 'Con esa pendiente, en un municipio así, la estabilidad del terreno es una ' +
                  'pregunta de proyecto y no un trámite: pide estudio de suelos.'
                : m >= 12
                  ? 'Es una pendiente que se maneja, pero conviene mirar en campo si hay ' +
                    'taludes cortados o llenos sin compactar cerca.'
                  : 'Es terreno suave: lo que pasa en las laderas del municipio no le llega ' +
                    'a este lote.') + '</p>';
          })() +
          '<p class="pcr-pista">' + esc(am.masa.categorias.length ?
            'Los porcentajes son los que publica el servicio y suman ' +
            String(am.masa.sumaPct).replace('.', ',') + '%, no cien exactos.' : '') +
          ' ' + esc(am.masa.fuente) + '.</p>'
        : '') +
      '<p class="pcr-pista">Referido a <b>' + esc(am.municipio) + '</b> (' +
      esc(am.departamento) + ')' +
      (am.distanciaM != null ? ', cuyo punto de referencia está a ' +
        (am.distanciaM >= 1000 ? (Math.round(am.distanciaM / 100) / 10) + ' km'
                               : am.distanciaM + ' m') + ' del sector' : '') +
      '. <b>Es un valor del municipio, no del lote</b>: la NSR-10 da Aa y Av por municipio y esta ' +
      'capa es un punto por cabecera. Si Cúcuta llega a tener microzonificación sísmica, manda ' +
      'esa y no esto. El SGC publica la aceleración en gal (cm/s²); dividida por 981 da los g de ' +
      'la norma.</p>' +
      bloqueInundacion() +
      '<div class="pcr-llevar">' +
        '<button type="button" data-pcr="amenaza-texto" class="pcr-mini">' +
          ico('copiar', 16) + 'Copiar para la memoria</button>' +
      '</div>' +
      '<p class="pcr-pista">' + esc(am.fuente) + '.</p>';
  }

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
  /* El corte del terreno. Antes se estiraba hasta llenar la caja y no decía
     cuánto: una loma de tres metros y un barranco de ochenta salían con la
     misma silueta. Ahora lo dibuja js/74 con escala horizontal real y la
     exageración vertical escrita en el propio dibujo. Se conserva la firma
     —recibe un perfil del motor— para que los sitios que ya lo llamaban no
     tengan que enterarse. */
  function perfilDibujado(p) {
    var nuevo = dib('corteTopografico', { etiqueta: (p && p.etiqueta) || '', puntos: (p && p.puntos) || [] });
    if (nuevo) return '<div class="pcr-corte-caja">' + nuevo + '</div>';
    return perfilDibujadoViejo(p);
  }

  /* El dibujo de antes queda como respaldo por si js/74 no cargó: sin él, un
     fallo al cargar un archivo dejaría el bloque del terreno sin ningún
     corte, que es peor que un corte sin escala. */
  function perfilDibujadoViejo(p) {
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

      /* Las curvas de nivel: el mismo terreno leído por planta. Un corte dice
         cómo sube el terreno por una línea; las curvas lo dicen por todo el
         plano, y son las que se calcan para proyectar. */
      (function () {
        var cv = S.curvas || (S.curvas = curvasDelTerreno());
        if (!cv) return '';
        if (cv.plano) {
          return '<p class="pcr-lab">Curvas de nivel</p>' +
            '<p class="pcr-pista">El sector es plano —menos de un metro entre lo más alto y lo más ' +
            'bajo—, así que no hay curvas que dibujar. Eso también es un dato: acá la topografía ' +
            'no condiciona nada.</p>';
        }
        var n2 = cv.curvas.length;
        return '<p class="pcr-lab">Curvas de nivel</p>' +
          '<p class="pcr-conc"><b>' + n2 + '</b> curva' + (n2 === 1 ? '' : 's') + ' cada <b>' +
          cv.intervalo + ' m</b>, entre los ' + cv.zMin + ' y los ' + cv.zMax + ' msnm. Las de cota ' +
          'redonda —cada ' + (cv.intervalo * 5) + ' m— van más gruesas.</p>' +
          '<div class="pcr-llevar">' +
            '<button type="button" data-pcr="curvas-mapa" class="pcr-mini pcr-llevar-b">' +
              (S.curvasEnMapa ? ico('apagar', 16) + 'Quitar las curvas del mapa'
                              : ico('mapa', 16) + 'Ver las curvas en el mapa') +
            '</button>' +
          '</div>' +
          /* El intervalo, a elegir. Se pidió a 2 m; se ofrecen los que el
             desnivel admite sin pasar de ochenta curvas, y el más fino
             siempre lleva al lado lo que es: interpolación de un modelo de
             90 m. Elegirlo es del estudiante; decirlo, de la aplicación. */
          '<div class="pcr-curvas-pasos"><span class="pcr-capas-lab">Cada</span>' +
            PASOS_CURVAS.filter(function (pz) {
              var n = (cv.zMax - cv.zMin) / pz; return n >= 3 && n <= 80;
            }).map(function (pz) {
              var on = pz === cv.intervalo;
              return '<button type="button" class="pcr-cal-chip' + (on ? ' on' : '') + '" ' +
                'data-pcr="curvas-paso" data-paso="' + pz + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
                pz + ' m</button>';
            }).join('') +
          '</div>' +
          '<p class="pcr-pista">Salen de un modelo de <b>' + cv.resolucionM + ' m de paso</b>: entre dos ' +
          'cotas medidas, la curva es interpolación. Dibujan la <b>forma del sector</b>, no el ' +
          'detalle de una manzana' + (cv.intervalo < 10 ? ' —y a ' + cv.intervalo + ' m, menos todavía—' : '') +
          '. Para un anteproyecto sirven para decidir por dónde entra el acceso y hacia dónde se ' +
          'aterraza; para replantear hace falta topografía de campo.</p>';
      })() +

      '<p class="pcr-lab">Cortes del terreno</p>' +
      (t.perfiles || []).map(perfilDibujado).join('') +
      /* El botón va justo debajo de las siluetas, no en la barra de capas de
         arriba: es acá donde alguien se pregunta «¿y por dónde cortó?». */
      ((t.perfiles || []).some(function (p) { return p.traza && p.traza.length >= 2; })
        ? '<div class="pcr-llevar">' +
            '<button type="button" data-pcr="cortes-mapa" class="pcr-mini pcr-llevar-b">' +
              ico(S.cortesEnMapa ? 'apagar' : 'capas', 16) +
              (S.cortesEnMapa ? 'Quitar las líneas del mapa'
                              : 'Ver por dónde van los cortes') + '</button>' +
          '</div>'
        : '<p class="pcr-pista">Este análisis no trae por dónde se cortó: volvé a medir el ' +
          'terreno y las líneas A–A′ y B–B′ se podrán ver sobre el mapa.</p>') +
      /* Cortar por donde uno diga. Los dos del motor van por el medio del
         rectángulo; un proyecto se corta por donde el terreno decide algo. */
      (S.terRejilla
        ? '<div class="pcr-llevar">' +
            '<button type="button" data-pcr="corte-nuevo" class="pcr-mini pcr-llevar-b">' +
              ico('lapiz', 16) + 'Cortar por donde yo diga</button>' +
          '</div>' +
          '<p class="pcr-pista">Dos toques en el mapa —dónde empieza y dónde termina— y sale ' +
          'el corte con su letra: <b>C–C′</b>, <b>D–D′</b>, y así. Lo calcula el teléfono con ' +
          'las cotas que ya están guardadas: no hace falta señal.</p>'
        : '') +
      (S.corteAviso ? '<p class="pcr-error">' + esc(S.corteAviso) + '</p>' : '') +
      (function () {
        var mios = (t.perfiles || []).filter(function (p) { return p.aMano; });
        if (!mios.length) return '';
        return '<div class="pcr-lote">' +
          mios.map(function (p) {
            return '<div class="pcr-lote-fila">' +
              '<span>' + esc(p.marca + '–' + p.marcaFin) + ' · ' + p.largoM + ' m</span>' +
              '<button type="button" data-pcr="corte-borrar" data-c="' + esc(p.id) +
                '" class="pcr-mini">' + ico('cerrar', 14) + 'Quitar</button>' +
            '</div>';
          }).join('') +
        '</div>';
      })() +

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

    /* Midió, pero no encontró nada. Antes esto se pintaba como una medición:
       «0 km de vía», «0% en un sentido», y una barra de llenos y vacíos con
       las dos mitades en cero. La ficha llegaba a contradecirse sola —decía
       «sin vías con forma registrada» y tres renglones más abajo ponía «0 km»
       como si lo hubiera contado—.

       Y acá el vacío no es un callejón: es el principio del trabajo de campo,
       que es de lo que trata el módulo. Así que se dice y se ofrece salir a
       levantarlo. */
    if (trazadoSinDatos(t)) {
      return h4('capas', 'El trazado del sector') +
        '<p class="pcr-conc pcr-ojo"><b>Acá no hay nada mapeado.</b> ' + esc(TRAZADO_VACIO) +
        '</p>' +
        '<p class="pcr-pista">Es la mejor noticia que puede dar este módulo para una salida ' +
        'de campo: un sector sin mapear es uno donde lo que ustedes levanten no lo tenía ' +
        'nadie. Dibujen las manzanas y las calles en el mapa, y con «llevar a JOSM» eso ' +
        'vuelve a OpenStreetMap para todo el mundo.</p>' +
        '<div class="pcr-llevar">' +
          '<button type="button" data-pcr="trazado" class="pcr-mini"' +
            (S.trzCargando ? ' disabled' : '') + '>' +
            ico('area') + 'Volver a medir</button>' +
        '</div>';
    }

    var ll = t.llenos || {}, vi = t.vias || {}, mo = t.morfologia || {};
    var mallas = vi.porMalla || [];
    /* Llenos y vacíos con TÍTULO propio y no como una etiqueta dentro del
       trazado. En la lámina siempre fue una caja con su nombre; acá era una
       línea pequeña en mitad de un bloque largo, y se buscó sin encontrarla:
       «no vi los llenos y vacíos». Lo que tiene nombre en el papel tiene que
       tener nombre en la pantalla. */
    return h4('area', 'Llenos y vacíos') +
      /* Cien cuadraditos al lado de la barra: la barra dice la proporción, la
         trama la deja contar. Es el mismo dato dos veces a propósito — uno se
         lee de cerca y el otro de lejos, colgado en la pared. */
      '<div class="pcr-dibujo pcr-dibujo-fila">' +
        dib('trama', ll.pctLleno, { etiqueta: ll.pctLleno + ' de cada cien metros cuadrados del ' +
             'sector están construidos' }) +
        '<p class="pcr-dibujo-pie">De cada cien metros cuadrados del sector, <b>' + ll.pctLleno +
        '</b> están construidos.</p>' +
      '</div>' +
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
      /* Y lo mismo, pero leído de la foto. Las huellas de OpenStreetMap son
         las que alguien dibujó; la foto es lo que hay. En Cúcuta la diferencia
         es media ciudad, y era la queja: «aún hay manzanas que no lee». */
      bloqueLlenosFoto() +
      h4('capas', 'El trazado del sector') +
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
      /* Lo que estas cifras SON: lo que OpenStreetMap tiene dibujado, no lo
         construido de verdad. Llegó en captura, comparado con la foto
         satelital: «no cuadran en nada». No cuadran porque en Cúcuta faltan
         manzanas enteras por mapear, y un porcentaje calculado sobre lo
         mapeado sale bajo sin que nada lo diga. Con la foto leída se puede
         acotar por arriba: la superficie dura de la foto incluye calles y
         techos, así que lo construido está entre lo mapeado y eso. */
      (function () {
        var dura = null;
        try {
          var cl = (S.cobertura && S.cobertura.clases) || [];
          var c = cl.filter(function (x) { return x.id === 'construido'; })[0];
          if (c && isFinite(c.pct)) dura = Math.round(c.pct);
        } catch (e) { dura = null; }
        return '<p class="pcr-conc pcr-ojo"><b>Es lo que OpenStreetMap tiene dibujado, no lo construido ' +
          'de verdad.</b> Donde falten edificios por mapear —y en Cúcuta faltan manzanas enteras— el ' +
          'porcentaje sale bajo. ' +
          (dura != null
            ? 'La foto satelital dice que el <b>' + dura + '%</b> del área es superficie dura, calles ' +
              'incluidas: lo construido está <b>entre el ' + ll.pctLleno + '% y el ' + dura + '%</b>.'
            : 'Leé la foto satelital y esta cifra se acota por arriba con la superficie dura que se ve.') +
          ' Para la lámina, lo honesto es dibujar los llenos calcando la foto, que es lo que se hace a ' +
          'mano, y usar este número como piso.</p>';
      })() +

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
  /* ── Lo que falta para que el análisis hable ───────────────────────────
     Media docena de bloques de esta ficha terminan diciendo lo mismo: «esto
     no se puede medir porque nadie lo mapeó». Dicho bloque por bloque, cada
     aviso parece una limitación de la aplicación. Juntos y ordenados, son
     otra cosa: la lista de tareas de la salida a campo, con el detalle de qué
     enciende cada una.

     Y encienden en cadena. Contar los pisos de cuatro construcciones no
     agrega «un dato»: agrega el perfil de la calle, las alturas y la sombra
     sobre el lote, tres bloques que hoy están vacíos. Eso es lo que esta
     lista dice y ninguna otra parte de la ficha decía.

     El orden no es por importancia sino por RENDIMIENTO: lo que enciende más
     cosas con menos trabajo va primero, porque una salida a campo dura una
     mañana y hay que decidir en qué se gasta. */
  function faltantesDelSector(st) {
    var trz = S.trazado;
    var lista = [];
    var alt = (st && st.alturas) || {};
    var perf = trz && trz.perfil;
    var vi = (trz && trz.vias) || {};
    var ll = (trz && trz.llenos) || {};
    var esp = trz && trz.espacio;

    function item(o) { lista.push(o); }

    /* ── Los pisos: es el dato que más cosas enciende de una sola vez.

       La cuenta sale del TRAZADO y no del inventario de usos: la consulta de
       usos excluye `building=yes` a propósito —si no, cada casa entraría como
       un uso— así que ahí los edificios ni aparecen. Los que valen son los
       que trajeron forma, que son los que se pueden contar desde la acera. */
    var edificiosTrz = ll.edificios || alt.edificios || 0;
    var pctAltura = (perf && perf.coberturaAltura != null) ? perf.coberturaAltura
                  : (alt.cobertura != null ? alt.cobertura : null);
    if (edificiosTrz && pctAltura != null && pctAltura < 100) {
      var sin = Math.max(1, Math.round(edificiosTrz * (100 - pctAltura) / 100));
      var vecinos = null;
      try {
        var so = S.sombras || (S.lote && S.lote.length >= 3 ? sombrasDelLote() : null);
        vecinos = so ? (so.vecinosSinPisos || 0) : null;
      } catch (e) { vecinos = null; }
      item({
        id: 'pisos', etiqueta: 'building:levels',
        titulo: 'Contar los pisos de los edificios',
        cuantos: sin + ' de ' + edificiosTrz + ' sin altura registrada (' + pctAltura +
                 '% la trae)',
        enciende: ['El perfil de la calle', 'Alturas de lo construido', 'La sombra de los vecinos'],
        como: 'Se cuentan desde la acera y se anotan como <b>building:levels</b>. Un piso es un ' +
              'piso: el altillo cuenta, la terraza no.',
        cuesta: vecinos != null && vecinos > 0
          ? 'Los ' + vecinos + ' que rodean el lote son media hora y ya encienden la sombra.'
          : 'Una cuadra entera son unos veinte minutos.',
        peso: 3
      });
    }

    // ── El ancho de la calzada.
    if (perf && (perf.coberturaAncho == null || perf.coberturaAncho < 60)) {
      item({
        id: 'ancho', etiqueta: 'width / lanes',
        titulo: 'Medir el ancho de la calzada',
        cuantos: (perf.coberturaAncho || 0) + '% de las vías lo trae' +
                 (perf.viasConWidth || perf.viasConLanes
                   ? ' (' + (perf.viasConWidth || 0) + ' con ancho, ' + (perf.viasConLanes || 0) + ' con carriles)'
                   : ''),
        enciende: ['El perfil de la calle: la relación altura ÷ ancho'],
        como: 'Con cinta o contando carriles: <b>width=8</b> en metros, o <b>lanes=2</b>. Es de ' +
              'calzada a calzada, sin contar el andén.',
        cuesta: 'Tres o cuatro calles distintas alcanzan: el resto se parece.',
        peso: 2
      });
    }

    // ── El andén, que es de lo que menos hay y más se camina.
    if (perf && perf.anden && perf.anden.sinDatoPct > 20) {
      item({
        id: 'anden', etiqueta: 'sidewalk',
        titulo: 'Anotar dónde hay andén y dónde no',
        cuantos: String(perf.anden.sinDatoPct).replace('.', ',') + '% de las vías sin dato',
        enciende: ['Hasta dónde se llega caminando', 'A distancia de caminar'],
        como: '<b>sidewalk=both</b>, <b>left</b>, <b>right</b> o <b>no</b> en cada tramo. Sin andén ' +
              'no es lo mismo que sin dato, y hoy el mapa no los distingue.',
        cuesta: 'Se anota caminando, sin instrumentos.',
        peso: 2
      });
    }

    // ── Los parques sin forma: sin polígono no hay metros cuadrados.
    if (esp && !esp.piezas) {
      item({
        id: 'espacio', etiqueta: 'leisure=park',
        titulo: 'Dibujar los parques, plazas y canchas',
        cuantos: 'ninguno tiene forma registrada en el área',
        enciende: ['Espacio público efectivo', 'El indicador del Decreto 1504'],
        como: 'Se dibuja el polígono del parque —no un punto— y se etiqueta <b>leisure=park</b>, ' +
              '<b>pitch</b> o <b>place=square</b> según lo que sea.',
        cuesta: 'Un parque son cuatro esquinas y dos minutos.',
        peso: 3
      });
    }

    // ── Calles sin nombre: es lo que le da frentes al lote.
    if (vi.sinNombre) {
      item({
        id: 'nombres', etiqueta: 'name',
        titulo: 'Ponerle nombre a las calles que no lo tienen',
        cuantos: vi.sinNombre + ' tramo' + (vi.sinNombre === 1 ? '' : 's') + ' sin nombre',
        enciende: ['Los frentes del lote', 'El plan de la salida'],
        como: 'El nombre de la placa, tal cual: <b>name=Calle 12</b>. Si no hay placa, se anota lo ' +
              'que dice la gente y se marca para verificar.',
        cuesta: 'Se levanta de paso, mientras se camina.',
        peso: 1
      });
    }

    // ── Edificios mapeados como punto.
    if (ll.sinGeometria) {
      item({
        id: 'huellas', etiqueta: 'building',
        titulo: 'Dibujar la huella de los edificios que son solo un punto',
        cuantos: ll.sinGeometria + ' sin forma, de ' + (ll.edificios || 0),
        enciende: ['Llenos y vacíos', 'Área construida'],
        como: 'Se calca el contorno sobre la foto satelital y se etiqueta <b>building=yes</b>. Esto ' +
              'se puede hacer en el escritorio, sin salir.',
        cuesta: 'No es trabajo de campo: es una tarde de calcar.',
        peso: 1
      });
    }

    // ── Vivienda sin registrar: es lo que desfigura la mezcla de usos.
    var g = (st && st.porGrupo) || {};
    var totalUsos = Object.keys(g).reduce(function (a, k) { return a + (g[k] || 0); }, 0);
    var viv = g.vivienda || 0;
    if (totalUsos >= 10 && viv / totalUsos < 0.15) {
      item({
        id: 'vivienda', etiqueta: 'building=residential',
        titulo: 'Registrar la vivienda',
        cuantos: viv + ' de ' + totalUsos + ' usos son vivienda (' +
                 Math.round(100 * viv / totalUsos) + '%)',
        enciende: ['El índice de mezcla de usos', 'La lectura de qué uso manda'],
        como: 'En OpenStreetMap el comercio está mucho mejor mapeado que la casa donde vive la ' +
              'gente, así que un barrio residencial sale monofuncional al revés. Se corrige ' +
              'etiquetando <b>building=residential</b> o <b>house</b>.',
        cuesta: 'Es la tarea más larga, y la que más cambia el diagnóstico.',
        peso: 2
      });
    }

    /* El orden: primero lo que enciende más bloques. A igualdad, lo que
       cuesta menos —el peso lo dice—. */
    lista.sort(function (a, b) {
      return (b.enciende.length * 10 + b.peso) - (a.enciende.length * 10 + a.peso);
    });
    return lista;
  }

  /* ── Qué le pide el sitio al proyecto ──────────────────────────────────
     Todo lo medido hasta acá describe el lugar. Esto es el paso siguiente y
     el que un curso de proyectos necesita: pasar de «el terreno baja al
     suroccidente» a «el agua entra por ahí, y el proyecto tiene que decir qué
     hace con ella».

     Son determinantes, no propuestas. Cada una nace de una medición concreta
     —y la cita— y ninguna dice qué construir: dicen a qué hay que responder.
     La respuesta es del estudiante, y por eso el bloque termina diciéndolo con
     todas las letras. Una aplicación que dictara el partido arquitectónico le
     estaría haciendo la tarea a quien está aprendiendo a hacerla. */
  function determinantesDelLote(st) {
    var a = (function () { try { return analisisDelLote(); } catch (e) { return null; } })();
    if (!a) return [];
    var lista = [];
    function D(o) { lista.push(o); }

    // ── El sol de la tarde: la fachada que hay que proteger.
    if (a.critica) {
      D({ id: 'sol', icono: 'brujula',
          titulo: 'Proteger la fachada de la tarde',
          dice: 'El lado ' + a.critica.i + (a.critica.via ? ' (' + esc(a.critica.via) + ')' : '') +
                ' mira al ' + esc((a.critica.mira && a.critica.mira.nombre) || 'occidente') +
                '. En el trópico el sol de la tarde entra casi horizontal por ahí: es la fachada ' +
                'que se calienta, y la que ningún alero resuelve —contra el sol bajo sirve el ' +
                'quiebrasol vertical, la doble piel o simplemente no abrir ahí—.',
          porque: 'de la orientación medida de cada lado del lote' });
    }

    // ── La sombra de los vecinos: dónde NO poner lo que necesita sol.
    var so = S.sombras || (function () { try { return sombrasDelLote(); } catch (e) { return null; } })();
    if (so && so.horas && so.horas.length) {
      var manana = so.horas.filter(function (h) { return h.hora === 9; })[0];
      var tarde = so.horas.filter(function (h) { return h.hora === 15; })[0];
      var maxPct = so.horas.reduce(function (m, h) { return Math.max(m, h.pctLote); }, 0);
      if (maxPct >= 15) {
        D({ id: 'sombra', icono: 'brujula',
            titulo: 'Contar con la sombra de al lado',
            dice: 'Los vecinos tapan hasta el ' + maxPct + '% del lote' +
                  (manana && tarde
                    ? ' (' + manana.pctLote + '% a las 9, ' + tarde.pctLote + '% a las 15)'
                    : '') +
                  '. Un patio o una huerta puestos en esa franja no van a recibir sol; los ' +
                  'espacios que sí lo necesitan tienen que ir en la parte que queda libre.',
            porque: 'de proyectar las huellas de ' + so.vecinos + ' edificios vecinos con sus pisos' });
      } else if (so.vecinos) {
        D({ id: 'sombra', icono: 'brujula',
            titulo: 'El sol llega al lote todo el día',
            dice: 'Los vecinos apenas tapan el ' + maxPct + '% del lote. Eso es una ventaja y a la ' +
                  'vez el problema: sin sombra de nadie, la sombra hay que ponerla en el proyecto.',
            porque: 'de proyectar las huellas de los vecinos con sus pisos' });
      }
    }

    // ── El agua y la pendiente.
    var tl = (function () { try { return terrenoDelLote(); } catch (e) { return null; } })();
    if (tl && tl.baja) {
      D({ id: 'agua', icono: 'crecer',
          titulo: 'Sacar el agua hacia el ' + esc(tl.baja.nombre),
          dice: 'El terreno bajo el lote baja hacia el ' + esc(tl.baja.nombre) +
                (tl.pendientePct != null ? ', con ' + tl.pendientePct + '% de pendiente' : '') +
                '. Por ahí corre el agua de lluvia: es donde va el drenaje y donde NO conviene ' +
                'enterrar nada. Si la pendiente pasa del 15%, la plataforma se paga en muros.',
          porque: 'del modelo de elevación, con ' + tl.resolucionM + ' m de paso' });
    }

    // ── El acceso: por dónde entra, según la jerarquía de sus frentes.
    if ((a.frentes || []).length) {
      var vias = S.trzVias || [];
      var claseDe = function (nombre) {
        var v = vias.filter(function (x) { return x.nombre === nombre; })[0];
        return v ? v.clase : '';
      };
      var RANGO = { motorway: 6, trunk: 6, primary: 5, secondary: 4, tertiary: 3,
                    residential: 2, unclassified: 2, living_street: 1, service: 1, pedestrian: 1 };
      var ordenados = a.frentes.slice().sort(function (x, y) {
        return (RANGO[claseDe(y.via)] || 2) - (RANGO[claseDe(x.via)] || 2) || y.metros - x.metros;
      });
      var mayor = ordenados[0], menor = ordenados[ordenados.length - 1];
      var jerarquia = RANGO[claseDe(mayor.via)] || 2;
      if (a.esquinero && ordenados.length > 1 && jerarquia >= 4) {
        D({ id: 'acceso', icono: 'movilidad',
            titulo: 'Separar el acceso del ruido',
            dice: 'El lote da a ' + ordenados.length + ' calles. ' + esc(mayor.via) + ' es la de ' +
                  'mayor jerarquía —' + mayor.metros + ' m de frente—: por ahí llega la gente y ' +
                  'también el ruido. ' + esc(menor.via) + ' es la tranquila. Un acceso peatonal por ' +
                  'la primera y lo que pida silencio hacia la segunda es la decisión que este lote ' +
                  'permite y un medianero no.',
            porque: 'de la jerarquía vial medida en el trazado y de los frentes del lote' });
      } else {
        D({ id: 'acceso', icono: 'movilidad',
            titulo: 'Un solo frente: todo entra por ' + esc(mayor.via),
            dice: mayor.metros + ' m de frente sobre ' + esc(mayor.via) + ' y ' +
                  (a.sinFrenteM ? a.sinFrenteM + ' m de medianera' : 'el resto medianero') +
                  '. Acceso, servicio y fachada comparten el mismo lado: separarlos en planta es ' +
                  'parte del problema, no un detalle.',
            porque: 'de los frentes medidos contra las calles registradas' });
      }
    }

    // ── El viento, si el clima está medido.
    var cli = S.clima, vi = cli && cli.viento;
    if (vi && vi.dominante && vi.dominante.pct >= 25) {
      D({ id: 'viento', icono: 'nube',
          titulo: 'Abrir al viento del ' + esc(vi.dominante.rumbo),
          dice: 'El viento dominante viene del ' + esc(vi.dominante.rumbo) + ' el ' +
                vi.dominante.pct + '% del tiempo. En un clima como este la ventilación cruzada no ' +
                'es un extra: es lo que decide si adentro se puede estar sin aire acondicionado.',
          porque: 'de varios años de registro climático, ponderado por velocidad' });
    }

    // ── Qué le falta al barrio, que es lo que el proyecto podría aportar.
    var acc = st && st.accesibilidad;
    if (acc && acc.categorias) {
      var faltan = acc.categorias.filter(function (c) { return c.pctCubierto < 40; })
        .sort(function (x, y) { return x.pctCubierto - y.pctCubierto; });
      if (faltan.length) {
        D({ id: 'programa', icono: 'campo',
            titulo: 'Lo que el barrio no tiene cerca',
            dice: faltan.map(function (c) {
              return esc(c.etiqueta.toLowerCase()) + ' (' + String(c.pctCubierto).replace('.', ',') +
                     '% del área lo tiene a ' + c.minutos + ' min)';
            }).join(', ') + '. No es una orden de programa: es lo que este sector le pediría a ' +
            'cualquier cosa que se construya, y lo que permite defender un uso frente a otro.',
            porque: 'del muestreo de cobertura sobre el área analizada' });
      }
    }

    return lista;
  }

  function bloqueDeterminantes(st) {
    var lista = determinantesDelLote(st);
    if (!S.lote || S.lote.length < 3) return '';
    if (!lista.length) return '';
    return h4('destello', 'Qué le pide el sitio al proyecto') +
      '<p class="pcr-tarea-intro">Hasta acá el análisis describe el lugar. Esto es lo otro: las ' +
      '<b>condiciones que el sitio impone</b> y a las que el proyecto tiene que responder. Cada una ' +
      'sale de una medición de esta misma ficha.</p>' +
      '<div class="pcr-deter">' +
        lista.map(function (d) {
          return '<div class="pcr-deter-item">' +
            '<div class="pcr-deter-cab">' + ico(d.icono, 18) + '<b>' + d.titulo + '</b></div>' +
            '<p class="pcr-deter-dice">' + d.dice + '</p>' +
            '<p class="pcr-deter-porque">Sale ' + esc(d.porque) + '.</p>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<p class="pcr-conc">Ninguna de estas dice <b>qué</b> construir. Dicen a qué hay que ' +
      'responder: la respuesta es el proyecto, y esa es tuya.</p>';
  }

  function determinantesComoTexto(st) {
    var lista = determinantesDelLote(st);
    if (!lista.length) return '';
    var quitar = function (t) { return String(t).replace(/<[^>]+>/g, ''); };
    var L = ['QUÉ LE PIDE EL SITIO AL PROYECTO'];
    lista.forEach(function (d) {
      L.push('  · ' + quitar(d.titulo));
      L.push('    ' + quitar(d.dice));
    });
    L.push('  Ninguna dice qué construir: dicen a qué hay que responder.');
    return L.join('\n');
  }

  function determinantesImpresas(st) {
    var lista = determinantesDelLote(st);
    if (!lista.length) return '';
    return '<h2>Qué le pide el sitio al proyecto</h2><table class="plan">' +
      lista.map(function (d) {
        return '<tr><td class="g"><b>' + d.titulo + '</b></td><td>' + d.dice +
          ' <em>' + esc(d.porque) + '</em></td></tr>';
      }).join('') +
      '</table><p class="pie">Son determinantes, no propuestas: ninguna dice qué construir, dicen ' +
      'a qué hay que responder.</p>';
  }

  /* ── Las capas del mapa ────────────────────────────────────────────────
     Cada capa nació al lado del bloque que la explica, y eso está bien para
     entenderla: el botón de las curvas vive en «El terreno», el de las
     sombras en «El lote». Pero cuando hay diez encendidas a la vez, apagar
     una obliga a recorrer la ficha entera buscando dónde estaba su botón.

     Este panel no reemplaza a esos botones: los reúne. Es la lista completa
     de lo que se puede poner sobre el mapa, con lo que está puesto marcado, y
     con las que todavía no se pueden encender en gris, diciendo qué falta
     para encenderlas. */
  /* ── Armar el pliego ───────────────────────────────────────────────────
     Las capas del mapa resolvieron el orden en pantalla. Esto es lo mismo
     para el papel: una lámina no se hace poniendo TODO, se hace eligiendo. Un
     pliego de 90 × 60 con veintiuna cajas es un informe colgado en la pared;
     con ocho, es una lámina.

     Se guardan las APAGADAS. Es a propósito: así una caja que se agregue
     después aparece sola en el pliego de un sector archivado, en vez de
     quedarse fuera por no figurar en una lista escrita antes de que
     existiera.

     Esto arma EL PLIEGO. El PDF sigue completo siempre: uno es una
     composición y el otro es el archivo, y no tienen por qué ser lo mismo. */
  function slugPliego(t) {
    return String(t || '').toLowerCase()
      .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
      .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function pliegoApagada(titulo) {
    return (S.pliegoOff || []).indexOf(slugPliego(titulo)) !== -1;
  }

  /* El inventario del pliego. Cada entrada dice si la caja TIENE con qué
     llenarse; si no, qué falta medir. Las condiciones son las mismas que usa
     cada caja para devolver vacío —la prueba tpliego comprueba justamente que
     no se separen: lo que acá sale listo tiene que aparecer en el papel, y lo
     que sale gris no puede aparecer. */
  function cajasDelPliego(res) {
    var st = (res && res.stats) || {};
    var trz = S.trazado, esPol = (res && res.meta && res.meta.forma) === 'poligono';
    var hayLote = !!(S.lote && S.lote.length >= 3);
    function det() { try { return determinantesDelLote(st).length > 0; } catch (e) { return false; } }
    function falt() { try { return faltantesDelSector(st).length > 0; } catch (e) { return false; } }
    function somb() { try { var x = sombrasDelLote(); return !!(x && x.horas && x.horas.length); }
                      catch (e) { return false; } }
    var lista = [
      { id: 'plano-del-sector', t: 'Plano del sector', g: 'La hoja', listo: !!res,
        falta: 'analizá el sector', dato: 'el dibujo que manda' },
      { id: 'los-mapas-del-sector', t: 'Los mapas del sector', g: 'La hoja',
        listo: !!res, falta: 'analizá el sector', dato: 'la banda de recuadros' },
      { id: 'sintesis-del-sector', t: 'Síntesis del sector', g: 'La hoja', listo: !!res,
        falta: 'analizá el sector', dato: 'a favor, en contra y qué falta' },

      { id: 'el-sitio', t: 'El sitio', g: 'Lo que hay', listo: !!res,
        falta: 'analizá el sector', dato: 'las cifras de arriba' },
      { id: 'que-hay-por-categoria', t: 'Qué hay, por categoría', g: 'Lo que hay',
        listo: Object.keys(st.porGrupo || {}).some(function (k) {
          return k !== 'otro' && st.porGrupo[k] > 0; }),
        falta: 'no hay usos clasificados', dato: (st.total || 0) + ' usos' },
      { id: 'quien-vive-aca', t: 'Quién vive acá', g: 'Lo que hay',
        listo: !!(st.demografia && st.demografia.totalSexo),
        falta: 'el censo no tiene reparto por edades acá',
        dato: st.demografia && st.demografia.tramoDominanteEtq
          ? 'sobre todo ' + String(st.demografia.tramoDominanteEtq).toLowerCase()
          : 'edades y sexo del censo' },
      { id: 'que-manda-en-el-sector', t: 'Qué manda en el sector', g: 'Lo que hay',
        listo: !!(st.usoPredominante && Object.keys(st.usoPredominante)
                  .some(function (k) { return st.usoPredominante[k] > 0; })),
        falta: 'no hay usos con peso en el área',
        dato: (function () {
          var up = st.usoPredominante;
          if (!up) return 'el reparto por peso y la mezcla';
          var k = Object.keys(up).sort(function (x, y) { return up[y] - up[x]; })[0];
          return k ? sinEmoji(NOMBRE_USO[k] || k).toLowerCase() + ' con el ' + up[k] + '%'
                   : 'el reparto por peso y la mezcla';
        })() },
      { id: 'donde-esta-la-calle-comercial', t: 'Dónde está la calle comercial', g: 'Lo que hay',
        listo: !!(st.nucleos && st.nucleos.length),
        falta: 'no hay comercios agrupados en el área',
        dato: ((st.nucleos || []).length) + ' núcleos de comercio' },
      /* La caja sale con los anillos O con el rumbo que concentra: son dos
         respuestas a la misma pregunta —dónde está lo que hay— y cualquiera
         de las dos llena la caja sola. Pedir las dos la escondía en sectores
         con los usos repartidos parejo, que es justo donde el reparto por
         distancia es lo único que dice algo. */
      { id: 'como-cambia-al-alejarse', t: 'Cómo cambia al alejarse', g: 'Lo que hay',
        listo: (st.anillos || []).filter(function (x) { return x.n > 0; }).length >= 2 ||
               !!(res && res.pois && res.pois.length),
        falta: 'analizá el sector', dato: 'anillos de distancia y el lado más activo' },
      { id: 'hitos-y-nodos', t: 'Hitos y nodos', g: 'Lo que hay',
        listo: !!(st.hitos && st.hitos.length), falta: 'no hay hitos registrados',
        dato: ((st.hitos || []).length) + ' hitos' },
      { id: 'a-distancia-de-caminar', t: 'A distancia de caminar', g: 'Lo que hay',
        listo: !!st.accesibilidad, falta: 'analizá el sector', dato: 'qué se alcanza a pie' },

      { id: 'alturas-de-lo-construido', t: 'Alturas de lo construido', g: 'El suelo',
        listo: !!((trz && trz.alturas && trz.alturas.conDato) || (st.alturas && st.alturas.conDato)),
        falta: 'medí el trazado', dato: 'cuántos pisos hay' },
      /* `!trazadoSinDatos` y no `trz.llenos`: en un sector sin nada mapeado el
         motor devuelve el objeto igual, con todo en cero, y la caja se ofrecía
         como lista para poner en la lámina «0% construido». La misma deriva
         que ya se coló una vez con el espacio público. */
      { id: 'llenos-y-vacios', t: 'Llenos y vacíos', g: 'El suelo',
        listo: !!(trz && trz.llenos) && !trazadoSinDatos(trz),
        falta: trz ? 'no hay nada mapeado en el sector' : 'medí el trazado',
        dato: trz && trz.llenos && !trazadoSinDatos(trz)
          ? trz.llenos.pctLleno + '% construido' : '' },
      { id: 'como-se-llega', t: 'Cómo se llega', g: 'Cómo se mueve',
        listo: !!(res && res.stats && res.stats.movilidad),
        falta: 'analizá el sector',
        dato: (function () {
          var m = res && res.stats && res.stats.movilidad;
          if (!m) return 'corredores, buses y flujo';
          var f = m.flujo && m.flujo.dominante;
          return (m.nViasArterias || 0) + ' corredores · ' + (m.paradasBus || 0) + ' paradas' +
                 (f && f !== 'ninguno' ? ' · flujo ' + f : '');
        })() },
      { id: 'el-perfil-de-la-calle', t: 'El perfil de la calle', g: 'El suelo',
        listo: !!(trz && trz.perfil), falta: 'medí el trazado', dato: 'la sección tipo' },
      /* `piezas` y no `espacio`: la caja se llena solo si hay al menos una
         pieza de espacio público con forma registrada. Un sector sin un solo
         parque mapeado tiene el objeto y no tiene la caja. */
      { id: 'espacio-publico-efectivo', t: 'Espacio público efectivo', g: 'El suelo',
        listo: !!(trz && trz.espacio && trz.espacio.piezas),
        falta: 'medí el trazado; sin parques mapeados no hay qué medir',
        dato: 'plazas y parques' },
      { id: 'el-terreno', t: 'El terreno', g: 'El suelo', listo: !!S.terreno,
        falta: 'medí el terreno', dato: 'cotas, pendiente y cortes' },
      { id: 'el-clima', t: 'El clima', g: 'El suelo', listo: !!S.clima,
        falta: 'pedí el clima', dato: 'temperatura, lluvia y viento' },
      { id: 'la-amenaza-sismica', t: 'La amenaza sísmica', g: 'El suelo',
        listo: !!S.amenaza, falta: 'pedí la amenaza sísmica',
        dato: S.amenaza ? ('amenaza ' + String(S.amenaza.nivel || '').toLowerCase() +
                           (S.amenaza.masa ? ' · y deslizamiento' : ''))
                        : 'Aa, Av, la curva y el deslizamiento' },
      { id: 'la-inundacion', t: 'La inundación', g: 'El suelo',
        listo: !!(S.inundacion && !S.inundacion.sinDato),
        falta: 'pedí la amenaza: la inundación viene con ella',
        dato: S.inundacion && S.inundacion.nombre
          ? String(S.inundacion.nombre).toLowerCase()
          : 'las manchas del IDEAM' },
      { id: 'como-cambio-el-sitio', t: 'Cómo cambió el sitio', g: 'El suelo',
        listo: !!(S.evo && S.evo.landsat && (S.evo.landsat.pasos || [])
                   .filter(function (p) { return p.ok && p.medida; }).length >= 2),
        falta: 'pedí la evolución desde 1984',
        dato: (function () {
          var t = S.evo && S.evo.landsat && S.evo.landsat.tendencia;
          return t ? t.desde + ' → ' + t.hasta + ' · ' + (t.verde > 0 ? '+' : '') +
                     conComa(t.verde) + ' puntos de verde'
                   : 'la serie de Landsat y su tendencia';
        })() },
      { id: 'infraestructura-de-servicios', t: 'Infraestructura de servicios', g: 'El suelo',
        listo: (function () {
          try { return !!infraDeServicios(res); } catch (e) { return false; }
        })(),
        falta: 'no hay infraestructura registrada en el área',
        dato: 'tanques, subestaciones y plantas, con su distancia' },
      { id: 'el-ruido-del-transito', t: 'El ruido del tránsito', g: 'El suelo',
        listo: (function () {
          try { return !!ruidoDelLote(); } catch (e) { return false; }
        })(),
        falta: 'medí el trazado: el ruido se estima desde las vías',
        dato: (function () {
          try { var r2 = ruidoDelLote(); return r2 ? conComa(r2.dB) + ' dB(A) · ' + r2.etq.toLowerCase()
                                                   : 'estimado desde la jerarquía vial'; }
          catch (e) { return 'estimado desde la jerarquía vial'; }
        })() },
      { id: 'verde-y-agua', t: 'Verde y agua', g: 'El suelo',
        listo: !!(res && res.stats && res.stats.ambiente),
        falta: 'analizá el sector',
        dato: (function () {
          var a = res && res.stats && res.stats.ambiente;
          return a ? (a.parques || 0) + ' parques · ' + (a.cuerposAgua || 0) + ' de agua'
                   : 'parques, agua y manchas de verde';
        })() },
      { id: 'cobertura-del-suelo', t: 'Cobertura del suelo', g: 'El suelo',
        listo: !!(S.cobertura && S.cobertura.clases && S.cobertura.clases.length),
        falta: 'leé la foto satelital',
        dato: (function () {
          var c = S.cobertura && S.cobertura.clases;
          var v = c && c.filter(function (x) { return x.id === 'verde'; })[0];
          return v ? v.pct + '% de vegetación viva' : 'lo que dice la foto, no el mapeo';
        })() },
      { id: 'asoleamiento', t: 'Asoleamiento', g: 'El suelo', listo: !!res,
        falta: 'analizá el sector', dato: 'la carta solar del sitio' },

      { id: 'el-lote-a-intervenir', t: 'El lote a intervenir', g: 'El lote', listo: hayLote,
        falta: 'marcá el lote', dato: 'medidas y frentes' },
      { id: 'que-cabe-en-el-lote', t: 'Qué cabe en el lote', g: 'El lote',
        listo: hayLote, falta: 'marcá el lote',
        dato: 'huella, metros y viviendas' },
      { id: 'la-cuadra-del-lote', t: 'La cuadra del lote', g: 'El lote',
        listo: (function () {
          try { return !!laCuadraDelLote(); } catch (e) { return false; }
        })(),
        falta: 'marcá el lote y medí el trazado',
        dato: 'el frente al que da: fachada, huecos, esquinas y usos' },
      { id: 'la-sombra-que-arrojas', t: 'La sombra que arrojás', g: 'El lote',
        listo: (function () {
          try { var x = sombraDelProyecto(); return !!(x && x.horas && x.horas.length); }
          catch (e) { return false; }
        })(),
        falta: 'marcá el lote y medí el trazado',
        dato: 'a quién le tapa el sol el volumen permitido' },
      { id: 'que-le-pide-el-sitio-al-proyecto', t: 'Qué le pide el sitio al proyecto',
        g: 'El lote', listo: det(), falta: 'marcá el lote y medí algo más',
        dato: 'las determinantes' },
      { id: 'hasta-donde-se-camina-desde-el-lote', t: 'Hasta dónde se camina desde el lote',
        g: 'El lote', listo: !!(S.caminata && S.caminata.anillos),
        falta: 'marcá el lote y medí el trazado', dato: '5, 10 y 15 min' },
      { id: 'la-sombra-de-los-vecinos', t: 'La sombra de los vecinos', g: 'El lote',
        listo: somb(), falta: 'marcá el lote y medí el trazado', dato: '9, 12 y 15 h' },

      { id: 'lo-intangible', t: 'Lo intangible', g: 'El trabajo del curso',
        listo: !!(S.intangible && S.intangible.length),
        falta: 'marcá lo que viste en la calle',
        dato: (S.intangible || []).length + ' marcas' },
      { id: 'lo-levantado-en-campo', t: 'Lo levantado en campo', g: 'El trabajo del curso',
        listo: !!S.campo, falta: 'compará con lo del curso', dato: 'lo que encontró la salida' },
      { id: 'donde-falta-mapear', t: 'Dónde falta mapear', g: 'El trabajo del curso',
        listo: !!res, falta: 'analizá el sector', dato: 'la rosa de los rumbos' },
      { id: 'lo-que-falta-levantar', t: 'Lo que falta levantar', g: 'El trabajo del curso',
        listo: falt(), falta: 'no queda nada por levantar', dato: 'la lista de tareas' }
    ];
    var off = S.pliegoOff || [];
    lista.forEach(function (c) {
      c.on = off.indexOf(c.id) === -1;
      c.esPol = esPol;
    });
    return lista;
  }

  /* Los recuadros de la banda, enumerados sin dibujarlos. `mapasDelPliego`
     proyecta cientos de puntos por recuadro: pedirle la lista para pintar
     unos interruptores costaría más que la lámina entera. Las condiciones son
     las mismas, y la prueba tpliego comprueba que no se separen. */
  /* ── Cuántos recuadros de mapa caben en el pliego ─────────────────────
     La banda de mapas tiene 505 mm de ancho útil en el pliego acostado. Con
     nueve recuadros —el techo de antes— cada uno queda de 53 mm: un sello, y
     un raster de 53 mm no se lee ni con la nariz pegada. Se pidió al revés:
     «los mapas salen muy pequeños, deberíamos hacerlos más grandes para que
     un profesor pase y vea con más detalle lo mapeado; no se ve con claridad
     los rasters o los llenos y vacíos».

     Siete columnas, entonces. Es lo que hace que entren justos los cuatro que
     importan —la cobertura, los llenos, el mapa de todos los usos y la foto—,
     porque los tres anchos valen dos columnas cada uno.

     Lo que sobra NO se encoge para que quepa todo: se queda fuera, y se dice.
     Encoger todos para que entren todos es exactamente cómo se llegó a los
     sellos. Y el reparto vive acá, en un solo sitio, porque lo usan los dos
     que no pueden contradecirse: el que arma la lámina y el que ofrece elegir
     qué va en ella. Cuando cada uno tenía su cuenta, el selector prometía un
     recuadro que el papel no traía. */
  /* ── La jerarquía vial ────────────────────────────────────────────────
     Se pidió así: «falta un mapa de movilidad que muestre y marque más las
     vías principales de un color verde por ejemplo y las secundarias de otro
     color».

     El orden es el de la etiqueta `highway` de OpenStreetMap, que significa
     lo mismo en cualquier país y no es una regla de URBIS: una troncal es una
     troncal en Cúcuta y en Copenhague. El color y el grosor van juntos porque
     un mapa de jerarquía se lee por el grosor antes que por el color —así se
     entiende también fotocopiado en blanco y negro— y porque el verde de las
     principales es lo que se pidió por su nombre.

     El orden de la lista es también el orden de DIBUJO al revés: las locales
     van al fondo y las troncales encima, que es como se ve una red y no una
     maraña. */
  var JERARQUIA_VIAL = [
    { id: 'troncal', etq: 'Troncal', color: '#0B6E3A', ancho: 2.8,
      clases: ['motorway', 'trunk', 'motorway_link', 'trunk_link'] },
    { id: 'principal', etq: 'Principal', color: '#16A34A', ancho: 2.1,
      clases: ['primary', 'primary_link'] },
    { id: 'secundaria', etq: 'Secundaria', color: '#D97706', ancho: 1.5,
      clases: ['secondary', 'secondary_link'] },
    { id: 'colectora', etq: 'Colectora', color: '#0A6F9E', ancho: 1.1,
      clases: ['tertiary', 'tertiary_link'] },
    { id: 'local', etq: 'Local', color: '#9AA9B8', ancho: 0.65,
      clases: ['residential', 'unclassified', 'living_street', 'road'] },
    { id: 'peatonal', etq: 'Peatonal y ciclo', color: '#6D4AC8', ancho: 0.8,
      clases: ['pedestrian', 'footway', 'path', 'steps', 'cycleway', 'track'] }
  ];
  var JER_POR_CLASE = (function () {
    var m = {};
    JERARQUIA_VIAL.forEach(function (j) {
      j.clases.forEach(function (c) { m[c] = j; });
    });
    return m;
  })();
  /* Las de servicio —parqueaderos, callejones de acceso— quedan fuera a
     propósito: son cientos, no jerarquizan nada y lo único que hacen es tapar
     la red con líneas grises. */
  function jerarquiaVialDe(clase) { return JER_POR_CLASE[String(clase || '')] || null; }
  // La coma decimal de acá, que es la que lee quien va a imprimir esto.
  function conComa(x) { return String(x).replace('.', ','); }
  function conComaY(lista) {
    var xs = (lista || []).map(function (x) { return esc(String(x)); });
    if (xs.length <= 1) return xs[0] || '';
    return xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1];
  }
  /* Los metros de una polilínea. Sirve para decir cuántos kilómetros hay de
     cada jerarquía, que es lo que convierte un dibujo bonito en una medición. */
  function largoDeVia(pts) {
    var t = 0;
    for (var i = 1; i < (pts || []).length; i++) t += haversineM(pts[i - 1], pts[i]);
    return t;
  }
  /* El reparto de la red por jerarquía, de mayor a menor. Devuelve solo las
     que existen: una leyenda con cinco renglones de los que tres dicen «0 km»
     no es una leyenda, es ruido. */
  function redPorJerarquia(vias) {
    var acc = {};
    (vias || []).forEach(function (v) {
      var j = jerarquiaVialDe(v.clase);
      if (!j) return;
      acc[j.id] = (acc[j.id] || 0) + largoDeVia(v.pts);
    });
    return JERARQUIA_VIAL.filter(function (j) { return acc[j.id] > 0; })
      .map(function (j) {
        return { id: j.id, etq: j.etq, color: j.color, ancho: j.ancho,
                 metros: Math.round(acc[j.id]), km: Math.round(acc[j.id] / 100) / 10 };
      });
  }

  /* ENTRAN TODOS. Hubo un intento de dejar solo uno por tema y como mucho
     cuatro en la hoja, para que salieran grandes; se probó contra un análisis
     de verdad y llegó la respuesta que lo tumba: «veo 10 mapas en el último
     análisis que hice, no me dejes mapas a un lado». Tiene razón. Cada mapa
     que se midió costó una medición, y decidir por alguien cuál de sus diez
     capas merece papel es exactamente lo que no hay que hacer.

     Lo que cede, entonces, es el TAMAÑO de la hoja compuesta: entran todos,
     cada uno en la banda de su tema, y `laminaQueQuepa` mide y reduce hasta
     que el pliego cierra. Con pocos mapas la hoja sale a tamaño natural; con
     diez, compuesta más chica —y la ficha lo dice antes de imprimir, para que
     quien prefiera cuatro mapas grandes apague seis y los tenga—. */
  /* Los que se dibujan al doble de ancho cuando el sitio no elige por
     columnas: el PDF —que son hojas y no elige— se lo da a los dibujos de
     grano fino. Cientos de huellas de veinte metros o una clasificación píxel
     a píxel, que a tamaño de sello son una textura gris. */
  var MAPAS_ANCHOS = { cobertura: true, foto: true, llenos: true };
  /* En qué banda entra cada mapa. Una sola tabla: la usan el que arma la
     lámina y el selector de la ficha, y si tuvieran una cada uno el selector
     agruparía distinto que el papel. Los identificadores son los de las
     bandas, en `GRUPOS`. */
  var GRUPO_DE_MAPA = {
    'calor:todos': 'demografico', estratos: 'demografico', hitos: 'demografico',
    cobertura: 'ambiental', curvas: 'ambiental', sombras: 'ambiental', masa: 'ambiental',
    foto: 'ubicacion', llenos: 'forma', alturas: 'forma',
    vias: 'movilidad', caminata: 'movilidad',
    acuerdos: 'campo', intangible: 'campo'
  };
  function grupoDeMapa(id) {
    // Los de calor por categoría —«calor:g:comercio»— son todos del tema de
    // los usos del suelo, y son muchos: se resuelven por el prefijo.
    if (String(id || '').indexOf('calor:') === 0) return 'demografico';
    return GRUPO_DE_MAPA[id] || '';
  }

  function mapasDisponibles(res) {
    var st = (res && res.stats) || {};
    var CAT = window.AIA_CATALOGO || {};
    var G = CAT.GRUPOS || {};
    var pois = (res && res.pois) || [];
    var cob = S.cobertura;
    var lista = [];
    if (pois.length) {
      lista.push({ id: 'calor:todos', t: 'Todos los usos', listo: true,
                   dato: pois.length + ' usos' });
      Object.keys(st.porGrupo || {})
        .map(function (g) { return { id: g, n: st.porGrupo[g] || 0 }; })
        .filter(function (x) { return x.n >= 3 && x.id !== 'otro'; })
        .sort(function (a, b) { return b.n - a.n; })
        .slice(0, 6)
        .forEach(function (g) {
          lista.push({ id: 'calor:' + g.id,
                       t: sinEmoji((G[g.id] && (G[g.id].t || G[g.id].nombre)) || g.id),
                       listo: true, dato: g.n + ' usos' });
        });
    }
    lista.push({ id: 'cobertura', t: 'Cobertura del suelo',
                 listo: !!(cob && cob.overlayImagen && cob.overlayLimites),
                 dato: 'clasificada sobre la foto', falta: 'leé la foto satelital' });
    lista.push({ id: 'foto', t: 'La foto satelital',
                 listo: !!(cob && cob.imagen && cob.overlayLimites),
                 dato: 'la imagen cruda', falta: 'leé la foto satelital' });
    lista.push({ id: 'estratos', t: 'Manzanas por estrato',
                 listo: !!(S.estratos && S.estratos.manzanas && S.estratos.manzanas.length),
                 dato: 'del DANE', falta: 'poné los estratos en el mapa' });
    lista.push({ id: 'hitos', t: 'Hitos y nodos',
                 listo: !!((st.hitos || []).some(function (h) { return h.lat != null; })),
                 dato: 'numerados y con su nombre', falta: 'no hay hitos registrados' });
    lista.push({ id: 'alturas', t: 'Alturas de lo construido',
                 listo: !!((S.trzPisos || []).filter(function (x) { return x != null; }).length >= 3),
                 dato: 'cada huella con el tono de sus pisos', falta: 'medí el trazado' });
    lista.push({ id: 'masa', t: 'Susceptibilidad por pendiente',
                 listo: !!S.terRejilla, dato: 'los rangos de la guía, del modelo de elevación',
                 falta: 'medí el terreno' });
    lista.push({ id: 'llenos', t: 'Llenos y vacíos',
                 listo: !!(S.trzHuellas && S.trzHuellas.length),
                 dato: 'huellas de edificio', falta: 'medí el trazado' });
    lista.push({ id: 'vias', t: 'Jerarquía vial',
                 listo: !!(S.trzVias && S.trzVias.length),
                 dato: (function () {
                   var rj = redPorJerarquia(S.trzVias);
                   return rj.length ? rj.map(function (j) { return j.etq.toLowerCase(); }).join(' · ')
                                    : 'la red por jerarquía';
                 })(),
                 falta: 'medí el trazado' });
    lista.push({ id: 'curvas', t: 'Curvas de nivel',
                 listo: (function () {
                   try { var c = curvasDelTerreno(); return !!(c && c.curvas && c.curvas.length); }
                   catch (e) { return false; } })(),
                 dato: 'del relieve', falta: 'medí el terreno' });
    lista.push({ id: 'sombras', t: 'La sombra de los vecinos',
                 listo: (function () {
                   try { var x = sombrasDelLote(); return !!(x && x.horas && x.horas.length); }
                   catch (e) { return false; } })(),
                 dato: '9, 12 y 15 h', falta: 'marcá el lote y medí el trazado' });
    lista.push({ id: 'caminata', t: 'Hasta dónde se camina',
                 listo: !!(S.caminata && S.caminata.tramos && S.caminata.tramos.length),
                 dato: '5, 10 y 15 min', falta: 'marcá el lote y medí el trazado' });
    lista.push({ id: 'intangible', t: 'Lo intangible',
                 listo: !!(S.intangible && S.intangible.length),
                 dato: (S.intangible || []).length + ' marcas',
                 falta: 'marcá lo que viste en la calle' });
    var off = S.pliegoMapasOff || [];
    lista.forEach(function (m) { m.on = off.indexOf(m.id) === -1; });
    /* El tema de cada uno, del mismo sitio del que lo saca el papel. Sin
       esto el selector agruparía distinto que la lámina. */
    lista.forEach(function (x) { x.grupo = grupoDeMapa(x.id); });
    return lista;
  }

  function alternarMapaPliego(id, encender) {
    var off = S.pliegoMapasOff || (S.pliegoMapasOff = []);
    var i = off.indexOf(id);
    if (encender && i !== -1) off.splice(i, 1);
    if (!encender && i === -1) off.push(id);
    S.pliegoCabe = null;
    guardarFichaViva();
  }

  function alternarCajaPliego(id, encender) {
    var off = S.pliegoOff || (S.pliegoOff = []);
    var i = off.indexOf(id);
    if (encender && i !== -1) off.splice(i, 1);
    if (!encender && i === -1) off.push(id);
    // Cualquier cambio invalida la última prueba de encaje: el papel que
    // cabía con dieciséis cajas no dice nada de cómo cabe con dieciocho.
    S.pliegoCabe = null;
    guardarFichaViva();
  }

  function capasDisponibles(st) {
    var CAT = window.AIA_CATALOGO || {};
    var G = CAT.GRUPOS || {}, COL = CAT.GRUPO_COLOR || {};
    var grupos = Object.keys((st && st.porGrupo) || {})
      .map(function (g) { return { id: g, n: st.porGrupo[g] || 0 }; })
      .filter(function (x) { return x.n > 0 && x.id !== 'otro'; })
      .sort(function (a, b) { return b.n - a.n; });

    var lista = [];
    lista.push({ id: 'calor:todos', grupo: 'Lo que hay', nombre: 'Todos los usos, en calor',
                 color: '#0A6F9E', on: S.calor.indexOf('todos') !== -1, listo: !!S.resultado,
                 falta: 'analizá el sector' });
    grupos.forEach(function (g) {
      lista.push({ id: 'calor:g:' + g.id, grupo: 'Lo que hay',
                   nombre: (G[g.id] && (G[g.id].t || G[g.id].nombre)) || g.id,
                   dato: g.n + ' usos', color: COL[g.id] || '#94a3b8',
                   on: S.calor.indexOf('g:' + g.id) !== -1, listo: !!S.resultado,
                   falta: 'analizá el sector' });
    });

    lista.push({ id: 'cobertura', grupo: 'El suelo', nombre: 'Cobertura del suelo',
                 dato: 'de la foto satelital', color: '#22c55e',
                 on: !!S.cobEnMapa, listo: !!S.cobertura, falta: 'medí la cobertura' });
    lista.push({ id: 'estratos', grupo: 'El suelo', nombre: 'Manzanas por estrato',
                 dato: 'del DANE', color: '#8b5cf6',
                 on: !!S.estratos, listo: !!S.resultado, falta: 'analizá el sector' });
    lista.push({ id: 'llenos', grupo: 'El suelo', nombre: 'Llenos y vacíos',
                 dato: 'huellas de los edificios', color: '#3B4A5A',
                 on: !!S.llenosEnMapa, listo: !!(S.trzHuellas && S.trzHuellas.length),
                 falta: 'medí el trazado' });
    lista.push({ id: 'vias', grupo: 'Cómo se mueve', nombre: 'Jerarquía vial',
                 dato: (function () {
                   var rj = redPorJerarquia(S.trzVias);
                   return rj.length ? rj.map(function (j) { return j.etq.toLowerCase(); }).join(' · ')
                                    : 'troncales, principales y locales';
                 })(),
                 color: '#16A34A',
                 on: !!S.viasEnMapa, listo: !!(S.trzVias && S.trzVias.length),
                 falta: 'medí el trazado' });
    lista.push({ id: 'curvas', grupo: 'El suelo', nombre: 'Curvas de nivel',
                 dato: (S.curvas && S.curvas.intervalo ? 'cada ' + S.curvas.intervalo + ' m' : 'del relieve'),
                 color: '#8A5A20', on: !!S.curvasEnMapa, listo: !!S.terRejilla,
                 falta: 'medí el terreno' });

    lista.push({ id: 'sombras', grupo: 'El lote', nombre: 'La sombra de los vecinos',
                 dato: '9, 12 y 15 h', color: '#7C4DFF',
                 on: !!S.sombrasEnMapa,
                 listo: !!(S.lote && S.lote.length >= 3 && S.trzHuellas && S.trzHuellas.length),
                 falta: 'marcá el lote y medí el trazado' });
    lista.push({ id: 'caminata', grupo: 'El lote', nombre: 'Hasta dónde se camina',
                 dato: '5, 10 y 15 min', color: '#0A6F9E',
                 on: !!S.caminataEnMapa,
                 listo: !!(S.caminata && S.caminata.tramos && S.caminata.tramos.length),
                 falta: 'marcá el lote y medí el trazado' });
    /* Lo intangible es la única capa que no se enciende midiendo nada: se
       enciende caminando. Por eso lo que le falta no es una medición sino
       una salida a la calle, y así se lo dice. */
    lista.push({ id: 'intangible', grupo: 'El lote', nombre: 'Lo intangible',
                 dato: (S.intangible && S.intangible.length
                   ? S.intangible.length + ' marca' + (S.intangible.length === 1 ? '' : 's')
                   : 'lo que solo se ve caminando'),
                 color: '#E23D3D', on: !!S.intEnMapa,
                 listo: !!(S.intangible && S.intangible.length),
                 falta: 'marcá lo que viste en la calle' });
    return lista;
  }

  /* Encender o apagar una capa por su nombre. Cada una tiene su propio
     interruptor —el calor va por chips, el raster vive en js/24, los llenos
     tienen su capa— así que acá se traduce el nombre a la llave que
     corresponde y no se duplica ninguna lógica. */
  function alternarCapa(id, encender) {
    if (id.indexOf('calor:') === 0) {
      var cal = id.slice(6);
      var i = S.calor.indexOf(cal);
      if (encender && i === -1) S.calor.push(cal);
      if (!encender && i !== -1) S.calor.splice(i, 1);
      // «Todos» y una categoría son excluyentes: pintar los dos deja el mapa
      // en una mancha sin lectura posible.
      if (encender && cal === 'todos') S.calor = ['todos'];
      else if (encender) S.calor = S.calor.filter(function (x) { return x !== 'todos'; });
      aplicarCalor();
      return;
    }
    if (id === 'cobertura') {
      var A4 = window.URBIS_PC_ANALISIS;
      S.cobEnMapa = !!encender;
      try {
        if (S.cobEnMapa && A4 && typeof A4.mostrarRaster === 'function') A4.mostrarRaster(S.cobertura);
        if (!S.cobEnMapa && A4 && typeof A4.quitarRaster === 'function') A4.quitarRaster();
      } catch (e) {}
      return;
    }
    if (id === 'estratos') { pintarEstratos(!!encender); return; }
    if (id === 'llenos') { pintarLlenos(!!encender); return; }
    if (id === 'curvas') { pintarCurvas(!!encender); return; }
    if (id === 'vias') { pintarVias(!!encender); return; }
    if (id === 'sombras') { pintarSombras(!!encender); return; }
    if (id === 'caminata') { pintarCaminata(!!encender); return; }
    if (id === 'intangible') { pintarIntangible(!!encender); return; }
  }

  /* ── Los mapas del pliego ──────────────────────────────────────────────
     En pantalla las capas se encienden de a una y se miran encimadas. En el
     papel eso no sirve: una lámina no tiene interruptores, así que cada capa
     necesita su propio recuadro, con su leyenda y su escala.

     Se dibujan TODAS las que tengan datos, estén encendidas o no. Es a
     propósito: lo que se llevó a la impresión es el análisis completo, y que
     el mapa de calor del comercio no salga porque en ese momento estaba
     apagado sería perder trabajo ya hecho por un estado de pantalla.

     El orden es el de lectura de una lámina de urbanismo: primero lo que hay
     —los usos—, después el suelo, y al final lo que le pasa al lote. Con una
     excepción al final: los dos rasters se adelantan al primer puesto y
     salen al doble de ancho. */
  function mapasDelPliego(res, opts) {
    var o = opts || {};
    var A = window.URBIS_PC_ANALISIS;
    if (!A || typeof A.miniatura !== 'function' || !res) return [];
    var st = res.stats || {}, meta = res.meta || {};
    var CAT = window.AIA_CATALOGO || {};
    var G = CAT.GRUPOS || {}, COL = CAT.GRUPO_COLOR || {};
    var forma = (meta.forma === 'poligono' && meta.poligono && meta.poligono.length >= 3)
      ? { pts: meta.poligono }
      : { centro: { lat: meta.lat, lng: meta.lng }, radioM: meta.radioM };
    var lote = o.lote !== undefined ? o.lote : S.lote;
    /* ── El recuadro, con la proporción DEL SECTOR ─────────────────────
       Estaba fijo en 260 × 180, y eso es lo que hacía que el área analizada
       flotara en medio del dibujo con dos franjas de rejilla a los lados. Se
       pidió así: «quiero los mapas de los mapeos y análisis más grandes, el
       cuadrado que estás analizando, y no sobrealargarlo de más». Las dos
       mitades de la frase son la misma cosa: el sector se ve chico porque el
       recuadro es más ancho que él, no porque el dibujo sea chico.

       Así que el alto lo pone la hoja y el ANCHO sale de la proporción del
       sector: un sector cuadrado da un recuadro cuadrado y lo llena. Es el
       mismo razonamiento que ya seguía el plano grande —está justo debajo,
       con su propia nota— y que a los recuadros les faltaba.

       Con topes: un sector larguísimo y angosto daría un recuadro de tres
       veces el ancho por el alto, que en una banda no cabe; y uno altísimo,
       una tira vertical. Entre 0,7 y 1,9 el dibujo llena su caja sin
       deformar nada y sin salirse de la banda. */
    var proporcionSector = (function () {
      try {
        if (!forma.pts) return 1;
        var lats = forma.pts.map(function (q) { return +q.lat; });
        var lngs = forma.pts.map(function (q) { return +q.lng; });
        var kx = Math.cos(((Math.min.apply(null, lats) + Math.max.apply(null, lats)) / 2) * Math.PI / 180);
        var an = (Math.max.apply(null, lngs) - Math.min.apply(null, lngs)) * kx;
        var al = Math.max.apply(null, lats) - Math.min.apply(null, lats);
        return al > 0 ? an / al : 1;
      } catch (e) { return 1; }
    })();
    var H = o.h || 210;
    var W = Math.round(H * Math.max(0.7, Math.min(1.9, proporcionSector)));
    var base = { w: W, h: H, lote: (lote && lote.length >= 3) ? lote : null };
    function mini(extra) {
      try { return A.miniatura(forma, Object.assign({}, base, extra)) || ''; }
      catch (e) { return ''; }
    }
    var pois = res.pois || [];
    var mapas = [];

    // ── 1 · Los usos, todos y por categoría.
    if (pois.length) {
      mapas.push({
        id: 'calor:todos', titulo: 'Todos los usos', grupo: grupoDeMapa('calor:todos'),
        svg: mini({ calor: pois, calorColor: '#0A6F9E', calorRadio: 8,
                    puntos: pois.map(function (p) {
                      return { lat: p.lat, lng: p.lng, color: COL[p.grupo] || '#94a3b8' };
                    }), radioPunto: 1.6 }),
        /* La tabla de convenciones. Un mapa sin ella es una mancha de
           colores: se pidió por su nombre —«a los mapas les hace falta tabla
           de convenciones»— y tiene razón, porque hasta ahora el único
           recuadro que decía qué era cada color era el plano del sector. Los
           demás dejaban el color en el dibujo y el significado en el pie, en
           texto corrido, que es donde nadie lo cruza.

           `f` es la FORMA de la muestra —punto, línea, área, punteado—: en
           una lámina que puede acabar fotocopiada en blanco y negro, la
           forma distingue lo que el color ya no. */
        conv: grupoDeUsos(st, 6),
        pie: pois.length + ' usos registrados, con el color de su categoría'
      });
      var grupos = Object.keys(st.porGrupo || {})
        .map(function (g) { return { id: g, n: st.porGrupo[g] || 0 }; })
        .filter(function (x) { return x.n >= 3 && x.id !== 'otro'; })
        .sort(function (a, b) { return b.n - a.n; })
        .slice(0, o.maxCategorias || 6);
      grupos.forEach(function (g) {
        var suyos = pois.filter(function (p) { return p.grupo === g.id; });
        if (!suyos.length) return;
        mapas.push({
          id: 'calor:' + g.id, grupo: grupoDeMapa('calor:' + g.id),
          titulo: sinEmoji((G[g.id] && (G[g.id].t || G[g.id].nombre)) || g.id),
          svg: mini({ calor: suyos, calorColor: COL[g.id] || '#94a3b8', calorRadio: 9,
                      puntos: suyos.map(function (p) {
                        return { lat: p.lat, lng: p.lng, color: COL[g.id] || '#94a3b8' };
                      }), radioPunto: 1.6 }),
          conv: [{ c: COL[g.id] || '#94a3b8',
                   t: sinEmoji((G[g.id] && (G[g.id].t || G[g.id].nombre)) || g.id) + ' · ' + g.n }],
          pie: g.n + ' usos · dónde se concentra'
        });
      });
    }

    // ── 2 · El suelo.
    var cob = o.cobertura !== undefined ? o.cobertura : S.cobertura;
    if (cob && cob.overlayImagen && cob.overlayLimites) {
      var clases = (cob.clases || []).filter(function (c) { return c.pct > 0; })
        .sort(function (a, b) { return b.pct - a.pct; }).slice(0, 4);
      mapas.push({
        id: 'cobertura', titulo: 'Cobertura del suelo', grupo: grupoDeMapa('cobertura'),
        grande: !!MAPAS_ANCHOS.cobertura,
        svg: mini({ imagen: { url: cob.overlayImagen, limites: cob.overlayLimites, opacidad: 0.92 } }),
        conv: clases.map(function (c) {
          return { c: c.color, t: c.etq + ' ' + c.pct + '%', f: 'area' };
        }),
        /* La barra de cobertura, DEBAJO del raster. Iba en una caja aparte y
           «al verlas tan separadas confunde»: es la misma medición dibujada de
           dos formas, y se leen juntas o no se leen. */
        extra: (function () {
          var todas = (cob.clases || []).filter(function (c) { return c.pct > 0; })
            .sort(function (a, b) { return b.pct - a.pct; });
          if (!todas.length) return '';
          return '<div class="cobb">' + todas.map(function (x) {
              return '<i style="width:' + x.pct + '%;background:' + esc(String(x.color)) + '"></i>';
            }).join('') + '</div>' +
            todas.map(function (x) {
              return '<div class="f"><span><i class="mu mu-area" style="background:' + esc(String(x.color)) +
                '"></i> ' + esc(x.etq) + '</span><b>' + x.pct + '% · ' +
                Math.round(x.m2).toLocaleString('es-CO') + ' m²</b></div>';
            }).join('') +
            '<p class="nota">Medido sobre ' + esc(String(cob.malla || '')) + ' píxeles, a ' +
            (cob.mPorPx || '?') + ' m por píxel. No depende de que alguien lo haya mapeado.</p>';
        })(),
        pie: clases.length
          ? 'clasificada píxel a píxel sobre la foto satelital'
          : 'clasificada sobre la foto satelital'
      });
      if (cob.imagen) {
        mapas.push({
          id: 'foto', titulo: 'La foto satelital', grupo: grupoDeMapa('foto'),
          grande: !!MAPAS_ANCHOS.foto,
          svg: mini({ imagen: { url: cob.imagen, limites: cob.overlayLimites } }),
          pie: 'la misma imagen con la que se clasificó'
        });
      }
    }
    /* ── Hitos y nodos, con su nombre ───────────────────────────────────
       Se pidió «un mapeo exclusivo de hitos y nodos con los nombres, y
       puntos comerciales o parques importantes». La lista numerada ya
       existía; lo que no existía era verlos EN EL PLANO con su nombre al
       lado, que es como se usan en una lámina: «el 3 es el hospital, y el
       parque queda a dos cuadras». Van los hitos numerados y, en verde, los
       parques con nombre propio, que son los nodos que la gente usa para
       ubicarse aunque no pesen en el flujo peatonal. */
    var hitos = (st.hitos || []).filter(function (h) { return h.lat != null && h.lng != null; });
    var parques = pois.filter(function (p) {
      return /parque|plaza/i.test(p.sub || '') && p.nombre && /[a-záéíóú]/i.test(p.nombre) &&
             p.lat != null && p.lng != null;
    }).slice(0, 6);
    if (hitos.length) {
      mapas.push({
        id: 'hitos', titulo: 'Hitos y nodos', grupo: grupoDeMapa('hitos'),
        svg: mini({ rotulos: hitos.map(function (h) {
                      return { lat: h.lat, lng: h.lng, n: h.n, texto: h.nombre,
                               color: COL[h.grupo] || '#0A6F9E' };
                    }).concat(parques.map(function (p) {
                      return { lat: p.lat, lng: p.lng, texto: p.nombre, color: '#16A34A' };
                    })),
                    huellas: (o.huellas !== undefined ? o.huellas : S.trzHuellas) || [] }),
        conv: [{ c: '#0A6F9E', t: 'Hito numerado, con su nombre', f: 'punto' }]
          .concat(parques.length ? [{ c: '#16A34A', t: 'Parque o plaza con nombre', f: 'punto' }] : []),
        pie: hitos.map(function (h) { return h.n + ' ' + h.nombre; }).join(' · ')
      });
    }

    /* ── Alturas de lo construido, en planta ────────────────────────────
       «Faltó altura de lo construido»: las barras del reparto estaban, pero
       una lámina de morfología muestra DÓNDE están los edificios altos, no
       cuántos hay. Cada huella con el tono de sus pisos; las que no traen la
       altura, en gris, porque inventarles tres pisos sería dibujar una
       ciudad que no se midió. */
    var huellasA = (o.huellas !== undefined ? o.huellas : S.trzHuellas) || [];
    var pisosA = (o.pisos !== undefined ? o.pisos : S.trzPisos) || [];
    var conPisos = pisosA.filter(function (x) { return x != null; }).length;
    if (huellasA.length && conPisos >= 3) {
      var COLOR_PISOS = function (n) {
        if (n == null) return '#C9D3DC';
        if (n <= 1) return '#BFE3F7'; if (n <= 2) return '#5BB4E5';
        if (n <= 3) return '#0A6F9E'; return '#0B3A57';
      };
      mapas.push({
        id: 'alturas', titulo: 'Alturas de lo construido', grupo: grupoDeMapa('alturas'),
        svg: mini({ poligonos: huellasA.map(function (an, i) {
          return { pts: an, relleno: COLOR_PISOS(pisosA[i]), opacidad: 0.9, borde: '#0F1F2E', ancho: 0.2 };
        }) }),
        /* Solo los tonos que el dibujo pinta de verdad: una convención que
           nombra un color que no está manda a buscarlo. */
        conv: (function () {
          var usados = {};
          pisosA.slice(0, huellasA.length).forEach(function (n) { usados[COLOR_PISOS(n)] = 1; });
          return [{ c: '#BFE3F7', t: '1 piso', f: 'area' }, { c: '#5BB4E5', t: '2 pisos', f: 'area' },
                  { c: '#0A6F9E', t: '3 pisos', f: 'area' }, { c: '#0B3A57', t: '4 o más', f: 'area' },
                  { c: '#C9D3DC', t: 'Sin altura registrada', f: 'area' }]
            .filter(function (c) { return usados[c.c]; });
        })(),
        pie: conPisos + ' de ' + huellasA.length + ' edificios traen la altura registrada'
      });
    }

    /* ── Susceptibilidad a movimientos en masa, por pendiente ───────────
       «Falta gráfico y mapa de los movimientos de masa». El servicio del
       Servicio Geológico da el reparto del MUNICIPIO entero a 1:100.000, y a
       esa escala un predio no se lee: no hay mapa oficial del sector que
       dibujar. Lo que sí se midió es el terreno, y la pendiente es el primer
       factor de susceptibilidad de cualquier método: se clasifica cada celda
       del modelo de elevación en los cuatro rangos que usa la guía
       colombiana y se pinta. Se dice en el pie lo que es —susceptibilidad
       por pendiente, no amenaza calificada— para no vestir de dato oficial
       un cálculo del sitio. */
    var RJ = o.terrenoRejilla !== undefined ? o.terrenoRejilla : S.terRejilla;
    var susc = (function () { try { return susceptibilidadPendiente(RJ); } catch (e) { return null; } })();
    if (susc && susc.celdas.length) {
      mapas.push({
        id: 'masa', titulo: 'Susceptibilidad por pendiente', grupo: grupoDeMapa('masa'),
        svg: mini({ poligonos: susc.celdas.map(function (c) {
          return { pts: c.pts, relleno: c.color, opacidad: 0.78, borde: 'none' };
        }) }),
        conv: RANGOS_PENDIENTE.filter(function (r2) {
          return susc.celdas.some(function (c) { return c.rango === r2.id; });
        }).map(function (r2) {
          var q = susc.reparto[r2.id] || 0;
          return { c: r2.color, t: r2.etq + ' · ' + r2.rango + ' · ' + q + '%', f: 'area' };
        }),
        pie: 'pendiente del modelo de elevación, en los rangos de la guía de movimientos en masa; ' +
             'no es el mapa oficial de amenaza'
      });
    }

    var estr = o.estratos !== undefined ? o.estratos : S.estratos;
    if (estr && estr.manzanas && estr.manzanas.length) {
      mapas.push({
        id: 'estratos', titulo: 'Manzanas por estrato', grupo: grupoDeMapa('estratos'),
        svg: mini({ poligonos: estr.manzanas.map(function (mz) {
          return { pts: (mz.anillos && mz.anillos[0] || []).map(function (a) {
                     return { lat: a[0], lng: a[1] }; }),
                   relleno: mz.color, opacidad: 0.65, borde: '#ffffff', ancho: 0.4 };
        }) }),
        /* Un color por estrato, no uno por manzana: la leyenda dice la
           escala, y la escala es lo que se lee. */
        conv: (function () {
          var vistos = {}, salida = [];
          estr.manzanas.forEach(function (mz) {
            var e = mz.estrato != null ? mz.estrato : mz.nivel;
            if (e == null || vistos[e]) return;
            vistos[e] = 1;
            salida.push({ c: mz.color, t: 'Estrato ' + e, f: 'area', orden: Number(e) || 0 });
          });
          return salida.sort(function (a, b) { return a.orden - b.orden; }).slice(0, 7);
        })(),
        pie: estr.manzanas.length + ' manzanas del DANE'
      });
    }
    var hue = o.huellas !== undefined ? o.huellas : S.trzHuellas;
    if (hue && hue.length) {
      mapas.push({
        /* Al doble de ancho, con los dos rasters. Se pidió por su nombre:
           «no se ve con claridad los rasters o los llenos y vacíos». Cuáles
           van anchos está en `MAPAS_ANCHOS`, con el porqué. */
        id: 'llenos', titulo: 'Llenos y vacíos', grupo: grupoDeMapa('llenos'),
        grande: !!MAPAS_ANCHOS.llenos,
        svg: mini({ huellas: hue }),
        conv: [{ c: '#3B4A5A', t: 'Huella de edificio', f: 'area' },
               { c: '#F3F8FB', t: 'Sin construir', f: 'area' }],
        pie: hue.length + ' huellas de edificio' +
             (S.trazado && S.trazado.llenos ? ' · ' + S.trazado.llenos.pctLleno + '% construido' : '')
      });
    }
    var cv = o.curvas !== undefined ? o.curvas
           : (function () { try { return curvasDelTerreno(); } catch (e) { return null; } })();
    if (cv && cv.curvas && cv.curvas.length) {
      mapas.push({
        id: 'curvas', titulo: 'Curvas de nivel', grupo: grupoDeMapa('curvas'),
        svg: mini({ curvas: cv,
                    cortes: trazasDeCortes(o.terreno !== undefined ? o.terreno : S.terreno) }),
        conv: [{ c: '#8A5A20', t: 'Curva maestra · cada ' + (cv.intervalo * 5) + ' m', f: 'linea' },
               { c: '#B08050', t: 'Curva intermedia · cada ' + cv.intervalo + ' m', f: 'linea' }]
          .concat(trazasDeCortes(o.terreno !== undefined ? o.terreno : S.terreno).length
            ? [{ c: '#12202e', t: 'Corte topográfico', f: 'punteado' }] : []),
        pie: 'de ' + cv.zMin + ' a ' + cv.zMax + ' msnm'
      });
    }

    // ── 3 · Lo que le pasa al lote.
    var so = o.sombras !== undefined ? o.sombras
           : (function () { try { return sombrasDelLote(); } catch (e) { return null; } })();
    if (so && so.horas && so.horas.length) {
      var TINTE = { 9: '#F2B441', 12: '#7C4DFF', 15: '#0A6F9E' };
      var polis = [];
      so.horas.forEach(function (h) {
        (h.sombras || []).forEach(function (poli) {
          polis.push({ pts: poli, relleno: TINTE[h.hora] || '#3B4A5A', opacidad: 0.28 });
        });
      });
      if (polis.length) {
        mapas.push({
          id: 'sombras', titulo: 'La sombra de los vecinos', grupo: grupoDeMapa('sombras'),
          svg: mini({ poligonos: polis, huellas: (so.huellasCerca || []).map(function (e) { return e.anillo; }) }),
          /* Cuál mancha es de qué hora. El pie decía «9:00 → 20% · 12:00 →
             13%» y el dibujo tenía tres colores: había que adivinar cuál era
             cuál. */
          conv: so.horas.map(function (h) {
            return { c: TINTE[h.hora] || '#3B4A5A',
                     t: h.hora + ':00 · ' + h.pctLote + '% del lote', f: 'area' };
          }).concat([{ c: '#3B4A5A', t: 'Edificio vecino', f: 'area' }]),
          pie: 'sombra proyectada de los edificios de alrededor'
        });
      }
    }
    /* ── La jerarquía vial ────────────────────────────────────────────
       El mapa que faltaba: «que muestre y marque más las vías principales de
       un color verde por ejemplo y las secundarias de otro color». Es la
       lámina de movilidad de cualquier análisis urbano y hasta ahora la
       movilidad solo salía en cifras.

       Se dibuja de menor a mayor jerarquía para que las troncales queden
       ENCIMA: al revés, cien calles locales tapan la avenida y el mapa deja
       de mostrar la red para mostrar una maraña. */
    var vias = o.vias !== undefined ? o.vias : S.trzVias;
    var red = redPorJerarquia(vias);
    if (red.length) {
      var lineasV = [];
      JERARQUIA_VIAL.slice().reverse().forEach(function (j) {
        (vias || []).forEach(function (v) {
          if (jerarquiaVialDe(v.clase) !== j) return;
          if (!v.pts || v.pts.length < 2) return;
          lineasV.push({ pts: v.pts, color: j.color, ancho: j.ancho, opacidad: 0.95 });
        });
      });
      mapas.push({
        id: 'vias', titulo: 'Jerarquía vial', grupo: grupoDeMapa('vias'),
        grande: !!MAPAS_ANCHOS.vias,
        svg: mini({ lineas: lineasV }),
        conv: red.map(function (j) {
          return { c: j.color, t: j.etq + ' · ' + conComa(j.km) + ' km', f: 'linea' };
        }),
        pie: 'la red por jerarquía, de la troncal a la peatonal'
      });
    }
    var cam = o.caminata !== undefined ? o.caminata : S.caminata;
    if (cam && cam.tramos && cam.tramos.length) {
      var COLC = { 5: '#0A6F9E', 10: '#34CCFE', 15: '#B8DFF2' };
      var lineas = [], minDibujados = [];
      [15, 10, 5].forEach(function (min) {
        var antes = lineas.length;
        cam.tramos.forEach(function (t) {
          if (t.min !== min) return;
          lineas.push({ pts: [t.a, t.b], color: COLC[min], ancho: min === 5 ? 2.2 : 1.6 });
        });
        /* Solo los anillos que de verdad se dibujaron. Se listaban los tres
           siempre, y en un sector donde a los quince minutos ya no queda
           calle que recorrer la convención nombraba un color que el mapa no
           pinta: manda a buscar algo que no está. Lo cazó la prueba nueva de
           las convenciones el mismo día que se escribió. */
        if (lineas.length > antes) minDibujados.push(min);
      });
      mapas.push({
        id: 'caminata', titulo: 'Hasta dónde se camina', grupo: grupoDeMapa('caminata'),
        svg: mini({ lineas: lineas }),
        conv: minDibujados.slice().sort(function (a, b) { return a - b; }).map(function (min) {
          return { c: COLC[min], t: 'A ' + min + ' minutos a pie', f: 'linea' };
        }),
        pie: 'medido por las calles desde el lote, no en línea recta'
      });
    }
    /* Y el último, que es el único dibujado a mano: lo que vio quien caminó.
       Va al final de la banda a propósito —se lee después de todo lo medido,
       que es el orden en que hay que discutirlo—. */
    /* El acuerdo del curso, si lo hay. Va aparte del mapa de marcas y no
       encima: uno dice lo que vio cada quien y el otro, en qué coinciden, y
       encimarlos borraría justo la diferencia que vale. */
    if (S.intUnion && S.intUnion.hayAcuerdoPosible && S.intUnion.acuerdos.length) {
      var ac = S.intUnion.acuerdos;
      mapas.push({
        id: 'acuerdos', titulo: 'Dónde coincide el curso', grupo: grupoDeMapa('acuerdos'),
        svg: mini({ calor: ac.map(function (c) { return { lat: c.lat, lng: c.lng }; }),
                    calorColor: '#B3282C', calorRadio: 7,
                    puntos: ac.map(function (c) {
                      return { lat: c.lat, lng: c.lng, color: c.color }; }),
                    radioPunto: 2.2 }),
        conv: [{ c: '#B3282C', t: 'Sitio en el que coincidieron', f: 'punto' }],
        pie: ac.length + ' sitios donde coincidieron ' + S.intUnion.recorridos +
             ' recorridos hechos por separado'
      });
    }
    var IT = window.URBIS_INTANGIBLE;
    var marcas = o.intangible !== undefined ? o.intangible : S.intangible;
    if (IT && marcas && marcas.length) {
      var buenas = marcas.filter(IT.valida);
      if (buenas.length) {
        var zonasI = [], lineasI = [], puntosI = [];
        buenas.forEach(function (mk) {
          var c2 = IT.color(mk.tipo);
          if (mk.geom === 'zona') zonasI.push({ pts: mk.pts, relleno: c2, opacidad: 0.3,
                                                borde: c2, ancho: 0.6 });
          else if (mk.geom === 'linea') lineasI.push({ pts: mk.pts, color: c2, ancho: 2.6 });
          else puntosI.push({ lat: mk.pts[0].lat, lng: mk.pts[0].lng, color: c2 });
        });
        var cuenta = {};
        buenas.forEach(function (mk) { cuenta[mk.tipo] = (cuenta[mk.tipo] || 0) + 1; });
        mapas.push({
          id: 'intangible', titulo: 'Lo intangible', grupo: grupoDeMapa('intangible'),
          svg: mini({ poligonos: zonasI, lineas: lineasI, puntos: puntosI, radioPunto: 3 }),
          conv: Object.keys(cuenta).map(function (k) {
            return { c: IT.color(k), f: 'punto',
                     t: (IT.tipo(k) ? IT.tipo(k).nombre : k) + ' · ' + cuenta[k] };
          }),
          pie: 'lo que no se puede bajar de ningún servidor: lo marcó quien caminó'
        });
      }
    }
    /* Los rasters —la clasificación del suelo y la foto de la que salió— van
       primero y ocupan el doble de papel. Es lo que pidió el curso: en una
       lámina de arquitectura la imagen del territorio manda, y el resto de
       las capas son la lectura que se hace sobre ella. El orden de adentro de
       cada grupo no se toca (el `sort` de JavaScript es estable desde ES2019,
       y acá igual solo hay dos llaves). */
    mapas.sort(function (a, b) { return (b.grande ? 1 : 0) - (a.grande ? 1 : 0); });
    return mapas;
  }

  /* ── ¿Cabe? ────────────────────────────────────────────────────────────
     La comprobación que hasta ahora solo existía en las pruebas, puesta donde
     hace falta de verdad: en la mano de quien va a mandar el pliego a
     imprimir. En columnas, una caja que no cabe NO se recorta —se va a una
     columna que no existe y desaparece del papel sin dejar rastro—, así que
     mirar la pantalla no sirve para saberlo.

     Se arma la lámina en un marco escondido y se mide. Los milímetros del
     papel son medida absoluta, así que la hoja se dibuja a su tamaño real
     dentro del marco por chico que sea, y lo que se mide es lo que se va a
     imprimir. */
  /* ── La lámina que cabe ───────────────────────────────────────────────
     Arma el pliego y lo MIDE —una hoja de verdad, con sus fuentes y sus
     dibujos, en un marco escondido—; si el contenido se pasa, prueba con la
     rejilla más chica hasta que cierra. No estima: mide. Estimar el alto de
     veinte cajas con dibujos adentro es adivinar, y adivinar de menos es
     exactamente lo que hacía que las últimas cajas se imprimieran fuera del
     papel.

     Es SÍNCRONA, y eso no es un detalle de estilo. Escribir el documento en
     el marco y pedirle un rectángulo obliga al navegador a componer ahí
     mismo, así que no hace falta esperar a nada; y la búsqueda no vuelve a
     escribir el documento: cambia la reducción del mismo y vuelve a medir.
     Seis medidas sobre una composición que ya existe cuestan milisegundos.
     Si esto fuera asíncrono, cada sitio que arma una lámina —la vista de
     impresión, el PDF, la pestaña del sector— tendría que volverse
     asíncrono también, y una función que solo sirve para acomodar el papel
     no puede cambiarle la forma a media aplicación.

     Búsqueda por mitades entre 0,4 y 1: siete pasadas dejan la escala con
     menos de medio por ciento de error. Por qué el suelo es 0,5 está donde se
     usa, en `laminaImprimible`.

     Si no hay navegador donde medir —o algo falla—, devuelve la lámina tal
     cual, que es exactamente lo que había antes de esto: el peor caso de esta
     función es el caso de siempre y nunca deja a nadie sin lámina. */
  /* ── El tamaño de la letra del pliego ─────────────────────────────────
     Llegó medido, no de oído: «los textos están muy pequeños para estar en un
     pliego». Se montó la lámina real y se midió la letra sobre el papel. Daba
     1,35 mm —3,8 puntos— en una hoja de 60 × 90 cm. Eso no se lee ni de
     cerca, y explica de paso lo otro que se notó: a 120 puntos por pulgada,
     una letra de 3,8 puntos son seis píxeles de alto, así que se ve dentada
     por chica antes que por la resolución del PDF.

     La causa no es un descuido de tipografía: la hoja se encogía sin suelo
     hasta que el contenido cupiera, y con treinta y tres cajas y diez mapas
     eso da el 42 %. La misma lámina, medida quitando cajas hasta que cerrara
     sin encoger:

         letra 3,0 mm (8,5 pt) → caben 14 de 33 cajas
         letra 2,4 mm (6,8 pt) → caben 19
         letra 1,9 mm (5,5 pt) → caben 24
         letra 1,3 mm (3,8 pt) → caben 32     ← lo que hacía

     O sea que no hay ajuste que lo arregle: es un canje, y quien arma el
     pliego es el que tiene que elegir de qué lado ceder. Lo que sí se arregla
     es QUIÉN decide y si se dice: antes decidía el encogedor, en silencio.
     Ahora se elige el tamaño y lo que cede es el contenido —apagando cajas y
     diciendo cuáles—, no la legibilidad.

     `media` es lo que trae de fábrica: 1,9 mm es casi metro y medio más de
     letra que antes y todavía deja veinticuatro cajas. Quien quiera las
     treinta y tres las tiene a un toque en «Cabe todo». */
  /* `sacrifica` es la diferencia de fondo entre «cabe todo» y las otras dos,
     y por eso la primera se llama así: con ella NADA se apaga —la hoja se
     encoge hasta donde haga falta, que es lo que hacía siempre— y con las
     otras lo que cede es el contenido. Sin esa distinción, elegir el tamaño
     de fábrica habría empezado a tirar cajas por su cuenta, que es justo lo
     contrario de lo que se pidió antes: «no me dejes mapas a un lado». */
  var LETRAS_PLIEGO = [
    /* Piso 0,30 y, si ni así, se apagan cajas y se dice cuáles. Antes el
       piso era 0,40 sin sacrificio y lo que no cabía se RECORTABA en silencio
       por el borde de abajo: en el PDF real la síntesis entera —la
       conclusión— no salió y nadie avisó. Recortar sin decirlo es peor que
       apagar diciéndolo. */
    { id: 'todo',   t: 'Cabe todo',     piso: 0.30, mm: '1,1', sacrifica: true,
      pista: 'entran todas, letra de lupa' },
    { id: 'media',  t: 'Equilibrio',    piso: 0.62, mm: '2,2', sacrifica: true,
      pista: 'se lee de cerca, cabe casi todo' },
    { id: 'grande', t: 'Se lee de pie', piso: 0.80, mm: '2,9', sacrifica: true,
      pista: 'para colgar, con menos cajas' }
  ];
  /* De la escala de composición a milímetros de letra sobre el papel. El
     cuerpo de las cajas está puesto en 3 mm y se encoge con la hoja, así que
     la letra que sale es el producto. Decir «se compuso al 82 %» no le sirve
     a nadie —¿el 82 % de qué?—; decir «la letra sale a 2,5 mm» se compara con
     una regla. */
  /* El cuerpo de las cajas del pliego, en milímetros de papel. Es el número
     con el que la ficha traduce la escala de composición a «la letra sale a
     X mm», así que tiene que seguir al estilo: subió de 3 a 3,4 cuando se
     pidió la letra «un poquito más grande», y si se vuelve a tocar allá hay
     que tocarlo acá o la ficha empieza a prometer un tamaño que no es. */
  var CUERPO_MM = 3.6;
  function mmDeLetra(escala) {
    return conComa(Math.round(CUERPO_MM * (escala || 1) * 10) / 10);
  }

  function letraDePliego() {
    var id = S.pliegoLetra || 'todo';
    return LETRAS_PLIEGO.filter(function (x) { return x.id === id; })[0] || LETRAS_PLIEGO[1];
  }
  function pisoDeLetra(id) {
    var l = LETRAS_PLIEGO.filter(function (x) { return x.id === id; })[0];
    return (l || letraDePliego()).piso;
  }

  /* En qué orden se sacrifican las cajas cuando no caben todas al tamaño
     pedido. Se protegen las cuatro que hacen que un pliego sea un pliego: el
     plano, la ficha del sitio, la banda de mapas y la síntesis. Sin plano no
     se sabe de qué sector se habla; sin síntesis no hay conclusión, que es lo
     que un jurado lee primero.

     El resto cae de atrás hacia adelante, que es el orden en que lo haría
     quien arma la hoja: lo del cierre pesa menos que lo del sitio. */
  var PLIEGO_INTOCABLES = ['plano-del-sector', 'los-mapas-del-sector', 'el-sitio',
                           'sintesis-del-sector'];
  function ordenDeSacrificio(res, o) {
    var off = (o && o.pliegoOff !== undefined ? (o.pliegoOff || []) : (S.pliegoOff || []));
    var lista;
    try { lista = cajasDelPliego(res) || []; } catch (e) { return []; }
    return lista.filter(function (c) {
      return c.listo && PLIEGO_INTOCABLES.indexOf(c.id) === -1 && off.indexOf(c.id) === -1;
    }).map(function (c) { return c.id; }).reverse();
  }

  function laminaQueQuepa(res, opts) {
    var o = opts || {};
    var html;
    try { html = laminaImprimible(res, o); } catch (e) { return ''; }
    if (typeof document === 'undefined' || !document.body) return html;
    var marco = null;
    try {
      marco = document.createElement('iframe');
      marco.setAttribute('aria-hidden', 'true');
      marco.style.cssText = 'position:fixed;left:-9999px;top:0;width:420px;height:600px;' +
                            'border:0;visibility:hidden';
      document.body.appendChild(marco);
      var d = marco.contentDocument;
      if (!d) return html;
      d.open(); d.write(html); d.close();
      var rej = d.querySelector('.rej'), marcoR = d.querySelector('.rejilla');
      if (!rej || !marcoR) return html;
      var cabeEn = marcoR.getBoundingClientRect().height;
      if (!(cabeEn > 0)) return html;
      /* Se mide con `getBoundingClientRect`, que SÍ cuenta la reducción, y no
         con `offsetHeight`, que devuelve el tamaño sin reducir: con el segundo
         la medida no cambiaría por más que se encogiera y la búsqueda se iría
         siempre al mínimo. */
      var mide = function (k) {
        if (k >= 1) { rej.style.transform = ''; rej.style.width = ''; }
        else {
          rej.style.transformOrigin = 'top left';
          rej.style.transform = 'scale(' + k + ')';
          rej.style.width = (Math.round(1000 / k) / 10) + '%';
        }
        return rej.getBoundingClientRect().height <= cabeEn + 1;
      };
      if (mide(1)) { S.pliegoFuera = []; return html; }
      var piso = pisoDeLetra(o.letra);
      var bajo = piso, alto = 1, mejor = null;
      for (var i = 0; i < 7; i++) {
        var k = Math.round((bajo + alto) / 2 * 1000) / 1000;
        if (mide(k)) { mejor = k; bajo = k; } else { alto = k; }
      }
      if (mejor) { S.pliegoFuera = []; return laminaImprimible(res, Object.assign({}, o, { escala: mejor })); }

      /* Ni al piso cabe. Antes se mandaba el mínimo igual y la rejilla, que
         recorta, se comía lo que sobraba sin decir nada: la hoja salía de la
         impresora con tres cajas menos y nadie se enteraba hasta verla
         colgada.

         Ahora el tamaño de letra manda. Si a ese tamaño no cabe todo, lo que
         cede es el CONTENIDO y no la legibilidad: se apagan cajas —de las
         prescindibles y empezando por el final— hasta que la hoja cierre, y
         se deja dicho cuáles fueron. Están todas en el informe en hojas, que
         es el documento que no tiene que caber en un pliego.

         Se busca el número de cajas a apagar por bisección y no de a una: al
         mínimo son treinta y tres renderizados de una lámina con diez mapas,
         y eso en un teléfono es medio minuto de pantalla congelada. */
      /* «Cabe todo» no apaga nada: se manda el mínimo y ya, que es lo que se
         hacía antes de v743. Una hoja compuesta chiquita se lee con esfuerzo;
         una a la que le faltan cajas que alguien encendió a mano es una
         promesa rota. */
      var cual = LETRAS_PLIEGO.filter(function (x) { return x.id === (o.letra || S.pliegoLetra); })[0];
      if (cual && !cual.sacrifica) {
        S.pliegoFuera = [];
        return laminaImprimible(res, Object.assign({}, o, { escala: piso }));
      }
      var candidatos = ordenDeSacrificio(res, o);
      var apagadasYa = (o.pliegoOff !== undefined ? (o.pliegoOff || []) : (S.pliegoOff || []));
      var conN = function (n) {
        return laminaImprimible(res, Object.assign({}, o, {
          escala: piso, pliegoOff: apagadasYa.concat(candidatos.slice(0, n)) }));
      };
      var cabeConN = function (n) {
        d.open(); d.write(conN(n)); d.close();
        var r2 = d.querySelector('.rej'), m2 = d.querySelector('.rejilla');
        if (!r2 || !m2) return true;
        return r2.getBoundingClientRect().height <= m2.getBoundingClientRect().height + 1;
      };
      var bajoN = 0, altoN = candidatos.length, elegido = null;
      while (bajoN <= altoN) {
        var med = Math.floor((bajoN + altoN) / 2);
        if (cabeConN(med)) { elegido = med; altoN = med - 1; } else { bajoN = med + 1; }
      }
      if (elegido === null) {
        /* Ni apagándolas todas: es un sector con más mapas que papel. Se
           vuelve al comportamiento viejo —el mínimo absoluto— porque una hoja
           chiquita se lee y una vacía no. */
        S.pliegoFuera = candidatos.slice();
        return laminaImprimible(res, Object.assign({}, o, { escala: 0.4 }));
      }
      S.pliegoFuera = candidatos.slice(0, elegido);
      return conN(elegido);
    } catch (e) {
      return html;
    } finally {
      try { if (marco) marco.remove(); } catch (e2) {}
    }
  }
  /* Cuánto se redujo la última que se armó. Lo usa la ficha para decirlo, que
     es lo que evita que quien la cuelga descubra en el papel que la letra
     salió al 80 %. */
  function escalaDeLamina(html) {
    var m = String(html || '').match(/transform:scale\(([\d.]+)\)/);
    return m ? Number(m[1]) : 1;
  }

  function probarSiCabe(horizontal) {
    if (!S.resultado) return Promise.resolve(null);
    S.pliegoProbando = true; pintar();
    return new Promise(function (listo) {
      var marco = document.createElement('iframe');
      marco.setAttribute('aria-hidden', 'true');
      marco.style.cssText = 'position:fixed;left:-9999px;top:0;width:420px;height:600px;' +
                            'border:0;visibility:hidden';
      document.body.appendChild(marco);
      var terminar = function (r) {
        try { marco.remove(); } catch (e) {}
        S.pliegoProbando = false; S.pliegoCabe = r;
        pintar(); listo(r);
      };
      var reloj = setTimeout(function () {
        terminar({ error: 'La prueba tardó demasiado. Imprimí y mirá el papel.' });
      }, 9000);
      try {
        /* La misma que se va a imprimir: ajustada. Medir la de tamaño natural
           y decir «no cabe» de una lámina que después sale entera sería
           mentirle a quien la está armando; y esconderle que se compuso al
           82 % también, porque eso es lo que va a ver en el papel. */
        var html = laminaQueQuepa(S.resultado, { horizontal: !!horizontal, letra: S.pliegoLetra });
        var escala = escalaDeLamina(html);
        var d = marco.contentDocument;
        d.open(); d.write(html); d.close();
        setTimeout(function () {
          clearTimeout(reloj);
          try {
            var v = marco.contentWindow, dd = marco.contentDocument;
            var hoja = dd.querySelector('.hoja');
            var rej = dd.querySelector('.rej');
            var perdidas = [];
            if (rej) {
              var R = rej.getBoundingClientRect();
              Array.prototype.forEach.call(rej.children, function (c) {
                var b = c.getBoundingClientRect();
                if (b.height === 0 || b.right > R.right + 2) {
                  perdidas.push((c.querySelector('h2') || {}).textContent || 'una caja');
                }
              });
            }
            var sobra = hoja ? (hoja.scrollHeight - hoja.clientHeight) : 0;
            terminar({
              horizontal: !!horizontal,
              cabe: perdidas.length === 0 && sobra <= 2,
              perdidas: perdidas,
              // De píxeles a milímetros: es la unidad en la que está pensado
              // el papel y la única que le dice algo a quien lo va a imprimir.
              sobraMM: sobra > 2 ? Math.round(sobra / 3.7795) : 0,
              cajas: dd.querySelectorAll('.caja').length,
              bandas: dd.querySelectorAll('.banda').length,
              escala: escala,
              fuera: (S.pliegoFuera || []).slice()
            });
          } catch (e) { terminar({ error: 'No se pudo medir en este navegador.' }); }
        }, 700);
      } catch (e) {
        clearTimeout(reloj);
        terminar({ error: 'No se pudo armar la lámina para medirla.' });
      }
    });
  }

  /* ── Armar el pliego, en la ficha ──────────────────────────────────── */
  function bloquePliego(res) {
    if (!res) return '';
    var lista = cajasDelPliego(res);
    var listas = lista.filter(function (c) { return c.listo; });
    var puestas = listas.filter(function (c) { return c.on; });
    var grupos = ['La hoja', 'Lo que hay', 'El suelo', 'El lote', 'El trabajo del curso'];
    var cabe = S.pliegoCabe;
    return h4('plan', 'Armar el pliego') +
      '<p class="pcr-pista">Una lámina no se hace poniendo todo: se hace eligiendo. Hay <b>' +
      listas.length + '</b> caja' + (listas.length === 1 ? '' : 's') + ' con qué llenarse y llevás <b>' +
      puestas.length + '</b> puesta' + (puestas.length === 1 ? '' : 's') + '. Las grises necesitan una ' +
      'medición que todavía no está. <b>El PDF sale completo igual</b>: uno es la composición y el ' +
      'otro es el archivo.</p>' +
      '<div class="pcr-llevar">' +
        '<button type="button" data-pcr="pliego-todo" class="pcr-mini">' + ico('ok', 16) +
          'Poner todo</button>' +
        '<button type="button" data-pcr="pliego-nada" class="pcr-mini">' + ico('apagar', 16) +
          'Dejar solo el plano</button>' +
      '</div>' +
      /* ── El tamaño de la letra ────────────────────────────────────────
         Va ACÁ, con los interruptores de las cajas, y no en el bloque de
         exportar: es la misma decisión —cuánto entra en la hoja— vista por el
         otro lado, y separarlas haría que alguien apagara ocho cajas sin
         entender por qué le sobraba sitio. */
      '<p class="pcr-lab">El tamaño de la letra</p>' +
      '<p class="pcr-pista">Medido sobre el papel: hasta ahora la hoja se encogía sin suelo hasta ' +
      'que todo cupiera, y con treinta cajas eso deja la letra en <b>1,3 mm</b> —tres puntos y ' +
      'pico—, que no se lee ni de cerca. No hay ajuste que lo arregle: o entra todo, o se lee. ' +
      'Elegí de qué lado ceder; lo que no quepa <b>sigue entero en el informe en hojas</b>.</p>' +
      '<div class="pcr-capas pcr-letras">' +
        LETRAS_PLIEGO.map(function (l) {
          var on = l.id === (S.pliegoLetra || 'todo');
          return '<button type="button" class="pcr-capa' + (on ? ' on' : '') +
            '" data-pcr="pliego-letra" data-c="' + esc(l.id) + '"' +
            ' aria-pressed="' + (on ? 'true' : 'false') + '">' +
            '<i style="background:' + (on ? '#0A6F9E' : '#C7D3DD') + '"></i>' +
            '<span><b>' + esc(l.t) + ' · ' + esc(l.mm) + ' mm</b>' +
              '<small>' + esc(l.pista) + '</small></span>' +
          '</button>';
        }).join('') +
      '</div>' +
      /* Cuáles se quedaron fuera por el tamaño elegido. Se dice con nombre y
         apellido: «no cupieron nueve» sin decir cuáles es la misma sorpresa
         que había antes, solo que anunciada. */
      ((S.pliegoFuera || []).length
        ? '<p class="pcr-conc">A <b>' + esc(letraDePliego().mm) + ' mm</b> de letra no cabían <b>' +
          S.pliegoFuera.length + '</b> caja' + (S.pliegoFuera.length === 1 ? '' : 's') +
          ', así que la última lámina salió sin ' +
          conComaY(S.pliegoFuera.map(function (id) {
            var c = lista.filter(function (x) { return x.id === id; })[0];
            return c ? c.t : id;
          })) + '. Están todas en el informe en hojas.</p>'
        : '') +
      grupos.map(function (g) {
        var suyas = lista.filter(function (c) { return c.g === g; });
        if (!suyas.length) return '';
        return '<p class="pcr-lab">' + g + '</p>' +
          '<div class="pcr-capas">' +
            suyas.map(function (c) {
              return '<button type="button" class="pcr-capa' + (c.on && c.listo ? ' on' : '') +
                (c.listo ? '' : ' pcr-capa-gris') + '" data-pcr="pliego-caja" data-c="' +
                esc(c.id) + '"' + (c.listo ? '' : ' disabled') +
                ' aria-pressed="' + (c.on && c.listo ? 'true' : 'false') + '">' +
                '<i style="background:' + (c.listo ? (c.on ? '#0A6F9E' : '#C7D3DD') : '#E2E8F0') + '"></i>' +
                '<span><b>' + esc(c.t) + '</b>' +
                  '<small>' + esc(c.listo ? (c.dato || '') : c.falta) + '</small></span>' +
              '</button>';
            }).join('') +
          '</div>';
      }).join('') +
      /* Los recuadros de la banda. Van aparte de las cajas porque no compiten
         por el mismo papel: la banda tiene su franja y las cifras la suya. */
      (function () {
        if (pliegoApagada('Los mapas del sector')) {
          return '<p class="pcr-lab">La banda de mapas</p>' +
            '<p class="pcr-pista">Apagada entera. Encendé «Los mapas del sector» para elegir ' +
            'cuáles van.</p>';
        }
        var mps = mapasDisponibles(res);
        var listosM = mps.filter(function (m) { return m.listo; });
        var puestosM = listosM.filter(function (m) { return m.on; });
        /* Cuáles de los encendidos caben de verdad. El pliego no los encoge
           para que entren todos —así se llegó a los recuadros de sello—, así
           que acá hay que decirlo antes de imprimir y no después: un recuadro
           que se prometió y no salió parece una medición que no se hizo. Es
           el MISMO reparto que hace la lámina, a propósito. */
        return '<p class="pcr-lab">Los mapas del pliego · ' + puestosM.length + ' de ' +
          listosM.length + '</p>' +
          /* Que se sepa lo que cuesta encender el décimo. Entran TODOS los que
             se enciendan —eso no se negocia, cada uno costó una medición—,
             pero la hoja no crece: lo que cede es el tamaño con el que se
             compone todo. Dicho antes de imprimir, es una decisión; dicho
             después, es una sorpresa. */
          '<p class="pcr-pista">Cada mapa va en la banda de <b>su tema</b> y ocupa el doble de ' +
          'ancho que una caja de cifras. Entran <b>todos</b> los que enciendas; la hoja no crece, ' +
          'así que cuantos más pongas, más chica se compone. Con «probar si cabe» se ve a qué ' +
          'tamaño va a salir.</p>' +
          '<div class="pcr-capas">' +
            mps.map(function (m) {
              return '<button type="button" class="pcr-capa' + (m.on && m.listo ? ' on' : '') +
                (m.listo ? '' : ' pcr-capa-gris') + '" data-pcr="pliego-mapa" data-c="' +
                esc(m.id) + '"' + (m.listo ? '' : ' disabled') +
                ' aria-pressed="' + (m.on && m.listo ? 'true' : 'false') + '">' +
                '<i style="background:' + (m.listo ? (m.on ? '#0A6F9E' : '#C7D3DD') : '#E2E8F0') + '"></i>' +
                '<span><b>' + esc(m.t) + '</b>' +
                  '<small>' + esc(m.listo ? (m.dato || '') : (m.falta || '')) + '</small></span>' +
              '</button>';
            }).join('') +
          '</div>';
      })() +

      /* La prueba de encaje. Va al final porque solo tiene sentido cuando ya
         se eligió qué poner. */
      '<p class="pcr-lab">Antes de imprimir</p>' +
      '<p class="pcr-pista">En columnas, la caja que no cabe no se recorta: se va a una columna que ' +
      'no existe y <b>desaparece del papel</b> sin avisar. Esto arma la lámina y la mide antes de ' +
      'que salga la primera copia.</p>' +
      '<div class="pcr-llevar">' +
        '<button type="button" data-pcr="pliego-probar" class="pcr-mini pcr-llevar-b"' +
          (S.pliegoProbando ? ' disabled' : '') + '>' +
          (S.pliegoProbando ? 'Midiendo…' : ico('regla', 16) + 'Probar si cabe, parado') + '</button>' +
        '<button type="button" data-pcr="pliego-probar-h" class="pcr-mini pcr-llevar-b"' +
          (S.pliegoProbando ? ' disabled' : '') + '>' +
          (S.pliegoProbando ? 'Midiendo…' : ico('regla', 16) + 'Y acostado') + '</button>' +
      '</div>' +
      (cabe
        ? (cabe.error
            ? '<p class="pcr-error">' + esc(cabe.error) + '</p>'
            : cabe.cabe
              ? '<p class="pcr-conc pcr-cabe-si">Cabe ' + (cabe.horizontal ? 'acostado' : 'parado') +
                ': <b>' + cabe.cajas + '</b> cajas en <b>' + cabe.bandas +
                '</b> bandas, y no se pierde ninguna.' +
                /* Y a qué tamaño se compuso. Que la hoja se ajuste sola no
                   puede ser un secreto: quien la va a colgar tiene que saber
                   que la letra sale al 82 % y decidir si prefiere apagar una
                   caja y que salga entera. */
                (cabe.escala && cabe.escala < 0.995
                  ? ' La letra sale a <b>' + mmDeLetra(cabe.escala) + ' mm</b>' +
                    (cabe.escala < 0.55 ? ' —eso es letra de lupa: subí el tamaño acá arriba—' : '') +
                    '.'
                  : ' La letra sale a tamaño natural: <b>' + mmDeLetra(1) + ' mm</b>.') +
                ((cabe.fuera || []).length
                  ? ' A ese tamaño se dejaron fuera <b>' + cabe.fuera.length + '</b> caja' +
                    (cabe.fuera.length === 1 ? '' : 's') + ', que están en el informe en hojas.'
                  : '') +
                '</p>'
              : '<p class="pcr-conc pcr-cabe-no">No cabe ' +
                (cabe.horizontal ? 'acostado' : 'parado') + '. ' +
                (cabe.perdidas.length
                  ? 'Se ' + (cabe.perdidas.length === 1 ? 'pierde' : 'pierden') + ' <b>' +
                    esc(cabe.perdidas.join(', ')) + '</b>. '
                  : '') +
                (cabe.sobraMM
                  ? 'El contenido se pasa <b>' + cabe.sobraMM + ' mm</b> del papel. ' : '') +
                'Apagá una caja, o probá ' + (cabe.horizontal ? 'parado' : 'acostado') + '.</p>')
        : '');
  }

  function bloqueCapas(st) {
    var lista = capasDisponibles(st);
    var puestas = lista.filter(function (c) { return c.on; }).length;
    var listas = lista.filter(function (c) { return c.listo; }).length;
    /* El orden preferido, y DESPUÉS lo que no esté en él. La lista era fija y
       una capa de un grupo nuevo desaparecía del panel sin decir nada: la
       jerarquía vial se agregó con grupo «Cómo se mueve», salía en el pliego y
       no se podía encender sobre el mapa, y el síntoma era que el botón no
       existía. Un panel que decide qué mostrar por una lista escrita a mano
       vuelve a perder la siguiente. */
    var PREFERIDOS = ['Lo que hay', 'Cómo se mueve', 'El suelo', 'El lote'];
    var grupos = PREFERIDOS.slice();
    lista.forEach(function (c) {
      if (c.grupo && grupos.indexOf(c.grupo) === -1) grupos.push(c.grupo);
    });
    return h4('capas', 'Las capas del mapa') +
      '<p class="pcr-pista">Todo lo que se puede poner sobre el mapa, en un solo sitio. Hay <b>' +
      listas + '</b> capa' + (listas === 1 ? '' : 's') + ' disponible' + (listas === 1 ? '' : 's') +
      ' y <b>' + puestas + '</b> puesta' + (puestas === 1 ? '' : 's') + '. Las grises necesitan una ' +
      'medición que todavía no está.</p>' +
      '<div class="pcr-llevar">' +
        '<button type="button" data-pcr="capas-todo" class="pcr-mini">' + ico('ok', 16) +
          'Encender todo</button>' +
        '<button type="button" data-pcr="capas-nada" class="pcr-mini">' + ico('apagar', 16) +
          'Apagar todo</button>' +
      '</div>' +
      grupos.map(function (g) {
        var suyas = lista.filter(function (c) { return c.grupo === g; });
        if (!suyas.length) return '';
        return '<p class="pcr-lab">' + g + '</p>' +
          '<div class="pcr-capas">' +
            suyas.map(function (c) {
              return '<button type="button" class="pcr-capa' + (c.on ? ' on' : '') +
                (c.listo ? '' : ' pcr-capa-gris') + '" data-pcr="capa" data-c="' + esc(c.id) + '"' +
                (c.listo ? '' : ' disabled') + ' aria-pressed="' + (c.on ? 'true' : 'false') + '">' +
                '<i style="background:' + esc(c.color) + '"></i>' +
                '<span><b>' + esc(c.nombre) + '</b>' +
                  '<small>' + esc(c.listo ? (c.dato || '') : c.falta) + '</small></span>' +
              '</button>';
            }).join('') +
          '</div>';
      }).join('') +
      '<p class="pcr-pista">Encender varias a la vez es útil para comparar —el calor del comercio ' +
      'sobre los llenos y vacíos, por ejemplo— pero con más de tres el mapa deja de decir nada. ' +
      'Para la lámina, cada capa sale en su propio recuadro.</p>';
  }

  function bloqueQueFalta(st) {
    var lista = faltantesDelSector(st);
    if (!S.trazado) {
      return h4('campo', 'Lo que falta para que esto hable') +
        '<p class="pcr-pista">Con el <b>trazado del sector</b> medido, acá sale la lista de lo que ' +
        'hay que levantar en la salida y qué análisis enciende cada cosa.</p>';
    }
    if (!lista.length) {
      return h4('campo', 'Lo que falta para que esto hable') +
        '<p class="pcr-ok">No falta ninguno de los datos que este análisis sabe usar: pisos, anchos, ' +
        'andenes, nombres de calle y espacio público están registrados. El trabajo del curso acá es ' +
        '<b>verificar</b>, que también hace falta.</p>';
    }
    var bloques = lista.reduce(function (a, x) { return a + x.enciende.length; }, 0);
    return h4('campo', 'Lo que falta para que esto hable') +
      '<p class="pcr-tarea-intro">Media docena de bloques de esta ficha terminan diciendo «no se ' +
      'puede medir porque nadie lo mapeó». Junto, eso no es una limitación: es la <b>lista de ' +
      'tareas de la salida</b>. Estas ' + lista.length + ' encienden <b>' + bloques + '</b> ' +
      'análisis que hoy están vacíos, y van en orden de lo que más enciende por menos trabajo.</p>' +
      '<div class="pcr-falta">' +
        lista.map(function (x, i) {
          return '<div class="pcr-falta-item">' +
            '<div class="pcr-falta-cab">' +
              '<span class="pcr-falta-n">' + (i + 1) + '</span>' +
              '<b>' + esc(x.titulo) + '</b>' +
              '<code>' + x.etiqueta + '</code>' +
            '</div>' +
            '<p class="pcr-falta-hoy">Hoy: ' + esc(x.cuantos) + '.</p>' +
            '<p class="pcr-falta-enciende">Enciende: ' +
              x.enciende.map(function (e) { return '<i>' + esc(e) + '</i>'; }).join(' · ') + '</p>' +
            '<p class="pcr-pista">' + x.como + ' ' + esc(x.cuesta) + '</p>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<p class="pcr-pista">La etiqueta en gris es la que se escribe en OpenStreetMap. Lo que se ' +
      'levante vuelve a esta misma ficha: se mide el sector otra vez y los bloques vacíos se ' +
      'llenan solos.</p>';
  }

  // La misma lista en texto pelado, para el portapapeles y el PDF.
  function queFaltaComoTexto(st) {
    var lista = faltantesDelSector(st);
    if (!lista.length) return '';
    var L = ['LO QUE FALTA LEVANTAR (en orden de lo que más enciende)'];
    lista.forEach(function (x, i) {
      L.push('  ' + (i + 1) + '. ' + x.titulo + '  [' + x.etiqueta + ']');
      L.push('     hoy: ' + x.cuantos);
      L.push('     enciende: ' + x.enciende.join(', '));
    });
    return L.join('\n');
  }

  function queFaltaImpreso(st) {
    var lista = faltantesDelSector(st);
    if (!lista.length) return '';
    return '<h2>Lo que falta para que esto hable</h2>' +
      '<table class="plan">' +
        lista.map(function (x, i) {
          return '<tr><td class="g">' + (i + 1) + '. <span>' + esc(x.etiqueta) + '</span></td>' +
            '<td><b>' + esc(x.titulo) + '</b><br><em>Hoy: ' + esc(x.cuantos) + '. Enciende: ' +
            esc(x.enciende.join(', ')) + '.</em></td></tr>';
        }).join('') +
      '</table>' +
      '<p class="pie">En orden de lo que más análisis enciende por menos trabajo de campo. La ' +
      'etiqueta es la que se escribe en OpenStreetMap.</p>';
  }

  /* Lo que dice la lectura de la foto, en tres números y sin depender de cómo
     se llamen las clases: se busca por identificador y se acepta que falte. */
  function o2Cobertura() {
    var c = S.cobertura;
    if (!c || !(c.clases || []).length) return null;
    var de = function (id) {
      var x = (c.clases || []).filter(function (k) { return k.id === id; })[0];
      return x ? x.pct : null;
    };
    var verde = de('verde'), duro = de('construido'), agua = de('agua');
    if (verde == null && duro == null) return null;
    return { verde: verde, duro: duro, agua: agua };
  }

  function sintesisDelSector(res) {
    var st = (res && res.stats) || {}, meta = (res && res.meta) || {};
    var trz = S.trazado, ter = S.terreno, cli = S.clima;
    var favor = [], contra = [], falta = [];
    /* `amb` es el ámbito: 'int' para lo que es del sector mismo —su traza,
       sus usos, su lote— y 'ext' para lo que le viene de afuera —el clima,
       el terreno, el transporte de la ciudad, las amenazas—. Es lo que
       separa una FODA de una lista de pros y contras: fortalezas y
       debilidades son internas, oportunidades y amenazas externas, y sin la
       marca no se puede armar la matriz sin inventar. */
    var F = function (t, d, amb) { favor.push({ texto: t, dato: d, ambito: amb || 'int' }); };
    var C = function (t, d, amb) { contra.push({ texto: t, dato: d, ambito: amb || 'int' }); };
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
      if ((mv.rutas || []).length) F('Pasa transporte público por el área', (mv.rutas || []).length + ' rutas registradas', 'ext');
      else if (mv.paradasBus === 0) C('Sin paradas de transporte público registradas', '0 paradas', 'ext');
      if (mv.nViasArterias > 0) F('Conectado a la malla arterial de la ciudad', mv.nViasArterias + ' vías principales', 'ext');
      if (mv.viaPrincipal && mv.viaPrincipal.nombre)
        F('La ' + mv.viaPrincipal.nombre + ' es la puerta del sector: por ahí llega quien no vive acá',
          (mv.viaPrincipal.jerarquia || 'vía') + ' a ' + Math.round(mv.viaPrincipal.distM) + ' m', 'ext');
      if (mv.ciclorrutas > 0)
        F('Hay ciclorruta registrada: la bicicleta ya tiene por dónde', mv.ciclorrutas + ' tramos', 'ext');
      else if (mv.ciclorrutas === 0)
        T('Anotar por dónde circulan las bicicletas hoy, aunque no haya ciclorruta', 'sin ciclorruta registrada');
      if (mv.paradasBus > 0 && hab > 0) {
        var porParada = Math.round(hab / mv.paradasBus);
        if (porParada > 1500)
          C('Pocas paradas para la gente que vive acá', mv.paradasBus + ' paradas · ' +
            porParada.toLocaleString('es-CO') + ' hab. por parada', 'ext');
      }
    }

    /* ── La red vial, por jerarquía ─────────────────────────────────────
       Lo que el mapa de jerarquía muestra, dicho en frases. Un sector sin
       nada más que calles locales está encerrado aunque tenga todos los
       equipamientos del mundo; uno partido por una troncal tiene el problema
       contrario. Las dos cosas se ven en el reparto de kilómetros. */
    var redJ = redPorJerarquia(S.trzVias);
    if (redJ.length) {
      var kmTotal = redJ.reduce(function (a, j) { return a + j.metros; }, 0) / 1000;
      var buscarJ = function (id) {
        return redJ.filter(function (j) { return j.id === id; })[0] || null;
      };
      var mayores = ['troncal', 'principal', 'secundaria'].map(buscarJ).filter(Boolean);
      var kmMayores = mayores.reduce(function (a, j) { return a + j.metros; }, 0) / 1000;
      var pctMayores = kmTotal > 0 ? Math.round(100 * kmMayores / kmTotal) : 0;
      if (!mayores.length)
        C('Solo calles locales: el sector no está en la red de la ciudad', conComa(Math.round(kmTotal * 10) / 10) + ' km, todos locales');
      else if (pctMayores >= 30)
        C('Mucha vía de paso para lo chico que es el sector: la atraviesan más de los que llegan',
          pctMayores + '% de la red es de jerarquía mayor', 'ext');
      else if (pctMayores >= 8)
        F('La red tiene jerarquía: se distingue por dónde se pasa y por dónde se llega',
          conComa(Math.round(kmMayores * 10) / 10) + ' de ' + conComa(Math.round(kmTotal * 10) / 10) + ' km');
      else
        C('Casi toda la red es local: para salir hay que dar vuelta',
          pctMayores + '% de jerarquía mayor');
      var peat = buscarJ('peatonal');
      if (peat && kmTotal > 0 && Math.round(100 * peat.metros / kmTotal) >= 10)
        F('Hay red peatonal propia, no solo andenes al lado del carro',
          conComa(peat.km) + ' km de sendero y ciclovía');
      else if (!peat)
        T('Anotar los senderos y pasos peatonales que se usan y no están mapeados', 'sin red peatonal registrada');
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
        C('Clima cálido: sin sombra ni aire cruzado no se puede estar afuera', num(t.media) + '° de media', 'ext');
      if (vi.dominante && vi.dominante.rumbo)
        F('El viento entra del ' + vi.dominante.rumbo + ': por ahí se ventila', vi.dominante.pct + '% del tiempo', 'ext');
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

    /* ── La cobertura leída de la foto ──────────────────────────────────
       Es la única medición que no viene de un servidor de datos sino de la
       imagen, y dice lo que ningún atributo dice: cuánto de este sector es
       superficie dura. En Cúcuta eso es temperatura. */
    var cb = o2Cobertura();
    if (cb) {
      var verde = cb.verde, duro = cb.duro;
      if (verde != null) {
        if (verde >= 30) F('Un tercio del sector es vegetación viva: hay con qué dar sombra', conComa(verde) + '% verde');
        else if (verde < 12) C('Casi sin vegetación: el sector se calienta y no tiene con qué bajarlo', conComa(verde) + '% verde');
      }
      if (duro != null && duro >= 60)
        C('Suelo mayormente duro: el agua no infiltra y el calor se acumula', conComa(duro) + '% de superficie dura');
      if (cb.agua != null && cb.agua >= 3)
        F('Hay agua dentro del área: condiciona y da oportunidad al mismo tiempo', conComa(cb.agua) + '% de agua');
    } else if (S.resultado) {
      T('Leer la foto satelital: es lo único que dice cuánto verde y cuánto duro hay de verdad',
        'sin leer');
    }

    /* ── El lote, si está dibujado ──────────────────────────────────────
       Todo lo de arriba es del sector. Esto es del predio, que es donde se va
       a proponer algo, y es lo que un jurado pregunta primero. */
    var la = (function () { try { return analisisDelLote(); } catch (e) { return null; } })();
    if (la) {
      if (la.esquinero) F('Lote esquinero: da a ' + (la.frentes || []).length + ' calles', 'dos frentes o más');
      else if ((la.frentes || []).length === 1)
        C('Un solo frente: todo entra y sale por la misma calle', (la.frentes[0].metros || 0) + ' m de frente');
      if (la.sinFrenteM && la.perimetroM && la.sinFrenteM / la.perimetroM > 0.6)
        C('La mayor parte del perímetro no da a calle registrada: son medianeras o linderos',
          Math.round(100 * la.sinFrenteM / la.perimetroM) + '% del perímetro');
      if (la.critica)
        C('El lado ' + la.critica.i + ' es el que más se calienta: mira al poniente y hay que protegerlo',
          (la.critica.largoM || 0) + ' m de fachada al sol de la tarde');
      if (la.areaM2 >= 10000)
        F('Lote grande: cabe un proyecto con espacio libre propio, no solo el edificio',
          Number(la.areaM2).toLocaleString('es-CO') + ' m²');
      else if (la.areaM2 < 300)
        C('Lote chico: la norma de aislamientos se come buena parte de lo construible',
          Number(la.areaM2).toLocaleString('es-CO') + ' m²');
      if (la.nVecinos != null && la.nVecinos < 5)
        C('Casi nada registrado a menos de 200 m del lote: el proyecto llega antes que la ciudad',
          la.nVecinos + ' usos alrededor', 'ext');
    } else if (S.resultado) {
      T('Dibujar el lote: sin él el análisis es del sector y no del proyecto', 'sin lote');
    }

    /* ── Y el aviso que ninguna medición da ─────────────────────────────
       Una síntesis con dos renglones en contra y ninguno a favor no es un
       sector sin problemas: es un sector sin medir. Decirlo es más honesto
       que dejar tres viñetas y que alguien las lea como el diagnóstico. */
    var medidas = (ter ? 1 : 0) + (cli ? 1 : 0) + (trz ? 1 : 0) + (cb ? 1 : 0) + (la ? 1 : 0);
    if (medidas <= 2) {
      T('Esta síntesis sale de ' + medidas + ' de las cinco mediciones: terreno, clima, ' +
        'trazado, foto y lote. Con las otras dice bastante más',
        medidas + ' de 5 medidas');
    }

    /* ── Las amenazas del sitio, que faltaban ───────────────────────────
       Una FODA sin sismo ni inundación en una ciudad de laderas sobre el
       Pamplonita está incompleta. Cada una entra solo si se midió. */
    var amz = S.amenaza, inu = S.inundacion;
    if (amz && amz.nivel) {
      C('Amenaza sísmica ' + String(amz.nivel).toLowerCase() + ': la estructura se diseña para eso',
        (amz.aa != null ? 'Aa ' + conComa(amz.aa) : 'NSR-10'), 'ext');
      if (amz.masa && amz.masa.altaOMasPct >= 30)
        C('Municipio con mucha ladera en amenaza por movimientos en masa: mirar la pendiente del lote',
          conComa(amz.masa.altaOMasPct) + '% del municipio en alta o muy alta', 'ext');
    }
    /* Los campos son los mismos que lee la caja de la inundación: `trPeor`
       es el periodo de retorno de la mancha más frecuente que cubre el sitio,
       y está solo cuando el sitio cae dentro de alguna. */
    if (inu && inu.cobertura && inu.trPeor != null) {
      C('El sitio cae dentro de una mancha de inundación registrada: se inunda ' + (inu.frecuencia || 'cada tanto'),
        (inu.nombre || 'mancha del IDEAM') + ' · ' + inu.trPeor + ' años de retorno', 'ext');
    }
    var rd = (function () { try { return ruidoDelLote(); } catch (e) { return null; } })();
    if (rd && rd.dB >= 65) {
      C('Ruido del tránsito por encima del límite para vivienda: la fachada que da a la vía no es la de dormir',
        conComa(rd.dB) + ' dB(A) · límite 65', 'ext');
    }
    return { favor: favor, contra: contra, falta: falta, foda: fodaDe(favor, contra, falta) };
  }

  /* La matriz. Fortalezas y debilidades son lo interno; oportunidades y
     amenazas, lo externo. Lo que falta levantar en campo va con las
     oportunidades: cada tarea es una información que el proyecto todavía
     puede ganar, y una FODA de diagnóstico las pone ahí. */
  function fodaDe(favor, contra, falta) {
    var es = function (amb) { return function (x) { return (x.ambito || 'int') === amb; }; };
    return {
      fortalezas: favor.filter(es('int')),
      oportunidades: favor.filter(es('ext')).concat((falta || []).map(function (x) {
        return { texto: x.texto, dato: x.dato, tarea: true };
      })),
      debilidades: contra.filter(es('int')),
      amenazas: contra.filter(es('ext'))
    };
  }
  var FODA_CUADRANTES = [
    { id: 'fortalezas',    t: 'Fortalezas',    clase: 'ok',    que: 'lo que el sector tiene a favor' },
    { id: 'oportunidades', t: 'Oportunidades', clase: 'tarea', que: 'lo que viene de afuera y lo que falta levantar' },
    { id: 'debilidades',   t: 'Debilidades',   clase: 'no',    que: 'lo que el sector tiene en contra' },
    { id: 'amenazas',      t: 'Amenazas',      clase: 'riesgo', que: 'lo que le viene de afuera' }
  ];

  /* La misma matriz en pantalla que en el papel. Se pidió «agregar la
     matriz FODA» y la ficha seguía con tres listas —a favor, en contra,
     falta levantar— que eran la FODA sin decirlo: el que la leía en el
     teléfono y después en el pliego veía dos ordenamientos distintos de las
     mismas frases. Los cuatro cuadrantes, con lo que falta levantar dentro
     de las oportunidades y marcado como tarea. */
  var CLASE_FODA = { fortalezas: 'bien', oportunidades: 'oport', debilidades: 'mal', amenazas: 'riesgo' };
  function bloqueSintesis(res) {
    var s2 = sintesisDelSector(res);
    if (!s2.favor.length && !s2.contra.length && !s2.falta.length) return '';
    var fd = s2.foda || fodaDe(s2.favor, s2.contra, s2.falta);
    var col = function (q, lista) {
      if (!lista.length) return '';
      return '<p class="pcr-lab">' + esc(q.t) + ' <small>· ' + esc(q.que) + '</small></p>' +
        '<ul class="pcr-sintesis pcr-sintesis-' + CLASE_FODA[q.id] + ' pcr-foda-' + q.id + '">' +
          lista.map(function (x) {
            return '<li' + (x.tarea ? ' class="pcr-sx-tarea"' : '') + '><span>' + esc(x.texto) +
              '</span><b>' + esc(x.dato) + '</b></li>';
          }).join('') +
        '</ul>';
    };
    return h4('lista', 'Síntesis del sector') +
      '<p class="pcr-pista">Matriz FODA del sector: lo que dicen juntas todas las mediciones. Cada ' +
      'frase trae el número que la sostiene y solo aparece si ese número se midió. Fortalezas y ' +
      'debilidades son lo interno del sector; oportunidades y amenazas, lo que le viene de afuera.</p>' +
      FODA_CUADRANTES.map(function (q) { return col(q, fd[q.id] || []); }).join('');
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


  /* ── Devolverle el dato a OpenStreetMap ────────────────────────────────
     Sin esto, lo que el curso encuentra caminando se queda en la lámina y
     muere ahí. Un colegio que existe hace veinte años y no está en el mapa
     seguirá sin estar el semestre que viene, y el análisis del año entrante
     volverá a decir que el sector no tiene colegio.

     El archivo sale en formato .osm, que es el que abre JOSM. NO se sube
     desde acá y eso es a propósito: subir a OpenStreetMap se hace con la
     cuenta de una persona, que responde por lo que sube, y cada punto se
     revisa antes. Una carga automática de cientos de puntos es una
     importación, y las importaciones tienen sus propias reglas en la
     comunidad —se discuten antes— justamente para que nadie ensucie el mapa
     de una ciudad entera con un botón.

     Los identificadores van en negativo, que es como se marca «esto todavía
     no existe en el servidor»: JOSM los crea al subir. */

  /* De nuestra subcategoría a la etiqueta de OpenStreetMap.
     
     Hace falta porque lo que viaja al motor son etiquetas nuestras
     —`urbis:sub=drogueria`— y eso en OpenStreetMap no significa nada: subirlo
     sería ensuciar la base de datos de la ciudad con vocabulario privado.

     La tabla es corta a propósito. Solo están las subcategorías que tienen una
     etiqueta estándar y sin discusión para un PUNTO. Las que no —una vivienda,
     una bodega, un uso cultural genérico— se quedan fuera del archivo y salen
     en la lista para etiquetarlas a mano: en OpenStreetMap una etiqueta
     inventada o mal elegida cuesta más trabajo de limpiar que el que ahorró. */
  var SUB_A_OSM = {
    drogueria:    { amenity: 'pharmacy' },
    salud_ips:    { amenity: 'clinic' },
    bomberos:     { amenity: 'fire_station' },
    veterinaria:  { amenity: 'veterinary' },
    hogar_cuidado:{ amenity: 'social_facility' },
    colegio:      { amenity: 'school' },
    universidad:  { amenity: 'college' },
    gobierno:     { office: 'government' },
    policia:      { amenity: 'police' },
    gasolinera:   { amenity: 'fuel' },
    supermercado: { shop: 'supermarket' },
    comercio_otro:{ shop: 'yes' },
    bar_ocio:     { amenity: 'bar' },
    restaurante:  { amenity: 'restaurant' },
    cafe:         { amenity: 'cafe' },
    panaderia:    { shop: 'bakery' },
    ferreteria:   { shop: 'hardware' },
    banco:        { amenity: 'bank' },
    iglesia:      { amenity: 'place_of_worship' },
    deportivo:    { leisure: 'pitch' },
    parque:       { leisure: 'park' },
    transporte:   { amenity: 'parking' },
    hotel:        { tourism: 'hotel' },
    industria:    { man_made: 'works' }
  };

  // Etiquetas del levantamiento que SÍ son de OpenStreetMap y vale la pena
  // conservar cuando vienen.
  var TAGS_QUE_PASAN = ['name', 'building:levels', 'opening_hours', 'phone', 'website'];

  function etiquetasOSM(tags) {
    var t = tags || {};
    var sub = t['urbis:sub'];
    var base = sub && SUB_A_OSM[sub] ? SUB_A_OSM[sub] : null;
    if (!base) return null;
    var salida = {};
    Object.keys(base).forEach(function (k) { salida[k] = base[k]; });
    TAGS_QUE_PASAN.forEach(function (k) {
      if (t[k] !== undefined && t[k] !== '' && t[k] !== null) salida[k] = t[k];
    });
    return salida;
  }

  function construirOSM(comp) {
    var nuevos = (comp && comp.nuevos) || [];
    if (!nuevos.length) return '';
    var hoy = new Date().toISOString().slice(0, 10);
    var esc2 = function (t) {
      return String(t == null ? '' : t)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    };
    var nodos = [];
    nuevos.forEach(function (n) {
      var tags = etiquetasOSM(n.tags);
      // Sin etiqueta estándar no entra: mejor que falte a que ensucie.
      if (!tags) return;
      var i = nodos.length;
      var filas = Object.keys(tags).map(function (k) {
        return '    <tag k="' + esc2(k) + '" v="' + esc2(tags[k]) + '"/>';
      });
      /* `source=survey` es la etiqueta que dice «esto lo vi yo en la calle».
         Importa: es la diferencia entre un dato levantado y uno copiado, y es
         lo primero que mira quien revisa un cambio. */
      filas.push('    <tag k="source" v="survey"/>');
      filas.push('    <tag k="survey:date" v="' + hoy + '"/>');
      nodos.push('  <node id="-' + (i + 1) + '" action="modify" visible="true" ' +
        'lat="' + Number(n.lat).toFixed(7) + '" lon="' + Number(n.lng).toFixed(7) + '">\n' +
        filas.join('\n') + '\n  </node>');
    });
    if (!nodos.length) return '';
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<osm version="0.6" generator="URBIS · urbispro.city" upload="true">\n' +
      nodos.join('\n') + '\n</osm>\n';
  }

  /* La lista para revisar antes de subir. Va en texto plano porque se pega en
     un cuaderno, en un chat de grupo o en un documento compartido, que es
     donde de verdad se reparte el trabajo de un curso. */
  function conEtiquetaOSM(comp) {
    return ((comp && comp.nuevos) || []).filter(function (n) { return !!etiquetasOSM(n.tags); }).length;
  }

  function textoCorrecciones(comp) {
    if (!comp) return '';
    var l = [];
    var enlace = function (lat, lng) {
      return 'https://www.openstreetmap.org/edit#map=19/' +
        Number(lat).toFixed(5) + '/' + Number(lng).toFixed(5);
    };
    l.push('URBIS · lo que falta corregir en OpenStreetMap');
    l.push('Levantado en campo el ' + new Date().toLocaleDateString('es-CO'));
    l.push('');
    var nuevos = (comp.nuevos || []);
    if (nuevos.length) {
      l.push('AGREGAR (' + nuevos.length + ') — existen y no están en el mapa');
      nuevos.forEach(function (n, i) {
        var et = etiquetasOSM(n.tags);
        l.push('  ' + (i + 1) + '. ' + (n.nombre || 'sin nombre') +
               ' · ' + nombreGrupo(n.grupo || 'otro') +
               (et ? '' : '   [ETIQUETA A MANO]'));
        if (et) {
          l.push('     etiqueta: ' + Object.keys(et).map(function (k) {
            return k + '=' + et[k];
          }).join(', '));
        }
        l.push('     ' + enlace(n.lat, n.lng));
      });
      l.push('');
    }
    var disc = (comp.discrepancias || []);
    if (disc.length) {
      l.push('CORREGIR (' + disc.length + ') — el mapa dice una cosa y la calle otra');
      disc.forEach(function (d, i) {
        l.push('  ' + (i + 1) + '. ' + ((d.campo && d.campo.nombre) || (d.osm && d.osm.nombre) || 'sin nombre'));
        l.push('     el mapa dice: ' + nombreGrupo((d.osm && d.osm.grupo) || 'otro'));
        l.push('     se vio:       ' + nombreGrupo((d.campo && d.campo.grupo) || 'otro'));
        l.push('     ' + enlace(d.campo ? d.campo.lat : d.osm.lat, d.campo ? d.campo.lng : d.osm.lng));
      });
      l.push('');
    }
    l.push('Antes de subir: el dato tiene que ser lo que USTEDES vieron en la calle.');
    l.push('Copiar de Google Maps o de otro mapa con derechos hace que le reviertan');
    l.push('la contribución a todo el grupo. Cada punto se revisa y se sube desde');
    l.push('la cuenta de quien lo levantó.');
    return l.join('\n');
  }

  function descargarArchivo(texto, nombre, tipo) {
    try {
      var EXP = window.URBIS_PC_EXPORTAR;
      var blob = new Blob([texto], { type: tipo || 'text/plain;charset=utf-8' });
      if (EXP && typeof EXP.descargar === 'function') { EXP.descargar(blob, nombre); return true; }
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = nombre;
      document.body.appendChild(a); a.click();
      setTimeout(function () { try { a.remove(); URL.revokeObjectURL(url); } catch (e) {} }, 1500);
      return true;
    } catch (e) { return false; }
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
      'en la misma esquina son la misma droguería mal escrita.</p>' +
      bloqueDevolver(c);
  }

  /* ── Subirlo al mapa ───────────────────────────────────────────────────
     El paso que convierte el ejercicio en un aporte. Va con sus advertencias
     porque las dos que están acá son las que le cuestan a un curso entero que
     le reviertan el trabajo: subir con la cuenta de cada quien y no copiar de
     otro mapa. */
  function bloqueDevolver(c) {
    var nuevos = (c.nuevos || []).length, disc = (c.discrepancias || []).length;
    if (!nuevos && !disc) return '';
    var conTag = conEtiquetaOSM(c), sinTag = nuevos - conTag;
    return '<p class="pcr-lab">Devolverlo al mapa</p>' +
      '<p class="pcr-pista">Lo que encontraron puede volver a OpenStreetMap, y entonces deja de ser ' +
      'un dato de esta lámina para ser un dato de la ciudad: el semestre que viene el análisis ya ' +
      'lo va a tener.</p>' +
      '<div class="pcr-llevar">' +
        (conTag
          ? '<button type="button" data-pcr="osm" class="pcr-mini pcr-llevar-b">' + ico('exportar') +
            'Archivo para JOSM (' + conTag + ')</button>'
          : '') +
        '<button type="button" data-pcr="osm-texto" class="pcr-mini pcr-llevar-b">' + ico('lista') +
          'Lista para revisar</button>' +
      '</div>' +
      '<p class="pcr-pista">El archivo <b>no se sube solo</b>, y es a propósito: se abre en JOSM, se ' +
      'revisa punto por punto y lo sube <b>cada quien con su cuenta</b>, que es quien responde por lo ' +
      'que subió. Cargar cientos de puntos de una es una <i>importación</i>, y esas se discuten antes ' +
      'con la comunidad.</p>' +
      (sinTag
        ? '<p class="pcr-pista"><b>' + sinTag + ' de los ' + nuevos + '</b> no entran en el archivo: su ' +
          'uso no tiene una etiqueta estándar de OpenStreetMap para un punto —una vivienda, una ' +
          'bodega, un uso cultural genérico—. Salen igual en la lista, para ponerles la etiqueta a ' +
          'mano. Una etiqueta inventada cuesta más limpiarla que el trabajo que ahorra.</p>'
        : '') +
      '<p class="pcr-conc">Y lo más importante: el dato tiene que ser <b>lo que ustedes vieron en la ' +
      'calle</b>. Copiar de Google Maps o de cualquier mapa con derechos hace que le reviertan la ' +
      'contribución a todo el grupo, y con razón.</p>';
  }


  /* ── Comparar sectores entre sí ────────────────────────────────────────
     Hasta acá cada sector se lee solo, y solo no dice mucho: «4,8 m² de
     espacio público por habitante» no es bueno ni malo hasta que se pone al
     lado del sector de la otra mitad del curso. Es el ejercicio que cierra un
     semestre —cada grupo levanta el suyo y después se miran juntos— y todo el
     dato ya estaba guardado en las fichas.

     Dos reglas que hacen que la tabla se pueda defender:

     · Lo que un sector NO midió sale como raya, no como cero. Un sector sin
       terreno medido no tiene «0% de pendiente»: no tiene dato, y ponerle un
       cero lo haría ganar una fila que ni jugó.
     · Solo se señala el mejor donde «mejor» significa algo. Más espacio
       público por habitante es mejor y no hay discusión; más densidad o más
       porcentaje construido no: depende de qué se quiera. Esas filas van sin
       corona, y se dice por qué. */
  var FILAS_COTEJO = [
    { id: 'areaHa',    t: 'Tamaño',                 u: 'ha',      mejor: null,
      de: function (f) { return f.areaM2 ? Math.round(f.areaM2 / 1000) / 10 : null; } },
    { id: 'usos',      t: 'Usos registrados',       u: '',        mejor: null,
      de: function (f) { return f.total != null ? f.total : null; } },
    { id: 'densidad',  t: 'Usos por hectárea',      u: '',        mejor: null,
      de: function (f) { return f.stats && f.stats.densidadPorHa != null ? f.stats.densidadPorHa : null; } },
    { id: 'poblacion', t: 'Población estimada',     u: 'hab',     mejor: null,
      de: function (f) { return f.stats && f.stats.poblacionEstimada ? f.stats.poblacionEstimada : null; } },
    { id: 'mezcla',    t: 'Mezcla de usos',         u: '',        mejor: 'alto',
      de: function (f) { return f.stats && f.stats.mezcla ? f.stats.mezcla.indice : null; } },
    { id: 'ep',        t: 'Espacio público',        u: 'm²/hab',  mejor: 'alto',
      de: function (f) {
        var e = f.trazado && f.trazado.espacio, hab = f.stats && f.stats.poblacionEstimada;
        if (!e || !e.piezas || !hab) return null;
        return Math.round(10 * e.areaM2 / hab) / 10;
      } },
    { id: 'colegio',   t: 'Con colegio a 5 min',    u: '%',       mejor: 'alto',
      de: function (f) { return cobertura(f, 'educacion'); } },
    { id: 'salud',     t: 'Con salud a 10 min',     u: '%',       mejor: 'alto',
      de: function (f) { return cobertura(f, 'salud'); } },
    { id: 'parque',    t: 'Con parque a 5 min',     u: '%',       mejor: 'alto',
      de: function (f) { return cobertura(f, 'recreacion'); } },
    { id: 'mercar',    t: 'Con dónde mercar a 5 min', u: '%',     mejor: 'alto',
      de: function (f) { return cobertura(f, 'abastecimiento'); } },
    { id: 'lleno',     t: 'Suelo construido',       u: '%',       mejor: null,
      de: function (f) { return f.trazado && f.trazado.llenos ? f.trazado.llenos.pctLleno : null; } },
    { id: 'via',       t: 'Vía por hectárea',       u: 'km',      mejor: null,
      de: function (f) { return f.trazado && f.trazado.vias ? f.trazado.vias.kmPorHa : null; } },
    { id: 'cruces',    t: 'Tramo entre cruces',     u: 'm',       mejor: null,
      de: function (f) { return f.trazado && f.trazado.morfologia ? f.trazado.morfologia.tramoMedioM : null; } },
    { id: 'hd',        t: 'Altura ÷ ancho de calzada', u: '',     mejor: null,
      de: function (f) { return f.trazado && f.trazado.perfil ? f.trazado.perfil.relacion : null; } },
    { id: 'anden',     t: 'Vía con andén',          u: '%',       mejor: 'alto',
      de: function (f) {
        var p = f.trazado && f.trazado.perfil;
        return p && p.anden ? p.anden.conAndenPct : null;
      } },
    { id: 'pendiente', t: 'Pendiente media',        u: '%',       mejor: 'bajo',
      de: function (f) { return f.terreno && f.terreno.pendiente ? f.terreno.pendiente.media : null; } },
    { id: 'desnivel',  t: 'Desnivel',               u: 'm',       mejor: null,
      de: function (f) { return f.terreno && f.terreno.elevacion ? f.terreno.elevacion.relieve : null; } },
    { id: 'temp',      t: 'Temperatura media',      u: '°',       mejor: null,
      de: function (f) { return f.clima && f.clima.temperatura ? f.clima.temperatura.media : null; } },
    { id: 'nuevos',    t: 'Encontrados por el curso', u: '',      mejor: 'alto',
      de: function (f) { return f.campo ? (f.campo.nuevos || []).length : null; } }
  ];

  function cobertura(f, id) {
    var a = f.stats && f.stats.accesibilidad;
    if (!a || !a.categorias) return null;
    var c = a.categorias.filter(function (x) { return x.id === id; })[0];
    return c ? c.pctCubierto : null;
  }

  function fichasCotejadas() {
    var todas = leerFichas();
    return S.cotejo.map(function (id) {
      return todas.filter(function (f) { return f.id === id; })[0];
    }).filter(Boolean);
  }

  function alternarCotejo(id) {
    var i = S.cotejo.indexOf(id);
    if (i >= 0) S.cotejo.splice(i, 1);
    // Cuatro columnas es lo que cabe en un teléfono sin que la tabla se lea
    // con lupa. Más sectores no es más comparación: es menos.
    else if (S.cotejo.length < 4) S.cotejo.push(id);
    else S.avisoPestana = 'Se pueden comparar hasta cuatro sectores a la vez.';
  }

  function bloqueCotejo() {
    var fs = fichasCotejadas();
    if (fs.length < 2) {
      return S.cotejo.length === 1
        ? '<p class="pcr-pista pcr-cotejo-pista">Elegí <b>otro sector</b> para comparar con el que ' +
          'marcaste. Se pueden poner hasta cuatro lado a lado.</p>'
        : '';
    }
    var nombres = fs.map(function (f) { return f.nombre || ('Sector del ' + fmtFecha(f.ts)); });
    var filas = FILAS_COTEJO.map(function (fila) {
      var vals = fs.map(function (f) { return fila.de(f); });
      var conDato = vals.filter(function (v) { return v != null; });
      if (!conDato.length) return '';
      var gana = null;
      // El mejor solo se marca si hay con qué comparar: con un solo sector que
      // midió eso, ganar no significa nada.
      if (fila.mejor && conDato.length >= 2) {
        gana = fila.mejor === 'alto' ? Math.max.apply(null, conDato) : Math.min.apply(null, conDato);
        // Si empatan todos, nadie gana.
        if (conDato.every(function (v) { return v === gana; })) gana = null;
      }
      return '<tr><th scope="row">' + esc(fila.t) + '</th>' +
        vals.map(function (v) {
          if (v == null) return '<td class="pcr-cot-nd" title="No se midió en este sector">—</td>';
          var texto = (typeof v === 'number' ? String(v).replace('.', ',') : esc(String(v))) +
                      (fila.u ? ' ' + fila.u : '');
          return '<td' + (gana != null && v === gana ? ' class="pcr-cot-gana"' : '') + '>' +
            texto + '</td>';
        }).join('') +
        '</tr>';
    }).join('');

    return '<div class="pcr-cotejo">' +
      h4('comparar', 'Sectores lado a lado') +
      '<div class="pcr-cot-caja"><table class="pcr-cot-tabla">' +
        '<thead><tr><th></th>' +
          nombres.map(function (n) { return '<th scope="col">' + esc(n) + '</th>'; }).join('') +
        '</tr></thead><tbody>' + filas + '</tbody>' +
      '</table></div>' +
      '<p class="pcr-pista">La raya es <b>sin dato</b>, no cero: ese sector no midió eso. ' +
      'Solo se señala el mejor donde «mejor» quiere decir algo — más espacio público por ' +
      'habitante, más cobertura, menos pendiente. En densidad, en suelo construido o en la ' +
      'relación altura/ancho no hay un mejor: depende de qué se quiera del sector, y ahí la ' +
      'comparación es para discutirla, no para ganarla.</p>' +
      '<div class="pcr-llevar">' +
        '<button type="button" class="pcr-mini pcr-llevar-b" data-u52-call="pcr-cot-copiar">' +
          ico('copiar') + 'Copiar la tabla</button>' +
        '<button type="button" class="pcr-mini pcr-llevar-b" data-u52-call="pcr-cot-pdf">' +
          ico('imprimir') + 'Imprimir</button>' +
        '<button type="button" class="pcr-mini" data-u52-call="pcr-cot-limpiar">' +
          ico('borrar', 16) + 'Quitar todos</button>' +
      '</div>' +
    '</div>';
  }

  function cotejoComoTexto() {
    var fs = fichasCotejadas();
    if (fs.length < 2) return '';
    var nombres = fs.map(function (f) { return f.nombre || ('Sector del ' + fmtFecha(f.ts)); });
    var l = ['URBIS · sectores lado a lado', new Date().toLocaleDateString('es-CO'), ''];
    l.push(['Indicador'].concat(nombres).join('\t'));
    FILAS_COTEJO.forEach(function (fila) {
      var vals = fs.map(function (f) { return fila.de(f); });
      if (!vals.some(function (v) { return v != null; })) return;
      l.push([fila.t + (fila.u ? ' (' + fila.u + ')' : '')].concat(
        vals.map(function (v) { return v == null ? '—' : String(v).replace('.', ','); })
      ).join('\t'));
    });
    l.push('');
    l.push('La raya es sin dato, no cero: ese sector no midió eso.');
    return l.join('\n');
  }

  function cotejoImprimible() {
    var fs = fichasCotejadas();
    if (fs.length < 2) return '';
    var nombres = fs.map(function (f) { return f.nombre || ('Sector del ' + fmtFecha(f.ts)); });
    var filas = FILAS_COTEJO.map(function (fila) {
      var vals = fs.map(function (f) { return fila.de(f); });
      if (!vals.some(function (v) { return v != null; })) return '';
      return '<tr><td>' + esc(fila.t) + '</td>' +
        vals.map(function (v) {
          return '<td class="n">' + (v == null ? '—' : esc(String(v).replace('.', ',')) +
                 (fila.u ? ' ' + fila.u : '')) + '</td>';
        }).join('') + '</tr>';
    }).join('');
    return '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
      '<title>URBIS · sectores lado a lado</title><style>' +
      'body{font-family:Inter,system-ui,sans-serif;color:#0F1F2E;margin:24px;font-size:12px}' +
      'h1{font-size:18px;margin:0 0 4px}p.sub{color:#6B7A8A;margin:0 0 16px}' +
      'table{border-collapse:collapse;width:100%}' +
      'th,td{border-bottom:1px solid #E3EAF0;padding:6px 8px;text-align:left}' +
      'thead th{background:#F3F8FB;color:#0A6F9E;font-size:11px;text-transform:uppercase;letter-spacing:.08em}' +
      'td.n{text-align:right;font-variant-numeric:tabular-nums}' +
      /* Las redes, al pie: a la derecha y separadas por una raya fina, para
         que se lean como firma y no como una línea más del informe. */
      '.redes{display:flex;justify-content:flex-end;align-items:center;gap:16px;margin-top:18px;' +
        'padding-top:8px;border-top:1px solid #c7e7f7;color:#075E88;font-size:11px;letter-spacing:.04em}' +
      '.redes .red{display:inline-flex;align-items:center;gap:5px}' +
      '.redes .sitio{margin-right:auto;color:#6B7A8A}' +
      'p.pie{color:#6B7A8A;margin-top:14px;font-size:11px}' +
      '</style></head><body>' +
      '<h1>Sectores lado a lado</h1>' +
      '<p class="sub">URBIS · urbispro.city · ' + esc(new Date().toLocaleDateString('es-CO')) + '</p>' +
      '<table><thead><tr><th>Indicador</th>' +
        nombres.map(function (n) { return '<th>' + esc(n) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + filas + '</tbody></table>' +
      '<p class="pie">La raya es <b>sin dato</b>, no cero: ese sector no midió eso. En densidad, ' +
      'suelo construido y relación altura/ancho no hay un mejor: depende de qué se quiera del ' +
      'sector.</p>' +
      '<p class="redes"><span class="sitio">URBIS · urbispro.city</span>' + pieRedes(15) + '</p>' +
      '</body></html>';
  }


  /* ── La vista del curso ────────────────────────────────────────────────
     El profesor tiene treinta teléfonos levantando datos y ninguna forma de
     ver el conjunto. Sabe lo que le cuentan, no lo que hay. Esta vista
     responde las cuatro preguntas que se hace de verdad:

       ¿Cuánto se ha levantado?   ¿Quién levantó qué?
       ¿Qué parte de la ciudad quedó sin tocar?   ¿Qué está a medio llenar?

     Corre sobre los mismos puntos que el mapa ya cargó: no consulta nada, no
     cuesta nada y funciona con la app abierta en el salón.

     Solo la ve quien administra. No por secreto —los puntos están a la vista
     de todos en el mapa— sino porque una tabla que ordena a las personas por
     cuánto produjeron no es algo que deba estar en la pantalla de cada
     estudiante: eso lo mira un profesor para repartir el trabajo, no el curso
     para compararse entre sí. */
  function esProfesor() {
    try {
      if (typeof window.urbisEsAdmin === 'function' && window.urbisEsAdmin()) return true;
      var s2 = JSON.parse(localStorage.getItem('urbis_auth_session_v1') || '{}');
      return !!(s2 && (s2.es_admin || s2.rol === 'admin' || s2.rol === 'gov'));
    } catch (e) { return false; }
  }

  function resumenDelCurso() {
    var pts = puntosDelCurso();
    if (!pts.length) return null;
    var AUT = window.URBIS_AUTOR, EDIF = window.URBIS_EDIFICIO;
    var ahora = Date.now(), DIA = 86400000;
    var porAutor = {}, porUso = {};
    var hoy = 0, semana = 0, conFicha = 0, sinNada = 0, edificios = 0;
    var faltaPisos = 0, faltaMaterial = 0, faltaEpoca = 0;

    pts.forEach(function (p) {
      var quien = (AUT && AUT.de ? AUT.de(p.descripcion).nombre : '') || 'Sin nombre';
      var cuando = AUT && AUT.cuando ? AUT.cuando(p) : null;
      var a = porAutor[quien] || (porAutor[quien] = { n: 0, ultima: null, conFicha: 0 });
      a.n++;
      if (cuando && (!a.ultima || cuando > a.ultima)) a.ultima = cuando;
      if (cuando) {
        var dif = ahora - cuando.getTime();
        if (dif < DIA) hoy++;
        if (dif < 7 * DIA) semana++;
      }

      // El uso es la cabeza de la etiqueta: «Comercial · Tienda | …».
      var cabeza = String(p.descripcion || '').split(' | ')[0];
      var uso = (cabeza.split('·')[0] || '').trim() || 'Sin uso';
      porUso[uso] = (porUso[uso] || 0) + 1;

      /* La ficha del edificio es la parte cara del levantamiento —hay que
         pararse enfrente y mirar— así que es la que conviene vigilar. Solo
         cuenta donde tiene sentido: un poste de luz no tiene pisos. */
      /* La categoría del reporte —«Vivienda y Residencial», «Comercio y
         Servicios»— viaja en `tipo`, no en la descripción. Un poste de luz no
         tiene pisos, así que la ficha solo se le exige a lo que es un
         edificio. */
      if (EDIF && typeof EDIF.esCategoriaEdificio === 'function' &&
          typeof EDIF.faltantes === 'function' && EDIF.esCategoriaEdificio(p.tipo)) {
        edificios++;
        var falta = EDIF.faltantes(p.descripcion);
        if (falta.pisos) faltaPisos++;
        if (falta.materialidad) faltaMaterial++;
        if (falta.epoca) faltaEpoca++;
        if (!falta.pisos && !falta.materialidad && !falta.epoca) { conFicha++; a.conFicha++; }
        else if (falta.pisos && falta.materialidad && falta.epoca) sinNada++;
      }
    });

    var autores = Object.keys(porAutor).map(function (k) {
      return { nombre: k, n: porAutor[k].n, ultima: porAutor[k].ultima, conFicha: porAutor[k].conFicha };
    }).sort(function (x, y) { return y.n - x.n; });

    var usos = Object.keys(porUso).map(function (k) { return { uso: k, n: porUso[k] }; })
      .sort(function (x, y) { return y.n - x.n; });

    // Qué sectores guardados ya tienen trabajo de campo adentro y cuáles no.
    var sectores = leerFichas().map(function (f) {
      var dentro = pts.filter(function (p) { return puntoEnFicha(p, f); }).length;
      return { nombre: f.nombre || ('Sector del ' + fmtFecha(f.ts)), n: dentro,
               osm: f.total || 0, id: f.id };
    }).sort(function (x, y) { return x.n - y.n; });

    return {
      total: pts.length, hoy: hoy, semana: semana,
      autores: autores, usos: usos, sectores: sectores,
      edificios: edificios, conFicha: conFicha, sinNada: sinNada,
      faltaPisos: faltaPisos, faltaMaterial: faltaMaterial, faltaEpoca: faltaEpoca
    };
  }

  /* ¿Este punto cae dentro de este sector? El polígono se resuelve con el
     mismo algoritmo de siempre; el radio, por distancia al centro. */
  function puntoEnFicha(p, f) {
    var lat = parseFloat(String(p.lat || '').replace(',', '.'));
    var lng = parseFloat(String(p.lng || '').replace(',', '.'));
    if (!isFinite(lat) || !isFinite(lng)) return false;
    if (f.forma === 'poligono' && f.poligono && f.poligono.length >= 3) {
      // El par-impar ya está escrito y probado en js/24: se pide prestado en
      // vez de tener dos versiones del mismo algoritmo que puedan discrepar.
      var A = window.URBIS_PC_ANALISIS;
      if (!A || typeof A.dentroDelPoligono !== 'function') return false;
      return A.dentroDelPoligono(lat, lng, f.poligono);
    }
    if (!f.centro || !isFinite(f.centro.lat)) return false;
    return haversineM({ lat: lat, lng: lng }, f.centro) <= (f.radioM || 0);
  }

  function bloqueCurso() {
    if (!esProfesor()) return '';
    var r = resumenDelCurso();
    if (!r) {
      return '<div class="pcr-curso">' +
        h4('perfil', 'Vista del curso') +
        '<p class="pcr-pista">Todavía no hay puntos levantados en este dispositivo. Cuando el curso ' +
        'empiece a mapear, acá vas a ver cuánto lleva cada quien y qué parte de la ciudad falta.</p>' +
        '</div>';
    }
    var sinTocar = r.sectores.filter(function (x) { return x.n === 0; });
    var fmt = function (d) {
      if (!d) return 'sin fecha';
      var A = window.URBIS_PC_ANALISIS;
      return (A && typeof A.haceCuanto === 'function') ? A.haceCuanto(d.toISOString()) : fmtFecha(d);
    };

    return '<div class="pcr-curso">' +
      h4('perfil', 'Vista del curso') +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + r.total + '</b><small>puntos levantados</small></div>' +
        '<div class="pcr-kpi"><b>' + r.semana + '</b><small>en los últimos 7 días</small></div>' +
        '<div class="pcr-kpi"><b>' + r.autores.length + '</b><small>personas mapeando</small></div>' +
      '</div>' +

      '<p class="pcr-lab">Quién levantó cuánto</p>' +
      '<div class="pcr-niveles">' +
        r.autores.slice(0, 12).map(function (a) {
          var pct = Math.round(100 * a.n / r.autores[0].n);
          return '<div class="pcr-nivel">' +
            '<span class="pcr-nivel-nom">' + esc(a.nombre) +
              '<small class="pcr-nivel-sub">' + esc(fmt(a.ultima)) + '</small></span>' +
            '<span class="pcr-nivel-barra"><i style="width:' + pct + '%"></i></span>' +
            '<span class="pcr-nivel-n">' + a.n + '</span>' +
          '</div>';
        }).join('') +
      '</div>' +
      (r.autores.length > 12 ? '<p class="pcr-pista">Y ' + (r.autores.length - 12) + ' personas más.</p>' : '') +

      '<p class="pcr-lab">Qué se levantó</p>' +
      r.usos.slice(0, 8).map(function (u) {
        return '<div class="pcr-lote-fila"><span>' + esc(u.uso) + '</span><b>' + u.n + '</b></div>';
      }).join('') +

      (r.edificios
        ? '<p class="pcr-lab">La ficha del edificio, que es la parte cara</p>' +
          '<div class="pcr-kpis">' +
            '<div class="pcr-kpi"><b>' + Math.round(100 * r.conFicha / r.edificios) + '%</b>' +
              '<small>completas de ' + r.edificios + '</small></div>' +
            '<div class="pcr-kpi"><b>' + r.faltaPisos + '</b><small>sin pisos</small></div>' +
            '<div class="pcr-kpi"><b>' + r.faltaEpoca + '</b><small>sin época</small></div>' +
          '</div>' +
          '<p class="pcr-pista">Sin pisos no hay alturas ni perfil de calle; sin época no hay lectura ' +
          'de vulnerabilidad. Son los dos campos que más rinden y los que más se saltan.</p>'
        : '') +

      (r.sectores.length
        ? '<p class="pcr-lab">Qué parte de la ciudad tiene trabajo de campo</p>' +
          r.sectores.slice(0, 10).map(function (x) {
            return '<div class="pcr-lote-fila' + (x.n === 0 ? ' pcr-curso-vacio' : '') + '">' +
              '<span>' + esc(x.nombre) + '</span><b>' +
              (x.n === 0 ? 'sin tocar' : x.n + ' punto' + (x.n === 1 ? '' : 's')) + '</b></div>';
          }).join('') +
          (sinTocar.length
            ? '<p class="pcr-conc"><b>' + sinTocar.length + ' de ' + r.sectores.length +
              '</b> sectores analizados no tienen todavía un solo punto levantado. Ahí es donde hay ' +
              'que mandar gente.</p>'
            : '<p class="pcr-conc">Todos los sectores analizados tienen ya trabajo de campo adentro.</p>')
        : '<p class="pcr-pista">Analizá y guardá sectores para ver qué parte de la ciudad tiene ya ' +
          'trabajo de campo y cuál no.</p>') +

      '<div class="pcr-llevar">' +
        '<button type="button" class="pcr-mini pcr-llevar-b" data-u52-call="pcr-curso-csv">' +
          ico('exportar') + 'Planilla por estudiante (CSV)</button>' +
      '</div>' +
      '<p class="pcr-pista">La planilla trae una fila por persona con lo que levantó y cuándo fue la ' +
      'última vez. Se abre en Excel o en una hoja de cálculo.</p>' +
    '</div>';
  }

  function cursoComoCSV() {
    var r = resumenDelCurso();
    if (!r) return '';
    /* Punto y coma y no coma: en un Excel en español la coma es el separador
       decimal, y un archivo separado por comas se abre todo en una columna.
       Es la diferencia entre una planilla y un problema. */
    var l = ['Nombre;Puntos levantados;Fichas de edificio completas;Última vez'];
    r.autores.forEach(function (a) {
      l.push([
        String(a.nombre).replace(/[;\n\r]+/g, ' '),
        a.n, a.conFicha,
        a.ultima ? a.ultima.toLocaleString('es-CO') : 'sin fecha'
      ].join(';'));
    });
    return l.join('\n');
  }


  // ═══════════════════════════════════════════════════════════════════════
  // EL LOTE
  // El área dice qué hay alrededor. El lote dice dónde se va a proponer algo.
  // Son dos preguntas distintas y por eso son dos dibujos distintos: el sector
  // en celeste, el lote en amarillo, y cada uno con su análisis.
  // ═══════════════════════════════════════════════════════════════════════
  var capaLote = null;
  var clickLote = null;

  function pintarLote() {
    var m = mapa();
    if (!m || typeof L === 'undefined') return;
    if (capaLote) { try { m.removeLayer(capaLote); } catch (e) {} capaLote = null; }
    var pts = S.lote || [];
    if (!pts.length) return;

    capaLote = L.layerGroup();
    /* Amarillo, y con relleno bajo: encima va a haber puntos de usos y a
       veces las huellas de los edificios. Un amarillo opaco taparía justo lo
       que hay que ver dentro del lote. */
    var estilo = { color: '#B8860B', weight: 3, opacity: 1,
                   fillColor: '#FFD54F', fillOpacity: 0.28 };
    try {
      if (pts.length >= 3) {
        L.polygon(pts.map(function (p) { return [p.lat, p.lng]; }), estilo).addTo(capaLote);
      } else if (pts.length === 2) {
        L.polyline(pts.map(function (p) { return [p.lat, p.lng]; }),
          { color: '#B8860B', weight: 3, dashArray: '6 4' }).addTo(capaLote);
      }
      /* Cada lado con el color de cuánto sol de la tarde recibe. Antes solo
         la fachada crítica iba en rojo, y las demás como si no les diera:
         llegó en captura que «al lado de esa línea roja también pega el sol».
         Solo con el lote cerrado y analizado; mientras se dibuja, no hay
         lados que leer. */
      if (pts.length >= 3 && !S.loteDibujando && S.resultado) {
        var an = null;
        try { an = analisisDelLote(); } catch (e) { an = null; }
        ((an && an.lados) || []).forEach(function (l) {
          if (!l.a || !l.b || !l.nivelSol) return;
          var pl = L.polyline([[l.a.lat, l.a.lng], [l.b.lat, l.b.lng]], {
            color: l.nivelSol.color, weight: 6, opacity: .95, lineCap: 'butt'
          }).addTo(capaLote);
          try {
            pl.bindTooltip('Lado ' + l.i + (l.via ? ' · ' + l.via : '') + ' · mira al ' +
              ((l.mira && l.mira.nombre) || '—') + ' · ' + l.nivelSol.nombre, { sticky: true });
          } catch (e) {}
        });
      }
      // Las esquinas, para poder ver dónde se tocó y volver atrás con criterio.
      pts.forEach(function (p, i) {
        L.circleMarker([p.lat, p.lng], {
          radius: i === 0 && S.loteDibujando ? 8 : 5,
          color: '#7A5901', weight: 2, fillColor: '#FFD54F', fillOpacity: 1
        }).addTo(capaLote);
      });
    } catch (e) {}
    capaLote.addTo(m);
    try { if (capaLote.bringToFront) capaLote.bringToFront(); } catch (e) {}
  }

  function iniciarLote() {
    olvidarHistoria('lote');
    var m = mapa();
    if (!m) { S.loteAviso = 'El mapa todavía no está listo.'; pintar(); return; }
    soltarOtrosLapices('lote');
    S.lote = []; S.loteDibujando = true; S.loteAviso = '';
    /* Acercar antes de dibujar. A la escala en que se ve un sector entero, un
       lote de veinte metros mide diez píxeles: no se puede marcar una esquina
       con el dedo y, peor, la cuarta esquina cae tan cerca de la primera que
       cierra el lote sola antes de tiempo. Se acerca a 18, que es la escala a
       la que una manzana ocupa la pantalla. */
    try {
      if (m.getZoom && m.getZoom() < 18) m.setZoom(18);
    } catch (e) {}
    pintarLote();
    // La hoja se encoge sola: no se puede dibujar sobre un mapa tapado.
    S.encogida = true;
    if (!clickLote) {
      clickLote = function (ev) {
        if (!S.loteDibujando || !ev || !ev.latlng) return;
        agregarPuntoLote(ev.latlng.lat, ev.latlng.lng);
      };
    }
    try { m.on('click', clickLote); } catch (e) {}
    try { m.getContainer().style.cursor = 'crosshair'; } catch (e) {}
    pintar(); pintarBarraLote();
  }

  /* Un «control zeta» de verdad para los lápices de esta hoja.

     `deshacer` quitaba el último punto y ya. Desde que también se puede
     BORRAR un vértice del medio —tocándolo, que es lo que se pidió—, quitar
     el último dejaría de deshacer lo último que hizo la persona. Se guarda el
     estado anterior antes de cada cambio.

     Y el vértice se busca en PÍXELES de pantalla y no en metros, por lo mismo
     que el cierre: lo que el dedo percibe es la distancia en pantalla, y a
     poco zoom veintiséis píxeles son muchos metros. El primer vértice no se
     borra: tocarlo cierra la figura, que es lo que la barra viene diciendo y
     lo que la gente ya tiene aprendido. */
  function recordarPuntos(clave, pts) {
    S.historias = S.historias || {};
    var h = S.historias[clave] || (S.historias[clave] = []);
    h.push((pts || []).map(function (p) { return { lat: p.lat, lng: p.lng }; }));
    if (h.length > 60) h.shift();
  }

  function hayQueDeshacer(clave) {
    return !!(S.historias && S.historias[clave] && S.historias[clave].length);
  }

  function deshacerPuntos(clave) {
    if (!hayQueDeshacer(clave)) return null;
    return S.historias[clave].pop();
  }

  function olvidarHistoria(clave) {
    if (S.historias) S.historias[clave] = [];
  }

  // Devuelve el índice del vértice tocado, o -1. Nunca el primero.
  function verticeTocado(pts, lat, lng) {
    if (!pts || pts.length < 2) return -1;
    var m = mapa(); if (!m) return -1;
    var cual = -1, mejor = 27;
    try {
      var b = m.latLngToContainerPoint({ lat: lat, lng: lng });
      for (var i = 1; i < pts.length; i++) {
        var a = m.latLngToContainerPoint(pts[i]);
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < mejor) { mejor = d; cual = i; }
      }
    } catch (e) { return -1; }
    return cual;
  }

  function agregarPuntoLote(lat, lng) {
    if (!S.loteDibujando) return;
    var pts = S.lote || (S.lote = []);
    /* Tocar cerca del primer vértice cierra el lote. Se mide en PÍXELES y no
       en metros: con el dedo, lo que la persona percibe es la distancia en
       pantalla, y a poco zoom veinte metros son un punto. */
    if (pts.length >= 3) {
      try {
        var m = mapa();
        var a = m.latLngToContainerPoint(pts[0]);
        var b = m.latLngToContainerPoint({ lat: lat, lng: lng });
        if (Math.hypot(a.x - b.x, a.y - b.y) <= 26) { cerrarLote(); return; }
      } catch (e) {}
    }
    // Tocar un vértice ya puesto lo quita, en vez de amontonar otro encima.
    var cual = verticeTocado(pts, lat, lng);
    if (cual > 0) {
      recordarPuntos('lote', pts);
      pts.splice(cual, 1);
      seguirElLote();
      pintarLote(); pintarBarraLote(); pintar();
      return;
    }
    recordarPuntos('lote', pts);
    pts.push({ lat: lat, lng: lng });
    /* `pintar()` además de la barra: desde que el panel encogido muestra las
       esquinas que llevás, dejarlo fuera hacía que ese contador dijera «tocá
       las esquinas» para siempre. Un contador que no cuenta confunde más que
       no ponerlo. La hoja encogida es un panel de cuatro líneas, así que
       repintarla por toque no cuesta nada. */
    seguirElLote();
    pintarLote(); pintarBarraLote(); pintar();
  }

  /* El círculo, detrás de cada esquina. Solo con el lote como punto de
     partida: es el único caso en el que el centro del análisis SALE del lote,
     y mover el círculo de un sector ya analizado por marcar un predio dentro
     sería decir que se va a estudiar otra cosa. */
  function seguirElLote() {
    if (S.forma !== 'lote') return;
    try { pintarCirculo(); } catch (e) {}
  }

  function deshacerLote() {
    if (!S.loteDibujando) return;
    var antes = deshacerPuntos('lote');
    if (!antes) return;
    S.lote = antes;
    seguirElLote();
    pintarLote(); pintarBarraLote(); pintar();
  }

  function cancelarLote() {
    // Si había un lote archivado, quitarlo también se guarda: si no, el que
    // se acaba de borrar vuelve solo al reabrir el sector.
    var habia = !!(S.lote && S.lote.length >= 3);
    S.lote = null; S.loteDibujando = false; S.loteAviso = ''; S.caminata = null;
    S.sombras = null;
    pintarCaminata(false);
    soltarMapaLote();
    if (habia) guardarFichaViva();
    pintarLote(); pintar(); pintarBarraLote();
  }

  function cerrarLote() {
    if (!S.lote || S.lote.length < 3) {
      S.loteAviso = 'Un lote necesita al menos tres esquinas.';
      pintarBarraLote(); return;
    }
    S.loteDibujando = false;
    soltarMapaLote();
    /* Si el lote quedó fuera del sector no se bloquea —a lo mejor el sector
       se dibujó chico— pero se dice: un lote afuera no tiene alrededor
       analizado, y entonces la mitad de su ficha estaría vacía sin que se
       entienda por qué. */
    /* El aviso de «quedó fuera» solo tiene sentido si hay un área analizada
       contra la que comparar. Partiendo del lote no la hay todavía —el área
       sale de él— y decirlo sería avisar de un problema inventado. */
    S.loteAviso = (!S.resultado || loteDentroDelArea()) ? ''
      : 'El lote quedó fuera del área analizada: lo que tiene alrededor no está medido.';
    S.encogida = S.forma === 'lote' && !S.resultado;
    recalcularCaminata();
    S.sombras = null;
    /* Partiendo del lote, cerrarlo es lo que define el centro del análisis:
       el círculo aparece ahí mismo para que se vea qué se va a estudiar. */
    if (S.forma === 'lote') { S.centro = centroDelLote(); S.centroDe = 'lote'; pintarCirculo(); }
    /* Y queda archivado. Sin esto, el lote dibujado DESPUÉS de analizar no
       llegaba nunca al disco: se veía en pantalla, se imprimía en la lámina,
       y al volver al sector otro día había desaparecido. Todo lo demás que
       se mide —clima, terreno, trazado, marcas— se guarda al terminar; el
       lote, que es la mitad del trabajo, era lo único que no. */
    guardarFichaViva();
    pintarLote(); pintar(); pintarBarraLote();
  }

  function soltarMapaLote() {
    var m = mapa();
    if (m && clickLote) { try { m.off('click', clickLote); } catch (e) {} }
    try { if (m) m.getContainer().style.cursor = ''; } catch (e) {}
  }

  function loteDentroDelArea() {
    var pts = S.lote || [];
    if (!pts.length) return false;
    var meta = (S.resultado && S.resultado.meta) || {};
    var c = centroideDe(pts);
    if (meta.forma === 'poligono' && meta.poligono && meta.poligono.length >= 3) {
      var A = window.URBIS_PC_ANALISIS;
      if (!A || typeof A.dentroDelPoligono !== 'function') return true;
      return A.dentroDelPoligono(c.lat, c.lng, meta.poligono);
    }
    if (meta.lat == null) return true;
    return haversineM(c, { lat: meta.lat, lng: meta.lng }) <= (meta.radioM || 0);
  }

  /* La barra de dibujo. Va fija abajo y fuera de la hoja porque mientras se
     dibuja la hoja está encogida: los botones tienen que estar donde el pulgar
     ya está, no dentro de un panel que hay que volver a abrir. */
  /* ── Subir y bajar la hoja ───────────────────────────────────────────
     Un solo sitio que decide el estado, para que el botón y el gesto no se
     puedan separar nunca. Antes había tres despachos distintos —«agrandar»,
     «encoger» y el asa— y solo uno de ellos sabía que hay que cancelar el
     dibujo del lote al subir. */
  /* ── Un lápiz a la vez ───────────────────────────────────────────────
     Sobre este mismo mapa se pueden dibujar TRES cosas: el área del sector
     (js/24, el lápiz de la barra derecha), el lote, y las marcas de lo
     intangible. Cada una se armaba por su cuenta y ninguna sabía de las
     otras.

     Con dos armadas, un solo toque alimentaba los dos dibujos. Se comprobó:
     cuatro toques dejaron cuatro vértices de sector Y un lote cerrado de
     7.558 m² encima. Desde fuera eso no se lee como «tengo dos modos
     activos» —nadie sabe que existen dos—: se lee como «no me deja dibujar
     el área», porque sale una cosa distinta de la que se pidió.

     Armar un lápiz suelta los otros. Es toda la regla, y tiene que estar en
     los tres sitios donde se arma uno; si falta en uno, vuelve el problema
     por ahí. */
  function soltarOtrosLapices(cual) {
    if (cual !== 'sector') {
      try {
        var A = window.URBIS_PC_ANALISIS;
        if (A && A.estaDibujando && A.estaDibujando() && A.cancelar) A.cancelar();
      } catch (e) {}
    }
    if (cual !== 'lote' && S.loteDibujando) cancelarLote();
    if (cual !== 'intangible' && S.intDibujando) cerrarIntangible();
    if (cual !== 'corte' && S.corteDibujando) cancelarCorte();
  }

  /* ¿Queda algo puesto sobre el mapa? Es lo que decide si al apagar una capa
     la hoja vuelve a abrirse entera o se queda abajo: con tres capas
     encendidas, apagar una no es motivo para tapar el mapa con el informe. */
  function hayCapaPuesta() {
    return S.calor.length > 0 || S.cobEnMapa || S.llenosEnMapa || !!S.estratos ||
           S.caminataEnMapa || S.curvasEnMapa || S.sombrasEnMapa || S.llenosFotoEnMapa;
  }

  function alternarHoja(quieroEncogida) {
    if (!quieroEncogida && S.loteDibujando) cancelarLote();
    S.encogida = !!quieroEncogida;
    if (!quieroEncogida) S.minima = false;
    // Lo pidió una persona: mientras dure, manda sobre cualquier automatismo.
    S.encogidaAMano = !!quieroEncogida;
    // Y no se vuelve a seguir el mapa si ya hay un sector analizado: bajar la
    // hoja para ver una capa no es pedir otro sector.
    if (quieroEncogida) { if (S.forma === 'radio' && !S.resultado) seguirAlMapa(true); }
    else seguirAlMapa(false);
    pintar();
  }

  /* ── El arrastre ─────────────────────────────────────────────────────
     La hoja se baja empujándola con el dedo y se sube tirando de ella, como
     cualquier panel de teléfono. Antes solo se podía con botones, que obliga
     a apuntar a un objetivo pequeño para algo que el pulgar hace solo.

     Tres decisiones que no son obvias:

     · El gesto arranca SOLO desde el asa. Empezarlo desde cualquier parte de
       la hoja pelearía con el desplazamiento del contenido: la ficha mide
       varias pantallas y el mismo movimiento hacia abajo significa dos cosas
       distintas según dónde empiece. El asa es un objetivo ancho —toda la
       hoja de lado a lado— así que no cuesta encontrarla.

     · Mientras se arrastra se apaga la transición y se mueve la hoja con el
       dedo. Un panel que espera a que sueltes para moverse no se siente
       arrastrable, se siente lento.

     · Al soltar decide el TIRÓN antes que la distancia. Un movimiento rápido
       y corto es una intención clara —así se cierra un panel en cualquier
       teléfono— y exigirle media pantalla la convierte en un forcejeo.       */
  var arr = null;

  function hojaEl() { return document.getElementById('pcr-hoja'); }

  function empezarArrastre(ev) {
    var h = hojaEl();
    if (!h || !S.abierto) return;
    var y = (ev.touches && ev.touches[0]) ? ev.touches[0].clientY : ev.clientY;
    if (y == null) return;
    arr = { y0: y, y: y, t0: Date.now(), alto: h.getBoundingClientRect().height, movido: false };
    h.style.transition = 'none';
  }

  function moverArrastre(ev) {
    if (!arr) return;
    var h = hojaEl();
    if (!h) return;
    var y = (ev.touches && ev.touches[0]) ? ev.touches[0].clientY : ev.clientY;
    if (y == null) return;
    var d = y - arr.y0;
    arr.y = y;
    if (Math.abs(d) > 4) arr.movido = true;
    /* Solo se puede en la dirección que tiene sentido: encogida no baja más y
       abierta no sube más. Y lo que sí se puede se frena a un tercio pasado
       el tope, para que el dedo note el límite en vez de que la hoja se
       quede muerta. */
    /* Tres alturas y no dos: abierta, encogida y mínima. Encogida todavía
       puede bajar —al mínimo— y solo el mínimo no baja más. */
    var puedeBajar = !S.encogida || !S.minima;
    var puedeSubir = S.encogida;
    var v = (d > 0 ? (puedeBajar ? d : 0) : (puedeSubir ? d : 0));
    var sobra = d - v;
    h.style.transform = 'translateY(' + (v + sobra / 3) + 'px)';
    if (arr.movido && ev.cancelable) { try { ev.preventDefault(); } catch (e) {} }
  }

  function soltarArrastre() {
    if (!arr) return;
    var h = hojaEl();
    var d = arr.y - arr.y0;
    var ms = Math.max(1, Date.now() - arr.t0);
    var vel = d / ms;                       // px por milisegundo, con signo
    var movido = arr.movido;
    arr = null;
    if (h) { h.style.transition = ''; h.style.transform = ''; }
    if (!movido) return;                    // fue un toque: lo atiende el clic
    // Un tirón de 0,5 px/ms es un gesto claro aunque haya recorrido poco.
    var tiron = Math.abs(vel) > 0.5;
    var bastante = Math.abs(d) > 70;
    if (!tiron && !bastante) return;        // no llegó: vuelve a su sitio
    var haciaAbajo = d > 0;
    if (haciaAbajo && !S.encogida) { alternarHoja(true); return; }
    if (haciaAbajo && S.encogida && !S.minima) { S.minima = true; pintar(); return; }
    if (!haciaAbajo && S.encogida && S.minima) { S.minima = false; pintar(); return; }
    if (!haciaAbajo && S.encogida) alternarHoja(false);
  }

  /* Los oyentes van en el documento y no en el asa: el dedo se sale de un asa
     de cinco píxeles de alto en el primer milímetro, y con los oyentes puestos
     ahí el arrastre se cortaba solo. */
  var arrastreListo = false;
  function prepararArrastre() {
    if (arrastreListo) return;
    arrastreListo = true;
    document.addEventListener('touchstart', function (ev) {
      var a = ev.target && ev.target.closest && ev.target.closest('.pcr-asa');
      if (a) empezarArrastre(ev);
    }, { passive: true });
    document.addEventListener('touchmove', moverArrastre, { passive: false });
    document.addEventListener('touchend', soltarArrastre, { passive: true });
    document.addEventListener('touchcancel', soltarArrastre, { passive: true });
    // Con ratón, para poder probarlo y para las tabletas con lápiz.
    document.addEventListener('mousedown', function (ev) {
      var a = ev.target && ev.target.closest && ev.target.closest('.pcr-asa');
      if (a) empezarArrastre(ev);
    });
    document.addEventListener('mousemove', moverArrastre);
    document.addEventListener('mouseup', soltarArrastre);
  }

  /* La misma regla que en el área: mientras se dibuja, la barra manda en el
     borde de abajo. Acá lo que tapaba los botones no era la navegación sino
     el propio cuerpo de la hoja encogida, de lado a lado. */
  function marcarQueSeDibuja(clase, si) {
    try { document.body.classList.toggle(clase, !!si); } catch (e) {}
  }

  function pintarBarraLote() {
    var el = document.getElementById('pcr-lote-barra');
    if (!S.loteDibujando) { if (el) el.remove(); marcarQueSeDibuja('urbis-dibujando-lote', false); return; }
    marcarQueSeDibuja('urbis-dibujando-lote', true);
    if (!el) {
      el = document.createElement('div');
      el.id = 'pcr-lote-barra';
      el.className = 'pcr-lote-barra';
      document.body.appendChild(el);
      el.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-lote]');
        if (!b) return;
        var a = b.getAttribute('data-lote');
        if (a === 'deshacer') deshacerLote();
        else if (a === 'cerrar') cerrarLote();
        else if (a === 'cancelar') cancelarLote();
      });
    }
    var n = (S.lote || []).length;
    el.innerHTML =
      '<div class="pcr-lote-t">' +
        (n === 0 ? 'Tocá las esquinas del lote'
                 : n < 3 ? 'Seguí tocando: llevás ' + n + ' esquina' + (n === 1 ? '' : 's') +
                           '. Una que salió mal se quita tocándola.'
                         : 'Llevás ' + n + ' esquinas. Tocá la primera para cerrar, ' +
                           'o cualquier otra para quitarla.') +
      '</div>' +
      '<div class="pcr-lote-b">' +
        '<button type="button" data-lote="deshacer"' + (hayQueDeshacer('lote') ? '' : ' disabled') + '>' +
          ico('deshacer', 16) + 'Deshacer</button>' +
        '<button type="button" data-lote="cerrar" class="pcr-lote-ok"' + (n >= 3 ? '' : ' disabled') + '>' +
          ico('ok', 16) + 'Listo</button>' +
        '<button type="button" data-lote="cancelar">' + ico('cerrar', 16) + 'Cancelar</button>' +
      '</div>' +
      (S.loteAviso ? '<div class="pcr-lote-aviso">' + esc(S.loteAviso) + '</div>' : '');
  }


  // ═══════════════════════════════════════════════════════════════════════
  // LO INTANGIBLE
  // Todo lo demás de esta hoja se bajó de algún lado. Esto no: solo lo tiene
  // quien caminó. El lápiz se usa igual que el del lote —se toca el mapa y
  // una barra abajo dice cuántos puntos llevás—, pero antes hay que elegir
  // QUÉ se está marcando, porque de eso depende si lo que se dibuja es una
  // zona, una línea o un sitio.
  // ═══════════════════════════════════════════════════════════════════════
  var capaInt = null;
  var clickInt = null;

  function IN() { return window.URBIS_INTANGIBLE || null; }

  /* Las marcas cerradas más la que se esté dibujando. Se pintan juntas para
     que la de ahora se vea en el mismo lenguaje que las de antes. */
  function pintarIntangible(encender) {
    var m = mapa();
    if (!m || typeof L === 'undefined') return false;
    if (capaInt) { try { m.removeLayer(capaInt); } catch (e) {} capaInt = null; }
    if (encender === false) { S.intEnMapa = false; return false; }
    var I = IN();
    if (!I) return false;
    var marcas = (S.intangible || []).filter(I.valida);
    var enCurso = (S.intDibujando && S.intPts && S.intPts.length)
      ? [{ tipo: S.intTipo, geom: I.geomDe(S.intTipo), pts: S.intPts, enCurso: true }] : [];
    if (!marcas.length && !enCurso.length) { S.intEnMapa = false; return false; }

    capaInt = L.layerGroup();
    marcas.concat(enCurso).forEach(function (k) {
      var col = I.color(k.tipo);
      var pts = k.pts.map(function (p) { return [p.lat, p.lng]; });
      try {
        if (k.geom === 'zona' && pts.length >= 3) {
          L.polygon(pts, { color: col, weight: 2, opacity: .95, fillColor: col,
                           fillOpacity: k.enCurso ? .12 : .22,
                           dashArray: k.enCurso ? '6 4' : null }).addTo(capaInt);
        } else if (k.geom === 'linea' || (k.enCurso && pts.length >= 2)) {
          /* La barrera va gruesa y punteada: es lo único de este mapa que no
             es un área sino un corte, y a la escala del sector una línea fina
             se confunde con una calle. */
          L.polyline(pts, { color: col, weight: 5, opacity: .9,
                            dashArray: k.geom === 'linea' ? '10 6' : '6 4' }).addTo(capaInt);
        }
        // Los vértices, siempre: son lo que se puede deshacer.
        k.pts.forEach(function (p, i) {
          L.circleMarker([p.lat, p.lng], {
            radius: k.geom === 'punto' ? 8 : (i === 0 && k.enCurso ? 8 : 4),
            color: '#fff', weight: 2, fillColor: col, fillOpacity: 1
          }).addTo(capaInt);
        });
      } catch (e) {}
    });
    capaInt.addTo(m);
    try { if (capaInt.bringToFront) capaInt.bringToFront(); } catch (e) {}
    S.intEnMapa = true;
    return true;
  }

  function iniciarIntangible(tipoId) {
    var I = IN();
    if (!I || !I.tipo(tipoId)) return;
    var m = mapa();
    if (!m) { S.intAviso = 'El mapa todavía no está listo.'; pintar(); return; }
    soltarOtrosLapices('intangible');
    olvidarHistoria('int');
    S.intTipo = tipoId; S.intPts = []; S.intDibujando = true; S.intAviso = '';
    S.encogida = true;
    /* Un sitio de olor o un foco de basura se marcan con precisión de metros;
       una zona insegura, de manzanas. Por eso el acercamiento no es el mismo
       que el del lote: acá 17 deja ver un par de manzanas alrededor, que es
       lo que hace falta para ubicarse mientras se recorre. */
    try { if (m.getZoom && m.getZoom() < 16) m.setZoom(17); } catch (e) {}
    if (!clickInt) {
      clickInt = function (ev) {
        if (!S.intDibujando || !ev || !ev.latlng) return;
        agregarPuntoInt(ev.latlng.lat, ev.latlng.lng);
      };
    }
    try { m.on('click', clickInt); } catch (e) {}
    try { m.getContainer().style.cursor = 'crosshair'; } catch (e) {}
    pintarIntangible(true); pintar(); pintarBarraInt();
  }

  /* ── El trazo a medio dibujar ─────────────────────────────────────────

     Una marca cerrada está a salvo desde v705. La que se está dibujando, no:
     vivía solo en memoria, y una recarga del navegador —que en un teléfono
     pasa sola— se llevaba las esquinas ya tocadas sin dejar rastro.

     Va en su PROPIA llave y no con la ficha. Medido: archivar la ficha entera
     cuesta unos dos milisegundos y el trazo suelto dos centésimas, cien veces
     menos. A un toque por esquina, con la ficha era un gasto que se nota en un
     teléfono de gama media; así se puede guardar en cada toque sin pensarlo.

     Lleva la huella del sector: un trazo recuperado sobre otro barrio serían
     esquinas de una manzana donde nadie estuvo. */
  var TRAZO_KEY = 'pcr_trazo_vivo_v1';

  function guardarTrazoVivo() {
    try {
      if (!S.intDibujando || !S.intPts || !S.intPts.length) { localStorage.removeItem(TRAZO_KEY); return; }
      localStorage.setItem(TRAZO_KEY, JSON.stringify({
        sector: S.huellaAnalizada || '',
        tipo: S.intTipo,
        pts: S.intPts,
        ts: Date.now()
      }));
    } catch (e) {}
  }

  function olvidarTrazoVivo() {
    try { localStorage.removeItem(TRAZO_KEY); } catch (e) {}
  }

  /* Se llama al cargar un sector: si hay un trazo guardado y es de ESTE
     sector, vuelve el lápiz con las esquinas puestas. No se cierra solo —
     cerrar por su cuenta una zona que la persona todavía estaba dibujando
     sería inventarle una forma. */
  function recuperarTrazoVivo() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(TRAZO_KEY) || 'null'); } catch (e) { d = null; }
    if (!d || !d.pts || !d.pts.length || !d.tipo) return false;
    if (!S.huellaAnalizada || d.sector !== S.huellaAnalizada) return false;
    var I = IN();
    if (!I || !I.tipo(d.tipo)) { olvidarTrazoVivo(); return false; }
    iniciarIntangible(d.tipo);
    if (!S.intDibujando) return false;
    S.intPts = d.pts.slice();
    /* El aviso va en la barra del lápiz y no en `aviso` de la hoja: quien
       llama a esto —«Retomar el sector»— escribe su propio mensaje justo
       después, y el que se escribe último gana. Es el mismo enredo que
       tapaba el aviso de que no había espacio, y la misma solución: cada
       cosa dice lo suyo en su sitio. */
    S.intAviso = 'Se recuperó el trazo que estabas dibujando: ' + d.pts.length +
      (d.pts.length === 1 ? ' esquina' : ' esquinas') + '.';
    pintarIntangible(true); pintarBarraInt();
    return true;
  }

  function agregarPuntoInt(lat, lng) {
    if (!S.intDibujando) return;
    var I = IN(); if (!I) return;
    var pts = S.intPts || (S.intPts = []);
    var geom = I.geomDe(S.intTipo);
    // Un sitio es un solo toque: se cierra solo, sin pasar por «Listo».
    if (geom === 'punto') { S.intPts = [{ lat: lat, lng: lng }]; cerrarIntangible(); return; }
    // Tocar la primera esquina cierra la zona, igual que en el lote.
    if (geom === 'zona' && pts.length >= 3) {
      try {
        var m = mapa();
        var a = m.latLngToContainerPoint(pts[0]);
        var b = m.latLngToContainerPoint({ lat: lat, lng: lng });
        if (Math.hypot(a.x - b.x, a.y - b.y) <= 26) { cerrarIntangible(); return; }
      } catch (e) {}
    }
    // Tocar un vértice ya puesto lo quita: es la misma regla en los tres
    // lápices, y lo que se pidió para poder arreglar EL punto que salió mal.
    var cual = verticeTocado(pts, lat, lng);
    if (cual > 0) {
      recordarPuntos('int', pts);
      pts.splice(cual, 1);
      guardarTrazoVivo();
      pintarIntangible(true); pintarBarraInt();
      return;
    }
    recordarPuntos('int', pts);
    pts.push({ lat: lat, lng: lng });
    guardarTrazoVivo();
    pintarIntangible(true); pintarBarraInt();
  }

  function deshacerInt() {
    if (!S.intDibujando) return;
    var antes = deshacerPuntos('int');
    if (!antes) return;
    S.intPts = antes;
    guardarTrazoVivo();
    pintarIntangible(true); pintarBarraInt();
  }

  function cancelarInt() {
    olvidarTrazoVivo();
    S.intDibujando = false; S.intPts = null; S.intTipo = ''; S.intAviso = '';
    soltarMapaInt();
    pintarIntangible((S.intangible || []).length > 0);
    pintar(); pintarBarraInt();
  }

  function soltarMapaInt() {
    var m = mapa();
    if (m && clickInt) { try { m.off('click', clickInt); } catch (e) {} }
    try { if (m) m.getContainer().style.cursor = ''; } catch (e) {}
  }

  function cerrarIntangible() {
    var I = IN(); if (!I) return;
    var pts = S.intPts || [], min = I.minimoPuntos(S.intTipo);
    if (pts.length < min) {
      S.intAviso = min === 3 ? 'Una zona necesita al menos tres esquinas.'
                             : 'Una barrera necesita al menos dos puntos.';
      pintarBarraInt(); return;
    }
    var marca = I.nuevaMarca(S.intTipo, pts, '');
    S.intangible = (S.intangible || []).concat([marca]);
    // Ya es una marca guardada con la ficha: el borrador sobra.
    olvidarTrazoVivo();
    S.intDibujando = false; S.intPts = null; S.intAviso = '';
    soltarMapaInt();
    pintarIntangible(true);
    rehacerUnion();
    guardarFichaViva();
    pintar(); pintarBarraInt();
  }

  function borrarMarcaInt(id) {
    S.intangible = (S.intangible || []).filter(function (m) { return m.id !== id; });
    pintarIntangible((S.intangible || []).length > 0);
    rehacerUnion();
    guardarFichaViva();
    pintar();
  }

  /* La nota es lo que convierte una mancha de color en un testimonio: sin
     ella, dentro de un mes nadie sabe por qué esa esquina estaba marcada. */
  function anotarMarcaInt(id, texto) {
    (S.intangible || []).forEach(function (m) {
      if (m.id === id) m.nota = String(texto || '').slice(0, 220);
    });
    guardarFichaViva();
  }

  /* Vuelve a archivar la ficha del sector que se está mirando. Se llama cada
     vez que cambia algo que el estudiante hizo a mano —una marca intangible,
     una caja del pliego— y no vino de la red. Recorrer un sector lleva una
     hora y el navegador de un teléfono se recarga solo: perder ese trabajo
     por no haber tocado «guardar» sería la peor manera de perderlo. */
  function guardarFichaViva() {
    if (!(S.fichaActualId && S.resultado)) return null;
    var g;
    try {
      g = guardarFicha(S.resultado, zonasSinDatos(S.resultado.pois || [], ejeDelSector()),
                       S.nombreGuardado || '', S.fichaActualId);
    } catch (e) {
      g = { ok: false, error: 'No se pudo archivar el sector: ' + ((e && e.message) || 'error del navegador') + '.' };
    }
    contarLoGuardado(g);
    return g;
  }

  /* Lo que el guardado tenga que decir, dicho.

     Este era el agujero: el autoguardado envolvía todo en un `try {} catch
     (e) {}` y tiraba lo que devolvía. Medido con el almacenamiento lleno, un
     estudiante dibujaba una marca intangible, la veía en el mapa, cerraba la
     aplicación y la marca no estaba: nunca había llegado al disco y nadie se
     lo dijo. El trabajo de una tarde de campo, perdido en silencio.

     Solo habla cuando pasó algo. Un guardado normal no tiene por qué
     interrumpir a nadie. */
  function contarLoGuardado(g) {
    if (!g) return;
    if (!g.ok) {
      var texto = (g.error || 'No se pudo guardar el sector.') +
        ' Lo que hiciste sigue en pantalla, pero se pierde si cerrás la aplicación.' +
        ' Exportá tu recorrido con «Compartir el mío» y borrá sectores guardados' +
        ' desde la pestaña «Sector» para hacer sitio.';
      if (S.avisoGuardado !== texto) { S.avisoGuardado = texto; pintar(); }
      return;
    }
    var partes = [];
    if (g.cache) {
      partes.push('El teléfono estaba sin espacio: se vació la caché de consultas para hacer sitio. ' +
        'No se perdió nada, la próxima consulta tarda un poco más.');
    }
    if (g.borradas) {
      partes.push('No había espacio: se ' +
        (g.borradas === 1 ? 'borró el sector guardado más viejo'
                          : 'borraron los ' + g.borradas + ' sectores guardados más viejos') +
        ' para que cupiera este.');
    }
    if (g.sinPuntos) {
      partes.push('Este sector se guardó sin sus ' + g.sinPuntos + ' usos, que no cabían: ' +
        'al reabrirlo hay que volver a analizar para verlos en el mapa. Las cuentas, tus ' +
        'marcas, el lote y los recorridos del curso quedaron completos.');
    }
    /* Se repinta también cuando el aviso DESAPARECE. Si no, una advertencia de
       que el sector no se estaba guardando se quedaba en pantalla después del
       primer guardado que sí cupo, y una alarma que sigue encendida cuando ya
       no pasa nada deja de leerse a los dos minutos. */
    var antes = S.avisoGuardado;
    S.avisoGuardado = partes.join(' ');
    if (S.avisoGuardado !== antes) pintar();
  }

  /* `ctx` deja pasar el sector de una ficha guardada. Sin eso, abrir una
     ficha vieja cruzaba sus marcas contra el sector que estuviera en memoria
     —otro barrio, con otros usos— y sacaba conclusiones de la nada. */
  /* Quién está caminando. Del inicio de sesión si lo hay; si no, se pregunta.
     Un recorrido sin nombre no es un testimonio, es una mancha. */
  function quienSoy() {
    try {
      var k = (window.URBIS_CONFIG && window.URBIS_CONFIG.AUTH &&
               window.URBIS_CONFIG.AUTH.SESSION_KEY) || 'urbis_auth_session_v1';
      var d = JSON.parse(localStorage.getItem(k) || '{}');
      if (d && d.usuario) return String(d.usuario);
    } catch (e) {}
    return '';
  }

  function rehacerUnion() {
    var I = IN();
    if (!I) return;
    var mios = (S.intangible || []).filter(I.valida);
    var todos = (S.intCurso || []).slice();
    if (mios.length) {
      todos.unshift({ autor: quienSoy() || 'Mi recorrido', marcas: mios });
    }
    S.intUnion = todos.length ? I.unir(todos) : null;
  }

  /* Los acuerdos, sobre el mapa. Un círculo por celda donde coincidieron dos
     o más, del tamaño de cuántos fueron: es lo único de todo esto que se lee
     de un vistazo desde el fondo del salón. */
  var capaAcuerdos = null;
  function pintarAcuerdos(encender) {
    var m = mapa();
    if (!m || typeof L === 'undefined') return false;
    if (capaAcuerdos) { try { m.removeLayer(capaAcuerdos); } catch (e) {} capaAcuerdos = null; }
    if (encender === false) { S.intAcuerdosEnMapa = false; return false; }
    var u = S.intUnion;
    if (!u || !u.acuerdos || !u.acuerdos.length) { S.intAcuerdosEnMapa = false; return false; }
    capaAcuerdos = L.layerGroup();
    u.acuerdos.forEach(function (c) {
      try {
        L.circleMarker([c.lat, c.lng], {
          radius: Math.min(16, 5 + c.personas * 2.5),
          color: '#ffffff', weight: 1.5,
          fillColor: c.color, fillOpacity: Math.min(0.85, 0.3 + c.personas * 0.15)
        }).bindTooltip(c.nombre + ' · ' + c.personas + ' personas').addTo(capaAcuerdos);
      } catch (e) {}
    });
    capaAcuerdos.addTo(m);
    S.intAcuerdosEnMapa = true;
    return true;
  }

  function analisisIntangible(marcas, ctx) {
    var I = IN();
    if (!I) return null;
    var ms = marcas !== undefined && marcas !== null ? marcas : (S.intangible || []);
    var meta = (S.resultado && S.resultado.meta) || {};
    var propio = {
      areaSectorM2: meta.areaM2 || (meta.radioM ? Math.PI * meta.radioM * meta.radioM : 0),
      lote: S.lote,
      pois: (S.resultado && S.resultado.pois) || [],
      hayCaminata: !!(S.caminata && S.caminata.anillos)
    };
    if (ctx) {
      Object.keys(ctx).forEach(function (k) {
        if (ctx[k] !== undefined && ctx[k] !== null) propio[k] = ctx[k];
      });
    }
    return I.analizar(ms, propio);
  }

  /* La barra de dibujo, hermana de la del lote y por las mismas razones: se
     dibuja con la hoja encogida, y los botones tienen que caer donde el pulgar
     ya está. */
  function pintarBarraInt() {
    var el = document.getElementById('pcr-int-barra');
    if (!S.intDibujando) { if (el) el.remove(); marcarQueSeDibuja('urbis-dibujando-int', false); return; }
    marcarQueSeDibuja('urbis-dibujando-int', true);
    var I = IN(); if (!I) return;
    if (!el) {
      el = document.createElement('div');
      el.id = 'pcr-int-barra';
      el.className = 'pcr-lote-barra pcr-int-barra';
      document.body.appendChild(el);
      el.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-int]');
        if (!b) return;
        var a = b.getAttribute('data-int');
        if (a === 'deshacer') deshacerInt();
        else if (a === 'cerrar') cerrarIntangible();
        else if (a === 'cancelar') cancelarInt();
      });
    }
    var t = I.tipo(S.intTipo) || { nombre: '', color: '#999', pregunta: '' };
    var n = (S.intPts || []).length, min = I.minimoPuntos(S.intTipo);
    var geom = I.geomDe(S.intTipo);
    el.innerHTML =
      '<div class="pcr-lote-t">' +
        '<i class="pcr-int-punto" style="background:' + esc(t.color) + '"></i>' +
        esc(t.nombre) + ' — ' +
        (geom === 'punto' ? 'tocá el sitio exacto'
          : n === 0 ? (geom === 'zona' ? 'tocá las esquinas de la zona' : 'tocá por dónde va la barrera')
          : n < min ? 'llevás ' + n + ' de ' + min + ' — una que salió mal se quita tocándola'
          : geom === 'zona' ? 'llevás ' + n + '. Tocá la primera para cerrar, o cualquier otra para quitarla.'
                            : 'llevás ' + n + '. Tocá «Listo» cuando termines.') +
      '</div>' +
      '<div class="pcr-int-preg">' + esc(t.pregunta) + '</div>' +
      '<div class="pcr-lote-b">' +
        '<button type="button" data-int="deshacer"' + (hayQueDeshacer('int') ? '' : ' disabled') + '>' +
          ico('deshacer', 16) + 'Deshacer</button>' +
        '<button type="button" data-int="cerrar" class="pcr-lote-ok"' +
          (n >= min ? '' : ' disabled') + '>' + ico('ok', 16) + 'Listo</button>' +
        '<button type="button" data-int="cancelar">' + ico('cerrar', 16) + 'Cancelar</button>' +
      '</div>' +
      (S.intAviso ? '<div class="pcr-lote-aviso">' + esc(S.intAviso) + '</div>' : '');
  }

  /* ── El análisis del lote ──────────────────────────────────────────────
     No consulta NADA. Todo sale de lo que ya se trajo para el sector: los
     usos del análisis, la forma de las calles del trazado, la geometría del
     propio lote y el sol, que es pura cuenta. Por eso es instantáneo — y por
     eso el bloque avisa cuando algo falta porque no se midió, en vez de
     ponerse a pedirlo por su cuenta.

     Lo que responde es lo que una estudiante necesita antes de proponer algo:
     cuánto mide, a qué calles da y cuántos metros de frente sobre cada una,
     hacia dónde mira cada frente —que decide cuál se calienta— y qué tiene
     pegado al lado. */
  function analisisDelLote() {
    var pts = S.lote || [];
    if (pts.length < 3) return null;
    var meta = (S.resultado && S.resultado.meta) || {};
    var centro = centroideDe(pts);
    var areaM2 = areaM2De(pts);

    // ── Los lados, con su largo y su rumbo
    var lados = [];
    var perim = 0;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      var largo = haversineM(a, b);
      if (largo < 0.5) continue;
      perim += largo;
      /* El rumbo del lado dobla a 0-180°: un lado no tiene ida y vuelta. Pero
         para saber hacia dónde MIRA el frente hace falta la normal, y esa sí
         tiene sentido: apunta hacia afuera del lote. */
      var rumbo = rumboDe(a, b);
      var medio = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
      var haciaAfuera = (rumboDe(centro, medio) + 360) % 360;
      lados.push({ i: lados.length + 1, a: a, b: b, medio: medio,
                   largoM: Math.round(largo), rumbo: rumbo, mira: haciaAfuera });
    }
    if (!lados.length) return null;

    // ── ¿A qué calle da cada lado?
    var vias = S.trzVias || [];
    lados.forEach(function (l) {
      var mejor = null, mejorD = Infinity;
      vias.forEach(function (v) {
        for (var k = 1; k < v.pts.length; k++) {
          var cerca = distanciaASegmento(l.medio, v.pts[k - 1], v.pts[k]);
          /* Treinta metros: más lejos ya no es «el frente da a esa calle»,
             es otra calle de la cuadra. */
          if (cerca.d > 30 || cerca.d >= mejorD) continue;
          // Y que el lado y la calle sean más o menos paralelos (±30°): si no,
          // la calle que pasa perpendicular por la esquina se llevaría todos
          // los frentes.
          var rv = rumboDe(v.pts[k - 1], v.pts[k]);
          var dif = Math.abs(((l.rumbo - rv + 180) % 180));
          if (Math.min(dif, 180 - dif) > 30) continue;
          /* Y —esto es lo que costó descubrir— que la calle esté del lado de
             AFUERA. En un lote de veinte metros de fondo, la calle del frente
             queda a menos de treinta metros también del lado de atrás, y sin
             esta comprobación el fondo se anotaba como un segundo frente sobre
             la misma calle: el lote decía tener ochenta metros de frente
             cuando tiene cuarenta. */
          var haciaLaVia = rumboDe(l.medio, cerca.p);
          // Diferencia angular en [0,180]: 0 es «la calle está justo hacia
          // donde mira el lado», 180 es «está a la espalda».
          var giro = Math.abs(((haciaLaVia - l.mira + 540) % 360) - 180);
          if (giro > 80) continue;
          mejorD = cerca.d; mejor = v;
        }
      });
      if (mejor) {
        l.via = mejor.nombre || '';
        l.viaClase = mejor.clase || '';
        l.viaDistM = Math.round(mejorD);
      }
    });

    // ── Los frentes, agrupados por calle
    var porVia = {};
    lados.forEach(function (l) {
      if (!l.via) return;
      var f = porVia[l.via] || (porVia[l.via] = { via: l.via, clase: l.viaClase, metros: 0, lados: [] });
      f.metros += l.largoM;
      f.lados.push(l.i);
    });
    var frentes = Object.keys(porVia).map(function (k) { return porVia[k]; })
      .sort(function (x, y) { return y.metros - x.metros; });
    var sinFrente = lados.filter(function (l) { return !l.via; })
      .reduce(function (n, l) { return n + l.largoM; }, 0);

    // ── Qué tiene al lado
    var pois = ((S.resultado && S.resultado.pois) || []).map(function (p) {
      return { nombre: p.nombre || '', grupo: p.grupo || 'otro', sub: p.sub || '',
               distM: Math.round(haversineM(centro, { lat: p.lat, lng: p.lng })) };
    }).filter(function (p) { return p.distM <= 200; })
      .sort(function (a, b) { return a.distM - b.distM; });

    // ── El sol sobre este lote
    var SOL = window.URBIS_SOLAR, sol = null;
    try {
      if (SOL && centro.lat != null) sol = SOL.dia(new Date(), centro.lat, centro.lng);
    } catch (e) { sol = null; }
    /* La fachada que se calienta: la que mira más al occidente. En el trópico
       el sol de la tarde entra casi horizontal por ahí, y es el que recalienta
       —al mediodía está tan alto que la fachada apenas lo recibe. */
    var critica = null, mejorOcc = -1;
    /* Cuánto sol de la tarde recibe CADA lado, y no solo cuál recibe más.
       Llegó de campo: la hoja pintaba de rojo una sola fachada y el lado de
       al lado —que también mira al poniente, un poco menos— quedaba como si
       no le diera el sol. Se mide contra el azimut de la puesta de HOY, no
       contra un 270° fijo: en Cúcuta el sol se pone hasta 23° al norte o al
       sur del oeste según la época, y esos grados cambian qué fachada se
       calienta. */
    var azPuesta = (sol && isFinite(sol.azimutPuesta)) ? sol.azimutPuesta : 270;
    var azSalida = (sol && isFinite(sol.azimutSalida)) ? sol.azimutSalida : 90;
    lados.forEach(function (l) {
      var d = Math.abs(((l.mira - 270 + 540) % 360) - 180);
      var cerca = 180 - d;
      if (cerca > mejorOcc) { mejorOcc = cerca; critica = l; }
      l.solTarde = exposicionSolar(l.mira, azPuesta);
      l.solManana = exposicionSolar(l.mira, azSalida);
      l.nivelSol = nivelDeSol(l.solTarde);
    });

    return {
      areaM2: Math.round(areaM2),
      perimetroM: Math.round(perim),
      esquinas: pts.length,
      lados: lados.map(function (l) {
        return { i: l.i, largoM: l.largoM, mira: rumboDe360(l.mira),
                 via: l.via || '', clase: l.viaClase || '',
                 // Coordenadas del lado, para pintarlo en el mapa con su color.
                 a: { lat: l.a.lat, lng: l.a.lng }, b: { lat: l.b.lat, lng: l.b.lng },
                 solTarde: l.solTarde, solManana: l.solManana,
                 nivelSol: l.nivelSol };
      }),
      azimutPuesta: Math.round(azPuesta),
      frentes: frentes,
      sinFrenteM: Math.round(sinFrente),
      esquinero: frentes.length >= 2,
      vecinos: pois.slice(0, 12),
      nVecinos: pois.length,
      sol: sol,
      critica: critica ? { i: critica.i, largoM: critica.largoM,
                           mira: rumboDe360(critica.mira), via: critica.via || '' } : null,
      dentro: loteDentroDelArea(),
      hayVias: vias.length > 0,
      centro: centro
    };
  }

  /* Distancia de un punto a un segmento, en metros. Se proyecta a un plano
     local —a esta escala el error es de centímetros— porque hacerlo sobre la
     esfera para comparar treinta metros es traer un teodolito a medir una
     mesa. */
  function distanciaASegmento(p, a, b) {
    var rad = Math.PI / 180;
    var kx = Math.cos(p.lat * rad) * 111320, ky = 110540;
    var px = (p.lng - a.lng) * kx, py = (p.lat - a.lat) * ky;
    var bx = (b.lng - a.lng) * kx, by = (b.lat - a.lat) * ky;
    var len2 = bx * bx + by * by;
    if (!len2) return { d: Math.hypot(px, py), p: a };
    var t = Math.max(0, Math.min(1, (px * bx + py * by) / len2));
    return {
      d: Math.hypot(px - t * bx, py - t * by),
      p: { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }
    };
  }

  /* ── El terreno bajo el lote ───────────────────────────────────────────
     La rejilla de cotas está en la mano desde que se midió el terreno, así
     que cortarla por donde haga falta no cuesta ni una consulta más. Lo que
     hay que decir —y se dice— es hasta dónde alcanza: el modelo tiene 90 m de
     paso, así que un lote de veinte metros cabe entero dentro de una celda.
     El corte sirve para situar el lote en la ladera, no para dar la cota de
     una esquina. */

  /* La cota en cualquier punto, interpolada entre los cuatro nodos que lo
     rodean. Bilineal: es lo que corresponde a una rejilla regular, y hacer
     algo más fino sobre un modelo de 90 m sería fingir precisión. */
  function cotaEn(p, rejDada) {
    var R = rejDada || S.terRejilla;
    if (!R || !R.limites || !R.z || !R.filas || !R.columnas) return null;
    var L = R.limites;
    var anchoLng = L.maxLng - L.minLng, altoLat = L.maxLat - L.minLat;
    if (!anchoLng || !altoLat) return null;
    var fx = (p.lng - L.minLng) / anchoLng * (R.columnas - 1);
    // La fila 0 de la rejilla es la de MÁS latitud: se cuenta hacia abajo.
    var fy = (L.maxLat - p.lat) / altoLat * (R.filas - 1);
    if (!(fx >= 0 && fx <= R.columnas - 1 && fy >= 0 && fy <= R.filas - 1)) return null;
    var c0 = Math.floor(fx), f0 = Math.floor(fy);
    var c1 = Math.min(R.columnas - 1, c0 + 1), f1 = Math.min(R.filas - 1, f0 + 1);
    var tx = fx - c0, ty = fy - f0;
    var z = function (f, c) { return R.z[f * R.columnas + c]; };
    var z00 = z(f0, c0), z01 = z(f0, c1), z10 = z(f1, c0), z11 = z(f1, c1);
    if (z00 == null || z01 == null || z10 == null || z11 == null) return null;
    return (z00 * (1 - tx) + z01 * tx) * (1 - ty) + (z10 * (1 - tx) + z11 * tx) * ty;
  }

  /* Un corte del terreno entre dos puntos, con `n` muestras. Devuelve la
     misma forma que traen los perfiles del motor —{d, z, dentro}— para que un
     solo dibujo sirva para los dos. */
  function corteEntre(a, b, n, dentroDe, rejDada) {
    var pasos = Math.max(8, n || 60), out = [];
    var largo = haversineM(a, b);
    for (var i = 0; i <= pasos; i++) {
      var t = i / pasos;
      var p = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
      var z = cotaEn(p, rejDada);
      if (z == null) continue;
      out.push({ d: Math.round(largo * t), z: Math.round(z * 10) / 10,
                 lat: p.lat, lng: p.lng,
                 dentro: dentroDe ? !!dentroDe(p) : true });
    }
    return out;
  }

  /* ── Curvas de nivel ───────────────────────────────────────────────────
     La misma rejilla de cotas, leída de la otra manera. Un corte dice cómo
     sube el terreno POR UNA LÍNEA; las curvas lo dicen por todo el plano a la
     vez, y son el dibujo con el que se decide dónde entra un acceso y hacia
     dónde se aterraza.

     El método es el clásico: cuadro por cuadro de la rejilla, se mira qué
     esquinas quedan por encima de la cota buscada y se traza el segmento que
     separa unas de otras, interpolando sobre los lados. Es «marching squares»
     y tiene medio siglo; no hace falta nada más moderno para 289 cuadros.

     La honestidad de siempre: el modelo tiene 90 m de paso, así que estas
     curvas describen la forma del sector, NO el detalle de una manzana. Con
     un intervalo demasiado fino se dibujarían pliegues que el modelo no sabe;
     por eso el intervalo lo elige el relieve y no el usuario. */
  var PASOS_CURVAS = [1, 2, 4, 5, 10, 25, 50, 100];
  /* Cuarenta curvas, no veinticuatro. Con veinticuatro, un sector de 156 m de
     desnivel —una ladera cualquiera de Cúcuta— salía a 10 m, y se pidió lo
     contrario con estas palabras: «no sea cada diez metros; a cada cinco o
     cuatro metros está bien, cada cuatro metros». Con cuarenta, ese mismo
     sector sale a 4 m y uno de 60 m también.

     Cuarenta líneas es lo que una lámina admite sin volverse una trama, y lo
     que el dibujo aguanta sin pesar: son polilíneas, no imágenes. Más fino
     sigue estando a un toque en el selector, con lo que es escrito al lado:
     entre dos cotas medidas, la curva es interpolación de un modelo de 90 m. */
  function intervaloDeCurvas(relieve) {
    /* De 4 m para arriba, salvo que el sector sea casi plano: por debajo de
       eso el modelo de 90 m ya no describe relieve, dibuja su propia
       interpolación, y cuatro curvas de mentira valen menos que dos de
       verdad. El selector sigue ofreciendo 1 y 2 m para quien las quiera:
       elegirlas es del estudiante, ponerlas solo no. */
    if (relieve <= 8) return 1;
    if (relieve <= 16) return 2;
    for (var i = PASOS_CURVAS.indexOf(4); i < PASOS_CURVAS.length; i++) {
      if (relieve / PASOS_CURVAS[i] <= 40) return PASOS_CURVAS[i];
    }
    return PASOS_CURVAS[PASOS_CURVAS.length - 1];
  }

  /* La rejilla, más tupida, solo para DIBUJAR.

     Al servicio de altura se le piden pocos puntos —cuesta una consulta por
     cada cien, y pedir de más es lo que terminó devolviendo «429: demasiadas
     consultas» en mitad de una clase—. Pero una rejilla de pocos puntos
     trazada tal cual da curvas de tramos rectos, que en campo se leyeron
     como «imperfecciones de la topografía» cuando eran del dibujo.

     Así que se pide poco y se dibuja fino: entre cotas medidas se interpola
     con Catmull-Rom, que pasa por los puntos que sí se midieron y curva
     suave entre ellos. No inventa relieve nuevo —el modelo sigue siendo de
     90 m y la ficha lo sigue diciendo—: hace que la línea que ya era
     interpolación se vea como una curva y no como una escalera.

     Solo para las curvas. Las cifras —altura, pendiente, hacia dónde baja—
     se calculan sobre lo medido, sin tocar. */
  function tupirRejilla(R, veces) {
    var F = R.filas, C = R.columnas, n = Math.max(1, veces || 3);
    if (n === 1 || F < 4 || C < 4) return R;
    var z = R.z;
    var en = function (f, c) {
      f = Math.max(0, Math.min(F - 1, f)); c = Math.max(0, Math.min(C - 1, c));
      var v = z[f * C + c];
      return v == null ? null : Number(v);
    };
    // Catmull-Rom en una dimensión, con los cuatro vecinos.
    var cr = function (p0, p1, p2, p3, t) {
      if (p0 == null || p1 == null || p2 == null || p3 == null) return null;
      var t2 = t * t, t3 = t2 * t;
      return 0.5 * ((2 * p1) + (-p0 + p2) * t +
                    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                    (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    };
    var F2 = (F - 1) * n + 1, C2 = (C - 1) * n + 1, z2 = new Array(F2 * C2);
    for (var f2 = 0; f2 < F2; f2++) {
      var ff = f2 / n, fi = Math.floor(ff), ft = ff - fi;
      if (fi >= F - 1) { fi = F - 2; ft = 1; }
      for (var c2 = 0; c2 < C2; c2++) {
        var cc = c2 / n, ci = Math.floor(cc), ct = cc - ci;
        if (ci >= C - 1) { ci = C - 2; ct = 1; }
        var col = [];
        for (var k = -1; k <= 2; k++) {
          col.push(cr(en(fi + k, ci - 1), en(fi + k, ci), en(fi + k, ci + 1), en(fi + k, ci + 2), ct));
        }
        z2[f2 * C2 + c2] = cr(col[0], col[1], col[2], col[3], ft);
      }
    }
    return { filas: F2, columnas: C2, z: z2, limites: R.limites };
  }

  /* ── Los llenos, leídos de la foto ──────────────────────────────────
     El porcentaje de arriba cuenta las huellas que OpenStreetMap tiene
     dibujadas. Esto lee la foto satelital y estima cuánto suelo está
     construido de verdad, aprendiendo el color de los techos DE ESTE SECTOR
     con las huellas que sí están mapeadas. La cuenta la hace js/76; acá se
     pide, se explica y se ofrece verla sobre el mapa. */
  /* La máscara de los llenos leídos de la foto, sobre el mapa. Es una imagen
     clavada por sus esquinas —no mil polígonos—, que es lo que un teléfono
     puede dibujar sin ahogarse: gris lo que ya tiene huella, naranja lo que
     la foto lee como construido y nadie ha mapeado. */
  var capaLlenosFoto = null;
  function pintarLlenosFoto(encender) {
    var m = mapa();
    if (capaLlenosFoto) { try { m && m.removeLayer(capaLlenosFoto); } catch (e) {} capaLlenosFoto = null; }
    S.llenosFotoEnMapa = false;
    if (!encender || !m || typeof L === 'undefined') return false;
    var r = S.llenosFoto;
    if (!r || !r.ok || !r.imagen || !r.limites) return false;
    try {
      capaLlenosFoto = L.imageOverlay(r.imagen, r.limites, { opacity: 0.72, interactive: false });
      capaLlenosFoto.addTo(m);
      S.llenosFotoEnMapa = true;
      // Con la hoja entera encima no se ve nada de lo que se acaba de encender.
      S.encogida = true;
      return true;
    } catch (e) { return false; }
  }

  /* ── Antes de exportar: encender y apagar todo, en un solo sitio ──────
     Se pidió así, después de leer la ficha entera: «uno baja y baja y hay
     tantas cosas por bajar; sería bueno dejar abajo un resumen de activar
     todo y desactivar todo, que todo lo que sea activar y desactivar esté
     abajo, lo último, junto lo del PDF».

     Tiene sentido más allá de la comodidad: encender o apagar TODO es una
     decisión que se toma al final, cuando ya se sabe qué se midió y qué se va
     a entregar. Los interruptores de cada cosa siguen donde viven —al lado
     del bloque que los explica—; esto es el atajo de los tres «todo», con lo
     que llevás puesto de cada uno, pegado a los botones de la lámina. */
  function bloqueAntesDeExportar(res) {
    /* Los mapas del pliego NO se cuentan acá: armar esa lista dibuja cada
       capa entera, que es el trabajo más caro de la ficha, y esto es un
       atajo de dos botones. Su «poner todo» viaja con el de las cajas. */
    var capas = [], cajas = [];
    try { capas = capasDisponibles((res && res.stats) || {}) || []; } catch (e) {}
    try { cajas = (cajasDelPliego(res) || []).filter(function (c) { return c.listo; }); } catch (e) {}
    var capasListas = capas.filter(function (c) { return c.listo; });
    var capasOn = capasListas.filter(function (c) { return c.on; }).length;
    var cajasOn = cajas.filter(function (c) { return c.on; }).length;
    if (!capasListas.length && !cajas.length) return '';

    function fila(etq, on, de, todo, nada, textoTodo, textoNada) {
      return '<div class="pcr-todo-fila">' +
        '<span class="pcr-todo-t"><b>' + esc(etq) + '</b> <small>' + on + ' de ' + de + '</small></span>' +
        '<button type="button" data-pcr="' + todo + '" class="pcr-mini">' + ico('ok', 15) + esc(textoTodo) + '</button>' +
        '<button type="button" data-pcr="' + nada + '" class="pcr-mini">' + ico('apagar', 15) + esc(textoNada) + '</button>' +
      '</div>';
    }
    return h4('capas', 'Antes de exportar') +
      '<p class="pcr-pista">Lo que se enciende y se apaga de una vez, junto. Cada cosa sigue ' +
      'teniendo su interruptor donde se explica; esto es el atajo.</p>' +
      (capasListas.length
        ? fila('Capas sobre el mapa', capasOn, capasListas.length,
               'capas-todo', 'capas-nada', 'Encender todo', 'Apagar todo')
        : '') +
      (cajas.length
        ? fila('Cajas del pliego', cajasOn, cajas.length,
               'pliego-todo', 'pliego-nada', 'Poner todo', 'Solo el plano')
        : '');
  }

  function bloqueLlenosFoto() {
    var F = window.URBIS_LLENOS_FOTO;
    if (!F) return '';
    var r = S.llenosFoto;
    var listo = !!(S.cobertura && S.cobertura.rejilla) && !!(S.trzHuellas && S.trzHuellas.length);

    if (S.llenosFotoCargando) {
      return '<p class="pcr-lab">Los llenos, leídos de la foto</p>' +
        '<p class="pcr-conc" id="pcr-lfoto-estado">' + esc(S.llenosFotoAviso || 'Leyendo…') + '</p>';
    }
    if (!listo) {
      return '<p class="pcr-lab">Los llenos, leídos de la foto</p>' +
        '<p class="pcr-pista">El porcentaje de arriba cuenta <b>las huellas que alguien ya dibujó</b> ' +
        'en OpenStreetMap, que en esta ciudad son una parte de lo que hay construido. La foto ' +
        'satelital dice cuánto suelo está cubierto de verdad. Hacen falta las dos mediciones: ' +
        (S.cobertura && S.cobertura.rejilla ? '' : '<b>la foto satelital</b>') +
        ((S.cobertura && S.cobertura.rejilla) || (S.trzHuellas && S.trzHuellas.length) ? '' : ' y ') +
        (S.trzHuellas && S.trzHuellas.length ? '' : '<b>el trazado</b>') +
        '.</p>';
    }
    if (r && !r.ok) {
      return '<p class="pcr-lab">Los llenos, leídos de la foto</p>' +
        '<p class="pcr-pista">' + esc(r.detalle || 'No se pudo estimar.') + '</p>' +
        '<button type="button" data-pcr="llenos-foto" class="pcr-mini">' +
          ico('satelite', 16) + 'Volver a intentarlo</button>';
    }
    if (!r) {
      return '<p class="pcr-lab">Los llenos, leídos de la foto</p>' +
        '<p class="pcr-pista">Con la foto y las huellas ya medidas, se puede estimar cuánto suelo ' +
        'está construido <b>aunque nadie lo haya mapeado</b>: se aprende el color de los techos de ' +
        'este sector con las huellas que sí están, y se busca ese color en el resto de la foto.</p>' +
        '<button type="button" data-pcr="llenos-foto" class="pcr-principal">' +
          ico('satelite') + 'Leer los llenos de la foto</button>';
    }
    var falta = r.pctSinMapear > 0 ? r.pctSinMapear : 0;
    return '<p class="pcr-lab">Los llenos, leídos de la foto</p>' +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + r.pct + '%</b><small>construido según la foto</small></div>' +
        '<div class="pcr-kpi"><b>' + r.pctOSM + '%</b><small>con huella mapeada</small></div>' +
        '<div class="pcr-kpi pcr-kpi-oro"><b>' + falta + '%</b><small>del sector, construido y sin mapear</small></div>' +
      '</div>' +
      '<p class="pcr-conc">La foto ve <b>' + formatearM2(r.m2) + '</b> de suelo construido; ' +
      'OpenStreetMap tiene dibujados <b>' + formatearM2(r.m2OSM) + '</b>. La diferencia —' +
      formatearM2(Math.max(0, r.m2 - r.m2OSM)) + '— es, en área, <b>lo que falta por mapear</b>.</p>' +
      '<button type="button" data-pcr="llenos-foto-mapa" class="pcr-mini">' +
        (S.llenosFotoEnMapa ? ico('apagar', 16) + 'Quitar del mapa'
                            : ico('mapa', 16) + 'Ver en el mapa lo que falta') + '</button>' +
      '<p class="pcr-pista">En el mapa, <b>gris</b> lo que ya tiene huella y <b>naranja</b> lo que ' +
      'la foto lee como construido y nadie ha dibujado. La estimación se calibró con <b>' +
      r.huellas + '</b> huellas de este mismo sector, a <b>' + r.mPorPx + ' m por píxel</b>, y ' +
      'separa los dos colores con una confianza del <b>' + r.confianza + '%</b>. ' +
      'Un patio de tierra, un lote pelado y una cancha de arena tienen el color de una teja vieja: ' +
      'donde el barrio es denso apenas pesan, en la periferia esta cifra se pasa de largo. ' +
      'Es una <b>estimación</b>, no un catastro.</p>';
  }

  function curvasDelTerreno(rejDada) {
    var R = rejDada || S.terRejilla;
    if (!R || !R.limites || !R.z || R.filas < 2 || R.columnas < 2) return null;
    var L = R.limites, F = R.filas, C = R.columnas;
    var zs = R.z.filter(function (v) { return v != null; });
    if (zs.length < 4) return null;
    var zMin = Math.min.apply(null, zs), zMax = Math.max.apply(null, zs);
    var relieve = zMax - zMin;
    if (relieve < 1) return { intervalo: 0, curvas: [], plano: true, zMin: zMin, zMax: zMax };

    /* El intervalo lo elige el relieve, salvo que la persona haya pedido otro.
       Se le deja pedirlo porque para un anteproyecto a veces hacen falta las
       de 5 m aunque el modelo sea de 90 m de paso: lo que se dibuja entre dos
       cotas medidas es interpolación, y eso va escrito al lado. */
    var paso = (S.curvasPaso && PASOS_CURVAS.indexOf(S.curvasPaso) !== -1)
      ? S.curvasPaso : intervaloDeCurvas(relieve);
    // Con un paso pedido demasiado fino para el desnivel salen cientos de
    // curvas: se limita a ochenta y se avisa con el número.
    while (relieve / paso > 80 && PASOS_CURVAS.indexOf(paso) < PASOS_CURVAS.length - 1) {
      paso = PASOS_CURVAS[PASOS_CURVAS.indexOf(paso) + 1];
    }
    /* Se traza sobre la rejilla tupida y no sobre la medida: mismas cotas,
       misma extensión, curvas suaves. Ver `tupirRejilla`. */
    var D = tupirRejilla(R, 3);
    F = D.filas; C = D.columnas;
    var latDe = function (f) { return L.maxLat - (L.maxLat - L.minLat) * (f / (F - 1)); };
    var lngDe = function (c) { return L.minLng + (L.maxLng - L.minLng) * (c / (C - 1)); };
    var z = function (f, c) { return D.z[f * C + c]; };

    // El punto donde una arista cruza la cota, interpolando linealmente.
    function cruce(f1, c1, z1, f2, c2, z2, v) {
      var t = (v - z1) / (z2 - z1);
      return { lat: latDe(f1) + (latDe(f2) - latDe(f1)) * t,
               lng: lngDe(c1) + (lngDe(c2) - lngDe(c1)) * t };
    }

    var curvas = [];
    for (var v = Math.ceil(zMin / paso) * paso; v <= zMax; v += paso) {
      var segs = [];
      for (var f = 0; f < F - 1; f++) {
        for (var c = 0; c < C - 1; c++) {
          var za = z(f, c), zb = z(f, c + 1), zc = z(f + 1, c + 1), zd = z(f + 1, c);
          if (za == null || zb == null || zc == null || zd == null) continue;
          var pts = [];
          // Arriba, derecha, abajo, izquierda: cada lado aporta como mucho un
          // punto, y los puntos de un mismo cuadro se unen entre ellos.
          if ((za < v) !== (zb < v)) pts.push(cruce(f, c, za, f, c + 1, zb, v));
          if ((zb < v) !== (zc < v)) pts.push(cruce(f, c + 1, zb, f + 1, c + 1, zc, v));
          if ((zc < v) !== (zd < v)) pts.push(cruce(f + 1, c + 1, zc, f + 1, c, zd, v));
          if ((zd < v) !== (za < v)) pts.push(cruce(f + 1, c, zd, f, c, za, v));
          /* Con dos puntos hay un segmento. Con cuatro el cuadro es una silla
             —dos crestas cruzadas— y hay dos segmentos; se unen por pares en
             el orden en que salieron, que para una rejilla de 90 m da el
             dibujo correcto sin tener que resolver la ambigüedad de la silla,
             que a esta escala no se ve. */
          if (pts.length >= 2) segs.push([pts[0], pts[1]]);
          if (pts.length === 4) segs.push([pts[2], pts[3]]);
        }
      }
      if (segs.length) curvas.push({ z: Math.round(v * 10) / 10, lineas: encadenar(segs) });
    }
    return { intervalo: paso, curvas: curvas, zMin: Math.round(zMin), zMax: Math.round(zMax),
             resolucionM: (S.terreno && S.terreno.resolucionM) || 90 };
  }

  /* Los segmentos sueltos, cosidos en líneas continuas. Dibujar dos mil rayas
     independientes funciona, pero una curva partida en trozos no se puede
     rotular con su cota ni se lee como una curva: se ve como una trama. */
  function encadenar(segs) {
    var clave = function (p) { return p.lat.toFixed(6) + ',' + p.lng.toFixed(6); };
    var porPunto = {};
    segs.forEach(function (s2, i) {
      [clave(s2[0]), clave(s2[1])].forEach(function (k) {
        (porPunto[k] || (porPunto[k] = [])).push(i);
      });
    });
    var usado = new Array(segs.length), lineas = [];
    for (var i = 0; i < segs.length; i++) {
      if (usado[i]) continue;
      usado[i] = true;
      var linea = [segs[i][0], segs[i][1]];
      // Se estira por los dos extremos hasta que no haya con qué seguir.
      [0, 1].forEach(function (lado) {
        for (var vueltas = 0; vueltas < 4000; vueltas++) {
          var punta = lado ? linea[linea.length - 1] : linea[0];
          var vecinos = porPunto[clave(punta)] || [];
          var siguiente = -1;
          for (var j = 0; j < vecinos.length; j++) {
            if (!usado[vecinos[j]]) { siguiente = vecinos[j]; break; }
          }
          if (siguiente < 0) break;
          usado[siguiente] = true;
          var s3 = segs[siguiente];
          var otro = (clave(s3[0]) === clave(punta)) ? s3[1] : s3[0];
          if (lado) linea.push(otro); else linea.unshift(otro);
        }
      });
      lineas.push(linea);
    }
    return lineas;
  }

  /* ── Las sombras de los vecinos sobre el lote ──────────────────────────
     La carta solar dice por dónde entra el sol. Lo que no dice es si al lote
     le llega, porque eso depende de lo que tenga enfrente. Con las huellas de
     los edificios y sus pisos —los dos ya vienen con el trazado— la sombra se
     puede proyectar: es geometría, no adivinanza.

     Cada edificio proyecta su huella desplazada en el sentido contrario al
     sol, una distancia igual a su altura dividida por la tangente de la altura
     solar. La sombra es la envolvente de la huella y su desplazada: el casco
     convexo de las dos. Para plantas rectangulares —que es lo que hay— la
     envolvente y el casco coinciden.

     Lo que esto NO sabe, y se dice en la ficha: los edificios sin pisos
     registrados no proyectan nada (y son mayoría), los árboles y los muros no
     están, y el terreno se supone plano. En una ladera la sombra real cae más
     lejos ladera abajo y más cerca ladera arriba. */
  var HORAS_SOMBRA = [9, 12, 15];
  var ALTO_POR_PISO_M = 3;

  function sombrasDelLote(fecha) {
    var pts = S.lote || [];
    var SOL = window.URBIS_SOLAR;
    var huellas = S.trzHuellas || [], pisos = S.trzPisos || [];
    if (pts.length < 3 || !SOL || !huellas.length) return null;

    var centro = centroideDe(pts);
    var dia = fecha ? new Date(fecha) : new Date();
    var rad = Math.PI / 180;
    var kx = Math.cos(centro.lat * rad) * 111320, ky = 110540;
    var aMetros = function (p) {
      return { x: (p.lng - centro.lng) * kx, y: (p.lat - centro.lat) * ky };
    };
    var aGrados = function (q) {
      return { lat: centro.lat + q.y / ky, lng: centro.lng + q.x / kx };
    };

    /* Solo los vecinos: a más de 200 m, para tapar el sol de la tarde a un
       lote haría falta una torre de sesenta pisos, y esas no se cuentan por
       docenas en un barrio. Filtrar acá es lo que deja el cálculo en unos
       pocos milisegundos. */
    var cerca = [];
    var sinPisos = 0;
    huellas.forEach(function (anillo, i) {
      if (!anillo || anillo.length < 3) return;
      var c0 = anillo[0];
      if (haversineM(centro, c0) > 200) return;
      var n2 = pisos[i];
      if (!n2) { sinPisos++; return; }
      cerca.push({ anillo: anillo, pisos: n2, alturaM: n2 * ALTO_POR_PISO_M });
    });
    if (!cerca.length) {
      return { sinAlturas: true, vecinosSinPisos: sinPisos, horas: [] };
    }

    // Muestreo del lote: una rejilla de puntos por dentro, para medir qué
    // parte queda en sombra sin tener que intersecar polígonos.
    var A = window.URBIS_PC_ANALISIS;
    var dentroLote = function (p) {
      return A && A.dentroDelPoligono ? A.dentroDelPoligono(p.lat, p.lng, pts) : false;
    };
    var lats = pts.map(function (p) { return p.lat; });
    var lngs = pts.map(function (p) { return p.lng; });
    var muestras = [];
    var N = 14;
    for (var i2 = 0; i2 < N; i2++) {
      for (var j = 0; j < N; j++) {
        var q = { lat: Math.min.apply(null, lats) + (Math.max.apply(null, lats) - Math.min.apply(null, lats)) * ((i2 + 0.5) / N),
                  lng: Math.min.apply(null, lngs) + (Math.max.apply(null, lngs) - Math.min.apply(null, lngs)) * ((j + 0.5) / N) };
        if (dentroLote(q)) muestras.push(aMetros(q));
      }
    }
    if (!muestras.length) return null;

    var horas = HORAS_SOMBRA.map(function (h) {
      var t = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, 0, 0);
      var pos;
      try { pos = SOL.posicion(t, centro.lat, centro.lng); } catch (e) { return null; }
      if (!pos || pos.altitud <= 5) {
        return { hora: h, altitud: pos ? Math.round(pos.altitud * 10) / 10 : null,
                 bajo: true, sombras: [], pctLote: 0 };
      }
      var largoPorMetro = 1 / Math.tan(pos.altitud * rad);
      // La sombra se va al lado opuesto del sol.
      var az = (pos.azimut + 180) % 360;
      var dx = Math.sin(az * rad), dy = Math.cos(az * rad);

      var sombras = cerca.map(function (e) {
        var base = e.anillo.map(aMetros);
        var largo = e.alturaM * largoPorMetro;
        var movida = base.map(function (q) { return { x: q.x + dx * largo, y: q.y + dy * largo }; });
        return cascoConvexo(base.concat(movida));
      }).filter(function (poli) { return poli.length >= 3; });

      var tapadas = 0;
      muestras.forEach(function (q) {
        for (var k = 0; k < sombras.length; k++) {
          if (dentroDePoligonoXY(q, sombras[k])) { tapadas++; return; }
        }
      });

      return {
        hora: h,
        altitud: Math.round(pos.altitud * 10) / 10,
        azimut: Math.round(pos.azimut * 10) / 10,
        pctLote: Math.round(100 * tapadas / muestras.length),
        sombras: sombras.map(function (poli) { return poli.map(aGrados); })
      };
    }).filter(Boolean);

    return {
      horas: horas, vecinos: cerca.length, vecinosSinPisos: sinPisos,
      alturaPorPiso: ALTO_POR_PISO_M,
      masAlto: cerca.reduce(function (m, e) { return Math.max(m, e.pisos); }, 0),
      centro: centro, lote: pts.slice(),
      huellasCerca: cerca.map(function (e) { return { anillo: e.anillo, pisos: e.pisos }; })
    };
  }

  /* ── La evolución del sitio, año por año ──────────────────────────────
     Dos series que no se mezclan: la larga de Landsat desde 1984, que se mide
     con un índice y da la tendencia, y la corta de alta resolución desde
     2014, que se mira. El porqué entero está en js/80.

     Se piden a mano y no con el análisis: son diez o quince descargas de
     imagen y una lectura de píxeles por cada una. Nadie quiere eso cada vez
     que dibuja un sector; quien quiere la evolución la pide. */
  function pedirEvolucion(fuente) {
    var EV = window.URBIS_EVOLUCION;
    if (!EV) { S.evoAviso = 'Falta el módulo de evolución. Recargá la app.'; pintar(); return; }
    var contorno = contornoDelSector();
    if (!contorno || contorno.length < 3) {
      S.evoAviso = 'Primero analizá un sector.'; pintar(); return;
    }
    var cual = fuente === 'wayback' ? 'wayback' : 'landsat';
    S.evoCargando = cual; S.evoAviso = 'Preparando…'; pintar();
    return EV.serie({
      fuente: cual, contorno: contorno,
      alAvisar: function (t) {
        S.evoAviso = t;
        var c = document.getElementById('pcr-evo-estado');
        if (c) c.textContent = t;
      }
    }).then(function (s2) {
      S.evo = S.evo || {};
      S.evo[cual] = s2;
      S.evoCargando = ''; S.evoAviso = '';
      /* Solo las cifras viajan con la ficha. Las imágenes son megas y se
         vuelven a pedir; el dato pesa nada y es lo que se defiende. */
      guardarFichaViva();
      pintar();
      return s2;
    }, function (e) {
      S.evoCargando = '';
      S.evoAviso = 'No se pudo traer la serie: ' + ((e && e.message) || 'error') + '.';
      pintar();
    });
  }

  /* ── La infraestructura de servicios que sí está registrada ───────────
     Lo que se pidió era «servicios públicos»: si el barrio tiene agua,
     alcantarillado y energía. Eso NO se puede contestar con lo que URBIS
     tiene, y conviene decirlo antes que dar un número que suene a respuesta:
     la cobertura por manzana la levanta el DANE en el censo y no hay servicio
     público que la sirva a un navegador; OpenStreetMap no registra coberturas,
     registra OBJETOS.

     Lo que sí se puede contestar, y para un proyecto importa, es qué
     infraestructura hay cerca y a qué distancia: una subestación al lado es
     una servidumbre y un retiro; un tanque elevado dice por dónde llega el
     agua y a qué cota; un relleno o una planta de tratamiento a trescientos
     metros es una determinante que aparece en la primera revisión. Esos
     objetos ya vienen clasificados en el análisis —la subcategoría
     `infra_servicios`— y hasta ahora solo se contaban dentro del montón de
     «servicios». */
  var INFRA_ETQ = {
    water_tower: 'tanque de agua', works: 'planta o fábrica', tower: 'torre',
    mast: 'antena', substation: 'subestación eléctrica', recycling: 'punto de reciclaje',
    landfill: 'relleno', waste_transfer_station: 'estación de residuos',
    waste_disposal: 'disposición de residuos', storage_tank: 'tanque de almacenamiento'
  };
  function infraDeServicios(res) {
    var pois = (res && res.pois) || [];
    var centro = (S.lote && S.lote.length >= 3) ? centroideDe(S.lote)
      : (res && res.meta && res.meta.lat != null
          ? { lat: res.meta.lat, lng: res.meta.lng } : null);
    var lista = pois.filter(function (p) { return p.sub === 'infra_servicios'; })
      .map(function (p) {
        var t = p.tags || {};
        var etq = INFRA_ETQ[t.man_made] || INFRA_ETQ[t.power] || INFRA_ETQ[t.amenity] ||
                  INFRA_ETQ[t.landuse] || INFRA_ETQ[t.building] || '';
        return { nombre: p.nombre || '', etq: etq,
                 distM: centro && p.lat != null ? Math.round(haversineM(centro, p)) : null };
      })
      .sort(function (a, b) {
        if (a.distM == null) return 1;
        if (b.distM == null) return -1;
        return a.distM - b.distM;
      });
    if (!lista.length) return null;
    return { lista: lista, n: lista.length, desdeElLote: !!(S.lote && S.lote.length >= 3),
             masCerca: lista[0] };
  }

  /* ── La cuadra del lote ───────────────────────────────────────────────
     La escala que faltaba. Todo el análisis era «el sector» —un radio o un
     polígono de un kilómetro— o «el lote», y no existía lo del medio, que es
     justamente donde uno proyecta: cómo es el frente de cuadra al que va a dar
     el proyecto, si la fachada de enfrente es continua o está rota, dónde se
     abren los locales, si la esquina está activa.

     La cuadra no viene dibujada en ningún lado. Se podría sacar como cara del
     grafo de calles, pero eso es caro y frágil; acá se define de una forma
     más simple y que dice lo mismo para proyectar: EL FRENTE, o sea el tramo
     de la calle a la que da el lote, ciento veinte metros a cada lado, y todo
     lo que se asoma a él.

     Lo que se mide, y por qué cada cosa:

       · CONTINUIDAD. Cuánto del frente tiene edificio contra cuánto está
         vacío. Es lo que hace que una cuadra se sienta calle y no descampado,
         y es lo primero que un proyecto continúa o rompe.
       · EL HUECO MÁS GRANDE. Un frente 70 % construido con los huecos
         repartidos es otra cosa que uno con un lote baldío de cuarenta
         metros. El promedio esconde eso; el máximo no.
       · LOS USOS QUE DAN AL FRENTE. Lo que está a menos de veinticinco
         metros de la calle es lo que se ve al caminarla. Un frente de
         comercio y uno de vivienda piden fachadas distintas.
       · LAS ESQUINAS. Dónde cruza otra calle: son los puntos donde la gente
         gira, donde el comercio se paga más caro y donde un acceso funciona.

     Lo que NO es: no es catastro. No sabe cuántos predios hay ni dónde están
     sus linderos; cuenta EDIFICIOS, que es lo que OpenStreetMap registra. Dos
     casas pareadas con una sola huella cuentan como una. */
  function laCuadraDelLote() {
    var pts = (S.lote && S.lote.length >= 3) ? S.lote : null;
    if (!pts) return null;
    var vias = S.trzVias || [];
    var huellas = S.trzHuellas || [];
    if (!vias.length) return null;
    var la = null;
    try { la = analisisDelLote(); } catch (e) {}
    var centro = centroideDe(pts);

    /* A qué calle da. Si el lote tiene frentes reconocidos, el más largo; si
       no —lote interior, o calle sin nombre—, la vía más cercana. */
    var nombreFrente = '';
    if (la && (la.frentes || []).length) {
      nombreFrente = la.frentes.slice().sort(function (a, b) {
        return (b.metros || 0) - (a.metros || 0); })[0].via || '';
    }
    var via = null, mejorD = Infinity;
    vias.forEach(function (v) {
      if (!v.pts || v.pts.length < 2) return;
      if (nombreFrente && v.nombre !== nombreFrente) return;
      for (var i = 1; i < v.pts.length; i++) {
        var c = distanciaASegmento(centro, v.pts[i - 1], v.pts[i]);
        if (c.d < mejorD) { mejorD = c.d; via = v; }
      }
    });
    if (!via && nombreFrente) {
      // El nombre no apareció entre las vías medidas: se cae a la más cercana.
      vias.forEach(function (v) {
        if (!v.pts || v.pts.length < 2) return;
        for (var i = 1; i < v.pts.length; i++) {
          var c = distanciaASegmento(centro, v.pts[i - 1], v.pts[i]);
          if (c.d < mejorD) { mejorD = c.d; via = v; }
        }
      });
    }
    if (!via) return null;

    // El tramo: los vértices de la vía a menos de 120 m del lote.
    var LARGO = 120;
    var tramo = via.pts.filter(function (p) { return haversineM(centro, p) <= LARGO; });
    if (tramo.length < 2) {
      /* Una vía dibujada con dos vértices lejanos no tiene puntos cerca, y sin
         tramo no hay frente que medir. Se toma el segmento más cercano entero,
         que es la recta sobre la que se asoma el lote. */
      var mejorI = 1;
      for (var i2 = 1; i2 < via.pts.length; i2++) {
        var c2 = distanciaASegmento(centro, via.pts[i2 - 1], via.pts[i2]);
        if (c2.d <= mejorD + 0.01) { mejorI = i2; break; }
      }
      tramo = [via.pts[mejorI - 1], via.pts[mejorI]];
    }
    var largoTramo = 0;
    for (var k = 1; k < tramo.length; k++) largoTramo += haversineM(tramo[k - 1], tramo[k]);
    if (!(largoTramo > 0)) return null;

    /* Proyectar cada edificio sobre el tramo: dónde empieza y dónde termina
       medido a lo largo de la calle. Con eso, la continuidad es un problema de
       intervalos en una recta y no de geometría en el plano. */
    var acumulado = [0];
    for (var k2 = 1; k2 < tramo.length; k2++) {
      acumulado.push(acumulado[k2 - 1] + haversineM(tramo[k2 - 1], tramo[k2]));
    }
    var sobreElTramo = function (p) {
      var mejor = null, dMejor = Infinity;
      for (var i3 = 1; i3 < tramo.length; i3++) {
        var c3 = distanciaASegmento(p, tramo[i3 - 1], tramo[i3]);
        if (c3.d < dMejor) {
          dMejor = c3.d;
          mejor = acumulado[i3 - 1] + haversineM(tramo[i3 - 1], c3.p);
        }
      }
      return { s: mejor, d: dMejor };
    };

    var CERCA = 30;   // hasta dónde se considera «da al frente»
    var intervalos = [], edificios = 0;
    huellas.forEach(function (anillo) {
      if (!anillo || anillo.length < 3) return;
      var ss = [], cerca = false;
      anillo.forEach(function (p) {
        var q = sobreElTramo(p);
        if (q.s == null) return;
        if (q.d <= CERCA) cerca = true;
        ss.push(q.s);
      });
      if (!cerca || !ss.length) return;
      var a = Math.max(0, Math.min.apply(null, ss));
      var b = Math.min(largoTramo, Math.max.apply(null, ss));
      if (b - a < 1) return;
      edificios++;
      intervalos.push([a, b]);
    });

    // Unir los intervalos y medir lo lleno y los huecos.
    intervalos.sort(function (a, b) { return a[0] - b[0]; });
    var unidos = [];
    intervalos.forEach(function (iv) {
      var u = unidos[unidos.length - 1];
      if (u && iv[0] <= u[1] + 0.5) u[1] = Math.max(u[1], iv[1]);
      else unidos.push([iv[0], iv[1]]);
    });
    var lleno = unidos.reduce(function (a, u) { return a + (u[1] - u[0]); }, 0);
    var huecos = [];
    var cursor = 0;
    unidos.forEach(function (u) {
      if (u[0] - cursor > 0.5) huecos.push(Math.round(u[0] - cursor));
      cursor = Math.max(cursor, u[1]);
    });
    if (largoTramo - cursor > 0.5) huecos.push(Math.round(largoTramo - cursor));
    var mayorHueco = huecos.length ? Math.max.apply(null, huecos) : 0;

    // Los usos que se asoman al frente.
    var CAT = window.AIA_CATALOGO || {};
    var G = CAT.GRUPOS || {};
    var porGrupo = {}, nUsos = 0;
    ((S.resultado && S.resultado.pois) || []).forEach(function (p) {
      if (p.lat == null) return;
      var q = sobreElTramo(p);
      if (q.s == null || q.d > 25) return;
      nUsos++;
      var g = p.grupo || 'otro';
      porGrupo[g] = (porGrupo[g] || 0) + 1;
    });
    var usos = Object.keys(porGrupo).map(function (g) {
      return { id: g, n: porGrupo[g],
               nombre: sinEmoji((G[g] && (G[g].t || G[g].nombre)) || g) };
    }).sort(function (a, b) { return b.n - a.n; });

    /* Las esquinas del tramo: dónde otra vía se le cruza. Se cuenta un cruce
       por vía distinta, no por vértice: una calle dibujada en dos tramos que
       llegan al mismo punto es una esquina, no dos. */
    var esquinas = {};
    vias.forEach(function (v) {
      if (v === via || !v.pts || v.pts.length < 2) return;
      var nom = v.nombre || ('sin nombre ' + (v.clase || ''));
      v.pts.forEach(function (p) {
        var q = sobreElTramo(p);
        if (q.s != null && q.d <= 12) {
          if (!esquinas[nom] || Math.abs(q.s - largoTramo / 2) < Math.abs(esquinas[nom].s - largoTramo / 2)) {
            esquinas[nom] = { nombre: v.nombre || '', clase: v.clase || '', s: Math.round(q.s) };
          }
        }
      });
    });
    var listaEsq = Object.keys(esquinas).map(function (k) { return esquinas[k]; })
      .sort(function (a, b) { return a.s - b.s; });

    /* El frente típico de un edificio del tramo. NO es el lote típico —eso es
       catastro y URBIS no lo tiene—, pero es lo más cerca que se puede estar
       con huellas de edificio: dice si la cuadra es de casas de seis metros o
       de bodegas de treinta, que es lo que un proyecto tiene que continuar o
       romper a sabiendas. La mediana y no el promedio: una bodega entre veinte
       casas mueve el promedio y no mueve la mediana. */
    var frentes = intervalos.map(function (iv) { return iv[1] - iv[0]; })
      .sort(function (a, b) { return a - b; });
    var frenteTipico = frentes.length
      ? Math.round(frentes[Math.floor(frentes.length / 2)]) : null;

    var pctLleno = Math.round(100 * lleno / largoTramo);
    return {
      frenteTipicoM: frenteTipico,
      via: via.nombre || '', clase: via.clase || '',
      jerarquia: (jerarquiaVialDe(via.clase) || {}).etq || '',
      largoM: Math.round(largoTramo), llenoM: Math.round(lleno), pctLleno: pctLleno,
      edificios: edificios, huecos: huecos.length, mayorHuecoM: mayorHueco,
      usos: usos, nUsos: nUsos, esquinas: listaEsq,
      // La lectura, que es lo que se defiende.
      continua: pctLleno >= 70, rota: pctLleno < 40,
      tramo: tramo.slice()
    };
  }

  /* ── El ruido del tránsito, modelado ──────────────────────────────────
     No hay dónde bajarlo: nadie publica un mapa de ruido de Cúcuta. Pero el
     ruido del tránsito es de las pocas cosas del ambiente urbano que se
     dejan modelar razonablemente con lo que ya está medido —qué vías hay,
     de qué jerarquía y a qué distancia—, y no tenerlo era peor: hasta ahora
     la única pista era la frase «protegerse del ruido» en una lectura.

     El modelo, dicho entero para que se pueda discutir:

       · Cada jerarquía tiene un nivel de referencia a 10 m de la calzada,
         del orden de lo que mide la literatura de tránsito urbano: una
         troncal ronda los 75 dB(A) y una calle local los 58.
       · El nivel cae 3 dB(A) cada vez que se dobla la distancia, que es la
         divergencia de una fuente LINEAL —una calle es una línea de coches,
         no un altavoz—. Un punto se atenuaría a 6.
       · Cuando llegan dos fuentes se suman en energía, no en decibeles: dos
         calles de 60 dan 63, no 120.

     Lo que el modelo NO sabe, y por eso va escrito al lado del número: cuánto
     tránsito pasa de verdad, si hay semáforo —frenar y arrancar suena más que
     rodar—, si el pavimento está bueno, si hay una pendiente que hace rugir
     los camiones, si hay una tapia que apantalla o una fachada que rebota. En
     Cúcuta hay que sumarle las motos, que el modelo tampoco distingue.

     Sirve para lo que sirve: decidir a qué lado del lote NO van los
     dormitorios, y saber si hace falta medir en serio con sonómetro. */
  var RUIDO_REF = { troncal: 75, principal: 72, secundaria: 68, colectora: 63,
                    local: 58, peatonal: 50 };
  function ruidoDelLote() {
    var pts = (S.lote && S.lote.length >= 3) ? S.lote : null;
    var centro = pts ? centroideDe(pts) : (S.resultado && S.resultado.meta &&
      S.resultado.meta.lat != null ? { lat: S.resultado.meta.lat, lng: S.resultado.meta.lng } : null);
    if (!centro) return null;
    var vias = S.trzVias || [];
    if (!vias.length) return null;

    var aportes = [];
    vias.forEach(function (v) {
      var j = jerarquiaVialDe(v.clase);
      if (!j || !v.pts || v.pts.length < 2) return;
      var ref = RUIDO_REF[j.id];
      if (ref == null) return;
      // La distancia al TRAMO más cercano de esa vía, no a su primer punto:
      // una avenida que pasa a treinta metros y sigue un kilómetro tiene su
      // punto más cercano en cualquier parte.
      var d = Infinity;
      for (var i = 1; i < v.pts.length; i++) {
        var c = distanciaASegmento(centro, v.pts[i - 1], v.pts[i]);
        if (c.d < d) d = c.d;
      }
      if (!isFinite(d)) return;
      // A menos de 10 m no se baja del nivel de referencia: el modelo deja de
      // valer pegado a la calzada y prometer 80 dB sería inventar precisión.
      var dm = Math.max(10, d);
      var nivel = ref - 10 * Math.log(dm / 10) / Math.LN10;   // −3 dB al doblar
      if (nivel < 30) return;
      aportes.push({ nombre: v.nombre || '', jerarquia: j.id, etq: j.etq,
                     color: j.color, distM: Math.round(d), dB: Math.round(nivel * 10) / 10 });
    });
    if (!aportes.length) return null;
    // Suma energética: 10·log10(Σ 10^(Li/10)).
    var suma = aportes.reduce(function (a, x) { return a + Math.pow(10, x.dB / 10); }, 0);
    var total = Math.round(10 * Math.log(suma) / Math.LN10 * 10) / 10;
    aportes.sort(function (a, b) { return b.dB - a.dB; });

    /* Los escalones son los de la norma colombiana de ruido ambiental
       —Resolución 627 de 2006 del entonces MAVDT—: 65 dB(A) de día en sector
       de tranquilidad y ruido moderado, que es donde cae la vivienda. */
    var G = total >= 75 ? { id: 'muy-alto', etq: 'Muy alto', color: '#B3282C' }
          : total >= 70 ? { id: 'alto', etq: 'Alto', color: '#C2410C' }
          : total >= 65 ? { id: 'en-el-limite', etq: 'En el límite', color: '#D97706' }
          : total >= 55 ? { id: 'moderado', etq: 'Moderado', color: '#0A6F9E' }
                        : { id: 'tranquilo', etq: 'Tranquilo', color: '#2E9E5B' };
    return {
      dB: total, grado: G.id, etq: G.etq, color: G.color,
      limiteDiaVivienda: 65,
      pasaElLimite: total > 65,
      principales: aportes.slice(0, 4),
      cuantas: aportes.length,
      desdeElLote: !!pts
    };
  }

  /* ── La sombra que arroja el proyecto ─────────────────────────────────
     La caja de al lado calcula la sombra que los VECINOS echan sobre el lote.
     Esta es la inversa, y es la que pregunta un jurado apenas ve la
     volumetría: a quién le tapás el sol vos.

     Es el mismo cálculo con el signo cambiado —el mismo sol, el mismo casco
     convexo, el mismo muestreo—, así que costó poco y llevaba años faltando.

     De qué volumen se habla: el que sale de «Qué cabe en el lote», que es lo
     que la norma permite y no lo que alguien vaya a construir. La huella se
     modela encogiendo el propio lote hacia su centro hasta que su área sea la
     huella permitida. Es una APROXIMACIÓN y hay que decirlo: un proyecto real
     se separa distinto en cada lindero y casi nunca es una reducción a escala
     del predio. Sirve para saber a quién le va a caer la sombra y en qué
     orden de magnitud; no reemplaza la sombra del proyecto dibujado. */
  function sombraDelProyecto(fecha) {
    var pts = S.lote || [];
    var SOL = window.URBIS_SOLAR, Q = window.URBIS_QUE_CABE;
    if (pts.length < 3 || !SOL || !Q) return null;
    var la = null;
    try { la = analisisDelLote(); } catch (e) {}
    if (!la) return null;
    var q = null;
    try { q = Q.calcular(la, S.indices || Q.porDefecto(), ctxQueCabe(), S.indicesPuestos); }
    catch (e) { return null; }
    if (!q || !q.huellaM2 || !(q.indices && q.indices.pisos)) return null;

    var centro = centroideDe(pts);
    var rad = Math.PI / 180;
    var kx = Math.cos(centro.lat * rad) * 111320, ky = 110540;
    var aMetros = function (p) { return { x: (p.lng - centro.lng) * kx, y: (p.lat - centro.lat) * ky }; };
    var aGrados = function (q2) { return { lat: centro.lat + q2.y / ky, lng: centro.lng + q2.x / kx }; };

    var loteXY = pts.map(aMetros);
    var areaLote = Math.abs(areaXY(loteXY));
    if (!(areaLote > 0)) return null;
    /* El encogimiento va por la raíz del cociente de áreas: encoger un
       polígono a la mitad de lado deja un cuarto de área, no la mitad. */
    var k = Math.sqrt(Math.min(1, q.huellaM2 / areaLote));
    var huellaXY = loteXY.map(function (p) { return { x: p.x * k, y: p.y * k }; });
    var pisos = q.indices.pisos;
    var alturaM = pisos * ALTO_POR_PISO_M;

    /* Los vecinos a los que puede alcanzarle. El mismo radio de 200 m que usa
       la sombra de los vecinos: más allá, para que un edificio le tape el sol
       a otro hace falta una torre que en un barrio no hay. */
    var vecinos = [];
    (S.trzHuellas || []).forEach(function (anillo, i) {
      if (!anillo || anillo.length < 3) return;
      if (haversineM(centro, anillo[0]) > 200) return;
      var xy = anillo.map(aMetros);
      // Que no sea el propio lote: una huella cuyo centro cae dentro del lote
      // es el edificio que ya está y que el proyecto reemplaza.
      var c = centroXY(xy);
      if (dentroDePoligonoXY(c, loteXY)) return;
      vecinos.push({ anillo: anillo, xy: xy, pisos: (S.trzPisos || [])[i] || null,
                     muestras: muestrearXY(xy, 6) });
    });

    var horas = HORAS_SOMBRA.map(function (h) {
      var dia = fecha ? new Date(fecha) : new Date();
      var t = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, 0, 0);
      var pos;
      try { pos = SOL.posicion(t, centro.lat, centro.lng); } catch (e) { return null; }
      if (!pos || pos.altitud <= 5) {
        return { hora: h, altitud: pos ? Math.round(pos.altitud * 10) / 10 : null,
                 bajo: true, sombra: [], m2Fuera: 0, tocados: [] };
      }
      var largo = alturaM / Math.tan(pos.altitud * rad);
      var az = (pos.azimut + 180) % 360;
      var dx = Math.sin(az * rad), dy = Math.cos(az * rad);
      var movida = huellaXY.map(function (p) { return { x: p.x + dx * largo, y: p.y + dy * largo }; });
      var sombra = cascoConvexo(huellaXY.concat(movida));
      if (sombra.length < 3) return { hora: h, altitud: pos.altitud, sombra: [], m2Fuera: 0, tocados: [] };

      /* Cuánta sombra cae FUERA del lote, que es la que le cuesta a alguien.
         Se mide muestreando la caja de la sombra: intersecar dos polígonos
         cóncavos con exactitud costaría más y no cambiaría la decisión. */
      var m2Fuera = areaFueraXY(sombra, loteXY);
      var tocados = vecinos.map(function (v) {
        var n = 0;
        v.muestras.forEach(function (m) { if (dentroDePoligonoXY(m, sombra)) n++; });
        return { pisos: v.pisos, anillo: v.anillo,
                 pct: v.muestras.length ? Math.round(100 * n / v.muestras.length) : 0 };
      }).filter(function (v) { return v.pct > 0; })
        .sort(function (a, b) { return b.pct - a.pct; });

      return {
        hora: h, altitud: Math.round(pos.altitud * 10) / 10,
        azimut: Math.round(pos.azimut * 10) / 10,
        largoM: Math.round(largo),
        m2Fuera: Math.round(m2Fuera),
        tocados: tocados,
        sombra: sombra.map(aGrados)
      };
    }).filter(Boolean);

    var peor = horas.slice().sort(function (a, b) { return b.m2Fuera - a.m2Fuera; })[0] || null;
    var masTocados = horas.reduce(function (m, h) { return Math.max(m, h.tocados.length); }, 0);
    return {
      horas: horas, pisos: pisos, alturaM: Math.round(alturaM),
      huellaM2: q.huellaM2, areaLoteM2: Math.round(areaLote),
      vecinosCerca: vecinos.length,
      vecinosSinPisos: vecinos.filter(function (v) { return !v.pisos; }).length,
      peor: peor, masTocados: masTocados,
      centro: centro, lote: pts.slice()
    };
  }

  // El área con signo de un anillo en metros. Se usa para saber cuánto mide el
  // lote sin volver a pedirle nada a nadie.
  function areaXY(poli) {
    var a = 0;
    for (var i = 0, j = poli.length - 1; i < poli.length; j = i++) {
      a += (poli[j].x + poli[i].x) * (poli[j].y - poli[i].y);
    }
    return a / 2;
  }
  function centroXY(poli) {
    var x = 0, y = 0;
    poli.forEach(function (p) { x += p.x; y += p.y; });
    return { x: x / poli.length, y: y / poli.length };
  }
  /* Una rejilla de puntos dentro de un anillo, para preguntar «qué parte de
     esto quedó tapado» sin intersecar polígonos. Con `n` chico basta: lo que
     se busca es si a un vecino le cae encima media fachada o una esquina. */
  function muestrearXY(poli, n) {
    // En dos renglones y no en uno: la revisión sin navegador lee las
    // declaraciones hasta el primer punto y coma, y con el `return p.x;` de la
    // función de en medio se le pierde la segunda variable.
    var xs = poli.map(function (p) { return p.x; });
    var ys = poli.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var out = [];
    for (var i = 0; i < n; i++) {
      for (var j = 0; j < n; j++) {
        var p = { x: x0 + (x1 - x0) * ((i + 0.5) / n), y: y0 + (y1 - y0) * ((j + 0.5) / n) };
        if (dentroDePoligonoXY(p, poli)) out.push(p);
      }
    }
    return out.length ? out : [centroXY(poli)];
  }
  /* Cuántos metros cuadrados de `poli` caen fuera de `dentro`. Por muestreo
     sobre la caja de `poli`: cada muestra vale el área de su celda. */
  function areaFueraXY(poli, dentro) {
    // En dos renglones y no en uno: la revisión sin navegador lee las
    // declaraciones hasta el primer punto y coma, y con el `return p.x;` de la
    // función de en medio se le pierde la segunda variable.
    var xs = poli.map(function (p) { return p.x; });
    var ys = poli.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var N = 40, cel = ((x1 - x0) / N) * ((y1 - y0) / N), fuera = 0;
    for (var i = 0; i < N; i++) {
      for (var j = 0; j < N; j++) {
        var p = { x: x0 + (x1 - x0) * ((i + 0.5) / N), y: y0 + (y1 - y0) * ((j + 0.5) / N) };
        if (dentroDePoligonoXY(p, poli) && !dentroDePoligonoXY(p, dentro)) fuera += cel;
      }
    }
    return fuera;
  }

  /* Casco convexo por el método de la cadena monótona. Sobre coordenadas ya
     proyectadas a metros, que es donde «convexo» quiere decir algo. */
  function cascoConvexo(puntos) {
    var ps = puntos.slice().sort(function (a, b) { return a.x - b.x || a.y - b.y; });
    if (ps.length < 3) return ps;
    var cruz = function (o, a, b) {
      return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    };
    var abajo = [], arriba = [];
    ps.forEach(function (p) {
      while (abajo.length >= 2 && cruz(abajo[abajo.length - 2], abajo[abajo.length - 1], p) <= 0) abajo.pop();
      abajo.push(p);
    });
    for (var i = ps.length - 1; i >= 0; i--) {
      var p2 = ps[i];
      while (arriba.length >= 2 && cruz(arriba[arriba.length - 2], arriba[arriba.length - 1], p2) <= 0) arriba.pop();
      arriba.push(p2);
    }
    abajo.pop(); arriba.pop();
    return abajo.concat(arriba);
  }

  function dentroDePoligonoXY(p, poli) {
    var dentro = false;
    for (var i = 0, j = poli.length - 1; i < poli.length; j = i++) {
      var a = poli[i], b = poli[j];
      if ((a.y > p.y) !== (b.y > p.y) &&
          p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) dentro = !dentro;
    }
    return dentro;
  }

  /* Los dos cortes por el lote y las cifras del terreno que lo sostiene.
     Los cortes NO se recortan al lote: van de borde a borde de la rejilla,
     porque un corte de veinte metros sobre un modelo de noventa es una línea
     recta que no dice nada. Lo que se marca es DÓNDE cae el lote dentro del
     corte, que es la pregunta de verdad: si está en la parte alta, en la baja
     o a media ladera. */
  /* `loteDado` y `rejDada` llegan desde una ficha guardada, que imprime sin
     tocar el estado de la ficha viva. Sin parámetros, trabaja sobre lo que
     hay en pantalla. */
  function terrenoDelLote(loteDado, rejDada) {
    var pts = loteDado || S.lote || [];
    var R = rejDada || S.terRejilla;
    if (pts.length < 3 || !R || !R.limites) return null;
    var L = R.limites;
    var Z = function (p) { return cotaEn(p, R); };
    var centro = centroideDe(pts);
    if (Z(centro) == null) return null;

    var lats = pts.map(function (p) { return p.lat; });
    var lngs = pts.map(function (p) { return p.lng; });
    var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
    var minLng = Math.min.apply(null, lngs), maxLng = Math.max.apply(null, lngs);

    function corteConMarca(a, b, dLote1, dLote2, etiqueta) {
      var puntos = corteEntre(a, b, 80, null, R);
      if (puntos.length < 3) return null;
      return { etiqueta: etiqueta, puntos: puntos,
               marca: { desde: dLote1, hasta: dLote2, texto: 'el lote' } };
    }

    // A–A′: de poniente a naciente por la latitud del lote.
    var oesteA = { lat: centro.lat, lng: L.minLng }, esteA = { lat: centro.lat, lng: L.maxLng };
    var largoA = haversineM(oesteA, esteA);
    var fA = function (lng) { return largoA * (lng - L.minLng) / (L.maxLng - L.minLng); };
    // B–B′: de norte a sur por la longitud del lote.
    var norteB = { lat: L.maxLat, lng: centro.lng }, surB = { lat: L.minLat, lng: centro.lng };
    var largoB = haversineM(norteB, surB);
    var fB = function (lat) { return largoB * (L.maxLat - lat) / (L.maxLat - L.minLat); };

    var cortes = [
      corteConMarca(oesteA, esteA, fA(minLng), fA(maxLng), 'A–A′ por el lote, de occidente a oriente'),
      corteConMarca(norteB, surB, fB(maxLat), fB(minLat), 'B–B′ por el lote, de norte a sur')
    ].filter(Boolean);
    if (!cortes.length) return null;

    // Las cotas del propio lote: en las esquinas y en el centro.
    var cotas = pts.map(Z).concat([Z(centro)])
      .filter(function (z) { return z != null; });
    var cMin = Math.min.apply(null, cotas), cMax = Math.max.apply(null, cotas);

    /* Hacia dónde baja el terreno en el lote: el gradiente de la rejilla en
       el centro, medido con dos puntos a cada lado a un paso de la rejilla.
       Es la dirección por la que corre el agua, que es lo primero que se
       pregunta de un terreno en pendiente. */
    var pasoLat = (L.maxLat - L.minLat) / (R.filas - 1);
    var pasoLng = (L.maxLng - L.minLng) / (R.columnas - 1);
    var zN = Z({ lat: centro.lat + pasoLat, lng: centro.lng });
    var zS = Z({ lat: centro.lat - pasoLat, lng: centro.lng });
    var zE = Z({ lat: centro.lat, lng: centro.lng + pasoLng });
    var zO = Z({ lat: centro.lat, lng: centro.lng - pasoLng });
    var baja = null, pendPct = null;
    if (zN != null && zS != null && zE != null && zO != null) {
      var mLat = haversineM({ lat: centro.lat - pasoLat, lng: centro.lng },
                            { lat: centro.lat + pasoLat, lng: centro.lng });
      var mLng = haversineM({ lat: centro.lat, lng: centro.lng - pasoLng },
                            { lat: centro.lat, lng: centro.lng + pasoLng });
      var dzdx = mLng ? (zE - zO) / mLng : 0;
      var dzdy = mLat ? (zN - zS) / mLat : 0;
      pendPct = Math.round(Math.sqrt(dzdx * dzdx + dzdy * dzdy) * 1000) / 10;
      if (pendPct > 1) {
        // El agua baja al contrario del ascenso: de ahí los signos cambiados.
        baja = rumboDe360((Math.atan2(-dzdx, -dzdy) * 180 / Math.PI + 360) % 360);
      }
    }

    return {
      cortes: cortes,
      cota: { centro: Math.round(Z(centro) * 10) / 10,
              min: Math.round(cMin * 10) / 10, max: Math.round(cMax * 10) / 10,
              relieve: Math.round((cMax - cMin) * 10) / 10 },
      pendientePct: pendPct,
      baja: baja,
      resolucionM: (S.terreno && S.terreno.resolucionM) || 90
    };
  }

  /* Cuánto le da el sol a una fachada que mira hacia `mira` (azimut de su
     normal) cuando el sol está en `azSol`: el coseno del ángulo entre las
     dos, recortado a cero. Uno es de frente; cero es de canto o de espaldas.
     Es geometría de primer curso y basta: no modela vecinos ni montañas —eso
     lo dicen las sombras, aparte—. */
  function exposicionSolar(mira, azSol) {
    var d = Math.abs(((mira - azSol + 540) % 360) - 180);   // 0..180
    var c = Math.cos(d * Math.PI / 180);
    return c > 0 ? Math.round(c * 100) / 100 : 0;
  }

  /* La escala en cinco niveles, del rojo al azul: es lo que se pidió, y es
     la que se lee de un vistazo en el mapa y en la lámina. */
  var NIVELES_SOL = [
    { id: 'pleno',   nombre: 'sol pleno de la tarde', color: '#C62828', min: 0.85 },
    { id: 'fuerte',  nombre: 'sol fuerte',            color: '#EF6C00', min: 0.60 },
    { id: 'medio',   nombre: 'sol medio',             color: '#F9C80E', min: 0.35 },
    { id: 'poco',    nombre: 'poco sol',              color: '#43A047', min: 0.10 },
    { id: 'ninguno', nombre: 'sin sol de la tarde',   color: '#1E88E5', min: 0 }
  ];
  function nivelDeSol(x) {
    for (var i = 0; i < NIVELES_SOL.length; i++) {
      if ((x || 0) >= NIVELES_SOL[i].min) return NIVELES_SOL[i];
    }
    return NIVELES_SOL[NIVELES_SOL.length - 1];
  }

  /* `preA` es el análisis ya calculado que trae una ficha guardada. Se guarda
     hecho y no se recalcula porque para rehacerlo harían falta la forma de
     todas las calles del sector, y eso son dos mil geometrías que no tiene
     sentido meter dentro de una ficha: el resultado ocupa veinte líneas. */
  function bloqueLoteIntervenir(preA, soloLectura) {
    // Sin sector analizado el lote no tiene contra qué leerse: se oculta el
    // lápiz entero en vez de ofrecerlo y dar un análisis vacío.
    if (!preA && !S.resultado) return '';
    var a = preA || analisisDelLote();
    if (!a) {
      return h4('area', 'El lote a intervenir') +
        '<p class="pcr-pista">El área dice <b>qué hay alrededor</b>. El lote dice <b>dónde vas a ' +
        'proponer algo</b>. Marcalo y sale su propio análisis: cuánto mide, a qué calles da, ' +
        'cuántos metros de frente sobre cada una, hacia dónde mira cada fachada y qué tiene pegado ' +
        'al lado.</p>' +
        '<div class="pcr-llevar">' +
          '<button type="button" data-pcr="lote-dibujar" class="pcr-mini pcr-llevar-b pcr-lote-btn">' +
            ico('lapiz') + 'Marcar el lote</button>' +
        '</div>' +
        (S.loteAviso ? '<p class="pcr-error">' + esc(S.loteAviso) + '</p>' : '');
    }

    /* Ojo con las horas: en la ficha viva son objetos Date, pero una ficha
       guardada pasó por JSON y vuelven como texto. Llamarles
       toLocaleTimeString a un texto revienta, y como esto se pinta dentro del
       informe guardado, la pestaña entera se quedaba sin abrir sin decir por
       qué. Se acepta cualquiera de las dos formas. */
    var hh = function (x) {
      if (!x) return '—';
      var d = (x instanceof Date) ? x : new Date(x);
      return isNaN(d.getTime()) ? '—'
        : d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
    };
    return h4('area', 'El lote a intervenir') +
      (a.dentro ? '' : '<p class="pcr-error">' + esc(S.loteAviso || 'El lote quedó fuera del área analizada.') + '</p>') +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + formatearM2(a.areaM2).replace(' m²', '') + '</b><small>m² de lote</small></div>' +
        '<div class="pcr-kpi"><b>' + a.perimetroM + '</b><small>m de perímetro</small></div>' +
        '<div class="pcr-kpi"><b>' + a.esquinas + '</b><small>esquinas</small></div>' +
      '</div>' +
      /* El plano acotado. Es lo primero que se dibuja en cualquier
         anteproyecto y hasta acá el lote se leía como una tabla de números:
         cada lado con su medida, la calle a la que da, y en rojo la fachada
         que recibe el sol de la tarde. */
      (function () {
        var pl = dib('planoDelLote', S.lote, a);
        return pl
          ? '<div class="pcr-dibujo pcr-dibujo-solo">' + pl +
            '<p class="pcr-dibujo-pie">El lote a escala, con el norte arriba. Cada lado lleva su ' +
            'medida y, si da a una calle registrada, su nombre.</p></div>'
          : '';
      })() +

      (a.frentes.length
        ? '<p class="pcr-lab">Sus frentes</p>' +
          a.frentes.map(function (f) {
            return '<div class="pcr-lote-fila"><span>' + esc(f.via) + '</span><b>' +
              f.metros + ' m de frente</b></div>';
          }).join('') +
          (a.sinFrenteM
            ? '<p class="pcr-pista">Otros <b>' + a.sinFrenteM + ' m</b> del perímetro no dan a ninguna ' +
              'calle registrada: son medianeros, o la calle no está mapeada.</p>'
            : '') +
          (a.esquinero
            ? '<p class="pcr-conc">Es un <b>lote esquinero</b>: da a ' + a.frentes.length +
              ' calles. Dos frentes es el doble de fachada útil y el doble de ruido.</p>'
            : '<p class="pcr-conc">Es un lote <b>medianero</b>: un solo frente a la calle.</p>')
        : (a.hayVias
            ? '<p class="pcr-pista">Ningún lado del lote quedó a menos de 30 m de una calle con forma ' +
              'registrada. Puede ser un interior de manzana, o que las calles de alrededor no estén ' +
              'mapeadas.</p>'
            : '<p class="pcr-pista">Para saber a qué calles da el lote hace falta <b>medir el trazado ' +
              'del sector</b> primero: es de ahí de donde salen la forma y el nombre de las calles.</p>')) +

      '<p class="pcr-lab">Sus lados, y cuánto sol de la tarde recibe cada uno</p>' +
      a.lados.map(function (l) {
        var nv = l.nivelSol || nivelDeSol(l.solTarde);
        return '<div class="pcr-lote-fila pcr-lado-sol"><span>' +
          '<i class="pcr-sol-punto" style="background:' + esc(nv.color) + '"></i>Lado ' + l.i +
          (l.via ? ' · ' + esc(l.via) : '') + '</span><b>' + l.largoM + ' m · mira al ' +
          esc((l.mira && l.mira.nombre) || '—') + ' · ' + esc(nv.nombre) + '</b></div>';
      }).join('') +
      '<div class="pcr-sol-leyenda">' +
        NIVELES_SOL.map(function (n) {
          return '<span><i style="background:' + n.color + '"></i>' + esc(n.nombre) + '</span>';
        }).join('') +
      '</div>' +

      (a.critica
        ? '<p class="pcr-conc">La que más se calienta es el <b>lado ' + a.critica.i + '</b>' +
          (a.critica.via ? ' (' + esc(a.critica.via) + ')' : '') + ', que mira al ' +
          esc((a.critica.mira && a.critica.mira.nombre) || 'occidente') + '; los de al lado la siguen ' +
          'en la medida en que también miran al poniente. Se mide contra el sol que se pone ' +
          (a.azimutPuesta ? 'hoy a los ' + a.azimutPuesta + '°' : 'hoy') + ', no contra un oeste fijo: ' +
          'en el trópico el sol de la tarde entra casi horizontal, y al mediodía está tan alto que ' +
          'la fachada apenas lo recibe — el problema del mediodía es la cubierta.</p>'
        : '') +
      /* El terreno bajo el lote: dos cortes por su centro, de borde a borde
         del sector, con el lote marcado sobre el recorrido. Es la respuesta a
         «¿está arriba o abajo de la ladera?», que es la pregunta que decide
         accesos, escorrentía y plataformas. */
      (function () {
        var tl = (function () { try { return terrenoDelLote(); } catch (e) { return null; } })();
        if (!tl) {
          return S.terreno
            ? ''
            : '<p class="pcr-pista">Para ver <b>el corte del terreno por el lote</b> hay que ' +
              '<b>medir el terreno</b> del sector primero: de ahí sale la rejilla de cotas.</p>';
        }
        return '<p class="pcr-lab">El terreno bajo el lote</p>' +
          '<div class="pcr-kpis">' +
            '<div class="pcr-kpi"><b>' + tl.cota.centro + '</b><small>msnm en el centro</small></div>' +
            '<div class="pcr-kpi"><b>' + tl.cota.relieve + ' m</b><small>de desnivel en el lote</small></div>' +
            '<div class="pcr-kpi"><b>' + (tl.pendientePct != null ? tl.pendientePct + '%' : '—') +
              '</b><small>de pendiente</small></div>' +
          '</div>' +
          (tl.baja
            ? '<p class="pcr-conc">El terreno baja hacia el <b>' + esc(tl.baja.nombre) + '</b>: ' +
              'por ahí corre el agua, y por ahí hay que sacarla del lote.</p>'
            : '<p class="pcr-conc">En el entorno del lote el terreno es prácticamente plano.</p>') +
          tl.cortes.map(function (c) {
            var d = dib('corteTopografico', c);
            return d ? '<div class="pcr-corte-caja">' + d + '</div>' : '';
          }).join('') +
          '<p class="pcr-pista">Los dos cortes cruzan el sector entero por el centro del lote, y la ' +
          'banda amarilla es dónde cae el lote dentro de cada uno. No se recortan al lote a ' +
          'propósito: el modelo tiene <b>' + tl.resolucionM + ' m de paso</b>, así que un lote de ' +
          'este tamaño cabe dentro de una sola celda y su corte propio sería una línea recta ' +
          'inventada. Esto sitúa el lote en la ladera; la cota de cada esquina se levanta con ' +
          'topografía en campo.</p>';
      })() +

      /* Las sombras de los vecinos. La carta solar dice por dónde entra el
         sol; esto dice si al lote le llega. */
      (function () {
        var so = S.sombras || (S.sombras = (function () {
          try { return sombrasDelLote(); } catch (e) { return null; }
        })());
        if (!so) {
          /* En una ficha guardada no viajan las huellas —serían miles de
             polígonos dentro del almacenamiento del teléfono—, así que acá no
             se puede proyectar nada y tampoco tiene sentido mandar a medir un
             trazado que ya se midió. Se calla. */
          if (soloLectura) return '';
          return (S.trzHuellas && S.trzHuellas.length)
            ? ''
            : '<p class="pcr-pista">Para proyectar <b>la sombra de los vecinos</b> sobre el lote hay ' +
              'que <b>medir el trazado del sector</b>: de ahí salen las huellas de los edificios y ' +
              'sus pisos.</p>';
        }
        if (so.sinAlturas) {
          return '<p class="pcr-lab">La sombra de los vecinos</p>' +
            '<p class="pcr-conc">Hay edificios alrededor, pero <b>ninguno</b> de los ' +
            so.vecinosSinPisos + ' que rodean el lote tiene sus pisos registrados en OpenStreetMap, ' +
            'y sin altura no hay sombra que proyectar.</p>' +
            '<p class="pcr-pista">Contar los pisos de las cuatro o cinco construcciones que dan al ' +
            'lote es media hora de campo y es lo que enciende este análisis. Se anotan en el mapeo ' +
            'como <b>building:levels</b>.</p>';
        }
        var dib1 = dib('planoDeSombras', so);
        return '<p class="pcr-lab">La sombra de los vecinos</p>' +
          '<div class="pcr-kpis">' +
            so.horas.map(function (h) {
              return '<div class="pcr-kpi"><b>' + h.pctLote + '%</b><small>del lote en sombra a las ' +
                h.hora + ':00</small></div>';
            }).join('') +
          '</div>' +
          (dib1 ? '<div class="pcr-dibujo pcr-dibujo-solo">' + dib1 +
            '<p class="pcr-dibujo-pie">Planta de hoy con las sombras de las tres horas superpuestas. ' +
            'Donde se cruzan, el lote no ve el sol en casi todo el día.</p></div>' : '') +
          '<div class="pcr-llevar">' +
            '<button type="button" data-pcr="sombras-mapa" class="pcr-mini pcr-llevar-b">' +
              (S.sombrasEnMapa ? ico('apagar', 16) + 'Quitar las sombras del mapa'
                               : ico('mapa', 16) + 'Ver las sombras en el mapa') +
            '</button>' +
          '</div>' +
          '<p class="pcr-pista">Se proyectan <b>' + so.vecinos + ' edificio' +
          (so.vecinos === 1 ? '' : 's') + '</b> a menos de 200 m, el más alto de ' + so.masAlto +
          ' pisos, contando <b>' + so.alturaPorPiso + ' m por piso</b>. ' +
          (so.vecinosSinPisos
            ? 'Otros <b>' + so.vecinosSinPisos + '</b> no tienen pisos registrados y no proyectan ' +
              'nada: la sombra real es mayor que esta. '
            : '') +
          'No entran árboles, muros ni tanques, y el terreno se supone plano: en ladera la sombra ' +
          'cae más lejos cuesta abajo. Es geometría del sol, no una simulación.</p>';
      })() +

      (a.sol && a.sol.salida
        ? '<p class="pcr-pista">Hoy sobre este lote: sale a las ' + esc(hh(a.sol.salida)) +
          ', se pone a las ' + esc(hh(a.sol.puesta)) + ', y al mediodía llega a ' +
          a.sol.alturaMaxima + '°.</p>'
        : '') +

      (a.vecinos.length
        ? '<p class="pcr-lab">Qué tiene pegado al lado</p>' +
          a.vecinos.slice(0, 8).map(function (v) {
            return '<div class="pcr-lote-fila"><span>' + esc(v.nombre || nombreGrupo(v.grupo)) +
              '</span><b>a ' + v.distM + ' m</b></div>';
          }).join('') +
          '<p class="pcr-pista">' + a.nVecinos + ' usos registrados a menos de 200 m del centro del ' +
          'lote. Medido en línea recta desde el centro, no desde la puerta.</p>'
        : '<p class="pcr-pista">No hay usos registrados a menos de 200 m del lote. Puede ser un borde ' +
          'de ciudad, o una cuadra sin mapear: eso se resuelve caminándola.</p>') +

      (S.terreno
        ? '<p class="pcr-pista">El terreno del sector se midió con un modelo de <b>90 m de paso</b>. ' +
          'Para un lote de este tamaño eso da una cota, no una pendiente: la pendiente del lote se ' +
          'mide en el sitio, con nivel o con manguera.</p>'
        : '') +

      (soloLectura
        ? ''
        : '<div class="pcr-llevar">' +
            '<button type="button" data-pcr="lote-dibujar" class="pcr-mini pcr-llevar-b">' +
              ico('lapiz') + 'Volver a marcarlo</button>' +
            '<button type="button" data-pcr="lote-borrar" class="pcr-mini">' +
              ico('borrar', 16) + 'Quitar el lote</button>' +
          '</div>');
  }


  /* ── Hasta dónde se llega caminando ────────────────────────────────────
     Toda la cobertura que calcula esta app hasta acá se mide en LÍNEA RECTA,
     y en cada bloque se dice: «caminando siempre es más». Es verdad y es una
     limitación, y con la forma de las calles ya en la mano se puede quitar.

     Esto camina de verdad: arma un grafo con los tramos de vía del sector,
     engancha el lote a la calle más cercana y recorre desde ahí sumando
     metros, como caminaría una persona. Lo que sale es lo que se alcanza en
     cinco, diez y quince minutos SIGUIENDO LAS CALLES, con sus vueltas.

     Lo que sigue sin saber, y se dice donde se lee: si hay andén, si hay
     dónde cruzar, y si la cuadra es una subida. En Cúcuta las tres cosas
     cambian mucho un recorrido de diez minutos — y las tres se levantan
     caminándolas, que es el trabajo del curso. */
  var PASO_M_POR_MIN = 80;   // paso corriente de una persona adulta

  /* El grafo. Los nodos se redondean a seis decimales —unos diez centímetros—
     para que dos tramos que comparten esquina compartan también el nodo: sin
     eso el grafo queda hecho de pedazos sueltos y no se puede caminar de una
     calle a la otra. */
  function grafoDeVias(vias) {
    var nodos = {}, ady = {};
    var clave = function (p) { return p.lat.toFixed(6) + ',' + p.lng.toFixed(6); };
    (vias || []).forEach(function (v) {
      for (var i = 1; i < v.pts.length; i++) {
        var a = v.pts[i - 1], b = v.pts[i];
        var ka = clave(a), kb = clave(b);
        if (ka === kb) continue;
        var d = haversineM(a, b);
        if (!(d > 0)) continue;
        if (!nodos[ka]) nodos[ka] = a;
        if (!nodos[kb]) nodos[kb] = b;
        (ady[ka] || (ady[ka] = [])).push({ a: kb, d: d });
        (ady[kb] || (ady[kb] = [])).push({ a: ka, d: d });
      }
    });
    return { nodos: nodos, ady: ady };
  }

  /* Dijkstra desde el nodo más cercano al punto de partida. Devuelve la
     distancia caminando hasta cada nodo alcanzable dentro del tope. */
  function caminarDesde(grafo, origen, topeM) {
    var claves = Object.keys(grafo.nodos);
    if (!claves.length) return null;
    // Enganchar a la calle: el nodo más cercano al punto de partida.
    var kIni = null, dIni = Infinity;
    claves.forEach(function (k) {
      var d = haversineM(origen, grafo.nodos[k]);
      if (d < dIni) { dIni = d; kIni = k; }
    });
    // Si la calle más cercana está a más de cien metros, engancharse ahí sería
    // inventar un camino que nadie recorre. Mejor decir que no se puede.
    if (!kIni || dIni > 100) return { lejos: true, distanciaAlaCalleM: Math.round(dIni) };

    var dist = {}; dist[kIni] = 0;
    /* Cola por montón binario. Con una lista ordenada esto se vuelve
       cuadrático y un sector del centro con veinte mil tramos deja el teléfono
       pensando varios segundos. */
    var cola = [{ k: kIni, d: 0 }];
    var sacar = function () {
      if (!cola.length) return null;
      var top = cola[0], ult = cola.pop();
      if (cola.length) {
        cola[0] = ult;
        var i = 0;
        for (;;) {
          var iz = 2 * i + 1, de = 2 * i + 2, m = i;
          if (iz < cola.length && cola[iz].d < cola[m].d) m = iz;
          if (de < cola.length && cola[de].d < cola[m].d) m = de;
          if (m === i) break;
          var t = cola[i]; cola[i] = cola[m]; cola[m] = t; i = m;
        }
      }
      return top;
    };
    var meter = function (k, d) {
      cola.push({ k: k, d: d });
      var i = cola.length - 1;
      while (i > 0) {
        var p = (i - 1) >> 1;
        if (cola[p].d <= cola[i].d) break;
        var t = cola[i]; cola[i] = cola[p]; cola[p] = t; i = p;
      }
    };

    var visto = {};
    for (;;) {
      var top = sacar();
      if (!top) break;
      if (visto[top.k]) continue;
      visto[top.k] = true;
      if (top.d > topeM) continue;
      var vecinos = grafo.ady[top.k] || [];
      for (var i = 0; i < vecinos.length; i++) {
        var nd = top.d + vecinos[i].d;
        if (nd > topeM) continue;
        if (dist[vecinos[i].a] === undefined || nd < dist[vecinos[i].a]) {
          dist[vecinos[i].a] = nd;
          meter(vecinos[i].a, nd);
        }
      }
    }
    return { dist: dist, kIni: kIni, distanciaAlaCalleM: Math.round(dIni) };
  }

  function caminataDesdeLote() {
    var pts = S.lote || [];
    if (pts.length < 3) return null;
    var vias = S.trzVias || [];
    if (!vias.length) return { sinVias: true };

    var centro = centroideDe(pts);
    var grafo = grafoDeVias(vias);
    var minutos = [5, 10, 15];
    var tope = minutos[minutos.length - 1] * PASO_M_POR_MIN;
    var r = caminarDesde(grafo, centro, tope);
    if (!r) return { sinVias: true };
    if (r.lejos) return { lejos: true, distanciaAlaCalleM: r.distanciaAlaCalleM };

    var pois = (S.resultado && S.resultado.pois) || [];
    var anillos = minutos.map(function (min) {
      var metros = min * PASO_M_POR_MIN;
      // Los nodos que se alcanzan en ese tiempo.
      var alcanzados = [];
      Object.keys(r.dist).forEach(function (k) {
        if (r.dist[k] <= metros) alcanzados.push(grafo.nodos[k]);
      });
      /* Un uso se considera alcanzado si está a menos de 40 m de un punto de
         calle al que se llega a tiempo: es la distancia de la puerta a la
         calzada, incluyendo el antejardín y el andén. */
      var conta = 0, ejemplos = [];
      pois.forEach(function (p) {
        for (var i = 0; i < alcanzados.length; i++) {
          if (haversineM({ lat: p.lat, lng: p.lng }, alcanzados[i]) <= 40) {
            conta++;
            if (ejemplos.length < 5 && p.nombre) ejemplos.push(p.nombre);
            return;
          }
        }
      });
      // Y en línea recta, para poder poner las dos cifras una al lado de otra.
      var recta = pois.filter(function (p) {
        return haversineM(centro, { lat: p.lat, lng: p.lng }) <= metros;
      }).length;
      return { minutos: min, metros: metros, nodos: alcanzados.length,
               usos: conta, usosRecta: recta, ejemplos: ejemplos };
    });

    /* Los tramos que se recorren, para poder pintarlos. Un tramo pertenece al
       anillo del minuto en que se alcanza su extremo MÁS LEJANO: si para
       llegar al final de la cuadra hacen falta doce minutos, esa cuadra no es
       de cinco aunque empiece cerca. */
    var tramos = [];
    Object.keys(grafo.ady).forEach(function (ka) {
      var da = r.dist[ka];
      if (da === undefined) return;
      grafo.ady[ka].forEach(function (v) {
        // Cada arista está dos veces (ida y vuelta): se toma una sola.
        if (ka >= v.a) return;
        var db = r.dist[v.a];
        if (db === undefined) return;
        var lejos = Math.max(da, db);
        var min = null;
        for (var i = 0; i < minutos.length; i++) {
          if (lejos <= minutos[i] * PASO_M_POR_MIN) { min = minutos[i]; break; }
        }
        if (min === null || tramos.length >= 4000) return;
        tramos.push({ a: grafo.nodos[ka], b: grafo.nodos[v.a], min: min });
      });
    });

    return {
      anillos: anillos, distanciaAlaCalleM: r.distanciaAlaCalleM,
      pasoMPorMin: PASO_M_POR_MIN,
      nodosTotales: Object.keys(grafo.nodos).length,
      tramos: tramos
    };
  }

  /* La caminata se calcula una sola vez y se guarda. Recorrer veinte mil
     tramos en cada repintado de la hoja —y la hoja se repinta con cada toque—
     dejaría el teléfono pensando por nada: ni el lote ni las calles cambian
     entre un repintado y el siguiente. */
  function recalcularCaminata() {
    try { S.caminata = caminataDesdeLote(); } catch (e) { S.caminata = null; }
  }


  /* El recorrido, sobre el mapa. Es lo que convierte una tabla en un
     argumento: se ve la mancha de lo que se alcanza a pie y se ve dónde se
     corta. Tres colores, del más cercano al más lejano. */
  var capaCaminata = null;
  var COLOR_CAMINATA = { 5: '#0A6F9E', 10: '#34CCFE', 15: '#B8DFF2' };

  function pintarCaminata(encender) {
    var m = mapa();
    if (!m || typeof L === 'undefined') return false;
    if (capaCaminata) { try { m.removeLayer(capaCaminata); } catch (e) {} capaCaminata = null; }
    S.caminataEnMapa = false;
    if (!encender) return false;
    var c = S.caminata;
    if (!c || !c.tramos || !c.tramos.length) return false;

    capaCaminata = L.layerGroup();
    /* De más lejano a más cercano, para que el color del anillo corto quede
       ENCIMA: si se pintan al revés, el celeste claro de los quince minutos
       tapa el azul de los cinco y la mancha se lee al revés de como es. */
    [15, 10, 5].forEach(function (min) {
      c.tramos.forEach(function (t) {
        if (t.min !== min) return;
        try {
          L.polyline([[t.a.lat, t.a.lng], [t.b.lat, t.b.lng]], {
            color: COLOR_CAMINATA[min] || '#34CCFE',
            weight: min === 5 ? 6 : min === 10 ? 5 : 4,
            opacity: 0.9, lineCap: 'round', interactive: false,
            className: 'pcr-caminata-trazo'
          }).addTo(capaCaminata);
        } catch (e) {}
      });
    });
    capaCaminata.addTo(m);
    S.caminataEnMapa = true;
    return true;
  }

  /* `guardada` llega desde una ficha reabierta: ahí el recorrido es una copia
     sin tramos —pintarlo en el mapa pediría una geometría que no se guardó— y
     el botón sobra. */
  /* Las curvas sobre el mapa. Marrón, como en cualquier plancha de
     topografía, y las que caen en cota redonda —cada quinta— más gruesas y
     rotuladas: es lo que permite leer una ladera sin contar curvas una por
     una. */
  /* ── Las líneas de corte sobre el plano ───────────────────────────────
     Un perfil topográfico sin su A–A′ marcada en planta no se puede situar:
     se ve una silueta y no se sabe de dónde salió. Es la mitad de la
     convención de cualquier lámina de topografía, y faltaba. Llegó reportado
     así: «me hizo un corte pero no muestra las líneas por dónde lo hizo».

     El motor ya dice por dónde cortó —la traza entera, no solo los extremos,
     porque el corte va por una fila de la rejilla y sobre el terreno eso no
     es exactamente una recta—. Acá se dibuja como se dibuja en una lámina:
     línea fina de trazos, y la letra en cada punta.

     Las letras van en un `divIcon` y no en un `tooltip`: un tooltip se
     esconde al tocar cualquier otra cosa, y estas letras son parte del
     dibujo, no un aviso. */
  /* ── Cortar por donde uno diga ────────────────────────────────────────
     Los dos cortes del motor van por el medio del rectángulo. Un proyecto no
     se corta por ahí: se corta por la ladera que se va a aterrazar, por el
     eje de la calle a la que da el lote, por la quebrada. Así que se marcan
     dos puntos en el mapa y sale el corte, con la letra que le toque —C, D,
     E— y el mismo dibujo que los otros dos.

     Lo calcula el teléfono con la rejilla de cotas que la ficha ya guarda:
     ni una consulta de red, y funciona parado en el terreno sin señal, que
     es cuando hace falta. */
  var clickCorte = null;

  function iniciarCorte() {
    var K = window.URBIS_CORTES;
    if (!K) { S.corteAviso = 'Falta el módulo de cortes. Recargá la app.'; pintar(); return; }
    if (!S.terRejilla) {
      S.corteAviso = 'Primero medí el terreno: los cortes se sacan de sus cotas.';
      pintar(); return;
    }
    var m = mapa();
    if (!m) { S.corteAviso = 'El mapa todavía no está listo.'; pintar(); return; }
    soltarOtrosLapices('corte');
    S.cortePts = []; S.corteDibujando = true; S.corteAviso = '';
    S.encogida = true; S.encogidaAMano = false;
    if (!clickCorte) {
      clickCorte = function (ev) {
        if (!S.corteDibujando || !ev || !ev.latlng) return;
        agregarPuntoCorte(ev.latlng.lat, ev.latlng.lng);
      };
    }
    try { m.on('click', clickCorte); } catch (e) {}
    try { m.getContainer().style.cursor = 'crosshair'; } catch (e) {}
    pintar(); pintarBarraCorte();
  }

  function agregarPuntoCorte(lat, lng) {
    if (!S.corteDibujando) return;
    var pts = S.cortePts || (S.cortePts = []);
    pts.push({ lat: lat, lng: lng });
    if (pts.length >= 2) { cerrarCorte(); return; }
    pintar(); pintarBarraCorte();
  }

  function cerrarCorte() {
    var K = window.URBIS_CORTES;
    var pts = S.cortePts || [];
    if (!K || pts.length < 2) { S.corteAviso = 'Un corte necesita dos puntos.'; pintarBarraCorte(); return; }
    var ter = S.terreno;
    var previos = (ter && ter.perfiles) || [];
    /* La cota la pone la aplicación con SU `cotaEn`, el mismo que dibuja las
       curvas de nivel. El módulo del corte solo recorre la línea. */
    var nuevo = K.corteNuevo(function (lat, lng) {
      return cotaEn({ lat: lat, lng: lng });
    }, pts[0], pts[1], previos, {
      dentro: function (c) { return puntoDentroDelSector(c); }
    });
    soltarCorte();
    if (!nuevo) {
      /* Dos causas y las dos se dicen: o los dos toques cayeron casi encima,
         o el corte se salió de donde hay cotas. Un «no se pudo» a secas
         obliga a adivinar cuál de las dos fue. */
      S.corteAviso = 'No salió el corte: o los dos puntos quedaron muy juntos, o la línea ' +
        'se sale del área donde se midieron las cotas.';
      pintar(); return;
    }
    if (!ter) { S.corteAviso = 'Primero medí el terreno.'; pintar(); return; }
    ter.perfiles = previos.concat([nuevo]);
    S.corteAviso = '';
    S.aviso = 'Corte ' + nuevo.marca + '–' + nuevo.marcaFin + ' hecho, de ' +
      nuevo.largoM + ' m.';
    guardarFichaViva();
    // Si las líneas ya estaban puestas, se repintan con la nueva adentro.
    if (S.cortesEnMapa) pintarCortes(true);
    pintar();
  }

  function cancelarCorte() {
    S.cortePts = null; S.corteDibujando = false; S.corteAviso = '';
    soltarCorte();
    pintar(); pintarBarraCorte();
  }

  function soltarCorte() {
    S.corteDibujando = false; S.cortePts = null;
    var m = mapa();
    if (m && clickCorte) { try { m.off('click', clickCorte); } catch (e) {} }
    try { if (m) m.getContainer().style.cursor = ''; } catch (e) {}
    pintarBarraCorte();
  }

  function borrarCorte(id) {
    var ter = S.terreno;
    if (!ter || !ter.perfiles) return;
    ter.perfiles = ter.perfiles.filter(function (p) { return !(p.aMano && p.id === id); });
    guardarFichaViva();
    if (S.cortesEnMapa) pintarCortes(true);
    pintar();
  }

  /* Dentro del sector, para marcar qué tramo del corte está en lo analizado.
     Es la misma pregunta que se hace el motor con sus dos cortes. */
  function puntoDentroDelSector(c) {
    var meta = (S.resultado && S.resultado.meta) || {};
    var A = window.URBIS_PC_ANALISIS;
    if (meta.forma === 'poligono' && meta.poligono && meta.poligono.length >= 3 &&
        A && typeof A.dentroDelPoligono === 'function') {
      try { return A.dentroDelPoligono(c.lat, c.lng, meta.poligono); } catch (e) {}
    }
    var eje = centroDeAnalisis();
    if (!eje) return true;
    return metrosEntreDos(eje, c) <= (S.radioM || 500);
  }
  function metrosEntreDos(a, b) {
    var dLat = (b.lat - a.lat) * 110540;
    var dLng = (b.lng - a.lng) * 111320 * Math.cos(a.lat * Math.PI / 180);
    return Math.hypot(dLat, dLng);
  }

  /* La barra de abajo mientras se marca, igual que la del lote: los botones
     donde el pulgar ya está y no dentro de un panel que hay que abrir. */
  function pintarBarraCorte() {
    var el = document.getElementById('pcr-corte-barra');
    if (!S.corteDibujando) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'pcr-corte-barra';
      el.className = 'pcr-lote-barra';
      document.body.appendChild(el);
      el.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-corte]');
        if (b && b.getAttribute('data-corte') === 'cancelar') cancelarCorte();
      });
    }
    var n = (S.cortePts || []).length;
    el.innerHTML =
      '<div class="pcr-lote-t">' +
        (n === 0 ? 'Tocá dónde EMPIEZA el corte'
                 : 'Ahora tocá dónde TERMINA') +
      '</div>' +
      '<div class="pcr-lote-b">' +
        '<button type="button" data-corte="cancelar">' + ico('cerrar', 16) + 'Cancelar</button>' +
      '</div>' +
      (S.corteAviso ? '<div class="pcr-lote-aviso">' + esc(S.corteAviso) + '</div>' : '');
  }

  function pintarCortes(encender) {
    var m = mapa();
    if (!m || typeof L === 'undefined') return false;
    if (capaCortes) { try { m.removeLayer(capaCortes); } catch (e) {} capaCortes = null; }
    S.cortesEnMapa = false;
    if (!encender) return false;
    var ter = S.terreno;
    var perfiles = (ter && ter.perfiles) || [];
    var conTraza = perfiles.filter(function (p) { return p.traza && p.traza.length >= 2; });
    if (!conTraza.length) return false;

    capaCortes = L.layerGroup();
    conTraza.forEach(function (p) {
      var pts = p.traza.map(function (q) { return [q.lat, q.lng]; });
      try {
        // Dos trazos: uno blanco grueso debajo para que la línea se lea
        // sobre la foto satelital, que es donde peor se ven las líneas finas.
        L.polyline(pts, { color: '#fff', weight: 4, opacity: .85,
          dashArray: '9 7', interactive: false }).addTo(capaCortes);
        L.polyline(pts, { color: '#12202e', weight: 1.8, opacity: .95,
          dashArray: '9 7', interactive: false }).addTo(capaCortes);
      } catch (e) {}
      [[pts[0], p.marca || p.id.charAt(0)],
       [pts[pts.length - 1], p.marcaFin || (p.id.charAt(0) + '′')]].forEach(function (par) {
        try {
          L.marker(par[0], { interactive: false, keyboard: false,
            icon: L.divIcon({ className: 'pcr-corte-letra-root',
              html: '<span class="pcr-corte-letra">' + esc(par[1]) + '</span>',
              iconSize: [26, 26], iconAnchor: [13, 13] })
          }).addTo(capaCortes);
        } catch (e) {}
      });
    });
    capaCortes.addTo(m);
    S.cortesEnMapa = true;
    return true;
  }

  function pintarCurvas(encender) {
    var m = mapa();
    if (!m || typeof L === 'undefined') return false;
    if (capaCurvas) { try { m.removeLayer(capaCurvas); } catch (e) {} capaCurvas = null; }
    S.curvasEnMapa = false;
    if (!encender) return false;
    var cv = S.curvas || (S.curvas = curvasDelTerreno());
    if (!cv || !cv.curvas || !cv.curvas.length) return false;

    capaCurvas = L.layerGroup();
    cv.curvas.forEach(function (c) {
      var maestra = (c.z % (cv.intervalo * 5)) === 0;
      c.lineas.forEach(function (linea) {
        if (linea.length < 2) return;
        try {
          var pl = L.polyline(linea.map(function (p) { return [p.lat, p.lng]; }), {
            color: maestra ? '#8A5A20' : '#B08050',
            weight: maestra ? 2.4 : 1.4, opacity: 0.95, interactive: !!maestra
          }).addTo(capaCurvas);
          if (maestra) pl.bindTooltip(c.z + ' msnm', { sticky: true });
        } catch (e) {}
      });
    });
    capaCurvas.addTo(m);
    S.curvasEnMapa = true;
    return true;
  }

  /* ── La jerarquía vial sobre el mapa ──────────────────────────────────
     El recuadro del pliego existía desde v732 y la capa no: era la única de
     las siete que estaba en el papel y no se podía encender sobre el mapa,
     que es donde se comprueba si el dibujo dice la verdad del sitio. Ahora
     están las dos, y las dos leen la misma tabla —`JERARQUIA_VIAL`—, así que
     no pueden pintar de colores distintos.

     De menor a mayor jerarquía, para que las troncales queden encima: al
     revés, cien calles locales tapan la avenida. */
  function pintarVias(encender) {
    var m = mapa();
    if (!m || typeof L === 'undefined') return false;
    if (capaVias) { try { m.removeLayer(capaVias); } catch (e) {} capaVias = null; }
    S.viasEnMapa = false;
    if (!encender) return false;
    var vias = S.trzVias || [];
    if (!vias.length) return false;
    capaVias = L.layerGroup();
    JERARQUIA_VIAL.slice().reverse().forEach(function (j) {
      vias.forEach(function (v) {
        if (jerarquiaVialDe(v.clase) !== j || !v.pts || v.pts.length < 2) return;
        try {
          L.polyline(v.pts.map(function (p) { return [p.lat, p.lng]; }), {
            color: j.color, weight: j.ancho * 1.7, opacity: 0.9, interactive: true
          }).addTo(capaVias)
            .bindTooltip((v.nombre || 'sin nombre') + ' · ' + j.etq.toLowerCase(), { sticky: true });
        } catch (e) {}
      });
    });
    capaVias.addTo(m);
    S.viasEnMapa = true;
    return true;
  }

  /* Las sombras sobre el mapa. Las tres horas a la vez, translúcidas: donde
     se cruzan, el mapa se oscurece solo. */
  function pintarSombras(encender) {
    var m = mapa();
    if (!m || typeof L === 'undefined') return false;
    if (capaSombras) { try { m.removeLayer(capaSombras); } catch (e) {} capaSombras = null; }
    S.sombrasEnMapa = false;
    if (!encender) return false;
    var so = S.sombras || (S.sombras = (function () {
      try { return sombrasDelLote(); } catch (e) { return null; }
    })());
    if (!so || !so.horas || !so.horas.length) return false;

    var TINTE = { 9: '#F2B441', 12: '#7C4DFF', 15: '#0A6F9E' };
    capaSombras = L.layerGroup();
    var puso = false;
    so.horas.forEach(function (h) {
      (h.sombras || []).forEach(function (poli) {
        try {
          L.polygon(poli.map(function (p) { return [p.lat, p.lng]; }), {
            color: TINTE[h.hora] || '#0F1F2E', weight: 1, opacity: 0.6,
            fillColor: TINTE[h.hora] || '#0F1F2E', fillOpacity: 0.22, interactive: false
          }).addTo(capaSombras);
          puso = true;
        } catch (e) {}
      });
    });
    if (!puso) return false;
    capaSombras.addTo(m);
    S.sombrasEnMapa = true;
    return true;
  }

  /* ── Lo intangible, en la ficha ────────────────────────────────────────
     Es el único bloque de la hoja que no se llena solo. Todos los demás
     salen de una consulta o de una cuenta; este sale de que alguien haya
     caminado. Por eso, vacío, no dice «sin datos»: dice qué preguntas hay
     que llevarse a la calle. */
  function bloqueIntangible(marcas, guardada, ctx) {
    var I = IN();
    if (!I) return '';
    var ms = (marcas !== undefined && marcas !== null ? marcas : (S.intangible || []))
      .filter(I.valida);
    var an = analisisIntangible(ms, ctx);
    var cab = h4('ojo', 'Lo intangible');
    var lapices = guardada ? '' :
      '<div class="pcr-int-lapices">' +
        I.TIPOS.map(function (t) {
          return '<button type="button" class="pcr-int-lapiz" data-pcr="int-dibujar" ' +
            'data-t="' + esc(t.id) + '" title="' + esc(t.pregunta) + '">' +
            '<i style="background:' + esc(t.color) + '">' + t.ico + '</i>' +
            '<span><b>' + esc(t.nombre) + '</b>' +
              '<small>' + (t.geom === 'zona' ? 'zona' : t.geom === 'linea' ? 'línea' : 'un sitio') +
            '</small></span></button>';
        }).join('') +
      '</div>';

    if (!ms.length) {
      return cab +
        '<p class="pcr-pista">Todo lo que hay más arriba se bajó de algún lado. Esto no: <b>solo lo ' +
        'tiene quien caminó</b>. Dónde no pasarías de noche, qué esquina queda a oscuras, dónde ' +
        'huele mal, dónde te quedarías un rato. Nada de eso está en ningún mapa, y es la mitad de ' +
        'lo que decide un proyecto.</p>' +
        (guardada ? '<p class="pcr-pista">Esta ficha se guardó sin marcas.</p>' : lapices) +
        '<p class="pcr-conc">Elegí un lápiz y tocá el mapa. Se puede hacer sentado mirando la foto, ' +
        'pero sirve de verdad recorriendo: son las preguntas que uno se hace caminando.</p>';
    }

    var puestas = S.intEnMapa;
    return cab +
      '<p class="pcr-pista">' + an.total + ' marca' + (an.total === 1 ? '' : 's') +
        ' de lo que no se puede medir' +
        (an.pctSector != null && an.pctSector > 0
          ? ', sobre <b>' + an.pctSector + '%</b> de la superficie del sector' : '') + '.</p>' +
      '<div class="pcr-int-cuenta">' +
        an.porTipo.map(function (t) {
          return '<div class="pcr-int-c" style="border-color:' + esc(t.color) + '">' +
            '<b>' + t.n + '</b><small>' + esc(t.nombre) + '</small>' +
            '<em>' + (t.geom === 'linea' ? t.metros + ' m'
                    : t.geom === 'punto' ? 'sitios'
                    : formatearM2(t.m2)) + '</em></div>';
        }).join('') +
      '</div>' +
      // Lo que le toca al lote. Es la única parte de esto que cambia una
      // decisión de proyecto, así que va antes que la lista.
      (an.lote && (an.lote.dentroDe.length || an.lote.cerca.length)
        ? '<p class="pcr-lab">El lote</p>' +
          (an.lote.dentroDe.length
            ? '<p class="pcr-conc">El lote cae <b>dentro</b> de ' +
              an.lote.dentroDe.map(function (x) {
                return '<span class="pcr-int-et" style="background:' + esc(x.color) + '">' +
                  esc(x.nombre) + '</span>'; }).join(' ') +
              '. Eso no se resuelve con la implantación: es un problema del proyecto entero.</p>'
            : '') +
          (an.lote.cerca.length
            ? '<p class="pcr-pista">Cerca, sin tocarlo: ' +
              an.lote.cerca.map(function (x) {
                return esc(x.nombre) + ' a ' + x.m + ' m'; }).join(' · ') + '.</p>'
            : '')
        : '') +
      // Los desacuerdos: donde la percepción y el conteo dicen cosas
      // distintas. Es lo más útil que sale de todo el ejercicio.
      (an.desacuerdos.length
        ? '<p class="pcr-lab">Donde no coinciden con lo medido</p>' +
          an.desacuerdos.map(function (d) {
            return '<p class="pcr-conc pcr-int-des">' + esc(d.texto) + '</p>';
          }).join('')
        : '') +
      '<p class="pcr-lab">Las marcas</p>' +
      '<div class="pcr-int-lista">' +
        ms.map(function (m) {
          var t = I.tipo(m.tipo) || { nombre: m.tipo, color: '#999' };
          var tam = m.geom === 'zona' ? formatearM2(Math.round(I.areaM2(m.pts)))
                  : m.geom === 'linea' ? Math.round(I.largoM(m.pts)) + ' m' : 'un sitio';
          return '<div class="pcr-int-item">' +
            '<i style="background:' + esc(t.color) + '"></i>' +
            '<div class="pcr-int-tx"><b>' + esc(t.nombre) + '</b>' +
              '<small>' + esc(tam) + '</small>' +
              (guardada
                ? (m.nota ? '<q>' + esc(m.nota) + '</q>' : '')
                : '<input type="text" class="pcr-int-nota" data-pcr-nota="' + esc(m.id) + '" ' +
                  'value="' + esc(m.nota || '') + '" maxlength="220" ' +
                  'placeholder="Por qué, en tus palabras" />') +
            '</div>' +
            (guardada ? '' :
              '<button type="button" class="pcr-int-x" data-pcr="int-borrar" data-m="' +
                esc(m.id) + '" aria-label="Borrar esta marca">' + ico('borrar', 15) + '</button>') +
          '</div>';
        }).join('') +
      '</div>' +
      (guardada ? '' :
        lapices +
        '<div class="pcr-llevar">' +
          '<button type="button" data-pcr="int-mapa" class="pcr-mini">' +
            ico(puestas ? 'apagar' : 'ojo', 16) +
            (puestas ? 'Quitar del mapa' : 'Ver en el mapa') + '</button>' +
          '<button type="button" data-pcr="int-texto" class="pcr-mini">' +
            ico('copiar', 16) + 'Copiar el testimonio</button>' +
        '</div>') +
      an.avisos.map(function (a) {
        return '<p class="pcr-pista pcr-int-aviso">' + esc(a) + '</p>';
      }).join('') +
      bloqueCursoIntangible(guardada);
  }

  /* ── Juntar los recorridos del curso ─────────────────────────────────── */
  /* ── Qué cabe en el lote ───────────────────────────────────────────────
     El puente que le faltaba al módulo: hasta acá todo mide el sitio, y esto
     es el primer paso del otro lado. */
  function ctxQueCabe() {
    var st = (S.resultado && S.resultado.stats) || {};
    var trz = S.trazado || {};
    var esp = trz.espacio;
    var hab = Number(st.poblacionEstimada || 0);
    var so = null;
    try { so = sombrasDelLote(); } catch (e) {}
    var tarde = so && so.horas ? so.horas.filter(function (h) { return h.hora === 15; })[0] : null;
    return {
      pendientePct: (S.terreno && S.terreno.pendiente && S.terreno.pendiente.media != null)
        ? Number(S.terreno.pendiente.media) : null,
      sombraPct: tarde ? tarde.pctLote : null,
      amenazaAlta: !!(S.amenaza && /alta/i.test(S.amenaza.nivel || '')),
      m2PublicoPorHab: (esp && esp.areaM2 && hab > 0)
        ? Math.round(10 * esp.areaM2 / hab) / 10 : null,
      usosCerca: (S.caminata && S.caminata.anillos && S.caminata.anillos.length)
        ? S.caminata.anillos[Math.min(1, S.caminata.anillos.length - 1)].usos : null,
      personasPorVivienda: st.personasPorVivienda != null
        ? Number(st.personasPorVivienda) : null
    };
  }

  /* La lista para la ventanilla. Existe porque el POT de Cúcuta no está
     publicado como servicio en ningún servidor del Estado —se revisaron el
     SGC, el IDEAM, el IGAC, la UPRA y la ANLA— y no va a estarlo por ahora.
     Así que el estudiante va a Planeación, y presentarse sin saber qué pedir
     es volver con las manos vacías: en un mostrador, «necesito los datos del
     POT» no es una pregunta que alguien pueda contestar, y «la ficha
     normativa del predio tal» sí. */
  function bloquePedido() {
    var Q = window.URBIS_QUE_CABE;
    if (!Q || !Q.PEDIDO) return '';
    return '<p class="pcr-lab">Lo que hay que ir a buscar</p>' +
      '<p class="pcr-pista">Estos números no están en ningún servicio web: hay que pedirlos. ' +
      'Con lo de los dos primeros puntos se llenan las casillas de arriba y la cuenta deja de ' +
      'ser un ejemplo.</p>' +
      '<div class="pcr-lote">' +
        Q.PEDIDO.map(function (p, i) {
          return '<div class="pcr-pedido">' +
            '<b>' + (i + 1) + '. ' + esc(p.que) + '</b>' +
            '<span class="pcr-pedido-d">' + esc(p.donde) + '</span>' +
            '<em>' + esc(p.trae) + '</em>' +
            '<em class="pcr-pedido-c">' + esc(p.con) + '</em>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div class="pcr-llevar">' +
        '<button type="button" data-pcr="pedido-texto" class="pcr-mini">' +
          ico('copiar', 16) + 'Copiar la lista para llevarla</button>' +
      '</div>';
  }

  /* De dónde salieron los índices, escrito por quien fue a buscarlos.

     La lista de mandados ya dice a quién pedir cada cosa —Planeación
     Municipal, el POMCA del Pamplonita, la microzonificación si existe—. Lo
     que faltaba era lo de después: una vez traído el número, que quede
     anotado de qué documento salió y de qué año es.

     Sin eso, dentro de tres meses la ficha muestra un índice de ocupación con
     la misma cara con la que muestra la pendiente del terreno, que sí se
     midió. Es exactamente el error que ya se corrigió dos veces en este
     módulo, y el que más caro sale: no se nota mirando la ficha, se nota
     cuando alguien defiende una lámina con un número que nadie puede
     rastrear. */
  function bloqueFuenteIndices(guardada) {
    var f = S.indicesFuente || {};
    var hay = !!(f.documento || f.fecha || f.tratamiento);
    if (guardada) {
      return hay
        ? '<p class="pcr-conc pcr-fuente-ok">Los índices salieron de <b>' + esc(f.documento || 'sin documento anotado') +
          '</b>' + (f.fecha ? ', de ' + esc(f.fecha) : '') +
          (f.tratamiento ? ', para el tratamiento <b>' + esc(f.tratamiento) + '</b>' : '') + '.</p>'
        : '<p class="pcr-conc pcr-ojo">Estos índices se escribieron a mano y <b>nadie anotó de ' +
          'dónde salieron</b>. No se pueden citar en una entrega sin volver a buscar la fuente.</p>';
    }
    return '<div class="pcr-cabe-fuente">' +
      '<p class="pcr-lab">De dónde los sacaste</p>' +
      '<label class="pcr-campo-linea">' +
        '<span>Documento</span>' +
        '<input type="text" maxlength="120" data-pcr-fuente="documento" ' +
          'placeholder="Acuerdo 0089 · Planeación Municipal" ' +
          'value="' + esc(f.documento || '') + '" />' +
      '</label>' +
      '<label class="pcr-campo-linea">' +
        '<span>De qué año</span>' +
        '<input type="text" maxlength="40" data-pcr-fuente="fecha" ' +
          'placeholder="2011, revisado en 2019" ' +
          'value="' + esc(f.fecha || '') + '" />' +
      '</label>' +
      /* El tratamiento urbanístico. Es lo que decide QUÉ índices aplican, así
         que sin él los tres números de arriba no se pueden verificar: dos
         predios de la misma manzana con tratamientos distintos tienen normas
         distintas. Anotarlo cuesta una línea y es lo primero que pregunta
         quien revisa. */
      '<label class="pcr-campo-linea">' +
        '<span>Tratamiento</span>' +
        '<input type="text" maxlength="80" data-pcr-fuente="tratamiento" ' +
          'placeholder="Consolidación · Desarrollo · Renovación…" ' +
          'value="' + esc(f.tratamiento || '') + '" />' +
      '</label>' +
      (hay
        ? '<p class="pcr-pista">Queda escrito con la ficha y sale en la lámina: es lo que hace ' +
          'citable el número.</p>'
        : '<p class="pcr-pista">Dos líneas ahora te ahorran volver a la ventanilla dentro de tres ' +
          'meses, cuando nadie se acuerde de qué acuerdo era.</p>') +
    '</div>';
  }

  /* La cuadra, en la ficha. Va entre el lote y «qué cabe»: es el orden en que
     se proyecta —dónde estoy, qué hay al lado, qué puedo poner—. */
  function bloqueCuadra() {
    var cu = null;
    try { cu = laCuadraDelLote(); } catch (e) {}
    if (!cu) return '';
    return h4('via', 'La cuadra del lote') +
      '<p class="pcr-pista">Ni el sector ni el lote: <b>el frente</b> al que va a dar el ' +
      'proyecto. Son ' + cu.largoM + ' m de <b>' + esc(cu.via || 'la calle sin nombre') +
      '</b> con todo lo que se asoma a menos de treinta metros.</p>' +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + cu.pctLleno + '%</b><small>del frente con fachada</small></div>' +
        '<div class="pcr-kpi"><b>' + cu.edificios + '</b><small>edificios dan al frente</small></div>' +
        (cu.frenteTipicoM != null
          ? '<div class="pcr-kpi"><b>' + cu.frenteTipicoM + '</b><small>m de frente típico</small></div>'
          : '') +
      '</div>' +
      '<div class="pcr-lote">' +
        '<div class="pcr-lote-fila"><span>Fachada construida</span><b>' + cu.llenoM + ' m</b></div>' +
        '<div class="pcr-lote-fila"><span>Huecos</span><b>' + cu.huecos +
          (cu.mayorHuecoM ? ' · el mayor de ' + cu.mayorHuecoM + ' m' : '') + '</b></div>' +
        (cu.esquinas.length
          ? '<div class="pcr-lote-fila"><span>Esquinas en el tramo</span><b>' +
            esc(cu.esquinas.map(function (e) { return e.nombre || 'sin nombre'; }).join(', ')) +
            '</b></div>'
          : '') +
        (cu.usos.length
          ? '<div class="pcr-lote-fila"><span>Usos que se asoman</span><b>' +
            esc(cu.usos.slice(0, 3).map(function (u) { return u.nombre + ' ' + u.n; }).join(' · ')) +
            '</b></div>'
          : '') +
      '</div>' +
      '<p class="pcr-conc">' + (cu.continua
        ? 'Frente continuo: la fachada acompaña la calle, y un proyecto que se retire rompe algo que funciona.'
        : cu.rota
          ? 'Frente roto: más de la mitad del tramo está vacío. Acá un proyecto no continúa una fachada, la empieza.'
          : 'Frente a medias: hay fachada y hay huecos. Lo que decide es dónde caen, no el promedio.') +
      (cu.mayorHuecoM >= 25
        ? ' El hueco mayor es de ' + cu.mayorHuecoM + ' m: eso no es un retiro, es un lote sin construir.'
        : '') + '</p>' +
      '<p class="pcr-pista">NO es catastro: cuenta <b>edificios</b>, que es lo que OpenStreetMap ' +
      'registra, no predios. Dos casas pareadas con una sola huella cuentan como una, y el frente ' +
      'típico es la mediana —una bodega entre veinte casas mueve el promedio y no la mediana—.</p>';
  }

  function bloqueQueCabe(guardada) {
    var Q = window.URBIS_QUE_CABE;
    var la = null;
    try { la = analisisDelLote(); } catch (e) {}
    if (!Q) return '';
    if (!la) {
      if (guardada) return '';
      return h4('crecer', 'Qué cabe en el lote') +
        '<p class="pcr-pista">Hasta acá todo mide el sitio. Esto es el primer paso del otro ' +
        'lado: cuánto se puede construir ahí y cuánta gente cabe. <b>Marcá el lote</b> y se ' +
        'llena.</p>';
    }
    var idx = S.indices || (S.indices = Q.porDefecto());
    var q = Q.calcular(la, idx, ctxQueCabe(), S.indicesPuestos);
    if (!q) return '';

    var puestos = S.indicesPuestos || {};
    var campos = Q.CAMPOS.map(function (c) {
      var confirmado = !!puestos[c.id];
      var delProyecto = c.deQuien === 'proyecto';
      return '<label class="pcr-cabe-c' + (confirmado || delProyecto ? '' : ' pcr-cabe-ej') + '">' +
        '<span><b>' + esc(c.nombre) + '</b><small>' + esc(c.unidad) +
          (delProyecto ? '' : (confirmado ? ' · del POT' : ' · ejemplo')) + '</small></span>' +
        '<input type="number" step="any" min="0" data-pcr-idx="' + esc(c.id) + '" ' +
          'value="' + esc(String(idx[c.id])) + '"' + (guardada ? ' disabled' : '') + ' />' +
        '<em>' + esc(c.ayuda) + '</em>' +
      '</label>';
    }).join('');

    return h4('crecer', 'Qué cabe en el lote') +
      /* La advertencia va PRIMERO y no al pie. Es la diferencia entre una
         herramienta útil y una peligrosa, y al pie no la lee nadie. */
      /* Clase propia y no `pcr-cabe-no`: esa es la del «no cabe en el pliego»
         y compartirla hacía dos cosas malas a la vez —pintaba esta
         advertencia como un error de encaje, y la prueba de si el pliego cabe
         la encontraba a ella en vez de a su resultado—. */
      '<p class="pcr-conc pcr-ojo"><b>Estos índices los ponés vos.</b> Salen del POT del ' +
      'municipio y URBIS no los conoce ni los verifica: acá solo se hace la cuenta con lo que ' +
      'escribas. Si están mal, el resultado sale mal con la misma cara de seguridad. Buscarlos ' +
      'es parte del ejercicio.</p>' +
      (guardada ? '' : '<div class="pcr-cabe-campos">' + campos + '</div>') +
      bloqueFuenteIndices(guardada) +
      /* La banda va PEGADA a las cifras, no arriba del todo. La advertencia de
         más arriba dice de dónde salen los índices; esta dice si ESTAS cifras
         son de este lote o de un ejemplo. Un estudiante que baja hasta los
         números grandes ya se olvidó del párrafo de arriba, y los números
         grandes es lo que copia. */
      (q.deEjemplo
        ? '<p class="pcr-conc pcr-ojo"><b>Cuenta de ejemplo.</b> ' +
          (q.confirmados ? q.faltan.length + ' de los ' + q.delPot + ' índices siguen siendo ' +
            'los que trae URBIS' : 'Ningún índice se ha cambiado todavía') +
          ', así que lo de abajo <b>no es de este lote</b>: es lo que daría un lote de este ' +
          'tamaño con unos números cualesquiera. Sirve para ver cómo funciona; no sirve para ' +
          'una entrega.</p>'
        : '<p class="pcr-conc">Los ' + q.delPot + ' índices vienen de la ficha normativa, ' +
          'así que esta cuenta es de <b>este</b> lote.</p>') +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + q.huellaM2.toLocaleString('es-CO') +
          '</b><small>m² de huella</small></div>' +
        '<div class="pcr-kpi"><b>' + q.construibleM2.toLocaleString('es-CO') +
          '</b><small>m² construibles</small></div>' +
        '<div class="pcr-kpi"><b>' + String(q.pisosQueSalen).replace('.', ',') +
          '</b><small>pisos que salen</small></div>' +
      '</div>' +
      '<p class="pcr-conc">En un lote de <b>' + q.areaLoteM2.toLocaleString('es-CO') +
      ' m²</b> caben <b>' + q.viviendas + '</b> viviendas de ' + idx.m2Vivienda +
      ' m², o sea unas <b>' + q.personas + '</b> personas, contando ' +
      String(q.personasPorVivienda).replace('.', ',') + ' por vivienda' +
      (ctxQueCabe().personasPorVivienda != null ? ' —el dato del censo para este sector—' :
        ' —promedio, porque el censo no dio el dato acá—') + '.</p>' +
      (q.cruces.length
        ? '<p class="pcr-lab">Contra lo que se midió del sitio</p>' +
          q.cruces.map(function (c) {
            return '<p class="pcr-conc pcr-cabe-cruce">' + esc(c.texto) + '</p>';
          }).join('')
        : '<p class="pcr-pista">Todavía no hay con qué cruzarlo: medí el terreno, el trazado y ' +
          'la amenaza, y acá aparece qué le hace cada cosa a lo que cabe.</p>') +
      (guardada ? '' :
        '<div class="pcr-llevar">' +
          '<button type="button" data-pcr="cabe-texto" class="pcr-mini">' +
            ico('copiar', 16) + 'Copiar para la memoria</button>' +
          '<button type="button" data-pcr="cabe-reiniciar" class="pcr-mini">' +
            ico('deshacer', 16) + 'Volver a los valores de ejemplo</button>' +
        '</div>') +
      /* Lo que hay que ir a buscar. Aparece solo mientras falten índices: una
         vez que están puestos, esta lista es ruido debajo de un resultado
         bueno. */
      (guardada || !q.deEjemplo ? '' : bloquePedido()) +
      q.avisos.map(function (a) {
        return '<p class="pcr-pista pcr-int-aviso">' + esc(a) + '</p>';
      }).join('');
  }

  /* `guardada` = se está leyendo una ficha archivada, no la del sector vivo.

     Antes este bloque se omitía entero en ese caso, y el resultado era una
     pérdida aparente: la ficha llevaba los cuarenta recorridos del curso
     guardados desde v705 —se puede comprobar en el almacenamiento— y el
     informe no los mencionaba. Quien reabría un sector de la semana pasada
     veía sus propias marcas y ninguna de las demás, y concluía lo razonable:
     que no se habían guardado.

     Lo que se quita en ese caso son los botones, no la información: traer,
     compartir y quitar recorridos son cosas del sector que se está
     trabajando. Para eso está «Retomar». */
  function bloqueCursoIntangible(guardada) {
    var I = IN();
    if (!I) return '';
    var mios = (S.intangible || []).filter(I.valida);
    if (!mios.length && !(S.intCurso || []).length) return '';
    var u = S.intUnion;

    var cab = '<p class="pcr-lab">Juntarlo con el curso</p>';
    var explica = '<p class="pcr-pista">Un mapa de percepción de una persona es la opinión de ' +
      'una persona. De veinte que caminaron la misma manzana, ya es otra cosa. Esto junta ' +
      'recorridos por archivo —no por servidor— para que cada quien decida cuándo comparte el ' +
      'suyo, y para que funcione en un salón sin internet.</p>';

    var traer = guardada
      ? '<p class="pcr-pista">Es lo que quedó archivado con este sector. Para traer más ' +
        'recorridos o compartir el tuyo, retomá el sector desde la tarjeta de arriba.</p>'
      : '<div class="pcr-llevar">' +
        (mios.length
          ? '<button type="button" data-pcr="int-exportar" class="pcr-mini pcr-llevar-b">' +
            ico('compartir', 16) + 'Compartir mi recorrido</button>'
          : '') +
        '<button type="button" data-pcr="int-importar" class="pcr-mini">' +
          ico('carpeta', 16) + 'Traer los de otros</button>' +
        ((S.intCurso || []).length
          ? '<button type="button" data-pcr="int-curso-borrar" class="pcr-mini">' +
            ico('borrar', 16) + 'Quitar los traídos</button>'
          : '') +
      '</div>' +
      '<input type="file" id="pcr-int-archivo" accept=".json,application/json" multiple ' +
        'style="position:absolute;left:-9999px" />' +
      (S.intCursoAviso ? '<p class="pcr-error">' + esc(S.intCursoAviso) + '</p>' : '');

    if (!u || !u.hayAcuerdoPosible) {
      return cab + explica +
        ((S.intCurso || []).length
          ? ''
          : '<p class="pcr-conc">Todavía es un solo recorrido: el tuyo. Con uno no hay acuerdo ' +
            'posible, y creer que coincidís con vos mismo sería la peor lectura de todas.</p>') +
        traer;
    }

    return cab + explica +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + u.recorridos + '</b><small>recorridos</small></div>' +
        '<div class="pcr-kpi"><b>' + u.marcas + '</b><small>marcas en total</small></div>' +
        '<div class="pcr-kpi"><b>' + u.acuerdos.length + '</b><small>sitios donde coinciden</small></div>' +
      '</div>' +
      '<p class="pcr-pista">De: ' + esc(u.autores.join(', ')) + '.</p>' +
      (u.acuerdos.length
        ? '<p class="pcr-conc">En <b>' + u.acuerdos.length + '</b> sitios de ' + u.celdaM +
          ' m coincidieron dos o más personas que caminaron por separado. Ahí la percepción ' +
          'deja de ser de alguien y pasa a ser del barrio: es lo único de todo esto que se ' +
          'puede defender en una lámina.</p>' +
          '<div class="pcr-int-cuenta">' +
            u.porTipo.filter(function (t) { return t.acuerdo > 0; }).map(function (t) {
              return '<div class="pcr-int-c" style="border-color:' + esc(t.color) + '">' +
                '<b>' + t.acuerdo + '</b><small>' + esc(t.nombre) + '</small>' +
                '<em>hasta ' + t.maximo + ' personas</em></div>';
            }).join('') +
          '</div>'
        : '<p class="pcr-conc">Los ' + u.recorridos + ' recorridos no coinciden en ningún sitio. ' +
          'Eso también es un hallazgo: o cada quien caminó por otro lado, o lo que se percibe ' +
          'no es del barrio sino de quien lo mira. Vale la pena preguntarlo en clase.</p>') +
      '<div class="pcr-llevar">' +
        '<button type="button" data-pcr="int-acuerdos-mapa" class="pcr-mini">' +
          ico(S.intAcuerdosEnMapa ? 'apagar' : 'ojo', 16) +
          (S.intAcuerdosEnMapa ? 'Quitar del mapa' : 'Ver dónde coinciden') + '</button>' +
      '</div>' +
      traer;
  }

  function bloqueCaminata(dato, guardada) {
    var c = dato !== undefined && dato !== null ? dato : S.caminata;
    if (!guardada && (!S.lote || S.lote.length < 3)) return '';
    if (!c) return '';
    if (c.sinVias) {
      return h4('caminar', 'Hasta dónde se llega caminando') +
        '<p class="pcr-pista">Para caminar hace falta la forma de las calles: medí el <b>trazado del ' +
        'sector</b> y este bloque se llena solo. Sin las calles, lo único que se puede medir es la ' +
        'línea recta, que siempre miente a favor.</p>';
    }
    if (c.lejos) {
      return h4('caminar', 'Hasta dónde se llega caminando') +
        '<p class="pcr-conc">La calle registrada más cercana está a <b>' + c.distanciaAlaCalleM +
        ' m</b> del lote. Enganchar el recorrido a esa distancia sería inventar un camino que nadie ' +
        'hace: puede que el lote sea interior de manzana, o que la calle que lo bordea no esté ' +
        'mapeada. Mapearla es lo que falta.</p>';
    }
    var mayor = c.anillos[c.anillos.length - 1];
    return h4('caminar', 'Hasta dónde se llega caminando') +
      '<p class="pcr-pista">Esto no es línea recta: recorre las calles del sector desde el lote, con ' +
      'sus vueltas, a ' + c.pasoMPorMin + ' metros por minuto.</p>' +
      '<div class="pcr-niveles">' +
        c.anillos.map(function (a) {
          var pct = mayor.usos ? Math.round(100 * a.usos / mayor.usos) : 0;
          return '<div class="pcr-nivel">' +
            '<span class="pcr-nivel-nom">' + a.minutos + ' minutos' +
              '<small class="pcr-nivel-sub">' + a.metros + ' m de recorrido</small></span>' +
            '<span class="pcr-nivel-barra"><i style="width:' + pct + '%"></i></span>' +
            '<span class="pcr-nivel-n">' + a.usos + '</span>' +
          '</div>';
        }).join('') +
      '</div>' +
      (function () {
        var a = c.anillos[1] || c.anillos[0];
        if (!a) return '';
        var dif = a.usosRecta - a.usos;
        if (dif <= 0) {
          return '<p class="pcr-conc">A ' + a.minutos + ' minutos se llega a <b>' + a.usos +
            '</b> usos. Acá la línea recta no engañaba: las calles llevan derecho.</p>';
        }
        return '<p class="pcr-conc">A ' + a.minutos + ' minutos caminando se llega a <b>' + a.usos +
          '</b> usos. En línea recta parecían <b>' + a.usosRecta + '</b>: ' + dif + ' quedan más ' +
          'lejos de lo que aparentan porque hay que dar la vuelta.</p>';
      })() +
      (mayor.ejemplos.length
        ? '<p class="pcr-pista">A ' + mayor.minutos + ' minutos: ' +
          esc(mayor.ejemplos.join(' · ')) + '.</p>'
        : '') +
      ((c.tramos || []).length
        ? '<div class="pcr-llevar">' +
            '<button type="button" data-pcr="caminata-mapa" class="pcr-mini pcr-llevar-b">' +
              (S.caminataEnMapa ? ico('apagar', 16) + 'Quitar del mapa'
                                : ico('mapa', 16) + 'Ver el recorrido en el mapa') +
            '</button>' +
          '</div>' +
          (S.caminataEnMapa
            ? '<p class="pcr-pista">Azul oscuro, 5 minutos; celeste, 10; claro, 15. ' +
              'Cerrá esta hoja para verlo.</p>'
            : '')
        : '') +
      '<p class="pcr-pista">El lote engancha a la calle más cercana, a <b>' + c.distanciaAlaCalleM +
      ' m</b>. Lo que este recorrido <b>no</b> sabe: si hay andén, si hay dónde cruzar y si la cuadra ' +
      'es una subida. Las tres cambian mucho diez minutos de camino en Cúcuta, y las tres se ' +
      'levantan caminándolas.</p>';
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
      bloqueFlujo(mv) +
      leyendaVial() +
      bloqueRutas(mv) +
      bloquePorDonde(S.resultado);
  }

  /* ── Quién pasa por acá: a pie o en carro ─────────────────────────────
     El servidor calculaba esto desde siempre —cuánto peatón, cuánto
     vehículo, cuál manda, cómo se reparte el día y si la calle sigue viva de
     noche— y NINGUNA parte de la aplicación lo mostraba. Se descubrió
     inventariando lo que el motor devuelve contra lo que la ficha usa: diez
     números que ya viajaban en cada respuesta y que nadie leía.

     Vale la pena porque contesta la pregunta que decide el formato de un
     proyecto antes que ninguna cifra de área: a qué se abre, por dónde entra
     y a qué hora sirve. Un local de barrio en una calle vehicular con la
     puerta a la calle está mal resuelto, y eso no lo dice el índice de
     ocupación. */
  function bloqueFlujo(mv) {
    var f = mv && mv.flujo;
    if (!f) return '';
    var FR = [['manana', 'Mañana'], ['mediodia', 'Mediodía'],
              ['tarde', 'Tarde'], ['noche', 'Noche']];
    var hayFranjas = f.franjas && FR.some(function (x) { return f.franjas[x[0]] != null; });
    var LEE = {
      peatonal: 'Manda el peatón. El proyecto se abre a la calle: vitrina, zaguán, sombra ' +
                'en el andén. Encerrarlo detrás de un parqueadero sería darle la espalda a ' +
                'lo que ya funciona.',
      vehicular: 'Manda el carro. Hay que resolver el acceso vehicular y protegerse del ' +
                 'ruido y del polvo; la fachada a la vía no es la buena para dormir.',
      equilibrado: 'Peatón y carro parejos. Los dos accesos hay que atenderlos bien, y el ' +
                   'punto de conflicto es dónde se cruzan.',
      ninguno: 'No pasa casi nadie, ni a pie ni en carro. Un proyecto acá no se cuelga de ' +
               'un flujo que no existe: tiene que traer su propia gente.'
    };
    return '<p class="pcr-lab">Quién pasa por acá</p>' +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + (f.peatonal || 0) + '</b><small>flujo a pie /100</small></div>' +
        '<div class="pcr-kpi"><b>' + (f.vehicular || 0) + '</b><small>flujo en carro /100</small></div>' +
        (f.franjaFuerte
          ? '<div class="pcr-kpi"><b>' + esc(f.franjaFuerte.replace(/^(el|la) /, '')) +
            '</b><small>la hora fuerte</small></div>'
          : '') +
      '</div>' +
      /* Las mismas clases que el bloque de cobertura: nombre, barra y número.
         Inventar otra fila de barras para esto sería tener dos que se ven
         casi igual y se mantienen por separado. */
      (hayFranjas
        ? '<div class="pcr-niveles">' +
            FR.filter(function (x) { return f.franjas[x[0]] != null; }).map(function (x) {
              return '<div class="pcr-nivel">' +
                '<span class="pcr-nivel-nom">' + x[1] + '</span>' +
                '<span class="pcr-nivel-barra"><i style="width:' +
                  Math.max(2, f.franjas[x[0]]) + '%"></i></span>' +
                '<b class="pcr-nivel-n">' + f.franjas[x[0]] + '%</b>' +
              '</div>';
            }).join('') +
          '</div>'
        : '') +
      '<p class="pcr-conc">' + esc(LEE[f.dominante] || LEE.equilibrado) + '</p>' +
      (f.vidaNocturna
        ? '<p class="pcr-conc">Y sigue viva de noche, que en Cúcuta no es lo común: cambia el ' +
          'horario de un local y cambia quién se siente seguro caminando.</p>'
        : '') +
      '<p class="pcr-pista">Es una <b>estimación</b> a partir de los usos registrados y de los ' +
      'corredores cercanos, no un aforo. Contar cuánta gente pasa en diez minutos, a tres horas ' +
      'distintas, la desmiente o la confirma en una tarde.</p>';
  }

  /* ── La evolución, en la ficha ────────────────────────────────────────
     Dos botones y dos resultados que no se mezclan. La serie larga trae
     números y conclusión; la corta trae imágenes y nada más, porque poner un
     porcentaje sobre fotos de otro sensor y compararlo con el de Landsat
     sería juntar lo que no se junta. */
  function bloqueEvolucion() {
    var EV = window.URBIS_EVOLUCION;
    if (!EV || !S.resultado) return '';
    var e = S.evo || {};
    var L = e.landsat, W = e.wayback;
    var cargando = S.evoCargando;

    var cab = h4('reloj', 'Cómo cambió el sitio') +
      '<p class="pcr-pista">Dos series de imágenes satelitales del mismo sector. La larga ' +
      'arranca en <b>1984</b> y se ve a cuadros —treinta metros por píxel—, pero sirve para ' +
      '<b>medir</b>: lo que se calcula no es una forma sino una proporción sobre miles de ' +
      'píxeles. La corta arranca en <b>2014</b> en alta resolución y sirve para <b>mirar</b>.</p>';

    /* Las fotos van PRIMERO, y el orden es una confesión: la serie de alta
       resolución está comprobada contra el servicio de verdad —la prueba
       intercepta la red y verifica qué se pide y a dónde— y la de Landsat no.
       Se escribió siguiendo la forma documentada de su API, pero desde donde
       se programa la red no llega a ese dominio y no hay manera de
       confirmarlo. Ofrecer primero la que se sabe que anda, y decir de la
       otra que está en prueba, es lo honesto mientras siga así. */
    var botones = '<div class="pcr-llevar">' +
      '<button type="button" data-pcr="evolucion-alta" class="pcr-mini pcr-llevar-b"' +
        (cargando ? ' disabled' : '') + '>' + ico('ojo', 16) +
        (cargando === 'wayback' ? 'Trayendo…' : (W ? 'Rehacer las fotos' : 'Ver las fotos desde 2014')) +
      '</button>' +
      '<button type="button" data-pcr="evolucion" class="pcr-mini"' +
        (cargando ? ' disabled' : '') + '>' + ico('crecer', 16) +
        (cargando === 'landsat' ? 'Trayendo…' : (L ? 'Rehacer desde 1984' : 'Medir desde 1984')) +
      '</button>' +
    '</div>' +
    (L ? '' : '<p class="pcr-pista">Las fotos desde 2014 salen del mismo proveedor que la foto ' +
      'de hoy y están comprobadas. La medición desde 1984 pide otro catálogo —el de Landsat— y ' +
      '<b>todavía no se ha podido confirmar contra el servicio</b>: si falla, la ficha dice qué ' +
      'contestó el servidor en vez de encogerse de hombros.</p>') +
    (cargando ? '<p class="pcr-conc" id="pcr-evo-estado">' + esc(S.evoAviso || 'Trayendo…') + '</p>' : '') +
    (S.evoAviso && !cargando ? '<p class="pcr-error">' + esc(S.evoAviso) + '</p>' : '');

    return cab + botones + serieLarga(L) + serieCorta(W);
  }

  function serieLarga(s2) {
    if (!s2) return '';
    var EV = window.URBIS_EVOLUCION;
    var buenos = s2.pasos.filter(function (p) { return p.ok && p.medida; });
    if (!buenos.length) {
      /* Y POR QUÉ no se pudo. «Puede ser el servicio, puede ser la conexión»
         es lo que se decía antes, y con eso no se arregla nada: el fallo
         llegó en una captura y hubo que adivinar. El motivo lo devuelve cada
         año que falló, y el diagnóstico dice en qué paso y con qué código. */
      var porQue = (s2.pasos || []).map(function (p) { return p.error; })
        .filter(function (x, i, a) { return x && a.indexOf(x) === i; });
      return '<p class="pcr-ojo">No se pudo leer ninguna imagen de la serie larga.' +
        (porQue.length ? ' El servicio dijo: <b>' + esc(porQue.join(' · ')) + '</b>.' : '') +
        ' No quiere decir que el sitio no haya cambiado.</p>' +
        detalleDelFallo();
    }
    var conc = EV.conclusion(s2) || [];
    var maxV = buenos.reduce(function (m, p) { return Math.max(m, p.medida.verde); }, 1);
    return '<p class="pcr-lab">Desde 1984, medido</p>' +
      '<div class="pcr-evo-tira">' +
        buenos.map(function (p) {
          return '<figure class="pcr-evo-p' + (p.fiable ? '' : ' pcr-evo-dudoso') + '">' +
            '<img src="' + p.imagen + '" alt="El sector en ' + p.anio + '" loading="lazy">' +
            '<figcaption>' + p.anio + '</figcaption>' +
            '<small>' + String(p.medida.verde).replace('.', ',') + '% verde</small>' +
          '</figure>';
        }).join('') +
      '</div>' +
      '<div class="pcr-niveles">' +
        buenos.map(function (p) {
          return '<div class="pcr-nivel">' +
            '<span class="pcr-nivel-nom">' + p.anio +
              (p.fiable ? '' : '<span class="pcr-nivel-sub">medio tapado, no cuenta</span>') + '</span>' +
            '<span class="pcr-nivel-barra"><i style="width:' +
              Math.max(2, Math.round(100 * p.medida.verde / maxV)) + '%"></i></span>' +
            '<b class="pcr-nivel-n">' + String(p.medida.verde).replace('.', ',') + '%</b>' +
          '</div>';
        }).join('') +
      '</div>' +
      (conc.length
        ? '<ul class="pcr-sintesis pcr-sintesis-bien">' +
            conc.map(function (c) {
              return '<li><span>' + esc(c.texto) + '</span><b>' + esc(c.dato) + '</b></li>';
            }).join('') +
          '</ul>'
        : '<p class="pcr-pista">La serie no da para afirmar un cambio: las diferencias caben ' +
          'dentro del error de medir a treinta metros con otro satélite y otra fecha del año.</p>') +
      '<p class="pcr-pista">Cada barra es el porcentaje del sector con vegetación, calculado con ' +
      'el <b>NDVI</b> —el índice de la banda infrarroja— y no con el clasificador de colores que ' +
      'usa la foto de hoy: el clasificador está calibrado para los colores de un proveedor, y ' +
      'comparar años con él mediría la diferencia entre dos cámaras. Un año medio tapado por ' +
      'nubes se marca y no entra en la conclusión.</p>';
  }

  /* El parte técnico de la última tanda. Va plegado porque no es para leer:
     es para copiarlo y mandarlo cuando algo falla en un teléfono ajeno, que
     es exactamente lo que no se pudo hacer la primera vez. */
  function detalleDelFallo() {
    var EV = window.URBIS_EVOLUCION;
    var d = (EV && typeof EV.diagnostico === 'function') ? EV.diagnostico() : [];
    if (!d.length) return '';
    return '<details class="pcr-detalle"><summary>Qué contestó el servicio</summary>' +
      '<pre class="pcr-plano">' + esc(d.map(function (x) {
        return [x.paso, x.anio, x.estado || x.error || ''].filter(Boolean).join(' · ');
      }).join('\n')) + '</pre></details>';
  }

  function serieCorta(s2) {
    if (!s2) return '';
    var buenos = s2.pasos.filter(function (p) { return p.ok; });
    if (!buenos.length) return '';
    return '<p class="pcr-lab">Desde 2014, en alta resolución</p>' +
      '<div class="pcr-evo-tira pcr-evo-alta">' +
        buenos.map(function (p) {
          /* La fecha DE LA IMAGEN, no el año que se pidió. Esri publica por
             entregas fechadas, no por años: rotular «2016» una estampa de
             diciembre de 2015 sería inventarse el dato justo en la caja que
             existe para comparar años. */
          return '<figure class="pcr-evo-p' + (p.sustituto ? ' pcr-evo-dudoso' : '') + '">' +
            '<img src="' + p.imagen + '" alt="El sector en ' + (p.anioReal || p.anio) +
              '" loading="lazy">' +
            '<figcaption>' + (p.anioReal || p.anio) + '</figcaption>' +
            (p.fecha ? '<small>' + esc(p.fecha) + '</small>' : '') +
          '</figure>';
        }).join('') +
      '</div>' +
      '<p class="pcr-pista">Debajo de cada estampa va la <b>fecha de la entrega</b> de la que ' +
      'salió, no el año que se pidió: el proveedor publica por entregas fechadas y no por años, ' +
      'y rotular con un año que no es sería inventar el dato justo donde se comparan años. ' +
      'Acá NO hay porcentajes a propósito. Son de otro sensor y otro ' +
      'procesamiento que la serie larga, y ponerles un número al lado invitaría a compararlos ' +
      'con los de arriba, que es justo lo que no se puede hacer. Estas son para mirar: qué se ' +
      'construyó, qué se taló, por dónde iba el agua.</p>';
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

    return D.consultarClima(eje.lat, eje.lng, function (txt) {
      S.cliAviso = txt;
      var caja = document.getElementById('pcr-cli-estado');
      if (caja) caja.textContent = txt;
    }).then(function (clima) {
      return window.AIA_REMOTO.clima({ clima: clima });
    }).then(function (res) {
      S.clima = res; S.cliCargando = false; S.cliAviso = '';
      guardarFichaViva();
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

    return D.consultarElevacion(rej.puntos, function (txt) {
      S.terAviso = txt;
      var caja = document.getElementById('pcr-ter-estado');
      if (caja) caja.textContent = txt;
    }).then(function (alturas) {
      var puntos = rej.puntos.map(function (p, i) {
        return { lat: p.lat, lng: p.lng, elev: alturas[i] };
      });
      /* La rejilla de cotas se guarda además de mandarse. Son 18 × 18 puntos
         —dos kilobytes— y con ella el navegador puede cortar el terreno por
         donde haga falta sin volver a consultar nada: por el lote, por una
         calle, por donde el estudiante quiera. Tirarla era pedirle otra vez
         al servicio de elevación lo que ya estaba en la mano. */
      S.terRejilla = {
        filas: rej.filas, columnas: rej.columnas, limites: rej.limites,
        z: puntos.map(function (p) {
          return Number.isFinite(Number(p.elev)) ? Math.round(Number(p.elev) * 10) / 10 : null;
        })
      };
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
      guardarFichaViva();
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

    return traer.then(function (elementos) {
      /* Las huellas de los edificios se guardan en memoria para poder
         pintarlas cuando se pida, sin repetir la consulta. Solo los anillos:
         las etiquetas no hacen falta para dibujar y ocupan de más. El tope
         existe porque un sector grande del centro puede traer miles y el
         teléfono no tiene por qué cargar con todos. */
      var edificios = (elementos || [])
        .filter(function (el) {
          var t = el && el.tags;
          return t && t.building && t.building !== 'no' &&
                 Array.isArray(el.geometry) && el.geometry.length >= 3;
        })
        .slice(0, 3000);
      S.trzHuellas = edificios.map(function (el) {
        return el.geometry.map(function (p) {
          return { lat: p.lat, lng: p.lon != null ? p.lon : p.lng };
        });
      });
      /* Los pisos de cada huella, en el mismo orden. Se guardaban solo los
         anillos —para dibujar no hace falta más— pero sin la altura no hay
         sombra que proyectar, y la sombra de los vecinos es lo que decide
         dónde se puede poner un patio. `null` cuando el edificio no la trae:
         inventarle tres pisos a lo que no se sabe sería dibujar una sombra
         que no existe. */
      S.trzPisos = edificios.map(function (el) {
        var t = el.tags || {};
        var n1 = parseFloat(t['building:levels']);
        if (isFinite(n1) && n1 > 0) return Math.min(60, n1);
        var alt = parseFloat(t.height);
        if (isFinite(alt) && alt > 0) return Math.min(60, Math.round(alt / 3 * 10) / 10);
        return null;
      });
      /* Las vías, con su nombre y su forma. Son lo que le permite al lote
         decir «frente de 24 m sobre la Avenida 3» en vez de «un lado de 24
         m»: sin la geometría de la calle, un lote es un polígono en el aire.
         Se guardan acá porque ya llegaron; pedirlas otra vez para el lote
         sería cobrar dos veces la misma consulta. */
      S.trzVias = (elementos || [])
        .filter(function (el) {
          var t = el && el.tags;
          return t && t.highway && Array.isArray(el.geometry) && el.geometry.length >= 2;
        })
        .slice(0, 2000)
        .map(function (el) {
          return {
            nombre: (el.tags.name || '').trim(),
            clase: el.tags.highway,
            pts: el.geometry.map(function (p) {
              return { lat: p.lat, lng: p.lon != null ? p.lon : p.lng };
            })
          };
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
      // Con las calles ya en la mano, el recorrido a pie desde el lote deja
      // de ser una promesa y se puede calcular.
      recalcularCaminata();
    S.sombras = null;
      // Se guarda con la ficha: pesa unas pocas cifras y es media lámina.
      guardarFichaViva();
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
    return centroDeAnalisis();
  }

  /* ── Medir todo ────────────────────────────────────────────────────────
     Analizar un sector deja la ficha a medias a propósito: cada medición
     cuesta una consulta a un servicio distinto y no todos los ejercicios las
     necesitan. Pero en el uso real casi siempre se quieren todas, y pedirlas
     de a una son cinco botones repartidos por una hoja de treinta bloques,
     cada uno con su espera, y ninguno avisa de que existen los otros.

     Esto las encadena. Va EN SERIE y no en paralelo por dos razones: el
     limitador de Overpass rechaza dos consultas seguidas —el trazado se
     caería—, y en un teléfono cinco descargas simultáneas más la lectura de
     la foto satelital dejan la aplicación sin memoria.

     Un paso que falla no detiene la cadena. Es lo contrario de lo que uno
     escribiría por instinto, y es lo correcto: que el servicio del clima esté
     caído no es razón para quedarse además sin el trazado. Al final se dice
     qué salió y qué no. */
  var PASOS_MEDIR = [
    { id: 'trazado', nombre: 'El trazado', que: 'calles, huellas y espacio público',
      /* Las DOS cosas. El análisis del trazado se guarda con la ficha, pero
         la geometría cruda —miles de polígonos— no cabe en un teléfono. Un
         sector reanudado tiene lo primero y no lo segundo, y dar el paso por
         hecho dejaría al estudiante con los llenos y vacíos, las sombras y el
         recorrido a pie vacíos sin que nada le dijera por qué. */
      hecho: function () { return !!(S.trazado && S.trzHuellas && S.trzHuellas.length); },
      // La única que pasa por Overpass, y por eso la única que tiene que
      // esperar el limitador de cinco segundos desde el análisis.
      esperaAntesMs: 5600,
      correr: function () { return analizarTrazado(); } },
    { id: 'terreno', nombre: 'El terreno', que: 'cotas, pendiente y curvas de nivel',
      hecho: function () { return !!S.terreno; },
      correr: function () { return analizarTerreno(); } },
    { id: 'clima', nombre: 'El clima', que: 'temperatura, lluvia y vientos',
      hecho: function () { return !!S.clima; },
      correr: function () { return analizarClima(); } },
    { id: 'amenaza', nombre: 'La amenaza', que: 'sismo y movimientos en masa',
      hecho: function () { return !!S.amenaza; },
      correr: function () { return pedirAmenaza(); } },
    /* La foto va última a propósito: es la más cara —tres pasadas sobre
       millones de píxeles— y la única que puede tumbar un teléfono viejo. Si
       se cae, todo lo anterior ya está hecho. */
    { id: 'cobertura', nombre: 'La foto satelital', que: 'cobertura del suelo clasificada',
      hecho: function () { return !!S.cobertura; },
      correr: function () { return analizarCobertura(); } }
  ];

  /* ── Llevárselo a la calle ─────────────────────────────────────────────
     Lo intangible se marca caminando, y caminando no hay señal. Sin las
     teselas guardadas el mapa queda gris, y sobre un mapa gris no se puede
     señalar dónde está oscuro. */
  function bloqueSinSenal() {
    var SS = window.URBIS_SIN_SENAL;
    if (!SS || !S.resultado) return '';
    var contorno = null;
    try { contorno = contornoDelSector(); } catch (e) {}
    if (!contorno || contorno.length < 2) return '';

    var b = S.bajandoTeselas;
    if (b) {
      var pct = b.total ? Math.round(100 * b.hechas / b.total) : 0;
      /* Con identificador: mientras baja, se retoca ESTE renglón y ESTA barra
         en su sitio. Repintar la hoja entera por cada imagen —eran 421— la
         reconstruía cuatrocientas veces, y con ella se perdía el punto de
         lectura: la hoja saltaba arriba y no dejaba bajar. */
      return '<div class="pcr-medir pcr-medir-va">' +
        '<p class="pcr-lab" id="pcr-tes-txt">Guardando el mapa · ' + b.hechas +
          ' de ' + b.total + '</p>' +
        '<div class="pcr-medir-barra"><i id="pcr-tes-barra" style="width:' + pct + '%"></i></div>' +
        '<p class="pcr-pista">Se puede cerrar la hoja: sigue bajando.</p>' +
        '<div class="pcr-llevar">' +
          '<button type="button" data-pcr="teselas-parar" class="pcr-mini">' +
            ico('cerrar', 16) + 'Parar</button>' +
        '</div>' +
      '</div>';
    }

    var est = SS.estimar(contorno);
    var g = S.teselas;
    return '<div class="pcr-medir">' +
      '<p class="pcr-lab">Llevárselo a la calle</p>' +
      (g && g.hay
        ? '<p class="pcr-conc">Hay <b>' + g.teselas + '</b> teselas guardadas (' +
          String(g.mb).replace('.', ',') + ' MB). El mapa se ve sin señal.</p>'
        : '<p class="pcr-pista">Sin señal el mapa queda gris, y sobre un mapa gris no se ' +
          'puede marcar dónde está oscuro. Esto baja el mapa del sector <b>antes</b> de salir, ' +
          'con un margen de 250 m alrededor y en las tres escalas que sirven caminando.</p>') +
      '<p class="pcr-pista">Son unas <b>' + est.teselas + '</b> imágenes, cerca de <b>' +
      String(est.mb).replace('.', ',') + ' MB</b>. Conviene hacerlo con wifi.' +
      (est.foto
        ? ' Estás con el mapa de <b>satélite</b>: pesa casi el doble que el de dibujo y el ' +
          'navegador le reserva mucho más espacio del que ocupa, así que puede que no quepan ' +
          'todas. Si solo necesitás ubicarte, cambiá a un mapa de dibujo antes de guardar.'
        : '') + '</p>' +
      '<div class="pcr-llevar">' +
        '<button type="button" data-pcr="teselas" class="pcr-mini pcr-llevar-b">' +
          ico('nube', 16) + (g && g.hay ? 'Volver a guardar' : 'Guardar el mapa') + '</button>' +
        (g && g.hay
          ? '<button type="button" data-pcr="teselas-borrar" class="pcr-mini">' +
            ico('borrar', 16) + 'Borrar lo guardado</button>'
          : '') +
      '</div>' +
      '<p class="pcr-pista">Esto guarda el <b>mapa</b>, no el análisis: analizar un sector, ' +
      'medir el trazado o preguntarle al Servicio Geológico siguen necesitando red. Lo de la ' +
      'calle es marcar, y para marcar hace falta ver.</p>' +
    '</div>';
  }

  function medirTeselas() {
    var SS = window.URBIS_SIN_SENAL;
    if (!SS) return;
    SS.medida().then(function (m) { S.teselas = m; pintar(); });
  }

  function guardarTeselas() {
    var SS = window.URBIS_SIN_SENAL;
    if (!SS || S.bajandoTeselas) return;
    var contorno = null;
    try { contorno = contornoDelSector(); } catch (e) {}
    if (!contorno) { S.aviso = 'Primero analizá un sector.'; pintar(); return; }
    var pr = SS.guardar(contorno, 250, function (est) {
      /* Se repinta con lo que informa el guardador, no con un contador
         propio: si el navegador descarta la mitad por falta de espacio, la
         barra tiene que reflejar eso y no una cuenta optimista. */
      if (!S.bajandoTeselas) return;
      S.bajandoTeselas.hechas = est.hechas;
      S.bajandoTeselas.total = est.total;
      /* Se toca lo que cambió y NADA más. `pintar()` acá rehacía el
         `innerHTML` de toda la hoja por cada imagen: cuatrocientas
         reconstrucciones, cada una perdiendo el punto de lectura —la hoja
         saltaba arriba— y robándole tiempo a la propia descarga, que era lo
         que estaba en curso. Llegó reportado como que la hoja no dejaba
         bajar y que al final ni guardaba. */
      var txt = document.getElementById('pcr-tes-txt');
      var barra = document.getElementById('pcr-tes-barra');
      if (txt) txt.textContent = 'Guardando el mapa · ' + est.hechas + ' de ' + est.total;
      if (barra) barra.style.width = (est.total ? Math.round(100 * est.hechas / est.total) : 0) + '%';
    });
    S.bajandoTeselas = { hechas: 0, total: pr.estado ? pr.estado.total : 0, pr: pr };
    pintar();
    pr.then(function (est) {
      S.bajandoTeselas = null;
      S.aviso = est.cancelado
        ? 'Se paró de guardar. Lo que alcanzó a bajar queda servido.'
        : est.fallos
          ? 'Mapa guardado, con ' + est.fallos + ' imágenes que no bajaron. En esos puntos ' +
            'quedará gris.'
          : 'Mapa guardado. Ya se puede caminar el sector sin señal.';
      /* `medirTeselas()` repinta al terminar su medición, pero si falla —o si
         tarda— la hoja se quedaba con la barra de progreso de un guardado que
         ya terminó. Se repinta acá y que la medición repinte otra vez si
         quiere: una hoja que miente sobre lo que está pasando es peor que un
         repintado de más. */
      pintar();
      medirTeselas();
    }).catch(function (e) {
      S.bajandoTeselas = null;
      S.aviso = (e && e.message) || 'No se pudo guardar el mapa.';
      pintar();
    });
  }

  /* El botón y su cuenta. Va arriba de la ficha, antes de los bloques que
     encadena: si estuviera al lado de cualquiera de ellos parecería suyo. */
  function bloqueMedirTodo() {
    if (!S.resultado) return '';
    var m = S.midiendoTodo;
    var faltan = PASOS_MEDIR.filter(function (p) { return !p.hecho(); });
    if (m) {
      return '<div class="pcr-medir pcr-medir-va">' +
        '<p class="pcr-lab">Midiendo el sector · ' + (m.hecho + 1) + ' de ' + m.total + '</p>' +
        '<p class="pcr-conc">' + esc(m.actual) + '…</p>' +
        '<div class="pcr-medir-barra"><i style="width:' +
          Math.round(100 * m.hecho / m.total) + '%"></i></div>' +
        (m.ok.length ? '<p class="pcr-pista">Listo: ' + esc(m.ok.join(', ')) + '.</p>' : '') +
        (m.mal.length ? '<p class="pcr-pista">No se pudo con ' + esc(m.mal.join(', ')) +
          '.</p>' : '') +
        '<div class="pcr-llevar">' +
          '<button type="button" data-pcr="medir-parar" class="pcr-mini">' +
            ico('cerrar', 16) + 'Parar</button>' +
        '</div>' +
      '</div>';
    }
    if (!faltan.length) {
      return '<div class="pcr-medir">' +
        '<p class="pcr-conc">Todo medido: trazado, terreno, clima, amenaza y la foto ' +
        'satelital. Lo que sigue es de la calle —marcar el lote y salir a mirar—.</p>' +
      '</div>';
    }
    return '<div class="pcr-medir">' +
      '<p class="pcr-lab">Falta medir</p>' +
      '<p class="pcr-pista">El análisis trae lo que hay; lo demás son mediciones aparte, cada ' +
      'una a un servicio distinto. Se pueden pedir de a una más abajo, o todas de una vez ' +
      'acá. Tarda cerca de un minuto y se puede parar.</p>' +
      /* El caso del sector reanudado, dicho donde se va a leer: el trazado
         figura como pendiente y sus cifras están abajo, y sin esta línea eso
         parece un error de la aplicación. */
      (S.trazado && !(S.trzHuellas && S.trzHuellas.length)
        ? '<p class="pcr-pista">De este sector volvieron las cifras del trazado, pero no las ' +
          '<b>huellas de los edificios</b>: son miles de polígonos y no caben en el ' +
          'almacenamiento del teléfono. Volver a medirlo es una sola consulta, y con eso ' +
          'vuelven los llenos y vacíos, las sombras y el recorrido a pie.</p>'
        : '') +
      '<div class="pcr-medir-lista">' +
        PASOS_MEDIR.map(function (p) {
          var ya = p.hecho();
          return '<span class="pcr-medir-p' + (ya ? ' on' : '') + '">' +
            ico(ya ? 'ok' : 'reloj', 14) + esc(p.nombre) + '</span>';
        }).join('') +
      '</div>' +
      '<div class="pcr-llevar">' +
        '<button type="button" data-pcr="medir-todo" class="pcr-principal">' +
          ico('destello', 16) + 'Medir todo lo que falta</button>' +
      '</div>' +
    '</div>';
  }

  function medirTodo(forzar) {
    if (S.midiendoTodo || !S.resultado) return Promise.resolve(null);
    var pendientes = PASOS_MEDIR.filter(function (p) { return forzar || !p.hecho(); });
    if (!pendientes.length) {
      S.aviso = 'Ya está todo medido.'; pintar(); return Promise.resolve(null);
    }
    S.midiendoTodo = { total: pendientes.length, hecho: 0, actual: pendientes[0].nombre,
                       ok: [], mal: [] };
    pintar();
    var esperar = function (ms) {
      return new Promise(function (r) { setTimeout(r, ms); });
    };
    return pendientes.reduce(function (cadena, paso, i) {
      return cadena.then(function () {
        if (!S.midiendoTodo) return null;           // lo cancelaron
        S.midiendoTodo.actual = paso.nombre; pintar();
        return esperar(paso.esperaAntesMs || (i ? 400 : 0)).then(function () {
          if (!S.midiendoTodo) return null;
          var pr;
          try { pr = paso.correr(); } catch (e) { pr = Promise.reject(e); }
          return Promise.resolve(pr).then(
            function () {
              /* Se comprueba el ESTADO y no que la promesa haya resuelto: casi
                 todas estas funciones atrapan su propio error, guardan el aviso
                 y resuelven igual. Sin esto, la cadena diría que midió cinco
                 cosas cuando midió dos. */
              if (S.midiendoTodo) {
                (paso.hecho() ? S.midiendoTodo.ok : S.midiendoTodo.mal).push(paso.nombre);
              }
            },
            function () { if (S.midiendoTodo) S.midiendoTodo.mal.push(paso.nombre); }
          );
        });
      }).then(function () {
        if (S.midiendoTodo) { S.midiendoTodo.hecho++; pintar(); }
      });
    }, Promise.resolve()).then(function () {
      var r = S.midiendoTodo;
      S.midiendoTodo = null;
      if (r) {
        S.aviso = r.mal.length
          ? 'Medido: ' + (r.ok.join(', ') || 'nada') + '. No se pudo con ' +
            r.mal.join(', ') + '; probá esos de a uno.'
          : 'Listo: ' + r.ok.join(', ') + '.';
      }
      pintar();
      return r;
    });
  }

  function pedirAmenaza() {
    var AM = window.URBIS_AMENAZA;
    if (!AM) { S.amenazaAviso = 'Falta el módulo de amenaza sísmica. Recargá la app.';
               pintar(); return; }
    var e = ejeDelSector();
    if (!e || e.lat == null) { S.amenazaAviso = 'Primero analizá un sector.'; pintar(); return; }
    S.amenazaCargando = true; S.amenazaAviso = ''; S.inundacionAviso = ''; pintar();

    /* El agua se pide junto con el sismo, por el mismo botón y en la misma
       espera. Son dos servidores distintos —el SGC y el IDEAM— pero una sola
       pregunta: «¿qué le puede pasar a este sitio?». Separarlas en dos
       botones obligaría a saber de antemano que hay dos, que es justo lo que
       alguien que abre esto por primera vez no sabe.

       Van en paralelo y cada una aguanta que la otra falle: que el IDEAM esté
       caído no es razón para quedarse sin los coeficientes de la norma, ni al
       revés. Por eso el `catch` de la inundación devuelve en vez de propagar. */
    var IN = window.URBIS_INUNDACION;
    var agua = IN
      ? IN.consultar(e.lat, e.lng).then(function (inu) { S.inundacion = inu; },
          function (err) {
            S.inundacion = null;
            S.inundacionAviso = (err && err.message) || 'No se pudo consultar la inundación.';
          })
      : Promise.resolve();

    // Se devuelve la promesa: sin ella «Medir todo» daba este paso por
    // terminado apenas empezaba, lo contaba como fallido y seguía con la foto
    // satelital mientras el SGC todavía estaba contestando.
    return Promise.all([
      AM.consultar(e.lat, e.lng).then(function (am) {
        S.amenaza = am; S.amenazaAviso = '';
      }, function (err) {
        S.amenazaAviso = (err && err.message) || 'No se pudo consultar la amenaza sísmica.';
      }),
      agua
    ]).then(function () {
      S.amenazaCargando = false;
      guardarFichaViva();
      pintar();
    });
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
    return A.analizarRaster(function (txt) {
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

    /* Los usos concretos más repetidos: es lo que el estudiante va a ver en
       la calle, más útil que la categoría general. Los dibuja
       `chipsMasRepetido`, que comparten esta ficha y el informe de un sector
       guardado; la lista en crudo se queda acá porque más abajo, en «qué
       verificar en campo», se nombra el primero de todos. */
    var subs = Object.keys(st.porSub || {})
      .map(function (s) { return { id: s, n: st.porSub[s] || 0 }; })
      .filter(function (x) { return x.n > 0 && x.id !== 'otro'; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, 8);
    var TAX = (window.AIA_MOTOR && window.AIA_MOTOR.TAXONOMIA) || [];
    var chips = chipsMasRepetido(st);

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

        /* Arriba del todo y no al pie: si el sector no se está guardando, todo
           lo que se lea más abajo se va a perder al cerrar la aplicación, y
           enterarse después de haber trabajado media hora no sirve de nada. */
        (S.avisoGuardado ? '<p class="pcr-error pcr-guardado-mal">' + esc(S.avisoGuardado) + '</p>' : '') +
        bloqueTraba() +

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
        bloqueDondeSeMidio(S.centroDeAnalizado, meta) +

        bloqueUbicacion(res.ubicacion, st, meta) +
        bloqueLote(meta, esPol) +
        bloquePoblacion(st, esPol) +
        bloqueDemografia(st) +

        // Antes que nada: qué falta medir. Los cinco botones que encadena
        // están repartidos por treinta bloques y ninguno avisa de los otros.
        bloqueMedirTodo() +
        bloqueSinSenal() +
        /* Las capas, ARRIBA. Estaban en el puesto veintidós de treinta y dos
           bloques, después de todo lo que se lee: existían, con su lista
           completa y sus interruptores, y nadie las encontraba. Llegó dicho
           así: «no vi las opciones de desactivar capas; quedó todo encima de
           una cosa, todo combinado».

           Un panel de control no se busca hacia el final de un informe. Va
           antes de lo que se lee, junto a «qué falta medir», que es el otro
           control de esta ficha. */
        bloqueCapas(st) +

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
        bloqueLoteIntervenir() +
        // El puente: hasta acá se mide el sitio, y acá empieza el proyecto.
        bloqueCuadra() +
        bloqueQueCabe() +
        bloqueCaminata() +
        /* Lo intangible va acá y no al final: es lo que se recoge caminando,
           y quien tiene la hoja abierta en la calle no llega al final. */
        bloqueIntangible() +
        /* Las determinantes van pegadas al lote: son la lectura de proyecto de
           todo lo que se midió sobre él —sol, sombra, agua, acceso, viento— y
           leerlas acá evita tener que reconstruirlas al final. */
        bloqueDeterminantes(st) +
        bloqueAlturas(st) +
        bloqueTerreno() +
        bloqueClima() +
        bloqueAmenaza() +
        bloqueTrazado() +
        bloquePerfil() +
        bloqueEspacio(st) +
        bloqueAccesibilidad(st) +
        bloqueCampo() +
        bloqueSol(meta) +
        bloqueMovilidad(st) +
        bloqueAmbiente(st) +
        bloqueEvolucion() +
        bloqueNucleos(st) +
        bloqueHitos(st) +
        bloqueAnillos(st, esPol) +
        // Las capas ordenan el mapa —y viven arriba, con los controles—;
        // esto ordena el papel.
        bloquePliego(res) +
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
        (function () {
          var rosa = rosaDeLoMapeado(zonas);
          return rosa
            ? '<div class="pcr-dibujo pcr-dibujo-solo">' + rosa +
              '<p class="pcr-dibujo-pie">Cuántos usos mapeados hay en cada rumbo del sector. Los ' +
              'gajos punteados son los que no tienen <b>ninguno</b>: ahí todo lo que levanten es ' +
              'nuevo.</p></div>'
            : '';
        })() +
        tareas +

        // La síntesis va acá, después de todas las mediciones y antes de las
        // tareas: es el puente entre «esto es lo que hay» y «esto es lo que
        // vas a hacer».
        bloqueSintesis(res) +

        /* Entre la síntesis y el reparto: «esto es lo que hay», «esto es lo
           que falta», «esto es a dónde van». La lista de faltantes es el
           puente entre las dos, y sin ella el plan manda a caminar sin decir
           qué anotar. */
        bloqueQueFalta(st) +

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
          /* «PDF» a secas, al lado de «Lámina … · PDF», llevaba a tocarlo
             esperando el pliego y a encontrarse el cuadro de impresión del
             teléfono. Son dos cosas distintas: esto es el informe entero en
             hojas, para leer; la lámina es un pliego, para colgar. */
          '<button type="button" data-pcr="imprimir" class="pcr-mini pcr-llevar-b">' +
            ico('imprimir') + 'Informe en hojas</button>' +
          '<button type="button" data-pcr="lamina" class="pcr-mini pcr-llevar-b"' +
            (S.pdfArmando ? ' disabled' : '') + '>' + ico('documento') +
            (S.pdfArmando ? 'Armando el PDF…' : 'Lámina 60×90 · PDF') + '</button>' +
          '' +
          '<button type="button" data-pcr="lamina-h" class="pcr-mini pcr-llevar-b"' +
            (S.pdfArmando ? ' disabled' : '') + '>' + ico('documento') +
            (S.pdfArmando ? 'Armando el PDF…' : 'Lámina 90×60 · PDF') + '</button>' +
        '</div>' +
        '<p class="pcr-pista">La <b>lámina</b> arma un solo pliego con el plano del sector y todo lo ' +
        'medido: <b>60 × 90 cm</b> parada o <b>90 × 60 cm</b> acostada, con el mismo contenido. ' +
        '<b>Estos dos botones son los que sirven en el celular:</b> bajan un archivo que ya trae ' +
        'el tamaño del pliego escrito dentro, así que no hay que elegir papel en ninguna parte ' +
        '—se lleva el archivo al plotter y sale a 60 × 90—. Tarda unos segundos: la hoja se ' +
        'dibuja entera antes de guardarse. Lo que no mediste no sale: medí el terreno, el clima ' +
        'y el trazado antes si querés que aparezcan.</p>' +
        (S.pdfArmando
          ? '<p class="pcr-conc" id="pcr-pdf-estado">' + esc(S.pdfAviso || 'Dibujando la lámina…') + '</p>'
          : '') +
        (S.pdfError ? '<p class="pcr-error">' + esc(S.pdfError) + '</p>' : '') +
        /* ── El otro camino, el del cuadro de impresión ───────────────────
           Decían «Ver e imprimir 60×90» y prometían un tamaño que en un
           teléfono NO existe: llegó preguntado —«cuando entro al cuadro de
           impresión de Android no encuentro 60 × 90 cm»— y la pregunta es
           justa, porque el botón lo estaba anunciando.

           Android ofrece carta, oficio y tabloide y nada más. Este camino
           sirve en un computador, donde el navegador deja escribir el tamaño
           a mano y además saca la letra en VECTOR —nítida a cualquier
           aumento— en vez de una imagen. En el teléfono es para MIRAR la
           lámina antes de bajarla, no para imprimirla.

           Se dice arriba del botón y no en una nota al pie: una advertencia
           que hay que ir a buscar no es una advertencia. */
        '<p class="pcr-lab">Verla antes de bajarla</p>' +
        '<p class="pcr-pista">Esto la abre para mirarla. Si le das a imprimir desde ahí, ' +
        'el pliego pasa por el <b>cuadro de impresión del sistema</b>: en un computador podés ' +
        'escribir 60 × 90 cm a mano y sale con la letra en <b>vector</b>, más nítida; ' +
        '<b>en el teléfono ese cuadro solo tiene carta, oficio y tabloide</b> y encajará el ' +
        'pliego en una hoja. Para imprimir desde el celular usá los botones de arriba: ' +
        'el archivo ya sale con el pliego escrito dentro y no hay que elegir papel.</p>' +
        '<div class="pcr-llevar">' +
          '<button type="button" data-pcr="lamina-ver" class="pcr-mini">' + ico('ojo', 16) +
            'Ver la lámina parada</button>' +
          '<button type="button" data-pcr="lamina-ver-h" class="pcr-mini">' + ico('ojo', 16) +
            'Ver la lámina acostada</button>' +
        '</div>' +

        /* El atajo de los «todo», pegado a los botones del pliego: encender o
           apagar todo es una decisión que se toma al final, cuando ya se sabe
           qué se midió y qué se va a entregar. */
        bloqueAntesDeExportar(res) +
        bloqueExportar() +

        // Guardar el ÁREA, no la ficha: queda en la misma lista de áreas de
        // Pro City, así que se puede volver a ella sin redibujarla y el
        // análisis de los mapeos del curso corre sobre exactamente el mismo
        // trazo que se reconoció. Es lo que junta las dos mitades.
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

        /* Decía «Listo», al final de catorce metros de informe, y cerraba la
           hoja. Quien llega ahí acaba de leerlo todo y lee «Listo» como «ya
           terminé de leer»: lo toca, la hoja se va, y desde afuera parece que
           el análisis se perdió. Llegó dicho así —«si le doy a Listo me saca
           del análisis y me toca volver a la lupita»—.

           No se quita el botón: hace falta una salida al final. Se le pone el
           nombre de lo que hace, y debajo, en una línea, qué pasa con el
           análisis y por dónde se vuelve. */
        '<button type="button" data-pcr="cerrar" class="pcr-principal pcr-secundario">' +
          ico('mapa', 16) + 'Cerrar y ver el mapa</button>' +
        '<p class="pcr-pista pcr-pista-cerrar">El análisis <b>no se pierde</b>: la hoja se baja para ' +
        'dejar ver el mapa y vuelve con el botón <b>«Volver al análisis»</b>, abajo a la izquierda. ' +
        'Y queda archivado en la pestaña «Sector» aunque cierres la aplicación.</p>' +
      '</div>';
  }

  // ── El análisis ───────────────────────────────────────────────────────
  async function analizar() {
    if (S.cargando || !listoParaAnalizar()) return;
    /* También acá y no solo al abrir la hoja: el área se puede cambiar sin
       cerrarla —otro radio, otra forma, el lote— y entonces `abrir` no vuelve
       a pasar. */
    if (revisarCambioDeArea(huellaDelArea(S.forma, S.poligono, S.centro, S.radioM), false)) {
      pintar(); return;
    }
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

      /* El MISMO centro que se dibujó. Antes esta línea leía `S.centro`
         directamente y el círculo salía de otra cuenta: en modo lote podían
         ser dos sitios distintos. */
      var ejeConsulta = centroDeAnalisis();
      var elementos = esPol
        ? await window.AIA_DATOS.consultarEntornoPoligono(S.poligono)
        : await window.AIA_DATOS.consultarEntorno(ejeConsulta.lat, ejeConsulta.lng, S.radioM);

      // El censo NO depende de lo que OpenStreetMap tenga mapeado: viene del
      // DANE. Es la mitad del análisis que siempre está completa, y por eso
      // conviene que el estudiante la vea incluso en un sector sin datos. Si
      // falla (sin red, o fuera de cobertura), el análisis sigue: se pierde la
      // población, no la ficha.
      var eje = ejeConsulta;
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
      // De dónde salió el punto que se acaba de consultar, congelado acá: lo
      // que valga después no es lo que se preguntó.
      S.centroDeAnalizado = origenDelCentro();
      S.sectorAnclado = anclaDelSector();
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
      S.fichaActualId = 'f' + Date.now();
      guardarFichaViva();
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
      'h3{font-size:11.5px;margin:12px 0 4px;color:#0A6F9E;letter-spacing:.02em}' +
      '.kpis{display:flex;gap:22px;margin:0 0 6px;flex-wrap:wrap}' +
      '.kpi b{display:block;font-size:19px;color:#0A6F9E}' +
      '.kpi small{color:#5a6472;font-size:11px}' +
      '.kpi.oro b{color:#8a6400}' +
      '.check{margin:0;padding-left:18px;list-style:none}' +
      '.check li{margin-bottom:5px}' +
      '.check li:before{content:"☐  ";color:#9aa7b4}' +
      '.nota{margin-top:24px;padding:10px 12px;background:#f4f7fa;border:1px solid #e2e8f0;' +
        'border-radius:6px;font-size:11.5px;color:#4a5568}' +
      /* Las redes, al pie: a la derecha y separadas por una raya fina, para
         que se lean como firma y no como una línea más del informe. */
      '.redes{display:flex;justify-content:flex-end;align-items:center;gap:16px;margin-top:18px;' +
        'padding-top:8px;border-top:1px solid #c7e7f7;color:#075E88;font-size:11px;letter-spacing:.04em}' +
      '.redes .red{display:inline-flex;align-items:center;gap:5px}' +
      '.redes .sitio{margin-right:auto;color:#6B7A8A}' +
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
      '<p class="redes"><span class="sitio">URBIS · urbispro.city</span>' + pieRedes(15) + '</p>' +
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
      /* Las manzanas se guardan además de pintarse: la lámina las necesita
         para dibujar su propio mapa de estratos, y volver a pedírselas al
         DANE para imprimir sería cobrar dos veces la misma consulta. */
      manzanas: r.manzanas || [],
      leyenda: '<div class="pcr-leyenda"><b>Estratificación DANE · ' + r.n + ' manzanas</b>' +
        presentes.map(function (n) {
          return '<span><i style="background:' + ((r.colores && r.colores[n]) || '#6b7280') + '"></i>' +
                 (n ? n : 'S/E') + '</span>';
        }).join('') +
        '<em>S/E = sin estrato (industrial, dotacional o lotes)</em></div>'
    };
    S.aviso = 'Estratos pintados. Cerrá esta hoja para verlos.';
    pintar();
    try { guardarFichaViva(); } catch (e) {}
  }

  // ── Entrada y salida ──────────────────────────────────────────────────
  /* La huella del área analizada, para saber si la que hay ahora es la misma.
     Con los vértices redondeados: mover el mapa un metro no es cambiar de
     sector. */
  /* ── Seguir donde se quedó ─────────────────────────────────────────────
     El análisis vive en memoria. Sobrevive a cerrar la hoja —eso ya estaba—
     pero no a que se recargue la pestaña, y en un teléfono con la aplicación
     abierta una hora caminando, eso pasa. Hasta ahora el estudiante volvía y
     se encontraba con la pantalla del principio: su sector estaba archivado,
     pero como una ficha de lectura, y para seguir trabajando había que volver
     a consultar la red y esperar al limitador.

     Esto lo devuelve entero. Lo único que no vuelve son las huellas de los
     edificios: son miles de polígonos que no caben en el almacenamiento de un
     teléfono, y por eso no se guardan. Se dice, no se disimula. */
  function reanudarFicha(f) {
    if (!f) return false;
    var A = window.URBIS_PC_ANALISIS;

    // 1 · El área. Sin esto, la hoja descarta el resultado apenas se abre:
    //     compara la huella del área elegida con la del análisis y no coinciden.
    if (f.forma === 'poligono' && f.poligono && f.poligono.length >= 3) {
      var pol = f.poligono.map(function (p) { return { lat: p.lat, lng: p.lng }; });
      try {
        if (A && A.iniciarDibujo) {
          A.iniciarDibujo();
          pol.forEach(function (p) { A.agregarPunto(p.lat, p.lng); });
          // Tocar la primera esquina otra vez es lo que cierra el área.
          A.agregarPunto(pol[0].lat, pol[0].lng);
        }
      } catch (e) {}
      S.forma = 'poligono'; S.poligono = pol;
      S.centro = centroideDe(pol);
      S.centroDe = 'ficha';
    } else if (f.centro && f.centro.lat != null) {
      S.forma = f.forma === 'lote' ? 'lote' : 'radio';
      S.centro = { lat: f.centro.lat, lng: f.centro.lng };
      S.centroDe = 'ficha';
      S.radioM = f.radioM || RADIO_POR_DEFECTO;
    } else {
      return false;
    }

    // 2 · El análisis y sus zonas, reconstruidos de lo guardado.
    S.resultado = comoResultado(f);
    S.ultimasZonas = comoZonas(f);
    S.huellaAnalizada = huellaDelArea(S.forma, S.poligono, S.centro, S.radioM);
    // Y el ancla: lo retomado pertenece al lugar de la ficha, no al último
    // sitio que se hubiera mirado en el mapa.
    S.sectorAnclado = anclaDelSector();
    S.fichaActualId = f.id || '';
    S.nombreGuardado = f.nombre || '';
    // El origen es del análisis que se archivó, no del estado de ahora.
    S.centroDeAnalizado = f.centroDe || 'ficha';

    // 3 · Todo lo que se midió aparte.
    S.trazado = f.trazado || null;
    S.terreno = f.terreno || null;
    S.terRejilla = f.terrenoRejilla || null;
    S.clima = f.clima || null;
    S.amenaza = f.amenaza || null;
    S.inundacion = f.inundacion || null; S.inundacionAviso = '';
    // Las cifras de la evolución vuelven; las estampas hay que volver a
    // pedirlas, que es lo que se decidió al archivarlas.
    S.evo = f.evo || null; S.evoAviso = ''; S.evoCargando = '';
    S.campo = f.campo || null;
    S.caminata = f.caminata || null;
    S.intangible = (f.intangible || []).slice();
    /* Y los del curso. `rehacerUnion` se llama después de repartir todo el
       estado: la unión se calcula a partir del propio recorrido MÁS los
       traídos, así que hacerla antes de tener los dos daría una unión de la
       mitad. */
    S.intCurso = (f.intCurso || []).slice();
    S.intUnion = null;
    S.pliegoOff = (f.pliegoOff || []).slice();
    S.pliegoMapasOff = (f.pliegoMapasOff || []).slice();
    S.indices = f.indices || null;
    S.indicesPuestos = f.indicesPuestos || null;
    S.indicesFuente = f.indicesFuente || null;
    S.pliegoCabe = null;
    S.lote = (f.lote && f.lote.length >= 3)
      ? f.lote.map(function (p) { return { lat: p.lat, lng: p.lng }; }) : null;

    /* Lo que NO vuelve, y hay que dejarlo explícitamente en cero para que la
       hoja no crea que lo tiene: la geometría cruda del trazado. De ahí salen
       los llenos y vacíos, las sombras y el grafo por el que se camina. */
    S.trzHuellas = null; S.trzPisos = null; S.trzVias = null;
    S.sombras = null; S.curvas = null;
    S.cobertura = null; S.cobEnMapa = false;
    S.calor = [];
    /* Las manzanas por estrato SÍ vuelven, pintadas de lo guardado y sin
       pedir nada: es lo que había en el mapa cuando se archivó, y lo que el
       pliego reimpreso necesita para su mapa de estratos. Van acá, después
       de la limpieza, porque antes se restauraban y esta misma línea las
       borraba. */
    S.estratos = (f.estratos && f.estratos.manzanas && f.estratos.manzanas.length) ? f.estratos : null;
    if (S.estratos) { try { pintarEstratos(true, S.estratos); } catch (e) {} }

    S.error = ''; S.aviso = '';
    try { pintarCirculo(); } catch (e) {}
    try { pintarLote(); } catch (e) {}
    try { if (S.intangible.length) pintarIntangible(true); } catch (e) {}
    /* La unión se rehace acá y no al repartir el estado: se calcula con el
       recorrido propio MÁS los del curso, así que hacerla antes de tener los
       dos daría los acuerdos de la mitad de la clase. */
    try { if (S.intCurso.length) rehacerUnion(); } catch (e) {}
    /* Y el trazo que estaba a medias cuando el navegador se llevó la pestaña.
       Va al final, cuando la huella del sector ya está puesta: es lo que le
       deja comprobar que el trazo es de ESTE barrio. */
    try { recuperarTrazoVivo(); } catch (e) {}
    /* Y los usos, otra vez sobre el mapa.

       Se guardan con la ficha desde siempre —posición, categoría y nombre—
       pero al retomar un sector se repintaban el círculo, el lote y las
       marcas, y los puntos no: volvía el contorno de un sector vacío. Llegó
       dicho así: «cuando entro a un análisis viejo no salen los puntos de los
       usos, deberían guardarse también». Estaban guardados; faltaba
       dibujarlos.

       Si la ficha se archivó sin ellos por falta de espacio —lo dice
       `sinPuntos`— no hay nada que pintar y el informe ya lo advierte
       arriba. */
    try {
      var pois = (S.resultado && S.resultado.pois) || [];
      S.puntosEnMapa = pois.length ? pintarPuntos(pois) : 0;
    } catch (e) {}
    return true;
  }

  /* La tarjeta que lo ofrece. Solo aparece cuando NO hay análisis en memoria:
     con uno en pantalla sería una invitación a tirarlo. */
  function bloqueReanudar() {
    if (S.resultado) return '';
    var fichas = [];
    try { fichas = leerFichas() || []; } catch (e) { return ''; }
    if (!fichas.length) return '';
    var f = fichas[0];
    if (!f || !f.stats) return '';

    var medido = [];
    if (f.trazado) medido.push('el trazado');
    if (f.terreno) medido.push('el terreno');
    if (f.clima) medido.push('el clima');
    if (f.amenaza) medido.push('la amenaza');
    if (f.lote) medido.push('el lote');
    if (f.intangible && f.intangible.length) {
      medido.push(f.intangible.length + ' marca' + (f.intangible.length === 1 ? '' : 's') +
                  ' de lo intangible');
    }

    var cuando = '';
    try {
      var dias = Math.floor((Date.now() - new Date(f.ts).getTime()) / 86400000);
      cuando = dias <= 0 ? 'de hoy' : dias === 1 ? 'de ayer' : 'de hace ' + dias + ' días';
    } catch (e) {}

    return '<div class="pcr-medir pcr-reanudar">' +
      '<p class="pcr-lab">Seguir donde quedaste</p>' +
      '<p class="pcr-conc"><b>' + esc(f.nombre || 'Sector sin nombre') + '</b>' +
      (cuando ? ' · ' + esc(cuando) : '') + ' · ' + (f.total || 0) + ' usos' +
      (medido.length ? ', con ' + esc(medido.join(', ')) : '') + '.</p>' +
      '<p class="pcr-pista">Vuelve el sector entero sin consultar la red otra vez. Lo único ' +
      'que no vuelve son las huellas de los edificios —son miles de polígonos y no caben en el ' +
      'teléfono—, así que para los llenos y vacíos y las sombras hay que volver a medir el ' +
      'trazado.</p>' +
      '<div class="pcr-llevar">' +
        '<button type="button" data-pcr="reanudar" data-id="' + esc(f.id || '') +
          '" class="pcr-principal">' + ico('atras', 16) + 'Seguir con este sector</button>' +
      '</div>' +
    '</div>';
  }

  function huellaDelArea(forma, poligono, centro, radioM) {
    if (forma === 'poligono' && poligono && poligono.length >= 3) {
      return 'p|' + poligono.map(function (p) {
        return p.lat.toFixed(5) + ',' + p.lng.toFixed(5);
      }).join(';');
    }
    if (centro) return 'r|' + centro.lat.toFixed(5) + ',' + centro.lng.toFixed(5) + '|' + radioM;
    return '';
  }

  /* La hoja plantada: el área cambió, hay trabajo a mano, y el archivado
     había fallado. Seguir sería borrar lo único que no se puede volver a
     pedir a ningún servidor. Se para y se pregunta, que es lo que hay que
     hacer cuando la respuesta correcta depende de algo que la aplicación no
     sabe: si esa tarde de campo importa o no. */
  function bloqueTraba() {
    var t = S.trabaDescartar;
    if (!t) return '';
    var piezas = [];
    if (t.marcas) piezas.push(t.marcas + (t.marcas === 1 ? ' marca tuya' : ' marcas tuyas'));
    if (t.curso) piezas.push(t.curso + (t.curso === 1 ? ' recorrido traído' : ' recorridos traídos'));
    if (t.lote) piezas.push('el lote');
    if (t.indices) piezas.push('los índices del POT');
    if (t.campo) piezas.push('lo levantado en campo');
    return '<div class="pcr-medir pcr-traba">' +
      '<p class="pcr-lab">Antes de cambiar de área</p>' +
      '<p class="pcr-conc">Este sector <b>no se pudo guardar</b> —no hay espacio en el teléfono— y ' +
      'tiene ' + esc(listaEnTexto(piezas)) + '. Si seguís con el área nueva, eso se pierde: ' +
      'no está archivado en ninguna parte.</p>' +
      '<div class="pcr-llevar">' +
        '<button type="button" data-pcr="int-exportar" class="pcr-mini pcr-llevar-b">' +
          ico('compartir', 16) + 'Sacar mi recorrido a un archivo</button>' +
        '<button type="button" data-pcr="traba-descartar" class="pcr-mini">' +
          ico('borrar', 16) + 'Descartarlo y seguir</button>' +
      '</div>' +
      '<p class="pcr-pista">También podés hacer sitio borrando sectores guardados desde la ' +
      'pestaña «Sector» y volver a intentarlo.</p>' +
    '</div>';
  }

  /* ¿El área que está elegida es la misma del trabajo que hay en memoria?

     La guarda vivía dentro de `abrir` y pedía además que hubiera un resultado
     cargado. Medido: por eso el botón «Analizar otro sector» la esquivaba —
     suelta el resultado y dejaba la huella en blanco—, y la marca de un
     sector aparecía archivada en la ficha del siguiente, a trescientos metros,
     como si alguien la hubiera caminado ahí. Un dato de percepción atribuido
     a un barrio donde nadie estuvo es peor que no tener el dato.

     Ahora manda la HUELLA sola: es lo que dice a qué sector pertenece lo que
     hay en memoria, con o sin análisis cargado encima. */
  function revisarCambioDeArea(ahora, areaBorrada) {
    if (!S.huellaAnalizada) return false;
    if (ahora === S.huellaAnalizada && !areaBorrada) return false;

    /* Cambió el encuadre. La pregunta que decide qué se borra no es esa sino
       la otra: ¿es OTRO SITIO?

       Se separan porque son dos cosas distintas. El análisis pertenece a una
       huella —otro radio, otra forma, otro polígono y las cuentas ya no son
       de eso—, así que se suelta siempre. Lo que la persona puso a mano
       pertenece a un LUGAR: si marca el lote dentro del área que acababa de
       analizar, sus marcas siguen siendo de ese barrio.

       La primera versión de esta guarda usaba solo la huella, y con eso pasar
       de «área dibujada» a «lote» en el mismo sitio borraba el lote que la
       estudiante acababa de dibujar. Que es justo lo que la guarda existía
       para impedir, hecho por la guarda. */
    if (!esOtroSitio()) { soltarElAnalisis(); return false; }

    var hecho = trabajoAMano();
    /* Si el sector anterior NO se pudo archivar, borrarlo es perderlo de
       verdad. Se para: la hoja se queda donde está y dice por qué, con la
       salida a la mano. Es el único caso en que cambiar de área destruye
       algo, y hasta v706 ni siquiera se sabía que podía pasar. */
    if (hecho.hay && S.avisoGuardado) { S.trabaDescartar = hecho; return true; }
    descartarSectorAnterior(hecho);
    return false;
  }

  /* ¿El punto que se va a consultar ahora cae fuera del sector que se
     analizó? Se compara contra el ALCANCE de aquel sector —su radio, o la
     distancia del centro a la esquina más lejana del área— porque eso es lo
     que se recorrió: un lote dibujado dentro del área que se acaba de
     estudiar está en el mismo barrio; un área a un kilómetro y medio, no. */
  function esOtroSitio() {
    var a = S.sectorAnclado;
    if (!a || !isFinite(a.lat)) return true;
    var c = centroDeAnalisis();
    if (!c || !isFinite(c.lat)) return true;
    return distanciaM(c, a) > (a.alcanceM || 0);
  }

  function distanciaM(a, b) {
    var R = 6371000, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r;
    var dLng = (b.lng - a.lng) * r * Math.cos((a.lat + b.lat) / 2 * r);
    return Math.sqrt(dLat * dLat + dLng * dLng) * R;
  }

  /* Hasta dónde llegaba el sector que se analizó. Es lo que se ancla al
     terminar un análisis, y contra lo que se mide si el siguiente es otro
     sitio. */
  function anclaDelSector() {
    var c = centroDeAnalisis();
    if (!c || !isFinite(c.lat)) return null;
    var alcance = S.radioM || 500;
    if (S.forma === 'poligono' && S.poligono && S.poligono.length >= 3) {
      alcance = 0;
      S.poligono.forEach(function (p) { alcance = Math.max(alcance, distanciaM(p, c)); });
    }
    return { lat: c.lat, lng: c.lng, alcanceM: Math.max(120, alcance) };
  }

  /* Soltar el ANÁLISIS y nada más: las cuentas eran de una huella que ya no
     está elegida. Lo que la persona puso a mano se queda, porque es del
     lugar. Es lo que hace el botón «Analizar otro sector», y lo que hace
     cambiar el encuadre del mismo sitio: una sola función para los dos, que
     antes eran dos listas copiadas que se iban separando. */
  function soltarElAnalisis() {
    S.resultado = null; S.trazado = null; S.terreno = null; S.terRejilla = null; S.curvas = null;
    S.cobertura = null; S.cobEnMapa = false; S.calor = []; S.encogida = false;
    S.trzHuellas = null; S.trzPisos = null; S.trzVias = null; S.sombras = null;
    try { pintarLlenosFoto(false); } catch (e) {} S.llenosFoto = null;
    /* El nombre y lo medido para el sector se van con el análisis, aunque el
       lugar sea el mismo: pertenecen a la FICHA, y analizar otra huella hace
       una ficha nueva. Dejarlos pasar es el error que ya se cometió una vez
       —el sector siguiente quedaba archivado con el nombre del anterior y con
       SU climatología, del sitio de al lado— y que no se nota mirando la
       ficha: se nota meses después, cuando los datos ya no se pueden creer.
       Lo probó la suite de la lámina en cuanto lo rompí otra vez. */
    S.clima = null; S.cliAviso = ''; S.campo = null;
    S.amenaza = null; S.amenazaAviso = '';
    S.nombreGuardado = ''; S.nombreSugerido = '';
    S.terAviso = ''; S.trzAviso = '';
    pintarLlenos(false);
    try {
      var A5 = window.URBIS_PC_ANALISIS;
      if (A5 && typeof A5.quitarRaster === 'function') A5.quitarRaster();
    } catch (e) {}
  }

  /* Lo que el estudiante puso a mano y ningún servidor puede devolver. Se
     cuenta antes de borrar nada: es la diferencia entre «se descartó un
     análisis» y «se perdió una tarde de campo». */
  function trabajoAMano() {
    var I = IN();
    var marcas = 0;
    try { marcas = (S.intangible || []).filter(I ? I.valida : function () { return true; }).length; }
    catch (e) { marcas = (S.intangible || []).length; }
    var t = {
      marcas: marcas,
      curso: (S.intCurso || []).length,
      lote: !!(S.lote && S.lote.length >= 3),
      indices: !!(S.indicesPuestos && Object.keys(S.indicesPuestos).length),
      campo: !!(S.campo && (S.campo.nuevos || []).length)
    };
    t.hay = !!(t.marcas || t.curso || t.lote || t.indices || t.campo);
    return t;
  }

  /* Soltar el sector anterior porque se eligió otra área.

     Lo hacía en silencio: cuarenta recorridos del curso, las marcas de una
     tarde y el lote desaparecían de la pantalla sin una palabra. Medido: la
     ficha SÍ queda archivada y se puede volver a ella desde la pestaña
     «Sector», pero eso no se dice en ninguna parte, así que para quien lo
     está mirando es indistinguible de haberlo perdido. */
  function descartarSectorAnterior(hecho) {
    var comoSeLlamaba = S.nombreGuardado || '';
    S.resultado = null; S.huellaAnalizada = ''; S.trazado = null; S.terreno = null; S.terRejilla = null; S.curvas = null;
      /* El clima y el nombre también. Se quedaron fuera de esta lista la
         primera vez y el resultado era feo de encontrar: como el análisis
         siguiente se guarda solo, el sector nuevo quedaba archivado con el
         nombre del anterior y con SU climatología —del sitio de al lado o de
         otro barrio— pegada encima. Nadie lo nota mirando la ficha; se nota
         meses después, cuando los datos ya no se pueden creer. */
    S.clima = null; S.nombreGuardado = ''; S.nombreSugerido = ''; S.campo = null;
    S.trzVias = null;
      // El lote pertenece al sector que se estaba mirando. Con otro sector es
      // un polígono huérfano flotando en un mapa que ya no es el suyo.
    S.lote = null; S.loteDibujando = false; S.caminata = null; S.sombras = null;
      /* Las marcas pertenecen al sector que se caminó. En otro sector serían
         manchas de color sobre un barrio donde nadie estuvo. */
    S.intangible = []; S.intDibujando = false; S.intPts = null; S.intTipo = '';
    pintarIntangible(false);
    S.intCurso = []; S.intUnion = null; S.intCursoAviso = '';
    pintarAcuerdos(false);
      // La composición del pliego era de ESE sector: qué apagar depende de
      // qué se midió, y en el sector nuevo no se midió nada todavía.
    S.pliegoOff = APAGADAS_DE_ENTRADA.slice(); S.pliegoMapasOff = []; S.pliegoCabe = null;
    S.amenaza = null; S.amenazaAviso = '';
    S.indices = null; S.indicesPuestos = null; S.indicesFuente = null;
    pintarCaminata(false); pintarLote();
    S.cobertura = null; S.cobEnMapa = false; S.calor = [];
    S.trzHuellas = null; S.trzPisos = null; pintarLlenos(false);
    S.trabaDescartar = null;
    S.sectorAnclado = null;
    // El borrador del lápiz era de aquel sector, no de este.
    olvidarTrazoVivo();

    // Y se dice adónde fue a parar, con las cifras de lo que había.
    if (hecho && hecho.hay) {
      var piezas = [];
      if (hecho.marcas) piezas.push(hecho.marcas + (hecho.marcas === 1 ? ' marca tuya' : ' marcas tuyas'));
      if (hecho.curso) piezas.push(hecho.curso + (hecho.curso === 1 ? ' recorrido traído' : ' recorridos traídos'));
      if (hecho.lote) piezas.push('el lote');
      if (hecho.indices) piezas.push('los índices del POT');
      if (hecho.campo) piezas.push('lo levantado en campo');
      S.aviso = 'Cambiaste de área, así que la hoja arranca de cero. ' +
        (comoSeLlamaba ? '«' + comoSeLlamaba + '»' : 'El sector anterior') +
        ' quedó guardado con ' + listaEnTexto(piezas) +
        ': está en la pestaña «Sector», y con «Retomar» volvés a trabajarlo.';
    }
  }

  // «a, b y c». Se escribe una vez acá y no en cada aviso.
  function listaEnTexto(xs) {
    if (!xs.length) return '';
    if (xs.length === 1) return xs[0];
    return xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1];
  }

  function abrir() {
    if (!mapa()) { alert('El mapa aún no está listo.'); return; }
    prepararArrastre();
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
    revisarCambioDeArea(ahora, areaBorrada);
    if (!S.centro) tomarCentro();
    /* Cuánto mapa hay guardado se cuenta al abrir y no al pintar: el depósito
       lo puede vaciar el navegador por su cuenta cuando le falta espacio, así
       que recordarlo sería mentir, y contarlo en cada repintado sería contar
       mil archivos treinta veces por minuto. */
    try { medirTeselas(); } catch (e) {}
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
      el.addEventListener('click', function (ev) {
        /* Plegarlo. El aviso vive encima del mapa y estorba justo cuando se
           está haciendo otra cosa —«así no molesta cuando entre en otras
           cosas»—, pero borrarlo del todo devolvería el problema que vino a
           resolver: con la hoja cerrada, el análisis sigue en memoria y sin
           esto no hay una sola señal de que exista.

           Plegado no desaparece: queda el disco con el icono, en el mismo
           sitio, y un toque lo vuelve a abrir. Y se recuerda, porque quien lo
           plegó no quiere volver a plegarlo cada vez que cierra la hoja. */
        if (S.volverPlegado) { ponerPlegado(false); return; }
        if (ev && ev.target && ev.target.closest && ev.target.closest('[data-plegar]')) {
          ponerPlegado(true); return;
        }
        /* Sin análisis en memoria, el botón TRAE el de hace un rato antes de
           abrir: es lo que se está pidiendo al tocarlo. */
        if (!S.resultado) {
          var f = fichaRecienViva();
          if (f) {
            if (reanudarFicha(f)) {
              S.aviso = 'Listo, seguimos con «' + (f.nombre || 'el sector') + '». Si necesitás ' +
                        'llenos y vacíos o sombras, volvé a medir el trazado.';
            } else {
              S.error = 'Ese sector no guarda el área: no se puede reanudar.';
            }
          }
        }
        S.encogida = false; abrir();
      });
      document.body.appendChild(el);
    }
    return el;
  }

  /* El sector que estaba vivo hace un rato, si el navegador se llevó la
     pestaña.

     Dicho así: «me salgo de la aplicación, vuelvo, y se resetea todo, como si
     no se guardara lo que estoy haciendo». No se perdía nada —está archivado
     y vuelve entero sin red— pero el mapa aparecía vacío, sin puntos, sin
     círculo y sin lote, y para encontrar el sector había que abrir la lupa y
     buscar la tarjeta de adentro. Desde afuera eso es indistinguible de
     haberlo perdido.

     Media hora: es el tiempo en el que «estaba trabajando en esto» sigue
     siendo cierto. Pasado eso el botón no insiste —el mapa limpio es lo
     correcto cuando se abre la aplicación otro día— y la tarjeta de la hoja
     sigue ofreciéndolo igual. */
  var VIVO_MS = 30 * 60 * 1000;
  function fichaRecienViva() {
    if (S.resultado) return null;
    var f;
    try { f = (leerFichas() || [])[0]; } catch (e) { return null; }
    if (!f || !f.stats) return null;
    var t = 0;
    try { t = new Date(f.ts).getTime(); } catch (e) { t = 0; }
    if (!t || Date.now() - t > VIVO_MS) return null;
    return f;
  }

  var LLAVE_PLEGADO = 'pcr_volver_plegado';
  function ponerPlegado(x) {
    S.volverPlegado = !!x;
    try { localStorage.setItem(LLAVE_PLEGADO, x ? '1' : '0'); } catch (e) {}
    pintarVolver();
  }
  (function () {
    try { S.volverPlegado = localStorage.getItem(LLAVE_PLEGADO) === '1'; } catch (e) {}
  })();

  function pintarVolver() {
    var el = volverBtn();
    var fuera = !S.abierto && !!window.urbisProCityActivo;
    var reciente = fuera ? fichaRecienViva() : null;
    var hay = fuera && (!!S.resultado || !!reciente);
    el.hidden = !hay;
    el.classList.toggle('pcr-volver-plegada', !!S.volverPlegado);
    if (!hay) return;
    if (!S.resultado && reciente) {
      var med = [];
      if (reciente.trazado) med.push('el trazado');
      if (reciente.terreno) med.push('el terreno');
      if (reciente.lote) med.push('el lote');
      el.innerHTML = ico('atras', 18) +
        '<span><b>Seguir donde quedaste</b>' +
        '<small>' + esc(reciente.nombre || 'Sector sin nombre') + ' · ' +
        (reciente.total || 0) + ' usos' + (med.length ? ', con ' + esc(med.join(', ')) : '') +
        '</small></span>' + asaPlegar();
      el.setAttribute('aria-label', S.volverPlegado
        ? 'Abrir el aviso del sector que estabas analizando'
        : 'Seguir con el sector que estabas analizando');
      return;
    }
    var st = (S.resultado.stats) || {};
    var nombre = (S.nombreGuardado || '').trim();
    el.innerHTML = ico('lupa', 18) +
      '<span><b>' + esc(nombre || 'Volver al análisis') + '</b>' +
      '<small>' + (st.total || 0) + ' usos · ' +
      (S.resultado.meta && S.resultado.meta.forma === 'poligono'
        ? esc(formatearArea(S.resultado.meta.areaM2) || 'área dibujada')
        : (S.radioM >= 1000 ? (S.radioM / 1000) + ' km' : S.radioM + ' m')) +
      '</small></span>' + asaPlegar();
    el.setAttribute('aria-label', S.volverPlegado
      ? 'Abrir el aviso del análisis del sector'
      : 'Volver al análisis del sector, sin repetirlo');
  }

  /* El asa. Plegado no se pinta: el disco entero ES el asa, y meterle un
     segundo blanco de toque de dieciséis píxeles dentro de uno de cuarenta
     es la forma de que ninguno de los dos se acierte con el pulgar. */
  function asaPlegar() {
    return S.volverPlegado ? ''
      : '<i class="pcr-volver-asa" data-plegar="1" role="presentation">' + ico('chevron', 14) + '</i>';
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

  /* «Lo más repetido»: los usos concretos, no la categoría. Es lo que un
     estudiante va a ver en la calle —seis peluquerías, cuatro papelerías— y
     lo que hace que una categoría abstracta signifique algo.

     Vive en su propia función porque lo pintan dos pantallas: la ficha viva
     y el informe de un sector guardado. Estaba solo en la primera, así que
     al volver a abrir un sector el bloque desaparecía sin motivo: el dato
     estaba guardado, lo que faltaba era dibujarlo. */
  function chipsMasRepetido(st) {
    var subs = Object.keys((st && st.porSub) || {})
      .map(function (s) { return { id: s, n: st.porSub[s] || 0 }; })
      .filter(function (x) { return x.n > 0 && x.id !== 'otro'; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, 8);
    if (!subs.length) return '';
    var TAX = (window.AIA_MOTOR && window.AIA_MOTOR.TAXONOMIA) || [];
    return subs.map(function (x) {
      var t = TAX.filter(function (u) { return u.sub === x.id; })[0];
      return '<span class="pcr-chip">' + (t && t.icono ? icoCat(t.icono, 13) : '') +
             esc(t ? t.nombre : x.id) + ' <b>' + x.n + '</b></span>';
    }).join('');
  }

  function informeGuardado(f) {
    var st = f.stats;
    // El bloque del trazado lee S.trazado; para pintar el de una ficha
    // guardada se le presta el suyo y se devuelve el estado como estaba.
    var trzAntes = S.trazado, terAntes = S.terreno, cliAntes = S.clima, cmpAntes = S.campo;
    var amAntes = S.amenaza;
    var loteAntes = S.lote, rejAntes = S.terRejilla;
    var curAntes = S.intCurso, uniAntes = S.intUnion, intAntes = S.intangible;
    var idxAntes = S.indices, pusAntes = S.indicesPuestos, fteAntes = S.indicesFuente;
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
      /* Un sector que se guardó sin sus puntos por falta de espacio lo dice
         acá arriba. Sin este aviso, el mapa de calor sale vacío y las cifras
         llenas, y la lectura obvia —«en este barrio no hay nada»— es falsa:
         los usos se contaron, lo que no cupo fue la lista. */
      (f.sinPuntos
        ? '<p class="pcr-pista">Este sector se guardó sin sus ' + f.sinPuntos + ' usos: no había ' +
          'espacio en el teléfono. Las cuentas son las del análisis, pero para volver a ver los ' +
          'puntos en el mapa hay que analizarlo otra vez.</p>'
        : '') +
      '<div class="pcr-kpis">' +
        '<div class="pcr-kpi"><b>' + (st.total || 0) + '</b><small>usos registrados</small></div>' +
        '<div class="pcr-kpi"><b>' + esc(tam) + '</b><small>' + (esPol ? 'área' : 'alcance') + '</small></div>' +
        '<div class="pcr-kpi"><b>' + (st.densidadPorHa != null ? Number(st.densidadPorHa).toFixed(1) : '—') +
          '</b><small>por hectárea</small></div>' +
      '</div>' +
      bloqueDondeSeMidio(f.centroDe, comoResultado(f).meta) +
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
      (function () {
        var ch = chipsMasRepetido(st);
        return ch ? h4('porcentaje', 'Lo más repetido') + '<div class="pcr-chips">' + ch + '</div>' : '';
      })() +
      bloqueUsoPredominante(st) +
      (function () {
        // Con el trazado guardado, las alturas salen de su muestra —la
        // completa— igual que en la ficha viva.
        S.trazado = f.trazado || null;
        S.terreno = f.terreno || null;
        S.clima = f.clima || null;
        S.amenaza = f.amenaza || null;
        S.inundacion = f.inundacion || null;
        S.campo = f.campo || null;
        S.lote = f.lote || null;
        S.terRejilla = f.terrenoRejilla || null;
        /* Los recorridos del curso también se prestan, y el acuerdo se vuelve
           a calcular con ellos: guardarlo ya calculado ocuparía más y se
           quedaría viejo en cuanto cambiara la forma de unirlos. */
        S.intCurso = f.intCurso || [];
        S.intUnion = null;
        /* Los índices también se prestan. Sin esto, «qué cabe» de un sector
           archivado se calculaba con los índices que hubiera en memoria —los
           de otro lote, o los de ejemplo— y los mostraba como suyos. */
        S.indices = f.indices || null;
        S.indicesPuestos = f.indicesPuestos || null;
        S.indicesFuente = f.indicesFuente || null;
        /* Por la misma función que lo arma en vivo —`rehacerUnion`— y no por
           una cuenta paralela: dos caminos calculando el mismo acuerdo es
           cómo se llega a que la ficha guardada diga un número y la viva
           diga otro. */
        S.intangible = f.intangible || [];
        try { rehacerUnion(); } catch (e) { S.intUnion = null; }
        var html = bloqueAlturas(st) + (f.terreno ? bloqueTerreno() : '') +
                   (f.clima ? bloqueClima() : '') +
                   (f.amenaza ? bloqueAmenaza() : '') +
                   (f.trazado ? bloqueTrazado() : '') +
                   (f.trazado ? bloquePerfil() : '') +
                   (f.trazado ? bloqueEspacio(st) : '') + bloqueAccesibilidad(st) +
                   (f.loteAnalisis ? bloqueLoteIntervenir(f.loteAnalisis, true) : '') +
                   (f.caminata ? bloqueCaminata(f.caminata, true) : '') +
                   (f.loteAnalisis ? bloqueQueCabe(true) : '') +
                   ((f.intangible && f.intangible.length)
                     ? bloqueIntangible(f.intangible, true, {
                         areaSectorM2: f.areaM2 || 0, lote: f.lote,
                         pois: f.pois || [], hayCaminata: !!f.caminata }) : '') +
                   (f.campo ? bloqueCampo() : '') +
                   bloqueSintesis(comoResultado(f));
        S.trazado = trzAntes; S.terreno = terAntes; S.clima = cliAntes; S.campo = cmpAntes;
        S.amenaza = amAntes;
        S.lote = loteAntes; S.terRejilla = rejAntes;
        S.intCurso = curAntes; S.intUnion = uniAntes; S.intangible = intAntes;
        S.indices = idxAntes; S.indicesPuestos = pusAntes; S.indicesFuente = fteAntes;
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
      bloqueCurso() +
      bloqueCotejo() +
      fichas.map(function (f) {
        var abierta = S.pestanaAbierta === f.id;
        var enCotejo = S.cotejo.indexOf(f.id) >= 0;
        var tam = f.forma === 'poligono' ? formatearArea(f.areaM2) : ((f.radioM || 0) + ' m');
        /* La tarjeta muestra la FORMA del sector —el polígono real o el
           círculo del radio— como miniatura de mapa, no un emoji. Es lo que
           permite reconocer un sector guardado de un vistazo, como en
           cualquier app de mapas. La dibuja js/24 para que esta lista y la de
           «Áreas guardadas» se vean como la misma cosa. */
        var A = window.URBIS_PC_ANALISIS;
        /* El MISMO plano que la lista de la hoja: la silueta del sector con
           los usos que se encontraron y el lote en amarillo si se marcó.

           Acá se dibujaba solo la silueta, y era la queja: «cuando quiero
           volver a ver un sector guardado solo sale el radio azul, sin
           información y sin el polígono amarillo». Con un círculo vacío, la
           tarjeta de un sector con ochenta usos y su lote marcado se ve
           idéntica a la de un sector donde no se encontró nada. */
        var mini = miniaturaDeFicha(f, { w: 108, h: 76, clase: 'pcr-pest-mini', pelado: true });
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
          /* Va FUERA de la cabecera porque la cabecera ya es un botón, y un
             botón dentro de otro no es HTML válido: el navegador lo desarma y
             el de adentro deja de responder. */
          '<button type="button" class="pcr-cot-chip' + (enCotejo ? ' puesto' : '') + '" ' +
            'data-u52-call="pcr-cotejo" data-id="' + esc(f.id) + '" ' +
            'aria-pressed="' + (enCotejo ? 'true' : 'false') + '">' +
            ico(enCotejo ? 'ok' : 'comparar', 14) +
            (enCotejo ? 'Comparando' : 'Comparar') +
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
                    esc(f.id) + '">' + ico('imprimir') + 'Informe en hojas</button>' +
                  '<button type="button" class="pcr-mini pcr-llevar-b" data-u52-call="pcr-lamina" data-id="' +
                    esc(f.id) + '">' + ico('documento') + 'Lámina 60×90 · PDF</button>' +
                  '<button type="button" class="pcr-mini pcr-llevar-b" data-u52-call="pcr-lamina-h" data-id="' +
                    esc(f.id) + '">' + ico('documento') + 'Lámina 90×60 · PDF</button>' +
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
        /* Llevarse TODO en un archivo. Hasta acá se exportaba de a una ficha o
           de a un recorrido: al final de una salida, un profesor con el curso
           entero en el teléfono no tenía cómo archivar la jornada, y un
           teléfono que se pierde se lleva la salida completa. Medido: las doce
           fichas que caben pesan medio megabyte y el paquete se arma en dos
           milisegundos. */
        '<button type="button" class="pcr-mini" data-u52-call="pcr-respaldo">' +
          ico('exportar', 16) + 'Bajar todo en un archivo</button>' +
        '<button type="button" class="pcr-mini" data-u52-call="pcr-restaurar">' +
          ico('carpeta', 16) + 'Traer un archivo de respaldo</button>' +
        '<input type="file" id="pcr-respaldo-archivo" accept=".json,application/json" ' +
          'style="position:absolute;left:-9999px" />' +
      '</div>' +
      (S.avisoPestana ? '<p class="pcr-aviso">' + esc(S.avisoPestana) + '</p>' : '') +
      /* Si el portapapeles no funcionó —pasa en algunos navegadores de
         teléfono cuando la app no está en primer plano—, el texto queda a la
         vista para copiarlo a mano. Un «copiado» que no copió nada es peor
         que no ofrecer el botón. */
      (S.textoPlano ? '<textarea class="pcr-plano" readonly rows="8">' + esc(S.textoPlano) + '</textarea>' : '') +
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
                                   clima: f.clima || null,
                                   loteAnalisis: f.loteAnalisis || null,
                                   lote: f.lote || null,
                                   caminata: f.caminata || null,
                                   terrenoLote: (function () {
                                     try { return terrenoDelLote(f.lote, f.terrenoRejilla); }
                                     catch (e) { return null; }
                                   })(),
                                   curvas: (function () {
                                     try { return curvasDelTerreno(f.terrenoRejilla); }
                                     catch (e) { return null; }
                                   })(),
                                   // Las huellas no viajan con la ficha, así que
                                   // no hay sombras que proyectar: null y no lo
                                   // que haya en pantalla, que sería de otro
                                   // sector.
                                   sombras: null });
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
    if (name === 'cotejo') {
      alternarCotejo(id);
      repintar(); return true;
    }
    if (name === 'curso-csv') {
      var csv = cursoComoCSV();
      if (!csv) { S.avisoPestana = 'Todavía no hay puntos del curso para armar la planilla.'; repintar(); return true; }
      var puso = descargarArchivo('\ufeff' + csv, 'urbis-curso-' +
        new Date().toISOString().slice(0, 10) + '.csv', 'text/csv;charset=utf-8');
      S.avisoPestana = puso ? 'Planilla descargada.' : 'No se pudo generar la planilla en este dispositivo.';
      repintar(); return true;
    }
    if (name === 'respaldo') {
      var fichasR = leerFichas();
      if (!fichasR.length) {
        S.avisoPestana = 'Todavía no hay sectores guardados que bajar.'; repintar(); return true;
      }
      var paqR = JSON.stringify(respaldoDeTodo(fichasR));
      var kb = Math.max(1, Math.round(paqR.length / 1024));
      var listo = descargarArchivo(paqR, 'urbis-respaldo-' +
        new Date().toISOString().slice(0, 10) + '.json', 'application/json');
      S.avisoPestana = listo
        ? ('Se bajaron ' + fichasR.length + ' sector' + (fichasR.length === 1 ? '' : 'es') +
           ' en un archivo de ' + kb + ' KB. Guardalo fuera del teléfono: es la copia de la ' +
           'salida entera, con las marcas, los recorridos del curso y los lotes.')
        : 'Este navegador no dejó bajar el archivo. Copiá el texto de abajo y guardalo vos.';
      if (!listo) S.textoPlano = paqR;
      repintar(); return true;
    }
    if (name === 'restaurar') {
      try {
        var inpR = document.getElementById('pcr-respaldo-archivo');
        if (inpR) inpR.click();
      } catch (e) {}
      return true;
    }
    if (name === 'cot-limpiar') { S.cotejo = []; S.avisoPestana = ''; repintar(); return true; }
    if (name === 'cot-copiar') {
      var txtCot = cotejoComoTexto();
      if (!txtCot) return true;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txtCot);
          S.avisoPestana = 'Tabla copiada. Se pega en una hoja de cálculo con las columnas ya separadas.';
        } else { S.avisoPestana = 'Copiala del cuadro de abajo.'; }
      } catch (e) { S.avisoPestana = 'Copiala del cuadro de abajo.'; }
      S.textoPlano = txtCot;
      repintar(); return true;
    }
    if (name === 'cot-pdf') {
      var htmlCot = cotejoImprimible();
      if (!htmlCot) return true;
      abrirImpresion(htmlCot, function (m) { S.avisoPestana = m; repintar(); });
      return true;
    }
    if (name === 'lamina' || name === 'lamina-h') {
      if (!f) return true;
      // La lámina de ESTA ficha: su nombre, su terreno, su clima, su trazado.
      // Si se dejara leer el estado, un sector guardado en marzo saldría con
      // el relieve del último sector medido hoy, que es un error que nadie
      // detecta mirando la hoja impresa.
      /* Y baja como PDF del tamaño del pliego, igual que desde la ficha
         viva. Este camino se quedó con el de antes —abrir la vista de
         impresión— y por eso, desde la pestaña «Sector», el mismo botón
         seguía llevando al cuadro de papeles de Android: «le doy donde dice
         lámina y me sale la opción de PDF/imprimir». Son dos sitios que
         hacen lo mismo y tenían que hacerlo igual. */
      bajarPliegoDeFicha(f, name === 'lamina-h',
        laminaQueQuepa(comoResultado(f), {
          nombre: f.nombre || '',
          trazado: f.trazado || null, terreno: f.terreno || null,
          clima: f.clima || null, campo: f.campo || null, huellas: null,
          lote: f.lote || null, loteAnalisis: f.loteAnalisis || null,
          caminata: f.caminata || null,
          terrenoLote: (function () {
            try { return terrenoDelLote(f.lote, f.terrenoRejilla); } catch (e) { return null; }
          })(),
          curvas: (function () {
            try { return curvasDelTerreno(f.terrenoRejilla); } catch (e) { return null; }
          })(),
          sombras: null,
          intangible: f.intangible || [],
          amenaza: f.amenaza || null,
          inundacion: f.inundacion || null,
          evo: f.evo || null,
          /* Y su composición: la lámina de una ficha archivada tiene que
             salir con las cajas que tenía cuando se archivó, no con las que
             estén puestas ahora en otro sector. */
          indices: f.indices || null,
          pliegoOff: f.pliegoOff || [],
          pliegoMapasOff: f.pliegoMapasOff || [],
          /* Las fichas de antes de v743 no guardan el tamaño de letra. Se les
             da «cabe todo», que es como se compusieron: reimprimir una lámina
             vieja con la letra nueva le quitaría cajas que sí tenía. */
          letra: f.pliegoLetra || 'todo',
          horizontal: name === 'lamina-h'
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
    /* Que el botón flotante se pinte al entrar a Pro City. Lo llama js/20 en
       el único sitio por el que pasan la entrada y la salida del módulo.
       Sin esto, después de que el navegador se lleve la pestaña, el botón que
       ofrece seguir con el sector no aparecía hasta que algo repintara la
       hoja —y lo que hay que repintar es justamente lo que no se ve—. */
    alEntrarAProCity: function () { try { pintarVolver(); } catch (e) {} },
    analizar: analizar,
    abierto: function () { return S.abierto; },
    // Se exponen para poder comprobarlos sin montar la app entera: el reparto
    // por rumbos es la parte que decide a dónde se manda a un estudiante.
    zonasSinDatos: zonasSinDatos,
    compararListas: compararListas,
    /* El archivo para JOSM y la lista de correcciones: geometría y texto, sin
       red ni pantalla, así que se comprueban sin montar la aplicación. */
    construirOSM: construirOSM,
    textoCorrecciones: textoCorrecciones,
    // La comparación que está usando la ficha en este momento. Se expone para
    // poder comprobar que lo que se exporta es exactamente lo que se muestra.
    campoActual: function () { return S.campo; },
    pintarEstratos: pintarEstratos,
    quitarDelMapa: quitarDelMapa,
    compararConCampo: compararConCampo,
    // La conclusión del ejercicio, en texto y como paquete exportable.
    comparacionComoTexto: comparacionComoTexto,
    datosDeComparacion: datosDeComparacion,
    leerFichas: leerFichas,
    guardarFicha: guardarFicha,
    /* El respaldo de la salida entera: armarlo y volver a traerlo son
       funciones puras sobre una lista, así que se comprueban sin depender de
       que el navegador de pruebas deje descargar un archivo. */
    respaldoDeTodo: respaldoDeTodo,
    traerRespaldo: traerRespaldo,
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
    /* Solo para medir: deja cronometrar por separado lo que cuesta ARMAR el
       texto de la ficha y lo que cuesta METERLO en el documento. Sin esto no
       se puede saber si un repintado lento se arregla memorizando bloques o
       dejando de reemplazar la hoja entera, y optimizar sin saberlo es tirar
       a ver si pega.

       MEDIDO, con un sector de 300 usos y la ficha entera desplegada:
       armarla cuesta 3,6 ms y meterla en el documento 18,8 ms —78 KB y 1295
       nodos—. O sea unos 22 ms por repintado, de los que cinco sextos son la
       inserción. Conclusión: memorizar bloques no arreglaría nada; si algún
       día hay que bajarlo, lo que hay que dejar de hacer es reemplazar la
       hoja entera.

       Y la otra conclusión, la que importaba: 22 ms no es una congelación.
       La que se reportó en campo no venía de acá —era el botón muerto y los
       tres lápices armados a la vez, corregidos en v698—, así que esto se
       queda como está. Medir también sirve para no tocar. */
    /* Para que el lápiz del sector, que vive en otro archivo, pueda soltar
       los de esta hoja al armarse. Sin esto la regla solo valdría en dos de
       los tres sentidos. */
    soltarLapices: function () { soltarOtrosLapices('sector'); },
    /* Para poder comprobar desde fuera que lo dibujado y lo consultado son el
       mismo punto. Es la única propiedad de la que depende que las cifras
       sean del sitio que se marcó. */
    centroDeAnalisisDePrueba: function () { return centroDeAnalisis(); },
    terrenoDePrueba: function () { return S.terreno; },
    cursoDePrueba: function () { return S.intCurso || []; },
    intangibleDePrueba: function () { return S.intangible || []; },
    centroDelLoteDePrueba: function () { return centroDelLote(); },
    /* Los vértices que se están dibujando. Se exponen para poder comprobar
       desde fuera que tocar uno lo quita y que deshacer lo devuelve: sin
       verlos, la prueba solo podría mirar el texto de la barra, que es lo que
       dice que pasó y no lo que pasó. */
    loteDePrueba: function () { return S.lote || []; },
    // Bajar la hoja por el mismo camino que el dedo, para poder comprobar que
    // con la hoja abajo el círculo del sector analizado no sigue al mapa.
    encogerDePrueba: function () { alternarHoja(true); },
    trazoDePrueba: function () { return S.intPts || []; },
    htmlDeLaFicha: function () {
      return S.resultado ? htmlFicha(S.resultado) : '';
    },
    estado: function () {
      return {
        forma: S.forma,
        radioM: S.radioM,
        centro: S.centro,
        vertices: S.poligono ? S.poligono.length : 0,
        areaM2: Math.round(areaDelPoligono()),
        hay: !!S.resultado,
        // Si está consultando. Sin esto, una prueba que ve «no pasó nada» no
        // puede distinguir un análisis que falló de otro que ni empezó.
        consultando: !!S.cargando,
        // La composición del pliego: el tamaño de letra elegido y las cajas
        // que ese tamaño dejó fuera en la última lámina que se armó.
        pliegoLetra: S.pliegoLetra || 'todo',
        pliegoFuera: (S.pliegoFuera || []).slice(),
        // Las manzanas por estrato que hay en memoria, que son las que el
        // pliego dibuja y las que viajan con la ficha.
        estratos: S.estratos && S.estratos.manzanas ? S.estratos.manzanas.length : 0,
        estratosLeyenda: !!(S.estratos && S.estratos.leyenda)
      };
    }
  };
})();
