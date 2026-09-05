/* URBIS · La evolución del sitio, año por año.

   Se pidió así: «ver la evolución del lote y todo su contexto a través de los
   años en base a imágenes satelitales, y que llegue a una conclusión de la
   evolución ambiental, hídrica o de movilidad».

   Son DOS series distintas, y no se mezclan nunca. Cada una contesta una
   pregunta que la otra no puede.

   ── La serie larga: 1984 en adelante, Landsat, 30 m por píxel ──────────
   La imagen se ve a cuadros y el lote son trece píxeles: para mirar no sirve.
   Para MEDIR sí, y esa es la parte que cuesta explicar y hay que decir bien:
   lo que se calcula no es una forma sino una PROPORCIÓN sobre miles de
   píxeles. Un sector de 1,3 km son unos dos mil píxeles de Landsat, y «38 %
   verde» sobre dos mil píxeles es un número sólido aunque la estampa sea fea.

   Y se mide con un ÍNDICE, no con el clasificador de colores que URBIS usa
   para la foto de hoy. El clasificador está calibrado para los colores de
   Esri; darle una imagen de otro satélite y comparar los resultados sería
   medir la diferencia entre dos cámaras y no entre dos años. El NDVI se
   calcula de la banda infrarroja, existe desde que existe Landsat y significa
   lo mismo en 1984 y en 2024. Es el instrumento hecho exactamente para esto.

   ── La serie corta: 2014 en adelante, alta resolución ─────────────────
   Las imágenes que sí se miran, del lote y su manzana, una al lado de la
   otra. Acá no se mide nada: se ve. Poner un porcentaje sobre estas y
   compararlo con el de las otras sería juntar lo que no se junta.

   ── Lo que este módulo NO puede decir ─────────────────────────────────
   La evolución de la movilidad. A 30 m no se ve una calle nueva, y el
   historial de OpenStreetMap dice cuándo alguien MAPEÓ una vía, no cuándo se
   construyó: mediría el trabajo de los mapeadores y no la ciudad. Lo que sí
   sale de la serie es el crecimiento de lo construido, que a escala de sector
   es la historia de la urbanización.

   ── Y una advertencia de método ───────────────────────────────────────
   Las nubes. Una escena nublada da un verde falso o un agua falsa, así que
   cada año trae su porcentaje de nube y los años muy nublados se marcan y no
   entran en la tendencia. Landsat 7 además perdió un sensor en 2003 y desde
   entonces sus imágenes salen con franjas sin dato; para 2003-2011 conviene
   Landsat 5, que estuvo vivo hasta 2011.                                    */
