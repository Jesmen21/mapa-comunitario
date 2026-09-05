const E = require('../entorno.js');
/* Volver a ver un sector ya analizado, sin repetirlo.

   Lo que estaba roto, en las palabras con las que se dijo: «entro a la
   notita, abajo de la lupa, donde dice reconocimientos guardados, y me
   gustaría volver a ver todo el análisis, todo lo que se investigó, y solo
   sale un botón que dice comparar».

   Era exacto. El informe completo de una ficha guardada existe desde hace
   versiones —lo arma `informeGuardado` con lo que la ficha trae, sin red y
   sin volver a consultar Overpass— pero desde la hoja no había cómo llegar:
   la lista de guardados ofrecía «Comparar», que además está apagado mientras
   nadie haya mapeado, y «Borrar». Un sector con todo medido quedaba sin
   puerta de entrada, salvo que alguien supiera que el informe vive en otra
   pestaña.

   Esta prueba mide la puerta:

     · que la fila entera se pueda tocar, con el alto de un dedo;
     · que al tocarla se abra la pestaña de sectores con ESA ficha desplegada
       y no con la lista cerrada;
     · que lo que aparece sea el informe de verdad —los mismos bloques que
       tenía el análisis en pantalla, con sus gráficas— y no cuatro cifras;
     · y que no se dispare ninguna consulta a la red para lograrlo, que es lo
       que hace que sirva en un salón sin señal.

   Y de paso, el logo en el pliego: se pidió «arriba a la izquierda, donde
   dice URBIS, pon el logo». Va dibujado, no traído: la lámina se arma en un
   marco que no comparte la carpeta del sitio y un `<img src="assets/…">`
   saldría roto justo ahí.                                                */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO, LEAFLET = S + 'node_modules/leaflet/dist/';
const C = { lat: 7.8939, lng: -72.5078 }, L = 0.004;
const POL = [{ lat: C.lat - L, lng: C.lng - L }, { lat: C.lat + L, lng: C.lng - L },
             { lat: C.lat + L, lng: C.lng + L }, { lat: C.lat - L, lng: C.lng + L }];

