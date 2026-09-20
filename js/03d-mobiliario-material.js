/* URBIS · DE QUÉ ESTÁ HECHO EL MOBILIARIO URBANO (js/03d)
   ─────────────────────────────────────────────────────────────────────────
   Pedido en la calle, con la foto de una caneca de varilla oxidada delante:
   «bancas, jardineras, canecas y postes… basura metálica». El material no es
   un adorno del inventario: una banca de concreto dura veinte años y una de
   madera sin mantenimiento dos, una caneca metálica se roba y una plástica
   se quema, y un poste de madera es otra cosa que uno de concreto a la hora
   de colgarle una red.

   ── Por qué un CAMPO y no veinte tipos más ────────────────────────────
   La tentación era escribir «Caneca metálica», «Caneca plástica», «Banca de
   concreto», «Banca de madera»… y el catálogo se multiplica por seis sin
   decir nada nuevo: seguirían siendo una caneca y una banca. Peor, el
   análisis dejaría de poder contar canecas —tendría que sumar cuatro tipos
   que alguien tiene que acordarse de mantener juntos—, que es la clase B de
   este proyecto en su forma más cara.

   Con un campo, quien mapea da dos toques y el conteo por tipo sigue siendo
   uno. Es la misma decisión que la v975 tomó con la especie del árbol, y por
   eso este archivo se parece a aquel a propósito.

   ── Lo que la lista NO hace ───────────────────────────────────────────
   No mide el ESTADO —bueno, regular, malo—. Es otro hecho y se decide de
   otra manera: el material se ve, el estado se juzga, y dos personas
   califican distinto la misma banca. Mezclarlos en una lista haría que
   «metálica» y «oxidada» fueran valores del mismo campo, que es exactamente
   el error que este módulo lleva tandas deshaciendo.

   Y es OPCIONAL, por la razón de la v973: un campo obligatorio que no se
   sabe contestar se contesta con relleno. Quien lo miró y no lo pudo
   determinar tiene «No se sabe», que es una respuesta distinta de no haber
   contestado. */
(function(){
  'use strict';

  /* Las dos salidas se LEEN de js/03b, no se escriben acá: son la misma
     decisión que para el edificio y para el árbol, y no existe un cambio
     razonable que deba renombrarlas para uno y no para los otros (la prueba
     de la clase B). Se lee tarde, en una función, para no depender del orden
     de carga. */
  function voc(){ return window.URBIS_EDIFICIO || null; }
  function NO_SE_SABE(){ var v = voc(); return (v && v.NO_SE_SABE) || 'No se sabe'; }
  function OTRO(){ var v = voc(); return (v && v.OTRO) || 'Otro (no está en la lista)'; }

  /* n = como se nombra señalándolo
     d = qué lo distingue desde el andén, que es donde se decide
     alt = cómo lo llama la calle */
  var MATERIALES = [
    { n:'Concreto o prefabricado', d:'Gris, pesado, de una sola pieza o en bloques.',
      alt:['cemento','hormigon','prefabricado','concreto'] },
    { n:'Metálico (hierro o acero)', d:'Varilla, tubo o lámina. Se oxida y suena hueco al golpe.',
      alt:['metal','metalica','metalico','hierro','acero','varilla','lamina','tubo'] },
    { n:'Madera', d:'Listones o troncos. Se astilla y se pudre por la base.',
      alt:['madera','listones','tronco','guadua'] },
    { n:'Plástico o polietileno', d:'Liviano, de color, sin óxido. Se deforma con el sol.',
      alt:['plastico','polietileno','pvc','resina'] },
    { n:'Mixto (metal y madera)', d:'Estructura metálica con asiento o tablillas de madera.',
      alt:['mixto','combinado','metal y madera'] },
    { n:'Mampostería o ladrillo', d:'Pegado en obra, con pañete o ladrillo a la vista.',
      alt:['ladrillo','mamposteria','bloque','obra'] },
    { n:'Piedra', d:'Bloque o enchape en piedra natural.',
      alt:['piedra','roca','granito'] },
    /* Entraron con la v983: un pasacalle es de lona y un aviso de fachada
       suele ser de acrílico o vidrio. La lista creció porque el material del
       uso nuevo no estaba, no por completarla de adorno. */
    { n:'Lona o tela', d:'Flexible, tensada o colgada. Se rasga y destiñe.',
      alt:['lona','tela','banner','pendon','pasacalle','vinilo'] },
    { n:'Vidrio o acrílico', d:'Transparente o traslúcido. Se raya y se estrella.',
      alt:['vidrio','acrilico','policarbonato','cristal'] },
    { n:'Bronce o fundición', d:'Metal fundido, oscuro y con pátina verde.',
      alt:['bronce','fundicion','latón','laton','cobre'] }
  ];

  /* Qué usos llevan este campo. Una sola entrada hoy, y va como LISTA por lo
     mismo que `USOS_CON_ESPECIE` en js/03c: el día que otro uso lo necesite
     se agrega un renglón y no se toca la condición. Lo que sí se ata con una
     guarda (revisar.js) es que todo nombre de acá exista en el catálogo —un
     renombre allá dejaría el campo apagado en silencio, que es la forma de
     la v974—. */
  var USOS_CON_MATERIAL = ['Mobiliario Urbano', 'Redes en Vía (tapas y registros)',
    'Arte Urbano', 'Publicidad Exterior Visual'];
  function esUsoConMaterial(uso){
    return USOS_CON_MATERIAL.indexOf(String(uso || '').trim()) !== -1;
  }

  function norm(s){
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ').trim();
  }
  function materialPorNombre(n){
    var k = norm(n);
    for (var i = 0; i < MATERIALES.length; i++) if (norm(MATERIALES[i].n) === k) return MATERIALES[i];
    return null;
  }

  /* El buscador NO pesa por rareza, y por lo mismo que en js/03c: la lista es
     de siete y lo que casa «metal» son todos resultados buenos. Traer el
     algoritmo de la v973 sería una segunda ruta de cálculo para el mismo
     hecho. Los sinónimos van PEGADOS a su fila, así que es imposible que uno
     apunte al vacío. */
  function buscar(q){
    var k = norm(q);
    if (!k) return MATERIALES.slice();
    return MATERIALES.filter(function (m) {
      if (norm(m.n).indexOf(k) >= 0) return true;
      for (var i = 0; i < (m.alt || []).length; i++) if (norm(m.alt[i]).indexOf(k) >= 0) return true;
      return false;
    });
  }

  window.URBIS_MOBILIARIO_VOC = {
    NO_SE_SABE: NO_SE_SABE,
    OTRO: OTRO,
    MATERIALES: MATERIALES,
    USOS_CON_MATERIAL: USOS_CON_MATERIAL,
    esUsoConMaterial: esUsoConMaterial,
    materialPorNombre: materialPorNombre,
    buscar: buscar,
    /* La redacción que sale a pantalla, en un solo sitio: el globo, la ficha
       y el formulario la leen de acá o se separan a la tanda siguiente. */
    texto: function (valor, otroTexto){
      var v = String(valor || '').trim();
      if (!v || v === 'undefined') return '';
      if (v === OTRO()) {
        var t = String(otroTexto || '').trim();
        return t ? t + ' (no está en la lista de URBIS)' : 'Un material que no está en la lista, sin nombrar';
      }
      if (v === NO_SE_SABE()) return 'No se pudo determinar desde el andén';
      var m = materialPorNombre(v);
      return m ? m.n : v;
    }
  };
})();
