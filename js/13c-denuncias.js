/* URBIS · DENUNCIAR CONTENIDO Y MODERAR (js/13c)
   ─────────────────────────────────────────────────────────────────────────
   Hasta ahora, si alguien publicaba algo indebido —una foto obscena, un
   insulto, la dirección y la cédula de un vecino— no había forma de avisar. El
   único que podía quitarlo era el administrador, a mano y si se enteraba por
   casualidad. En un mapa abierto a una ciudad entera eso no se sostiene.

   Cómo está pensado
   ─────────────────
   · OCULTAR NO ES BORRAR. Una denuncia esconde el contenido del mapa mientras
     un moderador lo mira; el registro sigue completo y se puede restaurar. Esa
     es la razón por la que el umbral puede ser bajo sin que sea peligroso.

   · Motivos GRAVES (contenido sexual, violencia explícita, datos personales de
     alguien) ocultan con UNA sola denuncia de un usuario identificado. Se
     puede abusar, sí: alguien podría esconder un reporte legítimo alegando
     algo falso. Pero el daño de ese abuso es que un moderador tarde un rato en
     restaurarlo, y el daño de dejar una foto obscena publicada sobre el mapa
     de un barrio es de otro orden. El abuso además queda firmado: la denuncia
     guarda quién la hizo.

   · El resto de motivos necesitan DOS personas distintas. Una discrepancia no
     es moderación.

   · Sin sesión se puede denunciar y le llega al moderador, pero no oculta
     nada. Si no, bastaría con abrir ventanas anónimas para borrar del mapa lo
     que a uno no le guste.

   · Restaurado por un moderador, el contenido no se vuelve a ocultar con las
     mismas denuncias: solo cuentan las posteriores a esa revisión. Sin eso, un
     moderador y un denunciante entrarían en un ciclo infinito.

   · El autor SÍ ve su propio contenido oculto, con el aviso de que está en
     revisión. Que algo desaparezca sin explicación es lo que hace pensar que
     la aplicación está rota, y de paso impide corregirlo.

   Dónde se guarda
   ───────────────
   En los reportes, en su propia casilla del registro (URBIS_SLOTS.denuncias,
   repartida en js/04). En los comentarios, que son filas aparte con formato
   "usuario~~~texto", como un tercer campo al final. En ambos casos el dato se
   anuncia con un prefijo propio, así nadie lo confunde con otra cosa. */
