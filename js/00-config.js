// URBIS app configuration.
// Seguridad: no dejes claves reales, claves admin, correos privados ni endpoints sensibles en este archivo público.
// Para producción, usa backend/Firebase/Supabase/Apps Script con validaciones del lado servidor.
window.URBIS_CONFIG = {
  DEMO_ACCESS_CODE: null,
  // ⛔ SheetDB RETIRADO (2026-06-25): URBIS ya NO usa SheetDB. Todo el backend de datos
  // (reportes, eventos, comentarios, relaciones, GPS, avatares, puntajes) vive en Google
  // Apps Script sobre el mismo Google Sheet. Se conserva esta clave solo por compatibilidad
  // con referencias inertes; ningún flujo activo la llama.
  SHEETDB_ENDPOINT: 'https://sheetdb.io/api/v1/vypsmcicsw2q6',
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
    ADMIN_EMAIL: 'barrazapolo2@gmail.com',
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
