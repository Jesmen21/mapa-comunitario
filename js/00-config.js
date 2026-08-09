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
  // Cuenta exclusiva de administrador (dueño URBIS). Con estas credenciales se activa el
  // "Modo administrador" (control total + crear el Evento Áurea premium + dar permisos).
  // ADMIN NUEVO (v281): se reemplazó el viejo 'urbisdueno' por estas credenciales simples.
  // El login admin tolera mayúsculas/minúsculas en usuario y contraseña (ver urbisEsCredsAdmin).
  ADMIN: { USER: 'urbisadmin', PASS: 'urbis2026' },
  DEFAULT_CENTER: [7.8891, -72.4967],
  DEFAULT_ZOOM: 15,
  TEMP_REPORT_TTL_HOURS: 8,

  // LocationIQ Autocomplete para la búsqueda de destinos en Movilidad.
  // 1) Crea una key gratis en LocationIQ.
  // 2) Reemplaza el texto de apiKey por tu token real.
  // 3) Mientras esté vacío o con el placeholder, la barra mostrará un aviso.
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
