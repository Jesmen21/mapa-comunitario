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
