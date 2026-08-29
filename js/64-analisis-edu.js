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
  const TIPO_A_VIA = {
    'Vía principal / arteria': 'primary',
    'Vía secundaria / local': 'secondary',
    'Ciclorruta': 'cycleway',
    'Puente vehicular': 'secondary',
    'Intercambiador (glorieta, deprimido)': 'primary',
    'Túnel': 'secondary',
    'Peaje': 'trunk'
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
      const sub = TIPO_A_SUB[et.tipo] || USO_A_SUB[et.uso];
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
        tags: {
          'urbis:sub': sub,
          'urbis:intensidad': String(intensidad),
          'building:levels': String(ficha.pisos),
          name: et.cabeza
        }
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
    (datos || []).forEach(function (p, i) {
      const lat = parseFloat(String(p && p.lat || '').replace(',', '.'));
      const lng = parseFloat(String(p && p.lng || '').replace(',', '.'));
      if (!isFinite(lat) || !isFinite(lng)) return;
      if (M.haversineM(centro, { lat: lat, lng: lng }) > radioM) return;
      dentro++;
      const els = puntoAElemento(p, i);
      if (els && els.length) { els.forEach(function (e) { elementos.push(e); }); return; }
      // Lo que no se pudo traducir se cuenta y se muestra: es la lista de lo
      // que le falta a la traducción, y sirve para mejorarla con el curso.
      const et = partirEtiqueta(p.descripcion);
      const clave = et.cabeza || '(sin descripción)';
      sinTraducir[clave] = (sinTraducir[clave] || 0) + 1;
    });
    return { elementos: elementos, dentro: dentro, sinTraducir: sinTraducir };
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
      direccionAprox: (ubicacion && ubicacion.ciudad) || '', dane: dane
    });
    resultado.edu = {
      puntosDelCurso: reunido.dentro,
      leidos: reunido.elementos.length,
      sinTraducir: reunido.sinTraducir,
      ciudad: (ubicacion && ubicacion.ciudad) || ''
    };
    return resultado;
  }

  window.URBIS_EDU = {
    analizar: analizar,
    puntoAElemento: puntoAElemento,
    partirEtiqueta: partirEtiqueta,
    USO_A_SUB: USO_A_SUB, TIPO_A_SUB: TIPO_A_SUB, TIPO_A_VIA: TIPO_A_VIA
  };
})();
