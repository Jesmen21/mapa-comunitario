const E = require('../entorno.js');
/* EL RITMO DEL JUEGO PREMIUM (js/12)

   El puntaje era el NÚMERO DE MONEDAS. En treinta segundos todo el mundo cae
   entre sesenta y ciento diez: unos cincuenta valores posibles. Con veinte
   jugadores, dos coincidiendo no es mala suerte, es aritmética — y un empate
   en una competencia que reparte dinero se resolvía por el orden de las filas
   en una hoja de cálculo, que no se le puede explicar a nadie.

   La solución no es «más variedad»: por variado que sea un juego, un conteo
   sigue siendo un conteo. Es que el puntaje CARGUE EL RITMO adentro.

   Lo que esta suite defiende, jugando de verdad en el navegador y no leyendo
   el código:

   · agarrar seguido SUBE lo que vale cada moneda, hasta ×3;
   · fallar —tocar donde no hay moneda— rompe la racha. Sin esto, «más rápido
     = más monedas» premiaría machacar la pantalla, que es lo contrario del
     ritmo, y el bonus se volvería un castigo a jugar bien;
   · dejar escapar una moneda también la rompe: si esperar no cuesta, la
     lentitud no significa nada;
   · dos partidas con el MISMO número de monedas y distinto ritmo dan
     puntajes distintos. Eso es lo que quita los empates, y es lo único que
     de verdad hay que comprobar;
   · y el ARCADE LIBRE se queda contando monedas: su tabla lleva años en esa
     escala y cambiarla volvería ridículos todos los récords viejos.        */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const REPO = process.env.REPO || E.RAIZ;

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 420, height: 760 } });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));

  await pg.goto('http://localhost:8199/assets/', { waitUntil: 'domcontentloaded' });
  await pg.addStyleTag({ path: REPO + '/css/01-base-layout.css' });
  // El juego vive dentro de js/12, que necesita media aplicación para cargar.
  // Se extrae la función sola y se le inyectan las tres cosas que usa de
  // fuera: el sonido, el escapado y el guardado del puntaje.
  const j12 = fs.readFileSync(REPO + '/js/12-spa-ui.js', 'utf8');
  const fuente = (j12.match(/window\.urbisJuegoTap = function\(juegoId, opts\)\{[\s\S]*?\n  \};/) || [''])[0];
  chk(fuente.length > 0, 'se pudo extraer el juego para probarlo');
  if (!fuente) {
    console.log('\n  ✗ se pudo extraer el juego para probarlo\n\n  0/1');
    await b.close(); process.exit(1);
  }
  await pg.evaluate((src) => {
    window._urbisSonidoMoneda = () => {};
    window._escJuego = s => String(s || '');
    window.urbisGuardarPuntaje = (sc) => sc;
    window.urbisIntentosRestantes = () => null;
    window.urbisPuntajeEnVuelo = Promise.resolve();
    window.urbisUltimoPuntajeError = '';
    new Function('_urbisSonidoMoneda', '_escJuego', src)(window._urbisSonidoMoneda, window._escJuego);
  }, fuente);

  const abrir = (premium) => pg.evaluate((p) => {
    document.querySelectorAll('#urbis-game-tap').forEach(x => x.remove());
    window.urbisJuegoTap('ev_prueba', p ? { premium: true, titulo: 'Prueba' } : {});
    return true;
  }, premium);

  // Agarra `n` monedas con `pausaMs` entre una y otra, y devuelve el estado.
  const jugar = (n, pausaMs) => pg.evaluate(async ({ n, pausaMs }) => {
    const dormir = ms => new Promise(r => setTimeout(r, ms));
    const ar = document.querySelector('#urbis-game-tap .gt-arena');
    let cogidas = 0;
    for (let i = 0; i < n; i++) {
      // Se ESPERA a que haya moneda en vez de saltarse el turno: si no, dos
      // partidas que se pidieron iguales acaban con distinto número de
      // monedas y la comparación de abajo no compara nada.
      let c = null, intentos = 0;
      while (!c && intentos++ < 40) {
        c = ar.querySelector('.gt-coin:not(.gt-pop):not(.gt-fuga)');
        if (!c) await dormir(25);
      }
      if (!c) break;
      c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      cogidas++;
      if (pausaMs) await dormir(pausaMs);
    }
    const s = document.querySelector('#urbis-game-tap .gt-score').textContent;
    const m = document.querySelector('#urbis-game-tap .gt-mult');
    return { cogidas, texto: s, puntos: parseInt(s.replace(/\D/g, ''), 10) || 0,
             mult: m ? m.textContent : null, vivas: ar.querySelectorAll('.gt-coin:not(.gt-pop):not(.gt-fuga)').length };
  }, { n, pausaMs });

  // ── 1 · Seguidas suben lo que vale cada moneda ─────────────────────────
  await abrir(true);
  const r1 = await jugar(12, 0);
  chk(r1.cogidas === 12, 'se agarraron las doce monedas de la prueba (' + r1.cogidas + ')');
  chk(r1.puntos > 12 * 10,
      'doce monedas seguidas valen MÁS que doce por diez: la racha sube el valor (' + r1.puntos + ' pts)');
  chk(/×1,[1-9]|×2|×3/.test(r1.mult || ''),
      'y el multiplicador se ve en la franja de arriba (' + r1.mult + ')');
  chk(r1.vivas >= 3,
      'jugando rápido salen más monedas a la vez (' + r1.vivas + '): el ritmo manda el juego');

  // ── 2 · Fallar rompe la racha ──────────────────────────────────────────
  const tras = await pg.evaluate(async () => {
    const ar = document.querySelector('#urbis-game-tap .gt-arena');
    // Contra la escala vieja no hay multiplicador: se INFORMA y no se
    // revienta, que un fallo con forma de caída de node no dice qué se perdió.
    const leerMult = () => { const m = document.querySelector('#urbis-game-tap .gt-mult'); return m ? m.textContent : '(no hay)'; };
    const antes = leerMult();
    // Un toque en el borde de la arena, lejos de cualquier moneda.
    ar.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 1, clientY: 1 }));
    await new Promise(r => setTimeout(r, 20));
    return { antes, despues: leerMult(), marca: !!ar.querySelector('.gt-vuela.mal') };
  });
  chk(tras.despues === '×1,0' && tras.antes !== '×1,0',
      'tocar donde no hay moneda devuelve el multiplicador a ×1,0 (' + tras.antes + ' → ' + tras.despues + ')');
  chk(tras.marca, 'y se ve la marca del fallo: una regla que no se ve no se aprende');

  // El puntaje NO baja al fallar: se pierde el impulso, no lo ganado.
  const antesPts = (await pg.evaluate(() =>
    parseInt(document.querySelector('#urbis-game-tap .gt-score').textContent.replace(/\D/g, ''), 10))) || 0;
  chk(antesPts >= r1.puntos, 'fallar cuesta el impulso, no los puntos ya ganados');

  // ── 3 · Dejar escapar una moneda también rompe ─────────────────────────
  const fuga = await pg.evaluate(async () => {
    const ar = document.querySelector('#urbis-game-tap .gt-arena');
    // Subir el multiplicador de nuevo, y después no tocar nada.
    for (let i = 0; i < 6; i++) {
      const c = ar.querySelector('.gt-coin:not(.gt-pop):not(.gt-fuga)');
      if (c) c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise(r => setTimeout(r, 10));
    }
    const leerMult = () => { const m = document.querySelector('#urbis-game-tap .gt-mult'); return m ? m.textContent : '(no hay)'; };
    const antes = leerMult();
    await new Promise(r => setTimeout(r, 2600));   // más que la vida de la moneda
    return { antes, despues: leerMult() };
  });
  chk(fuga.antes !== '×1,0' && fuga.despues === '×1,0',
      'dejar escapar una moneda también rompe la racha (' + fuga.antes + ' → ' + fuga.despues + ')');

  // ── 4 · Lo que de verdad importa: mismo número, distinto puntaje ───────
  await abrir(true);
  const rapido = await jugar(20, 0);
  await abrir(true);
  const lento = await jugar(20, 130);
  chk(rapido.cogidas === lento.cogidas,
      'dos partidas con exactamente las mismas monedas (' + rapido.cogidas + ')');
  /* Los dos jugaron LIMPIO: ni un fallo, ni una moneda escapada. Si el
     puntaje dependiera solo de la racha, los dos sacarían exactamente lo
     mismo —se probó y salió 333 contra 333— y el empate volvería justo
     entre los que juegan bien, que son los que se disputan el premio. */
  chk(rapido.puntos !== lento.puntos,
      'y puntajes DISTINTOS según el ritmo, jugando los dos limpio: ' + rapido.puntos + ' vs ' + lento.puntos +
      ' — esto es lo que quita los empates');
  chk(rapido.puntos > lento.puntos,
      'el que reaccionó más rápido saca más, que es la regla que se le puede explicar a alguien');

  /* ── 4b · Cuánta resolución tiene el puntaje ─────────────────────────
     Acá NO se comprueba que dos partidas iguales den números distintos: con
     la misma entrada tienen que dar lo mismo. Un juego que reparte dinero y
     devuelve un número distinto cada vez sería injusto, no variado — y un
     robot juega con precisión de metrónomo, así que repite clavado.

     Lo que se comprueba es la RESOLUCIÓN, que es de donde sale de verdad el
     fin de los empates: cuánto tiene que cambiar el ritmo para que el
     puntaje cambie. En la escala vieja hacía falta una moneda entera —unos
     cincuenta valores posibles en toda la partida—. Acá, quince milisegundos
     de diferencia promedio por moneda ya mueven el total. Ninguna persona
     repite un ritmo con esa precisión dos veces, y por eso el empate deja de
     ser lo normal. */
  await abrir(true);
  const ritmoA = await jugar(12, 40);
  await abrir(true);
  const ritmoB = await jugar(12, 55);
  chk(ritmoA.cogidas === ritmoB.cogidas, 'dos partidas de las mismas monedas (' + ritmoA.cogidas + ')');
  chk(ritmoA.puntos !== ritmoB.puntos,
      'quince milisegundos de diferencia por moneda YA cambian el total: ' +
      ritmoA.puntos + ' vs ' + ritmoB.puntos + ' — esa es la resolución que mata el empate');
  const rango = Math.abs(ritmoA.puntos - ritmoB.puntos);
  chk(ritmoA.puntos > 200,
      'y el puntaje vive en los cientos, no en las decenas (' + ritmoA.puntos +
      '): pasó de unos cincuenta valores posibles a miles');
  chk(rango > 0 && rango < ritmoA.puntos / 2,
      'sin que el ritmo se lo coma todo: la diferencia es de ' + rango + ' puntos, no de una goleada');

  // ── 5 · El arcade libre no cambió de escala ────────────────────────────
  await abrir(false);
  const libre = await jugar(9, 0);
  chk(libre.puntos === libre.cogidas,
      'el arcade libre sigue contando monedas, una por una (' + libre.puntos + ' de ' + libre.cogidas + ')');
  const sinMult = await pg.evaluate(() => !document.querySelector('#urbis-game-tap .gt-mult'));
  chk(sinMult, 'y no le sale multiplicador: su tabla lleva años en la escala vieja');

  await pg.evaluate(() => document.querySelectorAll('#urbis-game-tap').forEach(x => x.remove()));
  /* ── 6 · La tabla nueva se llena sola ─────────────────────────────────
     Los puntajes de la escala vieja NO se borran a mano: la escala nueva
     estrena tabla y el ranking se llena a medida que la gente juega. Se pidió
     así: «que se borre solo cuando se juegue otra vez y se actualice solo el
     marcador».

     Y no se arregla con el `Math.max` del servidor, que es lo que hay: se
     midió, y una partida malísima en la escala nueva saca 82 puntos, POR
     DEBAJO de un 91 viejo. Con las dos escalas en la misma tabla, el número
     viejo puede sobrevivir y el marcador se queda mintiendo. */
  const h05 = fs.readFileSync(REPO + '/js/05-helpers-temporal-security.js', 'utf8');
  chk(/var URBIS_ESCALA_JUEGO = '_r2';/.test(h05),
      'la escala del puntaje va marcada en el nombre de la tabla');
  const ids = await pg.evaluate((src) => {
    const m = src.match(/function urbisJuegoIdDeEvento\(lat\) \{[\s\S]*?\n  \}/);
    if (!m) return null;
    const f = new Function('URBIS_ESCALA_JUEGO', 'return (' + m[0].replace('function urbisJuegoIdDeEvento', 'function') + ')')('_r2');
    return { a: f('7.8891234'), b: f(7.8891234), c: f(null) };
  }, h05);
  chk(ids && ids.a === ids.b,
      'el mismo evento da el mismo nombre venga el lat como texto o como número');
  chk(ids && /_r2$/.test(ids.a),
      'y el nombre lleva la escala al final (' + (ids ? ids.a : '—') + ')');
  /* Cinco archivos armaban ese nombre copiando la misma línea. Cinco copias
     de una regla es una regla que un día deja de serlo. */
  const COPIAS = ['js/10-visible-markers.js', 'js/12-spa-ui.js', 'js/13j-premio.js',
                  'js/20-mobile-functional-app.js', 'js/47-aurea-forzado.js'];
  const sueltos = COPIAS.filter(f => /'aurea_'\s*\+/.test(fs.readFileSync(REPO + '/' + f, 'utf8')));
  chk(sueltos.length === 0,
      'ningún archivo se arma el nombre por su cuenta' + (sueltos.length ? ': ' + sueltos.join(', ') : ''));

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
