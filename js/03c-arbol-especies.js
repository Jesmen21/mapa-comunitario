/* URBIS · ESPECIES DEL ARBOLADO URBANO (js/03c)
   ─────────────────────────────────────────────────────────────────────────
   Qué árbol es, cuando quien mapea lo sabe. Llegó pedido con las palabras de
   quien estaba en la calle: «que pueda elegir la especie del árbol —palma,
   nim, urapán— y un buscador para elegir de tantas especies».

   Vive en su propio archivo y NO dentro de js/03b, que es el vocabulario del
   EDIFICIO. La v974 tuvo que escribir una guarda entera porque «Arbolado
   Urbano» había heredado «es un edificio» por omisión y la ficha de una palma
   preguntaba cuántos pisos tiene; meter las especies en aquel archivo sería
   volver a borrar esa línea a los tres días.

   ── Qué es esta lista y qué NO es ──────────────────────────────────────
   Es el arbolado que se ve en calle, andén, separador y parque en Colombia,
   con sesgo declarado hacia el nororiente —Cúcuta y Norte de Santander—, que
   es donde se está usando el módulo. NO es un catálogo botánico ni el
   inventario de una autoridad ambiental: es una lista de trabajo, se queda
   corta a propósito y por eso lleva sus dos salidas.

   El nombre CIENTÍFICO va al lado y no de adorno: «roble» es un árbol en
   Bogotá y otro en la costa, «acacia» son cuatro cosas distintas, y sin el
   binomio dos personas pueden mapear la misma palabra sobre dos árboles que
   no se parecen. Se escribe el que está aceptado hoy; donde un nombre cambió
   de género hace poco —Tabebuia → Handroanthus— se conserva el sinónimo en
   `alt` para que el buscador siga encontrándolo.

   ── El buscador NO pesa por rareza, y la razón está medida ─────────────
   El de la Matriz de Usos (v973) pondera cada palabra por lo rara que sea
   porque ahí «parque» casa veintidós tipos y entierra los juegos infantiles.
   Acá no pasa: la lista es corta, los nombres son propios y lo que casa
   «palma» son todas palmas —o sea, todos resultados buenos—. Copiar aquel
   algoritmo habría sido una segunda ruta de cálculo para el mismo hecho que
   divergiría a la tanda siguiente (v879), así que se dice por qué no está en
   vez de traerlo por costumbre.

   Lo que sí se hereda de la v973 es la lección de fondo: **el catálogo se
   llama de una manera y la calle de otra**. «Nim» y «neem» son el mismo
   árbol; «flamboyán» y «acacia roja» también. Esos sinónimos van en `alt`,
   PEGADOS a su fila y no en una tabla aparte: así es estructuralmente
   imposible que un sinónimo apunte al vacío, que es el no-op que la v973
   tuvo que perseguir con una guarda. */
