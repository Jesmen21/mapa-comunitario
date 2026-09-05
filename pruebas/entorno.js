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

/* Esperar a que la aplicación esté ARMADA, en vez de a que pase un rato.

   Las suites arrancaban con un `waitForTimeout(3400)` y con eso alcanzaba
   casi siempre. «Casi siempre» es el problema: corriendo cuatro navegadores
   en paralelo, de vez en cuando Leaflet todavía no había puesto el mapa y la
   suite caía con «map.on is not a function» —un rojo que no era una
   regresión—. Una prueba que falla al azar enseña a ignorar los rojos, que
   es lo peor que le puede pasar a un banco de pruebas.

   Se espera a la condición: el mapa existe y responde. Y se le pone tope,
   porque una espera sin límite convierte un fallo en un cuelgue. */
async function esperarLaApp(pg, msTope) {
  await pg.waitForFunction(function () {
    /* La pantalla de bienvenida tapa TODO durante tres segundos y medio, y
       después se quita sola. Una suite que empiece antes toca el splash y no
       la aplicación: los clics no llegan, y lo que se ve es una prueba que
       falla por algo que no tiene nada que ver. Casi me manda a arreglar un
       botón de deshacer que estaba bien. */
    var sp = document.getElementById('urbis-beta-splash');
    if (sp && getComputedStyle(sp).pointerEvents !== 'none') return false;
    return !!(window.map && typeof window.map.on === 'function' &&
              window.URBIS_PC_RECON && window.URBIS_CONFIG);
  }, null, { timeout: msTope || 20000 });
  // Un respiro corto para los módulos que se enganchan al mapa recién creado.
  await pg.waitForTimeout(400);
}

module.exports = {
  esperarLaApp: esperarLaApp,
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