(function () {
  'use strict';

  /* ── El adaptador: lo único que habla con un servidor ──────────────────
     Está aislado a propósito. Todo lo demás de este módulo —la serie, los
     índices, la comparación, la conclusión— se prueba con imágenes
     simuladas y no depende de que ningún servicio conteste lo que uno cree.
     Si el día de mañana cambia la API, o se cambia de proveedor, se toca
     acá y en ningún otro sitio. */
  var FUENTES = {
    /* Landsat por el catálogo abierto de Microsoft Planetary Computer, que
       sirve Collection 2 completa —Landsat 4 a 9, 1982 en adelante,
       global— y tiene un renderizador que devuelve PNG, que es lo único
       que un navegador puede leer píxel a píxel.

       `modo: 'indice'` quiere decir que el PNG NO es una foto en color sino
       un índice en escala de grises: el valor del píxel mapea linealmente al
       rango declarado en `rango`. Es lo que hace comparables 1984 y hoy. */
    landsat: {
      id: 'landsat', nombre: 'Landsat', modo: 'indice',
      desde: 1984, hasta: (new Date()).getFullYear(),
      metrosPorPixel: 30,
      rango: [-1, 1]
    },
    /* Las versiones antiguas del mismo mosaico de alta resolución que URBIS
       ya usa para leer la foto de hoy. Va de 2014 en adelante porque antes
       de eso ese mosaico no existía. */
    wayback: {
      id: 'wayback', nombre: 'Foto de alta resolución', modo: 'rgb',
      desde: 2014, hasta: (new Date()).getFullYear(),
      metrosPorPixel: 0.6
    }
  };

  /* La URL de una imagen. Se deja SUSTITUIBLE —`window.URBIS_EVOLUCION_URL`—
     por dos razones que no son de estilo: probar esto sin red, y poder
     corregir un endpoint desde fuera si cambia, sin tocar el módulo. */
  function urlDe(fuenteId, anio, caja, tam) {
    if (typeof window.URBIS_EVOLUCION_URL === 'function') {
      return window.URBIS_EVOLUCION_URL(fuenteId, anio, caja, tam);
    }
    var bbox = [caja.o, caja.s, caja.e, caja.n].join(',');
    if (fuenteId === 'wayback') {
      return 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/export' +
        '?bbox=' + bbox + '&bboxSR=4326&imageSR=3857&size=' + tam + ',' + tam +
        '&format=png&transparent=false&f=image&anio=' + anio;
    }
    return 'https://planetarycomputer.microsoft.com/api/data/v1/mosaic/crop' +
      '?bbox=' + bbox + '&width=' + tam + '&height=' + tam +
      '&expression=(nir08-red)/(nir08%2Bred)&rescale=-1,1&format=png&year=' + anio;
  }

  /* ── Traer una imagen y poder leerle los píxeles ───────────────────────
     `crossOrigin` no es opcional: sin esa cabecera el navegador marca el
     lienzo como contaminado y `getImageData` lanza. Un servicio que no
     mande `Access-Control-Allow-Origin` no sirve para esto por más buena
     que sea su imagen. */
  function traerImagen(url, tam, msTope) {
    return new Promise(function (listo, falla) {
      var im = new Image();
      im.crossOrigin = 'anonymous';
      var reloj = setTimeout(function () {
        falla(new Error('la imagen tardó demasiado'));
      }, msTope || 25000);
      im.onerror = function () {
        clearTimeout(reloj);
        falla(new Error('no se pudo descargar la imagen'));
      };
      im.onload = function () {
        clearTimeout(reloj);
        try {
          var cv = document.createElement('canvas');
          cv.width = tam; cv.height = tam;
          var cx = cv.getContext('2d');
          cx.drawImage(im, 0, 0, tam, tam);
          listo({ datos: cx.getImageData(0, 0, tam, tam).data, tam: tam, lienzo: cv,
                  url: cv.toDataURL('image/png') });
        } catch (e) {
          falla(new Error('el navegador bloqueó la lectura de la imagen (CORS)'));
        }
      };
      im.src = url;
    });
  }

  /* ── Medir un índice ───────────────────────────────────────────────────
     El PNG viene en escala de grises y el valor del píxel mapea linealmente
     al rango del índice. Se cuenta cuántos píxeles pasan cada umbral, que es
     lo único que hace falta para una proporción.

     Los umbrales son los de la literatura y se escriben acá para que se
     puedan discutir: por debajo de 0,2 el NDVI es suelo desnudo o
     construido; de 0,2 a 0,4, vegetación rala o pasto seco; por encima de
     0,4, vegetación viva y densa. El agua da NDVI negativo. */
  var UMBRAL = { agua: 0, desnudo: 0.2, rala: 0.4 };

  function medirIndice(img, rango) {
    var d = img.datos, n = 0, agua = 0, duro = 0, rala = 0, viva = 0, suma = 0;
    var lo = rango[0], alto = rango[1], span = alto - lo;
    for (var i = 0; i < d.length; i += 4) {
      // Un píxel transparente es un hueco de la imagen —el borde de la
      // escena, o la franja que Landsat 7 dejó de registrar en 2003— y no se
      // cuenta: contarlo como cero lo volvería agua y la serie mentiría.
      if (d[i + 3] < 250) continue;
      var v = lo + (d[i] / 255) * span;
      n++; suma += v;
      if (v < UMBRAL.agua) agua++;
      else if (v < UMBRAL.desnudo) duro++;
      else if (v < UMBRAL.rala) rala++;
      else viva++;
    }
    if (!n) return null;
    var pct = function (x) { return Math.round(1000 * x / n) / 10; };
    return { pixeles: n, medio: Math.round(suma / n * 1000) / 1000,
             agua: pct(agua), duro: pct(duro), rala: pct(rala), viva: pct(viva),
             verde: pct(rala + viva) };
  }

  /* Cuánto de la imagen es hueco. Con una escena medio cubierta de nube —o
     medio fuera del borde— la proporción se calcula sobre lo que quedó, y eso
     puede ser una muestra sesgada: se dice y el año se marca. */
  function huecoDe(img) {
    var d = img.datos, hueco = 0, n = 0;
    for (var i = 0; i < d.length; i += 4) { n++; if (d[i + 3] < 250) hueco++; }
    return n ? Math.round(1000 * hueco / n) / 10 : 100;
  }

  /* ── La caja del sector, en grados ─────────────────────────────────────
     Cuadrada a propósito: las dos series piden imágenes cuadradas y una caja
     alargada las deformaría, que en una comparación entre años es justo lo
     que no puede pasar —parecería que el sitio cambió de forma—. */
  function cajaDe(pts, margen) {
    if (!pts || pts.length < 3) return null;
    var lats = pts.map(function (p) { return +p.lat; });
    var lngs = pts.map(function (p) { return +p.lng; });
    var s = Math.min.apply(null, lats), n = Math.max.apply(null, lats);
    var o = Math.min.apply(null, lngs), e = Math.max.apply(null, lngs);
    var latC = (s + n) / 2, lngC = (o + e) / 2;
    var kx = Math.cos(latC * Math.PI / 180);
    // El lado, medido en "grados de latitud" para que el cuadrado sea cuadrado
    // en el suelo y no en la proyección.
    var lado = Math.max(n - s, (e - o) * kx) * (1 + (margen == null ? 0.15 : margen));
    var medio = lado / 2;
    return { s: latC - medio, n: latC + medio,
             o: lngC - medio / kx, e: lngC + medio / kx,
             latC: latC, lngC: lngC, ladoM: Math.round(lado * 110540) };
  }

  /* ── Qué años pedir ───────────────────────────────────────────────────
     No todos: una serie de cuarenta imágenes son cuarenta descargas y
     cuarenta lecturas de píxeles en un teléfono. Con un paso de varios años
     se ve la tendencia igual, y los extremos —el primero y el último— van
     siempre, porque son los que se comparan. */
  function aniosDe(fuente, paso) {
    var f = FUENTES[fuente];
    if (!f) return [];
    var p = paso || (f.id === 'landsat' ? 5 : 3);
    var out = [];
    for (var a = f.desde; a <= f.hasta; a += p) out.push(a);
    if (out[out.length - 1] !== f.hasta) out.push(f.hasta);
    return out;
  }

  /* ── La serie ─────────────────────────────────────────────────────────
     Un año que falla no tumba la serie: se anota y se sigue. Con cuarenta
     años de por medio siempre va a haber alguno sin escena buena, y una serie
     de siete años con uno vacío dice bastante más que un error. */
  function serie(opciones) {
    var o = opciones || {};
    var fuente = FUENTES[o.fuente || 'landsat'];
    if (!fuente) return Promise.reject(new Error('fuente desconocida'));
    var caja = o.caja || cajaDe(o.contorno, o.margen);
    if (!caja) return Promise.reject(new Error('hace falta el contorno del sector'));
    var anios = o.anios || aniosDe(fuente.id, o.paso);
    var tam = o.tam || (fuente.modo === 'indice' ? 128 : 256);
    var avisar = typeof o.alAvisar === 'function' ? o.alAvisar : function () {};
    var pasos = [];

    return anios.reduce(function (cadena, anio, i) {
      return cadena.then(function () {
        avisar('Trayendo ' + anio + '… (' + (i + 1) + ' de ' + anios.length + ')');
        return traerImagen(urlDe(fuente.id, anio, caja, tam), tam, o.msTope)
          .then(function (img) {
            var hueco = huecoDe(img);
            var med = fuente.modo === 'indice' ? medirIndice(img, fuente.rango) : null;
            pasos.push({ anio: anio, ok: true, hueco: hueco,
                         // Con más de la mitad sin dato, la proporción se
                         // calcula sobre una muestra que no representa nada.
                         fiable: hueco < 50,
                         medida: med, imagen: img.url });
          }, function (e) {
            pasos.push({ anio: anio, ok: false, error: (e && e.message) || 'no se pudo' });
          });
      });
    }, Promise.resolve()).then(function () {
      return { fuente: fuente.id, nombre: fuente.nombre, modo: fuente.modo,
               metrosPorPixel: fuente.metrosPorPixel,
               caja: caja, tam: tam, pasos: pasos,
               tendencia: tendenciaDe(pasos) };
    });
  }

  /* ── La tendencia ─────────────────────────────────────────────────────
     Entre el primer año fiable y el último. No se hace una regresión: con
     siete puntos y una medición gruesa, una pendiente ajustada daría una
     falsa precisión —«−0,37 % por año»— sobre datos que no la aguantan. Lo
     que se puede afirmar es de dónde a dónde fue. */
  function tendenciaDe(pasos) {
    var buenos = pasos.filter(function (p) { return p.ok && p.fiable && p.medida; });
    if (buenos.length < 2) return null;
    var a = buenos[0], b = buenos[buenos.length - 1];
    var d = function (k) { return Math.round((b.medida[k] - a.medida[k]) * 10) / 10; };
    return {
      desde: a.anio, hasta: b.anio, aniosUsados: buenos.length,
      verde: d('verde'), viva: d('viva'), duro: d('duro'), agua: d('agua'),
      verdeDesde: a.medida.verde, verdeHasta: b.medida.verde,
      duroDesde: a.medida.duro, duroHasta: b.medida.duro,
      aguaDesde: a.medida.agua, aguaHasta: b.medida.agua
    };
  }

  /* ── La conclusión, en frases ─────────────────────────────────────────
     Cada una nace de un número y trae el número. Y el umbral de 3 puntos no
     es decoración: por debajo de eso, la diferencia cabe dentro del error de
     una medición a 30 m con otro satélite y otra fecha del año, y afirmar un
     cambio ahí sería inventar. */
  var MINIMO = 3;
  function conclusion(s) {
    if (!s || !s.tendencia) return [];
    var t = s.tendencia, out = [];
    var pp = function (x) { return (x > 0 ? '+' : '') + String(x).replace('.', ',') + ' puntos'; };

    if (t.verde <= -MINIMO) {
      out.push({ tema: 'ambiental', signo: 'mal',
        texto: 'El sector perdió vegetación entre ' + t.desde + ' y ' + t.hasta,
        dato: t.verdeDesde + '% → ' + t.verdeHasta + '% (' + pp(t.verde) + ')' });
    } else if (t.verde >= MINIMO) {
      out.push({ tema: 'ambiental', signo: 'bien',
        texto: 'El sector ganó vegetación entre ' + t.desde + ' y ' + t.hasta,
        dato: t.verdeDesde + '% → ' + t.verdeHasta + '% (' + pp(t.verde) + ')' });
    } else {
      out.push({ tema: 'ambiental', signo: 'igual',
        texto: 'La vegetación del sector se mantuvo entre ' + t.desde + ' y ' + t.hasta,
        dato: t.verdeDesde + '% → ' + t.verdeHasta + '%' });
    }

    if (t.duro >= MINIMO) {
      out.push({ tema: 'urbanizacion', signo: 'mal',
        texto: 'Se urbanizó: creció la superficie sin vegetación, que a esta escala es lo construido',
        dato: t.duroDesde + '% → ' + t.duroHasta + '% (' + pp(t.duro) + ')' });
    } else if (t.duro <= -MINIMO) {
      out.push({ tema: 'urbanizacion', signo: 'bien',
        texto: 'Retrocedió la superficie dura: o se reverdeció, o se abandonó',
        dato: t.duroDesde + '% → ' + t.duroHasta + '% (' + pp(t.duro) + ')' });
    }

    if (t.agua <= -MINIMO) {
      out.push({ tema: 'hidrica', signo: 'mal',
        texto: 'Hay menos agua a la vista que en ' + t.desde +
               '. Puede ser sequía, puede ser una quebrada canalizada o entubada',
        dato: t.aguaDesde + '% → ' + t.aguaHasta + '%' });
    } else if (t.agua >= MINIMO) {
      out.push({ tema: 'hidrica', signo: 'ojo',
        texto: 'Hay más agua a la vista que en ' + t.desde +
               '. Conviene mirar si el sitio se inunda o si cambió el cauce',
        dato: t.aguaDesde + '% → ' + t.aguaHasta + '%' });
    }
    return out;
  }

  window.URBIS_EVOLUCION = {
    FUENTES: FUENTES,
    urlDe: urlDe,
    cajaDe: cajaDe,
    aniosDe: aniosDe,
    medirIndice: medirIndice,
    huecoDe: huecoDe,
    tendenciaDe: tendenciaDe,
    conclusion: conclusion,
    serie: serie,
    UMBRAL: UMBRAL,
    MINIMO: MINIMO
  };
})();
