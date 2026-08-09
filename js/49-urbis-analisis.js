/* ============================================================================
   URBIS · ANÁLISIS — la "cabeza" de URBIS: estación de análisis urbano para PC.
   Para estudiantes, planeadores y alcaldías: dibujar polígonos sobre el mapa,
   cuantificar el sector (matriz de usos), analizar la capa verde desde los
   píxeles del satelital, listar reportes históricos (accidentes/riesgos),
   comparar construido vs verde vs social, exportar CSV e imprimir informe.

   PARTE 1 — Motor puro (geometría + clasificación + píxeles), testeable.
   PARTE 2 — Estación de trabajo (toolbar + panel de resultados sobre Leaflet).

   Datos: lee `globalData` (let global de js/02, por NOMBRE directo) y la matriz
   `dimensiones` (js/04, scope compartido). El mapa es el const global `map`.
   ============================================================================ */
(function () {
  'use strict';

  // ========================= PARTE 1 · MOTOR PURO ==========================
  var R_TIERRA = 6371000;
  function toRad(d) { return d * Math.PI / 180; }

  function haversineM(a, b) {
    if (!a || !b) return 0;
    var dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R_TIERRA * Math.asin(Math.sqrt(s));
  }

  // Área del polígono en m² (shoelace sobre proyección equirectangular local).
  function polygonAreaM2(pts) {
    if (!pts || pts.length < 3) return 0;
    var midLat = 0; pts.forEach(function (p) { midLat += p.lat; }); midLat /= pts.length;
    var k = Math.cos(toRad(midLat));
    var s = 0;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      var xa = R_TIERRA * toRad(a.lng) * k, ya = R_TIERRA * toRad(a.lat);
      var xb = R_TIERRA * toRad(b.lng) * k, yb = R_TIERRA * toRad(b.lat);
      s += xa * yb - xb * ya;
    }
    return Math.abs(s / 2);
  }

  function perimeterM(pts) {
    if (!pts || pts.length < 2) return 0;
    var d = 0;
    for (var i = 0; i < pts.length; i++) d += haversineM(pts[i], pts[(i + 1) % pts.length]);
    return d;
  }

  // Punto dentro de polígono (ray casting; x=lng, y=lat).
  function pointInPolygon(pt, poly) {
    if (!poly || poly.length < 3) return false;
    var dentro = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i].lng, yi = poly[i].lat, xj = poly[j].lng, yj = poly[j].lat;
      var corta = ((yi > pt.lat) !== (yj > pt.lat)) &&
        (pt.lng < (xj - xi) * (pt.lat - yi) / ((yj - yi) || 1e-12) + xi);
      if (corta) dentro = !dentro;
    }
    return dentro;
  }

  function parseNum(v) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? null : n; }

  // Filtra los puntos de la base comunitaria que caen dentro del polígono.
  function puntosEnPoligono(data, poly) {
    var out = [];
    (Array.isArray(data) ? data : []).forEach(function (p) {
      if (!p) return;
      if (typeof window !== 'undefined' && typeof window.esFilaMetaUrbis === 'function' && window.esFilaMetaUrbis(p)) return;
      var lat = parseNum(p.lat), lng = parseNum(p.lng);
      if (lat === null || lng === null) return;
      if (pointInPolygon({ lat: lat, lng: lng }, poly)) out.push(p);
    });
    return out;
  }

  // ---- Matriz de usos: macro-capas urbanas (clasificación por nombre de tipo) ----
  var CAPAS_URBANAS = [
    { id: 'vivienda',   nombre: 'Vivienda',                icono: '🏠', color: '#7f8c8d', re: /vivienda|residencial/i },
    { id: 'comercio',   nombre: 'Comercio y servicios',    icono: '🏪', color: '#f39c12', re: /comercio|negocio|servicio(?!s ocultos)/i },
    { id: 'verde',      nombre: 'Áreas verdes y ambiente', icono: '🌳', color: '#27ae60', re: /verde|ambient|parque/i },
    { id: 'deporte',    nombre: 'Áreas deportivas',        icono: '⚽', color: '#e67e22', re: /deportiv/i },
    { id: 'equipam',    nombre: 'Equipamientos',           icono: '🏛️', color: '#2c3e50', re: /equipamiento|salud|patrimonio|turismo|educaci/i },
    { id: 'infra',      nombre: 'Infraestructura',         icono: '🚶', color: '#8e44ad', re: /infraestructura|peatonal|servicios ocultos|movilidad/i },
    { id: 'riesgo',     nombre: 'Alertas y riesgos',       icono: '🚨', color: '#e11d48', re: /alerta|riesgo/i },
    { id: 'transito',   nombre: 'Tráfico y accidentes',    icono: '🚗', color: '#e84118', re: /tr[aá]fico/i },
    { id: 'social',     nombre: 'Eventos y comunidad',     icono: '🎪', color: '#a45cff', re: /evento|comunitari/i },
    { id: 'otros',      nombre: 'Otros registros',         icono: '📍', color: '#64748b', re: null }
  ];
  function capaDeTipo(tipo) {
    var t = String(tipo || '');
    for (var i = 0; i < CAPAS_URBANAS.length - 1; i++) { if (CAPAS_URBANAS[i].re && CAPAS_URBANAS[i].re.test(t)) return CAPAS_URBANAS[i]; }
    return CAPAS_URBANAS[CAPAS_URBANAS.length - 1];
  }
  function subtipoDe(p) {
    var d = String((p && p.descripcion) || '').split(' | ')[0].trim();
    return d || String((p && p.tipo) || 'Sin detalle');
  }

  // Matriz de usos del sector: conteos por capa + subtipos + densidad por ha.
  function matrizDeUsos(data, poly) {
    var areaM2 = polygonAreaM2(poly), areaHa = areaM2 / 10000;
    var dentro = puntosEnPoligono(data, poly);
    var porCapa = {};
    dentro.forEach(function (p) {
      var c = capaDeTipo(p.tipo);
      if (!porCapa[c.id]) porCapa[c.id] = { capa: c, count: 0, subtipos: {} };
      porCapa[c.id].count++;
      var st = subtipoDe(p);
      porCapa[c.id].subtipos[st] = (porCapa[c.id].subtipos[st] || 0) + 1;
    });
    var capas = Object.keys(porCapa).map(function (id) {
      var e = porCapa[id];
      var subt = Object.keys(e.subtipos).map(function (n) { return { nombre: n, count: e.subtipos[n] }; })
        .sort(function (a, b) { return b.count - a.count; });
      return { id: id, nombre: e.capa.nombre, icono: e.capa.icono, color: e.capa.color, count: e.count, porHa: areaHa > 0 ? e.count / areaHa : 0, subtipos: subt };
    }).sort(function (a, b) { return b.count - a.count; });
    return { areaM2: areaM2, areaHa: areaHa, perimetroM: perimeterM(poly), total: dentro.length, capas: capas, puntos: dentro };
  }

  // Reportes de riesgo/tránsito históricos dentro del polígono (más recientes primero).
  function reportesRiesgo(data, poly) {
    var dentro = puntosEnPoligono(data, poly);
    return dentro.filter(function (p) { var id = capaDeTipo(p.tipo).id; return id === 'riesgo' || id === 'transito'; })
      .map(function (p) { return { subtipo: subtipoDe(p), tipo: String(p.tipo || ''), fecha: String(p.fecha || ''), lat: parseNum(p.lat), lng: parseNum(p.lng) }; })
      .sort(function (a, b) { return new Date(b.fecha || 0) - new Date(a.fecha || 0); });
  }

  // ---- Clasificación de píxeles del satelital ----
  // Verde (vegetación): índice ExG (Exceso de Verde) 2G-R-B con piso de verde.
  function esPixelVerde(r, g, b) { return (2 * g - r - b) > 40 && g > 50; }
  // Construido/suelo duro: brillo medio-alto con poca saturación (techos, pavimento).
  function esPixelConstruido(r, g, b) {
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    return max > 90 && (max - min) < 42 && !esPixelVerde(r, g, b);
  }
  // Analiza un buffer RGBA (solo píxeles con alpha>0 = dentro del polígono).
  function analizarPixeles(rgba, step) {
    step = step || 1;
    var tot = 0, verde = 0, constr = 0;
    for (var i = 0; i < rgba.length; i += 4 * step) {
      if (rgba[i + 3] < 10) continue;
      tot++;
      var r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      if (esPixelVerde(r, g, b)) verde++;
      else if (esPixelConstruido(r, g, b)) constr++;
    }
    var otros = tot - verde - constr;
    return {
      total: tot, verde: verde, construido: constr, otros: otros,
      pctVerde: tot ? verde / tot * 100 : 0, pctConstruido: tot ? constr / tot * 100 : 0, pctOtros: tot ? otros / tot * 100 : 0
    };
  }

  // ---- CSV (separador ; con BOM para Excel es-CO) ----
  function csvInforme(res, verde, reportes) {
    var L = [];
    var esc = function (s) { s = String(s == null ? '' : s); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    L.push('URBIS ANALISIS;;');
    L.push('Fecha;' + new Date().toLocaleString('es-CO') + ';');
    L.push('Area (m2);' + res.areaM2.toFixed(0) + ';');
    L.push('Area (ha);' + res.areaHa.toFixed(3) + ';');
    L.push('Perimetro (m);' + res.perimetroM.toFixed(0) + ';');
    L.push('Registros comunitarios;' + res.total + ';');
    if (verde) {
      L.push(';;');
      L.push('CAPA VERDE (pixeles satelital);;');
      L.push('Cobertura verde (%);' + verde.pctVerde.toFixed(1) + ';');
      L.push('Area verde estimada (m2);' + (res.areaM2 * verde.pctVerde / 100).toFixed(0) + ';');
      L.push('Construido/suelo duro (%);' + verde.pctConstruido.toFixed(1) + ';');
    }
    L.push(';;');
    L.push('MATRIZ DE USOS;Conteo;Densidad (por ha)');
    res.capas.forEach(function (c) {
      L.push(esc(c.nombre) + ';' + c.count + ';' + c.porHa.toFixed(2));
      c.subtipos.slice(0, 12).forEach(function (s) { L.push('   ' + esc(s.nombre) + ';' + s.count + ';'); });
    });
    if (reportes && reportes.length) {
      L.push(';;');
      L.push('REPORTES DE RIESGO/TRANSITO;Fecha;');
      reportes.slice(0, 60).forEach(function (r) { L.push(esc(r.subtipo) + ';' + esc(r.fecha) + ';'); });
    }
    return '﻿' + L.join('\r\n');
  }

  var Engine = {
    haversineM: haversineM, polygonAreaM2: polygonAreaM2, perimeterM: perimeterM,
    pointInPolygon: pointInPolygon, puntosEnPoligono: puntosEnPoligono, capaDeTipo: capaDeTipo,
    matrizDeUsos: matrizDeUsos, reportesRiesgo: reportesRiesgo,
    esPixelVerde: esPixelVerde, esPixelConstruido: esPixelConstruido, analizarPixeles: analizarPixeles,
    csvInforme: csvInforme, CAPAS_URBANAS: CAPAS_URBANAS
  };
  if (typeof window !== 'undefined') window.URBISAnalisis = Engine;
  if (typeof document === 'undefined') return;

  // ==================== PARTE 2 · ESTACIÓN DE TRABAJO ======================
  function getMap() { return (typeof map !== 'undefined' && map && map.getContainer) ? map : null; }
  function getData() {
    return (typeof globalData !== 'undefined' && Array.isArray(globalData)) ? globalData
      : (Array.isArray(window.globalData) ? window.globalData : []);
  }

  var W = {
    abierto: false, modo: null, verts: [], cerrado: false,
    grupo: null, tmp: null, overlayVerde: null, heatOn: false, heatCv: null, heatFn: null,
    resultado: null, verde: null, reportes: []
  };

  function fmtArea(m2) {
    if (m2 >= 10000) return (m2 / 10000).toFixed(2) + ' ha';
    return Math.round(m2).toLocaleString('es-CO') + ' m²';
  }

  // ---- Mercator/tiles (para la capa verde) ----
  function tileX(lng, z) { return (lng + 180) / 360 * Math.pow(2, z); }
  function tileY(lat, z) { var r = toRad(lat); return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z); }
  function tileYToLat(y, z) { var n = Math.PI - 2 * Math.PI * y / Math.pow(2, z); return 180 / Math.PI * Math.atan(Math.sinh(n)); }
  function tileXToLng(x, z) { return x / Math.pow(2, z) * 360 - 180; }

  function cargarTile(url) {
    return new Promise(function (res) {
      var im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = function () { res(im); };
      im.onerror = function () { res(null); };
      im.src = url;
    });
  }

  // Análisis de capa verde: baja tiles Esri del bbox, recorta al polígono y clasifica.
  function analizarVerdePoligono(poly, cb) {
    var lats = poly.map(function (p) { return p.lat; }), lngs = poly.map(function (p) { return p.lng; });
    var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
    var minLng = Math.min.apply(null, lngs), maxLng = Math.max.apply(null, lngs);
    var z = 19, tx0, tx1, ty0, ty1, nT;
    while (true) {
      tx0 = Math.floor(tileX(minLng, z)); tx1 = Math.floor(tileX(maxLng, z));
      ty0 = Math.floor(tileY(maxLat, z)); ty1 = Math.floor(tileY(minLat, z));
      nT = (tx1 - tx0 + 1) * (ty1 - ty0 + 1);
      if (nT <= 30 || z <= 15) break;
      z--;
    }
    var Wpx = (tx1 - tx0 + 1) * 256, Hpx = (ty1 - ty0 + 1) * 256;
    var cv = document.createElement('canvas'); cv.width = Wpx; cv.height = Hpx;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    // Recorte al polígono ANTES de dibujar: fuera del polígono queda alpha=0.
    var path = new Path2D();
    poly.forEach(function (p, i) {
      var px = (tileX(p.lng, z) - tx0) * 256, py = (tileY(p.lat, z) - ty0) * 256;
      i ? path.lineTo(px, py) : path.moveTo(px, py);
    });
    path.closePath();
    ctx.save(); ctx.clip(path);
    var jobs = [];
    for (var x = tx0; x <= tx1; x++) {
      for (var y = ty0; y <= ty1; y++) {
        (function (x, y) {
          jobs.push(cargarTile('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x)
            .then(function (im) { if (im) ctx.drawImage(im, (x - tx0) * 256, (y - ty0) * 256); }));
        })(x, y);
      }
    }
    Promise.all(jobs).then(function () {
      ctx.restore();
      var img;
      try { img = ctx.getImageData(0, 0, Wpx, Hpx); }
      catch (e) { cb(null, 'El proveedor satelital bloqueó la lectura de píxeles (CORS).'); return; }
      var res = analizarPixeles(img.data, 1);
      if (!res.total) { cb(null, 'El polígono es demasiado pequeño para el análisis de píxeles.'); return; }
      // Máscara visual: pinta SOLO los píxeles verdes detectados.
      var mk = document.createElement('canvas'); mk.width = Wpx; mk.height = Hpx;
      var mctx = mk.getContext('2d');
      var mimg = mctx.createImageData(Wpx, Hpx), d = img.data, o = mimg.data;
      for (var i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 10 && esPixelVerde(d[i], d[i + 1], d[i + 2])) { o[i] = 46; o[i + 1] = 230; o[i + 2] = 110; o[i + 3] = 165; }
      }
      mctx.putImageData(mimg, 0, 0);
      var bounds = [[tileYToLat(ty1 + 1, z), tileXToLng(tx0, z)], [tileYToLat(ty0, z), tileXToLng(tx1 + 1, z)]];
      cb({ stats: res, maskURL: mk.toDataURL('image/png'), bounds: bounds, zoom: z, tiles: nT }, null);
    });
  }

  // ---- DOM de la estación ----
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function abrir() {
    if (W.abierto) { cerrar(); return; }
    var m = getMap(); if (!m) { alert('El mapa aún no está listo.'); return; }
    // En escritorio real (#sidebar + #map) el mapa ya está siempre visible; el
    // cambio de pantalla del shell móvil solo aplica cuando la app corre en modo móvil.
    var esMobileShell = window.UrbisAppShell && window.UrbisAppShell.isMobile;
    if (esMobileShell && window.UrbisMobileAppV58) try { window.UrbisMobileAppV58.show('map'); } catch (e) {}
    W.abierto = true;
    document.body.classList.add('urbis-analisis-on');

    var root = el('div', 'ua-root'); root.id = 'urbis-analisis-root';
    root.innerHTML =
      '<div class="ua-toolbar">' +
        '<div class="ua-brand">🛰️ <b>URBIS</b> ANÁLISIS</div>' +
        '<button class="ua-tool" data-ua="poligono" title="Dibujar polígono (clic por vértice, doble clic para cerrar)">✏️<span>Polígono</span></button>' +
        '<button class="ua-tool" data-ua="rect" title="Dibujar rectángulo (dos clics)">▭<span>Rectángulo</span></button>' +
        '<button class="ua-tool" data-ua="cerrarpoly" title="Cerrar el polígono y analizar">✅<span>Analizar</span></button>' +
        '<button class="ua-tool" data-ua="heat" title="Mapa de calor de todos los datos comunitarios">🔥<span>Calor</span></button>' +
        '<button class="ua-tool" data-ua="limpiar" title="Borrar polígono y resultados">🗑️<span>Limpiar</span></button>' +
        '<button class="ua-tool ua-x" data-ua="salir" title="Salir del modo análisis">✕<span>Salir</span></button>' +
      '</div>' +
      '<div class="ua-status" id="ua-status">Elige ✏️ Polígono o ▭ Rectángulo y dibuja sobre el mapa el sector a analizar.</div>' +
      '<aside class="ua-panel" id="ua-panel" hidden>' +
        '<header class="ua-panel-head"><b id="ua-panel-titulo">Sector analizado</b>' +
          '<div class="ua-meta" id="ua-meta"></div></header>' +
        '<nav class="ua-tabs">' +
          '<button class="ua-tab active" data-uatab="matriz">📊 Matriz</button>' +
          '<button class="ua-tab" data-uatab="verde">🌳 Verde</button>' +
          '<button class="ua-tab" data-uatab="reportes">🚨 Reportes</button>' +
          '<button class="ua-tab" data-uatab="comparativa">⚖️ Balance</button>' +
        '</nav>' +
        '<div class="ua-body" id="ua-body"></div>' +
        '<footer class="ua-foot">' +
          '<button class="ua-act" data-ua="csv">⬇️ CSV</button>' +
          '<button class="ua-act" data-ua="informe">🖨️ Informe</button>' +
        '</footer>' +
      '</aside>';
    document.body.appendChild(root);

    W.grupo = L.layerGroup().addTo(m);
    try { m.doubleClickZoom.disable(); } catch (e) {}

    root.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-ua]'); if (b) { accion(b.dataset.ua); return; }
      var t = ev.target.closest('[data-uatab]'); if (t) { activarTab(t.dataset.uatab); }
    });
    m.on('click', clickMapa);
    m.on('dblclick', dblMapa);
    document.addEventListener('keydown', teclaEsc);
    setModo('poligono');
  }

  function cerrar() {
    var m = getMap();
    W.abierto = false; W.modo = null; W.verts = []; W.cerrado = false; W.resultado = null; W.verde = null;
    document.body.classList.remove('urbis-analisis-on');
    var root = document.getElementById('urbis-analisis-root'); if (root) root.remove();
    if (m) {
      try { m.off('click', clickMapa); m.off('dblclick', dblMapa); m.doubleClickZoom.enable(); } catch (e) {}
      if (W.grupo) { try { m.removeLayer(W.grupo); } catch (e) {} W.grupo = null; }
      quitarVerdeOverlay(); apagarHeat();
    }
    document.removeEventListener('keydown', teclaEsc);
  }

  function teclaEsc(ev) { if (ev.key === 'Escape') { if (W.verts.length && !W.cerrado) { limpiar(); } else { cerrar(); } } }

  function setStatus(html) { var s = document.getElementById('ua-status'); if (s) s.innerHTML = html; }
  function setModo(mo) {
    W.modo = mo;
    document.querySelectorAll('.ua-tool').forEach(function (b) { b.classList.toggle('active', b.dataset.ua === mo); });
    if (mo === 'poligono') setStatus('✏️ <b>Polígono:</b> haz clic en el mapa por cada vértice. <b>Doble clic</b> (o ✅ Analizar) para cerrar.');
    if (mo === 'rect') setStatus('▭ <b>Rectángulo:</b> haz clic en una esquina y luego en la esquina opuesta.');
  }

  function accion(a) {
    if (a === 'salir') { cerrar(); return; }
    if (a === 'limpiar') { limpiar(); return; }
    if (a === 'poligono' || a === 'rect') { limpiar(); setModo(a); return; }
    if (a === 'cerrarpoly') { cerrarPoligono(); return; }
    if (a === 'heat') { toggleHeat(); return; }
    if (a === 'csv') { descargarCSV(); return; }
    if (a === 'informe') { imprimirInforme(); return; }
  }

  function limpiar() {
    W.verts = []; W.cerrado = false; W.resultado = null; W.verde = null; W.reportes = [];
    if (W.grupo) W.grupo.clearLayers();
    quitarVerdeOverlay();
    var p = document.getElementById('ua-panel'); if (p) p.hidden = true;
    setModo(W.modo || 'poligono');
  }

  function clickMapa(ev) {
    if (!W.abierto || W.cerrado || !W.modo) return;
    // js/20 y js/21 re-habilitan doubleClickZoom en pantallas de mapa: mientras
    // se dibuja lo volvemos a apagar para que el doble clic SOLO cierre el polígono.
    try { getMap().doubleClickZoom.disable(); } catch (e) {}
    var ll = { lat: ev.latlng.lat, lng: ev.latlng.lng };
    if (W.modo === 'rect') {
      W.verts.push(ll);
      if (W.verts.length === 2) {
        var a = W.verts[0], b = W.verts[1];
        W.verts = [{ lat: a.lat, lng: a.lng }, { lat: a.lat, lng: b.lng }, { lat: b.lat, lng: b.lng }, { lat: b.lat, lng: a.lng }];
        cerrarPoligono();
      } else { dibujarBorrador(); setStatus('▭ Ahora haz clic en la esquina opuesta.'); }
      return;
    }
    W.verts.push(ll);
    dibujarBorrador();
    var a2 = polygonAreaM2(W.verts);
    setStatus('✏️ ' + W.verts.length + ' vértice(s)' + (W.verts.length >= 3 ? ' · área provisional ' + fmtArea(a2) + ' — doble clic o ✅ para analizar' : ''));
  }
  function dblMapa() { if (W.abierto && !W.cerrado && W.modo === 'poligono') cerrarPoligono(); }

  function dibujarBorrador() {
    if (!W.grupo) return;
    W.grupo.clearLayers();
    var lls = W.verts.map(function (p) { return [p.lat, p.lng]; });
    W.verts.forEach(function (p, i) {
      L.circleMarker([p.lat, p.lng], { radius: 5, color: '#fff', weight: 2, fillColor: i === 0 ? '#37f0b0' : '#00B68D', fillOpacity: 1 }).addTo(W.grupo);
    });
    if (lls.length > 1) L.polyline(lls, { color: '#00B68D', weight: 3, dashArray: '7 6' }).addTo(W.grupo);
  }

  function cerrarPoligono() {
    if (W.cerrado || W.verts.length < 3) { if (!W.cerrado) setStatus('Necesitas al menos 3 vértices para cerrar el polígono.'); return; }
    W.cerrado = true;
    W.grupo.clearLayers();
    L.polygon(W.verts.map(function (p) { return [p.lat, p.lng]; }),
      { color: '#00B68D', weight: 3, fillColor: '#00B68D', fillOpacity: 0.08 }).addTo(W.grupo);
    ejecutarAnalisis();
  }

  // Hook de pruebas/demos: fija un polígono por código y analiza.
  window.__urbisAnalisisSetPoly = function (latlngs) {
    if (!W.abierto) abrir();
    limpiar();
    W.verts = (latlngs || []).map(function (p) { return { lat: p.lat, lng: p.lng }; });
    if (W.verts.length >= 3) cerrarPoligono();
  };

  function ejecutarAnalisis() {
    var data = getData();
    W.resultado = matrizDeUsos(data, W.verts);
    W.reportes = reportesRiesgo(data, W.verts);
    W.verde = null;
    var panel = document.getElementById('ua-panel'); if (panel) panel.hidden = false;
    var meta = document.getElementById('ua-meta');
    if (meta) meta.innerHTML =
      '<span>📐 ' + fmtArea(W.resultado.areaM2) + '</span>' +
      '<span>📏 ' + Math.round(W.resultado.perimetroM).toLocaleString('es-CO') + ' m</span>' +
      '<span>📍 ' + W.resultado.total + ' registros</span>';
    setStatus('✅ Sector cerrado: <b>' + fmtArea(W.resultado.areaM2) + '</b> · ' + W.resultado.total + ' registro(s) comunitario(s) dentro. Analizando capa verde…');
    activarTab('matriz');
    analizarVerdePoligono(W.verts, function (res, err) {
      if (err) { W.verde = { error: err }; }
      else {
        W.verde = res;
        pintarVerdeOverlay(res);
      }
      setStatus('✅ Análisis completo. Usa las pestañas del panel y exporta con ⬇️ CSV o 🖨️ Informe.');
      var actual = document.querySelector('.ua-tab.active');
      if (actual && (actual.dataset.uatab === 'verde' || actual.dataset.uatab === 'comparativa')) activarTab(actual.dataset.uatab);
    });
  }

  function quitarVerdeOverlay() { var m = getMap(); if (W.overlayVerde && m) { try { m.removeLayer(W.overlayVerde); } catch (e) {} } W.overlayVerde = null; }
  function pintarVerdeOverlay(res) {
    var m = getMap(); if (!m) return;
    quitarVerdeOverlay();
    W.overlayVerde = L.imageOverlay(res.maskURL, res.bounds, { opacity: 0.85, interactive: false }).addTo(m);
  }

  // ---- Pestañas ----
  function activarTab(tab) {
    document.querySelectorAll('.ua-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.uatab === tab); });
    var body = document.getElementById('ua-body'); if (!body || !W.resultado) return;
    if (tab === 'matriz') body.innerHTML = htmlMatriz();
    else if (tab === 'verde') body.innerHTML = htmlVerde();
    else if (tab === 'reportes') body.innerHTML = htmlReportes();
    else body.innerHTML = htmlComparativa();
  }

  function htmlMatriz() {
    var r = W.resultado;
    if (!r.total) return '<div class="ua-empty">📭 No hay registros comunitarios dentro del polígono.<br><small>La matriz se alimenta del mapeo hecho por los usuarios en la app móvil.</small></div>';
    var max = r.capas[0] ? r.capas[0].count : 1;
    return '<div class="ua-h">Matriz de usos del sector <small>' + r.total + ' registros · ' + r.areaHa.toFixed(2) + ' ha</small></div>' +
      r.capas.map(function (c) {
        var w = Math.max(6, c.count / max * 100);
        var subt = c.subtipos.slice(0, 6).map(function (s) {
          return '<div class="ua-sub"><span>' + s.nombre + '</span><b>' + s.count + '</b></div>';
        }).join('');
        return '<details class="ua-capa"><summary>' +
          '<span class="ua-capa-ic" style="background:' + c.color + '22;color:' + c.color + '">' + c.icono + '</span>' +
          '<span class="ua-capa-nom">' + c.nombre + '<small>' + c.porHa.toFixed(1) + ' por ha</small></span>' +
          '<span class="ua-capa-bar"><i style="width:' + w + '%;background:' + c.color + '"></i></span>' +
          '<b class="ua-capa-n">' + c.count + '</b></summary>' + subt + '</details>';
      }).join('');
  }

  function htmlVerde() {
    if (!W.verde) return '<div class="ua-empty">🛰️ Analizando la imagen satelital del sector…<div class="ua-spin"></div></div>';
    if (W.verde.error) return '<div class="ua-empty">⚠️ ' + W.verde.error + '</div>';
    var s = W.verde.stats, r = W.resultado;
    var verdeM2 = r.areaM2 * s.pctVerde / 100, constM2 = r.areaM2 * s.pctConstruido / 100;
    var lectura = s.pctVerde >= 30 ? '🌿 Sector con buena cobertura vegetal.' :
      s.pctVerde >= 15 ? '🌱 Cobertura vegetal media: hay espacio para arborizar.' :
      '🏜️ Déficit de cobertura vegetal: sector dominado por suelo duro.';
    return '<div class="ua-h">Capa verde (píxeles del satelital) <small>zoom ' + W.verde.zoom + ' · ' + W.verde.tiles + ' teselas</small></div>' +
      '<div class="ua-verde-big"><b>' + s.pctVerde.toFixed(1) + '%</b><span>cobertura verde detectada<br>≈ ' + fmtArea(verdeM2) + '</span></div>' +
      barra('🌳 Vegetación', s.pctVerde, '#22c55e') +
      barra('🏗️ Construido / suelo duro', s.pctConstruido, '#94a3b8') +
      barra('◻️ Otros (sombras, agua, vías)', s.pctOtros, '#475569') +
      '<div class="ua-nota">' + lectura + '<br><small>Método: índice de exceso de verde (ExG) sobre ' + s.total.toLocaleString('es-CO') + ' píxeles dentro del polígono. La capa verde se pinta sobre el mapa.</small></div>';
  }
  function barra(label, pct, color) {
    return '<div class="ua-barrow"><span>' + label + '</span><div class="ua-barbg"><i style="width:' + Math.min(100, pct).toFixed(1) + '%;background:' + color + '"></i></div><b>' + pct.toFixed(1) + '%</b></div>';
  }

  function htmlReportes() {
    if (!W.reportes.length) return '<div class="ua-empty">✅ Sin reportes de riesgo o tránsito registrados dentro del sector.</div>';
    var porSub = {};
    W.reportes.forEach(function (r) { porSub[r.subtipo] = (porSub[r.subtipo] || 0) + 1; });
    var resumen = Object.keys(porSub).map(function (k) { return { k: k, n: porSub[k] }; }).sort(function (a, b) { return b.n - a.n; });
    return '<div class="ua-h">Reportes históricos en el sector <small>' + W.reportes.length + ' reportes de la comunidad</small></div>' +
      resumen.slice(0, 10).map(function (s) { return '<div class="ua-sub big"><span>' + s.k + '</span><b>' + s.n + '</b></div>'; }).join('') +
      '<div class="ua-h" style="margin-top:14px">Últimos reportes</div>' +
      W.reportes.slice(0, 15).map(function (r) {
        var f = r.fecha ? new Date(r.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 's/f';
        return '<div class="ua-rep"><b>' + r.subtipo + '</b><small>' + f + '</small></div>';
      }).join('');
  }

  function htmlComparativa() {
    var r = W.resultado, v = W.verde && W.verde.stats ? W.verde.stats : null;
    var n = function (id) { var c = r.capas.find(function (x) { return x.id === id; }); return c ? c.count : 0; };
    var social = n('verde') + n('deporte') + n('social');
    var privado = n('vivienda') + n('comercio');
    var riesgo = n('riesgo') + n('transito');
    var out = '<div class="ua-h">Balance urbano del sector</div>';
    if (v) {
      out += '<div class="ua-comp-duo">' +
        '<div class="ua-comp-box verde"><b>' + v.pctVerde.toFixed(1) + '%</b><span>🌳 verde</span></div>' +
        '<div class="ua-comp-box gris"><b>' + v.pctConstruido.toFixed(1) + '%</b><span>🏗️ construido</span></div></div>' +
        '<div class="ua-nota">' + (v.pctConstruido > 0 ? ('Por cada m² de verde hay <b>' + (v.pctVerde > 0 ? (v.pctConstruido / v.pctVerde).toFixed(1) : '∞') + ' m²</b> de suelo duro.') : '') + '</div>';
    } else { out += '<div class="ua-empty">🛰️ La comparativa físico-espacial aparece al terminar el análisis satelital…</div>'; }
    out += barra('🤝 Espacio social (verde+deporte+eventos)', r.total ? social / r.total * 100 : 0, '#22c55e') +
      barra('🏠 Privado (vivienda+comercio)', r.total ? privado / r.total * 100 : 0, '#f59e0b') +
      barra('🚨 Puntos de riesgo/tránsito', r.total ? riesgo / r.total * 100 : 0, '#ef4444') +
      '<div class="ua-nota"><small>Proporciones sobre los ' + r.total + ' registros comunitarios del sector. Úsalas como insumo de diagnóstico, junto con la capa verde, para proyectar propuestas (arborización, espacio público, seguridad vial).</small></div>';
    return out;
  }

  // ---- Mapa de calor de datos comunitarios ----
  function toggleHeat() {
    if (W.heatOn) { apagarHeat(); setStatus('🔥 Mapa de calor apagado.'); return; }
    var m = getMap(); if (!m) return;
    var pts = getData().map(function (p) { return { lat: parseNum(p.lat), lng: parseNum(p.lng) }; })
      .filter(function (p) { return p.lat !== null && p.lng !== null; });
    if (!pts.length) { setStatus('🔥 No hay datos comunitarios cargados todavía.'); return; }
    var mapEl = m.getContainer();
    var cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:880;';
    if (mapEl.style.position !== 'absolute' && mapEl.style.position !== 'fixed') mapEl.style.position = 'relative';
    mapEl.appendChild(cv);
    var draw = function () {
      cv.width = mapEl.offsetWidth || 800; cv.height = mapEl.offsetHeight || 600;
      var ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = 'lighter';
      pts.forEach(function (p) {
        var px; try { px = m.latLngToContainerPoint([p.lat, p.lng]); } catch (e) { return; }
        if (px.x < -40 || px.y < -40 || px.x > cv.width + 40 || px.y > cv.height + 40) return;
        var g = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, 26);
        g.addColorStop(0, 'rgba(255,90,20,.34)'); g.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px.x, px.y, 26, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
    };
    draw();
    m.on('moveend zoomend', draw);
    W.heatCv = cv; W.heatFn = draw; W.heatOn = true;
    document.querySelector('[data-ua="heat"]')?.classList.add('active');
    setStatus('🔥 Mapa de calor de <b>' + pts.length + '</b> datos comunitarios. Vuelve a pulsar 🔥 para apagarlo.');
  }
  function apagarHeat() {
    var m = getMap();
    if (m && W.heatFn) { try { m.off('moveend zoomend', W.heatFn); } catch (e) {} }
    if (W.heatCv && W.heatCv.parentNode) W.heatCv.parentNode.removeChild(W.heatCv);
    W.heatCv = null; W.heatFn = null; W.heatOn = false;
    document.querySelector('[data-ua="heat"]')?.classList.remove('active');
  }

  // ---- Exportar ----
  function descargarCSV() {
    if (!W.resultado) { setStatus('Dibuja y cierra un polígono primero.'); return; }
    var csv = csvInforme(W.resultado, W.verde && W.verde.stats ? W.verde.stats : null, W.reportes);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'urbis-analisis-' + Date.now() + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function imprimirInforme() {
    if (!W.resultado) { setStatus('Dibuja y cierra un polígono primero.'); return; }
    var r = W.resultado, v = W.verde && W.verde.stats ? W.verde.stats : null;
    var filas = r.capas.map(function (c) {
      return '<tr><td>' + c.icono + ' ' + c.nombre + '</td><td>' + c.count + '</td><td>' + c.porHa.toFixed(2) + '</td></tr>';
    }).join('');
    var reps = W.reportes.slice(0, 25).map(function (x) { return '<tr><td>' + x.subtipo + '</td><td>' + (x.fecha ? new Date(x.fecha).toLocaleDateString('es-CO') : 's/f') + '</td></tr>'; }).join('');
    var w = window.open('', '_blank');
    if (!w) { alert('Permite ventanas emergentes para generar el informe.'); return; }
    w.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Informe URBIS Análisis</title>' +
      '<style>body{font-family:Segoe UI,system-ui,sans-serif;color:#16232e;margin:34px;}h1{color:#00795e;margin:0}h2{color:#0b5e4a;border-bottom:2px solid #00B68D;padding-bottom:4px;margin-top:26px}' +
      'table{border-collapse:collapse;width:100%;margin-top:8px}td,th{border:1px solid #cbd5e1;padding:6px 10px;text-align:left;font-size:14px}th{background:#e6fff7}' +
      '.meta{display:flex;gap:22px;margin-top:10px;font-weight:700}.kv b{font-size:1.5rem;color:#00795e}</style></head><body>' +
      '<h1>🛰️ URBIS ANÁLISIS</h1><div>Informe de sector · ' + new Date().toLocaleString('es-CO') + '</div>' +
      '<div class="meta"><div class="kv"><b>' + fmtArea(r.areaM2) + '</b><br>área</div><div class="kv"><b>' + Math.round(r.perimetroM).toLocaleString('es-CO') + ' m</b><br>perímetro</div><div class="kv"><b>' + r.total + '</b><br>registros</div>' +
      (v ? '<div class="kv"><b>' + v.pctVerde.toFixed(1) + '%</b><br>cobertura verde</div><div class="kv"><b>' + v.pctConstruido.toFixed(1) + '%</b><br>construido</div>' : '') + '</div>' +
      '<h2>Matriz de usos</h2><table><tr><th>Capa urbana</th><th>Registros</th><th>Densidad (por ha)</th></tr>' + filas + '</table>' +
      (reps ? '<h2>Reportes de riesgo y tránsito</h2><table><tr><th>Reporte</th><th>Fecha</th></tr>' + reps + '</table>' : '') +
      '<p style="margin-top:26px;font-size:12px;color:#475569">Generado por URBIS Análisis · datos comunitarios URBIS + clasificación de píxeles del satelital (índice ExG). Documento de diagnóstico para estudios y propuestas urbanas.</p>' +
      '</body></html>');
    w.document.close();
    setTimeout(function () { try { w.print(); } catch (e) {} }, 350);
  }

  // ---- Botón de entrada (escritorio) ----
  window.urbisAbrirAnalisis = abrir;
  function crearFab() {
    if (document.getElementById('urbis-analisis-fab')) return;
    var b = el('button', 'ua-fab', '🛰️ <b>Análisis</b>');
    b.id = 'urbis-analisis-fab';
    b.title = 'URBIS Análisis: polígonos, matriz de usos, capa verde e informes (modo escritorio)';
    b.onclick = abrir;
    document.body.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', crearFab);
  else crearFab();

  // ---- Botón de perfil (escritorio): entrar/cerrar sesión sin buscarlo ----
  function nombreSesionActual() {
    try {
      var s = window.URBIS_AUTH && typeof window.URBIS_AUTH.readSession === 'function' ? window.URBIS_AUTH.readSession() : null;
      return (s && (s.usuario || s.nombre)) || (typeof userUsernameGlobal !== 'undefined' && userUsernameGlobal) || 'Ciudadano URBIS';
    } catch (e) { return 'Ciudadano URBIS'; }
  }

  function toggleProfileMenu(force) {
    var menu = document.getElementById('ua-profile-menu');
    if (!menu) return;
    var abrir2 = force != null ? force : !menu.classList.contains('open');
    menu.classList.toggle('open', abrir2);
    if (abrir2) {
      var nombre = document.getElementById('ua-profile-menu-name');
      if (nombre) nombre.textContent = nombreSesionActual();
    }
  }

  function cerrarSesionDesktop() {
    if (!confirm('¿Cerrar sesión de URBIS en este dispositivo?')) return;
    if (window.URBIS_AUTH && typeof window.URBIS_AUTH.logout === 'function') { window.URBIS_AUTH.logout(); return; }
    try { localStorage.removeItem('urbis_session_v139'); } catch (e) {}
    location.reload();
  }

  window.urbisInitProfileFab = function () {
    if (document.getElementById('urbis-profile-fab')) return;
    var b = el('button', 'ua-profile-fab', '👤');
    b.id = 'urbis-profile-fab';
    b.title = 'Tu cuenta URBIS';
    b.onclick = function (ev) { ev.stopPropagation(); toggleProfileMenu(); };
    document.body.appendChild(b);

    var menu = el('div', 'ua-profile-menu');
    menu.id = 'ua-profile-menu';
    menu.innerHTML =
      '<div class="ua-profile-menu-head"><b id="ua-profile-menu-name">Ciudadano URBIS</b><small>Sesión activa en este dispositivo</small></div>' +
      '<button type="button" data-ua-profile="perfil">👤 Ver mi perfil</button>' +
      '<button type="button" class="danger" data-ua-profile="logout">🚪 Cerrar sesión</button>';
    document.body.appendChild(menu);

    menu.addEventListener('click', function (ev) {
      var b2 = ev.target.closest('[data-ua-profile]'); if (!b2) return;
      var accion = b2.dataset.uaProfile;
      if (accion === 'logout') { toggleProfileMenu(false); cerrarSesionDesktop(); }
      else if (accion === 'perfil') {
        toggleProfileMenu(false);
        try { if (typeof window.setSidebarTab === 'function') window.setSidebarTab('access'); } catch (e) {}
      }
    });
    document.addEventListener('click', function (ev) {
      if (!menu.classList.contains('open')) return;
      if (ev.target.closest('.ua-profile-menu, .ua-profile-fab')) return;
      toggleProfileMenu(false);
    });
  };
  // Si al cargar ya hay sesión activa (auto-restore), el botón aparece también.
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () { if (!document.body.classList.contains('urbis-pre-login') && window.urbisInitProfileFab) window.urbisInitProfileFab(); }, 400);
  });
})();
