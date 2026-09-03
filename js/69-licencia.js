/* URBIS · LICENCIA DE EMPRESAS (fase 03, lado del cliente)
   ─────────────────────────────────────────────────────────────────────────
   La pantalla donde un cliente pega su licencia y ve qué tiene.

   POR QUÉ HACÍA FALTA
   El servidor sabía verificar licencias desde la fase 03, pero en el
   navegador la única forma de poner una era abrir la consola y escribir
   localStorage.setItem(...). Para quien paga, eso no es un producto. Encender
   el cobro sin esta pantalla habría dejado el módulo cerrado y sin salida.

   DÓNDE VIVE LA LICENCIA
   En el localStorage de cada cliente, y en ningún otro lado. NO va al
   repositorio: este sitio es público, y una licencia escrita en el código la
   tendría cualquiera —con lo cual dejaría de ser una licencia—.

   COMPROBAR NO GASTA CUPO
   La pantalla pregunta por GET /licencia, que verifica y devuelve el estado
   sin consumir un análisis. Validar mandando un análisis de mentira le
   descontaría uno al cliente cada vez que abre esta pantalla.

   CUÁNDO SE ABRE SOLA
   Cuando el servidor rechaza por licencia (401), la da por vencida o revocada
   (403), o se acabó el cupo del día (429). Ahí es cuando el usuario necesita
   esta pantalla, así que aparece sin que tenga que buscarla. */
