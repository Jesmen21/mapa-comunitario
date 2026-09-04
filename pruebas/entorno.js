/* URBIS · Dónde está cada cosa, para las pruebas de navegador
   ────────────────────────────────────────────────────────────────────────
   Las suites de pruebas vivían en el directorio temporal de la sesión que
   las escribió. Funcionaban, pero se iban con la sesión: cada vez que
   alguien retomaba el proyecto se encontraba con un `pruebas/` que solo
   tenía el revisor estático, y las cuarenta y tantas comprobaciones de
   comportamiento había que reescribirlas o darlas por perdidas.

   Ahora están en el repositorio. Lo único que no puede estar acá es lo que
   no es del proyecto: el navegador, los paquetes de terceros y las
   direcciones de los dos servidores locales. Todo eso se resuelve por
   variable de entorno, con los valores de una máquina de desarrollo como
   omisión, para que correrlas siga siendo `node pruebas/correr.js` y ya. */
'use strict';

const path = require('path');
const RAIZ = path.resolve(__dirname, '..');

/* El directorio de trabajo: de ahí salen los paquetes (playwright, leaflet,
   chart.js) y ahí van las capturas y los HTML que algunas pruebas dejan para
   poder mirarlos después. No se versiona: son artefactos, no fuentes. */
const TRABAJO = process.env.URBIS_PRUEBAS_TRABAJO ||
  path.join(RAIZ, '..', 'urbis-pruebas');

module.exports = {
  RAIZ: RAIZ,
  TRABAJO: TRABAJO.replace(/\/*$/, '/'),
  MODULOS: process.env.URBIS_PRUEBAS_MODULOS || path.join(TRABAJO, 'node_modules'),
  CHROMIUM: process.env.URBIS_CHROMIUM ||
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  // El servidor estático que sirve el repositorio. El motor solo acepta
  // peticiones de orígenes conocidos y este es uno de ellos: cambiarlo de
  // puerto sin avisarle al motor deja los análisis sin respuesta.
  ESTATICO: process.env.URBIS_ESTATICO || 'http://localhost:8199',
  MOTOR: process.env.URBIS_MOTOR || 'http://localhost:8787',
  // El repositorio privado del motor, para las pruebas que cargan sus reglas
  // sin pasar por la red.
  MOTOR_REPO: process.env.URBIS_MOTOR_REPO || path.join(RAIZ, '..', 'urbis-motor')
};
