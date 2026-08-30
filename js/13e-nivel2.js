/* URBIS · VERIFICAR LA IDENTIDAD CUANDO HACE FALTA (js/13e)
   ─────────────────────────────────────────────────────────────────────────
   El registro pide lo mínimo —correo, usuario, nacimiento, dónde vive— porque
   pedir quince campos en la puerta espanta justo a quien más queremos que
   reporte: el señor o la señora que vio algo y quiere avisar.

   La identidad legal (nombres, documento, celular) se pide DESPUÉS, y solo
   cuando de verdad hace falta. Esta pieza es ese "después". Son dos casos, y
   por razones distintas:

   · SUBIR UNA FOTO. Una imagen anónima sobre el mapa de un barrio es la vía
     más corta para que alguien publique una obscenidad o la cara de un
     vecino. Con cuenta verificada, quien lo haga responde por ello.

   · PUBLICAR UN HECHO DEL CONFLICTO ARMADO. Aquí el motivo se invierte: no es
     desconfianza, es que un dato falso sobre un grupo armado pone en peligro a
     gente real. Y precisamente por eso el reporte sale SIN NOMBRE: en zona de
     frontera, firmar una denuncia de extorsión identifica a quien denuncia.
     URBIS sabe quién publicó; el mapa no. Hay que decirlo con todas las
     letras, o nadie se atreve a publicar.

   Qué NO hace
   ───────────
   No convierte la verificación en un muro. Si el servidor todavía no conoce
   la acción de verificar (el Apps Script se actualiza a mano), los datos
   quedan en cola en el teléfono y se reintentan solos, y a la persona se le
   dice la verdad en vez de dejarla encerrada sin poder publicar. Bloquear una
   función que hoy funciona, por una actualización que no depende de ella,
   sería cambiarle un problema por otro peor. */
