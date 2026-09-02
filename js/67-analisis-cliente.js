/* URBIS · Motor del lado del cliente (fase 04)
   Lo que el navegador necesita del análisis, SIN las reglas.

   Desde esta versión js/60 no se sirve más: las 148 reglas que traducen una
   etiqueta de OpenStreetMap a una categoría urbanística viven solo en el
   servidor. Este archivo ocupa su lugar en el navegador y expone la misma
   superficie que la interfaz ya usaba, para no tener que reescribir js/62 ni
   js/63 ni el módulo educativo.

   QUÉ HAY ACÁ
   Cálculos y contabilidad que no revelan nada: distancia entre dos puntos,
   proyección de población del DANE, normalización de nombres, y la bandeja
   de usos sin categoría, que es un registro en el navegador de cada quien.

   QUÉ NO HAY, Y NO VA A HABER
   La taxonomía con sus reglas, las marcas comerciales, los puntajes y los
   `subs`/`complementarios` de cada uso. Analizar es pedirle al servidor.

   LA BANDEJA Y EL CLASIFICADOR
   depurarPendientes() reevaluaba lo guardado contra el clasificador para
   cerrar solo lo que una regla nueva ya resolvía. Eso no se puede hacer acá
   sin traerse las reglas, así que ahora se le pregunta al servidor
   (/clasificar-firmas): el navegador manda sus firmas y recibe cuáles quedaron
   resueltas. Salen categorías, no reglas.

   Como esa consulta es por red, resumenPendientes() y exportarPendientes()
   dejaron de depurar antes de responder: leen la bandeja como está y la
   revisión corre aparte, en segundo plano, después de cada análisis. En la
   práctica el usuario abre la bandeja ya revisada.

   Este archivo NO se carga si js/60 está presente: durante una transición,
   el motor completo gana. */
