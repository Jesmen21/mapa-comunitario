const E = require('../entorno.js');
/* LA CONSULTA DE USOS · que un área grande no vuelva vacía, y que lo que
   falte se diga
   ────────────────────────────────────────────────────────────────────────
   Llegó con capturas: un sector de dos kilómetros de radio sobre el centro
   de Cúcuta —Parque Santander, el estadio, dos hospitales, la Gran
   Colombia— salía con «Todos los usos 0», y dos minutos después uno de
   cuatrocientos metros al lado salía con ochocientos setenta. Lo dijo así:
   «al parecer al hacer un análisis grande se buguea y dice que no había
   nada».

   La causa estaba en una línea de `js/61`. Overpass NO contesta con un
   código de error cuando se queda sin tiempo: contesta 200, con la lista
   vacía y una línea `remark` explicando por qué. La aplicación solo miraba
   el código, así que el «se me acabó el tiempo» entraba como un sector sin
   un solo uso, se guardaba en el caché y se servía igual durante
   veinticuatro horas: volver a analizar el mismo sector no lo arreglaba.

   Esta suite mide las cinco piezas del arreglo, y la petición que vino
   junto con él —«ayúdame a ajustar para al menos poner 8 kilómetros de
   radio»—:

     · la consulta se ESCALA con el área: más segundos y más tope cuanto
       más grande, y el corte del cliente por encima del del servidor;
     · un `remark` con la lista vacía es un FALLO, no un sector sin usos;
     · un vacío NO se guarda en el caché;
     · cuando la consulta completa no alcanza, se pide la LIGERA —sin las
       capas de área— y se dice qué le faltó;
     · cuando la respuesta llega topada, también se dice;
     · y la barra de radio llega a 8 km.

   Se mide contra un Overpass de mentira que se puede poner de mal humor a
   voluntad: es la única forma de provocar un tiempo agotado sin depender
   de que el servidor de verdad esté cargado hoy.                          */
const { chromium } = require(E.MODULOS + '/playwright-core');
const C = { lat: 7.8939, lng: -72.5078 };
const L = 0.0015;
const POL = [{ lat: C.lat - L, lng: C.lng - L }, { lat: C.lat + L, lng: C.lng - L },
             { lat: C.lat + L, lng: C.lng + L }, { lat: C.lat - L, lng: C.lng + L }];

/* La respuesta que traía todo esto: 200, con su explicación y sin un solo
   elemento. Es literalmente lo que devuelve overpass-api.de cuando la
   consulta se pasa del tiempo que ella misma pidió. */
const REMARK = { version: 0.6, generator: 'Overpass API 0.7.62',
  remark: 'runtime error: Query timed out in "query" at line 1 after 25 seconds.',
  elements: [] };
const usos = n => ({ version: 0.6, generator: 'Overpass API 0.7.62',
  elements: Array.from({ length: n }, (_, i) => ({
    type: 'node', id: 500000 + i,
    lat: C.lat + ((i % 12) - 6) * 0.0003, lon: C.lng + (Math.floor(i / 12) - 6) * 0.0003,
    tags: { name: 'Local ' + i, amenity: ['pharmacy', 'restaurant', 'bank', 'school', 'police'][i % 5] }
  })) });

/* Las cuatro capas de ÁREA: son las que pesan y las primeras que se sueltan.
   Que la consulta ligera no las lleve es la mitad del arreglo. */
const CAPAS_AREA = ['landuse', 'natural', 'waterway', '"building"!="yes"'];
const esLigera = q => CAPAS_AREA.every(c => q.indexOf(c) === -1);
const segundosDe = q => Number((String(q).match(/\[timeout:(\d+)\]/) || [0, 0])[1]);
const topeDe = q => Number((String(q).match(/out center tags (\d+)/) || [0, 0])[1]);

