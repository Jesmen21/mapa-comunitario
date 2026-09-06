const E = require('../entorno.js');
/* Las cajas grises del pliego, como atajo.

   Llegó pedido así: «las cajas grises que salen en el análisis que no se han
   hecho, que sean el acceso rápido para analizar». Hasta ahora una caja gris
   era un botón apagado con «medí el terreno» al lado: decía qué faltaba y
   obligaba a ir a buscarlo a otra pestaña. La lista de «lo que hoy NO
   saldría en el pliego» ya tenía su botón; las cajas, que son lo que se
   mira al componer, no.

   Lo que se comprueba:

     · que cada caja gris que depende de una medición lleve la acción que la
       consigue, y siga siendo un botón —no `disabled`—;
     · que la que NO depende de medir —«el censo no tiene reparto por edades
       acá»— siga apagada, sin acción: tocarla no arreglaría nada;
     · que tocar una mida de verdad, por el mismo camino que el botón real:
       salta a la pestaña donde sale el resultado y, de vuelta en General, la
       caja ya no está gris;
     · que las compuestas pidan lo PRIMERO que falta y cambien cuando eso
       llega: «la cuadra del lote» pide el lote, y con el lote marcado pide
       el trazado;
     · y que la de lo intangible lleve a los lápices, porque eso no se mide:
       se marca.                                                             */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO;
const LEAFLET = S + 'node_modules/leaflet/dist/';
const C = { lat: 7.8939, lng: -72.5078 }, L = 0.004;
const POL = [{ lat: C.lat - L, lng: C.lng - L }, { lat: C.lat + L, lng: C.lng - L },
             { lat: C.lat + L, lng: C.lng + L }, { lat: C.lat - L, lng: C.lng + L }];
const GLAT = m => m / 110540, GLNG = m => m / (111320 * Math.cos(C.lat * Math.PI / 180));
const P = (dx, dy) => ({ lat: C.lat + GLAT(dy), lng: C.lng + GLNG(dx) });

let id = 1;
const nodo = (tags, dx, dy) => ({ type: 'node', id: id++, lat: P(dx, dy).lat, lon: P(dx, dy).lng, tags: tags });
const usos = [];
for (let i = 0; i < 8; i++) usos.push(nodo({ shop: 'clothes', name: 'Ropa ' + i }, -220 + i * 30, 120));
for (let i = 0; i < 5; i++) usos.push(nodo({ amenity: 'restaurant', name: 'Comida ' + i }, 60 + i * 40, -140));
for (let i = 0; i < 4; i++) usos.push(nodo({ amenity: 'school', name: 'Colegio ' + i }, -120 + i * 60, 280));
usos.push(nodo({ leisure: 'park', name: 'Parque Santander' }, 200, 200));

const via = (nombre, clase, pts) => ({ type: 'way', id: id++, tags: { highway: clase, name: nombre, lanes: '2' },
  geometry: pts.map(p => ({ lat: p.lat, lon: p.lng })) });
const edificio = (pts, pisos) => ({ type: 'way', id: id++,
  tags: { building: 'yes', 'building:levels': String(pisos) },
  geometry: pts.map(p => ({ lat: p.lat, lon: p.lng })) });
