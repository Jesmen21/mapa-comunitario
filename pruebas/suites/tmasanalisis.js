const E = require('../entorno.js');
/* Lo que estaba medido y no se mostraba.

   Salió de un inventario, no de una corazonada: se listó lo que el motor
   devuelve en cada respuesta contra lo que la aplicación lee, y aparecieron
   cinco cosas calculadas que no llegaban a ninguna parte o llegaban a medias.
   Esta suite es esa lista, comprobada una por una.

     1 · LA INUNDACIÓN estaba medida, salía en la ficha y en el informe en
         hojas, y no tenía caja en el pliego. En Cúcuta, con el Pamplonita y
         el Zulia, es de lo primero que pregunta un jurado.
     2 · LAS CIFRAS DE MOVILIDAD —vía principal y a qué distancia, corredores,
         paradas, ciclorrutas, facilidad para llegar, exposición al tránsito—
         solo salían en el informe en hojas.
     3 · EL FLUJO peatonal contra vehicular, con su reparto por franjas del
         día y su vida nocturna, viajaba en cada respuesta y NADIE lo leía.
         Cero usos en toda la aplicación.
     4 · VERDE Y AGUA —parques, cuerpos de agua, manchas de verde— igual: solo
         en el informe en hojas.
     5 · LA JERARQUÍA VIAL existía como recuadro del pliego y no como capa del
         mapa: era la única de las siete que estaba en el papel y no se podía
         encender sobre el sitio.

   El sector de prueba trae calles de las cuatro jerarquías, parques, una
   quebrada y paradas de bus, y el IDEAM contesta que el punto cae dentro de
   la mancha de cien años, que es el caso que hay que saber contar.          */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO, LEAFLET = S + 'node_modules/leaflet/dist/';
const C = { lat: 7.8939, lng: -72.5078 }, L = 0.005;
const POL = [{ lat: C.lat - L, lng: C.lng - L }, { lat: C.lat + L, lng: C.lng - L },
             { lat: C.lat + L, lng: C.lng + L }, { lat: C.lat - L, lng: C.lng + L }];
const GLAT = m => m / 110540, GLNG = m => m / (111320 * Math.cos(C.lat * Math.PI / 180));
const P = (dx, dy) => ({ lat: C.lat + GLAT(dy), lng: C.lng + GLNG(dx) });

let id = 1;
const nodo = (tags, dx, dy) => ({ type: 'node', id: id++,
  lat: P(dx, dy).lat, lon: P(dx, dy).lng, tags: tags });
const usos = [];
for (let i = 0; i < 10; i++) usos.push(nodo({ shop: 'clothes', name: 'Ropa ' + i }, -300 + i * 40, 150));
for (let i = 0; i < 8; i++) usos.push(nodo({ amenity: 'restaurant', name: 'Comida ' + i }, 80 + i * 35, -160));
for (let i = 0; i < 5; i++) usos.push(nodo({ amenity: 'school', name: 'Colegio ' + i }, -150 + i * 55, 300));
for (let i = 0; i < 4; i++) usos.push(nodo({ amenity: 'bar', name: 'Bar ' + i }, 120 + i * 40, 60));
// Lo que alimenta «verde y agua»: parques con nombre y un cuerpo de agua.
for (let i = 0; i < 3; i++) usos.push(nodo({ leisure: 'park', name: 'Parque ' + i }, -250 + i * 220, -260));
usos.push(nodo({ natural: 'water', name: 'Laguna del Parque' }, 300, 320));
usos.push(nodo({ landuse: 'forest', name: 'Bosque del cerro' }, -380, 380));
// Y lo que alimenta la movilidad: paradas de bus.
for (let i = 0; i < 4; i++) usos.push(nodo({ highway: 'bus_stop', name: 'Parada ' + i }, -200 + i * 140, 0));
/* Infraestructura de servicios: lo que sí registra OpenStreetMap. Un tanque,
   una subestación y una planta, a distancias distintas del lote, que es lo que
   la caja tiene que ordenar y medir. */
usos.push(nodo({ man_made: 'water_tower', name: 'Tanque La Cumbre' }, 90, 140));
usos.push(nodo({ power: 'substation', name: 'Subestación El Salado' }, -260, -180));
usos.push(nodo({ man_made: 'works', name: 'Planta de tratamiento' }, 420, -380));

/* Las vías llevan `center` además de `geometry`: la consulta de usos las pide
   con `out center` y de ahí saca el motor los corredores arteriales y su
   distancia. Sin el centro, un sector con avenidas se analizaba como si no
   tuviera ninguna vía con nombre. */
const via = (nombre, clase, pts) => ({ type: 'way', id: id++,
  tags: { highway: clase, name: nombre, lanes: '2' },
  center: { lat: pts[Math.floor(pts.length / 2)].lat, lon: pts[Math.floor(pts.length / 2)].lng },
  geometry: pts.map(p => ({ lat: p.lat, lon: p.lng })) });