let id = 1; const usos = [];
for (let i = 0; i < 120; i++) {
  const a = i * 7 * Math.PI / 180, d = (130 + (i % 6) * 45) / 111320;
  usos.push({ type: 'node', id: id++, lat: C.lat + Math.cos(a) * d, lon: C.lng + Math.sin(a) * d,
    tags: { name: 'Establecimiento ' + i,
      amenity: ['pharmacy', 'restaurant', 'school', 'bank', 'cafe', 'clinic'][i % 6] } });
}
for (let i = 0; i < 8; i++) {
  const off = (i - 4) * 0.0009;
  usos.push({ type: 'way', id: 9000 + i, nodes: [],
    geometry: [{ lat: C.lat + off, lon: C.lng - 0.004 }, { lat: C.lat + off, lon: C.lng + 0.004 }],
    tags: { highway: i % 3 ? 'residential' : 'secondary', name: 'Calle ' + i, lanes: '2' } });
}

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('urbis_licencia_analisis', 'URBIS1.deprueba.deprueba');
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'martarojas', rol: 'admin',
        es_admin: true, session_token: 't', active: true, verified: true }));
      localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1');
    } catch (e) {}
  });
  /* Cada petición que sale se anota: la promesa de esta pantalla es que el
     informe guardado se reconstruye de lo guardado, sin red. */
  const pedidas = [];
  await ctx.route('**', r => {
    const u = r.request().url();
    if (!/localhost:(8199|8787)/.test(u)) pedidas.push(u);
    return /localhost:(8199|8787)/.test(u) ? r.continue() : r.abort();
  });
  await ctx.route(/unpkg\.com/, r => { const u = r.request().url();
    r.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
      body: fs.readFileSync(LEAFLET + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') }); });
  await ctx.route(/script\.google\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":[]}' }));
  await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route(/locationiq\.com/, r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ address: { city: 'Cúcuta', state: 'Norte de Santander', country: 'Colombia', suburb: 'La Playa' } }) }));
  await ctx.route(/overpass/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: usos }) }));
  await ctx.route(/ags\.esri\.co/, r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ features: [{ attributes: { TOTAL: 3045, N: 42, ESTRATO: 3 } }] }) }));

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 160)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  const r = {};

  // ── Se analiza un sector y se le pone nombre: queda guardado.
  r.tras = await pg.evaluate(async (D) => {
    const { C, POL } = D, esperar = ms => new Promise(x => setTimeout(x, ms));
    window.URBIS_CONFIG.ANALISIS.API = window.__URBIS_MOTOR;
    window.map.setView([C.lat, C.lng], 15); await esperar(400);
    const A = window.URBIS_PC_ANALISIS, R = window.URBIS_PC_RECON, H = () => document.getElementById('pcr-hoja');
    const bPC = document.querySelector('[data-u52-call="procity-open-map"]'); if (bPC) { bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p => A.agregarPunto(p.lat, p.lng)); A.agregarPunto(POL[0].lat, POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1400);
    const a = H().querySelector('[data-pcr="agrandar"]'); if (a) { a.click(); await esperar(400); }
    const caja = document.getElementById('pcr-nombre');
    if (caja) { caja.value = 'La Playa, entre calles 8 y 12'; caja.dispatchEvent(new Event('input', { bubbles: true })); }
    const g = H().querySelector('[data-pcr="guardar"]'); if (g) { g.click(); await esperar(700); }
    /* Los títulos del informe EN PANTALLA: son la vara contra la que se mide
       lo que se ve al volver. Se leen del encabezado de cada bloque y no del
       texto entero, que cambia con cada dato. */
    const titulos = [...H().querySelectorAll('.pcr-h')].map(x => (x.textContent || '').trim()).filter(Boolean);
    return { fichas: (R.leerFichas() || []).length, titulos, id: ((R.leerFichas() || [])[0] || {}).id };
  }, { C, POL });

  /* ── Se suelta el análisis, como quien vuelve a la app otro día: en la
     hoja queda la lista de guardados y nada más. */
  r.lista = await pg.evaluate(async () => {
    const esperar = ms => new Promise(x => setTimeout(x, ms));
    const R = window.URBIS_PC_RECON, H = () => document.getElementById('pcr-hoja');
    const bo = H().querySelector('[data-pcr="otro"]'); if (bo) { bo.click(); await esperar(600); }
    const a = H().querySelector('[data-pcr="agrandar"]'); if (a) { a.click(); await esperar(400); }
    const fila = H().querySelector('.pcr-guardada');
    const ir = fila ? fila.querySelector('[data-pcr="ver-ficha"]') : null;
    const caja = ir ? ir.getBoundingClientRect() : null;
    /* Lo que se ve en el sitio de la lista: si ahí no hay más que «Comparar»
       —apagado, porque nadie mapeó todavía—, no hay puerta. */
    const botones = fila ? [...fila.querySelectorAll('button')].map(x => ({
      pcr: x.getAttribute('data-pcr') || '', txt: (x.textContent || '').trim().slice(0, 30),
      apagado: x.disabled })) : [];
    return { hayFila: !!fila, hayIr: !!ir, alto: caja ? Math.round(caja.height) : 0, botones,
      // Y lo que ve quien mira: que se puede entrar.
      dice: fila ? /Ver el análisis/i.test(fila.textContent || '') : false };
  });

  // ── Se toca la fila. Debe abrirse la pestaña del sector, con esa ficha.
  const antesDePedidos = pedidas.length;
  const fila = await pg.$('.pcr-guardada [data-pcr="ver-ficha"]');
  if (fila) { await fila.tap(); await pg.waitForTimeout(1400); }

  r.abierto = await pg.evaluate(() => {
    const pest = document.querySelector('.pcr-pestana');
    const ab = document.querySelector('.pcr-pest-ficha.abierta');
    const cuerpo = ab ? ab.querySelector('.pcr-pest-cuerpo') : null;
    const visible = (el) => { if (!el) return false; const c = el.getBoundingClientRect();
      return c.width > 0 && c.height > 0; };
    return {
      hayPestana: !!pest,
      abiertas: document.querySelectorAll('.pcr-pest-ficha.abierta').length,
      nombre: ab ? ((ab.querySelector('.pcr-pest-t b') || {}).textContent || '').trim() : '',
      seVe: visible(cuerpo),
      titulos: cuerpo ? [...cuerpo.querySelectorAll('.pcr-h')].map(x => (x.textContent || '').trim()).filter(Boolean) : [],
      // Las gráficas: barras, anillos, siluetas. Un informe sin ninguna es
      // una tabla de cifras, que no es lo que se pidió volver a ver.
      dibujos: cuerpo ? cuerpo.querySelectorAll('svg').length : 0,
      barras: cuerpo ? cuerpo.querySelectorAll('.pcr-barra, .pcr-b, .pcr-cat-fila').length : 0,
      // Y que se pueda seguir trabajando desde ahí.
      lamina: cuerpo ? !!cuerpo.querySelector('[data-u52-call="pcr-lamina"]') : false,
      laminaH: cuerpo ? !!cuerpo.querySelector('[data-u52-call="pcr-lamina-h"]') : false,
      pdf: cuerpo ? !!cuerpo.querySelector('[data-u52-call="pcr-pdf"]') : false
    };
  });
  r.pedidosAlVolver = pedidas.length - antesDePedidos;

  // ── El logo del pliego, en las dos orientaciones.
  r.laminas = await pg.evaluate(async () => {
    const esperar = ms => new Promise(x => setTimeout(x, ms));
    let capturado = ''; window.AIA_INFORME = window.AIA_INFORME || {};
    window.AIA_INFORME.abrirVentanaImpresion = function (h) { capturado = h; return true; };
    const o = {};
    const b1 = document.querySelector('[data-u52-call="pcr-lamina"]');
    if (b1) { b1.click(); await esperar(1200); }
    o.v = capturado; capturado = '';
    const b2 = document.querySelector('[data-u52-call="pcr-lamina-h"]');
    if (b2) { b2.click(); await esperar(1200); }
    o.h = capturado;
    return o;
  });
  r.err = err;
  await pg.close(); await b.close();

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };

  console.log('\n  -- el sector queda guardado --');
  T('se guardó', (r.tras || {}).fichas === 1, (r.tras || {}).fichas + ' fichas');
  T('y el informe en pantalla trae sus bloques',
    ((r.tras || {}).titulos || []).length >= 8, ((r.tras || {}).titulos || []).length + ' bloques');

  console.log('\n  -- la puerta, en la lista de guardados --');
  const LI = r.lista || {};
  T('la fila del sector está', LI.hayFila);
  T('y se puede tocar entera para entrar', LI.hayIr,
    (LI.botones || []).map(x => x.pcr + (x.apagado ? '(apagado)' : '')).join(' · ') || 'ningún botón');
  T('con el alto de un dedo', LI.alto >= 44, LI.alto + ' px');
  T('y dice para qué sirve', LI.dice);

  console.log('\n  -- se vuelve a ver, entero --');
  const AB = r.abierto || {};
  T('se abre la pestaña del sector', AB.hayPestana);
  T('con esa ficha desplegada y ninguna otra', AB.abiertas === 1, AB.abiertas + ' abiertas');
  T('es el sector que se tocó', /La Playa, entre calles 8 y 12/.test(AB.nombre || ''), AB.nombre || 'sin nombre');
  T('el informe se ve', AB.seVe);
  /* La comparación que importa: lo que se guardó tiene que devolver lo mismo
     que se estaba mirando, no un resumen. Se aceptan dos bloques de
     diferencia —los que dependen de tener el análisis vivo, como el nombre
     que se está escribiendo—, no la mitad. */
  /* La comparación que importa: lo que se LEE del sector tiene que volver.
     No se compara el número de bloques —la ficha viva trae además las
     herramientas: medir, dibujar el lote, encender capas, exportar, y esas
     no tienen sentido en un archivo—, sino que cada bloque de RESULTADO que
     estaba en pantalla siga estando. Nombrados uno por uno: contar bloques
     dejaría pasar que se cambie uno por otro. */
  const RESULTADOS = ['Ubicación', 'Información del área', 'Cuánta gente vive acá',
    'Qué hay, por categoría', 'Lo más repetido', 'Qué manda en el sector',
    'A distancia de caminar', 'Asoleamiento', 'Cómo se llega', 'Verde y agua',
    'Dónde está la calle comercial', 'Hitos y nodos', 'Cómo cambia al alejarse',
    'El plan de la salida', 'La lista para ir a verificar', 'Síntesis del sector'];
  const enVivo = RESULTADOS.filter(x => ((r.tras || {}).titulos || []).indexOf(x) >= 0);
  const faltan = enVivo.filter(x => ((AB.titulos) || []).indexOf(x) < 0);
  T('el análisis en pantalla trae los bloques que se van a exigir',
    enVivo.length === RESULTADOS.length,
    enVivo.length + ' de ' + RESULTADOS.length +
    (enVivo.length === RESULTADOS.length ? '' :
      ' · sin: ' + RESULTADOS.filter(x => enVivo.indexOf(x) < 0).join(', ')));
  T('y al volver están todos, ninguno se queda por el camino',
    faltan.length === 0, faltan.length ? 'faltan: ' + faltan.join(', ') : 'los ' + enVivo.length);
  T('y con sus gráficas, no solo cifras', (AB.dibujos || 0) >= 3, (AB.dibujos || 0) + ' dibujos');
  T('se puede sacar el PDF y las dos láminas desde ahí',
    AB.pdf && AB.lamina && AB.laminaH);
  T('sin pedirle nada a la red', r.pedidosAlVolver === 0, r.pedidosAlVolver + ' peticiones');

  console.log('\n  -- el logo, arriba a la izquierda --');
  const LV = (r.laminas || {}).v || '', LH = (r.laminas || {}).h || '';
  T('las dos láminas salen del sector guardado', LV.length > 5000 && LH.length > 5000,
    LV.length + ' · ' + LH.length + ' caracteres');
  [['parada', LV], ['acostada', LH]].forEach(function (par) {
    const t = par[1];
    T('la ' + par[0] + ' lleva el logo dibujado, antes del nombre',
      /<div class="marca"><svg class="logo"/.test(t) &&
      t.indexOf('class="logo"') < t.indexOf('<b>URBIS</b>'));
    /* Dibujado y no traído: un `<img src="assets/…">` en la lámina sale roto
       —se arma en un marco que no comparte la carpeta del sitio— y en el
       papel un logo pixelado a 90 cm se ve peor que ninguno. */
    T('y va en trazos, no en una imagen que puede no llegar', par[0] === 'parada'
      ? !/<img[^>]+assets\//.test(t) : !/<img[^>]+assets\//.test(t));
  });
  /* Que sea el logo de verdad y no un dibujo parecido: los dos colores del
     archivo —celeste #34CCFE y amarillo #FABD0A, medidos del PNG, no
     elegidos a ojo— y las cuatro piezas del isotipo: el fondo, el pin, la U
     y el punto sobre su anillo blanco. */
  const marca = (LV.match(/<svg class="logo"[\s\S]*?<\/svg>/) || [''])[0];
  T('el logo es el de URBIS: el pin, la U y el punto',
    /viewBox="0 0 100 100"/.test(marca) && /aria-label="URBIS"/.test(marca) &&
    /#FABD0A/.test(marca) && (marca.match(/#34CCFE/g) || []).length >= 2 &&
    (marca.match(/<circle cx="58\.25"/g) || []).length === 2 &&
    /stroke-linecap="round"/.test(marca),
    (marca.match(/<(path|circle|rect)\b/g) || []).length + ' piezas');

  console.log('');
  T('sin errores de JavaScript', (r.err || []).length === 0, (r.err || []).join(' | ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' fallaron' : 'todo pasó'));
  process.exit(mal ? 1 : 0);
})();
