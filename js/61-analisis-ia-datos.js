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
  function construirQuery(lat, lng, radioM){
    const a = '(around:' + Math.round(radioM) + ',' + lat + ',' + lng + ')';
    return '[out:json][timeout:25];(' +
      'nwr["amenity"]' + a + ';' +
      'nwr["shop"]' + a + ';' +
      'nwr["leisure"]' + a + ';' +
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
      ');out center tags 3000;';
  }

  function claveCache(lat, lng, radioM){
    return lat.toFixed(4) + ',' + lng.toFixed(4) + ',' + Math.round(radioM);
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
  async function consultarEntorno(lat, lng, radioM){
    const clave = claveCache(lat, lng, radioM);
    const cacheado = leerCache(clave);
    if (cacheado) return cacheado;

    if (enVuelo) throw new Error('Ya hay una consulta en curso. Espera a que termine.');
    const desde = Date.now() - ultimaConsulta;
    if (desde < MIN_ENTRE_CONSULTAS_MS) {
      throw new Error('Espera ' + Math.ceil((MIN_ENTRE_CONSULTAS_MS - desde) / 1000) + ' segundos antes de otra consulta.');
    }

    enVuelo = true;
    ultimaConsulta = Date.now();
    const query = construirQuery(lat, lng, radioM);
    try {
      // El servidor principal a veces tiene baches breves (504) y se
      // recupera solo en segundos; reintentarlo es más confiable que un
      // espejo que puede estar caído por completo. Tres intentos en total:
      // principal → principal (tras 3s) → espejo (tras 3s más) como último recurso.
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
      // Dedup por type+id y descarte de elementos sin coordenadas.
      const vistos = new Set();
      const limpios = [];
      elementos.forEach(el => {
        const id = el.type + '/' + el.id;
        if (vistos.has(id)) return;
        vistos.add(id);
        const lat2 = el.lat != null ? el.lat : (el.center && el.center.lat);
        const lng2 = el.lon != null ? el.lon : (el.center && el.center.lon);
        if (lat2 == null || lng2 == null || !el.tags) return;
        limpios.push(el);
      });
      guardarCache(clave, limpios);
      return limpios;
    } finally {
      enVuelo = false;
    }
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
      if (!ciudad && !depto && !pais) return null;
      return { ciudad, departamento: depto, pais, barrio,
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

  window.AIA_DATOS = { consultarEntorno, buscarDireccion, parsearEnlaceMaps, ubicacionDe };
})();
