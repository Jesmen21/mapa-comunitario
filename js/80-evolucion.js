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
       sirve Collection 2 completa —Landsat 4 a 9, 1982 en adelante, global—
       sin llave y con un renderizador que devuelve PNG, que es lo único que
       un navegador puede leer píxel a píxel.

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

  /* ── Las entregas de Wayback ───────────────────────────────────────────
     Esri no publica una imagen «de 2016»: publica ENTREGAS con fecha, cada
     una con su número, y cada entrega es un mosaico de teselas. No hay
     ningún parámetro `año` ni ningún endpoint que recorte un rectángulo: lo
     único que existe es la tesela.

     Eso es lo que estaba mal. La primera versión de este módulo pedía
     `.../World_Imagery/MapServer/export?bbox=…&anio=2016`, que es un
     endpoint que no existe en ese servidor y un parámetro que no existe en
     ningún sitio. Se escribió de memoria porque desde donde se programa no
     se alcanza el servicio, y se avisó entonces de que hacía falta probarlo
     en un teléfono. Se probó y no funcionaba: de ahí salió esto.

     La tabla es la ÚLTIMA entrega de cada año, sacada del índice que publica
     Esri (`waybackconfig.json`). Va escrita acá y no se pide en caliente por
     dos razones: una entrega vieja no cambia nunca, y una serie de doce años
     no puede depender de que un archivo de configuración conteste. Lo que sí
     se hace, en segundo plano y sin bloquear nada, es refrescarla: así el
     año en curso mejora solo según Esri va publicando. */
  var ENTREGAS = {
    2014: { r: 5844,  f: '2014-12-30' },
    2015: { r: 28163, f: '2015-12-16' },
    2016: { r: 18966, f: '2016-12-20' },
    2017: { r: 25521, f: '2017-11-16' },
    2018: { r: 23448, f: '2018-12-14' },
    2019: { r: 4756,  f: '2019-12-12' },
    2020: { r: 29260, f: '2020-12-16' },
    2021: { r: 26120, f: '2021-12-21' },
    2022: { r: 45134, f: '2022-12-14' },
    2023: { r: 56102, f: '2023-12-07' },
    2024: { r: 16453, f: '2024-12-12' },
    2025: { r: 13192, f: '2025-12-18' },
    2026: { r: 26334, f: '2026-08-05' }
  };
  var CONFIG_WAYBACK =
    'https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json';
  var TESELA_WAYBACK =
    'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/' +
    'default028mm/MapServer/tile/{r}/{z}/{y}/{x}';

  var refrescando = null;
  function refrescarEntregas() {
    if (refrescando) return refrescando;
    if (typeof fetch !== 'function') return Promise.resolve(ENTREGAS);
    refrescando = fetch(CONFIG_WAYBACK, { mode: 'cors' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return ENTREGAS;
        Object.keys(d).forEach(function (num) {
          var t = (d[num] && d[num].itemTitle) || '';
          var m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
          if (!m) return;
          var a = m[1];
          if (!ENTREGAS[a] || m[0] > ENTREGAS[a].f) ENTREGAS[a] = { r: Number(num), f: m[0] };
        });
        return ENTREGAS;
      })
      .catch(function () { return ENTREGAS; });
    return refrescando;
  }

  /* La entrega que le toca a un año. Si ese año no existe —alguien pide 2013
     o el año que viene— se usa la más cercana y se dice cuál, porque
     enseñarle a alguien una foto de 2014 rotulada «2013» es mentir. */
  function entregaDe(anio) {
    if (ENTREGAS[anio]) return { anio: anio, r: ENTREGAS[anio].r, fecha: ENTREGAS[anio].f };
    var anios = Object.keys(ENTREGAS).map(Number).sort(function (a, b) { return a - b; });
    if (!anios.length) return null;
    var cerca = anios.reduce(function (mejor, a) {
      return Math.abs(a - anio) < Math.abs(mejor - anio) ? a : mejor;
    }, anios[0]);
    return { anio: cerca, r: ENTREGAS[cerca].r, fecha: ENTREGAS[cerca].f, sustituto: true };
  }

  /* ── De grados a teselas ───────────────────────────────────────────────
     Mercator web, que es la proyección en la que están todas las teselas del
     mundo. `mercX` y `mercY` devuelven la posición en el mundo entero, de 0
     a 1; multiplicada por 256·2^z da el píxel. */
  function mercX(lng) { return (lng + 180) / 360; }
  function mercY(lat) {
    var r = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180;
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
  }

  /* El zoom al que el sector mide aproximadamente `tam` píxeles. Se redondea
     hacia ARRIBA —más detalle del pedido y se recorta— porque al revés la
     imagen saldría interpolada, y una foto ampliada por software no es una
     foto de más resolución: es la misma con los bordes blandos. */
  function zoomPara(caja, tam) {
    var dx = Math.abs(mercX(caja.e) - mercX(caja.o));
    if (!(dx > 0)) return 16;
    var z = Math.ceil(Math.log(tam / (256 * dx)) / Math.LN2);
    return Math.max(1, Math.min(19, z));
  }

  function teselaImagen(url, msTope) {
    return new Promise(function (listo, falla) {
      var im = new Image();
      im.crossOrigin = 'anonymous';
      var reloj = setTimeout(function () { falla(new Error('la tesela tardó demasiado')); },
                             msTope || 20000);
      im.onerror = function () { clearTimeout(reloj); falla(new Error('no se pudo descargar la tesela')); };
      im.onload = function () { clearTimeout(reloj); listo(im); };
      im.src = url;
    });
  }

  /* Traer el sector de una entrega de Wayback: se bajan las teselas que lo
     cubren, se pegan y se recorta la caja. Con el zoom elegido son entre una
     y cuatro; el tope existe para que una caja rarísima no dispare cien
     descargas en un teléfono. */
  var TOPE_TESELAS = 16;

  /* ── Pegar teselas ─────────────────────────────────────────────────────
     Lo que tienen en común Wayback y Landsat: el mundo viene en cuadrados de
     256 píxeles y el sector cae en uno, en dos o en cuatro. Se bajan los que
     lo cubren, se pegan y se recorta la caja. `urlDe(z, x, y)` es lo único
     que cambia entre un proveedor y otro. El tope existe para que una caja
     rarísima no dispare cien descargas en un teléfono. */
  function pegarTeselas(urlDe, caja, tam, msTope, extra) {
    var z = zoomPara(caja, tam), mundo = 256 * Math.pow(2, z);
    var px0 = mercX(caja.o) * mundo, px1 = mercX(caja.e) * mundo;
    var py0 = mercY(caja.n) * mundo, py1 = mercY(caja.s) * mundo;
    var tx0 = Math.floor(px0 / 256), tx1 = Math.floor((px1 - 0.001) / 256);
    var ty0 = Math.floor(py0 / 256), ty1 = Math.floor((py1 - 0.001) / 256);
    var anchoT = tx1 - tx0 + 1, altoT = ty1 - ty0 + 1;
    if (anchoT * altoT > TOPE_TESELAS) {
      return Promise.reject(new Error('el sector pide ' + (anchoT * altoT) + ' teselas'));
    }
    var pedidos = [];
    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        (function (x, y) {
          pedidos.push(teselaImagen(urlDe(z, x, y), msTope).then(function (im) {
            return { im: im, dx: (x - tx0) * 256, dy: (y - ty0) * 256 };
          }));
        })(tx, ty);
      }
    }
    return Promise.all(pedidos).then(function (trozos) {
      var grande = document.createElement('canvas');
      grande.width = anchoT * 256; grande.height = altoT * 256;
      var gx = grande.getContext('2d');
      trozos.forEach(function (t) { gx.drawImage(t.im, t.dx, t.dy); });
      var cv = document.createElement('canvas');
      cv.width = tam; cv.height = tam;
      var cx = cv.getContext('2d');
      cx.drawImage(grande, px0 - tx0 * 256, py0 - ty0 * 256,
                   Math.max(1, px1 - px0), Math.max(1, py1 - py0), 0, 0, tam, tam);
      grande.width = grande.height = 1;
      try {
        return Object.assign({ datos: cx.getImageData(0, 0, tam, tam).data, tam: tam, lienzo: cv,
                               url: cv.toDataURL('image/png'), zoom: z }, extra || {});
      } catch (e) {
        throw new Error('el navegador bloqueó la lectura de la imagen (CORS)');
      }
    });
  }

  function traerWayback(anio, caja, tam, msTope) {
    var ent = entregaDe(anio);
    if (!ent) return Promise.reject(new Error('no hay entrega de Wayback para ' + anio));
    return pegarTeselas(function (z, x, y) {
      return TESELA_WAYBACK.replace('{r}', ent.r).replace('{z}', z)
                           .replace('{y}', y).replace('{x}', x);
    }, caja, tam, msTope, { fecha: ent.fecha, anioReal: ent.anio, sustituto: !!ent.sustituto });
  }

  /* ── Landsat, por el Planetary Computer ────────────────────────────────
     Son dos peticiones y no una: primero se REGISTRA una búsqueda —qué
     colección, qué años, cuánta nube se tolera— y el servidor devuelve un
     identificador y unos ENLACES; con ellos se piden las teselas.

     La versión anterior registraba bien y después pedía un recorte en una
     ruta que se escribió de memoria. Llegó la respuesta en captura, y era
     la del servidor diciendo que esa ruta no existe: «404 {"detail":"Not
     Found"}». Lo que sí existía era el registro, y el registro devuelve la
     lista de enlaces con la plantilla de teselas. Así que ya no se adivina
     ninguna ruta: se lee la que el servidor manda (`rel: tilejson`), se le
     piden las teselas y se pegan igual que las de Wayback. Si el día de
     mañana mueven la ruta, mueven el enlace con ella.

     El NDVI se pide calculado en el servidor, en la escala de la
     Colección 2: los valores vienen como enteros con factor 0,0000275 y
     desplazamiento −0,2, y el desplazamiento NO se cancela en la división,
     así que se corrige en el denominador (2 × 0,2 / 0,0000275 ≈ 14.545). Sin
     eso el índice sale comprimido hacia cero y el verde se subestima. */
  var PC = 'https://planetarycomputer.microsoft.com/api/data/v1';
  var COLECCION_LANDSAT = 'landsat-c2-l2';
  var EXPRESION_NDVI = '(nir08-red)/(nir08+red-14545)';
  var diagnostico = [];
  function anota(x) {
    diagnostico.push(Object.assign({ cuando: new Date().toISOString() }, x));
    if (diagnostico.length > 40) diagnostico.shift();
  }
  function motivoDeRed(e) {
    var m = (e && e.message) || 'falló';
    // Un `fetch` que ni sale de la máquina no trae código: eso es CORS o no
    // hay red, y conviene decirlo porque se arregla distinto.
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) {
      m = 'el navegador no pudo llegar al servicio (CORS o sin red)';
    }
    return m;
  }

  var busquedas = {};
  function registrarBusqueda(anio, caja) {
    var llave = anio + ':' + Math.round(caja.latC * 1000) + ',' + Math.round(caja.lngC * 1000);
    if (busquedas[llave]) return busquedas[llave];
    var cuerpo = {
      collections: [COLECCION_LANDSAT],
      datetime: anio + '-01-01T00:00:00Z/' + anio + '-12-31T23:59:59Z',
      bbox: [caja.o, caja.s, caja.e, caja.n],
      // Menos de un tercio de nube: por encima de eso la escena mide la nube
      // y no el suelo, y la serie mentiría con cara de dato.
      query: { 'eo:cloud_cover': { lt: 30 } },
      // La más limpia primero, que es la que el mosaico va a usar arriba.
      sortby: [{ field: 'eo:cloud_cover', direction: 'asc' }]
    };
    busquedas[llave] = fetch(PC + '/mosaic/register', {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    }).then(function (r) {
      if (!r.ok) {
        return r.text().catch(function () { return ''; }).then(function (t) {
          anota({ paso: 'registrar', anio: anio, estado: r.status,
                  cuerpo: String(t || '').replace(/\s+/g, ' ').slice(0, 160) });
          throw new Error('el catálogo no aceptó la búsqueda (' + r.status + ')');
        });
      }
      return r.json();
    }).then(function (j) {
      var id = j && (j.searchid || j.searchId || j.id);
      if (!id) {
        anota({ paso: 'registrar', anio: anio, estado: 'sin identificador',
                cuerpo: JSON.stringify(j).slice(0, 200) });
        throw new Error('el catálogo no devolvió identificador de búsqueda');
      }
      /* El enlace al tilejson, tal como lo manda el servidor. Es la pieza
         que faltaba: con él no hay ruta que adivinar. Si no viene, se prueba
         la forma documentada y se deja anotado que se tuvo que suponer. */
      var enlaces = Array.isArray(j.links) ? j.links : [];
      var tj = enlaces.filter(function (l) { return l && l.rel === 'tilejson' && l.href; })[0];
      var hrefTJ = tj ? String(tj.href) : (PC + '/mosaic/' + id + '/tilejson.json');
      anota({ paso: 'registrar', anio: anio, estado: 'ok', id: String(id).slice(0, 12),
              tilejson: tj ? 'del servidor' : 'supuesto' });
      return { id: id, tilejson: hrefTJ };
    }).catch(function (e) {
      delete busquedas[llave];   // que un fallo no se quede pegado para siempre
      var m = motivoDeRed(e);
      anota({ paso: 'registrar', anio: anio, error: m });
      throw new Error(m);
    });
    return busquedas[llave];
  }

  /* La plantilla de teselas de una búsqueda ya registrada. Se pide al
     tilejson con los parámetros de dibujo —qué expresión, qué escala, qué
     colección— y él devuelve la URL de tesela con todo eso ya puesto y con
     `{z}/{x}/{y}` donde van las coordenadas. */
  var plantillas = {};
  function plantillaDeTeselas(reg, anio) {
    if (plantillas[reg.id]) return plantillas[reg.id];
    var sep = reg.tilejson.indexOf('?') === -1 ? '?' : '&';
    var url = reg.tilejson + sep +
      'collection=' + encodeURIComponent(COLECCION_LANDSAT) +
      '&expression=' + encodeURIComponent(EXPRESION_NDVI) +
      '&asset_as_band=true&rescale=-1,1&format=png&tile_format=png';
    plantillas[reg.id] = fetch(url, { mode: 'cors' }).then(function (r) {
      if (!r.ok) {
        return r.text().catch(function () { return ''; }).then(function (t) {
          anota({ paso: 'tilejson', anio: anio, estado: r.status,
                  cuerpo: String(t || '').replace(/\s+/g, ' ').slice(0, 160) });
          throw new Error('el tilejson devolvió ' + r.status +
            (t ? ': ' + String(t).replace(/\s+/g, ' ').slice(0, 90) : ''));
        });
      }
      return r.json();
    }).then(function (j) {
      var t = j && Array.isArray(j.tiles) && j.tiles[0];
      if (!t || t.indexOf('{z}') === -1) {
        anota({ paso: 'tilejson', anio: anio, estado: 'sin plantilla',
                cuerpo: JSON.stringify(j).slice(0, 160) });
        throw new Error('el tilejson no trajo plantilla de teselas');
      }
      anota({ paso: 'tilejson', anio: anio, estado: 'ok',
              plantilla: String(t).replace(/\?.*$/, '').slice(-60) });
      return String(t);
    }).catch(function (e) {
      delete plantillas[reg.id];
      var m = motivoDeRed(e);
      anota({ paso: 'tilejson', anio: anio, error: m });
      throw new Error(m);
    });
    return plantillas[reg.id];
  }

  function traerLandsat(anio, caja, tam, msTope) {
    return registrarBusqueda(anio, caja).then(function (reg) {
      return plantillaDeTeselas(reg, anio);
    }).then(function (plantilla) {
      return pegarTeselas(function (z, x, y) {
        return plantilla.replace('{z}', z).replace('{x}', x).replace('{y}', y);
      }, caja, tam, msTope).then(function (img) {
        anota({ paso: 'teselas', anio: anio, estado: 'ok', zoom: img.zoom });
        return img;
      }, function (e) {
        var m = motivoDeRed(e);
        anota({ paso: 'teselas', anio: anio, error: m });
        throw new Error(m);
      });
    });
  }

  /* ── Traer el sector de un año ─────────────────────────────────────────
     El punto único por donde este módulo habla con la red. Se deja
     sustituible entero —`window.URBIS_EVOLUCION_TRAER`— y no solo la URL:
     Wayback pega varias teselas y Landsat hace dos peticiones, así que una
     sola dirección ya no describe lo que pasa. `URBIS_EVOLUCION_URL` sigue
     funcionando para lo que sí es una imagen suelta. */
  function traerDe(fuenteId, anio, caja, tam, msTope) {
    if (typeof window.URBIS_EVOLUCION_TRAER === 'function') {
      return Promise.resolve(window.URBIS_EVOLUCION_TRAER(fuenteId, anio, caja, tam));
    }
    if (typeof window.URBIS_EVOLUCION_URL === 'function') {
      return traerImagen(window.URBIS_EVOLUCION_URL(fuenteId, anio, caja, tam), tam, msTope);
    }
    if (fuenteId === 'wayback') return traerWayback(anio, caja, tam, msTope);
    return traerLandsat(anio, caja, tam, msTope);
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
        return traerDe(fuente.id, anio, caja, tam, o.msTope)
          .then(function (img) {
            var hueco = huecoDe(img);
            var med = fuente.modo === 'indice' ? medirIndice(img, fuente.rango) : null;
            pasos.push({ anio: anio, ok: true, hueco: hueco,
                         // Con más de la mitad sin dato, la proporción se
                         // calcula sobre una muestra que no representa nada.
                         fiable: hueco < 50,
                         medida: med, imagen: img.url,
                         /* Qué se trajo de verdad. Wayback publica por
                            entregas con fecha, no por años: si el año pedido
                            no tiene entrega se usa la más cercana, y eso hay
                            que poder decirlo debajo de la estampa en vez de
                            rotularla con un año que no es. */
                         fecha: img.fecha || null,
                         anioReal: img.anioReal || anio,
                         sustituto: !!img.sustituto });
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
    ENTREGAS: ENTREGAS,
    entregaDe: entregaDe,
    refrescarEntregas: refrescarEntregas,
    zoomPara: zoomPara,
    traerDe: traerDe,
    /* Qué pasó en la última tanda, paso por paso y con el código que devolvió
       el servidor. Es lo que convierte «no se pudo leer ninguna imagen» en
       algo que se puede arreglar: sin esto, un fallo en un teléfono ajeno es
       una adivinanza. */
    diagnostico: function () { return diagnostico.slice(); },
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
