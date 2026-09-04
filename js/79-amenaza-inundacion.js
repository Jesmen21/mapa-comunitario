/* URBIS · La amenaza de inundación del sitio
   ═══════════════════════════════════════════════════════════════════════
   Cúcuta está sobre el Pamplonita y el Zulia, y se inunda. Hasta acá el
   análisis de riesgo tenía sismo y remoción en masa —los dos del Servicio
   Geológico— y un hueco donde debía ir el agua.

   Lo llena el IDEAM, que publica las manchas de inundación por periodo de
   retorno en un ArcGIS abierto. Dos diferencias con el SGC valen la pena:

   · Los ÍNDICES de capa no se escriben acá. En el módulo sísmico están a
     mano —FeatureServer/0, MapServer/3— porque se comprobaron una vez y no
     se han movido. Acá se preguntan: el servicio dice qué capas tiene y este
     archivo busca las que hablan de inundación. Adivinar un índice y
     equivocarse no da error: da la capa de al lado, con cifras que parecen
     buenas. Preguntar cuesta una consulta y elimina esa clase entera de
     error.

   · Si el navegador no puede leerlo, se pide por el MOTOR. El servidor del
     SGC deja que una página lo consulte directo; no todos lo hacen, y esa
     decisión es de quien publica. La ruta /geo del motor pide por nosotros
     desde un lugar donde el CORS no existe. Se intenta directo primero
     —es más rápido y no nos cuesta servidor— y solo se releva si falla.

   Y una advertencia que va en la ficha, no en un comentario, porque
   callarla convierte este dato en uno peligroso: el mapa del IDEAM es
   NACIONAL, a escala de río grande. Dibuja el Pamplonita desbordado; no
   dibuja la quebrada que se sale dos cuadras más allá ni el sumidero que no
   traga. En Cúcuta buena parte de las inundaciones que la gente sufre son de
   ese segundo tipo. Quedar fuera de la mancha no es un certificado.       */
