/* URBIS · ANÁLISIS DEL SECTOR EN MODO EDUCATIVO (js/64)
   ─────────────────────────────────────────────────────────────────────────
   El modo empresas analiza un lote con datos de OpenStreetMap. Aquí se hace
   el MISMO análisis —población del DANE proyectada a hoy, flujo peatonal y
   vehicular, mapas de calor, composición por rubro, oportunidades y FODA—
   pero sobre lo que los estudiantes mapearon con sus propias manos.

   Eso cambia dos cosas, y las dos importan pedagógicamente:

   1. El resultado depende de cuánto hayan mapeado. Si el curso levantó tres
      cuadras, el análisis habla de tres cuadras. Se dice con todas las letras
      en vez de presentar un número como si fuera la verdad del sector: media
      hoja de este módulo es enseñar que un dato incompleto no es un dato
      falso, pero tampoco es un dato completo.
   2. La categoría no se deduce, se sabe. En el modo empresas hay que adivinar
      qué es cada punto a partir de etiquetas de OSM; aquí el estudiante ya
      dijo qué es. Se traduce su Matriz de Usos (47 usos con sus tipos) a las
      subcategorías del motor y se pasa como categoría exacta.

   Reutiliza tal cual el motor (js/60), la capa de datos del DANE (js/61) y el
   generador de informe (js/63): un cambio en el análisis del modo empresas
   llega solo al modo educativo, y al revés. */
