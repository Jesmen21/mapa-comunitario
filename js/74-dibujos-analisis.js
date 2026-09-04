/* URBIS · Dibujos del análisis urbano
   ────────────────────────────────────────────────────────────────────────
   Un arquitecto no lee un informe: lo mira. Donde hay un dibujo el ojo se
   para, y recién ahí lee el texto que lo acompaña; donde hay solo párrafos,
   pasa de largo. Estos son los dibujos que faltaban en la ficha: la carta
   solar, la rosa de los ocho rumbos, el plano acotado del lote y la trama de
   llenos y vacíos.

   Los cuatro devuelven SVG con los colores puestos EN LOS ATRIBUTOS, no en
   clases. Es a propósito: el mismo dibujo tiene que servir en la ficha de la
   aplicación, en la lámina de 60 × 90 —que es un documento aparte, con su
   propia hoja de estilos— y en el PDF, sin arrastrar CSS a ninguno de los
   tres. Un dibujo que depende de una clase es un dibujo que sale en negro
   sobre negro el día que alguien lo pega en otra parte.

   Todo va en milímetros de papel o en unidades del viewBox, nunca en píxeles
   de pantalla: el destino final de estos dibujos es una hoja impresa. */
(function () {
  'use strict';

  var TINTA = '#0F1F2E';      // el trazo principal
  var GRIS  = '#6B7A8A';      // rótulos y cotas
  var LINEA = '#C7D5E0';      // retícula
  var AZUL  = '#0A6F9E';      // lo medido
  var CIELO = '#34CCFE';      // lo secundario
  var ALERTA = '#E5484D';     // lo que hay que proteger
  var AMBAR = '#F2B441';      // el sol

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function n1(x) { return Math.round(Number(x) * 10) / 10; }

  /* ── 1 · Carta solar ────────────────────────────────────────────────────
     La proyección es equidistante: el centro es el cenit, el borde es el
     horizonte y la distancia al centro crece con el ángulo, no con su seno.
     Es la que se usa en las cartas solares de arquitectura porque las alturas
     se leen con una regla en vez de con una tabla.

     Van tres recorridos: el de hoy, el del día más alto del año y el del más
     bajo. Entre esos dos se mueve todo lo demás, así que el dibujo dice de
     una sola vez por dónde entra el sol en cualquier fecha.

     El sector occidental va sombreado: en el trópico el sol de la tarde entra
     casi horizontal por ahí y es el que recalienta. Que eso esté DIBUJADO y
     no solo dicho es la diferencia entre una lámina que se entiende de lejos
     y un párrafo que nadie lee. */
  function cartaSolar(opts) {
    var o = opts || {};
    var SOL = window.URBIS_SOLAR;
    var lat = Number(o.lat), lng = Number(o.lng);
    if (!SOL || !isFinite(lat) || !isFinite(lng)) return '';

    var R = 96, cx = 120, cy = 124;
    var hoy = o.fecha ? new Date(o.fecha) : new Date();

    // Del azimut y la altura a un punto del papel. Azimut 0 = norte, arriba.
    function punto(az, alt) {
      var r = R * (90 - alt) / 90;
      var a = (az - 90) * Math.PI / 180;
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    }
    function recorrido(fecha) {
      var d = new Date(fecha), pts = [], antes = null;
      d.setHours(0, 0, 0, 0);
      for (var m = 0; m <= 24 * 60; m += 10) {
        var t = new Date(d.getTime() + m * 60000);
        var p;
        try { p = SOL.posicion(t, lat, lng); } catch (e) { return ''; }
        if (p.altitud <= 0) { antes = null; continue; }
        var q = punto(p.azimut, p.altitud);
        pts.push((antes === null ? 'M' : 'L') + n1(q.x) + ' ' + n1(q.y));
        antes = q;
      }
      return pts.join(' ');
    }

    var d, a;
    try { d = SOL.dia(hoy, lat, lng); a = SOL.anio(lat, lng, hoy.getFullYear()); }
    catch (e) { return ''; }
    if (!d || !d.salida) return '';

    var hoyPath = recorrido(hoy);
    var altoPath = a.solsticios && a.solsticios.masAlto ? recorrido(a.solsticios.masAlto.fecha) : '';
    var bajoPath = a.solsticios && a.solsticios.masBajo ? recorrido(a.solsticios.masBajo.fecha) : '';

    // Los anillos de altura, rotulados: sin el número el dibujo es decoración.
    var anillos = [30, 60].map(function (alt) {
      var r = R * (90 - alt) / 90;
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + n1(r) + '" fill="none" ' +
        'stroke="' + LINEA + '" stroke-width="1" stroke-dasharray="3 3"/>' +
        '<text x="' + (cx + 3) + '" y="' + n1(cy - r + 9) + '" font-size="8" fill="' + GRIS + '">' +
        alt + '°</text>';
    }).join('');

    // El sector que se calienta: de 240° a 300°, el occidente ancho.
    var w1 = punto(240, 0), w2 = punto(300, 0);
    var cuna = '<path d="M' + cx + ' ' + cy + ' L' + n1(w1.x) + ' ' + n1(w1.y) +
      ' A' + R + ' ' + R + ' 0 0 1 ' + n1(w2.x) + ' ' + n1(w2.y) + ' Z" ' +
      'fill="' + ALERTA + '" fill-opacity=".08"/>';

    var pSal = punto(d.azimutSalida, 0), pPue = punto(d.azimutPuesta, 0);
    var pCen = punto(d.azimutCenit, d.alturaMaxima);

    // La sombra de la tarde, que es la que se dibuja en una planta.
    var azSombra = SOL.sombra(d.azimutPuesta);
    var pSom = punto(azSombra, 6);

    function rotulo(x, y, t, anchor, color, tam) {
      return '<text x="' + n1(x) + '" y="' + n1(y) + '" font-size="' + (tam || 9) + '" ' +
        'text-anchor="' + (anchor || 'middle') + '" fill="' + (color || GRIS) + '" ' +
        'font-weight="700">' + esc(t) + '</text>';
    }

    return '<svg class="pcr-carta" viewBox="0 0 240 248" width="240" height="248" ' +
      'role="img" aria-label="Carta solar del sector: recorrido del sol hoy y en los dos ' +
      'solsticios, con el occidente señalado">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="#F7FAFC" stroke="' + LINEA + '" stroke-width="1.2"/>' +
      cuna + anillos +
      '<path d="M' + cx + ' ' + (cy - R) + 'V' + (cy + R) + 'M' + (cx - R) + ' ' + cy + 'H' + (cx + R) + '" ' +
        'stroke="' + LINEA + '" stroke-width="1"/>' +
      (bajoPath ? '<path d="' + bajoPath + '" fill="none" stroke="' + GRIS + '" stroke-width="1" stroke-dasharray="4 3"/>' : '') +
      (altoPath ? '<path d="' + altoPath + '" fill="none" stroke="' + GRIS + '" stroke-width="1" stroke-dasharray="4 3"/>' : '') +
      (hoyPath ? '<path d="' + hoyPath + '" fill="none" stroke="' + AMBAR + '" stroke-width="3" stroke-linecap="round"/>' : '') +
      // La flecha de la sombra: del centro hacia donde cae en la tarde.
      '<path d="M' + cx + ' ' + cy + ' L' + n1(pSom.x) + ' ' + n1(pSom.y) + '" stroke="' + TINTA + '" ' +
        'stroke-width="1.4" stroke-dasharray="2 2"/>' +
      '<circle cx="' + n1(pSal.x) + '" cy="' + n1(pSal.y) + '" r="4" fill="' + AMBAR + '" stroke="' + TINTA + '" stroke-width="1"/>' +
      '<circle cx="' + n1(pPue.x) + '" cy="' + n1(pPue.y) + '" r="4" fill="' + ALERTA + '" stroke="' + TINTA + '" stroke-width="1"/>' +
      '<circle cx="' + n1(pCen.x) + '" cy="' + n1(pCen.y) + '" r="3.4" fill="' + AMBAR + '"/>' +
      rotulo(cx, cy - R - 6, 'N', 'middle', TINTA, 10) +
      rotulo(cx + R + 8, cy + 3, 'E', 'middle', TINTA, 10) +
      rotulo(cx, cy + R + 13, 'S', 'middle', TINTA, 10) +
      rotulo(cx - R - 8, cy + 3, 'O', 'middle', ALERTA, 10) +
      rotulo(cx, 12, 'Hoy · ' + n1(d.alturaMaxima) + '° al mediodía', 'middle', GRIS, 9) +
      rotulo(cx, cy + R + 26, 'sale ' + n1(d.azimutSalida) + '° · se pone ' + n1(d.azimutPuesta) + '°',
             'middle', GRIS, 8.5) +
      '</svg>';
  }

  /* ── 2 · Rosa de los ocho rumbos ────────────────────────────────────────
     Dónde está lo mapeado y dónde no hay nada. La misma cuenta que la ficha
     daba en una lista de frases —«al norte, sin un solo registro»— pero
     dibujada: los vacíos se ven como muescas y no hay que leer ocho renglones
     para encontrarlos.

     El radio va con la raíz de la cuenta, no con la cuenta: lo que el ojo
     compara en un sector circular es el área, y sin la raíz un rumbo con el
     doble de puntos se dibuja con el cuádruple de mancha. */
  function rosaDeRumbos(rumbos, opts) {
    var lista = rumbos || [];
    if (!lista.length) return '';
    var o = opts || {};
    var R = 78, cx = 100, cy = 100;
    var max = lista.reduce(function (m, x) { return Math.max(m, Number(x.n) || 0); }, 0);
    if (!max) max = 1;

    var sectores = lista.map(function (x, i) {
      var n = Number(x.n) || 0;
      var largo = R * Math.sqrt(n / max);
      var paso = 360 / lista.length;
      var a1 = (i * paso - paso / 2 - 90) * Math.PI / 180;
      var a2 = (i * paso + paso / 2 - 90) * Math.PI / 180;
      if (largo < 1.5) {
        // Un rumbo sin nada no se dibuja vacío y ya: se marca. El hueco ES el
        // dato —es a donde hay que mandar a alguien a caminar—.
        var m1 = { x: cx + Math.cos(a1) * R, y: cy + Math.sin(a1) * R };
        var m2 = { x: cx + Math.cos(a2) * R, y: cy + Math.sin(a2) * R };
        return '<path d="M' + cx + ' ' + cy + ' L' + n1(m1.x) + ' ' + n1(m1.y) +
          ' A' + R + ' ' + R + ' 0 0 1 ' + n1(m2.x) + ' ' + n1(m2.y) + ' Z" ' +
          'fill="' + ALERTA + '" fill-opacity=".07" stroke="' + ALERTA + '" ' +
          'stroke-width="1" stroke-dasharray="3 3"/>';
      }
      var p1 = { x: cx + Math.cos(a1) * largo, y: cy + Math.sin(a1) * largo };
      var p2 = { x: cx + Math.cos(a2) * largo, y: cy + Math.sin(a2) * largo };
      return '<path d="M' + cx + ' ' + cy + ' L' + n1(p1.x) + ' ' + n1(p1.y) +
        ' A' + n1(largo) + ' ' + n1(largo) + ' 0 0 1 ' + n1(p2.x) + ' ' + n1(p2.y) + ' Z" ' +
        'fill="' + AZUL + '" fill-opacity=".78" stroke="#fff" stroke-width="1"/>';
    }).join('');

    var letras = [['N', 0], ['E', 90], ['S', 180], ['O', 270]].map(function (p) {
      var a = (p[1] - 90) * Math.PI / 180;
      return '<text x="' + n1(cx + Math.cos(a) * (R + 13)) + '" y="' +
        n1(cy + Math.sin(a) * (R + 13) + 3.5) + '" font-size="10" text-anchor="middle" ' +
        'font-weight="700" fill="' + TINTA + '">' + p[0] + '</text>';
    }).join('');

    return '<svg class="pcr-rosa-rumbos" viewBox="0 0 200 200" width="200" height="200" ' +
      'role="img" aria-label="' + esc(o.etiqueta || 'Lo mapeado en cada uno de los ocho rumbos ' +
      'del sector; los rumbos punteados no tienen ni un registro') + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="' + LINEA + '" stroke-width="1"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R / 2) + '" fill="none" stroke="' + LINEA + '" ' +
        'stroke-width="1" stroke-dasharray="3 3"/>' +
      sectores + letras +
      '<circle cx="' + cx + '" cy="' + cy + '" r="2.5" fill="' + TINTA + '"/>' +
      '</svg>';
  }

  /* ── 3 · Plano acotado del lote ─────────────────────────────────────────
     El lote dibujado a escala, con cada lado numerado y su largo escrito al
     lado, la calle sobre la que da cada frente, y el lado que se calienta en
     rojo. Es el dibujo con el que empieza cualquier anteproyecto y hasta ahora
     la ficha lo daba como una tabla de números.

     Recibe el polígono en grados y lo proyecta a metros con la corrección del
     coseno de la latitud: a 7,9° de latitud, un grado de longitud mide 99 % de
     lo que mide uno de latitud, y sin corregirlo el lote sale estirado. */
  function planoDelLote(lote, analisis, opts) {
    var pts = lote || [];
    if (pts.length < 3) return '';
    var o = opts || {};
    var a = analisis || {};
    var W = 260, H = 210, pad = 34;

    var lat0 = pts.reduce(function (s, p) { return s + p.lat; }, 0) / pts.length;
    var k = Math.cos(lat0 * Math.PI / 180);
    var xs = pts.map(function (p) { return p.lng * k * 111320; });
    var ys = pts.map(function (p) { return p.lat * 110540; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var anchoM = Math.max(1, maxX - minX), altoM = Math.max(1, maxY - minY);
    var escala = Math.min((W - pad * 2) / anchoM, (H - pad * 2) / altoM);
    var oX = (W - anchoM * escala) / 2, oY = (H - altoM * escala) / 2;
    // El norte va arriba: la y de la pantalla crece hacia abajo, la latitud
    // hacia arriba. Invertirla es lo que hace que el dibujo se pueda comparar
    // con el mapa sin darle vuelta a la hoja.
    var P = pts.map(function (p, i) {
      return { x: oX + (xs[i] - minX) * escala, y: oY + (maxY - ys[i]) * escala };
    });

    var contorno = P.map(function (p, i) {
      return (i ? 'L' : 'M') + n1(p.x) + ' ' + n1(p.y);
    }).join(' ') + ' Z';

    // Los lados, con su cota. El análisis ya los trae medidos y orientados:
    // acá solo se dibujan en el mismo orden en que vienen.
    var lados = (a.lados || []).map(function (l, i) {
      var p1 = P[i], p2 = P[(i + 1) % P.length];
      if (!p1 || !p2) return '';
      var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      var esCritica = a.critica && a.critica.i === l.i;
      var dx = p2.x - p1.x, dy = p2.y - p1.y;
      var largo = Math.sqrt(dx * dx + dy * dy) || 1;
      // La cota se corre hacia afuera del lote, perpendicular al lado.
      var fuera = 13, hx = -dy / largo * fuera, hy = dx / largo * fuera;
      var haciaAdentro = (mx + hx - W / 2) * (mx - W / 2) + (my + hy - H / 2) * (my - H / 2);
      if (haciaAdentro < 0) { hx = -hx; hy = -hy; }
      /* La medida y la calle van en UN solo rótulo. Separados —la cota
         pegada al lado y el nombre más afuera— se pisaban entre ellos en
         cuanto el dibujo se imprimía pequeño, que es como termina en la
         lámina. */
      var rot = l.largoM + ' m' + (l.via ? ' · ' + String(l.via).slice(0, 14) : '');
      return (esCritica
        ? '<path d="M' + n1(p1.x) + ' ' + n1(p1.y) + 'L' + n1(p2.x) + ' ' + n1(p2.y) + '" ' +
          'stroke="' + ALERTA + '" stroke-width="4" stroke-linecap="round"/>'
        : '') +
        '<text x="' + n1(mx + hx) + '" y="' + n1(my + hy + 3) + '" font-size="8.5" ' +
        'text-anchor="middle" font-weight="700" fill="' + (esCritica ? ALERTA : GRIS) + '">' +
        esc(rot) + '</text>';
    }).join('');

    var esquinas = P.map(function (p) {
      return '<circle cx="' + n1(p.x) + '" cy="' + n1(p.y) + '" r="2.6" fill="' + TINTA + '"/>';
    }).join('');

    // La barra de escala: sin ella el dibujo no es un plano, es un icono.
    var metrosBarra = (function () {
      var candidatos = [5, 10, 20, 25, 50, 100, 200];
      for (var i = 0; i < candidatos.length; i++) {
        if (candidatos[i] * escala >= 40) return candidatos[i];
      }
      return candidatos[candidatos.length - 1];
    })();
    var largoBarra = metrosBarra * escala;

    return '<svg class="pcr-plano-lote" viewBox="0 0 ' + W + ' ' + (H + 38) + '" width="' + W + '" ' +
      'height="' + (H + 38) + '" role="img" aria-label="' +
      esc(o.etiqueta || 'Plano acotado del lote: cada lado con su largo, la calle a la que da y ' +
      'en rojo la fachada que recibe el sol de la tarde') + '">' +
      '<path d="' + contorno + '" fill="#FFD54F" fill-opacity=".28" stroke="#7A5901" stroke-width="1.6"/>' +
      lados + esquinas +
      // Norte
      '<g transform="translate(' + (W - 18) + ',18)">' +
        '<path d="M0 -11L4 6L0 2L-4 6Z" fill="' + TINTA + '"/>' +
        '<text x="0" y="17" font-size="8" text-anchor="middle" font-weight="700" fill="' + TINTA + '">N</text>' +
      '</g>' +
      // Escala
      '<g transform="translate(12,' + (H + 14) + ')">' +
        '<path d="M0 0H' + n1(largoBarra) + 'M0 -4V4M' + n1(largoBarra) + ' -4V4" stroke="' + TINTA + '" stroke-width="1.2"/>' +
        '<text x="' + n1(largoBarra + 6) + '" y="3.5" font-size="8" fill="' + GRIS + '">' + metrosBarra + ' m</text>' +
      '</g>' +
      /* La leyenda va en su propio renglón, debajo de la escala: al lado se
         montaba encima de la barra en cuanto la barra medía cien metros. */
      (a.critica
        ? '<text x="12" y="' + (H + 31) + '" font-size="8" fill="' + ALERTA + '" ' +
          'font-weight="700">En rojo, la fachada que recibe el sol de la tarde.</text>'
        : '') +
      '</svg>';
  }

  /* ── 4 · Trama de llenos y vacíos ───────────────────────────────────────
     Cien cuadraditos: los llenos, llenos. Es la manera más vieja y más rápida
     de leer un porcentaje sin leerlo —el ojo cuenta filas— y sirve impresa en
     blanco y negro, que es como termina la mitad de las láminas. */
  function trama(pct, opts) {
    var p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    var o = opts || {};
    var lado = 9, hueco = 2, cols = 10, filas = 10;
    var W = cols * (lado + hueco) - hueco;
    var celdas = '';
    for (var i = 0; i < cols * filas; i++) {
      // Se llena de abajo hacia arriba: una trama que crece hacia arriba se
      // lee como un tanque que se llena, y esa es la lectura que se quiere.
      var fila = filas - 1 - Math.floor(i / cols), col = i % cols;
      var lleno = i < p;
      celdas += '<rect x="' + (col * (lado + hueco)) + '" y="' + (fila * (lado + hueco)) + '" ' +
        'width="' + lado + '" height="' + lado + '" rx="1.2" ' +
        'fill="' + (lleno ? (o.color || AZUL) : '#EEF3F7') + '"/>';
    }
    return '<svg class="pcr-trama" viewBox="0 0 ' + W + ' ' + W + '" width="' + W + '" height="' + W + '" ' +
      'role="img" aria-label="' + esc(o.etiqueta || (p + ' de cada cien')) + '">' + celdas + '</svg>';
  }

  /* ── 5 · Corte topográfico ──────────────────────────────────────────────
     El dibujo que la ficha ya hacía, pero hecho como se hace un corte: con
     escala. El de antes estiraba el terreno hasta llenar la caja
     (`preserveAspectRatio="none"`), así que una loma de tres metros y un
     barranco de ochenta salían con la misma silueta y en ninguna parte decía
     cuánto se había estirado. Un corte sin escala no es un corte: es un
     garabato con forma de montaña.

     Acá el eje horizontal va a escala real y el vertical se exagera —como en
     cualquier lámina de topografía, porque si no un sector de un kilómetro
     con veinte metros de desnivel sale plano— pero la exageración se CALCULA
     y se ESCRIBE en el dibujo: «V ×8». Con eso el corte se puede leer, y se
     puede desconfiar de él con conocimiento de causa.

     `marca` sombrea un tramo del recorrido —el lote, normalmente— para que se
     vea dónde cae dentro del corte. */
  function corteTopografico(corte, opts) {
    var c = corte || {}, o = opts || {};
    var pts = (c.puntos || []).filter(function (p) {
      return p && isFinite(p.d) && isFinite(p.z);
    });
    if (pts.length < 3) return '';

    var W = 320, H = 118, mIzq = 26, mDer = 8, mAr = 16, mAb = 22;
    var util = { w: W - mIzq - mDer, h: H - mAr - mAb };
    var dMax = pts[pts.length - 1].d || 1;
    var zs = pts.map(function (p) { return p.z; });
    var zMin = Math.min.apply(null, zs), zMax = Math.max.apply(null, zs);
    var relieve = zMax - zMin;

    /* La exageración: la que hace que el relieve ocupe unos dos tercios del
       alto útil, redondeada a un número que se pueda decir en voz alta. Con
       un terreno de verdad plano no se exagera nada — estirar dos metros
       ciento veinte veces dibuja una cordillera que no existe. */
    var escalaH = util.w / dMax;                       // unidades por metro
    var exagBruta = relieve > 0.5 ? (util.h * 0.66) / (relieve * escalaH) : 1;
    var PASOS = [1, 2, 3, 5, 8, 10, 15, 20, 30, 50, 75, 100];
    var exag = PASOS[0];
    for (var i = 0; i < PASOS.length; i++) if (PASOS[i] <= exagBruta) exag = PASOS[i];
    if (relieve <= 0.5) exag = 1;
    var escalaV = escalaH * exag;

    // La base del dibujo es una cota redonda por debajo del mínimo.
    var paso = relieve > 200 ? 50 : relieve > 80 ? 20 : relieve > 30 ? 10 : relieve > 8 ? 5 : 1;
    var zBase = Math.floor(zMin / paso) * paso;
    var X = function (d) { return mIzq + d * escalaH; };
    var Y = function (z) { return (H - mAb) - (z - zBase) * escalaV; };
    // Si con la exageración elegida el dibujo se sale por arriba, se recorta
    // la exageración en vez de dejar que el terreno salga de la caja.
    while (Y(zMax) < mAr && exag > 1) {
      exag = PASOS[Math.max(0, PASOS.indexOf(exag) - 1)];
      escalaV = escalaH * exag;
      if (exag === 1) break;
    }

    var linea = pts.map(function (p, i2) {
      return (i2 ? 'L' : 'M') + n1(X(p.d)) + ' ' + n1(Y(p.z));
    }).join(' ');
    var relleno = linea + ' L' + n1(X(dMax)) + ' ' + (H - mAb) + ' L' + n1(X(0)) + ' ' + (H - mAb) + ' Z';

    // Cotas al costado: solo las que caben, para no empedrar el eje.
    var cotas = '';
    for (var z = zBase; z <= zMax + paso; z += paso) {
      var y = Y(z);
      if (y < mAr - 2 || y > H - mAb) continue;
      cotas += '<path d="M' + mIzq + ' ' + n1(y) + 'H' + (W - mDer) + '" stroke="' + LINEA +
        '" stroke-width=".6" stroke-dasharray="2 3"/>' +
        '<text x="' + (mIzq - 3) + '" y="' + n1(y + 3) + '" font-size="7.5" text-anchor="end" ' +
        'fill="' + GRIS + '">' + Math.round(z) + '</text>';
    }

    // Marcas de distancia, cada 100, 200 o 500 m según lo largo que sea.
    var pasoD = dMax > 2500 ? 500 : dMax > 1200 ? 200 : 100;
    var ticks = '';
    for (var d = 0; d <= dMax; d += pasoD) {
      ticks += '<path d="M' + n1(X(d)) + ' ' + (H - mAb) + 'v4" stroke="' + GRIS + '" stroke-width=".8"/>' +
        '<text x="' + n1(X(d)) + '" y="' + (H - mAb + 12) + '" font-size="7" text-anchor="middle" ' +
        'fill="' + GRIS + '">' + d + '</text>';
    }

    // El tramo marcado: el lote, o lo que se pida.
    var marca = '';
    if (c.marca && isFinite(c.marca.desde) && isFinite(c.marca.hasta) && c.marca.hasta > c.marca.desde) {
      var x1 = X(c.marca.desde), x2 = X(c.marca.hasta);
      // Un lote de veinte metros en un corte de un kilómetro es una raya de
      // medio milímetro: se le da un ancho mínimo visible y se dice al pie
      // que está exagerado, que es preferible a que no se vea.
      if (x2 - x1 < 3) { var m2 = (x1 + x2) / 2; x1 = m2 - 1.5; x2 = m2 + 1.5; }
      marca = '<rect x="' + n1(x1) + '" y="' + mAr + '" width="' + n1(x2 - x1) + '" ' +
        'height="' + n1(H - mAb - mAr) + '" fill="#FFD54F" fill-opacity=".45"/>' +
        '<text x="' + n1((x1 + x2) / 2) + '" y="' + (mAr - 5) + '" font-size="7.5" ' +
        'text-anchor="middle" font-weight="700" fill="#7A5901">' +
        esc(c.marca.texto || 'el lote') + '</text>';
    }

    // El tramo que cae dentro del área analizada, sobre el eje.
    var dentro = pts.filter(function (p) { return p.dentro; });
    var barra = dentro.length
      ? '<path d="M' + n1(X(dentro[0].d)) + ' ' + (H - mAb + 2) + 'H' +
        n1(X(dentro[dentro.length - 1].d)) + '" stroke="' + AZUL + '" stroke-width="2"/>'
      : '';

    return '<svg class="pcr-corte" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" ' +
      'role="img" aria-label="' + esc((c.etiqueta || 'Corte del terreno') + ': de ' +
        Math.round(zMin) + ' a ' + Math.round(zMax) + ' metros sobre el nivel del mar en ' +
        Math.round(dMax) + ' metros de recorrido') + '">' +
      cotas +
      '<path d="' + relleno + '" fill="' + AZUL + '" fill-opacity=".13"/>' +
      marca +
      '<path d="' + linea + '" fill="none" stroke="' + TINTA + '" stroke-width="1.6" ' +
        'stroke-linejoin="round"/>' +
      '<path d="M' + mIzq + ' ' + (H - mAb) + 'H' + (W - mDer) + '" stroke="' + GRIS + '" stroke-width="1"/>' +
      barra + ticks +
      '<text x="' + mIzq + '" y="10" font-size="8" font-weight="700" fill="' + TINTA + '">' +
        esc(c.etiqueta || 'Corte') + '</text>' +
      '<text x="' + (W - mDer) + '" y="10" font-size="7.5" text-anchor="end" fill="' + GRIS + '">' +
        'V ×' + exag + ' · ' + Math.round(zMax - zMin) + ' m de desnivel</text>' +
      '<text x="' + (W - mDer) + '" y="' + (H - 3) + '" font-size="7" text-anchor="end" ' +
        'fill="' + GRIS + '">metros de recorrido</text>' +
      '</svg>';
  }

  /* ── 6 · Las sombras de los vecinos sobre el lote ───────────────────────
     Tres horas en una sola planta: la mañana, el mediodía y la tarde. Las
     sombras se pintan translúcidas, así que donde se cruzan el papel se
     oscurece solo y se ve de un vistazo qué parte del lote no ve el sol en
     todo el día.

     El lote va encima de todo, en amarillo: la pregunta del dibujo no es
     «cómo son las sombras» sino «cuánto de MI lote tapan». */
  var TINTE_HORA = { 9: '#F2B441', 12: '#7C4DFF', 15: '#0A6F9E' };

  function planoDeSombras(datos, opts) {
    var d = datos || {}, o = opts || {};
    var lote = d.lote || [];
    if (lote.length < 3 || !d.horas || !d.horas.length) return '';
    var W = 300, H = 240, pad = 18;

    var lat0 = d.centro ? d.centro.lat : lote[0].lat;
    var rad = Math.PI / 180;
    var kx = Math.cos(lat0 * rad) * 111320, ky = 110540;
    var lng0 = d.centro ? d.centro.lng : lote[0].lng;
    var M = function (p) { return { x: (p.lng - lng0) * kx, y: -(p.lat - lat0) * ky }; };

    // La ventana del dibujo: el lote y lo que lo rodea, con un tope para que
    // una torre lejana con sombra de doscientos metros no encoja el lote a un
    // punto. Lo que quede fuera se recorta.
    var todos = lote.map(M);
    (d.huellasCerca || []).forEach(function (e) { e.anillo.forEach(function (p) { todos.push(M(p)); }); });
    d.horas.forEach(function (h) {
      (h.sombras || []).forEach(function (poli) { poli.forEach(function (p) { todos.push(M(p)); }); });
    });
    var lim = 130;   // metros a cada lado del centro, como mucho
    var minX = Math.max(-lim, Math.min.apply(null, todos.map(function (q) { return q.x; })));
    var maxX = Math.min(lim, Math.max.apply(null, todos.map(function (q) { return q.x; })));
    var minY = Math.max(-lim, Math.min.apply(null, todos.map(function (q) { return q.y; })));
    var maxY = Math.min(lim, Math.max.apply(null, todos.map(function (q) { return q.y; })));
    var anchoM = Math.max(40, maxX - minX), altoM = Math.max(40, maxY - minY);
    var k = Math.min((W - pad * 2) / anchoM, (H - pad * 2 - 22) / altoM);
    var oX = (W - anchoM * k) / 2 - minX * k;
    var oY = (H - 22 - altoM * k) / 2 - minY * k;
    var X = function (q) { return oX + q.x * k; };
    var Y = function (q) { return oY + q.y * k; };
    var camino = function (poli) {
      return poli.map(function (p, i) {
        var q = M(p);
        return (i ? 'L' : 'M') + n1(X(q)) + ' ' + n1(Y(q));
      }).join(' ') + ' Z';
    };

    var sombras = d.horas.map(function (h) {
      if (!h.sombras || !h.sombras.length) return '';
      return '<g fill="' + (TINTE_HORA[h.hora] || TINTA) + '" fill-opacity=".22" ' +
        'stroke="' + (TINTE_HORA[h.hora] || TINTA) + '" stroke-opacity=".5" stroke-width=".8">' +
        h.sombras.map(function (poli) { return '<path d="' + camino(poli) + '"/>'; }).join('') +
        '</g>';
    }).join('');

    var edificios = (d.huellasCerca || []).map(function (e) {
      return '<path d="' + camino(e.anillo) + '" fill="#3B4A5A" fill-opacity=".85"/>';
    }).join('');

    var leyenda = d.horas.map(function (h, i) {
      var x = 8 + i * 74;
      return '<rect x="' + x + '" y="' + (H - 14) + '" width="8" height="8" rx="1.5" ' +
        'fill="' + (TINTE_HORA[h.hora] || TINTA) + '" fill-opacity=".45"/>' +
        '<text x="' + (x + 12) + '" y="' + (H - 7) + '" font-size="7.5" fill="' + GRIS + '">' +
        h.hora + ':00 · ' + h.pctLote + '% del lote</text>';
    }).join('');

    return '<svg class="pcr-sombras" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" ' +
      'role="img" aria-label="' + esc(o.etiqueta || ('Sombras de los edificios vecinos sobre el lote a ' +
      'las ' + d.horas.map(function (h) { return h.hora + ':00, que tapan el ' + h.pctLote + '% del lote'; })
      .join('; '))) + '">' +
      '<rect x="0" y="0" width="' + W + '" height="' + (H - 20) + '" fill="#F7FAFC"/>' +
      sombras + edificios +
      '<path d="' + camino(lote) + '" fill="#FFD54F" fill-opacity=".45" stroke="#7A5901" stroke-width="1.8"/>' +
      '<g transform="translate(' + (W - 16) + ',16)">' +
        '<path d="M0 -10L3.5 5L0 1.5L-3.5 5Z" fill="' + TINTA + '"/>' +
        '<text x="0" y="15" font-size="7" text-anchor="middle" font-weight="700" fill="' + TINTA + '">N</text>' +
      '</g>' +
      (function () {
        var metros = anchoM > 160 ? 50 : anchoM > 80 ? 25 : 10;
        var largo = metros * k;
        return '<g transform="translate(8,' + (H - 26) + ')">' +
          '<path d="M0 0H' + n1(largo) + 'M0 -3V3M' + n1(largo) + ' -3V3" stroke="' + TINTA + '" stroke-width="1"/>' +
          '<text x="' + n1(largo + 5) + '" y="3" font-size="7" fill="' + GRIS + '">' + metros + ' m</text>' +
        '</g>';
      })() +
      leyenda +
      '</svg>';
  }

  window.URBIS_DIBUJO = {
    planoDeSombras: planoDeSombras,
    corteTopografico: corteTopografico,
    cartaSolar: cartaSolar,
    rosaDeRumbos: rosaDeRumbos,
    planoDelLote: planoDelLote,
    trama: trama,
    // Los colores se exponen para que quien componga un bloque nuevo use los
    // mismos y no invente un azul propio.
    COLORES: { TINTA: TINTA, GRIS: GRIS, LINEA: LINEA, AZUL: AZUL, CIELO: CIELO,
               ALERTA: ALERTA, AMBAR: AMBAR }
  };
})();
