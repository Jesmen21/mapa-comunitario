/* URBIS · Los llenos y vacíos, leídos de la foto.

   El problema, con la captura del mapa encima: «8,2 % construido · 976
   huellas», y en la foto satelital media docena de manzanas llenas de casas
   sin una sola huella dibujada. Los llenos y vacíos salían de contar los
   polígonos de edificio que OpenStreetMap tiene mapeados, y en Cúcuta eso es
   una fracción de lo que hay construido. La cifra no describe el barrio:
   describe cuánto lo han mapeado. «Aún hay manzanas que no lee.»

   Esto lee la foto. No inventa huellas —no se dibujan edificios que nadie
   levantó— sino que estima QUÉ PARTE DEL SUELO está cubierta por
   construcción, y lo dice al lado de lo que trae OpenStreetMap, para que la
   diferencia entre las dos cifras sea justamente el trabajo que falta.

   ── Por qué no alcanza con el color

   La clasificación por color de js/24 separa vegetación viva, agua y gris
   neutro, y declara ambiguo un cuarto grupo —«tonos cálidos»— donde conviven
   teja, concreto envejecido, suelo descubierto y matorral seco. Está bien
   declarado: sin banda infrarroja esos materiales NO se separan por color, y
   en Cúcuta la mayoría de los techos son teja. Un «construido» sacado solo
   del gris deja fuera medio barrio.

   ── Lo que sí se puede hacer: preguntarle al propio barrio

   Las huellas que OpenStreetMap SÍ tiene son, cada una, un trozo de foto del
   que se sabe con certeza que es techo. Son cientos. Con ellas se aprende de
   qué color son los techos DE ESTE SECTOR —esta teja, este concreto, esta
   luz, esta hora— y con las vías, los parques y la vegetación se aprende de
   qué color es lo que no lo es. Después se le pregunta a cada píxel a cuál de
   los dos se parece más.

   Es supervisado y local: no hay un umbral escrito por alguien que nunca vio
   este barrio. Se calibra solo, en cada sector, con lo que ya está mapeado.

   ── Las pasadas

     1. Se rasterizan las huellas conocidas: píxeles techo seguros.
     2. Se rasterizan las vías con su ancho, y se suman la vegetación viva y
        el agua: píxeles NO techo seguros.
     3. Con esos dos montones se arman dos histogramas de color y se compara
        cada píxel candidato contra los dos.
     4. Se limpia: se borran las manchas más chicas que una casa y se tapan
        los huecos más chicos que un patio.
     5. Se cuenta, y se dibuja la máscara para poder verla sobre el mapa.

   ── Lo que esto NO es

   Un patio de tierra, un lote pelado y una cancha de arena tienen el color de
   una teja vieja. Donde el barrio es denso apenas pesan; en la periferia, con
   lotes sin construir, esta estimación se pasa de largo. Va escrito en la
   ficha, con el número de la confianza, y por eso la cifra se llama
   estimación y nunca reemplaza a las huellas: las complementa.           */
