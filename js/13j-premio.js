/* URBIS · EL PREMIO DE LOS JUEGOS URBIS (js/13j)
   ─────────────────────────────────────────────────────────────────────────
   Un evento premium promete dinero real al #1. Hasta la v792, al terminar
   el evento no pasaba NADA: el hub decía «Ganador: @x», el popup prometía
   que «URBIS contactará al ganador», y ninguna de las dos cosas movía un
   dedo. Ni el ganador se enteraba si no volvía a abrir el evento, ni los
   administradores sabían que había que pagar, ni había dónde hablar de la
   transacción. El logro «Campeón 50K» no se podía ganar nunca.

   Qué hace este archivo, en el orden en que pasa
   ─────────────────────────────────────────────
   1 · El evento termina (su vigencia vence). Este módulo mira los eventos
       premium terminados hace menos de 45 días y pide su tabla al servidor
       (la misma que ve el hub). El #1 de esa tabla es el ganador.
   2 · Si el ganador soy yo: aviso en la campanita —«¡Ganaste!»— con un
       botón de RECLAMAR. Reclamar escribe una FILA COMPARTIDA en la hoja
       (tipo «🏆 Premio URBIS», lat 0 / lng 0, sin marcador en el mapa) con
       ganador, evento, premio y estado «reclamado», y manda un mensaje al
       chat de la cuenta administradora. Es lo que hace que la petición le
       llegue a TODOS los administradores: la fila la carga todo el mundo
       —igual que las gotas de los eventos— y cada teléfono que es admin la
       convierte en un aviso propio. No hace falta una lista de admins ni
       tocar el servidor.
   3 · Cada administrador ve «Premio por pagar» con el ranking a un toque
       (para comprobar que el reclamo es cierto), un botón de CHAT con el
       ganador y otro de ATENDER. Atender pone la fila en «en-pago» con su
       nombre —así los demás admins ven quién lo tomó— y abre el chat con un
       primer mensaje que pide el medio de pago. Marcar PAGADO cierra la
       fila y avisa por el mismo chat.
   4 · El chat entre el ganador y el administrador es el de siempre (1 a 1,
       js/12), y por eso es exclusivo: nadie más lo lee. Mientras exista un
       reclamo entre esas dos personas, la ventana lleva arriba un banner con
       el evento, el premio y el estado, para que no se mezcle con una charla
       cualquiera.

   Qué NO hace, a propósito
   ────────────────────────
   · No decide quién ganó: lo dice la tabla del servidor. Un reclamo que no
     coincide con ella se ve en el aviso del admin («el ranking dice otra
     cosa») y no se atiende.
   · No paga: registra y comunica. El dinero lo mueve una persona.
   · No mete filas de premio en el mapa ni en «mis reportes»: js/05, js/12 y
     js/47 las tratan como filas internas.                                  */
