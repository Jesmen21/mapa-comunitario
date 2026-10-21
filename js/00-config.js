// URBIS app configuration.
// Seguridad: no dejes claves reales, claves admin, correos privados ni endpoints sensibles en este archivo público.
// Para producción, usa backend/Firebase/Supabase/Apps Script con validaciones del lado servidor.
window.URBIS_CONFIG = {
  DEMO_ACCESS_CODE: null,
  // ⛔ SheetDB RETIRADO (2026-06-25): URBIS ya NO usa SheetDB. Todo el backend de datos
  // (reportes, eventos, comentarios, relaciones, GPS, avatares, puntajes) vive en Google
  // Apps Script sobre el mismo Google Sheet. La clave SHEETDB_ENDPOINT y los dos parches
  // de window.fetch que la acompañaban salieron en la v601: interceptaban un servicio
  // que ya nadie llama, y su caché nunca se escribía.
  // ⛔ AQUÍ YA NO VA NINGUNA CONTRASEÑA.
  // Este archivo se sirve tal cual desde urbispro.city: cualquiera puede abrir
  // urbispro.city/js/00-config.js en su navegador y leerlo entero. No es un
  // fallo, es cómo funciona la web — el navegador tiene que descargar el
  // JavaScript para poder ejecutarlo. Hasta la v573 aquí estuvo escrita la
  // contraseña del administrador, es decir, publicada en internet.
  //
  // El administrador entra ahora por el MISMO login que todos: su cuenta vive
  // en la hoja de usuarios con la contraseña cifrada, y es el servidor quien la
  // verifica. Se crea con la función crearCuentasSistemaUrbis del Apps Script
  // (ver docs/apps-script-urbis-auth.gs). El nombre de usuario sí puede estar
  // aquí: un usuario no es un secreto.
  ADMIN_USER: 'urbisadmin',

  // Servidor de análisis de URBIS para Empresas (fases 02-04).
  // API es un interruptor: apunta a donde corra el servidor hoy. Si se muda,
  // se cambia el CNAME del dominio y esto no se toca.
  // REMOTO en false vuelve todo al navegador, útil para depurar sin red.
  // La LICENCIA no va acá: este archivo es público y una licencia escrita en
  // él la tendría cualquiera. Cada cliente pega la suya en su navegador
  // (localStorage 'urbis_licencia_analisis').
  ANALISIS: {
    API: 'https://api.urbispro.city',
    REMOTO: true,
    ESPERA_MS: 70000
  },
  DEFAULT_CENTER: [7.8891, -72.4967],
  DEFAULT_ZOOM: 15,
  TEMP_REPORT_TTL_HOURS: 8,

  // LocationIQ Autocomplete para la búsqueda de destinos en Movilidad.
  // 1) Crea una key gratis en LocationIQ.
  // 2) Reemplaza el texto de apiKey por tu token real.
  // 3) Mientras esté vacío o con el placeholder, la barra mostrará un aviso.
  // ⚠️ Esta clave es visible en urbispro.city/js/00-config.js, como todo lo que
  // vive en un archivo del navegador. No hay forma de esconderla aquí. Lo que
  // sí se puede —y hay que hacer— es limitarla en el panel de LocationIQ para
  // que solo funcione desde urbispro.city: así, aunque alguien la copie, no
  // podrá gastar la cuota de URBIS desde otro sitio.
  LOCATIONIQ: {
    apiKey: 'pk.4606fcd69a7cfe0142b8e664962123eb',
    countrycodes: 'co',
    limit: 8,
    debounceMs: 320,
    minChars: 2,
    localRadiusKm: 15,
    fallbackRadiusKm: 80,
    bounded: 0
  },

  // Registro propio URBIS con verificación por correo usando Google Apps Script.
  // 1) Copia el código de docs/apps-script-urbis-auth.gs en tu Google Sheets.
  // 2) Despliega como Web App.
  // 3) Pega la URL aquí.
  AUTH: {
    APPS_SCRIPT_ENDPOINT: 'https://script.google.com/macros/s/AKfycbw-P002YjsFDWoNguJG10Y5MJVwEenSRaSdqJKe1c31wJ1n2e1_bxMfHTF0XziQbOdioA/exec',
    // Referencia informativa. QUIEN DECIDE es el servidor: el .gs compara el
    // correo de la sesión contra su propio URBIS_AUTH.ADMIN_EMAIL, y este
    // valor no otorga nada. Estuvo desalineado con el del servidor, lo que no
    // rompía nada pero confundía al leer el código. El correo que lo estaba
    // no se escribe acá: este archivo se sirve en urbispro.city/js/00-config.js
    // y era un correo personal publicado (v1136).
    ADMIN_EMAIL: 'urbisprocity@gmail.com',
    SESSION_KEY: 'urbis_auth_session_v1',
    CODE_LENGTH: 6,
    CODE_TTL_MINUTES: 15
  },
  // V69: proveedor de tráfico real. Cambia provider a 'google', 'mapbox', 'here' u 'openrouteservice' y guarda la llave en backend/proxy seguro.
  TRAFFIC: {
    provider: 'estimated',
    useOnlyActiveRoute: true,
    showGlobalTrafficLayer: false,
    apiBaseUrl: '',
    apiKey: ''
  }
};

