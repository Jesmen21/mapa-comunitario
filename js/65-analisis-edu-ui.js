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

  // ── Mapa de calor: la malla del motor, pintada ──────────────────────────
  // Mismo criterio que en el modo empresas: se dibuja al tamaño real del dato
  // (26×26) y se reescala con suavizado, en vez de soltar 676 divs por capa.
  const RAMPAS = {
    peaton:  [[0,[ 32,140, 90, 0]], [.25,[120,190, 60,110]], [.5,[245,205, 60,170]],
              [.75,[240,140, 40,205]], [1,[214, 40, 40,230]]],
    vehiculo:[[0,[ 30, 90,170, 0]], [.25,[ 70,130,220,110]], [.5,[110,110,225,170]],
              [.75,[150, 70,205,205]], [1,[120, 20,150,230]]]
  };
  function pngCalor(capa, n, tipo){
    try {
      const ramp = RAMPAS[tipo] || RAMPAS.peaton;
      const mezcla = t => {
        for (let i = 1; i < ramp.length; i++) {
          if (t <= ramp[i][0]) {
            const a = ramp[i-1], b = ramp[i], k = (t - a[0]) / (b[0] - a[0] || 1);
            return [0,1,2,3].map(c => Math.round(a[1][c] + (b[1][c] - a[1][c]) * k));
          }
        }
        return ramp[ramp.length-1][1];
      };
      const c = document.createElement('canvas'); c.width = c.height = n;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(n, n);
      for (let k = 0; k < n * n; k++) {
        const v = capa[k], px = k * 4;
        if (v == null || v < 0) { img.data[px + 3] = 0; continue; }
        const col = mezcla(Math.max(0, Math.min(1, v / 100)));
        img.data[px] = col[0]; img.data[px+1] = col[1]; img.data[px+2] = col[2]; img.data[px+3] = col[3];
      }
      ctx.putImageData(img, 0, 0);
      const g = document.createElement('canvas'); g.width = g.height = 240;
      const gx = g.getContext('2d');
      gx.imageSmoothingEnabled = true; gx.imageSmoothingQuality = 'high';
      gx.drawImage(c, 0, 0, 240, 240);
      return g.toDataURL('image/png');
    } catch(e) { return ''; }
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

  function kpis(r){
    const s = r.stats, f = (s.movilidad && s.movilidad.flujo) || {};
    const caja = (n, t, sub) => '<div class="edu-kpi"><b>' + n + '</b><span>' + t + '</span>' +
      (sub ? '<em>' + esc(sub) + '</em>' : '') + '</div>';
    return '<div class="edu-kpis">' +
      caja(miles(s.poblacionEstimada), 'Habitantes',
           s.poblacionProyectada ? 'DANE ' + s.censoAnio + ' → ' + s.anioProyeccion
                                 : (s.poblacionEsCensal ? 'DANE ' + s.censoAnio : 'estimado')) +
      caja((f.peatonal || 0) + '/100', 'Flujo a pie', f.nivelPeatonal || '—') +
      caja((f.vehicular || 0) + '/100', 'Flujo vehicular', f.nivelVehicular || '—') +
      caja(miles(s.total), 'Usos leídos', 'en el radio') +
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
    if (!f.franjas) return '';
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
      '<h4 class="sep">🕐 A qué horas</h4>' +
      '<div class="edu-horas">' + hora('Mañana', f.franjas.manana) + hora('Mediodía', f.franjas.mediodia) +
        hora('Tarde', f.franjas.tarde) + hora('Noche', f.franjas.noche) + '</div>' +
      (f.vidaNocturna ? '<p class="edu-nota">🌙 La zona sigue viva de noche.</p>' : '') +
      '</div>';
  }

  function bloqueCalor(r){
    const mc = (r.stats.movilidad && r.stats.movilidad.flujo || {}).mapaCalor;
    if (!mc) return '';
    const panel = (capa, foco, titulo, tipo) => {
      const png = pngCalor(capa, mc.n, tipo);
      return '<figure class="edu-calor"><figcaption>' + esc(titulo) + '</figcaption>' +
        '<div class="edu-calor-lienzo">' +
          (png ? '<img src="' + png + '" alt="' + esc(titulo) + '">' : '<div class="vacio"></div>') +
          '<i class="cruz"></i></div>' +
        '<small>' + (foco ? esc(foco.texto) : 'sin actividad suficiente') + '</small></figure>';
    };
    return '<div class="edu-caja">' +
      '<h4>🔥 Dónde está el movimiento</h4>' +
      '<div class="edu-calores">' +
        panel(mc.peatonalDia, mc.focoDia, 'A pie · día', 'peaton') +
        panel(mc.peatonalNoche, mc.focoNoche, 'A pie · noche', 'peaton') +
        panel(mc.vehicular, mc.focoVehicular, 'En vehículo', 'vehiculo') +
      '</div>' +
      '<p class="edu-nota">La cruz es el punto que analizaron. Cada capa se colorea contra su ' +
      'propio máximo: dice <b>dónde</b> se concentra el movimiento, no cuánto.' +
      (mc.fiable ? '' : ' Con pocos puntos es apenas indicativo.') + '</p>' +
      '</div>';
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

  function bloqueFoda(r){
    const f = r.foda || {};
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
      '<div class="edu-foda">' + html + '</div></div>';
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
    try {
      const r = await window.URBIS_EDU.analizar(centro, radioM, null);
      ultimo = r;
      cont.innerHTML = bloqueBase(r) + kpis(r) + bloquePoblacion(r) + bloqueFlujo(r) +
                       bloqueCalor(r) + bloqueComposicion(r) + bloqueEdificacion(r) + bloqueOportunidades(r) + bloqueFoda(r) +
                       '<div class="edu-acciones">' +
                         '<button type="button" id="edu-analisis-informe">📄 Ver informe completo</button>' +
                       '</div>';
      const bi = $('edu-analisis-informe');
      if (bi) bi.addEventListener('click', abrirInforme);
      try { if (typeof urbisEvaluateAchievements === 'function') urbisEvaluateAchievements('analisis-edu'); } catch(e) {}
    } catch(err) {
      cont.innerHTML = '<p class="edu-nota">No se pudo completar el análisis: ' +
        esc(err && err.message || err) + '</p>';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📊 Analizar lo que mapeamos'; }
    }
  }

  // El mismo informe de cuatro hojas que reciben las empresas. Que un curso
  // pueda producirlo con su propio levantamiento es justamente el punto.
  function abrirInforme(){
    if (!ultimo || !window.AIA_INFORME) return;
    try {
      const html = window.AIA_INFORME.construirHTMLEjecutivo(
        ultimo, {}, { estilo: 'institucional', horizontal: true,
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
                          get ultimo(){ return ultimo; } };
})();