(function () {
  'use strict';

  const TIPO = '🏆 Premio URBIS';
  const SEP = '~~~';
  const DIAS_VENTANA = 45;
  const LB_TTL_MS = 30 * 60000;
  const K_LB = 'urbis_premio_lb_';
  const K_VISTOS = 'urbis_premio_vistos_v1';
  const K_AVISADOS = 'urbis_premio_avisados_v1';
  const K_POS = 'urbis_premio_pos_v1';   // mi último puesto conocido por evento

  const ESTADOS = {
    'reclamado': { t: 'Reclamado',  cls: 'rec', d: 'El ganador pidió su premio. Falta que un administrador lo atienda.' },
    'en-pago':   { t: 'En pago',    cls: 'pago', d: 'Un administrador lo está atendiendo por el chat.' },
    'pagado':    { t: 'Pagado',     cls: 'ok', d: 'Premio entregado. Caso cerrado.' }
  };

  // ── Utilidades ───────────────────────────────────────────────────────────
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function leerJSON(k, def) { try { return JSON.parse(localStorage.getItem(k) || '') || def; } catch (e) { return def; } }
  function guardarJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function yo() { try { return String((window.urbisUsuarioActual && window.urbisUsuarioActual()) || '').trim(); } catch (e) { return ''; } }
  function esAdmin() { try { return typeof window.urbisEsAdmin === 'function' && window.urbisEsAdmin(); } catch (e) { return false; } }
  function adminPorDefecto() { return String((window.URBIS_CONFIG && window.URBIS_CONFIG.ADMIN_USER) || 'urbisadmin').toLowerCase(); }
  function mismo(a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); }
  function datos() {
    try {
      if (typeof globalData !== 'undefined' && Array.isArray(globalData)) return globalData;
      if (Array.isArray(window.globalData)) return window.globalData;
    } catch (e) {}
    return [];
  }
  function metaDe(p) {
    try { if (typeof obtenerMetaTemporal === 'function') return obtenerMetaTemporal(p); } catch (e) {}
    try { if (typeof window.obtenerMetaTemporal === 'function') return window.obtenerMetaTemporal(p); } catch (e) {}
    return { archivado: false, expira: null };
  }
  function fechaCorta(d) {
    try { if (typeof formatearFechaHora === 'function') return formatearFechaHora(d); } catch (e) {}
    try { return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ''; }
  }
  function api(payload) {
    if (window.URBIS_AUTH && typeof window.URBIS_AUTH.socialAPI === 'function') return window.URBIS_AUTH.socialAPI(payload);
    return Promise.reject(new Error('Auth no disponible'));
  }
  function toast(t, m) { try { if (typeof showAchievementToast === 'function') showAchievementToast(t, m); } catch (e) {} }
  function limpiarCampo(s) { return String(s == null ? '' : s).replace(/~~~/g, '-').replace(/\s*\|\s*/g, ' / ').trim(); }

  // ── La fila del premio ───────────────────────────────────────────────────
  // ganador ~~~ juegoId ~~~ titulo ~~~ premio ~~~ estado ~~~ admin ~~~ fecha ~~~ nota
  function leerFila(p) {
    const d = String((p && p.descripcion) || '').split(SEP);
    return {
      ganador: String(d[0] || '').trim().toLowerCase(),
      juegoId: String(d[1] || '').trim(),
      titulo: String(d[2] || '').trim(),
      premio: String(d[3] || '').trim(),
      estado: ESTADOS[String(d[4] || '').trim()] ? String(d[4]).trim() : 'reclamado',
      admin: String(d[5] || '').trim().toLowerCase(),
      fecha: String(d[6] || '').trim(),
      nota: String(d[7] || '').trim(),
      fila: p
    };
  }
  function sobreDe(o) {
    return [o.ganador, o.juegoId, limpiarCampo(o.titulo), limpiarCampo(o.premio), o.estado, o.admin || '', o.fecha || new Date().toISOString(), limpiarCampo(o.nota || '')].join(SEP);
  }
  function filasPremio() {
    return (window.urbisPremiosFilas || []).map(leerFila).filter(x => x.juegoId && x.ganador);
  }
  function reclamoDe(juegoId, ganador) {
    const lista = filasPremio().filter(r => r.juegoId === juegoId && (!ganador || mismo(r.ganador, ganador)));
    // Si hubiera más de uno (dos toques al botón), manda el más avanzado.
    const peso = { 'pagado': 3, 'en-pago': 2, 'reclamado': 1 };
    lista.sort((a, b) => (peso[b.estado] || 0) - (peso[a.estado] || 0));
    return lista[0] || null;
  }

  // ── Los eventos premium y su tabla ───────────────────────────────────────
  function esPremium(p) { try { return typeof window.urbisEsEventoAurea === 'function' && window.urbisEsEventoAurea(p); } catch (e) { return false; } }
  function eventoDe(p) {
    const d = String(p.descripcion || '').split(' | ');
    const notas = String(d[2] || '');
    const sacar = (re, def) => { const m = notas.match(re); return m ? m[1].trim() : def; };
    const meta = metaDe(p);
    let fin = sacar(/termina\s*([^·|]+)/i, '');
    if (!fin && meta.expira) fin = fechaCorta(meta.expira);
    return {
      p: p,
      lat: String(p.lat),
      juegoId: 'aurea_' + String(p.lat).replace(/[^0-9]/g, ''),
      titulo: String(d[1] || 'Juegos URBIS').trim(),
      premio: sacar(/Premio:\s*([^·|]+)/i, 'Premio sorpresa'),
      detalle: sacar(/Detalle:\s*([^·|]+)/i, ''),
      fin: fin,
      expira: meta.expira,
      terminado: !!meta.archivado
    };
  }
  function eventosPremium() { return datos().filter(esPremium).map(eventoDe); }
  function eventoPorJuego(juegoId) { return eventosPremium().find(e => e.juegoId === juegoId) || null; }
  function terminadosRecientes() {
    const ahora = Date.now();
    return eventosPremium().filter(e => {
      if (!e.terminado) return false;
      const t = e.expira ? e.expira.getTime() : 0;
      return !t || (ahora - t) < DIAS_VENTANA * 86400000;
    });
  }

  const enVuelo = {};
  function tablaCache(juegoId) { return leerJSON(K_LB + juegoId, null); }
  // La tabla del servidor, con caché de media hora. Si todavía no llegó,
  // devuelve null y la pide; al llegar, rehace los avisos.
  function tablaDe(juegoId) {
    const c = tablaCache(juegoId);
    if (c && Array.isArray(c.tabla) && (Date.now() - (c.t || 0)) < LB_TTL_MS) return c.tabla;
    if (!enVuelo[juegoId]) {
      // Veinte y no cinco: con cinco no se sabe en qué puesto voy, y el aviso
      // de «te pasaron» necesita mi posición, no solo quién va de líder.
      enVuelo[juegoId] = api({ action: 'leaderboard', juego: juegoId, limit: 20 })
        .then(out => {
          const tabla = (out && out.ok && Array.isArray(out.tabla)) ? out.tabla : [];
          guardarJSON(K_LB + juegoId, { t: Date.now(), tabla: tabla });
          recargarAvisos();
        })
        .catch(() => {})
        .then(() => { delete enVuelo[juegoId]; });
    }
    return (c && Array.isArray(c.tabla)) ? c.tabla : null;
  }
  function ganadorDe(juegoId) {
    const t = tablaDe(juegoId);
    if (!t || !t.length) return null;
    return { usuario: String(t[0].usuario || '').trim(), puntos: parseInt(t[0].puntos, 10) || 0 };
  }

  // ── Vistos y avisados ────────────────────────────────────────────────────
  function vistos() { return new Set(leerJSON(K_VISTOS, [])); }
  function marcarVistos(ids) { const s = vistos(); ids.forEach(id => s.add(id)); guardarJSON(K_VISTOS, [...s]); }
  function avisar(n) {
    const s = new Set(leerJSON(K_AVISADOS, []));
    if (s.has(n.id)) return;
    s.add(n.id); guardarJSON(K_AVISADOS, [...s]);
    toast(n.titulo, n.mensaje);
  }
  let _ultimos = [];
  window.urbisPremioMarcarVistos = function () {
    marcarVistos(_ultimos.filter(n => n.sub !== 'pagar').map(n => n.id));
  };

  let _t = null;
  function recargarAvisos() {
    clearTimeout(_t);
    _t = setTimeout(() => {
      try { if (typeof window.urbisCargarNotificaciones === 'function') window.urbisCargarNotificaciones(); } catch (e) {}
      try {
        const pant = document.querySelector('.u52-screen[data-u52-screen="aurea"]');
        if (pant && pant.classList.contains('active') && typeof window.urbisRenderAureaHub === 'function') window.urbisRenderAureaHub();
      } catch (e) {}
    }, 250);
  }

  /* ── «Te pasaron» ─────────────────────────────────────────────────────
     Hasta acá, uno jugaba, veía su puesto, y no volvía a saber nada hasta
     que el evento terminaba. Si alguien lo superaba el martes, se enteraba
     el viernes —cuando ya no había nada que hacer—. En una competencia por
     dinero eso es perder al jugador y perder la partida que habría vuelto a
     jugar.

     El puesto se guarda por evento y se compara con el de la última vez. Si
     bajó, se avisa. No se avisa al subir: quedar mejor ya se ve al jugar, y
     un aviso por cada movimiento sería ruido.

     La primera vez que aparezco en una tabla NO avisa: solo anota. Si no,
     entrar a un evento donde ya hay gente arriba se leería como «te
     pasaron», y a nadie lo pasaron todavía.

     El retraso es de hasta media hora, que es lo que dura la caché de la
     tabla. Se dice acá para que nadie lo lea como tiempo real.            */
  function puestos() { return leerJSON(K_POS, {}) || {}; }
  function guardarPuesto(juegoId, pos) { const m = puestos(); m[juegoId] = pos; guardarJSON(K_POS, m); }
  function ordinal(n) { return n + (n === 1 ? '°' : '°'); }
  function miPuesto(tabla, u) {
    const i = tabla.findIndex(r => mismo(r.usuario, u));
    // Fuera de los veinte que se piden: se sabe que voy peor que el último,
    // no exactamente dónde. Decir «21°» sería inventar una cifra.
    return i >= 0 ? { pos: i + 1, exacto: true } : { pos: tabla.length + 1, exacto: false };
  }
  function avisosDeAdelantamiento(u, meter) {
    eventosPremium().filter(e => !e.terminado).forEach(ev => {
      const t = tablaDe(ev.juegoId);
      if (!t || !t.length) return;                 // todavía cargando, o nadie ha jugado
      const antes = puestos()[ev.juegoId];
      const m = miPuesto(t, u);
      // Nunca he jugado este evento: ni aviso ni anotación.
      if (antes == null && !m.exacto) return;
      guardarPuesto(ev.juegoId, m.pos);
      if (antes == null || m.pos <= antes) return; // primera vez, o subí: nada que decir
      const queda = restante(ev.expira);
      const donde = m.exacto ? ('vas ' + ordinal(m.pos)) : ('te saliste del top ' + t.length);
      meter({ type: 'premio', sub: 'pasado', id: 'premio_pasado_' + ev.juegoId + '_' + m.pos, ev: ev,
              pos: m.pos, antes: antes,
              titulo: '📉 Te pasaron en «' + ev.titulo + '»',
              mensaje: 'Ibas ' + ordinal(antes) + ' y ' + donde + '. ' +
                       (queda ? queda + '. ' : '') + 'Todavía puedes recuperarlo.' });
    });
  }

  // ── Los avisos ───────────────────────────────────────────────────────────
  // Devuelve { lista, nuevos }. `nuevos` es lo que cuenta la campanita: para
  // el ganador, lo que no ha visto; para el administrador, cada premio por
  // pagar cuenta MIENTRAS esté pendiente —es una tarea, no una noticia—.
  window.urbisNotificacionesPremio = function () {
    const u = yo();
    if (!u) { _ultimos = []; return { lista: [], nuevos: 0 }; }
    const v = vistos();
    const lista = [];
    let nuevos = 0;
    const meter = (n) => { lista.push(n); if (n.sub === 'pagar') nuevos++; else if (!v.has(n.id)) nuevos++; avisar(n); };

    avisosDeAdelantamiento(u, meter);

    terminadosRecientes().forEach(ev => {
      const g = ganadorDe(ev.juegoId);
      if (!g || !mismo(g.usuario, u)) return;
      const rec = reclamoDe(ev.juegoId, u);
      if (!rec) {
        meter({ type: 'premio', sub: 'ganaste', id: 'premio_ganaste_' + ev.juegoId, ev: ev, puntos: g.puntos,
                titulo: '🏆 ¡Ganaste «' + ev.titulo + '»!', mensaje: 'Quedaste #1 con ' + g.puntos + ' pts. Reclama tu premio: ' + ev.premio + '.' });
      } else {
        const e = ESTADOS[rec.estado];
        meter({ type: 'premio', sub: 'mio', id: 'premio_mio_' + ev.juegoId + '_' + rec.estado, ev: ev, rec: rec,
                titulo: (rec.estado === 'pagado' ? '✅ Premio pagado · ' : '🏆 Tu premio · ') + ev.titulo,
                mensaje: e.t + ': ' + e.d });
      }
    });

    if (esAdmin()) {
      filasPremio().filter(r => r.estado !== 'pagado').forEach(r => {
        const ev = eventoPorJuego(r.juegoId);
        const g = ganadorDe(r.juegoId);
        meter({ type: 'premio', sub: 'pagar', id: 'premio_pagar_' + r.juegoId + '_' + r.ganador, rec: r, ev: ev,
                coincide: g ? mismo(g.usuario, r.ganador) : null,
                titulo: '💸 Premio por pagar · ' + (r.titulo || (ev && ev.titulo) || r.juegoId),
                mensaje: '@' + r.ganador + ' reclama ' + (r.premio || 'el premio') + '. ' + ESTADOS[r.estado].t + (r.admin ? ' · lo atiende @' + r.admin : '') + '.' });
      });
      terminadosRecientes().forEach(ev => {
        const g = ganadorDe(ev.juegoId);
        if (!g || reclamoDe(ev.juegoId)) return;
        meter({ type: 'premio', sub: 'termino', id: 'premio_termino_' + ev.juegoId, ev: ev, ganador: g,
                titulo: '🏁 Terminó «' + ev.titulo + '»', mensaje: 'Ganó @' + g.usuario + ' con ' + g.puntos + ' pts. Todavía no reclama el premio (' + ev.premio + ').' });
      });
    }
    _ultimos = lista;
    return { lista: lista, nuevos: nuevos };
  };

  function boton(accion, texto, attrs, cls) {
    const a = Object.keys(attrs || {}).map(k => ' data-premio-' + k + '="' + esc(attrs[k]) + '"').join('');
    return '<button type="button" class="' + (cls || '') + '" data-premio-accion="' + accion + '"' + a + '>' + texto + '</button>';
  }
  function chipEstado(estado) {
    const e = ESTADOS[estado] || ESTADOS.reclamado;
    return '<em class="premio-estado premio-estado-' + e.cls + '">' + esc(e.t) + '</em>';
  }

  // La tarjeta de la campanita. Misma rejilla que las demás (.u52-noti-card).
  window.urbisTarjetaPremioHTML = function (n) {
    const ev = n.ev || {};
    const rec = n.rec || null;
    const juego = (ev.juegoId || (rec && rec.juegoId) || '');
    const titulo = ev.titulo || (rec && rec.titulo) || 'Juegos URBIS';
    const premio = ev.premio || (rec && rec.premio) || '';
    const cab = '<span>🏆</span><div><b>' + esc(n.titulo) + '</b><small>' + esc(n.mensaje) + '</small>' +
                (rec ? chipEstado(rec.estado) : '') + '</div>';
    let acciones = '';
    if (n.sub === 'ganaste') {
      acciones = '<div class="u52-noti-actions premio-acciones">' +
        boton('reclamar', '🏆 Reclamar premio', { juego: juego }, 'premio-btn-oro') +
        boton('ranking', 'Ver ranking', { juego: juego, titulo: titulo }, 'ghost') + '</div>';
    } else if (n.sub === 'mio') {
      const con = rec.admin || adminPorDefecto();
      acciones = '<div class="u52-noti-actions premio-acciones">' +
        boton('chat', '💬 Chat del premio' + (rec.admin ? ' · @' + esc(rec.admin) : ''), { con: con, juego: juego }, 'premio-btn-oro') +
        boton('ranking', 'Ver ranking', { juego: juego, titulo: titulo }, 'ghost') + '</div>';
    } else if (n.sub === 'pagar') {
      const desc = rec.fila ? String(rec.fila.descripcion || '') : '';
      const aviso = n.coincide === false
        ? '<small class="premio-alerta">⚠️ El ranking del servidor dice otro ganador. No lo atiendas sin comprobar.</small>'
        : (n.coincide === null ? '<small class="premio-alerta">Comprobando el ranking…</small>' : '');
      // Sin Atender cuando la tabla del servidor dice otro ganador: lo que
      // no coincide se mira, no se paga.
      const puedeAtender = rec.estado === 'reclamado' && n.coincide !== false;
      acciones = aviso + '<div class="u52-noti-actions premio-acciones premio-acciones-3">' +
        boton('chat', '💬 Chat con @' + esc(rec.ganador), { con: rec.ganador, juego: juego }, 'premio-btn-oro') +
        (puedeAtender ? boton('atender', '✋ Atender', { desc: desc }, '') : boton('pagado', '✅ Marcar pagado', { desc: desc }, '')) +
        boton('ranking', 'Ranking', { juego: juego, titulo: titulo }, 'ghost') + '</div>';
    } else if (n.sub === 'pasado') {
      /* Un aviso de que te pasaron sin un botón para volver a jugar es una
         mala noticia y nada más. El de jugar va primero. */
      acciones = '<div class="u52-noti-actions premio-acciones">' +
        boton('jugar', '⚡ Recuperar el puesto', { juego: juego, titulo: titulo }, 'premio-btn-oro') +
        boton('ranking', 'Ver ranking', { juego: juego, titulo: titulo }, 'ghost') + '</div>';
    } else if (n.sub === 'termino') {
      acciones = '<div class="u52-noti-actions premio-acciones">' +
        boton('chat', '💬 Escribir a @' + esc(n.ganador.usuario), { con: n.ganador.usuario, juego: juego }, 'premio-btn-oro') +
        boton('ranking', 'Ver ranking', { juego: juego, titulo: titulo }, 'ghost') + '</div>';
    }
    return '<div class="u52-noti-card premio premio-' + esc(n.sub) + '" data-premio-id="' + esc(n.id) + '">' + cab + acciones + '</div>';
  };

  // ── Acciones ─────────────────────────────────────────────────────────────
  function mensajeReclamo(ev, u) {
    return '🏆 Reclamo del premio de «' + ev.titulo + '» (' + ev.juegoId + '). Quedé #1. Premio: ' + ev.premio + '. Soy @' + u + '. Cuéntenme cómo me lo envían.';
  }
  function mensajeAtiendo(rec, admin) {
    return 'Hola @' + rec.ganador + ', soy @' + admin + ' de URBIS. Vi que ganaste «' + rec.titulo + '» y te atiendo el pago de ' + rec.premio + '. ¿Por qué medio te lo enviamos (Nequi, Daviplata, cuenta bancaria) y a qué número?';
  }
  function mensajePagado(rec, admin) {
    return '✅ Premio de «' + rec.titulo + '» (' + rec.premio + ') enviado. Lo marco como pagado. ¡Felicitaciones, @' + rec.ganador + '! — @' + admin;
  }
  function enviar(a, texto) {
    return new Promise(res => {
      try { if (typeof window.urbisEnviarMensaje === 'function') return window.urbisEnviarMensaje(a, texto, () => res(true)); } catch (e) {}
      res(false);
    });
  }
  function abrirChat(con) {
    try { if (typeof window.urbisAbrirChat === 'function') window.urbisAbrirChat(con, '@' + con); } catch (e) {}
  }

  window.urbisReclamarPremio = async function (juegoId) {
    const u = yo();
    if (!u) { alert('Inicia sesión con la cuenta que jugó para reclamar el premio.'); return false; }
    const ev = eventoPorJuego(juegoId);
    if (!ev) { alert('No encontramos ese evento.'); return false; }
    if (!ev.terminado) { alert('El evento todavía no termina. El premio se reclama cuando cierre la competencia.'); return false; }
    const g = ganadorDe(juegoId);
    if (!g) { alert('Todavía no llega la tabla del evento. Intenta en un momento.'); return false; }
    if (!mismo(g.usuario, u)) { alert('El ranking del evento dice que el #1 es @' + g.usuario + '. Solo el #1 puede reclamar.'); return false; }
    const ya = reclamoDe(juegoId, u);
    if (ya) { abrirChat(ya.admin || adminPorDefecto()); return true; }
    const ahora = new Date().toISOString();
    const o = { ganador: u.toLowerCase(), juegoId: juegoId, titulo: ev.titulo, premio: ev.premio, estado: 'reclamado', admin: '', fecha: ahora, nota: g.puntos + ' pts' };
    const fila = { tipo: TIPO, lat: '0', lng: '0', descripcion: sobreDe(o), fecha: ahora };
    try {
      if (typeof window.urbisGuardarFila !== 'function') throw new Error('Sin conexión con la hoja');
      await window.urbisGuardarFila(fila);
    } catch (e) {
      alert('No se pudo registrar el reclamo: ' + (e && e.message || e));
      return false;
    }
    (window.urbisPremiosFilas = window.urbisPremiosFilas || []).push(fila);
    await enviar(adminPorDefecto(), mensajeReclamo(ev, u));
    toast('🏆 Premio reclamado', 'Los administradores de URBIS ya lo ven. Te escribirán por el chat del premio.');
    recargarAvisos();
    abrirChat(adminPorDefecto());
    return true;
  };

  async function cambiarEstado(descVieja, estado) {
    if (!esAdmin()) { alert('Solo un administrador de URBIS puede hacer esto.'); return false; }
    const admin = yo().toLowerCase();
    const fila = (window.urbisPremiosFilas || []).find(p => String(p.descripcion || '') === descVieja);
    if (!fila) { alert('No encontramos el reclamo. Actualiza y vuelve a intentar.'); return false; }
    const rec = leerFila(fila);
    const nuevo = sobreDe(Object.assign({}, rec, { estado: estado, admin: estado === 'en-pago' ? admin : (rec.admin || admin) }));
    try {
      if (typeof window.urbisDBUpdate !== 'function') throw new Error('Sin conexión con la hoja');
      await window.urbisDBUpdate('descripcion', descVieja, { descripcion: nuevo });
    } catch (e) {
      alert('No se pudo actualizar el premio: ' + (e && e.message || e));
      return false;
    }
    fila.descripcion = nuevo;
    const rec2 = leerFila(fila);
    await enviar(rec2.ganador, estado === 'pagado' ? mensajePagado(rec2, admin) : mensajeAtiendo(rec2, admin));
    toast(estado === 'pagado' ? '✅ Premio pagado' : '✋ Premio en pago', '@' + rec2.ganador + ' · ' + rec2.titulo);
    recargarAvisos();
    if (estado === 'en-pago') abrirChat(rec2.ganador);
    return true;
  }
  window.urbisAtenderPremio = function (desc) { return cambiarEstado(desc, 'en-pago'); };
  window.urbisMarcarPremioPagado = function (desc) { return cambiarEstado(desc, 'pagado'); };

  document.addEventListener('click', function (ev) {
    const b = ev.target && ev.target.closest ? ev.target.closest('[data-premio-accion]') : null;
    if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    const a = b.dataset.premioAccion, ds = b.dataset;
    if (a === 'reclamar') window.urbisReclamarPremio(ds.premioJuego);
    else if (a === 'chat') abrirChat(ds.premioCon);
    else if (a === 'atender') { b.disabled = true; window.urbisAtenderPremio(ds.premioDesc).then(ok => { if (!ok) b.disabled = false; }); }
    else if (a === 'pagado') { if (confirm('¿Ya enviaste el premio? Se marcará como pagado y se le avisará al ganador por el chat.')) { b.disabled = true; window.urbisMarcarPremioPagado(ds.premioDesc).then(ok => { if (!ok) b.disabled = false; }); } }
    else if (a === 'jugar') { try { if (typeof window.urbisJugarAurea === 'function') window.urbisJugarAurea(ds.premioJuego, ds.premioTitulo); } catch (e) {} }
    else if (a === 'ranking') { try { if (typeof window.urbisVerGanadorAurea === 'function') window.urbisVerGanadorAurea(ds.premioJuego, ds.premioTitulo); } catch (e) {} }
    else if (a === 'abrir') { try { if (typeof window.urbisAbrirAureaModulo === 'function') window.urbisAbrirAureaModulo(ds.premioJuego, ds.premioTitulo, ds.premioPremio, ds.premioFin, ds.premioTerminado === '1'); } catch (e) {} }
  }, true);

  // ── El banner del chat ───────────────────────────────────────────────────
  // Si entre yo y `otro` hay un reclamo (yo ganador y él admin, o al revés),
  // el chat es el chat del premio y lo dice arriba.
  window.urbisChatBannerPremio = function (otro) {
    const u = yo(); if (!u || !otro) return '';
    const soyAdmin = esAdmin();
    const rec = filasPremio().find(r =>
      (mismo(r.ganador, u) && (mismo(r.admin, otro) || (!r.admin && mismo(otro, adminPorDefecto())))) ||
      (mismo(r.ganador, otro) && (soyAdmin || mismo(r.admin, u))));
    if (!rec) return '';
    const e = ESTADOS[rec.estado] || ESTADOS.reclamado;
    return '<div class="premio-chat-banner premio-estado-' + e.cls + '" data-premio-banner>' +
      '<span class="premio-chat-ico">🏆</span><div><b>Chat del premio · ' + esc(rec.titulo) + '</b>' +
      '<small>' + esc(rec.premio) + ' · ganador @' + esc(rec.ganador) + ' · ' + esc(e.t) + (rec.admin ? ' · atiende @' + esc(rec.admin) : '') + '</small></div>' +
      (soyAdmin && rec.estado !== 'pagado'
        ? boton(rec.estado === 'reclamado' ? 'atender' : 'pagado', rec.estado === 'reclamado' ? '✋ Atender' : '✅ Pagado', { desc: String(rec.fila.descripcion || '') }, 'premio-chat-btn')
        : '') +
      '</div>';
  };

  // ── El bloque del ganador en el hub, cuando el evento terminó ────────────
  window.urbisBloqueGanadorHTML = function (ctx, lista) {
    if (!ctx || !ctx.terminado || !lista || !lista.length) return '';
    const u = yo();
    const top = lista[0];
    const rec = reclamoDe(ctx.juegoId);
    if (u && mismo(top.usuario, u)) {
      if (!rec) {
        return '<div class="premio-hub premio-hub-gana"><b>🏆 ¡Ganaste este evento!</b><small>' + esc(ctx.premio) + ' · reclámalo y un administrador de URBIS te escribe por el chat.</small>' +
          boton('reclamar', '🏆 Reclamar mi premio', { juego: ctx.juegoId }, 'premio-btn-oro premio-hub-btn') + '</div>';
      }
      const e = ESTADOS[rec.estado];
      return '<div class="premio-hub premio-estado-' + e.cls + '"><b>' + (rec.estado === 'pagado' ? '✅ Premio pagado' : '🏆 Tu premio: ' + esc(e.t)) + '</b><small>' + esc(e.d) + '</small>' +
        boton('chat', '💬 Chat del premio', { con: rec.admin || adminPorDefecto(), juego: ctx.juegoId }, 'premio-btn-oro premio-hub-btn') + '</div>';
    }
    if (esAdmin() && rec) {
      const e = ESTADOS[rec.estado];
      return '<div class="premio-hub premio-estado-' + e.cls + '"><b>💸 Pago del premio: ' + esc(e.t) + '</b><small>@' + esc(rec.ganador) + ' · ' + esc(rec.premio) + (rec.admin ? ' · atiende @' + esc(rec.admin) : '') + '</small>' +
        boton('chat', '💬 Chat con @' + esc(rec.ganador), { con: rec.ganador, juego: ctx.juegoId }, 'premio-btn-oro premio-hub-btn') + '</div>';
    }
    if (esAdmin()) {
      return '<div class="premio-hub"><b>🏁 Ganó @' + esc(top.usuario) + '</b><small>Todavía no reclama el premio.</small>' +
        boton('chat', '💬 Escribirle', { con: top.usuario, juego: ctx.juegoId }, 'premio-btn-oro premio-hub-btn') + '</div>';
    }
    return '';
  };

  // ── La tarjeta del evento premium en la lista de Eventos ─────────────────
  function restante(expira) {
    if (!expira) return '';
    const ms = expira.getTime() - Date.now();
    if (isNaN(ms)) return '';
    if (ms <= 0) return 'Terminado';
    const h = Math.floor(ms / 3600000);
    if (h >= 48) return 'Faltan ' + Math.floor(h / 24) + ' días';
    if (h >= 1) return 'Termina en ' + h + ' h';
    return 'Termina en ' + Math.max(1, Math.round(ms / 60000)) + ' min';
  }
  window.urbisTarjetaEventoPremiumHTML = function (p) {
    if (!esPremium(p)) return '';
    const ev = eventoDe(p);
    const t = tablaCache(ev.juegoId);
    const lider = (t && Array.isArray(t.tabla) && t.tabla[0]) ? t.tabla[0] : null;
    const n = (t && Array.isArray(t.tabla)) ? t.tabla.length : 0;
    return '<article class="ev-movil-card ev-premium-evento' + (ev.terminado ? ' ev-arch' : '') + '">' +
      '<div class="ev-premium-top"><span class="ev-premium-badge">✨ JUEGOS URBIS · PREMIUM</span>' +
        '<span class="ev-premium-tiempo">' + esc(ev.terminado ? '🏁 Terminado' : '⏳ ' + (restante(ev.expira) || ev.fin)) + '</span></div>' +
      '<h3 class="ev-premium-titulo">' + esc(ev.titulo) + '</h3>' +
      '<div class="ev-premium-premio"><small>El #1 se lleva</small><b>' + esc(ev.premio) + '</b><span>dinero real</span></div>' +
      (ev.detalle ? '<p class="ev-premium-detalle">' + esc(ev.detalle) + '</p>' : '') +
      '<div class="ev-premium-meta">' +
        (lider ? '<span>🥇 @' + esc(lider.usuario) + ' · ' + (parseInt(lider.puntos, 10) || 0) + ' pts</span>' : '<span>🥇 Nadie ha jugado todavía</span>') +
        (n ? '<span>👥 ' + n + (n === 1 ? ' jugador' : ' jugadores') + '</span>' : '') +
      '</div>' +
      boton('abrir', ev.terminado ? '🏆 Ver el ranking final' : '⚡ Entrar a competir',
        { juego: ev.juegoId, titulo: ev.titulo, premio: ev.premio, fin: ev.fin, terminado: ev.terminado ? '1' : '0' }, 'ev-premium-cta') +
      '</article>';
  };

  // Para los logros (js/16): premios que YA me pagaron.
  window.urbisPremiosGanados = function () {
    const u = yo(); if (!u) return 0;
    return filasPremio().filter(r => mismo(r.ganador, u) && r.estado === 'pagado').length;
  };

  // Publicado para las pruebas: la fila y su lectura, sin tocar la red.
  window.URBIS_PREMIO = { TIPO: TIPO, leer: leerFila, sobre: sobreDe, estados: ESTADOS, eventos: eventosPremium, terminados: terminadosRecientes, reclamo: reclamoDe };
})();