(function () {
  'use strict';

  const COLA = 'urbis_verificacion_pendiente_v1';

  function sesion() {
    try {
      const k = (window.URBIS_AUTH_CONFIG && window.URBIS_AUTH_CONFIG.SESSION_KEY) || 'urbis_auth_session_v1';
      return JSON.parse(localStorage.getItem(k) || 'null');
    } catch (e) { return null; }
  }

  function guardarSesion(s) {
    try {
      const k = (window.URBIS_AUTH_CONFIG && window.URBIS_AUTH_CONFIG.SESSION_KEY) || 'urbis_auth_session_v1';
      localStorage.setItem(k, JSON.stringify(s));
    } catch (e) {}
  }

  function limpio(v) { return String(v == null ? '' : v).trim(); }
  function soloDigitos(v) { return limpio(v).replace(/\D/g, ''); }

  /* Nivel de la cuenta:
       0 · sin sesión
       1 · cuenta básica (correo, usuario, nacimiento, ciudad)
       2 · identidad entregada
     El nivel se DEDUCE de lo que la cuenta tiene, no de una bandera suelta.
     Así, quien se registró con el formulario largo de antes —que pedía los
     quince campos— ya está verificado sin que nadie tenga que migrar nada. */
  window.urbisNivelCuenta = function () {
    const s = sesion();
    if (!s || !s.active) return 0;
    if (String(s.nivel_cuenta || '').toLowerCase() === 'verificado') return 2;
    const tieneNombre = limpio(s.nombres).length >= 2 && limpio(s.apellidos).length >= 2;
    const tieneDoc = soloDigitos(s.cedula_numero || s.cedula).length >= 5;
    const tieneCel = soloDigitos(s.telefono).length >= 7;
    return (tieneNombre && tieneDoc && tieneCel) ? 2 : 1;
  };

  /* ¿Este reporte es de los que exigen identidad? Se resuelve por el catálogo
     (js/03c), que es la única fuente de verdad de las categorías. */
  function fichaDeItem(item) {
    const cat = window.URBIS_QUICK_REPORTS || {};
    const buscado = limpio(item).toLowerCase();
    let hallado = null;
    Object.keys(cat).forEach(function (k) {
      if (hallado) return;
      if (limpio(cat[k].label).toLowerCase() === buscado) hallado = cat[k];
    });
    return hallado;
  }

  window.urbisEsReporteDeConflicto = function (categoria, item) {
    const f = fichaDeItem(item);
    if (f) return !!f.conflicto;
    // Respaldo por el nombre de la dimensión, para reportes creados desde el
    // formulario clásico, que no pasa por el catálogo rápido.
    return /seguridad nacional|conflicto/i.test(limpio(categoria));
  };

  // ── Envío al servidor, con cola si todavía no lo entiende ────────────────
  function servidorNoConoceLaAccion(msg) {
    return /acci[óo]n no soportada/i.test(String(msg || ''));
  }

  function enviarVerificacion(datos) {
    if (!(window.URBIS_AUTH && typeof window.URBIS_AUTH.socialAPI === 'function')) {
      return Promise.resolve({ ok: false, pendiente: true });
    }
    return window.URBIS_AUTH.socialAPI(Object.assign({ action: 'verify_identity' }, datos))
      .then(function (out) {
        if (out && out.ok) return { ok: true };
        if (servidorNoConoceLaAccion(out && out.message)) return { ok: false, pendiente: true };
        return { ok: false, mensaje: (out && out.message) || 'No se pudo guardar la verificación.' };
      })
      .catch(function () { return { ok: false, pendiente: true }; });
  }

  function encolar(datos) {
    try { localStorage.setItem(COLA, JSON.stringify(datos)); } catch (e) {}
  }

  /* Reintento silencioso: si quedó algo en cola porque el servidor aún no
     conocía la acción, se vuelve a intentar en cada arranque. La persona ya
     escribió sus datos una vez; no se le pide otra. */
  window.urbisReintentarVerificacionPendiente = function () {
    let datos = null;
    try { datos = JSON.parse(localStorage.getItem(COLA) || 'null'); } catch (e) {}
    if (!datos) return Promise.resolve(false);
    return enviarVerificacion(datos).then(function (r) {
      if (r.ok) { try { localStorage.removeItem(COLA); } catch (e) {} return true; }
      return false;
    });
  };

  // ── La hoja de verificación ──────────────────────────────────────────────
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const EXPLICACION = {
    foto: {
      titulo: 'Para subir una foto, verifica tu cuenta',
      porque: 'Una foto anónima sobre el mapa de un barrio es la vía más corta para que alguien publique una obscenidad o la cara de un vecino. Con la cuenta verificada, quien lo haga responde por ello.',
      publico: 'Tu documento y tu celular <b>no salen en el mapa</b>. En tu reporte se ve tu usuario, nada más.'
    },
    conflicto: {
      titulo: 'Para publicar esto, verifica tu cuenta',
      porque: 'Un dato falso sobre un grupo armado pone en peligro a gente real. Por eso este tipo de reporte solo lo publican cuentas verificadas.',
      publico: '<b>Tu nombre NO va a aparecer.</b> Este reporte sale como anónimo en el mapa: URBIS sabe quién lo publicó, pero nadie más. Puedes reportar con tranquilidad.'
    },
    // Respaldo por si algún día se pide verificación para otra cosa: una hoja
    // sin texto sería peor que no pedir nada.
    sensible: {
      titulo: 'Para publicar esto, verifica tu cuenta',
      porque: 'Es una categoría delicada y un reporte falso aquí hace daño. Con la cuenta verificada, cada reporte tiene alguien detrás.',
      publico: 'Tu documento y tu celular <b>no salen en el mapa</b>. En tu reporte se ve tu usuario, nada más.'
    }
  };

  /* Pide la identidad. Resuelve `true` si a partir de ahora la cuenta cuenta
     como verificada (aunque el envío haya quedado en cola), `false` si la
     persona cerró sin completar. */
  window.urbisExigirNivel2 = function (motivo) {
    if (window.urbisNivelCuenta() === 2) return Promise.resolve(true);
    if (window.urbisNivelCuenta() === 0) {
      alert('Inicia sesión en URBIS para poder publicar esto.');
      return Promise.resolve(false);
    }
    const txt = EXPLICACION[motivo] || EXPLICACION.sensible;
    const s = sesion() || {};

    return new Promise(function (resolver) {
      const previo = document.getElementById('urbis-n2-overlay');
      if (previo) previo.remove();

      const ov = document.createElement('div');
      ov.id = 'urbis-n2-overlay';
      ov.className = 'urbis-n2-overlay';
      ov.innerHTML =
        '<div class="urbis-n2" role="dialog" aria-modal="true" aria-labelledby="n2-title">' +
          '<h3 id="n2-title">' + esc(txt.titulo) + '</h3>' +
          '<p class="n2-porque">' + txt.porque + '</p>' +
          '<div class="n2-publico">' + txt.publico + '</div>' +
          '<div class="n2-campos">' +
            '<input id="n2-nombres" type="text" maxlength="60" placeholder="Nombres *" autocomplete="given-name" value="' + esc(s.nombres || '') + '">' +
            '<input id="n2-apellidos" type="text" maxlength="60" placeholder="Apellidos *" autocomplete="family-name" value="' + esc(s.apellidos || '') + '">' +
            '<input id="n2-cedula" type="tel" inputmode="numeric" maxlength="15" placeholder="Número de documento *" value="' + esc(s.cedula_numero || s.cedula || '') + '">' +
            '<input id="n2-celular" type="tel" inputmode="numeric" maxlength="15" placeholder="Celular *" autocomplete="tel" value="' + esc(s.telefono || '') + '">' +
          '</div>' +
          '<div class="n2-error" hidden></div>' +
          '<button type="button" class="n2-enviar">Verificar mi cuenta</button>' +
          '<button type="button" class="n2-cancelar">Ahora no</button>' +
        '</div>';
      document.body.appendChild(ov);

      let resuelto = false;
      function cerrar(res) {
        if (resuelto) return;
        resuelto = true;
        try { ov.remove(); } catch (e) {}
        resolver(res);
      }
      function error(msg) {
        const e = ov.querySelector('.n2-error');
        e.textContent = msg; e.hidden = false;
      }

      ov.querySelector('.n2-cancelar').addEventListener('click', function () { cerrar(false); });
      ov.addEventListener('click', function (e) { if (e.target === ov) cerrar(false); });

      ov.querySelector('.n2-enviar').addEventListener('click', function () {
        const boton = this;
        const nombres = limpio(ov.querySelector('#n2-nombres').value);
        const apellidos = limpio(ov.querySelector('#n2-apellidos').value);
        const cedula = soloDigitos(ov.querySelector('#n2-cedula').value);
        const celular = soloDigitos(ov.querySelector('#n2-celular').value);
        if (nombres.length < 2) return error('Escribe tus nombres.');
        if (apellidos.length < 2) return error('Escribe tus apellidos.');
        if (cedula.length < 5) return error('Escribe tu número de documento.');
        if (celular.length < 7) return error('Escribe tu número de celular.');

        boton.disabled = true; boton.textContent = 'Verificando…';
        const datos = { usuario: s.usuario || '', correo: s.correo || '',
                        nombres: nombres, apellidos: apellidos,
                        cedula_numero: cedula, telefono: celular };

        enviarVerificacion(datos).then(function (r) {
          if (!r.ok && !r.pendiente) {
            boton.disabled = false; boton.textContent = 'Verificar mi cuenta';
            return error(r.mensaje);
          }
          // La sesión local queda verificada en ambos casos. Si el envío quedó
          // en cola, se reintenta solo en cada arranque.
          const nueva = Object.assign({}, s, {
            nombres: nombres, apellidos: apellidos,
            nombre_completo: (nombres + ' ' + apellidos).trim(),
            cedula: cedula, cedula_numero: cedula, telefono: celular,
            nivel_cuenta: 'verificado',
            fecha_verificacion_identidad: new Date().toISOString()
          });
          guardarSesion(nueva);
          if (r.pendiente) {
            encolar(datos);
            cerrar(true);
            alert('Listo, ya puedes publicar.\n\nTus datos quedaron guardados en este teléfono; se enviarán al servidor de URBIS en cuanto esté disponible.');
            return;
          }
          try { localStorage.removeItem(COLA); } catch (e) {}
          cerrar(true);
        });
      });
    });
  };

  /* Puerta única para el guardado: decide si hace falta verificar y por qué.
     Devuelve `true` cuando se puede seguir publicando. */
  // Nota deliberada: las categorías "delicadas" que NO son del conflicto —robo,
  // riña, persona sospechosa— NO piden identidad. Son los reportes de seguridad
  // más frecuentes y los que más urge poder hacer rápido; ponerles un trámite
  // delante haría que dejaran de hacerse, y el riesgo que justifica el trámite
  // (una foto anónima, un dato inventado sobre un grupo armado) no está ahí.
  window.urbisPermitirPublicar = function (categoria, item, llevaFoto) {
    const esConflicto = window.urbisEsReporteDeConflicto(categoria, item);
    if (esConflicto) return window.urbisExigirNivel2('conflicto');
    if (llevaFoto) return window.urbisExigirNivel2('foto');
    return Promise.resolve(true);
  };

  // El reintento de la cola no debe estorbar el arranque: va detrás de todo.
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(window.urbisReintentarVerificacionPendiente, 4000);
  } else {
    window.addEventListener('load', function () { setTimeout(window.urbisReintentarVerificacionPendiente, 4000); });
  }
})();