/* Edificios vecinos del lote, con pisos: sin ellos la sombra que arroja el
   proyecto no tiene a quién tocar y la prueba pasaría diciendo «sin vecinos»
   sin haber comprobado nada. */
const edif = (dx, dy, w2, h2, pisos) => ({ type: 'way', id: id++,
  tags: { building: 'yes', 'building:levels': String(pisos) },
  geometry: [P(dx, dy), P(dx + w2, dy), P(dx + w2, dy + h2), P(dx, dy + h2), P(dx, dy)]
    .map(p => ({ lat: p.lat, lon: p.lng })) });
const geo = [
  via('Autopista Nacional', 'trunk', [P(-600, -500), P(-100, 0), P(600, 500)]),
  via('Avenida 1', 'primary', [P(-600, 200), P(600, 200)]),
  via('Avenida 3', 'primary', [P(-300, -600), P(-300, 600)]),
  via('Calle 8', 'secondary', [P(-600, -200), P(600, -200)]),
  via('Carrera 5', 'tertiary', [P(-600, 400), P(600, 400)]),
  via('Ciclorruta del río', 'cycleway', [P(-500, 100), P(500, 100)])
].concat(
  Array.from({ length: 8 }, (_, i) => via('Calle interior ' + i, 'residential',
    [P(-500 + i * 130, -500), P(-500 + i * 130, 500)])),
  /* PEGADOS al lote, que va de (−40,−30) a (40,30). A cuarenta metros no los
     alcanzaba ninguna sombra y la prueba pasaba diciendo «sin vecinos
     tocados», que es pasar sin comprobar nada: el camino que importa —contar
     a quién le cae encima— no se ejecutaba. Uno a cada lado, porque de qué
     lado cae la sombra depende de la hora. */
  [edif(-55, -20, 14, 40, 3), edif(41, -20, 14, 40, 3),
   edif(-20, 31, 40, 14, 4), edif(-150, -120, 70, 60, 5)]
);

/* El IDEAM: el punto cae dentro de la mancha de 100 años, que es la que usan
   los POT para delimitar y por tanto la que hay que saber decir. */
