const E = require('../entorno.js');
/* Lo que escribe una persona no es código.

   Un reporte lo escribe cualquiera y lo lee todo el mundo: el título, las
   notas, el barrio y el nombre del autor viajan en la fila y se pintan en el
   globo del mapa y en el detalle. Hasta acá entraban al HTML tal cual, así
   que un reporte con `<img src=x onerror=…>` en las notas ejecutaba código en
   el navegador de cualquiera que lo abriera. Y como la sesión vive en
   `localStorage`, eso no es una broma con un cartelito: es la cuenta.

   Lo que se comprueba, con una fila preparada que llega DESDE el servidor
   —que es como llegaría de verdad—:

     · que nada de lo que trae se ejecute, ni al pintar el globo ni al abrir
       el detalle;
     · que el texto se vea como texto, con sus signos, y no desaparezca;
     · que la latitud, que parece un número y llega como texto, no pueda
       meter código en los botones de editar, mover o borrar —`parseFloat`
       deja pasar `7.89');alert(1);//` tan tranquilo—;
     · y que la cédula y el correo de un reporte viejo no se pinten, ni
       siquiera para quien dice ser administrador: el rol sale del mismo
       `localStorage` que cualquiera edita desde la consola, así que «solo
       para el administrador» no era una condición, era una cortesía.      */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO;
const LEAFLET = S + 'node_modules/leaflet/dist/';
const C = { lat: 7.8939, lng: -72.5078 };

/* Las cargas. Cada una enciende una bandera distinta para poder decir CUÁL
   entró si alguna entra: «no se ejecutó nada» sin saber cuál es la mitad de
   una prueba. */
