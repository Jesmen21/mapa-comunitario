const E = require('../entorno.js');
/* La ficha del sector, repartida en pestañas.

   Llegó dicho así: «cuando se hace el análisis se hace una lista larguísima
   de muchas cosas y mucho texto y muchos gráficos, y uno tiene que bajar y
   bajar y bajar. Creo yo que deberíamos empezar a manejar un tema de
   pestañas que agilicen el acceso a cada tema». Y con una segunda parte:
   «una pestaña en general para activar y desactivar capas de análisis en el
   mapa […] y que te diga, aún falta hacer este análisis para que salga en el
   PDF, como hay tanto texto, tanta cosa, uno por estar buscando y buscando
   no activa un análisis y no sale en el PDF».

   Lo que se comprueba acá:

     · que las pestañas existan, con los nombres de las bandas del pliego, y
       que solo se vea una a la vez —si se ven todas, no se repartió nada—;
     · que cada tema esté en la suya y no en la de al lado;
     · que la primera sea el tablero de mandos: las capas del mapa y lo que
       falta para que el pliego salga completo;
     · que cada cosa que falta traiga el botón que la consigue, y que tocarlo
       lleve a la pestaña donde aparece el resultado;
     · y que la cuenta de lo que falta se vea en la propia pestaña, sin
       entrar, que es de lo que se trataba.                                  */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO, LEAFLET = S + 'node_modules/leaflet/dist/';
const C = { lat: 7.8939, lng: -72.5078 }, L = 0.003;
const POL = [{ lat: C.lat - L, lng: C.lng - L }, { lat: C.lat + L, lng: C.lng - L },
             { lat: C.lat + L, lng: C.lng + L }, { lat: C.lat - L, lng: C.lng + L }];
const usos = []; let id = 1;
for (let i = 0; i < 60; i++) { const a = i * 6 * Math.PI / 180, d = (110 + (i % 6) * 55) / 111320;
  usos.push({ type: 'node', id: id++, lat: C.lat + Math.cos(a) * d, lon: C.lng + Math.sin(a) * d,
    tags: { name: 'U' + i, amenity: ['pharmacy', 'restaurant', 'school', 'bank', 'bar'][i % 5] } }); }
const cotaDe = ln => 300 + Math.round(40 * Math.sin(ln * 900));

