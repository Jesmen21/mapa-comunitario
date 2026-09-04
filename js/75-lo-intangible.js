/* URBIS · Lo intangible
   ═══════════════════════════════════════════════════════════════════════
   Todo lo demás que mide esta aplicación se puede bajar: los usos vienen de
   OpenStreetMap, las alturas del trazado, las cotas de un modelo de terreno,
   la cobertura de una foto satelital. Y sin embargo, si uno le pregunta a
   alguien cómo es su barrio, no contesta ninguna de esas cosas. Contesta que
   por esa calle no pasa de noche, que esa esquina está oscura, que ahí atrás
   huele mal, que en esa plaza se queda un rato.

   Eso no está en ningún servidor. Solo lo tiene quien caminó. Este módulo es
   el lápiz para anotarlo y las cuentas para cruzarlo con lo que sí se midió.

   Dos advertencias que el módulo repite en voz alta donde haga falta:

   · Esto NO es un dato. Es un testimonio, con nombre y fecha, y vale por
     eso. Un mapa de percepción de una sola persona es la opinión de una
     persona; de veinte estudiantes que caminaron la misma manzana, ya es
     otra cosa.

   · Lo interesante no es la marca sino el desacuerdo. Una calle marcada como
     insegura donde el conteo dice que hay treinta locales abiertos es la
     pregunta más útil que puede salir de un reconocimiento: algo pasa ahí
     que ninguna de las dos mediciones sola explica.

   El módulo no toca el mapa ni la pantalla: recibe marcas y contexto y
   devuelve cuentas. Quien dibuja es js/68; quien pinta la lámina, también. */
