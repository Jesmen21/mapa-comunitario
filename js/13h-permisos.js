/* URBIS · PERMISOS DELEGADOS (js/13h)
   ═══════════════════════════════════════════════════════════════════════════
   Hasta ahora solo había dos escalones: ciudadana o dueño de todo. Para que
   alguien ayude a moderar había que darle la cuenta, que es lo mismo que
   darle las llaves de la casa para que riegue una planta.

   Aquí cada permiso es una TAREA, no un rango:

     · eliminar    — retirar cualquier publicación (lo que se pidió: una
                     moderadora que pueda quitar contenido inapropiado).
     · moderar     — decidir sobre lo denunciado: esconder o devolver al mapa.
     · aprobar     — dar el visto bueno a los reportes que esperan.
     · peticiones  — leer el buzón de peticiones y responderlas.

   Quien los reparte es SOLO el dueño (la cuenta del correo de URBIS). Si una
   moderadora pudiera repartirlos se ascendería sola y el reparto no valdría
   nada.

   Lo importante: lo que se decide aquí NO es la seguridad. El servidor mira
   la hoja de usuarios en cada escritura y decide él. Esto solo evita enseñar
   botones que van a fallar — que es una forma de mentirle a quien los pulsa.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const ETIQUETAS = {
    eliminar:   { icono:'🗑️', titulo:'Retirar publicaciones',
                  texto:'Puede eliminar cualquier reporte, comentario o petición. No puede editarlos.' },
    moderar:    { icono:'🛡️', titulo:'Revisar denuncias',
                  texto:'Decide si el contenido denunciado se esconde del mapa o vuelve.' },
    aprobar:    { icono:'✅', titulo:'Aprobar reportes',
                  texto:'Da el visto bueno a los reportes que esperan revisión.' },
    peticiones: { icono:'📩', titulo:'Leer el buzón',
                  texto:'Ve las peticiones que la gente escribe al administrador.' },
    vitrina:    { icono:'🛍️', titulo:'Administrar la vitrina',
                  texto:'Crea y edita los emprendimientos y decide cuáles se ven en el mapa.' }
  };
  const ORDEN = ['eliminar', 'moderar', 'aprobar', 'peticiones', 'vitrina'];

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function sesion() {
    try {
      return (window.URBIS_AUTH && typeof window.URBIS_AUTH.readSession === 'function')
        ? (window.URBIS_AUTH.readSession() || {}) : {};
    } catch (e) { return {}; }
  }
  function api(cuerpo) {
    if (!(window.URBIS_AUTH && typeof window.URBIS_AUTH.socialAPI === 'function')) {
      return Promise.reject(new Error('Sin conexión con URBIS.'));
    }
    const s = sesion();
    cuerpo.session_token = s.session_token || '';
    return window.URBIS_AUTH.socialAPI(cuerpo).then(function (out) {
      if (!out || out.ok === false) throw new Error((out && out.message) || 'No se pudo completar.');
      return out;
    });
  }

  window.URBIS_PERMISOS = ORDEN.slice();
  window.urbisEtiquetaPermiso = function (id) { return ETIQUETAS[id] || { icono:'•', titulo:id, texto:'' }; };

  window.urbisPermisos = function () {
    const s = sesion();
    const raw = s.permisos;
    if (Array.isArray(raw)) return raw.slice();
    return String(raw || '').split(',').map(function (x) { return x.trim().toLowerCase(); })
      .filter(function (x) { return ORDEN.indexOf(x) !== -1; });
  };
  window.urbisEsDuenoUrbis = function () {
    const s = sesion();
    if (s.es_dueno === true) return true;
    // Respaldo por correo mientras la sesión guardada sea de antes de que
    // existiera el reparto: sin esto el dueño no vería su propio panel hasta
    // volver a entrar.
    return String(s.correo || '').trim().toLowerCase() === 'urbisprocity@gmail.com';
  };
  /* ¿Puedo hacer esto? El dueño y el administrador, todo. Los demás, lo que
     el dueño les haya dado. */
  window.urbisPuede = function (permiso) {
    try { if (typeof window.urbisEsAdmin === 'function' && window.urbisEsAdmin()) return true; } catch (e) {}
    return window.urbisPermisos().indexOf(permiso) !== -1;
  };
  window.urbisTieneAlgunPermiso = function () {
    try { if (typeof window.urbisEsAdmin === 'function' && window.urbisEsAdmin()) return true; } catch (e) {}
    return window.urbisPermisos().length > 0;
  };

  /* Al abrir la aplicación se pregunta qué permisos hay AHORA. Sin esto, dar
     un permiso obligaría a la persona a cerrar sesión y volver a entrar para
     verlo, y quitarlo le dejaría botones que fallan. */
  window.urbisRefrescarPermisos = function () {
    const s = sesion();
    if (!s.session_token) return Promise.resolve([]);
    return api({ action: 'perm_mine' }).then(function (out) {
      try {
        const key = (window.URBIS_AUTH && typeof window.URBIS_AUTH.sessionKey === 'function')
          ? window.URBIS_AUTH.sessionKey() : 'urbis_auth_session_v1';
        const guardada = JSON.parse(localStorage.getItem(key) || 'null') || {};
        /* Solo se pisa lo guardado si la respuesta TRAE la lista de verdad.
           Una respuesta rara —un servidor viejo que no conoce `perm_mine`, un
           intermediario que devuelve otra cosa— no dice "esta persona no tiene
           permisos": no dice nada. Antes se leía como un cero y le quitaba los
           botones a quien sí los tenía. */
        if (Array.isArray(out.permisos)) guardada.permisos = out.permisos;
        if (typeof out.es_dueno === 'boolean') guardada.es_dueno = out.es_dueno;
        /* El rol también se refresca. Sin esto, a quien se le da admin después
           de haber iniciado sesión le sigue diciendo "citizen" el teléfono, y
           la aplicación le pide la cédula al propio administrador. */
        if (typeof out.es_admin === 'boolean') {
          guardada.es_admin = out.es_admin;
          if (out.es_admin) guardada.rol = 'admin';
        }
        localStorage.setItem(key, JSON.stringify(guardada));
      } catch (e) {}
      return Array.isArray(out.permisos) ? out.permisos : window.urbisPermisos();
    }).catch(function () { return window.urbisPermisos(); });
  };

  // ── La pestaña de equipo, dentro del panel de administración ─────────────
  window.urbisPintarEquipo = function (contenedor) {
    if (!window.urbisEsDuenoUrbis()) {
      contenedor.innerHTML = '<div class="uadm-vacio">Solo el dueño de URBIS reparte permisos.</div>';
      return;
    }
    contenedor.innerHTML =
      '<div class="uper-buscar">' +
        '<input type="text" id="uper-q" placeholder="@usuario, correo o ID URBIS" autocapitalize="off" autocomplete="off">' +
        '<button type="button" id="uper-buscar-btn">Buscar</button>' +
      '</div>' +
      '<p class="uper-ayuda">La persona tiene que estar registrada en URBIS con su propia cuenta. ' +
      'Búscala y marca solo lo que quieras darle.</p>' +
      '<div class="uper-resultado"></div>' +
      '<div class="uper-equipo"><b>Con permisos ahora</b><div class="uper-lista">Cargando…</div></div>';

    const resultado = contenedor.querySelector('.uper-resultado');
    const lista = contenedor.querySelector('.uper-lista');

    function fichaHTML(p, abierta) {
      const tiene = p.permisos || [];
      const filas = ORDEN.map(function (id) {
        const e = ETIQUETAS[id];
        return '<label class="uper-permiso"><input type="checkbox" data-permiso="' + id + '"' +
               (tiene.indexOf(id) !== -1 ? ' checked' : '') + '>' +
               '<span class="uper-ico">' + e.icono + '</span>' +
               '<div><b>' + esc(e.titulo) + '</b><small>' + esc(e.texto) + '</small></div></label>';
      }).join('');
      return '<div class="uper-ficha" data-usuario="' + esc(p.usuario) + '">' +
        '<div class="uper-quien"><b>@' + esc(p.usuario) + '</b>' +
        '<small>' + esc(p.nombre || '') + (p.correo_tapado ? ' · ' + esc(p.correo_tapado) : '') + '</small></div>' +
        (p.es_dueno
          ? '<div class="uper-dueno">Es la cuenta dueña de URBIS: ya tiene todo y no se cambia desde aquí.</div>'
          : (abierta ? filas + '<button type="button" class="uper-guardar">Guardar permisos</button>' : '')) +
        '</div>';
    }

    function cargarEquipo() {
      api({ action:'perm_list' }).then(function (out) {
        const eq = out.equipo || [];
        lista.innerHTML = eq.length
          ? eq.map(function (p) {
              return '<div class="uper-miembro" data-usuario="' + esc(p.usuario) + '">' +
                '<div><b>@' + esc(p.usuario) + '</b><small>' +
                (p.permisos || []).map(function (id) { return ETIQUETAS[id].titulo; }).join(' · ') +
                '</small></div><button type="button" class="uper-editar">Cambiar</button></div>';
            }).join('')
          : '<div class="uper-nadie">Todavía no le has dado permisos a nadie.</div>';
      }).catch(function (e) {
        lista.innerHTML = '<div class="uper-nadie">No se pudo consultar: ' + esc(e.message) + '</div>';
      });
    }

    function abrir(persona) {
      resultado.innerHTML = fichaHTML(persona, true);
      const ficha = resultado.querySelector('.uper-ficha');
      const guardar = ficha.querySelector('.uper-guardar');
      if (!guardar) return;
      guardar.addEventListener('click', function () {
        const marcados = Array.prototype.slice.call(ficha.querySelectorAll('[data-permiso]'))
          .filter(function (c) { return c.checked; })
          .map(function (c) { return c.getAttribute('data-permiso'); });
        guardar.disabled = true; guardar.textContent = 'Guardando…';
        api({ action:'perm_set', identificador: persona.usuario, permisos: marcados })
          .then(function () {
            guardar.textContent = '✓ Guardado';
            resultado.insertAdjacentHTML('beforeend',
              '<div class="uper-ok">Listo. @' + esc(persona.usuario) + ' ya tiene ' +
              (marcados.length ? esc(marcados.map(function (id) { return ETIQUETAS[id].titulo.toLowerCase(); }).join(', '))
                               : 'ningún permiso') + '. Le vale de inmediato.</div>');
            cargarEquipo();
          })
          .catch(function (e) {
            guardar.disabled = false; guardar.textContent = 'Guardar permisos';
            alert('No se pudo guardar: ' + e.message);
          });
      });
    }

    function buscar(ident) {
      const q = String(ident || contenedor.querySelector('#uper-q').value || '').trim();
      if (!q) return;
      resultado.innerHTML = '<div class="uper-nadie">Buscando…</div>';
      api({ action:'perm_find', identificador: q })
        .then(function (out) { abrir(out.persona); })
        .catch(function (e) { resultado.innerHTML = '<div class="uper-error">' + esc(e.message) + '</div>'; });
    }

    contenedor.querySelector('#uper-buscar-btn').addEventListener('click', function () { buscar(); });
    contenedor.querySelector('#uper-q').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); buscar(); }
    });
    lista.addEventListener('click', function (ev) {
      const b = ev.target.closest('.uper-editar');
      if (!b) return;
      const u = b.closest('.uper-miembro').getAttribute('data-usuario');
      contenedor.querySelector('#uper-q').value = u;
      buscar(u);
    });

    cargarEquipo();
  };

  // Al arrancar, ponerse al día con lo que el dueño haya cambiado.
  function arrancar() { try { window.urbisRefrescarPermisos(); } catch (e) {} }
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(arrancar, 1800);
  else window.addEventListener('load', function () { setTimeout(arrancar, 1800); });
})();
