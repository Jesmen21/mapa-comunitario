const E = require('../entorno.js');
/* Lo levantado piso por piso, dentro de los archivos que se entregan.

   Llegó preguntado: «cuando exporto a AutoCAD, y las otras opciones como
   kmz… ¿todo lo nuevo lo está exportando?». No lo estaba. Los campos se
   calculaban —`usos_por_piso` y `mixto` salían de la ficha del edificio— y
   los escritores los tiraban: el GeoJSON copia una lista blanca que no los
   nombraba, el KML tenía la suya y tampoco, y el DXF rotulaba el nombre del
   punto y nada más. Un levantamiento de plantas que no sale del teléfono no
   le sirve a nadie.

   Acá se mapean tres edificios —uno con tres usos en la misma planta—, se
   dibuja un área encima y se abren los cuatro archivos que se entregan para
   buscar dentro lo que se levantó:

     · GeoJSON, que es el que se abre en QGIS y con el que se pinta el sector
       por altura o por mezcla de usos;
     · KML, que es la ficha que se ve al pinchar el punto en Google Earth;
     · DXF, donde no hay tabla de atributos: lo que se sabe va en el rótulo,
       y los edificios contados se repiten en capas por altura para poder
       aislar lo alto;
     · SVG, en el rótulo emergente de cada punto.                            */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO, LEAFLET = S + 'node_modules/leaflet/dist/';
const C = { lat: 7.8939, lng: -72.5078 }, L = 0.0025;
const POL = [{ lat: C.lat - L, lng: C.lng - L }, { lat: C.lat + L, lng: C.lng - L },
             { lat: C.lat + L, lng: C.lng + L }, { lat: C.lat - L, lng: C.lng + L }];

