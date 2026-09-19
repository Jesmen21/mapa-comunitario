/* URBIS · Corre las pruebas de comportamiento
   ────────────────────────────────────────────────────────────────────────
   `node pruebas/revisar.js` mira el código sin ejecutarlo —versiones, llaves
   sin cerrar, que el clasificador no se sirva—. Esto es lo otro: abre la
   aplicación en un navegador de verdad, la usa como la usaría una persona y
   comprueba lo que sale en pantalla.

   Antes de correr hacen falta dos servidores:

       python3 -m http.server 8199                (en la raíz del repo)
       node servidor.js                           (en el repo del motor)

   El puerto 8199 no es negociable sin tocar el motor: es uno de los orígenes
   que acepta, y desde cualquier otro el navegador se queda sin respuesta.

   Uso:
       node pruebas/correr.js                  todas
       node pruebas/correr.js tlote tcurvas    solo esas
       node pruebas/correr.js --lista          qué hay

   Cada suite se explica sola en su cabecera; acá solo se las reparte de a
   cuatro, porque de a una tardan veinte minutos y de a ocho el navegador
   empieza a competir consigo mismo por la memoria. */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const E = require('./entorno.js');

const DIR = path.join(__dirname, 'suites');
const EN_PARALELO = Number(process.env.URBIS_PRUEBAS_PARALELO || 4);
const TOPE_MS = Number(process.env.URBIS_PRUEBAS_TOPE_MS || 500000);

/* Las suites empiezan por «t»; lo demás que viva en esa carpeta son datos
   que ellas usan —el vocabulario de OpenStreetMap, por ejemplo— y no pruebas
   que correr. */
const todas = fs.readdirSync(DIR).filter(f => /^t.*\.js$/.test(f))
  .map(f => f.replace(/\.js$/, '')).sort();

const args = process.argv.slice(2);
if (args.includes('--lista')) {
  console.log(todas.join('\n'));
  process.exit(0);
}
const pedidas = args.filter(a => !a.startsWith('--'));
const lista = pedidas.length ? pedidas.filter(n => todas.includes(n)) : todas;
const desconocidas = pedidas.filter(n => !todas.includes(n));
if (desconocidas.length) {
  console.error('No existen: ' + desconocidas.join(', '));
  process.exit(2);
}

function correr(nombre) {
  return new Promise(resolve => {
    const inicio = Date.now();
    const hijo = spawn(process.execPath, [path.join(DIR, nombre + '.js')],
                       { cwd: E.RAIZ, env: process.env });
    let salida = '';
    hijo.stdout.on('data', d => { salida += d; });
    hijo.stderr.on('data', d => { salida += d; });
    const reloj = setTimeout(() => { try { hijo.kill('SIGKILL'); } catch (e) {} }, TOPE_MS);
    hijo.on('close', codigo => {
      clearTimeout(reloj);
      /* ── UNA SALIDA VACÍA NO ES UNA SALIDA BUENA ──────────────────────
         El código de salida dice si el proceso terminó bien, no si la suite
         COMPROBÓ algo. Una que revienta antes de su primera aserción, o que
         se queda sin material y no asierta nada, puede terminar en 0 y salir
         con su palomita — y eso ya pasó: en la v962, al demostrar en rojo,
         una suite murió con un TypeError y no imprimió una sola línea; leer
         ese silencio como pase o como fallo habría sido igual de falso.

         Así que se mide la CONCLUSIÓN y no solo el código: una suite tiene
         que dejar en su salida al menos un resultado de aserción —las suites
         de este repositorio usan ✓ y ✅, y ✗ o ❌ cuando fallan— o un conteo
         final «N/M» con M mayor que cero. Si no deja ninguna de las dos
         cosas, no concluyó nada, y eso NUNCA se pinta como verde. */
      const marcas = (salida.match(/[✓✔✅✗✘❌]/g) || []).length;
      const conteo = /(^|\s)(\d+)\s*\/\s*([1-9]\d*)(\s|$)/m.test(salida);
      resolve({ nombre: nombre, ok: codigo === 0, salida: salida,
                concluye: marcas > 0 || conteo, marcas: marcas,
                seg: Math.round((Date.now() - inicio) / 100) / 10 });
    });
  });
}

(async () => {
  console.log('Corriendo ' + lista.length + ' suites, de a ' + EN_PARALELO + '.\n');
  const cola = lista.slice(), resultados = [];
  async function trabajador() {
    while (cola.length) {
      const n = cola.shift();
      const r = await correr(n);
      resultados.push(r);
      console.log('  ' + (!r.concluye ? '?' : r.ok ? '✓' : '✗') + ' ' + n.padEnd(14) + r.seg + ' s' +
        (!r.concluye ? '   NO CONCLUYENTE · no imprimió ni una aserción ni un conteo' : ''));
      if (!r.ok || !r.concluye) {
        // Solo las líneas que dicen qué falló: la salida entera de una suite
        // son doscientas líneas y acá lo que hace falta es el porqué.
        const motivos = r.salida.split('\n')
          .filter(l => /^\s+[✗✘]|Error|error:/.test(l)).slice(0, 6);
        motivos.forEach(l => console.log('      ' + l.trim()));
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(EN_PARALELO, cola.length) }, trabajador));

  /* Las no concluyentes van APARTE de las que fallaron, porque piden otra
     cosa: una que falla dice qué encontró; una que no concluye no encontró
     nada y hay que ir a ver por qué. Las dos cuentan como no verde. */
  const mal = resultados.filter(r => r.concluye && !r.ok);
  const mudas = resultados.filter(r => !r.concluye);
  console.log('\n' + (resultados.length - mal.length - mudas.length) + '/' + resultados.length + ' en verde' +
    (mal.length ? '. Fallaron: ' + mal.map(r => r.nombre).join(', ') : '') +
    (mudas.length ? '. NO CONCLUYENTES: ' + mudas.map(r => r.nombre).join(', ') : '') +
    (!mal.length && !mudas.length ? '.' : '.'));
  process.exit(mal.length + mudas.length ? 1 : 0);
})();