(async () => {
  let modo = 'ok';
  const pedidos = [];

  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota',
    locale: 'es-CO', viewport: { width: 412, height: 915 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true });
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(() => {
    if (window.top !== window) return;
    try {
      localStorage.setItem('urbis_licencia_analisis', 'URBIS1.deprueba.deprueba');
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'martarojas',
        rol: 'admin', es_admin: true, session_token: 't', active: true, verified: true }));
      localStorage.removeItem('pcr_fichas_v1');
      // El caché de consultas, en blanco: media suite mide justamente qué se
      // guarda y qué no, y arrancar con restos de otra corrida la haría mentir.
      localStorage.removeItem('aia_overpass_cache_v1');
    } catch (e) {}
  });
  // Desde el navegador se maneja el humor del Overpass de mentira.
  await ctx.exposeFunction('__modo', m => { modo = m; return true; });
  await ctx.exposeFunction('__pedidos', () => pedidos.slice());

  await ctx.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
  await ctx.route(/unpkg\.com/, r => { const u = r.request().url(); const fs2 = require('fs');
    r.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
      body: fs2.readFileSync(E.TRABAJO + 'node_modules/leaflet/dist/' +
        (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') }); });
  await ctx.route(/script\.google\.com/, r => r.fulfill({ status: 200,
    contentType: 'application/json', body: '{"ok":true,"data":[]}' }));
  await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200,
    contentType: 'text/javascript', body: '' }));
  await ctx.route(/locationiq\.com/, r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ address: { city: 'Cúcuta', state: 'Norte de Santander',
                                      country: 'Colombia', suburb: 'La Playa' } }) }));
  await ctx.route(/ags\.esri\.co/, r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ features: [{ attributes: { TOTAL: 3045, N: 42 } }] }) }));

  const json = (r, obj) => r.fulfill({ status: 200, contentType: 'application/json',
                                       body: JSON.stringify(obj) });
  /* El cuerpo viaja como `data=` más la consulta codificada para URL, así
     que `[timeout:60]` llega escrito `%5Btimeout%3A60%5D`. Se descodifica al
     anotarlo: si no, medir los segundos de la consulta da cero siempre y la
     prueba pasa por el motivo equivocado. */
  const legible = q => { try { return decodeURIComponent(String(q).replace(/^data=/, '')); }
                         catch (e) { return String(q); } };
  await ctx.route(/overpass/, r => {
    const q = legible(r.request().postData() || '');
    pedidos.push(q);
    if (modo === 'remark') return json(r, REMARK);
    // El caso real: la pesada no alcanza y la ligera sí. Es exactamente lo
    // que pasa en un sector grande y bien mapeado.
    if (modo === 'pesada-no') return json(r, esLigera(q) ? usos(30) : REMARK);
    if (modo === 'vacio') return json(r, usos(0));
    if (modo === 'tope') return json(r, usos(topeDe(q) || 3000));
    return json(r, usos(30));
  });

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  /* ── Parte A · la consulta, sin montar la aplicación ────────────────
     `AIA_DATOS` es la capa que se tocó, y se puede preguntar directamente.
     Entre llamada y llamada hay que esperar los cinco segundos del freno
     de Overpass: son los `esperar(5300)` que parecen de más y no lo son. */
  const A = await pg.evaluate(async (D) => {
    const { C } = D, o = {};
    const esperar = ms => new Promise(x => setTimeout(x, ms));
    const antes = async () => (await window.__pedidos()).length;
    const pedir = async (radio, forzar) => {
      const i = await antes();
      try {
        const l = await window.AIA_DATOS.consultarEntorno(C.lat, C.lng, radio, forzar);
        const todos = await window.__pedidos();
        return { ok: true, n: l.length, aviso: l.aviso || '', consultas: todos.slice(i) };
      } catch (e) {
        const todos = await window.__pedidos();
        return { ok: false, error: String((e && e.message) || e), consultas: todos.slice(i) };
      }
    };

    await window.__modo('ok');
    o.chico = await pedir(300, true);            // 0,28 km²
    await esperar(5300);
    o.grande = await pedir(8000, true);          // 201 km²
    await esperar(5300);

    await window.__modo('remark');
    o.agotada = await pedir(1500, true);         // ni la ligera alcanza
    await esperar(5300);

    await window.__modo('pesada-no');
    o.respaldo = await pedir(1500, true);        // la pesada no, la ligera sí
    await esperar(5300);

    /* El vacío y el caché: se pide un sector que vuelve sin nada y después
       se vuelve a pedir EL MISMO, sin forzar. Si el vacío se hubiera
       guardado, la segunda no saldría a la red y volvería con cero. */
    await window.__modo('vacio');
    o.vacio = await pedir(900, false);
    await esperar(5300);
    await window.__modo('ok');
    o.reintento = await pedir(900, false);
    await esperar(5300);

    await window.__modo('tope');
    o.topada = await pedir(300, true);
    return o;
  }, { C });

  /* ── Parte B · la aplicación ────────────────────────────────────────
     El síntoma tal como se vio: un análisis cuya consulta no alcanza tiene
     que terminar en un error a la vista, NO en un sector con cero usos. */
  const B = await pg.evaluate(async (D) => {
    const { POL } = D, o = {};
    const esperar = ms => new Promise(x => setTimeout(x, ms));
    window.URBIS_CONFIG.ANALISIS.API = window.__URBIS_MOTOR;
    const R = window.URBIS_PC_RECON;
    const bPC = document.querySelector('[data-u52-call="procity-open-map"]');
    if (bPC) { bPC.click(); await esperar(600); }
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    const H = () => document.getElementById('pcr-hoja');
    /* Los atajos de radio viven en la forma POR RADIO, que es la de fábrica;
       la barra, en la forma por LOTE. Son dos controles distintos y hay que
       mirarlos donde cada uno se pinta. */
    const asa = H().querySelector('[data-pcr="agrandar"]'); if (asa) { asa.click(); await esperar(400); }
    o.atajos = [...H().querySelectorAll('[data-pcr="radio"]')].map(x => Number(x.getAttribute('data-r')));

    // El lote, para que aparezca la barra de «cuánto alrededor del lote».
    const bf = [...H().querySelectorAll('button')]
      .filter(x => /El lote y su entorno/.test(x.textContent || ''))[0];
    if (bf) { bf.click(); await esperar(400); }
    const bd = H().querySelector('[data-pcr="lote-dibujar"]');
    if (bd) { bd.click(); await esperar(500); }
    for (const p of POL) { window.map.fire('click', { latlng: { lat: p.lat, lng: p.lng } }); await esperar(60); }
    const bc = document.querySelector('#pcr-lote-barra [data-lote="cerrar"]');
    if (bc) { bc.click(); await esperar(900); }
    R.abrir(); await esperar(400);
    const barra = H().querySelector('[data-pcr="radio-rango"]');
    o.barraMax = barra ? Number(barra.getAttribute('max')) : 0;

    await esperar(5300);
    await window.__modo('remark');
    await R.analizar(); await esperar(900);
    const hoja = H() ? H().textContent : '';
    o.error = ((H() || document).querySelector('.pcr-error') || {}).textContent || '';
    o.diceCero = /Todos los usos\s*0\b/.test(hoja) || /\b0\s*usos registrados/.test(hoja);
    o.hayResultado = !!(R.estado && R.estado().resultado) ||
                     !!document.querySelector('[data-pcr="lamina-ver"]');
    return o;
  }, { POL });

  await pg.close(); await b.close();

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };

  console.log('\n  -- la consulta se escala con el área --');
  const q1 = (A.chico.consultas || [])[0] || '';
  const q2 = (A.grande.consultas || [])[0] || '';
  T('un sector de barrio pide sus segundos y su tope', A.chico.ok && segundosDe(q1) >= 60 && topeDe(q1) >= 3000,
    segundosDe(q1) + ' s · tope ' + topeDe(q1));
  T('y trae las capas de área, que a ese tamaño no pesan', !esLigera(q1),
    esLigera(q1) ? 'salió en ligero sin hacer falta' : 'landuse, edificios, vegetación y agua');
  /* Lo que fallaba: a 8 km son 201 km² y con veinticinco segundos no hay
     consulta que termine. */
  T('un sector de 8 km pide MÁS segundos y MÁS tope que uno de barrio',
    A.grande.ok && segundosDe(q2) > segundosDe(q1) && topeDe(q2) > topeDe(q1),
    segundosDe(q2) + ' s · tope ' + topeDe(q2));
  T('y a ese tamaño va directo en ligero, sin gastar tres minutos en la pesada',
    esLigera(q2), esLigera(q2) ? 'sin capas de área' : 'todavía pide los polígonos');
  T('y lo dice: el resultado avisa que no se leyeron esas capas',
    /uso del suelo/.test(A.grande.aviso || ''), (A.grande.aviso || 'sin aviso').slice(0, 80));

  console.log('\n  -- un «se me acabó el tiempo» no es un sector sin usos --');
  T('una respuesta con `remark` y lista vacía NO devuelve cero: falla',
    A.agotada.ok === false, A.agotada.ok ? 'devolvió ' + A.agotada.n + ' usos como si nada' : 'falló, que es lo correcto');
  T('y el error dice qué pasó y qué hacer, en vez de «saturado»',
    /no alcanzó a terminar/.test(A.agotada.error || '') && /radio menor/.test(A.agotada.error || ''),
    (A.agotada.error || '').slice(0, 110));
  T('antes de rendirse prueba la ligera: la última consulta va sin capas de área',
    (A.agotada.consultas || []).length >= 2 && esLigera((A.agotada.consultas || []).slice(-1)[0]),
    (A.agotada.consultas || []).length + ' consultas, la última ' +
      (esLigera((A.agotada.consultas || []).slice(-1)[0] || '') ? 'ligera' : 'pesada'));

  console.log('\n  -- cuando la pesada no alcanza, la ligera salva el análisis --');
  T('vuelve con los usos, no con las manos vacías', A.respaldo.ok && A.respaldo.n === 30,
    A.respaldo.ok ? A.respaldo.n + ' usos' : 'falló: ' + A.respaldo.error);
  T('y con el aviso de qué capa le faltó, para no presentarse como completo',
    /uso del suelo|vegetación/.test(A.respaldo.aviso || ''), (A.respaldo.aviso || 'sin aviso').slice(0, 80));

  console.log('\n  -- un vacío no se guarda en el caché --');
  T('un sector sin nada mapeado vuelve vacío y sin inventar un error',
    A.vacio.ok === true && A.vacio.n === 0, A.vacio.ok ? A.vacio.n + ' usos' : 'falló: ' + A.vacio.error);
  /* La comprobación que importa: la segunda sale a la red. Con el vacío
     guardado —lo de antes— volvía con cero sin consultar nada, y por eso
     repetir el análisis no arreglaba nunca el sector. */
  T('y al volver a pedir el MISMO sector se consulta de nuevo, no se sirve el cero',
    (A.reintento.consultas || []).length >= 1 && A.reintento.n === 30,
    (A.reintento.consultas || []).length + ' consultas nuevas · ' + A.reintento.n + ' usos');

  console.log('\n  -- una respuesta topada se dice --');
  T('al llegar al tope avisa de que las cifras son un mínimo',
    A.topada.ok && /tope/.test(A.topada.aviso || '') && /mínimo/.test(A.topada.aviso || ''),
    (A.topada.aviso || 'sin aviso').slice(0, 90));

  console.log('\n  -- el radio llega a 8 km --');
  T('la barra del radio llega a 8.000 m', B.barraMax === 8000, B.barraMax + ' m');
  T('y los atajos ofrecen los radios grandes', (B.atajos || []).indexOf(8000) >= 0,
    (B.atajos || []).join(' · ') || 'sin atajos');

  console.log('\n  -- el síntoma, tal como se vio en el teléfono --');
  T('un análisis cuya consulta no alcanza termina en un error a la vista',
    /no alcanzó a terminar|saturado/.test(B.error || ''), (B.error || 'sin error en pantalla').slice(0, 110));
  T('y NO en un sector con cero usos, que es lo que se veía',
    !B.diceCero && !B.hayResultado,
    B.diceCero ? 'la hoja sigue diciendo 0 usos' : 'sin resultado falso');

  T('y la página no soltó errores', err.length === 0, err.slice(0, 2).join(' · ') || 'ninguno');

  console.log('\n  ' + (mal ? mal + ' comprobaciones fallaron' : 'todo en verde'));
  process.exit(mal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
