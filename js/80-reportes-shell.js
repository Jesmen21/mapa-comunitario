/* URBIS REPORTES · CARCASA LIGERA (js/80)
   ─────────────────────────────────────────────────────────────────────────
   La app de solo reportes y eventos. Existe porque URBIS completo carga 48
   scripts y 2,1 MB de JavaScript, y para quien solo quiere avisar de un hueco
   eso es una pared: tarda en abrir en un teléfono modesto y ofrece veinte
   caminos cuando hacía falta uno.

   NO es una app aparte con su propio código. Reutiliza exactamente los mismos
   archivos que la app grande —el mismo formulario, el mismo catálogo de
   reportes, el mismo guardado— y escribe en la MISMA base de datos. Lo único
   que cambia es cuánto se carga y cuánto se muestra. Duplicar el formulario
   habría garantizado que un día los dos digan cosas distintas.

   Aquí solo va el pegamento: abrir el formulario, cerrarlo y navegar. */
(function(){
  'use strict';

  const $ = id => document.getElementById(id);

  function aviso(txt, ms){
    const a = $('rp-aviso');
    if (!a) return;
    a.textContent = txt;
    a.classList.add('ver');
    clearTimeout(aviso._t);
    aviso._t = setTimeout(() => a.classList.remove('ver'), ms || 4000);
  }

  // ── Reportar ────────────────────────────────────────────────────────────
  // En la app completa se toca el mapa y luego se elige. Aquí se invierte: el
  // botón manda, y lo primero que se pide es tocar DÓNDE. Es el orden en que
  // lo cuenta la gente ("hay un hueco en la esquina de mi casa"), y evita que
  // alguien llene un formulario entero para descubrir al final que faltaba
  // poner el punto.
  let esperandoPunto = false;

  function pedirUbicacion(){
    const map = window.urbisMap || window.map;
    if (!map || typeof map.on !== 'function') {
      aviso('El mapa todavía está cargando. Espera un momento.');
      return;
    }
    esperandoPunto = true;
    aviso('Toca en el mapa el lugar exacto del reporte.', 12000);
    const btn = $('rp-reportar');
    if (btn) btn.textContent = '👆 Toca el lugar en el mapa';
  }

  function restablecerBoton(){
    esperandoPunto = false;
    const btn = $('rp-reportar');
    if (btn) btn.textContent = '📍 Reportar algo';
  }

  function abrirFormulario(lat, lng){
    // formPaso2 es el formulario de la app completa, tal cual. La categoría
    // por defecto es la de alertas urbanas: es el reporte más común y, si no
    // encaja, se cambia en el propio formulario.
    if (typeof window.formPaso2 !== 'function') {
      aviso('No se pudo abrir el formulario. Recarga la aplicación.');
      return;
    }
    try {
      window.formPaso2('🚨 Alertas y Riesgos Urbanos', lat, lng, '');
      const sb = $('sidebar');
      if (sb) { sb.classList.add('abierto'); sb.scrollTop = 0; }
    } catch(e) {
      aviso('No se pudo abrir el formulario: ' + (e && e.message || e));
    }
  }

  function cerrarFormulario(){
    const sb = $('sidebar');
    if (sb) sb.classList.remove('abierto');
    restablecerBoton();
  }

  // Cuando la app completa guarda o cancela, cierra su propia hoja. Aquí se
  // escucha lo mismo para que la carcasa no quede con el formulario abierto
  // encima del mapa después de publicar.
  const cancelarOriginal = window.cancelarRegistro;
  window.cancelarRegistro = function(){
    try { if (typeof cancelarOriginal === 'function') cancelarOriginal.apply(this, arguments); }
    catch(e){}
    cerrarFormulario();
  };

  function init(){
    const btn = $('rp-reportar');
    if (btn) btn.addEventListener('click', function(){
      if (esperandoPunto) { restablecerBoton(); aviso('Reporte cancelado.'); return; }
      pedirUbicacion();
    });

    const cerrar = $('rp-cerrar');
    if (cerrar) cerrar.addEventListener('click', cerrarFormulario);

    const map = window.urbisMap || window.map;
    if (map && typeof map.on === 'function') {
      map.on('click', function(e){
        if (!esperandoPunto || !e || !e.latlng) return;
        restablecerBoton();
        abrirFormulario(e.latlng.lat, e.latlng.lng);
      });
    }

    // Navegación. Eventos y "Al día" viven en páginas propias que ya existen;
    // no se reimplementan aquí.
    document.querySelectorAll('#rp-nav button').forEach(function(b){
      b.addEventListener('click', function(){
        const destino = b.getAttribute('data-rp');
        if (destino === 'aldia') { location.href = 'seguimiento.html'; return; }
        if (destino === 'eventos') { aviso('Los eventos llegan en la próxima versión.'); return; }
        document.querySelectorAll('#rp-nav button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
      });
    });

    // Service worker propio: esta app tiene su alcance y su caché, para que
    // instalarla no arrastre los 2,1 MB de la app completa.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw-reportes.js').catch(function(){});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.URBIS_REPORTES = { abrirFormulario, cerrarFormulario, pedirUbicacion,
                            esperando: () => esperandoPunto };
})();
