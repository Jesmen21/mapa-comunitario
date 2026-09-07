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
  chk(man.start_url === '/index.html?app=ciudadano',
      'arranca en la aplicación de verdad y en modo ciudadano (' + man.start_url + ')');
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
  /* El de 1024 es el que pide la App Store, y sin él el empaquetador de iOS
     agranda el de 512: el icono de la tienda sale borroso y Apple lo rechaza
     por calidad antes de mirar la app. Va en el manifiesto, no suelto, para
     que PWABuilder lo encuentre solo. */
  chk((man.icons || []).some(i => String(i.sizes) === '1024x1024'),
      'y el de 1024, que es el que pide la App Store para iPhone');
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
    await ctx.route(/script\.google\.com/, r => {
      lecturas++;
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":[]}' });
    });
  };
  /* La hoja simulada vuelve VACÍA a propósito: es el caso de una ciudad
     recién estrenada, y era el que hacía girar la app sin fin. */
  let lecturas = 0;
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
    /* Por about:blank primero: si la pestaña ya estaba en index.html, la
       espera por la dirección final se daría por satisfecha con la página
       ANTERIOR y la prueba miraría un documento que estaba por destruirse. */
    await pg.goto('about:blank');
    await pg.goto(E.ESTATICO + '/reportes.html' + sufijo, { waitUntil: 'commit' }).catch(() => {});
    await pg.waitForURL(/\/index\.html/, { timeout: 20000 }).catch(() => {});
    await E.esperarLaApp(pg, 30000).catch(() => {});
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
  chk(/\?x=1/.test(llegada.url) && /app=ciudadano/.test(llegada.url) && /#\/pantalla\/events/.test(llegada.url),
      'y conserva lo que traía la dirección, más el modo: ' + llegada.url.replace(/^.*index\.html/, 'index.html'));
  chk(llegada.barraDeLaApp, 'lo que se abre es la aplicación de verdad, con su barra de abajo');
  chk(!llegada.rastroDeCarcasa, 'y no queda rastro de la carcasa ligera');
  chk(llegada.pantalla === 'events',
      'la pantalla pedida por la dirección se abre directo (' + llegada.pantalla + ')');

  /* ── Una hoja vacía no puede poner la app a girar ──────────────────
     Eventos recargaba los puntos al ver globalData vacío, y la carga, al
     terminar, volvía a pintar Eventos: cargar → pintar → «vacío, cargo» →
     cargar… Tres gráficas reconstruidas por vuelta; el hilo quedó bloqueado
     más de dos minutos. Se mide en frío: cuántas lecturas de la hoja hay en
     cinco segundos con Eventos abierto, y si el hilo sigue contestando. */
  const antesLecturas = lecturas;
  const t0 = Date.now();
  const respondio = await Promise.race([
    pg.evaluate(() => new Promise(r => setTimeout(() => r(true), 5000))),
    new Promise(r => setTimeout(() => r(false), 9000))
  ]);
  const nuevas = lecturas - antesLecturas;
  chk(respondio === true, 'con Eventos abierto y la hoja vacía, el hilo sigue respondiendo (' +
      (Date.now() - t0) + ' ms para una espera de 5 s)');
  chk(nuevas <= 3, 'y no se encadenan recargas: ' + nuevas + ' lectura(s) de la hoja en cinco segundos');

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

  /* ── El recorte de URBIS_CO: el modo ciudadano ─────────────────────
     La misma app, con seis módulos. Lo hace js/70-modo-app.js a partir del
     parámetro ?app=ciudadano con el que entra el APK. Se comprueba lo que
     QUEDA en la portada y lo que se PUEDE abrir, que son dos cosas:
     esconder sin bloquear sería cosmética. */
  console.log('\n── El recorte de URBIS_CO (modo ciudadano) ─────────');
  const modo = await pg.evaluate(() => {
    const card = cls => document.querySelector('.u52-module.' + cls);
    const visible = el => !!el && getComputedStyle(el).display !== 'none';
    const o = { marca: document.documentElement.getAttribute('data-urbis-modo'),
                quedan: {}, fuera: {}, rotulos: [...document.querySelectorAll('.u52-k-section-label')].map(x => x.textContent.trim()) };
    ['map', 'events', 'social', 'games', 'seguimiento'].forEach(c => { o.quedan[c] = visible(card(c)); });
    /* La Vitrina tiene DOS puertas y esta suite mira a una ciudadana sin
       permiso: el modo ciudadano sí la incluye, pero el módulo es por
       invitación (js/13i), así que su tarjeta no está. Quien la tiene es
       cosa de `tvitrina`. */
    o.modoPermiteVitrina = typeof window.urbisPantallaPermitida === 'function' ? window.urbisPantallaPermitida('vitrina') : null;
    o.vitrinaSinPermiso = !card('vitrina');
    // Quitadas del DOM, no escondidas: js/70 las poda para que tampoco
    // reciban foco ni las lea un lector de pantalla.
    ['sport', 'procity', 'aia', 'mascotas', 'mobility'].forEach(c => { o.fuera[c] = !card(c); });
    o.enlaceSeguimiento = (card('seguimiento') || {}).getAttribute ? card('seguimiento').getAttribute('onclick') : '';
    // Y la entrada, bloqueada.
    const activa = () => document.querySelector('.u52-screen.active').getAttribute('data-u52-screen');
    o.antes = activa();
    o.rushDevuelve = window.urbisIrAPantalla('sport');
    o.rushPantalla = activa();
    o.avisoTexto = (document.getElementById('urbis-modo-aviso') || {}).textContent || '';
    o.juegosDevuelve = window.urbisIrAPantalla('games');
    o.juegosPantalla = activa();
    window.urbisIrAPantalla('home');
    return o;
  });
  chk(modo.marca === 'ciudadano', 'la app sabe que está en modo ciudadano (' + modo.marca + ')');
  const quedan = Object.keys(modo.quedan).filter(k => modo.quedan[k]);
  chk(quedan.length === 5, 'en la portada quedan sus módulos: ' + quedan.join(', '));
  chk(modo.modoPermiteVitrina === true && modo.vitrinaSinPermiso === true,
      'la Vitrina la permite el modo, pero sin el permiso no aparece: es por invitación');
  const sobran = Object.keys(modo.fuera).filter(k => !modo.fuera[k]);
  chk(sobran.length === 0, 'y el resto se quitó del inicio' +
      (sobran.length ? ' — siguen: ' + sobran.join(', ') : ': Rush, Pro City, Empresas, Mascotas, Movilidad'));
  chk(!modo.rotulos.some(r => /ProCity|desarrollo/i.test(r)),
      'sin rótulos de secciones vacías (' + modo.rotulos.join(' · ') + ')');
  chk(/seguimiento\.html\?app=ciudadano/.test(modo.enlaceSeguimiento || ''),
      'la tarjeta de Seguimiento lleva el modo en el enlace, para no perderlo al salir');
  chk(modo.rushDevuelve === false && modo.rushPantalla === modo.antes,
      'pedir URBIS Rush no abre nada: se queda en ' + modo.rushPantalla);
  chk(/no está en esta app/i.test(modo.avisoTexto), 'y lo dice: "' + modo.avisoTexto + '"');
  chk(modo.juegosDevuelve === true && modo.juegosPantalla === 'games',
      'pero los Minijuegos sí abren (' + modo.juegosPantalla + ')');

  // Por dirección tampoco, y el modo sigue en la dirección.
  await pg.goto(E.ESTATICO + '/index.html?app=ciudadano#/pantalla/sport', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg, 30000).catch(() => {});
  await pg.waitForTimeout(2500);
  const porDireccion = await pg.evaluate(() =>
    (document.querySelector('.u52-screen.active') || { getAttribute: () => '' }).getAttribute('data-u52-screen'));
  chk(porDireccion !== 'sport', 'ni por dirección: #/pantalla/sport se queda en ' + porDireccion);

  // Y la vuelta desde el seguimiento conserva el modo.
  await pg.goto(E.ESTATICO + '/seguimiento.html?app=ciudadano', { waitUntil: 'load' });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => document.getElementById('sp-back').click());
  await pg.waitForURL(/index\.html/, { timeout: 15000 }).catch(() => {});
  const vuelta = await pg.evaluate(() => location.search);
  chk(/app=ciudadano/.test(vuelta), 'al volver del seguimiento el modo sigue en la dirección (' + vuelta + ')');

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
  /* La web no se recorta. Esta pestaña entró por index.html sin la marca —
     como entra cualquiera desde el navegador— y tiene que traer todo. */
  const web = await pg2.evaluate(() => ({
    marca: document.documentElement.getAttribute('data-urbis-modo'),
    rushExiste: !!document.querySelector('.u52-module.sport'),
    procityExiste: !!document.querySelector('.u52-module.procity'),
    abreRush: typeof window.urbisPantallaPermitida === 'function' ? window.urbisPantallaPermitida('sport') : null
  }));
  chk(!web.marca && web.rushExiste && web.procityExiste && web.abreRush === true,
      'la web, entrando por index.html sin parámetro, sigue completa: Rush y Pro City en su sitio');
  await ctx2.close();

  await b.close();
  const errFin = err.filter(e => !/L is not defined|Unexpected end/.test(e));
  chk(errFin.length === 0, 'sin errores de JavaScript' + (errFin.length ? ': ' + errFin[0] : ''));

  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