const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const filas = [];
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
    if (/script\.google\.com/.test(u)) {
      let pedido = {};
      try { pedido = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      if (pedido.action === 'db_write' && pedido.fila) filas.push(pedido.fila);
      const cuerpo = pedido.action === 'db_read' ? { ok: true, data: filas } : { ok: true, data: [] };
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) });
    }
    if (/overpass/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"elements":[]}' });
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
    window.map.setView([C.lat, C.lng], 17); await esperar(400);
    const A = window.URBIS_PC_ANALISIS, EDIF = window.URBIS_EDIFICIO, SL = window.URBIS_SLOTS;
    const EXP = window.URBIS_PC_EXPORTAR;

    const usosMat = EDIF.todosLosUsos().map(() => 'NO');
    const punto = (cabeza, dLat, pisos, plantas) => {
      const d = [cabeza, 'Ref', 'nota', 'Bueno', 'Activo', 'N/A'].concat(usosMat)
        .concat(['N/A', 'Aprobado', 'u', 'admin', '0', 'a@b.c', '1', 'C'])
        .concat([new Date().toISOString(), 'N/A', 'Permanente', 'Activo', 'General'])
        .concat(['Concreto reforzado (pórticos o muros)', pisos, '', '2010 o posterior (NSR-10)', '']);
      while (d.length <= SL.edificioUsosPorPiso) d.push('');
      d[SL.edificioUsosPorPiso] = plantas;
      return { tipo: '🗺️ Matriz de Usos', lat: String(C.lat + dLat), lng: String(C.lng),
        descripcion: d.join(' | '), fecha: new Date().toISOString() };
    };
    const GYM = 'Deportivo o gimnasio', OFI = 'Oficinas o servicios';
    // Una torre con el piso 3 partido en tres, una casa mixta y una de un piso.
    await window.urbisGuardarFila(punto('Residencial · Torre residencial (4–10 pisos)', 0, '5',
      '1-2:Comercio;3:' + GYM + '+Comercio+' + OFI + ';4-5:Vivienda'));
    await window.urbisGuardarFila(punto('Residencial · Casa de dos pisos', 0.0006, '2',
      '1:Comercio;2:Vivienda'));
    await window.urbisGuardarFila(punto('Residencial · Casa de un piso', 0.0012, '1', '1:Vivienda'));
    if (typeof window.urbisCargarPuntos === 'function') window.urbisCargarPuntos();
    for (let i = 0; i < 40; i++) {
      const n = ((typeof window.urbisDatosVisibles === 'function' ? window.urbisDatosVisibles() : []) || []).length;
      if (n >= 3) break;
      await esperar(300);
    }

    A.iniciarDibujo(); POL.forEach(p => A.agregarPunto(p.lat, p.lng)); A.agregarPunto(POL[0].lat, POL[0].lng);
    await esperar(400);
    /* Los mismos datos que usa el botón de exportar: se piden al módulo y se
       arman los cuatro archivos, que es exactamente lo que se descarga. */
    const d = EXP.recolectar();
    o.puntos = d ? d.puntos.length : 0;
    o.conPisos = d ? d.puntos.filter(p => Number(p.pisos) > 0).length : 0;
    o.geojson = d ? EXP.construirGeoJSON(d) : '';
    o.kml = d ? EXP.construirKML(d, {}) : '';
    o.dxf = d ? EXP.construirDXF(d) : '';
    o.svg = d ? EXP.construirSVG(d) : '';
    return o;
  }, { C, POL });
  await pg.close(); await b.close();

  console.log('\n  -- los tres edificios entran al paquete --');
  T('con sus pisos contados', r.puntos === 3 && r.conPisos === 3,
    r.conPisos + ' con pisos de ' + r.puntos);

  console.log('\n  -- GeoJSON, el que se abre en QGIS --');
  let g = null;
  try { g = JSON.parse(r.geojson || '{}'); } catch (e) { g = null; }
  const props = ((g && g.features) || []).filter(f => f.properties && f.properties.capa === 'puntos')
    .map(f => f.properties);
  T('es un GeoJSON válido con sus tres puntos', props.length === 3, props.length + ' puntos');
  T('cada uno lleva sus pisos', props.every(p => Number(p.pisos) > 0),
    props.map(p => p.pisos).join(' · '));
  /* Lo que se pidió por su nombre: qué hay en cada planta. Sin esto, en QGIS
     una torre de oficinas con local abajo y una de vivienda son el mismo
     punto con el mismo número. */
  const torre = props.filter(p => Number(p.pisos) === 5)[0] || {};
  T('y qué hay en cada planta',
    /piso 1: Comercio/.test(torre.usos_por_piso || '') &&
    /piso 3: Deportivo o gimnasio/.test(torre.usos_por_piso || '') &&
    /piso 5: Vivienda/.test(torre.usos_por_piso || ''),
    torre.usos_por_piso || 'no viaja');
  T('con los tres usos del piso partido, no uno solo',
    (String(torre.usos_por_piso || '').match(/piso 3:/g) || []).length === 3,
    (String(torre.usos_por_piso || '').match(/piso 3: [^;]*/g) || []).join(' | ') || 'ninguno');
  T('y si el edificio es mixto', torre.mixto === 'si' &&
    props.filter(p => Number(p.pisos) === 1)[0].mixto === 'no',
    'torre: ' + torre.mixto + ' · casa de un piso: ' + (props.filter(p => Number(p.pisos) === 1)[0] || {}).mixto);
  T('sin perder lo que ya viajaba', /Concreto reforzado/.test(torre.materialidad || '') &&
    /NSR-10/.test(torre.epoca || ''), torre.materialidad);

  console.log('\n  -- KMZ, la ficha que se ve en Google Earth --');
  T('el punto trae su piso por piso como dato',
    /<Data name="usos_por_piso"><value>[^<]*piso 3: Deportivo o gimnasio/.test(r.kml || ''),
    ((r.kml || '').match(/<Data name="usos_por_piso"><value>[^<]{0,60}/) || ['no está'])[0]);
  T('y si es mixto', /<Data name="mixto"><value>si<\/value>/.test(r.kml || ''));
  T('y se lee también en la descripción, que es lo que abre al pinchar',
    /Piso por piso: /.test(r.kml || '') && /Uso mixto: si/.test(r.kml || ''));

  console.log('\n  -- DXF, para AutoCAD --');
  /* El DXF no tiene tabla de atributos: un POINT es un punto y nada más. Lo
     que se sabe del edificio viaja en el rótulo, y los contados se repiten en
     capas por altura para poder apagar todo lo demás. */
  T('el rótulo del punto lleva los pisos', /Torre residencial[^\n]*· 5p/.test(r.dxf || ''),
    ((r.dxf || '').match(/[^\n]*· 5p[^\n]*/) || ['sin rótulo'])[0].trim());
  T('y dice cuáles son mixtos', /· 5p · mixto/.test(r.dxf || '') && /Casa de un piso · 1p\b/.test(r.dxf || ''),
    ((r.dxf || '').match(/Casa de un piso[^\n]*/) || [''])[0].trim());
  T('con una capa por altura, para aislar lo alto',
    /PTS_ALTURA_4MAS/.test(r.dxf || '') && /PTS_ALTURA_1/.test(r.dxf || '') && /PTS_ALTURA_2/.test(r.dxf || ''),
    ((r.dxf || '').match(/PTS_ALTURA_\w+/g) || []).filter((v, i, a) => a.indexOf(v) === i).join(' · '));
  /* Cada punto contado aparece dos veces: en la capa de su categoría y en la
     de su altura. En CAD una entidad vive en una sola capa. */
  const enAltura = (r.dxf || '').split('PTS_ALTURA_4MAS').length - 1;
  T('el edificio alto está de verdad en esa capa, no solo declarada', enAltura >= 2,
    enAltura + ' apariciones de PTS_ALTURA_4MAS');

  console.log('\n  -- SVG, para maquetar --');
  T('el rótulo emergente dice los pisos y la mezcla',
    /<title>[^<]*5 pisos · mixto/.test(r.svg || ''),
    ((r.svg || '').match(/<title>[^<]{0,80}/g) || ['sin títulos']).slice(0, 2).join(' | '));

  console.log('');
  T('sin errores de JavaScript', err.filter(e => !/L is not defined|Unexpected end/.test(e)).length === 0,
    err.slice(0, 2).join(' / ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' fallaron' : 'todo pasó'));
  process.exit(mal ? 1 : 0);
})();
