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

  // Hitos peatonales sobre el mapa: los establecimientos que de verdad mueven
  // gente a pie, señalados con su nombre. Se reparten las etiquetas a los lados
  // según de qué lado del lote caiga cada uno, para que no se pisen con el
  // marcador del centro.
  function hitosSobreMapa(r, mpp, w, h){
    const f = r.stats.movilidad && r.stats.movilidad.flujo;
    if (!f || !f.hitos || !f.hitos.length) return '';
    const lat0 = r.meta.lat, lng0 = r.meta.lng, mx = w / 2, my = h / 2;
    const puestas = [];   // etiquetas ya colocadas, para no encimarlas
    let html = '';
    // El gimnasio se coloca primero: como el sitio del mapa es limitado, el que
    // se ubica antes es el que sobrevive, y este es el hito que más cambia el
    // tránsito de la acera. Los demás se reparten el espacio que quede.
    const orden = f.hitos.filter(h2 => h2.sub === 'gimnasio')
                    .concat(f.hitos.filter(h2 => h2.sub !== 'gimnasio'));
    orden.forEach(function (hi) {
      if (puestas.length >= 4) return;
      const dx = (hi.lng - lng0) * 111320 * Math.cos(lat0 * Math.PI / 180) / mpp;
      const dy = -(hi.lat - lat0) * 110540 / mpp;
      if (Math.abs(dx) > mx - 10 || Math.abs(dy) > my - 10) return;
      const x = (mx + dx) / w * 100, y = (my + dy) / h * 100;
      // Nombre recortado: en el mapa manda que se lea, y el nombre completo
      // queda igual en la lista de hitos del bloque de flujo.
      const etq = hi.nombre.length > 18 ? hi.nombre.slice(0, 17).trim() + '…' : hi.nombre;
      // Ancho aproximado del rótulo como % del recuadro. Medido sobre el
      // informe ya maquetado: con letra de 6,4 px son ~3,5 px por carácter más
      // ~27 px fijos de relleno y borde; se redondea hacia arriba y se cuentan
      // TAMBIÉN los caracteres de la distancia, que van dentro del mismo
      // rótulo. El recuadro del mapa mide ~266 px de ancho en esta maqueta.
      const nChars = etq.length + String(hi.distM).length + 2;
      const anchoPct = (nChars * 3.6 + 34) / 266 * 100;
      // Sale HACIA AFUERA, alejándose del centro: hacia adentro se amontonaban
      // unas sobre otras y encima del rótulo del lote. Si por fuera no cabe,
      // se voltea; si no cabe por ninguno de los dos lados, se descarta.
      // Se prueba primero hacia afuera —alejándose del centro, que es donde hay
      // sitio— y si ahí no cabe o choca, hacia adentro. Comparar rectángulos
      // completos, y no solo alturas, deja pasar bastantes más rótulos sin que
      // ninguno quede encima de otro.
      // Medidas reales sobre la maqueta: el rótulo mide ~12 px de alto (7% del
      // recuadro) y el letrero PROYECTO sale a la derecha de la cruz, no
      // centrado en ella. Reservar de más dejaba fuera hitos que sí cabían.
      const ALTO = 7;
      const BADGE = { x0: 48, x1: 74, y0: 46.5, y1: 54.5 };
      const rectDe = l => l === 'der'
        ? { x0: x + 2, x1: x + 2 + anchoPct, y0: y - ALTO / 2, y1: y + ALTO / 2 }
        : { x0: x - 2 - anchoPct, x1: x - 2, y0: y - ALTO / 2, y1: y + ALTO / 2 };
      const solapa = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
      const sirve = rc => rc.x0 >= 1 && rc.x1 <= 99 &&
                          !solapa(rc, BADGE) && !puestas.some(p => solapa(rc, p));

      const fuera = dx >= 0 ? 'der' : 'izq';
      const dentro = fuera === 'der' ? 'izq' : 'der';
      let lado = null, rc = rectDe(fuera);
      if (sirve(rc)) lado = fuera;
      else { rc = rectDe(dentro); if (sirve(rc)) lado = dentro; }
      if (!lado) return;   // no cabe en ningún lado: mejor no dibujarlo

      puestas.push(rc);
      html += '<div class="hito ' + lado + '" style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%">' +
        '<i></i><b>' + esc(etq) + '<em>' + hi.distM + ' m</em></b></div>';
    });
    return html;
  }

  // ── Mapas de calor ──────────────────────────────────────────────────────
  //
  // El flujo es un número para todo el radio, y eso promedia lo que más
  // importa: pegado al gimnasio pasa gente que 300 m más allá no pasa. Estas
  // tres capas reparten el MISMO cálculo sobre la malla del motor y lo pintan
  // encima del mapa, para poder señalar la esquina en vez de describirla.
  //
  // Se dibuja en un lienzo de 26×26 —el tamaño real del dato— y se reescala
  // con suavizado. Pintar 676 divs por capa haría el PDF tres veces más
  // pesado y no añadiría ni un dato: la malla no tiene más resolución.
  const RAMPAS = {
    // A pie: de verde (poco) a rojo (mucho). Vehicular en azul-morado para
    // que las dos capas no se confundan al verlas una al lado de la otra.
    peaton:  [[0,[ 32,140, 90, 0]], [.25,[120,190, 60,110]], [.5,[245,205, 60,165]],
              [.75,[240,140, 40,200]], [1,[214, 40, 40,225]]],
    vehiculo:[[0,[ 30, 90,170, 0]], [.25,[ 70,130,220,110]], [.5,[110,110,225,165]],
              [.75,[150, 70,205,200]], [1,[120, 20,150,225]]]
  };
  function colorRampa(ramp, t){
    for (let i = 1; i < ramp.length; i++) {
      if (t <= ramp[i][0]) {
        const a = ramp[i-1], b = ramp[i];
        const k = (t - a[0]) / (b[0] - a[0] || 1);
        return [0,1,2,3].map(c => Math.round(a[1][c] + (b[1][c] - a[1][c]) * k));
      }
    }
    return ramp[ramp.length-1][1];
  }
  function pngCalor(capa, n, tipo){
    try {
      const c = document.createElement('canvas'); c.width = n; c.height = n;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(n, n);
      const ramp = RAMPAS[tipo] || RAMPAS.peaton;
      for (let k = 0; k < n * n; k++) {
        const v = capa[k], px = k * 4;
        if (v == null || v < 0) { img.data[px + 3] = 0; continue; }
        const col = colorRampa(ramp, Math.max(0, Math.min(1, v / 100)));
        img.data[px] = col[0]; img.data[px+1] = col[1]; img.data[px+2] = col[2]; img.data[px+3] = col[3];
      }
      ctx.putImageData(img, 0, 0);
      const g = document.createElement('canvas'); g.width = g.height = 260;
      const gx = g.getContext('2d');
      gx.imageSmoothingEnabled = true; gx.imageSmoothingQuality = 'high';
      gx.drawImage(c, 0, 0, 260, 260);
      return g.toDataURL('image/png');
    } catch (e) { return ''; }
  }

  function panelCalor(r, capa, foco, titulo, sub, tipo){
    const W = 400, H = 300;
    const z = calcZoom(r.meta.lat, r.meta.radioM, Math.min(W, H));
    const url = urlMapaEstatico(r.meta, W, H, z.z);
    const pctW = (z.radioPx / W * 200).toFixed(2), pctH = (z.radioPx / H * 200).toFixed(2);
    const png = pngCalor(capa, (r.stats.movilidad.flujo.mapaCalor || {}).n || 26, tipo);
    // El foco se marca sobre el mapa con la misma cuenta que usa el motor,
    // para que el punto del plano y la frase de abajo hablen del mismo sitio.
    let marcaFoco = '';
    if (foco) {
      const dx = (foco.lng - r.meta.lng) * 111320 * Math.cos(r.meta.lat * Math.PI / 180) / z.mpp;
      const dy = -(foco.lat - r.meta.lat) * 110540 / z.mpp;
      marcaFoco = '<i class="calor-foco" style="left:' + ((W/2 + dx) / W * 100).toFixed(2) +
                  '%;top:' + ((H/2 + dy) / H * 100).toFixed(2) + '%"></i>';
    }
    return '<div class="calor-panel">' +
      '<h3>' + esc(titulo) + '<em>' + esc(sub) + '</em></h3>' +
      '<div class="mapa-marco"><div class="mapa-wrap">' +
        (url ? '<img class="mapa-img" src="' + url + '" alt="' + esc(titulo) + '">'
             : '<div class="mapa-img mapa-vacio"></div>') +
        (png ? '<img class="calor-capa" src="' + png + '" style="width:' + pctW +
               '%;height:' + pctH + '%" alt="">' : '') +
        marcaFoco +
        '<div class="mapa-pin"><i class="cruz-h"></i><i class="cruz-v"></i><i class="punto"></i></div>' +
      '</div></div>' +
      '<p class="calor-foco-txt">' +
        (foco ? 'Punto más activo: <b>' + esc(foco.texto) + '</b> del lote.'
              : 'Sin actividad suficiente para señalar un punto.') + '</p>' +
      '</div>';
  }

  function bloqueMapaCalor(r){
    const f = r.stats.movilidad && r.stats.movilidad.flujo;
    const mc = f && f.mapaCalor;
    if (!mc) return '';
    const leyenda = tipo =>
      '<div class="calor-leyenda ' + tipo + '"><span>menos</span><i></i><span>más</span></div>';
    return '<div class="calor-fila">' +
        panelCalor(r, mc.peatonalDia, mc.focoDia, 'A pie · de día',
                   'mañana a tarde', 'peaton') +
        panelCalor(r, mc.peatonalNoche, mc.focoNoche, 'A pie · de noche',
                   'después de las 7 p.m.', 'peaton') +
        panelCalor(r, mc.vehicular, mc.focoVehicular, 'En vehículo',
                   'corredores y atractores', 'vehiculo') +
      '</div>' +
      '<div class="calor-pie">' + leyenda('peaton') + leyenda('vehiculo') +
        '<p class="pie-nota">' +
          'Cada capa se colorea contra su propio máximo: responde <b>dónde</b> se concentra el ' +
          'movimiento dentro del radio, no cuánto — para el cuánto están las cifras de flujo. ' +
          'El cálculo suma los usos que atraen gente y <b>resta</b> los que rompen el recorrido ' +
          '(bodegas, lotes, locales cerrados).' +
          (mc.fiable ? '' : ' Atención: con pocos puntos mapeados en el radio, este mapa es indicativo ' +
                            'y conviene contrastarlo en campo.') +
        '</p>' +
      '</div>';
  }

  // Qué atrae VEHÍCULOS, que no es lo mismo que qué atrae peatones: a una
  // ferretería o a una bodega no se llega a pie con la compra al hombro. Sin
  // esta lista, dos esquinas de la misma avenida se leían idénticas aunque
  // una tuviera un centro comercial al lado y la otra casas.
  function bloqueAtraeVehiculo(r){
    const f = r.stats.movilidad && r.stats.movilidad.flujo;
    const gen = (f && f.generadoresVehiculo || []).slice(0, 6);
    const filas = gen.length
      ? '<table class="tbl-gente"><tr><th>Uso</th><th class="n">Cant.</th><th class="n">Aporte</th></tr>' +
        gen.map(g => '<tr><td>' + esc(g.nombre) + '</td><td class="n">' + g.n +
          '</td><td class="n">' + g.aporte + '</td></tr>').join('') + '</table>'
      : '<p class="nota-pie">No se identificaron usos que atraigan viajes en vehículo en el radio.</p>';
    return '<div class="tarjeta"><h2>Qué atrae vehículos</h2>' + filas +
      '<p class="pie-nota">' + textoParqueo(f) + '</p></div>';
  }

  // De qué vive la cuadra. Contar comercios no dice nada por sí solo: 20
  // almacenes de ropa y 20 ferreterías dan el mismo número y son sectores
  // opuestos para quien va a poner un local.
  function bloqueVocacion(r){
    const c = (r.indicadores && r.indicadores.comercio) || {};
    const v = c.vocacion || {};
    const rep = (v.reparto || []).filter(x => x.n > 0).slice(0, 5);
    const maxN = rep.length ? rep[0].n : 1;
    // Clase propia y no `.hf`: comparten aspecto, pero son cosas distintas —
    // una son horas del día y la otra rubros— y mezclarlas hacía imposible
    // comprobar cualquiera de las dos por separado.
    const barras = rep.map(x =>
      '<div class="hf voc-fila"><span>' + esc(x.nombre) + '</span><div class="cl-barra"><i style="width:' +
      Math.round(100 * x.n / maxN) + '%;background:' + T.acento + '"></i></div><b>' + x.n + '</b></div>').join('');
    return '<div class="tarjeta"><h2>De qué vive la cuadra</h2>' +
      (v.nombre
        ? '<p class="voc-titulo">' + esc(v.nombre) + ' <em>· ' + v.share + '% de la oferta</em></p>' +
          '<p class="voc-lectura">' + esc(v.lectura || '') + '</p>'
        : '<p class="voc-lectura">Sin masa comercial suficiente para asignarle una vocación al sector: ' +
          'la oferta instalada es demasiado escasa o demasiado repartida.</p>') +
      barras +
      ((c.top && c.top.length)
        ? '<p class="pie-nota">Los rubros que más pesan: ' +
          c.top.map(t => t.n + ' &times; ' + esc(t.nombre.toLowerCase())).join(', ') + '.</p>'
        : '') +
      '</div>';
  }

  function bloqueMapa(r, horizontal){
    // Apaisado 4:3 en vez de cuadrado: el mapa va en su propia columna y así
    // se come bastante menos alto de la hoja, que es lo que obliga al
    // auto-ajuste a encoger la letra. El círculo de radio se dimensiona con
    // el lado menor, así que se sigue viendo completo.
    //
    // El marco exterior existe para que la rejilla pueda estirarlo sin tocar
    // la caja de adentro. Todo lo que se dibuja encima del mapa se posiciona
    // en porcentaje del recuadro, así que si el recuadro cambiara de
    // proporción, el punto analizado y los POIs caerían corridos: era
    // exactamente lo que pasaba.
    const W = 800, H = 600;
    const z = calcZoom(r.meta.lat, r.meta.radioM, Math.min(W, H));
    const url = urlMapaEstatico(r.meta, W, H, z.z);
    const pctW = (z.radioPx / W * 200).toFixed(2), pctH = (z.radioPx / H * 200).toFixed(2);
    const radioTxt = r.meta.radioM >= 1000 ? (r.meta.radioM / 1000) + ' km' : r.meta.radioM + ' m';
    return '<div class="mapa-marco"><div class="mapa-wrap">' +
      (url ? '<img class="mapa-img" src="' + url + '" alt="Mapa del entorno">' : '<div class="mapa-img mapa-vacio"></div>') +
      '<div class="mapa-radio" style="width:' + pctW + '%;height:' + pctH + '%"></div>' +
      puntosSobreMapa(r, z.mpp, W, H, 150) +
      hitosSobreMapa(r, z.mpp, W, H) +
      // Cruz + punto en el centro exacto: señala el lote sin que el rótulo
      // desplace la marca, que era el desfase que se veía en el PDF.
      '<div class="mapa-pin"><i class="cruz-h"></i><i class="cruz-v"></i>' +
        '<i class="punto"></i><b>PROYECTO</b></div>' +
      '<div class="mapa-tag">MAPA DEL ENTORNO</div>' +
      '<div class="mapa-escala">Radio · <b>' + radioTxt + '</b></div>' +
      '</div></div>';
  }

  // ── Bloques de contenido ────────────────────────────────────────────────
  function kpis(r){
    const s = r.stats;
    const item = (ico, val, lbl) => '<div class="kpi"><span>' + ico + '</span><b>' + val + '</b><small>' + lbl + '</small></div>';
    // Con censo se muestran 6 KPI (entra estrato); sin censo, los 5 de siempre.
    const e = s.estrato;
    return '<div class="kpis' + (e ? ' kpis-6' : '') + '">' +
      item('👥', s.poblacionEstimada.toLocaleString('es-CO'),
           s.poblacionEsCensal ? 'Habitantes · DANE 2018' : 'Población estimada') +
      (e ? item('🏷️', 'E' + e.predominante,
           e.minimo === e.maximo ? 'Estrato' : 'Estrato ' + e.minimo + '–' + e.maximo) : '') +
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
  // ── Flujo peatonal y vehicular ──────────────────────────────────────────
  // El bloque que pide un café: cuánta gente pasa por la puerta, cómo llega y
  // a qué hora. Se declara sin rodeos que es potencial estimado de la
  // estructura urbana, no un aforo — quien lo lea tiene que saber qué compra.
  // Tránsito vehicular y combustible: dos magnitudes que se piden mucho para
  // leer el movimiento de una esquina. Se muestran como RANGOS porque no hay
  // aforo ni datos de ventas detrás, y el pie del bloque lo declara.
  function miles(n){ return n.toLocaleString('es-CO'); }
  function bloqueTrafico(f){
    const t = f.trafico;
    if (!t) return '';
    const filas = [];
    if (t.estimable) {
      filas.push('<div class="traf-fila"><span>🚗 Carros por día</span>' +
        '<b>' + miles(t.carrosDiaMin) + '–' + miles(t.carrosDiaMax) + '</b></div>' +
        '<p class="traf-pie">Por ' + esc(t.corredor.nombre) + ', vía ' + esc(t.corredor.jerarquia) +
        ' a ' + t.corredor.distM + ' m.</p>');
    } else {
      filas.push('<div class="traf-fila"><span>🚗 Carros por día</span><b>—</b></div>' +
        '<p class="traf-pie">Sin vía arteria en el radio: no hay corredor del que estimarlo.</p>');
    }
    if (t.estaciones > 0) {
      filas.push('<div class="traf-fila"><span>⛽ Litros al mes</span>' +
        '<b>' + miles(t.litrosMesMin) + '–' + miles(t.litrosMesMax) + '</b></div>' +
        '<p class="traf-pie">' + t.estaciones +
        (t.estaciones === 1 ? ' estación' : ' estaciones') + ' de servicio en el radio.</p>');
    } else {
      filas.push('<div class="traf-fila"><span>⛽ Litros al mes</span><b>—</b></div>' +
        '<p class="traf-pie">Sin estaciones de servicio en el radio.</p>');
    }
    return '<h3 class="flujo-h3">Tránsito y combustible</h3>' +
           '<div class="traf">' + filas.join('') + '</div>';
  }

  function bloqueFlujo(r){
    const f = r.stats.movilidad && r.stats.movilidad.flujo;
    if (!f) return '';
    const col = v => v >= 70 ? T.ok : v >= 50 ? T.acento : v >= 30 ? T.warn : T.bad;
    const medidor = (etq, ico, v, nivel) =>
      '<div class="flujo-med"><div class="flujo-cab"><b>' + ico + ' ' + etq + '</b>' +
      '<span style="color:' + col(v) + '">' + v + '/100 · ' + esc(nivel) + '</span></div>' +
      '<div class="flujo-barra"><i style="width:' + v + '%;background:' + col(v) + '"></i></div></div>';

    const franja = (etq, v) =>
      '<div class="flujo-hora"><small>' + etq + '</small>' +
      '<div class="flujo-barra alta"><i style="width:' + v + '%;background:' + T.acento + '"></i></div>' +
      '<b>' + v + '</b></div>';

    const gen = (f.generadores || []).slice(0, 6);
    const tablaGen = gen.length
      ? '<table class="flujo-tabla"><tr><th>Qué trae gente a pie</th><th>Cant.</th><th>Aporte</th></tr>' +
        gen.map(g => '<tr><td>' + esc(g.nombre) +
                     // El nombre propio es lo que hace verificable el análisis:
                     // el lector puede ir a la esquina y comprobarlo.
                     ((g.ejemplos && g.ejemplos.length)
                        ? '<em class="gen-ej">' + esc(g.ejemplos.join(' · ')) + '</em>' : '') +
                     '</td><td class="n">' + g.n + '</td>' +
                     '<td class="n">' + g.aporte + '</td></tr>').join('') + '</table>'
      : '<p class="flujo-vacio">No se identificaron generadores de peatones en el radio.</p>';

    // Hitos con nombre y distancia. El gimnasio va primero cuando existe: es
    // el que más cambia una acera —entra y sale gente a horas fijas, todos los
    // días— y por eso pesa tanto en la lectura del flujo.
    const hitos = (f.hitos || []).slice();
    const gimnasios = hitos.filter(h => h.sub === 'gimnasio');
    const ordenados = gimnasios.concat(hitos.filter(h => h.sub !== 'gimnasio')).slice(0, 5);
    const bloqueHitos = ordenados.length
      ? '<div class="hitos-lista">' + ordenados.map(h =>
          '<span class="hito-chip' + (h.sub === 'gimnasio' ? ' fuerte' : '') + '">' +
          (h.icono || '📍') + ' <b>' + esc(h.nombre) + '</b><em>' + h.distM + ' m</em></span>').join('') +
        (gimnasios.length
          ? '<p class="hitos-nota"><b>' + esc(gimnasios[0].nombre) + '</b> a ' + gimnasios[0].distM +
            ' m concentra entradas y salidas a pie en horario fijo, mañana y final de la tarde: ' +
            'sube el tránsito de la acera justo en las franjas que un café de paso aprovecha.</p>'
          : '') +
        '</div>'
      : '';

    const lectura = f.dominante === 'ninguno'
      ? 'No pasa casi nadie, ni a pie ni en carro: aquí el negocio tendría que traer su propia clientela, no capturarla del flujo.'
      : f.dominante === 'peatonal'
      ? 'El entorno mueve más gente a pie que en carro: favorece formatos de paso, vitrina a la calle y estancia corta.'
      : f.dominante === 'vehicular'
        ? 'El entorno mueve más carro que peatón: sin parqueo resuelto, el flujo pasa de largo sin convertirse en cliente.'
        : 'El entorno reparte parejo entre peatón y carro: conviene resolver los dos accesos y no apostar a uno solo.';

    return '<div class="bloque ancho"><h2>Flujo peatonal y vehicular <em>· potencial estimado</em></h2>' +
      '<div class="flujo-grid">' +
        '<div>' +
          medidor('Flujo peatonal', '🚶', f.peatonal, f.nivelPeatonal) +
          medidor('Flujo vehicular', '🚗', f.vehicular, f.nivelVehicular) +
          '<p class="flujo-lectura">' + esc(lectura) + '</p>' +
          '<p class="flujo-lectura"><b>Hora fuerte: ' + esc(f.franjaFuerte) + '.</b> ' +
            (f.parqueaderos ? f.parqueaderos + ' parqueadero' + (f.parqueaderos === 1 ? '' : 's') + ' en el radio.'
                            : 'Sin parqueaderos identificados en el radio.') + '</p>' +
        '</div>' +
        '<div>' + tablaGen +
          '<div class="flujo-horas">' +
            franja('Mañana', f.franjas.manana) +
            franja('Mediodía', f.franjas.mediodia) +
            franja('Tarde', f.franjas.tarde) +
          '</div>' +
        '</div>' +
        (bloqueHitos ? '<div><h3 class="flujo-h3">Hitos que mueven la acera</h3>' + bloqueHitos +
                       bloqueTrafico(f) + '</div>' : '<div>' + bloqueTrafico(f) + '</div>') +
      '</div>' +
      (f.avisoDatos ? '<p class="flujo-aviso">⚠️ ' + esc(f.avisoDatos) + '</p>' : '') +
      '<p class="pie-nota">Potencial de flujo estimado a partir de los usos del entorno y la malla vial. No es un aforo: no hay conteo de personas ni de vehículos. Los carros por día y los litros al mes son rangos de orden de magnitud según la jerarquía de la vía y el número de estaciones — no son mediciones ni cifras de ventas. Sirve para comparar ubicaciones entre sí y para dimensionar el formato, no para proyectar ventas.</p></div>';
  }

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
    const e = i.estrato;
    // El estrato va DENTRO del bloque de indicadores, arriba y con su franja
    // dorada: es dato censal, no estimación, y conviene que se distinga.
    const franjaEstrato = (e && e.disponible)
      ? '<div class="estrato-franja"><b>🏷️ Estrato ' + e.predominante +
        (e.homogeneo ? '' : ' <em>(' + e.minimo + '–' + e.maximo + ')</em>') + '</b>' +
        '<span>Censo DANE 2018</span></div>'
      : '';
    // Sexo y edad: barra de sexo + los dos tramos que más deciden el producto.
    const d = i.demografia;
    const bloqueDemo = (d && d.disponible)
      ? '<div class="demo-mini">' +
          '<div class="demo-bar"><i style="width:' + d.pctMujeres + '%;background:#e0559b"></i>' +
            '<i style="width:' + d.pctHombres + '%;background:#2b8fd6"></i></div>' +
          '<div class="demo-leg"><span><b style="background:#e0559b"></b>' + d.pctMujeres + '% mujeres</span>' +
            '<span><b style="background:#2b8fd6"></b>' + d.pctHombres + '% hombres</span>' +
            '<span class="demo-edad">' + d.pctNinos + '% menores de 15 · ' + d.pctMayores + '% de 65 o más</span></div>' +
        '</div>'
      : '';
    return '<div class="bloque"><h2>Indicadores urbanos</h2>' + franjaEstrato + bloqueDemo +
      '<table class="tbl-ind">' +
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

  // Arma la fila descartando las columnas cuyos bloques salieron todos vacíos
  // y fijando la rejilla al número de columnas que de verdad se pintan, para
  // que las que quedan se repartan el ancho completo.
  function columnas(horizontal, grupos){
    const vivas = grupos
      .map(bloques => bloques.filter(Boolean).join(''))
      .filter(html => html.trim().length > 0);
    if (!vivas.length) return '';
    const n = Math.min(vivas.length, horizontal ? 3 : 2);
    return '<div class="fila fila-2" style="grid-template-columns:repeat(' + n + ',1fr)">' +
      vivas.map(h => '<div>' + h + '</div>').join('') + '</div>';
  }

  // ── A) INFORME EJECUTIVO — una sola hoja ────────────────────────────────
  // Veredicto de la página 1: el mismo dato de viabilidad que ya calcula el
  // motor, pero presentado en grande y explicado, para que el cliente entienda
  // qué está viendo sin que nadie se lo tenga que interpretar al lado.
  function bloqueVeredicto(r){
    const v = r.viabilidad;
    if (!v) return '';
    const col = v.nivel === 'Alta' ? T.ok : (v.nivel === 'Media' ? T.warn : T.bad);
    const est = estrellasDeScore(v.score);
    const lectura = v.nivel === 'Alta'
      ? 'El entorno reúne las condiciones para el proyecto propuesto: hay demanda que lo sostiene, ' +
        'usos complementarios alrededor y accesibilidad que respalda la operación.'
      : v.nivel === 'Media'
      ? 'El proyecto es defendible, pero su resultado dependerá de diferenciarse de la oferta ya ' +
        'instalada y de validar la demanda en campo antes de comprometer inversión.'
      : 'Las condiciones actuales del entorno no favorecen este uso en particular. Conviene revisar ' +
        'alternativas mejor calificadas o evaluar otro radio de influencia antes de descartar el lote.';
    // Aro grande: r=15.9155 hace que la circunferencia mida 100, así el
    // dasharray se escribe directamente en puntos del score.
    const gauge =
      '<svg class="gauge-xl" viewBox="0 0 42 42">' +
      '<circle cx="21" cy="21" r="15.9155" fill="none" stroke="' + T.linea + '" stroke-width="4.6"/>' +
      '<circle cx="21" cy="21" r="15.9155" fill="none" stroke="' + col + '" stroke-width="4.6" ' +
        'stroke-linecap="round" stroke-dasharray="' + v.score + ' ' + (100 - v.score) + '" ' +
        'transform="rotate(-90 21 21)"/>' +
      '<text x="21" y="20.6" text-anchor="middle" font-size="13" font-weight="900" fill="' + col + '">' + v.score + '</text>' +
      '<text x="21" y="27" text-anchor="middle" font-size="3.3" font-weight="700" fill="' + T.txt3 + '">DE 100</text>' +
      '</svg>';
    return '<div class="veredicto">' +
      '<div class="ver-h"><b>VIABILIDAD DEL PROYECTO</b>' +
        '<span>' + esc(r.meta.proyectoNombre) + '</span></div>' +
      '<div class="ver-b">' + gauge +
        '<div class="ver-txt">' +
          '<div class="estrellas-xl">' + estrellasHTML(est) + '</div>' +
          '<span class="nivel-xl" style="color:' + col + '">Viabilidad ' + esc(v.nivel) + '</span>' +
          '<span class="frase-xl">' + est + ' de 5 estrellas. ' + lectura + '</span>' +
        '</div>' +
      '</div></div>';
  }

  // Qué significa cada indicador, en una línea. Es lo que convierte la página 1
  // en algo que el cliente puede leer solo, sin que nadie se lo explique.
  function bloqueGuia(r){
    const i = r.indicadores || {};
    const filas = [
      ['⭐ Viabilidad', 'Qué tan bien encaja TU proyecto en este lote concreto.'],
      ['🏆 Oportunidad urbana', 'Qué tan buen sitio es el lote, sin importar qué se construya.'],
      ['👥 Población', r.stats.poblacionEsCensal
        ? 'Habitantes reales del área según el Censo DANE, no una estimación.'
        : 'Habitantes estimados en el área de influencia.'],
      ['🛣️ Exposición vial', 'Cuánta visibilidad y acceso da la malla vial cercana.']
    ];
    if (i.estrato && i.estrato.disponible) {
      filas.push(['🏷️ Estrato', 'Capacidad de compra del sector: define el producto y el precio.']);
    }
    if (i.demografia && i.demografia.disponible) {
      filas.push(['📊 Edad y sexo', 'Quién vive alrededor: orienta qué tipo de oferta tiene demanda.']);
    }
    return '<div class="bloque"><h2>Cómo leer este informe</h2><div class="guia">' +
      filas.map(f => '<div><b>' + f[0] + '</b><small>' + f[1] + '</small></div>').join('') +
      '</div></div>';
  }


  // ══ DIAGRAMACIÓN EN TRES HOJAS ══════════════════════════════════════════
  //
  // El informe pasó de dos hojas apretadas a tres con hilo narrativo. Cada
  // sección va numerada y con un subtítulo que dice PARA QUÉ sirve, de modo
  // que el documento se lea solo, sin que nadie tenga que interpretarlo al
  // lado del cliente. El orden es el de una conversación: primero la
  // conclusión, después los datos que la sostienen, y al final el FODA con el
  // siguiente paso.

  function seccion(n, titulo, sub){
    return '<div class="sec"><b>' + n + '. ' + esc(titulo) + '</b>' +
           (sub ? '<em>' + esc(sub) + '</em>' : '') + '</div>';
  }

  // Aro de progreso grande. Va en su propia caja de tamaño fijo: si se dejara
  // fluir, cualquier elemento vecino de ancho completo —una barra, por
  // ejemplo— le pasaba por encima.
  function aroXL(score, color, etq){
    return '<div class="aro-caja"><svg class="aro" viewBox="0 0 42 42">' +
      '<circle cx="21" cy="21" r="15.9155" fill="none" stroke="' + T.linea + '" stroke-width="4.6"/>' +
      '<circle cx="21" cy="21" r="15.9155" fill="none" stroke="' + color + '" stroke-width="4.6" ' +
        'stroke-linecap="round" stroke-dasharray="' + score + ' ' + (100 - score) + '" ' +
        'transform="rotate(-90 21 21)"/>' +
      '<text x="21" y="20.4" text-anchor="middle" font-size="12.5" font-weight="900" fill="' + color + '">' + score + '</text>' +
      '<text x="21" y="27" text-anchor="middle" font-size="3.2" font-weight="700" fill="' + T.txt3 + '">' +
        (etq || 'DE 100') + '</text></svg></div>';
  }

  // Distingue lo que se VIO en el mapa de lo que el formato IMPLICA. En el
  // mapa abierto casi nadie dibuja el patio de un D1 o de una estación de
  // servicio, así que decir "no hay parqueadero" era falso en la calle.
  function textoParqueo(f){
    if (!f) return '';
    if (f.parqueaderos > 0) {
      return f.parqueaderos + (f.parqueaderos === 1 ? ' parqueadero mapeado' : ' parqueaderos mapeados') +
        ' en el radio' + (f.parqueoProbable && f.parqueoProbable.length
          ? ', más formatos que suelen traer el suyo.' : '.');
    }
    if (f.parqueoProbable && f.parqueoProbable.length) {
      return 'Sin parqueadero mapeado, pero hay ' +
        f.parqueoProbable.slice(0, 3).map(q => q.nombre.toLowerCase()).join(', ') +
        ': formatos que normalmente traen el suyo.';
    }
    return 'Sin parqueadero mapeado ni formatos que suelan traer el suyo.';
  }

  function colFlujo(v){ return v >= 70 ? T.ok : v >= 50 ? T.acento : v >= 30 ? T.warn : T.bad; }

  // ── 1. Lectura ejecutiva ────────────────────────────────────────────────
  function bloqueEjecutivo(r){
    const v = r.viabilidad;
    if (!v) return bloqueRanking(r);
    const col = v.nivel === 'Alta' ? T.ok : (v.nivel === 'Media' ? T.warn : T.bad);
    const est = estrellasDeScore(v.score);
    const lectura = v.nivel === 'Alta'
      ? 'El entorno reúne condiciones favorables para el proyecto: existe demanda poblacional, usos ' +
        'complementarios y accesibilidad que respalda la operación.'
      : v.nivel === 'Media'
      ? 'El proyecto es defendible, pero su resultado dependerá de diferenciarse de la oferta ya ' +
        'instalada y de validar la demanda en campo antes de comprometer inversión.'
      : 'Las condiciones actuales del entorno no favorecen este uso en particular. Conviene revisar ' +
        'alternativas mejor calificadas o evaluar otro radio antes de descartar el lote.';
    return '<div class="ejec">' + aroXL(v.score, col) +
      '<div class="ejec-txt">' +
        '<b class="ejec-rot">VIABILIDAD DEL PROYECTO</b>' +
        '<span class="ejec-nivel" style="color:' + col + '">' + esc(v.nivel) + '</span>' +
        '<div class="ejec-est">' + estrellasHTML(est) + '</div>' +
        '<p class="ejec-frase">' + esc(lectura) + '</p>' +
      '</div>' +
      '<div class="ejec-chips">' +
        '<span class="chip" style="background:' + col + '">' + v.score + ' / 100</span>' +
        '<span class="chip chip-oro">' + est + ' de 5 &#9733;</span>' +
      '</div></div>';
  }

  // ── 2. Los seis datos que explican el sitio ─────────────────────────────
  function seisDatos(r){
    const s = r.stats, f = (s.movilidad && s.movilidad.flujo) || {};
    const radioTxt = r.meta.radioM >= 1000 ? (r.meta.radioM / 1000) + ' km' : r.meta.radioM + ' m';
    const cajas = [
      { n: s.poblacionEstimada.toLocaleString('es-CO'), t: 'Habitantes',
        s: s.poblacionEsCensal ? 'DANE 2018' : 'estimación URBIS', c: T.acento },
      { n: (f.peatonal || 0) + ' / 100', t: 'Flujo peatonal',
        s: f.nivelPeatonal || '—', c: colFlujo(f.peatonal || 0) },
      { n: (f.vehicular || 0) + ' / 100', t: 'Flujo vehicular',
        s: f.nivelVehicular || '—', c: colFlujo(f.vehicular || 0) },
      { n: s.total.toLocaleString('es-CO'), t: 'Usos identificados',
        s: 'en ' + radioTxt, c: T.acento },
      { n: s.movilidad.nViasArterias, t: 'Vías arterias',
        s: 'en el radio', c: s.movilidad.nViasArterias > 0 ? T.acento : T.bad },
      // Cero paradas es un hallazgo, no un hueco: se pinta en rojo a propósito.
      { n: s.movilidad.paradasBus, t: 'Paradas de transporte',
        s: 'identificadas', c: s.movilidad.paradasBus > 0 ? T.acento : T.bad }
    ];
    return '<div class="seis">' + cajas.map(c =>
      '<div class="dato"><b style="color:' + c.c + '">' + c.n + '</b>' +
      '<span>' + esc(c.t) + '</span><small>' + esc(c.s) + '</small></div>').join('') + '</div>';
  }

  // ── 3. Oportunidad urbana ───────────────────────────────────────────────
  // El aro y la lista van en filas SEPARADAS. Antes compartían caja con un
  // elemento de ancho completo y la barra terminaba cruzando el aro por la
  // mitad: es exactamente el defecto que hay que no repetir.
  function bloqueOportunidad(r){
    const i = r.indicadores;
    if (!i) return '';
    const so = i.scoreOportunidad;
    const col = so.valor >= 75 ? T.ok : so.valor >= 60 ? T.acento : so.valor >= 45 ? T.warn : T.bad;
    const est = estrellasDeScore(so.valor);
    const opos = (i.oportunidades.lista || []).slice(0, 3);
    return '<div class="tarjeta"><h2>Oportunidad urbana</h2>' +
      '<div class="oport-cab">' + aroXL(so.valor, col, '/100') +
        '<div><span class="oport-nivel" style="color:' + col + '">' + esc(so.nivel) + '</span>' +
        '<div class="oport-est">' + estrellasHTML(est) + '</div></div>' +
      '</div>' +
      (opos.length ? '<table class="tbl-oport">' + opos.map(o =>
        '<tr><td class="pos">+' + o.potencial + '</td><td>' + esc(o.nombre) + '</td>' +
        '<td class="razon">hoy hay ' + o.existentes + '</td></tr>').join('') + '</table>' : '') +
      '<p class="nota-pie">La oportunidad mide la calidad del sitio, independientemente del proyecto que se construya.</p>' +
      '</div>';
  }

  // ── 3. Cómo leer el informe ─────────────────────────────────────────────
  function bloqueComoLeer(r){
    const i = r.indicadores || {};
    const filas = [
      ['Viabilidad', 'qué tan bien encaja TU proyecto en este lote.'],
      ['Exposición vial', 'visibilidad y acceso que aporta la malla vial cercana.'],
      ['Oportunidad urbana', 'qué tan buen sitio es el lote, sin importar qué se construya.'],
      ['Estrato', 'capacidad de compra del sector; orienta producto y precio.'],
      ['Población', r.stats.poblacionEsCensal
        ? 'habitantes reales del área según DANE, no una estimación.'
        : 'habitantes estimados en el área de influencia.'],
      ['Edad y sexo', 'quién vive alrededor; orienta la demanda.']
    ];
    if (!(i.estrato && i.estrato.disponible)) filas.splice(3, 1);
    if (!(i.demografia && i.demografia.disponible)) {
      const k = filas.findIndex(f => f[0] === 'Edad y sexo');
      if (k >= 0) filas.splice(k, 1);
    }
    return '<div class="tarjeta"><h2>Cómo leer el informe</h2><div class="leer">' +
      filas.map(f => '<div><b>' + esc(f[0]) + '</b><small>' + esc(f[1]) + '</small></div>').join('') +
      '</div></div>';
  }

  // ── 4. Lo más importante para el cliente ────────────────────────────────
  function bloqueClave(r){
    const s = r.stats, m = s.movilidad, f = m.flujo || {};
    const barra = (etq, val, nivel) =>
      '<div class="cl-flujo"><div class="cl-cab"><b>' + etq + '</b>' +
      '<span style="color:' + colFlujo(val) + '">' + val + ' / 100 · ' + esc(nivel || '—') + '</span></div>' +
      '<div class="cl-barra"><i style="width:' + val + '%;background:' + colFlujo(val) + '"></i></div></div>';
    const lectura = f.dominante === 'ninguno'
      ? 'No pasa casi nadie, ni a pie ni en carro. El negocio tendría que traer su propia clientela, no capturarla del flujo.'
      : f.dominante === 'peatonal'
      ? 'El entorno mueve más gente a pie que en carro. Favorece formatos de paso, vitrina a la calle y estancia corta.'
      : f.dominante === 'vehicular'
      ? 'El entorno mueve más carro que peatón. Sin parqueo resuelto, el flujo puede pasar de largo sin convertirse en cliente.'
      : 'El entorno reparte parejo entre peatón y carro. Conviene resolver los dos accesos y no apostar a uno solo.';
    const via = (m.viasArterias || [])[0];
    const reto = !f.hayDondeParar
      ? 'No hay parqueadero mapeado ni formatos que suelan traer el suyo: el flujo pasa de largo.'
      : f.avisoDatos
      ? 'La zona está poco mapeada: el flujo real puede ser mayor que el estimado.'
      : 'Diferenciarse de la competencia ya instalada en el radio.';
    // Dónde pararse dentro del radio: es una decisión distinta de si la zona
    // sirve, y para un formato de paso pesa más que el promedio del sector.
    const consejo = f.consejoUbicacion
      ? '<div class="cl-donde"><b>DÓNDE UBICARSE</b><p>' + esc(f.consejoUbicacion) + '</p></div>' : '';
    return '<div class="clave">' +
      '<div class="cl-col">' + barra('FLUJO PEATONAL', f.peatonal || 0, f.nivelPeatonal) +
        barra('FLUJO VEHICULAR', f.vehicular || 0, f.nivelVehicular) + '</div>' +
      '<div class="cl-lectura"><b>LECTURA CLAVE</b><p>' + esc(lectura) + '</p>' + consejo + '</div>' +
      '<div class="cl-minis">' +
        '<div><b>DEMANDA</b><small>' + s.poblacionEstimada.toLocaleString('es-CO') +
          ' habitantes en el área de influencia.</small></div>' +
        '<div><b>VISIBILIDAD</b><small>Exposición vial ' + esc((m.nivelExposicion || '').toLowerCase()) +
          (via ? '; ' + esc(via.nombre) + ' a ' + via.distM + ' m.' : '.') + '</small></div>' +
        '<div><b>DÓNDE PARAR</b><small>' + esc(textoParqueo(f)) + '</small></div>' +
        '<div><b>RETO</b><small>' + esc(reto) + '</small></div>' +
      '</div></div>';
  }

  // ── 5. Viabilidad en detalle ────────────────────────────────────────────
  function bloqueViabilidadDetalle(r){
    const v = r.viabilidad;
    if (!v) return '';
    const col = v.nivel === 'Alta' ? T.ok : (v.nivel === 'Media' ? T.warn : T.bad);
    const est = estrellasDeScore(v.score);
    const N = { demanda:'Demanda', competencia:'Competencia', complementarios:'Complementarios',
                movilidad:'Movilidad', entorno:'Entorno' };
    let filas = '', mejor = null, peor = null;
    if (v.subscores) {
      const claves = Object.keys(v.subscores);
      claves.forEach(k => {
        const val = v.subscores[k];
        if (!mejor || val > v.subscores[mejor]) mejor = k;
        if (!peor || val < v.subscores[peor]) peor = k;
      });
      // El número va FUERA de la barra, en su propia columna: dentro se lo
      // comía el relleno cuando la barra llegaba al 100 %.
      filas = claves.map(k =>
        '<div class="sub-fila"><span>' + N[k] + '</span>' +
        '<div class="sub-barra"><i style="width:' + v.subscores[k] + '%;background:' +
          (v.subscores[k] >= 60 ? T.ok : v.subscores[k] >= 40 ? T.warn : T.bad) + '"></i></div>' +
        '<b>' + v.subscores[k] + '</b></div>').join('');
    }
    const caja = (mejor && peor && mejor !== peor)
      ? '<div class="sub-resumen">' +
          '<div><b class="et-ok">FORTALEZA</b><span>' + N[mejor] + ' ' + v.subscores[mejor] + '/100</span></div>' +
          '<div><b class="et-bad">RETO</b><span>' + N[peor] + ' ' + v.subscores[peor] + '/100</span></div>' +
        '</div>'
      : '';
    return '<div class="tarjeta"><h2>Viabilidad &middot; ' + v.score + ' / 100</h2>' +
      '<p class="sub-nivel" style="color:' + col + '">' + est + ' de 5 &#9733; &middot; Viabilidad ' + esc(v.nivel) + '</p>' +
      '<p class="nota-pie">La puntuación se construye con cinco dimensiones del entorno.</p>' +
      filas + caja + '</div>';
  }

  // ── 6. Qué trae gente a pie ─────────────────────────────────────────────
  function bloqueTraeGente(r){
    const f = r.stats.movilidad && r.stats.movilidad.flujo;
    if (!f) return '';
    // Ocho filas y no seis: al abrir la matriz en rubros aparecieron más tipos
    // de generador, y con seis se quedaba fuera justamente el gimnasio —el
    // hito que se pidió resaltar—. La tabla cabe: el aro de más se compensa
    // recortando el aire, no la información.
    const gen = (f.generadores || []).slice(0, 8);
    const filas = gen.length
      ? '<table class="tbl-gente"><tr><th>Uso / ejemplos</th><th class="n">Cant.</th><th class="n">Aporte</th></tr>' +
        gen.map(g => '<tr><td>' + esc(g.nombre) +
          ((g.ejemplos && g.ejemplos.length) ? '<em>' + esc(g.ejemplos.join(' &middot; ')) + '</em>' : '') +
          '</td><td class="n">' + g.n + '</td><td class="n">' + g.aporte + '</td></tr>').join('') + '</table>'
      : '<p class="nota-pie">No se identificaron generadores de peatones en el radio.</p>';
    // Lo que RESTA. Un informe que solo suma miente por omisión: el tramo de
    // bodegas o los tres locales cerrados con reja son lo que corta el
    // recorrido a pie, y quien va a poner un local necesita verlo.
    const pen = (f.penalizadores || []).slice(0, 4);
    const resta = pen.length
      ? '<div class="resta"><h3>Lo que rompe el recorrido a pie</h3>' +
        pen.map(pp => '<div class="resta-fila"><span>' + esc(pp.nombre) +
          ' <em>&middot; ' + esc(pp.motivo) + '</em></span><b>&minus;' + pp.resta +
          ' (' + pp.n + ')</b></div>').join('') +
        '<p class="pie-nota">Descuenta ' + (f.restaPeaton || 0) + ' de ' + (f.sumaBruta || 0) +
        ' puntos brutos de atracción peatonal.</p></div>'
      : '<div class="resta"><h3>Lo que rompe el recorrido a pie</h3>' +
        '<p class="pie-nota">No se detectaron frentes muertos (bodegas, lotes encerrados, ' +
        'locales desocupados o ruinas) en el radio: la continuidad del andén no tiene cortes visibles.</p></div>';
    const hora = (etq, val) =>
      '<div class="hf"><span>' + etq + '</span><div class="cl-barra"><i style="width:' + val +
      '%;background:' + T.acento + '"></i></div><b>' + val + '</b></div>';
    // El gimnasio va primero y resaltado: es el hito que más cambia el tránsito
    // de una acera —entra y sale gente a horas fijas, todos los días— y por eso
    // se pidió expresamente que no quedara escondido en la lista.
    const todos = (f.hitos || []);
    const orden = todos.filter(h => h.sub === 'gimnasio')
                       .concat(todos.filter(h => h.sub !== 'gimnasio'));
    const hitos = orden.slice(0, 3);
    const resto = orden.slice(3, 4)[0];
    return '<div class="gente">' +
      '<div class="tarjeta">' + filas + '</div>' +
      '<div class="tarjeta"><h2>Hora fuerte</h2>' +
        hora('Mañana', f.franjas.manana) + hora('Mediodía', f.franjas.mediodia) +
        hora('Tarde', f.franjas.tarde) + hora('Noche', f.franjas.noche || 0) +
        (hitos.length
          ? '<h2 class="h2-sep">Hitos que mueven la acera</h2>' +
            hitos.map(h => '<div class="hito-fila' + (h.sub === 'gimnasio' ? ' fuerte' : '') + '">' +
              '<span>' + esc(h.nombre) + '</span><b>' + h.distM + ' m</b></div>').join('') +
            (resto ? '<p class="nota-pie">+ ' + esc(resto.nombre) + ' &middot; ' + resto.distM + ' m</p>' : '')
          : '') +
      '</div>' +
      '<div>' + resta + '</div></div>';
  }

  // Franja de tránsito y combustible: dos magnitudes en una línea ancha.
  function franjaTransito(r){
    const f = r.stats.movilidad && r.stats.movilidad.flujo;
    const t = f && f.trafico;
    if (!t) return '';
    const cifra = (v, etq) => '<div class="tr-par"><b>' + v + '</b><span>' + etq + '</span></div>';
    return '<div class="transito">' +
      '<div class="tr-rot">Tránsito y combustible</div>' +
      cifra(t.estimable ? miles(t.carrosDiaMin) + '&ndash;' + miles(t.carrosDiaMax) : '&mdash;', 'carros por día') +
      cifra(t.estaciones ? miles(t.litrosMesMin) + '&ndash;' + miles(t.litrosMesMax) : '&mdash;', 'litros / mes') +
      '<div class="tr-notas">' +
        '<small>' + (t.estaciones
            ? t.estaciones + (t.estaciones === 1 ? ' estación' : ' estaciones') + ' de servicio en el radio'
            : 'Sin estaciones de servicio en el radio') +
          ' &middot; rangos de orden de magnitud, no mediciones ni cifras de ventas.</small>' +
        '<small>Nota: el flujo es potencial estimado a partir de usos y malla vial; no es un aforo.</small>' +
      '</div></div>';
  }

  // ── 7. Composición del entorno ──────────────────────────────────────────
  function bloqueComposicion(r){
    const G = window.AIA_MOTOR.GRUPOS, C = window.AIA_MOTOR.GRUPO_COLOR, s = r.stats;
    const grupos = Object.keys(G).filter(g => (s.porGrupo[g] || 0) > 0)
      .sort((a, b) => s.porGrupo[b] - s.porGrupo[a]);
    const max = grupos.length ? s.porGrupo[grupos[0]] : 1;
    const filas = grupos.map(g => {
      const n = s.porGrupo[g], pct = (100 * n / Math.max(s.total, 1));
      return '<div class="comp-fila"><span>' + esc(G[g].t) + '</span>' +
        '<div class="comp-barra"><i style="width:' + (100 * n / max).toFixed(1) + '%;background:' + C[g] + '"></i></div>' +
        '<b>' + n.toLocaleString('es-CO') + '</b><em>' + pct.toFixed(1) + '%</em></div>';
    }).join('');
    return '<div class="tarjeta"><h2>Composición del entorno</h2>' +
      '<p class="sub-nivel" style="color:' + T.ok + '">' + s.total.toLocaleString('es-CO') + ' usos identificados</p>' +
      filas + '</div>';
  }

  // ── 7. Indicadores urbanos, como filas etiqueta / valor ─────────────────
  function bloqueIndicadoresFilas(r){
    const i = r.indicadores;
    if (!i) return '';
    const colNivel = t => /muy alta|alto potencial|fuerte transformaci|riesgo bajo|alta actividad/i.test(t) ? T.ok
      : /(^|\s)alta|en transformaci|potencial medio|moderada|riesgo medio/i.test(t) ? T.acento
      : /media|en transici|riesgo alto|especializado/i.test(t) ? T.warn : T.bad;
    const fila = (etq, val, nota, color) =>
      '<div class="ind-fila"><span>' + esc(etq) + '</span>' +
      '<b style="color:' + (color || colNivel(val)) + '">' + val + '</b>' +
      (nota ? '<em>' + nota + '</em>' : '') + '</div>';
    let out = '';
    const e = i.estrato;
    if (e && e.disponible) {
      out += fila('Estrato', e.predominante + (e.homogeneo ? '' : ' (rango ' + e.minimo + '&ndash;' + e.maximo + ')'),
                  'Censo DANE 2018', T.ok);
    }
    const d = i.demografia;
    if (d && d.disponible) {
      out += fila('Sexo', d.pctMujeres + '% mujeres &middot; ' + d.pctHombres + '% hombres',
                  d.pctNinos + '% menores de 15 &middot; ' + d.pctMayores + '% de 65 o más', T.acento);
    }
    out += fila('Diversidad de usos', esc(i.diversidad.nivel));
    out += fila('Actividad comercial', esc(i.comercio.nivel));
    out += fila('Expansión (suelo libre)', esc(i.expansion.nivel));
    out += fila('Transformación (obras)', esc(i.transformacion.nivel));
    out += fila('Riesgo urbano', esc(i.riesgos.nivel));
    return '<div class="tarjeta"><h2>Indicadores urbanos</h2>' + out + '</div>';
  }

  // ── 8. El entorno según la distancia ────────────────────────────────────
  function bloqueRadios(r){
    const m = r.multiRadio;
    if (!m || !m.anillos || m.anillos.length < 2) return '';
    const etq = v => v >= 1000 ? (v / 1000) + ' km' : v + ' m';
    const filas = m.anillos.map(a =>
      '<tr' + (a.esAnalizado ? ' class="fila-act"' : '') + '><td>' + etq(a.radioM) + '</td>' +
      '<td>' + a.total + '</td><td>' + a.densidadPorHa + '</td><td>' + a.comercio + '</td>' +
      '<td>' + a.equipamientos + '</td><td>' + a.poblacionEstimada.toLocaleString('es-CO') + '</td></tr>').join('');
    return '<div class="tarjeta"><table class="tbl-radios2">' +
      '<tr class="cab"><th>Radio</th><th>Usos</th><th>Usos/ha</th><th>Comercio</th>' +
      '<th>Equipam.</th><th>Hab. est.</th></tr>' + filas + '</table>' +
      '<p class="nota-pie">' + esc(m.lectura) + '</p></div>';
  }

  // ── 9. FODA + siguiente paso ────────────────────────────────────────────
  function bloqueFodaAncho(r){
    const f = r.foda;
    const caja = (t, cls, items) => '<div class="foda ' + cls + '"><h3>' + t + '</h3><ul>' +
      (items && items.length ? items.slice(0, 3).map(x => '<li>' + esc(x) + '</li>').join('')
                             : '<li class="vacio">Sin hallazgos relevantes.</li>') + '</ul></div>';
    return '<div class="foda-grid4">' +
      caja('FORTALEZAS', 'f', f.fortalezas) + caja('DEBILIDADES', 'd', f.debilidades) +
      caja('OPORTUNIDADES', 'o', f.oportunidades) + caja('RIESGOS', 'r', f.riesgos) +
      '</div>';
  }

  // Cuántas hojas tiene el informe. Vive en una constante porque la
  // numeración del pie y la del encabezado tienen que decir lo mismo, y
  // antes había que acordarse de cambiar los dos sitios a mano.
  const N_HOJAS = 4;

  // Cabecera y pie iguales en todas las hojas: la numeración "n/N" es lo único
  // que cambia, y es lo que permite reconocer una hoja suelta si se imprime.
  function cabecera(titulo, rotulo, sub, fecha, n){
    return '<header>' +
      '<img class="logo" src="assets/brand/urbis-logo.png" onerror="this.style.display=\'none\'">' +
      '<div class="head-txt"><h1>' + esc(titulo) + '</h1>' +
      '<p>' + esc(rotulo) + '</p>' +
      (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>' +
      '<div class="sub">' + esc(fecha) + '<b>' + n + '/' + N_HOJAS + '</b></div>' +
      '</header>';
  }

  function pie(n, r, autor){
    return '<footer><span>Página ' + n + ' de ' + N_HOJAS + ' · ' + (autor ? esc(autor) + ' · ' : '') +
      '<b>URBIS</b> · Urbis para Empresas &nbsp;·&nbsp; @urbis_co &nbsp;·&nbsp; urbisprocity@gmail.com</span>' +
      '<span>Fuentes: ' + (r.stats.poblacionEsCensal ? 'Censo DANE 2018 · ' : '') +
      'OpenStreetMap · evaluación heurística URBIS</span></footer>';
  }

  function construirHTMLEjecutivo(r, chartsPNG, opciones){
    chartsPNG = chartsPNG || {};
    opciones = opciones || {};
    // El estilo se fija ANTES de armar nada: tanto el CSS como los bloques
    // leen `T`, y se evalúan en orden dentro del mismo arreglo de plantilla.
    fijarEstilo(opciones.estilo);
    const titulo = opciones.titulo || r.meta.proyectoNombre || 'Urbis para Empresas';
    const subtitulo = opciones.subtitulo || r.meta.direccionAprox || '';
    const horizontal = opciones.orientacion !== 'vertical';
    const autor = opciones.autor || '';
    const ubicacionTxt = (opciones.ubicacion && opciones.ubicacion.texto) || '';
    const fecha = new Date(r.meta.fechaISO).toLocaleString('es-CO', { dateStyle:'long', timeStyle:'short' });

    const anchoMM = horizontal ? 263 : 200, altoMM = horizontal ? 200 : 263;
    const radioTxt = r.meta.radioM >= 1000 ? (r.meta.radioM / 1000) + ' km' : r.meta.radioM + ' m';
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
// DOS hojas en vez de una. Al sumar los datos del DANE (población, estrato,
// sexo y edad) el informe dejó de caber en una sola página y el auto-ajuste
// tenía que encogerlo hasta recortar. Ahora la página 1 explica el veredicto
// al cliente y la 2 lleva el detalle: cada una se ajusta por separado.
'.hoja{width:', anchoMM, 'mm;height:', altoMM, 'mm;overflow:hidden;position:relative;background:', T.hoja, '}',
'.hoja + .hoja{margin-top:10mm}',
'.contenido{transform-origin:top left;width:100%}',
'@media print{.hoja{margin:0 !important}.hoja + .hoja{break-before:page;page-break-before:always}}',
/* Veredicto grande — el elemento pedagógico de la página 1 */
'.veredicto{border:2px solid ', T.borde, ';border-radius:10px;overflow:hidden;margin-bottom:6px}',
'.ver-h{background:linear-gradient(100deg,', T.cab1, ',', T.cab2, ');color:', T.cabTxt, ';',
'padding:5px 12px;display:flex;align-items:center;gap:8px}',
'.ver-h b{font-size:9px;font-weight:900;letter-spacing:1.6px}',
'.ver-h span{margin-left:auto;font-size:7.4px;background:rgba(255,255,255,.2);padding:2px 8px;',
'border-radius:99px;font-weight:700}',
'.ver-b{display:flex;align-items:center;gap:14px;padding:11px 14px;background:', T.suave, '}',
'.ver-b .gauge-xl{width:46mm;height:46mm;flex:0 0 auto}',
'.ver-txt{flex:1}',
'.ver-txt .estrellas-xl{font-size:26px;color:', T.oro, ';letter-spacing:3px;line-height:1}',
'.ver-txt .nivel-xl{display:block;font-size:20px;font-weight:900;line-height:1.1;margin-top:3px}',
'.ver-txt .frase-xl{display:block;font-size:9px;color:', T.txt2, ';margin-top:5px;line-height:1.45}',
/* Guía pedagógica: qué significa cada cosa */
'.guia{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;margin-top:5px}',
'.guia div{border:1px solid ', T.borde, ';border-radius:6px;padding:5px 8px;background:', T.panel, '}',
'.guia b{display:block;font-size:8px;color:', T.acento, ';font-weight:800;margin-bottom:1px}',
'.guia small{display:block;font-size:7.4px;color:', T.txt2, ';line-height:1.35}',
// En pantalla (previsualización) la hoja se muestra completa sobre un
// fondo gris, como un visor de PDF; al imprimir vuelve a tamaño real.
'@media screen{body{background:#4b5563;padding:8px}.hoja{box-shadow:0 6px 26px rgba(0,0,0,.45)}}',
'@media print{body{background:', T.hoja, ';padding:0}#marco{transform:none !important;margin:0 !important}.hoja{box-shadow:none}}',
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
'header .head-txt small{display:block;font-size:7.4px;color:', T.cabTxt, ';opacity:.85;margin-top:1px}',
'header .sub{margin-left:auto;text-align:right;font-size:8px;color:', T.cabTxt, ';opacity:.9;line-height:1.35}',
'header .sub b{display:block;font-size:8px;font-weight:700;opacity:.8;margin-top:3px}',
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
// El mapa es la excepción: su alto lo manda su proporción. Si la columna se
// lo estirara, quedaría un borde con aire vacío debajo de la foto.
'.fila>div>.mapa-marco{flex:0 0 auto}',
// Y para que ese alto de más se use de verdad y no vuelva a ser vacío: la
// tabla del bloque estira sus filas, y las imágenes se centran.
'.bloque{display:flex;flex-direction:column}',
'.bloque>table{flex:1 1 auto}',
'.bloque>table td,.bloque>table th{vertical-align:middle}',
'.bloque>img{margin-top:auto;margin-bottom:auto}',
// Las listas y la rejilla de KPIs no estiran solas: se les reparte el aire
// entre renglones en vez de acumularlo al final del marco.
'.bloque>ul{flex:1 1 auto;display:flex;flex-direction:column;justify-content:space-around}',
// Los KPI NO se estiran. Con `flex:1 1 auto` absorbían todo el sobrante de la
// hoja: medían 190 px con 145 de aire vacío cada uno, cinco veces. El sobrante
// queda ahora disponible para contenido de verdad.
'.bloque>.kpis{flex:0 0 auto;align-content:start}',
'.kpi{align-self:start}',
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
// La proporción se fija con `padding-top`, no con `aspect-ratio`: como el
// recuadro es un bloque dentro del marco (no un elemento flexible), ni la
// rejilla ni un `flex-grow` heredado pueden estirarlo. Antes sí lo estiraban,
// el recuadro dejaba de ser 4:3, `object-fit:cover` recortaba los lados y todo
// lo dibujado encima —el lote incluido— quedaba corrido.
// El borde va en el marco, no en el recuadro: sumado al ancho le robaba a la
// proporción un 1% y volvía a descuadrar —poco, pero descuadrar— lo dibujado.
'.mapa-marco{position:relative;width:100%;flex:0 0 auto;border:1px solid #cfd8e0;border-radius:6px;overflow:hidden}',
'.mapa-wrap{position:relative;width:100%;height:0;padding-top:75%;overflow:hidden;background:#dde3e8}',
// `fill` y no `cover`: con el recuadro y la imagen en la misma proporción son
// idénticos, pero `fill` garantiza que las esquinas del recuadro sean las
// esquinas del mapa, que es de lo que depende toda la georreferenciación.
'.mapa-img{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;display:block}',
'.mapa-vacio{background:repeating-linear-gradient(45deg,#e8edf1,#e8edf1 8px,#dfe6ec 8px,#dfe6ec 16px)}',
'.mapa-radio{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border:2px dashed rgba(255,255,255,.95);',
'border-radius:50%;box-shadow:0 0 0 9999px rgba(10,25,20,.16) inset}',
'.mapa-wrap .pt{position:absolute;width:5px;height:5px;border-radius:50%;transform:translate(-50%,-50%);',
'box-shadow:0 0 0 .8px rgba(255,255,255,.9)}',
// Punto de tamaño cero en el centro exacto: los hijos se cuelgan de él sin
// moverlo, así el rótulo puede crecer sin arrastrar la marca del lote.
'.mapa-pin{position:absolute;left:50%;top:50%;width:0;height:0}',
'.mapa-pin .cruz-h{position:absolute;left:-11px;top:-.75px;width:22px;height:1.5px;background:', T.cab1, ';',
'box-shadow:0 0 0 .6px rgba(255,255,255,.85)}',
'.mapa-pin .cruz-v{position:absolute;left:-.75px;top:-11px;width:1.5px;height:22px;background:', T.cab1, ';',
'box-shadow:0 0 0 .6px rgba(255,255,255,.85)}',
'.mapa-pin .punto{position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:50%;background:#fff;',
'border:2px solid ', T.cab1, ';box-shadow:0 1px 3px rgba(0,0,0,.45)}',
'.mapa-pin b{position:absolute;left:14px;top:-6px;white-space:nowrap;background:', T.cab1, ';color:', T.cabTxt, ';',
'font-size:7.6px;padding:2px 5px;border-radius:3px;letter-spacing:.5px}',
// Hitos peatonales: el gimnasio, la parada, el colegio… con nombre y distancia.
'.hito{position:absolute;width:0;height:0}',
'.hito i{position:absolute;left:-4.5px;top:-4.5px;width:9px;height:9px;border-radius:50%;background:', T.oro, ';',
'border:1.6px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.5)}',
'.hito b{position:absolute;top:-7px;white-space:nowrap;background:rgba(255,255,255,.95);color:#12202e;',
'font-size:6.4px;font-weight:800;padding:1.5px 4px;border-radius:3px;border:1px solid ', T.oro, ';',
'display:flex;gap:3px;align-items:baseline}',
'.hito b em{font-style:normal;font-weight:700;color:', T.txt3, '}',
'.hito.izq b{right:9px}',
'.hito.der b{left:9px}',
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
'.kpis-6{grid-template-columns:repeat(3,1fr)}',
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
'.estrato-franja{display:flex;align-items:center;gap:5px;margin-bottom:4px;padding:3px 6px;',
'border-radius:4px;background:', T.suave, ';border-left:2.5px solid ', T.oro, '}',
'.estrato-franja b{font-size:8.4px;color:', T.acento, ';font-weight:900}',
'.estrato-franja b em{font-style:normal;font-weight:700;color:', T.txt2, '}',
'.estrato-franja span{margin-left:auto;font-size:6.6px;font-weight:700;color:', T.txt3, ';',
'text-transform:uppercase;letter-spacing:.3px}',
'.demo-mini{margin-bottom:4px}',
'.demo-bar{display:flex;height:6px;border-radius:3px;overflow:hidden;background:', T.linea, '}',
'.demo-leg{display:flex;flex-wrap:wrap;gap:2px 8px;margin-top:2.5px;font-size:6.8px;color:', T.txt2, '}',
'.demo-leg span{display:inline-flex;align-items:center;gap:3px;font-weight:700}',
'.demo-leg b{width:5px;height:5px;border-radius:2px;display:inline-block}',
'.demo-leg .demo-edad{color:', T.txt3, ';font-weight:600}',
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
// Antes esta celda era nowrap con 96px y puntos suspensivos: "Avenida de La
// Gran Colombia" salía cortada. Ahora parte en dos líneas en vez de recortar.
'.tbl-vias .via-n{max-width:110px;line-height:1.2;overflow-wrap:anywhere}',
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
// Tres columnas cuando hay hitos que mostrar; si no, la tercera se colapsa
// sola y las dos primeras se reparten el ancho.
'.flujo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}',
'.flujo-h3{font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:', T.txt2, ';',
'font-weight:800;margin-bottom:4px}',
'.hitos-lista{display:flex;flex-direction:column;gap:3px}',
'.hito-chip{display:flex;align-items:baseline;gap:4px;font-size:7.6px;padding:2.5px 5px;border-radius:4px;',
'background:', T.suave, ';border:1px solid ', T.borde, '}',
'.hito-chip b{font-weight:800;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.hito-chip em{font-style:normal;font-weight:700;color:', T.txt3, '}',
// El gimnasio se resalta: es el hito que más cambia el tránsito de la acera.
'.hito-chip.fuerte{background:rgba(245,185,66,.14);border-color:', T.oro, '}',
'.hitos-nota{font-size:7.4px;line-height:1.45;color:', T.txt2, ';margin-top:5px}',
'.traf{margin-top:2px}',
'.traf-fila{display:flex;align-items:baseline;justify-content:space-between;gap:6px;',
'padding:3px 5px;border-radius:4px;background:', T.suave, ';border:1px solid ', T.borde, '}',
'.traf-fila span{font-size:7.6px;font-weight:700}',
'.traf-fila b{font-size:8.6px;font-weight:800;color:', T.acento, '}',
'.traf-pie{font-size:6.8px;line-height:1.35;color:', T.txt3, ';margin:2px 0 5px}',
'.gen-ej{display:block;font-style:normal;font-size:7px;color:', T.txt3, ';font-weight:600;line-height:1.25}',
'.flujo-med{margin-bottom:7px}',
'.flujo-cab{display:flex;align-items:baseline;gap:6px;margin-bottom:3px}',
'.flujo-cab b{font-size:9.5px;font-weight:800}',
'.flujo-cab span{margin-left:auto;font-size:8.5px;font-weight:800}',
'.flujo-barra{height:9px;border-radius:5px;background:#e9edf2;overflow:hidden}',
'.flujo-barra.alta{height:7px;flex:1}',
'.flujo-barra i{display:block;height:100%;border-radius:5px}',
'.flujo-lectura{font-size:8.5px;line-height:1.5;margin-top:5px}',
'.flujo-tabla{width:100%;border-collapse:collapse;font-size:8px}',
'.flujo-tabla th{text-align:left;font-size:7.5px;text-transform:uppercase;letter-spacing:.3px;padding:3px 5px;border-bottom:1px solid #d9e2ea}',
'.flujo-tabla td{padding:3px 5px;border-bottom:1px solid #eef2f6}',
'.flujo-tabla td.n{text-align:right;font-weight:700}',
'.flujo-horas{margin-top:6px;display:flex;flex-direction:column;gap:4px}',
'.flujo-hora{display:flex;align-items:center;gap:6px}',
'.flujo-hora small{font-size:7.5px;width:44px;flex:0 0 auto}',
'.flujo-hora b{font-size:8px;width:22px;text-align:right;flex:0 0 auto}',
'.flujo-vacio{font-size:8.5px;line-height:1.5}',
// La advertencia de que esto es un potencial y no un aforo nunca tuvo estilo
// propio: salía con la letra por defecto del navegador, enorme, y se comía la
// hoja obligando al auto-ajuste a encoger todo lo demás.
'.pie-nota{font-size:7.2px;line-height:1.45;color:', T.txt3, ';margin-top:6px;font-style:italic}',

/* ── Mapas de calor ──────────────────────────────────────────────── */
// Los tres paneles comparten fila y ancho. `min-width:0` es obligatorio en
// una rejilla: sin él, el panel se niega a encoger por debajo de su
// contenido y el tercero se sale de la hoja.
'.calor-fila{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;align-items:start}',
'.calor-panel{min-width:0}',
'.calor-panel h3{margin:0 0 4px;font-size:8.6px;font-weight:700;color:', T.tinta, ';letter-spacing:.2px}',
'.calor-panel h3 em{display:block;font-style:normal;font-weight:400;font-size:7.2px;color:', T.txt3, '}',
// La capa se centra sobre el mismo círculo que dibuja `.mapa-radio`: si se
// estirara al recuadro entero, el calor quedaría corrido respecto al lote.
'.calor-capa{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);opacity:.72;pointer-events:none}',
'.calor-foco{position:absolute;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border:1.6px solid #fff;',
  'border-radius:50%;background:transparent;box-shadow:0 0 0 1.4px rgba(0,0,0,.55)}',
'.calor-foco-txt{margin:4px 0 0;font-size:7.4px;line-height:1.4;color:', T.txt2, '}',
'.calor-pie{margin-top:6px}',
'.voc-titulo{margin:0 0 3px;font-size:9.4px;font-weight:700;color:', T.acento, '}',
'.voc-titulo em{font-style:normal;font-weight:400;font-size:7.6px;color:', T.txt3, '}',
'.voc-lectura{margin:0 0 6px;font-size:8px;line-height:1.45;color:', T.txt2, '}',
'.calor-leyenda{display:inline-flex;align-items:center;gap:5px;font-size:7px;color:', T.txt3, ';margin-right:14px}',
'.calor-leyenda i{display:block;width:78px;height:7px;border-radius:3px}',
'.calor-leyenda.peaton i{background:linear-gradient(90deg,rgba(120,190,60,.45),rgba(245,205,60,.75),rgba(214,40,40,.9))}',
'.calor-leyenda.vehiculo i{background:linear-gradient(90deg,rgba(70,130,220,.45),rgba(110,110,225,.75),rgba(120,20,150,.9))}',
'.resta{border:1px solid ', T.bad, '33;border-radius:6px;padding:6px 8px;background:', T.bad, '0d}',
'.resta h3{margin:0 0 4px;font-size:8.4px;font-weight:700;color:', T.bad, '}',
'.resta-fila{display:flex;justify-content:space-between;gap:6px;font-size:7.6px;',
  'padding:2px 0;border-bottom:1px solid ', T.bad, '22}',
'.resta-fila:last-child{border-bottom:none}',
'.resta-fila em{font-style:normal;color:', T.txt3, '}',
'.resta-fila b{color:', T.bad, ';white-space:nowrap}',
'.flujo-aviso{font-size:8.5px;line-height:1.5;margin-top:6px;padding:5px 7px;border-radius:4px;',
  'background:rgba(245,185,66,.12);border:1px solid rgba(245,185,66,.45)}',
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
'footer{margin-top:7px;padding-top:5px;border-top:1px solid ', T.borde, ';font-size:6.8px;',
'color:', T.txt3, ';display:flex;justify-content:space-between;gap:10px}',
/* ══ Diagramación en tres hojas ══════════════════════════════════════ */
/* Cabecera de sección numerada: es lo que le da hilo narrativo al informe. */
'.sec{display:flex;align-items:baseline;gap:7px;margin:9px 0 5px;padding-bottom:3px;',
'border-bottom:1.6px solid ', T.oro, '}',
'.sec b{font-size:10px;font-weight:900;letter-spacing:.5px;text-transform:uppercase;color:', T.cab1, '}',
'.sec em{font-style:normal;font-size:7.6px;color:', T.txt3, ';font-weight:600}',
'.sec:first-of-type{margin-top:7px}',
/* Tarjeta genérica: una sola definición para todo el informe. */
'.tarjeta{border:1px solid ', T.borde, ';border-radius:7px;padding:7px 9px;background:', T.panel, ';',
'display:flex;flex-direction:column;min-width:0}',
'.tarjeta h2{font-size:8.6px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;',
'color:', T.cab1, ';margin-bottom:5px}',
'.tarjeta .h2-sep{margin-top:8px}',
'.nota-pie{font-size:6.9px;line-height:1.4;color:', T.txt3, ';margin-top:5px}',
/* El aro vive en una caja de tamaño fijo que nada puede invadir: ese es el
   defecto que se venía repitiendo —una barra de ancho completo cruzándolo—. */
'.aro-caja{flex:0 0 auto;line-height:0}',
'.aro{display:block}',
/* 1 · Lectura ejecutiva */
'.ejec{display:flex;align-items:center;gap:14px;border:1px solid ', T.borde, ';border-radius:9px;',
'padding:10px 14px;background:', T.suave, '}',
'.ejec .aro-caja .aro{width:38mm;height:38mm}',
'.ejec-txt{flex:1;min-width:0}',
'.ejec-rot{display:block;font-size:9.5px;font-weight:900;letter-spacing:.8px;color:', T.cab1, '}',
'.ejec-nivel{display:block;font-size:19px;font-weight:900;line-height:1.15;margin-top:1px}',
'.ejec-est{font-size:15px;color:', T.oro, ';letter-spacing:2px;line-height:1.2}',
'.ejec-frase{font-size:8.4px;line-height:1.5;color:', T.txt2, ';margin-top:4px}',
'.ejec-chips{flex:0 0 auto;display:flex;flex-direction:column;gap:6px}',
'.chip{display:block;text-align:center;color:#fff;font-size:8.4px;font-weight:800;',
'padding:4px 14px;border-radius:5px;white-space:nowrap}',
'.chip-oro{background:', T.oro, ';color:#3a2c05}',
/* 2 · Los seis datos */
'.seis{display:grid;grid-template-columns:repeat(6,1fr);gap:5px}',
'.dato{border:1px solid ', T.borde, ';border-radius:7px;background:', T.suave, ';',
'padding:7px 4px;text-align:center}',
'.dato b{display:block;font-size:15px;font-weight:900;line-height:1.1}',
'.dato span{display:block;font-size:7.6px;font-weight:700;color:', T.tinta, ';margin-top:3px}',
'.dato small{display:block;font-size:6.8px;color:', T.txt3, ';margin-top:1px}',
/* 3 · Oportunidad urbana — aro arriba, lista debajo, nunca superpuestos */
'.oport-cab{display:flex;align-items:center;gap:10px;margin-bottom:6px}',
'.oport-cab .aro{width:19mm;height:19mm}',
'.oport-nivel{display:block;font-size:14px;font-weight:900;line-height:1.1}',
'.oport-est{font-size:11px;color:', T.oro, ';letter-spacing:1.5px}',
'.tbl-oport{width:100%;border-collapse:collapse;font-size:8px}',
'.tbl-oport td{padding:2.5px 0;border-bottom:1px solid ', T.linea, '}',
'.tbl-oport td.pos{width:22px;font-weight:900;color:', T.ok, '}',
'.tbl-oport td.razon{text-align:right;color:', T.txt3, ';font-size:7.4px}',
/* 3 · Cómo leer el informe */
'.leer{display:grid;grid-template-columns:1fr 1fr;gap:4px}',
'.leer div{border:1px solid ', T.borde, ';border-radius:5px;padding:4px 6px;background:', T.suave, '}',
'.leer b{display:block;font-size:7.4px;color:', T.acento, ';font-weight:800}',
'.leer small{display:block;font-size:6.8px;color:', T.txt2, ';line-height:1.3;margin-top:1px}',
/* 4 · Lo más importante */
'.clave{display:grid;grid-template-columns:1.1fr 1.3fr 1.6fr;gap:7px;align-items:stretch;',
'border:1px solid ', T.borde, ';border-radius:7px;padding:8px 10px;background:', T.panel, '}',
'.cl-flujo{margin-bottom:6px}',
'.cl-cab{display:flex;align-items:baseline;justify-content:space-between;gap:6px;margin-bottom:2px}',
'.cl-cab b{font-size:8px;font-weight:900;letter-spacing:.4px;color:', T.cab1, '}',
'.cl-cab span{font-size:7.6px;font-weight:800}',
'.cl-barra{height:7px;border-radius:4px;background:', T.linea, ';overflow:hidden}',
'.cl-barra i{display:block;height:100%;border-radius:4px}',
'.cl-lectura{border-left:2.5px solid ', T.acento, ';background:', T.suave, ';border-radius:4px;padding:6px 8px}',
'.cl-lectura b{display:block;font-size:7.6px;font-weight:900;color:', T.acento, ';letter-spacing:.5px}',
'.cl-lectura p{font-size:8.2px;line-height:1.45;font-weight:700;margin-top:3px}',
'.cl-donde{margin-top:5px;padding-top:4px;border-top:1px solid ', T.borde, '}',
'.cl-donde b{display:block;font-size:7.2px;font-weight:900;color:', T.oro, ';letter-spacing:.4px}',
'.cl-donde p{font-size:7.4px;line-height:1.4;font-weight:600;color:', T.txt2, ';margin-top:2px}',
'.cl-minis{display:grid;grid-template-columns:repeat(2,1fr);gap:5px}',
'.cl-minis div{border:1px solid ', T.borde, ';border-radius:5px;padding:5px 6px;background:', T.suave, '}',
'.cl-minis b{display:block;font-size:7.2px;font-weight:900;color:', T.cab1, ';letter-spacing:.4px}',
'.cl-minis small{display:block;font-size:6.9px;color:', T.txt2, ';line-height:1.35;margin-top:2px}',
/* 5 · Viabilidad en detalle */
'.sub-nivel{font-size:9px;font-weight:800;margin-bottom:2px}',
'.sub-fila{display:flex;align-items:center;gap:7px;margin-top:4px}',
'.sub-fila span{flex:0 0 68px;font-size:7.8px;font-weight:700}',
'.sub-barra{flex:1;height:7px;border-radius:4px;background:', T.linea, ';overflow:hidden}',
'.sub-barra i{display:block;height:100%;border-radius:4px}',
/* El número va en su propia columna: dentro de la barra desaparecía al 100 %. */
'.sub-fila b{flex:0 0 22px;text-align:right;font-size:7.8px;font-weight:800}',
'.sub-resumen{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:7px}',
'.sub-resumen div{border:1px solid ', T.borde, ';border-radius:5px;padding:4px 6px;background:', T.suave, '}',
'.sub-resumen b{display:block;font-size:7px;font-weight:900;letter-spacing:.4px}',
'.sub-resumen span{display:block;font-size:7.4px;color:', T.txt2, ';margin-top:1px}',
'.et-ok{color:', T.ok, '}.et-bad{color:', T.bad, '}',
/* 6 · Qué trae gente a pie */
// Tres columnas: la tabla de lo que suma, las horas con sus hitos, y lo que
// resta. `min-width:0` para que ninguna se niegue a encoger y desborde.
'.gente{display:grid;grid-template-columns:1.5fr 1fr .9fr;gap:6px;align-items:start}',
'.gente>*{min-width:0}',
'.tbl-gente{width:100%;border-collapse:collapse;font-size:8px}',
'.tbl-gente th{background:none;text-align:left;font-size:7.2px;text-transform:uppercase;letter-spacing:.4px;',
'color:', T.cab1, ';padding:3px 4px;border-bottom:1px solid ', T.borde, '}',
'.tbl-gente td{padding:3.5px 4px;border-bottom:1px solid ', T.linea, ';font-weight:700}',
'.tbl-gente td em{display:block;font-style:normal;font-size:6.9px;color:', T.txt3, ';font-weight:600}',
'.tbl-gente th.n,.tbl-gente td.n{text-align:right;width:44px}',
'.hf{display:flex;align-items:center;gap:6px;margin-top:4px}',
'.hf span{flex:0 0 48px;font-size:7.8px;font-weight:700}',
'.hf b{flex:0 0 20px;text-align:right;font-size:7.8px;font-weight:800;color:', T.acento, '}',
'.hito-fila{display:flex;align-items:baseline;justify-content:space-between;gap:6px;',
'padding:2.5px 0;border-bottom:1px solid ', T.linea, ';font-size:7.6px}',
'.hito-fila span{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.hito-fila b{flex:0 0 auto;color:', T.acento, ';font-weight:800}',
'.hito-fila.fuerte{background:rgba(245,185,66,.16);border-radius:4px;padding-left:4px;padding-right:4px;',
'border-bottom-color:', T.oro, '}',
/* Franja de tránsito */
'.transito{display:flex;align-items:center;gap:16px;margin-top:6px;border:1px solid ', T.borde, ';',
'border-radius:7px;padding:7px 12px;background:', T.suave, '}',
'.tr-rot{font-size:8.4px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;color:', T.cab1, ';flex:0 0 auto}',
'.tr-par{flex:0 0 auto;display:flex;align-items:baseline;gap:6px}',
'.tr-par b{font-size:13px;font-weight:900;color:', T.acento, '}',
'.tr-par span{font-size:7.4px;color:', T.txt3, '}',
'.tr-notas{flex:1;min-width:0;text-align:right}',
'.tr-notas small{display:block;font-size:6.6px;color:', T.txt3, ';line-height:1.35}',
/* 7 · Composición */
'.comp-fila{display:flex;align-items:center;gap:7px;margin-top:3.5px}',
'.comp-fila span{flex:0 0 108px;font-size:7.6px;font-weight:700}',
'.comp-barra{flex:1;height:7px;border-radius:4px;background:', T.linea, ';overflow:hidden}',
'.comp-barra i{display:block;height:100%;border-radius:4px}',
'.comp-fila b{flex:0 0 30px;text-align:right;font-size:7.8px;font-weight:800}',
'.comp-fila em{flex:0 0 34px;text-align:right;font-style:normal;font-size:7.2px;color:', T.txt3, '}',
/* 7 · Indicadores */
'.ind-fila{display:flex;align-items:baseline;gap:8px;padding:4px 0;border-bottom:1px solid ', T.linea, '}',
'.ind-fila span{flex:0 0 120px;font-size:7.8px;font-weight:700}',
'.ind-fila b{font-size:8px;font-weight:800}',
'.ind-fila em{margin-left:auto;font-style:normal;font-size:6.8px;color:', T.txt3, ';text-align:right}',
/* 8 · Radios */
'.tbl-radios2{width:100%;border-collapse:collapse;font-size:8.2px}',
'.tbl-radios2 th{background:none;text-align:left;font-size:7.2px;text-transform:uppercase;letter-spacing:.4px;',
'color:', T.cab1, ';padding:4px 6px;border-bottom:1px solid ', T.borde, '}',
'.tbl-radios2 td{padding:5px 6px;border-bottom:1px solid ', T.linea, '}',
'.tbl-radios2 tr.fila-act td{font-weight:900;background:', T.suave, '}',
'.tbl-radios2 td:first-child{font-weight:800}',
/* 9 · Siguiente paso */
'.paso{margin-top:6px;background:', T.cab1, ';color:', T.cabTxt, ';border-radius:5px;',
'padding:6px 10px;text-align:center;font-size:8px;font-weight:800;letter-spacing:.3px}',
/* Rejillas de las tres hojas */
'.fila.tres{grid-template-columns:1fr 1fr 1fr}',
'.fila.dos{grid-template-columns:1fr 1fr}',
'.fila.dos-13{grid-template-columns:1fr 1.3fr}',
'</style></head><body><div id="marco">',

// ══ HOJA 1 · la conclusión y lo que el cliente necesita para decidir ══
'<div class="hoja"><div class="contenido">',

cabecera(titulo, 'Análisis del entorno · URBIS', ubicacionTxt, fecha, 1),

seccion(1, 'Lectura ejecutiva', 'la historia que conviene contar al cliente'),
bloqueEjecutivo(r),

seccion(2, 'Los 6 datos que explican el sitio', ''),
seisDatos(r),

seccion(3, 'Qué está pasando alrededor', 'entorno inmediato y oportunidad'),
'<div class="fila tres">',
  '<div>', bloqueMapa(r, horizontal), '</div>',
  '<div>', bloqueOportunidad(r), '</div>',
  '<div>', bloqueComoLeer(r), '</div>',
'</div>',

seccion(4, 'Lo más importante para el cliente', 'flujo + implicación comercial'),
bloqueClave(r),

pie(1, r, autor),
'</div></div>',

// ══ HOJA 2 · cómo se mueve el entorno y qué lo activa ══
'<div class="hoja"><div class="contenido">',

cabecera(titulo, 'Datos y estadísticas del sector', 'movilidad, actividad y alcance', fecha, 2),

seccion(5, 'Cómo se mueve el entorno', 'del tránsito a la oportunidad'),
'<div class="fila dos-13">',
  '<div>', bloqueViabilidadDetalle(r), '</div>',
  '<div>', bloqueMovilidad(r), '</div>',
'</div>',

seccion(6, 'Qué trae gente a pie y qué se lo lleva', 'lo que suma y lo que resta en el andén'),
bloqueTraeGente(r),
franjaTransito(r),

pie(2, r, autor),
'</div></div>',

// ══ HOJA 3 · dónde está el movimiento, no cuánto ══
// Hoja propia porque los tres mapas necesitan tamaño para leerse: metidos en
// una columna de otra hoja se convierten en tres estampillas de colores.
'<div class="hoja"><div class="contenido">',

cabecera(titulo, 'Mapas de calor de movilidad', 'dónde se concentra el tránsito dentro del radio', fecha, 3),

seccion(7, 'Dónde está el movimiento', 'el mismo cálculo, repartido sobre el terreno'),
bloqueMapaCalor(r),

'<div class="fila dos" style="margin-top:8px">',
  '<div>', bloqueAtraeVehiculo(r), '</div>',
  '<div>', bloqueVocacion(r), '</div>',
'</div>',

pie(3, r, autor),
'</div></div>',

// ══ HOJA 4 · composición, población y la lectura FODA ══
'<div class="hoja"><div class="contenido">',

cabecera(titulo, 'Datos y estadísticas del sector', 'composición, población y lectura FODA', fecha, 4),

seccion(8, 'De qué está hecho el entorno', 'estructura urbana en ' + radioTxt),
'<div class="fila dos">',
  '<div>', bloqueComposicion(r), '</div>',
  '<div>', bloqueIndicadoresFilas(r), '</div>',
'</div>',

seccion(9, 'El entorno según la distancia', 'mismo dato, varios radios'),
bloqueRadios(r),

seccion(10, 'FODA para presentar la decisión', 'qué favorece, qué exige y qué revisar'),
bloqueFodaAncho(r),
'<div class="paso">SIGUIENTE PASO RECOMENDADO · Verificar norma urbanística (POT) y ' +
  'prefactibilidad financiera antes de avanzar a diseño.</div>',

pie(4, r, autor),
'</div></div>',

'</div>',
// Auto-diagramación: ajusta el contenido para LLENAR exactamente una hoja
// (lo encoge si sobra y lo agranda si falta, así no quedan espacios en
// blanco), y en pantalla encaja la hoja completa en el ancho disponible.
'<script>(function(){',
// Cada hoja se ajusta por separado: la 1 suele sobrar espacio (y se agranda
// para llenarla) y la 2 suele ir justa (y se encoge lo necesario).
'function ajustarUna(h){var c=h.querySelector(".contenido");',
'if(!c)return;var disp=h.clientHeight,k=1;',
'for(var i=0;i<18;i++){c.style.width=(100/k)+"%";c.style.transform="scale("+k+")";',
'var vis=c.scrollHeight*k;if(!vis)break;var nk=k*(disp/vis);',
// Piso 0.62: por debajo la letra queda ilegible y, como la hoja recorta lo que
// sobra, el texto se cortaba a media frase. Se prefiere avisar antes que
// entregar una hoja mutilada.
'if(nk>1.5)nk=1.5;if(nk<0.62)nk=0.62;if(Math.abs(nk-k)<0.003){k=nk;break;}k=nk;}',
'c.style.width=(100/k)+"%";c.style.transform="scale("+k+")";',
'for(var g=0;g<10&&c.scrollHeight*k>disp&&k>0.62;g++){k*=0.985;c.style.width=(100/k)+"%";c.style.transform="scale("+k+")";}',
'if(c.scrollHeight*k>disp+2){var av=h.querySelector(".aviso-corte");',
'if(!av){av=document.createElement("div");av.className="aviso-corte";',
'av.style.cssText="position:absolute;left:0;right:0;bottom:0;background:#b91c1c;color:#fff;'+
'font-size:7.5px;font-weight:800;text-align:center;padding:2px 4px;letter-spacing:.3px";',
'av.textContent="Contenido extenso: revise el informe completo en la app.";',
'h.appendChild(av);}}}',
'function ajustarHoja(){var hs=document.querySelectorAll(".hoja");',
'for(var i=0;i<hs.length;i++)ajustarUna(hs[i]);}',
'function ajustarPantalla(){var m=document.getElementById("marco"),h=document.querySelector(".hoja");',
'if(!m||!h)return;m.style.transform="none";m.style.marginLeft="0px";',
'var esc=Math.min(1,(window.innerWidth-16)/h.offsetWidth);',
'm.style.transform="scale("+esc+")";',
'm.style.marginLeft=Math.max(0,(window.innerWidth-16-h.offsetWidth*esc)/2)+"px";',
'document.body.style.height=(m.scrollHeight*esc+16)+"px";}',
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
    const titulo = opciones.titulo || r.meta.proyectoNombre || 'Urbis para Empresas';
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