(function () {
  'use strict';

  const PREFIJO = 'DENUNCIAS_URBIS:';
  // Basta una denuncia identificada para esconder algo así mientras se revisa.
  const GRAVES = new Set(['sexual', 'violencia', 'personales']);
  const PARA_OCULTAR = 2;   // denuncias de personas distintas, motivos no graves

  const MOTIVOS = [
    { id:'sexual',     etiqueta:'Contenido sexual o desnudos',            grave:true },
    { id:'violencia',  etiqueta:'Violencia explícita',                    grave:true },
    { id:'personales', etiqueta:'Datos personales de alguien (dirección, cédula, teléfono)', grave:true },
    { id:'ataque',     etiqueta:'Insultos o ataque a una persona',        grave:false },
    { id:'falso',      etiqueta:'Es falso a propósito',                   grave:false },
    { id:'spam',       etiqueta:'Publicidad o spam',                      grave:false },
    { id:'otro',       etiqueta:'Otro motivo',                            grave:false }
  ];
  const ETIQUETA = {};
  MOTIVOS.forEach(function (m) { ETIQUETA[m.id] = m.etiqueta; });

  function slotDenuncias() {
    if (window.URBIS_SLOTS && window.URBIS_SLOTS.denuncias != null) return window.URBIS_SLOTS.denuncias;
    return null; // sin reparto de casillas no se escribe a ciegas
  }

  // Quién denuncia. Misma regla que el resto de URBIS: el usuario con sesión es
  // la llave buena; sin sesión se marca el aparato, que sirve para no denunciar
  // dos veces pero no cuenta para ocultar.
  function quienDenuncia() {
    let usuario = '';
    try {
      const yo = (typeof urbisIdentidadActual === 'function') ? urbisIdentidadActual() : {};
      usuario = String(yo.usuario || yo.correo || '').trim().toLowerCase();
    } catch (e) {}
    if (usuario) return { clave: usuario, identificado: true };
    let dev = '';
    try {
      dev = localStorage.getItem('urbis_device_id') || '';
      if (!dev) { dev = 'd' + Math.random().toString(36).slice(2, 10); localStorage.setItem('urbis_device_id', dev); }
    } catch (e) { dev = 'anon'; }
    return { clave: 'anon:' + dev, identificado: false };
  }

  function vacio() { return { d:{}, oculto:'', revisado:'', nota:'' }; }

  function parsear(raw) {
    const s = String(raw || '');
    if (s.indexOf(PREFIJO) !== 0) return vacio();
    try {
      const o = JSON.parse(decodeURIComponent(s.slice(PREFIJO.length)));
      return { d:(o.d && typeof o.d === 'object') ? o.d : {},
               oculto:String(o.oculto || ''), revisado:String(o.revisado || ''),
               nota:String(o.nota || '') };
    } catch (e) { return vacio(); }
  }

  function serializar(v) {
    return PREFIJO + encodeURIComponent(JSON.stringify({
      d: v.d || {}, oculto: v.oculto || '', revisado: v.revisado || '', nota: v.nota || ''
    }));
  }

  // ── Lectura, para reportes y para comentarios ────────────────────────────
  function esComentario(p) {
    const t = String((p && p.tipo) || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return t.indexOf('comentario') !== -1;
  }

  function leerDe(p) {
    if (!p) return vacio();
    if (esComentario(p)) {
      const partes = String(p.descripcion || '').split('~~~');
      return parsear(partes[2] || '');
    }
    const idx = slotDenuncias();
    if (idx == null) return vacio();
    return parsear(String(p.descripcion || '').split(' | ')[idx] || '');
  }

  function escribirEn(p, v) {
    if (esComentario(p)) {
      const partes = String(p.descripcion || '').split('~~~');
      // usuario ~~~ texto ~~~ denuncias. El texto se recompone por si traía
      // separadores de más: nunca debe perderse lo que la persona escribió.
      const usuario = partes[0] || '';
      const texto = (partes.length > 2 ? partes.slice(1, 2) : partes.slice(1)).join(' ');
      return [usuario, texto, serializar(v)].join('~~~');
    }
    const idx = slotDenuncias();
    if (idx == null) return String(p.descripcion || '');
    const d = String(p.descripcion || '').split(' | ');
    for (let k = 0; k < idx; k++) if (d[k] === undefined) d[k] = '';
    d[idx] = serializar(v);
    return d.join(' | ');
  }

  /* Estado de moderación de un contenido, ya resuelto: qué denuncias cuentan,
     si está oculto y por qué. Es lo único que miran el mapa y el panel. */
  window.urbisEstadoDenuncia = function (p) {
    const v = leerDe(p);
    const desde = v.revisado ? new Date(v.revisado).getTime() : 0;
    const validas = [];
    Object.keys(v.d || {}).forEach(function (k) {
      const reg = v.d[k] || {};
      const t = reg.t ? new Date(reg.t).getTime() : 0;
      // Tras una revisión solo cuentan las denuncias nuevas: si no, moderador y
      // denunciante se quedarían ocultando y restaurando lo mismo para siempre.
      if (desde && t <= desde) return;
      validas.push({ quien: k, motivo: String(reg.m || 'otro'),
                     identificado: k.indexOf('anon:') !== 0, cuando: reg.t || '' });
    });
    const identificadas = validas.filter(function (x) { return x.identificado; });
    const graves = identificadas.filter(function (x) { return GRAVES.has(x.motivo); });
    const automatico = graves.length >= 1 || identificadas.length >= PARA_OCULTAR;

    return {
      total: validas.length,
      identificadas: identificadas.length,
      motivos: validas.map(function (x) { return x.motivo; }),
      denuncias: validas,
      // 'admin' = lo escondió un moderador a mano; 'auto' = lo escondieron las
      // denuncias. 'restaurado' = un moderador lo devolvió al mapa.
      oculto: v.oculto === 'oculto' ? 'admin' : (v.oculto === 'restaurado' ? '' : (automatico ? 'auto' : '')),
      revisado: v.revisado,
      motivoPrincipal: (graves[0] || identificadas[0] || validas[0] || {}).motivo || '',
      hayQueRevisar: validas.length > 0 && !v.revisado
    };
  };

  window.urbisContenidoOculto = function (p) {
    try { return !!window.urbisEstadoDenuncia(p).oculto; } catch (e) { return false; }
  };

  window.urbisMotivoDenuncia = function (id) { return ETIQUETA[id] || 'Otro motivo'; };
  window.urbisMotivosDenuncia = function () { return MOTIVOS.slice(); };

  // ── Guardado ─────────────────────────────────────────────────────────────
  function guardar(p, descripcionNueva) {
    p.descripcion = descripcionNueva; // la vista abierta refleja el cambio ya
    if (typeof window.urbisDBUpdate !== 'function') return Promise.resolve();
    // Los comentarios comparten `lat` con su reporte: se localizan por su texto
    // para no reescribir de paso el reporte entero ni los demás comentarios.
    if (esComentario(p)) return window.urbisDBUpdate('descripcion', p.__descripcionPrevia || '', { descripcion: descripcionNueva });
    return window.urbisDBUpdate('lat', String(p.lat), { descripcion: descripcionNueva });
  }

  window.urbisDenunciar = function (p, motivo) {
    if (!p) return Promise.reject(new Error('Sin contenido que denunciar'));
    const yo = quienDenuncia();
    const v = leerDe(p);
    v.d = v.d || {};
    if (v.d[yo.clave]) return Promise.reject(new Error('Ya denunciaste este contenido. Un moderador lo va a revisar.'));
    v.d[yo.clave] = { m: String(motivo || 'otro'), t: new Date().toISOString() };
    // Una denuncia nueva reabre el caso aunque ya se hubiera revisado antes.
    if (v.oculto === 'restaurado') v.oculto = '';
    p.__descripcionPrevia = p.descripcion;
    return guardar(p, escribirEn(p, v));
  };

  /* Acciones del moderador. `restaurar` deja constancia de la revisión, así las
     denuncias ya vistas no vuelven a esconder lo mismo. */
  window.urbisModerar = function (p, accion, nota) {
    const v = leerDe(p);
    if (accion === 'restaurar') { v.oculto = 'restaurado'; v.revisado = new Date().toISOString(); }
    else if (accion === 'ocultar') { v.oculto = 'oculto'; v.revisado = new Date().toISOString(); }
    else return Promise.reject(new Error('Acción de moderación desconocida'));
    if (nota) v.nota = String(nota).slice(0, 200);
    p.__descripcionPrevia = p.descripcion;
    return guardar(p, escribirEn(p, v));
  };

  // ── La pregunta ──────────────────────────────────────────────────────────
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.urbisAbrirDenuncia = function (p, titulo) {
    if (!p) return;
    const previo = document.getElementById('urbis-den-overlay');
    if (previo) previo.remove();

    const opciones = MOTIVOS.map(function (m) {
      return '<button type="button" class="ud2-motivo' + (m.grave ? ' ud2-grave' : '') +
             '" data-motivo="' + m.id + '">' + esc(m.etiqueta) + '</button>';
    }).join('');

    const ov = document.createElement('div');
    ov.id = 'urbis-den-overlay';
    ov.className = 'urbis-den-overlay';
    ov.innerHTML =
      '<div class="urbis-den" role="dialog" aria-modal="true" aria-labelledby="ud2-title">' +
        '<h3 id="ud2-title">Denunciar contenido</h3>' +
        '<div class="ud2-ref">' + esc(titulo || 'Contenido') + '</div>' +
        '<p class="ud2-nota">Cuéntanos qué pasa. Nada se borra: si hace falta, el contenido se esconde del mapa mientras un moderador lo revisa.</p>' +
        '<div class="ud2-motivos">' + opciones + '</div>' +
        '<button type="button" class="ud2-cancelar">Cancelar</button>' +
      '</div>';
    document.body.appendChild(ov);

    function cerrar() { try { ov.remove(); } catch (e) {} }
    ov.querySelector('.ud2-cancelar').addEventListener('click', cerrar);
    ov.addEventListener('click', function (e) { if (e.target === ov) cerrar(); });

    ov.querySelectorAll('.ud2-motivo').forEach(function (b) {
      b.addEventListener('click', function () {
        const motivo = b.getAttribute('data-motivo');
        ov.querySelectorAll('.ud2-motivo').forEach(function (x) { x.disabled = true; });
        b.textContent = 'Enviando…';
        window.urbisDenunciar(p, motivo).then(function () {
          cerrar();
          const oculto = window.urbisContenidoOculto(p);
          alert(oculto
            ? 'Gracias. El contenido queda escondido del mapa mientras un moderador lo revisa.'
            : 'Gracias. Tu denuncia le llegó a los moderadores de URBIS.');
          try { if (typeof cargarPuntos === 'function') cargarPuntos(); } catch (e) {}
          // Si la denuncia salió de la hoja de comentarios, se repinta ahí
          // mismo; cerrar el detalle del mapa solo aplica a los reportes.
          try {
            const hoja = document.getElementById('urbis-coment-sheet');
            if (hoja && typeof hoja.__urbisRender === 'function') hoja.__urbisRender();
            else if (typeof cancelarRegistro === 'function' && oculto) cancelarRegistro();
          } catch (e) {}
        }).catch(function (err) {
          cerrar();
          alert((err && err.message) || 'No se pudo enviar la denuncia. Intenta de nuevo.');
        });
      });
    });
  };

  /* Botón listo para insertar en un popup o en el detalle. No se ofrece sobre
     el contenido propio: para eso están editar y eliminar. */
  window.urbisBotonDenunciar = function (p, titulo) {
    if (!p) return '';
    try { if (typeof esAutorDelReporte === 'function' && esAutorDelReporte(p)) return ''; } catch (e) {}
    const t = String(titulo || '').replace(/'/g, '’').replace(/"/g, '');
    return '<button type="button" class="po-denunciar" onclick="window.urbisAbrirDenuncia && ' +
           'window.urbisAbrirDenuncia((typeof buscarPuntoPorLat===\'function\'?buscarPuntoPorLat(\'' +
           String(p.lat) + '\'):null), \'' + esc(t) + '\')">🚩 Denunciar</button>';
  };

  /* Atajo para los botones del detalle del reporte (js/10), que solo tienen la
     latitud a mano. */
  window.urbisModerarDesdeDetalle = function (lat, accion, btn) {
    const p = (typeof buscarPuntoPorLat === 'function') ? buscarPuntoPorLat(lat) : null;
    if (!p) { alert('No se encontró el contenido.'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
    window.urbisModerar(p, accion).then(function () {
      try { if (typeof cargarPuntos === 'function') cargarPuntos(); } catch (e) {}
      try { if (typeof mostrarDetalles === 'function') mostrarDetalles(p); } catch (e) {}
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Reintentar'; }
      alert('No se pudo guardar la decisión: ' + ((err && err.message) || err));
    });
  };

  /* Aviso para el autor de un contenido escondido: si desaparece sin más, lo
     razonable es pensar que la aplicación falló. */
  window.urbisAvisoModeracion = function (p) {
    const e = window.urbisEstadoDenuncia(p);
    if (!e.oculto) return '';
    const motivo = e.motivoPrincipal ? ' Motivo señalado: ' + esc(ETIQUETA[e.motivoPrincipal] || 'otro') + '.' : '';
    return '<div class="urbis-moderado">🚩 <b>Este contenido está escondido del mapa</b>' +
           '<span>Alguien lo denunció y un moderador de URBIS lo va a revisar.' + motivo +
           ' Si fue un error, volverá al mapa.</span></div>';
  };
})();
