/* URBIS · QUÉ PASÓ CON MI REPORTE (js/13d)
   ─────────────────────────────────────────────────────────────────────────
   Alguien publica un hueco y no vuelve a saber nada. Ni que se aprobó, ni que
   tres vecinos lo confirmaron, ni que alguien comentó, ni que se archivó. Sin
   retorno no hay segundo reporte: la persona concluye, con razón, que gritó al
   vacío.

   Cómo funciona
   ─────────────
   Todo se DEDUCE de los datos que la aplicación ya carga —los mismos reportes
   que pinta el mapa—, sin tocar el backend ni añadir una tabla de avisos. Es
   el mismo truco que ya usan las notificaciones de Juegos URBIS.

   La pieza clave es una FOTO local del estado en que quedaron mis reportes la
   última vez que miré (localStorage, nunca sale del aparato). Lo que se avisa
   es el CAMBIO respecto de esa foto, no el estado: si avisáramos por estado,
   al instalar la aplicación llegarían de golpe avisos de cosas que pasaron
   hace meses y todos serían mentira ("¡acaban de aprobar tu reporte!").

   Por eso la PRIMERA vez no se avisa nada: se guarda la foto en silencio. Es
   la única forma honesta de arrancar. A partir de ahí, cada cambio real se
   cuenta una sola vez.

   El único aviso que no nace de un cambio es el recordatorio de vigencia: un
   reporte propio del que nadie da noticias hace un mes. Ese sí es de estado, y
   por eso lleva su propia espera para no repetirse cada semana. */
