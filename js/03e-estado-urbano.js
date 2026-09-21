/* URBIS · EN QUÉ ESTADO ESTÁ LO QUE SE MAPEA (js/03e)
   ─────────────────────────────────────────────────────────────────────────
   Pedido con estas palabras, mapeando: «verde está buena, naranja medio
   regular, malo, muy malo». Es la mitad que la v981 y la v982 dejaron
   declarada y sin hacer: se puede mapear un hidrante, una tapa de
   alcantarillado y una banca, y no había manera de decir que está rota —que
   es justamente lo que un vecino quiere reportar—.

   ── Por qué NO va en la lista de materiales ───────────────────────────
   Porque no son la misma clase de hecho, y el propio js/03d lo dejó escrito:
   «el material se ve, el estado se juzga, y dos personas califican distinto
   la misma banca. Mezclarlos en una lista haría que "metálica" y "oxidada"
   fueran valores del mismo campo». Son dos campos, dos vocabularios y dos
   archivos.

   ── Y por qué SÍ se puede contar, que es lo que cambia ────────────────
   La v942 declinó contar el estado del andén, con esta razón: «eso pediría
   una escala acordada antes de salir, que es trabajo de curso y no de
   código». La objeción es correcta y lo que la levanta es escribir la
   escala: cada peldaño lleva AQUÍ su criterio, en una lista cerrada, así que
   dos personas que la lean califican por lo mismo. Sin el criterio escrito,
   «regular» es una opinión; con él, es una observación contra una vara.

   Lo que sigue siendo cierto y va impreso al lado de cualquier cuenta: es un
   JUICIO desde la acera y no una inspección técnica.

   ── Sin «Otro», a propósito ───────────────────────────────────────────
   Las otras dos listas cerradas de este proyecto —la especie y el material—
   llevan «Otro (no está en la lista)» porque su lista es incompleta por
   construcción: siempre hay un árbol más. Una escala de cuatro peldaños NO
   es incompleta: o el objeto cae en uno, o no se pudo determinar. Un «Otro»
   acá invitaría a texto libre sobre un juicio, que es exactamente lo que lo
   volvería incontable. */
(function(){
  'use strict';

  /* La salida se LEE de js/03b y no se escribe acá: es la misma decisión que
     para el edificio, el árbol y el material, y no existe un cambio razonable
     que deba renombrarla para uno y no para los otros. Se lee tarde, en una
     función, para no depender del orden de carga. */
  function voc(){ return window.URBIS_EDIFICIO || null; }
  function NO_SE_SABE(){ var v = voc(); return (v && v.NO_SE_SABE) || 'No se sabe'; }

  /* n = el peldaño, con las palabras con que se pidió
     d = SU CRITERIO. Es lo que convierte la escala en una vara y no en una
         opinión, así que no es una ayuda: es el dato.
     c = el color, acá y en un solo sitio. Las pantallas lo leen de la fila;
         escrito en cada hoja de estilo serían tres verdes que se separan.
     p = el peso, para poder ordenar y comparar sin leer el nombre. */
  var ESTADOS = [
    { n:'Bueno', p:0, c:'#1B9E6B',
      d:'Cumple su función y no se le ve daño. Pintura entera, piezas completas, sin óxido.' },
    { n:'Regular', p:1, c:'#D99A32',
      d:'Sirve, con daño a la vista: óxido, pintura perdida, fisuras, grafiti, una pieza suelta.' },
    { n:'Malo', p:2, c:'#C2410C',
      d:'No cumple bien su función: banca sin tablas, tapa hundida, poste inclinado, vía con huecos.' },
    { n:'Muy malo o inservible', p:3, c:'#8C1D18',
      d:'No se puede usar, o es un riesgo: tapa faltante, luminaria arrancada, poste a punto de caer.' }
  ];

  /* Qué usos llevan este campo. Los cuatro del material —lo que se toca y se
     pisa— más las vías, que es donde se pidió: «el pavimento». Va como LISTA
     por lo mismo que `USOS_CON_MATERIAL`: un uso nuevo cuesta un renglón y no
     tocar la condición. Una guarda ata cada nombre al catálogo, porque un
     renombre allá dejaría el campo apagado en silencio (v974). */
  var USOS_CON_ESTADO = ['Mobiliario Urbano', 'Redes en Vía (tapas y registros)',
    'Arte Urbano', 'Publicidad Exterior Visual', 'Vías e Infraestructura Vial'];
  /* Lo que se dejó FUERA y por qué, para que la próxima tanda no lo mida otra
     vez: el ARBOLADO, porque «Árbol en riesgo (inclinado, seco o ahuecado)»
     ya es un TIPO del catálogo y tener las dos cosas serían dos maneras de
     codificar un solo hecho —la clase B—; y el ESPACIO PÚBLICO, porque el
     estado de un parque es un compuesto —el césped, las bancas, la luz— y un
     solo peldaño para todo eso no dice de qué habla. */
  function esUsoConEstado(uso){
    return USOS_CON_ESTADO.indexOf(String(uso || '').trim()) !== -1;
  }

  function norm(s){
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ').trim();
  }
  function estadoPorNombre(n){
    var k = norm(n);
    for (var i = 0; i < ESTADOS.length; i++) if (norm(ESTADOS[i].n) === k) return ESTADOS[i];
    return null;
  }
  function colorDe(n){
    var e = estadoPorNombre(n);
    return e ? e.c : '';
  }

  window.URBIS_ESTADO_VOC = {
    NO_SE_SABE: NO_SE_SABE,
    ESTADOS: ESTADOS,
    USOS_CON_ESTADO: USOS_CON_ESTADO,
    esUsoConEstado: esUsoConEstado,
    estadoPorNombre: estadoPorNombre,
    colorDe: colorDe,
    /* La advertencia va con la CIFRA y no con la pantalla, que es la regla
       del aviso de origen (v867): una pantalla nueva la hereda sin que su
       autor se acuerde. */
    AVISO: 'Es un juicio desde la acera contra la escala escrita, no una inspección técnica.',
    /* La redacción que sale a pantalla, en un solo sitio: el globo, la ficha,
       el panel y el formulario la leen de acá o se separan a la tanda
       siguiente. */
    texto: function (valor){
      var v = String(valor || '').trim();
      if (!v || v === 'undefined') return '';
      if (v === NO_SE_SABE()) return 'No se pudo determinar desde la acera';
      var e = estadoPorNombre(v);
      return e ? e.n : v;
    }
  };
})();
