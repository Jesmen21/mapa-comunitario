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
    // 'clases' = la imagen clasificada; 'foto' = la foto satelital TAL CUAL se
    // analizó. Poder alternar importa: el mapa de fondo es de Google y la foto
    // que se clasifica es de Esri, y no tienen por qué ser del mismo año. Sin
    // esta comparación, un árbol que está en el mapa pero no en la foto parece
    // un fallo del clasificador cuando en realidad no estaba en la imagen.
    rasterVista: 'clases',
    rasterChip: null,
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
  // El filtro de vista (👁️) lo resuelve js/20, que es quien lo tiene. Si por
  // lo que sea no llegara, se deja pasar todo antes que dejar el mapa en
  // blanco: perder el filtro es un defecto menor que perder el calor entero.
  function visibleSegunMapa(ctx){
    return (ctx && typeof ctx.visible === 'function') ? ctx.visible : () => true;
  }

  // Cómo está el filtro de vista del mapa, para poder decirlo en pantalla.
  function vistaDelMapa(ctx){
    try { if (ctx && typeof ctx.vista === 'function') return ctx.vista(); } catch(e){}
    return { id:'todos', ico:'🌐', etq:'todo el mundo' };
  }
  function vistaTexto(ctx){
    const v = vistaDelMapa(ctx);
    return v.ico + ' Se genera sobre lo que estás viendo: <b>' + esc(v.etq) + '</b>' +
      (v.id === 'todos' ? '' : '. Cambia la vista con el botón 👁️ del mapa.');
  }

  function puntosParaHeat(ctx){
    const gid = S.heat.grupo;
    const hayArea = S.cerrada && S.pts.length >= 3;
    const seVe = visibleSegunMapa(ctx);
    const out = [];
    datosURBIS().forEach(p => {
      if (!p || !ctx.esProCity(p.tipo)) return;
      // Mismo criterio que la geometría: el calor mide lo que se está viendo.
      if (!seVe(p)) return;
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
      (S.cerrada && S.pts.length >= 3 ? ' · dentro del área' : '') +
      ' · ' + vistaDelMapa(ctx).ico + ' ' + esc(vistaDelMapa(ctx).etq) + '</small></div>' +
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
    // son mapeo urbano y falsearían el conteo. Y solo lo VISIBLE: los conteos
    // por categoría de este cálculo son los que se muestran junto a cada chip
    // de "¿qué puntos conectar?", así que si contaran puntos ocultos el número
    // prometería una red que después no se dibuja.
    const seVe = visibleSegunMapa(ctx);
    const pc = dentro.filter(p => ctx.esProCity(p.tipo) && seVe(p));

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
    const foto = S.rasterVista === 'foto' && res.imagen;
    L.imageOverlay(foto ? res.imagen : res.overlayImagen, res.overlayLimites, {
      opacity: foto ? 1 : .8, interactive: false, className: 'pca-raster-overlay'
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
      '<button type="button" class="pca-raster-chip-foto' + (S.rasterVista === 'foto' ? ' activo' : '') + '" ' +
        'data-u52-call="pca-raster-foto" title="Comparar con la foto que se analizó" ' +
        'aria-label="Ver la foto satelital analizada">' + (S.rasterVista === 'foto' ? '🎨' : '🛰️') + '</button>' +
      '<button type="button" data-u52-call="pca-raster-off" aria-label="Quitar la capa de cobertura">✕</button>';
  }

  function apagarRasterMapa(){
    S.rasterVista = 'clases';   // la próxima vez se abre en la clasificación
    if (S.rasterCapa) S.rasterCapa.clearLayers();
    if (S.rasterChip) { try { S.rasterChip.remove(); } catch(e){} S.rasterChip = null; }
  }

  // Puntos de Pro City dentro del área, ya con lat/lng numéricos — insumo
  // común a las tres geometrías. `S.geo.grupo` decide QUÉ se conecta: 'todos'
  // (cualquier cosa mapeada) o una categoría de la Matriz, para poder leer
  // por separado la red del comercio, la de los equipamientos, etc.
  function puntosGeo(ctx){
    const filtro = S.geo.grupo || 'todos';
    const seVe = visibleSegunMapa(ctx);
    return datosURBIS().reduce((acc, p) => {
      if (!p || !ctx.esProCity(p.tipo)) return acc;
      // La geometría se teje sobre lo que está A LA VISTA. Si el mapa está en
      // "solo lo mío", conectar además los puntos de los demás cambia el
      // trazado con evidencia que el usuario no está viendo.
      if (!seVe(p)) return acc;
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
    // El chip dice también SOBRE QUÉ conjunto se tejió (👤/👥/📁/🌐): es la
    // única pista en el mapa de por qué la red conecta unos puntos y no otros.
    const v = vistaDelMapa(ctx);
    const aviso = n < 2
      ? 'Solo ' + n + ' punto' + (n === 1 ? '' : 's') + ' en ' + v.ico + ' ' + esc(v.etq)
      : n + ' puntos · ' + esc(nombreFiltroGeo(ctx)) + ' · ' + v.ico + ' ' + esc(v.etq);
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

  // Cambió QUÉ se ve en el mapa (👁️ la vista, 🔷 la matriz, el viaje en el
  // tiempo). Lo llama js/20 desde renderProCityPoints, que es por donde pasa
  // todo cambio de filtro: lo dibujado encima se rehace con el conjunto nuevo
  // en vez de quedar colgado del anterior.
  function refrescarPorFiltro(){
    if (S.geo.tipo) { try { refrescarGeo(); } catch(e){} }
    if (S.heat.grupo) { try { pintarHeat(); } catch(e){} }
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
      // Decir SOBRE QUÉ se va a generar. Sin esto, un usuario con el mapa en
      // "solo lo mío" no tiene forma de saber si la red que ve sale de sus
      // puntos o de los de todo el mundo.
      '<div class="pca-geo-vista">' + vistaTexto(ctx) + '</div>' +
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
  // Más resolución = menos píxeles mezclados (un píxel mitad árbol mitad techo
  // no es ni una cosa ni la otra y se pierde). A 420 cada píxel cubría ~2 m de
  // barrio y los árboles de andén desaparecían; a 640 se sostienen.
  // Tres lecturas del MISMO recuadro a distinta resolución, y después votan.
  // No es repetir por repetir: al pedirle a Esri un tamaño mayor para el mismo
  // recuadro, sirve un nivel más profundo de su pirámide, o sea una foto de
  // verdad más detallada. La fina distingue el arbolito de andén; la gruesa
  // es más estable frente al ruido de compresión, que a máxima resolución
  // inventa píxeles de colores que no existen en el suelo. Donde las tres
  // coinciden, la respuesta es sólida; donde discrepan, gana la mayoría.
  const ESCALAS = [720, 1080, 1440];

  // Colores y códigos de las clases. Códigos numéricos porque las pasadas de
  // vecindad recorren millones de píxeles y con cadenas de texto el teléfono
  // se arrastra.
  const COD = { verde: 1, construido: 2, agua: 3, mixto: 4 };
  const NOM = [null, 'verde', 'construido', 'agua', 'mixto'];
  const RGB = {
    verde:      [34, 197, 94],
    construido: [148, 163, 184],
    agua:       [59, 130, 246],
    mixto:      [201, 162, 106]
  };
  // Opacidad visible pero que deja intuir el satelital de fondo.
  const ALPHA = 176;
  // Filtro de mayoría: quita el granulado sal-y-pimienta. Pide DOS cosas para
  // cambiar un píxel, y la segunda es la importante:
  //   · que otra clase ocupe al menos MAYORIA_MIN de sus 9 vecinos, y
  //   · que el píxel esté SOLO — que su propia clase no pase de MAYORIA_SOLO.
  //
  // Sin esa segunda condición el filtro se comía los árboles chicos, que es
  // justo lo que se veía. Una copa de 3×3 píxeles tiene 4 de los suyos en cada
  // esquina y 5 ajenos: con la regla vieja las esquinas caían, y a la pasada
  // siguiente caía lo que quedaba, hasta borrar el árbol entero. Pidiendo
  // además que esté solo, una copa de 2×2 ya se sostiene (~1,5 m de diámetro)
  // y solo desaparece el píxel suelto, que sí es ruido.
  const MAYORIA_MIN = 5;
  const MAYORIA_SOLO = 2;
  // Superficie mínima para que una mancha azul cuente como cuerpo de agua.
  // El techo de zinc azul —abundante en el barrio— tiene EXACTAMENTE el mismo
  // color que el agua somera: (62,82,116) contra (34,54,82) son el mismo azul
  // acero, y sin banda infrarroja el RGB no los separa. Lo que sí los separa es
  // el tamaño y la continuidad: una quebrada o un jagüey pasan holgado de
  // 600 m², un techo no. El costo declarado es que una piscina de patio se
  // cuenta como superficie dura, y se prefiere eso a pintar de agua media
  // manzana de techos.
  const AGUA_MIN_M2 = 600;

  // Dos umbrales de verde, no uno. La vegetación no tiene una frontera nítida
  // en el color: hay copa que grita verde y copa que lo susurra —la que está
  // en sombra profunda, la velada por neblina o calima, y el borde de copa que
  // comparte píxel con el suelo—. Un umbral único obliga a elegir entre perder
  // esa franja (lo que se veía: árboles enteros sin pintar) o dejar entrar el
  // pasto seco y el caqui, que es peor porque infla la cifra ambiental.
  //
  // Así que se separa la decisión de la evidencia:
  //  · VERDE_FIRME  — evidencia suficiente por sí sola.
  //  · VERDE_DEBIL  — sospecha; solo cuenta si TOCA vegetación confirmada.
  // El píxel dudoso se resuelve por contexto, igual que lo resolvería un ojo:
  // un tono apagado en mitad de una copa es copa; el mismo tono en mitad de un
  // patio de tierra no lo es.
  const VERDE_FIRME = .07;
  const VERDE_DEBIL = .025;
  // Piso de saturación, que es lo que separa la hoja del pavimento.
  //
  // La calle en sombra bajo una hilera de árboles recibe luz REBOTADA en las
  // hojas y queda con un tinte verdoso: un asfalto sombreado tipo (55,60,52)
  // llega a exg .078 y pasaba el umbral firme, así que las vías aparecían
  // pintadas de verde. Pero el tinte prestado es pálido —la saturación se
  // queda por 0.13— mientras que la hoja, aun en sombra profunda, conserva
  // color propio y ronda 0.30 o más. Exigir un mínimo de saturación tira el
  // asfalto sin tocar la copa.
  //
  // Se le pide MENOS al candidato débil que al firme: ahí el piso solo tiene
  // que frenar al pavimento, porque para entrar además debe estar pegado a
  // copa confirmada.
  // Los valores salen de barrer el umbral contra una escena con calle arbolada
  // y árboles chicos: por debajo de .15 el asfalto sombreado empieza a colarse
  // (a .14 ya se pinta de verde un tercio de la calle) y por encima de .19 se
  // pierden los arbolitos apagados. .17 queda con margen a los dos lados.
  const VERDE_SAT_FIRME = .17;
  const VERDE_SAT_DEBIL = .145;
  // Cuántos píxeles puede avanzar el contagio desde la copa confirmada. Acota
  // el crecimiento para que no se escape por un degradado hasta teñir media
  // manzana: a ~0.6 m por píxel son unos 4 m, la franja de sombra de un árbol.
  // Ojo: va en PÍXELES, y las pasadas corren a resoluciones distintas, así que
  // el alcance se reescala en cada una (ver `crece` en clasificarMalla). Sin
  // eso, la misma cifra significa cuatro metros a 640 px y menos de dos a 1440:
  // al subir la resolución el contagio se quedaba corto justo donde más
  // detalle había, y el borde apagado de la copa volvía a perderse.
  const VERDE_CRECE = 6;      // calibrado sobre una malla de 640 px de ancho
  const VERDE_CRECE_BASE = 640;

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
  //
  // Segunda calibración (bug reportado: "a simple vista veo más área verde que
  // no me está rasterizando"). La causa era comparar canales en ABSOLUTO:
  //
  //     g > r + 10 && g > b + 6
  //
  // Esa distancia fija se sostiene en copa iluminada, pero se desvanece en
  // sombra, donde los tres canales bajan juntos: una copa a plena luz (60,72,45)
  // pasaba, y la misma copa sombreada (40,47,32) —igual de verde a la vista—
  // se caía por 3 unidades y terminaba en "tonos cálidos". En un barrio con
  // arborización densa, media copa está sombreada por la otra media, así que
  // se perdía justo lo que el usuario ve como verde.
  //
  // La corrección es medir el color en PROPORCIÓN y no en distancia: se pasa a
  // coordenadas cromáticas (cada canal dividido por la suma) y se usa el
  // Excess Green, ExG = 2G − R − B, el índice estándar para vegetación cuando
  // no hay banda infrarroja. Al normalizar, la sombra deja de importar: lo que
  // se mide es la proporción de verde, que se conserva al oscurecerse.
  //
  // El ExG solo NO alcanza: un caqui seco (140,135,95) da ExG .095 y se colaría
  // como vegetación viva, que es justo el error contra el que advierte el
  // párrafo de arriba. Por eso se le exige además que el verde sea el canal
  // dominante (g > r): la vegetación viva lo cumple hasta en sombra profunda,
  // el pasto seco y el suelo caqui no lo cumplen nunca.
  // `U` trae los umbrales calculados para la foto en curso; si no llega, manda
  // el criterio fijo de siempre (así la función sigue sirviendo suelta).
  function clasificarPixel(r, g, b, U){
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const suma = r + g + b || 1;
    const R = r / suma, G = g / suma, B = b / suma;   // coordenadas cromáticas
    const luz = suma / 3;
    const exg = 2 * G - R - B;   // Excess Green: vegetación
    const exb = 2 * B - R - G;   // Excess Blue: agua y azules

    // Vegetación viva. Va PRIMERO: la copa en sombra también es azulada y, si
    // el agua se evaluara antes, se la llevaría.
    if (exg > (U && U.firme || VERDE_FIRME) && g > r && sat >= VERDE_SAT_FIRME) return 'verde';
    // Agua: azul en proporción y superficie oscura. El umbral de luz baja de
    // 145 a 125 porque los techos de zinc azul del barrio —abundantes— caían
    // dentro; los que aún se cuelen los limpia el filtro de manchas chicas.
    if (exb > .09 && luz < 125) return 'agua';
    // Gris neutro: asfalto, concreto y cubiertas metálicas. Fiable cuando la
    // saturación es realmente baja.
    if (sat < .16) return 'construido';
    // Todo lo demás son tonos cálidos (beige, caqui, terracota, oliva) donde
    // conviven teja, concreto envejecido, suelo descubierto y matorral seco.
    // El color no los separa: se declara como tal.
    return 'mixto';
  }

  // ¿Este píxel es sospechoso de vegetación aunque no alcance para declararlo?
  // Se le pide un sesgo verde real pero débil, y que el verde no quede por
  // debajo de ningún otro canal — con eso el gris de cubierta (donde los tres
  // canales van casi iguales) y todo lo cálido quedan fuera desde el principio,
  // por más que estén pegados a un árbol.
  function esVerdeDebil(r, g, b, U){
    const suma = r + g + b || 1;
    const exg = (2 * g - r - b) / suma;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    return exg > (U && U.debil || VERDE_DEBIL) && g >= r && g >= b && sat >= VERDE_SAT_DEBIL;
  }

  // Convierte píxel → lat/lng. La imagen se pide en EPSG:4326 con el bbox del
  // área, así que el mapeo es lineal (a escala de barrio la distorsión es
  // despreciable y evita meter una proyección completa).
  function latLngDePixel(x, y, w, h, bb){
    return { lat: bb.n - (y + .5) / h * (bb.n - bb.s),
             lng: bb.o + (x + .5) / w * (bb.e - bb.o) };
  }

  // Descarga UNA imagen del recuadro al tamaño pedido y devuelve sus píxeles.
  function pedirImagenSatelital(caja, w, h){
    return new Promise(function (resolve, reject) {
      const url = RASTER_URL + '?bbox=' + [caja.o, caja.s, caja.e, caja.n].join(',') +
        '&bboxSR=4326&imageSR=4326&size=' + w + ',' + h + '&format=png&f=image';
      const img = new Image();
      img.crossOrigin = 'anonymous';       // sin esto el canvas queda "tainted"
      img.onerror = function () { reject(new Error('No se pudo descargar la imagen satelital.')); };
      img.onload = function () {
        try {
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const cx = cv.getContext('2d');
          cx.drawImage(img, 0, 0, w, h);
          resolve({ datos: cx.getImageData(0, 0, w, h).data, w: w, h: h, lienzo: cv });
        } catch (e) {
          reject(new Error('El navegador bloqueó la lectura de la imagen (CORS).'));
        }
      };
      img.src = url;
    });
  }

  // ── Corrección del velo atmosférico ──────────────────────────────────────
  // Esta es la pieza que faltaba. Comparando la foto de Esri contra el mapa de
  // fondo se ve que llega LAVADA: bruma y calima le suman a los tres canales
  // una capa de luz difusa que no viene del suelo, y esa capa aplana el color.
  // Un árbol que en la foto limpia satura .35 puede quedar en .16 bajo velo, y
  // ahí ya no pasa ningún umbral fijo — por eso quedaban árboles sin pintar
  // aunque a la vista fueran obviamente verdes.
  //
  // Se corrige con sustracción de objeto oscuro, el método clásico de
  // teledetección: en una escena cualquiera SIEMPRE hay algo casi negro (una
  // sombra profunda), así que lo que ese píxel marca por encima de cero es
  // velo, no suelo. Se le resta a cada canal su propio piso y se reestira el
  // rango. Por canal y no en conjunto, porque el velo es azulado y castiga
  // desigual: el azul se lleva la peor parte.
  //
  // Y no se aplica siempre igual: se DOSIFICA según cuánta bruma haya de
  // verdad, medida con el canal oscuro (el mínimo de los tres canales de cada
  // píxel). En una foto sin bruma siempre hay algún punto donde ese mínimo cae
  // casi a cero —una sombra bajo un alero—; cuando la bruma cubre la escena
  // ese piso se levanta, porque es luz que no viene del suelo. Hizo falta:
  // corrigiendo a ciegas, una escena cuyo punto más oscuro ES vegetación
  // terminaba desverdecida, que es el error opuesto al que se quería arreglar.
  function quitarVelo(datos, n){
    const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    const oscuro = new Uint32Array(256);
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      hist[0][datos[i]]++; hist[1][datos[i + 1]]++; hist[2][datos[i + 2]]++;
      const mn = datos[i] < datos[i + 1] ? (datos[i] < datos[i + 2] ? datos[i] : datos[i + 2])
                                         : (datos[i + 1] < datos[i + 2] ? datos[i + 1] : datos[i + 2]);
      oscuro[mn]++;
    }
    // Percentiles y no mínimo/máximo absolutos: un solo píxel quemado o muerto
    // —y en una foto satelital siempre hay— arruinaría el estiramiento.
    const corte = function (h, frac) {
      let acc = 0; const meta = n * frac;
      for (let v = 0; v < 256; v++) { acc += h[v]; if (acc >= meta) return v; }
      return 255;
    };
    // El QUITAR va por canal; el AMPLIFICAR, no. Es una distinción que costó
    // una medición entender: restar el piso de cada canal por separado es lo
    // correcto, porque el velo azulea y castiga distinto a cada uno. Pero
    // estirar después cada canal a su propio rango es maquillaje de contraste,
    // y al aplicar tres ganancias distintas TUERCE el tono: en la prueba, los
    // arbolitos apagados pasaron de recuperarse casi todos a perderse casi
    // todos. Con una ganancia común, las proporciones de color ya corregidas
    // se mantienen, que es de lo que vive todo el clasificador.
    // El velo se quita COMPLETO, sin dejar margen de cortesía. Se probó dejar
    // un resto (por aquello de que una foto sana ya tiene píxeles casi negros)
    // y salió peor en los dos escenarios: el término que suma la bruma es
    // aditivo, y cualquier resto que quede sigue diluyendo el color: los
    // arbolitos apagados se perdieron de nuevo. O se quita entero o no sirve.
    // Cuánta bruma hay: 0 si el canal oscuro llega casi a negro (foto limpia),
    // 1 cuando el piso está claramente levantado.
    const SIN_BRUMA = 18, TODA_BRUMA = 78;
    const a0 = corte(oscuro, .005);
    const fuerza = Math.max(0, Math.min(1, (a0 - SIN_BRUMA) / (TODA_BRUMA - SIN_BRUMA)));

    let rangoMax = 24;
    const crudo = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const lo = corte(hist[c], .005), hi = corte(hist[c], .995);
      crudo[c] = lo;
      rangoMax = Math.max(rangoMax, hi - lo);
    }
    // Guarda física: la luz de bruma NUNCA es verde-dominante. El cielo dispersa
    // hacia el azul, así que el velo va de gris a celeste, jamás con el verde
    // por encima de los otros dos. Cuando el piso sale verde-dominante no es
    // velo: es que lo más oscuro de la foto ES vegetación, y restarlo
    // desverdecería justo lo que se quiere encontrar. Ahí el verde se recorta
    // al mayor de los otros dos canales y el resto de la corrección sigue.
    crudo[1] = Math.min(crudo[1], Math.max(crudo[0], crudo[2]));

    let velo = 0;
    const piso = [0, 0, 0];
    for (let c = 0; c < 3; c++) { piso[c] = crudo[c] * fuerza; velo += piso[c]; }
    // La ganancia se dosifica igual: en una foto sana no se toca el contraste.
    const gan = 1 + (255 / rangoMax - 1) * fuerza;
    const lut = [];
    for (let c = 0; c < 3; c++) {
      const t = new Uint8Array(256);
      for (let v = 0; v < 256; v++) {
        t[v] = Math.max(0, Math.min(255, Math.round((v - piso[c]) * gan)));
      }
      lut.push(t);
    }
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      datos[i] = lut[0][datos[i]]; datos[i + 1] = lut[1][datos[i + 1]]; datos[i + 2] = lut[2][datos[i + 2]];
    }
    return Math.round(velo / 3);
  }

  // ── Umbral de verde adaptado a ESTA foto ─────────────────────────────────
  // Aun corregido el velo, dos fotos del mismo barrio en distinta estación o
  // con distinto procesado no comparten el mismo punto de corte. En vez de
  // clavar un número, se busca dónde se parte el histograma del índice de
  // verde con el método de Otsu: el umbral que deja los dos grupos —lo que es
  // vegetación y lo que no— lo más apretados posible cada uno por dentro.
  //
  // Va acotado entre VERDE_MIN y VERDE_MAX. Otsu supone que hay dos grupos, y
  // en un área que sea toda techo o toda monte no los hay: sin tope, inventaría
  // una frontera en medio del único grupo que existe y partiría en dos algo
  // homogéneo. El tope hace que en ese caso mande el criterio fijo de siempre.
  // El piso baja a .035 porque ahora el umbral se decide sobre una foto ya
  // sin velo, donde el verde real destaca más y no hace falta ser tan estricto.
  // Los pisos de saturación, en cambio, se quedan donde estaban: la escena de
  // prueba dejó de poder calibrarlos —al quitar el velo, el asfalto sombreado
  // resulta ser el objeto oscuro de esa escena y se neutraliza solo, cosa que
  // en una foto real no pasa—, así que se conserva el valor medido antes, que
  // además cae justo entre el pavimento (~.13) y la hoja (~.30) medidos sobre
  // color ya corregido, que es el régimen en el que ahora trabaja todo.
  const VERDE_MIN = .035, VERDE_MAX = .105;
  function umbralVerdeDeLaFoto(datos, n){
    const B = 256, LO = -.4, HI = .4;
    const hist = new Uint32Array(B);
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const suma = datos[i] + datos[i + 1] + datos[i + 2] || 1;
      const exg = (2 * datos[i + 1] - datos[i] - datos[i + 2]) / suma;
      let b = Math.round((exg - LO) / (HI - LO) * (B - 1));
      if (b < 0) b = 0; else if (b >= B) b = B - 1;
      hist[b]++;
    }
    let total = 0, suma = 0;
    for (let b = 0; b < B; b++) { total += hist[b]; suma += b * hist[b]; }
    let sumaB = 0, pesoB = 0, mejorVar = -1, mejorB = 0;
    for (let b = 0; b < B; b++) {
      pesoB += hist[b];
      if (!pesoB) continue;
      const pesoF = total - pesoB;
      if (!pesoF) break;
      sumaB += b * hist[b];
      const mediaB = sumaB / pesoB, mediaF = (suma - sumaB) / pesoF;
      const entre = pesoB * pesoF * (mediaB - mediaF) * (mediaB - mediaF);
      if (entre > mejorVar) { mejorVar = entre; mejorB = b; }
    }
    const bruto = LO + (mejorB + .5) / (B - 1) * (HI - LO);
    // La foto solo puede pedir MÁS permisividad, nunca menos: el umbral fijo
    // hace de techo. Otsu busca el corte que más separa dos grupos, y en un
    // área con mucha vegetación y un fondo claro ese corte se le va hacia
    // arriba y deja fuera la cola de copa apagada — justo lo que se quería
    // rescatar. Dejándolo solo bajar, la parte adaptativa ayuda donde hace
    // falta (foto lavada) y no puede estropear lo ya calibrado.
    return Math.max(VERDE_MIN, Math.min(VERDE_FIRME, bruto));
  }

  // Clasifica una malla completa: umbral por píxel, filtro de mayoría y
  // crecimiento de la copa sobre sus dudas. El agua y la máscara del área NO
  // se resuelven aquí: eso se hace UNA vez, después de que las pasadas voten.
  function clasificarMalla(datos, w, h, U){
    const n = w * h;
    const cls = new Uint8Array(n);
    const dudoso = new Uint8Array(n);
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      cls[p] = COD[clasificarPixel(datos[i], datos[i + 1], datos[i + 2], U)];
      if (cls[p] !== COD.verde && esVerdeDebil(datos[i], datos[i + 1], datos[i + 2], U)) dudoso[p] = 1;
    }

    // Filtro de mayoría 3×3. Suavizado posterior a la clasificación, práctica
    // estándar en teledetección: un píxel suelto de otra clase en medio de una
    // copa es ruido del sensor o del JPEG, no un cambio de cobertura.
    const suave = new Uint8Array(cls);
    const cnt = new Uint8Array(5);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        cnt[1] = cnt[2] = cnt[3] = cnt[4] = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const f = p + dy * w;
          cnt[cls[f - 1]]++; cnt[cls[f]]++; cnt[cls[f + 1]]++;
        }
        const propio = cls[p];
        if (cnt[propio] > MAYORIA_SOLO) continue;   // no está solo: es un rasgo, no ruido
        let mejor = propio, nMejor = 0;
        for (let k = 1; k <= 4; k++) if (cnt[k] > nMejor) { nMejor = cnt[k]; mejor = k; }
        if (nMejor >= MAYORIA_MIN) suave[p] = mejor;
      }
    }

    // La copa crece sobre sus propias dudas: crecimiento por regiones desde
    // semilla, hasta VERDE_CRECE pasos. Recupera el borde sombreado y el árbol
    // velado sin abrirle la puerta al pasto seco, porque solo avanza sobre
    // píxeles que ya tenían sesgo verde y solo partiendo de copa confirmada.
    // Alcance en metros, no en píxeles: se reescala con el ancho de ESTA malla
    // para que las tres pasadas contagien la misma distancia sobre el suelo.
    const crece = Math.max(3, Math.round(VERDE_CRECE * w / VERDE_CRECE_BASE));
    const cola = new Int32Array(n);
    const salto = new Int16Array(n);
    let cabeza = 0, cuelo = 0;
    for (let p = 0; p < n; p++) if (suave[p] === COD.verde) { cola[cuelo++] = p; salto[p] = 1; }
    while (cabeza < cuelo) {
      const p = cola[cabeza++];
      const d = salto[p];
      if (d > crece) continue;
      const x = p % w, y = (p - x) / w;
      for (let k = 0; k < 4; k++) {
        const q = k === 0 ? (x > 0 ? p - 1 : -1)
                : k === 1 ? (x < w - 1 ? p + 1 : -1)
                : k === 2 ? (y > 0 ? p - w : -1)
                :           (y < h - 1 ? p + w : -1);
        if (q < 0 || salto[q] || !dudoso[q]) continue;
        suave[q] = COD.verde;
        salto[q] = d + 1;
        cola[cuelo++] = q;
      }
    }
    return suave;
  }

  // Lleva una malla de clases a la rejilla final por vecino más cercano. No se
  // interpola a propósito: entre "vegetación" y "construido" no hay término
  // medio, un promedio inventaría una clase que no existe.
  function remuestrear(cls, w, h, W, H){
    if (w === W && h === H) return cls;
    const out = new Uint8Array(W * H);
    for (let Y = 0; Y < H; Y++) {
      const y = Math.min(h - 1, Math.floor((Y + .5) * h / H));
      for (let X = 0; X < W; X++) {
        const x = Math.min(w - 1, Math.floor((X + .5) * w / W));
        out[Y * W + X] = cls[y * w + x];
      }
    }
    return out;
  }

  function analizarRaster(progreso){
    const avisar = typeof progreso === 'function' ? progreso : function(){};
    return new Promise(function (resolve, reject) {
      if (!S.cerrada || S.pts.length < 3) { reject(new Error('Primero dibuja un área.')); return; }
      const bb = bboxDelArea(S.pts);
      // Se pide un poco más ancho que el área para que el borde no quede pegado.
      const mLat = (bb.n - bb.s) * .04, mLng = (bb.e - bb.o) * .04;
      const caja = { s: bb.s - mLat, n: bb.n + mLat, o: bb.o - mLng, e: bb.e + mLng };
      // Se conserva la proporción real del área: pedir siempre un cuadrado
      // deformaría un área alargada y falsearía los porcentajes.
      const prop = (caja.n - caja.s) / Math.max(1e-9, (caja.e - caja.o));
      const tam = function (lado) {
        return { w: lado, h: Math.max(60, Math.min(Math.round(lado * 1.6), Math.round(lado * prop))) };
      };

      // La rejilla final es la de la pasada más fina; las otras se llevan a
      // ella para poder votar celda por celda.
      const FINA = tam(ESCALAS[ESCALAS.length - 1]);
      const W = FINA.w, H = FINA.h, N = W * H;

      const votos = [];
      let lienzoFino = null, veloMedio = 0, umbralMedio = 0;

      // Las pasadas van EN SERIE, no en paralelo: cada una son varios millones
      // de píxeles y un teléfono con tres a la vez se queda sin memoria.
      let cadena = Promise.resolve();
      ESCALAS.forEach(function (lado, idx) {
        cadena = cadena.then(function () {
          avisar('Pasada ' + (idx + 1) + ' de ' + ESCALAS.length + ' · leyendo a ' + lado + ' px…');
          const t = tam(lado);
          return pedirImagenSatelital(caja, t.w, t.h).then(function (im) {
            veloMedio += quitarVelo(im.datos, t.w * t.h);
            const uFirme = umbralVerdeDeLaFoto(im.datos, t.w * t.h);
            umbralMedio += uFirme;
            const U = { firme: uFirme, debil: uFirme * (VERDE_DEBIL / VERDE_FIRME) };
            avisar('Pasada ' + (idx + 1) + ' de ' + ESCALAS.length + ' · clasificando ' +
                   (t.w * t.h / 1e6).toFixed(1) + ' M de píxeles…');
            const cls = clasificarMalla(im.datos, t.w, t.h, U);
            votos.push(remuestrear(cls, t.w, t.h, W, H));
            // La foto que se guarda para comparar es la de la pasada más fina,
            // y va YA corregida: es la que de verdad se clasificó.
            if (lado === ESCALAS[ESCALAS.length - 1]) {
              const cxi = im.lienzo.getContext('2d');
              const idata = cxi.createImageData(t.w, t.h);
              idata.data.set(im.datos);
              cxi.putImageData(idata, 0, 0);
              lienzoFino = im.lienzo;
            }
          });
        });
      });

      cadena.then(function () {
        avisar('Cruzando las ' + ESCALAS.length + ' pasadas…');

        // ── Voto entre pasadas ────────────────────────────────────────────
        // Cada resolución ve cosas distintas: la fina distingue el arbolito de
        // andén, la gruesa es más estable frente al ruido de compresión.
        //
        // La vegetación se cuenta por UNIÓN y el resto por mayoría, y no es
        // capricho: cada pasada es un detector, y un árbol reconocido a
        // cualquier resolución es un árbol —el que solo se ve en la fina es
        // justamente el chiquito, y el que solo se ve en la gruesa es el que a
        // máximo detalle se deshace en píxeles sueltos—. Exigirle mayoría a la
        // copa la castiga dos veces. Medido contra mayoría, la unión sube la
        // copa apagada de 75% a 95% SIN mover el falso positivo de la calle,
        // que se queda en 0%: cada pasada ya trae su propia prudencia (piso de
        // saturación, verde dominante, filtro de mayoría interno), así que
        // sumarlas recupera árboles sin dejar entrar pavimento.
        const final = new Uint8Array(N);
        const cnt = new Uint8Array(5);
        for (let p = 0; p < N; p++) {
          cnt[1] = cnt[2] = cnt[3] = cnt[4] = 0;
          for (let v = 0; v < votos.length; v++) cnt[votos[v][p]]++;
          if (cnt[COD.verde]) { final[p] = COD.verde; continue; }
          let mejor = votos[votos.length - 1][p], nMejor = cnt[mejor];
          for (let k = 1; k <= 4; k++) if (cnt[k] > nMejor) { nMejor = cnt[k]; mejor = k; }
          final[p] = mejor;
        }

        // ── Máscara del área, por barrido de líneas ────────────────────────
        // Cada fila de la imagen tiene latitud constante, así que basta cruzar
        // el polígono una vez por fila y rellenar los tramos entre cortes.
        // Mismo criterio par-impar que dentroDelPoligono(), sin preguntarlo
        // millones de veces.
        const dentroMask = new Uint8Array(N);
        const vert = S.pts, V = vert.length;
        const cortes = [];
        let dentro = 0;
        for (let y = 0; y < H; y++) {
          const lat = caja.n - (y + .5) / H * (caja.n - caja.s);
          cortes.length = 0;
          for (let k = 0, j = V - 1; k < V; j = k++) {
            const a = vert[j], c2 = vert[k];
            if ((a.lat > lat) !== (c2.lat > lat)) {
              const lng = a.lng + (lat - a.lat) / (c2.lat - a.lat) * (c2.lng - a.lng);
              cortes.push((lng - caja.o) / (caja.e - caja.o) * W - .5);
            }
          }
          if (cortes.length < 2) continue;
          cortes.sort(function (p, q) { return p - q; });
          const fila = y * W;
          for (let k = 0; k + 1 < cortes.length; k += 2) {
            const x0 = Math.max(0, Math.ceil(cortes[k]));
            const x1 = Math.min(W - 1, Math.floor(cortes[k + 1]));
            for (let x = x0; x <= x1; x++) { dentroMask[fila + x] = 1; dentro++; }
          }
        }
        if (!dentro) { reject(new Error('El área es demasiado pequeña para analizarla.')); return; }

        // ── Manchas de agua demasiado chicas ──────────────────────────────
        // El agua de verdad forma cuerpos continuos; un techo de zinc azul o
        // una sombra densa forman manchitas sueltas. Cada mancha que no llega
        // al mínimo se pasa a la clase que domina en su propio contorno: un
        // techo azul rodeado de techos grises termina en construido, y una
        // sombra dentro de una copa termina en vegetación.
        //
        // El mínimo va en METROS CUADRADOS reales y no en píxeles: el mismo
        // número de píxeles son 20 m² en un lote y media hectárea en un barrio.
        const m2Total = areaM2(S.pts);
        const m2PorPixel = m2Total / dentro;
        const MIN_AGUA = Math.min(
          Math.round(dentro * .06),
          Math.max(25, Math.round(AGUA_MIN_M2 / Math.max(1e-6, m2PorPixel)))
        );
        const visto = new Uint8Array(N);
        const pila = [];
        const blob = [];
        const borde = new Int32Array(5);
        for (let p0 = 0; p0 < N; p0++) {
          if (final[p0] !== COD.agua || visto[p0]) continue;
          pila.length = 0; blob.length = 0;
          borde[1] = borde[2] = borde[3] = borde[4] = 0;
          pila.push(p0); visto[p0] = 1;
          while (pila.length) {
            const p = pila.pop();
            blob.push(p);
            const x = p % W, y = (p - x) / W;
            for (let k = 0; k < 4; k++) {
              const q = k === 0 ? (x > 0 ? p - 1 : -1)
                      : k === 1 ? (x < W - 1 ? p + 1 : -1)
                      : k === 2 ? (y > 0 ? p - W : -1)
                      :           (y < H - 1 ? p + W : -1);
              if (q < 0) continue;
              if (final[q] === COD.agua) {
                if (!visto[q]) { visto[q] = 1; pila.push(q); }
              } else borde[final[q]]++;
            }
          }
          if (blob.length >= MIN_AGUA) continue;
          let rep = COD.construido, nRep = -1;
          for (let k = 1; k <= 4; k++) {
            if (k !== COD.agua && borde[k] > nRep) { nRep = borde[k]; rep = k; }
          }
          for (let k = 0; k < blob.length; k++) final[blob[k]] = rep;
        }

        // ── Contar dentro del área y pintar el overlay ─────────────────────
        const cvClas = document.createElement('canvas');
        cvClas.width = W; cvClas.height = H;
        const cxClas = cvClas.getContext('2d');
        const imgClas = cxClas.createImageData(W, H);
        const cuenta = { verde: 0, agua: 0, construido: 0, mixto: 0 };
        for (let p = 0; p < N; p++) {
          const i = p * 4;
          if (!dentroMask[p]) { imgClas.data[i + 3] = 0; continue; }
          const clase = NOM[final[p]];
          cuenta[clase]++;
          const rgb = RGB[clase];
          imgClas.data[i] = rgb[0]; imgClas.data[i + 1] = rgb[1]; imgClas.data[i + 2] = rgb[2];
          imgClas.data[i + 3] = ALPHA;
        }
        cxClas.putImageData(imgClas, 0, 0);

        const cv = lienzoFino || cvClas;
        const w = W, h = H;
        const pct = k => Math.round(1000 * cuenta[k] / dentro) / 10;
        const m2 = m2Total;
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
                nota:'Verde franco, incluida la copa en sombra. Es la clase más fiable: casi ningún material lo imita.' },
              { id:'construido', etq:'Superficie dura gris', ico:'🏗️', color:'#94a3b8',
                pct:pct('construido'), m2:sup('construido'), fiable:true,
                nota:'Asfalto, concreto y cubiertas metálicas de color neutro.' },
              { id:'agua',       etq:'Agua',                 ico:'💧', color:'#3b82f6',
                pct:pct('agua'), m2:sup('agua'), fiable:true,
                nota:'Azul oscuro y continuo. Las manchas sueltas —techo de zinc azul, sombra densa— se descartan por tamaño.' },
              { id:'mixto',      etq:'Tonos cálidos (no separables)', ico:'🟫', color:'#c9a26a',
                pct:pct('mixto'), m2:sup('mixto'), fiable:false,
                nota:'Teja, concreto envejecido, suelo descubierto y matorral seco comparten este rango de color.' }
            ],
            pctAmbiguo: pct('mixto'),
            areaM2: m2,
            // Diagnóstico de la corrida, para poder explicar en pantalla qué
            // tanto velo traía la foto y con qué umbral se acabó decidiendo.
            velo: Math.round(veloMedio / ESCALAS.length),
            umbral: Math.round(umbralMedio / ESCALAS.length * 1000) / 1000,
            pasadas: ESCALAS.length,
            malla: W + '×' + H
          });
      }).catch(function (e) {
        reject(e instanceof Error ? e : new Error('No se pudo analizar la imagen satelital.'));
      });
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
      // Ficha técnica de ESTA corrida. Va a la vista porque el resultado ya no
      // sale de una regla fija: depende de cuánto velo traía la foto y de qué
      // umbral pidió. Sin esto, dos análisis distintos del mismo sitio serían
      // inexplicables.
      '<p class="pca-raster-ficha">' + res.pasadas + ' lecturas cruzadas · malla ' + esc(res.malla) +
        ' · velo retirado ' + res.velo + ' de 255 · umbral de verde ' + res.umbral + '</p>' +
      '<div class="pca-raster-aviso"><b>⚠️ Cómo leer esto</b>' +
        '<small>Estimación por <b>color</b> de imagen satelital: <b>no es NDVI ni un estudio ' +
        'ambiental certificado</b>. Un NDVI real necesita banda infrarroja, que no está disponible ' +
        'gratis. Por eso solo se declaran tres clases fiables — vegetación viva, gris construido y ' +
        'agua — y todo lo demás queda en <b>tonos cálidos</b> (' + res.pctAmbiguo + '% del área), ' +
        'donde teja, concreto envejecido, suelo y matorral seco son indistinguibles por color. ' +
        'Sirve para dimensionar y comparar sectores, no para certificar.<br><br>' +
        'La foto se lee <b>tres veces</b> a distinta resolución y las lecturas se cruzan; antes ' +
        'de clasificar se le retira el velo de bruma, que es lo que aplana el color y hacía ' +
        'desaparecer árboles enteros. La vegetación se mide por <b>proporción</b> de verde y no ' +
        'por brillo, así que la copa en sombra también cuenta, y el borde apagado de una copa se ' +
        'resuelve por lo que tiene al lado. El botón 🛰️ del recuadro sobre el mapa muestra <b>la foto que se analizó</b>: ' +
        'no es la misma imagen del mapa de fondo y puede ser de otro año, así que si un árbol ' +
        'falta, ahí se ve si el problema es la clasificación o la foto. Las manchas de agua de menos de 600 m² se toman como techo ' +
        'o sombra —el zinc azul y el agua somera tienen el mismo color—, de modo que una ' +
        'piscina de patio no aparece.</small></div>';
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
    // Alterna entre la imagen clasificada y la foto satelital que se analizó,
    // clavadas en el MISMO recuadro: así se ve si un árbol que falta lo perdió
    // el clasificador o si nunca estuvo en la foto (que puede ser de otro año
    // que la del mapa de fondo).
    if (name === 'raster-foto') {
      if (!S.raster) return true;
      S.rasterVista = (S.rasterVista === 'foto') ? 'clases' : 'foto';
      pintarRasterMapa(S.raster);
      chipRaster();
      reg('raster-foto');
      return true;
    }
    if (name === 'raster') {
      const btn = el;
      const out = document.getElementById('pca-raster-out');
      if (btn) { btn.disabled = true; btn.textContent = '🛰️ Analizando…'; }
      // El análisis pasa de una lectura a tres, y a mucha más resolución: puede
      // tardar. Callado se siente colgado, así que va contando en qué anda.
      const avisar = function (txt) {
        if (out) out.innerHTML = '<p class="pca-raster-cargando">' + esc(txt) + '</p>';
      };
      avisar('Preparando el análisis…');
      analizarRaster(avisar).then(res => {
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
    geoActiva: () => S.geo.tipo, apagarGeo, refrescarPorFiltro,
    // Cobertura del suelo (Fase 4)
    analizarRaster, clasificarPixel, ultimoRaster: () => S.raster
  };
})();
