/* URBIS · Análisis de Implantación — CATÁLOGO (js/59)
   La mitad pública del motor: los nombres, los grupos, los emojis y los
   colores con los que la pantalla dibuja. Nada de esto decide nada.

   Las reglas que RECONOCEN cada uso —las expresiones regulares que traducen
   una etiqueta de OpenStreetMap a una categoría urbanística— viven aparte,
   en js/60-analisis-ia-motor.js, y son el trabajo que URBIS no regala.
   Este archivo se puede leer entero sin aprender cómo clasifica URBIS: es
   el índice, no el libro.

   Cargar SIEMPRE antes de js/60. El motor falla con un error explícito si
   este archivo no está: una taxonomía a medias produciría análisis
   silenciosamente equivocados, que es peor que no producir ninguno. */
(function(){
  'use strict';

  const GRUPOS = {
      vivienda:      { t:'Vivienda y ocio',                 i:'🏠' },
      comercio:      { t:'Comercio y economía',             i:'🏬' },
      institucional: { t:'Institucional y gobierno',        i:'🏛️' },
      industria:     { t:'Industria y logística',           i:'🏭' },
      salud:         { t:'Salud y emergencias',             i:'🚑' },
      cultura:       { t:'Cultura, educación y culto',      i:'🎭' },
      servicios:     { t:'Servicios e infraestructura',     i:'🚛' },
      ambiente:      { t:'Ambiente y zona rural',           i:'🌳' },
      riesgo:        { t:'Riesgo, deterioro y suelo sin definir', i:'⚠️' },
      mixtos:        { t:'Usos combinados',                 i:'🧩' },
      otro:          { t:'Otro (uso por definir)',          i:'❓' }
    };

  const GRUPO_COLOR = {
      vivienda:'#ff8a4a', comercio:'#e5484d', institucional:'#3b82f6',
      industria:'#8b6f47', salud:'#ec4899', cultura:'#a855f7',
      servicios:'#14b8a6', ambiente:'#22c55e', riesgo:'#eab308',
      mixtos:'#6366f1',
      // Pedido explícito: uso desconocido en color llamativo para verlo rápido.
      otro:'#FF00AA'
    };

  const TAXONOMIA = [
      // Salud
      { sub:'drogueria',       nombre:'Droguería',            grupo:'salud',        icono:'💊' },
      { sub:'laboratorio',     nombre:'Laboratorio',          grupo:'salud',        icono:'🧪' },
      { sub:'salud_ips',       nombre:'IPS / Clínica',        grupo:'salud',        icono:'🏥' },
      // Hogar geriátrico / casa de cuidado: no es una IPS (no atiende urgencias
      // ni consulta externa) pero sí concentra población dependiente y visitas
      // diarias. Separarlo cambia la lectura del entorno: demanda de droguería,
      // de transporte especial y de comercio de proximidad, no de comercio de paso.
      { sub:'hogar_cuidado',   nombre:'Hogar geriátrico / cuidado', grupo:'salud',  icono:'🧓' },
      { sub:'veterinaria',     nombre:'Veterinaria',          grupo:'salud',        icono:'🐾' },
      { sub:'bomberos',        nombre:'Bomberos / Rescate',   grupo:'salud',        icono:'🚒' },
      // Comodín de salud: terapias, especialidades y healthcare=yes (antes
      // caían en "sin definir": Therapy for Kids, Consultorio de la Piel...).
      { sub:'optica',          nombre:'Óptica / Audiología',  grupo:'salud',        icono:'👓' },
      { sub:'salud_otro',      nombre:'Servicio de salud',    grupo:'salud',        icono:'🩺' },
      // Comercio
      // Tiendas de descuento (D1, Ara, Justo & Bueno): en OSM suelen venir
      // etiquetadas como shop=supermarket igual que cualquier supermercado, así
      // que sin mirar la marca se perdían en la misma categoría. Va ANTES de
      // 'supermercado' a propósito: si además trae shop=supermarket, esta regla
      // debe ganar. Pedido explícito: que queden aparte porque para un
      // constructor/inmobiliaria son una señal de mercado distinta a un
      // supermercado grande (Éxito, Metro, Merkarico).
      { sub:'tienda_descuento',nombre:'Tienda de descuento',  grupo:'comercio',     icono:'🏷️' },
      { sub:'supermercado',    nombre:'Supermercado',         grupo:'comercio',     icono:'🛒' },
      { sub:'centro_comercial',nombre:'Centro comercial',     grupo:'comercio',     icono:'🏬' },
      { sub:'tienda_barrio',   nombre:'Tienda de barrio',     grupo:'comercio',     icono:'🏪' },
      { sub:'panaderia',       nombre:'Panadería',            grupo:'comercio',     icono:'🥖' },
      { sub:'banco',           nombre:'Banco / Cajero',       grupo:'comercio',     icono:'🏦' },
      // Muy común en Colombia: corresponsales bancarios y puntos de pago
      // (Efecty, SuperGiros) y cafés internet.
      { sub:'pagos',           nombre:'Corresponsal / Pagos', grupo:'comercio',     icono:'💳' },
      { sub:'internet_cafe',   nombre:'Café internet',        grupo:'comercio',     icono:'🖥️' },
      { sub:'hotel',           nombre:'Hotel / Hospedaje',    grupo:'comercio',     icono:'🏨' },
      { sub:'camping',         nombre:'Camping / zona de acampada', grupo:'comercio', icono:'⛺' },
      { sub:'salon_eventos',   nombre:'Salón de eventos',     grupo:'comercio',     icono:'🎪' },
      { sub:'gasolinera',      nombre:'Estación de servicio', grupo:'comercio',     icono:'⛽' },
      { sub:'restaurante',     nombre:'Restaurante',          grupo:'comercio',     icono:'🍽️' },
      { sub:'cafeteria',       nombre:'Cafetería',            grupo:'comercio',     icono:'☕' },
      // ── Comercio minorista por rubro ──────────────────────────────────────
      // Antes TODO shop=* que no fuera mercado o panadería caía en el comodín
      // "Comercio general": un centro comercial de 60 locales aparecía como 60
      // puntos idénticos. Para decidir qué poner en un local, no es lo mismo
      // tener al lado 12 almacenes de ropa que 12 ferreterías: el primero es un
      // corredor de compra por antojo (paseo, permanencia, consumo de café), el
      // segundo es de compra por encargo (llegar, comprar, irse). Cada rubro se
      // separa solo cuando cambia esa lectura; los demás siguen en el comodín.
      { sub:'ropa',            nombre:'Ropa y calzado',       grupo:'comercio',     icono:'👗' },
      { sub:'belleza',         nombre:'Peluquería / Belleza', grupo:'comercio',     icono:'💇' },
      { sub:'lavanderia',      nombre:'Lavandería',           grupo:'comercio',     icono:'🧺' },
      { sub:'ferreteria',      nombre:'Ferretería / Materiales', grupo:'comercio',  icono:'🔩' },
      { sub:'muebles_hogar',   nombre:'Muebles y hogar',      grupo:'comercio',     icono:'🛋️' },
      { sub:'tecnologia',      nombre:'Tecnología / Electrónica', grupo:'comercio', icono:'📱' },
      { sub:'papeleria',       nombre:'Papelería / Librería', grupo:'comercio',     icono:'📒' },
      // El taller y el repuesto son de los usos que más marcan el carácter de
      // una vía: piden acera ocupada, ruido y parqueo en calzada. Un local de
      // paso —café, droguería— rinde distinto en una cuadra así.
      { sub:'automotriz',      nombre:'Automotriz / Taller',  grupo:'comercio',     icono:'🚗' },
      { sub:'licorera',        nombre:'Licorera / Estanco',   grupo:'comercio',     icono:'🍾' },
      { sub:'tienda_deportes', nombre:'Tienda deportiva',     grupo:'comercio',     icono:'🏀' },
      { sub:'vivero',          nombre:'Vivero / Floristería', grupo:'comercio',     icono:'🪴' },
      { sub:'variedades',      nombre:'Variedades / Regalos', grupo:'comercio',     icono:'🎁' },
      // Vivienda y ocio
      { sub:'bar_ocio',        nombre:'Bar / Ocio nocturno',  grupo:'vivienda',     icono:'🍻' },
      // Reportado: un gimnasio nuevo no aparecía en el análisis. Solo se
      // reconocían dos etiquetas, y en la práctica se mapean de varias formas:
      // amenity=gym es la vieja (obsoleta pero muy usada) y el deporte concreto
      // —crossfit, halterofilia— suele venir en `sport` sin ningún `leisure`.
      // Al gimnasio de pesas se suman los estudios de una sola disciplina —yoga,
      // pilates, box, artes marciales—: ocupan un local de barrio, funcionan por
      // tandas de clase y sueltan a la calle un grupo entero a la misma hora.
      // Para el flujo peatonal se comportan igual que un gimnasio, no como un
      // estadio, y en OSM suelen venir solo con `sport=*`, sin `leisure`.
      { sub:'gimnasio',        nombre:'Gimnasio',             grupo:'vivienda',     icono:'🏋️' },
      { sub:'deportivo',       nombre:'Escenario deportivo',  grupo:'vivienda',     icono:'⚽' },
      { sub:'parque',          nombre:'Parque / Zona verde',  grupo:'vivienda',     icono:'🌳' },
      // Espacio público duro: la plaza, el atrio, la zona peatonal. No es un
      // parque —no tiene verde que medir— pero es donde la gente se queda, y
      // eso sostiene el comercio de la cuadra igual o más que un parque.
      { sub:'plaza',           nombre:'Plaza / Espacio público', grupo:'vivienda',  icono:'⛲' },
      { sub:'residencial',     nombre:'Vivienda',             grupo:'vivienda',     icono:'🏠' },
      // Poblados donde vive gente pero que no se mapean como barrio: asentamientos
      // informales, resguardos y comunidades indígenas. Se mapean con etiquetas
      // prestadas —muchas veces `tourism=camp_site`— porque no hay una mejor.
      { sub:'asentamiento',    nombre:'Asentamiento / poblado', grupo:'vivienda',   icono:'🏕️' },
      // Va ANTES de educación a propósito: el ICBF opera jardines infantiles,
      // pero es una entidad de bienestar del Estado (pedido explícito).
      { sub:'bienestar_social', nombre:'Bienestar social del Estado', grupo:'institucional', icono:'🏛️' },
      // `building=multiusos` no es una etiqueta estándar de OpenStreetMap: la
      // escriben los mapeadores locales para el salón multiusos del barrio, que
      // en Colombia es equipamiento de la Junta de Acción Comunal.
      { sub:'salon_comunal',   nombre:'Salón comunal / multiusos', grupo:'institucional', icono:'🏘️' },
      // Cultura, educación y culto
      // landuse=education marca el LOTE educativo sin decir de qué nivel. En una
      // ciudad como Cúcuta la inmensa mayoría son colegios, no campus, así que
      // se lee como colegio antes que dejarlo sin categoría.
      { sub:'colegio',         nombre:'Colegio / Jardín',     grupo:'cultura',      icono:'🏫' },
      // capacitacion va ANTES de universidad a propósito: una autoescuela o un
      // instituto de idiomas suele traer TAMBIÉN office=educational_institution,
      // y caía en 'universidad'. Eso hacía que el informe citara "Academia
      // Automóvil Cúcuta" como equipamiento ancla de educación superior.
      // office=educational_institution es una señal DÉBIL: la usan por igual una
      // universidad y una autoescuela. Una universidad de verdad trae
      // amenity=university, así que esta etiqueta se trata como formación y no
      // como educación superior — antes hacía que el informe citara "Academia
      // Automóvil Cúcuta" entre los equipamientos ancla del sector.
      { sub:'capacitacion',    nombre:'Centro de formación',  grupo:'cultura',      icono:'📚' },
      { sub:'universidad',     nombre:'Universidad / Instituto', grupo:'cultura',   icono:'🎓' },
      { sub:'iglesia',         nombre:'Iglesia / Culto',      grupo:'cultura',      icono:'⛪' },
      { sub:'cultural',        nombre:'Equipamiento cultural',grupo:'cultura',      icono:'🎭' },
      // Institucional
      // amenity=servicio_de_seguridad del estado: variante no estándar que
      // aparece en CAI de Cúcuta (ej. "Cai Parque Colón") — mismo concepto que
      // amenity=police, solo con otra etiqueta.
      { sub:'policia',         nombre:'Policía / CAI',        grupo:'institucional',icono:'🚓' },
      { sub:'gobierno',        nombre:'Entidad pública',      grupo:'institucional',icono:'🏛️' },
      { sub:'notaria',         nombre:'Notaría / Jurídico',   grupo:'institucional',icono:'⚖️' },
      // Servicios e infraestructura (vias/ciclorrutas van a stats.movilidad, no a POIs)
      { sub:'via_arteria',     nombre:'Vía arteria',          grupo:'servicios',    icono:'🛣️' },
      { sub:'ciclorruta',      nombre:'Ciclorruta',           grupo:'servicios',    icono:'🚴' },
      // Estación de bicicleta pública. No es lo mismo que un cicloparqueadero
      // (`bicycle_parking`, en Transporte): allí la gente deja su bici, aquí la
      // toma y la devuelve, así que genera viajes a pie de ida y de vuelta.
      { sub:'bici_publica',    nombre:'Bicicleta pública',    grupo:'servicios',    icono:'🚲' },
      { sub:'parada_bus',      nombre:'Parada de transporte', grupo:'servicios',    icono:'🚌' },
      // car_pooling: en la práctica en Cúcuta aparece mapeado como "Parqueadero"
      // por el nombre que le puso quien lo mapeó, aunque la etiqueta técnica de
      // OSM sea para compartir carro, no para dejar el carro.
      { sub:'transporte',      nombre:'Transporte / Parqueo', grupo:'servicios',    icono:'🅿️' },
      { sub:'infra_servicios', nombre:'Infraestructura',      grupo:'servicios',    icono:'🗼' },
      // Servientrega / Inter Rapidísimo y demás puntos de envío.
      { sub:'mensajeria',      nombre:'Mensajería / Correo',  grupo:'servicios',    icono:'📮' },
      { sub:'mobiliario',      nombre:'Mobiliario urbano',    grupo:'servicios',    icono:'🪑' },
      { sub:'edificacion_menor', nombre:'Edificación de servicio', grupo:'servicios', icono:'🧱' },
      { sub:'funerario',       nombre:'Servicio funerario',   grupo:'servicios',    icono:'🕊️' },
      // Industria
      { sub:'industria',       nombre:'Industria',            grupo:'industria',    icono:'🏭' },
      { sub:'bodega',          nombre:'Bodega / Logística',   grupo:'industria',    icono:'📦' },
      // Ambiente
      { sub:'agua',            nombre:'Cuerpo de agua',       grupo:'ambiente',     icono:'💧' },
      // Suelo rural productivo y sus construcciones auxiliares: en el borde de
      // Cúcuta marcan dónde termina la ciudad y empieza el campo.
      { sub:'verde_natural',   nombre:'Verde natural',        grupo:'ambiente',     icono:'🌿' },
      // Riesgo / transición
      // Separados a propósito: una obra en curso indica TRANSFORMACIÓN del
      // sector, mientras un lote sin desarrollar indica EXPANSIÓN. Son señales
      // distintas para un inversionista. `baldio_obra` se conserva como suma
      // de ambos para no romper las reglas que ya lo usaban.
      { sub:'en_obra',         nombre:'En obra / Construcción', grupo:'riesgo',     icono:'🏗️' },
      { sub:'baldio',          nombre:'Lote sin desarrollar', grupo:'riesgo',       icono:'🚧' },
      // Un local desocupado no es comercio: es la señal de que la cuadra no
      // está reteniendo negocios. Contarlo como comercio inflaba la oferta.
      { sub:'local_vacio',     nombre:'Local desocupado',     grupo:'riesgo',       icono:'🔒' },
      // Distinto de un lote vacío: aquí hubo algo y se cayó. Es la señal más
      // dura de deterioro de una cuadra, y pesa en la lectura de riesgo.
      { sub:'ruina',           nombre:'Edificación en ruina', grupo:'riesgo',       icono:'🏚️' },
      // En Colombia muchos mapeadores escriben el uso real en español dentro de
      // building=* (ej. building=taller_mecanico, building=charcuteria_mechis).
      // Se reconocen por palabra clave para no perderlos como "sin definir".
      { sub:'comercio_local',  nombre:'Comercio / Servicio local', grupo:'comercio', icono:'🏪' },
      { sub:'ocio_generico',   nombre:'Ocio / Recreación',    grupo:'vivienda',     icono:'🎡' },
      // Mixtos y oficinas (van casi al final: office=* es comodín).
      // building con ";" o "," es multi-uso declarado (ej. residential;commercial).
      { sub:'mixto',           nombre:'Uso mixto',            grupo:'mixtos',       icono:'🧩' },
      { sub:'oficina',         nombre:'Oficina',              grupo:'mixtos',       icono:'💼' },
      // Comodines finales: comercio declarado por edificio/suelo aunque no
      // tenga tag de negocio específico, y cualquier shop con valor.
      { sub:'local_comercial', nombre:'Local comercial',      grupo:'comercio',     icono:'🏬' },
      { sub:'comercio_otro',   nombre:'Comercio general',     grupo:'comercio',     icono:'🛍️' },
      // Último recurso, DESPUÉS del comodín de comercio: una cancha o un club
      // que solo trae `sport=*` es un escenario deportivo, pero un almacén de
      // deportes trae `shop=sports` + `sport=soccer` y debe quedar en comercio.
      // Por eso esta regla va de última: deja que la etiqueta de negocio mande.
      { sub:'deportivo',       nombre:'Escenario deportivo',  grupo:'vivienda',     icono:'⚽' },
    ];


  // ── Catálogo de usos del constructor ────────────────────────────────────
  // Los 27 usos que la pantalla ofrece para armar un proyecto, con lo que
  // hace falta para pintarlos y para saber si hay que pedirle una cantidad
  // al usuario (`contable`, `generico`, `unidad`).
  //
  // Lo que NO está acá: `subs`, `competidores`, `complementarios` y
  // `familia`. Esos cuatro campos son las reglas de puntaje —dicen contra
  // qué compite cada uso y qué lo acompaña— y viven en el servidor. El
  // navegador manda el id; el servidor resuelve el resto contra su propia
  // tabla y no acepta lo que el cliente le diga al respecto.
  const USOS_PROGRAMA = [
    { id:'vivienda', nombre:'Vivienda', icono:'🏠', contable:true, unidad:'viviendas' },
    { id:'comercio', nombre:'Comercio', icono:'🛍️', contable:true, unidad:'locales comerciales' },
    { id:'oficinas', nombre:'Oficinas', icono:'💼', contable:true, unidad:'oficinas' },
    { id:'hotel', nombre:'Hotel', icono:'🏨', contable:true, unidad:'habitaciones' },
    { id:'consultorios', nombre:'Consultorios', icono:'🩺', contable:true, unidad:'consultorios' },
    { id:'coworking', nombre:'Coworking', icono:'🧑‍💻' },
    { id:'educacion', nombre:'Educación', icono:'🎓' },
    { id:'salud', nombre:'Salud', icono:'🚑' },
    { id:'turismo', nombre:'Turismo', icono:'🧳' },
    { id:'servicios', nombre:'Servicios', icono:'🚛' },
    { id:'bar', nombre:'Bar', icono:'🍻' },
    { id:'cafeteria', nombre:'Cafetería', icono:'☕' },
    { id:'restaurante', nombre:'Restaurante', icono:'🍽️' },
    { id:'espacio_publico', nombre:'Espacio Público', icono:'🌳' },
    { id:'supermercado', nombre:'Supermercado', icono:'🛒' },
    { id:'gimnasio', nombre:'Gimnasio / Deportivo', icono:'🏋️' },
    { id:'parqueadero', nombre:'Parqueadero', icono:'🅿️', contable:true, unidad:'cupos de parqueo' },
    { id:'cajero', nombre:'Cajero bancario', icono:'🏧', contable:true, unidad:'cajeros' },
    { id:'industria', nombre:'Industria / Bodega', icono:'🏭' },
    { id:'cultural', nombre:'Cultural', icono:'🎭' },
    { id:'cuidado', nombre:'Centro de Cuidado', icono:'🧓' },
    { id:'religioso', nombre:'Religioso / Culto', icono:'⛪' },
    { id:'gubernamental', nombre:'Gubernamental', icono:'🏛️' },
    { id:'militar', nombre:'Militar / Policial', icono:'🚓' },
    { id:'judicial', nombre:'Judicial', icono:'⚖️' },
    { id:'comercial_indefinido', nombre:'Comercial (por definir)', icono:'🔍🛍️', generico:true },
    { id:'oficina_indefinida', nombre:'Oficina (por definir)', icono:'🔍💼', generico:true }
  ];

  window.AIA_CATALOGO = { TAXONOMIA, GRUPOS, GRUPO_COLOR, USOS_PROGRAMA };
})();
