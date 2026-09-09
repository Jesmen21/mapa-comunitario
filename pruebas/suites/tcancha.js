const E = require('../entorno.js');
/* LA CANCHA TERMINA DONDE TERMINA LA PANTALLA (v835)
   ────────────────────────────────────────────────────────────────────────
   Un jugador de iPhone, desde el navegador, dijo que «no le oprimía bien»
   las monedas del evento premium. No era su dedo ni su conexión.

   La pantalla del juego era `position:fixed; inset:0`. En iOS eso mide el
   viewport de DISEÑO, que incluye la franja que la barra de herramientas
   del navegador tapa por encima —Chrome y Safari de iPhone la ponen abajo y
   se superpone a la página—. Las monedas que caían en esos últimos ochenta
   píxeles se dibujaban DEBAJO de la barra: se veían a medias o no se veían,
   y el toque se lo llevaba el navegador. En un juego que reparte dinero eso
   es perder puntos por el teléfono que uno tenga, que es la peor manera de
   perder.

   Lo que esta suite defiende:
     · el alto sale del viewport VISUAL —lo que de verdad se ve—, no del
       documento;
     · se vuelve a medir cuando la barra aparece o se esconde, que en iOS
       pasa en mitad de la partida;
     · ninguna moneda nace fuera de lo visible;
     · y los oyentes del viewport se sueltan al salir: viven en `window`, no
       en la pantalla del juego, así que quitar la pantalla no se los lleva
       y se acumularían uno por partida.

   Cómo se finge un iPhone: se encoge el viewport visual, que es exactamente
   lo que hace la barra del navegador al aparecer. Playwright no trae un
   iPhone de verdad, pero el defecto no es de iOS: es de medir el documento
   en vez de la pantalla, y eso se reproduce en cualquier navegador.      */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const REPO = process.env.REPO || E.RAIZ;

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);

  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const LEAFLET = (E.TRABAJO || '') + 'node_modules/leaflet/dist/';
  await ctx.route('**/leaflet*.js', r => r.fulfill({ contentType: 'application/javascript',
    body: fs.readFileSync(LEAFLET + 'leaflet.js', 'utf8') }));
  await ctx.route('**/leaflet*.css', r => r.fulfill({ contentType: 'text/css',
    body: fs.readFileSync(LEAFLET + 'leaflet.css', 'utf8') }));
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));

  /* La barra del navegador de iPhone, fingida: el viewport visual mide 96
     píxeles menos que la ventana, que es lo que tapa. Se instala ANTES de
     que cargue la página para que el juego lo vea desde el primer momento. */
  const TAPA = 96;
  await pg.addInitScript((tapa) => {
    try {
      const real = window.visualViewport;
      const falso = {
        get height() { return window.innerHeight - (window.__tapa || 0); },
        get width() { return window.innerWidth; },
        get offsetTop() { return 0; },
        addEventListener: (t, f) => { (window.__oyentes = window.__oyentes || []).push({ t, f }); },
        removeEventListener: (t, f) => {
          window.__oyentes = (window.__oyentes || []).filter(o => !(o.t === t && o.f === f));
        }
      };
      window.__tapa = tapa;
      Object.defineProperty(window, 'visualViewport', { get: () => falso, configurable: true });
      window.__vvReal = real;
    } catch (e) {}
  }, TAPA);

  await pg.goto(E.ESTATICO + '/index.html', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  await pg.evaluate(() => {
    window.__authReal = window.URBIS_AUTH;
    window.URBIS_AUTH = Object.assign({}, window.__authReal, {
      readSession: () => ({ usuario: 'jugadora', rol: 'citizen', session_token: 't' }),
      socialAPI: () => Promise.resolve({ ok: true, tabla: [] })
    });
    window.urbisUsuarioActual = () => 'jugadora';
  });

  // Se abre el juego premium, que es el del evento que reparte dinero.
  await pg.evaluate(() => window.urbisJuegoTap('aurea_1111111_r2', { premium: true, titulo: 'Evento URBIS' }));
  await pg.waitForTimeout(700);

  const medidas = await pg.evaluate(() => {
    const ov = document.getElementById('urbis-game-tap');
    if (!ov) return null;
    const r = ov.getBoundingClientRect();
    const ar = ov.querySelector('.gt-arena').getBoundingClientRect();
    return {
      altoPantalla: Math.round(r.height),
      ventana: window.innerHeight,
      visual: window.visualViewport.height,
      fondoArena: Math.round(ar.bottom),
      varPuesta: ov.style.getPropertyValue('--gt-alto'),
      oyentes: (window.__oyentes || []).length
    };
  });
  chk(!!medidas, 'la pantalla del juego se abre');
  if (medidas) {
    chk(medidas.altoPantalla <= medidas.visual + 1,
        'la cancha no se pasa de lo que de verdad se ve (' + medidas.altoPantalla + ' contra ' + medidas.visual + ' visibles de ' + medidas.ventana + ')');
    chk(medidas.altoPantalla < medidas.ventana,
        'y es más corta que la ventana: la franja que tapa la barra del navegador queda fuera');
    chk(/px/.test(medidas.varPuesta),
        'el alto se fija con la medida del viewport visual, no con el documento (' + medidas.varPuesta + ')');
    chk(medidas.fondoArena <= medidas.visual + 1,
        'y el fondo de la cancha queda dentro de lo visible (' + medidas.fondoArena + ')');
    chk(medidas.oyentes >= 1,
        'se queda escuchando al viewport: en iPhone la barra aparece y se esconde en mitad de la partida');
  }

  // ── Ninguna moneda nace donde no se puede tocar ────────────────────────
  /* Se dejan salir muchas y se comprueban TODAS. Con una sola, la prueba
     pasaría por suerte: el defecto era que caían ahí de vez en cuando. */
  const monedas = await pg.evaluate(async () => {
    const ov = document.getElementById('urbis-game-tap');
    const vistas = [];
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 90));
      ov.querySelectorAll('.gt-coin').forEach(c => {
        const r = c.getBoundingClientRect();
        vistas.push({ arriba: Math.round(r.top), abajo: Math.round(r.bottom) });
      });
    }
    return { vistas, visual: window.visualViewport.height };
  });
  chk(monedas.vistas.length > 5, 'salieron monedas para revisar (' + monedas.vistas.length + ')');
  const fuera = monedas.vistas.filter(m => m.abajo > monedas.visual + 1 || m.arriba < -1);
  chk(fuera.length === 0,
      'ninguna moneda nace fuera de lo que se ve' +
      (fuera.length ? ': ' + fuera.length + ' de ' + monedas.vistas.length + ' (la peor terminaba en ' +
        Math.max.apply(null, fuera.map(f => f.abajo)) + ', y solo se ven ' + monedas.visual + ')' : ''));

  // ── Al reaparecer la barra, la cancha se reajusta ─────────────────────
  const trasCambio = await pg.evaluate(() => {
    window.__tapa = 180;                      // la barra crece
    (window.__oyentes || []).forEach(o => { try { o.f(); } catch (e) {} });
    const ov = document.getElementById('urbis-game-tap');
    return { alto: Math.round(ov.getBoundingClientRect().height), visual: window.visualViewport.height };
  });
  chk(trasCambio.alto <= trasCambio.visual + 1,
      'si la barra crece en mitad de la partida, la cancha se recoge con ella (' + trasCambio.alto + ' contra ' + trasCambio.visual + ')');

  // ── Al salir, no queda nada escuchando ────────────────────────────────
  const trasSalir = await pg.evaluate(async () => {
    const btn = document.querySelector('#urbis-game-tap .gt-close');
    if (btn) btn.click();
    await new Promise(r => setTimeout(r, 300));
    return { oyentes: (window.__oyentes || []).length, sigue: !!document.getElementById('urbis-game-tap') };
  });
  chk(!trasSalir.sigue, 'al salir, la pantalla del juego se va');
  chk(trasSalir.oyentes === 0,
      'y no deja oyentes sueltos: viven en window, así que una partida por otra se irían acumulando (' + trasSalir.oyentes + ')');

  // ── El toque no se lo puede llevar el desplazamiento ──────────────────
  const css = fs.readFileSync(REPO + '/css/01-base-layout.css', 'utf8');
  const bloque = (css.match(/#urbis-game-tap \{[^}]*\}/) || [''])[0];
  chk(/touch-action:\s*none/.test(bloque),
      'la cancha declara que sus toques no son gestos de desplazamiento');
  chk(/overscroll-behavior:\s*contain/.test(bloque),
      'y que el rebote de la página no se los lleve');
  chk(/var\(--gt-alto/.test(bloque) && /100dvh/.test(bloque),
      'con el respaldo de dvh para quien no dé la medida del viewport visual');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
