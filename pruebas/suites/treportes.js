const E = require('../entorno.js');
/* La app ligera: una sola aplicación con cuatro puertas.

   `reportes.html` existe para quien solo quiere avisar de un hueco: abre el
   mapa con un botón grande y no carga los 48 scripts de la app completa. Lo
   que faltaba era el resto de la casa — eventos, la comunidad y el
   seguimiento presidencial— sin volver a la app pesada por la puerta grande.

   Lo que vigila esta suite:

   · Que las cuatro puertas existan y lleven a donde dicen. Un botón que no
     hace nada, en una app instalada con su propio icono, se siente como si
     la app estuviera rota.
   · Que entrar por dirección a una pantalla de la app grande FUNCIONE, y que
     no salte la puerta: mandar a Social a quien no ha entrado lo deja en una
     pantalla vacía sin explicación.
   · Que el manifiesto tenga alcance para las tres páginas. Con el alcance
     viejo —solo `/reportes.html`— tocar «Gobierno» abría el navegador encima
     de la app, con su barra de direcciones: la delata como página web y
     rompe la ilusión por la que existe un APK.
   · Y que los iconos existan, sean cuadrados, del tamaño que declaran y
     lleven el amarillo de la marca — el maskable con su margen, porque
     Android recorta.                                                       */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const path = require('path');
