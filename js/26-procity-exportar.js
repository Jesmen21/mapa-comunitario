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
    return { pts, puntos: dentro, areaM2: pc.areaM2(pts), perimetroM: pc.perimetroM(pts, true) };
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

  function construirKML(d){
    const ctx = ctxPC();
    const colorDe = gid => (ctx && ctx.colorGrupo && ctx.colorGrupo[gid]) || '#6b70e0';
    const gruposUsados = [];
    d.puntos.forEach(p => { if (gruposUsados.indexOf(p.gid) === -1) gruposUsados.push(p.gid); });

    const estilos = gruposUsados.map(gid =>
      '<Style id="g_' + esc(gid) + '"><IconStyle><color>' + kmlColor(colorDe(gid)) + '</color>' +
      '<scale>1.0</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>' +
      '</IconStyle></Style>').join('');

    // El contorno se cierra repitiendo el primer vértice, como exige KML.
    const anillo = d.pts.concat([d.pts[0]])
      .map(p => p.lng.toFixed(7) + ',' + p.lat.toFixed(7) + ',0').join(' ');

    const marcas = d.puntos.map(p =>
      '<Placemark><name>' + esc(p.nombre) + '</name>' +
      '<description>' + esc(p.grupo) + '</description>' +
      '<styleUrl>#g_' + esc(p.gid) + '</styleUrl>' +
      '<Point><coordinates>' + p.lng.toFixed(7) + ',' + p.lat.toFixed(7) + ',0</coordinates></Point>' +
      '</Placemark>').join('');

    const ha = Math.round(d.areaM2 / 100) / 100;
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>' +
      '<name>' + esc(window.__pcaNombreArea || 'Área de análisis URBIS') + '</name>' +
      '<description>' + esc('Área: ' + ha + ' ha · Perímetro: ' + Math.round(d.perimetroM) +
        ' m · ' + d.puntos.length + ' puntos mapeados. Generado por URBIS Pro City.') + '</description>' +
      estilos +
      '<Style id="areaUrbis"><LineStyle><color>' + kmlColor('#0E86BE') + '</color><width>3</width></LineStyle>' +
      '<PolyStyle><color>' + kmlColor('#34CCFE', '40') + '</color></PolyStyle></Style>' +
      '<Placemark><name>Área analizada</name><styleUrl>#areaUrbis</styleUrl>' +
      '<Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing>' +
      '<coordinates>' + anillo + '</coordinates>' +
      '</LinearRing></outerBoundaryIs></Polygon></Placemark>' +
      (marcas ? '<Folder><name>Puntos mapeados (' + d.puntos.length + ')</name>' + marcas + '</Folder>' : '') +
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

  function zipUnArchivo(nombre, texto){
    const datos = new TextEncoder().encode(texto);
    const nom = new TextEncoder().encode(nombre);
    const crc = crc32(datos);
    const n = datos.length;

    const cab = [];
    const u16 = v => { cab.push(v & 0xFF, (v >>> 8) & 0xFF); };
    const u32 = v => { cab.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF); };

    // Cabecera local
    u32(0x04034b50); u16(20); u16(0); u16(0);   // firma, versión, flags, método 0 = store
    u16(0); u16(0);                              // hora y fecha (irrelevantes)
    u32(crc); u32(n); u32(n);
    u16(nom.length); u16(0);
    const cabLocal = new Uint8Array(cab.concat(Array.from(nom)));

    // Directorio central
    const c2 = [];
    const c16 = v => { c2.push(v & 0xFF, (v >>> 8) & 0xFF); };
    const c32 = v => { c2.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF); };
    c32(0x02014b50); c16(20); c16(20); c16(0); c16(0);
    c16(0); c16(0);
    c32(crc); c32(n); c32(n);
    c16(nom.length); c16(0); c16(0); c16(0); c16(0); c32(0); c32(0);
    const dirCentral = new Uint8Array(c2.concat(Array.from(nom)));

    // Fin del directorio
    const f = [];
    const f16 = v => { f.push(v & 0xFF, (v >>> 8) & 0xFF); };
    const f32 = v => { f.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF); };
    f32(0x06054b50); f16(0); f16(0); f16(1); f16(1);
    f32(dirCentral.length); f32(cabLocal.length + n); f16(0);
    const fin = new Uint8Array(f);

    return new Blob([cabLocal, datos, dirCentral, fin], { type:'application/vnd.google-earth.kmz' });
  }

  // ── DXF ─────────────────────────────────────────────────────────────────

  // Proyección local a metros: equirectangular alrededor del centroide. A
  // escala de barrio el error es de centímetros, y a cambio el dibujo abre en
  // AutoCAD con 1 unidad = 1 metro.
  function proyector(pts){
    const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
    const lng0 = pts.reduce((a, p) => a + p.lng, 0) / pts.length;
    const rad = Math.PI / 180;
    const mx = R_TIERRA * Math.cos(lat0 * rad) * rad;
    const my = R_TIERRA * rad;
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

  function construirDXF(d){
    const proj = proyector(d.pts);
    const capas = ['AREA_ANALISIS'];
    d.puntos.forEach(p => { const c = 'PTS_' + p.gid.toUpperCase(); if (capas.indexOf(c) === -1) capas.push(c); });

    let s = '';
    // HEADER: $INSUNITS = 6 declara METROS, para que AutoCAD no pregunte.
    s += par(0,'SECTION') + par(2,'HEADER') +
         par(9,'$INSUNITS') + par(70, 6) +
         par(9,'$MEASUREMENT') + par(70, 1) +
         par(0,'ENDSEC');
    // TABLES: las capas declaradas.
    s += par(0,'SECTION') + par(2,'TABLES') + par(0,'TABLE') + par(2,'LAYER') + par(70, capas.length);
    s += capaDXF('AREA_ANALISIS', 5);
    capas.slice(1).forEach(c => {
      const gid = c.replace('PTS_', '').toLowerCase();
      s += capaDXF(c, ACI[gid] || 7);
    });
    s += par(0,'ENDTAB') + par(0,'ENDSEC');

    // ENTITIES
    s += par(0,'SECTION') + par(2,'ENTITIES');
    // El contorno como polilínea cerrada.
    s += par(0,'LWPOLYLINE') + par(8,'AREA_ANALISIS') + par(100,'AcDbEntity') +
         par(90, d.pts.length) + par(70, 1);
    d.pts.forEach(p => { const q = proj(p); s += par(10, q.x.toFixed(3)) + par(20, q.y.toFixed(3)); });
    // Cada punto mapeado, en la capa de su categoría, con su nombre al lado.
    d.puntos.forEach(p => {
      const q = proj(p), capa = 'PTS_' + p.gid.toUpperCase();
      s += par(0,'POINT') + par(8, capa) + par(10, q.x.toFixed(3)) + par(20, q.y.toFixed(3)) + par(30, 0);
      s += par(0,'TEXT') + par(8, capa) + par(10, (q.x + 1.5).toFixed(3)) + par(20, q.y.toFixed(3)) +
           par(30, 0) + par(40, 2.5) + par(1, String(p.nombre).slice(0, 60));
    });
    s += par(0,'ENDSEC') + par(0,'EOF');
    return s;
  }

  // ── Salida ──────────────────────────────────────────────────────────────

  function exportar(formato){
    const d = recolectar();
    if (!d) { alert('Primero dibuja y cierra un área para exportarla.'); return false; }
    try {
      if (formato === 'kmz') {
        descargar(zipUnArchivo('doc.kml', construirKML(d)), nombreArchivo('area', 'kmz'));
      } else if (formato === 'kml') {
        descargar(new Blob([construirKML(d)], { type:'application/vnd.google-earth.kml+xml' }),
                  nombreArchivo('area', 'kml'));
      } else if (formato === 'dxf') {
        descargar(new Blob([construirDXF(d)], { type:'application/dxf' }),
                  nombreArchivo('area', 'dxf'));
      } else return false;
      try { if (window.URBIS_PC_ANALITICA) window.URBIS_PC_ANALITICA.registrar('exportado-' + formato); } catch(e){}
      return true;
    } catch(e) {
      alert('No se pudo generar el archivo: ' + (e && e.message || e));
      return false;
    }
  }

  function bloque(){
    return '<div class="pca-exp-geo">' +
      '<h4 class="pca-h pca-h-geoexp">🌍 Llevar el área a otro programa</h4>' +
      '<p class="pca-exp-ayuda">Exporta el contorno y los puntos mapeados para seguir trabajando ' +
        'en Google Earth o en AutoCAD. El DXF sale en <b>metros reales</b>, listo para acotar.</p>' +
      '<div class="pca-exp-btns">' +
        '<button type="button" data-u52-call="pca-exp-kmz">🌍 KMZ · Google Earth</button>' +
        '<button type="button" data-u52-call="pca-exp-dxf">📐 DXF · AutoCAD</button>' +
        '<button type="button" data-u52-call="pca-exp-kml" class="pca-exp-sec">KML suelto</button>' +
      '</div></div>';
  }

  function accion(name){
    if (name === 'exp-kmz') { exportar('kmz'); return true; }
    if (name === 'exp-dxf') { exportar('dxf'); return true; }
    if (name === 'exp-kml') { exportar('kml'); return true; }
    return false;
  }

  window.URBIS_PC_EXPORTAR = { exportar, bloque, accion, construirKML, construirDXF, recolectar };
})();
