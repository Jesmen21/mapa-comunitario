/* URBIS Pro City · ANALÍTICA DE USO (js/25) — Fase 5
   ─────────────────────────────────────────────────────────────────────────
   Registra QUÉ funciones usan los estudiantes y DÓNDE se traban, para que el
   administrador sepa hacia dónde apuntar el desarrollo.

   Lo que este archivo NO hace, a propósito (sección 7 del plan):
   no entrena ningún modelo, no manda datos a terceros y no guarda contenido
   de lo que el estudiante analiza. Solo cuenta eventos de uso de la interfaz.
   El "aprende con el tiempo" se resuelve con reglas interpretables sobre esos
   conteos —el mismo patrón del FODA de Implantación IA—, no con IA opaca:
   gratis, auditable y sostenible.

   Privacidad: se guardan conteos y marcas de tiempo, nunca coordenadas,
   nombres de área ni nada que identifique un análisis concreto. Vive en el
   localStorage del propio dispositivo; no sale de ahí salvo que el
   administrador exporte el resumen a mano.

   El panel es solo para el administrador; para un estudiante este archivo es
   invisible. */
(function(){
  'use strict';

  const LS_KEY = 'pc_analitica_uso_v1';
  const MAX_DIAS = 90;          // se descarta lo más viejo para no crecer sin fin

  // Catálogo de eventos. Declararlos aquí (en vez de aceptar cualquier cadena)
  // evita que la analítica se llene de nombres sueltos y hace legible el panel.
  const EVENTOS = {
    'area-dibujo-inicio':  { etq:'Empezó a dibujar un área',     grupo:'area' },
    'area-cerrada':        { etq:'Cerró el área',                grupo:'area' },
    'area-cancelada':      { etq:'Canceló el dibujo',            grupo:'area', friccion:true },
    'area-guardada':       { etq:'Guardó el área',               grupo:'area' },
    'area-cargada':        { etq:'Abrió un área guardada',       grupo:'area' },
    'panel-analisis':      { etq:'Abrió el panel de análisis',   grupo:'analisis' },
    'heat-on':             { etq:'Encendió un mapa de calor',    grupo:'capas' },
    'geo-generada':        { etq:'Generó una geometría',         grupo:'capas' },
    'geo-filtro':          { etq:'Cambió el filtro de geometría',grupo:'capas' },
    'raster-ok':           { etq:'Analizó cobertura del suelo',  grupo:'capas' },
    'raster-error':        { etq:'Falló el análisis de cobertura', grupo:'capas', friccion:true },
    'pdf-generado':        { etq:'Generó el informe PDF',        grupo:'salida' },
    'exportado-kmz':       { etq:'Exportó a KMZ (Google Earth)', grupo:'salida' },
    'exportado-dxf':       { etq:'Exportó a DXF (AutoCAD)',     grupo:'salida' },
    'exportado-kml':       { etq:'Exportó a KML',               grupo:'salida' },
    'area-vacia':          { etq:'Analizó un área sin puntos mapeados', grupo:'friccion', friccion:true },
    'geo-sin-puntos':      { etq:'Intentó geometría con menos de 2 puntos', grupo:'friccion', friccion:true }
  };

  function hoyISO(){ return new Date().toISOString().slice(0, 10); }

  function leer(){
    try {
      const o = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return (o && typeof o === 'object' && o.dias) ? o : { dias:{}, desde: hoyISO() };
    } catch(e) { return { dias:{}, desde: hoyISO() }; }
  }
  function escribir(o){
    try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch(e) {}
  }

  // Poda de días viejos: mantiene el archivo pequeño y el panel relevante.
  function podar(o){
    const limite = new Date(Date.now() - MAX_DIAS * 86400000).toISOString().slice(0, 10);
    Object.keys(o.dias).forEach(d => { if (d < limite) delete o.dias[d]; });
    return o;
  }

  function registrar(evento, extra){
    if (!EVENTOS[evento]) return;           // solo eventos declarados
    const o = podar(leer());
    const d = hoyISO();
    o.dias[d] = o.dias[d] || {};
    o.dias[d][evento] = (o.dias[d][evento] || 0) + 1;
    // `extra` solo admite números pequeños (ej. cuántos puntos tenía el área),
    // nunca texto libre ni coordenadas.
    if (extra && typeof extra.n === 'number') {
      const k = evento + '::suma';
      o.dias[d][k] = (o.dias[d][k] || 0) + extra.n;
    }
    o.ultima = new Date().toISOString();
    escribir(o);
  }

  // ── Resumen ─────────────────────────────────────────────────────────────

  function resumen(){
    const o = leer();
    const dias = Object.keys(o.dias).sort();
    const total = {};
    dias.forEach(d => Object.keys(o.dias[d]).forEach(ev => {
      if (ev.indexOf('::suma') !== -1) return;
      total[ev] = (total[ev] || 0) + o.dias[d][ev];
    }));
    const eventos = Object.keys(total)
      .filter(ev => EVENTOS[ev])
      .map(ev => ({ id:ev, etq:EVENTOS[ev].etq, grupo:EVENTOS[ev].grupo,
                    friccion:!!EVENTOS[ev].friccion, n:total[ev] }))
      .sort((a, b) => b.n - a.n);
    const suma = eventos.reduce((a, e) => a + e.n, 0);
    return {
      eventos, suma, dias: dias.length,
      primerDia: dias[0] || null, ultimoDia: dias[dias.length - 1] || null,
      porDia: dias.map(d => ({ dia:d, n: Object.keys(o.dias[d])
        .filter(k => k.indexOf('::suma') === -1)
        .reduce((a, k) => a + o.dias[d][k], 0) }))
    };
  }

  // Lectura en lenguaje natural por reglas interpretables. Cada frase dice de
  // qué conteo salió, para que el administrador pueda comprobarla — igual que
  // el FODA de Implantación IA, que nunca afirma sin citar el dato.
  function interpretar(){
    const r = resumen();
    const n = id => (r.eventos.find(e => e.id === id) || { n:0 }).n;
    const out = [];

    if (!r.suma) {
      return { frases:['Todavía no hay uso registrado en este dispositivo. ' +
        'Las cifras aparecen a medida que los estudiantes usen el módulo.'], resumen:r };
    }

    const inicios = n('area-dibujo-inicio'), cerradas = n('area-cerrada'), canceladas = n('area-cancelada');
    if (inicios) {
      const tasa = Math.round(100 * cerradas / inicios);
      out.push('De ' + inicios + ' intento(s) de dibujar un área, se cerraron ' + cerradas +
        ' (' + tasa + '%)' + (canceladas ? ' y se cancelaron ' + canceladas : '') + '.');
      if (tasa < 60 && inicios >= 5) {
        out.push('⚠️ Menos del 60% de los dibujos llegan a cerrarse: vale la pena revisar si el gesto de ' +
          'cerrar el polígono se entiende. Es el punto de fricción más caro, porque bloquea todo lo demás.');
      }
    }

    const capas = ['heat-on','geo-generada','raster-ok'].map(id => ({ id, n:n(id) }));
    const usadas = capas.filter(c => c.n > 0);
    const sinUsar = capas.filter(c => c.n === 0);
    if (cerradas >= 3 && sinUsar.length) {
      out.push('Con ' + cerradas + ' área(s) cerradas, todavía no se ha usado: ' +
        sinUsar.map(c => EVENTOS[c.id].etq.toLowerCase()).join(', ') +
        '. O no se encuentran en el panel, o no se entiende para qué sirven.');
    }
    if (usadas.length) {
      const top = usadas.slice().sort((a, b) => b.n - a.n)[0];
      out.push('La capa más usada es «' + EVENTOS[top.id].etq.toLowerCase() + '» (' + top.n + ' vez/veces).');
    }

    const pdfs = n('pdf-generado');
    if (cerradas >= 3) {
      out.push(pdfs
        ? 'Se generaron ' + pdfs + ' informe(s) PDF sobre ' + cerradas + ' área(s) analizadas.'
        : 'Ningún análisis terminó en un informe PDF. Si el objetivo es que el estudiante entregue ' +
          'algo, conviene hacer más visible el botón de exportar.');
    }

    const vacias = n('area-vacia');
    if (vacias >= 3) {
      out.push('⚠️ ' + vacias + ' análisis cayeron sobre áreas sin nada mapeado. Puede que los estudiantes ' +
        'estén dibujando donde la comunidad aún no ha georreferenciado: conviene mostrarles antes dónde hay datos.');
    }
    const errRaster = n('raster-error');
    if (errRaster >= 2) {
      out.push('⚠️ El análisis de cobertura falló ' + errRaster + ' vez/veces. Revisar conexión o el ' +
        'servicio de imagen satelital.');
    }

    const friccion = r.eventos.filter(e => e.friccion && e.n > 0);
    if (!friccion.length && r.suma >= 10) {
      out.push('✅ No se registraron puntos de fricción en este periodo.');
    }
    return { frases: out, resumen: r };
  }

  // ── Panel del administrador ─────────────────────────────────────────────

  function esAdmin(){
    try {
      if (typeof window.urbisEsAdmin === 'function' && window.urbisEsAdmin()) return true;
      const w = window;
      if (w.userRole === 'gov') return true;
      const u = String(w.userUsernameGlobal || '').toLowerCase();
      return u === 'jesmen21' || u === 'jesmen21s' || u === 'urbisadmin';
    } catch(e) { return false; }
  }

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function htmlPanel(){
    if (!esAdmin()) return '';
    const { frases, resumen: r } = interpretar();
    const maxDia = Math.max(1, ...r.porDia.map(d => d.n));
    const barras = r.porDia.slice(-14).map(d =>
      '<div class="pca-an-dia" title="' + d.dia + ': ' + d.n + '">' +
        '<i style="height:' + Math.max(4, Math.round(100 * d.n / maxDia)) + '%"></i>' +
        '<span>' + d.dia.slice(8) + '</span></div>').join('');

    const filas = r.eventos.map(e =>
      '<div class="pca-an-fila' + (e.friccion ? ' friccion' : '') + '">' +
        '<span>' + esc(e.etq) + '</span>' +
        '<i><b style="width:' + Math.round(100 * e.n / Math.max(1, r.eventos[0].n)) + '%"></b></i>' +
        '<em>' + e.n + '</em></div>').join('');

    return '<div class="pca-analitica">' +
      '<div class="pca-an-cab"><b>📈 Analítica de uso</b><span>Solo administrador</span></div>' +
      '<p class="pca-an-ayuda">Cuenta qué funciones se usan y dónde se traban los estudiantes. ' +
        'No guarda coordenadas, nombres de área ni contenido de los análisis — solo conteos de este dispositivo.</p>' +
      (r.suma
        ? '<div class="pca-an-kpis">' +
            '<div><b>' + r.suma + '</b><small>acciones</small></div>' +
            '<div><b>' + r.dias + '</b><small>días con uso</small></div>' +
            '<div><b>' + (r.ultimoDia || '—') + '</b><small>último día</small></div>' +
          '</div>' +
          (barras ? '<div class="pca-an-grafico">' + barras + '</div>' : '') +
          '<div class="pca-an-lista">' + filas + '</div>'
        : '') +
      '<div class="pca-an-lectura"><b>🧠 Qué dice esto</b>' +
        frases.map(f => '<p>' + esc(f) + '</p>').join('') + '</div>' +
      '<div class="pca-an-btns">' +
        '<button type="button" data-u52-call="pca-an-copiar">📋 Copiar resumen</button>' +
        '<button type="button" data-u52-call="pca-an-borrar" class="pca-an-borrar">🗑️ Vaciar</button>' +
      '</div></div>';
  }

  function textoResumen(){
    const { frases, resumen: r } = interpretar();
    return 'ANALÍTICA DE USO · URBIS Pro City\n' +
      'Periodo: ' + (r.primerDia || '—') + ' a ' + (r.ultimoDia || '—') +
      ' · ' + r.suma + ' acciones en ' + r.dias + ' día(s)\n' +
      '─'.repeat(56) + '\n' +
      r.eventos.map(e => '· ' + e.etq + ': ' + e.n).join('\n') +
      '\n\nLECTURA\n' + frases.map(f => '- ' + f).join('\n');
  }

  function accion(name){
    if (name === 'an-copiar') {
      const t = textoResumen();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(
          () => alert('✅ Resumen copiado.'),
          () => alert(t));
      } else alert(t);
      return true;
    }
    if (name === 'an-borrar') {
      if (!confirm('¿Vaciar la analítica de uso de este dispositivo?')) return true;
      try { localStorage.removeItem(LS_KEY); } catch(e) {}
      if (typeof window.urbisProCityAbrirAnalisis === 'function') window.urbisProCityAbrirAnalisis();
      return true;
    }
    return false;
  }

  window.URBIS_PC_ANALITICA = { registrar, resumen, interpretar, htmlPanel, accion, esAdmin, textoResumen, EVENTOS };
})();
