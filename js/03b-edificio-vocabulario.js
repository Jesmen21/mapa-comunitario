/* URBIS · VOCABULARIO DEL EDIFICIO (js/03b)
   ─────────────────────────────────────────────────────────────────────────
   Las listas con las que se describe un inmueble en campo —de qué está hecho,
   qué hay a nivel de calle, de qué época es— y el cruce que estima su
   vulnerabilidad potencial.

   Vive en su propio archivo porque lo necesitan DOS páginas que no comparten
   nada más: el mapa (index.html, que lo usa al mapear) y el análisis
   (analisis-ia.html, donde un analista levanta la ficha desde la calle). Estaba
   dentro de js/04, que arrastra Leaflet y el mapa entero, así que la página de
   análisis no podía tocarlo sin cargar medio programa.

   Aquí NO va `leerEdificio`: esa función depende del orden del registro
   serializado, que es asunto de js/04. Este archivo solo tiene vocabulario y
   reglas de dominio, sin dependencias. */
(function(){
  'use strict';

  const MATERIALIDAD_NA = 'Sin registrar';

  // Toda lista cerrada miente un poco: siempre hay un edificio que no encaja y
  // siempre hay un dato que desde la acera no se puede determinar. Sin una
  // salida, quien está mapeando elige la opción "más parecida" para poder
  // seguir, y eso mete un dato falso que después nadie distingue de uno bueno.
  // Son DOS salidas y no una porque no significan lo mismo:
  //   · NO_SE_SABE  → se miró y no se pudo determinar. Es un límite del método.
  //   · OTRO        → sí hay un valor, pero nuestro vocabulario no lo tiene.
  //                   Es un límite de la LISTA, y por eso se pide describirlo:
  //                   son las candidatas a entrar en la próxima versión.
  // Las dos valen como "desconocido" para cualquier cálculo. Ninguna se puede
  // confundir con haber observado algo.
  const NO_SE_SABE = 'No se sabe';
  const OTRO_VALOR = 'Otro (no está en la lista)';
  const SALIDAS = [NO_SE_SABE, OTRO_VALOR];
  const SIN_DATO = new Set([MATERIALIDAD_NA, NO_SE_SABE, OTRO_VALOR, '', 'undefined']);
  // Normaliza a '' lo que no es una observación utilizable.
  function valorUtil(v){
    const t = String(v || '').trim();
    return SIN_DATO.has(t) ? '' : t;
  }

  // Materialidad del contexto colombiano, en el orden en que se reconoce a
  // simple vista desde la acera. No es una ficha catastral: es lo que un
  // estudiante puede determinar mirando la fachada sin entrar.
  const MATERIALIDAD_EDIFICIO = [
    MATERIALIDAD_NA,
    'Mampostería confinada (ladrillo con vigas y columnas)',
    'Mampostería sin confinar (ladrillo o bloque solo)',
    'Concreto reforzado (pórticos o muros)',
    'Bahareque o tapia pisada',
    'Madera',
    'Prefabricado',
    'Lámina, zinc o material reciclado',
    'Mixto (varios sistemas en el mismo edificio)'
  ].concat(SALIDAS);

  // Qué hay a nivel de calle. Es UNA pregunta y no "en qué piso está cada uso"
  // porque lo que decide el comportamiento urbano no es el inventario por
  // planta, es si la fachada que se pasa caminando está viva o muerta. Un
  // centro comercial con las tiendas en el tercer piso y un vestíbulo ciego
  // abajo atrae gente igual, pero no hace calle: son dos hechos distintos y
  // hasta ahora el análisis los contaba como uno.
  const PLANTA_BAJA = [
    'Sin registrar',
    'Comercio o local con vitrina',
    'Otro uso con puerta a la calle',
    'Acceso a vivienda (vestíbulo o portería)',
    'Parqueadero o garaje',
    'Muro ciego o reja',
    'Local vacío o cerrado'
  ].concat(SALIDAS);
  // Las que NO hacen calle: se puede pasar por delante media cuadra sin que
  // ocurra nada. El vestíbulo entra aquí sin ser un defecto — una portería es
  // necesaria y correcta, simplemente no genera vida de acera.
  const PLANTA_BAJA_MUERTA = new Set([
    'Acceso a vivienda (vestíbulo o portería)',
    'Parqueadero o garaje',
    'Muro ciego o reja',
    'Local vacío o cerrado'
  ]);

  // Época de construcción. Los cortes NO son décadas redondas: son los umbrales
  // de la norma sismo resistente colombiana, que es lo que de verdad separa un
  // edificio de otro en una zona de amenaza alta como Cúcuta. El primer código
  // nacional es el Decreto 1400 de 1984, expedido tras el terremoto de Popayán
  // de 1983; lo reemplaza la NSR-98 (Ley 400 de 1997, Decreto 33 de 1998) y
  // luego la NSR-10 (Decreto 926 de 2010). Antes de 1984 no había norma que
  // cumplir, y eso importa más que si la casa es de los sesenta o los setenta.
  const EPOCA_EDIFICIO = [
    'Sin registrar',
    'Anterior a 1950',
    '1950 – 1983 (sin norma sismo resistente)',
    '1984 – 1997 (Decreto 1400 de 1984)',
    '1998 – 2009 (NSR-98)',
    '2010 o posterior (NSR-10)',
    'En construcción'
  ].concat(SALIDAS);

  // Vulnerabilidad POTENCIAL, no un diagnóstico estructural. Un curso contando
  // fachadas desde la acera no puede evaluar una estructura, y presentarlo como
  // si pudiera sería el peor error que este módulo podría enseñar. Lo que sí
  // dice, y es útil, es qué combinaciones merecen que alguien vaya a mirar en
  // serio: un muro de ladrillo sin confinar levantado antes de que existiera
  // norma no es lo mismo que un pórtico de concreto de 2015.
  const RIESGO_EPOCA = {
    'Anterior a 1950': 3,
    '1950 – 1983 (sin norma sismo resistente)': 3,
    '1984 – 1997 (Decreto 1400 de 1984)': 2,
    '1998 – 2009 (NSR-98)': 1,
    '2010 o posterior (NSR-10)': 0
  };
  const RIESGO_MATERIAL = {
    'Mampostería sin confinar (ladrillo o bloque solo)': 2,
    'Bahareque o tapia pisada': 2,
    'Lámina, zinc o material reciclado': 2,
    'Madera': 1,
    'Prefabricado': 1,
    'Mixto (varios sistemas en el mismo edificio)': 1,
    'Mampostería confinada (ladrillo con vigas y columnas)': 0,
    'Concreto reforzado (pórticos o muros)': 0
  };

  // Devuelve null cuando falta cualquiera de los dos datos: media evaluación no
  // es media verdad, es una cifra que parece saber algo y no sabe.
  function vulnerabilidadDe(materialidad, epoca){
    const re = RIESGO_EPOCA[epoca], rm = RIESGO_MATERIAL[materialidad];
    if (re === undefined || rm === undefined) return null;
    const total = re + rm;
    return { puntos: total,
             nivel: total >= 4 ? 'Alta' : total >= 2 ? 'Media' : 'Baja' };
  }


  // Se expone lo que no depende del registro. js/04 añade después `leer`,
  // `usosMarcados` y `esCategoriaEdificio` sobre este mismo objeto.
  window.URBIS_EDIFICIO = Object.assign(window.URBIS_EDIFICIO || {}, {
    MATERIALIDAD: MATERIALIDAD_EDIFICIO,
    PLANTA_BAJA: PLANTA_BAJA,
    EPOCA: EPOCA_EDIFICIO,
    SIN_REGISTRAR: MATERIALIDAD_NA,
    NO_SE_SABE: NO_SE_SABE,
    OTRO: OTRO_VALOR,
    valorUtil: valorUtil,
    vulnerabilidadDe: vulnerabilidadDe,
    // Única definición de qué frente NO hace calle.
    esFrenteMuerto: function (v){ return PLANTA_BAJA_MUERTA.has(String(v || '')); }
  });
})();
