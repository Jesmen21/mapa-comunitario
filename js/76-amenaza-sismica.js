/* URBIS · La amenaza sísmica del sitio
   ═══════════════════════════════════════════════════════════════════════
   El Servicio Geológico Colombiano publica el Mapa Nacional de Amenaza
   Sísmica como servicio REST abierto, y con CORS: el navegador lo consulta
   directo, igual que hace con el DANE y con Overpass. No hace falta llave ni
   pasar por el motor.

   De ahí salen las cifras con las que la NSR-10 empieza cualquier proyecto:
   el nivel de amenaza del municipio y los coeficientes Aa y Av, que son los
   que definen el espectro de diseño. Para un curso de arquitectura esto no es
   un dato de contexto: es una determinante, y de las duras.

   Tres cosas que este módulo dice en voz alta donde haga falta, porque
   callarlas convertiría un dato bueno en uno peligroso:

   · El valor es del MUNICIPIO, no del lote. La capa es una nube de puntos,
     uno por cabecera municipal. Dentro de Cúcuta la respuesta es la misma en
     todas partes, y así lo pide la propia norma: la tabla A.2.3-2 de la
     NSR-10 da Aa y Av por municipio.

   · Si el municipio tiene MICROZONIFICACIÓN sísmica, esa manda sobre esto.
     Una microzonificación mide el suelo manzana por manzana y puede duplicar
     la aceleración de diseño respecto del mapa nacional.

   · Y esto no dimensiona nada. Dice qué le pide la norma al proyecto; el
     sistema estructural lo decide un ingeniero. Un estudiante de taller tiene
     que saber que su edificio está en amenaza alta y qué implica; no tiene
     que calcularlo acá.                                                    */
