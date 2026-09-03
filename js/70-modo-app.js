/* URBIS · MODO DE APLICACIÓN (js/70)
   ─────────────────────────────────────────────────────────────────────────
   Tres aplicaciones de Android sobre EL MISMO sitio. Un TWA no es más que un
   navegador sin barra apuntando a una dirección, así que no hacen falta tres
   sitios ni tres copias del código: basta con que cada APK arranque en una
   dirección distinta y que la aplicación sepa en cuál está.

     · /?app=ciudadano    → reportes, eventos, social, seguimiento
     · /?app=educativo    → Pro City y nada más
     · /analisis-ia.html  → empresarial (ya vive en su propia página)

   El modo se lee de la URL y NO se guarda. Es a propósito: los tres APK
   comparten el almacenamiento de Chrome —mismo dominio—, así que guardarlo
   haría que abrir el educativo dejara al ciudadano abriendo Pro City. Como la
   aplicación es de una sola página, el parámetro sobrevive solo.

   Esto NO es una barrera de seguridad y no pretende serlo: quien quite el
   parámetro ve la aplicación entera, igual que hoy en el navegador. Es
   ordenar qué le llega a cada público —un estudiante no necesita URBIS Rush
   en el menú— y separar las tres apps en la tienda. */
(function () {
  'use strict';

  var MODOS = {
    ciudadano: { modulos: ['map', 'events', 'social', 'games', 'sport', 'seguimiento'] },
    educativo: { modulos: ['procity'], abre: 'procity-open-map' }
  };

  function modoPedido() {
    try {
      var m = new URLSearchParams(location.search).get('app');
      return (m && MODOS[m]) ? m : '';
    } catch (e) { return ''; }
  }

  var MODO = modoPedido();
  if (!MODO) return;                    // sin parámetro, la app entera

  // La marca va en <html> y no en <body>: el CSS tiene que poder esconder
  // cosas ANTES de que la aplicación pinte, o se ven aparecer y desaparecer.
  document.documentElement.setAttribute('data-urbis-modo', MODO);
  window.URBIS_MODO_APP = MODO;

  var conf = MODOS[MODO];

  /* Las tarjetas del inicio que no son de este modo se quitan del DOM, no se
     esconden con CSS: una tarjeta invisible sigue recibiendo el foco del
     teclado y sigue leyéndose en un lector de pantalla, y el estudiante
     acabaría entrando a Minijuegos sin verlo. */
  function podarInicio() {
    var quitadas = 0;
    document.querySelectorAll('.u52-module').forEach(function (b) {
      var suyo = conf.modulos.some(function (m) { return b.classList.contains(m); });
      if (!suyo) { b.remove(); quitadas++; }
    });
    // Las rejillas que quedaron vacías se van con ellas.
    document.querySelectorAll('.u52-grid').forEach(function (g) {
      if (!g.querySelector('.u52-module')) g.remove();
    });
    return quitadas;
  }

  /* Una salida. En modo educativo la aplicación arranca DENTRO de Pro City y
     su barra de abajo es la del módulo —ubicación, categoría, mapa, mapeado—:
     no hay ningún camino de vuelta al perfil, así que tampoco hay forma de
     cerrar sesión. En la aplicación completa eso no pasa porque siempre se
     puede volver al inicio; acá el inicio no existe.

     Se añade un botón flotante junto a los otros del mapa, con la misma
     forma y el mismo sitio que ya usan la lupa y el lápiz, para que no
     parezca un parche. Va DENTRO de la app —no suelto en el documento— para
     que lo atienda el mismo despachador de clics que a los demás. */
  var BOTON_PERFIL = 'u70-perfil-btn';

  function ponerSalida() {
    if (MODO !== 'educativo') return;
    if (document.getElementById(BOTON_PERFIL)) return;
    var hermano = document.querySelector('.u52-procity-recon-btn');
    if (!hermano || !hermano.parentNode) return;
    var b = document.createElement('button');
    b.id = BOTON_PERFIL;
    b.type = 'button';
    b.className = 'u52-procity-perfil-btn';
    b.setAttribute('data-u52-go', 'profile');
    b.setAttribute('aria-label', 'Mi perfil y cerrar sesión');
    b.innerHTML = (window.URBIS_ICONO ? window.URBIS_ICONO('perfil', { tam: 24, grosor: 2 }) : '👤');
    hermano.parentNode.insertBefore(b, hermano.nextSibling);
    vestirBotonesDelMapa();
  }

  /* Los botones flotantes del mapa que ve el estudiante —la lupa y el lápiz—
     llevan un emoji cada uno. En la app educativa se les pone el icono lineal
     del mismo juego que el resto del módulo, para que la columna de botones
     se lea como una sola herramienta. Solo en este modo: en la app completa
     esos botones conviven con otros que siguen siendo emoji, y cambiar dos
     de seis daría más desorden del que quita. */
  var VESTIDOS = {
    '.u52-procity-recon-btn': 'lupa',
    '.u52-procity-dibujar-btn': 'lapiz',
    // La barra inferior del módulo: mismo trazo que la lupa y el lápiz.
    '.u52-procity-nav [data-u52-call="procity-loc-gps"] .procity-nav-ico': 'ubicar',
    '.u52-procity-nav [data-u52-call="procity-loc-manual"] .procity-nav-ico': 'tocar',
    '.u52-procity-nav [data-u52-call="layers"] .procity-nav-ico': 'capas',
    '.u52-procity-nav [data-u52-call="procity-stats-open"] .procity-nav-ico': 'estadistica',
    '.u52-procity-nav .plus.procity-plus': 'mas'
  };
  /* Las pantallas de perfil y de avatar son las de la app completa, con sus
     emojis (🎨 Elegir avatar, 🪪, 🏆, 📋, 🚪). En la app educativa se llega a
     ellas desde el botón de perfil, así que se visten con el mismo trazo:
     el emoji se cambia por su icono y el texto que lo acompañaba se queda. */
  var VESTIR_PERFIL = [
    '[data-u52-screen="profile"] .u65-avatar-open',
    '[data-u52-screen="profile"] .u52-profile-id-icon',
    '[data-u52-screen="profile"] .u52-empty-card > span:first-child',
    '[data-u52-screen="profile"] .u52-profile-logout > span:first-child',
    '[data-u52-screen="profile"] .u52-profile-copy-id > span:first-child',
    '[data-u52-screen="profile"] .u52-topbar [data-u52-back]',
    '[data-u52-screen="avatar"] .u52-topbar [data-u52-back]'
  ].join(',');
  function vestirPerfil() {
    var I = window.URBIS_ICONO;
    if (MODO !== 'educativo' || !I || !I.nombreDeEmoji) return;
    document.querySelectorAll(VESTIR_PERFIL).forEach(function (el) {
      if (el.getAttribute('data-u70-vestido')) return;
      var texto = (el.textContent || '').trim();
      var nombre = I.nombreDeEmoji(texto);
      if (!nombre) return;
      var resto = I.sinEmoji(texto);
      el.innerHTML = I(nombre, { tam: resto ? 18 : 22, grosor: 2 }) +
        (resto ? '<span>' + resto + '</span>' : '');
      el.setAttribute('data-u70-vestido', '1');
    });
  }

  /* La cabecera del mapa de Pro City (volver, filtro de la matriz, centrar
     en el GPS) solo se viste en la app educativa: en la ciudadana esa misma
     cabecera sirve al mapa de reportes, que conserva su propio estilo. */
  var VESTIDOS_EDU = {
    '.u52-mapcentric-round[data-u52-back]': 'atras',
    '.u52-procity-filter-btn': 'filtro',
    '.u52-mapcentric-filter[data-u52-call="locate"]': 'ubicar'
  };
  function vestirBotonesDelMapa() {
    vestirPerfil();
    if (!window.URBIS_ICONO) return;
    var lista = Object.assign({}, VESTIDOS, MODO === 'educativo' ? VESTIDOS_EDU : {});
    Object.keys(lista).forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el || el.getAttribute('data-u70-vestido')) return;
      var central = el.classList.contains('plus');
      el.innerHTML = window.URBIS_ICONO(lista[sel], { tam: central ? 28 : 24, grosor: central ? 2.25 : 2 });
      el.setAttribute('data-u70-vestido', '1');
    });
  }

  /* Y el módulo propio se abre solo. Se hace pulsando SU botón, no llamando a
     la función por dentro: así pasa por el mismo camino que usa una persona
     —permisos, mapa, estado— y no por un atajo que se desincronizaría con el
     día que ese camino cambie. */
  var clics = 0, ultimoClic = 0;
  function abrirLoSuyo() {
    if (!conf.abre) return true;
    var b = document.querySelector('[data-u52-call="' + conf.abre + '"]');
    if (!b) return false;
    /* No basta con pulsar: el arranque de la aplicación termina de acomodarse
       después, y puede volver al inicio encima de lo que acabamos de abrir.
       Así que se pulsa, se comprueba, y si el módulo no quedó abierto se
       vuelve a intentar en el siguiente cambio del DOM —con un tope, para no
       quedar dando clics contra un botón que no responde—. */
    var ahora = Date.now();
    if (ahora - ultimoClic < 400 || clics >= 8) return false;
    ultimoClic = ahora; clics++;
    b.click();
    return quedoAbierto();
  }

  function quedoAbierto() {
    if (MODO === 'educativo') return !!window.urbisProCityActivo;
    return true;
  }

  /* La aplicación se monta por partes y detrás del inicio de sesión, así que
     no hay un momento fijo en el que esto pueda correr: en un teléfono lo
     primero que se ve es la bienvenida, y el inicio puede tardar lo que la
     persona tarde en escribir su contraseña. Un temporizador con tope se
     rendía a los sesenta segundos y dejaba al estudiante en un inicio vacío;
     uno sin tope quedaría latiendo para siempre.

     Se observa el DOM: cuesta nada mientras no pasa nada, reacciona en el
     acto cuando el inicio aparece, y sigue podando si la aplicación vuelve a
     dibujar el inicio más adelante. */
  var yaAbrio = false, pendiente = false;

  function revisar() {
    pendiente = false;
    podarInicio();
    ponerSalida();
    // Idempotente: lo ya vestido se salta. Se repite porque el perfil se
    // repinta y otros módulos le añaden filas después (Configuración).
    vestirBotonesDelMapa();
    if (yaAbrio) return;
    // Si ya está abierto (lo abrió el clic anterior y esto es solo el DOM
    // acomodándose), no hay nada que hacer.
    if (conf.abre && quedoAbierto()) { yaAbrio = true; return; }
    /* «El inicio está a la vista» se pregunta con la clase que la propia
       aplicación pone, no midiendo el elemento: sus pantallas van en
       posición fija, y ahí `offsetParent` es null aunque se vea perfecto.
       Con esa medida el módulo no se abría nunca y el estudiante quedaba
       mirando un inicio con una sola tarjeta. */
    var hogar = document.querySelector('.u52-screen.active[data-u52-screen="home"]');
    if (hogar && abrirLoSuyo()) yaAbrio = true;
  }

  function alCambiar() {
    // Se agrupan las mutaciones en un solo repaso por cuadro: el DOM de esta
    // aplicación cambia en ráfagas de cientos de nodos.
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(revisar);
  }

  function arrancar() {
    revisar();
    try {
      new MutationObserver(alCambiar)
        .observe(document.body, { childList: true, subtree: true, attributes: true,
                                  attributeFilter: ['class', 'style', 'hidden'] });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }
})();
