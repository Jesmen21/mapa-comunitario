const E = require('../entorno.js');
/* Las plantas, contadas donde el estudiante viene a leerlas.

   Llegó como pregunta, y la pregunta ya era el hallazgo: «¿esos nuevos
   mapeos son cuantificables cuando el estudiante los vaya a analizar en la
   opción de análisis de geometrías y así?».

   No lo eran. El panel del área contaba PUNTOS —una torre de doce pisos con
   comercio abajo pesaba lo mismo que un kiosco— y el generador de geometrías
   reducía cada punto a su latitud y su longitud antes de tejer nada. Todo el
   trabajo de contar pisos en la calle terminaba en la ficha del sector y no
   aparecía en la pantalla donde se analiza el área dibujada.

   Acá se mapean cuatro edificios y un parque, se dibuja el área encima y se
   comprueba lo que el panel dice de ellos:

     · las plantas contadas, las que caben en una hectárea, la media y
       cuántos edificios mezclan usos;
     · el reparto por uso, donde un piso partido entre tres cuenta un tercio
       en cada uno —de modo que la suma sigue siendo el número de plantas y
       no crece por repartirse—;
     · que la geometría se puede tejer solo sobre lo alto o solo sobre lo
       mixto, que son dos preguntas que antes no se podían hacer;
     · y que las mismas cifras salen en el informe del área.                */
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
  const ctxN = await b.newContext({ serviceWorkers: 'block', viewport: { width: 412, height: 915 },
    isMobile: true, hasTouch: true, locale: 'es-CO', timezoneId: 'America/Bogota' });
  await ctxN.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctxN.addInitScript(() => {
    if (window.top !== window) return;
    try {
      localStorage.setItem('urbis_licencia_analisis', 'URBIS1.deprueba.deprueba');
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'u', rol: 'admin',
        es_admin: true, session_token: 't', active: true, verified: true }));
      localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1');
    } catch (e) {}
  });
  await ctxN.route('**', r => {
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
    if (/cdn\.jsdelivr\.net/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript',
      body: fs.readFileSync(S + 'node_modules/chart.js/dist/chart.umd.js', 'utf8') });
    r.abort();
  });
  const pg = await ctxN.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 120)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  const r = await pg.evaluate(async (D) => {
    const { C, POL } = D, o = {}, esperar = ms => new Promise(x => setTimeout(x, ms));
    window.URBIS_CONFIG.ANALISIS.API = window.__URBIS_MOTOR;
    window.map.setView([C.lat, C.lng], 17); await esperar(400);
    const A = window.URBIS_PC_ANALISIS, EDIF = window.URBIS_EDIFICIO, SL = window.URBIS_SLOTS;

    /* Cuatro edificios y un parque. Las plantas se escriben con el mismo
       vocabulario que usa el formulario: no hay dos caminos para el dato. */
    const usosMat = EDIF.todosLosUsos().map(() => 'NO');
    const punto = (cabeza, dLat, pisos, plantas) => {
      const d = [cabeza, 'Ref', 'nota', 'Bueno', 'Activo', 'N/A'].concat(usosMat)
        /* El autor es la sesión de la prueba: el mapa abre en «solo lo mío» y
           un punto de otro no entraría al conteo, que es exactamente lo que
           ve un estudiante cuando analiza lo que él mismo levantó. */
        .concat(['N/A', 'Aprobado', 'u', 'admin', '0', 'a@b.c', '1', 'C'])
        .concat([new Date().toISOString(), 'N/A', 'Permanente', 'Activo', 'General'])
        .concat([EDIF.SIN_REGISTRAR, pisos, '', '', '']);
      while (d.length <= SL.edificioUsosPorPiso) d.push('');
      d[SL.edificioUsosPorPiso] = plantas;
      return { tipo: '🗺️ Matriz de Usos', lat: String(C.lat + dLat), lng: String(C.lng),
        descripcion: d.join(' | '), fecha: new Date().toISOString() };
    };
    const GYM = 'Deportivo o gimnasio', OFI = 'Oficinas o servicios';
    await window.urbisGuardarFila(punto('Residencial · Torre residencial (4–10 pisos)', 0.0000, '5',
      '1-2:Comercio;3:' + GYM + '+Comercio+' + OFI + ';4-5:Vivienda'));
    await window.urbisGuardarFila(punto('Comercial · Centro comercial', 0.0004, '6',
      '1:Comercio;2-6:' + OFI));
    await window.urbisGuardarFila(punto('Residencial · Torre residencial (4–10 pisos)', 0.0008, '4',
      '1-4:Vivienda'));
    await window.urbisGuardarFila(punto('Residencial · Casa de dos pisos', 0.0012, '2',
      '1:Comercio;2:Vivienda'));
    await window.urbisGuardarFila(punto('Esp. Público · Parque de bolsillo', 0.0016, '', ''));
    if (typeof window.urbisCargarPuntos === 'function') window.urbisCargarPuntos();
    for (let i = 0; i < 40; i++) {
      const n = ((typeof window.urbisDatosVisibles === 'function' ? window.urbisDatosVisibles() : []) || []).length;
      if (n >= 5) break;
      await esperar(300);
    }
    o.puntos = ((typeof window.urbisDatosVisibles === 'function' ? window.urbisDatosVisibles() : []) || []).length;

    // El área encima de los cinco.
    A.iniciarDibujo(); POL.forEach(p => A.agregarPunto(p.lat, p.lng)); A.agregarPunto(POL[0].lat, POL[0].lng);
    await esperar(400);
    const ctx = window.urbisProCityCtxAnalisis();
    o.panel = A.htmlPanel(ctx);

    // La geometría, tejida solo sobre lo alto.
    A.accion('geo-filtro', { dataset: { gid: 'pisos-altos' } });
    await esperar(300);
    A.accion('geo', { dataset: { gid: 'hull' } });
    await esperar(500);
    o.chipAltos = ((document.querySelector('.pca-geo-chip') || {}).textContent || '').replace(/\s+/g, ' ').trim();
    /* Se cambia el filtro y ya: la geometría se rehace sola con la forma
       puesta. Volver a tocar la misma forma la APAGA —es un interruptor— y
       eso dejaba el chip vacío y la prueba midiendo un mapa sin nada. */
    A.accion('geo-filtro', { dataset: { gid: 'todos' } });
    await esperar(500);
    o.chipTodos = ((document.querySelector('.pca-geo-chip') || {}).textContent || '').replace(/\s+/g, ' ').trim();

    // Y el informe del área.
    let capturado = '';
    window.AIA_INFORME = window.AIA_INFORME || {};
    window.AIA_INFORME.abrirVentanaImpresion = function (h) { capturado = h; };
    A.accion('pdf', null);
    await esperar(900);
    o.informe = capturado;
    return o;
  }, { C, POL });
  await pg.close(); await b.close();

  const P = r.panel || '';
  const kpi = t => { const m = P.match(new RegExp('<b>([^<]*)</b><small>' + t + '</small>')); return m ? m[1] : null; };

  console.log('\n  -- el panel del área cuenta plantas, no solo puntos --');
  T('los cinco puntos entraron', r.puntos === 5, r.puntos + ' puntos');
  T('el panel abre el bloque de lo contado piso por piso',
    /Lo que se contó piso por piso/.test(P));
  /* Cuatro edificios de 5, 6, 4 y 2 pisos: diecisiete plantas. El parque no
     cuenta —no tiene pisos que contar— y por eso la media es sobre cuatro. */
  T('suma las plantas de los cuatro edificios', kpi('plantas contadas') === '17', kpi('plantas contadas'));
  T('y las reparte sobre la hectárea', Number(kpi('plantas por hectárea')) > 0,
    kpi('plantas por hectárea') + ' plantas/ha');
  T('con la media de pisos', kpi('pisos de media') === '4,3', kpi('pisos de media'));
  T('y cuántos mezclan usos', kpi('de uso mixto') === '3', kpi('de uso mixto'));

  console.log('\n  -- un piso partido entre tres cuenta un tercio en cada uno --');
  const fila = u => { const m = P.match(new RegExp('<td>' + u + '</td><td class="n">([^<]*)</td>')); return m ? m[1] : null; };
  /* El piso 3 de la primera torre tiene gimnasio, comercio y oficina. Si cada
     uno contara una planta entera, el edificio de cinco pisos pesaría siete.
     La suma de la tabla tiene que dar exactamente las plantas contadas. */
  T('el gimnasio de un solo piso compartido vale un tercio', fila('Deportivo o gimnasio') === '0,3',
    fila('Deportivo o gimnasio'));
  T('el comercio suma sus plantas enteras y su tercio', fila('Comercio') === '4,3', fila('Comercio'));
  T('las oficinas también', fila('Oficinas o servicios') === '5,3', fila('Oficinas o servicios'));
  T('y la vivienda, que no comparte ninguna', fila('Vivienda') === '7', fila('Vivienda'));
  const suma = ['Vivienda', 'Comercio', 'Oficinas o servicios', 'Deportivo o gimnasio']
    .reduce((n, u) => n + Number(String(fila(u) || '0').replace(',', '.')), 0);
  T('la tabla suma las plantas del área, no más', Math.abs(suma - 17) <= 0.1, suma + ' de 17');
  T('y dice cuántos edificios traen sus pisos', /4 de 4 edificios mapeados traen sus pisos/.test(P),
    (P.match(/\d+ de \d+ edificios mapeados traen sus pisos/) || ['no lo dice'])[0]);

  console.log('\n  -- la geometría se puede tejer solo sobre lo alto o lo mixto --');
  T('ofrece «solo lo alto», con su cuenta', /Solo lo alto \(4\+ pisos\)<b>3<\/b>/.test(P),
    (P.match(/Solo lo alto[^<]*<b>\d+<\/b>/) || ['no lo ofrece'])[0]);
  T('y «solo los mixtos»', /Solo los mixtos<b>3<\/b>/.test(P),
    (P.match(/Solo los mixtos<b>\d+<\/b>/) || ['no lo ofrece'])[0]);
  /* Y teje de verdad sobre ellos: con el filtro puesto conecta tres puntos y
     no los cinco del área, y el chip del mapa dice sobre qué se tejió. */
  T('teje sobre los tres altos y lo dice en el mapa',
    /3 puntos/.test(r.chipAltos) && /lo de cuatro pisos o más/.test(r.chipAltos), r.chipAltos);
  T('y sin filtro vuelve a los cinco', /5 puntos/.test(r.chipTodos), r.chipTodos);

  console.log('\n  -- y las mismas cifras en el informe del área --');
  const I = r.informe || '';
  T('el informe trae el bloque de plantas', /<h2>Lo que se contó piso por piso<\/h2>/.test(I));
  T('con las mismas diecisiete plantas', /<b>17<\/b><small>plantas contadas<\/small>/.test(I),
    (I.match(/<b>[^<]*<\/b><small>plantas contadas<\/small>/) || ['no está'])[0]);
  T('y su tabla por uso', /<th>Qué hay en las plantas<\/th>/.test(I) && /<td>Vivienda<\/td><td>7<\/td>/.test(I));

  console.log('');
  T('sin errores de JavaScript', err.filter(e => !/L is not defined|Unexpected end/.test(e)).length === 0,
    err.slice(0, 2).join(' / ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' fallaron' : 'todo pasó'));
  process.exit(mal ? 1 : 0);
})();
