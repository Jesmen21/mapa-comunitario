/* URBIS · CONFIGURACIÓN Y PANEL DEL ADMINISTRADOR (js/13g)
   ═══════════════════════════════════════════════════════════════════════════
   Tres cosas que faltaban y que van juntas porque comparten el mismo sitio:

   1 · CONFIGURACIÓN (para todo el mundo), dentro del perfil. Ahí viven los
       términos y condiciones —que hasta ahora había que ACEPTAR en el registro
       sin poder leerlos en ninguna parte, que es lo peor de los dos mundos—,
       el correo de contacto y el canal para escribirle al administrador.

   2 · PETICIONES. Un canal para que la gente pida mejoras, con foto o captura.
       No es un chat en vivo: es un buzón. Se dijo así a propósito — prometer
       una conversación en tiempo real con una sola persona detrás es prometer
       algo que no se puede cumplir, y la primera vez que alguien escriba y no
       le contesten en diez minutos dejará de escribir. Un buzón que dice
       "te respondemos por correo" sí se puede sostener.

   3 · PANEL DEL ADMINISTRADOR: lo que hay que aprobar, lo que denunciaron y
       las peticiones sin leer, en un solo sitio y ordenado por urgencia.

   Dónde se guardan las peticiones
   ───────────────────────────────
   En la misma tabla que todo lo demás, como fila propia con tipo
   "📩 Petición URBIS". Se añadió 'peticion' a los filtros de filas meta (js/05,
   js/12, js/47, js/50 y el Apps Script) para que NO se pinten en el mapa: son
   correo interno, no reportes. El formato es usuario~~~texto~~~foto~~~estado,
   el mismo patrón de los comentarios.

   La foto va comprimida como el resto de evidencias. Si sale demasiado pesada
   se manda la petición SIN foto en vez de fallar: el texto es lo que importa,
   y perder la petición entera por una captura grande sería el peor resultado. */
