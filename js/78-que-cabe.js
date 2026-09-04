/* URBIS · Qué cabe en el lote
   ═══════════════════════════════════════════════════════════════════════
   Todo lo anterior mide el sitio. Esto es el primer paso del otro lado: qué
   se puede poner ahí. Es el puente que le faltaba al módulo — el análisis
   terminaba en «qué le pide el sitio al proyecto» y ahí se acababa, sin un
   lugar donde el estudiante dijera qué va a proponer y comprobara si cabe.

   Una advertencia que este archivo repite donde haga falta, porque es la
   diferencia entre una herramienta útil y una peligrosa:

     LOS ÍNDICES LOS PONE EL ESTUDIANTE. Salen del POT del municipio y URBIS
     NO LOS CONOCE. Acá no se consulta ninguna norma: se hace la cuenta con
     los números que alguien escribió, y si escribió mal, la cuenta sale mal
     con la misma cara de seguridad.

   Eso no es una limitación que haya que disimular: es lo que hay que
   enseñar. Un estudiante que no sabe de dónde sale su índice de ocupación no
   sabe proyectar, y una aplicación que se lo regala le quita justo esa
   pregunta.

   Y lo que sí sabe URBIS —el área real del lote, sus frentes, su pendiente,
   la sombra de los vecinos, la gente que vive alrededor— se cruza contra esa
   cuenta. Ahí está lo que ninguna tabla de índices puede decir sola.       */
