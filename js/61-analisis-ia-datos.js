/* URBIS · Análisis de Implantación IA — DATOS (js/61)
   Fuentes externas del módulo: Overpass API (OpenStreetMap, gratis) para los
   POIs del entorno, LocationIQ para buscar direcciones (misma key que usa la
   app en URBIS_CONFIG) y parser de enlaces de Google Maps. Con caché local
   y protección contra abuso del rate limit de Overpass. */
(function(){
  'use strict';

  const OVERPASS_PRINCIPAL = 'https://overpass-api.de/api/interpreter';
  const OVERPASS_ESPEJO = 'https://overpass.kumi.systems/api/interpreter';
  const CACHE_KEY = 'aia_overpass_cache_v1';
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const CACHE_MAX = 8;
  const MIN_ENTRE_CONSULTAS_MS = 5000;

  let enVuelo = false;
  let ultimaConsulta = 0;

  // ── Query Overpass ──────────────────────────────────────────────────────
  // Una sola consulta con (around:R,lat,lng). Se excluye building=yes (el
  // valor genérico) para no traer miles de polígonos sin información de uso.
  /* `a` es el filtro de área, y es lo único que cambia entre pedir un círculo
     y pedir un polígono. Overpass entiende los dos:
       (around:500,7.89,-72.50)          un círculo
       (poly:"7.89 -72.50 7.90 -72.51")  un área dibujada
     Por eso no hace falta traer un rectángulo y recortarlo después: se le
     pide exactamente el área, y viaja menos. */
  function construirQueryCon(a){
    return '[out:json][timeout:25];(' +
      'nwr["amenity"]' + a + ';' +
      'nwr["shop"]' + a + ';' +
      'nwr["leisure"]' + a + ';' +
      // Reportado: un gimnasio nuevo no aparecía. Un box de crossfit o un
      // gimnasio de barrio a veces vienen SOLO con `sport`, sin amenity ni
      // leisure, y así ni siquiera llegaban a clasificarse: no se pedían.
      'nwr["sport"]' + a + ';' +
      'nwr["tourism"]' + a + ';' +
      'nwr["healthcare"]' + a + ';' +
      'nwr["office"]' + a + ';' +
      'nwr["landuse"]' + a + ';' +
      'nwr["building"]["building"!="yes"]' + a + ';' +
      'way["highway"~"^(trunk|primary|secondary|tertiary|cycleway)$"]' + a + ';' +
      'node["highway"="bus_stop"]' + a + ';' +
      'node["public_transport"]' + a + ';' +
      'nwr["natural"~"^(water|wetland|wood|scrub|grassland)$"]' + a + ';' +
      'way["waterway"~"^(river|stream|canal)$"]' + a + ';' +
      ');out center tags 3000;' +
      // Segunda salida en la misma consulta: las rutas de transporte público
      // que recogen en alguna parada del área. Van sin geometría —solo sus
      // etiquetas— porque lo que se muestra es el nombre y el color, no el
      // trazado: dibujar el recorrido pediría traer la ruta entera.
      'node["highway"="bus_stop"]' + a + '->.paradas;' +
      'rel(bn.paradas)["route"~"^(bus|minibus|share_taxi|trolleybus)$"];' +
      'out tags 40;';
  }

  function construirQuery(lat, lng, radioM){
    return construirQueryCon('(around:' + Math.round(radioM) + ',' + lat + ',' + lng + ')');
  }

  /* Overpass quiere los vértices como «lat lon lat lon», separados por
     espacios y SIN comas, y quiere el anillo abierto: repetir el primer punto
     al final lo rechaza. Los polígonos de Pro City vienen abiertos, pero se
     comprueba igual porque un anillo cerrado es lo que devuelve casi cualquier
     otra herramienta y el error que da Overpass no explica nada. */
  function filtroPoligono(pts){
    const p = pts.slice();
    if (p.length > 3) {
      const a = p[0], z = p[p.length - 1];
      if (Math.abs(a.lat - z.lat) < 1e-9 && Math.abs(a.lng - z.lng) < 1e-9) p.pop();
    }
    const lista = p.map(v => v.lat.toFixed(6) + ' ' + v.lng.toFixed(6)).join(' ');
    return '(poly:"' + lista + '")';
  }
  function construirQueryPoligono(pts){
    return construirQueryCon(filtroPoligono(pts));
  }

  function claveCache(lat, lng, radioM){
    return lat.toFixed(4) + ',' + lng.toFixed(4) + ',' + Math.round(radioM);
  }

  // Los polígonos no tienen centro ni radio con los que hacer una clave. Se
  // usan los vértices redondeados: el mismo trazo pide el mismo caché, y uno
  // distinto pide datos nuevos.
  function claveCachePoligono(pts){
    return 'pol:' + pts.map(v => v.lat.toFixed(4) + ',' + v.lng.toFixed(4)).join(';');
  }

  function leerCache(clave){
    try {
      const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
      const hit = all.find(e => e.k === clave);
      if (hit && (Date.now() - hit.t) < CACHE_TTL_MS) return hit.d;
    } catch(e) {}
    return null;
  }

  function guardarCache(clave, datos){
    try {
      let all = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
      all = all.filter(e => e.k !== clave && (Date.now() - e.t) < CACHE_TTL_MS);
      all.push({ k: clave, t: Date.now(), d: datos });
      while (all.length > CACHE_MAX) all.shift();
      localStorage.setItem(CACHE_KEY, JSON.stringify(all));
    } catch(e) {
      // localStorage lleno (respuestas grandes): el análisis funciona igual sin caché.
      try { localStorage.removeItem(CACHE_KEY); } catch(e2) {}
    }
  }

  async function fetchOverpass(endpoint, query, timeoutMs){
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 40000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: 'data=' + encodeURIComponent(query),
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      return json.elements || [];
    } finally {
      clearTimeout(timer);
    }
  }

  // consultarEntorno(lat, lng, radioM) → Promise<elements[]>
  // `forzar` salta la caché de 24 h. Hace falta de verdad: si el sitio se
  // analizó hoy y desde entonces alguien agregó el local al mapa, la app
  // seguía mostrando la foto vieja hasta el día siguiente, sin manera de
  // pedirle que volviera a mirar.
  /* El trabajo común de cualquier consulta a Overpass: caché, freno entre
     peticiones, tres intentos, limpieza. Lo único que cambia entre pedir un
     círculo y pedir un área dibujada es la consulta y la clave del caché, así
     que eso se recibe y todo lo demás se comparte. Cuando esto estaba
     duplicado, el reintento contra el espejo existía en un camino y no en el
     otro, y fallaba solo el que menos se usaba. */
  async function traer(clave, query, forzar){
    const cacheado = forzar ? null : leerCache(clave);
    if (cacheado) return cacheado;

    if (enVuelo) throw new Error('Ya hay una consulta en curso. Espera a que termine.');
    const desde = Date.now() - ultimaConsulta;
    if (desde < MIN_ENTRE_CONSULTAS_MS) {
      throw new Error('Espera ' + Math.ceil((MIN_ENTRE_CONSULTAS_MS - desde) / 1000) + ' segundos antes de otra consulta.');
    }

    enVuelo = true;
    ultimaConsulta = Date.now();
    try {
      // El servidor principal a veces tiene baches breves (504) y se
      // recupera solo en segundos; reintentarlo es más confiable que un
      // espejo que puede estar caído por completo. Tres intentos en total:
      // principal → principal (tras 3s) → espejo (tras 3s más).
      let elementos, ultimoError;
      const intentos = [
        () => fetchOverpass(OVERPASS_PRINCIPAL, query, 40000),
        () => fetchOverpass(OVERPASS_PRINCIPAL, query, 40000),
        () => fetchOverpass(OVERPASS_ESPEJO, query, 25000)
      ];
      for (let i = 0; i < intentos.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 3000));
        try { elementos = await intentos[i](); ultimoError = null; break; }
        catch(e) { ultimoError = e; }
      }
      if (ultimoError) {
        throw new Error('El servicio de datos abiertos está saturado. Espera un minuto y vuelve a intentar.');
      }
      /* Dedup por type+id y descarte de lo que no se puede situar.
         La excepción son las RUTAS de transporte: una relación de ruta no
         tiene posición propia —es un recorrido entero— y se pidió a
         propósito, por las paradas que están dentro del área. Con el
         descarte de siempre desaparecían acá mismo, antes de llegar al
         motor, y el análisis salía sin transporte público sin que nada
         avisara. */
      const vistos = new Set();
      const limpios = [];
      elementos.forEach(el => {
        const id = el.type + '/' + el.id;
        if (vistos.has(id)) return;
        vistos.add(id);
        if (!el.tags) return;
        const esRuta = el.type === 'relation' &&
          /^(bus|minibus|share_taxi|trolleybus)$/.test(String(el.tags.route || ''));
        if (esRuta) { limpios.push(el); return; }
        // Con `out geom` un camino no trae lat/lon propios: trae su recorrido.
        // Situarlo por su geometría es más exacto que descartarlo.
        if (Array.isArray(el.geometry) && el.geometry.length) { limpios.push(el); return; }
        const lat2 = el.lat != null ? el.lat : (el.center && el.center.lat);
        const lng2 = el.lon != null ? el.lon : (el.center && el.center.lon);
        if (lat2 == null || lng2 == null) return;
        limpios.push(el);
      });
      guardarCache(clave, limpios);
      return limpios;
    } finally {
      enVuelo = false;
    }
  }

  /* La geometría del trazado: huellas de los edificios y ejes de las vías.
     Solo lo que se mide —edificios, vías vehiculares, agua—, y con `out geom`
     en vez de `out center` porque acá la forma ES el dato. */
  function construirQueryTrazadoCon(a){
    return '[out:json][timeout:60];(' +
      'way["building"]["building"!="no"]' + a + ';' +
      'way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian)$"]' + a + ';' +
      'way["waterway"~"^(river|stream|canal)$"]' + a + ';' +
      /* El espacio público, con su FORMA. Contarlo por puntos no sirve: la
         pregunta no es cuántos parques hay sino cuántos metros cuadrados
         son, y eso solo sale del polígono. Viaja en la misma consulta que el
         trazado porque es la misma geometría y una consulta menos. */
      'way["leisure"~"^(park|garden|common|playground|dog_park|pitch|sports_centre|track)$"]' + a + ';' +
      'way["landuse"~"^(recreation_ground|village_green)$"]' + a + ';' +
      'way["place"="square"]' + a + ';' +
      ');out geom 4000;';
  }
  function consultarTrazado(lat, lng, radioM, forzar){
    return traer('trz|' + claveCache(lat, lng, radioM),
                 construirQueryTrazadoCon('(around:' + Math.round(radioM) + ',' + lat + ',' + lng + ')'), forzar);
  }
  function consultarTrazadoPoligono(pts, forzar){
    if (!Array.isArray(pts) || pts.length < 3) {
      return Promise.reject(new Error('El área necesita al menos 3 puntos.'));
    }
    return traer('trz|' + claveCachePoligono(pts),
                 construirQueryTrazadoCon(filtroPoligono(pts)), forzar);
  }

  /* ── La altura del terreno ───────────────────────────────────────────
     Open-Meteo sirve elevaciones sin pedir clave y sin registro, hasta cien
     coordenadas por consulta. Sale del modelo Copernicus de 90 metros: para
     un sector de varias hectáreas describe bien el relieve, pero NO sirve
     para decir la cota exacta de una esquina. El bloque lo dice; callarlo
     sería vender precisión que no hay.

     Se pide una rejilla y no puntos sueltos porque de una rejilla salen la
     pendiente, la orientación de la ladera y los perfiles; de puntos sueltos
     solo salen cotas. */
  const ELEVACION_API = 'https://api.open-meteo.com/v1/elevation';
  const ELEV_POR_CONSULTA = 100;

  async function consultarElevacion(puntos, alAvisar){
    if (!Array.isArray(puntos) || !puntos.length) return [];
    const cacheKey = 'elev|' + puntos.length + '|' +
      puntos[0].lat.toFixed(4) + ',' + puntos[0].lng.toFixed(4) + '|' +
      puntos[puntos.length - 1].lat.toFixed(4) + ',' + puntos[puntos.length - 1].lng.toFixed(4);
    const guardado = leerCache(cacheKey);
    if (guardado) return guardado;

    const alturas = [];
    const lotes = Math.ceil(puntos.length / ELEV_POR_CONSULTA);
    for (let i = 0; i < puntos.length; i += ELEV_POR_CONSULTA) {
      const trozo = puntos.slice(i, i + ELEV_POR_CONSULTA);
      if (typeof alAvisar === 'function') {
        alAvisar('Midiendo la altura del terreno… ' + (Math.floor(i / ELEV_POR_CONSULTA) + 1) + ' de ' + lotes);
      }
      const url = ELEVACION_API +
        '?latitude=' + trozo.map(p => Number(p.lat).toFixed(5)).join(',') +
        '&longitude=' + trozo.map(p => Number(p.lng).toFixed(5)).join(',');
      /* El servicio de altura es gratuito y sin clave, y cobra por PUNTO:
         una consulta de cien puntos le cuenta como cien. Medir el terreno de
         un par de sectores seguidos agota la cuota de la hora y responde
         «429». Pasó en mitad de una clase y se vio así: «el terreno no
         cargó, el análisis quedó sin cortes».

         Dos cosas contra eso. Pedir menos puntos —eso vive en `rejillaDe`— y
         no rendirse al primer 429: se espera y se reintenta, porque la cuota
         se libera sola. Las esperas son de un segundo y medio y cuatro; más
         que eso es dejar a alguien mirando una pantalla quieta. */
      let d, ultimo = '';
      const esperar = ms => new Promise(x => setTimeout(x, ms));
      for (let intento = 0; intento < 3; intento++) {
        if (intento) {
          if (typeof alAvisar === 'function') {
            alAvisar('El servicio de altura está saturado. Reintentando…');
          }
          await esperar(intento === 1 ? 1500 : 4000);
        }
        try {
          const res = await fetch(url);
          if (res.status === 429 || res.status === 503) { ultimo = 'saturado'; continue; }
          if (!res.ok) throw new Error('respondió ' + res.status);
          d = await res.json();
          ultimo = '';
          break;
        } catch (e) {
          ultimo = (e && e.message) || String(e);
          // Un fallo de red se reintenta igual; uno de formato, no.
          if (!/respondió|Failed|network|fetch/i.test(ultimo)) break;
        }
      }
      if (!d) {
        throw new Error(ultimo === 'saturado'
          ? 'El servicio de altura del terreno está atendiendo demasiadas consultas ' +
            'ahora mismo. Es gratuito y tiene un cupo por hora. Esperá un par de minutos ' +
            'y volvé a darle a «Medir el terreno»: lo demás del análisis ya está.'
          : 'No se pudo consultar la altura del terreno (' + ultimo + ').');
      }
      const lista = d && d.elevation;
      // Una respuesta con menos alturas que puntos desalinearía toda la
      // rejilla: cada cota quedaría en el sitio de otra y la pendiente
      // saldría inventada. Mejor fallar acá.
      if (!Array.isArray(lista) || lista.length !== trozo.length) {
        throw new Error('El servicio de elevación devolvió ' +
          ((lista && lista.length) || 0) + ' alturas para ' + trozo.length + ' puntos.');
      }
      lista.forEach(v => alturas.push(Number(v)));
    }
    guardarCache(cacheKey, alturas);
    return alturas;
  }

  /* La rejilla que se le pide: N×N sobre el rectángulo que envuelve al área.
     Se incluyen también los puntos de FUERA del contorno a propósito — la
     pendiente de un punto del borde se calcula con sus vecinos, y sin ellos
     el borde entero quedaría sin pendiente. */
  function rejillaDe(pts, centro, radioM){
    let minLat, maxLat, minLng, maxLng;
    if (Array.isArray(pts) && pts.length >= 3) {
      minLat = Math.min.apply(null, pts.map(p => p.lat));
      maxLat = Math.max.apply(null, pts.map(p => p.lat));
      minLng = Math.min.apply(null, pts.map(p => p.lng));
      maxLng = Math.max.apply(null, pts.map(p => p.lng));
    } else {
      const dLat = radioM / 111320;
      const dLng = radioM / (111320 * Math.cos(centro.lat * Math.PI / 180));
      minLat = centro.lat - dLat; maxLat = centro.lat + dLat;
      minLng = centro.lng - dLng; maxLng = centro.lng + dLng;
    }
    // Un poco de margen para que el borde tenga vecinos de verdad.
    const mLat = (maxLat - minLat) * 0.08, mLng = (maxLng - minLng) * 0.08;
    minLat -= mLat; maxLat += mLat; minLng -= mLng; maxLng += mLng;

    /* Cuántos puntos por lado.

       El modelo tiene 90 m de resolución: muestrear más fino no agrega
       información, solo interpola. Se pedían 26 por lado —676 puntos, siete
       consultas— porque con menos las curvas salían a tramos rectos. Pero el
       servicio cobra por PUNTO, no por consulta: 676 puntos son 676 en su
       cuenta, y medir un par de sectores seguidos devolvía «429 · demasiadas
       consultas» y dejaba el análisis sin terreno y sin cortes.

       Ahora se piden 16 por lado como mucho —256 puntos, tres consultas, un
        62 % menos— con un paso de unos 70 m, todavía más fino que el modelo.
       Lo que se perdía al bajar de 26 era el DIBUJO, y eso se arregla donde
       corresponde: las curvas se trazan sobre una rejilla interpolada
       (`tupirRejilla` en js/68), que pasa por las cotas medidas y curva entre
       ellas. Se pide poco y se dibuja fino. */
    const anchoM = (maxLng - minLng) * 111320 * Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    const altoM = (maxLat - minLat) * 111320;
    const lado = Math.max(8, Math.min(16, Math.round(Math.max(anchoM, altoM) / 70)));

    const puntos = [];
    for (let f = 0; f < lado; f++) {
      for (let c = 0; c < lado; c++) {
        puntos.push({
          lat: maxLat - (maxLat - minLat) * (f / (lado - 1)),
          lng: minLng + (maxLng - minLng) * (c / (lado - 1))
        });
      }
    }
    return { filas: lado, columnas: lado, puntos: puntos,
             limites: { minLat, maxLat, minLng, maxLng } };
  }

  /* ── El clima ────────────────────────────────────────────────────────
     Del archivo climático de Open-Meteo, la misma casa que las elevaciones:
     sin clave ni registro. Se piden PROMEDIOS MENSUALES de varios años y no
     el pronóstico de mañana — a un análisis urbano no le sirve saber si hoy
     llueve; le sirve saber cómo es el sitio: cuánto calor hace, cuándo
     llueve y de dónde sopla el viento, que es lo que decide orientaciones,
     aleros y patios.

     Se piden datos diarios de un periodo largo y se promedian acá por mes.
     Es más liviano de lo que parece: un valor por día y variable. */
  const CLIMA_API = 'https://archive-api.open-meteo.com/v1/archive';
  const CLIMA_ANIOS = 5;

  async function consultarClima(lat, lng, alAvisar){
    const hoy = new Date();
    // El archivo va con unos días de retraso; se pide hasta hace una semana.
    const fin = new Date(hoy.getTime() - 7 * 86400000);
    const ini = new Date(Date.UTC(fin.getUTCFullYear() - CLIMA_ANIOS, 0, 1));
    const iso = d => d.toISOString().slice(0, 10);
    const clave = 'clima|' + lat.toFixed(2) + ',' + lng.toFixed(2) + '|' + iso(ini) + '|' + iso(fin);
    const guardado = leerCache(clave);
    if (guardado) return guardado;

    if (typeof alAvisar === 'function') alAvisar('Trayendo el clima de los últimos ' + CLIMA_ANIOS + ' años…');
    const url = CLIMA_API + '?latitude=' + lat.toFixed(4) + '&longitude=' + lng.toFixed(4) +
      '&start_date=' + iso(ini) + '&end_date=' + iso(fin) +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,' +
      'wind_speed_10m_max,wind_direction_10m_dominant&timezone=auto';
    let d;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('respondió ' + res.status);
      d = await res.json();
    } catch (e) {
      throw new Error('No se pudo consultar el clima (' + (e.message || e) + ').');
    }
    const dia = d && d.daily;
    if (!dia || !Array.isArray(dia.time) || !dia.time.length) {
      throw new Error('El servicio de clima no devolvió datos para este punto.');
    }
    const salida = {
      desde: iso(ini), hasta: iso(fin), anios: CLIMA_ANIOS,
      zona: d.timezone || '',
      dias: dia.time.map((f, i) => ({
        f: f,
        tMax: dia.temperature_2m_max ? dia.temperature_2m_max[i] : null,
        tMin: dia.temperature_2m_min ? dia.temperature_2m_min[i] : null,
        lluvia: dia.precipitation_sum ? dia.precipitation_sum[i] : null,
        viento: dia.wind_speed_10m_max ? dia.wind_speed_10m_max[i] : null,
        vientoDir: dia.wind_direction_10m_dominant ? dia.wind_direction_10m_dominant[i] : null
      }))
    };
    guardarCache(clave, salida);
    return salida;
  }

  function consultarEntorno(lat, lng, radioM, forzar){
    return traer(claveCache(lat, lng, radioM), construirQuery(lat, lng, radioM), forzar);
  }

  /* Lo mismo, para un área dibujada a mano. `pts` son los vértices en el
     orden del trazo, como los guarda Pro City. */
  function consultarEntornoPoligono(pts, forzar){
    if (!Array.isArray(pts) || pts.length < 3) {
      return Promise.reject(new Error('El área necesita al menos 3 puntos.'));
    }
    return traer(claveCachePoligono(pts), construirQueryPoligono(pts), forzar);
  }



  // ── Búsqueda de dirección (LocationIQ, misma key de la app) ─────────────
  let buscarAbort = null;
  async function buscarDireccion(texto){
    const cfg = (window.URBIS_CONFIG && window.URBIS_CONFIG.LOCATIONIQ) || {};
    const key = cfg.apiKey || '';
    if (!key || key.indexOf('pk.') !== 0) return [];
    if (buscarAbort) buscarAbort.abort();
    buscarAbort = new AbortController();
    const url = 'https://api.locationiq.com/v1/autocomplete?key=' + encodeURIComponent(key) +
      '&q=' + encodeURIComponent(texto) +
      '&countrycodes=' + (cfg.countrycodes || 'co') + '&limit=6&dedupe=1';
    try {
      const res = await fetch(url, { signal: buscarAbort.signal });
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data.map(d => ({
        nombre: d.display_name || d.display_place || '',
        lat: parseFloat(d.lat), lng: parseFloat(d.lon)
      })).filter(d => !isNaN(d.lat) && !isNaN(d.lng));
    } catch(e) {
      return [];
    }
  }

  // ── Ubicación administrativa (ciudad / departamento / país) ─────────────
  // Se usa para titular el informe ("Cúcuta · Norte de Santander, Colombia").
  // Si falla, el informe simplemente no muestra la línea de ubicación: nunca
  // se inventa una ciudad.
  async function ubicacionDe(lat, lng){
    const cfg = (window.URBIS_CONFIG && window.URBIS_CONFIG.LOCATIONIQ) || {};
    if (!cfg.apiKey) return null;
    try {
      const url = 'https://us1.locationiq.com/v1/reverse?key=' + encodeURIComponent(cfg.apiKey) +
        '&lat=' + lat + '&lon=' + lng + '&format=json&normalizeaddress=1&accept-language=es';
      const res = await fetch(url);
      if (!res.ok) return null;
      const d = await res.json();
      const a = d.address || {};
      // LocationIQ devuelve "Perímetro Urbano Cúcuta"; en un informe se lee
      // mejor solo el nombre del municipio.
      const ciudad = String(a.city || a.town || a.municipality || a.village || a.county || '')
        .replace(/^\s*per[ií]metro\s+urbano\s+/i, '').trim();
      const depto = a.state || a.region || '';
      const pais = a.country || '';
      const barrio = a.suburb || a.neighbourhood || a.quarter || '';
      // La comuna es la división con la que se habla y se planifica en las
      // ciudades colombianas, y es la que rotula una lámina de análisis. Los
      // geocodificadores la devuelven en city_district o borough según el
      // caso, así que se miran los dos.
      const comuna = a.city_district || a.borough || a.district || '';
      const via = a.road || '';
      if (!ciudad && !depto && !pais) return null;
      return { ciudad, departamento: depto, pais, barrio, comuna, via,
               texto: [ciudad, depto, pais].filter(Boolean).join(', ') };
    } catch(e) { return null; }
  }

  // ── Parser de enlaces de Google Maps ────────────────────────────────────
  function parsearEnlaceMaps(url){
    const s = String(url || '');
    let m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (!m) m = s.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (!m) m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (!m) return null;
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  }

  // ── Censo DANE 2018 (población y estrato reales) ────────────────────────
  // Reemplaza la estimación heurística de población por el dato censal real.
  // La heurística multiplicaba área por una densidad fija y se SATURABA: a 1 km
  // devolvía ~30.800 para cualquier sector residencial, fuera el Centro
  // (14.119 reales) o Atalaya (39.799 reales).
  //
  // Los datos los publica Esri Colombia a partir del CNPV 2018 del DANE, como
  // servicios REST públicos: sin API key y con CORS abierto, así que la PWA los
  // consulta directo desde el navegador igual que hace con Overpass.
  // Licencia: datos abiertos (Ley 1712 de 2014), citando al DANE.
  const DANE_BASE = 'https://ags.esri.co/arcgis/rest/services/LivingAtlas';
  const DANE_CAPAS = {
    // Manzana censal: el detalle más fino, pero SOLO cubre suelo urbano.
    personasManzana: DANE_BASE + '/Censo_personas_manzana_2018/MapServer/0/query',
    // Sector censal: menos detalle, pero llega al suelo rural. Es el respaldo
    // cuando el lote queda fuera del perímetro urbano.
    personasSector:  DANE_BASE + '/Censo_personas_sectores_2018/MapServer/0/query',
    viviendasManzana: DANE_BASE + '/Censo_viviendas_manzana_2018/MapServer/0/query',
    estratoManzana:  DANE_BASE + '/Estrato_predominante_por_manzana_2018/MapServer/0/query'
  };
  const ESTRATO_NUM = { 'uno':1, 'dos':2, 'tres':3, 'cuatro':4, 'cinco':5, 'seis':6 };

  function paramsRadio(lat, lng, radioM){
    const p = new URLSearchParams();
    p.set('geometry', JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }));
    p.set('geometryType', 'esriGeometryPoint');
    p.set('inSR', '4326');
    p.set('distance', String(radioM));
    p.set('units', 'esriSRUnit_Meter');
    p.set('spatialRel', 'esriSpatialRelIntersects');
    p.set('f', 'json');
    return p;
  }

  async function consultaDANE(url, params, timeoutMs){
    const ctrl = new AbortController();
    // 20 s: la capa de manzanas agrega cientos de polígonos y en radios de
    // 1-2 km puede tardar. Con 12 s abortaba y el análisis caía al respaldo
    // de sector aunque el lote sí estuviera en suelo urbano.
    const t = setTimeout(() => ctrl.abort(), timeoutMs || 20000);
    try {
      const res = await fetch(url + '?' + params.toString(), { signal: ctrl.signal });
      if (!res.ok) return null;
      const d = await res.json();
      // El servicio responde 200 incluso con error lógico: hay que mirar el cuerpo.
      return (d && !d.error) ? d : null;
    } catch(e) { return null; }
    finally { clearTimeout(t); }
  }

  // `campo` cambia por capa: las de personas usan SEXO_TOTAL y la de vivienda
  // usa TOTAL_VIVIENDAS (por eso el conteo de viviendas volvía vacío).
  async function sumaCapa(url, lat, lng, radioM, campo){
    const p = paramsRadio(lat, lng, radioM);
    p.set('outStatistics', JSON.stringify([
      { statisticType:'sum',   onStatisticField: campo,     outStatisticFieldName:'TOTAL' },
      { statisticType:'count', onStatisticField:'OBJECTID', outStatisticFieldName:'N' }
    ]));
    const d = await consultaDANE(url, p);
    const a = d && d.features && d.features[0] && d.features[0].attributes;
    if (!a || a.TOTAL == null) return null;
    return { total: Math.round(a.TOTAL), unidades: a.N || 0 };
  }

  // Estructura demográfica: sexo y edad del censo.
  // OJO con el nombre de los campos: SEXO_M son MUJERES y SEXO_H son HOMBRES
  // (verificado contra el total municipal: 52,3% M, coherente con la cifra
  // publicada por el DANE). Invertirlos daría un informe exactamente al revés.
  const EDADES = ['0_4','5_9','10_14','15_19','20_24','25_29','30_34','35_39','40_44',
                  '45_49','50_54','55_59','60_64','65_69','70_74','75_79','80_84',
                  '85_89','90_94','95_99','100_O_MAS'];
  // Tramos que de verdad cambian una decisión inmobiliaria.
  const TRAMOS = [
    { id:'ninos',   etiqueta:'0 a 14 años',   icono:'🧒', campos:['0_4','5_9','10_14'] },
    { id:'jovenes', etiqueta:'15 a 29 años',  icono:'🧑', campos:['15_19','20_24','25_29'] },
    { id:'adultosJ',etiqueta:'30 a 44 años',  icono:'👩‍💼', campos:['30_34','35_39','40_44'] },
    { id:'adultos', etiqueta:'45 a 64 años',  icono:'🧑‍🦱', campos:['45_49','50_54','55_59','60_64'] },
    { id:'mayores', etiqueta:'65 años o más', icono:'🧓', campos:['65_69','70_74','75_79','80_84','85_89','90_94','95_99','100_O_MAS'] }
  ];

  async function demografia(lat, lng, radioM){
    const stats = [
      { statisticType:'sum', onStatisticField:'SEXO_M', outStatisticFieldName:'MUJ' },
      { statisticType:'sum', onStatisticField:'SEXO_H', outStatisticFieldName:'HOM' }
    ].concat(EDADES.map(e => ({
      statisticType:'sum', onStatisticField:'EDAD_' + e, outStatisticFieldName:'E' + e
    })));
    const p = paramsRadio(lat, lng, radioM);
    p.set('outStatistics', JSON.stringify(stats));
    const d = await consultaDANE(DANE_CAPAS.personasManzana, p);
    const a = d && d.features && d.features[0] && d.features[0].attributes;
    if (!a || a.MUJ == null) return null;

    const mujeres = a.MUJ || 0, hombres = a.HOM || 0;
    const totalSexo = mujeres + hombres;
    if (!totalSexo) return null;

    const tramos = TRAMOS.map(t => {
      const n = t.campos.reduce((s, c) => s + (a['E' + c] || 0), 0);
      return { id:t.id, etiqueta:t.etiqueta, icono:t.icono, personas:n };
    });
    const totalEdad = tramos.reduce((s, t) => s + t.personas, 0) || 1;
    tramos.forEach(t => { t.pct = Math.round(100 * t.personas / totalEdad); });

    const may = tramos.find(t => t.id === 'mayores').personas;
    const nin = tramos.find(t => t.id === 'ninos').personas;
    const dominante = tramos.slice().sort((x, y) => y.personas - x.personas)[0];

    return {
      mujeres, hombres, totalSexo,
      pctMujeres: Math.round(1000 * mujeres / totalSexo) / 10,
      pctHombres: Math.round(1000 * hombres / totalSexo) / 10,
      tramos, totalEdad,
      pctMayores: Math.round(1000 * may / totalEdad) / 10,
      pctNinos: Math.round(1000 * nin / totalEdad) / 10,
      // Índice de envejecimiento: mayores de 65 por cada 100 menores de 15.
      // Por encima de 100 el sector ya tiene más viejos que niños.
      envejecimiento: nin ? Math.round(100 * may / nin) : null,
      tramoDominante: dominante.id, tramoDominanteEtq: dominante.etiqueta
    };
  }

  async function distribucionEstrato(lat, lng, radioM){
    const p = paramsRadio(lat, lng, radioM);
    p.set('groupByFieldsForStatistics', 'ESTRATO_PREDOMINANTE');
    p.set('outStatistics', JSON.stringify([
      { statisticType:'count', onStatisticField:'OBJECTID', outStatisticFieldName:'N' }
    ]));
    const d = await consultaDANE(DANE_CAPAS.estratoManzana, p);
    if (!d || !d.features) return null;
    const reparto = [];
    let manzanasConEstrato = 0, suma = 0, sinEstrato = 0;
    d.features.forEach(f => {
      const a = f.attributes || {};
      const etq = String(a.ESTRATO_PREDOMINANTE || '').trim();
      const n = a.N || 0;
      if (!etq || !n) return;
      const num = ESTRATO_NUM[etq.toLowerCase()];
      if (num) { reparto.push({ estrato: num, etiqueta: etq, manzanas: n });
                 manzanasConEstrato += n; suma += num * n; }
      else sinEstrato += n;              // "Sin Estrato": industrial, lotes, dotacional
    });
    if (!reparto.length) return null;
    reparto.sort((a, b) => a.estrato - b.estrato);
    const dominante = reparto.slice().sort((a, b) => b.manzanas - a.manzanas)[0];
    return {
      reparto, sinEstrato, manzanasConEstrato,
      promedio: Math.round((suma / manzanasConEstrato) * 10) / 10,
      predominante: dominante.estrato,
      // Rango real presente, que para una inmobiliaria dice más que el promedio:
      // un sector de estrato 3 a 5 no se comercializa igual que uno todo 4.
      minimo: reparto[0].estrato,
      maximo: reparto[reparto.length - 1].estrato
    };
  }

  // Devuelve población, viviendas y estrato reales del radio.
  // Encadena manzana urbana → sector (incluye rural) → null (el motor cae
  // entonces a su estimación heurística de siempre).
  // ── Proyecciones de población del DANE ──────────────────────────────────
  // El censo es de 2018. La tabla del repo guarda las anclas de la serie
  // municipal del DANE y de ahí sale la tasa con la que el motor trae ese
  // conteo hasta hoy. Se lee una sola vez por sesión: es un archivo estático
  // y volver a pedirlo en cada análisis no aporta nada.
  let proyeccionesCache;
  async function leerProyecciones(){
    if (proyeccionesCache !== undefined) return proyeccionesCache;
    try {
      const r = await fetch('assets/data/dane-proyecciones.json', { cache: 'no-cache' });
      proyeccionesCache = r.ok ? await r.json() : null;
    } catch(e) { proyeccionesCache = null; }
    return proyeccionesCache;
  }
  function claveMunicipio(nombre){
    return String(nombre || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  // Tasa anual de crecimiento para un municipio. Devuelve null si no está en
  // la tabla: es preferible mostrar el censo tal cual y decir que no hay
  // proyección para ese municipio, antes que aplicarle la tasa de otro.
  async function proyeccionDe(nombreMunicipio){
    const tabla = await leerProyecciones();
    if (!tabla) return null;
    const k = claveMunicipio(nombreMunicipio);
    const id = (tabla.alias && tabla.alias[k]) || k;
    const m = tabla.municipios && tabla.municipios[id];
    if (!m) return null;
    const tasa = window.AIA_MOTOR.tasaAnualDe(m.anclas);
    if (tasa == null) return null;
    return { tasaAnual: tasa, municipio: m.nombre,
             fuente: tabla.fuente, url: tabla.url, advertencia: tabla.advertencia };
  }

  // ── Manzanas con su estrato, para pintar el mapa ────────────────────────
  //
  // El análisis ya decía "estrato predominante 3". Eso es un promedio, y un
  // promedio esconde justo lo que importa: por dónde pasa el borde entre el
  // estrato 2 y el 4. Con los polígonos en el mapa esa frontera se ve, y para
  // decidir producto y precio vale más que la cifra.
  //
  // Se piden en WGS84 (`outSR=4326`) para poder dibujarlos con Leaflet sin
  // reproyectar, y generalizados (`maxAllowableOffset`) porque en un radio de
  // 1 km son cientos de polígonos y el detalle fino no se distingue: sin eso,
  // el móvil se arrastra al pintarlos.
  const ESTRATO_COLOR = {
    1: '#b91c1c', 2: '#ea580c', 3: '#eab308',
    4: '#22c55e', 5: '#0ea5e9', 6: '#7c3aed', 0: '#6b7280'
  };
  async function manzanasEstrato(lat, lng, radioM){
    const p = paramsRadio(lat, lng, radioM);
    p.set('outFields', 'ESTRATO_PREDOMINANTE');
    p.set('returnGeometry', 'true');
    p.set('outSR', '4326');
    // ~4 m por vértice: suficiente para leer la forma de una manzana.
    p.set('maxAllowableOffset', String(0.00004));
    const d = await consultaDANE(DANE_CAPAS.estratoManzana, p, 25000);
    if (!d || !d.features || !d.features.length) return null;
    const manzanas = [];
    d.features.forEach(f => {
      const anillos = f.geometry && f.geometry.rings;
      if (!anillos || !anillos.length) return;
      const etq = String((f.attributes || {}).ESTRATO_PREDOMINANTE || '').trim();
      const num = ESTRATO_NUM[etq.toLowerCase()] || 0;
      manzanas.push({
        estrato: num,
        // "Sin Estrato" no es un hueco de datos: es suelo industrial,
        // dotacional o lotes. Se pinta en gris y se dice, porque en el mapa
        // un vacío se lee como "no hay información".
        etiqueta: num ? ('Estrato ' + num) : (etq || 'Sin estrato'),
        color: ESTRATO_COLOR[num] || ESTRATO_COLOR[0],
        // Leaflet toma [lat, lng]; ArcGIS entrega [x, y] = [lng, lat].
        anillos: anillos.map(r => r.map(pt => [pt[1], pt[0]]))
      });
    });
    return manzanas.length ? { manzanas: manzanas, colores: ESTRATO_COLOR } : null;
  }

  async function consultarDANE(lat, lng, radioM, municipio){
    let [urbana, viviendas, estrato, demo] = await Promise.all([
      sumaCapa(DANE_CAPAS.personasManzana, lat, lng, radioM, 'SEXO_TOTAL'),
      sumaCapa(DANE_CAPAS.viviendasManzana, lat, lng, radioM, 'TOTAL_VIVIENDAS').catch(() => null),
      distribucionEstrato(lat, lng, radioM).catch(() => null),
      demografia(lat, lng, radioM).catch(() => null)
    ]);
    // Un fallo puntual de red haría creer que el lote está fuera del perímetro
    // urbano y lo mandaría al respaldo de sector, que es mucho más grueso. Se
    // reintenta una vez antes de degradar: la diferencia no es menor (en el
    // Centro, 3.045 hab por manzana contra 10.363 por sector).
    if (!urbana) urbana = await sumaCapa(DANE_CAPAS.personasManzana, lat, lng, radioM, 'SEXO_TOTAL');

    let poblacion = urbana, fuente = 'manzana';
    if (!poblacion || !poblacion.unidades) {
      poblacion = await sumaCapa(DANE_CAPAS.personasSector, lat, lng, radioM, 'SEXO_TOTAL');
      fuente = 'sector';
    }
    if (!poblacion) return null;

    // No bloquea nada: sin tabla o sin municipio, el análisis usa el censo.
    let proy = null;
    try { proy = await proyeccionDe(municipio); } catch(e) { proy = null; }

    return {
      poblacion: poblacion.total,
      unidades: poblacion.unidades,
      // 'manzana' = urbano con detalle fino; 'sector' = incluye rural, más grueso.
      nivel: fuente,
      // Las viviendas son de la capa de MANZANA: si la población terminó
      // saliendo del sector, dividir una por otra daría un absurdo (6,9
      // personas por vivienda). Solo se conserva cuando ambas son del mismo nivel.
      viviendas: (fuente === 'manzana' && viviendas) ? viviendas.total : null,
      estrato,
      // Igual que las viviendas: la demografía es de la capa de manzana, así
      // que no se entrega si la población terminó saliendo del sector.
      demografia: (fuente === 'manzana') ? demo : null,
      censo: 2018,
      etiquetaFuente: 'Censo DANE 2018 · ' + (fuente === 'manzana' ? 'manzana censal' : 'sector censal'),
      // Con esto el motor puede traer el conteo de 2018 hasta el año en curso.
      // Si el municipio no está en la tabla, van en null y el análisis sigue
      // trabajando con el censo tal cual, diciéndolo.
      tasaAnual: proy ? proy.tasaAnual : null,
      anioProyeccion: new Date().getFullYear(),
      fuenteProyeccion: proy ? proy.fuente : '',
      urlProyeccion: proy ? proy.url : '',
      advertenciaProyeccion: proy ? proy.advertencia : ''
    };
  }

  function limpiarCache(){
    try { localStorage.removeItem(CACHE_KEY); return true; } catch(e) { return false; }
  }

  window.AIA_DATOS = { consultarEntorno, consultarEntornoPoligono,
                       limpiarCache, buscarDireccion, parsearEnlaceMaps, ubicacionDe,
                       consultarTrazado, consultarTrazadoPoligono,
                       consultarElevacion, rejillaDe, consultarClima,
                       consultarDANE, proyeccionDe, manzanasEstrato, ESTRATO_COLOR };
})();
