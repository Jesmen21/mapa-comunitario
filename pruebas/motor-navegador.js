/* El motor empaquetado, servido a una página de prueba.

   El paquete del repo privado está hecho para node —declara su propio
   `window` interno y exporta con `module.exports`—, así que no se puede pegar
   como <script> tal cual: en un navegador, `const window` choca con el global
   y revienta antes de la primera línea. Se envuelve en una función, donde ese
   `const` es una variable local más, y al final se cuelga el resultado del
   window de verdad, que es lo que esperan js/63 y las páginas de prueba.

   Se envuelve el MISMO archivo que sirve el servidor: si el empaquetado
   quedara viejo, motor.js lo diría al arrancar el servidor y estas pruebas
   estarían mirando lo mismo que produce la API. */
const fs = require('fs');
const RUTA = require('./entorno.js').MOTOR_REPO + '/motor-empaquetado.js';

module.exports = function guionDelMotor() {
  const fuente = fs.readFileSync(RUTA, 'utf8');
  /* El window real entra como parámetro: dentro de la envoltura, el `const
     window` del paquete tapa al global, así que al final no habría a quién
     colgarle el motor. */
  return '(function(ventana){ var module = { exports: {} };\n' + fuente +
         '\n; ventana.AIA_MOTOR = module.exports.AIA_MOTOR;' +
         '\n  ventana.AIA_CATALOGO = module.exports.AIA_CATALOGO; })(window);';
};