(function () {
  'use strict';

  const FOTO = 'urbis_mis_reportes_foto_v1';
  const AVISADOS = 'urbis_mis_reportes_avisados_v1';
  const DIAS_RECORDATORIO = 30;
  // Una vez recordado que confirme un reporte suyo, no se le vuelve a insistir
  // hasta pasado otro mes. Un aviso repetido cada vez que abre la aplicación
  // deja de ser un aviso y pasa a ser una molestia que se aprende a ignorar.
  const ESPERA_RECORDATORIO_MS = 30 * 86400000;

  function leerJSON(clave, porDefecto) {
    try { return JSON.parse(localStorage.getItem(clave) || '') || porDefecto; }
    catch (e) { return porDefecto; }
  }
  function guardarJSON(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) {}
  }

  function datos() {
    try {
      if (typeof globalData !== 'undefined' && Array.isArray(globalData)) return globalData;
      if (Array.isArray(window.globalData)) return window.globalData;
    } catch (e) {}
    return [];
  }

  function mios() {
    if (typeof esAutorDelReporte !== 'function') return [];
    return datos().filter(function (p) {
      try {
        if (!p || !p.descripcion) return false;
        // Los comentarios y demás filas internas no son "mis reportes".
        if (typeof esFilaMetaUrbis === 'function' && esFilaMetaUrbis(p)) return false;
        return esAutorDelReporte(p);
      } catch (e) { return false; }
    });
  }

  // Retrato del estado de UN reporte: solo lo que, si cambia, merece un aviso.
  function retrato(p) {
    const d = String(p.descripcion || '').split(' | ');
    const base = (typeof BASE_OFFSET !== 'undefined') ? BASE_OFFSET : 43;
    const v = (typeof window.urbisVigenciaReporte === 'function') ? window.urbisVigenciaReporte(p)
            : { confirm:0, ongoing:0, gone:0, wrong:0, dias:null, hayQuePreguntar:false };
    let comentarios = 0;
    try { comentarios = (typeof window.urbisContarComentarios === 'function') ? window.urbisContarComentarios(p.lat) : 0; } catch (e) {}
    let archivado = false;
    try { archivado = !!(typeof obtenerMetaTemporal === 'function' && obtenerMetaTemporal(p).archivado); } catch (e) {}
    let oculto = false;
    try { oculto = (typeof window.urbisContenidoOculto === 'function') && window.urbisContenidoOculto(p); } catch (e) {}
    return {
      validacion: d[base + 1] || 'Aprobado',
      apoyos: v.confirm + v.ongoing,
      noEsta: v.gone,
      comentarios: comentarios,
      archivado: archivado,
      oculto: oculto,
      dias: v.dias,
      pregunta: !!v.hayQuePreguntar,
      titulo: (d[1] && d[1] !== 'N/A' ? d[1] : d[0]) || 'Tu reporte'
    };
  }

  function aviso(lat, id, icono, titulo, mensaje) {
    return { id: 'mireporte_' + id + '_' + String(lat).replace(/[^0-9]/g, ''),
             type: 'mi_reporte', icono: icono, title: titulo, message: mensaje, lat: String(lat) };
  }

  /* Devuelve los avisos nuevos sobre MIS reportes y actualiza la foto local.
     Se llama en cada carga de notificaciones. */
  window.urbisNotificacionesMisReportes = function () {
    const lista = mios();
    if (!lista.length) return [];

    const foto = leerJSON(FOTO, null);
    const nueva = {};
    const avisos = [];
    const primeraVez = !foto;

    lista.forEach(function (p) {
      const lat = String(p.lat);
      const r = retrato(p);
      nueva[lat] = r;
      if (primeraVez) return;         // arranque en silencio: ver cabecera
      const antes = foto[lat];
      if (!antes) return;             // reporte que aún no habíamos visto

      if (antes.validacion === 'Pendiente' && r.validacion === 'Aprobado') {
        avisos.push(aviso(lat, 'aprobado', '✅', 'Tu reporte ya está publicado',
          '“' + r.titulo + '” pasó la revisión y ahora lo ve todo el mundo en el mapa.'));
      }
      const nuevosApoyos = r.apoyos - (antes.apoyos || 0);
      if (nuevosApoyos > 0) {
        avisos.push(aviso(lat, 'apoyo', '👍',
          nuevosApoyos === 1 ? 'Alguien confirmó tu reporte' : nuevosApoyos + ' personas confirmaron tu reporte',
          '“' + r.titulo + '” sigue vigente según la gente que pasa por ahí.'));
      }
      const nuevosNoEsta = r.noEsta - (antes.noEsta || 0);
      if (nuevosNoEsta > 0) {
        avisos.push(aviso(lat, 'yano', '👌', 'Dicen que tu reporte ya se resolvió',
          nuevosNoEsta + (nuevosNoEsta === 1 ? ' persona dice' : ' personas dicen') +
          ' que “' + r.titulo + '” ya no está. Si sigue ahí, entra y confírmalo.'));
      }
      const nuevosComentarios = r.comentarios - (antes.comentarios || 0);
      if (nuevosComentarios > 0) {
        avisos.push(aviso(lat, 'coment', '💬',
          nuevosComentarios === 1 ? 'Comentaron tu reporte' : nuevosComentarios + ' comentarios nuevos',
          'Hay respuestas en “' + r.titulo + '”.'));
      }
      if (!antes.archivado && r.archivado) {
        avisos.push(aviso(lat, 'archivado', '📦', 'Tu reporte se archivó',
          '“' + r.titulo + '” salió del mapa activo. Queda guardado en el histórico de URBIS.'));
      }
      if (!antes.oculto && r.oculto) {
        avisos.push(aviso(lat, 'oculto', '🚩', 'Tu contenido está en revisión',
          '“' + r.titulo + '” se escondió del mapa porque alguien lo denunció. Un moderador lo va a mirar; si fue un error, vuelve.'));
      }
    });

    guardarJSON(FOTO, nueva);

    // Recordatorio de vigencia: no es un cambio, es una situación que se
    // arregla con dos toques. Se pide como mucho una vez al mes por reporte.
    const avisados = leerJSON(AVISADOS, {});
    const ahora = Date.now();
    lista.forEach(function (p) {
      const lat = String(p.lat);
      const r = nueva[lat];
      if (!r || !r.pregunta || r.archivado || r.oculto) return;
      const ultimo = Number(avisados[lat] || 0);
      if (ahora - ultimo < ESPERA_RECORDATORIO_MS) return;
      avisados[lat] = ahora;
      avisos.push(aviso(lat, 'recordatorio', '🕗', '¿Tu reporte sigue vigente?',
        'Nadie da noticias de “' + r.titulo + '” desde hace ' +
        (typeof window.urbisHaceCuanto === 'function' ? window.urbisHaceCuanto(r.dias).replace('hace ', '') : r.dias + ' días') +
        '. Confírmalo para que no se caiga del mapa.'));
    });
    guardarJSON(AVISADOS, avisados);

    return avisos;
  };

  /* Abre en el mapa el reporte de un aviso. Sin esto la notificación cuenta
     algo y deja a la persona buscándolo a mano. */
  window.urbisAbrirReportePorLat = function (lat) {
    const p = (typeof buscarPuntoPorLat === 'function') ? buscarPuntoPorLat(lat) : null;
    if (!p) { alert('Ese reporte ya no está disponible.'); return; }
    try {
      if (window.UrbisMobileAppV58 && typeof window.UrbisMobileAppV58.show === 'function') {
        window.UrbisMobileAppV58.show('map');
      }
    } catch (e) {}
    try {
      const m = (typeof map !== 'undefined' && map) ? map : window.map;
      if (m && m.setView) m.setView([parseFloat(p.lat), parseFloat(p.lng)], 18);
    } catch (e) {}
    try { if (typeof mostrarDetalles === 'function') mostrarDetalles(p); } catch (e) {}
  };

  // Al cerrar sesión o cambiar de cuenta, la foto del usuario anterior no sirve
  // (sus reportes no son los míos) y produciría avisos falsos.
  window.urbisOlvidarFotoMisReportes = function () {
    try { localStorage.removeItem(FOTO); localStorage.removeItem(AVISADOS); } catch (e) {}
  };
})();