(function(){
  'use strict';

  /* Las dos salidas NO se escriben acá: se LEEN de js/03b. Son la misma
     decisión —«se miró y no se pudo determinar» contra «sí hay un valor y
     nuestra lista no lo tiene»— y no existe un cambio razonable que deba
     renombrarlas para el edificio y no para el árbol. Siendo un solo hecho,
     se deriva en vez de copiarse (la prueba de la clase B). Se lee tarde, en
     una función, para no depender del orden en que carguen los archivos. */
  function voc(){ return window.URBIS_EDIFICIO || null; }
  function NO_SE_SABE(){ var v = voc(); return (v && v.NO_SE_SABE) || 'No se sabe'; }
  function OTRO(){ var v = voc(); return (v && v.OTRO) || 'Otro (no está en la lista)'; }

  /* n = nombre común con el que se pide en un vivero colombiano
     c = binomio aceptado
     p = es una palma (ver `contradiceAlTipo` más abajo)
     alt = cómo lo llama la calle, y los sinónimos científicos que cambiaron */
  var ESPECIES = [
    // ── Palmas ────────────────────────────────────────────────────────
    { n:'Palma real', c:'Roystonea regia', p:true, alt:['palma cubana','palma botella real'] },
    { n:'Palma de cera', c:'Ceroxylon quindiuense', p:true, alt:['palma del quindío','árbol nacional'] },
    { n:'Palma areca', c:'Dypsis lutescens', p:true, alt:['areca','palma bambú','chrysalidocarpus'] },
    { n:'Palma abanico', c:'Washingtonia robusta', p:true, alt:['washingtonia','palma washingtonia'] },
    { n:'Cocotero', c:'Cocos nucifera', p:true, alt:['palma de coco','coco'] },
    { n:'Palma datilera', c:'Phoenix dactylifera', p:true, alt:['datilera','dátil','phoenix'] },
    { n:'Palma de aceite', c:'Elaeis guineensis', p:true, alt:['palma africana'] },
    { n:'Palma botella', c:'Hyophorbe lagenicaulis', p:true, alt:['hyophorbe'] },

    // ── Los más plantados en calle y separador ────────────────────────
    { n:'Nim', c:'Azadirachta indica', alt:['neem','nim indio','margosa'] },
    { n:'Oití', c:'Licania tomentosa', alt:['oití brasilero'] },
    { n:'Almendro', c:'Terminalia catappa', alt:['almendro de playa','almendrón'] },
    { n:'Urapán', c:'Fraxinus uhdei', alt:['fresno'] },
    { n:'Matarratón', c:'Gliricidia sepium', alt:['mata ratón','madre de cacao'] },
    { n:'Trupillo', c:'Prosopis juliflora', alt:['cují','aromo','mezquite'] },
    { n:'Acacia roja', c:'Delonix regia', alt:['flamboyán','árbol de fuego','clavellino'] },
    { n:'Acacia amarilla', c:'Senna siamea', alt:['casia','cassia siamea'] },
    { n:'Tulipán africano', c:'Spathodea campanulata', alt:['tulipán','gallito','espatodea'] },
    { n:'Gualanday', c:'Jacaranda caucana', alt:['jacaranda'] },
    { n:'Cañaguate', c:'Handroanthus chrysanthus', alt:['roble amarillo','flor amarillo','guayacán amarillo','tabebuia chrysantha'] },
    { n:'Guayacán rosado', c:'Tabebuia rosea', alt:['ocobo','roble morado','flormorado'] },
    { n:'Samán', c:'Samanea saman', alt:['campano','carreto','albizia saman'] },
    { n:'Ceiba', c:'Ceiba pentandra', alt:['bonga','ceiba bonga'] },
    { n:'Chiminango', c:'Pithecellobium dulce', alt:['payandé','guamachil'] },
    { n:'Caracolí', c:'Anacardium excelsum', alt:['espavé'] },
    { n:'Cámbulo', c:'Erythrina poeppigiana', alt:['bucare','búcaro','písamo'] },
    { n:'Dividivi', c:'Caesalpinia coriaria', alt:['divi divi','watapana'] },
    { n:'Guácimo', c:'Guazuma ulmifolia', alt:['majagua de toro'] },
    { n:'Totumo', c:'Crescentia cujete', alt:['calabazo','taparo'] },
    { n:'Nogal cafetero', c:'Cordia alliodora', alt:['nogal','móncoro','canalete'] },
    { n:'Caucho sabanero', c:'Ficus soatensis', alt:['caucho','ficus'] },
    { n:'Ficus benjamina', c:'Ficus benjamina', alt:['benjamina','laurel de la india'] },
    { n:'Sauce', c:'Salix humboldtiana', alt:['sauce llorón','sauce criollo'] },

    // ── Frutales que en el barrio están en el andén ───────────────────
    { n:'Mango', c:'Mangifera indica', alt:['palo de mango'] },
    { n:'Mamoncillo', c:'Melicoccus bijugatus', alt:['mamón','quenepa'] },
    { n:'Tamarindo', c:'Tamarindus indica', alt:[] },
    { n:'Guayabo', c:'Psidium guajava', alt:['guayaba'] },
    { n:'Níspero', c:'Manilkara zapota', alt:['zapote'] },
    { n:'Hobo', c:'Spondias mombin', alt:['jobo','ciruelo'] },
    { n:'Marañón', c:'Anacardium occidentale', alt:['merey'] },
    { n:'Guamo', c:'Inga edulis', alt:['guaba','guama'] },
    { n:'Papayo', c:'Carica papaya', alt:['papaya'] },
    { n:'Cítrico', c:'Citrus spp.', alt:['limón','naranjo','mandarino','lima'] },

    // ── Maderables y plantaciones que también aparecen en ciudad ──────
    { n:'Cedro', c:'Cedrela odorata', alt:['cedro rosado'] },
    { n:'Caoba', c:'Swietenia macrophylla', alt:[] },
    { n:'Teca', c:'Tectona grandis', alt:[] },
    { n:'Eucalipto', c:'Eucalyptus spp.', alt:['eucaliptus'] },
    { n:'Pino', c:'Pinus spp.', alt:['pino ciprés','ciprés'] },
    { n:'Guadua', c:'Guadua angustifolia', alt:['bambú','caña brava'] }
  ];

  function norm(s){
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /* El buscador. Casa contra el nombre común, el binomio y los sinónimos de
     la propia fila; sin consulta devuelve la lista entera, que es lo que hay
     que ver la primera vez que se abre el campo. */
  function buscarEspecie(q){
    var t = norm(q).trim();
    if (!t) return ESPECIES.slice();
    return ESPECIES.filter(function (e){
      if (norm(e.n).indexOf(t) >= 0 || norm(e.c).indexOf(t) >= 0) return true;
      return (e.alt || []).some(function (a){ return norm(a).indexOf(t) >= 0; });
    });
  }

  function especiePorNombre(n){
    var t = norm(n).trim();
    if (!t) return null;
    for (var i = 0; i < ESPECIES.length; i++) if (norm(ESPECIES[i].n) === t) return ESPECIES[i];
    return null;
  }

  /* Qué usos de la Matriz tienen especie. Hoy es UNO —«Arbolado Urbano», el
     que la v973 creó— y no se deriva del catálogo, porque «esto tiene una
     especie» es una lectura y no una propiedad que el catálogo lleve escrita:
     «Forestal» y «Protección Ambiental» son masas de terreno con muchas
     especies adentro, y preguntarle a un bosque cuál es la suya no tiene
     respuesta. Lo que sí se ata con una guarda (revisar.js) es que todo
     nombre de acá exista en el catálogo: un renombre allá dejaría el campo
     apagado en silencio, que es exactamente la forma de la v974. */
  var USOS_CON_ESPECIE = ['Arbolado Urbano'];
  function esUsoDeArbol(uso){
    return USOS_CON_ESPECIE.indexOf(String(uso || '').trim()) !== -1;
  }

  /* ── Hay tipos del arbolado que no tienen especie (v994) ─────────────────
     Medido en el navegador antes de tocar nada: un «Alcorque vacío (sitio de
     siembra sin árbol)» se pregunta «¿Qué árbol es?» y la v979 lo marca «Sin
     especie anotada. Cuando sepa cuál es, toque Editar» — sobre un hueco en
     el que no hay ningún árbol. Es la clase de la v974 con la palma, viva en
     el mismo archivo que la arregló.

     La excepción va por TIPO y no partiendo el uso, que es la decisión de la
     v991: el tipo se guarda como texto dentro del registro, y partirlo
     dejaría las entradas ya mapeadas apuntando a un uso que ya no existe.

     El valor es POR QUÉ, y no un booleano: son dos razones distintas —no hay
     planta, o sí la hay y la lista no la tiene— y juntarlas mandaría a
     ampliar la lista para un caso que nunca la va a necesitar. */
  var TIPOS_SIN_ESPECIE = {
    'Alcorque vacío (sitio de siembra sin árbol)':
      'no hay ninguna planta que identificar: es el sitio de siembra vacío',
    'Jardinera o arbusto ornamental':
      'la lista de URBIS son árboles y palmas, y esto es un arbusto'
  };
  /* La puerta. Un llamador que solo pase el uso sigue teniendo la respuesta de
     siempre, así que no se rompe ninguno; lo que impide que se OLVIDE el tipo
     es la guarda, que exige que los tres sitios que deciden lo pasen. */
  function tieneEspecie(uso, tipo){
    if (!esUsoDeArbol(uso)) return false;
    var t = String(tipo || '').trim();
    return !(t && Object.prototype.hasOwnProperty.call(TIPOS_SIN_ESPECIE, t));
  }
  function porQueSinEspecie(tipo){
    var t = String(tipo || '').trim();
    return Object.prototype.hasOwnProperty.call(TIPOS_SIN_ESPECIE, t) ? TIPOS_SIN_ESPECIE[t] : '';
  }

  /* Un tipo «Palma» con una especie que no es palma es una contradicción que
     ninguna cuenta vería: las dos casillas son correctas por separado. Se
     DICE en el formulario —donde todavía se puede corregir— y no se bloquea,
     que es lo que este proyecto hace desde la v886 con los mapas de 6,5 cm.
     El discriminante va PEGADO a la fila de la especie (`p`) y no en una
     segunda lista de palmas, que se separaría de esta a la tanda siguiente. */
  function contradiceAlTipo(tipo, nombreEspecie){
    var e = especiePorNombre(nombreEspecie);
    if (!e) return '';
    var tipoEsPalma = /palma/i.test(String(tipo || ''));
    if (tipoEsPalma && !e.p) {
      return 'El tipo dice «' + tipo + '» y ' + e.n + ' no es una palma. Revise cuál de los dos es.';
    }
    if (!tipoEsPalma && e.p && /árbol|arbol/i.test(String(tipo || ''))) {
      return 'El tipo dice «' + tipo + '» y ' + e.n + ' es una palma. Hay un tipo «Palma» en la lista.';
    }
    return '';
  }

  /* ── DÓNDE ESTÁ SEMBRADO (v993) ─────────────────────────────────────────
     Pedido en la calle: «que diga si el árbol tiene su propia jardinera o es
     un árbol normal». Vive en ESTE archivo y no en uno nuevo porque es del
     mismo uso que la especie —Arbolado Urbano— y el archivo ya deriva de
     js/03b las dos salidas. La v981 abrió un archivo propio para el material
     por lo contrario: aquel campo va en cuatro usos que no son este.

     ── Por qué importa, y qué NO es ──────────────────────────────────────
     Un árbol sembrado en el piso duro sin hueco es el que levanta el andén y
     el que se seca primero. Pero «Árbol que levanta el andén» ya es un TIPO
     del catálogo, y los dos NO son un solo hecho: un árbol con alcorque
     demasiado chico también levanta el andén, y uno sin alcorque puede no
     estar levantando nada todavía. La prueba de la clase B —¿existe un cambio
     razonable que deba mover uno y no el otro?— responde que sí, así que son
     dos campos.

     ── Y por qué ESTA lista SÍ lleva «Otro» ──────────────────────────────
     La escala de estado de la v992 no lo lleva, y la razón se sostiene allá:
     cuatro peldaños son exhaustivos por definición de escala. Esto es otra
     cosa: es una ENUMERACIÓN del mundo, y una enumeración nunca está
     completa. Sin la salida, quien tiene delante un caso que la lista no trae
     elige «el más parecido» para poder seguir, y eso mete un dato falso que
     después nadie distingue de uno bueno (v975). */
  var SITIOS = [
    { n:'Alcorque en andén',
      d:'Hueco abierto en el piso duro, cuadrado o redondo, con tierra a la vista.',
      alt:['hueco','cajuela','poceta','tierra a la vista'] },
    { n:'Alcorque con rejilla o enchape',
      d:'El mismo hueco, cubierto con rejilla, adoquín suelto o enchape permeable.',
      alt:['adoquin','cubierto','tapado','permeable'] },
    { n:'Jardinera elevada',
      d:'Cajón de obra por encima del nivel del andén, con borde construido.',
      alt:['matera','cajon','borde de obra','levantada'] },
    { n:'Zona verde o separador',
      d:'Tierra continua sin borde construido: separador vial, franja verde, parque.',
      alt:['franja','prado','parque','grama','tierra continua'] },
    { n:'Antejardín',
      d:'El jardín privado entre la fachada y el andén.',
      alt:['jardin privado','frente de casa','patio delantero'] },
    { n:'Sin sitio de siembra',
      d:'El tronco sale directamente del piso duro, sin hueco ni tierra a la vista.',
      alt:['sin alcorque','pavimento','concreto','sin hueco','directo'] }
  ];
  function normS(x){
    return String(x || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim();
  }
  function sitioPorNombre(n){
    var k = normS(n);
    for (var i = 0; i < SITIOS.length; i++) if (normS(SITIOS[i].n) === k) return SITIOS[i];
    return null;
  }
  /* El buscador NO pesa por rareza, por lo mismo que el de especies y el de
     materiales: la lista es de seis y lo que case es todo resultado bueno.
     Los sinónimos van PEGADOS a su fila, así que ninguno puede apuntar al
     vacío (v975). */
  function buscarSitio(q){
    var k = normS(q);
    if (!k) return SITIOS.slice();
    return SITIOS.filter(function (x) {
      if (normS(x.n).indexOf(k) >= 0) return true;
      for (var i = 0; i < (x.alt || []).length; i++) if (normS(x.alt[i]).indexOf(k) >= 0) return true;
      return false;
    });
  }

  window.URBIS_SITIO_VOC = {
    SITIOS: SITIOS,
    NO_SE_SABE: NO_SE_SABE,
    OTRO: OTRO,
    buscar: buscarSitio,
    porNombre: sitioPorNombre,
    /* Los MISMOS usos que la especie, y leídos de la misma lista: un uso que
       tenga árboles tiene dónde estar sembrado, y no existe un cambio
       razonable que deba mover una lista y no la otra. Dos listas se
       separarían a la tanda siguiente. */
    USOS_CON_SITIO: USOS_CON_ESPECIE,
    esUsoConSitio: esUsoDeArbol,
    /* Lo que hace que la cifra se pueda leer: cuántos NO tienen dónde estar
       sembrados. Va acá y no en cada pantalla, o cada una lo sumaría con su
       propio criterio (v879). */
    SIN_SITIO: 'Sin sitio de siembra',
    texto: function (valor, otroTexto){
      var v = String(valor || '').trim();
      if (!v || v === 'undefined') return '';
      if (v === OTRO()) {
        var t = String(otroTexto || '').trim();
        return t ? t + ' (no está en la lista de URBIS)' : 'Un sitio que no está en la lista, sin nombrar';
      }
      if (v === NO_SE_SABE()) return 'No se pudo determinar desde la acera';
      var x = sitioPorNombre(v);
      return x ? x.n : v;
    }
  };

  window.URBIS_ARBOL_VOC = Object.assign(window.URBIS_ARBOL_VOC || {}, {
    ESPECIES: ESPECIES,
    NO_SE_SABE: NO_SE_SABE,
    OTRO: OTRO,
    buscar: buscarEspecie,
    porNombre: especiePorNombre,
    USOS_CON_ESPECIE: USOS_CON_ESPECIE,
    esUsoDeArbol: esUsoDeArbol,
    TIPOS_SIN_ESPECIE: TIPOS_SIN_ESPECIE,
    tieneEspecie: tieneEspecie,
    porQueSinEspecie: porQueSinEspecie,
    contradiceAlTipo: contradiceAlTipo,
    /* Cómo se imprime. Un solo sitio para las tres superficies que lo
       enseñan —el globo, la ficha y el propio formulario—: tres redacciones
       de la misma frase se separan a la tanda siguiente (v867). */
    texto: function (valor, otroTexto){
      var v = String(valor || '').trim();
      if (!v || v === 'undefined') return '';
      if (v === OTRO()) {
        var t = String(otroTexto || '').trim();
        return t ? t + ' (no está en la lista de URBIS)' : 'Una especie que no está en la lista, sin nombrar';
      }
      if (v === NO_SE_SABE()) return 'No se pudo determinar desde la acera';
      var e = especiePorNombre(v);
      return e ? e.n + ' (' + e.c + ')' : v;
    }
  });
})();
