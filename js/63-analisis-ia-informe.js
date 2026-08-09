/* URBIS · Análisis de Implantación IA — INFORMES (js/63)
   Genera DOS documentos distintos a partir del mismo análisis:

   A) Informe ejecutivo — UNA sola hoja carta (horizontal por defecto), con
      mapa, indicadores, gráficas, viabilidad, FODA y recomendaciones. Es el
      que se le entrega al cliente. Se auto-escala para caber siempre en una
      página, sin importar cuánta información traiga el análisis.

   B) Listado completo de puntos — documento de trabajo (varias páginas),
      con TODOS los usos del radio agrupados por categoría de la Matriz
      URBIS, y una sección aparte con los que quedaron sin clasificar
      (incluyendo sus etiquetas OSM) para poder asignarles categoría.

   El PDF final lo produce el navegador con "Guardar como PDF". */
(function(){
  'use strict';

  function esc(s){ return String(s == null ? '' : s).replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  const NOMBRE_ESTUDIO = {
    caracterizacion:'Caracterización Urbana', comercial:'Viabilidad Comercial',
    inmobiliaria:'Viabilidad Inmobiliaria', equipamientos:'Equipamientos', completo:'Estudio Completo'
  };

  // Paleta tomada directamente del logo de URBIS: el celeste de marca
  // (#34CCFE) y el dorado del punto (#FABD0A). Los azules profundos son
  // variantes del mismo celeste, oscurecidas para que el texto blanco y los
  // títulos tengan contraste suficiente al imprimir.
  const CELESTE = '#34CCFE', VERDE = '#075E88', AZUL_MED = '#0E86BE',
        VERDE_CLARO = '#0A6F9E', ORO = '#FABD0A', TINTA = '#12202e', BORDE = '#c7e7f7';

  // ── Estilos del informe (Fase 4) ────────────────────────────────────────
  // Cuatro estilos completos en vez de muchos a medias. Cada uno define TODOS
  // los tokens, así que ninguno hereda un color del otro y no puede quedar
  // texto invisible (el riesgo real al cambiar de fondo claro a oscuro).
  //   cab1/cab2  degradado del encabezado      panel   fondo de cada bloque
  //   acento     títulos de bloque             hoja    fondo de la página
  //   oro        detalles y estrellas          tinta   texto principal
  //   txt2/txt3  texto secundario / apagado    borde   marco de los bloques
  //   linea      filetes de tabla              suave   fondos tenues
  //   ok/warn/bad  niveles (alta/media/baja)
  const ESTILOS = {
    institucional: {
      nombre: 'Institucional', desc: 'Celeste de marca URBIS. El de siempre.',
      cab1: VERDE, cab2: AZUL_MED, acento: VERDE_CLARO, oro: ORO, cabTxt: '#ffffff',
      hoja: '#ffffff', panel: '#ffffff', tinta: TINTA, txt2: '#4a5a6a', txt3: '#627285',
      borde: '#cfe6f5', linea: '#e9f4fb', suave: '#f3fbff', suave2: '#e8f5fd',
      heroA: '#f2fbff', heroB: '#e6f6fe', ok: '#15803d', warn: '#b45309', bad: '#b91c1c', info: '#1d4ed8',
      fodaF: ['#a7e3bd', '#f2fbf5'], fodaD: ['#f6bcbc', '#fef4f4'],
      fodaO: ['#b3d4f7', '#f3f8fe'], fodaR: ['#f7dca6', '#fffaf0'],
      chartTxt: '#2f3f4e', chartTxt2: '#5a6a7a', chartGrid: '#eef2f6', chartFondo: '#ffffff'
    },
    premium: {
      nombre: 'Premium oscuro', desc: 'Fondo profundo y dorado. Para presentar a inversionistas.',
      cab1: '#061722', cab2: '#0d3040', acento: CELESTE, oro: ORO, cabTxt: '#ffffff',
      hoja: '#0b1a24', panel: '#11242f', tinta: '#eaf4fa', txt2: '#b7cbd8', txt3: '#8ba5b5',
      borde: '#1f3d4d', linea: '#1a3340', suave: '#16303d', suave2: '#1a3846',
      heroA: '#123243', heroB: '#0e2735', ok: '#4ade80', warn: '#fbbf24', bad: '#f87171', info: '#60a5fa',
      fodaF: ['#1d5136', '#102a1e'], fodaD: ['#5c2323', '#2a1414'],
      fodaO: ['#1e3f6b', '#122239'], fodaR: ['#5f4415', '#2b2010'],
      chartTxt: '#eaf4fa', chartTxt2: '#b7cbd8', chartGrid: '#1f3d4d', chartFondo: '#11242f'
    },
    minimalista: {
      nombre: 'Minimalista', desc: 'Blanco y negro, sin adornos. Máxima sobriedad.',
      cab1: '#1a1a1a', cab2: '#3a3a3a', acento: '#1a1a1a', oro: '#8a8a8a', cabTxt: '#ffffff',
      hoja: '#ffffff', panel: '#ffffff', tinta: '#161616', txt2: '#4a4a4a', txt3: '#6e6e6e',
      borde: '#dcdcdc', linea: '#ededed', suave: '#f7f7f7', suave2: '#efefef',
      heroA: '#f7f7f7', heroB: '#efefef', ok: '#15803d', warn: '#a16207', bad: '#b91c1c', info: '#374151',
      fodaF: ['#cfcfcf', '#fafafa'], fodaD: ['#cfcfcf', '#fafafa'],
      fodaO: ['#cfcfcf', '#fafafa'], fodaR: ['#cfcfcf', '#fafafa'],
      chartTxt: '#161616', chartTxt2: '#4a4a4a', chartGrid: '#ededed', chartFondo: '#ffffff'
    },
    arquitectonico: {
      nombre: 'Arquitectónico', desc: 'Papel cálido y terracota, como una lámina de taller.',
      cab1: '#8c3f22', cab2: '#b5502f', acento: '#8c3f22', oro: '#c98a3c', cabTxt: '#fdf6ee',
      hoja: '#fbf8f3', panel: '#fffdfa', tinta: '#221f1b', txt2: '#57504a', txt3: '#726a60',
      borde: '#ddd2c4', linea: '#eae2d6', suave: '#f6efe4', suave2: '#efe5d6',
      heroA: '#f8f1e6', heroB: '#f1e7d8', ok: '#4d7c3f', warn: '#b5502f', bad: '#9b2c2c', info: '#3f6478',
      fodaF: ['#c3d4b4', '#f2f6ec'], fodaD: ['#e2b8b0', '#faefec'],
      fodaO: ['#bccbd6', '#eef3f7'], fodaR: ['#e0c79a', '#faf2e2'],
      chartTxt: '#221f1b', chartTxt2: '#57504a', chartGrid: '#eae2d6', chartFondo: '#fffdfa'
    }
  };

  // Tema activo. Se fija al construir cada informe, antes de armar el CSS.
  let T = ESTILOS.institucional;
  function fijarEstilo(id){ T = ESTILOS[id] || ESTILOS.institucional; return T; }

  function estrellasHTML(n){ return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n)); }
  function estrellasDeScore(score){ return Math.max(1, Math.min(5, Math.round((score || 0) / 20))); }

  // ── Mapa estático + círculo de radio + puntos superpuestos ──────────────
  // El círculo y los puntos se dibujan con CSS sobre la imagen del mapa
  // (LocationIQ no los soporta y la URL no aguantaría miles de marcadores).
  function calcZoom(lat, radioM, ladoMenorPx){
    const objetivoRadioPx = ladoMenorPx * 0.46;     // el círculo llena buena parte del mapa
    const mppNecesario = radioM / objetivoRadioPx;
    let z = Math.log(156543.03392 * Math.cos(lat * Math.PI / 180) / mppNecesario) / Math.LN2;
    z = Math.max(11, Math.min(18, Math.floor(z)));
    const mpp = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z);
    return { z, mpp, radioPx: radioM / mpp };
  }

  function urlMapaEstatico(meta, w, h, zoom){
    const cfg = (window.URBIS_CONFIG && window.URBIS_CONFIG.LOCATIONIQ) || {};
    if (!cfg.apiKey) return '';
    return 'https://maps.locationiq.com/v3/staticmap?key=' + encodeURIComponent(cfg.apiKey) +
      '&center=' + meta.lat + ',' + meta.lng + '&zoom=' + zoom +
      '&size=' + w + 'x' + h + '&format=png';
  }

  function puntosSobreMapa(r, mpp, w, h, maxPuntos){
    const lat0 = r.meta.lat, lng0 = r.meta.lng, mx = w / 2, my = h / 2;
    const dentro = [];
    (r.pois || []).forEach(p => {
      const dx = (p.lng - lng0) * 111320 * Math.cos(lat0 * Math.PI / 180) / mpp;
      const dy = -(p.lat - lat0) * 110540 / mpp;
      if (Math.abs(dx) < mx - 6 && Math.abs(dy) < my - 6) dentro.push({ dx, dy, color: p.color });
    });
    // Muestreo uniforme: si se tomaran solo los más cercanos, todos los
    // puntos quedarían amontonados en el centro del mapa.
    const paso = Math.max(1, Math.ceil(dentro.length / (maxPuntos || 150)));
    let html = '';
    for (let i = 0; i < dentro.length; i += paso) {
      const d = dentro[i];
      const x = (mx + d.dx) / w * 100, y = (my + d.dy) / h * 100;
      html += '<i class="pt" style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%;background:' + d.color + '"></i>';
    }
    return html;
  }

  function bloqueMapa(r, horizontal){
    // Apaisado 4:3 en vez de cuadrado: el mapa va en su propia columna y así
    // se come bastante menos alto de la hoja, que es lo que obliga al
    // auto-ajuste a encoger la letra. El círculo de radio se dimensiona con
    // el lado menor, así que se sigue viendo completo.
    const W = 800, H = 600;
    const z = calcZoom(r.meta.lat, r.meta.radioM, Math.min(W, H));
    const url = urlMapaEstatico(r.meta, W, H, z.z);
    const pctW = (z.radioPx / W * 200).toFixed(2), pctH = (z.radioPx / H * 200).toFixed(2);
    const radioTxt = r.meta.radioM >= 1000 ? (r.meta.radioM / 1000) + ' km' : r.meta.radioM + ' m';
    return '<div class="mapa-wrap">' +
      (url ? '<img class="mapa-img" src="' + url + '" alt="Mapa del entorno">' : '<div class="mapa-img mapa-vacio"></div>') +
      '<div class="mapa-radio" style="width:' + pctW + '%;height:' + pctH + '%"></div>' +
      puntosSobreMapa(r, z.mpp, W, H, 150) +
      '<div class="mapa-pin"><span></span><b>PROYECTO</b></div>' +
      '<div class="mapa-tag">MAPA DEL ENTORNO</div>' +
      '<div class="mapa-escala">Radio · <b>' + radioTxt + '</b></div>' +
      '</div>';
  }

  // ── Bloques de contenido ────────────────────────────────────────────────
  function kpis(r){
    const s = r.stats;
    const item = (ico, val, lbl) => '<div class="kpi"><span>' + ico + '</span><b>' + val + '</b><small>' + lbl + '</small></div>';
    return '<div class="kpis">' +
      item('👥', s.poblacionEstimada.toLocaleString('es-CO'), 'Población estimada') +
      item('📍', s.total.toLocaleString('es-CO'), 'Usos identificados') +
      item('📐', s.densidadPorHa, 'Usos por hectárea') +
      item('🛣️', s.movilidad.nViasArterias, 'Vías arterias') +
      item('🚌', s.movilidad.paradasBus, 'Paradas transporte') +
      '</div>';
  }

  function datosGenerales(r){
    const fecha = new Date(r.meta.fechaISO).toLocaleString('es-CO', { dateStyle:'long', timeStyle:'short' });
    const radioTxt = r.meta.radioM >= 1000 ? (r.meta.radioM / 1000) + ' km' : r.meta.radioM + ' m';
    const it = (ico, lbl, val) => '<div class="dg"><span>' + ico + '</span><div><b>' + lbl + '</b><p>' + val + '</p></div></div>';
    return '<div class="datos-generales">' +
      it('🏢', 'Proyecto', esc(r.meta.proyectoNombre)) +
      it('📅', 'Fecha de análisis', esc(fecha)) +
      it('📍', 'Coordenadas', r.meta.lat.toFixed(6) + ', ' + r.meta.lng.toFixed(6)) +
      it('📋', 'Tipo de estudio', esc(NOMBRE_ESTUDIO[r.meta.tipoEstudio] || r.meta.tipoEstudio)) +
      it('⭕', 'Radio de análisis', radioTxt + ' (~' + r.stats.areaHa + ' ha)') +
      (r.meta.direccionAprox ? it('🧭', 'Referencia', esc(r.meta.direccionAprox)) : '') +
      '</div>';
  }

  function tablaComposicion(r){
    const G = window.AIA_MOTOR.GRUPOS, C = window.AIA_MOTOR.GRUPO_COLOR, s = r.stats;
    const grupos = Object.keys(G).filter(g => (s.porGrupo[g] || 0) > 0)
      .sort((a, b) => s.porGrupo[b] - s.porGrupo[a]);
    const max = grupos.length ? s.porGrupo[grupos[0]] : 1;
    const filas = grupos.map(g => {
      const n = s.porGrupo[g], pct = (100 * n / Math.max(s.total, 1));
      return '<tr><td><i class="dot" style="background:' + C[g] + '"></i>' + esc(G[g].t) + '</td>' +
        '<td class="num">' + n.toLocaleString('es-CO') + '</td>' +
        '<td class="num">' + pct.toFixed(1) + '%</td>' +
        '<td class="barra"><i style="width:' + (100 * n / max).toFixed(1) + '%;background:' + C[g] + '"></i></td></tr>';
    }).join('');
    return '<div class="bloque"><h2>Composición del entorno <em>(por número de usos)</em></h2>' +
      '<table class="tbl-comp"><thead><tr><th>Grupo de uso (Matriz URBIS)</th><th class="num">Usos</th><th class="num">%</th><th>Participación</th></tr></thead>' +
      '<tbody>' + filas + '</tbody>' +
      '<tfoot><tr><td>TOTAL</td><td class="num">' + s.total.toLocaleString('es-CO') + '</td><td class="num">100%</td><td></td></tr></tfoot></table></div>';
  }

  // Aro de progreso en SVG: se imprime nítido a cualquier tamaño y no depende
  // de Chart.js. Con r=15.9155 la circunferencia mide 100, así que el
  // stroke-dasharray se puede escribir directamente en puntos del score.
  function gaugeSVG(score, color){
    const R = 15.9155;
    return '<svg class="gauge" viewBox="0 0 40 40">' +
      '<circle cx="20" cy="20" r="' + R + '" fill="none" stroke="#e6eef5" stroke-width="4.2"/>' +
      '<circle cx="20" cy="20" r="' + R + '" fill="none" stroke="' + color + '" stroke-width="4.2" ' +
        'stroke-linecap="round" stroke-dasharray="' + score + ' ' + (100 - score) + '" ' +
        'transform="rotate(-90 20 20)"/>' +
      '<text x="20" y="19" text-anchor="middle" dominant-baseline="central" class="gauge-n" ' +
        'fill="' + color + '">' + score + '</text>' +
      '<text x="20" y="26.5" text-anchor="middle" class="gauge-s">/100</text></svg>';
  }

  function bloqueViabilidad(r){
    if (!r.viabilidad) return '';
    const v = r.viabilidad;
    const col = v.nivel === 'Alta' ? T.ok : (v.nivel === 'Media' ? T.warn : T.bad);
    let desglose = '';
    if (!v.subscores && r.desglosePorUso && r.desglosePorUso.length) {
      desglose = '<table class="tbl-mini">' + r.desglosePorUso.map(d => {
        const c2 = d.nivel === 'Alta' ? T.ok : (d.nivel === 'Media' ? T.warn : T.bad);
        return '<tr><td>' + d.icono + ' ' + esc(d.nombre) + '</td><td class="num" style="color:' + c2 + '"><b>' + d.score + '</b></td><td>' + esc(d.nivel) + '</td></tr>';
      }).join('') + '</table>';
    } else if (v.subscores) {
      const N = { demanda:'Demanda', competencia:'Competencia', complementarios:'Complementarios', movilidad:'Movilidad', entorno:'Entorno' };
      desglose = '<table class="tbl-mini">' + Object.keys(v.subscores).map(k =>
        '<tr><td>' + N[k] + '</td><td class="barra"><i style="width:' + v.subscores[k] + '%;background:' + col + '"></i></td><td class="num">' + v.subscores[k] + '</td></tr>').join('') + '</table>';
    }
    // Las estrellas son el elemento protagonista: comunican mucho mejor la
    // oportunidad al cliente que un porcentaje. El puntaje sigue visible,
    // pero como respaldo del dato principal.
    const est = estrellasDeScore(v.score);
    const cg = r.compatibilidadGlobal;
    return '<div class="bloque"><h2>Viabilidad del proyecto <em>· qué tan bien encaja TU proyecto en este lote</em></h2>' +
      '<div class="hero">' +
        gaugeSVG(v.score, col) +
        '<div class="hero-est">' + estrellasHTML(est) + '</div>' +
        '<div class="hero-info"><b>' + est + ' de 5</b>' +
          '<span class="nivel" style="background:' + col + '">Viabilidad ' + esc(v.nivel) + '</span>' +
          '<em>' + v.score + '/100 según el análisis del entorno</em></div>' +
      '</div>' +
      (cg ? '<div class="hero-compat"><span>Compatibilidad entre los usos del proyecto</span>' +
            '<b>' + estrellasHTML(cg.estrellas) + '</b><em>' + cg.estrellas + ' de 5</em></div>' : '') +
      '<ul class="args">' + v.argumentos.slice(0, 4).map(a => '<li>' + esc(a) + '</li>').join('') + '</ul>' +
      desglose + '</div>';
  }

  function bloqueRanking(r){
    if (!r.ranking || !r.ranking.length) return '';
    return '<div class="bloque"><h2>Usos recomendados para el lote</h2><table class="tbl-mini">' +
      r.ranking.map((it, i) => '<tr><td class="pos">' + (i + 1) + '</td><td>' + it.icono + ' ' + esc(it.nombre) + '</td>' +
        '<td class="num"><b>' + it.score + '</b></td><td class="razon">' + esc(it.razon) + '</td></tr>').join('') +
      '</table></div>';
  }

  function bloqueUnidades(r){
    if (!r.recomendacionesUnidades || !r.recomendacionesUnidades.length) return '';
    return r.recomendacionesUnidades.map(g =>
      '<div class="bloque"><h2>Qué poner en tus ' + g.cantidad + ' unidad(es) de "' + esc(g.usoNombre) + '"</h2>' +
      '<table class="tbl-mini">' + g.opciones.map(o =>
        '<tr><td class="pos">' + o.unidadesSugeridas + '×</td><td>' + o.icono + ' ' + esc(o.nombre) + '</td><td class="num"><b>' + o.score + '</b>/100</td></tr>').join('') +
      '</table></div>').join('');
  }

  function bloqueCompatibilidad(r){
    if (!r.compatibilidad || !r.compatibilidad.length) return '';
    return '<div class="bloque"><h2>Compatibilidad entre usos</h2><table class="tbl-mini">' +
      r.compatibilidad.slice(0, 3).map(c => '<tr><td>' + c.iconoA + ' ' + esc(c.usoA) + ' + ' + c.iconoB + ' ' + esc(c.usoB) + '</td>' +
        '<td class="estrellas">' + '★'.repeat(c.estrellas) + '☆'.repeat(5 - c.estrellas) + '</td>' +
        '<td class="razon">' + esc(c.motivo) + '</td></tr>').join('') + '</table></div>';
  }

  function bloqueFoda(r){
    const f = r.foda || {};
    const caja = (t, ico, items, cls) => '<div class="foda ' + cls + '"><h3>' + ico + ' ' + t + '</h3><ul>' +
      ((items || []).length ? items.slice(0, 3).map(x => '<li>' + esc(x) + '</li>').join('') : '<li class="vacio">Sin hallazgos relevantes.</li>') + '</ul></div>';
    // Va a todo el ancho de la hoja en 4 columnas: los hallazgos ahora citan
    // lugares por su nombre y en columnas angostas se disparaban a 8 líneas,
    // que era lo que obligaba a encoger toda la hoja.
    return '<div class="bloque"><h2>Análisis FODA del entorno</h2><div class="foda-grid4">' +
      caja('Fortalezas', '💪', f.fortalezas, 'f') + caja('Debilidades', '⚠️', f.debilidades, 'd') +
      caja('Oportunidades', '🚀', f.oportunidades, 'o') + caja('Riesgos', '🛑', f.riesgos, 'r') +
      '</div></div>';
  }

  // Movilidad y exposición vial. Se apoya solo en la jerarquía de la malla
  // vial de OpenStreetMap: mide visibilidad y acceso, NO conteos de tráfico
  // (esos requieren una fuente externa que hoy no tenemos).
  function bloqueMovilidad(r){
    const m = r.stats.movilidad;
    const col = m.exposicion >= 70 ? T.ok : m.exposicion >= 50 ? T.acento : m.exposicion >= 30 ? T.warn : T.bad;
    const vias = (m.viasArterias || []).slice(0, 4);
    const maxD = Math.max(1, ...vias.map(v => v.distM));
    const barras = vias.map(v => {
      const pesoJer = { troncal: 100, principal: 85, secundaria: 65, colectora: 45 }[v.jerarquia] || 40;
      const colJ = pesoJer >= 85 ? '#075E88' : pesoJer >= 65 ? '#0E86BE' : CELESTE;
      return '<tr><td class="via-n">' + esc(v.nombre) + '<em>' + esc(v.jerarquia) + '</em></td>' +
        '<td class="barra"><i style="width:' + Math.max(8, 100 - (v.distM / maxD * 78)).toFixed(0) + '%;background:' + colJ + '"></i></td>' +
        '<td class="num">' + v.distM + ' m</td></tr>';
    }).join('');
    return '<div class="bloque"><h2>Movilidad y exposición vial</h2>' +
      '<div class="expo"><div class="expo-num" style="color:' + col + '">' + m.exposicion + '<small>/100</small></div>' +
      '<div class="expo-info"><b style="background:' + col + '">Exposición ' + esc(m.nivelExposicion) + '</b>' +
      '<span>' + m.nViasArterias + ' corredores · ' + m.paradasBus + ' paradas · ' + m.ciclorrutas + ' ciclorrutas</span></div></div>' +
      (barras ? '<table class="tbl-vias">' + barras + '</table>' : '') +
      '<p class="expo-arg">' + esc(m.argumento) + '</p></div>';
  }

  // Indicadores urbanos (Fase 2): van en la columna que quedaba más corta,
  // que es justamente donde aparecían los espacios en blanco.
  function bloqueIndicadores(r){
    const i = r.indicadores;
    if (!i) return '';
    const colNivel = t => /muy alta|alto potencial|fuerte transformaci|riesgo bajo|alta actividad/i.test(t) ? T.ok
      : /(^|\s)alta|en transformaci|potencial medio|moderada|riesgo medio/i.test(t) ? T.acento
      : /media|en transici|riesgo alto|especializado/i.test(t) ? T.warn : T.bad;
    const fila = (etq, val, nivel) => '<tr><td class="ind-n">' + etq + '</td>' +
      '<td class="barra"><i style="width:' + val + '%;background:' + colNivel(nivel) + '"></i></td>' +
      '<td class="ind-v" style="color:' + colNivel(nivel) + '">' + esc(nivel) + '</td></tr>';
    return '<div class="bloque"><h2>Indicadores urbanos</h2><table class="tbl-ind">' +
      fila('Diversidad de usos', i.diversidad.valor, i.diversidad.nivel) +
      fila('Actividad comercial', Math.min(100, i.comercio.total * 2), i.comercio.nivel) +
      fila('Expansión (suelo libre)', i.expansion.valor, i.expansion.nivel) +
      fila('Transformación (obras)', i.transformacion.valor, i.transformacion.nivel) +
      fila('Riesgo urbano', i.riesgos.valor, i.riesgos.nivel) +
      '</table></div>';
  }

  // Score de Oportunidad Urbana: el número que resume todo el análisis.
  function bloqueOportunidad(r){
    const i = r.indicadores;
    if (!i) return '';
    const so = i.scoreOportunidad;
    const col = so.valor >= 75 ? T.ok : so.valor >= 60 ? T.acento : so.valor >= 45 ? T.warn : T.bad;
    const est = estrellasDeScore(so.valor);
    const opos = (i.oportunidades.lista || []).slice(0, 3);
    return '<div class="bloque"><h2>Oportunidad urbana <em>· qué tan buen sitio es, sin importar qué se construya</em></h2>' +
      '<div class="hero">' + gaugeSVG(so.valor, col) +
      '<div class="hero-est">' + estrellasHTML(est) + '</div>' +
      '<div class="hero-info"><b>' + so.valor + '<small>/100</small></b>' +
      '<span class="nivel" style="background:' + col + '">Oportunidad ' + esc(so.nivel) + '</span></div></div>' +
      (opos.length ? '<table class="tbl-mini">' + opos.map(o =>
        '<tr><td class="pos">+' + o.potencial + '</td><td>' + esc(o.nombre) + '</td>' +
        '<td class="razon">hoy hay ' + o.existentes + '</td></tr>').join('') + '</table>' : '') +
      '</div>';
  }

  // Comparativa multi-radio (Fase 3): cómo cambia el entorno según qué tan
  // lejos se mire. Responde la pregunta de si el lote está en el núcleo de
  // actividad o en su borde.
  function bloqueMultiRadio(r){
    const m = r.multiRadio;
    if (!m || !m.anillos || m.anillos.length < 2) return '';
    const etq = v => v >= 1000 ? (v / 1000) + ' km' : v + ' m';
    const filas = m.anillos.map(a =>
      '<tr' + (a.esAnalizado ? ' class="fila-act"' : '') + '><td class="ind-n">' + etq(a.radioM) +
      (a.esAnalizado ? ' •' : '') + '</td>' +
      '<td>' + a.total + '</td><td>' + a.densidadPorHa + '</td>' +
      '<td>' + a.comercio + '</td><td>' + a.equipamientos + '</td>' +
      '<td>' + a.poblacionEstimada.toLocaleString('es-CO') + '</td></tr>').join('');
    return '<div class="bloque"><h2>El entorno según la distancia <em>· mismo dato, varios radios</em></h2>' +
      '<table class="tbl-radios"><tr class="cab"><th>Radio</th><th>Usos</th><th>Usos/ha</th>' +
      '<th>Comercio</th><th>Equipam.</th><th>Hab. est.</th></tr>' + filas + '</table>' +
      '<p class="radio-lectura">' + esc(m.lectura) + '</p></div>';
  }

  function bloqueRecomendaciones(r){
    if (!r.recomendaciones || !r.recomendaciones.length) return '';
    return '<div class="bloque"><h2>Recomendaciones</h2><ul class="recos">' +
      r.recomendaciones.slice(0, 4).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
  }

  // ── A) INFORME EJECUTIVO — una sola hoja ────────────────────────────────
  function construirHTMLEjecutivo(r, chartsPNG, opciones){
    chartsPNG = chartsPNG || {};
    opciones = opciones || {};
    // El estilo se fija ANTES de armar nada: tanto el CSS como los bloques
    // leen `T`, y se evalúan en orden dentro del mismo arreglo de plantilla.
    fijarEstilo(opciones.estilo);
    const titulo = opciones.titulo || r.meta.proyectoNombre || 'Análisis de Implantación';
    const subtitulo = opciones.subtitulo || r.meta.direccionAprox || '';
    const horizontal = opciones.orientacion !== 'vertical';
    const autor = opciones.autor || '';
    const ubicacionTxt = (opciones.ubicacion && opciones.ubicacion.texto) || '';
    const fecha = new Date(r.meta.fechaISO).toLocaleString('es-CO', { dateStyle:'long', timeStyle:'short' });

    const anchoMM = horizontal ? 263 : 200, altoMM = horizontal ? 200 : 263;
    const chart = (src, t) => src ? '<div class="chart"><h3>' + t + '</h3><img src="' + src + '"></div>' : '';

    return [
// El <base> es imprescindible: el informe se abre en una ventana nueva con
// document.write, cuya URL es about:blank, así que sin esto las rutas
// relativas (el logo) no resuelven y el recuadro sale vacío.
'<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><base href="', location.href, '">',
'<title>', esc(titulo), ' · URBIS</title><style>',
'@page{size:letter ', (horizontal ? 'landscape' : 'portrait'), ';margin:8mm}',
'*{box-sizing:border-box;margin:0;padding:0}',
'body{font-family:"Segoe UI",Arial,sans-serif;color:', T.tinta, ';background:', T.hoja, ';',
'-webkit-print-color-adjust:exact;print-color-adjust:exact}',
'#marco{transform-origin:top left}',
'#hoja{width:', anchoMM, 'mm;height:', altoMM, 'mm;overflow:hidden;position:relative;background:', T.hoja, '}',
'#contenido{transform-origin:top left;width:100%}',
// En pantalla (previsualización) la hoja se muestra completa sobre un
// fondo gris, como un visor de PDF; al imprimir vuelve a tamaño real.
'@media screen{body{background:#4b5563;padding:8px}#hoja{box-shadow:0 6px 26px rgba(0,0,0,.45)}}',
'@media print{body{background:', T.hoja, ';padding:0}#marco{transform:none !important;margin:0 !important}#hoja{box-shadow:none}}',
/* Encabezado */
'header{display:flex;align-items:center;gap:10px;background:linear-gradient(100deg,', T.cab1, ',', T.cab2, ');',
'color:', T.cabTxt, ';padding:7px 12px;border-radius:6px}',
// El logo va siempre sobre blanco: es un PNG con fondo claro y sobre el
// encabezado oscuro del estilo premium se perdería.
'header .logo{width:28px;height:28px;object-fit:contain;border-radius:6px;background:#fff;flex:0 0 auto;padding:1px}',
'header h1{font-size:15px;font-weight:800;letter-spacing:.4px;line-height:1.1}',
'header p{font-size:8.5px;color:', T.oro, ';font-weight:700;letter-spacing:1.2px;text-transform:uppercase}',
'header .head-ubi{display:inline-block;margin-top:2px;font-size:8px;color:', T.cabTxt, ';font-weight:600;',
'background:rgba(255,255,255,.16);border-radius:99px;padding:1.5px 8px}',
'header .sub{margin-left:auto;text-align:right;font-size:8px;color:', T.cabTxt, ';opacity:.9;line-height:1.35}',
/* Rejilla principal */
'.fila{display:grid;gap:5px;margin-top:5px}',
// Cada columna es un flex vertical y su ÚLTIMO bloque crece. Sin esto, la
// columna corta termina antes que la larga y queda un hueco blanco visible
// al pie de la hoja; así el marco celeste llega siempre hasta abajo.
'.fila>div{display:flex;flex-direction:column;gap:4px;min-width:0}',
// El sobrante se reparte entre TODOS los bloques de la columna. Cargárselo
// solo al último dejaba un marco enorme medio vacío (el hueco que se veía en
// el PDF): el problema nunca estuvo entre los bloques, sino dentro de uno.
'.fila>div>*{flex:1 1 auto}',
// Y para que ese alto de más se use de verdad y no vuelva a ser vacío: la
// tabla del bloque estira sus filas, y las imágenes se centran.
'.bloque{display:flex;flex-direction:column}',
'.bloque>table{flex:1 1 auto}',
'.bloque>table td,.bloque>table th{vertical-align:middle}',
'.bloque>img{margin-top:auto;margin-bottom:auto}',
// Las listas y la rejilla de KPIs no estiran solas: se les reparte el aire
// entre renglones en vez de acumularlo al final del marco.
'.bloque>ul{flex:1 1 auto;display:flex;flex-direction:column;justify-content:space-around}',
'.bloque>.kpis{flex:1 1 auto;align-items:stretch}',
'.mapa-wrap{flex:0 0 auto}',
// En vertical la fila-2 tiene 3 columnas en una rejilla de 2: la tercera
// quedaría sola dejando media hoja en blanco, así que ocupa el ancho
// completo con sus dos bloques uno al lado del otro.
(horizontal ? '' : '.fila-2>div:nth-child(3){grid-column:1/-1;flex-direction:row}' +
               '.fila-2>div:nth-child(3)>*{flex:1 1 0}'),
'.fila-1{grid-template-columns:', (horizontal ? '27% 37% 1fr' : '30% 38% 1fr'), '}',
'.fila-2{grid-template-columns:repeat(', (horizontal ? '3' : '2'), ',1fr)}',
'.fila-foda{grid-template-columns:1fr}',
'.fila-3{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}',
/* Bloques */
'.bloque{border:1px solid ', T.borde, ';border-radius:6px;padding:6px 8px;background:', T.panel, ';break-inside:avoid}',
'.bloque h2{font-size:8.5px;text-transform:uppercase;letter-spacing:.7px;color:', T.acento, ';',
'font-weight:800;padding-bottom:3px;margin-bottom:5px;border-bottom:1.5px solid ', T.oro, '}',
'.bloque h2 em{font-style:normal;font-weight:600;color:', T.txt3, ';text-transform:none;letter-spacing:0}',
/* Mapa */
'.mapa-wrap{position:relative;width:100%;aspect-ratio:4/3;border-radius:6px;overflow:hidden;background:#dde3e8;border:1px solid #cfd8e0}',
'.mapa-img{width:100%;height:100%;object-fit:cover;display:block}',
'.mapa-vacio{background:repeating-linear-gradient(45deg,#e8edf1,#e8edf1 8px,#dfe6ec 8px,#dfe6ec 16px)}',
'.mapa-radio{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border:2px dashed rgba(255,255,255,.95);',
'border-radius:50%;box-shadow:0 0 0 9999px rgba(10,25,20,.16) inset}',
'.mapa-wrap .pt{position:absolute;width:5px;height:5px;border-radius:50%;transform:translate(-50%,-50%);',
'box-shadow:0 0 0 .8px rgba(255,255,255,.9)}',
'.mapa-pin{position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);display:flex;align-items:center;gap:4px}',
'.mapa-pin span{width:13px;height:13px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#fff;',
'border:2.5px solid ', T.cab1, ';box-shadow:0 1px 3px rgba(0,0,0,.4)}',
'.mapa-pin b{background:', T.cab1, ';color:', T.cabTxt, ';font-size:7.6px;padding:2px 5px;border-radius:3px;letter-spacing:.5px}',
'.mapa-tag{position:absolute;top:6px;left:6px;background:', T.cab1, ';color:', T.cabTxt, ';font-size:7.6px;',
'font-weight:800;letter-spacing:.8px;padding:3px 7px;border-radius:4px}',
// La escala va sobre la foto del mapa, que siempre es clara: se deja en
// blanco con texto oscuro incluso en el estilo premium.
'.mapa-escala{position:absolute;bottom:6px;left:6px;background:rgba(255,255,255,.94);color:#12202e;',
'font-size:7px;padding:3px 7px;border-radius:4px;border:1px solid #cfd8e0}',
'.mapa-escala b{color:', T.cab1, '}',
/* Datos generales */
'.datos-generales{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px}',
'.dg{display:flex;gap:5px;align-items:flex-start}',
'.dg span{font-size:9px;line-height:1.2}',
'.dg b{display:block;font-size:7.8px;color:', T.txt2, ';font-weight:700;text-transform:uppercase;letter-spacing:.3px}',
'.dg p{font-size:8px;font-weight:600;line-height:1.25}',
/* KPIs */
'.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:6px}',
'.kpi{border:1px solid ', T.borde, ';border-radius:5px;padding:4px 2px;text-align:center;background:', T.suave, '}',
'.kpi span{font-size:10px;display:block;line-height:1}',
'.kpi b{display:block;font-size:11px;color:', T.acento, ';font-weight:800;line-height:1.2}',
'.kpi small{font-size:7px;color:', T.txt2, ';line-height:1.15;display:block}',
/* Tablas */
'table{width:100%;border-collapse:collapse;font-size:8.2px}',
'th{background:', T.cab1, ';color:', T.cabTxt, ';font-size:7.6px;text-transform:uppercase;letter-spacing:.4px;',
'padding:3px 4px;text-align:left;font-weight:700}',
'td{padding:2.4px 4px;border-bottom:1px solid ', T.linea, ';line-height:1.25}',
'tfoot td{background:', T.suave2, ';font-weight:800;border-top:1.5px solid ', T.cab1, '}',
'.num{text-align:right;font-variant-numeric:tabular-nums}',
'.dot{display:inline-block;width:5px;height:5px;border-radius:50%;margin-right:4px;vertical-align:middle}',
'.barra{width:26%}.barra i{display:block;height:5px;border-radius:3px}',
'.tbl-mini td{font-size:7px;padding:2px 3px}',
'.tbl-mini .pos{font-weight:800;color:', T.oro, ';width:16px}',
'.tbl-mini .razon{color:', T.txt2, ';font-size:7.4px}',
'.estrellas{color:', T.oro, ';letter-spacing:.6px;white-space:nowrap;width:44px}',
/* Gráficas */
'.chart h3{font-size:7px;color:', T.txt2, ';text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;font-weight:700}',
'.chart img{width:100%;display:block;border-radius:4px}',
/* Viabilidad */
/* Movilidad / exposición vial */
'.expo{display:flex;gap:9px;align-items:center;margin-bottom:5px}',
'.expo-num{font-size:20px;font-weight:900;line-height:1;flex:0 0 auto}',
'.expo-num small{font-size:8px;color:', T.txt3, ';font-weight:700}',
'.expo-info{display:flex;flex-direction:column;gap:3px}',
'.expo-info b{align-self:flex-start;color:#fff;font-size:7.2px;font-weight:800;border-radius:99px;padding:2.5px 8px;letter-spacing:.4px}',
'.expo-info span{font-size:7.4px;color:', T.txt2, '}',
/* Indicadores urbanos */
'.tbl-ind td{padding:2.2px 3px;border:none;font-size:7.4px}',
'.tbl-ind .ind-n{white-space:nowrap;color:', T.txt2, '}',
'.tbl-ind .barra{width:32%}',
'.tbl-ind .ind-v{text-align:right;font-weight:800;font-size:7px;white-space:nowrap}',
'.hero-info b small{font-size:8px;color:', T.txt3, ';font-weight:700}',
/* Comparativa multi-radio */
'.tbl-radios{width:100%;border-collapse:collapse}',
'.tbl-radios td,.tbl-radios th{padding:2px 3px;border:none;font-size:7.2px;text-align:right}',
'.tbl-radios .ind-n{text-align:left;white-space:nowrap;color:', T.txt2, ';font-weight:700}',
'.tbl-radios .cab th{background:none;color:', T.txt3, ';font-weight:700;font-size:6.8px;text-transform:uppercase;',
'letter-spacing:.3px;border-bottom:1px solid ', T.borde, '}',
'.tbl-radios .fila-act td{background:', T.suave, ';font-weight:800;color:', T.acento, '}',
'.radio-lectura{font-size:7.2px;color:', T.txt2, ';line-height:1.4;margin-top:4px}',
'.tbl-vias td{padding:1.8px 3px;border:none;font-size:7.4px}',
'.tbl-vias .via-n{white-space:nowrap;max-width:96px;overflow:hidden;text-overflow:ellipsis}',
'.tbl-vias .via-n em{font-style:normal;color:', T.txt3, ';font-size:7.4px;margin-left:4px;text-transform:capitalize}',
'.tbl-vias .barra{width:40%}',
'.expo-arg{font-size:7.2px;color:', T.txt2, ';line-height:1.4;margin-top:3px}',
'.hero{display:flex;gap:9px;align-items:center;background:linear-gradient(100deg,', T.heroA, ',', T.heroB, ');',
'border:1px solid ', T.borde, ';border-radius:6px;padding:6px 9px;margin-bottom:5px}',
'.hero-est{font-size:21px;line-height:1;color:', T.oro, ';letter-spacing:1.5px;white-space:nowrap;',
'text-shadow:0 1px 0 rgba(0,0,0,.06)}',
'.hero-info{display:flex;flex-direction:column;gap:2px}',
/* Aro de viabilidad: el círculo con el puntaje, junto a las estrellas */
'.gauge{width:42px;height:42px;flex:0 0 auto;display:block}',
'.gauge-n{font-size:13px;font-weight:800;letter-spacing:-.5px}',
'.gauge-s{font-size:4.6px;fill:', T.txt3, ';font-weight:700;letter-spacing:.2px}',
'.hero-info b{font-size:12px;font-weight:900;color:', T.acento, ';line-height:1}',
'.hero-info .nivel{align-self:flex-start;color:#fff;font-size:7.6px;font-weight:800;border-radius:99px;padding:2px 7px;letter-spacing:.5px}',
'.hero-info em{font-style:normal;font-size:7.6px;color:', T.txt2, '}',
'.hero-compat{display:flex;align-items:center;gap:6px;margin-bottom:5px;font-size:8px;color:', T.txt2, '}',
'.hero-compat span{flex:1}',
'.hero-compat b{color:', T.oro, ';font-size:11px;letter-spacing:1px;line-height:1}',
'.hero-compat em{font-style:normal;font-weight:800;color:', T.acento, '}',
'.nivel{display:inline-block}',
'.args{list-style:none;font-size:8px;color:', T.txt2, ';line-height:1.35}',
'.args li{padding-left:7px;position:relative;margin-bottom:1.5px}',
'.args li:before{content:"";position:absolute;left:0;top:4px;width:3px;height:3px;border-radius:50%;background:', T.oro, '}',
/* FODA */
'.foda-grid4{display:grid;grid-template-columns:repeat(', (horizontal ? '4' : '2'), ',1fr);gap:5px}',
'.foda{border:1px solid;border-radius:5px;padding:4px 6px}',
'.foda h3{font-size:7px;margin-bottom:2px;font-weight:800}',
'.foda ul{list-style:none;font-size:7.4px;line-height:1.3;color:', T.txt2, '}',
'.foda li{padding-left:6px;position:relative;margin-bottom:1px}',
'.foda li:before{content:"·";position:absolute;left:1px;font-weight:900}',
'.foda .vacio{color:', T.txt3, ';font-style:italic}',
'.foda.f{border-color:', T.fodaF[0], ';background:', T.fodaF[1], '}.foda.f h3{color:', T.ok, '}',
'.foda.d{border-color:', T.fodaD[0], ';background:', T.fodaD[1], '}.foda.d h3{color:', T.bad, '}',
'.foda.o{border-color:', T.fodaO[0], ';background:', T.fodaO[1], '}.foda.o h3{color:', T.info, '}',
'.foda.r{border-color:', T.fodaR[0], ';background:', T.fodaR[1], '}.foda.r h3{color:', T.warn, '}',
'.recos{list-style:none;font-size:8px;line-height:1.35;color:', T.txt2, '}',
'.recos li{padding-left:8px;position:relative;margin-bottom:2px}',
'.recos li:before{content:"▸";position:absolute;left:0;color:', T.oro, ';font-weight:900}',
/* Conclusión + pie */
'.conclusion{margin-top:6px;background:', T.suave, ';border-left:2.5px solid ', T.acento, ';border-radius:4px;',
'padding:5px 8px;font-size:8px;line-height:1.4;color:', T.txt2, '}',
'footer{margin-top:5px;border-top:1px solid ', T.borde, ';padding-top:4px;font-size:7px;color:', T.txt3, ';',
'display:flex;justify-content:space-between;gap:10px}',
'</style></head><body><div id="marco"><div id="hoja"><div id="contenido">',

'<header>',
'<img class="logo" src="assets/brand/urbis-logo.png" onerror="this.style.display=\'none\'">',
'<div class="head-txt"><h1>', esc(titulo), '</h1>',
'<p>Análisis del entorno · URBIS</p>',
(ubicacionTxt ? '<span class="head-ubi">📍 ' + esc(ubicacionTxt) + '</span>' : ''), '</div>',
'<div class="sub">', (subtitulo ? esc(subtitulo) + '<br>' : ''), esc(fecha), '</div>',
'</header>',

// Tres columnas en horizontal: la hoja carta apaisada es muy ancha, y
// repartir el contenido a lo ancho baja la altura total, lo que permite
// que el auto-ajuste NO tenga que encoger la letra para que quepa.
'<div class="fila fila-1">',
  '<div>', bloqueMapa(r, horizontal), bloqueMovilidad(r), '</div>',
  '<div><div class="bloque"><h2>Datos generales</h2>', datosGenerales(r), kpis(r), '</div>',
  tablaComposicion(r), '</div>',
  '<div>', bloqueViabilidad(r) || bloqueRanking(r), bloqueOportunidad(r), '</div>',
'</div>',

'<div class="fila fila-2">',
  '<div><div class="bloque">', chart(chartsPNG.barras, 'Usos por grupo'), '</div>',
  '<div class="bloque">', chart(chartsPNG.donut, 'Uso predominante'), '</div></div>',
  '<div>', bloqueIndicadores(r), bloqueMultiRadio(r), bloqueCompatibilidad(r), '</div>',
  '<div>', bloqueRecomendaciones(r), bloqueUnidades(r), '</div>',
'</div>',

'<div class="fila fila-foda">', bloqueFoda(r), '</div>',

'<div class="conclusion">', esc(r.conclusion), '</div>',

'<footer><span>Estimación heurística sobre datos abiertos © OpenStreetMap contributors. No sustituye el concepto de norma urbanística (POT) ni un estudio de mercado formal.</span>',
'<span class="pie-urbis">', (autor ? esc(autor) + ' · ' : ''),
'<b>URBIS</b> · Análisis de Implantación IA &nbsp;·&nbsp; @urbis_co &nbsp;·&nbsp; urbisprocity@gmail.com</span></footer>',

'</div></div></div>',
// Auto-diagramación: ajusta el contenido para LLENAR exactamente una hoja
// (lo encoge si sobra y lo agranda si falta, así no quedan espacios en
// blanco), y en pantalla encaja la hoja completa en el ancho disponible.
'<script>(function(){',
'function ajustarHoja(){var h=document.getElementById("hoja"),c=document.getElementById("contenido");',
'if(!h||!c)return;var disp=h.clientHeight,k=1;',
'for(var i=0;i<18;i++){c.style.width=(100/k)+"%";c.style.transform="scale("+k+")";',
'var vis=c.scrollHeight*k;if(!vis)break;var nk=k*(disp/vis);',
'if(nk>1.5)nk=1.5;if(nk<0.35)nk=0.35;if(Math.abs(nk-k)<0.003){k=nk;break;}k=nk;}',
'c.style.width=(100/k)+"%";c.style.transform="scale("+k+")";',
'for(var g=0;g<10&&c.scrollHeight*k>disp;g++){k*=0.985;c.style.width=(100/k)+"%";c.style.transform="scale("+k+")";}}',
'function ajustarPantalla(){var m=document.getElementById("marco"),h=document.getElementById("hoja");',
'if(!m||!h)return;m.style.transform="none";m.style.marginLeft="0px";',
'var esc=Math.min(1,(window.innerWidth-16)/h.offsetWidth);',
'm.style.transform="scale("+esc+")";',
'm.style.marginLeft=Math.max(0,(window.innerWidth-16-h.offsetWidth*esc)/2)+"px";',
'document.body.style.height=(h.offsetHeight*esc+16)+"px";}',
'function todo(){ajustarHoja();ajustarPantalla();}',
'window.addEventListener("load",function(){todo();setTimeout(todo,350);});',
'window.addEventListener("resize",ajustarPantalla);',
'window.addEventListener("beforeprint",function(){var m=document.getElementById("marco");',
'if(m){m.style.transform="none";m.style.marginLeft="0px";}document.body.style.height="";ajustarHoja();});',
'window.addEventListener("afterprint",ajustarPantalla);setTimeout(todo,120);})();<\/script>',
'</body></html>'
    ].join('');
  }

  // ── B) LISTADO COMPLETO DE PUNTOS — documento de trabajo ────────────────
  function construirHTMLListado(r, opciones){
    opciones = opciones || {};
    const G = window.AIA_MOTOR.GRUPOS, C = window.AIA_MOTOR.GRUPO_COLOR;
    const titulo = opciones.titulo || r.meta.proyectoNombre || 'Análisis de Implantación';
    const fecha = new Date(r.meta.fechaISO).toLocaleString('es-CO', { dateStyle:'long', timeStyle:'short' });
    const radioTxt = r.meta.radioM >= 1000 ? (r.meta.radioM / 1000) + ' km' : r.meta.radioM + ' m';

    // Agrupar por categoría de la Matriz (dentro de cada grupo, por cercanía).
    const porGrupo = {};
    (r.pois || []).forEach(p => { (porGrupo[p.grupo] = porGrupo[p.grupo] || []).push(p); });
    Object.keys(porGrupo).forEach(g => porGrupo[g].sort((a, b) => a.distM - b.distM));

    const sinClasificar = porGrupo.otro || [];
    const gruposOrdenados = Object.keys(porGrupo).filter(g => g !== 'otro')
      .sort((a, b) => porGrupo[b].length - porGrupo[a].length);

    const seccion = (g) => {
      const lista = porGrupo[g];
      return '<section><h2 style="border-left-color:' + C[g] + '">' + G[g].i + ' ' + esc(G[g].t) +
        ' <em>(' + lista.length + ' punto' + (lista.length === 1 ? '' : 's') + ')</em></h2>' +
        '<table><thead><tr><th style="width:34px">#</th><th>Punto</th><th>Tipo de uso</th><th class="num" style="width:60px">Distancia</th></tr></thead><tbody>' +
        lista.map((p, i) => '<tr><td class="idx">' + (i + 1) + '</td><td>' + p.icono + ' ' + esc(p.nombre) + '</td>' +
          '<td class="sub">' + esc(p.sub.replace(/_/g, ' ')) + '</td><td class="num">' + p.distM + ' m</td></tr>').join('') +
        '</tbody></table></section>';
    };

    const bloqueSinClasificar = sinClasificar.length ? (
      '<section class="pendiente"><h2>❓ Usos sin clasificar <em>(' + sinClasificar.length + ')</em></h2>' +
      '<p class="nota">Estos puntos no calzaron con ninguna categoría de la Matriz de Usos. Se incluyen sus etiquetas de OpenStreetMap para poder identificarlos y asignarles categoría.</p>' +
      '<table><thead><tr><th style="width:34px">#</th><th>Punto</th><th>Etiquetas OpenStreetMap</th><th class="num" style="width:60px">Distancia</th></tr></thead><tbody>' +
      sinClasificar.map((p, i) => {
        const t = p.tags || {};
        const pares = Object.keys(t).filter(k => !/^(name|addr:|name:|source|check_date|wikidata|wikipedia)/.test(k))
          .map(k => k + '=' + t[k]).join(' · ') || '(sin etiquetas útiles)';
        return '<tr><td class="idx">' + (i + 1) + '</td><td>' + esc(p.nombre) + '</td>' +
          '<td class="tags">' + esc(pares) + '</td><td class="num">' + p.distM + ' m</td></tr>';
      }).join('') + '</tbody></table></section>'
    ) : '<section class="ok"><h2>✅ Sin usos pendientes</h2><p class="nota">Todos los puntos del radio quedaron clasificados dentro de la Matriz de Usos.</p></section>';

    return [
'<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><base href="', location.href, '">',
'<title>Listado de puntos · ', esc(titulo), '</title><style>',
'@page{size:letter portrait;margin:14mm}',
'*{box-sizing:border-box;margin:0;padding:0}',
'body{font-family:"Segoe UI",Arial,sans-serif;color:', TINTA, ';font-size:9px;',
'-webkit-print-color-adjust:exact;print-color-adjust:exact}',
'header{display:flex;align-items:center;gap:10px;background:', VERDE, ';color:#fff;padding:10px 14px;border-radius:6px;margin-bottom:10px}',
'header img{width:32px;height:32px;object-fit:contain;border-radius:7px;background:#fff;flex:0 0 auto}',
'header h1{font-size:15px;font-weight:800}',
'header p{font-size:8px;color:', ORO, ';text-transform:uppercase;letter-spacing:1px;font-weight:700}',
'header .meta{margin-left:auto;text-align:right;font-size:7.5px;color:rgba(255,255,255,.85);line-height:1.4}',
'.resumen{background:#f0f9fe;border:1px solid #c7e7f7;border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:8.5px;line-height:1.5}',
'.resumen b{color:', VERDE_CLARO, '}',
'section{margin-bottom:14px;break-inside:auto}',
'h2{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:', VERDE, ';font-weight:800;',
'border-left:4px solid ', VERDE_CLARO, ';padding:3px 0 3px 8px;margin-bottom:5px;break-after:avoid}',
'h2 em{font-style:normal;color:#7d8b9a;font-weight:600;text-transform:none;letter-spacing:0}',
'table{width:100%;border-collapse:collapse;font-size:8px}',
'thead{display:table-header-group}',
'th{background:#e8f5fd;color:', VERDE, ';text-align:left;padding:4px 6px;font-size:7.5px;',
'text-transform:uppercase;letter-spacing:.4px;border-bottom:1.5px solid ', VERDE_CLARO, '}',
'td{padding:3px 6px;border-bottom:1px solid #e9f4fb;line-height:1.3}',
'tr{break-inside:avoid}',
'.num{text-align:right;font-variant-numeric:tabular-nums;color:#5a6a7a}',
'.idx{color:#9aa7b4;font-variant-numeric:tabular-nums}',
'.sub{color:#6b7a8a;text-transform:capitalize}',
'.tags{color:#6b7a8a;font-family:Consolas,monospace;font-size:7px;word-break:break-word}',
'.pendiente h2{border-left-color:#FF00AA;color:#a1006b}',
'.pendiente{background:#fff5fb;border:1px solid #f6c8e4;border-radius:6px;padding:8px 10px}',
'.ok h2{border-left-color:#15803d;color:#15803d}',
'.nota{font-size:7.5px;color:#6b7a8a;margin-bottom:6px;line-height:1.4}',
'footer{margin-top:14px;border-top:1px solid #cfe6f5;padding-top:6px;font-size:7px;color:#8a97a5}',
'</style></head><body>',
'<header><img src="assets/brand/urbis-logo.png" onerror="this.style.display=\'none\'">',
'<div><h1>Listado completo de puntos</h1><p>Documento de trabajo · URBIS</p></div>',
'<div class="meta">', esc(titulo), '<br>', esc(fecha), '</div></header>',
'<div class="resumen"><b>Ubicación:</b> ', r.meta.lat.toFixed(6), ', ', r.meta.lng.toFixed(6),
' &nbsp;·&nbsp; <b>Radio:</b> ', radioTxt, ' (~', r.stats.areaHa, ' ha)',
' &nbsp;·&nbsp; <b>Total de puntos:</b> ', r.stats.total.toLocaleString('es-CO'),
' &nbsp;·&nbsp; <b>Sin clasificar:</b> ', sinClasificar.length, '</div>',
bloqueSinClasificar,
gruposOrdenados.map(seccion).join(''),
'<footer>Datos abiertos © OpenStreetMap contributors · Clasificación según la Matriz de Usos de URBIS · Generado el ', esc(fecha), '</footer>',
'</body></html>'
    ].join('');
  }

  // ── Salida ──────────────────────────────────────────────────────────────
  function abrirVentanaImpresion(html){
    const w = window.open('', '_blank');
    if (!w) { alert('Permite ventanas emergentes para exportar el PDF.'); return false; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch(e) {} }, 600);
    return true;
  }

  function generar(r, chartsPNG, opciones){
    abrirVentanaImpresion(construirHTMLEjecutivo(r, chartsPNG, opciones));
  }

  window.AIA_INFORME = {
    generar, abrirVentanaImpresion,
    construirHTMLEjecutivo, construirHTMLListado,
    // Alias de compatibilidad (js/62 llamaba construirHTML).
    construirHTML: construirHTMLEjecutivo,
    // Estilos del informe (Fase 4): la app los lee para pintar el selector y
    // para generar las gráficas con los colores del estilo elegido.
    ESTILOS
  };
})();
