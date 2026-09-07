const E = require('../entorno.js');
/* El vendaval, que no es la tormenta.

   En el catálogo de reportes había ciclón, tormenta, tsunami, sismo,
   derrumbe y creciente, pero no vendaval. Quien acaba de ver el viento
   llevarse un techo de zinc no encuentra su palabra y termina eligiendo
   «Tormenta», que en el mapa es otro fenómeno —con lluvia— y con vigencia
   de dos días: el aviso sigue en pantalla cuando hace rato escampó.

   Lo que se comprueba, con un reporte de vendaval y otro de tormenta puestos
   uno al lado del otro:

     · que el vendaval exista en el catálogo, con su emoji y en la dimensión
       del clima, y que la dimensión lo ofrezca (de ahí lo lee el formulario
       clásico);
     · que tenga vigencia PROPIA —doce horas— y que la tormenta siga con las
       suyas: si compartieran número, no haría falta el ítem;
     · que en el mapa salga como alerta de escala nacional, con su emoji y
       con la clase raíz que sobrevive al alejar —una gota que se esconde
       bajo el zoom 14 no le sirve a quien mira la región entera—;
     · y que pregunte por víctimas, porque una lámina de zinc en el aire
       hiere gente.                                                        */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO;
const LEAFLET = S + 'node_modules/leaflet/dist/';
const C = { lat: 7.8939, lng: -72.5078 };
const ahora = new Date().toISOString();

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    if (window.top !== window) return;
    try {
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'urbisadmin', rol: 'admin',
        es_admin: true, permisos: 'moderar', session_token: 't', active: true, verified: true }));
      localStorage.removeItem('urbis_db_cache_v1');
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
  await ctx.route(/script\.google\.com/, r => {
    const cuerpo = r.request().postData() || '';
    if (/db_read/.test(cuerpo) || !cuerpo) {
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: (globalThis.__DATOS || []) }) });
    }
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":[]}' });
  });

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 140)));
  await pg.goto(E.ESTATICO + '/index.html', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  /* Dos reportes iguales en todo salvo el fenómeno, a cien metros uno del
     otro: así lo que salga distinto en el mapa es el ítem y no otra cosa. */
  const filas = await pg.evaluate((D) => {
    const base = (typeof BASE_OFFSET === 'number') ? BASE_OFFSET
               : (6 + ((typeof todosLosUsos !== 'undefined' && todosLosUsos.length) || 0));
    const armar = (item, lat) => {
      const d = [];
      for (let i = 0; i < base + 10; i++) d.push('');
      d[0] = item; d[1] = 'Barrio La Playa'; d[2] = 'Se llevó los techos de la cuadra'; d[3] = 'Malo';
      d[base] = 'N/A'; d[base + 1] = 'Aprobado'; d[base + 2] = 'Vecina'; d[base + 3] = 'citizen'; d[base + 4] = '0';
      return { tipo: '🌪️ Desastres Naturales y Clima', lat: String(lat), lng: String(D.C.lng),
               descripcion: d.join(' | '), fecha: D.ahora };
    };
    return [armar('Vendaval / vientos fuertes', D.C.lat), armar('Tormenta', D.C.lat + 0.001)];
  }, { C, ahora });
  globalThis.__DATOS = filas;

  await pg.evaluate(() => { try { localStorage.removeItem('urbis_db_cache_v1'); } catch (e) {} });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  const r = await pg.evaluate(async (D) => {
    const { C } = D, o = {}, esperar = ms => new Promise(x => setTimeout(x, ms));
    /* Al mapa por donde se entra: el botón «Reportar» de la portada. Las
       alertas de escala nacional viven en una capa propia (js/50) que solo se
       monta dentro del módulo de reportes, así que mirarlas desde la portada
       sería mirar donde no están. */
    const irAlMapa = document.querySelector('[data-u52-go="map"]');
    if (irAlMapa) irAlMapa.click();
    await esperar(900);
    o.pantalla = (document.querySelector('.u52-screen.active') || {}).dataset
      ? document.querySelector('.u52-screen.active').getAttribute('data-u52-screen') : '—';
    window.map.setView([C.lat, C.lng], 16); await esperar(300);
    if (typeof window.urbisCargarPuntos === 'function') window.urbisCargarPuntos();
    /* Su capa se repinta sola cada tres segundos y medio; se espera a que le
       toque, en vez de llamarla a mano. */
    await esperar(4200);

    // ── El catálogo, que es la única fuente de verdad ──────────────────
    const cat = window.URBIS_QUICK_REPORTS || {};
    o.ficha = cat.windstorm ? { icon: cat.windstorm.icon, label: cat.windstorm.label,
                                dim: cat.windstorm.dim, seccion: cat.windstorm.section } : null;
    // Y una sola vez: dos tuplas con el mismo id se pisan sin avisar.
    o.cuantosVendaval = Object.values(cat)
      .filter(x => /vendaval/i.test(String(x.label || ''))).length;
    o.enSeccion = ((window.URBIS_QUICK_REPORT_SECTIONS || [])
      .find(s => s.id === 'natural') || { items: [] }).items
      .some(t => t[0] === 'windstorm');
    // La dimensión es de donde saca sus opciones el formulario clásico.
    o.enDimension = ((typeof dimensiones !== 'undefined' && dimensiones['🌪️ Desastres Naturales y Clima']) || {})
      .items || [];

    // ── Vigencia propia ───────────────────────────────────────────────
    const horas = t => (typeof window.urbisHorasAlertaNacional === 'function')
      ? window.urbisHorasAlertaNacional(t) : -1;
    o.horas = {
      vendaval: horas('Vendaval / vientos fuertes'),
      corto: horas('Vendaval'),          // como lo escribiría un registro viejo
      tormenta: horas('Tormenta'),
      lluvia: horas('Riesgo por lluvia')
    };
    o.preguntaVictimas = (typeof window.urbisPreguntaPorVictimas === 'function')
      ? window.urbisPreguntaPorVictimas('Vendaval / vientos fuertes') : 'no existe';

    // ── En el mapa ────────────────────────────────────────────────────
    /* Se busca por la gota: qué clase raíz lleva y qué dibuja adentro. La
       clase importa tanto como el emoji —css/30 esconde toda gota normal
       por debajo del zoom 14, y esa es la única que no toca—. */
    const gotas = [];
    const recorrer = (capa, prof) => {
      try {
        capa.eachLayer && capa.eachLayer(hija => {
          const ic = hija && hija.options && hija.options.icon && hija.options.icon.options;
          if (ic && ic.html) {
            const ll = (typeof hija.getLatLng === 'function') ? hija.getLatLng() : null;
            gotas.push({ clase: String(ic.className || ''), html: String(ic.html),
                         lat: ll ? Number(ll.lat.toFixed(4)) : null });
          }
          if (prof < 3) recorrer(hija, prof + 1);
        });
      } catch (e) { o.errGotas = String(e.message); }
    };
    recorrer(window.map, 0);
    const cerca = (a, b) => Math.abs(a - b) < 0.0004;
    o.gotaVendaval = gotas.find(g => cerca(g.lat, Number(C.lat.toFixed(4)))) || null;
    o.gotaTormenta = gotas.find(g => cerca(g.lat, Number((C.lat + 0.001).toFixed(4)))) || null;
    return o;
  }, { C });

  await pg.close(); await b.close();

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };
  const f = r.ficha || {}, h = r.horas || {};

  console.log('\n  -- el vendaval existe y está donde lo van a buscar --');
  T('el catálogo tiene el vendaval, con su emoji y en el clima',
    f.icon === '🌬️' && /vendaval/i.test(String(f.label || '')) &&
    /Desastres Naturales y Clima/.test(String(f.dim || '')),
    JSON.stringify(r.ficha));
  T('y una sola vez: dos ítems con el mismo nombre se pisan sin avisar',
    r.cuantosVendaval === 1, String(r.cuantosVendaval));
  T('sale en la sección de desastres, que es donde lo busca quien lo vivió',
    r.enSeccion === true && f.seccion === 'natural', String(f.seccion));
  T('y la dimensión del clima lo ofrece, junto a la tormenta',
    (r.enDimension || []).some(x => /vendaval/i.test(x)) &&
    (r.enDimension || []).some(x => /^Tormenta$/.test(x)),
    (r.enDimension || []).join(', '));

  console.log('\n  -- con vigencia propia: un vendaval se agota en horas --');
  T('el vendaval dura doce horas', h.vendaval === 12, h.vendaval + ' h');
  T('y un registro viejo que solo diga «Vendaval» dura lo mismo',
    h.corto === 12, h.corto + ' h');
  /* Si copiara las horas de la tormenta, el ítem nuevo no cambiaría nada de
     lo que importa: el aviso seguiría en el mapa dos días después. */
  T('y no es lo mismo que la tormenta ni que el riesgo por lluvia',
    h.tormenta === 48 && h.lluvia === 24 && h.vendaval > 0 && h.vendaval < h.lluvia,
    'tormenta ' + h.tormenta + ' h · lluvia ' + h.lluvia + ' h');
  T('pregunta por víctimas, como la tormenta y el sismo',
    r.preguntaVictimas === true, String(r.preguntaVictimas));

  console.log('\n  -- y en el mapa se ve como lo que es --');
  const gv = r.gotaVendaval || {}, gt = r.gotaTormenta || {};
  T('el vendaval sale con la gota de alerta, no con la genérica',
    /urbis-alerta-root/.test(String(gv.clase || '')), gv.clase || 'sin gota');
  T('y lleva su emoji, no el ⚠️ de «no sé qué es esto»',
    /🌬️/.test(String(gv.html || '')) && !/⚠️/.test(String(gv.html || '')),
    (String(gv.html || 'sin gota').match(/al-emoji">[^<]*</) || ['—'])[0]);
  T('la tormenta, al lado, sigue saliendo con la suya',
    /urbis-alerta-root/.test(String(gt.clase || '')) && /⛈️/.test(String(gt.html || '')),
    (String(gt.html || 'sin gota').match(/al-emoji">[^<]*</) || ['—'])[0]);

  console.log('');
  const errFin = err.filter(e => !/L is not defined|Unexpected end/.test(e));
  T('sin errores de JavaScript', errFin.length === 0, errFin.slice(0, 2).join(' | ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' fallaron' : 'todo pasó'));
  process.exit(mal ? 1 : 0);
})();
