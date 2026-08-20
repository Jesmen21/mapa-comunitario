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
    burbuja: null,
    // Mapa de calor: `grupo` es un id de la Matriz o 'todos'; null = apagado.
    heat: { grupo: null, canvas: null, chip: null, pintando: false },
    // Fase 3 · geometría generada: `tipo` es 'red' | 'hull' | 'circulos'
    // (null = apagada) y `grupo` filtra QUÉ puntos se conectan ('todos' o
    // una categoría de la Matriz).
    geo: { tipo: null, grupo: 'todos', capa: null, chip: null, ultimoConteo: 0 },
    // Fase 4 · último análisis de cobertura del suelo del área en curso, y la
    // capa donde queda pegada la imagen clasificada sobre el mapa.
    raster: null,
    rasterCapa: null,
    rasterChip: null
  };

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // Analitica de uso (Fase 5). Nunca se le pasa contenido del analisis, solo
  // el nombre del evento y como mucho un conteo.
  function reg(ev, extra){
    try { if (window.URBIS_PC_ANALITICA) window.URBIS_PC_ANALITICA.registrar(ev, extra); } catch(e){}
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
    reg('area-dibujo-inicio');
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
    if (S.dibujando) reg('area-cancelada');
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
    reg('area-cerrada', { n: S.pts.length });
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
    const abrir = () => {
      if (abierta) return;
      abierta = true;
      burbuja();
      // El calor se filtra por el área: al cerrar una nueva hay que rehacerlo.
      if (S.heat.grupo) { try { pintarHeat(); } catch(e){} }
      try { refrescarGeo(); } catch(e){}
      S.raster = null; apagarRasterMapa();
    };
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
    window.__pcaNombreArea = '';
    repintar(); pintarBarra();
    // El calor y la geometría se filtran por el área: si el área cambia, se limpian.
    if (S.heat.grupo) { try { pintarHeat(); } catch(e){} }
    if (S.geo.tipo) apagarGeo();
    S.raster = null; apagarRasterMapa();
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
    reg('area-guardada');
    S.nombre = nombre;
    window.__pcaNombreArea = nombre;
    if (typeof window.urbisProCityAbrirAnalisis === 'function') window.urbisProCityAbrirAnalisis();
  }
  function cargarArea(id){
    const a = leerAreas().find(x => x.id === id);
    if (!a) return;
    reg('area-cargada');
    S.pts = a.pts.slice(); S.cerrada = true; S.dibujando = false; S.nombre = a.nombre;
    window.__pcaNombreArea = a.nombre;
    repintar(); pintarBarra(); ajustarVista();
    try { refrescarGeo(); } catch(e){}
    S.raster = null; apagarRasterMapa();
    if (typeof window.urbisProCityAbrirAnalisis === 'function') window.urbisProCityAbrirAnalisis();
  }
  function borrarArea(id){
    if (!confirm('¿Borrar esta área guardada?')) return;
    escribirAreas(leerAreas().filter(x => x.id !== id));
    if (typeof window.urbisProCityAbrirAnalisis === 'function') window.urbisProCityAbrirAnalisis();
  }

  // ── Mapa de calor (Fase 2) ──────────────────────────────────────────────
  // Implementado sobre canvas en vez de traer Leaflet.heat: son ~70 líneas,
  // no añade otra dependencia de CDN (importa para una PWA que debe abrir sin
  // red) y permite teñir el calor con el color real de cada grupo de la
  // Matriz, que es justo lo que hace legible el mapa para un estudiante.

  // Rampa multicolor para "todos los usos"; para un grupo concreto se genera
  // una rampa de un solo tono a partir de su color de la Matriz.
  const RAMPA_TODOS = [[0,'#2b6cff'],[.35,'#22d3ee'],[.55,'#22c55e'],[.75,'#facc15'],[1,'#ef4444']];

  function hexRGB(h){
    h = String(h||'#888').replace('#','');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }

  // Tabla de 256 colores: convertir intensidad→color por píxel a mano sería
  // lentísimo, así que se precalcula una sola vez por capa.
  function tablaColor(color){
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 1;
    const g = cv.getContext('2d'), grad = g.createLinearGradient(0, 0, 256, 0);
    if (color) {
      const [r,vv,b] = hexRGB(color);
      grad.addColorStop(0,   'rgb(' + Math.min(255,r+90) + ',' + Math.min(255,vv+90) + ',' + Math.min(255,b+90) + ')');
      grad.addColorStop(0.55,'rgb(' + r + ',' + vv + ',' + b + ')');
      grad.addColorStop(1,   'rgb(' + Math.round(r*0.6) + ',' + Math.round(vv*0.6) + ',' + Math.round(b*0.6) + ')');
    } else {
      RAMPA_TODOS.forEach(([p, c]) => grad.addColorStop(p, c));
    }
    g.fillStyle = grad; g.fillRect(0, 0, 256, 1);
    return g.getImageData(0, 0, 256, 1).data;
  }

  // Puntos que alimentan el calor: si hay un área cerrada, solo los de dentro.
  function puntosParaHeat(ctx){
    const gid = S.heat.grupo;
    const hayArea = S.cerrada && S.pts.length >= 3;
    const out = [];
    datosURBIS().forEach(p => {
      if (!p || !ctx.esProCity(p.tipo)) return;
      const lat = parseFloat(String(p.lat || '').replace(',', '.'));
      const lng = parseFloat(String(p.lng || '').replace(',', '.'));
      if (isNaN(lat) || isNaN(lng)) return;
      if (hayArea && !dentroDelPoligono(lat, lng, S.pts)) return;
      if (gid && gid !== 'todos') {
        if (String(p.tipo) !== ctx.matrizKey) return;
        const g = ctx.grupos.find(gr => gr.usos.includes(ctx.usoDe(p)));
        if ((g ? g.id : 'mixtos') !== gid) return;
      }
      out.push({ lat, lng });
    });
    return out;
  }

  function pintarHeat(){
    const m = mapa(), cv = S.heat.canvas;
    if (!m || !cv || !S.heat.grupo) return;
    const ctx = (typeof window.urbisProCityCtxAnalisis === 'function') ? window.urbisProCityCtxAnalisis() : null;
    if (!ctx) return;

    const t = m.getSize();
    // Si el mapa está oculto (al cambiar de pantalla, por ejemplo) su tamaño
    // es 0: repintar ahí dejaría el lienzo en 0×0 y el calor no volvería solo.
    // Se conserva lo pintado y se reintenta cuando el mapa recupere tamaño.
    if (!t.x || !t.y) {
      clearTimeout(S.heat.reintento);
      // Se reintenta un rato y se para: si el usuario se fue a otra pantalla,
      // un temporizador cada 400 ms quedaría sonando indefinidamente. Al
      // volver al mapa, el evento `resize` vuelve a disparar el pintado.
      if ((S.heat.intentos = (S.heat.intentos || 0) + 1) <= 12) {
        S.heat.reintento = setTimeout(() => { try { pintarHeat(); } catch(e){} }, 400);
      }
      return;
    }
    S.heat.intentos = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(t.x * dpr); cv.height = Math.round(t.y * dpr);
    cv.style.width = t.x + 'px'; cv.style.height = t.y + 'px';
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, t.x, t.y);

    const pts = puntosParaHeat(ctx);
    if (!pts.length) { S.heat.ultimoConteo = 0; actualizarChipHeat(); return; }

    // El radio crece con el zoom: a poco zoom los puntos se juntan y con un
    // radio fijo el mapa se convertiría en una mancha uniforme.
    const z = m.getZoom();
    const radio = Math.max(14, Math.min(46, 10 + (z - 12) * 5));

    // 1) Acumular intensidad en escala de grises (alfa).
    let dentro = 0;
    g.globalAlpha = 0.35;
    pts.forEach(p => {
      const q = m.latLngToContainerPoint(p);
      if (q.x < -radio || q.y < -radio || q.x > t.x + radio || q.y > t.y + radio) return;
      dentro++;
      const rg = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, radio);
      rg.addColorStop(0, 'rgba(0,0,0,1)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(q.x, q.y, radio, 0, Math.PI * 2); g.fill();
    });
    g.globalAlpha = 1;
    S.heat.ultimoConteo = dentro;

    // 2) Teñir: el alfa acumulado indexa la tabla de color.
    const color = (S.heat.grupo === 'todos') ? null : (ctx.colorGrupo[S.heat.grupo] || '#6b70e0');
    const lut = tablaColor(color);
    const img = g.getImageData(0, 0, cv.width, cv.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (!a) continue;
      const j = a * 4;
      d[i] = lut[j]; d[i + 1] = lut[j + 1]; d[i + 2] = lut[j + 2];
      // Techo de opacidad: el calor va por encima de los marcadores, así que
      // debe dejar ver los puntos y las calles que hay debajo.
      d[i + 3] = Math.min(180, a + 25);
    }
    g.putImageData(img, 0, 0);
    actualizarChipHeat();
  }

  // Durante el arrastre no se repinta en cada frame (sería pesado con miles de
  // puntos): se atenúa el lienzo y se recalcula al soltar.
  function heatEnMovimiento(){ if (S.heat.canvas) S.heat.canvas.style.opacity = '.35'; }
  function heatQuieto(){
    if (!S.heat.canvas) return;
    S.heat.canvas.style.opacity = '1';
    if (S.heat.pintando) return;
    S.heat.pintando = true;
    requestAnimationFrame(() => { S.heat.pintando = false; try { pintarHeat(); } catch(e){} });
  }

  function encenderHeat(gid){
    const m = mapa();
    if (!m) return;
    S.heat.grupo = gid;
    if (!S.heat.canvas) {
      const cv = document.createElement('canvas');
      cv.className = 'pca-heat';
      m.getContainer().appendChild(cv);
      S.heat.canvas = cv;
      m.on('movestart zoomstart', heatEnMovimiento);
      m.on('moveend zoomend resize', heatQuieto);
    }
    chipHeat();
    pintarHeat();
  }

  function apagarHeat(){
    const m = mapa();
    clearTimeout(S.heat.reintento);
    if (S.heat.canvas) {
      if (m) { m.off('movestart zoomstart', heatEnMovimiento); m.off('moveend zoomend resize', heatQuieto); }
      try { S.heat.canvas.remove(); } catch(e){}
      S.heat.canvas = null;
    }
    if (S.heat.chip) { try { S.heat.chip.remove(); } catch(e){} S.heat.chip = null; }
    S.heat.grupo = null;
  }

  // Chip sobre el mapa: recuerda qué capa está encendida y permite apagarla
  // sin volver a abrir el panel.
  function chipHeat(){
    const m = mapa();
    if (!m) return;
    if (!S.heat.chip) {
      const c = document.createElement('div');
      c.className = 'pca-heat-chip';
      if (L && L.DomEvent) L.DomEvent.disableClickPropagation(c);
      m.getContainer().appendChild(c);
      S.heat.chip = c;
    }
    actualizarChipHeat();
  }

  function actualizarChipHeat(){
    if (!S.heat.chip || !S.heat.grupo) return;
    const ctx = (typeof window.urbisProCityCtxAnalisis === 'function') ? window.urbisProCityCtxAnalisis() : null;
    const g = ctx && S.heat.grupo !== 'todos' ? ctx.grupos.find(x => x.id === S.heat.grupo) : null;
    const color = S.heat.grupo === 'todos' ? '#ef4444' : ((ctx && ctx.colorGrupo[S.heat.grupo]) || '#6b70e0');
    const n = S.heat.ultimoConteo || 0;
    S.heat.chip.innerHTML =
      '<i style="background:' + color + '"></i>' +
      '<div><b>' + (g ? g.i + ' ' + esc(g.t) : '🔥 Todos los usos') + '</b>' +
      '<small>' + n + ' punto' + (n === 1 ? '' : 's') + ' en pantalla' +
      (S.cerrada && S.pts.length >= 3 ? ' · dentro del área' : '') + '</small></div>' +
      '<button type="button" data-u52-call="pca-heat-off" aria-label="Quitar mapa de calor">✕</button>';
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

  // Selector del mapa de calor. Va tanto con área dibujada como sin ella:
  // sin área, el calor cubre todo lo mapeado; con área, solo lo de adentro.
  function bloqueHeat(ctx){
    const act = S.heat.grupo;
    const chip = (id, ico, txt, color) =>
      '<button type="button" class="pca-heat-btn' + (act === id ? ' activo' : '') + '" ' +
      'data-u52-call="pca-heat" data-gid="' + esc(id) + '" ' +
      'style="--c:' + (color || '#ef4444') + '">' +
      '<i></i><span>' + ico + ' ' + esc(txt) + '</span></button>';
    return '<div class="pca-heat-sel">' +
      '<h4 class="pca-h pca-h-heat">🔥 Mapa de calor</h4>' +
      '<p class="pca-heat-ayuda">Muestra dónde se concentra lo mapeado. Elige una categoría y el panel se cierra para que lo veas sobre el mapa.</p>' +
      '<div class="pca-heat-chips">' +
        chip('todos', '🔥', 'Todos los usos', '#ef4444') +
        ctx.grupos.map(g => chip(g.id, g.i, g.t, ctx.colorGrupo[g.id])).join('') +
      '</div>' +
      (act ? '<button type="button" class="pca-heat-off" data-u52-call="pca-heat-off">✕ Quitar el mapa de calor</button>' : '') +
    '</div>';
  }

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

  function htmlSinArea(ctx){
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
      // El calor no necesita área: sin ella cubre todo lo mapeado en la ciudad.
      (ctx && ctx.grupos && ctx.grupos.length ? bloqueHeat(ctx) : '') +
    '</div>';
  }

  function htmlPanel(ctx){
    if (!S.cerrada || S.pts.length < 3) return htmlSinArea(ctx);

    const r = calcular(ctx);
    reg('panel-analisis');
    if (!r.total) reg('area-vacia');
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

      bloqueHeat(ctx) +

      (r.total >= 2 ? bloqueGeo(ctx) : '') +

      // Va SIEMPRE dentro de esta rama, que solo se alcanza con un polígono
      // ya cerrado: la cobertura se mide sobre el área dibujada. Lo que no
      // necesita es que haya puntos mapeados adentro, porque se calcula sobre
      // la imagen satelital y no sobre lo que georreferenció la comunidad.
      bloqueRaster() +

      (r.total > 0 ? bloqueExportar() : '') +

      // Exportación geográfica (Fase 6): no depende de que haya puntos
      // mapeados, porque el contorno del área siempre se puede llevar.
      (window.URBIS_PC_EXPORTAR ? window.URBIS_PC_EXPORTAR.bloque() : '') +

      '<p class="pca-nota">Cuenta lo que los usuarios de URBIS georreferenciaron a mano dentro del contorno. No es un censo: refleja el mapeo disponible hoy.</p>' +

      // Analítica de uso (Fase 5): va al final y SOLO la ve el administrador;
      // para un estudiante devuelve cadena vacía y ni siquiera se dibuja.
      (window.URBIS_PC_ANALITICA ? window.URBIS_PC_ANALITICA.htmlPanel() : '') +
    '</div>';
  }

  // Exportar el análisis del área a PDF, reutilizando los cuatro estilos de
  // informe ya construidos en Análisis IA (js/63) en vez de inventar otros.
  function bloqueExportar(){
    const E = estilosInforme();
    const sel = Object.keys(E).map(id =>
      '<option value="' + esc(id) + '"' + (estiloGuardado() === id ? ' selected' : '') + '>' +
      esc(E[id].nombre) + '</option>').join('');
    return '<div class="pca-exportar">' +
      '<h4 class="pca-h pca-h-pdf">📄 Informe del área</h4>' +
      '<p class="pca-exportar-ayuda">Una hoja con el mapa, las cifras y las gráficas de esta área, lista para imprimir o guardar como PDF.</p>' +
      '<label class="pca-exportar-estilo">Estilo' +
        '<select id="pca-estilo-pdf" data-u52-noclose>' + sel + '</select>' +
      '</label>' +
      '<button type="button" class="pca-btn-pdf" data-u52-call="pca-pdf">📄 Generar el informe</button>' +
    '</div>';
  }

  // ── Informe PDF del área ────────────────────────────────────────────────

  const LS_ESTILO = 'pca_estilo_informe_v1';
  function estiloGuardado(){
    try { return localStorage.getItem(LS_ESTILO) || 'institucional'; } catch(e){ return 'institucional'; }
  }
  // Paleta compartida con Análisis IA. Si js/63 no estuviera cargado, se cae a
  // un tema mínimo propio para que el botón nunca reviente.
  function estilosInforme(){
    const E = window.AIA_INFORME && window.AIA_INFORME.ESTILOS;
    if (E && Object.keys(E).length) return E;
    return { institucional: { nombre:'Institucional', cab1:'#075E88', cab2:'#0E86BE', acento:'#0A6F9E',
      oro:'#FABD0A', cabTxt:'#fff', hoja:'#fff', panel:'#fff', tinta:'#12202e', txt2:'#4a5a6a',
      txt3:'#627285', borde:'#cfe6f5', linea:'#e9f4fb', suave:'#f3fbff' } };
  }

  // Imagen estática del mapa con el contorno del área dibujado encima. El
  // polígono va en SVG sobre la foto porque LocationIQ no dibuja polígonos.
  function mapaDelArea(w, h){
    const cfg = (window.URBIS_CONFIG && window.URBIS_CONFIG.LOCATIONIQ) || {};
    const lats = S.pts.map(p => p.lat), lngs = S.pts.map(p => p.lng);
    const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

    // Zoom que hace caber el área con margen, con la misma matemática de
    // Web Mercator que ya usa el informe de Análisis IA.
    const spanLat = Math.max(1e-6, Math.max(...lats) - Math.min(...lats));
    const spanLng = Math.max(1e-6, Math.max(...lngs) - Math.min(...lngs));
    let z = 18;
    for (; z > 10; z--) {
      const mpp = 156543.03392 * Math.cos(cLat * Math.PI / 180) / Math.pow(2, z);
      const altoM = spanLat * 110540, anchoM = spanLng * 111320 * Math.cos(cLat * Math.PI / 180);
      if (altoM / mpp < h * 0.78 && anchoM / mpp < w * 0.78) break;
    }
    const mpp = 156543.03392 * Math.cos(cLat * Math.PI / 180) / Math.pow(2, z);

    const puntos = S.pts.map(p => {
      const dx = (p.lng - cLng) * 111320 * Math.cos(cLat * Math.PI / 180) / mpp;
      const dy = -(p.lat - cLat) * 110540 / mpp;
      return (w / 2 + dx).toFixed(1) + ',' + (h / 2 + dy).toFixed(1);
    }).join(' ');

    const url = cfg.apiKey
      ? 'https://maps.locationiq.com/v3/staticmap?key=' + encodeURIComponent(cfg.apiKey) +
        '&center=' + cLat + ',' + cLng + '&zoom=' + z + '&size=' + w + 'x' + h + '&format=png'
      : '';

    return '<div class="mapa-wrap" style="width:' + w + 'px;height:' + h + 'px">' +
      (url ? '<img src="' + url + '" width="' + w + '" height="' + h + '" alt="">' : '<div class="mapa-vacio"></div>') +
      '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '">' +
        '<polygon points="' + puntos + '" fill="rgba(52,204,254,.22)" stroke="#0E86BE" ' +
        'stroke-width="3" stroke-linejoin="round"/></svg>' +
    '</div>';
  }

  // Gráficas en PNG con los colores del estilo elegido (igual que hace js/62
  // para el informe de Análisis IA: el canvas no hereda el CSS de la hoja).
  function graficasPNG(ctx, r, t){
    if (typeof Chart === 'undefined') return {};
    const render = (cfg, w, h) => {
      try {
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ch = new Chart(cv, cfg);
        const g = cv.getContext('2d');
        g.save(); g.globalCompositeOperation = 'destination-over';
        g.fillStyle = t.panel || '#fff'; g.fillRect(0, 0, w, h); g.restore();
        const url = cv.toDataURL('image/png');
        ch.destroy();
        return url;
      } catch(e){ return ''; }
    };
    const filas = ctx.grupos.map(g => ({ g, n: r.porGrupo[g.id] || 0 }))
      .filter(x => x.n > 0).sort((a, b) => b.n - a.n);
    const dims = Object.keys(r.porDimension).sort((a, b) => r.porDimension[b] - r.porDimension[a]);
    const paleta = ['#34CCFE','#FABD0A','#22c55e','#e5484d','#a855f7','#14b8a6','#ff8a4a','#6366f1'];
    return {
      barras: filas.length ? render({
        type: 'bar',
        data: { labels: filas.map(x => x.g.t), datasets: [{ data: filas.map(x => x.n),
          backgroundColor: filas.map(x => ctx.colorGrupo[x.g.id] || '#6b70e0'), borderRadius: 3 }] },
        options: { indexAxis: 'y', responsive: false, animation: false, devicePixelRatio: 2,
          layout: { padding: 8 }, plugins: { legend: { display: false } },
          scales: { x: { ticks: { color: t.txt2, font: { size: 15 } }, grid: { color: t.linea } },
                    y: { ticks: { color: t.tinta, font: { size: 15 } }, grid: { display: false } } } }
      }, 1000, 420) : '',
      donut: dims.length ? render({
        type: 'doughnut',
        data: { labels: dims.map(d => d.replace(/^[^\w\sáéíóúñ]+\s*/i, '')),
          datasets: [{ data: dims.map(d => r.porDimension[d]),
            backgroundColor: dims.map((_, i) => paleta[i % paleta.length]),
            borderColor: t.panel || '#fff', borderWidth: 2 }] },
        options: { responsive: false, animation: false, devicePixelRatio: 2, cutout: '55%',
          layout: { padding: 8 },
          plugins: { legend: { position: 'right',
            labels: { color: t.tinta, font: { size: 15 }, boxWidth: 13, padding: 8 } } } }
      }, 1000, 400) : ''
    };
  }

  function construirInforme(ctx, estiloId){
    const E = estilosInforme();
    const t = E[estiloId] || E.institucional || E[Object.keys(E)[0]];
    const r = calcular(ctx);
    const g = graficasPNG(ctx, r, t);
    const fecha = new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' });

    const filas = ctx.grupos.map(x => ({ x, n: r.porGrupo[x.id] || 0 }))
      .sort((a, b) => b.n - a.n).filter(f => f.n > 0);
    const tablaGrupos = filas.length ? filas.map(({ x, n }) => {
      const pct = r.totalMatriz ? Math.round((n / r.totalMatriz) * 100) : 0;
      return '<tr><td><i style="background:' + (ctx.colorGrupo[x.id] || '#6b70e0') + '"></i>' +
        esc(x.i + ' ' + x.t) + '</td><td class="n">' + n + '</td><td class="n">' + pct + '%</td></tr>';
    }).join('') : '<tr><td colspan="3">Sin elementos de la Matriz en esta área.</td></tr>';

    const dims = Object.keys(r.porDimension).sort((a, b) => r.porDimension[b] - r.porDimension[a]);
    const tablaDims = dims.map(d => {
      const n = r.porDimension[d], pct = r.total ? Math.round((n / r.total) * 100) : 0;
      return '<tr><td>' + esc(d) + '</td><td class="n">' + n + '</td><td class="n">' + pct + '%</td></tr>';
    }).join('');

    const kpi = (v, t2) => '<div class="kpi"><b>' + v + '</b><small>' + t2 + '</small></div>';

    // El mapa de calor encendido se lleva al informe tal cual se ve en
    // pantalla: es parte del análisis que el estudiante acaba de hacer.
    let heatImg = '';
    if (S.heat.grupo && S.heat.canvas && S.heat.canvas.width) {
      try {
        const gr = S.heat.grupo === 'todos' ? null : ctx.grupos.find(x => x.id === S.heat.grupo);
        heatImg = '<div class="bloque"><h2>Mapa de calor <em>· ' +
          esc(gr ? gr.t : 'todos los usos') + '</em></h2>' +
          '<img class="heat" src="' + S.heat.canvas.toDataURL('image/png') + '" alt=""></div>';
      } catch(e){}
    }

    return [
'<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><base href="', location.href, '">',
'<title>', esc(S.nombre || 'Área de análisis'), ' · URBIS Pro City</title><style>',
'@page{size:letter portrait;margin:10mm}',
'*{box-sizing:border-box;margin:0;padding:0}',
'body{font-family:"Segoe UI",Arial,sans-serif;color:', t.tinta, ';background:', t.hoja, ';',
'-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:0}',
'header{display:flex;align-items:center;gap:11px;border-radius:7px;padding:9px 13px;',
'background:linear-gradient(100deg,', t.cab1, ',', t.cab2, ');color:', t.cabTxt, '}',
'header img{width:30px;height:30px;object-fit:contain;background:#fff;border-radius:7px;padding:1px;flex:0 0 auto}',
'header h1{font-size:16px;font-weight:800;line-height:1.15}',
'header p{font-size:9px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:', t.oro, '}',
'header .sub{margin-left:auto;text-align:right;font-size:8.5px;opacity:.92;line-height:1.4}',
'.fila{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px;align-items:start}',
'.bloque{border:1px solid ', t.borde, ';border-radius:7px;padding:8px 10px;background:', t.panel, ';break-inside:avoid}',
'.bloque h2{font-size:9px;text-transform:uppercase;letter-spacing:.7px;color:', t.acento, ';',
'font-weight:800;padding-bottom:4px;margin-bottom:6px;border-bottom:1.5px solid ', t.oro, '}',
'.bloque h2 em{font-style:normal;font-weight:600;color:', t.txt3, ';text-transform:none;letter-spacing:0}',
'.mapa-wrap{position:relative;border-radius:6px;overflow:hidden;background:#dde3e8;max-width:100%}',
'.mapa-wrap img{display:block;width:100%;height:auto}',
'.mapa-wrap svg{position:absolute;left:0;top:0;width:100%;height:100%}',
'.mapa-vacio{width:100%;height:100%;background:repeating-linear-gradient(45deg,#e8edf1,#e8edf1 8px,#dfe6ec 8px,#dfe6ec 16px)}',
'.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:6px}',
'.kpi{border:1px solid ', t.borde, ';border-radius:6px;padding:6px 3px;text-align:center;background:', t.suave, '}',
'.kpi b{display:block;font-size:13px;font-weight:800;color:', t.acento, ';line-height:1.15}',
'.kpi small{display:block;font-size:7px;color:', t.txt2, ';line-height:1.2;margin-top:2px}',
'table{width:100%;border-collapse:collapse;font-size:8.5px}',
'th{background:', t.cab1, ';color:', t.cabTxt, ';font-size:7.6px;text-transform:uppercase;',
'letter-spacing:.4px;padding:4px 5px;text-align:left;font-weight:700}',
'td{padding:3px 5px;border-bottom:1px solid ', t.linea, ';color:', t.tinta, ';line-height:1.3}',
'td.n{text-align:right;font-variant-numeric:tabular-nums}',
'td i{display:inline-block;width:7px;height:7px;border-radius:2px;margin-right:5px;vertical-align:middle}',
'.chart img,.heat{width:100%;display:block;border-radius:5px}',
'.datos{font-size:8.5px;color:', t.txt2, ';line-height:1.55}',
'.datos b{color:', t.tinta, '}',
'footer{margin-top:9px;border-top:1px solid ', t.borde, ';padding-top:5px;font-size:7.4px;',
'color:', t.txt3, ';display:flex;justify-content:space-between;gap:12px}',
'</style></head><body>',

'<header><img src="assets/brand/urbis-logo.png" onerror="this.style.display=\'none\'">',
'<div><h1>', esc(S.nombre || 'Área de análisis'), '</h1>',
'<p>URBIS Pro City · Análisis de área</p></div>',
'<div class="sub">Cúcuta, Norte de Santander<br>', esc(fecha), '</div></header>',

'<div class="fila">',
  '<div class="bloque"><h2>El área analizada</h2>', mapaDelArea(430, 320), '</div>',
  '<div class="bloque"><h2>Cifras del área</h2>',
    '<div class="datos"><b>Superficie:</b> ', fmtArea(r.areaM2), '<br>',
    '<b>Perímetro:</b> ', fmtDist(r.perimetroM), '<br>',
    '<b>Vértices:</b> ', S.pts.length, '</div>',
    '<div class="kpis">',
      kpi(r.total, 'puntos mapeados'), kpi(r.densidad, 'por hectárea'),
      kpi(r.mios, 'míos'), kpi(r.deOtros, 'de otros'),
    '</div>',
    (g.donut ? '<div class="chart" style="margin-top:7px"><img src="' + g.donut + '" alt=""></div>' : ''),
  '</div>',
'</div>',

'<div class="fila">',
  '<div class="bloque"><h2>Composición por Matriz de Usos</h2>',
    (g.barras ? '<div class="chart"><img src="' + g.barras + '" alt=""></div>' : ''),
    '<table style="margin-top:6px"><tr><th>Grupo</th><th>Usos</th><th>%</th></tr>', tablaGrupos, '</table>',
  '</div>',
  '<div>',
    (tablaDims ? '<div class="bloque"><h2>Reparto por dimensión</h2>' +
      '<table><tr><th>Dimensión</th><th>Puntos</th><th>%</th></tr>' + tablaDims + '</table></div>' : ''),
    heatImg,
  '</div>',
'</div>',

'<footer><span>Cuenta lo que los usuarios de URBIS georreferenciaron a mano dentro del contorno. No es un censo: refleja el mapeo disponible a la fecha.</span>',
'<span><b>URBIS</b> Pro City · @urbis_co</span></footer>',
'</body></html>'
    ].join('');
  }

  function exportarPDF(){
    const ctx = (typeof window.urbisProCityCtxAnalisis === 'function') ? window.urbisProCityCtxAnalisis() : null;
    if (!ctx) { alert('El análisis no está listo todavía.'); return; }
    if (!S.cerrada || S.pts.length < 3) { alert('Primero dibuja y cierra un área.'); return; }
    const sel = document.getElementById('pca-estilo-pdf');
    const estilo = (sel && sel.value) || estiloGuardado();
    try { localStorage.setItem(LS_ESTILO, estilo); } catch(e){}
    reg('pdf-generado');
    try {
      const html = construirInforme(ctx, estilo);
      const abrir = window.AIA_INFORME && window.AIA_INFORME.abrirVentanaImpresion;
      if (abrir) { abrir(html); return; }
      const w = window.open('', '_blank');
      if (!w) { alert('Permite ventanas emergentes para exportar el PDF.'); return; }
      w.document.write(html); w.document.close();
      setTimeout(() => { try { w.focus(); w.print(); } catch(e){} }, 600);
    } catch(e) {
      alert('No se pudo generar el informe: ' + (e && e.message || e));
    }
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

  // ── Fase 3 · Generador de geometrías ────────────────────────────────────
  // Se arranca con el subconjunto más simple de calcular del catálogo del
  // plan (sección 5): red entre vecinos cercanos, envolvente convexa y
  // círculos de impacto. El resto (Voronoi, Delaunay, ejes, grillas) queda
  // para sumar después sin tocar lo ya hecho — mismo patrón aditivo que
  // el mapa de calor.

  function capaGeo(){
    const m = mapa();
    if (!m || typeof L === 'undefined') return null;
    if (!S.geo.capa) S.geo.capa = L.layerGroup().addTo(m);
    return S.geo.capa;
  }

  // Capa aparte para el raster: si compartiera la de la red de conexiones,
  // cambiar de geometría (o apagarla) borraría también la imagen de cobertura
  // pegada sobre el polígono, y son dos cosas independientes en el panel.
  function capaRaster(){
    const m = mapa();
    if (!m || typeof L === 'undefined') return null;
    if (!S.rasterCapa) S.rasterCapa = L.layerGroup().addTo(m);
    return S.rasterCapa;
  }

  // Pega la imagen clasificada (colores por clase) sobre el polígono real del
  // mapa — antes el resultado del raster solo se veía como texto y barras en
  // el panel, y al volver al mapa no había ni rastro de la cobertura.
  function pintarRasterMapa(res){
    const c = capaRaster();
    if (!c || !res || !res.overlayImagen) return;
    c.clearLayers();
    L.imageOverlay(res.overlayImagen, res.overlayLimites, {
      opacity: .8, interactive: false, className: 'pca-raster-overlay'
    }).addTo(c);
    // El chip nace junto con la imagen, no al tocar "Ver en el mapa": si el
    // usuario cerraba el panel por su cuenta se quedaba con la cobertura
    // pegada encima del mapa y sin ninguna forma de quitarla.
    chipRaster();
  }

  // Chip sobre el mapa, mismo papel que el del calor y el de la geometría:
  // dice qué capa está encendida y la apaga sin tener que reabrir el panel.
  // Lleva la barra de proporciones porque, ya sobre el mapa, es la única
  // leyenda que explica de qué es cada color de la imagen clasificada.
  function chipRaster(){
    const m = mapa();
    if (!m || !S.raster) return;
    if (!S.rasterChip) {
      const c = document.createElement('div');
      c.className = 'pca-raster-chip';
      if (L && L.DomEvent) L.DomEvent.disableClickPropagation(c);
      m.getContainer().appendChild(c);
      S.rasterChip = c;
    }
    // Si el calor y/o la geometría ya ocupan la esquina, este chip se corre
    // hacia abajo para no taparlos.
    const ocupados = (S.heat.grupo ? 1 : 0) + (S.geo.tipo ? 1 : 0);
    S.rasterChip.classList.toggle('abajo', ocupados === 1);
    S.rasterChip.classList.toggle('mas-abajo', ocupados === 2);
    const orden = S.raster.clases.slice().sort((a, b) => b.pct - a.pct);
    const visibles = orden.filter(c => c.pct > 0);
    S.rasterChip.innerHTML =
      '<div class="pca-raster-chip-txt">' +
        '<b>🛰️ Cobertura del suelo</b>' +
        '<span class="pca-raster-chip-barra">' +
          visibles.map(c => '<i style="width:' + c.pct + '%;background:' + c.color + '" ' +
            'title="' + esc(c.etq) + '"></i>').join('') +
        '</span>' +
        '<small>' + visibles.slice(0, 2).map(c => c.ico + ' ' + c.pct + '%').join(' · ') + '</small>' +
      '</div>' +
      '<button type="button" data-u52-call="pca-raster-off" aria-label="Quitar la capa de cobertura">✕</button>';
  }

  function apagarRasterMapa(){
    if (S.rasterCapa) S.rasterCapa.clearLayers();
    if (S.rasterChip) { try { S.rasterChip.remove(); } catch(e){} S.rasterChip = null; }
  }

  // Puntos de Pro City dentro del área, ya con lat/lng numéricos — insumo
  // común a las tres geometrías. `S.geo.grupo` decide QUÉ se conecta: 'todos'
  // (cualquier cosa mapeada) o una categoría de la Matriz, para poder leer
  // por separado la red del comercio, la de los equipamientos, etc.
  function puntosGeo(ctx){
    const filtro = S.geo.grupo || 'todos';
    return datosURBIS().reduce((acc, p) => {
      if (!p || !ctx.esProCity(p.tipo)) return acc;
      const lat = parseFloat(String(p.lat || '').replace(',', '.'));
      const lng = parseFloat(String(p.lng || '').replace(',', '.'));
      if (isNaN(lat) || isNaN(lng)) return acc;
      if (!dentroDelPoligono(lat, lng, S.pts)) return acc;
      if (filtro !== 'todos') {
        // Solo los elementos de la Matriz tienen categoría; el resto de
        // dimensiones de Pro City quedan fuera al filtrar por categoría.
        if (String(p.tipo || '') !== ctx.matrizKey) return acc;
        const g = ctx.grupos.find(gr => gr.usos.includes(ctx.usoDe(p)));
        if ((g ? g.id : 'mixtos') !== filtro) return acc;
      }
      acc.push({ lat, lng });
      return acc;
    }, []);
  }

  function nombreGeo(tipo){
    return tipo === 'red' ? '🕸️ Red de conexiones'
      : tipo === 'hull' ? '⬡ Envolvente convexa'
      : tipo === 'circulos' ? '⭕ Círculos de impacto' : '';
  }
  function colorGeo(tipo){
    return tipo === 'red' ? '#a855f7' : tipo === 'hull' ? '#FABD0A' : '#ef4444';
  }
  function nombreFiltroGeo(ctx){
    const f = S.geo.grupo || 'todos';
    if (f === 'todos') return 'todo lo mapeado';
    const g = ctx && ctx.grupos.find(x => x.id === f);
    return g ? g.t : 'una categoría';
  }

  // Envolvente convexa por el método de la cadena monótona (Andrew). O(n log n),
  // sin dependencias — el mismo criterio de "no traer una librería para 20 líneas".
  function envolventeConvexa(pts){
    const uniq = pts.slice().sort((a, b) => a.lng - b.lng || a.lat - b.lat);
    if (uniq.length < 3) return uniq;
    const cruz = (o, a, b) => (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
    const baja = [];
    for (const p of uniq) {
      while (baja.length >= 2 && cruz(baja[baja.length-2], baja[baja.length-1], p) <= 0) baja.pop();
      baja.push(p);
    }
    const alta = [];
    for (let i = uniq.length - 1; i >= 0; i--) {
      const p = uniq[i];
      while (alta.length >= 2 && cruz(alta[alta.length-2], alta[alta.length-1], p) <= 0) alta.pop();
      alta.push(p);
    }
    baja.pop(); alta.pop();
    return baja.concat(alta);
  }

  // Red entre vecinos cercanos: cada punto se conecta con sus 2 vecinos más
  // próximos (evita el enredo visual de conectar todos contra todos), sin
  // repetir el mismo segmento en ambos sentidos.
  function redVecinos(pts, k){
    const lineas = [];
    const vistos = new Set();
    pts.forEach((p, i) => {
      const dists = pts
        .map((q, j) => ({ j, d: j === i ? Infinity : haversineM(p, q) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, k);
      dists.forEach(({ j }) => {
        const clave = i < j ? i + '-' + j : j + '-' + i;
        if (vistos.has(clave)) return;
        vistos.add(clave);
        lineas.push([p, pts[j]]);
      });
    });
    return lineas;
  }

  // Devuelve cuántos puntos alimentaron la geometría — lo usa el chip del
  // mapa para avisar cuando el filtro elegido deja el área casi vacía.
  function pintarGeo(ctx){
    const c = capaGeo();
    if (!c) return 0;
    c.clearLayers();
    const tipo = S.geo.tipo;
    if (!tipo) return 0;
    const pts = puntosGeo(ctx);
    S.geo.ultimoConteo = pts.length;
    if (pts.length < 2) return pts.length;

    if (tipo === 'red') {
      const k = pts.length > 60 ? 1 : 2;   // con muchos puntos, menos líneas por nodo
      // Rojo vivo y trazo grueso a propósito: el morado fino de antes casi no
      // se distinguía del mapa base. Esto se tiene que notar de un vistazo.
      redVecinos(pts, k).forEach(([a, b]) => {
        L.polyline([a, b], { color: '#ff1f3d', weight: 3.5, opacity: .9, className: 'pca-geo-linea' }).addTo(c);
      });
      pts.forEach(p => L.circleMarker(p, { radius: 4.5, color: '#ff1f3d', weight: 0, fillOpacity: .95 }).addTo(c));

    } else if (tipo === 'hull') {
      const hull = envolventeConvexa(pts);
      if (hull.length >= 3) {
        L.polygon(hull, { color: '#FABD0A', weight: 2.5, fillColor: '#FABD0A', fillOpacity: .1,
          dashArray: '2 6', className: 'pca-geo-hull' }).addTo(c);
      }
      pts.forEach(p => L.circleMarker(p, { radius: 3, color: '#FABD0A', weight: 0, fillOpacity: .9 }).addTo(c));

    } else if (tipo === 'circulos') {
      // Radio fijo modesto (35 m ≈ una cuadra corta): con relleno translúcido,
      // los círculos cercanos se funden visualmente en un contorno orgánico
      // sin necesidad de calcular la unión real de los polígonos.
      pts.forEach(p => {
        L.circle(p, { radius: 35, color: '#ef4444', weight: 1, fillColor: '#ef4444', fillOpacity: .16 }).addTo(c);
      });
    }
    return pts.length;
  }

  // Chip sobre el mapa, gemelo del de calor: la geometría se mira con el panel
  // CERRADO, así que sin él no habría forma de saber qué está dibujado ni de
  // cambiar el filtro sin volver a abrir el análisis.
  function chipGeo(ctx){
    const m = mapa();
    if (!m) return;
    if (!S.geo.chip) {
      const c = document.createElement('div');
      c.className = 'pca-geo-chip';
      if (L && L.DomEvent) L.DomEvent.disableClickPropagation(c);
      m.getContainer().appendChild(c);
      S.geo.chip = c;
    }
    // Si el mapa de calor también está encendido, este chip baja para no
    // quedar encima del suyo.
    S.geo.chip.classList.toggle('abajo', !!S.heat.grupo);
    const n = S.geo.ultimoConteo || 0;
    const aviso = n < 2
      ? 'Solo ' + n + ' punto' + (n === 1 ? '' : 's') + ' con este filtro — prueba con “Todo lo mapeado”'
      : n + ' puntos · ' + esc(nombreFiltroGeo(ctx));
    S.geo.chip.innerHTML =
      '<i style="background:' + colorGeo(S.geo.tipo) + '"></i>' +
      '<div><b>' + nombreGeo(S.geo.tipo) + '</b><small>' + aviso + '</small></div>' +
      '<button type="button" data-u52-call="pca-geo-off" aria-label="Quitar la geometría">✕</button>';
  }

  function apagarGeo(){
    S.geo.tipo = null;
    S.geo.ultimoConteo = 0;
    if (S.geo.capa) { try { S.geo.capa.clearLayers(); } catch(e){} }
    if (S.geo.chip) { try { S.geo.chip.remove(); } catch(e){} S.geo.chip = null; }
  }

  // El área cambió (se cerró otra, se cargó una guardada): la geometría se
  // recalcula sobre el contorno nuevo en vez de quedar colgada del anterior.
  function refrescarGeo(){
    if (!S.geo.tipo) return;
    const ctx = (typeof window.urbisProCityCtxAnalisis === 'function') ? window.urbisProCityCtxAnalisis() : null;
    if (!ctx) return;
    pintarGeo(ctx);
    chipGeo(ctx);
  }

  function bloqueGeo(ctx){
    const act = S.geo.tipo;
    const filtro = S.geo.grupo || 'todos';
    const chip = (id, ico, txt, color) =>
      '<button type="button" class="pca-heat-btn' + (act === id ? ' activo' : '') + '" ' +
      'data-u52-call="pca-geo" data-gid="' + esc(id) + '" style="--c:' + color + '">' +
      '<i></i><span>' + ico + ' ' + esc(txt) + '</span></button>';
    // Filtro de qué se conecta. Se muestra el conteo real de cada categoría
    // dentro del área para no ofrecer filtros que dejarían el dibujo vacío.
    const r = window.__pcaUltimo || { porGrupo: {}, total: 0 };
    const fchip = (id, ico, txt, n) =>
      '<button type="button" class="pca-geo-filtro' + (filtro === id ? ' activo' : '') + '" ' +
      'data-u52-call="pca-geo-filtro" data-gid="' + esc(id) + '">' +
      ico + ' ' + esc(txt) + '<b>' + n + '</b></button>';
    const filtros = fchip('todos', '🌐', 'Todo lo mapeado', r.total || 0) +
      ctx.grupos.filter(g => (r.porGrupo[g.id] || 0) > 0)
        .map(g => fchip(g.id, g.i, g.t, r.porGrupo[g.id])).join('');

    return '<div class="pca-geo-sel">' +
      '<h4 class="pca-h pca-h-geo">🕸️ Geometría del área</h4>' +
      '<p class="pca-geo-ayuda">Dibuja las relaciones espaciales entre lo mapeado: qué tan cerca está unos de otros, cuánto terreno abarcan y dónde se cruzan sus radios de influencia. Al elegir una, el panel se cierra para que la veas sobre el mapa.</p>' +
      '<div class="pca-geo-sub">¿Qué puntos conectar?</div>' +
      '<div class="pca-geo-filtros">' + filtros + '</div>' +
      '<div class="pca-geo-sub">¿Cómo dibujarlos?</div>' +
      '<div class="pca-heat-chips">' +
        chip('red', '🕸️', 'Red de conexiones', '#a855f7') +
        chip('hull', '⬡', 'Envolvente convexa', '#FABD0A') +
        chip('circulos', '⭕', 'Círculos de impacto', '#ef4444') +
      '</div>' +
      (act ? '<button type="button" class="pca-heat-off" data-u52-call="pca-geo-off">✕ Quitar la geometría</button>' : '') +
    '</div>';
  }

  // ── Fase 4 · Análisis ráster ambiental ──────────────────────────────────
  // Estima cuánto del área es verde, agua o superficie construida clasificando
  // el COLOR de cada píxel de una imagen satelital.
  //
  // Honestidad metodológica (va escrita en pantalla y en el PDF, no solo aquí):
  // esto NO es NDVI. Un NDVI real necesita banda infrarroja, que no está
  // disponible gratis con calidad suficiente. Clasificar por RGB confunde un
  // techo verde con un árbol, una piscina con un lago, y una sombra con agua.
  // Sirve para dimensionar, no para certificar.
  //
  // Se usa Esri World Imagery: sin API key y con CORS abierto (verificado:
  // Access-Control-Allow-Origin: *), que es lo que permite leer los píxeles
  // del canvas — sin esa cabecera el navegador bloquea getImageData.
  const RASTER_URL = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export';
  const RASTER_LADO = 420;     // suficiente para estimar y liviano de procesar

  function bboxDelArea(pts){
    const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
    return { s: Math.min(...lats), n: Math.max(...lats),
             o: Math.min(...lngs), e: Math.max(...lngs) };
  }

  // Clasificación por color. Los umbrales salieron de mirar imágenes reales de
  // Cúcuta: vegetación con verde dominante, agua con azul dominante y poca
  // luz, y construido como gris de baja saturación.
  // Clases calibradas contra píxeles reales de Cúcuta, y RECORTADAS a lo que
  // el color RGB puede sostener de verdad.
  //
  // Historia de la calibración, porque explica por qué hay solo cuatro clases:
  // una primera versión dejaba 34% "sin clasificar"; al muestrear esos píxeles
  // salieron tonos oliva-caqui (~76,75,58). La tentación era abrir una clase
  // "vegetación seca", pero al probarla el Centro de Cúcuta —urbano denso—
  // daba 18% construido y 47% vegetación, que es falso: el concreto beige y
  // el matorral seco comparten el mismo rango de color y sin banda infrarroja
  // NO se pueden separar. Antes que publicar un porcentaje bonito y engañoso,
  // esas superficies van juntas en una clase declarada como ambigua.
  function clasificarPixel(r, g, b){
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const luz = (r + g + b) / 3;

    // Agua: azul dominante sobre superficie oscura. Fiable salvo sombras densas.
    if (b > r + 8 && b >= g && luz < 145) return 'agua';
    // Vegetación viva: verde franco por encima de rojo y azul. Es la clase más
    // fiable del método — el verde vegetal no lo imita casi ningún material.
    if (g > r + 10 && g > b + 6) return 'verde';
    // Gris neutro: asfalto, concreto y cubiertas metálicas. Fiable cuando la
    // saturación es realmente baja.
    if (sat < .16) return 'construido';
    // Todo lo demás son tonos cálidos (beige, caqui, terracota, oliva) donde
    // conviven teja, concreto envejecido, suelo descubierto y matorral seco.
    // El color no los separa: se declara como tal.
    return 'mixto';
  }

  // Convierte píxel → lat/lng. La imagen se pide en EPSG:4326 con el bbox del
  // área, así que el mapeo es lineal (a escala de barrio la distorsión es
  // despreciable y evita meter una proyección completa).
  function latLngDePixel(x, y, w, h, bb){
    return { lat: bb.n - (y + .5) / h * (bb.n - bb.s),
             lng: bb.o + (x + .5) / w * (bb.e - bb.o) };
  }

  function analizarRaster(){
    return new Promise((resolve, reject) => {
      if (!S.cerrada || S.pts.length < 3) { reject(new Error('Primero dibuja un área.')); return; }
      const bb = bboxDelArea(S.pts);
      // Se pide un poco más ancho que el área para que el borde no quede pegado.
      const mLat = (bb.n - bb.s) * .04, mLng = (bb.e - bb.o) * .04;
      const caja = { s: bb.s - mLat, n: bb.n + mLat, o: bb.o - mLng, e: bb.e + mLng };
      // Se conserva la proporción real del área: pedir siempre un cuadrado
      // deformaría un área alargada y falsearía los porcentajes.
      const prop = (caja.n - caja.s) / Math.max(1e-9, (caja.e - caja.o));
      const w = RASTER_LADO, h = Math.max(60, Math.min(700, Math.round(RASTER_LADO * prop)));
      const url = RASTER_URL + '?bbox=' + [caja.o, caja.s, caja.e, caja.n].join(',') +
        '&bboxSR=4326&imageSR=4326&size=' + w + ',' + h + '&format=png&f=image';

      const img = new Image();
      img.crossOrigin = 'anonymous';       // sin esto el canvas queda "tainted"
      img.onerror = () => reject(new Error('No se pudo descargar la imagen satelital.'));
      img.onload = () => {
        try {
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const cx = cv.getContext('2d');
          cx.drawImage(img, 0, 0, w, h);
          const datos = cx.getImageData(0, 0, w, h).data;

          // Lienzo gemelo: mismo tamaño, pero en vez de guardar el píxel de la
          // foto guarda el COLOR DE LA CLASE — esto es lo que luego se pega
          // sobre el mapa como overlay, para que el raster no se quede solo
          // en la lista de porcentajes del panel.
          const cvClas = document.createElement('canvas');
          cvClas.width = w; cvClas.height = h;
          const cxClas = cvClas.getContext('2d');
          const imgClas = cxClas.createImageData(w, h);
          const RGB = {
            verde:      [34, 197, 94],
            construido: [148, 163, 184],
            agua:       [59, 130, 246],
            mixto:      [201, 162, 106]
          };
          // Opacidad visible pero que deja intuir el satelital de fondo.
          const ALPHA = 176;

          const cuenta = { verde:0, agua:0, construido:0, mixto:0 };
          let dentro = 0;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const c = latLngDePixel(x, y, w, h, caja);
              const i = (y * w + x) * 4;
              if (!dentroDelPoligono(c.lat, c.lng, S.pts)) {
                imgClas.data[i + 3] = 0;   // fuera del área: transparente del todo
                continue;
              }
              dentro++;
              const clase = clasificarPixel(datos[i], datos[i+1], datos[i+2]);
              cuenta[clase]++;
              const rgb = RGB[clase];
              imgClas.data[i] = rgb[0]; imgClas.data[i+1] = rgb[1]; imgClas.data[i+2] = rgb[2];
              imgClas.data[i + 3] = ALPHA;
            }
          }
          if (!dentro) { reject(new Error('El área es demasiado pequeña para analizarla.')); return; }
          cxClas.putImageData(imgClas, 0, 0);

          const pct = k => Math.round(1000 * cuenta[k] / dentro) / 10;
          const m2 = areaM2(S.pts);
          const sup = k => Math.round(m2 * cuenta[k] / dentro);
          resolve({
            pixeles: dentro, imagen: cv.toDataURL('image/png'),
            overlayImagen: cvClas.toDataURL('image/png'),
            // Límites en (sur,oeste)-(norte,este): lo que necesita Leaflet
            // para clavar la imagen del overlay en su sitio exacto del mapa.
            overlayLimites: [[caja.s, caja.o], [caja.n, caja.e]],
            clases: [
              { id:'verde',      etq:'Vegetación viva',      ico:'🌳', color:'#22c55e',
                pct:pct('verde'), m2:sup('verde'), fiable:true,
                nota:'Verde franco. Es la clase más fiable: casi ningún material lo imita.' },
              { id:'construido', etq:'Superficie dura gris', ico:'🏗️', color:'#94a3b8',
                pct:pct('construido'), m2:sup('construido'), fiable:true,
                nota:'Asfalto, concreto y cubiertas metálicas de color neutro.' },
              { id:'agua',       etq:'Agua',                 ico:'💧', color:'#3b82f6',
                pct:pct('agua'), m2:sup('agua'), fiable:true,
                nota:'Azul oscuro. Una sombra muy densa puede confundirse con agua.' },
              { id:'mixto',      etq:'Tonos cálidos (no separables)', ico:'🟫', color:'#c9a26a',
                pct:pct('mixto'), m2:sup('mixto'), fiable:false,
                nota:'Teja, concreto envejecido, suelo descubierto y matorral seco comparten este rango de color.' }
            ],
            pctAmbiguo: pct('mixto'),
            areaM2: m2
          });
        } catch(e) {
          // Salta si el navegador considera el canvas contaminado.
          reject(new Error('El navegador bloqueó la lectura de la imagen (CORS).'));
        }
      };
      img.src = url;
    });
  }

  function pintarRaster(res){
    const cont = document.getElementById('pca-raster-out');
    if (!cont) return;
    const orden = res.clases.slice().sort((a, b) => b.pct - a.pct);
    const dom = orden[0];
    cont.innerHTML =
      // Atajo pedido: el panel tapa el mapa, así que sin esto había que
      // cerrarlo a mano y buscar el área para ver la imagen clasificada.
      '<button type="button" class="pca-btn-raster-mapa" data-u52-call="pca-raster-ver">' +
        '🗺️ Ver en el mapa</button>' +
      '<div class="pca-raster-barra">' +
        orden.filter(c => c.pct > 0).map(c =>
          '<i style="width:' + c.pct + '%;background:' + c.color + '" title="' + esc(c.etq) + '"></i>').join('') +
      '</div>' +
      '<div class="pca-raster-lista">' +
        orden.map(c =>
          '<div class="pca-raster-fila' + (c.fiable ? '' : ' ambigua') + '">' +
          '<span><i style="background:' + c.color + '"></i>' + c.ico + ' ' + esc(c.etq) + '</span>' +
          '<b>' + c.pct + '%</b><em>' + fmtArea(c.m2) + '</em></div>' +
          '<div class="pca-raster-nota">' + esc(c.nota) + '</div>').join('') +
      '</div>' +
      '<p class="pca-raster-lectura">Cobertura dominante: <b>' + esc(dom.etq.toLowerCase()) +
        '</b> (' + dom.pct + '%). Estimado sobre ' + res.pixeles.toLocaleString('es-CO') +
        ' puntos de la imagen dentro del área.</p>' +
      '<div class="pca-raster-aviso"><b>⚠️ Cómo leer esto</b>' +
        '<small>Estimación por <b>color</b> de imagen satelital: <b>no es NDVI ni un estudio ' +
        'ambiental certificado</b>. Un NDVI real necesita banda infrarroja, que no está disponible ' +
        'gratis. Por eso solo se declaran tres clases fiables — vegetación viva, gris construido y ' +
        'agua — y todo lo demás queda en <b>tonos cálidos</b> (' + res.pctAmbiguo + '% del área), ' +
        'donde teja, concreto envejecido, suelo y matorral seco son indistinguibles por color. ' +
        'Sirve para dimensionar y comparar sectores, no para certificar.</small></div>';
    S.raster = res;
    pintarRasterMapa(res);
  }

  function bloqueRaster(){
    return '<div class="pca-raster-sel">' +
      '<h4 class="pca-h pca-h-raster">🛰️ Cobertura del suelo</h4>' +
      '<p class="pca-raster-ayuda">Estima qué parte del área es vegetación, superficie construida, ' +
        'suelo desnudo o agua, clasificando el color de una imagen satelital.</p>' +
      '<button type="button" class="pca-btn-raster" data-u52-call="pca-raster">🛰️ Analizar cobertura</button>' +
      '<div id="pca-raster-out">' + (S.raster ? '' : '') + '</div>' +
    '</div>';
  }

  // ── Acciones (las despacha js/20 desde su delegador de clics) ───────────

  function accion(name, el){
    if (name === 'dibujar')  { if (typeof window.urbisProCityCerrarStats === 'function') window.urbisProCityCerrarStats(); iniciarDibujo(); return true; }
    if (name === 'ver-analisis') { cerrarBurbuja(); if (typeof window.urbisProCityAbrirAnalisis === 'function') window.urbisProCityAbrirAnalisis(); return true; }
    if (name === 'cerrar-burbuja') { cerrarBurbuja(); return true; }
    if (name === 'pdf') { exportarPDF(); return true; }
    // Al elegir una capa de calor se cierra el panel: el mapa está detrás y
    // sin cerrarlo no se vería nada de lo que se acaba de encender.
    if (name === 'heat') {
      const gid = el && el.dataset.gid;
      if (S.heat.grupo === gid) { apagarHeat(); return true; }
      if (typeof window.urbisProCityCerrarStats === 'function') window.urbisProCityCerrarStats();
      cerrarBurbuja();
      reg('heat-on');
      encenderHeat(gid);
      return true;
    }
    if (name === 'heat-off') {
      apagarHeat();
      // Si el apagado vino del panel, se repinta para quitar el botón.
      const enPanel = el && el.closest('.pca-panel');
      if (enPanel && typeof window.urbisProCityAbrirAnalisis === 'function') window.urbisProCityAbrirAnalisis();
      return true;
    }
    // Igual que el calor: al elegir una geometría se CIERRA el panel. Antes se
    // volvía a abrir, y como el panel tapa el mapa el dibujo quedaba detrás —
    // parecía que el botón no hacía nada.
    // Acciones del panel de analítica (js/25), que se pinta dentro de este panel.
    if (name.indexOf('an-') === 0 && window.URBIS_PC_ANALITICA) {
      return window.URBIS_PC_ANALITICA.accion(name);
    }
    if (name.indexOf('exp-') === 0 && window.URBIS_PC_EXPORTAR) {
      return window.URBIS_PC_EXPORTAR.accion(name);
    }
    // Ir al mapa a ver la imagen clasificada. Igual que el calor y la
    // geometría: se cierra el panel, porque está justo encima del mapa y sin
    // cerrarlo no se vería nada de lo que se acaba de encender.
    if (name === 'raster-ver') {
      if (!S.raster) return true;
      pintarRasterMapa(S.raster);
      if (typeof window.urbisProCityCerrarStats === 'function') window.urbisProCityCerrarStats();
      cerrarBurbuja();
      const m = mapa();
      if (m && S.raster.overlayLimites) {
        try { m.fitBounds(S.raster.overlayLimites, { padding: [28, 28] }); } catch (e) {}
      }
      chipRaster();
      reg('raster-mapa');
      return true;
    }
    if (name === 'raster-off') { apagarRasterMapa(); return true; }
    if (name === 'raster') {
      const btn = el;
      const out = document.getElementById('pca-raster-out');
      if (btn) { btn.disabled = true; btn.textContent = '🛰️ Analizando imagen…'; }
      if (out) out.innerHTML = '<p class="pca-raster-cargando">Descargando y clasificando la imagen satelital…</p>';
      analizarRaster().then(res => {
        pintarRaster(res);
        reg('raster-ok');
        if (btn) { btn.disabled = false; btn.textContent = '↻ Volver a analizar'; }
      }).catch(err => {
        reg('raster-error');
        if (out) out.innerHTML = '<p class="pca-raster-error">No se pudo analizar: ' + esc(err.message) + '</p>';
        if (btn) { btn.disabled = false; btn.textContent = '🛰️ Analizar cobertura'; }
      });
      return true;
    }
    if (name === 'geo') {
      const gid = el && el.dataset.gid;
      const ctx = (typeof window.urbisProCityCtxAnalisis === 'function') ? window.urbisProCityCtxAnalisis() : null;
      if (!ctx) return true;
      if (S.geo.tipo === gid) { apagarGeo(); return true; }
      S.geo.tipo = gid;
      const n = pintarGeo(ctx);
      reg(n >= 2 ? 'geo-generada' : 'geo-sin-puntos', { n: n });
      if (typeof window.urbisProCityCerrarStats === 'function') window.urbisProCityCerrarStats();
      cerrarBurbuja();
      chipGeo(ctx);
      if (n < 2) alert('Con este filtro solo hay ' + n + ' punto' + (n === 1 ? '' : 's') +
        ' dentro del área. Elige "Todo lo mapeado" u otra categoría para ver la geometría.');
      return true;
    }
    // Cambiar el filtro no cierra el panel: se está eligiendo qué conectar,
    // y lo normal es probar varias categorías seguidas antes de dibujar.
    if (name === 'geo-filtro') {
      S.geo.grupo = (el && el.dataset.gid) || 'todos';
      reg('geo-filtro');
      refrescarGeo();
      if (typeof window.urbisProCityAbrirAnalisis === 'function') window.urbisProCityAbrirAnalisis();
      return true;
    }
    if (name === 'geo-off') {
      apagarGeo();
      const enPanel = el && el.closest('.pca-panel');
      if (enPanel && typeof window.urbisProCityAbrirAnalisis === 'function') window.urbisProCityAbrirAnalisis();
      return true;
    }
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
    dentroDelPoligono, areaM2, perimetroM,
    // Mapa de calor (Fase 2)
    heatActivo: () => S.heat.grupo, encenderHeat, apagarHeat,
    // Geometría (Fase 3)
    geoActiva: () => S.geo.tipo, apagarGeo,
    // Cobertura del suelo (Fase 4)
    analizarRaster, clasificarPixel, ultimoRaster: () => S.raster
  };
})();
