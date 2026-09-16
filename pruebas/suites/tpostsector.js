const E = require('../entorno.js');
/* ANÁLISIS DE SECTOR Y ANÁLISIS POST-SECTOR (v929)
   ────────────────────────────────────────────────────────────────────────
   Hasta la v928 `tipoEstudio` valía siempre 'completo' y no había ninguna
   distinción entre lo que se sabe de un sector ANTES de pisarlo y lo que se
   sabe después. Esta suite mide esa distinción:

     · **sector** — solo fuentes publicadas: OpenStreetMap, el DANE, el
       satélite. La fotografía de arranque.
     · **post-sector** — el MISMO sector, recalculado, cuando hay al menos un
       dato de campo levantado. Lo que el campo no cerró sigue SIN MEDIR.

   POR QUÉ UNA SUITE PROPIA. Hacen falta las DOS ramas del interruptor en la
   misma corrida —sin campo y con campo—, y ninguna suite de la batería puede
   darlas: las que siembran puntos del curso los tienen desde el principio, y
   las de la lámina no siembran ninguno. Sin las dos, la comprobación pasaría
   por no tener nada que rechazar, que es el agujero que este proyecto lleva
   diecinueve tandas persiguiendo.

   LAS RAMAS, todas en una sola corrida:

     1 · sin nada levantado → el post-sector se MUESTRA deshabilitado y con
         la razón a la vista. No se esconde: un vacío se declara (v849), y
         además es lo único que le dice a un estudiante que hay algo que se
         gana saliendo a la calle.
     2 · con edificios mapeados → se habilita, recalcula, y declara de dónde
         sale lo que cambió. Es el caso que el usuario aprobó sabiendo que
         hace nacer post-sector a varios sectores ya existentes.
     3 · con una entrada de hueco → un BORRADOR no habilita y un CONFIRMADO
         sí. Es la escalera del módulo presidencial: un señalamiento no pesa.

   Y tres guardas sobre el almacén, que son las que impiden que esto se
   convierta en un cajón donde cabe cualquier cosa: un hueco que la lámina no
   declara se rechaza, una entrada sin procedencia se rechaza, y un punto de
   campo que ya está publicado NO se cuenta dos veces.                     */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO, LEAFLET = S + 'node_modules/leaflet/dist/';

/* Un sector cuadrado de ~1 km de lado sobre Cúcuta. */
const C = { lat: 7.8939, lng: -72.5078 }, L = 0.0045;
const POL = [{ lat: C.lat - L, lng: C.lng - L }, { lat: C.lat + L, lng: C.lng - L },
             { lat: C.lat + L, lng: C.lng + L }, { lat: C.lat - L, lng: C.lng + L }];

/* Los usos publicados. Uno de ellos —el índice 0— queda EXACTAMENTE donde
   después se pone un punto de campo: es el material que ejercita la regla de
   no contar dos veces lo que ya estaba mapeado. Sin ese solapamiento, la
   comprobación de la unión pasaría sin tener nada que descartar. */
