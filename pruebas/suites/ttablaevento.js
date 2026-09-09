const E = require('../entorno.js');
/* LA TABLA COMPLETA DEL EVENTO (v834)
   ────────────────────────────────────────────────────────────────────────
   Se pidió así: «debajo de los 3 primeros lugares quiero una tabla de la
   posición de todos los jugadores de ese evento en curso; si hay un listado
   de 1000 personas jugando, pues que sean esas mil posicionadas por
   puntuación».

   La lista de abajo del podio ya existía. Lo que no existía era la gente:
   al servidor se le pedían CINCUENTA, así que del puesto 51 en adelante no
   llegaba nadie. Quien iba de 737 simplemente no estaba en esta pantalla, y
   verse en la tabla es de las pocas cosas que hacen que alguien vuelva a
   jugar mañana.

   Con mil renglones aparecen dos problemas que con veinte no existen:
     · pintarlos todos traba un teléfono. Se resuelve con
       `content-visibility` en el CSS —el navegador se salta el dibujado de
       lo que está fuera de la pantalla—, no troceando la lista a mano;
     · encontrarse entre mil es imposible a dedo: buscador y un botón que
       salta a mi renglón.

   Y una trampa fácil de escribir mal: el PUESTO se calcula antes de
   filtrar. Si se numerara lo que queda tras buscar, el 737 se leería «3», y
   esa cifra es justo por lo que la gente abre esta pantalla.

   Lo otro que se preguntó —«si sale un nuevo evento, ese queda guardado con
   su resultado y el nuevo empieza de 0»— ya era así: la tabla de cada
   evento se nombra con su ubicación (`urbisJuegoIdDeEvento`). Acá se
   comprueba, porque es una promesa que se le hace a quien compite por
   dinero y no puede romperse sin que nadie se entere.                    */
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
  await pg.goto(E.ESTATICO + '/index.html', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  const JUEGO = 'aurea_7777777_r2';
  const N = 1000;

  /* Mil jugadores de verdad, no veinte «que representan» a mil: el defecto
     que se arregla solo aparece pasando de cincuenta, y los problemas de
     dibujado solo aparecen con la lista entera. */
  await pg.evaluate(([juego, n]) => {
    window.__authReal = window.URBIS_AUTH;
    const tabla = [];
    for (let i = 0; i < n; i++) tabla.push({ usuario: 'jug' + String(i + 1).padStart(4, '0'), puntos: 100000 - i * 7 });
    // Yo voy de 737: bien abajo, imposible de encontrar a dedo.
    tabla[736].usuario = 'yosoy';
    window.__servidorTabla = tabla;
    window.__pedido = null;
    window.URBIS_AUTH = Object.assign({}, window.__authReal, {
      readSession: () => ({ usuario: 'yosoy', rol: 'citizen', session_token: 't' }),
      socialAPI: (p) => {
        if (p && p.action === 'leaderboard') {
          window.__pedido = p;
          const lim = parseInt(p.limit, 10) || 20;
          return Promise.resolve({ ok: true, tabla: window.__servidorTabla.slice(0, lim) });
        }
        return Promise.resolve({ ok: true });
      }
    });
    window.urbisUsuarioActual = () => 'yosoy';
    try { localStorage.removeItem('urbis_premio_lb_' + juego); localStorage.removeItem('urbis_best_' + juego); } catch (e) {}
    window.__urbisAureaCtx = { juegoId: juego, titulo: 'Evento URBIS (Polo)', premio: '50.000', fin: '1/11/2026', terminado: false };
    window.__urbisAureaTabla = null; window.__urbisAureaTablaEstado = null;
  }, [JUEGO, N]);

  /* Se ABRE la pantalla del evento como la abre una persona, en vez de
     pintar el contenido en una caja escondida. Un buscador dentro de una
     pantalla que no está abierta se puede rellenar por código y parecería
     que funciona; nadie podría tocarlo con el dedo. */
  await pg.evaluate(() => {
    if (window.UrbisMobileAppV58 && typeof window.UrbisMobileAppV58.show === 'function') window.UrbisMobileAppV58.show('aurea');
    else window.urbisRenderAureaHub();
  });
  await pg.waitForTimeout(900);
  chk(await pg.evaluate(() => {
    const p = document.querySelector('.u52-aurea-screen');
    return !!(p && getComputedStyle(p).display !== 'none');
  }), 'la pantalla del evento se abre de verdad, no se pinta en una caja escondida');

  // ── 1. Se piden todos, no una punta ────────────────────────────────────
  const pedido = await pg.evaluate(() => window.__pedido);
  chk(!!pedido && pedido.limit >= 1000,
      'al servidor se le piden los mil, no cincuenta (' + (pedido ? pedido.limit : 'no se pidió nada') + ')');

  // ── 2. Están los mil, con su puesto de verdad ──────────────────────────
  const t = await pg.evaluate(() => {
    const c = document.getElementById('u52-aurea-content');
    const filas = [...c.querySelectorAll('.am-row')];
    const pos = filas.map(f => (f.querySelector('.am-pos') || {}).textContent);
    return {
      podio: [...c.querySelectorAll('.am-pod-user')].map(x => x.textContent.trim()),
      filas: filas.length,
      primera: pos[0], ultima: pos[pos.length - 1],
      cuenta: (c.querySelector('.am-list-cab span') || {}).textContent || '',
      miFila: (() => { const m = c.querySelector('.am-row.me'); return m ? m.textContent.replace(/\s+/g, ' ').trim() : ''; })(),
      miPos: (c.querySelector('.am-me-pos') || {}).textContent || ''
    };
  });
  chk(t.podio.length === 3 && t.podio[1] === '@jug0001',
      'el podio sigue siendo el de los tres primeros');
  chk(t.filas === N - 3,
      'y debajo está TODO el resto del evento: ' + t.filas + ' renglones para ' + N + ' jugadores');
  chk(t.primera === '4' && t.ultima === String(N),
      'numerados del 4 al ' + N + ' (llegó del ' + t.primera + ' al ' + t.ultima + ')');
  chk(/1000 jugadores/.test(t.cuenta), 'y se dice cuántos compiten (' + t.cuenta.trim() + ')');
  chk(t.miPos === '#737' && /737/.test(t.miFila) && /yosoy/.test(t.miFila),
      'quien va de 737 se ve, con su puesto real (' + t.miPos + ')');

  // ── 3. Mil renglones no traban el teléfono ─────────────────────────────
  /* No se mide «va rápido» —eso depende de la máquina y sería una prueba
     que falla por el clima— sino que el navegador tenga permiso para
     saltarse lo que no se ve. Sin esa regla, mil renglones se dibujan
     todos. */
  const pintado = await pg.evaluate(() => {
    const f = document.querySelector('#u52-aurea-content .am-row');
    const cs = getComputedStyle(f);
    return { cv: cs.contentVisibility || '', intrinsic: cs.containIntrinsicSize || '' };
  });
  chk(pintado.cv === 'auto',
      'los renglones se dibujan solo cuando entran en pantalla (content-visibility: ' + (pintado.cv || 'sin regla') + ')');
  chk(/\d/.test(pintado.intrinsic),
      'con su alto declarado, para que la barra de scroll no dé saltos (' + pintado.intrinsic + ')');

  // ── 4. Buscar entre mil ────────────────────────────────────────────────
  /* Se escribe por el camino de la persona si el buscador está; si no está
     —la versión anterior no lo tenía—, la suite tiene que seguir y REPORTAR
     lo que falta, no colgarse treinta segundos esperando un elemento que no
     va a aparecer. */
  const hayBuscador = await pg.evaluate(() => !!document.getElementById('am-buscar-input'));
  chk(hayBuscador, 'hay un buscador para encontrarse entre mil');
  if (hayBuscador) { await pg.fill('#am-buscar-input', 'jug0500'); await pg.waitForTimeout(200); }
  const filtrado = await pg.evaluate(() => {
    const vis = [...document.querySelectorAll('#am-list .am-row')].filter(f => !f.hidden);
    if (!vis.length) return { n: 0, usuario: '', puesto: '' };
    return {
      n: vis.length,
      // Se lee la CASILLA del puesto, no el texto pegado del renglón: ahí
      // «500» y «@jug0500» quedan juntos y una comprobación sobre esa
      // cadena mide la maquetación, no el número.
      usuario: (vis[0].querySelector('.am-user') || {}).textContent || '',
      puesto: (vis[0].querySelector('.am-pos') || {}).textContent || ''
    };
  });
  chk(filtrado.n === 1 && /jug0500/.test(filtrado.usuario),
      'el buscador encuentra a una persona entre mil');
  /* La trampa: el puesto tiene que seguir siendo el suyo, no «1» por ser el
     único que quedó en pantalla. */
  chk(filtrado.puesto.trim() === '500',
      'y conserva su PUESTO REAL, no se renumera lo que queda (salió ' + filtrado.puesto.trim() + ')');

  if (hayBuscador) { await pg.fill('#am-buscar-input', 'nadiesellamaasi'); await pg.waitForTimeout(200); }
  const vacio = await pg.evaluate(() => {
    const vis = [...document.querySelectorAll('#am-list .am-row')].filter(f => !f.hidden).length;
    const aviso = document.querySelector('#am-list .am-sin-resultado');
    return { vis, avisoVisible: !!(aviso && !aviso.hidden) };
  });
  chk(vacio.vis === 0 && vacio.avisoVisible,
      'y si no hay nadie con ese nombre lo dice, en vez de dejar la lista en blanco');

  // ── 5. El botón que salta a mi puesto ──────────────────────────────────
  const salto = await pg.evaluate(async () => {
    const b = document.getElementById('am-ir-a-mi');
    if (!b) return null;
    b.click();
    await new Promise(r => setTimeout(r, 400));
    const mia = document.querySelector('#am-list .am-row.me');
    return {
      filtroLimpio: (document.getElementById('am-buscar-input') || {}).value === '',
      miaVisible: !!(mia && !mia.hidden),
      destello: !!(mia && mia.classList.contains('am-destello'))
    };
  });
  chk(!!salto, 'hay un botón para saltar a mi puesto');
  if (salto) {
    chk(salto.filtroLimpio,
        'al saltar se limpia el buscador: saltar a un renglón escondido parecería que el botón no hace nada');
    chk(salto.miaVisible && salto.destello,
        'mi renglón queda a la vista y destella: entre mil iguales, llegar sin que nada cambie no se nota');
  }

  // ── 6. Cada evento, su tabla; el nuevo empieza en cero ────────────────
  const ids = await pg.evaluate(() => ({
    uno: window.urbisJuegoIdDeEvento(6.2518),
    otro: window.urbisJuegoIdDeEvento(6.2977),
    igual: window.urbisJuegoIdDeEvento(6.2518)
  }));
  chk(ids.uno !== ids.otro,
      'dos eventos distintos tienen tablas distintas: el nuevo empieza en cero sin tocar al anterior');
  chk(ids.uno === ids.igual, 'y el mismo evento vuelve siempre a la suya, que es la que guarda su resultado');
  const guardadas = await pg.evaluate((j) => {
    let mias = 0;
    for (let i = 0; i < localStorage.length; i++) if (localStorage.key(i).indexOf('urbis_premio_lb_') === 0) mias++;
    let laMia = null;
    try { laMia = JSON.parse(localStorage.getItem('urbis_premio_lb_' + j) || 'null'); } catch (e) {}
    return { mias, filas: laMia && Array.isArray(laMia.tabla) ? laMia.tabla.length : 0 };
  }, JUEGO);
  chk(guardadas.filas === N,
      'el resultado del evento queda guardado entero, no recortado (' + guardadas.filas + ' filas)');

  // ── 7. Con pocos jugadores no se estorba con un buscador ──────────────
  const pocos = await pg.evaluate(async (juego) => {
    window.__servidorTabla = [
      { usuario: 'ana', puntos: 900 }, { usuario: 'beto', puntos: 800 },
      { usuario: 'caro', puntos: 700 }, { usuario: 'yosoy', puntos: 600 }
    ];
    try { localStorage.removeItem('urbis_premio_lb_' + juego); } catch (e) {}
    window.__urbisAureaTabla = null; window.__urbisAureaTablaEstado = null;
    window.urbisRenderAureaHub();
    await new Promise(r => setTimeout(r, 500));
    const c = document.getElementById('u52-aurea-content');
    return {
      buscador: !!c.querySelector('#am-buscar-input'),
      filas: c.querySelectorAll('.am-row').length,
      cuenta: (c.querySelector('.am-list-cab span') || {}).textContent || ''
    };
  }, JUEGO);
  chk(!pocos.buscador,
      'con cuatro jugadores no sale un buscador: buscar entre cuatro es más trabajo que mirar');
  chk(pocos.filas === 1 && /4 jugadores/.test(pocos.cuenta),
      'pero la tabla y la cuenta siguen ahí (' + pocos.cuenta.trim() + ')');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