/* ══ LAS FECHAS DE CALENDARIO SE ANCLAN A COLOMBIA (v1135) ═══════════════════
   `toISOString().slice(0, 10)` devuelve la fecha en UTC, y URBIS se lee en
   Colombia (UTC−5, sin horario de verano desde 1993). Entre las 19:00 y la
   medianoche de acá, eso daba MAÑANA: cinco horas al día en que una fecha
   publicada iba un día adelantada para su único público.

   Son DOS funciones y no una porque son dos problemas distintos:

   · `hoyCO()` contesta «¿qué día es hoy en Colombia?». Va donde antes había
     un `new Date()` suelto.
   · `isoLocal(d)` contesta «¿cómo se escribe ESTA fecha que ya tengo?», y
     compone la cadena con getFullYear/getMonth/getDate, sin pasar por ningún
     huso. Va donde ya existía un objeto Date — y ahí el defecto era otro:
     `new Date('2026-10-21T00:00:00')` se parsea en hora LOCAL, así que
     serializarlo en UTC corría un día hacia atrás para un lector al este de
     Greenwich, aunque en Colombia no se notara.

   Lo que esto NO hace: no reescribe ninguna fecha ya guardada. Una fecha
   escrita es lo que esa corrida registró, y cambiarla hacia atrás es
   reescribir el pasado (v903, v1115). Vale de acá en adelante.

   Y lo que NO se ancla, con su razón: una fecha que viaja a una API que
   trabaja en UTC no es una fecha de calendario para un lector. Esa exención
   va por ÍTEM, con su archivo y su línea, en la guarda de `revisar.js`. */
window.URBIS_FECHA = {
  ZONA: 'America/Bogota',
  hoyCO: function () {
    try {
      /* `en-CA` formatea exactamente AAAA-MM-DD, que es lo que se quiere. */
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
    } catch (e) {
      /* Colombia no tiene horario de verano, así que restar cinco horas da la
         misma respuesta. El respaldo existe para un navegador viejo sin
         `timeZone` en Intl, no para corregir al de arriba. */
      return window.URBIS_FECHA.isoLocal(new Date(Date.now() - 5 * 3600000), true);
    }
  },
  isoLocal: function (d, enUTC) {
    var f = (d instanceof Date) ? d : new Date(d);
    if (isNaN(f.getTime())) return '';
    var a = enUTC ? f.getUTCFullYear() : f.getFullYear();
    var m = (enUTC ? f.getUTCMonth() : f.getMonth()) + 1;
    var x = enUTC ? f.getUTCDate() : f.getDate();
    return a + '-' + ('0' + m).slice(-2) + '-' + ('0' + x).slice(-2);
  }
};
