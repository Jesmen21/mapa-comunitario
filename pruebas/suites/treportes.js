const E = require('../entorno.js');
/* URBIS_CO: el APK abre la misma aplicación que la web.

   Hubo una carcasa ligera en reportes.html —su propia barra, sus propios
   botones— y llegó a ser la puerta del APK. Se retiró: la interfaz la diseñó
   el dueño una vez, para la web, y una app instalada tiene que enseñar esa y
   no una segunda inventada al lado. A los módulos se entra por Inicio.

   Lo que vigila esta suite:

   · Que /reportes.html siga existiendo y lleve a index.html. No es opcional:
     el APK firmado lleva esa dirección GRABADA como arranque; si la página
     desaparece, la app instalada abre un 404.
   · Que lo que se abre sea la aplicación de verdad —la pantalla de entrada o
     la portada, con su barra de abajo de siempre— y nada de la carcasa.
   · Que el manifiesto del APK arranque en index.html, con alcance en todo el
     sitio y con su icono amarillo, cada uno del tamaño que declara.
   · Que el service worker viejo de la carcasa sea uno de RETIRO: se da de
     baja y no intercepta nada. Compartía alcance con el de la aplicación, y
     un teléfono que hubiera abierto las dos páginas alternaba entre dos
     cachés.
   · Y que entrar por dirección a una pantalla —#/pantalla/social— funcione,
     sin saltar la puerta cuando no hay sesión y sin dejar la app en blanco
     con una pantalla inventada.                                            */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const path = require('path');
