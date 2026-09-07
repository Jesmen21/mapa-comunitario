/* URBIS · EL ENTORNO SEGÚN LA DISTANCIA (js/58)
   ─────────────────────────────────────────────────────────────────────────
   El motor devuelve `multiRadio`: el mismo sector medido en varios anillos
   concéntricos. Es el dato más analítico que produce, y hasta la v801 se
   leía como una tabla de seis columnas.

   Este archivo lo dibuja, y vive aparte porque lo pintan DOS módulos que no
   comparten código: el análisis de empresas (js/62, en analisis-ia.html) y
   el análisis del curso (js/65, en index.html). Tenerlo dos veces sería la
   misma enfermedad que ya se curó con la paleta del uso predominante:
   dos copias, y una que se queda atrás.

   Dos decisiones que llevan toda la utilidad del bloque:

   1. UN GRÁFICO POR MÉTRICA, no todas en un eje. Usos son cientos, usos por
      hectárea son decenas y habitantes son miles: puestos en un solo eje,
      tres de las cuatro líneas quedan aplastadas contra el suelo y no se lee
      ninguna. Cada una con su escala, todas con el mismo eje de radio.

   2. POR HECTÁREA, no en conteo crudo. Un anillo de 1 km tiene once veces la
      superficie de uno de 300 m, así que CUALQUIER conteo sube al alejarse;
      un gráfico de conteos estaría describiendo el tamaño del círculo y no
      el barrio. Dividido por hectárea, la forma dice algo: si la densidad
      baja al alejarse, el lote está en un núcleo; si sube, está en un borde
      y lo denso queda afuera.

   Lo que se mira es la forma. El número exacto sigue en la tabla que cada
   módulo pinta debajo, que es donde se consulta.                          */
(function () {
  'use strict';

  var COLORES = { usos: '#22d3ee', comercio: '#e5484d', equip: '#3b82f6', gente: '#22c55e' };

  /* El motor ya calcula el área de cada anillo. Se prefiere la suya a
     rehacer πr² acá: si mañana un anillo deja de ser un círculo completo
     —un sector recortado por el río, por ejemplo— la fórmula de acá daría
     una densidad inventada y la del motor no. */
  function haDe(a) {
    var ha = Number(a && a.areaHa);
    if (isFinite(ha) && ha > 0) return ha;
    var r = Number(a && a.radioM) || 0;
    return Math.max(0.01, (Math.PI * r * r) / 10000);
  }

  var METRICAS = [
    { id: 'usos',     t: 'Usos por hectárea',      c: COLORES.usos,
      f: function (a) { return Number(a.densidadPorHa) || 0; } },
    { id: 'comercio', t: 'Comercio por ha',        c: COLORES.comercio,
      f: function (a) { return (a.comercio || 0) / haDe(a); } },
    { id: 'equip',    t: 'Equipamientos por ha',   c: COLORES.equip,
      f: function (a) { return (a.equipamientos || 0) / haDe(a); } },
    { id: 'gente',    t: 'Habitantes por ha',      c: COLORES.gente,
      f: function (a) { return (a.poblacionEstimada || 0) / haDe(a); } }
  ];

  /* Una densidad de 0,115 equipamientos por hectárea redondeada a un decimal
     es «0,1», que no distingue 0,05 de 0,14: el dato se pierde justo en el
     rango donde más importa, el de las cosas escasas. La precisión sigue a
     la magnitud. */
  function cifra(x) {
    if (!isFinite(x)) return '—';
    return x >= 100 ? String(Math.round(x))
         : x >= 1   ? String(Math.round(x * 10) / 10)
                    : String(Math.round(x * 100) / 100);
  }

  function etiquetaRadio(v) { return v >= 1000 ? (v / 1000) + ' km' : v + ' m'; }

  function chispa(anillos, valorDe, color) {
    var vals = anillos.map(valorDe);
    var i;
    for (i = 0; i < vals.length; i++) if (!isFinite(vals[i])) return '';
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var rango = Math.max(1e-9, max - min);
    var W = 100, H = 30;
    var px = function (j) { return anillos.length < 2 ? W / 2 : (j / (anillos.length - 1)) * W; };
    var py = function (v) { return H - ((v - min) / rango) * (H - 6) - 3; };
    var linea = vals.map(function (v, j) {
      return (j ? 'L' : 'M') + px(j).toFixed(2) + ' ' + py(v).toFixed(2);
    }).join(' ');
    var area = linea + ' L' + W + ' ' + H + ' L0 ' + H + ' Z';
    // El anillo analizado se marca: es el que se pidió, y sin él la curva no
    // dice respecto a qué se está leyendo el resto.
    var iAct = -1;
    for (i = 0; i < anillos.length; i++) if (anillos[i].esAnalizado) { iAct = i; break; }
    return '<svg class="urb-anillo-chispa" viewBox="0 0 ' + W + ' ' + H + '" ' +
      'preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + area + '" fill="' + color + '" opacity=".16"/>' +
      '<path d="' + linea + '" fill="none" stroke="' + color + '" stroke-width="1.6" ' +
      'stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      (iAct >= 0 ? '<circle cx="' + px(iAct).toFixed(2) + '" cy="' + py(vals[iAct]).toFixed(2) +
                   '" r="2.4" fill="' + color + '" class="urb-anillo-punto"/>' : '') +
      '</svg>';
  }

  /* La lectura en palabras. Un dibujo de tres puntos en un teléfono se ve,
     pero no se lee; la frase es la que se queda. El umbral del 12 % existe
     para no llamar «sube» a un ruido de medición: por debajo de eso, lo
     honesto es decir que se mantiene. */
  function lecturaForma(anillos, valorDe) {
    var v = anillos.map(valorDe), i;
    if (v.length < 2) return '';
    for (i = 0; i < v.length; i++) if (!isFinite(v[i])) return '';
    var primero = v[0], ultimo = v[v.length - 1];
    if (!primero) return '';
    var cambio = Math.round(((ultimo - primero) / primero) * 100);
    if (Math.abs(cambio) < 12) return 'se mantiene';
    return cambio < 0 ? 'baja al alejarse' : 'sube al alejarse';
  }

  function grafico(multiRadio) {
    var m = multiRadio;
    if (!m || !m.anillos || m.anillos.length < 2) return '';
    var A = m.anillos;
    var act = null, i;
    for (i = 0; i < A.length; i++) if (A[i].esAnalizado) { act = A[i]; break; }
    if (!act) act = A[A.length - 1];

    var minis = METRICAS.map(function (M) {
      var svg = chispa(A, M.f, M.c);
      if (!svg) return '';
      return '<figure class="urb-anillo-mini" data-metrica="' + M.id + '">' +
        '<figcaption>' + M.t + '</figcaption>' + svg +
        '<b>' + cifra(M.f(act)) + '<small>/ha</small></b>' +
        '<small class="urb-anillo-forma">' + lecturaForma(A, M.f) + '</small>' +
        '</figure>';
    }).join('');
    if (!minis) return '';

    return '<div class="urb-anillos-grid">' + minis + '</div>' +
      '<p class="urb-anillos-eje"><span>' + etiquetaRadio(A[0].radioM) + '</span>' +
      '<span>distancia desde el lote</span>' +
      '<span>' + etiquetaRadio(A[A.length - 1].radioM) + '</span></p>';
  }

  window.URBIS_ANILLOS = {
    grafico: grafico,
    // Expuestas para poder probarlas sin navegar la interfaz entera.
    lecturaForma: lecturaForma,
    cifra: cifra,
    METRICAS: METRICAS
  };
})();