(function () {
  'use strict';

  var COD_VERDE = 1, COD_AGUA = 3;

  // Cuánto se aparta un color de otro se mide en un histograma grueso: 12
  // pasos por canal cromático y 6 de luz. Más fino no aprende con seiscientas
  // huellas —las casillas quedan vacías— y menos fino confunde teja con tierra.
  var NC = 12, NL = 6;

  function casilla(r, g, b) {
    var suma = r + g + b || 1;
    var R = r / suma, G = g / suma;
    var luz = Math.min(255, suma / 3);
    var i = Math.min(NC - 1, Math.floor(R * 3 * NC));
    var j = Math.min(NC - 1, Math.floor(G * 3 * NC));
    var k = Math.min(NL - 1, Math.floor(luz / 256 * NL));
    return (i * NC + j) * NL + k;
  }

  /* Un polígono de latitudes y longitudes, dibujado sobre la rejilla de la
     foto. Se hace a mano y no con el lienzo del navegador porque hacen falta
     los píxeles, no la imagen: se pinta sobre un `Uint8Array` con el mismo
     recorrido de barrido que usa cualquier rasterizador —una fila, los cruces
     con las aristas, y se rellena entre pares—. */
  function pintarPoligono(mascara, W, H, caja, pts, valor) {
    if (!pts || pts.length < 3) return;
    var dLat = caja.n - caja.s, dLng = caja.e - caja.o;
    if (!(dLat > 0) || !(dLng > 0)) return;
    var xs = [], ys = [], i;
    for (i = 0; i < pts.length; i++) {
      xs.push((Number(pts[i].lng) - caja.o) / dLng * W);
      ys.push((caja.n - Number(pts[i].lat)) / dLat * H);
    }
    var yMin = Math.max(0, Math.floor(Math.min.apply(null, ys)));
    var yMax = Math.min(H - 1, Math.ceil(Math.max.apply(null, ys)));
    for (var y = yMin; y <= yMax; y++) {
      var cy = y + 0.5, cruces = [];
      for (i = 0; i < xs.length; i++) {
        var j = (i + 1) % xs.length;
        var y1 = ys[i], y2 = ys[j];
        if ((y1 <= cy && y2 > cy) || (y2 <= cy && y1 > cy)) {
          cruces.push(xs[i] + (cy - y1) / (y2 - y1) * (xs[j] - xs[i]));
        }
      }
      if (cruces.length < 2) continue;
      cruces.sort(function (a, b) { return a - b; });
      for (var c = 0; c + 1 < cruces.length; c += 2) {
        var x0 = Math.max(0, Math.round(cruces[c])), x1 = Math.min(W - 1, Math.round(cruces[c + 1]));
        for (var x = x0; x <= x1; x++) mascara[y * W + x] = valor;
      }
    }
  }

  /* Una línea con grosor: las vías. El ancho va en metros y se pasa a píxeles
     con la escala de la foto, así que una avenida tapa más que un callejón. */
  function pintarLinea(mascara, W, H, caja, pts, anchoM, mPorPx, valor) {
    if (!pts || pts.length < 2) return;
    var radio = Math.max(1, Math.round(anchoM / 2 / Math.max(0.05, mPorPx)));
    var dLat = caja.n - caja.s, dLng = caja.e - caja.o;
    var px = function (p) {
      return { x: (Number(p.lng) - caja.o) / dLng * W, y: (caja.n - Number(p.lat)) / dLat * H };
    };
    for (var i = 0; i + 1 < pts.length; i++) {
      var a = px(pts[i]), b = px(pts[i + 1]);
      var pasos = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
      for (var t = 0; t <= pasos; t++) {
        var cx = Math.round(a.x + (b.x - a.x) * t / pasos);
        var cy = Math.round(a.y + (b.y - a.y) * t / pasos);
        for (var dy = -radio; dy <= radio; dy++) {
          for (var dx = -radio; dx <= radio; dx++) {
            if (dx * dx + dy * dy > radio * radio) continue;
            var x = cx + dx, y = cy + dy;
            if (x < 0 || y < 0 || x >= W || y >= H) continue;
            mascara[y * W + x] = valor;
          }
        }
      }
    }
  }

  /* Manchas conectadas, con un recorrido iterativo y una pila propia: la
     recursión se lleva por delante la pila del navegador a los pocos miles de
     píxeles, y acá hay millones. Devuelve el tamaño de cada mancha y a qué
     mancha pertenece cada píxel. */
  function manchas(mapa, W, H, esDe) {
    var etiqueta = new Int32Array(W * H), tam = [0], pila = new Int32Array(W * H), n = 0;
    for (var p = 0; p < W * H; p++) {
      if (etiqueta[p] || !esDe(mapa[p])) continue;
      n++; tam.push(0);
      var sp = 0; pila[sp++] = p; etiqueta[p] = n;
      while (sp > 0) {
        var q = pila[--sp]; tam[n]++;
        var x = q % W, y = (q - x) / W;
        if (x > 0 && !etiqueta[q - 1] && esDe(mapa[q - 1])) { etiqueta[q - 1] = n; pila[sp++] = q - 1; }
        if (x < W - 1 && !etiqueta[q + 1] && esDe(mapa[q + 1])) { etiqueta[q + 1] = n; pila[sp++] = q + 1; }
        if (y > 0 && !etiqueta[q - W] && esDe(mapa[q - W])) { etiqueta[q - W] = n; pila[sp++] = q - W; }
        if (y < H - 1 && !etiqueta[q + W] && esDe(mapa[q + W])) { etiqueta[q + W] = n; pila[sp++] = q + W; }
      }
    }
    return { etiqueta: etiqueta, tam: tam, n: n };
  }

  function leerPixeles(dataUrl, W, H) {
    return new Promise(function (listo, falla) {
      var im = new Image();
      im.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = W; c.height = H;
          var x = c.getContext('2d', { willReadFrequently: true });
          x.drawImage(im, 0, 0, W, H);
          listo(x.getImageData(0, 0, W, H).data);
        } catch (e) { falla(e); }
      };
      im.onerror = function () { falla(new Error('no se pudo releer la foto analizada')); };
      im.src = dataUrl;
    });
  }

  /* El ancho de una vía, en metros, para taparla. Sale de los carriles si
     están mapeados y, si no, de la jerarquía: una avenida no mide lo mismo
     que un callejón, y taparlas todas igual borra medio barrio o deja media
     avenida contada como techo. */
  function anchoDeVia(v) {
    // js/68 guarda las vías con `clase`; una respuesta cruda de OpenStreetMap
    // las trae con `tags.highway`. Se aceptan las dos formas.
    var t = (v && v.tags) || {};
    var carriles = parseFloat(t.lanes != null ? t.lanes : v && v.carriles);
    if (isFinite(carriles) && carriles > 0) return Math.min(30, 3.5 * carriles + 4);
    var h = (v && v.clase) || t.highway || '';
    if (/^(motorway|trunk|primary)/.test(h)) return 20;
    if (/^(secondary|tertiary)/.test(h)) return 14;
    if (/^(residential|unclassified|living_street)/.test(h)) return 10;
    if (/^(service|track)/.test(h)) return 6;
    if (/^(footway|path|pedestrian|steps)/.test(h)) return 3;
    return 8;
  }

  /* ── La estimación ─────────────────────────────────────────────────────
     `raster` es lo que devuelve js/24 (`analizarRaster`): trae la rejilla de
     clases, la caja en coordenadas, la foto y los metros por píxel.
     `huellas` son los polígonos de edificio de OpenStreetMap; `vias`, las
     líneas de calle con sus etiquetas. */
  async function estimar(entrada) {
    var e = entrada || {};
    var raster = e.raster, huellas = e.huellas || [], vias = e.vias || [];
    var avisar = typeof e.alAvisar === 'function' ? e.alAvisar : function () {};
    if (!raster || !raster.rejilla || !raster.rejilla.cls) {
      throw new Error('Hace falta leer la foto satelital primero.');
    }
    var rej = raster.rejilla, W = rej.W, H = rej.H, cls = rej.cls, caja = rej.caja;
    var mPorPx = raster.mPorPx || 1, m2PorPx = rej.m2PorPixel || (mPorPx * mPorPx);
    var N = W * H;

    avisar('Leyendo la foto…');
    var px = await leerPixeles(raster.imagen, W, H);

    // ── 1 · Lo que se sabe que es techo: las huellas mapeadas.
    avisar('Aprendiendo el color de los techos del sector…');
    var techo = new Uint8Array(N);
    huellas.forEach(function (h) {
      var pts = h && (h.pts || h.puntos || h);
      if (pts && pts.length >= 3) pintarPoligono(techo, W, H, caja, pts, 1);
    });

    // ── 2 · Lo que se sabe que NO lo es: calles, vegetación viva y agua.
    var noTecho = new Uint8Array(N);
    vias.forEach(function (v) {
      var pts = v && (v.pts || v.geometry || v.puntos);
      if (pts && pts.length >= 2) {
        pintarLinea(noTecho, W, H, caja, pts.map(function (p) {
          return { lat: p.lat, lng: p.lng != null ? p.lng : p.lon };
        }), anchoDeVia(v), mPorPx, 1);
      }
    });
    var p;
    for (p = 0; p < N; p++) {
      if (cls[p] === COD_VERDE || cls[p] === COD_AGUA) noTecho[p] = 1;
      // Una huella mapeada manda sobre el buffer de la calle: hay edificios
      // pegados al andén y el buffer se los come.
      if (techo[p]) noTecho[p] = 0;
    }

    // ── 3 · Los dos histogramas, y el parecido de cada píxel.
    var nBins = NC * NC * NL;
    var hT = new Float64Array(nBins), hN = new Float64Array(nBins);
    var nT = 0, nN = 0, b;
    for (p = 0; p < N; p++) {
      if (!cls[p]) continue;                        // fuera del área dibujada
      b = casilla(px[p * 4], px[p * 4 + 1], px[p * 4 + 2]);
      if (techo[p]) { hT[b]++; nT++; }
      else if (noTecho[p]) { hN[b]++; nN++; }
    }
    /* Sin huellas suficientes no hay de qué aprender. Antes que devolver una
       cifra inventada con un umbral de nadie, se dice que no se puede: la
       salida es medir el trazado primero, o mapear unas cuantas casas. */
    var MINIMO = 400;
    if (nT < MINIMO) {
      return { ok: false, motivo: 'pocasHuellas', pixelesTecho: nT, minimo: MINIMO,
        detalle: 'Con ' + (huellas.length || 0) + ' huella' + (huellas.length === 1 ? '' : 's') +
          ' mapeadas no hay de dónde aprender el color de los techos de este sector. ' +
          'Medí el trazado, o mapeá unas cuantas casas y volvé a intentarlo.' };
    }

    avisar('Comparando cada píxel con lo aprendido…');
    var suave = 0.5;
    var razon = new Float64Array(nBins);
    for (b = 0; b < nBins; b++) {
      var pT = (hT[b] + suave) / (nT + suave * nBins);
      var pN = (hN[b] + suave) / (nN + suave * nBins);
      razon[b] = Math.log(pT / pN);
    }
    var lleno = new Uint8Array(N), candidatos = 0;
    for (p = 0; p < N; p++) {
      if (!cls[p]) continue;
      if (cls[p] === COD_VERDE || cls[p] === COD_AGUA) continue;
      candidatos++;
      if (techo[p]) { lleno[p] = 1; continue; }
      if (noTecho[p]) continue;                     // la calle no se discute
      if (razon[casilla(px[p * 4], px[p * 4 + 1], px[p * 4 + 2])] > 0) lleno[p] = 1;
    }

    // ── 4 · Limpieza. Una casa de este país no baja de 24 m²; un patio
    //        interior tapado por el clasificador, tampoco de 12.
    avisar('Limpiando manchas sueltas…');
    var minCasaPx = Math.max(6, Math.round(24 / m2PorPx));
    var minHuecoPx = Math.max(4, Math.round(12 / m2PorPx));
    var mT = manchas(lleno, W, H, function (v) { return v === 1; });
    for (p = 0; p < N; p++) {
      if (lleno[p] && mT.tam[mT.etiqueta[p]] < minCasaPx) lleno[p] = 0;
    }
    var mH = manchas(lleno, W, H, function (v) { return v === 0; });
    // Los huecos que tocan el borde de la foto son el afuera, no patios.
    var alBorde = {};
    for (var x = 0; x < W; x++) { alBorde[mH.etiqueta[x]] = 1; alBorde[mH.etiqueta[(H - 1) * W + x]] = 1; }
    for (var y = 0; y < H; y++) { alBorde[mH.etiqueta[y * W]] = 1; alBorde[mH.etiqueta[y * W + W - 1]] = 1; }
    for (p = 0; p < N; p++) {
      var et = mH.etiqueta[p];
      if (!lleno[p] && et && !alBorde[et] && mH.tam[et] < minHuecoPx && cls[p] &&
          cls[p] !== COD_VERDE && cls[p] !== COD_AGUA) lleno[p] = 1;
    }

    // ── 5 · La cuenta y la máscara para verla.
    var dentro = 0, llenos = 0, deHuella = 0;
    for (p = 0; p < N; p++) {
      if (!cls[p]) continue;
      dentro++;
      if (lleno[p]) llenos++;
      if (techo[p]) deHuella++;
    }
    var pct = dentro ? Math.round(1000 * llenos / dentro) / 10 : 0;
    var pctOSM = dentro ? Math.round(1000 * deHuella / dentro) / 10 : 0;

    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(W, H);
    for (p = 0; p < N; p++) {
      var o = p * 4;
      if (!lleno[p]) { img.data[o + 3] = 0; continue; }
      // El que ya estaba mapeado, en gris; el que aporta la foto, en naranja:
      // la lámina y el mapa tienen que dejar ver DÓNDE falta mapear.
      if (techo[p]) { img.data[o] = 90; img.data[o + 1] = 105; img.data[o + 2] = 120; img.data[o + 3] = 190; }
      else { img.data[o] = 232; img.data[o + 1] = 122; img.data[o + 2] = 46; img.data[o + 3] = 190; }
    }
    ctx.putImageData(img, 0, 0);

    return {
      ok: true,
      pct: pct, pctOSM: pctOSM,
      m2: Math.round(llenos * m2PorPx),
      m2OSM: Math.round(deHuella * m2PorPx),
      // Lo que la foto ve y OpenStreetMap no: es la tarea de campo, en área.
      pctSinMapear: Math.round((pct - pctOSM) * 10) / 10,
      pixeles: dentro, candidatos: candidatos,
      huellas: huellas.length,
      mPorPx: Math.round(mPorPx * 100) / 100,
      imagen: cv.toDataURL('image/png'),
      limites: [[caja.s, caja.o], [caja.n, caja.e]],
      /* La confianza sale de cuánto se distinguen los dos histogramas: si el
         color de los techos y el del suelo pelado se parecen, la separación
         es una moneda al aire y hay que decirlo. Es la distancia de
         Bhattacharyya, en 0..1. */
      confianza: (function () {
        var s = 0;
        for (var i = 0; i < nBins; i++) {
          s += Math.sqrt((hT[i] / (nT || 1)) * (hN[i] / (nN || 1)));
        }
        return Math.round((1 - s) * 100);
      })()
    };
  }

  window.URBIS_LLENOS_FOTO = { estimar: estimar, pintarPoligono: pintarPoligono, casilla: casilla };
})();