const CARGAS = {
  titulo:  '"><img src=x onerror="window.__x1=1">Calle 9',
  notas:   '<img src=x onerror="window.__x2=1">Hueco grande, ojo de noche',
  autor:   '<script>window.__x3=1<\/script>Pedro',
  barrio:  'La Playa<img src=x onerror="window.__x4=1">',
  lat:     "7.8939');window.__x5=1;('"
};
const CORREO_VIEJO = 'alguien@correo.com', CEDULA_VIEJA = '1090123456';

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  /* La sesión dice «admin» porque es justo lo que cualquiera puede escribir:
     el rol no lo firma nadie, sale de este mismo objeto. Si los datos
     privados se pintaran «solo para el administrador», acá saldrían. */
  await ctx.addInitScript(() => {
    if (window.top !== window) return;
    try {
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'quiensea', rol: 'admin',
        es_admin: true, session_token: 't', active: true, verified: true }));
      localStorage.removeItem('urbis_limpieza_sheetdb_v1');
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
  /* La fila preparada llega del servidor, como llegaría de verdad: alguien
     escribió eso en un reporte y la tabla se lee en abierto. */
  await ctx.route(/script\.google\.com/, r => {
    const cuerpo = r.request().postData() || '';
    if (/db_read/.test(cuerpo) || !cuerpo) {
      /* Junto a la fila preparada va una NULA, que es lo que deja una
         escritura cortada a la mitad. Antes bastaba una así para que el mapa
         entero saliera vacío: el `map` que arma `globalData` reventaba con
         ella y el error se perdía en el `catch` del final. */
      const datos = globalThis.__FILA ? [null, globalThis.__FILA] : [];
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: datos }) });
    }
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":[]}' });
  });

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 140)));
  await pg.goto(E.ESTATICO + '/index.html', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  // La descripción se arma DENTRO de la página, que es donde se sabe en qué
  // casilla va cada cosa.
  globalThis.__FILA = await pg.evaluate((D) => {
    const { CARGAS, CORREO_VIEJO, CEDULA_VIEJA, C } = D;
    const base = (typeof BASE_OFFSET === 'number') ? BASE_OFFSET
               : (6 + ((typeof todosLosUsos !== 'undefined' && todosLosUsos.length) || 0));
    const d = [];
    for (let i = 0; i < base + 10; i++) d.push('');
    d[0] = 'Hueco en la vía';
    d[1] = CARGAS.titulo;
    d[2] = CARGAS.notas;
    d[3] = 'Malo';
    d[base] = 'N/A';              // foto
    d[base + 1] = 'Aprobado';     // validación
    d[base + 2] = CARGAS.autor;   // autor
    d[base + 3] = 'citizen';      // rol
    d[base + 4] = '2';            // apoyos
    d[base + 5] = CORREO_VIEJO;   // correo, de los reportes viejos
    d[base + 6] = CEDULA_VIEJA;   // cédula, de los reportes viejos
    d[base + 7] = CARGAS.barrio;  // barrio
    return { tipo: '🚨 Alertas y Riesgos Urbanos', lat: CARGAS.lat, lng: String(C.lng),
             descripcion: d.join(' | '), fecha: new Date().toISOString() };
  }, { CARGAS, CORREO_VIEJO, CEDULA_VIEJA, C });

  /* Y se recarga con la fila ya puesta: la primera lectura de la aplicación
     ocurrió antes de que existiera y la dejó cacheada vacía, así que sin esto
     la prueba mediría una hoja sin reportes. */
  await pg.evaluate(() => { try { localStorage.removeItem('urbis_db_cache_v1'); } catch (e) {} });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  const r = await pg.evaluate(async (D) => {
    const { C, CARGAS } = D, o = {}, esperar = ms => new Promise(x => setTimeout(x, ms));
    window.map.setView([C.lat, C.lng], 16); await esperar(300);
    // Los puntos, traídos del «servidor».
    if (typeof window.urbisCargarPuntos === 'function') window.urbisCargarPuntos();
    for (let i = 0; i < 60; i++) {
      const n = (typeof globalData !== 'undefined' && globalData) ? globalData.length : 0;
      if (n > 0) break;
      await esperar(200);
    }
    o.filas = (typeof globalData !== 'undefined' && globalData) ? globalData.length : 0;
    const p = (typeof globalData !== 'undefined' && globalData || [])[0] || null;
    o.rolEfectivo = window.userRole || '';

    /* Y se pintan. Se pide el pintado a mano porque en el teléfono la
       aplicación lo hace cuando se entra a la pantalla del mapa, y acá se
       está midiendo lo que sale en el globo, no cuándo se dibuja. */
    try { pintarPuntos((window.urbisDatosVisibles && window.urbisDatosVisibles()) || []); } catch (e) {}
    await esperar(600);
    o.visibles = (window.urbisDatosVisibles && window.urbisDatosVisibles() || []).length;

    // El globo: se abre por el mismo camino que un dedo, tocando el marcador.
    let marcador = null;
    try {
      window.map.eachLayer(l => { if (!marcador && l && l.getLatLng) marcador = l; });
    } catch (e) {}
    o.hayMarcador = !!marcador;
    if (marcador) {
      try { marcador.openPopup(); } catch (e) { try { marcador.fire('click'); } catch (e2) {} }
      await esperar(600);
    }
    const globo = document.querySelector('.leaflet-popup-content');
    o.globoHTML = globo ? globo.innerHTML : '';
    o.globoTexto = globo ? (globo.textContent || '') : '';

    // Y el detalle, que es la otra pantalla donde se pinta lo mismo.
    if (p && typeof window.mostrarDetalles === 'function') { window.mostrarDetalles(p); await esperar(400); }
    const det = document.getElementById('info-content');
    o.detalleHTML = det ? det.innerHTML : '';
    o.detalleTexto = det ? (det.textContent || '') : '';

    await esperar(400);
    o.banderas = [1, 2, 3, 4, 5].map(n => !!window['__x' + n]);
    // ¿Quedó alguna etiqueta viva de las que traía la fila?
    const vivos = (raiz) => {
      if (!raiz) return { img: 0, script: 0 };
      return { img: raiz.querySelectorAll('img[onerror]').length,
               script: raiz.querySelectorAll('script').length };
    };
    o.vivosGlobo = vivos(globo);
    o.vivosDetalle = vivos(det);
    o.textoCompleto = (document.body.textContent || '');
    o.htmlCompleto = (document.body.innerHTML || '');
    return o;
  }, { C, CARGAS });

  await pg.close(); await b.close();

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };

  console.log('\n  -- la fila preparada llega y se pinta --');
  /* Una fila nula viene junto a ella: el mapa tiene que pintar la buena y
     saltarse la rota, no quedarse vacío. */
  T('el reporte llega del servidor y se dibuja, con una fila rota al lado',
    r.filas === 1 && r.visibles === 1 && r.hayMarcador === true,
    r.filas + ' fila(s) de 2 · ' + r.visibles + ' visible(s) · marcador: ' + r.hayMarcador);
  T('con el globo y el detalle abiertos', r.globoHTML.length > 20 && r.detalleHTML.length > 20,
    r.globoHTML.length + ' y ' + r.detalleHTML.length + ' caracteres');
  T('y la sesión inventada pasa por administrador, como pasaría de verdad',
    r.rolEfectivo === 'admin', 'rol efectivo: ' + r.rolEfectivo);

  console.log('\n  -- nada de lo que trae se ejecuta --');
  const cuales = r.banderas.map((v, i) => v ? '__x' + (i + 1) : null).filter(Boolean);
  T('ninguna de las cinco cargas corrió', cuales.length === 0, cuales.join(', ') || 'ninguna');
  T('no quedó ni una etiqueta viva en el globo',
    r.vivosGlobo.img === 0 && r.vivosGlobo.script === 0, JSON.stringify(r.vivosGlobo));
  T('ni en el detalle',
    r.vivosDetalle.img === 0 && r.vivosDetalle.script === 0, JSON.stringify(r.vivosDetalle));
  /* Escapado quiere decir dos cosas a la vez, y las dos hacen falta: que el
     signo salga escrito en el HTML y que el texto se siga leyendo entero. Un
     escapado que borra la nota también «evita el XSS», y de paso pierde lo
     que la persona escribió. */
  T('las notas se ven como texto, enteras',
    r.globoTexto.indexOf('Hueco grande, ojo de noche') >= 0 &&
    r.detalleTexto.indexOf('Hueco grande, ojo de noche') >= 0 &&
    r.detalleHTML.indexOf('&lt;img') >= 0,
    (r.detalleTexto.match(/<img[^>]*>Hueco grande[^.]*/) || ['—'])[0].slice(0, 60));
  T('y el título también, con sus comillas',
    r.detalleTexto.indexOf('Calle 9') >= 0 && r.globoTexto.indexOf('Calle 9') >= 0);

  console.log('\n  -- la latitud es texto, no un hueco --');
  /* `parseFloat("7.8939');window.__x5=1;('")` da 7.8939, así que la fila se
     dibuja igual y su latitud CRUDA entra en los botones de editar, mover y
     borrar. Lo que no puede es cerrar la cadena del manejador. */
  /* Lo que se mira no es que el texto no esté —está, es la latitud del
     reporte— sino que sus comillas lleguen escapadas: `\'` no cierra la
     cadena del manejador, `'` sí. */
  const botones = (r.htmlCompleto.match(/onclick="[^"]*7\.8939[^"]*"/g) || []);
  /* La comilla tiene que venir con su barra delante. Buscar el texto pelado
     no vale: `\');window…` lo contiene igual que `');window…`, así que la
     primera versión de esta prueba daba por rota una cadena que estaba bien
     cerrada. Lo que se busca es una comilla que NO venga escapada. */
  const abierta = b2 => /(^|[^\\])'\);window\.__x5/.test(b2);
  T('la latitud llega escapada a los botones y no cierra la cadena',
    r.banderas[4] === false && botones.length > 0 && !botones.some(abierta),
    botones.length + ' botón(es) · ' + botones.filter(abierta).length + ' con la cadena abierta');

  console.log('\n  -- la identidad de los reportes viejos --');
  /* La fila trae correo y cédula porque es anterior a v574. Que no se pinten
     no los borra de la hoja —eso hay que ir a limpiarlo— pero deja de
     regalarlos a cualquiera que se ponga «admin» en el navegador. */
  T('ni el correo ni la cédula salen en pantalla',
    r.textoCompleto.indexOf(CORREO_VIEJO) < 0 && r.textoCompleto.indexOf(CEDULA_VIEJA) < 0,
    r.textoCompleto.indexOf(CORREO_VIEJO) >= 0 ? 'sale el correo'
      : (r.textoCompleto.indexOf(CEDULA_VIEJA) >= 0 ? 'sale la cédula' : 'ninguno'));
  T('ni escondidos en el HTML',
    r.htmlCompleto.indexOf(CORREO_VIEJO) < 0 && r.htmlCompleto.indexOf(CEDULA_VIEJA) < 0);
  T('pero se avisa de que la fila los guarda, para ir a limpiarla',
    /todavía guarda cédula y correo/.test(r.detalleTexto),
    (r.detalleTexto.match(/Reporte antiguo[^.]*\./) || ['no lo dice'])[0].slice(0, 90));

  console.log('');
  const errFin = err.filter(e => !/L is not defined|Unexpected end/.test(e));
  T('sin errores de JavaScript', errFin.length === 0, errFin.slice(0, 2).join(' | ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' fallaron' : 'todo pasó'));
  process.exit(mal ? 1 : 0);
})();
