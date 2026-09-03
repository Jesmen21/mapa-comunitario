/* URBIS · ICONOS (js/71)
   ─────────────────────────────────────────────────────────────────────────
   Un solo juego de iconos lineales para las superficies del módulo
   educativo: trazo 1.75, remates redondos, rejilla de 24. Hasta ahora cada
   sección se señalaba con un emoji, y los emojis cambian de forma, color y
   peso según el teléfono —el 🔍 de un Samsung no es el de un iPhone— así que
   nunca se veían como partes de un mismo producto.

   Los iconos de CATEGORÍA de uso (droguería, colegio, parque…) NO están
   acá a propósito: vienen del catálogo, son datos y se usan en toda la app,
   incluidos los popups del mapa y las exportaciones. Cambiarlos es otra
   decisión, más grande que esta.

   Uso:  URBIS_ICONO('lupa')            → <svg …>
         URBIS_ICONO('lupa', {tam:18})  → 18 px
   Van inline (no como <img>) para heredar el color del texto: un icono que
   no hereda `currentColor` obliga a mantener una versión por cada fondo. */
(function () {
  'use strict';

  // Solo trazos. Sin rellenos salvo los puntos, que llevan `fill`.
  var T = {
    lupa:      '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    lapiz:     '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m13.5 6.5 3 3"/>',
    perfil:    '<circle cx="12" cy="8" r="4"/><path d="M4 20.5c0-3.6 3.6-6 8-6s8 2.4 8 6"/>',
    area:      '<path d="M5 8.5 9.5 5l6 2.5L19 5.5v10L14.5 19l-6-2.5L5 18.5z"/><circle cx="5" cy="8.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="5.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="14.5" cy="19" r="1.4" fill="currentColor" stroke="none"/>',
    radio:     '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M12 12h8"/>',
    mapa:      '<path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
    capas:     '<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5"/>',
    calor:     '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.6 4.2-8.3.5 1.7 1.3 2.7 2.3 3.3.4-1.9 1-3.3 2.3-4.8 2 3 4.2 6 4.2 9.8 0 3.6-2.6 6.2-6.5 6.2z"/><path d="M12 21c-1.7 0-2.8-1.2-2.8-2.8 0-1.5 1.2-2.4 2.8-4 1.6 1.6 2.8 2.5 2.8 4 0 1.6-1.1 2.8-2.8 2.8z"/>',
    poblacion: '<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.6"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M15.5 14.8c2.9.2 5.5 2.1 5.5 5.2"/>',
    crecer:    '<path d="M4 18 10 12l3.5 3.5L20 9"/><path d="M15 9h5v5"/>',
    edades:    '<path d="M5 20V10M10 20V6M15 20v-8M20 20V4"/>',
    hogar:     '<path d="m4 11 8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/>',
    movilidad: '<path d="M4 15h16l-1.5-5.5A2 2 0 0 0 16.6 8H7.4a2 2 0 0 0-1.9 1.5z"/><path d="M4 15v3h2M20 15v3h-2"/><circle cx="8" cy="18" r="1.8"/><circle cx="16" cy="18" r="1.8"/>',
    via:       '<path d="M7 20 10 4M17 20 14 4"/><path d="M12 6v2M12 11v2M12 16v2"/>',
    bus:       '<rect x="5" y="4" width="14" height="14" rx="2.5"/><path d="M5 11h14M8 21v-3M16 21v-3"/><circle cx="9" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1" fill="currentColor" stroke="none"/>',
    verde:     '<path d="M12 21v-7"/><path d="M12 14c-4.5 0-7.5-3-7.5-7.5C9 6.5 12 9.5 12 14z"/><path d="M12 14c4.5 0 7.5-3 7.5-7.5C15 6.5 12 9.5 12 14z"/>',
    agua:      '<path d="M12 3.5c3.5 4.5 6 7.6 6 10.8a6 6 0 0 1-12 0c0-3.2 2.5-6.3 6-10.8z"/>',
    satelite:  '<path d="m13.5 4.5 6 6-3 3-6-6z"/><path d="m4.5 13.5 6 6 3-3-6-6z"/><path d="m10.5 10.5 3 3"/><path d="M14 20a6 6 0 0 0 6-6"/><path d="M17 20a3 3 0 0 0 3-3"/>',
    comercio:  '<path d="M4 9h16l-1 3.5a2.5 2.5 0 0 1-4.6.6 2.5 2.5 0 0 1-4.8 0 2.5 2.5 0 0 1-4.6-.6z"/><path d="M5 13v7h14v-7"/><path d="M10 20v-4h4v4"/><path d="M6 9 7.5 4.5h9L18 9"/>',
    brujula:   '<circle cx="12" cy="12" r="8.5"/><path d="m15.2 8.8-2 5.4-4.4 1 2-5.4z"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    campo:     '<path d="M12 21s-6-5.3-6-10.5a6 6 0 0 1 12 0C18 15.7 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
    plan:      '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/>',
    lista:     '<path d="M9 7h11M9 12h11M9 17h11"/><path d="m4 7 1 1 1.5-2M4 12l1 1 1.5-2M4 17l1 1 1.5-2"/>',
    comparar:  '<path d="M12 4v16"/><path d="M5 8h5M5 12h5M5 16h5"/><path d="M14 8h5M14 12h5M14 16h5"/>',
    anillos:   '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="9.5"/>',
    estadistica:'<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>',
    porcentaje:'<path d="m6 18 12-12"/><circle cx="7.5" cy="7.5" r="2.2"/><circle cx="16.5" cy="16.5" r="2.2"/>',
    guardar:   '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><path d="M8 20v-6h8v6"/>',
    copiar:    '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/>',
    imprimir:  '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7z"/>',
    exportar:  '<path d="M12 15V4"/><path d="m8 8 4-4 4 4"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
    compartir: '<circle cx="18" cy="6" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
    enlace:    '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    llave:     '<circle cx="8" cy="14" r="4"/><path d="m11 11 8.5-8.5"/><path d="m16 6 2.5 2.5M18.5 3.5 21 6"/>',
    cerrar:    '<path d="m6 6 12 12M18 6 6 18"/>',
    atras:     '<path d="m14 6-6 6 6 6"/>',
    chevron:   '<path d="m9 6 6 6-6 6"/>',
    abajo:     '<path d="m6 9 6 6 6-6"/>',
    mas:       '<path d="M12 5v14M5 12h14"/>',
    info:      '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/>',
    alerta:    '<path d="M12 4 3 20h18z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
    ok:        '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    ojo:       '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    apagar:    '<path d="M12 3v9"/><path d="M6.6 6.6a8 8 0 1 0 10.8 0"/>',
    carpeta:   '<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5H10l2 2h6.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    escuela:   '<path d="m3 9 9-5 9 5-9 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/><path d="M21 9v5"/>',
    reloj:     '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    norte:     '<path d="m12 3 4 9h-8z" fill="currentColor" stroke="none"/><path d="m12 21-4-9h8z"/>'
  };

  function icono(nombre, o) {
    o = o || {};
    var cuerpo = T[nombre];
    if (!cuerpo) return '';
    var tam = o.tam || 20;
    var grosor = o.grosor || 1.75;
    var clase = 'u-ico' + (o.clase ? ' ' + o.clase : '');
    // aria-hidden: son decorativos; el texto de al lado es el que se lee. Si
    // un botón lleva SOLO el icono, quien lo pinta pone el aria-label.
    return '<svg class="' + clase + '" width="' + tam + '" height="' + tam + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="' + grosor + '" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true" focusable="false">' + cuerpo + '</svg>';
  }

  icono.nombres = function () { return Object.keys(T); };
  window.URBIS_ICONO = icono;
})();
