/* URBIS · DE QUÉ ESTÁ HECHA LA VÍA (js/03f)
   ─────────────────────────────────────────────────────────────────────────
   Pedido junto con el estado: «verde está buena, naranja medio regular, malo,
   muy malo… y el tipo de pavimento». El estado entró en la v992; la superficie
   es la otra mitad, y sin ella el estado no se puede leer: un «regular» sobre
   asfalto y un «regular» sobre una vía en tierra no son el mismo problema ni
   los arregla la misma entidad.

   ── Por qué NO va en la lista de materiales de js/03d ─────────────────
   Porque son dos vocabularios y no uno, y la prueba de la clase B lo dice:
   *¿existe un cambio razonable que deba mover una y no la otra?* Sí, y en las
   dos direcciones. Una banca puede ser de guadua y una vía no; una vía puede
   ser de afirmado y una banca no. Con una sola lista, quien mapea una caneca
   tendría que pasar por «adoquín» y quien mapea una cuadra por «lona o tela»,
   y el día que entre un material de mobiliario se le ofrecería a las vías sin
   que nadie lo decidiera.

   El propio título de js/03d lo dice: «de qué está hecho el MOBILIARIO
   URBANO». Meter la calzada ahí sería ampliar ese archivo a algo que su
   nombre no cubre.

   ── Y por qué SÍ es un campo y no tipos nuevos del catálogo ───────────
   La misma razón de la v981: «Vía principal en asfalto», «Vía principal en
   adoquín», «Vía local en tierra»… multiplica el catálogo por siete y el
   análisis deja de poder contar vías principales. Con un campo, el conteo por
   tipo sigue siendo uno.

   ── Lo que esta lista NO mide ─────────────────────────────────────────
   El ESTADO, que vive en js/03e y se juzga contra una escala escrita. La
   superficie SE VE; el estado se califica. Mezclarlos haría que «asfalto» y
   «con huecos» fueran valores del mismo campo, que es el error que este
   módulo lleva tandas deshaciendo.

   Tampoco mide el ANCHO ni el número de carriles: eso lo levanta la plantilla
   del perfil vial (v939), que se camina con cinta. */
