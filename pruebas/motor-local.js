/* El motor de reglas, cargado dentro de node.

   Las reglas de reconocimiento vivían en js/60 y se sirvieron al navegador
   hasta la fase 04; desde entonces están en el repo privado y solo salen por
   HTTP. Las pruebas que las vigilan no necesitan un navegador para nada —lo
   único que usaban de él era el `<script>`— así que cargan el motor acá, que
   además las deja correr en un segundo en vez de en treinta.

   Es el MISMO paquete que sirve el servidor: motor.js compara las huellas de
   las fuentes y se niega a cargar si el empaquetado quedó viejo, así que una
   prueba en verde acá no puede estar mirando una versión anterior. */
module.exports = require(require('./entorno.js').MOTOR_REPO + '/motor').cargar();