const DOBLE = { lat: C.lat + 0.0012, lng: C.lng + 0.0012 };
const AMEN = ['pharmacy', 'restaurant', 'school', 'bank', 'cafe'];
function usosOSM() {
  const out = [];
  out.push({ type: 'node', id: 1, lat: DOBLE.lat, lon: DOBLE.lng,
             tags: { name: 'Farmacia ya publicada', amenity: 'pharmacy' } });
  for (let i = 0; i < 60; i++) {
    const a = (i * 137.5) * Math.PI / 180, d = (90 + (i % 7) * 50) / 111320;
    out.push({ type: 'node', id: 100 + i, lat: C.lat + Math.cos(a) * d, lon: C.lng + Math.sin(a) * d,
               tags: { name: 'Uso ' + i, amenity: AMEN[i % AMEN.length] } });
  }
  return out;
}

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota',
    locale: 'es-CO', viewport: { width: 412, height: 915 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true });
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(() => {
    if (window.top !== window) return;
    try {
      localStorage.setItem('urbis_licencia_analisis', 'URBIS1.deprueba.deprueba');
      localStorage.setItem('urbis_auth_session_v1', JSON.stringify({ usuario: 'urbisprocity',
        rol: 'admin', es_admin: true, session_token: 't', active: true, verified: true }));
      localStorage.removeItem('aia_overpass_cache_v1');
      localStorage.removeItem('pcr_fichas_v1');
      /* El almacén que esta suite mide: sin limpiarlo, una corrida anterior
         decidiría si el sector «tiene campo» antes de que la suite siembre
         nada, y la primera rama no tendría nada que medir. */
      localStorage.removeItem('pcr_campo_v1');
    } catch (e) {}
  });
  await ctx.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
  await ctx.route(/unpkg\.com/, r => { const u = r.request().url();
    r.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
      body: fs.readFileSync(LEAFLET + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') }); });
  await ctx.route(/script\.google\.com/, r => r.fulfill({ status: 200,
    contentType: 'application/json', body: '{"ok":true,"data":[]}' }));
  await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: fs.readFileSync(S + 'node_modules/chart.js/dist/chart.umd.js', 'utf8') }));
  await ctx.route(/locationiq\.com/, r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ address: { city: 'Cúcuta', state: 'Norte de Santander',
      country: 'Colombia', suburb: 'La Playa' } }) }));
  await E.rutaDane(ctx);
  await ctx.route(/overpass/, r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ elements: usosOSM() }) }));

  const pg = await ctx.newPage();
  const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo', { waitUntil: 'domcontentloaded' });
  await E.esperarLaApp(pg);

  const r = await pg.evaluate(async (D) => {
    const { C, POL, DOBLE } = D, o = {}, esperar = ms => new Promise(x => setTimeout(x, ms));
    const txt = el => (el ? (el.textContent || '') : '').replace(/\s+/g, ' ').trim();

    window.URBIS_CONFIG.ANALISIS.API = window.__URBIS_MOTOR;

    /* ── Sin nada levantado ────────────────────────────────────────────
       El curso no ha salido todavía. Se sustituye la lista de puntos, que
       es lo que el módulo lee, igual que el doble de Overpass sustituye la
       consulta: no se toca el estado por un lado. */
    window.urbisDatosVisibles = function () { return []; };

    window.map.setView([C.lat, C.lng], 15); await esperar(300);
    const A = window.URBIS_PC_ANALISIS, R = window.URBIS_PC_RECON;
    const bPC = document.querySelector('[data-u52-call="procity-open-map"]');
    if (bPC) { bPC.click(); await esperar(400); }
    A.iniciarDibujo();
    POL.forEach(p => A.agregarPunto(p.lat, p.lng));
    A.agregarPunto(POL[0].lat, POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(900);

    const hojaEl = () => document.getElementById('pcr-hoja');
    const botonCorrida = c => hojaEl().querySelector('[data-pcr="corrida"][data-c="' + c + '"]');
    const leerSw = () => {
      const bs = botonCorrida('sector'), bp = botonCorrida('post');
      return {
        hay: !!(bs && bp),
        sectorActiva: !!(bs && bs.classList.contains('activa')),
        postActiva: !!(bp && bp.classList.contains('activa')),
        postApagado: !!(bp && bp.disabled),
        razon: txt(hojaEl().querySelector('.pcr-corrida-falta')),
        por: txt(hojaEl().querySelector('.pcr-corrida-por'))
      };
    };

    const e0 = R.estado() || {};
    o.llave = e0.campoLlave || '';
    o.totalSector = e0.total || 0;
    o.corridaInicial = e0.corrida;
    o.sinCampo = { hay: e0.campoHay, razon: e0.campoRazon };
    o.swSinCampo = leerSw();

    /* Tocarlo con el campo vacío no puede llevar a ninguna parte. */
    const bp0 = botonCorrida('post');
    if (bp0) { bp0.click(); await esperar(400); }
    o.trasTocarApagado = (R.estado() || {}).corrida;

    /* ── Las tres guardas del almacén ──────────────────────────────────── */
    o.huecos = R.huecosDeCampo() || [];
    o.rechazaHueco = R.guardarEntradaCampo(o.llave, {
      hueco: 'lo-que-se-me-ocurra', estado: 'confirmado', valor: { x: 1 },
      fuente: { como: 'campo', quien: 'Ana', cuando: '2026-09-10' }
    });
    o.rechazaSinFuente = R.guardarEntradaCampo(o.llave, {
      hueco: 'norma-urbana', estado: 'confirmado', valor: { x: 1 }, fuente: { como: 'tramite' }
    });

    /* Un BORRADOR no habilita nada. */
    o.aceptaBorrador = R.guardarEntradaCampo(o.llave, {
      hueco: 'norma-urbana', estado: 'borrador', valor: { ocupacion: 0.6 },
      fuente: { como: 'tramite', quien: 'Ana Ruiz', cuando: '2026-09-10' }
    });
    o.conBorrador = R.tieneCampo(o.llave).hay;

    /* ── La unión, medida aparte ───────────────────────────────────────
       Se mide la REGLA sobre listas de mentira antes de mirar la corrida
       entera: un punto de campo encima de uno publicado no se suma, y uno
       lejos sí. Comprobar solo el total de la corrida dejaría pasar un
       error de conteo escondido entre sesenta usos. */
    const u = R.elementosPostSector(
      [{ type: 'node', id: 1, lat: DOBLE.lat, lon: DOBLE.lng, tags: {} }],
      [{ type: 'node', id: 'edu0', lat: DOBLE.lat, lon: DOBLE.lng, tags: {} },
       { type: 'node', id: 'edu1', lat: C.lat - 0.003, lon: C.lng - 0.003, tags: {} }]);
    o.union = { total: u.elementos.length, sumados: u.sumados, omitidos: u.omitidos };

    /* ── Con edificios levantados en campo ─────────────────────────────
       Se arman como los arma la aplicación: con `URBIS_SLOTS` y el
       vocabulario de js/03b, no con índices escritos a mano. Una constante
       del módulo copiada dentro de la prueba se pone roja por un cambio que
       no tiene nada que ver con lo que mide (v890). */
    const SL = window.URBIS_SLOTS;
    /* La cabecera de un punto mapeado es «Uso · Tipo», y el TIPO tiene que
       ser una clave real del catálogo de js/64: con una inventada,
       `puntoAElemento` devuelve null y el punto no entra al motor —medido:
       la unión daba 0 sumados y 0 omitidos, con los tres edificios contados
       igual por `edificiosDeCampo`, que mira otra cosa—. */
    const puntoEdificio = (lat, lng, tipo, pisos, fecha) => {
      const d = [];
      d[0] = 'Comercial · ' + tipo;
      d[SL.edificioPisos] = String(pisos);
      d[SL.edificioUsosPorPiso] = '1:Comercio';
      for (let i = 0; i < d.length; i++) if (d[i] === undefined) d[i] = '';
      return { lat: String(lat), lng: String(lng), tipo: 'Matriz de Usos',
               descripcion: d.join(' | '), fecha: fecha };
    };
    const PUNTOS = [
      /* Encima de la farmacia ya publicada: es el que NO se puede contar dos veces. */
      puntoEdificio(DOBLE.lat, DOBLE.lng, 'Droguería / farmacia', 2, '2026-09-02'),
      puntoEdificio(C.lat - 0.0030, C.lng - 0.0030, 'Local pequeño (tienda de barrio)', 2, '2026-09-05'),
      puntoEdificio(C.lat + 0.0030, C.lng - 0.0020, 'Panadería / repostería', 7, '2026-09-09')
    ];
    window.urbisDatosVisibles = function () { return PUNTOS; };

    R.cerrar(); await esperar(120); R.abrir(); await esperar(300);
    const e1 = R.estado() || {};
    o.conCampo = { hay: e1.campoHay, razon: e1.campoRazon };
    o.swConCampo = leerSw();

    /* ── Se pasa al post-sector ────────────────────────────────────────── */
    const bp = botonCorrida('post');
    o.pudoTocar = !!(bp && !bp.disabled);
    if (bp) { bp.click(); await esperar(2500); }
    const e2 = R.estado() || {};
    o.corridaPost = e2.corrida;
    o.hayPost = e2.corridaPost;
    o.avisoPost = e2.corridaAviso || '';
    o.totalPost = e2.total || 0;
    o.procedencia = e2.campoProcedencia || null;
    o.fuentesEdificio = ((e2.campoProcedencia && e2.campoProcedencia.fuentes) || [])
      .filter(function (f) { return f.clase === 'edificios'; })
      .map(function (f) { return { quien: f.quien || null, sinAutor: f.sinAutor === true }; });
    o.swPost = leerSw();
    o.textoPost = txt(hojaEl().querySelector('.pcr-corrida'));

    /* ── Y se vuelve al sector ─────────────────────────────────────────── */
    const bs = botonCorrida('sector');
    if (bs) { bs.click(); await esperar(500); }
    const e3 = R.estado() || {};
    o.vuelta = { corrida: e3.corrida, total: e3.total || 0 };

    return o;
  }, { C, POL, DOBLE });

  await b.close();

  const ok = (n, c, d) => { console.log('  ' + (c ? '✓' : '✗') + ' ' + n + (d !== undefined ? '  — ' + d : '')); return !!c; };
  let mal = 0; const T = (n, c, d) => { if (!ok(n, c, d)) mal++; };

  console.log('\n  -- el sector se analizó, y es la corrida de arranque --');
  T('hay análisis y lleva llave de sector', r.totalSector > 0 && !!r.llave,
    r.totalSector + ' usos · llave ' + (r.llave || '(ninguna)'));
  T('arranca en «análisis de sector»', r.corridaInicial === 'sector', r.corridaInicial);

  console.log('\n  -- sin nada levantado: se muestra, apagado, y dice por qué --');
  T('el sector NO tiene campo', r.sinCampo.hay === false, 'campoHay=' + r.sinCampo.hay);
  /* La que de verdad guarda: esconder el post-sector sería esconder el vacío,
     y es lo único que le dice a alguien que hay algo que ganar saliendo. */
  T('las dos corridas se pintan, y la de post-sector apagada',
    r.swSinCampo.hay && r.swSinCampo.postApagado && r.swSinCampo.sectorActiva,
    'sw=' + r.swSinCampo.hay + ' · apagado=' + r.swSinCampo.postApagado);
  T('la razón se lee en pantalla, no solo en un title',
    /campo|levantado/i.test(r.swSinCampo.razon), r.swSinCampo.razon.slice(0, 96) || '(en blanco)');
  T('y tocarlo apagado no lleva a ninguna parte', r.trasTocarApagado === 'sector', r.trasTocarApagado);

  console.log('\n  -- el almacén no es un cajón donde cabe cualquier cosa --');
  T('el inventario de huecos sale de la lámina y no está vacío',
    r.huecos.length >= 10 && r.huecos.indexOf('norma-urbana') !== -1,
    r.huecos.length + ' huecos');
  T('un hueco que la lámina no declara se rechaza',
    r.rechazaHueco && r.rechazaHueco.ok === false && /inventario/i.test(r.rechazaHueco.error || ''),
    (r.rechazaHueco && r.rechazaHueco.error || '').slice(0, 80));
  T('una entrada sin procedencia se rechaza, y dice qué falta',
    r.rechazaSinFuente && r.rechazaSinFuente.ok === false &&
      /quién/i.test(r.rechazaSinFuente.error || '') && /cuándo/i.test(r.rechazaSinFuente.error || ''),
    (r.rechazaSinFuente && r.rechazaSinFuente.error || '').slice(0, 96));
  T('un borrador se guarda y NO habilita el post-sector',
    r.aceptaBorrador && r.aceptaBorrador.ok === true && r.conBorrador === false,
    'guardado=' + (r.aceptaBorrador && r.aceptaBorrador.ok) + ' · habilita=' + r.conBorrador);

  console.log('\n  -- la unión no cuenta dos veces lo que ya estaba publicado --');
  T('un punto de campo encima de uno publicado no se suma; uno lejos sí',
    r.union.total === 2 && r.union.sumados === 1 && r.union.omitidos === 1,
    r.union.total + ' elementos · ' + r.union.sumados + ' sumados · ' + r.union.omitidos + ' omitidos');

  console.log('\n  -- con edificios levantados: se habilita y recalcula --');
  T('el sector pasa a tener campo', r.conCampo.hay === true, 'campoHay=' + r.conCampo.hay);
  T('el botón de post-sector se enciende', r.pudoTocar === true && !r.swConCampo.postApagado,
    'apagado=' + r.swConCampo.postApagado);
  T('se corre y queda puesta la corrida de post-sector',
    r.corridaPost === 'post' && r.hayPost === true && !r.avisoPost,
    'corrida=' + r.corridaPost + ' · hay=' + r.hayPost + (r.avisoPost ? ' · ' + r.avisoPost : ''));
  T('el interruptor lo refleja', r.swPost.postActiva && !r.swPost.sectorActiva,
    'post=' + r.swPost.postActiva + ' · sector=' + r.swPost.sectorActiva);

  console.log('\n  -- y dice qué lo cerró y de dónde salió --');
  /* La mitad que el usuario pidió confirmar antes de empezar: un sector que
     nace post-sector por edificios ya mapeados no se puede presentar igual
     que uno donde alguien llenó una plantilla. */
  T('la procedencia viaja pegada al resultado, no a la pantalla',
    !!(r.procedencia && r.procedencia.texto), r.procedencia ? r.procedencia.texto.slice(0, 110) : '(ninguna)');
  T('nombra lo que sí se sabe —cuántos y cuándo— y no afirma quién',
    !!(r.procedencia && /edificios reportados en la aplicación/.test(r.procedencia.texto) &&
       /2026-09-02/.test(r.procedencia.texto) && /2026-09-09/.test(r.procedencia.texto)),
    r.procedencia ? r.procedencia.texto.slice(0, 150) : '(ninguna)');
  /* El vacío se declara, no se calla: sin esta frase una procedencia sin
     autor se lee igual que una que no lo necesita. */
  T('y DECLARA que el autor falta, en vez de omitirlo',
    !!(r.procedencia && /sin autor declarado/.test(r.procedencia.texto)),
    r.procedencia ? r.procedencia.texto.slice(-90) : '(ninguna)');
  /* La guarda que de verdad protege: medido, una fila de reporte no guarda
     quién la hizo —solo tipo, lat, lng, descripción y fecha— así que
     cualquier nombre en esta fuente sería derivado de otro campo, que es
     inventar procedencia (v867). Se persigue la CLASE: ninguna fuente de
     edificios puede traer un autor, venga de donde venga. */
  T('ninguna fuente de edificios trae un autor derivado de otro sitio',
    !!(r.fuentesEdificio && r.fuentesEdificio.length &&
       r.fuentesEdificio.every(function (f) { return !f.quien && f.sinAutor === true; })),
    JSON.stringify(r.fuentesEdificio || []).slice(0, 140));
  T('el punto que ya estaba publicado no se contó dos veces',
    !!(r.procedencia && r.procedencia.omitidos >= 1),
    r.procedencia ? (r.procedencia.sumados + ' sumados · ' + r.procedencia.omitidos + ' omitidos') : '(ninguna)');
  T('y la pantalla dice que lo no cerrado sigue SIN MEDIR',
    /SIN MEDIR/.test(r.textoPost), (r.textoPost || '').slice(-120) || '(en blanco)');

  console.log('\n  -- ninguna reemplaza a la otra --');
  T('se vuelve al análisis de sector y sus cifras son las de antes',
    r.vuelta.corrida === 'sector' && r.vuelta.total === r.totalSector,
    r.vuelta.corrida + ' · ' + r.vuelta.total + ' usos (eran ' + r.totalSector + ')');

  T('la página no soltó errores', err.length === 0, err.join(' | ') || 'ninguno');

  console.log(mal ? '\n  ' + mal + ' comprobaciones fallaron\n' : '\n  todo en verde\n');
  process.exit(mal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
