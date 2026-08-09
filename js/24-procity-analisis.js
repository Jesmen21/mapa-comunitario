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
    heat: { grupo: null, canvas: null, chip: null, pintando: false }
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
    const abrir = () => {
      if (abierta) return;
      abierta = true;
      burbuja();
      // El calor se filtra por el área: al cerrar una nueva hay que rehacerlo.
      if (S.heat.grupo) { try { pintarHeat(); } catch(e){} }
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
    repintar(); pintarBarra();
    // El calor se filtra por el area: si el area cambia, hay que repintarlo.
    if (S.heat.grupo) { try { pintarHeat(); } catch(e){} }
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
    // Al elegir una capa de calor se cierra el panel: el mapa está detrás y
    // sin cerrarlo no se vería nada de lo que se acaba de encender.
    if (name === 'heat') {
      const gid = el && el.dataset.gid;
      if (S.heat.grupo === gid) { apagarHeat(); return true; }
      if (typeof window.urbisProCityCerrarStats === 'function') window.urbisProCityCerrarStats();
      cerrarBurbuja();
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
    heatActivo: () => S.heat.grupo, encenderHeat, apagarHeat
  };
})();
