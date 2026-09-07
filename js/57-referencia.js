/* URBIS · UN NÚMERO CON SU REFERENCIA (js/57)
   ─────────────────────────────────────────────────────────────────────────
   «38 usos por hectárea» solo no dice nada. Dice algo comparado con los
   sectores que ESTE usuario ya levantó: salen de su propio trabajo y son la
   única referencia honesta que hay a la mano — no existe una tabla nacional
   de densidades de sector que se pueda citar.

   La cuenta es la misma en los dos módulos y las fuentes no: el análisis de
   empresas compara contra sus análisis guardados y el del curso contra las
   fichas de sector del propio curso. Por eso acá está la CUENTA, y cada
   módulo le pasa sus valores.

   Dos reglas que no son de estilo:

   · Con menos de tres para comparar no se muestra nada. «Por encima de 1 de
     2» es ruido con forma de dato, y un dato con forma de dato se cree.

   · El sector que se está mirando no entra en su propia referencia. Si
     entrara, siempre empataría consigo mismo y la posición se correría un
     puesto hacia arriba sin que nada lo dijera. Quien llama pasa la lista
     ya sin él.                                                            */
(function () {
  'use strict';

  var MINIMO = 3;

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* `otros` son los valores contra los que se compara, YA sin el actual.
     Devuelve null cuando no hay con qué comparar: quien llama no pinta nada,
     en vez de pintar una caja vacía que parece un fallo. */
  function calcular(otros, actual) {
    if (typeof actual !== 'number' || !isFinite(actual)) return null;
    var vals = (otros || []).filter(function (v) { return typeof v === 'number' && isFinite(v); })
                            .sort(function (a, b) { return a - b; });
    if (vals.length < MINIMO) return null;
    var min = vals[0], max = vals[vals.length - 1];
    var debajo = vals.filter(function (v) { return v < actual; }).length;
    var rango = max - min;
    // La marca ubica el valor dentro del rango de lo ya levantado. Si se sale
    // del rango se pega al extremo, y el texto lo dice: quedarse callado ahí
    // sería lo mismo que mentir con un 0 % o un 100 %.
    var pct = rango <= 0 ? 50 : Math.max(0, Math.min(100, ((actual - min) / rango) * 100));
    var texto = actual > max ? 'el más alto de tus ' + (vals.length + 1)
              : actual < min ? 'el más bajo de tus ' + (vals.length + 1)
              : 'por encima de ' + debajo + ' de ' + vals.length;
    return { n: vals.length, min: min, max: max, pct: pct, debajo: debajo, texto: texto };
  }

  function html(otros, actual) {
    var r = calcular(otros, actual);
    if (!r) return '';
    return '<span class="urb-ref" title="Comparado con tus ' + r.n + ' sectores">' +
      '<span class="urb-ref-riel"><i style="left:' + r.pct.toFixed(1) + '%"></i></span>' +
      '<em>' + esc(r.texto) + '</em></span>';
  }

  window.URBIS_REFERENCIA = { calcular: calcular, html: html, MINIMO: MINIMO };
})();
