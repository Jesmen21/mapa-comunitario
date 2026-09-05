const E = require('../entorno.js');
/* El arranque, cuando el mapa tarda.

   Apareció como una intermitencia: cada tantas pasadas, una suite cualquiera
   fallaba por «map.on is not a function» sin que nada más fallara. Con la
   máquina cargada, siempre; sola, casi nunca. Eso es una carrera, y las
   carreras no se arreglan repitiendo la prueba hasta que pase.

   La causa: `window.map` no siempre es el mapa. Hasta que js/03 lo asigna, el
   navegador deja ahí el `<div id="map">` —por las variables globales
   automáticas—, un objeto verdadero y sin un solo método de Leaflet. El
   optimizador de zoom (js/28) se carga ANTES que js/03 y su reloj arranca de
   inmediato: comprobaba que hubiera algo y le pedía `on` a un div.

   Esta prueba no espera a que la máquina vaya cargada: RETRASA js/03 a
   propósito un segundo y medio, que es lo que pasa de verdad cuando la red
   está lenta o el teléfono ocupado, y comprueba que en ese hueco nadie tire
   una excepción — y que la aplicación arranque igual después.            */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO, LEAFLET = S + 'node_modules/leaflet/dist/';

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('urbis_licencia_analisis', 'URBIS1.deprueba.deprueba');
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'martarojas', rol: 'admin',
        es_admin: true, session_token: 't', active: true, verified: true }));
    } catch (e) {}
  });
  await ctx.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
  await ctx.route(/unpkg\.com/, r => { const u = r.request().url();
    r.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
      body: fs.readFileSync(LEAFLET + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') }); });
  await ctx.route(/script\.google\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":[]}' }));
  await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  /* El retraso, en el archivo que crea el mapa. Un segundo y medio: más que
     los 500 ms del reloj de js/28, para que su primera vuelta caiga seguro
     dentro del hueco. */
  let retrasado = 0;
  await ctx.route(/03-map-data-config\.js/, async r => {
    retrasado++;
    await new Promise(x => setTimeout(x, 1500));
    await r.continue();
  });

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 160)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);
  // Un respiro extra: el reloj de js/28 late cada 500 ms y hay que darle
  // vueltas después de que el mapa exista, que es cuando debe engancharse.
  await pg.waitForTimeout(1500);

  const r = await pg.evaluate(() => ({
    mapa: !!(window.map && typeof window.map.on === 'function'),
    // El optimizador se enganchó al mapa de verdad, no al div.
    enganchado: !!(window.map && window.map.__urbisZoomOptimizerBound),
    // Y hace su trabajo: la clase del zoom queda escrita en el cuerpo.
    zoomEscrito: document.body.dataset.urbisZoom || '',
    recon: !!window.URBIS_PC_RECON
  }));
  await pg.close(); await b.close();

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };

  console.log('\n  -- el mapa llega tarde --');
  T('el archivo que lo crea se retrasó de verdad', retrasado === 1, retrasado + ' vez');
  T('y aun así la aplicación arranca', r.mapa && r.recon);

  console.log('\n  -- y nadie se rompe en el hueco --');
  T('ni una excepción mientras el mapa no existía',
    err.length === 0, err.join(' | ') || 'ninguna');
  T('el optimizador de zoom se engancha al mapa, no al div', r.enganchado);
  T('y deja escrito el zoom en el cuerpo', /^\d+$/.test(r.zoomEscrito), r.zoomEscrito || '(nada)');

  console.log('\n  ' + (mal ? mal + ' fallaron' : 'todo pasó'));
  process.exit(mal ? 1 : 0);
})();
