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
    // `externos` son puntos prestados (js/68 presta los usos que encontró en
    // OpenStreetMap); cuando los hay, mandan sobre los mapeos del curso.
    heat: { grupo: null, canvas: null, chip: null, pintando: false,
            externos: null, colorExterno: null, etqExterno: '', alApagar: null },
    // Fase 3 · geometría generada: `tipo` es 'red' | 'hull' | 'circulos'
    // (null = apagada) y `grupo` filtra QUÉ puntos se conectan ('todos' o
    // una categoría de la Matriz).
    // `tipo` es la forma; `par` son sus parámetros, que el botón de variación
    // mueve para generar composiciones distintas del mismo levantamiento.
    geo: { tipo: null, grupo: 'todos', capa: null, chip: null, ultimoConteo: 0,
           par: { k: 2, radio: 60, alpha: 90, impacto: 35 }, variante: 0 },
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
    rasterEnVectores: false,
    // Diagnóstico educativo en curso y si la propuesta de implantación está
    // desplegada. Se guarda para que el informe use exactamente lo que se vio.
    diag: null,
    verImplantacion: false,
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

  /* Mientras se dibuja, la barra manda en el borde de abajo.

     MEDIDO: los tres botones —deshacer, cancelar y cerrar— caían justo debajo
     de la barra de navegación del teléfono, que va con z-index 2.147.483.270
     contra los 100.000 de la barra. Tocar «Deshacer» cambiaba de pestaña. Los
     botones estaban ahí desde siempre y ninguno se podía tocar con el dedo:
     la única forma de cerrar el área era tocar el primer punto en el mapa, y
     la de arreglar un error, ninguna.

     Con la clase puesta, la navegación se esconde: mientras se dibuja no hay
     nada que hacer con ella, y la salida —«Cancelar»— pasa a estar donde se
     puede tocar. */
  function marcarQueSeDibuja(si){
    try { document.body.classList.toggle('urbis-dibujando-area', !!si); } catch(e){}
  }

  function pintarBarra(){
    const b = barra();
    if (!S.dibujando) { b.hidden = true; marcarQueSeDibuja(false); return; }
    marcarQueSeDibuja(true);
    const n = S.pts.length;
    const listo = n >= 3;
    b.innerHTML =
      '<div class="pca-barra-info">' +
        '<b>' + n + ' punto' + (n === 1 ? '' : 's') + '</b>' +
        '<small>' + (listo
          ? fmtArea(areaM2(S.pts)) + ' · borde ' + fmtDist(perimetroM(S.pts, true)) +
            ' — toca el punto dorado para cerrar, o cualquier otro para quitarlo'
          : n >= 1
            ? 'Toca el mapa para seguir el contorno. Un punto que salió mal se quita tocándolo.'
            : 'Toca el mapa para marcar el contorno (mínimo 3 puntos)') + '</small>' +
      '</div>' +
      '<div class="pca-barra-btns">' +
        /* Con la palabra al lado del icono. Un icono suelto entre un aspa y un
           «Cerrar área» no se lee como «deshacer»: se lee como adorno, y quien
           se equivocó en un punto no encuentra dónde arreglarlo. Los otros dos
           lápices de la aplicación ya lo dicen con todas las letras; este era
           el que faltaba. */
        '<button type="button" data-u52-call="pca-deshacer"' + (S.historia && S.historia.length ? '' : ' disabled') +
          ' aria-label="Deshacer lo último">' + ico('deshacer', 16) + 'Deshacer</button>' +
        '<button type="button" data-u52-call="pca-cancelar" aria-label="Cancelar el dibujo">' +
          '✕ Cancelar</button>' +
        '<button type="button" class="pca-ok" data-u52-call="pca-cerrar"' + (listo ? '' : ' disabled') + '>✓ Cerrar área</button>' +
      '</div>';
    b.hidden = false;
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────

  function iniciarDibujo(){
    if (!mapa()) { alert('El mapa aún no está listo.'); return; }
    /* Soltar los lápices de la hoja de reconocimiento —el del lote y el de
       lo intangible— antes de armar este. Con dos armados un solo toque
       alimenta los dos dibujos, y lo que se ve es que «no deja dibujar el
       área»: sale otra cosa. La regla vive en js/68 porque es quien conoce
       sus modos; acá solo se la pide. */
    try {
      var R = window.URBIS_PC_RECON;
      if (R && typeof R.soltarLapices === 'function') R.soltarLapices();
    } catch (e) {}
    reg('area-dibujo-inicio');
    cerrarBurbuja();
    S.dibujando = true;
    S.cerrada = false;
    S.pts = [];
    S.historia = [];
    S.nombre = '';
    repintar();
    pintarBarra();
    try { mapa().getContainer().style.cursor = 'crosshair'; } catch(e){}
  }

  /* El historial del dibujo. `deshacer` quitaba el último punto y ya; desde
     que también se puede BORRAR un vértice del medio, quitar el último dejaría
     de deshacer lo último que hizo la persona. Se guarda el estado anterior
     antes de cada cambio: eso es lo que la gente espera de un «control zeta»,
     y es lo que se pidió. */
  function recordar(){
    S.historia = (S.historia || []).concat([S.pts.map(function(p){ return {lat:p.lat, lng:p.lng}; })]);
    if (S.historia.length > 60) S.historia.shift();
  }

  /* Borrar un vértice tocándolo. El primero NO se borra: tocarlo cierra el
     área, que es lo que la barra viene diciendo desde siempre y lo que la
     gente ya tiene aprendido. Se mide en píxeles de pantalla y no en metros,
     por lo mismo que el cierre: lo que el dedo percibe es la distancia en
     pantalla, y a menos zoom 26 px son muchos metros. */
  function borrarVertice(lat, lng){
    if (!S.dibujando || S.pts.length < 2) return false;
    const m = mapa(); if (!m) return false;
    let cual = -1, mejor = 27;
    try {
      const b = m.latLngToContainerPoint({ lat, lng });
      for (let i = 1; i < S.pts.length; i++) {
        const a = m.latLngToContainerPoint(S.pts[i]);
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < mejor) { mejor = d; cual = i; }
      }
    } catch(e){ return false; }
    if (cual < 0) return false;
    recordar();
    S.pts.splice(cual, 1);
    repintar();
    pintarBarra();
    return true;
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
    // Tocar un vértice que ya está puesto lo quita, en vez de amontonar otro
    // encima. Es lo que se pidió: poder arreglar EL punto que salió mal, no
    // solo el último.
    if (borrarVertice(lat, lng)) return;
    recordar();
    S.pts.push({ lat, lng });
    repintar();
    pintarBarra();
  }

  function deshacer(){
    if (!S.dibujando) return;
    const h = S.historia || [];
    if (!h.length) return;
    S.pts = h.pop();
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
      '<div class="pca-burbuja-cab"><span>' + ico('area', 18) + '</span><b>Área lista</b>' +
        '<button type="button" class="pca-burbuja-x" data-u52-call="pca-cerrar-burbuja" aria-label="Cerrar">✕</button></div>' +
      '<div class="pca-burbuja-datos">' + fmtArea(areaM2(S.pts)) +
        ' · ' + S.pts.length + ' vértices</div>' +
      '<button type="button" class="pca-burbuja-ok" data-u52-call="pca-ver-analisis">' + ico('estadistica', 16) + 'Ver el análisis</button>' +
      '<div class="pca-burbuja-alt">' +
        '<button type="button" data-u52-call="pca-guardar">' + ico('guardar', 16) + 'Guardar</button>' +
        '<button type="button" data-u52-call="pca-dibujar">' + ico('lapiz', 16) + 'Rehacer</button>' +
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

  // Id de un área guardada. Antes era solo la hora en milisegundos: dos
  // guardados en el mismo instante chocaban y el segundo borraba al primero.
  function idDeArea(){ return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
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
      id: idDeArea(), nombre, pts: S.pts.slice(),
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
    return icoCat(v.ico, 14) + 'Se genera sobre lo que estás viendo: <b>' + esc(v.etq) + '</b>' +
      (v.id === 'todos' ? '' : '. Cambia la vista con el botón del ojo en el mapa.');
  }

  function puntosParaHeat(ctx){
    /* Puntos prestados. El reconocimiento (js/68) trae los usos que encontró
       en OpenStreetMap y quiere el mismo mapa de calor: en vez de copiar
       estas setenta líneas —con su manejo de zoom, de pantalla oculta y de
       reintentos— se le deja poner su propia lista. Todo lo demás es igual. */
    if (S.heat.externos) return S.heat.externos;

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
    // Con puntos prestados no hace falta el contexto de Pro City: los puntos
    // ya vienen resueltos. Exigirlo dejaría el calor apagado en el
    // reconocimiento sin decir por qué.
    if (!ctx && !S.heat.externos) return;

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
    /* A UN píxel por punto de pantalla, no a los dos de una retina.

       El teñido recorre el lienzo entero en JavaScript, píxel por píxel, para
       cambiar cada alfa acumulado por su color. En un teléfono con pantalla
       retina eso son un millón y medio de vueltas; a un píxel por punto son
       cuatrocientas mil. Medido en un equipo modesto, la diferencia es de 280
       a 90 milisegundos, y es lo que decide si el botón de una capa responde
       o se siente trabado.

       Lo que se pierde no se ve: esto es una mancha de degradados con los
       bordes difuminados a propósito. La nitidez de una retina sirve para el
       texto y para las líneas finas, no para una nube. El lienzo se estira por
       CSS al tamaño del mapa, así que ocupa lo mismo en pantalla. */
    const dpr = 1;
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

    /* El SELLO: el degradado, dibujado una sola vez en un lienzo aparte.

       Antes se creaba un degradado radial nuevo por cada punto. Con los
       novecientos usos de un sector denso eso son novecientos degradados
       —construir la rampa, resolver el círculo, rellenar— y medido en un
       teléfono modesto se llevaba 320 ms: casi todo lo que tardaba en
       responder el botón de una capa. La hoja entera, con sus treinta y cinco
       bloques y sus noventa kilobytes, tardaba cuarenta.

       Estampar una imagen ya resuelta es la misma cuenta hecha una vez. El
       resultado en pantalla es idéntico: mismo degradado, mismo radio, mismo
       alfa acumulado. */
    if (!S.heat.sello || S.heat.selloRadio !== radio) {
      const sc = document.createElement('canvas');
      sc.width = sc.height = radio * 2;
      const sg = sc.getContext('2d');
      const rg = sg.createRadialGradient(radio, radio, 0, radio, radio, radio);
      rg.addColorStop(0, 'rgba(0,0,0,1)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      sg.fillStyle = rg;
      sg.fillRect(0, 0, radio * 2, radio * 2);
      S.heat.sello = sc; S.heat.selloRadio = radio;
    }

    // 1) Acumular intensidad en escala de grises (alfa).
    let dentro = 0;
    g.globalAlpha = 0.35;
    const sello = S.heat.sello;
    pts.forEach(p => {
      const q = m.latLngToContainerPoint(p);
      if (q.x < -radio || q.y < -radio || q.x > t.x + radio || q.y > t.y + radio) return;
      dentro++;
      g.drawImage(sello, q.x - radio, q.y - radio);
    });
    g.globalAlpha = 1;
    S.heat.ultimoConteo = dentro;

    // 2) Teñir: el alfa acumulado indexa la tabla de color.
    // Con puntos prestados manda el color que pidió quien los prestó (js/68
    // tiñe cada categoría con su color de la Matriz). Sin color, la rampa
    // multicolor de "todos".
    const color = S.heat.externos
      ? (S.heat.colorExterno || null)
      : ((S.heat.grupo === 'todos') ? null : (ctx.colorGrupo[S.heat.grupo] || '#6b70e0'));
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
    // Quien prestó los puntos tiene botones encendidos en su propio panel: si
    // el calor se apaga desde el chip del mapa, esos botones quedarían
    // mintiendo. Se le avisa antes de borrar nada.
    const avisar = S.heat.alApagar;
    S.heat.externos = null; S.heat.colorExterno = null;
    S.heat.etqExterno = ''; S.heat.alApagar = null;
    if (typeof avisar === 'function') { try { avisar(); } catch(e){} }
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
    // Puntos prestados: el chip no habla de grupos de la Matriz sino de lo que
    // trajo quien los prestó, y lo dice con sus palabras. Sin esto el chip
    // diría "Todos los usos" sobre un calor que es de un solo rubro.
    if (S.heat.externos) {
      const nE = S.heat.ultimoConteo || 0;
      S.heat.chip.innerHTML =
        '<i style="background:' + (S.heat.colorExterno || '#ef4444') + '"></i>' +
        '<div><b>' + ico('calor', 14) + esc(S.heat.etqExterno || 'Mapa de calor') + '</b>' +
        '<small>' + nE + ' de ' + S.heat.externos.length + ' punto' +
        (S.heat.externos.length === 1 ? '' : 's') + ' en pantalla</small></div>' +
        '<button type="button" data-u52-call="pca-heat-off" aria-label="Quitar mapa de calor">\u2715</button>';
      return;
    }
    const g = ctx && S.heat.grupo !== 'todos' ? ctx.grupos.find(x => x.id === S.heat.grupo) : null;
    const color = S.heat.grupo === 'todos' ? '#ef4444' : ((ctx && ctx.colorGrupo[S.heat.grupo]) || '#6b70e0');
    const n = S.heat.ultimoConteo || 0;
    S.heat.chip.innerHTML =
      '<i style="background:' + color + '"></i>' +
      '<div><b>' + (g ? icoCat(g.i, 14) + esc(g.t) : ico('calor', 14) + 'Todos los usos') + '</b>' +
      '<small>' + n + ' punto' + (n === 1 ? '' : 's') + ' en pantalla' +
      (S.cerrada && S.pts.length >= 3 ? ' · dentro del área' : '') +
      ' · ' + icoCat(vistaDelMapa(ctx).ico, 12) + esc(vistaDelMapa(ctx).etq) + '</small></div>' +
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

    /* ── Lo que se contó piso por piso ────────────────────────────────
       Hasta acá este panel contaba PUNTOS: una torre de doce pisos con
       comercio abajo pesaba lo mismo que un kiosco. Desde que se mapea planta
       por planta hay con qué medir lo que de verdad ocupa el suelo —cuántas
       plantas hay sobre esta hectárea, qué se hace en ellas y cuántos
       edificios mezclan usos—, y dejarlo fuera era tirar el trabajo de campo
       justo donde el estudiante viene a leerlo. */
    const alt = (function () {
      const EDIF = window.URBIS_EDIFICIO;
      if (!EDIF || typeof EDIF.leer !== 'function') return null;
      let edificios = 0, conPisos = 0, plantas = 0, maximo = 0, mixtos = 0, sinPlantas = 0, altos = 0;
      const porUso = {};
      pc.forEach(p => {
        const uso = ctx.usoDe(p);
        const esEdif = (typeof EDIF.esCategoriaEdificio === 'function' && EDIF.esCategoriaEdificio(p.tipo)) ||
                       (String(p.tipo || '') === ctx.matrizKey &&
                        typeof EDIF.esUsoDeEdificio === 'function' && EDIF.esUsoDeEdificio(uso));
        if (!esEdif) return;
        edificios++;
        const f = EDIF.leer(p.descripcion);
        if (!f.pisosRegistrados) return;
        conPisos++; plantas += f.pisos;
        if (f.pisos > maximo) maximo = f.pisos;
        if (f.mezcla && f.mezcla.mixto) mixtos++;
        if (f.pisos >= 4) altos++;
        if (!(f.usosPorPiso || []).length) { sinPlantas++; return; }
        // Un piso con tres usos cuenta como un tercio en cada uno: el
        // edificio no crece por repartirse.
        const enPiso = EDIF.porPisoDe(f.usosPorPiso);
        Object.keys(enPiso).forEach(k => {
          const usos = enPiso[k], parte = 1 / usos.length;
          usos.forEach(u => { porUso[u] = (porUso[u] || 0) + parte; });
        });
      });
      if (!conPisos) return null;
      return { edificios, conPisos, plantas, maximo, mixtos, sinPlantas, altos,
        media: Math.round(10 * plantas / conPisos) / 10,
        porUso: Object.keys(porUso).map(u => ({ uso: u, plantas: Math.round(porUso[u] * 10) / 10 }))
          .sort((a, b) => b.plantas - a.plantas) };
    })();

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
      alturas: alt,
      // Plantas por hectárea: la edificabilidad que se ve en la calle, no la
      // que permite la norma.
      densidadPlantas: (alt && ha > 0) ? Math.round((alt.plantas / ha) * 10) / 10 : 0,
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
      '<i></i><span>' + icoCat(ico, 13) + esc(txt) + '</span></button>';
    return '<div class="pca-heat-sel">' +
      h4('calor', 'Mapa de calor', 'pca-h-heat') +
      '<p class="pca-heat-ayuda">Muestra dónde se concentra lo mapeado. Elige una categoría y el panel se cierra para que lo veas sobre el mapa.</p>' +
      '<div class="pca-heat-chips">' +
        chip('todos', '🔥', 'Todos los usos', '#ef4444') +
        ctx.grupos.map(g => chip(g.id, g.i, g.t, ctx.colorGrupo[g.id])).join('') +
      '</div>' +
      (act ? '<button type="button" class="pca-heat-off" data-u52-call="pca-heat-off">' + ico('apagar', 16) + 'Quitar el mapa de calor</button>' : '') +
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

  /* Miniatura de mapa para una lista. Dibuja la forma REAL guardada —el
     polígono con sus vértices, o el círculo de un radio— sobre un suelo con
     rejilla tenue, con la flecha del norte y una barra de escala redonda
     (100 m, 200 m, 500 m…). Es un SVG y no una foto del mapa a propósito: se
     ve sin red, pesa nada, y no depende de que las teselas carguen. La forma
     es la que importa para reconocer un área de un vistazo; la foto de fondo
     se ve al abrirla.

     `forma` = { pts:[{lat,lng}] }  o  { centro:{lat,lng}, radioM }.
     `o.w/o.h` en px del viewBox (por defecto 120×84). */
  function miniaturaMapa(forma, o){
    o = o || {};
    const W = o.w || 120, H = o.h || 84, PAD = 10;
    const pts = forma && forma.pts && forma.pts.length >= 3 ? forma.pts : null;
    const circ = !pts && forma && forma.centro && forma.radioM ? forma : null;
    if (!pts && !circ) return '';

    // Caja en grados, corrigiendo la longitud por la latitud para que un
    // cuadrado se vea cuadrado y no aplastado.
    let latC, lngC, halfLat, halfLng;
    if (pts) {
      const lats = pts.map(p => +p.lat), lngs = pts.map(p => +p.lng);
      const s = Math.min(...lats), n = Math.max(...lats), w = Math.min(...lngs), e = Math.max(...lngs);
      latC = (s + n) / 2; lngC = (w + e) / 2;
      halfLat = Math.max((n - s) / 2, 1e-6); halfLng = Math.max((e - w) / 2, 1e-6);
    } else {
      latC = +circ.centro.lat; lngC = +circ.centro.lng;
      halfLat = circ.radioM / 111320;
      halfLng = halfLat / Math.max(1e-6, Math.cos(latC * Math.PI / 180));
    }
    const kx = Math.cos(latC * Math.PI / 180);           // grados de lng → "grados de lat"
    const anchoDeg = halfLng * 2 * kx, altoDeg = halfLat * 2;
    const esc = Math.min((W - 2 * PAD) / anchoDeg, (H - 2 * PAD) / altoDeg);
    const X = lng => W / 2 + (lng - lngC) * kx * esc;
    const Y = lat => H / 2 - (lat - latC) * esc;

    // Rejilla tenue cada 12 px: da la sensación de plano sin competir.
    let rejilla = '';
    for (let x = 12; x < W; x += 12) rejilla += 'M' + x + ' 0V' + H;
    for (let y = 12; y < H; y += 12) rejilla += 'M0 ' + y + 'H' + W;

    /* Lo que hay DENTRO del área, cuando se pide: las huellas de los
       edificios primero —son el fondo construido— y encima los usos. Sin
       esto la figura es solo un contorno; con esto es un plano. */
    let dentro = '';
    /* La foto o el ráster clasificado, si se pide: van al fondo del todo,
       porque son el suelo sobre el que está el resto. Se coloca por sus
       límites geográficos —el mismo rectángulo con el que se pinta en el
       mapa— así que cae exactamente donde corresponde y no «más o menos». */
    if (o.imagen && o.imagen.url && o.imagen.limites) {
      const L2 = o.imagen.limites;
      const s2 = +L2[0][0], w2 = +L2[0][1], n2 = +L2[1][0], e2 = +L2[1][1];
      const x1 = X(w2), x2 = X(e2), y1 = Y(n2), y2 = Y(s2);
      dentro += '<image href="' + o.imagen.url + '" x="' + Math.min(x1, x2).toFixed(1) +
        '" y="' + Math.min(y1, y2).toFixed(1) + '" width="' + Math.abs(x2 - x1).toFixed(1) +
        '" height="' + Math.abs(y2 - y1).toFixed(1) + '" opacity="' +
        (o.imagen.opacidad != null ? o.imagen.opacidad : 1) + '" preserveAspectRatio="none"/>';
    }
    /* Polígonos sueltos —manzanas por estrato, sombras de los vecinos—: cada
       uno con su color, porque cada capa tiene el suyo y en una lámina el
       color ES la leyenda. */
    if (Array.isArray(o.poligonos) && o.poligonos.length) {
      dentro += '<g>' + o.poligonos.map(pol => {
        const anillo = pol && pol.pts;
        if (!Array.isArray(anillo) || anillo.length < 3) return '';
        const d = anillo.map((p, i) => (i ? 'L' : 'M') + X(+p.lng).toFixed(1) + ' ' + Y(+p.lat).toFixed(1)).join(' ') + ' Z';
        return '<path d="' + d + '" fill="' + (pol.relleno || '#94a3b8') + '" fill-opacity="' +
          (pol.opacidad != null ? pol.opacidad : 0.55) + '" stroke="' + (pol.borde || 'none') +
          '" stroke-width="' + (pol.ancho || 0.5) + '"/>';
      }).join('') + '</g>';
    }
    /* Líneas sueltas: los tramos que se alcanzan caminando, por ejemplo. */
    if (Array.isArray(o.lineas) && o.lineas.length) {
      dentro += '<g fill="none" stroke-linecap="round">' + o.lineas.map(ln => {
        const pts2 = ln && ln.pts;
        if (!Array.isArray(pts2) || pts2.length < 2) return '';
        const d = pts2.map((p, i) => (i ? 'L' : 'M') + X(+p.lng).toFixed(1) + ' ' + Y(+p.lat).toFixed(1)).join(' ');
        return '<path d="' + d + '" stroke="' + (ln.color || '#0A6F9E') + '" stroke-width="' +
          (ln.ancho || 1.2) + '" stroke-opacity="' + (ln.opacidad != null ? ln.opacidad : 0.9) + '"/>';
      }).join('') + '</g>';
    }
    /* Mancha de calor: cada punto es un disco translúcido y grande. Donde hay
       varios cerca, la superposición oscurece sola —que es exactamente lo que
       hace un mapa de calor— sin necesitar filtros, que en una hoja impresa no
       siempre sobreviven. */
    if (Array.isArray(o.calor) && o.calor.length) {
      const rc = o.calorRadio || 7;
      dentro += '<g fill="' + (o.calorColor || '#e5484d') + '" fill-opacity=".18">' +
        o.calor.map(p => {
          if (p.lat == null || p.lng == null) return '';
          return '<circle cx="' + X(+p.lng).toFixed(1) + '" cy="' + Y(+p.lat).toFixed(1) +
            '" r="' + rc + '"/>';
        }).join('') + '</g>';
    }
    /* Las curvas de nivel van DEBAJO de todo lo demás: son el terreno sobre el
       que está puesto el resto. Marrón claro, y las de cota redonda un poco
       más gruesas, como en cualquier plancha de topografía. */
    if (o.curvas && Array.isArray(o.curvas.curvas) && o.curvas.curvas.length) {
      const paso = o.curvas.intervalo || 1;
      dentro += '<g fill="none">' + o.curvas.curvas.map(c => {
        const maestra = (c.z % (paso * 5)) === 0;
        return (c.lineas || []).map(linea => {
          if (!linea || linea.length < 2) return '';
          const d = linea.map((p, i) => (i ? 'L' : 'M') + X(+p.lng).toFixed(1) + ' ' + Y(+p.lat).toFixed(1)).join(' ');
          return '<path d="' + d + '" stroke="' + (maestra ? '#8A5A20' : '#B08050') +
            '" stroke-width="' + (maestra ? 0.9 : 0.5) + '" stroke-opacity="' +
            (maestra ? 0.85 : 0.6) + '"/>';
        }).join('');
      }).join('') + '</g>';
    }
    if (Array.isArray(o.huellas) && o.huellas.length) {
      dentro += '<g>' + o.huellas.map(anillo => {
        if (!anillo || anillo.length < 3) return '';
        const d = anillo.map((p, i) => (i ? 'L' : 'M') + X(+p.lng).toFixed(1) + ' ' + Y(+p.lat).toFixed(1)).join(' ') + ' Z';
        return '<path d="' + d + '" fill="#3B4A5A" fill-opacity=".78" stroke="#0F1F2E" stroke-width=".3"/>';
      }).join('') + '</g>';
    }
    if (Array.isArray(o.puntos) && o.puntos.length) {
      const r = o.radioPunto || 1.9;
      dentro += '<g>' + o.puntos.map(p => {
        if (p.lat == null || p.lng == null) return '';
        return '<circle cx="' + X(+p.lng).toFixed(1) + '" cy="' + Y(+p.lat).toFixed(1) +
          '" r="' + r + '" fill="' + (p.color || '#94a3b8') + '" stroke="#12202e" stroke-width=".35"/>';
      }).join('') + '</g>';
    }
    /* Lo que el curso encontró y no estaba en el mapa. Va en rombo y no en
       círculo: en una lámina impresa en blanco y negro el color no distingue
       nada, y la forma sí. Es la única capa del plano que no viene de una
       fuente ajena, así que tiene que poder señalarse con el dedo. */
    if (Array.isArray(o.destacados) && o.destacados.length) {
      const r = (o.radioPunto || 1.9) * 1.5;
      dentro += '<g>' + o.destacados.map(p => {
        if (p.lat == null || p.lng == null) return '';
        const x = X(+p.lng), y = Y(+p.lat);
        const d = 'M' + x.toFixed(1) + ' ' + (y - r).toFixed(1) +
                  'L' + (x + r).toFixed(1) + ' ' + y.toFixed(1) +
                  'L' + x.toFixed(1) + ' ' + (y + r).toFixed(1) +
                  'L' + (x - r).toFixed(1) + ' ' + y.toFixed(1) + 'Z';
        return '<path d="' + d + '" fill="' + (p.color || '#34CCFE') +
          '" stroke="#0F1F2E" stroke-width=".6"/>';
      }).join('') + '</g>';
    }

    /* Puntos CON NOMBRE: los hitos y nodos del sector, numerados, y los
       parques con nombre. Se pidió «un mapeo exclusivo de hitos y nodos con
       los nombres», y con razón: un hito sin nombre en el plano es un punto
       más, y el número solo sirve si la lista de al lado lo repite. El rótulo
       lleva un halo blanco para leerse sobre la foto o sobre las huellas. */
    let rotulos = '';
    if (Array.isArray(o.rotulos) && o.rotulos.length) {
      const fz = o.rotuloTam || 5.2;
      rotulos = '<g font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif">' +
        o.rotulos.map(rt => {
          if (!rt || rt.lat == null || rt.lng == null) return '';
          const x = X(+rt.lng), y = Y(+rt.lat);
          const col = rt.color || '#0A6F9E';
          const txt = String(rt.texto || '').replace(/[<&>]/g, '').slice(0, 26);
          const num = rt.n != null ? String(rt.n) : '';
          return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (num ? 4.2 : 2.6) +
              '" fill="' + col + '" stroke="#fff" stroke-width="1"/>' +
            (num ? '<text x="' + x.toFixed(1) + '" y="' + (y + 1.9).toFixed(1) + '" text-anchor="middle" ' +
              'font-size="5" font-weight="800" fill="#fff">' + num + '</text>' : '') +
            (txt ? '<text x="' + (x + (num ? 6 : 4.2)).toFixed(1) + '" y="' + (y + 1.9).toFixed(1) +
              '" font-size="' + fz + '" font-weight="700" fill="#12202e" stroke="#fff" stroke-width="2.4" ' +
              'paint-order="stroke" stroke-linejoin="round">' + txt + '</text>' : '');
        }).join('') + '</g>';
    }

    /* Por dónde se cortó el terreno. Va casi arriba del todo —solo el lote y
       el contorno le pasan por encima— porque la línea del corte es una
       REFERENCIA: dice dónde mirar, y una referencia tapada no sirve.

       Dos trazos, igual que sobre el mapa: uno blanco grueso debajo para que
       la línea se lea sobre la foto satelital o sobre un manojo de curvas de
       nivel, que es donde peor se ven las líneas finas. Y la letra en cada
       punta, dentro de un disco, porque es lo que permite decir «el corte
       A–A′» en el texto y que alguien lo encuentre en el plano. */
    let cortes = '';
    if (Array.isArray(o.cortes) && o.cortes.length) {
      const trazos = [], letras = [];
      o.cortes.forEach(c => {
        const t = c && c.traza;
        if (!Array.isArray(t) || t.length < 2) return;
        const d = t.map((p, i) => (i ? 'L' : 'M') + X(+p.lng).toFixed(1) + ' ' + Y(+p.lat).toFixed(1)).join(' ');
        trazos.push('<path d="' + d + '" stroke="#fff" stroke-width="2.6" stroke-opacity=".9" ' +
          'stroke-dasharray="5 3.5"/>' +
          '<path d="' + d + '" stroke="#12202e" stroke-width="1.1" stroke-dasharray="5 3.5"/>');
        [[t[0], c.marca || 'A'], [t[t.length - 1], c.marcaFin || 'A′']].forEach(par => {
          const x = X(+par[0].lng), y = Y(+par[0].lat);
          letras.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) +
            '" r="3.6" fill="#fff" stroke="#12202e" stroke-width=".7"/>' +
            '<text x="' + x.toFixed(1) + '" y="' + (y + 1.7).toFixed(1) + '" text-anchor="middle" ' +
            'font-size="4.4" font-weight="700" fill="#12202e" ' +
            'font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif">' +
            String(par[1]).replace(/[<&>]/g, '') + '</text>');
        });
      });
      if (trazos.length) {
        cortes = '<g fill="none" stroke-linecap="round">' + trazos.join('') + '</g>' +
                 '<g>' + letras.join('') + '</g>';
      }
    }

    /* El LOTE, si lo hay: el polígono chico que se va a intervenir. Va encima
       de todo y en amarillo, que es su color en el mapa. Es lo único del plano
       que no es un dato traído: es la decisión de quien lo dibujó. */
    let lote = '';
    if (Array.isArray(o.lote) && o.lote.length >= 3) {
      const d = o.lote.map((p, i) => (i ? 'L' : 'M') + X(+p.lng).toFixed(1) + ' ' + Y(+p.lat).toFixed(1)).join(' ') + ' Z';
      lote = '<path d="' + d + '" fill="#FFD54F" fill-opacity=".45" stroke="#7A5901" ' +
             'stroke-width="2" stroke-linejoin="round"/>';
    }

    // La forma.
    let figura = '';
    if (pts) {
      const d = pts.map((p, i) => (i ? 'L' : 'M') + X(+p.lng).toFixed(1) + ' ' + Y(+p.lat).toFixed(1)).join(' ') + ' Z';
      // Con contenido dentro, el relleno del contorno se quita: taparía las
      // huellas y los usos que se acaban de dibujar.
      const relleno = (o.huellas && o.huellas.length) || (o.puntos && o.puntos.length) ||
                      (o.curvas && o.curvas.curvas && o.curvas.curvas.length) ||
                      (o.destacados && o.destacados.length) ||
                      (o.imagen && o.imagen.url) || (o.poligonos && o.poligonos.length) ||
                      (o.calor && o.calor.length) || (o.lineas && o.lineas.length)
        ? 'none' : 'rgba(52,204,254,.22)';
      figura = '<path d="' + d + '" fill="' + relleno + '" stroke="#0A6F9E" stroke-width="1.6" stroke-linejoin="round"/>';
      if (pts.length <= 24) {
        figura += pts.map(p => '<circle cx="' + X(+p.lng).toFixed(1) + '" cy="' + Y(+p.lat).toFixed(1) +
          '" r="1.6" fill="#0A6F9E"/>').join('');
      }
    } else {
      const r = (circ.radioM / 111320) * esc;
      // Igual que con el polígono: si adentro hay algo dibujado, el relleno
      // se quita. Un velo celeste encima de los puntos les cambia el color y
      // deja de coincidir con las convenciones.
      const rellenoC = (o.huellas && o.huellas.length) || (o.puntos && o.puntos.length) ||
                       (o.curvas && o.curvas.curvas && o.curvas.curvas.length) ||
                       (o.destacados && o.destacados.length) ||
                       (o.imagen && o.imagen.url) || (o.poligonos && o.poligonos.length) ||
                       (o.calor && o.calor.length) || (o.lineas && o.lineas.length)
        ? 'none' : 'rgba(52,204,254,.22)';
      figura = '<circle cx="' + (W / 2) + '" cy="' + (H / 2) + '" r="' + r.toFixed(1) +
        '" fill="' + rellenoC + '" stroke="#0A6F9E" stroke-width="1.6"/>' +
        '<circle cx="' + (W / 2) + '" cy="' + (H / 2) + '" r="1.8" fill="#0A6F9E"/>';
    }

    // Escala: metros por píxel → una barra de longitud "redonda".
    const mPorPx = (1 / esc) * 111320;
    const candidatos = [50, 100, 200, 250, 500, 1000, 2000, 5000];
    let metros = candidatos[0];
    for (const c of candidatos) { if (c / mPorPx <= (W - 2 * PAD) * .45) metros = c; }
    const largo = metros / mPorPx;
    const etq = metros >= 1000 ? (metros / 1000) + ' km' : metros + ' m';
    const escala = largo >= 14
      ? '<path d="M' + PAD + ' ' + (H - 7) + 'h' + largo.toFixed(1) + '" stroke="#3B4A5A" stroke-width="1.4"/>' +
        '<path d="M' + PAD + ' ' + (H - 10) + 'v6M' + (PAD + largo).toFixed(1) + ' ' + (H - 10) + 'v6" stroke="#3B4A5A" stroke-width="1.2"/>' +
        '<text x="' + (PAD + largo / 2).toFixed(1) + '" y="' + (H - 10) + '" font-size="6.5" text-anchor="middle" ' +
        'fill="#3B4A5A" font-family="Inter,system-ui,sans-serif" font-weight="600">' + etq + '</text>'
      : '';

    // Norte, arriba a la derecha.
    const nx = W - 11, ny = 8;
    const norte = '<path d="M' + nx + ' ' + (ny - 5) + 'l2.6 7-2.6-1.6-2.6 1.6z" fill="#0A6F9E"/>' +
      '<text x="' + nx + '" y="' + (ny + 11) + '" font-size="6" text-anchor="middle" fill="#0A6F9E" ' +
      'font-family="Inter,system-ui,sans-serif" font-weight="700">N</text>';

    return '<svg class="pca-minimapa' + (o.clase ? ' ' + o.clase : '') + '" viewBox="0 0 ' + W + ' ' + H + '" ' +
      'role="img" aria-label="' + (o.etiqueta || 'Forma del área') + '">' +
      '<rect width="' + W + '" height="' + H + '" rx="8" fill="#F3F8FB"/>' +
      '<path d="' + rejilla + '" stroke="#E1EAF1" stroke-width="1"/>' +
      dentro + figura + cortes + lote + rotulos + escala + norte + '</svg>';
  }

  // Cuánto hace: para la fecha de una tarjeta, en palabras.
  function haceCuanto(iso){
    const t = new Date(iso).getTime();
    if (!isFinite(t)) return '';
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 2) return 'ahora mismo';
    if (m < 60) return 'hace ' + m + ' min';
    const h = Math.round(m / 60);
    if (h < 24) return 'hace ' + h + ' h';
    const d = Math.round(h / 24);
    if (d === 1) return 'ayer';
    if (d < 30) return 'hace ' + d + ' días';
    return new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Icono lineal (js/71) o nada; y el título de sección compuesto igual que
  // en la hoja de reconocimiento, para que el panel y la hoja sean una cosa.
  function ico(n, t){ return window.URBIS_ICONO ? window.URBIS_ICONO(n, { tam: t || 18 }) : ''; }
  // Icono lineal para un emoji del catálogo o de la vista del mapa.
  function icoCat(emoji, t){
    const I = window.URBIS_ICONO;
    return I && I.deEmoji ? '<i class="pca-cat-ico">' + I.deEmoji(emoji, { tam: t || 14 }) + '</i>' : '';
  }
  function h4(icono, titulo, extra){
    return '<h4 class="pca-h' + (extra ? ' ' + extra : '') + '">' +
      (icono ? '<i class="pca-h-ico">' + ico(icono, 16) + '</i>' : '') + '<span>' + titulo + '</span></h4>';
  }

  function htmlSinArea(ctx){
    const areas = leerAreas();
    const guardadas = areas.length ? (
      '<div class="pca-guardadas">' +
        '<div class="pca-sec"><span class="pca-sec-eyebrow">Tus áreas</span>' +
          '<b>Áreas guardadas</b><small>Tocá una para volver a cargarla en el mapa.</small></div>' +
        areas.map(a =>
          '<div class="pca-guardada pca-card-area">' +
            '<button type="button" class="pca-guardada-abrir" data-u52-call="pca-cargar" data-id="' + esc(a.id) + '">' +
              miniaturaMapa({ pts: a.pts }, { etiqueta: 'Forma del área ' + a.nombre }) +
              '<div class="pca-guardada-txt">' +
                '<b>' + esc(a.nombre) + '</b>' +
                '<span class="pca-guardada-dato">' + fmtArea(a.areaM2 || 0) + '</span>' +
                '<small>' + a.pts.length + ' vértices · ' + esc(haceCuanto(a.fecha)) + '</small>' +
              '</div>' +
            '</button>' +
            '<button type="button" class="pca-guardada-borrar" data-u52-call="pca-borrar" data-id="' + esc(a.id) + '" aria-label="Borrar área ' + esc(a.nombre) + '">' +
              (window.URBIS_ICONO ? window.URBIS_ICONO('cerrar', { tam: 16 }) : '✕') + '</button>' +
          '</div>').join('') +
      '</div>'
    ) : '';

    return '<div class="pca-panel">' +
      '<div class="pca-intro">' +
        '<span class="pca-intro-ico">' + ico('lapiz', 22) + '</span>' +
        '<div><b>Dibuja el área que quieres analizar</b>' +
        '<small>Marca el contorno de un barrio, una manzana o un corredor y URBIS cuenta todo lo que la comunidad ya mapeó adentro — sin depender del radio de la ciudad.</small></div>' +
      '</div>' +
      '<button type="button" class="pca-btn-principal" data-u52-call="pca-dibujar">' + ico('lapiz') + 'Dibujar área en el mapa</button>' +
      // Reconocimiento (js/68): mira qué tiene OpenStreetMap ANTES de salir a
      // mapear. Es otra pregunta que la de esta pantalla —acá se cuenta lo que
      // el curso ya levantó— así que va como segundo botón y no mezclado.
      botonReconocer() +
      guardadas +
      // El calor no necesita área: sin ella cubre todo lo mapeado en la ciudad.
      (ctx && ctx.grupos && ctx.grupos.length ? bloqueHeat(ctx) : '') +
    '</div>';
  }

  /* El botón del reconocimiento (js/68). Estuvo solo en la pantalla «sin
     área», así que al dibujar un área desaparecía — justo cuando uno quiere
     analizar ESA área. Va en las dos. */
  function botonReconocer(){
    if (!window.URBIS_PC_RECON) return '';
    const conArea = S.cerrada && S.pts.length >= 3;
    return '<button type="button" class="pca-btn-principal pca-btn-recon" data-u52-call="pca-reconocer">' +
      ico('lupa') + (conArea ? '¿Qué hay dentro de esta área?' : '¿Qué hay en este sector?') +
      '</button>';
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
          '<button type="button" data-u52-call="pca-guardar" aria-label="Guardar área">' + ico('guardar', 18) + '</button>' +
          '<button type="button" data-u52-call="pca-dibujar" aria-label="Dibujar otra">' + ico('lapiz', 18) + '</button>' +
          '<button type="button" data-u52-call="pca-limpiar" aria-label="Quitar área">' + ico('cerrar', 18) + '</button>' +
        '</div>' +
      '</div>' +

      '<div class="pca-kpis">' +
        kpi(r.total, 'puntos mapeados') +
        kpi(r.densidad, 'por hectárea') +
        kpi(r.mios, 'míos') +
        kpi(r.deOtros, 'de otros') +
      '</div>' +

      /* Lo contado piso por piso, cuando lo hay. Va pegado a las cifras del
         área porque responde la misma pregunta —cuánto hay acá— pero en la
         única unidad que distingue una torre de una casa. */
      (r.alturas
        ? h4('crecer', 'Lo que se contó piso por piso') +
          '<div class="pca-kpis">' +
            kpi(r.alturas.plantas, 'plantas contadas') +
            kpi(r.densidadPlantas, 'plantas por hectárea') +
            kpi(String(r.alturas.media).replace('.', ','), 'pisos de media') +
            kpi(r.alturas.mixtos, 'de uso mixto') +
          '</div>' +
          (r.alturas.porUso.length
            ? '<table class="pca-tabla"><tr><th>Qué hay en las plantas</th><th>Plantas</th></tr>' +
              r.alturas.porUso.map(x =>
                '<tr><td>' + esc(x.uso) + '</td><td class="n">' +
                String(x.plantas).replace('.', ',') + '</td></tr>').join('') +
              '</table>'
            : '') +
          '<p class="pca-nota">' + r.alturas.conPisos + ' de ' + r.alturas.edificios +
            ' edificios mapeados traen sus pisos' +
            (r.alturas.sinPlantas
              ? '; a ' + r.alturas.sinPlantas + ' le' + (r.alturas.sinPlantas === 1 ? '' : 's') +
                ' falta decir qué hay en cada planta'
              : '') +
            '. Un piso con varios usos se reparte entre ellos, así que la suma de arriba ' +
            'es el número de plantas y no se infla al mezclar.</p>'
        : '') +

      // Con el área ya dibujada, esto responde la otra pregunta: no «qué
      // mapeamos» sino «qué hay ahí según OpenStreetMap».
      botonReconocer() +

      (r.total === 0
        ? '<div class="pca-vacio">Dentro de esta área todavía no hay nada mapeado en Pro City. Mapea elementos aquí y vuelve a abrir el análisis.</div>'
        : h4('capas', 'Composición por Matriz de Usos') +
          (r.totalMatriz
            ? '<div class="pca-chart-wrap"><canvas id="pca-chart-grupos" height="200"></canvas></div>' + barras
            : '<div class="pca-vacio">En esta área no hay elementos de la Matriz de Usos todavía.</div>') +

          h4('estadistica', 'Reparto por dimensión de Pro City') +
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

      // El diagnóstico va DESPUÉS de la cobertura: si el estudiante acaba de
      // analizarla, la lectura ambiental ya entra en las conclusiones. Y antes
      // de exportar, porque lo que se lleva al PDF es justamente esto.
      (r.total > 0 ? bloqueDiagnostico(ctx) : '') +

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
      h4('imprimir', 'Informe del área', 'pca-h-pdf') +
      '<p class="pca-exportar-ayuda">Una hoja con el mapa, las cifras y las gráficas de esta área, lista para imprimir o guardar como PDF.</p>' +
      '<label class="pca-exportar-estilo">Estilo' +
        '<select id="pca-estilo-pdf" data-u52-noclose>' + sel + '</select>' +
      '</label>' +
      '<button type="button" class="pca-btn-pdf" data-u52-call="pca-pdf">' + ico('documento', 16) + 'Generar el informe</button>' +
      // Pedido explícito: que al sacar el PDF salgan también los archivos
      // geográficos. Van en un botón aparte y no automáticos, porque son dos
      // descargas y el navegador pide permiso para la segunda: encadenarlas a
      // escondidas haría que la mitad de las veces no llegara nada.
      '<button type="button" class="pca-btn-pdf-todo" data-u52-call="pca-pdf-todo">' +
        ico('paquete', 16) + 'Informe y paquete geográfico</button>' +
      '<p class="pca-exportar-nota">El informe lleva de fondo la foto satelital analizada con la ' +
        'cobertura en vectores encima. El paquete trae KMZ, DXF y GeoJSON georreferenciados.</p>' +
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
  // Cuando ya se analizó la cobertura tenemos algo mejor que un mapa estático
  // pedido a la red: la PROPIA foto satelital del análisis, ya descargada, ya
  // sin velo y con un encuadre que sabemos exacto. Encima van los vectores
  // —cobertura, geometría, puntos y contorno— en SVG translúcido. Así el
  // informe muestra lo mismo que la pantalla, no una aproximación, y funciona
  // sin conexión y sin clave de API.
  /* ── Lo levantado, encima del plano del informe ───────────────────────
     El plano salía con el contorno y, si se había leído la foto, la cobertura
     y la geometría. Los puntos mapeados no salían en ninguno de los dos
     caminos: quien abría el PDF veía DÓNDE está el área y no lo que el curso
     levantó adentro, que es de lo que trata el resto de la hoja.

     Se dibuja una sola vez para los dos fondos —la foto del análisis y el
     mapa estático—, porque entre ellos lo único que cambia es de dónde sale
     la imagen y cómo se proyecta; lo que va encima es lo mismo.

     Los edificios con los pisos contados van en ROMBO y con el tono de su
     altura, igual que en la lámina del sector: en un informe fotocopiado el
     color no distingue nada y la forma sí. El borde del rombo conserva el
     color de su categoría, así que un edificio no pierde su uso por tener
     pisos. */
  const TONO_PISOS = n => n == null ? '#C9D3DC'
    : (n <= 1 ? '#BFE3F7' : n <= 2 ? '#5BB4E5' : n <= 3 ? '#0A6F9E' : '#0B3A57');
  const ETQ_PISOS = { 1:'Un piso', 2:'Dos pisos', 3:'Tres pisos', 4:'Cuatro o más' };

  function loMapeadoEnPlano(ctx, r, X, Y){
    const vacio = { svg:'', grupos:[], pisos:[] };
    if (!ctx || !r || !r.puntos || !r.puntos.length) return vacio;
    const EDIF = window.URBIS_EDIFICIO;
    const usados = {}, tonos = {};
    let circulos = '', rombos = '';
    r.puntos.forEach(p => {
      const lat = parseFloat(String(p.lat || '').replace(',', '.'));
      const lng = parseFloat(String(p.lng || '').replace(',', '.'));
      if (isNaN(lat) || isNaN(lng)) return;
      const x = X(lng), y = Y(lat);
      const g = ctx.grupos.find(gr => gr.usos.includes(ctx.usoDe(p)));
      const col = g ? (ctx.colorGrupo[g.id] || '#6b70e0') : '#94a3b8';
      if (g) usados[g.id] = true;
      let f = null;
      try { f = (EDIF && typeof EDIF.leer === 'function') ? EDIF.leer(p.descripcion) : null; }
      catch (e) { f = null; }
      if (f && f.pisosRegistrados) {
        const k = Math.min(4, Math.max(1, f.pisos));
        tonos[k] = true;
        rombos += '<path d="M' + x.toFixed(1) + ' ' + (y - 4.4).toFixed(1) +
          'l4.4 4.4-4.4 4.4-4.4-4.4z" fill="' + TONO_PISOS(f.pisos) + '" stroke="' + col +
          '" stroke-width="1.1"/>';
      } else {
        circulos += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) +
          '" r="2.6" fill="' + col + '" stroke="#fff" stroke-width=".8"/>';
      }
    });
    // Los rombos van encima: son pocos y son lo que el curso fue a contar.
    return {
      svg: circulos + rombos,
      grupos: ctx.grupos.filter(g => usados[g.id])
        .map(g => ({ t: g.t, c: ctx.colorGrupo[g.id] || '#6b70e0' })),
      pisos: [1, 2, 3, 4].filter(k => tonos[k])
        .map(k => ({ t: ETQ_PISOS[k], c: TONO_PISOS(k) }))
    };
  }

  /* La geometría generada, sobre cualquiera de los dos fondos.

     Se dibuja por lo que la forma TRAE y no por su nombre. Antes preguntaba
     por el tipo —`red` para las líneas, `hull` para el anillo—, así que la
     malla de proximidad, la triangulación y el árbol mínimo salían en pantalla
     y no en el PDF, y la envolvente cóncava tampoco: cuatro de las siete
     formas se perdían al imprimir sin que nada lo dijera. Es la misma regla
     que ya sigue el exportador: preguntar qué trae. */
  function geometriaEnPlano(g, X, Y, mPx){
    if (!g) return '';
    let d = '';
    if (g.lineas && g.lineas.length) {
      d += g.lineas.map(par => '<line x1="' + X(par[0].lng).toFixed(1) + '" y1="' +
        Y(par[0].lat).toFixed(1) + '" x2="' + X(par[1].lng).toFixed(1) + '" y2="' +
        Y(par[1].lat).toFixed(1) + '" stroke="' + g.color +
        '" stroke-width="1.6" stroke-opacity=".95"/>').join('');
    }
    if (g.anillo && g.anillo.length >= 3) {
      d += '<polygon points="' + g.anillo.map(pt => X(pt.lng).toFixed(1) + ',' +
        Y(pt.lat).toFixed(1)).join(' ') + '" fill="' + g.color +
        '" fill-opacity=".12" stroke="' + g.color + '" stroke-width="1.8"/>';
    }
    if (g.radioM) {
      const rpx = mPx(g.radioM);
      d += (g.puntos || []).map(pt => '<circle cx="' + X(pt.lng).toFixed(1) + '" cy="' +
        Y(pt.lat).toFixed(1) + '" r="' + rpx.toFixed(1) + '" fill="' + g.color +
        '" fill-opacity=".14" stroke="' + g.color + '" stroke-width="1"/>').join('');
    }
    return d + (g.puntos || []).map(pt => '<circle cx="' + X(pt.lng).toFixed(1) + '" cy="' +
      Y(pt.lat).toFixed(1) + '" r="2.2" fill="' + g.color + '"/>').join('');
  }

  // Las convenciones del plano. Sin ellas los colores del dibujo no dicen
  // nada, y un rombo azul oscuro es una mancha.
  function convencionesDelPlano(capas){
    const items = (capas.grupos || []).concat(capas.pisos || []);
    if (!items.length) return '';
    return '<div class="conv">' + items.map(x =>
      '<span><i style="background:' + x.c + '"></i>' + esc(x.t) + '</span>').join('') +
      ((capas.pisos || []).length
        ? '<span class="conv-nota">El rombo es un edificio con los pisos contados en campo.</span>'
        : '') + '</div>';
  }

  function mapaDesdeRaster(w, h, ctx, res){
    const r = S.raster;
    if (!r || !r.imagen || !r.overlayLimites) return '';
    const L = r.overlayLimites;
    const s = L[0][0], o = L[0][1], n = L[1][0], e = L[1][1];
    const alto = n - s, ancho = e - o;
    if (!(alto > 0 && ancho > 0)) return '';
    // El recuadro de la foto y el del informe rara vez tienen la misma forma:
    // se encaja la foto entera dentro y se centra, sin deformarla.
    const escala = Math.min(w / ancho, h / alto);
    const iw = ancho * escala, ih = alto * escala;
    const ox = (w - iw) / 2, oy = (h - ih) / 2;
    const X = lng => ox + (lng - o) / ancho * iw;
    const Y = lat => oy + (n - lat) / alto * ih;
    const anillo = a => a.map(pt => {
      const lng = pt.lng !== undefined ? pt.lng : pt[0];
      const lat = pt.lat !== undefined ? pt.lat : pt[1];
      return X(lng).toFixed(1) + ',' + Y(lat).toFixed(1);
    }).join(' ');

    let capas = '';
    // Cobertura vectorizada, translúcida: debajo se sigue viendo la foto, que
    // es lo que permite juzgar si la clasificación acertó.
    const EXP = window.URBIS_PC_EXPORTAR;
    if (EXP && typeof EXP.vectorizarCobertura === 'function' && r.rejilla) {
      try {
        const polis = EXP.vectorizarCobertura(r);
        capas += polis.map(function (c) {
          const huecos = (c.huecos || []).map(hh => 'M' + anillo(hh).replace(/ /g, 'L') + 'Z').join('');
          const d2 = 'M' + anillo(c.contorno).replace(/ /g, 'L') + 'Z' + huecos;
          return '<path d="' + d2 + '" fill="' + c.color + '" fill-opacity=".42" fill-rule="evenodd" ' +
                 'stroke="' + c.color + '" stroke-width=".7" stroke-opacity=".75"/>';
        }).join('');
      } catch (err) {}
    }
    // La geometría generada, con el mismo criterio de color que en pantalla,
    // y encima lo que el curso mapeó dentro del contorno.
    capas += geometriaEnPlano(geometriaActual(ctx), X, Y, m => m / 111320 * escala);
    const enc = loMapeadoEnPlano(ctx, res, X, Y);
    capas += enc.svg;

    return '<div class="mapa-wrap" style="width:' + w + 'px;height:' + h + 'px">' +
      '<img src="' + r.imagen + '" width="' + w + '" height="' + h + '" alt="" ' +
        'style="object-fit:contain;background:#0b1a24">' +
      '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '">' +
      capas +
      '<polygon points="' + anillo(S.pts) + '" fill="none" stroke="#0E86BE" stroke-width="3" ' +
      'stroke-linejoin="round"/></svg></div>' + convencionesDelPlano(enc);
  }

  function mapaDelArea(w, h, ctx, res){
    const conRaster = mapaDesdeRaster(w, h, ctx, res);
    if (conRaster) return conRaster;
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

    /* Y encima, lo mismo que lleva el plano con foto: la geometría y lo
       mapeado. Sin esto, el informe de quien no leyó la foto satelital salía
       con un plano vacío —el contorno y nada más—, que es justo el caso más
       común: leer la foto es un paso aparte y el mapeo no lo necesita. */
    const X = lng => w / 2 + (lng - cLng) * 111320 * Math.cos(cLat * Math.PI / 180) / mpp;
    const Y = lat => h / 2 - (lat - cLat) * 110540 / mpp;
    const enc = loMapeadoEnPlano(ctx, res, X, Y);

    return '<div class="mapa-wrap" style="width:' + w + 'px;height:' + h + 'px">' +
      (url ? '<img src="' + url + '" width="' + w + '" height="' + h + '" alt="">' : '<div class="mapa-vacio"></div>') +
      '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '">' +
        '<polygon points="' + puntos + '" fill="rgba(52,204,254,.22)" stroke="#0E86BE" ' +
        'stroke-width="3" stroke-linejoin="round"/>' +
        geometriaEnPlano(geometriaActual(ctx), X, Y, m => m / mpp) +
        enc.svg +
      '</svg>' +
    '</div>' + convencionesDelPlano(enc);
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

    // ── Conclusiones, FODA e implantación ────────────────────────────────
    // Lo mismo que se ve en el panel, con el mismo motor: el informe no puede
    // decir una cosa y la pantalla otra.
    let bloquesDiag = '';
    try {
      const D = window.URBIS_PC_DIAGNOSTICO;
      const dg = D && D.diagnosticar(ctx);
      if (dg) {
        bloquesDiag =
          '<div class="bloque ancho"><h2>Población y reparto de usos <em>· estimado del levantamiento</em></h2>' +
            (typeof D.htmlPoblacion === 'function' ? D.htmlPoblacion(dg) : '') + '</div>' +
          '<div class="bloque ancho"><h2>Conclusiones del área</h2>' +
            '<div class="ver-grid">' + D.htmlVeredictos(dg) + '</div></div>' +
          '<div class="bloque ancho"><h2>FODA de usos <em>· a partir de ' + dg.ind.total +
            ' elementos mapeados</em></h2>' + D.htmlFoda(dg, 4) + '</div>' +
          '<div class="bloque ancho"><h2>Propuesta de implantación</h2>' +
            D.htmlImplantacion(dg) +
            '<p class="pie-nota">Ejercicio académico. Las cantidades son una referencia de ' +
            'partida para formular el proyecto, no un dimensionamiento de diseño.</p></div>';
      }
    } catch(e) {}

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
'.bloque.ancho{margin-top:7px}',
'.pcd-cifras{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:7px}',
'.pcd-cifras>div{background:', t.suave, ';border:1px solid ', t.borde, ';border-radius:5px;padding:6px 4px;text-align:center}',
'.pcd-cifras b{display:block;font-size:13px;font-weight:800;color:', t.acento, ';line-height:1.1}',
'.pcd-cifras small{display:block;font-size:7px;color:', t.txt3, ';line-height:1.2;margin-top:2px}',
'.pcd-barra{display:flex;height:13px;border-radius:7px;overflow:hidden;border:1px solid ', t.borde, '}',
'.pcd-barra i{display:block}',
'.pcd-leyenda{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:5px}',
'.pcd-leyenda span{font-size:7.5px;color:', t.txt2, ';display:flex;align-items:center;gap:3px}',
'.pcd-leyenda i{width:7px;height:7px;border-radius:2px;display:block}',
'.pcd-tabla-viv{margin-top:6px}',
'.pcd-nota{font-size:7.5px;line-height:1.45;color:', t.txt3, ';margin-top:5px}',
'.ver-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
'.pcd-ver{border-left:3px solid ', t.borde, ';background:', t.suave, ';border-radius:5px;padding:6px 8px;break-inside:avoid}',
'.pcd-ver-cab{display:flex;align-items:baseline;gap:6px;margin-bottom:2px}',
'.pcd-ver-cab b{font-size:9.5px;font-weight:800;color:', t.tinta, '}',
'.pcd-ver-cab span{margin-left:auto;font-size:8.5px;font-weight:800;color:', t.txt3, '}',
'.pcd-ver p{font-size:8.5px;line-height:1.45;color:', t.txt2, '}',
'.pcd-bien{border-left-color:#1f9d55}', '.pcd-medio{border-left-color:#d99a12}', '.pcd-mal{border-left-color:#c0392b}',
'.pcd-foda-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}',
'.pcd-foda{border:1px solid ', t.borde, ';border-radius:5px;padding:6px 7px;break-inside:avoid}',
'.pcd-foda h5{font-size:8.5px;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;color:', t.acento, '}',
'.pcd-foda ul{list-style:none}',
'.pcd-foda li{font-size:8px;line-height:1.4;color:', t.txt2, ';padding-left:7px;position:relative;margin-bottom:3px}',
'.pcd-foda li:before{content:"·";position:absolute;left:0;font-weight:800;color:', t.oro, '}',
'.pcd-foda-f{background:#f2fbf5}', '.pcd-foda-d{background:#fff8ef}',
'.pcd-foda-o{background:#f1f8ff}', '.pcd-foda-r{background:#fff4f4}',
'.pcd-resumen{font-size:8.5px;line-height:1.5;color:', t.txt2, ';margin-bottom:6px}',
'.pcd-tabla{width:100%;border-collapse:collapse;font-size:8px}',
'.pcd-tabla th{text-align:left;font-size:7.5px;text-transform:uppercase;letter-spacing:.3px;color:', t.txt3, ';',
'padding:4px 5px;border-bottom:1px solid ', t.borde, '}',
'.pcd-tabla td{padding:4px 5px;border-bottom:1px solid ', t.linea, ';color:', t.txt2, ';vertical-align:top;line-height:1.4}',
'.pcd-tabla td.n{text-align:center;font-weight:800;color:', t.acento, '}',
'.pcd-tabla td b{color:', t.tinta, '}',
'.pcd-vacio{font-size:8.5px;line-height:1.5;color:', t.txt2, '}',
'.pie-nota{font-size:7.5px;line-height:1.4;color:', t.txt3, ';margin-top:5px;font-style:italic}',
'.mapa-wrap{position:relative;border-radius:6px;overflow:hidden;background:#dde3e8;max-width:100%}',
'.mapa-wrap img{display:block;width:100%;height:auto}',
'.mapa-wrap svg{position:absolute;left:0;top:0;width:100%;height:100%}',
'.mapa-vacio{width:100%;height:100%;background:repeating-linear-gradient(45deg,#e8edf1,#e8edf1 8px,#dfe6ec 8px,#dfe6ec 16px)}',
'.conv{display:flex;flex-wrap:wrap;gap:3px 9px;margin-top:5px}',
'.conv span{font-size:7.5px;color:', t.txt2, ';display:flex;align-items:center;gap:3px;line-height:1.3}',
'.conv i{width:7px;height:7px;border-radius:2px;display:block;flex:0 0 auto}',
'.conv .conv-nota{font-style:italic;color:', t.txt3, '}',
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
  '<div class="bloque"><h2>El área analizada</h2>', mapaDelArea(430, 320, ctx, r), '</div>',
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

/* Lo contado piso por piso, en el papel. Es la única cifra de esta hoja que
   no sale de contar puntos, y por eso va con su propio bloque: dice cuánto se
   construyó sobre esta hectárea, no cuántas cosas se marcaron. */
(r.alturas ? [
'<div class="fila">',
  '<div class="bloque"><h2>Lo que se contó piso por piso</h2>',
    '<div class="kpis">',
      kpi(r.alturas.plantas, 'plantas contadas'), kpi(r.densidadPlantas, 'plantas por hectárea'),
      kpi(String(r.alturas.media).replace('.', ','), 'pisos de media'), kpi(r.alturas.mixtos, 'de uso mixto'),
    '</div>',
    (r.alturas.porUso.length
      ? '<table style="margin-top:6px"><tr><th>Qué hay en las plantas</th><th>Plantas</th></tr>' +
        r.alturas.porUso.map(function (x) {
          return '<tr><td>' + esc(x.uso) + '</td><td>' + String(x.plantas).replace('.', ',') + '</td></tr>';
        }).join('') + '</table>'
      : ''),
    '<div class="datos" style="margin-top:6px">', r.alturas.conPisos, ' de ', r.alturas.edificios,
      ' edificios mapeados traen sus pisos; el más alto, ', r.alturas.maximo, '. Un piso con varios ',
      'usos se reparte entre ellos.</div>',
  '</div>',
'</div>'].join('') : ''),

/* La geometría que el estudiante generó. Va DICHA y no solo dibujada: sobre
   el plano es un trazo morado, y sin esta caja nadie sabe si une todo lo
   mapeado o solo los edificios de cuatro pisos o más, que es la diferencia
   entre dos lecturas distintas del mismo levantamiento. */
(function () {
  const g = geometriaActual(ctx);
  if (!g) return '';
  const fm = formaDe(g.tipo), P = PARAMETROS[g.tipo];
  const par = (P && S.geo.par && S.geo.par[P.clave] != null) ? P.etq(S.geo.par[P.clave]) : '';
  const n = (g.puntos || []).length;
  return '<div class="fila"><div class="bloque ancho" style="grid-column:1/-1">' +
    '<h2>Geometría del área <em>· ' + esc(fm ? fm.nom : g.tipo) + '</em></h2>' +
    '<div class="datos"><b>Tejida sobre:</b> ' + esc(g.filtro) + ', <b>' + n + '</b> punto' +
      (n === 1 ? '' : 's') + '.' + (par ? '<br><b>Ajuste:</b> ' + esc(par) + '.' : '') +
      (fm ? '<br>' + esc(fm.pregunta) : '') + '</div>' +
    '<p class="pie-nota">Es el trazo de color del plano de arriba.</p>' +
    '</div></div>';
})(),

/* La cobertura leída sobre la foto. El informe ya llevaba la foto de fondo
   con las manchas encima, pero no las cifras: se veía el verde y no cuánto
   era. Y el aviso viaja con ellas —clasificar por color no es NDVI—, porque
   una cifra suelta en un PDF se cita después sin su letra chica. */
(function () {
  const rr = S.raster;
  if (!rr || !rr.clases || !rr.clases.length) return '';
  const orden = rr.clases.slice().sort((a, b) => b.pct - a.pct);
  return '<div class="fila"><div class="bloque ancho" style="grid-column:1/-1">' +
    '<h2>Cobertura del suelo <em>· leída sobre la foto satelital</em></h2>' +
    '<div class="pcd-barra">' + orden.filter(c => c.pct > 0).map(c =>
      '<i style="width:' + c.pct + '%;background:' + c.color + '"></i>').join('') + '</div>' +
    '<table style="margin-top:6px"><tr><th>Clase</th><th>%</th><th>Superficie</th></tr>' +
    orden.map(c => '<tr><td><i style="background:' + c.color + '"></i>' + esc(c.etq) +
      '</td><td class="n">' + c.pct + '%</td><td class="n">' + fmtArea(c.m2) + '</td></tr>').join('') +
    '</table>' +
    '<p class="pie-nota">Estimación por <b>color</b> de imagen satelital: no es NDVI ni un ' +
      'estudio ambiental certificado. El ' + rr.pctAmbiguo + '% queda en tonos cálidos, donde ' +
      'teja, concreto envejecido, suelo descubierto y matorral seco no se distinguen. ' +
      rr.pasadas + ' lecturas cruzadas, malla ' + esc(rr.malla) + ', ' +
      String(rr.mPorPx).replace('.', ',') + ' m por píxel.</p>' +
    '</div></div>';
})(),

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

bloquesDiag,

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

    const TG = window.URBIS_TEMA_GRAFICA;
    const cvG = document.getElementById('pca-chart-grupos');
    if (cvG && r.totalMatriz) {
      const filas = ctx.grupos.map(g => ({ g, n: r.porGrupo[g.id] || 0 }))
        .filter(x => x.n > 0).sort((a, b) => b.n - a.n);
      S.charts.push(new Chart(cvG, {
        type: 'bar',
        data: { labels: filas.map(x => x.g.t), datasets: [{
          data: filas.map(x => x.n),
          backgroundColor: filas.map(x => ctx.colorGrupo[x.g.id] || '#6b70e0'),
          borderRadius: 6, borderSkipped: false, barPercentage: .72, categoryPercentage: .8
        }]},
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
          plugins: { legend: { display: false }, tooltip: TG ? TG.tooltip() : {} },
          scales: TG ? TG.ejesBarras() : {
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
          responsive: true, maintainAspectRatio: false, animation: false, cutout: '62%',
          plugins: {
            legend: TG ? TG.leyenda('right')
                       : { position: 'right', labels: { color: '#2f3f4e', font: { size: 10 }, boxWidth: 10, padding: 6 } },
            tooltip: TG ? TG.tooltip() : {}
          }
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
  // Tope de polígonos que se dibujan en el mapa. Por encima de esto conviene
  // la imagen: mil formas vectoriales en un móvil arrastran el desplazamiento,
  // y a esa densidad la diferencia visual ya no se nota.
  const RASTER_VECT_MAX = 1500;

  function pintarRasterMapa(res){
    const c = capaRaster();
    if (!c || !res || !res.overlayImagen) return;
    c.clearLayers();
    const foto = S.rasterVista === 'foto' && res.imagen;
    if (foto) {
      L.imageOverlay(res.imagen, res.overlayLimites, {
        opacity: 1, interactive: false, className: 'pca-raster-overlay'
      }).addTo(c);
      S.rasterEnVectores = false;
      return;
    }

    // La cobertura se dibuja con los MISMOS polígonos que se exportan, no con
    // la imagen clasificada. Antes en pantalla se veía un mosaico de píxeles y
    // en el DXF salían vectores: la vista previa no se parecía al archivo, y
    // costaba creer que el resultado fuera editable. Ahora lo que se ve es lo
    // que se llevan, y de paso se aprecia a cualquier acercamiento.
    let polis = null;
    try {
      const EXP = window.URBIS_PC_EXPORTAR;
      if (EXP && typeof EXP.vectorizarCobertura === 'function' && res.rejilla) {
        polis = EXP.vectorizarCobertura(res);
      }
    } catch (e) { polis = null; }

    if (polis && polis.length && polis.length <= RASTER_VECT_MAX) {
      polis.forEach(function (pl) {
        // Leaflet quiere lat,lng y el vectorizador entrega lng,lat; los huecos
        // van como anillos siguientes del mismo polígono.
        const anillos = [pl.contorno.map(q => [q[1], q[0]])]
          .concat((pl.huecos || []).map(h => h.map(q => [q[1], q[0]])));
        L.polygon(anillos, {
          color: pl.color, weight: 1, opacity: .85,
          fillColor: pl.color, fillOpacity: .55,
          interactive: false, className: 'pca-raster-vector'
        }).addTo(c);
      });
      S.rasterEnVectores = true;
    } else {
      // Demasiadas formas (o no se pudo vectorizar): se cae a la imagen.
      L.imageOverlay(res.overlayImagen, res.overlayLimites, {
        opacity: .8, interactive: false, className: 'pca-raster-overlay'
      }).addTo(c);
      S.rasterEnVectores = false;
    }
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
        '<b>' + ico('satelite', 14) + 'Cobertura del suelo</b>' +
        '<span class="pca-raster-chip-barra">' +
          visibles.map(c => '<i style="width:' + c.pct + '%;background:' + c.color + '" ' +
            'title="' + esc(c.etq) + '"></i>').join('') +
        '</span>' +
        '<small>' + visibles.slice(0, 2).map(c => icoCat(c.ico, 12) + c.pct + '%').join(' · ') +
          (S.rasterVista === 'foto' ? ' · foto analizada'
                                    : (S.rasterEnVectores ? ' · vectores' : ' · imagen')) + '</small>' +
      '</div>' +
      '<button type="button" class="pca-raster-chip-foto' + (S.rasterVista === 'foto' ? ' activo' : '') + '" ' +
        'data-u52-call="pca-raster-foto" title="Comparar con la foto que se analizó" ' +
        'aria-label="Ver la foto satelital analizada">' + (S.rasterVista === 'foto' ? ico('paleta', 16) : ico('satelite', 16)) + '</button>' +
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
      /* Dos filtros que no son categorías sino ALTURA: tejer la red solo
         entre lo alto contesta «¿la ciudad alta está junta o dispersa?», y
         entre lo mixto, «¿la mezcla de usos se agrupa en un eje?». Las dos
         preguntas nacieron del mapeo piso por piso y antes no se podían
         hacer: el generador solo miraba dónde estaba cada punto. */
      if (filtro === 'pisos-altos' || filtro === 'pisos-mixtos') {
        const EDIF = window.URBIS_EDIFICIO;
        if (!EDIF || typeof EDIF.leer !== 'function') return acc;
        const fi = EDIF.leer(p.descripcion);
        if (!fi.pisosRegistrados) return acc;
        if (filtro === 'pisos-altos' && fi.pisos < 4) return acc;
        if (filtro === 'pisos-mixtos' && !(fi.mezcla && fi.mezcla.mixto)) return acc;
      } else if (filtro !== 'todos') {
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

  // Catálogo de formas. Cada una responde una pregunta distinta sobre los
  // mismos puntos, y esa pregunta se muestra en pantalla: sin ella, elegir
  // entre siete botones sería adivinar.
  const FORMAS = [
    { id:'red',       ico:'🕸️', nom:'Red de vecinos',      color:'#ff1f3d',
      pregunta:'¿Quién está cerca de quién?' },
    { id:'malla',     ico:'🪢', nom:'Telaraña',            color:'#a855f7',
      pregunta:'Todos con todos los que tengan cerca: qué tan tupido es el tejido.' },
    { id:'delaunay',  ico:'📐', nom:'Malla triangular',    color:'#0ea5e9',
      pregunta:'La retícula que reparte el territorio entre los puntos.' },
    { id:'mst',       ico:'🌿', nom:'Recorrido mínimo',    color:'#16a34a',
      pregunta:'El trazado más corto que los toca todos.' },
    { id:'concava',   ico:'🫧', nom:'Envolvente cóncava',  color:'#f97316',
      pregunta:'La forma real de la mancha, con sus entrantes.' },
    { id:'hull',      ico:'⬡',  nom:'Envolvente convexa',  color:'#FABD0A',
      pregunta:'Cuánto terreno abarca todo lo mapeado.' },
    { id:'circulos',  ico:'⭕', nom:'Radios de impacto',   color:'#ef4444',
      pregunta:'Hasta dónde llega la influencia de cada punto.' }
  ];
  const formaDe = id => FORMAS.find(f => f.id === id) || null;

  function nombreGeo(tipo){
    const f = formaDe(tipo);
    return f ? icoCat(f.ico, 14) + f.nom : '';
  }
  function colorGeo(tipo){
    const f = formaDe(tipo);
    return f ? f.color : '#a855f7';
  }
  // Qué parámetro admite cada forma, con su rango. De aquí sale tanto el texto
  // que se muestra como el sorteo del botón de variación.
  const PARAMETROS = {
    red:      { clave:'k',       min:1,  max:5,   paso:1,  etq: v => v + ' vecino' + (v === 1 ? '' : 's') + ' por punto' },
    malla:    { clave:'radio',   min:25, max:180, paso:5,  etq: v => 'une lo que esté a menos de ' + v + ' m' },
    concava:  { clave:'alpha',   min:40, max:260, paso:10, etq: v => 'detalle del contorno: ' + v + ' m' },
    circulos: { clave:'impacto', min:15, max:120, paso:5,  etq: v => 'radio de ' + v + ' m' }
  };
  function nombreFiltroGeo(ctx){
    const f = S.geo.grupo || 'todos';
    if (f === 'todos') return 'todo lo mapeado';
    if (f === 'pisos-altos') return 'lo de cuatro pisos o más';
    if (f === 'pisos-mixtos') return 'los edificios de uso mixto';
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

  // ══ MÁS FORMAS DE LEER LOS MISMOS PUNTOS ═════════════════════════════════
  //
  // Un conjunto de puntos no tiene UNA geometría: tiene muchas, y cada una
  // responde una pregunta distinta. La red de vecinos dice quién está cerca de
  // quién; la envolvente, cuánto terreno abarca todo; la malla, qué tan tupido
  // es el tejido; el árbol mínimo, cuál es el recorrido más corto que los toca
  // todos; la envolvente cóncava, qué forma tiene REALMENTE la mancha. Para un
  // ejercicio de proyecto, comparar varias lecturas del mismo levantamiento
  // enseña más que quedarse con una.
  //
  // Casi todas salen de una sola pieza: la triangulación de Delaunay. Se
  // calcula una vez y de ahí se derivan la malla triangular, el árbol mínimo y
  // la envolvente cóncava. Por eso no hace falta traer una librería de
  // geometría: es un algoritmo y tres lecturas suyas.

  // Los puntos pasan a metros locales antes de triangular. En grados, un grado
  // de longitud y uno de latitud no miden lo mismo y los triángulos saldrían
  // estirados — la geometría diría cosas falsas sobre quién está cerca.
  function aPlanoLocal(pts){
    const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
    const rad = Math.PI / 180;
    const mx = 6378137 * Math.cos(lat0 * rad) * rad, my = 6378137 * rad;
    return pts.map(p => ({ x: p.lng * mx, y: p.lat * my }));
  }

  // Bowyer–Watson: se parte de un supertriángulo que envuelve todo y se van
  // insertando los puntos; cada uno borra los triángulos cuyo circuncírculo lo
  // contiene y se retriangula el hueco. Al final se descartan los triángulos
  // que aún tocan el supertriángulo.
  function triangularDelaunay(P){
    const n = P.length;
    if (n < 3) return [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    P.forEach(p => { if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x; if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y; });
    const dx = maxX - minX || 1, dy = maxY - minY || 1;
    const D = Math.max(dx, dy) * 20;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    // Los tres vértices del supertriángulo van al final del arreglo.
    const V = P.concat([{ x: cx - D, y: cy - D }, { x: cx + D, y: cy - D }, { x: cx, y: cy + D }]);
    const s0 = n, s1 = n + 1, s2 = n + 2;

    const circun = function (a, b, c) {
      const A = V[a], B = V[b], C = V[c];
      const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
      if (Math.abs(d) < 1e-12) return null;
      const ux = ((A.x*A.x + A.y*A.y) * (B.y - C.y) + (B.x*B.x + B.y*B.y) * (C.y - A.y) +
                  (C.x*C.x + C.y*C.y) * (A.y - B.y)) / d;
      const uy = ((A.x*A.x + A.y*A.y) * (C.x - B.x) + (B.x*B.x + B.y*B.y) * (A.x - C.x) +
                  (C.x*C.x + C.y*C.y) * (B.x - A.x)) / d;
      return { x: ux, y: uy, r2: (A.x-ux)*(A.x-ux) + (A.y-uy)*(A.y-uy) };
    };

    let tris = [{ v:[s0, s1, s2], c: circun(s0, s1, s2) }];
    for (let i = 0; i < n; i++) {
      const p = V[i];
      const malos = [], buenos = [];
      tris.forEach(function (t) {
        if (t.c && ((p.x - t.c.x)*(p.x - t.c.x) + (p.y - t.c.y)*(p.y - t.c.y)) <= t.c.r2) malos.push(t);
        else buenos.push(t);
      });
      // Borde del hueco: las aristas que aparecen UNA sola vez entre los malos.
      const cuenta = new Map();
      malos.forEach(function (t) {
        const v = t.v;
        [[v[0],v[1]],[v[1],v[2]],[v[2],v[0]]].forEach(function (e) {
          const k = Math.min(e[0],e[1]) + ':' + Math.max(e[0],e[1]);
          cuenta.set(k, (cuenta.get(k) || 0) + 1);
        });
      });
      tris = buenos;
      cuenta.forEach(function (veces, k) {
        if (veces !== 1) return;
        const ab = k.split(':').map(Number);
        const c = circun(ab[0], ab[1], i);
        if (c) tris.push({ v:[ab[0], ab[1], i], c: c });
      });
    }
    // Fuera los que se apoyan en el supertriángulo.
    return tris.filter(t => t.v.every(v => v < n)).map(t => t.v);
  }

  const claveArista = (a, b) => (a < b ? a + ':' + b : b + ':' + a);

  function aristasDeTriangulos(tris){
    const set = new Set();
    tris.forEach(function (t) {
      set.add(claveArista(t[0], t[1]));
      set.add(claveArista(t[1], t[2]));
      set.add(claveArista(t[2], t[0]));
    });
    return [...set].map(k => k.split(':').map(Number));
  }

  // Árbol de expansión mínima sobre las aristas de Delaunay (Kruskal). Es el
  // recorrido más corto que toca todos los puntos sin cerrar ciclos: la lectura
  // de "cuál sería la red mínima que los conecta a todos".
  function arbolMinimo(P, aristas){
    const largo = (a, b) => Math.hypot(P[a].x - P[b].x, P[a].y - P[b].y);
    const orden = aristas.slice().sort((e, f) => largo(e[0],e[1]) - largo(f[0],f[1]));
    const padre = P.map((_, i) => i);
    const raiz = function (i) { while (padre[i] !== i) { padre[i] = padre[padre[i]]; i = padre[i]; } return i; };
    const out = [];
    orden.forEach(function (e) {
      const a = raiz(e[0]), b = raiz(e[1]);
      if (a === b) return;
      padre[a] = b;
      out.push(e);
    });
    return out;
  }

  // Envolvente cóncava (alpha shape): se quedan los triángulos cuyo lado más
  // largo no pasa de `alpha`, y el contorno son las aristas que solo pertenecen
  // a uno de ellos. A diferencia de la envolvente convexa, esta SÍ se mete en
  // los entrantes y da la forma real de la mancha, con su perímetro.
  function envolventeConcava(P, tris, alpha){
    const largo = (a, b) => Math.hypot(P[a].x - P[b].x, P[a].y - P[b].y);
    const cuenta = new Map();
    tris.forEach(function (t) {
      const l = Math.max(largo(t[0],t[1]), largo(t[1],t[2]), largo(t[2],t[0]));
      if (l > alpha) return;
      [[t[0],t[1]],[t[1],t[2]],[t[2],t[0]]].forEach(function (e) {
        const k = claveArista(e[0], e[1]);
        cuenta.set(k, (cuenta.get(k) || 0) + 1);
      });
    });
    const borde = [];
    cuenta.forEach(function (veces, k) { if (veces === 1) borde.push(k.split(':').map(Number)); });
    if (!borde.length) return [];
    // Se encadenan las aristas del borde en anillos cerrados.
    const porVertice = new Map();
    borde.forEach(function (e) {
      [[e[0],e[1]],[e[1],e[0]]].forEach(function (d) {
        if (!porVertice.has(d[0])) porVertice.set(d[0], []);
        porVertice.get(d[0]).push(d[1]);
      });
    });
    const usada = new Set();
    const anillos = [];
    borde.forEach(function (e) {
      if (usada.has(claveArista(e[0], e[1]))) return;
      const anillo = [e[0]];
      let actual = e[1], previo = e[0];
      usada.add(claveArista(e[0], e[1]));
      let vueltas = 0;
      while (actual !== e[0] && vueltas++ < borde.length * 3) {
        anillo.push(actual);
        const vecinos = (porVertice.get(actual) || []).filter(v => v !== previo && !usada.has(claveArista(actual, v)));
        if (!vecinos.length) break;
        usada.add(claveArista(actual, vecinos[0]));
        previo = actual; actual = vecinos[0];
      }
      if (anillo.length >= 3) anillos.push(anillo);
    });
    // Se devuelve el anillo más grande: es el perímetro de la mancha.
    anillos.sort((a, b) => b.length - a.length);
    return anillos[0] || [];
  }

  // Telaraña por proximidad: cada punto se une a TODOS los que tenga dentro del
  // radio, sin orden ni jerarquía. Es la lectura más orgánica —y la que el
  // usuario pidió— porque el tejido emerge solo de quién está junto a quién.
  function mallaProximidad(pts, radioM){
    const lineas = [];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (haversineM(pts[i], pts[j]) <= radioM) lineas.push([pts[i], pts[j]]);
      }
    }
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
    const col = colorGeo(tipo);
    const par = S.geo.par;

    const linea = (a, b, ancho, op) => L.polyline([a, b], {
      color: col, weight: ancho, opacity: op, className: 'pca-geo-linea' }).addTo(c);
    const nodo = (p, r) => L.circleMarker(p, {
      radius: r, color: col, weight: 0, fillOpacity: .95 }).addTo(c);

    // Las formas que salen de la triangulación comparten el cálculo: se hace
    // una sola vez y las tres la leen distinto.
    let plano = null, tris = null;
    const triangular = function () {
      if (tris) return;
      plano = aPlanoLocal(pts);
      tris = triangularDelaunay(plano);
    };

    if (tipo === 'red') {
      redVecinos(pts, Math.max(1, par.k)).forEach(([a, b]) => linea(a, b, 3.5, .9));
      pts.forEach(p => nodo(p, 4.5));

    } else if (tipo === 'malla') {
      // Telaraña: trazo fino y translúcido a propósito. Con radio amplio salen
      // cientos de hilos y, con el grosor de la red de vecinos, el mapa se
      // volvía una mancha sólida en vez de un tejido.
      const hilos = mallaProximidad(pts, par.radio);
      hilos.forEach(([a, b]) => linea(a, b, 1.4, .55));
      pts.forEach(p => nodo(p, 3.5));
      S.geo.ultimoDato = hilos.length + ' hilos';

    } else if (tipo === 'delaunay') {
      triangular();
      aristasDeTriangulos(tris).forEach(e => linea(pts[e[0]], pts[e[1]], 1.6, .75));
      pts.forEach(p => nodo(p, 3));
      S.geo.ultimoDato = tris.length + ' triángulos';

    } else if (tipo === 'mst') {
      triangular();
      const arbol = arbolMinimo(plano, aristasDeTriangulos(tris));
      let metros = 0;
      arbol.forEach(function (e) {
        linea(pts[e[0]], pts[e[1]], 3, .92);
        metros += haversineM(pts[e[0]], pts[e[1]]);
      });
      pts.forEach(p => nodo(p, 3.5));
      S.geo.ultimoDato = Math.round(metros) + ' m de recorrido';

    } else if (tipo === 'concava') {
      triangular();
      const anillo = envolventeConcava(plano, tris, par.alpha);
      if (anillo.length >= 3) {
        const latlngs = anillo.map(i => pts[i]);
        L.polygon(latlngs, { color: col, weight: 2.5, fillColor: col, fillOpacity: .12,
          className: 'pca-geo-hull' }).addTo(c);
        let per = 0;
        for (let i = 0; i < latlngs.length; i++) {
          per += haversineM(latlngs[i], latlngs[(i + 1) % latlngs.length]);
        }
        S.geo.ultimoDato = Math.round(per) + ' m de perímetro';
      } else {
        // Con un alpha muy corto no queda ningún triángulo y no hay contorno:
        // se dice, en vez de dejar el mapa vacío sin explicación.
        S.geo.ultimoDato = 'sube el detalle: no cierra';
      }
      pts.forEach(p => nodo(p, 3));

    } else if (tipo === 'hull') {
      const hull = envolventeConvexa(pts);
      if (hull.length >= 3) {
        L.polygon(hull, { color: col, weight: 2.5, fillColor: col, fillOpacity: .1,
          dashArray: '2 6', className: 'pca-geo-hull' }).addTo(c);
      }
      pts.forEach(p => nodo(p, 3));

    } else if (tipo === 'circulos') {
      pts.forEach(p => {
        L.circle(p, { radius: par.impacto, color: col, weight: 1,
          fillColor: col, fillOpacity: .16 }).addTo(c);
      });
      S.geo.ultimoDato = par.impacto + ' m de radio';
    }
    return pts.length;
  }

  // Puente del deslizador: repinta en vivo mientras se arrastra, sin cerrar el
  // panel, para poder ver cómo responde la forma al parámetro.
  window.urbisProCityGeoAjuste = function (valor){
    const par = PARAMETROS[S.geo.tipo];
    if (!par) return;
    S.geo.par[par.clave] = Number(valor);
    const ctx = (typeof window.urbisProCityCtxAnalisis === 'function') ? window.urbisProCityCtxAnalisis() : null;
    if (!ctx) return;
    S.geo.ultimoDato = '';
    pintarGeo(ctx);
    chipGeo(ctx);
    // Solo se refresca la etiqueta del deslizador: repintar el panel entero
    // mataría el arrastre en curso.
    try {
      const et = document.querySelector('.pca-geo-ajuste span');
      if (et) et.textContent = par.etq(S.geo.par[par.clave]);
    } catch(e){}
  };

  // ── Variación ───────────────────────────────────────────────────────────
  // Un levantamiento admite muchas composiciones y ninguna es "la" correcta.
  // Este botón sortea otra: cambia el parámetro de la forma actual y, cada
  // tantas veces, salta a otra forma. Así el ejercicio deja de ser "elegir un
  // botón" y pasa a ser comparar alternativas, que es lo que se hace al
  // proyectar.
  function variarGeo(ctx){
    const par = PARAMETROS[S.geo.tipo];
    const saltarDeForma = !par || (S.geo.variante % 3 === 2);
    if (saltarDeForma) {
      const otras = FORMAS.filter(f => f.id !== S.geo.tipo);
      S.geo.tipo = otras[Math.floor(Math.random() * otras.length)].id;
    }
    const p2 = PARAMETROS[S.geo.tipo];
    if (p2) {
      const pasos = Math.floor((p2.max - p2.min) / p2.paso) + 1;
      S.geo.par[p2.clave] = p2.min + Math.floor(Math.random() * pasos) * p2.paso;
    }
    S.geo.variante++;
    S.geo.ultimoDato = '';
    const n = pintarGeo(ctx);
    chipGeo(ctx);
    return n;
  }

  // Los mismos números con los que se dibuja la geometría, pero como DATOS,
  // Los mismos números con los que se dibuja la geometría, pero como DATOS,
  // para que la exportación saque vectores reales en vez de volver a inventarlos.
  // Comparte puntosGeo() con el pintado, así que lo exportado es exactamente lo
  // que se está viendo, filtro de vista incluido.
  const GEO_RADIO_M = 35;
  function geometriaActual(ctx){
    const tipo = S.geo.tipo;
    if (!tipo) return null;
    const c = ctx || (typeof window.urbisProCityCtxAnalisis === 'function' ? window.urbisProCityCtxAnalisis() : null);
    if (!c) return null;
    const pts = puntosGeo(c);
    const par = S.geo.par;
    const out = { tipo: tipo, nombre: nombreGeo(tipo), color: colorGeo(tipo),
                  filtro: nombreFiltroGeo(c), puntos: pts };
    // Las formas de línea entregan `lineas`; las de superficie, `anillo`; los
    // radios, `radioM`. Así el exportador no necesita saber de cada forma: le
    // basta preguntar qué trae, y una forma nueva se exporta sola.
    if (tipo === 'red') {
      out.lineas = redVecinos(pts, Math.max(1, par.k));
    } else if (tipo === 'malla') {
      out.lineas = mallaProximidad(pts, par.radio);
    } else if (tipo === 'delaunay' || tipo === 'mst') {
      const plano = aPlanoLocal(pts);
      const tris = triangularDelaunay(plano);
      const aristas = tipo === 'mst' ? arbolMinimo(plano, aristasDeTriangulos(tris))
                                     : aristasDeTriangulos(tris);
      out.lineas = aristas.map(e => [pts[e[0]], pts[e[1]]]);
    } else if (tipo === 'concava') {
      const plano = aPlanoLocal(pts);
      const anillo = envolventeConcava(plano, triangularDelaunay(plano), par.alpha);
      out.anillo = anillo.map(i => pts[i]);
    } else if (tipo === 'hull') {
      out.anillo = pts.length >= 3 ? envolventeConvexa(pts) : [];
    } else if (tipo === 'circulos') {
      out.radioM = par.impacto;
    }
    return out;
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
    const par = PARAMETROS[S.geo.tipo];
    const ajuste = par ? par.etq(S.geo.par[par.clave]) : '';
    const aviso = n < 2
      ? 'Solo ' + n + ' punto' + (n === 1 ? '' : 's') + ' en ' + icoCat(v.ico, 12) + esc(v.etq)
      : n + ' puntos · ' + (ajuste ? esc(ajuste) : esc(nombreFiltroGeo(ctx))) +
        (S.geo.ultimoDato ? ' · ' + esc(S.geo.ultimoDato) : '');
    S.geo.chip.innerHTML =
      '<i style="background:' + colorGeo(S.geo.tipo) + '"></i>' +
      '<div><b>' + nombreGeo(S.geo.tipo) + '</b><small>' + aviso + '</small></div>' +
      // El dado vive también en el chip: las variaciones se miran con el panel
      // cerrado, y volver a abrirlo para cada tirada rompía el ritmo de probar.
      '<button type="button" class="pca-geo-dado" data-u52-call="pca-geo-variar" ' +
        'aria-label="Generar otra variación">' + ico('dado', 16) + '</button>' +
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

  // Diagnóstico educativo (js/26-procity-diagnostico): conclusiones, FODA y
  // propuesta de implantación, todo derivado de lo que el estudiante mapeó.
  function bloqueDiagnostico(ctx){
    const D = window.URBIS_PC_DIAGNOSTICO;
    if (!D) return '';
    const d = D.diagnosticar(ctx);
    if (!d) return '';
    S.diag = d;
    const verImp = S.verImplantacion;
    return '<div class="pcd-sel">' +
      h4('escuela', 'Qué dice esta área', 'pca-h-diag') +
      '<p class="pcd-ayuda">Lectura del sector a partir de tus ' + d.ind.total +
        ' elementos mapeados' + (d.ind.hayCobertura ? ' y de la cobertura del suelo analizada' : '') + '.</p>' +
      '<div class="pcd-sub">Población y reparto de usos</div>' +
      (typeof D.htmlPoblacion === 'function' ? D.htmlPoblacion(d) : '') +
      '<div class="pcd-sub">Conclusiones</div>' +
      D.htmlVeredictos(d) +
      '<div class="pcd-sub">FODA de usos</div>' +
      D.htmlFoda(d, 3) +
      // La implantación va detrás de un botón: primero se lee el diagnóstico y
      // después se propone. Ese orden es el del ejercicio académico.
      '<button type="button" class="pcd-btn-imp" data-u52-call="pca-implantacion">' +
        (verImp ? '▾ Ocultar la propuesta de implantación'
                : ico('obra', 16) + 'Proponer una implantación para esta área') + '</button>' +
      (verImp ? '<div class="pcd-imp"><div class="pcd-sub">Propuesta de implantación</div>' +
                D.htmlImplantacion(d) +
                '<p class="pcd-nota">Ejercicio académico: son líneas de partida para formular un ' +
                'proyecto, no un dimensionamiento de diseño.</p></div>' : '') +
    '</div>';
  }

  function bloqueGeo(ctx){
    const act = S.geo.tipo;
    const filtro = S.geo.grupo || 'todos';
    const chip = f =>
      '<button type="button" class="pca-forma' + (act === f.id ? ' activo' : '') + '" ' +
      'data-u52-call="pca-geo" data-gid="' + esc(f.id) + '" style="--c:' + f.color + '">' +
      '<i></i><span>' + icoCat(f.ico, 14) + esc(f.nom) + '</span></button>';
    // Filtro de qué se conecta. Se muestra el conteo real de cada categoría
    // dentro del área para no ofrecer filtros que dejarían el dibujo vacío.
    const r = window.__pcaUltimo || { porGrupo: {}, total: 0 };
    const fchip = (id, ico, txt, n) =>
      '<button type="button" class="pca-geo-filtro' + (filtro === id ? ' activo' : '') + '" ' +
      'data-u52-call="pca-geo-filtro" data-gid="' + esc(id) + '">' +
      icoCat(ico, 13) + esc(txt) + '<b>' + n + '</b></button>';
    const al = r.alturas || null;
    const filtros = fchip('todos', '🌐', 'Todo lo mapeado', r.total || 0) +
      /* Lo contado piso por piso, cuando hay al menos dos: con uno solo no
         hay geometría que tejer y el chip prometería un dibujo vacío. */
      (al && al.altos >= 2 ? fchip('pisos-altos', '🏢', 'Solo lo alto (4+ pisos)', al.altos) : '') +
      (al && al.mixtos >= 2 ? fchip('pisos-mixtos', '🧩', 'Solo los mixtos', al.mixtos) : '') +
      ctx.grupos.filter(g => (r.porGrupo[g.id] || 0) > 0)
        .map(g => fchip(g.id, g.i, g.t, r.porGrupo[g.id])).join('');

    const forma = formaDe(act);
    const par = act ? PARAMETROS[act] : null;
    // Deslizador del parámetro: la variación al azar sirve para descubrir, y
    // este para afinar lo que se descubrió.
    const ajuste = par ? (
      '<label class="pca-geo-ajuste">' +
        '<span>' + esc(par.etq(S.geo.par[par.clave])) + '</span>' +
        '<input type="range" min="' + par.min + '" max="' + par.max + '" step="' + par.paso + '" ' +
          'value="' + S.geo.par[par.clave] + '" data-u52-noclose ' +
          'oninput="window.urbisProCityGeoAjuste && window.urbisProCityGeoAjuste(this.value)">' +
      '</label>') : '';

    return '<div class="pca-geo-sel">' +
      h4('area', 'Geometría del área', 'pca-h-geo') +
      '<p class="pca-geo-ayuda">Un mismo levantamiento admite muchas lecturas, y cada forma ' +
        'responde una pregunta distinta. Al elegir una, el panel se cierra para que la veas sobre el mapa.</p>' +
      '<div class="pcd-vista">' + vistaTexto(ctx) + '</div>' +
      '<div class="pca-geo-sub">¿Qué puntos conectar?</div>' +
      '<div class="pca-geo-filtros">' + filtros + '</div>' +
      '<div class="pca-geo-sub">¿Cómo dibujarlos?</div>' +
      '<div class="pca-formas">' + FORMAS.map(chip).join('') + '</div>' +
      (forma ? '<p class="pca-forma-que">' + icoCat(forma.ico, 14) + '<b>' + esc(forma.nom) + '</b> · ' +
               esc(forma.pregunta) + '</p>' : '') +
      ajuste +
      (act ? '<div class="pca-geo-acciones">' +
        '<button type="button" class="pca-geo-variar" data-u52-call="pca-geo-variar">' +
          ico('dado', 16) + 'Generar otra variación</button>' +
        '<button type="button" class="pca-heat-off" data-u52-call="pca-geo-off">' + ico('apagar', 16) + 'Quitar</button>' +
      '</div>' : '') +
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
  // OJO: va en METROS, no en píxeles. Estaba en píxeles reescalados por el
  // ancho de la malla, y eso funcionaba mientras el área fuera un barrio. En
  // un área grande la malla sigue teniendo el mismo ancho pero cada píxel pasa
  // a cubrir varios metros, así que los mismos 13 píxeles de contagio dejaban
  // de ser 4 m y pasaban a ser 45: la copa se tragaba manzanas enteras de
  // vivienda. Es exactamente lo que se veía al alejarse.
  const VERDE_CRECE_M = 4;
  // Por encima de esta resolución de suelo el contagio se apaga del todo. A
  // esa escala ya no existe "borde sombreado de copa" que rescatar: un píxel
  // apenas verdoso es un píxel MEZCLADO —mitad techo, mitad árbol— y
  // extenderlo solo propaga el error.
  const GRUESO_M_POR_PX = 1.6;
  // Resolución de suelo a la que se apunta en la pasada fina. En un barrio ya
  // se cumple de sobra; en un área grande obliga a pedir la foto más grande.
  const META_M_POR_PX = 1.0;
  const LADO_MAX = 2048;      // techo de la petición, por memoria del teléfono
  // Cuánto se endurece el umbral de verde por cada metro de resolución de más.
  // Barrido contra una escena definida en metros —manzanas de 40 m con casas
  // de 22×16 y árboles de 3 m de radio— leída a 0,33 y a 2,6 m por píxel. Con
  // 1,0 el área grande pasa de declarar 18,6% de verde a 12,1% (lo real es
  // 10,6%) sin perder copa; subiendo a 1,3 la copa se desploma a la mitad.
  const DUREZA_POR_M = 1.0, DUREZA_MAX = 2.0;

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
    // Alcance real sobre el suelo: se traduce a píxeles con la resolución de
    // ESTA malla, así las tres pasadas contagian la misma distancia y un área
    // grande no recibe un contagio desproporcionado.
    const mpp = (U && U.mPorPx) || 0.3;
    const crece = (mpp >= GRUESO_M_POR_PX) ? 0
                : Math.max(1, Math.round(VERDE_CRECE_M / mpp));
    const cola = new Int32Array(n);
    const salto = new Int16Array(n);
    let cabeza = 0, cuelo = 0;
    if (crece > 0) for (let p = 0; p < n; p++) if (suave[p] === COD.verde) { cola[cuelo++] = p; salto[p] = 1; }
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

  /* `ptsExternos` permite analizar un contorno que NO es el área dibujada en
     Pro City. Lo usa el reconocimiento (js/68): cuando se analiza por radio
     no hay ningún trazo, y convertir el círculo en polígono y metérselo a
     Pro City le cambiaría al usuario el área que tenía puesta. Sin el
     argumento se comporta igual que siempre. */
  function analizarRaster(progreso, ptsExternos){
    const avisar = typeof progreso === 'function' ? progreso : function(){};
    const externo = !!(ptsExternos && ptsExternos.length >= 3);
    const contorno = externo ? ptsExternos.slice() : S.pts;
    return new Promise(function (resolve, reject) {
      if (!externo && (!S.cerrada || S.pts.length < 3)) { reject(new Error('Primero dibuja un área.')); return; }
      const bb = bboxDelArea(contorno);
      // Se pide un poco más ancho que el área para que el borde no quede pegado.
      const mLat = (bb.n - bb.s) * .04, mLng = (bb.e - bb.o) * .04;
      const caja = { s: bb.s - mLat, n: bb.n + mLat, o: bb.o - mLng, e: bb.e + mLng };
      // Se conserva la proporción real del área: pedir siempre un cuadrado
      // deformaría un área alargada y falsearía los porcentajes.
      const prop = (caja.n - caja.s) / Math.max(1e-9, (caja.e - caja.o));
      const tam = function (lado) {
        return { w: lado, h: Math.max(60, Math.min(Math.round(lado * 1.6), Math.round(lado * prop))) };
      };

      // Cuántos metros mide el recuadro de lado a lado. De aquí sale TODO lo
      // que depende de la escala: cuánta foto pedir y cuánto puede crecer la
      // copa. Sin esto, una manzana y un corregimiento se analizaban con la
      // misma malla, y en el segundo cada píxel cubría varios metros.
      const latMedia = (caja.n + caja.s) / 2;
      const anchoM = (caja.e - caja.o) * 111320 * Math.cos(latMedia * Math.PI / 180);

      // Se pide más foto cuando el área es grande, para no bajar de la
      // resolución de suelo objetivo. En un barrio esto no cambia nada —1440
      // px ya dan 0,3 m por píxel—; en un área extensa es la diferencia entre
      // distinguir un techo de un árbol o mezclarlos en el mismo píxel.
      const ladoDeseado = Math.ceil(anchoM / META_M_POR_PX);
      const escalaFina = Math.max(ESCALAS[ESCALAS.length - 1], Math.min(LADO_MAX, ladoDeseado));
      const factor = escalaFina / ESCALAS[ESCALAS.length - 1];
      const LADOS = ESCALAS.map(l => Math.round(l * factor));

      // La rejilla final es la de la pasada más fina; las otras se llevan a
      // ella para poder votar celda por celda.
      const FINA = tam(LADOS[LADOS.length - 1]);
      const W = FINA.w, H = FINA.h, N = W * H;

      const votos = [];
      let lienzoFino = null, veloMedio = 0, umbralMedio = 0;

      // Las pasadas van EN SERIE, no en paralelo: cada una son varios millones
      // de píxeles y un teléfono con tres a la vez se queda sin memoria.
      let cadena = Promise.resolve();
      LADOS.forEach(function (lado, idx) {
        cadena = cadena.then(function () {
          avisar('Pasada ' + (idx + 1) + ' de ' + LADOS.length + ' · leyendo a ' + lado + ' px…');
          const t = tam(lado);
          return pedirImagenSatelital(caja, t.w, t.h).then(function (im) {
            veloMedio += quitarVelo(im.datos, t.w * t.h);
            const uFirme = umbralVerdeDeLaFoto(im.datos, t.w * t.h);
            umbralMedio += uFirme;
            // A resolución gruesa se le exige MÁS verde para declarar
            // vegetación. Un píxel de 2,6 m no contiene "un árbol": contiene
            // medio árbol y medio patio, y su índice queda a mitad de camino.
            // Con el umbral de barrio, esa mitad pasa y la mancha verde se
            // come el suelo de alrededor — es el segundo error del área
            // grande, el que quedaba después de arreglar el contagio.
            const mppPasada = anchoM / t.w;
            const dureza = 1 + Math.max(0, Math.min(DUREZA_MAX, (mppPasada - 0.6) * DUREZA_POR_M));
            const U = { firme: uFirme * dureza,
                        debil: uFirme * dureza * (VERDE_DEBIL / VERDE_FIRME),
                        mPorPx: mppPasada };
            avisar('Pasada ' + (idx + 1) + ' de ' + LADOS.length + ' · clasificando ' +
                   (t.w * t.h / 1e6).toFixed(1) + ' M de píxeles…');
            const cls = clasificarMalla(im.datos, t.w, t.h, U);
            votos.push(remuestrear(cls, t.w, t.h, W, H));
            // La foto que se guarda para comparar es la de la pasada más fina,
            // y va YA corregida: es la que de verdad se clasificó.
            if (lado === LADOS[LADOS.length - 1]) {
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
        avisar('Cruzando las ' + LADOS.length + ' pasadas…');

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
        const vert = contorno, V = vert.length;
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
        const m2Total = areaM2(contorno);
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

        // Recortar la rejilla al polígono ANTES de entregarla. La imagen ya
        // salía recortada (los píxeles de afuera van transparentes), pero la
        // rejilla no, y de ella salen los vectores: por eso la cobertura se
        // exportaba como un rectángulo en vez de seguir el contorno dibujado.
        // Se veía en el PDF y se colaba igual al KMZ, al DXF y al GeoJSON.
        for (let p = 0; p < N; p++) if (!dentroMask[p]) final[p] = 0;

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
            velo: Math.round(veloMedio / LADOS.length),
            umbral: Math.round(umbralMedio / LADOS.length * 1000) / 1000,
            pasadas: LADOS.length,
            // Resolución de suelo de la pasada fina y si quedó gruesa: el
            // informe lo dice, porque a esa escala la lectura es de masas y no
            // de elementos, y el estudiante tiene que saberlo.
            mPorPx: Math.round(anchoM / W * 100) / 100,
            grueso: (anchoM / W) >= GRUESO_M_POR_PX,
            malla: W + '×' + H,
            // La rejilla de clases en crudo. La exportación (js/26) la convierte
            // en polígonos de verdad; sin ella solo se podría exportar la imagen,
            // y una imagen no se puede acotar ni editar en CAD.
            rejilla: { cls: final, W: W, H: H, caja: caja, m2PorPixel: m2PorPixel },
            COD: COD, NOM: NOM, RGB: RGB
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
        ico('mapa', 16) + 'Ver en el mapa</button>' +
      '<div class="pca-raster-barra">' +
        orden.filter(c => c.pct > 0).map(c =>
          '<i style="width:' + c.pct + '%;background:' + c.color + '" title="' + esc(c.etq) + '"></i>').join('') +
      '</div>' +
      '<div class="pca-raster-lista">' +
        orden.map(c =>
          '<div class="pca-raster-fila' + (c.fiable ? '' : ' ambigua') + '">' +
          '<span><i style="background:' + c.color + '"></i>' + icoCat(c.ico, 13) + esc(c.etq) + '</span>' +
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
      '<div class="pca-raster-aviso"><b>' + ico('alerta', 14) + 'Cómo leer esto</b>' +
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
        'resuelve por lo que tiene al lado. El botón de satélite del recuadro sobre el mapa muestra <b>la foto que se analizó</b>: ' +
        'no es la misma imagen del mapa de fondo y puede ser de otro año, así que si un árbol ' +
        'falta, ahí se ve si el problema es la clasificación o la foto. Las manchas de agua de menos de 600 m² se toman como techo ' +
        'o sombra —el zinc azul y el agua somera tienen el mismo color—, de modo que una ' +
        'piscina de patio no aparece.</small></div>';
    S.raster = res;
    pintarRasterMapa(res);
  }

  function bloqueRaster(){
    return '<div class="pca-raster-sel">' +
      h4('satelite', 'Cobertura del suelo', 'pca-h-raster') +
      '<p class="pca-raster-ayuda">Estima qué parte del área es vegetación, superficie construida, ' +
        'suelo desnudo o agua, clasificando el color de una imagen satelital.</p>' +
      '<button type="button" class="pca-btn-raster" data-u52-call="pca-raster">' + ico('satelite', 16) + 'Analizar cobertura</button>' +
      '<div id="pca-raster-out">' + (S.raster ? '' : '') + '</div>' +
    '</div>';
  }

  // ── Acciones (las despacha js/20 desde su delegador de clics) ───────────

  function accion(name, el){
    if (name === 'dibujar')  { if (typeof window.urbisProCityCerrarStats === 'function') window.urbisProCityCerrarStats(); iniciarDibujo(); return true; }
    if (name === 'reconocer') {
      if (typeof window.urbisProCityCerrarStats === 'function') window.urbisProCityCerrarStats();
      if (window.URBIS_PC_RECON) window.URBIS_PC_RECON.abrir();
      return true;
    }
    if (name === 'ver-analisis') { cerrarBurbuja(); if (typeof window.urbisProCityAbrirAnalisis === 'function') window.urbisProCityAbrirAnalisis(); return true; }
    if (name === 'cerrar-burbuja') { cerrarBurbuja(); return true; }
    if (name === 'implantacion') {
      S.verImplantacion = !S.verImplantacion;
      reg(S.verImplantacion ? 'implantacion-abierta' : 'implantacion-cerrada');
      if (typeof window.urbisProCityAbrirAnalisis === 'function') window.urbisProCityAbrirAnalisis();
      return true;
    }
    if (name === 'pdf') { exportarPDF(); return true; }
    if (name === 'pdf-todo') {
      exportarPDF();
      // El paquete va detrás del informe: la ventana de impresión se abre de
      // inmediato y la descarga del ZIP llegaría pisada si salen a la vez.
      setTimeout(function () {
        try { if (window.URBIS_PC_EXPORTAR) window.URBIS_PC_EXPORTAR.exportar('paquete'); } catch(e){}
      }, 1200);
      return true;
    }
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
      if (btn) { btn.disabled = true; btn.innerHTML = ico('satelite', 16) + 'Analizando…'; }
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
        if (btn) { btn.disabled = false; btn.innerHTML = ico('satelite', 16) + 'Analizar cobertura'; }
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
    if (name === 'geo-variar') {
      const ctx = (typeof window.urbisProCityCtxAnalisis === 'function') ? window.urbisProCityCtxAnalisis() : null;
      if (!ctx) return true;
      if (!S.geo.tipo) S.geo.tipo = FORMAS[0].id;
      // Si se tira el dado desde el panel, se cierra para poder ver el
      // resultado; desde el chip del mapa ya está cerrado y no hay nada que hacer.
      const desdePanel = !!(el && el.closest && el.closest('.pca-geo-sel'));
      const n = variarGeo(ctx);
      reg('geo-variacion');
      if (desdePanel && typeof window.urbisProCityCerrarStats === 'function') {
        window.urbisProCityCerrarStats();
        cerrarBurbuja();
      }
      if (n < 2) alert('Con este filtro solo hay ' + n + ' punto' + (n === 1 ? '' : 's') +
        ' dentro del área. Elige "Todo lo mapeado" u otra categoría para ver la geometría.');
      return true;
    }
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
    if (!b) return;
    /* Si el botón vive DENTRO de la aplicación, lo atiende el enrutador de
       js/20 y acá no hay nada que hacer. La pregunta hay que hacérsela al
       CAMINO del evento y no al árbol de ahora:

       `composedPath()` se calcula cuando el evento se despacha. `closest()`
       sube por el árbol en el momento en que se lo llama —y para entonces el
       primer manejador ya repintó la barra, así que el botón que se tocó está
       desprendido del documento y su `closest` no encuentra nada—. Con eso la
       guarda fallaba y la acción se ejecutaba DOS VECES por un solo toque.

       Con «deshacer» se veía: un toque saltaba dos pasos atrás. Con «cerrar»
       o «cancelar» no se notaba, porque hacer dos veces lo mismo da igual, y
       por eso llevaba ahí desde siempre sin que nadie lo viera. */
    const camino = (typeof ev.composedPath === 'function') ? ev.composedPath() : null;
    const dentro = camino
      ? camino.some(function (n) { return n && n.id === 'urbis-mobile-app'; })
      : !!b.closest('#urbis-mobile-app');
    if (dentro) return;
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
    /* Calor con puntos de fuera (lo usa el reconocimiento, js/68).
       `puntos` es [{lat,lng}]; `color` pinta la escala. Con null se apaga. */
    calorExterno: function (puntos, color, etiqueta, alApagar) {
      if (!puntos || !puntos.length) { apagarHeat(); return 0; }
      S.heat.externos = puntos.filter(function (p) {
        return p && isFinite(p.lat) && isFinite(p.lng);
      }).map(function (p) { return { lat: Number(p.lat), lng: Number(p.lng) }; });
      S.heat.colorExterno = color || null;
      S.heat.etqExterno = etiqueta || '';
      S.heat.alApagar = (typeof alApagar === 'function') ? alApagar : null;
      encenderHeat('todos');
      return S.heat.externos.length;
    },
    /* El área dibujada, guardada con nombre desde fuera (lo usa js/68 para
       que un sector reconocido quede en la misma lista de áreas que el
       estudiante ya conoce, y sirva luego para el análisis de sus mapeos). */
    guardarAreaConNombre: function (nombre, pts) {
      const lista = (pts && pts.length >= 3) ? pts.slice() : S.pts.slice();
      nombre = String(nombre || '').trim();
      if (!nombre || lista.length < 3) return null;
      const areas = leerAreas();
      // Mismo nombre, misma área: se reemplaza en vez de acumular copias.
      const previa = areas.filter(function (x) { return x.nombre === nombre; })[0];
      const nueva = {
        id: previa ? previa.id : idDeArea(), nombre, pts: lista,
        fecha: new Date().toISOString(), areaM2: Math.round(areaM2(lista))
      };
      escribirAreas([nueva].concat(areas.filter(function (x) { return x.id !== nueva.id; })));
      return nueva;
    },
    areasGuardadas: leerAreas,
    cargarAreaPorId: cargarArea,
    // La miniatura de mapa y el «hace cuánto», compartidos con la pestaña
    // «Sector» (js/68) para que las dos listas se vean como la misma cosa.
    miniatura: miniaturaMapa,
    haceCuanto: haceCuanto,
    // Geometría (Fase 3)
    geoActiva: () => S.geo.tipo, apagarGeo, refrescarPorFiltro, geometriaActual,
    areaNombre: () => S.nombre,
    // Cobertura del suelo (Fase 4)
    analizarRaster, clasificarPixel, ultimoRaster: () => S.raster,
    /* Pintar en el mapa una cobertura analizada desde fuera (js/68). Se pasa
       por `S.raster` a propósito: es lo que leen el chip, el conmutador
       foto/clases y la exportación, así que una cobertura externa se comporta
       exactamente igual que una propia. */
    mostrarRaster: function (res) {
      if (!res) return false;
      S.raster = res;
      pintarRasterMapa(res);
      chipRaster();
      return true;
    },
    quitarRaster: function () { S.raster = null; apagarRasterMapa(); }
  };
})();