(function () {
  'use strict';

  /* Los ocho. Salieron de lo que pidió el curso —inseguridad percibida,
     zonas oscuras, zonas inhabitables— más lo que aparece solo apenas
     alguien camina con una libreta: el ruido, el olor, la basura, lo que
     corta el paso y, sobre todo, lo que está bien. Sin esa última el
     ejercicio se vuelve un inventario de quejas, y un barrio no es eso. */
  var TIPOS = [
    { id: 'inseguro', nombre: 'No me sentiría seguro', geom: 'zona',
      color: '#E23D3D', ico: '⚠',
      pregunta: '¿Por dónde no pasarías de noche, o no pasarías sola?',
      porQue: 'La inseguridad que se mide es la denunciada. Esta es la otra: ' +
              'la que cambia por dónde camina la gente aunque nunca haya pasado nada.' },
    { id: 'oscuro', nombre: 'De noche no hay luz', geom: 'zona',
      color: '#3B3486', ico: '☾',
      pregunta: '¿Qué tramos quedan a oscuras cuando cae el sol?',
      porQue: 'El alumbrado casi nunca está mapeado. Y una calle sin luz no ' +
              'es la misma calle: a las seis de la tarde deja de existir.' },
    { id: 'inhabitable', nombre: 'Ahí no se puede vivir', geom: 'zona',
      color: '#7A5C3E', ico: '⌂',
      pregunta: '¿Qué predio está en ruina, se inunda, o tiene algo al lado ' +
                'que lo hace invivible?',
      porQue: 'Un lote vacío en el mapa puede estar vacío por una razón. ' +
              'Esa razón no se ve desde el satélite.' },
    { id: 'ruido', nombre: 'Ruido molesto', geom: 'zona',
      color: '#F08A24', ico: '♪',
      pregunta: '¿Dónde no se puede conversar sin levantar la voz?',
      porQue: 'Decide qué se puede poner al lado. Una vivienda contra un taller ' +
              'de latonería es un problema que se ve el primer día de obra.' },
    { id: 'olor', nombre: 'Huele mal', geom: 'punto',
      color: '#8A8A2B', ico: '≈',
      pregunta: '¿De dónde viene el olor, y a qué hora?',
      porQue: 'El olor tiene foco y tiene viento. Marcá el foco; el rumbo lo ' +
              'pone el análisis del clima.' },
    { id: 'basura', nombre: 'Se junta basura', geom: 'punto',
      color: '#6B4E2E', ico: '●',
      pregunta: '¿En qué esquina aparece la basura aunque nadie la ponga ahí?',
      porQue: 'Los puntos críticos se repiten en el mismo lugar durante años. ' +
              'Son un dato de diseño, no de aseo.' },
    { id: 'barrera', nombre: 'No se puede pasar', geom: 'linea',
      color: '#1F2A33', ico: '▬',
      pregunta: '¿Qué muro, reja, zanja o vía rápida corta el paso a pie?',
      porQue: 'El mapa muestra dos calles que se cruzan; en la esquina hay un ' +
              'muro. La distancia real es el doble de la que sale medida.' },
    { id: 'agradable', nombre: 'Da gusto estar', geom: 'zona',
      color: '#1E9E6A', ico: '★',
      pregunta: '¿Dónde te quedarías un rato sin tener nada que hacer?',
      porQue: 'Es lo más difícil de explicar y lo más importante de copiar. ' +
              'Si algo funciona ahí, conviene saber qué es antes de proponer otra cosa.' }
  ];

  var POR_ID = {};
  TIPOS.forEach(function (t) { POR_ID[t.id] = t; });

  function tipo(id) { return POR_ID[id] || null; }
  function color(id) { return (POR_ID[id] && POR_ID[id].color) || '#94a3b8'; }
  function geomDe(id) { return (POR_ID[id] && POR_ID[id].geom) || 'zona'; }
  /* Cuántos puntos hace falta tocar para que la marca exista: una zona es un
     polígono, una barrera es una línea, un olor es un sitio. */
  function minimoPuntos(id) {
    var g = geomDe(id);
    return g === 'zona' ? 3 : g === 'linea' ? 2 : 1;
  }

  // ── Geometría, en plano local ─────────────────────────────────────────
  // A escala de barrio la Tierra es plana y la cuenta es exacta al metro.
  var R_LAT = 110540;
  function rLng(lat) { return 111320 * Math.cos(lat * Math.PI / 180); }

  function areaM2(pts) {
    if (!pts || pts.length < 3) return 0;
    var lat0 = pts[0].lat, k = rLng(lat0), s = 0;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      s += (a.lng * k) * (b.lat * R_LAT) - (b.lng * k) * (a.lat * R_LAT);
    }
    return Math.abs(s) / 2;
  }

  function largoM(pts) {
    if (!pts || pts.length < 2) return 0;
    var t = 0;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], k = rLng(a.lat);
      t += Math.hypot((b.lng - a.lng) * k, (b.lat - a.lat) * R_LAT);
    }
    return t;
  }

  function centroide(pts) {
    if (!pts || !pts.length) return null;
    var x = 0, y = 0;
    pts.forEach(function (p) { x += p.lng; y += p.lat; });
    return { lat: y / pts.length, lng: x / pts.length };
  }

  function dentro(lat, lng, pol) {
    if (!pol || pol.length < 3) return false;
    var d = false;
    for (var i = 0, j = pol.length - 1; i < pol.length; j = i++) {
      var yi = pol[i].lat, xi = pol[i].lng, yj = pol[j].lat, xj = pol[j].lng;
      if (((yi > lat) !== (yj > lat)) &&
          (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi)) d = !d;
    }
    return d;
  }

  /* Distancia de un punto a una polilínea. La usa la barrera: una marca de
     línea no contiene nada, así que la única pregunta sensata es a cuántos
     metros pasa de algo. */
  function distanciaALinea(p, pts) {
    if (!pts || pts.length < 2) return Infinity;
    var k = rLng(p.lat), mejor = Infinity;
    for (var i = 1; i < pts.length; i++) {
      var ax = (pts[i - 1].lng - p.lng) * k, ay = (pts[i - 1].lat - p.lat) * R_LAT;
      var bx = (pts[i].lng - p.lng) * k, by = (pts[i].lat - p.lat) * R_LAT;
      var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      var t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
      mejor = Math.min(mejor, Math.hypot(ax + t * dx, ay + t * dy));
    }
    return mejor;
  }

  // ── Una marca ─────────────────────────────────────────────────────────
  function nuevaMarca(id, pts, nota) {
    return {
      id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      tipo: id, geom: geomDe(id),
      pts: (pts || []).map(function (p) { return { lat: p.lat, lng: p.lng }; }),
      nota: nota || '', ts: new Date().toISOString()
    };
  }

  function valida(m) {
    return !!(m && POR_ID[m.tipo] && m.pts && m.pts.length >= minimoPuntos(m.tipo));
  }

  /* Lo que se guarda con la ficha. Una zona de barrio son cuatro o cinco
     vértices: cabe de sobra. Lo único que se recorta es la nota, para que
     nadie meta un informe entero en el almacenamiento del teléfono. */
  function paraGuardar(marcas) {
    return (marcas || []).filter(valida).map(function (m) {
      return { id: m.id, tipo: m.tipo, geom: m.geom, ts: m.ts,
               nota: String(m.nota || '').slice(0, 220),
               pts: m.pts.map(function (p) {
                 return { lat: Math.round(p.lat * 1e6) / 1e6,
                          lng: Math.round(p.lng * 1e6) / 1e6 };
               }) };
    });
  }

  // ── Las cuentas ───────────────────────────────────────────────────────
  /* `ctx` trae lo que ya se midió del sector: el área, el lote, los usos y
     las calles. Nada de esto se pide: si no está, la conclusión que dependía
     de ello se omite y se dice por qué. */
  function analizar(marcas, ctx) {
    var ms = (marcas || []).filter(valida);
    var c = ctx || {};
    var an = {
      total: ms.length,
      porTipo: [],
      zonasM2: 0, pctSector: null,
      barrerasM: 0,
      lote: null,
      desacuerdos: [],
      avisos: []
    };
    if (!ms.length) return an;

    TIPOS.forEach(function (t) {
      var suyas = ms.filter(function (m) { return m.tipo === t.id; });
      if (!suyas.length) return;
      var m2 = 0, metros = 0;
      suyas.forEach(function (m) {
        if (m.geom === 'zona') m2 += areaM2(m.pts);
        if (m.geom === 'linea') metros += largoM(m.pts);
      });
      an.porTipo.push({ id: t.id, nombre: t.nombre, color: t.color, ico: t.ico,
                        geom: t.geom, n: suyas.length,
                        m2: Math.round(m2), metros: Math.round(metros),
                        notas: suyas.map(function (m) { return m.nota; })
                                .filter(function (x) { return !!x; }) });
      an.zonasM2 += m2;
      an.barrerasM += metros;
    });
    an.zonasM2 = Math.round(an.zonasM2);
    an.barrerasM = Math.round(an.barrerasM);
    if (c.areaSectorM2 > 0) {
      an.pctSector = Math.round(1000 * an.zonasM2 / c.areaSectorM2) / 10;
    }

    // ── El lote: lo único que hay que decidir está adentro de alguna de estas.
    if (c.lote && c.lote.length >= 3) {
      var cl = centroide(c.lote);
      var encima = ms.filter(function (m) {
        if (m.geom === 'zona') return dentro(cl.lat, cl.lng, m.pts);
        // Un punto no contiene nada: cuenta como «encima del lote» si cae a
        // menos de sesenta metros, que es el frente de una manzana.
        if (m.geom === 'punto') return largoM([cl, m.pts[0]]) <= 60;
        return distanciaALinea(cl, m.pts) <= 40;
      });
      an.lote = {
        dentroDe: encima.map(function (m) {
          return { tipo: m.tipo, nombre: POR_ID[m.tipo].nombre,
                   color: POR_ID[m.tipo].color, nota: m.nota };
        }),
        // Lo que hay cerca aunque no lo toque: a cien metros, un foco de
        // basura o un muro siguen siendo parte del problema del lote.
        cerca: ms.filter(function (m) {
          if (encima.indexOf(m) >= 0) return false;
          var d = m.geom === 'punto' ? largoM([cl, m.pts[0]]) : distanciaALinea(cl, m.pts);
          return d <= 150;
        }).map(function (m) {
          var d = m.geom === 'punto' ? largoM([cl, m.pts[0]]) : distanciaALinea(cl, m.pts);
          return { tipo: m.tipo, nombre: POR_ID[m.tipo].nombre,
                   color: POR_ID[m.tipo].color, m: Math.round(d) };
        }).sort(function (a, b) { return a.m - b.m; }).slice(0, 6)
      };
    }

    /* ── Los desacuerdos ────────────────────────────────────────────────
       Acá está el sentido del ejercicio. Se cruzan las marcas con lo que la
       aplicación midió por su cuenta y se buscan las contradicciones. Una
       contradicción no significa que alguien se equivocó: significa que hay
       algo ahí que ninguna de las dos mediciones explica sola, y eso es
       exactamente lo que hay que ir a mirar de nuevo. */
    var pois = c.pois || [];
    ms.filter(function (m) { return m.tipo === 'inseguro' && m.geom === 'zona'; })
      .forEach(function (m) {
        var ha = areaM2(m.pts) / 10000;
        if (ha < 0.05) return;
        var adentro = pois.filter(function (p) { return dentro(p.lat, p.lng, m.pts); });
        var densidad = adentro.length / ha;
        if (densidad >= 20) {
          an.desacuerdos.push({
            clase: 'ojos',
            texto: 'Una zona marcada como insegura tiene ' + adentro.length + ' usos ' +
                   'registrados en ' + (Math.round(ha * 10) / 10) + ' ha (' +
                   Math.round(densidad) + ' por hectárea). Por el conteo debería ' +
                   'sentirse acompañada y no se siente: mirá si los locales cierran ' +
                   'temprano, si dan la espalda a la calle o si el problema es de noche.'
          });
        } else if (adentro.length === 0) {
          an.desacuerdos.push({
            clase: 'vacio',
            texto: 'Una zona marcada como insegura no tiene ni un uso registrado en ' +
                   (Math.round(ha * 10) / 10) + ' ha. Percepción y conteo dicen lo ' +
                   'mismo: no hay a quién pedirle ayuda ni quién mire. Es el caso ' +
                   'más claro para una propuesta de actividad en planta baja.'
          });
        }
      });

    // Oscuro y agradable encima: alguien va a querer estar donde no hay luz.
    var oscuras = ms.filter(function (m) { return m.tipo === 'oscuro'; });
    ms.filter(function (m) { return m.tipo === 'agradable' && m.geom === 'zona'; })
      .forEach(function (a) {
        var ca = centroide(a.pts);
        if (oscuras.some(function (o) {
          return o.geom === 'zona' ? dentro(ca.lat, ca.lng, o.pts)
                                   : distanciaALinea(ca, o.pts) <= 40;
        })) {
          an.desacuerdos.push({
            clase: 'luz',
            texto: 'Hay un sitio marcado como agradable dentro de una zona sin luz. ' +
                   'Es el mejor lugar del sector durante doce horas al día y no ' +
                   'existe las otras doce: una luminaria vale menos que cualquier ' +
                   'otra cosa que se pueda proponer ahí.'
          });
        }
      });

    // Barreras contra la caminata: el mapa cree que se pasa y no se pasa.
    if (an.barrerasM > 0 && c.hayCaminata) {
      an.desacuerdos.push({
        clase: 'barrera',
        texto: 'El alcance a pie se calculó sobre las calles mapeadas, que no ' +
               'saben de los ' + an.barrerasM + ' m de barrera marcados. Donde la ' +
               'barrera cruza el recorrido, los minutos dibujados son menos que ' +
               'los reales.'
      });
    }

    // ── Lo que hay que decir siempre.
    an.avisos.push('Esto no es una medición: es lo que vio quien caminó, con su ' +
                   'nombre y su fecha. Vale por eso, y por eso no se promedia con ' +
                   'las cifras de arriba.');
    if (an.total < 3) {
      an.avisos.push('Con ' + an.total + ' marca' + (an.total === 1 ? '' : 's') +
                     ' todavía no hay mapa: hay una anécdota. Conviene recorrer el ' +
                     'sector entero antes de sacar conclusiones.');
    }
    if (!ms.some(function (m) { return m.tipo === 'agradable'; })) {
      an.avisos.push('No hay ni un sitio marcado como agradable. O el sector no ' +
                     'tiene ninguno —que ya es un hallazgo— o se recorrió buscando ' +
                     'solo lo que está mal.');
    }
    return an;
  }

  // ── El texto, para llevárselo a otro programa ─────────────────────────
  function comoTexto(an, marcas) {
    if (!an || !an.total) return 'Lo intangible: sin marcas.';
    var l = ['LO INTANGIBLE — ' + an.total + ' marcas'];
    an.porTipo.forEach(function (t) {
      l.push('  ' + t.nombre + ': ' + t.n +
        (t.m2 ? ' · ' + t.m2.toLocaleString('es-CO') + ' m²' : '') +
        (t.metros ? ' · ' + t.metros + ' m' : ''));
      t.notas.forEach(function (n) { l.push('      «' + n + '»'); });
    });
    if (an.pctSector != null) {
      l.push('  Superficie marcada: ' + an.pctSector + '% del sector');
    }
    if (an.lote && an.lote.dentroDe.length) {
      l.push('  El lote cae dentro de: ' +
        an.lote.dentroDe.map(function (x) { return x.nombre; }).join(', '));
    }
    if (an.desacuerdos.length) {
      l.push('  Donde no coinciden percepción y conteo:');
      an.desacuerdos.forEach(function (d) { l.push('    · ' + d.texto); });
    }
    an.avisos.forEach(function (a) { l.push('  (' + a + ')'); });
    return l.join('\n');
  }

  /* ── Juntar los recorridos del curso ───────────────────────────────────
     Está escrito arriba y hay que hacerle caso: un mapa de percepción de una
     persona es la opinión de una persona; de veinte que caminaron la misma
     manzana, ya es otra cosa. Hasta acá cada recorrido moría en el teléfono
     que lo levantó.

     Se juntan por ARCHIVO y no por servidor, a propósito. Un recorrido es un
     testimonio con nombre: mandarlo solo debería pasar cuando quien lo hizo
     decide mandarlo. Y de paso funciona en un salón sin internet, que es
     donde se hace la puesta en común.

     Lo que sale de juntarlos no es la suma —eso sería un montón de manchas
     encimadas— sino el ACUERDO: dónde varias personas, cada una por su lado,
     dijeron lo mismo. Esa es la pregunta que vale.                        */
  var PAQUETE = 'urbis-intangible-1';

  /* Veinticinco metros de lado. Es la escala a la que dos personas que
     marcaron «la misma esquina» de verdad marcaron la misma esquina: con diez
     metros, dos trazos a pulso del mismo portón caen en celdas distintas y el
     acuerdo desaparece; con cien, media cuadra se vuelve un punto. */
  var CELDA_M = 25;

  function celdaDe(lat, lng) {
    return Math.round(lat * 110540 / CELDA_M) + ':' + 
           Math.round(lng * rLng(lat) / CELDA_M);
  }

  /* Las celdas que toca una marca. Se topan en cuatrocientas: una zona
     dibujada de un kilómetro de lado son mil seiscientas celdas y contarlas
     no agrega nada —a esa escala ya no es una percepción de un sitio— pero sí
     cuelga un teléfono. */
  function celdasDe(m) {
    var salida = {}, i, j;
    if (!m || !m.pts || !m.pts.length) return [];
    if (m.geom === 'punto') {
      salida[celdaDe(m.pts[0].lat, m.pts[0].lng)] = 1;
    } else if (m.geom === 'linea') {
      for (i = 1; i < m.pts.length; i++) {
        var a = m.pts[i - 1], b = m.pts[i];
        var pasos = Math.min(200, Math.max(1, Math.ceil(largoM([a, b]) / (CELDA_M / 2))));
        for (j = 0; j <= pasos; j++) {
          var t = j / pasos;
          salida[celdaDe(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t)] = 1;
        }
      }
    } else {
      var c = { s: Infinity, n: -Infinity, o: Infinity, e: -Infinity };
      m.pts.forEach(function (p) {
        c.s = Math.min(c.s, p.lat); c.n = Math.max(c.n, p.lat);
        c.o = Math.min(c.o, p.lng); c.e = Math.max(c.e, p.lng);
      });
      var dLat = CELDA_M / 110540, dLng = CELDA_M / rLng((c.s + c.n) / 2);
      var n = 0;
      for (var y = c.s; y <= c.n + dLat / 2 && n < 400; y += dLat) {
        for (var x = c.o; x <= c.e + dLng / 2 && n < 400; x += dLng) {
          if (dentro(y, x, m.pts)) { salida[celdaDe(y, x)] = 1; n++; }
        }
      }
    }
    return Object.keys(salida);
  }

  function centroDeCelda(clave) {
    var p = String(clave).split(':');
    var lat = Number(p[0]) * CELDA_M / 110540;
    return { lat: lat, lng: Number(p[1]) * CELDA_M / rLng(lat) };
  }

  /* El paquete que se lleva de un teléfono a otro. Lleva quién lo hizo y de
     qué sector: sin eso, juntar dos recorridos de barrios distintos daría un
     mapa que no es de ninguna parte. */
  function paraCompartir(marcas, meta) {
    var m = meta || {};
    return {
      formato: PAQUETE,
      autor: String(m.autor || '').slice(0, 60),
      sector: String(m.sector || '').slice(0, 80),
      centro: m.centro || null,
      cuando: new Date().toISOString(),
      marcas: paraGuardar(marcas)
    };
  }

  /* Leer uno. Devuelve el paquete o el motivo por el que no sirve: quien pega
     un archivo equivocado tiene derecho a saber cuál era el problema. */
  function leerPaquete(texto) {
    var d;
    try { d = typeof texto === 'string' ? JSON.parse(texto) : texto; }
    catch (e) { return { error: 'Eso no es un recorrido de URBIS: no se pudo leer como datos.' }; }
    if (!d || d.formato !== PAQUETE) {
      return { error: 'Eso no es un recorrido de lo intangible. Tiene que ser el archivo que ' +
                      'exporta la aplicación.' };
    }
    var buenas = (d.marcas || []).filter(valida);
    if (!buenas.length) return { error: 'Ese recorrido no trae ninguna marca válida.' };
    return { ok: { autor: d.autor || 'Sin nombre', sector: d.sector || '',
                   cuando: d.cuando || '', centro: d.centro || null, marcas: buenas } };
  }

  /* Juntar. Lo que devuelve no es la suma sino el acuerdo. */
  function unir(paquetes) {
    var ps = (paquetes || []).filter(function (p) { return p && p.marcas && p.marcas.length; });
    if (!ps.length) return null;

    // Quién dijo qué, celda por celda y tipo por tipo.
    var mapa = {};
    ps.forEach(function (p, iP) {
      var quien = p.autor || ('recorrido ' + (iP + 1));
      p.marcas.filter(valida).forEach(function (m) {
        celdasDe(m).forEach(function (c) {
          var k = m.tipo + '|' + c;
          if (!mapa[k]) mapa[k] = { tipo: m.tipo, celda: c, quienes: {} };
          mapa[k].quienes[quien] = 1;
        });
      });
    });

    var celdas = Object.keys(mapa).map(function (k) {
      var e = mapa[k];
      var q = Object.keys(e.quienes);
      var p = centroDeCelda(e.celda);
      return { tipo: e.tipo, nombre: POR_ID[e.tipo] ? POR_ID[e.tipo].nombre : e.tipo,
               color: color(e.tipo), lat: p.lat, lng: p.lng,
               personas: q.length, quienes: q };
    });

    var acuerdos = celdas.filter(function (c) { return c.personas >= 2; })
      .sort(function (a, b) { return b.personas - a.personas; });

    var porTipo = TIPOS.map(function (t) {
      var suyas = celdas.filter(function (c) { return c.tipo === t.id; });
      if (!suyas.length) return null;
      var deAcuerdo = suyas.filter(function (c) { return c.personas >= 2; });
      return { id: t.id, nombre: t.nombre, color: t.color,
               celdas: suyas.length, acuerdo: deAcuerdo.length,
               maximo: suyas.reduce(function (x, c) { return Math.max(x, c.personas); }, 0) };
    }).filter(Boolean);

    return {
      recorridos: ps.length,
      autores: ps.map(function (p, i) { return p.autor || ('recorrido ' + (i + 1)); }),
      marcas: ps.reduce(function (t, p) { return t + p.marcas.filter(valida).length; }, 0),
      celdas: celdas, acuerdos: acuerdos, porTipo: porTipo,
      celdaM: CELDA_M,
      /* Con un solo recorrido no hay acuerdo posible, y decirlo evita la peor
         lectura de todas: creer que una coincidencia consigo mismo significa
         algo. */
      hayAcuerdoPosible: ps.length >= 2
    };
  }

  window.URBIS_INTANGIBLE = {
    PAQUETE: PAQUETE, CELDA_M: CELDA_M,
    paraCompartir: paraCompartir, leerPaquete: leerPaquete, unir: unir,
    celdasDe: celdasDe, celdaDe: celdaDe, centroDeCelda: centroDeCelda,
    TIPOS: TIPOS,
    tipo: tipo, color: color, geomDe: geomDe, minimoPuntos: minimoPuntos,
    nuevaMarca: nuevaMarca, valida: valida, paraGuardar: paraGuardar,
    analizar: analizar, comoTexto: comoTexto,
    // Geometría, expuesta porque js/68 dibuja con las mismas cuentas.
    areaM2: areaM2, largoM: largoM, centroide: centroide, dentro: dentro
  };
})();