const S = E.TRABAJO;
const LEAFLET = S + 'node_modules/leaflet/dist/';
const RAIZ = E.RAIZ;

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);

  // ── El manifiesto y los iconos, antes de abrir nada ──────────────────
  const man = JSON.parse(fs.readFileSync(path.join(RAIZ, 'manifest-reportes.json'), 'utf8'));
  /* El rótulo del lanzador. Va comprobado como IGUALDAD entre los tres sitios
     donde aparece, no contra un texto fijo: el nombre puede cambiar cuando el
     dueño quiera, lo que no puede es cambiar en uno solo. Pasó de camino: el
     APK se estaba armando con un nombre y el manifiesto declaraba otro, así
     que la misma app se llamaba distinto según se instalara desde la tienda o
     desde el navegador. */
  chk(man.name === man.short_name && man.name === 'URBIS_CO',
      'el manifiesto y el nombre corto dicen lo mismo: "' + man.name + '" / "' + man.short_name + '"');
  chk(man.scope === '/', 'y su alcance cubre todo el sitio (' + man.scope + ')');
  chk(man.start_url === '/reportes.html', 'pero arranca en la app ligera (' + man.start_url + ')');
  chk(man.display === 'standalone', 'se abre sin barra de navegador');
  chk(man.background_color === '#FABD0A',
      'el fondo de la pantalla de arranque es el amarillo del icono (' + man.background_color + ')');

  const cabe = (u) => fs.existsSync(path.join(RAIZ, u));
  const faltan = (man.icons || []).map(i => i.src).filter(u => !cabe(u));
  chk(faltan.length === 0, 'todos los iconos declarados existen' +
      (faltan.length ? ': ' + faltan.join(', ') : ' (' + man.icons.length + ')'));
  const maskables = (man.icons || []).filter(i => /maskable/.test(i.purpose || ''));
  chk(maskables.length >= 1, 'hay icono maskable, que es el que Android recorta (' + maskables.length + ')');
  // Las medidas y el color, leyendo el PNG: la cabecera IHDR trae ancho y alto.
  const medida = (rel) => {
    const b = fs.readFileSync(path.join(RAIZ, rel));
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  };
  const malas = (man.icons || []).filter(i => {
    const m = medida(i.src), esperado = parseInt(String(i.sizes).split('x')[0], 10);
    return m.w !== esperado || m.h !== esperado;
  }).map(i => i.src + ' dice ' + i.sizes);
  chk(malas.length === 0, 'y cada uno mide lo que declara' + (malas.length ? ': ' + malas.join(', ') : ''));

  // ── Y que se vea ─────────────────────────────────────────────────────
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
    viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    if (window.top !== window) return;
    try {
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'vecina', rol: 'citizen',
        session_token: 't', active: true, verified: true }));
      localStorage.setItem('urbisUserRole', 'citizen');
    } catch (e) {}
  });
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

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 140)));
  await pg.goto(E.ESTATICO + '/reportes.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3000);

  const carcasa = await pg.evaluate(() => {
    const btns = [...document.querySelectorAll('#rp-nav button')];
    return {
      titulo: document.title,
      puertas: btns.map(x => x.getAttribute('data-rp')),
      rotulos: btns.map(x => x.textContent.trim()),
      hayBoton: !!document.getElementById('rp-reportar'),
      hayMapa: !!(window.map || window.urbisMap),
      // La versión con la que pide los archivos compartidos: estaba congelada.
      version: (document.querySelector('script[src*="js/80"]') || {}).src || ''
    };
  });
  chk(carcasa.hayMapa && carcasa.hayBoton, 'la app ligera abre con su mapa y su botón de reportar');
  chk(carcasa.titulo.indexOf(man.short_name) === 0,
      'y la página abre con ese mismo nombre por delante: "' + carcasa.titulo + '"');
  chk(carcasa.puertas.join(',') === 'mapa,eventos,social,aldia',
      'tiene las cuatro puertas: ' + carcasa.puertas.join(' · '));
  chk(/780|78\d|7[89]\d|\d{3,}/.test(carcasa.version) && !/597/.test(carcasa.version),
      'y ya no pide los archivos compartidos con la versión 597 congelada');

  // Cada puerta, tocada de verdad.
  const irY = async (dato) => {
    await pg.goto(E.ESTATICO + '/reportes.html', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(2200);
    /* Si la puerta no existe, se dice y se sigue. Una suite que revienta
       cuando falta lo que comprueba no informa: solo se cae. */
    const hay = await pg.evaluate(d => {
      const b = document.querySelector('#rp-nav button[data-rp="' + d + '"]');
      if (!b) return false;
      b.click(); return true;
    }, dato);
    if (!hay) return { url: '(no existe la puerta ' + dato + ')', vista: '' };
    await pg.waitForTimeout(3200);
    return pg.evaluate(() => {
      const v = document.querySelector('.sp-view.on') || document.querySelector('.u52-screen.active');
      return { url: location.pathname + location.hash,
               vista: v ? (v.getAttribute('data-view') || v.getAttribute('data-u52-screen')) : '' };
    });
  };
  const gob = await irY('aldia');
  chk(/seguimiento\.html/.test(gob.url), '«Gobierno» abre el seguimiento presidencial (' + gob.url + ')');

  const eventos = await irY('eventos');
  chk(/index\.html#\/pantalla\/events/.test(eventos.url),
      '«Eventos» pide esa pantalla por la dirección (' + eventos.url + ')');
  chk(eventos.vista === 'events',
      'y la app grande abre DIRECTO en Eventos, no en la portada (' + eventos.vista + ')');

  const social = await irY('social');
  chk(social.vista === 'social',
      '«Social» abre directo en la comunidad (' + social.vista + ')');

  // La puerta cerrada: sin sesión, el atajo NO salta la pantalla de entrada.
  const ctx2 = await b.newContext({ serviceWorkers: 'block', viewport: { width: 412, height: 915 },
                                    isMobile: true, hasTouch: true });
  await ctx2.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
  await ctx2.route(/unpkg\.com/, r => { const u = r.request().url();
    r.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
      body: fs.readFileSync(LEAFLET + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') }); });
  await ctx2.route(/cdn\.jsdelivr\.net|script\.google\.com|basemaps|arcgisonline|maptiles|mt\d\.google/,
    r => r.fulfill({ status: 200, body: '' }));
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

  await b.close();
  const errFin = err.filter(e => !/L is not defined|Unexpected end/.test(e));
  chk(errFin.length === 0, 'sin errores de JavaScript' + (errFin.length ? ': ' + errFin[0] : ''));

  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
