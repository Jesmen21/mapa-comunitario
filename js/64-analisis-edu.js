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
    const intensidad = ficha.pisos / subs.length;

    return subs.map(function (sub, k) {
      return {
        type: 'node', id: 'edu' + i + '_' + k, lat: lat, lon: lng,
        tags: (function(){
          const t = {
            'urbis:sub': sub,
            'urbis:intensidad': String(intensidad),
            'building:levels': String(ficha.pisos),
            name: et.cabeza
          };
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
                   anteriores1984: 0, patrimonio: 0, enObra: 0 };
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
        if (tieneAlgo) {
          edif.total++;
          if (ficha.enObra) edif.enObra++;
          if (ficha.epoca) {
            edif.conEpoca++;
            edif.porEpoca[ficha.epoca] = (edif.porEpoca[ficha.epoca] || 0) + 1;
            if (ficha.epoca === 'Anterior a 1950') edif.patrimonio++;
            if (/Anterior a 1950|1950 – 1983/.test(ficha.epoca)) edif.anteriores1984++;
          }
          if (ficha.materialidad && ficha.materialidad !== EDIF.SIN_REGISTRAR) {
            edif.conMaterial++;
            edif.porMaterial[ficha.materialidad] = (edif.porMaterial[ficha.materialidad] || 0) + 1;
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
    let dane = null, ubicacion = null;
    try {
      if (window.AIA_DATOS && window.AIA_DATOS.ubicacionDe) {
        ubicacion = await window.AIA_DATOS.ubicacionDe(centro.lat, centro.lng);
      }
    } catch(e) { ubicacion = null; }
    try {
      if (window.AIA_DATOS && window.AIA_DATOS.consultarDANE) {
        dane = await window.AIA_DATOS.consultarDANE(
          centro.lat, centro.lng, radioM, (ubicacion && ubicacion.ciudad) || '');
      }
    } catch(e) { dane = null; }

    const resultado = await window.AIA_MOTOR.analizar({
      elementos: reunido.elementos, radioM: radioM, centro: centro,
      tipoEstudio: 'completo', proyectoId: proyectoId || null,
      direccionAprox: (ubicacion && ubicacion.ciudad) || '', dane: dane,
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

  window.URBIS_EDU = {
    analizar: analizar,
    puntoAElemento: puntoAElemento,
    // Es donde el estado del andén se separa de los elementos y se convierte
    // en caminabilidad: se expone para poder comprobarlo sin montar la app.
    reunirElementos: reunirElementos,
    partirEtiqueta: partirEtiqueta,
    USO_A_SUB: USO_A_SUB, TIPO_A_SUB: TIPO_A_SUB, TIPO_A_VIA: TIPO_A_VIA,
    TIPO_INFRA_A_SUB: TIPO_INFRA_A_SUB, TIPO_A_ANDEN: TIPO_A_ANDEN
  };
})();