(function () {
  'use strict';

  const TIPO_PETICION = '📩 Petición URBIS';
  const CORREO_URBIS = 'urbisprocity@gmail.com';
  // Google Sheets corta por celda; el guardado del formulario ya usa este
  // límite. Se deja margen para el texto y los separadores.
  const MAX_DESCRIPCION = 45000;

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function yo() {
    try { return (typeof urbisIdentidadActual === 'function') ? urbisIdentidadActual() : {}; }
    catch (e) { return {}; }
  }
  function soyAdmin() {
    try { return typeof window.urbisEsAdmin === 'function' && window.urbisEsAdmin(); }
    catch (e) { return false; }
  }
  /* El panel dejó de ser cosa de una sola persona: entra quien tenga algo
     delegado (js/13h), y dentro solo ve las bandejas de lo suyo. */
  function puedo(permiso) {
    try { if (typeof window.urbisPuede === 'function') return window.urbisPuede(permiso); }
    catch (e) {}
    return soyAdmin();
  }
  function tengoPanel() {
    try { if (typeof window.urbisTieneAlgunPermiso === 'function') return window.urbisTieneAlgunPermiso(); }
    catch (e) {}
    return soyAdmin();
  }
  function soyDueno() {
    try { if (typeof window.urbisEsDuenoUrbis === 'function') return window.urbisEsDuenoUrbis(); }
    catch (e) {}
    return soyAdmin();
  }
  function datos() {
    try {
      if (typeof globalData !== 'undefined' && Array.isArray(globalData)) return globalData;
      if (Array.isArray(window.globalData)) return window.globalData;
    } catch (e) {}
    return [];
  }
  function cerrarHoja(id) { const e = document.getElementById(id); if (e) e.remove(); }
  /* BASE_OFFSET es una `const` global de js/04. Con `const` no basta `typeof`:
     si js/04 se cortó antes de esa línea, la casilla existe pero sin valor y
     hasta preguntar por ella lanza. Un panel entero no se puede caer por eso,
     así que se pregunta dentro de un try y, si no hay respuesta, se usa el 43
     de siempre. */
  function baseOffset() {
    try { if (typeof BASE_OFFSET !== 'undefined') return BASE_OFFSET; } catch (e) {}
    return 43;
  }
  /* La compresión de fotos vive en js/05 y se expone con dos nombres distintos
     según la versión. Se buscan los dos antes de rendirse: si no se encuentra,
     la petición se manda sin captura en vez de fallar. */
  function comprimirImagen() {
    if (typeof window.procesarImagenSeleccionada === 'function') return window.procesarImagenSeleccionada;
    if (typeof window.urbanProcesarImagen === 'function') return window.urbanProcesarImagen;
    try { if (typeof procesarImagenSeleccionada === 'function') return procesarImagenSeleccionada; } catch (e) {}
    return null;
  }

  // ── Peticiones ───────────────────────────────────────────────────────────
  function leerPeticion(p) {
    const partes = String(p.descripcion || '').split('~~~');
    return { usuario: partes[0] || 'ciudadano', texto: partes[1] || '',
             foto: partes[2] || '', estado: partes[3] || 'nueva',
             fecha: p.fecha || '', fila: p };
  }
  /* Las peticiones NO están en globalData: se apartan al cargar, igual que los
     comentarios, porque no son reportes y no se pintan. Se leen de su cajón y
     se compara el tipo sin tildes ni emoji, que el Sheet a veces devuelve
     descompuestos. */
  function peticiones() {
    const bolsa = Array.isArray(window.urbisPeticiones) ? window.urbisPeticiones : [];
    return bolsa
      .map(leerPeticion)
      .sort(function (a, b) { return new Date(b.fecha || 0) - new Date(a.fecha || 0); });
  }
  window.urbisPeticionesSinLeer = function () {
    return peticiones().filter(function (x) { return x.estado !== 'leida'; }).length;
  };

  function enviarPeticion(texto, foto) {
    const u = yo();
    const limpio = String(texto || '').replace(/~~~/g, ' ').trim().slice(0, 1200);
    if (!limpio) return Promise.reject(new Error('Escribe tu petición antes de enviarla.'));
    let desc = [String(u.usuario || u.correo || 'ciudadano').replace(/~~~/g, ' '),
                limpio, foto || '', 'nueva'].join('~~~');
    // La captura es un extra: si no cabe, se manda el texto igual. Perder la
    // petición entera por una imagen grande sería el peor resultado posible.
    let sinFoto = false;
    if (desc.length > MAX_DESCRIPCION) {
      desc = [String(u.usuario || u.correo || 'ciudadano'), limpio, '', 'nueva'].join('~~~');
      sinFoto = true;
    }
    if (typeof window.urbisGuardarFila !== 'function') {
      return Promise.reject(new Error('No hay conexión con URBIS. Intenta más tarde.'));
    }
    return window.urbisGuardarFila({
      tipo: TIPO_PETICION, lat: '0', lng: '0', descripcion: desc, fecha: new Date().toISOString()
    }).then(function () { return { sinFoto: sinFoto }; });
  }

  window.urbisAbrirPeticion = function () {
    cerrarHoja('urbis-peticion-overlay');
    const ov = document.createElement('div');
    ov.id = 'urbis-peticion-overlay';
    ov.className = 'urbis-cfg-overlay';
    ov.innerHTML =
      '<div class="urbis-cfg" role="dialog" aria-modal="true">' +
        '<button type="button" class="ucfg-x" aria-label="Cerrar">×</button>' +
        '<h3>Escríbele al administrador</h3>' +
        '<p class="ucfg-sub">Cuéntanos qué mejorarías de URBIS, qué no te funcionó o qué te gustaría que existiera. ' +
        'Lo lee el equipo de URBIS y te responde al correo de tu cuenta.</p>' +
        '<textarea id="upet-texto" rows="5" maxlength="1200" placeholder="Escribe aquí tu petición o el problema que encontraste…"></textarea>' +
        '<label class="ucfg-foto"><span id="upet-foto-txt">📷 Adjuntar una captura (opcional)</span>' +
        '<input type="file" id="upet-foto" accept="image/*"></label>' +
        '<div class="ucfg-error" hidden></div>' +
        '<button type="button" class="ucfg-primario" id="upet-enviar">Enviar petición</button>' +
        '<small class="ucfg-nota">También puedes escribirnos directamente a <b>' + CORREO_URBIS + '</b>.</small>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('.ucfg-x').addEventListener('click', function () { ov.remove(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });

    const inputFoto = ov.querySelector('#upet-foto');
    inputFoto.addEventListener('change', function () {
      const f = this.files && this.files[0];
      ov.querySelector('#upet-foto-txt').textContent = f ? ('✓ ' + f.name.slice(0, 28)) : '📷 Adjuntar una captura (opcional)';
    });

    ov.querySelector('#upet-enviar').addEventListener('click', async function () {
      const boton = this;
      const err = ov.querySelector('.ucfg-error');
      const texto = ov.querySelector('#upet-texto').value;
      if (!String(texto).trim()) { err.textContent = 'Escribe tu petición antes de enviarla.'; err.hidden = false; return; }
      boton.disabled = true; boton.textContent = 'Enviando…';
      let foto = '';
      const f = inputFoto.files && inputFoto.files[0];
      const comprimir = comprimirImagen();
      if (f && comprimir) {
        boton.textContent = 'Procesando la captura…';
        try { foto = await comprimir(f); } catch (e) { foto = ''; }
      }
      try {
        const r = await enviarPeticion(texto, foto);
        ov.remove();
        alert(r.sinFoto
          ? 'Gracias, tu petición llegó.\n\nLa captura pesaba demasiado y se envió solo el texto. Si es importante, mándala a ' + CORREO_URBIS + '.'
          : 'Gracias, tu petición llegó al equipo de URBIS. Te respondemos al correo de tu cuenta.');
        try { if (typeof cargarPuntos === 'function') cargarPuntos(); } catch (e) {}
      } catch (e) {
        boton.disabled = false; boton.textContent = 'Enviar petición';
        err.textContent = (e && e.message) || 'No se pudo enviar. Intenta de nuevo.';
        err.hidden = false;
      }
    });
  };

  // ── Términos y condiciones ───────────────────────────────────────────────
  /* Están escritos aquí, en la aplicación, y no en un enlace a otra parte: se
     aceptan en el registro, así que hay que poder leerlos sin salir y sin
     conexión. Dicen lo que URBIS hace de verdad — no es un texto copiado. */
  const TERMINOS = [
    ['Qué es URBIS',
     'URBIS es un mapa hecho por la comunidad. Lo que ves lo publicaron vecinos como tú: no es información oficial ' +
     'de ninguna alcaldía, autoridad ni organismo de socorro, y no reemplaza una denuncia formal ni una llamada de emergencia. ' +
     'Si hay vida en riesgo, llama primero al 123 (o al 165, GAULA, si es secuestro o extorsión).'],
    ['Qué datos pedimos y por qué',
     'Para abrir una cuenta pedimos lo mínimo: correo, un nombre de usuario, tu fecha de nacimiento y dónde vives. ' +
     'Los datos de identidad —nombres, documento y celular— se piden DESPUÉS y solo cuando hacen falta: al subir una ' +
     'foto o al publicar un hecho del conflicto armado. Sirven para que cada publicación tenga alguien detrás.'],
    ['Qué se ve y qué no',
     'En el mapa se ve tu nombre de usuario. Tu documento, tu celular y tu correo NO se publican ni viajan con tus ' +
     'reportes. Los reportes del conflicto armado salen SIEMPRE como anónimos: URBIS sabe quién los publicó, el mapa no.'],
    ['Lo que publicas',
     'Eres responsable de lo que publicas. No se permite contenido sexual, violencia explícita, datos personales de ' +
     'otras personas, insultos, acusaciones directas ni información falsa a propósito. Cualquiera puede denunciar una ' +
     'publicación; si la denuncia es grave, el contenido se esconde del mapa mientras un moderador lo revisa. Esconder ' +
     'no es borrar: si fue un error, vuelve.'],
    ['Tus reportes',
     'Puedes editar y borrar tus propios reportes cuando quieras. El administrador de URBIS puede retirar cualquier ' +
     'publicación que incumpla estas reglas. Los reportes retirados quedan en el histórico interno, no en el mapa.'],
    ['Ubicación',
     'La ubicación se usa para colocar lo que reportas y para orientarte en el mapa. El análisis de movilidad usa ' +
     'datos anónimos y agregados, y es opcional: se acepta aparte en el registro y puedes pedir que se retire.'],
    ['Tus derechos',
     'Puedes pedir en cualquier momento que te digamos qué datos tuyos tenemos, que los corrijamos o que los ' +
     'eliminemos, escribiendo a ' + CORREO_URBIS + '. Eliminar la cuenta elimina tus datos de identidad; los reportes ' +
     'ya publicados pueden quedar en el mapa sin tu nombre, porque son información de utilidad para el barrio.'],
    ['Cambios',
     'Si estas condiciones cambian, se avisa dentro de la aplicación. Seguir usando URBIS después del aviso significa ' +
     'que aceptas la versión nueva.']
  ];

  window.urbisAbrirTerminos = function () {
    cerrarHoja('urbis-terminos-overlay');
    const ov = document.createElement('div');
    ov.id = 'urbis-terminos-overlay';
    ov.className = 'urbis-cfg-overlay';
    ov.innerHTML =
      '<div class="urbis-cfg urbis-cfg-largo" role="dialog" aria-modal="true">' +
        '<button type="button" class="ucfg-x" aria-label="Cerrar">×</button>' +
        '<h3>Términos y condiciones</h3>' +
        '<p class="ucfg-sub">Esto es lo que aceptaste al crear tu cuenta, en palabras claras.</p>' +
        TERMINOS.map(function (t) {
          return '<div class="ucfg-term"><b>' + esc(t[0]) + '</b><span>' + esc(t[1]) + '</span></div>';
        }).join('') +
        '<small class="ucfg-nota">¿Dudas o quieres ejercer tus derechos? Escríbenos a <b>' + CORREO_URBIS + '</b>.</small>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('.ucfg-x').addEventListener('click', function () { ov.remove(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
  };

  // ── Configuración ────────────────────────────────────────────────────────
  window.urbisAbrirConfiguracion = function () {
    cerrarHoja('urbis-config-overlay');
    const admin = tengoPanel();
    let pendientes = 0, denunciados = 0, sinLeer = 0;
    // Cada cifra solo cuenta si esa persona puede hacer algo con ella: un
    // número que avisa de trabajo que no se puede tocar es ruido.
    try {
      if (puedo('aprobar')) pendientes = window.urbisReportesPorAprobar().length;
      if (puedo('moderar')) denunciados = window.urbisContenidoDenunciado().length;
      if (puedo('peticiones')) sinLeer = window.urbisPeticionesSinLeer();
    } catch (e) {}
    const total = pendientes + denunciados + sinLeer;

    const ov = document.createElement('div');
    ov.id = 'urbis-config-overlay';
    ov.className = 'urbis-cfg-overlay';
    ov.innerHTML =
      '<div class="urbis-cfg" role="dialog" aria-modal="true">' +
        '<button type="button" class="ucfg-x" aria-label="Cerrar">×</button>' +
        '<h3>⚙️ Configuración</h3>' +
        (admin
          ? '<button type="button" class="ucfg-fila ucfg-fila-admin" data-ucfg="admin">' +
            '<span class="ucfg-ico">🛡️</span><div><b>' + (soyDueno() ? 'Panel de administración' : 'Panel de moderación') + '</b>' +
            '<small>' + esc(resumenDeLoMio()) + '</small></div>' +
            (total ? '<span class="ucfg-badge">' + total + '</span>' : '') + '</button>'
          : '') +
        '<button type="button" class="ucfg-fila" data-ucfg="peticion">' +
          '<span class="ucfg-ico">💡</span><div><b>Escríbele al administrador</b>' +
          '<small>Pide una mejora o cuéntanos un problema. Puedes adjuntar una captura.</small></div></button>' +
        '<button type="button" class="ucfg-fila" data-ucfg="terminos">' +
          '<span class="ucfg-ico">📜</span><div><b>Términos y condiciones</b>' +
          '<small>Qué datos pedimos, qué se ve en el mapa y cuáles son tus derechos.</small></div></button>' +
        '<a class="ucfg-fila" href="mailto:' + CORREO_URBIS + '?subject=URBIS%20%C2%B7%20Contacto">' +
          '<span class="ucfg-ico">✉️</span><div><b>Contactarnos</b>' +
          '<small>' + CORREO_URBIS + '</small></div></a>' +
        '<small class="ucfg-nota">URBIS · urbispro.city</small>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('.ucfg-x').addEventListener('click', function () { ov.remove(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    ov.querySelectorAll('[data-ucfg]').forEach(function (b) {
      b.addEventListener('click', function () {
        const q = b.getAttribute('data-ucfg');
        ov.remove();
        if (q === 'admin') window.urbisAbrirPanelAdmin();
        else if (q === 'peticion') window.urbisAbrirPeticion();
        else if (q === 'terminos') window.urbisAbrirTerminos();
      });
    });
  };

  /* Lo que dice el botón tiene que ser lo que la persona va a encontrar
     dentro. A una moderadora con un solo permiso no se le anuncia un panel
     con tres cosas que no puede tocar. */
  function resumenDeLoMio() {
    const partes = [];
    if (puedo('aprobar')) partes.push('aprobar reportes');
    if (puedo('moderar')) partes.push('revisar denuncias');
    if (puedo('eliminar')) partes.push('retirar publicaciones');
    if (puedo('peticiones')) partes.push('leer peticiones');
    if (puedo('vitrina')) partes.push('cuidar la vitrina');
    if (soyDueno()) partes.push('repartir permisos');
    if (!partes.length) return 'Tu panel de moderación.';
    const t = partes.join(', ');
    return t.charAt(0).toUpperCase() + t.slice(1) + '.';
  }

  // ── Qué tiene que mirar el administrador ─────────────────────────────────
  window.urbisReportesPorAprobar = function () {
    const base = baseOffset();
    return datos().filter(function (p) {
      try {
        if (typeof esFilaMetaUrbis === 'function' && esFilaMetaUrbis(p)) return false;
        return String(p.descripcion || '').split(' | ')[base + 1] === 'Pendiente';
      } catch (e) { return false; }
    });
  };
  /* Se miran los reportes Y los comentarios. Los comentarios viven fuera de
     globalData, así que buscarlos solo ahí dejaba fuera justo lo que más se
     denuncia: un insulto en la conversación de un reporte. */
  window.urbisContenidoDenunciado = function () {
    if (typeof window.urbisEstadoDenuncia !== 'function') return [];
    const todo = datos().concat(Array.isArray(window.urbisComentarios) ? window.urbisComentarios : []);
    return todo.filter(function (p) {
      try { return window.urbisEstadoDenuncia(p).hayQueRevisar; } catch (e) { return false; }
    });
  };

  function tituloDe(p) {
    const t = String(p.tipo || '');
    if (t.indexOf('omentario') !== -1) return 'Comentario de @' + (String(p.descripcion || '').split('~~~')[0] || 'ciudadano');
    if (t === TIPO_PETICION) return 'Petición de @' + leerPeticion(p).usuario;
    const d = String(p.descripcion || '').split(' | ');
    return (d[1] && d[1] !== 'N/A' ? d[1] : d[0]) || 'Publicación';
  }

  /* `bandejaPreferida` permite llegar directo a una pestaña (el módulo
     Vitrina del inicio abre el panel ya parado en la suya). */
  window.urbisAbrirPanelAdmin = function (bandejaPreferida) {
    if (!tengoPanel()) { alert('Esta sección es solo para quien modera URBIS.'); return; }
    cerrarHoja('urbis-admin-overlay');

    // Solo las bandejas de lo que esta persona puede hacer. Enseñar una
    // pestaña que al pulsar dice "no puedes" es peor que no enseñarla.
    const bandejas = [];
    if (puedo('aprobar'))    bandejas.push({ id:'aprobar',    nombre:'Por aprobar' });
    if (puedo('moderar'))    bandejas.push({ id:'denuncias',  nombre:'Denuncias' });
    if (puedo('peticiones')) bandejas.push({ id:'peticiones', nombre:'Peticiones' });
    if (puedo('vitrina'))    bandejas.push({ id:'vitrina',    nombre:'Vitrina' });
    if (soyDueno())          bandejas.push({ id:'equipo',     nombre:'Equipo' });
    // Con el permiso de retirar y nada más, la bandeja útil es la de
    // denuncias: es donde aparece lo que hay que quitar.
    if (!bandejas.length && puedo('eliminar')) bandejas.push({ id:'denuncias', nombre:'Denuncias' });

    const ov = document.createElement('div');
    ov.id = 'urbis-admin-overlay';
    ov.className = 'urbis-cfg-overlay';
    ov.innerHTML =
      '<div class="urbis-cfg urbis-cfg-largo urbis-admin" role="dialog" aria-modal="true">' +
        '<button type="button" class="ucfg-x" aria-label="Cerrar">×</button>' +
        '<h3>🛡️ ' + (soyDueno() ? 'Panel de administración' : 'Panel de moderación') + '</h3>' +
        '<div class="uadm-tabs">' +
          bandejas.map(function (b, i) {
            return '<button type="button" class="uadm-tab' + (i ? '' : ' on') + '" data-uadm="' + b.id + '">' +
                   esc(b.nombre) + '</button>';
          }).join('') +
        '</div>' +
        '<div class="uadm-lista"></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('.ucfg-x').addEventListener('click', function () { ov.remove(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });

    const lista = ov.querySelector('.uadm-lista');
    let pestana = (bandejas[0] && bandejas[0].id) || 'aprobar';
    if (bandejaPreferida && bandejas.some(function (b) { return b.id === bandejaPreferida; })) {
      pestana = bandejaPreferida;
      ov.querySelectorAll('.uadm-tab').forEach(function (t) {
        t.classList.toggle('on', t.getAttribute('data-uadm') === pestana);
      });
    }

    function vacio(txt) { return '<div class="uadm-vacio">✅ ' + txt + '</div>'; }
    // El botón de eliminar solo se dibuja si esa persona lo tiene: el
    // servidor lo rechazaría igual, pero ofrecerlo y que falle es peor.
    const btnBorrar = puedo('eliminar')
      ? '<button type="button" class="uadm-del" data-acc="borrar">Eliminar</button>' : '';

    function pintar() {
      if (pestana === 'aprobar') {
        const arr = window.urbisReportesPorAprobar();
        lista.innerHTML = arr.length ? arr.map(function (p) {
          const d = String(p.descripcion || '').split(' | ');
          const base = baseOffset();
          return '<div class="uadm-item" data-lat="' + esc(p.lat) + '">' +
            '<div class="uadm-txt"><b>' + esc(tituloDe(p)) + '</b>' +
            '<small>' + esc(p.tipo) + ' · @' + esc(d[base + 2] || 'anónimo') + '</small></div>' +
            '<div class="uadm-btns">' +
              '<button type="button" class="uadm-ver" data-acc="ver">Ver</button>' +
              '<button type="button" class="uadm-ok" data-acc="aprobar">Aprobar</button>' +
              btnBorrar +
            '</div></div>';
        }).join('') : vacio('No hay reportes esperando aprobación.');

      } else if (pestana === 'denuncias') {
        const arr = window.urbisContenidoDenunciado();
        lista.innerHTML = arr.length ? arr.map(function (p) {
          const e = window.urbisEstadoDenuncia(p);
          const motivos = e.denuncias.map(function (m) { return window.urbisMotivoDenuncia(m.motivo); }).join(', ');
          return '<div class="uadm-item" data-lat="' + esc(p.lat) + '" data-desc="' + esc(p.descripcion) + '">' +
            '<div class="uadm-txt"><b>' + esc(tituloDe(p)) + '</b>' +
            '<small>' + (e.oculto ? '<b class="uadm-oculto">ESCONDIDO</b> · ' : '') + esc(motivos) + '</small></div>' +
            '<div class="uadm-btns">' +
              (puedo('moderar') ? '<button type="button" class="uadm-ok" data-acc="restaurar">Devolver</button>' : '') +
              btnBorrar +
            '</div></div>';
        }).join('') : vacio('No hay contenido denunciado sin revisar.');

      } else if (pestana === 'vitrina') {
        // Los emprendimientos del barrio: crear, editar y decidir cuáles se
        // ven junto a los reportes. Vive en js/13i, que es su casa.
        if (typeof window.urbisPintarVitrinaAdmin === 'function') window.urbisPintarVitrinaAdmin(lista);
        else lista.innerHTML = vacio('No se pudo cargar la vitrina.');

      } else if (pestana === 'equipo') {
        // El reparto de permisos vive en js/13h: es su propia máquina y no
        // tiene por qué mezclarse con las bandejas de contenido.
        if (typeof window.urbisPintarEquipo === 'function') window.urbisPintarEquipo(lista);
        else lista.innerHTML = vacio('No se pudo cargar el reparto de permisos.');

      } else {
        const arr = peticiones();
        lista.innerHTML = arr.length ? arr.map(function (x, i) {
          return '<div class="uadm-item uadm-peticion' + (x.estado === 'leida' ? ' uadm-leida' : '') + '" data-i="' + i + '">' +
            '<div class="uadm-txt"><b>@' + esc(x.usuario) + (x.estado === 'leida' ? '' : ' <span class="uadm-nueva">nueva</span>') + '</b>' +
            '<span class="uadm-cuerpo">' + esc(x.texto) + '</span>' +
            (x.foto ? '<img class="uadm-captura" src="' + esc(x.foto) + '" alt="Captura enviada">' : '') +
            '<small>' + esc(new Date(x.fecha || Date.now()).toLocaleString('es-CO', { dateStyle:'medium', timeStyle:'short' })) + '</small></div>' +
            '<div class="uadm-btns">' +
              (x.estado === 'leida' ? '' : '<button type="button" class="uadm-ok" data-acc="leida">Marcar leída</button>') +
              (puedo('eliminar') ? '<button type="button" class="uadm-del" data-acc="borrar-peticion">Eliminar</button>' : '') +
            '</div></div>';
        }).join('') : vacio('No hay peticiones.');
      }
    }

    ov.querySelectorAll('.uadm-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        ov.querySelectorAll('.uadm-tab').forEach(function (x) { x.classList.remove('on'); });
        t.classList.add('on');
        pestana = t.getAttribute('data-uadm');
        pintar();
      });
    });

    lista.addEventListener('click', async function (ev) {
      const btn = ev.target.closest('[data-acc]');
      if (!btn) return;
      const item = btn.closest('.uadm-item');
      const acc = btn.getAttribute('data-acc');
      const lat = item.getAttribute('data-lat');
      const p = lat && typeof buscarPuntoPorLat === 'function' ? buscarPuntoPorLat(lat) : null;

      if (acc === 'ver') { ov.remove(); if (typeof window.urbisAbrirReportePorLat === 'function') window.urbisAbrirReportePorLat(lat); return; }

      if (acc === 'aprobar') {
        /* No se llama a `aprobarPunto`: esa función no devuelve promesa —el
           `await` no esperaría nada y la fila desaparecería de la lista aunque
           el guardado fallara— y además cierra el panel de registro clásico,
           que aquí no está abierto. Se hace el cambio directo. */
        if (!p) { alert('No se encontró el reporte.'); return; }
        const base = baseOffset();
        const d = String(p.descripcion || '').split(' | ');
        d[base + 1] = 'Aprobado';
        const nueva = d.join(' | ');
        btn.disabled = true; btn.textContent = '…';
        try {
          await window.urbisDBUpdate('lat', lat, { descripcion: nueva });
          p.descripcion = nueva;
          item.remove();
          if (!lista.querySelector('.uadm-item')) pintar();
          try { if (typeof cargarPuntos === 'function') cargarPuntos(); } catch (e) {}
        } catch (e) {
          btn.disabled = false; btn.textContent = 'Aprobar';
          alert('No se pudo aprobar: ' + ((e && e.message) || e));
        }
        return;
      }
      if (acc === 'restaurar') {
        if (!p) return;
        btn.disabled = true; btn.textContent = '…';
        try { await window.urbisModerar(p, 'restaurar'); item.remove(); if (!lista.querySelector('.uadm-item')) pintar(); }
        catch (e) { btn.disabled = false; btn.textContent = 'Devolver'; alert('No se pudo: ' + (e.message || e)); }
        return;
      }
      if (acc === 'borrar' || acc === 'borrar-peticion') {
        const objetivo = acc === 'borrar-peticion'
          ? (peticiones()[parseInt(item.getAttribute('data-i'), 10)] || {}).fila
          : p;
        if (!objetivo) { alert('No se encontró la publicación.'); return; }
        if (!puedo('eliminar')) { alert('No tienes el permiso de retirar publicaciones.'); return; }
        if (!confirm('¿Eliminar esto de forma permanente?\n\nNo se puede deshacer.')) return;
        btn.disabled = true; btn.textContent = '…';
        /* En peticiones se repinta entero: la lista se indexa por posición y
           al desaparecer una fila los índices de las demás se corren. */
        try {
          await window.urbisBorrarPublicacion(objetivo);
          if (pestana === 'peticiones') pintar();
          else { item.remove(); if (!lista.querySelector('.uadm-item')) pintar(); }
        }
        catch (e) { btn.disabled = false; btn.textContent = 'Eliminar'; alert('No se pudo eliminar: ' + (e.message || e)); }
        return;
      }
      if (acc === 'leida') {
        const x = peticiones()[parseInt(item.getAttribute('data-i'), 10)];
        if (!x) return;
        btn.disabled = true; btn.textContent = '…';
        const nueva = [x.usuario, x.texto, x.foto, 'leida'].join('~~~');
        try {
          await window.urbisDBUpdate('descripcion', x.fila.descripcion, { descripcion: nueva });
          x.fila.descripcion = nueva;
          pintar();
        } catch (e) { btn.disabled = false; btn.textContent = 'Marcar leída'; alert('No se pudo: ' + (e.message || e)); }
        return;
      }
    });

    pintar();
  };

  /* Borrar CUALQUIER publicación (pedido explícito). Los reportes se localizan
     por su latitud, como siempre; los comentarios y las peticiones comparten
     latitud con otras filas, así que se buscan por su texto exacto — si no, un
     borrado se llevaría por delante el reporte entero y los demás comentarios.

     Quién puede: el servidor decide (v575). El autor borra lo suyo y el
     administrador cualquier cosa; aquí solo se elige por qué campo buscar. */
  window.urbisBorrarPublicacion = function (p) {
    if (!p) return Promise.reject(new Error('No se encontró la publicación.'));
    if (typeof window.urbisDBDelete !== 'function') return Promise.reject(new Error('Sin conexión con URBIS.'));
    const t = String(p.tipo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const porTexto = t.indexOf('comentario') !== -1 || t.indexOf('peticion') !== -1;
    const promesa = porTexto
      ? window.urbisDBDelete('descripcion', p.descripcion)
      : window.urbisDBDelete('lat', String(p.lat));
    return promesa.then(function (r) {
      try {
        if (typeof globalData !== 'undefined' && Array.isArray(globalData)) {
          globalData = globalData.filter(function (x) { return x !== p; });
        }
      } catch (e) {}
      // Comentarios y peticiones viven en cajones aparte: si solo se quitan de
      // globalData reaparecen en la lista hasta la siguiente recarga completa.
      try {
        if (Array.isArray(window.urbisComentarios)) {
          window.urbisComentarios = window.urbisComentarios.filter(function (x) { return x !== p; });
        }
        if (Array.isArray(window.urbisPeticiones)) {
          window.urbisPeticiones = window.urbisPeticiones.filter(function (x) { return x !== p; });
        }
      } catch (e) {}
      try { if (typeof cargarPuntos === 'function') cargarPuntos(); } catch (e) {}
      return r;
    });
  };

  // ── El botón dentro del perfil ───────────────────────────────────────────
  // Se inyecta en vez de escribirse en el HTML de js/20 porque esa pantalla se
  // vuelve a pintar sola en varios momentos; así el botón reaparece siempre.
  function montarBotonPerfil() {
    const perfil = document.querySelector('.u52-screen[data-u52-screen="profile"] .u52-content');
    if (!perfil || perfil.querySelector('#urbis-abrir-config')) return;
    const salir = perfil.querySelector('.u52-profile-logout');
    const b = document.createElement('button');
    b.id = 'urbis-abrir-config';
    b.type = 'button';
    b.className = 'u52-profile-logout urbis-cfg-boton';
    b.innerHTML = '<span>⚙️</span><div><b>Configuración</b>' +
                  '<small>Términos, contacto y peticiones' + (soyAdmin() ? ' · panel de administración' : '') + '</small></div>';
    b.addEventListener('click', function () { window.urbisAbrirConfiguracion(); });
    if (salir) perfil.insertBefore(b, salir); else perfil.appendChild(b);
  }
  window.urbisMontarConfigPerfil = montarBotonPerfil;

  function arrancar() {
    montarBotonPerfil();
    // La pantalla de perfil se repinta al cambiar de sesión o de avatar; se
    // vigila para que el botón no desaparezca sin que nadie se entere.
    /* El observador se estrangula a propósito. Vigilar el `body` entero es lo
       único que garantiza encontrar la pantalla de perfil sin importar cuándo
       se pinte, pero el mapa mueve cientos de marcadores al arrastrarlo: sin
       freno, esto correría decenas de veces por segundo para no hacer nada.
       Una comprobación cada 700 ms es imperceptible para quien abre el perfil
       y gratis para el mapa. */
    let pendiente = false;
    function revisarConFreno() {
      if (pendiente) return;
      pendiente = true;
      setTimeout(function () { pendiente = false; montarBotonPerfil(); }, 700);
    }
    try {
      const obs = new MutationObserver(revisarConFreno);
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      setInterval(montarBotonPerfil, 3000);
    }
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(arrancar, 1200);
  else window.addEventListener('load', function () { setTimeout(arrancar, 1200); });
})();