(function () {
  'use strict';

  var SGC = 'https://srvags.sgc.gov.co/arcgis/rest/services/';

  /* TRES capas, y cada una porque la anterior no alcanzaba.

     1 · Los coeficientes de la NSR-10, de la capa que existe para eso. Es de
         POLÍGONOS —los límites municipales—, así que la pregunta que se le
         hace es exacta: «¿dentro de qué municipio cae este punto?». No hay que
         buscar la cabecera más cercana ni elegir entre dos.

     2 · La curva de aceleración por periodo de retorno, de la capa del mapa
         sísmico. Esa es de puntos, uno por cabecera, y ahí sí hay que ir al
         más cercano. Trae los cinco periodos en una sola fila: pedir las
         cinco capas sería cinco consultas para repetir las mismas cifras.

     3 · Los movimientos en masa, que en una ciudad construida sobre laderas
         pesan más que el sismo. También por polígono municipal.

     Las tres se piden a la vez y cada una aguanta que las otras fallen: este
     servidor se cae de a una capa, no entero, y perder la curva no es razón
     para quedarse sin los coeficientes. */
  var CAPA_NSR = SGC + 'Zonas_amenaza_Sismica_NR10/Municipios_Amenaza_NR10/FeatureServer/0/query';
  var CAPA = SGC + 'Amenaza_Sismica/Mapa_Amenaza_Sismica_Nacional_PGA475/MapServer/0/query';
  var CAPA_MASA = SGC + 'Mapa_Nacional_Amenaza_Mov_Masa_100K/' +
                  'Mapa_Nacional_Amenaza_Movimientos_Masa_100K/FeatureServer/3/query';
  /* 4 · Cómo se SIENTE un sismo acá, en palabras. Aa = 0,35 no le dice nada a
     alguien de primer año; «se siente fuerte, con potencial de daño ligero»
     sí, y es la misma amenaza contada de la única manera que se puede llevar
     a una discusión de taller. También por polígono municipal. */
  var CAPA_INTENSIDAD = SGC + 'Zonificacion_Sismica_Intensidad_Esperada/' +
    'Departamentos_Municipios_zonificacion_Intensidad_Sismica_Esperada/MapServer/0/query';

  var CAMPOS = ['NOMDEPTO', 'NOMMUN', 'POINT_X', 'POINT_Y',
                'PGA75', 'PGA225', 'PGA475', 'PGA975', 'PGA2475',
                'NIVEL', 'AA', 'AV', 'AE', 'AD'].join(',');

  /* Cuarenta kilómetros. La capa tiene un punto por cabecera municipal, así
     que un lote en el borde del municipio puede estar lejísimos del punto que
     le corresponde. Se piden todos los de alrededor y se elige el más
     cercano; con menos radio, media Colombia rural devolvía vacío.

     Y NO se manda `resultRecordCount`: varias capas de este servidor
     contestan «Pagination is not supported» y se caen enteras. Se acota por
     campos, que es lo que de verdad pesa. */
  var RADIO_M = 40000;

  var ZONAS = [
    { id: 'baja', nombre: 'Baja', color: '#2E9E5B',
      pide: 'La norma pide capacidad de disipación de energía mínima (DMI).' },
    { id: 'intermedia', nombre: 'Intermedia', color: '#D9A227',
      pide: 'La norma pide capacidad de disipación de energía moderada (DMO).' },
    { id: 'alta', nombre: 'Alta', color: '#C0392B',
      pide: 'La norma pide capacidad de disipación de energía especial (DES).' }
  ];

  function zonaDe(nivel) {
    var n = String(nivel || '').toLowerCase();
    return ZONAS.filter(function (z) { return n.indexOf(z.id) !== -1; })[0] || null;
  }

  function num(x) { return (x === null || x === undefined || x === '') ? null : Number(x); }

  function metrosEntre(a, b) {
    var dLat = (b.lat - a.lat) * 110540;
    var dLng = (b.lng - a.lng) * 111320 * Math.cos(a.lat * Math.PI / 180);
    return Math.hypot(dLat, dLng);
  }

  /* La lectura. Recibe los atributos crudos de las DOS capas sísmicas y
     devuelve lo que la ficha necesita, en unidades que se puedan escribir en
     una lámina.

     Manda `nsr` cuando está: es la capa que existe para servir la NSR-10 y
     contesta por contención dentro del municipio. La otra trae los mismos
     coeficientes como atributo secundario de un mapa de aceleraciones, y en
     Cúcuta NO dan lo mismo —Av 0,30 contra 0,25—. Cuál de las dos tiene razón
     lo dice la tabla A.2.3-2 de la norma, que no está en ningún servicio; lo
     único honesto es tomar la de la capa normativa y AVISAR de la
     discrepancia en vez de elegir en silencio. */
  function leer(a, centro, nsr) {
    if (!a && !nsr) return null;
    a = a || {};
    var nivel = String((nsr && nsr['ZONA_AMENAZA_SÍSMICA']) || a.NIVEL || '').trim();
    var zona = zonaDe(nivel);
    var punto = { lat: num(a.POINT_Y), lng: num(a.POINT_X) };

    // Los coeficientes, de la capa normativa si está.
    var co = nsr || a;
    var aa = num(co.AA), av = num(co.AV), ae = num(co.AE), ad = num(co.AD);
    var discrepan = [];
    if (nsr && a && a.NIVEL !== undefined) {
      [['Aa', 'AA'], ['Av', 'AV'], ['Ae', 'AE'], ['Ad', 'AD']].forEach(function (par) {
        var x = num(nsr[par[1]]), y = num(a[par[1]]);
        if (x != null && y != null && Math.abs(x - y) > 1e-9) {
          discrepan.push({ cual: par[0], normativa: x, mapa: y });
        }
      });
    }
    /* El SGC publica la aceleración en gal (cm/s²). Se guarda además en g,
       que es la unidad en la que está escrita la norma —Aa y Av son
       fracciones de g— y la única en la que las dos cifras se pueden
       comparar de un vistazo. */
    var curva = [75, 225, 475, 975, 2475].map(function (tr) {
      var gal = num(a['PGA' + tr]);
      return { tr: tr, gal: gal, g: gal == null ? null : Math.round(gal / 9.81) / 100 };
    }).filter(function (p) { return p.gal != null; });
    /* El nombre del municipio: de la capa normativa primero, y en versalitas
       arregladas —el servicio lo manda todo en mayúsculas, «CÚCUTA», y una
       lámina con eso adentro grita. */
    function bonito(t) {
      t = String(t || '').trim();
      if (!t || t !== t.toUpperCase()) return t;
      return t.toLowerCase().replace(/(^|[\s.'-])([a-záéíóúñ])/g, function (m, a1, b1) {
        return a1 + b1.toUpperCase();
      });
    }
    return {
      municipio: bonito((nsr && nsr.NOMBRE_MUNICIPIO) || a.NOMMUN || ''),
      departamento: bonito((nsr && nsr.NOMBRE_DEPARTAMENTO) || a.NOMDEPTO || ''),
      nivel: nivel,
      zona: zona ? zona.id : '',
      color: zona ? zona.color : '#6B7A8A',
      pide: zona ? zona.pide : '',
      aa: aa, av: av, ae: ae, ad: ad,
      // De dónde salieron los coeficientes, para poder decirlo en la ficha.
      fuenteCoef: nsr ? 'normativa' : 'mapa',
      discrepan: discrepan,
      curva: curva,
      // La de 475 años es la de diseño: la que se compara con Aa.
      diseno: curva.filter(function (p) { return p.tr === 475; })[0] || null,
      punto: (punto.lat != null && punto.lng != null) ? punto : null,
      distanciaM: (centro && punto.lat != null) ? Math.round(metrosEntre(centro, punto)) : null,
      fuente: 'Servicio Geológico Colombiano · Mapa Nacional de Amenaza Sísmica',
      cuando: new Date().toISOString()
    };
  }

  /* Una consulta a una capa. `radioM` a cero pregunta por CONTENCIÓN —el
     punto dentro del polígono—, que es lo que corresponde con los límites
     municipales; con radio, barre alrededor, que es lo que hace falta con una
     capa de puntos. */
  function pedir(url, campos, lat, lng, radioM, msTope) {
    var p = new URLSearchParams();
    p.set('geometry', JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }));
    p.set('geometryType', 'esriGeometryPoint');
    p.set('inSR', '4326');
    if (radioM) {
      p.set('distance', String(radioM));
      p.set('units', 'esriSRUnit_Meter');
    }
    p.set('spatialRel', 'esriSpatialRelIntersects');
    p.set('outFields', campos);
    p.set('returnGeometry', 'false');
    p.set('f', 'json');

    var ctrl = new AbortController();
    /* Cuarenta y cinco segundos. Este servidor es lento de verdad: en la
       prueba de campo varias de sus capas pasaron de veinte y una de
       cuarenta y cinco. Cortar antes deja al estudiante con un «no se pudo»
       que en realidad era «no esperaste». */
    var reloj = setTimeout(function () { ctrl.abort(); }, msTope || 45000);
    return fetch(url + '?' + p.toString(), { signal: ctrl.signal, credentials: 'omit' })
      .then(function (r) {
        if (!r.ok) throw new Error('El servicio del SGC contestó ' + r.status + '.');
        return r.json();
      })
      .then(function (d) {
        if (d && d.error) {
          throw new Error('El servicio del SGC devolvió un error: ' +
            (d.error.message || 'sin detalle') + '.');
        }
        return ((d && d.features) || []).map(function (f) { return f.attributes || {}; });
      })
      .catch(function (e) {
        if (e && e.name === 'AbortError') {
          throw new Error('El servicio del SGC tardó demasiado. Volvé a intentarlo.');
        }
        throw e;
      })
      .then(function (r) { clearTimeout(reloj); return r; },
            function (e) { clearTimeout(reloj); throw e; });
  }

  /* Los movimientos en masa. El servicio da el reparto del MUNICIPIO entero
     entre las cuatro categorías, en porcentaje de su superficie. Para Cúcuta
     —mil ciento treinta y cinco kilómetros cuadrados, casi todos de ladera—
     eso dice muchísimo del territorio y NADA del lote, y así hay que
     contarlo. */
  function leerMasa(a) {
    if (!a) return null;
    var cat = [
      { id: 'baja', nombre: 'Baja', color: '#2E9E5B', pct: num(a.SUM_BAJA) },
      { id: 'media', nombre: 'Media', color: '#D9A227', pct: num(a.SUM_MEDIA) },
      { id: 'alta', nombre: 'Alta', color: '#D9662B', pct: num(a.SUM_ALTA) },
      { id: 'muy_alta', nombre: 'Muy alta', color: '#C0392B', pct: num(a.SUM_MUY_AL) }
    ].filter(function (c) { return c.pct != null; })
     .map(function (c) { return { id: c.id, nombre: c.nombre, color: c.color,
                                  pct: Math.round(c.pct * 10) / 10 }; });
    if (!cat.length) return null;
    var suma = cat.reduce(function (t, c) { return t + c.pct; }, 0);
    var mayor = cat.slice().sort(function (x, y) { return y.pct - x.pct; })[0];
    var altaOMas = cat.filter(function (c) { return c.id === 'alta' || c.id === 'muy_alta'; })
      .reduce(function (t, c) { return t + c.pct; }, 0);
    return {
      municipio: String(a.MUNICIPIO || '').trim(),
      departamento: String(a.DEPARTAMEN || '').trim(),
      areaKm2: num(a.AREA_KM),
      categorias: cat,
      dominante: mayor,
      altaOMasPct: Math.round(altaOMas * 10) / 10,
      /* El propio servicio no cuadra a cien exactos —acá suma 100,6— y decir
         «100%» sería inventar una precisión que no dio. Se informa la suma
         tal cual para que se vea de dónde sale. */
      sumaPct: Math.round(suma * 10) / 10,
      escala: '1:100.000',
      fuente: 'Servicio Geológico Colombiano · Mapa Nacional de Amenaza por ' +
              'Movimientos en Masa (2015), escala 1:100.000'
    };
  }

  /* La intensidad esperada. Se toman las dos PALABRAS y no su campo PGA:
     esa capa publica un rango —«9.20-18.0»— que no es el mismo que la
     aceleración de diseño de la NSR-10 y que, puesto al lado de Aa = 0,35,
     solo puede confundir. Dos cifras distintas para lo que parece lo mismo,
     sin nadie explicando en qué se diferencian, es peor que una sola. */
  function leerIntensidad(a) {
    if (!a) return null;
    var per = String(a.PERCEPCION || '').trim();
    var pot = String(a.POTENCIAL || '').trim();
    if (!per && !pot) return null;
    return {
      percepcion: per, potencial: pot,
      zona: String(a.ZONAS_AMENAZA_SISMICA_NSR_10 || '').trim(),
      fuente: 'Servicio Geológico Colombiano · Zonificación sísmica de la ' +
              'intensidad esperada'
    };
  }

  function consultar(lat, lng, msTope) {
    var centro = { lat: lat, lng: lng };
    // Cada una aguanta su propio fracaso: con este servidor, exigir las tres
    // sería quedarse sin ninguna cada vez que una se cae.
    var blando = function (pr) {
      return pr.then(function (r) { return { ok: r }; },
                     function (e) { return { error: (e && e.message) || String(e) }; });
    };
    return Promise.all([
      blando(pedir(CAPA_NSR, '*', lat, lng, 0, msTope)),
      blando(pedir(CAPA, CAMPOS, lat, lng, RADIO_M, msTope)),
      blando(pedir(CAPA_MASA, '*', lat, lng, 0, msTope)),
      blando(pedir(CAPA_INTENSIDAD, '*', lat, lng, 0, msTope))
    ]).then(function (res) {
      var nsr = (res[0].ok || [])[0] || null;
      var pgas = res[1].ok || [];
      var masa = (res[2].ok || [])[0] || null;
      var inten = (res[3].ok || [])[0] || null;

      // De la capa de puntos, la cabecera más cercana.
      var mejor = null, mejorD = Infinity;
      pgas.forEach(function (a) {
        if (a.POINT_Y == null || a.POINT_X == null) return;
        var d2 = metrosEntre(centro, { lat: Number(a.POINT_Y), lng: Number(a.POINT_X) });
        if (d2 < mejorD) { mejorD = d2; mejor = a; }
      });

      if (!nsr && !mejor) {
        throw new Error(res[0].error || res[1].error ||
          'El SGC no devolvió nada sobre este punto. ¿Está sobre Colombia?');
      }
      var am = leer(mejor, centro, nsr);
      am.masa = leerMasa(masa);
      am.intensidad = leerIntensidad(inten);
      am.fallos = [res[0].error, res[1].error, res[2].error, res[3].error].filter(Boolean);
      return am;
    });
  }

  /* El texto, para llevárselo. Lo que se copia tiene que poder pegarse en la
     memoria de un proyecto sin retocar nada. */
  function comoTexto(am) {
    if (!am) return 'Amenaza sísmica: sin consultar.';
    var l = ['AMENAZA SÍSMICA — ' + am.municipio + ', ' + am.departamento];
    l.push('  Nivel de amenaza (NSR-10): ' + am.nivel);
    if (am.aa != null) l.push('  Aa = ' + am.aa + '   ·   Av = ' + am.av);
    if (am.ae != null) l.push('  Ae = ' + am.ae + '   ·   Ad = ' + am.ad);
    l.push('  Aceleración pico en roca, por periodo de retorno:');
    am.curva.forEach(function (p) {
      l.push('    ' + String(p.tr).padStart(4, ' ') + ' años: ' + p.gal + ' gal (' +
             String(p.g).replace('.', ',') + ' g)');
    });
    if (am.intensidad) {
      l.push('  Cómo se siente: ' + am.intensidad.percepcion.toLowerCase() +
             ', con potencial de daño ' + am.intensidad.potencial.toLowerCase() + '.');
    }
    if (am.pide) l.push('  ' + am.pide);
    (am.discrepan || []).forEach(function (d) {
      l.push('  OJO: ' + d.cual + ' difiere entre las dos capas del SGC — ' +
             d.normativa + ' en la de zonas NSR-10 (la que se usa acá) y ' +
             d.mapa + ' en la del mapa de aceleraciones. Verificalo contra la ' +
             'tabla A.2.3-2 de la norma antes de usarlo en un cálculo.');
    });
    l.push('  Valor del municipio, no del lote. Si hay microzonificación sísmica, manda esa.');
    l.push('  Fuente: ' + am.fuente + '.');
    if (am.masa) {
      l.push('');
      l.push('MOVIMIENTOS EN MASA — ' + am.masa.municipio +
             ' (' + am.masa.areaKm2.toFixed(0) + ' km²)');
      am.masa.categorias.forEach(function (c) {
        l.push('  Amenaza ' + c.nombre.toLowerCase() + ': ' +
               String(c.pct).replace('.', ',') + '% del municipio');
      });
      l.push('  Es el reparto del MUNICIPIO ENTERO, no del lote: a escala ' +
             am.masa.escala + ' no se puede leer un predio.');
      l.push('  Fuente: ' + am.masa.fuente + '.');
    }
    return l.join('\n');
  }

  window.URBIS_AMENAZA = {
    consultar: consultar, leer: leer, leerMasa: leerMasa,
    leerIntensidad: leerIntensidad, comoTexto: comoTexto,
    ZONAS: ZONAS, zonaDe: zonaDe,
    CAPA: CAPA, CAPA_NSR: CAPA_NSR, CAPA_MASA: CAPA_MASA,
    CAPA_INTENSIDAD: CAPA_INTENSIDAD
  };
})();
