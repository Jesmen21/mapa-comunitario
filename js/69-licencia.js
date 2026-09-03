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

  var S = { abierto: false, estado: null, comprobando: false, error: '', motivo: '',
            // Modo emisor: solo para el dueño de URBIS, y solo si conoce el
            // secreto. Vive en la misma hoja porque es la misma conversación
            // —licencias— y separarlo en otra página sería un sitio más que
            // recordar y mantener.
            emitiendo: false, emitida: null, errorEmitir: '' };

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
      if (acc === 'modo-emitir') { S.emitiendo = !S.emitiendo; S.emitida = null; S.errorEmitir = ''; pintar(); return; }
      if (acc === 'emitir') { emitir(); return; }
      if (acc === 'copiar-lic') {
        var t = S.emitida && S.emitida.licencia;
        if (!t) return;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(t).then(function () {
              S.errorEmitir = ''; S.copiada = true; pintar();
            }, function () { S.copiada = false; pintar(); });
          }
        } catch (e) {}
        return;
      }
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

  async function emitir() {
    var g = function (id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; };
    var secreto = g('ulic-secreto');
    var cliente = g('ulic-cliente');
    var vence = g('ulic-vence');
    var plan = g('ulic-plan');
    var cupo = Number(g('ulic-cupo') || 0);

    if (!secreto) { S.errorEmitir = 'Falta el secreto de URBIS.'; pintar(); return; }
    if (!cliente) { S.errorEmitir = 'Ponele el nombre del cliente.'; pintar(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vence)) { S.errorEmitir = 'La fecha va como 2027-12-31.'; pintar(); return; }

    S.comprobando = true; S.errorEmitir = ''; S.emitida = null; S.copiada = false; pintar();
    try {
      var base = api();
      var res = await fetch(base + '/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + secreto },
        body: JSON.stringify({ cliente: cliente, plan: plan, vence: vence, cupo: cupo })
      });
      var c = await res.json();
      if (c && c.ok) S.emitida = c;
      else S.errorEmitir = (c && c.error) || ('El servidor respondió ' + res.status + '.');
    } catch (e) {
      S.errorEmitir = (e && e.message) || 'No se pudo emitir la licencia.';
    }
    S.comprobando = false;
    pintar();
  }

  function htmlEmisor() {
    var e = S.emitida;
    var hoy = new Date();
    var dentroDeUnAnio = new Date(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate())
      .toISOString().slice(0, 10);

    return '<div class="ulic-emisor">' +
      '<p class="ulic-pista">Solo para URBIS. Tu secreto <b>no se guarda</b>: se usa para esta ' +
      'emisión y se olvida al cerrar.</p>' +

      '<label class="ulic-lab" for="ulic-secreto">Secreto de URBIS</label>' +
      '<input id="ulic-secreto" class="ulic-in" type="password" autocomplete="off" spellcheck="false" ' +
        'placeholder="el valor de URBIS_SECRETO">' +

      '<label class="ulic-lab" for="ulic-cliente">Cliente</label>' +
      '<input id="ulic-cliente" class="ulic-in" type="text" maxlength="80" placeholder="Constructora del Norte S.A.S.">' +

      '<div class="ulic-fila">' +
        '<div><label class="ulic-lab" for="ulic-vence">Vence</label>' +
          '<input id="ulic-vence" class="ulic-in" type="date" value="' + dentroDeUnAnio + '"></div>' +
        '<div><label class="ulic-lab" for="ulic-cupo">Análisis por día</label>' +
          '<input id="ulic-cupo" class="ulic-in" type="number" min="0" step="10" value="200"></div>' +
      '</div>' +
      '<p class="ulic-pista">Cupo <b>0</b> = sin tope. El tope es lo que evita que un cliente ' +
      'con licencia buena raspe la clasificación entera llamando un millón de veces.</p>' +

      '<label class="ulic-lab" for="ulic-plan">Plan (opcional)</label>' +
      '<input id="ulic-plan" class="ulic-in" type="text" maxlength="40" placeholder="Pro">' +

      (S.errorEmitir ? '<p class="ulic-error">' + esc(S.errorEmitir) + '</p>' : '') +

      '<button type="button" data-ulic="emitir" class="ulic-principal"' +
        (S.comprobando ? ' disabled' : '') + '>' +
        (S.comprobando ? 'Emitiendo…' : 'Emitir licencia') + '</button>' +

      (e
        ? '<div class="ulic-ok">' +
            '<b>✓ Licencia emitida y verificada</b>' +
            '<div class="ulic-datos">' +
              '<div><small>Cliente</small><b>' + esc(e.cliente) + '</b></div>' +
              '<div><small>Vence</small><b>' + esc(e.vence) + '</b></div>' +
              '<div><small>Cupo</small><b>' + (e.cupo || 'sin tope') + '</b></div>' +
            '</div>' +
            '<textarea class="ulic-campo" readonly rows="3">' + esc(e.licencia) + '</textarea>' +
            '<button type="button" data-ulic="copiar-lic" class="ulic-quitar">' +
              (S.copiada ? '✓ copiada' : '📋 Copiar la licencia') + '</button>' +
            '<p class="ulic-pista">Mandásela al cliente. Apuntá también su id <code>' + esc(e.id) + '</code>: ' +
            'es lo que se pone en <code>URBIS_REVOCADAS</code> si algún día hay que anularla.</p>' +
          '</div>'
        : '') +
    '</div>';
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
        (S.emitiendo ? '' :
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
        (lic ? '<button type="button" data-ulic="quitar" class="ulic-quitar">Quitar la licencia de este dispositivo</button>' : '')) +

        '<button type="button" data-ulic="modo-emitir" class="ulic-quitar ulic-emitir-link">' +
          (S.emitiendo ? '← Volver' : 'Soy URBIS: emitir una licencia') + '</button>' +

        (S.emitiendo ? htmlEmisor() : '') +

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
