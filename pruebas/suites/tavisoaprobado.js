const E = require('../entorno.js');
/* ENTERARSE DE QUE TE APROBARON EL REPORTE (v836)
   ────────────────────────────────────────────────────────────────────────
   El ciclo de moderación tenía el final abierto. Se reportaba, se
   esperaba, y si un moderador aprobaba… no pasaba nada visible: el reporte
   aparecía completo en el mapa algún día. Quien reportó no se entera de
   que le hicieron caso, y esa es justo la señal que hace que alguien
   vuelva a reportar. Peor todavía con la v835: si le pidieron corregir
   algo, corrigió, y se lo aprobaron, nadie se lo dijo.

   Se resuelve sin tocar el servidor: este teléfono se acuerda del último
   estado que su dueño VIO de cada reporte suyo, y compara.

   Dos decisiones que son las que evitan que esto se vuelva ruido, y las
   dos se miden acá porque son fáciles de romper sin notarlo:

     · Si no hay nada guardado NO se avisa: se anota y ya. Sin esto, la
       primera vez que alguien abre la lista después de esta versión le
       saldrían diez avisos de reportes viejos, y a partir del tercero
       nadie lee ninguno.
     · El aviso se queda hasta que la persona lo cierra. Uno que
       desaparece solo al repintar la pantalla es un aviso que la mitad de
       la gente no llega a leer — y esta lista se repinta sola cada vez que
       llegan puntos nuevos.                                              */
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

  const AUTOR = 'Marta Rios';
  await pg.evaluate((autor) => {
    window.__authReal = window.URBIS_AUTH;
    window.URBIS_AUTH = Object.assign({}, window.__authReal, { readSession: () => ({}) });
    window.userRole = 'citizen';
    window.userNameGlobal = autor; window.userUsernameGlobal = autor;
    window.userEmailGlobal = ''; window.userCedulaGlobal = '';
    try { localStorage.removeItem('urbis_reportes_vistos_v1'); } catch (e) {}
    window.__fila = (estado) => {
      const d = new Array(BASE_OFFSET + 9).fill('');
      d[0] = 'Hueco en la via'; d[1] = 'Hueco frente al colegio'; d[2] = 'La nota.'; d[3] = 'Malo';
      d[BASE_OFFSET + 1] = estado; d[BASE_OFFSET + 2] = autor; d[BASE_OFFSET + 3] = 'citizen';
      return { lat: 6.2518, lng: -75.5636, tipo: '🚨 Alertas y Riesgos Urbanos', descripcion: d.join(' | ') };
    };
  }, AUTOR);

  const preguntar = (estado) => pg.evaluate(e => {
    if (typeof window.urbisNovedadReporte !== 'function') return null;
    const r = window.urbisNovedadReporte(window.__fila(e));
    return { nueva: !!r.nueva, estado: r.estado || '' };
  }, estado);

  chk(await pg.evaluate(() => typeof window.urbisNovedadReporte === 'function'),
      'el teléfono sabe comparar contra lo último que su dueño vio');

  // ── 1. La primera vez se anota en silencio ─────────────────────────────
  let r = await preguntar('Pendiente');
  chk(!!r && !r.nueva,
      'la primera vez que se mira un reporte NO se avisa nada: si no, tras actualizar salen diez avisos de reportes viejos');

  // ── 2. Pendiente → Aprobado sí se avisa ────────────────────────────────
  r = await preguntar('Aprobado');
  chk(!!r && r.nueva && r.estado === 'Aprobado',
      'cuando pasa de esperando a publicado, se avisa');

  // ── 3. Y se sigue avisando hasta que la persona lo cierre ──────────────
  /* Esta lista se repinta sola cada vez que llegan puntos del servidor. Un
     aviso que se apaga en el primer repintado es un aviso que la mitad de
     la gente no llega a leer. */
  r = await preguntar('Aprobado');
  chk(!!r && r.nueva,
      'y sigue ahí en el siguiente repintado: no se apaga solo antes de que la lean');

  const trasCerrar = await pg.evaluate(() => {
    // Devuelve el vacío cuando la pieza aún no existe: así esta suite se
    // puede correr contra la versión anterior y LEER qué falta.
    if (typeof window.urbisMarcarReporteVisto !== 'function') return null;
    window.urbisMarcarReporteVisto(6.2518);
    const r = window.urbisNovedadReporte(window.__fila('Aprobado'));
    return !!r.nueva;
  });
  chk(trasCerrar === false, 'al cerrarlo, se apaga y no vuelve' + (trasCerrar === null ? ' (no existe la función)' : ''));

  // ── 4. Lo que NO se celebra ────────────────────────────────────────────
  /* Volver a «Pendiente» ya se cuenta con la petición de corrección, que
     dice QUÉ arreglar. Un segundo aviso diciendo solo «cambió» no añade
     nada y compite con el que sí sirve. */
  const alReves = await pg.evaluate(() => {
    if (typeof window.urbisMarcarReporteVisto !== 'function') return null;
    window.urbisMarcarReporteVisto(6.2518);
    const a = window.urbisNovedadReporte(window.__fila('Pendiente'));
    return !!a.nueva;
  });
  chk(alReves === false,
      'volver a «esperando» no dispara un aviso propio: eso ya lo dice la petición de corrección, y con el detalle' +
      (alReves === null ? ' (no existe la función)' : ''));

  // ── 5. En la pantalla de verdad ────────────────────────────────────────
  const enPantalla = await pg.evaluate(async () => {
    if (typeof window.urbisRenderMisReportes !== 'function') return null;
    try { localStorage.removeItem('urbis_reportes_vistos_v1'); } catch (e) {}
    const antes = globalData.slice();
    globalData.length = 0; globalData.push(window.__fila('Pendiente'));
    if (window.UrbisMobileAppV58 && typeof window.UrbisMobileAppV58.show === 'function') window.UrbisMobileAppV58.show('timeline');
    window.urbisRenderMisReportes();                       // se anota: esperando
    await new Promise(r => setTimeout(r, 250));
    const c = document.getElementById('u52-timeline-content');
    const primeraVez = !!c.querySelector('.mis-rep-aprobado');

    globalData.length = 0; globalData.push(window.__fila('Aprobado'));  // lo aprobaron
    window.urbisRenderMisReportes();
    await new Promise(r => setTimeout(r, 250));
    const caja = c.querySelector('.mis-rep-aprobado');
    const tarjeta = c.querySelector('.mis-rep-card');
    const res = {
      primeraVez,
      hay: !!caja,
      visible: !!(caja && getComputedStyle(caja).display !== 'none'),
      texto: caja ? caja.textContent : '',
      arriba: !!(caja && tarjeta && tarjeta.firstElementChild === caja),
      marcada: !!(tarjeta && tarjeta.classList.contains('mis-rep-recien'))
    };
    // Y al cerrarlo desde el botón de verdad
    const btn = caja ? caja.querySelector('button') : null;
    if (btn) btn.click();
    await new Promise(r => setTimeout(r, 250));
    res.trasBoton = !!document.querySelector('#u52-timeline-content .mis-rep-aprobado');
    globalData.length = 0; antes.forEach(x => globalData.push(x));
    return res;
  });
  chk(!!(enPantalla && enPantalla.primeraVez === false),
      'al abrir la lista por primera vez no sale ningún aviso');
  chk(!!(enPantalla && enPantalla.hay && enPantalla.visible),
      'cuando lo aprueban, el aviso se ve en «Mis reportes»');
  chk(!!(enPantalla && /Ya está publicado/.test(enPantalla.texto)),
      'y dice lo que pasó en las palabras de la persona, no «estado: aprobado»');
  chk(!!(enPantalla && enPantalla.arriba && enPantalla.marcada),
      'va arriba de la tarjeta y la marca, como la petición de corrección');
  chk(!!(enPantalla && enPantalla.trasBoton === false),
      'y el botón de «Entendido» lo cierra de verdad');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