(function(){
  'use strict';

  /* Las dos salidas se LEEN de js/03b y no se escriben acá: es la misma
     decisión que para el edificio, el árbol, el material y el sitio de
     siembra, y no existe un cambio razonable que deba renombrarlas para uno y
     no para los otros. Se lee tarde, en una función, para no depender del
     orden de carga. */
  function voc(){ return window.URBIS_EDIFICIO || null; }
  function NO_SE_SABE(){ var v = voc(); return (v && v.NO_SE_SABE) || 'No se sabe'; }
  function OTRO(){ var v = voc(); return (v && v.OTRO) || 'Otro (no está en la lista)'; }

  /* n = como se nombra señalándola
     d = qué la distingue DESDE EL ANDÉN, que es donde se decide. No es una
         ayuda: es lo que hace que dos personas clasifiquen igual la misma
         cuadra, que es lo mismo que la escala del estado (v992).
     alt = cómo la llama la calle */
  var SUPERFICIES = [
    { n:'Asfalto', d:'Negro o gris oscuro, de una sola capa continua. Se agrieta en piel de cocodrilo y se ahueca.',
      alt:['asfalto','pavimento flexible','asfaltada','pavimentada','negro'] },
    { n:'Placa de concreto', d:'Losas grises con juntas cada pocos metros. Se fisura en las esquinas de la losa.',
      alt:['concreto','cemento','placa','losa','rigido','pavimento rigido'] },
    { n:'Huella de concreto', d:'Dos franjas de concreto para las llantas y el centro sin pavimentar. Común en vía rural.',
      alt:['huella','huellas','placa huella','dos franjas'] },
    { n:'Adoquín', d:'Piezas moduladas puestas en espina o en hilera. Se hunden por tramos.',
      alt:['adoquin','adoquines','adoquinada','bloque'] },
    { n:'Afirmado (recebo o gravilla)', d:'Material granular compactado, sin capa de rodadura. Levanta polvo en seco.',
      alt:['afirmado','recebo','gravilla','balastro','destapada','sin pavimentar'] },
    { n:'Tierra', d:'Sin ningún material de afirmado. Se vuelve barro con la lluvia.',
      alt:['tierra','trocha','barro','natural'] },
    { n:'Empedrado o piedra', d:'Piedra natural sin modular, irregular.',
      alt:['empedrado','piedra','rio','calzada de piedra'] },
    { n:'Mixta (dos superficies en el tramo)', d:'La cuadra cambia de material a la mitad: media en asfalto y media en tierra.',
      alt:['mixta','mixto','parcial','a medias','media cuadra'] }
  ];

  /* Qué usos llevan este campo. Uno solo hoy, y va como LISTA por lo mismo
     que `USOS_CON_MATERIAL` y `USOS_CON_ESTADO`: el día que otro lo necesite
     se agrega un renglón y no se toca la condición. Una guarda ata cada
     nombre al catálogo, porque un renombre allá dejaría el campo apagado en
     silencio (v974). */
  var USOS_CON_SUPERFICIE = ['Vías e Infraestructura Vial'];
  /* Lo que se dejó FUERA y por qué, para que la próxima tanda no lo mida otra
     vez: el ANDÉN. Su superficie se levanta con la plantilla de andenes
     (v942), que ya tiene columna de material y se camina con cinta; tener las
     dos cosas serían dos maneras de codificar un solo hecho. */
  function esUsoConSuperficie(uso){
    return USOS_CON_SUPERFICIE.indexOf(String(uso || '').trim()) !== -1;
  }

  function norm(s){
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ').trim();
  }
  function superficiePorNombre(n){
    var k = norm(n);
    for (var i = 0; i < SUPERFICIES.length; i++) if (norm(SUPERFICIES[i].n) === k) return SUPERFICIES[i];
    return null;
  }
  /* El buscador de la lista cerrada, con la misma forma que el de la especie
     y el del material: nombre, descripción y sinónimos, sin tildes. */
  function buscarSuperficie(q){
    var k = norm(q);
    if (!k) return SUPERFICIES.slice();
    return SUPERFICIES.filter(function (s){
      if (norm(s.n).indexOf(k) !== -1) return true;
      if (norm(s.d).indexOf(k) !== -1) return true;
      return (s.alt || []).some(function (a){ return norm(a).indexOf(k) !== -1; });
    });
  }

  window.URBIS_SUPERFICIE_VOC = {
    NO_SE_SABE: NO_SE_SABE,
    OTRO: OTRO,
    SUPERFICIES: SUPERFICIES,
    USOS_CON_SUPERFICIE: USOS_CON_SUPERFICIE,
    esUsoConSuperficie: esUsoConSuperficie,
    superficiePorNombre: superficiePorNombre,
    /* `buscar` es el nombre que el componente de lista cerrada llama en
       las cuatro (js/20, `pintarLista`). Con otro nombre el control
       saldría vacío y sin un solo error, que es el defecto de la v895. */
    buscar: buscarSuperficie,
    buscarSuperficie: buscarSuperficie,
    /* La redacción que sale a pantalla, en un solo sitio: el globo, la ficha,
       el panel y el formulario la leen de acá o se separan a la tanda
       siguiente (v879). */
    texto: function (valor, otroTexto){
      var v = String(valor || '').trim();
      if (!v || v === 'undefined') return '';
      if (v === NO_SE_SABE()) return 'No se pudo determinar desde la acera';
      if (v === OTRO()) {
        var t = String(otroTexto || '').trim();
        return t ? (t + ' (no está en la lista de URBIS)') : 'Otra superficie, sin anotar cuál';
      }
      var s = superficiePorNombre(v);
      return s ? s.n : v;
    }
  };
})();
