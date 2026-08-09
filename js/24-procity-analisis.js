/* URBIS Pro City · ANÁLISIS DE ÁREA (js/24)
   ─────────────────────────────────────────────────────────────────────────
   Convierte Pro City en herramienta de análisis urbano: el estudiante dibuja
   un área irregular sobre el mapa (un barrio, una manzana, un corredor) y
   obtiene la lectura cuantitativa de TODO lo que la comunidad ya georreferenció
   dentro de ese contorno.

   Diferencia clave con "Análisis de Implantación IA" (js/60-63): aquel consulta
   OpenStreetMap automáticamente para un lote; este mide lo que los propios
   usuarios mapearon a mano en Pro City. Son productos distintos y no se mezclan.

   Este archivo es autónomo: no depende del scope interno de js/20, solo lee
   `globalData` y `map` (globales de URBIS), y se comunica con Pro City por window.URBIS_PC_ANALISIS.

   Sin librerías nuevas a propósito: el dibujo, el punto-en-polígono y el área
   esférica son ~40 líneas cada uno; sumar Leaflet.draw + Turf.js traía dos CDN
   más, su CSS y sus rarezas táctiles para resolver lo mismo. */
(function(){
  'use strict';

  const LS_AREAS = 'pc_areas_analisis_v1';

  // Estado del módulo. `pts` son los vértices del área en curso o cargada.
  const S = {
    dibujando: false,
    pts: [],
    cerrada: false,
    nombre: '',
    capa: null,
    charts: [],
    burbuja: null
  };

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ── Geometría ───────────────────────────────────────────────────────────

  // Ray casting sobre lat/lng. A escala de ciudad la distorsión de no
  // proyectar es irrelevante (centésimas de metro), y evita traer Turf.
  function dentroDelPoligono(lat, lng, pts){
    let dentro = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].lng, yi = pts[i].lat;
      const xj = pts[j].lng, yj = pts[j].lat;
      if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) dentro = !dentro;
    }
    return dentro;
  }

  // Área esférica (fórmula del exceso). Devuelve m².
  function areaM2(pts){
    if (pts.length < 3) return 0;
    const R = 6378137, rad = Math.PI / 180;
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      s += (b.lng - a.lng) * rad * (2 + Math.sin(a.lat * rad) + Math.sin(b.lat * rad));
    }
    return Math.abs(s * R * R / 2);
  }

  function haversineM(a, b){
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat/2)**2 + Math.cos(a.lat*rad) * Math.cos(b.lat*rad) * Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function perimetroM(pts, cerrado){
    if (pts.length < 2) return 0;
    let t = 0;
    for (let i = 0; i < pts.length - 1; i++) t += haversineM(pts[i], pts[i+1]);
    if (cerrado && pts.length >= 3) t += haversineM(pts[pts.length-1], pts[0]);
    return t;
  }

  function fmtArea(m2){
    const ha = m2 / 10000;
    return ha >= 1 ? (Math.round(ha * 100) / 100) + ' ha' : Math.round(m2) + ' m²';
  }
  function fmtDist(m){
    return m >= 1000 ? (Math.round(m / 100) / 10) + ' km' : Math.round(m) + ' m';
  }

  // ── Acceso a los globales de URBIS ──────────────────────────────────────
  // OJO: `map` y `globalData` se declaran con const/let al tope de scripts
  // clásicos (js/03 y js/02), así que son bindings LÉXICOS globales — se leen
  // como `map` a secas, pero NO existen en `window`. De hecho `window.map` es
  // el <div id="map">, que tiene lat/lng de nada: usarlo rompía el dibujo.
  function mapa(){
    try { if (typeof map !== 'undefined' && map && typeof map.addLayer === 'function') return map; } catch(e){}
    return null;
  }
  function datosURBIS(){
    try { if (typeof globalData !== 'undefined' && Array.isArray(globalData)) return globalData; } catch(e){}
    return Array.isArray(window.globalData) ? window.globalData : [];
  }

  // ── Capa del mapa ───────────────────────────────────────────────────────

  function capa(){
    const m = mapa();
    if (!m || typeof L === 'undefined') return null;
    if (!S.capa) S.capa = L.layerGroup().addTo(m);
    return S.capa;
  }

  function repintar(){
    const c = capa();
    if (!c) return;
    c.clearLayers();
    if (!S.pts.length) return;

    const color = '#34CCFE';
    if (S.cerrada && S.pts.length >= 3) {
      // className deja engancharle la animación de entrada por CSS (el trazo
      // se dibuja y el relleno aparece), en vez de dar un salto seco.
      L.polygon(S.pts, { color, weight: 3, fillColor: color, fillOpacity: .14,
        className: 'pca-poligono' }).addTo(c);
    } else if (S.pts.length >= 2) {
      L.polyline(S.pts, { color, weight: 2.5, dashArray: '5 6' }).addTo(c);
    }
    // Vértices visibles solo mientras se dibuja: en un área ya cerrada
    // ensucian la lectura del mapa.
    if (!S.cerrada) {
      const cerrable = S.pts.length >= 3;
      S.pts.forEach((p, i) => {
        const primero = i === 0;
        // El primer vértice es el botón de cerrar (como en Google Earth): en
        // cuanto hay 3 puntos crece, se marca en dorado y avisa que tocándolo
        // se cierra el área.
        const clases = 'pca-vertice' + (primero ? ' primero' : '') + (primero && cerrable ? ' cerrable' : '');
        const m = L.marker(p, {
          interactive: primero && cerrable,
          keyboard: false,
          zIndexOffset: primero ? 1000 : 0,
          icon: L.divIcon({
            className: 'pca-vertice-root',
            html: '<div class="' + clases + '"></div>' +
                  (primero && cerrable ? '<span class="pca-vertice-tip">Toca para cerrar</span>' : ''),
            iconSize: [primero && cerrable ? 22 : 14, primero && cerrable ? 22 : 14],
            iconAnchor: [primero && cerrable ? 11 : 7, primero && cerrable ? 11 : 7]
          })
        }).addTo(c);
        if (primero && cerrable) {
          m.on('click', ev => {
            if (ev && ev.originalEvent) L.DomEvent.stop(ev.originalEvent);
            cerrar();
          });
        }
      });
    }
  }

  function ajustarVista(){
    const m = mapa();
    if (!m || S.pts.length < 3) return;
    // flyToBounds en vez de fitBounds: el encuadre se desliza en vez de saltar,
    // que es justo la transición suave que se pidió al cerrar el área.
    // Se respeta a quien tenga reducido el movimiento en su sistema.
    const bounds = L.polygon(S.pts).getBounds();
    // El relleno se calcula sobre el tamaño REAL del mapa. Con un valor fijo
    // (antes 50/90) una pantalla baja se quedaba casi sin área útil y Leaflet
    // se iba al zoom máximo: el área quedaba gigantesca y su centro —y con él
    // la burbuja— terminaba en una esquina, lejos de lo dibujado.
    const t = m.getSize();
    const px = Math.max(12, Math.min(48, Math.round(t.x * 0.12)));
    const py = Math.max(12, Math.min(70, Math.round(t.y * 0.14)));
    // maxZoom evita que un área diminuta dispare el mapa al zoom máximo.
    const opts = { padding: [px, py], maxZoom: 18 };
    const quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      if (quieto || typeof m.flyToBounds !== 'function') m.fitBounds(bounds, opts);
      else m.flyToBounds(bounds, Object.assign({ duration: .8 }, opts));
    } catch(e){}
  }

  // ── Barra flotante de dibujo ────────────────────────────────────────────

  // La barra va DENTRO de #urbis-mobile-app a propósito: el delegador de clics
  // de Pro City (js/20) escucha en ese contenedor, no en document. Colgándola
  // del body quedaba fuera de su alcance y sus botones no respondían — por eso
  // "Dibujar" (que sí vive en el panel) funcionaba y "Cerrar área" no.
  function barra(){
    let b = document.getElementById('pca-barra');
    if (!b) {
      b = document.createElement('div');
      b.id = 'pca-barra';
      b.hidden = true;
      (document.getElementById('urbis-mobile-app') || document.body).appendChild(b);
    }
    return b;
  }

  function pintarBarra(){
    const b = barra();
    if (!S.dibujando) { b.hidden = true; return; }
    const n = S.pts.length;
    const listo = n >= 3;
    b.innerHTML =
      '<div class="pca-barra-info">' +
        '<b>' + n + ' punto' + (n === 1 ? '' : 's') + '</b>' +
        '<small>' + (listo
          ? fmtArea(areaM2(S.pts)) + ' · borde ' + fmtDist(perimetroM(S.pts, true)) +
            ' — o toca el punto dorado para cerrar'
          : 'Toca el mapa para marcar el contorno (mínimo 3 puntos)') + '</small>' +
      '</div>' +
      '<div class="pca-barra-btns">' +
        '<button type="button" data-u52-call="pca-deshacer"' + (n ? '' : ' disabled') + '>↩️</button>' +
        '<button type="button" data-u52-call="pca-cancelar">✕</button>' +
        '<button type="button" class="pca-ok" data-u52-call="pca-cerrar"' + (listo ? '' : ' disabled') + '>✓ Cerrar área</button>' +
      '</div>';
    b.hidden = false;
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────

  function iniciarDibujo(){
    if (!mapa()) { alert('El mapa aún no está listo.'); return; }
    cerrarBurbuja();
    S.dibujando = true;
    S.cerrada = false;
    S.pts = [];
    S.nombre = '';
    repintar();
    pintarBarra();
    try { mapa().getContainer().style.cursor = 'crosshair'; } catch(e){}
  }

  function agregarPunto(lat, lng){
    if (!S.dibujando) return;
    // Con el dedo es difícil acertar justo sobre el vértice, así que tocar
    // CERCA del primer punto (≤26 px en pantalla) también cierra el área.
    // Se mide en píxeles y no en metros a propósito: a menos zoom, 26 px son
    // muchos metros, y lo que el usuario percibe es la distancia en pantalla.
    if (S.pts.length >= 3) {
      const m = mapa();
      try {
        const a = m.latLngToContainerPoint(S.pts[0]);
        const b = m.latLngToContainerPoint({ lat, lng });
        if (Math.hypot(a.x - b.x, a.y - b.y) <= 26) { cerrar(); return; }
      } catch(e){}
    }
    S.pts.push({ lat, lng });
    repintar();
    pintarBarra();
  }

  function deshacer(){
    if (!S.dibujando || !S.pts.length) return;
    S.pts.pop();
    repintar();
    pintarBarra();
  }

  function cancelar(){
    cerrarBurbuja();
    S.dibujando = false;
    S.pts = [];
    S.cerrada = false;
    repintar();
    pintarBarra();
    try { mapa().getContainer().style.cursor = ''; } catch(e){}
  }

  function cerrar(){
    if (S.pts.length < 3) return;
    S.dibujando = false;
    S.cerrada = true;
    repintar();
    pintarBarra();
    try { mapa().getContainer().style.cursor = ''; } catch(e){}
    // NO se salta directo a las estadísticas: primero se deja ver el área
    // dibujada sobre el mapa (encuadrándola con una animación suave) y se
    // ofrece entrar al análisis desde una burbuja. Dibujar y que la pantalla
    // se te lleve de una no deja apreciar lo que acabas de trazar.
    ajustarVista();
    // La burbuja espera a que el encuadre termine: si aparece durante el
    // vuelo se ve arrastrada por el mapa. `moveend` no siempre dispara (si el
    // área ya estaba encuadrada el mapa no se mueve), así que hay respaldo.
    const m = mapa();
    let abierta = false;
    const abrir = () => { if (!abierta) { abierta = true; burbuja(); } };
    if (m) { m.once('moveend', abrir); setTimeout(abrir, 950); }
    else abrir();
  }

  // ── Burbuja de confirmación sobre el mapa ───────────────────────────────

  function centroide(pts){
    // Centroide del polígono (no el promedio de vértices): en formas alargadas
    // o en L, el promedio se va hacia donde hay más puntos y la burbuja
    // terminaría fuera de la figura.
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const f = p.lng * q.lat - q.lng * p.lat;
      a += f; cx += (p.lng + q.lng) * f; cy += (p.lat + q.lat) * f;
    }
    if (!a) {
      return { lat: pts.reduce((s,p)=>s+p.lat,0)/pts.length,
               lng: pts.reduce((s,p)=>s+p.lng,0)/pts.length };
    }
    a *= 0.5;
    return { lat: cy / (6 * a), lng: cx / (6 * a) };
  }

  function cerrarBurbuja(){
    if (!S.burbuja) return;
    const m = mapa();
    if (m) m.off('move zoom moveend zoomend viewreset', colocarBurbuja);
    try { S.burbuja.remove(); } catch(e){}
    S.burbuja = null;
  }

  // Coloca la burbuja sobre el centroide, en coordenadas de pantalla, y la
  // mantiene DENTRO del mapa: si el ancla queda cerca de un borde, se recuesta
  // contra él en vez de salirse.
  function colocarBurbuja(){
    const m = mapa();
    if (!m || !S.burbuja || S.pts.length < 3) return;
    const p = m.latLngToContainerPoint(centroide(S.pts));
    const t = m.getSize();
    const w = S.burbuja.offsetWidth || 214, h = S.burbuja.offsetHeight || 190;
    const margen = 8;
    let x = p.x - w / 2;
    let y = p.y - h - 14;                     // por encima del punto
    if (y < margen) y = Math.min(p.y + 16, t.y - h - margen);  // si no cabe arriba, va abajo
    x = Math.max(margen, Math.min(x, t.x - w - margen));
    y = Math.max(margen, Math.min(y, t.y - h - margen));
    S.burbuja.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';
  }

  // Burbuja propia en vez del popup de Leaflet: el popup se cerraba con
  // cualquier toque del mapa y su posicionamiento interno chocaba con el CSS
  // (quedaba fuera de pantalla). Este div se coloca a mano y solo se va con
  // su ✕, así que no se pierde sin querer.
  function burbuja(){
    const m = mapa();
    if (!m || !S.cerrada) return;
    cerrarBurbuja();
    const b = document.createElement('div');
    b.className = 'pca-burbuja';
    b.innerHTML =
      '<div class="pca-burbuja-cab"><span>✏️</span><b>Área lista</b>' +
        '<button type="button" class="pca-burbuja-x" data-u52-call="pca-cerrar-burbuja" aria-label="Cerrar">✕</button></div>' +
      '<div class="pca-burbuja-datos">' + fmtArea(areaM2(S.pts)) +
        ' · ' + S.pts.length + ' vértices</div>' +
      '<button type="button" class="pca-burbuja-ok" data-u52-call="pca-ver-analisis">📊 Ver el análisis</button>' +
      '<div class="pca-burbuja-alt">' +
        '<button type="button" data-u52-call="pca-guardar">💾 Guardar</button>' +
        '<button type="button" data-u52-call="pca-dibujar">✏️ Rehacer</button>' +
      '</div>';
    // Los toques dentro de la burbuja no deben llegar al mapa (arrastrarlo ni
    // contar como clic en el terreno).
    if (L && L.DomEvent) { L.DomEvent.disableClickPropagation(b); L.DomEvent.disableScrollPropagation(b); }
    m.getContainer().appendChild(b);
    S.burbuja = b;
    colocarBurbuja();
    m.on('move zoom moveend zoomend viewreset', colocarBurbuja);
  }

  function limpiarArea(){
    cerrarBurbuja();
    S.pts = []; S.cerrada = false; S.nombre = ''; S.dibujando = false;
    repintar(); pintarBarra();
  }

  // ── Áreas guardadas ─────────────────────────────────────────────────────

  function leerAreas(){
    try { const a = JSON.parse(localStorage.getItem(LS_AREAS) || '[]'); return Array.isArray(a) ? a : []; }
    catch(e){ return []; }
  }
  function escribirAreas(a){
    try { localStorage.setItem(LS_AREAS, JSON.stringify(a.slice(0, 40))); } catch(e){}
  }
  function guardarArea(){
    if (!S.cerrada || S.pts.length < 3) return;
    const nombre = (prompt('¿Qué nombre le pones a esta área?\nEj. "Barrio La Libertad", "Corredor Av. Libertadores"', S.nombre || '') || '').trim();
    if (!nombre) return;
    const areas = leerAreas();
    areas.unshift({
      id: 'a' + Date.now(), nombre, pts: S.pts.slice(),
      fecha: new Date().toISOString(), areaM2: Math.round(areaM2(S.pts))
    });
    escribirAreas(areas);
    S.nombre = nombre;
    if (typeof window.urbisProCityAbrirAnalisis === 'function') window.urbisProCityAbrirAnalisis();
  }
  function cargarArea(id){
    const a = leerAreas().find(x => x.id === id);
    if (!a) return;
    S.pts = a.pts.slice(); S.cerrada = true; S.dibujando = false; S.nombre = a.nombre;
    repintar(); pintarBarra(); ajustarVista();
    if (typeof window.urbisProCityAbrirAnalisis === 'function') window.urbisProCityAbrirAnalisis();
  }
  function borrarArea(id){
    if (!confirm('¿Borrar esta área guardada?')) return;
    escribirAreas(leerAreas().filter(x => x.id !== id));
    if (typeof window.urbisProCityAbrirAnalisis === 'function') window.urbisProCityAbrirAnalisis();
  }

  // ── Cálculo sobre los puntos mapeados ───────────────────────────────────

  // `ctx` lo entrega js/20 con lo que solo él conoce (grupos de la Matriz,
  // colores, cómo sacar el uso de un punto, quién es el autor).
  function calcular(ctx){
    const todos = datosURBIS();
    const dentro = todos.filter(p => {
      if (!p) return false;
      const lat = parseFloat(String(p.lat || '').replace(',', '.'));
      const lng = parseFloat(String(p.lng || '').replace(',', '.'));
      if (isNaN(lat) || isNaN(lng)) return false;
      return dentroDelPoligono(lat, lng, S.pts);
    });

    // Solo lo que pertenece a Pro City: los reportes ciudadanos y eventos no
    // son mapeo urbano y falsearían el conteo.
    const pc = dentro.filter(p => ctx.esProCity(p.tipo));

    const porGrupo = {};
    ctx.grupos.forEach(g => { porGrupo[g.id] = 0; });
    let totalMatriz = 0;
    const porDimension = {};

    pc.forEach(p => {
      const tipo = String(p.tipo || '');
      porDimension[tipo] = (porDimension[tipo] || 0) + 1;
      if (tipo !== ctx.matrizKey) return;
      const uso = ctx.usoDe(p);
      const g = ctx.grupos.find(gr => gr.usos.includes(uso));
      const gid = g ? g.id : 'mixtos';
      porGrupo[gid] = (porGrupo[gid] || 0) + 1;
      totalMatriz++;
    });

    const m2 = areaM2(S.pts);
    const ha = m2 / 10000;
    return {
      puntos: pc,
      total: pc.length,
      totalMatriz,
      porGrupo, porDimension,
      areaM2: m2, areaHa: ha,
      perimetroM: perimetroM(S.pts, true),
      densidad: ha > 0 ? Math.round((pc.length / ha) * 10) / 10 : 0,
      mios: pc.filter(p => ctx.esPropio(p)).length,
      deOtros: pc.filter(p => !ctx.esPropio(p)).length
    };
  }

  // ── Panel de la pestaña "Análisis" ──────────────────────────────────────

  // Miniatura del área guardada: en vez del 🗺️ genérico se dibuja el contorno
  // REAL del polígono, normalizado a la casilla. Así cada área guardada se
  // reconoce por su forma, que es lo que el usuario recuerda de ella.
  function miniaturaArea(pts){
    if (!pts || pts.length < 3) return '';
    const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
    const y0 = Math.min(...lats), y1 = Math.max(...lats);
    const x0 = Math.min(...lngs), x1 = Math.max(...lngs);
    const w = (x1 - x0) || 1e-9, h = (y1 - y0) || 1e-9;
    const esc2 = Math.min(30 / w, 30 / h);          // cabe en 30×30 sin deformar
    const dx = (34 - w * esc2) / 2, dy = (34 - h * esc2) / 2;
    const d = pts.map((p, i) =>
      (i ? 'L' : 'M') + (dx + (p.lng - x0) * esc2).toFixed(1) + ' ' +
      (dy + (y1 - p.lat) * esc2).toFixed(1)).join(' ') + ' Z';
    return '<svg class="pca-mini" viewBox="0 0 34 34" aria-hidden="true">' +
      '<path d="' + d + '" fill="rgba(52,204,254,.22)" stroke="#0E86BE" stroke-width="2" ' +
      'stroke-linejoin="round"/></svg>';
  }

  function htmlSinArea(){
    const areas = leerAreas();
    const guardadas = areas.length ? (
      '<div class="pca-guardadas"><b>Áreas guardadas</b>' +
      areas.map(a =>
        '<div class="pca-guardada">' +
          '<button type="button" class="pca-guardada-abrir" data-u52-call="pca-cargar" data-id="' + esc(a.id) + '">' +
            miniaturaArea(a.pts) + '<div><b>' + esc(a.nombre) + '</b>' +
            '<small>' + fmtArea(a.areaM2 || 0) + ' · ' + a.pts.length + ' vértices</small></div>' +
          '</button>' +
          '<button type="button" class="pca-guardada-borrar" data-u52-call="pca-borrar" data-id="' + esc(a.id) + '" aria-label="Borrar">🗑️</button>' +
        '</div>').join('') +
      '</div>'
    ) : '';

    return '<div class="pca-panel">' +
      '<div class="pca-intro">' +
        '<span class="pca-intro-ico">✏️</span>' +
        '<div><b>Dibuja el área que quieres analizar</b>' +
        '<small>Marca el contorno de un barrio, una manzana o un corredor y URBIS cuenta todo lo que la comunidad ya mapeó adentro — sin depender del radio de la ciudad.</small></div>' +
      '</div>' +
      '<button type="button" class="pca-btn-principal" data-u52-call="pca-dibujar">✏️ Dibujar área en el mapa</button>' +
      guardadas +
    '</div>';
  }

  function htmlPanel(ctx){
    if (!S.cerrada || S.pts.length < 3) return htmlSinArea();

    const r = calcular(ctx);
    window.__pcaUltimo = r;   // lo lee montar() para pintar las gráficas

    const filas = ctx.grupos
      .map(g => ({ g, n: r.porGrupo[g.id] || 0 }))
      .sort((a, b) => b.n - a.n);

    const barras = filas.map(({ g, n }) => {
      const pct = r.totalMatriz ? Math.round((n / r.totalMatriz) * 100) : 0;
      const color = ctx.colorGrupo[g.id] || '#6b70e0';
      return '<div class="pca-bar-row">' +
        '<div class="pca-bar-label"><span>' + g.i + '</span><b>' + esc(g.t) + '</b><small>' + n + ' · ' + pct + '%</small></div>' +
        '<div class="pca-bar-track"><div class="pca-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      '</div>';
    }).join('');

    const dims = Object.keys(r.porDimension).sort((a, b) => r.porDimension[b] - r.porDimension[a]);
    const tablaDims = dims.length ? (
      '<table class="pca-tabla"><tr><th>Dimensión mapeada</th><th>Puntos</th><th>%</th></tr>' +
      dims.map(d => {
        const n = r.porDimension[d];
        const pct = r.total ? Math.round((n / r.total) * 100) : 0;
        return '<tr><td>' + esc(d) + '</td><td class="n">' + n + '</td><td class="n">' + pct + '%</td></tr>';
      }).join('') + '</table>'
    ) : '';

    const kpi = (v, t) => '<div class="pca-kpi"><b>' + v + '</b><small>' + t + '</small></div>';

    return '<div class="pca-panel">' +
      '<div class="pca-cabeza">' +
        '<div><b>' + esc(S.nombre || 'Área sin nombre') + '</b>' +
        '<small>' + fmtArea(r.areaM2) + ' · borde ' + fmtDist(r.perimetroM) + ' · ' + S.pts.length + ' vértices</small></div>' +
        '<div class="pca-cabeza-btns">' +
          '<button type="button" data-u52-call="pca-guardar" aria-label="Guardar área">💾</button>' +
          '<button type="button" data-u52-call="pca-dibujar" aria-label="Dibujar otra">✏️</button>' +
          '<button type="button" data-u52-call="pca-limpiar" aria-label="Quitar área">✕</button>' +
        '</div>' +
      '</div>' +

      '<div class="pca-kpis">' +
        kpi(r.total, 'puntos mapeados') +
        kpi(r.densidad, 'por hectárea') +
        kpi(r.mios, 'míos') +
        kpi(r.deOtros, 'de otros') +
      '</div>' +

      (r.total === 0
        ? '<div class="pca-vacio">Dentro de esta área todavía no hay nada mapeado en Pro City. Mapea elementos aquí y vuelve a abrir el análisis.</div>'
        : '<h4 class="pca-h">🏙️ Composición por Matriz de Usos</h4>' +
          (r.totalMatriz
            ? '<div class="pca-chart-wrap"><canvas id="pca-chart-grupos" height="200"></canvas></div>' + barras
            : '<div class="pca-vacio">En esta área no hay elementos de la Matriz de Usos todavía.</div>') +

          '<h4 class="pca-h">🧩 Reparto por dimensión de Pro City</h4>' +
          '<div class="pca-chart-wrap"><canvas id="pca-chart-dims" height="200"></canvas></div>' +
          tablaDims
      ) +

      '<p class="pca-nota">Cuenta lo que los usuarios de URBIS georreferenciaron a mano dentro del contorno. No es un censo: refleja el mapeo disponible hoy.</p>' +
    '</div>';
  }

  // Las gráficas se montan DESPUÉS de inyectar el HTML, porque Chart.js
  // necesita que el canvas ya esté en el documento. Y además en el siguiente
  // frame: recién puesto el innerHTML el navegador todavía no calculó el
  // layout, así que Chart.js medía el contenedor en 0 y dibujaba un lienzo
  // de 0×0 — la gráfica existía pero no se veía.
  function montar(ctx){
    S.charts.forEach(c => { try { c.destroy(); } catch(e){} });
    S.charts = [];
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => crearCharts(ctx));
    else crearCharts(ctx);
  }

  function crearCharts(ctx){
    const r = window.__pcaUltimo;
    if (!r || typeof Chart === 'undefined') return;

    const cvG = document.getElementById('pca-chart-grupos');
    if (cvG && r.totalMatriz) {
      const filas = ctx.grupos.map(g => ({ g, n: r.porGrupo[g.id] || 0 }))
        .filter(x => x.n > 0).sort((a, b) => b.n - a.n);
      S.charts.push(new Chart(cvG, {
        type: 'bar',
        data: { labels: filas.map(x => x.g.t), datasets: [{
          data: filas.map(x => x.n),
          backgroundColor: filas.map(x => ctx.colorGrupo[x.g.id] || '#6b70e0'),
          borderRadius: 4
        }]},
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#5a6a7a', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,.06)' } },
            y: { ticks: { color: '#2f3f4e', font: { size: 10 } }, grid: { display: false } }
          }
        }
      }));
    }

    const cvD = document.getElementById('pca-chart-dims');
    if (cvD) {
      const dims = Object.keys(r.porDimension).sort((a, b) => r.porDimension[b] - r.porDimension[a]);
      const paleta = ['#34CCFE','#FABD0A','#22c55e','#e5484d','#a855f7','#14b8a6','#ff8a4a','#6366f1','#ec4899','#8b6f47'];
      S.charts.push(new Chart(cvD, {
        type: 'doughnut',
        data: { labels: dims.map(d => d.replace(/^[^\w\sáéíóúñ]+\s*/i, '')), datasets: [{
          data: dims.map(d => r.porDimension[d]),
          backgroundColor: dims.map((_, i) => paleta[i % paleta.length]),
          borderColor: '#fff', borderWidth: 2
        }]},
        options: {
          responsive: true, maintainAspectRatio: false, animation: false, cutout: '55%',
          plugins: { legend: { position: 'right', labels: { color: '#2f3f4e', font: { size: 10 }, boxWidth: 10, padding: 6 } } }
        }
      }));
    }
  }

  // ── Acciones (las despacha js/20 desde su delegador de clics) ───────────

  function accion(name, el){
    if (name === 'dibujar')  { if (typeof window.urbisProCityCerrarStats === 'function') window.urbisProCityCerrarStats(); iniciarDibujo(); return true; }
    if (name === 'ver-analisis') { cerrarBurbuja(); if (typeof window.urbisProCityAbrirAnalisis === 'function') window.urbisProCityAbrirAnalisis(); return true; }
    if (name === 'cerrar-burbuja') { cerrarBurbuja(); return true; }
    if (name === 'deshacer') { deshacer(); return true; }
    if (name === 'cancelar') { cancelar(); return true; }
    if (name === 'cerrar')   { cerrar(); return true; }
    if (name === 'guardar')  { guardarArea(); return true; }
    if (name === 'limpiar')  { limpiarArea(); if (typeof window.urbisProCityAbrirAnalisis === 'function') window.urbisProCityAbrirAnalisis(); return true; }
    if (name === 'cargar')   { cargarArea(el && el.dataset.id); return true; }
    if (name === 'borrar')   { borrarArea(el && el.dataset.id); return true; }
    return false;
  }

  // El delegador de clics de js/20 escucha DENTRO de #urbis-mobile-app, pero
  // #map es hermano suyo, no hijo: todo lo que Leaflet dibuja (los popups de
  // la burbuja) queda fuera de su alcance. Este listener atiende justamente
  // esos casos, y se abstiene cuando el botón sí está dentro de la app para
  // no ejecutar la acción dos veces.
  document.addEventListener('click', function(ev){
    const b = ev.target.closest && ev.target.closest('[data-u52-call^="pca-"]');
    if (!b || b.closest('#urbis-mobile-app')) return;
    ev.preventDefault();
    accion(b.getAttribute('data-u52-call').slice(4), b);
  });

  window.URBIS_PC_ANALISIS = {
    estaDibujando: () => S.dibujando,
    burbujaAbierta: () => !!S.burbuja,
    hayArea: () => S.cerrada && S.pts.length >= 3,
    agregarPunto, iniciarDibujo, cancelar, limpiarArea,
    htmlPanel, montar, accion,
    // Lo usan las siguientes fases (heatmap, geometría, exportación).
    puntosDelArea: () => S.pts.slice(),
    dentroDelPoligono, areaM2, perimetroM
  };
})();