(function () {
  'use strict';

  function n(x) { return (x === null || x === undefined || x === '') ? null : Number(x); }
  function r1(x) { return Math.round(x * 10) / 10; }

  /* Lo que se le pide al estudiante, con lo que significa cada cosa. El texto
     de ayuda no es adorno: la mitad de los errores de un taller salen de
     confundir ocupación con construcción. */
  var CAMPOS = [
    { id: 'io', nombre: 'Índice de ocupación', unidad: '0 a 1', pordefecto: 0.6,
      ayuda: 'Cuánto del lote puede tapar la huella del edificio. 0,6 quiere decir ' +
             'que el 60% del lote se puede construir en planta baja.' },
    { id: 'ic', nombre: 'Índice de construcción', unidad: 'veces el lote', pordefecto: 2,
      ayuda: 'Cuántos metros cuadrados construidos se permiten por cada metro de lote. ' +
             'Con 2, en un lote de 300 m² caben 600 m² construidos.' },
    { id: 'pisos', nombre: 'Altura máxima', unidad: 'pisos', pordefecto: 4,
      ayuda: 'Los pisos que deja la norma. Es un tope aparte del índice de construcción: ' +
             'mandan los dos, y gana el que se agote primero.' },
    { id: 'aisFrente', nombre: 'Antejardín', unidad: 'm', pordefecto: 3,
      ayuda: 'Lo que hay que dejar libre contra la calle.' },
    { id: 'aisLado', nombre: 'Aislamiento lateral', unidad: 'm', pordefecto: 0,
      ayuda: 'Contra los vecinos de al lado. Cero si se puede pegar, que es lo normal ' +
             'en la manzana tradicional.' },
    { id: 'aisFondo', nombre: 'Aislamiento posterior', unidad: 'm', pordefecto: 3,
      ayuda: 'Contra el fondo. Es el que casi nadie mira y el que más se pelea, porque ' +
             'de él depende que el vecino tenga ventana.' },
    { id: 'm2Vivienda', nombre: 'Tamaño de la vivienda', unidad: 'm²', pordefecto: 60,
      ayuda: 'Para traducir metros construidos a cuántas familias. La VIS en Colombia ' +
             'ronda los 50 m²; una vivienda de estrato medio, 80 o 90.' }
  ];

  function porDefecto() {
    var o = {};
    CAMPOS.forEach(function (c) { o[c.id] = c.pordefecto; });
    return o;
  }

  /* La cuenta. `lote` es lo que midió URBIS; `idx` lo que escribió la
     persona; `ctx` lo demás que ya se midió del sitio. */
  function calcular(lote, idx, ctx) {
    if (!lote || !lote.areaM2) return null;
    var i = idx || porDefecto();
    var c = ctx || {};
    var area = Number(lote.areaM2);

    /* El área que queda después de los aislamientos, estimada por el
       perímetro. Es una APROXIMACIÓN y se dice: la exacta sale de encoger el
       polígono lado por lado, y para eso hay que saber cuál lado da a la
       calle, cuál al vecino y cuál al fondo — que es una decisión de
       proyecto y no un dato. */
    var frenteM = (lote.frentes || []).reduce(function (t, f) {
      return t + (f.largoM || 0); }, 0);
    var restoM = Math.max(0, (lote.perimetroM || 0) - frenteM);
    var quitado = frenteM * n(i.aisFrente) + restoM * ((n(i.aisLado) + n(i.aisFondo)) / 2);
    var areaNeta = Math.max(0, area - quitado);

    var porIndice = area * n(i.io);
    // La huella no puede ser mayor que lo que dejan los aislamientos.
    var huella = Math.min(porIndice, areaNeta);
    var mandaAislamiento = areaNeta < porIndice - 1;

    var construiblePorIC = area * n(i.ic);
    var construiblePorAltura = huella * n(i.pisos);
    var construible = Math.min(construiblePorIC, construiblePorAltura);
    var mandaAltura = construiblePorAltura < construiblePorIC - 1;

    var pisosQueSalen = huella > 0 ? construible / huella : 0;
    var viviendas = n(i.m2Vivienda) > 0 ? Math.floor(construible / n(i.m2Vivienda)) : 0;
    var porHogar = n(c.personasPorVivienda) || 3.5;
    var personas = Math.round(viviendas * porHogar);

    var avisos = [], cruces = [];

    // ── Lo que solo se puede decir porque el sitio está medido ──────────
    if (c.pendientePct != null && c.pendientePct >= 15) {
      cruces.push({ clase: 'pendiente',
        texto: 'La pendiente medida es del ' + String(r1(c.pendientePct)).replace('.', ',') +
          '%. Una huella de ' + Math.round(huella) + ' m² sobre esa pendiente no se resuelve ' +
          'con una losa: son plataformas, muros de contención y un sótano que aparece solo. ' +
          'Eso cambia el costo antes que el diseño.' });
    }
    if (c.sombraPct != null && c.sombraPct >= 20) {
      cruces.push({ clase: 'sombra',
        texto: 'Los vecinos ya tapan el ' + Math.round(c.sombraPct) + '% del lote a las 15:00. ' +
          'Las plantas bajas de ese lado no van a tener sol de tarde: conviene poner ahí lo ' +
          'que no lo necesita —parqueo, depósito, circulación— y subir la vivienda.' });
    }
    if (c.amenazaAlta) {
      cruces.push({ clase: 'sismo',
        texto: 'El municipio está en amenaza sísmica alta. Con ' + Math.round(pisosQueSalen) +
          ' pisos, la regularidad en planta y en altura deja de ser una preferencia y pasa a ' +
          'ser lo que decide si la estructura es sensata o cara.' });
    }
    if (c.m2PublicoPorHab != null && personas > 0) {
      var meta = 15;
      var faltan = Math.max(0, meta - c.m2PublicoPorHab);
      if (faltan > 0) {
        cruces.push({ clase: 'publico',
          texto: 'El sector tiene ' + String(r1(c.m2PublicoPorHab)).replace('.', ',') +
            ' m² de espacio público por habitante y la meta nacional son ' + meta +
            ' (Decreto 1504). Meter ' + personas + ' personas más sin agregar espacio público ' +
            'lo empeora: harían falta ' + Math.round(personas * meta / 10000 * 10) / 10 +
            ' ha para sostener la meta con los nuevos.' });
      }
    }
    if (c.usosCerca != null && c.usosCerca < 10 && viviendas >= 10) {
      cruces.push({ clase: 'servicios',
        texto: 'Alrededor hay ' + c.usosCerca + ' usos mapeados a distancia de caminar. ' +
          viviendas + ' viviendas nuevas son gente que va a necesitar comprar, estudiar y ' +
          'curarse cerca: o el proyecto pone algo de eso en planta baja, o los manda a ' +
          'todos en carro.' });
    }

    // ── Lo que hay que decir siempre ────────────────────────────────────
    avisos.push('Los índices los pusiste vos y salen del POT del municipio: URBIS no los ' +
                'conoce ni los verifica. Si están mal, esta cuenta está mal con la misma ' +
                'cara de seguridad.');
    avisos.push('El área que queda después de los aislamientos es aproximada: se estima con ' +
                'el perímetro y los frentes. La exacta sale de encoger el polígono lado por ' +
                'lado, y para eso hay que decidir cuál da al vecino y cuál al fondo — que es ' +
                'proyecto, no dato.');
    if (mandaAislamiento) {
      avisos.push('Acá no manda el índice de ocupación sino los aislamientos: dejan menos ' +
                  'suelo del que el índice permitiría ocupar.');
    }
    if (mandaAltura) {
      avisos.push('Y no manda el índice de construcción sino la altura: con ' + i.pisos +
                  ' pisos sobre esa huella no se llega a lo que el índice dejaría construir.');
    }

    return {
      areaLoteM2: Math.round(area),
      areaNetaM2: Math.round(areaNeta),
      huellaM2: Math.round(huella),
      construibleM2: Math.round(construible),
      pisosQueSalen: r1(pisosQueSalen),
      pisosTope: n(i.pisos),
      viviendas: viviendas,
      personas: personas,
      personasPorVivienda: r1(porHogar),
      mandaAislamiento: mandaAislamiento,
      mandaAltura: mandaAltura,
      cruces: cruces,
      avisos: avisos,
      indices: i
    };
  }

  function comoTexto(q) {
    if (!q) return 'Qué cabe: sin lote o sin índices.';
    var l = ['QUÉ CABE EN EL LOTE'];
    l.push('  Lote: ' + q.areaLoteM2.toLocaleString('es-CO') + ' m²');
    l.push('  Índices usados (del POT, puestos a mano): ocupación ' +
           String(q.indices.io).replace('.', ',') + ' · construcción ' +
           String(q.indices.ic).replace('.', ',') + ' · ' + q.indices.pisos + ' pisos');
    l.push('  Aislamientos: antejardín ' + q.indices.aisFrente + ' m, lateral ' +
           q.indices.aisLado + ' m, posterior ' + q.indices.aisFondo + ' m');
    l.push('  Huella posible: ' + q.huellaM2.toLocaleString('es-CO') + ' m²');
    l.push('  Área construible: ' + q.construibleM2.toLocaleString('es-CO') + ' m² en ' +
           String(q.pisosQueSalen).replace('.', ',') + ' pisos');
    l.push('  Da para ' + q.viviendas + ' viviendas de ' + q.indices.m2Vivienda +
           ' m², o sea unas ' + q.personas + ' personas');
    if (q.cruces.length) {
      l.push('  Contra lo que se midió del sitio:');
      q.cruces.forEach(function (c) { l.push('    · ' + c.texto); });
    }
    q.avisos.forEach(function (a) { l.push('  (' + a + ')'); });
    return l.join('\n');
  }

  window.URBIS_QUE_CABE = {
    CAMPOS: CAMPOS, porDefecto: porDefecto, calcular: calcular, comoTexto: comoTexto
  };
})();
