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

  function capasDe(servicio) {
    var d = servicio && servicio.layers;
    if (!d || !d.length) return [];
    return d.map(function (c) {
      var nombre = String(c.name || '');
      if (!/inunda/i.test(nombre)) return null;
      // «TR 100», «TR100», «T.R. 2.33», «periodo de retorno 50»
      var m = nombre.match(/(?:t\.?\s*r\.?|retorno)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i);
      if (!m) return null;
      return { id: c.id, nombre: nombre, tr: Number(String(m[1]).replace(',', '.')) };
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
  function tocaLaCapa(capa, lat, lng, msTope) {
    var p = new URLSearchParams();
    p.set('geometry', JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }));
    p.set('geometryType', 'esriGeometryPoint');
    p.set('inSR', '4326');
    p.set('spatialRel', 'esriSpatialRelIntersects');
    p.set('returnCountOnly', 'true');
    p.set('where', '1=1');
    p.set('f', 'json');
    return traer(SERVICIO + '/' + capa.id + '/query?' + p.toString(), msTope)
      .then(function (d) { return { capa: capa, dentro: Number(d && d.count) > 0 }; },
            function (e) { return { capa: capa, error: e.message || String(e) }; });
  }

  /* ── La lectura ───────────────────────────────────────────────────────
     Recibe qué capas contienen el punto y arma el veredicto. */
  function leer(tocadas, consultadas) {
    var dentro = tocadas.filter(function (t) { return t.dentro; })
                        .map(function (t) { return t.tr; })
                        .sort(function (a, b) { return a - b; });
    var fallos = tocadas.filter(function (t) { return t.error; });

    /* Que no toque ninguna capa y que TODAS hayan fallado se ven igual en la
       lista de arriba: cero manchas. No son lo mismo, y confundirlos sería
       decirle a alguien «no se inunda» cuando lo cierto es «no se pudo
       averiguar». Si no quedó ni una capa buena, no hay veredicto. */
    var buenas = tocadas.length - fallos.length;
    if (!buenas) {
      return { sinDato: true, fallos: fallos.map(function (f) { return f.error; }),
               consultadas: consultadas, cuando: new Date().toISOString(), fuente: FUENTE };
    }

    var peor = dentro.length ? dentro[0] : null;
    var g = peor != null ? gradoDe(peor) : null;
    return {
      sinDato: false,
      dentroDe: dentro,
      trPeor: peor,
      grado: g ? g.id : 'fuera',
      nombre: g ? g.nombre : 'Fuera de las manchas conocidas',
      color: g ? g.color : '#2E9E5B',
      que: g ? g.que
             : 'El lote no cae en ninguna mancha de inundación del mapa nacional.',
      frecuencia: peor != null ? comoSeDice(peor) : '',
      // La de 100 años es la que usan los POT para delimitar.
      enLaDeCien: dentro.filter(function (tr) { return tr >= 75 && tr <= 150; }).length > 0,
      consultadas: consultadas,
      fallos: fallos.map(function (f) { return f.error; }),
      escala: 'nacional',
      salvedad: 'El mapa del IDEAM es nacional y dibuja los ríos grandes. No ' +
                'dibuja quebradas ni encharcamiento por alcantarillado, que en ' +
                'Cúcuta son buena parte de las inundaciones reales. Quedar fuera ' +
                'de la mancha no es un certificado de que no se inunda.',
      fuente: FUENTE,
      cuando: new Date().toISOString()
    };
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
        return tocaLaCapa(c, lat, lng, op.msTope);
      })).then(function (res) {
        var tocadas = res.map(function (r) {
          return { tr: r.capa.tr, nombre: r.capa.nombre, dentro: !!r.dentro, error: r.error };
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
    var l = ['AMENAZA DE INUNDACIÓN — ' + inu.nombre];
    if (inu.trPeor != null) {
      l.push('  El lote entra en la mancha de ' + inu.trPeor + ' años: se inunda ' +
             inu.frecuencia + '.');
      l.push('  Periodos de retorno que lo tocan: ' + inu.dentroDe.join(', ') + ' años.');
      if (inu.enLaDeCien) {
        l.push('  Está dentro de la mancha de 100 años, que es con la que los POT ' +
               'delimitan suelo de protección por inundación.');
      }
    } else {
      l.push('  No cae dentro de ninguna de las ' + inu.consultadas +
             ' manchas de inundación del mapa nacional.');
    }
    if (inu.que) l.push('  ' + inu.que);
    l.push('  ' + inu.salvedad);
    l.push('  Fuente: ' + inu.fuente + '.');
    return l.join('\n');
  }

  window.URBIS_INUNDACION = {
    consultar: consultar, leer: leer, comoTexto: comoTexto,
    descubrir: descubrir, capasDe: capasDe, gradoDe: gradoDe,
    comoSeDice: comoSeDice, traer: traer,
    SERVICIO: SERVICIO, GRADOS: GRADOS, FUENTE: FUENTE,
    // Solo para las pruebas: vaciar lo que se guardó del catálogo.
    _olvidar: function () { catalogo = null; }
  };
})();