const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 412, height: 915 },
    isMobile: true, hasTouch: true, locale: 'es-CO', timezoneId: 'America/Bogota' });
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(() => {
    if (window.top !== window) return;
    try {
      localStorage.setItem('urbis_licencia_analisis', 'URBIS1.deprueba.deprueba');
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'u', rol: 'admin',
        es_admin: true, session_token: 't', active: true, verified: true }));
      localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1');
    } catch (e) {}
  });
  await ctx.route('**', r => {
    const u = r.request().url();
    if (/localhost:(8199|8787)/.test(u)) return r.continue();
    if (/unpkg\.com/.test(u)) return r.fulfill({ status: 200,
      contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
      body: fs.readFileSync(LEAFLET + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') });
    if (/overpass/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ elements: usos }) });
    if (/locationiq/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ address: { city: 'Cúcuta', state: 'Norte de Santander' } }) });
    if (/ags\.esri\.co/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ features: [{ attributes: { TOTAL: 3045, N: 42 } }] }) });
    if (/elevation/.test(u)) { const q = new URL(u).searchParams;
      const lngs = (q.get('longitude') || q.get('locations') || '').split(/[,|]/);
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ elevation: lngs.map(x => cotaDe(Number(x) || -72.5)) }) }); }
    if (/script\.google\.com/.test(u)) return r.fulfill({ status: 200,
      contentType: 'application/json', body: '{"ok":true,"data":[]}' });
    if (/cdn\.jsdelivr\.net/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
    r.abort();
  });
  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 120)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  const r = await pg.evaluate(async (D) => {
    const { C, POL } = D, o = {}, esperar = ms => new Promise(x => setTimeout(x, ms));
    window.URBIS_CONFIG.ANALISIS.API = window.__URBIS_MOTOR;
    window.map.setView([C.lat, C.lng], 15); await esperar(400);
    const A = window.URBIS_PC_ANALISIS, R = window.URBIS_PC_RECON;
    const bPC = document.querySelector('[data-u52-call="procity-open-map"]');
    if (bPC) { bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p => A.agregarPunto(p.lat, p.lng)); A.agregarPunto(POL[0].lat, POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);
    const H = () => document.getElementById('pcr-hoja');
    const asa = H().querySelector('[data-pcr="agrandar"]'); if (asa) { asa.click(); await esperar(400); }

    const tabs = () => [...H().querySelectorAll('.pcr-tab-b')];
    o.nombres = tabs().map(x => (x.querySelector('span') || {}).textContent || '');
    o.activa = (tabs().filter(x => x.classList.contains('activa'))[0] || {}).textContent || '';
    o.abiertas = [...H().querySelectorAll('.pcr-tab')].filter(x => !x.hidden)
      .map(x => x.getAttribute('data-tab'));
    o.total = H().querySelectorAll('.pcr-tab').length;

    /* Dónde vive cada tema. Se busca el título dentro de su sección y no en
       la ficha entera: la gracia de repartir es que cada cosa esté en un solo
       sitio. */
    const enPestana = (id, texto) => {
      const sec = H().querySelector('[data-tab="' + id + '"]');
      return !!sec && (sec.textContent || '').indexOf(texto) >= 0;
    };
    o.donde = {
      generalCapas: enPestana('general', 'Capas'),
      generalFalta: enPestana('general', 'Lo que hoy NO saldría en el pliego'),
      gentePoblacion: enPestana('gente', 'Cuánta gente vive'),
      gentaCategorias: enPestana('gente', 'Qué hay, por categoría'),
      sitioRumbos: enPestana('sitio', 'A dónde ir'),
      sintesis: enPestana('sintesis', 'Síntesis del sector')
    };
    // Y que no estén DUPLICADOS en otra pestaña.
    o.poblacionSoloEnGente = ['general', 'sitio', 'ambiente', 'movilidad', 'forma', 'lote', 'sintesis']
      .every(p => !enPestana(p, 'Cuánta gente vive'));

    /* La tira de mapas de cada pestaña: el pliego asomándose. Se lee dentro
       de su sección, arriba del todo, con un dibujo por recuadro. */
    const tira = (id2) => { const sec = H().querySelector('.pcr-tab[data-tab="' + id2 + '"]');
      const fig = sec ? [...sec.querySelectorAll('.pcr-tira .pcr-tira-i')] : [];
      return { n: fig.length, svg: fig.filter(f => f.querySelector('svg')).length,
               titulos: fig.map(f => ((f.querySelector('figcaption') || {}).textContent || '').trim()),
               arriba: !!sec && !!sec.firstElementChild && sec.firstElementChild.classList.contains('pcr-tira') }; };
    o.tiras = { general: tira('general'), sitio: tira('sitio'), ambiente: tira('ambiente'),
                movilidad: tira('movilidad'), gente: tira('gente'), sintesis: tira('sintesis') };

    // Lo que falta para el pliego, con su botón.
    const pend = [...H().querySelectorAll('.pcr-pend-i')];
    o.pendientes = pend.map(x => {
      const bt = x.querySelector('button');
      return { que: ((x.querySelector('b') || {}).textContent || '').trim(),
               accion: bt ? (bt.getAttribute('data-pcr') || '') : '' };
    });
    o.marcas = tabs().map(x => ({
      t: ((x.querySelector('span') || {}).textContent || ''),
      n: Number(((x.querySelector('.pcr-tab-pend') || {}).textContent || '0')) }))
      .filter(x => x.n > 0);

    // Cambiar de pestaña: se toca y se cambia lo que se ve.
    const tocar = async (nombre) => {
      const b2 = tabs().filter(x => ((x.querySelector('span') || {}).textContent || '') === nombre)[0];
      if (!b2) return false;
      b2.click(); await esperar(350); return true;
    };
    o.tocoMovilidad = await tocar('Movilidad');
    o.trasTocar = [...H().querySelectorAll('.pcr-tab')].filter(x => !x.hidden)
      .map(x => x.getAttribute('data-tab'));
    o.veMovilidad = /Cómo se llega/.test((H().querySelector('[data-tab="movilidad"]') || {}).textContent || '');

    /* Y el atajo que de verdad se pidió: tocar «hacerlo» en algo que falta
       mide Y deja la ficha donde sale el resultado. El terreno es el más
       claro: se pide en General y la topografía vive en Ambiente. */
    await tocar('General');
    const bTerreno = [...H().querySelectorAll('.pcr-pend-i button')]
      .filter(x => x.getAttribute('data-pcr') === 'terreno')[0];
    o.hayBotonTerreno = !!bTerreno;
    if (bTerreno) {
      bTerreno.click();
      for (let i = 0; i < 70 && !document.querySelector('.pcr-corte'); i++) await esperar(400);
      await esperar(300);
    }
    o.trasMedirTerreno = R.pestanaActual();
    o.terrenoMedido = !!document.querySelector('.pcr-corte');
    o.terrenoEnAmbiente = /Curvas de nivel|corte/i.test(
      (H().querySelector('[data-tab="ambiente"]') || {}).textContent || '');
    o.pendientesTras = H().querySelectorAll('.pcr-pend-i').length;
    // Y la tira de Ambiente ya trae el terreno, como va a salir.
    o.tiraAmbienteTras = tira('ambiente');
    return o;
  }, { C, POL });
  await pg.close(); await b.close();

  console.log('\n  -- la ficha se reparte --');
  const ESPERADAS = ['General', 'El sitio', 'Ambiente', 'Movilidad', 'Gente y usos', 'Forma urbana', 'Síntesis'];
  T('hay una pestaña por tema, con los nombres de las bandas del pliego',
    ESPERADAS.every(n => (r.nombres || []).indexOf(n) >= 0),
    (r.nombres || []).join(' · '));
  T('y se ve UNA sola a la vez', (r.abiertas || []).length === 1 && r.total >= 6,
    (r.abiertas || []).join(',') + ' abierta de ' + r.total);
  T('la primera es General, que es el tablero de mandos', /General/.test(r.activa || ''), r.activa);

  console.log('\n  -- cada tema en la suya --');
  const d = r.donde || {};
  T('las capas del mapa, en General', d.generalCapas);
  T('la población y las categorías, en Gente y usos', d.gentePoblacion && d.gentaCategorias);
  T('los rumbos, en El sitio', d.sitioRumbos);
  T('la síntesis, en la suya', d.sintesis);
  T('y nada se repite en dos pestañas', r.poblacionSoloEnGente);

  console.log('\n  -- lo que falta para el pliego --');
  T('General dice qué no saldría en el PDF', d.generalFalta);
  T('con un renglón por cosa y su botón',
    (r.pendientes || []).length >= 3 && (r.pendientes || []).every(x => x.que && x.accion),
    (r.pendientes || []).map(x => x.que + '→' + x.accion).join(' · '));
  T('el terreno está entre lo que falta', (r.pendientes || []).some(x => x.accion === 'terreno'));
  /* La cuenta va en la propia pestaña: enterarse SIN entrar es de lo que se
     trataba —«uno por estar buscando y buscando no activa un análisis»—. */
  T('y cada pestaña lleva la cuenta de lo suyo', (r.marcas || []).length >= 1,
    (r.marcas || []).map(x => x.t + ':' + x.n).join(' · ') || 'ninguna marcada');

  console.log('\n  -- se cambia de pestaña, y medir lleva al resultado --');
  T('tocar «Movilidad» cambia lo que se ve',
    r.tocoMovilidad && (r.trasTocar || []).join() === 'movilidad' && r.veMovilidad,
    (r.trasTocar || []).join(','));
  T('tocar «hacerlo» en el terreno lo mide', r.hayBotonTerreno && r.terrenoMedido);
  T('y deja la ficha en Ambiente, donde sale la topografía',
    r.trasMedirTerreno === 'ambiente' && r.terrenoEnAmbiente, 'quedó en «' + r.trasMedirTerreno + '»');
  T('y esa deja de estar en la lista de lo que falta',
    r.pendientesTras < (r.pendientes || []).length,
    (r.pendientes || []).length + ' → ' + r.pendientesTras);

  /* «En cada pestaña una miniatura del mapa de cómo va a salir en el PDF.»
     La tira va arriba de la pestaña, con los recuadros de SU banda y el
     mismo dibujo del pliego; aparece cuando hay qué mostrar y cambia cuando
     se mide: Ambiente nace sin mapa y con el terreno medido trae las
     curvas. General y Síntesis no tienen banda de mapas y no llevan tira. */
  console.log('\n  -- el pliego se asoma en cada pestaña --');
  const ti = r.tiras || {};
  T('Gente y usos abre con el mapa de todos los usos, como va a salir',
    !!ti.gente && ti.gente.n >= 1 && ti.gente.arriba && ti.gente.titulos.some(t => /Todos los usos/.test(t)),
    ti.gente ? (ti.gente.titulos.join(' · ') || 'sin tira') : 'sin pestaña');
  T('cada recuadro trae su dibujo', !!ti.gente && ti.gente.n >= 1 && ti.gente.svg === ti.gente.n,
    ti.gente ? ti.gente.svg + ' de ' + ti.gente.n : '');
  T('General y Síntesis no llevan tira: no tienen banda de mapas',
    !!ti.general && ti.general.n === 0 && !!ti.sintesis && ti.sintesis.n === 0);
  T('Ambiente, sin medir, todavía no tiene mapa que mostrar',
    !!ti.ambiente && ti.ambiente.n === 0, ti.ambiente ? ti.ambiente.titulos.join(' · ') : '');
  T('medido el terreno, Ambiente muestra las curvas como van a salir',
    !!r.tiraAmbienteTras && r.tiraAmbienteTras.arriba && r.tiraAmbienteTras.titulos.some(t => /Curvas de nivel/.test(t)),
    r.tiraAmbienteTras ? (r.tiraAmbienteTras.titulos.join(' · ') || 'sin tira') : 'sin pestaña');

  console.log('');
  T('sin errores de JavaScript', err.filter(e => !/L is not defined|Unexpected end/.test(e)).length === 0,
    err.slice(0, 2).join(' / ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' fallaron' : 'todo pasó'));
  process.exit(mal ? 1 : 0);
})();
