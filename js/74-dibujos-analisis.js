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

  window.URBIS_DIBUJO = {
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