const S = E.TRABAJO;
const LEAFLET = S + 'node_modules/leaflet/dist/';
const RAIZ = E.RAIZ;

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);

  // ── El manifiesto, los iconos y el service worker, antes de abrir nada ─
  const man = JSON.parse(fs.readFileSync(path.join(RAIZ, 'manifest-reportes.json'), 'utf8'));
  chk(man.name === man.short_name && man.name === 'URBIS_CO',
      'el manifiesto y el nombre corto dicen lo mismo: "' + man.name + '" / "' + man.short_name + '"');
  chk(man.start_url === '/index.html', 'arranca en la aplicación de verdad (' + man.start_url + ')');
  chk(man.scope === '/', 'y su alcance cubre todo el sitio (' + man.scope + ')');
  chk(man.display === 'standalone', 'se abre sin barra de navegador');
  chk(man.background_color === '#FABD0A',
      'el fondo de la pantalla de arranque es el amarillo del icono (' + man.background_color + ')');

  const cabe = (u) => fs.existsSync(path.join(RAIZ, u));
  const faltan = (man.icons || []).map(i => i.src).filter(u => !cabe(u));
  chk(faltan.length === 0, 'todos los iconos declarados existen' +
      (faltan.length ? ': ' + faltan.join(', ') : ' (' + man.icons.length + ')'));
  chk((man.icons || []).some(i => /maskable/.test(i.purpose || '')),
      'hay icono maskable, que es el que Android recorta');
  const medida = (rel) => {
    const b = fs.readFileSync(path.join(RAIZ, rel));
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  };
  const malas = (man.icons || []).filter(i => {
    const m = medida(i.src), esperado = parseInt(String(i.sizes).split('x')[0], 10);
    return m.w !== esperado || m.h !== esperado;
  }).map(i => i.src + ' dice ' + i.sizes);
  chk(malas.length === 0, 'y cada uno mide lo que declara' + (malas.length ? ': ' + malas.join(', ') : ''));

  const sw = fs.readFileSync(path.join(RAIZ, 'sw-reportes.js'), 'utf8');
  chk(/registration\.unregister\(\)/.test(sw), 'el service worker viejo de la carcasa se da de baja solo');
  chk(!/addEventListener\(\s*['"]fetch['"]/.test(sw), 'y no intercepta peticiones: no puede servir nada viejo');
  chk(!fs.existsSync(path.join(RAIZ, 'js/80-reportes-shell.js')), 'la carcasa ligera ya no está en el repositorio');

  // ── Y que se vea ─────────────────────────────────────────────────────
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const rutas = async (ctx) => {
    await ctx.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
    await ctx.route(/unpkg\.com/, r => { const u = r.request().url();
      r.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
        body: fs.readFileSync(LEAFLET + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') }); });
    await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200, contentType: 'text/javascript',
      body: fs.readFileSync(S + 'node_modules/chart.js/dist/chart.umd.js', 'utf8') }));
    await ctx.route(/basemaps\.cartocdn\.com|arcgisonline\.com|maptiles\.arcgis\.com|mt\d\.google\.com\/vt/,
      r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
    await ctx.route(/script\.google\.com/, r => r.fulfill({ status: 200,
      contentType: 'application/json', body: '{"ok":true,"data":[]}' }));
  };
  const movil = { serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
                  viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true };

  // Con sesión, como el teléfono del dueño.
  const ctx = await b.newContext(movil);
  await ctx.addInitScript(() => {
    if (window.top !== window) return;
    try {
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'vecina', rol: 'citizen',
        session_token: 't', active: true, verified: true }));
      localStorage.setItem('urbisUserRole', 'citizen');
    } catch (e) {}
  });
  await rutas(ctx);
  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 140)));

  /* La dirección grabada en el APK. Se entra por ahí y se mira dónde se
     termina y qué se ve. */
  /* Una página que redirige son DOS navegaciones: la de la página y la del
     destino. `goto` solo espera la primera, así que después se espera a la
     dirección final; si no, la prueba mira una página que ya no está. */
  const irPorLaEntrada = async (sufijo) => {
    await pg.goto(E.ESTATICO + '/reportes.html' + sufijo, { waitUntil: 'commit' }).catch(() => {});
    await pg.waitForURL(/\/index\.html/, { timeout: 20000 }).catch(() => {});
  };
  await irPorLaEntrada('?x=1#/pantalla/events');
  await pg.waitForTimeout(4500);
  const llegada = await pg.evaluate(() => {
    const activa = document.querySelector('.u52-screen.active');
    return {
      url: location.pathname + location.search + location.hash,
      pantalla: activa ? activa.getAttribute('data-u52-screen') : '(ninguna)',
      // Lo de la app de verdad…
      barraDeLaApp: !!document.querySelector('.u52-bottom-nav'),
      // …y nada de la carcasa.
      rastroDeCarcasa: !!(document.getElementById('rp-nav') || document.getElementById('rp-reportar') ||
                          document.getElementById('rp-top')),
      titulo: document.title
    };
  });
  chk(/\/index\.html/.test(llegada.url), 'la dirección grabada en el APK termina en index.html (' + llegada.url + ')');
  chk(/\?x=1/.test(llegada.url) && /#\/pantalla\/events/.test(llegada.url),
      'y conserva lo que traía la dirección: consulta y pantalla pedida');
  chk(llegada.barraDeLaApp, 'lo que se abre es la aplicación de verdad, con su barra de abajo');
  chk(!llegada.rastroDeCarcasa, 'y no queda rastro de la carcasa ligera');
  chk(llegada.pantalla === 'events',
      'la pantalla pedida por la dirección se abre directo (' + llegada.pantalla + ')');

  // Sin nada en la dirección: la app tal cual, como en la web.
  await irPorLaEntrada('');
  await pg.waitForTimeout(4000);
  const normal = await pg.evaluate(() => {
    const activa = document.querySelector('.u52-screen.active');
    return { pantalla: activa ? activa.getAttribute('data-u52-screen') : '(ninguna)',
             cuantas: document.querySelectorAll('.u52-screen.active').length };
  });
  chk(normal.cuantas === 1 && /^(home|login)$/.test(normal.pantalla),
      'sin pantalla pedida abre donde abre la web: portada o entrada (' + normal.pantalla + ')');

  // Una pantalla que no existe no puede dejar la app en blanco.
  await pg.goto(E.ESTATICO + '/index.html#/pantalla/no-existe', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3000);
  const inventada = await pg.evaluate(() => {
    const v = document.querySelector('.u52-screen.active');
    return { vista: v ? v.getAttribute('data-u52-screen') : '(ninguna)',
             cuantas: document.querySelectorAll('.u52-screen.active').length };
  });
  chk(inventada.cuantas === 1 && inventada.vista !== '(ninguna)',
      'una pantalla inventada en la dirección se ignora, no deja la app en blanco (' + inventada.vista + ')');
  await ctx.close();

  // Sin sesión: el atajo NO salta la pantalla de entrada.
  const ctx2 = await b.newContext(movil);
  await rutas(ctx2);
  const pg2 = await ctx2.newPage();
  await pg2.goto(E.ESTATICO + '/index.html#/pantalla/social', { waitUntil: 'domcontentloaded' });
  await pg2.waitForTimeout(5000);
  const sinSesion = await pg2.evaluate(() => {
    const v = document.querySelector('.u52-screen.active');
    return v ? v.getAttribute('data-u52-screen') : '';
  });
  chk(sinSesion === 'login',
      'sin sesión, el atajo NO salta la pantalla de entrada (se quedó en ' + sinSesion + ')');
  await ctx2.close();

  await b.close();
  const errFin = err.filter(e => !/L is not defined|Unexpected end/.test(e));
  chk(errFin.length === 0, 'sin errores de JavaScript' + (errFin.length ? ': ' + errFin[0] : ''));

  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
