/* URBIS · CATÁLOGO DE REPORTES RÁPIDOS (js/03c)
   ─────────────────────────────────────────────────────────────────────────
   Las secciones y los ~125 tipos de reporte que puede publicar un ciudadano,
   con su icono, su etiqueta y la dimensión de la Matriz a la que pertenecen.
   Es la ÚNICA fuente de verdad del panel de Alertas en Android y en escritorio:
   agregar o quitar una alerta aquí la agrega o la quita en las dos.

   Vive aparte porque estaba dentro de js/20 (369 KB, la app móvil completa) y
   eso obligaba a cargar el programa entero solo para saber qué tipos de reporte
   existen. Una carcasa ligera —la app de solo reportes y eventos— necesita este
   catálogo y nada más de aquel archivo.

   Sin dependencias: son listas y un Set. Puede cargarse en cualquier momento
   antes de quien lo consuma. */
(function(){
  'use strict';

  const URBIS_QUICK_REPORT_SECTIONS = [
    {
      id:'vial', label:'Vial y movilidad', icon:'🚦', hint:'Alertas rápidas de movilidad, infraestructura y ciudad.',
      items:[
        ['preventive-area','🛡️','Área preventiva','🚨 Alertas y Riesgos Urbanos'],
        ['traffic-crash','🚗','Accidente de tránsito','🚗 Reportes de Tráfico'],
        ['traffic-check','🚓','Retén de tránsito','🚗 Reportes de Tráfico'],
        // Pedido explícito: separado de "Retén de tránsito" porque varios
        // reportes ciudadanos ya usaban ese título específico ("Punto/Puesto
        // de control policial") para un puesto fijo de la Policía, distinto
        // de un retén móvil de tránsito.
        ['police-checkpoint','🚓','Punto de control policial','🚗 Reportes de Tráfico'],
        // Los tres retenes van juntos y separados a propósito: para quien va
        // en la vía no son la misma noticia. Uno de tránsito revisa papeles,
        // uno militar puede implicar cierre y demora larga, y uno ILEGAL no
        // es una autoridad — es un riesgo, y saber cuál es cambia si uno pasa,
        // se devuelve o llama.
        ['military-checkpoint','🪖','Retén militar','🚗 Reportes de Tráfico'],
        ['fake-traffic-checkpoint','🛑','Retén ilegal de tránsito','🚨 Alertas y Riesgos Urbanos'],
        ['road-hole','🕳️','Hueco en la vía','🚨 Alertas y Riesgos Urbanos'],
        ['road-closed','⛔','Vía cerrada','🚗 Reportes de Tráfico'],
        ['traffic-light','🚦','Semáforo dañado','🚗 Reportes de Tráfico'],
        ['road-work','🚧','Obra en la vía','🚗 Reportes de Tráfico'],
        ['heavy-traffic','🚙','Tráfico pesado','🚗 Reportes de Tráfico'],
        ['fallen-tree','🌳','Árbol caído u obstáculo','🚨 Alertas y Riesgos Urbanos'],
        ['stalled-car','🛞','Vehículo varado','🚗 Reportes de Tráfico'],
        ['open-drain','🕳️','Alcantarilla destapada','🚨 Alertas y Riesgos Urbanos'],
        ['water-leak','💧','Fuga de agua','🚨 Alertas y Riesgos Urbanos'],
        ['street-light','💡','Alumbrado público dañado','🚨 Alertas y Riesgos Urbanos'],
        ['trash','🗑️','Basura acumulada','🚨 Alertas y Riesgos Urbanos'],
        ['blocked-sidewalk','🚶','Andén obstruido','🚨 Alertas y Riesgos Urbanos'],
        ['blocked-bike-lane','🚲','Cicloruta bloqueada','🚗 Reportes de Tráfico'],
        ['animal-road','🐾','Animal en la vía','🚨 Alertas y Riesgos Urbanos'],
        ['fallen-pole','⚡','Poste caído','🚨 Alertas y Riesgos Urbanos'],
        ['wire-road','🔌','Cable en la vía','🚨 Alertas y Riesgos Urbanos'],
        ['sign-damaged','🚸','Señal dañada','🚗 Reportes de Tráfico'],
        ['bridge-bad','🌉','Puente o paso peatonal dañado','🚨 Alertas y Riesgos Urbanos'],
        ['bike-lane-damaged','🚲','Cicloruta en mal estado','🚗 Reportes de Tráfico'],
        ['bike-rack','🅿️','Bicicletero faltante o dañado','🚨 Alertas y Riesgos Urbanos'],
        ['crosswalk-missing','🚸','Cruce peatonal sin demarcación','🚨 Alertas y Riesgos Urbanos'],
        ['footbridge-rail','🌉','Puente peatonal sin baranda','🚨 Alertas y Riesgos Urbanos'],
        ['livestock-road','🐄','Semoviente suelto en vía','🚗 Reportes de Tráfico'],
        ['border-congestion','🛂','Congestión en paso fronterizo','🚗 Reportes de Tráfico']
      ]
    },
    {
      id:'security', label:'Seguridad y emergencias', icon:'🛡️', hint:'Reporta la situación. No publiques nombres, rostros ni datos personales.', sensitive:true,
      items:[
        ['robbery','🚨','Robo','🚨 Alertas y Riesgos Urbanos'],
        ['robbery-attempt','⚠️','Intento de robo','🚨 Alertas y Riesgos Urbanos'],
        ['assault','🚨','Asalto','🚨 Alertas y Riesgos Urbanos'],
        ['suspicious','👀','Persona sospechosa','🚨 Alertas y Riesgos Urbanos'],
        ['fight','⚠️','Riña o pelea','🚨 Alertas y Riesgos Urbanos'],
        ['vandalism','🧱','Vandalismo','🚨 Alertas y Riesgos Urbanos'],
        ['detonations','🔊','Disparos o detonaciones','🚨 Alertas y Riesgos Urbanos'],
        ['serious-security','🚨','Emergencia grave de seguridad','🚨 Alertas y Riesgos Urbanos'],
        ['aggression','⚠️','Violencia o agresión','🚨 Alertas y Riesgos Urbanos'],
        ['danger-zone','📍','Zona peligrosa','🚨 Alertas y Riesgos Urbanos'],
        ['harassment','🛡️','Acoso en espacio público','🚨 Alertas y Riesgos Urbanos'],
        ['threat','⚠️','Extorsión o amenaza','🚨 Alertas y Riesgos Urbanos'],
        ['substances','🚫','Consumo de sustancias en espacio público','🚨 Alertas y Riesgos Urbanos'],
        ['property-damage','🏚️','Daño a propiedad','🚨 Alertas y Riesgos Urbanos'],
        ['drug-use','💊','Consumo de drogas','🚨 Alertas y Riesgos Urbanos'],
        ['suspicious-package','🧨','Objeto o paquete sospechoso','🚨 Alertas y Riesgos Urbanos'],
        // Los hechos del conflicto armado se movieron a su propia sección
        // ('conflicto'): tienen otra autoridad competente y otra urgencia.
        // Ayuda urgente (antes sección "Emergencias y protección" aparte) —
        // se une acá porque es el mismo tipo de situación: personas en
        // riesgo que necesitan ayuda inmediata.
        ['need-ambulance','🚑','Necesito una ambulancia ahora','🚨 Alertas y Riesgos Urbanos'],
        ['mental-health-crisis','🧠','Persona en crisis de salud mental','🚨 Alertas y Riesgos Urbanos'],
        ['elder-abandonment','👴','Adulto mayor en abandono o riesgo','🚨 Alertas y Riesgos Urbanos'],
        ['minor-at-risk','🧒','Menor en situación de calle o riesgo','🚨 Alertas y Riesgos Urbanos']
      ]
    },
    {
      // Pestaña propia para el conflicto armado. Separada de 'security' porque
      // no es lo mismo un robo que un hecho del conflicto: cambia la autoridad
      // competente y cambia el riesgo para quien reporta.
      id:'conflicto', label:'Seguridad nacional', icon:'🛡️',
      hint:'Hechos del conflicto armado. Si hay vida en riesgo llama al 123 (o al 165, GAULA, si es secuestro o extorsión) ANTES de reportar aquí.',
      sensitive:true, conflicto:true,
      items:[
        ['kidnapping','🆘','Secuestro','🛡️ Seguridad Nacional y Conflicto'],
        ['extortion','💰','Extorsión o vacuna','🛡️ Seguridad Nacional y Conflicto'],
        ['homicide','🚨','Homicidio','🛡️ Seguridad Nacional y Conflicto'],
        ['massacre','🕯️','Masacre','🛡️ Seguridad Nacional y Conflicto'],
        ['disappearance','❓','Desaparición','🛡️ Seguridad Nacional y Conflicto'],
        ['attack-explosive','💣','Atentado con explosivos','🛡️ Seguridad Nacional y Conflicto'],
        ['landmine','⚠️','Mina antipersona (MAP/MUSE)','🛡️ Seguridad Nacional y Conflicto'],
        ['community-threat','🎯','Amenaza a la comunidad','🛡️ Seguridad Nacional y Conflicto'],
        ['leader-threat','📢','Amenaza a líder social','🛡️ Seguridad Nacional y Conflicto'],
        ['pamphlet','📄','Panfleto amenazante','🛡️ Seguridad Nacional y Conflicto'],
        ['child-recruitment','🧒','Reclutamiento de menores','🛡️ Seguridad Nacional y Conflicto'],
        ['extrajudicial','⚖️','Ejecución extrajudicial','🛡️ Seguridad Nacional y Conflicto'],
        ['armed-combat','🪖','Combate armado','🛡️ Seguridad Nacional y Conflicto'],
        ['illegal-checkpoint','🚷','Retén ilegal armado','🛡️ Seguridad Nacional y Conflicto'],
        ['armed-group','⚠️','Presencia de grupo armado','🛡️ Seguridad Nacional y Conflicto'],
        ['forced-displacement','🏃','Desplazamiento forzado','🛡️ Seguridad Nacional y Conflicto'],
        ['confinement','🚧','Confinamiento de comunidad','🛡️ Seguridad Nacional y Conflicto']
      ]
    },
    {
      id:'natural', label:'Desastres y riesgo natural', icon:'🌪️', hint:'Fenómenos naturales, clima y riesgos del terreno.',
      items:[
        ['cyclone','🌪️','Ciclón','🌪️ Desastres Naturales y Clima'],
        ['earthquake','🌎','Sismo','🌪️ Desastres Naturales y Clima'],
        // Distinto del genérico "Incendio o humo visible" (un conato local):
        // esto es para una emergencia forestal de varias hectáreas, que la
        // comunidad necesita ver activa por días, no por horas.
        ['wildfire','🔥🌲','Incendio forestal','🌪️ Desastres Naturales y Clima'],
        ['storm','⛈️','Tormenta','🌪️ Desastres Naturales y Clima'],
        ['tsunami-wave','🌊','Tsunami','🌪️ Desastres Naturales y Clima'],
        ['geological-damage','⛰️','Daño geológico','⛰️ Riesgos del Terreno'],
        ['river-rising','🌊','Nivel de río en aumento / riesgo de creciente','🌪️ Desastres Naturales y Clima'],
        // Movidos aquí desde Vial/Ambiente: son fenómenos naturales, no
        // fallas de infraestructura — quedan mejor agrupados por su causa.
        ['flood-road','🌊','Inundación en vía','🚨 Alertas y Riesgos Urbanos'],
        ['landslide','⛰️','Derrumbe o deslizamiento','🚨 Alertas y Riesgos Urbanos'],
        ['overflow','🌊','Desbordamiento de arroyo o canal','🚨 Alertas y Riesgos Urbanos'],
        ['rain-risk','🌧️','Riesgo por lluvia','🚨 Alertas y Riesgos Urbanos']
      ]
    },
    {
      id:'ambiental', label:'Ambiente y salud', icon:'🌿', hint:'Ambiente, salud pública y espacios comunitarios.',
      items:[
        ['fire-smoke','🔥','Incendio o humo visible','🚨 Alertas y Riesgos Urbanos'],
        ['pollution','🏭','Contaminación','Áreas Verdes y Ambiental'],
        ['bad-smell','💨','Mal olor fuerte','🚨 Alertas y Riesgos Urbanos'],
        ['noise','🔊','Ruido excesivo','🚨 Alertas y Riesgos Urbanos'],
        ['trash-burning','🔥','Quema de basura','🚨 Alertas y Riesgos Urbanos'],
        ['dark-zone','🌙','Zona sin iluminación','🚨 Alertas y Riesgos Urbanos'],
        ['stagnant-water','🦟','Agua estancada','🚨 Alertas y Riesgos Urbanos'],
        ['pest-danger','🐍','Plaga o animales peligrosos','Animal y Bienestar'],
        ['public-space','🚧','Espacio público invadido','🚨 Alertas y Riesgos Urbanos'],
        ['park-damage','🌳','Daño en parque o zona verde','Áreas Verdes y Ambiental'],
        ['industrial-noise','🏭','Ruido industrial fuera de horario','🚨 Alertas y Riesgos Urbanos'],
        ['water-source-pollution','🌊','Contaminación de fuente hídrica','Áreas Verdes y Ambiental'],
        ['vehicle-emissions','🚗','Emisión de gases vehicular/industrial','🚨 Alertas y Riesgos Urbanos'],
        ['crop-burning','🌾','Quema agrícola no controlada','🚨 Alertas y Riesgos Urbanos'],
        ['mosquito-breeding','🦟','Criadero de zancudos (dengue)','🚨 Alertas y Riesgos Urbanos'],
        ['market-sanitary-risk','🥬','Riesgo sanitario en plaza de mercado','🚨 Alertas y Riesgos Urbanos'],
        ['stray-animal','🐕','Animal callejero o herido','Animal y Bienestar'],
        ['animal-abuse','🚫','Maltrato animal','Animal y Bienestar'],
        ['wasp-nest','🐝','Nido de avispas o abejas peligroso','🚨 Alertas y Riesgos Urbanos'],
        ['rodents','🐀','Presencia de roedores','🚨 Alertas y Riesgos Urbanos']
      ]
    },
    {
      id:'espacio', label:'Espacio público y accesibilidad', icon:'🪑', hint:'Bancas, parques, patrimonio, accesibilidad y ocupación indebida.',
      items:[
        ['bench-damaged','🪑','Banca dañada','🚨 Alertas y Riesgos Urbanos'],
        ['playground-unsafe','🛝','Parque infantil inseguro','🚨 Alertas y Riesgos Urbanos'],
        ['public-bathroom','🚻','Baño público en mal estado','🚨 Alertas y Riesgos Urbanos'],
        ['fountain-broken','⛲','Bebedero dañado o sin agua','🚨 Alertas y Riesgos Urbanos'],
        ['shade-missing','🌳','Falta de sombra o arborización','Áreas Verdes y Ambiental'],
        ['bin-missing','🗑️','Caneca faltante o desbordada','🚨 Alertas y Riesgos Urbanos'],
        ['graffiti-heritage','🎨','Grafiti en sitio patrimonial','🚨 Alertas y Riesgos Urbanos'],
        ['monument-damage','🏛️','Deterioro de monumento histórico','🚨 Alertas y Riesgos Urbanos'],
        ['street-vendor-block','🛒','Venta ambulante bloqueando andén','🚨 Alertas y Riesgos Urbanos'],
        ['unauthorized-occupation','🏪','Ocupación no autorizada del espacio público','🚨 Alertas y Riesgos Urbanos'],
        ['ramp-damaged','♿','Rampa dañada o inexistente','🚨 Alertas y Riesgos Urbanos'],
        ['sidewalk-wheelchair','🦯','Andén sin acceso para silla de ruedas','🚨 Alertas y Riesgos Urbanos'],
        ['disabled-parking','🅿️','Parqueadero de discapacidad invadido','🚨 Alertas y Riesgos Urbanos'],
        ['traffic-light-sound','🔇','Semáforo sin señal sonora','🚨 Alertas y Riesgos Urbanos'],
        ['bus-stop-access','🚏','Parada de bus sin acceso','🚨 Alertas y Riesgos Urbanos']
      ]
    },
    {
      id:'servicios', label:'Servicios, vivienda y desarrollo', icon:'🏗️', hint:'Redes de servicios, construcción y ciudad preparada.',
      items:[
        ['gas-leak','🔥','Fuga de gas','🚨 Alertas y Riesgos Urbanos'],
        ['power-outage','🔌','Corte masivo de energía','🚨 Alertas y Riesgos Urbanos'],
        ['water-outage','🚰','Corte de agua programado','🚨 Alertas y Riesgos Urbanos'],
        ['internet-down','📶','Falla de internet o telecomunicaciones','🚨 Alertas y Riesgos Urbanos'],
        ['trash-collection-missed','🚛','Recolección de basura incumplida','🚨 Alertas y Riesgos Urbanos'],
        ['illegal-construction','🏗️','Construcción ilegal','🚨 Alertas y Riesgos Urbanos'],
        ['abandoned-building','🏚️','Predio o edificio abandonado','🚨 Alertas y Riesgos Urbanos'],
        ['informal-settlement','⚠️','Asentamiento informal en riesgo','🚨 Alertas y Riesgos Urbanos'],
        ['migrant-settlement','🏕️','Asentamiento de población migrante en riesgo','🚨 Alertas y Riesgos Urbanos'],
        ['first-aid-missing','🩹','Punto de primeros auxilios / desfibrilador faltante','🚨 Alertas y Riesgos Urbanos'],
        ['extinguisher-missing','🧯','Extintor faltante en edificio público','🚨 Alertas y Riesgos Urbanos'],
        ['hydrant-blocked','🚒','Hidrante bloqueado o dañado','🚨 Alertas y Riesgos Urbanos']
      ]
    }
  ];

  // ── Reportes donde puede haber gente herida ──────────────────────────────
  // En estos se pregunta por víctimas. Es la diferencia entre un mapa que dice
  // "aquí hubo choques" y uno que dice dónde se está matando gente, que es lo
  // que de verdad mueve a una secretaría de tránsito o de gestión del riesgo.
  //
  // Se deja FUERA el conflicto armado a propósito. Un conteo de muertos de una
  // masacre o un atentado es una cifra política, la publican autoridades y
  // organismos con verificación, y equivocarla —o acertarla demasiado pronto—
  // tiene consecuencias para la comunidad y para quien reporta. Ahí el reporte
  // sigue siendo del hecho, no de las víctimas.
  const VICTIMAS_IDS = new Set([
    'traffic-crash',        // accidente de tránsito
    'serious-security',     // emergencia grave de seguridad
    'fire-smoke',           // incendio o humo visible
    'wildfire',             // incendio forestal
    'landslide',            // derrumbe o deslizamiento
    'geological-damage',    // daño geológico
    'flood-road',           // inundación en vía
    'overflow',             // desbordamiento
    'storm',                // tormenta
    'earthquake'            // sismo
  ]);

  const MANDATORY_PHOTO_IDS = new Set([
    'road-hole','road-closed','traffic-light','road-work','fallen-tree','landslide',
    'stalled-car','open-drain','water-leak','street-light','trash','blocked-sidewalk',
    'blocked-bike-lane','fallen-pole','wire-road','sign-damaged','bridge-bad',
    'property-damage','fire-smoke','pollution','trash-burning','stagnant-water',
    'public-space','park-damage',
    // Categorías nuevas (v359) — mismo criterio que las de arriba: se pide
    // foto cuando es daño de infraestructura/ambiental verificable con una
    // imagen. Se deja SIN foto obligatoria lo sensible/social (personas en
    // riesgo, asentamientos, animales en movimiento) y lo que es difícil o
    // peligroso de fotografiar (ruido, tráfico, semoviente en vía).
    'bike-lane-damaged','footbridge-rail','ramp-damaged','bench-damaged',
    'playground-unsafe','public-bathroom','fountain-broken','bin-missing',
    'graffiti-heritage','monument-damage','gas-leak','trash-collection-missed',
    'illegal-construction','abandoned-building','wasp-nest','water-source-pollution',
    'crop-burning','market-sanitary-risk','mosquito-breeding','first-aid-missing',
    'extinguisher-missing','hydrant-blocked','disabled-parking'
  ]);

  const URBIS_QUICK_REPORTS = URBIS_QUICK_REPORT_SECTIONS.reduce((acc, section)=>{
    section.items.forEach(([id, icon, label, dim])=>{
      // Dos tuplas con el mismo id se pisaban sin avisar: el botón de arriba
      // quedaba publicando el reporte de abajo, y en el mapa salía la
      // categoría equivocada. Con 125 tipos, la colisión es cuestión de
      // tiempo y a simple vista no se ve.
      if(acc[id]) console.warn('URBIS: id de reporte repetido "' + id + '" — "' +
        acc[id].label + '" queda pisado por "' + label + '"');
      // `conflicto` se arrastra igual que `sensitive`: quien publica un hecho
      // del conflicto armado necesita cuenta verificada y firma anónima, y sin
      // esta bandera el guardado no puede distinguirlo de una alerta normal.
      acc[id] = {id, icon, label, dim, section:section.id,
                 sensitive:!!section.sensitive, conflicto:!!section.conflicto};
    });
    return acc;
  }, {});

  // Vínculo Android↔PC (pedido explícito): este catálogo (secciones, items,
  // iconos) es la ÚNICA fuente de verdad del panel de Alertas en AMBAS
  // plataformas. El panel de escritorio (js/10-visible-markers.js) lee estos
  // mismos globales para pintar exactamente los mismos datos e iconos que
  // Android — agregar/quitar una alerta aquí la agrega/quita en las dos.
  window.URBIS_QUICK_REPORT_SECTIONS = URBIS_QUICK_REPORT_SECTIONS;
  window.URBIS_QUICK_REPORTS = URBIS_QUICK_REPORTS;

  // MANDATORY_PHOTO_IDS también se publica: js/20 lo usaba como local y la
  // carcasa ligera necesita saber en qué reportes la foto es obligatoria.
  window.URBIS_MANDATORY_PHOTO_IDS = MANDATORY_PHOTO_IDS;
  window.URBIS_VICTIMAS_IDS = VICTIMAS_IDS;
})();
