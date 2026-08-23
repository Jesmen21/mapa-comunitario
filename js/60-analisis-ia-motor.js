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
    { sub:'laboratorio',     nombre:'Laboratorio',          grupo:'salud',        icono:'🧪', m:{ healthcare:/^(laboratory|blood_donation|sample_collection)$/, amenity:/^blood_donation$/ } },
    { sub:'salud_ips',       nombre:'IPS / Clínica',        grupo:'salud',        icono:'🏥', m:{ amenity:/^(hospital|clinic|doctors|dentist|health_post)$/, healthcare:/^(hospital|clinic|doctor|dentist|centre|midwife|physiotherapist)$/, building:/^(hospital|clinic)$/ } },
    // Hogar geriátrico / casa de cuidado: no es una IPS (no atiende urgencias
    // ni consulta externa) pero sí concentra población dependiente y visitas
    // diarias. Separarlo cambia la lectura del entorno: demanda de droguería,
    // de transporte especial y de comercio de proximidad, no de comercio de paso.
    { sub:'hogar_cuidado',   nombre:'Hogar geriátrico / cuidado', grupo:'salud',  icono:'🧓', m:{ amenity:/^nursing_home$/, healthcare:/^rehabilitation$/ } },
    { sub:'veterinaria',     nombre:'Veterinaria',          grupo:'salud',        icono:'🐾', m:{ amenity:/^(veterinary|veterinary_pharmacy|animal_shelter|animal_boarding)$/, shop:/^(pet|pet_grooming|veterinary)$/ } },
    { sub:'bomberos',        nombre:'Bomberos / Rescate',   grupo:'salud',        icono:'🚒', m:{ amenity:/^(fire_station|ambulance_station)$/, building:/^fire_station$/ } },
    // Comodín de salud: terapias, especialidades y healthcare=yes (antes
    // caían en "sin definir": Therapy for Kids, Consultorio de la Piel...).
    { sub:'optica',          nombre:'Óptica / Audiología',  grupo:'salud',        icono:'👓', m:{ shop:/^(optician|hearing_aids)$/, healthcare:/^(optometrist|audiologist)$/ } },
    { sub:'salud_otro',      nombre:'Servicio de salud',    grupo:'salud',        icono:'🩺', m:{ healthcare:/.+/, amenity:/^first_aid$/, shop:/^(medical_supply|herbalist|nutrition_supplements)$/ } },
    // Comercio
    // Tiendas de descuento (D1, Ara, Justo & Bueno): en OSM suelen venir
    // etiquetadas como shop=supermarket igual que cualquier supermercado, así
    // que sin mirar la marca se perdían en la misma categoría. Va ANTES de
    // 'supermercado' a propósito: si además trae shop=supermarket, esta regla
    // debe ganar. Pedido explícito: que queden aparte porque para un
    // constructor/inmobiliaria son una señal de mercado distinta a un
    // supermercado grande (Éxito, Metro, Merkarico).
    { sub:'tienda_descuento',nombre:'Tienda de descuento',  grupo:'comercio',     icono:'🏷️', m:{ brand:/^(d1|ara|justo\s*&?\s*y?\s*bueno)$/, name:/^(d1|ara|justo\s*&?\s*y?\s*bueno)(\s|$)/ } },
    { sub:'supermercado',    nombre:'Supermercado',         grupo:'comercio',     icono:'🛒', m:{ shop:/^(supermarket|wholesale)$/, building:/^supermarket$/ } },
    { sub:'centro_comercial',nombre:'Centro comercial',     grupo:'comercio',     icono:'🏬', m:{ shop:/^(mall|department_store)$/ } },
    { sub:'tienda_barrio',   nombre:'Tienda de barrio',     grupo:'comercio',     icono:'🏪', m:{ shop:/^(convenience|kiosk|general|greengrocer|butcher|dairy|grocery|deli|seafood|cheese|chocolate|farm|spices|health_food|nuts|frozen_food|food)$/ } },
    { sub:'panaderia',       nombre:'Panadería',            grupo:'comercio',     icono:'🥖', m:{ shop:/^(bakery|pastry|confectionery)$/, building:/^bakehouse$/ } },
    { sub:'banco',           nombre:'Banco / Cajero',       grupo:'comercio',     icono:'🏦', m:{ amenity:/^(bank|atm|bureau_de_change|money_transfer)$/ } },
    // Muy común en Colombia: corresponsales bancarios y puntos de pago
    // (Efecty, SuperGiros) y cafés internet.
    { sub:'pagos',           nombre:'Corresponsal / Pagos', grupo:'comercio',     icono:'💳', m:{ amenity:/^(payment_centre|payment_terminal|mobile_money_agent)$/, shop:/^(money_lender|pawnbroker|lottery|bookmaker)$/ } },
    { sub:'internet_cafe',   nombre:'Café internet',        grupo:'comercio',     icono:'🖥️', m:{ amenity:/^internet_cafe$/ } },
    { sub:'hotel',           nombre:'Hotel / Hospedaje',    grupo:'comercio',     icono:'🏨', m:{ tourism:/^(hotel|hostel|guest_house|motel|apartment|chalet|alpine_hut|wilderness_hut)$/, amenity:/^love_hotel$/, building:/^hotel$/ } },
    { sub:'camping',         nombre:'Camping / zona de acampada', grupo:'comercio', icono:'⛺', m:{ tourism:/^(camp_site|caravan_site)$/ } },
    { sub:'salon_eventos',   nombre:'Salón de eventos',     grupo:'comercio',     icono:'🎪', m:{ amenity:/^(events_venue|exhibition_centre|conference_centre)$/ } },
    { sub:'gasolinera',      nombre:'Estación de servicio', grupo:'comercio',     icono:'⛽', m:{ amenity:/^(fuel|charging_station)$/, shop:/^fuel$/ } },
    { sub:'restaurante',     nombre:'Restaurante',          grupo:'comercio',     icono:'🍽️', m:{ amenity:/^(restaurant|fast_food|food_court|ice_cream)$/ } },
    { sub:'cafeteria',       nombre:'Cafetería',            grupo:'comercio',     icono:'☕', m:{ amenity:/^(cafe|juice_bar)$/, shop:/^(coffee|tea)$/ } },
    // ── Comercio minorista por rubro ──────────────────────────────────────
    // Antes TODO shop=* que no fuera mercado o panadería caía en el comodín
    // "Comercio general": un centro comercial de 60 locales aparecía como 60
    // puntos idénticos. Para decidir qué poner en un local, no es lo mismo
    // tener al lado 12 almacenes de ropa que 12 ferreterías: el primero es un
    // corredor de compra por antojo (paseo, permanencia, consumo de café), el
    // segundo es de compra por encargo (llegar, comprar, irse). Cada rubro se
    // separa solo cuando cambia esa lectura; los demás siguen en el comodín.
    { sub:'ropa',            nombre:'Ropa y calzado',       grupo:'comercio',     icono:'👗', m:{ shop:/^(clothes|shoes|boutique|bag|fashion_accessories|leather|tailor|fabric|sewing|second_hand|baby_goods|jewelry|watches)$/ } },
    { sub:'belleza',         nombre:'Peluquería / Belleza', grupo:'comercio',     icono:'💇', m:{ shop:/^(hairdresser|beauty|cosmetics|perfumery|massage|tattoo|nails)$/ } },
    { sub:'lavanderia',      nombre:'Lavandería',           grupo:'comercio',     icono:'🧺', m:{ shop:/^(laundry|dry_cleaning)$/ } },
    { sub:'ferreteria',      nombre:'Ferretería / Materiales', grupo:'comercio',  icono:'🔩', m:{ shop:/^(hardware|hardware_store|doityourself|trade|paint|tiles|flooring|glaziery|locksmith|electrical|plumbing|bathroom_furnishing|building_materials|fireplace|swimming_pool|window_blind|appliance|lighting)$/ } },
    { sub:'muebles_hogar',   nombre:'Muebles y hogar',      grupo:'comercio',     icono:'🛋️', m:{ shop:/^(furniture|interior_decoration|kitchen|bed|curtain|carpet|houseware|pottery|frame)$/ } },
    { sub:'tecnologia',      nombre:'Tecnología / Electrónica', grupo:'comercio', icono:'📱', m:{ shop:/^(electronics|computer|mobile_phone|telecommunication|hifi|video_games|camera|photo|printer_ink)$/ } },
    { sub:'papeleria',       nombre:'Papelería / Librería', grupo:'comercio',     icono:'📒', m:{ shop:/^(stationery|books|newsagent|copyshop|office_supplies)$/ } },
    // El taller y el repuesto son de los usos que más marcan el carácter de
    // una vía: piden acera ocupada, ruido y parqueo en calzada. Un local de
    // paso —café, droguería— rinde distinto en una cuadra así.
    { sub:'automotriz',      nombre:'Automotriz / Taller',  grupo:'comercio',     icono:'🚗', m:{ shop:/^(car|car_repair|car_parts|motorcycle|motorcycle_repair|motorcycle_parts|tyres|truck|truck_repair|caravan|atv|boat)$/, amenity:/^(car_wash|vehicle_inspection)$/ } },
    { sub:'licorera',        nombre:'Licorera / Estanco',   grupo:'comercio',     icono:'🍾', m:{ shop:/^(alcohol|beverages|wine|water|tobacco|e-cigarette)$/ } },
    { sub:'tienda_deportes', nombre:'Tienda deportiva',     grupo:'comercio',     icono:'🏀', m:{ shop:/^(sports|outdoor|hunting|fishing|bicycle)$/ } },
    { sub:'vivero',          nombre:'Vivero / Floristería', grupo:'comercio',     icono:'🪴', m:{ shop:/^(florist|garden_centre|houseplant|agrarian)$/ } },
    { sub:'variedades',      nombre:'Variedades / Regalos', grupo:'comercio',     icono:'🎁', m:{ shop:/^(variety_store|gift|party|toys|games|craft|art|musical_instrument|music|video|charity|collector|religion|erotic|ticket)$/ } },
    // Vivienda y ocio
    { sub:'bar_ocio',        nombre:'Bar / Ocio nocturno',  grupo:'vivienda',     icono:'🍻', m:{ amenity:/^(bar|pub|nightclub|casino|biergarten|gambling|stripclub|brothel)$/, leisure:/^(amusement_arcade|adult_gaming_centre)$/ } },
    // Reportado: un gimnasio nuevo no aparecía en el análisis. Solo se
    // reconocían dos etiquetas, y en la práctica se mapean de varias formas:
    // amenity=gym es la vieja (obsoleta pero muy usada) y el deporte concreto
    // —crossfit, halterofilia— suele venir en `sport` sin ningún `leisure`.
    // Al gimnasio de pesas se suman los estudios de una sola disciplina —yoga,
    // pilates, box, artes marciales—: ocupan un local de barrio, funcionan por
    // tandas de clase y sueltan a la calle un grupo entero a la misma hora.
    // Para el flujo peatonal se comportan igual que un gimnasio, no como un
    // estadio, y en OSM suelen venir solo con `sport=*`, sin `leisure`.
    { sub:'gimnasio',        nombre:'Gimnasio',             grupo:'vivienda',     icono:'🏋️', m:{ leisure:/^(fitness_centre|fitness_station)$/, sport:/^(fitness|gym|crossfit|weightlifting|bodybuilding|yoga|pilates|aerobics|zumba|boxing|martial_arts|judo|karate|taekwondo|kickboxing|muay_thai|calisthenics)$/, amenity:/^(gym|dojo)$/ } },
    { sub:'deportivo',       nombre:'Escenario deportivo',  grupo:'vivienda',     icono:'⚽', m:{ leisure:/^(pitch|sports_centre|sports_hall|stadium|swimming_pool|swimming_area|track|golf_course|horse_riding)$/, building:/^(stadium|sports_hall|sports_centre|pavilion|riding_hall)$/, amenity:/^(sports_centre|driving_range)$/ } },
    { sub:'parque',          nombre:'Parque / Zona verde',  grupo:'vivienda',     icono:'🌳', m:{ leisure:/^(park|garden|playground|dog_park)$/, landuse:/^(recreation_ground|village_green|grass)$/, tourism:/^(viewpoint|picnic_site)$/ } },
    // Espacio público duro: la plaza, el atrio, la zona peatonal. No es un
    // parque —no tiene verde que medir— pero es donde la gente se queda, y
    // eso sostiene el comercio de la cuadra igual o más que un parque.
    { sub:'plaza',           nombre:'Plaza / Espacio público', grupo:'vivienda',  icono:'⛲', m:{ place:/^square$/, amenity:/^square$/, leisure:/^common$/ } },
    { sub:'residencial',     nombre:'Vivienda',             grupo:'vivienda',     icono:'🏠', m:{ building:/^(residential|house|apartments|detached|terrace|semidetached_house|hut|bungalow|cabin|dormitory|static_caravan)$/, landuse:/^residential$/ } },
    // Poblados donde vive gente pero que no se mapean como barrio: asentamientos
    // informales, resguardos y comunidades indígenas. Se mapean con etiquetas
    // prestadas —muchas veces `tourism=camp_site`— porque no hay una mejor.
    { sub:'asentamiento',    nombre:'Asentamiento / poblado', grupo:'vivienda',   icono:'🏕️', m:{ place:/^(hamlet|isolated_dwelling|village|neighbourhood|quarter)$/, landuse:/^(squatter|informal_settlement)$/, amenity:/^refugee_site$/ } },
    // Va ANTES de educación a propósito: el ICBF opera jardines infantiles,
    // pero es una entidad de bienestar del Estado (pedido explícito).
    { sub:'bienestar_social', nombre:'Bienestar social del Estado', grupo:'institucional', icono:'🏛️', m:{ operator:/^icbf$/, amenity:/^(social_facility|baby_hatch)$/ } },
    // `building=multiusos` no es una etiqueta estándar de OpenStreetMap: la
    // escriben los mapeadores locales para el salón multiusos del barrio, que
    // en Colombia es equipamiento de la Junta de Acción Comunal.
    { sub:'salon_comunal',   nombre:'Salón comunal / multiusos', grupo:'institucional', icono:'🏘️', m:{ building:/^(multiusos|multiuso|salon_comunal)$/ } },
    // Cultura, educación y culto
    // landuse=education marca el LOTE educativo sin decir de qué nivel. En una
    // ciudad como Cúcuta la inmensa mayoría son colegios, no campus, así que
    // se lee como colegio antes que dejarlo sin categoría.
    { sub:'colegio',         nombre:'Colegio / Jardín',     grupo:'cultura',      icono:'🏫', m:{ amenity:/^(school|kindergarten|childcare)$/, building:/^(school|kindergarten)$/, landuse:/^education$/ } },
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
    { sub:'universidad',     nombre:'Universidad / Instituto', grupo:'cultura',   icono:'🎓', m:{ amenity:/^(university|college|research_institute)$/, building:/^(university|college)$/, office:/^research$/ } },
    { sub:'iglesia',         nombre:'Iglesia / Culto',      grupo:'cultura',      icono:'⛪', m:{ amenity:/^(place_of_worship|monastery)$/, building:/^(church|chapel|mosque|cathedral|temple|synagogue)$/, landuse:/^religious$/, religion:/.+/ } },
    { sub:'cultural',        nombre:'Equipamiento cultural',grupo:'cultura',      icono:'🎭', m:{ amenity:/^(theatre|cinema|library|arts_centre|community_centre|social_centre|studio|music_venue|planetarium)$/, tourism:/^(museum|gallery|attraction|artwork)$/ } },
    // Institucional
    // amenity=servicio_de_seguridad del estado: variante no estándar que
    // aparece en CAI de Cúcuta (ej. "Cai Parque Colón") — mismo concepto que
    // amenity=police, solo con otra etiqueta.
    { sub:'policia',         nombre:'Policía / CAI',        grupo:'institucional',icono:'🚓', m:{ amenity:/^(police|servicio_de_seguridad del estado)$/ } },
    { sub:'gobierno',        nombre:'Entidad pública',      grupo:'institucional',icono:'🏛️', m:{ amenity:/^(townhall|courthouse|post_office|prison|social_facility|embassy|public_building|register_office|customs|ranger_station)$/, office:/^(government|administrative|diplomatic)$/, building:/^(public|civic|government)$/, landuse:/^(military|institutional)$/ } },
    { sub:'notaria',         nombre:'Notaría / Jurídico',   grupo:'institucional',icono:'⚖️', m:{ office:/^(notary|lawyer)$/, amenity:/^notary$/ } },
    // Servicios e infraestructura (vias/ciclorrutas van a stats.movilidad, no a POIs)
    { sub:'via_arteria',     nombre:'Vía arteria',          grupo:'servicios',    icono:'🛣️', m:{ highway:/^(trunk|primary|secondary|tertiary)$/ } },
    { sub:'ciclorruta',      nombre:'Ciclorruta',           grupo:'servicios',    icono:'🚴', m:{ highway:/^cycleway$/ } },
    // Estación de bicicleta pública. No es lo mismo que un cicloparqueadero
    // (`bicycle_parking`, en Transporte): allí la gente deja su bici, aquí la
    // toma y la devuelve, así que genera viajes a pie de ida y de vuelta.
    { sub:'bici_publica',    nombre:'Bicicleta pública',    grupo:'servicios',    icono:'🚲', m:{ amenity:/^bicycle_rental$/ } },
    { sub:'parada_bus',      nombre:'Parada de transporte', grupo:'servicios',    icono:'🚌', m:{ highway:/^bus_stop$/, amenity:/^(bus_station|ferry_terminal)$/, public_transport:/^(platform|stop_position|station)$/, building:/^(train_station|transportation)$/ } },
    // car_pooling: en la práctica en Cúcuta aparece mapeado como "Parqueadero"
    // por el nombre que le puso quien lo mapeó, aunque la etiqueta técnica de
    // OSM sea para compartir carro, no para dejar el carro.
    { sub:'transporte',      nombre:'Transporte / Parqueo', grupo:'servicios',    icono:'🅿️', m:{ amenity:/^(taxi|parking|car_rental|car_pooling|car_sharing|motorcycle_rental|bicycle_parking|motorcycle_parking|parking_space)$/ } },
    { sub:'infra_servicios', nombre:'Infraestructura',      grupo:'servicios',    icono:'🗼', m:{ man_made:/^(mast|tower|water_tower|works)$/, power:/^substation$/, amenity:/^(recycling|waste_transfer_station|waste_disposal)$/, landuse:/^(landfill|railway|port)$/, building:/^(storage_tank|silo|bunker)$/ } },
    // Servientrega / Inter Rapidísimo y demás puntos de envío.
    { sub:'mensajeria',      nombre:'Mensajería / Correo',  grupo:'servicios',    icono:'📮', m:{ amenity:/^(post_box|parcel_locker|post_depot)$/, office:/^courier$/ } },
    { sub:'mobiliario',      nombre:'Mobiliario urbano',    grupo:'servicios',    icono:'🪑', m:{ amenity:/^(bench|drinking_water|shelter|toilets|waste_basket|fountain|clock|vending_machine|parking_entrance|water_point|watering_place|sanitary_dump_station|shower|telephone|photo_booth|luggage_locker|lounger|give_box|smoking_area|trolley_bay|vacuum_cleaner|compressed_air|device_charging_station|bicycle_repair_station|public_bookcase|bbq|kitchen|stage|hunting_stand)$/, tourism:/^information$/, building:/^(toilets|tent)$/ } },
    { sub:'edificacion_menor', nombre:'Edificación de servicio', grupo:'servicios', icono:'🧱', m:{ building:/^(garage|garages|service|shed|roof|carport|container)$/, landuse:/^garages$/ } },
    { sub:'funerario',       nombre:'Servicio funerario',   grupo:'servicios',    icono:'🕊️', m:{ shop:/^funeral_directors$/, amenity:/^(grave_yard|crematorium|funeral_hall)$/, landuse:/^cemetery$/ } },
    // Industria
    { sub:'industria',       nombre:'Industria',            grupo:'industria',    icono:'🏭', m:{ landuse:/^(industrial|quarry)$/, building:/^industrial$/ } },
    { sub:'bodega',          nombre:'Bodega / Logística',   grupo:'industria',    icono:'📦', m:{ building:/^(warehouse|hangar)$|bodega|dep[oó]sito|almac[eé]n/, landuse:/^depot$/, amenity:/^loading_dock$/, office:/^logistics$/, shop:/^storage_rental$/ } },
    // Ambiente
    { sub:'agua',            nombre:'Cuerpo de agua',       grupo:'ambiente',     icono:'💧', m:{ natural:/^(water|wetland)$/, waterway:/^(river|stream|canal)$/, landuse:/^(basin|salt_pond|aquaculture)$/ } },
    // Suelo rural productivo y sus construcciones auxiliares: en el borde de
    // Cúcuta marcan dónde termina la ciudad y empieza el campo.
    { sub:'verde_natural',   nombre:'Verde natural',        grupo:'ambiente',     icono:'🌿', m:{ natural:/^(wood|scrub|grassland|tree_row)$/, landuse:/^(forest|meadow|farmland|orchard|allotments|farmyard|vineyard|plant_nursery|greenhouse_horticulture)$/, leisure:/^nature_reserve$/, building:/^(farm|farm_auxiliary|barn|cowshed|greenhouse|stable|sty)$/ } },
    // Riesgo / transición
    // Separados a propósito: una obra en curso indica TRANSFORMACIÓN del
    // sector, mientras un lote sin desarrollar indica EXPANSIÓN. Son señales
    // distintas para un inversionista. `baldio_obra` se conserva como suma
    // de ambos para no romper las reglas que ya lo usaban.
    { sub:'en_obra',         nombre:'En obra / Construcción', grupo:'riesgo',     icono:'🏗️', m:{ landuse:/^construction$/, building:/^construction$/ } },
    { sub:'baldio',          nombre:'Lote sin desarrollar', grupo:'riesgo',       icono:'🚧', m:{ landuse:/^(brownfield|greenfield)$/ } },
    // Un local desocupado no es comercio: es la señal de que la cuadra no
    // está reteniendo negocios. Contarlo como comercio inflaba la oferta.
    { sub:'local_vacio',     nombre:'Local desocupado',     grupo:'riesgo',       icono:'🔒', m:{ shop:/^vacant$/, disused:/.+/ } },
    // Distinto de un lote vacío: aquí hubo algo y se cayó. Es la señal más
    // dura de deterioro de una cuadra, y pesa en la lectura de riesgo.
    { sub:'ruina',           nombre:'Edificación en ruina', grupo:'riesgo',       icono:'🏚️', m:{ building:/^ruins$/, historic:/^ruins$/, ruins:/^yes$/ } },
    // En Colombia muchos mapeadores escriben el uso real en español dentro de
    // building=* (ej. building=taller_mecanico, building=charcuteria_mechis).
    // Se reconocen por palabra clave para no perderlos como "sin definir".
    { sub:'comercio_local',  nombre:'Comercio / Servicio local', grupo:'comercio', icono:'🏪', m:{ building:/taller|lavadero|charcuter|tienda|panader|restaurante|cafeter|helader|licor|papeler|ferreter|peluquer|barber|farmacia|droguer|supermercado|miscelanea|variedades|comercio|local/ } },
    { sub:'ocio_generico',   nombre:'Ocio / Recreación',    grupo:'vivienda',     icono:'🎡', m:{ leisure:/.+/, tourism:/.+/, amenity:/^(public_bath|sauna)$/ } },
    // Mixtos y oficinas (van casi al final: office=* es comodín).
    // building con ";" o "," es multi-uso declarado (ej. residential;commercial).
    { sub:'mixto',           nombre:'Uso mixto',            grupo:'mixtos',       icono:'🧩', m:{ building:/^mixed$|[;,]/ } },
    { sub:'oficina',         nombre:'Oficina',              grupo:'mixtos',       icono:'💼', m:{ office:/.+/, building:/^office$/, amenity:/^coworking_space$/, shop:/^(insurance|estate_agent|travel_agency)$/ } },
    // Comodines finales: comercio declarado por edificio/suelo aunque no
    // tenga tag de negocio específico, y cualquier shop con valor.
    { sub:'local_comercial', nombre:'Local comercial',      grupo:'comercio',     icono:'🏬', m:{ building:/^(commercial|retail|kiosk|shop)$/, landuse:/^(commercial|retail)$/, amenity:/^marketplace$/, shop:/^trade_centre$/ } },
    { sub:'comercio_otro',   nombre:'Comercio general',     grupo:'comercio',     icono:'🛍️', m:{ shop:/.+/ } },
    // Último recurso, DESPUÉS del comodín de comercio: una cancha o un club
    // que solo trae `sport=*` es un escenario deportivo, pero un almacén de
    // deportes trae `shop=sports` + `sport=soccer` y debe quedar en comercio.
    // Por eso esta regla va de última: deja que la etiqueta de negocio mande.
    { sub:'deportivo',       nombre:'Escenario deportivo',  grupo:'vivienda',     icono:'⚽', m:{ sport:/.+/ } }
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

  // ── Depuración de la bandeja ────────────────────────────────────────────
  //
  // Los patrones se guardan cuando NADIE supo clasificarlos. Pero el
  // clasificador va aprendiendo: cada vez que se agrega una regla, los
  // patrones que esa regla ya resuelve siguen guardados como pendientes y la
  // bandeja los vuelve a listar. El resultado es que se pide clasificar una y
  // otra vez algo que ya está clasificado — trabajo hecho que parece pendiente.
  //
  // Esto los reevalúa contra el clasificador ACTUAL y cierra solo los que ya
  // tienen respuesta. Se ejecuta antes de listar, así la bandeja siempre
  // muestra lo que de verdad falta decidir.
  function tagsDesdeFirma(e){
    const tags = {};
    (e.tags || []).forEach(par => {
      const i = String(par).indexOf('=');
      if (i > 0) tags[par.slice(0, i)] = par.slice(i + 1);
    });
    // El nombre no se guarda entre las etiquetas, pero varias reglas dependen
    // de él (una "Distribuidora SAS" es bodega por el nombre, no por el
    // `building`). Se reinyecta el primer ejemplo visto.
    if (e.ejemplos && e.ejemplos.length) tags.name = e.ejemplos[0];
    return tags;
  }

  function depurarPendientes(){
    const store = leerPendientes();
    let cerrados = 0;
    Object.keys(store).forEach(k => {
      const e = store[k];
      if (!e || e.estado !== 'pendiente') return;
      let c = null;
      try { c = clasificarPOI(tagsDesdeFirma(e)); } catch(err) { c = null; }
      if (c && c.grupo && c.grupo !== 'otro') {
        e.estado = 'resuelto';
        e.grupo = c.grupo;
        e.nombreUso = c.nombre || '';
        e.resueltoPor = 'taxonomia';   // lo cerró una regla, no una persona
        e.resueltoEn = new Date().toISOString();
        cerrados++;
      }
    });
    if (cerrados) escribirPendientes(store);
    return cerrados;
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
    depurarPendientes();
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
    depurarPendientes();
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
    depurarPendientes();
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
    { sub:'gimnasio',        re:/\b(smart\s*fit|smartfit|bodytech|spinning\s*center|hard\s*body|crossfit|gold'?s\s*gym|fitness\s*24|stark\s*gym|athletic|world\s*gym|energy\s*fitness|gimnasio(?!\s*(moderno|campestre|femenino|los\s|del\s|de\s)))\b/ },
    { sub:'drogueria',       re:/\b(cruz\s*verde|la\s*rebaja|farmatodo|drogas?\s*la\s*econom|copservir|audifarma|locatel|farmacia\s*pasteur|drogueria|farmacia|drogas\s*ol[ií]mpica|colsubsidio\s*drog)\b/ },
    { sub:'cafeteria',       re:/\b(tosta[o0]|juan\s*valdez|starbucks|oma\b|dunkin|cafe\s*quindio|cafeter[ií]a|caf[eé]\s+de|mimo'?s|crepes\s*&?\s*waffles)\b/ },
    // El formato de descuento tiene sub propio: no es lo mismo un D1 de
    // esquina que un Éxito con parqueadero, ni para el flujo ni para el FODA.
    { sub:'tienda_descuento',re:/\b(d1\b|ara\b|justo\s*&?\s*bueno|dollarcity|surtimax)\b/ },
    { sub:'supermercado',    re:/\b(exito|olimpica|jumbo|metro\b|carulla|makro|pricesmart|consumo|la\s*14)\b/ },
    { sub:'banco',           re:/\b(bancolombia|davivienda|banco\s*de\s*bogota|bbva|banco\s*popular|colpatria|scotiabank|av\s*villas|bancoomeva|banagrario|banco\s*agrario|efecty|baloto|nequi|daviplata|banco\s*caja\s*social|itau|cajero\s*autom)\b/ },
    { sub:'restaurante',     re:/\b(mcdonald|burger\s*king|kfc|frisby|el\s*corral|presto|dominos|papa\s*john|subway|sandwich\s*qbano|archies|restaurante|asadero|pizzer[ií]a|sushi|wok\b|corral\s*gourmet)\b/ },
    { sub:'gasolinera',      re:/\b(terpel|biomax|texaco|mobil|esso|primax|petrobras|zeuss|estaci[oó]n\s*de\s*servicio|eds\b|puma\s*energy|gazel)\b/ },
    { sub:'centro_comercial',re:/\b(centro\s*comercial|c\.?c\.?\s|unicentro|ventura|jardin\s*plaza|mayorca|viva\b|plaza\s*del\s*este)\b/ },
    { sub:'hotel',           re:/\b(hotel|hostal|hospedaje|aparta\s*hotel|holiday\s*inn|ibis\b)\b/ },
    { sub:'universidad',     re:/\b(universidad|unipamplona|ufps|udes|uniminuto|politecnico|sena\b|instituto\s*tecnico)\b/ },
    { sub:'colegio',         re:/\b(colegio|liceo|gimnasio\s+(campestre|moderno)|institucion\s*educativa|jardin\s*infantil)\b/ },
    { sub:'salud_ips',       re:/\b(clinica|hospital|ips\b|eps\b|centro\s*medico|sanitas|sura\b|compensar|nueva\s*eps|salud\s*total|famisanar|coomeva|medimas|colsanitas)\b/ },
    { sub:'panaderia',       re:/\b(panaderia|pasteleria|reposteria|kokoriko|bimbo)\b/ }
  ];

  // Cómo se llama el sitio, mirando TODAS las etiquetas donde OpenStreetMap
  // guarda su identidad. Antes solo se leía `name`, y un local de cadena
  // mapeado con `brand=Smart Fit` sin `name` —o con el nombre solo en
  // `name:es`— se quedaba sin reconocer: el gimnasio estaba en el mapa y el
  // informe seguía diciendo que en el sector no había ninguno.
  const CLAVES_NOMBRE = ['name', 'name:es', 'brand', 'operator', 'official_name', 'alt_name', 'short_name'];
  function nombresDe(tags){
    const out = [];
    CLAVES_NOMBRE.forEach(k => {
      const v = tags && tags[k];
      if (v && out.indexOf(v) === -1) out.push(v);
    });
    return out;
  }
  // Primera de esas etiquetas que corresponda a una marca conocida.
  function marcaEnTags(tags){
    const ns = nombresDe(tags);
    for (let i = 0; i < ns.length; i++) {
      const m = marcaDe(ns[i]);
      if (m) return m;
    }
    return null;
  }
  function usoPorNombreEnTags(tags){
    const ns = nombresDe(tags);
    for (let i = 0; i < ns.length; i++) {
      const u = usoPorNombre(ns[i]);
      if (u) return u;
    }
    return null;
  }
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

  // Los rubros de comercio minorista que antes vivían todos dentro de
  // `comercio_otro`. Se listan aparte para que abrir la taxonomía en rubros no
  // vacíe el conteo de oferta comercial de los programas que la usan.
  const SUBS_COMERCIO_DETAL = ['ropa','belleza','lavanderia','ferreteria','muebles_hogar',
    'tecnologia','papeleria','automotriz','licorera','tienda_deportes','vivero','variedades'];

  // ── Cuando la etiqueta acierta la familia pero no el uso ─────────────────
  //
  // Reportado: un Smart Fit no salía en las oportunidades de gimnasio. No era
  // que faltara el dato —estaba en el mapa, se pintaba— sino que venía como
  // `leisure=sports_centre`, de las formas más comunes de mapear un gimnasio
  // de cadena. La etiqueta lo mandaba a "Escenario deportivo", categoría
  // CORRECTA pero más amplia, y como no es un cajón de sastre el diccionario
  // de marcas no la podía corregir. El gimnasio existía y el informe seguía
  // diciendo que no había ninguno.
  //
  // Esto es distinto de un uso sin categoría: ese va a la bandeja de
  // pendientes y se revisa. Un uso mal clasificado en una subcategoría que SÍ
  // existe no cae en 'otro', así que nunca llega a la bandeja: es un punto
  // ciego. Se resuelve dejando que la marca afine hacia lo más específico.
  //
  // La regla es estrecha a propósito: la marca solo afina DENTRO de la familia
  // que la etiqueta ya reconoció. Nunca convierte una droguería en gimnasio.
  const REFINA = {
    deportivo:      ['gimnasio'],
    ocio_generico:  ['gimnasio', 'deportivo', 'bar_ocio', 'cultural'],
    // Rubros de comercio minorista. Antes todos vivían dentro de
    // `comercio_otro`, que es genérico y por tanto siempre cedía ante la
    // marca; al darles categoría propia dejaron de ceder, y un gimnasio de
    // cadena mapeado como almacén deportivo volvió a perderse.
    tienda_deportes:['gimnasio', 'deportivo'],
    ropa:           ['tienda_descuento', 'centro_comercial', 'variedades'],
    variedades:     ['tienda_descuento', 'papeleria', 'tecnologia'],
    tecnologia:     ['banco', 'pagos'],
    papeleria:      ['pagos', 'internet_cafe'],
    belleza:        ['gimnasio', 'drogueria'],
    ferreteria:     ['muebles_hogar'],
    muebles_hogar:  ['ferreteria', 'centro_comercial'],
    automotriz:     ['gasolinera'],
    licorera:       ['tienda_descuento', 'tienda_barrio'],
    // Un D1 mapeado como supermercado o tienda de barrio es, con más
    // precisión, tienda de descuento: compra diaria, formato pequeño.
    supermercado:   ['tienda_descuento'],
    tienda_barrio:  ['tienda_descuento', 'panaderia', 'drogueria', 'pagos'],
    comercio_local: ['gimnasio', 'drogueria', 'cafeteria', 'panaderia', 'restaurante',
                     'banco', 'supermercado', 'tienda_descuento', 'gasolinera'],
    salud_otro:     ['drogueria', 'salud_ips', 'laboratorio', 'veterinaria'],
    // Un Juan Valdez o un Tostao mapeados como restaurante son cafeterías.
    restaurante:    ['cafeteria'],
    mixto:          ['centro_comercial'],
    transporte:     ['gasolinera'],
    cultural:       ['universidad', 'colegio'],
    gobierno:       ['salud_ips', 'universidad', 'colegio']
  };

  function marcaRefina(subEtiqueta, subMarca){
    const lista = REFINA[subEtiqueta];
    return !!lista && lista.indexOf(subMarca) !== -1;
  }

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
    { sub:'comercio_local',re:/\b(comercial|almac[eé]n|surtido|mini\s*mercado)\b/ },
    // El resto del vocabulario con que se rotula un negocio en Cúcuta. Solo
    // entra en juego cuando la etiqueta OSM es estructural (`building=yes`) o
    // un contenedor genérico: frente a un `amenity=pharmacy` no se discute.
    // Antes, un punto rotulado "Panadería La Espiga" con `building=yes` se
    // contaba como una casa más.
    { sub:'ferreteria',    re:/\b(ferreter[ií]a|materiales\s*de\s*construc|dep[oó]sito\s*de\s*materiales|cacharrer[ií]a\s*el[eé]ctrica)\b/ },
    { sub:'panaderia',     re:/\b(panader[ií]a|pasteler[ií]a|reposter[ií]a|bizcocher[ií]a)\b/ },
    { sub:'restaurante',   re:/\b(restaurante|asadero|comidas\s*r[aá]pidas|pizzer[ií]a|marisquer[ií]a|piquetead|fritanguer[ií]a|helader[ií]a)\b/ },
    { sub:'automotriz',    re:/\b(taller\s*(mec[aá]nico|de\s*motos)?|montallantas|serviteca|lavadero\s*de\s*(carros|autos|motos)|repuestos|tecnimec)\b/ },
    { sub:'belleza',       re:/\b(peluquer[ií]a|barber[ií]a|sal[oó]n\s*de\s*belleza|est[eé]tica|spa\b|u[nñ]as)\b/ },
    { sub:'papeleria',     re:/\b(papeler[ií]a|librer[ií]a|fotocopias|miscel[aá]nea)\b/ },
    { sub:'licorera',      re:/\b(licorer[ií]a|estanco|distribuidora\s*de\s*licores|cigarrer[ií]a)\b/ },
    { sub:'variedades',    re:/\b(variedades|cacharrer[ií]a|bazar|todo\s*a\s*mil|regalos)\b/ },
    { sub:'transporte',    re:/\b(parqueadero|estacionamiento|parqueo)\b/ },
    { sub:'lavanderia',    re:/\b(lavander[ií]a|lavaseco)\b/ },
    { sub:'funerario',     re:/\b(funeraria|funerales|jardines?\s*del?\s*(recuerdo|paz)|capilla\s*de\s*velaci)\b/ },
    { sub:'optica',        re:/\b([oó]ptica|optometr)\b/ },
    { sub:'veterinaria',   re:/\b(veterinaria|agroveterinaria|pet\s*shop)\b/ },
    { sub:'salud_ips',     re:/\b(ips\b|eps\b|cl[ií]nica|centro\s*m[eé]dico|puesto\s*de\s*salud|unidad\s*b[aá]sica)\b/ },
    { sub:'laboratorio',   re:/\b(laboratorio\s*cl[ií]nico|laboratorio\s*m[eé]dico)\b/ },
    { sub:'colegio',       re:/\b(colegio|instituci[oó]n\s*educativa|escuela|jard[ií]n\s*infantil|preescolar|liceo|gimnasio\s*(moderno|campestre))\b/ },
    { sub:'iglesia',       re:/\b(iglesia|parroquia|capilla|templo|centro\s*cristiano|congregaci[oó]n)\b/ },
    { sub:'policia',       re:/\b(cai\b|estaci[oó]n\s*de\s*polic[ií]a|comando\s*de\s*polic[ií]a)\b/ },
    { sub:'hotel',         re:/\b(hotel|hostal|hospedaje|residencias?\b|posada)\b/ },
    { sub:'muebles_hogar', re:/\b(mueble[sr]|colchones|carpinter[ií]a|tapicer[ií]a)\b/ },
    { sub:'ropa',          re:/\b(boutique|modas|confecciones|calzado|zapater[ií]a|sastrer[ií]a|lencer[ií]a)\b/ },
    { sub:'tecnologia',    re:/\b(celulares|tecnolog[ií]a|sistemas|computadores|electr[oó]nica)\b/ },
    { sub:'vivero',        re:/\b(vivero|florister[ií]a|agropecuaria|agroinsumos)\b/ }
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

  // Etiqueta propia de URBIS para los usos que el usuario agrega a mano desde
  // el análisis. Va ANTES que todo: si alguien señaló en el mapa "aquí hay un
  // gimnasio", no hay nada que deducir. Es lo que permite corregir el análisis
  // cuando el local existe en la calle pero nadie lo ha dibujado en
  // OpenStreetMap, sin tener que esperar a que alguien lo mapee.
  const TAG_SUB_MANUAL = 'urbis:sub';
  const TAG_MANUAL = 'urbis:manual';

  function clasificarPOI(tags){
    tags = tags || {};
    const forzada = tags[TAG_SUB_MANUAL];
    if (forzada) {
      const r = subDeTaxonomia(String(forzada));
      // Si la subcategoría no existe (dato viejo, o alguien editó a mano el
      // almacenamiento), se ignora la orden y se clasifica como cualquier otro
      // punto: mejor deducir mal que inventar una categoría que no está en la
      // Matriz y romper todo lo que cuenta por subcategoría.
      if (r) return r;
    }
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
          const porMarca = marcaEnTags(tags);
          // Cajón de sastre: la marca manda. Familia correcta pero categoría
          // más amplia: la marca afina hacia la subcategoría precisa.
          if (porMarca && (GENERICAS.indexOf(r.sub) !== -1 || marcaRefina(r.sub, porMarca.sub))) {
            return porMarca;
          }
          // El nombre gana solo cuando la etiqueta que emparejó es estructural
          // o un contenedor genérico. Una marca conocida pesa más que un nombre
          // descriptivo, así que se prueba primero.
          const debil = CLAVES_ESTRUCTURALES.indexOf(clave) !== -1 ||
                        CONTENEDORES.indexOf(r.sub) !== -1;
          if (debil) {
            if (porMarca) return porMarca;
            const porNombre = usoPorNombreEnTags(tags);
            if (porNombre && porNombre.sub !== r.sub) return porNombre;
          }
          return { sub: r.sub, nombre: r.nombre, grupo: r.grupo, icono: r.icono };
        }
      }
    }
    // Antes de rendirse a "otro": ¿el nombre dice el uso? Va DESPUÉS de las
    // etiquetas a propósito — una etiqueta explícita siempre gana sobre deducir
    // por el nombre. Aquí ya no queda ninguna etiqueta que respetar.
    const porMarcaFinal = marcaEnTags(tags);
    if (porMarcaFinal) return porMarcaFinal;
    const porNombreFinal = usoPorNombreEnTags(tags);
    if (porNombreFinal) return porNombreFinal;
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
    let manuales = 0;
    const movilidad = { viasArterias: [], tramosVia: [], nViasArterias: 0, paradasBus: 0, ciclorrutas: 0, scoreAcceso: 0 };

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
        // Cada tramo se guarda con su posición, aparte del conteo por corredor:
        // el mapa de calor vehicular necesita saber POR DÓNDE pasa la vía, no
        // solo que existe. Sin esto el calor se pintaría en el centro del radio.
        movilidad.tramosVia.push({ lat, lng, tipo: tags.highway || '', distM });
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
      // Un uso puesto a mano vale para el cálculo exactamente igual que uno
      // mapeado —para eso se agrega—, pero queda marcado: un informe que no
      // distinga lo observado de lo añadido por el propio interesado no se
      // puede auditar, y ante un cliente esa diferencia importa.
      if (tags[TAG_MANUAL] === 'si') { poi.manual = true; manuales++; }
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
      // La plaza pesa más que el parque para el comercio de la cuadra: es
      // punto de encuentro y de paso a toda hora, no destino de fin de tarde.
      plaza:            { peso:  9, media: 300, franja:'todo' },
      // La iglesia concentra picos fuertes y muy peatonales.
      iglesia:          { peso:  7, media: 350, franja:'picos' },
      cultural:         { peso:  6, media: 350, franja:'tarde' },
      // Comida y ocio: son los que sostienen la calle DESPUÉS de que cierran
      // el comercio y las oficinas. Mientras el modelo no tuvo franja
      // nocturna, un restaurante se archivaba como "mediodía" y un bar como
      // "tarde": una zona de rumba se leía igual que una de oficinas.
      restaurante:      { peso:  6, media: 280, franja:'comida' },
      cafeteria:        { peso:  4, media: 200, franja:'manana' },
      bar_ocio:         { peso:  8, media: 280, franja:'noche' },
      hotel:            { peso:  6, media: 320, franja:'noche' },
      salon_eventos:    { peso:  5, media: 350, franja:'noche' }
    };

    // Comercio a pie de andén: lo que forma "calle comercial". Se cuenta como
    // conjunto, no de a uno.
    // Vitrina a la calle: lo que hace que alguien camine la cuadra en vez de
    // ir directo a un destino. Se suman los rubros de comercio minorista —al
    // abrirlos en categorías propias dejaron de contarse dentro de
    // `comercio_otro`, y una calle de almacenes de ropa habría quedado medida
    // como si estuviera vacía. Queda FUERA el taller/repuesto: ocupa el andén
    // con carros y no invita a caminar, que es justo lo que mide este término.
    const COMERCIO_ANDEN = ['tienda_barrio', 'comercio_otro', 'comercio_local', 'local_comercial',
                            'panaderia', 'drogueria', 'restaurante', 'cafeteria', 'tienda_descuento',
                            'supermercado', 'pagos', 'internet_cafe', 'bar_ocio', 'optica']
      .concat(SUBS_COMERCIO_DETAL.filter(s => s !== 'automotriz'));

    const flujo = { generadores: [], penalizadores: [], peatonal: 0, vehicular: 0, franjas: {} };
    const aporteFranja = { manana: 0, mediodia: 0, tarde: 0, noche: 0 };
    let sumaPeaton = 0, restaPeaton = 0;

    // Cómo se reparte a lo largo del día lo que aporta cada uso. Vive en una
    // tabla y no en una cadena de `if` porque el mapa de calor necesita los
    // MISMOS pesos para pintar la noche aparte: si se calcularan en dos sitios,
    // el mapa y la gráfica de horas acabarían contando cosas distintas.
    const FRANJA_PESO = {
      todo:     { manana:1,   mediodia:1,   tarde:1,   noche:.5 },
      dia:      { manana:1,   mediodia:1,   tarde:.5,  noche:.15 },
      laboral:  { manana:1,   mediodia:.8,  tarde:.3,  noche:.1 },
      picos:    { manana:1.2, mediodia:.3,  tarde:1.1, noche:.5 },
      manana:   { manana:1.4, mediodia:.6,  tarde:.4,  noche:.15 },
      mediodia: { manana:.2,  mediodia:1.3, tarde:.6,  noche:.4 },
      tarde:    { manana:.3,  mediodia:.7,  tarde:1.3, noche:.8 },
      // Franjas nuevas: hasta ahora el modelo se apagaba a las 6 de la tarde y
      // un sector de bares o de restaurantes se leía igual que uno de oficinas.
      noche:    { manana:.1,  mediodia:.3,  tarde:.9,  noche:1.4 },
      comida:   { manana:.3,  mediodia:1.3, tarde:.6,  noche:1 }
    };
    function repartirFranja(f, aporte){
      const w = FRANJA_PESO[f] || FRANJA_PESO.todo;
      aporteFranja.manana   += aporte * w.manana;
      aporteFranja.mediodia += aporte * w.mediodia;
      aporteFranja.tarde    += aporte * w.tarde;
      aporteFranja.noche    += aporte * w.noche;
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

    // ── 1b. Lo que RESTA ─────────────────────────────────────────────────
    // Hasta aquí el modelo solo sumaba, y eso no es como funciona una calle.
    // Un tramo de bodegas, un lote encerrado o tres locales cerrados con reja
    // rompen el recorrido a pie: la gente que venía caminando se devuelve o
    // cruza. Es la "fachada muerta" de la que vive o muere un local de paso, y
    // es justo lo que la matriz abierta permite medir ahora — antes el local
    // desocupado se contaba como comercio y la ruina no se clasificaba.
    const RESTA_PEATON = {
      local_vacio:     { peso: 5, media: 200, motivo:'locales cerrados' },
      ruina:           { peso: 5, media: 200, motivo:'edificación en ruina' },
      baldio:          { peso: 4, media: 220, motivo:'lote sin desarrollar' },
      bodega:          { peso: 5, media: 280, motivo:'frente de bodega' },
      industria:       { peso: 6, media: 300, motivo:'frente industrial' },
      automotriz:      { peso: 3, media: 200, motivo:'taller sobre el andén' },
      infra_servicios: { peso: 3, media: 250, motivo:'infraestructura sin frente activo' },
      funerario:       { peso: 2, media: 250, motivo:'uso sin vitrina' }
    };
    Object.keys(RESTA_PEATON).forEach(function (sub) {
      const lista = pois.filter(p => p.sub === sub);
      if (!lista.length) return;
      const g = RESTA_PEATON[sub];
      let resta = 0;
      lista.forEach(function (p) { resta += g.peso / (1 + Math.pow(p.distM / g.media, 2)); });
      if (resta <= 0) return;
      restaPeaton += resta;
      const cat = TAXONOMIA.find(t => t.sub === sub);
      flujo.penalizadores.push({ sub, nombre: (cat && cat.nombre) || sub, n: lista.length,
                                 resta: Math.round(resta), motivo: g.motivo });
    });
    flujo.penalizadores.sort((a, b) => b.resta - a.resta);

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
    // Lo que resta se aplica ANTES de la escala saturante, y con tope: una
    // cuadra con vitrinas continuas no se borra porque haya dos bodegas, pero
    // sí se descuenta. El tope es del 45% para que el término no pueda dar
    // vuelta al resultado por sí solo, que sería tan falso como ignorarlo.
    const restaAplicada = Math.min(restaPeaton, sumaPeaton * 0.45);
    flujo.restaPeaton = Math.round(restaAplicada);
    flujo.sumaBruta = Math.round(sumaPeaton);
    const sumaNeta = Math.max(0, sumaPeaton - restaAplicada);
    // El descuento se aplica también al reparto por horas, para que la gráfica
    // de franjas y el total hablen del mismo sitio.
    if (sumaPeaton > 0 && restaAplicada > 0) {
      const factor = sumaNeta / sumaPeaton;
      aporteFranja.manana *= factor; aporteFranja.mediodia *= factor;
      aporteFranja.tarde *= factor;  aporteFranja.noche *= factor;
    }
    flujo.peatonal = Math.round(100 * (1 - Math.exp(-sumaNeta / 100)));
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
      hotel:            0.6,
      // El cliente llega en carro y se va cargado: mueble, cemento, repuesto.
      // Un negocio así no sobrevive sin dónde arrimar el vehículo.
      muebles_hogar:    0.6,
      ferreteria:       0.5,
      automotriz:       0.6
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
    // Además de la vía y del parqueo, hay usos que GENERAN viajes en vehículo
    // por sí mismos: a una ferretería o a una bodega no se llega a pie con la
    // compra al hombro. Sin este término, dos esquinas sobre la misma avenida
    // daban idéntico aunque una tuviera un centro comercial y la otra casas.
    const GENERA_VEHICULO = {
      centro_comercial: 10, gasolinera: 8, industria: 7, bodega: 6, supermercado: 6,
      ferreteria: 5, automotriz: 5, muebles_hogar: 4, salud_ips: 5, universidad: 5,
      hotel: 4, colegio: 4, tienda_descuento: 3, salon_eventos: 3, transporte: 3
    };
    let sumaVeh = 0;
    flujo.generadoresVehiculo = Object.keys(GENERA_VEHICULO)
      .map(sub => {
        const lista = pois.filter(p => p.sub === sub);
        if (!lista.length) return null;
        let aporte = 0;
        lista.forEach(p => { aporte += GENERA_VEHICULO[sub] / (1 + Math.pow(p.distM / 400, 2)); });
        sumaVeh += aporte;
        const cat = TAXONOMIA.find(t => t.sub === sub);
        return { sub, nombre: (cat && cat.nombre) || sub, n: lista.length, aporte: Math.round(aporte) };
      })
      .filter(Boolean)
      .sort((a, b) => b.aporte - a.aporte);
    flujo.vehicular = Math.round(clamp(0, 100,
      movilidad.exposicion * 0.7 + Math.min(18, parqueo * 6) +
      22 * (1 - Math.exp(-sumaVeh / 25))));
    flujo.nivelVehicular = flujo.vehicular >= 70 ? 'Muy alto' : flujo.vehicular >= 50 ? 'Alto'
      : flujo.vehicular >= 30 ? 'Medio' : 'Bajo';
    // Hay dónde parar si se mapeó un parqueadero o si el entorno tiene formatos
    // que traen el suyo. Es lo que responde "¿el que pasa se puede detener?".
    flujo.hayDondeParar = flujo.parqueaderos > 0 || flujo.parqueoProbable.length > 0;

    // ── Mapa de calor ────────────────────────────────────────────────────
    //
    // El flujo peatonal es UN número para todo el radio, y un radio nunca es
    // homogéneo: pegado al gimnasio pasa gente que 300 m más allá no pasa.
    // Aquí se reparte ese mismo cálculo sobre una malla, sumando y restando
    // punto por punto, para poder ver DÓNDE está el tránsito en vez de
    // promediarlo. Se pintan tres capas porque responden preguntas distintas:
    // a pie de día, a pie de noche —una calle de bares y una de oficinas se
    // ven idénticas de día y opuestas a las 9 p.m.— y en vehículo.
    //
    // Se usan las MISMAS tablas de peso que el total (GENERA_PEATON,
    // RESTA_PEATON, FRANJA_PESO, GENERA_VEHICULO): si el mapa tuviera pesos
    // propios acabaría contando otra cosa que la cifra de al lado.
    const N_CELDA = 26;
    const mLat = 110540, mLng = 111320 * Math.cos(centro.lat * Math.PI / 180);
    const enMetros = o => ({ x: (o.lng - centro.lng) * mLng, y: (o.lat - centro.lat) * mLat });

    const focos = [];      // lo que calienta o enfría el andén
    const focosVeh = [];   // lo que atrae vehículos
    pois.forEach(function (p) {
      const q = enMetros(p);
      const g = GENERA_PEATON[p.sub];
      if (g) focos.push({ x:q.x, y:q.y, peso:g.peso, media:g.media,
                          w: FRANJA_PESO[g.franja] || FRANJA_PESO.todo, signo: 1 });
      const r = RESTA_PEATON[p.sub];
      if (r) focos.push({ x:q.x, y:q.y, peso:r.peso, media:r.media,
                          w: FRANJA_PESO.todo, signo: -1 });
      // La vitrina y la vivienda no son anclas —no son destino de viaje— pero
      // sostienen el andén de a poquito, y son las que dan continuidad al
      // recorrido entre un ancla y la siguiente.
      if (COMERCIO_ANDEN.indexOf(p.sub) !== -1)
        focos.push({ x:q.x, y:q.y, peso:2.2, media:180, w: FRANJA_PESO.todo, signo: 1 });
      if (p.sub === 'residencial')
        focos.push({ x:q.x, y:q.y, peso:1.1, media:200, w: FRANJA_PESO.picos, signo: 1 });
      const v = GENERA_VEHICULO[p.sub];
      if (v) focosVeh.push({ x:q.x, y:q.y, peso:v, media:400 });
    });
    // La vía es la fuente principal del calor vehicular, y por eso se guardó
    // cada tramo con su posición: el tránsito está SOBRE el corredor.
    const PESO_VIA = { trunk: 22, primary: 18, secondary: 12, tertiary: 8 };
    movilidad.tramosVia.forEach(function (t) {
      const q = enMetros(t);
      focosVeh.push({ x:q.x, y:q.y, peso: PESO_VIA[t.tipo] || 8, media: 160 });
    });

    const capaDia = new Array(N_CELDA * N_CELDA).fill(-1);
    const capaNoche = new Array(N_CELDA * N_CELDA).fill(-1);
    const capaVeh = new Array(N_CELDA * N_CELDA).fill(-1);
    const paso = (2 * radioM) / N_CELDA;
    let maxDia = 0, maxNoche = 0, maxVeh = 0;
    const crudo = { dia: [], noche: [], veh: [] };

    for (let j = 0; j < N_CELDA; j++) {
      for (let i = 0; i < N_CELDA; i++) {
        const idx = j * N_CELDA + i;
        // Centro de la celda en metros respecto al lote (y hacia el norte).
        const cx = -radioM + (i + 0.5) * paso;
        const cy = radioM - (j + 0.5) * paso;
        crudo.dia[idx] = crudo.noche[idx] = crudo.veh[idx] = null;
        if (Math.sqrt(cx * cx + cy * cy) > radioM) continue;   // fuera del círculo
        let dia = 0, noche = 0, veh = 0;
        for (let k = 0; k < focos.length; k++) {
          const f = focos[k];
          const dx = cx - f.x, dy = cy - f.y;
          const cerca = 1 / (1 + (dx * dx + dy * dy) / (f.media * f.media));
          const base = f.signo * f.peso * cerca;
          dia   += base * (f.w.manana + f.w.mediodia + f.w.tarde) / 3;
          noche += base * f.w.noche;
        }
        for (let k = 0; k < focosVeh.length; k++) {
          const f = focosVeh[k];
          const dx = cx - f.x, dy = cy - f.y;
          veh += f.peso / (1 + (dx * dx + dy * dy) / (f.media * f.media));
        }
        dia = Math.max(0, dia); noche = Math.max(0, noche);
        crudo.dia[idx] = dia; crudo.noche[idx] = noche; crudo.veh[idx] = veh;
        if (dia > maxDia) maxDia = dia;
        if (noche > maxNoche) maxNoche = noche;
        if (veh > maxVeh) maxVeh = veh;
      }
    }

    // Se normaliza cada capa contra su propio máximo: el mapa responde "dónde
    // más", no "cuánto" — para el cuánto está la cifra de flujo, que sí es
    // absoluta. Mezclarlas haría que un sector tranquilo se viera vacío.
    function normalizar(origen, destino, max){
      if (max <= 0) return;
      for (let k = 0; k < origen.length; k++) {
        if (origen[k] == null) continue;
        destino[k] = Math.round(100 * origen[k] / max);
      }
    }
    normalizar(crudo.dia, capaDia, maxDia);
    normalizar(crudo.noche, capaNoche, maxNoche);
    normalizar(crudo.veh, capaVeh, maxVeh);

    // Dónde está el punto más caliente, dicho en calle: "a 180 m hacia el
    // nororiente". Es el dato que convierte el mapa en una instrucción.
    const RUMBOS = ['el norte','el nororiente','el oriente','el suroriente',
                    'el sur','el suroccidente','el occidente','el noroccidente'];
    function foco(capa){
      let mejor = -1, idx = -1;
      for (let k = 0; k < capa.length; k++) if (capa[k] > mejor) { mejor = capa[k]; idx = k; }
      if (idx < 0 || mejor <= 0) return null;
      const i = idx % N_CELDA, j = Math.floor(idx / N_CELDA);
      const cx = -radioM + (i + 0.5) * paso, cy = radioM - (j + 0.5) * paso;
      const distM = Math.round(Math.sqrt(cx * cx + cy * cy));
      return {
        i, j, valor: mejor, distM,
        lat: centro.lat + cy / mLat, lng: centro.lng + cx / mLng,
        // A menos de media celda del lote, hablar de rumbo es inventar precisión.
        rumbo: distM < paso / 2 ? '' : RUMBOS[Math.round(((Math.atan2(cx, cy) * 180 / Math.PI + 360) % 360) / 45) % 8],
        texto: distM < paso / 2
          ? 'sobre el lote mismo'
          : 'a unos ' + distM + ' m hacia ' +
            RUMBOS[Math.round(((Math.atan2(cx, cy) * 180 / Math.PI + 360) % 360) / 45) % 8]
      };
    }
    flujo.mapaCalor = {
      n: N_CELDA, radioM, paso: Math.round(paso),
      centro: { lat: centro.lat, lng: centro.lng },
      peatonalDia: capaDia, peatonalNoche: capaNoche, vehicular: capaVeh,
      focoDia: foco(capaDia), focoNoche: foco(capaNoche), focoVehicular: foco(capaVeh),
      // Sin datos suficientes un mapa de calor es una mancha bonita que no
      // dice nada, y se ve igual de convincente. Se marca para poder avisarlo.
      fiable: pois.length >= 25
    };

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

    const maxF = Math.max(aporteFranja.manana, aporteFranja.mediodia,
                          aporteFranja.tarde, aporteFranja.noche) || 1;
    flujo.franjas = {
      manana:   Math.round(aporteFranja.manana / maxF * 100),
      mediodia: Math.round(aporteFranja.mediodia / maxF * 100),
      tarde:    Math.round(aporteFranja.tarde / maxF * 100),
      noche:    Math.round(aporteFranja.noche / maxF * 100)
    };
    const NOMBRE_FRANJA = { manana:'la mañana', mediodia:'el mediodía', tarde:'la tarde', noche:'la noche' };
    flujo.franjaFuerte = NOMBRE_FRANJA[
      ['manana','mediodia','tarde','noche'].reduce((mejor, k) =>
        flujo.franjas[k] > flujo.franjas[mejor] ? k : mejor, 'manana')];
    // Si la calle sigue viva de noche es un dato de negocio, no un detalle:
    // cambia el horario de apertura y hasta el formato del local.
    flujo.vidaNocturna = flujo.franjas.noche >= 60;
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

    // ── Desglose por rubro ────────────────────────────────────────────────
    // El mismo entorno contado por lo que es cada cosa, no solo por su grupo.
    // Es la diferencia entre decir "20 comercios" y decir "12 almacenes de
    // ropa, 3 peluquerías y 2 ferreterías": lo primero no ayuda a decidir qué
    // poner en un local; lo segundo sí.
    const rubros = Object.keys(porSub)
      .filter(s => porSub[s] > 0 && s !== 'otro')
      .map(s => {
        const c = TAXONOMIA.find(t => t.sub === s);
        return { sub: s, nombre: (c && c.nombre) || s, grupo: (c && c.grupo) || 'otro',
                 icono: (c && c.icono) || '', n: porSub[s],
                 ejemplos: (nombresPorSub[s] || []).slice(0, 3) };
      })
      .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'));

    return {
      total: pois.length, areaHa: Math.round(areaHa * 10) / 10,
      porGrupo, porSub, rubros,
      // Cuántos de esos puntos los puso el usuario, para poder declararlo.
      manuales,
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
    'gasolinera','restaurante','cafeteria','pagos','internet_cafe','local_comercial','comercio_otro']
    .concat(SUBS_COMERCIO_DETAL);

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

  // ── De qué vive la cuadra ───────────────────────────────────────────────
  // Contar comercios no dice nada por sí solo: 20 almacenes de ropa y 20
  // ferreterías dan el mismo número y son sectores opuestos. En el primero la
  // gente pasea, compara y consume de paso —ahí un café rinde—; en el segundo
  // llega, compra y se va, y ese mismo café se muere. Esto es lo que los
  // rubros abiertos permiten decir y antes no.
  const VOCACION_COMERCIAL = [
    { id:'abasto', nombre:'Abastecimiento diario',
      subs:['tienda_barrio','panaderia','supermercado','tienda_descuento','drogueria','licorera','veterinaria'],
      lectura:'La gente viene a resolver el día: visitas cortas, repetidas y casi siempre a pie. ' +
              'Favorece el formato pequeño y de alta rotación.' },
    { id:'antojo', nombre:'Compra por comparación',
      subs:['ropa','belleza','variedades','tienda_deportes','tecnologia','vivero','optica','muebles_hogar','centro_comercial'],
      lectura:'La gente recorre y compara antes de comprar: permanencia larga y consumo de paso. ' +
              'Es el entorno donde mejor rinde una cafetería o una comida rápida.' },
    { id:'encargo', nombre:'Compra por encargo',
      subs:['ferreteria','automotriz','papeleria','lavanderia','bodega'],
      lectura:'La gente llega con un mandado concreto y se va: mucho vehículo y poca caminata de vitrina. ' +
              'Un negocio que dependa del paseo tiene poco de dónde agarrarse.' },
    { id:'comida', nombre:'Comida y ocio',
      subs:['restaurante','cafeteria','bar_ocio','hotel','salon_eventos'],
      lectura:'El sector se activa por horarios de comida y de noche, no por horario de oficina.' },
    { id:'tramite', nombre:'Trámite y servicio',
      subs:['banco','pagos','notaria','internet_cafe','mensajeria','oficina','gobierno'],
      lectura:'Movimiento concentrado de lunes a viernes en horario hábil, y muy plano el fin de semana.' }
  ];

  function vocacionComercial(stats){
    const conteo = VOCACION_COMERCIAL.map(v => ({
      id: v.id, nombre: v.nombre, lectura: v.lectura,
      n: v.subs.reduce((a, s) => a + (stats.porSub[s] || 0), 0)
    })).sort((a, b) => b.n - a.n);
    const total = conteo.reduce((a, c) => a + c.n, 0);
    const top = conteo[0];
    // Se exige masa mínima y ventaja clara: con 3 negocios sueltos no se le
    // pone carácter a un sector, y si dos vocaciones empatan, el sector es
    // mixto y decirlo así es más honesto que forzar una etiqueta.
    if (!top || top.n < 5 || total < 8) return { id:'', nombre:'', reparto: conteo, share: 0 };
    const share = Math.round(100 * top.n / total);
    const segunda = conteo[1] || { n: 0 };
    if (top.n - segunda.n < 2) {
      return { id:'mixta', nombre:'Comercio mixto', share, reparto: conteo,
               lectura: 'Ninguna vocación domina: conviven ' + top.nombre.toLowerCase() + ' y ' +
                        segunda.nombre.toLowerCase() + '. El sector no tiene un solo público.' };
    }
    return { id: top.id, nombre: top.nombre, share, reparto: conteo, lectura: top.lectura };
  }

  // Cuánta y qué tan variada es la actividad comercial.
  function indicadorComercio(stats){
    const n = stats.porGrupo.comercio || 0;
    const categorias = SUBS_COMERCIO.filter(s => (stats.porSub[s] || 0) > 0);
    const densidad = stats.areaHa ? +(n / stats.areaHa).toFixed(2) : 0;
    const dominante = categorias.slice().sort((a, b) => stats.porSub[b] - stats.porSub[a])[0] || '';
    const ausentes = ['supermercado','drogueria','cafeteria','restaurante','banco'].filter(s => !(stats.porSub[s] || 0));
    // Los tres rubros que más pesan, con nombre y cifra: es lo que se cita en
    // el informe para que la lectura del sector se pueda verificar en la calle.
    const top = (stats.rubros || [])
      .filter(r => SUBS_COMERCIO.indexOf(r.sub) !== -1)
      .slice(0, 3)
      .map(r => ({ sub: r.sub, nombre: r.nombre, n: r.n, ejemplos: r.ejemplos }));
    const vocacion = vocacionComercial(stats);
    let nivel;
    if (n >= 60 && categorias.length >= 6) nivel = 'Alta actividad comercial';
    else if (n >= 20) nivel = 'Actividad comercial moderada';
    else if (categorias.length <= 2 && n > 0) nivel = 'Sector especializado';
    else nivel = 'Predominantemente residencial';
    return {
      total: n, categorias: categorias.length, densidad, dominante, ausentes, nivel,
      top, vocacion, tipo: 'indicador',
      detalle: n + ' establecimientos en ' + categorias.length + ' categorías distintas (' + densidad + ' por hectárea)' +
        (top.length ? '. Pesan sobre todo ' + top.map(t => t.n + ' ' + t.nombre.toLowerCase()).join(', ') : '') + '.' +
        (vocacion.nombre ? ' Vocación dominante: ' + vocacion.nombre.toLowerCase() +
                           ' (' + vocacion.share + '% de la oferta). ' + vocacion.lectura : '')
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
    // Deterioro comercial y físico. Es la señal más dura de todas y hasta
    // ahora no se veía: el local desocupado se contaba como comercio y la
    // ruina no se clasificaba. Un local vacío no es oferta, es la prueba de
    // que la cuadra no está reteniendo negocios.
    const vacios = stats.porSub.local_vacio || 0;
    const ruinas = stats.porSub.ruina || 0;
    if (vacios >= 3) {
      puntos += 16;
      señales.push(vacios + ' locales desocupados en el radio: la cuadra no está reteniendo negocios.');
    } else if (vacios > 0) {
      puntos += 6;
      señales.push(vacios + ' ' + plural(vacios, 'local desocupado', 'locales desocupados') + ' en el radio.');
    }
    if (ruinas >= 2) {
      puntos += 12;
      señales.push(ruinas + ' edificaciones en ruina: deterioro físico visible en el frente de calle.');
    }
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
  // Un "hoy no se identifica ninguno" es una afirmación fuerte, y en una zona
  // poco mapeada suele ser falsa: el gimnasio existe, pero nadie lo dibujó.
  // Peor aún, esa ausencia INFLA la oportunidad, porque el hueco de oferta se
  // calcula restando lo que se ve. Cuando el entorno viene pobre de datos se
  // dice "en el mapa abierto" y se avisa que conviene verificar en campo.
  function indicadorOportunidades(stats){
    // Cuántos habitantes sostienen un negocio de cada tipo. Antes solo se
    // miraban siete categorías, así que el informe decía "aquí falta una
    // droguería" y se callaba que no había ni una papelería ni una
    // lavandería en el radio. Los umbrales son órdenes de magnitud de
    // comercio de barrio colombiano, no cifras de mercado: sirven para
    // ordenar huecos entre sí, no para proyectar ventas.
    const UMBRAL_HAB = {
      belleza: 1800, cafeteria: 2500, panaderia: 3000, restaurante: 3000, ropa: 3000,
      drogueria: 3500, gimnasio: 4000, licorera: 4000, papeleria: 5000, variedades: 5000,
      salud_ips: 5000, banco: 6000, supermercado: 6000, automotriz: 6000, ferreteria: 7000,
      tecnologia: 8000, lavanderia: 9000, veterinaria: 12000, muebles_hogar: 12000,
      optica: 15000, tienda_deportes: 20000, vivero: 20000
    };
    const candidatos = Object.keys(UMBRAL_HAB);
    const nombre = {};
    candidatos.forEach(sub => {
      const cat = TAXONOMIA.find(t => t.sub === sub);
      nombre[sub] = (cat && cat.nombre) || sub;
    });
    nombre.banco = 'Servicios financieros';
    const umbral = UMBRAL_HAB;
    const out = [];
    // La misma señal que ya usa el flujo para avisar que el entorno viene
    // pobre de datos: si el radio tiene pocos puntos, una ausencia no prueba
    // que el uso no exista.
    const escaso = !!(stats.movilidad && stats.movilidad.flujo && stats.movilidad.flujo.datosEscasos);
    candidatos.forEach(s => {
      const existentes = stats.porSub[s] || 0;
      const soportadas = Math.floor(stats.poblacionEstimada / umbral[s]);
      if (soportadas - existentes >= 1 && stats.poblacionEstimada > 1500) {
        out.push({ sub: s, nombre: nombre[s], existentes, potencial: soportadas - existentes,
          // El nombre de la categoría ya se muestra como título del ítem, así
          // que aquí no se repite: evita plurales forzados tipo "servicios
          // financieros(s)", que en un informe para cliente se leen mal.
          texto: 'El sector podría sostener cerca de ' + soportadas +
            (existentes
              ? ' y hoy se identifican ' + existentes
              // Nunca se afirma una ausencia a secas. El análisis solo puede
              // ver lo que está mapeado, y un local que existe en la calle
              // pero que nadie dibujó se leía como un vacío de mercado: es la
              // diferencia entre "no hay" y "no lo veo".
              : ' y hoy no se identifica ninguno en el mapa abierto') +
            ', para ~' + stats.poblacionEstimada.toLocaleString('es-CO') + ' habitantes estimados.' +
            (!existentes
              ? (escaso
                  ? ' La zona está poco mapeada: verificar en campo antes de darlo por vacío.'
                  : ' Si conoces uno que no aparece, agrégalo al mapa y vuelve a consultar con "Datos frescos".')
              : '') });
      }
    });
    // Se ordena por tamaño del hueco PONDERADO por lo vacío que esté: si se
    // ordenara solo por cantidad ganarían siempre los rubros de umbral bajo
    // —peluquerías, cafeterías— y una categoría sin un solo local en el radio
    // no llegaría nunca a la lista, que es justo la que hay que mirar.
    const peso = o => o.potencial * (0.5 + 0.5 * (o.potencial / (o.potencial + o.existentes)));
    return { lista: out.sort((a, b) => peso(b) - peso(a)).slice(0, 5), tipo: 'interpretacion' };
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
    { id:'comercio',     nombre:'Comercio',     icono:'🛍️', subs:['supermercado','tienda_descuento','tienda_barrio','local_comercial','comercio_otro','centro_comercial'].concat(SUBS_COMERCIO_DETAL), complementarios:['residencial','parada_bus','oficina'], contable:true, unidad:'locales comerciales' },
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
    { id:'espacio_publico', nombre:'Espacio Público', icono:'🌳', subs:['parque','plaza'], competidores:['baldio_obra'], complementarios:['residencial','comercio_otro'] },
    { id:'supermercado', nombre:'Supermercado', icono:'🛒', subs:['supermercado','tienda_descuento','centro_comercial'], complementarios:['residencial'] },
    { id:'gimnasio',     nombre:'Gimnasio / Deportivo', icono:'🏋️', subs:['gimnasio','deportivo'], complementarios:['residencial'] },
    { id:'parqueadero',  nombre:'Parqueadero',  icono:'🅿️', subs:['transporte'], complementarios:['comercio_otro','oficina'], contable:true, unidad:'cupos de parqueo' },
    // Cajero bancario: comparte la sub 'banco' de la Matriz (amenity=atm ya
    // cae ahí), pero como programa se instala de a varios, así que es contable.
    { id:'cajero',       nombre:'Cajero bancario', icono:'🏧', subs:['banco'], complementarios:['supermercado','centro_comercial','oficina','residencial','universidad'], contable:true, unidad:'cajeros' },
    { id:'industria',    nombre:'Industria / Bodega', icono:'🏭', subs:['industria','bodega'], complementarios:['transporte'] },
    { id:'cultural',     nombre:'Cultural',     icono:'🎭', subs:['cultural'], complementarios:['universidad','restaurante'] },
    { id:'cuidado',      nombre:'Centro de Cuidado', icono:'🧓', subs:['hogar_cuidado'], complementarios:['residencial','salud_ips'] },
    { id:'religioso',    nombre:'Religioso / Culto', icono:'⛪', subs:['iglesia'], complementarios:['residencial'] },
    { id:'gubernamental',nombre:'Gubernamental', icono:'🏛️', subs:['gobierno'], complementarios:['notaria','banco'] },
    { id:'militar',      nombre:'Militar / Policial', icono:'🚓', subs:['policia'], complementarios:[] },
    { id:'judicial',     nombre:'Judicial', icono:'⚖️', subs:['notaria'], complementarios:['gobierno'] },
    // Usos "por definir": para cuando ya se sabe que habrá N unidades
    // comerciales o de oficina en arriendo, pero aún no qué negocio
    // específico irá en cada una. El score general usa la misma lógica
    // amplia de comercio/oficina; además disparan una recomendación
    // específica por unidad (ver recomendarUnidadesGenericas más abajo).
    { id:'comercial_indefinido', nombre:'Comercial (por definir)', icono:'🔍🛍️', generico:true, familia:'comercial', subs:['comercio_otro','local_comercial'].concat(SUBS_COMERCIO_DETAL), complementarios:['residencial','oficina'] },
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
    // MARCAS se expone para poder auditar la matriz completa desde fuera
    // (etiquetas + marcas), que es lo que alimenta assets/data/matriz-usos-osm.csv.
    TAXONOMIA, MARCAS, NOMBRE_USO, PROYECTOS, GRUPOS, GRUPO_COLOR,
    // Modo mixto (aditivo, no afecta lo anterior)
    USOS_PROGRAMA, normalizarUsos, scoreUso, calcularCompatibilidad,
    generarCompatibilidad, generarRecomendaciones, analizarMixto, recomendarUnidadesGenericas,
    leerReglasPersonalizadas, guardarReglaPersonalizada, calcularIndicadores,
    compararRadios, RADIOS_COMPARATIVA, filtrarPorRadio, normalizarNombre,
    // Bandeja de usos sin categoría: se llena sola en cada análisis.
    leerPendientes, registrarPendientes, exportarPendientes, resumenPendientes,
    resolverPendiente, descartarPendiente, olvidarPendientes, depurarPendientes
  };
})();
