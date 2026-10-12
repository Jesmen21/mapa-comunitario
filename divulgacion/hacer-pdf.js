/* Arma el PDF a partir del HTML de al lado, y comprueba que ninguna hoja se
   desborde ANTES de escribirlo.

   Esa comprobación es la razón de que esto sea un script y no una orden
   suelta: el contenido se corta en silencio al imprimir —la hoja siguiente
   empieza y nadie se entera de que se perdió un párrafo— y ya pasó una vez
   al escribirlo, en la página 6. Se mide `scrollHeight` contra
   `clientHeight` de cada `.hoja`, que es lo único que ve el recorte.

   Pide Playwright y el Chromium del contenedor:
     node divulgacion/hacer-pdf.js
   El PDF sale en divulgacion/ y NO se sube: lo ignora .gitignore. Lo que se
   versiona es el HTML, que es lo que se corrige. */
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const AQUI = __dirname;
const FUENTE = path.join(AQUI, 'de-quien-es-la-culpa.html');
const SALIDA = path.join(AQUI, 'de-quien-es-la-culpa.pdf');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message)));
  await p.goto('file://' + FUENTE, { waitUntil: 'networkidle' });

  const desbordes = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('.hoja').forEach((h, i) => {
      if (h.scrollHeight > h.clientHeight + 2) {
        out.push('hoja ' + (i + 1) + ': contenido ' + h.scrollHeight +
                 'px en una caja de ' + h.clientHeight + 'px');
      }
    });
    return out;
  });

  if (desbordes.length) {
    await b.close();
    console.error('NO se escribió el PDF: hay hojas que se desbordan y el texto se cortaría.');
    desbordes.forEach((d) => console.error('  · ' + d));
    process.exit(1);
  }

  await p.pdf({ path: SALIDA, format: 'A4', printBackground: true,
                margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  await b.close();
  console.log('ok · ' + SALIDA);
  console.log('errores de JS en la página: ' + (errs.join(' | ') || 'ninguno'));
})();
