/* URBIS · Visión Territorial (js/90)
   ═══════════════════════════════════════════════════════════════════════════
   La capa de decisión urbanística: déficits de equipamientos, prioridades y
   propuestas con justificación técnica, para alcaldes, gobernadores y
   presidentes.

   REGLA RECTORA, INVIOLABLE: URBIS recomienda, el humano decide. Ninguna
   pantalla, texto o botón de este archivo dice que el sistema decide. El
   sistema pondera y muestra; la persona aprueba, y queda escrito quién.

   La voz del módulo, en todo texto que genera: qué encontró · qué
   recomienda · qué pasa si no se hace. Y solo sobre datos que tiene: si
   falta un dato, lo dice. Nunca inventa.

   AISLAMIENTO. Este archivo no comparte NADA con los otros módulos salvo la
   interfaz: un solo nombre global (window.VT, el espacio del módulo), claves
   de almacenamiento con prefijo urbis_vt_, y ni una petición al Apps Script
   de los reportes. Todo lo que se ve sale de api.urbispro.city/vt/*.

   Lo que sí se hereda: el trazo de los iconos (js/71), el patrón de la
   entrada de repuesto para el botón atrás (de js/20), la paleta y el tipo.

   Cuatro estados por pantalla —cargando, con datos, sin datos, error— y los
   estados vacíos enseñan, nunca se disculpan.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var VERSION = (function () {
    try { var s = document.querySelector('script[src*="90-vt-app.js"]'); var m = s && s.src.match(/[?&]v=([\w-]+)/); return m ? m[1] : ''; } catch (e) { return ''; }
  })();

  var LS = { licencia: 'urbis_vt_licencia', cache: 'urbis_vt_cache_v1_', prefs: 'urbis_vt_prefs_v1' };
  var PADRE = { acceso: null, tablero: null, mapa: 'tablero', propuestas: 'tablero', propuesta: 'propuestas' };

  // El estado del módulo, entero y en un solo sitio.
  var S = {
    pantalla: 'acceso', ses: null, tablero: null, propuestas: null, equipamientos: null, deficits: {},
    tipo: 'colegio_primaria', vistaLista: false, evaluando: false, sinRed: false, propuestaId: null,
    sondeo: null, mapa: null, capas: null, fichaMapa: null, swEsperando: null, zonaViva: null,
    // El origen de los datos del territorio, recogido de cualquier respuesta
    // del servidor y pintado en toda pantalla que imprima una cifra.
    avisoDatos: null
  };
  var TIEMPO_TOPE = 25000;

  /* ── utilidades ─────────────────────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function ico(n, t) { try { return window.URBIS_ICONO ? window.URBIS_ICONO(n, { tam: t || 20 }) : ''; } catch (e) { return ''; } }
  function miles(n) { n = Number(n); if (!isFinite(n)) return '—'; return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function pct(n) { n = Number(n); return isFinite(n) ? (Math.round(n * 10) / 10).toString().replace('.', ',') + ' %' : '—'; }
  function cop(n) { n = Number(n); if (!isFinite(n)) return '—'; if (n >= 1e9) return (Math.round(n / 1e8) / 10).toString().replace('.', ',') + ' mil millones'; if (n >= 1e6) return miles(Math.round(n / 1e6)) + ' millones'; return miles(n); }
  function fecha(iso, conHora) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      var o = { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric' };
      if (conHora) { o.hour = '2-digit'; o.minute = '2-digit'; }
      return new Intl.DateTimeFormat('es-CO', o).format(d);
    } catch (e) { return String(iso).slice(0, 10); }
  }
  function haceCuanto(ms) {
    if (!ms) return '';
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 90) return 'hace un momento';
    var m = Math.round(s / 60); if (m < 60) return 'hace ' + m + ' min';
    var h = Math.round(m / 60); if (h < 36) return 'hace ' + h + ' h';
    return 'hace ' + Math.round(h / 24) + ' días';
  }
  function urgenciaDe(pctCubierta) { return pctCubierta < 40 ? 'critico' : pctCubierta < 75 ? 'medio' : 'atendido'; }
  function nombreUrgencia(u) { return u === 'critico' ? 'Crítico' : u === 'medio' ? 'Medio' : 'Atendido'; }

  var FORMAS = {
    cuadrado: '<rect x="4.5" y="4.5" width="15" height="15" rx="2"/>',
    cruz: '<path d="M12 4v16M4 12h16"/>',
    circulo: '<circle cx="12" cy="12" r="7.5"/>',
    hexagono: '<path d="M12 3.5l7.4 4.25v8.5L12 20.5l-7.4-4.25v-8.5z"/>',
    triangulo: '<path d="M12 4.5l8 14.5H4z"/>',
    escudo: '<path d="M12 3.5l7 2.8v5.4c0 4.4-2.9 8-7 9.3-4.1-1.3-7-4.9-7-9.3V6.3z"/>',
    rombo: '<path d="M12 3.5l8.5 8.5-8.5 8.5-8.5-8.5z"/>',
    capsula: '<rect x="3.5" y="8" width="17" height="8" rx="4"/>',
    pentagono: '<path d="M12 3.5l8.3 6-3.2 9.8H6.9L3.7 9.5z"/>',
    casa: '<path d="M4.5 11l7.5-6.5 7.5 6.5v8.5h-15z"/>',
    triangulo_invertido: '<path d="M4 5.5h16L12 19.5z"/>',
    octagono: '<path d="M8.3 3.5h7.4l5 5v7.4l-5 5H8.3l-5-5V8.5z"/>'
  };
  function forma(f, tam) {
    return '<svg viewBox="0 0 24 24" width="' + (tam || 18) + '" height="' + (tam || 18) + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">' + (FORMAS[f] || FORMAS.circulo) + '</svg>';
  }

  function prefs() { try { return JSON.parse(localStorage.getItem(LS.prefs) || '{}'); } catch (e) { return {}; } }
  function guardarPrefs(p) { try { localStorage.setItem(LS.prefs, JSON.stringify(p)); } catch (e) {} }
  function toast(t) {
    var el = $('vt-toast'); if (!el) return;
    el.textContent = t; el.classList.add('visible');
    clearTimeout(toast._t); toast._t = setTimeout(function () { el.classList.remove('visible'); }, 2600);
  }

  /* ── red: una sola función, siempre con licencia ────────────────────────── */
  function api() { try { return (window.URBIS_CONFIG && window.URBIS_CONFIG.ANALISIS && window.URBIS_CONFIG.ANALISIS.API) || 'https://api.urbispro.city'; } catch (e) { return 'https://api.urbispro.city'; } }
  function licencia() { try { return String(localStorage.getItem(LS.licencia) || '').trim(); } catch (e) { return ''; } }

  function pedir(metodo, ruta, cuerpo) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIEMPO_TOPE);
    var cab = { Authorization: 'Bearer ' + licencia() };
    if (cuerpo) cab['Content-Type'] = 'application/json';
    return fetch(api() + ruta, { method: metodo, headers: cab, body: cuerpo ? JSON.stringify(cuerpo) : undefined, signal: ctrl && ctrl.signal })
      .then(function (r) { return r.text().then(function (tx) { var j = null; try { j = JSON.parse(tx); } catch (e) {} return { codigo: r.status, cuerpo: j || { ok: false, error: 'Respuesta ilegible' } }; }); })
      .then(function (r) {
        S.sinRed = false; pintarSinRed();
        /* El aviso de origen se recoge de CUALQUIER respuesta, acá, y no en
           cada pantalla. El servidor lo pega en todas desde la v867; guardarlo
           en un solo sitio es lo que permite que una pantalla nueva lo pinte
           sin que su autor se acuerde. */
        if (r.cuerpo && r.cuerpo.aviso_datos !== undefined) S.avisoDatos = r.cuerpo.aviso_datos || null;
        if (r.codigo >= 200 && r.codigo < 300) return r.cuerpo;
        var e = new Error((r.cuerpo && r.cuerpo.error) || ('Error ' + r.codigo)); e.codigo = r.codigo; e.cuerpo = r.cuerpo; throw e;
      })
      .catch(function (e) {
        if (!e.codigo) { S.sinRed = true; pintarSinRed(); e.sinRed = true; }
        throw e;
      })
      .finally(function () { clearTimeout(t); });
  }

  /* ── caché propia, con fecha; se enseña diciendo que es guardada ────────── */
  function claveCache() { return LS.cache + ((S.ses && S.ses.territorio && S.ses.territorio.dane) || 'x'); }
  function leerCache() { try { return JSON.parse(localStorage.getItem(claveCache()) || '{}'); } catch (e) { return {}; } }
  function guardarCache(campo, datos) {
    try { var c = leerCache(); c[campo] = { t: Date.now(), datos: datos }; localStorage.setItem(claveCache(), JSON.stringify(c)); } catch (e) {}
  }
  function deCache(campo) { var c = leerCache()[campo]; return c && c.datos ? c : null; }

  /* ── navegación: cada pantalla vuelve a su padre, nunca salta de rama ──── */
  var ignorandoPop = false, avisoSalida = 0;
  function reponerRepuesto() { try { history.pushState({ vtRepuesto: true }, ''); } catch (e) {} }
  function rutaDe(p, arg) { return '#' + p + (p === 'propuesta' && arg ? '/' + arg : ''); }
  function ir(pantalla, arg, sinHistoria) {
    if (!S.ses && pantalla !== 'acceso') pantalla = 'acceso';
    if (S.ses && pantalla === 'acceso') pantalla = 'tablero';
    cerrarModal();
    if (pantalla !== 'mapa' && S.evaluando) apagarEvaluar();
    if (pantalla !== 'mapa') abrirHoja(false);
    S.pantalla = pantalla;
    if (pantalla === 'propuesta') S.propuestaId = arg || S.propuestaId;
    document.querySelectorAll('.vt-pantalla').forEach(function (s) { s.classList.toggle('activa', s.getAttribute('data-vt-pantalla') === pantalla); });
    document.querySelectorAll('[data-vt-ir]').forEach(function (b) { b.classList.toggle('activa', b.getAttribute('data-vt-ir') === pantalla); b.setAttribute('aria-pressed', b.getAttribute('data-vt-ir') === pantalla ? 'true' : 'false'); });
    if (!sinHistoria) { try { history.replaceState({ vtRaiz: true }, '', rutaDe(pantalla, S.propuestaId)); } catch (e) {} }
    var act = document.querySelector('.vt-pantalla.activa'); if (act) act.scrollTop = 0;
    if (pantalla === 'acceso') pintarAcceso();
    if (pantalla === 'tablero') cargarTablero();
    if (pantalla === 'mapa') mostrarMapa();
    if (pantalla === 'propuestas') cargarPropuestas();
    if (pantalla === 'propuesta') cargarPropuesta(S.propuestaId);
  }
  function atras() {
    if (cerrarLoAbierto()) return true;
    var p = PADRE[S.pantalla];
    if (p) { ir(p); return true; }
    return false;
  }
  function cerrarLoAbierto() {
    var m = $('vt-modal'); if (m && !m.hidden) { cerrarModal(); return true; }
    if (S.evaluando) { apagarEvaluar(); return true; }
    if (S.pantalla === 'mapa' && S.vistaLista) { alternarLista(false); return true; }
    // La hoja del mapa solo cuenta cuando el mapa está delante: si quedó
    // marcada abierta en otra pantalla, el atrás no la «cierra», sube al padre.
    var h = $('vt-hoja'); if (S.pantalla === 'mapa' && h && h.getAttribute('data-abierta') === '1' && window.innerWidth < 1024) { h.setAttribute('data-abierta', '0'); return true; }
    return false;
  }
  function iniciarHistorial() {
    try { history.replaceState({ vtRaiz: true }, ''); reponerRepuesto(); } catch (e) {}
    window.addEventListener('popstate', function () {
      if (ignorandoPop) { ignorandoPop = false; return; }
      if (atras()) {
        // La dirección vuelve a decir dónde estamos ANTES de reponer la
        // entrada: si no, el hashchange que sigue lee un hash vacío y manda
        // al tablero por encima de lo que acaba de decidir el atrás.
        try { history.replaceState({ vtRaiz: true }, '', rutaDe(S.pantalla, S.propuestaId)); } catch (e) {}
        reponerRepuesto(); return;
      }
      var ahora = Date.now();
      if (ahora - avisoSalida > 2500) { avisoSalida = ahora; toast('Pulsa atrás otra vez para salir de Visión Territorial'); reponerRepuesto(); return; }
      ignorandoPop = true;
      try { history.back(); } catch (e) {}
    });
  }
  function pantallaDelHash() {
    var h = String(location.hash || '').replace(/^#/, '');
    var m = h.match(/^propuesta\/([0-9a-f-]{36})$/i);
    if (m) return { p: 'propuesta', arg: m[1] };
    return { p: ['tablero', 'mapa', 'propuestas'].indexOf(h) !== -1 ? h : 'tablero' };
  }

  /* ── los cuatro estados, una sola forma de pintarlos ────────────────────── */
  function estado(tipo, opciones) {
    opciones = opciones || {};
    if (tipo === 'cargando') return '<div class="vt-cargando" data-vt-estado="cargando">' + esc(opciones.texto || 'Trayendo los datos del territorio…') + '</div>' +
      '<div class="vt-esqueleto" style="width:60%"></div><div class="vt-esqueleto" style="width:85%"></div><div class="vt-esqueleto" style="width:40%"></div>';
    var cls = tipo === 'error' ? ' error' : '';
    var icon = tipo === 'error' ? 'alerta' : (opciones.icono || 'info');
    return '<div class="vt-estado' + cls + '" data-vt-estado="' + tipo + '">' + ico(icon, 44) +
      '<h3>' + esc(opciones.titulo || (tipo === 'error' ? 'No se pudo traer esto' : 'Todavía no hay datos aquí')) + '</h3>' +
      '<p>' + (opciones.html || esc(opciones.texto || '')) + '</p>' +
      (opciones.accion ? '<button type="button" class="vt-btn ' + (opciones.accionClase || 'primario') + '" data-vt-accion="' + esc(opciones.accion) + '">' + esc(opciones.accionTexto || 'Reintentar') + '</button>' : '') +
      '</div>';
  }
  function avisoDatos(texto) {
    if (!texto) return '';
    return '<div class="vt-aviso-datos" role="note">' + ico('alerta', 18) + '<div>' + esc(texto) + '</div></div>';
  }
  function chipCache(t) { return t ? '<span class="vt-chip aviso">' + ico('reloj', 14) + ' Guardado ' + esc(haceCuanto(t)) + ' · sin conexión</span>' : ''; }

  /* ── acceso ─────────────────────────────────────────────────────────────── */
  function pintarAcceso(mensaje) {
    var c = $('vt-acceso'); if (!c) return;
    c.innerHTML =
      '<div class="vt-card">' +
        '<div class="vt-marca-grande"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><path d="M12 3.5V1.5"/></svg>' +
        '<b>Visión Territorial</b><small>URBIS · acceso con credencial de entidad</small></div>' +
        '<p class="vt-sub">Esta herramienta es para entidades territoriales. Pegá la credencial que te entregó URBIS: lleva tu municipio y tu rol, y solo sirve en este equipo.</p>' +
        (mensaje ? '<p class="vt-chip critico" style="display:inline-flex;margin-bottom:10px">' + esc(mensaje) + '</p>' : '') +
        '<textarea id="vt-lic-input" placeholder="URBIS1.…" autocomplete="off" spellcheck="false">' + esc(licencia()) + '</textarea>' +
        '<div class="vt-acciones"><button type="button" class="vt-btn primario ancho" id="vt-lic-entrar">' + ico('llave', 18) + ' Entrar</button></div>' +
        '<p class="vt-nota" style="margin-top:12px;color:var(--vt-tinta-3);font-size:.8em">URBIS recomienda, el humano decide. La credencial no se recupera sola: si la perdiste, escribile al administrador de tu entidad.</p>' +
      '</div>';
    var b = $('vt-lic-entrar'); if (b) b.onclick = function () {
      var v = String(($('vt-lic-input') || {}).value || '').trim();
      if (!v) { toast('Pegá la credencial primero.'); return; }
      try { localStorage.setItem(LS.licencia, v); } catch (e) {}
      b.disabled = true; b.textContent = 'Comprobando…';
      cargarSesion().then(function () { ir('tablero'); }).catch(function (e) { pintarAcceso(e.message); });
    };
  }

  function cargarSesion() {
    if (!licencia()) return Promise.reject(new Error('Falta la credencial.'));
    return pedir('GET', '/vt/sesion').then(function (r) {
      S.ses = r;
      $('vt-top-nombre').textContent = r.territorio ? r.territorio.nombre : 'Visión Territorial';
      $('vt-top-sub').textContent = (r.territorio ? r.territorio.departamento + ' · ' : '') + rolNombre(r.rol);
      var ini = String(r.quien || '?').split(/\s+/).map(function (x) { return x[0]; }).join('').slice(0, 2).toUpperCase();
      $('vt-avatar').textContent = ini || '—';
      return r;
    }).catch(function (e) {
      if (e.sinRed) {
        // Sin red y con una sesión guardada: se abre con lo último visto.
        var g = deCache('sesion'); if (g) { S.ses = g.datos; return g.datos; }
      }
      if (e.codigo === 401 || e.codigo === 403) { try { localStorage.removeItem(LS.licencia); } catch (e2) {} }
      throw e;
    }).then(function (r) { guardarCache('sesion', r); return r; });
  }
  function rolNombre(r) { return { admin: 'Administrador', gobernante: 'Gobernante', tecnico: 'Equipo técnico', veedor: 'Veedor' }[r] || r || ''; }
  function puede(x) { return !!(S.ses && S.ses.puede && S.ses.puede[x]) && !S.sinRed; }

  /* ── tablero ────────────────────────────────────────────────────────────── */
  function cargarTablero(forzar) {
    var c = $('vt-tablero'); if (!c) return;
    if (!S.tablero || forzar) c.innerHTML = estado('cargando');
    pedir('GET', '/vt/tablero').then(function (r) {
      S.tablero = r; guardarCache('tablero', r); pintarTablero(r, 0);
      if (r.en_curso) sondearAnalisis(r.en_curso.id);
    }).catch(function (e) {
      var g = deCache('tablero');
      if (g) { S.tablero = g.datos; pintarTablero(g.datos, g.t); return; }
      c.innerHTML = estado('error', { titulo: 'No se pudo traer el tablero', html: esc(e.sinRed ? 'Sin conexión con el servidor de URBIS y sin nada guardado todavía de este territorio.' : e.message) + ' Revisá la señal y volvé a intentar.', accion: 'tablero' });
    });
  }

  function pintarTablero(T, tCache) {
    var c = $('vt-tablero'); if (!c) return;
    var t = T.territorio || {}, A = T.analisis;
    var h = '';
    h += avisoDatos(T.aviso_datos);
    if (tCache) h += '<div class="vt-chips">' + chipCache(tCache) + '</div>';
    h += '<div class="vt-hero">';
    h += '<div class="vt-eyebrow">' + esc(t.nombre || '') + ' · ' + (A ? 'Índice de salud urbana' : 'Población') + '</div>';
    if (A) {
      h += '<div class="vt-cifra activo vt-num" id="vt-cifra-indice">' + String(A.indice_salud).replace('.', ',') + '<small>/ 100</small></div>';
      h += '<div class="vt-linea">Cobertura pública <b>confirmada</b>, ponderada por la urgencia de cada categoría. Confianza: <b>' + esc(A.confianza && A.confianza.texto || '') + '</b>.</div>';
      h += '<div class="vt-meta"><span>Análisis del ' + esc(fecha(A.terminado_en, true)) + '</span><span>Método: ' + esc(A.metodo === 'radio_recto' ? 'radio recto · isócrona pendiente' : A.metodo) + '</span><span>Población ' + esc(miles(t.poblacion_censal)) + ' · ' + esc(t.fuente_poblacion || 'sin fuente') + (t.fecha_corte_poblacion ? ' · corte ' + esc(fecha(t.fecha_corte_poblacion)) : '') + '</span></div>';
    } else {
      // La primera pantalla SIEMPRE muestra un dato de la ciudad, aunque
      // sea preliminar. Sin análisis todavía, el dato es la población.
      h += '<div class="vt-cifra vt-num" id="vt-cifra-poblacion">' + esc(miles(t.poblacion_censal)) + '<small>hab.</small></div>';
      h += '<div class="vt-linea">' + esc(t.fuente_poblacion || 'Fuente de población sin declarar') + (t.fecha_corte_poblacion ? ' · corte ' + esc(fecha(t.fecha_corte_poblacion)) : '') + (t.poblacion_flotante ? ' · población flotante declarada aparte: ' + esc(miles(t.poblacion_flotante)) : '') + '</div>';
    }
    h += '</div>';

    // análisis en curso / correr
    if (T.en_curso) {
      h += '<div class="vt-card"><div class="vt-cargando" id="vt-en-curso">Análisis en curso desde ' + esc(fecha(T.en_curso.iniciado_en, true)) + '… la pantalla se actualiza sola al terminar.</div></div>';
    } else if (!A) {
      h += '<div class="vt-card"><div class="vt-eyebrow">Qué hace un análisis</div><p class="vt-sub" style="margin:6px 0 10px">Recorre las manzanas del territorio y mide quién queda a más de cada radio de caminata de un equipamiento público: colegios, puestos de salud, parques, CAI… Tarda menos de un minuto y deja copia de las reglas que usó.</p>' +
        (puede('analizar') ? '<button type="button" class="vt-btn primario" data-vt-accion="analizar">' + ico('destello', 18) + ' Correr el primer análisis</button>' : '<span class="vt-chip">Tu rol consulta; el análisis lo corre el equipo técnico.</span>') + '</div>';
    }

    if (A) {
      // cuatro tarjetas de déficit
      h += '<div class="vt-seccion"><div class="vt-seccion-cab"><h2>Dónde falta más</h2><button type="button" class="vt-enlace" data-vt-ir="mapa">Ver en el mapa</button></div><div class="vt-grid2">';
      (T.tarjetas || []).forEach(function (k) {
        var u = urgenciaDe(k.pct_cubierta_publica);
        h += '<div class="vt-card urg urg-' + u + '"><div class="vt-eyebrow">' + esc(k.nombre) + '</div><div class="vt-kpi vt-num">' + esc(pct(k.pct_cubierta_publica)) + '<small> cubierta</small></div>' +
          '<div class="vt-nota">' + (k.peor_tipo ? esc(miles(k.peor_tipo.sin_cobertura_publica)) + ' personas a más de ' + esc(k.peor_tipo.radio_m) + ' m de ' + esc(k.peor_tipo.articulo || 'un') + ' ' + esc(String(k.peor_tipo.nombre).toLowerCase()) : '') + '</div>' +
          '<div class="vt-nota"><span class="vt-chip ' + (u === 'critico' ? 'critico' : u === 'medio' ? 'aviso' : 'acento') + '">' + nombreUrgencia(u) + '</span></div></div>';
      });
      h += '</div></div>';

      // tres propuestas
      h += '<div class="vt-seccion"><div class="vt-seccion-cab"><h2>Propuestas prioritarias</h2><button type="button" class="vt-enlace" data-vt-ir="propuestas">Todas</button></div>';
      if (T.propuestas && T.propuestas.length) {
        T.propuestas.forEach(function (p) {
          h += '<button type="button" class="vt-card urg urg-' + urgenciaDe(p.deficit && p.deficit.pct_cubierta_publica || 0) + ' vt-prop-mini" style="width:100%;text-align:left" data-vt-propuesta="' + esc(p.id) + '">' +
            '<span class="vt-forma">' + forma(p.forma) + '</span><span><b>' + esc(p.tipo_nombre) + '</b><small>' + esc(miles(p.poblacion_beneficiada)) + ' personas beneficiadas · ' + esc(p.categoria_nombre) + '</small></span></button>';
        });
      } else {
        h += '<div class="vt-card"><p class="vt-sub" style="margin:0">Sin propuestas pendientes: las del último análisis ya se decidieron, o ninguna mancha reunió gente suficiente. La siguiente corrida vuelve a mirar.</p></div>';
      }
      h += '</div>';
    }

    // ranking
    var R = T.ranking || {};
    h += '<div class="vt-seccion"><div class="vt-seccion-cab"><h2>Ranking</h2><span class="vt-chip">' + (R.posicion ? 'puesto ' + R.posicion + ' de ' + R.total : 'sin análisis aún') + '</span></div><div class="vt-card">';
    if (R.lista && R.lista.length) {
      R.lista.forEach(function (x) {
        h += '<div class="vt-ranking-fila' + (x.nombre === t.nombre ? ' mio' : '') + '"><span class="pos vt-num">' + x.posicion + '</span><b>' + esc(x.nombre) + '</b>' + (x.es_desarrollo ? '<span class="vt-chip aviso">datos de desarrollo</span>' : '') + '<span class="ind vt-num">' + (x.indice != null ? String(x.indice).replace('.', ',') : '—') + '</span></div>';
      });
      h += '<div class="vt-nota">Pesa cobertura confirmada, no cantidad: un equipamiento sin verificación reciente vale menos.</div>';
    } else {
      h += '<p class="vt-sub" style="margin:0">El ranking compara el índice de salud urbana del último análisis de cada territorio. Aparece en cuanto haya uno.</p>';
    }
    h += '</div></div>';

    h += '<div class="vt-acciones vt-no-presentar">' +
      (A && puede('analizar') && !T.en_curso ? '<button type="button" class="vt-btn" data-vt-accion="analizar">' + ico('destello', 18) + ' Volver a analizar</button>' : '') +
      (A ? '<button type="button" class="vt-btn sutil" data-vt-accion="presentar">' + ico('ojo', 18) + ' Presentar</button>' : '') +
      '</div>';
    h += '<div class="vt-cierre">Mientras otros suponen, tú ya sabes.<small>URBIS recomienda · la persona decide</small></div>';
    c.innerHTML = h;
  }

  function correrAnalisis() {
    if (!puede('analizar')) return;
    document.querySelectorAll('[data-vt-accion="analizar"]').forEach(function (b) { b.disabled = true; b.textContent = 'Iniciando…'; });
    pedir('POST', '/vt/analizar', {}).then(function (r) {
      toast('Análisis en curso. La pantalla se actualiza sola.');
      S.tablero = null; cargarTablero(true);
      sondearAnalisis(r.analisis_id);
    }).catch(function (e) {
      toast(e.codigo === 409 ? 'Ya hay un análisis en curso.' : ('No se pudo iniciar: ' + e.message));
      document.querySelectorAll('[data-vt-accion="analizar"]').forEach(function (b) { b.disabled = false; b.textContent = 'Correr análisis'; });
    });
  }
  function sondearAnalisis(id) {
    if (S.sondeo) clearInterval(S.sondeo);
    S.sondeo = setInterval(function () {
      pedir('GET', '/vt/analisis/' + id).then(function (r) {
        var a = r.analisis || {};
        if (a.estado === 'en_curso') return;
        clearInterval(S.sondeo); S.sondeo = null;
        S.propuestas = null; S.deficits = {};
        if (a.estado === 'terminado') { toast('Análisis terminado.'); }
        else toast('El análisis falló y quedó anotado: ' + (a.error || 'sin detalle'));
        if (S.pantalla === 'tablero') cargarTablero(true);
        if (S.pantalla === 'mapa') { cargarDeficits(S.tipo, true); }
        if (S.pantalla === 'propuestas') cargarPropuestas(true);
      }).catch(function () { /* se sigue intentando */ });
    }, 2500);
  }

  /* ── mapa ───────────────────────────────────────────────────────────────── */
  function crearMapa() {
    if (S.mapa || !window.L) return;
    var m = L.map('vt-mapa', { zoomControl: false, attributionControl: true, preferCanvas: true, zoomSnap: .5 });
    L.control.zoom({ position: 'topright' }).addTo(m);
    var claro = document.documentElement.getAttribute('data-theme') === 'claro';
    L.tileLayer('https://{s}.basemaps.cartocdn.com/' + (claro ? 'light_all' : 'dark_all') + '/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 19
    }).addTo(m);
    m.createPane('vt-deficit'); m.getPane('vt-deficit').style.zIndex = 350; m.getPane('vt-deficit').classList.add('vt-pane-deficit');
    m.createPane('vt-equip'); m.getPane('vt-equip').style.zIndex = 400;
    m.createPane('vt-prop'); m.getPane('vt-prop').style.zIndex = 450;
    S.capas = { deficit: L.layerGroup().addTo(m), equip: L.layerGroup().addTo(m), prop: L.layerGroup().addTo(m), eval: L.layerGroup().addTo(m) };
    m.on('click', function (ev) { if (S.evaluando) evaluarEn(ev.latlng); });
    S.mapa = m; m._vtClaro = claro;
    // encuadre: el polígono del territorio
    var g = S.ses && S.ses.territorio && S.ses.territorio.geom;
    try { if (g) m.fitBounds(L.geoJSON(g).getBounds(), { padding: [10, 10] }); else m.setView([7.89, -72.5], 12); } catch (e) { m.setView([7.89, -72.5], 12); }
  }
  function mostrarMapa() {
    crearMapa();
    setTimeout(function () { try { S.mapa.invalidateSize(); } catch (e) {} }, 60);
    llenarSelectorTipo();
    pintarLeyenda();
    cargarEquipamientos();
    cargarDeficits(S.tipo);
    cargarPropuestas(false, true);
  }
  function tiposDisponibles() {
    var A = S.tablero && S.tablero.analisis;
    var lista = (A && A.tipos) ? A.tipos.slice() : [];
    if (!lista.length && S.equipamientos && S.equipamientos.tipos) lista = S.equipamientos.tipos.map(function (t) { return { tipo: t.id, nombre: t.nombre, categoria: t.categoria }; });
    return lista;
  }
  function llenarSelectorTipo() {
    var sel = $('vt-sel-tipo'); if (!sel) return;
    var lista = tiposDisponibles();
    if (!lista.length) { sel.innerHTML = '<option>Sin tipos cargados</option>'; return; }
    lista.sort(function (a, b) { return (b.sin_cobertura_publica || 0) - (a.sin_cobertura_publica || 0); });
    sel.innerHTML = lista.map(function (t) {
      return '<option value="' + esc(t.tipo) + '"' + (t.tipo === S.tipo ? ' selected' : '') + '>' + esc(t.nombre) + (t.sin_cobertura_publica != null ? ' · ' + miles(t.sin_cobertura_publica) + ' sin cobertura' : '') + '</option>';
    }).join('');
    if (!lista.some(function (t) { return t.tipo === S.tipo; })) { S.tipo = lista[0].tipo; sel.value = S.tipo; }
  }
  function pintarLeyenda() {
    var l = $('vt-leyenda'); if (!l) return;
    var plegada = l.getAttribute('data-plegada') === '1';
    l.innerHTML = '<button type="button" id="vt-leyenda-btn" aria-expanded="' + (!plegada) + '">' + ico(plegada ? 'chevron' : 'abajo', 14) + ' Leyenda</button>' +
      '<div class="vt-leyenda-cuerpo">' +
        '<div><i style="background:rgba(229,72,77,.6)"></i>Sin cobertura pública · más gente, más rojo</div>' +
        '<div><i style="background:rgba(245,165,36,.55)"></i>Sin cobertura · menos gente</div>' +
        '<div>' + forma('cuadrado', 14) + ' Equipamiento público del tipo elegido</div>' +
        '<div><span style="opacity:.55">' + forma('cuadrado', 14) + '</span> Sin verificación reciente</div>' +
        '<div><span class="vt-prop-marca" style="width:14px;height:14px;display:inline-block"><span class="nucleo" style="inset:3px"></span></span> Propuesta (solo estas pulsan)</div>' +
        '<div style="color:var(--vt-tinta-3)">Manchas difusas a propósito: un borde nítido diría una precisión que el dato no tiene.</div>' +
      '</div>';
    var b = $('vt-leyenda-btn'); if (b) b.onclick = function () { l.setAttribute('data-plegada', plegada ? '0' : '1'); pintarLeyenda(); };
  }

  function cargarEquipamientos(forzar) {
    if (S.equipamientos && !forzar) { pintarEquipamientos(); return; }
    pedir('GET', '/vt/equipamientos').then(function (r) { S.equipamientos = r; guardarCache('equipamientos', r); llenarSelectorTipo(); pintarEquipamientos(); })
      .catch(function () { var g = deCache('equipamientos'); if (g) { S.equipamientos = g.datos; llenarSelectorTipo(); pintarEquipamientos(); } });
  }
  function pintarEquipamientos() {
    if (!S.capas || !S.equipamientos) return;
    S.capas.equip.clearLayers();
    (S.equipamientos.equipamientos || []).forEach(function (e) {
      if (e.tipo !== S.tipo) return;
      var verificado = e.ubicacion_verificada && e.verificado_en && (Date.now() - new Date(e.verificado_en).getTime()) < 365 * 86400000;
      var html = '<div class="vt-eq' + (e.publico ? '' : ' privado') + (verificado ? '' : ' sin-verificar') + '">' + forma(e.forma, 18) + '</div>';
      var mk = L.marker([e.lat, e.lng], { pane: 'vt-equip', keyboard: false, icon: L.divIcon({ className: 'vt-eq-wrap', html: html, iconSize: [18, 18], iconAnchor: [9, 9] }) });
      mk.bindTooltip(esc(e.nombre_local || e.tipo) + ' · ' + (e.publico ? 'público' : 'privado') + (verificado ? ' · verificado' : ' · sin verificación reciente') + ' · fuente: ' + esc(e.fuente), { direction: 'top', offset: [0, -8] });
      S.capas.equip.addLayer(mk);
    });
  }

  function cargarDeficits(tipo, forzar) {
    S.tipo = tipo;
    var sel = $('vt-sel-tipo'); if (sel && sel.value !== tipo) sel.value = tipo;
    pintarEquipamientos();
    if (S.deficits[tipo] && !forzar) { pintarDeficits(S.deficits[tipo], 0); return; }
    pintarHoja('<div class="vt-cargando">Midiendo quién queda fuera del radio…</div>');
    pedir('GET', '/vt/deficits?tipo=' + encodeURIComponent(tipo)).then(function (r) {
      S.deficits[tipo] = r; guardarCache('deficit_' + tipo, r); pintarDeficits(r, 0);
    }).catch(function (e) {
      var g = deCache('deficit_' + tipo);
      if (g) { S.deficits[tipo] = g.datos; pintarDeficits(g.datos, g.t); return; }
      pintarHoja(estado('error', { titulo: 'No se pudo traer el déficit', texto: e.sinRed ? 'Sin conexión y sin nada guardado de este tipo.' : e.message, accion: 'deficits' }));
    });
  }
  function pintarDeficits(D, tCache) {
    if (!S.capas) return;
    S.capas.deficit.clearLayers();
    var puntos = D.puntos || [];
    var max = 1; puntos.forEach(function (p) { if (p[2] > max) max = p[2]; });
    puntos.forEach(function (p) {
      var f = Math.min(1, p[2] / max);
      // del ámbar (poca gente) al rojo (mucha): el color es la población sin cobertura
      var col = f > .5 ? 'rgba(229,72,77,' + (0.28 + f * .3).toFixed(2) + ')' : 'rgba(245,165,36,' + (0.22 + f * .3).toFixed(2) + ')';
      // Del tamaño de una manzana, no de un barrio: con radios grandes todas
      // se funden en una sola sábana y el mapa deja de decir dónde.
      S.capas.deficit.addLayer(L.circleMarker([p[0], p[1]], { pane: 'vt-deficit', radius: Math.min(22, 6 + Math.sqrt(p[2]) / 6), stroke: false, fillColor: col, fillOpacity: 1, interactive: false }));
    });
    var r = D.resumen || {};
    var h = '<div class="vt-hoja-titulo"><b>' + esc(D.nombre || S.tipo) + '</b><span class="vt-chip ' + (r.pct_cubierta_publica != null ? (urgenciaDe(r.pct_cubierta_publica) === 'critico' ? 'critico' : urgenciaDe(r.pct_cubierta_publica) === 'medio' ? 'aviso' : 'acento') : '') + '">' + (r.pct_cubierta_publica != null ? nombreUrgencia(urgenciaDe(r.pct_cubierta_publica)) : 'sin análisis') + '</span></div>';
    if (tCache) h += '<div class="vt-chips">' + chipCache(tCache) + '</div>';
    if (D.sin_analisis) {
      h += '<p class="vt-sub" style="margin:8px 0 0">Todavía no hay un análisis de este territorio: el mapa enseña los equipamientos cargados, pero no quién queda fuera de su alcance. ' + (puede('analizar') ? 'Corré uno desde el tablero.' : 'El equipo técnico puede correrlo desde el tablero.') + '</p>';
    } else if (D.sin_radio) {
      h += '<p class="vt-sub" style="margin:8px 0 0">Este tipo no tiene radio de cobertura definido, así que no se mide.</p>';
    } else {
      h += '<div class="vt-kpi vt-num" style="font-size:2em;font-weight:800;margin:6px 0 2px">' + esc(miles(r.sin_cobertura_publica)) + '<small style="font-size:.45em;color:var(--vt-tinta-3);font-weight:600"> personas a más de ' + esc(D.radio_m) + ' m</small></div>';
      h += '<div class="vt-nota">Cobertura pública ' + esc(pct(r.pct_cubierta_publica)) + ' · total (con privados) ' + esc(pct(r.pct_cubierta_total)) + ' · confirmada ' + esc(pct(r.pct_cubierta_confirmada)) + '</div>';
      h += '<div class="vt-nota">Radio de ' + esc(D.radio_m) + ' m: ' + esc(D.norma_radio || '') + ' · método: ' + esc(D.metodo === 'radio_recto' ? 'radio recto (isócrona pendiente)' : D.metodo) + ' · corte ' + esc(fecha(D.fecha_corte)) + '</div>';
      h += '<div class="vt-nota" style="color:var(--vt-tinta-3)">' + esc(miles(puntos.length)) + ' manzanas sin cobertura pública del total analizado.</div>';
    }
    h += '<div class="vt-acciones"><button type="button" class="vt-btn sutil" data-vt-accion="lista">' + ico('lista', 16) + ' Ver como lista</button><button type="button" class="vt-btn sutil" data-vt-ir="propuestas">' + ico('plan', 16) + ' Propuestas</button></div>';
    pintarHoja(h);
  }
  /* La hoja es lo que se imprime y sale del edificio. Hasta la v866 daba
     «N personas a más de M m» con su método y su fecha de corte y SIN decir
     que las manzanas fueran sintéticas: el aviso vivía en el Tablero, o sea
     en la pantalla de la que venías, no en el papel que te llevabas.
     Declarar parte de la procedencia y callar esa parte es peor que no
     declarar nada, porque la hoja se lee como plenamente fundada.

     Va acá y no en cada `pintarDeficits`/`pintarPropuesta` por lo mismo que
     en el servidor: una pantalla nueva lo hereda sin acordarse. */
  function pintarHoja(html) {
    var c = $('vt-hoja-cuerpo'); if (!c) return;
    c.innerHTML = avisoDatos(S.avisoDatos) + html;
  }
  function abrirHoja(abierta) { var h = $('vt-hoja'); if (h) h.setAttribute('data-abierta', abierta ? '1' : '0'); }

  function pintarPropuestasEnMapa() {
    if (!S.capas || !S.propuestas) return;
    S.capas.prop.clearLayers();
    (S.propuestas.propuestas || []).forEach(function (p) {
      var decidida = p.estado !== 'propuesta';
      var mk = L.marker([p.lat, p.lng], { pane: 'vt-prop', keyboard: false, icon: L.divIcon({ className: 'vt-prop-wrap', html: '<div class="vt-prop-marca' + (decidida ? ' decidida' : '') + '"><span class="halo"></span><span class="nucleo"></span></div>', iconSize: [30, 30], iconAnchor: [15, 15] }) });
      mk.on('click', function () {
        // La zona apta se enseña solo de la propuesta tocada: veinticinco
        // zonas a la vez tapan el mapa y no dicen nada.
        if (S.zonaViva) { try { S.capas.prop.removeLayer(S.zonaViva); } catch (e) {} S.zonaViva = null; }
        if (p.zona) { try { S.zonaViva = L.geoJSON(p.zona, { style: { color: '#34CCFE', weight: 1.5, dashArray: '4 4', fillColor: '#34CCFE', fillOpacity: .08, interactive: false } }); S.capas.prop.addLayer(S.zonaViva); } catch (e) {} }
        pintarHoja('<div class="vt-hoja-titulo"><b>' + esc(p.tipo_nombre) + '</b><span class="vt-chip acento">' + esc(p.estado) + '</span></div>' +
          '<p class="vt-sub" style="margin:8px 0">' + esc(p.deficit && p.deficit.encontro || '') + '</p>' +
          '<div class="vt-acciones"><button type="button" class="vt-btn primario" data-vt-propuesta="' + esc(p.id) + '">Ver la propuesta</button></div>');
        abrirHoja(true);
      });
      S.capas.prop.addLayer(mk);
    });
  }

  function alternarLista(abrir) {
    S.vistaLista = abrir == null ? !S.vistaLista : !!abrir;
    var b = $('vt-btn-lista'); if (b) b.setAttribute('aria-pressed', S.vistaLista ? 'true' : 'false');
    var l = $('vt-mapa-lista'); if (!l) return;
    l.hidden = !S.vistaLista;
    // Sobre una lista no se evalúa ni hace falta leyenda: se esconden.
    var fab = $('vt-fab-evaluar'), ley = $('vt-leyenda');
    if (fab) fab.hidden = S.vistaLista; if (ley) ley.hidden = S.vistaLista;
    if (S.vistaLista && S.evaluando) apagarEvaluar();
    if (!S.vistaLista) return;
    var lista = tiposDisponibles().filter(function (t) { return t.sin_cobertura_publica != null; });
    if (!lista.length) { l.innerHTML = estado('vacio', { titulo: 'Sin análisis todavía', texto: 'La lista ordena los tipos de equipamiento por la gente que queda fuera de su radio. Aparece en cuanto haya un análisis.' }); return; }
    lista.sort(function (a, b) { return b.sin_cobertura_publica - a.sin_cobertura_publica; });
    l.innerHTML = '<div class="vt-eyebrow" style="margin-bottom:8px">Ordenado por urgencia · misma información que el mapa</div>' + lista.map(function (t) {
      var u = urgenciaDe(t.pct_cubierta_publica);
      return '<button type="button" class="vt-fila urg-' + u + '" data-vt-tipo="' + esc(t.tipo) + '"><span class="vt-forma">' + forma((S.equipamientos && S.equipamientos.categorias && S.equipamientos.categorias[t.categoria] || {}).forma) + '</span>' +
        '<span><b>' + esc(t.nombre) + '</b><small class="vt-fila-detalle" data-sin="' + esc(t.sin_cobertura_publica) + '">' + esc(miles(t.sin_cobertura_publica)) + ' personas a más de ' + esc(t.radio_m) + ' m · ' + esc(t.equipamientos && t.equipamientos.publicos || 0) + ' públicos</small></span>' +
        '<span class="vt-pct vt-num">' + esc(pct(t.pct_cubierta_publica)) + '<small><br>cubierta</small></span></button>';
    }).join('');
  }

  /* evaluar idea */
  function apagarEvaluar() {
    S.evaluando = false;
    var f = $('vt-fab-evaluar'); if (f) { f.setAttribute('aria-pressed', 'false'); f.innerHTML = ico('tocar', 18) + '<span>Evaluar idea</span>'; }
    if (S.capas) S.capas.eval.clearLayers();
    if (S.mapa) S.mapa.getContainer().style.cursor = '';
  }
  function encenderEvaluar() {
    S.evaluando = true;
    var f = $('vt-fab-evaluar'); if (f) { f.setAttribute('aria-pressed', 'true'); f.innerHTML = ico('cerrar', 18) + '<span>Cancelar</span>'; }
    if (S.mapa) S.mapa.getContainer().style.cursor = 'crosshair';
    var lista = tiposDisponibles();
    pintarHoja('<div class="vt-hoja-titulo"><b>Evaluar una idea</b><span class="vt-chip aviso">modo consulta</span></div>' +
      '<p class="vt-sub" style="margin:8px 0">Elegí el tipo de equipamiento y tocá el mapa donde lo pondrías. URBIS te dice a cuánta gente serviría, qué hay ya cerca y qué pasa si no se hace.</p>' +
      '<select class="vt-select" id="vt-eval-tipo" aria-label="Tipo a evaluar">' + lista.map(function (t) { return '<option value="' + esc(t.tipo) + '"' + (t.tipo === S.tipo ? ' selected' : '') + '>' + esc(t.nombre) + '</option>'; }).join('') + '</select>');
    abrirHoja(true);
  }
  function evaluarEn(ll) {
    var tipo = ($('vt-eval-tipo') || {}).value || S.tipo;
    S.capas.eval.clearLayers();
    S.capas.eval.addLayer(L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="vt-eval-marca"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), keyboard: false }));
    pintarHoja('<div class="vt-cargando">Evaluando el punto…</div>'); abrirHoja(true);
    pedir('POST', '/vt/evaluar', { tipo: tipo, lat: ll.lat, lng: ll.lng }).then(function (r) {
      var cls = r.nivel === 'alto' ? 'ok' : r.nivel === 'medio' ? 'aviso' : r.nivel === 'sin_datos' ? '' : 'critico';
      pintarHoja('<div class="vt-hoja-titulo"><b>' + esc(r.nombre) + ' aquí</b><span class="vt-chip ' + cls + '">' + esc({ alto: 'Aporta cobertura', medio: 'Aporta con solape', bajo: 'Aporta poco', sin_datos: 'Sin datos' }[r.nivel] || r.nivel) + '</span></div>' +
        tresTiempos(r.encontro, r.recomienda, r.si_no_se_hace) +
        '<div class="vt-nota" style="margin-top:10px">Radio de ' + esc(r.radio_m) + ' m · ' + esc(r.norma_radio || '') + ' · ' + esc(r.aviso || '') + '</div>' +
        '<div class="vt-acciones"><button type="button" class="vt-btn sutil" data-vt-accion="evaluar-otro">Probar otro punto</button></div>');
    }).catch(function (e) {
      pintarHoja(estado('error', { titulo: 'No se pudo evaluar', texto: e.message }));
    });
  }
  function tresTiempos(a, b, c) {
    return '<div class="vt-tiempo encontro"><div class="vt-eyebrow">Qué encontró</div><p>' + esc(a || '') + '</p></div>' +
      '<div class="vt-tiempo recomienda"><div class="vt-eyebrow">Qué recomienda</div><p>' + esc(b || '') + '</p></div>' +
      '<div class="vt-tiempo si-no"><div class="vt-eyebrow">Qué pasa si no se hace</div><p>' + esc(c || '') + '</p></div>';
  }

  /* ── propuestas ─────────────────────────────────────────────────────────── */
  function cargarPropuestas(forzar, silencio) {
    var c = $('vt-propuestas');
    if (S.propuestas && !forzar) { if (!silencio) pintarPropuestas(S.propuestas, 0); pintarPropuestasEnMapa(); return; }
    if (c && !silencio) c.innerHTML = estado('cargando', { texto: 'Trayendo las propuestas…' });
    pedir('GET', '/vt/propuestas').then(function (r) {
      S.propuestas = r; guardarCache('propuestas', r);
      if (!silencio) pintarPropuestas(r, 0);
      pintarPropuestasEnMapa();
    }).catch(function (e) {
      var g = deCache('propuestas');
      if (g) { S.propuestas = g.datos; if (!silencio) pintarPropuestas(g.datos, g.t); pintarPropuestasEnMapa(); return; }
      if (c && !silencio) c.innerHTML = estado('error', { titulo: 'No se pudieron traer las propuestas', texto: e.sinRed ? 'Sin conexión y sin nada guardado.' : e.message, accion: 'propuestas' });
    });
  }
  function pintarPropuestas(P, tCache) {
    var c = $('vt-propuestas'); if (!c) return;
    var lista = P.propuestas || [];
    var pend = lista.filter(function (p) { return p.estado === 'propuesta'; });
    var hist = lista.filter(function (p) { return p.estado !== 'propuesta'; }).sort(function (a, b) { return new Date(b.decidido_en || 0) - new Date(a.decidido_en || 0); });
    var h = '<h1 class="vt-h1">Propuestas</h1><p class="vt-sub">Ordenadas por prioridad. URBIS pondera y muestra; la decisión —y su firma— es de la persona.</p>';
    /* Esta pantalla no pasa por `pintarHoja` —pinta en su propio contenedor—,
       así que el aviso va explícito. Es la excepción, y por eso `tvision`
       comprueba las pantallas una por una y no solo la hoja. */
    h += avisoDatos(S.avisoDatos);
    if (tCache) h += '<div class="vt-chips">' + chipCache(tCache) + '</div>';
    if (!lista.length) {
      h += estado('vacio', { icono: 'plan', titulo: 'Todavía no hay propuestas', html: 'Una propuesta nace de una <b>mancha</b>: manzanas seguidas donde la gente queda a más del radio de caminata de un equipamiento público. ' + (S.tablero && S.tablero.analisis ? 'El último análisis no encontró ninguna con gente suficiente.' : 'Aparecen con el primer análisis del territorio.'), accion: (puede('analizar') && !(S.tablero && S.tablero.en_curso)) ? 'analizar' : null, accionTexto: 'Correr análisis' });
    } else {
      h += '<div class="vt-seccion-cab"><h2>Pendientes de decisión · ' + pend.length + '</h2></div>';
      if (!pend.length) h += '<div class="vt-card"><p class="vt-sub" style="margin:0">Todas decididas. La siguiente corrida propone lo que quede.</p></div>';
      pend.forEach(function (p) { h += tarjetaPropuesta(p); });
      if (hist.length) {
        h += '<div class="vt-seccion"><div class="vt-seccion-cab"><h2>Historial</h2><span class="vt-chip">no se borra, se cierra con resultado</span></div><div class="vt-linea-tiempo">';
        hist.forEach(function (p) {
          h += '<div class="vt-hito ' + esc(p.estado) + '"><b>' + esc(p.tipo_nombre) + '</b> · <span class="vt-estado-chip">' + esc(p.estado.replace('_', ' ')) + '</span>' +
            '<small>' + esc(fecha(p.decidido_en, true)) + ' · ' + esc(p.decidido_por || '') + '</small>' + (p.motivo ? '<div class="motivo">«' + esc(p.motivo) + '»</div>' : '') +
            '<button type="button" class="vt-enlace" data-vt-propuesta="' + esc(p.id) + '">Abrir</button></div>';
        });
        h += '</div></div>';
      }
    }
    c.innerHTML = h;
  }
  function tarjetaPropuesta(p) {
    var u = urgenciaDe(p.deficit && p.deficit.pct_cubierta_publica || 0);
    var pr = Math.round((p.prioridad || 0) * 100), pn = Math.round((p.prioridad_neutra || 0) * 100);
    return '<button type="button" class="vt-card urg urg-' + u + '" style="width:100%;text-align:left;display:block" data-vt-propuesta="' + esc(p.id) + '">' +
      '<div class="vt-prop-mini"><span class="vt-forma">' + forma(p.forma) + '</span><span style="flex:1"><b>' + esc(p.tipo_nombre) + '</b><small>' + esc(p.categoria_nombre) + ' · ' + esc(miles(p.poblacion_beneficiada)) + ' personas · ' + esc(p.deficit && p.deficit.gestion === 'obra' ? 'obra nueva' : 'gestión antes que obra') + '</small></span></div>' +
      '<div class="vt-barra"><i style="width:' + pr + '%"></i><b style="left:' + pn + '%" title="con pesos neutros"></b></div>' +
      '<div class="vt-barra-leyenda"><span>prioridad ' + pr + '</span><span>neutra ' + pn + '</span></div></button>';
  }

  function cargarPropuesta(id) {
    var c = $('vt-propuesta'); if (!c) return;
    var local = S.propuestas && (S.propuestas.propuestas || []).find(function (p) { return p.id === id; });
    if (local) { pintarPropuesta(local, 0); }
    else c.innerHTML = estado('cargando', { texto: 'Trayendo la propuesta…' });
    pedir('GET', '/vt/propuestas/' + id).then(function (r) { pintarPropuesta(r.propuesta, 0); })
      .catch(function (e) { if (!local) c.innerHTML = estado('error', { titulo: 'No se pudo abrir la propuesta', texto: e.message, accion: 'propuestas', accionTexto: 'Volver a propuestas', accionClase: 'sutil' }); });
  }
  function pintarPropuesta(p, tCache) {
    var c = $('vt-propuesta'); if (!c) return;
    var d = p.deficit || {};
    var h = '<button type="button" class="vt-enlace" data-vt-ir="propuestas" style="display:inline-flex;align-items:center;gap:6px">' + ico('atras', 16) + ' Propuestas</button>';
    h += '<h1 class="vt-h1">' + esc(p.tipo_nombre) + '</h1><p class="vt-sub">' + esc(p.categoria_nombre) + ' · <span class="vt-estado-chip">' + esc(p.estado.replace('_', ' ')) + '</span>' + (p.decidido_por ? ' · ' + esc(p.decidido_por) + ' · ' + esc(fecha(p.decidido_en, true)) : '') + '</p>';
    if (tCache) h += '<div class="vt-chips">' + chipCache(tCache) + '</div>';
    /* La ficha que se firma. Tampoco pasa por `pintarHoja`, y es la pantalla
       donde más caro sale callarlo: acá se aprueba una obra con un número de
       población beneficiada al lado. */
    h += avisoDatos(S.avisoDatos);
    h += '<div class="vt-columnas"><div>';
    h += '<div id="vt-ficha-mapa" aria-label="Zona apta"></div>';
    h += '<div class="vt-card">' + tresTiempos(d.encontro, d.recomienda, p.si_no_se_hace) + '</div>';
    h += '</div><div>';
    h += '<div class="vt-card"><div class="vt-eyebrow">Qué déficit resuelve</div><dl class="vt-dl">' +
      '<dt>Población beneficiada</dt><dd class="vt-num"><b>' + esc(miles(p.poblacion_beneficiada)) + '</b> personas en la mancha</dd>' +
      '<dt>Sin cobertura pública</dt><dd class="vt-num">' + esc(miles(d.sin_cobertura_publica)) + ' en el territorio (' + esc(pct(100 - (d.pct_cubierta_publica || 0))) + ')</dd>' +
      '<dt>Radio</dt><dd>' + esc(d.radio_m) + ' m · ' + esc(d.norma_radio || '') + '</dd>' +
      '<dt>Cobertura total / confirmada</dt><dd class="vt-num">' + esc(pct(d.pct_cubierta_total)) + ' / ' + esc(pct(d.pct_cubierta_confirmada)) + '</dd>' +
      '<dt>Método</dt><dd>' + esc(d.metodo === 'radio_recto' ? 'radio recto · isócrona pendiente' : d.metodo || '') + '</dd></dl></div>';
    h += '<div class="vt-card"><div class="vt-eyebrow">Antes de la obra</div><p style="margin:6px 0 0;font-size:.95em">' + esc(p.opcion_gestion || '') + '</p></div>';
    h += '<div class="vt-card"><div class="vt-eyebrow">Costo · ' + esc(p.costo && p.costo.etiqueta || 'estimación preliminar') + '</div>' +
      (p.costo && p.costo.min != null ? '<div class="vt-kpi vt-num" style="font-size:1.4em">' + esc(cop(p.costo.min)) + ' – ' + esc(cop(p.costo.max)) + '<small> COP</small></div><div class="vt-nota">' + esc(d.costo_nota || '') + '. El costo del suelo queda fuera a propósito: varía por zona y distorsiona el ranking.</div>' : '<div class="vt-nota">Sin referencia de costo cargada para este tipo.</div>') + '</div>';
    h += '<div class="vt-card"><div class="vt-eyebrow">Prioridad</div><div class="vt-prio"><span>Con los pesos de la corrida</span><b class="vt-num">' + Math.round((p.prioridad || 0) * 100) + '</b><span>Con pesos neutros (⅓ · ⅓ · ⅓)</span><b class="vt-num">' + Math.round((p.prioridad_neutra || 0) * 100) + '</b></div><div class="vt-nota">Las dos siempre juntas: la neutra es la defensa contra la presión y contra el sesgo de quien configura.</div></div>';
    // acciones por rol: si un rol no puede algo, el botón NO aparece
    if (p.estado === 'propuesta') {
      var acc = '';
      if (puede('aprobar')) acc += '<button type="button" class="vt-btn primario" data-vt-accion="aprobar" data-id="' + esc(p.id) + '">' + ico('ok', 18) + ' Aprobar</button>';
      if (puede('decidir')) acc += '<button type="button" class="vt-btn" data-vt-accion="programada" data-id="' + esc(p.id) + '">' + ico('plan', 18) + ' Ya está programada</button>' +
        '<button type="button" class="vt-btn peligro" data-vt-accion="descartar" data-id="' + esc(p.id) + '">' + ico('cerrar', 18) + ' Descartar o inviable</button>';
      if (acc) h += '<div class="vt-acciones">' + acc + '</div>';
      if (S.sinRed) h += '<div class="vt-nota">Sin conexión se consulta y se exporta; no se aprueba. La decisión se registra en el servidor con fecha y responsable.</div>';
      else if (!puede('decidir')) h += '<div class="vt-nota">Tu rol consulta lo publicado. Decidir es del equipo técnico y del gobernante.</div>';
    }
    h += '</div></div>';
    c.innerHTML = h;
    pintarFichaMapa(p);
  }
  function pintarFichaMapa(p) {
    var el = $('vt-ficha-mapa'); if (!el || !window.L) return;
    try { if (S.fichaMapa) { S.fichaMapa.remove(); S.fichaMapa = null; } } catch (e) {}
    var claro = document.documentElement.getAttribute('data-theme') === 'claro';
    var m = L.map(el, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/' + (claro ? 'light_all' : 'dark_all') + '/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19 }).addTo(m);
    var capa = L.layerGroup().addTo(m);
    if (p.zona) { try { var z = L.geoJSON(p.zona, { style: { color: '#34CCFE', weight: 1.5, dashArray: '4 4', fillColor: '#34CCFE', fillOpacity: .1 } }); capa.addLayer(z); m.fitBounds(z.getBounds(), { padding: [16, 16] }); } catch (e) { m.setView([p.lat, p.lng], 15); } }
    else m.setView([p.lat, p.lng], 15);
    capa.addLayer(L.marker([p.lat, p.lng], { keyboard: false, icon: L.divIcon({ className: '', html: '<div class="vt-prop-marca"><span class="halo"></span><span class="nucleo"></span></div>', iconSize: [30, 30], iconAnchor: [15, 15] }) }));
    S.fichaMapa = m;
    setTimeout(function () { try { m.invalidateSize(); } catch (e) {} }, 80);
  }

  /* decidir: modal único, una sola capa a la vez */
  function abrirModal(html, alMontar) {
    var m = $('vt-modal'); if (!m) return;
    m.innerHTML = '<div class="vt-modal-caja">' + html + '</div>'; m.hidden = false;
    m.onclick = function (ev) { if (ev.target === m) cerrarModal(); };
    if (alMontar) alMontar(m);
    var f = m.querySelector('textarea, input, select, button'); if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 40);
  }
  function cerrarModal() { var m = $('vt-modal'); if (m && !m.hidden) { m.hidden = true; m.innerHTML = ''; } }

  function decidir(id, estadoNuevo, motivo, boton) {
    if (boton) { boton.disabled = true; boton.textContent = 'Registrando…'; }
    return pedir('POST', '/vt/propuestas/' + id + '/estado', { estado: estadoNuevo, motivo: motivo || '' }).then(function (r) {
      cerrarModal(); toast(r.mensaje || 'Registrado.');
      S.propuestas = null; S.tablero = null;
      cargarPropuestas(true, true);
      cargarPropuesta(id);
    }).catch(function (e) {
      toast(e.message); if (boton) { boton.disabled = false; boton.textContent = 'Confirmar'; }
    });
  }
  function modalAprobar(id) {
    abrirModal('<h3>Aprobar esta propuesta</h3><p>Queda escrito con tu nombre, tu rol y la hora. Es la memoria de decisión del municipio y no se borra: si después se cae, se cierra con su motivo.</p>' +
      '<p>Para confirmar, escribí <b>APROBAR</b>. <span style="color:var(--vt-tinta-3)">(La contraseña de nuevo llega con las cuentas por entidad; hoy la credencial es la de este equipo.)</span></p>' +
      '<input type="text" id="vt-conf" autocomplete="off" placeholder="APROBAR">' +
      '<div class="vt-acciones"><button type="button" class="vt-btn primario" id="vt-conf-ok" disabled>Confirmar</button><button type="button" class="vt-btn sutil" data-vt-accion="cerrar-modal">Cancelar</button></div>',
      function (m) {
        var i = m.querySelector('#vt-conf'), b = m.querySelector('#vt-conf-ok');
        i.oninput = function () { b.disabled = i.value.trim().toUpperCase() !== 'APROBAR'; };
        b.onclick = function () { decidir(id, 'aprobada', '', b); };
      });
  }
  function modalDescartar(id) {
    abrirModal('<h3>Descartar o marcar inviable</h3><p>Una propuesta técnicamente viable puede ser políticamente imposible. Se marca con su motivo —obligatorio— y URBIS no la vuelve a proponer. Ese registro es del municipio, no público.</p>' +
      '<div class="vt-opciones"><label class="vt-opcion"><input type="radio" name="vt-est" value="descartada" checked> Descartada · no se va a hacer</label><label class="vt-opcion"><input type="radio" name="vt-est" value="inviable"> Inviable · no se puede hacer (predio, litigio, riesgo, comunidad)</label></div>' +
      '<textarea id="vt-motivo" placeholder="Por qué. Mínimo 10 caracteres."></textarea>' +
      '<div class="vt-acciones"><button type="button" class="vt-btn peligro" id="vt-conf-ok" disabled>Confirmar</button><button type="button" class="vt-btn sutil" data-vt-accion="cerrar-modal">Cancelar</button></div>',
      function (m) {
        var t = m.querySelector('#vt-motivo'), b = m.querySelector('#vt-conf-ok');
        t.oninput = function () { b.disabled = t.value.trim().length < 10; };
        b.onclick = function () { var est = (m.querySelector('input[name="vt-est"]:checked') || {}).value || 'descartada'; decidir(id, est, t.value.trim(), b); };
      });
  }
  function modalProgramada(id) {
    abrirModal('<h3>Ya está programada</h3><p>El municipio ya la tiene en su plan o en contratación. URBIS la pinta distinto y no la vuelve a proponer; el seguimiento cruza después con SECOP.</p>' +
      '<div class="vt-acciones"><button type="button" class="vt-btn primario" id="vt-conf-ok">Confirmar</button><button type="button" class="vt-btn sutil" data-vt-accion="cerrar-modal">Cancelar</button></div>',
      function (m) { m.querySelector('#vt-conf-ok').onclick = function (ev) { decidir(id, 'ya_programada', '', ev.currentTarget); }; });
  }

  /* ── ajustes y ayuda ────────────────────────────────────────────────────── */
  function seg(nombre, valor, opciones) {
    return '<div class="vt-seg" data-vt-seg="' + nombre + '">' + opciones.map(function (o) { return '<button type="button" data-v="' + esc(o[0]) + '" aria-pressed="' + (String(valor) === String(o[0])) + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>';
  }
  function modalAjustes() {
    var p = prefs();
    abrirModal('<h3>Ajustes</h3>' +
      '<p>Tema</p>' + seg('tema', p.tema || 'oscuro', [['oscuro', 'Oscuro'], ['claro', 'Claro']]) +
      '<p style="margin-top:12px">Tamaño de letra</p>' + seg('escala', p.escala || 1, [[1, 'Normal'], [1.15, 'Grande'], [1.3, 'Muy grande']]) +
      '<p style="margin-top:12px">Rendimiento · los efectos se degradan, no se quitan</p>' + seg('nivel', p.nivel || 'auto', [['auto', 'Auto'], ['completo', 'Completo'], ['medio', 'Medio'], ['minimo', 'Mínimo']]) +
      '<div class="vt-acciones" style="margin-top:18px"><button type="button" class="vt-btn peligro" data-vt-accion="salir">Cerrar sesión en este equipo</button><button type="button" class="vt-btn sutil" data-vt-accion="cerrar-modal">Listo</button></div>' +
      '<p style="margin-top:12px;color:var(--vt-tinta-3);font-size:.78em">Versión ' + esc(VERSION || '—') + ' · ' + esc(S.ses && S.ses.rol ? rolNombre(S.ses.rol) : '') + '</p>',
      function (m) {
        m.querySelectorAll('.vt-seg button').forEach(function (b) {
          b.onclick = function () {
            var n = b.parentNode.getAttribute('data-vt-seg'), v = b.getAttribute('data-v');
            var q = prefs();
            if (n === 'tema') { if (v === 'oscuro') delete q.tema; else q.tema = v; }
            if (n === 'escala') { q.escala = Number(v); }
            if (n === 'nivel') { if (v === 'auto') delete q.nivel; else q.nivel = v; }
            guardarPrefs(q); aplicarPrefs(); modalAjustes();
          };
        });
      });
  }
  function aplicarPrefs() {
    var p = prefs(), h = document.documentElement;
    if (p.tema === 'claro') h.setAttribute('data-theme', 'claro'); else h.removeAttribute('data-theme');
    // El mapa lleva teselas del mismo tono: si cambia el tema, se rehace.
    if (S.mapa && S.mapa._vtClaro !== (p.tema === 'claro')) { try { S.mapa.remove(); } catch (e) {} S.mapa = null; S.capas = null; if (S.pantalla === 'mapa') mostrarMapa(); }
    h.style.setProperty('--vt-escala', String(p.escala || 1));
    var nivel = p.nivel;
    if (!nivel) {
      var reducir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var nucleos = navigator.hardwareConcurrency || 4, memoria = navigator.deviceMemory || 4;
      nivel = reducir ? 'minimo' : (nucleos <= 4 || memoria <= 2) ? 'medio' : 'completo';
    }
    h.setAttribute('data-vt-nivel', nivel);
  }
  var AYUDA = {
    tablero: ['El tablero', 'La cifra grande es el índice de salud urbana: cobertura pública confirmada, ponderada por urgencia. Debajo, las cuatro categorías donde falta más y las tres propuestas que más pesan. Todo dato trae su fecha y su fuente; lo que no está, se dice.'],
    mapa: ['El mapa', 'Las manchas rojas y ámbar son gente sin un equipamiento público del tipo elegido a distancia de caminata; no tienen borde porque el dato no lo tiene. Los iconos de línea son los equipamientos; solo las propuestas pulsan. «Evaluar idea» responde sobre un punto que vos marques.'],
    propuestas: ['Las propuestas', 'Cada una dice qué déficit resuelve, a cuánta gente beneficia y qué pasa si no se hace, con la opción de gestión antes que la obra. La prioridad viaja siempre con su versión neutra. Decidir deja escrito quién y por qué; nada se borra.'],
    propuesta: ['La ficha', 'La zona punteada es apta por población y distancia: el lote exacto lo escoge el municipio adentro. El costo es un rango por m² de obra pública, sin suelo. Aprobar es del gobernante; descartar exige motivo.']
  };
  function modalAyuda() {
    var a = AYUDA[S.pantalla] || AYUDA.tablero;
    abrirModal('<h3>' + esc(a[0]) + '</h3><p>' + esc(a[1]) + '</p><p><b>URBIS recomienda, el humano decide.</b> Nada de lo que ves aquí decide por vos; pondera y muestra.</p><div class="vt-acciones"><button type="button" class="vt-btn primario" data-vt-accion="cerrar-modal">Entendido</button></div>');
  }

  /* ── presentación ───────────────────────────────────────────────────────── */
  function presentar() {
    var h = document.documentElement;
    var salir = function () { h.classList.remove('vt-presentacion'); document.removeEventListener('fullscreenchange', alCambiar); };
    var alCambiar = function () { if (!document.fullscreenElement) salir(); };
    h.classList.add('vt-presentacion');
    try { if (h.requestFullscreen) h.requestFullscreen().catch(function () {}); } catch (e) {}
    document.addEventListener('fullscreenchange', alCambiar);
    toast('Modo presentación · Esc para salir');
  }

  /* ── sin red y actualización ────────────────────────────────────────────── */
  function pintarSinRed() {
    var el = $('vt-sin-red');
    if (S.sinRed) {
      if (!el) { el = document.createElement('div'); el.id = 'vt-sin-red'; el.className = 'vt-chip aviso'; document.body.appendChild(el); }
      el.innerHTML = ico('nube', 14) + ' Sin conexión · se consulta lo guardado, no se aprueba';
    } else if (el) el.remove();
  }
  function registrarSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw-vt.js?v=' + VERSION, { scope: '/vision-territorial' }).then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var nuevo = reg.installing; if (!nuevo) return;
        nuevo.addEventListener('statechange', function () {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) { S.swEsperando = nuevo; $('vt-actualizacion').hidden = false; }
        });
      });
    }).catch(function () {});
    // Nunca se recarga sola: si hay versión nueva, se avisa y se elige cuándo.
    var a = $('vt-act-ahora'), d = $('vt-act-despues');
    if (a) a.onclick = function () { location.reload(); };
    if (d) d.onclick = function () { $('vt-actualizacion').hidden = true; };
  }

  /* ── un solo despachador de clics ───────────────────────────────────────── */
  function despachar(ev) {
    var t = ev.target.closest ? ev.target.closest('[data-vt-ir],[data-vt-accion],[data-vt-propuesta],[data-vt-tipo]') : null;
    if (!t) return;
    if (t.hasAttribute('data-vt-ir')) { ev.preventDefault(); ir(t.getAttribute('data-vt-ir')); return; }
    if (t.hasAttribute('data-vt-propuesta')) { ev.preventDefault(); ir('propuesta', t.getAttribute('data-vt-propuesta')); return; }
    if (t.hasAttribute('data-vt-tipo')) { ev.preventDefault(); alternarLista(false); cargarDeficits(t.getAttribute('data-vt-tipo')); abrirHoja(true); return; }
    var a = t.getAttribute('data-vt-accion'), id = t.getAttribute('data-id');
    if (a === 'analizar') correrAnalisis();
    else if (a === 'tablero') cargarTablero(true);
    else if (a === 'propuestas') cargarPropuestas(true);
    else if (a === 'deficits') cargarDeficits(S.tipo, true);
    else if (a === 'lista') alternarLista(true);
    else if (a === 'evaluar-otro') encenderEvaluar();
    else if (a === 'aprobar') modalAprobar(id);
    else if (a === 'descartar') modalDescartar(id);
    else if (a === 'programada') modalProgramada(id);
    else if (a === 'cerrar-modal') cerrarModal();
    else if (a === 'presentar') presentar();
    else if (a === 'salir') { try { localStorage.removeItem(LS.licencia); } catch (e) {} S.ses = null; S.tablero = null; S.propuestas = null; cerrarModal(); ir('acceso'); }
  }

  /* ── arranque ───────────────────────────────────────────────────────────── */
  function arrancar() {
    aplicarPrefs();
    // iconos de la carcasa: trazo de js/71, nunca emojis
    document.querySelectorAll('#vt-nav [data-vt-ir] .ico, .vt-desktop-nav [data-vt-ir]').forEach(function (el) {
      var n = el.closest('[data-vt-ir]').getAttribute('data-vt-ir');
      el.innerHTML = ico({ tablero: 'estadistica', mapa: 'mapa', propuestas: 'plan' }[n], 22);
    });
    $('vt-btn-ayuda').innerHTML = ico('pregunta', 20);
    $('vt-btn-ajustes').innerHTML = ico('ajustes', 20);
    $('vt-btn-lista').innerHTML = ico('lista', 20);
    $('vt-fab-evaluar').innerHTML = ico('tocar', 18) + '<span>Evaluar idea</span>';
    document.addEventListener('click', despachar);
    $('vt-btn-ayuda').onclick = modalAyuda;
    $('vt-btn-ajustes').onclick = modalAjustes;
    $('vt-avatar').onclick = modalAjustes;
    $('vt-sel-tipo').onchange = function (ev) { cargarDeficits(ev.target.value); };
    $('vt-btn-lista').onclick = function () { alternarLista(); };
    $('vt-fab-evaluar').onclick = function () { if (S.evaluando) { apagarEvaluar(); cargarDeficits(S.tipo); } else encenderEvaluar(); };
    $('vt-hoja-asa').onclick = function () { var h = $('vt-hoja'); abrirHoja(h.getAttribute('data-abierta') !== '1'); };
    document.addEventListener('keydown', function (ev) {
      // Escape cierra lo abierto SIEMPRE, también con el foco en un campo:
      // quien escribe un motivo y se arrepiente no tiene que salir del
      // cuadro para poder cerrarlo. Lo que se bloquea en un campo son los
      // atajos de una tecla, para poder escribir «1» sin cambiar de pantalla.
      if (ev.key === 'Escape') { if (!cerrarLoAbierto() && document.documentElement.classList.contains('vt-presentacion')) document.documentElement.classList.remove('vt-presentacion'); return; }
      if (ev.target && /input|textarea|select/i.test(ev.target.tagName)) return;
      if (!S.ses) return;
      if (ev.key === '1') ir('tablero'); if (ev.key === '2') ir('mapa'); if (ev.key === '3') ir('propuestas');
    });
    window.addEventListener('online', function () { S.sinRed = false; pintarSinRed(); });
    window.addEventListener('offline', function () { S.sinRed = true; pintarSinRed(); });
    window.addEventListener('hashchange', function () { var d = pantallaDelHash(); if (d.p !== S.pantalla || (d.arg && d.arg !== S.propuestaId)) ir(d.p, d.arg, true); });
    iniciarHistorial();
    registrarSW();

    var destino = pantallaDelHash();
    if (!licencia()) { ir('acceso'); return; }
    $('vt-tablero').innerHTML = estado('cargando', { texto: 'Abriendo tu territorio…' });
    ir('tablero', null, true);
    cargarSesion().then(function () { ir(destino.p, destino.arg); })
      .catch(function (e) { ir('acceso'); pintarAcceso(e.sinRed ? 'Sin conexión con URBIS y sin sesión guardada.' : e.message); });
  }

  // El único nombre global: el espacio del módulo. Lo que otras pruebas
  // necesiten mirar está acá; nada de esto lo lee otro módulo.
  window.VT = { version: VERSION, estado: S, ir: ir, atras: atras, prefs: prefs, aplicarPrefs: aplicarPrefs, LS: LS };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
})();