const CAPAS_IDEAM = [
  { id: 1, name: 'Amenaza Inundacion TR 2 Años Centros Poblados 2K' },
  { id: 5, name: 'Amenaza Inundacion TR 100 Años Centros Poblados 2K' }
];

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(() => {
    /* Solo en el marco principal: ver la nota en las demás suites. La
       aplicación crea un marco escondido para medir la lámina. */
    if (window.top !== window) return;
    try {
      localStorage.setItem('urbis_licencia_analisis', 'URBIS1.deprueba.deprueba');
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'urbisprocity', rol: 'admin',
        es_admin: true, session_token: 't', active: true, verified: true }));
      localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1');
    } catch (e) {}
  });
  await ctx.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
  await ctx.route(/unpkg\.com/, r => { const u = r.request().url();
    r.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
      body: fs.readFileSync(LEAFLET + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') }); });
  await ctx.route(/script\.google\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":[]}' }));
  await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route(/locationiq\.com/, r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ address: { city: 'Cúcuta', state: 'Norte de Santander', country: 'Colombia', suburb: 'La Playa' } }) }));
  await ctx.route(/overpass/, r => {
    const q = (r.request().postData() || '') + r.request().url();
    r.fulfill({ status: 200, contentType: 'application/json',
      // La consulta de usos también trae las vías —con su centro—: de ahí
      // salen los corredores arteriales, las paradas y el flujo.
      body: JSON.stringify({ elements: /out(\+|%20|\s)geom/.test(q) ? geo : usos.concat(geo) }) });
  });
  /* El DANE. La consulta de demografía pide sumas por sexo y por tramo de
     edad; sin esas columnas, `st.demografia` queda en nulo y la caja de «quién
     vive acá» no sale —que es correcto, pero deja la prueba sin comprobar
     nada—. Se responde con un reparto verosímil de un barrio joven. */
  const EDADES = ['0_4','5_9','10_14','15_19','20_24','25_29','30_34','35_39','40_44',
                  '45_49','50_54','55_59','60_64','65_69','70_74','75_79','80_84','85_89',
                  '90_94','95_99','100_MAS'];
  const REPARTO = [260,270,255,250,240,230,210,190,170,150,130,110,90,70,50,35,20,12,6,3,1];
  await ctx.route(/ags\.esri\.co/, r => {
    const u = decodeURIComponent(r.request().url());
    if (/SEXO_M/.test(u)) {
      const a = { MUJ: 1580, HOM: 1465 };
      EDADES.forEach((e, i) => { a['E' + e] = REPARTO[i]; });
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ features: [{ attributes: a }] }) });
    }
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ features: [{ attributes: { TOTAL: 3045, N: 42 } }] }) });
  });
  await ctx.route(/srvags\.sgc\.gov\.co/, r => {
    const u = decodeURIComponent(r.request().url());
    const cuerpo = /Zonas_amenaza_Sismica_NR10/.test(u)
      ? [{ attributes: { AMENAZA: 'ALTA', AA: 0.35, AV: 0.30, MUNICIPIO: 'CÚCUTA' } }]
      : [{ attributes: { PGA: 0.34, MUNICIPIO: 'CÚCUTA', DEPARTAMEN: 'NORTE DE SANTANDER' } }];
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: cuerpo }) });
  });
  await ctx.route(/visualizador\.ideam\.gov\.co/, r => {
    const u = decodeURIComponent(r.request().url());
    if (/MapServer\?f=json/.test(u)) {
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ layers: CAPAS_IDEAM, documentInfo: { Title: 'Amenaza ambiental' } }) });
    }
    /* Dos consultas por capa: si la capa CUBRE la zona (un rectángulo grande)
       y si CONTIENE el punto. Acá las dos capas cubren, y el punto cae dentro
       de la de cien años y fuera de la de dos. */
    const capa = (u.match(/MapServer\/(\d+)\/query/) || [])[1];
    const grande = /esriGeometryEnvelope/.test(u) || /distance=/.test(u);
    const cuenta = grande ? 1 : (capa === '5' ? 1 : 0);
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: cuenta }) });
  });

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  const r = await pg.evaluate(async (D) => {
    const { C, POL } = D, o = {}, esperar = ms => new Promise(x => setTimeout(x, ms));
    const txt = el => (el ? (el.textContent || '') : '').replace(/\s+/g, ' ').trim();
    window.URBIS_CONFIG.ANALISIS.API = window.__URBIS_MOTOR;
    let capturado = '';
    window.AIA_INFORME = window.AIA_INFORME || {};
    window.AIA_INFORME.abrirVentanaImpresion = function (h) { capturado = h; };
    window.map.setView([C.lat, C.lng], 15); await esperar(500);
    const A = window.URBIS_PC_ANALISIS, R = window.URBIS_PC_RECON;
    const bPC = document.querySelector('[data-u52-call="procity-open-map"]');
    if (bPC) { bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p => A.agregarPunto(p.lat, p.lng)); A.agregarPunto(POL[0].lat, POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1400);
    const H = () => document.getElementById('pcr-hoja');
    const abrir = async () => { const a = H().querySelector('[data-pcr="agrandar"]');
      if (a) { a.click(); await esperar(450); } };

    // ── Lo que hay que medir para que las cinco cosas existan.
    await esperar(5200);   // el limitador de Overpass: se espera, como una persona
    const medir = async (acc, sel) => {
      const x = H().querySelector('[data-pcr="' + acc + '"]');
      if (!x) return false;
      x.click();
      for (let i = 0; i < 70 && !document.querySelector(sel); i++) await esperar(400);
      await esperar(250); return !!document.querySelector(sel);
    };
    o.trazado = await medir('trazado', '.pcr-llenos');

    /* Un lote, que es lo que hace falta para el ruido y para la sombra que
       arroja el proyecto: las dos se calculan desde el predio, no desde el
       sector. */
    await abrir();
    const bf = [...H().querySelectorAll('button')].filter(x => /El lote y su entorno/.test(x.textContent || ''))[0];
    if (bf) { bf.click(); await esperar(400); }
    const bd = H().querySelector('[data-pcr="lote-dibujar"]');
    if (bd) { bd.click(); await esperar(500); }
    const LOTE = [[-40, -30], [40, -30], [40, 30], [-40, 30]];
    for (const [dx, dy] of LOTE) {
      window.map.fire('click', { latlng: { lat: C.lat + dy / 110540,
        lng: C.lng + dx / (111320 * Math.cos(C.lat * Math.PI / 180)) } });
      await esperar(60);
    }
    const bc = document.querySelector('#pcr-lote-barra [data-lote="cerrar"]');
    if (bc) { bc.click(); await esperar(900); }
    o.lados = (R.loteDePrueba() || []).length;
    R.abrir(); await esperar(400); await abrir();
    const bAm = H().querySelector('[data-pcr="amenaza"]');
    if (bAm) { bAm.click(); }
    for (let i = 0; i < 60 && !R.estadoInundacion; i++) await esperar(400);
    await esperar(2500);
    await abrir();

    // ── 3 · el flujo, en la ficha en pantalla.
    const hoja = txt(H());
    o.flujoEnFicha = /Quién pasa por acá/.test(hoja);
    o.flujoDice = (hoja.match(/Quién pasa por acá[^]{0,240}/) || [''])[0];

    // ── 5 · la capa de vías, sobre el mapa.
    const formas = () => document.querySelectorAll('.leaflet-overlay-pane path').length;
    o.formasAntes = formas();
    const bVia = H().querySelector('[data-pcr="capa"][data-c="vias"]');
    o.hayCapaVias = !!bVia;
    if (bVia) { bVia.click(); await esperar(900); }
    o.formasConVias = formas();
    o.viasEncendida = !!(R.estado && R.estado().viasEnMapa) ||
      !!document.querySelector('[data-pcr="capa"][data-c="vias"].on');
    await abrir();
    const bVia2 = H().querySelector('[data-pcr="capa"][data-c="vias"]');
    if (bVia2) { bVia2.click(); await esperar(700); }
    o.formasSinVias = formas();
    await abrir();

    /* ── La foto satelital, de mentira ─────────────────────────────────
       Acá no se mide el clasificador —tiene su propia suite—: lo único que
       hace falta es que el estado quede con una cobertura leída, que es lo
       que las dos hojas tienen que saber contar. Sin esto, la caja de
       cobertura del pliego no sale y la comprobación pasaría sola. */
    const pinta = (c1, c2) => {
      const cv = document.createElement('canvas'); cv.width = 200; cv.height = 140;
      const x = cv.getContext('2d');
      for (let i = 0; i < 200; i += 10) for (let j = 0; j < 140; j += 10) {
        x.fillStyle = ((i + j) / 10) % 2 ? c1 : c2; x.fillRect(i, j, 10, 10);
      }
      return cv.toDataURL('image/png');
    };
    A.analizarRaster = function (avisar) {
      if (avisar) avisar('leyendo');
      return Promise.resolve({ pixeles: 40000, malla: '200 × 200', mPorPx: 5,
        imagen: pinta('#5a7f4a', '#8b8f7a'),
        overlayImagen: pinta('#22c55e', '#94a3b8'),
        overlayLimites: [[C.lat - 0.006, C.lng - 0.006], [C.lat + 0.006, C.lng + 0.006]],
        clases: [{ id: 'verde', etq: 'Vegetación viva', color: '#22c55e', pct: 38, m2: 9000, fiable: true },
                 { id: 'construido', etq: 'Superficie dura gris', color: '#94a3b8', pct: 44, m2: 10400, fiable: true },
                 { id: 'agua', etq: 'Agua', color: '#3b82f6', pct: 3, m2: 700, fiable: true },
                 { id: 'suelo', etq: 'Suelo desnudo', color: '#a16207', pct: 15, m2: 3500, fiable: false }] });
    };
    const bcob = H().querySelector('[data-pcr="cobertura"]');
    if (bcob) { bcob.click(); await esperar(1600); }
    o.cobertura = !!R.cobertura();
    await abrir();

    // ── El papel.
    H().querySelector('[data-pcr="lamina-ver"]').click(); await esperar(900);
    o.lamina = capturado; capturado = '';
    await abrir();
    H().querySelector('[data-pcr="imprimir"]').click(); await esperar(900);
    o.pdf = capturado; capturado = '';

    // Y que todo esto viaje con la ficha archivada.
    o.guardado = (function () {
      try {
        const f = (R.leerFichas() || [])[0] || {};
        return { inundacion: !!f.inundacion,
                 flujo: !!(f.stats && f.stats.movilidad && f.stats.movilidad.flujo) };
      } catch (e) { return { error: String(e) }; }
    })();
    return o;
  }, { C, POL });

  r.err = err.filter(e => !/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();
  fs.writeFileSync(S + 'masanalisis-lamina.html', r.lamina || '', 'utf8');

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };
  const LAM = r.lamina || '', PDF = r.pdf || '';
  // El cuerpo de una caja de la lámina, para no confundir su texto con el de
  // la caja de al lado.
  const cajaDe = t => (LAM.split('<section class="caja')
    .filter(x => new RegExp('<h2>' + t + '</h2>').test(x))[0] || '');

  console.log('\n  -- 1 · la inundación llega al pliego --');
  T('la lámina trae su caja', !!cajaDe('La inundación'));
  T('y dice en qué mancha cae y cada cuánto se inunda',
    /100<\/b><small>años de retorno/.test(cajaDe('La inundación')) &&
    /se inunda/.test(cajaDe('La inundación')),
    (cajaDe('La inundación').match(/mancha de <b>\d+ años<\/b>[^<]*/) || ['no lo dice'])[0]);
  T('con la salvedad, que es la mitad del dato',
    /no es un certificado/.test(cajaDe('La inundación')));
  T('y va en la banda ambiental, con el resto del riesgo',
    /banda-ambiental[^]*?<h2>La inundación<\/h2>/.test(LAM.replace(/\n/g, '')));

  console.log('\n  -- 2 · cómo se llega, con cifras --');
  const CL = cajaDe('Cómo se llega');
  T('la lámina trae su caja', !!CL);
  T('con la vía que manda y a qué distancia',
    /Vía principal<\/span><b>[^<]*Autopista Nacional/.test(CL),
    (CL.match(/Vía principal<\/span><b>[^<]*/) || ['no está'])[0].replace(/<[^>]*>/g, ' '));
  T('los corredores, las paradas y la ciclorruta',
    /Corredores arteriales/.test(CL) && /Paradas de transporte/.test(CL) &&
    /Tramos de ciclorruta/.test(CL));
  T('y los dos índices, que antes solo salían en el informe en hojas',
    /facilidad para llegar \/100/.test(CL) && /exposición al tránsito \/100/.test(CL));
  T('va en la banda de movilidad, con la red y la calle',
    /banda-movilidad[^]*?<h2>Cómo se llega<\/h2>/.test(LAM.replace(/\n/g, '')));

  console.log('\n  -- 3 · el flujo, que no salía en ninguna parte --');
  T('sale en la ficha en pantalla', r.flujoEnFicha === true,
    (r.flujoDice || '').slice(0, 90) || 'no sale');
  T('con el reparto del día', /Mañana|Mediodía|Tarde|Noche/.test(r.flujoDice || ''),
    (r.flujoDice || '').slice(0, 120));
  T('y con la lectura, no solo el número',
    /Manda el|No pasa casi nadie|parejos/.test(r.flujoDice || ''),
    (r.flujoDice || '').replace(/^[^]*?(Manda el|No pasa|Peatón y carro)/, '$1').slice(0, 90));
  T('y llega al pliego', /Flujo a pie contra en carro/.test(CL),
    (CL.match(/Flujo a pie contra en carro<\/span><b>[^<]*/) || ['no llega'])[0].replace(/<[^>]*>/g, ' '));

  console.log('\n  -- 4 · verde y agua --');
  const VA = cajaDe('Verde y agua');
  T('la lámina trae su caja', !!VA);
  T('con parques, agua y manchas de verde',
    /parques<\/small>/.test(VA) && /cuerpos de agua<\/small>/.test(VA) &&
    /manchas de verde<\/small>/.test(VA));
  T('y dice que cuenta lo REGISTRADO, no lo que hay',
    /OpenStreetMap tiene registrado/.test(VA));

  console.log('\n  -- 5 · la jerarquía vial, también sobre el mapa --');
  T('la capa está en el panel', r.hayCapaVias === true);
  T('y encenderla dibuja la red', r.formasConVias > r.formasAntes,
    r.formasAntes + ' → ' + r.formasConVias + ' formas');
  T('apagarla la quita', r.formasSinVias <= r.formasAntes,
    r.formasConVias + ' → ' + r.formasSinVias + ' formas');

  console.log('\n  -- 6 · el ruido del tránsito, modelado --');
  const RU = cajaDe('El ruido del tránsito');
  T('la lámina trae su caja', !!RU);
  T('con el nivel estimado en dB(A) y su grado',
    /dB\(A\) estimados/.test(RU) && /(Muy alto|Alto|En el límite|Moderado|Tranquilo)<\/b>/.test(RU),
    (RU.match(/>([\d,]+)<\/b><small>dB\(A\) estimados/) || ['no está'])[1] || 'no está');
  T('y las vías que más aportan, con su distancia',
    /Autopista Nacional|Avenida|Calle/.test(RU) && /dB · a \d+ m/.test(RU),
    (RU.match(/>[^<]*<\/span><b>[\d,]+ dB · a \d+ m/) || ['no lo dice'])[0].replace(/<[^>]*>/g, ' '));
  /* Lo que separa un modelo honesto de un número inventado es que diga qué no
     sabe. Acá eso no es cosmético: sin la advertencia, 68 dB(A) estimados se
     leen como 68 dB(A) medidos. */
  T('y dice que es ESTIMADO, no medido, y qué no sabe',
    /ESTIMADO, no medido/.test(RU) && /sonómetro/.test(RU));
  T('con el límite de la norma colombiana a la vista', /627 de 2006/.test(RU));

  console.log('\n  -- 7 · la sombra que arroja el proyecto --');
  const SO = cajaDe('La sombra que arrojás');
  T('la lámina trae su caja', !!SO);
  T('con los pisos que permite la norma y la altura',
    /pisos que permite la norma/.test(SO) && /m de alto/.test(SO));
  T('y cuántos m² de sombra se salen del lote, hora por hora',
    (SO.match(/A las \d+:00<\/span><b>[^<]*m² fuera/g) || []).length >= 2,
    (SO.match(/A las \d+:00<\/span><b>[^<]*/g) || []).map(x => x.replace(/<[^>]*>/g, ' ')).join(' · ') || 'no lo dice');
  /* Y que de verdad le caiga a alguien. Aceptar «sin vecinos tocados» como
     respuesta válida dejaba sin ejecutar el único camino que importa. */
  const tocados = (SO.match(/(\d+) vecinos? tocados?/g) || [])
    .map(x => Number(x.match(/\d+/)[0]));
  T('y le cae encima a alguien de verdad, con su cuenta',
    tocados.some(n2 => n2 > 0) && /le tapa el <b>\d+%<\/b>/.test(SO),
    (SO.match(/le cae encima a <b>\d+<\/b> edificios?[^]*?le tapa el <b>\d+%<\/b>/) || ['no toca a nadie'])[0]
      .replace(/<[^>]*>/g, ''));
  T('y advierte que el volumen es el de la norma, no un proyecto dibujado',
    /no un proyecto dibujado/.test(SO) && /encogiendo el lote/.test(SO));

  console.log('\n  -- 4 · la infraestructura de servicios --');
  const IN = cajaDe('Infraestructura de servicios');
  T('la lámina trae su caja cuando hay algo registrado', !!IN);
  T('con lo que hay y a qué distancia',
    /objetos registrados/.test(IN) && /a \d+ m/.test(IN),
    (IN.match(/>(\d+)<\/b><small>objetos registrados/) || ['?', '0'])[1] + ' objetos');
  /* Y lo que NO es. Esta es la aserción que importa: sin ella, una caja
     titulada «infraestructura de servicios» se lee como si contestara si el
     barrio tiene agua, y no lo contesta ni puede. */
  T('y dice a las claras que no es la cobertura de servicios públicos',
    /NO es la cobertura de servicios públicos/.test(IN) && /censo del DANE por manzana/.test(IN));

  console.log('\n  -- la cuadra: la escala que faltaba --');
  const CU = cajaDe('La cuadra del lote');
  T('la lámina trae su caja', !!CU);
  T('con el frente al que da y cuánto mide el tramo',
    /Frente sobre<\/span><b>[^<]*Calle interior|Frente sobre<\/span><b>[^<]*Avenida|Frente sobre<\/span><b>[^<]*Calle/.test(CU) &&
    /Tramo medido<\/span><b>\d+ m/.test(CU),
    (CU.match(/Frente sobre<\/span><b>[^<]*/) || ['no lo dice'])[0].replace(/<[^>]*>/g, ' '));
  T('cuánto del frente tiene fachada y cuántos edificios',
    /del frente con fachada/.test(CU) && /edificios dan al frente/.test(CU),
    (CU.match(/>(\d+)%<\/b><small>del frente con fachada/) || ['?', '?'])[1] + '% con ' +
    (CU.match(/>(\d+)<\/b><small>edificios dan al frente/) || ['?', '?'])[1] + ' edificios');
  /* El promedio esconde lo que importa: un frente 70 % construido con los
     huecos repartidos es otra cosa que uno con un baldío de cuarenta metros.
     Por eso se guarda el mayor y no solo la cuenta. */
  T('y los huecos, con el mayor aparte', /Huecos<\/span><b>\d+/.test(CU),
    (CU.match(/Huecos<\/span><b>[^<]*/) || ['no'])[0].replace(/<[^>]*>/g, ' '));
  T('con la lectura para proyectar, no solo cifras',
    /Frente continuo|Frente roto|Frente a medias/.test(CU),
    (CU.match(/(Frente continuo|Frente roto|Frente a medias)[^<]{0,60}/) || ['no la trae'])[0]);
  /* Y lo que NO es. Sin esta frase, «edificios que dan al frente» se lee como
     predios y alguien cuenta lotes que nadie contó. */
  T('y dice que NO es catastro, que cuenta edificios',
    /NO es catastro/.test(CU) && /no predios|y no predios/.test(CU));

  console.log('\n  -- los índices, por fin citables --');
  const QC = cajaDe('Qué cabe en el lote');
  /* El bloque que pide la fuente dice «sale en la lámina» desde que existe, y
     no salía: el papel llevaba los números y no de dónde venían, que es lo que
     los hace defendibles. Sin fuente anotada, que lo diga. */
  T('sin fuente anotada, el papel lo dice',
    /nadie anotó de dónde/.test(QC),
    (QC.match(/nadie anotó de dónde[^<]{0,40}/) || ['no lo dice'])[0]);

  /* ── Y que los dos documentos no se contradigan ─────────────────────
     El pliego y el informe en hojas son distintos a propósito —uno se cuelga
     y el otro se lee—, pero lo que traen no puede contradecirse. Seis
     mediciones llegaban al pliego y no al informe: quien archivara el informe
     de un sector se quedaba sin la inundación, sin el ruido, sin la sombra
     que arroja, sin la infraestructura, sin el flujo y sin quién vive acá.

     Esta comprobación es la que impide que vuelva a pasar: cada medición
     nueva tiene que aparecer en los dos, o alguien tiene que venir acá y
     escribir por qué no. */
  console.log('\n  -- los dos documentos dicen lo mismo --');
  /* ── El inventario de v739 ──────────────────────────────────────────
     Se volvió a listar bloque por bloque lo que sale en la ficha contra lo
     que sale en cada documento, y quedaban seis mediciones que la pantalla
     mostraba y el papel no —o mostraba en uno solo—. Ninguna es un cálculo
     nuevo: los seis números ya venían en la respuesta y ya se pintaban.

       · CUÁNTA GENTE: el pliego llevaba el total suelto en «El sitio» y el
         informe no llevaba nada. Sin el año del censo al lado, un total de
         habitantes no se sabe si es conteo o pronóstico.
       · QUÉ MANDA: el reparto por PESO de los usos —distinto del conteo por
         categoría— solo estaba en el informe.
       · LA CALLE COMERCIAL y CÓMO CAMBIA AL ALEJARSE: en ninguno de los dos.
       · DÓNDE SE CONCENTRA: en ninguno de los dos.
       · LA COBERTURA DEL SUELO: en el informe sí; en el pliego no, y encima
         la caja de «Verde y agua» mandaba a leerla —«dice cuánto verde hay
         de verdad»—, o sea que la lámina prometía una caja que no existía. */
  const secDe = t => (PDF.split('<h2>')
    .filter(x => x.indexOf(t + '</h2>') === 0)[0] || '');

  console.log('\n  -- cuánta gente vive acá, con su año --');
  const CG = cajaDe('Quién vive acá'), SG = secDe('Cuánta gente vive acá');
  T('el informe trae la sección', !!SG);
  T('con el conteo del censo y su año', /Contadas por el censo de 20\d\d/.test(SG),
    (SG.match(/Contadas por el censo de \d+<\/td><td class="n">[\d.,]+/) || ['no lo dice'])[0]);
  T('y la proyección marcada como proyección',
    /Proyectadas a/.test(SG) && /no es un dato contado/.test(SG));
  T('el pliego dice lo mismo', /Contadas por el censo de 20\d\d/.test(CG) &&
    /Proyectadas a/.test(CG), (CG.match(/Contadas por el censo de \d+<\/span><b>[\d.,]+/) || ['no lo dice'])[0]);
  T('y no confunde un conteo con un pronóstico',
    /no es un dato contado/.test(CG), (CG.match(/Un pronóstico[^<]*/) || ['no lo advierte'])[0]);

  console.log('\n  -- qué manda en el sector, por peso --');
  const QM = cajaDe('Qué manda en el sector');
  T('el pliego trae su caja', !!QM);
  T('con el uso que predomina y su porcentaje', /Predomina <b>[^<]+<\/b> con el \d+%/.test(QM),
    (QM.match(/Predomina <b>[^<]+<\/b> con el \d+%/) || ['no lo dice'])[0]);
  T('y la mezcla se calcula sobre ESTE reparto, no sobre el conteo de puntos',
    /Mezcla de usos/.test(QM) && !/Mezcla de usos/.test(cajaDe('Qué hay, por categoría')),
    'en «qué manda»: ' + (/Mezcla de usos/.test(QM) ? 'sí' : 'NO') +
    ' · duplicada en «por categoría»: ' + (/Mezcla de usos/.test(cajaDe('Qué hay, por categoría')) ? 'SÍ' : 'no'));

  console.log('\n  -- dónde está la calle comercial --');
  const NC = cajaDe('Dónde está la calle comercial'), NS = secDe('Dónde está la calle comercial');
  T('el pliego trae su caja', !!NC);
  T('el informe trae su sección', !!NS);
  T('con cuántos locales y a qué distancia', /\d+ locales/.test(NC) && /\d+ m/.test(NC),
    (NC.match(/\d+ locales · [^<]*/) || ['no lo dice'])[0]);
  T('y los dos cuentan los mismos núcleos',
    (NC.match(/\d+ locales/g) || []).length === (NS.match(/\d+ locales/g) || []).length,
    'pliego ' + (NC.match(/\d+ locales/g) || []).length +
    ' · informe ' + (NS.match(/\d+ locales/g) || []).length);

  console.log('\n  -- cómo cambia al alejarse, y hacia dónde --');
  const AN = cajaDe('Cómo cambia al alejarse'), AS = secDe('Cómo cambia al alejarse');
  T('el pliego trae su caja', !!AN);
  T('el informe trae su sección', !!AS);
  T('con los anillos y de dónde se miden',
    /un grupo por anillo/.test(AN) && /un grupo por anillo/.test(AS));
  T('y el rumbo que concentra, que no salía en ningún papel',
    /reúne <b>\d+ de \d+<\/b>/.test(AN) && /reúne <b>\d+ de \d+<\/b>/.test(PDF),
    (AN.match(/La mitad <b>[^<]+<\/b> reúne <b>\d+ de \d+/) || ['no lo dice'])[0]);

  console.log('\n  -- la cobertura del suelo, en el pliego --');
  const CB = cajaDe('Cobertura del suelo');
  T('la foto quedó leída', r.cobertura === true);
  T('el pliego trae su caja', !!CB);
  T('con los porcentajes de la foto', /Vegetación viva<\/span><b>38%/.test(CB),
    (CB.match(/Vegetación viva<\/span><b>[^<]*/) || ['no lo dice'])[0]);
  T('y dice que no depende de que alguien lo haya mapeado',
    /No depende de que alguien lo haya mapeado/.test(CB));
  T('que es justo lo que «Verde y agua» promete que dirá',
    /caja de cobertura del suelo dice cuánto verde hay de verdad/.test(cajaDe('Verde y agua')) && !!CB);
  T('va en la banda ambiental, con el resto del suelo',
    /banda-ambiental[^]*?<h2>Cobertura del suelo<\/h2>/.test(LAM.replace(/\n/g, '')));

  const EN_LOS_DOS = [
    ['la inundación', /La inundación/, /La inundación/],
    ['cómo se llega', /Cómo se llega/, /Cómo funciona el sector/],
    ['el flujo', /Flujo a pie contra en carro/, /Quién pasa: flujo a pie/],
    ['verde y agua', /Verde y agua/, /Verde y agua:/],
    ['el ruido', /El ruido del tránsito/, /El ruido del tránsito/],
    ['la sombra que arrojás', /La sombra que arrojás/, /La sombra que arroja el proyecto/],
    ['la infraestructura', /Infraestructura de servicios/, /Infraestructura de servicios/],
    ['quién vive acá', /Quién vive acá/, /Quién vive acá/],
    ['la cuadra', /La cuadra del lote/, /La cuadra del lote/],
    ['de dónde salieron los índices', /nadie anotó de dónde/, /nadie anotó de dónde/],
    /* Las de v739. La cobertura entra en la lista con la salvedad de que en
       el informe se llama «Cobertura del suelo (foto satelital)»: es la misma
       medición con el rótulo largo, y por eso el patrón del informe pide el
       encabezado y no el texto suelto. */
    ['cuánta gente vive acá', /Contadas por el censo de/, /Cuánta gente vive acá/],
    ['qué manda en el sector', /Qué manda en el sector/, /Cómo funciona el sector/],
    ['la calle comercial', /Dónde está la calle comercial/, /Dónde está la calle comercial/],
    ['cómo cambia al alejarse', /Cómo cambia al alejarse/, /Cómo cambia al alejarse/],
    ['dónde se concentra', /Es el lado más activo/, /Es el lado más activo/],
    ['la cobertura del suelo', /<h2>Cobertura del suelo<\/h2>/, /<h2>Cobertura del suelo \(foto satelital\)<\/h2>/]
  ];
  EN_LOS_DOS.forEach(([nombre, enPliego, enInforme]) => {
    const p1 = enPliego.test(LAM), p2 = enInforme.test(PDF);
    T(nombre + ', en el pliego y en el informe', p1 && p2,
      'pliego: ' + (p1 ? 'sí' : 'NO') + ' · informe: ' + (p2 ? 'sí' : 'NO'));
  });

  /* ── Las redes, en todo lo que se imprime ───────────────────────────
     Un pliego colgado en una entrega lo mira gente que no sabe de dónde
     salió. La cuenta va al pie de los dos documentos, y en un solo lugar del
     código: el día que cambie no puede quedar un PDF viejo mandando a un
     perfil que ya no existe. */
  console.log('\n  -- las redes de URBIS, al pie --');
  /* Cada perfil con su logo y separado del otro. La frase corrida —«Instagram
     y TikTok @urbis_co»— se leía en el pliego impreso como una línea más de
     texto legal: una red se reconoce por su forma antes que por su nombre.
     Los logos van dibujados en el documento y no traídos de una dirección: el
     PDF se arma metiendo el HTML dentro de un SVG, y una imagen de fuera se
     queda en blanco sin avisar. */
  const perfiles = h => (h.match(/<span class="red">/g) || []).length;
  const logos = h => ({ instagram: /<circle cx="17\.5" cy="6\.6"/.test(h),
                        tiktok: /d="M15\.9 2\.2h2\.9/.test(h) });
  T('el pliego lleva los dos perfiles, separados', perfiles(LAM) === 2,
    perfiles(LAM) + ' perfiles · ' + (LAM.match(/@urbis_co/g) || []).length + ' veces la cuenta');
  T('cada uno con el logo de su red', logos(LAM).instagram && logos(LAM).tiktok,
    JSON.stringify(logos(LAM)));
  T('y van en el pie, no perdidas en una caja',
    /<footer class="pie">[^]*@urbis_co[^]*<\/footer>/.test(LAM.replace(/\n/g, '')));
  T('a la derecha, con las fuentes', /text-align:right"[^]*?@urbis_co/.test(LAM.replace(/\n/g, '')));
  T('el informe en hojas lleva los mismos dos', perfiles(PDF) === 2 &&
    logos(PDF).instagram && logos(PDF).tiktok, perfiles(PDF) + ' perfiles');
  T('sin imágenes traídas de fuera, que el PDF dejaría en blanco',
    !/<img[^>]*class="red|class="red"[^]*?<img/.test(LAM) &&
    !/(src|href)="https?:[^"]*(instagram|tiktok)/i.test(LAM + PDF));

  console.log('\n  -- y todo viaja con la ficha --');
  T('la inundación queda archivada', (r.guardado || {}).inundacion === true);
  T('y el flujo también', (r.guardado || {}).flujo === true,
    JSON.stringify(r.guardado));

  console.log('');
  T('sin errores de JavaScript', r.err.length === 0, r.err.join(' | ') || 'ninguno');
  console.log('\n  ' + (mal ? mal + ' fallaron' : 'todo pasó'));
  process.exit(mal ? 1 : 0);
})();