(function(){
  'use strict';

  // ── Traducción: Matriz de Usos del estudiante → subcategorías del motor ──
  //
  // Al guardar, la app arma la etiqueta como "Uso · Tipo". El uso da la
  // categoría general y el tipo la afina cuando hace falta: "Comercial" solo
  // no dice nada —una droguería y un taller son cosas opuestas para el
  // análisis— pero "Comercial · Droguería / farmacia" sí.
  const USO_A_SUB = {
    'Residencial': 'residencial',
    'Vivienda de Interés Social (VIS/VIP)': 'residencial',
    'Ocio / Negocio': 'bar_ocio',
    'Deportivo': 'deportivo',
    'Esp. Público': 'parque',
    'Comercial': 'comercio_otro',
    'Parqueadero / Estacionamiento': 'transporte',
    'Turístico / Hotelero': 'hotel',
    'Zona Franca / Comercio Exterior': 'bodega',
    'Estación de Servicio (Gasolinera)': 'gasolinera',
    'Abastecimiento Mayorista (Central de Abastos)': 'supermercado',
    'Institucional': 'gobierno',
    'Gubernamental / Administrativo': 'gobierno',
    'Militar / Policial': 'policia',
    'Seguridad / Judicial': 'notaria',
    'Industrial (Pesada/Ligera)': 'industria',
    'Logístico / Almacenamiento': 'bodega',
    'Extractivo (Minería/Canteras)': 'industria',
    'Logística de carga (patios y talleres)': 'bodega',
    'Salud (Clínicas/Hospitales)': 'salud_ips',
    'Emergencias (Bomberos/Rescate)': 'bomberos',
    'Cuidado Animal (Veterinaria)': 'veterinaria',
    'Hogar de Cuidado': 'hogar_cuidado',
    'Cultural / Patrimonio': 'cultural',
    'Educativo (Básico/Superior)': 'colegio',
    'Religioso / Culto': 'iglesia',
    'Espacio Ferial / Eventos Masivos': 'salon_eventos',
    'Mobiliario Urbano': 'mobiliario',
    'Gestión de Residuos / Reciclaje': 'infra_servicios',
    'Transporte (Terminales/Estaciones)': 'parada_bus',
    'Infra. Servicios (Plantas)': 'infra_servicios',
    'Comunicaciones / Antenas': 'infra_servicios',
    'Servicios Funerarios': 'funerario',
    'Vías e Infraestructura Vial': 'via_arteria',
    'Protección Ambiental': 'verde_natural',
    'Forestal': 'verde_natural',
    'Agropecuario / Rural': 'verde_natural',
    'Ronda Hídrica / Protección de Cuerpos de Agua': 'agua',
    'Zona Baldía': 'baldio',
    'Zona de Riesgo': 'baldio',
    'En Obra / Construcción': 'en_obra',
    'Abandono / Ruina': 'ruina',
    'Espacio Residual': 'baldio',
    'Asentamiento Informal': 'asentamiento',
    'Zona de Expansión Urbana': 'baldio',
    'Mixto (Residencial-Comercial)': 'mixto',
    'Mixto (Residencial-Industrial)': 'mixto',
    'Uso Múltiple / Mixto General': 'mixto'
  };

  // El tipo exacto manda sobre el uso. Solo se listan los que de verdad
  // cambian la lectura: si "Comercial" y "Comercial · Ferretería" acabaran
  // en la misma casilla, el análisis no distinguiría una calle de vitrinas
  // de un corredor de materiales, que es justo lo que hay que enseñar.
  const TIPO_A_SUB = {
    // Comercial, abierto en rubros igual que en el modo empresas.
    'Café de paso (formato rápido)': 'cafeteria',
    'Café de estancia (formato premium)': 'cafeteria',
    'Local pequeño (tienda de barrio)': 'tienda_barrio',
    'Centro comercial': 'centro_comercial',
    'Supermercado / gran superficie': 'supermercado',
    'Plaza de mercado (minorista)': 'local_comercial',
    'Almacén de cadena': 'ropa',
    'Servicios personales (peluquería, lavandería)': 'belleza',
    'Taller mecánico / lavadero': 'automotriz',
    'Ferretería / materiales': 'ferreteria',
    'Panadería / repostería': 'panaderia',
    'Papelería / miscelánea': 'papeleria',
    'Droguería / farmacia': 'drogueria',
    'Tecnología / celulares': 'tecnologia',
    'Ropa / calzado': 'ropa',
    'Comercio informal fijo (caseta)': 'comercio_otro',
    // Deportivo: el gimnasio mueve gente a horas fijas; una cancha no.
    'Gimnasio / CrossFit': 'gimnasio',
    'Gimnasio al aire libre (biosaludable)': 'gimnasio',
    // Espacio público: plaza dura y parque verde no son lo mismo.
    'Plaza / plazoleta': 'plaza',
    'Plaza cívica / de banderas': 'plaza',
    'Andén / vía peatonal': 'plaza',
    'Alameda': 'plaza',
    'Bulevar': 'plaza',
    'Plazoleta de comidas': 'plaza',
    // Ocio.
    'Restaurante de entretenimiento': 'restaurante',
    'Licorera / estanco': 'licorera',
    'Sala de eventos / recepciones': 'salon_eventos',
    'Zona de comidas nocturna': 'restaurante',
    // Salud.
    'Farmacia / droguería': 'drogueria',
    'Laboratorio clínico': 'laboratorio',
    'Imágenes diagnósticas': 'laboratorio',
    'Banco de sangre': 'laboratorio',
    'Centro de rehabilitación': 'hogar_cuidado',
    'Consultorio independiente': 'salud_otro',
    // Educación: un colegio y una universidad generan flujos distintos.
    'Universidad': 'universidad',
    'Instituto técnico / tecnológico': 'universidad',
    'Centro de investigación': 'universidad',
    'Centro de capacitación (SENA)': 'capacitacion',
    'Escuela de idiomas': 'capacitacion',
    'Academia (música, danza…)': 'capacitacion',
    'Biblioteca escolar': 'cultural',
    // Institucional y financiero.
    'Notaría': 'notaria',
    'Atención de servicios públicos': 'pagos',
    'Casa de cambio / cambista': 'banco',
    // Transporte y mobiliario.
    'Parada de bus / paradero': 'parada_bus',
    'Estación de bus / metro': 'parada_bus',
    'Estación de transporte masivo (BRT)': 'parada_bus',
    'Parada techada': 'parada_bus',
    'Ciclo-estación (bicis públicas)': 'bici_publica',
    'Terminal intermunicipal': 'parada_bus',
    'Terminal satélite': 'parada_bus',
    // Cultura.
    'Sala de cine / cineteca': 'cultural',
    'Cementerio': 'funerario',
    'Cementerio parroquial': 'funerario',
    // Vivienda / hospedaje.
    'Alojamiento de plataforma (tipo Airbnb)': 'residencial',
    'Inquilinato / pieza en arriendo': 'residencial'
  };

  // Las vías no son puntos: alimentan la malla vial, y su jerarquía decide la
  // exposición del sector. Se traduce al valor de `highway` que el motor
  // entiende, porque de ahí sale el tránsito estimado.
  // ── Infraestructura peatonal ──────────────────────────────────────────
  // Trece de los catorce elementos de "Infraestructura y Peatonal" se estaban
  // descartando: el módulo calculaba flujo peatonal tirando a la basura
  // justamente lo que dice si se puede caminar por ahí. El paradero era el más
  // caro de perder — es el generador de caminata más pesado que tiene el motor.
  const TIPO_INFRA_A_SUB = {
    'Paradero de bus': 'parada_bus',
    'Semáforo vehicular / peatonal': 'mobiliario',
    'Banca de parque': 'mobiliario',
    'Caneca de basura': 'mobiliario',
    'Luminaria LED/Sodio': 'mobiliario',
    'Poste concreto / madera': 'mobiliario',
    // Cableado expuesto es infraestructura sin frente activo: el motor ya la
    // penaliza como fachada muerta, que es exactamente lo que es en la acera.
    'Cableado expuesto': 'infra_servicios'
  };

  // El estado del andén NO es un punto de interés: es la condición de la
  // superficie por la que se camina. Un "andén continuo" no genera peatones,
  // permite que caminen los que ya hay. Por eso no se traduce a un elemento
  // —contarlo como POI inflaría la densidad con algo que no es un destino—
  // sino que alimenta el factor de caminabilidad del motor.
  const TIPO_A_ANDEN = {
    'Andén continuo': 1,
    'Andén interrumpido': 0.5,
    'Sin andén / Bordillo': 0
  };
  const TIPO_RAMPA = 'Rampa de acceso';

  const TIPO_A_VIA = {
    'Vía principal / arteria': 'primary',
    'Vía secundaria / local': 'secondary',
    'Ciclorruta': 'cycleway',
    'Puente vehicular': 'secondary',
    'Intercambiador (glorieta, deprimido)': 'primary',
    'Túnel': 'secondary',
    'Peaje': 'trunk',
    // Se mapeaban y no llegaban al análisis. La calle de tierra entra como
    // vía menor: sigue siendo por donde se pasa, aunque no esté pavimentada.
    'Calle asfaltada / adoquinada': 'residential',
    'Calle de tierra': 'unclassified'
  };

  function partirEtiqueta(descripcion){
    // "Uso · Tipo | nota | ..." → { uso, tipo }
    const cabeza = String(descripcion || '').split(' | ')[0];
    const partes = cabeza.split('·').map(s => s.trim());
    return { uso: partes[0] || '', tipo: partes[1] || '', cabeza: cabeza.trim() };
  }

  // Traduce un punto mapeado por el estudiante a un elemento con la forma que
  // espera el motor. Devuelve null si no se puede situar o no se reconoce.
  function puntoAElemento(p, i){
    if (!p) return null;
    const lat = parseFloat(String(p.lat || '').replace(',', '.'));
    const lng = parseFloat(String(p.lng || '').replace(',', '.'));
    if (!isFinite(lat) || !isFinite(lng)) return null;
    const et = partirEtiqueta(p.descripcion);
    const via = TIPO_A_VIA[et.tipo];

    // Una vía es una vía: no tiene pisos ni usos que repartir.
    if (via) {
      return [{ type: 'node', id: 'edu' + i, lat: lat, lon: lng,
                tags: { highway: via, name: et.cabeza } }];
    }

    const EDIF = window.URBIS_EDIFICIO || null;
    const ficha = EDIF ? EDIF.leer(p.descripcion) : { pisos: 1, materialidad: '' };
    const marcados = EDIF ? EDIF.usosMarcados(p.descripcion) : [];

    // Los usos que el estudiante marcó en la matriz, traducidos y sin repetir:
    // dos usos distintos pueden caer en la misma subcategoría (Forestal y
    // Protección Ambiental son ambos verde_natural) y contarlos dos veces
    // inflaría el edificio sin que haya nada más en la calle.
    const subs = [];
    marcados.forEach(function (u) {
      const sub = USO_A_SUB[u];
      if (sub && subs.indexOf(sub) === -1) subs.push(sub);
    });

    // Si no marcó nada en la matriz, se cae al uso de la cabecera: es como
    // funcionaba antes de que existiera la ficha, y así lo ya mapeado sigue
    // entrando al análisis.
    if (!subs.length) {
      const sub = TIPO_A_SUB[et.tipo] || TIPO_INFRA_A_SUB[et.tipo] || USO_A_SUB[et.uso];
      if (!sub) return null;
      subs.push(sub);
    }

    // Verticalidad repartida entre los usos. Un edificio de 8 pisos con 8 usos
    // da intensidad 1 a cada uno — que es justo lo que es: ocho
    // establecimientos reales, uno por planta. Un local de 1 piso con 8 usos da
    // 1/8 a cada uno, porque es un solo sitio pequeño haciendo varias cosas. Y
    // una torre de 12 pisos con un solo uso da 12, que es la diferencia entre
    // una casa y una torre que el análisis antes no veía.
    let intensidad = ficha.pisos / subs.length;
    let intensidadDe = function () { return intensidad; };

    /* Y cuando el estudiante dijo qué hay en CADA planta, se reparte por
       planta y no por igual: tienda abajo y dos pisos de vivienda arriba es
       un comercio de intensidad 1 y una vivienda de intensidad 2, no un
       «mixto» de tres. La cabecera del punto se mantiene como uso nominal
       solo si ninguna planta la cubre. */
    const porPlanta = (ficha.usosPorPiso || []);
    if (porPlanta.length && EDIF && typeof EDIF.subDeUsoPiso === 'function') {
      /* Cada planta vale UNO y se reparte entre lo que hay en ella. Un piso
         con gimnasio, cafetería y oficina no son tres pisos: es un piso
         partido en tres, y contarlo como tres inflaría el edificio hasta
         hacerlo pesar más que la torre de al lado. Así, un edificio de cinco
         pisos siempre suma cinco, se reparta como se reparta. */
      const porPiso = {};
      porPlanta.forEach(function (x) {
        (porPiso[x.piso] = porPiso[x.piso] || []).push(x.uso);
      });
      const cuenta = {};
      Object.keys(porPiso).forEach(function (p) {
        const usos = porPiso[p], parte = 1 / usos.length;
        usos.forEach(function (u) {
          const sub = EDIF.subDeUsoPiso(u);
          if (sub) cuenta[sub] = (cuenta[sub] || 0) + parte;
        });
      });
      const subsPlanta = Object.keys(cuenta);
      if (subsPlanta.length) {
        subs.length = 0;
        subsPlanta.forEach(function (s2) { subs.push(s2); });
        intensidadDe = function (sub) {
          return Math.round((cuenta[sub] || 1) * 100) / 100;
        };
      }
    }

    return subs.map(function (sub, k) {
      return {
        type: 'node', id: 'edu' + i + '_' + k, lat: lat, lon: lng,
        tags: (function(){
          const t = {
            'urbis:sub': sub,
            'urbis:intensidad': String(intensidadDe(sub)),
            'building:levels': String(ficha.pisos),
            name: et.cabeza
          };
          if (ficha.mezcla && ficha.mezcla.mixto) t['urbis:mixto'] = 'si';
          // Solo se marca cuando el estudiante lo registró. Si no lo miró, el
          // análisis se comporta como siempre: "no lo sabemos" no es "no hay
          // frente activo", y dar por muerta una fachada no observada sería
          // inventar un dato en contra.
          if (ficha.frenteActivo !== null && ficha.frenteActivo !== undefined) {
            t['urbis:frente'] = ficha.frenteActivo ? 'activo' : 'muerto';
            if (ficha.plantaBaja) t['urbis:planta_baja'] = ficha.plantaBaja;
          }
          return t;
        })()
      };
    });
  }

  // ── Qué mapeó el curso, y qué de eso el análisis puede leer ──────────────
  function reunirElementos(centro, radioM){
    const datos = (typeof window.urbisDatosVisibles === 'function')
      ? window.urbisDatosVisibles()
      : (window.URBIS_EDU_DATOS || []);
    const M = window.AIA_MOTOR;
    const elementos = [], sinTraducir = {};
    let dentro = 0;
    // Observaciones del andén: no son elementos, son la condición de la
    // superficie por la que se camina. Se acumulan aparte.
    const anden = { continuo: 0, interrumpido: 0, sinAnden: 0, rampas: 0, suma: 0, muestras: 0 };
    // Antigüedad y vulnerabilidad potencial del tejido construido. Se cuenta
    // por edificio (no por uso), así que va aquí y no en el abanico de usos:
    // una torre con ocho usos es UN edificio con una época y un material.
    const edif = { total: 0, conEpoca: 0, conMaterial: 0, evaluables: 0,
                   porEpoca: {}, porMaterial: {}, alta: 0, media: 0, baja: 0,
                   anteriores1984: 0, patrimonio: 0, enObra: 0,
                   // Los límites declarados: cuántas veces el curso dijo "no se
                   // sabe" y cuántas dijo "otro". Lo segundo es una lista de
                   // trabajo, no un fallo: son los valores que el vocabulario
                   // todavía no tiene.
                   noSeSabe: 0, otros: 0, textosOtro: [] };
    (datos || []).forEach(function (p, i) {
      const lat = parseFloat(String(p && p.lat || '').replace(',', '.'));
      const lng = parseFloat(String(p && p.lng || '').replace(',', '.'));
      if (!isFinite(lat) || !isFinite(lng)) return;
      if (M.haversineM(centro, { lat: lat, lng: lng }) > radioM) return;
      dentro++;

      const et = partirEtiqueta(p.descripcion);
      // Una rampa no puntúa la calidad del andén, pero sí es un dato de
      // accesibilidad que el informe debe poder nombrar.
      if (et.tipo === TIPO_RAMPA) { anden.rampas++; return; }
      const nota = TIPO_A_ANDEN[et.tipo];
      if (nota !== undefined) {
        anden.suma += nota; anden.muestras++;
        if (nota === 1) anden.continuo++;
        else if (nota === 0) anden.sinAnden++;
        else anden.interrumpido++;
        return;
      }

      // La ficha del edificio se contabiliza una vez por punto, antes de que el
      // abanico lo convierta en varios elementos.
      const EDIF = window.URBIS_EDIFICIO;
      if (EDIF) {
        const ficha = EDIF.leer(p.descripcion);
        const tieneAlgo = ficha.epoca || ficha.pisosRegistrados ||
                          ficha.materialidad !== EDIF.SIN_REGISTRAR;
        if (tieneAlgo || ficha.noSeSabe || ficha.otros) {
          edif.total++;
          edif.noSeSabe += ficha.noSeSabe;
          edif.otros += ficha.otros;
          if (ficha.otroTexto && edif.textosOtro.indexOf(ficha.otroTexto) === -1) {
            edif.textosOtro.push(ficha.otroTexto);
          }
          if (ficha.enObra) edif.enObra++;
          if (ficha.epoca) {
            edif.conEpoca++;
            edif.porEpoca[ficha.epoca] = (edif.porEpoca[ficha.epoca] || 0) + 1;
            if (ficha.epoca === 'Anterior a 1950') edif.patrimonio++;
            if (/Anterior a 1950|1950 – 1983/.test(ficha.epoca)) edif.anteriores1984++;
          }
          // materialidadUtil ya viene en blanco si fue "sin registrar",
          // "no se sabe" u "otro": ninguna de las tres es una observación con
          // la que se pueda calcular nada.
          if (ficha.materialidadUtil) {
            edif.conMaterial++;
            edif.porMaterial[ficha.materialidadUtil] =
              (edif.porMaterial[ficha.materialidadUtil] || 0) + 1;
          }
          if (ficha.vulnerabilidad) {
            edif.evaluables++;
            const n = ficha.vulnerabilidad.nivel;
            if (n === 'Alta') edif.alta++; else if (n === 'Media') edif.media++; else edif.baja++;
          }
        }
      }

      const els = puntoAElemento(p, i);
      if (els && els.length) { els.forEach(function (e) { elementos.push(e); }); return; }
      // Lo que no se pudo traducir se cuenta y se muestra: es la lista de lo
      // que le falta a la traducción, y sirve para mejorarla con el curso.
      const clave = et.cabeza || '(sin descripción)';
      sinTraducir[clave] = (sinTraducir[clave] || 0) + 1;
    });

    // Índice 0..1 y su factor acotado. Ver el motor para por qué es un factor
    // y no un generador, y por qué el rango no puede vaciar una calle.
    const indice = anden.muestras ? anden.suma / anden.muestras : null;
    const caminabilidad = {
      muestras: anden.muestras, continuo: anden.continuo,
      interrumpido: anden.interrumpido, sinAnden: anden.sinAnden, rampas: anden.rampas,
      indice: indice === null ? null : Math.round(indice * 100) / 100,
      factor: indice === null ? 1 : Math.round((0.75 + 0.35 * indice) * 100) / 100,
      nivel: indice === null ? 'sin datos'
        : indice >= 0.8 ? 'Buena' : indice >= 0.5 ? 'Irregular' : 'Mala'
    };
    return { elementos: elementos, dentro: dentro, sinTraducir: sinTraducir,
             caminabilidad: caminabilidad, edificacion: edif };
  }

  // ── El análisis ─────────────────────────────────────────────────────────
  async function analizar(centro, radioM, proyectoId){
    if (!window.AIA_MOTOR) throw new Error('El motor de análisis no está cargado.');
    const reunido = reunirElementos(centro, radioM);

    // Censo y proyección: esto NO depende de lo que el curso haya mapeado,
    // viene del DANE. Es la mitad del análisis que siempre está completa, y
    // por eso conviene que los estudiantes la vean incluso con pocos puntos.
    let dane = null, ubicacion = null, danePorRadio = {};
    try {
      if (window.AIA_DATOS && window.AIA_DATOS.ubicacionDe) {
        ubicacion = await window.AIA_DATOS.ubicacionDe(centro.lat, centro.lng);
      }
    } catch(e) { ubicacion = null; }
    /* El censo se pide para el radio analizado Y para los de la comparativa.
       El motor devuelve el sector medido en varios anillos —lo que se dibuja
       en «el entorno según la distancia»— y sin censo por anillo cada uno cae
       a la estimación heurística: la línea de habitantes por hectárea diría
       una cosa y el KPI de arriba otra, sacadas de fuentes distintas, sin que
       nada lo avise. Si el servicio no responde, `dane` queda en null y el
       motor usa su estimación de siempre: el análisis nunca se bloquea. */
    const municipio = (ubicacion && ubicacion.ciudad) || '';
    const radiosDane = ((window.AIA_MOTOR && window.AIA_MOTOR.RADIOS_COMPARATIVA) || [])
      .filter(r => r < radioM).concat([radioM])
      .filter((r, i, a) => a.indexOf(r) === i);
    try {
      if (window.AIA_DATOS && window.AIA_DATOS.consultarDANE) {
        const res = await Promise.all(radiosDane.map(r =>
          window.AIA_DATOS.consultarDANE(centro.lat, centro.lng, r, municipio).catch(() => null)));
        radiosDane.forEach((r, i) => { if (res[i]) danePorRadio[r] = res[i]; });
        dane = danePorRadio[radioM] || null;
      }
    } catch(e) { dane = null; }

    const resultado = await window.AIA_MOTOR.analizar({
      elementos: reunido.elementos, radioM: radioM, centro: centro,
      tipoEstudio: 'completo', proyectoId: proyectoId || null,
      direccionAprox: (ubicacion && ubicacion.ciudad) || '', dane: dane,
      danePorRadio: danePorRadio,
      caminabilidad: reunido.caminabilidad
    });
    resultado.edu = {
      puntosDelCurso: reunido.dentro,
      leidos: reunido.elementos.length,
      sinTraducir: reunido.sinTraducir,
      caminabilidad: reunido.caminabilidad,
      edificacion: reunido.edificacion,
      ciudad: (ubicacion && ubicacion.ciudad) || ''
    };
    return resultado;
  }

  /* ── Qué forma tiene la traza ──────────────────────────────────────────
     Va aparte del análisis y a botón, no automático, por dos razones que no
     son de comodidad:

     · Overpass no acepta dos consultas seguidas: hay cinco segundos de
       espera entre una y otra. Encadenarla al análisis obligaría a esperar
       con la pantalla en blanco por un dato que no todos los ejercicios
       piden.

     · Y esto NO depende de lo que el curso haya mapeado. La forma de la
       traza sale de las calles que ya están en OpenStreetMap, así que un
       curso que levantó ocho puntos recibe la misma respuesta que uno que
       levantó cuatrocientos. Merece decirse en pantalla: es de las pocas
       cosas del módulo que no mejora mapeando más. */
  async function forma(centro, radioM){
    if (!window.AIA_DATOS || !window.AIA_DATOS.consultarVias) {
      throw new Error('Falta el módulo de datos. Recargá la aplicación.');
    }
    if (!window.AIA_REMOTO || !window.AIA_REMOTO.trazado) {
      throw new Error('El servidor de análisis no está configurado en este navegador.');
    }
    const vias = await window.AIA_DATOS.consultarVias(centro.lat, centro.lng, radioM);
    const trz = await window.AIA_REMOTO.trazado({
      elementos: vias || [], radioM: radioM, centro: { lat: centro.lat, lng: centro.lng }
    });
    return {
      morfologia: (trz && trz.morfologia) || null,
      vias: (trz && trz.vias) || null,
      // Cuántas calles sostienen la respuesta. Sin esto, «ortogonal» sacado
      // de seis calles se lee igual que sacado de trescientas.
      nVias: (vias || []).length
    };
  }

  /* ── El sector en su contexto ──────────────────────────────────────────
     Comuna y barrio, rutas de buseta, frontera y casas de cambio. Nada de
     esto sale de lo que el curso mapeó: es lo que OpenStreetMap ya sabe del
     sitio, y se lee acá —etiquetas, no reglas— porque no hay nada que
     clasificar: una ruta es una ruta y un paso de frontera es un paso de
     frontera. Lo que sí se decide acá, y se dice, es la LECTURA: qué tan
     cerca tiene que estar la frontera para que lo binacional sea un rasgo
     del sector y no un dato del mapa. */
  const NIVEL_ADMIN = { 2: 'país', 4: 'departamento', 6: 'municipio', 7: 'localidad',
                        8: 'corregimiento o localidad', 9: 'comuna', 10: 'barrio', 11: 'sector' };
  const RUMBOS = ['el norte', 'el nororiente', 'el oriente', 'el suroriente',
                  'el sur', 'el suroccidente', 'el occidente', 'el noroccidente'];
  function rumboHacia(centro, p){
    const dx = (p.lng - centro.lng) * Math.cos(centro.lat * Math.PI / 180), dy = p.lat - centro.lat;
    return RUMBOS[Math.round(((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360) / 45) % 8];
  }
  function posDe(el){
    const lat = el.lat != null ? el.lat : (el.center && el.center.lat);
    const lng = el.lon != null ? el.lon : (el.center && el.center.lon);
    return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
  }
  // Hasta dónde la frontera es un rasgo del sector. Tres kilómetros es lo
  // que se camina en media hora largo o se hace en una buseta corta: más
  // allá el paso existe, pero no ordena el comercio de la cuadra.
  const FRONTERA_CERCA_M = 3000;
  const ALOJ_NOMBRE = { hotel: 'Hotel', hostel: 'Hostal', guest_house: 'Residencia', motel: 'Motel',
                        apartment: 'Apartamento turístico', albergue: 'Albergue' };
  const EQUIP_NOMBRE = { school: 'Colegio', kindergarten: 'Jardín infantil', college: 'Instituto', university: 'Universidad',
                         hospital: 'Hospital', clinic: 'Clínica', doctors: 'Consultorio', health_post: 'Puesto de salud',
                         park: 'Parque', garden: 'Jardín', playground: 'Parque infantil' };
  // A pie, a paso de ciudad: 80 m por minuto (4,8 km/h).
  const PASO_M_MIN = 80;
  // La meta colombiana de espacio público efectivo: 15 m² por habitante
  // (Decreto 1504 de 1998). Se pone al lado del número porque sola la
  // cifra no dice si es mucho o poco.
  const META_EP_M2_HAB = 15;

  function leerContexto(centro, elementos, poblacion){
    const M = window.AIA_MOTOR;
    const dist = (p) => M && M.haversineM ? Math.round(M.haversineM(centro, p)) : 0;
    const limites = [], barrios = [], paradas = [], rutasVistas = {}, rutas = [], pasos = [], cambio = [], alojamiento = [];
    const equip = { colegio: [], salud: [], parque: [] }, parques = [], aguas = [];
    const mLat = 110540, mLng = 111320 * Math.cos(centro.lat * Math.PI / 180);
    const aMetros = q => ({ x: (q.lng - centro.lng) * mLng, y: (q.lat - centro.lat) * mLat });
    (elementos || []).forEach(el => {
      const t = el.tags || {};
      if (el.type === 'relation' && t.boundary === 'administrative') {
        const n = parseInt(t.admin_level, 10);
        if (t.name && Number.isFinite(n)) limites.push({ nivel: n, tipo: NIVEL_ADMIN[n] || ('nivel ' + n), nombre: t.name });
        return;
      }
      if (el.type === 'relation' && /^(bus|minibus|share_taxi|trolleybus)$/.test(String(t.route || ''))) {
        const ref = String(t.ref || '').trim(), nombre = String(t.name || '').trim();
        if (!ref && !nombre) return;
        // Ida y vuelta son la misma ruta: dos relaciones, UNA oferta.
        const clave = (ref || nombre).toLowerCase();
        if (rutasVistas[clave]) return;
        rutasVistas[clave] = true;
        rutas.push({ ref, nombre, operador: String(t.operator || '').trim(),
                     color: String(t.colour || t.color || '').trim(), tipo: String(t.route) });
        return;
      }
      // Los polígonos y trazos llegan con `geometry` y sin centro propio.
      if (Array.isArray(el.geometry) && el.geometry.length >= 2) {
        const pts = el.geometry.map(g => ({ lat: g.lat, lng: g.lon != null ? g.lon : g.lng })).filter(g => Number.isFinite(g.lat) && Number.isFinite(g.lng));
        if (String(t.waterway || '')) {
          let min = Infinity, cerca = null;
          pts.forEach(q => { const d = dist(q); if (d < min) { min = d; cerca = q; } });
          if (cerca) aguas.push({ nombre: t.name || ({ river: 'Río sin nombre', stream: 'Quebrada sin nombre', canal: 'Canal sin nombre', drain: 'Canal de drenaje', ditch: 'Zanja' })[t.waterway] || 'Cauce',
                                  tipo: t.waterway, distM: Math.round(min), rumbo: rumboHacia(centro, cerca) });
          return;
        }
        if (/^(park|garden|playground|pitch)$/.test(String(t.leisure || '')) || t.landuse === 'recreation_ground') {
          const cerrado = pts.length >= 4 && Math.abs(pts[0].lat - pts[pts.length - 1].lat) < 1e-9 && Math.abs(pts[0].lng - pts[pts.length - 1].lng) < 1e-9;
          if (!cerrado) return;
          // Área por la fórmula del cordón, en metros proyectados alrededor del centro.
          const m2 = Math.abs(pts.slice(0, -1).reduce((acc, q, i, arr) => {
            const a = aMetros(q), b = aMetros(arr[(i + 1) % arr.length]);
            return acc + (a.x * b.y - b.x * a.y);
          }, 0) / 2);
          const cx = pts.reduce((a, q) => a + q.lat, 0) / pts.length, cy = pts.reduce((a, q) => a + q.lng, 0) / pts.length;
          parques.push({ nombre: t.name || (t.leisure === 'pitch' ? 'Cancha' : t.leisure === 'playground' ? 'Parque infantil' : 'Parque sin nombre'),
                         tipo: t.leisure || t.landuse, m2: Math.round(m2), distM: dist({ lat: cx, lng: cy }) });
          return;
        }
      }
      const p = posDe(el);
      if (!p) return;
      if (t.highway === 'bus_stop') { paradas.push({ nombre: t.name || '', distM: dist(p) }); return; }
      const am = String(t.amenity || ''), le = String(t.leisure || '');
      if (/^(school|kindergarten|college|university)$/.test(am)) { equip.colegio.push({ nombre: t.name || EQUIP_NOMBRE[am] || 'Colegio', tipo: am, distM: dist(p), rumbo: rumboHacia(centro, p) }); return; }
      if (/^(hospital|clinic|doctors|health_post)$/.test(am)) { equip.salud.push({ nombre: t.name || EQUIP_NOMBRE[am] || 'Centro de salud', tipo: am, distM: dist(p), rumbo: rumboHacia(centro, p) }); return; }
      if (/^(park|garden|playground)$/.test(le) && !Array.isArray(el.geometry)) { equip.parque.push({ nombre: t.name || EQUIP_NOMBRE[le] || 'Parque', tipo: le, distM: dist(p), rumbo: rumboHacia(centro, p) }); return; }
      if (/^(neighbourhood|quarter|suburb)$/.test(String(t.place || '')) && t.name) {
        barrios.push({ nombre: t.name, distM: dist(p), rumbo: rumboHacia(centro, p) }); return;
      }
      if (t.barrier === 'border_control') {
        pasos.push({ nombre: t.name || 'Paso de frontera sin nombre', distM: dist(p), rumbo: rumboHacia(centro, p) }); return;
      }
      if (/^(bureau_de_change|money_transfer)$/.test(String(t.amenity || ''))) {
        cambio.push({ nombre: t.name || (t.amenity === 'money_transfer' ? 'Giros' : 'Casa de cambio'),
                      tipo: t.amenity, distM: dist(p) });
        return;
      }
      const tur = String(t.tourism || '');
      if (/^(hotel|hostel|guest_house|motel|apartment)$/.test(tur) || t.amenity === 'social_facility') {
        const tipo = t.amenity === 'social_facility' ? 'albergue' : tur;
        alojamiento.push({ nombre: t.name || ALOJ_NOMBRE[tipo] || 'Alojamiento', tipo, distM: dist(p) });
      }
    });
    limites.sort((a, b) => a.nivel - b.nivel);
    barrios.sort((a, b) => a.distM - b.distM);
    pasos.sort((a, b) => a.distM - b.distM);
    cambio.sort((a, b) => a.distM - b.distM);
    alojamiento.sort((a, b) => a.distM - b.distM);
    // Cuántos de cada tipo, para decir «3 hostales y 1 albergue» y no una lista.
    const porTipo = {};
    alojamiento.forEach(x => { porTipo[x.tipo] = (porTipo[x.tipo] || 0) + 1; });
    rutas.sort((a, b) => (a.ref || a.nombre).localeCompare(b.ref || b.nombre, 'es', { numeric: true }));
    const paso = pasos[0] || null;
    const km = m => (m / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 });
    // La lectura de lo binacional, en palabras y con su umbral a la vista.
    let binacional;
    if (!paso) {
      binacional = { grado: 'ninguno',
        lectura: 'No hay ningún paso de frontera a menos de 15 km: lo binacional no es un rasgo de este sector.' };
    } else if (paso.distM <= FRONTERA_CERCA_M) {
      binacional = { grado: 'fuerte',
        lectura: 'El paso de frontera queda a ' + km(paso.distM) + ' km hacia ' + paso.rumbo + ' (' + paso.nombre + '): ' +
          'a esa distancia el comercio pendular y la población flotante suelen ordenar la cuadra. ' +
          (cambio.length ? cambio.length + (cambio.length === 1 ? ' casa de cambio o giro mapeada' : ' casas de cambio o giros mapeados') +
                           ' en el radio lo confirman.'
                         : 'No hay casas de cambio mapeadas en el radio: si las ven en la calle, es de lo primero que vale la pena anotar.') };
    } else {
      binacional = { grado: 'lejano',
        lectura: 'El paso de frontera más cercano queda a ' + km(paso.distM) + ' km hacia ' + paso.rumbo + ' (' + paso.nombre + '): ' +
          'la frontera está en la ciudad, pero no en la cuadra. ' +
          (cambio.length ? 'Aun así hay ' + cambio.length + (cambio.length === 1 ? ' casa de cambio o giro' : ' casas de cambio o giros') +
                           ' en el radio, que es una pista de flujo binacional que vale la pena mirar en campo.'
                         : 'Sin casas de cambio en el radio, no hay señal de flujo binacional acá.') };
    }
    // Lo que un albergue o un hostal barato dicen de un sector —población de
    // paso, migrante o pendular— no lo dice un hotel de negocios. Se separa
    // lo «de paso» (hostal, residencia, albergue) de lo demás.
    const dePaso = alojamiento.filter(x => /^(hostel|guest_house|albergue)$/.test(x.tipo)).length;
    const flotante = {
      total: alojamiento.length, dePaso, porTipo,
      lectura: !alojamiento.length
        ? 'No hay hoteles, hostales ni albergues mapeados en el radio. No dice que no haya población de paso: ' +
          'los pagadiarios, las residencias y las piezas en arriendo casi nunca están en el mapa. Se cuentan en la calle.'
        : (dePaso >= 2
            ? dePaso + ' alojamientos de paso (hostales, residencias o albergues) en el radio: es la huella visible ' +
              'de una población flotante. En campo, cuenten además los letreros de «se arrienda pieza» y los pagadiarios.'
            : alojamiento.length + (alojamiento.length === 1 ? ' alojamiento mapeado' : ' alojamientos mapeados') +
              ' en el radio' + (dePaso ? ', ' + dePaso + ' de paso' : ', ninguno de paso') +
              '. Poca señal de población flotante en el mapa; la que haya se ve en los letreros de arriendo por pieza.')
    };
    // El más cercano de cada equipamiento, con sus minutos a pie.
    Object.keys(equip).forEach(k => equip[k].sort((a, b) => a.distM - b.distM));
    const masCercano = k => {
      const e = equip[k][0];
      return e ? Object.assign({}, e, { min: Math.max(1, Math.round(e.distM / PASO_M_MIN)) }) : null;
    };
    const caminata = {
      colegio: masCercano('colegio'), salud: masCercano('salud'), parque: masCercano('parque'),
      cuantos: { colegio: equip.colegio.length, salud: equip.salud.length, parque: equip.parque.length },
      hastaM: 1500,
      lectura: (function () {
        const partes = [];
        const f = (k, etq) => { const e = masCercano(k); partes.push(e ? etq + ' a ' + e.min + ' min (' + e.distM + ' m)' : 'sin ' + etq.toLowerCase() + ' mapeado a menos de 1,5 km'); };
        f('colegio', 'Colegio'); f('salud', 'Salud'); f('parque', 'Parque');
        return partes.join(' · ');
      })()
    };
    // Espacio público por habitante: el área de los parques del radio sobre la
    // población. Los polígonos entran enteros aunque asomen fuera del radio;
    // se dice.
    parques.sort((a, b) => b.m2 - a.m2);
    const m2Total = parques.reduce((a, q) => a + q.m2, 0);
    const habitantes = Number(poblacion) || 0;
    const m2Hab = habitantes > 0 ? m2Total / habitantes : null;
    const espacioPublico = {
      parques: parques.slice(0, 10), n: parques.length, m2: m2Total, habitantes,
      m2PorHab: m2Hab == null ? null : Math.round(m2Hab * 100) / 100, meta: META_EP_M2_HAB,
      pctDeMeta: m2Hab == null ? null : Math.round(100 * m2Hab / META_EP_M2_HAB),
      lectura: !parques.length
        ? 'No hay parques ni canchas dibujados como polígono en el radio. Si los hay, no están medidos en el mapa: midan el más cercano en pasos.'
        : m2Hab == null
          ? parques.length + ' espacios públicos suman ' + Math.round(m2Total).toLocaleString('es-CO') + ' m², pero no hay población para dividir.'
          : (Math.round(m2Hab * 100) / 100).toLocaleString('es-CO') + ' m² de espacio público por habitante, contra la meta de ' + META_EP_M2_HAB + ' m² (' +
            Math.round(100 * m2Hab / META_EP_M2_HAB) + ' % de la meta). ' +
            (m2Hab < 3 ? 'Muy por debajo: es el déficit típico de los barrios densos.' : m2Hab < META_EP_M2_HAB ? 'Por debajo de la meta, como casi toda la ciudad.' : 'Cumple la meta: es raro, y vale la pena decir por qué.')
    };
    aguas.sort((a, b) => a.distM - b.distM);
    return { limites, barrios: barrios.slice(0, 8), paradas: paradas.length, rutas, pasos: pasos.slice(0, 3),
             paso, cambio, binacional, alojamiento: alojamiento.slice(0, 12), flotante,
             caminata, espacioPublico, agua: { cauces: aguas.slice(0, 5), cercano: aguas[0] || null },
             umbralFronteraM: FRONTERA_CERCA_M,
             fuente: 'OpenStreetMap', consultado: new Date().toISOString() };
  }

  /* ── El terreno ───────────────────────────────────────────────────────
     Una rejilla de 5 × 5 alturas sobre el radio —25 puntos, que es poco
     para la cuota del servicio— y sobre ella un plano ajustado por mínimos
     cuadrados: su inclinación es la pendiente media y su dirección de
     bajada, hacia dónde corre el agua. El modelo tiene 90 m de resolución:
     describe el sector, no la cota de una esquina, y el bloque lo dice. */
  function rejillaTerreno(centro, radioM, n){
    const pts = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const fx = (i / (n - 1)) * 2 - 1, fy = (j / (n - 1)) * 2 - 1;
      pts.push({ lat: centro.lat + fy * radioM / 110540, lng: centro.lng + fx * radioM / (111320 * Math.cos(centro.lat * Math.PI / 180)), fx, fy });
    }
    return pts;
  }
  function leerTerreno(centro, radioM, pts, alturas, aguaCercana){
    const z = (alturas || []).map(Number);
    if (!pts || z.length !== pts.length || z.some(v => !isFinite(v))) return null;
    // Plano z = a·x + b·y + c, con x hacia el oriente y y hacia el norte, en metros.
    const X = pts.map(p => p.fx * radioM), Y = pts.map(p => p.fy * radioM);
    const n = z.length, mx = X.reduce((a, v) => a + v, 0) / n, my = Y.reduce((a, v) => a + v, 0) / n, mz = z.reduce((a, v) => a + v, 0) / n;
    let sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
    for (let i = 0; i < n; i++) { const dx = X[i] - mx, dy = Y[i] - my, dz = z[i] - mz; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; sxz += dx * dz; syz += dy * dz; }
    const det = sxx * syy - sxy * sxy;
    if (!det) return null;
    const a = (sxz * syy - syz * sxy) / det, b = (syz * sxx - sxz * sxy) / det;
    const pendiente = Math.sqrt(a * a + b * b) * 100;                 // %
    // Hacia dónde BAJA: el sentido contrario al gradiente.
    const rumboBaja = (Math.atan2(-a, -b) * 180 / Math.PI + 360) % 360;
    const RUMBOS = ['el norte', 'el nororiente', 'el oriente', 'el suroriente', 'el sur', 'el suroccidente', 'el occidente', 'el noroccidente'];
    const cae = RUMBOS[Math.round(rumboBaja / 45) % 8];
    const min = Math.min.apply(null, z), max = Math.max.apply(null, z);
    const grado = pendiente < 5 ? 'llano' : pendiente < 12 ? 'suave' : pendiente < 25 ? 'fuerte' : 'muy fuerte';
    // ¿El agua corre hacia la quebrada? Si la bajada apunta a menos de 45°
    // del cauce más cercano, en lluvia la calle es su canal.
    let haciaElAgua = false;
    if (aguaCercana && aguaCercana.rumbo) {
      const idx = RUMBOS.indexOf(aguaCercana.rumbo);
      const dif = Math.abs(((rumboBaja - idx * 45) + 540) % 360 - 180);
      haciaElAgua = idx >= 0 && dif <= 45;
    }
    const lectura = 'Terreno ' + grado + ': pendiente media de ' + pendiente.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %, ' + Math.round(max - min) + ' m de desnivel dentro del radio' +
      (pendiente >= 2 ? ', y cae hacia ' + cae + '.' : '; casi no tiene hacia dónde caer.') +
      (aguaCercana ? ' El cauce más cercano, ' + aguaCercana.nombre + ', pasa a ' + aguaCercana.distM + ' m hacia ' + aguaCercana.rumbo + '.' +
        (haciaElAgua ? ' El terreno baja hacia él: en lluvia fuerte, las calles de ese lado son su canal. Es la primera pregunta de riesgo del sector.' : '')
        : ' No hay quebradas ni canales dibujados en el radio.');
    return { pendientePct: Math.round(pendiente * 10) / 10, grado, cae, rumboBaja: Math.round(rumboBaja), desnivelM: Math.round(max - min),
             minM: Math.round(min), maxM: Math.round(max), haciaElAgua, puntos: n, lectura,
             nota: 'La altura sale de un modelo de 90 m de resolución: describe el sector, no la cota de una esquina.' };
  }

  async function contexto(centro, radioM, poblacion){
    if (!window.AIA_DATOS || !window.AIA_DATOS.consultarContexto) {
      throw new Error('Falta el módulo de datos. Recargá la aplicación.');
    }
    const c0 = { lat: centro.lat, lng: centro.lng };
    const pts = rejillaTerreno(c0, radioM, 5);
    // Overpass y el servicio de alturas son servicios distintos: van a la vez.
    // Si la altura falla, el contexto sale igual, sin terreno.
    const [els, alturas] = await Promise.all([
      window.AIA_DATOS.consultarContexto(centro.lat, centro.lng, radioM),
      (window.AIA_DATOS.consultarElevacion ? window.AIA_DATOS.consultarElevacion(pts) : Promise.resolve(null)).catch(() => null)
    ]);
    const c = leerContexto(c0, els || [], poblacion);
    c.terreno = leerTerreno(c0, radioM, pts, alturas, c.agua && c.agua.cercano);
    return c;
  }

  /* ── La lectura del curso ─────────────────────────────────────────────
     El módulo da las cifras; la conclusión la escribe el curso. Estas son
     las cajas, una por bloque, con la pregunta que las abre. Viven acá y no
     en el panel porque el informe (js/63) las lee con el mismo orden y los
     mismos títulos: una lista, dos lectores. */
  const LECTURAS = [
    { id: 'general',     t: 'Conclusión del grupo',
      p: '¿Qué es este sector, en tres frases? ¿Qué lo caracteriza, qué le falta y qué cambiarían?' },
    { id: 'base',        t: 'Sobre lo que mapearon',
      p: '¿Qué cuadras quedaron sin recorrer? ¿Qué creen que falta en el mapa y por qué?' },
    { id: 'poblacion',   t: 'La población',
      p: '¿La cifra del censo se parece a lo que vieron en la calle? ¿Quién vive y quién solo pasa?' },
    { id: 'flujo',       t: 'El movimiento',
      p: '¿A qué hora vieron más gente? ¿Coincide con lo que estima el análisis y con los letreros?' },
    { id: 'calor',       t: 'Dónde está el movimiento',
      p: '¿La esquina más activa del mapa de calor es la que ustedes sintieron más activa? Si no, ¿qué la explica?' },
    { id: 'composicion', t: 'De qué está hecho el sector',
      p: '¿Qué uso manda? ¿Qué falta que uno esperaría encontrar en un barrio así?' },
    { id: 'anillos',     t: 'El entorno al alejarse',
      p: '¿El sector es un centro o un borde? ¿Qué pasa con la densidad al alejarse del punto?' },
    { id: 'edificacion', t: 'Lo construido',
      p: '¿De cuándo son las casas? ¿Qué edificios merecen que alguien los mire con más cuidado?' },
    { id: 'forma',       t: 'La forma de la traza',
      p: '¿Se camina bien? ¿La forma de las calles ayuda o estorba para llegar a las cosas?' },
    { id: 'contexto',    t: 'El sector en la ciudad',
      p: '¿Cómo se llega y cómo se sale? ¿La frontera y la población de paso se notan en la cuadra?' },
    { id: 'foda',        t: 'Su propio FODA',
      p: '¿Qué del FODA del análisis quitarían o agregarían después de caminar el sector?' }
  ];

  /* Lo que el análisis dejó abierto y se resuelve caminando. Sale del
     resultado y no de una lista fija: si el curso ya anotó los horarios, esa
     tarea no aparece. Lo leen el informe (js/63) y la hoja de campo. */
  function faltantes(r){
    const out = [];
    if (!r) return out;
    const e = r.edu || {}, s = r.stats || {}, h = s.horarios || {}, ed = e.edificacion || {};
    if ((e.leidos || 0) < 25) {
      out.push({ id: 'puntos', t: 'Mapear más cuadras',
        d: 'Con ' + (e.leidos || 0) + ' puntos el análisis es un ejercicio. Cada cuadra nueva que entre mueve las cifras: recorran las que faltan dentro del radio.' });
    }
    if (h.total && h.sinDato) {
      out.push({ id: 'horarios', t: 'Anotar el horario del letrero', n: h.sinDato,
        d: h.sinDato + (h.sinDato === 1 ? ' uso sin horario' : ' usos sin horario') + '. Se lee en la puerta: días y horas de apertura, y si abre de noche o el domingo.' });
    }
    const sinFicha = Math.max(0, (e.leidos || 0) - (ed.total || 0));
    if (sinFicha > 0) {
      out.push({ id: 'edificacion', t: 'Levantar la ficha del edificio', n: sinFicha,
        d: sinFicha + (sinFicha === 1 ? ' punto sin ficha' : ' puntos sin ficha') + ': pisos, época aparente, estado de la fachada y si tiene frente activo o ciego.' });
    }
    const sinTraducir = Object.keys(e.sinTraducir || {});
    if (sinTraducir.length) {
      out.push({ id: 'etiquetas', t: 'Revisar las etiquetas que no se supieron leer', n: sinTraducir.length,
        d: sinTraducir.slice(0, 6).join(', ') + (sinTraducir.length > 6 ? '…' : '') + '. Anótenlas con lo que son de verdad y se agregan a la traducción.' });
    }
    if (!r.contexto) {
      out.push({ id: 'contexto', t: 'Consultar el contexto del sector',
        d: 'Comuna y barrio, busetas, frontera y alojamiento de paso: está a un botón en el panel y entra al informe.' });
    } else {
      const c = r.contexto;
      if (!(c.rutas || []).length) out.push({ id: 'busetas', t: 'Contar las busetas que pasan',
        d: 'El mapa no tiene rutas acá. Anoten número, destino y cada cuánto pasan, en la parada más usada.' });
      if (c.binacional && c.binacional.grado !== 'ninguno') out.push({ id: 'binacional', t: 'Leer el flujo binacional en la calle',
        d: 'Casas de cambio y cambistas en vía, comercio de paso, y de dónde viene la clientela según dos o tres locales.' });
      if (c.espacioPublico && !c.espacioPublico.n) out.push({ id: 'parque', t: 'Medir el parque o la cancha más cercana',
        d: 'No hay espacio público dibujado en el radio. Midan el más cercano en pasos (largo × ancho) y anoten si se usa y a qué hora.' });
      if (c.flotante && !c.flotante.dePaso) out.push({ id: 'flotante', t: 'Buscar la población de paso que el mapa no ve',
        d: 'Letreros de «se arrienda pieza», pagadiarios y residencias sin nombre. Cuántos por cuadra.' });
    }
    if (!r.formaEdu) {
      out.push({ id: 'forma', t: 'Reconocer la forma de la traza',
        d: 'Está a un botón en el panel: ortogonal, radial, lineal o plato roto, medido con las calles.' });
    }
    if (!(r.lecturas && Object.keys(r.lecturas).some(k => (r.lecturas[k] || '').trim()))) {
      out.push({ id: 'lectura', t: 'Escribir la lectura del curso',
        d: 'Las cajas «Su lectura» de cada bloque están vacías. El informe las lleva, y es lo que se evalúa.' });
    }
    return out;
  }

  /* ── Antes y después ─────────────────────────────────────────────────
     Todo el módulo dice «mapeen más y vuelvan a analizar», y hasta la v810
     nada mostraba qué cambió. El resumen es lo poco que hace falta guardar
     del análisis anterior para compararlo; los cambios son la lista de lo
     que se movió, con la razón cuando se sabe. La población NO entra a la
     comparación como cambio del curso: viene del DANE y no se mueve
     mapeando; si cambia es porque cambió el radio o el censo. */
  const COMPARABLES = [
    { id: 'leidos',      t: 'Puntos que entraron al análisis', f: r => (r.edu || {}).leidos || 0, ent: true },
    { id: 'total',       t: 'Usos leídos',                    f: r => (r.stats || {}).total || 0, ent: true },
    { id: 'densidad',    t: 'Usos por hectárea',               f: r => Number((r.stats || {}).densidadPorHa) || 0, dec: 1 },
    { id: 'peatonal',    t: 'Flujo a pie',                     f: r => ((((r.stats || {}).movilidad || {}).flujo) || {}).peatonal || 0, ent: true, sufijo: '/100' },
    { id: 'vehicular',   t: 'Flujo vehicular',                 f: r => ((((r.stats || {}).movilidad || {}).flujo) || {}).vehicular || 0, ent: true, sufijo: '/100' },
    { id: 'noche',       t: 'Franja de noche',                 f: r => (((((r.stats || {}).movilidad || {}).flujo) || {}).franjas || {}).noche || 0, ent: true },
    { id: 'rubros',      t: 'Rubros distintos',                f: r => ((r.stats || {}).rubros || []).length, ent: true },
    { id: 'conHorario',  t: 'Usos con horario anotado',        f: r => ((r.stats || {}).horarios || {}).conDato || 0, ent: true },
    { id: 'fichas',      t: 'Edificios con ficha',             f: r => (((r.edu || {}).edificacion) || {}).total || 0, ent: true },
    { id: 'sinTraducir', t: 'Etiquetas sin traducir',          f: r => Object.keys((r.edu || {}).sinTraducir || {}).length, ent: true, malo: true }
  ];
  function resumen(r){
    const out = { ts: new Date().toISOString(), poblacion: (r.stats || {}).poblacionEstimada || 0 };
    COMPARABLES.forEach(c => { out[c.id] = c.f(r); });
    return out;
  }
  function cambios(antes, ahora){
    if (!antes || !ahora) return null;
    const lista = [];
    COMPARABLES.forEach(c => {
      const a = Number(antes[c.id]) || 0, b = Number(ahora[c.id]) || 0;
      const d = b - a;
      if (Math.abs(d) < (c.dec ? 0.05 : 0.5)) return;
      const fmt = v => c.dec ? v.toLocaleString('es-CO', { maximumFractionDigits: c.dec, minimumFractionDigits: c.dec }) : String(Math.round(v));
      lista.push({ id: c.id, t: c.t, antes: fmt(a) + (c.sufijo || ''), ahora: fmt(b) + (c.sufijo || ''),
                   delta: (d > 0 ? '+' : '−') + fmt(Math.abs(d)),
                   // Subir es bueno salvo en lo que cuenta problemas.
                   mejora: c.malo ? d < 0 : d > 0 });
    });
    const dPuntos = (Number(ahora.leidos) || 0) - (Number(antes.leidos) || 0);
    const pobCambio = Math.abs((ahora.poblacion || 0) - (antes.poblacion || 0)) > 0.5;
    let lectura;
    if (!lista.length) {
      lectura = 'Nada cambió desde la vez anterior: mismos puntos, mismas cifras. Mapeen más cuadras antes de volver a analizar; el cambio es lo que enseña.';
    } else if (dPuntos > 0) {
      lectura = 'Entraron ' + dPuntos + (dPuntos === 1 ? ' punto nuevo' : ' puntos nuevos') + ' y con ellos se movieron ' + lista.length +
        (lista.length === 1 ? ' cifra' : ' cifras') + '. Eso es lo que hace mapear: el sector no cambió, cambió cuánto de él se ve.';
    } else if (dPuntos < 0) {
      lectura = 'Hay ' + Math.abs(dPuntos) + ' puntos menos que la vez anterior. Si no los borraron a propósito, revisen el radio o el centro del mapa: ' +
        'comparar dos recortes distintos no dice nada del sector.';
    } else {
      lectura = 'Mismos puntos, pero ' + lista.length + (lista.length === 1 ? ' cifra cambió' : ' cifras cambiaron') +
        ': editaron lo ya mapeado (horarios, fichas, etiquetas). Eso también es levantamiento.';
    }
    return { desde: antes.ts, lista, dPuntos, lectura,
             notaPoblacion: pobCambio
               ? 'La población también cambió (' + Math.round(antes.poblacion).toLocaleString('es-CO') + ' → ' + Math.round(ahora.poblacion).toLocaleString('es-CO') + '): eso no lo hizo el curso, viene del DANE. Cambió el radio, el centro o el censo.'
               : 'La población no cambió: viene del DANE y no se mueve mapeando.' };
  }

  /* ── Comparar dos sectores ───────────────────────────────────────────
     Dos resúmenes, una tabla: las cinco cifras que se comparan entre
     sectores de distinto tamaño (por eso usos por hectárea y no usos), con
     quién queda arriba en cada una y una lectura en palabras. El otro
     sector puede ser una ficha del curso (pcr_fichas_v1) o un análisis
     anterior de otro centro; los dos se normalizan antes de entrar acá. */
  const COMPARAR_METRICAS = [
    { id: 'poblacion', t: 'Habitantes',        dec: 0 },
    { id: 'total',     t: 'Usos leídos',       dec: 0 },
    { id: 'densidad',  t: 'Usos por hectárea', dec: 1 },
    { id: 'peatonal',  t: 'Flujo a pie',       dec: 0, sufijo: '/100' },
    { id: 'vehicular', t: 'Flujo vehicular',   dec: 0, sufijo: '/100' }
  ];
  function normalizarSector(x){
    if (!x) return null;
    // Una ficha del curso trae `stats`; un resumen de análisis trae las cifras planas.
    const st = x.stats || null;
    const fl = st && st.movilidad && st.movilidad.flujo || {};
    return {
      nombre: x.nombre || x.clave || 'Otro sector', fecha: x.ts || x.fechaISO || '',
      poblacion: Number(st ? st.poblacionEstimada : x.poblacion) || 0,
      total: Number(st ? st.total : x.total) || 0,
      densidad: Number(st ? st.densidadPorHa : x.densidad) || 0,
      peatonal: Number(st ? fl.peatonal : x.peatonal) || 0,
      vehicular: Number(st ? fl.vehicular : x.vehicular) || 0
    };
  }
  function comparar(este, otro){
    const A = normalizarSector(este), B = normalizarSector(otro);
    if (!A || !B) return null;
    const fmt = (v, m) => v.toLocaleString('es-CO', { maximumFractionDigits: m.dec, minimumFractionDigits: m.dec }) + (m.sufijo || '');
    const filas = COMPARAR_METRICAS.map(m => {
      const a = A[m.id], b = B[m.id];
      const razon = b > 0 ? a / b : (a > 0 ? Infinity : 1);
      return { id: m.id, t: m.t, este: fmt(a, m), otro: fmt(b, m), a, b,
               gana: Math.abs(a - b) < 1e-9 ? 'empate' : a > b ? 'este' : 'otro',
               razon: isFinite(razon) ? Math.round(razon * 10) / 10 : null,
               // Para la barra: la parte de este sector sobre la suma.
               pct: (a + b) > 0 ? Math.round(100 * a / (a + b)) : 50 };
    });
    const dens = filas.find(f => f.id === 'densidad'), pea = filas.find(f => f.id === 'peatonal'), pob = filas.find(f => f.id === 'poblacion');
    const veces = f => f.razon == null ? '' : f.razon >= 1 ? f.razon.toLocaleString('es-CO') + ' veces' : 'un ' + Math.round(100 * f.razon) + ' %';
    let lectura = '';
    if (dens.gana === 'este' && dens.razon != null) lectura += 'Este sector es más denso: ' + veces(dens) + ' los usos por hectárea de ' + B.nombre + '. ';
    else if (dens.gana === 'otro') lectura += B.nombre + ' es más denso: aquí hay ' + (dens.razon != null ? veces(dens) : 'menos') + ' de sus usos por hectárea. ';
    else lectura += 'Los dos tienen la misma densidad de usos. ';
    if (pea.gana !== 'empate') lectura += (pea.gana === 'este' ? 'Y mueve más gente a pie' : 'Pero ' + B.nombre + ' mueve más gente a pie') +
      ' (' + pea.este + ' contra ' + pea.otro + '). ';
    if (pob.gana !== 'empate') lectura += (pob.gana === 'este' ? 'Con más habitantes en el radio' : 'Con menos habitantes en el radio') + ' (' + pob.este + ' contra ' + pob.otro + '). ';
    lectura += 'Densidad y flujo se comparan; los usos leídos y la población dependen también del radio y de cuánto se mapeó.';
    return { este: A, otro: B, filas, lectura };
  }

  window.URBIS_EDU = {
    analizar: analizar,
    comparar: comparar, normalizarSector: normalizarSector,
    resumen: resumen,
    cambios: cambios,
    COMPARABLES: COMPARABLES,
    LECTURAS: LECTURAS,
    faltantes: faltantes,
    contexto: contexto,
    leerContexto: leerContexto,
    leerTerreno: leerTerreno, rejillaTerreno: rejillaTerreno,
    forma: forma,
    puntoAElemento: puntoAElemento,
    // Es donde el estado del andén se separa de los elementos y se convierte
    // en caminabilidad: se expone para poder comprobarlo sin montar la app.
    reunirElementos: reunirElementos,
    partirEtiqueta: partirEtiqueta,
    USO_A_SUB: USO_A_SUB, TIPO_A_SUB: TIPO_A_SUB, TIPO_A_VIA: TIPO_A_VIA,
    TIPO_INFRA_A_SUB: TIPO_INFRA_A_SUB, TIPO_A_ANDEN: TIPO_A_ANDEN
  };
})();