(function () {
  'use strict';

  if (window.AIA_MOTOR) return;   // js/60 presente: no hay nada que suplir

  // El catálogo público (js/59) se carga antes que este archivo. De acá salen
  // los nombres, los grupos y los colores: la vitrina, nunca las reglas.
  // Se lee arriba porque abajo hay funciones que necesitan GRUPOS, y cuando
  // faltaba, la bandeja de pendientes fallaba en silencio.
  var CAT = window.AIA_CATALOGO || {};
  var GRUPOS = CAT.GRUPOS || {};

  const RADIOS_COMPARATIVA = [250, 500, 1000, 2000];
  const REGLAS_PERSONALIZADAS_KEY = 'aia_reglas_nombre_v1';
  const PENDIENTES_KEY = 'aia_usos_sin_categoria_v1';
  const MAX_PENDIENTES = 400;
  const TAGS_IRRELEVANTES = /^(name|name:|addr:|source|check_date|wikidata|wikipedia|note|fixme|created_by|ref|phone|website|opening_hours|operator:|contact:|survey:date|image|description)/;

  function haversineM(a, b){
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*rad) * Math.cos(b.lat*rad) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  function tasaAnualDe(anclas){
    if (!anclas || anclas.length < 2) return null;
    const orden = anclas.slice().sort((x, y) => x.anio - y.anio);
    const a0 = orden[0], a1 = orden[orden.length - 1];
    const anios = a1.anio - a0.anio;
    if (anios <= 0 || !a0.poblacion || !a1.poblacion) return null;
    return Math.pow(a1.poblacion / a0.poblacion, 1 / anios) - 1;
  }

  function proyectarPoblacion(base, anioBase, anioObjetivo, tasaAnual){
    if (!base || tasaAnual == null) return null;
    const anios = anioObjetivo - anioBase;
    return Math.round(base * Math.pow(1 + tasaAnual, anios));
  }

  function serieProyeccion(base, anioBase, anioObjetivo, tasaAnual, aniosExtra){
    if (!base || tasaAnual == null) return [];
    const fin = anioObjetivo + (aniosExtra || 0);
    const out = [];
    for (let a = anioBase; a <= fin; a++) {
      out.push({ anio: a, poblacion: proyectarPoblacion(base, anioBase, a, tasaAnual),
                 observado: a === anioBase, futuro: a > anioObjetivo });
    }
    return out;
  }

  // Tablas para escribir bien los nombres: preposiciones que van en minúscula
  // y siglas colombianas que van en mayúscula. No clasifican nada; se vinieron
  // con normalizarNombre, que sin ellas revienta.
  const MINUSCULAS_NOMBRE = new Set(['de','del','la','las','el','los','y','e','a','en','por','para','con','al']);
  const SIGLAS_NOMBRE = new Set(['IPS','EPS','SENA','ICBF','CAI','SAS','ESE','UIS','UFPS','DIAN','ETB','SA','LTDA','3D','TV','ONG','POT','VIS','VIP']);

  function normalizarNombre(s){
    const txt = String(s || '').trim().replace(/\s+/g, ' ');
    if (!txt) return '';
    // Un nombre ya escrito con mayúsculas y minúsculas mezcladas suele venir
    // bien de origen ("Éxito Wow"): solo se reescribe si está todo en un caso.
    const todoMayus = txt === txt.toUpperCase(), todoMinus = txt === txt.toLowerCase();
    if (!todoMayus && !todoMinus) return txt;
    return txt.split(' ').map((w, i) => {
      const limpio = w.replace(/[^\wÁÉÍÓÚÜÑáéíóúüñ]/g, '');
      if (SIGLAS_NOMBRE.has(limpio.toUpperCase())) return w.toUpperCase();
      const bajo = w.toLowerCase();
      if (i > 0 && MINUSCULAS_NOMBRE.has(bajo)) return bajo;
      return bajo.charAt(0).toUpperCase() + bajo.slice(1);
    }).join(' ');
  }

  function slugUso(nombre){
    return String(nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
      .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40) || 'uso';
  }

  // La clave con la que se guarda una regla personalizada: el nombre a
  // secas, sin tildes ni mayúsculas, para que «Café Éxito» y «CAFE EXITO»
  // sean el mismo. No clasifica: solo normaliza la clave.
  function normalizarNombrePOI(nombre){
    return String(nombre || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function leerReglasPersonalizadas(){
    try { return JSON.parse(localStorage.getItem(REGLAS_PERSONALIZADAS_KEY) || '{}'); }
    catch(e) { return {}; }
  }

  function guardarReglaPersonalizada(nombrePOI, grupoId){
    try {
      const reglas = leerReglasPersonalizadas();
      reglas[normalizarNombrePOI(nombrePOI)] = grupoId;
      localStorage.setItem(REGLAS_PERSONALIZADAS_KEY, JSON.stringify(reglas));
    } catch(e) {}
  }

  function plural(n, sing, plur){ return n === 1 ? sing : plur; }

  function tagsUtiles(tags){
    return Object.keys(tags || {})
      .filter(k => !TAGS_IRRELEVANTES.test(k))
      .sort()
      .map(k => k + '=' + tags[k]);
  }

  function leerPendientes(){
    try { const o = JSON.parse(localStorage.getItem(PENDIENTES_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; }
    catch(e) { return {}; }
  }

  function escribirPendientes(o){
    try { localStorage.setItem(PENDIENTES_KEY, JSON.stringify(o)); } catch(e) {}
  }

  function registrarPendientes(pois, meta){
    const store = leerPendientes();
    const ahora = new Date().toISOString();
    let nuevos = 0;
    (pois || []).forEach(p => {
      if (!p || p.grupo !== 'otro') return;
      const pares = tagsUtiles(p.tags);
      if (!pares.length) return;                 // sin etiquetas no hay nada que clasificar
      const firma = pares.join(' · ');
      let e = store[firma];
      if (!e) {
        if (Object.keys(store).length >= MAX_PENDIENTES) return;
        e = store[firma] = { firma, tags: pares, ejemplos: [], veces: 0,
                             visto: ahora, estado: 'pendiente' };
        nuevos++;
      }
      if (e.estado === 'descartado') return;     // ya se decidió que no aplica
      e.veces++;
      e.ultimaVez = ahora;
      if (meta && meta.zona && e.zona !== meta.zona) e.zona = meta.zona;
      const nom = normalizarNombre(p.nombre);
      if (nom && nom !== 'Otro (uso por definir)' && e.ejemplos.length < 5 && e.ejemplos.indexOf(nom) === -1) {
        e.ejemplos.push(nom);
      }
    });
    escribirPendientes(store);
    return { nuevos, total: Object.keys(store).filter(k => store[k].estado === 'pendiente').length };
  }

  function exportarPendientes(){
    const store = leerPendientes();
    const lista = Object.keys(store).map(k => store[k])
      .filter(e => e.estado === 'pendiente')
      .sort((a, b) => b.veces - a.veces);
    if (!lista.length) return 'No hay usos sin categoría acumulados.';
    const cab = 'USOS SIN CATEGORÍA ACUMULADOS POR URBIS · ' + lista.length + ' patrones distintos\n' +
      'Categorías disponibles: ' + Object.keys(GRUPOS).filter(g => g !== 'otro').join(', ') + '\n' +
      'Para cada patrón: ¿a qué categoría pertenece? Si no encaja en ninguna, dilo y creamos una nueva.\n' +
      '─'.repeat(60) + '\n';
    return cab + lista.map((e, i) =>
      (i + 1) + '. [' + e.veces + ' ' + plural(e.veces, 'vez', 'veces') + '] ' + e.firma +
      (e.ejemplos.length ? '\n   Ejemplos: ' + e.ejemplos.join(' · ') : '\n   (sin nombre propio)') +
      (e.zona ? '\n   Visto en: ' + e.zona : '')
    ).join('\n');
  }

  function resumenPendientes(){
    const store = leerPendientes();
    const claves = Object.keys(store);
    const pend = claves.filter(k => store[k].estado === 'pendiente');
    return {
      patrones: pend.length,
      apariciones: pend.reduce((a, k) => a + (store[k].veces || 0), 0),
      resueltos: claves.filter(k => store[k].estado === 'resuelto').length
    };
  }

  function resolverPendiente(firma, grupoId, nombreUso){
    const store = leerPendientes();
    const e = store[firma];
    if (!e || !GRUPOS[grupoId]) return false;
    e.estado = 'resuelto'; e.grupo = grupoId; e.nombreUso = nombreUso || '';
    escribirPendientes(store);
    // Las reglas personalizadas trabajan por nombre propio, así que se
    // registran los ejemplos conocidos de ese patrón.
    (e.ejemplos || []).forEach(n => guardarReglaPersonalizada(n, grupoId));
    return true;
  }

  function descartarPendiente(firma){
    const store = leerPendientes();
    if (!store[firma]) return false;
    store[firma].estado = 'descartado';
    escribirPendientes(store);
    return true;
  }

  function olvidarPendientes(){ escribirPendientes({}); }
  // ── Revisión de la bandeja contra el clasificador del servidor ───────────
  function revisarPendientes() {
    var cfg = (window.URBIS_CONFIG && window.URBIS_CONFIG.ANALISIS) || {};
    var api = String(cfg.API || '').replace(/\/+$/, '');
    if (!api || cfg.REMOTO === false) return Promise.resolve(0);

    var store = leerPendientes();
    var firmas = Object.keys(store)
      .filter(function (k) { return store[k] && store[k].estado === 'pendiente'; })
      .map(function (k) { return { k: k, tags: store[k].tags || [], ejemplos: store[k].ejemplos || [] }; });
    if (!firmas.length) return Promise.resolve(0);

    var cab = { 'Content-Type': 'application/json' };
    var lic = (window.AIA_REMOTO && window.AIA_REMOTO.licencia && window.AIA_REMOTO.licencia()) || '';
    if (lic) cab.Authorization = 'Bearer ' + lic;

    return fetch(api + '/clasificar-firmas', {
      method: 'POST', headers: cab, body: JSON.stringify({ firmas: firmas })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.ok || !Array.isArray(j.resueltas) || !j.resueltas.length) return 0;
        var s = leerPendientes(), n = 0, ahora = new Date().toISOString();
        j.resueltas.forEach(function (x) {
          var e = s[x.k];
          if (!e || e.estado !== 'pendiente') return;
          e.estado = 'resuelto';
          e.grupo = x.grupo;
          e.nombreUso = x.nombreUso || '';
          e.resueltoPor = 'taxonomia';   // lo cerró una regla, no una persona
          e.resueltoEn = ahora;
          n++;
        });
        if (n) escribirPendientes(s);
        return n;
      })
      // Que la revisión falle no es grave: la bandeja lista de más, no de
      // menos. Nunca debe tumbar el análisis que la disparó.
      .catch(function () { return 0; });
  }

  // ── Analizar es pedírselo al servidor ────────────────────────────────────
  function porElPuente(modo, entrada) {
    if (!window.AIA_REMOTO) {
      return Promise.reject(new Error('Falta js/66-analisis-remoto.js: sin él no hay con qué analizar.'));
    }
    return window.AIA_REMOTO.analizar(modo, entrada).then(function (datos) {
      // El motor archivaba solo los usos sin categoría durante el análisis.
      // Ahora corre lejos, así que lo hace el navegador con los puntos que
      // vuelven ya clasificados: es contabilidad, no clasificación.
      try {
        registrarPendientes(conSusEtiquetas((datos && datos.pois) || [], entrada),
          { zona: (entrada && entrada.direccionAprox) || '' });
        revisarPendientes();
      } catch (e) {
        // Un catch vacío acá ya escondió una vez que la bandeja no se llenaba:
        // el análisis salía bien y la herramienta que descubre usos sin
        // clasificar simplemente no descubría nada. Que se queje.
        try { console.warn('[URBIS] no se pudo archivar los usos sin categoría:', e); } catch (x) {}
      }
      return datos;
    });
  }

  /* Los puntos que devuelve el servidor traen su categoría pero NO sus
     etiquetas de OpenStreetMap, y la bandeja arma su firma justamente con
     esas etiquetas. No hace falta que el servidor las mande de vuelta: las
     tiene el navegador, que fue quien las envió. Se vuelven a unir por
     coordenada.

     Sin esto la bandeja quedaba vacía para siempre y nadie se enteraba: el
     análisis salía bien, la pantalla se veía normal, y la herramienta que
     sirve para descubrir qué usos faltan por clasificar simplemente dejaba
     de descubrir nada. */
  function conSusEtiquetas(pois, entrada) {
    var porCoord = {};
    var clave = function (lat, lng) { return Number(lat).toFixed(6) + ',' + Number(lng).toFixed(6); };
    (((entrada || {}).elementos) || []).forEach(function (el) {
      if (!el) return;
      var lat = el.lat != null ? el.lat : (el.center && el.center.lat);
      var lng = el.lon != null ? el.lon : (el.center && el.center.lon);
      if (lat == null || lng == null) return;
      porCoord[clave(lat, lng)] = el.tags || {};
    });
    return (pois || []).map(function (p) {
      if (!p || p.tags) return p;
      var t = porCoord[clave(p.lat, p.lng)];
      if (!t) return p;
      var copia = {};
      for (var k in p) copia[k] = p[k];
      copia.tags = t;
      return copia;
    });
  }

  window.AIA_MOTOR = {
    // Análisis: siempre por el servidor
    analizar: function (entrada) { return porElPuente('simple', entrada); },
    analizarMixto: function (entrada) { return porElPuente('mixto', entrada); },

    // Catálogo público (js/59): etiquetas para pintar, sin reglas
    TAXONOMIA: CAT.TAXONOMIA || [],
    GRUPOS: GRUPOS,
    GRUPO_COLOR: CAT.GRUPO_COLOR || {},
    USOS_PROGRAMA: CAT.USOS_PROGRAMA || [],
    RADIOS_COMPARATIVA: RADIOS_COMPARATIVA,

    // Cálculos sin criterio propio
    haversineM: haversineM,
    tasaAnualDe: tasaAnualDe,
    proyectarPoblacion: proyectarPoblacion,
    serieProyeccion: serieProyeccion,
    normalizarNombre: normalizarNombre,

    // El navegador manda ids; el servidor resuelve contra su tabla y no
    // acepta reglas que le llegen de afuera.
    normalizarUsos: function (seleccion) {
      return (seleccion || []).map(function (item) {
        if (typeof item !== 'string') return item;
        var d = (CAT.USOS_PROGRAMA || []).filter(function (u) { return u.id === item; })[0];
        if (d) { var o = {}; for (var k in d) o[k] = d[k]; o.esCustom = false; return o; }
        return { id: 'custom_' + slugUso(item), nombre: item, icono: '\u2728', esCustom: true };
      });
    },

    // Reglas de nombre que enseña el usuario, y la bandeja: las dos viven en
    // el navegador de cada quien y no salen de ahí.
    leerReglasPersonalizadas: leerReglasPersonalizadas,
    guardarReglaPersonalizada: guardarReglaPersonalizada,
    leerPendientes: leerPendientes,
    registrarPendientes: registrarPendientes,
    exportarPendientes: exportarPendientes,
    resumenPendientes: resumenPendientes,
    resolverPendiente: resolverPendiente,
    descartarPendiente: descartarPendiente,
    olvidarPendientes: olvidarPendientes,
    revisarPendientes: revisarPendientes
  };
})();
