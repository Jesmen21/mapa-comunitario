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

  /* La capa del periodo de retorno de 475 años —el de diseño de la NSR-10,
     10% de probabilidad de excedencia en 50 años—. Se consulta solo esta
     porque su tabla trae TODOS los periodos: pedir las otras cinco sería
     cinco consultas para repetir las mismas cifras. */
  var CAPA = 'https://srvags.sgc.gov.co/arcgis/rest/services/Amenaza_Sismica/' +
             'Mapa_Amenaza_Sismica_Nacional_PGA475/MapServer/0/query';

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

  /* La lectura. Recibe los atributos crudos del servicio y devuelve lo que la
     ficha necesita, ya en unidades que se puedan escribir en una lámina. */
  function leer(a, centro) {
    if (!a) return null;
    var nivel = String(a.NIVEL || '').trim();
    var zona = zonaDe(nivel);
    var punto = { lat: num(a.POINT_Y), lng: num(a.POINT_X) };
    /* El SGC publica la aceleración en gal (cm/s²). Se guarda además en g,
       que es la unidad en la que está escrita la norma —Aa y Av son
       fracciones de g— y la única en la que las dos cifras se pueden
       comparar de un vistazo. */
    var curva = [75, 225, 475, 975, 2475].map(function (tr) {
      var gal = num(a['PGA' + tr]);
      return { tr: tr, gal: gal, g: gal == null ? null : Math.round(gal / 9.81) / 100 };
    }).filter(function (p) { return p.gal != null; });
    return {
      municipio: String(a.NOMMUN || '').trim(),
      departamento: String(a.NOMDEPTO || '').trim(),
      nivel: nivel,
      zona: zona ? zona.id : '',
      color: zona ? zona.color : '#6B7A8A',
      pide: zona ? zona.pide : '',
      aa: num(a.AA), av: num(a.AV), ae: num(a.AE), ad: num(a.AD),
      curva: curva,
      // La de 475 años es la de diseño: la que se compara con Aa.
      diseno: curva.filter(function (p) { return p.tr === 475; })[0] || null,
      punto: (punto.lat != null && punto.lng != null) ? punto : null,
      distanciaM: (centro && punto.lat != null) ? Math.round(metrosEntre(centro, punto)) : null,
      fuente: 'Servicio Geológico Colombiano · Mapa Nacional de Amenaza Sísmica',
      cuando: new Date().toISOString()
    };
  }

  function consultar(lat, lng, msTope) {
    var p = new URLSearchParams();
    p.set('geometry', JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }));
    p.set('geometryType', 'esriGeometryPoint');
    p.set('inSR', '4326');
    p.set('distance', String(RADIO_M));
    p.set('units', 'esriSRUnit_Meter');
    p.set('spatialRel', 'esriSpatialRelIntersects');
    p.set('outFields', CAMPOS);
    p.set('returnGeometry', 'false');
    p.set('f', 'json');

    var ctrl = new AbortController();
    /* Veinticinco segundos. Este servidor es lento de verdad: en las pruebas
       de campo, varias de sus capas pasaron de veinte. Cortar antes deja al
       estudiante con un «no se pudo» que en realidad era «no esperaste». */
    var reloj = setTimeout(function () { ctrl.abort(); }, msTope || 25000);
    return fetch(CAPA + '?' + p.toString(), { signal: ctrl.signal, credentials: 'omit' })
      .then(function (r) {
        if (!r.ok) throw new Error('El servicio del SGC contestó ' + r.status + '.');
        return r.json();
      })
      .then(function (d) {
        if (d && d.error) {
          throw new Error('El servicio del SGC devolvió un error: ' +
            (d.error.message || 'sin detalle') + '.');
        }
        var fs = (d && d.features) || [];
        if (!fs.length) {
          throw new Error('No hay ninguna cabecera municipal a menos de ' +
            (RADIO_M / 1000) + ' km de este punto. ¿Está sobre Colombia?');
        }
        var centro = { lat: lat, lng: lng };
        // El más cercano manda: a cuarenta kilómetros entran varios municipios.
        var mejor = null, mejorD = Infinity;
        fs.forEach(function (f) {
          var a = f.attributes || {};
          if (a.POINT_Y == null || a.POINT_X == null) return;
          var d2 = metrosEntre(centro, { lat: Number(a.POINT_Y), lng: Number(a.POINT_X) });
          if (d2 < mejorD) { mejorD = d2; mejor = a; }
        });
        if (!mejor) throw new Error('El servicio contestó sin coordenadas utilizables.');
        return leer(mejor, centro);
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
    if (am.pide) l.push('  ' + am.pide);
    l.push('  Valor del municipio, no del lote. Si hay microzonificación sísmica, manda esa.');
    l.push('  Fuente: ' + am.fuente + '.');
    return l.join('\n');
  }

  window.URBIS_AMENAZA = {
    consultar: consultar, leer: leer, comoTexto: comoTexto,
    ZONAS: ZONAS, zonaDe: zonaDe, CAPA: CAPA
  };
})();