const geo = [
  via('Calle 7', 'residential', [P(-300, -300), P(-300, 0), P(-300, 300)]),
  via('Avenida 3', 'secondary', [P(-400, 0), P(0, 0), P(400, 0)]),
  via('Calle 9', 'residential', [P(0, -300), P(0, 0), P(0, 300)]),
  edificio([P(-60, -10), P(-40, -10), P(-40, 10), P(-60, 10), P(-60, -10)], 8),
  edificio([P(60, -60), P(90, -60), P(90, -30), P(60, -30), P(60, -60)], 3),
  edificio([P(120, 120), P(160, 120), P(160, 160), P(120, 160), P(120, 120)], 5)
];

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(() => {
    if (window.top !== window) return;
    try {
      localStorage.setItem('urbis_licencia_analisis', 'URBIS1.deprueba.deprueba');
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'urbisprocity', rol: 'admin', es_admin: true, session_token: 't', active: true, verified: true }));
      localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1');
    } catch (e) {} });
  await ctx.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
  await ctx.route(/unpkg\.com/, r => { const u = r.request().url();
    r.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
      body: fs.readFileSync(LEAFLET + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') }); });
  await ctx.route(/script\.google\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":[]}' }));
  await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: fs.readFileSync(S + 'node_modules/chart.js/dist/chart.umd.js', 'utf8') }));
  await ctx.route(/locationiq\.com/, r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ address: { city: 'Cúcuta', state: 'Norte de Santander', country: 'Colombia', suburb: 'La Playa' } }) }));
  await ctx.route(/overpass/, r => {
    const q = (r.request().postData() || '') + r.request().url();
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ elements: /out(\+|%20|\s)geom/.test(q) ? geo : usos }) });
  });
  await ctx.route(/ags\.esri\.co/, r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ features: [{ attributes: { TOTAL: 3045, N: 42 } }] }) }));
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r => {
    const u = new URL(r.request().url());
    const lngs = (u.searchParams.get('longitude') || '').split(',').map(Number);
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ elevation: lngs.map((lng, i) => 300 + i * 4) }) });
  });

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  const r = await pg.evaluate(async (D) => {
    const { C, POL } = D, o = {}, esperar = ms => new Promise(r => setTimeout(r, ms));
    const GLAT = m => m / 110540, GLNG = m => m / (111320 * Math.cos(C.lat * Math.PI / 180));
    const Q = (dx, dy) => ({ lat: C.lat + GLAT(dy), lng: C.lng + GLNG(dx) });
    window.URBIS_CONFIG.ANALISIS.API = window.__URBIS_MOTOR;
    window.map.setView([C.lat, C.lng], 15); await esperar(500);
    const A = window.URBIS_PC_ANALISIS, R = window.URBIS_PC_RECON;

    const bPC = document.querySelector('[data-u52-call="procity-open-map"]');
    if (bPC) { bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p => A.agregarPunto(p.lat, p.lng)); A.agregarPunto(POL[0].lat, POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H = () => document.getElementById('pcr-hoja');
    const abrir = async () => { const a = H().querySelector('[data-pcr="agrandar"]');
      if (a) { a.click(); await esperar(450); } };
    const tocar = async (t) => { const b2 = H().querySelector('[data-pcr="pestana"][data-t="' + t + '"]');
      if (b2) { b2.click(); await esperar(350); } return !!b2; };
    const caja = id2 => H().querySelector('[data-pcr="pliego-caja"][data-c="' + id2 + '"]');
    const estado = id2 => { const x = caja(id2); return x ? {
      gris: x.classList.contains('pcr-capa-gris'), pide: x.getAttribute('data-pide') || '',
      disabled: x.disabled, on: x.classList.contains('on'),
      pie: ((x.querySelector('small') || {}).textContent || '').trim() } : null; };
    const grises = () => [...H().querySelectorAll('[data-pcr="pliego-caja"].pcr-capa-gris')].map(x => ({
      id: x.getAttribute('data-c'), pide: x.getAttribute('data-pide') || '', disabled: x.disabled,
      falta: ((x.querySelector('small') || {}).textContent || '').trim() }));

    await abrir();
    o.pestanaAlEntrar = R.pestanaActual();
    o.grises = grises();
    o.pista = ((H().querySelector('.pcr-tab[data-tab="general"]') || H()).textContent || '')
      .indexOf('tocá una y se hace ahí mismo') >= 0;

    /* Las capas del mapa, que son las primeras grises que se ven en General,
       llevan la misma regla que las cajas del pliego. */
    const capa = id2 => H().querySelector('[data-pcr="capa"][data-c="' + id2 + '"]');
    const estadoCapa = id2 => { const x = capa(id2); return x ? {
      gris: x.classList.contains('pcr-capa-gris'), pide: x.getAttribute('data-pide') || '',
      disabled: x.disabled, on: x.classList.contains('on') } : null; };
    o.capasGrises = [...H().querySelectorAll('[data-pcr="capa"].pcr-capa-gris')].map(x => ({
      id: x.getAttribute('data-c'), pide: x.getAttribute('data-pide') || '', disabled: x.disabled,
      falta: ((x.querySelector('small') || {}).textContent || '').trim() }));

    // ── 1. El terreno, desde la CAPA gris de las curvas de nivel.
    o.terrenoAntes = estado('el-terreno');
    o.curvasAntes = estadoCapa('curvas');
    if (capa('curvas')) capa('curvas').click();
    for (let i = 0; i < 70 && !document.querySelector('.pcr-corte'); i++) await esperar(400);
    await esperar(400);
    o.trasTerreno = { pestana: R.pestanaActual(), corte: !!document.querySelector('.pcr-corte') };
    await tocar('general');
    o.terrenoDespues = estado('el-terreno');
    o.curvasDespues = estadoCapa('curvas');

    // ── 2. El lote, desde la suya. La cuadra, que pide «lote y trazado»,
    //      tiene que pedir primero el lote.
    o.cuadraAntes = estado('la-cuadra-del-lote');
    o.loteAntes = estado('el-lote-a-intervenir');
    if (caja('el-lote-a-intervenir')) caja('el-lote-a-intervenir').click();
    await esperar(600);
    o.barraDelLote = !!document.querySelector('[data-lote="cerrar"]');
    [Q(-25, -20), Q(25, -20), Q(25, 20), Q(-25, 20)].forEach(p => window.map.fire('click', { latlng: { lat: p.lat, lng: p.lng } }));
    await esperar(400);
    const cerrar = document.querySelector('[data-lote="cerrar"]');
    if (cerrar) cerrar.click();
    await esperar(900);
    await abrir();
    o.trasLote = { pestana: R.pestanaActual() };
    await tocar('general');
    o.loteDespues = estado('el-lote-a-intervenir');
    o.cuadraConLote = estado('la-cuadra-del-lote');

    // ── 3. El trazado, desde la cuadra. Cinco segundos desde la última
    //      consulta a Overpass, que fue la del análisis.
    await esperar(5200);
    if (caja('la-cuadra-del-lote')) caja('la-cuadra-del-lote').click();
    for (let i = 0; i < 70 && !document.querySelector('.pcr-llenos'); i++) await esperar(400);
    await esperar(600);
    o.trasTrazado = { pestana: R.pestanaActual(), llenos: !!document.querySelector('.pcr-llenos') };
    await tocar('general');
    o.llenosDespues = estado('llenos-y-vacios');
    o.cuadraDespues = estado('la-cuadra-del-lote');

    // ── 4. Lo intangible: a los lápices.
    o.intAntes = estado('lo-intangible');
    if (caja('lo-intangible')) caja('lo-intangible').click();
    await esperar(450);
    o.trasInt = { pestana: R.pestanaActual(),
      lapices: H().querySelectorAll('.pcr-tab[data-tab="gente"]:not([hidden]) [data-pcr="int-dibujar"]').length };

    o.err = [];
    return o;
  }, { C, POL });
  r.err = err;
  await pg.close(); await b.close();

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };
  const g = r.grises || [];
  const conAccion = g.filter(x => /^(medí|pedí|leé|marcá|compará|analizá)/.test(x.falta));
  const sinAccion = g.filter(x => /^(no hay|el censo|no queda)/.test(x.falta));

  console.log('\n  -- cada caja gris lleva lo que la consigue --');
  T('recién analizado, hay cajas grises', g.length >= 10, g.length + ' grises');
  T('las que dependen de una medición traen su acción y siguen siendo botón',
    conAccion.length >= 8 && conAccion.every(x => x.pide && !x.disabled),
    conAccion.map(x => x.id + '→' + (x.pide || '∅') + (x.disabled ? ' (apagada)' : '')).join(' · '));
  T('y dicen que se toca', conAccion.every(x => /tocá acá y/.test(x.falta)),
    (conAccion.filter(x => !/tocá acá y/.test(x.falta)).map(x => x.id).join(', ') || 'todas'));
  T('la que no depende de medir sigue apagada, sin acción',
    sinAccion.length >= 1 && sinAccion.every(x => !x.pide && x.disabled),
    sinAccion.map(x => x.id + (x.pide ? '→' + x.pide : '') + (x.disabled ? '' : ' (prendida)')).join(' · ') || 'no hay ninguna');
  T('la pista del bloque lo dice', r.pista === true);
  const pide = (id2) => (g.filter(x => x.id === id2)[0] || {}).pide || '';
  T('el terreno pide medir el terreno', pide('el-terreno') === 'terreno', pide('el-terreno'));
  T('el clima, el clima; la foto, leerla',
    pide('el-clima') === 'clima' && pide('cobertura-del-suelo') === 'cobertura',
    pide('el-clima') + ' · ' + pide('cobertura-del-suelo'));
  T('los llenos y vacíos, el trazado', pide('llenos-y-vacios') === 'trazado', pide('llenos-y-vacios'));
  T('el lote, marcarlo', pide('el-lote-a-intervenir') === 'lote-dibujar', pide('el-lote-a-intervenir'));
  T('la cuadra —lote Y trazado— pide primero el lote',
    !!r.cuadraAntes && r.cuadraAntes.pide === 'lote-dibujar', r.cuadraAntes && r.cuadraAntes.pide);

  console.log('\n  -- las capas del mapa, con la misma regla --');
  const cg = r.capasGrises || [];
  T('las capas grises que dependen de medir traen su acción y siguen siendo botón',
    cg.length >= 4 && cg.filter(x => /^(medí|marcá)/.test(x.falta)).every(x => x.pide && !x.disabled),
    cg.map(x => x.id + '→' + (x.pide || '∅') + (x.disabled ? ' (apagada)' : '')).join(' · '));
  T('las curvas de nivel piden el terreno; los llenos, el trazado',
    (cg.filter(x => x.id === 'curvas')[0] || {}).pide === 'terreno' &&
    (cg.filter(x => x.id === 'llenos')[0] || {}).pide === 'trazado');

  console.log('\n  -- tocarla mide, por el camino del botón real --');
  T('el terreno estaba gris, en la caja del pliego y en la capa del mapa',
    !!r.terrenoAntes && r.terrenoAntes.gris && !r.terrenoAntes.disabled &&
    !!r.curvasAntes && r.curvasAntes.gris && !r.curvasAntes.disabled && r.curvasAntes.pide === 'terreno');
  T('tocar la capa gris de las curvas mide el terreno', !!r.trasTerreno && r.trasTerreno.corte === true);
  T('y la capa deja de estar gris', !!r.curvasDespues && !r.curvasDespues.gris && !r.curvasDespues.pide,
    JSON.stringify(r.curvasDespues));
  T('y salta a Ambiente, donde sale', !!r.trasTerreno && r.trasTerreno.pestana === 'ambiente', r.trasTerreno && r.trasTerreno.pestana);
  T('de vuelta en General, la caja ya no está gris y quedó puesta',
    !!r.terrenoDespues && !r.terrenoDespues.gris && r.terrenoDespues.on && !r.terrenoDespues.pide,
    JSON.stringify(r.terrenoDespues));

  console.log('\n  -- el lote --');
  T('tocar la caja del lote abre la barra de dibujo', r.barraDelLote === true);
  T('marcado, la ficha queda en El lote', !!r.trasLote && r.trasLote.pestana === 'lote', r.trasLote && r.trasLote.pestana);
  T('y la caja del lote ya no está gris', !!r.loteDespues && !r.loteDespues.gris, JSON.stringify(r.loteDespues));
  T('con el lote marcado, la cuadra pide lo que sigue: el trazado',
    !!r.cuadraConLote && r.cuadraConLote.gris && r.cuadraConLote.pide === 'trazado', JSON.stringify(r.cuadraConLote));

  console.log('\n  -- el trazado, desde la cuadra --');
  T('tocarla mide el trazado', !!r.trasTrazado && r.trasTrazado.llenos === true);
  T('y salta a Forma urbana', !!r.trasTrazado && r.trasTrazado.pestana === 'forma', r.trasTrazado && r.trasTrazado.pestana);
  T('los llenos y vacíos dejaron de estar grises', !!r.llenosDespues && !r.llenosDespues.gris, JSON.stringify(r.llenosDespues));
  T('y la cuadra también', !!r.cuadraDespues && !r.cuadraDespues.gris, JSON.stringify(r.cuadraDespues));

  console.log('\n  -- lo intangible se marca, no se mide --');
  T('la caja lleva a los lápices', !!r.intAntes && r.intAntes.pide === 'int-dibujar', r.intAntes && r.intAntes.pide);
  T('tocarla abre Gente y usos con los lápices a la vista',
    !!r.trasInt && r.trasInt.pestana === 'gente' && r.trasInt.lapices >= 3, JSON.stringify(r.trasInt));

  console.log('');
  T('sin errores de JavaScript', r.err.length === 0, r.err.join(' | ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' fallaron' : 'todo pasó'));
  process.exit(mal ? 1 : 0);
})();