(function () {
  'use strict';

  var CLAVE = 'urbis_licencia_analisis';

  var S = { abierto: false, estado: null, comprobando: false, error: '', motivo: '' };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function api() {
    var c = (window.URBIS_CONFIG && window.URBIS_CONFIG.ANALISIS) || {};
    return String(c.API || '').replace(/\/+$/, '');
  }

  function guardada() {
    try { return String(localStorage.getItem(CLAVE) || '').trim(); }
    catch (e) { return ''; }
  }

  function guardar(txt) {
    try { localStorage.setItem(CLAVE, String(txt || '').trim()); return true; }
    catch (e) { return false; }
  }

  function borrar() {
    try { localStorage.removeItem(CLAVE); } catch (e) {}
  }

  // ── Comprobación contra el servidor ───────────────────────────────────
  async function comprobar(lic) {
    var base = api();
    if (!base) throw new Error('Este navegador no tiene configurado el servidor de análisis.');
    var res = await fetch(base + '/licencia', {
      headers: lic ? { Authorization: 'Bearer ' + lic } : {}
    });
    var cuerpo = null;
    try { cuerpo = await res.json(); } catch (e) { cuerpo = null; }
    if (!cuerpo) throw new Error('El servidor respondió algo que no se pudo leer (' + res.status + ').');
    cuerpo.codigo = res.status;
    return cuerpo;
  }

  // ── La hoja ───────────────────────────────────────────────────────────
  function hoja() {
    var el = document.getElementById('ulic-hoja');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'ulic-hoja';
    el.className = 'ulic-hoja';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Licencia de URBIS para Empresas');
    document.body.appendChild(el);

    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-ulic]');
      if (!b) return;
      var acc = b.getAttribute('data-ulic');
      if (acc === 'cerrar') { cerrar(); return; }
      if (acc === 'guardar') { guardarYComprobar(); return; }
      if (acc === 'quitar') {
        borrar(); S.estado = null; S.error = ''; S.motivo = '';
        pintar(); return;
      }
    });
    // Enter en el campo hace lo mismo que el botón: nadie escribe una
    // licencia larga y después busca dónde hacer clic.
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && ev.target.id === 'ulic-campo') {
        ev.preventDefault(); guardarYComprobar();
      }
    });
    return el;
  }

  async function guardarYComprobar() {
    var campo = document.getElementById('ulic-campo');
    var txt = campo ? String(campo.value || '').trim() : '';
    if (!txt) { S.error = 'Pegá tu licencia en el campo de arriba.'; pintar(); return; }

    S.comprobando = true; S.error = ''; pintar();
    try {
      var r = await comprobar(txt);
      if (r.ok) {
        guardar(txt);
        S.estado = r; S.motivo = '';
      } else {
        // NO se guarda una licencia que el servidor rechaza: dejarla puesta
        // haría que cada análisis siguiente fallara sin que se entienda por qué.
        S.estado = null;
        S.motivo = r.motivo || '';
        S.error = r.error || 'La licencia no es válida.';
      }
    } catch (e) {
      S.error = (e && e.message) || 'No se pudo comprobar la licencia.';
    }
    S.comprobando = false;
    pintar();
  }

  function pintar() {
    var h = hoja();
    h.innerHTML = html();
    h.classList.toggle('ulic-visible', S.abierto);
  }

  function html() {
    var lic = guardada();
    var e = S.estado;

    var cuerpo;
    if (e && e.ok && e.exigidas === false) {
      cuerpo =
        '<div class="ulic-ok">' +
          '<b>Este servidor todavía no exige licencia.</b>' +
          '<p>El análisis funciona sin ella. Cuando URBIS active el cobro, acá vas a poner la tuya.</p>' +
        '</div>';
    } else if (e && e.ok) {
      var restante = e.restante === null ? 'sin tope' : e.restante;
      cuerpo =
        '<div class="ulic-ok">' +
          '<b>✓ Licencia activa</b>' +
          '<div class="ulic-datos">' +
            '<div><small>Cliente</small><b>' + esc(e.cliente) + '</b></div>' +
            (e.plan ? '<div><small>Plan</small><b>' + esc(e.plan) + '</b></div>' : '') +
            '<div><small>Vence</small><b>' + esc(e.vence) + '</b></div>' +
          '</div>' +
          '<div class="ulic-cupo">' +
            '<span>Análisis de hoy</span>' +
            '<b>' + e.usados + (e.cupo ? ' de ' + e.cupo : '') + '</b>' +
            '<em>' + (e.cupo ? 'quedan ' + restante : 'sin tope diario') + '</em>' +
          '</div>' +
          '<p class="ulic-pista">El cupo se reinicia cada día.</p>' +
        '</div>';
    } else {
      cuerpo = '';
    }

    return '' +
      '<div class="ulic-barra">' +
        '<b>🔑 Licencia de URBIS para Empresas</b>' +
        '<button type="button" data-ulic="cerrar" class="ulic-x" aria-label="Cerrar">✕</button>' +
      '</div>' +
      '<div class="ulic-cuerpo">' +
        (S.motivo === 'sin_cupo'
          ? '<p class="ulic-alerta">Se agotó el cupo de análisis de hoy. Se reinicia mañana; si necesitás más, escribinos.</p>'
          : S.motivo === 'vencida'
            ? '<p class="ulic-alerta">Tu licencia venció. Escribinos para renovarla.</p>'
            : S.motivo === 'revocada'
              ? '<p class="ulic-alerta">Esta licencia fue anulada. Escribinos para saber por qué.</p>'
              : '') +

        cuerpo +

        '<label class="ulic-lab" for="ulic-campo">Tu licencia</label>' +
        '<textarea id="ulic-campo" class="ulic-campo" rows="3" spellcheck="false" ' +
          'placeholder="URBIS1.xxxxx.xxxxx">' + esc(lic) + '</textarea>' +
        '<p class="ulic-pista">Es el texto largo que te entregó URBIS. Empieza por <code>URBIS1.</code></p>' +

        (S.error ? '<p class="ulic-error">' + esc(S.error) + '</p>' : '') +

        '<button type="button" data-ulic="guardar" class="ulic-principal"' +
          (S.comprobando ? ' disabled' : '') + '>' +
          (S.comprobando ? 'Comprobando…' : 'Comprobar y guardar') +
        '</button>' +
        (lic ? '<button type="button" data-ulic="quitar" class="ulic-quitar">Quitar la licencia de este dispositivo</button>' : '') +

        '<p class="ulic-nota">Tu licencia se guarda <b>solo en este navegador</b>. Si entrás desde otro ' +
        'dispositivo, tenés que pegarla ahí también. No la compartas: cualquiera que la tenga consume tu cupo.</p>' +
      '</div>';
  }

  // ── Entrada y salida ──────────────────────────────────────────────────
  async function abrir(motivo) {
    S.abierto = true;
    S.motivo = motivo || '';
    S.error = '';
    pintar();
    // Se comprueba lo que ya haya guardado, para que el cliente vea su estado
    // sin tener que pulsar nada.
    var lic = guardada();
    if (!lic && !motivo) return;
    S.comprobando = true; pintar();
    try {
      var r = await comprobar(lic);
      if (r.ok) { S.estado = r; if (!motivo) S.motivo = ''; }
      else { S.estado = null; if (!S.motivo) S.motivo = r.motivo || ''; S.error = r.error || ''; }
    } catch (err) {
      S.error = (err && err.message) || '';
    }
    S.comprobando = false;
    pintar();
  }

  function cerrar() {
    S.abierto = false;
    var h = document.getElementById('ulic-hoja');
    if (h) h.classList.remove('ulic-visible');
  }

  /* Cuando el servidor rechaza por licencia, esta pantalla es exactamente lo
     que el usuario necesita. Aparece sola en vez de dejarlo con un mensaje de
     error y ningún sitio adonde ir. */
  window.addEventListener('urbis:licencia', function (ev) {
    var d = (ev && ev.detail) || {};
    abrir(d.motivo || '');
  });

  window.URBIS_LICENCIA = {
    abrir: abrir,
    cerrar: cerrar,
    guardada: guardada,
    comprobar: comprobar,
    abierto: function () { return S.abierto; },
    estado: function () { return S.estado; }
  };
})();
