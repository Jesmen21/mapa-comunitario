/* URBIS · ICONOS (js/71)
   ─────────────────────────────────────────────────────────────────────────
   Un solo juego de iconos lineales para las superficies del módulo
   educativo: trazo 1.75, remates redondos, rejilla de 24. Hasta ahora cada
   sección se señalaba con un emoji, y los emojis cambian de forma, color y
   peso según el teléfono —el 🔍 de un Samsung no es el de un iPhone— así que
   nunca se veían como partes de un mismo producto.

   Los iconos de CATEGORÍA de uso (droguería, colegio, parque…) siguen
   siendo un emoji en el catálogo: son datos y se usan en toda la app,
   incluidos los popups del mapa y las exportaciones. Dentro del módulo
   educativo se les pone cara lineal con deEmoji() —el dato no cambia, solo
   cómo se pinta acá.

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
    cuenta:    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9.8" r="2.8"/><path d="M6.8 18.6c.6-2.4 2.7-3.6 5.2-3.6s4.6 1.2 5.2 3.6"/>',
    area:      '<path d="M5 8.5 9.5 5l6 2.5L19 5.5v10L14.5 19l-6-2.5L5 18.5z"/><circle cx="5" cy="8.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="5.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="14.5" cy="19" r="1.4" fill="currentColor" stroke="none"/>',
    radio:     '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M12 12h8"/>',
    mapa:      '<path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
    capas:     '<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5"/>',
    calor:     '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.6 4.2-8.3.5 1.7 1.3 2.7 2.3 3.3.4-1.9 1-3.3 2.3-4.8 2 3 4.2 6 4.2 9.8 0 3.6-2.6 6.2-6.5 6.2z"/><path d="M12 21c-1.7 0-2.8-1.2-2.8-2.8 0-1.5 1.2-2.4 2.8-4 1.6 1.6 2.8 2.5 2.8 4 0 1.6-1.1 2.8-2.8 2.8z"/>',
    poblacion: '<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.6"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M15.5 14.8c2.9.2 5.5 2.1 5.5 5.2"/>',
    crecer:    '<path d="M4 18 10 12l3.5 3.5L20 9"/><path d="M15 9h5v5"/>',
    edades:    '<path d="M5 20V10M10 20V6M15 20v-8M20 20V4"/>',
    hogar:     '<path d="m4 11 8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/>',
    // Una persona caminando: el bloque de cobertura mide minutos a pie, así
    // que el icono tenía que ser un peatón y no un carro.
    caminar: '<circle cx="12.5" cy="4.5" r="1.8"/><path d="M12 8l-3 4 2 2 1 6"/><path d="M13 14l3 3 1 3M12 8l3 1.5 2 2.5M9 12l-2.5 2"/>',
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
    norte:     '<path d="m12 3 4 9h-8z" fill="currentColor" stroke="none"/><path d="m12 21-4-9h8z"/>',
    /* ── Categorías de uso y objetos de la interfaz ─────────────────────
       Los emojis del catálogo siguen siendo el dato (popups, exportaciones,
       app ciudadana). Acá solo se les da una cara lineal cuando se pintan
       dentro del módulo educativo, vía deEmoji(). */
    pastilla:  '<g transform="rotate(-45 12 12)"><rect x="4.5" y="9" width="15" height="6" rx="3"/><path d="M12 9v6"/></g>',
    carrito:   '<path d="M3 4h2.5l2.2 10.5h10.3L20 7.5H6.3"/><circle cx="9.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/>',
    cubiertos: '<path d="M7 3v18"/><path d="M4.5 3v5a2.5 2.5 0 0 0 5 0V3"/><path d="M16.5 21v-7"/><path d="M16.5 14c-1.7 0-3-1.5-3-4.5S15 3 16.5 3s3 3.5 3 6.5-1.3 4.5-3 4.5z"/>',
    taza:      '<path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M4 21h14"/>',
    edificio:  '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M9 7.5h2M13 7.5h2M9 11h2M13 11h2M9 14.5h2M13 14.5h2M10.5 20.5v-3h3v3"/>',
    institucion:'<path d="m3.5 9 8.5-5 8.5 5z"/><path d="M5.5 9v8M10 9v8M14 9v8M18.5 9v8"/><path d="M3.5 20.5h17M4.5 17h15"/>',
    maletin:   '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5v-2a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2"/><path d="M3.5 12.5h17"/>',
    salud:     '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
    portatil:  '<rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M3 18.5h18"/>',
    pesa:      '<path d="M6 8v8M18 8v8M3.5 10v4M20.5 10v4M6 12h12"/>',
    industria: '<path d="M3.5 20.5V10l5 3v-3l5 3v-3l5 3v7.5z"/><path d="M15.5 10V4h3v9"/>',
    piezas:    '<path d="M9 4h4a1.5 1.5 0 0 1 1.5 1.5V8h2.5a1.5 1.5 0 0 1 1.5 1.5V13h-2a2 2 0 1 0 0 4h2v2.5A1.5 1.5 0 0 1 17 21H13v-2a2 2 0 1 0-4 0v2H4.5A1.5 1.5 0 0 1 3 19.5V15h2a2 2 0 1 0 0-4H3V8h6z"/>',
    herramienta:'<path d="m3.5 17.5 9-9a4.5 4.5 0 0 1 6-5.5l-2.6 2.6 2 2L20.5 5a4.5 4.5 0 0 1-5.5 6l-9 9z"/>',
    vaso:      '<path d="M6 4h12l-1.5 16h-9z"/><path d="M6.8 10h10.4"/>',
    cajero:    '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16"/><path d="M8 15h3"/>',
    cultura:   '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
    iglesia:   '<path d="M12 3v5M9.5 5.5h5"/><path d="M6 21V12l6-4 6 4v9z"/><path d="M10 21v-4h4v4"/>',
    balanza:   '<path d="M12 4v16M6 20h12"/><path d="M4 8h16"/><path d="m7 8-3 6a3 3 0 0 0 6 0zM17 8l-3 6a3 3 0 0 0 6 0z"/>',
    escudo:    '<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z"/>',
    parqueo:   '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M9.5 17V7h3.5a3 3 0 0 1 0 6H9.5"/>',
    camion:    '<path d="M3.5 6.5h11v10h-11z"/><path d="M14.5 10h3.5l2.5 3v3.5h-6"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    pregunta:  '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7v.5"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
    destello:  '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8"/>',
    nino:      '<circle cx="12" cy="8.5" r="3.2"/><path d="M6.5 20.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/>',
    mayor:     '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20.5c0-3.4 3-5.5 6.5-5.5s6.5 2.1 6.5 5.5"/><path d="M19 11v9.5M19 11a1.5 1.5 0 0 0-3 0"/>',
    borrar:    '<path d="M4 7h16M9 7V4.5h6V7"/><path d="m6 7 1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
    deshacer:  '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    dado:      '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none"/>',
    documento: '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4"/><path d="M9 12h6M9 16h6"/>',
    paquete:   '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    paleta:    '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.8 0-.8-.6-1.2-.6-2 0-.9.7-1.5 1.6-1.5h1.6a4 4 0 0 0 4-4c0-4.4-3.9-7.7-8.6-7.7z"/><circle cx="8" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="7.5" r="1.1" fill="currentColor" stroke="none"/>',
    red:       '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="9" cy="18" r="2"/><circle cx="17" cy="17" r="2"/><path d="m7.9 6.4 8.2 1.3M6.4 8l2.2 8M10.9 17.6l4.2-.4M17.7 10l-.5 5"/>',
    telarana:  '<circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6 6 18"/>',
    triangulos:'<path d="m4 19 6-14 5 8 5-4-5 10z"/><path d="m10 5 10 4M4 19l11-6"/>',
    ruta:      '<circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M6.5 17.5 10 12l5-1 2.5-4.5"/>',
    obra:      '<path d="M4 20.5h16"/><path d="M6 20.5V6l10-2.5v17"/><path d="M16 8h4v12.5"/><path d="M9 9h4M9 13h4M9 17h4"/>',
    mundo:     '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.8 2.8 2.8 14.2 0 17M12 3.5c-2.8 2.8-2.8 14.2 0 17"/>',
    regla:     '<path d="m3.5 16.5 13-13 4 4-13 13z"/><path d="m8 12 1.5 1.5M10.5 9.5 12 11M13 7l1.5 1.5"/>',
    nube:      '<path d="M7 18.5a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 18.5z"/>',
    ubicar:    '<circle cx="12" cy="12" r="5.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    filtro:    '<path d="M4 5h16l-6.5 7.5V19l-3 1.5V12.5z"/>',
    simbolos:  '<circle cx="7.5" cy="7.5" r="3.2"/><rect x="13.8" y="4.3" width="6.4" height="6.4" rx="1.4"/><path d="m8 13.6 4 6.4H4z"/><path d="M17 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>',
    ajustes:   '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    salir:     '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="m15 8 4 4-4 4M19 12H9"/>',
    tarjeta:   '<rect x="3" y="5.5" width="18" height="13" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16c.5-1.5 1.7-2.2 3-2.2s2.5.7 3 2.2M14 10h4M14 13.5h4"/>',
    trofeo:    '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v3M9 20h6M10 16h4v4h-4z"/>',
    tocar:     '<path d="M9.5 12V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12.5 10.5a1.5 1.5 0 0 1 3 0v1.5a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0V17a4.5 4.5 0 0 1-4.5 4.5h-3.2a4.5 4.5 0 0 1-3.6-1.8L5.8 15.6a1.5 1.5 0 0 1 2.4-1.8l1.3 1.7"/>'
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

  /* Puente emoji → icono. El catálogo de usos y algunos objetos de la app
     traen su emoji como dato; acá se les pone la cara del sistema. Se busca
     la clave más larga que EMPIECE el texto (así «🔍🛍️» gana sobre «🔍»).
     Lo que no está en la tabla sale como pin genérico: mejor un pin sobrio
     que un emoji que rompe la fila. */
  var DE_EMOJI = {
    '💊':'pastilla', '🛒':'carrito', '🍽️':'cubiertos', '🍽':'cubiertos', '☕':'taza', '🫖':'taza', '🥤':'taza',
    '🏢':'edificio', '🏨':'edificio', '🏬':'comercio', '🛍️':'comercio', '🛍':'comercio', '🔍🛍️':'comercio',
    '🏛️':'institucion', '🏛':'institucion', '💼':'maletin', '🧳':'maletin', '🔍💼':'maletin',
    '🩺':'salud', '🚑':'salud', '🧑‍💻':'portatil', '🏋️':'pesa', '🏋':'pesa', '🏭':'industria',
    '🧩':'piezas', '🔧':'herramienta', '🍻':'vaso', '🏧':'cajero', '🎭':'cultura', '🎓':'escuela',
    '🏫':'escuela', '⛪':'iglesia', '⚖️':'balanza', '⚖':'balanza', '🚓':'escudo', '🅿️':'parqueo', '🅿':'parqueo',
    '🚛':'camion', '❓':'pregunta', '✨':'destello', '⚠️':'alerta', '⚠':'alerta',
    '🏠':'hogar', '🌳':'verde', '🌿':'verde', '💧':'agua', '🚌':'bus', '🧒':'nino', '👶':'nino',
    '🧑':'perfil', '🧑‍🦱':'perfil', '👤':'perfil', '👩':'perfil', '👨':'perfil', '🧓':'mayor',
    '👥':'poblacion', '📁':'carpeta', '🌐':'mundo', '🔥':'calor', '🔍':'lupa', '✏️':'lapiz', '✏':'lapiz',
    '💾':'guardar', '📊':'estadistica', '🗑️':'borrar', '🗑':'borrar', '🛰️':'satelite', '🛰':'satelite',
    '👁️':'ojo', '👁':'ojo', '🎲':'dado', '↩️':'deshacer', '↩':'deshacer', '🔗':'enlace', '🔑':'llave',
    '📋':'lista', '🖨️':'imprimir', '🖨':'imprimir', '📤':'compartir', '📄':'documento', '📦':'paquete',
    '🎨':'paleta', '🗺️':'mapa', '🗺':'mapa', '🏗️':'obra', '🏗':'obra', '🟫':'capas', '🕸️':'red', '🕸':'red',
    '🪢':'telarana', '📐':'triangulos', '🫧':'area', '⭕':'anillos', '☁️':'nube', '☁':'nube',
    '🏆':'trofeo', '🪪':'tarjeta', '🚪':'salir', '⧉':'copiar', '←':'atras', '🎮':'dado', '🏙️':'edificio', '🏙':'edificio', '⚙️':'ajustes', '⚙':'ajustes', '😀':'simbolos', '🎨':'paleta', '🟢':'carpeta'
  };
  var CLAVES = Object.keys(DE_EMOJI).sort(function (a, b) { return b.length - a.length; });

  function claveDe(texto) {
    texto = String(texto == null ? '' : texto).trim();
    for (var i = 0; i < CLAVES.length; i++) {
      if (texto.indexOf(CLAVES[i]) === 0) return CLAVES[i];
    }
    return '';
  }
  // Nombre del icono que corresponde a un emoji (o texto que empieza por uno).
  icono.nombreDeEmoji = function (texto) {
    var k = claveDe(texto);
    return k ? DE_EMOJI[k] : '';
  };
  // SVG del icono que reemplaza al emoji; si no se conoce, un pin.
  icono.deEmoji = function (texto, o) {
    return icono(icono.nombreDeEmoji(texto) || 'campo', o);
  };
  // El texto sin su emoji inicial («🏠 Vivienda» → «Vivienda»).
  icono.sinEmoji = function (texto) {
    texto = String(texto == null ? '' : texto);
    var k = claveDe(texto);
    var t = k ? texto.trim().slice(k.length) : texto;
    // Emojis que no están en la tabla: cualquier pictograma inicial se cae igual.
    try { t = t.replace(/^[\s\uFE0F]*\p{Extended_Pictographic}[\p{Emoji_Modifier}\uFE0F\u200D\p{Extended_Pictographic}]*/u, ''); } catch (e) {}
    return t.replace(/^[\s\uFE0F]+/, '');
  };

  icono.nombres = function () { return Object.keys(T); };
  window.URBIS_ICONO = icono;

  /* ── El tema de las gráficas ──────────────────────────────────────────
     Chart.js no hereda el CSS: cada gráfica traía su gris y su tamaño de
     letra, y las tres del módulo educativo se veían de tres manos. Acá va
     una sola: la tinta y la línea de los tokens, Inter, leyenda con puntos
     redondos y sin cuadrados, esquinas suaves en las barras. */
  var TEMA = {
    tinta: '#0F1F2E', tinta2: '#3B4A5A', tinta3: '#5A6878', linea: '#E3EAF0',
    acento: '#0A6F9E', fuente: "'Inter','Segoe UI',system-ui,-apple-system,sans-serif",
    fuenteDe: function (tam, peso) { return { family: TEMA.fuente, size: tam || 11, weight: peso || '500' }; },
    leyenda: function (posicion) {
      return { position: posicion || 'bottom', align: 'start',
        labels: { color: TEMA.tinta2, font: TEMA.fuenteDe(11), boxWidth: 8, boxHeight: 8,
                  usePointStyle: true, pointStyle: 'circle', padding: 10 } };
    },
    tooltip: function () {
      return { backgroundColor: TEMA.tinta, titleColor: '#fff', bodyColor: '#E6F7FE',
        titleFont: TEMA.fuenteDe(12, '700'), bodyFont: TEMA.fuenteDe(12), padding: 10,
        cornerRadius: 10, displayColors: true, boxWidth: 8, boxHeight: 8, usePointStyle: true };
    },
    // Ejes de una gráfica de barras horizontal: la rejilla solo en el eje del dato.
    ejesBarras: function () {
      return {
        x: { ticks: { color: TEMA.tinta3, font: TEMA.fuenteDe(10), precision: 0 },
             grid: { color: TEMA.linea, drawTicks: false }, border: { display: false } },
        y: { ticks: { color: TEMA.tinta, font: TEMA.fuenteDe(11, '600') },
             grid: { display: false }, border: { display: false } }
      };
    }
  };
  window.URBIS_TEMA_GRAFICA = TEMA;
})();
