/* URBIS Pro City · DIAGNÓSTICO EDUCATIVO DEL ÁREA (js/26)
   ─────────────────────────────────────────────────────────────────────────
   Convierte lo que el estudiante mapeó —y la cobertura del suelo que analizó—
   en conclusiones, un FODA y una propuesta de implantación.

   Por qué por REGLAS y no por IA: es el mismo camino que ya sigue el FODA de
   Implantación IA (js/60). Una regla se puede leer, discutir y corregir en
   clase; una respuesta de modelo generativo no. Y sobre todo, cada frase de
   aquí nace pegada al número que la sostiene: si el informe dice "déficit de
   verde" es porque hay un porcentaje concreto detrás, y ese porcentaje se
   imprime al lado. Un estudiante tiene que poder discutirle al programa.

   Los umbrales son criterios de URBIS para trabajo académico. No pretenden
   ser norma urbanística ni certificación ambiental, y el informe lo dice con
   todas las letras: sirve para aprender a leer un territorio y para comparar
   sectores entre sí, no para tramitar nada.
   ───────────────────────────────────────────────────────────────────────── */
(function(){
  'use strict';

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function PC(){ return window.URBIS_PC_ANALISIS || null; }
  function ctxPC(){
    return (typeof window.urbisProCityCtxAnalisis === 'function')
      ? window.urbisProCityCtxAnalisis() : null;
  }
  const num = n => Number(n || 0).toLocaleString('es-CO');
  const pct1 = n => Math.round(n * 10) / 10;
  /* Un sustantivo contado lleva su rama de singular, o la hoja imprime
     «1 elementos» — la concordancia de la v874. En este módulo la frase más
     expuesta es la de la muestra corta: existe PARA el sector con pocos
     elementos, así que «1» no es su caso raro sino el más probable. `cn`
     pasa la cifra por `num`, que es el único sitio de este archivo que sabe
     escribir un número en castellano. */
  const pl = (n, sing, plur) => (Number(n) === 1 ? sing : plur);
  const cn = (n, sing, plur) => num(n) + ' ' + pl(n, sing, plur);

  // ── Umbrales ────────────────────────────────────────────────────────────
  // Se declaran juntos y con nombre para que se puedan mover en un solo sitio
  // y para que el código diga QUÉ significa cada corte, no un número suelto.
  const U = {
    verdeBueno: 30, verdeAceptable: 15,          // % del área con vegetación
    duroExcesivo: 60,                            // % de superficie dura
    mezclaBuena: 65, mezclaMedia: 40,            // reparto entre categorías (0-100)
    densidadAlta: 12, densidadBaja: 3,           // elementos por hectárea
    dominanciaAlta: 55,                          // % de una sola categoría
    muestraMinima: 15,                           // menos de esto es una muestra corta
    riesgoAlto: 8,                               // % de lo mapeado en riesgo o deterioro
    riesgoPorHa: 1.5,                            // …o esta densidad, que pesa aunque el % sea bajo
    verdePorHabBueno: 9, verdePorHabMinimo: 3,   // m² de verde por habitante estimado
    densidadPobAlta: 250, densidadPobBaja: 40    // habitantes por hectárea
  };

  // ── Población ───────────────────────────────────────────────────────────
  //
  // No se estima por densidad de manzana, sino contando VIVIENDAS a partir de
  // lo que el estudiante mapeó tipo por tipo. Esa diferencia es el contenido
  // educativo: enseña que la población de un sector no la decide su tamaño
  // sino QUÉ se construyó en él. Dos manzanas iguales, una de casas de un piso
  // y otra de torres, no albergan a la misma gente ni de lejos — y aquí el
  // número se mueve cuando el estudiante corrige el tipo de un edificio.
  //
  // Cada tipo aporta las viviendas que suele tener. Son valores de referencia
  // de URBIS: un rango es siempre más honesto que un dato exacto inventado,
  // así que el informe muestra la cifra como estimación y explica de qué
  // conteo sale.
  const VIVIENDAS = {
    'casa de un piso':1, 'casa de dos pisos':1, 'casa de tres o mas pisos':2,
    'casa con antejardin':1, 'casa con garaje':1, 'casa patio / casalote':1,
    'casa esquinera':1, 'casa campestre / quinta':1,
    'edificio de apartamentos (1-3 pisos)':6,
    'torre residencial (4-10 pisos)':24, 'torre alta (10+ pisos)':60,
    'conjunto cerrado / urbanizacion':40, 'vivienda multifamiliar':3,
    'inquilinato / pieza en arriendo':6,
    'vis unifamiliar':1, 'vis multifamiliar':8, 'proyecto vip':30,
    'vivienda rural vis':1, 'mejoramiento de vivienda':1,
    'vivienda por autoconstruccion':1, 'reubicacion por riesgo':1,
    'proyecto de vivienda gratuita':30, 'legalizacion / titulacion de barrio':1,
    'mixto (residencial-comercial)':2, 'mixto (residencial-industrial)':2,
    'uso multiple / mixto general':3, 'torre de usos combinados':30,
    'residencial + comercial + oficinas':20
  };
  const VIVIENDA_POR_DEFECTO = 1;    // un elemento residencial sin tipo reconocido
  const PERSONAS_POR_VIVIENDA = 3.1; // tamaño medio de hogar usado por URBIS

  function quitarAcentos(s){
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[–—]/g, '-').trim();
  }

  // El tipo exacto viaja dentro de la descripción, en la forma "Uso · Tipo".
  function tipoExacto(p){
    const primero = String(p && p.descripcion || '').split(' | ')[0] || '';
    const partes = primero.split(' · ');
    return partes.length > 1 ? partes.slice(1).join(' · ') : '';
  }

  function estimarPoblacion(r, ctx){
    const puntos = (r && r.puntos) || [];
    let viviendas = 0, elementosResid = 0, reconocidos = 0;
    const porTipo = {};
    puntos.forEach(function (p) {
      const t = quitarAcentos(tipoExacto(p));
      const uso = quitarAcentos(ctx.usoDe ? ctx.usoDe(p) : '');
      const esResidencial = VIVIENDAS[t] !== undefined ||
        uso.indexOf('residencial') !== -1 || uso.indexOf('vivienda') !== -1 ||
        uso.indexOf('mixto') !== -1;
      if (!esResidencial) return;
      elementosResid++;
      const v = VIVIENDAS[t];
      if (v !== undefined) reconocidos++;
      const n = (v !== undefined) ? v : VIVIENDA_POR_DEFECTO;
      viviendas += n;
      const etq = tipoExacto(p) || 'Sin tipo definido';
      if (!porTipo[etq]) porTipo[etq] = { n:0, viviendas:0 };
      porTipo[etq].n++; porTipo[etq].viviendas += n;
    });
    const lista = Object.keys(porTipo).map(k => ({ tipo:k, n:porTipo[k].n, viviendas:porTipo[k].viviendas }))
      .sort((a, b) => b.viviendas - a.viviendas);
    return {
      elementos: elementosResid,
      viviendas: viviendas,
      // Se redondea a la decena: dar "1.247 habitantes" a partir de un conteo
      // de tipos sería fingir una precisión que la estimación no tiene.
      habitantes: Math.round(viviendas * PERSONAS_POR_VIVIENDA / 10) * 10,
      porTipo: lista,
      // Qué parte del residencial traía tipo reconocible. Si es baja, la cifra
      // se apoya casi toda en el valor por defecto y hay que decirlo.
      precision: elementosResid ? Math.round(100 * reconocidos / elementosResid) : 0
    };
  }

  // Reparto de usos con las mismas familias que usa el módulo empresarial, para
  // que un estudiante que vea los dos informes lea la misma barra.
  const FAMILIAS = [
    { id:'residencial',   etq:'Residencial',    color:'#f59e0b', de:['vivienda'] },
    { id:'comercial',     etq:'Comercio',       color:'#ef4444', de:['comercio'] },
    { id:'institucional', etq:'Institucional',  color:'#3b82f6', de:['institucional','salud','cultura'] },
    { id:'servicios',     etq:'Servicios',      color:'#8b5cf6', de:['servicios'] },
    { id:'industrial',    etq:'Industria',      color:'#78716c', de:['industria'] },
    { id:'mixto',         etq:'Mixto',          color:'#14b8a6', de:['mixtos'] },
    { id:'ambiental',     etq:'Ambiental',      color:'#22c55e', de:['ambiente'] },
    { id:'sinDefinir',    etq:'Sin definir',    color:'#a8a29e', de:['riesgo'] }
  ];
  function repartoUsos(porGrupo){
    const pesos = FAMILIAS.map(f => ({ f:f, n:f.de.reduce((a, g) => a + (porGrupo[g] || 0), 0) }));
    const total = pesos.reduce((a, x) => a + x.n, 0) || 1;
    return pesos.map(x => ({ id:x.f.id, etq:x.f.etq, color:x.f.color, n:x.n,
                             pct: Math.round(100 * x.n / total) }))
                .filter(x => x.n > 0);
  }

  // Categorías que se consideran servicios básicos de proximidad: si el
  // estudiante no mapeó ninguno, el barrio depende de otro sector para eso.
  const BASICOS = [
    { id:'salud',    que:'servicios de salud' },
    { id:'cultura',  que:'equipamiento educativo o cultural' },
    { id:'ambiente', que:'suelo protegido o zona verde catalogada' },
    { id:'comercio', que:'comercio de abastecimiento' }
  ];

  // ── Indicadores ─────────────────────────────────────────────────────────

  // Reparto entre categorías, de 0 (todo en una sola) a 100 (perfectamente
  // repartido). Es la entropía de Shannon normalizada: mide si el sector hace
  // muchas cosas o una sola, que es la pregunta de fondo de la mezcla de usos.
  function equilibrio(conteos){
    const vals = conteos.filter(n => n > 0);
    if (vals.length < 2) return 0;
    const total = vals.reduce((a, b) => a + b, 0);
    let h = 0;
    vals.forEach(n => { const p = n / total; h -= p * Math.log(p); });
    return Math.round(h / Math.log(vals.length) * 100);
  }

  function indicadores(ctx){
    const pc = PC();
    if (!pc || !pc.hayArea()) return null;
    const r = window.__pcaUltimo;
    if (!r) return null;
    const areaM2 = pc.areaM2(pc.puntosDelArea());
    const areaHa = areaM2 / 10000;

    const porGrupo = {};
    ctx.grupos.forEach(g => { porGrupo[g.id] = r.porGrupo[g.id] || 0; });
    const listaGrupos = ctx.grupos.map(g => ({ g: g, n: porGrupo[g.id] }))
      .sort((a, b) => b.n - a.n);
    const dominante = listaGrupos[0] && listaGrupos[0].n ? listaGrupos[0] : null;

    // Cobertura del suelo, si ya se analizó.
    const raster = (typeof pc.ultimoRaster === 'function') ? pc.ultimoRaster() : null;
    const clase = id => {
      if (!raster) return null;
      const c = (raster.clases || []).find(x => x.id === id);
      return c || null;
    };
    const verde = clase('verde'), duro = clase('construido'), agua = clase('agua');
    // A qué detalle se leyó el terreno. Importa decirlo: en un área extensa
    // cada píxel cubre metros y la lectura pasa a ser de masas, no de
    // elementos — un patio con dos árboles ya no se distingue.
    const grueso = !!(raster && raster.grueso);

    const ind = {
      hayCobertura: !!raster,
      coberturaGruesa: grueso,
      mPorPx: raster ? raster.mPorPx : null,
      total: r.total || 0,
      totalMatriz: r.totalMatriz || 0,
      areaHa: Math.round(areaHa * 100) / 100,
      areaM2: Math.round(areaM2),
      densidad: areaHa > 0 ? Math.round((r.total || 0) / areaHa * 10) / 10 : 0,
      porGrupo: porGrupo,
      listaGrupos: listaGrupos,
      dominante: dominante,
      pctDominante: (r.totalMatriz && dominante) ? Math.round(dominante.n / r.totalMatriz * 100) : 0,
      mezcla: equilibrio(ctx.grupos.map(g => porGrupo[g.id])),
      ausentes: BASICOS.filter(b => !porGrupo[b.id]),
      pctRiesgo: r.totalMatriz ? Math.round((porGrupo.riesgo || 0) / r.totalMatriz * 100) : 0,
      riesgoPorHa: areaHa > 0 ? Math.round((porGrupo.riesgo || 0) / areaHa * 10) / 10 : 0,
      verdePct: verde ? verde.pct : null,
      verdeM2: verde ? verde.m2 : null,
      duroPct: duro ? duro.pct : null,
      aguaPct: agua ? agua.pct : null,
      muestraCorta: (r.total || 0) < U.muestraMinima,
      pob: estimarPoblacion(r, ctx),
      reparto: repartoUsos(porGrupo)
    };
    // Verde por elemento mapeado: aterriza el porcentaje en algo comparable
    // entre sectores de distinto tamaño.
    ind.verdePorElemento = (ind.verdeM2 && ind.total) ? Math.round(ind.verdeM2 / ind.total) : null;
    ind.habPorHa = areaHa > 0 ? Math.round(ind.pob.habitantes / areaHa) : 0;
    // Metros cuadrados de verde por habitante: es el indicador que de verdad
    // dice si el verde alcanza, porque un mismo porcentaje reparte muy distinto
    // según cuánta gente viva ahí.
    ind.verdePorHab = (ind.verdeM2 && ind.pob.habitantes)
      ? Math.round(ind.verdeM2 / ind.pob.habitantes * 10) / 10 : null;
    return ind;
  }

  // ── Veredictos ──────────────────────────────────────────────────────────
  // Cada uno responde UNA pregunta y trae su número a cuestas.

  function veredictos(i){
    const v = [];

    if (i.hayCobertura) {
      const p = i.verdePct;
      v.push({
        id: 'ambiental',
        titulo: 'Cobertura ambiental',
        nivel: p >= U.verdeBueno ? 'bien' : p >= U.verdeAceptable ? 'medio' : 'mal',
        dato: p + '% del área',
        texto: p >= U.verdeBueno
          ? 'El área tiene una base ambiental sólida: ' + p + '% de vegetación viva (' +
            num(i.verdeM2) + ' m²). Es un activo que conviene proteger antes que ampliar, ' +
            'porque recuperar arbolado maduro toma décadas.'
          : p >= U.verdeAceptable
            ? 'La cobertura vegetal es moderada: ' + p + '% del área (' + num(i.verdeM2) + ' m²). ' +
              'Alcanza para dar sombra en puntos concretos, pero no forma una red continua.'
            : 'Déficit ambiental claro: solo ' + p + '% del área es vegetación viva (' +
              num(i.verdeM2) + ' m²). Un sector así se calienta más, escurre más agua ' +
              'de lluvia hacia la calle y ofrece menos refugio peatonal.'
      });

      if (i.duroPct !== null && i.duroPct >= U.duroExcesivo) {
        v.push({
          id: 'impermeable', titulo: 'Suelo endurecido', nivel: 'mal',
          dato: num(i.duroPct) + '% del área',
          texto: 'La superficie dura ocupa ' + num(i.duroPct) + '% del área. Cuando el suelo no ' +
                 'absorbe, el agua de lluvia va toda a la calle: es el origen más común de ' +
                 'los encharcamientos de barrio.'
        });
      }
    }

    // Una sola categoría por encima de dominanciaAlta ya es monofuncionalidad,
    // por más que el índice de reparto salga intermedio: el reparto se calcula
    // solo entre las categorías PRESENTES, así que un sector con cinco
    // categorías y el 80% en una daba 47/100 y se leía como "intermedio".
    const mono = i.mezcla < U.mezclaMedia || i.pctDominante >= U.dominanciaAlta;
    if (i.coberturaGruesa) {
      v.push({
        id: 'escala', titulo: 'Escala de la lectura', nivel: 'medio',
        dato: num(i.mPorPx) + ' m por punto',
        texto: 'El área es extensa, así que la cobertura se leyó a ' + num(i.mPorPx) +
               ' m por punto: sirve para ver masas —dónde hay monte y dónde ciudad— pero ' +
               'no distingue un patio arbolado de un techo. Para leer detalle, dibuje un ' +
               'área más pequeña.'
      });
    }

    v.push({
      id: 'mezcla',
      titulo: 'Mezcla de usos',
      nivel: mono ? 'mal' : i.mezcla >= U.mezclaBuena ? 'bien' : 'medio',
      dato: num(i.mezcla) + '/100',
      texto: mono
        ? 'Sector monofuncional' +
          (i.dominante ? ': ' + num(i.pctDominante) + '% de lo mapeado es ' + i.dominante.g.t.toLowerCase() : '') +
          ' (reparto ' + num(i.mezcla) + '/100). Esto obliga a salir del barrio para casi todo y ' +
          'deja calles vacías fuera de horario.'
        : i.mezcla >= U.mezclaBuena
        ? 'El sector reparte bien sus actividades (' + num(i.mezcla) + '/100). Un tejido mixto ' +
          'sostiene vida en la calle a distintas horas y acorta los recorridos diarios.'
        : 'Mezcla intermedia (' + num(i.mezcla) + '/100)' +
          (i.dominante ? ', con ' + i.dominante.g.t.toLowerCase() + ' por delante (' + num(i.pctDominante) + '%)' : '') +
          '. Hay base para diversificar sin partir de cero.'
    });

    if (i.pob.habitantes > 0) {
      v.push({
        id: 'poblacion',
        titulo: 'Población estimada',
        nivel: i.habPorHa >= U.densidadPobAlta ? 'bien' : i.habPorHa >= U.densidadPobBaja ? 'medio' : 'mal',
        dato: num(i.pob.habitantes) + ' hab · ' + num(i.habPorHa) + '/ha',
        texto: 'Del levantamiento salen ' + cn(i.pob.viviendas, 'vivienda', 'viviendas') + ' en ' +
               cn(i.pob.elementos, 'elemento residencial', 'elementos residenciales') + ', ' +
               pl(i.pob.habitantes, 'un habitante', 'unos ' + num(i.pob.habitantes) + ' habitantes') +
               ' en ' + num(i.areaHa) + ' ha (' + num(i.habPorHa) + ' por hectárea). ' +
               (i.habPorHa >= U.densidadPobAlta
                 ? 'Es densidad alta: hay masa crítica para sostener comercio y transporte de barrio.'
                 : i.habPorHa >= U.densidadPobBaja
                   ? 'Densidad media: suficiente para servicios de proximidad, con margen para crecer.'
                   : 'Densidad baja: a esta escala cuesta sostener comercio y transporte cerca.')
      });
    }

    // El verde no se juzga solo en porcentaje del suelo: lo que importa es
    // cuánto le toca a cada quien.
    if (i.verdePorHab !== null) {
      v.push({
        id: 'verdePorHab',
        titulo: 'Verde por habitante',
        nivel: i.verdePorHab >= U.verdePorHabBueno ? 'bien'
             : i.verdePorHab >= U.verdePorHabMinimo ? 'medio' : 'mal',
        dato: num(i.verdePorHab) + ' m²/hab',
        texto: pl(i.pob.habitantes, 'Al habitante estimado le corresponden ',
                  'A los ' + num(i.pob.habitantes) + ' habitantes estimados les corresponden ') +
               num(i.verdePorHab) + ' m² de vegetación' +
               pl(i.pob.habitantes, '. ', ' cada uno. ') +
               (i.verdePorHab >= U.verdePorHabBueno
                 ? 'Es una dotación holgada para un sector urbano.'
                 : i.verdePorHab >= U.verdePorHabMinimo
                   ? 'Alcanza, pero sin margen: cualquier densificación lo vuelve escaso.'
                   : 'Es muy poco: el verde que hay no da abasto para la gente que vive aquí.')
      });
    }

    v.push({
      id: 'densidad',
      titulo: 'Intensidad de uso',
      nivel: i.densidad >= U.densidadAlta ? 'bien' : i.densidad >= U.densidadBaja ? 'medio' : 'mal',
      dato: num(i.densidad) + ' elem./ha',
      texto: i.densidad >= U.densidadAlta
        ? 'Territorio consolidado: ' + cn(i.densidad, 'elemento por hectárea', 'elementos por hectárea') + ' en ' + num(i.areaHa) + ' ha.'
        : i.densidad >= U.densidadBaja
          ? 'Consolidación media: ' + cn(i.densidad, 'elemento por hectárea', 'elementos por hectárea') + '. Quedan vacíos por ocupar.'
          : 'Baja intensidad de uso: ' + cn(i.densidad, 'elemento por hectárea', 'elementos por hectárea') + '. Puede ser un borde ' +
            'urbano, una zona en formación — o que falte terreno por mapear.'
    });

    if (i.ausentes.length) {
      v.push({
        id: 'ausencias', titulo: 'Servicios ausentes',
        nivel: i.ausentes.length >= 3 ? 'mal' : 'medio',
        dato: num(i.ausentes.length) + ' de ' + BASICOS.length,
        texto: pl(i.ausentes.length, 'No se registró ', 'No se registraron ') +
               i.ausentes.map(a => a.que).join(', ') + ' dentro del área. ' +
               'Para eso, quien vive aquí depende de otro sector.'
      });
    }

    if (i.pctRiesgo >= U.riesgoAlto || i.riesgoPorHa >= U.riesgoPorHa) {
      v.push({
        id: 'riesgo', titulo: 'Suelo en riesgo o deterioro', nivel: 'mal',
        dato: num(i.pctRiesgo) + '% · ' + num(i.riesgoPorHa) + '/ha',
        texto: num(i.pctRiesgo) + '% de lo mapeado cayó en riesgo, baldío o deterioro (' +
               cn(i.porGrupo.riesgo, 'elemento', 'elementos') + '). Es la señal más directa de que el sector ' +
               'tiene suelo esperando decisión.'
      });
    }
    return v;
  }

  // ── FODA por reglas ─────────────────────────────────────────────────────
  // Cada regla: condición → frase. La frase SIEMPRE trae el número que la
  // justifica, para que en clase se pueda verificar.
  const REGLAS = [
    { t:'F', c:i => i.hayCobertura && i.verdePct >= U.verdeBueno,
      f:i => 'Base ambiental consolidada: ' + num(i.verdePct) + '% de vegetación viva (' + num(i.verdeM2) + ' m²).' },
    { t:'F', c:i => i.mezcla >= U.mezclaBuena,
      f:i => 'Tejido de usos variado (' + num(i.mezcla) + '/100): el sector no depende de una sola actividad.' },
    { t:'F', c:i => i.densidad >= U.densidadAlta,
      f:i => 'Sector consolidado: ' + cn(i.densidad, 'elemento por hectárea', 'elementos por hectárea') + '.' },
    { t:'F', c:i => (i.porGrupo.cultura || 0) >= 3,
      f:i => 'Presencia educativa y cultural (' + cn(i.porGrupo.cultura, 'elemento', 'elementos') + '): ancla de vida de barrio.' },
    { t:'F', c:i => (i.porGrupo.salud || 0) >= 2,
      f:i => 'Servicios de salud dentro del área (' + num(i.porGrupo.salud) + '): atención de proximidad resuelta.' },
    { t:'F', c:i => i.hayCobertura && i.aguaPct >= 1,
      f:i => 'El área incluye un cuerpo de agua (' + num(i.aguaPct) + '%): un frente natural con valor paisajístico.' },
    { t:'F', c:i => (i.porGrupo.comercio || 0) >= 5,
      f:i => 'Comercio activo (' + cn(i.porGrupo.comercio, 'elemento', 'elementos') + '): hay economía local funcionando.' },

    { t:'D', c:i => i.hayCobertura && i.verdePct < U.verdeAceptable,
      f:i => 'Déficit de vegetación: ' + num(i.verdePct) + '% del área. Poca sombra y poca absorción de lluvia.' },
    { t:'D', c:i => i.hayCobertura && i.duroPct >= U.duroExcesivo,
      f:i => 'Suelo mayoritariamente impermeable (' + num(i.duroPct) + '%): escorrentía alta en aguaceros.' },
    { t:'D', c:i => i.mezcla < U.mezclaMedia && i.dominante,
      f:i => 'Monofuncionalidad: ' + num(i.pctDominante) + '% de lo mapeado es ' + i.dominante.g.t.toLowerCase() + '.' },
    { t:'D', c:i => !i.porGrupo.salud,
      f:i => 'Sin servicios de salud registrados dentro del área' +
             (i.pob.habitantes ? ', para ' + pl(i.pob.habitantes, 'un habitante estimado',
                'unos ' + num(i.pob.habitantes) + ' habitantes estimados') + '.' : '.') },
    { t:'D', c:i => i.verdePorHab !== null && i.verdePorHab < U.verdePorHabMinimo,
      f:i => 'Apenas ' + num(i.verdePorHab) + ' m² de verde por habitante: el arbolado no da abasto para la gente que vive aquí.' },
    { t:'F', c:i => i.verdePorHab !== null && i.verdePorHab >= U.verdePorHabBueno,
      f:i => 'Dotación verde holgada: ' + num(i.verdePorHab) + ' m² por habitante estimado.' },
    { t:'O', c:i => i.habPorHa >= U.densidadPobAlta && (i.porGrupo.comercio || 0) <= 3,
      f:i => cn(i.pob.habitantes, 'habitante estimado', 'habitantes estimados') + ' a ' + num(i.habPorHa) +
             ' por hectárea con poco comercio: demanda concentrada sin atender.' },
    { t:'R', c:i => i.pob.elementos >= 10 && i.pob.precision < 40,
      f:i => 'Solo ' + num(i.pob.precision) + '% de lo residencial trae tipo de edificación definido: ' +
             'la población estimada es de piso mínimo y probablemente se queda corta.' },
    { t:'D', c:i => !i.porGrupo.cultura,
      f:() => 'Sin equipamiento educativo ni cultural registrado dentro del área.' },
    { t:'D', c:i => i.pctRiesgo >= U.riesgoAlto || i.riesgoPorHa >= U.riesgoPorHa,
      f:i => num(i.pctRiesgo) + '% del mapeo corresponde a suelo en riesgo, baldío o deterioro.' },
    { t:'D', c:i => i.densidad < U.densidadBaja,
      f:i => 'Baja intensidad de uso (' + num(i.densidad) + ' elem./ha): mucho suelo sin actividad registrada.' },

    { t:'O', c:i => (i.porGrupo.riesgo || 0) >= 2,
      f:i => cn(i.porGrupo.riesgo, 'predio baldío o en deterioro', 'predios baldíos o en deterioro') +
             ': suelo disponible sin necesidad de demoler nada.' },
    { t:'O', c:i => i.hayCobertura && i.verdePct >= U.verdeAceptable && i.verdePct < U.verdeBueno,
      f:i => 'Con ' + num(i.verdePct) + '% de verde ya existente, conectar los fragmentos cuesta menos que crear zonas nuevas.' },
    { t:'O', c:i => i.mezcla >= U.mezclaMedia && i.mezcla < U.mezclaBuena,
      f:() => 'La mezcla intermedia permite diversificar apoyándose en lo que ya funciona.' },
    { t:'O', c:i => (i.porGrupo.vivienda || 0) >= 8 && (i.porGrupo.comercio || 0) <= 2,
      f:i => 'Concentración residencial (' + cn(i.porGrupo.vivienda, 'elemento', 'elementos') +
             ') con poco comercio: demanda de barrio sin atender.' },
    { t:'O', c:i => (i.porGrupo.cultura || 0) >= 2 && (i.porGrupo.vivienda || 0) >= 5,
      f:() => 'Población residente y equipamiento educativo juntos: base para actividades fuera del horario escolar.' },
    { t:'O', c:i => i.densidad >= U.densidadBaja && i.densidad < U.densidadAlta,
      f:() => 'Consolidación media: queda margen para densificar sin saturar el sector.' },

    { t:'R', c:i => i.hayCobertura && i.verdePct < U.verdeAceptable && i.duroPct >= U.duroExcesivo,
      f:() => 'Poca vegetación y mucho suelo duro a la vez: el sector acumula calor y drena mal.' },
    { t:'R', c:i => (i.porGrupo.industria || 0) >= 2 && (i.porGrupo.vivienda || 0) >= 5,
      f:i => 'Industria (' + num(i.porGrupo.industria) + ') junto a vivienda (' + num(i.porGrupo.vivienda) + '): conflicto de usos por ruido, carga y horarios.' },
    { t:'R', c:i => i.pctRiesgo >= U.riesgoAlto || i.riesgoPorHa >= U.riesgoPorHa,
      f:() => 'El suelo en deterioro tiende a extenderse si no se interviene: un lote abandonado arrastra a los vecinos.' },
    { t:'R', c:i => i.muestraCorta,
      f:i => 'La muestra es corta (' + cn(i.total, 'elemento', 'elementos') +
             '): las conclusiones son preliminares hasta ampliar el mapeo.' },
    { t:'R', c:i => i.coberturaGruesa,
      f:i => 'La cobertura se midió a ' + num(i.mPorPx) + ' m por punto: a esa escala la lectura ambiental es de masas, no de detalle.' },
    { t:'R', c:i => !i.hayCobertura,
      f:() => 'Sin análisis de cobertura del suelo, la lectura ambiental de este informe queda incompleta.' }
  ];

  function generarFODA(i){
    const foda = { fortalezas:[], debilidades:[], oportunidades:[], riesgos:[] };
    const destino = { F:'fortalezas', D:'debilidades', O:'oportunidades', R:'riesgos' };
    REGLAS.forEach(function (r) {
      try { if (r.c(i)) foda[destino[r.t]].push(r.f(i)); } catch(e){}
    });
    // Un cuadrante vacío no es un error: significa que no se detectó nada de
    // ese tipo, y decirlo así enseña más que dejarlo en blanco.
    if (!foda.fortalezas.length) foda.fortalezas.push('No se detectaron fortalezas destacables con lo mapeado hasta ahora.');
    if (!foda.debilidades.length) foda.debilidades.push('No se detectaron debilidades relevantes en los indicadores medidos.');
    if (!foda.oportunidades.length) foda.oportunidades.push('Amplíe el mapeo o analice la cobertura para descubrir oportunidades.');
    if (!foda.riesgos.length) foda.riesgos.push('Sin riesgos evidentes en los datos disponibles.');
    return foda;
  }

  // ── Propuesta de implantación ───────────────────────────────────────────
  // Cada propuesta nace de una carencia MEDIDA y dice qué se gana. La cantidad
  // sugerida sale del tamaño del área, no de un número inventado.
  const CATALOGO = [
    { id:'parque', ico:'🌳', uso:'Parque de bolsillo / zona verde',
      c:i => i.hayCobertura && (i.verdePct < U.verdeAceptable ||
             (i.verdePorHab !== null && i.verdePorHab < U.verdePorHabMinimo)),
      cuantos:i => Math.max(1, Math.round(i.areaHa / 3)),
      porque:i => i.verdePorHab !== null
        ? 'a cada habitante estimado le tocan ' + num(i.verdePorHab) + ' m² de verde'
        : 'la vegetación cubre solo ' + num(i.verdePct) + '% del área',
      beneficio:'Da sombra, baja la temperatura de la calle y crea un lugar de encuentro a pie.' },
    { id:'arbolado', ico:'🌲', uso:'Arbolado de andén',
      c:i => i.hayCobertura && i.verdePct < U.verdeBueno,
      cuantos:i => Math.max(10, Math.round(i.areaHa * 12)),
      porque:i => 'con ' + num(i.verdePct) + '% de verde, las calles quedan sin sombra continua',
      beneficio:'Es la forma más barata de ganar sombra: no consume suelo, se planta sobre el andén existente.' },
    { id:'permeable', ico:'💧', uso:'Superficie permeable / jardín de lluvia',
      c:i => i.hayCobertura && i.duroPct >= U.duroExcesivo,
      cuantos:i => Math.max(1, Math.round(i.areaHa / 4)),
      porque:i => 'el ' + num(i.duroPct) + '% del suelo es impermeable',
      beneficio:'Deja que la lluvia se infiltre en vez de correr hacia la calle: menos encharcamiento.' },
    { id:'salud', ico:'🚑', uso:'Puesto de salud de proximidad',
      c:i => !i.porGrupo.salud,
      // Un puesto de proximidad por cada ~5.000 habitantes: la cantidad sale
      // de la gente estimada, no de un número fijo, para que el ejercicio
      // muestre que dimensionar depende de a cuántos hay que atender.
      cuantos:i => Math.max(1, Math.round(i.pob.habitantes / 5000)),
      porque:i => 'no hay ningún servicio de salud dentro del área' +
                  (i.pob.habitantes ? pl(i.pob.habitantes, ' y vive aquí un habitante estimado',
                      ' y viven aquí unos ' + num(i.pob.habitantes) + ' habitantes estimados') : ''),
      beneficio:'Resuelve la atención básica sin salir del barrio, que es lo que más pesa en urgencias y control.' },
    { id:'educativo', ico:'📚', uso:'Equipamiento educativo o biblioteca de barrio',
      c:i => !i.porGrupo.cultura,
      cuantos:() => 1,
      porque:() => 'no se registró equipamiento educativo ni cultural',
      beneficio:'Ancla población joven y da uso al espacio público fuera del horario escolar.' },
    { id:'comercio', ico:'🏬', uso:'Comercio de abastecimiento diario',
      c:i => (i.porGrupo.vivienda || 0) >= 5 && (i.porGrupo.comercio || 0) <= 2,
      cuantos:i => Math.max(2, Math.round((i.porGrupo.vivienda || 0) / 6)),
      porque:i => 'hay ' + cn(i.porGrupo.vivienda, 'elemento residencial', 'elementos residenciales') +
                  ' y solo ' + cn(i.porGrupo.comercio || 0, 'comercial', 'comerciales'),
      beneficio:'Acorta el recorrido de la compra diaria y sostiene actividad en la calle.' },
    { id:'mixto', ico:'🧩', uso:'Edificación de uso mixto (vivienda + comercio)',
      c:i => i.mezcla < U.mezclaMedia && (i.porGrupo.riesgo || 0) >= 1,
      cuantos:i => Math.max(1, Math.min(i.porGrupo.riesgo || 1, 4)),
      porque:i => 'la mezcla de usos está en ' + num(i.mezcla) + '/100 y hay suelo disponible',
      beneficio:'Rompe la monofuncionalidad sin ocupar suelo nuevo: aprovecha los predios vacíos.' },
    { id:'espacioPublico', ico:'🏛️', uso:'Plaza o espacio público de encuentro',
      c:i => (i.porGrupo.riesgo || 0) >= 2 && i.densidad >= U.densidadBaja,
      cuantos:() => 1,
      porque:i => 'hay ' + cn(i.porGrupo.riesgo, 'predio baldío o en deterioro', 'predios baldíos o en deterioro') +
                  ' que ' + pl(i.porGrupo.riesgo, 'arrastra', 'arrastran') + ' a su entorno',
      beneficio:'Convierte el punto que deteriora la manzana en el que la ordena.' },
    { id:'transporte', ico:'🚏', uso:'Parada o punto de transporte',
      c:i => !(i.porGrupo.servicios || 0) && i.densidad >= U.densidadBaja,
      cuantos:() => 1,
      porque:() => 'no se registró infraestructura de transporte en el área',
      beneficio:'Conecta el sector con el resto de la ciudad sin depender del vehículo particular.' }
  ];

  function implantacion(i){
    const props = [];
    CATALOGO.forEach(function (p) {
      try {
        if (!p.c(i)) return;
        props.push({ ico:p.ico, uso:p.uso, cuantos:p.cuantos(i),
                     porque:p.porque(i), beneficio:p.beneficio });
      } catch(e){}
    });
    let resumen;
    if (!props.length) {
      resumen = 'Con los indicadores medidos, el área no muestra carencias que exijan una ' +
                'implantación prioritaria. Amplíe el mapeo o analice la cobertura del suelo ' +
                'para afinar la lectura.';
    } else {
      resumen = 'A partir de ' + cn(i.total, 'elemento mapeado', 'elementos mapeados') + ' en ' + num(i.areaHa) +
                ' ha, URBIS propone ' + props.length + ' línea' + (props.length === 1 ? '' : 's') +
                ' de implantación. Cada una responde a una carencia medida en este mismo ' +
                'levantamiento, y está pensada como ejercicio de proyecto: la cantidad es una ' +
                'referencia de partida, no una cifra de diseño.';
    }
    return { propuestas: props, resumen: resumen };
  }

  // ── API ─────────────────────────────────────────────────────────────────

  function diagnosticar(ctx){
    const c = ctx || ctxPC();
    if (!c) return null;
    const i = indicadores(c);
    if (!i) return null;
    return { ind:i, veredictos: veredictos(i), foda: generarFODA(i), implantacion: implantacion(i) };
  }

  // ── Piezas visuales, compartidas por el panel y el informe ──────────────

  // Barra de reparto de usos y ficha de población. La barra es la misma pieza
  // que usa el informe empresarial: quien vea los dos lee lo mismo.
  function htmlPoblacion(d){
    const i = d.ind;
    const barra = i.reparto.map(x =>
      '<i style="width:' + x.pct + '%;background:' + x.color + '" title="' + esc(x.etq) + '"></i>').join('');
    const leyenda = i.reparto.map(x =>
      '<span><i style="background:' + x.color + '"></i>' + esc(x.etq) + ' ' + x.pct + '%</span>').join('');

    if (!i.pob.habitantes) {
      /* Sin habitantes hay DOS causas y no una, y dicen cosas distintas a
         quien está mapeando: que nadie registró una vivienda, o que sí hay
         alguna y la cifra se fue a cero al redondear a la decena —con una
         casa son 3,1 personas, que redondean a 0—. La frase única declaraba
         la primera sobre la segunda, que es declarar mal la causa (v867): el
         estudiante leía «no mapeaste vivienda» habiendo mapeado una. El
         discriminante estaba al lado, en `i.pob.elementos`. */
      const razon = i.pob.elementos
        ? 'Hay ' + cn(i.pob.elementos, 'elemento residencial mapeado', 'elementos residenciales mapeados') +
          ', pero la población se redondea a la decena y con tan poco la cifra queda por debajo de 10. ' +
          'Amplíe el mapeo para estimarla.'
        : 'Sin elementos residenciales mapeados no se puede estimar población.';
      return '<div class="pcd-pob"><div class="pcd-barra">' + barra + '</div>' +
             '<div class="pcd-leyenda">' + leyenda + '</div>' +
             '<p class="pcd-nota">' + razon + '</p></div>';
    }
    const top = i.pob.porTipo.slice(0, 4);
    return '<div class="pcd-pob">' +
      '<div class="pcd-cifras">' +
        '<div><b>' + num(i.pob.habitantes) + '</b><small>habitantes estimados</small></div>' +
        '<div><b>' + num(i.pob.viviendas) + '</b><small>viviendas contadas</small></div>' +
        '<div><b>' + num(i.habPorHa) + '</b><small>hab. por hectárea</small></div>' +
        (i.verdePorHab !== null
          ? '<div><b>' + num(i.verdePorHab) + '</b><small>m² verdes por hab.</small></div>' : '') +
      '</div>' +
      '<div class="pcd-barra">' + barra + '</div>' +
      '<div class="pcd-leyenda">' + leyenda + '</div>' +
      '<table class="pcd-tabla pcd-tabla-viv"><tr><th>Tipo de vivienda mapeado</th><th>Elem.</th><th>Viviendas</th></tr>' +
        top.map(t => '<tr><td>' + esc(t.tipo) + '</td><td class="n">' + t.n + '</td>' +
                     '<td class="n">' + num(t.viviendas) + '</td></tr>').join('') +
      '</table>' +
      '<p class="pcd-nota">La población sale de contar viviendas por tipo de edificación, no del ' +
        'tamaño del área: una torre y una casa ocupan lo mismo en el mapa y no albergan a la misma gente. ' +
        (i.pob.precision < 60
          ? 'Ojo: solo ' + num(i.pob.precision) + '% de lo residencial trae tipo definido, así que la cifra es un piso mínimo.'
          : 'Es una estimación, no un censo.') + '</p>' +
    '</div>';
  }

  function htmlVeredictos(d){
    return d.veredictos.map(function (v) {
      return '<div class="pcd-ver pcd-' + v.nivel + '">' +
        '<div class="pcd-ver-cab"><b>' + esc(v.titulo) + '</b><span>' + esc(v.dato) + '</span></div>' +
        '<p>' + esc(v.texto) + '</p></div>';
    }).join('');
  }

  function htmlFoda(d, maxItems){
    const caja = (t, ico, items, cls) =>
      '<div class="pcd-foda pcd-foda-' + cls + '"><h5>' + ico + ' ' + t + '</h5><ul>' +
      items.slice(0, maxItems || 4).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
    return '<div class="pcd-foda-grid">' +
      caja('Fortalezas', '💪', d.foda.fortalezas, 'f') +
      caja('Debilidades', '⚠️', d.foda.debilidades, 'd') +
      caja('Oportunidades', '🚀', d.foda.oportunidades, 'o') +
      caja('Riesgos', '🛑', d.foda.riesgos, 'r') +
    '</div>';
  }

  function htmlImplantacion(d){
    const im = d.implantacion;
    if (!im.propuestas.length) return '<p class="pcd-vacio">' + esc(im.resumen) + '</p>';
    return '<p class="pcd-resumen">' + esc(im.resumen) + '</p>' +
      '<table class="pcd-tabla"><tr><th>Uso a implantar</th><th>Cant.</th>' +
      '<th>Por qué aquí</th><th>Qué se gana</th></tr>' +
      im.propuestas.map(p =>
        '<tr><td><b>' + p.ico + ' ' + esc(p.uso) + '</b></td>' +
        '<td class="n">' + p.cuantos + '</td>' +
        '<td>' + esc(p.porque) + '</td>' +
        '<td>' + esc(p.beneficio) + '</td></tr>').join('') +
      '</table>';
  }

  window.URBIS_PC_DIAGNOSTICO = {
    diagnosticar, htmlVeredictos, htmlFoda, htmlImplantacion, htmlPoblacion,
    UMBRALES: U
  };
})();
