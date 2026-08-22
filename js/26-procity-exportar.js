/* URBIS Pro City · EXPORTACIÓN GEOGRÁFICA (js/26) — Fase 6
   ─────────────────────────────────────────────────────────────────────────
   Saca el área analizada a otros programas:

   · KMZ  → Google Earth. Es un ZIP que contiene un doc.kml. Se genera el ZIP
            a mano (método "store", sin comprimir) en ~40 líneas, para no traer
            JSZip solo por esto: son 100 KB de CDN que además romperían el
            arranque sin red de la PWA.
   · DXF  → AutoCAD. Texto plano, sin librerías de pago para geometría 2D.

   Decisión clave del DXF: las coordenadas NO van en grados. Un polígono de un
   barrio mide ~0.005 grados de lado, y AutoCAD lo abriría como un dibujo de
   5 milésimas de unidad — inservible para medir o acotar. Se proyecta a metros
   locales alrededor del centroide del área, así que en AutoCAD 1 unidad = 1
   metro y las cotas salen reales.

   FBX queda fuera a propósito (plan, sección 6): es un formato de malla 3D
   para videojuegos y no encaja con planos 2D de urbanismo. */
(function(){
  'use strict';

  const R_TIERRA = 6378137;

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function ctxPC(){
    return (typeof window.urbisProCityCtxAnalisis === 'function')
      ? window.urbisProCityCtxAnalisis() : null;
  }
  function PC(){ return window.URBIS_PC_ANALISIS || null; }

  // Datos a exportar: el contorno del área y los puntos de Pro City dentro.
  function recolectar(){
    const pc = PC();
    if (!pc || !pc.hayArea()) return null;
    const pts = pc.puntosDelArea();
    const ctx = ctxPC();
    const datos = (typeof globalData !== 'undefined' && Array.isArray(globalData)) ? globalData : [];
    const dentro = [];
    if (ctx) {
      datos.forEach(p => {
        if (!p || !ctx.esProCity(p.tipo)) return;
        const lat = parseFloat(String(p.lat || '').replace(',', '.'));
        const lng = parseFloat(String(p.lng || '').replace(',', '.'));
        if (isNaN(lat) || isNaN(lng)) return;
        if (!pc.dentroDelPoligono(lat, lng, pts)) return;
        const uso = String(p.tipo || '') === ctx.matrizKey ? ctx.usoDe(p) : '';
        const g = uso ? ctx.grupos.find(x => x.usos.indexOf(uso) !== -1) : null;
        dentro.push({
          lat, lng,
          nombre: (String(p.descripcion || '').split(' | ')[0] || '').trim() || 'Punto',
          grupo: g ? g.t : (String(p.tipo || '').replace(/^[^\wáéíóúñÁÉÍÓÚÑ]+\s*/, '') || 'Sin categoría'),
          gid: g ? g.id : 'otros'
        });
      });
    }
    // La geometría en curso (red / envolvente / círculos) y la cobertura ya
    // analizada, si las hay. Se exporta lo que el usuario TIENE puesto, no una
    // versión recalculada aparte: si en pantalla la red conecta 12 puntos, el
    // archivo trae esos 12.
    const geo = (typeof pc.geometriaActual === 'function') ? pc.geometriaActual(ctx) : null;
    const raster = (typeof pc.ultimoRaster === 'function') ? pc.ultimoRaster() : null;
    let cobertura = [];
    if (raster && raster.rejilla) {
      try { cobertura = vectorizarCobertura(raster); } catch(e){ cobertura = []; }
    }
    return { pts, puntos: dentro, geo, raster, cobertura,
             areaM2: pc.areaM2(pts), perimetroM: pc.perimetroM(pts, true) };
  }

  // ══ VECTORIZACIÓN DE LA COBERTURA ═════════════════════════════════════════
  //
  // El análisis de cobertura produce una rejilla de clases (una imagen). Una
  // imagen sirve para mirar, pero no para trabajar: en AutoCAD no se puede
  // acotar el borde de una mancha de bitmap, y en Google Earth no se puede
  // consultar ni medir. Así que aquí la rejilla se convierte en POLÍGONOS.
  //
  // Método: se recorren las celdas de cada clase y, cada vez que una celda
  // toca a un vecino de otra clase, se emite la arista compartida con un
  // sentido de giro constante (la clase siempre a la misma mano). Después las
  // aristas se encadenan cabeza con cola hasta cerrar anillos. Sale gratis una
  // propiedad valiosa: los huecos —un patio dentro de una masa de árboles—
  // aparecen solos, con el giro invertido, y se reconocen por el signo del
  // área. Es el mismo principio del "marching squares", sin librería.
  const VECT_LADO_MAX = 640;   // rejilla de trabajo: ~1 m por celda en un barrio
  const VECT_MIN_CELDAS = 12;  // por debajo de esto es ruido, no un rasgo

  // La rejilla del análisis va a 1440 px: vectorizarla entera daría cientos de
  // miles de vértices, un archivo que AutoCAD abre de mala gana y que no aporta
  // detalle real (el propio clasificador trabaja sobre píxeles de ~0,5 m). Se
  // reduce por moda: cada celda nueva toma la clase más repetida de su bloque.
  function reducirRejilla(cls, W, H, ladoMax){
    if (W <= ladoMax) return { cls: cls, W: W, H: H };
    const f = Math.ceil(W / ladoMax);
    const w2 = Math.floor(W / f), h2 = Math.floor(H / f);
    const out = new Uint8Array(w2 * h2);
    const cnt = new Uint16Array(5);
    for (let y = 0; y < h2; y++) {
      for (let x = 0; x < w2; x++) {
        cnt[0] = cnt[1] = cnt[2] = cnt[3] = cnt[4] = 0;
        for (let dy = 0; dy < f; dy++) {
          const fila = (y * f + dy) * W + x * f;
          for (let dx = 0; dx < f; dx++) cnt[cls[fila + dx]]++;
        }
        // El 0 entra en la votación: es "fuera del área". Si no compitiera, un
        // bloque del borde que cae casi todo afuera se rellenaría igual con la
        // clase que más asome, y la cobertura volvería a desbordar el polígono.
        let mejor = 0, n = -1;
        for (let k = 0; k <= 4; k++) if (cnt[k] > n) { n = cnt[k]; mejor = k; }
        out[y * w2 + x] = mejor;
      }
    }
    return { cls: out, W: w2, H: h2 };
  }

  // Anillos cerrados del conjunto de celdas de una clase, en coordenadas de
  // rejilla (esquinas enteras).
  function anillosDeClase(cls, W, H, cod){
    const es = p => cls[p] === cod;
    // Cada arista se guarda como origen→destino sobre las ESQUINAS de la
    // rejilla, que son (W+1)×(H+1).
    const WV = W + 1;
    const desde = new Map();
    const anota = (x0, y0, x1, y1) => {
      const k = y0 * WV + x0;
      const lista = desde.get(k);
      if (lista) lista.push([x1, y1]); else desde.set(k, [[x1, y1]]);
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        if (!es(p)) continue;
        if (y === 0     || !es(p - W)) anota(x,     y,     x + 1, y    ); // arriba →
        if (x === W - 1 || !es(p + 1)) anota(x + 1, y,     x + 1, y + 1); // derecha ↓
        if (y === H - 1 || !es(p + W)) anota(x + 1, y + 1, x,     y + 1); // abajo ←
        if (x === 0     || !es(p - 1)) anota(x,     y + 1, x,     y    ); // izquierda ↑
      }
    }
    const anillos = [];
    desde.forEach((lista, k) => {
      while (lista.length) {
        const inicio = [k % WV, Math.floor(k / WV)];
        const sig = lista.pop();
        const anillo = [inicio, sig];
        let cur = sig, vueltas = 0;
        // Se camina siempre por la arista disponible que sale del vértice
        // actual. Con el giro constante de arriba, la cadena cierra sola.
        while (vueltas++ < 4000000) {
          const kk = cur[1] * WV + cur[0];
          const l2 = desde.get(kk);
          if (!l2 || !l2.length) break;
          const nx = l2.pop();
          if (nx[0] === inicio[0] && nx[1] === inicio[1]) { anillo.push(nx); break; }
          anillo.push(nx);
          cur = nx;
        }
        if (anillo.length >= 4) anillos.push(anillo);
        if (!lista.length) break;
      }
    });
    return anillos;
  }

  // Área con signo en celdas: sirve para dos cosas a la vez — saber si el
  // anillo es contorno o hueco (por el signo) y descartar los diminutos.
  function areaConSigno(anillo){
    let a = 0;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      a += (anillo[j][0] * anillo[i][1]) - (anillo[i][0] * anillo[j][1]);
    }
    return a / 2;
  }

  // Douglas–Peucker: quita los vértices que no cambian la forma más de la
  // tolerancia. Sin esto cada anillo sale en escalera, con un vértice por
  // celda, y un DXF de una manzana arbolada pesaría decenas de megas.
  function simplificar(pts, tol){
    if (pts.length < 4) return pts;
    const guardar = new Uint8Array(pts.length);
    guardar[0] = guardar[pts.length - 1] = 1;
    const pila = [[0, pts.length - 1]];
    while (pila.length) {
      const [i0, i1] = pila.pop();
      if (i1 <= i0 + 1) continue;
      const ax = pts[i0][0], ay = pts[i0][1];
      const bx = pts[i1][0], by = pts[i1][1];
      const dx = bx - ax, dy = by - ay;
      const den = dx * dx + dy * dy;
      let peor = -1, iPeor = -1;
      for (let i = i0 + 1; i < i1; i++) {
        const px = pts[i][0] - ax, py = pts[i][1] - ay;
        const d = den ? Math.abs(px * dy - py * dx) / Math.sqrt(den)
                      : Math.sqrt(px * px + py * py);
        if (d > peor) { peor = d; iPeor = i; }
      }
      if (peor > tol) { guardar[iPeor] = 1; pila.push([i0, iPeor], [iPeor, i1]); }
    }
    return pts.filter((p, i) => guardar[i]);
  }

  // ¿El punto cae dentro del anillo? Se usa para colgar cada hueco del
  // contorno que lo contiene.
  function dentroDeAnillo(pt, anillo){
    let dentro = false;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const xi = anillo[i][0], yi = anillo[i][1], xj = anillo[j][0], yj = anillo[j][1];
      if (((yi > pt[1]) !== (yj > pt[1])) &&
          (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) dentro = !dentro;
    }
    return dentro;
  }

  // Convierte la rejilla de clases en polígonos lat/lng, uno por región, con
  // sus huecos ya colgados del contorno que les corresponde.
  function vectorizarCobertura(raster){
    if (!raster || !raster.rejilla) return [];
    const r = reducirRejilla(raster.rejilla.cls, raster.rejilla.W, raster.rejilla.H, VECT_LADO_MAX);
    const caja = raster.rejilla.caja;
    const NOM = raster.NOM || [null, 'verde', 'construido', 'agua', 'mixto'];
    const RGB = raster.RGB || {};
    const aLatLng = ([x, y]) => [
      caja.o + x / r.W * (caja.e - caja.o),
      caja.n - y / r.H * (caja.n - caja.s)
    ];
    // Tolerancia de simplificación: media celda. Suaviza la escalera sin
    // desplazar el borde más de lo que el propio píxel ya lo tenía indefinido.
    const tol = 0.5;
    const salida = [];
    for (let cod = 1; cod <= 4; cod++) {
      const clase = NOM[cod];
      if (!clase) continue;
      const crudos = anillosDeClase(r.cls, r.W, r.H, cod);
      const contornos = [], huecos = [];
      crudos.forEach(a => {
        const area = areaConSigno(a);
        if (Math.abs(area) < VECT_MIN_CELDAS) return;
        const simple = simplificar(a, tol);
        if (simple.length < 4) return;
        (area > 0 ? contornos : huecos).push({ celdas: simple, area: Math.abs(area) });
      });
      // Cada hueco va al contorno más pequeño que lo contenga: si dos
      // contornos anidados lo abrazan, el que manda es el interior.
      contornos.forEach(c => { c.huecos = []; });
      huecos.forEach(h => {
        let dueño = null;
        for (let i = 0; i < contornos.length; i++) {
          if (!dentroDeAnillo(h.celdas[0], contornos[i].celdas)) continue;
          if (!dueño || contornos[i].area < dueño.area) dueño = contornos[i];
        }
        if (dueño) {
          dueño.huecos.push(h.celdas.map(aLatLng));
          dueño.area -= h.area;   // el patio no es superficie de la clase
        }
      });
      contornos.forEach(c => {
        salida.push({
          clase: clase,
          color: '#' + ((RGB[clase] || [120,120,120]).map(v => v.toString(16).padStart(2,'0')).join('')),
          m2: Math.round(c.area * (raster.rejilla.W / r.W) * (raster.rejilla.H / r.H) * raster.rejilla.m2PorPixel),
          contorno: c.celdas.map(aLatLng),
          huecos: c.huecos
        });
      });
    }
    return salida;
  }


  function nombreArchivo(base, ext){
    const n = (window.__pcaNombreArea || 'area').toString()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'area';
    return 'urbis-' + base + '-' + n + '.' + ext;
  }

  function descargar(blob, nombre){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(() => { try { a.remove(); URL.revokeObjectURL(url); } catch(e){} }, 1500);
  }

  // ── KML / KMZ ───────────────────────────────────────────────────────────

  // Colores KML: aabbggrr (alfa, azul, verde, rojo) — al revés que en CSS.
  function kmlColor(hex, alfa){
    const h = String(hex || '#34CCFE').replace('#', '');
    const r = h.slice(0, 2), g = h.slice(2, 4), b = h.slice(4, 6);
    return (alfa || 'ff') + b + g + r;
  }

  // Coordenadas KML: lng,lat,alt separadas por comas; los vértices por espacios.
  function coordsKML(anillo, esLatLng){
    return anillo.map(function (p) {
      const lng = esLatLng ? p.lng : p[0];
      const lat = esLatLng ? p.lat : p[1];
      return lng.toFixed(7) + ',' + lat.toFixed(7) + ',0';
    }).join(' ');
  }

  function anilloCerrado(a, esLatLng){
    const primero = a[0], ultimo = a[a.length - 1];
    const igual = esLatLng ? (primero.lat === ultimo.lat && primero.lng === ultimo.lng)
                           : (primero[0] === ultimo[0] && primero[1] === ultimo[1]);
    return igual ? a : a.concat([primero]);
  }

  // Círculo real sobre el elipsoide para los "círculos de impacto": KML no
  // tiene primitiva de círculo, así que se entrega como polígono de 36 lados.
  function circuloComoPoligono(centro, radioM, lados){
    const n = lados || 36, rad = Math.PI / 180;
    const dLat = radioM / R_TIERRA / rad;
    const dLng = dLat / Math.max(1e-6, Math.cos(centro.lat * rad));
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = i / n * 2 * Math.PI;
      out.push([centro.lng + dLng * Math.cos(a), centro.lat + dLat * Math.sin(a)]);
    }
    return out;
  }

  function poligonoKML(contorno, huecos, esLatLng){
    const interiores = (huecos || []).map(function (h) {
      return '<innerBoundaryIs><LinearRing><coordinates>' +
             coordsKML(anilloCerrado(h, false), false) + '</coordinates></LinearRing></innerBoundaryIs>';
    }).join('');
    return '<Polygon><tessellate>1</tessellate>' +
      '<outerBoundaryIs><LinearRing><coordinates>' +
      coordsKML(anilloCerrado(contorno, esLatLng), esLatLng) +
      '</coordinates></LinearRing></outerBoundaryIs>' + interiores + '</Polygon>';
  }

  // Nombres legibles de las clases de cobertura, para que en Google Earth no
  // aparezcan claves internas.
  const ETQ_CLASE = { verde:'Vegetación viva', construido:'Superficie dura',
                      agua:'Agua', mixto:'Tonos cálidos (no separables)' };

  function construirKML(d, opciones){
    const o = opciones || {};
    const ctx = ctxPC();
    const colorDe = gid => (ctx && ctx.colorGrupo && ctx.colorGrupo[gid]) || '#6b70e0';
    const gruposUsados = [];
    d.puntos.forEach(p => { if (gruposUsados.indexOf(p.gid) === -1) gruposUsados.push(p.gid); });

    let estilos = gruposUsados.map(gid =>
      '<Style id="g_' + esc(gid) + '"><IconStyle><color>' + kmlColor(colorDe(gid)) + '</color>' +
      '<scale>1.0</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>' +
      '</IconStyle></Style>').join('');

    // Un estilo por clase de cobertura: relleno translúcido y borde del mismo
    // color. Translúcido a propósito — pedido explícito: debajo se tiene que
    // seguir viendo el satelital de Google Earth.
    const clasesUsadas = [];
    d.cobertura.forEach(c => { if (clasesUsadas.indexOf(c.clase) === -1) clasesUsadas.push(c.clase); });
    estilos += clasesUsadas.map(cl => {
      const col = (d.cobertura.find(x => x.clase === cl) || {}).color || '#888888';
      return '<Style id="c_' + esc(cl) + '">' +
        '<LineStyle><color>' + kmlColor(col) + '</color><width>1.2</width></LineStyle>' +
        '<PolyStyle><color>' + kmlColor(col, '73') + '</color></PolyStyle></Style>';
    }).join('');

    estilos += '<Style id="geoLinea"><LineStyle><color>' + kmlColor('#ff1f3d') +
      '</color><width>3</width></LineStyle></Style>' +
      '<Style id="geoArea"><LineStyle><color>' + kmlColor((d.geo && d.geo.color) || '#FABD0A') +
      '</color><width>2</width></LineStyle><PolyStyle><color>' +
      kmlColor((d.geo && d.geo.color) || '#FABD0A', '33') + '</color></PolyStyle></Style>';

    const anillo = coordsKML(anilloCerrado(d.pts, true), true);

    const marcas = d.puntos.map(p =>
      '<Placemark><name>' + esc(p.nombre) + '</name>' +
      '<description>' + esc(p.grupo) + '</description>' +
      '<styleUrl>#g_' + esc(p.gid) + '</styleUrl>' +
      '<Point><coordinates>' + p.lng.toFixed(7) + ',' + p.lat.toFixed(7) + ',0</coordinates></Point>' +
      '</Placemark>').join('');

    // ── Cobertura vectorizada, agrupada por clase ─────────────────────────
    let carpetaCobertura = '';
    if (d.cobertura.length) {
      const porClase = {};
      d.cobertura.forEach(c => { (porClase[c.clase] = porClase[c.clase] || []).push(c); });
      carpetaCobertura = '<Folder><name>Cobertura del suelo (vectores)</name>' +
        '<description>' + esc('Polígonos derivados del análisis de imagen satelital. ' +
          'Estimación por color: no sustituye un estudio ambiental certificado.') + '</description>' +
        Object.keys(porClase).map(function (cl) {
          const lista = porClase[cl];
          let sumaM2 = 0;
          lista.forEach(c => { sumaM2 += c.m2; });
          const ha = Math.round(sumaM2 / 100) / 100;
          return '<Folder><name>' + esc(ETQ_CLASE[cl] || cl) + ' · ' + ha + ' ha (' +
            lista.length + ' polígonos)</name>' +
            // Las clases "no fiables" nacen apagadas: se pueden encender, pero
            // no deberían ser lo primero que se ve.
            (cl === 'mixto' ? '<visibility>0</visibility>' : '') +
            lista.map(function (c, i) {
              return '<Placemark><name>' + esc((ETQ_CLASE[cl] || cl) + ' ' + (i + 1)) + '</name>' +
                '<description>' + esc('Superficie aproximada: ' + c.m2.toLocaleString('es-CO') + ' m²') +
                '</description><styleUrl>#c_' + esc(cl) + '</styleUrl>' +
                poligonoKML(c.contorno, c.huecos, false) + '</Placemark>';
            }).join('') + '</Folder>';
        }).join('') + '</Folder>';
    }

    // ── Geometría generada ────────────────────────────────────────────────
    let carpetaGeo = '';
    if (d.geo && d.geo.puntos && d.geo.puntos.length) {
      const g = d.geo;
      let cuerpo = '';
      if (g.lineas && g.lineas.length) {
        cuerpo = g.lineas.map(function (par, i) {
          return '<Placemark><name>' + esc('Conexión ' + (i + 1)) + '</name>' +
            '<styleUrl>#geoLinea</styleUrl><LineString><tessellate>1</tessellate><coordinates>' +
            par[0].lng.toFixed(7) + ',' + par[0].lat.toFixed(7) + ',0 ' +
            par[1].lng.toFixed(7) + ',' + par[1].lat.toFixed(7) + ',0' +
            '</coordinates></LineString></Placemark>';
        }).join('');
      } else if (g.anillo && g.anillo.length >= 3) {
        cuerpo = '<Placemark><name>' + esc(g.nombre) + '</name><styleUrl>#geoArea</styleUrl>' +
          poligonoKML(g.anillo, [], true) + '</Placemark>';
      } else if (g.radioM) {
        cuerpo = g.puntos.map(function (p, i) {
          return '<Placemark><name>' + esc('Radio de impacto ' + (i + 1)) + '</name>' +
            '<description>' + esc('Radio ' + g.radioM + ' m') + '</description>' +
            '<styleUrl>#geoArea</styleUrl>' +
            poligonoKML(circuloComoPoligono(p, g.radioM), [], false) + '</Placemark>';
        }).join('');
      }
      carpetaGeo = '<Folder><name>' + esc(g.nombre) + ' · ' + esc(g.filtro) + '</name>' + cuerpo + '</Folder>';
    }

    // ── Imágenes clavadas sobre el terreno ────────────────────────────────
    // Google Earth ya trae su propio satelital, así que la foto analizada va
    // apagada por defecto: sirve para comparar fechas, no para tapar el mapa.
    let overlays = '';
    if (o.imagenes && d.raster && d.raster.overlayLimites) {
      const L = d.raster.overlayLimites;
      const caja = '<LatLonBox><north>' + L[1][0].toFixed(8) + '</north><south>' + L[0][0].toFixed(8) +
        '</south><east>' + L[1][1].toFixed(8) + '</east><west>' + L[0][1].toFixed(8) + '</west></LatLonBox>';
      overlays = '<Folder><name>Imágenes del análisis</name>' +
        '<GroundOverlay><name>Cobertura clasificada (imagen)</name><visibility>0</visibility>' +
        '<color>b4ffffff</color><Icon><href>cobertura.png</href></Icon>' + caja + '</GroundOverlay>' +
        '<GroundOverlay><name>Foto satelital analizada</name><visibility>0</visibility>' +
        '<Icon><href>satelital.png</href></Icon>' + caja + '</GroundOverlay>' +
        '</Folder>';
    }

    const ha = Math.round(d.areaM2 / 100) / 100;
    const resumen = 'Área: ' + ha + ' ha · Perímetro: ' + Math.round(d.perimetroM) + ' m · ' +
      d.puntos.length + ' puntos mapeados' +
      (d.cobertura.length ? ' · cobertura vectorizada en ' + d.cobertura.length + ' polígonos' : '') +
      (d.geo ? ' · ' + d.geo.nombre : '') + '. Generado por URBIS Pro City.';

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>' +
      '<name>' + esc(window.__pcaNombreArea || 'Área de análisis URBIS') + '</name>' +
      '<description>' + esc(resumen) + '</description>' +
      estilos +
      '<Style id="areaUrbis"><LineStyle><color>' + kmlColor('#0E86BE') + '</color><width>3</width></LineStyle>' +
      '<PolyStyle><color>' + kmlColor('#34CCFE', '30') + '</color></PolyStyle></Style>' +
      '<Placemark><name>Área analizada</name><description>' + esc(resumen) + '</description>' +
      '<styleUrl>#areaUrbis</styleUrl>' +
      '<Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing>' +
      '<coordinates>' + anillo + '</coordinates>' +
      '</LinearRing></outerBoundaryIs></Polygon></Placemark>' +
      carpetaCobertura + carpetaGeo +
      (marcas ? '<Folder><name>Puntos mapeados (' + d.puntos.length + ')</name>' + marcas + '</Folder>' : '') +
      overlays +
      '</Document></kml>';
  }

  // ── ZIP mínimo (solo "store") para empaquetar el KMZ ────────────────────
  // Un KMZ es literalmente un ZIP con un doc.kml adentro. Sin compresión el
  // formato es corto de escribir y el archivo sigue siendo pequeño (un KML de
  // un barrio ronda los 50 KB), así que no compensa traer una librería.

  const TABLA_CRC = (function(){
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes){
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // ZIP de VARIOS archivos, y binarios: el KMZ ya no lleva solo un doc.kml,
  // lleva también las imágenes (satelital y cobertura) que Google Earth clava
  // sobre el terreno. Sigue siendo método "store" —sin comprimir— porque el
  // PNG ya viene comprimido y el KML de un barrio no llega a 200 KB: traer una
  // librería de compresión no ahorraría nada y sí rompería el arranque sin red.
  function zip(entradas, tipoMime){
    const cod = new TextEncoder();
    const partes = [], central = [];
    let desplazamiento = 0, n = 0;

    entradas.forEach(function (e) {
      const datos = (e.datos instanceof Uint8Array) ? e.datos : cod.encode(String(e.datos));
      const nom = cod.encode(e.nombre);
      const crc = crc32(datos);
      const tam = datos.length;

      const L = [];
      const l16 = v => { L.push(v & 0xFF, (v >>> 8) & 0xFF); };
      const l32 = v => { L.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF); };
      l32(0x04034b50); l16(20); l16(0); l16(0); l16(0); l16(0);
      l32(crc); l32(tam); l32(tam); l16(nom.length); l16(0);
      const cabecera = new Uint8Array(L.length + nom.length);
      cabecera.set(L, 0); cabecera.set(nom, L.length);

      partes.push(cabecera, datos);

      const C = [];
      const c16 = v => { C.push(v & 0xFF, (v >>> 8) & 0xFF); };
      const c32 = v => { C.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF); };
      c32(0x02014b50); c16(20); c16(20); c16(0); c16(0); c16(0); c16(0);
      c32(crc); c32(tam); c32(tam);
      c16(nom.length); c16(0); c16(0); c16(0); c16(0); c32(0); c32(desplazamiento);
      const entradaCentral = new Uint8Array(C.length + nom.length);
      entradaCentral.set(C, 0); entradaCentral.set(nom, C.length);
      central.push(entradaCentral);

      desplazamiento += cabecera.length + tam;
      n++;
    });

    let tamCentral = 0;
    central.forEach(c => { tamCentral += c.length; });
    const F = [];
    const f16 = v => { F.push(v & 0xFF, (v >>> 8) & 0xFF); };
    const f32 = v => { F.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF); };
    f32(0x06054b50); f16(0); f16(0); f16(n); f16(n);
    f32(tamCentral); f32(desplazamiento); f16(0);

    return new Blob(partes.concat(central, [new Uint8Array(F)]),
                    { type: tipoMime || 'application/zip' });
  }

  // Un data URL de canvas → bytes, para meter los PNG dentro del ZIP.
  function bytesDeDataURL(uri){
    const b64 = String(uri || '').split(',')[1] || '';
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // ── DXF ─────────────────────────────────────────────────────────────────
  //
  // Antes el dibujo salía en metros LOCALES alrededor del centroide: medía
  // bien, pero no estaba georreferenciado — al pegarle encima un plano
  // catastral o un levantamiento, caía a miles de kilómetros. Ahora las
  // coordenadas van en UTM WGS84, que es lo que espera cualquier flujo de CAD
  // topográfico: el dibujo abre en su sitio del mundo, en metros, y se puede
  // superponer con cartografía oficial sin mover nada.
  const RAD = Math.PI / 180;

  function zonaUTM(lng){ return Math.floor((lng + 180) / 6) + 1; }
  function epsgUTM(lat, lng){ return (lat >= 0 ? 32600 : 32700) + zonaUTM(lng); }

  // Transversa de Mercator (WGS84). Serie estándar, precisión centimétrica muy
  // por debajo de lo que un mapeo urbano necesita.
  function aUTM(lat, lng, zona){
    const a = 6378137, f = 1 / 298.257223563;
    const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
    const k0 = 0.9996;
    const lng0 = (zona - 1) * 6 - 180 + 3;
    const p = lat * RAD, l = (lng - lng0) * RAD;
    const N = a / Math.sqrt(1 - e2 * Math.sin(p) * Math.sin(p));
    const T = Math.tan(p) * Math.tan(p);
    const C = ep2 * Math.cos(p) * Math.cos(p);
    const A = Math.cos(p) * l;
    const M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256) * p
      - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 * e2 * e2 / 1024) * Math.sin(2 * p)
      + (15 * e2 * e2 / 256 + 45 * e2 * e2 * e2 / 1024) * Math.sin(4 * p)
      - (35 * e2 * e2 * e2 / 3072) * Math.sin(6 * p));
    const x = k0 * N * (A + (1 - T + C) * A * A * A / 6
      + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Math.pow(A, 5) / 120) + 500000;
    let y = k0 * (M + N * Math.tan(p) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Math.pow(A, 6) / 720));
    if (lat < 0) y += 10000000;
    return { x: x, y: y };
  }

  function proyectorUTM(pts){
    const lng0 = pts.reduce((a, p) => a + p.lng, 0) / pts.length;
    const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
    const zona = zonaUTM(lng0);
    const f = p => aUTM(p.lat !== undefined ? p.lat : p[1], p.lng !== undefined ? p.lng : p[0], zona);
    f.zona = zona;
    f.epsg = epsgUTM(lat0, lng0);
    f.hemisferio = lat0 >= 0 ? 'N' : 'S';
    return f;
  }
  // Se mantiene la proyección local por compatibilidad con quien ya la usaba.
  function proyector(pts){
    const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
    const lng0 = pts.reduce((a, p) => a + p.lng, 0) / pts.length;
    const mx = R_TIERRA * Math.cos(lat0 * RAD) * RAD;
    const my = R_TIERRA * RAD;
    return p => ({ x: (p.lng - lng0) * mx, y: (p.lat - lat0) * my });
  }

  function par(codigo, valor){ return codigo + '\n' + valor + '\n'; }

  function capaDXF(nombre, colorIdx){
    return par(0,'LAYER') + par(2, nombre) + par(70, 0) + par(62, colorIdx) + par(6,'CONTINUOUS');
  }

  // Índice de color ACI aproximado por grupo, para que las capas se distingan
  // al abrirlas en AutoCAD sin tener que configurarlas a mano.
  const ACI = { vivienda:30, comercio:1, institucional:5, industria:34, salud:6,
                cultura:200, servicios:4, ambiente:3, riesgo:2, mixtos:170, otros:7 };
  const ACI_CLASE = { verde:3, construido:9, agua:5, mixto:42 };

  // Polilínea cerrada. Es la entidad que CAD entiende como contorno medible.
  function polilineaDXF(capa, puntos, proj, cerrada){
    let s = par(0,'LWPOLYLINE') + par(8, capa) + par(100,'AcDbEntity') + par(100,'AcDbPolyline') +
            par(90, puntos.length) + par(70, cerrada ? 1 : 0);
    puntos.forEach(function (p) {
      const q = proj(p);
      s += par(10, q.x.toFixed(3)) + par(20, q.y.toFixed(3));
    });
    return s;
  }

  function construirDXF(d){
    const proj = proyectorUTM(d.pts);
    const capas = [['AREA_ANALISIS', 5]];
    const anota = (n, c) => { if (!capas.some(x => x[0] === n)) capas.push([n, c]); };
    d.puntos.forEach(p => anota('PTS_' + p.gid.toUpperCase(), ACI[p.gid] || 7));
    d.cobertura.forEach(c => anota('COBERTURA_' + c.clase.toUpperCase(), ACI_CLASE[c.clase] || 7));
    if (d.geo) anota('GEOMETRIA_' + d.geo.tipo.toUpperCase(), 1);
    anota('URBIS_INFO', 7);

    let s = '';
    // HEADER: $INSUNITS = 6 declara METROS, para que AutoCAD no pregunte.
    s += par(0,'SECTION') + par(2,'HEADER') +
         par(9,'$INSUNITS') + par(70, 6) +
         par(9,'$MEASUREMENT') + par(70, 1) +
         par(0,'ENDSEC');
    s += par(0,'SECTION') + par(2,'TABLES') + par(0,'TABLE') + par(2,'LAYER') + par(70, capas.length);
    capas.forEach(c => { s += capaDXF(c[0], c[1]); });
    s += par(0,'ENDTAB') + par(0,'ENDSEC');

    s += par(0,'SECTION') + par(2,'ENTITIES');

    // El contorno del área.
    s += polilineaDXF('AREA_ANALISIS', d.pts, proj, true);

    // La cobertura: cada región y cada hueco, como polilíneas cerradas. Los
    // huecos van en la misma capa: en CAD se restan con HATCH o BOUNDARY según
    // lo necesite quien lo abra, y dejarlos aparte permitiría no restarlos.
    d.cobertura.forEach(function (c) {
      const capa = 'COBERTURA_' + c.clase.toUpperCase();
      s += polilineaDXF(capa, c.contorno, proj, true);
      (c.huecos || []).forEach(h => { s += polilineaDXF(capa, h, proj, true); });
    });

    // La geometría generada.
    if (d.geo) {
      const capa = 'GEOMETRIA_' + d.geo.tipo.toUpperCase();
      if (d.geo.lineas && d.geo.lineas.length) {
        d.geo.lineas.forEach(par2 => { s += polilineaDXF(capa, par2, proj, false); });
      } else if (d.geo.anillo && d.geo.anillo.length >= 3) {
        s += polilineaDXF(capa, d.geo.anillo, proj, true);
      } else if (d.geo.radioM) {
        // Aquí sí va CIRCLE de verdad, no un polígono: en CAD un círculo es
        // una entidad con centro y radio, editable y acotable como tal.
        d.geo.puntos.forEach(function (p) {
          const q = proj(p);
          s += par(0,'CIRCLE') + par(8, capa) + par(10, q.x.toFixed(3)) +
               par(20, q.y.toFixed(3)) + par(30, 0) + par(40, d.geo.radioM.toFixed(2));
        });
      }
    }

    // Cada punto mapeado, en la capa de su categoría, con su nombre al lado.
    d.puntos.forEach(function (p) {
      const q = proj(p), capa = 'PTS_' + p.gid.toUpperCase();
      s += par(0,'POINT') + par(8, capa) + par(10, q.x.toFixed(3)) + par(20, q.y.toFixed(3)) + par(30, 0);
      s += par(0,'TEXT') + par(8, capa) + par(10, (q.x + 1.5).toFixed(3)) + par(20, q.y.toFixed(3)) +
           par(30, 0) + par(40, 2.5) + par(1, String(p.nombre).slice(0, 60));
    });

    // Un texto con el sistema de coordenadas, dentro del propio dibujo: el DXF
    // no tiene campo para declararlo, y sin saber el EPSG nadie puede alinear
    // esto con otra cartografía. Va abajo del área, fuera del contorno.
    const q0 = proj(d.pts.reduce((a, p) => (p.lat < a.lat ? p : a), d.pts[0]));
    s += par(0,'TEXT') + par(8,'URBIS_INFO') + par(10, q0.x.toFixed(3)) +
         par(20, (q0.y - 12).toFixed(3)) + par(30, 0) + par(40, 3) +
         par(1, 'URBIS Pro City · UTM zona ' + proj.zona + proj.hemisferio +
                ' WGS84 (EPSG:' + proj.epsg + ') · unidades: metros');
    s += par(0,'ENDSEC') + par(0,'EOF');
    return s;
  }

  // ── GeoJSON ─────────────────────────────────────────────────────────────
  // El formato que abre TODO lo demás (QGIS, ArcGIS, Mapbox, Python). Va en
  // WGS84 con lat/lng tal cual, que es lo que manda la especificación.
  function construirGeoJSON(d){
    const f = [];
    f.push({ type:'Feature',
      properties:{ capa:'area', nombre: window.__pcaNombreArea || 'Área de análisis',
                   area_m2: Math.round(d.areaM2), perimetro_m: Math.round(d.perimetroM) },
      geometry:{ type:'Polygon', coordinates:[ anilloCerrado(d.pts, true).map(p => [+p.lng.toFixed(7), +p.lat.toFixed(7)]) ] } });

    d.cobertura.forEach(function (c, i) {
      f.push({ type:'Feature',
        properties:{ capa:'cobertura', clase:c.clase, etiqueta: ETQ_CLASE[c.clase] || c.clase,
                     area_m2:c.m2, color:c.color, id:i + 1 },
        geometry:{ type:'Polygon', coordinates: [anilloCerrado(c.contorno, false)].concat(
                     (c.huecos || []).map(h => anilloCerrado(h, false))) } });
    });

    if (d.geo && d.geo.puntos.length) {
      if (d.geo.lineas && d.geo.lineas.length) {
        f.push({ type:'Feature',
          properties:{ capa:'geometria', tipo:d.geo.tipo, nombre:d.geo.nombre,
                       filtro:d.geo.filtro, conexiones:d.geo.lineas.length },
          geometry:{ type:'MultiLineString',
            coordinates: d.geo.lineas.map(par2 => par2.map(p => [+p.lng.toFixed(7), +p.lat.toFixed(7)])) } });
      } else if (d.geo.anillo && d.geo.anillo.length >= 3) {
        f.push({ type:'Feature', properties:{ capa:'geometria', tipo:d.geo.tipo, nombre:d.geo.nombre, filtro:d.geo.filtro },
          geometry:{ type:'Polygon', coordinates:[ anilloCerrado(d.geo.anillo, true).map(p => [+p.lng.toFixed(7), +p.lat.toFixed(7)]) ] } });
      } else if (d.geo.radioM) {
        f.push({ type:'Feature',
          properties:{ capa:'geometria', tipo:d.geo.tipo, nombre:d.geo.nombre, radio_m:d.geo.radioM, filtro:d.geo.filtro },
          geometry:{ type:'MultiPolygon',
            coordinates: d.geo.puntos.map(p => [circuloComoPoligono(p, d.geo.radioM)]) } });
      }
    }

    d.puntos.forEach(function (p) {
      f.push({ type:'Feature',
        properties:{ capa:'puntos', nombre:p.nombre, categoria:p.grupo, gid:p.gid },
        geometry:{ type:'Point', coordinates:[+p.lng.toFixed(7), +p.lat.toFixed(7)] } });
    });

    return JSON.stringify({ type:'FeatureCollection',
      crs:{ type:'name', properties:{ name:'urn:ogc:def:crs:OGC:1.3:CRS84' } },
      features:f }, null, 1);
  }

  // Archivo de mundo (.pgw): las seis líneas que le dicen a CAD o GIS dónde va
  // y cuánto mide cada píxel de la imagen que lo acompaña. Sin él, el PNG es
  // solo un dibujo; con él, se pega georreferenciado.
  // ── SVG ─────────────────────────────────────────────────────────────────
  //
  // Para CorelDRAW, Illustrator, Inkscape o Figma. El DXF también lo abren
  // varios de ellos, pero mal: pierden el relleno, no entienden las capas y
  // dejan las polilíneas sueltas. SVG es su idioma, así que ahí sí llega todo
  // —relleno translúcido, huecos y agrupación por capa— listo para editar.
  //
  // El dibujo va en METROS a escala 1:1000 (1 mm de lámina = 1 m de terreno),
  // con el eje Y invertido porque en SVG crece hacia abajo y en el terreno
  // hacia arriba. Así una medición sobre el archivo sigue significando algo.
  const SVG_ESCALA = 1000;   // 1 unidad SVG (mm) = 1 m / 1000
  function construirSVG(d){
    const proj = proyectorUTM(d.pts);
    const q = d.pts.map(proj);
    const minX = Math.min.apply(null, q.map(p => p.x)), maxX = Math.max.apply(null, q.map(p => p.x));
    const minY = Math.min.apply(null, q.map(p => p.y)), maxY = Math.max.apply(null, q.map(p => p.y));
    const margen = 8;
    const W = (maxX - minX) + margen * 2, H = (maxY - minY) + margen * 2;
    // Terreno → lámina: se traslada al origen y se voltea la Y.
    const X = p => (proj(p).x - minX + margen).toFixed(2);
    const Y = p => (maxY - proj(p).y + margen).toFixed(2);
    const camino = (anillo, esLatLng) => anillo.map(function (pt, k) {
      const p = esLatLng ? pt : { lat: pt[1], lng: pt[0] };
      return (k ? 'L' : 'M') + X(p) + ' ' + Y(p);
    }).join('') + 'Z';

    let capas = '';

    if (d.cobertura.length) {
      const porClase = {};
      d.cobertura.forEach(c => { (porClase[c.clase] = porClase[c.clase] || []).push(c); });
      capas += Object.keys(porClase).map(function (cl) {
        const lista = porClase[cl];
        const col = lista[0].color;
        // fill-rule evenodd es lo que hace que los huecos se vean como huecos
        // y no como manchas encima.
        return '<g id="cobertura-' + esc(cl) + '" inkscape:label="Cobertura · ' + esc(ETQ_CLASE[cl] || cl) +
          '" inkscape:groupmode="layer" fill="' + col + '" fill-opacity="0.45" fill-rule="evenodd" ' +
          'stroke="' + col + '" stroke-width="0.4">' +
          lista.map(function (c) {
            return '<path d="' + camino(c.contorno, false) +
              (c.huecos || []).map(h => camino(h, false)).join('') + '"/>';
          }).join('') + '</g>';
      }).join('');
    }

    if (d.geo && d.geo.puntos.length) {
      const g = d.geo;
      let cuerpo = '';
      if (g.lineas && g.lineas.length) {
        cuerpo = g.lineas.map(par2 => '<line x1="' + X(par2[0]) + '" y1="' + Y(par2[0]) +
          '" x2="' + X(par2[1]) + '" y2="' + Y(par2[1]) + '"/>').join('');
      } else if (g.tipo === 'hull' && g.anillo && g.anillo.length >= 3) {
        cuerpo = '<path d="' + camino(g.anillo, true) + '" fill="' + g.color + '" fill-opacity="0.12"/>';
      } else if (g.tipo === 'circulos') {
        cuerpo = g.puntos.map(p => '<circle cx="' + X(p) + '" cy="' + Y(p) + '" r="' +
          g.radioM.toFixed(1) + '" fill="' + g.color + '" fill-opacity="0.12"/>').join('');
      }
      capas += '<g id="geometria" inkscape:label="' + esc(g.nombre) + '" inkscape:groupmode="layer" ' +
        'stroke="' + g.color + '" stroke-width="0.9" fill="none">' + cuerpo + '</g>';
    }

    if (d.puntos.length) {
      const ctx = ctxPC();
      capas += '<g id="puntos" inkscape:label="Puntos mapeados" inkscape:groupmode="layer">' +
        d.puntos.map(function (p) {
          const col = (ctx && ctx.colorGrupo && ctx.colorGrupo[p.gid]) || '#6b70e0';
          return '<circle cx="' + X(p) + '" cy="' + Y(p) + '" r="1.6" fill="' + col + '">' +
                 '<title>' + esc(p.nombre + ' · ' + p.grupo) + '</title></circle>';
        }).join('') + '</g>';
    }

    const contorno = '<g id="area" inkscape:label="Área analizada" inkscape:groupmode="layer">' +
      '<path d="' + camino(d.pts, true) + '" fill="none" stroke="#0E86BE" stroke-width="1.2"/></g>';

    const ha = Math.round(d.areaM2 / 100) / 100;
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" ' +
      'width="' + (W / SVG_ESCALA * 1000).toFixed(1) + 'mm" height="' + (H / SVG_ESCALA * 1000).toFixed(1) + 'mm" ' +
      'viewBox="0 0 ' + W.toFixed(1) + ' ' + H.toFixed(1) + '">' +
      '<title>' + esc(window.__pcaNombreArea || 'Área de análisis URBIS') + '</title>' +
      '<desc>' + esc('URBIS Pro City · ' + ha + ' ha · escala 1:' + SVG_ESCALA +
        ' (1 unidad = 1 m) · UTM zona ' + proj.zona + proj.hemisferio + ' WGS84, EPSG:' + proj.epsg) + '</desc>' +
      capas + contorno + '</svg>';
  }

  // Archivo de mundo en METROS UTM, para insertar la imagen en CAD junto al
  // DXF. No basta con convertir el tamaño de píxel: la imagen está alineada al
  // norte GEOGRÁFICO y el plano UTM está alineado a su meridiano central, y
  // entre ambos hay un giro (la convergencia de meridianos) que a 440 m de
  // lado ya vale casi dos metros — suficiente para que un plano no cierre.
  // Por eso se ajusta una transformación afín completa, con sus términos de
  // rotación, a partir de las esquinas reales proyectadas.
  function construirWorldFileUTM(limites, w, h){
    const s = limites[0][0], o = limites[0][1], n = limites[1][0], e = limites[1][1];
    const zona = zonaUTM((o + e) / 2);
    const P = (lat, lng) => aUTM(lat, lng, zona);
    // Centros del píxel superior izquierdo, del de su derecha y del de abajo:
    // con esos tres queda definida la afín.
    const px = (e - o) / w, py = (n - s) / h;
    const c00 = P(n - py / 2, o + px / 2);
    const c10 = P(n - py / 2, o + px * 1.5);
    const c01 = P(n - py * 1.5, o + px / 2);
    return [
      (c10.x - c00.x).toFixed(10),   // A · cuánto avanza X por columna
      (c10.y - c00.y).toFixed(10),   // D · cuánto avanza Y por columna (el giro)
      (c01.x - c00.x).toFixed(10),   // B · cuánto avanza X por fila (el giro)
      (c01.y - c00.y).toFixed(10),   // E · cuánto avanza Y por fila (negativo)
      c00.x.toFixed(4),              // C · X del centro del primer píxel
      c00.y.toFixed(4)               // F · Y del centro del primer píxel
    ].join('\n') + '\n';
  }

  function construirWorldFile(limites, w, h){
    const s = limites[0][0], o = limites[0][1], n = limites[1][0], e = limites[1][1];
    const px = (e - o) / w, py = (n - s) / h;
    return [px.toFixed(12), '0.0', '0.0', (-py).toFixed(12),
            (o + px / 2).toFixed(10), (n - py / 2).toFixed(10)].join('\n') + '\n';
  }

  // ── Salida ──────────────────────────────────────────────────────────────

  // Las dos imágenes del análisis, listas para meterse en un ZIP. Van juntas a
  // propósito: la clasificada sirve para ver el resultado y la satelital para
  // contrastarlo contra la foto de la que salió.
  function imagenesDelRaster(d){
    const out = [];
    if (!d.raster) return out;
    if (d.raster.overlayImagen) out.push({ nombre:'cobertura.png', datos: bytesDeDataURL(d.raster.overlayImagen) });
    if (d.raster.imagen)        out.push({ nombre:'satelital.png', datos: bytesDeDataURL(d.raster.imagen) });
    return out;
  }

  function kmzDe(d){
    const entradas = [{ nombre:'doc.kml', datos: construirKML(d, { imagenes: true }) }]
      .concat(imagenesDelRaster(d));
    return zip(entradas, 'application/vnd.google-earth.kmz');
  }

  function leeme(d){
    const proj = proyectorUTM(d.pts);
    const ha = Math.round(d.areaM2 / 100) / 100;
    return [
      'URBIS Pro City · paquete de exportación',
      '========================================',
      '',
      'Área: ' + (window.__pcaNombreArea || 'sin nombre'),
      'Superficie: ' + ha + ' ha (' + Math.round(d.areaM2).toLocaleString('es-CO') + ' m²)',
      'Perímetro: ' + Math.round(d.perimetroM) + ' m',
      'Puntos mapeados: ' + d.puntos.length,
      d.geo ? 'Geometría: ' + d.geo.nombre + ' sobre ' + d.geo.filtro : 'Geometría: ninguna activa',
      d.cobertura.length ? 'Cobertura: ' + d.cobertura.length + ' polígonos vectorizados'
                         : 'Cobertura: no se analizó',
      '',
      'QUÉ TRAE CADA ARCHIVO',
      '---------------------',
      'area.kmz        Google Earth. Trae todo por capas, que se prenden y apagan:',
      '                el área, los puntos, la geometría y la cobertura como',
      '                polígonos translúcidos, con el satelital de Google debajo.',
      '                Adentro van también las dos imágenes por si se quieren ver',
      '                clavadas sobre el terreno (nacen apagadas).',
      '',
      'cad/area.dxf    AutoCAD y afines. TODO en vectores, por capas, en metros.',
      '                Coordenadas UTM zona ' + proj.zona + proj.hemisferio + ' WGS84 — EPSG:' + proj.epsg + '.',
      '                Al abrirlo, 1 unidad = 1 metro y el dibujo cae en su sitio',
      '                real del mundo, así que se le puede superponer cartografía',
      '                oficial sin moverlo. Los círculos de impacto van como',
      '                entidad CIRCLE, acotable como tal.',
      '',
      'area.svg        CorelDRAW, Illustrator, Inkscape, Figma. Vectores por capas,',
      '                con relleno y huecos, a escala 1:1000 (1 mm = 1 m). Es el',
      '                formato para MAQUETAR el plano; para medir y acotar, el DXF.',
      '',
      'area.geojson    QGIS, ArcGIS, Python, web. WGS84 (CRS84). Cada elemento',
      '                lleva sus atributos: clase de cobertura, área en m²,',
      '                categoría del punto, filtro con que se generó la geometría.',
      '',
      'satelital.png   La foto que se clasificó, ya sin velo de bruma.',
      'satelital.pgw   Su archivo de mundo EN GRADOS: arrastra el PNG a QGIS y cae',
      '                georreferenciado solo.',
      'cobertura.png   El resultado de la clasificación, mismo encuadre.',
      'cobertura.pgw   Ídem para la clasificada.',
      '',
      'cad/            Los mismos PNG pero con archivo de mundo EN METROS UTM,',
      '                que es lo que AutoCAD necesita para que la imagen caiga',
      '                encima del DXF y a escala. Incluye el giro entre el norte',
      '                geográfico y el de la cuadrícula UTM, que a esta escala',
      '                ya vale casi dos metros.',
      '',
      'CÓMO SE HIZO LA COBERTURA',
      '-------------------------',
      'Clasificación por color de imagen satelital, no NDVI: no lleva banda',
      'infrarroja y no sustituye un estudio ambiental certificado. Se leyó la',
      'foto ' + (d.raster && d.raster.pasadas ? d.raster.pasadas : 3) + ' veces a distinta resolución y se cruzaron las lecturas.',
      'Sirve para dimensionar y comparar sectores.',
      '',
      'Los polígonos de cobertura son una generalización de la rejilla de',
      'análisis: el borde real es difuso a nivel de píxel, así que están',
      'simplificados. Las superficies son aproximadas.',
      '',
      'Generado el ' + new Date().toLocaleString('es-CO') + '.'
    ].join('\n');
  }

  // El paquete completo: un solo archivo con todo, que es lo que de verdad se
  // necesita para entregar un trabajo. Antes había que exportar formato por
  // formato y armarlo a mano.
  function paqueteCompleto(d){
    const entradas = [
      { nombre:'LEEME.txt',     datos: leeme(d) },
      { nombre:'area.geojson',  datos: construirGeoJSON(d) },
      { nombre:'area.svg',      datos: construirSVG(d) },
      { nombre:'cad/area.dxf',  datos: construirDXF(d) }
    ];
    // El KMZ entra como archivo dentro del paquete: así se abre en Google Earth
    // con doble clic, sin tener que desempaquetar nada más.
    entradas.push({ nombre:'area.kmz', datos: new Uint8Array(0), blobKMZ: kmzDe(d) });
    const imgs = imagenesDelRaster(d);
    entradas.push.apply(entradas, imgs);
    if (d.raster && d.raster.overlayLimites) {
      const L = d.raster.overlayLimites;
      const dims = d.raster.malla ? String(d.raster.malla).split('×') : null;
      const w = dims ? parseInt(dims[0], 10) : 1440, h = dims ? parseInt(dims[1], 10) : 1440;
      const hayCob = imgs.some(i => i.nombre === 'cobertura.png');
      const haySat = imgs.some(i => i.nombre === 'satelital.png');
      // En la raíz, los archivos de mundo en GRADOS: es lo que espera un GIS,
      // que trabaja en WGS84 y los detecta solo al arrastrar el PNG.
      if (hayCob) entradas.push({ nombre:'cobertura.pgw', datos: construirWorldFile(L, w, h) });
      if (haySat) entradas.push({ nombre:'satelital.pgw', datos: construirWorldFile(L, w, h) });
      // En cad/, los mismos PNG con archivos de mundo en METROS UTM, que es lo
      // que necesita AutoCAD para que la imagen caiga encima del DXF y a
      // escala. Se duplican los PNG a propósito: un archivo de mundo solo vale
      // si está al lado de su imagen y con su mismo nombre.
      imgs.forEach(function (im) {
        entradas.push({ nombre: 'cad/' + im.nombre, datos: im.datos });
        entradas.push({ nombre: 'cad/' + im.nombre.replace('.png', '.pgw'),
                        datos: construirWorldFileUTM(L, w, h) });
      });
    }
    // El KMZ hay que leerlo como bytes antes de re-empaquetarlo.
    const kmzEntrada = entradas.find(e => e.blobKMZ);
    return kmzEntrada.blobKMZ.arrayBuffer().then(function (buf) {
      kmzEntrada.datos = new Uint8Array(buf);
      delete kmzEntrada.blobKMZ;
      return zip(entradas, 'application/zip');
    });
  }

  function exportar(formato){
    const d = recolectar();
    if (!d) { alert('Primero dibuja y cierra un área para exportarla.'); return false; }
    try {
      if (formato === 'kmz') {
        descargar(kmzDe(d), nombreArchivo('area', 'kmz'));
      } else if (formato === 'kml') {
        descargar(new Blob([construirKML(d, {})], { type:'application/vnd.google-earth.kml+xml' }),
                  nombreArchivo('area', 'kml'));
      } else if (formato === 'dxf') {
        descargar(new Blob([construirDXF(d)], { type:'application/dxf' }),
                  nombreArchivo('area', 'dxf'));
      } else if (formato === 'svg') {
        descargar(new Blob([construirSVG(d)], { type:'image/svg+xml' }), nombreArchivo('area', 'svg'));
      } else if (formato === 'geojson') {
        descargar(new Blob([construirGeoJSON(d)], { type:'application/geo+json' }),
                  nombreArchivo('area', 'geojson'));
      } else if (formato === 'paquete') {
        paqueteCompleto(d).then(function (blob) {
          descargar(blob, nombreArchivo('paquete', 'zip'));
        }).catch(function (e) {
          alert('No se pudo armar el paquete: ' + (e && e.message || e));
        });
      } else return false;
      try { if (window.URBIS_PC_ANALITICA) window.URBIS_PC_ANALITICA.registrar('exportado-' + formato); } catch(e){}
      return true;
    } catch(e) {
      alert('No se pudo generar el archivo: ' + (e && e.message || e));
      return false;
    }
  }

  // Qué hay disponible ahora mismo, para decirlo en el panel en vez de que el
  // usuario descubra al abrir el archivo que le faltaba analizar la cobertura.
  function inventario(){
    const d = recolectar();
    if (!d) return null;
    return {
      puntos: d.puntos.length,
      geo: d.geo ? d.geo.nombre : null,
      cobertura: d.cobertura.length,
      imagenes: !!(d.raster && d.raster.overlayImagen)
    };
  }

  function bloque(){
    const inv = inventario();
    const trae = inv ? [
      inv.puntos + ' punto' + (inv.puntos === 1 ? '' : 's'),
      inv.geo ? inv.geo.replace(/^\S+\s/, '') : null,
      inv.cobertura ? 'cobertura en ' + inv.cobertura + ' polígonos' : null
    ].filter(Boolean).join(' · ') : '';
    const falta = inv && !inv.cobertura
      ? '<p class="pca-exp-falta">Todavía no analizaste la cobertura del suelo: si lo haces antes de exportar, ' +
        'los archivos saldrán también con las manchas de vegetación y superficie dura como polígonos.</p>' : '';

    return '<div class="pca-exp-geo">' +
      '<h4 class="pca-h pca-h-geoexp">🌍 Llevar el área a otro programa</h4>' +
      '<p class="pca-exp-ayuda">Sale <b>todo georreferenciado y en vectores</b>: el contorno, los puntos, ' +
        'la geometría generada y las manchas de cobertura como polígonos de verdad — editables y acotables, ' +
        'no una imagen. El DXF va en <b>metros UTM reales</b>.</p>' +
      (trae ? '<p class="pca-exp-trae">Ahora mismo se llevaría: <b>' + esc(trae) + '</b>.</p>' : '') +
      falta +
      '<div class="pca-exp-btns">' +
        '<button type="button" class="pca-exp-todo" data-u52-call="pca-exp-paquete">📦 Paquete completo (ZIP)</button>' +
        '<button type="button" data-u52-call="pca-exp-kmz">🌍 KMZ · Google Earth</button>' +
        '<button type="button" data-u52-call="pca-exp-dxf">📐 DXF · AutoCAD</button>' +
        '<button type="button" data-u52-call="pca-exp-geojson">🗺️ GeoJSON · QGIS</button>' +
        '<button type="button" data-u52-call="pca-exp-svg">🎨 SVG · Corel / Illustrator</button>' +
        '<button type="button" data-u52-call="pca-exp-kml" class="pca-exp-sec">KML suelto</button>' +
      '</div></div>';
  }

  function accion(name){
    if (name === 'exp-paquete') { exportar('paquete'); return true; }
    if (name === 'exp-kmz') { exportar('kmz'); return true; }
    if (name === 'exp-dxf') { exportar('dxf'); return true; }
    if (name === 'exp-kml') { exportar('kml'); return true; }
    if (name === 'exp-geojson') { exportar('geojson'); return true; }
    if (name === 'exp-svg') { exportar('svg'); return true; }
    return false;
  }

  window.URBIS_PC_EXPORTAR = { exportar, bloque, accion, inventario, recolectar,
                               construirKML, construirDXF, construirGeoJSON, construirSVG,
                               vectorizarCobertura, aUTM, zip, paqueteCompleto };
})();
