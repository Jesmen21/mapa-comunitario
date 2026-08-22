/* URBIS · Análisis de Implantación IA — MOTOR (js/60)
   Motor heurístico puro: clasifica POIs de OpenStreetMap según la Matriz de
   Usos de URBIS, calcula estadísticas del entorno y genera FODA, viabilidad
   y ranking de usos recomendados. Sin DOM y sin fetch: todas las funciones
   son puras y se pueden probar desde la consola.
   El proveedor de análisis es intercambiable (setProveedor) para poder
   enchufar Claude API en el futuro sin tocar la UI. */
(function(){
  'use strict';

  // ── Grupos de la Matriz de Usos ─────────────────────────────────────────
  // Copia local sincronizada con MATRIZ_GRUPOS / MATRIZ_GRUPO_COLOR de
  // js/20-mobile-functional-app.js. Es copia (no import) porque este módulo
  // vive en su propia página y no puede depender del scope del SPA.
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

  // ── Taxonomía OSM → subcategoría → grupo ────────────────────────────────
  // Primera regla que calza gana (el orden importa: lo específico primero).
  // m = { tagOSM: regex sobre el valor }.
  const TAXONOMIA = [
    // Salud
    { sub:'drogueria',       nombre:'Droguería',            grupo:'salud',        icono:'💊', m:{ amenity:/^pharmacy$/, shop:/^chemist$/, healthcare:/^pharmacy$/ } },
    { sub:'laboratorio',     nombre:'Laboratorio',          grupo:'salud',        icono:'🧪', m:{ healthcare:/^(laboratory|blood_donation)$/ } },
    { sub:'salud_ips',       nombre:'IPS / Clínica',        grupo:'salud',        icono:'🏥', m:{ amenity:/^(hospital|clinic|doctors|dentist)$/, healthcare:/^(hospital|clinic|doctor|dentist|centre|midwife|physiotherapist)$/, building:/^(hospital|clinic)$/ } },
    { sub:'veterinaria',     nombre:'Veterinaria',          grupo:'salud',        icono:'🐾', m:{ amenity:/^veterinary$/, shop:/^pet$/ } },
    { sub:'bomberos',        nombre:'Bomberos / Rescate',   grupo:'salud',        icono:'🚒', m:{ amenity:/^(fire_station|ambulance_station)$/ } },
    // Comodín de salud: terapias, especialidades y healthcare=yes (antes
    // caían en "sin definir": Therapy for Kids, Consultorio de la Piel...).
    { sub:'salud_otro',      nombre:'Servicio de salud',    grupo:'salud',        icono:'🩺', m:{ healthcare:/.+/ } },
    // Comercio
    // Tiendas de descuento (D1, Ara, Justo & Bueno): en OSM suelen venir
    // etiquetadas como shop=supermarket igual que cualquier supermercado, así
    // que sin mirar la marca se perdían en la misma categoría. Va ANTES de
    // 'supermercado' a propósito: si además trae shop=supermarket, esta regla
    // debe ganar. Pedido explícito: que queden aparte porque para un
    // constructor/inmobiliaria son una señal de mercado distinta a un
    // supermercado grande (Éxito, Metro, Merkarico).
    { sub:'tienda_descuento',nombre:'Tienda de descuento',  grupo:'comercio',     icono:'🏷️', m:{ brand:/^(d1|ara|justo\s*&?\s*y?\s*bueno)$/, name:/^(d1|ara|justo\s*&?\s*y?\s*bueno)(\s|$)/ } },
    { sub:'supermercado',    nombre:'Supermercado',         grupo:'comercio',     icono:'🛒', m:{ shop:/^(supermarket|wholesale)$/ } },
    { sub:'centro_comercial',nombre:'Centro comercial',     grupo:'comercio',     icono:'🏬', m:{ shop:/^(mall|department_store)$/ } },
    { sub:'tienda_barrio',   nombre:'Tienda de barrio',     grupo:'comercio',     icono:'🏪', m:{ shop:/^(convenience|kiosk|general|greengrocer|butcher|dairy)$/ } },
    { sub:'panaderia',       nombre:'Panadería',            grupo:'comercio',     icono:'🥖', m:{ shop:/^(bakery|pastry|confectionery)$/, building:/^bakehouse$/ } },
    { sub:'banco',           nombre:'Banco / Cajero',       grupo:'comercio',     icono:'🏦', m:{ amenity:/^(bank|atm|bureau_de_change|money_transfer)$/ } },
    // Muy común en Colombia: corresponsales bancarios y puntos de pago
    // (Efecty, SuperGiros) y cafés internet.
    { sub:'pagos',           nombre:'Corresponsal / Pagos', grupo:'comercio',     icono:'💳', m:{ amenity:/^(payment_centre|payment_terminal)$/ } },
    { sub:'internet_cafe',   nombre:'Café internet',        grupo:'comercio',     icono:'🖥️', m:{ amenity:/^internet_cafe$/ } },
    { sub:'hotel',           nombre:'Hotel / Hospedaje',    grupo:'comercio',     icono:'🏨', m:{ tourism:/^(hotel|hostel|guest_house|motel|apartment)$/, building:/^hotel$/ } },
    { sub:'camping',         nombre:'Camping / zona de acampada', grupo:'comercio', icono:'⛺', m:{ tourism:/^(camp_site|caravan_site)$/ } },
    { sub:'salon_eventos',   nombre:'Salón de eventos',     grupo:'comercio',     icono:'🎪', m:{ amenity:/^events_venue$/ } },
    { sub:'gasolinera',      nombre:'Estación de servicio', grupo:'comercio',     icono:'⛽', m:{ amenity:/^(fuel|charging_station)$/ } },
    { sub:'restaurante',     nombre:'Restaurante',          grupo:'comercio',     icono:'🍽️', m:{ amenity:/^(restaurant|fast_food|food_court|ice_cream)$/ } },
    { sub:'cafeteria',       nombre:'Cafetería',            grupo:'comercio',     icono:'☕', m:{ amenity:/^cafe$/, shop:/^(coffee|tea)$/ } },
    // Vivienda y ocio
    { sub:'bar_ocio',        nombre:'Bar / Ocio nocturno',  grupo:'vivienda',     icono:'🍻', m:{ amenity:/^(bar|pub|nightclub|casino)$/, leisure:/^amusement_arcade$/ } },
    // Reportado: un gimnasio nuevo no aparecía en el análisis. Solo se
    // reconocían dos etiquetas, y en la práctica se mapean de varias formas:
    // amenity=gym es la vieja (obsoleta pero muy usada) y el deporte concreto
    // —crossfit, halterofilia— suele venir en `sport` sin ningún `leisure`.
    { sub:'gimnasio',        nombre:'Gimnasio',             grupo:'vivienda',     icono:'🏋️', m:{ leisure:/^(fitness_centre|fitness_station)$/, sport:/^(fitness|gym|crossfit|weightlifting|bodybuilding)$/, amenity:/^gym$/ } },
    { sub:'deportivo',       nombre:'Escenario deportivo',  grupo:'vivienda',     icono:'⚽', m:{ leisure:/^(pitch|sports_centre|stadium|swimming_pool|track)$/ } },
    { sub:'parque',          nombre:'Parque / Zona verde',  grupo:'vivienda',     icono:'🌳', m:{ leisure:/^(park|garden|playground|dog_park)$/, landuse:/^(recreation_ground|village_green|grass)$/ } },
    { sub:'residencial',     nombre:'Vivienda',             grupo:'vivienda',     icono:'🏠', m:{ building:/^(residential|house|apartments|detached|terrace|semidetached_house|hut|bungalow|cabin)$/, landuse:/^residential$/ } },
    // Poblados donde vive gente pero que no se mapean como barrio: asentamientos
    // informales, resguardos y comunidades indígenas. Se mapean con etiquetas
    // prestadas —muchas veces `tourism=camp_site`— porque no hay una mejor.
    { sub:'asentamiento',    nombre:'Asentamiento / poblado', grupo:'vivienda',   icono:'🏕️', m:{ place:/^(hamlet|isolated_dwelling|village|neighbourhood|quarter)$/, landuse:/^(squatter|informal_settlement)$/ } },
    // Va ANTES de educación a propósito: el ICBF opera jardines infantiles,
    // pero es una entidad de bienestar del Estado (pedido explícito).
    { sub:'bienestar_social', nombre:'Bienestar social del Estado', grupo:'institucional', icono:'🏛️', m:{ operator:/^icbf$/, amenity:/^social_facility$/ } },
    // `building=multiusos` no es una etiqueta estándar de OpenStreetMap: la
    // escriben los mapeadores locales para el salón multiusos del barrio, que
    // en Colombia es equipamiento de la Junta de Acción Comunal.
    { sub:'salon_comunal',   nombre:'Salón comunal / multiusos', grupo:'institucional', icono:'🏘️', m:{ building:/^(multiusos|multiuso|salon_comunal)$/ } },
    // Cultura, educación y culto
    { sub:'colegio',         nombre:'Colegio / Jardín',     grupo:'cultura',      icono:'🏫', m:{ amenity:/^(school|kindergarten|childcare)$/, building:/^(school|kindergarten)$/ } },
    // capacitacion va ANTES de universidad a propósito: una autoescuela o un
    // instituto de idiomas suele traer TAMBIÉN office=educational_institution,
    // y caía en 'universidad'. Eso hacía que el informe citara "Academia
    // Automóvil Cúcuta" como equipamiento ancla de educación superior.
    // office=educational_institution es una señal DÉBIL: la usan por igual una
    // universidad y una autoescuela. Una universidad de verdad trae
    // amenity=university, así que esta etiqueta se trata como formación y no
    // como educación superior — antes hacía que el informe citara "Academia
    // Automóvil Cúcuta" entre los equipamientos ancla del sector.
    { sub:'capacitacion',    nombre:'Centro de formación',  grupo:'cultura',      icono:'📚', m:{ amenity:/^(training|language_school|music_school|driving_school|prep_school|dancing_school)$/, education:/.+/, office:/^educational_institution$/ } },
    { sub:'universidad',     nombre:'Universidad / Instituto', grupo:'cultura',   icono:'🎓', m:{ amenity:/^(university|college)$/, building:/^(university|college)$/ } },
    { sub:'iglesia',         nombre:'Iglesia / Culto',      grupo:'cultura',      icono:'⛪', m:{ amenity:/^place_of_worship$/, building:/^(church|chapel|mosque|cathedral)$/, landuse:/^religious$/, religion:/.+/ } },
    { sub:'cultural',        nombre:'Equipamiento cultural',grupo:'cultura',      icono:'🎭', m:{ amenity:/^(theatre|cinema|library|arts_centre|community_centre|studio)$/, tourism:/^(museum|gallery|attraction|artwork)$/ } },
    // Institucional
    // amenity=servicio_de_seguridad del estado: variante no estándar que
    // aparece en CAI de Cúcuta (ej. "Cai Parque Colón") — mismo concepto que
    // amenity=police, solo con otra etiqueta.
    { sub:'policia',         nombre:'Policía / CAI',        grupo:'institucional',icono:'🚓', m:{ amenity:/^(police|servicio_de_seguridad del estado)$/ } },
    { sub:'gobierno',        nombre:'Entidad pública',      grupo:'institucional',icono:'🏛️', m:{ amenity:/^(townhall|courthouse|post_office|prison|social_facility)$/, office:/^(government|administrative)$/, building:/^(public|civic|government)$/, landuse:/^military$/ } },
    { sub:'notaria',         nombre:'Notaría / Jurídico',   grupo:'institucional',icono:'⚖️', m:{ office:/^(notary|lawyer)$/, amenity:/^notary$/ } },
    // Servicios e infraestructura (vias/ciclorrutas van a stats.movilidad, no a POIs)
    { sub:'via_arteria',     nombre:'Vía arteria',          grupo:'servicios',    icono:'🛣️', m:{ highway:/^(trunk|primary|secondary|tertiary)$/ } },
    { sub:'ciclorruta',      nombre:'Ciclorruta',           grupo:'servicios',    icono:'🚴', m:{ highway:/^cycleway$/ } },
    // Estación de bicicleta pública. No es lo mismo que un cicloparqueadero
    // (`bicycle_parking`, en Transporte): allí la gente deja su bici, aquí la
    // toma y la devuelve, así que genera viajes a pie de ida y de vuelta.
    { sub:'bici_publica',    nombre:'Bicicleta pública',    grupo:'servicios',    icono:'🚲', m:{ amenity:/^bicycle_rental$/ } },
    { sub:'parada_bus',      nombre:'Parada de transporte', grupo:'servicios',    icono:'🚌', m:{ highway:/^bus_stop$/, amenity:/^bus_station$/, public_transport:/^(platform|stop_position|station)$/ } },
    // car_pooling: en la práctica en Cúcuta aparece mapeado como "Parqueadero"
    // por el nombre que le puso quien lo mapeó, aunque la etiqueta técnica de
    // OSM sea para compartir carro, no para dejar el carro.
    { sub:'transporte',      nombre:'Transporte / Parqueo', grupo:'servicios',    icono:'🅿️', m:{ amenity:/^(taxi|parking|car_rental|car_pooling|bicycle_parking|motorcycle_parking|parking_space)$/ } },
    { sub:'infra_servicios', nombre:'Infraestructura',      grupo:'servicios',    icono:'🗼', m:{ man_made:/^(mast|tower|water_tower|works)$/, power:/^substation$/, amenity:/^(recycling|waste_transfer_station|waste_disposal)$/, landuse:/^landfill$/ } },
    // Servientrega / Inter Rapidísimo y demás puntos de envío.
    { sub:'mensajeria',      nombre:'Mensajería / Correo',  grupo:'servicios',    icono:'📮', m:{ amenity:/^(post_box|parcel_locker|post_depot)$/ } },
    { sub:'mobiliario',      nombre:'Mobiliario urbano',    grupo:'servicios',    icono:'🪑', m:{ amenity:/^(bench|drinking_water|shelter|toilets|waste_basket|fountain|clock|vending_machine|parking_entrance)$/, tourism:/^information$/ } },
    { sub:'edificacion_menor', nombre:'Edificación de servicio', grupo:'servicios', icono:'🧱', m:{ building:/^(garage|garages|service|shed|roof|carport)$/ } },
    { sub:'funerario',       nombre:'Servicio funerario',   grupo:'servicios',    icono:'🕊️', m:{ shop:/^funeral_directors$/, amenity:/^(grave_yard|crematorium)$/, landuse:/^cemetery$/ } },
    // Industria
    { sub:'industria',       nombre:'Industria',            grupo:'industria',    icono:'🏭', m:{ landuse:/^industrial$/, building:/^industrial$/ } },
    { sub:'bodega',          nombre:'Bodega / Logística',   grupo:'industria',    icono:'📦', m:{ building:/^warehouse$|bodega|dep[oó]sito|almac[eé]n/, landuse:/^depot$/ } },
    // Ambiente
    { sub:'agua',            nombre:'Cuerpo de agua',       grupo:'ambiente',     icono:'💧', m:{ natural:/^(water|wetland)$/, waterway:/^(river|stream|canal)$/ } },
    { sub:'verde_natural',   nombre:'Verde natural',        grupo:'ambiente',     icono:'🌿', m:{ natural:/^(wood|scrub|grassland|tree_row)$/, landuse:/^(forest|meadow|farmland|orchard|allotments)$/ } },
    // Riesgo / transición
    // Separados a propósito: una obra en curso indica TRANSFORMACIÓN del
    // sector, mientras un lote sin desarrollar indica EXPANSIÓN. Son señales
    // distintas para un inversionista. `baldio_obra` se conserva como suma
    // de ambos para no romper las reglas que ya lo usaban.
    { sub:'en_obra',         nombre:'En obra / Construcción', grupo:'riesgo',     icono:'🏗️', m:{ landuse:/^construction$/, building:/^construction$/ } },
    { sub:'baldio',          nombre:'Lote sin desarrollar', grupo:'riesgo',       icono:'🚧', m:{ landuse:/^(brownfield|greenfield)$/ } },
    // En Colombia muchos mapeadores escriben el uso real en español dentro de
    // building=* (ej. building=taller_mecanico, building=charcuteria_mechis).
    // Se reconocen por palabra clave para no perderlos como "sin definir".
    { sub:'comercio_local',  nombre:'Comercio / Servicio local', grupo:'comercio', icono:'🏪', m:{ building:/taller|lavadero|charcuter|tienda|panader|restaurante|cafeter|helader|licor|papeler|ferreter|peluquer|barber|farmacia|droguer|supermercado|miscelanea|variedades|comercio|local/ } },
    { sub:'ocio_generico',   nombre:'Ocio / Recreación',    grupo:'vivienda',     icono:'🎡', m:{ leisure:/.+/ } },
    // Mixtos y oficinas (van casi al final: office=* es comodín).
    // building con ";" o "," es multi-uso declarado (ej. residential;commercial).
    { sub:'mixto',           nombre:'Uso mixto',            grupo:'mixtos',       icono:'🧩', m:{ building:/^mixed$|[;,]/ } },
    { sub:'oficina',         nombre:'Oficina',              grupo:'mixtos',       icono:'💼', m:{ office:/.+/, building:/^office$/ } },
    // Comodines finales: comercio declarado por edificio/suelo aunque no
    // tenga tag de negocio específico, y cualquier shop con valor.
    { sub:'local_comercial', nombre:'Local comercial',      grupo:'comercio',     icono:'🏬', m:{ building:/^(commercial|retail|kiosk|shop)$/, landuse:/^(commercial|retail)$/, amenity:/^(car_wash|marketplace)$/ } },
    { sub:'comercio_otro',   nombre:'Comercio general',     grupo:'comercio',     icono:'🛍️', m:{ shop:/.+/ } }
  ];

  // ── Reglas de clasificación personalizadas (persistentes, sin deploy) ───
  // Pedido explícito: cuando el usuario nombra un "uso sin definir" desde el
  // celular (ej. "ICBF" → Institucional), la regla se guarda en localStorage
  // y desde entonces cualquier punto con ese mismo nombre se clasifica
  // automáticamente, sin tocar código ni esperar una actualización.
  const REGLAS_PERSONALIZADAS_KEY = 'aia_reglas_nombre_v1';
  function normalizarNombrePOI(nombre){
    return String(nombre || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  }
  function leerReglasPersonalizadas(){
    try { return JSON.parse(localStorage.getItem(REGLAS_PERSONALIZADAS_KEY) || '{}'); }
    catch(e) { return {}; }
  }
  function guardarReglaPersonalizada(nombrePOI, grupoId){
    try {
      const reglas = leerReglasPersonalizadas();
      reglas[normalizarNombrePOI(nombrePOI)] = grupoId;
      localStorage.setItem(REGLAS_PERSONALIZADAS_KEY, JSON.stringify(reglas));
    } catch(e) {}
  }

  // ── Bandeja de usos sin categoría ───────────────────────────────────────
  // Cada análisis deja usos que no calzan con ninguna regla de la taxonomía.
  // Antes había que ir a buscarlos a mano en el informe; ahora el módulo los
  // acumula solo, agrupados por su PATRÓN DE ETIQUETAS (no por nombre): así
  // se ve de una si "eso que no clasifica" son 40 casos del mismo tipo —que
  // merecen una regla nueva— o 40 rarezas distintas.
  const PENDIENTES_KEY = 'aia_usos_sin_categoria_v1';
  const MAX_PENDIENTES = 400;
  // Etiquetas que no dicen nada del USO (son metadatos o dirección).
  const TAGS_IRRELEVANTES = /^(name|name:|addr:|source|check_date|wikidata|wikipedia|note|fixme|created_by|ref|phone|website|opening_hours|operator:|contact:|survey:date|image|description)/;

  function tagsUtiles(tags){
    return Object.keys(tags || {})
      .filter(k => !TAGS_IRRELEVANTES.test(k))
      .sort()
      .map(k => k + '=' + tags[k]);
  }

  function leerPendientes(){
    try { const o = JSON.parse(localStorage.getItem(PENDIENTES_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; }
    catch(e) { return {}; }
  }
  function escribirPendientes(o){
    try { localStorage.setItem(PENDIENTES_KEY, JSON.stringify(o)); } catch(e) {}
  }

  // Se llama una vez por análisis, con los POIs que quedaron en grupo 'otro'.
  function registrarPendientes(pois, meta){
    const store = leerPendientes();
    const ahora = new Date().toISOString();
    let nuevos = 0;
    (pois || []).forEach(p => {
      if (!p || p.grupo !== 'otro') return;
      const pares = tagsUtiles(p.tags);
      if (!pares.length) return;                 // sin etiquetas no hay nada que clasificar
      const firma = pares.join(' · ');
      let e = store[firma];
      if (!e) {
        if (Object.keys(store).length >= MAX_PENDIENTES) return;
        e = store[firma] = { firma, tags: pares, ejemplos: [], veces: 0,
                             visto: ahora, estado: 'pendiente' };
        nuevos++;
      }
      if (e.estado === 'descartado') return;     // ya se decidió que no aplica
      e.veces++;
      e.ultimaVez = ahora;
      if (meta && meta.zona && e.zona !== meta.zona) e.zona = meta.zona;
      const nom = normalizarNombre(p.nombre);
      if (nom && nom !== 'Otro (uso por definir)' && e.ejemplos.length < 5 && e.ejemplos.indexOf(nom) === -1) {
        e.ejemplos.push(nom);
      }
    });
    escribirPendientes(store);
    return { nuevos, total: Object.keys(store).filter(k => store[k].estado === 'pendiente').length };
  }

  // Texto plano listo para pegar en el chat y decidir la categoría de cada
  // patrón. Se ordena por frecuencia: lo que más se repite es lo que más
  // rinde clasificar.
  function exportarPendientes(){
    const store = leerPendientes();
    const lista = Object.keys(store).map(k => store[k])
      .filter(e => e.estado === 'pendiente')
      .sort((a, b) => b.veces - a.veces);
    if (!lista.length) return 'No hay usos sin categoría acumulados.';
    const cab = 'USOS SIN CATEGORÍA ACUMULADOS POR URBIS · ' + lista.length + ' patrones distintos\n' +
      'Categorías disponibles: ' + Object.keys(GRUPOS).filter(g => g !== 'otro').join(', ') + '\n' +
      'Para cada patrón: ¿a qué categoría pertenece? Si no encaja en ninguna, dilo y creamos una nueva.\n' +
      '─'.repeat(60) + '\n';
    return cab + lista.map((e, i) =>
      (i + 1) + '. [' + e.veces + ' ' + plural(e.veces, 'vez', 'veces') + '] ' + e.firma +
      (e.ejemplos.length ? '\n   Ejemplos: ' + e.ejemplos.join(' · ') : '\n   (sin nombre propio)') +
      (e.zona ? '\n   Visto en: ' + e.zona : '')
    ).join('\n');
  }

  function resumenPendientes(){
    const store = leerPendientes();
    const claves = Object.keys(store);
    const pend = claves.filter(k => store[k].estado === 'pendiente');
    return {
      patrones: pend.length,
      apariciones: pend.reduce((a, k) => a + (store[k].veces || 0), 0),
      resueltos: claves.filter(k => store[k].estado === 'resuelto').length
    };
  }

  // Marca un patrón como resuelto y crea la regla para que la próxima vez
  // clasifique solo. `grupoId` debe existir en GRUPOS.
  function resolverPendiente(firma, grupoId, nombreUso){
    const store = leerPendientes();
    const e = store[firma];
    if (!e || !GRUPOS[grupoId]) return false;
    e.estado = 'resuelto'; e.grupo = grupoId; e.nombreUso = nombreUso || '';
    escribirPendientes(store);
    // Las reglas personalizadas trabajan por nombre propio, así que se
    // registran los ejemplos conocidos de ese patrón.
    (e.ejemplos || []).forEach(n => guardarReglaPersonalizada(n, grupoId));
    return true;
  }
  function descartarPendiente(firma){
    const store = leerPendientes();
    if (!store[firma]) return false;
    store[firma].estado = 'descartado';
    escribirPendientes(store);
    return true;
  }
  function olvidarPendientes(){ escribirPendientes({}); }

  // ── Reconocimiento por MARCA ────────────────────────────────────────────
  //
  // Reportado: "hay un Smart Fit y no sale", "hay varias marcas como Cruz
  // Verde y tampoco". La causa de fondo es que el mapa colaborativo del que
  // sale el entorno no siempre trae la etiqueta correcta: muchos locales
  // llegan con el nombre puesto pero con `shop=yes` o sin categoría útil, y
  // ahí caían en "otro" y desaparecían del análisis.
  //
  // El nombre, en cambio, casi siempre está. Una cadena reconocible dice qué
  // es sin necesidad de etiqueta: si se llama Cruz Verde es una droguería,
  // aunque nadie haya puesto amenity=pharmacy. Esto NO inventa locales que no
  // existan en el mapa —eso es imposible—, pero rescata los que sí están y se
  // estaban perdiendo por venir mal clasificados.
  const MARCAS = [
    { sub:'gimnasio',        re:/\b(smart\s*fit|smartfit|bodytech|spinning\s*center|hard\s*body|crossfit|gold'?s\s*gym|fitness\s*24)\b/ },
    { sub:'drogueria',       re:/\b(cruz\s*verde|la\s*rebaja|farmatodo|drogas?\s*la\s*econom|copservir|audifarma|locatel|farmacia\s*pasteur|drogueria)\b/ },
    { sub:'cafeteria',       re:/\b(tosta[o0]|juan\s*valdez|starbucks|oma\b|dunkin|cafe\s*quindio)\b/ },
    // El formato de descuento tiene sub propio: no es lo mismo un D1 de
    // esquina que un Éxito con parqueadero, ni para el flujo ni para el FODA.
    { sub:'tienda_descuento',re:/\b(d1\b|ara\b|justo\s*&?\s*bueno|dollarcity|surtimax)\b/ },
    { sub:'supermercado',    re:/\b(exito|olimpica|jumbo|metro\b|carulla|makro|pricesmart|consumo|la\s*14)\b/ },
    { sub:'banco',           re:/\b(bancolombia|davivienda|banco\s*de\s*bogota|bbva|banco\s*popular|colpatria|scotiabank|av\s*villas|bancoomeva|banagrario|banco\s*agrario|efecty|baloto)\b/ },
    { sub:'restaurante',     re:/\b(mcdonald|burger\s*king|kfc|frisby|el\s*corral|presto|dominos|papa\s*john|subway|sandwich\s*qbano|archies)\b/ },
    { sub:'gasolinera',      re:/\b(terpel|biomax|texaco|mobil|esso|primax|petrobras|zeuss)\b/ },
    { sub:'centro_comercial',re:/\b(centro\s*comercial|c\.?c\.?\s|unicentro|ventura|jardin\s*plaza|mayorca|viva\b|plaza\s*del\s*este)\b/ },
    { sub:'hotel',           re:/\b(hotel|hostal|hospedaje|aparta\s*hotel|holiday\s*inn|ibis\b)\b/ },
    { sub:'universidad',     re:/\b(universidad|unipamplona|ufps|udes|uniminuto|politecnico|sena\b|instituto\s*tecnico)\b/ },
    { sub:'colegio',         re:/\b(colegio|liceo|gimnasio\s+(campestre|moderno)|institucion\s*educativa|jardin\s*infantil)\b/ },
    { sub:'salud_ips',       re:/\b(clinica|hospital|ips\b|eps\b|centro\s*medico|sanitas|sura\b|compensar)\b/ },
    { sub:'panaderia',       re:/\b(panaderia|pasteleria|reposteria|kokoriko|bimbo)\b/ }
  ];

  function marcaDe(nombre){
    const n = normalizarNombrePOI(nombre);
    if (!n) return null;
    for (let i = 0; i < MARCAS.length; i++) {
      if (MARCAS[i].re.test(n)) {
        const r = TAXONOMIA.find(t => t.sub === MARCAS[i].sub);
        if (r) return { sub: r.sub, nombre: r.nombre, grupo: r.grupo, icono: r.icono, porMarca: true };
      }
    }
    return null;
  }

  // Categorías "cajón de sastre": un local con shop=yes cae aquí y la etiqueta
  // no dice nada útil. En estos casos el NOMBRE sabe más que la etiqueta, y por
  // eso la marca puede ganarle. Con una etiqueta específica (amenity=pharmacy)
  // no se discute: manda la etiqueta.
  const GENERICAS = ['comercio_otro', 'local_comercial', 'otro', 'edificio_otro'];

  function subDeTaxonomia(sub, extra){
    const r = TAXONOMIA.find(t => t.sub === sub);
    if (!r) return null;
    const o = { sub: r.sub, nombre: r.nombre, grupo: r.grupo, icono: r.icono };
    if (extra) for (const k in extra) o[k] = extra[k];
    return o;
  }

  // ── Reglas compuestas ───────────────────────────────────────────────────
  //
  // La taxonomía mira UNA etiqueta a la vez, y eso falla cuando la etiqueta
  // suelta miente. El caso que lo destapó: un asentamiento indígena mapeado
  // como `tourism=camp_site` porque en OpenStreetMap no hay una etiqueta mejor
  // para un poblado. Leída sola, esa etiqueta dice "camping"; leída junto a
  // `population=300` dice claramente que ahí VIVE gente.
  //
  // Estas reglas se evalúan ANTES que la taxonomía y miran el conjunto.
  const REGLAS_COMPUESTAS = [
    {
      // Un camping no tiene censo. Si trae población, es un poblado.
      porque: 'camp_site con población es un poblado, no un camping',
      cuando: t => /^(camp_site|caravan_site)$/.test(String(t.tourism || '')) &&
                   (parseInt(t.population, 10) > 0 ||
                    /asentamiento|resguardo|comunidad|cabildo|ind[ií]gena|vereda|caser[ií]o/i.test(t.name || '')),
      sub: 'asentamiento'
    }
  ];

  // ── El nombre por encima de la etiqueta de construcción ─────────────────
  //
  // `building=*` describe CÓMO está construido el inmueble, no para qué se usa.
  // Un "Comercial La Ceiba" mapeado como `building=cabin` no es una cabaña, y
  // una "Distribuidora … SAS" en un `building=bakehouse` no es una panadería:
  // son el local y la bodega que alguien montó en esa construcción. Cuando lo
  // único que emparejó fue una etiqueta de construcción, el nombre manda.
  const NOMBRE_USO = [
    { sub:'bodega',        re:/\b(distribuidora|distribuciones|dep[oó]sito|bodega|log[ií]stica|mayorista)\b/ },
    { sub:'cultural',      re:/\b(centro\s*cultural|casa\s*de\s*la\s*cultura|biblioteca|teatro|museo|ludoteca)\b/ },
    { sub:'salon_comunal', re:/\b(sal[oó]n\s*comunal|junta\s*de\s*acci[oó]n\s*comunal|jac\b|caseta\s*comunal)\b/ },
    { sub:'asentamiento',  re:/\b(asentamiento|resguardo|cabildo|comunidad\s*ind[ií]gena)\b/ },
    { sub:'comercio_local',re:/\b(comercial|almac[eé]n|ferreter[ií]a|surtido|variedades|mini\s*mercado)\b/ }
  ];

  function usoPorNombre(nombre){
    const n = normalizarNombrePOI(nombre);
    if (!n) return null;
    for (let i = 0; i < NOMBRE_USO.length; i++) {
      if (NOMBRE_USO[i].re.test(n)) return subDeTaxonomia(NOMBRE_USO[i].sub, { porNombre: true });
    }
    return null;
  }

  // Etiquetas que describen la construcción, no el uso. Solo sobre estas puede
  // ganar el nombre; frente a un `amenity=pharmacy` no se discute.
  const CLAVES_ESTRUCTURALES = ['building', 'building:levels', 'height'];
  // Contenedores genéricos: dicen que pasa algo dentro, no qué pasa.
  const CONTENEDORES = ['salon_eventos', 'edificacion_menor', 'mixto'];

  // ── Dónde pararse DENTRO del radio ──────────────────────────────────────
  //
  // El análisis dice si la zona sirve; esto dice en qué parte de la zona. Un
  // radio no es homogéneo: pegado a un ancla que descarga gente a pie hay
  // mucho más tránsito de acera que 300 m más allá, dentro del mismo radio.
  //
  // Y no gana el ancla más fuerte, sino la más fuerte QUE ADEMÁS sea
  // complementaria del proyecto. La diferencia importa: junto a un D1 pasa
  // más gente, pero quien sale del gimnasio es cliente de un café —mismo
  // horario, misma necesidad—, mientras que quien sale del D1 lleva mercado y
  // va de salida. Sin proyecto definido se cae al ancla más fuerte a secas.
  const PORQUE_ANCLA = {
    gimnasio:         'entra y sale gente a pie en horario fijo, mañana y final de la tarde',
    parada_bus:       'descarga peatones de forma continua durante todo el día',
    tienda_descuento: 'concentra compra diaria a pie, con visitas cortas y repetidas',
    supermercado:     'concentra visitas frecuentes y estancias cortas',
    colegio:          'genera dos picos peatonales muy marcados al día',
    universidad:      'sostiene tránsito peatonal durante toda la jornada',
    oficina:          'sostiene demanda en horario laboral, con pausas cortas',
    centro_comercial: 'ya reúne el tránsito peatonal del sector',
    salud_ips:        'mueve pacientes y acompañantes durante todo el día',
    banco:            'genera filas y esperas en la puerta',
    iglesia:          'concentra picos peatonales muy marcados'
  };

  function fijarConsejoUbicacion(flujo, proyecto){
    const cerca = (flujo.hitos || []).filter(h => h.distM <= 300);
    if (!cerca.length) { flujo.consejoUbicacion = ''; flujo.ancla = null; return; }
    const comple = (proyecto && proyecto.complementarios) || [];
    const elegida = cerca.find(h => comple.indexOf(h.sub) !== -1) || cerca[0];
    const porQue = PORQUE_ANCLA[elegida.sub] || 'concentra tránsito peatonal en su frente';
    const esComple = comple.indexOf(elegida.sub) !== -1;
    flujo.ancla = elegida;
    flujo.consejoUbicacion = 'Dentro del radio, el mejor frente está pegado a ' +
      elegida.nombre + ' (a ' + elegida.distM + ' m): ' + porQue +
      (esComple && proyecto
        ? ', y es un uso complementario de ' + proyecto.nombre.toLowerCase() +
          ', así que ese tránsito llega con la necesidad puesta.'
        : '.') +
      ' Un local de paso capta mucho más ahí que en un punto equivalente del mismo radio.';
  }

  function clasificarPOI(tags){
    tags = tags || {};
    for (let i = 0; i < REGLAS_COMPUESTAS.length; i++) {
      const rc = REGLAS_COMPUESTAS[i];
      let aplica = false;
      try { aplica = !!rc.cuando(tags); } catch(e) { aplica = false; }
      if (aplica) { const r = subDeTaxonomia(rc.sub); if (r) return r; }
    }
    for (let i = 0; i < TAXONOMIA.length; i++) {
      const r = TAXONOMIA[i];
      for (const clave in r.m) {
        const v = tags[clave];
        if (v != null && r.m[clave].test(String(v).toLowerCase())) {
          if (GENERICAS.indexOf(r.sub) !== -1 && tags.name) {
            const porMarca = marcaDe(tags.name);
            if (porMarca) return porMarca;
          }
          // El nombre gana solo cuando la etiqueta que emparejó es estructural
          // o un contenedor genérico. Una marca conocida pesa más que un nombre
          // descriptivo, así que se prueba primero.
          const debil = CLAVES_ESTRUCTURALES.indexOf(clave) !== -1 ||
                        CONTENEDORES.indexOf(r.sub) !== -1;
          if (debil && tags.name) {
            const porMarca = marcaDe(tags.name);
            if (porMarca) return porMarca;
            const porNombre = usoPorNombre(tags.name);
            if (porNombre && porNombre.sub !== r.sub) return porNombre;
          }
          return { sub: r.sub, nombre: r.nombre, grupo: r.grupo, icono: r.icono };
        }
      }
    }
    // Antes de rendirse a "otro": ¿el nombre dice el uso? Va DESPUÉS de las
    // etiquetas a propósito — una etiqueta explícita siempre gana sobre deducir
    // por el nombre. Aquí ya no queda ninguna etiqueta que respetar.
    if (tags.name) {
      const porMarca = marcaDe(tags.name);
      if (porMarca) return porMarca;
      const porNombre = usoPorNombre(tags.name);
      if (porNombre) return porNombre;
    }
    // ¿O el usuario ya clasificó manualmente un punto con este mismo nombre?
    if (tags.name) {
      const reglas = leerReglasPersonalizadas();
      const grupoAsignado = reglas[normalizarNombrePOI(tags.name)];
      if (grupoAsignado && GRUPOS[grupoAsignado]) {
        return { sub:'personalizado', nombre: tags.name, grupo: grupoAsignado, icono: GRUPOS[grupoAsignado].i };
      }
    }
    return { sub:'otro', nombre:'Otro (uso por definir)', grupo:'otro', icono:'❓' };
  }

  function haversineM(a, b){
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*rad) * Math.cos(b.lat*rad) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  function clamp(min, max, v){ return Math.max(min, Math.min(max, v)); }
  // OpenStreetMap no impone estilo a los nombres: en el mismo informe convivían
  // "UNIVERSIDAD ANTONIO NARIÑO", "parque del ventura" y "oral x 3D". Se
  // normaliza SOLO al mostrar (el dato original no se toca): las palabras de
  // enlace van en minúscula y las siglas conocidas se respetan tal cual.
  const MINUSCULAS_NOMBRE = new Set(['de','del','la','las','el','los','y','e','a','en','por','para','con','al']);
  const SIGLAS_NOMBRE = new Set(['IPS','EPS','SENA','ICBF','CAI','SAS','ESE','UIS','UFPS','DIAN','ETB','SA','LTDA','3D','TV','ONG','POT','VIS','VIP']);
  function normalizarNombre(s){
    const txt = String(s || '').trim().replace(/\s+/g, ' ');
    if (!txt) return '';
    // Un nombre ya escrito con mayúsculas y minúsculas mezcladas suele venir
    // bien de origen ("Éxito Wow"): solo se reescribe si está todo en un caso.
    const todoMayus = txt === txt.toUpperCase(), todoMinus = txt === txt.toLowerCase();
    if (!todoMayus && !todoMinus) return txt;
    return txt.split(' ').map((w, i) => {
      const limpio = w.replace(/[^\wÁÉÍÓÚÜÑáéíóúüñ]/g, '');
      if (SIGLAS_NOMBRE.has(limpio.toUpperCase())) return w.toUpperCase();
      const bajo = w.toLowerCase();
      if (i > 0 && MINUSCULAS_NOMBRE.has(bajo)) return bajo;
      return bajo.charAt(0).toUpperCase() + bajo.slice(1);
    }).join(' ');
  }

  function nombrePOI(tags){
    return normalizarNombre((tags && (tags.name || tags['name:es'] || tags.brand || tags.operator)) || '');
  }

  // Nombres que salen de la taxonomía (no son nombres propios del lugar).
  // Sirven para saber qué puntos tienen nombre real y poder citarlos por su
  // nombre en el FODA ("Parque Colón", "Hospital Erasmo Meoz"...).
  const NOMBRES_GENERICOS = new Set(TAXONOMIA.map(t => t.nombre).concat(['Otro (uso por definir)']));
  // Nombres de relleno que a veces trae OpenStreetMap ("Lote Baldío", "nn",
  // "sin nombre"): citarlos en un informe para un cliente se vería mal. Vive
  // aquí arriba porque lo usan tanto el flujo como los nombres por categoría.
  const RUIDO_NOMBRE = /^\s*(nn+|n\/?a|s\/?n|sin\s*nombre|lote|lote\s*bald|bald[ií]o|desconocid|prueba|test|xxx)\b/i;
  function nombrePropio(n){ return !!n && !NOMBRES_GENERICOS.has(n) && !RUIDO_NOMBRE.test(n); }
  // Clave para comparar nombres ignorando mayúsculas, tildes y puntuación.
  function claveNombre(s){
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function listar(arr, max){
    // El mismo lugar suele estar mapeado dos veces en OpenStreetMap con
    // grafías distintas ("Universidad Antonio Nariño" y "Universidad Antonio
    // NAriño"), y el informe lo citaba dos veces en la misma frase. Se
    // deduplica antes de recortar, para no gastar los 3 cupos en repetidos.
    const vistos = new Set(), unicos = [];
    (arr || []).forEach(n => {
      const k = claveNombre(n);
      if (!k || vistos.has(k)) return;
      vistos.add(k); unicos.push(n);
    });
    const a = unicos.slice(0, max || 3);
    if (!a.length) return '';
    if (a.length === 1) return a[0];
    return a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1];
  }

  // ── Estadísticas del entorno ────────────────────────────────────────────
  // elementos: array crudo de Overpass (con .tags y lat/lng o .center).
  // `dane` (opcional) trae población, viviendas y estrato reales del censo.
  // Cuando llega, sustituye la estimación heurística de población; cuando no
  // (sin red, o lote fuera de cobertura), el cálculo de siempre sigue valiendo.
  function calcularStats(elementos, radioM, centro, dane){
    const areaKm2 = Math.PI * Math.pow(radioM / 1000, 2);
    const areaHa = areaKm2 * 100;

    const porGrupo = {}, porSub = {}, topPorGrupo = {};
    Object.keys(GRUPOS).forEach(g => { porGrupo[g] = 0; topPorGrupo[g] = []; });

    const pois = [];
    const movilidad = { viasArterias: [], nViasArterias: 0, paradasBus: 0, ciclorrutas: 0, scoreAcceso: 0 };

    (elementos || []).forEach(el => {
      const tags = el.tags || {};
      const lat = el.lat != null ? el.lat : (el.center && el.center.lat);
      const lng = el.lon != null ? el.lon : (el.center && el.center.lon);
      if (lat == null || lng == null) return;

      const c = clasificarPOI(tags);
      const distM = Math.round(haversineM(centro, { lat, lng }));

      // Vías y ciclorrutas alimentan movilidad, no la lista de POIs.
      if (c.sub === 'via_arteria') {
        const nombreVia = nombrePOI(tags) || ('Vía ' + (tags.highway || ''));
        // Un mismo corredor viene partido en varios tramos: se conserva el
        // tramo más cercano al lote, que es el que da la exposición real.
        const ya = movilidad.viasArterias.find(v => v.nombre === nombreVia);
        if (ya) { if (distM < ya.distM) ya.distM = distM; }
        else movilidad.viasArterias.push({ nombre: nombreVia, tipo: tags.highway || '', distM });
        return;
      }
      if (c.sub === 'ciclorruta') { movilidad.ciclorrutas++; return; }
      if (c.sub === 'parada_bus') { movilidad.paradasBus++; }
      porGrupo[c.grupo] = (porGrupo[c.grupo] || 0) + 1;
      porSub[c.sub] = (porSub[c.sub] || 0) + 1;
      const poi = { lat, lng, nombre: nombrePOI(tags) || c.nombre, sub: c.sub, grupo: c.grupo,
                    color: GRUPO_COLOR[c.grupo], icono: c.icono, distM };
      // Solo los que quedan sin clasificar guardan sus etiquetas OSM: son los
      // únicos que hay que investigar para asignarles categoría, y así no se
      // infla la memoria ni el almacenamiento con miles de puntos ya resueltos.
      if (c.grupo === 'otro') poi.tags = tags;
      pois.push(poi);
    });

    // Alias retrocompatible: varias reglas ya escritas usan baldio_obra.
    porSub.baldio_obra = (porSub.baldio || 0) + (porSub.en_obra || 0);

    movilidad.nViasArterias = movilidad.viasArterias.length;
    movilidad.scoreAcceso = Math.min(100,
      30 * Math.min(movilidad.nViasArterias, 2) +
      6 * Math.min(movilidad.paradasBus, 5) +
      10 * (movilidad.ciclorrutas > 0 ? 1 : 0));

    // ── Exposición vial ───────────────────────────────────────────────────
    // Qué tanto "se ve" el lote desde los corredores que mueven la ciudad.
    // Combina la jerarquía de la vía más importante cercana, su distancia y
    // cuántos corredores rodean el lote. OJO: OpenStreetMap NO tiene conteos
    // de tráfico ni variación por día u hora, así que esto mide exposición
    // e importancia de la malla vial, nunca flujo vehicular medido.
    const PESO_JER = { trunk: 100, primary: 85, secondary: 65, tertiary: 45 };
    const NOMBRE_JER = { trunk: 'troncal', primary: 'principal', secondary: 'secundaria', tertiary: 'colectora' };
    movilidad.viasArterias.sort((a, b) =>
      (PESO_JER[b.tipo] || 0) - (PESO_JER[a.tipo] || 0) || a.distM - b.distM);
    movilidad.viasArterias.forEach(v => { v.jerarquia = NOMBRE_JER[v.tipo] || 'vía'; });

    const principal = movilidad.viasArterias[0] || null;
    let expo = 0;
    if (principal) {
      // A 0 m conserva todo el peso de la jerarquía; a 800 m pierde la mitad.
      const factorDist = 1 / (1 + principal.distM / 800);
      expo = (PESO_JER[principal.tipo] || 40) * factorDist + Math.min(20, movilidad.nViasArterias * 4);
    }
    movilidad.viaPrincipal = principal;
    movilidad.exposicion = Math.round(clamp(0, 100, expo));
    movilidad.nivelExposicion = movilidad.exposicion >= 70 ? 'Muy alta'
      : movilidad.exposicion >= 50 ? 'Alta'
      : movilidad.exposicion >= 30 ? 'Media' : 'Baja';
    // ══ FLUJO PEATONAL Y VEHICULAR ═══════════════════════════════════════
    //
    // Lo que de verdad decide un café: cuánta gente pasa por la puerta, a pie
    // o en carro, y a qué hora. Aquí se estima el POTENCIAL de flujo a partir
    // de la estructura urbana del entorno, no un conteo: nadie está contando
    // personas en la esquina. La diferencia importa y el informe la declara.
    //
    // El razonamiento es que cada uso genera viajes a pie de forma muy
    // distinta. Una parada de transporte descarga gente que camina sí o sí; un
    // colegio concentra dos picos brutales al día; una bodega no genera casi
    // nada. Cada generador aporta según cuánto peatón produce y se descuenta
    // por distancia, porque a 600 m ya nadie va caminando por un café.
    //
    // El flujo peatonal se arma con TRES sumandos, porque un solo catálogo de
    // "generadores" no explica por qué se camina en un barrio colombiano:
    //
    //   1. ANCLAS      — usos que atraen viajes por sí mismos (una parada, un
    //                    colegio, un gimnasio de cadena, un D1).
    //   2. AGLOMERACIÓN— la continuidad comercial. Una calle con treinta
    //                    locales a pie de andén tiene peatones POR los locales,
    //                    y ese efecto de conjunto no lo captura ningún peso
    //                    individual: es la vitrina continua la que hace caminar.
    //   3. RESIDENTES  — quien vive ahí también camina a la esquina. Un barrio
    //                    denso genera sus propios viajes cortos.
    //
    // Antes solo existía el primero, y con un catálogo tan corto que en un
    // barrio real quedaban fuera las tiendas, las droguerías, las panaderías,
    // la iglesia y las viviendas: el resultado daba casi cero donde a simple
    // vista hay gente caminando.
    const GENERA_PEATON = {
      // Transporte y educación: los que más caminata producen por unidad.
      parada_bus:       { peso: 18, media: 200, franja:'todo' },
      // A una estación de bici pública se llega y se sale a pie, siempre. Pesa
      // menos que una parada de bus porque mueve menos gente, no porque genere
      // menos caminata por usuario.
      bici_publica:     { peso:  8, media: 200, franja:'todo' },
      universidad:      { peso: 20, media: 400, franja:'dia' },
      colegio:          { peso: 14, media: 300, franja:'picos' },
      capacitacion:     { peso:  7, media: 300, franja:'dia' },
      // Anclas comerciales: destino de viaje propio, con horario marcado.
      centro_comercial: { peso: 16, media: 400, franja:'tarde' },
      supermercado:     { peso: 10, media: 350, franja:'tarde' },
      // El formato de descuento (D1, Ara, Justo & Bueno) es compra diaria y a
      // pie: en el barrio colombiano genera más caminata que un supermercado
      // grande, al que se suele ir en carro una vez por semana.
      tienda_descuento: { peso:  9, media: 300, franja:'tarde' },
      // La panadería es destino diario de madrugada; la tienda de barrio, de
      // todo el día. Pesan poco de a una porque su fuerza es el conjunto, que
      // se cuenta aparte en la aglomeración.
      panaderia:        { peso:  6, media: 250, franja:'picos' },
      tienda_barrio:    { peso:  3, media: 200, franja:'todo' },
      drogueria:        { peso:  5, media: 250, franja:'todo' },
      // Servicios con fila en la calle.
      banco:            { peso:  7, media: 250, franja:'laboral' },
      pagos:            { peso:  6, media: 200, franja:'laboral' },
      gobierno:         { peso:  8, media: 300, franja:'laboral' },
      notaria:          { peso:  5, media: 250, franja:'laboral' },
      // Salud: el sub real de la taxonomía es `salud_ips` — antes decía
      // `hospital`, que no existe, y por eso nunca sumaba nada.
      salud_ips:        { peso: 10, media: 350, franja:'todo' },
      salud_otro:       { peso:  5, media: 250, franja:'laboral' },
      // Trabajo.
      oficina:          { peso:  9, media: 350, franja:'laboral' },
      // Un gimnasio de cadena es un ancla con horario fijo: descarga y recoge
      // gente en dos picos, temprano y al final de la tarde.
      gimnasio:         { peso:  9, media: 300, franja:'picos' },
      deportivo:        { peso:  6, media: 350, franja:'tarde' },
      parque:           { peso:  7, media: 350, franja:'tarde' },
      // La iglesia concentra picos fuertes y muy peatonales.
      iglesia:          { peso:  7, media: 350, franja:'picos' },
      cultural:         { peso:  5, media: 350, franja:'tarde' },
      restaurante:      { peso:  5, media: 250, franja:'mediodia' },
      cafeteria:        { peso:  4, media: 200, franja:'manana' },
      bar_ocio:         { peso:  4, media: 250, franja:'tarde' },
      hotel:            { peso:  5, media: 300, franja:'todo' }
    };

    // Comercio a pie de andén: lo que forma "calle comercial". Se cuenta como
    // conjunto, no de a uno.
    const COMERCIO_ANDEN = ['tienda_barrio', 'comercio_otro', 'comercio_local', 'local_comercial',
                            'panaderia', 'drogueria', 'restaurante', 'cafeteria', 'tienda_descuento',
                            'supermercado', 'pagos', 'internet_cafe', 'bar_ocio'];

    const flujo = { generadores: [], peatonal: 0, vehicular: 0, franjas: {} };
    const aporteFranja = { manana: 0, mediodia: 0, tarde: 0 };
    let sumaPeaton = 0;

    // Reparte un aporte entre las tres franjas del día según cómo se comporte
    // ese uso. Se usa tanto para las anclas como para los otros dos sumandos.
    function repartirFranja(f, aporte){
      if (f === 'todo')         { aporteFranja.manana += aporte;      aporteFranja.mediodia += aporte;      aporteFranja.tarde += aporte; }
      else if (f === 'dia')     { aporteFranja.manana += aporte;      aporteFranja.mediodia += aporte;      aporteFranja.tarde += aporte * .5; }
      else if (f === 'laboral') { aporteFranja.manana += aporte;      aporteFranja.mediodia += aporte * .8; aporteFranja.tarde += aporte * .3; }
      else if (f === 'picos')   { aporteFranja.manana += aporte * 1.2; aporteFranja.mediodia += aporte * .3; aporteFranja.tarde += aporte * 1.1; }
      else if (f === 'manana')  { aporteFranja.manana += aporte * 1.4; aporteFranja.mediodia += aporte * .6; aporteFranja.tarde += aporte * .4; }
      else if (f === 'mediodia'){ aporteFranja.manana += aporte * .2; aporteFranja.mediodia += aporte * 1.3; aporteFranja.tarde += aporte * .6; }
      else if (f === 'tarde')   { aporteFranja.manana += aporte * .3; aporteFranja.mediodia += aporte * .7; aporteFranja.tarde += aporte * 1.3; }
    }

    // ── 1. Anclas ────────────────────────────────────────────────────────
    Object.keys(GENERA_PEATON).forEach(function (sub) {
      const lista = pois.filter(p => p.sub === sub);
      if (!lista.length) return;
      const g = GENERA_PEATON[sub];
      let aporte = 0;
      lista.forEach(function (p) {
        // Decaimiento suave: `media` es la distancia a la que el generador
        // aporta la mitad. Antes el decaimiento era lineal y cortaba en seco,
        // así que un gimnasio a 320 m con alcance 300 valía exactamente cero
        // — y a 320 m la gente sí camina. Esta curva baja pero nunca corta.
        const cerca = 1 / (1 + Math.pow(p.distM / g.media, 2));
        aporte += g.peso * cerca;
      });
      if (aporte <= 0) return;
      sumaPeaton += aporte;
      // Se guardan los nombres reales, no solo la categoría: en un informe
      // "Smart Fit Prados del Este a 130 m" dice muchísimo más que "Gimnasio",
      // y es lo que permite comprobar el análisis contra la calle.
      // La fila lleva el nombre de la CATEGORÍA y los ejemplos los nombres
      // propios: si la fila tomara el nombre del primer local, diría "D1" y
      // luego repetiría "D1" como ejemplo suyo.
      const cat = TAXONOMIA.find(t => t.sub === sub);
      const etiqueta = (cat && cat.nombre) || lista[0].nombre;
      const ejemplos = lista.slice().sort((a, b) => a.distM - b.distM)
        .map(p => p.nombre)
        .filter(nombrePropio)
        .filter((n, i, a) => a.indexOf(n) === i).slice(0, 2);
      flujo.generadores.push({ sub, nombre: etiqueta, n: lista.length,
                               aporte: Math.round(aporte), franja: g.franja, ejemplos });
      repartirFranja(g.franja, aporte);
    });

    // ── 2. Aglomeración comercial ────────────────────────────────────────
    // Satura a propósito: pasar de 5 a 15 locales cambia mucho la calle; de 40
    // a 50, casi nada. Ya no es continuidad, ya era una calle comercial.
    const nComercio = pois.filter(p => COMERCIO_ANDEN.indexOf(p.sub) !== -1 && p.distM <= 400).length;
    if (nComercio > 0) {
      const aporte = 26 * (1 - Math.exp(-nComercio / 10));
      sumaPeaton += aporte;
      flujo.generadores.push({ sub:'aglomeracion', nombre:'Continuidad comercial (calle con vitrinas)',
                               n: nComercio, aporte: Math.round(aporte), franja:'todo' });
      repartirFranja('todo', aporte);
    }
    flujo.comerciosAnden = nComercio;

    // ── 3. Residentes ────────────────────────────────────────────────────
    const nVivienda = pois.filter(p => p.sub === 'residencial' && p.distM <= 400).length;
    if (nVivienda > 0) {
      const aporte = 14 * (1 - Math.exp(-nVivienda / 25));
      sumaPeaton += aporte;
      flujo.generadores.push({ sub:'residentes', nombre:'Vivienda en radio caminable',
                               n: nVivienda, aporte: Math.round(aporte), franja:'picos' });
      repartirFranja('picos', aporte);
    }

    // ── Hitos peatonales ─────────────────────────────────────────────────
    // Los establecimientos concretos que más caminata generan, uno por uno y
    // con su ubicación, para poder señalarlos en el mapa del informe. Un
    // gimnasio de cadena al lado cambia por completo el tránsito de una acera
    // —entra y sale gente a horas fijas, todos los días— y merece verse en el
    // plano, no quedar escondido en una suma.
    const PESO_HITO = 7;   // de aquí para arriba, el uso ancla por sí solo
    flujo.hitos = pois
      .filter(p => GENERA_PEATON[p.sub] && GENERA_PEATON[p.sub].peso >= PESO_HITO)
      .map(p => {
        const g = GENERA_PEATON[p.sub];
        const cat = TAXONOMIA.find(t => t.sub === p.sub);
        return { nombre: nombrePropio(p.nombre) ? p.nombre : ((cat && cat.nombre) || p.nombre),
                 // Un hito sin nombre propio se puede señalar igual ("Colegio"),
                 // pero no debe desplazar a uno que sí se puede nombrar.
                 anonimo: !nombrePropio(p.nombre),
                 sub: p.sub, icono: p.icono, distM: p.distM,
                 lat: p.lat, lng: p.lng, franja: g.franja,
                 fuerza: g.peso / (1 + Math.pow(p.distM / g.media, 2)) };
      })
      .sort((a, b) => (a.anonimo - b.anonimo) || (b.fuerza - a.fuerza))
      .slice(0, 6)
      .map(h => { h.fuerza = Math.round(h.fuerza * 10) / 10; return h; });

    // ── Dónde pararse dentro del radio ───────────────────────────────────
    // El análisis dice si la zona sirve; esto dice DÓNDE de la zona. Un radio
    // no es homogéneo: pegado a un ancla que descarga gente a pie hay mucho
    // más tránsito de acera que en el mismo radio 300 m más allá. Para un
    // formato de paso eso decide más que el promedio del sector.
    fijarConsejoUbicacion(flujo, null);

    flujo.generadores.sort((a, b) => b.aporte - a.aporte);
    // Escala saturante en vez de un tope duro: el potencial peatonal se satura
    // de verdad —duplicar los locales de un centro ya consolidado no duplica la
    // gente que cabe en el andén— y así ninguna ubicación choca contra un techo
    // artificial que las volvería indistinguibles. Calibrada contra escenarios
    // de referencia; ver la prueba `tflujo`.
    flujo.peatonal = Math.round(100 * (1 - Math.exp(-sumaPeaton / 100)));
    flujo.nivelPeatonal = flujo.peatonal >= 70 ? 'Muy alto' : flujo.peatonal >= 50 ? 'Alto'
      : flujo.peatonal >= 30 ? 'Medio' : 'Bajo';

    // ── Honestidad sobre los datos ───────────────────────────────────────
    // Un flujo bajo puede significar dos cosas MUY distintas: que la calle
    // está vacía, o que nadie ha mapeado esa zona todavía. Confundirlas lleva
    // a descartar una buena ubicación por un vacío de datos, así que cuando el
    // entorno viene pobremente mapeado se dice y no se disimula.
    const densidad = pois.length / Math.max(0.01, areaKm2);
    flujo.poisMapeados = pois.length;
    flujo.densidadPorKm2 = Math.round(densidad);
    // Se exigen las dos cosas: poca densidad Y pocos puntos. Un barrio de casas
    // bien mapeado tiene densidad baja y aun así su lectura es confiable — ahí
    // el flujo bajo es real, no un vacío de datos.
    flujo.datosEscasos = densidad < 60 && pois.length < 40;
    flujo.avisoDatos = flujo.datosEscasos
      ? 'La zona está poco mapeada (' + pois.length + ' puntos en el radio): el flujo real puede ser mayor que el estimado. ' +
        'Si conoces locales que no aparecen, vuelve a consultar con "Datos frescos" o agrégalos al mapa.'
      : '';

    // Vehicular: la exposición vial ya mide la jerarquía de la malla; se le
    // suma que haya dónde parar, porque un corredor rápido SIN parqueo no
    // produce clientes, solo carros que pasan de largo.
    //
    // El parqueo NO se puede leer solo de `amenity=parking`: en el mapa abierto
    // casi nadie dibuja el patio de un D1, de un gimnasio de cadena o de una
    // estación de servicio, aunque en la calle estén ahí. Un formato de borde
    // de vía arteria trae su propio parqueo casi por definición: es parte del
    // modelo de negocio. Se cuentan las dos cosas por separado y el informe
    // dice cuál es cuál — inferir no es lo mismo que ver.
    const PARQUEO_IMPLICITO = {
      gasolinera:       1.0,   // patio de maniobra, siempre
      centro_comercial: 1.0,
      supermercado:     0.9,
      tienda_descuento: 0.7,   // el D1 de borde de vía suele tener su bahía
      gimnasio:         0.7,
      salud_ips:        0.7,
      hotel:            0.6
    };
    flujo.parqueaderos = porSub.parqueadero || 0;
    flujo.parqueoProbable = Object.keys(PARQUEO_IMPLICITO)
      .filter(sub => (porSub[sub] || 0) > 0)
      .map(sub => {
        const cat = TAXONOMIA.find(t => t.sub === sub);
        return { sub, nombre: (cat && cat.nombre) || sub, n: porSub[sub] };
      });
    // Equivalente en "plazas de parqueo" para el puntaje: lo mapeado cuenta
    // entero y lo inferido según cuán fiable sea el formato.
    const parqueo = flujo.parqueaderos + flujo.parqueoProbable
      .reduce((a, p) => a + p.n * PARQUEO_IMPLICITO[p.sub], 0);
    flujo.vehicular = Math.round(clamp(0, 100,
      movilidad.exposicion * 0.8 + Math.min(20, parqueo * 7)));
    flujo.nivelVehicular = flujo.vehicular >= 70 ? 'Muy alto' : flujo.vehicular >= 50 ? 'Alto'
      : flujo.vehicular >= 30 ? 'Medio' : 'Bajo';
    // Hay dónde parar si se mapeó un parqueadero o si el entorno tiene formatos
    // que traen el suyo. Es lo que responde "¿el que pasa se puede detener?".
    flujo.hayDondeParar = flujo.parqueaderos > 0 || flujo.parqueoProbable.length > 0;

    // ── Tránsito vehicular y combustible ─────────────────────────────────
    //
    // Dos cifras que se piden mucho para leer el movimiento de una esquina:
    // cuántos carros pasan y cuánto combustible mueve la zona. Ninguna se
    // puede saber sin aforo ni sin datos de ventas, así que se entregan como
    // RANGOS de orden de magnitud y el informe lo dice con todas las letras.
    //
    // El tránsito promedio diario es una propiedad de la vía, no del lote: lo
    // que se reporta es el rango típico del corredor de mayor jerarquía que
    // pasa cerca, con su distancia, para que se entienda de qué vía se habla.
    const TPD = {
      troncal:    { min: 20000, max: 45000 },
      principal:  { min: 10000, max: 25000 },
      secundaria: { min:  4000, max: 12000 },
      colectora:  { min:  1500, max:  5000 }
    };
    const corredor = (movilidad.viasArterias || []).slice()
      .sort((a, b) => {
        const jer = { troncal: 4, principal: 3, secundaria: 2, colectora: 1 };
        return (jer[b.jerarquia] || 0) - (jer[a.jerarquia] || 0) || a.distM - b.distM;
      })[0];
    const rango = corredor ? TPD[corredor.jerarquia] : null;
    // Una estación de servicio urbana de tamaño medio en Colombia mueve del
    // orden de 60.000 a 150.000 litros al mes. Multiplicado por las estaciones
    // del radio da una magnitud del consumo de la zona — no una cifra de
    // ventas, que solo conoce cada estación.
    const LITROS_POR_ESTACION = { min: 60000, max: 150000 };
    const nEstaciones = porSub.gasolinera || 0;
    flujo.trafico = {
      corredor: corredor ? { nombre: corredor.nombre, jerarquia: corredor.jerarquia,
                             distM: corredor.distM } : null,
      carrosDiaMin: rango ? rango.min : 0,
      carrosDiaMax: rango ? rango.max : 0,
      estaciones: nEstaciones,
      litrosMesMin: nEstaciones * LITROS_POR_ESTACION.min,
      litrosMesMax: nEstaciones * LITROS_POR_ESTACION.max,
      // Sin corredor arterial no hay de dónde estimar: se dice, no se inventa.
      estimable: !!rango
    };

    const maxF = Math.max(aporteFranja.manana, aporteFranja.mediodia, aporteFranja.tarde) || 1;
    flujo.franjas = {
      manana:   Math.round(aporteFranja.manana / maxF * 100),
      mediodia: Math.round(aporteFranja.mediodia / maxF * 100),
      tarde:    Math.round(aporteFranja.tarde / maxF * 100)
    };
    flujo.franjaFuerte = flujo.franjas.manana >= flujo.franjas.mediodia && flujo.franjas.manana >= flujo.franjas.tarde
      ? 'la mañana' : (flujo.franjas.tarde >= flujo.franjas.mediodia ? 'la tarde' : 'el mediodía');
    // Qué predomina: caminar o conducir. Es la pregunta que decide el formato.
    // Cuando los dos están por el piso no hay empate que resolver: no pasa
    // nadie, ni a pie ni en carro, y decir "equilibrado" ahí haría creer que
    // basta con atender bien los dos accesos.
    flujo.dominante = (flujo.peatonal < 25 && flujo.vehicular < 25) ? 'ninguno'
      : flujo.peatonal >= flujo.vehicular + 12 ? 'peatonal'
      : flujo.vehicular >= flujo.peatonal + 12 ? 'vehicular' : 'equilibrado';
    movilidad.flujo = flujo;

    movilidad.argumento = principal
      ? 'El lote está a ' + principal.distM + ' m de ' + principal.nombre + ' (vía ' + principal.jerarquia +
        ') y cuenta con ' + movilidad.nViasArterias + ' corredor' + (movilidad.nViasArterias === 1 ? '' : 'es') +
        ' arterial' + (movilidad.nViasArterias === 1 ? '' : 'es') + ' en el radio: exposición ' +
        movilidad.nivelExposicion.toLowerCase() + ' al tránsito de la ciudad y buena visibilidad para el proyecto.'
      : 'No se identificaron vías arterias en el radio: el acceso depende de la malla vial local y la visibilidad del proyecto será menor.';

    // Top-5 por grupo, ordenados por cercanía al lote.
    pois.sort((a, b) => a.distM - b.distM);
    pois.forEach(p => { if (topPorGrupo[p.grupo].length < 5) topPorGrupo[p.grupo].push(p); });

    // Nombres propios por subcategoría (los más cercanos primero) para que el
    // FODA pueda citar los lugares concretos del entorno en vez de contarlos.
    const nombresPorSub = {};
    pois.forEach(p => {
      if (!nombrePropio(p.nombre)) return;
      const lista = nombresPorSub[p.sub] = nombresPorSub[p.sub] || [];
      if (lista.length < 6 && lista.indexOf(p.nombre) === -1) lista.push(p.nombre);
    });

    const ambiente = {
      parques: (porSub.parque || 0),
      cuerposAgua: (porSub.agua || 0),
      verdeNatural: (porSub.verde_natural || 0),
      scoreVerde: 0
    };
    ambiente.scoreVerde = Math.min(100, 25 * Math.min(ambiente.parques, 2) +
      15 * (ambiente.cuerposAgua > 0 ? 1 : 0) + 12 * Math.min(ambiente.verdeNatural, 4));

    // Uso predominante (macro-categorías, %). landuse residencial pesa x3
    // porque un polígono de landuse representa una zona, no un solo predio.
    const pesos = {
      residencial: 3 * (porSub.residencial || 0) + (porSub.parque || 0) + (porSub.deportivo || 0),
      comercial: (porGrupo.comercio || 0) + (porSub.bar_ocio || 0),
      institucional: (porGrupo.institucional || 0) + (porGrupo.salud || 0) + (porGrupo.cultura || 0),
      servicios: (porGrupo.servicios || 0),
      industrial: (porGrupo.industria || 0),
      mixto: (porGrupo.mixtos || 0),
      ambiental: (porGrupo.ambiente || 0)
    };
    const pesoTotal = Object.values(pesos).reduce((a, b) => a + b, 0) || 1;
    const usoPredominante = {};
    Object.keys(pesos).forEach(k => { usoPredominante[k] = Math.round(100 * pesos[k] / pesoTotal); });

    const shareResidencial = pesos.residencial / pesoTotal;
    // Estimación heurística: ~7000 hab/km² (densidad urbana típica de Cúcuta)
    // modulada por cuánto del entorno es residencial. Se conserva SOLO como
    // respaldo — satura, porque el techo de 1,4 hace que dos sectores muy
    // residenciales de densidad edificatoria muy distinta den la misma cifra.
    const poblacionHeuristica = Math.round(areaKm2 * 7000 * clamp(0.4, 1.4, 0.4 + shareResidencial));
    const hayDane = !!(dane && dane.poblacion != null);
    const poblacionEstimada = hayDane ? dane.poblacion : poblacionHeuristica;

    return {
      total: pois.length, areaHa: Math.round(areaHa * 10) / 10,
      porGrupo, porSub,
      densidadPorHa: Math.round(10 * pois.length / Math.max(areaHa, 0.1)) / 10,
      poblacionEstimada, poblacionHeuristica, usoPredominante,
      // Trazabilidad de la cifra: el informe debe poder decir si el número es
      // un dato censal o una estimación. Ante un cliente no pesan igual.
      poblacionFuente: hayDane ? dane.etiquetaFuente : 'Estimación heurística URBIS',
      poblacionEsCensal: hayDane,
      viviendasCenso: hayDane ? dane.viviendas : null,
      // Personas por vivienda: señal REAL de densidad edificatoria, lo que a la
      // heurística le faltaba para distinguir un sector de otro.
      personasPorVivienda: (hayDane && dane.viviendas)
        ? Math.round((dane.poblacion / dane.viviendas) * 10) / 10 : null,
      estrato: hayDane ? dane.estrato : null,
      demografia: hayDane ? dane.demografia : null,
      dane: hayDane ? dane : null,
      movilidad, ambiente, topPorGrupo, nombresPorSub, pois
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INDICADORES URBANOS
  // Cada indicador declara de dónde sale su valor, para no presentar nunca
  // una interpretación como si fuera un dato medido:
  //   observado    → conteo directo de OpenStreetMap
  //   indicador    → cálculo nuestro sobre esos conteos
  //   interpretacion → lectura cualitativa del cálculo
  //   externo      → no se puede saber con los datos actuales
  // ═══════════════════════════════════════════════════════════════════════
  const SUBS_COMERCIO = ['supermercado','tienda_descuento','centro_comercial','tienda_barrio','panaderia','banco','hotel',
    'gasolinera','restaurante','cafeteria','pagos','internet_cafe','local_comercial','comercio_otro'];

  function nivelPorUmbral(v, umbrales){
    for (let i = 0; i < umbrales.length; i++) if (v >= umbrales[i][0]) return umbrales[i][1];
    return umbrales[umbrales.length - 1][1];
  }

  // Diversidad de usos (índice de Shannon normalizado). Un sector con muchas
  // categorías repartidas es más diverso que uno dominado por una sola.
  // Pedido explícito: "diversidad baja" se leía como "lugar malo", cuando en
  // realidad puede significar justo lo contrario — poca mezcla de usos suele
  // ser sinónimo de "aquí es casi todo vivienda", y eso es MENOS competencia
  // para un negocio nuevo, no un mal augurio. El texto se genera distinto
  // según el nivel para que esa lectura vaya siempre pegada al dato, no en
  // una nota aparte que el lector se puede saltar.
  function indicadorDiversidad(stats){
    const grupos = Object.keys(GRUPOS).filter(g => g !== 'otro' && (stats.porGrupo[g] || 0) > 0);
    const total = grupos.reduce((a, g) => a + stats.porGrupo[g], 0);
    if (!total || grupos.length < 2) {
      return { valor: 0, nivel: 'Muy baja', tipo: 'indicador',
               detalle: 'El entorno está dominado por un solo tipo de uso — casi siempre vivienda. ' +
                 'No es una mala señal por sí sola: significa poca competencia instalada para lo que se proponga aquí.' };
    }
    let H = 0;
    grupos.forEach(g => { const p = stats.porGrupo[g] / total; H -= p * Math.log(p); });
    const norm = Math.round(100 * H / Math.log(grupos.length));
    const nivel = nivelPorUmbral(norm, [[75,'Muy alta'],[60,'Alta'],[45,'Media'],[30,'Baja'],[0,'Muy baja']]);
    const base = 'Se identificaron ' + grupos.length + ' grupos de uso distintos conviviendo en el radio.';
    const detalle = (nivel === 'Baja' || nivel === 'Muy baja')
      ? base + ' Un valor bajo no es necesariamente negativo: suele indicar un sector predominantemente ' +
        'residencial con poca oferta ya instalada — menos competencia para un proyecto nuevo. Lo que sí ' +
        'conviene mirar es el indicador de Viabilidad, que es el que resume si el proyecto conviene.'
      : base;
    return { valor: norm, tipo: 'indicador', nivel, detalle };
  }

  // Suelo sin desarrollar → cuánto margen de crecimiento físico queda.
  function indicadorExpansion(stats){
    const baldios = stats.porSub.baldio || 0;
    const ratio = stats.total ? baldios / stats.total : 0;
    const valor = Math.round(clamp(0, 100, ratio * 900 + Math.min(30, baldios * 5)));
    return {
      valor, baldios, tipo: 'indicador',
      nivel: nivelPorUmbral(valor, [[60,'Alto potencial'],[35,'Potencial medio'],[15,'Potencial bajo'],[0,'Sector consolidado']]),
      detalle: baldios
        ? baldios + ' ' + plural(baldios, 'lote sin desarrollar', 'lotes sin desarrollar') +
          ' en el radio: queda suelo disponible para crecer.'
        : 'No se detectó suelo sin desarrollar: el sector ya está ocupado.'
    };
  }

  // Obras en curso → si el sector está cambiando de cara ahora mismo.
  function indicadorTransformacion(stats){
    const obras = stats.porSub.en_obra || 0;
    const valor = Math.round(clamp(0, 100, (stats.total ? obras / stats.total : 0) * 1100 + Math.min(35, obras * 7)));
    return {
      valor, obras, tipo: 'indicador',
      nivel: nivelPorUmbral(valor, [[60,'Fuerte transformación'],[35,'En transformación'],[15,'En transición'],[0,'Sector estable']]),
      detalle: obras
        ? obras + ' ' + plural(obras, 'obra en curso', 'obras en curso') +
          ': hay inversión activa transformando el sector.'
        : 'Sin obras en curso detectadas: el sector no muestra cambios físicos recientes.'
    };
  }

  // Cuánta y qué tan variada es la actividad comercial.
  function indicadorComercio(stats){
    const n = stats.porGrupo.comercio || 0;
    const categorias = SUBS_COMERCIO.filter(s => (stats.porSub[s] || 0) > 0);
    const densidad = stats.areaHa ? +(n / stats.areaHa).toFixed(2) : 0;
    const dominante = categorias.slice().sort((a, b) => stats.porSub[b] - stats.porSub[a])[0] || '';
    const ausentes = ['supermercado','drogueria','cafeteria','restaurante','banco'].filter(s => !(stats.porSub[s] || 0));
    let nivel;
    if (n >= 60 && categorias.length >= 6) nivel = 'Alta actividad comercial';
    else if (n >= 20) nivel = 'Actividad comercial moderada';
    else if (categorias.length <= 2 && n > 0) nivel = 'Sector especializado';
    else nivel = 'Predominantemente residencial';
    return {
      total: n, categorias: categorias.length, densidad, dominante, ausentes, nivel, tipo: 'indicador',
      detalle: n + ' establecimientos en ' + categorias.length + ' categorías distintas (' + densidad + ' por hectárea).'
    };
  }

  // Patrones de temporalidad que se pueden inferir de los equipamientos.
  // No se afirma magnitud de demanda: solo se señala el patrón posible.
  function indicadorEstacionalidad(stats){
    const notas = [];
    const n = sub => ((stats.nombresPorSub || {})[sub] || []);
    if ((stats.porSub.universidad || 0) > 0 || (stats.porSub.colegio || 0) >= 2) {
      notas.push('Componente estudiantil' + (n('universidad').length ? ' (' + listar(n('universidad'), 2) + ')' : '') +
        ': algunas actividades comerciales podrían bajar su ritmo en vacaciones escolares y universitarias.');
    }
    if ((stats.porSub.oficina || 0) >= 3 || (stats.porGrupo.institucional || 0) >= 3) {
      notas.push('Componente laboral y de trámites: mayor movimiento de lunes a viernes en horario de oficina.');
    }
    if ((stats.porSub.hotel || 0) > 0 || (stats.porSub.cultural || 0) >= 2) {
      notas.push('Componente turístico o de eventos: la demanda puede variar según temporada y calendario.');
    }
    if ((stats.porGrupo.salud || 0) >= 3) {
      notas.push('Componente de salud: genera flujo estable durante todo el año, incluidos fines de semana.');
    }
    return { notas, tipo: 'interpretacion',
      detalle: notas.length ? '' : 'No se identificaron equipamientos que sugieran una demanda marcadamente estacional.' };
  }

  // Factores que pueden jugar en contra del proyecto.
  function indicadorRiesgos(stats, diversidad){
    const señales = [];
    let puntos = 0;
    if (stats.total < 25) { puntos += 25; señales.push('Baja actividad urbana registrada en el radio.'); }
    if (stats.movilidad.paradasBus === 0) { puntos += 15; señales.push('Sin transporte público identificado.'); }
    if (stats.movilidad.nViasArterias === 0) { puntos += 20; señales.push('Sin vías arterias cercanas: baja visibilidad.'); }
    if (diversidad.valor < 40) { puntos += 18; señales.push('Poca diversidad de usos: el sector depende de una sola actividad.'); }
    if ((stats.porSub.baldio_obra || 0) > 8) { puntos += 15; señales.push('Alta proporción de suelo sin consolidar.'); }
    if (stats.ambiente.scoreVerde < 20) { puntos += 8; señales.push('Déficit de espacio público verde.'); }
    if ((stats.porGrupo.salud || 0) === 0) { puntos += 8; señales.push('Sin servicios de salud en el radio.'); }
    const valor = Math.round(clamp(0, 100, puntos));
    return {
      valor, señales, tipo: 'indicador',
      nivel: nivelPorUmbral(valor, [[55,'Riesgo muy alto'],[35,'Riesgo alto'],[18,'Riesgo medio'],[0,'Riesgo bajo']]),
      detalle: señales.length ? '' : 'No se identificaron factores de riesgo urbano relevantes.'
    };
  }

  // Categorías con actividad suficiente alrededor pero poca oferta propia.
  function indicadorOportunidades(stats){
    const candidatos = ['drogueria','cafeteria','restaurante','supermercado','gimnasio','panaderia','banco'];
    const nombre = { drogueria:'Droguería', cafeteria:'Cafetería', restaurante:'Restaurante',
      supermercado:'Supermercado', gimnasio:'Gimnasio', panaderia:'Panadería', banco:'Servicios financieros' };
    const umbral = { drogueria:3500, cafeteria:2500, restaurante:3000, supermercado:6000,
      gimnasio:4000, panaderia:3000, banco:6000 };
    const out = [];
    candidatos.forEach(s => {
      const existentes = stats.porSub[s] || 0;
      const soportadas = Math.floor(stats.poblacionEstimada / umbral[s]);
      if (soportadas - existentes >= 1 && stats.poblacionEstimada > 1500) {
        out.push({ sub: s, nombre: nombre[s], existentes, potencial: soportadas - existentes,
          // El nombre de la categoría ya se muestra como título del ítem, así
          // que aquí no se repite: evita plurales forzados tipo "servicios
          // financieros(s)", que en un informe para cliente se leen mal.
          texto: 'El sector podría sostener cerca de ' + soportadas +
            (existentes ? ' y hoy se identifican ' + existentes : ' y hoy no se identifica ninguno') +
            ', para ~' + stats.poblacionEstimada.toLocaleString('es-CO') + ' habitantes estimados.' });
      }
    });
    return { lista: out.sort((a, b) => b.potencial - a.potencial).slice(0, 4), tipo: 'interpretacion' };
  }

  // Score de Oportunidad Urbana: integra los indicadores anteriores con pesos
  // distintos según lo que el proyecto necesita de verdad.
  const PESOS_OPORTUNIDAD = {
    _defecto:     { movilidad:.20, comercio:.18, diversidad:.15, equipamientos:.15, riesgos:.17, expansion:.08, transformacion:.07 },
    vivienda:     { movilidad:.15, comercio:.15, diversidad:.15, equipamientos:.28, riesgos:.17, expansion:.05, transformacion:.05 },
    residencial:  { movilidad:.15, comercio:.15, diversidad:.15, equipamientos:.28, riesgos:.17, expansion:.05, transformacion:.05 },
    comercio:     { movilidad:.30, comercio:.24, diversidad:.12, equipamientos:.08, riesgos:.16, expansion:.05, transformacion:.05 },
    comercial_indefinido: { movilidad:.30, comercio:.24, diversidad:.12, equipamientos:.08, riesgos:.16, expansion:.05, transformacion:.05 },
    hotel:        { movilidad:.28, comercio:.20, diversidad:.14, equipamientos:.16, riesgos:.14, expansion:.04, transformacion:.04 },
    turismo:      { movilidad:.28, comercio:.20, diversidad:.14, equipamientos:.16, riesgos:.14, expansion:.04, transformacion:.04 },
    oficinas:     { movilidad:.28, comercio:.18, diversidad:.14, equipamientos:.14, riesgos:.16, expansion:.05, transformacion:.05 },
    oficina_indefinida: { movilidad:.28, comercio:.18, diversidad:.14, equipamientos:.14, riesgos:.16, expansion:.05, transformacion:.05 },
    mixto:        { movilidad:.22, comercio:.18, diversidad:.20, equipamientos:.18, riesgos:.14, expansion:.04, transformacion:.04 }
  };

  function pesosOportunidad(usos){
    const ids = (usos || []).map(u => u.id || u);
    if (!ids.length) return PESOS_OPORTUNIDAD._defecto;
    if (ids.length > 1) return PESOS_OPORTUNIDAD.mixto;
    return PESOS_OPORTUNIDAD[ids[0]] || PESOS_OPORTUNIDAD._defecto;
  }

  // Estrato socioeconómico predominante (Censo DANE 2018). Para una
  // constructora es de los datos que más pesan: define el rango de precios al
  // que se puede vender y el producto que tiene sentido construir. No es un
  // score de 0 a 100 — es un hecho del sector, así que se presenta tal cual.
  const ESTRATO_LECTURA = {
    1: 'Estrato bajo-bajo: producto de interés social (VIS/VIP) y comercio de proximidad.',
    2: 'Estrato bajo: vivienda VIS, comercio de barrio y servicios básicos.',
    3: 'Estrato medio-bajo: el mercado más amplio de la ciudad; vivienda no-VIS de entrada y comercio de escala barrial.',
    4: 'Estrato medio: capacidad de compra estable; vivienda de calidad media-alta, oficinas y comercio especializado.',
    5: 'Estrato medio-alto: producto de mayor valor por m², vivienda premium y comercio de marca.',
    6: 'Estrato alto: el segmento de mayor precio por m² de la ciudad.'
  };
  function indicadorEstrato(stats){
    const e = stats.estrato;
    if (!e) {
      return { tipo:'interpretacion', disponible:false,
        detalle:'Sin dato de estrato para este radio: el lote queda fuera de la cobertura urbana del censo, o no hubo conexión al consultarlo.' };
    }
    const homogeneo = e.minimo === e.maximo;
    const detalle = (ESTRATO_LECTURA[e.predominante] || '') +
      (homogeneo
        ? ' El sector es homogéneo: todas las manzanas con estrato están en el ' + e.predominante + '.'
        : ' Convive un rango de estrato ' + e.minimo + ' a ' + e.maximo +
          ', así que el producto debe definirse por el costado del lote, no por el promedio del sector.') +
      (e.sinEstrato
        ? ' Hay ' + e.sinEstrato + ' ' + plural(e.sinEstrato, 'manzana', 'manzanas') +
          ' sin estrato (suelo dotacional, industrial o sin desarrollar).'
        : '');
    return {
      tipo:'observado', disponible:true, fuente:'Censo DANE 2018',
      predominante: e.predominante, promedio: e.promedio,
      minimo: e.minimo, maximo: e.maximo, reparto: e.reparto,
      sinEstrato: e.sinEstrato, homogeneo,
      nivel: 'Estrato ' + e.predominante + (homogeneo ? '' : ' (' + e.minimo + '–' + e.maximo + ')'),
      detalle
    };
  }

  // Estructura demográfica del censo. OJO: el CNPV 2018 registra SEXO
  // (hombre/mujer), no identidad de género — el informe debe decirlo así para
  // no atribuirle al DANE una medición que no hizo.
  function indicadorDemografia(stats){
    const d = stats.demografia;
    if (!d) {
      return { tipo:'interpretacion', disponible:false,
        detalle:'Sin estructura demográfica para este radio: el lote queda fuera de la cobertura urbana del censo, o no hubo conexión al consultarlo.' };
    }
    // Lectura para decidir producto: qué construir cambia mucho si el sector
    // está envejecido, si es de familias jóvenes o si es de población flotante.
    const lect = [];
    if (d.envejecimiento != null && d.envejecimiento >= 100) {
      lect.push('Sector envejecido: hay ' + d.envejecimiento + ' personas de 65 años o más por cada 100 menores de 15. ' +
        'Pesa más la accesibilidad, la cercanía a servicios de salud y la vivienda de un solo nivel que el equipamiento infantil.');
    } else if (d.pctNinos >= 22) {
      lect.push('Sector de familias jóvenes (' + d.pctNinos + '% de menores de 15 años): ' +
        'hay demanda de vivienda familiar, colegios, zonas de juego y comercio de proximidad.');
    }
    if (d.tramoDominante === 'jovenes') {
      lect.push('El grupo más numeroso es el de 15 a 29 años: apartaestudios, arriendo, coworking y comercio de bajo ticket encajan mejor que la vivienda familiar grande.');
    }
    if (d.pctMayores >= 15 && d.envejecimiento < 100) {
      lect.push('Con ' + d.pctMayores + '% de población de 65 años o más, conviene prever consultorios, droguería y recorridos peatonales cómodos.');
    }
    const desbalance = Math.abs(d.pctMujeres - 50);
    if (desbalance >= 4) {
      lect.push('Predominio de ' + (d.pctMujeres > 50 ? 'mujeres' : 'hombres') + ' (' +
        (d.pctMujeres > 50 ? d.pctMujeres : d.pctHombres) + '%), por encima del promedio de la ciudad.');
    }
    if (!lect.length) lect.push('Estructura demográfica equilibrada, sin un grupo de edad que domine el sector.');

    return {
      tipo:'observado', disponible:true, fuente:'Censo DANE 2018',
      mujeres:d.mujeres, hombres:d.hombres,
      pctMujeres:d.pctMujeres, pctHombres:d.pctHombres,
      tramos:d.tramos, pctMayores:d.pctMayores, pctNinos:d.pctNinos,
      envejecimiento:d.envejecimiento,
      nivel: d.tramoDominanteEtq,
      detalle: lect.join(' ')
    };
  }

  function calcularIndicadores(stats, usos){
    const demografia = indicadorDemografia(stats);
    const estrato = indicadorEstrato(stats);
    const diversidad = indicadorDiversidad(stats);
    const expansion = indicadorExpansion(stats);
    const transformacion = indicadorTransformacion(stats);
    const comercio = indicadorComercio(stats);
    const estacionalidad = indicadorEstacionalidad(stats);
    const riesgos = indicadorRiesgos(stats, diversidad);
    const oportunidades = indicadorOportunidades(stats);

    // Equipamientos: salud + educación/cultura + institucional, saturando a 12.
    const nEquip = (stats.porGrupo.salud || 0) + (stats.porGrupo.cultura || 0) + (stats.porGrupo.institucional || 0);
    const sEquip = Math.round(clamp(0, 100, nEquip / 12 * 100));
    const sComercio = Math.round(clamp(0, 100, (comercio.total / 45 * 60) + (comercio.categorias / 10 * 40)));

    const p = pesosOportunidad(usos);
    const score = Math.round(
      p.movilidad * stats.movilidad.exposicion +
      p.comercio * sComercio +
      p.diversidad * diversidad.valor +
      p.equipamientos * sEquip +
      p.riesgos * (100 - riesgos.valor) +
      p.expansion * expansion.valor +
      p.transformacion * transformacion.valor);

    return {
      estrato, demografia,
      diversidad, expansion, transformacion, comercio, estacionalidad, riesgos, oportunidades,
      equipamientos: { valor: sEquip, total: nEquip, tipo: 'indicador' },
      scoreOportunidad: {
        valor: clamp(0, 100, score), tipo: 'indicador',
        nivel: nivelPorUmbral(score, [[75,'Muy alta'],[60,'Alta'],[45,'Media'],[30,'Baja'],[0,'Muy baja']]),
        componentes: {
          movilidad: stats.movilidad.exposicion, comercio: sComercio, diversidad: diversidad.valor,
          equipamientos: sEquip, riesgos: 100 - riesgos.valor,
          expansion: expansion.valor, transformacion: transformacion.valor
        }
      },
      // Datos que hoy NO se pueden calcular: quedan declarados para no
      // simularlos nunca y para saber qué falta conseguir.
      // Población oficial y estratificación salieron de esta lista: ya se
      // resuelven con el Censo DANE 2018 cuando el lote está en cobertura.
      requiereFuenteExterna: (stats.poblacionEsCensal ? [] : ['Densidad poblacional oficial (DANE)'])
        .concat(stats.estrato ? [] : ['Estratificación socioeconómica'])
        .concat([
          'Precios de venta y arriendo', 'Valor y valorización del suelo',
          'Ingresos de los hogares',
          'Conteos de tráfico y flujo peatonal', 'Seguridad y siniestralidad',
          'Licencias de construcción y proyectos nuevos', 'Información catastral'
        ])
    };
  }

  // ── Comparativa multi-radio (Fase 3) ────────────────────────────────────
  // Reutiliza los MISMOS elementos ya descargados y solo los filtra por
  // distancia: comparar 250 m contra 1 km no cuesta ni una consulta extra a
  // Overpass. Solo se calculan radios MENORES o iguales al analizado, porque
  // con datos de 500 m es imposible saber qué hay a 2 km — inventarlo sería
  // exactamente lo que este módulo no debe hacer.
  const RADIOS_COMPARATIVA = [250, 500, 1000, 2000];

  function coordDe(el){
    const lat = el.lat != null ? el.lat : (el.center && el.center.lat);
    const lng = el.lon != null ? el.lon : (el.center && el.center.lon);
    return (lat == null || lng == null) ? null : { lat, lng };
  }

  // Overpass devuelve de más: para una vía o un polígono basta con que UN nodo
  // caiga en el radio, así que su centro puede quedar fuera. El análisis
  // principal no lo filtraba y la comparativa multi-radio sí, de modo que el
  // mismo informe mostraba dos totales distintos para el mismo radio (893 vs
  // 831 usos en Cúcuta: 60 usos estaban hasta a 583 m de un radio de 500 m).
  // Se filtra UNA vez y todo el análisis parte del mismo conjunto.
  function filtrarPorRadio(elementos, radioM, centro){
    return (elementos || []).filter(el => {
      const c = coordDe(el);
      return c ? haversineM(centro, c) <= radioM : false;
    });
  }

  // `danePorRadio` es un mapa { 500: {...}, 1000: {...} }. Sin él, cada anillo
  // caería a la estimación heurística y la tabla volvería a contradecir los KPI
  // del encabezado, que es justo el problema que se corrigió.
  function compararRadios(elementos, radioM, centro, danePorRadio){
    const radios = RADIOS_COMPARATIVA.filter(r => r < radioM).concat([radioM])
      .filter((r, i, a) => a.indexOf(r) === i).sort((a, b) => a - b);
    // Con un solo anillo no hay nada que comparar (ej. un análisis de 100 m).
    if (radios.length < 2) return null;

    // Se mide una vez la distancia de cada elemento y se reutiliza.
    const conDist = (elementos || []).map(el => {
      const c = coordDe(el);
      return c ? { el, d: haversineM(centro, c) } : null;
    }).filter(Boolean);

    const anillos = radios.map(r => {
      const s = calcularStats(conDist.filter(x => x.d <= r).map(x => x.el), r, centro,
                              danePorRadio ? danePorRadio[r] : null);
      const comercio = SUBS_COMERCIO.reduce((a, k) => a + (s.porSub[k] || 0), 0);
      const equipamientos = (s.porGrupo.salud || 0) + (s.porGrupo.cultura || 0) + (s.porGrupo.institucional || 0);
      const pred = Object.keys(s.usoPredominante).sort((a, b) => s.usoPredominante[b] - s.usoPredominante[a])[0] || '';
      return {
        radioM: r, esAnalizado: r === radioM, total: s.total, areaHa: s.areaHa,
        densidadPorHa: s.densidadPorHa, poblacionEstimada: s.poblacionEstimada,
        comercio, equipamientos, diversidad: indicadorDiversidad(s).valor,
        predominante: pred ? pred[0].toUpperCase() + pred.slice(1) : '—',
        pctPredominante: s.usoPredominante[pred] || 0
      };
    });

    // La lectura útil no es cada anillo por separado, sino si el lote está en
    // un núcleo más activo que el sector amplio o al contrario.
    const cerca = anillos[0], lejos = anillos[anillos.length - 1];
    const ratio = cerca.densidadPorHa / Math.max(lejos.densidadPorHa, 0.01);
    const lectura = ratio >= 1.25
      ? 'El entorno inmediato (' + cerca.radioM + ' m, ' + cerca.densidadPorHa + ' usos/ha) es más denso que el sector amplio (' +
        lejos.radioM + ' m, ' + lejos.densidadPorHa + ' usos/ha): el lote está dentro de un núcleo de actividad, no en su periferia.'
      : ratio <= 0.8
      ? 'El entorno inmediato (' + cerca.radioM + ' m, ' + cerca.densidadPorHa + ' usos/ha) es menos denso que el sector amplio (' +
        lejos.radioM + ' m, ' + lejos.densidadPorHa + ' usos/ha): la actividad está alrededor y el lote queda en un borde más tranquilo.'
      : 'La densidad se mantiene pareja entre ' + cerca.radioM + ' m y ' + lejos.radioM +
        ' m (' + cerca.densidadPorHa + ' vs ' + lejos.densidadPorHa + ' usos/ha): sector homogéneo, sin un núcleo marcado.';

    return { anillos, lectura, tipo: 'indicador' };
  }

  // ── Proyectos evaluables ────────────────────────────────────────────────
  // habXunidad = habitantes que sostienen 1 unidad del negocio (umbral de
  // sustento). competidores/complementarios usan las subs de la taxonomía.
  const PESOS_DEFECTO = { demanda:.30, competencia:.25, complementarios:.20, movilidad:.15, entorno:.10 };
  const PROYECTOS = [
    { id:'drogueria',    nombre:'Droguería',            icono:'💊', habXunidad:3500,  competidores:['drogueria'], complementarios:['salud_ips','laboratorio','supermercado','tienda_barrio'] },
    { id:'cafeteria',    nombre:'Cafetería',            icono:'☕', habXunidad:2500,  competidores:['cafeteria','panaderia'], complementarios:['universidad','oficina','colegio','gimnasio','cultural'], pesos:{ demanda:.20, competencia:.25, complementarios:.30, movilidad:.15, entorno:.10 } },
    // Dos formatos de café que se implantan con lógicas OPUESTAS, y por eso
    // pesan distinto. El de paso vive de que MUCHA gente pase por la puerta:
    // ticket bajo, alta rotación, estancia corta, así que la movilidad manda y
    // la competencia estorba poco (dos cafés de paso en la misma cuadra pueden
    // convivir si el flujo alcanza). El de estancia vive de que la gente se
    // QUEDE: ticket alto, permanencia larga, así que pesa el entorno —oficinas,
    // hoteles, centros comerciales— y la competencia duele mucho más, porque
    // se disputa al mismo cliente que elige dónde sentarse una hora.
    { id:'cafe_paso',    nombre:'Café de paso',         icono:'🥤', habXunidad:1800,
      competidores:['cafeteria','panaderia'],
      complementarios:['parada_bus','oficina','universidad','colegio','banco','gimnasio','supermercado'],
      pesos:{ demanda:.20, competencia:.10, complementarios:.25, movilidad:.35, entorno:.10 },
      flujo:'peatonal',
      nota:'Formato de alta rotación y estancia corta: se implanta donde el flujo peatonal es constante.' },
    { id:'cafe_estancia',nombre:'Café de estancia',     icono:'🫖', habXunidad:6000,
      competidores:['cafeteria'],
      complementarios:['centro_comercial','oficina','hotel','universidad','cultural','banco'],
      pesos:{ demanda:.15, competencia:.30, complementarios:.25, movilidad:.15, entorno:.15 },
      flujo:'mixto',
      nota:'Formato de permanencia larga y ticket alto: pesa más el entorno y la exclusividad de la zona.' },
    { id:'restaurante',  nombre:'Restaurante',          icono:'🍽️', habXunidad:3000,  competidores:['restaurante'], complementarios:['oficina','hotel','universidad','cultural','banco'] },
    { id:'supermercado', nombre:'Supermercado',         icono:'🛒', habXunidad:6000,  competidores:['supermercado','tienda_descuento','centro_comercial'], complementarios:['residencial','parada_bus'], pesos:{ demanda:.40, competencia:.25, complementarios:.10, movilidad:.15, entorno:.10 } },
    { id:'residencial',  nombre:'Edificio residencial', icono:'🏢', habXunidad:0,     competidores:['baldio_obra'], complementarios:['colegio','supermercado','parque','salud_ips','parada_bus','tienda_barrio'], pesos:{ demanda:.15, competencia:.10, complementarios:.35, movilidad:.20, entorno:.20 } },
    { id:'mixto',        nombre:'Edificio mixto',       icono:'🧩', habXunidad:0,     competidores:['baldio_obra'], complementarios:['colegio','supermercado','parque','salud_ips','parada_bus','comercio_otro','oficina'], pesos:{ demanda:.20, competencia:.10, complementarios:.30, movilidad:.20, entorno:.20 } },
    { id:'oficinas',     nombre:'Oficinas',             icono:'💼', habXunidad:8000,  competidores:['oficina'], complementarios:['banco','restaurante','cafeteria','gobierno','parada_bus'], pesos:{ demanda:.25, competencia:.20, complementarios:.20, movilidad:.25, entorno:.10 } },
    { id:'consultorios', nombre:'Consultorios',         icono:'🩺', habXunidad:5000,  competidores:['salud_ips'], complementarios:['drogueria','laboratorio','parada_bus'] },
    { id:'hotel',        nombre:'Hotel',                icono:'🏨', habXunidad:10000, competidores:['hotel'], complementarios:['restaurante','cultural','gobierno','gasolinera'], pesos:{ demanda:.20, competencia:.25, complementarios:.20, movilidad:.25, entorno:.10 } },
    { id:'coworking',    nombre:'Coworking',            icono:'🧑‍💻', habXunidad:8000,  competidores:['oficina'], complementarios:['universidad','cafeteria','restaurante'], pesos:{ demanda:.20, competencia:.20, complementarios:.30, movilidad:.20, entorno:.10 } },
    { id:'gimnasio',     nombre:'Gimnasio',             icono:'🏋️', habXunidad:4000,  competidores:['gimnasio','deportivo'], complementarios:['residencial','oficina','parque'] },
    { id:'colegio',      nombre:'Colegio',              icono:'🏫', habXunidad:4000,  competidores:['colegio'], complementarios:['residencial','parque','cultural'], pesos:{ demanda:.30, competencia:.20, complementarios:.15, movilidad:.15, entorno:.20 } }
  ];

  function contarSubs(porSub, subs){ return (subs || []).reduce((n, s) => n + (porSub[s] || 0), 0); }

  function scoreProyecto(proyecto, stats){
    const porSub = stats.porSub || {};
    const nComp = contarSubs(porSub, proyecto.competidores);
    const compDistintos = (proyecto.complementarios || []).filter(s => (porSub[s] || 0) > 0).length;
    const compTotales = contarSubs(porSub, proyecto.complementarios);

    let demanda, competencia;
    if (proyecto.habXunidad > 0) {
      demanda = clamp(0, 100, 100 * stats.poblacionEstimada / (proyecto.habXunidad * 2));
      const ratio = stats.poblacionEstimada / ((nComp + 1) * proyecto.habXunidad);
      competencia = 100 * clamp(0, 1, ratio / 2);
    } else {
      // Proyectos inmobiliarios (residencial/mixto): la "demanda" es qué tan
      // servido está el sector y la "competencia" penaliza saturación de obras.
      demanda = clamp(0, 100, stats.movilidad.scoreAcceso * .5 + Math.min(50, compDistintos * 10));
      competencia = clamp(0, 100, 100 - 12 * nComp);
    }

    const complementarios = clamp(0, 100, 18 * compDistintos + 4 * compTotales);
    const movilidad = stats.movilidad.scoreAcceso;
    let entorno = Math.min(100, 25 * Math.min(stats.ambiente.parques, 2) +
      15 * (stats.ambiente.cuerposAgua > 0 ? 1 : 0) + stats.ambiente.scoreVerde * .35);
    if ((porSub.baldio_obra || 0) > 5) entorno = Math.max(0, entorno - 15);

    const pesos = proyecto.pesos || PESOS_DEFECTO;
    const subscores = {
      demanda: Math.round(demanda), competencia: Math.round(competencia),
      complementarios: Math.round(complementarios), movilidad: Math.round(movilidad),
      entorno: Math.round(entorno)
    };
    const score = Math.round(
      pesos.demanda * demanda + pesos.competencia * competencia +
      pesos.complementarios * complementarios + pesos.movilidad * movilidad +
      pesos.entorno * entorno);
    const nivel = score >= 70 ? 'Alta' : (score >= 45 ? 'Media' : 'Baja');
    return { score, nivel, subscores, nCompetidores: nComp, complementariosDistintos: compDistintos };
  }

  const NOMBRE_SUBSCORE = {
    demanda:'demanda poblacional', competencia:'nivel de competencia',
    complementarios:'usos complementarios del entorno', movilidad:'accesibilidad y movilidad',
    entorno:'calidad del entorno'
  };
  // Varias etiquetas son plurales ("usos complementarios del entorno"), así que
  // la plantilla fija "es su ___" producía "es su usos complementarios". Se
  // declara el número de cada una para concordar el verbo y el posesivo.
  const SUBSCORE_PLURAL = { complementarios: true };
  function concordarSubscore(k){
    return SUBSCORE_PLURAL[k] ? 'son sus ' + NOMBRE_SUBSCORE[k] : 'es su ' + NOMBRE_SUBSCORE[k];
  }

  // Plurales redactados en vez de "competidor(es) directo(s)": el informe se
  // le entrega a un cliente y ese paréntesis se lee como un formulario.
  function plural(n, sing, plur){ return n === 1 ? sing : plur; }

  // El uso predominante se guarda con la clave interna, que no siempre
  // funciona como adjetivo: "de carácter predominantemente servicios" está mal
  // construido. Cada clave declara cómo se redacta.
  const ETIQUETA_USO_PREDOMINANTE = {
    residencial:'residencial', comercial:'comercial', institucional:'institucional',
    servicios:'de servicios', industrial:'industrial', mixto:'mixto', ambiental:'ambiental'
  };

  function argumentosViabilidad(proyecto, ev, stats){
    const args = [];
    const s = ev.subscores;
    if (ev.nCompetidores === 0) args.push('No se identificó ningún competidor directo (' + proyecto.nombre.toLowerCase() + ') en el radio analizado: demanda sin atender.');
    else args.push('Se ' + plural(ev.nCompetidores, 'identificó', 'identificaron') + ' ' + ev.nCompetidores + ' ' +
      plural(ev.nCompetidores, 'competidor directo', 'competidores directos') + ' operando en el radio.');
    args.push('Población estimada en el área de influencia: ~' + stats.poblacionEstimada.toLocaleString('es-CO') + ' habitantes.');
    const mejor = Object.keys(s).reduce((a, b) => s[a] >= s[b] ? a : b);
    const peor = Object.keys(s).reduce((a, b) => s[a] <= s[b] ? a : b);
    args.push('El punto más fuerte del lote ' + concordarSubscore(mejor) + ' (' + s[mejor] + '/100).');
    if (s[peor] < 45) args.push('El punto más débil ' + concordarSubscore(peor) + ' (' + s[peor] + '/100).');
    if (stats.movilidad.nViasArterias > 0) {
      const vs = stats.movilidad.viasArterias.slice(0, 3).map(v => v.nombre);
      args.push('Acceso por ' + plural(vs.length, 'vía arteria', 'vías arterias') + ': ' + listar(vs, 3) + '.');
    }
    return args;
  }

  // Hay entidades públicas mal etiquetadas en OpenStreetMap: la "Agencia
  // Pública de Empleo SENA" viene como shop=supermarket, y el informe la citaba
  // como comercio ancla. No se puede arreglar en la taxonomía sin romper los
  // supermercados de verdad, así que se filtra al CITAR: un nombre de entidad
  // pública nunca se presenta como ancla comercial.
  const ENTIDAD_PUBLICA = /\b(sena|alcald[ií]a|gobernaci[oó]n|registradur[ií]a|fiscal[ií]a|procuradur[ií]a|defensor[ií]a|personer[ií]a|notar[ií]a|juzgado|icbf|dian|comisar[ií]a|inspecci[oó]n de polic[ií]a|agencia p[uú]blica)\b/i;
  function anclasComerciales(x){
    return x.n('supermercado').concat(x.n('centro_comercial'))
      .filter(n => !ENTIDAD_PUBLICA.test(n));
  }

  // ── FODA por reglas ─────────────────────────────────────────────────────
  // ctx = { stats, proyecto (o null), ev (o null), radioM }
  const REGLAS_FODA = [
    { t:'F', c: x => x.stats.movilidad.nViasArterias >= 1,
      f: x => 'Acceso directo a vía arteria (' + x.stats.movilidad.viasArterias.slice(0,2).map(v=>v.nombre).join(', ') + '): visibilidad y flujo vehicular constante.' },
    { t:'F', c: x => x.stats.movilidad.paradasBus >= 3,
      f: x => 'Buena cobertura de transporte público: ' + x.stats.movilidad.paradasBus + ' paradas dentro del radio.' },
    { t:'F', c: x => x.stats.ambiente.parques >= 2,
      f: x => { const n = listar(x.n('parque'), 3);
        return 'Oferta de espacio público consolidada: ' + x.stats.ambiente.parques + ' parques o zonas verdes cercanas' +
          (n ? ' (' + n + ')' : '') + ', un atractivo directo para residentes y visitantes.'; } },
    { t:'F', c: x => (x.stats.porGrupo.salud || 0) >= 3,
      f: x => { const n = listar(x.n('salud_ips').concat(x.n('salud_otro')), 3);
        return 'Clúster de salud consolidado (' + x.stats.porGrupo.salud + ' equipamientos' + (n ? ', entre ellos ' + n : '') +
          '): genera flujo diario de pacientes, acompañantes y personal médico durante todo el día.'; } },
    { t:'F', c: x => (x.stats.porGrupo.cultura || 0) >= 3,
      f: x => { const n = listar(x.n('universidad').concat(x.n('colegio')).concat(x.n('cultural')), 3);
        return 'Presencia educativa y cultural fuerte (' + x.stats.porGrupo.cultura + ' equipamientos' + (n ? ': ' + n : '') + ').'; } },
    { t:'F', c: x => anclasComerciales(x).length,
      f: x => 'El sector ya cuenta con comercio ancla (' + listar(anclasComerciales(x), 2) + '), que atrae compradores de fuera del barrio.' },
    { t:'F', c: x => x.n('agua').length > 0,
      f: x => 'Frente natural de valor paisajístico: ' + listar(x.n('agua'), 2) + ', un diferenciador para las vistas y el espacio público del proyecto.' },
    { t:'F', c: x => x.stats.densidadPorHa >= 1.5,
      f: x => 'Alta densidad de actividad urbana (' + x.stats.densidadPorHa + ' usos/ha): sector consolidado.' },
    { t:'F', c: x => (x.stats.porSub.banco || 0) >= 2,
      f: x => 'Presencia bancaria (' + x.stats.porSub.banco + ' puntos): indicador de dinamismo comercial.' },
    // ── Flujo: lo que decide un café ────────────────────────────────────
    { t:'F', c: x => x.stats.movilidad.flujo && x.stats.movilidad.flujo.peatonal >= 60,
      f: x => { const f = x.stats.movilidad.flujo;
        return 'Flujo peatonal alto (' + f.peatonal + '/100), con pico en ' + f.franjaFuerte +
          ': el formato de paso encuentra aquí su clientela sin tener que atraerla.'; } },
    { t:'F', c: x => x.stats.movilidad.flujo && x.stats.movilidad.flujo.dominante === 'peatonal' && (x.stats.porSub.parada_bus || 0) >= 2,
      f: x => 'El entorno se camina y hay ' + x.stats.porSub.parada_bus + ' paradas de transporte cerca: ' +
              'la gente llega a pie por su cuenta, sin depender de que decida conducir hasta acá.' },
    { t:'D', c: x => x.stats.movilidad.flujo && x.stats.movilidad.flujo.peatonal < 30,
      f: x => 'Flujo peatonal bajo (' + x.stats.movilidad.flujo.peatonal + '/100): casi nadie pasa por la puerta, ' +
              'así que el local tendría que ser destino y no hallazgo.' },
    { t:'D', c: x => x.stats.movilidad.flujo && x.stats.movilidad.flujo.dominante === 'vehicular' &&
                     !x.stats.movilidad.flujo.hayDondeParar,
      f: () => 'El entorno se mueve en carro y no hay parqueadero mapeado ni formatos que suelan traer el suyo: ' +
               'el flujo pasa de largo sin poder detenerse.' },
    // Tener dónde parar en un corredor vehicular es una oportunidad, no un
    // dato neutro: es lo que convierte tránsito en cliente.
    { t:'O', c: x => x.stats.movilidad.flujo && x.stats.movilidad.flujo.dominante === 'vehicular' &&
                     x.stats.movilidad.flujo.hayDondeParar,
      f: x => { const f2 = x.stats.movilidad.flujo;
                return 'El corredor tiene dónde detenerse (' +
                  (f2.parqueaderos ? f2.parqueaderos + ' parqueadero' + (f2.parqueaderos === 1 ? '' : 's') + ' mapeado' + (f2.parqueaderos === 1 ? '' : 's')
                                   : f2.parqueoProbable.map(q => q.nombre.toLowerCase()).slice(0, 3).join(', ')) +
                  '): el tránsito vehicular puede convertirse en visita.'; } },
    // La ubicación dentro del radio es una decisión aparte de si la zona sirve.
    { t:'O', c: x => x.stats.movilidad.flujo && x.stats.movilidad.flujo.consejoUbicacion,
      f: x => x.stats.movilidad.flujo.consejoUbicacion },
    { t:'O', c: x => x.stats.movilidad.flujo && x.stats.movilidad.flujo.franjas &&
                     x.stats.movilidad.flujo.franjas.manana >= 85 && x.proyecto && /caf/i.test(x.proyecto.nombre),
      f: () => 'El pico de flujo es matutino, que es exactamente la hora del café: la demanda coincide con la oferta.' },
    { t:'R', c: x => x.stats.movilidad.flujo && x.stats.movilidad.flujo.franjas &&
                     x.stats.movilidad.flujo.franjas.tarde < 40 && x.stats.movilidad.flujo.franjas.manana > 80,
      f: () => 'El flujo se desploma en la tarde: media jornada con costos fijos y poca venta.' },

    { t:'D', c: x => (x.stats.porGrupo.salud || 0) === 0 && x.radioM >= 500,
      f: x => 'No se identificaron servicios de salud en ' + x.radioM + ' m: el sector depende de equipamientos externos.' },
    { t:'D', c: x => x.stats.ambiente.scoreVerde < 20,
      f: () => 'Déficit de espacio público verde en el entorno inmediato.' },
    { t:'D', c: x => x.stats.movilidad.paradasBus === 0 && x.radioM >= 400,
      f: () => 'Sin paradas de transporte público identificadas: dependencia del vehículo particular.' },
    { t:'D', c: x => x.stats.movilidad.nViasArterias === 0 && x.radioM >= 400,
      f: () => 'El lote no cuenta con vía arteria en su radio inmediato: menor visibilidad comercial.' },
    { t:'D', c: x => (x.stats.porGrupo.cultura || 0) === 0 && x.radioM >= 500,
      f: () => 'Sin oferta educativa cercana identificada.' },
    { t:'D', c: x => x.stats.total < 10,
      f: () => 'Muy poca actividad urbana registrada en el radio: sector de baja consolidación (o con vacíos de datos en OpenStreetMap).' },
    { t:'O', c: x => x.stats.usoPredominante.residencial > 55 && x.ev && x.ev.nCompetidores === 0 && x.proyecto,
      f: x => 'Alta densidad residencial (' + x.stats.usoPredominante.residencial + '%) sin oferta de ' + x.proyecto.nombre.toLowerCase() + ': demanda cautiva estimada de ' + x.stats.poblacionEstimada.toLocaleString('es-CO') + ' habitantes.' },
    { t:'O', c: x => (x.stats.porSub.universidad || 0) > 0,
      f: x => { const n = listar(x.n('universidad'), 2);
        return 'La presencia de ' + (n || 'instituciones de educación superior') + ' genera población flotante joven con consumo diario en horario extendido.'; } },
    // Combinación educación + salud: es el argumento más fuerte de circulación
    // constante, porque cubren franjas horarias distintas.
    { t:'O', c: x => (x.stats.porSub.universidad || 0) > 0 && (x.stats.porGrupo.salud || 0) >= 2,
      f: x => 'Circulación constante durante todo el día: la educación superior mueve público en jornada diurna y nocturna, mientras los ' +
        x.stats.porGrupo.salud + ' equipamientos de salud del sector generan flujo desde muy temprano, incluidos fines de semana.' },
    { t:'O', c: x => (x.stats.porSub.colegio || 0) >= 2,
      f: x => { const n = listar(x.n('colegio'), 2);
        return (x.stats.porSub.colegio) + ' instituciones educativas cercanas' + (n ? ' (' + n + ')' : '') +
          ': demanda cautiva de familias en horarios de entrada y salida.'; } },
    { t:'O', c: x => (x.stats.porSub.banco || 0) >= 2,
      f: x => 'Corredor de servicios financieros (' + (listar(x.n('banco'), 2) || x.stats.porSub.banco + ' puntos bancarios') +
        '): indica un sector con movimiento económico formal y tráfico peatonal de trámites.' },
    { t:'O', c: x => (x.stats.porSub.baldio_obra || 0) >= 1 && (x.stats.porSub.baldio_obra || 0) <= 5,
      f: x => 'Sector en desarrollo (' + x.stats.porSub.baldio_obra + ' lotes en obra/baldíos): potencial de valorización a mediano plazo.' },
    { t:'O', c: x => x.stats.usoPredominante.comercial >= 35,
      f: x => 'Corredor comercial consolidado (' + x.stats.usoPredominante.comercial + '% del uso): tráfico peatonal garantizado.' },
    { t:'O', c: x => (x.stats.porGrupo.otro || 0) >= 3,
      f: x => x.stats.porGrupo.otro + ' usos sin clasificar en el entorno: oportunidad de levantamiento en campo con URBIS Pro City para completar la matriz.' },
    { t:'O', c: x => (x.stats.porSub.hotel || 0) >= 1 && (x.stats.porGrupo.institucional || 0) >= 1,
      f: () => 'Mezcla hotelera e institucional: población flotante de negocios y trámites.' },
    // El umbral estaba en 3 y saltaba "mercado saturado" junto a una viabilidad
    // ALTA en la misma hoja, que se lee como contradicción. Ahora distingue
    // competencia presente (informativa) de saturación real (>= 6).
    { t:'R', c: x => x.ev && x.ev.nCompetidores >= 6,
      f: x => 'Mercado saturado: ' + x.ev.nCompetidores + ' competidores directos operando en el radio analizado.' },
    { t:'R', c: x => x.ev && x.ev.nCompetidores >= 3 && x.ev.nCompetidores < 6,
      f: x => 'Competencia instalada: ' + x.ev.nCompetidores + ' competidores directos en el radio. ' +
        'No bloquea el proyecto, pero obliga a diferenciar la propuesta.' },
    { t:'R', c: x => (x.stats.porSub.baldio_obra || 0) > 5,
      f: x => 'Alta proporción de lotes baldíos u obras (' + x.stats.porSub.baldio_obra + '): sector en transición con incertidumbre normativa.' },
    { t:'R', c: x => x.stats.ambiente.cuerposAgua > 0,
      f: x => { const n = listar(x.n('agua'), 2);
        return 'Cercanía a ' + (n || 'cuerpos de agua') + ': verificar ronda hídrica y restricciones del POT antes de diseñar.'; } },
    { t:'R', c: x => (x.stats.porGrupo.industria || 0) >= 2 && x.proyecto && ['residencial','mixto','colegio','consultorios'].indexOf(x.proyecto.id) !== -1,
      f: () => 'Actividad industrial cercana: posible conflicto de usos con el proyecto propuesto (ruido, carga pesada).' },
    { t:'R', c: x => (x.stats.porSub.bar_ocio || 0) >= 3 && x.proyecto && ['residencial','colegio','consultorios'].indexOf(x.proyecto.id) !== -1,
      f: () => 'Concentración de ocio nocturno: puede afectar la compatibilidad con el uso propuesto.' },
    { t:'R', c: x => x.stats.total < 10,
      f: () => 'Los datos abiertos del sector son escasos: el análisis puede subestimar la actividad real; se recomienda verificación en campo.' },
    { t:'R', c: x => (x.stats.porGrupo.otro || 0) > 8,
      f: x => 'Muchos usos sin clasificar (' + x.stats.porGrupo.otro + '): la lectura del sector es incompleta, verificar en campo.' }
  ];

  function generarFODA(ctx){
    const foda = { fortalezas: [], debilidades: [], oportunidades: [], riesgos: [] };
    const destino = { F:'fortalezas', D:'debilidades', O:'oportunidades', R:'riesgos' };
    // x.n(sub) → nombres propios de esa subcategoría, para citar los lugares
    // concretos del entorno dentro de cada hallazgo.
    ctx.n = sub => ((ctx.stats.nombresPorSub || {})[sub] || []);
    REGLAS_FODA.forEach(r => {
      try { if (r.c(ctx)) foda[destino[r.t]].push(r.f(ctx)); } catch(e) {}
    });
    // Un FODA con un cuadrante vacío se imprimía como "Sin hallazgos
    // relevantes.", que ante un cliente resta credibilidad al documento
    // entero. Se rellena con la lectura real de por qué no hubo hallazgos.
    const s = ctx.stats;
    if (!foda.debilidades.length) {
      foda.debilidades.push('No se detectaron carencias graves de equipamiento ni de acceso en el radio analizado. ' +
        'Conviene igualmente verificar en campo la norma urbanística y el estado real de los predios vecinos.');
    }
    if (!foda.fortalezas.length) {
      foda.fortalezas.push('El sector no muestra atributos destacados en los datos abiertos disponibles: ' +
        'la ventaja del proyecto tendrá que construirse desde su propia propuesta, no desde el entorno.');
    }
    if (!foda.oportunidades.length) {
      foda.oportunidades.push('No se identificaron vacíos de oferta evidentes con los datos disponibles; ' +
        'un levantamiento en campo con URBIS Pro City puede revelar oportunidades que OpenStreetMap no registra.');
    }
    if (!foda.riesgos.length) {
      foda.riesgos.push('No se identificaron riesgos urbanos relevantes en el radio. ' +
        'Queda pendiente validar ronda hídrica, amenaza natural y norma vigente ante la autoridad competente.');
    }
    return foda;
  }

  function generarConclusion(ctx, viabilidad, ranking){
    const s = ctx.stats;
    const n = sub => ((s.nombresPorSub || {})[sub] || []);
    const usoTop = Object.keys(s.usoPredominante).reduce((a, b) => s.usoPredominante[a] >= s.usoPredominante[b] ? a : b);
    const frases = [];

    // 1) Qué es el sector.
    frases.push('El entorno analizado (' + ctx.radioM + ' m a la redonda, ~' + s.areaHa + ' ha) es de carácter predominantemente ' +
      (ETIQUETA_USO_PREDOMINANTE[usoTop] || usoTop) + ' (' + s.usoPredominante[usoTop] + '% de los usos), con ' + s.total.toLocaleString('es-CO') +
      ' usos identificados, una densidad de ' + s.densidadPorHa + ' usos por hectárea y ' +
      (s.poblacionEsCensal
        ? 'una población de ' + s.poblacionEstimada.toLocaleString('es-CO') +
          ' habitantes según el Censo DANE 2018'
        : 'una población estimada de ' + s.poblacionEstimada.toLocaleString('es-CO') + ' habitantes') +
      ' en el área de influencia.');

    // El estrato manda sobre el producto que conviene construir, así que va
    // arriba en la conclusión, no enterrado entre los indicadores.
    if (s.estrato) {
      const e = s.estrato;
      frases.push('El sector es de estrato ' + e.predominante +
        (e.minimo === e.maximo ? ' de forma homogénea' : ' predominante, con un rango de ' + e.minimo + ' a ' + e.maximo) +
        ' (Censo DANE 2018)' +
        (s.personasPorVivienda ? ', con ' + s.personasPorVivienda + ' personas por vivienda' : '') + '.');
    }
    if (s.demografia) {
      const d = s.demografia;
      frases.push('Su población es ' + d.pctMujeres + '% mujeres y ' + d.pctHombres + '% hombres, ' +
        'con el grupo de ' + d.tramoDominanteEtq.toLowerCase() + ' como el más numeroso' +
        (d.pctMayores >= 15 ? ' y un ' + d.pctMayores + '% de 65 años o más' : '') + '.');
    }

    // 2) Por qué el lote está bien ubicado (movilidad y visibilidad).
    if (s.movilidad.viaPrincipal) {
      frases.push('En movilidad, el lote presenta una exposición ' + s.movilidad.nivelExposicion.toLowerCase() +
        ' (' + s.movilidad.exposicion + '/100): está a ' + s.movilidad.viaPrincipal.distM + ' m de ' +
        s.movilidad.viaPrincipal.nombre + ', una vía ' + s.movilidad.viaPrincipal.jerarquia + ', lo que le da visibilidad directa sobre el tránsito del sector.');
    }

    // 3) Qué equipamientos sostienen la demanda, con nombre propio.
    const anclas = n('universidad').concat(n('salud_ips')).concat(n('centro_comercial')).concat(n('supermercado'))
      .filter(x => !ENTIDAD_PUBLICA.test(x));
    if (anclas.length) {
      frases.push('La demanda del sector se apoya en equipamientos ancla como ' + listar(anclas, 3) +
        ', que atraen población más allá del vecindario inmediato y sostienen actividad durante buena parte del día.');
    }

    // 4) Veredicto y qué hacer con él.
    if (viabilidad && ctx.proyecto) {
      frases.push('Para el proyecto propuesto (' + ctx.proyecto.nombre + '), la viabilidad se califica como ' +
        viabilidad.nivel.toUpperCase() + ' con ' + viabilidad.score + '/100.');
      if (viabilidad.nivel === 'Alta') {
        frases.push('En conjunto, el sector reúne las condiciones para implantar el proyecto: hay demanda poblacional, el entorno aporta usos complementarios y la accesibilidad respalda la operación. El siguiente paso recomendado es verificar la norma urbanística (POT) y la prefactibilidad financiera.');
      } else if (viabilidad.nivel === 'Media') {
        frases.push('El proyecto es defendible, pero su éxito dependerá de diferenciarse de la oferta existente y de validar la demanda en campo antes de comprometer inversión.');
      } else {
        frases.push('Las condiciones actuales no favorecen este uso en particular; conviene revisar las alternativas mejor calificadas o evaluar un radio de influencia distinto antes de descartar el lote.');
      }
    }
    if (ranking && ranking.length) {
      frases.push('El uso mejor calificado para este lote es ' + ranking[0].nombre + ' (' + ranking[0].score + '/100)' +
        (ranking[1] ? ', seguido de ' + ranking[1].nombre + ' (' + ranking[1].score + '/100)' : '') + '.');
    }

    frases.push('Este análisis es una estimación heurística sobre datos abiertos de OpenStreetMap; no reemplaza el estudio de norma urbana (POT) ni el estudio de mercado formal.');
    return frases.join(' ');
  }

  // ── Análisis completo (proveedor por defecto) ───────────────────────────
  // entrada = { elementos, radioM, centro:{lat,lng}, proyectoId, tipoEstudio, direccionAprox }
  function analizarHeuristico(entrada){
    const elementos = filtrarPorRadio(entrada.elementos, entrada.radioM, entrada.centro);
    const stats = calcularStats(elementos, entrada.radioM, entrada.centro, entrada.dane);
    const esRanking = !entrada.proyectoId || entrada.proyectoId === 'recomendar';
    const proyecto = esRanking ? null : PROYECTOS.find(p => p.id === entrada.proyectoId) || null;

    // Con el proyecto ya elegido, el consejo de ubicación se recalcula: puede
    // cambiar de ancla si hay una complementaria del uso propuesto.
    if (stats.movilidad && stats.movilidad.flujo) {
      fijarConsejoUbicacion(stats.movilidad.flujo, proyecto);
    }

    let viabilidad = null, ranking = null, ev = null;
    if (proyecto) {
      ev = scoreProyecto(proyecto, stats);
      viabilidad = { score: ev.score, nivel: ev.nivel, subscores: ev.subscores,
                     argumentos: argumentosViabilidad(proyecto, ev, stats) };
    } else {
      ranking = PROYECTOS.map(p => {
        const e = scoreProyecto(p, stats);
        const razon = e.nCompetidores === 0
          ? 'Sin competencia directa y ' + NOMBRE_SUBSCORE[Object.keys(e.subscores).reduce((a,b)=>e.subscores[a]>=e.subscores[b]?a:b)] + ' favorable.'
          : e.nCompetidores + ' ' + plural(e.nCompetidores, 'competidor', 'competidores') +
            '; pesa a favor su ' + NOMBRE_SUBSCORE[Object.keys(e.subscores).reduce((a,b)=>e.subscores[a]>=e.subscores[b]?a:b)] + '.';
        return { proyectoId: p.id, nombre: p.nombre, icono: p.icono, score: e.score, nivel: e.nivel, razon };
      }).sort((a, b) => b.score - a.score).slice(0, 6);
    }

    // Los usos que no calzaron con la taxonomía se archivan solos para poder
    // revisarlos después y decidir su categoría (o crear una nueva).
    registrarPendientes(stats.pois, { zona: entrada.direccionAprox || '' });

    const ctx = { stats, proyecto, ev, radioM: entrada.radioM };
    const foda = generarFODA(ctx);
    const conclusion = generarConclusion(ctx, viabilidad, ranking);

    return {
      meta: {
        lat: entrada.centro.lat, lng: entrada.centro.lng, radioM: entrada.radioM,
        fechaISO: new Date().toISOString(), tipoEstudio: entrada.tipoEstudio || 'completo',
        proyectoId: proyecto ? proyecto.id : 'recomendar',
        proyectoNombre: proyecto ? proyecto.nombre : 'Recomendación de uso',
        direccionAprox: entrada.direccionAprox || '',
        modo: proyecto ? 'viabilidad' : 'ranking'
      },
      pois: stats.pois, stats, viabilidad, ranking, foda, conclusion,
      indicadores: calcularIndicadores(stats, proyecto ? [{ id: proyecto.id }] : []),
      multiRadio: compararRadios(elementos, entrada.radioM, entrada.centro, entrada.danePorRadio)
    };
  }

  // Proveedor intercambiable: en el futuro se enchufa Claude API con
  // AIA_MOTOR.setProveedor({ analizar: async (entrada) => resultado }).
  let proveedor = { analizar: entrada => Promise.resolve(analizarHeuristico(entrada)) };

  // ═══════════════════════════════════════════════════════════════════════
  // MODO MIXTO — planificador de proyectos con varios usos combinados.
  // Todo lo de abajo es ADITIVO: no toca PROYECTOS/scoreProyecto/
  // analizarHeuristico, que siguen usándose tal cual en el modo de un solo
  // proyecto. Reutiliza calcularStats() y generarFODA() ya existentes.
  // ═══════════════════════════════════════════════════════════════════════

  // Catálogo del Constructor: exactamente los 10 usos pedidos. `subs` son
  // las subcategorías de TAXONOMIA que cuentan como oferta similar/directa
  // para ese uso; `complementarios` son las que le suman valor si están cerca.
  const USOS_PROGRAMA = [
    // Vivienda: a diferencia de un negocio puntual, más vivienda EXISTENTE
    // no es "competencia" — es señal de demanda sana. Por eso, igual que el
    // proyecto "Edificio residencial" del modo simple, su competidor real es
    // el suelo baldío/en obra (sobreoferta de inventario), no `residencial`.
    { id:'vivienda',     nombre:'Vivienda',     icono:'🏠', subs:['residencial'], competidores:['baldio_obra'], complementarios:['parque','colegio','supermercado','tienda_barrio','salud_ips','parada_bus'], contable:true, unidad:'viviendas' },
    { id:'comercio',     nombre:'Comercio',     icono:'🛍️', subs:['supermercado','tienda_descuento','tienda_barrio','local_comercial','comercio_otro','centro_comercial'], complementarios:['residencial','parada_bus','oficina'], contable:true, unidad:'locales comerciales' },
    { id:'oficinas',     nombre:'Oficinas',     icono:'💼', subs:['oficina'], complementarios:['banco','restaurante','cafeteria','parada_bus'], contable:true, unidad:'oficinas' },
    { id:'hotel',        nombre:'Hotel',        icono:'🏨', subs:['hotel'], complementarios:['restaurante','cultural','gobierno'], contable:true, unidad:'habitaciones' },
    { id:'consultorios', nombre:'Consultorios', icono:'🩺', subs:['salud_ips'], complementarios:['drogueria','laboratorio'], contable:true, unidad:'consultorios' },
    { id:'coworking',    nombre:'Coworking',    icono:'🧑‍💻', subs:['oficina'], complementarios:['universidad','cafeteria'] },
    { id:'educacion',    nombre:'Educación',    icono:'🎓', subs:['colegio','universidad','capacitacion'], complementarios:['residencial','parque'] },
    { id:'salud',        nombre:'Salud',        icono:'🚑', subs:['salud_ips','drogueria','laboratorio'], complementarios:['residencial'] },
    { id:'turismo',      nombre:'Turismo',      icono:'🧳', subs:['hotel','cultural'], complementarios:['restaurante','cafeteria'] },
    { id:'servicios',    nombre:'Servicios',    icono:'🚛', subs:['infra_servicios','transporte','mobiliario'], complementarios:['residencial','oficina'] },
    // Ampliación (pedido explícito): catálogo completo alineado con la
    // Matriz de Usos de URBIS, filtrando solo lo que es programa
    // arquitectónico real (se excluyó clasificación de suelo como baldíos,
    // ronda hídrica o zonas de riesgo, que no son algo que se construya).
    { id:'bar',          nombre:'Bar',          icono:'🍻', subs:['bar_ocio'], complementarios:['residencial','oficina'] },
    { id:'cafeteria',    nombre:'Cafetería',    icono:'☕', subs:['cafeteria'], complementarios:['oficina','universidad'] },
    { id:'restaurante',  nombre:'Restaurante',  icono:'🍽️', subs:['restaurante'], complementarios:['oficina','hotel'] },
    // Espacio Público: a diferencia de un negocio, más parques/plazas
    // existentes es un ATRACTIVO del entorno, no competencia — mismo criterio
    // que se usó para "vivienda". No incluye andenes (no medible por satélite).
    { id:'espacio_publico', nombre:'Espacio Público', icono:'🌳', subs:['parque'], competidores:['baldio_obra'], complementarios:['residencial','comercio_otro'] },
    { id:'supermercado', nombre:'Supermercado', icono:'🛒', subs:['supermercado','tienda_descuento','centro_comercial'], complementarios:['residencial'] },
    { id:'gimnasio',     nombre:'Gimnasio / Deportivo', icono:'🏋️', subs:['gimnasio','deportivo'], complementarios:['residencial'] },
    { id:'parqueadero',  nombre:'Parqueadero',  icono:'🅿️', subs:['transporte'], complementarios:['comercio_otro','oficina'], contable:true, unidad:'cupos de parqueo' },
    // Cajero bancario: comparte la sub 'banco' de la Matriz (amenity=atm ya
    // cae ahí), pero como programa se instala de a varios, así que es contable.
    { id:'cajero',       nombre:'Cajero bancario', icono:'🏧', subs:['banco'], complementarios:['supermercado','centro_comercial','oficina','residencial','universidad'], contable:true, unidad:'cajeros' },
    { id:'industria',    nombre:'Industria / Bodega', icono:'🏭', subs:['industria','bodega'], complementarios:['transporte'] },
    { id:'cultural',     nombre:'Cultural',     icono:'🎭', subs:['cultural'], complementarios:['universidad','restaurante'] },
    { id:'cuidado',      nombre:'Centro de Cuidado', icono:'🧓', subs:[], complementarios:['residencial','salud_ips'] },
    { id:'religioso',    nombre:'Religioso / Culto', icono:'⛪', subs:['iglesia'], complementarios:['residencial'] },
    { id:'gubernamental',nombre:'Gubernamental', icono:'🏛️', subs:['gobierno'], complementarios:['notaria','banco'] },
    { id:'militar',      nombre:'Militar / Policial', icono:'🚓', subs:['policia'], complementarios:[] },
    { id:'judicial',     nombre:'Judicial', icono:'⚖️', subs:['notaria'], complementarios:['gobierno'] },
    // Usos "por definir": para cuando ya se sabe que habrá N unidades
    // comerciales o de oficina en arriendo, pero aún no qué negocio
    // específico irá en cada una. El score general usa la misma lógica
    // amplia de comercio/oficina; además disparan una recomendación
    // específica por unidad (ver recomendarUnidadesGenericas más abajo).
    { id:'comercial_indefinido', nombre:'Comercial (por definir)', icono:'🔍🛍️', generico:true, familia:'comercial', subs:['comercio_otro','local_comercial'], complementarios:['residencial','oficina'] },
    { id:'oficina_indefinida',   nombre:'Oficina (por definir)',   icono:'🔍💼', generico:true, familia:'oficina',   subs:['oficina'], complementarios:['banco','restaurante'] }
  ];

  // Candidatos concretos por familia genérica — reutiliza los mismos
  // proyectos evaluables del modo simple (PROYECTOS, definido más abajo).
  const FAMILIAS_GENERICAS = {
    comercial: ['drogueria', 'cafeteria', 'restaurante', 'supermercado'],
    oficina: ['oficinas', 'coworking', 'consultorios']
  };

  function slugUso(nombre){
    return String(nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
      .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40) || 'uso';
  }

  // Convierte lo elegido en el Constructor (ids del catálogo + nombres libres)
  // en objetos de uso completos. Nunca falla: un texto libre que no calza con
  // el catálogo se vuelve un uso personalizado con fallback genérico.
  function normalizarUsos(seleccion){
    return (seleccion || []).map(item => {
      if (typeof item === 'string') {
        const delCatalogo = USOS_PROGRAMA.find(u => u.id === item);
        if (delCatalogo) return Object.assign({ esCustom:false }, delCatalogo);
        return { id:'custom_' + slugUso(item), nombre: item, icono:'✨', subs:[], complementarios:[], esCustom:true };
      }
      return item;
    });
  }

  // Generaliza scoreProyecto() para el catálogo + usos personalizados.
  // Con subs conocidos: misma lógica de siempre. Sin subs (custom): fallback
  // neutro que nunca rompe el análisis, y calcula "complementarios" contra
  // los OTROS usos del mismo programa (no hay dato externo que consultar).
  function scoreUso(uso, stats, otrosUsos, config){
    const porSub = stats.porSub || {};
    if (uso.subs && uso.subs.length) {
      const proyectoEquivalente = { id: uso.id, nombre: uso.nombre, habXunidad: 4000,
        competidores: uso.competidores || uso.subs, complementarios: uso.complementarios };
      const ev = scoreProyecto(proyectoEquivalente, stats);
      return ajustePorConfiguracion(uso, ev, stats, config);
    }
    // Uso personalizado: sin catálogo de OSM al que compararlo.
    const compDistintos = (otrosUsos || []).filter(o => o.id !== uso.id &&
      (uso.complementarios || []).some(s => o.subs && o.subs.indexOf(s) !== -1)).length;
    const subscores = {
      demanda: Math.round(clamp(30, 80, stats.densidadPorHa * 15 + 30)),
      competencia: 70,
      complementarios: Math.round(clamp(30, 90, 40 + compDistintos * 15)),
      movilidad: Math.round(stats.movilidad.scoreAcceso),
      entorno: Math.round(Math.min(100, 25 * Math.min(stats.ambiente.parques, 2) + stats.ambiente.scoreVerde * .35))
    };
    const score = Math.round(
      PESOS_DEFECTO.demanda * subscores.demanda + PESOS_DEFECTO.competencia * subscores.competencia +
      PESOS_DEFECTO.complementarios * subscores.complementarios + PESOS_DEFECTO.movilidad * subscores.movilidad +
      PESOS_DEFECTO.entorno * subscores.entorno);
    const nivel = score >= 70 ? 'Alta' : (score >= 45 ? 'Media' : 'Baja');
    return { score, nivel, subscores, nCompetidores: 0 };
  }

  // Enriquece el score con los datos del Constructor (Configuración del
  // edificio): si el proyecto ya declara sus propias unidades, se descuenta
  // un poco de "demanda" proporcional a cuánta oferta propia añade —
  // autocompetencia. Deliberadamente suave: es una señal, no una certeza.
  const HAB_X_UNIDAD_PROPIA = {
    vivienda: 3.5,        // una vivienda aloja ~3.5 personas
    comercio: 1200,       // un local de barrio se sostiene con ~1.200 habitantes
    oficinas: 1500,
    hotel: 250,           // por habitación
    consultorios: 2500,
    parqueadero: 30,      // un cupo es apoyo, no un negocio: peso bajo a propósito
    cajero: 800,           // un cajero es un punto de servicio, no una sucursal
    comercial_indefinido: 1200,
    oficina_indefinida: 1500
  };

  function ajustePorConfiguracion(uso, ev, stats, config){
    config = config || {};
    const claves = { vivienda:'apartamentos', oficinas:'oficinas', comercio:'localesComerciales',
      hotel:'habitacionesHotel', consultorios:'consultorios' };
    // La cantidad declarada en el chip (ej. "Vivienda ×40") vale igual que el
    // campo del formulario: si el usuario ya dijo cuántas unidades pone, esa
    // oferta propia entra en la autocompetencia aunque no llene la ficha.
    const unidadesPropias = Number(config[claves[uso.id]] || 0) || Number(uso.cantidad || 0);
    if (unidadesPropias <= 1) return ev;
    // Cuánto mercado consume UNA unidad propia, en habitantes. No es lo mismo
    // un cupo de parqueo que un local comercial: con un valor plano, 60 cupos
    // castigaban igual que 60 supermercados, que es absurdo.
    const habXunidad = HAB_X_UNIDAD_PROPIA[uso.id] || 4000;
    const factorAuto = clamp(0, 25, (unidadesPropias * habXunidad) / Math.max(stats.poblacionEstimada, 1) * 25);
    const demandaAjustada = clamp(0, 100, ev.subscores.demanda - factorAuto);
    const subscores = Object.assign({}, ev.subscores, { demanda: Math.round(demandaAjustada) });
    const score = Math.round(
      PESOS_DEFECTO.demanda * subscores.demanda + PESOS_DEFECTO.competencia * subscores.competencia +
      PESOS_DEFECTO.complementarios * subscores.complementarios + PESOS_DEFECTO.movilidad * subscores.movilidad +
      PESOS_DEFECTO.entorno * subscores.entorno);
    const nivel = score >= 70 ? 'Alta' : (score >= 45 ? 'Media' : 'Baja');
    return Object.assign({}, ev, { score, nivel, subscores });
  }

  // ── Compatibilidad entre usos ────────────────────────────────────────────
  const USOS_TRANQUILOS = ['vivienda', 'educacion', 'salud'];
  const USOS_ACTIVOS = ['comercio', 'oficinas', 'hotel', 'turismo', 'coworking'];
  const COMPAT_OVERRIDES = {
    'comercio|vivienda': { e:5, m:'Excelente sinergia: el comercio de proximidad sirve directamente a los residentes.' },
    'coworking|oficinas': { e:5, m:'Combinación natural: el coworking absorbe demanda flexible que complementa oficinas tradicionales.' },
    'comercio|turismo': { e:5, m:'El comercio da vida y consumo constante al flujo turístico/hotelero.' },
    'comercio|consultorios': { e:4, m:'Buena sinergia: pacientes y acompañantes generan consumo comercial cercano.' },
    'comercio|hotel': { e:4, m:'El comercio en planta baja complementa bien la operación hotelera.' },
    'educacion|salud': { e:4, m:'Ambos son usos institucionales tranquilos, compatibles y sin conflicto de horarios.' },
    'consultorios|salud': { e:4, m:'Refuerzan el mismo clúster de servicios de salud del sector.' },
    'oficinas|vivienda': { e:3, m:'Compatible pero sin sinergia directa: horarios de uso distintos (día vs. noche).' },
    'servicios|vivienda': { e:3, m:'Neutral: depende del tipo de servicio, verificar que no genere ruido o tráfico pesado.' },
    'hotel|vivienda': { e:3, m:'Compatible, aunque el flujo turístico puede afectar la tranquilidad residencial.' },
    'coworking|vivienda': { e:4, m:'Tendencia actual "vivir y trabajar cerca": buena sinergia con residentes jóvenes.' },
    'turismo|educacion': { e:3, m:'Neutral: no hay conflicto directo, pero tampoco sinergia fuerte.' }
  };
  function calcularCompatibilidad(idA, idB){
    const key = [idA, idB].sort().join('|');
    if (COMPAT_OVERRIDES[key]) return { estrellas: COMPAT_OVERRIDES[key].e, motivo: COMPAT_OVERRIDES[key].m };
    let estrellas = 3;
    const usoA = USOS_PROGRAMA.find(u => u.id === idA), usoB = USOS_PROGRAMA.find(u => u.id === idB);
    if (usoA && usoB) {
      const sinergiaAB = (usoA.complementarios || []).some(s => (usoB.subs || []).indexOf(s) !== -1);
      const sinergiaBA = (usoB.complementarios || []).some(s => (usoA.subs || []).indexOf(s) !== -1);
      if (sinergiaAB || sinergiaBA) estrellas++;
      if ((USOS_TRANQUILOS.indexOf(idA) !== -1 && USOS_TRANQUILOS.indexOf(idB) !== -1) ||
          (USOS_ACTIVOS.indexOf(idA) !== -1 && USOS_ACTIVOS.indexOf(idB) !== -1)) estrellas++;
    }
    estrellas = Math.max(1, Math.min(5, estrellas));
    return { estrellas, motivo: estrellas >= 4
      ? 'Compatibilidad favorable: los usos se complementan sin conflictos evidentes.'
      : 'Compatibilidad neutra: no se identifican conflictos evidentes; valida con la normativa POT.' };
  }
  function generarCompatibilidad(usos){
    const pares = [];
    for (let i = 0; i < usos.length; i++) {
      for (let j = i + 1; j < usos.length; j++) {
        const a = usos[i], b = usos[j];
        const c = (a.esCustom || b.esCustom)
          ? { estrellas: 3, motivo: 'Uso personalizado: compatibilidad estimada por defecto, valida con la normativa POT.' }
          : calcularCompatibilidad(a.id, b.id);
        pares.push({ usoA: a.nombre, iconoA: a.icono, usoB: b.nombre, iconoB: b.icono, estrellas: c.estrellas, motivo: c.motivo });
      }
    }
    return pares;
  }

  // ── Recomendaciones tipo consultor ──────────────────────────────────────
  const REGLAS_RECOMENDACION = [
    { c: x => x.tiene('oficinas') && !x.tiene('coworking'),
      f: () => 'Agregar coworking complementaría las oficinas y diversificaría el tipo de usuario que atrae el proyecto.' },
    { c: x => x.tiene('vivienda') && !x.tiene('comercio'),
      f: () => 'Agregar comercio en primer piso incrementaría la actividad urbana y el valor percibido del proyecto.' },
    { c: x => x.tiene('vivienda') && !x.tiene('salud') && !x.tiene('consultorios') && x.stats.poblacionEstimada > 4000,
      f: () => 'Agregar consultorios o salud aumentaría la demanda: la población estimada del sector ya lo justifica.' },
    { c: x => x.tiene('oficinas') && !x.tiene('consultorios') && (x.stats.porGrupo.salud || 0) < 2,
      f: () => 'Agregar consultorios diversificaría el flujo de visitantes de las oficinas y aprovecharía el déficit de salud del sector.' },
    { c: x => x.tiene('hotel') && x.scoreDe('hotel') < 45,
      f: () => 'El componente hotelero muestra viabilidad baja en este entorno: eliminarlo o reducir su proporción mejoraría la rentabilidad del conjunto.' },
    { c: x => x.usos.length >= 3 && x.usos.some(u => x.scoreDe(u.id) < 40),
      f: x => { const debil = x.usos.find(u => x.scoreDe(u.id) < 40); return 'El uso "' + debil.nombre + '" tiene el desempeño más bajo del programa (' + x.scoreDe(debil.id) + '/100): considera reducir su proporción o reemplazarlo.'; } },
    { c: x => x.tiene('hotel') && !x.tiene('turismo') && (x.stats.porSub.cultural || 0) > 0,
      f: () => 'Hay atractivos culturales cerca sin componente turístico explícito: sumar turismo reforzaría el hotel.' },
    { c: x => x.tiene('coworking') && !x.tiene('comercio'),
      f: () => 'Agregar una cafetería o comercio pequeño complementaría muy bien el coworking (es de los pares con mejor compatibilidad).' },
    { c: x => x.tiene('vivienda') && (x.stats.ambiente.scoreVerde || 0) < 20,
      f: () => 'El entorno tiene poco espacio verde: reservar zonas comunes o terrazas verdes fortalecería el componente residencial.' },
    { c: x => x.tiene('comercio') && (x.stats.movilidad.paradasBus || 0) === 0,
      f: () => 'El comercio propuesto no tiene transporte público cercano: valida el acceso vehicular y de parqueo antes de dimensionar el área comercial.' },
    { c: x => x.tiene('educacion') && !x.tiene('vivienda') && (x.stats.usoPredominante.residencial || 0) > 50,
      f: () => 'El sector es mayoritariamente residencial: sumar vivienda al programa aprovecharía mejor esa demanda ya existente.' },
    { c: x => x.usos.length === 1,
      f: x => 'Con un solo uso (' + x.usos[0].nombre + ') el proyecto no aprovecha sinergias de proyecto mixto: usa el Constructor para combinarlo con un uso complementario.' },
    { c: x => x.tiene('servicios') && x.usos.length >= 2 && x.scoreDe('servicios') < 50,
      f: () => 'El componente de servicios tiene bajo desempeño en este punto: verifica que sea realmente necesario o reubícalo a un lote de menor exigencia comercial.' }
  ];
  // Reparte `cantidad` unidades entre los mejores candidatos de la familia,
  // proporcional al score de cada uno (reparto por método de resto mayor
  // para que la suma cuadre exacto con `cantidad`).
  function recomendarUnidadesGenericas(uso, stats, cantidad){
    const ids = FAMILIAS_GENERICAS[uso.familia] || [];
    const n = Math.max(1, Number(cantidad) || 1);
    const candidatos = ids.map(id => PROYECTOS.find(p => p.id === id)).filter(Boolean)
      .map(p => { const ev = scoreProyecto(p, stats); return { id: p.id, nombre: p.nombre, icono: p.icono, score: ev.score, nivel: ev.nivel }; })
      .sort((a, b) => b.score - a.score);
    if (!candidatos.length) return [];
    const pesoTotal = candidatos.reduce((s, c) => s + Math.max(c.score, 1), 0);
    let exactos = candidatos.map(c => (n * Math.max(c.score, 1)) / pesoTotal);
    let base = exactos.map(Math.floor);
    let asignado = base.reduce((a, b) => a + b, 0);
    let restante = n - asignado;
    const ordenResto = exactos.map((v, i) => ({ i, resto: v - base[i] })).sort((a, b) => b.resto - a.resto);
    for (let k = 0; k < restante; k++) base[ordenResto[k % ordenResto.length].i]++;
    return candidatos.map((c, i) => Object.assign({}, c, { unidadesSugeridas: base[i] })).filter(c => c.unidadesSugeridas > 0);
  }

  function generarRecomendaciones(usos, stats, desglosePorUso){
    const mapaScore = {}; desglosePorUso.forEach(d => { mapaScore[d.id] = d.score; });
    const ctx = {
      usos, stats,
      tiene: id => usos.some(u => u.id === id),
      scoreDe: id => mapaScore[id] != null ? mapaScore[id] : 50
    };
    const out = [];
    REGLAS_RECOMENDACION.forEach(r => { try { if (r.c(ctx)) out.push(r.f(ctx)); } catch(e) {} });
    // Todas las reglas son del tipo "agregue X si falta" / "quite X si rinde
    // poco": con un programa mixto bien armado no dispara ninguna y la sección
    // desaparecía del informe, dejando una columna en blanco. Estas
    // confirmaciones cierran ese hueco con lectura útil, no con relleno.
    if (!out.length) {
      const flojos = desglosePorUso.filter(d => d.score < 50);
      const fuerte = desglosePorUso.slice().sort((a, b) => b.score - a.score)[0];
      if (usos.length >= 3) {
        out.push('El programa está equilibrado: ninguno de los ' + usos.length +
          ' usos propuestos entra en conflicto con el entorno ni duplica oferta ya saturada.');
      }
      if (fuerte) {
        out.push('Priorice ' + fuerte.nombre.toLowerCase() + ' al definir áreas: es el uso con mejor desempeño del programa (' +
          fuerte.score + '/100) y conviene darle la mejor fachada y acceso.');
      }
      if (flojos.length) {
        out.push('Vigile ' + listar(flojos.map(d => d.nombre.toLowerCase()), 2) +
          ': ' + plural(flojos.length, 'se sostiene', 'se sostienen') +
          ' por debajo de 50/100, así que conviene dimensionar ' + plural(flojos.length, 'ese componente', 'esos componentes') + ' con prudencia.');
      }
      out.push('Siguiente paso: contrastar este programa con la norma urbanística (POT) del predio y con un estudio de precios de la zona.');
    }
    return out;
  }

  // entrada = { elementos, radioM, centro, tipoEstudio, direccionAprox,
  //             usos:[id|string|usoObj,...], config:{...} }
  function analizarMixto(entrada){
    const elementos = filtrarPorRadio(entrada.elementos, entrada.radioM, entrada.centro);
    const stats = calcularStats(elementos, entrada.radioM, entrada.centro, entrada.dane);
    const usos = normalizarUsos(entrada.usos);
    const config = entrada.config || {};

    const desglosePorUso = usos.map(u => {
      const ev = scoreUso(u, stats, usos, config);
      return { id: u.id, nombre: u.nombre, icono: u.icono, score: ev.score, nivel: ev.nivel, subscores: ev.subscores };
    });
    const scorePromedio = desglosePorUso.length
      ? Math.round(desglosePorUso.reduce((a, d) => a + d.score, 0) / desglosePorUso.length) : 0;
    const nivelConjunto = scorePromedio >= 70 ? 'Alta' : (scorePromedio >= 45 ? 'Media' : 'Baja');
    const argumentos = desglosePorUso
      .slice().sort((a, b) => b.score - a.score)
      .map(d => d.icono + ' ' + d.nombre + ': ' + d.score + '/100 (' + d.nivel + ').');
    const viabilidad = { score: scorePromedio, nivel: nivelConjunto, subscores: null, argumentos };

    registrarPendientes(stats.pois, { zona: entrada.direccionAprox || '' });

    const compatibilidad = generarCompatibilidad(usos);
    const recomendaciones = generarRecomendaciones(usos, stats, desglosePorUso);

    // Recomendación de negocio específico para cada uso "por definir".
    const recomendacionesUnidades = usos.filter(u => u.generico).map(u => ({
      usoId: u.id, usoNombre: u.nombre, icono: u.icono, cantidad: u.cantidad || 1,
      opciones: recomendarUnidadesGenericas(u, stats, u.cantidad || 1)
    }));

    const nombreProgramaJunto = usos.map(u => u.nombre).join(' + ') || 'Proyecto mixto';
    const ctx = { stats, proyecto: { nombre: nombreProgramaJunto, id: 'mixto_custom' }, ev: null, radioM: entrada.radioM };
    const foda = generarFODA(ctx);
    // Reglas FODA adicionales propias del modo mixto (sinergias/conflictos entre usos elegidos).
    if (usos.some(u => u.id === 'vivienda') && usos.some(u => u.id === 'comercio')) {
      foda.fortalezas.push('La combinación Vivienda + Comercio genera actividad urbana constante durante todo el día.');
    }
    if (usos.length >= 3) {
      foda.oportunidades.push('Un programa con ' + usos.length + ' usos diversifica el riesgo del proyecto frente a cambios de mercado en un solo sector.');
    }
    const debil = desglosePorUso.find(d => d.nivel === 'Baja');
    if (debil) foda.riesgos.push('El uso "' + debil.nombre + '" muestra viabilidad baja de forma individual (' + debil.score + '/100) en este entorno.');

    const conclusion = generarConclusion(ctx, viabilidad, null) +
      (recomendaciones.length ? ' Recomendación principal: ' + recomendaciones[0] : '');

    return {
      meta: {
        lat: entrada.centro.lat, lng: entrada.centro.lng, radioM: entrada.radioM,
        fechaISO: new Date().toISOString(), tipoEstudio: entrada.tipoEstudio || 'completo',
        proyectoId: 'mixto', proyectoNombre: nombreProgramaJunto,
        direccionAprox: entrada.direccionAprox || '', modo: 'mixto'
      },
      pois: stats.pois, stats, viabilidad, ranking: null, foda, conclusion,
      indicadores: calcularIndicadores(stats, usos),
      multiRadio: compararRadios(elementos, entrada.radioM, entrada.centro, entrada.danePorRadio),
      modo: 'mixto', usos, config, desglosePorUso, compatibilidad, recomendaciones, recomendacionesUnidades,
      // Promedio de la compatibilidad entre todos los pares de usos: es el
      // dato que se muestra en grande (en estrellas) en el informe.
      compatibilidadGlobal: compatibilidad.length
        ? { estrellas: Math.round(compatibilidad.reduce((a, c) => a + c.estrellas, 0) / compatibilidad.length), pares: compatibilidad.length }
        : null
    };
  }

  window.AIA_MOTOR = {
    clasificarPOI, calcularStats, haversineM,
    analizar: entrada => proveedor.analizar(entrada),
    analizarHeuristico,
    setProveedor: p => { if (p && typeof p.analizar === 'function') proveedor = p; },
    TAXONOMIA, PROYECTOS, GRUPOS, GRUPO_COLOR,
    // Modo mixto (aditivo, no afecta lo anterior)
    USOS_PROGRAMA, normalizarUsos, scoreUso, calcularCompatibilidad,
    generarCompatibilidad, generarRecomendaciones, analizarMixto, recomendarUnidadesGenericas,
    leerReglasPersonalizadas, guardarReglaPersonalizada, calcularIndicadores,
    compararRadios, RADIOS_COMPARATIVA, filtrarPorRadio, normalizarNombre,
    // Bandeja de usos sin categoría: se llena sola en cada análisis.
    leerPendientes, registrarPendientes, exportarPendientes, resumenPendientes,
    resolverPendiente, descartarPendiente, olvidarPendientes
  };
})();
