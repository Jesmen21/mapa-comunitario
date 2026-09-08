/* URBIS · PANEL DEL ANÁLISIS EDUCATIVO (js/65)
   ─────────────────────────────────────────────────────────────────────────
   Pinta en el modo educativo el mismo análisis que reciben las empresas, con
   los puntos que mapeó el curso. El orden no es decorativo: primero se dice
   SOBRE QUÉ se está analizando (cuántos puntos hay y cuántos supo leer el
   motor), y solo después vienen las cifras. Al revés, un estudiante leería
   "flujo peatonal 18/100" como un hecho del barrio y no como el resultado de
   haber mapeado ocho puntos. */
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const miles = n => Number(n || 0).toLocaleString('es-CO');

  let ultimo = null;

  /* ── Mapa de calor ──────────────────────────────────────────────────────
     El dibujo, la leyenda y la capa sobre el mapa vienen de js/56, que
     comparten los tres módulos que pintan calor. Acá solo se decide dónde
     va y qué pasa al tocarlo. */
  const CAL = () => window.URBIS_CALOR || null;
  let calorMapa = null;          // el controlador sobre el mapa del curso
  function calorEnMapa(){
    if (calorMapa) return calorMapa;
    try {
      if (typeof map !== 'undefined' && map && CAL()) calorMapa = CAL().enMapa(map);
    } catch(e) { calorMapa = null; }
    return calorMapa;
  }

  // ── Bloques ─────────────────────────────────────────────────────────────
  function bloqueBase(r){
    const e = r.edu, s = r.stats;
    const faltan = Object.keys(e.sinTraducir || {});
    const pocos = e.leidos < 25;
    return '<div class="edu-base' + (pocos ? ' flojo' : '') + '">' +
      '<b>' + (pocos ? '⚠️ ' : '✅ ') + 'Este análisis se hizo con ' + miles(e.leidos) +
        (e.leidos === 1 ? ' punto' : ' puntos') + ' que ustedes mapearon.</b>' +
      '<p>' + (e.puntosDelCurso > e.leidos
        ? 'Dentro del radio hay ' + miles(e.puntosDelCurso) + ' puntos en total; el análisis pudo ' +
          'leer ' + miles(e.leidos) + '. El resto son reportes de situaciones (un hueco, un retén) ' +
          'que no son un uso del suelo, así que no cuentan como actividad del sector.'
        : 'Todos los puntos del radio entraron al análisis.') +
      (pocos
        ? ' <b>Con tan pocos puntos el resultado es un ejercicio, no un diagnóstico:</b> el sector ' +
          'seguramente tiene mucho más de lo que alcanzaron a mapear. Mapeen más cuadras y ' +
          'vuelvan a analizar para ver cómo cambian las cifras — ese cambio es el aprendizaje.'
        : ' Suficientes puntos para que las cifras empiecen a ser estables.') + '</p>' +
      (faltan.length
        ? '<details class="edu-faltan"><summary>' + faltan.length +
          (faltan.length === 1 ? ' etiqueta que el análisis no supo traducir' :
                                 ' etiquetas que el análisis no supo traducir') + '</summary>' +
          '<p>No es un error de ustedes: es que la traducción de la Matriz de Usos todavía no ' +
          'cubre estos casos. Anótenlos y se agregan.</p><ul>' +
          faltan.slice(0, 12).map(k => '<li>' + esc(k) + ' <em>×' +
            e.sinTraducir[k] + '</em></li>').join('') + '</ul></details>'
        : '') +
      '<p class="edu-nota">La población NO depende de lo que mapearon: viene del censo del DANE ' +
      'y está completa siempre. Es la mitad del análisis que no se puede equivocar por falta de trabajo de campo.</p>' +
      '</div>';
  }

  /* ── Los sectores que el curso ya levantó ──────────────────────────────
     Un «18/100 de flujo a pie» solo no le dice nada a un estudiante: no
     sabe si 18 es poco o es lo normal en su ciudad. Comparado con los
     sectores que él mismo ya analizó, sí. Las fichas del modo educativo
     viven en `pcr_fichas_v1` (js/68) con el `stats` aligerado, que ya trae
     todo lo que estos cuatro KPI necesitan.

     La cuenta —y el mínimo de tres para comparar— está en js/57, compartida
     con el análisis de empresas: la misma vara para los dos. */
  const FICHAS_KEY = 'pcr_fichas_v1';

  function fichasDelCurso(){
    try { const f = JSON.parse(localStorage.getItem(FICHAS_KEY) || '[]'); return Array.isArray(f) ? f : []; }
    catch(e) { return []; }
  }

  function refEdu(saca, actual){
    if (!window.URBIS_REFERENCIA) return '';
    const otros = [];
    fichasDelCurso().forEach(fi => {
      let v;
      try { v = saca(fi.stats || {}); } catch(e) { v = null; }
      if (typeof v === 'number' && isFinite(v)) otros.push(v);
    });
    return window.URBIS_REFERENCIA.html(otros, actual);
  }

  /* El texto de la referencia de cada cifra, sin el dibujo: el informe lo
     imprime como una línea y no como un riel. Mismas cuentas que la pantalla
     —js/57, mínimo de tres para comparar— porque es la misma vara. */
  function referenciasDelCurso(r){
    const R = window.URBIS_REFERENCIA;
    if (!R || !r) return null;
    const s = r.stats || {}, f = (s.movilidad && s.movilidad.flujo) || {};
    const de = (saca, actual) => {
      const otros = [];
      fichasDelCurso().forEach(fi => {
        let v; try { v = saca(fi.stats || {}); } catch(e) { v = null; }
        if (typeof v === 'number' && isFinite(v)) otros.push(v);
      });
      const c = R.calcular(otros, actual);
      return c ? c.texto : '';
    };
    const flujoDe = k => x => ((x.movilidad || {}).flujo || {})[k];
    const out = {
      Habitantes: de(x => x.poblacionEstimada, s.poblacionEstimada),
      'Flujo peatonal': de(flujoDe('peatonal'), f.peatonal),
      'Flujo vehicular': de(flujoDe('vehicular'), f.vehicular),
      'Usos identificados': de(x => x.total, s.total)
    };
    return Object.keys(out).some(k => out[k]) ? out : null;
  }

  function kpis(r){
    const s = r.stats, f = (s.movilidad && s.movilidad.flujo) || {};
    const caja = (n, t, sub, ref) => '<div class="edu-kpi"><b>' + n + '</b><span>' + t + '</span>' +
      (sub ? '<em>' + esc(sub) + '</em>' : '') + (ref || '') + '</div>';
    const flujoDe = k => x => ((x.movilidad || {}).flujo || {})[k];
    return '<div class="edu-kpis">' +
      caja(miles(s.poblacionEstimada), 'Habitantes',
           s.poblacionProyectada ? 'DANE ' + s.censoAnio + ' → ' + s.anioProyeccion
                                 : (s.poblacionEsCensal ? 'DANE ' + s.censoAnio : 'estimado'),
           refEdu(x => x.poblacionEstimada, s.poblacionEstimada)) +
      caja((f.peatonal || 0) + '/100', 'Flujo a pie', f.nivelPeatonal || '—',
           refEdu(flujoDe('peatonal'), f.peatonal)) +
      caja((f.vehicular || 0) + '/100', 'Flujo vehicular', f.nivelVehicular || '—',
           refEdu(flujoDe('vehicular'), f.vehicular)) +
      caja(miles(s.total), 'Usos leídos', 'en el radio',
           refEdu(x => x.total, s.total)) +
      '</div>';
  }

  /* ── El entorno según la distancia ─────────────────────────────────────
     El motor ya devolvía estos anillos en el modo educativo; simplemente
     nadie los pintaba. El dibujo es el mismo de js/58 que usa el análisis
     de empresas, y la tabla va debajo con los números exactos.

     Para un curso esta es de las lecturas más útiles del módulo: dice si el
     sitio que mapearon es un núcleo o un borde, y eso no se ve caminando. */
  function bloqueAnillos(r){
    const m = r.multiRadio;
    if (!m || !m.anillos || m.anillos.length < 2 || !window.URBIS_ANILLOS) return '';
    const etq = v => v >= 1000 ? (v / 1000) + ' km' : v + ' m';
    return '<div class="edu-caja">' +
      '<h4>🎯 El entorno según la distancia</h4>' +
      window.URBIS_ANILLOS.grafico(m) +
      '<table class="edu-tbl-radios"><tr><th>Radio</th><th>Usos</th><th>Usos/ha</th>' +
      '<th>Comercio</th><th>Equip.</th><th>Hab. est.</th></tr>' +
      m.anillos.map(a => '<tr' + (a.esAnalizado ? ' class="act"' : '') + '>' +
        '<td>' + etq(a.radioM) + '</td><td>' + miles(a.total) + '</td>' +
        '<td>' + a.densidadPorHa + '</td><td>' + miles(a.comercio) + '</td>' +
        '<td>' + miles(a.equipamientos) + '</td><td>' + miles(a.poblacionEstimada) + '</td></tr>').join('') +
      '</table>' +
      (m.lectura ? '<p class="edu-nota">' + esc(m.lectura) + '</p>' : '') +
      '</div>';
  }

  function bloquePoblacion(r){
    const s = r.stats;
    if (!s.poblacionProyectada || !(s.serieProyeccion || []).length) {
      return s.poblacionEsCensal
        ? '<p class="edu-nota">Censo DANE ' + s.censoAnio + ': ' + miles(s.poblacionCenso) +
          ' habitantes. Sin proyección para este municipio, así que se usa el conteo tal cual.</p>'
        : '';
    }
    const serie = s.serieProyeccion;
    const min = Math.min.apply(null, serie.map(x => x.poblacion));
    const max = Math.max.apply(null, serie.map(x => x.poblacion));
    const rango = Math.max(1, max - min);
    const W = 100, H = 32;
    const px = i => (i / (serie.length - 1)) * W;
    const py = v => H - ((v - min) / rango) * (H - 4) - 2;
    const iFut = serie.findIndex(x => x.futuro);
    const corte = iFut > 0 ? iFut - 1 : serie.length - 1;
    const d = (arr, desde) => arr.map((x, i) => (i ? 'L' : 'M') +
      px(i + (desde || 0)).toFixed(2) + ' ' + py(x.poblacion).toFixed(2)).join(' ');
    const hasta = d(serie.slice(0, corte + 1));
    const todo = d(serie);
    return '<div class="edu-caja">' +
      '<h4>📈 Cómo ha crecido la población</h4>' +
      '<div class="edu-pobl">' +
        '<div><small>Censo ' + s.censoAnio + '</small><b>' + miles(s.poblacionCenso) + '</b><em>contado</em></div>' +
        '<div class="fl">→</div>' +
        '<div><small>' + s.anioProyeccion + '</small><b class="ac">' + miles(s.poblacionProyectada) + '</b><em>proyectado</em></div>' +
        '<div class="delta">+' + s.crecimientoPct + '%</div>' +
      '</div>' +
      '<svg class="edu-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
        '<path d="' + hasta + ' L' + px(corte).toFixed(2) + ' ' + H + ' L0 ' + H + ' Z" fill="rgba(34,211,238,.16)"/>' +
        '<path d="' + todo + '" fill="none" stroke="#22d3ee" stroke-width="1" stroke-dasharray="3 2" ' +
          'opacity=".55" vector-effect="non-scaling-stroke"/>' +
        '<path d="' + hasta + '" fill="none" stroke="#22d3ee" stroke-width="1.2" vector-effect="non-scaling-stroke"/>' +
      '</svg>' +
      '<div class="edu-eje"><span>' + serie[0].anio + '</span><span>' + serie[corte].anio +
        '</span><span>' + serie[serie.length - 1].anio + '</span></div>' +
      '<p class="edu-nota">El censo es de ' + s.censoAnio + ' y se trae a hoy con la tasa de ' +
      'crecimiento del municipio (' + (s.tasaAnualDane * 100).toFixed(2) + '% al año). ' +
      esc(s.advertenciaProyeccion || '') + '</p>' +
      '</div>';
  }

  // El estado del andén no suma ni resta peatones: multiplica. Se muestra
  // aparte de los generadores por eso mismo — mezclarlo en la lista de "qué
  // mueve gente" haría creer que construir acera crea tránsito. Y si el curso
  // no lo mapeó, se dice: un vacío de datos no es un andén bueno.
  function bloqueAnden(f){
    const c = f.caminabilidad;
    if (!c) return '';
    if (!c.muestras) {
      return '<h4 class="sep">🦶 Se puede caminar?</h4>' +
        '<p class="edu-nota">Nadie mapeó el estado del andén en este radio, así que el ' +
        'cálculo lo dio por neutro. Mapear andenes (continuo, interrumpido, sin andén) ' +
        'es de lo que más cambia este número.</p>';
    }
    const pct = Math.round((c.factor - 1) * 100);
    const signo = pct > 0 ? '+' + pct : String(pct);
    return '<h4 class="sep">🦶 Se puede caminar?</h4>' +
      '<ul class="edu-lista">' +
        '<li><span>Andén continuo</span><small>×' + c.continuo + '</small></li>' +
        '<li><span>Andén interrumpido</span><small>×' + c.interrumpido + '</small></li>' +
        '<li><span>Sin andén / bordillo</span><small>×' + c.sinAnden + '</small></li>' +
        (c.rampas ? '<li><span>Rampas de acceso</span><small>×' + c.rampas + '</small></li>' : '') +
      '</ul>' +
      '<p class="edu-nota">Caminabilidad <b>' + esc(c.nivel) + '</b> sobre ' + c.muestras +
      ' observación' + (c.muestras === 1 ? '' : 'es') + ': ajusta el flujo peatonal en <b>' +
      signo + '%</b>.' +
      (c.fiable ? '' : ' Son pocas observaciones para el radio — conviene mapear más andén ' +
        'antes de sacar conclusiones.') + '</p>';
  }

  function bloqueFlujo(r){
    const f = (r.stats.movilidad && r.stats.movilidad.flujo) || {};
    // Sin flujo no hay franjas, pero el horario declarado sigue existiendo:
    // son datos distintos y de fuentes distintas.
    if (!f.franjas) {
      const h = bloqueHorarios(r);
      return h ? '<div class="edu-caja">' + h + '</div>' : '';
    }
    const hora = (etq, v) => '<div class="edu-hora"><small>' + etq + '</small>' +
      '<i><b style="width:' + (v || 0) + '%"></b></i><span>' + (v || 0) + '</span></div>';
    const gen = (f.generadores || []).slice(0, 6);
    const pen = (f.penalizadores || []).slice(0, 3);
    return '<div class="edu-caja">' +
      '<h4>🚶 Qué mueve gente por aquí</h4>' +
      (gen.length
        ? '<ul class="edu-lista">' + gen.map(g => '<li><span>' + esc(g.nombre) + '</span>' +
            '<small>×' + g.n + '</small><b>+' + g.aporte + '</b></li>').join('') + '</ul>'
        : '<p class="edu-nota">Con lo mapeado no se identifica nada que atraiga peatones.</p>') +
      (pen.length
        ? '<h4 class="sep">🚧 Y qué rompe el recorrido a pie</h4>' +
          '<ul class="edu-lista resta">' + pen.map(p => '<li><span>' + esc(p.nombre) +
            ' · ' + esc(p.motivo) + '</span><b>−' + p.resta + '</b></li>').join('') + '</ul>'
        : '') +
      // Ir a mirar cambió el resultado: eso es exactamente lo que el ejercicio
      // debe enseñar, así que se dice en vez de aplicarlo en silencio.
      (f.frentesCorregidos
        ? '<p class="edu-nota">👀 En ' + f.frentesCorregidos + ' caso' +
          (f.frentesCorregidos === 1 ? '' : 's') + ' la categoría suponía fachada ciega y ' +
          'ustedes vieron vitrina: el descuento se redujo con lo que observaron en campo.</p>'
        : '') +
      (f.comercioSinFrente
        ? '<p class="edu-nota">🏢 ' + f.comercioSinFrente + ' comercio' +
          (f.comercioSinFrente === 1 ? '' : 's') + ' con la planta baja cerrada: ' +
          (f.comercioSinFrente === 1 ? 'atrae' : 'atraen') + ' gente, pero no ' +
          (f.comercioSinFrente === 1 ? 'hace' : 'hacen') + ' calle. No ' +
          (f.comercioSinFrente === 1 ? 'cuenta' : 'cuentan') + ' como vitrina.</p>'
        : '') +
      bloqueAnden(f) +
      '<h4 class="sep">🕐 A qué horas · <em>estimado por tipo de uso</em></h4>' +
      '<div class="edu-horas">' + hora('Mañana', f.franjas.manana) + hora('Mediodía', f.franjas.mediodia) +
        hora('Tarde', f.franjas.tarde) + hora('Noche', f.franjas.noche) + '</div>' +
      (f.vidaNocturna ? '<p class="edu-nota">🌙 La zona sigue viva de noche.</p>' : '') +
      bloqueHorarios(r) +
      '</div>';
  }

  /* ── El horario declarado ───────────────────────────────────────────────
     Las barras de arriba son una ESTIMACIÓN: el motor supone que un bar pesa
     de noche y una papelería de día. Esto de acá es otra cosa —lo que dice
     el letrero, leído de `opening_hours`— y va justo debajo a propósito.

     Que las dos lecturas convivan es la mitad del ejercicio: cuando no
     coinciden, la pregunta «¿por qué el sector parece nocturno por sus usos
     y cierra a las seis?» es mejor que cualquiera de las dos cifras sueltas.

     La cobertura va PRIMERO y en grande. Con seis locales de doscientos
     declarando horario, «el 50 % abre de noche» son tres locales, y sin la
     cobertura al lado esa frase miente sin decir una sola palabra falsa. */
  function bloqueHorarios(r){
    const h = (r.stats || {}).horarios;
    if (!h || !h.total) return '';
    const fila = (etq, n, pct) => '<li><span>' + etq + '</span>' +
      '<i><b style="width:' + (pct || 0) + '%"></b></i>' +
      '<em>' + n + '</em><small>' + (pct || 0) + '%</small></li>';
    if (!h.conDato) {
      return '<h4 class="sep">🌙 Y según el letrero</h4>' +
        '<p class="edu-nota">' + esc(h.lectura) + '</p>';
    }
    return '<h4 class="sep">🌙 Y según el letrero · <em>declarado en el mapa</em></h4>' +
      '<p class="edu-cobertura"><b>' + h.conDato + ' de ' + h.total + '</b> usos declaran horario · ' +
        h.cobertura + ' % de cobertura' + (h.suficiente ? '' : ' — muy poco para concluir') + '</p>' +
      '<ul class="edu-horarios">' +
        fila('Abren después de las 8 p.m.', h.deNoche, h.pct.deNoche) +
        fila('Abren sábado', h.sabado, h.pct.sabado) +
        fila('Abren domingo', h.domingo, h.pct.domingo) +
        fila('Solo de lunes a viernes', h.soloEntreSemana, h.pct.soloEntreSemana) +
        (h.siempre ? fila('Abren 24 horas', h.siempre, h.pct.siempre) : '') +
      '</ul>' +
      (h.siempre && h.ejemplos24h.length
        ? '<p class="edu-nota">24 h: ' + h.ejemplos24h.map(esc).join(' · ') + '</p>' : '') +
      '<p class="edu-nota">' + esc(h.lectura) + '</p>' +
      (h.notaIlegible ? '<p class="edu-nota">' + esc(h.notaIlegible) + '</p>' : '') +
      (h.sinDato
        ? '<p class="edu-nota">Faltan ' + h.sinDato + ' por anotar. El horario se levanta en campo leyendo el letrero, ' +
          'y es de lo que más rápido cambia la lectura de un sector.</p>'
        : '');
  }

  function bloqueCalor(r){
    const mc = (r.stats.movilidad && r.stats.movilidad.flujo || {}).mapaCalor;
    const K = CAL();
    if (!mc || !K) return '';
    return '<div class="edu-caja" id="edu-calor">' +
      '<h4>🔥 Dónde está el movimiento</h4>' +
      '<p class="edu-nota">Toquen una capa para verla sobre el mapa, encima de las calles que ' +
        'caminaron. El punto grande es el sitio más activo de esa capa.</p>' +
      '<div class="edu-calores">' + K.miniaturas(mc, 'edu-calor', 'dia') + '</div>' +
      K.botones('dia') +
      K.leyenda() +
      '<p class="edu-nota">La cruz es el punto que analizaron. Cada capa se colorea contra su ' +
      'propio máximo: dice <b>dónde</b> se concentra el movimiento, no cuánto. ' +
      'El cálculo suma los usos que atraen gente y resta los que rompen el recorrido ' +
      '(bodegas, lotes, locales cerrados).' +
      (mc.fiable ? '' : ' Con pocos puntos es apenas indicativo: conviene contrastarlo caminando.') + '</p>' +
      '</div>';
  }

  /* Pone (o quita) una capa sobre el mapa del curso y marca en el panel
     cuál está puesta. `id` vacío quita. Se llama al terminar el análisis
     —con la capa de día— y con cada toque. */
  function mostrarCalor(id, encuadrar){
    const mc = ultimo && ultimo.stats.movilidad && ultimo.stats.movilidad.flujo &&
               ultimo.stats.movilidad.flujo.mapaCalor;
    const ctl = calorEnMapa();
    if (!ctl) return false;
    let puesta = false;
    if (id && mc) puesta = ctl.mostrar(mc, id, { encuadrar: encuadrar === undefined ? 'auto' : encuadrar });
    else ctl.quitar();
    const act = puesta ? id : '';
    const caja = $('edu-calor');
    if (caja) {
      caja.querySelectorAll('[data-capa]').forEach(el => {
        const es = !!act && el.getAttribute('data-capa') === act;
        el.classList.toggle('act', es);
        if (el.tagName === 'BUTTON' && el.getAttribute('data-capa') !== '') el.setAttribute('aria-pressed', es ? 'true' : 'false');
      });
      const q = caja.querySelector('.urb-calor-botones .quitar');
      if (q) q.hidden = !act;
    }
    return puesta;
  }

  // ── Antigüedad del tejido construido ──────────────────────────────────
  // Esto NO es un diagnóstico estructural y el bloque lo dice con todas las
  // letras. Un curso contando fachadas desde la acera no puede evaluar una
  // estructura, y dejar creer que sí sería el peor error que este módulo podría
  // enseñar. Lo que sí hace, y es útil, es señalar qué construcciones merecen
  // que alguien vaya a mirarlas en serio.
  function bloqueEdificacion(r){
    const e = (r.edu || {}).edificacion;
    if (!e || !e.total) return '';
    const fila = (etq, n, tot) => '<li><span>' + esc(etq) + '</span>' +
      '<i><b style="width:' + (tot ? Math.round(100 * n / tot) : 0) + '%"></b></i>' +
      '<em>' + n + '</em></li>';
    const epocas = Object.keys(e.porEpoca).sort((a, b) => e.porEpoca[b] - e.porEpoca[a]);
    return '<div class="edu-caja">' +
      '<h4>🏚️ De cuándo es lo construido</h4>' +
      (epocas.length
        ? '<ul class="edu-barras">' +
          epocas.map(k => fila(k, e.porEpoca[k], e.conEpoca)).join('') + '</ul>'
        : '<p class="edu-nota">Nadie registró la época de los edificios que mapearon.</p>') +
      (e.patrimonio
        ? '<p class="edu-nota">🏛️ ' + e.patrimonio + ' edificación' +
          (e.patrimonio === 1 ? '' : 'es') + ' anterior' + (e.patrimonio === 1 ? '' : 'es') +
          ' a 1950: posible patrimonio, conviene mirarlo antes de que se pierda.</p>'
        : '') +
      (e.evaluables
        ? '<h4 class="sep">⚠️ Cuáles merecen una revisión</h4>' +
          '<ul class="edu-barras">' +
            fila('Vulnerabilidad potencial alta', e.alta, e.evaluables) +
            fila('Media', e.media, e.evaluables) +
            fila('Baja', e.baja, e.evaluables) +
          '</ul>' +
          '<p class="edu-nota"><b>Esto no es un diagnóstico estructural.</b> Es el cruce ' +
          'de material y época sobre ' + e.evaluables + ' edificación' +
          (e.evaluables === 1 ? '' : 'es') + ' con los dos datos completos: solo dice ' +
          'cuáles ameritan que las mire un ingeniero. El primer código sismo resistente ' +
          'colombiano es de 1984, y aquí hay ' + e.anteriores1984 + ' construcción' +
          (e.anteriores1984 === 1 ? '' : 'es') + ' anterior' +
          (e.anteriores1984 === 1 ? '' : 'es') + ' a esa fecha.</p>'
        : '<p class="edu-nota">Para estimar vulnerabilidad hacen falta material Y época ' +
          'en el mismo edificio. Con uno solo no se puede decir nada, y media evaluación ' +
          'sería una cifra que parece saber algo sin saberlo.</p>') +
      // Los límites que el propio curso declaró. Se muestran porque un "no se
      // sabe" honesto vale más que una casilla rellenada a ojo, y porque los
      // "otro" son la lista de lo que falta en el vocabulario.
      (e.noSeSabe || e.otros
        ? '<p class="edu-nota">📋 ' +
          (e.noSeSabe ? e.noSeSabe + ' dato' + (e.noSeSabe === 1 ? '' : 's') +
            ' marcado' + (e.noSeSabe === 1 ? '' : 's') + ' como «no se sabe»' : '') +
          (e.noSeSabe && e.otros ? ' y ' : '') +
          (e.otros ? e.otros + ' como «otro»' : '') +
          '. No cuentan como observación en ningún cálculo — es lo correcto: ' +
          'marcar «lo más parecido» para salir del paso habría metido un dato ' +
          'falso indistinguible de uno bueno.' +
          (e.textosOtro && e.textosOtro.length
            ? ' Lo que no cabía en la lista: ' +
              e.textosOtro.slice(0, 6).map(esc).join(' · ') + '.'
            : '') +
          '</p>'
        : '') +
      '</div>';
  }

  function bloqueComposicion(r){
    const s = r.stats;
    const rub = (s.rubros || []).slice(0, 8);
    if (!rub.length) return '';
    const max = rub[0].n || 1;
    const c = (r.indicadores && r.indicadores.comercio) || {};
    const v = c.vocacion || {};
    return '<div class="edu-caja">' +
      '<h4>🧩 De qué está hecho el sector</h4>' +
      '<ul class="edu-barras">' + rub.map(x =>
        '<li><span>' + esc(x.icono + ' ' + x.nombre) + '</span>' +
        '<i><b style="width:' + Math.round(100 * x.n / max) + '%"></b></i>' +
        '<em>' + x.n + '</em></li>').join('') + '</ul>' +
      (v.nombre
        ? '<p class="edu-voc"><b>' + esc(v.nombre) + '</b> · ' + v.share + '% de la oferta<br>' +
          '<span>' + esc(v.lectura || '') + '</span></p>'
        : '') +
      '</div>';
  }

  function bloqueOportunidades(r){
    const lista = ((r.indicadores || {}).oportunidades || {}).lista || [];
    if (!lista.length) return '';
    return '<div class="edu-caja">' +
      '<h4>💡 Qué le podría faltar al sector</h4>' +
      '<ul class="edu-opor">' + lista.map(o =>
        '<li><b>' + esc(o.nombre) + '</b><span>' + esc(o.texto) + '</span></li>').join('') + '</ul>' +
      '</div>';
  }

  /* El FODA del motor está escrito para quien va a invertir: los hallazgos
     valen igual en un taller, el idioma no. `fodaEdu` (js/64) lo reescribe
     sin tocar ni un número ni un juicio. La nota lo dice en pantalla: un
     texto traducido que no avisa de que lo es se lee como original. */
  function bloqueFoda(r){
    const f = (window.URBIS_EDU && window.URBIS_EDU.fodaEdu) ? window.URBIS_EDU.fodaEdu(r.foda) : (r.foda || {});
    const col = (k, t, ico) => {
      const items = f[k] || [];
      if (!items.length) return '';
      return '<div class="edu-foda-col"><h5>' + ico + ' ' + t + '</h5><ul>' +
        items.slice(0, 4).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
    };
    const html = col('fortalezas','Fortalezas','💪') + col('debilidades','Debilidades','⚠️') +
                 col('oportunidades','Oportunidades','🚀') + col('riesgos','Riesgos','🛑');
    if (!html) return '';
    return '<div class="edu-caja"><h4>🧭 Lectura FODA del sector</h4>' +
      '<div class="edu-foda">' + html + '</div>' +
      '<p class="edu-nota">El análisis lo escribe midiendo el sector para quien va a invertir. ' +
      'Acá está dicho para un taller: mismos hallazgos y mismos números, otro idioma.</p></div>';
  }

  /* ── Qué proyecto pediría este sector ─────────────────────────────────
     El paso que faltaba entre el diagnóstico y el tablero. Cada idea llega
     de js/64 con las tres partes juntas —la medida, el encargo y qué ir a
     comprobar— y acá se pintan las tres: una idea sin su medida es una
     ocurrencia, y sin el trabajo de campo que la puede tumbar es una
     conclusión que el análisis no tiene con qué sostener. */
  function bloqueIdeas(r){
    if (!(window.URBIS_EDU && window.URBIS_EDU.ideasDeDiseno)) return '';
    const d = window.URBIS_EDU.ideasDeDiseno(r);
    const lista = d.lista.map(i =>
      '<li><b>' + esc(i.ico) + ' ' + esc(i.t) + '</b>' +
      '<em>' + esc(i.porque) + '</em>' +
      '<span>' + esc(i.disena) + '</span>' +
      '<small>👟 Antes de creerle: ' + esc(i.campo) + '</small></li>').join('');
    const avisos = [];
    if (d.esperandoContexto) {
      avisos.push(d.esperandoContexto + (d.esperandoContexto === 1 ? ' idea más sale' : ' ideas más salen') +
        ' del contexto del sector. Consúltenlo arriba y vuelvan a analizar.');
    }
    if (d.pocosPuntos) {
      avisos.push('Con tan pocos puntos mapeados, que una carencia no aparezca acá no significa que el sector no la tenga: ' +
        'significa que todavía no se ve.');
    }
    return '<div class="edu-caja edu-ideas" id="edu-ideas"><h4>🎯 Qué proyecto pediría este sector</h4>' +
      '<p class="edu-nota">' + esc(d.nota) + '</p>' +
      (lista ? '<ul class="edu-ideas-lista">' + lista + '</ul>'
             : '<p class="edu-nota">Ninguna de las carencias que este análisis sabe medir aparece en el radio. ' +
               'No quiere decir que el sector no tenga ninguna: quiere decir que hay que ir a buscarla caminando.</p>') +
      (avisos.length ? '<p class="edu-nota">' + avisos.map(esc).join(' ') + '</p>' : '') +
      '</div>';
  }

  /* ── La lectura del curso ─────────────────────────────────────────────
     Una caja plegada debajo de cada bloque, con la pregunta que lo abre. Se
     guarda mientras se escribe, por centro y radio, para que sobreviva a
     «volver a analizar»: si mapear más borrara lo escrito, nadie escribiría
     hasta el final, y al final es cuando ya se olvidó lo que se vio. */
  const LECTURAS_KEY = 'edu_lecturas_v1';
  let claveLecturas = '';
  function claveDe(centro, radioM){
    return (centro ? centro.lat.toFixed(4) + ',' + centro.lng.toFixed(4) : '?') + '|' + radioM;
  }
  function leerLecturasGuardadas(){
    try { return JSON.parse(localStorage.getItem(LECTURAS_KEY) || '{}') || {}; } catch(e) { return {}; }
  }
  function lecturasDe(clave){
    return (leerLecturasGuardadas()[clave] || {}).textos || {};
  }
  function guardarLectura(clave, id, texto){
    try {
      const todo = leerLecturasGuardadas();
      const reg = todo[clave] || { textos: {} };
      reg.textos[id] = texto;
      reg.ts = new Date().toISOString();
      todo[clave] = reg;
      localStorage.setItem(LECTURAS_KEY, JSON.stringify(todo));
    } catch(e) {}
  }
  function lecturaDef(id){
    return ((window.URBIS_EDU || {}).LECTURAS || []).find(l => l.id === id) || { id, t: id, p: '' };
  }
  function cajaLectura(id, previas){
    const L = lecturaDef(id), texto = (previas || {})[id] || '';
    return '<details class="edu-lectura"' + (texto ? ' open' : '') + '>' +
      '<summary>✍️ Su lectura · <em>' + esc(L.t) + '</em>' + (texto ? ' <b>✓</b>' : '') + '</summary>' +
      '<p class="edu-nota">' + esc(L.p) + '</p>' +
      '<textarea data-lectura="' + esc(id) + '" rows="3" placeholder="Escriban acá lo que concluyen. Se guarda solo.">' +
        esc(texto) + '</textarea></details>';
  }
  // Envuelve un bloque con su caja de lectura debajo. Si el bloque no salió
  // (sin datos), la caja tampoco: no se pregunta por lo que no se mostró.
  function conLectura(html, id, previas){
    return html ? html + cajaLectura(id, previas) : '';
  }
  function bloqueConclusion(previas){
    return '<div class="edu-caja edu-conclusion" id="edu-conclusion">' +
      '<h4>✍️ Conclusión del grupo</h4>' +
      '<p class="edu-nota">Lo que el análisis no puede escribir por ustedes. Va de primero en el informe.</p>' +
      '<textarea data-lectura="general" rows="5" placeholder="' + esc(lecturaDef('general').p) + '">' +
        esc((previas || {}).general || '') + '</textarea>' +
      '</div>';
  }
  /* Lo escrito ahora mismo, leído de las cajas: es lo que viaja al informe. */
  function lecturasActuales(){
    const cont = $('edu-analisis-salida'), out = {};
    if (!cont) return out;
    cont.querySelectorAll('textarea[data-lectura]').forEach(t => {
      const v = (t.value || '').trim();
      if (v) out[t.getAttribute('data-lectura')] = v;
    });
    return out;
  }
  function engancharLecturas(cont){
    // Un temporizador POR caja: con uno solo, escribir en dos cajas seguidas
    // cancelaba el guardado de la primera.
    const timers = {};
    cont.addEventListener('input', ev => {
      const ta = ev.target.closest('textarea[data-lectura]');
      if (!ta) return;
      const id = ta.getAttribute('data-lectura'), v = ta.value;
      const sum = ta.closest('details') && ta.closest('details').querySelector('summary b');
      if (ta.closest('details')) {
        if (v.trim() && !sum) ta.closest('details').querySelector('summary').insertAdjacentHTML('beforeend', ' <b>✓</b>');
        if (!v.trim() && sum) sum.remove();
      }
      clearTimeout(timers[id]);
      timers[id] = setTimeout(() => guardarLectura(claveLecturas, id, v), 400);
      if (ultimo) ultimo.lecturas = lecturasActuales();
    });
  }

  /* ── Antes y después ─────────────────────────────────────────────────
     El resumen del análisis anterior del mismo centro y radio se guarda
     aparte de las lecturas: es poco, y compararlo es lo que cierra el ciclo
     que el módulo propone («mapeen más y vuelvan a analizar»). */
  const PREVIOS_KEY = 'edu_analisis_previos_v1';
  function leerPrevios(){
    try { return JSON.parse(localStorage.getItem(PREVIOS_KEY) || '{}') || {}; } catch(e) { return {}; }
  }
  function previoDe(clave){ return leerPrevios()[clave] || null; }
  function guardarPrevio(clave, resumen){
    try { const t = leerPrevios(); t[clave] = resumen; localStorage.setItem(PREVIOS_KEY, JSON.stringify(t)); } catch(e) {}
  }
  function bloqueCambios(c){
    if (!c) return '';
    const fecha = c.desde ? new Date(c.desde).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const filas = c.lista.map(x =>
      '<li class="' + (x.mejora ? 'mas' : 'menos') + '"><span>' + esc(x.t) + '</span>' +
      '<small>' + esc(x.antes) + '</small><i>→</i><b>' + esc(x.ahora) + '</b><em>' + esc(x.delta) + '</em></li>').join('');
    return '<div class="edu-caja edu-cambios' + (c.lista.length ? '' : ' quieto') + '" id="edu-cambios">' +
      '<h4>🔁 Qué cambió desde la vez anterior' + (fecha ? ' <em>· ' + esc(fecha) + '</em>' : '') + '</h4>' +
      '<p class="edu-cambios-lectura">' + esc(c.lectura) + '</p>' +
      (filas ? '<ul class="edu-cambios-lista">' + filas + '</ul>' : '') +
      '<p class="edu-nota">' + esc(c.notaPoblacion) + '</p>' +
      '</div>';
  }

  /* ── Comparar con otro sector ─────────────────────────────────────────
     Los candidatos: las fichas que el curso guardó (pcr_fichas_v1) y los
     análisis anteriores de OTROS centros (edu_analisis_previos_v1). El
     mismo centro no se ofrece: para eso está «qué cambió». */
  function candidatosComparar(){
    const out = [];
    fichasDelCurso().forEach(f => {
      if (f && f.stats) out.push({ id: 'ficha:' + (f.id || f.nombre), nombre: f.nombre || 'Sector sin nombre', ts: f.ts, origen: 'ficha', datos: f });
    });
    const previos = leerPrevios();
    Object.keys(previos).forEach(k => {
      if (k === claveLecturas) return;
      const r = previos[k];
      const nombre = (r && r.nombre) || ('Análisis en ' + k.replace('|', ' · ') + ' m');
      out.push({ id: 'previo:' + k, nombre, ts: r && r.ts, origen: 'previo', datos: Object.assign({ nombre, clave: k }, r) });
    });
    return out;
  }
  function bloqueComparar(){
    const c = candidatosComparar();
    return '<div class="edu-caja" id="edu-comparar"><h4>⚖️ Comparar con otro sector</h4>' +
      (c.length
        ? '<p class="edu-nota">Este sector, al lado de uno que el curso ya levantó. Se comparan densidad y flujo, que no dependen del tamaño del radio.</p>' +
          '<select id="edu-comparar-sel"><option value="">Elegir un sector…</option>' +
            c.map(x => '<option value="' + esc(x.id) + '">' + esc(x.nombre) + (x.ts ? ' · ' + new Date(x.ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '') +
                       (x.origen === 'previo' ? ' (análisis anterior)' : '') + '</option>').join('') +
          '</select><div id="edu-comparar-salida"></div>'
        : '<p class="edu-nota">Todavía no hay otro sector con qué comparar. Cuando el curso analice otro centro, o guarde una ficha en Pro City, aparece acá.</p>') +
      '</div>';
  }
  function renderComparacion(cmp){
    if (!cmp) return '';
    const fila = f => '<tr class="g-' + f.gana + '"><td>' + esc(f.t) + '</td>' +
      '<td class="n este">' + esc(f.este) + (f.gana === 'este' ? ' <i>▲</i>' : '') + '</td>' +
      '<td class="barra"><div><i style="width:' + f.pct + '%"></i></div></td>' +
      '<td class="n otro">' + esc(f.otro) + (f.gana === 'otro' ? ' <i>▲</i>' : '') + '</td></tr>';
    return '<table class="edu-tbl-comp"><thead><tr><th></th><th class="este">Este sector</th><th></th><th class="otro">' + esc(cmp.otro.nombre) + '</th></tr></thead>' +
      '<tbody>' + cmp.filas.map(fila).join('') + '</tbody></table>' +
      '<p class="edu-comp-lectura">' + esc(cmp.lectura) + '</p>';
  }
  function engancharComparar(cont){
    const sel = cont.querySelector('#edu-comparar-sel');
    if (!sel) return;
    sel.addEventListener('change', () => {
      const salida = cont.querySelector('#edu-comparar-salida');
      const x = candidatosComparar().find(c => c.id === sel.value);
      if (!x || !ultimo) { salida.innerHTML = ''; if (ultimo) ultimo.comparacion = null; return; }
      const este = Object.assign({ nombre: 'Este sector' }, window.URBIS_EDU.resumen(ultimo));
      const cmp = window.URBIS_EDU.comparar(este, x.datos);
      ultimo.comparacion = cmp;
      salida.innerHTML = renderComparacion(cmp);
    });
  }

  /* ── La hoja de campo ────────────────────────────────────────────────
     Lo que el análisis dejó abierto, convertido en una hoja para llevar a
     la calle: una tabla en blanco por tarea, con las columnas de lo que hay
     que anotar, y el plano del radio arriba. Se imprime desde el navegador.
     Sale de `faltantes(r)`, así que si el curso ya anotó los horarios, esa
     tabla no aparece. */
  const TABLAS_CAMPO = {
    puntos:      { cols: ['Cuadra recorrida', 'Usos contados', 'Observaciones'], filas: 10 },
    horarios:    { cols: ['Local o uso', 'Días', 'Abre', 'Cierra', '¿Domingo?', '¿Después de 8 p.m.?'], filas: 14 },
    edificacion: { cols: ['Punto o dirección', 'Pisos', 'Época aparente', 'Material', 'Fachada activa / ciega', 'Estado'], filas: 12 },
    etiquetas:   { cols: ['Etiqueta que se usó', 'Qué es en realidad', 'Cuántos'], filas: 6 },
    busetas:     { cols: ['N.º de ruta', 'Destino que dice el letrero', 'Cada cuánto pasa', 'Hora', 'Parada'], filas: 10 },
    binacional:  { cols: ['Casa de cambio o cambista', 'Dónde', 'Hora', '¿De dónde viene la clientela?'], filas: 8 },
    flotante:    { cols: ['Cuadra', '«Se arrienda pieza»', 'Pagadiarios', 'Residencias'], filas: 8 }
  };
  const EN_LA_APP = { contexto: true, forma: true, lectura: true };
  function hojaCampoHTML(r){
    r = r || ultimo;
    if (!r || !window.URBIS_EDU || !window.URBIS_EDU.faltantes) return '';
    const F = window.URBIS_EDU.faltantes(r);
    const enCalle = F.filter(f => !EN_LA_APP[f.id]), enApp = F.filter(f => EN_LA_APP[f.id]);
    const m = r.meta || {};
    const radioTxt = m.radioM >= 1000 ? (m.radioM / 1000) + ' km' : m.radioM + ' m';
    let mapa = '';
    try {
      const I = window.AIA_INFORME;
      if (I && I.calcZoom && I.urlMapaEstatico && m.lat) {
        const z = I.calcZoom(m.lat, m.radioM, 320), url = I.urlMapaEstatico(m, 640, 320, z.z);
        const pct = (z.radioPx / 320 * 200).toFixed(1);
        mapa = url ? '<div class="mapa"><img src="' + url + '" alt="Plano del sector">' +
          '<i class="radio" style="width:' + (z.radioPx / 640 * 200).toFixed(1) + '%;height:' + pct + '%"></i><i class="cruz"></i></div>' : '';
      }
    } catch(e) { mapa = ''; }
    const tabla = f => {
      const T = TABLAS_CAMPO[f.id] || { cols: ['Qué', 'Dónde', 'Observaciones'], filas: 8 };
      const fila = '<tr>' + T.cols.map(() => '<td></td>').join('') + '</tr>';
      return '<section class="tarea">' +
        '<h2>' + esc(f.t) + (f.n ? ' <em>' + f.n + '</em>' : '') + '</h2>' +
        '<p>' + esc(f.d) + '</p>' +
        '<table><thead><tr>' + T.cols.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr></thead>' +
        '<tbody>' + Array.from({ length: T.filas }, () => fila).join('') + '</tbody></table>' +
        '</section>';
    };
    const L = (window.URBIS_EDU.LECTURAS || []).filter(l => l.id !== 'general');
    const fecha = new Date().toLocaleDateString('es-CO', { dateStyle: 'long' });
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><base href="' + location.href + '">' +
      '<title>Hoja de campo · URBIS</title><style>' +
      '@page{size:letter portrait;margin:12mm}*{box-sizing:border-box}' +
      'body{font-family:"Segoe UI",Arial,sans-serif;color:#111;margin:0;padding:14px 18px;font-size:11px;line-height:1.4}' +
      'header{display:flex;align-items:center;gap:12px;border-bottom:2px solid #0e7490;padding-bottom:8px;margin-bottom:10px}' +
      'header img{width:34px;height:34px}header h1{font-size:18px;margin:0}header p{margin:2px 0 0;color:#555;font-size:11px}' +
      '.datos{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0}' +
      '.datos div{border:1px solid #cfd8dc;border-radius:6px;padding:5px 8px}.datos b{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.3px;color:#555}' +
      '.datos span{display:block;min-height:14px;border-bottom:1px dotted #999}' +
      '.mapa{position:relative;width:100%;aspect-ratio:2/1;border:1px solid #cfd8dc;border-radius:6px;overflow:hidden;margin:6px 0 10px}' +
      '.mapa img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.mapa .radio{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border:2px solid #0e7490;border-radius:50%;box-shadow:0 0 0 2000px rgba(255,255,255,.35)}' +
      '.mapa .cruz{position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;background:linear-gradient(#c0392b,#c0392b) center/2px 100% no-repeat,linear-gradient(#c0392b,#c0392b) center/100% 2px no-repeat}' +
      '.tarea{break-inside:avoid;margin:0 0 14px}.tarea h2{font-size:13px;margin:0 0 2px;color:#0e7490}.tarea h2 em{font-style:normal;color:#b45309;font-size:11px}' +
      '.tarea p{margin:0 0 5px;color:#444}' +
      'table{width:100%;border-collapse:collapse}th{font-size:9px;text-transform:uppercase;letter-spacing:.3px;text-align:left;padding:3px 5px;border-bottom:1.5px solid #333;color:#333}' +
      'td{height:22px;border-bottom:1px solid #bbb;padding:0 5px}' +
      '.app{border:1px dashed #0e7490;border-radius:6px;padding:7px 10px;margin:10px 0}.app h2{font-size:12px;margin:0 0 3px}.app li{margin:2px 0}' +
      '.volver{border:1px dashed #b45309;border-radius:6px;padding:7px 10px;margin:10px 0}.volver h2{font-size:12px;margin:0 0 3px;color:#b45309}' +
      '.volver li{margin:3px 0}.volver b{display:block}.volver span{color:#444}' +
      'footer{margin-top:12px;font-size:9px;color:#666;border-top:1px solid #ccc;padding-top:5px}' +
      '@media print{body{padding:0}}' +
      '</style></head><body>' +
      '<header><img src="assets/brand/urbis-logo.png" onerror="this.style.display=\'none\'">' +
        '<div><h1>Hoja de campo · ' + esc(((r.edu || {}).ciudad) || m.direccionAprox || 'el sector') + '</h1>' +
        '<p>Radio de ' + radioTxt + ' alrededor de ' + (m.lat ? m.lat.toFixed(5) + ', ' + m.lng.toFixed(5) : 'el centro del mapa') +
        ' · generada el ' + esc(fecha) + ' a partir de ' + ((r.edu || {}).leidos || 0) + ' puntos ya mapeados</p></div></header>' +
      '<div class="datos"><div><b>Grupo</b><span></span></div><div><b>Fecha y hora de salida</b><span></span></div><div><b>Clima</b><span></span></div></div>' +
      mapa +
      (enCalle.length ? enCalle.map(tabla).join('')
        : '<section class="tarea"><h2>Nada pendiente en la calle</h2><p>El análisis no dejó tareas de campo abiertas. Caminen igual: la hoja de atrás es para lo que el mapa no pregunta.</p></section>') +
      (enApp.length ? '<div class="app"><h2>Al volver, en la aplicación</h2><ul>' +
          enApp.map(f => '<li><b>' + esc(f.t) + '.</b> ' + esc(f.d) + '</li>').join('') + '</ul></div>' : '') +
      '<div class="volver"><h2>Y para escribir la lectura del curso, mientras caminan</h2><ul>' +
        L.map(l => '<li><b>' + esc(l.t) + '</b><span>' + esc(l.p) + '</span></li>').join('') + '</ul></div>' +
      '<footer>URBIS · modo educativo · esta hoja sale del análisis del sector: lo que ya está anotado no se vuelve a pedir.</footer>' +
      '</body></html>';
  }
  function abrirHojaCampo(){
    const html = hojaCampoHTML(ultimo);
    if (!html) return;
    const w = window.open('', '_blank');
    if (!w) { alert('El navegador bloqueó la ventana de la hoja de campo.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  /* ── Entregar al curso ────────────────────────────────────────────────
     El puente con js/81. Acá va SOLO la pantalla: el formato de la fila, la
     firma del sector y las reglas del servidor viven allá, para que las
     pruebas puedan tocarlas sin abrir el panel entero.

     El aviso de arriba no es letra chica. Antes de esta versión, lo escrito
     no salía del teléfono y por eso no había nada que advertir; a partir de
     ahora sí sale, y el nombre del curso es la única llave. Decirlo con esas
     palabras, antes del campo, es la diferencia entre entregar y publicar
     sin saberlo. */
  function bloqueCurso(){
    if (!window.URBIS_CURSO) return '';
    const c = window.URBIS_CURSO.curso();
    return '<div class="edu-caja edu-curso" id="edu-curso">' +
      '<h4>📤 Entregar al curso</h4>' +
      '<p class="edu-aviso">Lo que escriben acá vive en <b>este</b> teléfono y nadie más lo ve. ' +
      'Entregarlo lo guarda en el servidor, donde el profesor abre el trabajo de todos los grupos ' +
      'desde un solo sitio. El nombre del curso es la <b>única llave</b>: quien lo sepa, lee lo entregado.</p>' +
      '<label class="edu-curso-campo">Curso o grupo' +
        '<input type="text" id="edu-curso-nombre" maxlength="60" placeholder="Taller 5B · UFPS" value="' + esc(c) + '"></label>' +
      '<div class="edu-curso-btns">' +
        '<button type="button" id="edu-curso-entregar">📤 Entregar</button>' +
        '<button type="button" id="edu-curso-ver" class="sec">📚 Ver lo entregado</button>' +
      '</div>' +
      '<p class="edu-curso-msg" id="edu-curso-msg" role="status"></p>' +
      '<div id="edu-curso-lista"></div></div>';
  }
  function nombreLectura(id){
    const L = ((window.URBIS_EDU || {}).LECTURAS) || [];
    const d = L.find(x => x.id === id);
    return (d && d.t) || (id === 'general' ? 'Conclusión del grupo' : id);
  }
  function cifraCmp(c, v){
    const n = Number(v) || 0;
    return (c.dec ? n.toLocaleString('es-CO', { maximumFractionDigits: c.dec, minimumFractionDigits: c.dec })
                  : String(Math.round(n))) + (c.sufijo || '');
  }
  function entregaHTML(e){
    const fecha = e.ms ? new Date(e.ms).toLocaleString('es-CO', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : 'sin fecha';
    const ids = Object.keys(e.lecturas || {});
    const cuerpo = ids.length
      ? '<dl>' + ids.map(k => '<dt>' + esc(nombreLectura(k)) + '</dt><dd>' + esc(String(e.lecturas[k])) + '</dd>').join('') + '</dl>'
      : '<p class="edu-curso-vacio">La entrega llegó sin lecturas escritas.</p>';
    const r = e.resumen || {};
    const cifras = (((window.URBIS_EDU || {}).COMPARABLES) || [])
      .filter(c => r[c.id] != null)
      .map(c => '<span>' + esc(c.t) + ': ' + esc(cifraCmp(c, r[c.id])) + '</span>').join('');
    return '<li><details class="edu-curso-entrega">' +
      '<summary><b>' + esc(e.autor || 'sin firma') + '</b> · ' + esc(e.titulo || 'sector sin nombre') +
        '<span>' + esc(fecha) + ' · ' + e.escritas + (e.escritas === 1 ? ' lectura escrita' : ' lecturas escritas') + '</span></summary>' +
      cuerpo + (cifras ? '<div class="edu-curso-cifras">' + cifras + '</div>' : '') +
      '</details></li>';
  }
  function msgCurso(texto, clase){
    const m = $('edu-curso-msg');
    if (!m) return;
    m.className = 'edu-curso-msg' + (clase ? ' ' + clase : '');
    m.textContent = texto || '';
  }
  function engancharCurso(cont, centro, radioM){
    const C = window.URBIS_CURSO;
    if (!C) return;
    const campo = cont.querySelector('#edu-curso-nombre');
    if (campo) campo.addEventListener('change', () => C.fijarCurso(campo.value));
    const bEnt = cont.querySelector('#edu-curso-entregar');
    if (bEnt) bEnt.addEventListener('click', async () => {
      const nombre = campo ? campo.value : '';
      C.fijarCurso(nombre);
      bEnt.disabled = true; msgCurso('Entregando…', '');
      try {
        const out = await C.entregar(ultimo, lecturasActuales(), centro, radioM, nombre);
        if (out && out.ok) msgCurso(out.actualizada
          ? 'Entrega actualizada. El profesor ve la última versión, no las anteriores.'
          : 'Entregado. Ya está en el servidor, a nombre del curso.', 'ok');
        else msgCurso((out && out.message) || 'No se pudo entregar.', 'mal');
      } catch(err) {
        msgCurso('No se pudo entregar: ' + ((err && err.message) || err), 'mal');
      }
      bEnt.disabled = false;
    });
    const bVer = cont.querySelector('#edu-curso-ver');
    if (bVer) bVer.addEventListener('click', async () => {
      const nombre = campo ? campo.value : '';
      C.fijarCurso(nombre);
      const caja = cont.querySelector('#edu-curso-lista');
      if (!C.normCurso(nombre)) { msgCurso('Escriban primero el nombre del curso.', 'mal'); return; }
      bVer.disabled = true; msgCurso('Buscando lo entregado…', '');
      try {
        const lista = await C.traer(nombre);
        msgCurso(lista.length
          ? lista.length + (lista.length === 1 ? ' entrega' : ' entregas') + ' en «' + nombre.trim() + '».'
          : 'Nadie ha entregado todavía en «' + nombre.trim() + '». Si el curso ya entregó, revisen que el nombre esté escrito igual.',
          lista.length ? 'ok' : '');
        if (caja) caja.innerHTML = lista.length ? '<ul class="edu-curso-lista">' + lista.map(entregaHTML).join('') + '</ul>' : '';
      } catch(err) {
        msgCurso('No se pudo leer lo entregado: ' + ((err && err.message) || err), 'mal');
      }
      bVer.disabled = false;
    });
  }

  // ── Orquestación ────────────────────────────────────────────────────────
  function centroActual(){
    try {
      if (typeof map !== 'undefined' && map && map.getCenter) {
        const c = map.getCenter();
        return { lat: c.lat, lng: c.lng };
      }
    } catch(e) {}
    return null;
  }

  async function ejecutar(){
    const cont = $('edu-analisis-salida');
    if (!cont) return;
    const centro = centroActual();
    if (!centro) { cont.innerHTML = '<p class="edu-nota">No se pudo leer el centro del mapa.</p>'; return; }
    const radioM = parseInt(($('edu-analisis-radio') || {}).value || '500', 10);
    const btn = $('edu-analisis-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Analizando…'; }
    cont.innerHTML = '<p class="edu-nota">Leyendo lo que mapearon y consultando el censo…</p>';
    mostrarCalor('', false);
    try {
      const r = await window.URBIS_EDU.analizar(centro, radioM, null);
      ultimo = r;
      claveLecturas = claveDe(centro, radioM);
      const previas = lecturasDe(claveLecturas);
      r.lecturas = Object.assign({}, previas);
      // Antes y después: contra el análisis anterior del mismo centro y radio.
      const previo = previoDe(claveLecturas), resumenAhora = window.URBIS_EDU.resumen(r);
      r.cambios = previo ? window.URBIS_EDU.cambios(previo, resumenAhora) : null;
      guardarPrevio(claveLecturas, resumenAhora);
      cont.innerHTML = conLectura(bloqueBase(r), 'base', previas) + bloqueCambios(r.cambios) + kpis(r) + bloqueComparar() +
                       conLectura(bloquePoblacion(r), 'poblacion', previas) +
                       conLectura(bloqueFlujo(r), 'flujo', previas) +
                       conLectura(bloqueCalor(r), 'calor', previas) +
                       conLectura(bloqueComposicion(r), 'composicion', previas) +
                       conLectura(bloqueAnillos(r), 'anillos', previas) +
                       conLectura(bloqueEdificacion(r), 'edificacion', previas) +
                       bloqueOportunidades(r) + conLectura(bloqueFoda(r), 'foda', previas) +
                       conLectura(bloqueIdeas(r), 'ideas', previas) +
                       '<div class="edu-caja" id="edu-forma"><h4>🔷 ¿Qué forma tiene la traza?</h4>' +
                         '<p class="edu-nota">Ortogonal, radial, media naranja, lineal o plato roto — medido con el rumbo ' +
                         'de las calles, no a ojo. Se pide aparte porque baja las calles del sector.</p>' +
                         '<button type="button" id="edu-forma-btn">🔷 Reconocer la traza</button></div>' +
                       '<div class="edu-caja" id="edu-contexto"><h4>🧭 El sector en su contexto</h4>' +
                         '<p class="edu-nota">Comuna y barrio, busetas, frontera, alojamiento de paso, colegio y salud a pie, ' +
                         'espacio público por habitante, pendiente y quebradas. Sale de OpenStreetMap y del modelo de ' +
                         'terreno, no de lo que mapearon. Se pide aparte porque es otra consulta.</p>' +
                         '<button type="button" id="edu-contexto-btn">🧭 Consultar el contexto</button></div>' +
                       cajaLectura('contexto', previas) +
                       bloqueConclusion(previas) +
                       bloqueCurso() +
                       '<div class="edu-acciones">' +
                         '<button type="button" id="edu-analisis-informe">📄 Ver informe del curso</button>' +
                         '<button type="button" id="edu-hoja-campo" class="sec">📝 Hoja de campo · lo que falta por levantar</button>' +
                       '</div>';
      engancharLecturas(cont);
      engancharComparar(cont);
      engancharCurso(cont, centro, radioM);
      const bh = $('edu-hoja-campo');
      if (bh) bh.addEventListener('click', abrirHojaCampo);
      const bi = $('edu-analisis-informe');
      if (bi) bi.addEventListener('click', abrirInforme);
      const bf = $('edu-forma-btn');
      if (bf) bf.addEventListener('click', () => reconocerForma(centro, radioM));
      const bc = $('edu-contexto-btn');
      if (bc) bc.addEventListener('click', () => consultarContexto(centro, radioM));
      /* El calor sobre el mapa: la capa de día apenas termina, sin pedirla,
         porque es la respuesta a «¿por dónde se mueve la gente acá?» y
         el mapa está justo detrás del panel. Las otras dos, y quitarla,
         a un toque. Al terminar solo se mueve el mapa si el cuadrado del
         calor no cabe entero en pantalla: si cabe, el estudiante lo puso
         donde lo quería y se queda. */
      const cc = $('edu-calor');
      if (cc) {
        cc.addEventListener('click', ev => {
          const el = ev.target.closest('[data-capa]');
          if (!el || !cc.contains(el)) return;
          mostrarCalor(el.getAttribute('data-capa'), true);
        });
        cc.addEventListener('keydown', ev => {
          if (ev.key !== 'Enter' && ev.key !== ' ') return;
          const el = ev.target.closest('figure[data-capa]');
          if (!el) return;
          ev.preventDefault(); mostrarCalor(el.getAttribute('data-capa'), true);
        });
        mostrarCalor('dia', 'auto');
      } else {
        mostrarCalor('', false);
      }
      try { if (typeof urbisEvaluateAchievements === 'function') urbisEvaluateAchievements('analisis-edu'); } catch(e) {}
    } catch(err) {
      cont.innerHTML = '<p class="edu-nota">No se pudo completar el análisis: ' +
        esc(err && err.message || err) + '</p>';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📊 Analizar lo que mapeamos'; }
    }
  }

  /* ── La forma de la traza ───────────────────────────────────────────────
     Las cinco de los manuales de morfología urbana. El motor las decide con
     el rumbo de cada calle: la concentración de direcciones, cuántos metros
     corren a lo largo del radio desde el centro y cuántos lo cruzan, en
     cuántos sectores del abanico hay vías y qué tan estirado está el tejido.

     Se muestra el POR QUÉ junto a la etiqueta. Un estudiante que solo lee
     «Plato roto» aprende una palabra; uno que lee «ninguna dirección ordena
     el trazado, índice de orden 0,03 sobre 1» aprende a mirar un plano. */
  const FORMA_ICONO = { ortogonal: '▦', radial: '◎', mediaNaranja: '◐', lineal: '▤', platoRoto: '✳' };

  function bloqueForma(f, nVias, vias){
    if (!f) {
      return '<p class="edu-nota">No hay calles con forma suficiente en este radio para describir la traza. ' +
             'Suele pasar en zonas rurales o donde OpenStreetMap todavía no tiene las vías dibujadas.</p>';
    }
    const km = vias && vias.kmTotal ? vias.kmTotal : null;
    return '<div class="edu-forma-cabeza">' +
        '<span class="edu-forma-ico">' + (FORMA_ICONO[f.id] || '◇') + '</span>' +
        '<div><b>' + esc(f.nombre) + '</b>' +
        '<small>' + nVias + ' calles' + (km ? ' · ' + km + ' km de vía' : '') + '</small></div>' +
      '</div>' +
      '<p class="edu-forma-que">' + esc(f.descripcion) + '</p>' +
      '<p class="edu-forma-porque"><b>Por qué: </b>' + esc(f.porque) + '</p>' +
      '<p class="edu-nota edu-forma-ojo">⚠️ ' + esc(f.advertencia) + '</p>' +
      /* Que esto NO dependa de lo que mapearon es información, no una
         disculpa: en todo el resto del módulo la respuesta mejora mapeando
         más, y acá no. Si no se dice, un curso puede salir a caminar
         creyendo que va a cambiar esta etiqueta. */
      '<p class="edu-nota">Esta lectura sale de las calles que ya están en OpenStreetMap, ' +
      'no de lo que ustedes mapearon: es la única parte del análisis que no cambia si mapean más.</p>';
  }

  async function reconocerForma(centro, radioM){
    const caja = $('edu-forma');
    if (!caja) return;
    const btn = $('edu-forma-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Leyendo las calles…'; }
    try {
      const f = await window.URBIS_EDU.forma(centro, radioM);
      ultimaForma = f;
      if (ultimo) ultimo.formaEdu = f;     // para el informe
      caja.innerHTML = '<h4>🔷 ¿Qué forma tiene la traza?</h4>' +
        bloqueForma((f.morfologia || {}).forma, f.nVias, f.vias);
      caja.insertAdjacentHTML('afterend', cajaLectura('forma', lecturasDe(claveLecturas)));
    } catch(err) {
      if (btn) { btn.disabled = false; btn.textContent = '🔷 Reconocer la traza'; }
      const p = document.createElement('p');
      p.className = 'edu-nota';
      p.textContent = 'No se pudo leer la traza: ' + ((err && err.message) || err);
      caja.appendChild(p);
    }
  }

  let ultimaForma = null;

  /* ── El sector en su contexto ──────────────────────────────────────────
     Lo que Daniel pidió para el ejercicio y que el levantamiento del curso
     no puede dar: en qué comuna y barrio están, qué busetas pasan, y si la
     frontera ordena o no la cuadra. Cada bloque dice de dónde sale y qué
     falta: una lista de rutas de OpenStreetMap es lo que alguien subió, no
     la oferta real, y el módulo lo dice para que el curso salga a
     completarla en vez de creerla. */
  function bloqueContexto(c){
    const km = m => (m / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 });
    const mDe = m => m >= 1000 ? km(m) + ' km' : m + ' m';
    let html = '';
    // Dónde están: del país al barrio, como una ruta de migas.
    if (c.limites.length) {
      html += '<h4 class="sep">📍 Dónde están</h4>' +
        '<p class="edu-migas">' + c.limites.map(l =>
          '<span title="' + esc(l.tipo) + '"><small>' + esc(l.tipo) + '</small>' + esc(l.nombre) + '</span>').join('<i>›</i>') +
        '</p>';
      const hayComuna = c.limites.some(l => l.nivel === 9), hayBarrio = c.limites.some(l => l.nivel >= 10);
      if (!hayComuna || !hayBarrio) {
        html += '<p class="edu-nota">OpenStreetMap no tiene dibujado ' +
          (!hayComuna && !hayBarrio ? 'la comuna ni el barrio' : !hayComuna ? 'la comuna' : 'el barrio') +
          ' de este punto. ' + (c.barrios.length ? 'Los barrios nombrados más cerca están abajo.' : 'Averiguarlo en campo es parte del ejercicio.') + '</p>';
      }
    } else {
      html += '<h4 class="sep">📍 Dónde están</h4>' +
        '<p class="edu-nota">OpenStreetMap no devolvió ningún límite administrativo para este punto.</p>';
    }
    if (c.barrios.length) {
      html += '<p class="edu-nota"><b>Barrios nombrados cerca:</b> ' + c.barrios.map(b =>
        esc(b.nombre) + ' <em>(' + mDe(b.distM) + ' hacia ' + esc(b.rumbo) + ')</em>').join(' · ') + '</p>';
    }
    // Las busetas.
    html += '<h4 class="sep">🚌 Qué busetas paran cerca</h4>';
    if (c.rutas.length) {
      html += '<ul class="edu-rutas">' + c.rutas.map(r =>
        '<li>' + (r.color ? '<i style="background:' + esc(r.color) + '"></i>' : '<i></i>') +
        (r.ref ? '<b>' + esc(r.ref) + '</b>' : '') +
        '<span>' + esc(r.nombre || (r.tipo === 'share_taxi' ? 'Colectivo' : 'Ruta')) + '</span>' +
        (r.operador ? '<small>' + esc(r.operador) + '</small>' : '') + '</li>').join('') + '</ul>' +
        '<p class="edu-nota">' + c.rutas.length + (c.rutas.length === 1 ? ' ruta' : ' rutas') + ' que recogen en ' +
          c.paradas + (c.paradas === 1 ? ' parada' : ' paradas') + ' dentro del radio, según lo que alguien subió a OpenStreetMap. ' +
          'Es lo que está mapeado, no la oferta completa: en campo, anoten el número y el destino de las busetas que vean pasar.</p>';
    } else {
      html += '<p class="edu-nota">' + (c.paradas
        ? 'Hay ' + c.paradas + (c.paradas === 1 ? ' parada mapeada' : ' paradas mapeadas') + ' pero ninguna ruta dibujada que las use. '
        : 'No hay paradas ni rutas de buseta mapeadas en el radio. ') +
        'No quiere decir que no pasen: quiere decir que nadie las ha subido. Contarlas —número, destino, cada cuánto— ' +
        'es de lo más útil que el curso puede aportar.</p>';
    }
    // Lo binacional.
    html += '<h4 class="sep">🌉 La frontera</h4>' +
      '<p class="edu-bina edu-bina-' + c.binacional.grado + '">' + esc(c.binacional.lectura) + '</p>';
    if (c.pasos.length > 1) {
      html += '<p class="edu-nota">Otros pasos: ' + c.pasos.slice(1).map(p =>
        esc(p.nombre) + ' <em>(' + km(p.distM) + ' km hacia ' + esc(p.rumbo) + ')</em>').join(' · ') + '</p>';
    }
    if (c.cambio.length) {
      html += '<p class="edu-nota"><b>Casas de cambio y giros en el radio:</b> ' + c.cambio.slice(0, 6).map(x =>
        esc(x.nombre) + ' <em>(' + mDe(x.distM) + ')</em>').join(' · ') + (c.cambio.length > 6 ? ' …' : '') + '</p>';
    }
    if (c.binacional.grado !== 'ninguno') {
      html += '<p class="edu-nota">Para leer el flujo binacional en campo: cuenten casas de cambio y cambistas en la vía, ' +
        'comercio de paso (maletas, remesas, recargas), y pregunten en dos o tres locales de dónde viene la clientela ' +
        'y a qué hora. Eso es lo que distingue una cuadra de frontera de una cuadra cerca de la frontera.</p>';
    }
    // A distancia de caminata.
    if (c.caminata) {
      const k = c.caminata;
      const fila = (ico, etq, e) => '<li>' + ico + ' <span>' + etq + '</span>' +
        (e ? '<b>' + e.min + ' min</b><small>' + esc(e.nombre) + ' · ' + mDe(e.distM) + ' hacia ' + esc(e.rumbo) + '</small>'
           : '<b>—</b><small>sin ' + etq.toLowerCase() + ' mapeado a menos de 1,5 km</small>') + '</li>';
      html += '<h4 class="sep">🚶 A distancia de caminata</h4>' +
        '<ul class="edu-caminata">' + fila('🏫', 'Colegio', k.colegio) + fila('🏥', 'Salud', k.salud) + fila('🌳', 'Parque', k.parque) + '</ul>' +
        '<p class="edu-nota">Minutos a paso de ciudad (80 m por minuto), en línea recta: el camino real es más largo. ' +
        'Un colegio a más de 15 minutos es un colegio al que se va en buseta.</p>';
    }
    // Espacio público por habitante.
    if (c.espacioPublico) {
      const e = c.espacioPublico;
      html += '<h4 class="sep">🌳 Espacio público por habitante</h4>';
      if (e.m2PorHab != null) {
        html += '<div class="edu-ep"><b>' + e.m2PorHab.toLocaleString('es-CO') + '<small> m²/hab</small></b>' +
          '<div class="edu-ep-barra"><i style="width:' + Math.min(100, e.pctDeMeta) + '%"></i><em style="left:100%">meta ' + e.meta + '</em></div></div>';
      }
      html += '<p class="edu-nota">' + esc(e.lectura) + '</p>' +
        (e.n ? '<p class="edu-nota"><b>Contado:</b> ' + e.parques.slice(0, 5).map(q => esc(q.nombre) + ' <em>(' + q.m2.toLocaleString('es-CO') + ' m²)</em>').join(' · ') +
               (e.n > 5 ? ' …' : '') + '. Los polígonos entran enteros aunque asomen fuera del radio.</p>' : '');
    }
    // Terreno y agua.
    if (c.terreno || (c.agua && c.agua.cercano)) {
      html += '<h4 class="sep">⛰️ Terreno y agua</h4>';
      if (c.terreno) {
        const t = c.terreno;
        html += '<div class="edu-terreno"><span><b>' + t.pendientePct.toLocaleString('es-CO') + ' %</b><small>pendiente media</small></span>' +
          '<span><b>' + t.desnivelM + ' m</b><small>de desnivel</small></span>' +
          '<span><b>' + esc(t.cae.replace(/^el /, '')) + '</b><small>hacia donde cae</small></span></div>' +
          '<p class="edu-terreno-lectura' + (t.haciaElAgua ? ' ojo' : '') + '">' + esc(t.lectura) + '</p>' +
          '<p class="edu-nota">' + esc(t.nota) + '</p>';
      } else if (c.agua && c.agua.cercano) {
        html += '<p class="edu-nota">El cauce más cercano, ' + esc(c.agua.cercano.nombre) + ', pasa a ' + mDe(c.agua.cercano.distM) + ' hacia ' + esc(c.agua.cercano.rumbo) +
          '. La altura del terreno no respondió esta vez.</p>';
      }
      if (c.agua && c.agua.cauces.length > 1) {
        html += '<p class="edu-nota"><b>Otros cauces en el radio:</b> ' + c.agua.cauces.slice(1).map(q => esc(q.nombre) + ' <em>(' + mDe(q.distM) + ')</em>').join(' · ') + '</p>';
      }
    }
    // La población de paso.
    if (c.flotante) {
      const f = c.flotante;
      const ALOJ = { hotel: 'hotel', hostel: 'hostal', guest_house: 'residencia', motel: 'motel',
                     apartment: 'apartamento turístico', albergue: 'albergue' };
      const partes = Object.keys(f.porTipo || {}).map(k => f.porTipo[k] + ' ' + (ALOJ[k] || k) + (f.porTipo[k] === 1 ? '' : (ALOJ[k] || k).endsWith('l') ? 'es' : 's'));
      html += '<h4 class="sep">🛏️ Población de paso</h4>' +
        '<p class="edu-flotante edu-flotante-' + (f.dePaso >= 2 ? 'si' : f.total ? 'poco' : 'no') + '">' + esc(f.lectura) + '</p>' +
        (partes.length ? '<p class="edu-nota"><b>Mapeado:</b> ' + esc(partes.join(', ')) + '.</p>' : '');
    }
    html += '<p class="edu-nota">Todo esto sale de OpenStreetMap, no de lo que mapearon: es la única parte del análisis ' +
      'que no cambia si mapean más. El umbral de «frontera cerca» es ' + km(c.umbralFronteraM) + ' km: ' +
      'lo que se camina en media hora larga o se hace en una buseta corta.</p>';
    return html;
  }

  async function consultarContexto(centro, radioM){
    const caja = $('edu-contexto');
    if (!caja) return;
    const btn = $('edu-contexto-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Consultando…'; }
    try {
      const c = await window.URBIS_EDU.contexto(centro, radioM, ultimo && ultimo.stats && ultimo.stats.poblacionEstimada);
      if (ultimo) ultimo.contexto = c;      // para el informe
      // El análisis guardado toma nombre del barrio: así la lista de
      // «comparar con otro sector» dice «Barrio La Playa» y no unas coordenadas.
      try {
        const barrio = (c.limites || []).filter(l => l.nivel >= 9).pop();
        const prev = previoDe(claveLecturas);
        if (barrio && prev) { prev.nombre = barrio.nombre; guardarPrevio(claveLecturas, prev); }
      } catch(e) {}
      caja.innerHTML = '<h4>🧭 El sector en su contexto</h4>' + bloqueContexto(c);
    } catch(err) {
      if (btn) { btn.disabled = false; btn.textContent = '🧭 Consultar el contexto'; }
      const p = document.createElement('p');
      p.className = 'edu-nota';
      p.textContent = 'No se pudo consultar el contexto: ' + ((err && err.message) || err);
      caja.appendChild(p);
    }
  }

  // El mismo informe de cuatro hojas que reciben las empresas. Que un curso
  // pueda producirlo con su propio levantamiento es justamente el punto.
  function abrirInforme(){
    if (!ultimo || !window.AIA_INFORME) return;
    try {
      ultimo.lecturas = lecturasActuales();
      /* La referencia de cada cifra contra los sectores que el curso ya
         levantó. Va al informe DEL CURSO y no al de empresas: acá comparar
         es la lección, y allá esa misma frase le contaría al cliente cuántos
         análisis tiene hechos el analista y dónde queda el suyo entre ellos. */
      ultimo.referencias = referenciasDelCurso(ultimo);
      const html = window.AIA_INFORME.construirHTMLEjecutivo(
        ultimo, { estilo: 'institucional', horizontal: true, educativo: true,
                      titulo: 'Análisis del sector',
                      autor: 'Ejercicio educativo · URBIS' });
      const w = window.open('', '_blank');
      if (!w) { alert('El navegador bloqueó la ventana del informe.'); return; }
      w.document.open(); w.document.write(html); w.document.close();
    } catch(e) {
      alert('No se pudo abrir el informe: ' + (e && e.message || e));
    }
  }

  function init(){
    const btn = $('edu-analisis-btn');
    if (btn) btn.addEventListener('click', ejecutar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.URBIS_EDU_UI = { ejecutar: ejecutar, abrirInforme: abrirInforme,
                          mostrarCalor: mostrarCalor, bloqueContexto: bloqueContexto,
                          lecturas: lecturasActuales, hojaCampoHTML: hojaCampoHTML,
                          referencias: referenciasDelCurso,
                          candidatosComparar: candidatosComparar,
                          entregaHTML: entregaHTML,
                          bloqueIdeas: bloqueIdeas,
                          get calor(){ return calorMapa; },
                          get ultimo(){ return ultimo; } };
})();
