const E = require('../entorno.js');
/* Quitar a un FAMILIAR de los contactos lo quita de verdad.

   `urbisEliminarContacto` (js/12) borraba en la hoja solo las dos filas
   «yo~~~él~~~amigo» y «él~~~yo~~~amigo». Una relación guardada como familia
   —«yo~~~mamá~~~familia»— no casaba con ninguna de las dos, así que se iba de
   la memoria del teléfono, seguía en la hoja, y al recargar el familiar
   volvía a aparecer. Lo midió la sesión del módulo Seguridad el 23 de octubre
   de 2026.

   La hoja de mentira de esta suite hace lo que hace el servidor con un
   `db_delete`: quita las filas cuyo campo es EXACTAMENTE ese valor. Se miden
   las dos ramas en la misma corrida (CLAUDE.md, «el material tiene que poder
   producir el fallo»):

     · las que tienen que irse —un familiar mutuo, un amigo mutuo, y uno
       mixto: yo lo tengo como familia y él a mí como amigo—;
     · y la que tiene que QUEDARSE: otro contacto, que borrar de más
       desarmaría la red de alguien sin que lo pidiera.

   Y se mide después de recargar, que es donde el fallo se veía.         */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO;
const LEAFLET = S + 'node_modules/leaflet/dist/';

const rel = (a, b, t) => ({ tipo: '🤝 Relacion', lat: '0', lng: '0',
  descripcion: a + '~~~' + b + '~~~' + t, fecha: '2026-10-01T12:00:00.000Z' });
const hoja = [
  rel('yo', 'mama', 'familia'), rel('mama', 'yo', 'familia'),   // familiar mutuo
  rel('yo', 'ana', 'amigo'),    rel('ana', 'yo', 'amigo'),      // amiga mutua
  rel('yo', 'tio', 'familia'),  rel('tio', 'yo', 'amigo'),      // mixto
  rel('yo', 'luz', 'amigo'),    rel('luz', 'yo', 'amigo'),      // se queda
  rel('yo', 'abu', 'familia'),  rel('abu', 'yo', 'familia')     // se quita sin las relaciones en memoria
];
const borrados = [];

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
    viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    if (window.top !== window) return;
    try {
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'yo', rol: 'citizen',
        session_token: 't', active: true, verified: true }));
      localStorage.removeItem('urbis_db_cache_v1');
    } catch (e) {}
    window.confirm = () => true;
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
  await ctx.route(/script\.google\.com/, r => {
    let p = {};
    try { p = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
    if (p.action === 'db_delete') {
      borrados.push(p.value);
      for (let i = hoja.length - 1; i >= 0; i--) if (String(hoja[i][p.col]) === String(p.value)) hoja.splice(i, 1);
    }
    const data = (p.action === 'db_read' || !p.action) ? hoja.slice() : [];
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  });

  const pg = await ctx.newPage();
  const errores = []; pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));
  await pg.goto(E.ESTATICO + '/index.html', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  /* Las relaciones se traen como las trae la aplicación: con su lectura, no
     escritas a mano en la memoria. */
  const antes = await pg.evaluate(async () => {
    const data = await window.urbisDBRead({ forzar: true });
    window.urbisRelaciones = data.filter(p => String(p.tipo || '').toLowerCase().indexOf('relacion') !== -1);
    return { yo: window.urbisUsuarioActual(), n: window.urbisRelaciones.length };
  });
  chk(antes.yo === 'yo' && antes.n === 10,
      'MATERIAL · la sesión es «yo» y la hoja trae las 10 relaciones del escenario — yo=' + antes.yo + ' · ' + antes.n);

  await pg.evaluate(async () => {
    const esperar = ms => new Promise(x => setTimeout(x, ms));
    window.urbisEliminarContacto('mama'); await esperar(300);
    window.urbisEliminarContacto('ana');  await esperar(300);
    window.urbisEliminarContacto('tio');  await esperar(300);
    /* Quien abre «Quitar» antes de que la aplicación haya leído las
       relaciones no tiene nada en memoria que casar: el borrado tiene que
       salir igual, por los dos tipos y los dos sentidos. */
    window.urbisRelaciones = [];
    window.urbisEliminarContacto('abu');  await esperar(300);
  });
  await pg.waitForTimeout(500);

  const quedan = hoja.map(f => f.descripcion);
  const sigue = u => quedan.filter(d => d.split('~~~').slice(0, 2).indexOf(u) !== -1);
  chk(sigue('mama').length === 0,
      'el familiar mutuo sale de la hoja, los dos lados — quedan: ' + (sigue('mama').join(', ') || 'ninguna'));
  chk(sigue('tio').length === 0,
      'y el mixto (yo lo tengo como familia, él a mí como amigo) también — quedan: ' + (sigue('tio').join(', ') || 'ninguna'));
  chk(sigue('ana').length === 0,
      'el amigo mutuo sigue saliendo como antes — quedan: ' + (sigue('ana').join(', ') || 'ninguna'));
  chk(sigue('abu').length === 0,
      'y el familiar quitado sin las relaciones en memoria también — quedan: ' + (sigue('abu').join(', ') || 'ninguna'));
  chk(sigue('luz').length === 2,
      'y el contacto que nadie quitó se queda entero, los dos lados — ' + sigue('luz').length + ' de 2');
  chk(borrados.every(v => /^(yo~~~(mama|ana|tio|abu)|(mama|ana|tio|abu)~~~yo)~~~(amigo|familia)$/.test(v)),
      'ningún borrado apunta a una relación que no sea de las quitadas — ' + borrados.length + ' pedidos');

  /* Donde el fallo se veía: al recargar. */
  await pg.evaluate(() => { try { localStorage.removeItem('urbis_db_cache_v1'); } catch (e) {} });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);
  const despues = await pg.evaluate(async () => {
    const data = await window.urbisDBRead({ forzar: true });
    window.urbisRelaciones = data.filter(p => String(p.tipo || '').toLowerCase().indexOf('relacion') !== -1);
    let cont = document.getElementById('u52-contactos-lista');
    if (!cont) { cont = document.createElement('div'); cont.id = 'u52-contactos-lista'; document.body.appendChild(cont); }
    window.urbisRenderContactos('todos', true);
    return { texto: cont.textContent || '' };
  });
  chk(!/mama|tio|abu/i.test(despues.texto),
      'al recargar, el familiar quitado ya no aparece en la lista de contactos');
  chk(/luz/i.test(despues.texto),
      'MATERIAL · y la lista sí pinta al contacto que se quedó (si no, el renglón de arriba pasaría por lista vacía)');
  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