(function () {
  'use strict';

  var SERVICIO = 'https://visualizador.ideam.gov.co/gisserver/rest/services/' +
                 'Amenaza_Ambiental/MapServer';

  function motor() {
    var c = window.URBIS_CONFIG || window.CONFIG || {};
    return ((c.ANALISIS && c.ANALISIS.API) || 'https://api.urbispro.city');
  }

  /* Qué tan seguido, dicho en años y en palabras. El periodo de retorno es
     una idea que un estudiante de taller no tiene por qué traer aprendida, y
     «TR 10» en una lámina no comunica nada. «Una vez cada diez años, más o
     menos» sí, y es lo mismo.

     El de 100 años lleva marca aparte porque es el que la ley usa: los POT
     delimitan suelo de protección por amenaza de inundación con esa mancha. */
  var COMOSEDICE = [
    { max: 5,   dice: 'casi todos los años' },
    { max: 15,  dice: 'una vez cada diez años, más o menos' },
    { max: 30,  dice: 'una vez cada veinte años' },
    { max: 75,  dice: 'una o dos veces en una vida' },
    { max: 1e9, dice: 'una vez por siglo' }
  ];
  function comoSeDice(tr) {
    return COMOSEDICE.filter(function (r) { return tr <= r.max; })[0].dice;
  }

  /* Cuanto MENOR el periodo de retorno, peor: caer dentro de la mancha de
     dos años significa que se moja casi siempre. La gravedad se lee del
     menor periodo que contiene al punto, no del mayor. */
  var GRADOS = [
    { hasta: 5,   id: 'critica', nombre: 'Crítica',   color: '#7D1D1F',
      que: 'Esto no es suelo para construir vivienda. En un POT sería suelo de protección.' },
    { hasta: 30,  id: 'alta',    nombre: 'Alta',      color: '#C0392B',
      que: 'Construir acá obliga a levantar el primer piso sobre la cota de inundación, y a que nada que importe quede abajo.' },
    { hasta: 1e9, id: 'media',   nombre: 'Media',     color: '#D9A227',
      que: 'Entra en la mancha con la que se hace el ordenamiento: hay que resolver la cota de piso y el desagüe, y decirlo en el proyecto.' }
  ];
  function gradoDe(tr) {
    return GRADOS.filter(function (g) { return tr <= g.hasta; })[0];
  }

  /* ── El transporte ────────────────────────────────────────────────────
     Directo primero. Si el navegador no puede —CORS cerrado, o la red del
     colegio bloqueando un dominio— se repite por el motor. El segundo
     intento NO se hace si el primero falló por algo que el relevo tampoco
     va a arreglar: si el servicio contestó 404, contestará 404 desde
     cualquier parte, y reintentar es esperar el doble para el mismo no. */
  function traer(url, msTope) {
    return pedirCrudo(url, msTope).catch(function (e) {
      if (e && e.definitivo) throw e;
      return pedirCrudo(motor() + '/geo?u=' + encodeURIComponent(url), msTope)
        .then(function (d) {
          // El relevo envuelve: { ok, de, datos }. Lo de adentro es la respuesta real.
          if (d && d.ok === true && d.datos) return d.datos;
          if (d && d.ok === false) throw new Error(d.error || 'El relevo no pudo consultar el servicio.');
          return d;
        });
    });
  }

  function pedirCrudo(url, msTope) {
    var ctrl = new AbortController();
    var reloj = setTimeout(function () { ctrl.abort(); }, msTope || 25000);
    return fetch(url, { signal: ctrl.signal, credentials: 'omit' })
      .then(function (r) {
        if (!r.ok) {
          var e = new Error('El servicio contestó ' + r.status + '.');
          // 4xx es una respuesta, no una falla de camino: el relevo daría igual.
          e.definitivo = r.status >= 400 && r.status < 500 && r.status !== 403;
          throw e;
        }
        return r.json();
      })
      .then(function (d) {
        if (d && d.error) throw new Error('El servicio devolvió un error: ' +
          (d.error.message || 'sin detalle') + '.');
        return d;
      })
      .finally(function () { clearTimeout(reloj); });
  }

  /* ── Qué capas tiene este servicio ────────────────────────────────────
     Se pregunta una vez por sesión y se guarda. El nombre de cada capa trae
     el periodo de retorno adentro —«Amenaza Inundacion TR 100»— y de ahí
     sale el número. Una capa de inundación sin periodo legible se descarta:
     sin ese número no se puede decir cada cuánto, que es todo lo que este
     módulo tiene para decir. */
  var catalogo = null;

  /* Buscar «inundación» y un periodo de retorno NO alcanza, y esto se aprendió
     mirando la respuesta de verdad. El servicio publica tres familias con el
     mismo periodo:

       Amenaza    Inundacion TR 10 Años Centros Poblados 2K
       Profundidad Inundacion TR 10 Años Centros Poblados 2K
       Velocidad  Inundacion TR 10 Años Centros Poblados 2K

     Son el mismo modelo hidráulico contado por tres atributos distintos, y
     dibujan más o menos la misma mancha. Un filtro por «inunda» + periodo se
     lleva las quince: triplica las consultas y hace que la ficha liste «2, 2,
     2, 10, 10, 10…» como si fueran hallazgos separados. La palabra que
     distingue la capa de AMENAZA de sus dos acompañantes es «amenaza», y por
     eso se exige.

     La creciente súbita entra también: es una amenaza de agua con periodo de
     retorno, y en una ciudad al pie de una cordillera puede importar más que
     el desborde lento del río. Pero se marca aparte, porque no es lo mismo. */
  function capasDe(servicio) {
    var d = servicio && servicio.layers;
    if (!d || !d.length) return [];
    return d.map(function (c) {
      var nombre = String(c.name || '');
      if (!/amenaza/i.test(nombre)) return null;
      var esCreciente = /creciente/i.test(nombre);
      if (!/inunda/i.test(nombre) && !esCreciente) return null;
      // «TR 100», «TR100», «T.R. 2.33», «periodo de retorno 50»
      var m = nombre.match(/(?:t\.?\s*r\.?|retorno)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i);
      if (!m) return null;
      return { id: c.id, nombre: nombre, tr: Number(String(m[1]).replace(',', '.')),
               tipo: esCreciente ? 'creciente' : 'desborde' };
    }).filter(Boolean).sort(function (a, b) { return a.tr - b.tr; });
  }

  function descubrir() {
    if (catalogo) return Promise.resolve(catalogo);
    return traer(SERVICIO + '?f=json', 20000).then(function (d) {
      catalogo = { capas: capasDe(d), titulo: (d && d.documentInfo && d.documentInfo.Title) || '' };
      return catalogo;
    });
  }

  /* ── Una consulta de punto ────────────────────────────────────────────
     Por contención: ¿este lote cae dentro de la mancha? No hay radio ni
     vecino más cercano que valga — a diferencia de la capa sísmica, que es
     de puntos por cabecera municipal, estas son polígonos de verdad y la
     pregunta correcta es exacta.

     `returnCountOnly` porque no nos interesa QUÉ polígono es: solo si hay
     alguno. Es una respuesta de dos líneas en vez de una geometría entera. */
  function contar(capa, lat, lng, radioM, msTope) {
    var p = new URLSearchParams();
    p.set('geometry', JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }));
    p.set('geometryType', 'esriGeometryPoint');
    p.set('inSR', '4326');
    if (radioM) { p.set('distance', String(radioM)); p.set('units', 'esriSRUnit_Meter'); }
    p.set('spatialRel', 'esriSpatialRelIntersects');
    p.set('returnCountOnly', 'true');
    p.set('where', '1=1');
    p.set('f', 'json');
    return traer(SERVICIO + '/' + capa.id + '/query?' + p.toString(), msTope)
      .then(function (d) { return Number(d && d.count) || 0; });
  }

  /* ── Treinta kilómetros ───────────────────────────────────────────────
     Esta segunda consulta es la corrección más importante de este módulo, y
     salió de correr la sonda contra el servicio real.

     Las cinco capas de amenaza contestaron CERO sobre el centro de Cúcuta. Un
     cero se puede leer de dos maneras opuestas: «el lote está fuera de la
     mancha» —una buena noticia— o «acá no hay ninguna mancha dibujada porque
     nadie modeló esta ciudad»— que no es ninguna noticia. Las capas se llaman
     «Centros Poblados 2K»: están hechas a escala 1:2.000 para una lista de
     centros poblados, no para el país entero. Si Cúcuta no está en esa lista,
     el cero no significa nada.

     Preguntar por los treinta kilómetros de alrededor separa las dos cosas.
     Si en toda la redonda del municipio no hay un solo polígono, la capa no
     cubre este sitio y hay que decirlo con esas palabras. Si los hay pero
     ninguno toca el lote, entonces sí: está fuera de la mancha.

     Sin esta consulta, la aplicación le habría dicho a un estudiante que su
     lote no se inunda cuando lo cierto era que nadie lo había mirado. Es
     exactamente el error que este módulo se escribió para no cometer, y lo
     estaba cometiendo. */
  var RADIO_COBERTURA_M = 30000;

  function medirCapa(capa, lat, lng, msTope) {
    return Promise.all([
      contar(capa, lat, lng, 0, msTope),
      contar(capa, lat, lng, RADIO_COBERTURA_M, msTope)
    ]).then(function (r) {
      return { capa: capa, dentro: r[0] > 0, cubre: r[1] > 0 };
    }, function (e) {
      return { capa: capa, error: e.message || String(e) };
    });
  }

  /* ── La lectura ───────────────────────────────────────────────────────
     Recibe qué capas contienen el punto y arma el veredicto. */
  function leer(tocadas, consultadas) {
    var buenas = tocadas.filter(function (t) { return !t.error; });
    var fallos = tocadas.filter(function (t) { return t.error; });

    /* Que no toque ninguna capa y que TODAS hayan fallado se ven igual en una
       lista de ceros. No son lo mismo, y confundirlos sería decirle a alguien
       «no se inunda» cuando lo cierto es «no se pudo averiguar». */
    if (!buenas.length) {
      return { sinDato: true, fallos: fallos.map(function (f) { return f.error; }),
               consultadas: consultadas, cuando: new Date().toISOString(), fuente: FUENTE };
    }

    var cubren = buenas.filter(function (t) { return t.cubre; });
    var dentro = buenas.filter(function (t) { return t.dentro; })
                       .map(function (t) { return t.tr; })
                       .sort(function (a, b) { return a - b; });
    var creciente = buenas.filter(function (t) { return t.dentro && t.tipo === 'creciente'; })
                          .map(function (t) { return t.tr; });

    var base = {
      sinDato: false,
      dentroDe: dentro,
      creciente: creciente,
      consultadas: consultadas,
      capasQueCubren: cubren.length,
      fallos: fallos.map(function (f) { return f.error; }),
      escala: 'centros poblados 1:2.000',
      fuente: FUENTE,
      cuando: new Date().toISOString()
    };

    /* Ninguna capa tiene un solo polígono en treinta kilómetros a la redonda:
       el IDEAM no modeló esta ciudad. Se dice así, y NO se dice que el lote
       quede fuera de nada. */
    if (!cubren.length) {
      return Object.assign(base, {
        cobertura: false,
        trPeor: null,
        grado: 'sin-cobertura',
        nombre: 'Sin modelar',
        color: '#6B7A8A',
        que: 'El IDEAM no modeló la inundación de este sitio. Sus manchas de 2 a 100 años ' +
             'están hechas a escala 1:2.000 para una lista de centros poblados, y este no ' +
             'está en ella.',
        frecuencia: '',
        enLaDeCien: false,
        salvedad: 'Esto NO quiere decir que el lote no se inunde: quiere decir que nadie lo ' +
                  'midió con este mapa. Para Cúcuta, lo que sí existe es el POMCA del río ' +
                  'Pamplonita —CORPONOR levantó la cota de ronda del tramo urbano— y la ' +
                  'cartografía de amenaza del POT vigente. Las dos hay que pedirlas: no se ' +
                  'publican como servicio.'
      });
    }

    var peor = dentro.length ? dentro[0] : null;
    var g = peor != null ? gradoDe(peor) : null;
    return Object.assign(base, {
      cobertura: true,
      trPeor: peor,
      grado: g ? g.id : 'fuera',
      nombre: g ? g.nombre : 'Fuera de las manchas modeladas',
      color: g ? g.color : '#2E9E5B',
      que: g ? g.que
             : 'El sitio está modelado y el lote queda fuera de las manchas.',
      frecuencia: peor != null ? comoSeDice(peor) : '',
      // La de 100 años es la que usan los POT para delimitar.
      enLaDeCien: dentro.filter(function (tr) { return tr >= 75 && tr <= 150; }).length > 0,
      salvedad: 'El modelo del IDEAM sigue los cauces que estudió. No dibuja quebradas ' +
                'menores ni encharcamiento por alcantarillado, que en Cúcuta son buena ' +
                'parte de las inundaciones reales. Quedar fuera de la mancha no es un ' +
                'certificado.'
    });
  }

  var FUENTE = 'IDEAM · Amenaza ambiental, manchas de inundación por periodo de retorno';

  /* ── El pedido completo ───────────────────────────────────────────────
     Descubrir y después preguntar. Las capas se preguntan TODAS a la vez y
     cada una aguanta que las otras fallen, igual que en el módulo sísmico y
     por la misma razón: perder la de veinte años no es motivo para quedarse
     sin la de cien. */
  function consultar(lat, lng, opciones) {
    var op = opciones || {};
    return descubrir().then(function (cat) {
      if (!cat.capas.length) {
        throw new Error('El servicio del IDEAM no expone ninguna capa de inundación ' +
                        'con periodo de retorno legible.');
      }
      return Promise.all(cat.capas.map(function (c) {
        return medirCapa(c, lat, lng, op.msTope);
      })).then(function (res) {
        var tocadas = res.map(function (r) {
          return { tr: r.capa.tr, nombre: r.capa.nombre, tipo: r.capa.tipo,
                   dentro: !!r.dentro, cubre: !!r.cubre, error: r.error };
        });
        return leer(tocadas, cat.capas.length);
      });
    });
  }

  /* El texto, para llevárselo a la memoria del proyecto. */
  function comoTexto(inu) {
    if (!inu) return 'Amenaza de inundación: sin consultar.';
    if (inu.sinDato) {
      return 'AMENAZA DE INUNDACIÓN — no se pudo consultar el servicio del IDEAM.\n' +
             '  Esto NO quiere decir que el lote no se inunde: quiere decir que no se sabe.';
    }
    if (!inu.cobertura) {
      return ['AMENAZA DE INUNDACIÓN — sin modelar',
              '  ' + inu.que,
              '  ' + inu.salvedad,
              '  Se consultaron ' + inu.consultadas + ' capas y ninguna tiene un solo ' +
              'polígono en 30 km a la redonda.',
              '  Fuente: ' + inu.fuente + '.'].join('\n');
    }
    var l = ['AMENAZA DE INUNDACIÓN — ' + inu.nombre];
    if (inu.trPeor != null) {
      l.push('  El lote entra en la mancha de ' + inu.trPeor + ' años: se inunda ' +
             inu.frecuencia + '.');
      l.push('  Periodos de retorno que lo tocan: ' + inu.dentroDe.join(', ') + ' años.');
      if (inu.creciente.length) {
        l.push('  Y está en zona de CRECIENTE SÚBITA (TR ' + inu.creciente.join(', ') +
               '): eso no sube despacio, llega de golpe.');
      }
      if (inu.enLaDeCien) {
        l.push('  Está dentro de la mancha de 100 años, que es con la que los POT ' +
               'delimitan suelo de protección por inundación.');
      }
    } else {
      l.push('  El sitio SÍ está modelado (' + inu.capasQueCubren + ' de ' + inu.consultadas +
             ' capas tienen manchas cerca) y el lote queda fuera de todas.');
    }
    if (inu.que) l.push('  ' + inu.que);
    l.push('  ' + inu.salvedad);
    l.push('  Fuente: ' + inu.fuente + '.');
    return l.join('\n');
  }

  window.URBIS_INUNDACION = {
    consultar: consultar, leer: leer, comoTexto: comoTexto,
    descubrir: descubrir, capasDe: capasDe, gradoDe: gradoDe,
    RADIO_COBERTURA_M: RADIO_COBERTURA_M,
    comoSeDice: comoSeDice, traer: traer,
    SERVICIO: SERVICIO, GRADOS: GRADOS, FUENTE: FUENTE,
    // Solo para las pruebas: vaciar lo que se guardó del catálogo.
    _olvidar: function () { catalogo = null; }
  };
})();
